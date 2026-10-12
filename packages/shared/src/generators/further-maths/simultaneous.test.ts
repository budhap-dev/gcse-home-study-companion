import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate, sheetQuestions } from '../index.ts'
import type { Generated } from '../types.ts'

/**
 * Structural tests for the Further Maths simultaneous-equation generators (8365 2.15, 2.16).
 * Each prompt's equations are read back with this file's own TeX reader (coefficients by
 * evaluating at unit vectors) and solved again here by Cramer's rule; every printed step of
 * the solution is evaluated, the named slips are shown to give another number, and the
 * answers and inputs are shown to spread.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/further-maths')
const TOPIC = 'simultaneous-equations-including-three-unknowns'
const sheetJson = JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8'))
const bank = Question.array().parse(sheetJson.questions)

function build(generatorId: string, slotId: string, count = 300, prefix = 'simultaneous'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = bank.find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `${prefix}-${i}`))
}
function find(generatorId: string, slotId: string, ok: (b: Generated) => boolean): Generated {
  for (let i = 0; i < 40000; i++) {
    const [b] = build(generatorId, slotId, 1, `find-${i}`)
    if (ok(b!)) return b!
  }
  throw new Error(`no build of ${generatorId} ${slotId} matches`)
}
const seed = (generatorId: string, slotId: string, s: string) => generate(GENERATORS.find((x) => x.id === generatorId)!, bank.find((q) => q.id === slotId)!, s)

const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const share = (built: Generated[], pred: (b: Generated) => boolean) => built.filter(pred).length / built.length
const mathOf = (text: string) => [...text.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]!)
/** The printed equations of a text: the maths with an equals sign. */
const equationsOf = (text: string) => mathOf(text).filter((m) => m.includes(' = '))
const asked = (b: Generated) => /Give the value of \$([xyz])\$\.$/.exec(b.question.prompt)![1] as 'x' | 'y' | 'z'

