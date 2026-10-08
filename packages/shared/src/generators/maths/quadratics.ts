import type { Question } from '../../content/questions.ts'
import { clearOfHalf, fixed, roundTo, show } from '../format.ts'
import { draw, int, pick } from '../random.ts'
import type { Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Check, Draft, Generator } from '../types.ts'

const EFQ = 'expanding-and-factorising-quadratics'
const SIMPLIFY = 'simplifying-and-expanding-expressions'
const SOLVE = 'solving-quadratic-equations'
const INEQ = 'quadratic-inequalities'
const CURVES = 'quadratic-curves'
const ALGFRAC = 'algebraic-fractions'

export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))

// ---------------------------------------------------------------------------------------
// Polynomials: coefficient of v^i at index i, whole numbers throughout.
// ---------------------------------------------------------------------------------------

export type Poly = number[]

export function trim(p: Poly): Poly {
  const out = p.map((c) => (c === 0 ? 0 : c))
  while (out.length > 1 && out[out.length - 1] === 0) out.pop()
  return out.length ? out : [0]
}
export const polyAdd = (p: Poly, q: Poly): Poly => trim(Array.from({ length: Math.max(p.length, q.length) }, (_, i) => (p[i] ?? 0) + (q[i] ?? 0)))
export const polyScale = (p: Poly, k: number): Poly => trim(p.map((c) => c * k))
export const polySub = (p: Poly, q: Poly): Poly => polyAdd(p, polyScale(q, -1))
export function polyMul(p: Poly, q: Poly): Poly {
  const out: number[] = Array(p.length + q.length - 1).fill(0)
  p.forEach((a, i) => q.forEach((b, j) => (out[i + j]! += a * b)))
  return trim(out)
}
export function polyEq(p: Poly, q: Poly): boolean {
  const a = trim(p)
  const b = trim(q)
  return a.length === b.length && a.every((c, i) => Math.abs(c - b[i]!) < 1e-9)
}
export const polyAt = (p: Poly, x: number) => p.reduceRight((acc, c) => acc * x + c, 0)
/** p(n/d) × d^degree, a whole number: zero exactly when n/d is a root. */
export function polyAtRational(p: Poly, n: number, d: number): number {
  const deg = p.length - 1
  return p.reduce((acc, c, i) => acc + c * n ** i * d ** (deg - i), 0)
}

// ---------------------------------------------------------------------------------------
// Printing terms. Never 1x, -1x, x^1 or + -3: algebra-a.test.ts holds every case.
// ---------------------------------------------------------------------------------------

/** One term's size and letter: 3x^2, x, 7. */
function body(size: number, n: number, v: string): string {
  if (n === 0) return String(size)
  const letter = n === 1 ? v : `${v}^${n}`
  return size === 1 ? letter : `${size}${letter}`
}

/** Terms in the order given, uncollected: 2x^2 - 8x + 3x - 12. Spaced for KaTeX, tight for a typed answer. */
export function sumOf(terms: [number, number][], v = 'x', spaced = true): string {
  const live = terms.filter(([c]) => c !== 0)
  if (!live.length) return '0'
  return live
    .map(([c, n], k) => {
      const b = body(Math.abs(c), n, v)
      if (k === 0) return c < 0 ? `-${b}` : b
      return spaced ? ` ${c < 0 ? '-' : '+'} ${b}` : `${c < 0 ? '-' : '+'}${b}`
    })
    .join('')
}

/** A polynomial, highest power first (or lowest, `ascending`): x^2 - 5x - 14, -x + 4, 0. */
export function poly(p: Poly, v = 'x', spaced = true, ascending = false): string {
  const terms = p.map((c, n) => [c, n] as [number, number])
  return sumOf(ascending ? terms : terms.reverse(), v, spaced)
}

/** ax + b, tight, as it sits in a bracket: x+3, 2x-5, -x+4. */
export const lin = (a: number, b: number, v = 'x', spaced = false) => poly([b, a], v, spaced)

/** A number after an operator: 5, (-5). */
const signed = (n: number) => (n < 0 ? `(${n})` : String(n))
/** A number with its sign always shown: +2, -7. */
const plusMinus = (n: number) => (n < 0 ? String(n) : `+${n}`)
/** The sign and size of a constant term on its own: + 2, - 2. */
const constTerm = (n: number) => (n < 0 ? `- ${-n}` : `+ ${n}`)

/**
 * Every way a factorisation is typed, as the written lists give them: the brackets in
 * either order, each bracket either way round, a leading factor kept in front.
 */
export function factorForms(lead: string, factors: [number, number][], v = 'x', spaced = false): string[] {
  const ways = ([a, b]: [number, number]) => [lin(a, b, v, spaced), poly([b, a], v, spaced, true)]
  const out: string[] = []
  if (factors.length === 1) {
    for (const f of ways(factors[0]!)) out.push(`${lead}(${f})`)
  } else {
    const [f, g] = factors as [[number, number], [number, number]]
    for (const [P, Q] of [[f, g], [g, f]] as const) for (const p of ways(P)) for (const q of ways(Q)) out.push(`${lead}(${p})(${q})`)
  }
  return [...new Set(out)]
}

// ---------------------------------------------------------------------------------------
// Reading maths back: the second routes read what the student is shown and what the marker
// accepts, not the numbers the generator drew.
// ---------------------------------------------------------------------------------------

interface Ops<T> {
  num(n: number): T
  letter(v: string): T
  add(a: T, b: T): T
  mul(a: T, b: T): T
  div(a: T, b: T): T
  neg(a: T): T
  pow(a: T, n: number): T
  sqrt(a: T): T
}

