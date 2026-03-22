/**
 * Email automation data layer
 * Manages drip campaigns: automations, steps, enrollments, sends
 */

import { getClient } from './turso'

// ─── Types ─────────────────────────────────────────────────────────────

export interface Automation {
  id: number
  name: string
  trigger_type: string
  active: number
  created_at: string
  updated_at: string
  step_count?: number
  enrollment_count?: number
}

export interface AutomationStep {
  id: number
  automation_id: number
  step_order: number
  delay_hours: number
  subject: string
  blocks_json: string
  created_at: string
  updated_at: string
}

export interface AutomationEnrollment {
  id: number
  automation_id: number
  subscriber_email: string
  status: 'active' | 'completed' | 'cancelled'
  enrolled_at: string
  completed_at: string | null
  cancelled_at: string | null
}

export interface AutomationSend {
  id: number
  enrollment_id: number
  step_id: number
  resend_email_id: string | null
  status: string
  sent_at: string
  delivered_at: string | null
  opened_at: string | null
  open_count: number
  clicked_at: string | null
  click_count: number
  bounced_at: string | null
  bounce_type: string | null
  complained_at: string | null
}

export interface PendingSend {
  enrollment_id: number
  subscriber_email: string
  enrolled_at: string
  step_id: number
  step_order: number
  delay_hours: number
  subject: string
  blocks_json: string
  automation_id: number
  automation_name: string
}

// ─── Automation CRUD ───────────────────────────────────────────────────

export async function listAutomations(): Promise<Automation[]> {
  const db = getClient()
  const result = await db.execute(`
    SELECT a.*,
      (SELECT COUNT(*) FROM email_automation_steps WHERE automation_id = a.id) AS step_count,
      (SELECT COUNT(*) FROM email_automation_enrollments WHERE automation_id = a.id) AS enrollment_count
    FROM email_automations a
    ORDER BY a.created_at DESC
  `)
  return result.rows.map((row) => ({
    id: row.id as number,
    name: row.name as string,
    trigger_type: row.trigger_type as string,
    active: row.active as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    step_count: row.step_count as number,
    enrollment_count: row.enrollment_count as number,
  }))
}

export async function getAutomation(id: number): Promise<{ automation: Automation; steps: AutomationStep[] } | null> {
  const db = getClient()
  const aResult = await db.execute({ sql: 'SELECT * FROM email_automations WHERE id = ?', args: [id] })
  if (aResult.rows.length === 0) return null

  const row = aResult.rows[0]
  const automation: Automation = {
    id: row.id as number,
    name: row.name as string,
    trigger_type: row.trigger_type as string,
    active: row.active as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }

  const sResult = await db.execute({
    sql: 'SELECT * FROM email_automation_steps WHERE automation_id = ? ORDER BY step_order ASC',
    args: [id],
  })
  const steps: AutomationStep[] = sResult.rows.map((r) => ({
    id: r.id as number,
    automation_id: r.automation_id as number,
    step_order: r.step_order as number,
    delay_hours: r.delay_hours as number,
    subject: r.subject as string,
    blocks_json: r.blocks_json as string,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  }))

  return { automation, steps }
}

export async function createAutomation(name: string, triggerType: string): Promise<number> {
  const db = getClient()
  const result = await db.execute({
    sql: `INSERT INTO email_automations (name, trigger_type) VALUES (?, ?)`,
    args: [name, triggerType],
  })
  return Number(result.lastInsertRowid)
}

export async function updateAutomation(id: number, data: { name?: string; trigger_type?: string; active?: number }): Promise<void> {
  const db = getClient()
  const sets: string[] = []
  const args: (string | number)[] = []

  if (data.name !== undefined) { sets.push('name = ?'); args.push(data.name) }
  if (data.trigger_type !== undefined) { sets.push('trigger_type = ?'); args.push(data.trigger_type) }
  if (data.active !== undefined) { sets.push('active = ?'); args.push(data.active) }

  if (sets.length === 0) return
  sets.push("updated_at = datetime('now')")
  args.push(id)

  await db.execute({ sql: `UPDATE email_automations SET ${sets.join(', ')} WHERE id = ?`, args })
}

export async function deleteAutomation(id: number): Promise<void> {
  const db = getClient()
  await db.execute({ sql: 'DELETE FROM email_automations WHERE id = ?', args: [id] })
}

// ─── Step CRUD ─────────────────────────────────────────────────────────

