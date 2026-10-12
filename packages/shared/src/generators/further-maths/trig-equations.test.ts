import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate, sheetQuestions } from '../index.ts'
import type { Generated } from '../types.ts'

/**
 * Structural tests for the Further Maths trigonometric equation generators (8365 6.6–6.10).
 * Each prompt's equation and interval are read back with this file's own reader and solved
 * again here from the inverse functions and the periods (the generator's second route scans
 * the interval instead); every printed equation in the working is checked at the solution,
 * every printed angle sum and inverse is recomputed, and the named wrong readings (the
 * calculator's own angle, the other solution, the wrong symmetry, adding 180° where 360° is
 * needed, the ratio upside down) are shown never to pay.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/further-maths')
const TOPIC = 'trigonometric-graphs-identities-and-equations'
const topic = JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8'))
const bank = Question.array().parse(topic.questions)
const written = (id: string) => bank.find((q) => q.id === id)!

const EXACT = 'fm-trig-exact-equation'
const CALC = 'fm-trig-cosine-calculator'
const RATIO = 'fm-trig-sin-cos-ratio'

function build(generatorId: string, slotId: string, count = 300, prefix = 'trig'): Generated[] {
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
const mathOf = (text: string) => [...text.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]!)
const tally = <K,>(built: Generated[], key: (b: Generated) => K) => {
  const m = new Map<K, number>()
  for (const b of built) m.set(key(b), (m.get(key(b)) ?? 0) + 1)
  return m
}
const top = (m: Map<unknown, number>, n: number) => Math.max(...m.values()) / n
const DEG = 180 / Math.PI

// ---------------------------------------------------------------------------------------
// This file's own reader: a printed side is terms joined by " + " and " - ", each a number,
// a root, a fraction or a product of them, perhaps times sin x, cos x or tan x.
// ---------------------------------------------------------------------------------------

type Key = '' | 'sin' | 'cos' | 'tan'
function atom(s: string): number {
  const root = /^(\d*)\\sqrt\{(\d+)\}$/.exec(s)
  if (root) return (root[1] ? Number(root[1]) : 1) * Math.sqrt(Number(root[2]))
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s)
  throw new Error(`not an atom: ${s}`)
}
const TERM = /^(-?)(\d+(?:\.\d+)?)?(\\sqrt\{\d+\})?(?:\\d?frac\{([^{}]*(?:\{\d+\})?)\}\{([^{}]*(?:\{\d+\})?)\})?(?:\\(sin|cos|tan) x)?$/
function termOf(t: string): [Key, number] {
  const m = TERM.exec(t.trim())
  if (!m || (!m[2] && !m[3] && !m[4] && !m[6])) throw new Error(`not a term: ${t}`)
  let v = (m[1] ? -1 : 1) * (m[2] ? Number(m[2]) : 1) * (m[3] ? atom(m[3]) : 1)
  if (m[4] !== undefined) v *= atom(m[4]) / atom(m[5]!)
  return [(m[6] ?? '') as Key, v]
}
function sideOf(side: string): Map<Key, number> {
  const parts = side.trim().split(/ ([+-]) /)
  const out = new Map<Key, number>()
  for (let i = 0; i < parts.length; i += 2) {
    const [k, v] = termOf(parts[i]!)
    const s = i === 0 ? 1 : parts[i - 1] === '-' ? -1 : 1
    out.set(k, (out.get(k) ?? 0) + s * v)
  }
  return out
}
/** Left minus right, by function: 2 sin x + 1 = 0 is {sin: 2, '': 1}. */
function equationOf(tex: string): Map<Key, number> {
  const [l, r, ...rest] = tex.split(' = ')
  if (r === undefined || rest.length) throw new Error(`not one equation: ${tex}`)
  const out = sideOf(l!)
  for (const [k, v] of sideOf(r)) out.set(k, (out.get(k) ?? 0) - v)
  for (const [k, v] of out) if (Math.abs(v) < 1e-12) out.delete(k)
  return out
}
const intervalOf = (prompt: string) => {
  const m = /\$(-?\d+)° \\leqslant x \\leqslant (-?\d+)°\$/.exec(prompt)!
  return [Number(m[1]), Number(m[2])] as const
}
/** Solutions in [lo, hi] from the inverse and the period: never a scan. */
function solve(fn: 'sin' | 'cos' | 'tan', v: number, lo: number, hi: number): number[] {
  const out: number[] = []
  for (let k = -2; k <= 2; k++) {
    const c =
      fn === 'sin' ? [Math.asin(v) * DEG + 360 * k, 180 - Math.asin(v) * DEG + 360 * k]
        : fn === 'cos' ? [Math.acos(v) * DEG + 360 * k, -Math.acos(v) * DEG + 360 * k]
          : [Math.atan(v) * DEG + 180 * k]
    for (const x of c) if (x >= lo - 1e-9 && x <= hi + 1e-9 && !out.some((y) => Math.abs(y - x) < 1e-9)) out.push(x)
  }
  return out.sort((a, b) => a - b)
}
/** The one function in a printed equation and the value it is set to. */
function oneFunction(tex: string): { fn: 'sin' | 'cos' | 'tan'; v: number } {
  const e = equationOf(tex)
  const fns = [...e.keys()].filter((k) => k !== '') as ('sin' | 'cos' | 'tan')[]
  expect(fns.length, tex).toBe(1)
  return { fn: fns[0]!, v: -(e.get('') ?? 0) / e.get(fns[0]!)! }
}

