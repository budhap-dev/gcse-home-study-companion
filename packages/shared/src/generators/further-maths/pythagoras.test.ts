import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { CUBOIDS, EXACT_AREAS, EXACT_COSINES } from './pythagoras.ts'

/**
 * Structural tests for the Further Maths trigonometry and Pythagoras generators (8365 6.3–6.5).
 * The prompt's sides, angles and cosines are read back with this file's own readers and the
 * answer worked again from them; each printed step is checked, the named wrong routes (the sum
 * of the legs, the base diagonal for the space diagonal, ½ab cos C, the sine rule upside down,
 * the cosine rule's sign flipped or its 2 dropped, the smallest angle for the largest, the
 * triangle ABG for the angle with the base, the half-diagonal for the half-edge, the angle at
 * the wrong vertex) are shown to differ, and the answers, inputs and cases are shown to spread.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/further-maths')
const TOPIC = 'trigonometry-and-pythagoras-in-2d-and-3d'
const bank = Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8')).questions)
const written = (id: string) => bank.find((q) => q.id === id)!

const TRIPLES_GEN = 'fm-pythagoras-triples'
const RULES = 'fm-sine-and-cosine-rules'
const SOLIDS = 'fm-trigonometry-in-3d'

function build(generatorId: string, slotId: string, count = 300, prefix = 'pythagoras'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = written(slotId)
  return Array.from({ length: count }, (_, i) => generate(g, slot, `${prefix}-${i}`))
}
function find(generatorId: string, slotId: string, ok: (b: Generated) => boolean, tries = 100000): Generated {
  for (let i = 0; i < tries; i++) {
    const [b] = build(generatorId, slotId, 1, `find-${i}`)
    if (ok(b!)) return b!
  }
  throw new Error(`no build of ${generatorId} ${slotId} matches`)
}

const RAD = Math.PI / 180
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const share = (built: Generated[], pred: (b: Generated) => boolean) => built.filter(pred).length / built.length
const tally = <K,>(built: Generated[], key: (b: Generated) => K) => {
  const m = new Map<K, number>()
  for (const b of built) m.set(key(b), (m.get(key(b)) ?? 0) + 1)
  return m
}
const top = (m: Map<unknown, number>, n: number) => Math.max(...m.values()) / n
const r2 = (x: number) => Math.round(x * 100) / 100
const differs = (x: number, b: Generated) => Math.abs(x - answer(b)) > 0.01

/** The maths spans of a text. */
const spans = (text: string) => [...text.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]!)
/** The figures printed, in order: a span that is a number ($8$, $60°$) or a named value ($AB = 8$). */
const figures = (text: string) =>
  spans(text).flatMap((s) => {
    const m = /^(?:[A-Za-z]+ = )?(\d+(?:\.\d+)?)°?$/.exec(s)
    return m ? [Number(m[1])] : []
  })
/** Named values: $a = 4$, $AB = 4$, $A = 30°$. */
const named = (text: string) =>
  Object.fromEntries(spans(text).flatMap((s) => {
    const m = /^([A-Za-z]+) = (\d+(?:\.\d+)?)°?$/.exec(s)
    return m ? [[m[1]!, Number(m[2])] as const] : []
  }))
/** The printed cosine: $\cos A = -\dfrac{1}{4}$. */
function cosineIn(text: string) {
  const m = spans(text).map((s) => /^\\cos ([ABC]) = (-?)\\dfrac\{(\d+)\}\{(\d+)\}$/.exec(s)).find(Boolean)
  if (!m) throw new Error(`no cosine in ${text}`)
  const p = (m[2] ? -1 : 1) * Number(m[3])
  return { V: m[1]!, p, q: Number(m[4]), cos: p / Number(m[4]) }
}

interface Rules {
  /** 0 for a whole answer, 0.005 for two decimal places. */
  tolerance: number
  minDistinct?: number
}

function common(built: Generated[], { tolerance: tol, minDistinct = 10 }: Rules) {
  for (const b of built) {
    const q = b.question
    expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
    expect(`${q.prompt} ${q.solution}`, b.seed).not.toMatch(/\+ -|- -|\+-|NaN|undefined|Infinity/)
    expect(tolerance(b), b.seed).toBe(tol)
    expect(mark(q, String(answer(b))).correct, b.seed).toBe(true)
    expect(mark(q, String(answer(b) + (tol ? 0.02 : 1))).correct, b.seed).toBe(false)
    expect(q.solution, b.seed).toContain(String(answer(b)))
    expect(b.check.agrees, `${b.seed}: ${b.check.detail}`).toBe(true)
    expect(q.markScheme.reduce((s, l) => s + l.marks, 0)).toBe(written(q.id).marks)
    expect(q.markScheme.map((l) => l.code)).toEqual(written(q.id).markScheme.map((l) => l.code))
    if (tol) {
      expect(q.prompt.endsWith(' Give your answer to two decimal places.'), b.seed).toBe(true)
      expect(Math.round(answer(b) * 100), b.seed).toBeCloseTo(answer(b) * 100, 9)
      // Never 60.00 from 60.004: a two-place answer is never whole.
      expect(Number.isInteger(answer(b)), b.seed).toBe(false)
      expect(q.markScheme.at(-1)!.description.endsWith(answer(b).toFixed(2)), b.seed).toBe(true)
    } else {
      expect(Number.isInteger(answer(b)), b.seed).toBe(true)
      expect(q.prompt).not.toMatch(/decimal/)
    }
  }
  const counts = tally(built, answer)
  expect(top(counts, built.length)).toBeLessThanOrEqual(0.4)
  expect(counts.size).toBeGreaterThanOrEqual(minDistinct)
  expect(new Set(built.map((b) => b.question.prompt)).size).toBeGreaterThan(100)
}

/**
 * A two-decimal answer read back: the exact value from the prompt rounds to the answer, sits
 * clear of a rounding boundary, and both it and the rounded value pass the real marker.
 */
function twoPlaces(b: Generated, exact: number) {
  expect(r2(exact), b.seed).toBe(answer(b))
  const scaled = Math.abs(exact * 100 - Math.round(exact * 100))
  expect(scaled, b.seed).toBeLessThan(0.45)
  expect(scaled, b.seed).toBeGreaterThan(1e-6)
  expect(mark(b.question, String(exact)).correct, b.seed).toBe(true)
  expect(mark(b.question, answer(b).toFixed(2)).correct, b.seed).toBe(true)
}

/**
 * The keep-it-exact sentence ends the solution; where rounding the lengths to two places first
 * gives another answer, the sentence names that value, worked here. True when it differs.
 */
