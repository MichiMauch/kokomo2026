import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { isAuthenticated } from '../../../lib/admin-auth'
import OpenAI from 'openai'
import {
  stripPostMarkdown,
  upsertAssets,
  getAssets,
  buildSrtFromBeats,
  type VideoBeat,
} from '../../../lib/repurpose'
import { fixUmlauts } from '../../../lib/fix-umlauts'

/** Sicherheitsnetz: ae→ä etc. in allen String-Feldern reparieren (wie createPostFile). */
function deepFixUmlauts<T>(value: T): T {
  if (typeof value === 'string') return fixUmlauts(value) as unknown as T
  if (Array.isArray(value)) return value.map(deepFixUmlauts) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = deepFixUmlauts(v)
    return out as T
  }
  return value
}

export const prerender = false

const headers = { 'Content-Type': 'application/json' }

function normalizeSlug(slug: string): string {
  return slug.replace(/\.md$/, '')
}

const SYSTEM_PROMPT = `Du bist Content-Distributions-Manager für den Blog "KOKOMO" (kokomo.house) — ein Tiny-House-Blog aus der Schweiz von Sibylle und Michi. Schreibe aus deren Perspektive ("wir"), in der du-Form an die Lesenden.

HARTE REGELN:
- ss statt ß (Schweizer Hochdeutsch). NIEMALS "ß".
- IMMER echte Umlaute ä, ö, ü — NIEMALS ae/oe/ue als Ersatz.
- Authentisch, persönlich, nahbar, nicht werblich, kein Marketing-Sprech.
- Kein Selbstlob mit "ehrlich" ("ehrlich gesagt", "unser ehrlicher …").
- Link-Pflicht: Wo ein Link zum Blogpost gehört, nutze EXAKT den Platzhalter \`{url}\` — niemals eine selbst geschriebene URL. Wird später durch https://www.kokomo.house/tiny-house/<slug>/ ersetzt.

Erzeuge aus dem gegebenen Blogpost ein JSON-Objekt mit GENAU diesen Feldern:

{
  "social_extra": {
    "instagram": "Caption für einen Instagram-Feed-Post (max ~2000 Z.), 3-5 Emojis, 5-10 Hashtags am Ende, {url} im Text (Hinweis 'Link in Bio' + {url}).",
    "mastodon": "Locker, community-nah (max ~480 Z.), 2-3 Hashtags, {url} am Ende."
  },
  "carousel": {
    "slides": [
      { "title": "Kurzer Slide-Titel (≤40 Z.)", "body": "1-2 knappe Sätze (≤180 Z.)" }
    ],
    "caption": "Begleittext fürs Karussell (≤1500 Z.), {url} enthalten",
    "hashtags": ["#tinyhouse", "..."]
  },
  "video_script": {
    "hook": "Erste 3 Sekunden, ein starker Satz, der zum Dranbleiben bringt",
    "beats": [
      { "text": "Gesprochener Satz (kurz, sprechbar)", "seconds": 4 }
    ],
    "shotlist": ["Konkreter Bildvorschlag pro Beat, was gefilmt wird"],
    "thumbnail_prompt": "Englischer Bildprompt für ein Thumbnail (Szene, Tiny House, Schweiz, dokumentarisch, KEIN Text im Bild)",
    "title": "YouTube/Reel-Titel (≤70 Z.)",
    "description": "Kurzbeschreibung für die Video-Plattform (≤500 Z.), {url} am Ende"
  },
  "newsletter_blurb": {
    "teaser": "Anreisser für den Newsletter (≤300 Z.), macht neugierig, kein Hard-Sell",
    "cta": "Kurzer Call-to-Action-Satz mit {url}"
  }
}

Das Karussell hat 6-8 Slides (erster Slide = Hook, letzter Slide = Call-to-Action). Das Video-Skript ist 30-45 Sekunden lang (Summe der seconds), vertikal gedacht, sprechbar. Antworte NUR mit dem JSON-Objekt.`

export const GET: APIRoute = async ({ request }) => {
  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }
  try {
    const url = new URL(request.url)
    const slug = normalizeSlug(url.searchParams.get('slug') || '')
    if (!slug) return new Response(JSON.stringify({ error: 'slug erforderlich.' }), { status: 400, headers })
    const assets = await getAssets(slug)
    return new Response(JSON.stringify({ assets }), { status: 200, headers })
  } catch (err: any) {
    // Turso evtl. nicht erreichbar — leere Liste statt Hänger
    return new Response(JSON.stringify({ assets: [], warning: err?.message }), { status: 200, headers })
  }
}

