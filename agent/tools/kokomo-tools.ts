/**
 * Custom MCP tools for the KOKOMO Blog Agent (CLI / filesystem-based)
 */

import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod/v4'
import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import { resolve } from 'path'
import { JSDOM } from 'jsdom'
import TurndownService from 'turndown'
import sharp from 'sharp'
import { uploadBufferToR2 } from '../../pipeline/upload-to-r2.js'
import matter from 'gray-matter'
import { execSync } from 'child_process'
import { generateImage } from '../../pipeline/generate-images.js'
import { createPostFile, slugify, buildPostContent } from '../../pipeline/create-post-file.js'
import { createClient } from '@libsql/client'

const ROOT = process.cwd()

// --- read_style_config ---
export const readStyleConfigTool = tool(
  'read_style_config',
  'Read the KOKOMO writing style or image style configuration (YAML). Use "writing" for writing rules, "image" for image generation rules, or "both" for both.',
  { config: z.enum(['writing', 'image', 'both']) },
  async ({ config }) => {
    const results: string[] = []

    if (config === 'writing' || config === 'both') {
      const content = readFileSync(resolve(ROOT, 'content-config/writing-style.yaml'), 'utf-8')
      results.push('=== writing-style.yaml ===\n' + content)
    }
    if (config === 'image' || config === 'both') {
      const content = readFileSync(resolve(ROOT, 'content-config/image-style.yaml'), 'utf-8')
      results.push('=== image-style.yaml ===\n' + content)
    }

    return { content: [{ type: 'text' as const, text: results.join('\n\n') }] }
  }
)

// --- list_recent_posts ---
export const listRecentPostsTool = tool(
  'list_recent_posts',
  'List frontmatter (title, date, tags, summary) of the most recent blog posts. Useful to understand existing content and avoid duplicate topics.',
  { count: z.number().default(20) },
  async ({ count }) => {
    const postsDir = resolve(ROOT, 'src/content/posts')
    const files = readdirSync(postsDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, count)

    const posts = files.map(file => {
      const raw = readFileSync(resolve(postsDir, file), 'utf-8')
      const { data } = matter(raw)
      return {
        slug: file.replace('.md', ''),
        title: data.title || '',
        date: data.date || '',
        tags: data.tags || [],
        summary: data.summary || '',
      }
    })

    // Sort by date descending
    posts.sort((a, b) => String(b.date).localeCompare(String(a.date)))

    return {
      content: [{
        type: 'text' as const,
        text: posts.map(p =>
          `- **${p.title}** (${p.date})\n  Tags: ${p.tags.join(', ')}\n  Summary: ${p.summary}\n  Slug: ${p.slug}`
        ).join('\n\n')
      }]
    }
  }
)

// --- find_relevant_posts ---
export const findRelevantPostsTool = tool(
  'find_relevant_posts',
  'Search for thematically relevant posts in the entire archive based on a query. Returns the top matches with their slugs, titles, and summaries.',
  {
    query: z.string().describe('Keywords or topic to search for'),
    limit: z.number().default(10).describe('Maximum number of results to return')
  },
  async ({ query, limit }) => {
    const postsDir = resolve(ROOT, 'src/content/posts')
    const files = readdirSync(postsDir).filter(f => f.endsWith('.md'))
    const queryLower = query.toLowerCase()

    const results = files.map(file => {
      const raw = readFileSync(resolve(postsDir, file), 'utf-8')
      const { data } = matter(raw)
      const slug = file.replace('.md', '')
      const title = data.title || ''
      const summary = data.summary || ''
      const tags = data.tags || []

      let score = 0
      if (title.toLowerCase().includes(queryLower)) score += 10
      if (summary.toLowerCase().includes(queryLower)) score += 5
      tags.forEach(tag => {
        if (tag.toLowerCase().includes(queryLower)) score += 5
      })

      return { slug, title, summary, score }
    })
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

    if (results.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No highly relevant posts found in the archive.' }] }
    }

    return {
      content: [{
        type: 'text' as const,
        text: results.map(p =>
          `- **${p.title}** (Score: ${p.score})\n  Summary: ${p.summary}\n  Slug: ${p.slug}`
        ).join('\n\n')
      }]
    }
  }
)

// --- read_post ---
export const readPostTool = tool(
  'read_post',
  'Read the full content of a blog post by its slug. Returns frontmatter + body.',
  { slug: z.string() },
  async ({ slug }) => {
    const filePath = resolve(ROOT, 'src/content/posts', `${slug}.md`)
    const content = readFileSync(filePath, 'utf-8')
    return { content: [{ type: 'text' as const, text: content }] }
  }
)

// --- generate_image ---
export const generateImageTool = tool(
  'generate_image',
  'Generate an image using Gemini Imagen API and upload to R2. Returns the image URL. The prompt should be in English and describe the desired scene.',
  {
    prompt: z.string(),
    slug: z.string(),
    type: z.enum(['header', 'inline']).default('header'),
  },
  async ({ prompt, slug, type }) => {
    const result = await generateImage(prompt, type, slug)
    return {
      content: [{
        type: 'text' as const,
        text: `Image generated and uploaded.\nURL: ${result.url}\nFull prompt used: ${result.prompt.slice(0, 200)}...`
      }]
    }
  }
)

