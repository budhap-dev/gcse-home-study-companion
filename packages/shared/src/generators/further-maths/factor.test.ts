import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'

/**
 * Structural tests for the factor theorem generators (8365 2.11). The release check proves
 * each answer agrees with the generator's own second route; these read the prompt's cubic
 * back with a parser that shares no code with the generators, work f at the printed value in
 * whole numbers, and check every printed step of the solution.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/further-maths')
const TOPIC = 'the-factor-theorem-and-cubics'
const bank = Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300, prefix = 'factor'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = bank.find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `${prefix}-${i}`))
}

const numeric = (b: Generated) => {
  if (b.question.type !== 'numeric') throw new Error('not numeric')
  return b.question
}

/** Coefficients of a printed polynomial, highest power first, read term by term: 2x^3 - x + 6 is [2, 0, -1, 6]. */
function coefficients(tex: string, letter = 'x'): number[] {
  const terms = tex.replace(/\s+/g, '').split(/(?=[+-])/)
  const out = [0, 0, 0, 0]
  for (const t of terms) {
    const m = new RegExp(`^([+-]?)(\\d*)(${letter}(?:\\^(\\d))?)?$`).exec(t)
    if (!m) throw new Error(`cannot read term "${t}" of ${tex}`)
    const size = m[2] === '' ? 1 : Number(m[2])
    if (m[2] === '' && !m[3]) throw new Error(`empty term in ${tex}`)
    const power = m[3] ? (m[4] ? Number(m[4]) : 1) : 0
    out[3 - power]! += (m[1] === '-' ? -1 : 1) * size
  }
  return out
}

/** 8 f(n/2) for whole coefficients: a whole number, so a root is an exact zero. */
const eightTimes = (k: number[], n: number) => k[0]! * n ** 3 + k[1]! * n ** 2 * 2 + k[2]! * n * 4 + k[3]! * 8
const at = (k: number[], x: number) => eightTimes(k, 2 * x) / 8

/** A chain of TeX numbers summed: \frac{27}{4} - 2 + 3 \cdot \left(-\frac{1}{2}\right), by rewriting to JavaScript. */
function texNumber(tex: string): number {
  const js = tex
    .replace(/\\left\(|\\right\)/g, (m) => (m === '\\left(' ? '(' : ')'))
    .replace(/\\frac\{(\d+)\}\{(\d+)\}/g, '($1/$2)')
    .replace(/\\cdot/g, '*')
    .replace(/\s+/g, '')
  if (/[^\d+\-*/().]/.test(js)) throw new Error(`cannot read ${tex} (${js})`)
  return new Function(`return ${js}`)() as number
}

const prompts = (bs: Generated[]) => bs.map((b) => b.question.prompt)
const share = (bs: Generated[], answer: number) => bs.filter((b) => numeric(b).answer === answer).length / bs.length

function spread(bs: Generated[], minDistinct = 10) {
  const counts = new Map<number, number>()
  for (const b of bs) counts.set(numeric(b).answer, (counts.get(numeric(b).answer) ?? 0) + 1)
  expect(counts.size).toBeGreaterThanOrEqual(minDistinct)
  expect(Math.max(...counts.values()) / bs.length).toBeLessThanOrEqual(0.4)
}

