#!/usr/bin/env node

/**
 * Migration Script: kokomo (Next.js/MDX) → kokomo2026 (Astro/MD)
 *
 * Converts all blog posts from the old kokomo project:
 * 1. Replaces {IMAGE_PATH} with full Cloudflare R2 URL
 * 2. Extracts YouTubeEmbed videoId into frontmatter
 * 3. Removes import statements
 * 4. Removes non-standard frontmatter fields (type)
 * 5. Renames .mdx → .md
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const SOURCE_DIR = '/Users/michaelmauch/Documents/Development/kokomo/data/tiny-house'
const TARGET_DIR = '/Users/michaelmauch/Documents/Development/kokomo2026/src/content/posts'
const R2_BASE_URL = 'https://pub-29ede69a4da644b9b81fa3dd5f8e9d6a.r2.dev'

// Stats
let stats = {
  total: 0,
  migrated: 0,
  skipped: 0,
  imagePathReplacements: 0,
  youtubeExtractions: 0,
  importRemovals: 0,
  typeFieldRemovals: 0,
  htmlImgReplacements: 0,
}

function migratePost(filePath) {
  const filename = path.basename(filePath)
  const slug = filename.replace('.mdx', '')
  const raw = fs.readFileSync(filePath, 'utf-8')

  // Parse frontmatter
  const { data: frontmatter, content } = matter(raw)

  // --- Frontmatter Cleanup ---

  // Remove non-standard 'type' field
  if (frontmatter.type) {
    delete frontmatter.type
    stats.typeFieldRemovals++
  }

  // Ensure required fields have defaults
  if (!frontmatter.authors) frontmatter.authors = ['default']
  if (frontmatter.draft === undefined) frontmatter.draft = false

  // --- Content Transformations ---
  let newContent = content

  // 1. Replace {IMAGE_PATH} with R2 URL (markdown images)
  const imagePathRegex = /\{IMAGE_PATH\}/g
  const imagePathMatches = newContent.match(imagePathRegex)
  if (imagePathMatches) {
    stats.imagePathReplacements += imagePathMatches.length
    newContent = newContent.replace(imagePathRegex, R2_BASE_URL)
  }

  // 2. Replace HTML <img> tags with {IMAGE_PATH}
  // Pattern: <img src="{IMAGE_PATH}/..." ... />
  // Already handled by step 1 since we replace all {IMAGE_PATH} occurrences

  // 3. Extract YouTubeEmbed components → frontmatter youtube field
  const youtubeRegex = /<YouTubeEmbed\s+videoId="([^"]+)"\s*\/>/g
  const youtubeMatch = youtubeRegex.exec(newContent)
  if (youtubeMatch) {
    frontmatter.youtube = youtubeMatch[1]
    stats.youtubeExtractions++
    // Replace the component with a markdown placeholder
    newContent = newContent.replace(
      /<YouTubeEmbed\s+videoId="([^"]+)"\s*\/>/g,
      (_, videoId) =>
        `{% youtube ${videoId} %}\n\n> Video: [Auf YouTube ansehen](https://www.youtube.com/watch?v=${videoId})`
    )
  }

  // 4. Remove import statements
  const importRegex = /^import\s+.*from\s+['"].*['"];?\s*$/gm
  const importMatches = newContent.match(importRegex)
  if (importMatches) {
    stats.importRemovals += importMatches.length
    newContent = newContent.replace(importRegex, '')
  }

  // 5. Clean up excessive blank lines (more than 2 consecutive)
  newContent = newContent.replace(/\n{4,}/g, '\n\n\n')

  // 6. Trim leading/trailing whitespace
  newContent = newContent.trim()

  // --- Build new frontmatter ---
  // Reorder fields for consistency
  const orderedFrontmatter = {}
  const fieldOrder = [
    'title',
    'date',
    'tags',
    'authors',
    'summary',
    'draft',
    'images',
    'youtube',
    'canonicalUrl',
    'lastmod',
  ]

  for (const field of fieldOrder) {
    if (frontmatter[field] !== undefined) {
      orderedFrontmatter[field] = frontmatter[field]
    }
  }

  // --- Write output ---
  const outputFilename = `${slug}.md`
  const outputPath = path.join(TARGET_DIR, outputFilename)

  const output = matter.stringify('\n' + newContent + '\n', orderedFrontmatter)
  fs.writeFileSync(outputPath, output, 'utf-8')

  stats.migrated++
  return { slug, hasImages: !!imagePathMatches, hasYoutube: !!youtubeMatch }
}

// --- Main ---
console.log('🚀 KOKOMO Blog Migration')
console.log(`   Source: ${SOURCE_DIR}`)
console.log(`   Target: ${TARGET_DIR}`)
console.log('')

// Ensure target directory exists
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true })
}

// Remove existing test post
const testPost = path.join(TARGET_DIR, 'test-post.md')
if (fs.existsSync(testPost)) {
  fs.unlinkSync(testPost)
  console.log('   Removed test-post.md')
}

// Get all MDX files
const files = fs
  .readdirSync(SOURCE_DIR)
  .filter((f) => f.endsWith('.mdx'))
  .sort()

stats.total = files.length
console.log(`   Found ${files.length} posts to migrate\n`)

const results = []

for (const file of files) {
  const filePath = path.join(SOURCE_DIR, file)
  try {
    const result = migratePost(filePath)
    results.push(result)
    const markers = [
      result.hasImages ? '📸' : '',
      result.hasYoutube ? '🎬' : '',
    ]
      .filter(Boolean)
      .join(' ')
    console.log(`   ✅ ${result.slug} ${markers}`)
  } catch (error) {
    stats.skipped++
    console.error(`   ❌ ${file}: ${error.message}`)
  }
}

console.log('\n--- Migration Summary ---')
console.log(`   Total files:         ${stats.total}`)
console.log(`   Migrated:            ${stats.migrated}`)
console.log(`   Skipped:             ${stats.skipped}`)
console.log(`   {IMAGE_PATH} fixes:  ${stats.imagePathReplacements}`)
console.log(`   YouTube extractions: ${stats.youtubeExtractions}`)
console.log(`   Import removals:     ${stats.importRemovals}`)
console.log(`   Type field removals: ${stats.typeFieldRemovals}`)
console.log('\n✅ Migration complete!')
