import { useMemo, useState } from 'react'
import { dispatch, type Dispatch } from '../sim/ordering'
import { usePlayback } from './usePlayback'

const MODES: { id: Dispatch; label: string; summary: string }[] = [
  {
    id: 'single',
    label: 'One thread',
    summary: 'Safe and slow. Every user waits behind every other user in the partition.',
  },
  {
    id: 'pool',
    label: 'Any free thread',
    summary: 'A plain thread pool. Fast, but a quick event can overtake a slow earlier one from the same user.',
  },
  {
    id: 'hash',
    label: 'hash(user) % threads',
    summary: 'Each user is pinned to one thread, the way Kafka pins a key to a partition. Users run in parallel; one user never does.',
  },
]

const SCALE = dispatch('single').duration

export function OrderingLab() {
  const [mode, setMode] = useState<Dispatch>('pool')
  const run = useMemo(() => dispatch(mode), [mode])
  const play = usePlayback(run.duration, 1 / 3)
  const info = MODES.find((m) => m.id === mode)!

  const choose = (next: Dispatch) => {
    setMode(next)
    play.reset()
  }

  const shown = play.now ?? 0

  return (
    <div className="lab">
      <div className="lab-head">
        <h3>One consumer, four threads, still in order</h3>
        <p>
          A partition holds three events each for users A to F. One consumer must go faster than a
          single thread without ever applying a user’s events out of order.
        </p>
      </div>

      <div className="segmented" role="radiogroup" aria-label="How the consumer picks a thread">
        {MODES.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} onClick={() => choose(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <p className="lab-summary">{info.summary}</p>

      <div className="gantt-scroll" tabIndex={0} role="group" aria-label="Thread timeline">
        <div className="gantt" style={{ clipPath: `inset(0 ${100 - (shown / SCALE) * 100}% 0 0)` }} aria-hidden="true">
          {Array.from({ length: run.workers }, (_, worker) => (
            <div key={worker} className="gantt-row">
              {run.jobs
                .filter((job) => job.worker === worker)
                .map((job) => (
                  <span
                    key={job.user + job.seq}
                    className={job.outOfOrder ? 'gantt-job gantt-late' : 'gantt-job'}
                    style={{
                      left: `${(job.start / SCALE) * 100}%`,
                      width: `${((job.end - job.start) / SCALE) * 100}%`,
                    }}
                  >
                    {job.user}
                    {job.seq}
                  </span>
                ))}
            </div>
          ))}
        </div>
      </div>

      <div className="lab-foot">
        <button type="button" className="primary" onClick={play.start} disabled={play.running}>
          {play.finished ? 'Consume again' : 'Consume the partition'}
        </button>
        {play.finished && (
          <p className={run.outOfOrder ? 'verdict verdict-bad' : 'verdict verdict-good'} role="status">
            {run.outOfOrder
              ? `Done in ${run.duration} ms, but ${run.outOfOrder} event finished before an earlier event of the same user.`
              : mode === 'single'
                ? `In order, and it took ${run.duration} ms.`
                : `In order for every user, in ${run.duration} ms instead of ${SCALE} ms.`}
          </p>
        )}
      </div>
    </div>
  )
}
