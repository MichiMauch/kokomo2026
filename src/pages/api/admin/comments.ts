import type { APIRoute } from 'astro'
import { getAllComments, approveComment, deleteComment, createApprovedReply, getCommentById } from '../../../lib/turso'
import { isAuthenticated } from '../../../lib/admin-auth'
import { notifyCommentApproved, notifyCommentReply } from '../../../lib/notify'

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
      case 'approve': {
        const comment = await getCommentById(id)
        await approveComment(id)

        // Notify commenter that their comment was approved
        if (comment && comment.author_email) {
          notifyCommentApproved({
            postSlug: comment.post_slug,
            authorName: comment.author_name,
            authorEmail: comment.author_email,
            content: comment.content,
          }).catch((err) => console.error('[admin/comments] approval notification failed:', err))
        }

        return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
      }

      case 'delete':
        await deleteComment(id)
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers })

      case 'reply': {
        if (!content || !post_slug) {
          return new Response(
            JSON.stringify({ error: 'content und post_slug sind fuer Antworten erforderlich.' }),
            { status: 400, headers },
          )
        }
        const parentComment = await getCommentById(id)
        const replyId = await createApprovedReply({
          post_slug,
          parent_id: id,
          author_name: 'Michi',
          content,
        })

        // Notify original commenter about the reply
        if (parentComment && parentComment.author_email) {
          notifyCommentReply({
            postSlug: post_slug,
            originalAuthorName: parentComment.author_name,
            originalAuthorEmail: parentComment.author_email,
            originalContent: parentComment.content,
            replyAuthorName: 'Michi',
            replyContent: content,
          }).catch((err) => console.error('[admin/comments] reply notification failed:', err))
        }

        return new Response(JSON.stringify({ ok: true, replyId }), { status: 201, headers })
      }

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
