/**
 * Newsletter data layer for Turso
 * Manages subscribers and send history
 */

import { getClient } from './turso'

// ─── Types ─────────────────────────────────────────────────────────────

export interface Subscriber {
  id: number
  email: string
  status: 'pending' | 'confirmed' | 'unsubscribed'
  token: string
  created_at: string
  confirmed_at: string | null
  unsubscribed_at: string | null
}

export interface NewsletterSend {
  id: number
  post_slug: string
  post_title: string
  subject: string
  sent_at: string
  recipient_count: number
  status: string
}

export interface NewsletterRecipient {
  id: number
  send_id: number
  email: string
  resend_email_id: string | null
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained'
  delivered_at: string | null
  opened_at: string | null
  open_count: number
  clicked_at: string | null
  click_count: number
  bounced_at: string | null
  bounce_type: string | null
  complained_at: string | null
}

export interface NewsletterSendStats extends NewsletterSend {
  delivered_count: number
  opened_count: number
  clicked_count: number
  bounced_count: number
  complained_count: number
}

export interface LinkClickStats {
  url: string
  click_count: number
  unique_clickers: number
}

export interface OverallStats {
  total_sends: number
  total_recipients: number
  avg_open_rate: number
  avg_click_rate: number
  avg_bounce_rate: number
  total_complaints: number
}

// ─── Subscriber CRUD ───────────────────────────────────────────────────

export async function createSubscriber(email: string): Promise<{ token: string; alreadyConfirmed: boolean }> {
  const db = getClient()
  const token = crypto.randomUUID()

  // Check if email already exists
  const existing = await db.execute({
    sql: 'SELECT id, status FROM newsletter_subscribers WHERE email = ?',
    args: [email],
  })

  if (existing.rows.length > 0) {
    const status = existing.rows[0].status as string

    if (status === 'confirmed') {
      return { token: '', alreadyConfirmed: true }
    }

    if (status === 'unsubscribed') {
      // Re-subscribe: reset to pending with new token
      await db.execute({
        sql: `UPDATE newsletter_subscribers SET status = 'pending', token = ?, unsubscribed_at = NULL WHERE email = ?`,
        args: [token, email],
      })
      return { token, alreadyConfirmed: false }
    }

    // Status is pending — regenerate token (handles "never got the email" case)
    await db.execute({
      sql: 'UPDATE newsletter_subscribers SET token = ? WHERE email = ?',
      args: [token, email],
    })
    return { token, alreadyConfirmed: false }
  }

  // New subscriber
  await db.execute({
    sql: `INSERT INTO newsletter_subscribers (email, status, token) VALUES (?, 'pending', ?)`,
    args: [email, token],
  })

  return { token, alreadyConfirmed: false }
}

export async function confirmSubscriber(token: string): Promise<boolean> {
  const db = getClient()

  const result = await db.execute({
    sql: `UPDATE newsletter_subscribers SET status = 'confirmed', confirmed_at = datetime('now') WHERE token = ? AND status = 'pending'`,
    args: [token],
  })

  return result.rowsAffected > 0
}

export async function unsubscribeByToken(token: string): Promise<boolean> {
  const db = getClient()

  const result = await db.execute({
    sql: `UPDATE newsletter_subscribers SET status = 'unsubscribed', unsubscribed_at = datetime('now') WHERE token = ? AND status != 'unsubscribed'`,
    args: [token],
  })

  return result.rowsAffected > 0
}

export async function getAllSubscribers(): Promise<Subscriber[]> {
  const db = getClient()

  const result = await db.execute('SELECT * FROM newsletter_subscribers ORDER BY created_at DESC')

  return result.rows.map((row) => ({
    id: row.id as number,
    email: row.email as string,
    status: row.status as Subscriber['status'],
    token: row.token as string,
    created_at: row.created_at as string,
    confirmed_at: row.confirmed_at as string | null,
    unsubscribed_at: row.unsubscribed_at as string | null,
  }))
}

export async function getSubscriberByToken(token: string): Promise<{ email: string; token: string } | null> {
  const db = getClient()
  const result = await db.execute({ sql: 'SELECT email, token FROM newsletter_subscribers WHERE token = ?', args: [token] })
  const row = result.rows[0]
  if (!row) return null
  return { email: row.email as string, token: row.token as string }
}

export async function getSubscriberByEmail(email: string): Promise<Pick<Subscriber, 'email' | 'token'> | null> {
  const db = getClient()
  const result = await db.execute({
    sql: "SELECT email, token FROM newsletter_subscribers WHERE email = ? AND status = 'confirmed'",
    args: [email],
  })
  const row = result.rows[0]
  if (!row) return null
  return { email: row.email as string, token: row.token as string }
}

