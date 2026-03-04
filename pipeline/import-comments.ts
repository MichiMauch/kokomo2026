#!/usr/bin/env npx tsx
/**
 * Import comments from GitHub Issues (MichiMauch/kokomo)
 *
 * Reads issues with label "blog-comments" and imports their comments into Turso.
 *
 * Usage:
 *   npx tsx pipeline/import-comments.ts
 */

import { resolve } from 'path'
import { config } from 'dotenv'
import { createClient } from '@libsql/client'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GITHUB_ACCESS_TOKEN
const REPO_OWNER = 'MichiMauch'
const REPO_NAME = 'kokomo'

async function githubFetch(url: string) {
  const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' }
  if (GITHUB_TOKEN) headers.Authorization = `token ${GITHUB_TOKEN}`

  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${await res.text()}`)
  return res.json()
}

async function main() {
  const dbUrl = process.env.TURSO_DB_URL
  const dbToken = process.env.TURSO_DB_TOKEN

  if (!dbUrl || !dbToken) {
    console.error('❌ TURSO_DB_URL and TURSO_DB_TOKEN must be set')
    process.exit(1)
  }

  const db = createClient({ url: dbUrl, authToken: dbToken })

  // Create schema
  console.log('📋 Creating schema...')
  await db.execute(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_slug TEXT NOT NULL,
      parent_id INTEGER REFERENCES comments(id),
      author_name TEXT NOT NULL,
      author_email TEXT NOT NULL,
      content TEXT NOT NULL,
      approved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      imported_from TEXT
    )
  `)
  await db.execute('CREATE INDEX IF NOT EXISTS idx_comments_slug ON comments(post_slug)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id)')
  console.log('✅ Schema ready')

  // Fetch issues with blog-comments label
  console.log('\n📥 Fetching GitHub issues...')
  const issues = await githubFetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues?labels=blog-comments&state=all&per_page=100`,
  )
  console.log(`   Found ${issues.length} issues`)

  let totalImported = 0
  let totalSkipped = 0

  for (const issue of issues) {
    // Parse slug from title: "Comments for: {slug}"
    const match = issue.title.match(/^Comments for:\s*(.+)$/i)
    if (!match) {
      console.log(`⚠️  Skipping issue #${issue.number}: "${issue.title}" (no slug match)`)
      continue
    }
    const slug = match[1].trim()
    console.log(`\n📝 Processing: ${slug} (issue #${issue.number})`)

    // Fetch comments for this issue
    const ghComments = await githubFetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issue.number}/comments?per_page=100`,
    )

    // Parse comments: two passes for threading
    interface ParsedComment {
      github_id: number
      author_name: string
      author_email: string
      content: string
      approved: number
      created_at: string
      parent_github_id: number | null
    }

    const parsed: ParsedComment[] = []

    for (const gc of ghComments) {
      const body: string = gc.body || ''
      const lines = body.split('\n')

      let approved = 0
      let authorName = gc.user?.login || 'Anonym'
      let authorEmail = ''
      let parentGithubId: number | null = null
      const contentLines: string[] = []

      for (const line of lines) {
        if (line.trim() === '[APPROVED]') {
          approved = 1
          continue
        }

        const nameMatch = line.match(/^\*\*(.+?)\*\*\s*\((.+?)\)/)
        if (nameMatch) {
          authorName = nameMatch[1]
          authorEmail = nameMatch[2]
          continue
        }

        const parentMatch = line.match(/^parent_id:\s*(\d+)/)
        if (parentMatch) {
          parentGithubId = Number(parentMatch[1])
          continue
        }

        contentLines.push(line)
      }

      const content = contentLines.join('\n').trim()
      if (!content) continue

      parsed.push({
        github_id: gc.id,
        author_name: authorName,
        author_email: authorEmail || `${authorName.toLowerCase().replace(/\s+/g, '.')}@imported.local`,
        content,
        approved,
        created_at: gc.created_at,
        parent_github_id: parentGithubId,
      })
    }

    // Pass 1: Insert top-level comments
    const githubIdToTursoId = new Map<number, number>()

    for (const pc of parsed.filter((p) => p.parent_github_id === null)) {
      // Check for duplicates
      const existing = await db.execute({
        sql: 'SELECT id FROM comments WHERE imported_from = ?',
        args: [`github:${pc.github_id}`],
      })

      if (existing.rows.length > 0) {
        githubIdToTursoId.set(pc.github_id, existing.rows[0].id as number)
        totalSkipped++
        continue
      }

      const result = await db.execute({
        sql: `INSERT INTO comments (post_slug, parent_id, author_name, author_email, content, approved, created_at, imported_from)
              VALUES (?, NULL, ?, ?, ?, ?, ?, ?)`,
        args: [slug, pc.author_name, pc.author_email, pc.content, pc.approved, pc.created_at, `github:${pc.github_id}`],
      })

      githubIdToTursoId.set(pc.github_id, Number(result.lastInsertRowid))
      totalImported++
    }

    // Pass 2: Insert replies
    for (const pc of parsed.filter((p) => p.parent_github_id !== null)) {
      const existing = await db.execute({
        sql: 'SELECT id FROM comments WHERE imported_from = ?',
        args: [`github:${pc.github_id}`],
      })

      if (existing.rows.length > 0) {
        totalSkipped++
        continue
      }

      const parentTursoId = githubIdToTursoId.get(pc.parent_github_id!) ?? null

      const result = await db.execute({
        sql: `INSERT INTO comments (post_slug, parent_id, author_name, author_email, content, approved, created_at, imported_from)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [slug, parentTursoId, pc.author_name, pc.author_email, pc.content, pc.approved, pc.created_at, `github:${pc.github_id}`],
      })

      githubIdToTursoId.set(pc.github_id, Number(result.lastInsertRowid))
      totalImported++
    }

    console.log(`   ${parsed.length} comments found, ${parsed.filter((p) => !githubIdToTursoId.has(p.github_id) || true).length} processed`)
  }

  console.log('\n' + '='.repeat(60))
  console.log(`✅ Import abgeschlossen!`)
  console.log(`   Importiert: ${totalImported}`)
  console.log(`   Übersprungen (Duplikate): ${totalSkipped}`)
  console.log('='.repeat(60))
}

main().catch((err) => {
  console.error(`\n❌ Import failed: ${err.message}`)
  process.exit(1)
})
