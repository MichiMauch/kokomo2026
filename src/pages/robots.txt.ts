import type { APIRoute } from 'astro'
import { siteConfig } from '../lib/site-config'

export const prerender = true

export const GET: APIRoute = () => {
  const robotsTxt = `
User-agent: *
Allow: /

Sitemap: ${siteConfig.siteUrl}/sitemap-index.xml
Host: ${siteConfig.siteUrl}

# LLM / AI content — see https://llmstxt.org
# LLMs-Txt: ${siteConfig.siteUrl}/llms.txt
`.trim()

  return new Response(robotsTxt, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
