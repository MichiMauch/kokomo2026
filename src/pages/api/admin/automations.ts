import type { APIRoute } from 'astro'
import {
  listAutomations,
  getAutomation,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  saveStep,
  deleteStep,
  reorderSteps,
  getEnrollments,
  getAutomationStepStats,
} from '../../../lib/automation'
import { sendMultiBlockNewsletterEmail } from '../../../lib/notify'
import type { NewsletterBlock, PostRef } from '../../../lib/newsletter-blocks'
import { siteConfig } from '../../../lib/site-config'

export const prerender = false

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
}

function isAuthed(request: Request): boolean {
  const cookie = request.headers.get('cookie') || ''
  return cookie.includes('admin_session=')
}

export const GET: APIRoute = async ({ request, url }) => {
  if (!isAuthed(request)) return unauthorized()

  const list = url.searchParams.get('list')
  const id = url.searchParams.get('id')
  const enrollments = url.searchParams.get('enrollments')
  const stats = url.searchParams.get('stats')

  if (list) {
    const automations = await listAutomations()
    return new Response(JSON.stringify(automations), { headers: { 'Content-Type': 'application/json' } })
  }

  if (id) {
    const data = await getAutomation(Number(id))
    if (!data) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
  }

  if (enrollments) {
    const data = await getEnrollments(Number(enrollments))
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
  }

  if (stats) {
    const data = await getAutomationStepStats(Number(stats))
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ error: 'Missing query param' }), { status: 400 })
}

export const POST: APIRoute = async ({ request }) => {
  if (!isAuthed(request)) return unauthorized()

  const body = await request.json()
  const { action } = body

  switch (action) {
    case 'create': {
      const id = await createAutomation(body.name, body.trigger_type || 'subscriber_confirmed')
      return new Response(JSON.stringify({ id }), { headers: { 'Content-Type': 'application/json' } })
    }

    case 'update': {
      await updateAutomation(body.id, {
        name: body.name,
        trigger_type: body.trigger_type,
        active: body.active,
      })
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    case 'delete': {
      await deleteAutomation(body.id)
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    case 'toggle-active': {
      await updateAutomation(body.id, { active: body.active })
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    case 'save-step': {
      const stepId = await saveStep({
        id: body.step_id || undefined,
        automation_id: body.automation_id,
        step_order: body.step_order,
        delay_hours: body.delay_hours,
        subject: body.subject,
        blocks_json: body.blocks_json,
      })
      return new Response(JSON.stringify({ id: stepId }), { headers: { 'Content-Type': 'application/json' } })
    }

    case 'delete-step': {
      await deleteStep(body.step_id)
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    case 'reorder-steps': {
      await reorderSteps(body.automation_id, body.step_ids)
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    case 'test-step': {
      const blocks: NewsletterBlock[] = JSON.parse(body.blocks_json)
      const postsMap: Record<string, PostRef> = body.posts_map || {}
      await sendMultiBlockNewsletterEmail({
        email: siteConfig.email,
        unsubscribeToken: 'test',
        subject: `[TEST] ${body.subject}`,
        blocks,
        postsMap,
      })
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    default:
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400 })
  }
}
