/**
 * Blog Agent API — SSE streaming endpoint
 *
 * Uses @anthropic-ai/sdk with manual tool loop (Agent SDK spawns processes,
 * which doesn't work on Vercel serverless).
 *
 * POST /api/admin/agent
 * Body: { message: string, history?: Array<{role, content}> }
 * Returns: SSE stream with agent responses
 */

import type { APIRoute } from 'astro'
import Anthropic from '@anthropic-ai/sdk'
import { isAuthenticated } from '../../../lib/admin-auth'
import {
  getFileContent,
  listPostFiles,
  fileExists,
  createFile,
} from '../../../lib/github'
import { uploadBufferToR2 } from '../../../lib/r2'
import { fixUmlauts, hasUmlautIssues } from '../../../lib/fix-umlauts'
import { parse as parseYaml } from 'yaml'

export const prerender = false

const MAX_TOOL_ROUNDS = 8

// System prompt (same as agent/core.ts but self-contained for serverless)
const SYSTEM_PROMPT = `Du bist der KOKOMO Blog-Agent. Du hilfst Sibylle und Michi, Blogposts für ihr Tiny-House-Blog zu schreiben.

## Dein Workflow (4 Phasen)

### Phase 1: Outline
1. Lies zuerst die Style-Config mit dem Tool read_style_config (config: "writing")
2. Lies die letzten Posts mit list_recent_posts (count: 10) um Duplikate zu vermeiden
3. Schlage eine Outline vor:
   - Titel (max 60 Zeichen)
   - Angle / Perspektive
   - Post-Typ (Erzählung, Listenpost, Anleitung, Erfahrungsbericht)
   - H2-Abschnitte mit je 1-2 Sätzen Beschreibung
4. Warte auf Feedback und überarbeite die Outline bei Bedarf

### Phase 2: Draft
Wenn die Outline freigegeben ist, schreibe den kompletten Post:
- Titel (max 60 Zeichen)
- Summary (160-180 Zeichen)
- 5 Tags (aus bestehenden Tags oder neue passende)
- Body (mindestens 500 Wörter)
- Image Prompt (auf Englisch, für Gemini Imagen)

### Phase 3: Revision
- Überarbeite gezielt nur was der User bemängelt
- Beliebig viele Revisions-Runden
- Zeige nach jeder Änderung den aktualisierten Text

### Phase 4: Publish
Erst auf expliziten Wunsch des Users ("publizieren"):
1. Generiere das Titelbild mit generate_image
2. Erstelle die Post-Datei mit create_post_file

## Wichtige Regeln
- Sprache: Deutsch (Schweizer Hochdeutsch, de-CH)
- KEIN ß — immer "ss" verwenden
- IMMER echte Umlaute: ä, ö, ü (NIEMALS ae, oe, ue)
- Du-Form, "wir"-Perspektive (Sibylle & Michi)
- Ton: authentisch, persönlich, nahbar, leicht humorvoll, nicht belehrend
- Variiere Absatzlängen und nutze Zwischenüberschriften (H2)
- Verwende **Fettschrift** für Schlüsselbegriffe
- Antworte immer auf Deutsch
- Formatiere Outlines und Drafts mit Markdown
`

// Tool definitions for Anthropic API
const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'read_style_config',
    description: 'Read the KOKOMO writing style or image style configuration (YAML).',
    input_schema: {
      type: 'object' as const,
      properties: {
        config: { type: 'string', enum: ['writing', 'image', 'both'] },
      },
      required: ['config'],
    },
  },
  {
    name: 'list_recent_posts',
    description: 'List frontmatter of the most recent blog posts.',
    input_schema: {
      type: 'object' as const,
      properties: {
        count: { type: 'number', default: 20 },
      },
      required: [],
    },
  },
  {
    name: 'read_post',
    description: 'Read the full content of a blog post by slug.',
    input_schema: {
      type: 'object' as const,
      properties: {
        slug: { type: 'string' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'generate_image',
    description: 'Generate a header image using Gemini Imagen and upload to R2.',
    input_schema: {
      type: 'object' as const,
      properties: {
        prompt: { type: 'string' },
        slug: { type: 'string' },
        type: { type: 'string', enum: ['header', 'inline'], default: 'header' },
      },
      required: ['prompt', 'slug'],
    },
  },
  {
    name: 'create_post_file',
    description: 'Create a new blog post via GitHub API.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string' },
        summary: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        body: { type: 'string' },
        imageUrl: { type: 'string' },
        draft: { type: 'boolean', default: false },
      },
      required: ['title', 'summary', 'tags', 'body'],
    },
  },
]