function keptExact(b: Generated, keep: string, rounding: string, early: number): boolean {
  const e = Math.round(early * 100) / 100
  const s = b.question.solution
  if (e === answer(b)) expect(s.endsWith(` Keep ${keep} exact until the last step.`), `${b.seed}: ${s}`).toBe(true)
  else expect(s.endsWith(` Keep ${keep} exact until the last step: rounding ${rounding} first gives $${e.toFixed(2)}°$, which is wrong.`), `${b.seed}: ${s}`).toBe(true)
  return e !== answer(b)
}
const twoDp = (x: number) => (Math.round(x * 100) / 100).toFixed(2)

/** The written prompt in at most 5% of 1000 builds and no prompt in more than a tenth. */
function rarelyWritten(generatorId: string, slotId: string) {
  const many = build(generatorId, slotId, 1000, 'written')
  const counts = tally(many, (b) => b.question.prompt)
  expect((counts.get(written(slotId).prompt) ?? 0) / 1000).toBeLessThanOrEqual(0.05)
  expect(top(counts, 1000)).toBeLessThanOrEqual(0.1)
  return many
}

// ---------------------------------------------------------------------------------------

describe('fm-pythagoras-triples q1: the hypotenuse from a triple', () => {
  const built = build(TRIPLES_GEN, 'q1')
  const BASES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]]
  it('is the root of the sum of the printed legs squared, a multiple of a specification triple', () => {
    for (const b of built) {
      const [x, y] = figures(b.question.prompt) as [number, number]
      const c = answer(b)
      expect(x * x + y * y, b.seed).toBe(c * c)
      const base = BASES.find(([p, q, r]) => [p, q, r].every((v, i) => (([Math.min(x, y), Math.max(x, y), c][i]! / v) === c / r)))
      expect(base, b.seed).toBeDefined()
      expect(c).toBeLessThanOrEqual(50)
      // 10, 24, 26 is the right option of the written q2 on the same sheet.
      expect([Math.min(x, y), Math.max(x, y)]).not.toEqual([10, 24])
      expect(c).not.toBe(26)
      // The legs added, or the smaller squared taken from the larger.
      expect(x + y).not.toBe(c)
      expect(Math.sqrt(Math.abs(x * x - y * y))).not.toBe(c)
      expect([x, y]).not.toContain(c)
      expect(b.question.solution, b.seed).toContain(`\\sqrt{${x}^2 + ${y}^2} = \\sqrt{${x * x} + ${y * y}} = \\sqrt{${c * c}} = ${c}$`)
      const k = c / base![2]!
      expect(b.question.solution.endsWith(k === 1 ? 'one of the four in the specification.' : `multiplied by $${k}$.`), b.seed).toBe(true)
    }
  })
  it('spreads triples, multiples and orders, and no calculation takes over', () => {
    common(built, { tolerance: 0 })
    const many = rarelyWritten(TRIPLES_GEN, 'q1')
    const calc = tally(many, (b) => [...figures(b.question.prompt)].sort((p, q) => p - q).join(','))
    expect(calc.size).toBe(13)
    expect(calc.has('10,24')).toBe(false)
    expect(top(calc, many.length)).toBeLessThanOrEqual(1 / 6)
    expect(share(many, (b) => figures(b.question.prompt)[0]! > figures(b.question.prompt)[1]!)).toBeGreaterThan(0.4)
    expect(share(many, (b) => b.question.prompt.startsWith('Triangle'))).toBeGreaterThan(0.25)
  })
  it('works the written 8 and 15 in the written words', () => {
    const b = find(TRIPLES_GEN, 'q1', (b) => b.question.prompt === written('q1').prompt)
    expect(b.question.solution).toBe('Square, add, root: $\\sqrt{8^2 + 15^2} = \\sqrt{64 + 225} = \\sqrt{289} = 17$ cm. This is the $8, 15, 17$ triple, one of the four in the specification.')
    expect(b.question.markScheme).toEqual([{ code: 'B1', marks: 1, description: '17' }])
  })
})

describe('fm-pythagoras-triples q3: a cuboid space diagonal', () => {
  const built = build(TRIPLES_GEN, 'q3')
  it('is the root of the three printed edges squared, by hand', () => {
    for (const b of built) {
      const [x, y, z] = figures(b.question.prompt) as [number, number, number]
      const d = answer(b)
      expect(x * x + y * y + z * z, b.seed).toBe(d * d)
      expect(new Set([x, y, z]).size).toBe(3)
      expect(Math.max(x, y, z)).toBeLessThanOrEqual(20)
      expect(d).toBeLessThanOrEqual(30)
      // The base diagonal alone, the edges added, or the two longest edges only.
      expect(Math.sqrt(x * x + y * y)).not.toBe(d)
      expect(x + y + z).not.toBe(d)
      const [, m, l] = [x, y, z].sort((p, q) => p - q)
      expect(Math.sqrt(m! * m! + l! * l!)).not.toBe(d)
      expect([x, y, z]).not.toContain(d)
      const s = b.question.solution
      expect(s, b.seed).toContain(`\\sqrt{${x}^2 + ${y}^2 + ${z}^2} = \\sqrt{${x * x} + ${y * y} + ${z * z}} = \\sqrt{${d * d}} = ${d}`)
      const base = Math.sqrt(x * x + y * y)
      if (Number.isInteger(base)) {
        expect(s.startsWith(`Base diagonal $\\sqrt{${x}^2 + ${y}^2} = ${base}$, then $\\sqrt{${base}^2 + ${z}^2} = ${d}$`), b.seed).toBe(true)
        expect(b.question.markScheme[0]!.description).toBe(`√(${x}² + ${y}² + ${z}²) or a base diagonal of ${base}`)
      } else expect(s, b.seed).toContain(`$${x}^2 + ${y}^2 = ${x * x + y * y}$`)
    }
  })
  it('spreads cuboids and settings, and no cuboid takes over', () => {
    common(built, { tolerance: 0 })
    const many = rarelyWritten(TRIPLES_GEN, 'q3')
    const calc = tally(many, (b) => [...figures(b.question.prompt)].sort((p, q) => p - q).join(','))
    expect(calc.size).toBe(CUBOIDS.length)
    expect(CUBOIDS.length).toBe(19)
    // The diagonal is drawn first, so 21 (five cuboids have it) is not a quarter of answers.
    expect(top(tally(many, answer), many.length)).toBeLessThanOrEqual(0.15)
    expect(tally(many, answer).size).toBe(12)
    expect(top(calc, many.length)).toBeLessThanOrEqual(1 / 6)
    expect(share(many, (b) => Number.isInteger(Math.hypot(figures(b.question.prompt)[0]!, figures(b.question.prompt)[1]!)))).toBeGreaterThan(0.03)
    for (const start of ['A cuboid', 'A box', 'The cuboid']) expect(share(many, (b) => b.question.prompt.startsWith(start))).toBeGreaterThan(0.25)
  })
  it('works 4 by 3 by 12 in the written words', () => {
    const b = find(TRIPLES_GEN, 'q3', (b) => b.question.prompt === written('q3').prompt)
    expect(b.question.solution).toBe('Base diagonal $\\sqrt{4^2 + 3^2} = 5$, then $\\sqrt{5^2 + 12^2} = 13$ cm. In one line, $\\sqrt{4^2 + 3^2 + 12^2} = \\sqrt{16 + 9 + 144} = \\sqrt{169} = 13$.')
  })
})

