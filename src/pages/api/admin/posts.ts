import type { APIRoute } from 'astro'
import { isAuthenticated } from '../../../lib/admin-auth'
import { getFileContent, updateFile, deleteFile } from '../../../lib/github'
import { parse as parseYaml } from 'yaml'

export const prerender = false

const headers = { 'Content-Type': 'application/json' }

/**
 * Parse frontmatter and body from markdown content
 */
function parsePost(content: string): { fm: Record<string, any>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { fm: {}, body: content }
  try {
    return { fm: parseYaml(match[1]) || {}, body: match[2].trim() }
  } catch {
    return { fm: {}, body: content }
  }
}

/**
 * GET ?slug=<slug> — Load a single post (frontmatter + body)
 */
export const GET: APIRoute = async ({ request }) => {
  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  try {
    const url = new URL(request.url)
    const slug = url.searchParams.get('slug')
    if (!slug) {
      return new Response(JSON.stringify({ error: 'slug Parameter fehlt' }), { status: 400, headers })
    }

    const content = await getFileContent(`src/content/posts/${slug}.md`)
    const { fm, body } = parsePost(content)

    return new Response(
      JSON.stringify({
        slug,
        title: fm.title || slug,
        date: fm.date || '',
        summary: fm.summary || '',
        tags: fm.tags || [],
        draft: fm.draft ?? false,
        imageUrl: fm.images || null,
        body,
      }),
      { status: 200, headers }
    )
  } catch (err: any) {
    console.error('[admin/posts GET]', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}

/**
 * PUT — Save post changes (merge edited fields into existing frontmatter)
 */
export const PUT: APIRoute = async ({ request }) => {
  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  try {
    const { slug, title, summary, tags, draft, body } = await request.json()

    if (!slug) {
      return new Response(JSON.stringify({ error: 'Slug fehlt' }), { status: 400, headers })
    }

    const filePath = `src/content/posts/${slug}.md`
    const existing = await getFileContent(filePath)
    const { fm } = parsePost(existing)

    // Merge: only overwrite fields that were sent
    if (title !== undefined) fm.title = title
    if (summary !== undefined) fm.summary = summary
    if (tags !== undefined) fm.tags = tags
    if (draft !== undefined) fm.draft = draft

    // Build frontmatter line by line (preserve field order, escape single quotes)
    const esc = (s: string) => s.replace(/'/g, "''")
    const lines = [
      '---',
      `title: '${esc(fm.title || '')}'`,
      `date: '${fm.date || ''}'`,
      `summary: '${esc(fm.summary || '')}'`,
      `tags: [${(fm.tags || []).map((t: string) => `'${esc(t)}'`).join(', ')}]`,
      `authors: [${(fm.authors || ['default']).map((a: string) => `'${a}'`).join(', ')}]`,
      `draft: ${fm.draft ?? false}`,
    ]

    if (fm.images) {
      lines.push(`images: '${fm.images}'`)
    }
    if (fm.youtube) {
      lines.push(`youtube: '${fm.youtube}'`)
    }
    if (fm.canonicalUrl) {
      lines.push(`canonicalUrl: '${fm.canonicalUrl}'`)
    }

    lines.push('---', '')

    const newBody = body !== undefined ? body : ''
    const updatedContent = lines.join('\n') + newBody

    await updateFile(filePath, updatedContent, `✏️ Post bearbeitet: ${fm.title || slug}`)

    return new Response(JSON.stringify({ success: true, slug }), { status: 200, headers })
  } catch (err: any) {
    console.error('[admin/posts PUT]', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}

/**
 * DELETE — Delete a post by slug
 */
export const DELETE: APIRoute = async ({ request }) => {
  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  try {
    const { slug } = await request.json()
    if (!slug) {
      return new Response(JSON.stringify({ error: 'Slug fehlt' }), { status: 400, headers })
    }

    const filePath = `src/content/posts/${slug}.md`
    await deleteFile(filePath, `🗑️ Post gelöscht: ${slug}`)

    return new Response(JSON.stringify({ success: true, slug }), { status: 200, headers })
  } catch (err: any) {
    console.error('[admin/posts DELETE]', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}
