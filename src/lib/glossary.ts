import { readFileSync } from 'fs'
import { join } from 'path'
import { parse } from 'yaml'
import { generateSlug } from './utils'

export interface GlossaryTerm {
  term: string
  definition: string
}

let cached: GlossaryTerm[] | null = null

export function getGlossaryTerms(): GlossaryTerm[] {
  if (cached) return cached
  const raw = readFileSync(join(process.cwd(), 'src/data/glossary.yaml'), 'utf-8')
  cached = parse(raw) as GlossaryTerm[]
  return cached
}

export function getGlossaryByLetter(): Map<string, GlossaryTerm[]> {
  const terms = getGlossaryTerms()
  const map = new Map<string, GlossaryTerm[]>()
  for (const t of terms) {
    const letter = t.term.charAt(0).toUpperCase()
    if (!map.has(letter)) map.set(letter, [])
    map.get(letter)!.push(t)
  }
  return map
}

export function slugifyTerm(term: string): string {
  return generateSlug(term)
}
