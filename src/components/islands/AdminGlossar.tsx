import { useState, useEffect, useMemo } from 'react'

interface GlossaryStat {
  term: string
  clicks: number
  searches: number
  hovers: number
  boost: number
  score: number
  updated_at: string
}

type SortKey = 'score' | 'clicks' | 'searches' | 'hovers' | 'boost' | 'term'

export default function AdminGlossar() {
  const [stats, setStats] = useState<GlossaryStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('score')
  const [sortAsc, setSortAsc] = useState(false)
  const [editingTerm, setEditingTerm] = useState<string | null>(null)
  const [editBoost, setEditBoost] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/glossary-stats')
      if (!res.ok) throw new Error('Laden fehlgeschlagen')
      const data = await res.json()
      setStats(data)
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }

  async function saveBoost(term: string) {
    const boost = parseInt(editBoost, 10)
    if (isNaN(boost)) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/glossary-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term, boost }),
      })
      if (!res.ok) throw new Error('Speichern fehlgeschlagen')
      setStats((prev) =>
        prev.map((s) =>
          s.term === term
            ? { ...s, boost, score: s.clicks + s.searches + s.hovers + boost }
            : s,
        ),
      )
      setEditingTerm(null)
    } catch (err: any) {
      alert(err.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  function handleSort(key: SortKey) {
    if (sortBy === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortBy(key)
      setSortAsc(false)
    }
  }

  const filtered = useMemo(() => {
    let items = stats
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter((s) => s.term.toLowerCase().includes(q))
    }
    return [...items].sort((a, b) => {
      const aVal = a[sortBy]
      const bVal = b[sortBy]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }, [stats, search, sortBy, sortAsc])

  const sortArrow = (key: SortKey) =>
    sortBy === key ? (sortAsc ? ' \u2191' : ' \u2193') : ''

  if (loading) {
    return <div className="text-center py-12 text-[var(--text-secondary)]">Lade Glossar-Statistiken...</div>
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error}</p>
        <button onClick={loadStats} className="text-primary-500 underline">Erneut versuchen</button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <input
          type="search"
          placeholder="Term filtern..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-secondary)] outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />
        <span className="text-sm text-[var(--text-secondary)]">
          {filtered.length} {filtered.length === 1 ? 'Term' : 'Terme'}
        </span>
      </div>

      {stats.length === 0 ? (
        <p className="py-8 text-center text-[var(--text-secondary)]">
          Noch keine Glossar-Statistiken vorhanden. Statistiken erscheinen, sobald Nutzer Glossar-Begriffe suchen oder anklicken.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg)] text-left text-xs uppercase tracking-wider text-[var(--text-secondary)]">
              <tr>
                <th className="cursor-pointer px-4 py-3 font-semibold hover:text-primary-500" onClick={() => handleSort('term')}>
                  Term{sortArrow('term')}
                </th>
                <th className="cursor-pointer px-4 py-3 text-right font-semibold hover:text-primary-500" onClick={() => handleSort('clicks')}>
                  Klicks{sortArrow('clicks')}
                </th>
                <th className="cursor-pointer px-4 py-3 text-right font-semibold hover:text-primary-500" onClick={() => handleSort('searches')}>
                  Suchen{sortArrow('searches')}
                </th>
                <th className="cursor-pointer px-4 py-3 text-right font-semibold hover:text-primary-500" onClick={() => handleSort('hovers')}>
                  Hovers{sortArrow('hovers')}
                </th>
                <th className="cursor-pointer px-4 py-3 text-right font-semibold hover:text-primary-500" onClick={() => handleSort('boost')}>
                  Boost{sortArrow('boost')}
                </th>
                <th className="cursor-pointer px-4 py-3 text-right font-semibold hover:text-primary-500" onClick={() => handleSort('score')}>
                  Score{sortArrow('score')}
                </th>
                <th className="px-4 py-3 font-semibold">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map((stat) => (
                <tr key={stat.term} className="hover:bg-[var(--bg)]/50">
                  <td className="px-4 py-3 font-medium capitalize">{stat.term}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{stat.clicks}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{stat.searches}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{stat.hovers}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {editingTerm === stat.term ? (
                      <input
                        type="number"
                        value={editBoost}
                        onChange={(e) => setEditBoost(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveBoost(stat.term)
                          if (e.key === 'Escape') setEditingTerm(null)
                        }}
                        className="w-20 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-right text-sm outline-none focus:border-primary-500"
                        autoFocus
                      />
                    ) : (
                      <span className={stat.boost !== 0 ? (stat.boost > 0 ? 'text-green-600' : 'text-red-500') : ''}>
                        {stat.boost}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{stat.score}</td>
                  <td className="px-4 py-3">
                    {editingTerm === stat.term ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => saveBoost(stat.term)}
                          disabled={saving}
                          className="rounded bg-primary-500 px-2 py-1 text-xs text-white hover:bg-primary-600 disabled:opacity-50"
                        >
                          {saving ? '...' : 'OK'}
                        </button>
                        <button
                          onClick={() => setEditingTerm(null)}
                          className="rounded border border-[var(--border)] px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          Abbrechen
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingTerm(stat.term)
                          setEditBoost(String(stat.boost))
                        }}
                        className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Boost
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
