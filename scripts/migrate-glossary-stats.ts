/**
 * Migration script: Create glossary_stats table in Turso
 * Run with: npx tsx scripts/migrate-glossary-stats.ts
 */

import { createClient } from '@libsql/client'
import { config } from 'dotenv'

config({ path: '.env.local' })

const client = createClient({
  url: process.env.TURSO_DB_URL!,
  authToken: process.env.TURSO_DB_TOKEN!,
})

async function migrate() {
  console.log('Creating glossary_stats table...')
  await client.execute(`
    CREATE TABLE IF NOT EXISTS glossary_stats (
      term       TEXT PRIMARY KEY,
      clicks     INTEGER NOT NULL DEFAULT 0,
      searches   INTEGER NOT NULL DEFAULT 0,
      boost      INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  console.log('Migration complete!')
}

migrate().catch(console.error)
