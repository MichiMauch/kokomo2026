#!/usr/bin/env npx tsx
/**
 * Save social media texts for a blog post to Turso (social_texts table).
 * The texts are stored per platform and reviewed/shared in the admin dashboard
 * under /admin/posts/<slug>#social. Nothing is auto-posted.
 *
 * Usage as CLI (texts as JSON):
 *   npx tsx pipeline/save-social-texts.ts <slug> '<json>'
 *   # json: {"facebook":"…","twitter":"…","telegram":"…","whatsapp":"…"}
 *
 * Usage as module:
 *   import { saveSocialTexts } from './save-social-texts'
 *   await saveSocialTexts(slug, { facebook, twitter, telegram, whatsapp })
 */

import { resolve } from 'path'
import { config } from 'dotenv'
import { createClient } from '@libsql/client'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

export interface SocialTexts {
  facebook: string
  twitter: string
  telegram: string
  whatsapp: string
}

const PLATFORM_MAP: Record<keyof SocialTexts, string> = {
  facebook: 'facebook_page',
  twitter: 'twitter',
  telegram: 'telegram',
  whatsapp: 'whatsapp',
}

function getTursoClient() {
  const url = process.env.TURSO_DB_URL
  const authToken = process.env.TURSO_DB_TOKEN
  if (!url || !authToken) {
    throw new Error('TURSO_DB_URL and TURSO_DB_TOKEN must be set in .env.local')
  }
  return createClient({ url, authToken })
}

/**
 * Upsert the four platform texts for a post slug.
 */
export async function saveSocialTexts(slug: string, texts: SocialTexts): Promise<void> {
  const db = getTursoClient()
  for (const [key, text] of Object.entries(texts)) {
    const platform = PLATFORM_MAP[key as keyof SocialTexts]
    if (!platform) continue
    await db.execute({
      sql: `INSERT INTO social_texts (post_slug, platform, text, generated_at, updated_at)
            VALUES (?, ?, ?, datetime('now'), datetime('now'))
            ON CONFLICT(post_slug, platform) DO UPDATE SET text = ?, updated_at = datetime('now')`,
      args: [slug, platform, text, text],
    })
  }
}

// CLI mode
if (process.argv[1]?.includes('save-social-texts')) {
  ;(async () => {
    const [, , slug, json] = process.argv
    if (!slug || !json) {
      console.error("Usage: npx tsx pipeline/save-social-texts.ts <slug> '<json>'")
      console.error('  json keys: facebook, twitter, telegram, whatsapp')
      process.exit(1)
    }
    try {
      const texts = JSON.parse(json) as SocialTexts
      await saveSocialTexts(slug, texts)
      console.log(
        `✅ Social-Texte für "${slug}" gespeichert. Review: /admin/posts/${slug}#social`
      )
    } catch (err: any) {
      console.error(`❌ Save failed: ${err.message}`)
      process.exit(1)
    }
  })()
}
