/**
 * Draft Preview — Generates a temporary HTML file and opens it in the browser.
 * Shows the blog post as it will appear on kokomo.house, with word count and reading time.
 */

import { writeFileSync } from 'fs'
import { resolve } from 'path'
import { tmpdir } from 'os'
import { execSync } from 'child_process'

interface PreviewData {
  title: string
  summary: string
  tags: string[]
  body: string
  imageUrl?: string
}

/**
 * Parse a markdown draft block from the agent's output.
 * Expects the agent to output title, summary, tags, body in its standard format.
 */
export function parseDraftFromMarkdown(text: string): PreviewData | null {
  const titleMatch = text.match(/\*\*Titel\*\*:\s*(.+)/i) || text.match(/^#\s+(.+)/m)
  const summaryMatch = text.match(/\*\*Summary\*\*:\s*(.+)/i) || text.match(/\*\*Zusammenfassung\*\*:\s*(.+)/i)
  const tagsMatch = text.match(/\*\*Tags\*\*:\s*(.+)/i)
  const imageMatch = text.match(/\*\*Image(?:\s*Prompt)?\*\*:\s*(.+)/i)

  // Extract body: everything after "**Body**:" or between --- markers, or after the metadata block
  let body = ''
  const bodyMatch = text.match(/\*\*Body\*\*:\s*\n([\s\S]+?)(?=\n\*\*Image|\n---\s*$|$)/i)
  if (bodyMatch) {
    body = bodyMatch[1].trim()
  }

  if (!titleMatch || !body) return null

  const tags = tagsMatch
    ? tagsMatch[1].split(/,\s*/).map(t => t.replace(/[`[\]]/g, '').trim())
    : []

  return {
    title: titleMatch[1].trim(),
    summary: summaryMatch?.[1]?.trim() || '',
    tags,
    body,
    imageUrl: imageMatch?.[1]?.trim(),
  }
}

function markdownToHtml(md: string): string {
  let html = md

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>')

  // Unordered lists
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)

  // Ordered lists
  html = html.replace(/^\d+\.\s(.+)$/gm, '<li>$1</li>')

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Paragraphs — wrap loose text lines
  html = html
    .split('\n\n')
    .map(block => {
      block = block.trim()
      if (!block) return ''
      if (block.startsWith('<h') || block.startsWith('<ul') || block.startsWith('<ol') || block.startsWith('<blockquote') || block.startsWith('<img')) {
        return block
      }
      return `<p>${block.replace(/\n/g, '<br>')}</p>`
    })
    .join('\n')

  return html
}

function countWords(text: string): number {
  return text.replace(/[#*_`>\[\]()!-]/g, '').split(/\s+/).filter(Boolean).length
}

function readingTime(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 200))
}

