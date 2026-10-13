import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'

/**
 * Structural tests for the sequences and limiting values generators (8365 2.20–2.22). The
 * prompt's rule, terms and value are read back with this file's own parsers and worked
 * again here; every printed step of the solution is checked, and the named wrong routes are
 * shown to give a different answer.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/further-maths')
const TOPIC = 'sequences-and-limiting-values'
const bank = Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300, prefix = 'seq'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = bank.find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `${prefix}-${i}`))
}

const numeric = (b: Generated) => {
  if (b.question.type !== 'numeric') throw new Error('not numeric')
  return b.question
}
const answer = (b: Generated) => numeric(b).answer

/** 1st, 2nd, 3rd, 11th, 12th, 13th, 21st, 112th: written out here, not imported. */
function nth(n: number): string {
  const last2 = n % 100
  if (last2 >= 11 && last2 <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th'][n % 10]}`
}

const termsIn = (tex: string) => tex.split(', ').filter((t) => t !== '\\ldots').map(Number)

function spread(values: number[], minDistinct = 10) {
  const counts = new Map<number, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  expect(counts.size).toBeGreaterThanOrEqual(minDistinct)
  expect(Math.max(...counts.values()) / values.length).toBeLessThanOrEqual(0.4)
}

function clean(b: Generated) {
  const text = [b.question.prompt, b.question.solution].join(' ')
  expect(text, b.seed).not.toMatch(/\+ -|- -|\+ \+|(?<![\d.])1n|\^1(?!\d)|(?<![\d.])0n/)
  expect(b.question.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
  expect(mark(numeric(b), String(answer(b))).correct, b.seed).toBe(true)
  expect(numeric(b).tolerance).toBe(0)
}

describe('fm-sequence-which-term q2: which term of a rising linear sequence', () => {
  const built = build('fm-sequence-which-term', 'q2')
  const read = (b: Generated) => {
    const m = /^The sequence \$([^$]+)\$ has \$n\$th term \$(\d)n ([+-]) (\d)\$\. Which term has value (\d+)\?$/.exec(b.question.prompt)
    if (!m) throw new Error(`unexpected prompt ${b.question.prompt}`)
    return { terms: termsIn(m[1]!), a: Number(m[2]), b: (m[3] === '-' ? -1 : 1) * Number(m[4]), T: Number(m[5]) }
  }

  it('prints the first four terms of its rule and asks for a term the rule reaches', () => {
    for (const b of built) {
      const { terms, a, b: c, T } = read(b)
      expect(terms, b.seed).toEqual([1, 2, 3, 4].map((n) => a * n + c))
      const N = answer(b)
      expect(a * N + c, b.seed).toBe(T)
      expect(b.question.solution, b.seed).toBe(`$${a}n ${c < 0 ? '-' : '+'} ${Math.abs(c)} = ${T}$ gives $${a}n = ${T - c}$, so $n = ${N}$. The ${nth(N)} term.`)
      clean(b)
    }
  })

  it('spreads the answer and the rule', () => {
    spread(built.map(answer))
    expect(new Set(built.map((b) => read(b).a))).toEqual(new Set([2, 3, 4, 5, 6, 7, 8, 9]))
    expect(new Set(built.map((b) => read(b).b)).size).toBe(18)
  })

  it('is not also given by moving the constant the wrong way, and is no printed number', () => {
    for (const b of built) {
      const { terms, a, b: c, T } = read(b)
      expect((T + c) / a, b.seed).not.toBe(answer(b))
      expect([a, Math.abs(c), ...terms.map(Math.abs)], b.seed).not.toContain(answer(b))
    }
  })
})

describe('fm-sequence-which-term q15: which term, going down', () => {
  const built = build('fm-sequence-which-term', 'q15')
  const read = (b: Generated) => {
    const m = /^The sequence \$([^$]+)\$ has \$n\$th term \$(\d+) - (\d)n\$\. Which term has value \$(-\d+)\$\?$/.exec(b.question.prompt)
    if (!m) throw new Error(`unexpected prompt ${b.question.prompt}`)
    return { terms: termsIn(m[1]!), c: Number(m[2]), a: Number(m[3]), T: Number(m[4]) }
  }

  it('prints three falling terms and asks for a negative term the rule reaches', () => {
    for (const b of built) {
      const { terms, c, a, T } = read(b)
      expect(terms, b.seed).toEqual([1, 2, 3].map((n) => c - a * n))
      const N = answer(b)
      expect(c - a * N, b.seed).toBe(T)
      expect(T).toBeLessThan(0)
      expect(b.question.solution, b.seed).toBe(`$${c} - ${a}n = ${T}$ gives $${a}n = ${c - T}$, so $n = ${N}$. The ${nth(N)} term.`)
      clean(b)
    }
  })

  it('spreads the answer and the rule', () => {
    spread(built.map(answer))
    expect(new Set(built.map((b) => read(b).a))).toEqual(new Set([2, 3, 4, 5, 6, 7, 8, 9]))
    expect(new Set(built.map((b) => read(b).c)).size).toBeGreaterThan(50)
  })

  it('is not also given by the sign slip, and is no printed number', () => {
    for (const b of built) {
      const { terms, c, a, T } = read(b)
      expect((c + T) / a, b.seed).not.toBe(answer(b))
      expect([a, c, -T, ...terms], b.seed).not.toContain(answer(b))
    }
  })
})

/** (an + b)/(cn + d) read from the prompt. */
function fractionIn(text: string) {
  const m = /\\dfrac\{(-?\d+)n ([+-]) (\d+)\}\{(\d+)n ([+-]) (\d+)\}/.exec(text)
  if (!m) throw new Error(`no fraction in ${text}`)
  return { a: Number(m[1]), b: (m[2] === '-' ? -1 : 1) * Number(m[3]), c: Number(m[4]), d: (m[5] === '-' ? -1 : 1) * Number(m[6]) }
}

for (const slotId of ['q3', 'q7'] as const) {
  describe(`fm-sequence-limiting-value ${slotId}: the limiting value`, () => {
    const built = build('fm-sequence-limiting-value', slotId)

    it('gives the ratio of the leading coefficients, as a decimal only when asked', () => {
      for (const b of built) {
        const { a, b: bb, c, d } = fractionIn(b.question.prompt)
        const L = answer(b)
        expect(L * c, b.seed).toBe(a)
        expect(c).toBeGreaterThan(1)
        // The denominator is never zero for a position n.
        expect(c + d).toBeGreaterThan(0)
        // Not a constant sequence.
        expect(a * d).not.toBe(bb * c)
        expect(b.question.prompt.endsWith(' Give your answer as a decimal.'), b.seed).toBe(!Number.isInteger(L))
        expect(Math.round(L * 1000) / 1000).toBe(L)
        const lead = slotId === 'q7' ? 'The $n$th term of a sequence is $' : 'Write down the limiting value of $'
        expect(b.question.prompt.startsWith(lead), b.seed).toBe(true)
        clean(b)
      }
    })

    it('divides by n on the printed line, and for q7 gives the first term and the direction', () => {
      for (const b of built) {
        const { a, b: bb, c, d } = fractionIn(b.question.prompt)
        const L = answer(b)
        const s = (v: number) => `${v < 0 ? '-' : '+'} \\frac{${Math.abs(v)}}{n}`
        const divided = `$\\dfrac{${a} ${s(bb)}}{${c} ${s(d)}} \\to \\dfrac{${a}}{${c}} = ${L}$`
        if (slotId === 'q3') {
          expect(b.question.solution).toBe(`Divide top and bottom by $n$: ${divided}. The ratio of the leading coefficients.`)
        } else {
          const m = /^Divide by \$n\$: (.+)\. The first term is \$(.+)\$, and the terms (climb|fall) towards \$(.+)\$ without reaching it\.$/.exec(b.question.solution)
          expect(m, b.question.solution).not.toBeNull()
          expect(m![1]).toBe(divided)
          const first = (a + bb) / (c + d)
          // Every part of "\frac{6}{4} = \frac{3}{2}" is the first term.
          for (const part of m![2]!.split(' = ')) {
            const f = /^(-?)\\frac\{(\d+)\}\{(\d+)\}$/.exec(part)
            const v = f ? (f[1] === '-' ? -1 : 1) * (Number(f[2]) / Number(f[3])) : Number(part)
            expect(v, b.seed).toBeCloseTo(first, 12)
          }
          const second = (2 * a + bb) / (2 * c + d)
          expect(m![3], b.seed).toBe(second > first ? 'climb' : 'fall')
          expect(Number(m![4])).toBe(L)
        }
      }
    })

    it('spreads the answer, whole and decimal, and the denominators', () => {
      spread(built.map(answer))
      const decimals = built.filter((b) => !Number.isInteger(answer(b))).length / built.length
      expect(decimals).toBeGreaterThan(0.25)
      expect(decimals).toBeLessThan(0.7)
      expect(new Set(built.map((b) => fractionIn(b.question.prompt).c)).size).toBeGreaterThanOrEqual(6)
    })

    it('is not also given by b/d, c/a or the first term, and is no printed number', () => {
      for (const b of built) {
        const { a, b: bb, c, d } = fractionIn(b.question.prompt)
        const L = answer(b)
        expect(bb / d, b.seed).not.toBeCloseTo(L, 9)
        expect(c / a, b.seed).not.toBeCloseTo(L, 9)
        expect((a + bb) / (c + d), b.seed).not.toBeCloseTo(L, 9)
        expect(a / d, b.seed).not.toBeCloseTo(L, 9)
        expect(bb / c, b.seed).not.toBeCloseTo(L, 9)
        expect(c, b.seed).not.toBe(Math.abs(d))
        expect(Math.abs(a), b.seed).not.toBe(Math.abs(bb))
        expect([a, bb, c, d].map(Math.abs), b.seed).not.toContain(Math.abs(L))
      }
    })
  })
}

describe('fm-sequence-quadratic-which-term q8: which term of a quadratic sequence', () => {
  const built = build('fm-sequence-quadratic-which-term', 'q8')
  /** n^2 + bn + c read term by term. */
  const quadratic = (tex: string) => {
    const out = { b: 0, c: 0 }
    const parts = tex.replace(/\s+/g, '').split(/(?=[+-])/)
    expect(parts[0]).toBe('n^2')
    for (const t of parts.slice(1)) {
      const m = /^([+-])(\d*)(n?)$/.exec(t)
      if (!m) throw new Error(`cannot read ${t} in ${tex}`)
      const v = (m[1] === '-' ? -1 : 1) * (m[2] === '' ? 1 : Number(m[2]))
      if (m[3]) out.b += v
      else out.c += v
    }
    return out
  }
  const read = (b: Generated) => {
    const m = /^The sequence \$([^$]+)\$ has \$n\$th term \$([^$]+)\$\. Which term has value (\d+)\?$/.exec(b.question.prompt)
    if (!m) throw new Error(`unexpected prompt ${b.question.prompt}`)
    return { terms: termsIn(m[1]!), ...quadratic(m[2]!), rule: m[2]!, T: Number(m[3]) }
  }

  it('prints its first four terms, and the answer is the one positive position with that value', () => {
    for (const b of built) {
      const { terms, b: bb, c, T } = read(b)
      const f = (n: number) => n * n + bb * n + c
      expect(terms, b.seed).toEqual([1, 2, 3, 4].map(f))
      const N = answer(b)
      expect(f(N), b.seed).toBe(T)
      // Rising from the start, so no other position has the value.
      for (let n = 1; n < 40; n++) if (n !== N) expect(f(n), b.seed).not.toBe(T)
      // The answer is not one of the printed terms, and the n term has a real coefficient.
      expect(terms.map(Math.abs), b.seed).not.toContain(N)
      expect(Math.abs(bb), b.seed).toBeGreaterThanOrEqual(2)
      clean(b)
    }
  })

  it('forms the equation, factorises it, and rejects the negative root on the printed lines', () => {
    for (const b of built) {
      const { b: bb, c, T, rule } = read(b)
      const N = answer(b)
      const m = /^\$(.+) = (\d+)\$, so \$(.+) = 0\$ and \$\(n \+ (\d+)\)\(n - (\d+)\) = 0\$\. A position is positive, so \$n = (\d+)\$: the (\w+) term\.$/.exec(b.question.solution)
      expect(m, b.question.solution).not.toBeNull()
      expect(m![1]).toBe(rule)
      expect(Number(m![2])).toBe(T)
      const formed = quadratic(m![3]!)
      expect(formed, b.seed).toEqual({ b: bb, c: c - T })
      const P = Number(m![4])
      expect(Number(m![5])).toBe(N)
      // (n + P)(n − N) expanded by hand is the formed quadratic.
      expect(P - N).toBe(bb)
      expect(-P * N).toBe(c - T)
      expect(Number(m![6])).toBe(N)
      expect(m![7]).toBe(nth(N))
      expect(b.question.markScheme[0]!.description, b.seed).toMatch(/^n² [+−] .* = 0 factorised$/)
      expect(b.question.markScheme).toHaveLength(2)
    }
  })

  it('spreads the answer and the rule', () => {
    // N runs from 8 to 15: eight answers, none reached by counting on from the four printed terms.
    spread(built.map(answer), 8)
    expect(built.every((b) => answer(b) >= 8)).toBe(true)
    expect(new Set(built.map((b) => read(b).b))).toEqual(new Set([-2, 2, 3, 4, 5, 6, 7]))
    const withConstant = built.filter((b) => read(b).c !== 0).length / built.length
    expect(withConstant).toBeGreaterThan(0.25)
    expect(withConstant).toBeLessThan(0.55)
  })

  it('keeps the rejected root a different size from the answer, and the answer no printed coefficient', () => {
    for (const b of built) {
      const { b: bb, c } = read(b)
      expect(answer(b) + bb, b.seed).not.toBe(answer(b))
      expect([Math.abs(bb), Math.abs(c)], b.seed).not.toContain(answer(b))
    }
  })
})

describe('fm-sequence-term-difference q12: the difference between two terms of an/(n + k)', () => {
  const built = build('fm-sequence-term-difference', 'q12')
  const read = (b: Generated) => {
    const m = /^The \$n\$th term of a sequence is \$\\dfrac\{(\d)n\}\{n \+ (\d)\}\$\. Work out the difference between the (\d+)(?:st|nd|rd|th) and (\d+)(?:st|nd|rd|th) terms\. Give your answer as a decimal\.$/.exec(b.question.prompt)
    if (!m) throw new Error(`unexpected prompt ${b.question.prompt}`)
    return { a: Number(m[1]), k: Number(m[2]), N: Number(m[3]), M: Number(m[4]) }
  }
  const fraction = (tex: string) => {
    const f = /^\\frac\{(\d+)\}\{(\d+)\}$/.exec(tex)
    return f ? Number(f[1]) / Number(f[2]) : Number(tex)
  }

  it('gives the difference exactly, a decimal of at most 3 places that is not whole', () => {
    for (const b of built) {
      const { a, k, N, M } = read(b)
      expect(b.question.prompt, b.seed).toContain(`the ${nth(N)} and ${nth(M)} terms`)
      const D = answer(b)
      expect(D, b.seed).toBeCloseTo((a * N) / (N + k) - (a * M) / (M + k), 12)
      expect(Number.isInteger(D)).toBe(false)
      // Not equal to either term, which would read as one term being the difference.
      expect(D, b.seed).not.toBeCloseTo((a * N) / (N + k), 9)
      expect(D, b.seed).not.toBeCloseTo((a * M) / (M + k), 9)
      expect(Math.round(D * 1000) / 1000).toBe(D)
      clean(b)
    }
  })

  it('finds both terms, puts them over one denominator and subtracts, each step equal', () => {
    for (const b of built) {
      const { a, k, N, M } = read(b)
      const m = /^The (\w+) term is \$(.+)\$; the (\w+) is \$(.+)\$\. The difference is \$(.+)\$\.$/.exec(b.question.solution)
      expect(m, b.question.solution).not.toBeNull()
      expect(m![1]).toBe(nth(N))
      expect(m![3]).toBe(nth(M))
      const big = m![2]!.split(' = ')
      const small = m![4]!.split(' = ')
      expect(big[0]).toBe(`\\frac{${a * N}}{${N + k}}`)
      expect(small[0]).toBe(`\\frac{${a * M}}{${M + k}}`)
      for (const p of big) expect(fraction(p)).toBeCloseTo((a * N) / (N + k), 12)
      for (const p of small) expect(fraction(p)).toBeCloseTo((a * M) / (M + k), 12)
      const steps = m![5]!.split(' = ')
      expect(steps.at(-1)).toBe(String(answer(b)))
      for (const step of steps) {
        const v = step.split(' - ').map(fraction).reduce((x, y) => x - y)
        expect(v, `${b.seed} ${step}`).toBeCloseTo(answer(b), 12)
      }
      expect(b.question.markScheme[0]).toEqual({ code: 'M1', marks: 1, description: 'both terms found and simplified' })
    }
  })

  it('spreads the answer and the rule', () => {
    spread(built.map(answer))
    expect(new Set(built.map((b) => read(b).a))).toEqual(new Set([2, 3, 4, 5, 6]))
    expect(new Set(built.map((b) => read(b).k)).size).toBeGreaterThanOrEqual(7)
  })

  it('is not also given by the term at N − M', () => {
    for (const b of built) {
      const { a, k, N, M } = read(b)
      expect((a * (N - M)) / (N - M + k), b.seed).not.toBeCloseTo(answer(b), 9)
    }
  })
})

describe('sequences literal lines (worked by hand)', () => {
  const first = (id: string, slot: string) => build(id, slot, 1)[0]!.question

  it('q2 and q15', () => {
    expect(first('fm-sequence-which-term', 'q2').solution).toBe('$6n + 9 = 321$ gives $6n = 312$, so $n = 52$. The 52nd term.')
    const q15 = first('fm-sequence-which-term', 'q15')
    expect(q15.prompt).toBe('The sequence $40, 33, 26, \\ldots$ has $n$th term $47 - 7n$. Which term has value $-863$?')
    expect(q15.solution).toBe('$47 - 7n = -863$ gives $7n = 910$, so $n = 130$. The 130th term.')
  })

  it('q3 and q7', () => {
    expect(first('fm-sequence-limiting-value', 'q3').solution).toBe(
      'Divide top and bottom by $n$: $\\dfrac{3 - \\frac{2}{n}}{4 + \\frac{7}{n}} \\to \\dfrac{3}{4} = 0.75$. The ratio of the leading coefficients.',
    )
    expect(first('fm-sequence-limiting-value', 'q7').solution).toBe(
      'Divide by $n$: $\\dfrac{12 - \\frac{6}{n}}{4 + \\frac{1}{n}} \\to \\dfrac{12}{4} = 3$. The first term is $\\frac{6}{5}$, and the terms climb towards $3$ without reaching it.',
    )
  })

  it('q8 and q12', () => {
    expect(first('fm-sequence-quadratic-which-term', 'q8').solution).toBe(
      '$n^2 + 2n + 1 = 169$, so $n^2 + 2n - 168 = 0$ and $(n + 14)(n - 12) = 0$. A position is positive, so $n = 12$: the 12th term.',
    )
    expect(first('fm-sequence-term-difference', 'q12').solution).toBe(
      'The 20th term is $\\frac{60}{25} = \\frac{12}{5}$; the 7th is $\\frac{21}{12} = \\frac{7}{4}$. The difference is $\\frac{12}{5} - \\frac{7}{4} = \\frac{48}{20} - \\frac{35}{20} = \\frac{13}{20} = 0.65$.',
    )
  })
})

describe('sequences generators', () => {
  it('draw successfully on 3000 seeds for every slot', () => {
    const slots: [string, string[]][] = [
      ['fm-sequence-which-term', ['q2', 'q15']],
      ['fm-sequence-limiting-value', ['q3', 'q7']],
      ['fm-sequence-quadratic-which-term', ['q8']],
      ['fm-sequence-term-difference', ['q12']],
    ]
    for (const [id, ids] of slots) for (const slot of ids) expect(() => build(id, slot, 3000, 'many')).not.toThrow()
  })

  it('belong to Further Maths and route q2 and q15 to their own questions', () => {
    for (const g of GENERATORS.filter((g) => g.topicId === TOPIC)) expect(g.subjectId).toBe('further-maths')
    expect(build('fm-sequence-which-term', 'q2', 30).every((b) => answer(b) > 0 && /Which term has value \d+\?$/.test(b.question.prompt))).toBe(true)
    expect(build('fm-sequence-which-term', 'q15', 30).every((b) => b.question.prompt.includes('value $-'))).toBe(true)
  })
})
