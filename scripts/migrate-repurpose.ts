/**
 * Migration script: Create repurpose_assets table in Turso
 * Run with: npx tsx scripts/migrate-repurpose.ts
 *
 * Speichert pro Post die generierten Distributions-Assets der Repurposing-Engine
 * (social_extra, carousel, video_script, newsletter_blurb) als JSON.
 */

import { createClient } from '@libsql/client'
import { config } from 'dotenv'

config({ path: '.env.local' })

const client = createClient({
  url: process.env.TURSO_DB_URL!,
  authToken: process.env.TURSO_DB_TOKEN!,
})

async function migrate() {
  console.log('Creating repurpose_assets table...')
  await client.execute(`
    CREATE TABLE IF NOT EXISTS repurpose_assets (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      post_slug    TEXT NOT NULL,
      kind         TEXT NOT NULL,
      payload      TEXT NOT NULL,
      generated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(post_slug, kind)
    )
  `)

  console.log('Creating index for repurpose_assets...')
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_repurpose_assets_slug ON repurpose_assets(post_slug)`)

  console.log('✅ Migration complete.')
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