function generateHtml(data: PreviewData): string {
  const wordCount = countWords(data.body)
  const readMin = readingTime(wordCount)
  const bodyHtml = markdownToHtml(data.body)
  const today = new Date().toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' })

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vorschau: ${data.title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #ffffff;
      --bg-secondary: #f9fafb;
      --text: #111827;
      --text-secondary: #6b7280;
      --border: #e5e7eb;
      --primary-500: #05DE66;
      --primary-600: #04C95C;
      --secondary-500: #01ABE7;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Roboto', system-ui, sans-serif;
      background: var(--bg-secondary);
      color: var(--text);
      line-height: 1.7;
      padding: 2rem;
    }
    .preview-banner {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      background: linear-gradient(135deg, #05DE66, #01ABE7);
      color: white; text-align: center;
      padding: 0.5rem 1rem;
      font-family: 'Poppins', sans-serif;
      font-size: 0.875rem; font-weight: 700;
      display: flex; justify-content: center; gap: 2rem; align-items: center;
    }
    .preview-banner .stat {
      background: rgba(255,255,255,0.2);
      padding: 0.15rem 0.75rem; border-radius: 9999px;
      font-weight: 500;
    }
    .card {
      max-width: 780px; margin: 3rem auto 2rem;
      background: rgba(255,255,255,0.95);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.4);
      border-radius: 1rem;
      padding: 2rem 2.5rem;
      box-shadow: 0 4px 24px rgba(0,0,0,0.06);
    }
    .hero-img {
      width: 100%; aspect-ratio: 16/9; object-fit: cover;
      border-radius: 0.75rem; margin-bottom: 1.5rem;
    }
    .meta {
      display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
      margin-bottom: 0.25rem;
      font-size: 0.875rem; color: var(--text-secondary);
    }
    .meta .date { color: var(--primary-500); font-weight: 500; }
    h1 {
      font-family: 'Poppins', sans-serif;
      font-size: 2rem; font-weight: 700;
      letter-spacing: -0.025em;
      line-height: 1.2; margin-bottom: 1rem;
    }
    .summary {
      background: var(--bg-secondary);
      border: 1px solid rgba(5, 222, 102, 0.2);
      border-radius: 0.75rem; padding: 1rem 1.25rem;
      margin-bottom: 2rem;
      font-size: 0.95rem; color: var(--text-secondary);
      line-height: 1.6;
    }
    .summary-label {
      font-size: 0.7rem; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--primary-500); margin-bottom: 0.35rem;
    }

    /* Prose */
    .prose { font-size: 1.1rem; }
    .prose h2 {
      font-family: 'Poppins', sans-serif;
      font-size: 1.5rem; font-weight: 700;
      letter-spacing: -0.025em;
      margin: 2rem 0 0.75rem;
    }
    .prose h3 {
      font-family: 'Poppins', sans-serif;
      font-size: 1.25rem; font-weight: 600;
      margin: 1.5rem 0 0.5rem;
    }
    .prose p { margin-bottom: 1.25rem; }
    .prose strong { font-weight: 700; }
    .prose a {
      color: var(--primary-500); text-decoration: underline;
      text-underline-offset: 2px;
    }
    .prose a:hover { color: var(--primary-600); }
    .prose ul, .prose ol {
      margin: 1rem 0 1.25rem 1.5rem;
    }
    .prose li { margin-bottom: 0.35rem; }
    .prose blockquote {
      border-left: 3px solid var(--primary-500);
      background: var(--bg-secondary);
      padding: 0.75rem 1.25rem;
      border-radius: 0 0.5rem 0.5rem 0;
      margin: 1.25rem 0;
      font-style: normal;
    }
    .prose img {
      max-width: 500px; margin: 1.5rem auto; display: block;
      padding: 10px; background: rgba(255,255,255,0.93);
      border-radius: 6px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06);
      transform: rotate(-1.5deg);
    }
    .prose code {
      color: var(--secondary-500);
      background: var(--bg-secondary);
      padding: 0.15rem 0.4rem; border-radius: 0.25rem;
      font-size: 0.9em;
    }

    /* Tags */
    .tags {
      display: flex; flex-wrap: wrap; gap: 0.5rem;
      margin-top: 2rem; padding-top: 1.5rem;
      border-top: 1px solid var(--border);
    }
    .tag {
      background: rgba(5, 222, 102, 0.1);
      color: var(--primary-600);
      padding: 0.25rem 0.75rem; border-radius: 9999px;
      font-size: 0.8rem; font-weight: 500;
    }

    @media (max-width: 640px) {
      body { padding: 1rem; }
      .card { padding: 1.25rem; }
      h1 { font-size: 1.5rem; }
      .prose { font-size: 1rem; }
    }
  </style>
</head>
<body>
  <div class="preview-banner">
    <span>ENTWURF — VORSCHAU</span>
    <span class="stat">${wordCount} Wörter</span>
    <span class="stat">~${readMin} Min. Lesezeit</span>
    <span class="stat">${data.summary.length} Zeichen Summary</span>
  </div>

  <div class="card">
    ${data.imageUrl && !data.imageUrl.includes('prompt') ? `<img class="hero-img" src="${data.imageUrl}" alt="${data.title}">` : ''}
    <div class="meta">
      <span class="date">${today}</span>
      <span>·</span>
      <span>${readMin} Min. Lesezeit</span>
    </div>
    <h1>${data.title}</h1>

    ${data.summary ? `
    <div class="summary">
      <div class="summary-label">Zusammenfassung</div>
      ${data.summary}
    </div>` : ''}

    <div class="prose">
      ${bodyHtml}
    </div>

    ${data.tags.length ? `
    <div class="tags">
      ${data.tags.map(t => `<span class="tag">${t}</span>`).join('')}
    </div>` : ''}
  </div>
</body>
</html>`
}

/**
 * Generate preview HTML and open in browser.
 * Returns the file path.
 */
export function openPreview(data: PreviewData): string {
  const html = generateHtml(data)
  const filePath = resolve(tmpdir(), `kokomo-preview-${Date.now()}.html`)
  writeFileSync(filePath, html, 'utf-8')

  // Open in default browser
  try {
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
    execSync(`${cmd} "${filePath}"`, { stdio: 'ignore' })
  } catch {
    // Silently fail — user can open manually
  }

  return filePath
}

/**
 * Generate preview from raw agent output text.
 * Tries to parse the draft, opens preview, returns word count info.
 */
export function previewFromAgentOutput(text: string): { filePath: string; wordCount: number; readingMinutes: number } | null {
  const data = parseDraftFromMarkdown(text)
  if (!data) return null

  const wordCount = countWords(data.body)
  const filePath = openPreview(data)

  return {
    filePath,
    wordCount,
    readingMinutes: readingTime(wordCount),
  }
}
