import type { APIRoute } from 'astro'
import { isAuthenticated } from '../../../lib/admin-auth'
import { getGlossaryStats, setGlossaryBoost } from '../../../lib/turso'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' }

  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  try {
    const stats = await getGlossaryStats()
    return new Response(JSON.stringify(stats), { status: 200, headers })
  } catch (err: any) {
    console.error('[admin/glossary-stats]', err)
    return new Response(JSON.stringify({ error: 'Laden fehlgeschlagen.' }), { status: 500, headers })
  }
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' }

  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  try {
    const { term, boost } = await request.json()

    if (!term || typeof term !== 'string' || !term.trim()) {
      return new Response(JSON.stringify({ error: 'Term darf nicht leer sein.' }), { status: 400, headers })
    }

    if (typeof boost !== 'number' || !Number.isInteger(boost)) {
      return new Response(JSON.stringify({ error: 'Boost muss eine ganze Zahl sein.' }), { status: 400, headers })
    }

    await setGlossaryBoost(term.trim(), boost)
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
  } catch (err: any) {
    console.error('[admin/glossary-stats]', err)
    return new Response(JSON.stringify({ error: 'Speichern fehlgeschlagen.' }), { status: 500, headers })
  }
}
