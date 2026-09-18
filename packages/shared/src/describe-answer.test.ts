import { describe, expect, it } from 'vitest'
import { describeAnswer, expectedAnswer } from './marking.ts'
import type { Question } from './content/questions.ts'

const base = { marks: 1, gradeBand: '6-7' as const, skill: 's', calculator: 'either' as const, tags: [], solution: 'x', markScheme: [{ code: 'B1', marks: 1, description: 'x' }], discriminators: [] }
const mcq = { ...base, id: 'q1', type: 'multiple-choice' as const, prompt: 'p', options: ['$2\\sqrt{5}$', 'ten', 'twenty', 'none'], correct: [0] } as Question
const short = { ...base, id: 'q2', type: 'short-text' as const, prompt: 'p', accepted: ['5'] } as Question
const num = { ...base, id: 'q3', type: 'numeric' as const, prompt: 'p', answer: 5, tolerance: 0, unitsRequired: false } as Question
const order = { ...base, id: 'q4', type: 'ordering' as const, prompt: 'p', items: ['first', 'second', 'third'] } as Question
const extended = { ...base, id: 'q5', type: 'extended' as const, prompt: 'p', marks: 6, suggestedMinutes: 8, criteria: [{ text: 'c', marks: 6 }], modelAnswer: 'm' } as Question

describe('describeAnswer', () => {
  /**
   * Text, not an index. An index outlives the thing it points at: regenerate the
   * question with its options dealt differently and a stored index quietly starts
   * describing a different answer.
   */
  it('writes out the option chosen, not its position', () => {
    expect(describeAnswer(mcq, [1])).toBe('ten')
    expect(describeAnswer(mcq, [0])).toBe('$2\\sqrt{5}$')
  })

  it('joins a multiple selection', () => {
    expect(describeAnswer(mcq, [1, 2])).toBe('ten, twenty')
  })

  it('writes an ordering as the order it was put in', () => {
    expect(describeAnswer(order, [2, 0, 1])).toBe('third → first → second')
  })

  it('keeps typed answers as typed, trimmed', () => {
    expect(describeAnswer(short, '  5x - 2 ')).toBe('5x - 2')
    expect(describeAnswer(num, '49')).toBe('49')
  })

  it('keeps nothing for an answer that was never given', () => {
    expect(describeAnswer(short, '')).toBeUndefined()
    expect(describeAnswer(short, '   ')).toBeUndefined()
    expect(describeAnswer(mcq, [])).toBeUndefined()
    expect(describeAnswer(mcq, undefined)).toBeUndefined()
  })

  /** An extended answer is self-assessed against a mark scheme, never typed in. */
  it('keeps nothing for an extended question', () => {
    expect(describeAnswer(extended, 'anything')).toBeUndefined()
  })

  it('ignores an index that is not in the options', () => {
    expect(describeAnswer(mcq, [9])).toBeUndefined()
    expect(describeAnswer(mcq, [1, 9])).toBe('ten')
  })

  it('bounds what it keeps, so one answer cannot bloat the record', () => {
    const long = describeAnswer(short, 'x'.repeat(500))!
    expect(long.length).toBeLessThanOrEqual(200)
    expect(long.endsWith('…')).toBe(true)
  })
})

describe('expectedAnswer', () => {
  it('gives the option that was correct, not its index', () => {
    expect(expectedAnswer(mcq)).toBe('$2\\sqrt{5}$')
  })

  it('gives the first accepted form for a typed answer', () => {
    expect(expectedAnswer(short)).toBe('5')
  })

  it('includes units on a numeric answer, since the student may have been asked for them', () => {
    expect(expectedAnswer(num)).toBe('5')
    expect(expectedAnswer({ ...num, units: 'm/s' } as Question)).toBe('5 m/s')
  })

  it('gives an ordering in its correct order', () => {
    expect(expectedAnswer(order)).toBe('first → second → third')
  })

  /** Judged against criteria, so there is no single right answer to show. */
  it('gives nothing for an extended question', () => {
    expect(expectedAnswer(extended)).toBeUndefined()
  })
})
