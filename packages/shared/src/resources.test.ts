import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RESOURCE_HOSTS, ResourceFile, isComingSoon, type Resource } from './resources.ts'
import { SUBJECTS } from './subjects.ts'

const DIR = join(import.meta.dirname, '../../../supabase/seed/resources')
const CONTENT_DIR = join(import.meta.dirname, '../../../supabase/seed/content')

const files = readdirSync(DIR).filter((f) => f.endsWith('.json'))
const parsed = files.map((f) => ({ file: f, data: ResourceFile.parse(JSON.parse(readFileSync(join(DIR, f), 'utf8'))) }))
const ALL: Resource[] = parsed.flatMap((p) => p.data.resources)
const READY = ALL.filter((r) => !isComingSoon(r))
const name = (r: Resource) => `${r.subjectId}/${r.id}`

/** Topic id to its subject, read from the content pack itself. */
const topicSubject = new Map<string, string>(
  readdirSync(CONTENT_DIR)
    .filter((s) => !s.includes('.'))
    .flatMap((s) => readdirSync(join(CONTENT_DIR, s)).filter((f) => f.endsWith('.json')).map((f) => [JSON.parse(readFileSync(join(CONTENT_DIR, s, f), 'utf8')).id as string, s] as const)),
)

const channel = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!)
}

describe('resources', () => {
  it('has one file per subject, named by its subject id', () => {
    for (const p of parsed) expect(p.file).toBe(`${p.data.subjectId}.json`)
    expect(parsed.map((p) => p.data.subjectId).sort()).toEqual(SUBJECTS.map((s) => s.id).sort())
  })

  it('never repeats a resource id within a subject', () => {
    for (const p of parsed) {
      const ids = p.data.resources.map((r) => r.id)
      expect(new Set(ids).size, p.file).toBe(ids.length)
    }
  })

  /**
   * Links go to the boards, the regulator and Bitesize, and nowhere else: those are the
   * sources the content is checked against, and the only ones a card may send a student to.
   */
  it('links only to the boards, Ofqual and Bitesize, over https', () => {
    const bad = ALL.flatMap((r) => [...r.sources, ...r.furtherReading].filter((l) => !(RESOURCE_HOSTS as readonly string[]).includes(new URL(l.url).host)).map((l) => `${name(r)} → ${l.url}`))
    expect(bad).toEqual([])
  })

  it('cites the board for every resource', () => {
    for (const r of ALL) expect(r.sources.some((l) => !l.url.includes('bbc.co.uk')), name(r)).toBe(true)
  })

  /** "Given" is a claim about a particular year's paper, so it has to say which. */
  it('says which sheet a given resource follows', () => {
    for (const r of ALL.filter((r) => r.status === 'given')) expect(r.statusNote, name(r)).toBeTruthy()
  })

  it('only names topics that exist, in its own subject', () => {
    const bad = ALL.flatMap((r) => r.topics.filter((t) => topicSubject.get(t) !== r.subjectId).map((t) => `${name(r)} → ${t}`))
    expect(bad).toEqual([])
  })

  /** A written resource earns its place by being used: in lessons, and outside school. */
  it('gives every written resource its topics and at least two real-world uses', () => {
    for (const r of READY) {
      expect(r.topics.length, name(r)).toBeGreaterThan(0)
      expect(r.applications.length, name(r)).toBeGreaterThanOrEqual(2)
      for (const a of r.applications) expect(a.body.length, `${name(r)}: ${a.title}`).toBeGreaterThan(40)
    }
  })

  it('colours every formula group dark enough to read on white', () => {
    for (const r of ALL) {
      for (const b of r.blocks) {
        if (b.kind !== 'formulae') continue
        for (const g of b.groups) expect(1.05 / (luminance(g.colour) + 0.05), `${name(r)}: ${g.title}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('gives every table row one cell per column', () => {
    for (const r of ALL) {
      for (const b of r.blocks) {
        if (b.kind !== 'table') continue
        for (const row of b.rows) expect(row.length, `${name(r)}: ${row[0]}`).toBe(b.columns.length)
      }
    }
  })
})