// --- create_post_file ---
export const createPostFileTool = tool(
  'create_post_file',
  'Create a new blog post markdown file with frontmatter. Automatically fixes umlauts and generates the slug from the title.',
  {
    title: z.string(),
    summary: z.string(),
    tags: z.array(z.string()),
    body: z.string(),
    imageUrl: z.string().optional(),
    draft: z.boolean().default(false),
    postType: z.enum(['article', 'howto', 'faq']).optional().describe('Post type: "howto" for tutorials (enables HowTo schema), "faq" for FAQ posts'),
  },
  async ({ title, summary, tags, body, imageUrl, draft, postType }) => {
    const result = createPostFile({
      title,
      summary,
      tags,
      body,
      imageUrl,
      draft,
      postType,
    })
    return {
      content: [{
        type: 'text' as const,
        text: `Post file created.\nSlug: ${result.slug}\nPath: ${result.filePath}`
      }]
    }
  }
)

// --- git_publish ---
export const gitPublishTool = tool(
  'git_publish',
  'Publish a post by running git add + commit + push. Only call this when the user explicitly confirms they want to publish.',
  {
    slug: z.string(),
    title: z.string(),
  },
  async ({ slug, title }) => {
    const filePath = `src/content/posts/${slug}.md`
    try {
      execSync(`git add "${filePath}"`, { cwd: ROOT, stdio: 'pipe' })
      const msg = `📝 Neuer Blogpost: ${title}`
      execSync(`git commit -m "${msg}"`, { cwd: ROOT, stdio: 'pipe' })
      execSync('git push', { cwd: ROOT, stdio: 'pipe' })
      return {
        content: [{
          type: 'text' as const,
          text: `Post published! Git commit & push successful.\nFile: ${filePath}\nCommit message: ${msg}`
        }]
      }
    } catch (err: any) {
      return {
        content: [{
          type: 'text' as const,
          text: `Git publish failed: ${err.message}`
        }],
        isError: true,
      }
    }
  }
)

// --- save_social_texts ---

function getTursoClient() {
  const url = process.env.TURSO_DB_URL
  const authToken = process.env.TURSO_DB_TOKEN
  if (!url || !authToken) {
    throw new Error('TURSO_DB_URL and TURSO_DB_TOKEN must be set in .env.local')
  }
  return createClient({ url, authToken })
}

export const saveSocialTextsTool = tool(
  'save_social_texts',
  'Save social media texts for a blog post to the database. The texts are stored per platform and can be reviewed/shared in the admin dashboard.',
  {
    slug: z.string().describe('The post slug'),
    texts: z.object({
      facebook: z.string().describe('Facebook post text (max ~1200 chars)'),
      twitter: z.string().describe('Twitter/X post text (max 280 chars)'),
      telegram: z.string().describe('Telegram post text (max ~1000 chars)'),
      whatsapp: z.string().describe('WhatsApp message text (max ~700 chars)'),
    }),
  },
  async ({ slug, texts }) => {
    const db = getTursoClient()
    const platformMap: Record<string, string> = {
      facebook: 'facebook_page',
      twitter: 'twitter',
      telegram: 'telegram',
      whatsapp: 'whatsapp',
    }
    for (const [key, text] of Object.entries(texts)) {
      const platform = platformMap[key]
      await db.execute({
        sql: `INSERT INTO social_texts (post_slug, platform, text, generated_at, updated_at)
              VALUES (?, ?, ?, datetime('now'), datetime('now'))
              ON CONFLICT(post_slug, platform) DO UPDATE SET text = ?, updated_at = datetime('now')`,
        args: [slug, platform, text, text],
      })
    }
    return {
      content: [{
        type: 'text' as const,
        text: `Social-Media-Texte für "${slug}" gespeichert (${Object.keys(texts).join(', ')}). Im Admin-Dashboard unter /admin/posts/${slug}#social reviewen und teilen.`
      }]
    }
  }
)

