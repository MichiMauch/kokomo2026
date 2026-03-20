import type { APIRoute } from 'astro'
import { getAllSubscribers, getNewsletterSendsWithStats } from '../../../lib/newsletter'
import { getAllComments } from '../../../lib/turso'
import { isAuthenticated } from '../../../lib/admin-auth'

export const prerender = false

interface TopPost {
  label: string
  url: string
  nb_visits: number
  prev_nb_visits: number
}

async function fetchMatomoTopPosts(): Promise<TopPost[] | null> {
  const token = import.meta.env.MATOMO_TOKEN
  const siteId = import.meta.env.MATOMO_SITE_ID
  const baseUrl = (import.meta.env.MATOMO_URL || '').replace(/\/+$/, '')

  if (!token || !baseUrl || !siteId) return null

  try {
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    const currentRange = `${fmt(sevenDaysAgo)},${fmt(now)}`
    const prevRange = `${fmt(fourteenDaysAgo)},${fmt(sevenDaysAgo)}`

    const fetchPages = async (range: string) => {
      const apiUrl = `${baseUrl}/index.php?module=API&method=Actions.getPageUrls&period=range&date=${range}&format=JSON&idSite=${siteId}&flat=1&filter_limit=100`
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `token_auth=${encodeURIComponent(token)}`,
      })
      if (!res.ok) return []
      const json = await res.json()
      return Array.isArray(json) ? json : []
    }

    const [currentPages, prevPages] = await Promise.all([
      fetchPages(currentRange),
      fetchPages(prevRange),
    ])

    // Filter to blog post pages only (/tiny-house/slug pattern, not index or pagination)
    const isPostUrl = (url: string) => {
      const match = url.match(/^\/tiny-house\/([^/]+)\/?$/)
      return match && match[1] !== 'page'
    }

    const prevMap = new Map<string, number>()
    for (const page of prevPages) {
      const url = page.label || ''
      if (isPostUrl(url)) prevMap.set(url.replace(/\/$/, ''), page.nb_visits || 0)
    }

    const posts: TopPost[] = currentPages
      .filter((page: any) => isPostUrl(page.label || ''))
      .sort((a: any, b: any) => (b.nb_visits || 0) - (a.nb_visits || 0))
      .slice(0, 5)
      .map((page: any) => {
        const url = (page.label || '').replace(/\/$/, '')
        const slug = url.split('/').pop() || ''
        const title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
        return {
          label: title,
          url,
          nb_visits: page.nb_visits || 0,
          prev_nb_visits: prevMap.get(url) || 0,
        }
      })

    return posts.length > 0 ? posts : null
  } catch {
    return null
  }
}

async function fetchMatomoVisitors(): Promise<Record<string, number> | null> {
  const token = import.meta.env.MATOMO_TOKEN
  const siteId = import.meta.env.MATOMO_SITE_ID
  const baseUrl = (import.meta.env.MATOMO_URL || '').replace(/\/+$/, '')

  if (!token || !baseUrl || !siteId) return null

  try {
    const apiUrl = `${baseUrl}/index.php?module=API&method=VisitsSummary.getVisits&period=month&date=last12&format=JSON&idSite=${siteId}`
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `token_auth=${encodeURIComponent(token)}`,
    })
    if (!res.ok) return null
    const json = await res.json()
    if (json && typeof json === 'object' && !json.result) {
      return json as Record<string, number>
    }
    return null
  } catch {
    return null
  }
}

export const GET: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' }

  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  try {
    const [subscribersResult, commentsResult, sendsResult, visitorsResult, topPostsResult] = await Promise.allSettled([
      getAllSubscribers(),
      getAllComments(),
      getNewsletterSendsWithStats(),
      fetchMatomoVisitors(),
      fetchMatomoTopPosts(),
    ])

    // Subscribers (existing logic)
    const subscribers = subscribersResult.status === 'fulfilled' ? subscribersResult.value : []
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const confirmed = subscribers.filter((s) => s.status === 'confirmed')
    const total_confirmed = confirmed.length

    const new_last_7_days = confirmed.filter(
      (s) => new Date(s.created_at) >= sevenDaysAgo,
    ).length

    const new_prev_7_days = confirmed.filter(
      (s) => {
        const d = new Date(s.created_at)
        return d >= fourteenDaysAgo && d < sevenDaysAgo
      },
    ).length

    const change = new_last_7_days - new_prev_7_days

    // Pending comments
    const comments = commentsResult.status === 'fulfilled' ? commentsResult.value : []
    const pending_comments = comments.filter((c) => c.approved === 0).length

    // Last newsletter send
    const sends = sendsResult.status === 'fulfilled' ? sendsResult.value : []
    const lastSend = sends[0] || null
    const last_send = lastSend
      ? {
          post_title: lastSend.post_title,
          sent_at: lastSend.sent_at,
          recipient_count: lastSend.recipient_count,
          opened_count: lastSend.opened_count,
          clicked_count: lastSend.clicked_count,
        }
      : null

    // Visitors
    const visitors = visitorsResult.status === 'fulfilled' ? visitorsResult.value : null

    // Top posts
    const top_posts = topPostsResult.status === 'fulfilled' ? topPostsResult.value : null

    return new Response(
      JSON.stringify({ total_confirmed, new_last_7_days, change, pending_comments, last_send, visitors, top_posts }),
      { status: 200, headers },
    )
  } catch (err: any) {
    console.error('[admin/dashboard GET]', err)
    return new Response(
      JSON.stringify({ error: 'Dashboard-Daten konnten nicht geladen werden.', detail: err?.message || String(err) }),
      { status: 500, headers },
    )
  }
}
