import { useState } from 'react'
import { plan, type Layout, type Query } from '../sim/partitioning'

const LAYOUTS: { id: Layout; label: string; summary: string }[] = [
  {
    id: 'none',
    label: 'One table',
    summary: 'Everything in one table on one database. Simple until the indexes stop fitting in memory.',
  },
  {
    id: 'user',
    label: 'Shard by user ID',
    summary:
      'shard = hash(user_id) % 4, each shard on its own database. Fits wallets, orders and anything else where nearly every query starts from one user.',
  },
  {
    id: 'month',
    label: 'Partition by month',
    summary:
      'PARTITION BY RANGE (created_at) inside one database. Fits transaction logs, audit trails and notification history: queries ask for a time window, and old data leaves by dropping a partition.',
  },
  {
    id: 'both',
    label: 'Both',
    summary: 'Shard by user, and partition each shard by month. Most to operate, and the only layout that can skip along both dimensions.',
  },
]

const QUERIES: { id: Query; label: string; sql: string }[] = [
  { id: 'user', label: 'One user’s history', sql: 'WHERE user_id = 42' },
  { id: 'month', label: 'Everything in October', sql: "WHERE created_at >= '2026-10-01' AND created_at < '2026-11-01'" },
  { id: 'userMonth', label: 'One user in October', sql: "WHERE user_id = 42 AND created_at >= '2026-10-01' AND created_at < '2026-11-01'" },
  { id: 'retention', label: 'Remove the oldest month', sql: "data older than '2025-12-01' must go" },
]

const millions = (rows: number) => `${rows / 1_000_000}M`

export function PartitionLab() {
  const [layout, setLayout] = useState<Layout>('none')
  const [query, setQuery] = useState<Query>('user')
  const result = plan(layout, query)
  const info = LAYOUTS.find((l) => l.id === layout)!
  const asked = QUERIES.find((q) => q.id === query)!
  const exact = result.searchedRows === result.wantedRows

  const verdict =
    result.removal === 'drop'
      ? `DROP PARTITION on ${result.databases === 1 ? 'one database' : `${result.databases} shards`}. ${millions(result.wantedRows)} rows leave as a metadata change, with no row-by-row delete.`
      : result.removal === 'delete'
        ? `DELETE has to find and remove ${millions(result.wantedRows)} rows one by one inside ${millions(result.searchedRows)}, on ${result.databases === 1 ? 'one database' : `all ${result.databases} shards`}, leaving bloat behind.`
        : `Runs against tables and indexes holding ${millions(result.searchedRows)} of ${millions(result.totalRows)} rows, on ${result.databases === 1 ? 'one database' : `${result.databases} shards at once`} to return ${millions(result.wantedRows)}.`

  return (
    <div className="lab">
      <div className="lab-head">
        <h3>A table that outgrew one database</h3>
        <p>
          48 million transactions: four groups of users across the last twelve months. How the table is split
          decides how much data, and how big an index, each query runs against. Pick a layout, then ask it something.
        </p>
      </div>

      <div className="segmented" role="radiogroup" aria-label="Table layout">
        {LAYOUTS.map((l) => (
          <button key={l.id} type="button" role="radio" aria-checked={layout === l.id} onClick={() => setLayout(l.id)}>
            {l.label}
          </button>
        ))}
      </div>
      <p className="lab-summary lab-summary-tall">{info.summary}</p>

      <div className="segmented" role="radiogroup" aria-label="Query">
        {QUERIES.map((q) => (
          <button key={q.id} type="button" role="radio" aria-checked={query === q.id} onClick={() => setQuery(q.id)}>
            {q.label}
          </button>
        ))}
      </div>
      <p className="lab-sql">
        <code>{asked.sql}</code>
      </p>

      <div className={`parts parts-${layout}`} aria-hidden="true">
        {result.cells.map((row, shard) => (
          <div key={shard} className="parts-row">
            {row.map((state, month) => (
              <span key={month} className={`part part-${state}`} />
            ))}
          </div>
        ))}
      </div>
      <ul className="system-legend">
        <li>rows: user groups, columns: months</li>
        <li>
          <span className="swatch swatch-ink" /> holds wanted rows
        </li>
        <li>
          <span className="swatch swatch-pending" /> in scope, not needed
        </li>
        <li>
          <span className="swatch swatch-empty" /> skipped
        </li>
      </ul>

      <div className="lab-foot">
        <p className={exact || result.removal === 'drop' ? 'verdict verdict-good' : 'verdict verdict-bad'} role="status">
          {verdict}
        </p>
      </div>
    </div>
  )
}
