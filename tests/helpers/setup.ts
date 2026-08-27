import { config } from 'dotenv'

config({ path: '.env.local' })

// Every test file talks to the dedicated test database.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
if (!process.env.DATABASE_URL) throw new Error('TEST_DATABASE_URL is not set')
