// A 48M-row transactions table, seen as a grid: 4 user shards by 12 months,
// 1M rows in each cell. A layout can only skip data along a dimension it was
// split on; everything else stays in scope, so its tables and indexes are
// what the query runs against.

export type Layout = 'none' | 'user' | 'month' | 'both'
export type Query = 'user' | 'month' | 'userMonth' | 'retention'

export const SHARDS = 4
export const MONTHS = 12
const ROWS_PER_CELL = 1_000_000
const USER_SHARD = 2
const TARGET_MONTH = MONTHS - 1
const OLDEST_MONTH = 0

export interface Plan {
  /** cells[shard][month]: 'hit' holds wanted rows, 'wasted' is in scope but holds nothing wanted, 'skipped' is pruned. */
  cells: ('hit' | 'wasted' | 'skipped')[][]
  searchedRows: number
  /** Rows in the cells that can hold a match. An upper bound on the result, not its size. */
  wantedRows: number
  totalRows: number
  /** How many separate databases the query has to be sent to. */
  databases: number
  /** Retention only: whether old data leaves as a metadata operation or row by row. */
  removal: 'drop' | 'delete' | null
}

export function plan(layout: Layout, query: Query): Plan {
  const splitByUser = layout === 'user' || layout === 'both'
  const splitByMonth = layout === 'month' || layout === 'both'

  const wantsShard = query === 'user' || query === 'userMonth' ? USER_SHARD : null
  const wantsMonth = query === 'month' || query === 'userMonth' ? TARGET_MONTH : query === 'retention' ? OLDEST_MONTH : null

  let searched = 0
  let wanted = 0
  const databases = new Set<number>()

  const cells = Array.from({ length: SHARDS }, (_, shard) =>
    Array.from({ length: MONTHS }, (_, month) => {
      const matches = (wantsShard === null || wantsShard === shard) && (wantsMonth === null || wantsMonth === month)
      const pruned =
        (splitByUser && wantsShard !== null && wantsShard !== shard) ||
        (splitByMonth && wantsMonth !== null && wantsMonth !== month)
      if (matches) wanted++
      if (pruned) return 'skipped' as const
      searched++
      databases.add(splitByUser ? shard : 0)
      return matches ? ('hit' as const) : ('wasted' as const)
    }),
  )

  return {
    cells,
    searchedRows: searched * ROWS_PER_CELL,
    wantedRows: wanted * ROWS_PER_CELL,
    totalRows: SHARDS * MONTHS * ROWS_PER_CELL,
    databases: databases.size,
    removal: query === 'retention' ? (splitByMonth ? 'drop' : 'delete') : null,
  }
}
