import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { siteConfig } from '../lib/site-config'
import { sortPostsByDate, formatDate } from '../lib/utils'

export const prerender = true

export const GET: APIRoute = async () => {
  const allPosts = await getCollection('posts', ({ data }) => !data.draft)
  const sorted = sortPostsByDate(allPosts)

  const lines = [
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
    '## Blog-Beiträge',
    '',
    ...sorted.map(
      (post) =>
        `- [${post.data.title}](${siteConfig.siteUrl}/tiny-house/${post.id}/): ${post.data.summary || ''}`
    ),
    '',
    '## Weitere Seiten',
    '',
    `- [Über uns](${siteConfig.siteUrl}/ueber-uns/): Sibylle & Michi — die Menschen hinter KOKOMO House`,
    `- [Newsletter](${siteConfig.siteUrl}/newsletter/): Melde dich für den KOKOMO House Newsletter an`,
    `- [Tags](${siteConfig.siteUrl}/tags/): Alle Themen im Überblick`,
    '',
    '## Optionale Quellen',
    '',
    `- [llms-full.txt](${siteConfig.siteUrl}/llms-full.txt): Alle Blog-Beiträge mit vollständigem Inhalt`,
  ]

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
