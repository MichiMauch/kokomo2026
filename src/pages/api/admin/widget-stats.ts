import type { APIRoute } from 'astro'
import { getWidgetLoadStats } from '../../../lib/turso'

export const prerender = false

export const GET: APIRoute = async () => {
  const headers = { 'Content-Type': 'application/json' }

  try {
    const stats = await getWidgetLoadStats()
    const totalLoads = stats.reduce((sum, s) => sum + s.loads, 0)
    return new Response(
      JSON.stringify({ total_loads: totalLoads, domains: stats }),
      { status: 200, headers }
    )
  } catch (err: any) {
    console.error('[admin/widget-stats]', err)
    return new Response(JSON.stringify({ error: 'Laden fehlgeschlagen.' }), { status: 500, headers })
  }
}
