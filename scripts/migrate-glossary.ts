/**
 * Einmaliges Migrations-Script: Parst glossar.md und erzeugt glossary.yaml
 * Usage: npx tsx scripts/migrate-glossary.ts
 */
import { readFileSync, writeFileSync } from 'fs'
import { stringify } from 'yaml'

const md = readFileSync('src/content/posts/glossar.md', 'utf-8')

// Skip frontmatter
const body = md.replace(/^---[\s\S]*?---\s*/, '')

const terms: { term: string; definition: string }[] = []

for (const line of body.split('\n')) {
  const match = line.match(/^- \*\*(.+?):\*\*\s*(.+)$/)
  if (match) {
    terms.push({
      term: match[1].trim(),
      definition: match[2].trim(),
    })
  }
}

console.log(`Parsed ${terms.length} terms`)

const yaml = stringify(terms, { lineWidth: 0 })
writeFileSync('src/data/glossary.yaml', yaml, 'utf-8')
console.log('Written to src/data/glossary.yaml')
