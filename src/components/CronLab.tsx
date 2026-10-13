import { useState } from 'react'
import { cron } from '../sim/sharding'

export function CronLab() {
  const [sharded, setSharded] = useState(false)
  const run = cron(sharded)

  return (
    <div className="lab">
      <div className="lab-head">
        <h3>Three bot instances, one scheduled job</h3>
        <p>
          A bot service runs on three instances. At 09:00 each one wakes up to send every user a
          daily summary. Each user should get exactly one.
        </p>
      </div>

      <div className="segmented" role="radiogroup" aria-label="How instances pick users">
        <button type="button" role="radio" aria-checked={!sharded} onClick={() => setSharded(false)}>
          Every instance, every user
        </button>
        <button type="button" role="radio" aria-checked={sharded} onClick={() => setSharded(true)}>
          hash(user) % instances
        </button>
      </div>
      <p className="lab-summary">
        {sharded
          ? 'Each instance only takes the users whose hash maps to it. No lock, no coordination, and the split survives restarts.'
          : 'All three instances run the same query and all three send.'}
      </p>

      <ul className="shards" aria-label="Which instance handled each user">
        {run.users.map((user) => (
          <li key={user.id}>
            <span className="shard-user">{user.id}</span>
            <span className="shard-marks">
              {run.perInstance.map((_, instance) => (
                <span key={instance} className={user.ranBy.includes(instance) ? 'shard-mark shard-on' : 'shard-mark'}>
                  {instance + 1}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>

      <div className="lab-foot">
        <p className={sharded ? 'verdict verdict-good' : 'verdict verdict-bad'} role="status">
          {sharded
            ? `${run.runs} summaries for ${run.users.length} users. Instances handled ${run.perInstance.join(', ')} users each.`
            : `${run.runs} summaries for ${run.users.length} users. Everyone got the message three times.`}
        </p>
      </div>
    </div>
  )
}
