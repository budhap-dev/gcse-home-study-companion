import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../content/questions.ts'
import { mark } from '../marking.ts'
import { GENERATORS, generate, sheetQuestions } from './index.ts'
import { lin, poly, sumOf } from './maths/quadratics.ts'
import type { Generated } from './types.ts'

/**
 * Structural tests for the quadratics and surds generators. The release check proves each
 * answer agrees with the generator's own second route; these read the strings a student sees
 * and the marker accepts, through an evaluator that shares no code with the generators, because
 * a wrong accepted answer is invisible to the marker round trip (verify-accepted-answers: 11
 * wrong factorisations once shipped that way).
 */
const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content/maths')
const topicFile = (topicId: string) => JSON.parse(readFileSync(join(ROOT, `${topicId}.json`), 'utf8'))
const bank = (topicId: string) => Question.array().parse(topicFile(topicId).questions)

function build(generatorId: string, slotId: string, count = 300): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = bank(g.topicId).find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `algebra-${i}`))
}

function sheet(topicId: string, level: 'core' | 'higher' | 'advanced', seed: string) {
  const questions = bank(topicId)
  const ids: string[] = topicFile(topicId).worksheets[level].questionIds
  return sheetQuestions('maths', topicId, ids.map((id) => questions.find((q) => q.id === id)!), seed)
}

const accepted = (b: Generated) => {
  if (b.question.type !== 'short-text') throw new Error(`${b.question.id} is not short-text`)
  return b.question.accepted
}
const math = (text: string, k = 0) => [...text.matchAll(/\$([^$]+)\$/g)][k]![1]!
const letterOf = (b: Generated) => String(b.values.v ?? 'x')

/**
 * Typed or printed maths as a JavaScript function of the letter, by rewriting the text:
 * \dfrac{a}{b} to ((a)/(b)), √n to Math.sqrt, implicit multiplication made explicit, ^ to **.
 */
function js(src: string, letter = 'x'): (x: number) => number {
  let s = src.replace(/\$/g, '').replace(/\\left|\\right/g, '')
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, '√($1)')
  for (let i = 0; i < 5; i++) s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))')
  s = s.replace(/\\times/g, '*').replace(/\s+/g, '').replace(/sqrt/g, '√').replace(/[−]/g, '-')
  s = s.replace(new RegExp(letter, 'g'), 'X')
  s = s.replace(/√(\d+)/g, '√($1)')
  s = s.replace(/([\dX)])(?=[(X√])/g, '$1*')
  s = s.replace(/X\^(\d+)/g, '(X**$1)').replace(/\)\^(\d+)/g, ')**$1')
  s = s.replace(/√/g, 'Math.sqrt')
  if (/[^\dX+\-*/().a-zA-Z]/.test(s.replace(/Math\.sqrt/g, ''))) throw new Error(`cannot rewrite ${src} (${s})`)
  return new Function('X', `return ${s}`) as (x: number) => number
}

/** Clear of every pole a question can have: the poles are whole numbers or thirds and halves of them. */
const POINTS = [-2.37, -1.13, 0.41, 1.77, 3.29, 4.63, 6.91]
const sameFunction = (a: (x: number) => number, b: (x: number) => number) => POINTS.every((x) => Math.abs(a(x) - b(x)) < 1e-9 * Math.max(1, Math.abs(b(x))))

/** Roots read from a typed answer by this file's own rules: "x = -1/2 or x = -3", "±3". */
function roots(typed: string): number[] {
  return typed
    .replace(/[a-z]\s*=\s*/g, '')
    .split(/\s*(?:\bor\b|\band\b|,|;)\s*/)
    .filter(Boolean)
    .flatMap((p) => {
      const pm = p.startsWith('±')
      const body = p.replace('±', '')
      const [n, d] = body.split('/')
      const v = Number(n) / (d === undefined ? 1 : Number(d))
      return pm ? [v, -v] : [v]
    })
}

const gcdBrute = (a: number, b: number) => {
  let g = 1
  for (let k = 1; k <= Math.max(Math.abs(a), Math.abs(b)); k++) if (a % k === 0 && b % k === 0) g = k
  return g
}
const squareFree = (n: number) => {
  for (let k = 2; k * k <= n; k++) if (n % (k * k) === 0) return false
  return true
}

