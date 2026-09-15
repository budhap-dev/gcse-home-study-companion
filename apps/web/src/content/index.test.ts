import { describe, expect, it } from 'vitest'
import { TOPICS, topicsForSubject } from './index.ts'

describe('content order', () => {
  it('lists topics in teaching order within each unit, not alphabetically', () => {
    const byUnit = new Map<string, typeof TOPICS>()
    for (const t of TOPICS) {
      const key = `${t.subjectId}/${t.unitId}`
      byUnit.set(key, [...(byUnit.get(key) ?? []), t])
    }
    for (const [key, topics] of byUnit) {
      const orders = topics.map((t) => t.order ?? 999)
      expect(orders, key).toEqual([...orders].sort((a, b) => a - b))
    }
  })

  /**
   * Alphabetical order would put carbon structures first in the Chemistry bonding unit
   * and congruency before constructing triangles in Maths, so these two sequences pin
   * that topics are listed in the order they are taught. The assertion is on the unit
   * rather than on the first four topics of the subject, because Year 9 recap content
   * now precedes Year 10 in the list and would otherwise make this test measure
   * something other than what it is named for.
   */
  it('orders Chemistry bonding and Maths geometry by teaching order, not alphabetically', () => {
    const bonding = topicsForSubject('chemistry')
      .filter((t) => t.unitId === 'bonding-structure-and-properties')
      .map((t) => t.id)
    expect(bonding).toEqual(['states-of-matter', 'ionic-bonding', 'covalent-bonding', 'metallic-bonding-and-alloys', 'carbon-structures-and-nanoparticles'])
    const maths = topicsForSubject('maths').map((t) => t.id)
    expect(maths.indexOf('constructing-triangles')).toBeLessThan(maths.indexOf('congruency'))
  })

  it('gives every topic an order', () => {
    for (const t of TOPICS) expect(t.order, t.id).toBeDefined()
  })
})

/**
 * Step titles render as plain text in the lesson heading, not as rich text, so any
 * markdown or maths in them shows literally. One Music title shipped with *how* in it
 * before this caught it.
 */
describe('step titles are plain text', () => {
  it('has no markdown or maths in any lesson step title', () => {
    const bad: string[] = []
    for (const topic of TOPICS) {
      for (const step of topic.lesson.steps) {
        if (/[*_`$]/.test(step.title)) bad.push(`${topic.id} ${step.id}: ${step.title}`)
      }
    }
    expect(bad).toEqual([])
  })
})

/**
 * Every topic says which school year the class meets it in, so the subject page can
 * separate Year 9 from Year 10. A topic from an earlier year is kept, not dropped:
 * the milestones and synoptic tests keep re-testing it.
 */
describe('school years', () => {
  it('gives every topic a year in the school\'s range', () => {
    for (const t of TOPICS) expect([9, 10, 11], `${t.subjectId}/${t.id}`).toContain(t.year)
  })

  it('puts each topic in the year its curriculum document says', () => {
    const year = (id: string) => TOPICS.find((t) => t.id === id)?.year
    // Physics: the school covers Energy and the whole of motion and forces in Year 9.
    expect(year('kinetic-and-gravitational-potential-energy')).toBe(9)
    expect(year('stopping-distances')).toBe(9)
    expect(year('hookes-law')).toBe(10)
    // Computer Science: data types, selection and iteration are Year 9 programming.
    expect(year('data-types-and-operators')).toBe(9)
    expect(year('subroutines-procedures-and-functions')).toBe(10)
    // Business: 1.1 to 1.3 are Year 9; 1.4 and 1.5 are Year 10.
    expect(year('putting-a-business-idea-into-practice')).toBe(9)
    expect(year('making-the-business-effective')).toBe(10)
  })

  it('keeps every subject to years the student has reached or is in', () => {
    // Nothing beyond Year 10 is written yet, so a Year 11 topic would be a mistake.
    expect(TOPICS.filter((t) => t.year === 11).map((t) => t.id)).toEqual([])
  })
})
