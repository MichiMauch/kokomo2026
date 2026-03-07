import type { APIRoute } from 'astro'
import { isAuthenticated } from '../../../lib/admin-auth'
import {
  getAllSubscribers,
  getConfirmedSubscribers,
  getNewsletterSends,
  recordNewsletterSend,
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

    const [subscribers, sends] = await Promise.all([getAllSubscribers(), getNewsletterSends()])

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

    return new Response(JSON.stringify({ subscribers, sends, posts }), { status: 200, headers })
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
    const { action, postSlug, subject, subscriberId, blocks } = body

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

    const BATCH_SIZE = 10
    const BATCH_DELAY_MS = 100
    let successCount = 0

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
        const post = allPosts.find((p) => p.id === slug)
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

      for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
        const batch = subscribers.slice(i, i + BATCH_SIZE)
        const results = await Promise.allSettled(
          batch.map((sub) =>
            sendMultiBlockNewsletterEmail({
              email: sub.email,
              unsubscribeToken: sub.token,
              subject,
              blocks: typedBlocks,
              postsMap,
            }),
          ),
        )
        successCount += results.filter((r) => r.status === 'fulfilled').length

        if (i + BATCH_SIZE < subscribers.length) {
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
        }
      }

      // Use first post slug for record, or 'multi-block'
      const firstSlug = slugs.size > 0 ? [...slugs][0] : 'multi-block'
      const firstPost = postsMap[firstSlug]
      await recordNewsletterSend({
        post_slug: firstSlug,
        post_title: firstPost?.title ?? subject,
        subject,
        recipient_count: successCount,
      })

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
    const post = allPosts.find((p) => p.id === postSlug)
    if (!post) {
      return new Response(JSON.stringify({ error: 'Blogpost nicht gefunden.' }), {
        status: 404,
        headers,
      })
    }

    for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
      const batch = subscribers.slice(i, i + BATCH_SIZE)
      const results = await Promise.allSettled(
        batch.map((sub) =>
          sendNewsletterEmail({
            email: sub.email,
            unsubscribeToken: sub.token,
            postTitle: post.data.title,
            postSlug: post.id,
            postImage: getFirstImage(post.data.images),
            postSummary: post.data.summary ?? '',
            postDate: post.data.date.toISOString().split('T')[0],
          }),
        ),
      )
      successCount += results.filter((r) => r.status === 'fulfilled').length

      if (i + BATCH_SIZE < subscribers.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
      }
    }

    await recordNewsletterSend({
      post_slug: post.id,
      post_title: post.data.title,
      subject,
      recipient_count: successCount,
    })

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
