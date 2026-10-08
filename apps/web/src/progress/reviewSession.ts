import { describeAnswer, type MarkResult, type Question, type Topic } from '@study/shared'
import type { Answer } from '../components/questions/QuestionInput.tsx'
import { recordAttempt, type AttemptRecord } from './store.ts'
import { xpForQuestions } from './xp.ts'

/** One question in a session that spans topics: Redo my mistakes, or the daily recap. */
export interface SessionItem { topicId: string; questionId: string }
export type SessionAnswers = Record<string, { answer: Answer; result: MarkResult }>

export const itemKey = (m: SessionItem) => `${m.topicId}/${m.questionId}`

/**
 * Records a finished session as one review attempt per topic, so each topic keeps its own
 * history. It earns XP and counts as study; it never moves a topic's status. A question
 * left unanswered counts as wrong.
 *
 * A mixed worksheet shows generated questions, so it passes `seen` (the question as asked,
 * for describing the answer) and `seed` (stored, so the parent's breakdown rebuilds them).
 */
export function recordReview(sessionId: string, items: SessionItem[], answers: SessionAnswers, topicById: (id: string) => Topic | undefined, finishedAt: string, from?: AttemptRecord['from'], asked?: { seen: (m: SessionItem) => Question | undefined; seed: string }) {
  const byTopic = new Map<string, SessionItem[]>()
  for (const m of items) byTopic.set(m.topicId, [...(byTopic.get(m.topicId) ?? []), m])
  for (const [topicId, its] of byTopic) {
    const t = topicById(topicId)
    if (!t) continue
    const results = its.flatMap((m) => {
      const q = asked?.seen(m) ?? t.questions.find((x) => x.id === m.questionId)
      if (!q) return []
      const a = answers[itemKey(m)]
      const r = a?.result ?? { correct: false, marksScored: 0, marksAvailable: q.marks }
      return [{ id: q.id, skill: q.skill, gradeBand: q.gradeBand, marksScored: r.marksScored, marksAvailable: r.marksAvailable, correct: r.correct, answer: describeAnswer(q, a?.answer), ...(r.claimed ? { claimed: true } : {}) }]
    })
    if (!results.length) continue
    recordAttempt({
      id: `${sessionId}:${topicId}`,
      topicId,
      kind: 'review',
      ...(from ? { from } : {}),
      marksScored: results.reduce((s, r) => s + r.marksScored, 0),
      marksAvailable: results.reduce((s, r) => s + r.marksAvailable, 0),
      markedHow: results.some((r) => r.claimed) ? 'mixed' : 'auto',
      completedAt: finishedAt,
      xp: xpForQuestions(results),
      questions: results,
      ...(asked ? { seed: asked.seed } : {}),
    })
  }
}
