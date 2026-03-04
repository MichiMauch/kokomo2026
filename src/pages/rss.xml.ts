import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'
import { siteConfig } from '../lib/site-config'
import type { APIContext } from 'astro'

export async function GET(context: APIContext) {
  const posts = await getCollection('posts', ({ data }) => !data.draft)
  const sortedPosts = [...posts].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())

  return rss({
    title: siteConfig.title,
    description: siteConfig.description,
    site: context.site!,
    items: sortedPosts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.summary ?? '',
      link: `/tiny-house/${post.slug}/`,
    })),
    customData: `<language>${siteConfig.language}</language>`,
  })
}
