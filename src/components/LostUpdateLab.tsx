import { useEffect, useMemo, useState } from 'react'
import { OPENING_BALANCE, STRATEGIES, race, type Strategy } from '../sim/lostUpdate'

const STEP_MS = 850

export function LostUpdateLab() {
  const [strategy, setStrategy] = useState<Strategy>('naive')
  const [shown, setShown] = useState(0)
  const outcome = useMemo(() => race(strategy), [strategy])
  const finished = shown >= outcome.steps.length
  const started = shown > 0

  useEffect(() => {
    if (!started || finished) return
    const timer = window.setTimeout(() => setShown((n) => n + 1), STEP_MS)
    return () => window.clearTimeout(timer)
  }, [shown, started, finished])

  const choose = (next: Strategy) => {
    setStrategy(next)
    setShown(0)
  }

  const balance = shown === 0 ? OPENING_BALANCE : outcome.steps[shown - 1].balance
  const info = STRATEGIES.find((s) => s.id === strategy)!

  return (
    <div className="lab">
      <div className="lab-head">
        <h3>Two withdrawals, one account</h3>
        <p>
          The account holds 100. One transaction withdraws 70 while another withdraws 50. Only one
          of them can be allowed.
        </p>
      </div>

      <div className="segmented" role="radiogroup" aria-label="Locking strategy">
        {STRATEGIES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={strategy === s.id}
            onClick={() => choose(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="lab-summary">{info.summary}</p>

      <div className="race">
        <div className="race-head">
          <span>T1: withdraw 70</span>
          <span className="race-balance">
            balance <strong>{balance}</strong>
          </span>
          <span>T2: withdraw 50</span>
        </div>
        <ol className="race-steps">
          {outcome.steps.slice(0, shown).map((step, i) => (
            <li key={i} className={`race-step race-${step.tx} race-${step.kind}`}>
              <code>{step.sql}</code>
              <span>{step.result}</span>
            </li>
          ))}
          {!started && <li className="race-empty">Run the race to see the statements interleave.</li>}
        </ol>
      </div>

      <div className="lab-foot">
        <button type="button" className="primary" onClick={() => setShown(1)} disabled={started && !finished}>
          {finished ? 'Run the race again' : 'Run the race'}
        </button>
        {finished && (
          <p className={outcome.consistent ? 'verdict verdict-good' : 'verdict verdict-bad'} role="status">
            {outcome.consistent
              ? `Paid out ${outcome.paidOut}, balance ${outcome.finalBalance}. The books balance and the second withdrawal was refused.`
              : `Paid out ${outcome.paidOut} from an account that held ${OPENING_BALANCE}, and the balance says ${outcome.finalBalance}. T1's write was lost.`}
          </p>
        )}
      </div>
    </div>
  )
}
