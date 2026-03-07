/**
 * Migration script: Create settings table in Turso
 * Run with: npx tsx scripts/migrate-settings.ts
 */

import { createClient } from '@libsql/client'
import { config } from 'dotenv'

config({ path: '.env.local' })

const client = createClient({
  url: process.env.TURSO_DB_URL!,
  authToken: process.env.TURSO_DB_TOKEN!,
})

async function migrate() {
  console.log('Creating settings table...')
  await client.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  console.log('Migration complete!')
}

migrate().catch(console.error)
