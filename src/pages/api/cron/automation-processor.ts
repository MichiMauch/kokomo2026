import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import {
  getPendingSends,
  recordAutomationSend,
  isEnrollmentComplete,
  markEnrollmentCompleted,
} from '../../../lib/automation'
import { sendMultiBlockNewsletterEmail } from '../../../lib/notify'
import { getSubscriberByEmail } from '../../../lib/newsletter'
import type { NewsletterBlock, PostRef } from '../../../lib/newsletter-blocks'

export const prerender = false

const CRON_SECRET = import.meta.env.CRON_SECRET

function getFirstImage(images: unknown): string | null {
  if (Array.isArray(images)) return images[0] ?? null
  return (images as string) ?? null
}

export const GET: APIRoute = async ({ request }) => {
  // Verify authorization
  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const pending = await getPendingSends()
  if (pending.length === 0) {
    return new Response(JSON.stringify({ processed: 0, message: 'No pending sends' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Group by enrollment, take only the first (lowest step_order) per enrollment
  const byEnrollment = new Map<number, typeof pending[0]>()
  for (const p of pending) {
    if (!byEnrollment.has(p.enrollment_id)) {
      byEnrollment.set(p.enrollment_id, p)
    }
  }

  const toSend = Array.from(byEnrollment.values())

  // Collect all slugs needed across all sends
  const allSlugs = new Set<string>()
  for (const item of toSend) {
    const blocks: NewsletterBlock[] = JSON.parse(item.blocks_json)
    for (const block of blocks) {
      if (block.type === 'hero') allSlugs.add(block.slug)
      if (block.type === 'link-list') block.slugs.forEach((s) => allSlugs.add(s))
    }
  }

  // Resolve posts
  const allPosts = allSlugs.size > 0 ? await getCollection('posts') : []
  const postsMap: Record<string, PostRef> = {}
  for (const slug of allSlugs) {
    const post = allPosts.find((p) => p.id === slug || p.id.replace(/\.md$/, '') === slug)
    if (post) {
      postsMap[slug] = {
        slug: post.id,
        title: post.data.title,
        summary: post.data.summary ?? '',
        image: getFirstImage(post.data.images),
        date: post.data.date.toISOString().split('T')[0],
      }
    }
  }

  const results: { email: string; step: number; status: string }[] = []

  for (const item of toSend) {
    try {
      // Get subscriber's unsubscribe token
      const subscriber = await getSubscriberByEmail(item.subscriber_email)
      if (!subscriber) {
        results.push({ email: item.subscriber_email, step: item.step_order, status: 'skipped_no_subscriber' })
        continue
      }

      const blocks: NewsletterBlock[] = JSON.parse(item.blocks_json)
      const { resendEmailId } = await sendMultiBlockNewsletterEmail({
        email: item.subscriber_email,
        unsubscribeToken: subscriber.token,
        subject: item.subject,
        blocks,
        postsMap,
      })

      await recordAutomationSend(item.enrollment_id, item.step_id, resendEmailId)

      // Check if all steps are now sent
      const complete = await isEnrollmentComplete(item.enrollment_id, item.automation_id)
      if (complete) {
        await markEnrollmentCompleted(item.enrollment_id)
      }

      results.push({ email: item.subscriber_email, step: item.step_order, status: 'sent' })
    } catch (err: any) {
      console.error(`[cron/automation] Failed to send to ${item.subscriber_email}:`, err)
      results.push({ email: item.subscriber_email, step: item.step_order, status: `error: ${err.message}` })
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
