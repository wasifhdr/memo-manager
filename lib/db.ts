import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js/session'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import postgres from 'postgres'
import * as schema from '@/db/schema'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set')

// `prepare: false` is required behind Neon's pooler (PgBouncer transaction mode).
// `onnotice` is a no-op so routine NOTICE-level chatter (e.g. TRUNCATE CASCADE
// during seeding/tests) doesn't spam stdout — it's never actionable.
const client = postgres(connectionString, { prepare: false, max: 5, onnotice: () => {} })

export const db = drizzle(client, { schema })

export type Tx = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>

/** Anything that can run a query: the pool, or an open transaction. */
export type Executor = PostgresJsDatabase<typeof schema> | Tx
