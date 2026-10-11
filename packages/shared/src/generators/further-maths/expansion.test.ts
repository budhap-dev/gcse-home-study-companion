import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { ENDS, SINGLE_Q11, SINGLE_Q6 } from './expansion.ts'

/**
 * Structural tests for the Further Maths expansion generators. Each reads the prompt back with
 * this file's own reader (TeX rewritten to a JavaScript function, its coefficients found by
 * finite differences, binomial numbers from factorials), never the generators' polynomial
 * helpers, and checks every printed step, the named wrong routes, the spread and the wording.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/further-maths')
const bankOf = (topic: string) => Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${topic}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300, prefix = 'expansion'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = bankOf(g.topicId).find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `${prefix}-${i}`))
}
function find(generatorId: string, slotId: string, ok: (b: Generated) => boolean): Generated {
  for (let i = 0; i < 20000; i++) {
    const [b] = build(generatorId, slotId, 1, `find-${i}`)
    if (ok(b!)) return b!
  }
  throw new Error(`no build of ${generatorId} ${slotId} matches`)
}

const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const math = (text: string, k = 0) => [...text.matchAll(/\$([^$]+)\$/g)][k]![1]!
const share = (built: Generated[], pred: (b: Generated) => boolean) => built.filter(pred).length / built.length
const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1))
const nCr = (n: number, r: number) => fact(n) / (fact(r) * fact(n - r))

/** TeX as a JavaScript function of one letter: brackets, implicit multiplication, ^digit. */
function js(tex: string, letter: string): (x: number) => number {
  let s = tex.replace(/\\left|\\right/g, '').replace(/\s+/g, '').replace(/\^\{(\d+)\}/g, '^$1')
  s = s.replace(new RegExp(letter, 'g'), 'X')
  if (/[^\dX+\-()^]/.test(s)) throw new Error(`cannot read ${tex}`)
  s = s.replace(/([\dX)])(?=[(X])/g, '$1*').replace(/\^(\d)/g, '**$1')
  // A unary minus in front of a power must be bracketed for JavaScript: -X**2 is a syntax error.
  s = s.replace(/(^|[(*+-])-(X\*\*\d|\d+\*\*\d)/g, '$1-($2)')
  return new Function('X', `return ${s}`) as (x: number) => number
}

/** The coefficients, lowest power first, of a polynomial of degree at most `deg`: forward differences at 0, 1, 2, … */
function coefficients(f: (x: number) => number, deg: number): number[] {
  let row = Array.from({ length: deg + 1 }, (_, x) => f(x))
  const diffs: number[] = []
  for (let k = 0; k <= deg; k++) {
    diffs.push(row[0]!)
    row = row.slice(1).map((v, i) => v - row[i]!)
  }
  // Σ Δ^k f(0) × x(x − 1)…(x − k + 1) / k!
  const out = Array(deg + 1).fill(0)
  let falling = [1]
  for (let k = 0; k <= deg; k++) {
    falling.forEach((c, i) => (out[i] += (diffs[k]! * c) / fact(k)))
    falling = [...falling.map((c, i) => -k * c + (falling[i - 1] ?? 0)), falling[falling.length - 1]!]
  }
  return out.map((c) => Math.round(c))
}

/** A bracket (A ± B)^n read from the prompt: the letter's coefficient, the constant, n, the letter. */
function bracket(prompt: string) {
  const m = /\$\(([^)]+)\)\^(\d)\$/.exec(prompt)
  if (!m) throw new Error(`no bracket in ${prompt}`)
  const inner = m[1]!
  const n = Number(m[2])
  const letter = /[a-z]/.exec(inner)![0]
  const f = js(inner, letter)
  return { inner, n, letter, k: f(1) - f(0), c: f(0) }
}

const ROWS: Record<number, string> = {
  3: '1, 3, 3, 1',
  4: '1, 4, 6, 4, 1',
  5: '1, 5, 10, 10, 5, 1',
  6: '1, 6, 15, 20, 15, 6, 1',
  7: '1, 7, 21, 35, 35, 21, 7, 1',
  8: '1, 8, 28, 56, 70, 56, 28, 8, 1',
}