// ---------------------------------------------------------------------------------------

describe('fm-sine-and-cosine-rules q4: the area ½ab sin C', () => {
  const built = build(RULES, 'q4')
  it('is half the printed sides times the sine of the printed angle, and no slip gives it', () => {
    for (const b of built) {
      const [a, c, C] = figures(b.question.prompt) as [number, number, number]
      const area = 0.5 * a * c * Math.sin(C * RAD)
      twoPlaces(b, area)
      expect(a).not.toBe(c)
      expect([30, 45, 90, 135, 150]).not.toContain(C)
      // ab sin C, ½ab cos C, and the calculator in radians.
      expect(differs(a * c * Math.sin(C * RAD), b)).toBe(true)
      expect(differs(Math.abs(0.5 * a * c * Math.cos(C * RAD)), b)).toBe(true)
      expect(differs(0.5 * a * c * Math.sin(C), b)).toBe(true)
      const s = b.question.solution
      expect(s.startsWith(`Area $= \\frac{1}{2} \\times ${a} \\times ${c} \\times \\sin ${C}° = ${(a * c) / 2} `), b.seed).toBe(true)
      expect(s, b.seed).toContain(`= ${answer(b).toFixed(2)}$`)
      if (C === 60 || C === 120) {
        // The exact form k√3/d, read back.
        const m = /= (?:\\frac\{(\d+)\\sqrt\{3\}\}\{(\d+)\}|(\d+)\\sqrt\{3\}) = /.exec(s)!
        const exact = m[3] ? Number(m[3]) * Math.sqrt(3) : (Number(m[1]) * Math.sqrt(3)) / Number(m[2])
        expect(exact, b.seed).toBeCloseTo(area, 9)
        expect(b.question.markScheme[0]!.description).toMatch(/√3(\/\d+)? or \d+\.\d\d$/)
      } else expect(b.question.markScheme[0]!.description).toBe(answer(b).toFixed(2))
    }
  })
  it('spreads sides and angles, the exact 60° and 120° about a fifth of the time', () => {
    common(built, { tolerance: 0.005, minDistinct: 100 })
    const many = rarelyWritten(RULES, 'q4')
    const special = share(many, (b) => [60, 120].includes(figures(b.question.prompt)[2]!))
    expect(special).toBeGreaterThan(0.14)
    expect(special).toBeLessThan(0.26)
    expect(share(many, (b) => figures(b.question.prompt)[2]! > 90)).toBeGreaterThan(0.3)
    expect(tally(many, (b) => figures(b.question.prompt)[2]).size).toBeGreaterThan(100)
  })
  it('works the written 7, 8 and 60°', () => {
    const b = find(RULES, 'q4', (b) => b.question.prompt === written('q4').prompt)
    expect(b.question.solution).toBe('Area $= \\frac{1}{2} \\times 7 \\times 8 \\times \\sin 60° = 28 \\times \\frac{\\sqrt{3}}{2} = 14\\sqrt{3} = 24.25$ cm² to two decimal places.')
    expect(b.question.markScheme[0]!.description).toBe('14√3 or 24.25')
  })
})

describe('fm-sine-and-cosine-rules q5: the sine rule for a side', () => {
  const built = build(RULES, 'q5')
  it('is the printed side times sin of the far angle over sin of its own, in a scalene triangle', () => {
    for (const b of built) {
      const v = named(b.question.prompt)
      const known = Object.keys(v).find((k) => /^[abc]$/.test(k))!
      const ask = /Work out \$([abc])\$/.exec(b.question.prompt)![1]!
      expect(ask).not.toBe(known)
      const x = v[known]!
      const X = v[known.toUpperCase()]!
      const Y = v[ask.toUpperCase()]!
      const Z = 180 - X - Y
      const y = (x * Math.sin(Y * RAD)) / Math.sin(X * RAD)
      twoPlaces(b, y)
      expect(new Set([X, Y, Z]).size).toBe(3)
      expect(Z).toBeGreaterThanOrEqual(15)
      // The ratio upside down; the third angle used for the asked one.
      expect(differs((x * Math.sin(X * RAD)) / Math.sin(Y * RAD), b)).toBe(true)
      expect(differs((x * Math.sin(Z * RAD)) / Math.sin(X * RAD), b)).toBe(true)
      expect(b.question.solution, b.seed).toBe(
        `Sine rule: $${ask} = \\dfrac{${known} \\sin ${ask.toUpperCase()}}{\\sin ${known.toUpperCase()}} = \\dfrac{${x} \\sin ${Y}°}{\\sin ${X}°} = ${answer(b).toFixed(2)}$ ${/\$ (cm|m)\b/.exec(b.question.prompt)![1]}.`,
      )
    }
  })
  it('spreads letters, sides and angles', () => {
    common(built, { tolerance: 0.005, minDistinct: 100 })
    const many = rarelyWritten(RULES, 'q5')
    const pairs = tally(many, (b) => /Work out \$([abc])\$/.exec(b.question.prompt)![1]! + Object.keys(named(b.question.prompt)).find((k) => /^[abc]$/.test(k)))
    expect(pairs.size).toBe(6)
    expect(top(pairs, many.length)).toBeLessThan(0.25)
    expect(share(many, (b) => b.question.prompt.includes('The side opposite'))).toBeGreaterThan(0.3)
  })
})

