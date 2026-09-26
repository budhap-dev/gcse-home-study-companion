import { describe, expect, it } from 'vitest'
import { algebraicForm, sameAlgebra } from './algebra.ts'
import { mark, normaliseText } from './marking.ts'
import type { Question } from './content/questions.ts'

const same = (a: string, b: string) => sameAlgebra(normaliseText(a), normaliseText(b))

describe('the same algebra in another order', () => {
  it.each([
    ['(x+1)(x-2)', '(x-2)(x+1)'],
    ['(x - 2)(x + 1)', '(-2 + x)(1 + x)'],
    ['5(x+2)(x-2)', '5(-2+x)(2+x)'],
    ['2(n+m+1)', '2(m+n+1)'],
    ['3n+2', '2+3n'],
    ['y=-x/2+3', 'y=3-x/2'],
    ['x+2y=6', '2y+x=6'],
    ['6=x+2y', 'x+2y=6'],
    ['x≥3', '3≤x'],
    ['x >= 3', '3 <= x'],
    ['x > 3', '3 < x'],
    ['x⩽-2', '-2≥x'],
    ['(2x+11)/((x-2)(x+1))', '(2x+11)/((x+1)(x-2))'],
    ['(x^-4)/9', 'x^-4/9'],
    ['2√13', '√13 × 2'],
    ['x=(d-b)/(a-c)', '(d-b)/(a-c)=x'],
    ['9x^2-12x+5', '5-12x+9x^2'],
    ['2a^2b^8', '2b^8a^2'],
  ])('%s matches %s', (a, b) => {
    expect(same(a, b)).toBe(true)
  })
})

describe('answers in a different form are still different', () => {
  it.each([
    ['(x+3)(x+4)', 'x^2+7x+12', 'expanded is not factorised'],
    ['2(x+2)(x-2)', '(2x+4)(x-2)', 'not fully factorised'],
    ['6x', '2*3x', 'not simplified'],
    ['x+x', '2x', 'terms not collected'],
    ['x≥3', 'x>3', 'strict and non-strict'],
    ['x<3', '3<x', 'the inequality reversed'],
    ['7-x', '-(x-7)', 'a bracket is kept, not multiplied out'],
    ['1/(9x^4)', 'x^-4/9', 'equal, but written differently'],
    ['(x-7)/2', 'x/2-7', 'the whole numerator'],
    ['√(a/π)', '√a/π', 'the root of all of it'],
    ['√(v^2-2as)', '√(v^2)-2as', 'the root of all of it'],
  ])('%s is not %s (%s)', (a, b) => {
    expect(same(a, b)).toBe(false)
  })
})

describe('text that is not plainly algebra is left to the text match', () => {
  it.each([
    ['4a3b1c', 'a run length code has no operator'],
    ['C2H4(OH)2', 'a formula: digits follow letters'],
    ['2H⁺ + 2e⁻ → H₂', 'a half equation'],
    ['je suis née', 'words'],
    ['x = 0 or x = 4', 'two answers'],
    ['a=3, b=4', 'a list'],
    ['-1/2x+3', '1/2x means ½x or 1/(2x)'],
    ['√3x', '√3·x or √(3x)'],
    ['x = 2 ± √3', 'plus or minus'],
    ['n <- 1', 'a pseudo-code assignment'],
    ['80-90', 'numbers only'],
  ])('%s (%s)', (s) => {
    expect(algebraicForm(normaliseText(s))).toBeNull()
  })
})

describe('the marker', () => {
  const base = { id: 'q', prompt: 'Factorise x² − x − 2.', marks: 2, gradeBand: '6-7' as const, skill: 's', calculator: 'either' as const, tags: [], solution: 's', markScheme: [{ code: 'B1', marks: 2, description: 'd' }], discriminators: [] }
  const q: Question = { ...base, type: 'short-text', accepted: ['(x+1)(x-2)'] }

  it('accepts a bracket order nobody listed', () => {
    expect(mark(q, '(x - 2)(x + 1)').correct).toBe(true)
    expect(mark(q, '(-2+x)(x+1)').correct).toBe(true)
  })

  it('still refuses the expanded form', () => {
    expect(mark(q, 'x^2-x-2').correct).toBe(false)
  })

  it('leaves chemical formulae to the text match', () => {
    const formula: Question = { ...base, type: 'short-text', accepted: ['Al^2O^3'] }
    expect(mark(formula, 'O^3Al^2').correct).toBe(false)
  })

  it('leaves case-sensitive answers to the strict match', () => {
    const strict: Question = { ...base, type: 'short-text', accepted: ['a+b'], matchCase: true }
    expect(mark(strict, 'b+a').correct).toBe(false)
  })
})
