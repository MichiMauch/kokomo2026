/**
 * KOKOMO Blog Agent — Core configuration
 *
 * Creates a blog agent using the Claude Agent SDK with custom MCP tools.
 * The agent follows a 4-phase workflow: Outline → Draft → Revision → Publish.
 */

import { query, createSdkMcpServer, type Options } from '@anthropic-ai/claude-agent-sdk'
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
- Image Prompt (auf Englisch, für Gemini Imagen)

### Phase 2b: SEO-Check
Führe nach dem Draft automatisch \`analyze_seo\` aus:
- Übergib Titel, Summary, Tags, Body und optional ein Fokus-Keyword
- Zeige dem User die SEO-Bewertung (Score, Stärken, Verbesserungen, Keyword- und Verlinkungsvorschläge)
- Schlage konkrete Änderungen vor, wenn der Score unter 7 liegt
- Warte auf Feedback, ob der User die Vorschläge umsetzen möchte

### Phase 3: Revision
- Überarbeite gezielt nur was der User bemängelt
- Beliebig viele Revisions-Runden
- Zeige nach jeder Änderung den aktualisierten Text

### Phase 4: Publish
Erst auf expliziten Wunsch des Users ("/publish" oder "publizieren"):
1. Generiere das Titelbild mit \`generate_image\`
2. Erstelle die Post-Datei mit \`create_post_file\`
3. Führe \`git_publish\` aus

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
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    cwd: ROOT,
    tools: [],  // no built-in tools needed
    mcpServers: {
      'kokomo-blog-tools': mcpServer,
    },
    ...overrides,
  }
}

/**
 * Run a single query with the blog agent
 */
export function queryBlogAgent(prompt: string, overrides?: Partial<Options>) {
  return query({
    prompt,
    options: getBlogAgentOptions(overrides),
  })
}
