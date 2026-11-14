import { AUTO_MARKED_TYPES, SUBJECTS } from '@study/shared'
import { describe, expect, it } from 'vitest'
import { getGuide, TOPICS, topicsForSubject, yearsForSubject } from './index.ts'
import { CHALLENGE_SET, challengeItems, challengePath, challengeProblems, GRADE_9_SET, grade9Items, grade9Path, minutesFor, minutesPerMark, parseYear, perTopic, unitTestItems, unitTestPath, unitTopics } from './paper.ts'

const BAND = ['4-5', '6-7', '8-9']

describe('the exam pace', () => {
  it('is the written papers’ minutes over their marks', () => {
    expect(minutesPerMark(getGuide('maths'))).toBeCloseTo(270 / 240)
    expect(minutesPerMark(getGuide('computer-science'))).toBeCloseTo(225 / 180)
  })

  it('leaves out speaking and coursework, which have no written time', () => {
    expect(minutesPerMark(getGuide('french'))).toBeCloseTo((60 + 60 + 80) / 150)
    expect(minutesPerMark(getGuide('music'))).toBeCloseTo(105 / 80)
  })

  it('gives every subject a pace between one and two minutes a mark', () => {
    for (const s of SUBJECTS) {
      const p = minutesPerMark(getGuide(s.id))
      expect(p, s.id).toBeGreaterThanOrEqual(1)
      expect(p, s.id).toBeLessThanOrEqual(2)
    }
  })

  it('rounds a paper to whole minutes, never under five', () => {
    expect(minutesFor(40, 1.125)).toBe(45)
    expect(minutesFor(2, 1)).toBe(5)
  })
})

describe('a unit test (TOP-3)', () => {
  const algebra = unitTopics(topicsForSubject('maths'), 'algebra', 10)

  it('asks two to four questions a topic, fewer as the unit grows', () => {
    expect([1, 3, 4, 6, 7, 12, 13].map(perTopic)).toEqual([4, 4, 3, 3, 2, 2, 1])
  })

  it('takes only questions the app marks, each once, from every topic', () => {
    const items = unitTestItems(algebra, 'abc123')
    const keys = items.map((m) => `${m.topicId}/${m.questionId}`)
    expect(new Set(keys).size).toBe(keys.length)
    for (const t of algebra) expect(items.filter((m) => m.topicId === t.id).length, t.id).toBe(perTopic(algebra.length))
    for (const m of items) {
      const q = algebra.find((t) => t.id === m.topicId)!.questions.find((x) => x.id === m.questionId)!
      expect(AUTO_MARKED_TYPES).toContain(q.type)
    }
  })

  it('ramps as a paper does: easier bands first', () => {
    const bands = unitTestItems(algebra, 'abc123').map((m) => algebra.find((t) => t.id === m.topicId)!.questions.find((x) => x.id === m.questionId)!.gradeBand)
    const ranks = bands.map((b) => BAND.indexOf(b))
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    expect(new Set(bands).size).toBeGreaterThan(1)
  })

  it('is fixed by its code and changes with it', () => {
    expect(unitTestItems(algebra, 'abc123')).toEqual(unitTestItems(algebra, 'abc123'))
    expect(unitTestItems(algebra, 'zzz999')).not.toEqual(unitTestItems(algebra, 'abc123'))
  })

  it('makes a test of between 4 and 30 questions from every unit card, in every year and for all years', () => {
    let cards = 0
    for (const s of SUBJECTS) {
      const units = [...new Set(topicsForSubject(s.id).map((t) => t.unitId))]
      for (const u of units) {
        for (const y of [undefined, ...yearsForSubject(s.id)]) {
          const topics = unitTopics(topicsForSubject(s.id), u, y)
          if (!topics.length) continue
          cards++
          const n = unitTestItems(topics, 'check1').length
          expect(n, `${s.id}/${u}/${y ?? 'all'}`).toBeGreaterThanOrEqual(Math.min(4, topics.length * perTopic(topics.length)))
          expect(n, `${s.id}/${u}/${y ?? 'all'}`).toBeLessThanOrEqual(30)
        }
      }
    }
    expect(cards).toBeGreaterThan(80)
    expect(TOPICS.length).toBeGreaterThan(300)
  })

  it('has a link that carries the year only when one was chosen', () => {
    expect(unitTestPath('maths', 'algebra', 'abc123', 10)).toBe('/subjects/maths/units/algebra/test?year=10&sheet=abc123')
    expect(unitTestPath('maths', 'algebra', 'abc123')).toBe('/subjects/maths/units/algebra/test?sheet=abc123')
    expect([parseYear('10'), parseYear('8'), parseYear(null)]).toEqual([10, undefined, undefined])
  })
})

