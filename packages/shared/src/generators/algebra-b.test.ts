import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../content/questions.ts'
import { mark } from '../marking.ts'
import { GENERATORS, generate, sheetQuestions } from './index.ts'
import { sum } from './maths/formulae.ts'
import type { Generated } from './types.ts'

/**
 * Structural checks for the algebra generators: formulae, rearranging, straight lines,
 * parallel and perpendicular lines, circles, sequences, simultaneous equations, inequalities,
 * functions and iteration.
 *
 * The release check proves the marker accepts every accepted answer; it cannot see an
 * accepted answer that is wrong (11 wrong factorisations shipped that way). So every
 * accepted form here is read with its own small parser, written separately from the
 * generators', and checked against the question as printed: a rearrangement by putting
 * numbers back into the original formula, a line by the points the question names, an nth
 * term by the terms the question prints.
 */
const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')
const raw = (topicId: string) => JSON.parse(readFileSync(join(ROOT, 'maths', `${topicId}.json`), 'utf8'))
const bank = (topicId: string) => Question.array().parse(raw(topicId).questions)
const N = 200

function build(topicId: string, slotId: string, n = N): Generated[] {
  const g = GENERATORS.find((x) => x.topicId === topicId && x.replaces.includes(slotId))
  if (!g) throw new Error(`no generator for ${topicId} ${slotId}`)
  const slot = bank(topicId).find((q) => q.id === slotId)!
  return Array.from({ length: n }, (_, i) => generate(g, slot, `algebra-${i}`))
}
const accepted = (b: Generated) => {
  if (b.question.type !== 'short-text') throw new Error('not short-text')
  return b.question.accepted
}
const answer = (b: Generated) => {
  if (b.question.type !== 'numeric') throw new Error('not numeric')
  return b.question.answer
}
const close = (a: number, b: number, eps = 1e-7) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b))

/* ---------------------------------------------------------------------------------------------
 * An independent reader for typed answers and for formulas taken from the printed prompt.
 * ------------------------------------------------------------------------------------------- */

/** Reads a typed expression: numbers, single letters, π, sqrt( ), cbrt( ), ^, implicit ×. 1/2x is (1/2)x. */
function evalTyped(src: string, vars: Record<string, number>): number {
  const s = src.replace(/\s+/g, '').replace(/−/g, '-')
  let i = 0
  const fail = (): never => {
    throw new Error(`cannot read "${src}" at ${i}`)
  }
  const atom = (): number => {
    if (s.startsWith('sqrt(', i) || s.startsWith('cbrt(', i)) {
      const cube = s[i] === 'c'
      i += 4
      const v = atom()
      return cube ? Math.cbrt(v) : Math.sqrt(v)
    }
    if (s[i] === '(') {
      i++
      const v = expr()
      if (s[i++] !== ')') fail()
      return v
    }
    if (s[i] === 'π') {
      i++
      return Math.PI
    }
    const num = /^\d+(\.\d+)?/.exec(s.slice(i))
    if (num) {
      i += num[0].length
      return Number(num[0])
    }
    if (/[a-z]/i.test(s[i] ?? '')) {
      const name = s[i++]!
      if (!(name in vars)) throw new Error(`no value for ${name} in "${src}"`)
      return vars[name]!
    }
    return fail()
  }
  const power = (): number => {
    const b = atom()
    if (s[i] !== '^') return b
    i++
    return b ** unary()
  }
  const unary = (): number => (s[i] === '-' ? (i++, -unary()) : power())
  const starts = () => /[\d(a-zπ]/i.test(s[i] ?? '')
  const term = (): number => {
    let v = unary()
    for (;;) {
      if (s[i] === '*') (i++, (v *= unary()))
      else if (s[i] === '/') (i++, (v /= unary()))
      else if (starts()) v *= power()
      else return v
    }
  }
  const expr = (): number => {
    let v = term()
    while (s[i] === '+' || s[i] === '-') v = s[i++] === '+' ? v + term() : v - term()
    return v
  }
  const v = expr()
  if (i !== s.length) fail()
  return v
}

const RELATION = /(<=|>=|⩽|⩾|≤|≥|<|>|=)/
/** The parts and relations of a typed statement: "-8 <= x < -4" is three parts and two relations. */
function statement(src: string): { parts: string[]; rels: string[] } {
  const bits = src.split(RELATION)
  return { parts: bits.filter((_, k) => k % 2 === 0), rels: bits.filter((_, k) => k % 2 === 1) }
}
const holds = (l: number, rel: string, r: number) =>
  rel === '=' ? close(l, r) : rel === '<' ? l < r : rel === '>' ? l > r : ['<=', '⩽', '≤'].includes(rel) ? l <= r : l >= r
/** Whether a typed statement is true at the values: every relation in a chain must hold. */
function truth(src: string, vars: Record<string, number>): boolean {
  const { parts, rels } = statement(src)
  const values = parts.map((p) => evalTyped(p, vars))
  return rels.every((rel, k) => holds(values[k]!, rel, values[k + 1]!))
}
/** Left minus right of a typed equation. */
function gap(src: string, vars: Record<string, number>): number {
  const { parts, rels } = statement(src)
  if (rels.length !== 1 || rels[0] !== '=') throw new Error(`not an equation: ${src}`)
  return evalTyped(parts[0]!, vars) - evalTyped(parts[1]!, vars)
}

/** Reads a brace group starting at s[i] === '{', returning its contents and the index after it. */
function group(s: string, i: number): [string, number] {
  let depth = 0
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') depth++
    else if (s[j] === '}' && --depth === 0) return [s.slice(i + 1, j), j + 1]
  }
  throw new Error(`unclosed group in ${s}`)
}
/** A TeX formula from a prompt as typed text: \dfrac{a}{b} to ((a)/(b)), \sqrt{a} to sqrt(a), ^{n} to ^(n). */
function typedFromTex(tex: string): string {
  let s = tex.replace(/\\left|\\right/g, '').replace(/\\[dt]?frac/g, '\\frac')
  let out = ''
  let i = 0
  while (i < s.length) {
    if (s.startsWith('\\frac', i)) {
      const [a, j] = group(s, i + 5)
      const [b, k] = group(s, j)
      out += `((${typedFromTex(a)})/(${typedFromTex(b)}))`
      i = k
    } else if (s.startsWith('\\sqrt[3]', i)) {
      const [a, j] = group(s, i + 8)
      out += `cbrt(${typedFromTex(a)})`
      i = j
    } else if (s.startsWith('\\sqrt', i)) {
      const [a, j] = group(s, i + 5)
      out += `sqrt(${typedFromTex(a)})`
      i = j
    } else if (s.startsWith('^{', i)) {
      const [a, j] = group(s, i + 1)
      out += `^(${typedFromTex(a)})`
      i = j
    } else if (s.startsWith('\\pi', i)) {
      out += 'π'
      i += 3
    } else if (s.startsWith('\\times', i)) {
      out += '*'
      i += 6
    } else if (s.startsWith('\\leqslant', i)) {
      out += '<='
      i += 9
    } else if (s.startsWith('\\geqslant', i)) {
      out += '>='
      i += 9
    } else if (s.startsWith('\\equiv', i)) {
      out += '='
      i += 6
    } else {
      out += s[i]
      i++
    }
  }
  s = out
  return s
}
/** The maths spans of a prompt, in order. */
const maths = (prompt: string) => [...prompt.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]!)
const points = (text: string) => [...text.matchAll(/\((-?\d+), (-?\d+)\)/g)].map((m) => [Number(m[1]), Number(m[2])] as [number, number])

