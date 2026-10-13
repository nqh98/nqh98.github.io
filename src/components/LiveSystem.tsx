import { useEffect, useRef, useState } from 'react'
import { PARTITIONS, Pipeline, type FlowEvent } from '../sim/pipeline'

const TICK_MS = 260
const AMBIENT_EVERY = 7
const MAX_PACKETS = 70
const WINDOW = 13
const CELL = 13

const LANE_X = 606
const LANE_Y = [96, 166, 236]
const NODE = {
  client: { x: 62, y: 166 },
  gateway: { x: 196, y: 166 },
  payment: { x: 356, y: 166 },
  db: { x: 356, y: 318 },
  relay: { x: 510, y: 318 },
  notify: { x: 892, y: 112 },
  report: { x: 892, y: 222 },
}

interface Packet {
  id: number
  from: { x: number; y: number }
  to: { x: number; y: number }
  delay: number
  tone: 'ink' | 'dup'
}

const laneEnd = (p: number) => ({ x: LANE_X + WINDOW * CELL + 8, y: LANE_Y[p] })

function packetsFor(events: FlowEvent[], nextId: () => number): Packet[] {
  const out: Packet[] = []
  let accepted = 0
  for (const e of events) {
    if (e.type === 'accepted') {
      // A burst would flood the diagram; a handful of dots reads the same.
      if (accepted++ >= 6) continue
      const delay = accepted * 45
      out.push({ id: nextId(), from: NODE.client, to: NODE.gateway, delay, tone: 'ink' })
      out.push({ id: nextId(), from: NODE.gateway, to: NODE.payment, delay: delay + 170, tone: 'ink' })
      out.push({ id: nextId(), from: NODE.payment, to: NODE.db, delay: delay + 340, tone: 'ink' })
    } else if (e.type === 'published') {
      out.push({ id: nextId(), from: NODE.db, to: NODE.relay, delay: 0, tone: 'ink' })
      out.push({ id: nextId(), from: NODE.relay, to: { x: LANE_X - 8, y: LANE_Y[e.partition] }, delay: 150, tone: 'ink' })
    } else {
      out.push({
        id: nextId(),
        from: laneEnd(e.partition),
        to: { x: NODE[e.consumer].x - 62, y: NODE[e.consumer].y },
        delay: 0,
        tone: e.duplicate ? 'dup' : 'ink',
      })
    }
  }
  return out
}

function Box({ at, title, sub, off }: { at: { x: number; y: number }; title: string; sub?: string; off?: boolean }) {
  return (
    <g className={off ? 'node node-off' : 'node'}>
      <rect x={at.x - 62} y={at.y - 27} width={124} height={54} rx={3} />
      <text x={at.x} y={sub ? at.y - 3 : at.y + 5} className="node-title">
        {title}
      </text>
      {sub && (
        <text x={at.x} y={at.y + 15} className="node-sub">
          {sub}
        </text>
      )}
    </g>
  )
}

