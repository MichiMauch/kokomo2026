import type { APIRoute } from 'astro'

export const prerender = false

async function hashSession(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + salt)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
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
        'Set-Cookie': `admin_session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`,
      },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Ungültige Anfrage.' }), {
      status: 400,
      headers,
    })
  }
}
