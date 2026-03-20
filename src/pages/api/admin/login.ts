import type { APIRoute } from 'astro'
import { hashSession, isAuthenticated } from '../../../lib/admin-auth'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  const authed = await isAuthenticated(request)
  return new Response(JSON.stringify({ ok: authed }), {
    status: authed ? 200 : 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' }

  try {
    const { email, password } = await request.json()

    const adminUser = import.meta.env.ADMIN_USER
    const adminPassword = import.meta.env.ADMIN_PASSWORD

    if (!adminUser || !adminPassword) {
      return new Response(JSON.stringify({ error: 'Admin not configured' }), {
        status: 500,
        headers,
      })
    }

    if (email !== adminUser || password !== adminPassword) {
      return new Response(JSON.stringify({ error: 'Ungültige Anmeldedaten.' }), {
        status: 401,
        headers,
      })
    }

    const sessionToken = await hashSession(adminPassword, 'kokomo-admin-salt')

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        ...headers,
        'Set-Cookie': `admin_session=${sessionToken}; HttpOnly${import.meta.env.PROD ? '; Secure' : ''}; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`,
      },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Ungültige Anfrage.' }), {
      status: 400,
      headers,
    })
  }
}