export async function getConfirmedSubscribers(): Promise<Pick<Subscriber, 'email' | 'token'>[]> {
  const db = getClient()

  const result = await db.execute(
    `SELECT email, token FROM newsletter_subscribers WHERE status = 'confirmed'`,
  )

  return result.rows.map((row) => ({
    email: row.email as string,
    token: row.token as string,
  }))
}

export async function deleteSubscriber(id: number): Promise<void> {
  const db = getClient()
  await db.execute({ sql: 'DELETE FROM newsletter_subscribers WHERE id = ?', args: [id] })
}

// ─── Send History ──────────────────────────────────────────────────────

export async function recordNewsletterSend(data: {
  post_slug: string
  post_title: string
  subject: string
  recipient_count: number
  blocks_json?: string
}): Promise<number> {
  const db = getClient()

  const result = await db.execute({
    sql: `INSERT INTO newsletter_sends (post_slug, post_title, subject, recipient_count, blocks_json) VALUES (?, ?, ?, ?, ?)`,
    args: [data.post_slug, data.post_title, data.subject, data.recipient_count, data.blocks_json ?? null],
  })

  return Number(result.lastInsertRowid)
}

export async function getLastSendWithBlocks(): Promise<{ subject: string; blocks_json: string; post_slug: string } | null> {
  const db = getClient()
  const result = await db.execute(
    "SELECT subject, blocks_json, post_slug FROM newsletter_sends WHERE status = 'sent' ORDER BY sent_at DESC LIMIT 1"
  )
  const row = result.rows[0]
  if (!row || !row.blocks_json) return null
  return { subject: row.subject as string, blocks_json: row.blocks_json as string, post_slug: row.post_slug as string }
}

export async function getSendForRetry(sendId: number): Promise<{ subject: string; blocks_json: string } | null> {
  const db = getClient()
  const result = await db.execute({ sql: 'SELECT subject, blocks_json FROM newsletter_sends WHERE id = ?', args: [sendId] })
  const row = result.rows[0]
  if (!row || !row.blocks_json) return null
  return { subject: row.subject as string, blocks_json: row.blocks_json as string }
}

export async function getNewsletterSends(): Promise<NewsletterSend[]> {
  const db = getClient()

  const result = await db.execute('SELECT * FROM newsletter_sends ORDER BY sent_at DESC')

  return result.rows.map((row) => ({
    id: row.id as number,
    post_slug: row.post_slug as string,
    post_title: row.post_title as string,
    subject: row.subject as string,
    sent_at: row.sent_at as string,
    recipient_count: row.recipient_count as number,
    status: row.status as string,
  }))
}

// ─── Recipient Tracking ─────────────────────────────────────────────

export async function recordNewsletterRecipientsBatch(
  recipients: { send_id: number; email: string; resend_email_id: string | null }[],
): Promise<void> {
  if (recipients.length === 0) return
  const db = getClient()

  // Batch insert in chunks of 50
  const CHUNK_SIZE = 50
  for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
    const chunk = recipients.slice(i, i + CHUNK_SIZE)
    const placeholders = chunk.map(() => '(?, ?, ?)').join(', ')
    const args = chunk.flatMap((r) => [r.send_id, r.email, r.resend_email_id])

    await db.execute({
      sql: `INSERT INTO newsletter_recipients (send_id, email, resend_email_id) VALUES ${placeholders}`,
      args,
    })
  }
}

