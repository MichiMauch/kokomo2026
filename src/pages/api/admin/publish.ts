import type { APIRoute } from 'astro'
import { isAuthenticated } from '../../../lib/admin-auth'
import { fileExists, createFile, getFileContent } from '../../../lib/github'
import { uploadBufferToR2 } from '../../../lib/r2'
import { GoogleGenAI, Modality } from '@google/genai'
import { parse as parseYaml } from 'yaml'
import sharp from 'sharp'

export const prerender = false

// Inline slugify (same logic as pipeline/create-post-file.ts)
function slugify(title: string): string {
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

// Inline buildPostContent (same logic as pipeline/create-post-file.ts)
function buildPostContent(data: {
  title: string
  summary: string
  tags: string[]
  body: string
  imageUrl?: string
  date?: string
  draft?: boolean
}): string {
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

  lines.push('---', '', data.body)

  return lines.join('\n')
}

interface PublishRequest {
  title: string
  summary: string
  tags: string[]
  body: string
  image_prompt?: string
  skip_image?: boolean
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' }

  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  try {
    const body: PublishRequest = await request.json()

    // Validate
    const errors: string[] = []
    if (!body.title) errors.push('Titel fehlt')
    if (!body.summary) errors.push('Summary fehlt')
    if (!body.tags || body.tags.length === 0) errors.push('Tags fehlen')
    if (!body.body) errors.push('Body fehlt')

    if (errors.length > 0) {
      return new Response(JSON.stringify({ error: errors.join(', ') }), { status: 400, headers })
    }

    const slug = slugify(body.title)
    const filePath = `src/content/posts/${slug}.md`

    // Check if post already exists
    if (await fileExists(filePath)) {
      return new Response(JSON.stringify({ error: `Post existiert bereits: ${slug}` }), { status: 409, headers })
    }

    // Optional: Generate image
    let imageUrl: string | undefined

    if (body.image_prompt && !body.skip_image) {
      try {
        const geminiKey = import.meta.env.GOOGLE_GEMINI_API_KEY
        if (geminiKey) {
          // Load image style config
          let imageStyle: any = { base_style: '', header: { width: 1200, height: 675, style_suffix: '' } }
          try {
            const raw = await getFileContent('content-config/image-style.yaml')
            imageStyle = parseYaml(raw)
          } catch { /* use defaults */ }

          const cfg = imageStyle.header || { width: 1200, height: 675, style_suffix: '' }

          const fullPrompt = [
            imageStyle.base_style,
            cfg.style_suffix,
            body.image_prompt,
            `Aspect ratio: ${cfg.width}x${cfg.height}`,
            'No text overlays, no watermarks, no logos',
          ]
            .filter(Boolean)
            .join('. ')

          const ai = new GoogleGenAI({ apiKey: geminiKey })
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-05-20',
            contents: fullPrompt,
            config: {
              responseModalities: [Modality.TEXT, Modality.IMAGE],
            },
          })

          const parts = response.candidates?.[0]?.content?.parts || []
          const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'))

          if (imagePart?.inlineData?.data) {
            const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64')
            const optimized = await sharp(imageBuffer)
              .resize(cfg.width || 1200, cfg.height || 675, { fit: 'cover' })
              .webp({ quality: 85 })
              .toBuffer()

            const filename = `${slug}-titelbild.webp`
            imageUrl = await uploadBufferToR2(optimized, filename)
          }
        }
      } catch (err: any) {
        console.warn('[admin/publish] Image generation failed:', err.message)
        // Continue without image
      }
    }

    // Build markdown content
    const postContent = buildPostContent({
      title: body.title,
      summary: body.summary,
      tags: body.tags,
      body: body.body,
      imageUrl,
    })

    // Create file via GitHub API
    const commitMessage = `📝 Neuer Blogpost: ${body.title}`
    const { htmlUrl } = await createFile(filePath, postContent, commitMessage)

    return new Response(
      JSON.stringify({
        slug,
        imageUrl: imageUrl || null,
        githubUrl: htmlUrl,
        postUrl: `https://www.kokomo.house/tiny-house/${slug}`,
      }),
      { status: 201, headers }
    )
  } catch (err: any) {
    console.error('[admin/publish]', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Publizierung fehlgeschlagen.' }),
      { status: 500, headers }
    )
  }
}
