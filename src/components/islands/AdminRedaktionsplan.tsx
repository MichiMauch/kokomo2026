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
interface DraftPost {
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
  drafts: DraftPost[]
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

/** Baut den Befehl, den man in Claude Code einfügt, um kokomo-creator für diese Idee zu starten. */
function buildAgentCommand(idea: PlanIdea): string {
  return `/kokomo-creator Schreibe den Blogpost aus bd-Idee ${idea.id} „${idea.title}“. Claime das Issue (bd update ${idea.id} --claim) und starte mit Phase 1 (Outline).`
}

/** Baut den Befehl, der in Claude Code den Draft-Post live schaltet. */
function buildPublishCommand(slug: string): string {
  return `/kokomo-publish ${slug}`
}

/** Icon-Button, der den Publish-Command für einen Draft in die Zwischenablage legt. */
function CopyPublishButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      title="Publish-Command kopieren → in Claude Code einfügen, schaltet den Post live"
      onClick={async (e) => {
        e.preventDefault()
        e.stopPropagation()
        try {
          await navigator.clipboard.writeText(buildPublishCommand(slug))
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          window.prompt('Command kopieren:', buildPublishCommand(slug))
        }
      }}
      className="shrink-0 cursor-pointer rounded-md p-1 text-amber-700 transition-colors hover:bg-amber-200/60 dark:text-amber-300 dark:hover:bg-amber-800/40"
      aria-label="Publish-Command kopieren"
    >
      {copied ? (
        <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
      )}
    </button>
  )
}

function CopyButton({ idea }: { idea: PlanIdea }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      title="Agent-Command kopieren → in Claude Code einfügen, startet kokomo-creator"
      onClick={async (e) => {
        e.preventDefault()
        e.stopPropagation()
        try {
          await navigator.clipboard.writeText(buildAgentCommand(idea))
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          // Fallback: ältere Browser / kein Clipboard-API
          window.prompt('Command kopieren:', buildAgentCommand(idea))
        }
      }}
      className="shrink-0 cursor-pointer rounded-md p-1 text-[var(--text-secondary)] transition-colors hover:bg-slate-200/60 hover:text-[var(--text)] dark:hover:bg-slate-700/60"
      aria-label="Agent-Command kopieren"
    >
      {copied ? (
        <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
      )}
    </button>
  )
}

/** Beschrifteter Button, der einen beliebigen Command in die Zwischenablage legt. */
function CopyCommandButton({ text, label, title }: { text: string; label: string; title?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      title={title || 'Command kopieren → in Claude Code einfügen'}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          window.prompt('Command kopieren:', text)
        }
      }}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
    >
      {copied ? (
        <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
      )}
      {copied ? 'Kopiert!' : label}
    </button>
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
        <div className="flex shrink-0 items-center gap-1">
          <ScoreBadge score={idea.score} />
          <CopyButton idea={idea} />
        </div>
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
      {/* Toolbar: Ideen-Skill starten */}
      <div className="flex flex-wrap items-center gap-3">
        <CopyCommandButton
          text="/kokomo-ideen"
          label="Neue Ideen finden"
          title="Kopiert /kokomo-ideen → in Claude Code einfügen, füllt das Backlog mit Themen-Ideen"
        />
        <span className="text-xs text-[var(--text-secondary)]">
          Command kopieren und in Claude Code einfügen → der Ideen-Skill schlägt neue Themen vor.
        </span>
      </div>

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
                      <CopyButton idea={i} />
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Column title={`Backlog (${plan.backlog.length})`}>
            {plan.backlog.map((i) => <IdeaRow key={i.id} idea={i} />)}
          </Column>
          <Column title={`Eingeplant (${plan.eingeplant.length})`}>
            {plan.eingeplant.map((i) => (
              <div key={i.id} className="rounded-lg border border-slate-200/70 bg-white/50 px-3 py-2 text-sm dark:border-slate-700/50 dark:bg-slate-800/30">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-xs text-[var(--text-secondary)]">{i.geplant ? fmtDay(i.geplant) : ''}</span>
                  <CopyButton idea={i} />
                </div>
                <div className="text-[var(--text)]">{i.title}</div>
              </div>
            ))}
          </Column>
          <Column title={`In Arbeit (${plan.inArbeit.length})`}>
            {plan.inArbeit.map((i) => <IdeaRow key={i.id} idea={i} />)}
            {plan.inArbeit.length === 0 && <Empty />}
          </Column>
          <Column title={`Bereit für Publish (${plan.drafts.length})`}>
            {plan.drafts.map((d) => (
              <div
                key={d.slug}
                className="rounded-lg border border-amber-300/60 bg-amber-50/50 px-3 py-2 text-sm dark:border-amber-700/50 dark:bg-amber-900/20"
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      Draft
                    </span>
                    <span className="font-mono text-xs text-[var(--text-secondary)]">{d.date}</span>
                  </div>
                  <CopyPublishButton slug={d.slug} />
                </div>
                <a
                  href={`/admin/posts/${d.slug}`}
                  className="mt-1 block text-[var(--text)] hover:underline"
                >
                  {d.title}
                </a>
              </div>
            ))}
            {plan.drafts.length === 0 && <Empty />}
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
        Das Kopier-Icon legt den <strong>Agent-Command</strong> in die Zwischenablage — in Claude Code einfügen,
        und <code>kokomo-creator</code> startet für diese Idee. Bei <strong>Bereit für Publish</strong> kopiert das
        Icon stattdessen den <code>/kokomo-publish &lt;slug&gt;</code>-Command, der den Draft live schaltet.
        Planen/Verschieben läuft über den
        <code>/kokomo-redaktion</code>-Skill (beads bleibt die Quelle, read-only). Stand: letzter Push nach GitHub.
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
