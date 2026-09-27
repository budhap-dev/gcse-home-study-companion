import { describe, expect, it } from 'vitest'
import type { TopicSummary as Topic } from '../content/index.ts'
import { recommend } from './recommend.ts'
import { emptyState, type AttemptRecord } from './store.ts'

const topic = (id: string): Topic => ({
  id, subjectId: 'maths', unitId: 'number', title: id, specPoints: ['N1'], year: 10,
  whyExamples: 0,
  lesson: { steps: [{ id: 's1', kind: 'explain', title: 't' }, { id: 's2', kind: 'grade-9', title: 't' }, { id: 's3', kind: 'summary', title: 't' }] },
  questions: [], worksheets: { core: { questionIds: ['q'], suggestedMinutes: 5 }, higher: { questionIds: ['q'], suggestedMinutes: 10 }, advanced: { questionIds: ['q'], suggestedMinutes: 15 } },
  quiz: { questionIds: ['q'], sampleSize: 10 },
})
const quiz = (topicId: string, pct: number, day: string): AttemptRecord => ({ id: `${topicId}-${day}`, topicId, kind: 'quiz', marksScored: pct, marksAvailable: 100, markedHow: 'auto', completedAt: `${day}T10:00:00.000Z` })
const sheet = (topicId: string, level: 'higher' | 'advanced', pct: number, day: string): AttemptRecord => ({ id: `${topicId}-${level}-${day}`, topicId, kind: 'worksheet', level, marksScored: pct, marksAvailable: 100, markedHow: 'self', completedAt: `${day}T10:00:00.000Z` })
const now = new Date('2026-09-08T12:00:00Z')

describe('recommend', () => {
  const topics = [topic('a'), topic('b'), topic('c')]

  it('starts with the first unstarted lesson when nothing has happened', () => {
    const r = recommend(topics, emptyState(), now)
    expect(r.next).toMatchObject({ kind: 'lesson', topic: { id: 'a' } })
    expect(r.alternatives.map((t) => t.topic.id)).toEqual(['b', 'c'])
  })

  it('prefers an unfinished lesson over everything else', () => {
    const state = { ...emptyState(), lessons: { b: { topicId: 'b', stepIndex: 1, updatedAt: '2026-09-07T10:00:00Z' } }, attempts: [quiz('a', 55, '2026-09-07')] }
    expect(recommend(topics, state, now).next).toMatchObject({ kind: 'lesson', topic: { id: 'b' } })
  })

  it('sends a weak quiz back to the quiz with the score in the reason', () => {
    const state = { ...emptyState(), attempts: [quiz('a', 55, '2026-09-07')] }
    const r = recommend(topics, state, now)
    expect(r.next).toMatchObject({ kind: 'quiz', topic: { id: 'a' } })
    expect(r.next!.reason).toContain('55%')
  })

  it('points a good quiz at the Higher worksheet, and a Secure topic at Advanced', () => {
    const goodQuiz = { ...emptyState(), attempts: [quiz('a', 85, '2026-09-07')] }
    expect(recommend(topics, goodQuiz, now).next).toMatchObject({ kind: 'worksheet', level: 'higher', topic: { id: 'a' } })
    const secure = { ...emptyState(), attempts: [quiz('a', 85, '2026-09-07'), sheet('a', 'higher', 80, '2026-09-07')] }
    expect(recommend(topics, secure, now).next).toMatchObject({ kind: 'worksheet', level: 'advanced', topic: { id: 'a' } })
  })

  it('puts a Secure topic not seen for six weeks up for recap before new lessons', () => {
    const state = { ...emptyState(), attempts: [quiz('a', 85, '2026-07-01'), sheet('a', 'higher', 80, '2026-07-01')] }
    const r = recommend(topics, state, now)
    expect(r.next).toMatchObject({ kind: 'quiz', topic: { id: 'a' } })
    expect(r.next!.reason).toContain('weeks ago')
  })

  it('offers a decayed Mastered topic its recap, not the Advanced sheet it has already passed', () => {
    const mastered = [quiz('a', 95, '2026-07-01'), sheet('a', 'higher', 80, '2026-07-01'), sheet('a', 'advanced', 80, '2026-07-01')]
    const r = recommend(topics, { ...emptyState(), attempts: mastered }, now)
    const forA = [r.next, ...r.alternatives].filter((t) => t?.topic.id === 'a')
    expect(forA).toHaveLength(1)
    expect(forA[0]).toMatchObject({ kind: 'quiz' })
  })
})

describe('the student\'s year', () => {
  it('suggests their own year\'s new topics first, then earlier years, then later', () => {
    const t9 = { ...topic('nine'), year: 9 as const }, t10 = { ...topic('ten'), year: 10 as const }, t11 = { ...topic('eleven'), year: 11 as const }
    const order = (year?: 9 | 10 | 11) => { const r = recommend([t9, t10, t11], { ...emptyState(), profile: year ? { year } : {} }); return [r.next, ...r.alternatives].map((x) => x!.topic.id) }
    expect(order()).toEqual(['nine', 'ten', 'eleven'])
    expect(order(11)).toEqual(['eleven', 'nine', 'ten'])
    expect(order(10)).toEqual(['ten', 'nine', 'eleven'])
  })
})
