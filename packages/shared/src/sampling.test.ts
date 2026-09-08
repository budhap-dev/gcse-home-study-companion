import { describe, expect, it } from 'vitest'
import { sampleQuestions, seededShuffle } from './sampling.ts'

const ids = Array.from({ length: 14 }, (_, i) => `q${i + 1}`)

describe('sampleQuestions', () => {
  it('is deterministic for a seed and different across seeds', () => {
    const a = sampleQuestions(ids, 10, 'attempt-a')
    expect(sampleQuestions(ids, 10, 'attempt-a')).toEqual(a)
    expect(sampleQuestions(ids, 10, 'attempt-b')).not.toEqual(a)
  })
  it('returns the requested size without repeats and never more than the pool', () => {
    const s = sampleQuestions(ids, 10, 'x')
    expect(s).toHaveLength(10)
    expect(new Set(s).size).toBe(10)
    expect(sampleQuestions(ids, 20, 'x')).toHaveLength(14)
  })
  it('keeps every item when shuffling', () => {
    expect([...seededShuffle(ids, 'z')].sort()).toEqual([...ids].sort())
  })
})
