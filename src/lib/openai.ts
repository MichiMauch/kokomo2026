/**
 * OpenAI client for comment moderation
 * Evaluates comments for politeness/spam and generates friendly replies
 */

import OpenAI from 'openai'

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (client) return client

  const apiKey = import.meta.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY must be set')
  }

  client = new OpenAI({ apiKey })
  return client
}

export interface ModerationResult {
  approved: boolean
  reply: string | null
  reason: string
}

export async function moderateComment(comment: string, postSlug: string): Promise<ModerationResult> {
  try {
    const openai = getClient()

    const completion = await openai.chat.completions.create({
      model: 'gpt-5.2',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Du bist ein freundlicher Blog-Moderator fuer den Reiseblog "Kokomo" (kokomo.house).
Der Blog handelt von einem Schweizer Paar (Michi und Jenny), das ein Tiny House auf einer tropischen Insel baut.

Deine Aufgabe:
1. Bewerte den Kommentar: Ist er hoeflich, kein Spam, kein Hate Speech, kein Nonsense?
2. Wenn der Kommentar in Ordnung ist: Generiere eine freundliche, kurze Antwort auf Deutsch (1-3 Saetze). Die Antwort soll authentisch und warmherzig klingen, als kaeme sie von den Blog-Betreibern. Unterschreibe nicht mit einem Namen.
3. Wenn der Kommentar nicht in Ordnung ist: Erklaere kurz warum.

Antworte als JSON:
{
  "approved": true/false,
  "reply": "Deine freundliche Antwort" oder null wenn nicht approved,
  "reason": "Kurze Begruendung fuer die Entscheidung"
}`,
        },
        {
          role: 'user',
          content: `Blog-Post: ${postSlug}\n\nKommentar:\n${comment}`,
        },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return { approved: false, reply: null, reason: 'Keine Antwort von OpenAI erhalten' }
    }

    const result = JSON.parse(content) as ModerationResult
    return {
      approved: Boolean(result.approved),
      reply: result.approved ? (result.reply ?? null) : null,
      reason: result.reason || 'Keine Begruendung',
    }
  } catch (err) {
    console.error('[openai/moderateComment]', err)
    return { approved: false, reply: null, reason: 'AI-Moderation fehlgeschlagen, manuelle Pruefung noetig' }
  }
}
