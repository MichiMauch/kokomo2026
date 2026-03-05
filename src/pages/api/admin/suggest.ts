import type { APIRoute } from 'astro'
import { isAuthenticated } from '../../../lib/admin-auth'
import { listPostFiles, getFileContent } from '../../../lib/github'
import OpenAI from 'openai'
import matter from 'gray-matter'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' }

  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  try {
    const apiKey = import.meta.env.OPENAI_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY nicht konfiguriert.' }), { status: 500, headers })
    }

    // Load existing posts via GitHub API
    const postFiles = await listPostFiles()

    // Load up to 30 recent posts for context
    const recentFiles = postFiles.slice(-30)
    const postSummaries: string[] = []

    for (const file of recentFiles) {
      try {
        const content = await getFileContent(`src/content/posts/${file}`)
        const { data } = matter(content)
        postSummaries.push(`- "${data.title}" (${data.date}) [${(data.tags || []).join(', ')}]`)
      } catch {
        // skip unreadable files
      }
    }

    // Load writing style
    let writingStyle = ''
    try {
      writingStyle = await getFileContent('content-config/writing-style.yaml')
    } catch {
      writingStyle = 'language: de-CH, tone: authentisch und persönlich'
    }

    const today = new Date().toISOString().split('T')[0]

    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: 'gpt-5.2',
      temperature: 0.9,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Du bist ein Blog-Stratege für "KOKOMO" — einen Tiny House Blog aus der Schweiz.
Die Bewohner sind Sibylle und Michi, sie leben seit September 2022 in ihrem Tiny House (Wohnwagon aus Österreich).

Schreibstil-Regeln:
${writingStyle}

Bereits veröffentlichte Posts:
${postSummaries.join('\n')}

Heutiges Datum: ${today}

Schlage 5 neue Blog-Themen vor, die:
- NICHT bereits behandelt wurden
- zum aktuellen Monat/Saison passen
- SEO-Potenzial haben
- authentisch und persönlich sind

Antworte als JSON:
{
  "suggestions": [
    {
      "title": "Titel (max 60 Zeichen)",
      "description": "Kurzbeschreibung was der Post behandeln soll (2-3 Sätze)",
      "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
      "timing": "Warum jetzt? (1 Satz)",
      "seo_keywords": ["keyword1", "keyword2", "keyword3"],
      "key_points": ["Punkt 1", "Punkt 2", "Punkt 3"]
    }
  ]
}`,
        },
        {
          role: 'user',
          content: 'Schlage 5 neue Blog-Themen vor.',
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
    console.error('[admin/suggest]', err)
    return new Response(JSON.stringify({ error: err.message || 'Vorschläge konnten nicht generiert werden.' }), {
      status: 500,
      headers,
    })
  }
}
