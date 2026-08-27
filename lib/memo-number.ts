import { sql } from 'drizzle-orm'
import type { Executor } from '@/lib/db'
import { memoCounters } from '@/db/schema'

export async function nextMemoNumber(
  ex: Executor, orgId: string, prefix: string,
): Promise<string> {
  const year = new Date().getUTCFullYear()
  const [row] = await ex.insert(memoCounters)
    .values({ orgId, year, seq: 1 })
    .onConflictDoUpdate({
      target: [memoCounters.orgId, memoCounters.year],
      set: { seq: sql`${memoCounters.seq} + 1` },
    })
    .returning({ seq: memoCounters.seq })
  return `${prefix}-${year}-${String(row.seq).padStart(4, '0')}`
}