describe('fm-sine-and-cosine-rules q6: the cosine rule for a side', () => {
  const built = build(RULES, 'q6')
  it('is the cosine rule on the printed sides and angle, each printed stage true, and no slip gives it', () => {
    for (const b of built) {
      const [p, q, A] = figures(b.question.prompt) as [number, number, number]
      const sq = p * p + q * q - 2 * p * q * Math.cos(A * RAD)
      twoPlaces(b, Math.sqrt(sq))
      expect(p).not.toBe(q)
      expect(A).not.toBe(90)
      // The sign flipped, the 2 dropped, the square root forgotten.
      expect(differs(Math.sqrt(p * p + q * q + 2 * p * q * Math.cos(A * RAD)), b)).toBe(true)
      expect(differs(Math.sqrt(Math.max(0, p * p + q * q - p * q * Math.cos(A * RAD))), b)).toBe(true)
      expect(differs(sq, b)).toBe(true)
      const s = b.question.solution
      const side = /Work out \$([abc])\$/.exec(b.question.prompt)?.[1] ?? 'a'
      expect(s.startsWith(`Cosine rule: $${side}^2 = ${p}^2 + ${q}^2 - 2 \\times ${p} \\times ${q} \\times \\cos ${A}° = ${p * p} + ${q * q} `), b.seed).toBe(true)
      if (A === 60 || A === 120) {
        const n = A === 60 ? p * p + q * q - p * q : p * p + q * q + p * q
        expect(s, b.seed).toContain(`${A === 60 ? '-' : '+'} ${p * q} = ${n}$`)
        expect(s, b.seed).toContain(`$${side} = \\sqrt{${n}} = ${answer(b).toFixed(2)}$`)
        expect(b.question.markScheme[1]!.description).toBe(`√${n} or ${answer(b).toFixed(2)}`)
      } else {
        // The printed four-place square, rooted, still gives the answer.
        const printed = Number(/= (\d+\.\d{4})\$ to four decimal places/.exec(s)![1])
        expect(printed, b.seed).toBeCloseTo(sq, 4)
        expect(r2(Math.sqrt(printed)), b.seed).toBe(answer(b))
        expect(s, b.seed).toContain(`- ${2 * p * q} \\cos ${A}° = `)
      }
      expect(b.question.markScheme[0]!.description).toBe(`${side}² = ${p}² + ${q}² − 2 × ${p} × ${q} × cos ${A}°`)
    }
  })
  it('spreads sides and angles, with the exact 60° and 120° now and then', () => {
    common(built, { tolerance: 0.005, minDistinct: 100 })
    const many = rarelyWritten(RULES, 'q6')
    const special = share(many, (b) => [60, 120].includes(figures(b.question.prompt)[2]!))
    expect(special).toBeGreaterThan(0.09)
    expect(special).toBeLessThan(0.21)
    expect(share(many, (b) => figures(b.question.prompt)[2]! > 90)).toBeGreaterThan(0.3)
    expect(share(many, (b) => b.question.prompt.startsWith('In triangle'))).toBeGreaterThan(0.3)
  })
  it('works 5, 13 and 120° with the term added', () => {
    const b = find(RULES, 'q6', (b) => b.question.prompt === 'Two sides of a triangle are $5$ cm and $13$ cm, and the angle between them is $120°$. Work out the third side. Give your answer to two decimal places.')
    expect(b.question.solution).toBe('Cosine rule: $a^2 = 5^2 + 13^2 - 2 \\times 5 \\times 13 \\times \\cos 120° = 25 + 169 + 65 = 259$ (as $\\cos 120° = -\\frac{1}{2}$, the last term is added), so $a = \\sqrt{259} = 16.09$ cm.')
  })
})

describe('fm-sine-and-cosine-rules q7: the largest angle from three sides', () => {
  const built = build(RULES, 'q7')
  it('is the angle opposite the longest printed side, never another angle or its supplement', () => {
    for (const b of built) {
      const [x, y, z] = [...figures(b.question.prompt)].sort((p, q) => p - q) as [number, number, number]
      const angle = (o: number, s: number, t: number) => Math.acos((s * s + t * t - o * o) / (2 * s * t)) / RAD
      const largest = angle(z, x, y)
      twoPlaces(b, largest)
      expect(new Set([x, y, z]).size).toBe(3)
      expect(x + y).toBeGreaterThan(z)
      expect(z * z).not.toBe(x * x + y * y)
      // Never cos = −¼, the written 104.48° in another triangle.
      expect(4 * (x * x + y * y - z * z)).not.toBe(-2 * x * y)
      expect(answer(b)).not.toBe(104.48)
      // The smallest or middle angle, or the supplement.
      expect(differs(angle(x, y, z), b)).toBe(true)
      expect(differs(angle(y, x, z), b)).toBe(true)
      expect(differs(180 - largest, b)).toBe(true)
      const s = b.question.solution
      expect(s.startsWith(`The largest angle is opposite the longest side, $${z}$`), b.seed).toBe(true)
      expect(s, b.seed).toContain(`\\dfrac{${x}^2 + ${y}^2 - ${z}^2}{2 \\times ${x} \\times ${y}} = \\dfrac{${x * x} + ${y * y} - ${z * z}}{${2 * x * y}} = `)
      expect(s.endsWith(z * z > x * x + y * y ? 'The negative cosine says the angle is obtuse.' : 'The cosine is positive, so even the largest angle is acute.'), b.seed).toBe(true)
      expect(b.question.markScheme[0]!.description).toBe(`cosine rule arranged for the angle opposite ${z}`)
      // In PQR the angle is named by the vertex opposite the longest side.
      const v = named(b.question.prompt)
      if ('PQ' in v) {
        const opposite = { PQ: 'R', QR: 'P', PR: 'Q' } as Record<string, string>
        const longest = Object.keys(v).find((k) => v[k] === z)!
        expect(s, b.seed).toContain(`so the largest angle is $${opposite[longest]}$`)
      }
    }
  })
  it('spreads triangles, obtuse seven times in ten', () => {
    common(built, { tolerance: 0.005, minDistinct: 100 })
    const many = rarelyWritten(RULES, 'q7')
    const obtuse = share(many, (b) => b.values.obtuse === 'yes')
    expect(obtuse).toBeGreaterThan(0.62)
    expect(obtuse).toBeLessThan(0.78)
    expect(share(many, (b) => b.question.prompt.startsWith('Triangle $PQR$'))).toBeGreaterThan(0.25)
  })
  it('never builds the written 4, 6, 8, and works 8, 10, 15', () => {
    expect(share(build(RULES, 'q7', 1000, 'never'), (b) => b.question.prompt === written('q7').prompt)).toBe(0)
    const b = find(RULES, 'q7', (b) => b.question.prompt === 'A triangle has sides of $8$ cm, $10$ cm and $15$ cm. Work out the size of its largest angle. Give your answer to two decimal places.')
    expect(b.question.solution).toBe(
      'The largest angle is opposite the longest side, $15$. Cosine rule: $\\cos \\theta = \\dfrac{8^2 + 10^2 - 15^2}{2 \\times 8 \\times 10} = \\dfrac{64 + 100 - 225}{160} = -\\frac{61}{160}$, so $\\theta = \\cos^{-1}\\left(-\\frac{61}{160}\\right) = 112.41°$. The negative cosine says the angle is obtuse.',
    )
  })
})

