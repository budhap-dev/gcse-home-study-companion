import { describe, expect, it } from 'vitest'
import { TOPICS } from '../content/index.ts'
import { RECAP_SIZE, recapDoneToday, recapItems, studied } from './recap.ts'
import { emptyState, type AttemptRecord, type ProgressState } from './store.ts'
import { todayPlan } from './today.ts'

const [a, b, c] = TOPICS.filter((t) => t.subjectId === 'maths')
const physics = TOPICS.find((t) => t.subjectId === 'physics')!
const now = new Date('2026-10-06T12:00:00Z')
const lessonDone = (id: string, at: string) => ({ [id]: { topicId: id, stepIndex: 5, completedAt: at, updatedAt: at } })
const quiz = (topicId: string, at: string, questions: AttemptRecord['questions'] = []): AttemptRecord =>
  ({ id: `${topicId}-${at}`, topicId, kind: 'quiz', marksScored: 5, marksAvailable: 10, markedHow: 'auto', completedAt: at, questions })
const result = (id: string, correct: boolean) => ({ id, skill: 's', gradeBand: '4-5' as const, marksScored: correct ? 1 : 0, marksAvailable: 1, correct })

const twoTopics: ProgressState = {
  ...emptyState(),
  lessons: { ...lessonDone(a!.id, '2026-09-20T10:00:00Z'), ...lessonDone(physics.id, '2026-09-10T10:00:00Z') },
}

describe('the daily recap', () => {
  it('waits until two topics are studied, and a half-done lesson does not count', () => {
    const one: ProgressState = { ...emptyState(), lessons: { ...lessonDone(a!.id, '2026-09-20T10:00:00Z'), [b!.id]: { topicId: b!.id, stepIndex: 2, updatedAt: '2026-09-20T10:00:00Z' } } }
    expect(studied(TOPICS, one)).toHaveLength(1)
    expect(recapItems(TOPICS, one, now)).toEqual([])
  })

  it('asks five questions the app can mark, alternating topics, the longest unseen first', () => {
    const items = recapItems(TOPICS, twoTopics, now)
    expect(items).toHaveLength(RECAP_SIZE)
    expect(items.map((i) => i.topicId)).toEqual([physics.id, a!.id, physics.id, a!.id, physics.id])
    expect(new Set(items.map((i) => `${i.topicId}/${i.questionId}`)).size).toBe(RECAP_SIZE)
    for (const i of items) {
      const q = TOPICS.find((t) => t.id === i.topicId)!.questions.find((x) => x.id === i.questionId)!
      expect(q.type).not.toBe('extended')
    }
  })

  it('gives the same mix all day', () => {
    expect(recapItems(TOPICS, twoTopics, now)).toEqual(recapItems(TOPICS, twoTopics, new Date('2026-10-06T19:00:00Z')))
  })

  it('puts a topic studied today last, since it is fresh already', () => {
    const state: ProgressState = { ...twoTopics, lessons: { ...twoTopics.lessons, ...lessonDone(c!.id, '2026-10-06T09:00:00Z') } }
    const order = [...new Set(recapItems(TOPICS, state, now).map((i) => i.topicId))]
    expect(order.at(-1)).toBe(c!.id)
  })

  it("asks first a question the student last got wrong, then one they have not met", () => {
    const qs = physics.questions.filter((q) => q.type !== 'extended')
    const wrong = qs[3]!.id
    const state: ProgressState = { ...twoTopics, attempts: [quiz(physics.id, '2026-09-10T11:00:00Z', [result(qs[0]!.id, true), result(wrong, false)])] }
    const mine = recapItems(TOPICS, state, now).filter((i) => i.topicId === physics.id).map((i) => i.questionId)
    expect(mine[0]).toBe(wrong)
    expect(mine).not.toContain(qs[0]!.id)
  })

  it('leaves out questions already asked today, for another five', () => {
    const first = recapItems(TOPICS, twoTopics, now)
    const again = recapItems(TOPICS, twoTopics, now, new Set(first.map((i) => `${i.topicId}/${i.questionId}`)))
    expect(again).toHaveLength(RECAP_SIZE)
    for (const i of again) expect(first).not.toContainEqual(i)
  })

  it('knows when it was done today', () => {
    const done: AttemptRecord = { ...quiz(a!.id, '2026-10-06T08:00:00Z'), kind: 'review', from: 'recap' }
    expect(recapDoneToday({ ...twoTopics, attempts: [done] }, '2026-10-06')).toBe(true)
    expect(recapDoneToday({ ...twoTopics, attempts: [done] }, '2026-10-07')).toBe(false)
    expect(recapDoneToday({ ...twoTopics, attempts: [{ ...done, from: undefined }] }, '2026-10-06')).toBe(false)
  })

  it("takes Home's recap slot until it is done, then gives it back to mistakes", () => {
    const plan = todayPlan(TOPICS, twoTopics, [], 3, now)
    expect(plan.find((p) => p.label === 'Recap')?.to).toBe('/recap')
    const done: AttemptRecord = { ...quiz(a!.id, '2026-10-06T08:00:00Z'), kind: 'review', from: 'recap' }
    const after = todayPlan(TOPICS, { ...twoTopics, attempts: [done] }, [], 3, now)
    expect(after.find((p) => p.label === 'Recap')?.to).toBe('/mistakes')
  })
})
