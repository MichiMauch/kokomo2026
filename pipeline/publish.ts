#!/usr/bin/env npx tsx
/**
 * Publish Pipeline Orchestrator
 *
 * Full workflow: Brief YAML → Generate Image → Create Post → Git Commit
 *
 * Usage:
 *   npx tsx pipeline/publish.ts src/content/briefs/my-topic.yaml
 *
 * The brief YAML should contain the AI-generated post data:
 *   title, summary, tags, body, image_prompt
 *
 * Steps:
 *   1. Read & validate brief
 *   2. Generate header image (Gemini → R2)
 *   3. Create markdown post file
 *   4. Print git commands (user runs manually or via /publish skill)
 */

import { readFileSync, unlinkSync } from 'fs'
import { resolve } from 'path'
import { config } from 'dotenv'
import { parse as parseYaml } from 'yaml'
import { generateImage } from './generate-images.js'
import { createPostFile, slugify, type PostData } from './create-post-file.js'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

interface Brief {
  title: string
  summary: string
  tags: string[]
  body: string
  image_prompt?: string
  image_url?: string  // Skip generation if already provided
  youtube?: string
  date?: string
  draft?: boolean
}

function validateBrief(brief: Brief): string[] {
  const errors: string[] = []

  if (!brief.title) errors.push('Missing: title')
  if (!brief.summary) errors.push('Missing: summary')
  if (!brief.tags || brief.tags.length === 0) errors.push('Missing: tags')
  if (!brief.body) errors.push('Missing: body')
  if (brief.summary && brief.summary.length > 300) {
    errors.push(`Summary too long: ${brief.summary.length} chars (max 300)`)
  }

  return errors
}

export async function publishFromBrief(briefPath: string): Promise<{
  slug: string
  filePath: string
  imageUrl?: string
}> {
  console.log('\n📋 Reading brief...')
  const raw = readFileSync(resolve(briefPath), 'utf-8')
  const brief: Brief = parseYaml(raw)

  // Validate
  const errors = validateBrief(brief)
  if (errors.length > 0) {
    throw new Error(`Brief validation failed:\n  ${errors.join('\n  ')}`)
  }

  const slug = slugify(brief.title)
  console.log(`   Title: ${brief.title}`)
  console.log(`   Slug: ${slug}`)
  console.log(`   Tags: ${brief.tags.join(', ')}`)

  // Step 1: Generate or use existing image
  let imageUrl = brief.image_url

  if (!imageUrl && brief.image_prompt) {
    console.log('\n🎨 Generating header image...')
    try {
      const result = await generateImage(brief.image_prompt, 'header', slug)
      imageUrl = result.url
    } catch (err: any) {
      console.warn(`⚠️  Image generation failed: ${err.message}`)
      console.warn('   Continuing without image...')
    }
  }

  // Step 2: Create post file
  console.log('\n📝 Creating post file...')
  const postData: PostData = {
    title: brief.title,
    summary: brief.summary,
    tags: brief.tags,
    body: brief.body,
    imageUrl,
    youtube: brief.youtube,
    date: brief.date,
    draft: brief.draft,
  }

  const result = createPostFile(postData)

  // Step 3: Print next steps
  console.log('\n' + '='.repeat(60))
  console.log('✅ Post ready for publishing!')
  console.log('='.repeat(60))
  console.log(`\nFile: ${result.filePath}`)
  if (imageUrl) {
    console.log(`Image: ${imageUrl}`)
  }
  console.log(`\nNext steps:`)
  console.log(`  git add src/content/posts/${slug}.md`)
  console.log(`  git commit -m "📝 Neuer Blogpost: ${brief.title}"`)
  console.log(`  git push`)
  console.log(`\nVercel will auto-deploy after push.`)

  return {
    slug,
    filePath: result.filePath,
    imageUrl,
  }
}

// CLI mode
if (process.argv[1]?.includes('publish')) {
  ;(async () => {
    const briefPath = process.argv[2]

    if (!briefPath) {
      console.error('Usage: npx tsx pipeline/publish.ts <brief.yaml>')
      console.error('Example: npx tsx pipeline/publish.ts src/content/briefs/my-topic.yaml')
      process.exit(1)
    }

    try {
      await publishFromBrief(briefPath)
    } catch (err: any) {
      console.error(`\n❌ Publish failed: ${err.message}`)
      process.exit(1)
    }
  })()
}
