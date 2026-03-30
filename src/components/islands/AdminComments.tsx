import { useState, useEffect, type FormEvent } from 'react'

interface AdminComment {
  id: number
  post_slug: string
  parent_id: number | null
  author_name: string
  author_email: string
  content: string
  approved: number
  imported_from: string | null
  created_at: string
}

interface Thread {
  parent: AdminComment
  replies: AdminComment[]
}

type Filter = 'all' | 'pending' | 'approved'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-CH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function buildThreads(comments: AdminComment[]): Thread[] {
  const byId = new Map<number, AdminComment>()
  const repliesByParent = new Map<number, AdminComment[]>()
  const topLevel: AdminComment[] = []

  for (const c of comments) {
    byId.set(c.id, c)
  }

  for (const c of comments) {
    if (c.parent_id === null) {
      topLevel.push(c)
    } else {
      const arr = repliesByParent.get(c.parent_id) || []
      arr.push(c)
      repliesByParent.set(c.parent_id, arr)
    }
  }

  // Sort top-level by created_at DESC (newest first)
  topLevel.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return topLevel.map((parent) => {
    const replies = (repliesByParent.get(parent.id) || []).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
    return { parent, replies }
  })
}

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
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-primary-700px-6 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-800 hover:shadow-md disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-500"
          >
            {loading ? 'Wird angemeldet…' : 'Anmelden'}
          </button>
        </form>
        {error && (
          <div className="mt-4 rounded-xl border border-red-200/50 bg-red-50/60 px-4 py-3 text-center text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

function ThreadCard({
  thread,
  onAction,
}: {
  thread: Thread
  onAction: (action: string, id: number, extra?: Record<string, string>) => Promise<void>
}) {
  const { parent, replies } = thread
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleAction(action: string, id: number, extra?: Record<string, string>) {
    setBusy(true)
    setError('')
    try {
      await onAction(action, id, extra)
    } catch {
      setError('Aktion fehlgeschlagen. Bitte erneut versuchen.')
    } finally {
      setBusy(false)
      setReplyOpen(false)
      setReplyContent('')
    }
  }

  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      {/* Parent comment */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-[var(--text)]">{parent.author_name}</span>
        <span className="text-xs text-[var(--text-secondary)]">{parent.author_email}</span>
        <span className="text-xs text-[var(--text-secondary)]">{formatDate(parent.created_at)}</span>
        {parent.approved ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            Freigegeben
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Ausstehend
          </span>
        )}
        {parent.imported_from && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            Import
          </span>
        )}
      </div>

      <div className="mb-1 text-xs text-[var(--text-secondary)]">
        <a
          href={`/tiny-house/${parent.post_slug}`}
          target="_blank"
          rel="noopener"
          className="text-primary-500 hover:underline"
        >
          {parent.post_slug}
        </a>
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">
        {parent.content}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {!parent.approved && (
          <button
            onClick={() => handleAction('approve', parent.id)}
            disabled={busy}
            className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
          >
            Freigeben
          </button>
        )}
        <button
          onClick={() => setReplyOpen(!replyOpen)}
          disabled={busy}
          className="rounded-full bg-primary-700px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-800 disabled:opacity-50"
        >
          Antworten
        </button>
        <button
          onClick={() => handleAction('delete', parent.id)}
          disabled={busy}
          className="rounded-full bg-red-500 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
        >
          Löschen
        </button>
      </div>

      {replyOpen && (
        <div className="mt-3 space-y-2">
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Deine Antwort…"
            rows={3}
            className="w-full rounded-xl border border-slate-300 bg-white/70 px-4 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:placeholder-slate-500 dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
          />
          <div className="flex gap-2">
            <button
              onClick={() =>
                handleAction('reply', parent.id, {
                  content: replyContent,
                  post_slug: parent.post_slug,
                })
              }
              disabled={busy || !replyContent.trim()}
              className="rounded-full bg-primary-700px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-800 disabled:opacity-50"
            >
              Absenden
            </button>
            <button
              onClick={() => {
                setReplyOpen(false)
                setReplyContent('')
              }}
              className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-xl border border-red-200/50 bg-red-50/60 px-4 py-2 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Replies */}
      {replies.length > 0 && (
        <div className="mt-4 space-y-3 border-l-2 border-primary-200 pl-4 dark:border-primary-800">
          {replies.map((reply) => (
            <div key={reply.id}>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-[var(--text)]">
                  {reply.author_name}
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  {formatDate(reply.created_at)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">
                {reply.content}
              </p>
              <button
                onClick={() => handleAction('delete', reply.id)}
                disabled={busy}
                className="mt-1 rounded-full bg-red-500 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                Löschen
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminComments() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [comments, setComments] = useState<AdminComment[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [actionError, setActionError] = useState('')

  async function loadComments() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/comments')
      if (res.status === 401) {
        setLoggedIn(false)
        return
      }
      const data = await res.json()
      setComments(data.comments || [])
      setLoggedIn(true)
    } catch {
      // ignore
    } finally {
      setLoading(false)
      setCheckingAuth(false)
    }
  }

  useEffect(() => {
    loadComments()
  }, [])

  async function handleAction(action: string, id: number, extra?: Record<string, string>) {
    setActionError('')
    const res = await fetch('/api/admin/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, id, ...extra }),
    })
    if (!res.ok) {
      const msg = await res.text().catch(() => 'Unbekannter Fehler')
      setActionError(`Fehler: ${msg}`)
      throw new Error(msg)
    }
    await loadComments()
  }

  if (checkingAuth) {
    return (
      <div className="py-12 text-center text-sm text-[var(--text-secondary)]">Wird geladen…</div>
    )
  }

  if (!loggedIn) {
    return <LoginForm onLogin={loadComments} />
  }

  const threads = buildThreads(comments)

  const filteredThreads = threads.filter((t) => {
    if (filter === 'pending') return t.parent.approved === 0
    if (filter === 'approved') return t.parent.approved === 1
    return true
  })

  const pendingCount = threads.filter((t) => t.parent.approved === 0).length

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: `Alle (${threads.length})` },
    { key: 'pending', label: `Ausstehend (${pendingCount})` },
    { key: 'approved', label: `Freigegeben (${threads.length - pendingCount})` },
  ]

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key
                ? 'bg-primary-700text-white'
                : 'border border-slate-300 text-[var(--text-secondary)] hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={loadComments}
          disabled={loading}
          className="ml-auto rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          {loading ? 'Lädt…' : 'Aktualisieren'}
        </button>
      </div>

      {actionError && (
        <div className="mb-4 rounded-xl border border-red-200/50 bg-red-50/60 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
          {actionError}
        </div>
      )}

      {filteredThreads.length === 0 ? (
        <div className="py-12 text-center text-sm text-[var(--text-secondary)]">
          Keine Kommentare gefunden.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredThreads.map((thread) => (
            <ThreadCard key={thread.parent.id} thread={thread} onAction={handleAction} />
          ))}
        </div>
      )}
    </div>
  )
}