export async function updateRecipientEvent(
  resendEmailId: string,
  event: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained',
  timestamp: string,
  metadata?: { bounce_type?: string; click_url?: string },
): Promise<void> {
  const db = getClient()

  // Find the recipient
  const existing = await db.execute({
    sql: 'SELECT id, send_id, email, status, open_count, click_count FROM newsletter_recipients WHERE resend_email_id = ?',
    args: [resendEmailId],
  })

  if (existing.rows.length === 0) return

  const recipient = existing.rows[0]
  const recipientId = recipient.id as number
  const sendId = recipient.send_id as number
  const currentStatus = recipient.status as string
  const openCount = recipient.open_count as number
  const clickCount = recipient.click_count as number

  // Terminal statuses — don't update further
  if (currentStatus === 'bounced' || currentStatus === 'complained') return

  switch (event) {
    case 'delivered': {
      const isFirst = currentStatus === 'sent'
      await db.execute({
        sql: `UPDATE newsletter_recipients SET status = CASE WHEN status = 'sent' THEN 'delivered' ELSE status END, delivered_at = COALESCE(delivered_at, ?) WHERE id = ?`,
        args: [timestamp, recipientId],
      })
      if (isFirst) {
        await db.execute({
          sql: 'UPDATE newsletter_sends SET delivered_count = delivered_count + 1 WHERE id = ?',
          args: [sendId],
        })
      }
      break
    }

    case 'opened': {
      const isFirstOpen = openCount === 0
      await db.execute({
        sql: `UPDATE newsletter_recipients SET status = CASE WHEN status IN ('sent', 'delivered') THEN 'opened' ELSE status END, opened_at = COALESCE(opened_at, ?), open_count = open_count + 1 WHERE id = ?`,
        args: [timestamp, recipientId],
      })
      if (isFirstOpen) {
        await db.execute({
          sql: 'UPDATE newsletter_sends SET opened_count = opened_count + 1 WHERE id = ?',
          args: [sendId],
        })
      }
      break
    }

    case 'clicked': {
      const isFirstClick = clickCount === 0
      await db.execute({
        sql: `UPDATE newsletter_recipients SET status = 'clicked', clicked_at = COALESCE(clicked_at, ?), click_count = click_count + 1 WHERE id = ?`,
        args: [timestamp, recipientId],
      })
      if (isFirstClick) {
        await db.execute({
          sql: 'UPDATE newsletter_sends SET clicked_count = clicked_count + 1 WHERE id = ?',
          args: [sendId],
        })
      }
      // Record link click
      if (metadata?.click_url) {
        await db.execute({
          sql: 'INSERT INTO newsletter_link_clicks (send_id, recipient_id, url, clicked_at) VALUES (?, ?, ?, ?)',
          args: [sendId, recipientId, metadata.click_url, timestamp],
        })
      }
      break
    }

    case 'bounced': {
      await db.execute({
        sql: `UPDATE newsletter_recipients SET status = 'bounced', bounced_at = ?, bounce_type = ? WHERE id = ?`,
        args: [timestamp, metadata?.bounce_type ?? null, recipientId],
      })
      await db.execute({
        sql: 'UPDATE newsletter_sends SET bounced_count = bounced_count + 1 WHERE id = ?',
        args: [sendId],
      })
      // Auto-unsubscribe on hard bounce
      if (metadata?.bounce_type === 'hard') {
        const email = recipient.email as string
        await db.execute({
          sql: `UPDATE newsletter_subscribers SET status = 'unsubscribed', unsubscribed_at = datetime('now') WHERE email = ? AND status = 'confirmed'`,
          args: [email],
        })
      }
      break
    }

    case 'complained': {
      await db.execute({
        sql: `UPDATE newsletter_recipients SET status = 'complained', complained_at = ? WHERE id = ?`,
        args: [timestamp, recipientId],
      })
      await db.execute({
        sql: 'UPDATE newsletter_sends SET complained_count = complained_count + 1 WHERE id = ?',
        args: [sendId],
      })
      // Auto-unsubscribe on complaint
      const email = recipient.email as string
      await db.execute({
        sql: `UPDATE newsletter_subscribers SET status = 'unsubscribed', unsubscribed_at = datetime('now') WHERE email = ? AND status = 'confirmed'`,
        args: [email],
      })
      break
    }
  }
}

export async function getNewsletterSendsWithStats(): Promise<NewsletterSendStats[]> {
  const db = getClient()

  const result = await db.execute(
    'SELECT id, post_slug, post_title, subject, sent_at, recipient_count, status, delivered_count, opened_count, clicked_count, bounced_count, complained_count FROM newsletter_sends ORDER BY sent_at DESC',
  )

  return result.rows.map((row) => ({
    id: row.id as number,
    post_slug: row.post_slug as string,
    post_title: row.post_title as string,
    subject: row.subject as string,
    sent_at: row.sent_at as string,
    recipient_count: row.recipient_count as number,
    status: row.status as string,
    delivered_count: row.delivered_count as number,
    opened_count: row.opened_count as number,
    clicked_count: row.clicked_count as number,
    bounced_count: row.bounced_count as number,
    complained_count: row.complained_count as number,
  }))
}

export async function getRecipientsForSend(sendId: number): Promise<NewsletterRecipient[]> {
  const db = getClient()

  const result = await db.execute({
    sql: 'SELECT * FROM newsletter_recipients WHERE send_id = ? ORDER BY email ASC',
    args: [sendId],
  })

  return result.rows.map((row) => ({
    id: row.id as number,
    send_id: row.send_id as number,
    email: row.email as string,
    resend_email_id: row.resend_email_id as string | null,
    status: row.status as NewsletterRecipient['status'],
    delivered_at: row.delivered_at as string | null,
    opened_at: row.opened_at as string | null,
    open_count: row.open_count as number,
    clicked_at: row.clicked_at as string | null,
    click_count: row.click_count as number,
    bounced_at: row.bounced_at as string | null,
    bounce_type: row.bounce_type as string | null,
    complained_at: row.complained_at as string | null,
  }))
}

