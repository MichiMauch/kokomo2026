/**
 * Migration script: Add newsletter tracking tables to Turso
 * Run with: npx tsx scripts/migrate-newsletter-tracking.ts
 */

import { createClient } from '@libsql/client'
import { config } from 'dotenv'

config({ path: '.env.local' })

const client = createClient({
  url: process.env.TURSO_DB_URL!,
  authToken: process.env.TURSO_DB_TOKEN!,
})

async function migrate() {
  console.log('Creating newsletter_recipients table...')
  await client.execute(`
    CREATE TABLE IF NOT EXISTS newsletter_recipients (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      send_id         INTEGER NOT NULL,
      email           TEXT NOT NULL,
      resend_email_id TEXT UNIQUE,
      status          TEXT NOT NULL DEFAULT 'sent',
      delivered_at    TEXT,
      opened_at       TEXT,
      open_count      INTEGER NOT NULL DEFAULT 0,
      clicked_at      TEXT,
      click_count     INTEGER NOT NULL DEFAULT 0,
      bounced_at      TEXT,
      bounce_type     TEXT,
      complained_at   TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  console.log('Creating newsletter_recipients indexes...')
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_nr_send_id ON newsletter_recipients(send_id)`)
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_nr_resend_id ON newsletter_recipients(resend_email_id)`)

  console.log('Creating newsletter_link_clicks table...')
  await client.execute(`
    CREATE TABLE IF NOT EXISTS newsletter_link_clicks (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      send_id      INTEGER NOT NULL,
      recipient_id INTEGER,
      url          TEXT NOT NULL,
      clicked_at   TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  console.log('Creating newsletter_link_clicks indexes...')
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_nlc_send_id ON newsletter_link_clicks(send_id)`)

  console.log('Adding aggregate columns to newsletter_sends...')
  const alterStatements = [
    'ALTER TABLE newsletter_sends ADD COLUMN delivered_count INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE newsletter_sends ADD COLUMN opened_count INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE newsletter_sends ADD COLUMN clicked_count INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE newsletter_sends ADD COLUMN bounced_count INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE newsletter_sends ADD COLUMN complained_count INTEGER NOT NULL DEFAULT 0',
  ]

  for (const sql of alterStatements) {
    try {
      await client.execute(sql)
    } catch (err: any) {
      // Column already exists — skip
      if (err.message?.includes('duplicate column')) {
        console.log(`  Skipped (already exists): ${sql.split('ADD COLUMN ')[1]?.split(' ')[0]}`)
      } else {
        throw err
      }
    }
  }

  console.log('Migration complete!')
}

migrate().catch(console.error)
