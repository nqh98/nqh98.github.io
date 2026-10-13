import { describe, expect, it } from 'vitest'
import { Pipeline } from './pipeline'
import { OPENING_BALANCE, race } from './lostUpdate'
import { stampede } from './cache'
import { dispatch } from './ordering'
import { runFlow } from './flowLock'
import { plan } from './partitioning'
import { cron, flood } from './sharding'

function drain(p: Pipeline) {
  for (let i = 0; i < 1000 && !p.idle(); i++) p.step()
}

describe('pipeline', () => {
  it('delivers every payment exactly once to each consumer', () => {
    const p = new Pipeline()
    p.send(40)
    drain(p)
    expect(p.consumers.notify.delivered).toBe(40)
    expect(p.consumers.report.delivered).toBe(40)
    expect(p.lost('notify')).toBe(0)
  })

  it('keeps every payment of one account in one partition', () => {
    const p = new Pipeline()
    p.send(60)
    drain(p)
    const home = new Map<number, number>()
    p.partitions.forEach((log, partition) => {
      for (const message of log) {
        expect(home.get(message.account) ?? partition).toBe(partition)
        home.set(message.account, partition)
      }
    })
    expect(new Set(home.values()).size).toBe(3)
  })

  it('drops redelivered messages instead of processing them twice', () => {
    const p = new Pipeline()
    p.send(10)
    drain(p)
    expect(p.redeliver(5)).toBe(5)
    drain(p)
    expect(p.consumers.notify.delivered).toBe(10)
    expect(p.consumers.notify.dropped).toBe(5)
    expect(p.lost('notify')).toBe(0)
  })

  it('keeps messages for a stopped consumer and catches up on restart', () => {
    const p = new Pipeline()
    p.setRunning('notify', false)
    p.send(25)
    drain(p)
    expect(p.lag('notify')).toBe(25)
    expect(p.consumers.report.delivered).toBe(25)
    expect(p.lost('notify')).toBe(0)

    p.redeliver(5)
    p.setRunning('notify', true)
    drain(p)
    expect(p.lag('notify')).toBe(0)
    expect(p.consumers.notify.delivered).toBe(25)
    expect(p.consumers.notify.dropped).toBe(5)
    expect(p.lost('notify')).toBe(0)
  })
})

describe('lost update', () => {
  it('loses money when both transactions read before writing', () => {
    const outcome = race('naive')
    expect(outcome.paidOut).toBe(120)
    expect(outcome.finalBalance).toBe(50)
    expect(outcome.consistent).toBe(false)
  })

  it.each(['optimistic', 'pessimistic', 'atomic'] as const)('%s keeps the account consistent', (s) => {
    const outcome = race(s)
    expect(outcome.paidOut).toBe(70)
    expect(outcome.finalBalance).toBe(OPENING_BALANCE - 70)
    expect(outcome.consistent).toBe(true)
    expect(outcome.steps.at(-1)?.kind).toBe('rejected')
  })
})

describe('cache stampede', () => {
  it('sends every request to the database without a lock', () => {
    expect(stampede(30, false).dbQueries).toBe(30)
  })

  it('lets one request rebuild the entry with a lock', () => {
    const run = stampede(30, true)
    expect(run.dbQueries).toBe(1)
    expect(run.requests.filter((r) => r.source === 'cache')).toHaveLength(29)
    expect(run.duration).toBeLessThan(stampede(30, false).duration)
  })
})

describe('ordered parallel consumer', () => {
  it('reorders a user\'s events when any free thread takes the message', () => {
    expect(dispatch('pool').outOfOrder).toBeGreaterThan(0)
  })

  it('keeps per-user order and still beats one thread when hashing the key to a worker', () => {
    const hashed = dispatch('hash')
    expect(hashed.outOfOrder).toBe(0)
    expect(new Set(hashed.jobs.map((j) => j.worker)).size).toBeGreaterThan(1)
    expect(hashed.duration).toBeLessThan(dispatch('single').duration)
    for (const job of hashed.jobs) {
      expect(hashed.jobs.filter((j) => j.user === job.user).every((j) => j.worker === job.worker)).toBe(true)
    }
  })
})

describe('cron sharding', () => {
  it('runs every job on every instance without sharding', () => {
    expect(cron(false).runs).toBe(36)
  })

  it('gives each user to exactly one instance when hashed', () => {
    const run = cron(true)
    expect(run.runs).toBe(12)
    expect(run.users.every((u) => u.ranBy.length === 1)).toBe(true)
  })
})

describe('noisy neighbour', () => {
  it('makes normal users wait behind the bot when keyed by user', () => {
    const run = flood('user')
    expect(run.delayedUsers).toBeGreaterThan(0)
    expect(run.worstNormalWaitMs).toBeGreaterThan(1000)
  })

  it('isolates the bot when the key includes priority', () => {
    const run = flood('priority')
    expect(run.delayedUsers).toBe(0)
    expect(run.waits).toHaveLength(8)
  })
})

describe('flow lock across pods', () => {
  it('charges once per submission without a lock', () => {
    expect(runFlow('none').charges).toBe(4)
  })

  it('still charges once per pod with an in-process lock', () => {
    expect(runFlow('local').charges).toBe(3)
  })

  it('charges exactly once with a lock shared by every pod', () => {
    const run = runFlow('redis')
    expect(run.charges).toBe(1)
    expect(run.attempts.filter((a) => a.start > a.arrive)).toHaveLength(3)
  })
})

describe('partitioning and sharding', () => {
  it('searches everything in a single table', () => {
    expect(plan('none', 'user').searchedRows).toBe(48_000_000)
  })

  it('sends a user query to one shard but a date query to all of them', () => {
    expect(plan('user', 'user')).toMatchObject({ searchedRows: 12_000_000, databases: 1 })
    expect(plan('user', 'month')).toMatchObject({ searchedRows: 48_000_000, databases: 4 })
  })

  it('prunes a date query to one partition but not a user query', () => {
    expect(plan('month', 'month').searchedRows).toBe(4_000_000)
    expect(plan('month', 'user').searchedRows).toBe(48_000_000)
  })

  it('touches only the wanted rows when split both ways', () => {
    for (const query of ['user', 'month', 'userMonth', 'retention'] as const) {
      const result = plan('both', query)
      expect(result.searchedRows).toBe(result.wantedRows)
    }
    expect(plan('both', 'userMonth').searchedRows).toBe(1_000_000)
  })

  it('drops a partition for retention only when split by month', () => {
    expect(plan('month', 'retention').removal).toBe('drop')
    expect(plan('both', 'retention').removal).toBe('drop')
    expect(plan('user', 'retention').removal).toBe('delete')
    expect(plan('none', 'retention').removal).toBe('delete')
  })
})
