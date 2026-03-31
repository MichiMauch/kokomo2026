import type { APIRoute } from 'astro'
import { createSign } from 'node:crypto'
import { getAllComments } from '../../../lib/turso'
import { isAuthenticated } from '../../../lib/admin-auth'

export const prerender = false

// Fetch newsletter stats from the standalone newsletter-app
async function fetchNewsletterStats(): Promise<{
  subscribers: { status: string; created_at: string }[]
  sends: { post_title: string; sent_at: string; recipient_count: number; opened_count: number; clicked_count: number }[]
} | null> {
  const newsletterAppUrl = import.meta.env.PUBLIC_NEWSLETTER_APP_URL || 'https://newsletter.kokomo.house'
  const cronSecret = import.meta.env.CRON_SECRET

  try {
    const res = await fetch(`${newsletterAppUrl}/api/admin/newsletter?stats=1`, {
      headers: {
        Cookie: `admin_session=${cronSecret || ''}`,
      },
    })
    if (!res.ok) return null
    const data = await res.json()
    return { subscribers: data.subscribers || [], sends: data.sends || [] }
  } catch {
    return null
  }
}

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

interface TopPostAllTime {
  label: string
  url: string
  nb_visits: number
}

async function fetchMatomoTopPostsAllTime(): Promise<TopPostAllTime[] | null> {
  const token = import.meta.env.MATOMO_TOKEN
  const siteId = import.meta.env.MATOMO_SITE_ID
  const baseUrl = (import.meta.env.MATOMO_URL || '').replace(/\/+$/, '')

  if (!token || !baseUrl || !siteId) return null

  try {
    const apiUrl = `${baseUrl}/index.php?module=API&method=Actions.getPageUrls&period=range&date=2022-09-01,today&format=JSON&idSite=${siteId}&flat=1&filter_limit=100`
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `token_auth=${encodeURIComponent(token)}`,
    })
    if (!res.ok) return null
    const json = await res.json()
    if (!Array.isArray(json)) return null

    const isPostUrl = (url: string) => {
      const match = url.match(/^\/tiny-house\/([^/]+)\/?$/)
      return match && match[1] !== 'page'
    }

    const posts: TopPostAllTime[] = json
      .filter((page: any) => isPostUrl(page.label || ''))
      .sort((a: any, b: any) => (b.nb_visits || 0) - (a.nb_visits || 0))
      .slice(0, 5)
      .map((page: any) => {
        const url = (page.label || '').replace(/\/$/, '')
        const slug = url.split('/').pop() || ''
        const title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
        return { label: title, url, nb_visits: page.nb_visits || 0 }
      })

    return posts.length > 0 ? posts : null
  } catch {
    return null
  }
}

interface SearchQuery {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

async function fetchSearchConsoleTopQueries(): Promise<SearchQuery[] | null> {
  const keyRaw = import.meta.env.GOOGLE_SEARCH_CONSOLE_KEY_JSON
  if (!keyRaw) return null

  try {
    let keyJson: string
    if (keyRaw.trimStart().startsWith('{')) {
      keyJson = keyRaw
    } else {
      keyJson = Buffer.from(keyRaw, 'base64').toString('utf-8')
    }
    const key = JSON.parse(keyJson)
    const now = Math.floor(Date.now() / 1000)
    const header = { alg: 'RS256', typ: 'JWT' }
    const payload = {
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }

    const toBase64Url = (obj: object) =>
      Buffer.from(JSON.stringify(obj)).toString('base64url')

    const signInput = `${toBase64Url(header)}.${toBase64Url(payload)}`
    const sign = createSign('RSA-SHA256')
    sign.update(signInput)
    const signature = sign.sign(key.private_key, 'base64url')
    const jwt = `${signInput}.${signature}`

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    })
    if (!tokenRes.ok) return null
    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token
    if (!accessToken) return null

    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 28 * 24 * 60 * 60 * 1000)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)

    const siteUrl = 'https://www.kokomo.house'
    const apiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`
    const apiRes = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ['query'],
        rowLimit: 10,
      }),
    })
    if (!apiRes.ok) return null
    const apiData = await apiRes.json()

    if (!apiData.rows || !Array.isArray(apiData.rows)) return null

    return apiData.rows.map((row: any) => ({
      query: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: Math.round(row.ctr * 1000) / 10,
      position: Math.round(row.position * 10) / 10,
    }))
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
    const [newsletterResult, commentsResult, visitorsResult, topPostsResult, topPostsAllTimeResult, searchQueriesResult] = await Promise.allSettled([
      fetchNewsletterStats(),
      getAllComments(),
      fetchMatomoVisitors(),
      fetchMatomoTopPosts(),
      fetchMatomoTopPostsAllTime(),
      fetchSearchConsoleTopQueries(),
    ])

    // Newsletter stats from newsletter-app
    const newsletterData = newsletterResult.status === 'fulfilled' ? newsletterResult.value : null
    const subscribers = newsletterData?.subscribers || []
    const sends = newsletterData?.sends || []

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const confirmed = subscribers.filter((s: any) => s.status === 'confirmed')
    const total_confirmed = confirmed.length

    const new_last_7_days = confirmed.filter(
      (s: any) => new Date(s.created_at) >= sevenDaysAgo,
    ).length

    const new_prev_7_days = confirmed.filter(
      (s: any) => {
        const d = new Date(s.created_at)
        return d >= fourteenDaysAgo && d < sevenDaysAgo
      },
    ).length

    const change = new_last_7_days - new_prev_7_days

    // Pending comments
    const comments = commentsResult.status === 'fulfilled' ? commentsResult.value : []
    const pending_comments = comments.filter((c) => c.approved === 0).length

    // Last newsletter send
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

    const visitors = visitorsResult.status === 'fulfilled' ? visitorsResult.value : null
    const top_posts = topPostsResult.status === 'fulfilled' ? topPostsResult.value : null
    const top_posts_all_time = topPostsAllTimeResult.status === 'fulfilled' ? topPostsAllTimeResult.value : null
    const search_queries = searchQueriesResult.status === 'fulfilled' ? searchQueriesResult.value : null

    return new Response(
      JSON.stringify({ total_confirmed, new_last_7_days, change, pending_comments, last_send, visitors, top_posts, top_posts_all_time, search_queries }),
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