describe('a grade 9 set (WKP-5)', () => {
  const forces = unitTopics(topicsForSubject('physics'), 'forces')
  const q = (m: { topicId: string; questionId: string }) => TOPICS.find((t) => t.id === m.topicId)!.questions.find((x) => x.id === m.questionId)!

  it('is eight grade 8–9 problems, none twice, building from fewest marks to most', () => {
    const items = grade9Items(forces, 'abc123')
    expect(items).toHaveLength(GRADE_9_SET)
    expect(new Set(items.map((m) => `${m.topicId}/${m.questionId}`)).size).toBe(GRADE_9_SET)
    for (const m of items) expect(q(m).gradeBand).toBe('8-9')
    const marks = items.map((m) => q(m).marks)
    expect(marks).toEqual([...marks].sort((a, b) => a - b))
  })

  it('spreads across the unit’s topics', () => {
    const items = grade9Items(forces, 'abc123')
    expect(new Set(items.map((m) => m.topicId)).size).toBe(Math.min(GRADE_9_SET, forces.length))
  })

  it('leans to the longer problems, and a new code makes a new mix', () => {
    const all = forces.flatMap((t) => t.questions.filter((x) => x.gradeBand === '8-9'))
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    const sets = ['a1', 'b2', 'c3', 'd4', 'e5'].map((c) => grade9Items(forces, c))
    expect(mean(sets.flat().map((m) => q(m).marks))).toBeGreaterThan(mean(all.map((x) => x.marks)))
    expect(new Set(sets.map((s) => JSON.stringify(s))).size).toBe(5)
  })

  it('gives every unit card in the pack a full set', () => {
    for (const s of SUBJECTS) {
      const units = [...new Set(topicsForSubject(s.id).map((t) => t.unitId))]
      for (const u of units) {
        for (const y of [undefined, ...yearsForSubject(s.id)]) {
          const topics = unitTopics(topicsForSubject(s.id), u, y)
          if (!topics.length) continue
          // A multi-part question comes whole and counts as one problem.
          const items = grade9Items(topics, 'check1')
          const problems = new Set(items.map((m) => {
            const stem = topics.find((t) => t.id === m.topicId)!.questions.find((q) => q.id === m.questionId)!.stemId
            return stem ? `${m.topicId}/${stem}` : `${m.topicId}/${m.questionId}`
          }))
          expect(problems.size, `${s.id}/${u}/${y ?? 'all'}`).toBe(GRADE_9_SET)
        }
      }
    }
  })

  it('has a link of its own', () => {
    expect(grade9Path('physics', 'forces', 'abc123', 11)).toBe('/subjects/physics/units/forces/grade-9?year=11&sheet=abc123')
  })
})

describe('a Challenge set (section 13, box 12)', () => {
  const maths = topicsForSubject('maths')
  const isChallenge = (m: { topicId: string; questionId: string }) => maths.find((t) => t.id === m.topicId)!.questions.find((q) => q.id === m.questionId)!.challenge !== undefined

  it('draws from the subject’s Challenge problems only, a multi-part one whole', () => {
    expect(challengeProblems(maths).length).toBe(12)
    for (const code of ['a1', 'b2', 'c3', 'd4']) {
      const items = challengeItems(maths, code)
      expect(items.every(isChallenge)).toBe(true)
      const stems = new Set(items.map((m) => maths.find((t) => t.id === m.topicId)!.questions.find((q) => q.id === m.questionId)!.stemId))
      expect(stems.size).toBe(CHALLENGE_SET)
      // every part of each problem drawn is asked
      for (const m of items) {
        const t = maths.find((x) => x.id === m.topicId)!
        const stem = t.questions.find((q) => q.id === m.questionId)!.stemId
        for (const q of t.questions.filter((x) => x.stemId === stem)) expect(items.some((x) => x.topicId === t.id && x.questionId === q.id), `${t.id} ${q.id}`).toBe(true)
      }
    }
  })

  it('is fixed by its code, and a new code is a new mix', () => {
    expect(challengeItems(maths, 'same')).toEqual(challengeItems(maths, 'same'))
    const mixes = new Set(['a1', 'b2', 'c3', 'd4', 'e5', 'f6'].map((c) => challengeItems(maths, c).map((m) => `${m.topicId}/${m.questionId}`).sort().join()))
    expect(mixes.size).toBeGreaterThan(1)
  })

  it('is kept out of every unit’s test and grade 9 set', () => {
    const units = [...new Set(maths.map((t) => t.unitId))]
    for (const u of units) for (const code of ['x1', 'y2', 'z3']) {
      const topics = unitTopics(maths, u)
      expect(unitTestItems(topics, code).filter(isChallenge), `${u} test`).toEqual([])
      expect(grade9Items(topics, code).filter(isChallenge), `${u} grade 9`).toEqual([])
    }
  })

  it('has a link of its own', () => {
    expect(challengePath('maths', 'k7q2')).toBe('/subjects/maths/challenge?sheet=k7q2')
  })
})