/* ---------------------------------------------------------------------------------------------
 * Rearranging and identities
 * ------------------------------------------------------------------------------------------- */

/** Values for the other letters, wide enough that a wrong rearrangement cannot pass by luck. */
const VALUE_SETS = [
  [2.3, 0.7, 1.9, 3.1, 0.45],
  [5.5, 1.3, 0.6, 2.2, 1.7],
  [9.1, 2.6, 0.35, 0.8, 4.4],
  [3.7, 0.9, 2.8, 1.15, 0.55],
  [12.5, 0.4, 1.1, 0.75, 2.9],
]

describe('rearranged formulae', () => {
  const SLOTS = ['q2', 'q3', 'q5', 'q7', 'q8', 'q11', 'q14', 'q15']

  it('every accepted form, given numbers, makes the original formula true', () => {
    for (const slot of SLOTS) {
      for (const b of build('identities-and-rearranging-formulae', slot)) {
        const [subject, formula] = maths(b.question.prompt)
        const original = typedFromTex(formula!)
        const letters = [...new Set(original.replace(/sqrt|cbrt/g, '').match(/[a-z]/g) ?? [])].filter((l) => l !== subject)
        for (const form of accepted(b)) {
          const rhs = form.includes('=') ? form.split('=') : [subject!, form]
          expect(rhs[0], `${b.seed} ${form}`).toBe(subject)
          let defined = 0
          for (const set of VALUE_SETS) {
            const vars: Record<string, number> = Object.fromEntries(letters.map((l, k) => [l, set[k % set.length]!]))
            const value = evalTyped(rhs[1]!, vars)
            if (!Number.isFinite(value) || (/sqrt/.test(rhs[1]!) && value <= 0)) continue
            defined++
            expect(close(gap(original, { ...vars, [subject!]: value }), 0, 1e-7), `${b.seed}: ${form} in ${original} at ${JSON.stringify(vars)}`).toBe(true)
          }
          expect(defined, `${b.seed}: ${form} was never defined`).toBeGreaterThanOrEqual(2)
        }
      }
    }
  })

  it('a wrong rearrangement fails the same test, so the test can fail', () => {
    // v = u + at made into t = (v + u)/a: the sign slip students make.
    const vars = { u: 2.3, a: 0.7 }
    const t = evalTyped('(v+u)/a'.replace('v', '9.1'), vars)
    expect(close(gap('v=u+at', { ...vars, v: 9.1, t }), 0)).toBe(false)
  })

  it('the marker takes the same answer typed another way', () => {
    for (const b of build('identities-and-rearranging-formulae', 'q11', 50)) {
      const [first] = accepted(b)
      const [subject, rhs] = first!.split('=')
      // Without the subject, and with spaces round the operators.
      expect(mark(b.question, rhs!).correct, b.seed).toBe(true)
      expect(mark(b.question, `${subject} = ${rhs!.replace(/([-+])/g, ' $1 ')}`).correct, b.seed).toBe(true)
    }
  })

  it('identities: the accepted left side, a and b, p and q make both sides equal for every x', () => {
    for (const b of build('identities-and-rearranging-formulae', 'q4')) {
      const [statementTex] = maths(b.question.prompt)
      const [left] = typedFromTex(statementTex!).split('=')
      for (const form of accepted(b)) for (const x of [-3, 0.5, 2, 7]) expect(close(evalTyped(left!, { x }), evalTyped(form, { x })), `${b.seed} ${form}`).toBe(true)
    }
    for (const [slot, names] of [['q6', ['a', 'b']], ['q12', ['p', 'q']]] as const) {
      for (const b of build('identities-and-rearranging-formulae', slot)) {
        const identity = typedFromTex(maths(b.question.prompt)[0]!)
        const first = accepted(b)[0]!
        const values = Object.fromEntries(first.split(',').map((kv) => [kv.split('=')[0]!, Number(kv.split('=')[1])]))
        expect(Object.keys(values).sort(), b.seed).toEqual([...names])
        for (const x of [-2, 0, 1.5, 4]) expect(close(gap(identity, { ...values, x }), 0), `${b.seed} ${identity} ${first}`).toBe(true)
        // Every other accepted form names the same two numbers.
        for (const form of accepted(b)) {
          const nums = form.match(/-?\d+/g)!.map(Number)
          expect(new Set(nums), `${b.seed} ${form}`).toEqual(new Set(Object.values(values)))
        }
      }
    }
  })

  it('the pendulum and the circle radius come back out of the original formula', () => {
    for (const b of build('identities-and-rearranging-formulae', 'q18')) {
      const [, T, g] = b.question.prompt.match(/T = ([\d.]+)\$ and \$g = ([\d.]+)/)!
      const back = 2 * Math.PI * Math.sqrt(answer(b) / Number(g))
      expect(Math.abs(back - Number(T)) / Number(T), b.seed).toBeLessThan(0.003)
    }
    for (const b of build('identities-and-rearranging-formulae', 'q9')) {
      const A = Number(b.question.prompt.match(/area of a circle is \$(\d+)\$/)![1])
      // 3 s.f. moves r by up to 0.5%, and the area by twice that.
      expect(Math.abs(Math.PI * answer(b) ** 2 - A) / A, b.seed).toBeLessThan(0.011)
    }
  })
})

