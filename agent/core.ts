/**
 * KOKOMO Blog Agent — Core configuration
 *
 * Creates a blog agent using the Claude Agent SDK with custom MCP tools.
 * The agent follows a 4-phase workflow: Outline → Draft → Revision → Publish.
 */

import { query, createSdkMcpServer, type Options, type AgentDefinition, type JsonSchemaOutputFormat } from '@anthropic-ai/claude-agent-sdk'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { allTools } from './tools/kokomo-tools.js'

const ROOT = process.cwd()

function loadWritingStyle(): string {
  try {
    return readFileSync(resolve(ROOT, 'content-config/writing-style.yaml'), 'utf-8')
  } catch {
    return '(writing-style.yaml not found)'
  }
}

const SYSTEM_PROMPT = `Du bist der KOKOMO Blog-Agent. Du hilfst Sibylle und Michi, Blogposts für ihr Tiny-House-Blog zu schreiben.

## Dein Workflow (4 Phasen)

### Phase 1: Outline
1. Lies zuerst die Style-Config mit dem Tool \`read_style_config\` (config: "writing")
2. Lies die letzten Posts mit \`list_recent_posts\` (count: 10) um Duplikate zu vermeiden
3. Schlage eine Outline vor:
   - Titel (max 60 Zeichen)
   - Angle / Perspektive
   - Post-Typ (Erzählung, Listenpost, Anleitung, Erfahrungsbericht)
   - H2-Abschnitte mit je 1-2 Sätzen Beschreibung
4. Warte auf Feedback und überarbeite die Outline bei Bedarf

### Phase 2: Draft
Wenn die Outline freigegeben ist, schreibe den kompletten Post:
- Titel (max 60 Zeichen)
- Summary (160-180 Zeichen)
- 5 Tags (aus bestehenden Tags oder neue passende)
- Body (mindestens 500 Wörter)
- Image Prompt (auf Englisch, für Gemini Imagen) — nur nötig wenn kein eigenes Titelbild verwendet wird

### Phase 2b: SEO-Check
Delegiere nach dem Draft die SEO-Analyse an den \`seo-analyst\` Subagent:
- Übergib ihm den vollständigen Draft (Titel, Summary, Tags, Body) und optional ein Fokus-Keyword
- Der Subagent hat Zugriff auf \`list_recent_posts\` für Verlinkungsvorschläge
- Zeige dem User die SEO-Bewertung (Score, Stärken, Verbesserungen, Keyword- und Verlinkungsvorschläge)
- Schlage konkrete Änderungen vor, wenn der Score unter 7 liegt
- Warte auf Feedback, ob der User die Vorschläge umsetzen möchte

### Phase 3: Revision
- Überarbeite gezielt nur was der User bemängelt
- Beliebig viele Revisions-Runden
- Zeige nach jeder Änderung den aktualisierten Text

### Phase 4: Publish
Erst auf expliziten Wunsch des Users ("/publish" oder "publizieren"):
1. Titelbild: Frage den User, ob er ein eigenes Foto als Titelbild verwenden möchte (Dateipfad angeben) oder ob ein AI-Bild generiert werden soll. Bei eigenem Foto: \`upload_photo\` mit type "header". Sonst: \`generate_image\`.
2. Erstelle die Post-Datei mit \`create_post_file\`
3. Führe \`git_publish\` aus
4. Gehe automatisch weiter zu Phase 5

### Phase 5: Social Media
Nach erfolgreichem Publishing (oder auf expliziten Wunsch mit "/social [slug]"):
1. Delegiere an den \`social-writer\` Subagent — übergib ihm Titel, Summary und eine Kurzzusammenfassung des Posts
2. Parse das JSON-Ergebnis und zeige dem User die generierten Texte für alle 4 Plattformen übersichtlich an
3. Warte auf Feedback (User kann Texte anpassen lassen)
4. Speichere die finalen Texte mit \`save_social_texts\`
5. Weise den User darauf hin, dass er die Texte im Admin-Dashboard teilen kann

## Wichtige Regeln
- Sprache: Deutsch (Schweizer Hochdeutsch, de-CH)
- KEIN ß — immer "ss" verwenden (z.B. "grossartig", nicht "großartig")
- IMMER echte Umlaute: ä, ö, ü (NIEMALS ae, oe, ue als Ersatz)
- Du-Form, "wir"-Perspektive (Sibylle & Michi)
- Ton: authentisch, persönlich, nahbar, leicht humorvoll, nicht belehrend
- Variiere Absatzlängen und nutze Zwischenüberschriften (H2)
- Verwende **Fettschrift** für Schlüsselbegriffe
- Baue gelegentlich Zitate ein (z.B. «So haben wir das erlebt»)

## Style-Config (Referenz)
${loadWritingStyle()}

## Antwortformat
- Antworte immer auf Deutsch
- Formatiere Outlines und Drafts mit Markdown
- Zeige bei Drafts immer: Titel, Summary, Tags, Body, Image Prompt
- Sei bereit für Feedback und überarbeite gezielt
`

