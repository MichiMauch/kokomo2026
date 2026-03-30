import React, { useState, useEffect, useRef, type FormEvent } from 'react'

// ─── Types ───────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface ToolEvent {
  name: string
  input?: any
  success?: boolean
  error?: string
}

type Phase = 'checking' | 'login' | 'chat'

// ─── Login Form ──────────────────────────────────────────────

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (res.ok) {
        onLogin()
      } else {
        const data = await res.json()
        setError(data.error || 'Login fehlgeschlagen.')
      }
    } catch {
      setError('Verbindung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="glass-card rounded-2xl p-8 shadow-lg">
        <h2 className="mb-6 text-center text-xl font-semibold text-[var(--text)]">Admin Login</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-Mail"
            required
            disabled={loading}
            className="w-full rounded-full border border-slate-300 bg-white/70 px-5 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 disabled:opacity-50 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:placeholder-slate-500 dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Passwort"
            required
            disabled={loading}
            className="w-full rounded-full border border-slate-300 bg-white/70 px-5 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 disabled:opacity-50 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:placeholder-slate-500 dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
          />
          {error && <p className="text-center text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-primary-700px-6 py-3 text-sm font-medium text-white transition-all hover:bg-primary-800 disabled:opacity-50"
          >
            {loading ? 'Anmelden...' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Markdown Renderer (simple) ──────────────────────────────

function renderMarkdown(text: string): string {
  return text
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-3">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Bullet lists
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    // Paragraphs (double newline)
    .replace(/\n\n/g, '</p><p class="mb-3">')
    // Single newlines within paragraphs
    .replace(/\n/g, '<br/>')
}

// ─── Chat Message ────────────────────────────────────────────

function ChatMessage({ msg }: { msg: Message }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-br-md bg-primary-700px-4 py-3 text-sm text-white shadow-sm">
          {msg.content}
        </div>
      </div>
    )
  }

  if (msg.role === 'system') {
    return (
      <div className="flex justify-center">
        <div className="rounded-full bg-slate-100 px-4 py-1.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white/80 px-4 py-3 text-sm text-slate-800 shadow-sm dark:bg-slate-800/80 dark:text-slate-200">
        <div
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: '<p class="mb-3">' + renderMarkdown(msg.content) + '</p>' }}
        />
      </div>
    </div>
  )
}

// ─── Draft Preview ───────────────────────────────────────────

function DraftPreview({ content }: { content: string }) {
  // Try to extract structured data from the last assistant message
  const titleMatch = content.match(/\*\*Titel:\*\*\s*(.+)/i) || content.match(/^#\s+(.+)$/m)
  const summaryMatch = content.match(/\*\*Summary:\*\*\s*(.+)/i)
  const tagsMatch = content.match(/\*\*Tags:\*\*\s*(.+)/i)
  const imagePromptMatch = content.match(/\*\*Image Prompt:\*\*\s*(.+)/i)

  if (!titleMatch) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400 dark:text-slate-500">
        Die Vorschau wird angezeigt, sobald der Agent einen Draft erstellt.
      </div>
    )
  }

  return (
    <div className="space-y-4 overflow-y-auto p-4">
      <div>
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Titel</span>
        <h2 className="text-lg font-bold text-[var(--text)]">{titleMatch[1]}</h2>
      </div>
      {summaryMatch && (
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Summary</span>
          <p className="text-sm text-slate-600 dark:text-slate-300">{summaryMatch[1]}</p>
          <span className="text-xs text-slate-400">({summaryMatch[1].length} Zeichen)</span>
        </div>
      )}
      {tagsMatch && (
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Tags</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {tagsMatch[1].split(',').map((tag, i) => (
              <span key={i} className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                {tag.trim()}
              </span>
            ))}
          </div>
        </div>
      )}
      {imagePromptMatch && (
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Image Prompt</span>
          <p className="text-xs text-slate-500 italic dark:text-slate-400">{imagePromptMatch[1]}</p>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────

export default function AdminAgentChat() {
  const [phase, setPhase] = useState<Phase>('checking')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Check auth on mount
  useEffect(() => {
    fetch('/api/admin/login', { method: 'GET' })
      .then(res => {
        setPhase(res.ok ? 'chat' : 'login')
      })
      .catch(() => setPhase('login'))
  }, [])

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, toolEvents])

  // Focus input after streaming
  useEffect(() => {
    if (!isStreaming) inputRef.current?.focus()
  }, [isStreaming])

  // Build history for API (only user/assistant messages)
  function buildHistory(): Array<{ role: string; content: string }> {
    return messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }))
  }

  async function sendMessage(text: string) {
    if (!text.trim() || isStreaming) return

    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsStreaming(true)
    setToolEvents([])

    try {
      const res = await fetch('/api/admin/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: buildHistory(),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        setMessages(prev => [...prev, { role: 'system', content: `Fehler: ${err.error}` }])
        setIsStreaming(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let buffer = ''
      let assistantText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE events
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete last line

        let eventType = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7)
          } else if (line.startsWith('data: ') && eventType) {
            try {
              const data = JSON.parse(line.slice(6))

              if (eventType === 'text') {
                assistantText += data.text
                // Update the last assistant message or add a new one
                setMessages(prev => {
                  const last = prev[prev.length - 1]
                  if (last?.role === 'assistant') {
                    return [...prev.slice(0, -1), { role: 'assistant', content: assistantText }]
                  }
                  return [...prev, { role: 'assistant', content: assistantText }]
                })
              } else if (eventType === 'tool_use') {
                setToolEvents(prev => [...prev, { name: data.name, input: data.input }])
                setMessages(prev => [...prev.filter(m => !(m.role === 'system' && m.content.startsWith('⚙'))), {
                  role: 'system',
                  content: `⚙ ${data.name}...`
                }])
                // Reset assistant text for next response after tool use
                assistantText = ''
              } else if (eventType === 'tool_result') {
                // Remove the tool_use system message
                setMessages(prev => prev.filter(m => !(m.role === 'system' && m.content.startsWith('⚙'))))
              } else if (eventType === 'error') {
                setMessages(prev => [...prev, { role: 'system', content: `Fehler: ${data.message}` }])
              }
            } catch { /* skip malformed JSON */ }
            eventType = ''
          }
        }
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'system', content: `Verbindungsfehler: ${err.message}` }])
    } finally {
      setIsStreaming(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  function handleQuickAction(action: string) {
    sendMessage(action)
  }

  // Get latest draft for preview
  const lastDraft = messages.filter(m => m.role === 'assistant').pop()?.content || ''

  if (phase === 'checking') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    )
  }

  if (phase === 'login') {
    return <LoginForm onLogin={() => setPhase('chat')} />
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      {/* Chat Panel (Left) */}
      <div className="flex w-3/5 flex-col">
        <div className="glass-card flex-1 overflow-hidden rounded-2xl shadow-lg">
          {/* Messages */}
          <div className="flex h-full flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <p className="mb-2 text-lg font-semibold text-[var(--text)]">Blog-Agent</p>
                  <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
                    Gib ein Thema oder Stichworte ein, und der Agent erstellt einen Blogpost.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {[
                      'Erfahrungen mit dem Kompostklo',
                      'Photovoltaik im Winter',
                      'Minimalismus-Tipps',
                    ].map(topic => (
                      <button
                        key={topic}
                        onClick={() => sendMessage(`Schreibe einen Blogpost zum Thema: ${topic}\n\nStarte mit Phase 1 (Outline). Lies zuerst die Style-Config und die letzten Posts.`)}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <ChatMessage key={i} msg={msg} />
              ))}

              {isStreaming && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-white/60 px-4 py-3 dark:bg-slate-800/60">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-400" style={{ animationDelay: '0ms' }} />
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-400" style={{ animationDelay: '150ms' }} />
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-400" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-slate-200/50 p-3 dark:border-slate-700/50">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={messages.length === 0 ? 'Thema oder Stichworte eingeben...' : 'Feedback oder Anweisungen...'}
                  disabled={isStreaming}
                  className="flex-1 rounded-full border border-slate-300 bg-white/70 px-5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 disabled:opacity-50 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:placeholder-slate-500"
                />
                <button
                  type="submit"
                  disabled={isStreaming || !input.trim()}
                  className="rounded-full bg-primary-700px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary-800 disabled:opacity-50"
                >
                  Senden
                </button>
              </form>

              {/* Quick Actions */}
              {messages.length > 0 && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => handleQuickAction('Die Outline ist gut. Schreibe jetzt den kompletten Post (Phase 2).')}
                    disabled={isStreaming}
                    className="rounded-full border border-green-300 px-3 py-1 text-xs text-green-600 transition-colors hover:bg-green-50 disabled:opacity-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20"
                  >
                    Outline freigeben
                  </button>
                  <button
                    onClick={() => handleQuickAction('Der Post ist gut. Bitte jetzt publizieren: Generiere das Titelbild und erstelle die Post-Datei.')}
                    disabled={isStreaming}
                    className="rounded-full border border-blue-300 px-3 py-1 text-xs text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20"
                  >
                    Publizieren
                  </button>
                  <button
                    onClick={() => setMessages([])}
                    disabled={isStreaming}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    Neuer Chat
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Preview Panel (Right) */}
      <div className="w-2/5">
        <div className="glass-card h-full overflow-hidden rounded-2xl shadow-lg">
          <div className="border-b border-slate-200/50 px-4 py-3 dark:border-slate-700/50">
            <h3 className="text-sm font-semibold text-[var(--text)]">Draft-Vorschau</h3>
          </div>
          <DraftPreview content={lastDraft} />
        </div>
      </div>
    </div>
  )
}