describe('substituting into formulae', () => {
  it('q1 and q3 on the core sheet ask a sum of positives and then a negative taken away', () => {
    for (const b of build('substituting-into-formulae', 'q1')) expect(b.values.kind).toBe('positive')
    for (const b of build('substituting-into-formulae', 'q3')) {
      expect(b.values.kind).toBe('subtract a negative')
      expect(b.question.prompt).toMatch(/ - /)
      expect(b.question.prompt).toMatch(/= -\d/)
    }
  })

  it('q10 finds a and t, and the answer puts v back', () => {
    const builds = build('substituting-into-formulae', 'q10')
    expect(new Set(builds.map((b) => b.values.find))).toEqual(new Set(['a', 't']))
    for (const b of builds) {
      const v = (k: string) => Number(b.values[k])
      expect(v('u') + v('a') * v('t')).toBe(v('v'))
      expect(answer(b)).toBe(v(String(b.values.find)))
    }
  })

  it('q14 rejects a negative root, and the positive one satisfies the formula', () => {
    for (const b of build('substituting-into-formulae', 'q14')) {
      const n = answer(b)
      const k = Number(b.values.k)
      expect(n).toBeGreaterThan(0)
      const value = b.values.kind === 'diagonals' || b.values.kind === 'handshakes' ? (n * (n + k)) / 2 : n * (n + k)
      expect(value, b.seed).toBe(Number(b.values.target))
      expect(b.question.solution).toMatch(/cannot/)
    }
  })

  it('Heron: the answer is the area, worked from coordinates', () => {
    for (const b of build('substituting-into-formulae', 'q22')) {
      const [a, c, d] = (b.question.prompt.match(/sides (\d+) cm, (\d+) cm and (\d+) cm/)!.slice(1)).map(Number) as [number, number, number]
      const x = (a * a + d * d - c * c) / (2 * d)
      expect(close((d * Math.sqrt(a * a - x * x)) / 2, answer(b)), b.seed).toBe(true)
    }
  })
})

/* ---------------------------------------------------------------------------------------------
 * Lines
 * ------------------------------------------------------------------------------------------- */

/** y on a typed line at x: the equation is linear in y. */
function yAt(form: string, x: number): number {
  const f0 = gap(form, { x, y: 0 })
  const f1 = gap(form, { x, y: 1 })
  return -f0 / (f1 - f0)
}
const gradient = (form: string) => yAt(form, 1) - yAt(form, 0)
/** Two typed lines are the same line: two points of one lie on the other, and a point off it does not. */
function sameLine(a: string, b: string): boolean {
  const on = [-3, 2].every((x) => close(gap(b, { x, y: yAt(a, x) }), 0))
  const off = !close(gap(b, { x: 1, y: yAt(a, 1) + 1 }), 0)
  return on && off
}
/** The first maths span of a prompt that is a line in x and y. */
const lineInPrompt = (prompt: string) => typedFromTex(maths(prompt).find((m) => /=/.test(m) && /x/.test(m) && /y/.test(m))!)

