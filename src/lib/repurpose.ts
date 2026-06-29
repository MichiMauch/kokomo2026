/**
 * Repurposing-Engine — Data-Layer + Helper (Turso)
 *
 * Speichert pro Post die generierten Distributions-Assets (erweiterte Social-Texte,
 * Karussell, Video-Skript, Newsletter-Häppchen) als JSON in `repurpose_assets`.
 * Muster bewusst 1:1 wie src/lib/social.ts.
 */

import { getClient } from './turso'

export type RepurposeKind = 'social_extra' | 'carousel' | 'video_script' | 'newsletter_blurb'

export const REPURPOSE_KINDS: RepurposeKind[] = [
  'social_extra',
  'carousel',
  'video_script',
  'newsletter_blurb',
]

export interface RepurposeAsset {
  post_slug: string
  kind: RepurposeKind
  payload: unknown
  generated_at: string
  updated_at: string
}

// ─── Helper: Markdown für AI-Input bereinigen ───────────────────────────────
// Gleiche Logik wie in src/pages/api/admin/social.ts — hier zentral, damit beide
// Endpoints sie teilen können.
export function stripPostMarkdown(body: string | undefined, max = 3500): string {
  if (!body) return ''
  return body
    .replace(/^---[\s\S]*?---\n?/, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/[*_~`]/g, '')
    .slice(0, max)
}

// ─── Helper: .srt-Untertitel aus Video-Beats bauen ──────────────────────────
export interface VideoBeat {
  text: string
  seconds: number
}

function srtTime(totalSeconds: number): string {
  const ms = Math.round((totalSeconds % 1) * 1000)
  const s = Math.floor(totalSeconds) % 60
  const m = Math.floor(totalSeconds / 60) % 60
  const h = Math.floor(totalSeconds / 3600)
  const pad = (n: number, l = 2) => String(n).padStart(l, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`
}

/** Baut aus Beats (Text + Dauer) eine .srt-Datei mit kumulativen Timecodes. */
export function buildSrtFromBeats(beats: VideoBeat[]): string {
  let t = 0
  return beats
    .map((b, i) => {
      const start = t
      const dur = Math.max(1, b.seconds || 3)
      t += dur
      return `${i + 1}\n${srtTime(start)} --> ${srtTime(t)}\n${b.text.trim()}\n`
    })
    .join('\n')
}

// ─── Data-Layer (Turso) ─────────────────────────────────────────────────────

export async function upsertAsset(slug: string, kind: RepurposeKind, payload: unknown): Promise<void> {
  const db = getClient()
  const json = JSON.stringify(payload)
  await db.execute({
    sql: `INSERT INTO repurpose_assets (post_slug, kind, payload, generated_at, updated_at)
          VALUES (?, ?, ?, datetime('now'), datetime('now'))
          ON CONFLICT(post_slug, kind) DO UPDATE SET payload = ?, updated_at = datetime('now')`,
    args: [slug, kind, json, json],
  })
}

export async function upsertAssets(
  slug: string,
  assets: Partial<Record<RepurposeKind, unknown>>,
): Promise<void> {
  for (const [kind, payload] of Object.entries(assets)) {
    if (payload === undefined || payload === null) continue
    await upsertAsset(slug, kind as RepurposeKind, payload)
  }
}

export async function getAssets(slug: string): Promise<RepurposeAsset[]> {
  const db = getClient()
  const result = await db.execute({
    sql: `SELECT post_slug, kind, payload, generated_at, updated_at
          FROM repurpose_assets
          WHERE post_slug = ?
          ORDER BY kind`,
    args: [slug],
  })
  return result.rows.map((row) => ({
    post_slug: row.post_slug as string,
    kind: row.kind as RepurposeKind,
    payload: safeParse(row.payload as string),
    generated_at: row.generated_at as string,
    updated_at: row.updated_at as string,
  }))
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
}
