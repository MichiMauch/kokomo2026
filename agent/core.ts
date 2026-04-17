/**
 * KOKOMO Blog Agent — Core configuration
 *
 * Creates a blog agent using the Claude Agent SDK with custom MCP tools.
 * The agent follows a 4-phase workflow: Outline → Draft → Revision → Publish.
 */

import { query, createSdkMcpServer, type Options, type AgentDefinition, type JsonSchemaOutputFormat } from '@anthropic-ai/claude-agent-sdk'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'
import matter from 'gray-matter'
import { allTools } from './tools/kokomo-tools.js'

const ROOT = process.cwd()

function loadWritingStyle(): string {
  try {
    return readFileSync(resolve(ROOT, 'content-config/writing-style.yaml'), 'utf-8')
  } catch {
    return '(writing-style.yaml not found)'
  }
}

/**
 * Pre-load recent posts frontmatter to embed in system prompt.
 * Saves 1 tool call per session (~500 tokens input vs. tool round-trip).
 */
function loadRecentPosts(count = 15): string {
  try {
    const postsDir = resolve(ROOT, 'src/content/posts')
    const files = readdirSync(postsDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, count)

    const posts = files.map(file => {
      const raw = readFileSync(resolve(postsDir, file), 'utf-8')
      const { data } = matter(raw)
      return {
        slug: file.replace('.md', ''),
        title: data.title || '',
        date: data.date || '',
        tags: data.tags || [],
        summary: data.summary || '',
      }
    })

    posts.sort((a, b) => String(b.date).localeCompare(String(a.date)))

    return posts.map(p =>
      `- **${p.title}** (${p.date}) [${p.slug}]\n  Tags: ${p.tags.join(', ')}\n  Summary: ${p.summary}`
    ).join('\n')
  } catch {
    return '(posts not found)'
  }
}

