import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { isAuthenticated } from '../../../lib/admin-auth'
import { getFileContent } from '../../../lib/github'
import { parseIdeasFromJsonl, buildPlan, type PublishedPost } from '../../../lib/redaktionsplan'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' }

  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  try {
    // Ideen aus dem committeten bd-Export (1 GitHub-Call) — bd bleibt die Quelle.
    let ideas: ReturnType<typeof parseIdeasFromJsonl> = []
    let beadsError: string | undefined
    try {
      const jsonl = await getFileContent('.beads/issues.jsonl')
      ideas = parseIdeasFromJsonl(jsonl)
    } catch (err: any) {
      beadsError = err?.message || String(err)
    }

    // Publizierte Posts aus der Content-Collection (kein Datums-Filter nötig: nur draft=false).
    const posts = await getCollection('posts', ({ data }) => !data.draft)
    const published: PublishedPost[] = posts.map((p) => ({
      slug: p.id,
      title: p.data.title,
      date:
        p.data.date instanceof Date
          ? p.data.date.toISOString().slice(0, 10)
          : String(p.data.date).slice(0, 10),
    }))

    const today = new Date().toISOString().slice(0, 10)
    const plan = buildPlan(ideas, published, today)

    return new Response(JSON.stringify({ plan, beadsError }), { status: 200, headers })
  } catch (err: any) {
    console.error('[admin/redaktionsplan GET]', err)
    return new Response(
      JSON.stringify({ error: 'Redaktionsplan konnte nicht geladen werden.', detail: err?.message || String(err) }),
      { status: 500, headers },
    )
  }
}
