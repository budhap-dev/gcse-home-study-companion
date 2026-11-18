import { SUBJECTS } from '@study/shared'
import { describe, expect, it } from 'vitest'
import { specOrdered, topicsForSubject } from '../content/index.ts'
import { emptyState } from './store.ts'
import { recommend } from './recommend.ts'

describe('specOrdered', () => {
  it('keeps every topic, and every unit together in the subject’s unit order', () => {
    for (const s of SUBJECTS) {
      const school = topicsForSubject(s.id)
      const spec = specOrdered(school)
      expect(new Set(spec.map((t) => t.id))).toEqual(new Set(school.map((t) => t.id)))
      const unitAt = spec.map((t) => s.units.findIndex((u) => u.id === t.unitId))
      expect([...unitAt].sort((a, b) => a - b), s.id).toEqual(unitAt)
    }
  })

  it('puts Reactivity of metals (4.4.1) before the acids (4.4.2) in Chemical changes', () => {
    const titles = specOrdered(topicsForSubject('chemistry')).filter((t) => t.unitId === 'chemical-changes').map((t) => t.title)
    expect(titles).toEqual([
      'Reactivity of metals and displacement',
      'Oxidation and reduction in terms of electrons',
      'Reactions of acids with metals, bases and carbonates',
      'Making soluble salts',
      'Strong and weak acids',
      'Electrolysis of molten compounds',
      'Electrolysis of aqueous solutions',
    ])
  })
})

describe('Next up in specification order', () => {
  it('starts with the first new topic in the board’s order, whatever the student’s year', () => {
    const topics = topicsForSubject('chemistry')
    const state = { ...emptyState(), profile: { year: 11 as const } }
    expect(recommend(topics, state, new Date(), 'school').next?.topic.year).toBe(11)
    expect(recommend(topics, state, new Date(), 'spec').next?.topic.id).toBe(specOrdered(topics)[0]!.id)
  })
})
