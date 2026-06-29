import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { isAuthenticated } from '../../../lib/admin-auth'
import { getFileContent } from '../../../lib/github'
import { parseIdeasFromJsonl, buildPlan, type PublishedPost, type DraftPost } from '../../../lib/redaktionsplan'

function postDate(date: unknown): string {
  return date instanceof Date ? date.toISOString().slice(0, 10) : String(date).slice(0, 10)
}

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

    // Alle Posts laden, dann nach draft-Flag aufteilen.
    const allPosts = await getCollection('posts')
    const published: PublishedPost[] = allPosts
      .filter((p) => !p.data.draft)
      .map((p) => ({ slug: p.id, title: p.data.title, date: postDate(p.data.date) }))
    const drafts: DraftPost[] = allPosts
      .filter((p) => p.data.draft)
      .map((p) => ({ slug: p.id, title: p.data.title, date: postDate(p.data.date) }))

    const today = new Date().toISOString().slice(0, 10)
    const plan = buildPlan(ideas, published, today, drafts)

    return new Response(JSON.stringify({ plan, beadsError }), { status: 200, headers })
  } catch (err: any) {
    console.error('[admin/redaktionsplan GET]', err)
    return new Response(
      JSON.stringify({ error: 'Redaktionsplan konnte nicht geladen werden.', detail: err?.message || String(err) }),
      { status: 500, headers },
    )
  }
}
