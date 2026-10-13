// One consumer reads a partition and hands messages to a thread pool.
// How it picks the thread decides whether a user's events stay in order.

import { hashKey } from './hash'

export type Dispatch = 'single' | 'pool' | 'hash'

export const WORKERS = 4
const USERS = ['A', 'B', 'C', 'D', 'E', 'F']
const ROUNDS = 3
// Processing cost per message in ms, in log order. Uneven on purpose: a slow
// first event followed by fast ones is what exposes reordering.
const COSTS = [240, 90, 60, 180, 120, 60, 60, 150, 90, 60, 210, 90, 60, 60, 120, 90, 60, 150]

export interface Job {
  user: string
  seq: number
  worker: number
  start: number
  end: number
  /** Finished before an earlier event of the same user. */
  outOfOrder: boolean
}

export interface Run {
  jobs: Job[]
  workers: number
  duration: number
  outOfOrder: number
}

export function dispatch(mode: Dispatch): Run {
  const workers = mode === 'single' ? 1 : WORKERS
  const freeAt = Array(workers).fill(0)
  const jobs: Job[] = []

  let i = 0
  for (let seq = 1; seq <= ROUNDS; seq++) {
    for (const user of USERS) {
      const worker =
        mode === 'hash'
          ? hashKey(user) % workers
          : // Any free thread: the one that becomes available first.
            freeAt.indexOf(Math.min(...freeAt))
      const start = freeAt[worker]
      const end = start + COSTS[i++]
      freeAt[worker] = end
      jobs.push({ user, seq, worker, start, end, outOfOrder: false })
    }
  }

  for (const job of jobs) {
    job.outOfOrder = jobs.some((other) => other.user === job.user && other.seq < job.seq && other.end > job.end)
  }

  return {
    jobs,
    workers,
    duration: Math.max(...freeAt),
    outOfOrder: jobs.filter((job) => job.outOfOrder).length,
  }
}
