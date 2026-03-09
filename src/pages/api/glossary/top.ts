import type { APIRoute } from 'astro'
import { getTopGlossaryTerms } from '../../../lib/turso'

export const prerender = false

export const GET: APIRoute = async () => {
  const headers = { 'Content-Type': 'application/json' }

  try {
    const terms = await getTopGlossaryTerms(10)
    return new Response(JSON.stringify(terms), { status: 200, headers })
  } catch (err: any) {
    console.error('[glossary/top]', err)
    return new Response(JSON.stringify({ error: 'Laden fehlgeschlagen.' }), { status: 500, headers })
  }
}
