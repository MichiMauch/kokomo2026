import { useState, useEffect, useRef, type FormEvent } from 'react'

interface Comment {
  id: number
  post_slug: string
  parent_id: number | null
  author_name: string
  content: string
  created_at: string
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-primary-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-violet-500',
    'bg-cyan-500',
    'bg-orange-500',
    'bg-teal-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('de-CH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function SingleComment({
  comment,
  replies,
  onReply,
}: {
  comment: Comment
  replies: Comment[]
  onReply: (id: number, name: string) => void
}) {
  return (
    <div>
      <div className="flex gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${getAvatarColor(comment.author_name)}`}
        >
          {getInitials(comment.author_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-[var(--text)]">{comment.author_name}</span>
            <span className="text-xs text-[var(--text-secondary)]">
              {formatDate(comment.created_at)}
            </span>
          </div>
          <div className="mt-1 text-sm leading-relaxed text-[var(--text)]">{comment.content}</div>
          <button
            onClick={() => onReply(comment.id, comment.author_name)}
            className="mt-2 text-xs font-medium text-primary-500 transition-colors hover:text-primary-600"
          >
            Antworten
          </button>
        </div>
      </div>

      {replies.length > 0 && (
        <div className="ml-13 mt-3 space-y-3 border-l-2 border-[var(--border)]/30 pl-4">
          {replies.map((reply) => (
            <div key={reply.id} className="flex gap-3">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${getAvatarColor(reply.author_name)}`}
              >
                {getInitials(reply.author_name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-[var(--text)]">
                    {reply.author_name}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {formatDate(reply.created_at)}
                  </span>
                </div>
                <div className="mt-1 text-sm leading-relaxed text-[var(--text)]">
                  {reply.content}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CommentSection({ slug }: { slug: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [replyTo, setReplyTo] = useState<{ id: number; name: string } | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [content, setContent] = useState('')
  const [formStatus, setFormStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  function fetchComments() {
    return fetch(`/api/comments/${slug}`)
      .then((res) => res.json())
      .then((data) => setComments(data.comments || []))
      .catch(() => {})
  }

  useEffect(() => {
    fetchComments().finally(() => setLoading(false))
  }, [slug])

  const topLevel = comments.filter((c) => c.parent_id === null)
  const repliesMap = new Map<number, Comment[]>()
  for (const c of comments) {
    if (c.parent_id !== null) {
      const arr = repliesMap.get(c.parent_id) || []
      arr.push(c)
      repliesMap.set(c.parent_id, arr)
    }
  }

  function handleReply(id: number, authorName: string) {
    setReplyTo({ id, name: authorName })
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function cancelReply() {
    setReplyTo(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !content.trim()) return

    setFormStatus('loading')
    setMessage('')

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_slug: slug,
          parent_id: replyTo?.id ?? null,
          author_name: name.trim(),
          author_email: email.trim(),
          content: content.trim(),
          website,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setFormStatus('success')
        setMessage(data.message)
        setContent('')
        setReplyTo(null)
        if (data.autoApproved) {
          await fetchComments()
        }
      } else {
        setFormStatus('error')
        setMessage(data.error || 'Kommentar konnte nicht gesendet werden.')
      }
    } catch {
      setFormStatus('error')
      setMessage('Verbindung fehlgeschlagen. Bitte versuche es später erneut.')
    }
  }

  return (
    <div className="mt-12 border-t border-[var(--border)]/30 pt-8">
      <h3 className="mb-6 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
        Kommentare {!loading && topLevel.length > 0 && `(${comments.length})`}
      </h3>

      {/* Comment list */}
      {loading ? (
        <div className="py-8 text-center text-sm text-[var(--text-secondary)]">
          Kommentare werden geladen…
        </div>
      ) : topLevel.length === 0 ? (
        <div className="py-8 text-center text-sm text-[var(--text-secondary)]">
          Noch keine Kommentare. Sei der Erste!
        </div>
      ) : (
        <div className="space-y-6">
          {topLevel.map((comment) => (
            <SingleComment
              key={comment.id}
              comment={comment}
              replies={repliesMap.get(comment.id) || []}
              onReply={handleReply}
            />
          ))}
        </div>
      )}

      {/* Comment form */}
      <form ref={formRef} onSubmit={handleSubmit} className="mt-8 space-y-4">
        {replyTo && (
          <div className="flex items-center gap-2 rounded-xl border border-primary-200/50 bg-primary-50/60 px-4 py-2 text-sm text-primary-700 dark:border-primary-800/50 dark:bg-primary-900/20 dark:text-primary-300">
            <span>
              Antwort an <strong>{replyTo.name}</strong>
            </span>
            <button
              type="button"
              onClick={cancelReply}
              className="ml-auto text-xs font-medium text-primary-500 hover:text-primary-600"
            >
              Abbrechen
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dein Name"
            required
            minLength={2}
            disabled={formStatus === 'loading'}
            className="flex-1 rounded-full border border-slate-300 bg-white/70 px-5 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 disabled:opacity-50 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:placeholder-slate-500 dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Deine E-Mail (wird nicht veröffentlicht)"
            required
            disabled={formStatus === 'loading'}
            className="flex-1 rounded-full border border-slate-300 bg-white/70 px-5 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 disabled:opacity-50 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:placeholder-slate-500 dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
          />
        </div>

        {/* Honeypot field - hidden from users */}
        <div className="absolute -left-[9999px]" aria-hidden="true">
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Dein Kommentar…"
          required
          minLength={3}
          maxLength={5000}
          rows={4}
          disabled={formStatus === 'loading'}
          className="w-full rounded-xl border border-slate-300 bg-white/70 px-5 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 disabled:opacity-50 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:placeholder-slate-500 dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
        />

        <button
          type="submit"
          disabled={formStatus === 'loading'}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-500 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-600 hover:shadow-md disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-500"
        >
          {formStatus === 'loading' ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Wird gesendet…
            </>
          ) : (
            'Kommentar absenden'
          )}
        </button>
      </form>

      {formStatus === 'success' && (
        <div className="mt-4 rounded-xl border border-green-200/50 bg-green-50/60 px-4 py-3 text-sm text-green-700 dark:border-green-800/50 dark:bg-green-900/20 dark:text-green-300">
          {message}
        </div>
      )}

      {formStatus === 'error' && (
        <div className="mt-4 rounded-xl border border-red-200/50 bg-red-50/60 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
          {message}
        </div>
      )}
    </div>
  )
}