export async function getFailedRecipientsForSend(sendId: number): Promise<{ email: string; token: string }[]> {
  const db = getClient()
  const result = await db.execute({
    sql: `SELECT s.email, s.token
          FROM newsletter_recipients nr
          JOIN newsletter_subscribers s ON s.email = nr.email AND s.status = 'confirmed'
          WHERE nr.send_id = ? AND nr.resend_email_id IS NULL`,
    args: [sendId],
  })
  return result.rows.map((row) => ({ email: row.email as string, token: row.token as string }))
}

export async function updateRecipientResendId(sendId: number, email: string, resendEmailId: string): Promise<void> {
  const db = getClient()
  await db.execute({
    sql: 'UPDATE newsletter_recipients SET resend_email_id = ?, status = ? WHERE send_id = ? AND email = ?',
    args: [resendEmailId, 'sent', sendId, email],
  })
}

export async function getLinkClicksForSend(sendId: number): Promise<LinkClickStats[]> {
  const db = getClient()

  const result = await db.execute({
    sql: `SELECT url, COUNT(*) as click_count, COUNT(DISTINCT recipient_id) as unique_clickers FROM newsletter_link_clicks WHERE send_id = ? GROUP BY url ORDER BY click_count DESC`,
    args: [sendId],
  })

  return result.rows.map((row) => ({
    url: row.url as string,
    click_count: row.click_count as number,
    unique_clickers: row.unique_clickers as number,
  }))
}

export async function getOverallNewsletterStats(): Promise<OverallStats> {
  const db = getClient()

  const result = await db.execute(`
    SELECT
      COUNT(*) as total_sends,
      SUM(recipient_count) as total_recipients,
      CASE WHEN SUM(recipient_count) > 0
        THEN ROUND(CAST(SUM(opened_count) AS REAL) / SUM(recipient_count) * 100, 1)
        ELSE 0 END as avg_open_rate,
      CASE WHEN SUM(recipient_count) > 0
        THEN ROUND(CAST(SUM(clicked_count) AS REAL) / SUM(recipient_count) * 100, 1)
        ELSE 0 END as avg_click_rate,
      CASE WHEN SUM(recipient_count) > 0
        THEN ROUND(CAST(SUM(bounced_count) AS REAL) / SUM(recipient_count) * 100, 1)
        ELSE 0 END as avg_bounce_rate,
      SUM(complained_count) as total_complaints
    FROM newsletter_sends
  `)

  const row = result.rows[0]
  return {
    total_sends: (row.total_sends as number) || 0,
    total_recipients: (row.total_recipients as number) || 0,
    avg_open_rate: (row.avg_open_rate as number) || 0,
    avg_click_rate: (row.avg_click_rate as number) || 0,
    avg_bounce_rate: (row.avg_bounce_rate as number) || 0,
    total_complaints: (row.total_complaints as number) || 0,
  }
}

// ─── Trends ─────────────────────────────────────────────────────────────

export interface SendTrend {
  id: number
  subject: string
  sent_at: string
  recipient_count: number
  open_rate: number
  click_rate: number
  bounce_rate: number
}

export interface SubscriberGrowth {
  month: string
  total: number
  new_count: number
}

export async function getNewsletterTrends(): Promise<SendTrend[]> {
  const db = getClient()
  const result = await db.execute(`
    SELECT
      id, subject, sent_at, recipient_count,
      CASE WHEN recipient_count > 0
        THEN ROUND(CAST(opened_count AS REAL) / recipient_count * 100, 1)
        ELSE 0 END as open_rate,
      CASE WHEN recipient_count > 0
        THEN ROUND(CAST(clicked_count AS REAL) / recipient_count * 100, 1)
        ELSE 0 END as click_rate,
      CASE WHEN recipient_count > 0
        THEN ROUND(CAST(bounced_count AS REAL) / recipient_count * 100, 1)
        ELSE 0 END as bounce_rate
    FROM newsletter_sends
    ORDER BY sent_at ASC
  `)
  return result.rows.map((row) => ({
    id: row.id as number,
    subject: row.subject as string,
    sent_at: row.sent_at as string,
    recipient_count: (row.recipient_count as number) || 0,
    open_rate: (row.open_rate as number) || 0,
    click_rate: (row.click_rate as number) || 0,
    bounce_rate: (row.bounce_rate as number) || 0,
  }))
}

export async function getSubscriberGrowth(): Promise<SubscriberGrowth[]> {
  const db = getClient()
  const result = await db.execute(`
    SELECT
      strftime('%Y-%m', confirmed_at) as month,
      COUNT(*) as new_count
    FROM newsletter_subscribers
    WHERE status = 'confirmed' AND confirmed_at IS NOT NULL
    GROUP BY month
    ORDER BY month ASC
  `)

  let cumulative = 0
  return result.rows.map((row) => {
    const newCount = (row.new_count as number) || 0
    cumulative += newCount
    return {
      month: row.month as string,
      total: cumulative,
      new_count: newCount,
    }
  })
}