function common(built: Generated[]) {
  for (const b of built) {
    const q = b.question
    expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
    expect(`${q.prompt} ${q.solution}`, b.seed).not.toMatch(/\+ -|- -|\+-|(?:^|[^\d.\w{])1[a-z](?![a-z])|\^1(?!\d)|\^\{1\}|\b0[a-z]/)
    expect(tolerance(b), b.seed).toBe(0)
    expect(Number.isInteger(answer(b)), b.seed).toBe(true)
    expect(mark(q, String(answer(b))).correct, b.seed).toBe(true)
    expect(mark(q, String(answer(b) + 1)).correct, b.seed).toBe(false)
    expect(q.solution, b.seed).toContain(String(answer(b)))
  }
  const counts = new Map<number, number>()
  for (const b of built) counts.set(answer(b), (counts.get(answer(b)) ?? 0) + 1)
  expect(Math.max(...counts.values()) / built.length).toBeLessThanOrEqual(0.4)
  expect(counts.size).toBeGreaterThanOrEqual(10)
  expect(new Set(built.map((b) => b.question.prompt)).size).toBeGreaterThan(100)
}

describe('fm-binomial-cube (q2)', () => {
  const built = build('fm-binomial-cube', 'q2')

  it('asks the coefficient of x² or x in a cube, the answer read back by multiplying the printed bracket out', () => {
    for (const b of built) {
      const { inner, n, letter, k, c } = bracket(b.question.prompt)
      expect(n).toBe(3)
      expect(Math.abs(k)).toBe(1)
      expect(Math.abs(c)).toBeGreaterThanOrEqual(2)
      expect(Math.abs(c)).toBeLessThanOrEqual(10)
      const power = b.question.prompt.includes(`coefficient of $${letter}^2$`) ? 2 : 1
      expect(b.question.prompt).toContain(power === 2 ? `$${letter}^2$` : `coefficient of $${letter}$`)
      const coef = coefficients(js(`(${inner})^3`, letter), 3)
      expect(answer(b), b.seed).toBe(coef[power])
      expect(b.question.solution).toMatch(/^Row 3 gives \$1, 3, 3, 1\$, so the /)
      // The printed product 3 × … × … is the answer.
      const product = /= (-?\d+)[a-z]/.exec(b.question.solution)![1]
      expect(Number(product)).toBe(answer(b))
    }
  })

  it('never gives the answer by a named slip: the bare entry 3, the constant left unpowered, the wrong end of the row', () => {
    for (const b of built) {
      const { k, c } = bracket(b.question.prompt)
      const power = Number(b.values.power)
      expect(Math.abs(answer(b))).not.toBe(3)
      // The wrong end: the constant takes the letter's power.
      expect(answer(b)).not.toBe(3 * k ** (3 - power) * c ** power)
      // For x, the constant left unsquared.
      if (power === 1) expect(Math.abs(answer(b))).not.toBe(Math.abs(3 * c))
      // Never a constant of 3, whose 3 × 3 and 3² pay for slips; never 2 for the x term (3 × 2² = 3 × 2 × 2).
      expect(Math.abs(c), b.seed).not.toBe(3)
      if (power === 1) expect(Math.abs(c), b.seed).toBeGreaterThanOrEqual(4)
    }
  })

  it('spreads its answers, forms and letters', () => {
    common(built)
    expect(new Set(built.map((b) => b.values.form)).size).toBe(4)
    expect(share(built, (b) => b.values.power === 2)).toBeGreaterThan(0.45)
    expect(share(built, (b) => b.values.power === 2)).toBeLessThan(0.75)
  })

  it('writes the written solution, word for word, for (x + 4)³ and x²; the written (x + 3)³ is left out for its 3s', () => {
    const b = find('fm-binomial-cube', 'q2', (b) => b.question.prompt === 'In the expansion of $(x + 4)^3$, what is the coefficient of $x^2$?')
    expect(b.question.solution).toBe('Row 3 gives $1, 3, 3, 1$, so the $x^2$ term is $3 \\times x^2 \\times 4 = 12x^2$. The full cube is $x^3 + 12x^2 + 48x + 64$.')
    expect(answer(b)).toBe(12)
  })
})

describe('fm-binomial-coefficient (q6, q11)', () => {
  for (const slotId of ['q6', 'q11']) {
    const built = build('fm-binomial-coefficient', slotId)

    it(`${slotId}: the coefficient agrees with the printed bracket multiplied out, and every printed step holds`, () => {
      for (const b of built) {
        const { inner, n, letter, k, c } = bracket(b.question.prompt)
        const r = Number(new RegExp(`coefficient of \\$${letter}\\^(\\d)\\$`).exec(b.question.prompt)![1])
        expect(answer(b), b.seed).toBe(coefficients(js(`(${inner})^${n}`, letter), n)[r])
        expect(answer(b)).toBe(nCr(n, r) * c ** (n - r) * k ** r)
        expect(b.question.solution).toContain(`Row ${n} is $${ROWS[n]}$; the $${letter}^${r}$ entry is $${nCr(n, r)}$.`)
        expect(b.question.solution).toContain(`$${nCr(n, r)} \\times ${c}^${n - r} \\times (${k === 1 ? '' : k === -1 ? '-' : k}${letter})^${r} = `)
        expect(b.question.solution).toContain(`= ${answer(b)}${letter}^${r}$`)
        if (slotId === 'q6') {
          expect(c).toBe(1)
          expect(Math.abs(answer(b))).toBeLessThanOrEqual(1000)
          expect(b.question.markScheme).toEqual([{ code: 'B1', marks: 1, description: String(answer(b)).replace('-', '−') }])
        } else {
          expect(b.question.prompt).toMatch(/^Use Pascal's triangle to find the coefficient of /)
          expect(Math.abs(answer(b))).toBeGreaterThanOrEqual(150)
          expect(Math.abs(answer(b))).toBeLessThanOrEqual(3000)
          const want = c === 1 ? `${nCr(n, r)} × ${k < 0 ? `(−${-k})` : k}` : `${nCr(n, r)} × ${c}`
          expect(b.question.markScheme[0]!.description.startsWith(want), `${b.seed}: ${b.question.markScheme[0]!.description}`).toBe(true)
        }
      }
    })

    it(`${slotId}: no named slip gives the answer: the bare entry, k unpowered, n for the entry, the constant unpowered`, () => {
      for (const b of built) {
        const { n, letter, k, c } = bracket(b.question.prompt)
        const r = Number(new RegExp(`coefficient of \\$${letter}\\^(\\d)\\$`).exec(b.question.prompt)![1])
        const slips = [
          nCr(n, r), // the bare entry
          nCr(n, r) * c ** (n - r) * k, // k left unpowered
          n * c ** (n - r) * k ** r, // n for the entry
          ...(c === 1 ? [] : [nCr(n, r) * k ** r, nCr(n, r) * c * k ** r]), // the constant unpowered, or to the power 1
        ]
        for (const s of slips) expect(Math.abs(answer(b)), `${b.seed}: ${s}`).not.toBe(Math.abs(s))
        // The wrong end of the row (k to the power n − r, the constant to r) never gives it: r is never n/2.
        expect(2 * r).not.toBe(n)
        expect(nCr(n, r) * c ** r * k ** (n - r), b.seed).not.toBe(answer(b))
      }
    })

    it(`${slotId}: draws the power evenly, so no power is over half the builds, and a negative answer in a fifth`, () => {
      const powers = new Map<number, number>()
      for (const b of built) powers.set(Number(b.values.r), (powers.get(Number(b.values.r)) ?? 0) + 1)
      expect(Math.max(...powers.values()) / built.length).toBeLessThanOrEqual(0.5)
      expect(powers.size).toBeGreaterThanOrEqual(4)
      expect(share(built, (b) => answer(b) < 0)).toBeGreaterThanOrEqual(slotId === 'q6' ? 0.15 : 0.2)
    })

    it(`${slotId}: no one calculation, sign aside, is over a sixth of the builds`, () => {
      // q6 has a single x⁵ calculation, (1 ± 2x)⁷: drawing the power evenly made it a quarter of the slot.
      const calcs = new Map<string, number>()
      for (const b of built) {
        const key = `${b.values.n},${b.values.r},${Math.abs(Number(b.values.k))},${b.values.a ?? 1}`
        calcs.set(key, (calcs.get(key) ?? 0) + 1)
      }
      expect(Math.max(...calcs.values()) / built.length).toBeLessThanOrEqual(1 / 6)
    })

    it(`${slotId}: spreads its answers, rows and signs`, () => {
      common(built)
      expect(new Set(built.map((b) => b.values.n)).size).toBeGreaterThanOrEqual(slotId === 'q6' ? 4 : 3)
      expect(share(built, (b) => Number(b.values.k) < 0)).toBeGreaterThan(0.2)
      if (slotId === 'q11') expect(share(built, (b) => b.values.a !== 1)).toBeGreaterThan(0.3)
    })
  }

  it('keeps q6 at grade 6-7 sizes and q11 at grade 8-9, never the entry n, never a step of 2²', () => {
    for (const s of [...SINGLE_Q6, ...SINGLE_Q11]) {
      expect(s.r).toBeGreaterThanOrEqual(2)
      expect(s.r).toBeLessThanOrEqual(s.n - 2)
      expect(nCr(s.n, s.r)).not.toBe(s.n)
      expect(s.k).toBeGreaterThanOrEqual(2)
      expect(s.a).not.toBe(s.k)
      expect(s.k === 2 && s.r === 2).toBe(false)
      expect(s.a === 2 && s.n - s.r === 2).toBe(false)
    }
    expect(SINGLE_Q6.length).toBeGreaterThanOrEqual(20)
    for (const s of [...SINGLE_Q6, ...SINGLE_Q11]) expect(2 * s.r).not.toBe(s.n)
    // The specification's own (3 + 2x)⁵ and x³ is among q11's.
    expect(SINGLE_Q11.some(({ a, k, n, r }) => a === 3 && k === 2 && n === 5 && r === 3)).toBe(true)
  })

  it('writes the q11 written question exactly when it draws (1 + 3x)⁶ and x⁴', () => {
    const b = find('fm-binomial-coefficient', 'q11', (b) => b.question.prompt === "Use Pascal's triangle to find the coefficient of $x^4$ in the expansion of $(1 + 3x)^6$.")
    expect(b.question.solution).toBe('Row 6 is $1, 6, 15, 20, 15, 6, 1$; the $x^4$ entry is $15$. The term is $15 \\times 1^2 \\times (3x)^4 = 15 \\times 81x^4 = 1215x^4$. The power $4$ applies to the $3$ as well as the $x$.')
    expect(b.question.markScheme.map((l) => l.description)).toEqual(['15 × 3⁴', '1215'])
  })
})

describe('fm-binomial-which-end (q12)', () => {
  const built = build('fm-binomial-which-end', 'q12')

  it('reads the entry from the right end: the answer is the printed bracket multiplied out, the wrong end named and different', () => {
    for (const b of built) {
      const { inner, n, letter, k, c } = bracket(b.question.prompt)
      const r = Number(new RegExp(`coefficient of \\$${letter}\\^(\\d)\\$`).exec(b.question.prompt)![1])
      const coef = coefficients(js(`(${inner})^${n}`, letter), n)
      expect(answer(b), b.seed).toBe(coef[r])
      expect(r).not.toBe(n - r)
      expect(b.question.solution).toContain(`Row ${n} is $${ROWS[n]}$. Here $a = `)
      // The wrong end of the row is the coefficient of the mirror power: printed when it is 2000
      // or less, left as its product when it is larger.
      if (Math.abs(coef[n - r]!) <= 2000) expect(b.question.solution).toContain(`= ${coef[n - r]}$, the coefficient of $${letter}^${n - r}$.`)
      else expect(b.question.solution).toMatch(new RegExp(`would give \\$${nCr(n, r)} \\\\times [^$]+\\$, a different number, the coefficient of \\$${letter}\\^${n - r}\\$\\.$`))
      expect(b.question.solution, b.seed).not.toMatch(/\d{5,}/)
      expect(coef[n - r]).not.toBe(answer(b))
      // The named slips: n for the entry, the constant left unpowered.
      expect(Math.abs(answer(b))).not.toBe(Math.abs(n * c ** (n - r)))
      expect(Math.abs(answer(b))).not.toBe(Math.abs(nCr(n, r)))
      expect(Math.abs(answer(b))).not.toBe(Math.abs(nCr(n, r) * c))
      expect(Math.abs(answer(b))).toBeLessThanOrEqual(2000)
      expect(Math.abs(k)).toBe(1)
    }
  })

  it('spreads its answers, orders and signs', () => {
    common(built)
    expect(share(built, (b) => b.values.letterFirst === 'false')).toBeGreaterThan(0.15)
    expect(share(built, (b) => answer(b) < 0)).toBeGreaterThan(0.1)
    expect(ENDS.every(({ n, r }) => r !== n - r && nCr(n, r) !== n)).toBe(true)
  })

  it('writes the written solution, word for word, for (x + 3)⁶ and x⁴; the written (x + 2)⁶ is left out for its 2² = 2 × 2', () => {
    const b = find('fm-binomial-which-end', 'q12', (b) => b.question.prompt === 'Find the coefficient of $x^4$ in the expansion of $(x + 3)^6$.')
    expect(b.question.solution).toBe(
      'Row 6 is $1, 6, 15, 20, 15, 6, 1$. Here $a = x$ and $b = 3$, and the $x^4$ term has $a^4 b^2$, whose entry is $15$: $15 \\times x^4 \\times 3^2 = 135x^4$. Counting the entry from the wrong end of the row would give $15 \\times 3^4 = 1215$, the coefficient of $x^2$.',
    )
    expect(b.question.markScheme.map((l) => l.description)).toEqual(['the entry with a⁴ b²: 15 × 3²', '135'])
    expect(ENDS.some(({ n, r, b }) => n === 6 && r === 4 && b === 2)).toBe(false)
  })

  it('has a method line whose product, read from its text, is the answer, sign included', () => {
    const sups = '⁰¹²³⁴⁵⁶⁷⁸⁹'
    let negativeLetterOdd = 0
    for (const b of built) {
      const line = b.question.markScheme[0]!.description
      const product = line.split(': ')[1]!
      const value = product.split(' × ').reduce((acc, f) => {
        const m = /^\(?(−?\d+)\)?([⁰¹²³⁴⁵⁶⁷⁸⁹]*)$/.exec(f)!
        const base = Number(m[1]!.replace('−', '-'))
        const power = m[2] ? Number([...m[2]].map((d) => sups.indexOf(d)).join('')) : 1
        return acc * base ** power
      }, 1)
      expect(value, `${b.seed}: ${line} against ${answer(b)}`).toBe(answer(b))
      if (b.values.k === -1 && Number(b.values.r) % 2 === 1) negativeLetterOdd++
    }
    // The case the sign used to go missing in turns up.
    expect(negativeLetterOdd).toBeGreaterThan(5)
  })

  it('never has a step of 2², which 2 × 2 also gives, in the working (the wrong end it names may)', () => {
    for (const b of built) expect(b.question.solution.split('Counting')[0], b.seed).not.toMatch(/\(?-?2\)?\^2(?!\d)/)
  })
})

describe('fm-expand-and-simplify (q8)', () => {
  const built = build('fm-expand-and-simplify', 'q8')

  it('the y² coefficient agrees with the printed expression multiplied out, and each printed step holds', () => {
    for (const b of built) {
      const tex = math(b.question.prompt)
      const letter = math(b.question.prompt, 1)[0]!
      expect(math(b.question.prompt, 1)).toBe(`${letter}^2`)
      const coef = coefficients(js(tex, letter), 3)
      expect(answer(b), b.seed).toBe(coef[2])
      // The three printed products, each "A × B = C", hold at x = 3.
      const terms = /terms are \$(.+?) \\times (.+?) = (.+?)\$ and \$(.+?) \\times (.+?) = (.+?)\$/.exec(b.question.solution)!
      const contributes = /contributes \$(.+?) \\times (.+?) = (.+?)\$/.exec(b.question.solution)!
      for (const [A, B, C] of [terms.slice(1, 4), terms.slice(4, 7), contributes.slice(1, 4)]) {
        expect(js(A!, letter)(3) * js(B!, letter)(3), `${b.seed}: ${A} × ${B} = ${C}`).toBe(js(C!, letter)(3))
      }
      const sum = /So \$(-?\d+) \+ \(?(-?\d+)\)? = (-?\d+)\$/.exec(b.question.solution)!
      expect(Number(sum[1]) + Number(sum[2])).toBe(Number(sum[3]))
      expect(Number(sum[3])).toBe(answer(b))
      // The whole expression printed is the prompt's, multiplied out.
      const whole = /the whole expression is \$([^$]+)\$/.exec(b.question.solution)![1]!
      expect(coefficients(js(whole, letter), 3)).toEqual(coef)
    }
  })

  it('never has a printed number, either sign, as its answer, read from the prompt', () => {
    for (const b of built) {
      const tex = math(b.question.prompt)
      // Every number printed in the expression, its powers taken out.
      const printed = (tex.replace(/\^\d/g, '').match(/\d+/g) ?? []).map(Number)
      expect(printed.length, b.seed).toBeGreaterThanOrEqual(6)
      expect(printed, `${b.seed}: ${tex} -> ${answer(b)}`).not.toContain(Math.abs(answer(b)))
      // Nor do the first product's y² terms cancel, which would pay for ignoring it.
      expect(b.question.solution).not.toContain('cancel')
    }
  })

  it('no named slip gives the answer: the minus not distributed, the multiplier left out, a cross term missed', () => {
    for (const b of built) {
      const { p, a, b: bb, c, d } = b.values as Record<string, number>
      const slips = [p! * a! + bb! + c! * d!, p! * a! + bb! - d!, bb! - c! * d!, p! * a! - c! * d!]
      for (const s of slips) expect(answer(b), b.seed).not.toBe(s)
      expect(a).not.toBe(c)
      expect(answer(b)).not.toBe(0)
      for (const k of ['p', 'd', 'e']) expect(Math.abs(Number(b.values[k])), `${b.seed}: ${k}`).toBeGreaterThanOrEqual(2)
    }
  })

  it('spreads its answers and letters', () => {
    common(built)
    expect(new Set(built.map((b) => b.values.v)).size).toBe(3)
  })
})

describe('fm-difference-of-squares-numbers (factorising q9)', () => {
  const built = build('fm-difference-of-squares-numbers', 'q9')

  it('a² − b² by (a − b)(a + b), with a round sum or difference, every step printed', () => {
    for (const b of built) {
      const m = /^Work out \$(\d+)\^2 - (\d+)\^2\$ without a calculator, using the difference of two squares\.$/.exec(b.question.prompt)!
      const [x, y] = [Number(m[1]), Number(m[2])]
      expect(answer(b)).toBe(x * x - y * y)
      expect([100, 200, 1000].includes(x + y) || [10, 100].includes(x - y), b.seed).toBe(true)
      expect(b.question.solution).toBe(`$${x}^2 - ${y}^2 = (${x} - ${y})(${x} + ${y}) = ${x - y} \\times ${x + y} = ${x * x - y * y}$. No squaring needed.`)
      expect(b.question.markScheme[0]!.description).toBe(`(${x} − ${y})(${x} + ${y})`)
      expect(x - y).toBeGreaterThanOrEqual(2)
    }
  })

  it('spreads its answers and kinds', () => {
    common(built)
    expect(new Set(built.map((b) => b.values.kind)).size).toBe(5)
  })
})

describe('every draw succeeds', () => {
  it('over 3000 seeds per slot', () => {
    for (const [id, slot] of [
      ['fm-binomial-cube', 'q2'],
      ['fm-binomial-coefficient', 'q6'],
      ['fm-binomial-coefficient', 'q11'],
      ['fm-binomial-which-end', 'q12'],
      ['fm-expand-and-simplify', 'q8'],
      ['fm-difference-of-squares-numbers', 'q9'],
    ] as const) {
      const all = build(id, slot, 3000, 'many')
      expect(all.every((b) => b.check.agrees)).toBe(true)
    }
  })
})