export function LiveSystem() {
  const sim = useRef<Pipeline>(null as unknown as Pipeline)
  if (!sim.current) sim.current = new Pipeline()
  const p = sim.current

  const [, redraw] = useState(0)
  const [packets, setPackets] = useState<Packet[]>([])
  const [note, setNote] = useState(
    'Payments are trickling in. Every one is written to the ledger and the outbox in a single transaction.',
  )
  const wrap = useRef<HTMLDivElement>(null)
  const packetId = useRef(0)
  const calm = useRef(false)

  const show = (events: FlowEvent[]) => {
    if (!calm.current && events.length) {
      const fresh = packetsFor(events, () => ++packetId.current)
      setPackets((old) => [...old, ...fresh].slice(-MAX_PACKETS))
    }
    redraw((n) => n + 1)
  }

  useEffect(() => {
    calm.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let visible = true
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting))
    if (wrap.current) io.observe(wrap.current)

    let tick = 0
    const timer = window.setInterval(() => {
      if (!visible || document.hidden) return
      tick++
      const events = !calm.current && tick % AMBIENT_EVERY === 0 ? p.send(1) : []
      events.push(...p.step())
      if (events.length) show(events)
    }, TICK_MS)

    return () => {
      window.clearInterval(timer)
      io.disconnect()
    }
  }, [p])

  const notifyOn = p.consumers.notify.running

  const send = (count: number) => {
    show(p.send(count))
    setNote(
      count === 1
        ? 'One payment accepted. The relay will publish its outbox row to Kafka on the next poll.'
        : `${count} payments accepted at once. The API answers immediately; Kafka absorbs the spike and the consumers drain it at their own pace.`,
    )
  }

  const toggleNotify = () => {
    p.setRunning('notify', !notifyOn)
    redraw((n) => n + 1)
    setNote(
      notifyOn
        ? 'Notification service stopped. Payments still succeed, because nothing calls it synchronously. Its lag grows until it comes back.'
        : 'Notification service started. It resumes from its committed offset and works through the backlog.',
    )
  }

  const redeliver = () => {
    const count = p.redeliver(5)
    redraw((n) => n + 1)
    setNote(
      count
        ? `${count} messages delivered a second time. Each consumer recognises the payment ID and drops the copy.`
        : 'Nothing has been published yet. Send a payment first.',
    )
  }

  const dropped = p.consumers.notify.dropped + p.consumers.report.dropped
  const lost = p.lost('notify') + p.lost('report')

  return (
    <div className="system" ref={wrap}>
      <div className="system-controls">
        <button type="button" onClick={() => send(1)}>
          Send a payment
        </button>
        <button type="button" onClick={() => send(40)}>
          Send 40 at once
        </button>
        <button type="button" onClick={toggleNotify} aria-pressed={!notifyOn}>
          {notifyOn ? 'Stop notification service' : 'Start notification service'}
        </button>
        <button type="button" onClick={redeliver}>
          Redeliver last 5 messages
        </button>
      </div>

      <p className="system-note" aria-live="polite">
        {note}
      </p>

      <p className="system-hint">Swipe the diagram sideways to follow a payment to the consumers.</p>
      <div className="system-scroll" tabIndex={0} role="group" aria-label="Payment pipeline diagram">
        <svg viewBox="0 36 960 336" className="system-svg" role="img" aria-label="Payments flow from the API gateway to the payment service, into PostgreSQL, through an outbox relay to a three-partition Kafka topic, and on to the notification and reporting services.">
          <g className="edges">
            <line x1={NODE.client.x + 62} y1={166} x2={NODE.gateway.x - 62} y2={166} />
            <line x1={NODE.gateway.x + 62} y1={166} x2={NODE.payment.x - 62} y2={166} />
            <line x1={356} y1={193} x2={356} y2={291} />
            <line x1={NODE.db.x + 62} y1={318} x2={NODE.relay.x - 62} y2={318} />
            {LANE_Y.map((y) => (
              <line key={y} x1={NODE.relay.x + 30} y1={291} x2={LANE_X - 8} y2={y} />
            ))}
            {LANE_Y.map((y, i) => (
              <g key={y}>
                <line x1={laneEnd(i).x} y1={y} x2={NODE.notify.x - 62} y2={NODE.notify.y} className={notifyOn ? '' : 'edge-off'} />
                <line x1={laneEnd(i).x} y1={y} x2={NODE.report.x - 62} y2={NODE.report.y} />
              </g>
            ))}
          </g>

          <Box at={NODE.client} title="Client" />
          <Box at={NODE.gateway} title="API gateway" />
          <Box at={NODE.payment} title="Payment service" />
          <Box at={NODE.db} title="PostgreSQL" sub="ledger + outbox" />
          <Box at={NODE.relay} title="Outbox relay" sub={`${p.outbox.length} waiting`} />
          <Box at={NODE.notify} title="Notifications" sub={notifyOn ? `lag ${p.lag('notify')}` : `stopped, lag ${p.lag('notify')}`} off={!notifyOn} />
          <Box at={NODE.report} title="Reporting" sub={`lag ${p.lag('report')}`} />

          <text x={LANE_X} y={58} className="lane-heading">
            Kafka topic: payments
          </text>
          {Array.from({ length: PARTITIONS }, (_, part) => {
            const log = p.partitions[part]
            const start = Math.max(0, log.length - WINDOW)
            const behind = Math.min(p.consumers.notify.offsets[part], p.consumers.report.offsets[part])
            return (
              <g key={part}>
                <text x={LANE_X - 14} y={LANE_Y[part] - 14} className="lane-label">
                  partition {part}
                </text>
                <rect x={LANE_X - 3} y={LANE_Y[part] - 9} width={WINDOW * CELL + 5} height={18} className="lane" />
                {log.slice(start).map((message, i) => (
                  <rect
                    key={start + i}
                    x={LANE_X + i * CELL}
                    y={LANE_Y[part] - 6}
                    width={CELL - 3}
                    height={12}
                    className={`cell ${start + i < behind ? 'cell-done' : 'cell-pending'} ${message.duplicate ? 'cell-dup' : ''}`}
                  />
                ))}
              </g>
            )
          })}

          {packets.map((packet) => (
            <circle
              key={packet.id}
              r={4.5}
              className={`packet packet-${packet.tone}`}
              style={
                {
                  '--x0': `${packet.from.x}px`,
                  '--y0': `${packet.from.y}px`,
                  '--x1': `${packet.to.x}px`,
                  '--y1': `${packet.to.y}px`,
                  animationDelay: `${packet.delay}ms`,
                } as React.CSSProperties
              }
              onAnimationEnd={() => setPackets((old) => old.filter((x) => x.id !== packet.id))}
            />
          ))}
        </svg>
      </div>

      <dl className="system-stats">
        <div>
          <dt>Payments accepted</dt>
          <dd>{p.accepted}</dd>
        </div>
        <div>
          <dt>Notifications sent</dt>
          <dd>{p.consumers.notify.delivered}</dd>
        </div>
        <div>
          <dt>Duplicates dropped</dt>
          <dd>{dropped}</dd>
        </div>
        <div className={lost === 0 ? 'stat-good' : 'stat-bad'}>
          <dt>Payments lost</dt>
          <dd>{lost}</dd>
        </div>
      </dl>

      <ul className="system-legend">
        <li>
          <span className="swatch swatch-pending" /> waiting for a consumer
        </li>
        <li>
          <span className="swatch swatch-done" /> processed by both
        </li>
        <li>
          <span className="swatch swatch-dup" /> redelivered copy
        </li>
      </ul>
    </div>
  )
}
