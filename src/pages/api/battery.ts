import type { APIRoute } from 'astro'
import { getBatteryCharge } from '../../lib/victron'

export const prerender = false

export const GET: APIRoute = async () => {
  try {
    const charge = await getBatteryCharge()
    return new Response(JSON.stringify({ charge }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    })
  } catch (err) {
    console.error('[battery]', err)
    return new Response(JSON.stringify({ error: 'Failed to fetch battery data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
