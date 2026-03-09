import type { APIRoute } from 'astro'
import { isAuthenticated } from '../../../lib/admin-auth'
import { listPostFiles, getFileContent, updateFile } from '../../../lib/github'
import { uploadBufferToR2 } from '../../../lib/r2'
import { parse as parseYaml } from 'yaml'
import { enhancePhoto } from '../../../lib/image-enhance'

export const prerender = false

const headers = { 'Content-Type': 'application/json' }

/**
 * Parse frontmatter from markdown content
 */
function parseFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  try {
    return parseYaml(match[1]) || {}
  } catch {
    return {}
  }
}

/**
 * GET: List all posts with slug, title, current image URL
 */
export const GET: APIRoute = async ({ request }) => {
  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  try {
    const files = await listPostFiles()

    const posts = await Promise.all(
      files.map(async (filename) => {
        const slug = filename.replace(/\.md$/, '')
        try {
          const content = await getFileContent(`src/content/posts/${filename}`)
          const fm = parseFrontmatter(content)
          return {
            slug,
            title: fm.title || slug,
            date: fm.date || '',
            imageUrl: fm.images || null,
            draft: fm.draft ?? false,
            tags: fm.tags || [],
          }
        } catch {
          return { slug, title: slug, date: '', imageUrl: null, draft: false, tags: [] as string[] }
        }
      })
    )

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