describe('fm-sine-and-cosine-rules q9: the cosine rule with an exact cosine', () => {
  const built = build(RULES, 'q9')
  it('is a whole third side from the printed sides and cosine, by hand, and no slip gives it', () => {
    for (const b of built) {
      const [s1, s2] = figures(b.question.prompt) as [number, number]
      const { V, p, q, cos } = cosineIn(b.question.prompt)
      const t = (2 * s1 * s2 * p) / q
      expect(Number.isInteger(t), b.seed).toBe(true)
      expect(Math.abs(t)).toBeLessThanOrEqual(200)
      const a = answer(b)
      expect(a * a, b.seed).toBe(s1 * s1 + s2 * s2 - t)
      expect(a).toBeLessThanOrEqual(20)
      // Asked for the side opposite the printed angle.
      expect(b.question.prompt.endsWith(`Work out the length of $${V.toLowerCase()}$.`)).toBe(true)
      // No printed figure or the 2bc cos term is the answer; the sign flipped or the 2 dropped gives another.
      expect([s1, s2, Math.abs(p), q, Math.abs(t)]).not.toContain(a)
      expect(Math.sqrt(s1 * s1 + s2 * s2 + t)).not.toBe(a)
      expect(Math.sqrt(s1 * s1 + s2 * s2 - s1 * s2 * cos)).not.toBe(a)
      const factor = p < 0 ? `\\left(-\\frac{${-p}}{${q}}\\right)` : `\\frac{${p}}{${q}}`
      expect(b.question.solution.startsWith(`Cosine rule: $${V.toLowerCase()}^2 = ${s1}^2 + ${s2}^2 - 2 \\times ${s1} \\times ${s2} \\times ${factor} = ${s1 * s1} + ${s2 * s2} ${t < 0 ? '+' : '-'} ${Math.abs(t)} = ${a * a}$, so $${V.toLowerCase()} = ${a}$`), b.seed).toBe(true)
      expect(b.question.markScheme[0]!.description).toBe(`substitution with 2 × ${s1} × ${s2} × ${p < 0 ? `(−${-p}/${q})` : `${p}/${q}`} = ${String(t).replace('-', '−')}`)
    }
  })
  it('spreads triangles and cosines, both signs, and no calculation takes over', () => {
    common(built, { tolerance: 0 })
    const many = rarelyWritten(RULES, 'q9')
    expect(EXACT_COSINES.length).toBeGreaterThan(60)
    const calc = tally(many, (b) => { const [s1, s2] = figures(b.question.prompt); return `${Math.min(s1!, s2!)},${Math.max(s1!, s2!)},${cosineIn(b.question.prompt).cos}` })
    expect(calc.size).toBeGreaterThan(60)
    expect(top(calc, many.length)).toBeLessThanOrEqual(1 / 6)
    const negative = share(many, (b) => cosineIn(b.question.prompt).p < 0)
    expect(negative).toBeGreaterThan(0.3)
    expect(negative).toBeLessThan(0.7)
    expect(tally(many, (b) => cosineIn(b.question.prompt).V).size).toBe(3)
  })
  it('works b = 3, c = 7, cos A = −1/7', () => {
    const b = find(RULES, 'q9', (b) => b.question.prompt === 'In triangle $ABC$, $b = 3$ cm, $c = 7$ cm and $\\cos A = -\\dfrac{1}{7}$. Work out the length of $a$.')
    expect(b.question.solution).toBe('Cosine rule: $a^2 = 3^2 + 7^2 - 2 \\times 3 \\times 7 \\times \\left(-\\frac{1}{7}\\right) = 9 + 49 + 6 = 64$, so $a = 8$ cm. The cosine is negative, so angle $A$ is obtuse and the last term is added.')
  })
})

describe('fm-sine-and-cosine-rules q14: the area from an exact cosine', () => {
  const built = build(RULES, 'q14')
  it('is half the printed sides times the sine from the triple, whole, and no slip gives it', () => {
    for (const b of built) {
      const [s1, s2] = figures(b.question.prompt) as [number, number]
      const { V, p, q, cos } = cosineIn(b.question.prompt)
      const sin = Math.sqrt(1 - cos * cos)
      const s = Math.round(sin * q)
      expect(s * s + p * p).toBe(q * q)
      const area = answer(b)
      expect(0.5 * s1 * s2 * sin, b.seed).toBeCloseTo(area, 9)
      expect(area).toBeLessThanOrEqual(120)
      expect(s1 * s2).toBeLessThanOrEqual(200)
      // cos for sin, the ½ dropped, sin as 1 − cos, sin² for sin; no printed figure.
      expect(Math.abs(0.5 * s1 * s2 * cos)).not.toBeCloseTo(area, 6)
      expect(s1 * s2 * sin).not.toBeCloseTo(area, 6)
      expect(0.5 * s1 * s2 * (1 - Math.abs(cos))).not.toBeCloseTo(area, 6)
      expect(0.5 * s1 * s2 * sin * sin).not.toBeCloseTo(area, 6)
      expect([s1, s2, Math.abs(p), q, s]).not.toContain(area)
      const sol = b.question.solution
      expect(sol, b.seed).toContain(`gives $\\sin ${V} = \\frac{${s}}{${q}}$`)
      expect(sol, b.seed).toContain(`$\\sin^2 ${V} = 1 - \\frac{${p * p}}{${q * q}} = \\frac{${s * s}}{${q * q}}$`)
      expect(sol, b.seed).toContain(`Area $= \\frac{1}{2} \\times ${s1} \\times ${s2} \\times \\frac{${s}}{${q}} = ${area}$`)
      expect(sol.includes('is obtuse, but its sine is still positive'), b.seed).toBe(p < 0)
      expect(b.question.markScheme[0]!.description).toBe(`sin ${V} = ${s}/${q}`)
    }
  })
  it('spreads triangles and cosines, both signs, and no calculation takes over', () => {
    common(built, { tolerance: 0 })
    const many = rarelyWritten(RULES, 'q14')
    expect(EXACT_AREAS.length).toBeGreaterThan(200)
    const calc = tally(many, (b) => { const [s1, s2] = figures(b.question.prompt); return `${Math.min(s1!, s2!)},${Math.max(s1!, s2!)},${cosineIn(b.question.prompt).cos}` })
    expect(top(calc, many.length)).toBeLessThanOrEqual(1 / 6)
    const families = tally(many, (b) => cosineIn(b.question.prompt).q)
    expect(families.size).toBe(4)
    expect(top(families, many.length)).toBeLessThan(0.6)
    const negative = share(many, (b) => cosineIn(b.question.prompt).p < 0)
    expect(negative).toBeGreaterThan(0.4)
    expect(negative).toBeLessThan(0.6)
  })
  it('works a = 5, b = 15, cos C = 7/25', () => {
    const b = find(RULES, 'q14', (b) => b.question.prompt === 'In triangle $ABC$, $a = 5$ cm, $b = 15$ cm and $\\cos C = \\dfrac{7}{25}$. Work out the area of the triangle.')
    expect(b.question.solution).toBe(
      'The area formula needs $\\sin C$. Since $\\cos C = \\frac{7}{25}$, the $7, 24, 25$ triangle gives $\\sin C = \\frac{24}{25}$ (or $\\sin^2 C = 1 - \\frac{49}{625} = \\frac{576}{625}$). Area $= \\frac{1}{2} \\times 5 \\times 15 \\times \\frac{24}{25} = 36$ cm².',
    )
  })
})

