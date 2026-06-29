#!/usr/bin/env npx tsx
/**
 * Editorial-Diff-Mining für den KOKOMO-Blog.
 *
 * Vergleicht für jeden Post die ERSTE committe Version (Roh-Entwurf) mit der
 * AKTUELLEN Version und aggregiert wiederkehrende Änderungen zu Regel-Kandidaten
 * für die Skill (reference/voice.md). Idee: Was der User nach dem ersten Commit
 * immer wieder wegstreicht oder ergänzt, ist ein Hinweis auf eine Stil-Regel.
 *
 * EINSCHRÄNKUNG: In-Chat-Korrekturen am Draft, die VOR dem ersten Commit passieren
 * (der Normalfall im kokomo-publish-Workflow), stehen NICHT im Git und werden hier
 * nicht erfasst. Das Mining sieht nur Edits NACH der ersten Veröffentlichung — der
 * Nutzen wächst also mit der Zeit und mit nachträglichen Korrekturen.
 *
 * Usage:
 *   npx tsx pipeline/mine-editorial-diffs.ts            # alle Posts
 *   npx tsx pipeline/mine-editorial-diffs.ts --min=2    # nur Muster in >=2 Posts (Default)
 *   npx tsx pipeline/mine-editorial-diffs.ts --verbose  # pro Post die Wort-Diffs zeigen
 */

import { execSync } from 'child_process'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'
import matter from 'gray-matter'

const ROOT = process.cwd()
const POSTS_DIR = resolve(ROOT, 'src/content/posts')

const args = process.argv.slice(2)
const MIN = Number((args.find((a) => a.startsWith('--min=')) || '--min=2').split('=')[1]) || 2
const VERBOSE = args.includes('--verbose')

// Häufige deutsche Funktionswörter — für die Aggregation uninteressant.
const STOPWORDS = new Set(
  ('der die das und oder aber wir uns unser unsere ich du er sie es ihr ihn ihm den dem des ' +
    'ein eine einen einem einer eines kein keine nicht nichts auch noch schon sehr mehr mal ' +
    'als wie wenn weil dass also so dann hier da dort man von vom zu zum zur mit ohne fuer für ' +
    'auf aus bei nach um an am in im ist sind war waren hat haben hatte wird werden kann koennen ' +
    'können muss müssen soll sollen will wollen das es sich was wer wo wann dabei dazu daran damit ' +
    'schon eben halt nur etwas alles jede jeder jedes diese dieser dieses sowie bzw etc usw ja nein ' +
    'aber denn doch mal ganz immer oft viel viele wenig')
    .split(/\s+/)
    .filter(Boolean)
)

function gitFirstCommit(relPath: string): string | null {
  try {
    const out = execSync(`git log --follow --diff-filter=A --format=%H -- "${relPath}"`, {
      cwd: ROOT,
      stdio: 'pipe',
    })
      .toString()
      .trim()
    const commits = out.split('\n').filter(Boolean)
    return commits.length ? commits[commits.length - 1] : null
  } catch {
    return null
  }
}

function gitShowAt(commit: string, relPath: string): string | null {
  try {
    return execSync(`git show ${commit}:"${relPath}"`, { cwd: ROOT, stdio: 'pipe' }).toString()
  } catch {
    return null
  }
}

/** Body (ohne Frontmatter) in normalisierte Wort-Liste. */
function words(md: string): string[] {
  let body: string
  try {
    body = matter(md).content
  } catch {
    body = md
  }
  return body
    .toLowerCase()
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Markdown-Links → nur Ankertext
    .replace(/[^a-zäöüß\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
}

/** Multiset-Differenz: Wörter, die netto entfernt bzw. ergänzt wurden. */
function multisetDiff(oldW: string[], newW: string[]) {
  const count = (arr: string[]) => {
    const m = new Map<string, number>()
    for (const w of arr) m.set(w, (m.get(w) || 0) + 1)
    return m
  }
  const o = count(oldW)
  const n = count(newW)
  const removed = new Set<string>()
  const added = new Set<string>()
  for (const [w, c] of o) if ((n.get(w) || 0) < c) removed.add(w)
  for (const [w, c] of n) if ((o.get(w) || 0) < c) added.add(w)
  return { removed, added }
}

function main() {
  const files = readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'))
  const removedAgg = new Map<string, number>() // wort → in wievielen Posts entfernt
  const addedAgg = new Map<string, number>()
  let edited = 0
  let analysed = 0

  for (const file of files) {
    const relPath = `src/content/posts/${file}`
    const current = readFileSync(resolve(POSTS_DIR, file), 'utf-8')
    const firstCommit = gitFirstCommit(relPath)
    if (!firstCommit) continue
    analysed++
    const original = gitShowAt(firstCommit, relPath)
    if (original == null || original === current) continue
    edited++

    const { removed, added } = multisetDiff(words(original), words(current))
    for (const w of removed) removedAgg.set(w, (removedAgg.get(w) || 0) + 1)
    for (const w of added) addedAgg.set(w, (addedAgg.get(w) || 0) + 1)

    if (VERBOSE && (removed.size || added.size)) {
      console.log(`\n• ${file}`)
      if (removed.size) console.log(`   − entfernt: ${[...removed].slice(0, 25).join(', ')}`)
      if (added.size) console.log(`   + ergänzt:  ${[...added].slice(0, 25).join(', ')}`)
    }
  }

  const rank = (m: Map<string, number>) =>
    [...m.entries()].filter(([, c]) => c >= MIN).sort((a, b) => b[1] - a[1])

  console.log('\n════════ Editorial-Diff-Mining ════════')
  console.log(`Posts gesamt: ${readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md')).length}` +
    ` · analysiert (mit Git-Historie): ${analysed} · mit Edits nach Erst-Commit: ${edited}`)

  const remRank = rank(removedAgg)
  const addRank = rank(addedAgg)

  console.log(`\n── Häufig WEGGESTRICHEN (in ≥${MIN} Posts) → Kandidaten für „vermeiden"-Regeln`)
  if (remRank.length) remRank.forEach(([w, c]) => console.log(`   ${String(c).padStart(2)}×  ${w}`))
  else console.log('   (noch keine wiederkehrenden Muster)')

  console.log(`\n── Häufig ERGÄNZT (in ≥${MIN} Posts) → Kandidaten für bevorzugte Begriffe/Ton`)
  if (addRank.length) addRank.forEach(([w, c]) => console.log(`   ${String(c).padStart(2)}×  ${w}`))
  else console.log('   (noch keine wiederkehrenden Muster)')

  console.log('\nHinweis: Heuristik auf Wortebene. Vor dem Übernehmen in voice.md prüfen, ob ein')
  console.log('Muster wirklich eine Stil-Regel ist (nicht nur Thema des einzelnen Posts).')
  if (edited < 3) {
    console.log('Wenige nachträglich editierte Posts → Aussagekraft noch gering. Wächst mit der Zeit.')
  }
}

main()
