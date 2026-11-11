import type { Question } from '@study/shared'
import { describe, expect, it } from 'vitest'
import { paperAnswers, type PaperQuestion, type PaperState } from './PaperSession.tsx'

const base = { prompt: 'p', gradeBand: '6-7', skill: 's', calculator: 'either', tags: [], solution: 's', markScheme: [{ code: 'B1', marks: 1, description: 'd' }], discriminators: [] }
const mcq = { ...base, id: 'm', type: 'multiple-choice', marks: 1, options: ['a', 'b'], correct: [0] } as unknown as Question
const essay = { ...base, id: 'e', type: 'extended', marks: 4, suggestedMinutes: 6, modelAnswer: 'x', criteria: [{ text: 'a', marks: 2 }, { text: 'b', marks: 2 }, { text: 'c', marks: 1 }] } as unknown as Question
const questions: PaperQuestion[] = [{ item: { topicId: 't', questionId: 'm' }, question: mcq }, { item: { topicId: 't', questionId: 'e' }, question: essay }]
const state = (ticks: boolean[] = []): PaperState => ({
  path: '/p', id: 'id', index: 0, texts: {}, onPaper: {}, spent: {}, viewSince: 0, startedAt: 0,
  answers: { 't/m': { answer: [0], result: { correct: true, marksScored: 1, marksAvailable: 1 } } }, ticks: { 't/e': ticks },
})

describe('marks from a handed-in paper', () => {
  it('keeps the marker’s result for a question the app marks', () => {
    expect(paperAnswers(state(), questions)['t/m']?.result.marksScored).toBe(1)
  })

  it('scores a written answer from the criteria ticked, as self-marked, never above its marks', () => {
    expect(paperAnswers(state(), questions)['t/e']).toMatchObject({ self: true, result: { marksScored: 0, marksAvailable: 4 } })
    expect(paperAnswers(state([true, false, true]), questions)['t/e']?.result.marksScored).toBe(3)
    expect(paperAnswers(state([true, true, true]), questions)['t/e']?.result).toEqual({ correct: true, marksScored: 4, marksAvailable: 4 })
  })

  it('leaves an unanswered question out, so it records as wrong', () => {
    const s = { ...state(), answers: {} }
    expect(paperAnswers(s, questions)['t/m']).toBeUndefined()
  })
})
