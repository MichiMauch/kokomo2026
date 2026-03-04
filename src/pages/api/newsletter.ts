import type { APIRoute } from 'astro'
import { createHash } from 'crypto'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' }

  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: 'E-Mail-Adresse ist erforderlich.' }), {
        status: 400,
        headers,
      })
    }

    const MAILCHIMP_API_KEY = import.meta.env.MAILCHIMP_API_KEY
    const MAILCHIMP_API_SERVER = import.meta.env.MAILCHIMP_API_SERVER
    const MAILCHIMP_AUDIENCE_ID = import.meta.env.MAILCHIMP_AUDIENCE_ID

    if (!MAILCHIMP_API_KEY || !MAILCHIMP_API_SERVER || !MAILCHIMP_AUDIENCE_ID) {
      return new Response(
        JSON.stringify({ error: 'Newsletter-Service ist nicht konfiguriert.' }),
        { status: 500, headers },
      )
    }

    const emailHash = createHash('md5').update(email.toLowerCase()).digest('hex')
    const url = `https://${MAILCHIMP_API_SERVER}/3.0/lists/${MAILCHIMP_AUDIENCE_ID}/members/${emailHash}`

    // Check if already subscribed
    const checkRes = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `apikey ${MAILCHIMP_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    if (checkRes.ok) {
      const existing = await checkRes.json()
      if (existing.status === 'subscribed') {
        return new Response(
          JSON.stringify({ error: 'Diese E-Mail-Adresse ist bereits angemeldet.' }),
          { status: 400, headers },
        )
      }
    }

    // Upsert with pending status (double opt-in)
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `apikey ${MAILCHIMP_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_address: email,
        status_if_new: 'pending',
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      return new Response(
        JSON.stringify({ error: data.detail || 'Anmeldung fehlgeschlagen.' }),
        { status: res.status, headers },
      )
    }

    return new Response(
      JSON.stringify({
        message: 'Fast geschafft! Bitte bestätige deine Anmeldung per E-Mail.',
      }),
      { status: 200, headers },
    )
  } catch (err) {
    console.error('[newsletter]', err)
    return new Response(
      JSON.stringify({ error: 'Ein unerwarteter Fehler ist aufgetreten.' }),
      { status: 500, headers },
    )
  }
}
