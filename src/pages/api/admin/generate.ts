import type { APIRoute } from 'astro'
import { isAuthenticated } from '../../../lib/admin-auth'
import { getFileContent } from '../../../lib/github'
import OpenAI from 'openai'
import yaml from 'yaml'

export const prerender = false

interface GenerateRequest {
  title: string
  description: string
  tags: string[]
  key_points?: string[]
  custom_instructions?: string
  word_count?: number
  post_type?: 'erzaehlung' | 'listenpost' | 'anleitung' | 'erfahrungsbericht'
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' }

  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  try {
    const body: GenerateRequest = await request.json()

    if (!body.title) {
      return new Response(JSON.stringify({ error: 'Titel ist erforderlich.' }), { status: 400, headers })
    }

    const apiKey = import.meta.env.OPENAI_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY nicht konfiguriert.' }), { status: 500, headers })
    }

    // Load style configs
    let writingStyle = ''
    let imageStyle = ''
    try {
      writingStyle = await getFileContent('content-config/writing-style.yaml')
    } catch {
      writingStyle = 'language: de-CH, tone: authentisch und persönlich'
    }
    try {
      imageStyle = await getFileContent('content-config/image-style.yaml')
    } catch {
      imageStyle = 'editorial photography, warm natural lighting, Swiss countryside'
    }

    const wordCount = body.word_count && [350, 700, 1200].includes(body.word_count) ? body.word_count : 700

    // Parse post type from writing style YAML
    const postType = body.post_type || 'erzaehlung'
    let postTypeLabel = 'Erzählung'
    let postTypePrompt = ''
    try {
      const parsed = yaml.parse(writingStyle)
      const typeConfig = parsed?.post_types?.[postType]
      if (typeConfig) {
        postTypeLabel = typeConfig.label || postTypeLabel
        postTypePrompt = typeConfig.prompt || ''
      }
    } catch {
      // fallback: no type-specific prompt
    }

    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: 'gpt-5.2',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Du bist ein Blogpost-Autor für "KOKOMO" — einen Tiny House Blog aus der Schweiz.
Die Bewohner sind Sibylle und Michi, seit September 2022 im Tiny House (Wohnwagon, Österreich).

Schreibstil:
${writingStyle}

Post-Typ: ${postTypeLabel}
${postTypePrompt}

Bildstil:
${imageStyle}

Schreibe einen vollständigen Blogpost basierend auf dem Thema. Der Post muss:
- Ungefähr ${wordCount} Wörter haben
- In der Du-Form geschrieben sein
- Aus der Wir-Perspektive (Sibylle & Michi)
- ss statt ß verwenden (Schweizer Deutsch)
- Persönliche Erfahrungen einbauen
- Die Struktur und den Stil des Post-Typs "${postTypeLabel}" konsequent umsetzen
- Ein persönliches Fazit haben

Antworte als JSON:
{
  "title": "Finaler Titel (max 60 Zeichen)",
  "summary": "SEO-Summary (160-180 Zeichen)",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "body": "Der vollständige Blogpost in Markdown (nur Body, kein Frontmatter)",
  "image_prompt": "WICHTIG: Der image_prompt MUSS ein ausführlicher, technischer Absatz sein (mindestens 80 Wörter, besser 120+). KEINE Komma-Listen! Schreibe wie ein Fotograf, der ein Shooting-Briefing verfasst. Strukturiere in zusammenhängenden Sätzen mit diesen Layern: 1) SUBJEKT & AKTION: Konkretes Hauptobjekt mit spezifischer Pose/Geste/Aktivität — nicht generisch. 2) UMGEBUNG: Detaillierte Szene (z.B. 'lived-in tiny house kitchen with wooden countertop, herbs on windowsill, morning light streaming through linen curtains'). 3) KAMERA & OPTIK: Exakte technische Parameter — Brennweite (35mm, 50mm, 85mm), Blende (f/1.4, f/1.8, f/2.8), Perspektive (low angle, eye level, overhead), Tiefenschärfe mit Bokeh-Beschreibung. 4) LICHT: Physikalisch präzise Lichtführung mit Begriffen wie 'global illumination', 'volumetric lighting', 'soft directional side light', 'backlit rim light with lens warmth' — NICHT nur 'warm natural lighting'. 5) CONSTRAINTS: Nutze 'without'-Formulierungen zur negativen Steuerung: 'without any motion blur', 'without text or typography', 'clean composition without cluttered background', 'without any artificial looking skin or plastic texture'. VERBOTEN: Generische Adjektive wie 'beautiful', 'stunning', 'amazing', 'cozy'. Jedes Wort muss technische oder kompositorische Bedeutung haben."
}`,
        },
        {
          role: 'user',
          content: `Thema: ${body.title}
Beschreibung: ${body.description || ''}
Tags: ${(body.tags || []).join(', ')}
Kernpunkte: ${(body.key_points || []).join(', ')}
${body.custom_instructions ? `Zusätzliche Anweisungen: ${body.custom_instructions}` : ''}`,
        },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return new Response(JSON.stringify({ error: 'Keine Antwort von OpenAI.' }), { status: 500, headers })
    }

    const result = JSON.parse(content)
    return new Response(JSON.stringify(result), { status: 200, headers })
  } catch (err: any) {
    console.error('[admin/generate]', err)
    return new Response(JSON.stringify({ error: err.message || 'Post konnte nicht generiert werden.' }), {
      status: 500,
      headers,
    })
  }
}
