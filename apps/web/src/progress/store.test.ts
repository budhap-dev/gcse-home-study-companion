import { describe, expect, it } from 'vitest'
import { decayNote, emptyState, evidenceFor, type AttemptRecord } from './store.ts'

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

/**
 * PRD section 6 and apply_decay(): one step down per six weeks untouched, never below
 * Developing. Before this, a Secure topic stayed Secure however long it was left.
 */
describe('evidenceFor applies the six-week decay', () => {
  const mastered = [quiz(95, 1), sheet('higher', 80, 2), sheet('advanced', 80, 3)]
  const secure = [quiz(90, 1), sheet('higher', 80, 2)]
  const weeksAfter = (n: number, weeks: number) => new Date(new Date(at(n)).getTime() + weeks * 7 * 86400000)

  it('leaves a topic alone inside six weeks', () => {
    const e = evidenceFor('t', { ...emptyState(), attempts: mastered }, weeksAfter(3, 5.9))
    expect(e.status).toBe('grade-9-ready')
    expect(e.decayedFrom).toBeUndefined()
  })

  it('steps Mastered to Secure after six weeks, and to Developing after twelve', () => {
    expect(evidenceFor('t', { ...emptyState(), attempts: mastered }, weeksAfter(3, 6)).status).toBe('secure')
    const e = evidenceFor('t', { ...emptyState(), attempts: mastered }, weeksAfter(3, 12))
    expect(e.status).toBe('developing')
    expect(e.decayedFrom).toBe('grade-9-ready')
    expect(e.idleWeeks).toBe(12)
  })

  it('steps Secure to Developing, and no lower however long it is left', () => {
    expect(evidenceFor('t', { ...emptyState(), attempts: secure }, weeksAfter(2, 6)).status).toBe('developing')
    expect(evidenceFor('t', { ...emptyState(), attempts: secure }, weeksAfter(2, 60)).status).toBe('developing')
  })

  it('does not touch Developing or Not secure', () => {
    expect(evidenceFor('t', { ...emptyState(), attempts: [quiz(60, 1)] }, weeksAfter(1, 30)).status).toBe('developing')
    expect(evidenceFor('t', { ...emptyState(), attempts: [quiz(30, 1)] }, weeksAfter(1, 30)).status).toBe('not-secure')
  })

  it('counts lesson progress as a revisit', () => {
    const lessons = { t: { topicId: 't', stepIndex: 2, updatedAt: weeksAfter(3, 5).toISOString() } }
    expect(evidenceFor('t', { ...emptyState(), attempts: mastered, lessons }, weeksAfter(3, 8)).status).toBe('grade-9-ready')
  })

  it('tells the student why the status fell, and only when it did', () => {
    expect(decayNote(evidenceFor('t', { ...emptyState(), attempts: mastered }, weeksAfter(3, 7)))).toBe('Was Mastered, but not visited for 7 weeks. A quiz brings it back.')
    expect(decayNote(evidenceFor('t', { ...emptyState(), attempts: mastered }, weeksAfter(3, 2)))).toBeUndefined()
  })

  it('is lifted by a fresh quiz, which restores what the scores earned', () => {
    const later = new Date(weeksAfter(3, 10)).toISOString()
    const back = [...mastered, { ...quiz(95, 1), id: 'again', completedAt: later }]
    expect(evidenceFor('t', { ...emptyState(), attempts: back }, weeksAfter(3, 10.5)).status).toBe('grade-9-ready')
  })
})

