import { describe, expect, it } from 'vitest'
import { mistakeQueue } from './mistakes.ts'

let n = 0
const attempt = (topicId: string, at: string, results: [string, boolean, boolean?][], kind = 'quiz') => ({
  id: `a${n++}`, topicId, kind, marksScored: 0, marksAvailable: 0, markedHow: 'auto', completedAt: at,
  questions: results.map(([id, correct, claimed]) => ({ id, skill: 's', gradeBand: '4-5', marksScored: correct ? 1 : 0, marksAvailable: 1, correct, ...(claimed ? { claimed } : {}) })),
}) as never

describe('the questions to redo', () => {
  it('lists wrong answers, newest first', () => {
    const q = mistakeQueue({ attempts: [attempt('t1', '2026-09-01', [['q1', false], ['q2', true]]), attempt('t2', '2026-09-05', [['q9', false]])] })
    expect(q.map((m) => m.questionId)).toEqual(['q9', 'q1'])
  })

  it('drops a question once it is right twice in a row, and not after only once', () => {
    const once = [attempt('t1', '2026-09-01', [['q1', false]]), attempt('t1', '2026-09-02', [['q1', true]], 'review')]
    expect(mistakeQueue({ attempts: once })).toHaveLength(1)
    const twice = [...once, attempt('t1', '2026-09-03', [['q1', true]], 'review')]
    expect(mistakeQueue({ attempts: twice })).toHaveLength(0)
  })

  it('puts a question back when it goes wrong again after being cleared', () => {
    const attempts = [attempt('t1', '2026-09-01', [['q1', false]]), attempt('t1', '2026-09-02', [['q1', true]]), attempt('t1', '2026-09-03', [['q1', true]]), attempt('t1', '2026-09-04', [['q1', false]])]
    expect(mistakeQueue({ attempts }).map((m) => m.wrongAt)).toEqual(['2026-09-04'])
  })

  it('counts a claimed answer as right', () => {
    const attempts = [attempt('t1', '2026-09-01', [['q1', false]]), attempt('t1', '2026-09-02', [['q1', false, true]]), attempt('t1', '2026-09-03', [['q1', true]])]
    expect(mistakeQueue({ attempts })).toHaveLength(0)
  })

  it('keeps apart the same question id in two topics, filters, and stops at the limit', () => {
    const attempts = [attempt('t1', '2026-09-01', [['q1', false]]), attempt('t2', '2026-09-02', [['q1', false]])]
    expect(mistakeQueue({ attempts })).toHaveLength(2)
    expect(mistakeQueue({ attempts }, (t) => t === 't2').map((m) => m.topicId)).toEqual(['t2'])
    const many = [attempt('t3', '2026-09-03', Array.from({ length: 30 }, (_, i) => [`q${i}`, false] as [string, boolean]))]
    expect(mistakeQueue({ attempts: many })).toHaveLength(15)
  })
})
