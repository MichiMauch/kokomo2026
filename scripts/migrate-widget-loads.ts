/**
 * Migration script: Create widget_loads table in Turso
 * Run with: npx tsx scripts/migrate-widget-loads.ts
 */

import { createClient } from '@libsql/client'
import { config } from 'dotenv'

config({ path: '.env.local' })

const client = createClient({
  url: process.env.TURSO_DB_URL!,
  authToken: process.env.TURSO_DB_TOKEN!,
})

async function migrate() {
  console.log('Creating widget_loads table...')
  await client.execute(`
    CREATE TABLE IF NOT EXISTS widget_loads (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      domain     TEXT NOT NULL,
      page_url   TEXT,
      loaded_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  console.log('Creating index on domain...')
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_widget_loads_domain ON widget_loads (domain)
  `)

  console.log('Migration complete!')
}

migrate().catch(console.error)
