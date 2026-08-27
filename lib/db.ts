import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js/session'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import postgres from 'postgres'
import * as schema from '@/db/schema'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set')

// `prepare: false` is required behind Neon's pooler (PgBouncer transaction mode).
const client = postgres(connectionString, { prepare: false, max: 5 })

export const db = drizzle(client, { schema })

export type Tx = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>

/** Anything that can run a query: the pool, or an open transaction. */
export type Executor = PostgresJsDatabase<typeof schema> | Tx
