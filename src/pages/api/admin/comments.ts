import type { APIRoute } from 'astro'
import { getAllComments, approveComment, deleteComment, createApprovedReply } from '../../../lib/turso'
import { isAuthenticated } from '../../../lib/admin-auth'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' }

  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  const comments = await getAllComments()
  return new Response(JSON.stringify({ comments }), { status: 200, headers })
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' }

  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  try {
    const { action, id, post_slug, content } = await request.json()

    if (!action || !id) {
      return new Response(JSON.stringify({ error: 'action und id sind erforderlich.' }), {
        status: 400,
        headers,
      })
    }

    switch (action) {
      case 'approve':
        await approveComment(id)
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers })

      case 'delete':
        await deleteComment(id)
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers })

      case 'reply':
        if (!content || !post_slug) {
          return new Response(
            JSON.stringify({ error: 'content und post_slug sind fuer Antworten erforderlich.' }),
            { status: 400, headers },
          )
        }
        const replyId = await createApprovedReply({
          post_slug,
          parent_id: id,
          author_name: 'Michi',
          content,
        })
        return new Response(JSON.stringify({ ok: true, replyId }), { status: 201, headers })

      default:
        return new Response(JSON.stringify({ error: `Unbekannte Aktion: ${action}` }), {
          status: 400,
          headers,
        })
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Ungültige Anfrage.' }), { status: 400, headers })
  }
}
