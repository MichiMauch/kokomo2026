/**
 * Redaktionsplan — leitet die Content-Pipeline aus den beads-Daten ab.
 *
 * Quelle der Wahrheit bleibt bd: Diese Datei PARST nur den committeten Export
 * `.beads/issues.jsonl` (Ideen) und kombiniert ihn mit den publizierten Posts
 * (aus der Astro-Content-Collection). Read-only — kein Schreiben zurück nach bd.
 */

export type Stage = 'backlog' | 'eingeplant' | 'in_arbeit'

export interface PlanIdea {
  id: string
  title: string
  stage: Stage
  geplant?: string // YYYY-MM-DD (jüngste "Geplant:"-Zeile aus den Notes)
  score?: string // A | B | C
  typ?: string
  quelleUrl?: string
  ausbauVon?: string
}

export interface PublishedPost {
  slug: string
  title: string
  date: string // YYYY-MM-DD
}

export interface DraftPost {
  slug: string
  title: string
  date: string // YYYY-MM-DD
}

export interface Cadence {
  lastPublished?: string
  daysSinceLast?: number
  postsThisMonth: number
  nextPlanned?: string
  daysToNext?: number
  warn: boolean
  message: string
}

export interface Plan {
  eingeplant: PlanIdea[]
  backlog: PlanIdea[]
  inArbeit: PlanIdea[]
  drafts: DraftPost[]
  published: PublishedPost[]
  cadence: Cadence
  today: string
}

const RE_GEPLANT = /Geplant:\s*(\d{4}-\d{2}-\d{2})/g
const RE_SCORE = /Score:\s*([ABC])/i
const RE_TYP = /Typ:\s*([^|\n]+)/i
const RE_QUELLE_URL = /Quelle-URL:\s*(\S+)/i
const RE_AUSBAU = /Ausbau von:\s*(\S+)/i

function lastGeplant(notes: string): string | undefined {
  let m: RegExpExecArray | null
  let last: string | undefined
  RE_GEPLANT.lastIndex = 0
  while ((m = RE_GEPLANT.exec(notes)) !== null) last = m[1]
  return last
}

/** Parst die idee-Issues aus dem bd-JSONL-Export in Plan-Stufen. */
export function parseIdeasFromJsonl(jsonl: string): PlanIdea[] {
  const out: PlanIdea[] = []
  for (const line of jsonl.split('\n')) {
    const t = line.trim()
    if (!t) continue
    let rec: any
    try {
      rec = JSON.parse(t)
    } catch {
      continue
    }
    const labels: string[] = rec.labels || []
    if (!labels.includes('idee')) continue
    if (rec.status === 'closed') continue // publizierte/erledigte raus

    const notes: string = rec.notes || ''
    const stage: Stage =
      rec.status === 'in_progress'
        ? 'in_arbeit'
        : labels.includes('geplant')
          ? 'eingeplant'
          : 'backlog'

    out.push({
      id: rec.id,
      title: rec.title || '(ohne Titel)',
      stage,
      geplant: stage === 'eingeplant' ? lastGeplant(notes) : undefined,
      score: notes.match(RE_SCORE)?.[1]?.toUpperCase(),
      typ: notes.match(RE_TYP)?.[1]?.trim(),
      quelleUrl: notes.match(RE_QUELLE_URL)?.[1],
      ausbauVon: notes.match(RE_AUSBAU)?.[1],
    })
  }
  return out
}

function daysBetween(aISO: string, bISO: string): number {
  const a = Date.parse(aISO + 'T00:00:00Z')
  const b = Date.parse(bISO + 'T00:00:00Z')
  return Math.round((b - a) / 86_400_000)
}

const SCORE_ORDER: Record<string, number> = { A: 0, B: 1, C: 2 }

/** Baut den vollständigen Plan inkl. Rhythmus-Check (Ziel ~2 Posts/Monat). */
export function buildPlan(
  ideas: PlanIdea[],
  published: PublishedPost[],
  today: string,
  drafts: DraftPost[] = [],
): Plan {
  const eingeplant = ideas
    .filter((i) => i.stage === 'eingeplant')
    .sort((a, b) => (a.geplant || '9999').localeCompare(b.geplant || '9999'))
  const backlog = ideas
    .filter((i) => i.stage === 'backlog')
    .sort((a, b) => (SCORE_ORDER[a.score || 'C'] ?? 3) - (SCORE_ORDER[b.score || 'C'] ?? 3))
  const inArbeit = ideas.filter((i) => i.stage === 'in_arbeit')

  const pub = [...published].sort((a, b) => b.date.localeCompare(a.date))
  const lastPublished = pub[0]?.date
  const daysSinceLast = lastPublished ? daysBetween(lastPublished, today) : undefined
  const monthPrefix = today.slice(0, 7)
  const postsThisMonth = pub.filter((p) => p.date.startsWith(monthPrefix)).length

  const upcoming = eingeplant.filter((i) => i.geplant && i.geplant >= today)
  const nextPlanned = upcoming[0]?.geplant
  const daysToNext = nextPlanned ? daysBetween(today, nextPlanned) : undefined

  // Ziel ~2/Monat ≈ alle 14 Tage. Warnung, wenn letzter Post > 16 Tage her
  // UND in den nächsten 7 Tagen nichts eingeplant ist.
  const warn =
    (daysSinceLast === undefined || daysSinceLast > 16) &&
    (daysToNext === undefined || daysToNext > 7)

  let message: string
  if (warn) {
    const seit = daysSinceLast === undefined ? 'unbekannt lange' : `${daysSinceLast} Tagen`
    message = nextPlanned
      ? `Letzter Post vor ${seit}, nächster erst am ${nextPlanned} — Lücke. Plane etwas dazwischen.`
      : `Letzter Post vor ${seit} und nichts eingeplant — plane den nächsten Post ein.`
  } else {
    message = nextPlanned
      ? `Rhythmus ok — nächster Post am ${nextPlanned}${daysToNext !== undefined ? ` (in ${daysToNext} Tagen)` : ''}.`
      : 'Rhythmus ok.'
  }

  const draftsSorted = [...drafts].sort((a, b) => b.date.localeCompare(a.date))

  return {
    eingeplant,
    backlog,
    inArbeit,
    drafts: draftsSorted,
    published: pub.slice(0, 8),
    cadence: { lastPublished, daysSinceLast, postsThisMonth, nextPlanned, daysToNext, warn, message },
    today,
  }
}
