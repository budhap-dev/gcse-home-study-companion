import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { MEETS, SURD_RADIUS, TANGENT_CONDITIONS, TANGENT_POINTS, WHOLE_RADIUS } from './circles.ts'

/**
 * Structural tests for the Further Maths circle generators (8365 3.7–3.9). The prompt's
 * circle, line and points are read back with this file's own readers and worked again here;
 * each printed step is checked, the named wrong routes (r² read as r, a centre's sign read
 * straight from the bracket, the radius gradient or its negative for the tangent's, the
 * diameter for the radius, c = r for the tangent condition, an isosceles slip for the tangent
 * length) are shown to differ, and the answers and inputs are shown to spread.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/further-maths')
const TOPIC = 'circles-and-the-tangent-at-a-point'
const bank = Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8')).questions)
const written = (id: string) => bank.find((q) => q.id === id)!

const EQUATION = 'fm-circle-equation'
const TANGENT = 'fm-circle-tangent'

function build(generatorId: string, slotId: string, count = 300, prefix = 'circles'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = written(slotId)
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
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const share = (built: Generated[], pred: (b: Generated) => boolean) => built.filter(pred).length / built.length
const points = (text: string) => [...text.matchAll(/\((-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)\)/g)].map((m) => [Number(m[1]), Number(m[2])] as [number, number])
const mathOf = (text: string) => [...text.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]!)
const terminates = (x: number) => Math.abs(x * 1000 - Math.round(x * 1000)) < 1e-9
const tally = <K,>(built: Generated[], key: (b: Generated) => K) => {
  const m = new Map<K, number>()
  for (const b of built) m.set(key(b), (m.get(key(b)) ?? 0) + 1)
  return m
}
const top = (m: Map<unknown, number>, n: number) => Math.max(...m.values()) / n

/** The circle as printed: x^2 + y^2 = 49, or (x + 1)^2 + (y - 3)^2 = 20. */
function circleOf(tex: string): { a: number; b: number; N: number } {
  const f = /^(?:x\^2|\(x ([+-]) (\d+)\)\^2) \+ (?:y\^2|\(y ([+-]) (\d+)\)\^2) = (\d+(?:\.\d+)?)$/.exec(tex)
  if (!f) throw new Error(`not a circle: ${tex}`)
  const k = (sign: string | undefined, n: string | undefined) => (n === undefined ? 0 : sign === '+' ? -Number(n) : Number(n))
  return { a: k(f[1], f[2]), b: k(f[3], f[4]), N: Number(f[5]) }
}
/** The first printed circle in a text. */
const circleIn = (text: string) => circleOf(mathOf(text).find((t) => /x\^2|\(x /.test(t) && t.includes('='))!)
/** A line as printed: y = x + 1, y = -3x + 10, x + y = 5, y = 3x + c. */
function lineOf(tex: string): { m: number; c: number | string } {
  const s = /^x \+ y = (-?\d+)$/.exec(tex)
  if (s) return { m: -1, c: Number(s[1]) }
  const f = /^y = (-?\d*)x ([+-]) (\d+|[ck])$/.exec(tex)
  if (!f) throw new Error(`not a line: ${tex}`)
  const m = f[1] === '' ? 1 : f[1] === '-' ? -1 : Number(f[1])
  const c = /\d/.test(f[3]!) ? (f[2] === '-' ? -Number(f[3]) : Number(f[3])) : f[3]!
  return { m, c }
}
/** A fraction or whole number in TeX: -\frac{3}{4}, 7. */
function fracValue(t: string): number {
  const f = /^(-?)\\frac\{(\d+)\}\{(\d+)\}$/.exec(t.trim())
  return f ? ((f[1] ? -1 : 1) * Number(f[2])) / Number(f[3]) : Number(t)
}

interface Rules {
  /** The slot says "Give your answer as a decimal" exactly when the answer is not whole. */
  decimalWording?: boolean
  tolerance?: number
  coordMax?: number
}

function common(built: Generated[], minDistinct = 10, { decimalWording = false, tolerance: tol = 0, coordMax = 15 }: Rules = {}) {
  for (const b of built) {
    const q = b.question
    expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
    expect(`${q.prompt} ${q.solution}`, b.seed).not.toMatch(/\+ -|- -|\+-|(?:^|[^\d.\w{])1[xy](?![a-z])|\^1(?!\d)|(?:^|[^\d.])0[xy]/)
    expect(tolerance(b), b.seed).toBe(tol)
    expect(mark(q, String(answer(b))).correct, b.seed).toBe(true)
    expect(mark(q, String(answer(b) + 1)).correct, b.seed).toBe(false)
    expect(q.solution, b.seed).toContain(String(answer(b)))
    expect(b.check.agrees, `${b.seed}: ${b.check.detail}`).toBe(true)
    if (decimalWording) expect(q.prompt.endsWith(' Give your answer as a decimal.'), b.seed).toBe(!Number.isInteger(answer(b)))
    expect(terminates(answer(b)) || tol > 0).toBe(true)
    for (const [x, y] of points(q.prompt)) for (const v of [x, y]) expect(Math.abs(v), b.seed).toBeLessThanOrEqual(coordMax)
  }
  const counts = tally(built, answer)
  expect(top(counts, built.length)).toBeLessThanOrEqual(0.4)
  expect(counts.size).toBeGreaterThanOrEqual(minDistinct)
  expect(new Set(built.map((b) => b.question.prompt)).size).toBeGreaterThan(100)
}

describe('fm-circle-equation q1: the radius from the equation', () => {
  const built = build(EQUATION, 'q1')
  it('is the square root of the printed right-hand side, never the right-hand side or a centre coordinate', () => {
    for (const b of built) {
      const { a, b: cb, N } = circleIn(b.question.prompt)
      expect(answer(b) ** 2, b.seed).toBeCloseTo(N, 9)
      expect(answer(b)).toBeGreaterThan(1)
      // r² read as r; a centre coordinate read as the radius.
      expect(answer(b)).not.toBe(N)
      expect([a, cb].map(Math.abs)).not.toContain(answer(b))
      if (a !== 0 || cb !== 0) expect(Math.abs(a)).not.toBe(Math.abs(cb))
      expect(b.question.solution.startsWith(`$r^2 = ${N}$, so $r = ${answer(b)}$`), b.seed).toBe(true)
      if (a === 0 && cb === 0) {
        const r = answer(b)
        expect(b.question.solution).toContain(`passes through $(${r}, 0)$, $(0, ${r})$, $(-${r}, 0)$ and $(0, -${r})$.`)
        // The written q2 on the same sheet asks for x² + y² = 36.
        expect(N).not.toBe(36)
      } else {
        expect(b.question.solution).toContain(`The centre is $(${a}, ${cb})$.`)
        expect(Number.isInteger(answer(b))).toBe(true)
      }
      // The written q3 on the same sheet is this circle.
      expect(b.question.prompt).not.toContain('(x - 3)^2 + (y + 2)^2 = 16')
      expect(b.question.markScheme).toEqual([{ code: 'B1', marks: 1, description: String(answer(b)) }])
    }
  })
  it('spreads radii, forms and the rare decimal', () => {
    common(built, 10, { decimalWording: true })
    const origin = share(built, (b) => b.values.form === 'origin')
    expect(origin).toBeGreaterThan(0.42)
    expect(origin).toBeLessThan(0.68)
    const many = build(EQUATION, 'q1', 1000, 'decimals')
    const decimals = share(many, (b) => !Number.isInteger(answer(b)))
    expect(decimals).toBeGreaterThan(0.02)
    expect(decimals).toBeLessThan(0.1)
    expect(share(many, (b) => b.question.prompt === written('q1').prompt)).toBeLessThan(0.05)
  })
  it('writes the written x² + y² = 49 as the written solution does', () => {
    const b = find(EQUATION, 'q1', (b) => b.question.prompt === written('q1').prompt)
    expect(b.question.solution).toBe(written('q1').solution)
  })
})

describe('fm-circle-equation q4: the centre from the signs', () => {
  const built = build(EQUATION, 'q4')
  const asked = (b: Generated) => /value of \$([ab])\$/.exec(b.question.prompt)![1] as 'a' | 'b'
  it('is the asked coordinate of the printed centre, with the sign the bracket hides', () => {
    for (const b of built) {
      const { a, b: cb, N } = circleIn(b.question.prompt)
      const L = asked(b)
      const want = L === 'a' ? a : cb
      expect(answer(b), b.seed).toBe(want)
      expect(want).not.toBe(0)
      // The sign read straight from the bracket; the two coordinates alike; N one of them.
      expect(-answer(b)).not.toBe(answer(b))
      expect(Math.abs(a)).not.toBe(Math.abs(cb))
      expect([Math.abs(a), Math.abs(cb)]).not.toContain(N)
      // The radius is never a centre coordinate's size: (x + 2)² + (y − 9)² = 4 once printed 2 and 2.
      expect([Math.abs(a), Math.abs(cb)], b.seed).not.toContain(Math.sqrt(N))
      expect(b.question.prompt).not.toContain('(x - 3)^2 + (y + 2)^2 = 16')
      const s = b.question.solution
      expect(s, b.seed).toContain(`the centre is $(${a}, ${cb})$.`)
      const v = L === 'a' ? 'x' : 'y'
      expect(s, b.seed).toContain(want < 0 ? `$${v} + ${-want}$ is $${v} - (${want})$, so $${L} = ${want}$` : `$${v} - ${want}$ matches $${v} - ${L}$ directly, so $${L} = ${want}$`)
      expect(s).toContain(L === 'a' ? `and $b = ${cb}$:` : `and $a = ${a}$:`)
      // The radius: √N whole, or k√m with its decimal, or √N alone with its decimal.
      const root = /The radius is \$\\sqrt\{(\d+)\}(?: = (\d+))?(?: = (\d+)\\sqrt\{(\d+)\})?(?: \\approx (\d+\.\d\d))?\$\.$/.exec(s)
      expect(root, `${b.seed}: ${s}`).not.toBeNull()
      expect(Number(root![1])).toBe(N)
      if (root![2]) expect(Number(root![2]) ** 2).toBe(N)
      else {
        expect(Math.abs(Number(root![5]) - Math.sqrt(N))).toBeLessThan(0.005)
        if (root![3]) expect(Number(root![3]) ** 2 * Number(root![4])).toBe(N)
        else for (let k = 2; k * k <= N; k++) expect(N % (k * k), `${b.seed}: √${N} simplifies`).not.toBe(0)
      }
      expect(b.question.markScheme).toEqual([{ code: 'B1', marks: 1, description: String(answer(b)).replace('-', '−') }])
    }
  })
  it('spreads the letter asked, the signs, a zero coordinate and square or not', () => {
    common(built, 10)
    const a = share(built, (b) => asked(b) === 'a')
    expect(a).toBeGreaterThan(0.48)
    expect(a).toBeLessThan(0.72)
    const negative = share(built, (b) => answer(b) < 0)
    expect(negative).toBeGreaterThan(0.38)
    expect(negative).toBeLessThan(0.62)
    const zero = share(built, (b) => { const { a, b: cb } = circleIn(b.question.prompt); return a === 0 || cb === 0 })
    expect(zero).toBeGreaterThan(0.04)
    expect(zero).toBeLessThan(0.17)
    const square = share(built, (b) => Number.isInteger(Math.sqrt(circleIn(b.question.prompt).N)))
    expect(square).toBeGreaterThan(0.38)
    expect(square).toBeLessThan(0.62)
    expect(share(built, (b) => b.question.prompt === written('q4').prompt)).toBeLessThan(0.05)
  })
  it('writes the written (x + 1)² + (y − 3)² = 20 as the written solution does', () => {
    const b = find(EQUATION, 'q4', (b) => b.question.prompt === written('q4').prompt)
    expect(b.question.solution).toBe(written('q4').solution)
  })
})

describe('fm-circle-tangent q7: the gradient of the tangent at a point', () => {
  const built = build(TANGENT, 'q7')
  it('is the negative reciprocal of the printed radius gradient, and no slip gives it', () => {
    for (const b of built) {
      const { a, b: cb, N } = circleIn(b.question.prompt)
      const [[x, y]] = points(b.question.prompt) as [[number, number]]
      expect((x - a) ** 2 + (y - cb) ** 2, b.seed).toBe(N)
      const g = (y - cb) / (x - a)
      expect(answer(b) * g, b.seed).toBeCloseTo(-1, 12)
      // The radius gradient itself, its negative, its reciprocal.
      for (const s of [g, -g, 1 / g]) expect(answer(b), `${b.seed}: ${s}`).not.toBeCloseTo(s, 9)
      expect(Math.abs(x - a)).not.toBe(Math.abs(y - cb))
      expect([a, cb, N, x, y].map(Math.abs), b.seed).not.toContain(Math.abs(answer(b)))
      // Never the written q8's (±3, ±4) on x² + y² = 25 (gradient −0.75) on the same sheet, nor
      // q6's (x − 1)² + (y − 2)² = 25 nor q16's (x − 1)² + (y + 2)² = 25.
      expect(a === 0 && cb === 0 && Math.abs(x) === 3 && Math.abs(y) === 4 && N === 25, b.seed).toBe(false)
      expect(b.question.prompt).not.toContain('(x - 1)^2 + (y - 2)^2 = 25')
      expect(b.question.prompt).not.toContain('(x - 1)^2 + (y + 2)^2 = 25')
      if (a !== 0 || cb !== 0) {
        // Centre, origin and point never collinear ((x + 2)² + (y + 4)² = 5 at (−3, −6) once was),
        // so ignoring the centre (−x/y) and flipping its signs both give something else; and the
        // origin is not on the circle.
        expect(a * (y - cb), b.seed).not.toBe(cb * (x - a))
        expect(a * a + cb * cb).not.toBe(N)
        if (y !== 0) expect(-x / y, b.seed).not.toBeCloseTo(answer(b), 9)
        if (y + cb !== 0) expect(-(x + a) / (y + cb), b.seed).not.toBeCloseTo(answer(b), 9)
      }
      const s = b.question.solution
      const radius = /has gradient \$(.+?)\$\. The tangent is perpendicular, so its gradient is \$(.+?)\$\.$/.exec(s)
      expect(radius, `${b.seed}: ${s}`).not.toBeNull()
      expect(fracValue(radius![1]!.split(' = ').at(-1)!), b.seed).toBeCloseTo(g, 12)
      const last = radius![2]!.split(' = ')
      expect(Number(last.at(-1))).toBe(answer(b))
      if (last.length === 2) expect(fracValue(last[0]!)).toBeCloseTo(answer(b), 12)
      if (a !== 0 || cb !== 0) expect(s.startsWith(`The centre is $(${a}, ${cb})$. The radius from $(${a}, ${cb})$ to $(${x}, ${y})$ has gradient $\\frac{${y} - ${cb < 0 ? `(${cb})` : cb}}{${x} - ${a < 0 ? `(${a})` : a}} = `)).toBe(true)
      else expect(s.startsWith(`The radius to $(${x}, ${y})$ has gradient $\\frac{${y}}{${x}}`)).toBe(true)
      expect(b.question.markScheme).toHaveLength(1)
    }
  })
  it('spreads answers, whole and decimal, the quadrant and the centre', () => {
    common(built, 10, { decimalWording: true })
    const many = build(TANGENT, 'q7', 1000, 'spread')
    const whole = share(many, (b) => Number.isInteger(answer(b)))
    expect(whole).toBeGreaterThan(0.13)
    expect(whole).toBeLessThan(0.28)
    const centred = share(many, (b) => b.values.form === 'centre')
    expect(centred).toBeGreaterThan(0.17)
    expect(centred).toBeLessThan(0.33)
    expect(share(many, (b) => answer(b) > 0)).toBeGreaterThan(0.35)
    expect(top(tally(many, answer), many.length)).toBeLessThan(0.12)
    expect(share(many, (b) => b.question.prompt === written('q7').prompt)).toBeLessThan(0.02)
    expect(TANGENT_POINTS.every(([p, q]) => q >= 2 && p !== q && p !== q * q)).toBe(true)
  })
  it('writes the written (6, 8) on x² + y² = 100 as the written solution does', () => {
    const b = find(TANGENT, 'q7', (b) => b.question.prompt === written('q7').prompt)
    expect(b.question.solution).toBe(written('q7').solution)
  })
})

describe('fm-circle-equation q9: the radius from the ends of a diameter', () => {
  const built = build(EQUATION, 'q9')
  it('is half the distance between the printed ends, every step holds, and no slip gives it', () => {
    for (const b of built) {
      const [[x1, y1], [x2, y2]] = points(b.question.prompt) as [[number, number], [number, number]]
      const dx = x2 - x1
      const dy = y2 - y1
      const d = Math.hypot(dx, dy)
      expect(Number.isInteger(d), b.seed).toBe(true)
      expect(answer(b), b.seed).toBe(d / 2)
      // The diameter left unhalved; the legs added; a coordinate read off.
      expect(answer(b)).not.toBe(d)
      if (dx !== 0 && dy !== 0) expect(answer(b)).not.toBe((Math.abs(dx) + Math.abs(dy)) / 2)
      expect([x1, y1, x2, y2].map(Math.abs)).not.toContain(answer(b))
      expect(new Set([x1, y1, x2, y2].map(Math.abs)).size).toBeGreaterThanOrEqual(3)
      const mx = (x1 + x2) / 2
      const my = (y1 + y2) / 2
      const s = b.question.solution
      expect(s, b.seed).toContain(`so the radius is $${answer(b)}$. The centre is the midpoint, $(${mx}, ${my})$.`)
      const diff = (to: number, from: number) => `${to} ${from < 0 ? '+' : '-'} ${Math.abs(from)}`
      if (dx !== 0 && dy !== 0) {
        expect(s.startsWith(`The diameter is $\\sqrt{(${diff(x2, x1)})^2 + (${diff(y2, y1)})^2} = \\sqrt{${dx * dx} + ${dy * dy}} = \\sqrt{${d * d}} = ${d}$`), `${b.seed}: ${s}`).toBe(true)
        expect(d).toBeLessThanOrEqual(25)
      } else {
        // The printed subtraction, read back, is the length: (3, −13) to (−6, −13) once printed −6 − 3 = 9.
        const len = /its length is \$(-?\d+) ([+-]) (\d+) = (\d+)\$/.exec(s)
        expect(len, `${b.seed}: ${s}`).not.toBeNull()
        expect(Number(len![1]) + (len![2] === '-' ? -1 : 1) * Number(len![3]), b.seed).toBe(d)
        expect(Number(len![4])).toBe(d)
        expect(s).toContain(dx === 0 ? 'the diameter is vertical' : 'the diameter is horizontal')
      }
      expect(b.question.markScheme.map((l) => l.code)).toEqual(['M1', 'A1'])
      expect(b.question.markScheme[0]!.description).toBe(`distance between the ends ${d}, or the midpoint (${mx}, ${my})`.replace(/-/g, '−'))
    }
  })
  it('spreads radii, whole and half, and the rare flat diameter', () => {
    common(built, 10, { decimalWording: true })
    const many = build(EQUATION, 'q9', 1000, 'spread')
    // A flat diameter tests neither Pythagoras nor the midpoint on a 2-mark slot: under 8%.
    const flat = share(many, (b) => b.values.kind === 'flat')
    expect(flat).toBeGreaterThan(0.03)
    expect(flat).toBeLessThan(0.08)
    const whole = share(many, (b) => Number.isInteger(answer(b)))
    expect(whole).toBeGreaterThan(0.22)
    expect(whole).toBeLessThan(0.45)
    expect(top(tally(many, (b) => `${b.values.kind}:${b.values.d}`), many.length)).toBeLessThanOrEqual(1 / 6)
    expect(share(many, (b) => b.question.prompt === written('q9').prompt)).toBeLessThan(0.02)
  })
  it('writes the written (−1, 4) and (7, −2) as the written solution does', () => {
    const b = find(EQUATION, 'q9', (b) => b.question.prompt === written('q9').prompt)
    expect(b.question.solution).toBe(written('q9').solution)
  })
})

describe('fm-circle-tangent q10: where a line meets a circle', () => {
  const built = build(TANGENT, 'q10')
  const QUADRANTS = ['first', 'second', 'third', 'fourth'] as const
  const quadrant = (x: number, y: number) => QUADRANTS[x > 0 ? (y > 0 ? 0 : 3) : y > 0 ? 1 : 2]
  it('is the asked coordinate of the one meeting point in the asked quadrant, every step holds', () => {
    for (const b of built) {
      const q = b.question
      const lineTex = mathOf(q.prompt).find((t) => /^y = |^x \+ y/.test(t))!
      const line = lineOf(lineTex)
      const { N } = circleIn(q.prompt)
      const m = line.m
      const c = line.c as number
      const ask = /Work out the \$([xy])\$-coordinate of the point in the (\w+) quadrant\.$/.exec(q.prompt)!
      const coord = ask[1] as 'x' | 'y'
      const pts = points(/The points are (.*?); /.exec(q.solution)![1]!)
      expect(pts, b.seed).toHaveLength(2)
      for (const [x, y] of pts) {
        expect(m * x + c, b.seed).toBe(y)
        expect(x * x + y * y, b.seed).toBe(N)
        expect(x !== 0 && y !== 0).toBe(true)
      }
      const inside = pts.filter(([x, y]) => quadrant(x, y) === ask[2])
      expect(inside, b.seed).toHaveLength(1)
      const [[x, y]] = inside as [[number, number]]
      expect(answer(b), b.seed).toBe(coord === 'x' ? x : y)
      // The other point's coordinate, the point's other coordinate, a printed figure, 1.
      const [[ox, oy]] = pts.filter((p) => p !== inside[0]) as [[number, number]]
      expect(answer(b)).not.toBe(coord === 'x' ? ox : oy)
      expect(Math.abs(answer(b))).not.toBe(Math.abs(coord === 'x' ? y : x))
      expect([m, c, N].map(Math.abs)).not.toContain(Math.abs(answer(b)))
      // A y asked is never the other root of the quadratic written down: for m = −1 the points are
      // (x₁, x₂) and (x₂, x₁), so "x + y = 3 with x² + y² = 17, second quadrant" once had y = 4, the other root.
      if (coord === 'y') expect(Math.abs(answer(b)), b.seed).not.toBe(Math.abs(ox))
      // |c| = N would print the same figure twice (y = −3x − 5 with x² + y² = 5).
      expect(Math.abs(c), b.seed).not.toBe(N)
      expect(Math.abs(answer(b))).not.toBe(1)
      expect(N).toBeLessThanOrEqual(200)
      // The quadratic: (1 + m²)x² + 2mcx + c² − N = 0, then x² − (x₁ + x₂)x + x₁x₂ as factors.
      const x1 = pts[0]![0]
      const x2 = pts[1]![0]
      const A = 1 + m * m
      const poly = (p2: number, p1: number, p0: number) => {
        const term = (k: number, v: string, first: boolean) => (k === 0 ? '' : `${first ? (k < 0 ? '-' : '') : k < 0 ? ' - ' : ' + '}${Math.abs(k) === 1 && v ? '' : Math.abs(k)}${v}`)
        return `${term(p2, 'x^2', true)}${term(p1, 'x', false)}${term(p0, '', false)}`
      }
      const factor = (root: number) => `(x ${root < 0 ? '+' : '-'} ${Math.abs(root)})`
      expect(q.solution, b.seed).toContain(`, so $${poly(A, 2 * m * c, c * c - N)} = 0$ and $${poly(1, -(x1 + x2), x1 * x2)} = ${factor(x)}${factor(ox)} = 0$.`)
      const sumForm = lineTex.startsWith('x + y')
      const inner = sumForm ? `${c} - x` : lineTex.slice(4)
      expect(q.solution.startsWith(sumForm ? `Substitute $y = ${inner}$: $x^2 + (${inner})^2 = ${N}$` : `Substitute: $x^2 + (${inner})^2 = ${N}$`), `${b.seed}: ${q.solution}`).toBe(true)
      expect(q.solution.endsWith(`the one in the ${ask[2]} quadrant has $${coord} = ${answer(b)}$.`)).toBe(true)
      expect(q.markScheme.map((l) => l.description)).toEqual(['substitutes and forms a quadratic', `solves ${poly(1, -(x1 + x2), x1 * x2).replace('x^2', 'x²')} = 0`.replace(/-/g, '−'), `${coord} = ${answer(b)}`.replace('-', '−')])
    }
  })
  it('spreads gradients, forms, the coordinate asked and the quadrant, and no calculation takes over', () => {
    common(built, 10)
    const many = build(TANGENT, 'q10', 1000, 'spread')
    const m = (b: Generated) => Number(b.values.m)
    for (const g of [1, -1]) expect(share(many, (b) => m(b) === g)).toBeGreaterThan(0.15)
    for (const g of [2, 3]) expect(share(many, (b) => Math.abs(m(b)) === g)).toBeGreaterThan(0.15)
    const xAsked = share(many, (b) => b.values.coord === 'x')
    expect(xAsked).toBeGreaterThan(0.55)
    expect(xAsked).toBeLessThan(0.85)
    expect(share(many, (b) => b.values.coord === 'y' && Math.abs(Number(b.values.m)) !== 1)).toBeGreaterThan(0.05)
    for (const qd of QUADRANTS) expect(share(many, (b) => b.values.quadrant === qd), qd).toBeGreaterThan(0.1)
    expect(share(many, (b) => b.question.prompt.includes('$x + y = '))).toBeGreaterThan(0.06)
    expect(share(many, (b) => b.question.prompt.startsWith('The line $L$'))).toBeGreaterThan(0.2)
    expect(top(tally(many, (b) => `${b.values.m}:${b.values.x1}:${b.values.x2}`), many.length)).toBeLessThanOrEqual(1 / 6)
    expect(share(many, (b) => b.question.prompt === written('q10').prompt)).toBeLessThan(0.02)
    expect(MEETS.length).toBeGreaterThan(200)
  })
  it('writes the written y = x + 1 and x² + y² = 25 as the written solution does', () => {
    const b = find(TANGENT, 'q10', (b) => b.question.prompt === written('q10').prompt)
    expect(b.question.solution).toBe(written('q10').solution)
    expect(b.question.markScheme).toEqual(written('q10').markScheme)
  })
})

describe('fm-circle-tangent q12: the tangent condition from the discriminant', () => {
  const built = build(TANGENT, 'q12')
  const read = (b: Generated) => {
    const tex = mathOf(b.question.prompt)
    const line = lineOf(tex.find((t) => t.startsWith('y = '))!)
    const { N } = circleIn(b.question.prompt)
    const cond = /\$([ck]) ([<>]) 0\$/.exec(b.question.prompt)!
    return { m: line.m, L: cond[1]!, negative: cond[2] === '<', N }
  }
  it('satisfies c² = r²(1 + m²) with the asked sign, and no slip gives it', () => {
    for (const b of built) {
      const { m, L, negative, N } = read(b)
      const c = answer(b)
      expect(c * c, b.seed).toBe(N * (1 + m * m))
      expect(c < 0, b.seed).toBe(negative)
      expect(Number.isInteger(c)).toBe(true)
      // c = r, c = r², the sign dropped, |c| a printed figure.
      expect(Number.isInteger(Math.sqrt(N))).toBe(false)
      expect(Math.abs(c)).not.toBe(N)
      expect(Math.abs(c)).not.toBe(Math.abs(m))
      const A = 1 + m * m
      const s = b.question.solution
      const sign = (k: number) => (k < 0 ? `- ${-k}` : `+ ${k}`)
      const mx = m === 1 ? 'x' : m === -1 ? '-x' : `${m}x`
      expect(s, b.seed).toContain(`gives $x^2 + (${mx} + ${L})^2 = ${N}$, so $${A}x^2 ${sign(2 * m)}${L}x + ${L}^2 - ${N} = 0$.`)
      expect(s, b.seed).toContain(`A tangent means a repeated root: $(${2 * m}${L})^2 - 4(${A})(${L}^2 - ${N}) = ${4 * A * N} - 4${L}^2 = 0$, so $${L} = \\pm ${Math.abs(c)}$.`)
      const touch = /the line touches at \$\((-?\d+), (-?\d+)\)\$\.$/.exec(s)!
      const [tx, ty] = [Number(touch[1]), Number(touch[2])]
      expect(tx * tx + ty * ty, b.seed).toBe(N)
      expect(m * tx + c).toBe(ty)
      expect(s).toContain(`With $${L} ${negative ? '<' : '>'} 0$, $${L} = ${c}$;`)
      expect(b.question.markScheme.map((l) => l.description)).toEqual(['substitutes and forms a quadratic in x', 'sets the discriminant to zero', `${L} = ${c}`.replace('-', '−')])
      // The written q12's x² + y² = 10 has |c| = N: never drawn.
      expect(b.question.prompt).not.toContain('x^2 + y^2 = 10$')
    }
  })
  it('spreads the gradient, the sign, the letter and the circle, and no calculation takes over', () => {
    common(built, 10)
    const many = build(TANGENT, 'q12', 1000, 'spread')
    // The three gradient sizes equally, as the written has m = 3.
    for (const g of [1, 2, 3]) {
      const s = share(many, (b) => Math.abs(read(b).m) === g)
      expect(s, String(g)).toBeGreaterThan(0.27)
      expect(s, String(g)).toBeLessThan(0.4)
    }
    const positiveM = share(many, (b) => read(b).m > 0)
    expect(positiveM).toBeGreaterThan(0.4)
    expect(positiveM).toBeLessThan(0.6)
    const negative = share(many, (b) => answer(b) < 0)
    expect(negative).toBeGreaterThan(0.45)
    expect(negative).toBeLessThan(0.65)
    const k = share(many, (b) => read(b).L === 'k')
    expect(k).toBeGreaterThan(0.25)
    expect(k).toBeLessThan(0.45)
    // No calculation (gradient size and circle) over a sixth, no answer over a seventh, and the
    // smallest circle of each size, where |c| = N/2 and a halving slip pays, under a fifth.
    expect(top(tally(many, (b) => `${Math.abs(Number(b.values.m))}:${b.values.N}`), many.length)).toBeLessThanOrEqual(1 / 6)
    expect(top(tally(many, answer), many.length)).toBeLessThan(1 / 7)
    expect(share(many, (b) => Math.abs(answer(b)) * 2 === Number(b.values.N))).toBeLessThan(0.2)
    expect(TANGENT_CONDITIONS.every(({ m, N }) => N !== 1 + m * m && N <= 200)).toBe(true)
    expect(TANGENT_CONDITIONS.length).toBe(17)
    expect(new Set(many.map((b) => `${Math.abs(Number(b.values.m))}:${b.values.N}`)).size).toBe(17)
  })
  it('works y = 3x + c on x² + y² = 40, c < 0, in the written words', () => {
    const b = find(TANGENT, 'q12', (b) => b.question.prompt === 'The line $y = 3x + c$ is a tangent to the circle $x^2 + y^2 = 40$, and $c < 0$. Work out the value of $c$.')
    expect(b.question.solution).toBe(
      'Substituting $y = 3x + c$ gives $x^2 + (3x + c)^2 = 40$, so $10x^2 + 6cx + c^2 - 40 = 0$. A tangent means a repeated root: $(6c)^2 - 4(10)(c^2 - 40) = 1600 - 4c^2 = 0$, so $c = \\pm 20$. With $c < 0$, $c = -20$; the line touches at $(6, -2)$.',
    )
    expect(answer(b)).toBe(-20)
  })
})

describe('fm-circle-tangent q14: the length of a tangent from a point', () => {
  const built = build(TANGENT, 'q14')
  it('is √(OP² − r²) with whole numbers throughout, and no slip gives it', () => {
    for (const b of built) {
      const [[p, q]] = points(b.question.prompt) as [[number, number]]
      const { N } = circleIn(b.question.prompt)
      const S = p * p + q * q
      const t = answer(b)
      expect(t * t, b.seed).toBe(S - N)
      expect(Number.isInteger(t) && t >= 3).toBe(true)
      expect(S).toBeLessThanOrEqual(230)
      // No coordinate of 1 ((1, 8), (1, 12), (1, 13) once took 18% of builds).
      expect(Math.min(Math.abs(p), Math.abs(q)), b.seed).toBeGreaterThanOrEqual(2)
      // A coordinate read off; the radius (an isosceles slip); the root left off; r for r².
      expect([p, q].map(Math.abs)).not.toContain(t)
      expect(t * t).not.toBe(N)
      expect(N).not.toBe(t)
      expect([p, q].map(Math.abs)).not.toContain(N)
      expect(Math.abs(p)).not.toBe(Math.abs(q))
      expect(S - N).not.toBe(t)
      if (Number.isInteger(Math.sqrt(N))) expect(S - Math.sqrt(N)).not.toBe(t * t)
      const sub = (v: number) => (v < 0 ? `(${v})` : `${v}`)
      const s = b.question.solution
      expect(s, b.seed).toContain(`$OP^2 = ${sub(p)}^2 + ${sub(q)}^2 = ${S}$, so the tangent length is $\\sqrt{${S} - ${N}} = \\sqrt{${t * t}} = ${t}$.`)
      if (b.values.kind === 'whole radius') expect(s).toContain(`the radius $${Math.sqrt(N)}$ and $OP$`)
      else {
        expect(Number.isInteger(Math.sqrt(N))).toBe(false)
        expect(s).toContain(`the radius $r$, where $r^2 = ${N}$, and $OP$`)
      }
      expect(s.includes('Call the point $P$.'), b.seed).toBe(!b.question.prompt.includes('$P'))
      expect(b.question.markScheme.map((l) => l.description)).toEqual([`OP² = ${S}, or the right angle between tangent and radius`, `√(${S} − ${N})`, String(t)])
      // Never the written (8, 6) to x² + y² = 36 in any order or quadrant: its answer is printed.
      expect(N === 36 && Math.abs(p) + Math.abs(q) === 14).toBe(false)
    }
  })
  it('spreads lengths, whole and surd radii, and the quadrant', () => {
    common(built, 10, { coordMax: 14 })
    const many = build(TANGENT, 'q14', 1000, 'spread')
    const whole = share(many, (b) => b.values.kind === 'whole radius')
    expect(whole).toBeGreaterThan(0.32)
    expect(whole).toBeLessThan(0.48)
    expect(share(many, (b) => points(b.question.prompt)[0]![0] < 0)).toBeGreaterThan(0.4)
    expect(top(tally(many, (b) => `${Math.min(Math.abs(Number(b.values.p)), Math.abs(Number(b.values.q)))}:${Math.max(Math.abs(Number(b.values.p)), Math.abs(Number(b.values.q)))}:${b.values.N}`), many.length)).toBeLessThanOrEqual(1 / 6)
    expect(share(many, (b) => b.question.prompt === written('q14').prompt)).toBe(0)
    const wholes = many.filter((b) => b.values.kind === 'whole radius')
    expect(top(tally(wholes, (b) => `${Math.min(Math.abs(Number(b.values.p)), Math.abs(Number(b.values.q)))}:${Math.max(Math.abs(Number(b.values.p)), Math.abs(Number(b.values.q)))}:${b.values.N}`), wholes.length)).toBeLessThanOrEqual(1 / 6)
    expect(WHOLE_RADIUS.every(({ p, q }) => p >= 2 && q >= 2) && SURD_RADIUS.every(({ p, q }) => p >= 2 && q >= 2)).toBe(true)
    expect(WHOLE_RADIUS.every(({ p, q, t, N }) => p * p + q * q === t * t + N && ![p, q].includes(t) && ![p, q].includes(Math.sqrt(N)))).toBe(true)
    expect(SURD_RADIUS.every(({ p, q, t, N }) => p * p + q * q === t * t + N && !Number.isInteger(Math.sqrt(N)))).toBe(true)
  })
  it('works (2, 9) to x² + y² = 49 in the written words', () => {
    const b = find(TANGENT, 'q14', (b) => b.question.prompt === 'A tangent is drawn from the point $(2, 9)$ to the circle $x^2 + y^2 = 49$. Work out the length of the tangent.')
    expect(b.question.solution).toBe(
      'Call the point $P$. The tangent meets the radius at $90°$, so the tangent, the radius $7$ and $OP$ form a right-angled triangle with $OP$ as hypotenuse. $OP^2 = 2^2 + 9^2 = 85$, so the tangent length is $\\sqrt{85 - 49} = \\sqrt{36} = 6$.',
    )
  })
})

describe('fm-circle-tangent q15: the triangle a tangent makes with the axes', () => {
  const built = build(TANGENT, 'q15')
  const exact = (b: Generated) => {
    const [[p, q]] = points(b.question.prompt) as [[number, number]]
    const { N } = circleIn(b.question.prompt)
    return { p, q, N, area: Math.abs((N / p) * (N / q)) / 2 }
  }
  it('is half the product of the intercepts to 2 decimal places, clear of a rounding boundary, marked both ways', () => {
    for (const b of built) {
      const { p, q, N, area } = exact(b)
      expect(p * p + q * q).toBe(N)
      expect(Math.abs(p)).not.toBe(Math.abs(q))
      // Each intercept is a real fraction: no coordinate of 1, which would put an intercept at N.
      expect(Math.min(Math.abs(p), Math.abs(q))).toBeGreaterThanOrEqual(2)
      expect(Math.abs(p) + Math.abs(q) === 7 && Math.abs(p * q) === 12, b.seed).toBe(false)
      expect(Math.round(area * 100) / 100, b.seed).toBe(answer(b))
      expect(tolerance(b)).toBe(0.005)
      const scaled = Math.abs(area * 100 - Math.round(area * 100))
      expect(scaled, b.seed).toBeGreaterThan(1e-6)
      expect(scaled).toBeLessThan(0.45)
      expect(area).toBeLessThanOrEqual(600)
      expect(mark(b.question, String(area)).correct, b.seed).toBe(true)
      expect(mark(b.question, String(answer(b))).correct).toBe(true)
      expect(mark(b.question, String(answer(b) + 0.02)).correct).toBe(false)
      expect([p, q, N].map(Math.abs)).not.toContain(answer(b))
      const s = b.question.solution
      // The tangent is derived (radius gradient, negative reciprocal, through the point) and printed
      // with a positive x coefficient: 5x + 8y = −89, never −5x − 8y = 89.
      const derived = /^The radius to \$\((-?\d+), (-?\d+)\)\$ has gradient \$(.+?)\$, so the tangent has gradient \$(.+?)\$ and, through \$\(\1, \2\)\$, its equation is \$(.+?) = (-?\d+)\$\. At \$y = 0\$/.exec(s)
      expect(derived, `${b.seed}: ${s}`).not.toBeNull()
      expect([Number(derived![1]), Number(derived![2])]).toEqual([p, q])
      expect(fracValue(derived![3]!), b.seed).toBeCloseTo(q / p, 12)
      expect(fracValue(derived![4]!), b.seed).toBeCloseTo(-p / q, 12)
      const sgn = p < 0 ? -1 : 1
      expect(derived![5], b.seed).toBe(`${Math.abs(p)}x ${sgn * q < 0 ? '-' : '+'} ${Math.abs(q)}y`)
      expect(Number(derived![6])).toBe(sgn * N)
      expect(b.question.markScheme[0]!.description).toBe(`tangent ${derived![5]} = ${sgn * N}`.replace(/-/g, '−'))
      const A = /\$A = \\left\((.+?), 0\\right\)\$/.exec(s)!
      const B = /\$B = \\left\(0, (.+?)\\right\)\$/.exec(s)!
      expect(fracValue(A[1]!), b.seed).toBeCloseTo(N / p, 12)
      expect(fracValue(B[1]!), b.seed).toBeCloseTo(N / q, 12)
      const tail = /The area is \$\\frac\{1\}\{2\} \\times (.+?) \\times (.+?) = (\\frac\{\d+\}\{\d+\}) = (\d+\.\d\d)\$ to two decimal places\./.exec(s)!
      expect(fracValue(tail[1]!) * fracValue(tail[2]!) / 2, b.seed).toBeCloseTo(area, 9)
      expect(fracValue(tail[3]!)).toBeCloseTo(area, 9)
      expect(Number(tail[4])).toBe(answer(b))
      expect(s.endsWith('are lengths, so the signs are dropped.)')).toBe(p < 0 || q < 0)
      expect(b.question.markScheme.map((l) => l.code)).toEqual(['M1', 'M1', 'A1'])
      expect(b.question.markScheme[2]!.description.endsWith(` or ${tail[4]}`)).toBe(true)
    }
  })
  it('spreads areas, points and quadrants, and no calculation takes over', () => {
    common(built, 10, { tolerance: 0.005, coordMax: 10 })
    const many = build(TANGENT, 'q15', 1000, 'spread')
    const left = share(many, (b) => exact(b).p < 0)
    expect(left).toBeGreaterThan(0.38)
    expect(left).toBeLessThan(0.62)
    expect(top(tally(many, (b) => { const { p, q } = exact(b); return `${Math.min(Math.abs(p), Math.abs(q))}:${Math.max(Math.abs(p), Math.abs(q))}` }), many.length)).toBeLessThanOrEqual(1 / 6)
    expect(share(many, (b) => b.question.prompt === written('q15').prompt)).toBe(0)
    expect(share(many, (b) => answer(b) === 26.04)).toBe(0)
  })
  it('works (2, 3) on x² + y² = 13 in the written words', () => {
    const b = find(TANGENT, 'q15', (b) => b.question.prompt === 'The tangent to the circle $x^2 + y^2 = 13$ at $(2, 3)$ meets the $x$ axis at $A$ and the $y$ axis at $B$. Work out the area of triangle $OAB$. Give your answer to two decimal places.')
    expect(b.question.solution).toBe(
      'The radius to $(2, 3)$ has gradient $\\frac{3}{2}$, so the tangent has gradient $-\\frac{2}{3}$ and, through $(2, 3)$, its equation is $2x + 3y = 13$. At $y = 0$, $x = \\frac{13}{2}$, so $A = \\left(\\frac{13}{2}, 0\\right)$; at $x = 0$, $y = \\frac{13}{3}$, so $B = \\left(0, \\frac{13}{3}\\right)$. The area is $\\frac{1}{2} \\times \\frac{13}{2} \\times \\frac{13}{3} = \\frac{169}{12} = 14.08$ to two decimal places.',
    )
    expect(answer(b)).toBe(14.08)
    expect(b.question.markScheme.map((l) => l.description)).toEqual(['tangent 2x + 3y = 13', 'both intercepts', '169/12 or 14.08'])
  })
  it('writes the tangent at (−5, 8) as 5x − 8y = −89, the x coefficient positive', () => {
    const b = find(TANGENT, 'q15', (b) => b.question.prompt === 'The tangent to the circle $x^2 + y^2 = 89$ at $(-5, 8)$ meets the $x$ axis at $A$ and the $y$ axis at $B$. Work out the area of triangle $OAB$. Give your answer to two decimal places.')
    expect(b.question.solution).toBe(
      'The radius to $(-5, 8)$ has gradient $-\\frac{8}{5}$, so the tangent has gradient $\\frac{5}{8}$ and, through $(-5, 8)$, its equation is $5x - 8y = -89$. At $y = 0$, $x = -\\frac{89}{5}$, so $A = \\left(-\\frac{89}{5}, 0\\right)$; at $x = 0$, $y = \\frac{89}{8}$, so $B = \\left(0, \\frac{89}{8}\\right)$. The area is $\\frac{1}{2} \\times \\frac{89}{5} \\times \\frac{89}{8} = \\frac{7921}{80} = 99.01$ to two decimal places. ($OA$ and $OB$ are lengths, so the signs are dropped.)',
    )
    expect(answer(b)).toBe(99.01)
    expect(b.question.markScheme[0]!.description).toBe('tangent 5x − 8y = −89')
  })
})

describe('the reviewed exclusions hold over 3000 seeds', () => {
  const many = (id: string, slot: string) => build(id, slot, 3000, 'fixes')
  it('q10: a y asked is never the other root, and |c| is never N', () => {
    for (const b of many(TANGENT, 'q10')) {
      const other = Number(b.values.x1) === Number(/\$([xy]) = (-?\d+)\$\.$/.exec(b.question.solution)![2]) ? Number(b.values.x2) : Number(b.values.x1)
      if (b.values.coord === 'y') expect(Math.abs(answer(b)), b.seed).not.toBe(Math.abs(other))
      expect(Math.abs(Number(b.values.c)), b.seed).not.toBe(Number(b.values.N))
    }
  })
  it('q15: the x coefficient of the printed tangent is positive', () => {
    for (const b of many(TANGENT, 'q15')) {
      expect(b.question.solution, b.seed).toMatch(/its equation is \$\d+x [+-] \d+y = -?\d+\$/)
      expect(b.question.markScheme[0]!.description, b.seed).toMatch(/^tangent \d+x [+−] \d+y = −?\d+$/)
    }
  })
  it('q14: no coordinate is 1', () => {
    for (const b of many(TANGENT, 'q14')) expect(Math.min(Math.abs(Number(b.values.p)), Math.abs(Number(b.values.q))), b.seed).toBeGreaterThanOrEqual(2)
  })
  it('q7: no collinear centre, no origin on the circle, no same-sheet point or circle', () => {
    for (const b of many(TANGENT, 'q7')) {
      const { a, b: cb, N } = circleIn(b.question.prompt)
      const [[x, y]] = points(b.question.prompt) as [[number, number]]
      if (a !== 0 || cb !== 0) {
        expect(a * (y - cb), b.seed).not.toBe(cb * (x - a))
        expect(a * a + cb * cb, b.seed).not.toBe(N)
      }
      expect(a === 0 && cb === 0 && N === 25 && Math.abs(x) === 3 && Math.abs(y) === 4, b.seed).toBe(false)
      expect(b.question.prompt, b.seed).not.toMatch(/\(x - 1\)\^2 \+ \(y [+-] 2\)\^2 = 25/)
    }
  })
  it('q12: every calculation under a sixth and |c| = N/2 under a fifth', () => {
    const built = many(TANGENT, 'q12')
    expect(top(tally(built, (b) => `${Math.abs(Number(b.values.m))}:${b.values.N}`), built.length)).toBeLessThanOrEqual(1 / 6)
    expect(share(built, (b) => Math.abs(answer(b)) * 2 === Number(b.values.N))).toBeLessThan(0.2)
  })
  it('q4: the radius is never a centre coordinate', () => {
    for (const b of many(EQUATION, 'q4')) {
      const { a, b: cb, N } = circleIn(b.question.prompt)
      expect([Math.abs(a), Math.abs(cb)], b.seed).not.toContain(Math.sqrt(N))
    }
  })
  it('q9: flat diameters are at most 8% of builds', () => {
    expect(share(many(EQUATION, 'q9'), (b) => b.values.kind === 'flat')).toBeLessThanOrEqual(0.08)
  })
})

describe('every draw succeeds', () => {
  it('over 3000 seeds per slot', () => {
    for (const [id, slot] of [[EQUATION, 'q1'], [EQUATION, 'q4'], [EQUATION, 'q9'], [TANGENT, 'q7'], [TANGENT, 'q10'], [TANGENT, 'q12'], [TANGENT, 'q14'], [TANGENT, 'q15']] as const) {
      const all = build(id, slot, 3000, 'many')
      expect(all.every((b) => b.check.agrees), `${id} ${slot}`).toBe(true)
      expect(all.every((b) => !/\b(a|A|an|An) \d/.test(b.question.prompt)), `${id} ${slot}`).toBe(true)
    }
  }, 120_000)
})