// ---------------------------------------------------------------------------------------

/** The cuboid's corners from the printed edges: AB along x, AD (= BC) along y, the height up. */
function corners(text: string) {
  const v = named(text)
  const a = v.AB!
  const b = v.AD ?? v.BC!
  const h = v.AE ?? v.BF ?? v.CG ?? v.DH!
  const P: Record<string, [number, number, number]> = { A: [0, 0, 0], B: [a, 0, 0], C: [a, b, 0], D: [0, b, 0], E: [0, 0, h], F: [a, 0, h], G: [a, b, h], H: [0, b, h] }
  return { a, b, h, P }
}

describe('fm-trigonometry-in-3d q8: a space diagonal and the base', () => {
  const built = build(SOLIDS, 'q8')
  it('is the angle between the named diagonal and its shadow, never the triangle ABG or an edge', () => {
    for (const b of built) {
      const { a, b: w, h, P } = corners(b.question.prompt)
      const [, from, to] = /between \$([A-H])([A-H])\$ and the base/.exec(b.question.prompt)!
      const [x0, y0] = P[from!]!
      const [x1, y1, z1] = P[to!]!
      const run = Math.hypot(x1 - x0, y1 - y0)
      const theta = Math.atan(z1 / run) / RAD
      twoPlaces(b, theta)
      expect(new Set([a, w, h]).size).toBe(3)
      // The triangle through a base edge (q15's mistake), an edge for the shadow, the angle with the vertical.
      expect(differs(Math.atan(Math.hypot(w, h) / a) / RAD, b)).toBe(true)
      expect(differs(Math.atan(Math.hypot(a, h) / w) / RAD, b)).toBe(true)
      expect(differs(Math.atan(h / a) / RAD, b)).toBe(true)
      expect(differs(Math.atan(h / w) / RAD, b)).toBe(true)
      expect(differs(90 - theta, b)).toBe(true)
      const n = a * a + w * w
      const root = Number.isInteger(Math.sqrt(n)) ? String(Math.sqrt(n)) : `\\sqrt{${n}}`
      const s = b.question.solution
      if (Number.isInteger(Math.sqrt(n))) expect(s, b.seed).not.toContain('Keep')
      else {
        const shadow = /on the base is \$([A-D]{2}) = /.exec(s)![1]!
        keptExact(b, `$${shadow} = \\sqrt{${n}}$`, `it to $${twoDp(Math.sqrt(n))}$`, Math.atan(h / (Math.round(Math.sqrt(n) * 100) / 100)) / RAD)
      }
      expect(s, b.seed).toContain(`on the base is $${from}${/right-angled at \$([A-D])\$/.exec(s)![1]} = \\sqrt{${a}^2 + ${w}^2} = ${root}$`)
      expect(s, b.seed).toContain(`= \\dfrac{${h}}{${root}}$, so $\\theta = ${answer(b).toFixed(2)}°$`)
      // The right angle is at the foot of the top vertex.
      const foot = /right-angled at \$([A-D])\$/.exec(s)![1]!
      expect(P[foot]!.slice(0, 2)).toEqual(P[to!]!.slice(0, 2))
      expect(b.question.markScheme.map((l) => l.description)).toEqual([`${from}${foot} = ${root.replace(/\\sqrt\{(\d+)\}/, '√$1')}`, `tan θ = ${h}/${root.replace(/\\sqrt\{(\d+)\}/, '√$1')}`, answer(b).toFixed(2)])
    }
  })
  it('spreads cuboids, diagonals and labels; a whole base diagonal half the time', () => {
    common(built, { tolerance: 0.005, minDistinct: 100 })
    const many = rarelyWritten(SOLIDS, 'q8')
    const whole = share(many, (b) => { const { a, b: w } = corners(b.question.prompt); return Number.isInteger(Math.hypot(a, w)) })
    expect(whole).toBeGreaterThan(0.4)
    expect(whole).toBeLessThan(0.6)
    expect(tally(many, (b) => /between \$([A-H]{2})\$/.exec(b.question.prompt)![1]).size).toBe(4)
    expect(tally(many, (b) => Object.keys(named(b.question.prompt)).join()).size).toBe(8)
    expect(share(many, (b) => { const { a, b: w, h } = corners(b.question.prompt); return h === 12 && a * w === 12 && a + w === 7 })).toBe(0)
  })
  it('works 8, 6, 24 for AG, its shadow AC whole', () => {
    const b = find(SOLIDS, 'q8', (b) => /\$AB = 8\$ c?m, \$AD = 6\$ c?m and \$[A-H]{2} = 24\$ .* Work out the angle between \$AG\$/.test(b.question.prompt))
    expect(b.question.solution).toBe('The shadow of $AG$ on the base is $AC = \\sqrt{8^2 + 6^2} = 10$. In triangle $ACG$, right-angled at $C$: $\\tan \\theta = \\dfrac{CG}{AC} = \\dfrac{24}{10}$, so $\\theta = 67.38°$.')
  })
})

