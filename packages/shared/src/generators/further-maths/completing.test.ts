import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'

/**
 * Structural tests for the Further Maths completing-the-square generators. Each reads the
 * prompt's numbers back with its own patterns, works the answer again with plain arithmetic
 * (its own formula, its own vertex), checks each printed step, the named wrong routes, the
 * 2 d.p. answers against the real marker, the spread and the wording.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/further-maths')
const bankOf = (topic: string) => Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${topic}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300, prefix = 'completing'): Generated[] {
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
const signed = (sign: string, n: string) => (sign === '-' ? -Number(n) : Number(n))

function common(built: Generated[], distinct = 10) {
  for (const b of built) {
    const q = b.question
    expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
    expect(`${q.prompt} ${q.solution}`, b.seed).not.toMatch(/\+ -|- -|\+-|(?:^|[^\d.\w{])1[a-z](?![a-z])|\^1(?!\d)|\b0[a-z]/)
    expect(mark(q, String(answer(b))).correct, b.seed).toBe(true)
    expect(q.solution, b.seed).toContain(String(answer(b)))
    if (answer(b) !== 0) expect(tolerance(b)).toBeLessThanOrEqual(Math.abs(answer(b)) * 0.02)
  }
  const counts = new Map<number, number>()
  for (const b of built) counts.set(answer(b), (counts.get(answer(b)) ?? 0) + 1)
  expect(Math.max(...counts.values()) / built.length).toBeLessThanOrEqual(0.4)
  expect(counts.size).toBeGreaterThanOrEqual(distinct)
  expect(new Set(built.map((b) => b.question.prompt)).size).toBeGreaterThan(100)
}

describe('fm-minimum-value (q3)', () => {
  const built = build('fm-minimum-value', 'q3')
  const read = (prompt: string) => {
    const m = /\$(\d)\(x ([+-]) (\d)\)\^2 ([+-]) (\d+)\$/.exec(prompt)!
    return { a: Number(m[1]), h: -signed(m[2]!, m[3]!), k: signed(m[4]!, m[5]!) }
  }

  it('the minimum is the constant: found again by trying every x in steps of a tenth', () => {
    for (const b of built) {
      const { a, h, k } = read(b.question.prompt)
      let least = Infinity
      for (let i = -150; i <= 150; i++) least = Math.min(least, a * (i / 10 - h) ** 2 + k)
      expect(answer(b), b.seed).toBe(least)
      expect(tolerance(b)).toBe(0)
      expect(a).toBeGreaterThanOrEqual(2)
      expect(b.question.solution).toBe(`The bracket is never negative and is $0$ at $x = ${h}$, so the expression is at least $${k}$. The minimum value is $${k}$, at $x = ${h}$.`)
    }
  })

  it('never has the x of the minimum or the multiplier as its answer, nor two givens the same size', () => {
    for (const b of built) {
      const { a, h, k } = read(b.question.prompt)
      expect(Math.abs(k)).not.toBe(Math.abs(h))
      expect(Math.abs(k)).not.toBe(a)
      expect(Math.abs(h)).not.toBe(a)
    }
  })

  it('spreads its answers and inputs', () => {
    common(built)
    expect(share(built, (b) => answer(b) < 0)).toBeGreaterThan(0.3)
    expect(share(built, (b) => Number(b.values.h) < 0)).toBeGreaterThan(0.3)
    expect(new Set(built.map((b) => b.values.a)).size).toBe(4)
  })

  it('writes the written question exactly when it draws 2(x − 1)² + 3', () => {
    const b = find('fm-minimum-value', 'q3', (b) => b.question.prompt === 'What is the minimum value of $2(x - 1)^2 + 3$?')
    expect(b.question.solution).toBe('The bracket is never negative and is $0$ at $x = 1$, so the expression is at least $3$. The minimum value is $3$, at $x = 1$.')
  })
})

describe('fm-ball-height (q8)', () => {
  const built = build('fm-ball-height', 'q8')
  const read = (prompt: string) => {
    const f = /\$h = (?:(\d+) \+ )?(\d+)t - 5t\^2\$/.exec(prompt)!
    const X = Number(/height of (\d+) m/.exec(prompt)![1])
    return { h0: Number(f[1] ?? 0), u: Number(f[2]), X, first: prompt.includes('first reach') }
  }

  it('solves 5t² − ut + (X − h₀) = 0 by its own formula and picks the root asked for', () => {
    for (const b of built) {
      const { h0, u, X, first } = read(b.question.prompt)
      const D = u * u - 20 * (X - h0)
      expect(D).toBeGreaterThan(0)
      const t1 = (u - Math.sqrt(D)) / 10
      const t2 = (u + Math.sqrt(D)) / 10
      expect(answer(b), b.seed).toBe(first ? t1 : t2)
      expect(Number.isInteger(t1) && Number.isInteger(t2)).toBe(true)
      expect(tolerance(b)).toBe(0)
      expect(b.question.type === 'numeric' && b.question.units).toBe('s')
      // Every printed step.
      const formula = h0 === 0 ? `${u}t - 5t^2` : `${h0} + ${u}t - 5t^2`
      expect(b.question.solution).toContain(`$${formula} = ${X}$, so $5t^2 - ${u}t + ${X - h0} = 0$ and $t^2 - ${u / 5}t + ${(X - h0) / 5} = 0$: $(t - ${t1})(t - ${t2}) = 0$.`)
      expect(b.question.solution).toContain(`at ${X} m at $t = ${t1}$ on the way up and $t = ${t2}$ on the way down`)
      expect(b.question.markScheme.map((l) => l.description)).toEqual([`t² − ${u / 5}t + ${(X - h0) / 5} = 0`, `t = ${answer(b)}`])
    }
  })

  it('stays in scale: thrown at 15 to 30 m/s, from the ground, a hand, a window or a cliff that fits the words', () => {
    for (const b of built) {
      const { h0, u, X } = read(b.question.prompt)
      expect(u).toBeGreaterThanOrEqual(15)
      expect(u).toBeLessThanOrEqual(30)
      expect(X).toBeLessThan(h0 + (u * u) / 20)
      expect(X).toBeGreaterThan(h0)
      if (b.question.prompt.includes('cliff')) expect(h0).toBeGreaterThanOrEqual(20)
      else if (b.question.prompt.includes('window')) expect(h0 >= 5 && h0 <= 15).toBe(true)
      else expect(h0).toBeLessThanOrEqual(2)
      expect(answer(b)).not.toBe(h0)
    }
  })

  it('asks for the first time and the time on the way down about half each, and spreads its answers', () => {
    const first = share(built, (b) => b.question.prompt.includes('first reach'))
    expect(first).toBeGreaterThan(0.4)
    expect(first).toBeLessThan(0.6)
    // On the way up 1 s and 2 s about evenly (picking a pair made 1 s two in three); 5 s under a tenth.
    const many = build('fm-ball-height', 'q8', 1000, 'spread')
    const ups = many.filter((b) => b.question.prompt.includes('first reach'))
    const one = share(ups, (b) => answer(b) === 1)
    expect(one).toBeGreaterThan(0.4)
    expect(one).toBeLessThan(0.6)
    expect(share(many, (b) => answer(b) === 5)).toBeLessThan(0.1)
    // Whole seconds at a real speed allow only 1 to 5.
    common(built, 5)
  })

  it('writes the written solution exactly when it draws 20t − 5t² and 15 m, first', () => {
    const b = find('fm-ball-height', 'q8', (b) => b.question.prompt.includes('$h = 20t - 5t^2$') && b.question.prompt.includes('first reach a height of 15 m'))
    expect(b.question.solution).toBe(
      '$20t - 5t^2 = 15$, so $5t^2 - 20t + 15 = 0$ and $t^2 - 4t + 3 = 0$: $(t - 1)(t - 3) = 0$. The ball is at 15 m at $t = 1$ on the way up and $t = 3$ on the way down, so first at $1$ second.',
    )
  })
})

describe('fm-formula-two-places (q11)', () => {
  const built = build('fm-formula-two-places', 'q11')
  const read = (prompt: string) => {
    const m = /^Solve \$(\d?)x\^2 ([+-]) (\d?)x - (\d+) = 0\$\. Give the (positive|negative) solution to 2 decimal places\.$/.exec(prompt)!
    return { a: Number(m[1] || 1), b: signed(m[2]!, m[3] || '1'), c: -Number(m[4]), positive: m[5] === 'positive' }
  }

  it('gives the asked-for root to 2 d.p., clear of a rounding boundary, and the marker takes it rounded and unrounded', () => {
    for (const b of built) {
      const { a, b: bb, c, positive } = read(b.question.prompt)
      const D = bb * bb - 4 * a * c
      const x = (-bb + (positive ? 1 : -1) * Math.sqrt(D)) / (2 * a)
      expect(Math.sign(x)).toBe(positive ? 1 : -1)
      expect(answer(b), b.seed).toBe(Math.round(x * 100) / 100)
      expect(tolerance(b)).toBe(0.005)
      expect(Math.abs(x * 100 - Math.round(x * 100))).toBeLessThan(0.45)
      expect(mark(b.question, x.toFixed(2)).correct, b.seed).toBe(true)
      expect(mark(b.question, String(x)).correct, b.seed).toBe(true)
      expect(mark(b.question, x.toFixed(4)).correct, b.seed).toBe(true)
      expect(mark(b.question, (Math.round(x * 100) / 100 + 0.01).toFixed(2)).correct, b.seed).toBe(false)
      // The printed working: a, b and c, the discriminant, √D to 3 d.p.
      expect(b.question.solution).toContain(`The formula with $a = ${a}$, $b = ${bb}$, $c = ${c}$: $x = \\dfrac{${-bb} \\pm \\sqrt{${bb * bb} + ${-4 * a * c}}}{${2 * a}} = \\dfrac{${-bb} \\pm \\sqrt{${D}}}{${2 * a}}$.`)
      expect(b.question.solution).toContain(`${positive ? '+' : '-'} ${Math.sqrt(D).toFixed(3)}}{${2 * a}} = ${x.toFixed(2)}$ to 2 d.p.`)
      expect(Number.isInteger(Math.sqrt(D))).toBe(false)
      // √D rounded to 2 places first, as a student might, still gives the same 2 d.p. answer.
      const early = (-bb + (positive ? 1 : -1) * Number(Math.sqrt(D).toFixed(2))) / (2 * a)
      expect(Math.round(early * 100) / 100, `${b.seed}: √${D}`).toBe(answer(b))
      expect(Math.abs(bb)).toBeGreaterThanOrEqual(2)
      expect(b.question.markScheme[0]!.description).toContain(`4(${a})(${c})`)
    }
  })

  it('asks for each sign of root and keeps a = 1 most often', () => {
    const positive = share(built, (b) => read(b.question.prompt).positive)
    expect(positive).toBeGreaterThan(0.45)
    expect(positive).toBeLessThan(0.75)
    expect(share(built, (b) => read(b.question.prompt).a === 1)).toBeGreaterThan(0.45)
    common(built)
  })

  it('writes the written solution exactly when it draws x² + 4x − 7 and the positive root', () => {
    const b = find('fm-formula-two-places', 'q11', (b) => b.question.prompt === 'Solve $x^2 + 4x - 7 = 0$. Give the positive solution to 2 decimal places.')
    expect(b.question.solution).toBe(
      'The formula with $a = 1$, $b = 4$, $c = -7$: $x = \\dfrac{-4 \\pm \\sqrt{16 + 28}}{2} = \\dfrac{-4 \\pm \\sqrt{44}}{2}$. The positive root is $\\dfrac{-4 + 6.633}{2} = 1.32$ to 2 d.p.; the other is $-5.32$.',
    )
    expect(answer(b)).toBe(1.32)
  })
})

describe('fm-completing-the-square-b (q12)', () => {
  const built = build('fm-completing-the-square-b', 'q12')
  const read = (prompt: string) => {
    const m = /^Given \$(\d)x\^2 ([+-]) (\d*)x ([+-]) (\d+) \\equiv a\(x \+ b\)\^2 \+ c\$, find \$b\$\. Give your answer as a decimal\.$/.exec(prompt)!
    return { A: Number(m[1]), B: signed(m[2]!, m[3] || '1'), C: signed(m[4]!, m[5]!) }
  }
  /** "\tfrac{13}{4}", "-\tfrac{9}{10}", "5", "-36" as a number. */
  const value = (tex: string) => {
    const f = /^(-?)\\[td]?frac\{(\d+)\}\{(\d+)\}$/.exec(tex.trim())
    return f ? (f[1] ? -1 : 1) * (Number(f[2]) / Number(f[3])) : Number(tex)
  }

  it('b is B/(2A), a decimal that is not whole and stops within 3 places; the vertex is at x = −b', () => {
    for (const b of built) {
      const { A, B, C } = read(b.question.prompt)
      const want = B / (2 * A)
      expect(answer(b), b.seed).toBe(want)
      expect(Number.isInteger(want)).toBe(false)
      expect(String(want).split('.')[1]!.length).toBeLessThanOrEqual(3)
      expect(tolerance(b)).toBe(0)
      // The vertex of Ax² + Bx + C, found by trying x in steps of a thousandth.
      let best = -100
      for (let i = -20000; i <= 20000; i++) if (A * (i / 1000) ** 2 + B * (i / 1000) < A * best ** 2 + B * best) best = i / 1000
      expect(best).toBeCloseTo(-want, 9)
      // The full form printed agrees with the quadratic.
      const full = /The full form is \$(\d)\\left\(x ([+-]) (.+?)\\right\)\^2 ([+-]) (.+?)\$\.$/.exec(b.question.solution)!
      const bb = (full[2] === '-' ? -1 : 1) * value(full[3]!)
      const cc = (full[4] === '-' ? -1 : 1) * value(full[5]!)
      expect(Number(full[1])).toBe(A)
      expect(bb).toBeCloseTo(want, 12)
      for (const x of [-2, 0, 1, 3]) expect(A * (x + bb) ** 2 + cc).toBeCloseTo(A * x * x + B * x + C, 9)
      expect(b.question.solution).toContain(`so $b = ${want < 0 ? '-' : ''}\\frac{`)
      expect(b.question.solution).toContain(`= ${want}$.`)
    }
  })

  it('no named slip gives b: halving B without dividing by A, dividing by A without halving; no two givens the same size', () => {
    for (const b of built) {
      const { A, B, C } = read(b.question.prompt)
      expect(answer(b)).not.toBe(B / 2)
      expect(answer(b)).not.toBe(B / A)
      expect(new Set([A, Math.abs(B), Math.abs(C)]).size).toBe(3)
    }
  })

  it('spreads its answers, signs and leading coefficients', () => {
    common(built)
    expect(share(built, (b) => answer(b) < 0)).toBeGreaterThan(0.3)
    expect(new Set(built.map((b) => b.values.A)).size).toBe(4)
  })

  it('writes the written solution when it draws 2x² + 6x + 7', () => {
    const b = find('fm-completing-the-square-b', 'q12', (b) => b.question.prompt.startsWith('Given $2x^2 + 6x + 7 '))
    expect(b.question.solution).toBe(
      '$2\\left(x^2 + 3x\\right) + 7$: halve the $3$ inside the bracket, so $b = \\frac{3}{2} = 1.5$. The full form is $2\\left(x + \\tfrac{3}{2}\\right)^2 + \\tfrac{5}{2}$.',
    )
  })
})

describe('every draw succeeds', () => {
  it('over 3000 seeds per slot', () => {
    for (const [id, slot] of [
      ['fm-minimum-value', 'q3'],
      ['fm-ball-height', 'q8'],
      ['fm-formula-two-places', 'q11'],
      ['fm-completing-the-square-b', 'q12'],
    ] as const) {
      const all = build(id, slot, 3000, 'many')
      expect(all.every((b) => b.check.agrees)).toBe(true)
    }
  })
})
