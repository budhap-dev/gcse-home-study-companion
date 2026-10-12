import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'

/**
 * Structural tests for the Further Maths functions, algebraic-fraction and proof generators
 * (8365 2.2, 2.4, 2.5, 2.9, 2.13, 2.19). Each prompt is read back with this file's own TeX
 * reader and the answer worked again here from what the student sees; every printed step of
 * the solution is evaluated, the named slips are shown to give another number, and the answers
 * and inputs are shown to spread. Everything is non-calculator: whole numbers, one decimal
 * (b = 0.5) asked for as such.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/further-maths')
const bankOf = (topic: string) => Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${topic}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300, prefix = 'functions'): Generated[] {
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
const written = (generatorId: string, slotId: string) => bankOf(GENERATORS.find((x) => x.id === generatorId)!.topicId).find((q) => q.id === slotId)!

const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const share = (built: Generated[], pred: (b: Generated) => boolean) => built.filter(pred).length / built.length
const mathOf = (text: string) => [...text.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]!)

/**
 * This file's own reader of printed TeX: numbers, single letters, \frac (any size), \sqrt,
 * \times, powers, brackets and implicit multiplication. Written afresh so a misreading shared
 * with the generators cannot pass.
 */
function tex(src: string, vars: Record<string, number> = {}): number {
  const s = src.replace(/\\left|\\right|\\[,;!]/g, '').replace(/\\[dt]frac/g, '\\frac').replace(/\\times|\\cdot/g, '*').replace(/\s+/g, '')
  let i = 0
  const fail = (): never => {
    throw new Error(`cannot read "${src}" at ${i}`)
  }
  const braced = (): number => {
    if (s[i] !== '{') fail()
    i++
    const v = expr()
    if (s[i] !== '}') fail()
    i++
    return v
  }
  const atom = (): number => {
    if (s.startsWith('\\frac', i)) {
      i += 5
      const top = braced()
      return top / braced()
    }
    if (s.startsWith('\\sqrt', i)) {
      i += 5
      return Math.sqrt(braced())
    }
    if (s[i] === '(') {
      i++
      const v = expr()
      if (s[i] !== ')') fail()
      i++
      return v
    }
    if (s[i] === '{') return braced()
    const num = /^\d+(\.\d+)?/.exec(s.slice(i))
    if (num) {
      i += num[0].length
      return Number(num[0])
    }
    const ch = s[i] ?? ''
    if (/[a-zA-Z]/.test(ch)) {
      i++
      if (!(ch in vars)) fail()
      return vars[ch]!
    }
    return fail()
  }
  const power = (): number => {
    const base = atom()
    if (s[i] !== '^') return base
    i++
    if (s[i] === '{') return base ** braced()
    const d = /^\d/.exec(s.slice(i)) ?? fail()
    i++
    return base ** Number(d[0])
  }
  const unary = (): number => (s[i] === '-' ? (i++, -unary()) : power())
  const starts = () => /[\d(a-zA-Z{]/.test(s[i] ?? '') || s.startsWith('\\frac', i) || s.startsWith('\\sqrt', i)
  const term = (): number => {
    let v = unary()
    for (;;) {
      if (s[i] === '*') v *= (i++, unary())
      else if (s[i] === '/') v /= (i++, unary())
      else if (starts()) v *= power()
      else return v
    }
  }
  function expr(): number {
    let v = s[i] === '+' ? (i++, term()) : term()
    while (s[i] === '+' || s[i] === '-') {
      const op = s[i++]
      const t = term()
      v = op === '+' ? v + t : v - t
    }
    return v
  }
  const v = expr()
  if (i !== s.length) fail()
  return v
}
/** Every link of a chain a = b = c evaluates to `value`. */
function chainHolds(math: string, value: number, vars: Record<string, number> = {}) {
  for (const part of math.split(' = ')) expect(tex(part, vars), math).toBeCloseTo(value, 9)
}
/** The coefficients of a printed ax² + bx + c (or ax + b), read by evaluating it. */
function quadraticOf(body: string, letter = 'x') {
  const at = (v: number) => tex(body, { [letter]: v })
  const c = at(0)
  const a = (at(1) + at(-1)) / 2 - c
  const b = at(1) - a - c
  return { a, b, c }
}

function common(built: Generated[], slot: Question, minDistinct = 10, options: { decimals?: boolean } = {}) {
  const marks = slot.marks
  for (const b of built) {
    const q = b.question
    expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
    expect(`${q.prompt} ${q.solution}`, b.seed).not.toMatch(/\+ -|- -|\+ \+|\+-|(?:^|[^\d.\w{])1[xynk](?![a-z])|\^1(?!\d)|\^\{1\}|(?:^|[^\d.])0[xynk]/)
    expect(q.type === 'numeric' && q.tolerance, b.seed).toBe(0)
    if (!options.decimals) expect(Number.isInteger(answer(b)), b.seed).toBe(true)
    expect(mark(q, String(answer(b))).correct, b.seed).toBe(true)
    expect(mark(q, String(answer(b) + 1)).correct, b.seed).toBe(false)
    expect(q.solution, b.seed).toContain(String(answer(b)))
    expect(b.check.agrees, `${b.seed}: ${b.check.detail}`).toBe(true)
    expect(q.markScheme.map((l) => l.code)).toEqual(marks === 1 ? ['B1'] : ['M1', 'A1'])
    expect(q.markScheme.at(-1)!.description).toBe(String(answer(b)).replace('-', '−'))
    // "Give your answer as a decimal" exactly when the answer is not whole.
    expect(q.prompt.endsWith(' Give your answer as a decimal.'), b.seed).toBe(!Number.isInteger(answer(b)))
  }
  const counts = new Map<number, number>()
  const prompts = new Map<string, number>()
  for (const b of built) {
    counts.set(answer(b), (counts.get(answer(b)) ?? 0) + 1)
    prompts.set(b.question.prompt, (prompts.get(b.question.prompt) ?? 0) + 1)
  }
  expect(Math.max(...counts.values()) / built.length).toBeLessThanOrEqual(0.4)
  expect(counts.size).toBeGreaterThanOrEqual(minDistinct)
  expect(prompts.size).toBeGreaterThan(100)
  expect(Math.max(...prompts.values()) / built.length).toBeLessThanOrEqual(0.05)
  expect((prompts.get(slot.prompt) ?? 0) / built.length).toBeLessThanOrEqual(0.05)
}

// ---------------------------------------------------------------------------------------

describe('fm-function-value-and-inverse q1: f(k) for a quadratic', () => {
  const built = build('fm-function-value-and-inverse', 'q1')
  const slot = written('fm-function-value-and-inverse', 'q1')
  const read = (b: Generated) => {
    const m = /^\$([fgh])\(x\) = ([^$]+)\$\. Work out \$\1\((-?\d+)\)\$\.$/.exec(b.question.prompt)
    expect(m, b.question.prompt).not.toBeNull()
    return { name: m![1]!, body: m![2]!, k: Number(m![3]) }
  }
  it('is the printed body at the printed input, every step holds, and no slip gives it', () => {
    for (const b of built) {
      const { name, body, k } = read(b)
      const { a, b: lin, c } = quadraticOf(body)
      expect(lin).toBe(0)
      expect([1, 2, 3]).toContain(a)
      expect(c).not.toBe(0)
      const v = a * k * k + c
      expect(answer(b), b.seed).toBe(v)
      expect(tex(body, { x: k })).toBe(v)
      // Slips: the square forgotten, a negative squared to a negative, the constant's sign lost.
      for (const s of [a * k + c, -a * k * k + c, a * k * k - c]) expect(v, `${b.seed}: ${s}`).not.toBe(s)
      expect([a, Math.abs(c), Math.abs(k)]).not.toContain(Math.abs(v))
      expect(Math.abs(c)).not.toBe(Math.abs(k))
      if (a !== 1) expect([Math.abs(c), Math.abs(k)]).not.toContain(a)
      const chain = /^\$[fgh]\((-?\d+)\) = ([^$]+)\$: (.+)\.$/.exec(b.question.solution)
      expect(chain, b.question.solution).not.toBeNull()
      expect(Number(chain![1])).toBe(k)
      chainHolds(chain![2]!, v)
      expect(chain![3]).toBe(`${a === 1 ? 'square the input' : `square the input, multiply by $${a}$`}, then ${c < 0 ? 'subtract' : 'add'} $${Math.abs(c)}$`)
      expect(b.question.solution.startsWith(`$${name}(${k}) = `)).toBe(true)
    }
  })
  it('spreads answers, inputs and names; k = ±1 is rare, a negative k common, a = 1 most often', () => {
    common(built, slot, 30)
    expect(share(built, (b) => Math.abs(read(b).k) === 1)).toBeLessThanOrEqual(0.2)
    const negative = share(built, (b) => read(b).k < 0)
    expect(negative).toBeGreaterThan(0.2)
    expect(negative).toBeLessThan(0.5)
    const one = share(built, (b) => quadraticOf(read(b).body).a === 1)
    expect(one).toBeGreaterThan(0.55)
    expect(one).toBeLessThan(0.8)
    expect(new Set(built.map((b) => read(b).name)).size).toBe(3)
  })
  it('writes the written f(5) for x² − 9 exactly as the written solution does', () => {
    const b = find('fm-function-value-and-inverse', 'q1', (b) => b.question.prompt === slot.prompt)
    expect(b.question.solution).toBe('$f(5) = 5^2 - 9 = 25 - 9 = 16$: square the input, then subtract $9$.')
    expect(answer(b)).toBe(16)
  })
})

describe('fm-function-value-and-inverse q9: where f meets its inverse', () => {
  const built = build('fm-function-value-and-inverse', 'q9')
  const slot = written('fm-function-value-and-inverse', 'q9')
  const read = (b: Generated) => {
    const m = /^\$([fgh])\(x\) = ([^$]+)\$\. /.exec(b.question.prompt)
    expect(m, b.question.prompt).not.toBeNull()
    const { a, b: lin, c } = quadraticOf(m![2]!)
    expect(a).toBe(0)
    return { name: m![1]!, body: m![2]!, a: lin, b: c }
  }
  it('solves f(x) = x, the inverse printed sends it back, and no slip gives it', () => {
    for (const b of built) {
      const { name, body, a, b: k } = read(b)
      const X = answer(b)
      expect(a * X + k, b.seed).toBe(X)
      expect([3, 4, 5, -2, -3]).toContain(a)
      expect(k).not.toBe(0)
      // The root of f, and a printed number.
      expect(X).not.toBe(-k / a)
      // f⁻¹ read as 1/f: f(x)² = 1, so f(x) = ±1. Never X, which is never ±1.
      expect(Math.abs(X)).toBeGreaterThanOrEqual(2)
      for (const t of [1, -1]) expect((t - k) / a, `${b.seed}: f(x) = ${t}`).not.toBe(X)
      expect([Math.abs(a), Math.abs(k)]).not.toContain(Math.abs(X))
      const m = new RegExp(`so solve \\$${name}\\(x\\) = x\\$: \\$([^$]+) = x\\$ gives \\$(-?\\d*)x = (-?\\d+)\\$, so \\$x = (-?\\d+)\\$\\. Check: \\$${name}\\^\\{-1\\}\\(x\\) = ([^$]+)\\$ and \\$${name}\\^\\{-1\\}\\((-?\\d+)\\) = (-?\\d+)\\$\\.$`).exec(b.question.solution)
      expect(m, b.question.solution).not.toBeNull()
      expect(m![1]).toBe(body)
      const K = m![2] === '-' ? -1 : Number(m![2])
      expect(K).toBe(a - 1)
      expect(Number(m![3])).toBe(-k)
      expect(K * X).toBe(-k)
      expect(Number(m![4])).toBe(X)
      // The printed inverse undoes the printed function, and fixes X.
      const inverse = m![5]!
      expect(tex(inverse, { x: X })).toBeCloseTo(X, 9)
      for (const t of [-5, 2, 9]) expect(tex(body, { x: tex(inverse, { x: t }) })).toBeCloseTo(t, 9)
      expect(Number(m![6])).toBe(X)
      expect(Number(m![7])).toBe(X)
    }
  })
  it('spreads answers, both signs of a and both phrasings', () => {
    common(built, slot, 15)
    expect(share(built, (b) => read(b).a < 0)).toBeGreaterThan(0.25)
    expect(share(built, (b) => answer(b) < 0)).toBeGreaterThan(0.3)
    expect(share(built, (b) => b.question.prompt.includes('where the graphs'))).toBeGreaterThan(0.3)
  })
  it('never meets at ±1, where reading f⁻¹ as 1/f pays, over 3000 seeds; so never the written 3x − 2', () => {
    for (const b of build('fm-function-value-and-inverse', 'q9', 3000, 'reciprocal')) {
      const { a, b: k } = read(b)
      const X = answer(b)
      expect([1, -1]).not.toContain(X)
      // Solving f(x) = 1 and f(x) = −1 from the printed coefficients.
      expect([(1 - k) / a, (-1 - k) / a], b.seed).not.toContain(X)
      expect(b.question.prompt).not.toBe(slot.prompt)
    }
  })
  it('writes 3x − 4 as the written solution is written, with the 2x = 4 step', () => {
    const b = find('fm-function-value-and-inverse', 'q9', (b) => b.question.prompt === '$f(x) = 3x - 4$. Work out the value of $x$ for which $f(x) = f^{-1}(x)$.')
    expect(b.question.solution).toBe('The graphs of $f$ and $f^{-1}$ meet on the line $y = x$, so solve $f(x) = x$: $3x - 4 = x$ gives $2x = 4$, so $x = 2$. Check: $f^{-1}(x) = \\frac{x + 4}{3}$ and $f^{-1}(2) = 2$.')
  })
})

describe('fm-composite-unknown q6: k inside fg(x)', () => {
  const built = build('fm-composite-unknown', 'q6')
  const slot = written('fm-composite-unknown', 'q6')
  const read = (b: Generated) => {
    const m = /^\$([fg])\(x\) = ([^$]+)\$ and \$([fg])\(x\) = x\^2 \+ k\$\. Given that \$([fg])([fg])\(x\) = ([^$]+)\$, work out \$k\$\.$/.exec(b.question.prompt)
    expect(m, b.question.prompt).not.toBeNull()
    expect(m![4]).toBe(m![1])
    expect(m![5]).toBe(m![3])
    const lin = quadraticOf(m![2]!)
    const target = quadraticOf(m![6]!)
    expect(lin.a).toBe(0)
    expect(target.b).toBe(0)
    return { L: m![1]!, linear: m![2]!, target: m![6]!, a: lin.b, b: lin.c, A: target.a, C: target.c }
  }
  it('is (C − b)/a from the printed functions, the composite expands as printed, and no slip gives it', () => {
    for (const b of built) {
      const { L, linear, target, a, b: k0, A, C } = read(b)
      const k = answer(b)
      expect(A, b.seed).toBe(a)
      expect(a * k + k0).toBe(C)
      expect([2, 3, 4, 5]).toContain(a)
      // Slips: k not multiplied, b's sign flipped, b ignored, composed in the wrong order
      // ((ax + b)² + k has constant b² + k), a printed number read off.
      for (const s of [C - k0, (C + k0) / a, C / a, C - k0 * k0]) expect(k, `${b.seed}: ${s}`).not.toBe(s)
      expect([a, Math.abs(k0), Math.abs(C)]).not.toContain(Math.abs(k))
      expect(new Set([a, Math.abs(k0), Math.abs(C)]).size).toBe(3)
      // The composite's printed chain: each link after the function notation equals the target.
      const [chain, cmp, eq, moved, last] = mathOf(b.question.solution)
      const links = chain!.split(' = ')
      expect(links[0]).toBe(`${L}${L === 'f' ? 'g' : 'f'}(x)`)
      for (const x of [-2, 3]) for (const link of links.slice(2)) expect(tex(link, { x, k })).toBe(tex(target, { x }))
      expect(tex(linear, { x: tex('x^2 + k', { x: 3, k }) })).toBe(tex(target, { x: 3 }))
      expect(cmp).toBe(target)
      expect(eq).toBe(`${a}k ${k0 < 0 ? '-' : '+'} ${Math.abs(k0)} = ${C}`)
      expect(moved).toBe(`${a}k = ${C - k0}`)
      expect(last).toBe(`k = ${k}`)
      expect(b.question.markScheme[0]!.description).toBe(`${L}${L === 'f' ? 'g' : 'f'}(x) = ${a}x² + ${a}k ${k0 < 0 ? '-' : '+'} ${Math.abs(k0)}`.replace('-', '−'))
    }
  })
  it('spreads answers, both signs of b and k, and which function is linear', () => {
    common(built, slot, 12)
    expect(share(built, (b) => read(b).L === 'g')).toBeGreaterThan(0.25)
    expect(share(built, (b) => read(b).b < 0)).toBeGreaterThan(0.3)
    expect(share(built, (b) => answer(b) < 0)).toBeGreaterThan(0.3)
  })
  it('never lets the wrong order (ax + b)² + k give k, over 3000 seeds', () => {
    for (const b of build('fm-composite-unknown', 'q6', 3000, 'order')) {
      const { linear, target } = read(b)
      const k = answer(b)
      // The other composite, quadratic of linear, read from the printed functions: its constant
      // at k = 0 is b², so equating it to the printed constant would give k = C − b².
      const wrong = tex(target, { x: 0 }) - tex('x^2 + k', { x: tex(linear, { x: 0 }), k: 0 })
      expect(k, b.seed).not.toBe(wrong)
    }
  })
  it('k = 6 from 2x + 3 and constant 15 is never drawn (the wrong order gives 6 too)', () => {
    for (const b of build('fm-composite-unknown', 'q6', 3000, 'order')) expect(b.question.prompt).not.toMatch(/\$[fg]\(x\) = 2x \+ 3\$ and .* = 2x\^2 \+ 15\$/)
  })
  it('writes the written 2x + 1 and x² + k with the 2k = 6 step', () => {
    const b = find('fm-composite-unknown', 'q6', (b) => b.question.prompt === slot.prompt)
    expect(b.question.solution).toBe('$fg(x) = f(x^2 + k) = 2(x^2 + k) + 1 = 2x^2 + 2k + 1$. Comparing with $2x^2 + 7$: $2k + 1 = 7$, so $2k = 6$ and $k = 3$.')
  })
})

describe('fm-exponential-from-points q8: y = abˣ through two points', () => {
  const built = build('fm-exponential-from-points', 'q8')
  const slot = written('fm-exponential-from-points', 'q8')
  const read = (b: Generated) => {
    const m = /^The curve \$y = ab\^x\$ passes through \$\((\d+), (\d+)\)\$ and \$\((\d+), (\d+)\)\$\. Work out (?:the value of )?\$([ab])\$\.( Give your answer as a decimal\.)?$/.exec(b.question.prompt)
    expect(m, b.question.prompt).not.toBeNull()
    return { x1: Number(m![1]), y1: Number(m![2]), x2: Number(m![3]), y2: Number(m![4]), ask: m![5] as 'a' | 'b' }
  }
  it('fits both printed points, the answer is never a printed coordinate, and every step holds', () => {
    for (const b of built) {
      const { x1, y1, x2, y2, ask } = read(b)
      const v = answer(b)
      // Worked here: b from the ratio of the y values, a from the first point.
      const bb = (y2 / y1) ** (1 / (x2 - x1))
      const aa = y1 / bb ** x1
      expect(ask === 'b' ? bb : aa, b.seed).toBeCloseTo(v, 9)
      expect(aa * bb ** x2).toBeCloseTo(y2, 9)
      expect(Number.isInteger(aa)).toBe(true)
      expect(y2).toBeLessThanOrEqual(300)
      expect([x1, y1, x2, y2]).not.toContain(v)
      expect(new Set([x1, y1, x2, y2]).size).toBe(4)
      expect(aa).not.toBe(bb)
      if (x1 === 0) {
        expect(b.question.solution.startsWith(`At $x = 0$, $y = a = ${y1}$. At $x = ${x2}$, $${y1}b${x2 === 1 ? '' : `^${x2}`} = ${y2}$, so `)).toBe(true)
        expect(b.question.markScheme[0]!.description).toBe(`a = ${y1}`)
        if (x2 === 2) expect(b.question.solution.endsWith(', taking the positive value for a base.')).toBe(true)
      } else {
        expect(x1).toBe(1)
        const m = /^Dividing the second \$y\$ by the first: \$\\dfrac\{(\d+)\}\{(\d+)\} = \\dfrac\{ab\^(\d)\}\{ab\} = (b(?:\^2)?)\$, so (.+)\. Then \$ab = (\d+)\$ gives \$a = (?:\\dfrac\{(\d+)\}\{(\d+)\} = )?(\d+)\$\. Check: at \$x = (\d)\$, \$(\d+) \\times (\d+)\^(\d) = (\d+)\$\.$/.exec(b.question.solution)
        expect(m, b.question.solution).not.toBeNull()
        expect([Number(m![1]), Number(m![2]), Number(m![3])]).toEqual([y2, y1, x2])
        expect(m![4]).toBe(x2 === 2 ? 'b' : 'b^2')
        expect(Number(m![6])).toBe(y1)
        expect(Number(m![9])).toBe(aa)
        expect(Number(m![10])).toBe(x2)
        expect(Number(m![11]) * Number(m![12]) ** Number(m![13])).toBe(Number(m![14]))
        expect(Number(m![14])).toBe(y2)
        if (ask === 'a') expect([Number(m![7]), Number(m![8])]).toEqual([y1, bb])
      }
    }
  })
  it('spreads the shapes, asks a sometimes, keeps b = ½ as a decimal about one time in ten', () => {
    common(built, slot, 8, { decimals: true })
    for (const kind of ['zero 1', 'zero 2', 'zero 3', 'ratio b', 'ratio a']) expect(share(built, (b) => b.values.kind === kind), kind).toBeGreaterThan(0.04)
    expect(share(built, (b) => read(b).ask === 'a')).toBeGreaterThan(0.08)
    const decimals = share(built, (b) => !Number.isInteger(answer(b)))
    expect(decimals).toBeGreaterThan(0.03)
    expect(decimals).toBeLessThan(0.2)
    for (const b of built.filter((b) => !Number.isInteger(answer(b)))) {
      expect(answer(b)).toBe(0.5)
      expect(b.question.solution).toContain('= \\tfrac{1}{2} = 0.5$')
      expect(mark(b.question, '1/2').correct).toBe(true)
    }
    expect(share(built, (b) => answer(b) === 2)).toBeLessThanOrEqual(0.3)
  })
  it('spreads the answer within every shape: a printed x = 3 does not mean b = 2', () => {
    const many = build('fm-exponential-from-points', 'q8', 3000, 'shape')
    // Highest share of one answer allowed per shape, and the fewest distinct answers.
    const limits: Record<string, [number, number]> = { 'zero 1': [0.25, 6], 'zero 2': [0.35, 4], 'zero 3': [0.6, 3], 'ratio b': [0.45, 4], 'ratio a': [0.15, 10] }
    for (const [kind, [most, fewest]] of Object.entries(limits)) {
      const these = many.filter((b) => b.values.kind === kind)
      const counts = new Map<number, number>()
      for (const b of these) counts.set(answer(b), (counts.get(answer(b)) ?? 0) + 1)
      expect(Math.max(...counts.values()) / these.length, kind).toBeLessThanOrEqual(most)
      expect(counts.size, kind).toBeGreaterThanOrEqual(fewest)
    }
    // Points at x = 0 and x = 3, read from the prompt: b is 2, 4 or ½, and each turns up.
    const atThree = many.filter((b) => read(b).x1 === 0 && read(b).x2 === 3)
    expect(new Set(atThree.map(answer))).toEqual(new Set([2, 4, 0.5]))
    for (const v of [4, 0.5]) expect(share(atThree, (b) => answer(b) === v), String(v)).toBeGreaterThan(0.15)
    for (const b of atThree) {
      const { y1, y2 } = read(b)
      if (answer(b) === 4) expect([y1, y2]).toEqual([2, 128])
      if (answer(b) === 0.5) expect(y1).toBe(8 * y2)
      if (answer(b) === 2) expect(y1).toBeGreaterThanOrEqual(4)
      expect(y2).not.toBe(3)
    }
  })
  it('writes (0, 16) and (3, 2) with b³ = ⅛ as a decimal', () => {
    const b = find('fm-exponential-from-points', 'q8', (b) => b.question.prompt === 'The curve $y = ab^x$ passes through $(0, 16)$ and $(3, 2)$. Work out $b$. Give your answer as a decimal.')
    expect(b.question.solution).toBe('At $x = 0$, $y = a = 16$. At $x = 3$, $16b^3 = 2$, so $b^3 = \\tfrac{1}{8}$ and $b = \\tfrac{1}{2} = 0.5$.')
    expect(answer(b)).toBe(0.5)
  })
  it('never prints the written (0, 3), (2, 12), whose answer 2 is a printed coordinate, over 1000 builds', () => {
    for (const b of build('fm-exponential-from-points', 'q8', 1000, 'written')) expect(b.question.prompt).not.toContain('$(2, 12)$')
  })
  it('writes (0, 3) and (2, 48) as the written solution is written', () => {
    const b = find('fm-exponential-from-points', 'q8', (b) => b.question.prompt === 'The curve $y = ab^x$ passes through $(0, 3)$ and $(2, 48)$. Work out the value of $b$.')
    expect(b.question.solution).toBe('At $x = 0$, $y = a = 3$. At $x = 2$, $3b^2 = 48$, so $b^2 = 16$ and $b = 4$, taking the positive value for a base.')
    expect(b.question.markScheme.map((l) => l.description)).toEqual(['a = 3', '4'])
  })
})

describe('fm-exponential-from-points q16: y = ab⁻ˣ through two points', () => {
  const built = build('fm-exponential-from-points', 'q16')
  const slot = written('fm-exponential-from-points', 'q16')
  const read = (b: Generated) => {
    const m = /^The curve \$y = ab\^\{-x\}\$ passes through \$\((\d+), (\d+)\)\$ and \$\((\d+), (\d+)\)\$\. Work out (?:the value of )?\$([ab])\$\.$/.exec(b.question.prompt)
    expect(m, b.question.prompt).not.toBeNull()
    return { x1: Number(m![1]), y1: Number(m![2]), x2: Number(m![3]), y2: Number(m![4]), ask: m![5] as 'a' | 'b' }
  }
  it('divides by b each step, every step holds, and no slip gives it', () => {
    for (const b of built) {
      const { x1, y1, x2, y2, ask } = read(b)
      const d = x2 - x1
      const bb = Math.round((y1 / y2) ** (1 / d))
      expect(bb ** d, b.seed).toBe(y1 / y2)
      const aa = y1 * bb ** x1
      expect(aa / bb ** x2).toBe(y2)
      expect(answer(b)).toBe(ask === 'a' ? aa : bb)
      expect([2, 3, 4, 5]).toContain(bb)
      expect([1, 2]).toContain(x1)
      expect([1, 2]).toContain(d)
      expect([x1, y1, x2, y2]).not.toContain(answer(b))
      expect(y2).not.toBe(bb)
      // Slips for a: the first y taken as a, the first y divided by b, and for x₁ = 2 only one b.
      for (const s of [y1, y1 / bb, x1 === 2 ? y1 * bb : NaN]) expect(aa, `${b.seed}: ${s}`).not.toBe(s)
      expect(b.question.solution).toContain(`so $b${d === 1 ? '' : '^2'} = ${bb}$`.replace('b^2 = ', `b^2 = ${bb * bb}$ and $b = `))
      expect(b.question.solution).toContain(`at $x = ${x1}$ gives $a = ${y1} \\times ${bb ** x1} = ${aa}$. Check: at $x = ${x2}$, $\\frac{${aa}}{${bb ** x2}} = ${y2}$.`)
      const frac = /\\frac\{(\d+)\}\{(\d+)\} = (\d+)\$\.$/.exec(b.question.solution)!
      expect(Number(frac[1]) / Number(frac[2])).toBe(Number(frac[3]))
      expect(b.question.markScheme[0]!.description).toBe(ask === 'a' ? `b = ${bb}` : `${y1} ÷ ${y2} = ${bb ** d}`)
    }
  })
  it('spreads b, the gap between the points, which letter is asked and both phrasings', () => {
    common(built, slot, 25)
    expect(new Set(built.map((b) => b.values.b)).size).toBe(4)
    const askB = share(built, (b) => read(b).ask === 'b')
    expect(askB).toBeGreaterThan(0.15)
    expect(askB).toBeLessThan(0.45)
    expect(share(built, (b) => read(b).x2 - read(b).x1 === 2)).toBeGreaterThan(0.15)
    expect(share(built, (b) => read(b).x1 === 2)).toBeGreaterThan(0.08)
    expect(share(built, (b) => / Work out \$[ab]\$\.$/.test(b.question.prompt))).toBeGreaterThan(0.3)
  })
  it('writes the written (1, 20), (2, 10) with its halving and a = 40', () => {
    const b = find('fm-exponential-from-points', 'q16', (b) => b.question.prompt === slot.prompt)
    expect(b.question.solution).toBe('Each step in $x$ divides $y$ by $b$, and $20$ to $10$ is a division by $2$, so $b = 2$. Then $y = \\frac{a}{2}$ at $x = 1$ gives $a = 20 \\times 2 = 40$. Check: at $x = 2$, $\\frac{40}{4} = 10$.')
    expect(b.question.markScheme.map((l) => l.description)).toEqual(['b = 2', '40'])
  })
})

describe('fm-fraction-equation q9: an equation whose squares cancel', () => {
  const built = build('fm-fraction-equation', 'q9')
  const slot = written('fm-fraction-equation', 'q9')
  /** x/(x + u) ± c/(x + v) = 1 read from the prompt, in either order. */
  const read = (b: Generated) => {
    const eq = mathOf(b.question.prompt)[0]!
    const xf = /\\dfrac\{x\}\{x ([+-]) (\d+)\}/.exec(eq)!
    const cf = /(^|[+-]) ?\\dfrac\{(\d+)\}\{x ([+-]) (\d+)\}/.exec(eq)!
    const u = (xf[1] === '-' ? -1 : 1) * Number(xf[2])
    const v = (cf[3] === '-' ? -1 : 1) * Number(cf[4])
    const c = (cf[1] === '-' ? -1 : 1) * Number(cf[2])
    return { eq, u, v, c, swapped: eq.startsWith('\\dfrac{' + cf[2]) }
  }
  it('is u(v − c)/(c − u), makes the printed equation 1, every step holds, and no slip gives it', () => {
    for (const b of built) {
      const { eq, u, v, c, swapped } = read(b)
      const X = answer(b)
      expect(X * (c - u), b.seed).toBe(u * (v - c))
      expect(tex(eq.replace(' = 1', ''), { x: X })).toBeCloseTo(1, 9)
      expect(X + u).not.toBe(0)
      expect(X + v).not.toBe(0)
      expect([Math.abs(u), Math.abs(v), Math.abs(c)]).not.toContain(Math.abs(X))
      expect(Math.abs(c)).toBeGreaterThanOrEqual(2)
      expect([Math.abs(u), Math.abs(v)]).not.toContain(Math.abs(c))
      expect(Math.abs(X)).toBeGreaterThanOrEqual(2)
      if (swapped) expect(c).toBeGreaterThan(0)
      // Slips: the c not multiplied by its bracket; the minus lost.
      expect(X).not.toBe((c - u * v) / u)
      if (c + u !== 0) expect(X).not.toBe((-u * (v + c)) / (c + u))
      const m = /^Combine: \$([^$]+) = 1\$, so \$([^$]+) = ([^$]+)\$\. The \$x\^2\$ terms cancel, leaving (.+)\. Check: \$([^$]+) = 1\$\.$/.exec(b.question.solution)
      expect(m, b.question.solution).not.toBeNull()
      // The combined fraction is the printed left side; both expansions agree at X and at 0.
      for (const x of [X, 0.5]) expect(tex(m![1]!, { x })).toBeCloseTo(tex(eq.replace(' = 1', ''), { x }), 9)
      const left = quadraticOf(m![2]!)
      const right = quadraticOf(m![3]!)
      expect([left.a, right.a]).toEqual([1, 1])
      expect([left.b, left.c, right.b, right.c]).toEqual([v + c, c * u, u + v, u * v])
      const step = /^\$(-?\d*)x = (-?\d+)\$, so \$x = (-?\d+)\$$/.exec(m![4]!) ?? /^\$x = (-?\d+)\$$/.exec(m![4]!)
      expect(step, m![4]).not.toBeNull()
      if (step!.length === 4) {
        const K = step![1] === '-' ? -1 : Number(step![1])
        expect(K).toBe(c - u)
        expect(Number(step![2])).toBe(u * (v - c))
        expect(Number(step![3])).toBe(X)
      } else expect(Number(step![1])).toBe(X)
      for (const stage of m![5]!.split(' = ')) expect(tex(stage), stage).toBeCloseTo(1, 9)
      rawStageHolds(b)
      expect(b.question.markScheme[0]!.description).toBe('clears the denominators')
    }
  })
  /**
   * The check line's first stage is the printed equation at x = X: each fraction's top and
   * bottom put in as they are (negatives kept), in the printed order and with the printed
   * operator, so a subtraction is never shown only after reducing has made it an addition.
   */
  function rawStageHolds(b: Generated) {
    const { eq, u, v, c, swapped } = read(b)
    const X = answer(b)
    const op = /\} ([+-]) \\dfrac/.exec(eq)![1]
    const check = /Check: \$([^$]+) = 1\$\.$/.exec(b.question.solution)![1]!
    const first = check.split(' = ')[0]!
    const m = /^\\frac\{(-?\d+)\}\{(-?\d+)\} ([+-]) \\frac\{(-?\d+)\}\{(-?\d+)\}$/.exec(first)
    expect(m, `${b.seed}: ${first}`).not.toBeNull()
    const printed = [Number(m![1]), Number(m![2]), Number(m![4]), Number(m![5])]
    expect(printed, b.seed).toEqual(swapped ? [c, X + v, X, X + u] : [X, X + u, Math.abs(c), X + v])
    expect(m![3], b.seed).toBe(op)
    expect(tex(first)).toBeCloseTo(1, 9)
  }
  it('prints the raw stage first with the printed operator over 3000 seeds, negative denominators too', () => {
    const many = build('fm-fraction-equation', 'q9', 3000, 'raw')
    for (const b of many) rawStageHolds(b)
    // Builds with a negative denominator at X, which once printed only the reduced fractions.
    expect(share(many, (b) => /\{-\d+\}( [+-]|$)/.test(b.question.solution.split('Check: ')[1]!.split(' = ')[0]!))).toBeGreaterThan(0.3)
  })
  it('writes x/(x − 6) − 2/(x + 8) at x = −15 with the subtraction kept', () => {
    const b = find('fm-fraction-equation', 'q9', (b) => b.question.prompt === 'Solve $\\dfrac{x}{x - 6} - \\dfrac{2}{x + 8} = 1$.')
    expect(answer(b)).toBe(-15)
    expect(b.question.solution.endsWith('Check: $\\frac{-15}{-21} - \\frac{2}{-7} = \\frac{5}{7} + \\frac{2}{7} = 1$.')).toBe(true)
  })
  it('spreads answers, signs and the order of the fractions', () => {
    common(built, slot, 15)
    expect(share(built, (b) => answer(b) < 0)).toBeGreaterThan(0.25)
    expect(share(built, (b) => read(b).swapped)).toBeGreaterThan(0.08)
    const negativeC = share(built, (b) => read(b).c < 0)
    expect(negativeC).toBeGreaterThan(0.35)
    expect(negativeC).toBeLessThan(0.65)
    expect(new Set(built.map((b) => read(b).u)).size).toBeGreaterThanOrEqual(10)
  })
  it('writes the written x/(x − 2) − 3/(x + 2) = 1 exactly as the written solution does', () => {
    const b = find('fm-fraction-equation', 'q9', (b) => b.question.prompt === slot.prompt)
    expect(b.question.solution).toBe('Combine: $\\dfrac{x(x + 2) - 3(x - 2)}{(x - 2)(x + 2)} = 1$, so $x^2 - x + 6 = x^2 - 4$. The $x^2$ terms cancel, leaving $-x = -10$, so $x = 10$. Check: $\\frac{10}{8} - \\frac{3}{12} = \\frac{5}{4} - \\frac{1}{4} = 1$.')
  })
})

describe('fm-difference-of-squares-proof q10: (an + b)² − (an − b)² = 4abn', () => {
  const built = build('fm-difference-of-squares-proof', 'q10')
  const slot = written('fm-difference-of-squares-proof', 'q10')
  const read = (b: Generated) => {
    const m = /^Prove that \$(\((\d*)n ([+-]) (\d+)\)\^2 - \((\d*)n ([+-]) (\d+)\)\^2)\$ is a multiple of \$(\d+)\$ for every integer \$n\$\. What is the value of the expression when \$n = (\d+)\$\?$/.exec(b.question.prompt)
    expect(m, b.question.prompt).not.toBeNull()
    const a = m![2] === '' ? 1 : Number(m![2])
    expect(m![5] === '' ? 1 : Number(m![5])).toBe(a)
    expect(m![7]).toBe(m![4])
    expect(m![6]).not.toBe(m![3])
    return { expression: m![1]!, a, b: Number(m![4]), swapped: m![3] === '-', M: Number(m![8]), N: Number(m![9]) }
  }
  it('is 4ab × n from the printed expression, the multiple is 4ab, every step holds, and no slip gives it', () => {
    for (const b of built) {
      const { expression, a, b: k, swapped, M, N } = read(b)
      const V = answer(b)
      expect(M, b.seed).toBe(4 * a * k)
      expect(V).toBe((swapped ? -1 : 1) * M * N)
      expect(tex(expression, { n: N })).toBe(V)
      for (const n of [-4, 0, 1, 5, 9]) expect(tex(expression, { n }) % M === 0, `${b.seed}: n = ${n}`).toBe(true)
      expect(N).toBeGreaterThanOrEqual(5)
      expect(N).not.toBe(a)
      expect(!(a === 1 && k === 3)).toBe(true)
      expect(a).not.toBe(k)
      // Slips: half the product (2abn), the middle term of (an − b)² missed.
      for (const s of [2 * a * k * N, 2 * a * k * N + 2 * k * k]) expect(Math.abs(V), `${b.seed}: ${s}`).not.toBe(s)
      expect([a, k, M, N]).not.toContain(Math.abs(V))
      const [expand, times, integer, when, value, check] = mathOf(b.question.solution)
      // The expansion line: both sides equal the printed expression at two values of n.
      const [lhs, rhs] = expand!.split(' = ')
      for (const n of [2, -3]) {
        expect(tex(lhs!, { n })).toBe(tex(expression, { n }))
        expect(tex(rhs!, { n })).toBe(tex(expression, { n }))
      }
      expect(rhs).toBe(`${swapped ? '-' : ''}${M}n`)
      expect(times).toBe(String(M))
      expect(integer).toBe(swapped ? '-n' : 'n')
      expect(when).toBe(`n = ${N}`)
      chainHolds(value!, V)
      chainHolds(check!, V)
      expect(check!.startsWith(`${a * N + (swapped ? -k : k)}^2 - ${a * N + (swapped ? k : -k)}^2 = (`)).toBe(true)
      expect(b.question.markScheme[0]!.description).toBe(`expands and simplifies to ${swapped ? '−' : ''}${M}n`)
    }
  })
  it('spreads a, b, n and the order of the brackets; never the core sheet\'s (n + 3)² − (n − 3)²', () => {
    common(built, slot, 40)
    const one = share(built, (b) => read(b).a === 1)
    expect(one).toBeGreaterThan(0.05)
    expect(one).toBeLessThanOrEqual(0.2)
    const swapped = share(built, (b) => read(b).swapped)
    expect(swapped).toBeGreaterThan(0.1)
    expect(swapped).toBeLessThan(0.3)
    expect(new Set(built.map((b) => read(b).N)).size).toBeGreaterThanOrEqual(9)
    expect(new Set(built.map((b) => read(b).b)).size).toBe(5)
    for (const b of built) expect(b.question.prompt).not.toMatch(/\(n \+ 3\)\^2 - \(n - 3\)\^2|\(n \+ 5\)\^2 - \(n \+ 3\)\^2/)
  })
  it('writes the written (3n + 1)² − (3n − 1)² with the factorised check', () => {
    const b = find('fm-difference-of-squares-proof', 'q10', (b) => b.question.prompt === slot.prompt)
    expect(b.question.solution).toBe('$(9n^2 + 6n + 1) - (9n^2 - 6n + 1) = 12n$, which is $12$ times the integer $n$. When $n = 7$ it is $12 \\times 7 = 84$. Check: $22^2 - 20^2 = (22 + 20)(22 - 20) = 42 \\times 2 = 84$.')
    expect(b.question.markScheme.map((l) => l.description)).toEqual(['expands and simplifies to 12n', '84'])
  })
})

describe('every draw succeeds', () => {
  it('over 3000 seeds per slot', () => {
    const slots: [string, string][] = [
      ['fm-function-value-and-inverse', 'q1'], ['fm-function-value-and-inverse', 'q9'], ['fm-composite-unknown', 'q6'],
      ['fm-exponential-from-points', 'q8'], ['fm-exponential-from-points', 'q16'], ['fm-fraction-equation', 'q9'], ['fm-difference-of-squares-proof', 'q10'],
    ]
    for (const [id, slot] of slots) {
      const all = build(id, slot, 3000, 'many')
      expect(all.every((b) => b.check.agrees), `${id} ${slot}`).toBe(true)
    }
  }, 120_000)
})
