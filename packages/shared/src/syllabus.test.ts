import { describe, expect, it } from 'vitest'
import { SYLLABUS } from './syllabus.ts'
import { SUBJECTS } from './subjects.ts'

/**
 * The subject page shows the whole syllabus, so a topic that has been written must be
 * reachable from it and a `topicId` that points nowhere would render as a dead link.
 * The content pack is not importable from this package, so the topic ids are checked
 * against the seed folder on disk.
 */
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '../../../supabase/seed/content')
const written = new Map<string, string>()
for (const dir of readdirSync(ROOT)) {
  if (!statSync(join(ROOT, dir)).isDirectory()) continue
  for (const file of readdirSync(join(ROOT, dir))) {
    if (file.endsWith('.json')) written.set(file.replace('.json', ''), dir)
  }
}

describe('syllabus', () => {
  it('covers every subject', () => {
    for (const s of SUBJECTS) expect(Object.keys(SYLLABUS), s.id).toContain(s.id)
  })

  it('only points at topics that exist', () => {
    const bad: string[] = []
    for (const [subjectId, blocks] of Object.entries(SYLLABUS)) {
      for (const b of blocks) {
        for (const t of b.topics) {
          if (!t.topicId) continue
          if (!written.has(t.topicId)) bad.push(`${subjectId}: ${t.topicId}`)
          else if (written.get(t.topicId) !== subjectId) bad.push(`${subjectId}: ${t.topicId} is in ${written.get(t.topicId)}`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('lists every written topic at least once, so nothing is invisible', () => {
    const listed = Object.values(SYLLABUS).flatMap((bs) => bs.flatMap((b) => b.topics.map((t) => t.topicId).filter(Boolean)))
    expect([...written.keys()].filter((id) => !listed.includes(id))).toEqual([])
  })

  /**
   * A spiral curriculum teaches some things twice, so a topic may appear under two
   * years: the school covers surds and congruency in Year 9 and again in Year 10.
   * Both entries link to the same written topic. Any repeat must be across years, not
   * twice inside one, which would just be a duplicated line on the page.
   */
  it('only repeats a topic across different years', () => {
    const bad: string[] = []
    for (const [subjectId, blocks] of Object.entries(SYLLABUS)) {
      const seen = new Map<string, Set<number>>()
      for (const b of blocks) {
        for (const t of b.topics) {
          if (!t.topicId) continue
          const years = seen.get(t.topicId) ?? new Set<number>()
          if (years.has(b.year)) bad.push(`${subjectId}: ${t.topicId} twice in year ${b.year}`)
          years.add(b.year)
          seen.set(t.topicId, years)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('puts a syllabus entry in the year the topic itself claims', () => {
    // The topic file's `year` and the syllabus block's `year` must agree, or the page
    // would show the same topic under two different years.
    const inYear = (subjectId: keyof typeof SYLLABUS, year: number) =>
      SYLLABUS[subjectId].filter((b) => b.year === year).flatMap((b) => b.topics.map((t) => t.topicId))
    expect(inYear('physics', 9)).toContain('stopping-distances')
    expect(inYear('business', 9)).toContain('putting-a-business-idea-into-practice')
    /**
     * Every GCSE subject has a Year 9 block, because the school re-tests Year 9 in all of
     * them. Further Maths is not a GCSE and is not one of them: AQA describes 8365 as
     * taken either alongside or after GCSE Maths, and it assumes the Key Stage 4
     * programme of study as prior knowledge, so it cannot start in Year 9. The exemption
     * is named rather than a blanket "unless empty", so a GCSE subject that lost its
     * Year 9 rows by accident still fails here.
     */
    const STARTS_AFTER_YEAR_9: (keyof typeof SYLLABUS)[] = ['further-maths']
    for (const subjectId of Object.keys(SYLLABUS) as (keyof typeof SYLLABUS)[]) {
      if (STARTS_AFTER_YEAR_9.includes(subjectId)) {
        expect(SYLLABUS[subjectId].some((b) => b.year === 9), subjectId).toBe(false)
        expect(SYLLABUS[subjectId].some((b) => b.year === 10), subjectId).toBe(true)
        continue
      }
      expect(SYLLABUS[subjectId].some((b) => b.year === 9), subjectId).toBe(true)
    }
  })
})
