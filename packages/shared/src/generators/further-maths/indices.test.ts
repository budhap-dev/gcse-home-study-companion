import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { EQUATING, SHARED, UNDO } from './indices.ts'

/**
 * Structural tests for the Further Maths index generators. Each reads the base, the index and
 * the right side back from the prompt with its own patterns, finds roots by counting up and
 * solves by trial, never with the generators' helpers, and checks each printed step, the named
 * wrong routes (the index inverted the wrong way, b ÷ a for a shared base, the reciprocal
 * forgotten), the spread and the wording.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/further-maths')
const bankOf = (topic: string) => Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${topic}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300, prefix = 'indices'): Generated[] {
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
const share = (built: Generated[], pred: (b: Generated) => boolean) => built.filter(pred).length / built.length
/** The whole nth root of x by counting up, or NaN. */
function rootOf(x: number, n: number): number {
  for (let k = 1; k ** n <= x; k++) if (k ** n === x) return k
  return NaN
}
const decimals = (x: number) => (String(x).split('.')[1] ?? '').length

function common(built: Generated[], distinct = 10, prompts = built) {
  for (const b of built) {
    const q = b.question
    expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
    expect(`${q.prompt} ${q.solution}`, b.seed).not.toMatch(/\+ -|- -|\+-|\^\{1\}|\b0[a-z]|e[-+]\d/)
    expect(tolerance(b)).toBe(0)
    expect(mark(q, String(answer(b))).correct, b.seed).toBe(true)
    expect(mark(q, String(answer(b) + 0.001)).correct, b.seed).toBe(false)
    expect(q.solution, b.seed).toContain(String(answer(b)))
    if (!Number.isInteger(answer(b))) {
      expect(q.prompt, b.seed).toMatch(/as a decimal/)
      expect(decimals(answer(b))).toBeLessThanOrEqual(3)
    }
  }
  const counts = new Map<number, number>()
  for (const b of built) counts.set(answer(b), (counts.get(answer(b)) ?? 0) + 1)
  expect(Math.max(...counts.values()) / built.length).toBeLessThanOrEqual(0.4)
  expect(counts.size).toBeGreaterThanOrEqual(distinct)
  expect(new Set(prompts.map((b) => b.question.prompt)).size).toBeGreaterThan(100)
}

describe('fm-fractional-index (q3)', () => {
  const built = build('fm-fractional-index', 'q3')
  const read = (prompt: string) => {
    const m = /^(?:Work out|Evaluate|Find the value of) \$(\d+)\^\{\\frac\{(\d)\}\{(\d)\}\}\$\.$/.exec(prompt)!
    return { base: Number(m[1]), m: Number(m[2]), n: Number(m[3]) }
  }

  it('root first, then the power: the answer by counting up to the root', () => {
    for (const b of built) {
      const { base, m, n } = read(b.question.prompt)
      const r = rootOf(base, n)
      expect(Number.isInteger(r), b.seed).toBe(true)
      expect(m).toBeGreaterThanOrEqual(2)
      expect(answer(b)).toBe(r ** m)
      expect(answer(b)).toBeLessThanOrEqual(1000)
      expect(b.question.solution).toBe(`Root first: $${n === 2 ? `\\sqrt{${base}}` : `\\sqrt[${n}]{${base}}`} = ${r}$. Then the power: $${r}^${m} = ${r ** m}$.`)
    }
  })

  it('no named slip gives the answer: the base times the fraction, the root alone, the index upside down', () => {
    for (const b of built) {
      const { base, m, n } = read(b.question.prompt)
      expect(answer(b)).not.toBe((base * m) / n)
      expect(answer(b)).not.toBe(rootOf(base, n))
      // The root times m, as if the power were a multiplier: 8^(2/3) would give 2 × 2 = 4.
      expect(answer(b), b.seed).not.toBe(rootOf(base, n) * m)
      expect(Math.abs(answer(b) - base ** (n / m))).toBeGreaterThan(1e-6)
    }
  })

  it('spreads its answers and bases', () => {
    common(built)
    expect(new Set(built.map((b) => b.values.base)).size).toBeGreaterThanOrEqual(15)
  })

  it('writes the written question exactly when it draws 27^(2/3)', () => {
    const b = find('fm-fractional-index', 'q3', (b) => b.question.prompt === 'Work out $27^{\\frac{2}{3}}$.')
    expect(b.question.solution).toBe('Root first: $\\sqrt[3]{27} = 3$. Then the power: $3^2 = 9$.')
  })
})