// --- upload_photo ---
export const uploadPhotoTool = tool(
  'upload_photo',
  'Upload a local photo for a blog post. Converts to WebP, uploads to R2, returns markdown image syntax. Use type "header" for title images (1200x675 cover crop) or "inline" (default) for body images (max 1000px wide). For galleries: call this tool multiple times and place the markdown images on consecutive lines separated by blank lines.',
  {
    filePath: z.string().describe('Absolute or ~-relative path to the local image file'),
    slug: z.string().describe('The post slug (used for the filename on R2)'),
    alt: z.string().optional().describe('Alt text for the image'),
    type: z.enum(['header', 'inline']).default('inline').describe('Image type: header (1200x675 cover crop) or inline (max 1000px wide)'),
  },
  async ({ filePath, slug, alt, type }) => {
    const resolved = resolve(filePath.replace(/^~/, process.env.HOME || ''))
    if (!existsSync(resolved)) {
      return { content: [{ type: 'text' as const, text: `File not found: ${resolved}` }], isError: true }
    }

    const buffer = type === 'header'
      ? await sharp(resolved).resize(1200, 675, { fit: 'cover' }).webp({ quality: 85 }).toBuffer()
      : await sharp(resolved).resize(1000, null, { withoutEnlargement: true }).webp({ quality: 85 }).toBuffer()

    const filename = type === 'header'
      ? `${slug}-titelbild.webp`
      : `${slug}-${Date.now()}.webp`
    const url = await uploadBufferToR2(buffer, filename)

    // Generate thumbnail for header images (used on homepage cards)
    if (type === 'header') {
      const thumb = await sharp(buffer)
        .resize(600, undefined, { withoutEnlargement: true })
        .webp({ quality: 60 })
        .toBuffer()
      await uploadBufferToR2(thumb, `${slug}-titelbild-thumb.webp`)
    }

    const markdown = alt ? `![${alt}](${url})` : `![](${url})`

    return {
      content: [{ type: 'text' as const, text: `Photo uploaded.\nURL: ${url}\nMarkdown: ${markdown}` }]
    }
  }
)

// --- fetch_url ---
export const fetchUrlTool = tool(
  'fetch_url',
  'Fetch a web page and return its main content as Markdown. Useful for researching articles, extracting inspiration, or reading references the user points to. Follows redirects, strips scripts/nav/footer.',
  {
    url: z.string().url(),
    max_chars: z.number().default(20000).describe('Truncate output to this many characters (default 20000).'),
  },
  async ({ url, max_chars }) => {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (KOKOMO Blog-Agent)' },
    })
    if (!res.ok) {
      return { content: [{ type: 'text' as const, text: `HTTP ${res.status} ${res.statusText} for ${url}` }] }
    }
    const html = await res.text()
    const dom = new JSDOM(html, { url })
    const doc = dom.window.document

    doc.querySelectorAll('script, style, noscript, nav, footer, header, aside, iframe, form').forEach(el => el.remove())

    const main =
      doc.querySelector('main') ||
      doc.querySelector('article') ||
      doc.querySelector('[role="main"]') ||
      doc.body

    const title = doc.querySelector('title')?.textContent?.trim() || ''
    const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
    let md = turndown.turndown(main.innerHTML)
    md = md.replace(/\n{3,}/g, '\n\n').trim()

    let truncated = false
    if (md.length > max_chars) {
      md = md.slice(0, max_chars)
      truncated = true
    }

    const header = `# ${title}\n\nSource: ${url}\n\n---\n\n`
    const footer = truncated ? `\n\n---\n(truncated to ${max_chars} chars)` : ''

    return { content: [{ type: 'text' as const, text: header + md + footer }] }
  }
)

// --- read_local_file ---
export const readLocalFileTool = tool(
  'read_local_file',
  'Read any local file by absolute or relative path that the user points to (e.g. a PDF research note, a Markdown draft, a JSON config). Returns raw text. Refuses binary files and files > 5 MB.',
  {
    path: z.string().describe('Absolute or relative path to the file.'),
    max_chars: z.number().default(50000).describe('Truncate output to this many characters (default 50000).'),
  },
  async ({ path, max_chars }) => {
    const abs = resolve(ROOT, path)
    if (!existsSync(abs)) {
      return { content: [{ type: 'text' as const, text: `File not found: ${abs}` }] }
    }
    const stat = statSync(abs)
    if (stat.isDirectory()) {
      return { content: [{ type: 'text' as const, text: `Path is a directory, not a file: ${abs}` }] }
    }
    const MAX_BYTES = 5 * 1024 * 1024
    if (stat.size > MAX_BYTES) {
      return { content: [{ type: 'text' as const, text: `File too large (${stat.size} bytes, limit ${MAX_BYTES}): ${abs}` }] }
    }

    const buf = readFileSync(abs)
    // Binary sniff: null byte in first 8 KB → binary
    const sniff = buf.subarray(0, Math.min(buf.length, 8192))
    if (sniff.includes(0)) {
      return { content: [{ type: 'text' as const, text: `Binary file detected, refusing to read: ${abs}` }] }
    }

    let text = buf.toString('utf-8')
    let truncated = false
    if (text.length > max_chars) {
      text = text.slice(0, max_chars)
      truncated = true
    }

    const header = `=== ${abs} (${stat.size} bytes) ===\n\n`
    const footer = truncated ? `\n\n--- (truncated to ${max_chars} chars) ---` : ''
    return { content: [{ type: 'text' as const, text: header + text + footer }] }
  }
)

export const allTools = [
  readStyleConfigTool,
  listRecentPostsTool,
  findRelevantPostsTool,
  readPostTool,
  generateImageTool,
  createPostFileTool,
  gitPublishTool,
  saveSocialTextsTool,
  uploadPhotoTool,
  fetchUrlTool,
  readLocalFileTool,
]
