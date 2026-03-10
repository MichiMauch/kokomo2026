import { Resend } from 'resend'
import { siteConfig } from './site-config'
import { buildNewsletterHtml, buildMultiBlockNewsletterHtml } from './newsletter-template'
import type { NewsletterBlock, PostRef } from './newsletter-blocks'

const resend = new Resend(import.meta.env.RESEND_API_KEY)

const fromEmail = () => import.meta.env.RESEND_FROM_EMAIL || 'KOKOMO House <noreply@kokomo.house>'

function emailWrapper(content: string) {
  return `
    <div style="font-family: 'Poppins', system-ui, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
      <div style="background: linear-gradient(135deg, #017734, #01ABE7); padding: 24px 32px; text-align: center;">
        <img src="${siteConfig.siteUrl}/static/images/kokomo-bildmarke.svg" alt="KOKOMO" width="48" height="48" style="margin-bottom: 8px;" />
        <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">KOKOMO House</h1>
      </div>
      <div style="padding: 32px;">
        ${content}
      </div>
      <div style="background: #f9fafb; padding: 16px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          Diese E-Mail wurde automatisch von <a href="${siteConfig.siteUrl}" style="color: #05DE66; text-decoration: none;">kokomo.house</a> gesendet.
        </p>
      </div>
    </div>
  `
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ─── Admin-Benachrichtigung: Neuer Kommentar ───

interface CommentNotification {
  postSlug: string
  authorName: string
  authorEmail: string
  content: string
  autoApproved: boolean
  isReply: boolean
}

export async function notifyNewComment(data: CommentNotification) {
  const postUrl = `${siteConfig.siteUrl}/tiny-house/${data.postSlug}/`
  const adminUrl = `${siteConfig.siteUrl}/admin/comments`
  const status = data.autoApproved ? '✅ Automatisch freigegeben' : '⏳ Wartet auf Freigabe'

  try {
    await resend.emails.send({
      from: fromEmail(),
      to: siteConfig.email,
      subject: `${data.isReply ? '💬 Antwort' : '💬 Neuer Kommentar'} auf "${data.postSlug}"`,
      html: emailWrapper(`
        <h2 style="color: #111827; margin-top: 0;">
          ${data.isReply ? 'Neue Antwort' : 'Neuer Kommentar'}
        </h2>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #6b7280;">Status</td>
            <td style="padding: 8px 12px;">${status}</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 8px 12px; font-weight: bold; color: #6b7280;">Name</td>
            <td style="padding: 8px 12px;">${escapeHtml(data.authorName)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #6b7280;">E-Mail</td>
            <td style="padding: 8px 12px;"><a href="mailto:${escapeHtml(data.authorEmail)}">${escapeHtml(data.authorEmail)}</a></td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 8px 12px; font-weight: bold; color: #6b7280;">Beitrag</td>
            <td style="padding: 8px 12px;"><a href="${postUrl}" style="color: #05DE66;">${escapeHtml(data.postSlug)}</a></td>
          </tr>
        </table>
        <div style="background: #f3f4f6; border-left: 4px solid #05DE66; padding: 16px; border-radius: 0 8px 8px 0; margin: 16px 0;">
          <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(data.content)}</p>
        </div>
        ${!data.autoApproved ? `<p style="text-align: center;"><a href="${adminUrl}" style="display: inline-block; background: #05DE66; color: white; padding: 12px 32px; border-radius: 999px; text-decoration: none; font-weight: 600;">Kommentar prüfen</a></p>` : ''}
      `),
    })
  } catch (err) {
    console.error('[notify] Failed to send admin email:', err)
  }
}

// ─── Benutzer-Benachrichtigung: Kommentar freigegeben ───

interface ApprovalNotification {
  postSlug: string
  authorName: string
  authorEmail: string
  content: string
}

export async function notifyCommentApproved(data: ApprovalNotification) {
  if (!data.authorEmail) return

  const postUrl = `${siteConfig.siteUrl}/tiny-house/${data.postSlug}/`

  try {
    await resend.emails.send({
      from: fromEmail(),
      to: data.authorEmail,
      subject: `Dein Kommentar auf KOKOMO House wurde veröffentlicht ✨`,
      html: emailWrapper(`
        <h2 style="color: #111827; margin-top: 0;">Hallo ${escapeHtml(data.authorName)} 👋</h2>
        <p style="color: #374151; line-height: 1.6;">
          Dein Kommentar wurde geprüft und ist jetzt auf unserem Blog sichtbar. Vielen Dank, dass du dir die Zeit genommen hast!
        </p>
        <div style="background: #f3f4f6; border-left: 4px solid #05DE66; padding: 16px; border-radius: 0 8px 8px 0; margin: 20px 0;">
          <p style="margin: 0; color: #6b7280; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Dein Kommentar</p>
          <p style="margin: 8px 0 0; white-space: pre-wrap; color: #374151;">${escapeHtml(data.content)}</p>
        </div>
        <p style="text-align: center;">
          <a href="${postUrl}" style="display: inline-block; background: #05DE66; color: white; padding: 12px 32px; border-radius: 999px; text-decoration: none; font-weight: 600;">Beitrag ansehen</a>
        </p>
        <p style="color: #9ca3af; font-size: 13px; margin-top: 24px;">
          Liebe Grüsse,<br />Sibylle & Michi von KOKOMO House
        </p>
      `),
    })
  } catch (err) {
    console.error('[notify] Failed to send approval email:', err)
  }
}

// ─── Benutzer-Benachrichtigung: Antwort auf deinen Kommentar ───

interface ReplyNotification {
  postSlug: string
  originalAuthorName: string
  originalAuthorEmail: string
  originalContent: string
  replyAuthorName: string
  replyContent: string
}

export async function notifyCommentReply(data: ReplyNotification) {
  if (!data.originalAuthorEmail) return

  const postUrl = `${siteConfig.siteUrl}/tiny-house/${data.postSlug}/`

  try {
    await resend.emails.send({
      from: fromEmail(),
      to: data.originalAuthorEmail,
      subject: `${escapeHtml(data.replyAuthorName)} hat auf deinen Kommentar geantwortet 💬`,
      html: emailWrapper(`
        <h2 style="color: #111827; margin-top: 0;">Hallo ${escapeHtml(data.originalAuthorName)} 👋</h2>
        <p style="color: #374151; line-height: 1.6;">
          <strong>${escapeHtml(data.replyAuthorName)}</strong> hat auf deinen Kommentar geantwortet:
        </p>
        <div style="background: #f3f4f6; border-left: 4px solid #d1d5db; padding: 16px; border-radius: 0 8px 8px 0; margin: 16px 0;">
          <p style="margin: 0; color: #6b7280; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Dein Kommentar</p>
          <p style="margin: 8px 0 0; white-space: pre-wrap; color: #6b7280;">${escapeHtml(data.originalContent)}</p>
        </div>
        <div style="background: #ecfdf5; border-left: 4px solid #05DE66; padding: 16px; border-radius: 0 8px 8px 0; margin: 16px 0;">
          <p style="margin: 0; color: #6b7280; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Antwort von ${escapeHtml(data.replyAuthorName)}</p>
          <p style="margin: 8px 0 0; white-space: pre-wrap; color: #374151;">${escapeHtml(data.replyContent)}</p>
        </div>
        <p style="text-align: center;">
          <a href="${postUrl}" style="display: inline-block; background: #05DE66; color: white; padding: 12px 32px; border-radius: 999px; text-decoration: none; font-weight: 600;">Zur Diskussion</a>
        </p>
        <p style="color: #9ca3af; font-size: 13px; margin-top: 24px;">
          Liebe Grüsse,<br />Sibylle & Michi von KOKOMO House
        </p>
      `),
    })
  } catch (err) {
    console.error('[notify] Failed to send reply email:', err)
  }
}

// ─── Newsletter: Bestätigungs-E-Mail ──────────────────────────────────

export async function sendConfirmationEmail(data: { email: string; token: string }) {
  const confirmUrl = `${siteConfig.siteUrl}/newsletter/bestaetigen?token=${data.token}`

  try {
    await resend.emails.send({
      from: fromEmail(),
      to: data.email,
      subject: 'Bitte bestätige deine Newsletter-Anmeldung auf KOKOMO House',
      html: emailWrapper(`
        <h2 style="color: #111827; margin-top: 0;">Fast geschafft!</h2>
        <p style="color: #374151; line-height: 1.6;">
          Du hast dich für den KOKOMO House Newsletter angemeldet.
          Bitte bestätige deine E-Mail-Adresse, damit wir dir künftig
          direkt schreiben können, wenn es Neuigkeiten aus unserem Tiny House gibt.
        </p>
        <p style="text-align: center; margin: 32px 0;">
          <a href="${confirmUrl}" style="display: inline-block; background: #05DE66; color: white; padding: 14px 36px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 15px;">
            Anmeldung bestätigen
          </a>
        </p>
        <p style="color: #9ca3af; font-size: 13px; line-height: 1.5;">
          Wenn du dich nicht angemeldet hast, kannst du diese E-Mail einfach ignorieren.
        </p>
      `),
    })
  } catch (err) {
    console.error('[notify] Failed to send confirmation email:', err)
  }
}

// ─── Newsletter: Newsletter-E-Mail ────────────────────────────────────

export async function sendNewsletterEmail(data: {
  email: string
  unsubscribeToken: string
  postTitle: string
  postSlug: string
  postImage: string | null
  postSummary: string
  postDate: string
}): Promise<{ resendEmailId: string | null }> {
  const postUrl = `${siteConfig.siteUrl}/tiny-house/${data.postSlug}/`
  const unsubscribeUrl = `${siteConfig.siteUrl}/unsubscribe?token=${data.unsubscribeToken}`

  const result = await resend.emails.send({
    from: fromEmail(),
    to: data.email,
    subject: data.postTitle,
    html: buildNewsletterHtml({
      postTitle: data.postTitle,
      postUrl,
      postImage: data.postImage,
      postSummary: data.postSummary,
      postDate: data.postDate,
      unsubscribeUrl,
      siteUrl: siteConfig.siteUrl,
    }),
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })

  return { resendEmailId: result.data?.id ?? null }
}

// ─── Newsletter: Multi-Block Newsletter ────────────────────────────────

export async function sendMultiBlockNewsletterEmail(data: {
  email: string
  unsubscribeToken: string
  subject: string
  blocks: NewsletterBlock[]
  postsMap: Record<string, PostRef>
}): Promise<{ resendEmailId: string | null }> {
  const unsubscribeUrl = `${siteConfig.siteUrl}/unsubscribe?token=${data.unsubscribeToken}`

  try {
    const result = await resend.emails.send({
      from: fromEmail(),
      to: data.email,
      subject: data.subject,
      html: buildMultiBlockNewsletterHtml(data.blocks, data.postsMap, siteConfig.siteUrl, unsubscribeUrl),
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })

    return { resendEmailId: result.data?.id ?? null }
  } catch (err) {
    console.error(`[notify] Failed to send multi-block newsletter to ${data.email}:`, err)
    throw err
  }
}
