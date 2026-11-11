import { describe, expect, it } from 'vitest'
import { TOPICS } from '../content/index.ts'
import { RECAP_MAX, RECAP_SIZE, recapItems } from './recap.ts'
import { dueQuestions, INTERVALS, schedule, skillScores, weakestSkills } from './spaced.ts'
import { emptyState, type AttemptRecord, type ProgressState, type QuestionResult } from './store.ts'

const DAY = 86400000
const r = (id: string, correct: boolean, skill = 's', got = correct ? 2 : 0): QuestionResult => ({ id, skill, gradeBand: '6-7', marksScored: got, marksAvailable: 2, correct })
let n = 0
const at = (topicId: string, when: string, questions: QuestionResult[]): AttemptRecord =>
  ({ id: `a${n++}`, topicId, kind: 'quiz', marksScored: 0, marksAvailable: 0, markedHow: 'auto', completedAt: when, questions })
const state = (...attempts: AttemptRecord[]): ProgressState => ({ ...emptyState(), attempts })

describe('the review schedule (TRK-3)', () => {
  it('moves a question up a box for each right answer on a new day, and waits longer each time', () => {
    const s = schedule(state(at('t', '2026-11-01T10:00:00Z', [r('q', true)]), at('t', '2026-11-04T10:00:00Z', [r('q', true)]), at('t', '2026-11-11T10:00:00Z', [r('q', true)])))
    const q = s.get('t/q')!
    expect(q.box).toBe(3)
    expect(q.due.getTime() - Date.parse('2026-11-11T10:00:00Z')).toBe(INTERVALS[3] * DAY)
  })

  it('counts two right answers on one day as one recall', () => {
    const s = schedule(state(at('t', '2026-11-01T10:00:00Z', [r('q', true)]), at('t', '2026-11-01T18:00:00Z', [r('q', true)])))
    expect(s.get('t/q')!.box).toBe(1)
  })

  it('starts a wrong answer again, due the next day, and drops part marks one box', () => {
    const wrong = schedule(state(at('t', '2026-11-01T10:00:00Z', [r('q', true)]), at('t', '2026-11-05T10:00:00Z', [r('q', true)]), at('t', '2026-11-10T10:00:00Z', [r('q', false)])))
    expect(wrong.get('t/q')).toMatchObject({ box: 0, due: new Date(Date.parse('2026-11-10T10:00:00Z') + DAY) })
    const part = schedule(state(at('t', '2026-11-01T10:00:00Z', [r('q', true)]), at('t', '2026-11-05T10:00:00Z', [r('q', true)]), at('t', '2026-11-10T10:00:00Z', [r('q', false, 's', 1)])))
    expect(part.get('t/q')!.box).toBe(1)
  })

  it('lists what is due, most overdue for its box first, and only questions the app marks', () => {
    const t = TOPICS.find((x) => x.subjectId === 'maths')!
    const [q1, q2] = t.questions.filter((q) => q.type !== 'extended')
    const essay = TOPICS.flatMap((x) => x.questions.filter((q) => q.type === 'extended').map((q) => ({ t: x, q })))[0]!
    const s = state(
      at(t.id, '2026-11-01T10:00:00Z', [r(q1!.id, true)]),
      at(t.id, '2026-11-09T10:00:00Z', [r(q2!.id, false)]),
      at(essay.t.id, '2026-10-01T10:00:00Z', [r(essay.q.id, false)]),
    )
    // q1: box 1, due 4 November, a week late for a 3-day gap (2.4 gaps). q2: box 0, due
    // yesterday for a 1-day gap (1.1 gaps). The essay is never asked: the app cannot mark it.
    const due = dueQuestions(TOPICS, s, new Date('2026-11-11T12:00:00Z'))
    expect(due.map((d) => d.questionId)).toEqual([q1!.id, q2!.id])
  })
})

describe('the daily recap with the schedule', () => {
  const maths = TOPICS.filter((t) => t.subjectId === 'maths').slice(0, 3)
  const now = new Date('2026-11-11T12:00:00Z')

  it('asks what is due first, and grows to ten when more are due', () => {
    const wrongs = maths.map((t) => at(t.id, '2026-11-01T10:00:00Z', t.questions.filter((q) => q.type !== 'extended').slice(0, 4).map((q) => r(q.id, false))))
    const items = recapItems(TOPICS, state(...wrongs), now)
    expect(items).toHaveLength(RECAP_MAX)
    const due = new Set(dueQuestions(TOPICS, state(...wrongs), now).map((d) => `${d.topicId}/${d.questionId}`))
    for (const m of items) expect(due.has(`${m.topicId}/${m.questionId}`)).toBe(true)
    expect(items.slice(0, 3).map((m) => m.topicId).sort()).toEqual(maths.map((t) => t.id).sort())
  })

  it('tops up by need when fewer than five are due', () => {
    const one = maths.map((t, i) => at(t.id, i === 0 ? '2026-11-01T10:00:00Z' : '2026-11-11T09:00:00Z', [r(t.questions.find((q) => q.type !== 'extended')!.id, i !== 0)]))
    const items = recapItems(TOPICS, state(...one), now)
    expect(items).toHaveLength(RECAP_SIZE)
    expect(items[0]).toEqual({ topicId: maths[0]!.id, questionId: maths[0]!.questions.find((q) => q.type !== 'extended')!.id })
  })
})

describe('mastery per skill (TRK-2)', () => {
  const now = new Date('2026-11-11T12:00:00Z')

  it('counts newer answers for more', () => {
    const s = state(at('t', '2026-09-01T10:00:00Z', [r('a', true, 'fractions'), r('b', true, 'fractions')]), at('t', '2026-11-10T10:00:00Z', [r('c', false, 'fractions')]))
    const [f] = skillScores('t', s, now)
    expect(f!.answers).toBe(3)
    expect(f!.score).toBeLessThan(0.1)
  })

  it('lists up to three weak skills, weakest first, and none that are strong', () => {
    const s = state(at('t', '2026-11-10T10:00:00Z', [r('a', false, 'one'), r('b', true, 'two'), r('c', false, 'three', 1), r('d', false, 'four'), r('e', false, 'five'), r('f', true, 'six')]))
    const weak = weakestSkills('t', s, now)
    expect(weak).toHaveLength(3)
    expect(weak.map((w) => w.skill)).not.toContain('two')
    expect(weak.map((w) => w.score)).toEqual([...weak.map((w) => w.score)].sort((a, b) => a - b))
  })
})