describe('fm-negative-fractional-index (q6)', () => {
  const built = build('fm-negative-fractional-index', 'q6')
  const read = (prompt: string) => {
    const m = /\$(\d+(?:\\,\d{3})*)\^\{-\\frac\{(\d)\}\{(\d)\}\}\$/.exec(prompt)!
    return { base: Number(m[1]!.replace(/\\,/g, '')), m: Number(m[2]), n: Number(m[3]), printed: m[1]! }
  }

  it('a reciprocal of root then power, a positive decimal of at most 3 places', () => {
    for (const b of built) {
      const { base, m, n } = read(b.question.prompt)
      const r = rootOf(base, n)
      expect(Number.isInteger(r), b.seed).toBe(true)
      // 1 ÷ r^m by long division, digit by digit, to 3 places, and nothing left over.
      let rest = 1
      let digits = ''
      for (let i = 0; i < 3; i++) {
        rest *= 10
        digits += Math.floor(rest / r ** m)
        rest %= r ** m
      }
      expect(rest, `${b.seed}: 1/${r ** m} goes past 3 places`).toBe(0)
      expect(answer(b)).toBe(Number(`0.${digits}`))
      expect(answer(b)).toBeGreaterThan(0)
      expect(b.question.prompt).toMatch(/as a decimal/)
      const { printed } = read(b.question.prompt)
      expect(b.question.solution).toContain(`The negative index is a reciprocal: $\\dfrac{1}{${printed}^{\\frac{${m}}{${n}}}}$.`)
      expect(b.question.solution).toContain(`of $${printed}$ is $${r}$`)
      // Five figures and more carry a thin space in maths, 10\,000, as the Maths pack prints them.
      expect(`${b.question.prompt} ${b.question.solution}`, b.seed).not.toMatch(/\d{5,}/)
      if (base >= 10000) expect(printed).toMatch(/\\,/)
      expect(b.question.solution).toContain(`so the value is $\\frac{1}{${r ** m}} = ${answer(b)}$, positive.`)
    }
  })

  it('no named slip gives the answer: the reciprocal forgotten, a negative answer', () => {
    for (const b of built) {
      const { base, m, n } = read(b.question.prompt)
      expect(answer(b)).not.toBe(rootOf(base, n) ** m)
      expect(answer(b)).toBeGreaterThan(0)
    }
  })

  it('has a power of 2 or 3 about two thirds of the time, and spreads its answers', () => {
    const powered = share(built, (b) => read(b.question.prompt).m >= 2)
    expect(powered).toBeGreaterThan(0.55)
    expect(powered).toBeLessThan(0.8)
    // 36 calculations, worded four ways: over 100 prompts in the release check's 1000 seeds.
    common(built, 10, build('fm-negative-fractional-index', 'q6', 1000, 'wording'))
  })

  it('writes the written solution exactly when it draws 8^(−2/3)', () => {
    const b = find('fm-negative-fractional-index', 'q6', (b) => b.question.prompt === 'Work out $8^{-\\frac{2}{3}}$. Give your answer as a decimal.')
    expect(b.question.solution).toBe('The negative index is a reciprocal: $\\dfrac{1}{8^{\\frac{2}{3}}}$. Cube root of $8$ is $2$, squared is $4$, so the value is $\\frac{1}{4} = 0.25$, positive.')
  })
})