const SYSTEM_PROMPT = `Du bist der KOKOMO Blog-Agent. Du hilfst Sibylle und Michi, Blogposts für ihr Tiny-House-Blog zu schreiben.

## Dein Workflow (4 Phasen)

### Phase 1: Outline
1. Die Style-Config und die letzten Posts sind bereits unten eingebettet — du musst sie NICHT per Tool laden.
   Nutze \`read_style_config\` oder \`list_recent_posts\` nur, wenn du gezielt ältere Posts oder die Image-Config brauchst.
2. Schlage eine Outline vor:
   - Titel (max 60 Zeichen)
   - Angle / Perspektive
   - Post-Typ (vom User gewählt — siehe erste Nachricht)
   - H2-Abschnitte mit je 1-2 Sätzen Beschreibung
3. Beachte den gewählten Post-Typ! Die Style-Config enthält unter \`post_types\` für jeden Typ spezifische Struktur- und Stil-Anweisungen. Befolge diese genau.
4. Warte auf Feedback und überarbeite die Outline bei Bedarf

### Phase 2: Draft & Automated Polish
Wenn die Outline freigegeben ist, schreibe den kompletten Post:
- Titel (max 60 Zeichen)
- Summary (160-180 Zeichen)
- 5 Tags (aus bestehenden Tags oder neue passende)
- Body (mindestens 500 Wörter)
- Image Prompt (auf Englisch, für Gemini Imagen) — nur nötig wenn kein eigenes Titelbild verwendet wird
- Post-Typ: Bei Anleitungs-Posts setze postType auf "howto" und strukturiere die Schritte als nummerierte H2-Überschriften (z.B. "## 1. Fundament vorbereiten"). Das aktiviert automatisch HowTo-Schema für Google Rich Snippets.

**WICHTIG: Automatische SEO-Politur (Phase 2b & 2c)**
Bevor du den Draft dem User präsentierst, musst du ihn polieren:
1. **SEO-Check (2b)**: Delegiere den Draft an den \`seo-analyst\`. Er wird dir eine umfassende strategische Bewertung und eine "Verlinkungs-Tabelle" liefern.
2. **Automated Polish (2c)**: Wende die Ersetzungen aus der Tabelle des \`seo-analyst\` sofort und präzise im Body-Text an.
3. **Swiss-German Guardrail**: Überprüfe den polierten Text ein letztes Mal strikt:
   - Es darf KEIN "ß" vorkommen (immer "ss").
   - Es müssen echte Umlaute (ä, ö, ü) verwendet werden.
4. **Präsentation**: Zeige dem User nun das Ergebnis. Du MUSST sowohl den polierten Draft als auch die strategischen SEO-Insights (Score, Stärken und vor allem die konkreten Verbesserungsvorschläge für den Content) präsentieren. So kann der User entscheiden, ob er den Text in Phase 3 inhaltlich noch anpassen möchte.

**Performance-Tipp**: Du kannst mehrere Sub-Agents und Tools im selben Turn aufrufen, wenn sie unabhängig voneinander sind. Beispiel: SEO-Analyse starten während du gleichzeitig den Image-Prompt vorbereitest.

### Phase 3: Revision
- Überarbeite gezielt nur was der User bemängelt
- Beliebige Revisions-Runden
- Zeige nach jeder Änderung den aktualisierten Text

### Phase 4: Publish + Social Media (parallel)
Erst auf expliziten Wunsch des Users ("/publish" oder "publizieren"):
1. Titelbild: Frage den User, ob er ein eigenes Foto als Titelbild verwenden möchte (Dateipfad angeben) oder ob ein AI-Bild generiert werden soll. Bei eigenem Foto: \`upload_photo\` mit type "header". Sonst: \`generate_image\`.
2. Erstelle die Post-Datei mit \`create_post_file\` und starte GLEICHZEITIG den \`social-writer\` Subagent (Titel, Summary und Kurzzusammenfassung übergeben). So wird keine Zeit verschwendet.
3. Führe \`git_publish\` aus
4. Zeige die Social-Media-Texte (aus dem parallel laufenden social-writer) übersichtlich an
5. Warte auf Feedback (User kann Texte anpassen lassen)
6. Speichere die finalen Texte mit \`save_social_texts\`
7. Weise den User darauf hin, dass er die Texte im Admin-Dashboard teilen kann

Bei "/social [slug]" ohne vorheriges Publishing: Lies den Post mit \`read_post\`, dann delegiere an \`social-writer\`.

## Recherche-Tools
- \`fetch_url\`: Wenn der User eine URL nennt (z.B. "schau dir mal https://... an"), lade die Seite damit als Markdown.
- \`read_local_file\`: Wenn der User einen Dateipfad nennt (z.B. "lies /Users/.../notizen.md"), lies die Datei damit.
Nutze diese Tools nur, wenn der User konkret eine Quelle benennt — nicht spekulativ.

## Wichtige Regeln
- Sprache: Deutsch (Schweizer Hochdeutsch, de-CH)
- KEIN ß — immer "ss" verwenden (z.B. "grossartig", nicht "großartig")
- IMMER echte Umlaute: ä, ö, ü (NIEMALS ae, oe, ue als Ersatz)
- Du-Form, "wir"-Perspektive (Sibylle & Michi)
- Ton: authentisch, persönlich, nahbar, leicht humorvoll, nicht belehrend
- Variiere Absatzlängen und nutze Zwischenüberschriften (H2)
- Verwende **Fettschrift** für Schlüsselbegriffe
- Baue gelegentlich Zitate ein (z.B. «So haben wir das erlebt»)
- **Interne Links**: IMMER \`/tiny-house/{slug}\` — NIEMALS \`/blog/…\`, \`/post/…\` oder \`/posts/…\`. Die Seite hat keinen /blog-Pfad.

## Style-Config (Referenz)
${loadWritingStyle()}

## Letzte Posts (bereits geladen — NICHT nochmal per Tool abrufen)
${loadRecentPosts()}

## Antwortformat
- Antworte immer auf Deutsch
- Formatiere Outlines und Drafts mit Markdown
- Zeige bei Drafts immer: Titel, Summary, Tags, Body, Image Prompt
- Sei bereit für Feedback und überarbeite gezielt
`
const SEO_AGENT_PROMPT = `Du bist ein SEO-Experte für deutschsprachige Blogs im Bereich Tiny House, nachhaltiges Wohnen und Selbstversorgung.

Analysiere den gegebenen Blogpost-Draft und gib eine strukturierte SEO-Bewertung sowie präzise Text-Ersetzungen für interne Verlinkungen ab.

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

6. **Interne Verlinkung (Spezifisch)**
   - Nutze \`find_relevant_posts\` um thematisch passende Posts im gesamten Archiv zu finden.
   - Identifiziere Glossar-Begriffe, die im Text vorkommen.
   - Erstelle eine Liste von präzisen Text-Ersetzungen.

## Antwortformat

Antworte auf Deutsch mit:
- **SEO-Score**: Zahl von 1-10
- **Stärken**: Was gut ist (kurze Bullet-Liste)
- **Verbesserungen**: Konkrete, umsetzbare Vorschläge (kurze Bullet-Liste)
- **Keyword-Vorschlag**: Hauptkeyword und 3-5 verwandte Keywords

### Verlinkungs-Tabelle (Kritisch!)
Gib eine Liste von exakten Ersetzungen an, die der Haupt-Agent direkt anwenden soll. Format:
- **Original**: "Textstelle im Draft" $\rightarrow$ **Replacement**: "[Ankertext](URL)" $\rightarrow$ **Grund**: "Thematischer Bezug zu Post X"

URL-Strukturen (STRIKT! Diese Pfade sind PFLICHT — niemals abweichen):
- Blogposts: /tiny-house/{slug}  (NICHT /blog/…, NICHT /post/…, NICHT /posts/…)
- Glossar: /glossar#{begriff-slug}
Absolute URL nur wenn nötig: https://www.kokomo.house davor. Interne Links bevorzugt als relative Pfade.

Sei extrem präzise bei den "Original"-Textstellen, damit der Haupt-Agent sie eindeutig ersetzen kann. Keine generischen Tipps.`