/** Every printed equation in the working that this reader can read holds at fn x = v. */
function stepsHold(solution: string, fn: string, v: number): number {
  let checked = 0
  for (const span of mathOf(solution)) {
    if (!span.includes(`\\${fn} x`) || span.split(' = ').length !== 2) continue
    let e: Map<Key, number>
    try {
      e = equationOf(span)
    } catch {
      continue
    }
    const total = [...e].reduce((s, [k, c]) => s + c * (k === '' ? 1 : v), 0)
    expect(Math.abs(total), `${span} at ${v}`).toBeLessThan(1e-9)
    checked++
  }
  return checked
}

/** Every printed "a° ± b° = c°" adds up, and every printed inverse is the calculator's. */
function arithmeticHolds(solution: string) {
  for (const m of solution.matchAll(/\$(-?\d+(?:\.\d+)?)° ([+-]) (\d+(?:\.\d+)?)° = (-?\d+(?:\.\d+)?)°\$/g)) {
    const got = m[2] === '+' ? Number(m[1]) + Number(m[3]) : Number(m[1]) - Number(m[3])
    expect(Math.round(got * 100) / 100, m[0]).toBe(Number(m[4]))
  }
  for (const m of solution.matchAll(/\\(sin|cos|tan)\^\{-1\}(?:\\left)?\((.+?)(?:\\right)?\) = (-?\d+(?:\.(\d+))?)°/g)) {
    const inside = m[2]!
    const f = /^(-?)\\frac\{(.+)\}\{(.+)\}$/.exec(inside)
    const v = f ? (f[1] ? -1 : 1) * (atom(f[2]!) / atom(f[3]!)) : Number(inside)
    const deg = { sin: Math.asin, cos: Math.acos, tan: Math.atan }[m[1] as 'sin']!(v) * DEG
    const places = m[4]?.length ?? 0
    expect(Number(deg.toFixed(places)), m[0]).toBe(Number(m[3]))
  }
}

