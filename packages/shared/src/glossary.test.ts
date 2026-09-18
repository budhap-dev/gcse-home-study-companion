import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GlossaryFile, entrySlug, letterOf, searchGlossary, type GlossaryEntry } from './glossary.ts'

const GLOSSARY_DIR = join(import.meta.dirname, '../../../supabase/seed/glossary')
const CONTENT_DIR = join(import.meta.dirname, '../../../supabase/seed/content')

const files = readdirSync(GLOSSARY_DIR).filter((f) => f.endsWith('.json'))
const parsed = files.map((f) => GlossaryFile.parse(JSON.parse(readFileSync(join(GLOSSARY_DIR, f), 'utf8'))))
const ALL: GlossaryEntry[] = parsed.flatMap((g) => g.entries)

const topicIds = new Set(
  readdirSync(CONTENT_DIR)
    .filter((s) => !s.endsWith('.md'))
    .flatMap((s) => readdirSync(join(CONTENT_DIR, s)).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(CONTENT_DIR, s, f), 'utf8')).id as string)),
)

describe('glossary', () => {
  it('has a file per subject that has content', () => {
    expect(files.length).toBeGreaterThanOrEqual(6)
    for (const g of parsed) expect(g.entries.length, g.subjectId).toBeGreaterThan(10)
  })

  it('gives every term a definition and a worked example', () => {
    // The example is the point: a definition alone rarely settles what a term means.
    for (const e of ALL) {
      expect(e.definition.length, e.term).toBeGreaterThan(30)
      expect(e.example.length, e.term).toBeGreaterThan(15)
    }
  })

  it('never repeats a term within a subject', () => {
    for (const g of parsed) {
      const names = g.entries.map((e) => e.term.toLowerCase())
      expect(new Set(names).size, `${g.subjectId}: ${names.filter((n, i) => names.indexOf(n) !== i)}`).toBe(names.length)
    }
  })

  it('gives every entry a unique, url-safe slug', () => {
    // Across subjects the same word can mean two things, so the slug carries the subject.
    const slugs = ALL.map(entrySlug)
    expect(new Set(slugs).size, `duplicates: ${slugs.filter((s, i) => slugs.indexOf(s) !== i)}`).toBe(slugs.length)
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/)
  })

  it('only links to topics that exist', () => {
    const bad = ALL.flatMap((e) => e.topics.filter((t) => !topicIds.has(t)).map((t) => `${e.term} → ${t}`))
    expect(bad).toEqual([])
  })

  it('never lets an alias hijack another entry in the same subject', () => {
    // searchGlossary scores an exact alias match above a prefix match on a name, so an
    // alias shared with another entry silently hijacks that search. Five did, including
    // "merge" on both Merge sort and Merge, and "root" on both Root and Roots.
    const clashes: string[] = []
    for (const g of parsed) {
      const owner = new Map<string, string>()
      for (const e of g.entries) {
        for (const name of [e.term, ...e.aliases]) {
          const key = name.toLowerCase().trim()
          const held = owner.get(key)
          if (held && held !== e.term) clashes.push(`${g.subjectId}: "${name}" on both ${held} and ${e.term}`)
          owner.set(key, e.term)
        }
      }
    }
    expect(clashes).toEqual([])
  })

  it('only points at related terms that exist', () => {
    const names = new Set(ALL.map((e) => e.term))
    const bad = ALL.flatMap((e) => e.related.filter((r) => !names.has(r)).map((r) => `${e.term} → ${r}`))
    expect(bad).toEqual([])
  })

  it('keeps a homonym in each subject that uses it', () => {
    // "Index" is an exponent in Maths and an array position in Computer Science.
    const index = ALL.filter((e) => e.term === 'Index').map((e) => e.subjectId).sort()
    expect(index).toEqual(['computer-science', 'maths'])
  })

  it('puts an entry in the subject that teaches it', () => {
    for (const g of parsed) for (const e of g.entries) expect(e.subjectId, e.term).toBe(g.subjectId)
  })

  it('files every term under a letter of the A to Z', () => {
    for (const e of ALL) expect(letterOf(e), e.term).toMatch(/^[A-Z#]$/)
  })
})

describe('searchGlossary', () => {
  it('puts an entry actually called the word above one that only lists it as an alias', () => {
    // The search runs across every subject at once, so a physics alias used to outrank
    // the entry of that exact name in another subject. "Loop" landed on Iteration and
    // "floating" on a business term.
    for (const [query, expected] of [
      ['loop', 'Loop'],
      ['floating', 'Floating'],
      ['imperfect', 'Imperfect'],
    ] as const) {
      expect(searchGlossary(ALL, query)[0]!.entry.term, query).toBe(expected)
    }
  })

  it('surfaces every side of a genuine homonym', () => {
    // Index is an exponent in Maths and an array position in Computer Science; vector is
    // a disease carrier in Biology and a quantity in Physics. Tangent has three senses,
    // since Further Maths defines it as the line whose gradient is the curve's gradient.
    // Each list is checked against the top N hits, where N is its own length, so adding a
    // subject to a term widens the list here rather than silently pushing one off the end.
    for (const [query, subjects] of [
      ['index', ['computer-science', 'maths']],
      ['vector', ['biology', 'physics']],
      ['tangent', ['further-maths', 'maths', 'physics']],
    ] as const) {
      const top = searchGlossary(ALL, query).slice(0, subjects.length).map((h) => h.entry.subjectId).sort()
      expect(top, query).toEqual([...subjects].sort())
    }
  })

  it('puts an exact name first', () => {
    const hits = searchGlossary(ALL, 'momentum')
    expect(hits[0]!.entry.term).toBe('Momentum')
  })

  it('finds a term by an alias the student would actually type', () => {
    for (const [query, expected] of [
      ['4ps', 'Marketing mix'],
      ['spiced', 'Exchange rate'],
      ['f = ke', "Hooke's law"],
      ['pseudocode', 'AQA pseudo-code'],
      ['sea of electrons', 'Metallic bonding'],
      ['break even', 'Break-even'],
    ] as const) {
      expect(searchGlossary(ALL, query)[0]?.entry.term, query).toBe(expected)
    }
  })

  it('requires every word to match, so two words narrow rather than widen', () => {
    const one = searchGlossary(ALL, 'energy')
    const two = searchGlossary(ALL, 'energy spring')
    expect(two.length).toBeLessThan(one.length)
    expect(two.length).toBeGreaterThan(0)
  })

  it('returns nothing for an empty query', () => {
    expect(searchGlossary(ALL, '   ')).toEqual([])
  })
})
