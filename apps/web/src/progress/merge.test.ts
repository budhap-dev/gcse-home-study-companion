import { describe, expect, it } from 'vitest'
import { mergeProgress } from './merge.ts'
import { emptyState } from './store.ts'

const attempt = (id: string, at: string, scored = 5) => ({ id, topicId: 't', kind: 'quiz' as const, marksScored: scored, marksAvailable: 10, markedHow: 'auto' as const, completedAt: at })

describe('mergeProgress', () => {
  it('unites attempts by id and keeps the later copy', () => {
    const a = { ...emptyState(), attempts: [attempt('1', '2026-09-01T10:00:00Z'), attempt('2', '2026-09-02T10:00:00Z', 3)] }
    const b = { ...emptyState(), attempts: [attempt('2', '2026-09-02T11:00:00Z', 8), attempt('3', '2026-09-03T10:00:00Z')] }
    const m = mergeProgress(a, b)
    expect(m.attempts.map((x) => x.id)).toEqual(['1', '2', '3'])
    expect(m.attempts[1]!.marksScored).toBe(8)
  })
  it('keeps the furthest lesson step and the earliest completion', () => {
    const a = { ...emptyState(), lessons: { t: { topicId: 't', stepIndex: 3, updatedAt: '2026-09-01T10:00:00Z' } } }
    const b = { ...emptyState(), lessons: { t: { topicId: 't', stepIndex: 8, completedAt: '2026-09-02T10:00:00Z', updatedAt: '2026-09-02T10:00:00Z' } } }
    expect(mergeProgress(a, b).lessons.t).toEqual({ topicId: 't', stepIndex: 8, completedAt: '2026-09-02T10:00:00Z', updatedAt: '2026-09-02T10:00:00Z' })
  })
  it('takes the larger minutes per day rather than adding them', () => {
    const m = mergeProgress({ minutes: { '2026-09-01': 20 } }, { minutes: { '2026-09-01': 30, '2026-09-02': 5 } })
    expect(m.minutes).toEqual({ '2026-09-01': 30, '2026-09-02': 5 })
  })
  it('lets a changed goal win over the default, and unites days off and badges', () => {
    const m = mergeProgress({ goalMinutes: 180, daysOff: ['2026-09-05'], badges: { a: '2026-09-03T00:00:00Z' } }, { goalMinutes: 240, daysOff: ['2026-09-06'], badges: { a: '2026-09-01T00:00:00Z', b: '2026-09-04T00:00:00Z' } })
    expect(m.goalMinutes).toBe(240)
    expect(m.daysOff).toEqual(['2026-09-05', '2026-09-06'])
    expect(m.badges).toEqual({ a: '2026-09-01T00:00:00Z', b: '2026-09-04T00:00:00Z' })
  })
})
