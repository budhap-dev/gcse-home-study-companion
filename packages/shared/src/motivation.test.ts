import { describe, expect, it } from 'vitest'
import { levelFor, LEVEL_THRESHOLDS, messageForScore } from './motivation.ts'

describe('levelFor', () => {
  it('starts at level 1 and climbs the thresholds', () => {
    expect(levelFor('maths', 0)).toMatchObject({ level: 1, name: 'Counter', into: 0, span: 60 })
    expect(levelFor('maths', 60)).toMatchObject({ level: 2, name: 'Adder' })
    expect(levelFor('physics', 150)).toMatchObject({ level: 3, name: 'Deci' })
    expect(levelFor('physics', 149).progress).toBeCloseTo(89 / 90)
  })
  it('keeps going past the last threshold', () => {
    const top = levelFor('maths', LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]! + 500)
    expect(top.level).toBe(LEVEL_THRESHOLDS.length)
    expect(top.name).toBe('Mathematician')
  })
})

describe('messageForScore', () => {
  it('celebrates improvement before anything else', () => {
    expect(messageForScore(72, 55)).toMatch(/learned|Better than before|Up on last time/)
  })
  it('matches the band otherwise', () => {
    expect(messageForScore(100)).toMatch(/understand|yours now|Clean sweep/)
    expect(messageForScore(85)).toMatch(/Great effort|Almost there|main idea/)
    expect(messageForScore(60)).toMatch(/Good progress|getting there|Half way/)
    expect(messageForScore(30)).toMatch(/another question|Tough|clicked/)
  })
})
