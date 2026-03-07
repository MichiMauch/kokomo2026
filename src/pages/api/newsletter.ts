import type { APIRoute } from 'astro'
import { createSubscriber } from '../../lib/newsletter'
import { sendConfirmationEmail } from '../../lib/notify'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' }

  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Ungültige E-Mail-Adresse.' }), {
        status: 400,
        headers,
      })
    }

    const normalized = email.toLowerCase().trim()
    const result = await createSubscriber(normalized)

    if (result.alreadyConfirmed) {
      // Same success message to prevent email enumeration
      return new Response(
        JSON.stringify({ message: 'Fast geschafft! Bitte bestätige deine Anmeldung per E-Mail.' }),
        { status: 200, headers },
      )
    }

    sendConfirmationEmail({ email: normalized, token: result.token }).catch((err) =>
      console.error('[newsletter] confirmation email failed:', err),
    )

    return new Response(
      JSON.stringify({ message: 'Fast geschafft! Bitte bestätige deine Anmeldung per E-Mail.' }),
      { status: 200, headers },
    )
  } catch (err) {
    console.error('[newsletter POST]', err)
    return new Response(JSON.stringify({ error: 'Ein unerwarteter Fehler ist aufgetreten.' }), {
      status: 500,
      headers,
    })
  }
}
