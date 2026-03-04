import type { APIRoute } from 'astro'
import { getCommentsBySlug } from '../../../lib/turso'

export const prerender = false

export const GET: APIRoute = async ({ params }) => {
  const headers = { 'Content-Type': 'application/json' }

  try {
    const slug = params.slug
    if (!slug) {
      return new Response(JSON.stringify({ error: 'Slug fehlt.' }), {
        status: 400,
        headers,
      })
    }

    const comments = await getCommentsBySlug(slug)

    return new Response(JSON.stringify({ comments }), {
      status: 200,
      headers: {
        ...headers,
        'Cache-Control': 'public, max-age=60',
      },
    })
  } catch (err) {
    console.error('[comments/GET]', err)
    return new Response(JSON.stringify({ error: 'Kommentare konnten nicht geladen werden.' }), {
      status: 500,
      headers,
    })
  }
}
