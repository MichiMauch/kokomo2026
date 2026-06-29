/**
 * Turso database client for the comment system
 * Stores and retrieves blog post comments
 */

import { createClient, type Client } from '@libsql/client'

let client: Client | null = null

// Turso-Calls hart begrenzen: bei einem Ausfall (HTTP 503) retryt der libsql-
// Client sonst ~35s, bevor er aufgibt — das blockiert die ganze Admin-UI.
// Lieber schnell scheitern; die Endpoints fangen den Fehler ab und degradieren.
const TURSO_TIMEOUT_MS = 6000

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Turso timeout nach ${ms}ms`)), ms),
    ),
  ])
}

export function getClient(): Client {
  if (client) return client

  const url = import.meta.env.TURSO_DB_URL
  const authToken = import.meta.env.TURSO_DB_TOKEN

  if (!url || !authToken) {
    throw new Error('TURSO_DB_URL and TURSO_DB_TOKEN must be set')
  }

  const raw = createClient({ url, authToken })
  // Jeden execute-Call mit einem Timeout umhüllen → max. 6s statt 35s Hänger.
  const origExecute = raw.execute.bind(raw)
  raw.execute = ((stmt: Parameters<Client['execute']>[0]) =>
    withTimeout(origExecute(stmt as any), TURSO_TIMEOUT_MS)) as Client['execute']
  client = raw
  return client
}

export interface Comment {
  id: number
  post_slug: string
  parent_id: number | null
  author_name: string
  content: string
  created_at: string
}

export interface AdminComment extends Comment {
  author_email: string
  approved: number
  imported_from: string | null
}

export async function getCommentsBySlug(slug: string): Promise<Comment[]> {
  const db = getClient()

  const result = await db.execute({
    sql: `SELECT id, post_slug, parent_id, author_name, content, created_at
          FROM comments
          WHERE post_slug = ? AND approved = 1
          ORDER BY created_at ASC`,
    args: [slug],
  })

  return result.rows.map((row) => ({
    id: row.id as number,
    post_slug: row.post_slug as string,
    parent_id: row.parent_id as number | null,
    author_name: row.author_name as string,
    content: row.content as string,
    created_at: row.created_at as string,
  }))
}

export async function createComment(data: {
  post_slug: string
  parent_id: number | null
  author_name: string
  author_email: string
  content: string
}): Promise<number> {
  const db = getClient()

  const result = await db.execute({
    sql: `INSERT INTO comments (post_slug, parent_id, author_name, author_email, content, approved)
          VALUES (?, ?, ?, ?, ?, 0)`,
    args: [data.post_slug, data.parent_id, data.author_name, data.author_email, data.content],
  })

  return Number(result.lastInsertRowid)
}

export async function getAllComments(): Promise<AdminComment[]> {
  const db = getClient()

  const result = await db.execute(
    `SELECT id, post_slug, parent_id, author_name, author_email, content, approved, imported_from, created_at
     FROM comments
     ORDER BY created_at DESC`,
  )

  return result.rows.map((row) => ({
    id: row.id as number,
    post_slug: row.post_slug as string,
    parent_id: row.parent_id as number | null,
    author_name: row.author_name as string,
    author_email: (row.author_email as string) || '',
    content: row.content as string,
    approved: row.approved as number,
    imported_from: row.imported_from as string | null,
    created_at: row.created_at as string,
  }))
}

export async function approveComment(id: number): Promise<void> {
  const db = getClient()
  await db.execute({ sql: 'UPDATE comments SET approved = 1 WHERE id = ?', args: [id] })
}

export async function deleteComment(id: number): Promise<void> {
  const db = getClient()
  await db.execute({ sql: 'DELETE FROM comments WHERE parent_id = ?', args: [id] })
  await db.execute({ sql: 'DELETE FROM comments WHERE id = ?', args: [id] })
}

export async function getCommentById(id: number): Promise<AdminComment | null> {
  const db = getClient()
  const result = await db.execute({
    sql: `SELECT id, post_slug, parent_id, author_name, author_email, content, approved, imported_from, created_at
          FROM comments WHERE id = ?`,
    args: [id],
  })
  if (result.rows.length === 0) return null
  const row = result.rows[0]
  return {
    id: row.id as number,
    post_slug: row.post_slug as string,
    parent_id: row.parent_id as number | null,
    author_name: row.author_name as string,
    author_email: (row.author_email as string) || '',
    content: row.content as string,
    approved: row.approved as number,
    imported_from: row.imported_from as string | null,
    created_at: row.created_at as string,
  }
}

export async function createApprovedReply(data: {
  post_slug: string
  parent_id: number
  author_name: string
  content: string
}): Promise<number> {
  const db = getClient()

  const result = await db.execute({
    sql: `INSERT INTO comments (post_slug, parent_id, author_name, author_email, content, approved)
          VALUES (?, ?, ?, '', ?, 1)`,
    args: [data.post_slug, data.parent_id, data.author_name, data.content],
  })

  return Number(result.lastInsertRowid)
}

// ─── Settings ───────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const db = getClient()
  const result = await db.execute({ sql: 'SELECT value FROM settings WHERE key = ?', args: [key] })
  if (result.rows.length === 0) return null
  return result.rows[0].value as string
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = getClient()
  await db.execute({
    sql: `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
    args: [key, value],
  })
}

