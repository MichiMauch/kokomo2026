import type { APIRoute } from 'astro'
import { isAuthenticated } from '../../../lib/admin-auth'
import { getSetting } from '../../../lib/turso'
import OpenAI from 'openai'

const DEFAULT_GENERATOR_PROMPT = `Du bist ein Newsletter-Betreff-Generator für "KOKOMO" — einen Tiny House Blog aus der Schweiz.
Die Bewohner sind Sibylle und Michi, die seit September 2022 in ihrem Tiny House leben.

Deine Aufgabe: Generiere genau 10 Newsletter-Betreffzeilen basierend auf den Inhalten.
Markiere die besten 3 als Top-Vorschläge.

Regeln:
- Maximal 60 Zeichen pro Betreffzeile
- Persoenlich und authentisch, kein Clickbait
- Macht neugierig und animiert zum Oeffnen
- Verwende "ss" statt "ß"
- Deutsch (Schweizer Stil)`

const DEFAULT_REVIEWER_PROMPT = `Du bist ein erfahrener Newsletter-Redakteur für "KOKOMO" — einen Tiny House Blog aus der Schweiz.

Du erhältst 10 Betreffzeilen-Vorschläge, davon 3 als Top-Vorschläge markiert.
Wähle die beste Betreffzeile aus oder formuliere eine noch bessere basierend auf den Vorschlägen.

Kriterien:
- Maximal 60 Zeichen
- Hohe Oeffnungsrate
- Authentisch, nicht reisserisch
- Verwende "ss" statt "ß"`

// JSON format instructions — always appended automatically so user prompts don't need them
const JSON_FORMAT_GENERATOR = `\n\nAntworte ausschliesslich als JSON in diesem Format:\n{ "subjects": [{ "text": "Betreffzeile", "top3": true }, ...] }`
const JSON_FORMAT_REVIEWER = `\n\nAntworte ausschliesslich als JSON in diesem Format:\n{ "subject": "Die finale Betreffzeile" }`

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

    const { blocks, posts } = await request.json()

    if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
      return new Response(JSON.stringify({ error: 'Keine Blöcke vorhanden.' }), { status: 400, headers })
    }

    // Build a summary of newsletter contents
    const contentParts: string[] = []
    for (const block of blocks) {
      if (block.type === 'text' && block.content) {
        contentParts.push(`Freitext: ${block.content}`)
      }
      if ((block.type === 'hero' || block.type === 'article') && block.slug) {
        const post = posts?.[block.slug]
        if (post) {
          contentParts.push(`Artikel: "${post.title}" — ${post.summary}`)
        }
      }
      if (block.type === 'two-column') {
        for (const slug of [block.slugLeft, block.slugRight]) {
          if (slug) {
            const post = posts?.[slug]
            if (post) {
              contentParts.push(`Artikel: "${post.title}" — ${post.summary}`)
            }
          }
        }
      }
    }

    const contentSummary = contentParts.join('\n')
    const openai = new OpenAI({ apiKey })

    // ── Step 1: Generator ──────────────────────────────────────────
    const customGeneratorPrompt = await getSetting('subject_prompt_generator')
    const generatorPrompt = (customGeneratorPrompt || DEFAULT_GENERATOR_PROMPT)
      .replace(/\{\{content\}\}/g, contentSummary) + JSON_FORMAT_GENERATOR

    console.log('[suggest-subject] Step 1: Generator')
    const generatorCompletion = await openai.chat.completions.create({
      model: 'gpt-5.2',
      temperature: 0.9,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: generatorPrompt },
        { role: 'user', content: `Newsletter-Inhalte:\n${contentSummary}` },
      ],
    })

    const generatorContent = generatorCompletion.choices[0]?.message?.content
    if (!generatorContent) {
      return new Response(JSON.stringify({ error: 'Keine Antwort vom Generator.' }), { status: 500, headers })
    }

    const generatorResult = JSON.parse(generatorContent)
    console.log('[suggest-subject] Generator result:', generatorResult)

    // ── Step 2: Reviewer ───────────────────────────────────────────
    const customReviewerPrompt = await getSetting('subject_prompt_reviewer')
    const reviewerPrompt = (customReviewerPrompt || DEFAULT_REVIEWER_PROMPT)
      .replace(/\{\{content\}\}/g, contentSummary) + JSON_FORMAT_REVIEWER

    console.log('[suggest-subject] Step 2: Reviewer')
    const reviewerCompletion = await openai.chat.completions.create({
      model: 'gpt-5.2',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: reviewerPrompt },
        { role: 'user', content: JSON.stringify(generatorResult) },
      ],
    })

    const reviewerContent = reviewerCompletion.choices[0]?.message?.content
    if (!reviewerContent) {
      return new Response(JSON.stringify({ error: 'Keine Antwort vom Reviewer.' }), { status: 500, headers })
    }

    const result = JSON.parse(reviewerContent)
    console.log('[suggest-subject] Reviewer result:', result)

    return new Response(JSON.stringify(result), { status: 200, headers })
  } catch (err: any) {
    console.error('[admin/suggest-subject]', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Betreffzeile konnte nicht generiert werden.' }),
      { status: 500, headers },
    )
  }
}
