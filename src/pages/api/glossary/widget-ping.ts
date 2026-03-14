import type { APIRoute } from 'astro'
import { trackWidgetLoad } from '../../../lib/turso'

export const prerender = false

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { domain, url } = await request.json()

    if (!domain || typeof domain !== 'string') {
      return new Response(JSON.stringify({ error: 'Domain fehlt.' }), { status: 400, headers: corsHeaders })
    }

    if (domain.length > 253) {
      return new Response(JSON.stringify({ error: 'Domain zu lang.' }), { status: 400, headers: corsHeaders })
    }

    if (url && (typeof url !== 'string' || url.length > 2048)) {
      return new Response(JSON.stringify({ error: 'URL ungültig oder zu lang.' }), { status: 400, headers: corsHeaders })
    }

    // Eigene Domain nicht tracken
    if (domain === 'www.kokomo.house' || domain === 'kokomo.house') {
      return new Response(JSON.stringify({ ok: true, tracked: false }), { status: 200, headers: corsHeaders })
    }

    await trackWidgetLoad(domain.trim(), url?.trim())
    return new Response(JSON.stringify({ ok: true, tracked: true }), { status: 200, headers: corsHeaders })
  } catch (err: any) {
    console.error('[glossary/widget-ping]', err)
    return new Response(JSON.stringify({ error: 'Tracking fehlgeschlagen.' }), { status: 500, headers: corsHeaders })
  }
}
