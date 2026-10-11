import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'

/**
 * Structural tests for the Further Maths calculus generators (8365 4.1–4.8). Each prompt's curve
 * is read back with this file's own reader (TeX rewritten to a JavaScript function, its
 * coefficients found by finite differences) and differentiated here by the power rule written
 * out afresh; every printed step of the solution is evaluated, the named slips are shown to
 * give another number, and the answers and inputs are shown to spread.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/further-maths')
const bankOf = (topic: string) => Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${topic}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300, prefix = 'calculus'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = bankOf(g.topicId).find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `${prefix}-${i}`))
}
function find(generatorId: string, slotId: string, ok: (b: Generated) => boolean): Generated {
  for (let i = 0; i < 40000; i++) {
    const [b] = build(generatorId, slotId, 1, `find-${i}`)
    if (ok(b!)) return b!
  }
  throw new Error(`no build of ${generatorId} ${slotId} matches`)
}

const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const share = (built: Generated[], pred: (b: Generated) => boolean) => built.filter(pred).length / built.length
const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1))

/** TeX as a JavaScript function of x: brackets, implicit multiplication, x^2, x^{-1}, \dfrac{a}{x}. */
function fn(tex: string): (x: number) => number {
  let s = tex.replace(/\\dfrac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)').replace(/\^\{(-?\d+)\}/g, '^($1)').replace(/\s+/g, '')
  if (/[^\dx+\-()^/]/.test(s)) throw new Error(`cannot read ${tex}`)
  s = s.replace(/([\dx)])(?=[(x])/g, '$1*').replace(/\^(\(-?\d+\)|\d)/g, '**$1')
  // A unary minus in front of a power must be bracketed for JavaScript: -x**2 is a syntax error.
  s = s.replace(/(^|[(*+\-/])-(x\*\*\d)/g, '$1-($2)')
  return new Function('x', `return ${s}`) as (x: number) => number
}

/** Plain arithmetic printed in TeX: 12 \times (-2)^2 - 9. */
function arith(tex: string): number {
  let s = tex.replace(/\\times/g, '*').replace(/\s+/g, '')
  if (/[^\d+\-*()^]/.test(s)) throw new Error(`cannot read ${tex}`)
  s = s.replace(/\^(\d)/g, '**$1')
  s = s.replace(/(^|[(*+-])-(\(-?\d+\)\*\*\d|\d+\*\*\d)/g, '$1-($2)')
  return new Function(`return ${s}`)() as number
}

/** Coefficients, lowest power first, of a polynomial of degree at most `deg`: forward differences at 0, 1, 2, … */
function coefficients(f: (x: number) => number, deg = 4): number[] {
  let row = Array.from({ length: deg + 1 }, (_, x) => f(x))
  const diffs: number[] = []
  for (let k = 0; k <= deg; k++) {
    diffs.push(row[0]!)
    row = row.slice(1).map((v, i) => v - row[i]!)
  }
  const out = Array(deg + 1).fill(0)
  let falling = [1]
  for (let k = 0; k <= deg; k++) {
    falling.forEach((c, i) => (out[i] += (diffs[k]! * c) / fact(k)))
    falling = [...falling.map((c, i) => -k * c + (falling[i - 1] ?? 0)), falling[falling.length - 1]!]
  }
  return out.map((c) => Math.round(c))
}
const at = (c: number[], x: number) => c.reduce((s, k, n) => s + k * x ** n, 0)
/** The power rule, written here: c_n xⁿ → n c_n xⁿ⁻¹. */
const d = (c: number[]) => c.slice(1).map((k, i) => (i + 1) * k)

/** The curve and the x of a prompt: $y = …$ and $x = …$. */
function read(prompt: string) {
  const curve = /\$y = ([^$]+)\$/.exec(prompt)![1]!
  const x = /\$x = (-?\d+)\$/.exec(prompt)
  return { curve, c: coefficients(fn(curve)), x: x ? Number(x[1]) : NaN }
}

/** Every link of a chain a = b = c printed in the solution's maths evaluates to the answer. */
function chainHolds(math: string, value: number) {
  for (const part of math.split(' = ')) expect(arith(part), math).toBe(value)
}
const mathOf = (text: string) => [...text.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]!)

function common(built: Generated[], minDistinct = 10) {
  for (const b of built) {
    const q = b.question
    expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
    expect(`${q.prompt} ${q.solution}`, b.seed).not.toMatch(/\+ -|- -|\+-|(?:^|[^\d.\w{])1x(?![a-z])|\^1(?!\d)|\^\{1\}|(?:^|[^\d.])0x/)
    expect(q.type === 'numeric' && q.tolerance, b.seed).toBe(0)
    expect(Number.isInteger(answer(b)), b.seed).toBe(true)
    expect(mark(q, String(answer(b))).correct, b.seed).toBe(true)
    expect(mark(q, String(answer(b) + 1)).correct, b.seed).toBe(false)
    expect(q.solution, b.seed).toContain(String(answer(b)))
    expect(b.check.agrees, `${b.seed}: ${b.check.detail}`).toBe(true)
    expect(q.markScheme).toEqual([{ code: 'B1', marks: 1, description: String(answer(b)).replace('-', '−') }])
  }
  const counts = new Map<number, number>()
  for (const b of built) counts.set(answer(b), (counts.get(answer(b)) ?? 0) + 1)
  expect(Math.max(...counts.values()) / built.length).toBeLessThanOrEqual(0.4)
  expect(counts.size).toBeGreaterThanOrEqual(minDistinct)
  expect(new Set(built.map((b) => b.question.prompt)).size).toBeGreaterThan(100)
}

/** None of the prompt's printed numbers has the answer's size. */
function noPrintedAnswer(b: Generated, allowZero = false) {
  if (allowZero && answer(b) === 0) return
  const nums = (b.question.prompt.match(/\d+/g) ?? []).map(Number)
  // The powers 2, 3 and 4 are part of the letters, not numbers given.
  const { c } = read(b.question.prompt)
  const given = [...c.filter((k) => k !== 0), read(b.question.prompt).x].filter((v) => !Number.isNaN(v))
  expect(given.map(Math.abs), `${b.seed}: ${nums}`).not.toContain(Math.abs(answer(b)))
}

// ---------------------------------------------------------------------------------------

describe('fm-gradient-at-a-point q5 and fm-tangent-steps q5: the gradient of a quadratic', () => {
  for (const [id, slot] of [['fm-gradient-at-a-point', 'q5'], ['fm-tangent-steps', 'q5']] as const) {
    const built = build(id, slot)
    it(`${id} ${slot}: the answer is dy/dx at x, every step holds, and no slip gives it`, () => {
      for (const b of built) {
        const { c, x } = read(b.question.prompt)
        expect(c.slice(3).every((k) => k === 0)).toBe(true)
        const [c0, c1, c2] = c as [number, number, number]
        expect(c2).not.toBe(0)
        const g = at(d(c), x)
        expect(answer(b), b.seed).toBe(g)
        expect(g).not.toBe(0)
        // Slips: the curve's value, the power left as a coefficient, the constant kept.
        for (const s of [at(c, x), c2 * x + c1, 2 * c2 * x + c1 + c0]) expect(answer(b), `${b.seed}: ${s}`).not.toBe(s)
        noPrintedAnswer(b)
        const [dydx, xs, chain] = mathOf(b.question.solution)
        expect(dydx).toBe(`\\frac{dy}{dx} = ${2 * c2}x ${c1 < 0 ? '-' : '+'} ${Math.abs(c1)}`)
        expect(xs).toBe(`x = ${x}`)
        chainHolds(chain!, g)
        expect(chain!.startsWith(`${2 * c2} \\times ${x < 0 ? `(${x})` : x} `), chain).toBe(true)
      }
    })
    it(`${id} ${slot}: spreads answers, coefficients and x values; x = ±1 is rare`, () => {
      common(built)
      expect(share(built, (b) => Math.abs(read(b.question.prompt).x) === 1)).toBeLessThanOrEqual(0.2)
      const lead = share(built, (b) => read(b.question.prompt).c[2] === 1)
      expect(lead).toBeGreaterThan(0.25)
      expect(lead).toBeLessThan(0.55)
      expect(new Set(built.map((b) => read(b.question.prompt).x)).size).toBeGreaterThanOrEqual(6)
    })
  }

  it('writes the differentiation q5 solution as written for x² − 6x + 5 at x = 4', () => {
    const b = find('fm-gradient-at-a-point', 'q5', (b) => b.question.prompt === 'The curve $y = x^2 - 6x + 5$ is given. Work out the gradient of the curve at $x = 4$.')
    expect(b.question.solution).toBe('Differentiate first: $\\frac{dy}{dx} = 2x - 6$. Now substitute $x = 4$: $2 \\times 4 - 6 = 8 - 6 = 2$. The gradient there is $2$.')
  })
})

describe('fm-gradient-at-a-point q8: the gradient of a cubic', () => {
  const built = build('fm-gradient-at-a-point', 'q8')
  it('reads the cubic back, works dy/dx at x, and checks every step and slip', () => {
    for (const b of built) {
      const { c, x } = read(b.question.prompt)
      expect(c[3], b.seed).not.toBe(0)
      expect(c[4]).toBe(0)
      const g = at(d(c), x)
      expect(answer(b), b.seed).toBe(g)
      const [c0, c1, c2, c3] = c as [number, number, number, number]
      // Slips: the curve's value, the power not brought down, the power not reduced, a negative x squared to a negative.
      const slips = [at(c, x), c3 * x * x + c2 * x + c1, 3 * c3 * x ** 3 + 2 * c2 * x * x + c1, -3 * c3 * x * x + 2 * c2 * x + c1]
      for (const s of slips) expect(answer(b), `${b.seed}: ${s}`).not.toBe(s)
      expect(Math.abs(c1)).toBeGreaterThanOrEqual(2)
      noPrintedAnswer(b)
      const chain = mathOf(b.question.solution)[2]!
      chainHolds(chain, g)
      expect(chain).toContain(`${Math.abs(3 * c3)} \\times ${x < 0 ? `(${x})` : x}^2`)
      expect(c0 === 0 || c2 === 0).toBe(true)
    }
  })
  it('spreads answers and forms; x = ±1 is rare', () => {
    common(built)
    expect(share(built, (b) => Math.abs(read(b.question.prompt).x) === 1)).toBeLessThanOrEqual(0.2)
    expect(share(built, (b) => read(b.question.prompt).c[2] !== 0)).toBeGreaterThan(0.1)
    expect(share(built, (b) => read(b.question.prompt).c[0] !== 0)).toBeGreaterThan(0.1)
    expect(share(built, (b) => Math.abs(read(b.question.prompt).c[3]!) === 1)).toBeLessThanOrEqual(0.3)
  })
  it('writes the written q8 exactly for 4x³ − 9x at x = 2', () => {
    const b = find('fm-gradient-at-a-point', 'q8', (b) => b.question.prompt === 'Work out the gradient of the curve $y = 4x^3 - 9x$ at the point where $x = 2$.')
    expect(b.question.solution).toBe('Differentiate: $\\frac{dy}{dx} = 12x^2 - 9$. Substitute $x = 2$: $12 \\times 2^2 - 9 = 12 \\times 4 - 9 = 48 - 9 = 39$.')
    expect(answer(b)).toBe(39)
  })
})

describe('fm-gradient-at-a-point q13: the second derivative', () => {
  const built = build('fm-gradient-at-a-point', 'q13')
  it('reads the curve back, differentiates twice here, and no slip gives the answer', () => {
    for (const b of built) {
      const { c, x } = read(b.question.prompt)
      const once = at(d(c), x)
      const g = at(d(d(c)), x)
      expect(answer(b), b.seed).toBe(g)
      for (const s of [once, once * once, at(c, x)]) expect(answer(b), `${b.seed}: ${s}`).not.toBe(s)
      noPrintedAnswer(b)
      const m = mathOf(b.question.solution)
      expect(m[0]!.startsWith('\\frac{dy}{dx} = ')).toBe(true)
      expect(m[1]!.startsWith('\\frac{d^2y}{dx^2} = ')).toBe(true)
      // The printed first and second derivatives are the curve's, read at three points.
      const d1 = fn(m[0]!.split(' = ')[1]!)
      const d2 = fn(m[1]!.split(' = ')[1]!)
      for (const t of [-1, 0, 2]) {
        expect(d1(t) + 0).toBe(at(d(c), t) + 0)
        expect(d2(t) + 0).toBe(at(d(d(c)), t) + 0)
      }
      chainHolds(m[3]!, g)
    }
  })
  it('spreads answers and forms; x = ±1 is rare', () => {
    common(built)
    expect(share(built, (b) => Math.abs(read(b.question.prompt).x) === 1)).toBeLessThanOrEqual(0.2)
    expect(share(built, (b) => read(b.question.prompt).c[4] === 0)).toBeGreaterThan(0.15)
    expect(share(built, (b) => read(b.question.prompt).c[3] === 0 && read(b.question.prompt).c[4] !== 0)).toBeGreaterThan(0.35)
  })
  it('writes the written q13 exactly for 2x⁴ − 5x² + 11 at x = 2 (the written x = 1 is kept rare)', () => {
    const b = find('fm-gradient-at-a-point', 'q13', (b) => b.question.prompt === 'Given $y = 2x^4 - 5x^2 + 11$, work out the value of $\\frac{d^2y}{dx^2}$ when $x = 2$.')
    expect(b.question.solution).toBe('Differentiate once: $\\frac{dy}{dx} = 8x^3 - 10x$. Differentiate again: $\\frac{d^2y}{dx^2} = 24x^2 - 10$. Substitute $x = 2$: $24 \\times 2^2 - 10 = 24 \\times 4 - 10 = 96 - 10 = 86$.')
  })
})

describe('fm-tangent-steps q2: the y coordinate', () => {
  const built = build('fm-tangent-steps', 'q2')
  it('is the curve at x, never the gradient, the constant or a lost sign', () => {
    for (const b of built) {
      const { c, x } = read(b.question.prompt)
      const y = at(c, x)
      expect(answer(b), b.seed).toBe(y)
      for (const s of [at(d(c), x), c[0]!, -c[2]! * x * x + c[1]! * x + c[0]!]) expect(answer(b), `${b.seed}: ${s}`).not.toBe(s)
      noPrintedAnswer(b, true)
      const chain = mathOf(b.question.solution)[0]!
      chainHolds(chain, y)
      expect(b.question.solution.endsWith(`The point is $(${x}, ${y})$.`)).toBe(true)
    }
  })
  it('spreads answers; x = ±1 is rare', () => {
    common(built)
    expect(share(built, (b) => Math.abs(read(b.question.prompt).x) === 1)).toBeLessThanOrEqual(0.2)
  })
  it('brackets a bare power after a minus, -(2)^2, never -2^2, over 1000 seeds', () => {
    const many = build('fm-tangent-steps', 'q2', 1000, 'minus')
    for (const b of many) expect(b.question.solution, b.seed).not.toMatch(/-\d+\^/)
    // The case arises: a curve -x^2 + … at a positive x.
    const hit = many.filter((b) => read(b.question.prompt).c[2] === -1 && read(b.question.prompt).x > 0)
    expect(hit.length).toBeGreaterThan(10)
    for (const b of hit) expect(b.question.solution).toContain(`-(${read(b.question.prompt).x})^2`)
  })
})

/** "Set it to zero: $4x - 8 = 0$, so $4x = 8$ and $x = 2$", read back and checked. */
function solved(solution: string, c: number[], rhs: number, x: number) {
  const m = /\$(-?\d+)x ([+-]) (\d+) = (-?\d+)\$, so \$(-?\d+)x = (-?\d+)\$ and \$x = (-?\d+)\$/.exec(solution)
  expect(m, solution).not.toBeNull()
  const [k, sign, size, r, k2, moved, xs] = [Number(m![1]), m![2], Number(m![3]), Number(m![4]), Number(m![5]), Number(m![6]), Number(m![7])]
  expect(k).toBe(2 * c[2]!)
  expect((sign === '-' ? -1 : 1) * size).toBe(c[1])
  expect(r).toBe(rhs)
  expect(k2).toBe(k)
  expect(moved).toBe(rhs - c[1]!)
  expect(xs).toBe(x)
  expect(k * x).toBe(moved)
}

describe('fm-tangent-steps q8 and fm-stationary-points q4: where dy/dx = 0', () => {
  for (const [id, slot] of [['fm-tangent-steps', 'q8'], ['fm-stationary-points', 'q4']] as const) {
    const built = build(id, slot)
    it(`${id} ${slot}: x where the gradient is zero, with each step, and no slip gives it`, () => {
      for (const b of built) {
        const { c } = read(b.question.prompt)
        const x = -c[1]! / (2 * c[2]!)
        expect(answer(b), b.seed).toBe(x)
        // Slips: −b/a, b/(2a), the y value there, a root of the curve.
        for (const s of [-c[1]! / c[2]!, c[1]! / (2 * c[2]!), at(c, x)]) expect(answer(b), `${b.seed}: ${s}`).not.toBe(s)
        expect(at(c, answer(b))).not.toBe(0)
        noPrintedAnswer(b)
        solved(b.question.solution, c, 0, x)
      }
    })
    it(`${id} ${slot}: spreads answers and both signs of the leading coefficient; x = ±1 is rare`, () => {
      common(built)
      expect(share(built, (b) => Math.abs(answer(b)) === 1)).toBeLessThanOrEqual(0.2)
      expect(share(built, (b) => read(b.question.prompt).c[2]! < 0)).toBeGreaterThan(0.15)
    })
  }
  it('writes the written tangents q8 except for its x = 2 = a coincidence', () => {
    const b = find('fm-tangent-steps', 'q8', (b) => b.question.prompt.startsWith('The curve $y = 2x^2 - 12x + 1$'))
    expect(b.question.solution).toBe('Horizontal means the gradient is zero. Differentiate: $\\frac{dy}{dx} = 4x - 12$. Set it to zero: $4x - 12 = 0$, so $4x = 12$ and $x = 3$.')
    for (let i = 0; i < 300; i++) {
      const [x] = build('fm-tangent-steps', 'q8', 1, `two-${i}`)
      expect(x!.question.prompt).not.toContain('$y = 2x^2 - 8x')
    }
  })
})

describe('fm-tangent-steps q13: the x where the gradient has a given value', () => {
  const built = build('fm-tangent-steps', 'q13')
  it('solves dy/dx = g, with each step, and no slip gives it', () => {
    for (const b of built) {
      const { c } = read(b.question.prompt)
      const g = Number(/has gradient \$(-?\d+)\$/.exec(b.question.prompt)![1])
      const x = (g - c[1]!) / (2 * c[2]!)
      expect(answer(b), b.seed).toBe(x)
      for (const s of [(g - c[1]!) / c[2]!, (g + c[1]!) / (2 * c[2]!)]) expect(answer(b), `${b.seed}: ${s}`).not.toBe(s)
      expect(at(c, x)).not.toBe(g)
      expect(Math.abs(answer(b))).not.toBe(Math.abs(g))
      noPrintedAnswer(b)
      solved(b.question.solution, c, g, x)
      // The derivative is printed first, and it is the printed curve's, read at three points.
      const printed = /^Differentiate: \$\\frac\{dy\}\{dx\} = ([^$]+)\$\. Set the gradient function equal/.exec(b.question.solution)
      expect(printed, b.seed).not.toBeNull()
      for (const t of [-2, 0, 3]) expect(fn(printed![1]!)(t)).toBe(at(d(c), t))
    }
  })
  it('spreads answers and gradients; x = ±1 is rare', () => {
    common(built)
    expect(share(built, (b) => Math.abs(answer(b)) === 1)).toBeLessThanOrEqual(0.2)
    expect(new Set(built.map((b) => /has gradient \$(-?\d+)\$/.exec(b.question.prompt)![1])).size).toBeGreaterThanOrEqual(15)
  })
  it('writes the written q13 exactly for 2x² − 8x + 1 and gradient 4', () => {
    const b = find('fm-tangent-steps', 'q13', (b) => b.question.prompt === 'On the curve $y = 2x^2 - 8x + 1$, find the value of $x$ at which the tangent has gradient $4$.')
    expect(b.question.solution.startsWith('Differentiate: $\\frac{dy}{dx} = 4x - 8$. Set the gradient function equal to the wanted gradient: $4x - 8 = 4$, so $4x = 12$ and $x = 3$.')).toBe(true)
  })
})

describe('fm-stationary-points q5 and q12: the y coordinate of a minimum or a maximum', () => {
  for (const slot of ['q5', 'q12'] as const) {
    const built = build('fm-stationary-points', slot)
    it(`${slot}: the curve at its turning point, by the right kind, and no slip gives it`, () => {
      for (const b of built) {
        const { c } = read(b.question.prompt)
        expect(slot === 'q5' ? c[2]! > 0 : c[2]! < 0, b.seed).toBe(true)
        const x = -c[1]! / (2 * c[2]!)
        expect(Number.isInteger(x)).toBe(true)
        const y = at(c, x)
        expect(answer(b), b.seed).toBe(y)
        // Slips: c (and f(2x*), which is c), f(−x*), x* itself.
        for (const s of [c[0]!, at(c, 2 * x), at(c, -x), x]) expect(answer(b), `${b.seed}: ${s}`).not.toBe(s)
        noPrintedAnswer(b, true)
        solved(b.question.solution, c, 0, x)
        const sub = /\$y = ([^$]+)\$/.exec(b.question.solution.slice(b.question.solution.indexOf('Substituting')))![1]!
        chainHolds(sub, y)
        if (slot === 'q12') expect(b.question.solution.endsWith(`The second derivative is $${2 * c[2]!}$, negative, so it is a maximum.`)).toBe(true)
        else expect(b.question.solution.endsWith(`So the minimum point is $(${x}, ${y})$.`)).toBe(true)
      }
    })
    it(`${slot}: spreads answers; the leading coefficient is ±1 about two times in five`, () => {
      common(built)
      const one = share(built, (b) => Math.abs(read(b.question.prompt).c[2]!) === 1)
      expect(one).toBeGreaterThan(0.25)
      expect(one).toBeLessThan(0.55)
      expect(share(built, (b) => answer(b) === 0)).toBeLessThan(0.06)
    })
  }
})

describe('fm-optimisation q8: a pen against a wall', () => {
  const built = build('fm-optimisation', 'q8')
  it('reads L, checks the model against the setting and every step', () => {
    for (const b of built) {
      const L = Number(/\$(\d+)\$ m of (?:fenc|edg)/.exec(b.question.prompt)![1])
      const formula = /\$A = ([^$]+)\$/.exec(b.question.prompt)![1]!
      const A = fn(formula)
      // The formula is x(L − 2x): read at three points.
      for (const t of [1, 2, 5]) expect(A(t)).toBe(t * (L - 2 * t))
      expect(L % 4).toBe(0)
      const k = L / 4
      expect(answer(b), b.seed).toBe(2 * k * k)
      expect(answer(b)).toBe(A(k))
      expect(A(k - 0.5)).toBeLessThan(answer(b))
      expect(A(k + 0.5)).toBeLessThan(answer(b))
      expect(answer(b)).not.toBe(L)
      expect(answer(b)).not.toBe(k)
      expect(L).toBeLessThanOrEqual(100)
      expect(b.question.solution).toContain(`$\\frac{dA}{dx} = ${L} - 4x$. Set to zero: $4x = ${L}$, so $x = ${k}$.`)
      expect(b.question.solution).toContain(`$A = ${L}(${k}) - 2(${k})^2 = ${L * k} - ${2 * k * k} = ${answer(b)}$ m²`)
      expect(b.question.prompt.endsWith('Work out the greatest possible area, in m².')).toBe(true)
      // In scale: edging a vegetable plot is at most 40 m, a pen at most 80 m.
      if (b.question.prompt.includes('vegetable plot')) expect(L).toBeLessThanOrEqual(40)
      if (b.question.prompt.includes('rectangular pen')) expect(L).toBeLessThanOrEqual(80)
      if (b.question.prompt.includes('paddock')) expect(L).toBeGreaterThanOrEqual(60)
      // Worked by hand: L × k at most 2500 (L ≤ 100), and the short route k × 2k evaluates to the answer.
      expect(L * k, b.seed).toBeLessThanOrEqual(2500)
      const short = /: \$A = (\d+) \\times (\d+) = (\d+)\$ m²\.$/.exec(b.question.solution)
      expect(short, b.seed).not.toBeNull()
      expect([Number(short![1]), Number(short![2])]).toEqual([k, 2 * k])
      expect(Number(short![1]) * Number(short![2])).toBe(answer(b))
      expect(Number(short![3])).toBe(answer(b))
    }
  })
  it('spreads answers and settings', () => {
    common(built)
    expect(new Set(built.map((b) => b.question.prompt.slice(0, 30))).size).toBe(4)
    expect(share(built, (b) => b.question.prompt.includes('x('))).toBeGreaterThan(0.2)
  })
  it('writes the written q8 for the pen with 40 m', () => {
    const b = find('fm-optimisation', 'q8', (b) => b.question.prompt === 'A rectangular pen is built against a wall with $40$ m of fence on the other three sides. With the two ends each $x$ m, the area is $A = 40x - 2x^2$. Work out the greatest possible area, in m².')
    expect(b.question.solution).toBe('Differentiate: $\\frac{dA}{dx} = 40 - 4x$. Set to zero: $4x = 40$, so $x = 10$. The second derivative is $-4$, negative, so this is a maximum. Substituting back: $A = 40(10) - 2(10)^2 = 400 - 200 = 200$ m². The side along the wall is $40 - 2(10) = 20$ m, so the rectangle is $10$ m by $20$ m: $A = 10 \\times 20 = 200$ m².')
  })
})

describe('fm-optimisation q14: the least surface area of a closed box', () => {
  const built = build('fm-optimisation', 'q14')
  it('reads V and the formula, checks the model, the optimum and every step', () => {
    for (const b of built) {
      const p = b.question.prompt
      const V = Number(/\$(\d+)\$ cm³/.exec(p)![1])
      const S = fn(/\$S = ([^$]+)\$/.exec(p)![1]!)
      // S = 2x² + 4V/x, read at two points.
      for (const t of [1, 2]) expect(S(t)).toBeCloseTo(2 * t * t + (4 * V) / t, 9)
      const x = Math.round(Math.cbrt(V))
      expect(x ** 3).toBe(V)
      expect(answer(b), b.seed).toBe(6 * x * x)
      expect(S(x)).toBeCloseTo(answer(b), 9)
      expect(S(x - 0.1)).toBeGreaterThan(answer(b))
      expect(S(x + 0.1)).toBeGreaterThan(answer(b))
      // Never the volume (x = 6), and a cube root known by heart: sides 2 to 12, never 11.
      expect(answer(b)).not.toBe(V)
      expect([2, 3, 4, 5, 7, 8, 9, 10, 12]).toContain(x)
      expect(b.question.solution).toContain(`so $x^3 = ${V}$ and $x = ${x}$`)
      expect(b.question.solution).toContain('The second derivative there is $12$, positive')
      expect(b.question.solution).toContain(`= ${2 * x * x} + ${(4 * V) / x} = ${answer(b)}$ cm²`)
    }
  })
  it('is always closed, so it neither repeats q18\'s open tank nor gives away its part (c)', () => {
    for (const b of build('fm-optimisation', 'q14', 1000, 'closed')) {
      const text = `${b.question.prompt} ${b.question.solution}`
      expect(text, b.seed).not.toMatch(/open|tray|lid|half the side|container/i)
      expect(b.question.prompt.startsWith('A closed ')).toBe(true)
    }
  })
  it('spreads answers over all nine sides, and both ways of writing 4V/x', () => {
    common(built, 9)
    expect(share(built, (b) => b.question.prompt.includes('x^{-1}'))).toBeGreaterThan(0.3)
    expect(share(built, (b) => b.question.prompt.includes('\\dfrac'))).toBeGreaterThan(0.3)
  })
  it('writes the written q14 for the closed box of 27 cm³', () => {
    const b = find('fm-optimisation', 'q14', (b) => b.question.prompt === 'A closed box has a square base of side $x$ cm and volume $27$ cm³, so its surface area is $S = 2x^2 + 108x^{-1}$. Work out the least possible surface area, in cm².')
    expect(b.question.solution).toBe('Differentiate: $\\frac{dS}{dx} = 4x - 108x^{-2}$. Set to zero: $4x^3 = 108$, so $x^3 = 27$ and $x = 3$. The second derivative there is $12$, positive, so it is a minimum. Substituting: $S = 2(9) + \\frac{108}{3} = 18 + 36 = 54$ cm². The box is a cube of side 3 cm.')
  })
})

describe('every draw succeeds', () => {
  it('over 3000 seeds per slot', () => {
    const slots: [string, string][] = [
      ['fm-gradient-at-a-point', 'q5'], ['fm-gradient-at-a-point', 'q8'], ['fm-gradient-at-a-point', 'q13'],
      ['fm-tangent-steps', 'q2'], ['fm-tangent-steps', 'q5'], ['fm-tangent-steps', 'q8'], ['fm-tangent-steps', 'q13'],
      ['fm-stationary-points', 'q4'], ['fm-stationary-points', 'q5'], ['fm-stationary-points', 'q12'],
      ['fm-optimisation', 'q8'], ['fm-optimisation', 'q14'],
    ]
    for (const [id, slot] of slots) {
      const all = build(id, slot, 3000, 'many')
      expect(all.every((b) => b.check.agrees), `${id} ${slot}`).toBe(true)
    }
  }, 120_000)
})
