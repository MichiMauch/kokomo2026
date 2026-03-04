import type { APIRoute } from 'astro'
import { isAuthenticated } from '../../../lib/admin-auth'
import { getFileContent } from '../../../lib/github'
import OpenAI from 'openai'

export const prerender = false

interface GenerateRequest {
  title: string
  description: string
  tags: string[]
  key_points?: string[]
  custom_instructions?: string
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

    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Du bist ein Blogpost-Autor für "KOKOMO" — einen Tiny House Blog aus der Schweiz.
Die Bewohner sind Sibylle und Michi, seit September 2022 im Tiny House (Wohnwagon, Österreich).

Schreibstil:
${writingStyle}

Bildstil:
${imageStyle}

Schreibe einen vollständigen Blogpost basierend auf dem Thema. Der Post muss:
- Mindestens 500 Wörter haben
- In der Du-Form geschrieben sein
- Aus der Wir-Perspektive (Sibylle & Michi)
- ss statt ß verwenden (Schweizer Deutsch)
- Persönliche Erfahrungen einbauen
- H2-Zwischenüberschriften haben
- Kurze Absätze (2-4 Sätze)
- Ein persönliches Fazit haben

Antworte als JSON:
{
  "title": "Finaler Titel (max 60 Zeichen)",
  "summary": "SEO-Summary (160-180 Zeichen)",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "body": "Der vollständige Blogpost in Markdown (nur Body, kein Frontmatter)",
  "image_prompt": "Englischer Prompt für Header-Bild (editorial photography style)"
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
