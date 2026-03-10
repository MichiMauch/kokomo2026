import type { APIRoute } from 'astro'
import { isAuthenticated } from '../../../lib/admin-auth'
import {
  getAllSubscribers,
  getConfirmedSubscribers,
  getNewsletterSends,
  getNewsletterSendsWithStats,
  recordNewsletterSend,
  recordNewsletterRecipientsBatch,
  getRecipientsForSend,
  getFailedRecipientsForSend,
  updateRecipientResendId,
  getSendForRetry,
  getLinkClicksForSend,
  getOverallNewsletterStats,
  deleteSubscriber,
} from '../../../lib/newsletter'
import { sendNewsletterEmail, sendMultiBlockNewsletterEmail } from '../../../lib/notify'
import { getCollection } from 'astro:content'
import type { NewsletterBlock, PostRef } from '../../../lib/newsletter-blocks'

export const prerender = false

function getFirstImage(images: string | string[] | undefined): string | null {
  if (!images) return null
  if (Array.isArray(images)) return images[0] ?? null
  return images
}

export const GET: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' }

  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  try {
    const url = new URL(request.url)
    const includePosts = url.searchParams.get('posts') === '1'
    const includeStats = url.searchParams.get('stats') === '1'
    const sendDetailId = url.searchParams.get('sendDetail')

    // If requesting detail for a specific send
    if (sendDetailId) {
      const id = parseInt(sendDetailId, 10)
      if (isNaN(id)) {
        return new Response(JSON.stringify({ error: 'Ungültige sendDetail ID.' }), { status: 400, headers })
      }
      const [recipients, linkClicks] = await Promise.all([
        getRecipientsForSend(id),
        getLinkClicksForSend(id),
      ])
      return new Response(
        JSON.stringify({ sendDetail: { recipients, linkClicks } }),
        { status: 200, headers },
      )
    }

    const [subscribers, sends] = await Promise.all([
      getAllSubscribers(),
      includeStats ? getNewsletterSendsWithStats() : getNewsletterSends(),
    ])

    let posts: any[] = []
    if (includePosts) {
      const allPosts = await getCollection('posts')
      posts = allPosts
        .filter((p) => !p.data.draft)
        .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
        .map((p) => ({
          slug: p.id,
          title: p.data.title,
          summary: p.data.summary || '',
          image: getFirstImage(p.data.images),
          date: p.data.date.toISOString().split('T')[0],
        }))
    }

    const response: any = { subscribers, sends, posts }
    if (includeStats) {
      response.overallStats = await getOverallNewsletterStats()
    }

    return new Response(JSON.stringify(response), { status: 200, headers })
  } catch (err: any) {
    console.error('[admin/newsletter GET]', err)
    return new Response(
      JSON.stringify({ error: 'Daten konnten nicht geladen werden.', detail: err?.message }),
      { status: 500, headers },
    )
  }
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' }

  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  try {
    const body = await request.json()
    const { action, postSlug, subject, subscriberId, blocks, testEmail } = body

    // ─── Test send ───
    if (action === 'test-send') {
      if (!subject || !blocks || !Array.isArray(blocks) || blocks.length === 0) {
        return new Response(JSON.stringify({ error: 'subject und blocks sind erforderlich.' }), { status: 400, headers })
      }
      if (!testEmail || typeof testEmail !== 'string') {
        return new Response(JSON.stringify({ error: 'testEmail ist erforderlich.' }), { status: 400, headers })
      }

      const typedBlocks = blocks as NewsletterBlock[]
      const slugs = new Set<string>()
      for (const block of typedBlocks) {
        if (block.type === 'hero' || block.type === 'article') slugs.add(block.slug)
        if (block.type === 'two-column') { slugs.add(block.slugLeft); slugs.add(block.slugRight) }
      }

      const allPosts = await getCollection('posts')
      const postsMap: Record<string, PostRef> = {}
      for (const slug of slugs) {
        const post = allPosts.find((p) => p.id === slug || p.id.replace(/\.md$/, '') === slug)
        if (!post) {
          return new Response(JSON.stringify({ error: `Blogpost "${slug}" nicht gefunden.` }), { status: 404, headers })
        }
        postsMap[slug] = {
          slug: post.id, title: post.data.title, summary: post.data.summary ?? '',
          image: getFirstImage(post.data.images), date: post.data.date.toISOString().split('T')[0],
        }
      }

      try {
        await sendMultiBlockNewsletterEmail({
          email: testEmail,
          unsubscribeToken: 'test',
          subject: `[TEST] ${subject}`,
          blocks: typedBlocks,
          postsMap,
        })
      } catch (err: any) {
        console.error('[admin/newsletter test-send]', err)
        return new Response(
          JSON.stringify({ error: `Testversand fehlgeschlagen: ${err?.message || 'Unbekannter Fehler'}` }),
          { status: 500, headers },
        )
      }

      return new Response(JSON.stringify({ ok: true, sent: 1, testEmail }), { status: 200, headers })
    }

    // ─── Retry failed recipients for a send ───
    if (action === 'retry-failed') {
      const { sendId } = body
      if (!sendId) {
        return new Response(JSON.stringify({ error: 'sendId ist erforderlich.' }), { status: 400, headers })
      }

      const sendData = await getSendForRetry(sendId)
      if (!sendData) {
        return new Response(JSON.stringify({ error: 'Keine Blocks für diesen Versand gespeichert.' }), { status: 400, headers })
      }

      const failedRecipients = await getFailedRecipientsForSend(sendId)
      if (failedRecipients.length === 0) {
        return new Response(JSON.stringify({ ok: true, sent: 0, message: 'Keine fehlgeschlagenen Empfänger gefunden.' }), { status: 200, headers })
      }

      const retrySubject = sendData.subject
      const typedBlocks = JSON.parse(sendData.blocks_json) as NewsletterBlock[]
      const slugs = new Set<string>()
      for (const block of typedBlocks) {
        if (block.type === 'hero' || block.type === 'article') slugs.add(block.slug)
        if (block.type === 'two-column') { slugs.add(block.slugLeft); slugs.add(block.slugRight) }
      }

      const allPosts = await getCollection('posts')
      const postsMap: Record<string, PostRef> = {}
      for (const slug of slugs) {
        const post = allPosts.find((p) => p.id === slug || p.id.replace(/\.md$/, '') === slug)
        if (post) {
          postsMap[slug] = {
            slug: post.id, title: post.data.title, summary: post.data.summary ?? '',
            image: getFirstImage(post.data.images), date: post.data.date.toISOString().split('T')[0],
          }
        }
      }

      const SEND_DELAY_MS = 1500
      const MAX_RETRIES = 2
      let retrySent = 0

      for (let i = 0; i < failedRecipients.length; i++) {
        const sub = failedRecipients[i]
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            const result = await sendMultiBlockNewsletterEmail({
              email: sub.email,
              unsubscribeToken: sub.token,
              subject: retrySubject,
              blocks: typedBlocks,
              postsMap,
            })
            await updateRecipientResendId(sendId, sub.email, result.resendEmailId ?? '')
            retrySent++
            break
          } catch (err: any) {
            const isRateLimit = err?.statusCode === 429 || err?.message?.includes('rate')
            if (isRateLimit && attempt < MAX_RETRIES) {
              await new Promise((resolve) => setTimeout(resolve, 3000 * (attempt + 1)))
            } else {
              console.error(`[newsletter retry] Failed to send to ${sub.email}:`, err?.message)
              break
            }
          }
        }
        if (i < failedRecipients.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS))
        }
      }

      return new Response(
        JSON.stringify({ ok: true, sent: retrySent, total: failedRecipients.length }),
        { status: 200, headers },
      )
    }

    if (action === 'delete') {
      if (!subscriberId || typeof subscriberId !== 'number' || !Number.isInteger(subscriberId)) {
        return new Response(JSON.stringify({ error: 'Ungültige subscriberId.' }), { status: 400, headers })
      }
      await deleteSubscriber(subscriberId)
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
    }

    if (action !== 'send' || !subject) {
      return new Response(
        JSON.stringify({ error: 'action=send und subject sind erforderlich.' }),
        { status: 400, headers },
      )
    }

    const subscribers = await getConfirmedSubscribers()
    if (subscribers.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Keine bestätigten Abonnenten vorhanden.' }),
        { status: 400, headers },
      )
    }

    const SEND_DELAY_MS = 1500 // 1.5s between emails to avoid Resend rate limits
    const MAX_RETRIES = 2
    let successCount = 0
    const sentRecipients: { email: string; resendEmailId: string | null }[] = []

    // ─── Multi-Block path ───
    if (blocks && Array.isArray(blocks) && blocks.length > 0) {
      const typedBlocks = blocks as NewsletterBlock[]

      // Collect all slugs from blocks
      const slugs = new Set<string>()
      for (const block of typedBlocks) {
        if (block.type === 'hero' || block.type === 'article') slugs.add(block.slug)
        if (block.type === 'two-column') {
          slugs.add(block.slugLeft)
          slugs.add(block.slugRight)
        }
      }

      // Resolve posts
      const allPosts = await getCollection('posts')
      const postsMap: Record<string, PostRef> = {}
      for (const slug of slugs) {
        const post = allPosts.find((p) => p.id === slug || p.id.replace(/\.md$/, '') === slug)
        if (!post) {
          return new Response(
            JSON.stringify({ error: `Blogpost "${slug}" nicht gefunden.` }),
            { status: 404, headers },
          )
        }
        postsMap[slug] = {
          slug: post.id,
          title: post.data.title,
          summary: post.data.summary ?? '',
          image: getFirstImage(post.data.images),
          date: post.data.date.toISOString().split('T')[0],
        }
      }

      for (let i = 0; i < subscribers.length; i++) {
        const sub = subscribers[i]
        let sent = false
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            const result = await sendMultiBlockNewsletterEmail({
              email: sub.email,
              unsubscribeToken: sub.token,
              subject,
              blocks: typedBlocks,
              postsMap,
            })
            successCount++
            sentRecipients.push({ email: sub.email, resendEmailId: result.resendEmailId })
            sent = true
            break
          } catch (err: any) {
            const isRateLimit = err?.statusCode === 429 || err?.message?.includes('rate')
            if (isRateLimit && attempt < MAX_RETRIES) {
              await new Promise((resolve) => setTimeout(resolve, 3000 * (attempt + 1)))
            } else {
              console.error(`[newsletter] Failed to send to ${sub.email}:`, err?.message)
              break
            }
          }
        }
        if (i < subscribers.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS))
        }
      }

      // Use first post slug for record, or 'multi-block'
      const firstSlug = slugs.size > 0 ? [...slugs][0] : 'multi-block'
      const firstPost = postsMap[firstSlug]
      const sendId = await recordNewsletterSend({
        post_slug: firstSlug,
        post_title: firstPost?.title ?? subject,
        subject,
        recipient_count: successCount,
        blocks_json: JSON.stringify(typedBlocks),
      })

      // Record recipients with resend email IDs
      await recordNewsletterRecipientsBatch(
        sentRecipients.map((r) => ({ send_id: sendId, email: r.email, resend_email_id: r.resendEmailId })),
      )

      return new Response(
        JSON.stringify({ ok: true, sent: successCount, total: subscribers.length }),
        { status: 200, headers },
      )
    }

    // ─── Legacy single-post path ───
    if (!postSlug) {
      return new Response(
        JSON.stringify({ error: 'postSlug oder blocks sind erforderlich.' }),
        { status: 400, headers },
      )
    }

    const allPosts = await getCollection('posts')
    const post = allPosts.find((p) => p.id === postSlug || p.id.replace(/\.md$/, '') === postSlug)
    if (!post) {
      return new Response(JSON.stringify({ error: 'Blogpost nicht gefunden.' }), {
        status: 404,
        headers,
      })
    }

    for (let i = 0; i < subscribers.length; i++) {
      const sub = subscribers[i]
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const result = await sendNewsletterEmail({
            email: sub.email,
            unsubscribeToken: sub.token,
            postTitle: post.data.title,
            postSlug: post.id,
            postImage: getFirstImage(post.data.images),
            postSummary: post.data.summary ?? '',
            postDate: post.data.date.toISOString().split('T')[0],
          })
          successCount++
          sentRecipients.push({ email: sub.email, resendEmailId: result.resendEmailId })
          break
        } catch (err: any) {
          const isRateLimit = err?.statusCode === 429 || err?.message?.includes('rate')
          if (isRateLimit && attempt < MAX_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, 3000 * (attempt + 1)))
          } else {
            console.error(`[newsletter] Failed to send to ${sub.email}:`, err?.message)
            break
          }
        }
      }
      if (i < subscribers.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS))
      }
    }

    const sendId = await recordNewsletterSend({
      post_slug: post.id,
      post_title: post.data.title,
      subject,
      recipient_count: successCount,
      blocks_json: JSON.stringify([{ type: 'hero', slug: post.id }]),
    })

    // Record recipients with resend email IDs
    await recordNewsletterRecipientsBatch(
      sentRecipients.map((r) => ({ send_id: sendId, email: r.email, resend_email_id: r.resendEmailId })),
    )

    return new Response(
      JSON.stringify({ ok: true, sent: successCount, total: subscribers.length }),
      { status: 200, headers },
    )
  } catch (err: any) {
    console.error('[admin/newsletter POST]', err)
    return new Response(
      JSON.stringify({ error: 'Newsletter konnte nicht versendet werden.', detail: err?.message }),
      { status: 500, headers },
    )
  }
}
