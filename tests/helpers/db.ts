import { execSync } from 'node:child_process'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

let migrated = false

/** Applies migrations once per test run, then truncates every table. */
export async function resetDb() {
  if (!migrated) {
    execSync('npx drizzle-kit migrate', {
      env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL! },
      stdio: 'ignore',
    })
    migrated = true
  }
  await db.execute(sql`
    DO $$
    DECLARE t text;
    BEGIN
      FOR t IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '__drizzle_migrations'
      LOOP
        EXECUTE format('TRUNCATE TABLE %I CASCADE', t);
      END LOOP;
    END $$;
  `)
}