describe('fm-trigonometry-in-3d q11: a sloping face and the base', () => {
  const built = build(SOLIDS, 'q11')
  it('is tan⁻¹ of the height over half the base edge, never the edge angle or the angle with the vertical', () => {
    for (const b of built) {
      const [s, h] = figures(b.question.prompt) as [number, number]
      const theta = Math.atan(h / (s / 2)) / RAD
      twoPlaces(b, theta)
      expect(h).toBeLessThanOrEqual(2 * s)
      expect(2 * h).not.toBe(s)
      expect(h).not.toBe(s)
      expect(3 * h).not.toBe(2 * s)
      // Half the diagonal for half the edge, the whole edge, the complement.
      expect(differs(Math.atan(h / (s / Math.SQRT2)) / RAD, b)).toBe(true)
      expect(differs(Math.atan(h / s) / RAD, b)).toBe(true)
      expect(differs(90 - theta, b)).toBe(true)
      const half = String(s / 2)
      expect(b.question.solution, b.seed).toContain(`is $${half}$ ${b.question.prompt.includes(' m and') || b.question.prompt.includes(' m, and') ? 'm' : 'cm'}.`)
      expect(b.question.solution, b.seed).toContain(`so $\\tan \\theta = \\frac{${h}}{${half}}$ and $\\theta = ${answer(b).toFixed(2)}°$`)
      expect(b.question.markScheme[0]!.description).toBe(`the triangle with ${half} and ${h}, from the midpoint of an edge`)
    }
  })
  it('spreads pyramids and settings, odd edges now and then', () => {
    common(built, { tolerance: 0.005, minDistinct: 60 })
    const many = rarelyWritten(SOLIDS, 'q11')
    expect(share(many, (b) => figures(b.question.prompt)[0]! % 2 === 1)).toBeGreaterThan(0.08)
    for (const start of ['A square-based', 'The pyramid', 'The roof']) expect(share(many, (b) => b.question.prompt.startsWith(start))).toBeGreaterThan(0.15)
    expect(top(tally(many, (b) => figures(b.question.prompt).join()), many.length)).toBeLessThanOrEqual(1 / 6)
  })
})

describe('fm-trigonometry-in-3d q12: a sloping edge and the base', () => {
  const built = build(SOLIDS, 'q12')
  it('is tan⁻¹ of the height over half the base diagonal, never the face angle or the whole diagonal', () => {
    for (const b of built) {
      const [s, h] = figures(b.question.prompt) as [number, number]
      expect(s % 2).toBe(0)
      const theta = Math.atan(h / (s / Math.SQRT2)) / RAD
      twoPlaces(b, theta)
      expect(h).toBeLessThanOrEqual(2 * s)
      expect(3 * h).not.toBe(2 * s)
      expect(differs(Math.atan(h / (s / 2)) / RAD, b)).toBe(true)
      expect(differs(Math.atan(h / (s * Math.SQRT2)) / RAD, b)).toBe(true)
      expect(differs(90 - theta, b)).toBe(true)
      const k = s / 2
      expect(b.question.solution, b.seed).toContain(`$\\frac{1}{2}\\sqrt{${s}^2 + ${s}^2} = ${k}\\sqrt{2}$`)
      expect(b.question.solution, b.seed).toContain(`$\\tan \\theta = \\dfrac{${h}}{${k}\\sqrt{2}}$ and $\\theta = ${answer(b).toFixed(2)}°$`)
      expect(b.question.markScheme.map((l) => l.description)).toEqual([`half the diagonal, ${k}√2`, `tan θ = ${h}/(${k}√2)`, answer(b).toFixed(2)])
      // The edge is always shallower than the face of the same pyramid.
      expect(theta).toBeLessThan(Math.atan(h / (s / 2)) / RAD)
      // The height equal to the edge always gave 54.74°.
      expect(h).not.toBe(s)
      keptExact(b, `$${k}\\sqrt{2}$`, `it to $${twoDp(k * Math.SQRT2)}$`, Math.atan(h / (Math.round(k * Math.SQRT2 * 100) / 100)) / RAD)
    }
  })
  it('names the wrong answer from rounding k√2 early in a good share of builds', () => {
    const many = build(SOLIDS, 'q12', 1000, 'early')
    expect(share(many, (b) => b.question.solution.includes('which is wrong'))).toBeGreaterThan(0.3)
    // Pyramids of one shape share an answer (3 by 4, 6 by 8, ...): no shape over 8%.
    expect(top(tally(many, answer), many.length)).toBeLessThanOrEqual(0.08)
  })
  it('spreads pyramids and settings', () => {
    common(built, { tolerance: 0.005, minDistinct: 50 })
    const many = rarelyWritten(SOLIDS, 'q12')
    for (const start of ['A square-based', 'The pyramid', 'The roof']) expect(share(many, (b) => b.question.prompt.startsWith(start))).toBeGreaterThan(0.15)
    expect(top(tally(many, (b) => figures(b.question.prompt).join()), many.length)).toBeLessThanOrEqual(1 / 6)
  })
})

