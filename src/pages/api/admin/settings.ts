import type { APIRoute } from 'astro'
import { isAuthenticated } from '../../../lib/admin-auth'
import { getSetting, setSetting } from '../../../lib/turso'

export const prerender = false

const ALLOWED_KEYS = ['subject_prompt_generator', 'subject_prompt_reviewer']

export const GET: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' }

  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  const url = new URL(request.url)
  const key = url.searchParams.get('key')

  if (!key || !ALLOWED_KEYS.includes(key)) {
    return new Response(JSON.stringify({ error: 'Ungültiger Key.' }), { status: 400, headers })
  }

  const value = await getSetting(key)
  return new Response(JSON.stringify({ key, value }), { status: 200, headers })
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' }

  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  try {
    const { key, value } = await request.json()

    if (!key || !ALLOWED_KEYS.includes(key)) {
      return new Response(JSON.stringify({ error: 'Ungültiger Key.' }), { status: 400, headers })
    }

    if (typeof value !== 'string') {
      return new Response(JSON.stringify({ error: 'Value muss ein String sein.' }), { status: 400, headers })
    }

    await setSetting(key, value)
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
  } catch (err: any) {
    console.error('[admin/settings]', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Speichern fehlgeschlagen.' }),
      { status: 500, headers },
    )
  }
}
