import { describe, expect, it } from 'vitest'
import { emptyState, evidenceFor, type AttemptRecord } from './store.ts'

const at = (n: number) => new Date(2026, 8, n).toISOString()
const quiz = (pct: number, n: number, g89?: [number, number]): AttemptRecord => ({
  id: `q${n}`, topicId: 't', kind: 'quiz', marksScored: pct, marksAvailable: 100, markedHow: 'auto', completedAt: at(n),
  ...(g89 ? { grade89Scored: g89[0], grade89Available: g89[1] } : {}),
})
const sheet = (level: 'higher' | 'advanced', pct: number, n: number): AttemptRecord => ({
  id: `${level}${n}`, topicId: 't', kind: 'worksheet', level, marksScored: pct, marksAvailable: 100, markedHow: 'self', completedAt: at(n),
})

/** Mirrors the pgTAP cases in supabase/tests/database/001_policies.test.sql. */
describe('evidenceFor mirrors compute_topic_status', () => {
  it('nothing done is Not secure; a finished lesson alone is Developing', () => {
    expect(evidenceFor('t', { ...emptyState() }).status).toBe('not-secure')
    expect(evidenceFor('t', { ...emptyState(), lessons: { t: { topicId: 't', stepIndex: 9, completedAt: at(1), updatedAt: at(1) } } }).status).toBe('developing')
  })
  it('a 90% quiz with no Higher worksheet is Developing, not Secure', () => {
    expect(evidenceFor('t', { ...emptyState(), attempts: [quiz(90, 1)], }).status).toBe('developing')
  })
  it('quiz 90% and Higher 80% is Secure; adding Advanced 80% is Mastered', () => {
    expect(evidenceFor('t', { ...emptyState(), attempts: [quiz(90, 1), sheet('higher', 80, 2)], }).status).toBe('secure')
    expect(evidenceFor('t', { ...emptyState(), attempts: [quiz(90, 1), sheet('higher', 80, 2), sheet('advanced', 80, 3)], }).status).toBe('grade-9-ready')
  })
  it('Mastered also needs the grade 8 to 9 questions at 90%', () => {
    const weakOn89 = quiz(90, 1, [6, 10])
    expect(evidenceFor('t', { ...emptyState(), attempts: [weakOn89, sheet('higher', 80, 2), sheet('advanced', 80, 3)], }).status).toBe('secure')
  })
  it('uses the latest attempt, so a topic can go down', () => {
    expect(evidenceFor('t', { ...emptyState(), attempts: [quiz(95, 1), sheet('higher', 80, 2), quiz(40, 3)], }).status).toBe('not-secure')
  })
  it('a quiz under 50% is Not secure', () => {
    expect(evidenceFor('t', { ...emptyState(), attempts: [quiz(45, 1)], }).status).toBe('not-secure')
  })
})