// Tool handlers
async function handleTool(name: string, input: any, env: any): Promise<string> {
  switch (name) {
    case 'read_style_config': {
      const results: string[] = []
      if (input.config === 'writing' || input.config === 'both') {
        results.push('=== writing-style.yaml ===\n' + await getFileContent('content-config/writing-style.yaml'))
      }
      if (input.config === 'image' || input.config === 'both') {
        results.push('=== image-style.yaml ===\n' + await getFileContent('content-config/image-style.yaml'))
      }
      return results.join('\n\n')
    }

    case 'list_recent_posts': {
      const count = input.count || 20
      const files = await listPostFiles()
      const sorted = files.sort().reverse().slice(0, count)
      const posts: string[] = []

      for (const file of sorted) {
        try {
          const raw = await getFileContent(`src/content/posts/${file}`)
          const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/)
          if (fmMatch) {
            const data = parseYaml(fmMatch[1])
            posts.push(`- **${data.title}** (${data.date})\n  Tags: ${(data.tags || []).join(', ')}\n  Summary: ${data.summary || ''}`)
          }
        } catch { /* skip */ }
      }
      return posts.join('\n\n')
    }

    case 'read_post': {
      return await getFileContent(`src/content/posts/${input.slug}.md`)
    }

    case 'generate_image': {
      const { GoogleGenAI, Modality } = await import('@google/genai')
      const sharp = (await import('sharp')).default

      const geminiKey = env.GOOGLE_GEMINI_API_KEY
      if (!geminiKey) return 'Error: GOOGLE_GEMINI_API_KEY not configured'

      let imageStyle: any = { base_style: '', header: { width: 1200, height: 675, style_suffix: '' }, lighting_moods: [], color_palettes: [], negative_prompt: '' }
      try {
        imageStyle = parseYaml(await getFileContent('content-config/image-style.yaml'))
      } catch { /* defaults */ }

      const type = input.type || 'header'
      const cfg = imageStyle[type] || imageStyle.header
      const mood = imageStyle.lighting_moods?.length
        ? imageStyle.lighting_moods[Math.floor(Math.random() * imageStyle.lighting_moods.length)]
        : ''
      const palette = imageStyle.color_palettes?.length
        ? imageStyle.color_palettes[Math.floor(Math.random() * imageStyle.color_palettes.length)]
        : ''

      const fullPrompt = [
        imageStyle.base_style, cfg.style_suffix,
        mood ? `Lighting: ${mood}` : '',
        palette ? `Color palette: ${palette}` : '',
        input.prompt,
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

      if (!imagePart?.inlineData?.data) return 'Error: No image generated'

      const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64')
      const optimized = await sharp(imageBuffer)
        .resize(cfg.width || 1200, cfg.height || 675, { fit: 'cover' })
        .webp({ quality: 85 })
        .toBuffer()

      const suffix = type === 'header' ? 'titelbild' : `bild-${Date.now()}`
      const filename = `${input.slug}-${suffix}.webp`
      const url = await uploadBufferToR2(optimized, filename)

      return `Image uploaded: ${url}`
    }

    case 'create_post_file': {
      let { title, summary, body } = input
      const { tags, imageUrl, draft } = input

      if (hasUmlautIssues(title + ' ' + summary + ' ' + body)) {
        title = fixUmlauts(title)
        summary = fixUmlauts(summary)
        body = fixUmlauts(body)
      }

      const slug = title
        .toLowerCase()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)

      const filePath = `src/content/posts/${slug}.md`
      if (await fileExists(filePath)) return `Error: Post already exists: ${slug}`

      const date = new Date().toISOString().split('T')[0]
      const lines = [
        '---',
        `title: '${title.replace(/'/g, "''")}'`,
        `date: '${date}'`,
        `summary: '${summary.replace(/'/g, "''")}'`,
        `tags: [${tags.map((t: string) => `'${t}'`).join(', ')}]`,
        `authors: ['default']`,
        `draft: ${draft ?? false}`,
      ]
      if (imageUrl) lines.push(`images: '${imageUrl}'`)
      lines.push('---', '', body)

      const commitMessage = `📝 Neuer Blogpost: ${title}`
      const { htmlUrl } = await createFile(filePath, lines.join('\n'), commitMessage)

      return `Post created.\nSlug: ${slug}\nGitHub: ${htmlUrl}\nURL: https://www.kokomo.house/tiny-house/${slug}`
    }

    default:
      return `Unknown tool: ${name}`
  }
}

export const POST: APIRoute = async ({ request }) => {
  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { message, history } = await request.json()

  if (!message) {
    return new Response(JSON.stringify({ error: 'Message required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const apiKey = import.meta.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const env = {
    GOOGLE_GEMINI_API_KEY: import.meta.env.GOOGLE_GEMINI_API_KEY,
  }

  const client = new Anthropic({ apiKey })

  // Build messages array from history + new message
  const messages: Anthropic.MessageParam[] = [
    ...(history || []),
    { role: 'user', content: message },
  ]

  // SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: any) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        let currentMessages = messages
        let rounds = 0

        while (rounds < MAX_TOOL_ROUNDS) {
          rounds++

          const response = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 8192,
            system: SYSTEM_PROMPT,
            tools: TOOL_DEFINITIONS,
            messages: currentMessages,
          })

          // Stream text blocks
          for (const block of response.content) {
            if (block.type === 'text') {
              send('text', { text: block.text })
            } else if (block.type === 'tool_use') {
              send('tool_use', { name: block.name, input: block.input })
            }
          }

          // If no tool use, we're done
          if (response.stop_reason !== 'tool_use') {
            send('done', {
              usage: response.usage,
              stop_reason: response.stop_reason,
            })
            break
          }

          // Handle tool calls
          const toolResults: Anthropic.ToolResultBlockParam[] = []
          for (const block of response.content) {
            if (block.type === 'tool_use') {
              try {
                const result = await handleTool(block.name, block.input, env)
                send('tool_result', { name: block.name, success: true })
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: result,
                })
              } catch (err: any) {
                send('tool_result', { name: block.name, success: false, error: err.message })
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: `Error: ${err.message}`,
                  is_error: true,
                })
              }
            }
          }

          // Continue conversation with tool results
          currentMessages = [
            ...currentMessages,
            { role: 'assistant', content: response.content },
            { role: 'user', content: toolResults },
          ]
        }
      } catch (err: any) {
        send('error', { message: err.message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
