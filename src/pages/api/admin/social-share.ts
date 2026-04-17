import type { APIRoute } from 'astro'
import { isAuthenticated } from '../../../lib/admin-auth'
import { recordShare, type Platform } from '../../../lib/social'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' }

  if (!(await isAuthenticated(request))) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), { status: 401, headers })
  }

  try {
    const body = await request.json()
    const { platform, text } = body as { platform: Platform; text: string }
    const slug = ((body.slug as string) || '').replace(/\.md$/, '')

    if (!slug || !platform || !text) {
      return new Response(
        JSON.stringify({ error: 'slug, platform und text sind erforderlich.' }),
        { status: 400, headers },
      )
    }

    // Replace {url} placeholder with actual URL
    const cleanSlug = slug
    const postUrl = `https://www.kokomo.house/tiny-house/${cleanSlug}/`
    let finalText = text.replace(/\{url\}/g, postUrl)
    // Safety net: if the writer forgot the {url} and there is no https:// link at all,
    // append the full post URL so social posts are never published without the link.
    if (!/https?:\/\//i.test(finalText)) {
      finalText = `${finalText.trimEnd()}\n\n${postUrl}`
    }

    // ─── X/Twitter (manual — intent URL) ───
    if (platform === 'twitter') {
      const intentUrl = `https://x.com/intent/post?text=${encodeURIComponent(finalText)}`
      await recordShare(slug, platform)
      return new Response(
        JSON.stringify({ success: true, method: 'manual', shareUrl: intentUrl }),
        { status: 200, headers },
      )
    }

    // ─── Facebook Profil (manual — copy text + open share dialog) ───
    if (platform === 'facebook_page') {
      await recordShare(slug, platform)
      return new Response(
        JSON.stringify({
          success: true,
          method: 'manual',
          copyUrl: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`,
        }),
        { status: 200, headers },
      )
    }

    // ─── Telegram ───
    if (platform === 'telegram') {
      const botToken = import.meta.env.TELEGRAM_BOT_TOKEN
      const chatId = import.meta.env.TELEGRAM_CHAT_ID

      if (!botToken || !chatId) {
        return new Response(
          JSON.stringify({ error: 'Telegram Bot-Konfiguration fehlt.' }),
          { status: 500, headers },
        )
      }

      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: finalText, parse_mode: 'Markdown' }),
      })
      const data = await res.json()

      if (!res.ok || !data.ok) {
        return new Response(
          JSON.stringify({ error: `Telegram API Fehler: ${data.description || 'Unbekannt'}` }),
          { status: 500, headers },
        )
      }

      const externalId = String(data.result.message_id)
      await recordShare(slug, platform, externalId)
      return new Response(
        JSON.stringify({ success: true, method: 'api' }),
        { status: 200, headers },
      )
    }

// ─── WhatsApp (manual — copy text + open channel) ───
    if (platform === 'whatsapp') {
      await recordShare(slug, platform)
      return new Response(
        JSON.stringify({
          success: true,
          method: 'manual',
          copyUrl: 'https://whatsapp.com/channel/0029VaL6wes7IUYN5XqctU0y',
        }),
        { status: 200, headers },
      )
    }

    return new Response(JSON.stringify({ error: 'Unbekannte Plattform.' }), { status: 400, headers })
  } catch (err: any) {
    console.error('[admin/social-share POST]', err)
    return new Response(
      JSON.stringify({ error: 'Teilen fehlgeschlagen.', detail: err?.message }),
      { status: 500, headers },
    )
  }
}
