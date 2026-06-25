import { useState, useEffect } from 'react'

type QuizDimension = 'minimalismus' | 'platz' | 'handwerk' | 'stellplatz' | 'finanzen' | 'autarkie'

interface QuizStats {
  total: number
  last7Days: number
  last30Days: number
  avgOverall: number
  verdictCounts: Record<string, number>
  avgDimensions: Record<QuizDimension, number>
  daily: { day: string; count: number }[]
}

const dimensionLabels: Record<QuizDimension, { emoji: string; name: string }> = {
  minimalismus: { emoji: '✨', name: 'Konsum & Loslassen' },
  platz: { emoji: '📦', name: 'Platz & Hobbys' },
  handwerk: { emoji: '🔧', name: 'Handwerk' },
  stellplatz: { emoji: '📍', name: 'Stellplatz-Suche' },
  finanzen: { emoji: '💰', name: 'Finanzen & Budget' },
  autarkie: { emoji: '🔋', name: 'Autarker Alltag' },
}

const verdictLabels: Record<string, { label: string; color: string }> = {
  'noch-nicht': { label: 'Noch nicht startklar', color: '#f59e0b' },
  'auf-gutem-weg': { label: 'Auf gutem Weg', color: '#01ABE7' },
  bereit: { label: 'Bereit fürs Tiny House', color: '#05DE66' },
}

const dimensionOrder: QuizDimension[] = ['minimalismus', 'platz', 'handwerk', 'stellplatz', 'finanzen', 'autarkie']

export default function AdminQuiz() {
  const [stats, setStats] = useState<QuizStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/quiz-stats')
      if (res.status === 401) throw new Error('Nicht autorisiert — bitte im Admin-Bereich anmelden.')
      if (!res.ok) throw new Error('Laden fehlgeschlagen')
      setStats(await res.json())
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <p className="text-[var(--text-secondary)]">Lädt …</p>
  if (error) return <p className="text-amber-600">{error}</p>
  if (!stats) return null

  const totalVerdicts = Object.values(stats.verdictCounts).reduce((s, v) => s + v, 0) || 1
  const maxDaily = Math.max(1, ...stats.daily.map((d) => d.count))

  return (
    <div className="space-y-8">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Durchläufe gesamt" value={stats.total} />
        <Kpi label="Letzte 7 Tage" value={stats.last7Days} />
        <Kpi label="Letzte 30 Tage" value={stats.last30Days} />
        <Kpi label="Ø Tauglichkeit" value={`${stats.avgOverall}%`} />
      </div>

      {stats.total === 0 ? (
        <div className="glass-card rounded-2xl p-6 text-[var(--text-secondary)]">
          Noch keine Quiz-Ergebnisse erfasst. Sobald jemand den Test abschliesst, erscheinen hier die Auswertungen.
        </div>
      ) : (
        <>
          {/* Verdict distribution */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="mb-4 text-lg font-bold text-[var(--text)]">Verdikt-Verteilung</h2>
            <div className="space-y-3">
              {['bereit', 'auf-gutem-weg', 'noch-nicht'].map((key) => {
                const count = stats.verdictCounts[key] || 0
                const pct = Math.round((count / totalVerdicts) * 100)
                const info = verdictLabels[key]
                return (
                  <div key={key}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-[var(--text)]">{info.label}</span>
                      <span className="text-[var(--text-secondary)]">
                        {count} · {pct}%
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: info.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Average per dimension */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="mb-4 text-lg font-bold text-[var(--text)]">Durchschnitt pro Dimension</h2>
            <div className="space-y-3">
              {dimensionOrder.map((dim) => {
                const val = stats.avgDimensions[dim]
                const info = dimensionLabels[dim]
                const color = val < 50 ? '#f59e0b' : val >= 67 ? '#05DE66' : '#01ABE7'
                return (
                  <div key={dim}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-[var(--text)]">
                        {info.emoji} {info.name}
                      </span>
                      <span className="text-[var(--text-secondary)]">{val}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div className="h-full rounded-full" style={{ width: `${val}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="mt-4 text-xs text-[var(--text-secondary)]">
              Niedrige Werte = häufige Baustelle der Nutzer:innen. Gute Themen für neue Blogartikel.
            </p>
          </div>

          {/* Daily completions */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="mb-4 text-lg font-bold text-[var(--text)]">Durchläufe (letzte 30 Tage)</h2>
            {stats.daily.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">Keine Durchläufe in den letzten 30 Tagen.</p>
            ) : (
              <div className="flex items-end gap-1" style={{ height: 120 }}>
                {stats.daily.map((d) => (
                  <div key={d.day} className="group relative flex-1" title={`${d.day}: ${d.count}`}>
                    <div
                      className="w-full rounded-t bg-primary-500 transition-colors hover:bg-primary-600"
                      style={{ height: `${(d.count / maxDaily) * 110}px`, minHeight: 2 }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <button
        onClick={load}
        className="cursor-pointer rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
      >
        Aktualisieren
      </button>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="text-2xl font-bold text-[var(--text)]">{value}</div>
      <div className="mt-1 text-xs text-[var(--text-secondary)]">{label}</div>
    </div>
  )
}
