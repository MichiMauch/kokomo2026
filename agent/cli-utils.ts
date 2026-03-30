/**
 * Terminal formatting helpers for the blog agent CLI
 */

// ANSI color codes
const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const GREEN = '\x1b[32m'
const CYAN = '\x1b[36m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const MAGENTA = '\x1b[35m'

export function agentHeader() {
  console.log(`
${CYAN}${BOLD} _  __  ___  _  __  ___  __  __  ___        ____ _     ___
| |/ / / _ \\| |/ / / _ \\|  \\/  |/ _ \\      / ___| |   |_ _|
| ' / | | | | ' / | | | | |\\/| | | | |____| |   | |    | |
| . \\ | |_| | . \\ | |_| | |  | | |_| |____| |___| |___ | |
|_|\\_\\ \\___/|_|\\_\\ \\___/|_|  |_|\\___/      \\____|_____|___|${RESET}

${CYAN}  B l o g - A g e n t${RESET}  ${DIM}made with love by Michi${RESET}
${DIM}Befehle: /publish  /social [slug]  /quit${RESET}
`)
}

export function printAgent(text: string) {
  console.log(`${GREEN}${BOLD}Agent:${RESET} ${text}`)
}

export function printUser(text: string) {
  console.log(`\n${CYAN}${BOLD}Du:${RESET} ${text}`)
}

export function printSystem(text: string) {
  console.log(`${DIM}${text}${RESET}`)
}

export function printError(text: string) {
  console.log(`${RED}${BOLD}Fehler:${RESET} ${text}`)
}

export function printToolUse(toolName: string, input?: string) {
  console.log(`${MAGENTA}${DIM}  ⚙ ${toolName}${input ? `: ${input.slice(0, 80)}` : ''}${RESET}`)
}

export function printToolProgress(toolName: string, elapsedSeconds: number) {
  process.stdout.write(`\r${MAGENTA}${DIM}  ⏳ ${toolName} (${Math.round(elapsedSeconds)}s)${RESET}`)
}

export function printCost(costUsd: number, turns: number) {
  console.log(`${DIM}  (${turns} Turns, $${costUsd.toFixed(4)})${RESET}`)
}

export function printDivider() {
  console.log(`${DIM}${'─'.repeat(50)}${RESET}`)
}

const UNDERLINE = '\x1b[4m'

export function formatMarkdownLine(line: string): string {
  // Headings (check longest prefix first)
  if (line.startsWith('### ')) return `${CYAN}${BOLD}${line.slice(4)}${RESET}`
  if (line.startsWith('## '))  return `${CYAN}${BOLD}${line.slice(3).toUpperCase()}${RESET}`
  if (line.startsWith('# '))   return `${CYAN}${BOLD}${UNDERLINE}${line.slice(2).toUpperCase()}${RESET}`

  // Horizontal rule
  if (/^(-{3,}|\*{3,})$/.test(line.trim())) return `${DIM}${'─'.repeat(50)}${RESET}`

  // Blockquote
  if (line.startsWith('> ')) return `${DIM}│ ${line.slice(2)}${RESET}`

  // List items
  line = line.replace(/^(\s*)[-*] /, '$1  • ')

  // Inline formatting (order matters: bold before italic)
  line = line.replace(/\*\*(.+?)\*\*/g, `${BOLD}$1${RESET}`)
  line = line.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, `${DIM}$1${RESET}`)
  line = line.replace(/_([^_]+)_/g, `${DIM}$1${RESET}`)
  line = line.replace(/`([^`]+)`/g, `${YELLOW}$1${RESET}`)

  return line
}
