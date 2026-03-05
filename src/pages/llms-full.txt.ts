import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { siteConfig } from '../lib/site-config'
import { sortPostsByDate, formatDate } from '../lib/utils'

export const prerender = true

/**
 * Strip Markdown image syntax and clean up for plain-text readability.
 */
function stripImages(md: string): string {
  return md
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // remove ![alt](url)
    .replace(/\n{3,}/g, '\n\n') // collapse excessive blank lines
}

export const GET: APIRoute = async () => {
  const allPosts = await getCollection('posts', ({ data }) => !data.draft)
  const sorted = sortPostsByDate(allPosts)

  const header = [
    `# ${siteConfig.title}`,
    '',
    `> ${siteConfig.description}`,
    '',
    `Wir sind Sibylle und Michi. Seit September 2022 leben wir in unserem Tiny House KOKOMO auf 36m².`,
    `Auf unserem Blog teilen wir unsere Erfahrungen, Tipps und Geschichten rund ums Leben im Tiny House.`,
    '',
    `- Website: ${siteConfig.siteUrl}`,
    `- Sprache: ${siteConfig.language}`,
    `- Kontakt: ${siteConfig.email}`,
    '',
    '---',
    '',
  ]

  const postSections = sorted.map((post) => {
    const { title, date, tags, summary } = post.data
    const url = `${siteConfig.siteUrl}/tiny-house/${post.slug}/`
    const body = stripImages(post.body || '')

    return [
      `## ${title}`,
      '',
      `- URL: ${url}`,
      `- Datum: ${formatDate(date)}`,
      tags.length > 0 ? `- Tags: ${tags.join(', ')}` : null,
      summary ? `- Zusammenfassung: ${summary}` : null,
      '',
      body.trim(),
      '',
      '---',
      '',
    ]
      .filter((line) => line !== null)
      .join('\n')
  })

  const content = header.join('\n') + postSections.join('\n')

  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
