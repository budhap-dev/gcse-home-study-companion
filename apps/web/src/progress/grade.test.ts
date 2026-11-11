import type { GradeBand } from '@study/shared'
import { describe, expect, it } from 'vitest'
import type { TopicSummary } from '../content/index.ts'
import { bandRates, rangeFor, workingAt, workingAtNote, MIN_ANSWERS } from './grade.ts'
import { mergeProgress } from './merge.ts'
import { emptyState, targetFor, type AttemptRecord, type ProgressState } from './store.ts'
import { targetLine } from '../components/GradePanel.tsx'

const NOW = new Date('2026-11-11T12:00:00Z')
const topics = [{ id: 'a' }, { id: 'b' }] as TopicSummary[]

/** One attempt on topic `topicId` with `n` questions in `band`, `right` of them right. */
function attempt(topicId: string, band: GradeBand, n: number, right: number, at = '2026-11-01T10:00:00Z', prefix = band): AttemptRecord {
  const questions = Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i}`, skill: 's', gradeBand: band, marksScored: i < right ? 2 : 0, marksAvailable: 2, correct: i < right }))
  return { id: `${topicId}-${prefix}-${at}`, topicId, kind: 'quiz', marksScored: right * 2, marksAvailable: n * 2, markedHow: 'auto', completedAt: at, questions }
}
const state = (...attempts: AttemptRecord[]): ProgressState => ({ ...emptyState(), attempts })

describe('working-at grade (MTV-2)', () => {
  it('waits for enough answers rather than guess', () => {
    const w = workingAt(topics, state(attempt('a', '4-5', MIN_ANSWERS - 1, 19)), NOW)
    expect(w).toEqual({ kind: 'too-few', answers: 19, need: 1 })
    expect(workingAtNote(w)).toMatch(/^1 more answered question/)
  })

  it('counts only the newest answer to each question', () => {
    const old = attempt('a', '6-7', 20, 0, '2026-10-01T10:00:00Z')
    const fresh = attempt('a', '6-7', 20, 20, '2026-11-01T10:00:00Z')
    const w = workingAt(topics, state(old, fresh), NOW)
    expect(w.kind === 'estimate' && w.bands['6-7']).toEqual({ got: 40, of: 40, answers: 20 })
  })

  it('ignores answers from before the window and from other subjects', () => {
    const w = workingAt(topics, state(attempt('a', '6-7', 25, 25, '2026-07-01T10:00:00Z'), attempt('elsewhere', '6-7', 25, 25)), NOW)
    expect(w).toEqual({ kind: 'too-few', answers: 0, need: MIN_ANSWERS })
  })

  it('reads the bands into a range', () => {
    const r = (r45?: number, r67?: number, r89?: number) => rangeFor({ '4-5': r45, '6-7': r67, '8-9': r89 })
    expect(r(0.95, 0.85, 0.75)).toEqual([8, 9])
    expect(r(0.9, 0.75, 0.55)).toEqual([7, 8])
    expect(r(0.9, 0.65, 0.2)).toEqual([6, 7])
    expect(r(0.8, 0.45, 0.1)).toEqual([5, 6])
    expect(r(0.6, 0.2, 0)).toEqual([4, 5])
    expect(r(0.3, 0.1, 0)).toEqual([3, 4])
  })

  it('judges a thin band from the band above it, for a student on advanced worksheets', () => {
    const rates = bandRates({ '4-5': { got: 0, of: 0, answers: 0 }, '6-7': { got: 2, of: 4, answers: 2 }, '8-9': { got: 36, of: 48, answers: 24 } })
    expect(rates['8-9']).toBe(0.75)
    expect(rates['6-7']).toBeCloseTo(0.9)
    expect(rates['4-5']).toBe(1)
    const w = workingAt(topics, state(attempt('a', '8-9', 24, 18)), NOW)
    expect(w.kind === 'estimate' && [w.low, w.high]).toEqual([8, 9])
  })

  it('says what it rests on, and that it covers the topics studied', () => {
    const w = workingAt(topics, state(attempt('a', '4-5', 12, 12), attempt('b', '6-7', 12, 6)), NOW)
    expect(w.kind).toBe('estimate')
    expect(workingAtNote(w)).toBe('From the newest answers to 24 questions in 2 topics over the last 12 weeks: 100% of grade 4–5 marks, 50% of grade 6–7 marks. It covers the topics studied so far, not the whole course.')
  })
})

describe('target grade (LRN-6)', () => {
  it('keeps the later choice across devices, a clearing included', () => {
    const a = { ...emptyState(), targets: { maths: { grade: 7, at: '2026-11-01T10:00:00Z' }, physics: { grade: 6, at: '2026-11-05T10:00:00Z' } } }
    const b = { ...emptyState(), targets: { maths: { grade: 8, at: '2026-11-02T10:00:00Z' }, physics: { grade: 6, at: '2026-11-06T10:00:00Z', cleared: true } } }
    const m = mergeProgress(a, b)
    expect(targetFor(m, 'maths')).toBe(8)
    expect(targetFor(m, 'physics')).toBeUndefined()
    expect(targetFor(mergeProgress(b, a), 'maths')).toBe(8)
  })

  it('says where the student stands, and which questions carry the marks', () => {
    const est = (low: number, high: number) => ({ kind: 'estimate' as const, low, high, answers: 30, topics: 3, bands: {} as never })
    expect(targetLine(est(7, 8), 7)).toBe('At or above your target of 7.')
    expect(targetLine(est(6, 7), 7)).toBe('Within reach of your target of 7: it sits in the range.')
    expect(targetLine(est(4, 5), 7)).toBe('2 grades below your target of 7. The marks to win are on grade 6–7 questions, as in the Higher worksheets.')
    expect(targetLine(est(4, 5), 7, false)).toMatch(/below the target/)
    expect(targetLine({ kind: 'too-few', answers: 3, need: 17 }, 7)).toBeUndefined()
  })
})
