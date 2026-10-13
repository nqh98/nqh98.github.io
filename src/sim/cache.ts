// A hot cache key expires while a crowd of requests arrives. Without a lock
// every miss goes to the database; with one, a single request rebuilds the
// entry and the rest wait for it.

export interface Request {
  id: number
  arrive: number
  done: number
  source: 'db' | 'cache'
}

export interface Stampede {
  requests: Request[]
  dbQueries: number
  duration: number
}

const BASE_QUERY_MS = 350
const CONTENTION_MS = 45
const POLL_MS = 60
const CACHE_READ_MS = 15

export function stampede(count: number, useLock: boolean): Stampede {
  const requests: Request[] = []
  const arrivals = Array.from({ length: count }, (_, i) => Math.round((i * 240) / count))
  let cacheReadyAt = Infinity
  let dbQueries = 0

  if (useLock) {
    cacheReadyAt = arrivals[0] + BASE_QUERY_MS
    dbQueries = 1
    arrivals.forEach((arrive, id) => {
      if (id === 0) {
        requests.push({ id, arrive, done: cacheReadyAt, source: 'db' })
        return
      }
      // Lock is taken: poll until the winner has filled the cache.
      let at = arrive
      while (at < cacheReadyAt) at += POLL_MS
      requests.push({ id, arrive, done: at + CACHE_READ_MS, source: 'cache' })
    })
  } else {
    let running: number[] = []
    arrivals.forEach((arrive, id) => {
      if (arrive >= cacheReadyAt) {
        requests.push({ id, arrive, done: arrive + CACHE_READ_MS, source: 'cache' })
        return
      }
      running = running.filter((end) => end > arrive)
      // Every concurrent identical query makes the next one slower.
      const done = arrive + BASE_QUERY_MS + running.length * CONTENTION_MS
      running.push(done)
      dbQueries++
      cacheReadyAt = Math.min(cacheReadyAt, done)
      requests.push({ id, arrive, done, source: 'db' })
    })
  }

  return { requests, dbQueries, duration: Math.max(...requests.map((r) => r.done)) }
}
