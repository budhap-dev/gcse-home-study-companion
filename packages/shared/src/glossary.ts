import { z } from 'zod'
import { RichText, Slug } from './content/common.ts'
import { Provenance } from './content/common.ts'

/**
 * One term the student can look up. Every entry carries a definition *and* a worked
 * example, because a definition on its own rarely settles what a term means: "upthrust
 * is the resultant upward force on a submerged object" means little until you see
 * 9.8 N on a 0.1 m cube. The example is required for that reason.
 */
const EntryInput = z.object({
  term: z.string().min(1),
  /** Other names the student might search for: plurals, symbols, the school's wording. */
  aliases: z.array(z.string().min(1)).default([]),
  /** What it means, in the student's own reading level. Markdown with $maths$. */
  definition: RichText,
  /** A concrete instance: a number, a formula applied, a sentence of the real thing. */
  example: RichText,
  /** Topic ids that teach it, most relevant first. Empty when no topic covers it yet. */
  topics: z.array(Slug).default([]),
  /** Terms worth reading next. Names, not slugs; unresolved names are ignored. */
  related: z.array(z.string().min(1)).default([]),
})

export const GlossaryEntry = EntryInput.extend({ subjectId: Slug })
export type GlossaryEntry = z.infer<typeof GlossaryEntry>

/**
 * One subject's terms, the unit of authoring and review. The subject is named once at
 * the top of the file rather than repeated on every entry, and stamped onto each one
 * here, so the two can never disagree.
 */
export const GlossaryFile = z
  .object({
    subjectId: Slug,
    entries: z.array(EntryInput).min(1),
    provenance: Provenance,
  })
  .transform((file) => ({
    ...file,
    entries: file.entries.map((entry): GlossaryEntry => ({ ...entry, subjectId: file.subjectId })),
  }))
export type GlossaryFile = z.infer<typeof GlossaryFile>

/** URL-safe form of a term's name. */
export function slugOf(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * The id used by `/glossary?term=` deep links. Qualified by subject because a glossary
 * spanning six subjects has real homonyms: *index* is an exponent in Maths and a
 * position in an array in Computer Science, and both deserve their own entry.
 */
export function entrySlug(entry: Pick<GlossaryEntry, 'subjectId' | 'term'>): string {
  return `${entry.subjectId}-${slugOf(entry.term)}`
}

export interface GlossaryHit {
  entry: GlossaryEntry
  score: number
}

function words(query: string): string[] {
  return query.toLowerCase().split(/\s+/).map((t) => t.trim()).filter(Boolean)
}

/**
 * Ranks terms against a query. Every word has to match somewhere, which beats a noisy
 * OR on a list this size. An exact name or alias wins outright, a prefix comes next,
 * and a word buried in the definition counts for least.
 */
export function searchGlossary(entries: GlossaryEntry[], query: string): GlossaryHit[] {
  const q = query.trim().toLowerCase()
  const terms = words(q)
  if (terms.length === 0) return []

  const hits: GlossaryHit[] = []
  for (const entry of entries) {
    const name = entry.term.toLowerCase()
    const aliases = entry.aliases.map((a) => a.toLowerCase())
    const definition = entry.definition.toLowerCase()
    const example = entry.example.toLowerCase()

    let score = 0
    // An entry actually called the searched word beats one that only lists it as an
    // alias. The search runs across every subject at once, so without this a physics
    // alias could outrank the Computer Science entry of that exact name, and a student
    // looking up "loop" or "floating" landed in the wrong subject.
    if (name === q) score += 110
    else if (aliases.includes(q)) score += 100
    else if (name.startsWith(q)) score += 45
    else if (aliases.some((a) => a.startsWith(q))) score += 40

    let matchedAll = true
    for (const w of terms) {
      let s = 0
      if (name.includes(w)) s += 20
      if (aliases.some((a) => a.includes(w))) s += 12
      if (definition.includes(w)) s += 3
      if (example.includes(w)) s += 2
      if (s === 0) matchedAll = false
      score += s
    }
    if (matchedAll) hits.push({ entry, score })
  }
  return hits.sort((a, b) => b.score - a.score || a.entry.term.localeCompare(b.entry.term, 'en', { sensitivity: 'base' }))
}

/** The letter a term files under in the A to Z. Digits and symbols go under '#'. */
export function letterOf(entry: GlossaryEntry): string {
  const first = entry.term[0]!.toUpperCase()
  return /[A-Z]/.test(first) ? first : '#'
}

export const GLOSSARY_LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']
