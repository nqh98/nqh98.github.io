// Two withdrawals race on one account row. Each strategy runs against a real
// in-memory row, so the outcome shown on the page is computed, not scripted.

export type Strategy = 'naive' | 'optimistic' | 'pessimistic' | 'atomic'

export const OPENING_BALANCE = 100
const T1_AMOUNT = 70
const T2_AMOUNT = 50

export interface Step {
  tx: 'T1' | 'T2'
  sql: string
  result: string
  kind: 'read' | 'write' | 'blocked' | 'rejected'
  balance: number
}

export interface Outcome {
  steps: Step[]
  finalBalance: number
  paidOut: number
  /** Money paid out must equal money that left the account. */
  consistent: boolean
}

export const STRATEGIES: { id: Strategy; label: string; summary: string }[] = [
  {
    id: 'naive',
    label: 'Read, then write',
    summary: 'Both transactions read the balance, decide in application code, then write.',
  },
  {
    id: 'optimistic',
    label: 'Optimistic lock',
    summary: 'Each write checks a version column. A stale writer updates zero rows and retries.',
  },
  {
    id: 'pessimistic',
    label: 'Pessimistic lock',
    summary: 'SELECT … FOR UPDATE holds the row. The second transaction waits for the first.',
  },
  {
    id: 'atomic',
    label: 'Atomic conditional update',
    summary: 'One statement checks and subtracts. The database serialises the two writes.',
  },
]

export function race(strategy: Strategy): Outcome {
  const row = { balance: OPENING_BALANCE, version: 1 }
  const steps: Step[] = []
  let paidOut = 0
  const push = (tx: Step['tx'], kind: Step['kind'], sql: string, result: string) =>
    steps.push({ tx, kind, sql, result, balance: row.balance })

  if (strategy === 'naive') {
    const seen1 = row.balance
    push('T1', 'read', 'SELECT balance FROM account WHERE id = 7', `balance = ${seen1}`)
    const seen2 = row.balance
    push('T2', 'read', 'SELECT balance FROM account WHERE id = 7', `balance = ${seen2}`)
    if (seen1 >= T1_AMOUNT) {
      row.balance = seen1 - T1_AMOUNT
      paidOut += T1_AMOUNT
      push('T1', 'write', `UPDATE account SET balance = ${row.balance} WHERE id = 7`, `paid out ${T1_AMOUNT}`)
    }
    if (seen2 >= T2_AMOUNT) {
      row.balance = seen2 - T2_AMOUNT
      paidOut += T2_AMOUNT
      push(
        'T2',
        'write',
        `UPDATE account SET balance = ${row.balance} WHERE id = 7`,
        `paid out ${T2_AMOUNT}, overwriting T1`,
      )
    }
  }

  if (strategy === 'optimistic') {
    const read = (tx: Step['tx']) => {
      const seen = { ...row }
      push(tx, 'read', 'SELECT balance, version FROM account WHERE id = 7', `balance = ${seen.balance}, version = ${seen.version}`)
      return seen
    }
    const write = (tx: Step['tx'], seen: typeof row, amount: number) => {
      const sql = `UPDATE account SET balance = ${seen.balance - amount}, version = ${seen.version + 1} WHERE id = 7 AND version = ${seen.version}`
      if (row.version !== seen.version) {
        push(tx, 'rejected', sql, '0 rows updated, version moved on')
        return false
      }
      row.balance = seen.balance - amount
      row.version++
      paidOut += amount
      push(tx, 'write', sql, `1 row updated, paid out ${amount}`)
      return true
    }
    const seen1 = read('T1')
    let seen2 = read('T2')
    write('T1', seen1, T1_AMOUNT)
    if (!write('T2', seen2, T2_AMOUNT)) {
      seen2 = read('T2')
      if (seen2.balance >= T2_AMOUNT) write('T2', seen2, T2_AMOUNT)
      else push('T2', 'rejected', 'ROLLBACK', `insufficient funds: ${seen2.balance} < ${T2_AMOUNT}`)
    }
  }

  if (strategy === 'pessimistic') {
    const lock = 'SELECT balance FROM account WHERE id = 7 FOR UPDATE'
    const seen1 = row.balance
    push('T1', 'read', lock, `balance = ${seen1}, row locked`)
    push('T2', 'blocked', lock, 'waiting for T1 to release the row')
    row.balance = seen1 - T1_AMOUNT
    paidOut += T1_AMOUNT
    push('T1', 'write', `UPDATE account SET balance = ${row.balance} WHERE id = 7; COMMIT`, `paid out ${T1_AMOUNT}, lock released`)
    const seen2 = row.balance
    push('T2', 'read', lock, `balance = ${seen2}, row locked`)
    if (seen2 >= T2_AMOUNT) {
      row.balance = seen2 - T2_AMOUNT
      paidOut += T2_AMOUNT
      push('T2', 'write', `UPDATE account SET balance = ${row.balance} WHERE id = 7; COMMIT`, `paid out ${T2_AMOUNT}`)
    } else {
      push('T2', 'rejected', 'ROLLBACK', `insufficient funds: ${seen2} < ${T2_AMOUNT}`)
    }
  }

  if (strategy === 'atomic') {
    for (const [tx, amount] of [['T1', T1_AMOUNT], ['T2', T2_AMOUNT]] as const) {
      const sql = `UPDATE account SET balance = balance - ${amount} WHERE id = 7 AND balance >= ${amount}`
      if (row.balance >= amount) {
        row.balance -= amount
        paidOut += amount
        push(tx, 'write', sql, `1 row updated, paid out ${amount}`)
      } else {
        push(tx, 'rejected', sql, '0 rows updated, insufficient funds')
      }
    }
  }

  return {
    steps,
    finalBalance: row.balance,
    paidOut,
    consistent: OPENING_BALANCE - paidOut === row.balance,
  }
}
