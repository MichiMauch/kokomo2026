import { defineMiddleware } from 'astro:middleware'

/**
 * Simple in-memory rate limiter for POST endpoints.
 * Not globally consistent on serverless (each instance has its own map),
 * but catches single-connection floods. Use Cloudflare WAF for global limits.
 */
const RATE_WINDOW_MS = 60_000 // 1 minute
const MAX_REQUESTS = 30 // max POST requests per IP per window
const MAX_BODY_SIZE = 1024 // 1 KB max body for tracking endpoints

const ipHits = new Map<string, { count: number; reset: number }>()

// Clean up stale entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of ipHits) {
    if (now > entry.reset) ipHits.delete(ip)
  }
}, RATE_WINDOW_MS)

function getRateLimitEntry(ip: string) {
  const now = Date.now()
  let entry = ipHits.get(ip)
  if (!entry || now > entry.reset) {
    entry = { count: 0, reset: now + RATE_WINDOW_MS }
    ipHits.set(ip, entry)
  }
  return entry
}

const RATE_LIMITED_PATHS = ['/api/glossary/track', '/api/glossary/widget-ping']

export const onRequest = defineMiddleware(async ({ request, url }, next) => {
  // Only apply to POST requests on tracking endpoints
  if (request.method !== 'POST' || !RATE_LIMITED_PATHS.includes(url.pathname)) {
    return next()
  }

  // Body size check
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return new Response(JSON.stringify({ error: 'Payload zu gross.' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Rate limit by IP (use forwarded header from Cloudflare/Vercel, fallback to unknown)
  const ip = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown'
  const entry = getRateLimitEntry(ip)
  entry.count++

  if (entry.count > MAX_REQUESTS) {
    return new Response(JSON.stringify({ error: 'Zu viele Anfragen. Bitte warte kurz.' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '60',
      },
    })
  }

  return next()
})
