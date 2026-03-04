import type { APIRoute } from 'astro'
import { siteConfig } from '../lib/site-config'

export const GET: APIRoute = () => {
  const robotsTxt = `
User-agent: *
Allow: /

Sitemap: ${siteConfig.siteUrl}/sitemap-index.xml
Host: ${siteConfig.siteUrl}
`.trim()

  return new Response(robotsTxt, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
