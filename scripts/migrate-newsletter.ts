/**
 * Migration script: Create newsletter tables in Turso
 * Run with: npx tsx scripts/migrate-newsletter.ts
 */

import { createClient } from '@libsql/client'
import { config } from 'dotenv'

config({ path: '.env.local' })

const client = createClient({
  url: process.env.TURSO_DB_URL!,
  authToken: process.env.TURSO_DB_TOKEN!,
})

async function migrate() {
  console.log('Creating newsletter_subscribers table...')
  await client.execute(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      email           TEXT    NOT NULL UNIQUE,
      status          TEXT    NOT NULL DEFAULT 'pending',
      token           TEXT    NOT NULL UNIQUE,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      confirmed_at    TEXT,
      unsubscribed_at TEXT
    )
  `)

  console.log('Creating indexes...')
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_subscribers_email ON newsletter_subscribers(email)`)
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_subscribers_status ON newsletter_subscribers(status)`)
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_subscribers_token ON newsletter_subscribers(token)`)

  console.log('Creating newsletter_sends table...')
  await client.execute(`
    CREATE TABLE IF NOT EXISTS newsletter_sends (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      post_slug       TEXT    NOT NULL,
      post_title      TEXT    NOT NULL,
      subject         TEXT    NOT NULL,
      sent_at         TEXT    NOT NULL DEFAULT (datetime('now')),
      recipient_count INTEGER NOT NULL DEFAULT 0,
      status          TEXT    NOT NULL DEFAULT 'sent'
    )
  `)

  console.log('Migration complete!')
}

migrate().catch(console.error)