export async function saveStep(data: {
  id?: number
  automation_id: number
  step_order: number
  delay_hours: number
  subject: string
  blocks_json: string
}): Promise<number> {
  const db = getClient()

  if (data.id) {
    await db.execute({
      sql: `UPDATE email_automation_steps SET step_order = ?, delay_hours = ?, subject = ?, blocks_json = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [data.step_order, data.delay_hours, data.subject, data.blocks_json, data.id],
    })
    return data.id
  }

  const result = await db.execute({
    sql: `INSERT INTO email_automation_steps (automation_id, step_order, delay_hours, subject, blocks_json) VALUES (?, ?, ?, ?, ?)`,
    args: [data.automation_id, data.step_order, data.delay_hours, data.subject, data.blocks_json],
  })
  return Number(result.lastInsertRowid)
}

export async function deleteStep(id: number): Promise<void> {
  const db = getClient()
  await db.execute({ sql: 'DELETE FROM email_automation_steps WHERE id = ?', args: [id] })
}

export async function reorderSteps(automationId: number, stepIds: number[]): Promise<void> {
  const db = getClient()
  for (let i = 0; i < stepIds.length; i++) {
    await db.execute({
      sql: `UPDATE email_automation_steps SET step_order = ?, updated_at = datetime('now') WHERE id = ? AND automation_id = ?`,
      args: [i, stepIds[i], automationId],
    })
  }
}

// ─── Enrollment ────────────────────────────────────────────────────────

export async function enrollSubscriber(email: string, triggerType: string): Promise<number> {
  const db = getClient()
  const automations = await db.execute({
    sql: 'SELECT id FROM email_automations WHERE trigger_type = ? AND active = 1',
    args: [triggerType],
  })

  let count = 0
  for (const row of automations.rows) {
    const automationId = row.id as number
    try {
      await db.execute({
        sql: `INSERT INTO email_automation_enrollments (automation_id, subscriber_email) VALUES (?, ?)`,
        args: [automationId, email],
      })
      count++
    } catch (err: any) {
      // UNIQUE constraint — already enrolled, skip
      if (err.message?.includes('UNIQUE')) continue
      throw err
    }
  }
  return count
}

export async function cancelEnrollments(email: string): Promise<void> {
  const db = getClient()
  await db.execute({
    sql: `UPDATE email_automation_enrollments SET status = 'cancelled', cancelled_at = datetime('now') WHERE subscriber_email = ? AND status = 'active'`,
    args: [email],
  })
}

export async function getEnrollments(automationId: number): Promise<AutomationEnrollment[]> {
  const db = getClient()
  const result = await db.execute({
    sql: 'SELECT * FROM email_automation_enrollments WHERE automation_id = ? ORDER BY enrolled_at DESC',
    args: [automationId],
  })
  return result.rows.map((r) => ({
    id: r.id as number,
    automation_id: r.automation_id as number,
    subscriber_email: r.subscriber_email as string,
    status: r.status as AutomationEnrollment['status'],
    enrolled_at: r.enrolled_at as string,
    completed_at: r.completed_at as string | null,
    cancelled_at: r.cancelled_at as string | null,
  }))
}

// ─── Send Processing ───────────────────────────────────────────────────

export async function getPendingSends(): Promise<PendingSend[]> {
  const db = getClient()
  const result = await db.execute(`
    SELECT
      e.id AS enrollment_id,
      e.subscriber_email,
      e.enrolled_at,
      s.id AS step_id,
      s.step_order,
      s.delay_hours,
      s.subject,
      s.blocks_json,
      a.id AS automation_id,
      a.name AS automation_name
    FROM email_automation_enrollments e
    JOIN email_automations a ON a.id = e.automation_id AND a.active = 1
    JOIN email_automation_steps s ON s.automation_id = a.id
    LEFT JOIN email_automation_sends sent ON sent.enrollment_id = e.id AND sent.step_id = s.id
    WHERE e.status = 'active'
      AND sent.id IS NULL
      AND datetime(e.enrolled_at, '+' || s.delay_hours || ' hours') <= datetime('now')
    ORDER BY e.id, s.step_order
  `)

  return result.rows.map((r) => ({
    enrollment_id: r.enrollment_id as number,
    subscriber_email: r.subscriber_email as string,
    enrolled_at: r.enrolled_at as string,
    step_id: r.step_id as number,
    step_order: r.step_order as number,
    delay_hours: r.delay_hours as number,
    subject: r.subject as string,
    blocks_json: r.blocks_json as string,
    automation_id: r.automation_id as number,
    automation_name: r.automation_name as string,
  }))
}

export async function recordAutomationSend(enrollmentId: number, stepId: number, resendEmailId: string | null): Promise<void> {
  const db = getClient()
  await db.execute({
    sql: `INSERT INTO email_automation_sends (enrollment_id, step_id, resend_email_id) VALUES (?, ?, ?)`,
    args: [enrollmentId, stepId, resendEmailId],
  })
}

export async function markEnrollmentCompleted(enrollmentId: number): Promise<void> {
  const db = getClient()
  await db.execute({
    sql: `UPDATE email_automation_enrollments SET status = 'completed', completed_at = datetime('now') WHERE id = ?`,
    args: [enrollmentId],
  })
}

export async function isEnrollmentComplete(enrollmentId: number, automationId: number): Promise<boolean> {
  const db = getClient()
  const totalSteps = await db.execute({
    sql: 'SELECT COUNT(*) as cnt FROM email_automation_steps WHERE automation_id = ?',
    args: [automationId],
  })
  const sentSteps = await db.execute({
    sql: 'SELECT COUNT(*) as cnt FROM email_automation_sends WHERE enrollment_id = ?',
    args: [enrollmentId],
  })
  return (sentSteps.rows[0].cnt as number) >= (totalSteps.rows[0].cnt as number)
}

// ─── Webhook Event Tracking ────────────────────────────────────────────

export async function updateAutomationSendEvent(
  resendEmailId: string,
  event: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained',
  timestamp: string,
  extras?: { bounce_type?: string },
): Promise<void> {
  const db = getClient()

  const existing = await db.execute({
    sql: 'SELECT id, status, open_count, click_count FROM email_automation_sends WHERE resend_email_id = ?',
    args: [resendEmailId],
  })
  if (existing.rows.length === 0) return

  const row = existing.rows[0]
  const id = row.id as number
  const currentStatus = row.status as string

  if (currentStatus === 'bounced' || currentStatus === 'complained') return

  switch (event) {
    case 'delivered':
      await db.execute({
        sql: `UPDATE email_automation_sends SET status = CASE WHEN status = 'sent' THEN 'delivered' ELSE status END, delivered_at = COALESCE(delivered_at, ?) WHERE id = ?`,
        args: [timestamp, id],
      })
      break
    case 'opened':
      await db.execute({
        sql: `UPDATE email_automation_sends SET status = CASE WHEN status IN ('sent', 'delivered') THEN 'opened' ELSE status END, opened_at = COALESCE(opened_at, ?), open_count = open_count + 1 WHERE id = ?`,
        args: [timestamp, id],
      })
      break
    case 'clicked':
      await db.execute({
        sql: `UPDATE email_automation_sends SET status = 'clicked', clicked_at = COALESCE(clicked_at, ?), click_count = click_count + 1 WHERE id = ?`,
        args: [timestamp, id],
      })
      break
    case 'bounced':
      await db.execute({
        sql: `UPDATE email_automation_sends SET status = 'bounced', bounced_at = ?, bounce_type = ? WHERE id = ?`,
        args: [timestamp, extras?.bounce_type ?? null, id],
      })
      break
    case 'complained':
      await db.execute({
        sql: `UPDATE email_automation_sends SET status = 'complained', complained_at = ? WHERE id = ?`,
        args: [timestamp, id],
      })
      break
  }
}

// ─── Stats ─────────────────────────────────────────────────────────────

export async function getAutomationStepStats(automationId: number): Promise<{
  step_id: number
  step_order: number
  subject: string
  total_sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
}[]> {
  const db = getClient()
  const result = await db.execute({
    sql: `
      SELECT
        s.id AS step_id,
        s.step_order,
        s.subject,
        COUNT(sent.id) AS total_sent,
        SUM(CASE WHEN sent.status IN ('delivered','opened','clicked') THEN 1 ELSE 0 END) AS delivered,
        SUM(CASE WHEN sent.status IN ('opened','clicked') THEN 1 ELSE 0 END) AS opened,
        SUM(CASE WHEN sent.status = 'clicked' THEN 1 ELSE 0 END) AS clicked,
        SUM(CASE WHEN sent.status = 'bounced' THEN 1 ELSE 0 END) AS bounced
      FROM email_automation_steps s
      LEFT JOIN email_automation_sends sent ON sent.step_id = s.id
      WHERE s.automation_id = ?
      GROUP BY s.id
      ORDER BY s.step_order
    `,
    args: [automationId],
  })
  return result.rows.map((r) => ({
    step_id: r.step_id as number,
    step_order: r.step_order as number,
    subject: r.subject as string,
    total_sent: r.total_sent as number,
    delivered: r.delivered as number,
    opened: r.opened as number,
    clicked: r.clicked as number,
    bounced: r.bounced as number,
  }))
}