describe('fm-trigonometry-in-3d q16: triangle ACF in a cuboid, no right angle', () => {
  const built = build(SOLIDS, 'q16')
  it('is the angle at the named vertex by the cosine rule, never another vertex or a right-angle shortcut', () => {
    for (const b of built) {
      const { a, b: w, h, P } = corners(b.question.prompt)
      const name = /the angle \$([ACF]{3})\$/.exec(b.question.prompt)![1]!
      const [X, V, Y] = [...name] as [string, string, string]
      const d2 = (p: string, q: string) => P[p]!.reduce((s, c, i) => s + (c - P[q]![i]!) ** 2, 0)
      const atV = (v: string) => {
        const [x, y] = ['A', 'C', 'F'].filter((z) => z !== v) as [string, string]
        return Math.acos((d2(v, x) + d2(v, y) - d2(x, y)) / (2 * Math.sqrt(d2(v, x) * d2(v, y)))) / RAD
      }
      twoPlaces(b, atV(V))
      expect(new Set([a, w, h]).size).toBe(3)
      for (const other of ['A', 'C', 'F'].filter((z) => z !== V)) expect(differs(atV(other), b)).toBe(true)
      // Taking the triangle as right-angled at either other vertex.
      expect(differs(Math.atan(Math.sqrt(d2(X, Y) / d2(V, X))) / RAD, b)).toBe(true)
      expect(differs(Math.atan(Math.sqrt(d2(X, Y) / d2(V, Y))) / RAD, b)).toBe(true)
      const s = b.question.solution
      expect(s, b.seed).toContain(`$AC^2 = ${a}^2 + ${w}^2 = ${a * a + w * w}$, $AF^2 = ${a}^2 + ${h}^2 = ${a * a + h * h}$ and $CF^2 = ${w}^2 + ${h}^2 = ${w * w + h * h}$`)
      const opposite = `${X}${Y}`.split('').sort().join('')
      expect(s, b.seed).toContain(`Cosine rule for the angle at $${V}$, opposite $${opposite}$`)
      // The printed final fraction, read back here.
      const f = /= \\dfrac\{(\d+)\}\{(\d+)((?:\\sqrt\{\d+\}(?: \\times )?)*)\}\$, so \$([ACF]) = (\d+\.\d\d)°\$\. Keep/.exec(s)!
      // Two roots are joined by a times sign, never written side by side.
      expect(s, b.seed).not.toMatch(/\}\\sqrt/)
      const len = (p: string, q: string) => (Number.isInteger(Math.sqrt(d2(p, q))) ? Math.sqrt(d2(p, q)) : Math.round(Math.sqrt(d2(p, q)) * 100) / 100)
      const [lx, ly, lo] = [len(V, X), len(V, Y), len(X, Y)]
      keptExact(b, 'the square roots', 'the sides to two decimal places', Math.acos((lx * lx + ly * ly - lo * lo) / (2 * lx * ly)) / RAD)
      const radicals = [...f[3]!.matchAll(/\\sqrt\{(\d+)\}/g)].reduce((p, m) => p * Math.sqrt(Number(m[1])), 1)
      expect(Math.acos(Number(f[1]) / (Number(f[2]) * radicals)) / RAD, b.seed).toBeCloseTo(atV(V), 9)
      expect(f[4]).toBe(V)
      expect(Number(f[1])).toBe(2 * (V === 'A' ? a * a : V === 'C' ? w * w : h * h))
      expect(b.question.markScheme[1]!.description).toBe(`cosine rule for angle ${V}`)
    }
  })
  it('spreads cuboids, the angle at A about half the time', () => {
    common(built, { tolerance: 0.005, minDistinct: 100 })
    const many = rarelyWritten(SOLIDS, 'q16')
    const atA = share(many, (b) => b.question.prompt.includes('angle $CAF$'))
    expect(atA).toBeGreaterThan(0.42)
    expect(atA).toBeLessThan(0.58)
    for (const n of ['ACF', 'AFC']) expect(share(many, (b) => b.question.prompt.includes(`angle $${n}$`))).toBeGreaterThan(0.18)
    expect(share(many, (b) => { const { a, b: w, h } = corners(b.question.prompt); return h === 12 && a * w === 12 && a + w === 7 })).toBe(0)
  })
  it('works 8, 4, 15 for angle CAF, a whole root gathered in front', () => {
    const b = find(SOLIDS, 'q16', (b) => /\$AB = 8\$ c?m, \$BC = 4\$ c?m and \$BF = 15\$ c?m, .*angle \$CAF\$/.test(b.question.prompt))
    expect(b.question.solution).toBe(
      'Triangle $ACF$ has no right angle, so find its sides: $AC^2 = 8^2 + 4^2 = 80$, $AF^2 = 8^2 + 15^2 = 289$ and $CF^2 = 4^2 + 15^2 = 241$. Cosine rule for the angle at $A$, opposite $CF$: $\\cos A = \\dfrac{80 + 289 - 241}{2 \\times \\sqrt{80} \\times 17} = \\dfrac{128}{34\\sqrt{80}}$, so $A = 65.11°$. Keep the square roots exact until the last step: rounding the sides to two decimal places first gives $65.08°$, which is wrong.',
    )
  })
  it('works 5, 7, 9 for angle CAF, two roots joined by a times sign', () => {
    const b = find(SOLIDS, 'q16', (b) => /\$AB = 5\$ c?m, \$BC = 7\$ c?m and \$BF = 9\$ c?m, .*angle \$CAF\$/.test(b.question.prompt))
    expect(b.question.solution).toBe(
      'Triangle $ACF$ has no right angle, so find its sides: $AC^2 = 5^2 + 7^2 = 74$, $AF^2 = 5^2 + 9^2 = 106$ and $CF^2 = 7^2 + 9^2 = 130$. Cosine rule for the angle at $A$, opposite $CF$: $\\cos A = \\dfrac{74 + 106 - 130}{2 \\times \\sqrt{74} \\times \\sqrt{106}} = \\dfrac{50}{2\\sqrt{74} \\times \\sqrt{106}}$, so $A = 73.60°$. Keep the square roots exact until the last step: rounding the sides to two decimal places first gives $73.58°$, which is wrong.',
    )
  })
})

describe('answers spread within each case, not only over the slot', () => {
  /** Within each case: no answer over 40%, and at least `min` distinct answers. */
  function perCase(generatorId: string, slotId: string, key: (b: Generated) => unknown, min: number) {
    const many = build(generatorId, slotId, 1000, 'cases')
    const cases = new Map<unknown, Generated[]>()
    for (const b of many) cases.set(key(b), [...(cases.get(key(b)) ?? []), b])
    expect(cases.size).toBeGreaterThan(1)
    for (const [k, group] of cases) {
      const counts = tally(group, answer)
      expect(top(counts, group.length), `${slotId} ${String(k)}`).toBeLessThanOrEqual(0.4)
      expect(counts.size, `${slotId} ${String(k)}`).toBeGreaterThanOrEqual(min)
    }
  }
  it('q1 by triple family', () => perCase(TRIPLES_GEN, 'q1', (b) => b.values.triple === '3-4-5', 2))
  it('q4 exact angle or not', () => perCase(RULES, 'q4', (b) => b.values.special, 50))
  it('q6 by setting', () => perCase(RULES, 'q6', (b) => b.question.prompt.startsWith('In triangle'), 50))
  it('q7 obtuse or acute', () => perCase(RULES, 'q7', (b) => b.values.obtuse, 30))
  it('q9 by the sign of the cosine', () => perCase(RULES, 'q9', (b) => cosineIn(b.question.prompt).p < 0, 8))
  it('q14 by the sign of the cosine', () => perCase(RULES, 'q14', (b) => cosineIn(b.question.prompt).p < 0, 15))
  it('q8 whole or surd base diagonal', () => perCase(SOLIDS, 'q8', (b) => b.values.whole, 50))
  it('q11 by setting', () => perCase(SOLIDS, 'q11', (b) => b.values.form, 15))
  it('q12 by setting', () => perCase(SOLIDS, 'q12', (b) => b.values.form, 15))
  it('q16 by vertex', () => perCase(SOLIDS, 'q16', (b) => b.values.ask, 50))
})

describe('every slot draws on 3000 seeds', () => {
  const slots: [string, string][] = [
    [TRIPLES_GEN, 'q1'], [TRIPLES_GEN, 'q3'],
    [RULES, 'q4'], [RULES, 'q5'], [RULES, 'q6'], [RULES, 'q7'], [RULES, 'q9'], [RULES, 'q14'],
    [SOLIDS, 'q8'], [SOLIDS, 'q11'], [SOLIDS, 'q12'], [SOLIDS, 'q16'],
  ]
  it.each(slots)('%s %s', (g, id) => {
    expect(() => build(g, id, 3000, 'seeds')).not.toThrow()
  })
  it('routes each slot to its own builder and covers the twelve', () => {
    const ids = GENERATORS.filter((g) => g.topicId === TOPIC).flatMap((g) => g.replaces).sort()
    expect(ids).toEqual(['q1', 'q11', 'q12', 'q14', 'q16', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9'])
    for (const [g, id] of slots) expect(build(g, id, 1)[0]!.question.id).toBe(id)
  })
})
