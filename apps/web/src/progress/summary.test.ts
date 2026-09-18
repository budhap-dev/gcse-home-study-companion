import { describe, expect, it } from 'vitest'
import { activeDates, parentSummary } from './summary.ts'
import { emptyState, type AttemptRecord, type ProgressState } from './store.ts'

const q = (skill: string, correct: boolean) => ({ id: skill, skill, gradeBand: '6-7' as const, correct, marksScored: correct ? 2 : 0, marksAvailable: 2 })
const quiz = (topicId: string, pct: number, day: string, questions = [q('s', pct >= 50)]): AttemptRecord => ({
  id: `${topicId}-${day}-${pct}`, topicId, kind: 'quiz', marksScored: pct, marksAvailable: 100, markedHow: 'auto', completedAt: `${day}T10:00:00.000Z`, questions,
})
const lesson = (topicId: string, day: string, done = true) => ({ topicId, stepIndex: 5, completedAt: done ? `${day}T09:00:00.000Z` : undefined, updatedAt: `${day}T09:00:00.000Z` })
const state = (over: Partial<ProgressState>): ProgressState => ({ ...emptyState(), ...over })

describe('activeDates', () => {
  it('counts attempts, finished lessons and days with study minutes', () => {
    const s = state({
      attempts: [quiz('surds', 70, '2026-09-01')],
      lessons: { surds: lesson('surds', '2026-09-02') },
      minutes: { '2026-09-03': 20, '2026-09-04': 0 },
    })
    expect(activeDates(s)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
  })
})

describe('parentSummary', () => {
  it('reports when the student last did anything, in days', () => {
    const s = state({ attempts: [quiz('surds', 70, '2026-09-10')] })
    const out = parentSummary(s, '2026-09-18')
    expect(out.lastActive).toBe('2026-09-10')
    expect(out.daysSinceActive).toBe(8)
  })

  it('leaves last active undefined when nothing has been done', () => {
    const out = parentSummary(emptyState(), '2026-09-18')
    expect(out.lastActive).toBeUndefined()
    expect(out.daysSinceActive).toBeUndefined()
    expect(out.averageQuizPct).toBeUndefined()
    expect(out.stuck).toEqual([])
  })

  it('averages the last ten quizzes and shows no trend until there are six', () => {
    const five = ['01', '02', '03', '04', '05'].map((d) => quiz('surds', 40, `2026-09-${d}`))
    expect(parentSummary(state({ attempts: five }), '2026-09-18').trend).toBeUndefined()
    // A sixth quiz gives the last five something to be compared against.
    const six = [...five, quiz('surds', 90, '2026-09-06')]
    const out = parentSummary(state({ attempts: six }), '2026-09-18')
    // Last five are 40, 40, 40, 40, 90 (mean 50) against the one before them, 40.
    expect(out.trend).toBe(10)
    expect(out.averageQuizPct).toBe(Math.round((40 * 5 + 90) / 6))
    expect(out.quizCount).toBe(6)
  })

  /**
   * The list a parent acts on. A topic is only stuck if work went in and did not come
   * good; a topic never opened is not stuck, and letting those in would bury the few
   * that need a conversation under the whole syllabus.
   */
  it('lists topics where work went in and the score stayed low', () => {
    const s = state({
      attempts: [quiz('surds', 30, '2026-09-10'), quiz('laws-of-indices', 95, '2026-09-11')],
      lessons: { surds: lesson('surds', '2026-09-09'), 'standard-form': lesson('standard-form', '2026-09-12') },
    })
    const out = parentSummary(s, '2026-09-18')
    expect(out.stuck.map((x) => [x.topicId, x.reason])).toEqual([
      ['surds', 'low-score'],
      ['standard-form', 'no-quiz'],
    ])
    expect(out.stuck[0]!.pct).toBe(30)
    // The topic that went well is not on the list, and nor is anything untouched.
    expect(out.stuck.some((x) => x.topicId === 'laws-of-indices')).toBe(false)
  })

  it('counts a part-read lesson as started but never as stuck', () => {
    const s = state({ lessons: { surds: lesson('surds', '2026-09-10', false) } })
    const out = parentSummary(s, '2026-09-18')
    expect(out.topicsStarted).toBe(1)
    expect(out.stuck).toEqual([])
  })

  it('counts this week against the goal, and days actually studied', () => {
    // 2026-09-18 is a Friday, so its week runs Monday the 14th to Sunday the 20th.
    const s = state({ minutes: { '2026-09-14': 30, '2026-09-16': 45, '2026-09-07': 60 }, goalMinutes: 180 })
    const out = parentSummary(s, '2026-09-18')
    expect(out.weekMinutes).toBe(75)
    expect(out.activeDays).toBe(2)
    expect(out.goalMinutes).toBe(180)
  })

  it('breaks the syllabus down by subject, counting only subjects with content', () => {
    const s = state({ attempts: [quiz('surds', 95, '2026-09-10')] })
    const maths = parentSummary(s, '2026-09-18').subjects.find((x) => x.id === 'maths')!
    expect(maths.total).toBeGreaterThan(40)
    expect(maths.started).toBe(1)
    expect(maths.lastActive).toBe('2026-09-10')
    // Only started topics are given a status; the rest are counted as not started, so an
    // untouched subject does not read as a subject that is going badly.
    expect(maths.notStarted).toBe(maths.total - 1)
    expect(Object.values(maths.counts).reduce((a, b) => a + b, 0)).toBe(maths.started)
    expect(maths.counts['not-secure']).toBe(0)
    const physics = parentSummary(s, '2026-09-18').subjects.find((x) => x.id === 'physics')!
    expect(physics.started).toBe(0)
    expect(Object.values(physics.counts).every((n) => n === 0)).toBe(true)
  })
})
