#!/usr/bin/env npx tsx
/**
 * Upload a local photo for a blog post: resize/rotate → WebP → Cloudflare R2.
 *
 * Usage as CLI:
 *   npx tsx pipeline/upload-photo.ts <local-file> <slug> [header|inline] [alt] [rotate]
 *   # rotate: auto (default, EXIF) | 90 | 180 | 270
 *   npx tsx pipeline/upload-photo.ts ~/foto.jpg mein-post inline "Schöne Aussicht"
 *   npx tsx pipeline/upload-photo.ts ~/foto.jpg mein-post header "" 90
 *
 * Usage as module:
 *   import { uploadPhoto } from './upload-photo'
 *   const { url, markdown } = await uploadPhoto({ filePath, slug, alt, type, rotate })
 */

import { existsSync } from 'fs'
import { resolve } from 'path'
import sharp from 'sharp'
import { uploadBufferToR2 } from './upload-to-r2.js'

export type PhotoType = 'header' | 'inline'
export type Rotate = 'auto' | 90 | 180 | 270

export interface UploadPhotoOptions {
  /** Absolute or ~-relative path to the local image file */
  filePath: string
  /** The post slug (used for the filename on R2) */
  slug: string
  /** Alt text — becomes the handwritten gallery caption. */
  alt?: string
  /** header (1200x675 cover crop + thumb) or inline (max 1000px wide). Default inline. */
  type?: PhotoType
  /** auto = honour EXIF orientation (default); or rotate clockwise by 90/180/270 degrees. */
  rotate?: Rotate
}

/**
 * Resize/rotate a local photo to WebP and upload it to R2.
 * For header type, also uploads a 600px thumbnail (used on homepage cards).
 */
export async function uploadPhoto(
  opts: UploadPhotoOptions
): Promise<{ url: string; markdown: string; thumbUrl?: string }> {
  const { filePath, slug, alt, type = 'inline', rotate = 'auto' } = opts

  const resolved = resolve(filePath.replace(/^~/, process.env.HOME || ''))
  if (!existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`)
  }

  // Orientation: explicit angle overrides EXIF; otherwise auto-orient from EXIF.
  let pipe = sharp(resolved)
  pipe = rotate === 'auto' ? pipe.rotate() : pipe.rotate(rotate)

  const buffer =
    type === 'header'
      ? await pipe.resize(1200, 675, { fit: 'cover' }).webp({ quality: 85 }).toBuffer()
      : await pipe.resize(1000, null, { withoutEnlargement: true }).webp({ quality: 85 }).toBuffer()

  const filename = type === 'header' ? `${slug}-titelbild.webp` : `${slug}-${Date.now()}.webp`
  const url = await uploadBufferToR2(buffer, filename)

  let thumbUrl: string | undefined
  if (type === 'header') {
    const thumb = await sharp(buffer)
      .resize(600, undefined, { withoutEnlargement: true })
      .webp({ quality: 60 })
      .toBuffer()
    thumbUrl = await uploadBufferToR2(thumb, `${slug}-titelbild-thumb.webp`)
  }

  const markdown = alt ? `![${alt}](${url})` : `![](${url})`
  return { url, markdown, thumbUrl }
}

// CLI mode
if (process.argv[1]?.includes('upload-photo')) {
  ;(async () => {
    const [, , filePath, slug, type = 'inline', alt = '', rotateRaw = 'auto'] = process.argv

    if (!filePath || !slug) {
      console.error(
        'Usage: npx tsx pipeline/upload-photo.ts <local-file> <slug> [header|inline] [alt] [auto|90|180|270]'
      )
      process.exit(1)
    }

    const rotate: Rotate =
      rotateRaw === 'auto' ? 'auto' : (Number(rotateRaw) as 90 | 180 | 270)

    try {
      const { url, markdown, thumbUrl } = await uploadPhoto({
        filePath,
        slug,
        alt: alt || undefined,
        type: type as PhotoType,
        rotate,
      })
      console.log(`✅ Uploaded: ${url}`)
      if (thumbUrl) console.log(`   Thumb:   ${thumbUrl}`)
      console.log(`   Markdown: ${markdown}`)
    } catch (err: any) {
      console.error(`❌ Upload failed: ${err.message}`)
      process.exit(1)
    }
  })()
}
