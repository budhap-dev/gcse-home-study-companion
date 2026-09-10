import { describe, expect, it } from 'vitest'
import { mark, normaliseText, parseNumber } from './marking.ts'
import type { Question } from './content/questions.ts'

const base = { id: 'q', prompt: 'p', marks: 2, gradeBand: '6-7' as const, skill: 's', calculator: 'either' as const, tags: [], solution: 's', markScheme: [{ code: 'M1', marks: 2, description: 'd' }], discriminators: [] }

describe('parseNumber', () => {
  it('reads decimals, fractions, negatives, thousands, and units', () => {
    expect(parseNumber('0.25')).toBe(0.25)
    expect(parseNumber('1/4')).toBe(0.25)
    expect(parseNumber('-2')).toBe(-2)
    expect(parseNumber('180,000')).toBe(180000)
    expect(parseNumber('14 m/s', 'm/s')).toBe(14)
    expect(parseNumber('58.8 J', 'J')).toBe(58.8)
  })
  it('rejects non-numbers', () => {
    expect(parseNumber('four')).toBeUndefined()
    expect(parseNumber('')).toBeUndefined()
    expect(parseNumber('1/0')).toBeUndefined()
  })
})

describe('normaliseText', () => {
  it('ignores case, spaces, superscripts, and braces', () => {
    expect(normaliseText('x⁸')).toBe('x^8')
    expect(normaliseText(' X ^ 8 ')).toBe('x^8')
    expect(normaliseText('2^{-2}')).toBe('2^-2')
    expect(normaliseText('2^(-2)')).toBe('2^-2')
    expect(normaliseText('2⁻²')).toBe('2^-2')
  })
  it('treats the typographic minus, root symbols, and a leading y= as equivalent', () => {
    expect(normaliseText('y = 2x − 2')).toBe(normaliseText('2x-2'))
    expect(normaliseText('5√2')).toBe(normaliseText('5sqrt2'))
    expect(normaliseText('5 root 2')).toBe(normaliseText('5sqrt(2)'))
    expect(normaliseText('√5 + √2')).toBe(normaliseText('sqrt(5)+sqrt(2)'))
    expect(normaliseText('2 × 3')).toBe(normaliseText('2*3'))
    expect(normaliseText('1/(9x⁴)')).toBe(normaliseText('1/(9x^4)'))
  })
})

describe('mark', () => {
  it('numeric with tolerance', () => {
    const q: Question = { ...base, type: 'numeric', answer: 9.9, tolerance: 0.1, unitsRequired: false, units: 'm/s' }
    expect(mark(q, '9.9').correct).toBe(true)
    expect(mark(q, '9.95 m/s').correct).toBe(true)
    expect(mark(q, '10.1').correct).toBe(false)
    expect(mark(q, 'nine').marksScored).toBe(0)
  })
  it('short text with variants', () => {
    const q: Question = { ...base, type: 'short-text', accepted: ['1/(9x^4)', '1/9x^4'] }
    expect(mark(q, '1 / (9x⁴)').correct).toBe(true)
    expect(mark(q, '9x^4').correct).toBe(false)
  })
  it('multiple choice needs the exact set', () => {
    const q: Question = { ...base, type: 'multiple-choice', options: ['a', 'b', 'c'], correct: [0, 2] }
    expect(mark(q, [2, 0]).correct).toBe(true)
    expect(mark(q, [0]).correct).toBe(false)
  })
  it('ordering compares against the natural order', () => {
    const q: Question = { ...base, type: 'ordering', items: ['a', 'b', 'c'] }
    expect(mark(q, [0, 1, 2]).correct).toBe(true)
    expect(mark(q, [1, 0, 2]).correct).toBe(false)
  })
  it('extended is capped self-assessment', () => {
    const q: Question = { ...base, type: 'extended', marks: 6, suggestedMinutes: 8, criteria: [{ text: 'c', marks: 6 }], modelAnswer: 'm' }
    expect(mark(q, 4)).toEqual({ correct: false, marksScored: 4, marksAvailable: 6 })
    expect(mark(q, 9).marksScored).toBe(6)
  })
})

describe('standard form', () => {
  it('accepts the ways a student writes a power of ten', () => {
    for (const written of ['180000', '180,000', '180 000', '1.8e5', '1.8 x 10^5', '1.8 × 10^5', '1.8x10^5', '1.8 × 10⁵']) {
      expect(parseNumber(written), written).toBe(180000)
    }
    expect(parseNumber('2.5 x 10^4')).toBe(25000)
    expect(parseNumber('10^3')).toBe(1000)
    expect(parseNumber('10⁻³')).toBeCloseTo(0.001, 12)
    expect(parseNumber('1.6 x 10^-19')).toBeCloseTo(1.6e-19, 30)
  })

  it('still refuses things that are not numbers', () => {
    expect(parseNumber('ten to the five')).toBeUndefined()
    expect(parseNumber('x 10^')).toBeUndefined()
  })

  it('leaves ordinary numbers alone', () => {
    expect(parseNumber('10')).toBe(10)
    expect(parseNumber('100')).toBe(100)
    expect(parseNumber('0.5')).toBe(0.5)
    expect(parseNumber('49 N/m', 'N/m')).toBe(49)
  })
})

describe('negative answers', () => {
  it('accepts a Unicode minus or dash as well as a hyphen', () => {
    expect(parseNumber('−500', '£')).toBe(-500)
    expect(parseNumber('–700')).toBe(-700)
    expect(parseNumber('-£500', '£')).toBe(-500)
    expect(parseNumber('£-500', '£')).toBe(-500)
  })
})
