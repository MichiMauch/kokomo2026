#!/usr/bin/env npx tsx
/**
 * KOKOMO Blog Agent — CLI Entry Point
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
  printAgent,
  printUser,
  printSystem,
  printError,
  printToolUse,
  printCost,
  printDivider,
} from './cli-utils.js'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'

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

async function processQuery(prompt: string, sessionId?: string) {
  const queryInstance = queryBlogAgent(prompt, {
    resume: sessionId,
    includePartialMessages: false,
  })

  let resultSessionId: string | undefined
  let lastText = ''

  for await (const message of queryInstance) {
    const msg = message as SDKMessage

    if (msg.type === 'assistant') {
      resultSessionId = msg.session_id
      const textParts = msg.message?.content?.filter(
        (c: any) => c.type === 'text'
      ) || []
      const toolParts = msg.message?.content?.filter(
        (c: any) => c.type === 'tool_use'
      ) || []

      // Show tool usage
      for (const tp of toolParts) {
        const t = tp as any
        printToolUse(t.name, JSON.stringify(t.input).slice(0, 100))
      }

      // Show text
      for (const tp of textParts) {
        const t = tp as any
        if (t.text && t.text !== lastText) {
          lastText = t.text
        }
      }
    }

    if (msg.type === 'result') {
      resultSessionId = msg.session_id
      if (msg.subtype === 'success' && msg.result) {
        console.log()
        printAgent(msg.result)
      }
      if (msg.subtype === 'success') {
        printCost(msg.total_cost_usd, msg.num_turns)
      }
      if ('is_error' in msg && msg.is_error) {
        const errors = 'errors' in msg ? (msg as any).errors : []
        printError(errors.join(', ') || 'Unknown error')
      }
    }
  }

  return resultSessionId
}

async function main() {
  agentHeader()

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
        'Der User möchte jetzt publizieren. Führe Phase 4 aus: Generiere das Titelbild, erstelle die Post-Datei und publiziere via git.',
        sessionId,
      )
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
