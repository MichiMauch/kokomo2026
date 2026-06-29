import { useState, useEffect, useMemo, type FormEvent } from 'react'

interface PlanIdea {
  id: string
  title: string
  stage: 'backlog' | 'eingeplant' | 'in_arbeit'
  geplant?: string
  score?: string
  typ?: string
  quelleUrl?: string
  ausbauVon?: string
}
interface PublishedPost {
  slug: string
  title: string
  date: string
}
interface Cadence {
  lastPublished?: string
  daysSinceLast?: number
  postsThisMonth: number
  nextPlanned?: string
  daysToNext?: number
  warn: boolean
  message: string
}
interface Plan {
  eingeplant: PlanIdea[]
  backlog: PlanIdea[]
  inArbeit: PlanIdea[]
  published: PublishedPost[]
  cadence: Cadence
  today: string
}

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.`
}
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`
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
      if (res.ok) onLogin()
      else setError((await res.json()).error || 'Login fehlgeschlagen.')
    } catch {
      setError('Verbindung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full rounded-full border border-slate-300 bg-white/70 px-5 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 disabled:opacity-50 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-white dark:placeholder-slate-500'

  return (
    <div className="mx-auto max-w-md">
      <div className="glass-card rounded-2xl p-8 shadow-lg">
        <h2 className="mb-6 text-center text-xl font-semibold text-[var(--text)]">Admin Login</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail" required disabled={loading} className={inputCls} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Passwort" required disabled={loading} className={inputCls} />
          <button type="submit" disabled={loading} className="w-full cursor-pointer rounded-full bg-primary-700 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-800 disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-500">
            {loading ? 'Wird angemeldet…' : 'Anmelden'}
          </button>
        </form>
        {error && <div className="mt-4 rounded-xl border border-red-200/50 bg-red-50/60 px-4 py-3 text-center text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">{error}</div>}
      </div>
    </div>
  )
}

function ScoreBadge({ score }: { score?: string }) {
  if (!score) return null
  const color =
    score === 'A'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
      : score === 'B'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300'
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${color}`}>{score}</span>
}

function IdeaRow({ idea }: { idea: PlanIdea }) {
  return (
    <div className="rounded-lg border border-slate-200/70 bg-white/50 px-3 py-2 text-sm dark:border-slate-700/50 dark:bg-slate-800/30">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[var(--text)]">{idea.title}</span>
        <ScoreBadge score={idea.score} />
      </div>
      {idea.typ && <div className="mt-0.5 text-xs text-[var(--text-secondary)]">{idea.typ}</div>}
    </div>
  )
}

export default function AdminRedaktionsplan() {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [needLogin, setNeedLogin] = useState(false)
  const [error, setError] = useState('')
  const [beadsError, setBeadsError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/redaktionsplan')
      if (res.status === 401) {
        setNeedLogin(true)
        return
      }
      if (!res.ok) throw new Error('Laden fehlgeschlagen')
      const data = await res.json()
      setPlan(data.plan)
      setBeadsError(data.beadsError || '')
      setNeedLogin(false)
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }

  // Timeline: eingeplante Items nach Monat gruppiert
  const timeline = useMemo(() => {
    if (!plan) return []
    const groups: { month: string; items: PlanIdea[] }[] = []
    for (const i of plan.eingeplant) {
      const ym = (i.geplant || '').slice(0, 7)
      let g = groups.find((x) => x.month === ym)
      if (!g) {
        g = { month: ym, items: [] }
        groups.push(g)
      }
      g.items.push(i)
    }
    return groups
  }, [plan])

  if (needLogin) return <LoginForm onLogin={load} />
  if (loading) return <div className="py-12 text-center text-[var(--text-secondary)]">Lädt…</div>
  if (error) return <div className="rounded-xl border border-red-200/50 bg-red-50/60 px-4 py-3 text-sm text-red-700">{error}</div>
  if (!plan) return null

  const c = plan.cadence

  return (
    <div className="space-y-8">
      {/* Rhythmus-Check */}
      <div
        className={`rounded-2xl border px-5 py-4 ${
          c.warn
            ? 'border-amber-300/60 bg-amber-50/70 dark:border-amber-700/50 dark:bg-amber-900/20'
            : 'border-emerald-300/60 bg-emerald-50/70 dark:border-emerald-700/50 dark:bg-emerald-900/20'
        }`}
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
          {c.warn ? '⚠️ Rhythmus-Lücke' : '✅ Rhythmus ok'} <span className="text-[var(--text-secondary)] font-normal">· Ziel ~2 Posts/Monat</span>
        </div>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{c.message}</p>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--text-secondary)]">
          <span>Letzter Post: {c.lastPublished ?? '—'}{c.daysSinceLast !== undefined ? ` (vor ${c.daysSinceLast} Tagen)` : ''}</span>
          <span>Diesen Monat: {c.postsThisMonth}</span>
          <span>Nächster geplant: {c.nextPlanned ?? '—'}</span>
        </div>
      </div>

      {beadsError && (
        <div className="rounded-xl border border-amber-200/50 bg-amber-50/60 px-4 py-2 text-xs text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
          Hinweis: beads-Export nicht lesbar ({beadsError}). Ideen-Spalten evtl. unvollständig.
        </div>
      )}

      {/* Timeline */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-[var(--text)]">Timeline</h2>
        {timeline.length === 0 && <p className="text-sm text-[var(--text-secondary)]">Nichts eingeplant.</p>}
        <div className="space-y-5">
          {timeline.map((g) => (
            <div key={g.month}>
              <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{monthLabel(g.month)}</div>
              <div className="space-y-2">
                {g.items.map((i) => {
                  const past = i.geplant && i.geplant < plan.today
                  return (
                    <div key={i.id} className="flex items-center gap-3 rounded-lg border border-slate-200/70 bg-white/50 px-3 py-2 dark:border-slate-700/50 dark:bg-slate-800/30">
                      <span className={`w-16 shrink-0 text-sm font-mono ${past ? 'text-red-500' : 'text-[var(--text)]'}`}>{i.geplant ? fmtDay(i.geplant) : '??'}</span>
                      <span className="flex-1 text-sm text-[var(--text)]">{i.title}</span>
                      {i.typ && <span className="hidden text-xs text-[var(--text-secondary)] sm:inline">{i.typ}</span>}
                      <ScoreBadge score={i.score} />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Board */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-[var(--text)]">Pipeline</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Column title={`Backlog (${plan.backlog.length})`}>
            {plan.backlog.map((i) => <IdeaRow key={i.id} idea={i} />)}
          </Column>
          <Column title={`Eingeplant (${plan.eingeplant.length})`}>
            {plan.eingeplant.map((i) => (
              <div key={i.id} className="rounded-lg border border-slate-200/70 bg-white/50 px-3 py-2 text-sm dark:border-slate-700/50 dark:bg-slate-800/30">
                <div className="font-mono text-xs text-[var(--text-secondary)]">{i.geplant ? fmtDay(i.geplant) : ''}</div>
                <div className="text-[var(--text)]">{i.title}</div>
              </div>
            ))}
          </Column>
          <Column title={`In Arbeit (${plan.inArbeit.length})`}>
            {plan.inArbeit.map((i) => <IdeaRow key={i.id} idea={i} />)}
            {plan.inArbeit.length === 0 && <Empty />}
          </Column>
          <Column title="Kürzlich publiziert">
            {plan.published.map((p) => (
              <a key={p.slug} href={`/tiny-house/${p.slug}/`} target="_blank" rel="noreferrer" className="block rounded-lg border border-slate-200/70 bg-white/50 px-3 py-2 text-sm hover:bg-white dark:border-slate-700/50 dark:bg-slate-800/30 dark:hover:bg-slate-800/60">
                <div className="font-mono text-xs text-[var(--text-secondary)]">{p.date}</div>
                <div className="text-[var(--text)]">{p.title}</div>
              </a>
            ))}
          </Column>
        </div>
      </section>

      <p className="text-xs text-[var(--text-secondary)]">
        Read-only — Planen/Verschieben läuft über den <code>/kokomo-redaktion</code>-Skill (beads bleibt die Quelle).
        Stand: letzter Push nach GitHub.
      </p>
    </div>
  )
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-slate-50/40 p-3 dark:border-slate-700/40 dark:bg-slate-900/20">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}
function Empty() {
  return <div className="rounded-lg border border-dashed border-slate-300/60 px-3 py-2 text-xs text-[var(--text-secondary)] dark:border-slate-600/50">—</div>
}
