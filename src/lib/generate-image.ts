/**
 * Runtime-sichere Text→Bild→R2-Generierung (Gemini), für SSR/API-Routen.
 *
 * Spiegelt den funktionierenden Ansatz aus src/pages/api/admin/publish.ts, aber als
 * wiederverwendbarer Helper. Wird NUR dynamisch importiert (render-Aktionen), damit die
 * schweren Module (@google/genai, sharp) nicht jeden Funktions-Kaltstart belasten.
 */

import { GoogleGenAI, Modality } from '@google/genai'
import sharp from 'sharp'
import { parse as parseYaml } from 'yaml'
import { uploadBufferToR2 } from './r2'
import { getFileContent } from './github'

interface SizeCfg {
  width: number
  height: number
  style_suffix?: string
}

const DEFAULTS: Record<'header' | 'inline', SizeCfg> = {
  header: { width: 1200, height: 675 },
  inline: { width: 1000, height: 750 },
}

let cachedStyle: any | null = null

async function loadStyle(): Promise<any> {
  if (cachedStyle) return cachedStyle
  try {
    cachedStyle = parseYaml(await getFileContent('content-config/image-style.yaml')) || {}
  } catch {
    cachedStyle = {}
  }
  return cachedStyle
}

function pick(arr: unknown): string {
  // Deterministisch genug: erstes Element (Variation kommt über den Prompt).
  return Array.isArray(arr) && arr.length ? String(arr[0]) : ''
}

/**
 * Generiert ein Bild aus einem englischen Prompt und lädt es als WebP nach R2.
 * Gibt die öffentliche R2-URL zurück.
 */
export async function generateImageToR2(
  prompt: string,
  type: 'header' | 'inline',
  filename: string,
): Promise<string> {
  const apiKey = import.meta.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY nicht konfiguriert.')

  const style = await loadStyle()
  const cfg: SizeCfg = { ...DEFAULTS[type], ...(style[type] || {}) }

  const fullPrompt = [
    style.base_style || '',
    pick(style.lighting_moods),
    pick(style.color_palettes),
    prompt,
    `Aspect ratio: ${cfg.width}x${cfg.height}`,
    style.negative_prompt ? `Avoid: ${style.negative_prompt}` : 'No text overlays, no watermarks, no logos',
  ]
    .filter(Boolean)
    .join('. ')

  const ai = new GoogleGenAI({ apiKey })
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: fullPrompt,
    config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
  })

  const parts = response.candidates?.[0]?.content?.parts || []
  const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'))
  if (!imagePart?.inlineData?.data) throw new Error('Gemini hat kein Bild zurückgegeben.')

  const optimized = await sharp(Buffer.from(imagePart.inlineData.data, 'base64'))
    .resize(cfg.width, cfg.height, { fit: 'cover' })
    .webp({ quality: 85 })
    .toBuffer()

  const name = filename.endsWith('.webp') ? filename : `${filename}.webp`
  return uploadBufferToR2(optimized, name)
}