describe('straight lines', () => {
  it('every accepted form of a line is the same line as the first', () => {
    const slots: [string, string][] = [
      ['equations-of-straight-lines', 'q4'], ['equations-of-straight-lines', 'q5'], ['equations-of-straight-lines', 'q6'],
      ['equations-of-straight-lines', 'q8'], ['equations-of-straight-lines', 'q10'],
      ['parallel-and-perpendicular-lines', 'q4'], ['parallel-and-perpendicular-lines', 'q5'], ['parallel-and-perpendicular-lines', 'q9'],
      ['parallel-and-perpendicular-lines', 'q13'], ['parallel-and-perpendicular-lines', 'q15'], ['parallel-and-perpendicular-lines', 'q16'],
    ]
    let forms = 0
    for (const [topic, slot] of slots)
      for (const b of build(topic, slot))
        for (const form of accepted(b)) {
          forms++
          expect(sameLine(accepted(b)[0]!, form), `${topic} ${slot} ${b.seed}: ${form} against ${accepted(b)[0]}`).toBe(true)
        }
    // The scan read something: a check that matches nothing passes by default.
    expect(forms).toBeGreaterThan(5000)
  })

  it('the given points lie on the line, and it has the gradient the question gives', () => {
    for (const slot of ['q6', 'q10']) {
      for (const b of build('equations-of-straight-lines', slot)) {
        const ps = points(b.question.prompt)
        expect(ps).toHaveLength(2)
        for (const [x, y] of ps) expect(close(gap(accepted(b)[0]!, { x, y }), 0), `${slot} ${b.seed}`).toBe(true)
      }
    }
    for (const b of build('equations-of-straight-lines', 'q5')) {
      const [[x, y]] = points(b.question.prompt) as [[number, number]]
      const m = b.question.prompt.match(/gradient \$(-?)\\tfrac\{(\d+)\}\{(\d+)\}\$/)!
      const given = (m[1] ? -1 : 1) * (Number(m[2]) / Number(m[3]))
      expect(close(gap(accepted(b)[0]!, { x, y }), 0), b.seed).toBe(true)
      expect(close(gradient(accepted(b)[0]!), given), b.seed).toBe(true)
    }
    for (const b of build('equations-of-straight-lines', 'q4')) {
      const m = Number(b.question.prompt.match(/gradient \$(-?\d+)\$/)![1])
      const [[, c]] = points(b.question.prompt) as [[number, number]]
      expect(close(yAt(accepted(b)[0]!, 0), c) && close(gradient(accepted(b)[0]!), m), b.seed).toBe(true)
    }
    for (const b of build('equations-of-straight-lines', 'q8')) expect(sameLine(accepted(b)[0]!, typedFromTex(maths(b.question.prompt)[0]!)), b.seed).toBe(true)
  })

  it('an answer asked for as ax + by + c = 0 has whole numbers and nothing on the right', () => {
    for (const [topic, slot] of [['equations-of-straight-lines', 'q10'], ['parallel-and-perpendicular-lines', 'q15']] as const)
      for (const b of build(topic, slot)) for (const form of accepted(b)) expect(form, b.seed).toMatch(/^[-\dxy+]+=0$/)
  })

  it('gradients, intercepts, midpoints and areas read back from the prompt', () => {
    for (const b of build('equations-of-straight-lines', 'q1')) expect(close(gradient(lineInPrompt(b.question.prompt)), answer(b)), b.seed).toBe(true)
    for (const b of build('equations-of-straight-lines', 'q2')) {
      const c = yAt(lineInPrompt(b.question.prompt), 0)
      expect(accepted(b)[0], b.seed).toBe(`(0,${c})`)
    }
    for (const b of build('equations-of-straight-lines', 'q3')) {
      const [[x1, y1], [x2, y2]] = points(b.question.prompt) as [[number, number], [number, number]]
      expect((y2 - y1) / (x2 - x1)).toBe(answer(b))
    }
    for (const b of build('equations-of-straight-lines', 'q15')) {
      const [[x1, y1], [x2, y2]] = points(b.question.prompt) as [[number, number], [number, number]]
      expect(accepted(b)[0]).toBe(`(${(x1 + x2) / 2},${(y1 + y2) / 2})`)
    }
    for (const b of build('equations-of-straight-lines', 'q9')) {
      const line = lineInPrompt(b.question.prompt)
      const X = -gap(line, { x: 0, y: 0 }) / (gap(line, { x: 1, y: 0 }) - gap(line, { x: 0, y: 0 }))
      expect(close(Math.abs(X * yAt(line, 0)) / 2, answer(b)), b.seed).toBe(true)
    }
    for (const b of build('equations-of-straight-lines', 'q11')) {
      const line = lineInPrompt(b.question.prompt)
      const k = answer(b)
      const point = b.question.prompt.match(/\$\((-?\d*k), (-?\d*k)\)\$/)!
      const at = (s: string) => evalTyped(s, { k })
      expect(close(gap(line, { x: at(point[1]!), y: at(point[2]!) }), 0), b.seed).toBe(true)
    }
  })
})

