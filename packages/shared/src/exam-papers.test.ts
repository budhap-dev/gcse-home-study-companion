import { describe, expect, it } from 'vitest'
import { EXAM_PAPERS, NO_PAPER_SPLIT } from './examPapers.ts'
import { SUBJECTS } from './subjects.ts'

describe('exam papers', () => {
  it('every subject either lists its papers or says why it has no split, never both', () => {
    for (const s of SUBJECTS) {
      expect(Boolean(EXAM_PAPERS[s.id]) !== Boolean(NO_PAPER_SPLIT[s.id]), s.id).toBe(true)
    }
  })

  it('names only real units, and puts every unit on some paper', () => {
    for (const [subjectId, papers] of Object.entries(EXAM_PAPERS)) {
      const units = SUBJECTS.find((s) => s.id === subjectId)!.units.map((u) => u.id)
      const listed = papers.flatMap((p) => p.units)
      for (const u of listed) expect(units, `${subjectId}: ${u}`).toContain(u)
      for (const u of units) expect(listed, `${subjectId}: ${u} on no paper`).toContain(u)
    }
  })

  it('shares a unit between papers only where the board does (Biology Key concepts)', () => {
    for (const [subjectId, papers] of Object.entries(EXAM_PAPERS)) {
      const listed = papers.flatMap((p) => p.units)
      const shared = [...new Set(listed.filter((u, i) => listed.indexOf(u) !== i))]
      expect(shared, subjectId).toEqual(subjectId === 'biology' ? ['key-concepts'] : [])
    }
  })
})
