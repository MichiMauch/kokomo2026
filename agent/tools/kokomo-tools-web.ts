/**
 * Custom MCP tools for the KOKOMO Blog Agent (Web / GitHub-API-based)
 *
 * Differences from kokomo-tools.ts:
 * - create_post_file uses GitHub API (not fs.writeFileSync)
 * - git_publish is removed (GitHub API commits automatically)
 * - read operations use GitHub API via src/lib/github.ts logic
 * - generate_image uses the same server-side approach as publish.ts
 */

import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod/v4'

/**
 * Create web tools with runtime env access.
 * We pass env/helpers because in Astro serverless, import.meta.env is used
 * rather than process.env.
 */
export function createWebTools(deps: {
  getFileContent: (path: string) => Promise<string>
  listPostFiles: () => Promise<string[]>
  fileExists: (path: string) => Promise<boolean>
  createFile: (path: string, content: string, msg: string) => Promise<{ htmlUrl: string }>
  uploadBufferToR2: (buffer: Buffer, filename: string) => Promise<string>
  getEnv: (key: string) => string | undefined
}) {
  const { getFileContent, listPostFiles, fileExists, createFile, uploadBufferToR2, getEnv } = deps

  const readStyleConfigTool = tool(
    'read_style_config',
    'Read the KOKOMO writing style or image style configuration (YAML).',
    { config: z.enum(['writing', 'image', 'both']) },
    async ({ config }) => {
      const results: string[] = []
      if (config === 'writing' || config === 'both') {
        const content = await getFileContent('content-config/writing-style.yaml')
        results.push('=== writing-style.yaml ===\n' + content)
      }
      if (config === 'image' || config === 'both') {
        const content = await getFileContent('content-config/image-style.yaml')
        results.push('=== image-style.yaml ===\n' + content)
      }
      return { content: [{ type: 'text' as const, text: results.join('\n\n') }] }
    }
  )

  const listRecentPostsTool = tool(
    'list_recent_posts',
    'List frontmatter of the most recent blog posts.',
    { count: z.number().default(20) },
    async ({ count }) => {
      const { parse: parseYaml } = await import('yaml')
      const files = await listPostFiles()
      const sorted = files.sort().reverse().slice(0, count)

      const posts: { slug: string; title: string; date: string; tags: string[]; summary: string }[] = []

      for (const file of sorted) {
        try {
          const raw = await getFileContent(`src/content/posts/${file}`)
          const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/)
          if (fmMatch) {
            const data = parseYaml(fmMatch[1])
            posts.push({
              slug: file.replace('.md', ''),
              title: data.title || '',
              date: data.date || '',
              tags: data.tags || [],
              summary: data.summary || '',
            })
          }
        } catch { /* skip unreadable */ }
      }

      posts.sort((a, b) => String(b.date).localeCompare(String(a.date)))

      return {
        content: [{
          type: 'text' as const,
          text: posts.map(p =>
            `- **${p.title}** (${p.date})\n  Tags: ${p.tags.join(', ')}\n  Summary: ${p.summary}`
          ).join('\n\n')
        }]
      }
    }
  )

  const readPostTool = tool(
    'read_post',
    'Read the full content of a blog post by slug.',
    { slug: z.string() },
    async ({ slug }) => {
      const content = await getFileContent(`src/content/posts/${slug}.md`)
      return { content: [{ type: 'text' as const, text: content }] }
    }
  )

  const generateImageTool = tool(
    'generate_image',
    'Generate a header image using Gemini Imagen and upload to R2.',
    {
      prompt: z.string(),
      slug: z.string(),
      type: z.enum(['header', 'inline']).default('header'),
    },
    async ({ prompt, slug, type }) => {
      const { GoogleGenAI, Modality } = await import('@google/genai')
      const { parse: parseYaml } = await import('yaml')
      const sharp = (await import('sharp')).default

      const geminiKey = getEnv('GOOGLE_GEMINI_API_KEY')
      if (!geminiKey) {
        return { content: [{ type: 'text' as const, text: 'Error: GOOGLE_GEMINI_API_KEY not set' }], isError: true }
      }

      let imageStyle: any = { base_style: '', header: { width: 1200, height: 675, style_suffix: '' }, lighting_moods: [], color_palettes: [], negative_prompt: '' }
      try {
        const raw = await getFileContent('content-config/image-style.yaml')
        imageStyle = parseYaml(raw)
      } catch { /* defaults */ }

      const cfg = imageStyle[type] || imageStyle.header
      const mood = imageStyle.lighting_moods?.length
        ? imageStyle.lighting_moods[Math.floor(Math.random() * imageStyle.lighting_moods.length)]
        : ''
      const palette = imageStyle.color_palettes?.length
        ? imageStyle.color_palettes[Math.floor(Math.random() * imageStyle.color_palettes.length)]
        : ''

      const fullPrompt = [
        imageStyle.base_style,
        cfg.style_suffix,
        mood ? `Lighting: ${mood}` : '',
        palette ? `Color palette: ${palette}` : '',
        prompt,
        `Aspect ratio: ${cfg.width}x${cfg.height}`,
        imageStyle.negative_prompt ? `Avoid: ${imageStyle.negative_prompt}` : '',
      ].filter(Boolean).join('. ')

      const ai = new GoogleGenAI({ apiKey: geminiKey })
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: fullPrompt,
        config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
      })

      const parts = response.candidates?.[0]?.content?.parts || []
      const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'))

      if (!imagePart?.inlineData?.data) {
        return { content: [{ type: 'text' as const, text: 'Image generation returned no image.' }], isError: true }
      }

      const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64')
      const optimized = await sharp(imageBuffer)
        .resize(cfg.width || 1200, cfg.height || 675, { fit: 'cover' })
        .webp({ quality: 85 })
        .toBuffer()

      const suffix = type === 'header' ? 'titelbild' : `bild-${Date.now()}`
      const filename = `${slug}-${suffix}.webp`
      const url = await uploadBufferToR2(optimized, filename)

      return {
        content: [{
          type: 'text' as const,
          text: `Image generated and uploaded.\nURL: ${url}`
        }]
      }
    }
  )

  const createPostFileTool = tool(
    'create_post_file',
    'Create a new blog post via GitHub API (triggers Vercel deploy).',
    {
      title: z.string(),
      summary: z.string(),
      tags: z.array(z.string()),
      body: z.string(),
      imageUrl: z.string().optional(),
      draft: z.boolean().default(false),
    },
    async ({ title, summary, tags, body, imageUrl, draft }) => {
      const { fixUmlauts, hasUmlautIssues } = await import('../../src/lib/fix-umlauts.js')

      let fixedTitle = title
      let fixedSummary = summary
      let fixedBody = body

      if (hasUmlautIssues(title + ' ' + summary + ' ' + body)) {
        fixedTitle = fixUmlauts(title)
        fixedSummary = fixUmlauts(summary)
        fixedBody = fixUmlauts(body)
      }

      // Build slug
      const slug = fixedTitle
        .toLowerCase()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)

      const filePath = `src/content/posts/${slug}.md`

      if (await fileExists(filePath)) {
        return { content: [{ type: 'text' as const, text: `Post already exists: ${slug}` }], isError: true }
      }

      // Build content
      const date = new Date().toISOString().split('T')[0]
      const lines = [
        '---',
        `title: '${fixedTitle.replace(/'/g, "''")}'`,
        `date: '${date}'`,
        `summary: '${fixedSummary.replace(/'/g, "''")}'`,
        `tags: [${tags.map(t => `'${t}'`).join(', ')}]`,
        `authors: ['default']`,
        `draft: ${draft}`,
      ]
      if (imageUrl) lines.push(`images: '${imageUrl}'`)
      lines.push('---', '', fixedBody)
      const content = lines.join('\n')

      const commitMessage = `📝 Neuer Blogpost: ${fixedTitle}`
      const { htmlUrl } = await createFile(filePath, content, commitMessage)

      return {
        content: [{
          type: 'text' as const,
          text: `Post created via GitHub API.\nSlug: ${slug}\nGitHub: ${htmlUrl}\nURL: https://www.kokomo.house/tiny-house/${slug}`
        }]
      }
    }
  )

  return [
    readStyleConfigTool,
    listRecentPostsTool,
    readPostTool,
    generateImageTool,
    createPostFileTool,
  ]
}
