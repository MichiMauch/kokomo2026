import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { isAuthenticated } from '../../../lib/admin-auth'
import { getFileContent, updateFile } from '../../../lib/github'
import { uploadBufferToR2 } from '../../../lib/r2'
import sharp from 'sharp'
import { parse as parseYaml } from 'yaml'
import { enhancePhoto } from '../../../lib/image-enhance'

export const prerender = false

const headers = { 'Content-Type': 'application/json' }

function postDate(date: unknown): string {
  if (date instanceof Date) return date.toISOString().slice(0, 10)
  return date ? String(date).slice(0, 10) : ''
}

/**
 * GET: List all posts with slug, title, current image URL.
 *
 * Liest aus der gebundelten Content-Collection (1 In-Memory-Zugriff) statt pro
 * Datei einen GitHub-API-Call zu machen — das skaliert auf Produktion (sonst
 * 85 parallele GitHub-Requests → Funktions-Timeout / Rate-Limit → Endlos-Spinner).
 */
export const GET: APIRoute = async ({ request }) => {
  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  try {
    const entries = await getCollection('posts')
    const posts = entries.map((p) => {
      const images = p.data.images as string | string[] | undefined
      const imageUrl = typeof images === 'string' ? images : (images?.[0] ?? null)
      return {
        slug: p.id,
        title: p.data.title || p.id,
        date: postDate(p.data.date),
        imageUrl,
        draft: p.data.draft ?? false,
        tags: p.data.tags ?? [],
      }
    })

    // Sort by date descending (newest first)
    posts.sort((a, b) => b.date.localeCompare(a.date))

    return new Response(JSON.stringify({ posts }), { status: 200, headers })
  } catch (err: any) {
    console.error('[admin/images GET]', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}

/**
 * POST: Update title image for an existing post
 * Body: { slug, photo_base64?, image_prompt? }
 */
export const POST: APIRoute = async ({ request }) => {
  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  try {
    const body = await request.json()
    const { slug, photo_base64, image_prompt } = body

    if (!slug) {
      return new Response(JSON.stringify({ error: 'Slug fehlt' }), { status: 400, headers })
    }
    if (!photo_base64) {
      return new Response(JSON.stringify({ error: 'Kein Foto hochgeladen' }), { status: 400, headers })
    }

    const filePath = `src/content/posts/${slug}.md`

    // Load image style config
    let imageStyle: any = {
      base_style: '',
      header: { width: 1200, height: 675, style_suffix: '' },
      enhancement_prompt: '',
      lighting_moods: [],
      color_palettes: [],
      negative_prompt: '',
    }
    try {
      const raw = await getFileContent('content-config/image-style.yaml')
      imageStyle = parseYaml(raw)
    } catch { /* use defaults */ }

    // Enhance photo
    const geminiKey = import.meta.env.GOOGLE_GEMINI_API_KEY
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: 'Gemini API Key nicht konfiguriert' }), { status: 500, headers })
    }

    console.log(`[admin/images POST] Enhancing photo for ${slug}…`)
    const optimized = await enhancePhoto({
      photo_base64,
      image_prompt,
      imageStyle,
      geminiKey,
    })

    // Upload to R2 with cache-busting version
    const filename = `${slug}-titelbild.webp`
    const rawUrl = await uploadBufferToR2(optimized, filename)
    const imageUrl = `${rawUrl}?v=${Date.now()}`
    console.log(`[admin/images POST] Image uploaded: ${imageUrl}`)

    // Generate and upload thumbnail
    const thumb = await sharp(optimized)
      .resize(600, undefined, { withoutEnlargement: true })
      .webp({ quality: 60 })
      .toBuffer()
    await uploadBufferToR2(thumb, `${slug}-titelbild-thumb.webp`)
    console.log(`[admin/images POST] Thumbnail uploaded (${(thumb.length / 1024).toFixed(1)} KB)`)

    // Update post frontmatter via GitHub API
    const content = await getFileContent(filePath)
    const updatedContent = updateFrontmatterImages(content, imageUrl)
    await updateFile(filePath, updatedContent, `🖼️ Titelbild aktualisiert: ${slug}`)

    return new Response(JSON.stringify({ imageUrl, slug }), { status: 200, headers })
  } catch (err: any) {
    console.error('[admin/images POST]', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}

/**
 * Update or add the `images` field in frontmatter.
 * Parses YAML fully (handles multi-line `images: >-` format) and rebuilds cleanly.
 */
function updateFrontmatterImages(markdown: string, imageUrl: string): string {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return markdown

  const fm = parseYaml(match[1]) || {}
  const body = match[2]

  fm.images = imageUrl

  const esc = (s: string) => s.replace(/'/g, "''")
  const lines = [
    '---',
    `title: '${esc(fm.title || '')}'`,
    `date: '${fm.date || ''}'`,
    `summary: '${esc(fm.summary || '')}'`,
    `tags: [${(fm.tags || []).map((t: string) => `'${esc(t)}'`).join(', ')}]`,
    `authors: [${(fm.authors || ['default']).map((a: string) => `'${a}'`).join(', ')}]`,
    `draft: ${fm.draft ?? false}`,
    `images: '${fm.images}'`,
  ]

  if (fm.youtube) {
    lines.push(`youtube: '${fm.youtube}'`)
  }
  if (fm.canonicalUrl) {
    lines.push(`canonicalUrl: '${fm.canonicalUrl}'`)
  }

  lines.push('---', '')

  return lines.join('\n') + body
}
