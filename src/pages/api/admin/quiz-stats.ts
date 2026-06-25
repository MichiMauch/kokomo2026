import type { APIRoute } from 'astro'
import { isAuthenticated } from '../../../lib/admin-auth'
import { getQuizStats } from '../../../lib/turso'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' }

  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  try {
    const stats = await getQuizStats()
    return new Response(JSON.stringify(stats), { status: 200, headers })
  } catch (err: any) {
    console.error('[admin/quiz-stats]', err)
    return new Response(JSON.stringify({ error: 'Laden fehlgeschlagen.' }), { status: 500, headers })
  }
}
