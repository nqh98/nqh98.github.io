// A small payment pipeline: ledger + outbox written together, a relay that
// publishes to a partitioned log, and idempotent consumers reading at their
// own pace. Deliberately deterministic so the page and the tests agree.

export const PARTITIONS = 3
const ACCOUNTS = 7
const RELAY_RATE = 4
const CONSUMER_RATE = 3

export type ConsumerName = 'notify' | 'report'

export interface Message {
  id: number
  account: number
  duplicate: boolean
}

export interface Consumer {
  running: boolean
  offsets: number[]
  processed: Set<number>
  delivered: number
  dropped: number
}

export type FlowEvent =
  | { type: 'accepted' }
  | { type: 'published'; partition: number }
  | { type: 'consumed'; consumer: ConsumerName; partition: number; duplicate: boolean }

export class Pipeline {
  accepted = 0
  outbox: number[] = []
  partitions: Message[][] = Array.from({ length: PARTITIONS }, () => [])
  consumers: Record<ConsumerName, Consumer> = {
    notify: newConsumer(),
    report: newConsumer(),
  }
  private nextId = 1
  private published: { id: number; account: number; partition: number }[] = []

  /** One DB transaction per payment: the ledger row and its outbox row commit together. */
  send(count = 1): FlowEvent[] {
    const events: FlowEvent[] = []
    for (let i = 0; i < count; i++) {
      this.outbox.push(this.nextId++)
      this.accepted++
      events.push({ type: 'accepted' })
    }
    return events
  }

  /** The relay crashed after publishing but before marking its rows sent, so it publishes them again. */
  redeliver(count: number): number {
    const again = this.published.slice(-count)
    for (const { id, account, partition } of again) {
      this.partitions[partition].push({ id, account, duplicate: true })
    }
    return again.length
  }

  setRunning(name: ConsumerName, running: boolean) {
    this.consumers[name].running = running
  }

  step(): FlowEvent[] {
    const events: FlowEvent[] = []

    for (const id of this.outbox.splice(0, RELAY_RATE)) {
      // The account is the partition key, so one account's payments stay ordered.
      const account = (id * 5) % ACCOUNTS
      const partition = account % PARTITIONS
      this.partitions[partition].push({ id, account, duplicate: false })
      this.published.push({ id, account, partition })
      events.push({ type: 'published', partition })
    }

    for (const name of ['notify', 'report'] as const) {
      const consumer = this.consumers[name]
      if (!consumer.running) continue
      let budget = CONSUMER_RATE
      // Take one message per partition in turn so a busy partition cannot starve the others.
      for (let progressed = true; budget > 0 && progressed; ) {
        progressed = false
        for (let p = 0; p < PARTITIONS && budget > 0; p++) {
          const log = this.partitions[p]
          if (consumer.offsets[p] >= log.length) continue
          const message = log[consumer.offsets[p]++]
          budget--
          progressed = true
          const duplicate = consumer.processed.has(message.id)
          if (duplicate) {
            consumer.dropped++
          } else {
            consumer.processed.add(message.id)
            consumer.delivered++
          }
          events.push({ type: 'consumed', consumer: name, partition: p, duplicate })
        }
      }
    }
    return events
  }

  lag(name: ConsumerName): number {
    const { offsets } = this.consumers[name]
    return this.partitions.reduce((sum, log, p) => sum + log.length - offsets[p], 0)
  }

  /** Accepted payments that are neither delivered nor still on their way. Should always be 0. */
  lost(name: ConsumerName): number {
    const consumer = this.consumers[name]
    const inFlight = new Set<number>(this.outbox)
    this.partitions.forEach((log, p) => {
      for (let i = consumer.offsets[p]; i < log.length; i++) {
        if (!consumer.processed.has(log[i].id)) inFlight.add(log[i].id)
      }
    })
    return this.accepted - consumer.delivered - inFlight.size
  }

  idle(): boolean {
    return (
      this.outbox.length === 0 &&
      (['notify', 'report'] as const).every(
        (name) => !this.consumers[name].running || this.lag(name) === 0,
      )
    )
  }
}

function newConsumer(): Consumer {
  return {
    running: true,
    offsets: Array(PARTITIONS).fill(0),
    processed: new Set(),
    delivered: 0,
    dropped: 0,
  }
}