/** Text a student reads, scanned for the printing slips the Maths reviewers caught. */
function cleanSigns(b: Generated) {
  const text = [b.question.prompt, b.question.solution].join(' ')
  expect(text, b.seed).not.toMatch(/\+ -|- -|\+ \+|(?<![\d.])1x|\^1(?!\d)|(?<![\d.])0x/)
  expect(b.question.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
}

describe('fm-factor-theorem-value q1: f(a) for a negative whole a', () => {
  const built = build('fm-factor-theorem-value', 'q1')
  const read = (b: Generated) => {
    const m = /^For \$f\(x\) = ([^$]+)\$, work out \$f\((-\d)\)\$\.$/.exec(b.question.prompt)
    if (!m) throw new Error(`unexpected prompt ${b.question.prompt}`)
    return { k: coefficients(m[1]!), a: Number(m[2]) }
  }

  it('asks for f at a negative whole number, and the answer is f there', () => {
    for (const b of built) {
      const { k, a } = read(b)
      expect([-1, -2, -3]).toContain(a)
      expect(k[0], b.seed).toBe(1)
      expect(k.every((c) => c !== 0), b.seed).toBe(true)
      expect(numeric(b).answer, b.seed).toBe(at(k, a))
      expect(numeric(b).tolerance).toBe(0)
      cleanSigns(b)
    }
  })

  it('prints each term at that value, then the total, then what it says about the factor', () => {
    for (const b of built) {
      const { k, a } = read(b)
      const m = /^\$f\((-\d)\) = ([^=]+) = (-?\d+)\$\. (.+)$/.exec(b.question.solution)!
      expect(m, b.seed).not.toBeNull()
      const parts = m[2]!.replace(/\s+/g, '').split(/(?=[+-])/).map(Number)
      expect(parts, b.seed).toEqual(k.map((c, i) => c * a ** (3 - i)))
      expect(Number(m[3])).toBe(numeric(b).answer)
      const factor = `(x + ${-a})`
      expect(m[4], b.seed).toBe(numeric(b).answer === 0 ? `So $${factor}$ is a factor of $f(x)$.` : `It is not zero, so $${factor}$ is not a factor of $f(x)$.`)
    }
  })

  it('writes the lines as the written question does', () => {
    const one = built.find((b) => numeric(b).answer === 0 && read(b).a === -1)!
    const { k } = read(one)
    expect(one.question.solution).toContain(`= ${-1 + k[1]! - k[2]! + k[3]!}$. So $(x + 1)$ is a factor of $f(x)$.`)
    expect(one.question.markScheme).toEqual([{ code: 'B1', marks: 1, description: '0' }])
    const neg = built.find((b) => numeric(b).answer < 0)!
    expect(neg.question.markScheme[0]!.description).toBe(`−${-numeric(neg).answer}`)
  })

  it('has a root about 30% of the time, spreads the rest, and uses every value', () => {
    const zero = share(built, 0)
    expect(zero).toBeGreaterThan(0.2)
    expect(zero).toBeLessThanOrEqual(0.4)
    spread(built)
    expect(new Set(built.map((b) => read(b).a))).toEqual(new Set([-1, -2, -3]))
    expect(new Set(prompts(built)).size).toBeGreaterThan(200)
  })

  it('is not also given by working out f(−a) (the sign slip)', () => {
    const same = built.filter((b) => { const { k, a } = read(b); return at(k, -a) === numeric(b).answer }).length
    expect(same / built.length).toBeLessThanOrEqual(0.05)
  })

  it('gives x^2 a real coefficient, and no two of |b|, |c|, |d| alike', () => {
    for (const b of built) {
      const { k } = read(b)
      expect(Math.abs(k[1]!), b.seed).toBeGreaterThanOrEqual(2)
      expect(new Set(k.slice(1).map(Math.abs)).size, b.seed).toBe(3)
    }
  })

  it('never gives a non-zero answer equal to a printed number', () => {
    for (const b of built) {
      const { k, a } = read(b)
      const ans = numeric(b).answer
      if (ans !== 0) expect([...k.slice(1).map(Math.abs), Math.abs(a)], b.seed).not.toContain(Math.abs(ans))
    }
  })
})

describe('fm-factor-theorem-value q7: a value that is not a root', () => {
  const built = build('fm-factor-theorem-value', 'q7')
  const read = (b: Generated) => {
    const m = /^For \$f\(x\) = ([^$]+)\$, work out \$f\((-?\d)\)\$, and hence decide whether \$\(x ([+-]) (\d)\)\$ is a factor of \$f\(x\)\$\. Give the value of \$f\((-?\d)\)\$\.$/.exec(b.question.prompt)
    if (!m) throw new Error(`unexpected prompt ${b.question.prompt}`)
    const t = Number(m[2])
    expect(Number(m[5])).toBe(t)
    expect((m[3] === '-' ? 1 : -1) * Number(m[4])).toBe(t)
    return { k: coefficients(m[1]!), t }
  }

  it('gives f(t), which is not zero, and names three factors that multiply back to f', () => {
    for (const b of built) {
      const { k, t } = read(b)
      expect(k[0]).toBe(1)
      expect(k.every((c) => c !== 0), b.seed).toBe(true)
      const ans = numeric(b).answer
      expect(ans, b.seed).toBe(at(k, t))
      expect(ans).not.toBe(0)
      const m = /^\$f\((-?\d)\) = ([^=]+) = (-?\d+)\$\. It is not zero, so \$\(x [+-] \d\)\$ is not a factor: the factors are \$\(x ([+-]) (\d)\)\$, \$\(x ([+-]) (\d)\)\$ and \$\(x ([+-]) (\d)\)\$\.$/.exec(b.question.solution)
      expect(m, `${b.seed} ${b.question.solution}`).not.toBeNull()
      expect(m![2]!.replace(/\s+/g, '').split(/(?=[+-])/).map(Number), b.seed).toEqual(k.map((c, i) => c * t ** (3 - i)))
      const roots = [4, 6, 8].map((i) => (m![i] === '-' ? 1 : -1) * Number(m![i + 1]))
      for (const x of roots) expect(at(k, x), b.seed).toBe(0)
      // (x − p)(x − q)(x − s) expanded by brute force matches the printed cubic.
      for (const x of [-4.5, 0.5, 7]) expect(roots.reduce((acc, p) => acc * (x - p), 1)).toBeCloseTo(at(k, x), 9)
      cleanSigns(b)
    }
  })

  it('gives x^2 a real coefficient, unlike the x coefficient in size', () => {
    for (const b of built) {
      const { k } = read(b)
      expect(Math.abs(k[1]!), b.seed).toBeGreaterThanOrEqual(2)
      expect(Math.abs(k[1]!), b.seed).not.toBe(Math.abs(k[2]!))
    }
  })

  it('evaluates at ±1 in under 20% of builds, so ±2 and ±3 are the majority', () => {
    const many = build('fm-factor-theorem-value', 'q7', 1000, 'wide')
    const ones = many.filter((b) => Math.abs(read(b).t) === 1).length / many.length
    expect(ones).toBeGreaterThan(0.05)
    expect(ones).toBeLessThan(0.2)
  })

  it('spreads its answers and its values of t, with well over 100 prompts', () => {
    expect(new Set(build('fm-factor-theorem-value', 'q7', 1000, 'wide').map((b) => b.question.prompt)).size).toBeGreaterThan(200)
    spread(built)
    expect(new Set(built.map((b) => read(b).t))).toEqual(new Set([1, 2, 3, -1, -2, -3]))
  })

  it('is not also given by working out f(−t)', () => {
    const same = built.filter((b) => { const { k, t } = read(b); return at(k, -t) === numeric(b).answer }).length
    expect(same / built.length).toBeLessThanOrEqual(0.05)
  })

  it('never gives an answer equal to a printed number', () => {
    for (const b of built) {
      const { k, t } = read(b)
      expect([...k.slice(1).map(Math.abs), Math.abs(t)], b.seed).not.toContain(Math.abs(numeric(b).answer))
    }
  })
})

describe('fm-factor-theorem-value q10: f at a half', () => {
  const built = build('fm-factor-theorem-value', 'q10')
  const read = (b: Generated) => {
    const m = /^For \$f\(x\) = ([^$]+)\$, work out \$f\\left\((-?)\\frac\{(\d)\}\{2\}\\right\)\$\.( Give your answer as a decimal\.)?$/.exec(b.question.prompt)
    if (!m) throw new Error(`unexpected prompt ${b.question.prompt}`)
    return { k: coefficients(m[1]!), n: (m[2] === '-' ? -1 : 1) * Number(m[3]), decimal: Boolean(m[4]) }
  }

  it('gives f(n/2) exactly, asking for a decimal only when it is not whole', () => {
    for (const b of built) {
      const { k, n, decimal } = read(b)
      expect(k[0]).toBe(2)
      expect(k.every((c) => c !== 0 && Math.abs(c) !== 1), b.seed).toBe(true)
      expect([1, -1, 3, -3]).toContain(n)
      const ans = numeric(b).answer
      expect(ans * 8, b.seed).toBe(eightTimes(k, n))
      expect(decimal, b.seed).toBe(!Number.isInteger(ans))
      // At most 2 decimal places: quarters.
      expect(Number.isInteger(ans * 4), b.seed).toBe(true)
      expect(mark(numeric(b), String(ans)).correct).toBe(true)
      cleanSigns(b)
    }
  })

  it('prints the products, then their values, then the total, each line equal to f(n/2)', () => {
    for (const b of built) {
      const { k, n } = read(b)
      const ans = numeric(b).answer
      const m = /^\$f\\left\([^$]*?\\right\) = (.+)\$\. (.+)$/.exec(b.question.solution)!
      const chain = m[1]!.split(' = ')
      const [products, values] = chain as [string, string]
      // The products line: each coefficient times the matching power of n/2.
      const terms = products.replace(/\s+/g, '').replace(/\\left\(/g, '[').replace(/\\right\)/g, ']').split(/(?<![[])(?=[+-])/)
      expect(terms, b.seed).toHaveLength(4)
      expect(terms.map((t) => texNumber(t.replace(/\[/g, '\\left(').replace(/\]/g, '\\right)'))), b.seed).toEqual(k.map((c, i) => (c * n ** (3 - i)) / 2 ** (3 - i)))
      expect(texNumber(values), b.seed).toBeCloseTo(ans, 12)
      const last = chain.slice(2)
      if (Number.isInteger(ans)) expect(last).toEqual([String(ans)])
      else {
        expect(texNumber(last[0]!)).toBeCloseTo(ans, 12)
        expect(last[1]).toBe(String(ans))
      }
      const factor = `(2x ${n > 0 ? '-' : '+'} ${Math.abs(n)})`
      expect(m[2], b.seed).toBe(ans === 0 ? `So $${factor}$ is a factor.` : `It is not zero, so $${factor}$ is not a factor.`)
    }
  })

  it('writes the written question\'s line when the half is a root', () => {
    const one = built.find((b) => numeric(b).answer === 0 && read(b).n === 1)!
    const { k } = read(one)
    expect(one.question.solution.startsWith(`$f\\left(\\frac{1}{2}\\right) = 2 \\cdot \\frac{1}{8} ${k[1]! < 0 ? '-' : '+'} ${Math.abs(k[1]!)} \\cdot \\frac{1}{4}`)).toBe(true)
    expect(one.question.solution.endsWith('= 0$. So $(2x - 1)$ is a factor.')).toBe(true)
  })

  it('has a root about 30% of the time, and spreads the rest, whole and decimal', () => {
    const zero = share(built, 0)
    expect(zero).toBeGreaterThan(0.2)
    expect(zero).toBeLessThanOrEqual(0.4)
    spread(built)
    const decimals = built.filter((b) => !Number.isInteger(numeric(b).answer)).length / built.length
    expect(decimals).toBeGreaterThan(0.2)
    expect(decimals).toBeLessThan(0.5)
    expect(new Set(built.map((b) => read(b).n))).toEqual(new Set([1, -1, 3, -3]))
  })

  it('never gives a non-zero answer equal to a printed coefficient, the leading 2 included', () => {
    for (const b of built) {
      const { k } = read(b)
      const ans = numeric(b).answer
      if (ans !== 0) expect(k.map(Math.abs), b.seed).not.toContain(Math.abs(ans))
    }
  })

  it('is not also given by working out f(−n/2)', () => {
    const same = built.filter((b) => { const { k, n } = read(b); return eightTimes(k, -n) === numeric(b).answer * 8 }).length
    expect(same / built.length).toBeLessThanOrEqual(0.05)
  })
})

describe('fm-factor-theorem-coefficient q6: an unknown coefficient', () => {
  const built = build('fm-factor-theorem-coefficient', 'q6')
  const read = (b: Generated) => {
    const m = /^\$\(x ([+-]) (\d)\)\$ is a factor of \$(\d)x\^3 \+ cx\^2 ([+-]) (\d+)x ([+-]) (\d+)\$\. Find \$c\$\.$/.exec(b.question.prompt)
    if (!m) throw new Error(`unexpected prompt ${b.question.prompt}`)
    const sign = (s: string) => (s === '-' ? -1 : 1)
    return { a: -sign(m[1]!) * Number(m[2]), k: Number(m[3]), e: sign(m[4]!) * Number(m[5]), g: sign(m[6]!) * Number(m[7]) }
  }

  it('gives the c that makes the printed cubic zero at the root', () => {
    for (const b of built) {
      const { a, k, e, g } = read(b)
      const c = numeric(b).answer
      expect(k * a ** 3 + c * a * a + e * a + g, b.seed).toBe(0)
      expect([2, -2, 3, -3]).toContain(a)
      expect(Math.abs(e)).toBeGreaterThan(1)
      cleanSigns(b)
    }
  })

  it('substitutes, collects and solves on the printed lines', () => {
    for (const b of built) {
      const { a, k, e, g } = read(b)
      const c = numeric(b).answer
      const m = /^\$f\((-?\d)\) = 0\$: \$([^=]+) = ([^=]+) = 0\$, so \$c = (-?\d+)\$\.$/.exec(b.question.solution)!
      expect(m, b.seed).not.toBeNull()
      expect(Number(m[1])).toBe(a)
      const parts = m[2]!.replace(/\s+/g, '').split(/(?=[+-])/)
      expect(parts, b.seed).toEqual([k * a ** 3, `${a * a}c`, e * a, g].map((p, i) => (i > 0 && !String(p).startsWith('-') ? `+${p}` : String(p))))
      const K = k * a ** 3 + e * a + g
      expect(m[3]!.replace(/\s+/g, ''), b.seed).toBe(`${a * a}c${K < 0 ? '' : '+'}${K}`)
      expect(Number(m[4])).toBe(c)
      expect(b.question.markScheme).toEqual([
        { code: 'M1', marks: 1, description: `substitutes x = ${String(a).replace('-', '−')} and sets to zero` },
        { code: 'A1', marks: 1, description: `c = ${String(c).replace('-', '−')}` },
      ])
    }
  })

  it('never asks for c = ±1, and keeps |e| and |g| apart', () => {
    for (const b of built) {
      const { e, g } = read(b)
      expect(Math.abs(numeric(b).answer), b.seed).toBeGreaterThanOrEqual(2)
      expect(Math.abs(e), b.seed).not.toBe(Math.abs(g))
    }
  })

  it('balances ±2 against ±3 and k = 2 against 3, and does not tie the sign of c to a', () => {
    const big = built.filter((b) => Math.abs(read(b).a) === 3).length / built.length
    expect(big).toBeGreaterThanOrEqual(0.35)
    expect(big).toBeLessThanOrEqual(0.65)
    const two = built.filter((b) => read(b).k === 2).length / built.length
    expect(two).toBeGreaterThanOrEqual(0.35)
    expect(two).toBeLessThanOrEqual(0.65)
    for (const a of [2, -2, 3, -3]) {
      const some = built.filter((b) => read(b).a === a)
      const positive = some.filter((b) => numeric(b).answer > 0).length / some.length
      expect(positive, `a = ${a}`).toBeGreaterThanOrEqual(0.3)
      expect(positive, `a = ${a}`).toBeLessThanOrEqual(0.7)
    }
  })

  it('spreads c, and the factor, the leading coefficient and the rest', () => {
    spread(built)
    expect(new Set(built.map((b) => read(b).a))).toEqual(new Set([2, -2, 3, -3]))
    expect(new Set(built.map((b) => read(b).k))).toEqual(new Set([2, 3]))
    expect(new Set(built.map((b) => read(b).e)).size).toBeGreaterThan(10)
  })

  it('is not also given by substituting x = −a', () => {
    const same = built.filter((b) => {
      const { a, k, e, g } = read(b)
      return -(k * (-a) ** 3 - e * a + g) / (a * a) === numeric(b).answer
    }).length
    expect(same / built.length).toBeLessThanOrEqual(0.05)
  })

  it('never gives an answer equal to a printed number', () => {
    for (const b of built) {
      const { a, k, e, g } = read(b)
      expect([Math.abs(a), k, Math.abs(e), Math.abs(g)], b.seed).not.toContain(Math.abs(numeric(b).answer))
    }
  })
})

describe('factor theorem literal lines (worked by hand)', () => {
  const first = (id: string, slot: string) => build(id, slot, 1)[0]!.question

  it('q1', () => {
    const q = first('fm-factor-theorem-value', 'q1')
    expect(q.prompt).toBe('For $f(x) = x^3 + 3x^2 + 6x + 4$, work out $f(-1)$.')
    expect(q.solution).toBe('$f(-1) = -1 + 3 - 6 + 4 = 0$. So $(x + 1)$ is a factor of $f(x)$.')
  })

  it('q7', () => {
    const q = first('fm-factor-theorem-value', 'q7')
    expect(q.prompt).toBe('For $f(x) = x^3 - 2x^2 - x + 2$, work out $f(-3)$, and hence decide whether $(x + 3)$ is a factor of $f(x)$. Give the value of $f(-3)$.')
    expect(q.solution).toBe('$f(-3) = -27 - 18 + 3 + 2 = -40$. It is not zero, so $(x + 3)$ is not a factor: the factors are $(x + 1)$, $(x - 1)$ and $(x - 2)$.')
  })

  it('q10', () => {
    const q = first('fm-factor-theorem-value', 'q10')
    expect(q.prompt).toBe('For $f(x) = 2x^3 + 5x^2 - 4x + 6$, work out $f\\left(-\\frac{1}{2}\\right)$.')
    expect(q.solution).toBe(
      '$f\\left(-\\frac{1}{2}\\right) = 2 \\cdot \\left(-\\frac{1}{8}\\right) + 5 \\cdot \\frac{1}{4} - 4 \\cdot \\left(-\\frac{1}{2}\\right) + 6 = -\\frac{1}{4} + \\frac{5}{4} + 2 + 6 = 9$. It is not zero, so $(2x + 1)$ is not a factor.',
    )
  })

  it('q6', () => {
    const q = first('fm-factor-theorem-coefficient', 'q6')
    expect(q.prompt).toBe('$(x + 3)$ is a factor of $3x^3 + cx^2 - 8x + 75$. Find $c$.')
    expect(q.solution).toBe('$f(-3) = 0$: $-81 + 9c + 24 + 75 = 9c + 18 = 0$, so $c = -2$.')
  })
})

describe('factor theorem generators', () => {
  it('draw successfully on 3000 seeds for every slot', () => {
    for (const [id, slots] of [['fm-factor-theorem-value', ['q1', 'q7', 'q10']], ['fm-factor-theorem-coefficient', ['q6']]] as const) {
      for (const slot of slots) expect(() => build(id, slot, 3000, 'many')).not.toThrow()
    }
  })

  it('route each slot to its own question, and leave q14 written', () => {
    const value = GENERATORS.find((g) => g.id === 'fm-factor-theorem-value')!
    expect(value.subjectId).toBe('further-maths')
    expect(value.replaces).toEqual(['q1', 'q7', 'q10'])
    expect(build('fm-factor-theorem-value', 'q7', 20).every((b) => b.question.prompt.includes('hence decide'))).toBe(true)
    expect(build('fm-factor-theorem-value', 'q1', 20).some((b) => b.question.prompt.includes('hence') || b.question.prompt.includes('frac'))).toBe(false)
    expect(build('fm-factor-theorem-value', 'q10', 20).every((b) => b.question.prompt.includes('\\frac'))).toBe(true)
    expect(GENERATORS.some((g) => g.topicId === TOPIC && g.replaces.includes('q14'))).toBe(false)
  })
})
