/**
 * Custom MCP tools for the KOKOMO Blog Agent (CLI / filesystem-based)
 */

import { tool, query } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod/v4'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'
import { parse as parseYaml } from 'yaml'
import matter from 'gray-matter'
import { execSync } from 'child_process'
import { generateImage } from '../../pipeline/generate-images.js'
import { createPostFile, slugify, buildPostContent } from '../../pipeline/create-post-file.js'

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
  },
  async ({ title, summary, tags, body, imageUrl, draft }) => {
    const result = createPostFile({
      title,
      summary,
      tags,
      body,
      imageUrl,
      draft,
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

// --- analyze_seo ---
const SEO_SYSTEM_PROMPT = `Du bist ein SEO-Experte für deutschsprachige Blogs im Bereich Tiny House, nachhaltiges Wohnen und Selbstversorgung.

Analysiere den gegebenen Blogpost-Draft und gib eine strukturierte SEO-Bewertung ab.

## Prüfkriterien

1. **Titel** (max 60 Zeichen für Google SERP)
   - Enthält das Hauptkeyword?
   - Weckt Neugier / hat einen klaren Nutzen?

2. **Meta-Description / Summary** (optimal 150-160 Zeichen)
   - Enthält das Hauptkeyword?
   - Hat einen Call-to-Action oder Nutzenversprechen?

3. **Keyword-Verteilung**
   - Hauptkeyword im Titel, Summary, erstem Absatz, mindestens einer H2?
   - Natürliche Keyword-Dichte (nicht erzwungen)?
   - Verwandte Begriffe / LSI-Keywords vorhanden?

4. **Struktur**
   - Mindestens 2-3 H2-Überschriften?
   - Logischer Aufbau?
   - Absätze nicht zu lang (max 3-4 Sätze)?

5. **Content-Qualität**
   - Mindestens 500 Wörter?
   - Einzigartiger Angle / Mehrwert?
   - Persönliche Erfahrung / E-E-A-T Signale?

6. **Interne Verlinkung**
   - Welche der bestehenden Posts passen thematisch und sollten verlinkt werden?
   - Welche Glossar-Begriffe kommen im Text vor und könnten verlinkt werden?

## Antwortformat

Antworte auf Deutsch mit:
- **SEO-Score**: Zahl von 1-10
- **Stärken**: Was gut ist (kurze Bullet-Liste)
- **Verbesserungen**: Konkrete, umsetzbare Vorschläge (kurze Bullet-Liste)
- **Keyword-Vorschlag**: Hauptkeyword und 3-5 verwandte Keywords
- **Verlinkungsvorschläge**: Interne Links zu bestehenden Posts und Glossar-Begriffen (mit Slugs)

Sei konkret und praxisnah. Keine generischen Tipps.`

export const analyzeSeoTool = tool(
  'analyze_seo',
  'Analyze a blog post draft for SEO quality using Claude Sonnet. Checks title, meta description, keyword usage, structure, content quality, and suggests internal links to existing posts and glossary terms. Call this after writing a draft (Phase 2) to optimize before publishing.',
  {
    title: z.string().describe('Post title'),
    summary: z.string().describe('Post summary / meta description'),
    tags: z.array(z.string()).describe('Post tags'),
    body: z.string().describe('Post body in Markdown'),
    focusKeyword: z.string().optional().describe('Optional main keyword to optimize for'),
  },
  async ({ title, summary, tags, body, focusKeyword }) => {
    // Gather context: existing posts for internal linking
    const postsDir = resolve(ROOT, 'src/content/posts')
    const files = readdirSync(postsDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, 30)

    const existingPosts = files.map(file => {
      const raw = readFileSync(resolve(postsDir, file), 'utf-8')
      const { data } = matter(raw)
      return `- ${data.title} (Slug: ${file.replace('.md', '')}, Tags: ${(data.tags || []).join(', ')})`
    }).join('\n')

    // Gather glossary terms
    let glossaryTerms = ''
    try {
      const glossaryRaw = readFileSync(resolve(ROOT, 'src/data/glossary.yaml'), 'utf-8')
      const terms = parseYaml(glossaryRaw) as { term: string }[]
      glossaryTerms = terms.map(t => t.term).join(', ')
    } catch { /* glossary not available */ }

    const prompt = `Analysiere diesen Blogpost-Draft:

## Titel
${title}

## Summary
${summary}

## Tags
${tags.join(', ')}

${focusKeyword ? `## Fokus-Keyword\n${focusKeyword}\n` : ''}
## Body
${body}

---

## Kontext: Bestehende Posts (für interne Verlinkung)
${existingPosts}

## Kontext: Glossar-Begriffe (für Verlinkung zu /glossar#begriff)
${glossaryTerms}

## Website
URL-Struktur: https://www.kokomo.house/tiny-house/{slug}
Glossar: https://www.kokomo.house/glossar#{begriff-slug}`

    // Call Claude Sonnet for SEO analysis
    let seoResult = ''
    for await (const message of query({ prompt, options: {
      systemPrompt: SEO_SYSTEM_PROMPT,
      model: 'claude-sonnet-4-6',
      maxTurns: 1,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
    }})) {
      const msg = message as any
      if (msg.type === 'result' && msg.subtype === 'success' && msg.result) {
        seoResult = msg.result
      }
    }

    return {
      content: [{
        type: 'text' as const,
        text: seoResult || 'SEO-Analyse konnte nicht durchgeführt werden.',
      }]
    }
  }
)

export const allTools = [
  readStyleConfigTool,
  listRecentPostsTool,
  readPostTool,
  generateImageTool,
  createPostFileTool,
  gitPublishTool,
  analyzeSeoTool,
]
