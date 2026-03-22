import type { APIRoute } from 'astro'
import { Webhook } from 'svix'
import { updateRecipientEvent } from '../../../lib/newsletter'
import { updateAutomationSendEvent } from '../../../lib/automation'

export const prerender = false

const WEBHOOK_SECRET = import.meta.env.RESEND_WEBHOOK_SECRET

interface ResendWebhookPayload {
  type: string
  created_at: string
  data: {
    email_id: string
    bounce?: { bounce_type?: string }
    click?: { link?: string }
  }
}

export const POST: APIRoute = async ({ request }) => {
  if (!WEBHOOK_SECRET) {
    console.error('[webhook/resend] RESEND_WEBHOOK_SECRET not configured')
    return new Response('Webhook secret not configured', { status: 500 })
  }

  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Missing svix headers', { status: 400 })
  }

  const body = await request.text()

  // Verify signature
  const wh = new Webhook(WEBHOOK_SECRET)
  let payload: ResendWebhookPayload
  try {
    payload = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendWebhookPayload
  } catch (err) {
    console.error('[webhook/resend] Signature verification failed:', err)
    return new Response('Invalid signature', { status: 401 })
  }

  const { type, created_at, data } = payload
  const emailId = data.email_id

  if (!emailId) {
    return new Response('OK', { status: 200 })
  }

  try {
    switch (type) {
      case 'email.delivered':
        await updateRecipientEvent(emailId, 'delivered', created_at)
        break

      case 'email.opened':
        await updateRecipientEvent(emailId, 'opened', created_at)
        break

      case 'email.clicked':
        await updateRecipientEvent(emailId, 'clicked', created_at, {
          click_url: data.click?.link,
        })
        break

      case 'email.bounced':
        await updateRecipientEvent(emailId, 'bounced', created_at, {
          bounce_type: data.bounce?.bounce_type,
        })
        break

      case 'email.complained':
        await updateRecipientEvent(emailId, 'complained', created_at)
        break
    }
    // Also check automation sends
    const automationEvent = type.replace('email.', '') as 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained'
    if (['delivered', 'opened', 'clicked', 'bounced', 'complained'].includes(automationEvent)) {
      await updateAutomationSendEvent(emailId, automationEvent, created_at, {
        bounce_type: data.bounce?.bounce_type,
      })
    }
  } catch (err) {
    console.error(`[webhook/resend] Error processing ${type}:`, err)
    return new Response('Processing error', { status: 500 })
  }

  return new Response('OK', { status: 200 })
}
