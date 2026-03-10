import type { APIRoute } from 'astro'
import { isAuthenticated } from '../../../lib/admin-auth'
import { getCollection } from 'astro:content'
import {
  upsertSocialTexts,
  getSocialTexts,
  updateSocialText,
  getShareOverview,
  getSlugsWithTexts,
  getSharesForSlug,
  getShareCounts,
  type Platform,
} from '../../../lib/social'
import OpenAI from 'openai'

export const prerender = false

/** Strip .md extension to normalize slug format */
function normalizeSlug(slug: string): string {
  return slug.replace(/\.md$/, '')
}

function getFirstImage(images: string | string[] | undefined): string | null {
  if (!images) return null
  if (Array.isArray(images)) return images[0] ?? null
  return images
}

export const GET: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' }

  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  try {
    const url = new URL(request.url)

    // Single post detail
    const slugParam = url.searchParams.get('slug')
    if (slugParam) {
      const slug = normalizeSlug(slugParam)
      const [texts, shares] = await Promise.all([getSocialTexts(slug), getSharesForSlug(slug)])
      return new Response(JSON.stringify({ texts, shares }), { status: 200, headers })
    }

    // List view
    const allPosts = await getCollection('posts')
    const posts = allPosts
      .filter((p) => !p.data.draft)
      .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
      .map((p) => ({
        slug: p.id.replace(/\.md$/, ''),
        title: p.data.title,
        summary: p.data.summary || '',
        date: p.data.date.toISOString().split('T')[0],
        imageUrl: getFirstImage(p.data.images),
      }))

    const [slugsWithTexts, shareOverview, shareCounts] = await Promise.all([
      getSlugsWithTexts(),
      getShareOverview(),
      getShareCounts(),
    ])

    return new Response(
      JSON.stringify({
        posts,
        slugsWithTexts: [...slugsWithTexts],
        shareOverview,
        shareCounts,
      }),
      { status: 200, headers },
    )
  } catch (err: any) {
    console.error('[admin/social GET]', err)
    return new Response(
      JSON.stringify({ error: 'Daten konnten nicht geladen werden.', detail: err?.message }),
      { status: 500, headers },
    )
  }
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' }

  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  try {
    const body = await request.json()
    const { action } = body

    // ─── Generate texts via AI ───
    if (action === 'generate') {
      const slug = body.slug ? normalizeSlug(body.slug) : ''
      if (!slug) {
        return new Response(JSON.stringify({ error: 'slug ist erforderlich.' }), { status: 400, headers })
      }

      const apiKey = import.meta.env.OPENAI_API_KEY
      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'OPENAI_API_KEY nicht konfiguriert.' }), { status: 500, headers })
      }

      // Get post content
      const allPosts = await getCollection('posts')
      const post = allPosts.find((p) => normalizeSlug(p.id) === slug)
      if (!post) {
        return new Response(JSON.stringify({ error: 'Post nicht gefunden.' }), { status: 404, headers })
      }

      // Strip markdown for AI input (first ~3000 chars)
      const bodyText = post.body
        ? post.body
            .replace(/^---[\s\S]*?---\n?/, '')
            .replace(/!\[.*?\]\(.*?\)/g, '')
            .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
            .replace(/#{1,6}\s/g, '')
            .replace(/[*_~`]/g, '')
            .slice(0, 3000)
        : ''

      const openai = new OpenAI({ apiKey })
      const completion = await openai.chat.completions.create({
        model: 'gpt-5.2',
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Du bist Social-Media-Manager für den Blog "KOKOMO" (kokomo.house) — ein Tiny-House-Blog aus der Schweiz.
Die Autoren sind Sibylle und Michi. Schreibe aus deren Perspektive ("wir").

WICHTIG:
- ss statt ß verwenden (Schweizer Deutsch)
- IMMER echte Umlaute ä, ö, ü verwenden — NIEMALS ae, oe, ue als Ersatz
- Authentisch und persönlich, nicht werblich
- URL-Platzhalter {url} verwenden wo ein Link zum Blogpost stehen soll

Generiere Social-Media-Texte für 4 Plattformen:

1. **facebook** (max ~1200 Zeichen): Storytelling, 2-3 Absätze, passende Emojis, Call-to-Action ("Lest den ganzen Beitrag: {url}"), relevante Hashtags am Ende
2. **twitter** (max 280 Zeichen): Punchy, 1-2 Sätze, 2-3 Hashtags, {url} am Ende. STRIKT unter 280 Zeichen!
3. **telegram** (max ~1000 Zeichen): Markdown-Formatierung (**bold**, _italic_), informativ, Emojis, Link am Ende
4. **whatsapp** (max ~700 Zeichen): Informell, persönlich wie eine Nachricht an Freunde, Emojis, Link am Ende

Antworte als JSON:
{
  "facebook": "...",
  "twitter": "...",
  "telegram": "...",
  "whatsapp": "..."
}`,
          },
          {
            role: 'user',
            content: `Blogpost: "${post.data.title}"
Summary: ${post.data.summary || ''}
Inhalt:
${bodyText}`,
          },
        ],
      })

      const content = completion.choices[0]?.message?.content
      if (!content) {
        return new Response(JSON.stringify({ error: 'Keine Antwort von OpenAI.' }), { status: 500, headers })
      }

      const generated = JSON.parse(content) as Record<string, string>

      const textsToSave: Partial<Record<Platform, string>> = {
        facebook_page: generated.facebook,
        twitter: generated.twitter,
        telegram: generated.telegram,
        whatsapp: generated.whatsapp,
      }

      await upsertSocialTexts(slug, textsToSave)

      const texts = await getSocialTexts(slug)
      return new Response(JSON.stringify({ ok: true, texts }), { status: 200, headers })
    }

    // ─── Update single text ───
    if (action === 'update') {
      const { platform, text } = body
      const slug = body.slug ? normalizeSlug(body.slug) : ''
      if (!slug || !platform || text === undefined) {
        return new Response(
          JSON.stringify({ error: 'slug, platform und text sind erforderlich.' }),
          { status: 400, headers },
        )
      }
      await updateSocialText(slug, platform as Platform, text)
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
    }

    return new Response(JSON.stringify({ error: 'Unbekannte Aktion.' }), { status: 400, headers })
  } catch (err: any) {
    console.error('[admin/social POST]', err)
    return new Response(
      JSON.stringify({ error: 'Aktion fehlgeschlagen.', detail: err?.message }),
      { status: 500, headers },
    )
  }
}
