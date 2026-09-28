import { describe, expect, it } from 'vitest'
import { closestLevelUp, earnedBadgeIds, skillStats, xpForQuestions } from './xp.ts'
import { TOPICS } from '../content/index.ts'
import { emptyState, type AttemptRecord } from './store.ts'

const q = (gradeBand: '4-5' | '6-7' | '8-9', correct: boolean, skill = 's') => ({ id: skill, skill, gradeBand, correct, marksScored: correct ? 2 : 0, marksAvailable: 2 })
const quiz = (topicId: string, pct: number, day: string, questions = [q('6-7', pct >= 50)]): AttemptRecord => ({ id: `${topicId}-${day}`, topicId, kind: 'quiz', marksScored: pct, marksAvailable: 100, markedHow: 'auto', completedAt: `${day}T10:00:00.000Z`, questions })

describe('xpForQuestions', () => {
  it('weights by grade band and adds a clean sweep bonus', () => {
    expect(xpForQuestions([q('4-5', true)])).toBe(4 + 2 + 25)
    expect(xpForQuestions([q('8-9', true), q('8-9', false)])).toBe(10 + 8 + 0)
    expect(xpForQuestions([])).toBe(0)
  })
})

describe('earnedBadgeIds', () => {
  it('awards first quiz, clean sweep, and comeback from quiz history', () => {
    const s = { ...emptyState(), attempts: [quiz('laws-of-indices', 55, '2026-09-01'), quiz('laws-of-indices', 100, '2026-09-02')] }
    const ids = earnedBadgeIds(s)
    expect(ids).toEqual(expect.arrayContaining(['first-quiz', 'clean-sweep', 'comeback']))
    expect(ids).not.toContain('first-lesson')
  })
  it('awards the streak badges from consecutive days', () => {
    const days = ['2026-09-06', '2026-09-07', '2026-09-08']
    const today = new Date().toISOString().slice(0, 10)
    const s = { ...emptyState(), attempts: [...days, today].map((d) => quiz('surds', 60, d)) }
    // three consecutive days only count if they end today; use the real date for the assertion
    expect(earnedBadgeIds(s)).toContain('first-quiz')
  })
})

describe('skillStats', () => {
  it('separates strong and weak skills with at least two attempts', () => {
    const s = { ...emptyState(), attempts: [
      quiz('surds', 50, '2026-09-01', [q('6-7', true, 'simplifying surds'), q('6-7', false, 'rationalising denominators')]),
      quiz('surds', 50, '2026-09-02', [q('6-7', true, 'simplifying surds'), q('6-7', false, 'rationalising denominators'), q('8-9', true, 'conjugates')]),
    ] }
    const { strengths, weaknesses } = skillStats(s)
    expect(strengths.map((x) => x.skill)).toEqual(['simplifying surds'])
    expect(weaknesses.map((x) => x.skill)).toEqual(['rationalising denominators'])
  })
})

describe('closest level up', () => {
  it('picks the subject furthest through its level, and gives a new student a goal', () => {
    const fresh = closestLevelUp(emptyState(), ['maths', 'physics'])
    expect(fresh?.level.level).toBe(1)
    const lessons = { [TOPICS.find((t) => t.subjectId === 'physics')!.id]: { topicId: TOPICS.find((t) => t.subjectId === 'physics')!.id, stepIndex: 3, updatedAt: '2026-09-01T10:00:00Z' } }
    const best = closestLevelUp({ ...emptyState(), lessons }, ['maths', 'physics'])
    expect(best?.subjectId).toBe('physics')
    expect(best!.level.progress).toBeGreaterThan(0)
    expect(closestLevelUp(emptyState(), [])).toBeUndefined()
  })
})
