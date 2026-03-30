import { useState, useEffect, type FormEvent } from 'react'

interface LastSend {
  post_title: string
  sent_at: string
  recipient_count: number
  opened_count: number
  clicked_count: number
}

interface TopPost {
  label: string
  url: string
  nb_visits: number
  prev_nb_visits: number
}

interface TopPostAllTime {
  label: string
  url: string
  nb_visits: number
}

interface SearchQuery {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

interface DashboardData {
  total_confirmed: number
  new_last_7_days: number
  change: number
  pending_comments: number
  last_send: LastSend | null
  visitors: Record<string, number> | null
  top_posts: TopPost[] | null
  top_posts_all_time: TopPostAllTime[] | null
  search_queries: SearchQuery[] | null
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Dez',
}

function VisitorChart({ visitors }: { visitors: Record<string, number> }) {
  const entries = Object.entries(visitors)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, v]) => v > 0)
  const max = Math.max(...entries.map(([, v]) => v), 1)

  if (entries.length === 0) return null

  // Calculate nice grid line steps
  const steps = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
  const step = steps.find(s => max / s <= 5) || 10000
  const gridLines: number[] = []
  for (let v = step; v <= max; v += step) gridLines.push(v)

  const chartHeight = 160

  return (
    <div className="glass-card rounded-2xl p-6 shadow-lg">
      <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
        Besucher pro Monat
      </h3>
      <div style={{ position: 'relative', height: chartHeight, paddingLeft: 36, marginTop: 20 }}>
        {/* Grid lines */}
        {gridLines.map(v => (
          <div
            key={v}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: `${(v / max) * ((chartHeight - 20) / chartHeight) * 100}%`,
            }}
          >
            <span
              className="text-[var(--text-secondary)]"
              style={{
                position: 'absolute',
                left: 0,
                top: -6,
                fontSize: 10,
                opacity: 0.5,
                lineHeight: 1,
              }}
            >
              {v}
            </span>
            <div
              style={{
                marginLeft: 36,
                borderTop: '1px dashed',
                opacity: 0.2,
              }}
              className="text-[var(--text-secondary)]"
            />
          </div>
        ))}
        {/* Bars */}
        <div className="flex items-end gap-2 sm:gap-3" style={{ position: 'relative', zIndex: 1, height: '100%', marginLeft: 0 }}>
          {entries.map(([key, value]) => {
            const [year, month] = key.split('-')
            const label = `${MONTH_LABELS[month] || month} ${year.slice(2)}`
            const barHeight = Math.max(Math.round((value / max) * (chartHeight - 20)), 4)

            return (
              <div key={key} className="flex flex-col items-center gap-1" style={{ flex: '1 1 0', minWidth: 36, maxWidth: 72, alignSelf: 'flex-end' }}>
                <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                  {value.toLocaleString('de-CH')}
                </span>
                <div
                  className="w-full rounded-t bg-primary-500/80 dark:bg-primary-400/80"
                  style={{ height: barHeight }}
                />
                <span className="text-[10px] text-[var(--text-secondary)]">{label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TopPosts({ posts }: { posts: TopPost[] }) {
  return (
    <div className="glass-card rounded-2xl p-6 shadow-lg">
      <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
        Top Posts (letzte 7 Tage)
      </h3>
      <div className="space-y-3">
        {posts.map((post, i) => {
          const diff = post.nb_visits - post.prev_nb_visits
          const diffColor =
            diff > 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : diff < 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-[var(--text-secondary)]'
          const diffLabel =
            diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '±0'

          return (
            <div key={post.url} className="flex items-center gap-3">
              <span className="w-5 text-right text-xs font-bold text-[var(--text-secondary)]">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm font-medium text-[var(--text)] hover:text-primary-500 dark:hover:text-primary-400"
                >
                  {post.label}
                </a>
              </div>
              <div className="flex items-baseline gap-2 text-right">
                <span className="text-sm font-bold text-[var(--text)]">{post.nb_visits}</span>
                <span className={`text-[10px] font-medium ${diffColor}`}>{diffLabel}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TopPostsAllTime({ posts }: { posts: TopPostAllTime[] }) {
  return (
    <div className="glass-card rounded-2xl p-6 shadow-lg">
      <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
        Top Posts aller Zeiten
      </h3>
      <div className="space-y-3">
        {posts.map((post, i) => (
          <div key={post.url} className="flex items-center gap-3">
            <span className="w-5 text-right text-xs font-bold text-[var(--text-secondary)]">{i + 1}.</span>
            <div className="min-w-0 flex-1">
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-sm font-medium text-[var(--text)] hover:text-primary-500 dark:hover:text-primary-400"
              >
                {post.label}
              </a>
            </div>
            <span className="text-sm font-bold text-[var(--text)]">{post.nb_visits.toLocaleString('de-CH')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SearchConsoleQueries({ queries }: { queries: SearchQuery[] }) {
  return (
    <div className="glass-card rounded-2xl p-6 shadow-lg">
      <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
        Top Suchbegriffe (28 Tage)
      </h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
            <th className="pb-2 text-left font-medium" />
            <th className="pb-2 text-left font-medium">Suchbegriff</th>
            <th className="pb-2 text-right font-medium">Klicks</th>
            <th className="pb-2 text-right font-medium">Impr.</th>
            <th className="pb-2 text-right font-medium">CTR</th>
            <th className="pb-2 text-right font-medium">Position</th>
          </tr>
        </thead>
        <tbody>
          {queries.map((q, i) => (
            <tr key={q.query} className="border-t border-[var(--text-secondary)]/10">
              <td className="py-1.5 pr-2 text-right text-xs font-bold text-[var(--text-secondary)]">{i + 1}.</td>
              <td className="py-1.5 pr-4 font-medium text-[var(--text)]">{q.query}</td>
              <td className="py-1.5 text-right font-bold text-[var(--text)]">{q.clicks}</td>
              <td className="py-1.5 text-right text-[var(--text-secondary)]">{q.impressions.toLocaleString('de-CH')}</td>
              <td className="py-1.5 text-right text-[var(--text-secondary)]">{q.ctr}%</td>
              <td className="py-1.5 text-right text-[var(--text-secondary)]">{q.position}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
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
            {loading ? 'Wird angemeldet...' : 'Anmelden'}
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

export default function AdminDashboard() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  async function loadDashboard() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/dashboard')
      if (res.status === 401) {
        setLoggedIn(false)
        return
      }
      const json = await res.json()
      setData(json)
      setLoggedIn(true)
    } catch {
      // ignore
    } finally {
      setLoading(false)
      setCheckingAuth(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  if (checkingAuth) {
    return (
      <div className="py-12 text-center text-sm text-[var(--text-secondary)]">Wird geladen...</div>
    )
  }

  if (!loggedIn) {
    return <LoginForm onLogin={loadDashboard} />
  }

  if (loading || !data) {
    return (
      <div className="py-12 text-center text-sm text-[var(--text-secondary)]">Daten werden geladen...</div>
    )
  }

  const changeColor =
    data.change > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : data.change < 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-[var(--text-secondary)]'

  const changeLabel =
    data.change > 0
      ? `+${data.change} vs. Vorperiode`
      : data.change < 0
        ? `${data.change} vs. Vorperiode`
        : 'Gleich wie Vorperiode'

  const openRate = data.last_send && data.last_send.recipient_count > 0
    ? Math.round((data.last_send.opened_count / data.last_send.recipient_count) * 100)
    : 0
  const clickRate = data.last_send && data.last_send.recipient_count > 0
    ? Math.round((data.last_send.clicked_count / data.last_send.recipient_count) * 100)
    : 0

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {/* Offene Kommentare */}
      <div className="glass-card rounded-2xl p-6 shadow-lg">
        <h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
          Offene Kommentare
        </h3>
        <p className="text-4xl font-bold text-[var(--text)]">{data.pending_comments}</p>
        {data.pending_comments > 0 ? (
          <a
            href="/admin/comments"
            className="mt-2 inline-block text-sm font-medium text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300"
          >
            Kommentare prüfen &rarr;
          </a>
        ) : (
          <p className="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            Alle erledigt
          </p>
        )}
      </div>

      {/* Newsletter-Abonnenten */}
      <div className="glass-card rounded-2xl p-6 shadow-lg">
        <h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
          Newsletter-Abonnenten
        </h3>
        <p className="text-4xl font-bold text-[var(--text)]">{data.total_confirmed}</p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          +{data.new_last_7_days} in den letzten 7 Tagen
        </p>
        <p className={`mt-1 text-xs font-medium ${changeColor}`}>{changeLabel}</p>
      </div>

      {/* Letzter Newsletter */}
      {data.last_send && (
        <div className="glass-card rounded-2xl p-6 shadow-lg">
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
            Letzter Newsletter
          </h3>
          <p className="line-clamp-1 text-sm font-semibold text-[var(--text)]">
            {data.last_send.post_title}
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {new Date(data.last_send.sent_at).toLocaleDateString('de-CH')} &middot; {data.last_send.recipient_count} Empfänger
          </p>
          <div className="mt-3 flex gap-4">
            <div>
              <p className="text-lg font-bold text-[var(--text)]">{openRate}%</p>
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Open-Rate</p>
            </div>
            <div>
              <p className="text-lg font-bold text-[var(--text)]">{clickRate}%</p>
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Click-Rate</p>
            </div>
          </div>
        </div>
      )}

      {/* Besucher-Diagramm */}
      {data.visitors && (
        <div className="sm:col-span-2 lg:col-span-3">
          <VisitorChart visitors={data.visitors} />
        </div>
      )}

      {/* Top Posts & Suchbegriffe */}
      {(data.top_posts || data.top_posts_all_time || data.search_queries) && (
        <div className="grid gap-6 sm:col-span-2 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-2">
          {data.top_posts && <TopPosts posts={data.top_posts} />}
          {data.top_posts_all_time && <TopPostsAllTime posts={data.top_posts_all_time} />}
          {data.search_queries && <SearchConsoleQueries queries={data.search_queries} />}
        </div>
      )}
    </div>
  )
}