describe('parallel and perpendicular lines', () => {
  it('perpendicular gradients multiply to −1', () => {
    for (const b of build('parallel-and-perpendicular-lines', 'q2')) {
      const m = b.question.prompt.match(/gradient \$([^$]+)\$/)![1]!.replace(/\\tfrac\{(\d+)\}\{(\d+)\}/, '($1/$2)')
      expect(close(evalTyped(m, {}) * answer(b), -1), b.seed).toBe(true)
    }
    for (const b of build('parallel-and-perpendicular-lines', 'q3')) expect(close(gradient(lineInPrompt(b.question.prompt)) * answer(b), -1), b.seed).toBe(true)
    for (const slot of ['q5', 'q15', 'q16', 'q13']) {
      for (const b of build('parallel-and-perpendicular-lines', slot)) {
        expect(close(gradient(lineInPrompt(b.question.prompt)) * gradient(accepted(b)[0]!), -1), `${slot} ${b.seed}`).toBe(true)
      }
    }
    for (const b of build('parallel-and-perpendicular-lines', 'q12')) {
      const [given, other] = maths(b.question.prompt)
      const withK = typedFromTex(given!).replace('k', `(${answer(b)})`)
      expect(close(gradient(withK) * gradient(typedFromTex(other!)), -1), b.seed).toBe(true)
    }
  })

  it('a parallel line keeps the gradient, and every line goes through the point it should', () => {
    for (const b of build('parallel-and-perpendicular-lines', 'q4')) {
      expect(close(gradient(lineInPrompt(b.question.prompt)), gradient(accepted(b)[0]!)), b.seed).toBe(true)
      expect(sameLine(lineInPrompt(b.question.prompt), accepted(b)[0]!), b.seed).toBe(false)
    }
    for (const slot of ['q4', 'q5', 'q15', 'q16']) {
      for (const b of build('parallel-and-perpendicular-lines', slot)) {
        const [x, y] = points(b.question.prompt).at(-1)!
        expect(close(gap(accepted(b)[0]!, { x, y }), 0), `${slot} ${b.seed}`).toBe(true)
      }
    }
    for (const b of build('parallel-and-perpendicular-lines', 'q7')) {
      const given = typedFromTex(maths(b.question.prompt)[1]!)
      expect(close(gradient(given), answer(b)), b.seed).toBe(true)
    }
  })

  it('every point of a perpendicular bisector is as far from A as from B', () => {
    for (const b of build('parallel-and-perpendicular-lines', 'q9')) {
      const [[ax, ay], [bx, by]] = points(b.question.prompt) as [[number, number], [number, number]]
      for (const form of accepted(b))
        for (const x of [-5, 0, 3, 9]) {
          const y = yAt(form, x)
          expect(close(Math.hypot(x - ax, y - ay), Math.hypot(x - bx, y - by)), `${b.seed} ${form}`).toBe(true)
        }
    }
  })

  it('the fourth corner makes a rectangle', () => {
    for (const b of build('parallel-and-perpendicular-lines', 'q14')) {
      const [A, B, C] = points(b.question.prompt) as [number, number][]
      const D = accepted(b)[0]!.slice(1, -1).split(',').map(Number) as [number, number]
      const corners = [A!, B!, C!, D]
      for (let k = 0; k < 4; k++) {
        const [p, q, s] = [corners[(k + 3) % 4]!, corners[k]!, corners[(k + 1) % 4]!]
        expect((p[0] - q[0]) * (s[0] - q[0]) + (p[1] - q[1]) * (s[1] - q[1]), b.seed).toBe(0)
      }
    }
  })
})

describe('circles', () => {
  it('yes means on the circle, and the point found is on it', () => {
    const answers = new Set<string>()
    for (const b of build('equation-of-a-circle', 'q3')) {
      const [[x, y]] = points(b.question.prompt) as [[number, number]]
      const r2 = Number(b.question.prompt.match(/y\^2 = (\d+)/)![1])
      answers.add(accepted(b)[0]!)
      expect(accepted(b)).toEqual([x * x + y * y === r2 ? 'yes' : 'no'])
    }
    expect(answers).toEqual(new Set(['yes', 'no']))
    for (const b of build('equation-of-a-circle', 'q7')) {
      const r2 = Number(b.question.prompt.match(/y\^2 = (\d+)/)![1])
      const a = Number(b.question.prompt.match(/\((-?\d+), k\)|\(k, (-?\d+)\)/)!.slice(1).find((v) => v !== undefined))
      expect(a * a + answer(b) ** 2, b.seed).toBe(r2)
      expect(answer(b) > 0, b.seed).toBe(b.question.prompt.includes('positive'))
    }
    for (const b of build('equation-of-a-circle', 'q12')) {
      const line = lineInPrompt(b.question.prompt)
      const r2 = Number(b.question.prompt.match(/y\^2 = (\d+)/)![1])
      const [x, y] = accepted(b)[0]!.slice(1, -1).split(',').map(Number) as [number, number]
      expect(x * x + y * y, b.seed).toBe(r2)
      expect(close(gap(line, { x, y }), 0), b.seed).toBe(true)
    }
  })

  it('the gradient of a radius is rise over run from the origin, in every accepted form', () => {
    for (const b of build('equation-of-a-circle', 'q8')) {
      const [[x, y]] = points(b.question.prompt) as [[number, number]]
      for (const form of accepted(b)) expect(close(evalTyped(form, {}), y / x), `${b.seed} ${form}`).toBe(true)
    }
  })
})

/* ---------------------------------------------------------------------------------------------
 * Sequences
 * ------------------------------------------------------------------------------------------- */