export const POST: APIRoute = async ({ request }) => {
  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  try {
    const body = await request.json()
    const action = body.action || 'generate'
    const slug = body.slug ? normalizeSlug(body.slug) : ''
    if (!slug) return new Response(JSON.stringify({ error: 'slug erforderlich.' }), { status: 400, headers })

    const allPosts = await getCollection('posts')
    const post = allPosts.find((p) => normalizeSlug(p.id) === slug)
    if (!post) return new Response(JSON.stringify({ error: 'Post nicht gefunden.' }), { status: 404, headers })

    // ─── Assets per LLM erzeugen ───
    if (action === 'generate') {
      const apiKey = import.meta.env.OPENAI_API_KEY
      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'OPENAI_API_KEY nicht konfiguriert.' }), { status: 500, headers })
      }

      const bodyText = stripPostMarkdown(post.body)
      const openai = new OpenAI({ apiKey })
      const completion = await openai.chat.completions.create({
        model: 'gpt-5.2',
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Blogpost: "${post.data.title}"\nSummary: ${post.data.summary || ''}\nInhalt:\n${bodyText}`,
          },
        ],
      })

      const content = completion.choices[0]?.message?.content
      if (!content) return new Response(JSON.stringify({ error: 'Keine Antwort von OpenAI.' }), { status: 500, headers })

      const generated = deepFixUmlauts(JSON.parse(content) as Record<string, unknown>)

      // .srt aus den Video-Beats ableiten (serverseitig, deterministisch)
      const vs = generated.video_script as { beats?: VideoBeat[] } | undefined
      const srt = vs?.beats?.length ? buildSrtFromBeats(vs.beats) : ''
      if (vs && srt) (generated.video_script as Record<string, unknown>).srt = srt

      // Speichern darf das Ergebnis nicht verschlucken (Turso evtl. down).
      let saved = true
      try {
        await upsertAssets(slug, {
          social_extra: generated.social_extra,
          carousel: generated.carousel,
          video_script: generated.video_script,
          newsletter_blurb: generated.newsletter_blurb,
        })
      } catch (saveErr: any) {
        saved = false
        console.error('[admin/repurpose] Speichern fehlgeschlagen:', saveErr?.message)
      }

      return new Response(
        JSON.stringify({
          ok: true,
          saved,
          assets: generated,
          warning: saved
            ? undefined
            : 'Assets erzeugt, aber NICHT gespeichert — Datenbank (Turso) nicht erreichbar. Du kannst sie jetzt kopieren; erneut generieren speichert sie, sobald die DB wieder läuft.',
        }),
        { status: 200, headers },
      )
    }

    // ─── Karussell-Slides als Bilder rendern (Titel/Untertitel als Schrift drauf) ───
    if (action === 'render-slides') {
      const slides: { title?: string; body?: string; prompt?: string }[] = Array.isArray(body.slides) ? body.slides : []
      if (!slides.length) return new Response(JSON.stringify({ error: 'slides erforderlich.' }), { status: 400, headers })
      const { renderSlideToR2 } = await import('../../../lib/generate-image')
      const urls: string[] = []
      for (let i = 0; i < slides.length; i++) {
        const s = slides[i]
        const prompt = s.prompt || `Documentary tiny house lifestyle photo for a Facebook gallery slide about: ${s.title || ''}. ${s.body || ''}`
        urls.push(
          await renderSlideToR2({
            prompt,
            title: s.title || '',
            subtitle: s.body || '',
            filename: `${slug}-slide-${i + 1}`,
          }),
        )
      }
      return new Response(JSON.stringify({ ok: true, urls }), { status: 200, headers })
    }

    // ─── Alle Slides (oder beliebige R2-URLs) als ZIP zum Download bündeln ───
    if (action === 'download-zip') {
      const urls: string[] = Array.isArray(body.urls) ? body.urls : []
      if (!urls.length) return new Response(JSON.stringify({ error: 'urls erforderlich.' }), { status: 400, headers })
      const JSZip = (await import('jszip')).default
      const { downloadFromR2, r2KeyFromUrl } = await import('../../../lib/r2')
      const zip = new JSZip()
      for (let i = 0; i < urls.length; i++) {
        try {
          const buf = await downloadFromR2(r2KeyFromUrl(urls[i]))
          const ext = (urls[i].split('.').pop() || 'webp').split('?')[0]
          zip.file(`${slug}-slide-${String(i + 1).padStart(2, '0')}.${ext}`, buf)
        } catch (e: any) {
          console.error('[admin/repurpose zip] Objekt nicht ladbar:', urls[i], e?.message)
        }
      }
      const zipBuf = await zip.generateAsync({ type: 'nodebuffer' })
      return new Response(zipBuf, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${slug}-slides.zip"`,
        },
      })
    }

    // ─── Video-Thumbnail rendern (on-demand) ───
    if (action === 'render-thumbnail') {
      const prompt = String(body.prompt || '')
      if (!prompt) return new Response(JSON.stringify({ error: 'prompt erforderlich.' }), { status: 400, headers })
      const { generateImageToR2 } = await import('../../../lib/generate-image')
      const url = await generateImageToR2(prompt, 'header', `${slug}-video-thumb`)
      return new Response(JSON.stringify({ ok: true, url }), { status: 200, headers })
    }

    return new Response(JSON.stringify({ error: 'Unbekannte Aktion.' }), { status: 400, headers })
  } catch (err: any) {
    console.error('[admin/repurpose POST]', err)
    return new Response(JSON.stringify({ error: 'Aktion fehlgeschlagen.', detail: err?.message }), { status: 500, headers })
  }
}
