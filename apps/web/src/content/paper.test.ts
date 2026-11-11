import { AUTO_MARKED_TYPES, SUBJECTS } from '@study/shared'
import { describe, expect, it } from 'vitest'
import { getGuide, TOPICS, topicsForSubject, yearsForSubject } from './index.ts'
import { minutesFor, minutesPerMark, parseYear, perTopic, unitTestItems, unitTestPath, unitTopics } from './paper.ts'

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
