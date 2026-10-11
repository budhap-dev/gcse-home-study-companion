import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'

/**
 * Structural tests for the Further Maths surds generators (8365 1.3). Each reads the prompt's
 * numbers back with this file's own reader (TeX turned into JavaScript token by token, square
 * factors found by trial), never the generators' helpers, and checks every printed step, the
 * named wrong routes, the spread and the wording.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/further-maths')
const TOPIC = 'surds-and-exact-calculation'
const bank = Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300, prefix = 'surds'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = bank.find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `${prefix}-${i}`))
}

const numeric = (b: Generated) => {
  if (b.question.type !== 'numeric') throw new Error('not numeric')
  return b.question
}
const answer = (b: Generated) => numeric(b).answer
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
const isSquare = (n: number) => Number.isInteger(Math.sqrt(n))
const squareFree = (n: number) => { for (let k = 2; k * k <= n; k++) if (n % (k * k) === 0) return false; return true }

/** TeX of numbers, \sqrt{n}, p, q, brackets, + and − as a number: token by token, implicit products made explicit. */
function value(tex: string, vars: Record<string, number> = {}): number {
  const s = tex.replace(/\s+/g, '').replace(/\\sqrt\{(\d+)\}/g, '#$1#')
  const tokens = s.match(/#\d+#|\d+|[a-z]|[()+-]/g)!
  if (tokens.join('') !== s) throw new Error(`cannot read ${tex}`)
  const operand = (t: string) => /^(#\d+#|\d+|[a-z])$/.test(t)
  const out: string[] = []
  tokens.forEach((t, i) => {
    const prev = tokens[i - 1]
    if (prev && (operand(prev) || prev === ')') && (operand(t) || t === '(')) out.push('*')
    out.push(t.startsWith('#') ? `Math.sqrt(${t.slice(1, -1)})` : /^[a-z]$/.test(t) ? `(${vars[t]!})` : t)
  })
  return new Function(`return ${out.join('')}`)() as number
}

function spread(bs: Generated[], minDistinct: number) {
  const counts = new Map<number, number>()
  for (const b of bs) counts.set(answer(b), (counts.get(answer(b)) ?? 0) + 1)
  expect(counts.size).toBeGreaterThanOrEqual(minDistinct)
  expect(Math.max(...counts.values()) / bs.length).toBeLessThanOrEqual(0.4)
}

function common(bs: Generated[]) {
  for (const b of bs) {
    const text = [b.question.prompt, b.question.solution, ...b.question.markScheme.map((l) => l.description)].join(' ')
    expect(text, b.seed).not.toMatch(/\+ -|- -|\+ \+|(?<![\d.])1[a-z]|(?<![\d.])1\\sqrt|\^1(?!\d)|(?<![\d.])0[a-z]/)
    expect(b.question.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
    expect(numeric(b).tolerance).toBe(0)
    expect(mark(numeric(b), String(answer(b))).correct, b.seed).toBe(true)
  }
  const wide = build(bs[0]!.generatorId, bs[0]!.question.id, 1000, 'wide')
  const prompts = new Map<string, number>()
  for (const b of wide) prompts.set(b.question.prompt, (prompts.get(b.question.prompt) ?? 0) + 1)
  expect(prompts.size).toBeGreaterThan(150)
  // No one prompt, the written one least of all, takes more than 5% of builds.
  expect(Math.max(...prompts.values()) / wide.length).toBeLessThanOrEqual(0.05)
  const written = bank.find((q) => q.id === bs[0]!.question.id)!.prompt
  expect((prompts.get(written) ?? 0) / wide.length).toBeLessThanOrEqual(0.05)
}

describe('fm-surds-collecting (q2): √a ± √b in the form a√m', () => {
  const built = build('fm-surds-collecting', 'q2')
  const read = (b: Generated) => {
    const m = /^Write \$\\sqrt\{(\d+)\} ([+-]) \\sqrt\{(\d+)\}\$ in the form \$a\\sqrt\{(\d+)\}\$\. What is \$a\$\?$/.exec(b.question.prompt)
    if (!m) throw new Error(`unexpected prompt ${b.question.prompt}`)
    const [A, B, m0] = [Number(m[1]), Number(m[3]), Number(m[4])]
    return { A, B, m: m0, add: m[2] === '+', k1: Math.sqrt(A / m0), k2: Math.sqrt(B / m0) }
  }

  it('gives a with √a ± √b = a√m, both roots needing simplifying', () => {
    for (const b of built) {
      const { A, B, m, add, k1, k2 } = read(b)
      expect(squareFree(m), b.seed).toBe(true)
      expect(Number.isInteger(k1) && Number.isInteger(k2) && k1 >= 2 && k2 >= 2 && k1 !== k2, b.seed).toBe(true)
      expect(Math.max(A, B)).toBeLessThanOrEqual(200)
      expect(close(answer(b) * Math.sqrt(m), add ? Math.sqrt(A) + Math.sqrt(B) : Math.sqrt(A) - Math.sqrt(B)), b.seed).toBe(true)
      expect(answer(b)).toBeGreaterThanOrEqual(2)
    }
    common(built)
  })

  it('prints each root simplified, then the total', () => {
    for (const b of built) {
      const { A, B, m, k1, k2, add } = read(b)
      const s = b.question.solution
      expect(s, b.seed).toContain(`$\\sqrt{${A}} = \\sqrt{${k1 * k1}} \\times \\sqrt{${m}} = ${k1}\\sqrt{${m}}$`)
      expect(s, b.seed).toContain(`$\\sqrt{${B}} = \\sqrt{${k2 * k2}} \\times \\sqrt{${m}} = ${k2}\\sqrt{${m}}$`)
      expect(s, b.seed).toMatch(add ? new RegExp(`together they make \\$${answer(b)}\\\\sqrt\\{${m}\\}\\$, so \\$a = ${answer(b)}\\$\\.$`) : /the difference is/)
      expect(b.question.markScheme).toEqual([{ code: 'B1', marks: 1, description: `a = ${answer(b)}` }])
    }
  })

  it('writes the written question’s lines for √12 + √27', () => {
    const one = build('fm-surds-collecting', 'q2', 4000, 'find').find((b) => b.question.prompt.includes('\\sqrt{12} + \\sqrt{27}'))!
    expect(one.question.solution).toBe('$\\sqrt{12} = \\sqrt{4} \\times \\sqrt{3} = 2\\sqrt{3}$ and $\\sqrt{27} = \\sqrt{9} \\times \\sqrt{3} = 3\\sqrt{3}$; together they make $5\\sqrt{3}$, so $a = 5$.')
  })

  it('is not also given by adding under the root, or by multiplying the coefficients, and never equals m', () => {
    for (const b of built) {
      const { A, B, m, k1, k2, add } = read(b)
      // √(A ± B) is not a whole multiple of √m, so the slip gives no clean answer at all.
      expect(isSquare((add ? A + B : A - B) / m), b.seed).toBe(false)
      expect(k1 * k2).not.toBe(answer(b))
      expect(answer(b)).not.toBe(m)
    }
  })

  it('spreads its answers and its roots, with some differences', () => {
    spread(built, 10)
    expect(new Set(built.map((b) => read(b).m)).size).toBe(6)
    // m is drawn on its own: rerolled with k1 and k2 it was 2 in 47% of builds.
    const wide = build('fm-surds-collecting', 'q2', 1000, 'wide')
    for (const m of [2, 3, 5, 6, 7, 10]) expect(wide.filter((b) => read(b).m === m).length / wide.length, `m = ${m}`).toBeLessThanOrEqual(0.25)
    const minus = built.filter((b) => !read(b).add).length / built.length
    expect(minus).toBeGreaterThan(0.15)
    expect(minus).toBeLessThan(0.35)
  })
})

describe('fm-surds-exact-area (q7): a square with a surd side', () => {
  const built = build('fm-surds-exact-area', 'q7')
  const read = (b: Generated) => {
    const m = /^A square[a-z ]* has sides of length \$\((.+)\)\$ (cm|m)\. Its exact area is \$\(a ([+-]) (\d+)\\sqrt\{(\d+)\}\)\$ \2²\. What is \$a\$\?$/.exec(b.question.prompt)
    if (!m) throw new Error(`unexpected prompt ${b.question.prompt}`)
    const side = m[1]!
    const s = /^(?:(\d)?\\sqrt\{(\d+)\} ([+-]) (\d)|(\d) \+ (\d)?\\sqrt\{(\d+)\})$/.exec(side)
    if (!s) throw new Error(`unexpected side ${side}`)
    const [k, root, b0, plus] = s[2] ? [Number(s[1] ?? 1), Number(s[2]), Number(s[4]), s[3] === '+'] : [Number(s[6] ?? 1), Number(s[7]), Number(s[5]), true]
    return { side, k, m: root, b: b0, plus, sign: m[3], c: Number(m[4]), mArea: Number(m[5]) }
  }

  it('gives a = k²m + b², with the printed middle term 2kb√m and a positive side', () => {
    for (const b of built) {
      const { side, k, m, b: c0, plus, sign, c, mArea } = read(b)
      expect(mArea).toBe(m)
      expect(squareFree(m), b.seed).toBe(true)
      expect(c, b.seed).toBe(2 * k * c0)
      expect(sign).toBe(plus ? '+' : '-')
      expect(value(side), b.seed).toBeGreaterThan(0)
      expect(answer(b), b.seed).toBe(k * k * m + c0 * c0)
      // (side)² = a ± c√m as numbers.
      expect(close(value(side) ** 2, answer(b) + (plus ? 1 : -1) * c * Math.sqrt(m)), b.seed).toBe(true)
    }
    common(built)
  })

  it('prints the three terms of the square, then a', () => {
    for (const b of built) {
      const { side, k, m, b: c0, plus, c } = read(b)
      const op = plus ? '+' : '-'
      const first = side.startsWith(String(c0)) ? `${c0 * c0} + ${c}\\sqrt{${m}} + ${k * k * m}` : `${k * k * m} ${op} ${c}\\sqrt{${m}} + ${c0 * c0}`
      expect(b.question.solution, b.seed).toContain(`$(${side})^2 = ${first} = ${answer(b)} ${op} ${c}\\sqrt{${m}}$, so $a = ${answer(b)}$.`)
      if (k > 1) expect(b.question.solution).toContain(`$(${k}\\sqrt{${m}})^2 = ${k * k} \\times ${m} = ${k * k * m}$`)
      expect(b.question.markScheme).toEqual([{ code: 'B1', marks: 1, description: `a = ${answer(b)}` }])
    }
    const one = build('fm-surds-exact-area', 'q7', 4000, 'find').find((b) => read(b).side === '\\sqrt{3} + 5')!
    expect(one.question.solution).toBe('$(\\sqrt{3} + 5)^2 = 3 + 10\\sqrt{3} + 25 = 28 + 10\\sqrt{3}$, so $a = 28$. Squaring the side squares the whole bracket, middle term included.')
  })

  it('is not also given by leaving b unsquared, by 2b for b², by (k√m)² plus the surd coefficient, by k × m for (k√m)², or by m − b² on a minus side', () => {
    const multiple = built.filter((b) => read(b).k > 1)
    expect(multiple.length / built.length).toBeGreaterThan(0.25)
    for (const b of built) {
      const { k, m, b: c0, plus, c } = read(b)
      expect(c0).toBeGreaterThanOrEqual(3)
      expect(c0).not.toBe(2 * k)
      expect(k * k * m + 2 * c0, b.seed).not.toBe(answer(b))
      expect(k * k * m + c, b.seed).not.toBe(answer(b))
      expect(k * k * m + c0).not.toBe(answer(b))
      if (k > 1) expect(k * m + c0 * c0).not.toBe(answer(b))
      if (!plus) expect(k * k * m - c0 * c0).not.toBe(answer(b))
    }
  })

  it('names an object only where the side is in scale: a tile or frame of 5 cm or more, a garden or patio of 3 m or more', () => {
    const wide = build('fm-surds-exact-area', 'q7', 1000, 'wide')
    for (const b of wide) {
      const { side } = read(b)
      const noun = /^A square( [a-z ]+)? has/.exec(b.question.prompt)![1]?.trim()
      if (noun === 'tile' || noun === 'photo frame') expect(value(side), b.seed).toBeGreaterThanOrEqual(5)
      if (noun === 'garden' || noun === 'patio') expect(value(side), b.seed).toBeGreaterThanOrEqual(3)
    }
    // Named objects still turn up often, and small sides fall back to a plain square.
    expect(wide.filter((b) => !b.question.prompt.startsWith('A square has')).length / wide.length).toBeGreaterThan(0.5)
    expect(wide.some((b) => b.question.prompt.startsWith('A square has') && value(read(b).side) < 3)).toBe(true)
  })

  it('prints no two given numbers alike', () => {
    for (const b of built) {
      const { k, m, b: c0, c } = read(b)
      expect(c0).not.toBe(m)
      expect(c).not.toBe(m)
      if (k > 1) expect(c0).not.toBe(k)
    }
  })

  it('spreads its answers, signs and shapes', () => {
    spread(built, 15)
    const minus = built.filter((b) => !read(b).plus).length / built.length
    expect(minus).toBeGreaterThan(0.2)
    expect(minus).toBeLessThan(0.5)
    expect(new Set(built.map((b) => read(b).m)).size).toBeGreaterThanOrEqual(7)
  })
})

describe('fm-surds-comparing-parts (q12): (p + q√m)(c ± √m) = R + S√m', () => {
  const built = build('fm-surds-comparing-parts', 'q12')
  const read = (b: Generated) => {
    const m = /^Given that \$(\(p \+ q\\sqrt\{(\d)\}\)\((\d) ([+-]) \\sqrt\{\2\}\)) = ((-?\d+) ([+-]) (\d*)\\sqrt\{\2\})\$, where \$p\$ and \$q\$ are integers, find \$p\$\.$/.exec(b.question.prompt)
    if (!m) throw new Error(`unexpected prompt ${b.question.prompt}`)
    return { lhs: m[1]!, rhs: m[5]!, m: Number(m[2]), c: Number(m[3]), e: m[4] === '-' ? -1 : 1, R: Number(m[6]), S: (m[7] === '-' ? -1 : 1) * (m[8] === '' ? 1 : Number(m[8])) }
  }
  /** The integer pair that fits, by search. */
  const solve = (c: number, e: number, m: number, R: number, S: number) => {
    const found: [number, number][] = []
    for (let p = -30; p <= 30; p++) for (let q = -30; q <= 30; q++) if (c * p + e * m * q === R && e * p + c * q === S) found.push([p, q])
    return found
  }

  it('gives the one whole p that fits, found by search', () => {
    for (const b of built) {
      const { c, e, m, R, S } = read(b)
      const found = solve(c, e, m, R, S)
      expect(found, b.seed).toHaveLength(1)
      expect(answer(b), b.seed).toBe(found[0]![0])
    }
    common(built)
  })

  it('prints every equation of the solution true at the answer, and the expansion true for any p and q', () => {
    for (const b of built) {
      const { lhs, c, e, m, R, S } = read(b)
      const [[p, q]] = solve(c, e, m, R, S) as [[number, number]]
      const s = b.question.solution
      const spans = [...s.matchAll(/\$([^$]+)\$/g)].map((x) => x[1]!)
      // The expansion: both sides equal the printed brackets for other p and q too.
      const [expanded, grouped] = spans[0]!.split(' = ') as [string, string]
      for (const [P, Q] of [[2, 7], [-3, 5], [11, -4]] as const) {
        expect(close(value(expanded, { p: P, q: Q }), value(lhs, { p: P, q: Q })), b.seed).toBe(true)
        expect(close(value(grouped, { p: P, q: Q }), value(lhs, { p: P, q: Q })), b.seed).toBe(true)
      }
      for (const span of spans.slice(1)) {
        const sides = span.split(' = ')
        expect(sides.length, `${b.seed} ${span}`).toBe(2)
        expect(value(sides[0]!, { p, q }), `${b.seed} ${span}`).toBe(value(sides[1]!, { p, q }))
      }
      expect(s, b.seed).toContain(`Rational parts: $`)
      expect(s, b.seed).toMatch(new RegExp(`, \\$q = ${q}\\$ and \\$p = ${p}\\$\\.$`))
      expect(b.question.markScheme[1]).toEqual({ code: 'A1', marks: 1, description: `p = ${p}`.replace('-', '−') })
      expect(b.question.markScheme[0]!.code).toBe('M1')
    }
  })

  // The written p = 3 with (3 − √2) is not drawn (p equal to the printed 3); (4 − √2)(3 − √2) = 14 − 7√2 is worked by hand here.
  it('writes the written question’s lines, for (3 − √2) = 14 − 7√2', () => {
    const one = build('fm-surds-comparing-parts', 'q12', 3000, 'find').find((b) => b.question.prompt.includes('(3 - \\sqrt{2}) = 14 - 7\\sqrt{2}$'))!
    expect(one.question.solution).toBe('Expand: $3p - p\\sqrt{2} + 3q\\sqrt{2} - 2q = (3p - 2q) + (3q - p)\\sqrt{2}$. Rational parts: $3p - 2q = 14$. Surd parts: $3q - p = -7$, so $p = 3q + 7$. Then $9q + 21 - 2q = 14$, so $7q = -7$, $q = -1$ and $p = 4$.')
    expect(one.question.markScheme).toEqual([
      { code: 'M1', marks: 1, description: 'expands and separates the two parts: 3p − 2q = 14 and 3q − p = −7' },
      { code: 'A1', marks: 1, description: 'p = 4' },
    ])
  })

  it('is not also given by swapping the parts, by the sign slip on √m × √m, by R ÷ c, or by reading q', () => {
    for (const b of built) {
      const { c, e, m, R, S } = read(b)
      const p = answer(b)
      const [[, q]] = solve(c, e, m, R, S) as [[number, number]]
      expect((c * S - e * m * R) / (c * c - m), b.seed).not.toBe(p)
      expect((c * R + e * m * S) / (c * c + m), b.seed).not.toBe(p)
      expect(R / c).not.toBe(p)
      expect(Math.abs(q)).not.toBe(Math.abs(p))
    }
  })

  it('never gives an answer equal in size to a printed number, and prints c and m different', () => {
    for (const b of built) {
      const { c, m, R, S } = read(b)
      expect([Math.abs(R), Math.abs(S), c, m], b.seed).not.toContain(Math.abs(answer(b)))
      expect(c).not.toBe(m)
    }
  })

  it('spreads p, the bracket and its sign', () => {
    spread(built, 10)
    expect(new Set(built.map((b) => read(b).c))).toEqual(new Set([2, 3, 4, 5]))
    expect(new Set(built.map((b) => read(b).e))).toEqual(new Set([1, -1]))
    expect(built.filter((b) => answer(b) < 0).length / built.length).toBeGreaterThan(0.3)
  })
})

describe('every draw succeeds', () => {
  it('over 3000 seeds per slot', () => {
    for (const [id, slot] of [
      ['fm-surds-collecting', 'q2'],
      ['fm-surds-exact-area', 'q7'],
      ['fm-surds-comparing-parts', 'q12'],
    ] as const) {
      const all = build(id, slot, 3000, 'many')
      expect(all.every((b) => b.check.agrees)).toBe(true)
    }
  })
})