// ─── Glossary Stats ─────────────────────────────────────────────────────

export interface GlossaryStat {
  term: string
  clicks: number
  searches: number
  hovers: number
  boost: number
  score: number
  updated_at: string
}

export async function trackGlossaryTerm(term: string, type: 'click' | 'search' | 'hover'): Promise<void> {
  const db = getClient()
  const colMap = { click: 'clicks', search: 'searches', hover: 'hovers' } as const
  const col = colMap[type]
  if (!col) throw new Error(`Invalid tracking type: ${type}`)
  await db.execute({
    sql: `INSERT INTO glossary_stats (term, ${col}, updated_at)
          VALUES (?, 1, datetime('now'))
          ON CONFLICT(term) DO UPDATE SET ${col} = ${col} + 1, updated_at = datetime('now')`,
    args: [term],
  })
}

export async function getTopGlossaryTerms(limit = 10): Promise<GlossaryStat[]> {
  const db = getClient()
  const result = await db.execute({
    sql: `SELECT term, clicks, searches, hovers, boost, (clicks + searches + hovers + boost) AS score, updated_at
          FROM glossary_stats
          WHERE (clicks + searches + hovers + boost) > 0
          ORDER BY score DESC
          LIMIT ?`,
    args: [limit],
  })
  return result.rows.map((row) => ({
    term: row.term as string,
    clicks: row.clicks as number,
    searches: row.searches as number,
    hovers: row.hovers as number,
    boost: row.boost as number,
    score: row.score as number,
    updated_at: row.updated_at as string,
  }))
}

export async function getGlossaryStats(): Promise<GlossaryStat[]> {
  const db = getClient()
  const result = await db.execute(
    `SELECT term, clicks, searches, hovers, boost, (clicks + searches + hovers + boost) AS score, updated_at
     FROM glossary_stats
     ORDER BY score DESC`,
  )
  return result.rows.map((row) => ({
    term: row.term as string,
    clicks: row.clicks as number,
    searches: row.searches as number,
    hovers: row.hovers as number,
    boost: row.boost as number,
    score: row.score as number,
    updated_at: row.updated_at as string,
  }))
}

// ─── Widget Loads ───────────────────────────────────────────────────────

export async function trackWidgetLoad(domain: string, pageUrl?: string): Promise<void> {
  const db = getClient()
  await db.execute({
    sql: `INSERT INTO widget_loads (domain, page_url) VALUES (?, ?)`,
    args: [domain, pageUrl || null],
  })
}

export interface WidgetLoadStats {
  domain: string
  loads: number
  last_loaded: string
}