describe('sequences', () => {
  const printed = (prompt: string) => prompt.match(/(-?\d+(?:, -?\d+){2,})/)![1]!.split(', ').map(Number)

  it('every accepted nth term regenerates the printed terms', () => {
    for (const slot of ['q1', 'q11']) {
      for (const b of build('linear-quadratic-and-geometric-sequences', slot)) {
        const terms = printed(b.question.prompt)
        for (const form of accepted(b)) expect(terms.map((_, k) => evalTyped(form, { n: k + 1 })), `${slot} ${b.seed} ${form}`).toEqual(terms)
      }
    }
  })

  it('numeric answers read back from the printed rule', () => {
    const rule = (b: Generated) => typedFromTex(maths(b.question.prompt)[0]!)
    for (const b of build('linear-quadratic-and-geometric-sequences', 'q2')) {
      const k = Number(b.question.prompt.match(/the (\d+)(?:st|nd|rd|th) term/)![1])
      expect(evalTyped(rule(b), { n: k })).toBe(answer(b))
    }
    for (const slot of ['q5', 'q14']) {
      for (const b of build('linear-quadratic-and-geometric-sequences', slot)) {
        const T = Number(b.question.prompt.match(/equal to (-?\d+)/)![1])
        expect(evalTyped(rule(b), { n: answer(b) }), b.seed).toBe(T)
        // The first term to reach it: no earlier position gives the value.
        for (let n = 1; n < answer(b); n++) expect(evalTyped(rule(b), { n })).not.toBe(T)
      }
    }
    for (const b of build('linear-quadratic-and-geometric-sequences', 'q16')) {
      const [N, M] = [...b.question.prompt.matchAll(/(\d+)(?:st|nd|rd|th)/g)].map((m) => Number(m[1]))
      expect(evalTyped(rule(b), { n: N! }) - evalTyped(rule(b), { n: M! })).toBe(answer(b))
    }
  })

  it('geometric and Fibonacci-type terms come from the printed start', () => {
    for (const b of build('linear-quadratic-and-geometric-sequences', 'q4')) {
      const terms = printed(b.question.prompt)
      expect(answer(b)).toBe(terms.at(-1)! + terms.at(-2)!)
      for (let k = 2; k < terms.length; k++) expect(terms[k]).toBe(terms[k - 1]! + terms[k - 2]!)
    }
    for (const b of build('linear-quadratic-and-geometric-sequences', 'q7')) {
      const t = printed(b.question.prompt)
      expect(close(t[1]! / t[0]!, answer(b)) && close(t[2]! / t[1]!, answer(b)), b.seed).toBe(true)
    }
    for (const b of build('linear-quadratic-and-geometric-sequences', 'q12')) {
      const [, a, r, n] = b.question.prompt.match(/starts (\d+) and has common ratio (-?\d+)\. What is its (\d+)/)!.map(Number) as number[]
      expect(answer(b)).toBe(a! * r! ** (n! - 1))
      expect(answer(b)).not.toBe(a! * r! ** n!)
    }
    for (const b of build('linear-quadratic-and-geometric-sequences', 'q8')) {
      const start = Number(b.question.prompt.match(/starts (\d+)/)![1])
      const n = Number(b.question.prompt.match(/its (\d+)/)![1])
      expect(answer(b) * Number(b.values.D) ** (n - 1)).toBe(start)
    }
    for (const b of build('linear-quadratic-and-geometric-sequences', 'q6')) {
      if (b.values.given !== 'terms') continue
      const t = printed(b.question.prompt)
      expect(t[2]! - 2 * t[1]! + t[0]!).toBe(2 * answer(b))
    }
  })
})

/* ---------------------------------------------------------------------------------------------
 * Simultaneous equations, inequalities, functions, iteration
 * ------------------------------------------------------------------------------------------- */

describe('simultaneous equations', () => {
  it('the solution satisfies both printed equations, and the answer is the letter asked for', () => {
    for (const slot of ['q3', 'q5', 'q6']) {
      for (const b of build('simultaneous-equations', slot)) {
        const [e1, e2, asked] = maths(b.question.prompt)
        const x = Number(b.values.x)
        const y = Number(b.values.y)
        for (const e of [e1!, e2!]) expect(close(gap(typedFromTex(e), { x, y }), 0), `${slot} ${b.seed} ${e}`).toBe(true)
        expect(answer(b)).toBe(asked === 'y' ? y : x)
      }
    }
  })

  it('q5 has matching signs and subtracts; q6 has opposite signs and adds, as the written sheet did', () => {
    for (const b of build('simultaneous-equations', 'q5')) expect(b.question.solution).toContain('**subtract**')
    for (const b of build('simultaneous-equations', 'q6')) expect(b.question.solution).toContain('**add**')
  })

  it('the shopping prices give both totals in the words', () => {
    const WORD: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }
    for (const b of build('simultaneous-equations', 'q13')) {
      const sentences = [...b.question.prompt.matchAll(/(\w+) [\w ]+? and (\w+) [\w ]+? cost £(\d+(?:\.\d+)?)/g)]
      expect(sentences).toHaveLength(2)
      for (const [, n1, n2, total] of sentences) expect(close(WORD[n1!.toLowerCase()]! * answer(b) + WORD[n2!]! * Number(b.values.Q), Number(total)), b.seed).toBe(true)
    }
  })
})