describe('fm-equating-indices (q7)', () => {
  const built = build('fm-equating-indices', 'q7')
  const read = (prompt: string) => {
    const m = /^Solve \$(\d+)\^\{(\d)x ([+-]) (\d)\} = (?:(\d+)|\\frac\{1\}\{(\d+)\})\$\.$/.exec(prompt)!
    return { c: Number(m[1]), p: Number(m[2]), q: (m[3] === '-' ? -1 : 1) * Number(m[4]), rhs: m[5] ? Number(m[5]) : 1 / Number(m[6]) }
  }

  it('the answer is the only whole x from −20 to 20 that makes both sides equal', () => {
    for (const b of built) {
      const { c, p, q, rhs } = read(b.question.prompt)
      const hits = Array.from({ length: 41 }, (_, i) => i - 20).filter((x) => Math.abs(c ** (p * x + q) - rhs) < 1e-12 * Math.max(1, rhs))
      expect(hits, b.seed).toEqual([answer(b)])
      const k = p * answer(b) + q
      expect(b.question.solution).toContain(`so $${p}x ${q < 0 ? '-' : '+'} ${Math.abs(q)} = ${k}$, $${p}x = ${k - q}$ and $x = ${answer(b)}$.`)
    }
  })

  it('no named slip gives the answer: the right side itself for the index, the sign of q kept, p not divided out', () => {
    for (const b of built) {
      const { p, q, rhs } = read(b.question.prompt)
      const k = p * answer(b) + q
      expect(answer(b)).not.toBe((rhs - q) / p)
      expect(answer(b)).not.toBe((k + q) / p)
      expect(answer(b)).not.toBe(k - q)
      // x is none of the printed numbers.
      for (const g of [p, q, read(b.question.prompt).c, k, rhs < 1 ? 1 / rhs : rhs]) expect(Math.abs(g), b.seed).not.toBe(Math.abs(answer(b)))
    }
  })

  it('draws the answer first, spreads it over at least 10 values, and sometimes has a fraction on the right', () => {
    common(built, 10)
    expect(new Set(built.map(answer))).toEqual(new Set([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6]))
    expect(share(built, (b) => b.question.prompt.includes('\\frac'))).toBeGreaterThan(0.1)
    expect(share(built, (b) => answer(b) < 0)).toBeGreaterThan(0.25)
    for (const x of new Set(EQUATING.map((e) => e.x))) expect(EQUATING.some((e) => e.x === x)).toBe(true)
  })
})

describe('fm-undoing-fractional-index (q9)', () => {
  const built = build('fm-undoing-fractional-index', 'q9')
  const read = (prompt: string) => {
    const m = /^Solve \$([a-z])\^\{\\frac\{(\d)\}\{(\d)\}\} = (\d+)\$, where \$\1 > 0\$\.$/.exec(prompt)!
    return { v: m[1]!, m: Number(m[2]), n: Number(m[3]), N: Number(m[4]) }
  }

  it('raises to the inverted index: the answer found by trial, every step printed', () => {
    for (const b of built) {
      const { v, m, n, N } = read(b.question.prompt)
      const t = rootOf(N, m)
      expect(Number.isInteger(t), b.seed).toBe(true)
      // By trial: the whole x whose nth root to the power m is N.
      let x = 1
      while (!(rootOf(x, n) ** m === N)) x++
      expect(answer(b)).toBe(x)
      expect(b.question.solution).toContain(`Raise both sides to the power $\\frac{${n}}{${m}}$: $${v} = ${N}^{\\frac{${n}}{${m}}} = `)
      expect(b.question.solution).toContain(`= ${t}^${n} = ${x}$. Check: $${x}^{\\frac{${m}}{${n}}} = ${t}^${m} = ${N}$.`)
    }
  })

  it('no named slip gives the answer: the index not inverted, N itself', () => {
    for (const b of built) {
      const { m, n, N } = read(b.question.prompt)
      expect(Math.abs(answer(b) - N ** (m / n))).toBeGreaterThan(1e-6)
      expect(answer(b)).not.toBe(N)
      expect(answer(b)).not.toBe((N * n) / m)
    }
    expect(UNDO.every(({ m, n }) => m !== n)).toBe(true)
    // Roots a student can recall: t at most 10, both powers at most 1024.
    for (const b of built) {
      const { m, N } = read(b.question.prompt)
      expect(rootOf(N, m), b.seed).toBeLessThanOrEqual(10)
      expect(N).toBeLessThanOrEqual(1024)
      expect(answer(b)).toBeLessThanOrEqual(1024)
    }
  })

  it('has the index each way up and spreads its answers', () => {
    const up = share(built, (b) => read(b.question.prompt).m > read(b.question.prompt).n)
    expect(up).toBeGreaterThan(0.3)
    expect(up).toBeLessThan(0.7)
    common(built)
  })

  it('writes the written question when it draws x^(3/2) = 8', () => {
    const b = find('fm-undoing-fractional-index', 'q9', (b) => b.question.prompt === 'Solve $x^{\\frac{3}{2}} = 8$, where $x > 0$.')
    expect(b.question.solution).toBe('Raise both sides to the power $\\frac{2}{3}$: $x = 8^{\\frac{2}{3}} = \\left(\\sqrt[3]{8}\\right)^2 = 2^2 = 4$. Check: $4^{\\frac{3}{2}} = 2^3 = 8$.')
  })
})

