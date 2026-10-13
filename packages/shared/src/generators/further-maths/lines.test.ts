import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { RIGHTS, TRIPLES, calcKey } from './lines.ts'

/**
 * Structural tests for the Further Maths coordinate generators (8365 3.1–3.3, 3.5). The
 * prompt's points, gradient and equation are read back with this file's own readers and worked
 * again here; each printed step is checked, the named wrong routes are shown to differ, and the
 * answers and inputs are shown to spread. All of it is non-calculator: whole coordinates,
 * Pythagorean distances, terminating decimals.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/further-maths')
const TOPIC = 'gradients-distance-and-points-on-a-line'
const bank = Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300, prefix = 'lines'): Generated[] {
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

const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const share = (built: Generated[], pred: (b: Generated) => boolean) => built.filter(pred).length / built.length
const points = (text: string) => [...text.matchAll(/\((-?\d+), (-?\d+)\)/g)].map((m) => [Number(m[1]), Number(m[2])] as const)
const mathOf = (text: string) => [...text.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]!)
/** At most three decimal places, so the decimal asked for terminates and is typed exactly. */
const terminates = (x: number) => Math.abs(x * 1000 - Math.round(x * 1000)) < 1e-9

function common(built: Generated[], minDistinct = 10) {
  for (const b of built) {
    const q = b.question
    expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
    expect(`${q.prompt} ${q.solution}`, b.seed).not.toMatch(/\+ -|- -|\+-|(?:^|[^\d.\w{])1[xy](?![a-z])|\^1(?!\d)|(?:^|[^\d.])0[xy]/)
    expect(q.type === 'numeric' && q.tolerance, b.seed).toBe(0)
    expect(mark(q, String(answer(b))).correct, b.seed).toBe(true)
    expect(mark(q, String(answer(b) + 1)).correct, b.seed).toBe(false)
    expect(q.solution, b.seed).toContain(String(answer(b)))
    expect(b.check.agrees, `${b.seed}: ${b.check.detail}`).toBe(true)
    // "Give your answer as a decimal" exactly when the answer is not whole, and then it terminates.
    expect(q.prompt.endsWith(' Give your answer as a decimal.'), b.seed).toBe(!Number.isInteger(answer(b)))
    expect(terminates(answer(b))).toBe(true)
    // Non-calculator: whole coordinates of at most two digits.
    for (const [x, y] of points(q.prompt)) for (const v of [x, y]) expect(Math.abs(v)).toBeLessThanOrEqual(30)
  }
  const counts = new Map<number, number>()
  for (const b of built) counts.set(answer(b), (counts.get(answer(b)) ?? 0) + 1)
  expect(Math.max(...counts.values()) / built.length).toBeLessThanOrEqual(0.4)
  expect(counts.size).toBeGreaterThanOrEqual(minDistinct)
  expect(new Set(built.map((b) => b.question.prompt)).size).toBeGreaterThan(100)
}

/** No coordinate has the answer's size. */
function noPrintedAnswer(b: Generated) {
  const coords = points(b.question.prompt).flat()
  expect(coords.map(Math.abs), b.seed).not.toContain(Math.abs(answer(b)))
}

describe('fm-gradient-and-distance q1: a negative gradient', () => {
  const built = build('fm-gradient-and-distance', 'q1')
  it('is rise over run of the printed points, every step holds, and no slip gives it', () => {
    for (const b of built) {
      const [[x1, y1], [x2, y2]] = points(b.question.prompt) as [[number, number], [number, number]]
      const m = (y2 - y1) / (x2 - x1)
      expect(answer(b), b.seed).toBe(m)
      expect(m).not.toBe(0)
      // Run over rise, the sign lost, the orders mixed, adding: all differ.
      for (const s of [(x2 - x1) / (y2 - y1), -m, (y2 - y1) / (x1 - x2), (y1 + y2) / (x1 + x2)]) expect(answer(b), `${b.seed}: ${s}`).not.toBe(s)
      noPrintedAnswer(b)
      expect(new Set([x1, y1, x2, y2].map(Math.abs)).size).toBe(4)
      const sub = (v: number) => (v < 0 ? `(${v})` : `${v}`)
      expect(b.question.solution.startsWith(`$m = \\dfrac{${y2} - ${sub(y1)}}{${x2} - ${sub(x1)}} = \\dfrac{${y2 - y1}}{${x2 - x1}} = `), b.seed).toBe(true)
      const m2 = /(down|up) \$(\d+)\$ for every \$(\d+)\$ along/.exec(b.question.solution)!
      expect((m2[1] === 'down' ? -1 : 1) * Number(m2[2]) / Number(m2[3])).toBe(m)
    }
  })
  it('spreads answers, wholes and decimals, and which point comes first', () => {
    common(built)
    // A decimal about one time in five, mostly a half.
    const many = build('fm-gradient-and-distance', 'q1', 1000, 'decimals')
    const decimals = many.filter((b) => !Number.isInteger(answer(b)))
    expect(decimals.length / many.length).toBeGreaterThan(0.14)
    expect(decimals.length / many.length).toBeLessThan(0.26)
    expect(share(decimals, (b) => Number.isInteger(answer(b) * 2))).toBeGreaterThan(0.6)
    expect(share(built, (b) => { const [[a], [c]] = points(b.question.prompt); return a! > c! })).toBeGreaterThan(0.15)
    // Positive about a third of the time, so a habitual minus does not pay.
    const up = share(many, (b) => answer(b) > 0)
    expect(up).toBeGreaterThan(0.25)
    expect(up).toBeLessThan(0.42)
  })
  it('writes −2 as the written solution does, for (1, 9) and (4, 3); the written (2, 7) is left out, its 2 being the answer\'s size', () => {
    const b = find('fm-gradient-and-distance', 'q1', (b) => b.question.prompt === 'Work out the gradient of the line through $(1, 9)$ and $(4, 3)$.')
    expect(b.question.solution).toBe('$m = \\dfrac{3 - 9}{4 - 1} = \\dfrac{-6}{3} = -2$: down $2$ for every $1$ along. Subtract in the same order on the top and the bottom.')
    for (const x of build('fm-gradient-and-distance', 'q1')) expect(x.question.prompt).not.toContain('$(2, 7)$ and $(6, -1)$')
  })
})

describe('fm-gradient-and-distance q3: a distance by Pythagoras', () => {
  const built = build('fm-gradient-and-distance', 'q3')
  it('is √(dx² + dy²) of the printed points, whole, every step holds, and no slip gives it', () => {
    for (const b of built) {
      const [[x1, y1], [x2, y2]] = points(b.question.prompt) as [[number, number], [number, number]]
      const dx = x2 - x1
      const dy = y2 - y1
      expect(answer(b) ** 2, b.seed).toBe(dx * dx + dy * dy)
      expect(Number.isInteger(answer(b))).toBe(true)
      // Adding the differences, or leaving the square root off.
      for (const s of [Math.abs(dx) + Math.abs(dy), dx * dx + dy * dy]) expect(answer(b)).not.toBe(s)
      noPrintedAnswer(b)
      const chain = mathOf(b.question.solution)[0]!.split(' = ')
      expect(chain[0]).toBe('d')
      expect(chain.at(-1)).toBe(String(answer(b)))
      expect(chain.at(-2)).toBe(`\\sqrt{${answer(b) ** 2}}`)
      expect(chain.at(-3)).toBe(`\\sqrt{${dx * dx} + ${dy * dy}}`)
      // By hand: every coordinate within ±15, a distance of at most 25 (√625).
      for (const v of [x1, y1, x2, y2]) expect(Math.abs(v), b.seed).toBeLessThanOrEqual(15)
      expect(answer(b)).toBeLessThanOrEqual(25)
    }
  })
  it('spreads distances over all seven triples, so no triple dominates', () => {
    common(built, 7)
    expect(TRIPLES.every(([a, b, c]) => a * a + b * b === c * c)).toBe(true)
  })
})

describe('fm-gradient-and-distance q5: a perpendicular gradient as a decimal', () => {
  const built = build('fm-gradient-and-distance', 'q5')
  const given = (b: Generated) => {
    const g = /has gradient \$([^$]+)\$/.exec(b.question.prompt)![1]!
    const f = /^(-?)\\dfrac\{(\d+)\}\{(\d+)\}$/.exec(g)
    return f ? (f[1] ? -1 : 1) * (Number(f[2]) / Number(f[3])) : Number(g)
  }
  it('multiplies with the printed gradient to −1, and no slip gives it', () => {
    for (const b of built) {
      const m = given(b)
      expect(m * answer(b), b.seed).toBeCloseTo(-1, 12)
      expect(Number.isInteger(answer(b))).toBe(false)
      // The reciprocal without the sign change, the sign change without the reciprocal.
      expect(answer(b)).not.toBeCloseTo(1 / m, 9)
      expect(answer(b)).not.toBeCloseTo(-m, 9)
      expect(b.question.solution).toContain(`= ${answer(b)}$. Check: `)
      expect(b.question.solution).toMatch(/= -1\$\.$/)
    }
  })
  it('spreads answers, signs and fractions', () => {
    common(built)
    expect(share(built, (b) => answer(b) > 0)).toBeGreaterThan(0.2)
    expect(share(built, (b) => !b.question.prompt.includes('\\dfrac'))).toBeLessThan(0.3)
  })
  it('keeps the written 2/3 and its solution', () => {
    const b = find('fm-gradient-and-distance', 'q5', (b) => b.question.prompt === 'A line has gradient $\\dfrac{2}{3}$. Work out the gradient of a line perpendicular to it. Give your answer as a decimal.')
    expect(b.question.solution).toBe('The negative reciprocal of $\\frac{2}{3}$ is $-\\frac{3}{2} = -1.5$. Check: $\\frac{2}{3} \\times \\left(-\\frac{3}{2}\\right) = -1$.')
  })
})

describe('fm-gradient-and-distance q8: c from ax + by = c', () => {
  const built = build('fm-gradient-and-distance', 'q8')
  /** The printed equation's x and y coefficients and constant, read by substituting into it here. */
  const coefficients = (b: Generated) => {
    const eq = mathOf(b.question.prompt)[0]!
    const [l, r] = eq.split(' = ')
    const js = (t: string) => new Function('x', 'y', `return ${t.replace(/(\d)([xy])/g, '$1*$2').replace(/\s+/g, '')}`) as (x: number, y: number) => number
    const f = (x: number, y: number) => js(l!)(x, y) - js(r!)(x, y)
    return { A: f(1, 0) - f(0, 0), B: f(0, 1) - f(0, 0), C: f(0, 0), eq }
  }
  it('is the y-intercept of the printed equation, and no slip gives it', () => {
    for (const b of built) {
      const { A, B, C } = coefficients(b)
      const k = -C / B
      expect(answer(b), b.seed).toBe(k)
      expect(Number.isInteger(k)).toBe(true)
      expect(Math.abs(B)).toBeGreaterThanOrEqual(2)
      // The x-intercept, the right-hand side itself, the gradient.
      for (const s of [-C / A, -C, -A / B]) expect(Math.abs(answer(b)), `${b.seed}: ${s}`).not.toBe(Math.abs(s))
      expect([A, B].map(Math.abs)).not.toContain(Math.abs(k))
      const [moved, line] = mathOf(b.question.solution)
      expect(moved!.startsWith(`${B}y = `)).toBe(true)
      expect(line!.endsWith(k < 0 ? ` - ${-k}` : ` + ${k}`)).toBe(true)
    }
  })
  it('spreads answers and forms', () => {
    common(built)
    expect(share(built, (b) => b.question.prompt.includes('= 0$'))).toBeGreaterThan(0.15)
    expect(share(built, (b) => /\$-?\d*y/.test(b.question.prompt))).toBeGreaterThan(0.15)
    expect(share(built, (b) => coefficients(b).B < 0)).toBeGreaterThan(0.15)
  })
  it('keeps the written 3x + 2y = 12 and its working', () => {
    const b = find('fm-gradient-and-distance', 'q8', (b) => b.question.prompt === 'Write $3x + 2y = 12$ in the form $y = mx + c$. Give the value of $c$.')
    expect(b.question.solution).toBe('$2y = -3x + 12$, so $y = -\\tfrac{3}{2}x + 6$: gradient $-\\tfrac{3}{2}$ and $y$-intercept $c = 6$.')
  })
})

describe('fm-right-angled-triangle-area q16: the area from the perpendicular sides', () => {
  const built = build('fm-right-angled-triangle-area', 'q16')
  it('finds the right angle, prints each side as a surd, and the area agrees with the cross product', () => {
    for (const b of built) {
      const vs = points(b.question.prompt) as [number, number][]
      expect(vs.length).toBe(3)
      const cross = Math.abs((vs[1]![0] - vs[0]![0]) * (vs[2]![1] - vs[0]![1]) - (vs[2]![0] - vs[0]![0]) * (vs[1]![1] - vs[0]![1]))
      expect(answer(b) * 2, b.seed).toBe(cross)
      const at = /right-angled at \$([ABC])\$/.exec(b.question.solution)![1]!
      const i = 'ABC'.indexOf(at)
      const [j, k] = [0, 1, 2].filter((x) => x !== i) as [number, number]
      const u = [vs[j]![0] - vs[i]![0], vs[j]![1] - vs[i]![1]]
      const v = [vs[k]![0] - vs[i]![0], vs[k]![1] - vs[i]![1]]
      expect(u[0]! * v[0]! + u[1]! * v[1]!, b.seed).toBe(0)
      // Neither side is horizontal or vertical: the gradients are real fractions.
      expect(u.concat(v).every((c) => c !== 0)).toBe(true)
      // Each side printed as k√n with k²n its squared length.
      const sides = [...b.question.solution.matchAll(/\$([ABC]{2}) = \\sqrt\{[^}]+\} = \\sqrt\{(\d+)\}(?: = (\d+)\\sqrt\{(\d+)\})?\$/g)]
      expect(sides.length, b.seed).toBe(2)
      const lens = sides.map((s) => (s[3] ? [Number(s[3]), Number(s[4])] : [1, Number(s[2])]) as [number, number])
      for (const [s, [kk, n]] of sides.map((s, x) => [s, lens[x]!] as const)) expect(kk * kk * n).toBe(Number(s[2]))
      expect(sides.map((s) => s[1]).sort()).toEqual([`${'ABC'[Math.min(i, j)]}${'ABC'[Math.max(i, j)]}`, `${'ABC'[Math.min(i, k)]}${'ABC'[Math.max(i, k)]}`].sort())
      expect(lens[0]![0] * lens[1]![0] * lens[0]![1]).toBe(2 * answer(b))
      expect(b.question.solution.endsWith(`= \\frac{1}{2} \\times ${lens[0]![0] * lens[1]![0]} \\times ${lens[0]![1]} = ${answer(b)}$.`)).toBe(true)
      // Without the half, or with the hypotenuse, the answer would differ.
      expect(answer(b)).not.toBe(cross)
      noPrintedAnswer(b)
      expect(b.question.markScheme.map((l) => l.code)).toEqual(['M1', 'A1'])
      expect(b.question.markScheme[1]!.description).toBe(String(answer(b)))
      for (const v of vs.flat()) expect(v >= -4 && v <= 14).toBe(true)
    }
  })
  it('spreads answers, the right-angle vertex and the side directions', () => {
    common(built)
    for (const at of ['A', 'B', 'C']) expect(share(built, (b) => b.question.solution.includes(`right-angled at $${at}$`))).toBeGreaterThan(0.15)
    expect(share(built, (b) => b.values.n !== 2)).toBeGreaterThan(0.3)
    expect(RIGHTS.every(({ s, t }) => s !== t)).toBe(true)
  })
  it('lets no calculation (n, {s, t}) and no area take over a sixth of 1000 builds, and reaches 13 areas', () => {
    const many = build('fm-right-angled-triangle-area', 'q16', 1000, 'calcs')
    const tally = (key: (b: Generated) => string | number) => {
      const m = new Map<string | number, number>()
      for (const b of many) m.set(key(b), (m.get(key(b)) ?? 0) + 1)
      return m
    }
    const calcs = tally((b) => calcKey({ p: Number(b.values.p), q: Number(b.values.q), s: Number(b.values.s), t: Number(b.values.t) }))
    const areas = tally(answer)
    expect(Math.max(...calcs.values()) / many.length).toBeLessThanOrEqual(1 / 6)
    expect(Math.max(...areas.values()) / many.length).toBeLessThanOrEqual(1 / 6)
    expect(areas.size).toBeGreaterThanOrEqual(13)
    expect(calcs.size).toBe(new Set(RIGHTS.map(calcKey)).size)
  })
  it('works a triangle like the specification\'s A(0, 2), B(4, 6), C(10, 0), right-angled at B, here with sides 3√13 and 2√13', () => {
    // Seed find-28 draws it; the exact specification triangle is one draw in about 100 000.
    const b = build('fm-right-angled-triangle-area', 'q16', 29, 'find')[28]!
    expect(b.question.prompt).toBe('Work out the area of the triangle with vertices $A(0, 8)$, $B(6, -1)$ and $C(12, 3)$.')
    expect(b.question.solution).toBe(
      'The gradient of $AB$ is $\\dfrac{-1 - 8}{6 - 0} = -\\tfrac{3}{2}$ and of $BC$ is $\\dfrac{3 - (-1)}{12 - 6} = \\tfrac{2}{3}$; they multiply to $-1$, so the triangle is right-angled at $B$. ' +
        '$AB = \\sqrt{6^2 + (-9)^2} = \\sqrt{117} = 3\\sqrt{13}$ and $BC = \\sqrt{6^2 + 4^2} = \\sqrt{52} = 2\\sqrt{13}$. ' +
        'The area is $\\frac{1}{2} \\times AB \\times BC = \\frac{1}{2} \\times 3\\sqrt{13} \\times 2\\sqrt{13} = \\frac{1}{2} \\times 6 \\times 13 = 39$.',
    )
    expect(b.question.markScheme.map((l) => l.description)).toEqual(['AB = 3√13 and BC = 2√13, the sides meeting at the right angle', '39'])
  })
})

describe('every draw succeeds', () => {
  it('over 3000 seeds per slot', () => {
    for (const [id, slot] of [['fm-gradient-and-distance', 'q1'], ['fm-gradient-and-distance', 'q3'], ['fm-gradient-and-distance', 'q5'], ['fm-gradient-and-distance', 'q8'], ['fm-right-angled-triangle-area', 'q16']] as const) {
      const all = build(id, slot, 3000, 'many')
      expect(all.every((b) => b.check.agrees), `${id} ${slot}`).toBe(true)
    }
  }, 60_000)
})
