#!/usr/bin/env npx tsx
/**
 * Idea-Signals — sammelt die "echten" Signale für die Themenfindung an einem Ort.
 *
 * Liefert KOMPAKTES JSON (für den /kokomo-ideen Skill), aus drei projekteigenen Quellen:
 *   1. Google Search Console (kokomo.house Service-Account)  → Quick-Wins + Top-Queries
 *   2. Matomo (matomo.kokomo.house)                          → meistbesuchte Seiten
 *   3. Turso (comments-Tabelle)                              → neue Leserkommentare/-fragen
 *
 * Auth-Muster 1:1 aus src/pages/api/admin/dashboard.ts übernommen.
 * Jede Quelle ist eigenständig fehlertolerant: fehlt eine Credential, kommt `null`
 * für diesen Block zurück — das Skript bricht NIE komplett ab.
 *
 * Usage:
 *   npx tsx pipeline/idea-signals.ts            # 90 Tage GSC/Matomo, 60 Tage Kommentare
 *   npx tsx pipeline/idea-signals.ts --days 180
 */

import { resolve } from 'path'
import { createSign } from 'node:crypto'
import { config } from 'dotenv'
import { createClient } from '@libsql/client'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const SITE_URL = 'https://www.kokomo.house'
const argDays = Number(process.argv[process.argv.indexOf('--days') + 1])
const DAYS = Number.isFinite(argDays) && argDays > 0 ? argDays : 90
const COMMENT_DAYS = 60

const fmt = (d: Date) => d.toISOString().slice(0, 10)
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000)
const slugFromUrl = (u: string) => {
  const m = u.match(/\/tiny-house\/([^/?#]+)/)
  return m ? m[1] : null
}

// ---------------------------------------------------------------- GSC
async function gscAccessToken(): Promise<string | null> {
  const keyRaw = process.env.GOOGLE_SEARCH_CONSOLE_KEY_JSON
  if (!keyRaw) return null
  try {
    const keyJson = keyRaw.trimStart().startsWith('{')
      ? keyRaw
      : Buffer.from(keyRaw, 'base64').toString('utf-8')
    const key = JSON.parse(keyJson)
    const now = Math.floor(Date.now() / 1000)
    const toB64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const signInput = `${toB64({ alg: 'RS256', typ: 'JWT' })}.${toB64({
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })}`
    const sign = createSign('RSA-SHA256')
    sign.update(signInput)
    const jwt = `${signInput}.${sign.sign(key.private_key, 'base64url')}`
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    })
    if (!res.ok) return null
    return (await res.json()).access_token ?? null
  } catch {
    return null
  }
}

async function gscQuery(token: string, dimensions: string[], rowLimit: number) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    SITE_URL,
  )}/searchAnalytics/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startDate: fmt(daysAgo(DAYS)),
      endDate: fmt(new Date()),
      dimensions,
      rowLimit,
      type: 'web',
    }),
  })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data.rows) ? data.rows : []
}

async function fetchGsc() {
  const token = await gscAccessToken()
  if (!token) return null

  const round = (n: number) => Math.round(n * 10) / 10
  const queryRows = (await gscQuery(token, ['query'], 250)).map((r: any) => ({
    query: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: round(r.ctr * 100),
    position: round(r.position),
  }))
  const pageRows = (await gscQuery(token, ['page'], 250)).map((r: any) => ({
    slug: slugFromUrl(r.keys[0]),
    impressions: r.impressions,
    clicks: r.clicks,
    position: round(r.position),
  }))

  // Quick-Wins = ranken knapp ausserhalb der Top-3, genug Nachfrage, holbar mit Update.
  const quickWinQueries = queryRows
    .filter((q) => q.position >= 4 && q.position <= 15 && q.impressions >= 30)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 25)

  const topQueries = queryRows.sort((a, b) => b.impressions - a.impressions).slice(0, 25)

  const pageQuickWins = pageRows
    .filter((p) => p.slug && p.position >= 4 && p.position <= 15 && p.impressions >= 30)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20)

  return { windowDays: DAYS, quickWinQueries, topQueries, pageQuickWins }
}

// ---------------------------------------------------------------- Matomo
async function fetchMatomo() {
  const token = process.env.MATOMO_TOKEN
  const siteId = process.env.MATOMO_SITE_ID
  const baseUrl = (process.env.MATOMO_URL || '').replace(/\/+$/, '')
  if (!token || !baseUrl || !siteId) return null
  try {
    const params = new URLSearchParams({
      module: 'API',
      method: 'Actions.getPageUrls',
      idSite: String(siteId),
      period: 'range',
      date: `last${DAYS}`,
      flat: '1',
      filter_limit: '25',
      filter_sort_column: 'nb_visits',
      showColumns: 'label,nb_visits,url',
      format: 'JSON',
    })
    const res = await fetch(`${baseUrl}/index.php?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `token_auth=${encodeURIComponent(token)}`,
    })
    if (!res.ok) return null
    const rows = await res.json()
    if (!Array.isArray(rows)) return null
    return {
      windowDays: DAYS,
      topPages: rows
        .map((r: any) => ({
          slug: slugFromUrl(r.url || r.label || ''),
          label: r.label,
          visits: r.nb_visits,
        }))
        .filter((r) => r.slug)
        .slice(0, 20),
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- Comments
async function fetchComments() {
  const url = process.env.TURSO_DB_URL
  const authToken = process.env.TURSO_DB_TOKEN
  if (!url || !authToken) return null
  try {
    const db = createClient({ url, authToken })
    const since = fmt(daysAgo(COMMENT_DAYS))
    const recent = await db.execute({
      sql: `SELECT post_slug, author_name, content, created_at
            FROM comments
            WHERE created_at >= ?
            ORDER BY created_at DESC
            LIMIT 40`,
      args: [since],
    })
    const byPost = await db.execute(
      `SELECT post_slug, COUNT(*) AS n FROM comments GROUP BY post_slug ORDER BY n DESC LIMIT 15`,
    )
    return {
      windowDays: COMMENT_DAYS,
      recent: recent.rows.map((r) => ({
        slug: r.post_slug as string,
        author: r.author_name as string,
        // Fragen sind die besten Ideen → Marker, ob ein "?" drin steht.
        isQuestion: String(r.content).includes('?'),
        text: String(r.content).replace(/\s+/g, ' ').trim().slice(0, 280),
        date: String(r.created_at).slice(0, 10),
      })),
      mostDiscussed: byPost.rows.map((r) => ({ slug: r.post_slug as string, comments: Number(r.n) })),
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- main
async function main() {
  const [gsc, matomo, comments] = await Promise.all([fetchGsc(), fetchMatomo(), fetchComments()])
  const out = {
    generatedAt: fmt(new Date()),
    sources: {
      gsc: gsc ? 'ok' : 'unavailable',
      matomo: matomo ? 'ok' : 'unavailable',
      comments: comments ? 'ok' : 'unavailable',
    },
    gsc,
    matomo,
    comments,
  }
  process.stdout.write(JSON.stringify(out, null, 2) + '\n')
}

main().catch((err) => {
  process.stderr.write(`idea-signals failed: ${err?.message || err}\n`)
  process.exit(1)
})
