import { beforeEach, describe, expect, it } from 'vitest'
import { emptyState, withoutTopics, type AttemptRecord, type ProgressState } from './store.ts'

const at = (n: number) => new Date(2026, 8, n).toISOString()
const attempt = (topicId: string, n: number): AttemptRecord => ({
  id: `a${n}`, topicId, kind: 'quiz', marksScored: 8, marksAvailable: 10, markedHow: 'auto', completedAt: at(n),
})
const lesson = (topicId: string, n: number) => ({ topicId, stepIndex: 3, updatedAt: at(n) })

/**
 * Resetting one topic must not cost the student anything they earned elsewhere. Study
 * minutes, the weekly goal, days off and badges belong to the student rather than to a
 * topic — the minutes were still studied and the streak was still kept — so a topic reset
 * leaves them alone and clears only that topic's attempts and lesson position.
 */
describe('withoutTopics', () => {
  let state: ProgressState
  beforeEach(() => {
    state = {
      ...emptyState(),
      attempts: [attempt('alpha', 1), attempt('beta', 2), attempt('alpha', 3), attempt('gamma', 4)],
      lessons: { alpha: lesson('alpha', 1), beta: lesson('beta', 2) },
      minutes: { '2026-09-16': 40 },
      goalMinutes: 120,
      daysOff: ['2026-09-14'],
      badges: { firstQuiz: at(1) },
    }
  })

  it('removes every attempt for the named topics and leaves the others', () => {
    expect(withoutTopics(state, ['alpha']).attempts.map((a) => a.topicId)).toEqual(['beta', 'gamma'])
  })

  it('removes the lesson position for the named topics only', () => {
    expect(Object.keys(withoutTopics(state, ['alpha']).lessons)).toEqual(['beta'])
  })

  it('clears several topics at once, for a year or a whole subject', () => {
    const after = withoutTopics(state, ['alpha', 'beta', 'gamma'])
    expect(after.attempts).toEqual([])
    expect(after.lessons).toEqual({})
  })

  it('keeps minutes, goal, days off and badges, which are not a topic\'s to lose', () => {
    const after = withoutTopics(state, ['alpha', 'beta', 'gamma'])
    expect(after.minutes).toEqual({ '2026-09-16': 40 })
    expect(after.goalMinutes).toBe(120)
    expect(after.daysOff).toEqual(['2026-09-14'])
    expect(after.badges).toEqual({ firstQuiz: at(1) })
  })

  it('does nothing when the topic has no progress, or the list is empty', () => {
    const before = JSON.stringify(state)
    expect(JSON.stringify(withoutTopics(state, ['never-studied']))).toBe(before)
    expect(JSON.stringify(withoutTopics(state, []))).toBe(before)
  })
})