const SEO_AGENT_PROMPT = `Du bist ein SEO-Experte für deutschsprachige Blogs im Bereich Tiny House, nachhaltiges Wohnen und Selbstversorgung.

Analysiere den gegebenen Blogpost-Draft und gib eine strukturierte SEO-Bewertung ab.

## Prüfkriterien

1. **Titel** (max 60 Zeichen für Google SERP)
   - Enthält das Hauptkeyword?
   - Weckt Neugier / hat einen klaren Nutzen?

2. **Meta-Description / Summary** (optimal 150-160 Zeichen)
   - Enthält das Hauptkeyword?
   - Hat einen Call-to-Action oder Nutzenversprechen?

3. **Keyword-Verteilung**
   - Hauptkeyword im Titel, Summary, erstem Absatz, mindestens einer H2?
   - Natürliche Keyword-Dichte (nicht erzwungen)?
   - Verwandte Begriffe / LSI-Keywords vorhanden?

4. **Struktur**
   - Mindestens 2-3 H2-Überschriften?
   - Logischer Aufbau?
   - Absätze nicht zu lang (max 3-4 Sätze)?

5. **Content-Qualität**
   - Mindestens 500 Wörter?
   - Einzigartiger Angle / Mehrwert?
   - Persönliche Erfahrung / E-E-A-T Signale?

6. **Interne Verlinkung**
   - Nutze \`list_recent_posts\` um bestehende Posts zu finden, die thematisch passen
   - Welche Glossar-Begriffe kommen im Text vor und könnten verlinkt werden?

## Antwortformat

Antworte auf Deutsch mit:
- **SEO-Score**: Zahl von 1-10
- **Stärken**: Was gut ist (kurze Bullet-Liste)
- **Verbesserungen**: Konkrete, umsetzbare Vorschläge (kurze Bullet-Liste)
- **Keyword-Vorschlag**: Hauptkeyword und 3-5 verwandte Keywords
- **Verlinkungsvorschläge**: Interne Links zu bestehenden Posts und Glossar-Begriffen (mit Slugs)

URL-Struktur: https://www.kokomo.house/tiny-house/{slug}
Glossar: https://www.kokomo.house/glossar#{begriff-slug}

Sei konkret und praxisnah. Keine generischen Tipps.`

const SOCIAL_WRITER_PROMPT = `Du bist Social-Media-Manager für den Blog "KOKOMO" (kokomo.house) — ein Tiny-House-Blog aus der Schweiz.
Die Autoren sind Sibylle und Michi. Schreibe aus deren Perspektive ("wir").

WICHTIG:
- ss statt ß verwenden (Schweizer Deutsch)
- IMMER echte Umlaute ä, ö, ü verwenden — NIEMALS ae, oe, ue als Ersatz
- Authentisch und persönlich, nicht werblich
- URL-Platzhalter {url} verwenden wo ein Link zum Blogpost stehen soll

Generiere Social-Media-Texte für 4 Plattformen:

1. **facebook** (max ~1200 Zeichen): Storytelling, 2-3 Absätze, passende Emojis, Call-to-Action ("Lest den ganzen Beitrag: {url}"), relevante Hashtags am Ende
2. **twitter** (max 280 Zeichen): Punchy, 1-2 Sätze, 2-3 Hashtags, {url} am Ende. STRIKT unter 280 Zeichen!
3. **telegram** (max ~1000 Zeichen): Markdown-Formatierung (**bold**, _italic_), informativ, Emojis, Link am Ende
4. **whatsapp** (max ~700 Zeichen): Informell, persönlich wie eine Nachricht an Freunde, Emojis, Link am Ende

Antworte IMMER als JSON-Objekt mit genau diesen 4 Keys:
{
  "facebook": "...",
  "twitter": "...",
  "telegram": "...",
  "whatsapp": "..."
}`

