import type { APIRoute } from 'astro'
import { isAuthenticated } from '../../../lib/admin-auth'
import { uploadBufferToR2 } from '../../../lib/r2'
import { enhancePhoto } from '../../../lib/image-enhance'
import { getFileContent } from '../../../lib/github'
import { parse as parseYaml } from 'yaml'

export const prerender = false

const headers = { 'Content-Type': 'application/json' }

/**
 * POST — Upload an inline image for a blog post body
 * Enhances the image with Gemini AI (Kodak Portra 400 style) before uploading
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

    // Load image style config
    let imageStyle: any = {
      base_style: '',
      header: { width: 1200, height: 675, style_suffix: '' },
      inline: { width: 800, height: 600, style_suffix: '' },
      enhancement_prompt: '',
      lighting_moods: [],
      color_palettes: [],
      negative_prompt: '',
    }
    try {
      const raw = await getFileContent('content-config/image-style.yaml')
      imageStyle = parseYaml(raw)
    } catch { /* use defaults */ }

    // Check Gemini API key
    const geminiKey = import.meta.env.GOOGLE_GEMINI_API_KEY
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: 'Gemini API Key nicht konfiguriert' }), { status: 500, headers })
    }

    console.log(`[admin/upload-image] Enhancing inline image for ${slug}…`)
    const optimized = await enhancePhoto({
      photo_base64: image_base64,
      imageStyle,
      geminiKey,
      variant: 'inline',
    })

    const filename = `${slug}-${Date.now()}.webp`
    const url = await uploadBufferToR2(optimized, filename)

    console.log(`[admin/upload-image] Uploaded enhanced inline image: ${url}`)

    return new Response(JSON.stringify({ url }), { status: 200, headers })
  } catch (err: any) {
    console.error('[admin/upload-image]', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}