describe('inequalities', () => {
  const grid = Array.from({ length: 81 }, (_, k) => -20 + k / 2)

  it('every accepted answer has the same solutions as the printed inequality', () => {
    for (const slot of ['q4', 'q5', 'q7', 'q11']) {
      for (const b of build('inequalities-on-a-number-line', slot)) {
        const question = typedFromTex(maths(b.question.prompt)[0]!)
        for (const form of accepted(b)) {
          const wrong = grid.filter((x) => truth(question, { x }) !== truth(form, { x }))
          expect(wrong, `${slot} ${b.seed}: ${form} against ${question}`).toEqual([])
        }
      }
    }
  })

  it('q5 and q11 divide by a negative and turn the symbol round', () => {
    for (const slot of ['q5', 'q11']) for (const b of build('inequalities-on-a-number-line', slot)) expect(b.question.solution).toContain('**reverse**')
  })

  it('integer answers are counted and found by brute force', () => {
    for (const b of build('inequalities-on-a-number-line', 'q8')) {
      const q = typedFromTex(maths(b.question.prompt)[0]!)
      expect(Array.from({ length: 61 }, (_, k) => k - 30).filter((x) => truth(q, { x })).length).toBe(answer(b))
    }
    for (const [slot, largest] of [['q10', true], ['q15', false]] as const) {
      for (const b of build('inequalities-on-a-number-line', slot)) {
        const q = typedFromTex(maths(b.question.prompt)[0]!)
        const ok = Array.from({ length: 121 }, (_, k) => k - 60).filter((x) => truth(q, { x }))
        expect(answer(b), b.seed).toBe(largest ? Math.max(...ok) : Math.min(...ok))
      }
    }
  })
})

describe('functions', () => {
  const body = (b: Generated, k: number) => typedFromTex(maths(b.question.prompt)[k]!).split('=')[1]!

  it('the inverse undoes the function, in every accepted form', () => {
    for (const b of build('functions', 'q9')) {
      const f = body(b, 0)
      for (const form of accepted(b)) for (const x of [-3, 0, 2.5, 10]) expect(close(evalTyped(f, { x: evalTyped(form, { x }) }), x), `${b.seed} ${form}`).toBe(true)
    }
  })

  it('a composite is the inner function put through the outer one', () => {
    for (const b of build('functions', 'q12')) {
      const [linName, quadName] = [maths(b.question.prompt)[0]![0]!, maths(b.question.prompt)[1]![0]!]
      const lin = body(b, 0)
      const quad = body(b, 1)
      expect(maths(b.question.prompt)[2]).toBe(`${quadName}${linName}(x)`)
      for (const form of accepted(b)) for (const x of [-2, 0.5, 3]) expect(close(evalTyped(form, { x }), evalTyped(quad, { x: evalTyped(lin, { x }) })), b.seed).toBe(true)
    }
    for (const b of build('functions', 'q15')) {
      const lin = body(b, 0)
      const quad = body(b, 1)
      const T = Number(b.question.prompt.match(/= (-?\d+)\$, giving/)![1])
      expect(evalTyped(lin, { x: evalTyped(quad, { x: answer(b) }) }), b.seed).toBe(T)
      expect(answer(b)).toBeGreaterThan(0)
    }
    for (const b of build('functions', 'q5')) {
      const T = Number(b.question.prompt.match(/\(x\) = (-?\d+)\$\.$/)![1])
      expect(evalTyped(body(b, 0), { x: answer(b) })).toBe(T)
    }
    for (const b of build('functions', 'q3')) {
      const k = Number(b.question.prompt.match(/\w\((-?\d+)\)\$\.$/)![1])
      expect(String(evalTyped(body(b, 0), { x: k }))).toBe(accepted(b)[0])
    }
  })
})

describe('iteration', () => {
  /** a and b of x_{n+1} = ∛(ax_n + b), and x0, read from the prompt. */
  const cubeRoot = (prompt: string) => {
    const m = prompt.match(/\\sqrt\[3\]\{(\d*)x_n \+ (\d+)\}\$ with \$x_0 = (\d+)\$/)!
    return { a: m[1] === '' ? 1 : Number(m[1]), b: Number(m[2]), x0: Number(m[3]) }
  }

  it('the iteration converges, and its answer satisfies the original equation to 3 d.p.', () => {
    for (const b of build('iteration', 'q12')) {
      const { a, b: c, x0 } = cubeRoot(b.question.prompt)
      let x = x0
      for (let k = 0; k < 60; k++) x = Math.cbrt(a * x + c)
      expect(Math.abs(Math.cbrt(a * x + c) - x)).toBeLessThan(1e-12)
      const f = (t: number) => t ** 3 - a * t - c
      // A sign change across the 3 d.p. interval: the answer is the root to 3 d.p.
      expect(f(answer(b) - 0.0005) < 0 && f(answer(b) + 0.0005) > 0, b.seed).toBe(true)
      expect(Math.round(x * 1000) / 1000).toBe(answer(b))
    }
  })

  it('iterates read from the printed rule', () => {
    for (const [slot, n] of [['q2', 1], ['q16', 2], ['q11', 3]] as const) {
      for (const b of build('iteration', slot)) {
        const m = b.question.prompt.match(/x_n\^2 \+ (\d+)\}\{(\d+)\}\$ with \$x_0 = ([\d.]+)\$/)!
        let x = Number(m[3])
        for (let k = 0; k < n; k++) x = (x * x + Number(m[1])) / Number(m[2])
        expect(Math.abs(x - answer(b)), `${slot} ${b.seed}`).toBeLessThanOrEqual(n === 1 ? 1e-12 : 0.00005)
        // It converges: the root of x² − bx + a = 0 it heads for has |g′| < 1 there.
        const root = (Number(m[2]) - Math.sqrt(Number(m[2]) ** 2 - 4 * Number(m[1]))) / 2
        expect((2 * root) / Number(m[2])).toBeLessThan(1)
      }
    }
    for (const b of build('iteration', 'q5')) {
      const { a, b: c, x0 } = cubeRoot(b.question.prompt)
      expect(Math.abs(Math.cbrt(a * x0 + c) - answer(b))).toBeLessThanOrEqual(0.00005)
    }
  })

  it('what goes inside the cube root makes x³ equal to it exactly when the printed equation holds', () => {
    for (const slot of ['q6', 'q15']) {
      for (const b of build('iteration', slot)) {
        const equation = typedFromTex(maths(b.question.prompt)[0]!)
        for (const form of accepted(b)) for (const x of [-2, 0.5, 1.5, 3]) expect(close(gap(equation, { x }), x ** 3 - evalTyped(form, { x })), `${b.seed} ${form}`).toBe(true)
      }
    }
  })

  it('f at a decimal is worked exactly', () => {
    for (const slot of ['q8', 'q14', 'q4']) {
      for (const b of build('iteration', slot)) {
        const [f, at] = maths(b.question.prompt)
        const x = Number(at!.match(/\((-?[\d.]+)\)/)![1])
        expect(Math.abs(evalTyped(typedFromTex(f!).split('=')[1]!, { x }) - answer(b)), `${slot} ${b.seed}`).toBeLessThan(1e-9)
      }
    }
  })
})