const socialWriterAgent: AgentDefinition = {
  description: 'Generiert Social-Media-Texte für einen Blogpost (Facebook, Twitter/X, Telegram, WhatsApp).',
  prompt: SOCIAL_WRITER_PROMPT,
  model: 'claude-sonnet-4-6',
  maxTurns: 1,
  tools: [],
}

const seoAgent: AgentDefinition = {
  description: 'SEO-Analyse für Blog-Drafts. Prüft Titel, Meta-Description, Keyword-Verteilung, Struktur, Content-Qualität und schlägt interne Verlinkungen vor.',
  prompt: SEO_AGENT_PROMPT,
  model: 'claude-sonnet-4-6',
  maxTurns: 3,
  tools: ['mcp__kokomo-blog-tools__list_recent_posts'],
}

/**
 * Create MCP server with KOKOMO tools
 */
function createKokomoMcpServer() {
  return createSdkMcpServer({
    name: 'kokomo-blog-tools',
    version: '1.0.0',
    tools: allTools,
  })
}

/**
 * Build query options for the blog agent
 */
export function getBlogAgentOptions(overrides?: Partial<Options>): Options {
  const mcpServer = createKokomoMcpServer()

  return {
    systemPrompt: SYSTEM_PROMPT,
    model: 'claude-sonnet-4-6',
    maxTurns: 30,
    maxBudgetUsd: 2,
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    cwd: ROOT,
    tools: [],  // no built-in tools needed
    mcpServers: {
      'kokomo-blog-tools': mcpServer,
    },
    agents: {
      'seo-analyst': seoAgent,
      'social-writer': socialWriterAgent,
    },
    ...overrides,
  }
}

/**
 * Run a single query with the blog agent (interactive, free-form Markdown output)
 */
export function queryBlogAgent(prompt: string, overrides?: Partial<Options>) {
  return query({
    prompt,
    options: getBlogAgentOptions(overrides),
  })
}

/**
 * JSON Schema for structured blog post draft output.
 * Used by queryBlogAgentStructured() for programmatic/pipeline use.
 */
export const BLOG_DRAFT_SCHEMA: JsonSchemaOutputFormat = {
  type: 'json_schema',
  schema: {
    type: 'object',
    required: ['title', 'summary', 'tags', 'body', 'imagePrompt'],
    properties: {
      title: {
        type: 'string',
        description: 'Post-Titel, max 60 Zeichen',
      },
      summary: {
        type: 'string',
        description: 'Meta-Description / Summary, 160-180 Zeichen',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: '5 thematisch passende Tags',
      },
      body: {
        type: 'string',
        description: 'Vollständiger Post-Body in Markdown, mindestens 500 Wörter',
      },
      imagePrompt: {
        type: 'string',
        description: 'Bildgenerierungs-Prompt auf Englisch für Gemini Imagen',
      },
    },
    additionalProperties: false,
  },
}

/** Typed result of a structured blog draft query */
export interface BlogDraft {
  title: string
  summary: string
  tags: string[]
  body: string
  imagePrompt: string
}

/**
 * Run a non-interactive query that returns a structured BlogDraft JSON.
 * Useful for automated pipelines where you need reliably parseable output
 * instead of free-form Markdown.
 *
 * @example
 * ```typescript
 * const { draft, sessionId } = await queryBlogAgentStructured(
 *   'Schreibe einen Post über Regenwassernutzung im Tiny House'
 * )
 * console.log(draft.title)  // guaranteed string
 * console.log(draft.tags)   // guaranteed string[]
 * ```
 */
export async function queryBlogAgentStructured(
  prompt: string,
  overrides?: Partial<Options>,
): Promise<{ draft: BlogDraft; sessionId: string }> {
  const q = query({
    prompt,
    options: getBlogAgentOptions({
      outputFormat: BLOG_DRAFT_SCHEMA,
      ...overrides,
    }),
  })

  let result: string | undefined
  let sessionId = ''

  for await (const message of q) {
    const msg = message as any
    if (msg.type === 'result' && msg.subtype === 'success') {
      result = msg.result
      sessionId = msg.session_id
    }
  }

  if (!result) {
    throw new Error('Agent returned no result')
  }

  return { draft: JSON.parse(result) as BlogDraft, sessionId }
}
