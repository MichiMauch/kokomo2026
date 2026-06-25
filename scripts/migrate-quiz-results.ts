/**
 * Migration script: Create quiz_results table in Turso
 * Speichert anonyme Ergebnisse des Tiny-House-Readiness-Quiz.
 * Run with: npx tsx scripts/migrate-quiz-results.ts
 */

import { createClient } from '@libsql/client'
import { config } from 'dotenv'

config({ path: '.env.local' })

const client = createClient({
  url: process.env.TURSO_DB_URL!,
  authToken: process.env.TURSO_DB_TOKEN!,
})

async function migrate() {
  console.log('Creating quiz_results table...')
  await client.execute(`
    CREATE TABLE IF NOT EXISTS quiz_results (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      overall       INTEGER NOT NULL,
      verdict       TEXT NOT NULL,
      minimalismus  INTEGER NOT NULL,
      platz         INTEGER NOT NULL,
      handwerk      INTEGER NOT NULL,
      stellplatz    INTEGER NOT NULL,
      finanzen      INTEGER NOT NULL,
      autarkie      INTEGER NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  console.log('Creating index on created_at...')
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_quiz_results_created_at ON quiz_results (created_at)
  `)

  console.log('Migration complete!')
}

migrate().catch(console.error)
