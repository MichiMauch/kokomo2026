import type { APIRoute } from 'astro'
import { isAuthenticated } from '../../../lib/admin-auth'
import { uploadBufferToR2 } from '../../../lib/r2'
import sharp from 'sharp'

export const prerender = false

const headers = { 'Content-Type': 'application/json' }

/**
 * POST — Upload an inline image for a blog post body
 * Body: { slug, image_base64 }
 * Returns: { url }
 */
export const POST: APIRoute = async ({ request }) => {
  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  try {
    const { slug, image_base64 } = await request.json()

    if (!slug) {
      return new Response(JSON.stringify({ error: 'Slug fehlt' }), { status: 400, headers })
    }
    if (!image_base64) {
      return new Response(JSON.stringify({ error: 'Kein Bild hochgeladen' }), { status: 400, headers })
    }

    // Strip data URL prefix if present
    const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, '')
    const imageBuffer = Buffer.from(base64Data, 'base64')

    // Resize and convert to WebP
    const optimized = await sharp(imageBuffer)
      .resize(1200, undefined, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()

    const filename = `${slug}-${Date.now()}.webp`
    const url = await uploadBufferToR2(optimized, filename)

    console.log(`[admin/upload-image] Uploaded inline image: ${url}`)

    return new Response(JSON.stringify({ url }), { status: 200, headers })
  } catch (err: any) {
    console.error('[admin/upload-image]', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}