export async function getWidgetLoadStats(): Promise<WidgetLoadStats[]> {
  const db = getClient()
  const result = await db.execute(
    `SELECT domain, COUNT(*) AS loads, MAX(loaded_at) AS last_loaded
     FROM widget_loads
     GROUP BY domain
     ORDER BY loads DESC`,
  )
  return result.rows.map((row) => ({
    domain: row.domain as string,
    loads: row.loads as number,
    last_loaded: row.last_loaded as string,
  }))
}

export async function setGlossaryBoost(term: string, boost: number): Promise<void> {
  const db = getClient()
  await db.execute({
    sql: `INSERT INTO glossary_stats (term, boost, updated_at)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT(term) DO UPDATE SET boost = ?, updated_at = datetime('now')`,
    args: [term, boost, boost],
  })
}

// ─── Quiz Results (Tiny-House-Readiness-Test) ───────────────────────────

export type QuizDimension = 'minimalismus' | 'platz' | 'handwerk' | 'stellplatz' | 'finanzen' | 'autarkie'

const QUIZ_DIMENSIONS: QuizDimension[] = ['minimalismus', 'platz', 'handwerk', 'stellplatz', 'finanzen', 'autarkie']

export interface QuizResultInput {
  overall: number
  verdict: string
  dimensions: Record<QuizDimension, number>
}

let quizTableReady = false

async function ensureQuizTable(db: Client): Promise<void> {
  if (quizTableReady) return
  await db.execute(`
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
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_quiz_results_created_at ON quiz_results (created_at)`)
  quizTableReady = true
}

export async function saveQuizResult(data: QuizResultInput): Promise<void> {
  const db = getClient()
  await ensureQuizTable(db)
  await db.execute({
    sql: `INSERT INTO quiz_results (overall, verdict, minimalismus, platz, handwerk, stellplatz, finanzen, autarkie)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.overall,
      data.verdict,
      data.dimensions.minimalismus,
      data.dimensions.platz,
      data.dimensions.handwerk,
      data.dimensions.stellplatz,
      data.dimensions.finanzen,
      data.dimensions.autarkie,
    ],
  })
}

export interface QuizStats {
  total: number
  last7Days: number
  last30Days: number
  avgOverall: number
  verdictCounts: Record<string, number>
  avgDimensions: Record<QuizDimension, number>
  daily: { day: string; count: number }[]
}

export async function getQuizStats(): Promise<QuizStats> {
  const db = getClient()
  await ensureQuizTable(db)

  const dimAvgSql = QUIZ_DIMENSIONS.map((d) => `AVG(${d}) AS ${d}`).join(', ')
  const summary = await db.execute(`
    SELECT
      COUNT(*) AS total,
      AVG(overall) AS avg_overall,
      ${dimAvgSql},
      SUM(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS last7,
      SUM(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 ELSE 0 END) AS last30
    FROM quiz_results
  `)
  const row = summary.rows[0]
  const total = Number(row.total) || 0

  const verdicts = await db.execute(`SELECT verdict, COUNT(*) AS c FROM quiz_results GROUP BY verdict`)
  const verdictCounts: Record<string, number> = {}
  for (const v of verdicts.rows) verdictCounts[v.verdict as string] = Number(v.c)

  const dailyRes = await db.execute(`
    SELECT date(created_at) AS day, COUNT(*) AS c
    FROM quiz_results
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY day
    ORDER BY day ASC
  `)
  const daily = dailyRes.rows.map((r) => ({ day: r.day as string, count: Number(r.c) }))

  const avgDimensions = {} as Record<QuizDimension, number>
  for (const d of QUIZ_DIMENSIONS) {
    avgDimensions[d] = total > 0 ? Math.round(Number(row[d])) : 0
  }

  return {
    total,
    last7Days: Number(row.last7) || 0,
    last30Days: Number(row.last30) || 0,
    avgOverall: total > 0 ? Math.round(Number(row.avg_overall)) : 0,
    verdictCounts,
    avgDimensions,
    daily,
  }
}
