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

  it('starts Chemistry bonding with ionic bonding and Maths geometry with constructing triangles', () => {
    expect(topicsForSubject('chemistry').map((t) => t.id).slice(0, 4)).toEqual(['ionic-bonding', 'covalent-bonding', 'metallic-bonding-and-alloys', 'carbon-structures-and-nanoparticles'])
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
