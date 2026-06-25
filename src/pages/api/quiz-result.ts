import type { APIRoute } from 'astro'
import { saveQuizResult, type QuizDimension } from '../../lib/turso'

export const prerender = false

const headers = { 'Content-Type': 'application/json' }

const DIMENSIONS: QuizDimension[] = ['minimalismus', 'platz', 'handwerk', 'stellplatz', 'finanzen', 'autarkie']
const VALID_VERDICTS = ['noch-nicht', 'auf-gutem-weg', 'bereit']

function isPercent(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const { overall, verdict, dimensions } = body ?? {}

    if (!isPercent(overall)) {
      return new Response(JSON.stringify({ error: 'Ungültiger Gesamtwert.' }), { status: 400, headers })
    }
    if (typeof verdict !== 'string' || !VALID_VERDICTS.includes(verdict)) {
      return new Response(JSON.stringify({ error: 'Ungültiges Verdikt.' }), { status: 400, headers })
    }
    if (!dimensions || typeof dimensions !== 'object') {
      return new Response(JSON.stringify({ error: 'Dimensionen fehlen.' }), { status: 400, headers })
    }
    const dims = {} as Record<QuizDimension, number>
    for (const d of DIMENSIONS) {
      const v = dimensions[d]
      if (!isPercent(v)) {
        return new Response(JSON.stringify({ error: `Ungültiger Wert für ${d}.` }), { status: 400, headers })
      }
      dims[d] = Math.round(v)
    }

    await saveQuizResult({ overall: Math.round(overall), verdict, dimensions: dims })
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
  } catch (err: any) {
    console.error('[quiz-result]', err)
    return new Response(JSON.stringify({ error: 'Speichern fehlgeschlagen.' }), { status: 500, headers })
  }
}