/** Forms with fn x already alone, where the working has nothing to rearrange. */
const ALONE = ['decimal', 'fraction', 'reciprocal', 'whole']
const SIGNS = /\+ -|- -|\+-|(?:^|[^\d.\w{])1\\(?:sin|cos|tan)|(?:^|[^\d.])0\\(?:sin|cos|tan)|\^1(?!\d)/

function common(built: Generated[], { tol = 0, minDistinct = 6 } = {}) {
  for (const b of built) {
    const q = b.question
    expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
    expect(`${q.prompt} ${q.solution}`, b.seed).not.toMatch(SIGNS)
    expect(tolerance(b), b.seed).toBe(tol)
    expect(mark(q, String(answer(b))).correct, b.seed).toBe(true)
    expect(mark(q, String(answer(b) + 0.01)).correct, b.seed).toBe(tol > 0.01)
    expect(q.solution, b.seed).toContain(String(answer(b)))
    expect(b.check.agrees, `${b.seed}: ${b.check.detail}`).toBe(true)
    expect(b.question.markScheme.at(-1)!.description, b.seed).toBe(tol ? answer(b).toFixed(2) : String(answer(b)))
    arithmeticHolds(q.solution)
  }
  const counts = tally(built, answer)
  expect(top(counts, built.length)).toBeLessThanOrEqual(0.4)
  expect(counts.size).toBeGreaterThanOrEqual(minDistinct)
}

/** Over 1000 builds: no prompt in more than 5%, the written prompt in no more than 5%. */
function promptsSpread(generatorId: string, slotId: string) {
  const many = build(generatorId, slotId, 1000, 'spread')
  const prompts = tally(many, (b) => b.question.prompt)
  expect(prompts.size).toBeGreaterThan(100)
  expect(top(prompts, many.length)).toBeLessThanOrEqual(0.05)
  expect(share(many, (b) => b.question.prompt === written(slotId).prompt)).toBeLessThanOrEqual(0.05)
}

// ---------------------------------------------------------------------------------------

describe('fm-trig-exact-equation q3: a sine equation by hand, the larger or smaller solution', () => {
  const built = build(EXACT, 'q3')
  it('is the asked solution of the printed equation, worked from sin⁻¹ and the period', () => {
    for (const b of built) {
      const q = b.question
      const tex = mathOf(q.prompt)[0]!
      const { fn, v } = oneFunction(tex)
      expect(fn).toBe('sin')
      expect([0.5, Math.sqrt(3) / 2, Math.SQRT2 / 2].some((s) => Math.abs(Math.abs(v) - s) < 1e-12), tex).toBe(true)
      expect(intervalOf(q.prompt)).toEqual([0, 360])
      const sols = solve('sin', v, 0, 360)
      expect(sols.length).toBe(2)
      const which = /Write down the (larger|smaller) solution\.$/.exec(q.prompt)![1]
      const want = which === 'larger' ? sols[1]! : sols[0]!
      expect(Math.abs(answer(b) - want), b.seed).toBeLessThan(1e-9)
      // A positive value never asks the smaller, which is the calculator's own angle.
      if (v > 0) expect(which).toBe('larger')
      expect(q.solution.endsWith(`The ${which} is $${answer(b)}°$.`)).toBe(true)
      // Named wrong readings: the other solution, the calculator's angle, the cosine's
      // symmetry (360° − α), the wrong half of the axis (180° − α for a negative value).
      const alpha = Math.abs(Math.asin(v) * DEG)
      const other = which === 'larger' ? sols[0]! : sols[1]!
      // Above the axis: the acute angle and the cosine's 360° − α. Below: the acute angle, the
      // calculator's −α, and the positive value's 180° − α.
      const wrongs = v > 0 ? [other, alpha, 360 - alpha] : [other, alpha, -alpha, 180 - alpha]
      for (const wrong of wrongs) {
        expect(mark(q, String(Math.round(wrong * 1e6) / 1e6)).correct, `${b.seed} ${wrong}`).toBe(false)
      }
      const checked = stepsHold(q.solution, 'sin', v)
      if (!ALONE.includes(String(b.values.form))) expect(checked, b.seed).toBeGreaterThanOrEqual(1)
      // The written level: the value alone or one coefficient to divide by. Nothing to move
      // across, nothing set to zero.
      expect(['decimal', 'fraction', 'reciprocal', 'coefficient', 'multiple']).toContain(b.values.form)
      expect(tex, b.seed).toMatch(/^(\d+|\d*\\sqrt\{2\})?\\sin x = -?[^ +=]+$/)
      expect(tex.split(' = ')[1]).not.toBe('0')
      expect(q.markScheme).toEqual([{ code: 'B1', marks: 1, description: String(answer(b)) }])
    }
  })
  it('prints the written solution for the written equation', () => {
    const b = find(EXACT, 'q3', (b) => b.question.prompt === written('q3').prompt)
    expect(b.question.solution).toBe(written('q3').solution)
  })
  it('mostly positive values, as the 4-5 band wants; no calculation over a quarter', () => {
    common(built, { minDistinct: 9 })
    const many = build(EXACT, 'q3', 3000, 'calc')
    // Only three positive calculations exist, so the band wins over the usual sixth.
    expect(top(tally(many, (b) => `${b.values.kind} ${b.values.sign} ${b.values.which}`), many.length)).toBeLessThanOrEqual(0.25)
    expect(tally(many, answer).size).toBe(9)
    const positive = share(many, (b) => b.values.sign === 1)
    expect(positive).toBeGreaterThan(0.65)
    expect(positive).toBeLessThan(0.8)
    expect(tally(many, (b) => b.values.form).size).toBe(5)
    promptsSpread(EXACT, 'q3')
  })
})

describe('fm-trig-exact-equation q6: a cosine equation with a negative exact value', () => {
  const built = build(EXACT, 'q6')
  it('is the asked solution, in the second or third quadrant', () => {
    for (const b of built) {
      const q = b.question
      const { fn, v } = oneFunction(mathOf(q.prompt)[0]!)
      expect(fn).toBe('cos')
      expect(v).toBeLessThan(0)
      const sols = solve('cos', v, 0, 360)
      expect(sols.length).toBe(2)
      const which = /Write down the (larger|smaller) solution\.$/.exec(q.prompt)![1]
      expect(answer(b)).toBeCloseTo(which === 'larger' ? sols[1]! : sols[0]!, 9)
      expect(answer(b)).toBeGreaterThan(90)
      expect(answer(b)).toBeLessThan(270)
      // Named wrong readings: the acute angle, the positive cosine's 360° − α, the other solution.
      const alpha = Math.acos(-v) * DEG
      for (const wrong of [alpha, 360 - alpha, which === 'larger' ? sols[0]! : sols[1]!]) {
        expect(mark(q, String(Math.round(wrong * 1e6) / 1e6)).correct).toBe(false)
      }
      const checked = stepsHold(q.solution, 'cos', v)
      if (!ALONE.includes(String(b.values.form))) expect(checked, b.seed).toBeGreaterThanOrEqual(1)
      expect(q.solution).toContain('Cosine is negative in the second and third quadrants')
    }
  })
  it('prints the written solution for the written equation', () => {
    const b = find(EXACT, 'q6', (b) => b.question.prompt === written('q6').prompt)
    expect(b.question.solution).toBe(written('q6').solution)
  })
  it('spreads the six calculations the maths allows, each about a sixth', () => {
    common(built, { minDistinct: 6 })
    const many = build(EXACT, 'q6', 3000, 'calc')
    expect(tally(many, answer).size).toBe(6)
    expect(top(tally(many, answer), many.length)).toBeLessThanOrEqual(0.19)
    promptsSpread(EXACT, 'q6')
  })
})

describe('fm-trig-exact-equation q7: a tangent equation in an interval of 180°', () => {
  const built = build(EXACT, 'q7')
  it('is the one solution in the printed interval, never the calculator angle', () => {
    for (const b of built) {
      const q = b.question
      const { fn, v } = oneFunction(mathOf(q.prompt)[0]!)
      expect(fn).toBe('tan')
      // ±√3 would print tan 60° = √3 in the working, which q10 on the same sheet asks.
      expect([1, 1 / Math.sqrt(3)].some((s) => Math.abs(Math.abs(v) - s) < 1e-12), b.question.prompt).toBe(true)
      expect(q.solution).not.toMatch(/(?<![\d.])60°/)
      const [lo, hi] = intervalOf(q.prompt)
      expect(hi - lo).toBe(180)
      expect(lo).toBeGreaterThanOrEqual(0)
      const sols = solve('tan', v, lo, hi)
      expect(sols.length, q.prompt).toBe(1)
      expect(answer(b)).toBeCloseTo(sols[0]!, 9)
      // The calculator's angle, the solution in 0° to 360° outside the interval, and
      // adding 180° where 360° is needed.
      const principal = Math.atan(v) * DEG
      const outside = solve('tan', v, 0, 360).filter((x) => x < lo || x > hi)
      for (const wrong of [principal, principal + 180, ...outside]) {
        if (wrong >= lo && wrong <= hi) continue
        expect(mark(q, String(Math.round(wrong * 1e6) / 1e6)).correct, `${b.seed} ${wrong}`).toBe(false)
      }
      expect(q.prompt.endsWith(`for $${lo}° \\leqslant x \\leqslant ${hi}°$.`)).toBe(true)
      const checked = stepsHold(q.solution, 'tan', v)
      if (!ALONE.includes(String(b.values.form))) expect(checked, b.seed).toBeGreaterThanOrEqual(1)
    }
  })
  it('prints the written solution for the written equation', () => {
    const b = find(EXACT, 'q7', (b) => b.question.prompt === written('q7').prompt)
    expect(b.question.solution).toBe(written('q7').solution)
  })
  it('spreads the six calculations, both intervals and both signs', () => {
    common(built, { minDistinct: 6 })
    const many = build(EXACT, 'q7', 3000, 'calc')
    expect(tally(many, answer).size).toBe(6)
    expect(top(tally(many, answer), many.length)).toBeLessThanOrEqual(0.19)
    expect(share(many, (b) => b.values.lo === 0)).toBeGreaterThan(0.25)
    promptsSpread(EXACT, 'q7')
  })
})

describe('fm-trig-cosine-calculator q9: cos x = c, the larger solution to 2 d.p.', () => {
  const built = build(CALC, 'q9')
  it('is 360° less the calculator angle, clear of a rounding boundary', () => {
    for (const b of built) {
      const q = b.question
      const { fn, v } = oneFunction(mathOf(q.prompt)[0]!)
      expect(fn).toBe('cos')
      expect(Math.abs(v)).not.toBe(0.5)
      const sols = solve('cos', v, 0, 360)
      expect(sols.length).toBe(2)
      const exact = sols[1]!
      expect(Math.abs(exact * 100 - Math.round(exact * 100))).toBeLessThan(0.45)
      expect(answer(b)).toBe(Math.round(exact * 100) / 100)
      expect(mark(q, String(exact)).correct, b.seed).toBe(true)
      expect(mark(q, answer(b).toFixed(2)).correct).toBe(true)
      expect(q.prompt.endsWith('Write down the larger solution to two decimal places.')).toBe(true)
      // The calculator angle, the sine's 180° − α, the tan's 180° + α.
      for (const wrong of [sols[0]!, 180 - sols[0]!, 180 + sols[0]!]) expect(Math.abs(wrong - answer(b))).toBeGreaterThan(0.5)
      stepsHold(q.solution, 'cos', v)
      expect(q.markScheme[0]!.description).toMatch(new RegExp(`^cos⁻¹\\(−?[\\d./]+\\) = ${sols[0]!.toFixed(2).replace('.', '\\.')}$`))
    }
  })
  it('prints the written solution for the written equation', () => {
    const b = find(CALC, 'q9', (b) => b.question.prompt === written('q9').prompt)
    expect(b.question.solution).toBe(written('q9').solution)
  })
  it('spreads answers and values, positive and negative', () => {
    common(built, { tol: 0.005, minDistinct: 40 })
    const neg = built.filter((b) => b.values.sign === -1)
    const pos = built.filter((b) => b.values.sign === 1)
    expect(neg.length / built.length).toBeGreaterThan(0.2)
    expect(tally(neg, answer).size).toBeGreaterThan(20)
    expect(tally(pos, answer).size).toBeGreaterThan(40)
    expect(share(built, (b) => b.values.p !== 0)).toBeGreaterThan(0.15)
    promptsSpread(CALC, 'q9')
  })
})

describe('fm-trig-sin-cos-ratio q11 and q14: a sin x = b cos x', () => {
  for (const slotId of ['q11', 'q14'] as const) {
    const which = slotId === 'q11' ? 'smaller' : 'larger'
    const built = build(RATIO, slotId)
    it(`${slotId} is the ${which} solution of tan x = −(cos coefficient)/(sin coefficient)`, () => {
      for (const b of built) {
        const q = b.question
        const e = equationOf(mathOf(q.prompt)[0]!)
        expect([...e.keys()].sort()).toEqual(['cos', 'sin'])
        const a = e.get('sin')!
        const c = e.get('cos')!
        const t = -c / a
        // The sin coefficient is 2 or more, as written, so dividing by it is a step; never
        // tan x = 3, which q13(b) solves.
        expect(a).toBeGreaterThanOrEqual(2)
        expect(Number.isInteger(a)).toBe(true)
        expect(Math.abs(t)).not.toBe(3)
        expect(Math.abs(t)).not.toBe(1)
        const sols = solve('tan', t, 0, 360)
        expect(sols.length).toBe(2)
        const exact = which === 'smaller' ? sols[0]! : sols[1]!
        expect(Math.abs(exact * 100 - Math.round(exact * 100))).toBeLessThan(0.45)
        expect(answer(b)).toBe(Math.round(exact * 100) / 100)
        expect(mark(q, String(exact)).correct).toBe(true)
        expect(q.prompt.endsWith(`Write down the ${which} solution to two decimal places.`)).toBe(true)
        // The ratio upside down, the other solution, the calculator's negative angle and 180° + it.
        const flipped = solve('tan', -a / c, 0, 360)
        const principal = Math.atan(t) * DEG
        for (const wrong of [...flipped, which === 'smaller' ? sols[1]! : sols[0]!, principal, principal + 180]) {
          if (Math.abs(wrong - exact) < 1e-9) continue
          expect(Math.abs(wrong - answer(b)), `${b.seed} ${wrong}`).toBeGreaterThan(0.5)
        }
        if (t < 0) expect(Math.abs((which === 'smaller' ? principal + 180 : principal + 360) - answer(b))).toBeLessThan(0.0051)
        expect(stepsHold(q.solution, 'tan', t)).toBeGreaterThanOrEqual(1)
        expect(q.markScheme[0]!.description).toMatch(/^tan x = −?\d+(\/\d+)?$/)
      }
    })
    it(`${slotId} spreads ratios, signs and answers`, () => {
      common(built, { tol: 0.005, minDistinct: 40 })
      const neg = built.filter((b) => b.values.sign === -1)
      expect(neg.length / built.length).toBeGreaterThan(0.3)
      expect(neg.length / built.length).toBeLessThan(0.5)
      expect(tally(neg, answer).size).toBeGreaterThan(25)
      expect(tally(built.filter((b) => b.values.sign === 1), answer).size).toBeGreaterThan(25)
      promptsSpread(RATIO, slotId)
    })
  }
  it('q11 keeps the written working; the written 2 sin x = cos x itself is left out, its 26.5651° too near a rounding boundary', () => {
    expect(build(RATIO, 'q11', 3000, 'written').some((b) => b.values.a === 2 && b.values.b === 1)).toBe(false)
    const b = find(RATIO, 'q11', (b) => b.question.prompt.startsWith('Solve $4\\sin x = \\cos x$'))
    expect(b.question.solution).toBe(
      'Divide both sides by $\\cos x$: $4\\tan x = 1$, so $\\tan x = \\frac{1}{4}$ and $x = \\tan^{-1}\\left(\\frac{1}{4}\\right) = 14.04°$. The other solution is $14.04° + 180° = 194.04°$. The smaller is $14.04°$.',
    )
  })
  it('a negative ratio moves the calculator angle into the interval', () => {
    const b = find(RATIO, 'q14', (b) => b.question.prompt.includes('Solve $4\\sin x + \\cos x = 0$'))
    expect(b.question.solution).toBe(
      'Subtract $\\cos x$ from both sides and divide by $\\cos x$: $4\\tan x = -1$, so $\\tan x = -\\frac{1}{4}$. The calculator gives $\\tan^{-1}\\left(-\\frac{1}{4}\\right) = -14.04°$, outside the interval. Tan repeats every $180°$, so the solutions are $-14.04° + 180° = 165.96°$ and $-14.04° + 360° = 345.96°$. The larger is $345.96°$.',
    )
    expect(answer(b)).toBe(345.96)
  })
})

describe('q11 and q14 on one advanced sheet', () => {
  it('never share a ratio over 3000 sheets, so q14 is never q11 plus 180°', () => {
    const ids: string[] = topic.worksheets.advanced.questionIds
    const sheetBank = ids.map((id) => written(id))
    let shared = 0
    for (let i = 0; i < 3000; i++) {
      const sheet = sheetQuestions('further-maths', TOPIC, sheetBank, `sheet-${i}`)
      const ratioOf = (id: string) => {
        const g = sheet.find((s) => s.question.id === id)!.generated!
        expect(g, id).toBeDefined()
        const e = equationOf(mathOf(g.question.prompt)[0]!)
        return Math.abs(e.get('cos')! / e.get('sin')!)
      }
      if (Math.abs(ratioOf('q11') - ratioOf('q14')) < 1e-12) shared++
    }
    expect(shared).toBe(0)
  })
})

describe('every draw succeeds', () => {
  it('over 3000 seeds per slot', () => {
    for (const [g, slots] of [[EXACT, ['q3', 'q6', 'q7']], [CALC, ['q9']], [RATIO, ['q11', 'q14']]] as const) {
      for (const s of slots) expect(() => build(g, s, 3000, 'seeds')).not.toThrow()
    }
  })
  it('leaves q1, q12 and q16 written', () => {
    const replaced = GENERATORS.filter((g) => g.topicId === TOPIC).flatMap((g) => g.replaces)
    expect(replaced.sort()).toEqual(['q11', 'q14', 'q3', 'q6', 'q7', 'q9'])
  })
})
