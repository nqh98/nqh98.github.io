import { useEffect, useMemo, useRef, useState } from 'react'
import { stampede } from '../sim/cache'

const REQUESTS = 30
// Slowed down so the eye can follow what takes a few hundred milliseconds.
const SLOW_MOTION = 4

export function CacheLab() {
  const [useLock, setUseLock] = useState(false)
  const [now, setNow] = useState<number | null>(null)
  const run = useMemo(() => stampede(REQUESTS, useLock), [useLock])
  const frame = useRef(0)

  const finished = now !== null && now >= run.duration
  const running = now !== null && !finished

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const start = () => {
    cancelAnimationFrame(frame.current)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setNow(run.duration)
      return
    }
    const began = performance.now()
    const loop = (t: number) => {
      const elapsed = Math.max(0, t - began) / SLOW_MOTION
      setNow(Math.min(elapsed, run.duration))
      if (elapsed < run.duration) frame.current = requestAnimationFrame(loop)
    }
    frame.current = requestAnimationFrame(loop)
  }

  const choose = (lock: boolean) => {
    cancelAnimationFrame(frame.current)
    setUseLock(lock)
    setNow(null)
  }

  const t = now ?? -1
  const inDb = run.requests.filter((r) => r.source === 'db' && r.arrive <= t && r.done > t).length
  const dbSoFar = run.requests.filter((r) => r.source === 'db' && r.arrive <= t).length

  return (
    <div className="lab">
      <div className="lab-head">
        <h3>A hot key expires</h3>
        <p>
          {REQUESTS} requests ask for the same exchange rate in the instant its cache entry runs
          out. This is cache breakdown, also called a cache stampede. What reaches the database
          depends on one lock.
        </p>
      </div>

      <div className="segmented" role="radiogroup" aria-label="Cache rebuild strategy">
        <button type="button" role="radio" aria-checked={!useLock} onClick={() => choose(false)}>
          No lock
        </button>
        <button type="button" role="radio" aria-checked={useLock} onClick={() => choose(true)}>
          Redis distributed lock
        </button>
      </div>
      <p className="lab-summary">
        {useLock
          ? 'The first request takes the lock and rebuilds the entry. Everyone else waits briefly, then reads the cache.'
          : 'Every request sees a miss and runs the same expensive query. Each one slows the others down.'}
      </p>

      <div className="stampede">
        <div className="stampede-dots" aria-hidden="true">
          {run.requests.map((r) => {
            const state =
              t < r.arrive ? 'idle' : t < r.done ? (r.source === 'db' ? 'querying' : 'waiting') : r.source
            return <span key={r.id} className={`dot dot-${state}`} />
          })}
        </div>
        <div className="stampede-meter">
          <div className="meter-label">
            <span>Queries running on the database</span>
            <strong>{inDb}</strong>
          </div>
          <div className="meter-track">
            <div className="meter-fill" style={{ width: `${(inDb / REQUESTS) * 100}%` }} />
          </div>
          <div className="meter-label">
            <span>Total database queries</span>
            <strong>{now === null ? 0 : dbSoFar}</strong>
          </div>
        </div>
      </div>

      <div className="lab-foot">
        <button type="button" className="primary" onClick={start} disabled={running}>
          {finished ? 'Expire the key again' : 'Expire the key'}
        </button>
        {finished && (
          <p className={useLock ? 'verdict verdict-good' : 'verdict verdict-bad'} role="status">
            {useLock
              ? `1 query reached the database. All ${REQUESTS} requests were answered in ${Math.round(run.duration)} ms.`
              : `${run.dbQueries} identical queries hit the database at once. The slowest request took ${Math.round(run.duration)} ms.`}
          </p>
        )}
      </div>
    </div>
  )
}
