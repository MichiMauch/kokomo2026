/**
 * Migration script: Create social media tables in Turso
 * Run with: npx tsx scripts/migrate-social.ts
 */

import { createClient } from '@libsql/client'
import { config } from 'dotenv'

config({ path: '.env.local' })

const client = createClient({
  url: process.env.TURSO_DB_URL!,
  authToken: process.env.TURSO_DB_TOKEN!,
})

async function migrate() {
  console.log('Creating social_texts table...')
  await client.execute(`
    CREATE TABLE IF NOT EXISTS social_texts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      post_slug    TEXT NOT NULL,
      platform     TEXT NOT NULL,
      text         TEXT NOT NULL,
      generated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(post_slug, platform)
    )
  `)

  console.log('Creating indexes for social_texts...')
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_social_texts_slug ON social_texts(post_slug)`)
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_social_texts_platform ON social_texts(platform)`)

  console.log('Creating social_shares table...')
  await client.execute(`
    CREATE TABLE IF NOT EXISTS social_shares (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      post_slug    TEXT NOT NULL,
      platform     TEXT NOT NULL,
      external_id  TEXT,
      external_url TEXT,
      shared_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  console.log('Creating indexes for social_shares...')
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_social_shares_slug ON social_shares(post_slug)`)
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_social_shares_platform ON social_shares(platform)`)

  console.log('Migration complete!')
}

migrate().catch(console.error)
