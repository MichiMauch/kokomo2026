#!/usr/bin/env npx tsx
/**
 * KOKOMO Blog Agent — CLI Entry Point
 *
 * Features:
 * - Echtzeit-Streaming (Text erscheint Wort für Wort)
 * - Ctrl+C Interrupt-Support (sauberer Abbruch)
 * - Tool-Progress-Anzeige (Fortschritt bei langen Tools)
 * - Budget-Limit (maxBudgetUsd in core.ts)
 *
 * Usage:
 *   npx tsx agent/blog-agent.ts "Erfahrungen mit dem Kompostklo nach 3 Jahren"
 *   npm run blog-agent -- "meine stichworte hier"
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createInterface } from 'readline'
import { queryBlogAgent } from './core.js'
import {
  agentHeader,
  printUser,
  printSystem,
  printError,
  printToolUse,
  printToolProgress,
  printCost,
  printDivider,
} from './cli-utils.js'
import type { SDKMessage, Query } from '@anthropic-ai/claude-agent-sdk'

// Load env
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
})

function ask(prompt: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(prompt, answer => resolve(answer.trim()))
  })
}

// Track active query for interrupt support
let activeQuery: Query | null = null

async function processQuery(prompt: string, sessionId?: string) {
  const abortController = new AbortController()
  const queryInstance = queryBlogAgent(prompt, {
    resume: sessionId,
    includePartialMessages: true,
    abortController,
  })
  activeQuery = queryInstance

  let resultSessionId: string | undefined
  let isStreaming = false
  const activeTools = new Map<string, string>()

  for await (const message of queryInstance) {
    const msg = message as SDKMessage

    // Echtzeit-Streaming: Text Wort für Wort anzeigen
    if (msg.type === 'stream_event') {
      const event = msg.event
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'text') {
          if (!isStreaming) {
            process.stdout.write('\n\x1b[32m\x1b[1mAgent:\x1b[0m ')
            isStreaming = true
          }
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          process.stdout.write(event.delta.text)
        }
      } else if (event.type === 'message_stop') {
        if (isStreaming) {
          process.stdout.write('\n')
          isStreaming = false
        }
      }
    }

    // Tool-Nutzung anzeigen
    if (msg.type === 'assistant') {
      resultSessionId = msg.session_id
      const toolParts = msg.message?.content?.filter(
        (c: any) => c.type === 'tool_use'
      ) || []

      for (const tp of toolParts) {
        const t = tp as any
        activeTools.set(t.id, t.name)
        printToolUse(t.name, JSON.stringify(t.input).slice(0, 100))
      }
    }

    // Tool-Progress anzeigen (z.B. bei Bildgenerierung)
    if (msg.type === 'tool_progress') {
      const toolName = msg.tool_name || activeTools.get(msg.tool_use_id) || 'tool'
      printToolProgress(toolName, msg.elapsed_time_seconds)
    }

    // Ergebnis verarbeiten
    if (msg.type === 'result') {
      resultSessionId = msg.session_id
      if (isStreaming) {
        process.stdout.write('\n')
        isStreaming = false
      }
      // Bei Streaming zeigen wir den Text schon live an — nur noch Kosten/Fehler
      if (msg.subtype === 'success') {
        printCost(msg.total_cost_usd, msg.num_turns)
      }
      if (msg.subtype === 'error_max_budget_usd') {
        printError('Budget-Limit erreicht! Der Agent wurde gestoppt.')
      }
      if ('is_error' in msg && msg.is_error) {
        const errors = 'errors' in msg ? (msg as any).errors : []
        printError(errors.join(', ') || 'Unbekannter Fehler')
      }
    }
  }

  activeQuery = null
  return resultSessionId
}

async function main() {
  agentHeader()

  // Ctrl+C: aktive Query sauber unterbrechen
  process.on('SIGINT', async () => {
    if (activeQuery) {
      printSystem('\nUnterbreche Agent...')
      try {
        await activeQuery.interrupt()
      } catch {
        activeQuery.close()
      }
      activeQuery = null
    } else {
      printSystem('\nTschüss!')
      rl.close()
      process.exit(0)
    }
  })

  // Get initial topic from args or ask
  let topic = process.argv.slice(2).join(' ')
  if (!topic) {
    topic = await ask('Thema oder Stichworte: ')
    if (!topic) {
      printError('Kein Thema angegeben.')
      process.exit(1)
    }
  }

  printUser(topic)
  printDivider()

  // First query
  let sessionId = await processQuery(
    `Schreibe einen Blogpost zum Thema: ${topic}\n\nStarte mit Phase 1 (Outline). Lies zuerst die Style-Config und die letzten Posts.`,
  )

  // Feedback loop
  while (true) {
    console.log()
    const input = await ask('\x1b[36m\x1b[1mDu:\x1b[0m ')

    if (!input) continue

    // Commands
    if (input === '/quit' || input === '/exit') {
      printSystem('Tschüss!')
      break
    }

    if (input === '/publish') {
      printSystem('Starte Publishing...')
      sessionId = await processQuery(
        'Der User möchte jetzt publizieren. Führe Phase 4 aus: Frage zuerst, ob der User ein eigenes Foto als Titelbild verwenden möchte (Dateipfad) oder ob ein AI-Bild generiert werden soll. Dann erstelle die Post-Datei und publiziere via git. Danach automatisch weiter mit Phase 5 (Social Media).',
        sessionId,
      )
      continue
    }

    if (input.startsWith('/social')) {
      const slug = input.replace('/social', '').trim()
      printSystem('Generiere Social-Media-Texte...')
      const socialPrompt = slug
        ? `Führe Phase 5 (Social Media) aus für den bestehenden Post mit Slug "${slug}". Lies zuerst den Post mit read_post, dann delegiere an den social-writer Subagent und speichere die Texte.`
        : 'Führe Phase 5 (Social Media) aus für den aktuellen Post. Delegiere an den social-writer Subagent und speichere die Texte.'
      sessionId = await processQuery(socialPrompt, sessionId)
      continue
    }

    printDivider()
    sessionId = await processQuery(input, sessionId)
  }

  rl.close()
  process.exit(0)
}

main().catch(err => {
  printError(err.message)
  process.exit(1)
})
