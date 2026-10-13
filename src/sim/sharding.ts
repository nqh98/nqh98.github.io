// Two uses of the same hash: giving each user to exactly one cron instance,
// and keeping a flooding account away from everyone else's queue.

import { hashKey } from './hash'

// ---------- cron instances ----------

export interface CronRun {
  users: { id: string; ranBy: number[] }[]
  perInstance: number[]
  runs: number
}

export function cron(sharded: boolean, instances = 3, userCount = 12): CronRun {
  const perInstance = Array(instances).fill(0)
  const users = Array.from({ length: userCount }, (_, i) => {
    const id = `user-${i + 1}`
    const ranBy: number[] = []
    for (let instance = 0; instance < instances; instance++) {
      if (!sharded || hashKey(id) % instances === instance) {
        ranBy.push(instance)
        perInstance[instance]++
      }
    }
    return { id, ranBy }
  })
  return { users, perInstance, runs: perInstance.reduce((a, b) => a + b, 0) }
}

// ---------- noisy neighbour ----------

export type Keying = 'user' | 'priority'

export const LANES = 4
export const COMMAND_MS = 50
const BOT = 'bot-42'
const BOT_COMMANDS = 36
const NORMAL_USERS = 8

export interface Queued {
  user: string
  bot: boolean
}

export interface Flood {
  lanes: { label: string; bulk: boolean }[]
  /** Queue contents per lane at each tick. */
  ticks: Queued[][][]
  waits: { user: string; lane: number; waitMs: number }[]
  worstNormalWaitMs: number
  delayedUsers: number
}

function laneFor(user: string, bot: boolean, keying: Keying): number {
  if (keying === 'user') return hashKey(user) % LANES
  // Key = priority + user. Accounts over the rate threshold are tagged bulk
  // and get the last lane; everyone else hashes across the rest.
  return bot ? LANES - 1 : hashKey(user) % (LANES - 1)
}

export function flood(keying: Keying): Flood {
  const arrivals: { user: string; bot: boolean; at: number }[] = []
  for (let i = 0; i < BOT_COMMANDS; i++) arrivals.push({ user: BOT, bot: true, at: 0 })
  for (let i = 1; i <= NORMAL_USERS; i++) arrivals.push({ user: `user-${i}`, bot: false, at: i })

  const queues: (Queued & { at: number })[][] = Array.from({ length: LANES }, () => [])
  const ticks: Queued[][][] = []
  const waits: Flood['waits'] = []

  for (let tick = 0; ; tick++) {
    for (const a of arrivals) {
      if (a.at === tick) queues[laneFor(a.user, a.bot, keying)].push(a)
    }
    ticks.push(queues.map((q) => q.map(({ user, bot }) => ({ user, bot }))))
    // Each lane has one consumer that handles one command per tick.
    queues.forEach((queue, lane) => {
      const next = queue.shift()
      if (next && !next.bot) waits.push({ user: next.user, lane, waitMs: (tick - next.at) * COMMAND_MS })
    })
    if (tick > NORMAL_USERS && queues.every((q) => q.length === 0)) break
  }
  ticks.push(queues.map(() => []))

  return {
    lanes: Array.from({ length: LANES }, (_, lane) => {
      const bulk = keying === 'priority' && lane === LANES - 1
      return { label: bulk ? 'bulk' : `partition ${lane}`, bulk }
    }),
    ticks,
    waits,
    worstNormalWaitMs: Math.max(...waits.map((w) => w.waitMs)),
    delayedUsers: waits.filter((w) => w.waitMs > 2 * COMMAND_MS).length,
  }
}
