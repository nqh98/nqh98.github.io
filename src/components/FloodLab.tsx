import { useMemo, useState } from 'react'
import { COMMAND_MS, flood, type Keying } from '../sim/sharding'
import { usePlayback } from './usePlayback'

const TICKS_PER_MS = 1 / 95

export function FloodLab() {
  const [keying, setKeying] = useState<Keying>('user')
  const run = useMemo(() => flood(keying), [keying])
  const last = run.ticks.length - 1
  const play = usePlayback(last, TICKS_PER_MS)
  const queues = run.ticks[Math.floor(play.now ?? 0)]

  const choose = (next: Keying) => {
    setKeying(next)
    play.reset()
  }

  return (
    <div className="lab lab-wide">
      <div className="lab-head">
        <h3>One bot floods the topic</h3>
        <p>
          A trading bot fires 36 commands in one burst. Eight ordinary users send one command each
          over the next few hundred milliseconds. Every partition handles one command per{' '}
          {COMMAND_MS} ms.
        </p>
      </div>

      <div className="segmented" role="radiogroup" aria-label="Partition key">
        <button type="button" role="radio" aria-checked={keying === 'user'} onClick={() => choose('user')}>
          key = user
        </button>
        <button type="button" role="radio" aria-checked={keying === 'priority'} onClick={() => choose('priority')}>
          key = priority + user
        </button>
      </div>
      <p className="lab-summary">
        {keying === 'user'
          ? 'Hashing the user ID keeps each user ordered, but whoever hashes next to the bot is stuck behind its backlog.'
          : 'Accounts over a rate threshold are tagged bulk and keyed into their own partition. Everyone else still hashes by user, so ordering is unchanged.'}
      </p>

      <div className="flood" aria-hidden="true">
        {run.lanes.map((lane, i) => (
          <div key={i} className={lane.bulk ? 'flood-lane flood-bulk' : 'flood-lane'}>
            <span className="flood-label">{lane.label}</span>
            <span className="flood-queue">
              {play.now !== null &&
                queues[i].map((cmd, j) => <span key={j} className={cmd.bot ? 'flood-cmd flood-bot' : 'flood-cmd'} />)}
            </span>
          </div>
        ))}
      </div>
      <ul className="system-legend">
        <li>
          <span className="swatch swatch-dup" /> bot command
        </li>
        <li>
          <span className="swatch swatch-ink" /> ordinary user’s command
        </li>
      </ul>

      <div className="lab-foot">
        <button type="button" className="primary" onClick={play.start} disabled={play.running}>
          {play.finished ? 'Flood it again' : 'Start the flood'}
        </button>
        {play.finished && (
          <p className={run.delayedUsers ? 'verdict verdict-bad' : 'verdict verdict-good'} role="status">
            {run.delayedUsers
              ? `${run.delayedUsers} of ${run.waits.length} ordinary users shared the bot’s partition and waited up to ${run.worstNormalWaitMs.toLocaleString('en')} ms. They did nothing wrong.`
              : `No ordinary user waited more than ${run.worstNormalWaitMs} ms. The bot’s backlog only delays the bot.`}
          </p>
        )}
      </div>
    </div>
  )
}
