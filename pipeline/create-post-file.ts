#!/usr/bin/env npx tsx
/**
 * Create a new blog post markdown file
 *
 * Usage as module:
 *   import { createPostFile } from './create-post-file'
 *   createPostFile({ title, summary, tags, body, imageUrl })
 */

import { writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

export interface PostData {
  title: string
  summary: string
  tags: string[]
  body: string
  imageUrl?: string
  youtube?: string
  date?: string // YYYY-MM-DD, defaults to today
  draft?: boolean
}

/**
 * Generate a URL-safe slug from a title
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/**
 * Create the frontmatter + body for a post
 */
export function buildPostContent(data: PostData): string {
  const date = data.date || new Date().toISOString().split('T')[0]
  const draft = data.draft ?? false

  const lines = [
    '---',
    `title: '${data.title.replace(/'/g, "''")}'`,
    `date: '${date}'`,
    `summary: '${data.summary.replace(/'/g, "''")}'`,
    `tags: [${data.tags.map((t) => `'${t}'`).join(', ')}]`,
    `authors: ['default']`,
    `draft: ${draft}`,
  ]

  if (data.imageUrl) {
    lines.push(`images: '${data.imageUrl}'`)
  }

  if (data.youtube) {
    lines.push(`youtube: '${data.youtube}'`)
  }

  lines.push('---', '', data.body)

  return lines.join('\n')
}

/**
 * Write the post file to disk
 */
export function createPostFile(data: PostData): {
  slug: string
  filePath: string
  content: string
} {
  const slug = slugify(data.title)
  const postsDir = resolve(process.cwd(), 'src/content/posts')
  const filePath = resolve(postsDir, `${slug}.md`)

  if (existsSync(filePath)) {
    throw new Error(`Post file already exists: ${filePath}`)
  }

  const content = buildPostContent(data)
  writeFileSync(filePath, content, 'utf-8')

  console.log(`✅ Post created: ${filePath}`)
  console.log(`   Slug: ${slug}`)
  console.log(`   Title: ${data.title}`)
  console.log(`   Tags: ${data.tags.join(', ')}`)

  return { slug, filePath, content }
}
