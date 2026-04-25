/**
 * POST /api/sync-newsletter-content
 * Syncs all published posts to the newsletter-app content_items table.
 * Can be called manually or as a post-deploy hook.
 */

import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { isAuthenticated } from '../../lib/admin-auth'

export const prerender = false

function getFirstImage(images: unknown): string | null {
  if (Array.isArray(images)) return images[0] ?? null
  return (images as string) ?? null
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' }

  // Auth: either admin session or CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const cronSecret = import.meta.env.CRON_SECRET
  const isAuthedByToken = cronSecret && authHeader === `Bearer ${cronSecret}`
  const isAuthedBySession = await isAuthenticated(request)

  if (!isAuthedByToken && !isAuthedBySession) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers })
  }

  try {
    const allPosts = await getCollection('posts')
    const items = allPosts
      .map((p) => ({
        slug: p.id.replace(/\.md$/, ''),
        title: p.data.title,
        summary: p.data.summary ?? '',
        image: getFirstImage(p.data.images),
        date: p.data.date?.toISOString().split('T')[0] ?? '',
        tags: Array.isArray(p.data.tags) ? p.data.tags : [],
        published: !p.data.draft,
      }))

    const newsletterAppUrl = import.meta.env.PUBLIC_NEWSLETTER_APP_URL || 'https://newsletter.kokomo.house'
    const syncUrl = `${newsletterAppUrl}/api/v1/content-sync`

    const res = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: cronSecret ? `Bearer ${cronSecret}` : '',
      },
      body: JSON.stringify({ siteId: 'kokomo', items }),
    })

    if (!res.ok) {
      const body = await res.text()
      return new Response(JSON.stringify({ error: 'Sync failed', status: res.status, body }), { status: 502, headers })
    }

    const result = await res.json()
    return new Response(JSON.stringify({ ok: true, synced: result.synced, total_posts: items.length }), { status: 200, headers })
  } catch (err: any) {
    console.error('[sync-newsletter-content]', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}
