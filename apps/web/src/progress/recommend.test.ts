import { describe, expect, it } from 'vitest'
import type { Topic } from '@study/shared'
import { recommend } from './recommend.ts'
import { emptyState, type AttemptRecord } from './store.ts'

const topic = (id: string): Topic => ({
  id, subjectId: 'maths', unitId: 'number', title: id, specPoints: ['N1'],
  lesson: { steps: [{ id: 's1', kind: 'explain', title: 't', body: 'b', visuals: [{ type: 'diagram', component: 'x', props: {}, alt: 'a' }] }, { id: 's2', kind: 'grade-9', title: 't', body: 'b', visuals: [{ type: 'diagram', component: 'x', props: {}, alt: 'a' }] }, { id: 's3', kind: 'summary', title: 't', body: 'b', visuals: [{ type: 'diagram', component: 'x', props: {}, alt: 'a' }] }] },
  questions: [], worksheets: { core: { level: 'core', questionIds: ['q'], suggestedMinutes: 5 }, higher: { level: 'higher', questionIds: ['q'], suggestedMinutes: 10 }, advanced: { level: 'advanced', questionIds: ['q'], suggestedMinutes: 15 } },
  examTechnique: { body: 'b', examinerErrors: ['e'], grade9Looks: 'g' }, quiz: { questionIds: ['q'], sampleSize: 10 },
  provenance: { draftedBy: { kind: 'person', name: 'n' } },
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
})
