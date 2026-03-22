/**
 * Migration script: Add email automation tables to Turso
 * Run with: npx tsx scripts/migrate-automations.ts
 */

import { createClient } from '@libsql/client'
import { config } from 'dotenv'

config({ path: '.env.local' })

const client = createClient({
  url: process.env.TURSO_DB_URL!,
  authToken: process.env.TURSO_DB_TOKEN!,
})

async function migrate() {
  console.log('Creating email_automations table...')
  await client.execute(`
    CREATE TABLE IF NOT EXISTS email_automations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      trigger_type TEXT NOT NULL DEFAULT 'subscriber_confirmed',
      active      INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  console.log('Creating email_automation_steps table...')
  await client.execute(`
    CREATE TABLE IF NOT EXISTS email_automation_steps (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      automation_id  INTEGER NOT NULL REFERENCES email_automations(id) ON DELETE CASCADE,
      step_order     INTEGER NOT NULL DEFAULT 0,
      delay_hours    INTEGER NOT NULL DEFAULT 0,
      subject        TEXT NOT NULL DEFAULT '',
      blocks_json    TEXT NOT NULL DEFAULT '[]',
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  console.log('Creating email_automation_enrollments table...')
  await client.execute(`
    CREATE TABLE IF NOT EXISTS email_automation_enrollments (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      automation_id    INTEGER NOT NULL REFERENCES email_automations(id) ON DELETE CASCADE,
      subscriber_email TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'active',
      enrolled_at      TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at     TEXT,
      cancelled_at     TEXT,
      UNIQUE(automation_id, subscriber_email)
    )
  `)

  console.log('Creating email_automation_sends table...')
  await client.execute(`
    CREATE TABLE IF NOT EXISTS email_automation_sends (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      enrollment_id   INTEGER NOT NULL REFERENCES email_automation_enrollments(id) ON DELETE CASCADE,
      step_id         INTEGER NOT NULL REFERENCES email_automation_steps(id) ON DELETE CASCADE,
      resend_email_id TEXT,
      status          TEXT NOT NULL DEFAULT 'sent',
      sent_at         TEXT NOT NULL DEFAULT (datetime('now')),
      delivered_at    TEXT,
      opened_at       TEXT,
      open_count      INTEGER NOT NULL DEFAULT 0,
      clicked_at      TEXT,
      click_count     INTEGER NOT NULL DEFAULT 0,
      bounced_at      TEXT,
      bounce_type     TEXT,
      complained_at   TEXT
    )
  `)

  console.log('Creating indexes...')
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_eas_automation ON email_automation_steps(automation_id)`)
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_eae_automation ON email_automation_enrollments(automation_id)`)
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_eae_email ON email_automation_enrollments(subscriber_email)`)
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_eae_status ON email_automation_enrollments(status)`)
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_eaS_enrollment ON email_automation_sends(enrollment_id)`)
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_eaS_resend ON email_automation_sends(resend_email_id)`)

  console.log('Migration complete!')
}

migrate().catch(console.error)