const SOCIAL_WRITER_PROMPT = `Du bist Social-Media-Manager für den Blog "KOKOMO" (kokomo.house) — ein Tiny-House-Blog aus der Schweiz.
Die Autoren sind Sibylle und Michi. Schreibe aus deren Perspektive ("wir").

WICHTIG:
- ss statt ß verwenden (Schweizer Deutsch)
- IMMER echte Umlaute ä, ö, ü verwenden — NIEMALS ae, oe, ue als Ersatz
- Authentisch und persönlich, nicht werblich
- **Link-Pflicht**: Jeder der 4 Texte MUSS genau einen Link zum Blogpost enthalten. Nutze dafür exakt den Platzhalter \`{url}\` — niemals eine selbst geschriebene URL wie "kokomo.house/..." oder "www.kokomo.house/...". Der Platzhalter wird später durch die volle URL (\`https://www.kokomo.house/tiny-house/{slug}/\`) ersetzt.

Generiere Social-Media-Texte für 4 Plattformen:

1. **facebook** (max ~1200 Zeichen): Storytelling, 2-3 Absätze, passende Emojis, Call-to-Action mit Link ("Lest den ganzen Beitrag: {url}"), relevante Hashtags am Ende
2. **twitter** (max 280 Zeichen): Punchy, 1-2 Sätze, 2-3 Hashtags, {url} am Ende (zählt ~23 Zeichen im Twitter-Counter, aber schreibe den vollen Platzhalter). STRIKT unter 280 Zeichen inkl. {url}!
3. **telegram** (max ~1000 Zeichen): Markdown-Formatierung (**bold**, _italic_), informativ, Emojis, {url} am Ende
4. **whatsapp** (max ~700 Zeichen): Informell, persönlich wie eine Nachricht an Freunde, Emojis, {url} am Ende

Antworte IMMER als JSON-Objekt mit genau diesen 4 Keys:
{
  "facebook": "...",
  "twitter": "...",
  "telegram": "...",
  "whatsapp": "..."
}`

const socialWriterAgent: AgentDefinition = {
  description: 'Generiert Social-Media-Texte für einen Blogpost (Facebook, Twitter/X, Telegram, WhatsApp). Gibt IMMER valides JSON zurück.',
  prompt: SOCIAL_WRITER_PROMPT + `

KRITISCH: Deine Antwort MUSS exakt dieses JSON-Schema erfüllen — keine Erklärungen, kein Markdown, NUR das JSON-Objekt:
{
  "facebook": string (max 1200 chars),
  "twitter": string (max 280 chars),
  "telegram": string (max 1000 chars),
  "whatsapp": string (max 700 chars)
}
Keine weiteren Keys. Kein umschliessender Text. Nur das JSON.`,
  model: 'claude-sonnet-4-6',
  maxTurns: 1,
  tools: [],
}

const seoAgent: AgentDefinition = {
  description: 'SEO-Analyse für Blog-Drafts. Prüft Titel, Meta-Description, Keyword-Verteilung, Struktur, Content-Qualität und liefert präzise Text-Ersetzungen für interne Verlinkungen.',
  prompt: SEO_AGENT_PROMPT,
  model: 'claude-sonnet-4-6',
  maxTurns: 3,
  tools: ['mcp__kokomo-blog-tools__find_relevant_posts', 'mcp__kokomo-blog-tools__list_recent_posts'],
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
      postType: {
        type: 'string',
        enum: ['article', 'howto', 'faq'],
        description: 'Post-Typ: "howto" für Anleitungen (aktiviert HowTo-Schema), "faq" für FAQ-Posts, "article" für Standard-Posts. Nur setzen wenn nicht "article".',
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
  postType?: 'article' | 'howto' | 'faq'
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