/** Reads typed maths: 2(x+3)^2-11, (15-5√2)/7, 5/7√2, 3x(4+x). Implicit multiplication binds like ×. */
export function parseWith<T>(src: string, ops: Ops<T>): T {
  const s = src.replace(/\s+/g, '').replace(/[−–]/g, '-').replace(/sqrt/g, '√').replace(/[×·]/g, '*')
  let i = 0
  const peek = () => s[i] ?? ''
  const fail = (): never => {
    throw new Error(`cannot read "${src}" at ${i}`)
  }
  const starts = () => /[\d.a-z(√]/i.test(peek())
  const atom = (): T => {
    if (peek() === '(') {
      i++
      const v = expr()
      if (s[i++] !== ')') fail()
      return v
    }
    if (peek() === '√') {
      i++
      return ops.sqrt(atom())
    }
    const m = /^\d+(\.\d+)?/.exec(s.slice(i))
    if (m) {
      i += m[0].length
      return ops.num(Number(m[0]))
    }
    if (/[a-z]/i.test(peek())) return ops.letter(s[i++]!)
    return fail()
  }
  const power = (): T => {
    const base = atom()
    if (peek() !== '^') return base
    i++
    const m = /^\(?(\d+)\)?/.exec(s.slice(i))
    if (!m) fail()
    i += m![0].length
    return ops.pow(base, Number(m![1]))
  }
  const unary = (): T => {
    if (peek() === '-') {
      i++
      return ops.neg(unary())
    }
    if (peek() === '+') {
      i++
      return unary()
    }
    return power()
  }
  const term = (): T => {
    let v = unary()
    for (;;) {
      if (peek() === '*') {
        i++
        v = ops.mul(v, unary())
      } else if (peek() === '/') {
        i++
        v = ops.div(v, unary())
      } else if (starts()) v = ops.mul(v, power())
      else return v
    }
  }
  function expr(): T {
    let v = term()
    while (peek() === '+' || peek() === '-') {
      const minus = s[i++] === '-'
      const t = term()
      v = ops.add(v, minus ? ops.neg(t) : t)
    }
    return v
  }
  const v = expr()
  if (i !== s.length) fail()
  return v
}

/** The polynomial a typed expression multiplies out to, in the letter `v`; null when it is not one. */
export function polyOf(src: string, v = 'x'): Poly | null {
  try {
    return parseWith<Poly>(src, {
      num: (n) => [n],
      letter: (l) => {
        if (l !== v) throw new Error(`letter ${l}`)
        return [0, 1]
      },
      add: polyAdd,
      mul: polyMul,
      div: (a, b) => {
        if (trim(b).length !== 1 || b[0] === 0) throw new Error('not a polynomial')
        return polyScale(a, 1 / b[0]!)
      },
      neg: (a) => polyScale(a, -1),
      pow: (a, n) => Array.from({ length: n }).reduce<Poly>((acc) => polyMul(acc, a), [1]),
      sqrt: () => {
        throw new Error('root')
      },
    })
  } catch {
    return null
  }
}

/** The value of typed maths, letters given by `at`; NaN when it cannot be read. */
export function valueOf(src: string, at: Record<string, number> = {}): number {
  try {
    return parseWith<number>(src, {
      num: (n) => n,
      letter: (l) => {
        if (!(l in at)) throw new Error(`letter ${l}`)
        return at[l]!
      },
      add: (a, b) => a + b,
      mul: (a, b) => a * b,
      div: (a, b) => a / b,
      neg: (a) => -a,
      pow: (a, n) => a ** n,
      sqrt: (a) => Math.sqrt(a),
    })
  } catch {
    return NaN
  }
}

/** KaTeX as typed maths: \dfrac{a}{b} to ((a)/(b)), \sqrt{n} to √(n), \times to *, braces to brackets. */
export function fromTex(tex: string): string {
  const s = tex.replace(/\\left|\\right/g, '')
  let i = 0
  const group = (): string => {
    while (s[i] === ' ') i++
    if (s[i] !== '{') return s[i++] ?? ''
    const start = i
    let depth = 0
    for (; i < s.length; i++) {
      if (s[i] === '{') depth++
      else if (s[i] === '}' && --depth === 0) {
        i++
        return s.slice(start + 1, i - 1)
      }
    }
    throw new Error(`unbalanced braces in ${tex}`)
  }
  let out = ''
  while (i < s.length) {
    const rest = s.slice(i)
    const frac = /^\\[dt]?frac/.exec(rest)
    if (frac) {
      i += frac[0].length
      const a = group()
      const b = group()
      out += `((${fromTex(a)})/(${fromTex(b)}))`
    } else if (rest.startsWith('\\sqrt')) {
      i += 5
      out += `√(${fromTex(group())})`
    } else if (rest.startsWith('\\times')) {
      i += 6
      out += '*'
    } else if (rest.startsWith('\\div')) {
      i += 4
      out += '/'
    } else if (s[i] === '{' || s[i] === '}') {
      out += s[i] === '{' ? '(' : ')'
      i++
    } else if (s[i] === '\\') throw new Error(`unknown command in ${tex}`)
    else out += s[i++]
  }
  return out.replace(/\s+/g, '')
}

/** The maths in the kth pair of dollar signs of a prompt. */
export const mathIn = (text: string, k = 0) => [...text.matchAll(/\$([^$]+)\$/g)][k]?.[1] ?? ''

/** Both sides of a printed equation or inequality, and the relation between them. */
export function sides(tex: string): { left: string; right: string; rel: string } {
  const m = /^(.*?)(=|<|>|\\leqslant|\\geqslant)(.*)$/.exec(tex)
  if (!m) throw new Error(`no relation in ${tex}`)
  return { left: fromTex(m[1]!), right: fromTex(m[3]!), rel: m[2]! }
}

/** The left side minus the right side of a printed equation, as a polynomial. */
export function equationPoly(tex: string, v = 'x'): Poly | null {
  const { left, right } = sides(tex)
  const l = polyOf(left, v)
  const r = polyOf(right, v)
  return l && r ? polySub(l, r) : null
}

// ---------------------------------------------------------------------------------------
// Roots as typed answers.
// ---------------------------------------------------------------------------------------

type Rational = [number, number]
const reduce = ([n, d]: Rational): Rational => {
  const g = gcd(n, d) || 1
  return d < 0 ? [-n / g, -d / g] : [n / g, d / g]
}
/** -1/2, 3, as typed. */
export const typedRational = ([n, d]: Rational) => (d === 1 ? String(n) : `${n}/${d}`)
/** -\tfrac{1}{2}, 3, as printed. */
export const texRational = ([n, d]: Rational) => (d === 1 ? String(n) : `${n < 0 ? '-' : ''}\\tfrac{${Math.abs(n)}}{${d}}`)
/** -0.5 for -1/2, when the decimal ends. */
function decimal([n, d]: Rational): string | null {
  let k = d
  while (k % 2 === 0) k /= 2
  while (k % 5 === 0) k /= 5
  return k === 1 ? show(n / d) : null
}

/**
 * Every way two roots are typed, in the order and with the joining words of the written
 * lists: x = A or x = B, A, B, x = A; x = B, either way round, then x = A or B. A root that
 * is a fraction with an ending decimal is listed both ways, -1/2 and -0.5, as q5 does.
 */
export function rootForms(a: Rational, b: Rational, plusOrMinus = false): string[] {
  const fa = typedRational(a)
  const fb = typedRational(b)
  const sets: [string, string][] = [[fa, fb]]
  const da = decimal(a) ?? fa
  const db = decimal(b) ?? fb
  if (da !== fa || db !== fb) sets.push([da, db])
  const out: string[] = []
  for (const [A, B] of sets) for (const [P, Q] of [[A, B], [B, A]]) for (const sep of [' or ', ', ', ' and ', '; ']) out.push(`x = ${P}${sep}x = ${Q}`, `${P}${sep}${Q}`)
  for (const [A, B] of sets) for (const [P, Q] of [[A, B], [B, A]]) out.push(`x = ${P} or ${Q}`, `x = ${P}, ${Q}`)
  if (plusOrMinus) out.push(`x = ±${Math.abs(a[0])}`, `±${Math.abs(a[0])}`)
  return out
}

/** The roots a typed answer gives: "x = -1/2 or x = -3" is [-1/2, -3]; "±3" is [3, -3]. Null when a part is not a number. */
export function rootsIn(typed: string): Rational[] | null {
  const parts = typed.replace(/\s+/g, '').replace(/[a-z]=/g, '').split(/or|and|,|;/).filter(Boolean)
  const out: Rational[] = []
  for (const p of parts) {
    const m = /^(±)?(-?)(\d+)(?:\/(\d+)|\.(\d+))?$/.exec(p)
    if (!m) return null
    const sign = m[2] === '-' ? -1 : 1
    let r: Rational
    if (m[4]) r = [sign * Number(m[3]), Number(m[4])]
    else if (m[5]) r = [sign * Number(`${m[3]}${m[5]}`), 10 ** m[5].length]
    else r = [sign * Number(m[3]), 1]
    r = reduce(r)
    out.push(r)
    if (m[1]) out.push([-r[0], r[1]])
  }
  return out
}

/**
 * Every accepted root list holds exactly two different roots, and each one makes the printed
 * equation true when substituted as an exact fraction.
 */
export function rootsCheck(prompt: string, accepted: string[], expected: Rational[]): Check {
  const f = equationPoly(mathIn(prompt))
  if (!f) return { agrees: false, detail: `cannot read the equation in ${prompt}` }
  const want = new Set(expected.map((r) => typedRational(reduce(r))))
  const bad = accepted.filter((a) => {
    const roots = rootsIn(a)
    if (!roots || roots.length !== 2) return true
    const got = new Set(roots.map(typedRational))
    return got.size !== 2 || [...got].some((g) => !want.has(g)) || roots.some(([n, d]) => polyAtRational(f, n, d) !== 0)
  })
  return { agrees: bad.length === 0 && want.size === 2, detail: bad.length ? `do not solve ${poly(f)} = 0: ${bad.join(' | ')}` : `${accepted.length} forms solve ${poly(f)} = 0` }
}

/**
 * Every accepted form multiplied out, by polynomial arithmetic, gives the polynomial printed in
 * the prompt. `form` also holds the shape: an expanded answer has no brackets; a factorised one
 * is brackets with nothing common left inside any of them.
 */
export function expandsBack(promptTex: string, accepted: string[], v: string, form: 'expanded' | 'factorised' | 'any'): Check {
  const target = polyOf(fromTex(promptTex), v)
  if (!target) return { agrees: false, detail: `cannot read ${promptTex}` }
  const bad = accepted.filter((a) => {
    const p = polyOf(a, v)
    if (!p || !polyEq(p, target)) return true
    if (form === 'expanded') return /[()]/.test(a)
    if (form === 'factorised') return !fullyFactorised(a, v)
    return false
  })
  return { agrees: bad.length === 0, detail: bad.length ? `do not give ${poly(target, v)}: ${bad.join(' | ')}` : `${accepted.length} forms give ${poly(target, v)}` }
}

/** Brackets of first-degree expressions with no common factor inside any of them. */
export function fullyFactorised(a: string, v = 'x'): boolean {
  const brackets = [...a.matchAll(/\(([^()]+)\)/g)].map((m) => m[1]!)
  if (!brackets.length) return false
  return brackets.every((b) => {
    const p = polyOf(b, v)
    return !!p && p.length === 2 && p[1] !== 0 && gcd(p[0]!, p[1]!) === 1
  })
}

// ---------------------------------------------------------------------------------------
// Shared drawing and building.
// ---------------------------------------------------------------------------------------

/** The letter: mostly x, as the written questions use, sometimes another. */
const LETTERS = ['x', 'x', 'x', 'x', 'y', 'a', 'n', 't'] as const
const letter = (r: Rng) => pick(r, LETTERS)
/** A whole number from 1 to `most`, either sign. */
const either = (r: Rng, most: number) => (r() < 0.5 ? -1 : 1) * int(r, 1, most)

interface TextParts {
  prompt: string
  solution: string
  /** Method lines for scheme(), or whole lines where the written scheme is not M…A1. */
  method: string[] | { code: string; marks: number; description: string }[]
  answerTex: string
  accepted: string[]
  check: Check
  values: Draft['values']
}

function textDraft(slot: Question, t: TextParts): Draft {
  const markScheme = t.method.length && typeof t.method[0] !== 'string'
    ? (t.method as { code: string; marks: number; description: string }[])
    : scheme(slot, t.method as string[], t.answerTex)
  return { question: { type: 'short-text', prompt: t.prompt, solution: t.solution, markScheme, accepted: t.accepted }, check: t.check, values: t.values }
}

const $ = (tex: string) => `$${tex}$`

// =======================================================================================
// Expanding and factorising quadratics
// =======================================================================================

/** (x+3)(x+5) as q1, (x-4)^2 as q4 and (2x+3)(x-4) as q9: expand and simplify. */
export const expandingDoubleBrackets: Generator = {
  id: 'expanding-double-brackets',
  subjectId: 'maths',
  topicId: EFQ,
  replaces: ['q1', 'q4', 'q9'],
  build(r, slot): Draft {
    const v = letter(r)
    if (slot.id === 'q4') {
      const a = either(r, 15)
      const f = lin(1, a, v)
      const P = polyMul([a, 1], [a, 1])
      const answer = poly(P, v)
      const prompt = `Expand and simplify $(${f})^2$.`
      return textDraft(slot, {
        prompt,
        solution: `$(${f})^2$ means $(${f})(${f})$: $${sumOf([[1, 2], [a, 1], [a, 1], [a * a, 0]], v)} = ${answer}$. Not $${v}^2 + ${a * a}$: the middle term is the classic slip.`,
        method: [`$(${f})(${f})$ with at least three correct terms`],
        answerTex: $(answer),
        accepted: [poly(P, v, false)],
        check: expandsBack(mathIn(prompt), [poly(P, v, false)], v, 'expanded'),
        values: { kind: 'square', a, v },
      })
    }
    if (slot.id === 'q9') {
      const { p, q, s, t } = draw(
        r,
        (r) => ({ p: int(r, 2, 5), q: either(r, 9), s: pick(r, [1, 1, 1, 2, 3]), t: either(r, 9) }),
        ({ p, q, s, t }) => p * t + q * s !== 0 && gcd(p, q) === 1 && gcd(s, t) === 1 && !(p === s && q === t),
      )
      const first = r() < 0.7
      const [A, B] = first ? [lin(p, q, v), lin(s, t, v)] : [lin(s, t, v), lin(p, q, v)]
      const P = polyMul([q, p], [t, s])
      const answer = poly(P, v)
      const [a1, b1, a2, b2] = first ? [p, q, s, t] : [s, t, p, q]
      const prompt = `Expand and simplify $(${A})(${B})$.`
      return textDraft(slot, {
        prompt,
        solution: `$${sumOf([[a1 * a2, 2], [a1 * b2, 1], [b1 * a2, 1], [b1 * b2, 0]], v)} = ${answer}$.`,
        method: ['three correct terms from four'],
        answerTex: $(answer),
        accepted: [poly(P, v, false)],
        check: expandsBack(mathIn(prompt), [poly(P, v, false)], v, 'expanded'),
        values: { kind: 'coefficient', p, q, s, t, v },
      })
    }
    const { a, b } = draw(
      r,
      (r) => (r() < 0.5 ? { a: int(r, 1, 9), b: int(r, 1, 9) } : { a: either(r, 9), b: either(r, 9) }),
      ({ a, b }) => a !== b && a + b !== 0,
    )
    const P = polyMul([a, 1], [b, 1])
    const answer = poly(P, v)
    const prompt = `Expand and simplify $(${lin(1, a, v)})(${lin(1, b, v)})$.`
    const products = [
      `$${v} \\times ${v} = ${v}^2$`,
      `$${v} \\times ${signed(b)} = ${lin(b, 0, v)}$`,
      `$${a} \\times ${v} = ${lin(a, 0, v)}$`,
      `$${a} \\times ${signed(b)} = ${a * b}$`,
    ]
    return textDraft(slot, {
      prompt,
      solution: `Four products: ${products.join(', ')}. Collect: $${answer}$.`,
      method: ['four correct products, or three of them'],
      answerTex: $(answer),
      accepted: [poly(P, v, false)],
      check: expandsBack(mathIn(prompt), [poly(P, v, false)], v, 'expanded'),
      values: { kind: 'pair', a, b, v },
    })
  },
}

/** Q times (px + q), term by term in the written order: each term of Q times px, then times q. */
const timesBracket = (Q: Poly, p: number, q: number): [number, number][] =>
  Q.map((c, n) => [c, n] as [number, number]).reverse().filter(([c]) => c !== 0).flatMap(([c, n]) => [[c * p, n + 1], [c * q, n]] as [number, number][])

/** (x+1)(x+2)(x+3) as q13 and (x+2)^3 as q16: three brackets, two at a time. */
export const expandingThreeBrackets: Generator = {
  id: 'expanding-three-brackets',
  subjectId: 'maths',
  topicId: EFQ,
  replaces: ['q13', 'q16'],
  build(r, slot): Draft {
    if (slot.id === 'q16') {
      const v = letter(r)
      const { p, q } = draw(
        r,
        (r) => {
          const p = pick(r, [1, 1, 1, 2, 3])
          return { p, q: either(r, p === 1 ? 10 : p === 2 ? 7 : 5) }
        },
        ({ p, q }) => gcd(p, q) === 1,
      )
      const F = lin(p, q, v)
      const Q = polyMul([q, p], [q, p])
      const C = polyMul(Q, [q, p])
      const answer = poly(C, v)
      const prompt = `Expand and simplify $(${F})^3$.`
      return textDraft(slot, {
        prompt,
        solution: `$(${F})^2 = ${poly(Q, v)}$. Then $(${poly(Q, v)})(${F}) = ${sumOf(timesBracket(Q, p, q), v)} = ${answer}$.`,
        method: [$(poly(Q, v)), `multiplied by $(${F})$ with at most one error`],
        answerTex: $(answer),
        accepted: [poly(C, v, false)],
        check: expandsBack(mathIn(prompt), [poly(C, v, false)], v, 'expanded'),
        values: { kind: 'cube', p, q, v },
      })
    }
    const { a, b, c } = draw(
      r,
      (r) => ({ a: either(r, 6), b: either(r, 6), c: either(r, 6) }),
      ({ a, b, c }) => !(a === b && b === c) && polyMul(polyMul([a, 1], [b, 1]), [c, 1]).every((k) => k !== 0) && a + b !== 0,
    )
    const Q = polyMul([a, 1], [b, 1])
    const C = polyMul(Q, [c, 1])
    const answer = poly(C)
    const prompt = `Expand and simplify $(${lin(1, a)})(${lin(1, b)})(${lin(1, c)})$.`
    return textDraft(slot, {
      prompt,
      solution: `Two at a time. $(${lin(1, a)})(${lin(1, b)}) = ${poly(Q)}$. Then $(${poly(Q)})(${lin(1, c)}) = ${sumOf(timesBracket(Q, 1, c))} = ${answer}$.`,
      method: [`$${poly(Q)}$ or another correct pair expanded`, 'multiplied by the third bracket with at most one error'],
      answerTex: $(answer),
      accepted: [poly(C, 'x', false)],
      check: expandsBack(mathIn(prompt), [poly(C, 'x', false)], 'x', 'expanded'),
      values: { kind: 'three', a, b, c },
    })
  },
}

/** px^2 + ... = rx(px + q) + s(px + q) = (px + q)(rx + s): the split, written as q6, q12 and q19 do. */
function splitWorking(p: number, q: number, r: number, s: number, v: string) {
  const F = lin(p, q, v)
  const split = sumOf([[p * r, 2], [q * r, 1], [p * s, 1], [q * s, 0]], v)
  const grouped = `${lin(r, 0, v)}(${F}) ${s < 0 ? '-' : '+'} ${Math.abs(s)}(${F})`
  return { split, grouped, middle: sumOf([[q * r, 1], [p * s, 1]], v) }
}

/**
 * Factorising trinomials: x^2 + 7x + 12 as q2 (all positive), x^2 - 5x - 14 as q5 (a negative
 * term), 2x^2 + 7x + 3 as q6, 2x^2 + 10x + 12 as q11 (a common factor first), and
 * 6x^2 - 7x - 3 and 12x^2 - x - 6 as q12 and q19 (both x-coefficients above 1). q12 and q19
 * share the advanced sheet, so their sign patterns come from `turn`: the two never match.
 */
export const factorisingQuadratics: Generator = {
  id: 'factorising-quadratics',
  subjectId: 'maths',
  topicId: EFQ,
  replaces: ['q2', 'q5', 'q6', 'q11', 'q12', 'q19'],
  build(r, slot, turn): Draft {
    const v = slot.id === 'q2' ? letter(r) : 'x'
    if (slot.id === 'q2' || slot.id === 'q5') {
      const { m, n } = slot.id === 'q2'
        ? draw(r, (r) => ({ m: int(r, 1, 12), n: int(r, 1, 12) }), ({ m, n }) => m < n)
        : draw(r, (r) => ({ m: either(r, 12), n: either(r, 12) }), ({ m, n }) => m !== n && m + n !== 0 && (m < 0 || n < 0))
      const P = polyMul([m, 1], [n, 1])
      const prompt = `Factorise $${poly(P, v)}$.`
      const accepted = factorForms('', [[1, m], [1, n]], v)
      const answer = `(${lin(1, m, v)})(${lin(1, n, v)})`
      const solution = slot.id === 'q2'
        ? `Two numbers that multiply to $${m * n}$ and add to $${m + n}$: $${m}$ and $${n}$. So $${answer}$.`
        : `Multiply to $${m * n}$, add to $${m + n}$: $${plusMinus(m)}$ and $${plusMinus(n)}$. So $${answer}$. Check the middle term: $${sumOf([[n, 1], [m, 1]], v)} = ${lin(m + n, 0, v)}$.`
      return textDraft(slot, {
        prompt,
        solution,
        method: [slot.id === 'q2' ? `a pair of brackets with numbers that multiply to ${m * n} or add to ${m + n}` : `a pair with product $${m * n}$`],
        answerTex: $(answer),
        accepted,
        check: expandsBack(mathIn(prompt), accepted, v, 'factorised'),
        values: { kind: slot.id === 'q2' ? 'positive' : 'negative', m, n, v },
      })
    }
    if (slot.id === 'q11') {
      const { k, m, n } = draw(r, (r) => ({ k: int(r, 2, 5), m: either(r, 9), n: either(r, 9) }), ({ m, n }) => m !== n && m + n !== 0 && (m > 0 || n > 0))
      const inner = polyMul([m, 1], [n, 1])
      const P = polyScale(inner, k)
      const prompt = `Factorise fully $${poly(P)}$.`
      const accepted = factorForms(String(k), [[1, m], [1, n]])
      const answer = `${k}(${lin(1, m)})(${lin(1, n)})`
      return textDraft(slot, {
        prompt,
        solution: `Take out the $${k}$ first: $${k}(${poly(inner)}) = ${answer}$. Forgetting the first step gives $(${lin(k, k * m)})(${lin(1, n)})$, which is not *fully* factorised.`,
        method: [`$${k}(${poly(inner)})$`],
        answerTex: $(answer),
        accepted,
        check: expandsBack(mathIn(prompt), accepted, 'x', 'factorised'),
        values: { kind: 'common factor', k, m, n },
      })
    }
    // (px + q)(rx + s), a = pr above 1.
    const hard = slot.id === 'q12' || slot.id === 'q19'
    // q12 and q19: both terms negative, b positive and c negative, or b negative and c positive.
    const pattern = hard ? turn % 3 : -1
    const f = draw(
      r,
      (r) => (hard
        ? { p: int(r, 2, 5), q: either(r, 7), r: int(r, 2, 4), s: either(r, 7) }
        : { p: int(r, 2, 5), q: int(r, 1, 9), r: pick(r, [1, 1, 1, 2]), s: int(r, 1, 9) }),
      ({ p, q, r: rr, s }) => {
        const b = p * s + q * rr
        const c = q * s
        if (gcd(p, q) !== 1 || gcd(rr, s) !== 1 || (p === rr && q === s) || b === 0 || p * rr > 20 || Math.abs(p * rr * c) > 150) return false
        if (pattern === 0) return b < 0 && c < 0
        if (pattern === 1) return b > 0 && c < 0
        if (pattern === 2) return b < 0 && c > 0
        return true
      },
    )
    const { p, q, s } = f
    const rr = f.r
    const P = polyMul([q, p], [s, rr])
    const prompt = `Factorise $${poly(P)}$.`
    const accepted = factorForms('', [[p, q], [rr, s]])
    const answer = `(${lin(p, q)})(${lin(rr, s)})`
    const { split, grouped, middle } = splitWorking(p, q, rr, s, 'x')
    const ac = P[2]! * P[0]!
    const solution = hard
      ? `$a \\times c = ${ac}$. Multiply to $${ac}$, add to $${P[1]}$: $${plusMinus(q * rr)}$ and $${plusMinus(p * s)}$. Split: $${split} = ${grouped} = ${answer}$.`
      : `$a \\times c = ${ac}$. Two numbers that multiply to $${ac}$ and add to $${P[1]}$: $${q * rr}$ and $${p * s}$. Split: $${split} = ${grouped} = ${answer}$.`
    return textDraft(slot, {
      prompt,
      solution,
      method: [hard ? `middle term split as $${middle}$` : `the middle term split as $${middle}$, or brackets $(${lin(p, 0)} + ?)(${lin(rr, 0)} + ?)$ with a correct product`],
      answerTex: $(answer),
      accepted,
      check: expandsBack(mathIn(prompt), accepted, 'x', 'factorised'),
      values: { kind: hard ? 'hard' : 'a above 1', pattern, p, q, r: rr, s },
    })
  },
}

/** x^2 - 16 as q3, 4x^2 - 25 as q7 and 2x^2 - 8 as q14 (a common factor first): the difference of two squares. */
export const differenceOfTwoSquares: Generator = {
  id: 'difference-of-two-squares',
  subjectId: 'maths',
  topicId: EFQ,
  replaces: ['q3', 'q7', 'q14'],
  build(r, slot): Draft {
    if (slot.id === 'q3') {
      const v = letter(r)
      const a = int(r, 1, 15)
      const flipped = r() < 0.3
      const P = flipped ? [a * a, 0, -1] : [-a * a, 0, 1]
      const prompt = `Factorise $${poly(P, v, true, flipped)}$.`
      // a^2 - x^2 = (a + x)(a - x), each bracket either way round; and -(x + a)(x - a).
      const accepted = flipped
        ? [...factorForms('', [[1, a], [-1, a]], v), `-(${lin(1, a, v)})(${lin(1, -a, v)})`]
        : factorForms('', [[1, a], [1, -a]], v)
      const answer = flipped ? `(${a}+${v})(${a}-${v})` : `(${lin(1, a, v)})(${lin(1, -a, v)})`
      if (flipped) accepted.unshift(answer)
      const list = [...new Set(accepted)]
      return textDraft(slot, {
        prompt,
        solution: flipped
          ? `A square minus a square: $${a}^2 - ${v}^2 = ${answer}$.`
          : `A square minus a square: $${v}^2 - ${a}^2 = ${answer}$.`,
        method: [],
        answerTex: $(answer),
        accepted: list,
        check: expandsBack(mathIn(prompt), list, v, 'factorised'),
        values: { kind: flipped ? 'number first' : 'letter first', a, v },
      })
    }
    if (slot.id === 'q7') {
      const v = letter(r)
      const { p, q } = draw(r, (r) => ({ p: int(r, 2, 6), q: int(r, 1, 12) }), ({ p, q }) => gcd(p, q) === 1)
      const P = [-q * q, 0, p * p]
      const prompt = `Factorise $${poly(P, v)}$.`
      const accepted = factorForms('', [[p, q], [p, -q]], v)
      const answer = `(${lin(p, q, v)})(${lin(p, -q, v)})`
      return textDraft(slot, {
        prompt,
        solution: `$${p * p}${v}^2 = (${p}${v})^2$ and $${q * q} = ${q}^2$, so $${answer}$.`,
        method: [],
        answerTex: $(answer),
        accepted,
        check: expandsBack(mathIn(prompt), accepted, v, 'factorised'),
        values: { kind: 'coefficient', p, q, v },
      })
    }
    const v = letter(r)
    const { k, p, q } = draw(
      r,
      (r) => ({ k: int(r, 2, 6), p: pick(r, [1, 1, 2, 3]), q: int(r, 1, 10) }),
      ({ k, p, q }) => gcd(p, q) === 1 && k * q * q <= 300,
    )
    const inner = [-q * q, 0, p * p]
    const P = polyScale(inner, k)
    const prompt = `Factorise fully $${poly(P, v)}$.`
    const accepted = factorForms(String(k), [[p, q], [p, -q]], v)
    const answer = `${k}(${lin(p, q, v)})(${lin(p, -q, v)})`
    return textDraft(slot, {
      prompt,
      solution: `$${k}(${poly(inner, v)}) = ${answer}$. Two steps: common factor, then the difference of two squares inside.`,
      method: [`$${k}(${poly(inner, v)})$`],
      answerTex: $(answer),
      accepted,
      check: expandsBack(mathIn(prompt), accepted, v, 'factorised'),
      values: { kind: 'common factor', k, p, q, v },
    })
  },
}

/** gx(ux + w): the highest common factor, a number and the letter. */
function drawCommonFactor(r: Rng, us: number[]) {
  return draw(r, (r) => ({ g: int(r, 2, 9), u: pick(r, us), w: either(r, 9) }), ({ u, w }) => gcd(u, w) === 1)
}

/** 3x^2 + 12x = 3x(x+4): written as q8. */
export const quadraticCommonFactor: Generator = {
  id: 'quadratic-common-factor',
  subjectId: 'maths',
  topicId: EFQ,
  replaces: ['q8'],
  build(r, slot): Draft {
    const v = letter(r)
    const { g, u, w } = drawCommonFactor(r, [1, 1, 2, 3])
    const P = [0, g * w, g * u]
    const prompt = `Factorise fully $${poly(P, v)}$.`
    const lead = `${g}${v}`
    const accepted = factorForms(lead, [[u, w]], v)
    const answer = `${lead}(${lin(u, w, v)})`
    return textDraft(slot, {
      prompt,
      solution: `Both terms share $${lead}$: $${answer}$. *Fully* means take out everything common, not just $${g}$ or just $${v}$.`,
      method: [],
      answerTex: $(answer),
      accepted,
      check: commonFactorCheck(prompt, accepted, v, g),
      values: { g, u, w, v },
    })
  },
}

/** Every accepted form multiplies back to the prompt, and the factor outside holds the number and the letter. */
function commonFactorCheck(prompt: string, accepted: string[], v: string, g: number): Check {
  const back = expandsBack(mathIn(prompt), accepted, v, 'factorised')
  const outside = accepted.every((a) => a.startsWith(`${g}${v}(`))
  const target = polyOf(fromTex(mathIn(prompt)), v)!
  // Brute force: g is the largest number dividing both coefficients.
  let hcf = 1
  for (let k = 1; k <= Math.abs(target[2]!); k++) if (target[1]! % k === 0 && target[2]! % k === 0) hcf = k
  return { agrees: back.agrees && outside && hcf === g && target[0] === 0, detail: `${back.detail}; HCF by search ${hcf}, outside ${g}${v}` }
}

/** 76^2 - 24^2 = (76 + 24)(76 - 24) = 5200: written as q10. */
export const differenceOfSquaresNumbers: Generator = {
  id: 'difference-of-squares-numbers',
  subjectId: 'maths',
  topicId: EFQ,
  replaces: ['q10'],
  build(r, slot): Draft {
    const kind = pick(r, ['sum', 'sum', 'difference'] as const)
    let a: number, b: number
    if (kind === 'sum') {
      const S = pick(r, [100, 100, 100, 200, 50])
      a = int(r, S / 2 + 1, S - 1)
      b = S - a
    } else {
      const D = pick(r, [10, 100])
      b = D === 10 ? int(r, 11, 89) : int(r, 1, 60)
      a = b + D
    }
    const answer = (a + b) * (a - b)
    return {
      question: {
        type: 'numeric',
        prompt: `Without a calculator, work out $${a}^2 - ${b}^2$.`,
        solution: `$${a}^2 - ${b}^2 = (${a}+${b})(${a}-${b}) = ${a + b} \\times ${a - b} = ${answer}$. The difference of two squares turns a nasty calculation into an easy one.`,
        markScheme: scheme(slot, [`$(${a}+${b})(${a}-${b})$`], String(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: a * a - b * b === answer, detail: `${a * a} - ${b * b} = ${a * a - b * b}` },
      values: { kind, a, b },
    }
  },
}

const SHAPES = [
  { noun: 'A rectangle', unit: 'cm' },
  { noun: 'A rectangular photograph', unit: 'cm' },
  { noun: 'A rectangular rug', unit: 'm' },
  { noun: 'A rectangular garden', unit: 'm' },
  { noun: 'A rectangular tile', unit: 'cm' },
]

/** Area x^2 + 9x + 20, so the sides are x + 4 and x + 5 and the perimeter 4x + 18: written as q17. */
export const perimeterFromArea: Generator = {
  id: 'perimeter-from-area',
  subjectId: 'maths',
  topicId: EFQ,
  replaces: ['q17'],
  build(r, slot): Draft {
    const shape = pick(r, SHAPES)
    const { a, b } = draw(r, (r) => ({ a: int(r, 1, 12), b: int(r, 1, 12) }), ({ a, b }) => a < b)
    const P = polyMul([a, 1], [b, 1])
    const half = a + b
    const perimeter = [2 * half, 4]
    const forms = [poly(perimeter, 'x', false), poly(perimeter, 'x', false, true), `2(${lin(2, half)})`]
    if (half % 2 === 0) forms.push(`4(${lin(1, half / 2)})`)
    const accepted = [...forms, ...forms.map((f) => `${f}${shape.unit}`)]
    const prompt = `${shape.noun} has area $${poly(P)}$ ${shape.unit}². Each side is an expression of the form $x + a$, where $a$ is a whole number. Find an expression for its perimeter.`
    // Second route: find the sides by searching for the whole numbers a with x = -a a root of the printed area.
    const area = polyOf(fromTex(mathIn(prompt)))!
    const found: number[] = []
    for (let t = 1; t <= 30; t++) if (polyAt(area, -t) === 0) found.push(t)
    const want = found.length === 2 ? [2 * (found[0]! + found[1]!), 4] : null
    const bad = accepted.filter((f) => {
      const p = polyOf(f.replace(/c?m$/, ''))
      return !want || !p || !polyEq(p, want)
    })
    return textDraft(slot, {
      prompt,
      solution: `Area is length × width, so factorise: $${poly(P)} = (${lin(1, a)})(${lin(1, b)})$. The sides are $${lin(1, a)}$ and $${lin(1, b)}$. Perimeter $= 2(${lin(1, a)}) + 2(${lin(1, b)}) = ${poly(perimeter)}$.`,
      method: [`$(${lin(1, a)})(${lin(1, b)})$`, `$2(${lin(1, a)}) + 2(${lin(1, b)})$ or equivalent`],
      answerTex: $(poly(perimeter)),
      accepted,
      check: { agrees: bad.length === 0, detail: `sides found by search: ${found.join(', ')}; wrong forms: ${bad.join(' | ')}` },
      values: { a, b, unit: shape.unit },
    })
  },
}

// =======================================================================================
// Simplifying and expanding expressions
// =======================================================================================

/** The written lists of this topic: spaced, highest power first, then lowest first. */
const spacedForms = (p: Poly, v = 'x') => [poly(p, v), poly(p, v, true, true)]

/** An answer that must be the printed expression simplified: same polynomial, at most two terms, no brackets. */
function simplifiedCheck(promptTex: string, accepted: string[], v = 'x'): Check {
  const back = expandsBack(promptTex, accepted, v, 'expanded')
  const short = accepted.every((a) => (a.replace(/^-/, '').match(/[+-]/g) ?? []).length <= 1)
  return { agrees: back.agrees && short, detail: back.detail }
}

/** 7x - 4x + 2 = 3x + 2: written as q1. Two like terms and one that is not, in any order. */
export const collectingLikeTerms: Generator = {
  id: 'collecting-like-terms',
  subjectId: 'maths',
  topicId: SIMPLIFY,
  replaces: ['q1'],
  build(r, slot): Draft {
    const v = letter(r)
    const { a, b, c } = draw(r, (r) => ({ a: int(r, 2, 12), b: either(r, 9), c: either(r, 12) }), ({ a, b }) => a + b >= 1)
    const order = int(r, 0, 2)
    const terms: [number, number][] = order === 0 ? [[a, 1], [b, 1], [c, 0]] : order === 1 ? [[a, 1], [c, 0], [b, 1]] : [[c, 0], [a, 1], [b, 1]]
    const prompt = `Simplify $${sumOf(terms, v)}$.`
    const P = [c, a + b]
    const accepted = spacedForms(P, v)
    return textDraft(slot, {
      prompt,
      solution: `$${sumOf([[a, 1], [b, 1]], v)} = ${lin(a + b, 0, v)}$, and the $${plusMinus(c)}$ is not a like term, so it stays: $${poly(P, v)}$.`,
      method: [],
      answerTex: poly(P, v),
      accepted,
      check: simplifiedCheck(mathIn(prompt), accepted, v),
      values: { a, b, c, order, v },
    })
  },
}

/** 5(2x + 3) = 10x + 15 as q2, and 4(2x + 1) - 3(x - 2) = 5x + 10 as q5. */
export const expandingBrackets: Generator = {
  id: 'expanding-brackets',
  subjectId: 'maths',
  topicId: SIMPLIFY,
  replaces: ['q2', 'q5'],
  build(r, slot): Draft {
    const v = slot.id === 'q2' ? letter(r) : 'x'
    if (slot.id === 'q2') {
      const k = int(r, 2, 9)
      const a = int(r, 1, 9)
      const b = either(r, 12)
      const P = [k * b, k * a]
      const prompt = `Expand $${k}(${lin(a, b, v, true)})$.`
      const accepted = spacedForms(P, v)
      return textDraft(slot, {
        prompt,
        solution: `$${k} \\times ${lin(a, 0, v)} = ${lin(k * a, 0, v)}$ and $${k} \\times ${signed(b)} = ${k * b}$, so $${poly(P, v)}$.`,
        method: [],
        answerTex: poly(P, v),
        accepted,
        check: simplifiedCheck(mathIn(prompt), accepted, v),
        values: { k, a, b, v },
      })
    }
    const { k1, a1, b1, k2, a2, b2 } = draw(
      r,
      (r) => ({ k1: int(r, 2, 6), a1: int(r, 1, 5), b1: either(r, 9), k2: int(r, 2, 6), a2: int(r, 1, 5), b2: r() < 0.75 ? -int(r, 1, 9) : int(r, 1, 9) }),
      ({ k1, a1, b1, k2, a2, b2 }) => k1 * a1 - k2 * a2 !== 0 && k1 * b1 - k2 * b2 !== 0 && k1 !== k2,
    )
    const X = k1 * a1 - k2 * a2
    const C = k1 * b1 - k2 * b2
    const P = [C, X]
    const prompt = `Expand and simplify $${k1}(${lin(a1, b1, 'x', true)}) - ${k2}(${lin(a2, b2, 'x', true)})$.`
    const note = b2 < 0 ? `Note $-${k2} \\times -${-b2} = +${-k2 * b2}$.` : `Note $-${k2} \\times ${b2} = -${k2 * b2}$.`
    const accepted = spacedForms(P)
    return textDraft(slot, {
      prompt,
      solution: `$${poly([k1 * b1, k1 * a1])}$ and $${poly([-k2 * b2, -k2 * a2])}$. ${note} Collecting: $${sumOf([[k1 * a1, 1], [-k2 * a2, 1]])} = ${lin(X, 0)}$ and $${sumOf([[k1 * b1, 0], [-k2 * b2, 0]])} = ${C}$, so $${poly(P)}$.`,
      method: [],
      answerTex: poly(P),
      accepted,
      check: simplifiedCheck(mathIn(prompt), accepted),
      values: { k1, a1, b1, k2, a2, b2 },
    })
  },
}

/** Smallest prime factor, by trial. */
const smallestFactor = (n: number) => {
  for (let k = 2; k <= n; k++) if (n % k === 0) return k
  return n
}

/** 12x + 20 = 4(3x + 5): written as q7. */
export const factorisingANumber: Generator = {
  id: 'factorising-a-number',
  subjectId: 'maths',
  topicId: SIMPLIFY,
  replaces: ['q7'],
  build(r, slot): Draft {
    const v = letter(r)
    const { g, u, w } = draw(r, (r) => ({ g: int(r, 2, 12), u: int(r, 1, 9), w: either(r, 9) }), ({ g, u, w }) => gcd(u, w) === 1 && g * u <= 60 && g * Math.abs(w) <= 80)
    const P = [g * w, g * u]
    const prompt = `Factorise fully $${poly(P, v)}$.`
    const answer = `${g}(${lin(u, w, v, true)})`
    const accepted = [answer, `${g}(${poly([w, u], v, true, true)})`]
    const prime = smallestFactor(g) === g
    const last = prime
      ? `The bracket has no common factor left, so this is fully factorised.`
      : `Taking out only ${smallestFactor(g)} would leave a common factor inside.`
    const back = expandsBack(mathIn(prompt), accepted, v, 'factorised')
    let hcf = 1
    for (let k = 1; k <= g * u; k++) if ((g * u) % k === 0 && (g * w) % k === 0) hcf = k
    return textDraft(slot, {
      prompt,
      solution: `The HCF of ${g * u} and ${g * Math.abs(w)} is **${g}**, giving $${answer}$. Check: $${g} \\times ${lin(u, 0, v)} = ${lin(g * u, 0, v)}$, $${g} \\times ${signed(w)} = ${g * w}$ ✓. ${last}`,
      method: [],
      answerTex: answer,
      accepted,
      check: { agrees: back.agrees && hcf === g, detail: `${back.detail}; HCF by search ${hcf}` },
      values: { g, u, w, v },
    })
  },
}

/** The coefficient of x in (x + 5)(x - 2): written as q9. */
export const coefficientOfX: Generator = {
  id: 'coefficient-of-x',
  subjectId: 'maths',
  topicId: SIMPLIFY,
  replaces: ['q9'],
  build(r, slot): Draft {
    const { a, b } = draw(r, (r) => ({ a: either(r, 12), b: either(r, 12) }), ({ a, b }) => a + b !== 0 && a !== b)
    const answer = a + b
    const prompt = `In the expansion of $(${lin(1, a, 'x', true)})(${lin(1, b, 'x', true)})$, what is the coefficient of $x$?`
    // Second route: multiply out the printed brackets and read the x term.
    const expanded = polyOf(fromTex(mathIn(prompt)))
    return {
      question: {
        type: 'numeric',
        prompt,
        solution: `The $x$ coefficient is the **sum** of the two numbers: $${a} + ${signed(b)} = ${answer}$. The constant is their product, $${a} \\times ${signed(b)} = ${a * b}$.`,
        markScheme: scheme(slot, ['adds the two numbers, keeping the sign'], String(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: !!expanded && expanded[1] === answer, detail: `expanded: ${expanded && poly(expanded)}` },
      values: { a, b },
    }
  },
}

/** 6x^2 + 9x = 3x(2x + 3): written as q14, grade 8-9, so a number and the letter come out and the x-term inside keeps a coefficient. */
export const factorisingWithALetter: Generator = {
  id: 'factorising-with-a-letter',
  subjectId: 'maths',
  topicId: SIMPLIFY,
  replaces: ['q14'],
  build(r, slot): Draft {
    const v = letter(r)
    const { g, u, w } = drawCommonFactor(r, [2, 3, 4, 5])
    const P = [0, g * w, g * u]
    const prompt = `Factorise fully $${poly(P, v)}$.`
    const lead = `${g}${v}`
    // Said aloud: an x, an n, an a; a y, a t.
    const an = ['x', 'n', 'a'].includes(v) ? 'an' : 'a'
    const answer = `${lead}(${lin(u, w, v, true)})`
    const accepted = [answer, `${lead}(${poly([w, u], v, true, true)})`]
    return textDraft(slot, {
      prompt,
      solution: `Every term has ${/^(8|11|18|8\d)$/.test(String(g)) ? 'an' : 'a'} **${g}** and ${an} **$${v}$**, so the HCF is $${lead}$. Dividing gives $${lin(u, 0, v)}$ and $${w}$: $${answer}$. Check: $${lead} \\times ${lin(u, 0, v)} = ${lin(g * u, 0, v).replace(v, `${v}^2`)}$ and $${lead} \\times ${signed(w)} = ${lin(g * w, 0, v)}$ ✓. Taking out only ${g} would leave ${an} $${v}$ common inside.`,
      method: [],
      answerTex: answer,
      accepted,
      check: commonFactorCheck(prompt, accepted, v, g),
      values: { g, u, w, v },
    })
  },
}

// =======================================================================================
// Solving quadratic equations
// =======================================================================================

/** (x - r1)(x - r2) printed: (x+2)(x+3). */
const factorsOf = (r1: number, r2: number) => `(${lin(1, -r1)})(${lin(1, -r2)})`
const rootsTex = (r1: number, r2: number) => `$x = ${r1}$ or $x = ${r2}$`
const rootsAnd = (r1: Rational, r2: Rational) => `$x = ${texRational(r1)}$ and $x = ${texRational(r2)}$`

/**
 * Solving by factorising: x^2 + 5x + 6 = 0 as q1, (x-4)(x+1) = 0 as q3, x^2 - 7x = 0 as q4,
 * x^2 + 4x - 21 = 0 as q8, x^2 = 5x + 14 as q9 (rearrange first) and (x+1)(x-3) = 12 as q18
 * (a product equal to a number that is not zero). Each slot keeps its own step.
 */
export const solvingByFactorising: Generator = {
  id: 'solving-by-factorising',
  subjectId: 'maths',
  topicId: SOLVE,
  replaces: ['q1', 'q3', 'q4', 'q8', 'q9', 'q18'],
  build(r, slot): Draft {
    const finish = (prompt: string, solution: string, method: string[], r1: number, r2: number, values: Draft['values']) => {
      const accepted = rootForms([r1, 1], [r2, 1])
      return textDraft(slot, {
        prompt,
        solution,
        method,
        answerTex: rootsAnd([r1, 1], [r2, 1]),
        accepted,
        check: rootsCheck(prompt, accepted, [[r1, 1], [r2, 1]]),
        values,
      })
    }
    if (slot.id === 'q3') {
      const { a, b } = draw(r, (r) => ({ a: either(r, 12), b: either(r, 12) }), ({ a, b }) => a !== b && a + b !== 0)
      const prompt = `Solve $(${lin(1, a)})(${lin(1, b)}) = 0$.`
      return finish(
        prompt,
        `Already factorised. $${lin(1, a, 'x', true)} = 0$ gives $x = ${-a}$; $${lin(1, b, 'x', true)} = 0$ gives $x = ${-b}$. Watch the signs: the solutions are the *opposite* of the numbers in the brackets.`,
        [],
        -a,
        -b,
        { kind: 'factorised', a, b },
      )
    }
    if (slot.id === 'q4') {
      const a = pick(r, [1, 1, 2, 3, 4, 5])
      const k = either(r, 15)
      const prompt = `Solve $${poly([0, a * k, a])} = 0$.`
      const outside = lin(a, 0)
      return finish(
        prompt,
        `Take out the common factor: $${outside}(${lin(1, k)}) = 0$, so $x = 0$ or $x = ${-k}$. Dividing both sides by $x$ loses the solution $x = 0$.`,
        [`$${outside}(${lin(1, k)}) = 0$`],
        0,
        -k,
        { kind: 'common factor', a, k },
      )
    }
    if (slot.id === 'q18') {
      const v = draw(
        r,
        (r) => ({ a: either(r, 6), b: either(r, 6), r1: either(r, 9) }),
        ({ a, b, r1 }) => {
          const r2 = -(a + b) - r1
          const k = a * b - r1 * r2
          return a !== b && r2 !== 0 && r1 !== r2 && k > 0 && k <= 60 && ![-a, -b].includes(r1) && ![-a, -b].includes(r2)
        },
      )
      const { a, b, r1 } = v
      const r2 = -(a + b) - r1
      const k = a * b - r1 * r2
      const left = [a * b, a + b, 1]
      const zero = [a * b - k, a + b, 1]
      const prompt = `Solve $(${lin(1, a)})(${lin(1, b)}) = ${k}$.`
      return finish(
        prompt,
        `The trap is writing $${lin(1, a, 'x', true)} = ${k}$: that only works when the product is **zero**. Expand and rearrange: $${poly(left)} = ${k}$, so $${poly(zero)} = 0$, $${factorsOf(r1, r2)} = 0$, ${rootsTex(r1, r2)}.`,
        [`$${poly(zero)} = 0$`, `$${factorsOf(r1, r2)} = 0$`],
        r1,
        r2,
        { kind: 'product equals', a, b, k },
      )
    }
    // q1, q8 and q9: two whole-number roots of x^2 + bx + c.
    const { r1, r2 } = draw(
      r,
      (r) => (slot.id === 'q1' && r() < 0.5 ? { r1: -int(r, 1, 9), r2: -int(r, 1, 9) } : { r1: either(r, slot.id === 'q1' ? 9 : 12), r2: either(r, slot.id === 'q1' ? 9 : 12) }),
      ({ r1, r2 }) => r1 !== r2 && r1 + r2 !== 0 && (slot.id !== 'q8' || r1 * r2 < 0),
    )
    const P = [r1 * r2, -(r1 + r2), 1]
    if (slot.id === 'q9') {
      const form = int(r, 0, 2)
      const B = P[1]!
      const C = P[0]!
      const equation = form === 0 ? `x^2 = ${poly([-C, -B])}` : form === 1 ? `${poly([0, B, 1])} = ${-C}` : `${poly([C, 0, 1])} = ${lin(-B, 0)}`
      const prompt = `Solve $${equation}$.`
      return finish(
        prompt,
        `Get zero on one side first: $${poly(P)} = 0$. Then $${factorsOf(r1, r2)} = 0$, so ${rootsTex(r1, r2)}. Factorising $${equation}$ as it stands is meaningless.`,
        [`$${poly(P)} = 0$`, `$${factorsOf(r1, r2)} = 0$`],
        r1,
        r2,
        { kind: 'rearrange', form, r1, r2 },
      )
    }
    const prompt = `Solve $${poly(P)} = 0$.`
    if (slot.id === 'q8') {
      return finish(
        prompt,
        `Product $${P[0]}$, sum $${P[1]}$: $${-r1}$ and $${-r2}$. $${factorsOf(r1, r2)} = 0$, so ${rootsTex(r1, r2)}.`,
        [`$${factorsOf(r1, r2)} = 0$`],
        r1,
        r2,
        { kind: 'negative constant', r1, r2 },
      )
    }
    return finish(
      prompt,
      `Factorise: $${factorsOf(r1, r2)} = 0$. A product is zero only if a factor is zero, so $${lin(1, -r1, 'x', true)} = 0$ or $${lin(1, -r2, 'x', true)} = 0$: ${rootsTex(r1, r2)}.`,
      [`$${factorsOf(r1, r2)} = 0$`],
      r1,
      r2,
      { kind: 'trinomial', r1, r2 },
    )
  },
}

/** x^2 - 9 = 0, and the forms that come to x^2 = 9 after one step: written as q2. */
export const solvingBySquareRoots: Generator = {
  id: 'solving-by-square-roots',
  subjectId: 'maths',
  topicId: SOLVE,
  replaces: ['q2'],
  build(r, slot): Draft {
    const a = int(r, 1, 12)
    const A = a * a
    const form = int(r, 0, 3)
    const k = int(r, 2, 5)
    const c = int(r, 1, 20)
    const equation = form === 0 ? `x^2 - ${A} = 0` : form === 1 ? `${k}x^2 - ${k * A} = 0` : form === 2 ? `x^2 + ${c} = ${A + c}` : `${k}x^2 = ${k * A}`
    const both = `Both answers are needed; $x = ${a}$ alone loses a mark.`
    const solution = [
      `$(x+${a})(x-${a}) = 0$, so $x = ${a}$ or $x = -${a}$. Or: $x^2 = ${A}$, so $x = \\pm ${a}$. ${both}`,
      `Divide by ${k}: $x^2 - ${A} = 0$, so $(x+${a})(x-${a}) = 0$ and $x = ${a}$ or $x = -${a}$. Or: $x^2 = ${A}$, so $x = \\pm ${a}$. ${both}`,
      `Subtract ${c}: $x^2 = ${A}$, so $x = \\pm ${a}$: $x = ${a}$ or $x = -${a}$. ${both}`,
      `Divide by ${k}: $x^2 = ${A}$, so $x = \\pm ${a}$: $x = ${a}$ or $x = -${a}$. ${both}`,
    ][form]!
    const prompt = `Solve $${equation}$.`
    const accepted = rootForms([a, 1], [-a, 1], true)
    return textDraft(slot, {
      prompt,
      solution,
      method: [`$(x+${a})(x-${a}) = 0$ or $x^2 = ${A}$`],
      answerTex: `$x = ${a}$ and $x = -${a}$`,
      accepted,
      check: rootsCheck(prompt, accepted, [[a, 1], [-a, 1]]),
      values: { form, a, k, c },
    })
  },
}

/**
 * ax^2 + bx + c = 0 with a above 1 and a fraction for a root: 2x^2 + 7x + 3 = 0 as q5 and
 * 3x^2 - 5x - 2 = 0 as q11 (grade 8-9: a negative constant, and the split shown). Marked
 * M1 A1 A1, a mark for each root, as written.
 */
export const solvingByFactorisingAAbove1: Generator = {
  id: 'solving-ax2-by-factorising',
  subjectId: 'maths',
  topicId: SOLVE,
  replaces: ['q5', 'q11'],
  build(r, slot): Draft {
    const hard = slot.id === 'q11'
    // (px + q)(rx + s) = 0, px + q giving the fraction.
    const f = draw(
      r,
      (r) => (hard
        ? { p: int(r, 2, 5), q: either(r, 9), r: pick(r, [1, 1, 2]), s: either(r, 9) }
        : r() < 0.6 ? { p: int(r, 2, 5), q: int(r, 1, 9), r: 1, s: int(r, 1, 9) } : { p: int(r, 2, 5), q: either(r, 9), r: 1, s: either(r, 9) }),
      ({ p, q, r: rr, s }) => gcd(p, q) === 1 && gcd(rr, s) === 1 && p * s + q * rr !== 0 && (!hard || q * s < 0) && !(p === rr && q === s) && p * rr <= 10,
    )
    const { p, q, s } = f
    const rr = f.r
    const P = polyMul([q, p], [s, rr])
    const prompt = `Solve $${poly(P)} = 0$.`
    const root1 = reduce([-q, p])
    const root2 = reduce([-s, rr])
    const ac = P[0]! * P[2]!
    const fac = `(${lin(p, q)})(${lin(rr, s)})`
    let solution: string
    if (hard) {
      // Group on the bracket with the whole-number root when there is one, as the written q11 does.
      const { split, grouped } = splitWorking(rr, s, p, q, 'x')
      solution = `$a \\times c = ${ac}$, pair $${plusMinus(s * p)}$ and $${plusMinus(rr * q)}$: $${split} = ${grouped} = (${lin(rr, s)})(${lin(p, q)}) = 0$. So $x = ${texRational(root1)}$ or $x = ${texRational(root2)}$.`
    } else {
      solution = `$a \\times c = ${ac}$, pair $${q * rr}$ and $${p * s}$: $${fac} = 0$. Then $${lin(p, q, 'x', true)} = 0$ gives $x = ${texRational(root1)}$, and $${lin(rr, s, 'x', true)} = 0$ gives $x = ${texRational(root2)}$.`
    }
    const accepted = rootForms(root1, root2)
    return textDraft(slot, {
      prompt,
      solution,
      method: [
        { code: 'M1', marks: 1, description: `$${fac} = 0$` },
        { code: 'A1', marks: 1, description: `$x = ${texRational(root1)}$` },
        { code: 'A1', marks: 1, description: `$x = ${texRational(root2)}$` },
      ],
      answerTex: '',
      accepted,
      check: rootsCheck(prompt, accepted, [root1, root2]),
      values: { p, q, r: rr, s },
    })
  },
}

/** x^2 + 8x + 3 = (x+4)^2 - 13 as q6, and 2x^2 + 12x + 7 = 2(x+3)^2 - 11 as q12. */
export const completingTheSquare: Generator = {
  id: 'completing-the-square',
  subjectId: 'maths',
  topicId: SOLVE,
  replaces: ['q6', 'q12'],
  build(r, slot): Draft {
    if (slot.id === 'q12') {
      const { a, h, c } = draw(r, (r) => ({ a: int(r, 2, 5), h: either(r, 6), c: either(r, 20) }), ({ a, h, c }) => a * h * h + c !== 0)
      const k = a * h * h + c
      const P = [k, 2 * a * h, a]
      const prompt = `Write $${poly(P)}$ in the form $a(x+b)^2 + c$.`
      const sq = `(${lin(1, h)})^2`
      const answer = `${a}${sq} ${constTerm(c)}`
      const accepted = [`${a}${sq}${plusMinus(c)}`]
      return textDraft(slot, {
        prompt,
        solution: `Take the $${a}$ out of the first two terms: $${a}(${poly([0, 2 * h, 1])}) ${constTerm(k)}$. Complete the square inside: $${a}[${sq} - ${h * h}] ${constTerm(k)} = ${a}${sq} - ${a * h * h} ${constTerm(k)} = ${answer}$.`,
        method: [`$${a}(${poly([0, 2 * h, 1])}) ${constTerm(k)}$`, `$${a}[${sq} - ${h * h}] ${constTerm(k)}$`],
        answerTex: $(answer),
        accepted,
        check: squareCheck(prompt, accepted, a),
        values: { a, h, c },
      })
    }
    const { h, c } = draw(r, (r) => ({ h: either(r, 8), c: either(r, 20) }), ({ h, c }) => c !== h * h)
    const k = c - h * h
    const P = [c, 2 * h, 1]
    const prompt = `Write $${poly(P)}$ in the form $(x+a)^2 + b$.`
    const sq = `(${lin(1, h)})^2`
    const answer = `${sq} ${constTerm(k)}`
    const accepted = [`${sq}${plusMinus(k)}`]
    return textDraft(slot, {
      prompt,
      solution: `Halve $${2 * h}$ to get $${h}$, square it to get $${h * h}$: $${sq} = ${poly([h * h, 2 * h, 1])}$, which is $${Math.abs(k)}$ too ${k < 0 ? 'many' : 'few'}. So $${poly(P)} = ${answer}$.`,
      method: [$(sq)],
      answerTex: $(answer),
      accepted,
      check: squareCheck(prompt, accepted, 1),
      values: { h, c },
    })
  },
}

/** Each accepted form multiplies back to the printed quadratic and has the asked-for shape: a(x ± b)^2 ± c. */
function squareCheck(prompt: string, accepted: string[], a: number): Check {
  const back = expandsBack(mathIn(prompt), accepted, 'x', 'any')
  const shape = new RegExp(`^${a === 1 ? '' : a}\\(x[+-]\\d+\\)\\^2[+-]\\d+$`)
  const bad = accepted.filter((f) => !shape.test(f))
  return { agrees: back.agrees && bad.length === 0, detail: `${back.detail}; wrong shape: ${bad.join(' | ')}` }
}

/** A root of ax^2 + bx + c by bisection, between lo and hi where the sign changes: a route that never uses the formula. */
function bisect(a: number, b: number, c: number, lo: number, hi: number): number {
  const f = (x: number) => a * x * x + b * x + c
  let L = lo
  let H = hi
  for (let i = 0; i < 200; i++) {
    const m = (L + H) / 2
    if (Math.sign(f(m)) === Math.sign(f(L))) L = m
    else H = m
  }
  return (L + H) / 2
}

/**
 * The quadratic formula to 2 decimal places: x^2 + 3x - 5 = 0, the larger or smaller root, as
 * q7; 3x^2 - 2x - 4 = 0, the smaller root, as q15 (grade 8-9: a above 1, b and c negative).
 */
export const quadraticFormula: Generator = {
  id: 'quadratic-formula',
  subjectId: 'maths',
  topicId: SOLVE,
  replaces: ['q7', 'q15'],
  build(r, slot): Draft {
    const hard = slot.id === 'q15'
    const larger = hard ? false : r() < 0.5
    const v = draw(
      r,
      (r) => (hard ? { a: int(r, 2, 5), b: -int(r, 1, 9), c: -int(r, 1, 12) } : { a: 1, b: either(r, 9), c: either(r, 12) }),
      ({ a, b, c }) => {
        const D = b * b - 4 * a * c
        if (D <= 0 || Number.isInteger(Math.sqrt(D))) return false
        const root = (-b + (larger ? 1 : -1) * Math.sqrt(D)) / (2 * a)
        const shown = (-b + (larger ? 1 : -1) * roundTo(Math.sqrt(D), 3)) / (2 * a)
        return Math.abs(root) >= 0.3 && clearOfHalf(root, 2, 0.05) && roundTo(shown, 2) === roundTo(root, 2) && clearOfHalf(Math.sqrt(D), 2, 0.05)
      },
    )
    const { a, b, c } = v
    const D = b * b - 4 * a * c
    const root = (-b + (larger ? 1 : -1) * Math.sqrt(D)) / (2 * a)
    const other = (-b + (larger ? -1 : 1) * Math.sqrt(D)) / (2 * a)
    const answer = roundTo(root, 2)
    const word = larger ? 'larger' : 'smaller'
    const prompt = hard
      ? `Solve $${poly([c, b, a])} = 0$ using the quadratic formula. Give the smaller solution to 2 decimal places.`
      : `Use the quadratic formula to solve $${poly([c, b, a])} = 0$. Give the ${word} solution to 2 decimal places.`
    const sub = `\\dfrac{${-b} \\pm \\sqrt{${b < 0 ? `(${b})` : b}^2 - 4(${a})(${c})}}{${2 * a}}`
    const pm = larger ? '+' : '-'
    const solution = hard
      ? `$a = ${a}$, $b = ${b}$, $c = ${c}$. $x = \\dfrac{${-b} \\pm \\sqrt{${b * b} + ${-4 * a * c}}}{${2 * a}} = \\dfrac{${-b} \\pm \\sqrt{${D}}}{${2 * a}}$. Smaller: $\\dfrac{${-b} - ${fixed(Math.sqrt(D), 3)}}{${2 * a}} = ${fixed(root, 2)}$. The two traps: $-b$ becomes $+${-b}$, and $-4ac$ becomes $+${-4 * a * c}$.`
      : `$a = ${a}$, $b = ${b}$, $c = ${c}$. $x = \\dfrac{${-b} \\pm \\sqrt{${b * b} - 4(${a})(${c})}}{${2 * a}} = \\dfrac{${-b} \\pm \\sqrt{${D}}}{${2 * a}}$. The ${word} is $\\dfrac{${-b} ${pm} ${fixed(Math.sqrt(D), 3)}}{${2 * a}} = ${fixed(root, 2)}$ (the other is $${fixed(other, 2)}$).`
    // Second route: bisection on the side of the vertex the asked-for root lies, then substitution.
    const vertex = -b / (2 * a)
    const found = larger ? bisect(a, b, c, vertex, vertex + 100) : bisect(a, b, c, vertex - 100, vertex)
    const residual = a * root * root + b * root + c
    return {
      question: {
        type: 'numeric',
        prompt,
        solution,
        markScheme: scheme(slot, [hard ? `$${sub}$` : 'correct substitution into the formula', hard ? `$\\sqrt{${D}}$ or $${fixed(Math.sqrt(D), 2)}$` : `$\\sqrt{${D}}$ or $${fixed(Math.sqrt(D), 2)}$ seen`], hard ? `$${fixed(root, 2)}$` : fixed(root, 2)),
        answer,
        tolerance: 0.005,
      },
      check: { agrees: roundTo(found, 2) === answer && Math.abs(residual) < 1e-9 && (larger ? root > other : root < other), detail: `bisection ${found}, formula ${root}, residual ${residual}` },
      values: { a, b, c, root: word },
    }
  },
}

const PLOTS = [
  { noun: 'A rectangle', unit: 'cm' },
  { noun: 'A rectangular garden', unit: 'm' },
  { noun: 'A rectangular poster', unit: 'cm' },
  { noun: 'A rectangular field', unit: 'm' },
]

/** Width w, length w + 3, area 54: form and solve w^2 + 3w - 54 = 0, rejecting the negative root. Written as q14. */
export const formingAQuadratic: Generator = {
  id: 'forming-a-quadratic',
  subjectId: 'maths',
  topicId: SOLVE,
  replaces: ['q14'],
  build(r, slot): Draft {
    const { noun, unit } = pick(r, PLOTS)
    const w = int(r, 2, 20)
    const d = int(r, 1, 12)
    const A = w * (w + d)
    // Second route: the formula, which needs the discriminant to be a perfect square for a whole width.
    const D = d * d + 4 * A
    const byFormula = (-d + Math.sqrt(D)) / 2
    return {
      question: {
        type: 'numeric',
        prompt: `${noun} is ${d} ${unit} longer than it is wide. Its area is ${A} ${unit}². Find its width.`,
        solution: `Let the width be $w$; the length is $w + ${d}$. Area: $w(w+${d}) = ${A}$, so $${poly([-A, d, 1], 'w')} = 0$, $(w+${w + d})(w-${w}) = 0$, $w = ${w}$ or $w = -${w + d}$. A width cannot be negative, so **${w} ${unit}**. The rejection of $-${w + d}$ is a mark.`,
        markScheme: scheme(slot, [`$w(w+${d}) = ${A}$`, `$${poly([-A, d, 1], 'w')} = 0$`, `$(w+${w + d})(w-${w}) = 0$`], `$w = ${w}$, with $-${w + d}$ rejected`),
        answer: w,
        tolerance: 0,
        units: unit,
      },
      check: { agrees: byFormula === w && w * (w + d) === A, detail: `formula gives ${byFormula}` },
      values: { w, d, unit },
    }
  },
}

/** Squared factors left under a root, by trial: 1 when n is square-free. */
export function largestSquareFactor(n: number): number {
  let best = 1
  for (let k = 2; k * k <= n; k++) if (n % (k * k) === 0) best = k * k
  return best
}

/** The positive root of x^2 + 3x - 5 = 0 in surd form, (-3+√29)/2: written as q19. */
export const quadraticFormulaExact: Generator = {
  id: 'quadratic-formula-exact',
  subjectId: 'maths',
  topicId: SOLVE,
  replaces: ['q19'],
  build(r, slot): Draft {
    // b odd keeps the discriminant odd, so nothing cancels with the 2; square-free keeps the root simplest.
    const { b, c } = draw(
      r,
      (r) => ({ b: (r() < 0.5 ? -1 : 1) * pick(r, [1, 3, 5, 7, 9]), c: -int(r, 1, 30) }),
      ({ b, c }) => largestSquareFactor(b * b - 4 * c) === 1,
    )
    const D = b * b - 4 * c
    const first = `(${-b}+√${D})/2`
    const second = `(√${D}${-b < 0 ? '-' : '+'}${Math.abs(b)})/2`
    const accepted = [first, second, `x = ${first}`, `x = ${second}`]
    const prompt = `Solve $${poly([c, b, 1])} = 0$ using the quadratic formula. Give the positive solution in exact surd form.`
    const root = (-b + Math.sqrt(D)) / 2
    // Second route: every accepted form read as a number and put back into the equation.
    const bad = accepted.filter((f) => {
      const x = valueOf(f.replace(/^x = /, ''))
      return !(x > 0 && Math.abs(x * x + b * x + c) < 1e-9)
    })
    return textDraft(slot, {
      prompt,
      solution: `With $a = 1$, $b = ${b}$, $c = ${c}$ the discriminant is $b^2 - 4ac = ${b * b} + ${-4 * c} = ${D}$. So $x = \\frac{${-b} \\pm \\sqrt{${D}}}{2}$, and the positive solution is **${first}**, also written **${second}**. Exact form means the root stays: ${fixed(root, 2)} is the same number rounded, and it is not what was asked for.`,
      method: [`discriminant ${D}`, 'substitutes into the formula'],
      answerTex: first,
      accepted,
      check: { agrees: bad.length === 0 && largestSquareFactor(D) === 1 && D === b * b - 4 * c, detail: `wrong forms: ${bad.join(' | ')}` },
      values: { b, c, D },
    })
  },
}

// =======================================================================================
// Quadratic inequalities
// =======================================================================================

/** Reads "2 < x < 3", "3 > x > 2", "1 <= x <= 3", "1 ⩽ x ⩽ 3" into a test of x; null when it is none of them. */
export function intervalIn(typed: string): ((x: number) => boolean) | null {
  const s = typed.replace(/\s+/g, '').replace(/[⩽≤]/g, '<=').replace(/[⩾≥]/g, '>=')
  const m = /^(-?\d+)(<=|<|>=|>)x(<=|<|>=|>)(-?\d+)$/.exec(s)
  if (!m || m[2]![0] !== m[3]![0]) return null
  const lo = Number(m[1])
  const hi = Number(m[4])
  const up = m[2]![0] === '<'
  const strict = !m[2]!.includes('=')
  const [L, H] = up ? [lo, hi] : [hi, lo]
  return (x) => (strict ? L < x && x < H : L <= x && x <= H)
}

/** Test points across the number line, halves included, against what the printed inequality says. */
function inequalityCheck(prompt: string, accepted: string[], p: number, q: number): Check {
  const tex = mathIn(prompt)
  const { left, right, rel } = sides(tex)
  const f = polySub(polyOf(left)!, polyOf(right)!)
  const holds = (x: number) => (rel === '<' ? polyAt(f, x) < 0 : polyAt(f, x) <= 0)
  const bad = accepted.filter((a) => {
    const test = intervalIn(a)
    if (!test) return true
    for (let x = -25; x <= 25; x += 0.5) if (test(x) !== holds(x)) return true
    return false
  })
  // Either side of each root: positive outside, negative between.
  const sign = polyAt(f, p - 0.5) > 0 && polyAt(f, (p + q) / 2) < 0 && polyAt(f, q + 0.5) > 0 && polyAt(f, p) === 0 && polyAt(f, q) === 0
  return { agrees: bad.length === 0 && sign, detail: `wrong forms: ${bad.join(' | ')}; signs about ${p} and ${q}: ${sign}` }
}

/** The pair of roots p < q for a case: both positive, either side of 0, both negative. */
function drawRoots(r: Rng, kind: number): { p: number; q: number } {
  return draw(
    r,
    (r) => (kind === 0 ? { p: int(r, 1, 10), q: int(r, 1, 10) } : kind === 1 ? { p: -int(r, 1, 9), q: int(r, 1, 9) } : { p: -int(r, 1, 10), q: -int(r, 1, 10) }),
    ({ p, q }) => p < q,
  )
}
const ROOT_CASES = ['both positive', 'either side of zero', 'both negative']

/**
 * x^2 - 5x + 6 < 0 as q5 and x^2 - 7x + 12 < 0 as q7 (both on the higher sheet: `turn`
 * gives them different cases of roots), and x^2 + 3 ⩽ 4x as q11, rearranged first.
 */
export const quadraticInequalityInterval: Generator = {
  id: 'quadratic-inequality-interval',
  subjectId: 'maths',
  topicId: INEQ,
  replaces: ['q5', 'q7', 'q11'],
  build(r, slot, turn): Draft {
    if (slot.id === 'q11') {
      const { p, q } = draw(r, (r) => drawRoots(r, int(r, 0, 2)), ({ p, q }) => p + q !== 0 && p * q !== 0)
      const B = p + q
      const C = p * q
      const form = int(r, 0, 2)
      const le = '\\leqslant'
      const ineq = form === 0 ? `${poly([C, 0, 1])} ${le} ${lin(B, 0)}` : form === 1 ? `x^2 ${le} ${poly([-C, B])}` : `${poly([0, -B, 1])} ${le} ${-C}`
      const prompt = `Solve $${ineq}$. Give your answer in the form a ⩽ x ⩽ b.`
      const accepted = [`${p} <= x <= ${q}`, `${p} ⩽ x ⩽ ${q}`, `${p} ≤ x ≤ ${q}`, `${q} >= x >= ${p}`, `${q} ⩾ x ⩾ ${p}`, `${q} ≥ x ≥ ${p}`]
      return textDraft(slot, {
        prompt,
        solution: `$${poly([C, -B, 1])} ${le} 0$, factorising to $${factorsOf(p, q)} ${le} 0$: $${p} ${le} x ${le} ${q}$.`,
        method: [],
        answerTex: `${p} ⩽ x ⩽ ${q}`,
        accepted,
        check: inequalityCheck(prompt, accepted, p, q),
        values: { form, p, q },
      })
    }
    const kind = turn % 3
    const { p, q } = drawRoots(r, kind)
    const P = [p * q, -(p + q), 1]
    const prompt = `Solve $${poly(P)} < 0$. Give your answer in the form a < x < b.`
    const accepted = [`${p} < x < ${q}`, `${q} > x > ${p}`]
    return textDraft(slot, {
      prompt,
      solution: slot.id === 'q5'
        ? `Roots $${p}$ and $${q}$, curve opening upwards, below the axis between them: $${p} < x < ${q}$.`
        : `$${factorsOf(p, q)} < 0$, roots $${p}$ and $${q}$, so $${p} < x < ${q}$.`,
      method: [],
      answerTex: `${p} < x < ${q}`,
      accepted,
      check: inequalityCheck(prompt, accepted, p, q),
      values: { case: ROOT_CASES[kind]!, p, q },
    })
  },
}

/** How many integers satisfy x^2 - x - 12 ⩽ 0: written as q9. Sometimes strict, when the roots drop out. */
export const integersInAQuadraticInequality: Generator = {
  id: 'integers-in-a-quadratic-inequality',
  subjectId: 'maths',
  topicId: INEQ,
  replaces: ['q9'],
  build(r, slot): Draft {
    const strict = r() < 0.3
    const { p, q } = draw(r, (r) => ({ p: either(r, 9), q: either(r, 9) }), ({ p, q }) => q - p >= 3 && p + q !== 0)
    const P = [p * q, -(p + q), 1]
    const rel = strict ? '<' : '\\leqslant'
    const lo = strict ? p + 1 : p
    const hi = strict ? q - 1 : q
    const answer = hi - lo + 1
    const list = Array.from({ length: answer }, (_, i) => lo + i).join(', ')
    const prompt = `How many integer values of x satisfy $${poly(P)} ${rel} 0$?`
    // Second route: count by testing every whole number from -100 to 100 in the printed inequality.
    const f = equationPoly(mathIn(prompt))!
    let count = 0
    for (let x = -100; x <= 100; x++) if (strict ? polyAt(f, x) < 0 : polyAt(f, x) <= 0) count++
    return {
      question: {
        type: 'numeric',
        prompt,
        solution: strict
          ? `Roots $${p}$ and $${q}$, so $${p} < x < ${q}$: the roots themselves are not included. That is $${list}$: **${answer}** integers.`
          : `Roots $${p}$ and $${q}$, so $${p} \\leqslant x \\leqslant ${q}$. That is $${list}$: **${answer}** integers.`,
        markScheme: scheme(slot, [`roots ${String(p).replace('-', '−')} and ${String(q).replace('-', '−')}`], String(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: count === answer, detail: `counted ${count}` },
      values: { p, q, strict: String(strict) },
    }
  },
}

// =======================================================================================
// Quadratic curves
// =======================================================================================

/** The roots of y = x^2 + 2x - 8, typed with a comma: written as q5. */
export const rootsOfACurve: Generator = {
  id: 'roots-of-a-curve',
  subjectId: 'maths',
  topicId: CURVES,
  replaces: ['q5'],
  build(r, slot): Draft {
    const { r1, r2 } = draw(r, (r) => ({ r1: either(r, 10), r2: either(r, 10) }), ({ r1, r2 }) => r1 < r2)
    const P = [r1 * r2, -(r1 + r2), 1]
    const prompt = `Find the roots of $y = ${poly(P)}$. Give both values of x, separated by a comma.`
    const accepted = [`${r1}, ${r2}`, `${r2}, ${r1}`, `x = ${r1}, x = ${r2}`, `x = ${r2}, x = ${r1}`]
    const f = polyOf(fromTex(mathIn(prompt).replace(/^y = /, '')))!
    const bad = accepted.filter((a) => {
      const roots = rootsIn(a)
      return !roots || roots.length !== 2 || roots[0]![0] === roots[1]![0] || roots.some(([n, d]) => polyAtRational(f, n, d) !== 0)
    })
    return textDraft(slot, {
      prompt,
      solution: `$(${lin(1, -r1, 'x', true)})(${lin(1, -r2, 'x', true)}) = 0$, so $x = ${r1}$ or $x = ${r2}$.`,
      method: [],
      answerTex: `${r1} and ${r2}`,
      accepted,
      check: { agrees: bad.length === 0, detail: `not roots: ${bad.join(' | ')}` },
      values: { r1, r2 },
    })
  },
}

/** The turning point's x is midway between the roots: written as q6. */
export const turningPointFromRoots: Generator = {
  id: 'turning-point-from-roots',
  subjectId: 'maths',
  topicId: CURVES,
  replaces: ['q6'],
  build(r, slot): Draft {
    const { p, q } = draw(r, (r) => ({ p: int(r, -12, 14), q: int(r, -12, 14) }), ({ p, q }) => p < q && (p + q) % 2 === 0)
    const mid = (p + q) / 2
    const prompt = r() < 0.5
      ? `The roots of a quadratic are $x = ${p}$ and $x = ${q}$. What is the x coordinate of its turning point?`
      : `A quadratic curve crosses the x-axis at $x = ${p}$ and $x = ${q}$. What is the x coordinate of its turning point?`
    // Second route: y = (x - p)(x - q) is symmetric about its turning point, and -b/2a finds it.
    const f = polyMul([-p, 1], [-q, 1])
    const vertex = -f[1]! / (2 * f[2]!)
    let symmetric = true
    for (let t = 1; t <= 6; t++) if (polyAt(f, vertex - t) !== polyAt(f, vertex + t)) symmetric = false
    const accepted = [String(mid), `x = ${mid}`]
    return textDraft(slot, {
      prompt,
      solution: `The vertex is midway between the roots: $\\dfrac{${p} + ${signed(q)}}{2} = ${mid}$.`,
      method: [],
      answerTex: String(mid),
      accepted,
      check: { agrees: vertex === mid && symmetric && accepted.every((a) => Number(a.replace('x = ', '')) === vertex), detail: `-b/2a = ${vertex}` },
      values: { p, q },
    })
  },
}

const CURVE_NAMES = ['a curve', 'a parabola', 'a quadratic curve']

/** The line of symmetry through a turning point (3, -4) is x = 3: written as q8. */
export const lineOfSymmetry: Generator = {
  id: 'line-of-symmetry',
  subjectId: 'maths',
  topicId: CURVES,
  replaces: ['q8'],
  build(r, slot): Draft {
    const h = int(r, -12, 12)
    const k = int(r, -20, 20)
    const name = pick(r, CURVE_NAMES)
    // Second route: y = (x - h)^2 + k has equal heights either side of x = h, and its least value there.
    const f = polyAdd(polyMul([-h, 1], [-h, 1]), [k])
    let symmetric = true
    for (let t = 1; t <= 6; t++) if (polyAt(f, h - t) !== polyAt(f, h + t) || polyAt(f, h + t) <= polyAt(f, h)) symmetric = false
    return {
      question: {
        type: 'numeric',
        prompt: `The turning point of ${name} is at $(${h}, ${k})$. What is the equation of its line of symmetry? Give just the number after x =.`,
        solution: `The line of symmetry is vertical through the vertex: $x = ${h}$.`,
        markScheme: scheme(slot, [], `x = ${h}`),
        answer: h,
        tolerance: 0,
      },
      check: { agrees: symmetric && polyAt(f, h) === k, detail: `y = ${poly(f)} at x = ${h}: ${polyAt(f, h)}` },
      values: { h, k, name },
    }
  },
}

/** The y coordinate of the turning point of y = x^2 + 2x - 8, given x = -1: written as q10. */
export const turningPointY: Generator = {
  id: 'turning-point-y',
  subjectId: 'maths',
  topicId: CURVES,
  replaces: ['q10'],
  build(r, slot): Draft {
    const h = either(r, 8)
    const c = either(r, 20)
    const b = -2 * h
    const y = h * h + b * h + c
    const P = [c, b, 1]
    const prompt = `Find the y coordinate of the turning point of $y = ${poly(P)}$, given that its x coordinate is $${h}$.`
    const xs = h < 0 ? `(${h})` : String(h)
    const work = `${xs}^2 ${b < 0 ? '-' : '+'} ${Math.abs(b)}(${h}) ${constTerm(c)}`
    // Second route: completing the square, y = (x - h)^2 + (c - h^2), and the least value there.
    const bySquare = c - h * h
    return textDraft(slot, {
      prompt,
      solution: `Substitute $x = ${h}$: $${work} = ${sumOf([[h * h, 0], [b * h, 0], [c, 0]])} = ${y}$.`,
      method: [],
      answerTex: String(y),
      accepted: [String(y)],
      check: { agrees: bySquare === y && polyAt(P, h + 1) > y && polyAt(P, h - 1) > y, detail: `completing the square: ${bySquare}` },
      values: { h, c },
    })
  },
}

// =======================================================================================
// Algebraic fractions
// =======================================================================================

/** Points to compare two rational expressions at, clear of every pole the question has. */
const POINTS = [-7.5, -3.25, -1.7, 0.3, 1.9, 4.6, 9.1]

/** Each accepted form has the value of the printed expression at every test point, and no fraction inside a fraction. */
function sameValueCheck(promptTex: string, accepted: string[]): Check {
  const typed = fromTex(promptTex)
  const bad = accepted.filter((a) => POINTS.some((x) => {
    const want = valueOf(typed, { x })
    const got = valueOf(a, { x })
    return !Number.isFinite(want) || !(Math.abs(got - want) < 1e-9 * Math.max(1, Math.abs(want)))
  }))
  return { agrees: bad.length === 0, detail: bad.length ? `differ from ${typed}: ${bad.join(' | ')}` : `${accepted.length} forms equal ${typed} at ${POINTS.length} points` }
}

/** 2/(x + 1) + 3/(x + 1) = 5/(x + 1): written as q3. */
export const sameDenominatorFractions: Generator = {
  id: 'same-denominator-fractions',
  subjectId: 'maths',
  topicId: ALGFRAC,
  replaces: ['q3'],
  build(r, slot): Draft {
    const { u, k, a, b, add } = draw(
      r,
      (r) => ({ u: pick(r, [1, 1, 1, 2, 3]), k: either(r, 9), a: int(r, 1, 9), b: int(r, 1, 9), add: r() < 0.65 }),
      ({ u, k, a, b, add }) => gcd(u, k) === 1 && (add || a > b),
    )
    const den = lin(u, k, 'x', true)
    const N = add ? a + b : a - b
    const prompt = `Write $\\dfrac{${a}}{${den}} ${add ? '+' : '-'} \\dfrac{${b}}{${den}}$ as a single fraction in its simplest form.`
    const answer = `${N}/(${lin(u, k)})`
    return textDraft(slot, {
      prompt,
      solution: add
        ? `The denominators already match, so just add the tops: $${a} + ${b} = ${N}$, giving $\\dfrac{${N}}{${den}}$. The denominator is **not** doubled.`
        : `The denominators already match, so just subtract the tops: $${a} - ${b} = ${N}$, giving $\\dfrac{${N}}{${den}}$. The denominator does not change.`,
      method: [],
      answerTex: answer,
      accepted: [answer],
      check: sameValueCheck(mathIn(prompt), [answer]),
      values: { u, k, a, b, add: String(add) },
    })
  },
}

/** A numerator and its forms: 2x+11, and 2(x+5) as well when its terms share a factor. */
function numeratorForms(N: Poly): string[] {
  const g = gcd(N[0]!, N[1]!)
  const out = [`(${poly(N, 'x', false)})`]
  if (g > 1) out.push(`${g}(${poly(polyScale(N, 1 / g), 'x', false)})`)
  return out
}

/**
 * Two algebraic fractions as one: 5/(x - 2) - 3/(x + 1) as q8, and 1/(x^2 - 4) + 1/(x + 2) as
 * q12 (grade 8-9: one denominator already holds the other).
 */
export const addingAlgebraicFractions: Generator = {
  id: 'adding-algebraic-fractions',
  subjectId: 'maths',
  topicId: ALGFRAC,
  replaces: ['q8', 'q12'],
  build(r, slot): Draft {
    const add = r() < 0.5
    const op = add ? '+' : '-'
    const s = add ? 1 : -1
    if (slot.id === 'q12') {
      // m/((x+p)(x+q)) ± n/(x+p) = (m ± n(x+q)) / ((x+p)(x+q)).
      const v = draw(
        r,
        (r) => {
          const p = either(r, 6)
          return { p, q: r() < 0.5 ? -p : either(r, 6), m: int(r, 1, 5), n: pick(r, [1, 1, 2, 3]) }
        },
        ({ p, q, m, n }) => {
          const N = [m + s * n * q, s * n]
          const root = -N[0]! / N[1]!
          return p !== q && N[0] !== 0 && root !== -p && root !== -q
        },
      )
      const { p, q, m, n } = v
      const N = [m + s * n * q, s * n]
      const D = polyMul([p, 1], [q, 1])
      const fq = lin(1, q, 'x', true)
      const fp = lin(1, p, 'x', true)
      const den = `(${fq})(${fp})`
      const prompt = `Write $\\dfrac{${m}}{${poly(D)}} ${op} \\dfrac{${n}}{${fp}}$ as a single fraction in its simplest form.`
      const top = n === 1 ? fq : `${n}(${fq})`
      const nums = [...numeratorForms(N), `(${poly(N, 'x', false, true)})`]
      const accepted = [...nums.map((t) => `${t}/((${lin(1, q)})(${lin(1, p)}))`), ...nums.map((t) => `${t}/(${poly(D, 'x', false)})`)]
      const combined = add ? `${m} + ${n === 1 ? fq : poly([n * q, n], 'x')}` : `${m} - ${n === 1 ? `(${fq})` : `${n}(${fq})`}`
      return textDraft(slot, {
        prompt,
        solution: `$${poly(D)} = ${den}$, which already contains the second denominator, so the common denominator is $${den}$. Only the second fraction changes, becoming $\\dfrac{${top}}{${den}}$. ${add ? 'Adding' : 'Subtracting'} gives $\\dfrac{${combined}}{${den}} = \\dfrac{${poly(N)}}{${den}}$.`,
        method: [`uses ${den} as the common denominator`],
        answerTex: `(${poly(N)}) / (${den})`,
        accepted,
        check: rationalCheck(mathIn(prompt), accepted, [-p, -q], N),
        values: { p, q, m, n, add: String(add), dots: String(q === -p) },
      })
    }
    const v = draw(
      r,
      (r) => ({ a: int(r, 1, 9), b: int(r, 1, 9), p: either(r, 9), q: either(r, 9) }),
      ({ a, b, p, q }) => {
        const N = [a * q + s * b * p, a + s * b]
        if (p === q || N[1] === 0 || N[0] === 0) return false
        const root = -N[0]! / N[1]!
        return root !== -p && root !== -q
      },
    )
    const { a, b, p, q } = v
    const N = [a * q + s * b * p, a + s * b]
    const fp = lin(1, p, 'x', true)
    const fq = lin(1, q, 'x', true)
    const den = `(${fp})(${fq})`
    const D = polyMul([p, 1], [q, 1])
    const prompt = `Write $\\dfrac{${a}}{${fp}} ${op} \\dfrac{${b}}{${fq}}$ as a single fraction in its simplest form.`
    const topA = a === 1 ? fq : `${a}(${fq})`
    const topB = b === 1 ? fp : `${b}(${fp})`
    const first = poly([a * q, a])
    const second = poly([b * p, b])
    const working = add
      ? `Adding: $${first} + ${second} = ${poly(N)}$.`
      : `Bracket the second one before expanding: $${first} - (${second}) = ${sumOf([[a, 1], [a * q, 0], [-b, 1], [-b * p, 0]])} = ${poly(N)}$.`
    const nums = [...numeratorForms(N), `(${poly(N, 'x', false, true)})`]
    const accepted = [...nums.map((t) => `${t}/((${lin(1, p)})(${lin(1, q)}))`), ...nums.map((t) => `${t}/(${poly(D, 'x', false)})`)]
    return textDraft(slot, {
      prompt,
      solution: `Over $${den}$ the tops are $${topA}$ and $${topB}$. ${working} So the answer is $\\dfrac{${poly(N)}}{${den}}$.`,
      method: [`${topA} ${op} ${!add && b === 1 ? `(${fp})` : topB} over ${den}`],
      answerTex: `(${poly(N)}) / (${den})`,
      accepted,
      check: rationalCheck(mathIn(prompt), accepted, [-p, -q], N),
      values: { a, b, p, q, add: String(add) },
    })
  },
}

/** Same value as the prompt at every test point, and in its simplest form: the numerator vanishes at neither pole. */
function rationalCheck(promptTex: string, accepted: string[], poles: number[], N: Poly): Check {
  const same = sameValueCheck(promptTex, accepted)
  const simplest = poles.every((x) => polyAt(N, x) !== 0)
  return { agrees: same.agrees && simplest, detail: `${same.detail}; numerator at the poles: ${poles.map((x) => polyAt(N, x)).join(', ')}` }
}

/** 3/(x - 2) = 5/(x + 2), so x = 8: written as q14. */
export const algebraicFractionEquation: Generator = {
  id: 'algebraic-fraction-equation',
  subjectId: 'maths',
  topicId: ALGFRAC,
  replaces: ['q14'],
  build(r, slot): Draft {
    const v = draw(
      r,
      (r) => ({ a: int(r, 1, 9), b: int(r, 1, 9), p: either(r, 9), q: either(r, 9) }),
      ({ a, b, p, q }) => {
        if (a === b || p === q) return false
        const x = (b * p - a * q) / (a - b)
        return Number.isInteger(x) && x + p !== 0 && x + q !== 0 && Math.abs(x) <= 30 && x !== 0
      },
    )
    const { a, b, p, q } = v
    const x = (b * p - a * q) / (a - b)
    const fp = lin(1, p, 'x', true)
    const fq = lin(1, q, 'x', true)
    const times = (k: number, f: string) => (k === 1 ? f : `${k}(${f})`)
    const cross = `${times(a, fq)} = ${times(b, fp)}`
    const lhs = poly([a * q, a])
    const rhs = poly([b * p, b])
    // ax + aq = bx + bp: the letter goes to the side where it stays positive.
    const collect = b > a
      ? `${a * q - b * p} = ${lin(b - a, 0)}`
      : `${lin(a - b, 0)} = ${b * p - a * q}`
    const giving = collect.startsWith('x =') ? `Then $${collect}$.` : `Then $${collect}$, giving $x = ${x}$.`
    // Second route: substitute x back as a whole number into each side of the printed equation.
    const tex = `\\dfrac{${a}}{${fp}} = \\dfrac{${b}}{${fq}}`
    const { left, right } = sides(tex)
    const L = valueOf(left, { x })
    const R = valueOf(right, { x })
    return {
      question: {
        type: 'numeric',
        prompt: `Solve $${tex}$.`,
        solution: `Cross-multiply: $${cross}$, so $${lhs} = ${rhs}$. ${giving} Check the original denominators at $x = ${x}$: they are $${x + p}$ and $${x + q}$, neither zero, so $x = ${x}$ stands.`,
        markScheme: scheme(slot, [`cross-multiplies to ${cross}`, `${lhs} = ${rhs}`], `x = ${x}`),
        answer: x,
        tolerance: 0,
      },
      check: { agrees: a * (x + q) === b * (x + p) && Math.abs(L - R) < 1e-12 && x + p !== 0 && x + q !== 0, detail: `at x = ${x}: ${L} and ${R}` },
      values: { a, b, p, q },
    }
  },
}

/** Every generator in this file. */
export const quadraticsGenerators: Generator[] = [
  expandingDoubleBrackets,
  expandingThreeBrackets,
  factorisingQuadratics,
  differenceOfTwoSquares,
  quadraticCommonFactor,
  differenceOfSquaresNumbers,
  perimeterFromArea,
  collectingLikeTerms,
  expandingBrackets,
  factorisingANumber,
  coefficientOfX,
  factorisingWithALetter,
  solvingByFactorising,
  solvingBySquareRoots,
  solvingByFactorisingAAbove1,
  completingTheSquare,
  quadraticFormula,
  formingAQuadratic,
  quadraticFormulaExact,
  quadraticInequalityInterval,
  integersInAQuadraticInequality,
  rootsOfACurve,
  turningPointFromRoots,
  lineOfSymmetry,
  turningPointY,
  sameDenominatorFractions,
  addingAlgebraicFractions,
  algebraicFractionEquation,
]
