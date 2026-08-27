import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// Next.js convention: local overrides live in .env.local, not .env.
config({ path: '.env.local' })

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL },
})
