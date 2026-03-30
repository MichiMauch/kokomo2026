/**
 * Shared Gemini image enhancement logic
 * Used by publish.ts (new posts) and images.ts (existing posts)
 */

import { GoogleGenAI, Modality } from '@google/genai'
import sharp from 'sharp'

interface ImageStyleVariant {
  width?: number
  height?: number
  style_suffix?: string
}

interface ImageStyle {
  base_style?: string
  header?: ImageStyleVariant
  inline?: ImageStyleVariant
  enhancement_prompt?: string
  lighting_moods?: string[]
  color_palettes?: string[]
  negative_prompt?: string
}

/**
 * Enhance a user-uploaded photo via Gemini multimodal (photo → editorial style)
 * Returns an optimized WebP buffer ready for R2 upload
 */
export async function enhancePhoto(opts: {
  photo_base64: string
  image_prompt?: string
  imageStyle: ImageStyle
  geminiKey: string
  variant?: 'header' | 'inline'
}): Promise<Buffer> {
  const { photo_base64, image_prompt, imageStyle, geminiKey, variant = 'header' } = opts
  const cfg = imageStyle[variant] || imageStyle.header || { width: 1200, height: 675 }

  // Extract raw base64 from data URL if needed
  const rawBase64 = photo_base64.includes(',')
    ? photo_base64.split(',')[1]
    : photo_base64

  // Resize input photo with Sharp before sending to Gemini
  const inputBuffer = Buffer.from(rawBase64, 'base64')
  const resizedInput = await sharp(inputBuffer)
    .resize(cfg.width || 1200, undefined, { withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()
  const resizedBase64 = resizedInput.toString('base64')

  // Random dynamic elements
  const mood = imageStyle.lighting_moods?.length
    ? imageStyle.lighting_moods[Math.floor(Math.random() * imageStyle.lighting_moods.length)]
    : ''
  const palette = imageStyle.color_palettes?.length
    ? imageStyle.color_palettes[Math.floor(Math.random() * imageStyle.color_palettes.length)]
    : ''

  // Build enhancement prompt
  const promptParts = [
    imageStyle.enhancement_prompt || 'Enhance this photo in editorial photography style.',
    mood ? `Lighting: ${mood}` : '',
    palette ? `Color palette: ${palette}` : '',
    image_prompt || '',
  ].filter(Boolean).join('\n')

  const ai = new GoogleGenAI({ apiKey: geminiKey })
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: resizedBase64 } },
          { text: promptParts },
        ],
      },
    ],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  })

  const parts = response.candidates?.[0]?.content?.parts || []
  const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'))

  if (!imagePart?.inlineData?.data) {
    throw new Error('Gemini hat kein Bild zurückgegeben')
  }

  // Optimize output to target dimensions as WebP
  // header: crop to exact dimensions (cover), inline: fit within bounds (inside)
  const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64')
  const fit = variant === 'inline' ? 'inside' as const : 'cover' as const
  const optimized = await sharp(imageBuffer)
    .resize(cfg.width || 1200, cfg.height || 675, { fit, withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer()

  return optimized
}
