#!/usr/bin/env npx tsx
/**
 * Generate images using Google Gemini Imagen API
 *
 * Usage as CLI:
 *   npx tsx pipeline/generate-images.ts "A cozy tiny house in Swiss countryside" header my-post
 *
 * Usage as module:
 *   import { generateImage } from './generate-images'
 *   const url = await generateImage('prompt', 'header', 'slug')
 */

import { GoogleGenAI, Modality } from '@google/genai'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { config } from 'dotenv'
import { parse as parseYaml } from 'yaml'
import sharp from 'sharp'
import { uploadBufferToR2 } from './upload-to-r2.js'

// Load env
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

// Load image style config
const imageStylePath = resolve(process.cwd(), 'content-config/image-style.yaml')
const imageStyle = parseYaml(readFileSync(imageStylePath, 'utf-8'))

interface ImageConfig {
  width: number
  height: number
  style_suffix: string
}

function getImageConfig(type: 'header' | 'inline'): ImageConfig {
  return imageStyle[type] || imageStyle.header
}

/**
 * Generate an image with Gemini Imagen and upload to R2
 */
export async function generateImage(
  prompt: string,
  type: 'header' | 'inline' = 'header',
  slug: string
): Promise<{ url: string; prompt: string }> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Missing GOOGLE_GEMINI_API_KEY in .env.local')
  }

  const ai = new GoogleGenAI({ apiKey })
  const cfg = getImageConfig(type)

  // Dynamic prompting: pick random lighting mood and color palette
  const lightingMoods: string[] = imageStyle.lighting_moods || []
  const colorPalettes: string[] = imageStyle.color_palettes || []
  const randomLighting = lightingMoods.length
    ? lightingMoods[Math.floor(Math.random() * lightingMoods.length)]
    : ''
  const randomPalette = colorPalettes.length
    ? colorPalettes[Math.floor(Math.random() * colorPalettes.length)]
    : ''

  // Build the full prompt with composition layering:
  // 1. Base style (camera, lens, general look)
  // 2. Type-specific suffix (composition, focal length)
  // 3. Dynamic lighting mood
  // 4. Dynamic color palette
  // 5. Scene-specific prompt (subject, action, environment)
  // 6. Technical constraints
  const negativePrompt = imageStyle.negative_prompt || ''

  const fullPrompt = [
    imageStyle.base_style,
    cfg.style_suffix,
    randomLighting ? `Lighting: ${randomLighting}` : '',
    randomPalette ? `Color palette: ${randomPalette}` : '',
    prompt,
    `Aspect ratio: ${cfg.width}x${cfg.height}`,
    negativePrompt ? `Avoid: ${negativePrompt}` : '',
  ].filter(Boolean).join('. ')

  console.log(`🎨 Generating ${type} image for "${slug}"...`)
  console.log(`   Prompt: ${fullPrompt.slice(0, 120)}...`)

  // Use Gemini with image generation
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: fullPrompt,
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  })

  // Extract image from response
  const parts = response.candidates?.[0]?.content?.parts || []
  const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'))

  if (!imagePart?.inlineData) {
    throw new Error('No image generated. The model may not support image output with this prompt.')
  }

  // Decode base64 image
  const imageBuffer = Buffer.from(imagePart.inlineData.data!, 'base64')

  // Resize and convert to WebP with sharp
  const optimized = await sharp(imageBuffer)
    .resize(cfg.width, cfg.height, { fit: 'cover' })
    .webp({ quality: 75 })
    .toBuffer()

  // Upload to R2
  const suffix = type === 'header' ? 'titelbild' : `bild-${Date.now()}`
  const filename = `${slug}-${suffix}.webp`
  const url = await uploadBufferToR2(optimized, filename)

  console.log(`✅ Image uploaded: ${url}`)
  console.log(`   Size: ${(optimized.length / 1024).toFixed(1)} KB`)

  return { url, prompt: fullPrompt }
}

// CLI mode
if (process.argv[1]?.includes('generate-images')) {
  ;(async () => {
    const [, , prompt, type = 'header', slug = 'test-image'] = process.argv

    if (!prompt) {
      console.error('Usage: npx tsx pipeline/generate-images.ts "<prompt>" [header|inline] [slug]')
      process.exit(1)
    }

    try {
      const result = await generateImage(prompt, type as 'header' | 'inline', slug)
      console.log(`\nResult: ${result.url}`)
    } catch (err: any) {
      console.error(`❌ Generation failed: ${err.message}`)
      process.exit(1)
    }
  })()
}
