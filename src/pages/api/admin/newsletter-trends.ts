import type { APIRoute } from 'astro'
import { isAuthenticated } from '../../../lib/admin-auth'
import { getNewsletterTrends, getSubscriberGrowth } from '../../../lib/newsletter'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' }

  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  try {
    const [trends, subscriberGrowth] = await Promise.all([
      getNewsletterTrends(),
      getSubscriberGrowth(),
    ])

    return new Response(JSON.stringify({ trends, subscriberGrowth }), { status: 200, headers })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}
