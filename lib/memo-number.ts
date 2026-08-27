import 'server-only'
import { sql } from 'drizzle-orm'
import type { Executor } from '@/lib/db'

export async function nextMemoNumber(
  ex: Executor, orgId: string, prefix: string,
): Promise<string> {
  const year = new Date().getUTCFullYear()
  const rows = await ex.execute(sql`
    INSERT INTO memo_counters (org_id, year, seq) VALUES (${orgId}, ${year}, 1)
    ON CONFLICT (org_id, year) DO UPDATE SET seq = memo_counters.seq + 1
    RETURNING seq
  `)
  const seq = Number((rows as unknown as { seq: number }[])[0].seq)
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`
}
