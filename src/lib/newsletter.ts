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
}): Promise<number> {
  const db = getClient()

  const result = await db.execute({
    sql: `INSERT INTO newsletter_sends (post_slug, post_title, subject, recipient_count) VALUES (?, ?, ?, ?)`,
    args: [data.post_slug, data.post_title, data.subject, data.recipient_count],
  })

  return Number(result.lastInsertRowid)
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
