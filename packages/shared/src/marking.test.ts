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
  it('forgives a leading "x =" or "="', () => {
    expect(parseNumber('x = 5')).toBe(5)
    expect(parseNumber('x=-2')).toBe(-2)
    expect(parseNumber('= 4.5')).toBe(4.5)
    expect(parseNumber('F = 20 N', 'N')).toBe(20)
    expect(parseNumber('area = 12 cm²', 'cm²')).toBe(12)
  })
  it('forgives a currency symbol, because the solutions print one', () => {
    expect(parseNumber('£500')).toBe(500)
    expect(parseNumber('-£700')).toBe(-700)
    expect(parseNumber('£-700')).toBe(-700)
    expect(parseNumber('£4.36')).toBe(4.36)
    expect(parseNumber('£11 500')).toBe(11500)
    expect(parseNumber('€40')).toBe(40)
    expect(parseNumber('$12 000')).toBe(12000)
  })
  it('rejects non-numbers', () => {
    expect(parseNumber('four')).toBeUndefined()
    expect(parseNumber('')).toBeUndefined()
    expect(parseNumber('1/0')).toBeUndefined()
  })

  /**
   * A division sign is a key on every maths keyboard, so a student who presses it means
   * a fraction. normaliseText had always accepted it and parseNumber had not.
   */
  it('reads a division sign as a fraction', () => {
    expect(parseNumber('3÷4')).toBe(0.75)
    expect(parseNumber('3 ÷ 4')).toBe(0.75)
    expect(parseNumber('-1÷2')).toBe(-0.5)
  })

  /** Brackets round the parts of a fraction, which is what a maths editor produces. */
  it('reads a bracketed fraction', () => {
    expect(parseNumber('(3)/(4)')).toBe(0.75)
    expect(parseNumber('(3)/4')).toBe(0.75)
    expect(parseNumber('(-1)/(2)')).toBe(-0.5)
  })

  /**
   * "1 1/2" is one and a half. The rule that joins "25 000" into 25000 used to run first
   * and turn it into 11/2, so the student was marked as meaning 5.5 — a wrong number
   * returned silently, which is worse than refusing to read it at all.
   */
  it('reads a mixed number, and does not silently mangle it', () => {
    expect(parseNumber('1 1/2')).toBe(1.5)
    expect(parseNumber('2 3/4')).toBe(2.75)
    expect(parseNumber('-1 1/2')).toBe(-1.5)
    expect(parseNumber('1 1/0')).toBeUndefined()
  })

  /** The rules above must not disturb the spaced thousands the content itself prints. */
  it('still reads spaced thousands', () => {
    expect(parseNumber('25 000')).toBe(25000)
    expect(parseNumber('180 000')).toBe(180000)
    expect(parseNumber('1 000 000')).toBe(1000000)
  })
})

