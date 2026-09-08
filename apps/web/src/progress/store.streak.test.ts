import { describe, expect, it } from 'vitest'
import { emptyState, streakDays, weekDays, weekMinutes } from './store.ts'

const attempt = (day: string) => ({ id: day, topicId: 't', kind: 'quiz' as const, marksScored: 1, marksAvailable: 1, markedHow: 'auto' as const, completedAt: `${day}T10:00:00.000Z` })

describe('streakDays', () => {
  it('counts consecutive active days back from today', () => {
    const s = { ...emptyState(), attempts: [attempt('2026-09-06'), attempt('2026-09-07'), attempt('2026-09-08')] }
    expect(streakDays(s, '2026-09-08')).toBe(3)
  })
  it('stays alive today if yesterday was active', () => {
    const s = { ...emptyState(), attempts: [attempt('2026-09-07')] }
    expect(streakDays(s, '2026-09-08')).toBe(1)
  })
  it('skips days off without breaking', () => {
    const s = { ...emptyState(), attempts: [attempt('2026-09-05'), attempt('2026-09-07')], daysOff: ['2026-09-06'] }
    expect(streakDays(s, '2026-09-07')).toBe(2)
  })
  it('breaks on an inactive day that is not off', () => {
    const s = { ...emptyState(), attempts: [attempt('2026-09-05'), attempt('2026-09-07')] }
    expect(streakDays(s, '2026-09-07')).toBe(1)
  })
})

describe('week', () => {
  it('runs Monday to Sunday and sums minutes', () => {
    expect(weekDays('2026-09-09')).toEqual(['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'])
    const s = { ...emptyState(), minutes: { '2026-09-06': 50, '2026-09-07': 20, '2026-09-09': 25 } }
    expect(weekMinutes(s, '2026-09-09')).toBe(45)
  })
})
