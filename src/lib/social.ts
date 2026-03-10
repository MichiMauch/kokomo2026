/**
 * Social media data layer (Turso)
 * Manages social texts and share records
 */

import { getClient } from './turso'

export type Platform = 'facebook_page' | 'twitter' | 'telegram' | 'whatsapp'
export type GeneratePlatform = 'facebook' | 'twitter' | 'telegram' | 'whatsapp'

export interface SocialText {
  id: number
  post_slug: string
  platform: Platform
  text: string
  generated_at: string
  updated_at: string
}

export interface SocialShare {
  id: number
  post_slug: string
  platform: Platform
  external_id: string | null
  external_url: string | null
  shared_at: string
}

// ─── Social Texts ───────────────────────────────────────────────────────

export async function upsertSocialTexts(slug: string, texts: Partial<Record<Platform, string>>): Promise<void> {
  const db = getClient()
  for (const [platform, text] of Object.entries(texts)) {
    if (!text) continue
    await db.execute({
      sql: `INSERT INTO social_texts (post_slug, platform, text, generated_at, updated_at)
            VALUES (?, ?, ?, datetime('now'), datetime('now'))
            ON CONFLICT(post_slug, platform) DO UPDATE SET text = ?, updated_at = datetime('now')`,
      args: [slug, platform, text, text],
    })
  }
}

export async function getSocialTexts(slug: string): Promise<SocialText[]> {
  const db = getClient()
  const result = await db.execute({
    sql: `SELECT id, post_slug, platform, text, generated_at, updated_at
          FROM social_texts
          WHERE post_slug = ?
          ORDER BY platform`,
    args: [slug],
  })
  return result.rows.map((row) => ({
    id: row.id as number,
    post_slug: row.post_slug as string,
    platform: row.platform as Platform,
    text: row.text as string,
    generated_at: row.generated_at as string,
    updated_at: row.updated_at as string,
  }))
}

export async function updateSocialText(slug: string, platform: Platform, text: string): Promise<void> {
  const db = getClient()
  await db.execute({
    sql: `UPDATE social_texts SET text = ?, updated_at = datetime('now')
          WHERE post_slug = ? AND platform = ?`,
    args: [text, slug, platform],
  })
}

// ─── Social Shares ──────────────────────────────────────────────────────

export async function recordShare(
  slug: string,
  platform: Platform,
  externalId?: string,
  externalUrl?: string,
): Promise<void> {
  const db = getClient()
  await db.execute({
    sql: `INSERT INTO social_shares (post_slug, platform, external_id, external_url)
          VALUES (?, ?, ?, ?)`,
    args: [slug, platform, externalId ?? null, externalUrl ?? null],
  })
}

export async function getSharesForSlug(slug: string): Promise<SocialShare[]> {
  const db = getClient()
  const result = await db.execute({
    sql: `SELECT id, post_slug, platform, external_id, external_url, shared_at
          FROM social_shares
          WHERE post_slug = ?
          ORDER BY shared_at DESC`,
    args: [slug],
  })
  return result.rows.map((row) => ({
    id: row.id as number,
    post_slug: row.post_slug as string,
    platform: row.platform as Platform,
    external_id: row.external_id as string | null,
    external_url: row.external_url as string | null,
    shared_at: row.shared_at as string,
  }))
}

export async function getShareOverview(): Promise<Record<string, Record<string, string>>> {
  const db = getClient()
  const result = await db.execute(
    `SELECT post_slug, platform, MAX(shared_at) as last_shared
     FROM social_shares
     GROUP BY post_slug, platform`,
  )
  const overview: Record<string, Record<string, string>> = {}
  for (const row of result.rows) {
    const slug = row.post_slug as string
    const platform = row.platform as string
    const lastShared = row.last_shared as string
    if (!overview[slug]) overview[slug] = {}
    overview[slug][platform] = lastShared
  }
  return overview
}

export async function getSlugsWithTexts(): Promise<Set<string>> {
  const db = getClient()
  const result = await db.execute('SELECT DISTINCT post_slug FROM social_texts')
  return new Set(result.rows.map((row) => row.post_slug as string))
}

export async function getShareCounts(): Promise<Record<string, number>> {
  const db = getClient()
  const result = await db.execute(
    `SELECT platform, COUNT(DISTINCT post_slug) as count FROM social_shares GROUP BY platform`,
  )
  const counts: Record<string, number> = {}
  for (const row of result.rows) {
    counts[row.platform as string] = row.count as number
  }
  return counts
}
