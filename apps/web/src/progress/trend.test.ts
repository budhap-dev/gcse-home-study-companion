import { describe, expect, it } from 'vitest'
import { emptyState, timeKey, type AttemptRecord, type ProgressState } from './store.ts'
import { subjectTrend, trendWeeks } from './trend.ts'

const quiz = (topicId: string, pct: number, day: string, kind: AttemptRecord['kind'] = 'quiz'): AttemptRecord =>
  ({ id: `${topicId}-${day}-${kind}`, topicId, kind, marksScored: pct, marksAvailable: 100, markedHow: 'auto', completedAt: `${day}T10:00:00.000Z` })

// The test clock is Saturday 26 September 2026: this week began on Monday the 21st, and
// eight weeks back is the week of 3 August.
describe('the eight-week trend', () => {
  it('runs eight Mondays up to this week', () => {
    const weeks = trendWeeks(8)
    expect(weeks.map((w) => w.start)).toEqual(['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21'])
    expect(weeks[0]!.label).toBe('3 Aug')
    expect(weeks[7]!.label).toBe('21 Sept')
  })

  it('gives each subject its minutes and average mark week by week, every week kept', () => {
    const state: ProgressState = {
      ...emptyState(),
      time: {
        [timeKey('2026-09-15', { subjectId: 'maths', topicId: 'surds', kind: 'quiz' })]: 20,
        [timeKey('2026-09-22', { subjectId: 'maths', topicId: 'surds', kind: 'quiz' })]: 45,
        [timeKey('2026-08-04', { subjectId: 'physics', topicId: 'circuit-rules', kind: 'lesson' })]: 30,
        [timeKey('2026-07-30', { subjectId: 'physics', topicId: 'circuit-rules', kind: 'lesson' })]: 99,
      },
      attempts: [quiz('surds', 30, '2026-09-15'), quiz('surds', 50, '2026-09-22'), quiz('surds', 70, '2026-09-23', 'worksheet'), quiz('surds', 10, '2026-09-24', 'review'), quiz('surds', 5, '2026-07-30')],
    }
    const { weeks, subjects } = subjectTrend(state)
    expect(weeks).toHaveLength(8)
    expect(subjects.map((s) => s.subjectId)).toEqual(['maths', 'physics'])
    const maths = subjects[0]!
    expect(maths.weeks).toHaveLength(8)
    expect(maths.weeks[6]).toMatchObject({ start: '2026-09-14', minutes: 20, avgPct: 30, marked: 1 })
    // Quiz 50 and worksheet 70 count; the redo session does not.
    expect(maths.weeks[7]).toMatchObject({ start: '2026-09-21', minutes: 45, avgPct: 60, marked: 2 })
    expect(maths.weeks[0]).toMatchObject({ minutes: 0, marked: 0 })
    expect(maths.weeks[0]!.avgPct).toBeUndefined()
    expect(maths.minutes).toBe(65)
    // 30 July is before the window: neither its minutes nor its mark is counted.
    expect(subjects[1]!.weeks[0]).toMatchObject({ start: '2026-08-03', minutes: 30 })
    expect(subjects[1]!.minutes).toBe(30)
  })

  it('lists nothing for an account with nothing in the window', () => {
    expect(subjectTrend({ ...emptyState(), attempts: [quiz('surds', 80, '2026-06-01')] }).subjects).toEqual([])
  })
})