describe('normaliseText', () => {
  /** A student without a pi key types the letters; the content writes the symbol. */
  it('matches a typed pi against an accepted π', () => {
    expect(normaliseText('2pir')).toBe(normaliseText('2πr'))
    expect(normaliseText('r=sqrt(a/pi)')).toBe(normaliseText('r=sqrt(a/π)'))
  })

  /** Folding runs symbol to letters, so words that happen to contain "pi" are untouched. */
  it('leaves words containing pi alone', () => {
    expect(normaliseText('pitch')).toBe('pitch')
    expect(normaliseText('capital')).toBe('capital')
    expect(normaliseText('pipette')).toBe('pipette')
  })

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

describe('apostrophes', () => {
  it('treats a curly apostrophe as a straight one, for French answers', () => {
    const q: Question = {
      id: 'q', type: 'short-text', prompt: 'p', marks: 1, gradeBand: '4-5', skill: 's',
      calculator: 'either', tags: [], solution: 's', markScheme: [{ code: 'B1', marks: 1, description: 'd' }],
      discriminators: [], accepted: ["j'ai mal à la tête"],
    }
    for (const typed of ["j'ai mal à la tête", "j’ai mal à la tête", "J'ai mal à la tête", "j' ai mal à la tête"]) {
      expect(mark(q, typed).correct, typed).toBe(true)
    }
  })
})

describe('sentence punctuation', () => {
  const q = (accepted: string[]): Question => ({
    id: 'q', type: 'short-text', prompt: 'p', marks: 1, gradeBand: '4-5', skill: 's',
    calculator: 'either', tags: [], solution: 's', markScheme: [{ code: 'B1', marks: 1, description: 'd' }],
    discriminators: [], accepted,
  })

  it('forgives a closing full stop that the accepted answer does not have', () => {
    const sentence = q(["je me couche tôt parce que j'ai besoin de dormir"])
    expect(mark(sentence, "Je me couche tôt parce que j'ai besoin de dormir.").correct).toBe(true)
    expect(mark(sentence, "Je me couche tôt parce que j'ai besoin de dormir !").correct).toBe(true)
  })

  it('forgives commas that the accepted answer does not have', () => {
    const sentence = q(["avant je buvais du coca mais maintenant je bois de l'eau"])
    expect(mark(sentence, "Avant, je buvais du coca, mais maintenant je bois de l'eau.").correct).toBe(true)
  })

  it('requires punctuation the accepted answer includes, as in program output', () => {
    const output = q(['Hi Amy!'])
    expect(mark(output, 'Hi Amy!').correct).toBe(true)
    expect(mark(output, 'Hi Amy').correct).toBe(false)
    const greeting = q(['Hello, Ada'])
    expect(mark(greeting, 'Hello, Ada').correct).toBe(true)
    expect(mark(greeting, 'Hello Ada').correct).toBe(false)
  })

  it('treats a comma between digits as part of the answer', () => {
    const point = q(['(3,5)'])
    expect(mark(point, '(3, 5)').correct).toBe(true)
    expect(mark(point, '(35)').correct).toBe(false)
  })

  it('leaves normaliseText itself alone, so a decimal point survives', () => {
    expect(normaliseText('2.5')).toBe('2.5')
    expect(normaliseText('Hi Amy!')).toBe('hiamy!')
  })
})

describe('leading articles', () => {
  const q = (accepted: string[]): Question => ({
    id: 'q', type: 'short-text', prompt: 'p', marks: 1, gradeBand: '4-5', skill: 's',
    calculator: 'either', tags: [], solution: 's', markScheme: [{ code: 'B1', marks: 1, description: 'd' }],
    discriminators: [], accepted,
  })

  it('forgives "the", "a" or "an" in front of a plain noun answer', () => {
    expect(mark(q(['stomata']), 'The stomata').correct).toBe(true)
    expect(mark(q(['hybridoma']), 'a hybridoma').correct).toBe(true)
    expect(mark(q(['interrupted cadence']), 'An interrupted cadence.').correct).toBe(true)
  })

  it('keeps a definite article the accepted answer itself begins with', () => {
    // "The sun" names a particular thing, so the article is part of the answer.
    expect(mark(q(['the sun']), 'the sun').correct).toBe(true)
    expect(mark(q(['the sun']), 'sun').correct).toBe(false)
  })

  it('forgives an indefinite article on either side of a definition', () => {
    // "A tax on imports" is how a definition reads, but a student writing the bare
    // phrase the topic itself teaches was being marked wrong.
    expect(mark(q(['a tax on imports']), 'tax on imports').correct).toBe(true)
    expect(mark(q(['a tax on imports']), 'a tax on imports').correct).toBe(true)
    expect(mark(q(['an import tax']), 'import tax').correct).toBe(true)
    expect(mark(q(['a hybridoma']), 'the hybridoma').correct).toBe(true)
  })

  it('keeps program output, equations and accented words strict', () => {
    expect(mark(q(['Hi Amy!']), 'the Hi Amy!').correct).toBe(false)
    expect(mark(q(['Na→Na++e-']), 'the Na→Na++e-').correct).toBe(false)
    expect(mark(q(['mangé']), 'a mangé').correct).toBe(false)
  })
})

describe('negative coordinates', () => {
  const point: Question = {
    id: 'q', type: 'short-text', prompt: 'p', marks: 1, gradeBand: '4-5', skill: 's',
    calculator: 'either', tags: [], solution: 's', markScheme: [{ code: 'B1', marks: 1, description: 'd' }],
    discriminators: [], accepted: ['(0,-2)'],
  }

  it('keeps the comma before a negative number, so (0, -2) is not read as (0-2)', () => {
    expect(mark(point, '(0, -2)').correct).toBe(true)
    expect(mark(point, '(0,−2)').correct).toBe(true)
    expect(mark(point, '(0-2)').correct).toBe(false)
    expect(mark(point, '(0 -2)').correct).toBe(false)
  })
})