/* ---------------------------------------------------------------------------------------------
 * Printing and sheets
 * ------------------------------------------------------------------------------------------- */

const MINE = ['substituting-into-formulae', 'identities-and-rearranging-formulae', 'equations-of-straight-lines', 'parallel-and-perpendicular-lines', 'equation-of-a-circle', 'linear-quadratic-and-geometric-sequences', 'simultaneous-equations', 'inequalities-on-a-number-line', 'functions', 'iteration']

describe('the term formatter', () => {
  it('never prints + -, 1x, -1x or x^1', () => {
    const coefficients = [-12, -3, -1, 0, 1, 2, 7, 0.5, -0.5]
    let printed = 0
    for (const a of coefficients)
      for (const b of coefficients)
        for (const c of coefficients)
          for (const spaced of [true, false]) {
            const s = sum([[a, 'x^2'], [b, 'x'], [c, '']], spaced)
            printed++
            expect(s).not.toMatch(/\+ ?-|- ?-|\+ ?\+|(?<![\d.])1x|\^1(?!\d)|^\+/)
            expect(s === '0' || !/(^|[^\d.])0[a-z]/.test(s)).toBe(true)
          }
    expect(printed).toBe(coefficients.length ** 3 * 2)
    expect(sum([[1, 'x'], [-1, '']])).toBe('x - 1')
    expect(sum([[-1, 'x'], [3, '']], false)).toBe('-x+3')
    expect(sum([[0, 'x'], [0, '']])).toBe('0')
  })

  it('and no generated question prints them either', () => {
    let read = 0
    for (const g of GENERATORS.filter((x) => MINE.includes(x.topicId))) {
      for (const slotId of g.replaces) {
        for (const b of build(g.topicId, slotId, 60)) {
          const q = b.question
          // a=-1b=6 is a written accepted form for a pair of values, not a term, so those lists are left out.
          const typed = q.type === 'short-text' && g.id !== 'identity-coefficients' ? q.accepted : []
          const text = [q.prompt, q.solution, ...q.markScheme.map((l) => l.description), ...typed].join(' | ')
          read++
          expect(text, `${g.id} ${slotId} ${b.seed}`).not.toMatch(/[+−-] ?[−-]\d|\+ ?\+|(?<![\d.\w])1[a-z](?![a-z])|\^1(?!\d)|\b1\\?[a-z](?=\W)/)
        }
      }
    }
    expect(read).toBeGreaterThan(5000)
  })
})

describe('slots sharing a sheet ask different things', () => {
  const sheet = (topicId: string, level: string, seed: string) => {
    const t = raw(topicId)
    const qs = Question.array().parse(t.questions)
    return sheetQuestions('maths', topicId, t.worksheets[level].questionIds.map((id: string) => qs.find((q) => q.id === id)!), seed)
  }

  it('no two generated questions on one sheet are the same, on every attempt', () => {
    for (let i = 0; i < 40; i++)
      for (const topicId of MINE)
        for (const level of Object.keys(raw(topicId).worksheets)) {
          const generated = sheet(topicId, level, `sheet-${i}`).filter((s) => s.generated)
          const prompts = generated.map((s) => s.question.prompt)
          expect(new Set(prompts).size, `${topicId} ${level}`).toBe(prompts.length)
        }
  })

  it('each slot keeps its own task', () => {
    for (let i = 0; i < 40; i++) {
      const seed = `task-${i}`
      const iter = sheet('iteration', 'advanced', seed)
      const find = (items: ReturnType<typeof sheet>, id: string) => items.find((s) => s.question.id === id)!.question.prompt
      expect(find(iter, 'q11')).toMatch(/\$x_3\$/)
      expect(find(iter, 'q16')).toMatch(/\$x_2\$/)
      const ineq = sheet('inequalities-on-a-number-line', 'advanced', seed)
      expect(find(ineq, 'q15')).toMatch(/smallest/)
      const core = sheet('substituting-into-formulae', 'core', seed)
      expect(core.find((s) => s.question.id === 'q1')!.generated!.values.kind).toBe('positive')
      expect(core.find((s) => s.question.id === 'q3')!.generated!.values.kind).toBe('subtract a negative')
      const sim = sheet('simultaneous-equations', 'higher', seed)
      expect(sim.find((s) => s.question.id === 'q5')!.question.solution).toContain('**subtract**')
      expect(sim.find((s) => s.question.id === 'q6')!.question.solution).toContain('**add**')
    }
  })
})
