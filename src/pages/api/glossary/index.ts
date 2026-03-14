import type { APIRoute } from 'astro'
import { getGlossaryTerms, getGlossaryByLetter, slugifyTerm } from '../../../lib/glossary'
import { trackGlossaryTerm } from '../../../lib/turso'

export const prerender = false

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=300',
}

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const letter = url.searchParams.get('letter')?.toUpperCase()
    const search = url.searchParams.get('q')?.toLowerCase().trim()
    const slug = url.searchParams.get('slug')

    let terms = getGlossaryTerms()

    // Single term by slug
    if (slug) {
      const found = terms.find((t) => slugifyTerm(t.term) === slug)
      if (!found) {
        return new Response(JSON.stringify({ error: 'Begriff nicht gefunden.' }), { status: 404, headers: corsHeaders })
      }
      trackGlossaryTerm(found.term, 'click').catch(() => {})
      return new Response(
        JSON.stringify({
          term: found.term,
          definition: found.definition,
          slug: slugifyTerm(found.term),
          url: `https://www.kokomo.house/glossar/#${slugifyTerm(found.term)}`,
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // Search
    if (search) {
      const safeSearch = search.slice(0, 100)
      terms = terms.filter(
        (t) => t.term.toLowerCase().includes(safeSearch) || t.definition.toLowerCase().includes(safeSearch)
      )
      if (safeSearch.length >= 2) {
        const matchedTerm = terms.find((t) => t.term.toLowerCase().includes(safeSearch))
        if (matchedTerm) {
          trackGlossaryTerm(matchedTerm.term, 'search').catch(() => {})
        }
      }
    }

    // Filter by letter
    if (letter && /^[A-Z]$/.test(letter)) {
      terms = terms.filter((t) => t.term.charAt(0).toUpperCase() === letter)
    }

    const result = terms.map((t) => ({
      term: t.term,
      definition: t.definition,
      slug: slugifyTerm(t.term),
      url: `https://www.kokomo.house/glossar/#${slugifyTerm(t.term)}`,
    }))

    return new Response(
      JSON.stringify({
        count: result.length,
        terms: result,
      }),
      { status: 200, headers: corsHeaders }
    )
  } catch (err: any) {
    console.error('[glossary/api]', err)
    return new Response(JSON.stringify({ error: 'Laden fehlgeschlagen.' }), { status: 500, headers: corsHeaders })
  }
}