describe('fm-shared-base (q13)', () => {
  const built = build('fm-shared-base', 'q13')
  const read = (prompt: string) => {
    const m = /^Solve \$(\d+)\^[a-z] = (?:(\d+)|\\frac\{1\}\{(\d+)\})\$\. Give your answer as a decimal\.$/.exec(prompt)!
    return { a: Number(m[1]), b: m[2] ? Number(m[2]) : 1 / Number(m[3]) }
  }

  it('the answer is the only x in steps of 1/1000 from −5 to 5 with a^x = b, and it is not whole', () => {
    for (const b of built) {
      const { a, b: rhs } = read(b.question.prompt)
      const hits: number[] = []
      for (let i = -5000; i <= 5000; i++) if (Math.abs(a ** (i / 1000) - rhs) < 1e-9 * Math.max(1, rhs)) hits.push(i / 1000)
      expect(hits, b.seed).toEqual([answer(b)])
      expect(Number.isInteger(answer(b))).toBe(false)
      expect(b.question.solution).toMatch(/^Both are powers of \$\d+\$: /)
      expect(b.question.solution).toContain(` = ${answer(b)}$. Check: $${a}^{${answer(b)}} = `)
    }
  })

  it('no named slip gives the answer: b ÷ a, a ÷ b, the index inverted', () => {
    for (const b of built) {
      const { a, b: rhs } = read(b.question.prompt)
      expect(Math.abs(answer(b) - rhs / a)).toBeGreaterThan(1e-9)
      expect(Math.abs(answer(b) - a / rhs)).toBeGreaterThan(1e-9)
      expect(Math.abs(answer(b) - 1 / answer(b))).toBeGreaterThan(1e-9)
    }
    expect(SHARED.some(({ c, u, w }) => c ** u === 4 && w === 1)).toBe(false)
  })

  it('sometimes has a fraction on the right, and spreads its answers and bases', () => {
    expect(share(built, (b) => b.question.prompt.includes('\\frac'))).toBeGreaterThan(0.1)
    expect(new Set(built.map((b) => read(b.question.prompt).a)).size).toBeGreaterThanOrEqual(10)
    common(built)
  })

  it('writes the written solution when it draws 4^x = 8', () => {
    const b = find('fm-shared-base', 'q13', (b) => b.question.prompt === 'Solve $4^x = 8$. Give your answer as a decimal.')
    expect(b.question.solution).toBe('Both are powers of $2$: $2^{2x} = 2^{3}$, so $2x = 3$ and $x = \\frac{3}{2} = 1.5$. Check: $4^{1.5} = \\left(\\sqrt{4}\\right)^{3} = 8$.')
  })
})

describe('every draw succeeds', () => {
  it('over 3000 seeds per slot', () => {
    for (const [id, slot] of [
      ['fm-fractional-index', 'q3'],
      ['fm-negative-fractional-index', 'q6'],
      ['fm-equating-indices', 'q7'],
      ['fm-undoing-fractional-index', 'q9'],
      ['fm-shared-base', 'q13'],
    ] as const) {
      const all = build(id, slot, 3000, 'many')
      expect(all.every((b) => b.check.agrees)).toBe(true)
    }
  })
})
