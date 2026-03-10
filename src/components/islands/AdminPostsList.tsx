import { useState, useEffect, useMemo, type FormEvent } from 'react'

interface PostInfo {
  slug: string
  title: string
  date: string
  imageUrl: string | null
  draft: boolean
  tags: string[]
}

type Phase = 'checking' | 'login' | 'ready'

type Platform = 'facebook_page' | 'twitter' | 'telegram' | 'whatsapp'

const PLATFORMS: { key: Platform; label: string; color: string }[] = [
  { key: 'facebook_page', label: 'Facebook', color: '#1877F2' },
  { key: 'twitter', label: 'X / Twitter', color: '#000000' },
  { key: 'telegram', label: 'Telegram', color: '#26A5E4' },
  { key: 'whatsapp', label: 'WhatsApp', color: '#25D366' },
]

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
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-primary-500 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-600 hover:shadow-md disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-500"
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

// ─── Post Card ──────────────────────────────────────────────

function PostCard({
  post,
  hasTexts,
  shareStatus,
  onDeleted,
}: {
  post: PostInfo
  hasTexts: boolean
  shareStatus: Record<string, string>
  onDeleted: (slug: string) => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Post "${post.title}" unwiderruflich löschen?`)) return
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/posts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: post.slug }),
      })
      if (res.status === 401) { window.location.reload(); return }
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Löschen fehlgeschlagen')
      }
      onDeleted(post.slug)
    } catch (err: any) {
      alert(err.message || 'Löschen fehlgeschlagen')
      setDeleting(false)
    }
  }

  return (
    <div className="glass-card rounded-2xl shadow-sm">
      <div className="flex items-center gap-4 p-5">
        {/* Thumbnail */}
        <div className="h-20 w-32 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
          {post.imageUrl ? (
            <img src={post.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">Kein Bild</div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-[var(--text)]">{post.title}</h3>
            {post.draft && (
              <span className="flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Draft
              </span>
            )}
          </div>
          <p className="mb-1 text-xs text-[var(--text-secondary)]">{post.slug}</p>
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {post.tags.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-700/50 dark:text-slate-400"
                >
                  {tag}
                </span>
              ))}
              {post.tags.length > 5 && (
                <span className="text-[10px] text-slate-400">+{post.tags.length - 5}</span>
              )}
            </div>
          )}
        </div>

        {/* Social status dots */}
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {PLATFORMS.map((p) => (
            <div
              key={p.key}
              title={`${p.label}: ${shareStatus[p.key] ? 'geteilt' : hasTexts ? 'Text vorhanden' : 'kein Text'}`}
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: shareStatus[p.key] ? '#10B981' : hasTexts ? '#F59E0B' : '#D1D5DB' }}
            />
          ))}
        </div>

        <div className="flex flex-shrink-0 items-center gap-1.5">
          <a
            href={`/admin/posts/${post.slug}`}
            className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mr-1 inline h-3.5 w-3.5">
              <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
            </svg>
            Bearbeiten
          </a>
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Post löschen"
            className="rounded-full border border-red-200 p-1.5 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:border-red-800/50 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────

export default function AdminPostsList() {
  const [phase, setPhase] = useState<Phase>('checking')
  const [posts, setPosts] = useState<PostInfo[]>([])
  const [slugsWithTexts, setSlugsWithTexts] = useState<Set<string>>(new Set())
  const [shareOverview, setShareOverview] = useState<Record<string, Record<string, string>>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/admin/comments')
      .then((res) => {
        if (res.status === 401) {
          setPhase('login')
        } else {
          setPhase('ready')
          loadData()
        }
      })
      .catch(() => setPhase('login'))
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [postsRes, socialRes] = await Promise.all([
        fetch('/api/admin/images'),
        fetch('/api/admin/social'),
      ])

      if (postsRes.status === 401) { setPhase('login'); return }
      if (!postsRes.ok) throw new Error('Posts konnten nicht geladen werden')

      const postsData = await postsRes.json()
      setPosts(postsData.posts || [])

      if (socialRes.ok) {
        const socialData = await socialRes.json()
        setSlugsWithTexts(new Set(socialData.slugsWithTexts || []))
        setShareOverview(socialData.shareOverview || {})
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleLogin() {
    setPhase('ready')
    loadData()
  }

  function handlePostDeleted(slug: string) {
    setPosts((prev) => prev.filter((p) => p.slug !== slug))
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return posts
    const q = search.toLowerCase()
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    )
  }, [posts, search])

  if (phase === 'checking') {
    return <div className="py-12 text-center text-sm text-[var(--text-secondary)]">Wird geladen…</div>
  }

  if (phase === 'login') {
    return <LoginForm onLogin={handleLogin} />
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200/50 bg-red-50/60 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">schliessen</button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Posts durchsuchen…"
          className="flex-1 rounded-full border border-slate-300 bg-white/70 px-5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:placeholder-slate-500 dark:focus:border-primary-500 dark:focus:ring-primary-500/30"
        />
        <span className="text-xs text-[var(--text-secondary)]">{filtered.length} Posts</span>
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-500" />
          <div className="mt-3 text-sm text-[var(--text-secondary)]">Posts werden geladen…</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((post) => (
            <PostCard
              key={post.slug}
              post={post}
              hasTexts={slugsWithTexts.has(post.slug)}
              shareStatus={shareOverview[post.slug] ?? {}}
              onDeleted={handlePostDeleted}
            />
          ))}
          {filtered.length === 0 && !loading && (
            <div className="py-8 text-center text-sm text-[var(--text-secondary)]">Keine Posts gefunden.</div>
          )}
        </div>
      )}
    </div>
  )
}
