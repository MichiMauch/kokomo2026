import type { APIRoute } from 'astro'
import { trackGlossaryTerm } from '../../../lib/turso'

export const prerender = false

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export const POST: APIRoute = async ({ request }) => {
  const headers = corsHeaders

  try {
    const { term, type } = await request.json()

    if (!term || typeof term !== 'string' || !term.trim()) {
      return new Response(JSON.stringify({ error: 'Term darf nicht leer sein.' }), { status: 400, headers })
    }

    if (term.length > 100) {
      return new Response(JSON.stringify({ error: 'Term zu lang (max 100 Zeichen).' }), { status: 400, headers })
    }

    if (type !== 'click' && type !== 'search' && type !== 'hover') {
      return new Response(JSON.stringify({ error: 'Type muss "click", "search" oder "hover" sein.' }), { status: 400, headers })
    }

    await trackGlossaryTerm(term.trim(), type)
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
  } catch (err: any) {
    console.error('[glossary/track]', err)
    return new Response(JSON.stringify({ error: 'Tracking fehlgeschlagen.' }), { status: 500, headers })
  }
}
