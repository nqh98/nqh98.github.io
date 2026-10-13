import { useEffect, useRef, useState } from 'react'

/** Plays a value from 0 to `end` at `speed` units per millisecond. null means not started. */
export function usePlayback(end: number, speed: number) {
  const [now, setNow] = useState<number | null>(null)
  const frame = useRef(0)

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const start = () => {
    cancelAnimationFrame(frame.current)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setNow(end)
      return
    }
    const began = performance.now()
    const loop = (t: number) => {
      // The first frame timestamp can predate `began`.
      const value = Math.max(0, t - began) * speed
      setNow(Math.min(value, end))
      if (value < end) frame.current = requestAnimationFrame(loop)
    }
    frame.current = requestAnimationFrame(loop)
  }

  const reset = () => {
    cancelAnimationFrame(frame.current)
    setNow(null)
  }

  return { now, start, reset, finished: now !== null && now >= end, running: now !== null && now < end }
}