/** This file's own reader of printed TeX: numbers, letters, \frac, \times, powers, brackets, implicit products. */
function tex(src: string, vars: Record<string, number> = {}): number {
  const s = src.replace(/\\left|\\right|\\[,;!]/g, '').replace(/\\[dt]frac/g, '\\frac').replace(/\\times|\\cdot/g, '*').replace(/\s+/g, '')
  let i = 0
  const fail = (): never => {
    throw new Error(`cannot read "${src}" at ${i}`)
  }
  const braced = (): number => {
    if (s[i] !== '{') fail()
    i++
    const v = expr()
    if (s[i] !== '}') fail()
    i++
    return v
  }
  const atom = (): number => {
    if (s.startsWith('\\frac', i)) {
      i += 5
      const top = braced()
      return top / braced()
    }
    if (s[i] === '(') {
      i++
      const v = expr()
      if (s[i] !== ')') fail()
      i++
      return v
    }
    if (s[i] === '{') return braced()
    const num = /^\d+(\.\d+)?/.exec(s.slice(i))
    if (num) {
      i += num[0].length
      return Number(num[0])
    }
    const ch = s[i] ?? ''
    if (/[a-zA-Z]/.test(ch)) {
      i++
      if (!(ch in vars)) fail()
      return vars[ch]!
    }
    return fail()
  }
  const power = (): number => {
    const base = atom()
    if (s[i] !== '^') return base
    i++
    if (s[i] === '{') return base ** braced()
    const d = /^\d/.exec(s.slice(i)) ?? fail()
    i++
    return base ** Number(d[0])
  }
  const unary = (): number => (s[i] === '-' ? (i++, -unary()) : power())
  const starts = () => /[\d(a-zA-Z{]/.test(s[i] ?? '') || s.startsWith('\\frac', i)
  const term = (): number => {
    let v = unary()
    for (;;) {
      if (s[i] === '*') v *= (i++, unary())
      else if (s[i] === '/') v /= (i++, unary())
      else if (starts()) v *= power()
      else return v
    }
  }
  function expr(): number {
    let v = s[i] === '+' ? (i++, term()) : term()
    while (s[i] === '+' || s[i] === '-') {
      const op = s[i++]
      const t = term()
      v = op === '+' ? v + t : v - t
    }
    return v
  }
  const v = expr()
  if (i !== s.length) fail()
  return v
}
/** Left minus right of a printed equation. */
const gap = (eq: string, vars: Record<string, number>) => {
  const [l, r] = eq.split(' = ')
  return tex(l!, vars) - tex(r!, vars)
}
/** A printed linear equation as coefficients and a right-hand side, by evaluating at unit vectors. */
function linear(eq: string, letters: string[]): { coef: number[]; rhs: number } {
  const zero = Object.fromEntries(letters.map((l) => [l, 0]))
  const f0 = gap(eq, zero)
  return { coef: letters.map((l) => gap(eq, { ...zero, [l]: 1 }) - f0), rhs: -f0 }
}
const det2 = (a: number, b: number, c: number, d: number) => a * d - b * c
const det3 = (m: number[][]) => m[0]![0]! * det2(m[1]![1]!, m[1]![2]!, m[2]![1]!, m[2]![2]!) - m[0]![1]! * det2(m[1]![0]!, m[1]![2]!, m[2]![0]!, m[2]![2]!) + m[0]![2]! * det2(m[1]![0]!, m[1]![1]!, m[2]![0]!, m[2]![1]!)
/** Cramer's rule for a square system, written here. */
function cramer(rows: { coef: number[]; rhs: number }[]): number[] {
  const n = rows.length
  const A = rows.map((r) => r.coef)
  const D = n === 2 ? det2(A[0]![0]!, A[0]![1]!, A[1]![0]!, A[1]![1]!) : det3(A)
  expect(D).not.toBe(0)
  return Array.from({ length: n }, (_, k) => {
    const M = A.map((row, i) => row.map((v, j) => (j === k ? rows[i]!.rhs : v)))
    return (n === 2 ? det2(M[0]![0]!, M[0]![1]!, M[1]![0]!, M[1]![1]!) : det3(M)) / D
  })
}
/** Every link of a chain a = b = c evaluates to `value`. */
function chainHolds(math: string, value: number, vars: Record<string, number> = {}) {
  for (const part of math.split(' = ')) expect(tex(part, vars), math).toBeCloseTo(value, 9)
}

function common(built: Generated[], slot: Question, minDistinct = 10, options: { decimals?: boolean } = {}) {
  for (const b of built) {
    const q = b.question
    expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
    expect(`${q.prompt} ${q.solution}`, b.seed).not.toMatch(/\+ -|- -|\+ \+|\+-|(?:^|[^\d.\w{])1[xyzc](?![a-z])|\^1(?!\d)|(?:^|[^\d.])0[xyzc]/)
    expect(q.type === 'numeric' && q.tolerance, b.seed).toBe(0)
    if (!options.decimals) expect(Number.isInteger(answer(b)), b.seed).toBe(true)
    expect(mark(q, String(answer(b))).correct, b.seed).toBe(true)
    expect(mark(q, String(answer(b) + 1)).correct, b.seed).toBe(false)
    expect(q.solution, b.seed).toContain(String(answer(b)))
    expect(b.check.agrees, `${b.seed}: ${b.check.detail}`).toBe(true)
    expect(q.markScheme.map((l) => l.code)).toEqual(['M1', 'A1'])
    expect(q.markScheme[1]!.description).toBe(String(answer(b)).replace('-', '−'))
  }
  const counts = new Map<number, number>()
  const prompts = new Map<string, number>()
  for (const b of built) {
    counts.set(answer(b), (counts.get(answer(b)) ?? 0) + 1)
    prompts.set(b.question.prompt, (prompts.get(b.question.prompt) ?? 0) + 1)
  }
  expect(Math.max(...counts.values()) / built.length).toBeLessThanOrEqual(0.4)
  expect(counts.size).toBeGreaterThanOrEqual(minDistinct)
  expect(prompts.size).toBeGreaterThan(100)
  expect(Math.max(...prompts.values()) / built.length).toBeLessThanOrEqual(0.05)
  expect((prompts.get(slot.prompt) ?? 0) / built.length).toBeLessThanOrEqual(0.05)
}
const slotOf = (id: string) => bank.find((q) => q.id === id)!

// ---------------------------------------------------------------------------------------

describe('fm-simultaneous-linear q1: substitution from x ± y = d', () => {
  const built = build('fm-simultaneous-linear', 'q1')
  const read = (b: Generated) => {
    const eqs = equationsOf(b.question.prompt).map((e) => linear(e, ['x', 'y']))
    expect(eqs).toHaveLength(2)
    const simple = eqs.findIndex((e) => e.coef[0] === 1 && Math.abs(e.coef[1]!) === 1)
    expect(simple, b.question.prompt).toBeGreaterThanOrEqual(0)
    const [x, y] = cramer(eqs) as [number, number]
    return { eqs, simple, x, y, full: eqs[1 - simple]!, s: eqs[simple]!.coef[1]!, d: eqs[simple]!.rhs }
  }
  it('solves the printed pair, with real coefficients, every step, and no slip gives it', () => {
    for (const b of built) {
      const { x, y, simple, full, s, d } = read(b)
      const [a, k] = full.coef as [number, number]
      const c = full.rhs
      expect(answer(b), b.seed).toBe(asked(b) === 'x' ? x : y)
      expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true)
      expect(x * y).not.toBe(0)
      expect([2, 3, 4, 5]).toContain(a)
      expect([2, 3, 4]).toContain(Math.abs(k))
      expect(a).not.toBe(Math.abs(k))
      expect([a, Math.abs(k), Math.abs(c), Math.abs(d)]).not.toContain(Math.abs(answer(b)))
      expect(Math.abs(c)).not.toBe(Math.abs(d))
      // The sign slipped in y = ±(d − x) gives another value of the letter asked.
      if (a + k * s !== 0) {
        const xw = (c + k * s * d) / (a + k * s)
        expect(answer(b)).not.toBe(asked(b) === 'x' ? xw : s * (xw - d))
      }
      const m = /^From the (first|second), \$y = ([^$]+)\$\. Substitute: \$([^$]+) = (-?\d+)\$, so (?:\$(-?\d*)x = (-?\d+)\$ and )?\$x = (-?\d+)\$\. Then \$y = (-?\d+)\$\. Check: \$([^$]+) = (-?\d+)\$\.$/.exec(b.question.solution)
      expect(m, b.question.solution).not.toBeNull()
      expect(m![1]).toBe(simple === 0 ? 'first' : 'second')
      expect(tex(m![2]!, { x })).toBe(y)
      expect(tex(m![3]!, { x })).toBe(c)
      expect(Number(m![4])).toBe(c)
      if (m![5] !== undefined) {
        const K = m![5] === '-' ? -1 : Number(m![5])
        expect(K).toBe(a + k * (-s))
        expect(K * x).toBe(Number(m![6]))
      }
      expect(Number(m![7])).toBe(x)
      expect(Number(m![8])).toBe(y)
      expect(tex(m![9]!)).toBe(c)
      expect(m![9]).toBe(`${a * x} ${k * y < 0 ? '-' : '+'} ${Math.abs(k * y)}`)
    }
  })
  it('spreads answers, the letter asked, the sign in x ± y and which equation comes first', () => {
    common(built, slotOf('q1'), 12)
    const askX = share(built, (b) => asked(b) === 'x')
    expect(askX).toBeGreaterThan(0.45)
    expect(askX).toBeLessThan(0.75)
    expect(share(built, (b) => read(b).s === 1)).toBeGreaterThan(0.25)
    expect(share(built, (b) => read(b).simple === 0)).toBeGreaterThan(0.15)
    // The written pair has y = 0, which is never drawn.
    for (const b of build('fm-simultaneous-linear', 'q1', 1000, 'zero')) expect(b.question.prompt).not.toBe(slotOf('q1').prompt)
  })
  it('writes 3x + 2y = −7 with x − y = −9 step by step (seed review-a)', () => {
    const b = seed('fm-simultaneous-linear', 'q1', 'review-a')
    expect(b.question.prompt).toBe('Solve $3x + 2y = -7$ and $x - y = -9$. Give the value of $x$.')
    expect(b.question.solution).toBe('From the second, $y = x + 9$. Substitute: $3x + 2x + 18 = -7$, so $5x = -25$ and $x = -5$. Then $y = 4$. Check: $-15 + 8 = -7$.')
  })
})

describe('fm-simultaneous-linear q5: both equations scaled', () => {
  const built = build('fm-simultaneous-linear', 'q5')
  const divides = (p: number, q: number) => p % q === 0 || q % p === 0
  it('needs both equations scaled, every step holds, and the answer is never printed', () => {
    for (const b of built) {
      const eqs = equationsOf(b.question.prompt).map((e) => linear(e, ['x', 'y']))
      const [[a1, b1], [a2, b2]] = eqs.map((e) => e.coef) as [[number, number], [number, number]]
      const [c1, c2] = eqs.map((e) => e.rhs) as [number, number]
      const [x, y] = cramer(eqs) as [number, number]
      expect(answer(b), b.seed).toBe(asked(b) === 'x' ? x : y)
      expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true)
      // Neither pair of coefficients divides: no single scaling eliminates a letter.
      expect(divides(a1, a2)).toBe(false)
      expect(divides(Math.abs(b1), Math.abs(b2))).toBe(false)
      expect(a1 > 0 && a2 > 0 && b1 > 0).toBe(true)
      expect([a1, b1, Math.abs(c1), a2, Math.abs(b2), Math.abs(c2)]).not.toContain(Math.abs(answer(b)))
      expect(Math.abs(c1)).not.toBe(Math.abs(c2))
      // Never mirrored (5x + 4y with 4x + 5y): no repeated givens, no 9(x + y) shortcut.
      expect(a1 === Math.abs(b2) && a2 === b1, b.seed).toBe(false)
      const m = /^Multiply the first by \$(\d)\$ and the second by \$(\d)\$: \$([^$]+)\$ and \$([^$]+)\$\. (Add|Subtract the second from the first): (?:\$(-?\d*)x = (-?\d+)\$, so )?\$x = (-?\d+)\$, and then \$([^$]+) = (-?\d+)\$ gives \$y = (-?\d+)\$\.$/.exec(b.question.solution)
      expect(m, b.question.solution).not.toBeNull()
      const [k1, k2] = [Number(m![1]), Number(m![2])]
      expect([k1, k2]).toEqual([Math.abs(b2), b1])
      const s1 = linear(m![3]!, ['x', 'y'])
      const s2 = linear(m![4]!, ['x', 'y'])
      expect(s1).toEqual({ coef: [k1 * a1, k1 * b1], rhs: k1 * c1 })
      expect(s2).toEqual({ coef: [k2 * a2, k2 * b2], rhs: k2 * c2 })
      expect(m![5]).toBe(b2 < 0 ? 'Add' : 'Subtract the second from the first')
      const sign = b2 < 0 ? 1 : -1
      const K = s1.coef[0]! + sign * s2.coef[0]!
      // The eliminated equation keeps to the written size (19x = 38).
      expect(Math.abs(K), b.seed).toBeLessThanOrEqual(25)
      if (m![6] === undefined) expect(K).toBe(1)
      else {
        expect(m![6] === '-' ? -1 : Number(m![6])).toBe(K)
        expect(Number(m![7])).toBe(s1.rhs + sign * s2.rhs)
        expect(K * x).toBe(Number(m![7]))
      }
      expect(Number(m![8])).toBe(x)
      expect(tex(m![9]!, { y })).toBe(c1)
      expect(Number(m![10])).toBe(c1)
      expect(Number(m![11])).toBe(y)
    }
  })
  it('spreads answers, adding and subtracting, the letter asked and the scalings', () => {
    common(built, slotOf('q5'), 10)
    const add = share(built, (b) => b.question.solution.includes('. Add: '))
    expect(add).toBeGreaterThan(0.35)
    expect(add).toBeLessThan(0.6)
    const askY = share(built, (b) => asked(b) === 'y')
    expect(askY).toBeGreaterThan(0.4)
    expect(askY).toBeLessThan(0.7)
    expect(new Set(built.map((b) => /x = (-?\d+)\$, and then/.exec(b.question.solution)![1])).size).toBeGreaterThanOrEqual(10)
    expect(new Set(built.map((b) => b.question.solution.slice(0, 50))).size).toBeGreaterThanOrEqual(8)
  })
  it('keeps the eliminated coefficient to 25, never mirrors, and spreads the answer over 3000 seeds', () => {
    const many = build('fm-simultaneous-linear', 'q5', 3000, 'scaled')
    const sizes = new Map<number, number>()
    const values = new Map<number, number>()
    let largest = 0
    for (const b of many) {
      const [[a1, b1], [a2, b2]] = equationsOf(b.question.prompt).map((e) => linear(e, ['x', 'y']).coef) as [[number, number], [number, number]]
      expect(a1 === Math.abs(b2) && a2 === b1, b.seed).toBe(false)
      // Scaled by |b₂| and b₁, then added when b₂ < 0: the x coefficient left.
      const K = Math.abs(b2) * a1 + (b2 < 0 ? 1 : -1) * b1 * a2
      largest = Math.max(largest, Math.abs(K))
      const v = answer(b)
      sizes.set(Math.abs(v), (sizes.get(Math.abs(v)) ?? 0) + 1)
      values.set(v, (values.get(v) ?? 0) + 1)
    }
    expect(largest).toBeLessThanOrEqual(25)
    expect(largest).toBeGreaterThanOrEqual(19)
    expect(Math.max(...values.values()) / many.length).toBeLessThanOrEqual(0.1)
    // Every size 1 to 9 asked, none over a sixth.
    expect([...sizes.keys()].sort((p, q) => p - q)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(Math.max(...sizes.values()) / many.length).toBeLessThanOrEqual(1 / 6)
  })
  it('writes 3x + 2y = −33 with 2x − 5y = 35 by adding to 19x, as written (seed review-a)', () => {
    const b = seed('fm-simultaneous-linear', 'q5', 'review-a')
    expect(b.question.prompt).toBe('Solve $3x + 2y = -33$ and $2x - 5y = 35$. Give the value of $y$.')
    expect(b.question.solution).toBe('Multiply the first by $5$ and the second by $2$: $15x + 10y = -165$ and $4x - 10y = 70$. Add: $19x = -95$, so $x = -5$, and then $-15 + 2y = -33$ gives $y = -9$.')
  })
})

describe('fm-three-unknowns q8: three unknowns by elimination', () => {
  const built = build('fm-three-unknowns', 'q8')
  const read = (b: Generated) => {
    const eqs = equationsOf(b.question.prompt).map((e) => linear(e, ['x', 'y', 'z']))
    expect(eqs).toHaveLength(3)
    const [x, y, z] = cramer(eqs) as [number, number, number]
    return { eqs, x, y, z, v: { x, y, z } }
  }
  const ordinal = ['first', 'second', 'third']
  it('solves the printed system, with the written shape, every step, and the answer never printed', () => {
    for (const b of built) {
      const { eqs, x, y, z, v } = read(b)
      expect(answer(b), b.seed).toBe(v[asked(b)])
      expect([x, y, z].every(Number.isInteger)).toBe(true)
      expect(new Set([x, y, z]).size).toBe(3)
      expect(eqs[0]!.coef).toEqual([1, 1, 1])
      for (const e of eqs.slice(1)) {
        expect([1, 2]).toContain(e.coef[0])
        expect([1, 2]).toContain(Math.abs(e.coef[1]!))
        expect(Math.abs(e.coef[2]!)).toBe(1)
        expect(e.coef.filter((c) => Math.abs(c) === 2)).toHaveLength(1)
      }
      expect(eqs[1]!.coef.slice(0, 2)).not.toEqual(eqs[2]!.coef.slice(0, 2))
      const sides = eqs.map((e) => Math.abs(e.rhs))
      expect(new Set(sides).size).toBe(3)
      expect(sides).not.toContain(Math.abs(answer(b)))
      expect(Math.abs(answer(b))).toBeGreaterThanOrEqual(3)
      expect(Math.abs(answer(b))).toBeLessThanOrEqual(7)
      const m = /^(Add the (\w+) and (\w+)|Subtract the (\w+) from the (\w+)): \$([^$]+)\$\. (Add the (\w+) and (\w+)|Subtract the (\w+) from the (\w+)): \$([^$]+)\$, so \$y = ([^$]+)\$\. Then \$([^$]+) = (-?\d+)\$ gives (?:\$(-?\d*)x = (-?\d+)\$, so )?\$x = (-?\d+)\$, \$y = (-?\d+)\$, and \$z = ([^$]+)\$\. Check the second: \$([^$]+) = (-?\d+)\$\.$/.exec(b.question.solution)
      expect(m, b.question.solution).not.toBeNull()
      // Each reduced equation is the combination it says it is.
      const combined = (text: string, i: string | undefined, j: string | undefined, k: string | undefined, l: string | undefined) => {
        if (text.startsWith('Add')) {
          const [p, q] = [eqs[ordinal.indexOf(i!)]!, eqs[ordinal.indexOf(j!)]!]
          return { coef: p.coef.map((c, n) => c + q.coef[n]!), rhs: p.rhs + q.rhs }
        }
        const [from, of] = [eqs[ordinal.indexOf(k!)]!, eqs[ordinal.indexOf(l!)]!]
        return { coef: of.coef.map((c, n) => c - from.coef[n]!), rhs: of.rhs - from.rhs }
      }
      const r1 = combined(m![1]!, m![2], m![3], m![4], m![5])
      const r2 = combined(m![7]!, m![8], m![9], m![10], m![11])
      expect(r1.coef[2]).toBe(0)
      expect(r2.coef[2]).toBe(0)
      expect(linear(m![6]!, ['x', 'y'])).toEqual({ coef: r1.coef.slice(0, 2), rhs: r1.rhs })
      expect(linear(m![12]!, ['x', 'y'])).toEqual({ coef: r2.coef.slice(0, 2), rhs: r2.rhs })
      expect(Math.abs(r2.coef[1]!)).toBe(1)
      expect(tex(m![13]!, { x })).toBe(y)
      expect(tex(m![14]!, { x })).toBe(r1.rhs)
      expect(Number(m![15])).toBe(r1.rhs)
      if (m![16] !== undefined) expect((m![16] === '-' ? -1 : Number(m![16])) * x).toBe(Number(m![17]))
      expect([Number(m![18]), Number(m![19])]).toEqual([x, y])
      chainHolds(m![20]!, z)
      expect(m![20]!.startsWith(`${eqs[0]!.rhs} - `)).toBe(true)
      chainHolds(m![21]!, eqs[1]!.rhs)
      expect(Number(m![22])).toBe(eqs[1]!.rhs)
    }
  })
  it('spreads answers over all ten values, every letter asked, adding and subtracting', () => {
    common(built, slotOf('q8'), 10)
    for (const l of ['x', 'y', 'z']) expect(share(built, (b) => asked(b) === l), l).toBeGreaterThan(0.25)
    expect(share(built, (b) => b.question.solution.startsWith('Add'))).toBeGreaterThan(0.3)
    expect(share(built, (b) => b.question.solution.startsWith('Subtract'))).toBeGreaterThan(0.2)
    expect(share(built, (b) => / gives \$-?\d+x = /.test(b.question.solution))).toBeGreaterThan(0.6)
  })
  it('writes the elimination as the written solution does (seed review-a)', () => {
    const b = seed('fm-three-unknowns', 'q8', 'review-a')
    expect(b.question.prompt).toBe('Solve $x + y + z = -4$, $2x + y - z = 14$ and $x + 2y - z = 9$. Give the value of $z$.')
    expect(b.question.solution).toBe('Add the first and third: $2x + 3y = 5$. Subtract the third from the second: $x - y = 5$, so $y = x - 5$. Then $2x - 15 + 3x = 5$ gives $5x = 20$, so $x = 4$, $y = -1$, and $z = -4 - 4 - (-1) = -7$. Check the second: $8 - 1 + 7 = 14$.')
    expect(b.question.markScheme.map((l) => l.description)).toEqual(['eliminates z from two pairs', '−7'])
  })
})

describe('fm-three-unknowns q10: three unknowns by substitution', () => {
  const built = build('fm-three-unknowns', 'q10')
  const read = (b: Generated) => {
    const eqs = equationsOf(b.question.prompt).map((e) => linear(e, ['x', 'y', 'z']))
    expect(eqs).toHaveLength(3)
    const [x, y, z] = cramer(eqs) as [number, number, number]
    return { eqs, v: { x, y, z } as Record<string, number> }
  }
  it('solves the printed system, two ties to one pivot, every step, and the answer never printed', () => {
    for (const b of built) {
      const { eqs, v } = read(b)
      expect(answer(b), b.seed).toBe(v[asked(b)])
      expect(Object.values(v).every(Number.isInteger)).toBe(true)
      expect(new Set(Object.values(v)).size).toBe(3)
      expect(eqs[0]!.coef).toEqual([1, 1, 1])
      for (const e of eqs.slice(1)) {
        expect(e.coef.filter((c) => c !== 0)).toHaveLength(2)
        expect(e.coef.every((c) => Math.abs(c) <= 1)).toBe(true)
        expect(e.rhs).not.toBe(0)
      }
      expect(new Set(eqs.map((e) => Math.abs(e.rhs))).size).toBe(3)
      expect(eqs.map((e) => Math.abs(e.rhs))).not.toContain(Math.abs(answer(b)))
      expect(Math.abs(answer(b))).not.toBe(1)
      const m = /^From the second and third, \$([xyz]) = ([^$]+)\$ and \$([xyz]) = ([^$]+)\$\. Substitute into the first: \$([^$]+) = (-?\d+)\$, so (?:\$(-?\d*)([xyz]) = (-?\d+)\$, )?\$([xyz]) = (-?\d+)\$, and \$([xyz]) = (-?\d+)\$, \$([xyz]) = (-?\d+)\$\.$/.exec(b.question.solution)
      expect(m, b.question.solution).not.toBeNull()
      const P = m![10]!
      expect(new Set([m![1], m![3], P]).size).toBe(3)
      expect(tex(m![2]!, { [P]: v[P]! })).toBe(v[m![1]!])
      expect(tex(m![4]!, { [P]: v[P]! })).toBe(v[m![3]!])
      expect(tex(m![5]!, { [P]: v[P]! })).toBe(eqs[0]!.rhs)
      expect(Number(m![6])).toBe(eqs[0]!.rhs)
      if (m![7] !== undefined) {
        expect(m![8]).toBe(P)
        expect((m![7] === '-' ? -1 : Number(m![7])) * v[P]!).toBe(Number(m![9]))
      }
      expect(Number(m![11])).toBe(v[P])
      expect([m![12], Number(m![13])]).toEqual([m![1], v[m![1]!]])
      expect([m![14], Number(m![15])]).toEqual([m![3], v[m![3]!]])
      // A sum tie is printed in alphabetical order.
      for (const e of equationsOf(b.question.prompt).slice(1)) if (e.includes('+')) expect(e).toMatch(/^x \+ [yz]|^y \+ z/)
    }
  })
  it('spreads answers, pivots, ties and the letter asked', () => {
    common(built, slotOf('q10'), 12)
    for (const l of ['x', 'y', 'z']) {
      expect(share(built, (b) => asked(b) === l), l).toBeGreaterThan(0.25)
      expect(share(built, (b) => b.values.pivot === l), l).toBeGreaterThan(0.25)
    }
    expect(share(built, (b) => equationsOf(b.question.prompt).slice(1).some((e) => e.includes('+')))).toBeGreaterThan(0.3)
    expect(share(built, (b) => / so \$x = |, so \$y = |, so \$z = /.test(b.question.solution))).toBeGreaterThan(0.15)
  })
  it('asks a different letter from q8 on every higher sheet', () => {
    const ids: string[] = sheetJson.worksheets.higher.questionIds
    for (let i = 0; i < 100; i++) {
      const sheet = sheetQuestions('further-maths', TOPIC, ids.map((id) => bank.find((q) => q.id === id)!), `turn-${i}`)
      const letters = sheet.filter((s) => s.generated?.generatorId === 'fm-three-unknowns').map((s) => /Give the value of \$([xyz])\$/.exec(s.question.prompt)![1])
      expect(letters).toHaveLength(2)
      expect(letters[0]).not.toBe(letters[1])
    }
  })
  it('writes the substitution as the written solution does (seed review-a)', () => {
    const b = seed('fm-three-unknowns', 'q10', 'review-a')
    expect(b.question.prompt).toBe('Solve $x + y + z = -2$, $x - y = -14$ and $z - y = -12$. Give the value of $y$.')
    expect(b.question.solution).toBe('From the second and third, $x = y - 14$ and $z = y - 12$. Substitute into the first: $y - 14 + y + y - 12 = -2$, so $3y = 24$, $y = 8$, and $x = -6$, $z = -4$.')
  })
})

describe('fm-three-unknowns q14: three prices from three bills', () => {
  const built = build('fm-three-unknowns', 'q14')
  const SINGULAR: Record<string, string> = { coffees: 'coffee', teas: 'tea', cakes: 'cake', loaves: 'loaf', rolls: 'roll', buns: 'bun', 'adult tickets': 'adult ticket', 'child tickets': 'child ticket', 'senior tickets': 'senior ticket', pens: 'pen', pencils: 'pencil', rulers: 'ruler', apples: 'apple', bananas: 'banana', oranges: 'orange', burgers: 'burger', 'hot dogs': 'hot dog', milkshakes: 'milkshake' }
  /** Each item's band in pence; the step by shop (its first item). */
  const BAND: Record<string, [number, number]> = {
    coffee: [200, 475], tea: [100, 300], cake: [150, 400],
    loaf: [100, 350], roll: [50, 150], bun: [50, 200],
    'adult ticket': [600, 1200], 'child ticket': [300, 700], 'senior ticket': [400, 900],
    pen: [50, 250], pencil: [30, 120], ruler: [40, 200],
    apple: [30, 80], banana: [20, 60], orange: [30, 90],
    burger: [250, 600], 'hot dog': [150, 450], milkshake: [150, 400],
  }
  const STEP: Record<string, number> = { coffee: 25, loaf: 25, 'adult ticket': 50, pen: 10, apple: 10, burger: 25 }
  /** [dearer, cheaper]: what a shop's prices must say to be consistent with itself. */
  const DEARER: Record<string, [string, string][]> = {
    coffee: [['coffee', 'tea']],
    loaf: [['loaf', 'roll'], ['loaf', 'bun']],
    'adult ticket': [['adult ticket', 'child ticket'], ['adult ticket', 'senior ticket'], ['senior ticket', 'child ticket']],
    pen: [['pen', 'pencil']],
    apple: [],
    burger: [['burger', 'hot dog']],
  }
  const WORDS: Record<string, number> = { a: 1, an: 1, two: 2, three: 3 }
  /** The bills read from the words: counts in item order, totals in pence, and the items. */
  const read = (b: Generated) => {
    const sentences = [...b.question.prompt.matchAll(/([A-Z][^.]*?) cost £(\d+)\.(\d\d)\./g)]
    expect(sentences, b.question.prompt).toHaveLength(3)
    let items: string[] = []
    const rows = sentences.map((s) => {
      const parts = s[1]!.split(/, | and /)
      expect(parts).toHaveLength(3)
      const names = parts.map((p) => {
        const w = /^(a|an|two|three) (.+)$/i.exec(p)!
        return SINGULAR[w[2]!] ?? w[2]!
      })
      if (!items.length) items = names
      expect(names).toEqual(items)
      return { coef: parts.map((p) => WORDS[/^(\w+) /i.exec(p)![1]!.toLowerCase()]!), rhs: Number(s[2]) * 100 + Number(s[3]) }
    })
    const which = items.indexOf(/price of an? (.+) in pounds\.$/.exec(b.question.prompt)![1]!)
    expect(which).toBeGreaterThanOrEqual(0)
    return { rows, items, which, prices: cramer(rows) }
  }
  it('prices the three items from the words, in scale, with the written patterns, and every step holds', () => {
    for (const b of built) {
      const { rows, items, which, prices } = read(b)
      expect(prices.every((p) => Number.isInteger(p) && p > 0), b.seed).toBe(true)
      expect(answer(b)).toBe(prices[which]! / 100)
      expect(new Set(prices).size).toBe(3)
      expect(new Set(rows.map((r) => r.rhs)).size).toBe(3)
      for (const [j, p] of prices.entries()) {
        const [lo, hi] = BAND[items[j]!]!
        expect(p, items[j]).toBeGreaterThanOrEqual(lo)
        expect(p, items[j]).toBeLessThanOrEqual(hi)
        expect(p % STEP[items[0]!]!).toBe(0)
      }
      const key = rows.map((r) => r.coef.join('')).sort().join(' ')
      expect(['112 121 211', '113 131 311', '111 121 211']).toContain(key)
      // The solution's equations are the bills, and its check line adds up.
      const maths = equationsOf(b.question.solution)
      for (const [i, r] of rows.entries()) expect(linear(maths[i]!, ['x', 'y', 'z'])).toEqual({ coef: r.coef, rhs: r.rhs / 100 })
      const check = /check the (first|second|third): \$([^$]+) = ([\d.]+)\$\.$/.exec(b.question.solution)
      expect(check, b.question.solution).not.toBeNull()
      const row = rows[['first', 'second', 'third'].indexOf(check![1]!)]!
      expect(tex(check![2]!)).toBeCloseTo(row.rhs / 100, 9)
      expect(Number(check![3])).toBeCloseTo(row.rhs / 100, 9)
      expect(check![2]!.split(' + ').map(Number)).toEqual(row.coef.map((n, j) => (n * prices[j]!) / 100))
      const sum = prices.reduce((s, p) => s + p, 0) / 100
      expect(b.question.solution).toContain(`$x + y + z = ${sum}$`)
      // Each price is reached: $z = 5 - 4.4 = 0.6$, $x = 1.4$, or $z = 2.25$ after $2z = 4.5$.
      for (const [j, l] of ['x', 'y', 'z'].entries()) expect(b.question.solution).toMatch(new RegExp(`\\$${l} = (?:[^$]+ = )?${prices[j]! / 100}\\$`))
      expect(b.question.solution.startsWith(`With ${items[0]} $x$, ${items[1]} $y$ and ${items[2]} $z$: `)).toBe(true)
    }
  })
  it('spreads shops, patterns, the item asked and the prices', () => {
    common(built, slotOf('q14'), 20, { decimals: true })
    expect(new Set(built.map((b) => read(b).items[0])).size).toBe(6)
    const doubled = share(built, (b) => b.values.pattern === 'doubled')
    expect(doubled).toBeGreaterThan(0.45)
    expect(doubled).toBeLessThan(0.75)
    expect(share(built, (b) => b.values.pattern === 'tripled')).toBeGreaterThan(0.08)
    expect(share(built, (b) => b.values.pattern === 'one plain')).toBeGreaterThan(0.15)
    for (const i of [0, 1, 2]) expect(share(built, (b) => read(b).which === i)).toBeGreaterThan(0.25)
    expect(share(built, (b) => !Number.isInteger(answer(b)))).toBeGreaterThan(0.6)
    for (const b of built) expect(mark(b.question, `£${answer(b).toFixed(2)}`).correct, b.seed).toBe(true)
  })
  it('keeps every shop consistent with itself over 3000 seeds: an adult ticket dearer than a child or senior one, a loaf than a roll', () => {
    const many = build('fm-three-unknowns', 'q14', 3000, 'shops')
    const seen = new Map<string, number>()
    for (const b of many) {
      const { items, prices } = read(b)
      const price = (item: string) => prices[items.indexOf(item)]!
      for (const [dear, cheap] of DEARER[items[0]!]!) expect(price(dear), `${b.seed}: ${dear} against ${cheap}`).toBeGreaterThan(price(cheap))
      seen.set(items[0]!, (seen.get(items[0]!) ?? 0) + 1)
    }
    for (const shop of Object.keys(DEARER)) expect(seen.get(shop) ?? 0, shop).toBeGreaterThan(300)
  })
  it('writes the stationery bills as the written solution does (seeds review-a and review-b)', () => {
    const b = seed('fm-three-unknowns', 'q14', 'review-a')
    expect(b.question.prompt).toBe('A pen, two pencils and a ruler cost £4.50. A pen, a pencil and two rulers cost £3.90. Two pens, a pencil and a ruler cost £4.80. Work out the price of a ruler in pounds.')
    expect(b.question.solution).toBe('With pen $x$, pencil $y$ and ruler $z$: $x + 2y + z = 4.5$, $x + y + 2z = 3.9$, $2x + y + z = 4.8$. Adding all three gives $4(x + y + z) = 13.2$, so $x + y + z = 3.3$. Subtracting that from the second equation leaves $z = 3.9 - 3.3 = 0.6$. Likewise $x = 1.5$ and $y = 1.2$; check the third: $3 + 1.2 + 0.6 = 4.8$.')
    expect(b.question.markScheme.map((l) => l.description)).toEqual(['three equations', '0.6'])
    const plain = seed('fm-three-unknowns', 'q14', 'review-b')
    expect(plain.question.solution).toBe('With pen $x$, pencil $y$ and ruler $z$: $2x + y + z = 5.8$, $x + y + z = 3.4$, $x + 2y + z = 3.8$. The second equation gives $x + y + z = 3.4$ directly. Subtracting it from the first leaves $x = 5.8 - 3.4 = 2.4$, and from the third, $y = 3.8 - 3.4 = 0.4$. Then $z = 3.4 - 2.4 - 0.4 = 0.6$; check the first: $4.8 + 0.4 + 0.6 = 5.8$.')
  })
})

describe('fm-line-and-curve q11: a tangent by the discriminant', () => {
  const built = build('fm-line-and-curve', 'q11')
  const read = (b: Generated) => {
    const [t1, t2] = [...b.question.prompt.matchAll(/\$y = ([^$]+)\$/g)].map((m) => m[1]!) as [string, string]
    const [line, curve] = t1.includes('c') ? [t1, t2] : [t2, t1]
    const at = (v: number) => tex(curve, { x: v })
    const k = at(0)
    const a = (at(1) + at(-1)) / 2 - k
    const bb = at(1) - a - k
    const m = tex(line, { x: 1, c: 0 })
    return { line, curve, a, b: bb, k, m }
  }
  it('makes the discriminant zero, touches without crossing, every step holds, and no slip gives it', () => {
    for (const b of built) {
      const { line, curve, a, b: bb, k, m } = read(b)
      const c = answer(b)
      expect(Math.abs(a), b.seed).toBe(1)
      expect(k).not.toBe(0)
      expect(Math.abs(m % 2)).toBe(0)
      expect(Math.abs(bb % 2)).toBe(0)
      expect(m).not.toBe(bb)
      // ±x² + bx + k = mx + c has a repeated root: (b − m)² = 4a(k − c).
      expect((bb - m) ** 2).toBe(4 * a * (k - c))
      const d = (bb - m) ** 2
      for (const s of [k, k - a * d, k + (a * d) / 4, k - (a * d) / 2]) expect(c, `${b.seed}: ${s}`).not.toBe(s)
      expect([Math.abs(m), Math.abs(bb), Math.abs(k)]).not.toContain(Math.abs(c))
      const touch = /The touch is at \$x = (-?\d+)\$, \$\((-?\d+), (-?\d+)\)\$\.$/.exec(b.question.solution)!
      const x0 = Number(touch[1])
      expect(Number(touch[2])).toBe(x0)
      expect(tex(curve, { x: x0 })).toBe(Number(touch[3]))
      expect(tex(line, { x: x0, c })).toBe(Number(touch[3]))
      const g = (x: number) => tex(curve, { x }) - tex(line, { x, c })
      expect(g(x0 - 1) * g(x0 + 1)).toBeGreaterThan(0)
      const maths = equationsOf(b.question.solution)
      expect(maths[0]).toBe(`${curve} = ${line}`)
      // The quadratic printed is zero at the touch and 1 one step away: a double root.
      const quad = maths[1]!.replace(/ = 0$/, '')
      expect(tex(quad, { x: x0, c })).toBe(0)
      expect(tex(quad, { x: x0 + 1, c })).toBe(1)
      const disc = /^(\d+) - 4\(([^)]+)\) = 0$/.exec(maths[2]!)!
      expect(Number(disc[1])).toBe(d)
      expect(tex(disc[2]!, { c })).toBe(d / 4)
      expect(maths[3]).toBe(`4(${disc[2]}) = ${d}`)
      expect(maths[4]).toBe(`${disc[2]} = ${d / 4}`)
      expect(maths[5]).toBe(`c = ${c}`)
      expect(b.question.markScheme[0]!.description).toBe(`discriminant of ${quad.replace('x^2', 'x²').replace('+ (-', '- ').replace('+ (', '+ ').replace(')', '').replace(/-/g, '−')}`)
    }
  })
  it('spreads answers, gradients, curves and both phrasings; never y = x² (q18 on the same sheet)', () => {
    common(built, slotOf('q11'), 25)
    expect(share(built, (b) => read(b).a === -1)).toBeGreaterThan(0.1)
    expect(share(built, (b) => read(b).b !== 0)).toBeGreaterThan(0.15)
    expect(share(built, (b) => read(b).m < 0)).toBeGreaterThan(0.3)
    expect(new Set(built.map((b) => read(b).m)).size).toBe(8)
    expect(share(built, (b) => b.question.prompt.startsWith('Find the value'))).toBeGreaterThan(0.3)
    for (const b of build('fm-line-and-curve', 'q11', 1000, 'square')) expect(b.question.prompt).not.toMatch(/y = -?x\^2\$/)
  })
  it('writes the written 2x + c against x² + 4 as the written solution does', () => {
    const b = find('fm-line-and-curve', 'q11', (b) => b.question.prompt === slotOf('q11').prompt)
    expect(b.question.solution).toBe('Equate: $x^2 + 4 = 2x + c$, so $x^2 - 2x + (4 - c) = 0$. A tangent gives a repeated root, so the discriminant is zero: $4 - 4(4 - c) = 0$, so $4(4 - c) = 4$, $4 - c = 1$ and $c = 3$. The touch is at $x = 1$, $(1, 5)$.')
    expect(b.question.markScheme.map((l) => l.description)).toEqual(['discriminant of x² − 2x + 4 − c', '3'])
  })
})

describe('fm-line-and-curve q16: a product with a difference or a sum', () => {
  const built = build('fm-line-and-curve', 'q16')
  const read = (b: Generated) => {
    const eqs = mathOf(b.question.prompt)
    const product = eqs.find((e) => e.startsWith('xy = '))!
    const other = eqs.find((e) => !e.startsWith('xy'))!
    const P = Number(product.slice(5))
    const lin = linear(other, ['x', 'y'])
    const sum = lin.coef[1] === 1
    const wording = /Give the (positive|larger) value of \$([xy])\$\.$/.exec(b.question.prompt)!
    return { product, other, P, sum, rhs: lin.rhs, word: wording[1]!, letter: wording[2]! }
  }
  it('finds both pairs from the printed equations, the asked one is the positive or larger, and every step holds', () => {
    for (const b of built) {
      const { product, other, P, sum, rhs, word, letter } = read(b)
      // x² − sx + P = 0 or x² − dx − P = 0: both roots whole, by the formula.
      const D = sum ? rhs * rhs - 4 * P : rhs * rhs + 4 * P
      const roots = [(rhs + Math.sqrt(D)) / 2, (rhs - Math.sqrt(D)) / 2]
      expect(roots.every(Number.isInteger), b.seed).toBe(true)
      const pairs = roots.map((x) => [x, sum ? rhs - x : x - rhs] as [number, number])
      for (const [x, y] of pairs) {
        expect(gap(product, { x, y })).toBe(0)
        expect(gap(other, { x, y })).toBe(0)
      }
      const values = pairs.map(([x, y]) => (letter === 'x' ? x : y))
      if (sum) {
        expect(word).toBe('larger')
        expect(letter).toBe('x')
        expect(answer(b)).toBe(Math.max(...values))
      } else {
        expect(word).toBe('positive')
        expect(values.filter((v) => v > 0)).toEqual([answer(b)])
      }
      expect(P).toBeLessThanOrEqual(60)
      expect([P, Math.abs(rhs)]).not.toContain(answer(b))
      expect(answer(b)).toBeGreaterThanOrEqual(2)
      expect(`${product} ${other}`).not.toBe('xy = 8 x + y = 6')
      const maths = mathOf(b.question.solution)
      const quad = maths.find((m) => / = 0$/.test(m) && !m.startsWith('('))!.replace(/ = 0$/, '')
      const v = letter
      for (const val of values) expect(Math.abs(tex(quad, { [v]: val }))).toBe(0)
      const factored = maths.find((m) => m.startsWith('('))!.replace(/ = 0$/, '')
      for (const val of values) expect(Math.abs(tex(factored, { [v]: val }))).toBe(0)
      expect(b.question.solution.endsWith(`The ${word} $${letter}$ is $${answer(b)}$.`)).toBe(true)
      expect(b.question.markScheme[0]!.description).toBe(`${quad.replace('^2', '²').replace(/-/g, '−')} = 0`)
      // Both solution pairs are printed.
      for (const [x, y] of pairs) expect(b.question.solution).toContain(letter === 'x' ? `$x = ${x}$, $y = ${y}$` : `$y = ${y}$, $x = ${x}$`)
    }
  })
  it('spreads answers, the sum form, asking y, and the order of the equations', () => {
    common(built, slotOf('q16'), 9)
    expect(share(built, (b) => read(b).sum)).toBeGreaterThan(0.15)
    expect(share(built, (b) => read(b).letter === 'y')).toBeGreaterThan(0.12)
    expect(share(built, (b) => !b.question.prompt.startsWith('Solve $xy'))).toBeGreaterThan(0.2)
  })
  it('writes the written xy = 12, x − y = 1 exactly as the written solution does', () => {
    const b = find('fm-line-and-curve', 'q16', (b) => b.question.prompt === slotOf('q16').prompt)
    expect(b.question.solution).toBe('$y = x - 1$, so $x(x - 1) = 12$ and $x^2 - x - 12 = 0$, giving $(x - 4)(x + 3) = 0$. $x = 4$, $y = 3$ or $x = -3$, $y = -4$. The positive $x$ is $4$.')
    expect(b.question.markScheme.map((l) => l.description)).toEqual(['x² − x − 12 = 0', '4'])
  })
})

describe('every draw succeeds', () => {
  it('over 3000 seeds per slot', () => {
    const slots: [string, string][] = [
      ['fm-simultaneous-linear', 'q1'], ['fm-simultaneous-linear', 'q5'],
      ['fm-three-unknowns', 'q8'], ['fm-three-unknowns', 'q10'], ['fm-three-unknowns', 'q14'],
      ['fm-line-and-curve', 'q11'], ['fm-line-and-curve', 'q16'],
    ]
    for (const [id, slot] of slots) {
      const all = build(id, slot, 3000, 'many')
      expect(all.every((b) => b.check.agrees), `${id} ${slot}`).toBe(true)
    }
  }, 120_000)
})
