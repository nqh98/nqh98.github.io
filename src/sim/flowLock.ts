// One withdrawal is submitted several times and the load balancer spreads the
// copies over several pods. The flow is: read status, call the payment
// provider, save the result. Where the lock lives decides how many copies
// reach the provider.

export type Guard = 'none' | 'local' | 'redis'

export const PODS = ['pod A', 'pod B', 'pod C']
const READ_MS = 10
const PROVIDER_MS = 300
const SAVE_MS = 10

// Same withdrawal, four submissions: [pod index, arrival in ms].
const SUBMISSIONS: [number, number][] = [
  [0, 0],
  [1, 30],
  [0, 60],
  [2, 90],
]

export interface Attempt {
  pod: number
  arrive: number
  /** When it got past the lock and began the flow. */
  start: number
  end: number
  charged: boolean
}

export interface FlowRun {
  attempts: Attempt[]
  charges: number
  duration: number
}

export function runFlow(guard: Guard): FlowRun {
  // A lock is free again at this time. Keyed per pod for an in-process mutex,
  // one shared key for Redis.
  const freeAt = new Map<string, number>()
  const savedAt: number[] = []

  const attempts = SUBMISSIONS.map(([pod, arrive]) => {
    const scope = guard === 'local' ? `pod-${pod}` : 'shared'
    const start = guard === 'none' ? arrive : Math.max(arrive, freeAt.get(scope) ?? 0)
    const readAt = start + READ_MS
    const alreadyDone = savedAt.some((t) => t <= readAt)
    const end = alreadyDone ? readAt : readAt + PROVIDER_MS + SAVE_MS
    if (!alreadyDone) savedAt.push(end)
    freeAt.set(scope, end)
    return { pod, arrive, start, end, charged: !alreadyDone }
  })

  return {
    attempts,
    charges: attempts.filter((a) => a.charged).length,
    duration: Math.max(...attempts.map((a) => a.end)),
  }
}
