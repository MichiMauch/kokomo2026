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

/** Roh-Bild via Gemini erzeugen und auf width×height (cover) als WebP-Buffer bringen. */
async function generateImageBuffer(prompt: string, width: number, height: number): Promise<Buffer> {
  const apiKey = import.meta.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY nicht konfiguriert.')

  const style = await loadStyle()
  const fullPrompt = [
    style.base_style || '',
    pick(style.lighting_moods),
    pick(style.color_palettes),
    prompt,
    `Aspect ratio: ${width}x${height}`,
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

  return sharp(Buffer.from(imagePart.inlineData.data, 'base64'))
    .resize(width, height, { fit: 'cover' })
    .webp({ quality: 85 })
    .toBuffer()
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
  const style = await loadStyle()
  const cfg: SizeCfg = { ...DEFAULTS[type], ...(style[type] || {}) }
  const buf = await generateImageBuffer(prompt, cfg.width, cfg.height)
  const name = filename.endsWith('.webp') ? filename : `${filename}.webp`
  return uploadBufferToR2(buf, name)
}

// ─── Karussell-Slide: Hintergrundbild + Titel/Untertitel als echte Schrift ──

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Greedy-Zeilenumbruch nach geschätzter max. Zeichenzahl pro Zeile. */
function wrapLines(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > maxChars) {
      lines.push(cur)
      cur = w
    } else {
      cur = cur ? cur + ' ' + w : w
    }
  }
  if (cur) lines.push(cur)
  return lines
}

/** Baut eine SVG-Ebene (size×size) mit Scrim, Wortmarke, Titel und Untertitel. */
function buildSlideSvg(size: number, title: string, subtitle: string): string {
  const pad = Math.round(size * 0.075)
  const titleSize = Math.round(size * 0.062)
  const subSize = Math.round(size * 0.038)
  const titleLines = wrapLines(title || '', Math.floor((size - 2 * pad) / (titleSize * 0.56)))
  const subLines = subtitle ? wrapLines(subtitle, Math.floor((size - 2 * pad) / (subSize * 0.54))) : []

  const titleLH = Math.round(titleSize * 1.16)
  const subLH = Math.round(subSize * 1.3)
  const blockH = titleLines.length * titleLH + (subLines.length ? Math.round(subSize * 0.7) + subLines.length * subLH : 0)
  let y = size - pad - blockH + titleSize

  const titleTspans = titleLines
    .map((l, i) => `<text x="${pad}" y="${y + i * titleLH}" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="${titleSize}" font-weight="700" fill="#ffffff">${escapeXml(l)}</text>`)
    .join('')
  y += titleLines.length * titleLH + (subLines.length ? Math.round(subSize * 0.7) : 0)
  const subTspans = subLines
    .map((l, i) => `<text x="${pad}" y="${y + i * subLH}" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="${subSize}" font-weight="400" fill="#f1f1f1">${escapeXml(l)}</text>`)
    .join('')

  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.35" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.82"/>
    </linearGradient></defs>
    <rect x="0" y="0" width="${size}" height="${size}" fill="url(#scrim)"/>
    <text x="${pad}" y="${pad + Math.round(size * 0.02)}" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="${Math.round(size * 0.026)}" font-weight="700" fill="#ffffff" opacity="0.85" letter-spacing="2">KOKOMO.HOUSE</text>
    ${titleTspans}${subTspans}
  </svg>`
}

/**
 * Rendert eine Karussell-Slide: Gemini-Hintergrund (quadratisch) + Titel/Untertitel
 * als echte Schrift einkomponiert. Lädt nach R2 und gibt die URL zurück.
 */
export async function renderSlideToR2(opts: {
  prompt: string
  title: string
  subtitle: string
  filename: string
  size?: number
}): Promise<string> {
  const size = opts.size || 1080
  const bg = await generateImageBuffer(opts.prompt, size, size)
  const svg = buildSlideSvg(size, opts.title, opts.subtitle)
  const composited = await sharp(bg)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .webp({ quality: 88 })
    .toBuffer()
  const name = opts.filename.endsWith('.webp') ? opts.filename : `${opts.filename}.webp`
  return uploadBufferToR2(composited, name)
}
