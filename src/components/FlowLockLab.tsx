import { useMemo, useState } from 'react'
import { PODS, runFlow, type Guard } from '../sim/flowLock'
import { usePlayback } from './usePlayback'

const MODES: { id: Guard; label: string; summary: string }[] = [
  {
    id: 'none',
    label: 'No lock',
    summary: 'Every copy reads “pending” before any of them has saved, so every copy calls the provider.',
  },
  {
    id: 'local',
    label: 'In-process lock',
    summary: 'A mutex or synchronized block only sees threads in its own pod. Copies that land on other pods walk straight past it.',
  },
  {
    id: 'redis',
    label: 'Redis distributed lock',
    summary:
      'SET lock:withdrawal:981 <token> NX PX 30000 before the flow, delete-if-token-matches after. One key guards the read, the provider call and the save on every pod, with no database transaction held open across a network call.',
  },
]

const SCALE = Math.max(...MODES.map((m) => runFlow(m.id).duration))
const pct = (ms: number) => `${(ms / SCALE) * 100}%`

export function FlowLockLab() {
  const [guard, setGuard] = useState<Guard>('none')
  const run = useMemo(() => runFlow(guard), [guard])
  const play = usePlayback(run.duration, 1 / 6)
  const info = MODES.find((m) => m.id === guard)!
  const first = run.attempts.find((a) => a.charged)

  const choose = (next: Guard) => {
    setGuard(next)
    play.reset()
  }

  return (
    <div className="lab">
      <div className="lab-head">
        <h3>One withdrawal, four submissions, three pods</h3>
        <p>
          A double tap and two client retries send the same withdrawal four times. The load
          balancer spreads them over three pods. Each runs the same flow: read the status, call the
          payment provider, save the result.
        </p>
      </div>

      <div className="segmented" role="radiogroup" aria-label="Where the lock lives">
        {MODES.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={guard === m.id} onClick={() => choose(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <p className="lab-summary lab-summary-tall">{info.summary}</p>

      <div className="gantt-scroll" tabIndex={0} role="group" aria-label="Timeline of the four submissions">
        <div className="gantt gantt-labelled" aria-hidden="true">
          {run.attempts.map((a) => (
            <div key={a.arrive} className="gantt-line">
              <span className="gantt-label">{PODS[a.pod]}</span>
              <div className="gantt-row" style={{ clipPath: `inset(0 ${100 - ((play.now ?? 0) / SCALE) * 100}% 0 0)` }}>
                {a.start > a.arrive && (
                  <span className="gantt-job gantt-wait" style={{ left: pct(a.arrive), width: pct(a.start - a.arrive) }}>
                    waits for lock
                  </span>
                )}
                <span
                  className={!a.charged ? 'gantt-job gantt-skip' : a === first ? 'gantt-job' : 'gantt-job gantt-late'}
                  style={{ left: pct(a.start), width: pct(a.end - a.start) }}
                >
                  {!a.charged ? '' : a === first ? 'charges provider' : 'charges it again'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ul className="system-legend">
        <li>
          <span className="swatch swatch-ink" /> calls the payment provider
        </li>
        <li>
          <span className="swatch swatch-dup" /> duplicate charge
        </li>
        <li>
          <span className="swatch swatch-pending" /> waiting for the lock
        </li>
        <li>
          <span className="swatch swatch-done" /> already done, returns the saved result
        </li>
      </ul>

      <div className="lab-foot">
        <button type="button" className="primary" onClick={play.start} disabled={play.running}>
          {play.finished ? 'Submit again' : 'Submit the withdrawal'}
        </button>
        {play.finished && (
          <p className={run.charges > 1 ? 'verdict verdict-bad' : 'verdict verdict-good'} role="status">
            {run.charges > 1
              ? `The provider was charged ${run.charges} times for one withdrawal.`
              : 'Charged once. The other three waited for the lock, saw the withdrawal was done, and returned the same result.'}
          </p>
        )}
      </div>
    </div>
  )
}
