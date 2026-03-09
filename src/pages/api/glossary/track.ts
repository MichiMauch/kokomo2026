import type { APIRoute } from 'astro'
import { trackGlossaryTerm } from '../../../lib/turso'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' }

  try {
    const { term, type } = await request.json()

    if (!term || typeof term !== 'string' || !term.trim()) {
      return new Response(JSON.stringify({ error: 'Term darf nicht leer sein.' }), { status: 400, headers })
    }

    if (type !== 'click' && type !== 'search') {
      return new Response(JSON.stringify({ error: 'Type muss "click" oder "search" sein.' }), { status: 400, headers })
    }

    await trackGlossaryTerm(term.trim(), type)
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
  } catch (err: any) {
    console.error('[glossary/track]', err)
    return new Response(JSON.stringify({ error: 'Tracking fehlgeschlagen.' }), { status: 500, headers })
  }
}
