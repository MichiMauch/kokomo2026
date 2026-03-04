import type { APIRoute } from 'astro'
import { createComment, approveComment, createApprovedReply } from '../../lib/turso'
import { moderateComment } from '../../lib/openai'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' }

  try {
    const body = await request.json()
    const { post_slug, parent_id, author_name, author_email, content, website } = body

    // Honeypot: if the hidden website field is filled, it's a bot
    if (website) {
      return new Response(
        JSON.stringify({ message: 'Danke! Dein Kommentar wird nach Prüfung angezeigt.' }),
        { status: 200, headers },
      )
    }

    // Validation
    if (!post_slug || typeof post_slug !== 'string') {
      return new Response(JSON.stringify({ error: 'Ungültiger Beitrag.' }), {
        status: 400,
        headers,
      })
    }

    if (!author_name || typeof author_name !== 'string' || author_name.trim().length < 2) {
      return new Response(JSON.stringify({ error: 'Name muss mindestens 2 Zeichen haben.' }), {
        status: 400,
        headers,
      })
    }

    if (!author_email || typeof author_email !== 'string' || !author_email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Bitte gib eine gültige E-Mail-Adresse ein.' }), {
        status: 400,
        headers,
      })
    }

    if (!content || typeof content !== 'string' || content.trim().length < 3 || content.trim().length > 5000) {
      return new Response(
        JSON.stringify({ error: 'Kommentar muss zwischen 3 und 5000 Zeichen lang sein.' }),
        { status: 400, headers },
      )
    }

    const trimmedContent = content.trim()
    const trimmedSlug = post_slug.trim()

    const id = await createComment({
      post_slug: trimmedSlug,
      parent_id: parent_id ? Number(parent_id) : null,
      author_name: author_name.trim(),
      author_email: author_email.trim(),
      content: trimmedContent,
    })

    // AI moderation
    let autoApproved = false
    try {
      const moderation = await moderateComment(trimmedContent, trimmedSlug)
      console.log('[comments/POST] AI moderation:', { id, ...moderation })

      if (moderation.approved) {
        await approveComment(id)
        autoApproved = true

        if (moderation.reply) {
          await createApprovedReply({
            post_slug: trimmedSlug,
            parent_id: id,
            author_name: 'Kokomo',
            content: moderation.reply,
          })
        }
      }
    } catch (err) {
      console.error('[comments/POST] AI moderation failed, manual review needed:', err)
    }

    return new Response(
      JSON.stringify({
        message: autoApproved
          ? 'Danke! Dein Kommentar wurde veröffentlicht. Beste Grüsse, KOKOMO.'
          : 'Danke! Dein Kommentar wird nach Prüfung angezeigt. Beste Grüsse, KOKOMO.',
        autoApproved,
        id,
      }),
      { status: 201, headers },
    )
  } catch (err) {
    console.error('[comments/POST]', err)
    return new Response(
      JSON.stringify({ error: 'Kommentar konnte nicht gespeichert werden.' }),
      { status: 500, headers },
    )
  }
}