/** A bracket's content as its x coefficient and constant, read by this file's own pattern. */
function linear(content: string, letter: string): [number, number] | null {
  const f = js(content, letter)
  const c = f(0)
  const a = f(1) - c
  // A first-degree expression: straight through three points.
  return Math.abs(f(2) - (2 * a + c)) < 1e-9 && !content.includes('^') ? [a, c] : null
}

/** Every term formatter output this file checks: never + -, - -, 1x, -1x or x^1. */
const BAD_TERMS = /\+ -|- -|\+-|(?:^|[^\d.\w{])1[a-z](?![a-z])|\^1(?!\d)|\^\{1\}|(?:^|[^\d])1\\sqrt|\\sqrt\{1\}/

describe('the term formatter', () => {
  it('prints every polynomial with small coefficients cleanly, and as the same polynomial', () => {
    for (const v of ['x', 't']) {
      for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) for (let c = -3; c <= 3; c++) {
        const p = [c, b, a]
        for (const text of [poly(p, v), poly(p, v, false), poly(p, v, true, true), poly(p, v, false, true)]) {
          expect(text, JSON.stringify(p)).not.toMatch(BAD_TERMS)
          const f = js(text, v)
          for (const x of POINTS) expect(f(x)).toBeCloseTo(a * x * x + b * x + c, 9)
        }
      }
    }
  })

  it('prints the cases that go wrong as the pack prints them', () => {
    expect(poly([0, 1])).toBe('x')
    expect(poly([0, -1])).toBe('-x')
    expect(poly([3, 0, 1])).toBe('x^2 + 3')
    expect(poly([-3, 1, -1])).toBe('-x^2 + x - 3')
    expect(poly([-14, -5, 1], 'x', false)).toBe('x^2-5x-14')
    expect(poly([-14, -5, 1], 'x', true, true)).toBe('-14 - 5x + x^2')
    expect(poly([0, 0, 0])).toBe('0')
    expect(lin(1, 0)).toBe('x')
    expect(lin(-1, 4)).toBe('-x+4')
    expect(lin(2, -5)).toBe('2x-5')
    expect(sumOf([[2, 2], [-8, 1], [3, 1], [-12, 0]])).toBe('2x^2 - 8x + 3x - 12')
    expect(sumOf([[1, 2], [-1, 1], [1, 1], [-1, 0]])).toBe('x^2 - x + x - 1')
  })

  it('leaves no bad term in anything the quadratics and surds generators print or accept', () => {
    const mine = GENERATORS.filter((g) => ['expanding-and-factorising-quadratics', 'simplifying-and-expanding-expressions', 'solving-quadratic-equations', 'quadratic-inequalities', 'quadratic-curves', 'algebraic-fractions', 'surds'].includes(g.topicId))
    expect(mine.length).toBeGreaterThanOrEqual(40)
    for (const g of mine) {
      for (const id of g.replaces) {
        for (const b of build(g.id, id, 150)) {
          const q = b.question
          const texts = [q.prompt, q.solution, ...q.markScheme.map((l) => l.description), ...(q.type === 'short-text' ? q.accepted : [])]
          for (const t of texts) expect(t, `${g.id} ${id} ${b.seed}`).not.toMatch(BAD_TERMS)
        }
      }
    }
  })
})

/** Factorising slots: generator, slot. */
const FACTORISING: [string, string][] = [
  ['factorising-quadratics', 'q2'],
  ['factorising-quadratics', 'q5'],
  ['factorising-quadratics', 'q6'],
  ['factorising-quadratics', 'q11'],
  ['factorising-quadratics', 'q12'],
  ['factorising-quadratics', 'q19'],
  ['difference-of-two-squares', 'q3'],
  ['difference-of-two-squares', 'q7'],
  ['difference-of-two-squares', 'q14'],
  ['quadratic-common-factor', 'q8'],
  ['factorising-a-number', 'q7'],
  ['factorising-with-a-letter', 'q14'],
]

describe('factorisations', () => {
  it('every accepted form multiplies back to the polynomial in the prompt, and is fully factorised', () => {
    for (const [id, slotId] of FACTORISING) {
      for (const b of build(id, slotId)) {
        const v = letterOf(b)
        const target = js(math(b.question.prompt), v)
        for (const a of accepted(b)) {
          expect(sameFunction(js(a, v), target), `${id} ${slotId} ${b.seed}: ${a} for ${b.question.prompt}`).toBe(true)
          // A product of brackets, a number or a number and the letter (or a minus) in front.
          expect(a, `${b.seed}: ${a}`).toMatch(new RegExp(`^-?(\\d+${v}?)?(\\([^()]+\\))+$`))
          const brackets = [...a.matchAll(/\(([^()]+)\)/g)].map((m) => m[1]!)
          for (const content of brackets) {
            const l = linear(content, v)
            expect(l, `${b.seed}: ${content} in ${a}`).not.toBeNull()
            expect(gcdBrute(l![0], l![1]), `${b.seed}: common factor left in (${content})`).toBe(1)
          }
        }
      }
    }
  })

  it('takes the factors in either order and spaced, and refuses the expanded form or a sign slip', () => {
    for (const [id, slotId] of FACTORISING) {
      for (const b of build(id, slotId, 100)) {
        const q = b.question
        const first = accepted(b)[0]!
        const brackets = [...first.matchAll(/\([^()]+\)/g)].map((m) => m[0])
        const lead = first.slice(0, first.indexOf('('))
        const swapped = `${lead}${[...brackets].reverse().join('')}`.replace(/([+-])/g, ' $1 ').replace(/\( - /g, '(-')
        expect(mark(q, swapped).correct, `${b.seed}: ${swapped} for ${first}`).toBe(true)
        const expanded = math(q.prompt).replace(/\s+/g, '')
        expect(mark(q, expanded).correct, `${b.seed}: the prompt itself`).toBe(false)
        // Flip every sign inside the brackets: a different polynomial (unless it is a difference of squares).
        const flipped = first.replace(/\(([^()]+)\)/g, (_, c: string) => `(${c.replace(/[+-]/g, (s) => (s === '+' ? '-' : '+'))})`)
        const v = letterOf(b)
        if (!sameFunction(js(flipped, v), js(first, v))) expect(mark(q, flipped).correct, `${b.seed}: ${flipped}`).toBe(false)
      }
    }
  })

  it('keeps the grade 8-9 trinomials grade 8-9: both x-coefficients above 1, and q14 a number and a difference of squares', () => {
    for (const slotId of ['q12', 'q19']) for (const b of build('factorising-quadratics', slotId)) {
      expect(Number(b.values.p)).toBeGreaterThanOrEqual(2)
      expect(Number(b.values.r)).toBeGreaterThanOrEqual(2)
    }
    for (const b of build('difference-of-two-squares', 'q14')) expect(accepted(b)[0]).toMatch(/^\d+\(/)
    for (const b of build('factorising-with-a-letter', 'q14')) expect(Number(b.values.u)).toBeGreaterThanOrEqual(2)
    // q3 asks both ways round: letter first and number first.
    expect(new Set(build('difference-of-two-squares', 'q3').map((b) => b.values.kind))).toEqual(new Set(['letter first', 'number first']))
  })
})

const EXPANDING: [string, string][] = [
  ['expanding-double-brackets', 'q1'],
  ['expanding-double-brackets', 'q4'],
  ['expanding-double-brackets', 'q9'],
  ['expanding-three-brackets', 'q13'],
  ['expanding-three-brackets', 'q16'],
  ['collecting-like-terms', 'q1'],
  ['expanding-brackets', 'q2'],
  ['expanding-brackets', 'q5'],
]

describe('expansions', () => {
  it('every accepted form is the printed expression multiplied out, collected, with no brackets left', () => {
    for (const [id, slotId] of EXPANDING) {
      for (const b of build(id, slotId)) {
        const v = letterOf(b)
        const target = js(math(b.question.prompt), v)
        for (const a of accepted(b)) {
          expect(a).not.toMatch(/[()]/)
          expect(sameFunction(js(a, v), target), `${b.seed}: ${a} for ${b.question.prompt}`).toBe(true)
          // Collected: each power of the letter once.
          const powers = a.replace(/\s+/g, '').split(/(?=[+-])/).map((t) => (t.includes(v) ? (t.match(/\^(\d)/)?.[1] ?? '1') : '0'))
          expect(new Set(powers).size, `${b.seed}: ${a}`).toBe(powers.length)
        }
      }
    }
  })

  it('takes the terms in another order and refuses the classic slips', () => {
    for (const [id, slotId] of EXPANDING) {
      for (const b of build(id, slotId, 100)) {
        const q = b.question
        const terms = accepted(b)[0]!.replace(/\s+/g, '').split(/(?=[+-])/)
        const reversed = [...terms].reverse().map((t, i) => (i > 0 && !/^[+-]/.test(t) ? `+${t}` : t)).join('').replace(/^\+/, '')
        expect(mark(q, reversed).correct, `${b.seed}: ${reversed}`).toBe(true)
      }
    }
    for (const b of build('expanding-double-brackets', 'q4', 100)) {
      const v = letterOf(b)
      expect(mark(b.question, `${v}^2+${Number(b.values.a) ** 2}`).correct).toBe(false)
    }
  })
})

describe('roots', () => {
  const SOLVING: [string, string][] = [
    ['solving-by-factorising', 'q1'],
    ['solving-by-factorising', 'q3'],
    ['solving-by-factorising', 'q4'],
    ['solving-by-factorising', 'q8'],
    ['solving-by-factorising', 'q9'],
    ['solving-by-factorising', 'q18'],
    ['solving-by-square-roots', 'q2'],
    ['solving-ax2-by-factorising', 'q5'],
    ['solving-ax2-by-factorising', 'q11'],
    ['roots-of-a-curve', 'q5'],
  ]

  it('every accepted list gives both roots, and each one makes the printed equation true', () => {
    for (const [id, slotId] of SOLVING) {
      for (const b of build(id, slotId)) {
        const eq = math(b.question.prompt).replace(/^y = /, '')
        const [left, right] = eq.includes('=') ? eq.split('=') : [eq, '0']
        const L = js(left!)
        const R = js(right!)
        for (const a of accepted(b)) {
          const xs = roots(a)
          expect(xs, `${b.seed}: ${a}`).toHaveLength(2)
          expect(new Set(xs).size, `${b.seed}: ${a}`).toBe(2)
          for (const x of xs) expect(Math.abs(L(x) - R(x)), `${b.seed}: x = ${x} in ${eq}`).toBeLessThan(1e-9)
        }
      }
    }
  })

  it('takes the roots in either order and refuses one root alone', () => {
    for (const [id, slotId] of SOLVING) {
      for (const b of build(id, slotId, 100)) {
        const q = b.question
        const xs = roots(accepted(b)[0]!)
        const typed = accepted(b).map((a) => roots(a))
        const shown = (x: number) => accepted(b)[0]!.replace(/[a-z] = /g, '').split(/, | or /).find((p) => Math.abs(roots(p)[0]! - x) < 1e-12)!
        const [A, B] = xs.map(shown) as [string, string]
        expect(typed.length).toBeGreaterThan(0)
        expect(mark(q, `x=${B}, x=${A}`).correct, `${b.seed}: x=${B}, x=${A}`).toBe(true)
        expect(mark(q, `${A}, ${B}`).correct).toBe(true)
        if (slotId !== 'q5' || id !== 'roots-of-a-curve') expect(mark(q, `x = ${B} or x = ${A}`).correct).toBe(true)
        expect(mark(q, `x = ${A}`).correct).toBe(false)
      }
    }
  })

  it('q5 and q11 have a fraction for a root, listed as a decimal too when it ends', () => {
    for (const slotId of ['q5', 'q11']) {
      for (const b of build('solving-ax2-by-factorising', slotId)) {
        const xs = roots(accepted(b)[0]!)
        expect(xs.some((x) => !Number.isInteger(x)), b.seed).toBe(true)
        // A root that ends as a decimal (a half, a quarter, a fifth) is listed that way too.
        const [f1, f2] = accepted(b)[0]!.replace(/x = /g, '').split(' or ') as [string, string]
        const asDecimal = (f: string, x: number) => (Number.isInteger(x * 2 ** 4 * 5 ** 4) ? String(x) : f)
        const decimals = `x = ${asDecimal(f1, xs[0]!)} or x = ${asDecimal(f2, xs[1]!)}`
        if (decimals !== accepted(b)[0]) expect(accepted(b), b.seed).toContain(decimals)
        if (slotId === 'q11') expect(Number(b.values.q) * Number(b.values.s)).toBeLessThan(0)
      }
    }
  })

  it('q2 accepts plus-or-minus', () => {
    for (const b of build('solving-by-square-roots', 'q2', 50)) expect(mark(b.question, `x = ±${b.values.a}`).correct).toBe(true)
  })
})

describe('completing the square', () => {
  it('every accepted form expands back to the printed quadratic and has the asked-for shape', () => {
    for (const slotId of ['q6', 'q12']) {
      for (const b of build('completing-the-square', slotId)) {
        const target = js(math(b.question.prompt))
        for (const a of accepted(b)) {
          expect(a).toMatch(slotId === 'q6' ? /^\(x[+-]\d+\)\^2[+-]\d+$/ : /^[2-9]\(x[+-]\d+\)\^2[+-]\d+$/)
          expect(sameFunction(js(a), target), `${b.seed}: ${a}`).toBe(true)
        }
        const [, inside, rest] = accepted(b)[0]!.match(/\(x([+-]\d+)\)\^2([+-]\d+)/)!
        const n = Number(inside!.slice(1))
        const swapped = `${accepted(b)[0]!.split('(')[0]}(${inside![0] === '+' ? '' : '-'}${n}+x)^2${rest}`
        expect(mark(b.question, swapped).correct, `${b.seed}: ${swapped}`).toBe(true)
      }
    }
  })
})

describe('the quadratic formula', () => {
  it('gives the asked-for root to 2 d.p., with the grade 8-9 slot keeping a above 1 and b and c negative', () => {
    for (const slotId of ['q7', 'q15']) {
      for (const b of build('quadratic-formula', slotId)) {
        const q = b.question
        if (q.type !== 'numeric') throw new Error('not numeric')
        const [eq] = math(q.prompt).split('=')
        const f = js(eq!)
        const { a, b: bb, c } = b.values as { a: number; b: number; c: number }
        const D = bb * bb - 4 * a * c
        const both = [(-bb - Math.sqrt(D)) / (2 * a), (-bb + Math.sqrt(D)) / (2 * a)]
        const want = /larger/.test(q.prompt) ? both[1]! : both[0]!
        expect(Math.abs(f(want))).toBeLessThan(1e-9)
        expect(q.answer, b.seed).toBe(Math.round(want * 100) / 100)
        if (slotId === 'q15') expect(a >= 2 && bb < 0 && c < 0).toBe(true)
      }
    }
  })

  it('q19 gives the positive root exactly, the number under the root square-free', () => {
    for (const b of build('quadratic-formula-exact', 'q19')) {
      const f = js(math(b.question.prompt).split('=')[0]!)
      for (const a of accepted(b)) {
        const x = js(a.replace(/^x = /, ''))(0)
        expect(x).toBeGreaterThan(0)
        expect(Math.abs(f(x))).toBeLessThan(1e-9)
        const n = Number(a.match(/√(\d+)/)![1])
        expect(squareFree(n), `${b.seed}: ${a}`).toBe(true)
      }
    }
  })
})

describe('quadratic inequalities', () => {
  const interval = (typed: string) => {
    const s = typed.replace(/\s+/g, '').replace(/[⩽≤]/g, '<=').replace(/[⩾≥]/g, '>=')
    const m = s.match(/^(-?\d+)(<=?|>=?)x(<=?|>=?)(-?\d+)$/)!
    const [lo, hi] = m[2]![0] === '<' ? [Number(m[1]), Number(m[4])] : [Number(m[4]), Number(m[1])]
    return (x: number) => (m[2]!.includes('=') ? lo <= x && x <= hi : lo < x && x < hi)
  }

  it('every accepted interval is where the printed inequality holds, tested either side of each root', () => {
    for (const slotId of ['q5', 'q7', 'q11']) {
      for (const b of build('quadratic-inequality-interval', slotId)) {
        const tex = math(b.question.prompt)
        const [left, right] = tex.split(/<|\\leqslant/)
        const L = js(left!)
        const R = js(right!)
        const strict = !tex.includes('leqslant')
        for (const a of accepted(b)) {
          const inside = interval(a)
          for (let x = -15; x <= 15; x += 0.25) {
            const holds = strict ? L(x) - R(x) < 0 : L(x) - R(x) <= 1e-12
            expect(inside(x), `${b.seed}: ${a} at ${x} for ${tex}`).toBe(holds)
          }
        }
      }
    }
  })

  it('counts the integers in q9 by testing every whole number', () => {
    for (const b of build('integers-in-a-quadratic-inequality', 'q9')) {
      const q = b.question
      if (q.type !== 'numeric') throw new Error('not numeric')
      const tex = math(q.prompt)
      const [left] = tex.split(/<|\\leqslant/)
      const f = js(left!)
      let n = 0
      for (let x = -50; x <= 50; x++) if (tex.includes('leqslant') ? f(x) <= 0 : f(x) < 0) n++
      expect(q.answer, b.seed).toBe(n)
    }
  })
})

describe('quadratic curves', () => {
  it('finds the turning point midway between the roots, and its height by substitution', () => {
    for (const b of build('turning-point-from-roots', 'q6')) {
      const [p, q] = [...b.question.prompt.matchAll(/x = (-?\d+)/g)].map((m) => Number(m[1]))
      expect(accepted(b)[0]).toBe(String((p! + q!) / 2))
    }
    for (const b of build('turning-point-y', 'q10')) {
      const f = js(math(b.question.prompt).replace('y = ', ''))
      const h = Number(math(b.question.prompt, 1))
      expect(Number(accepted(b)[0])).toBe(f(h))
      expect(f(h + 0.5)).toBeGreaterThan(f(h))
      expect(f(h - 0.5)).toBeGreaterThan(f(h))
    }
  })
})

describe('algebraic fractions', () => {
  it('every accepted fraction has the printed value everywhere, and nothing left to cancel', () => {
    for (const [id, slotId] of [['same-denominator-fractions', 'q3'], ['adding-algebraic-fractions', 'q8'], ['adding-algebraic-fractions', 'q12']] as const) {
      for (const b of build(id, slotId)) {
        const target = js(math(b.question.prompt))
        for (const a of accepted(b)) {
          expect(sameFunction(js(a), target), `${b.seed}: ${a} for ${b.question.prompt}`).toBe(true)
          // In simplest form: the numerator is not zero where the denominator is.
          const cut = a.indexOf('/(')
          const top = js(a.slice(0, cut))
          const bottom = js(a.slice(cut + 1))
          for (let x = -12; x <= 12; x++) if (Math.abs(bottom(x)) < 1e-12) expect(Math.abs(top(x)), `${b.seed}: ${a} cancels at ${x}`).toBeGreaterThan(1e-9)
        }
      }
    }
  })

  it('solves q14 to a value that makes both sides equal and neither denominator zero', () => {
    for (const b of build('algebraic-fraction-equation', 'q14')) {
      const q = b.question
      if (q.type !== 'numeric') throw new Error('not numeric')
      const [left, right] = math(q.prompt).split('=')
      const L = js(left!)(q.answer)
      const R = js(right!)(q.answer)
      expect(Number.isFinite(L) && Number.isFinite(R)).toBe(true)
      expect(L).toBeCloseTo(R, 12)
    }
  })
})

describe('surds', () => {
  const SIMPLEST: [string, string][] = [
    ['simplifying-a-surd', 'q3'],
    ['adding-surds', 'q4'],
    ['rationalising-a-surd', 'q5'],
    ['expanding-surd-brackets', 'q6'],
    ['rationalising-with-a-conjugate', 'q9'],
    ['simplifying-a-surd-fraction', 'q13'],
    ['rationalising-with-a-conjugate', 'q15'],
  ]

  it('leaves no square factor under any root, and every accepted form has the value of the printed question', () => {
    for (const [id, slotId] of SIMPLEST) {
      for (const b of build(id, slotId)) {
        const value = js(math(b.question.prompt))(0)
        for (const a of accepted(b)) {
          for (const [, n] of a.matchAll(/√(\d+)/g)) expect(squareFree(Number(n)), `${b.seed}: ${a}`).toBe(true)
          expect(js(a)(0), `${b.seed}: ${a} for ${b.question.prompt}`).toBeCloseTo(value, 9)
        }
      }
    }
  })

  it('leaves no root below a fraction line once the denominator is rationalised', () => {
    for (const [id, slotId] of [['rationalising-a-surd', 'q5'], ['rationalising-with-a-conjugate', 'q9'], ['rationalising-with-a-conjugate', 'q15']] as const) {
      for (const b of build(id, slotId)) {
        for (const a of accepted(b)) {
          expect(a, b.seed).not.toMatch(/\/√|\/\([^)]*√/)
          // Every slash is followed by a whole number.
          for (const m of a.matchAll(/\/(.)/g)) expect(m[1], `${b.seed}: ${a}`).toMatch(/\d/)
        }
      }
    }
  })

  it('q15 has nothing that cancels, and the marker takes the forms the written question lists', () => {
    for (const b of build('rationalising-with-a-conjugate', 'q15')) {
      const { a, m, n } = b.values as { a: number; m: number; n: number }
      const d = a * a - m
      expect(gcdBrute(n, d)).toBe(1)
      expect(gcdBrute(n * a, d)).toBe(1)
      expect(accepted(b)).toHaveLength(5)
    }
  })

  it('writes q17 as one root of a number that is not a square, worth the same', () => {
    for (const b of build('surd-as-a-single-root', 'q17')) {
      const N = Number(accepted(b)[0]!.slice(1))
      expect(Number.isInteger(Math.sqrt(N))).toBe(false)
      expect(Math.sqrt(N)).toBeCloseTo(js(math(b.question.prompt))(0), 9)
    }
  })

  it('takes a typed root as sqrt, √ or √( ) alike', () => {
    for (const b of build('simplifying-a-surd', 'q3', 100)) {
      const [, k, n] = accepted(b)[0]!.match(/^(\d*)√(\d+)$/)!
      for (const typed of [`${k}sqrt${n}`, `${k}√(${n})`, `${k} √${n}`]) expect(mark(b.question, typed).correct, typed).toBe(true)
      // Unsimplified is not simplified.
      expect(mark(b.question, `√${Number(k) ** 2 * Number(n)}`).correct).toBe(false)
    }
  })
})

describe('slots sharing a sheet', () => {
  it('ask different things: q12 and q19 two sign patterns, inequality q5 and q7 two kinds of roots', () => {
    for (let i = 0; i < 200; i++) {
      const adv = sheet('expanding-and-factorising-quadratics', 'advanced', `turn-${i}`)
      const patterns = adv.filter((s) => s.generated?.generatorId === 'factorising-quadratics').map((s) => s.generated!.values.pattern)
      expect(patterns).toHaveLength(2)
      expect(new Set(patterns).size).toBe(2)
      const higher = sheet('quadratic-inequalities', 'higher', `turn-${i}`)
      const cases = higher.filter((s) => s.generated?.generatorId === 'quadratic-inequality-interval').map((s) => s.generated!.values.case)
      expect(cases).toHaveLength(2)
      expect(new Set(cases).size).toBe(2)
    }
  })

  it('rotates between attempts, so a slot does not always ask the same thing', () => {
    const firsts = new Set(Array.from({ length: 40 }, (_, i) => sheet('quadratic-inequalities', 'higher', `turn-${i}`).find((s) => s.question.id === 'q5')!.generated!.values.case))
    expect(firsts.size).toBe(3)
    const patterns = new Set(Array.from({ length: 40 }, (_, i) => sheet('expanding-and-factorising-quadratics', 'advanced', `turn-${i}`).find((s) => s.question.id === 'q12')!.generated!.values.pattern))
    expect(patterns.size).toBe(3)
  })

  it('every written task on a sheet stays the task it was: the core factorising sheet expands, factorises, and squares', () => {
    for (let i = 0; i < 50; i++) {
      const core = sheet('expanding-and-factorising-quadratics', 'core', `turn-${i}`)
      const [q1, q2, q3, q4] = core.map((s) => s.question.prompt)
      expect(q1).toMatch(/^Expand and simplify \$\([^)]+\)\([^)]+\)\$/)
      expect(q2).toMatch(/^Factorise \$/)
      expect(q3).toMatch(/^Factorise \$/)
      expect(q4).toMatch(/^Expand and simplify \$\([^)]+\)\^2\$/)
    }
  })
})
