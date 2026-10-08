import type { Question } from '../../content/questions.ts'
import { clearOfHalf, fixed, roundTo, show } from '../format.ts'
import { draw, int, pick, shuffle, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'

/* ------------------------------------------------------------------------------------------
 * Shared helpers for the algebra generators (formulae, lines, sequences, equations).
 * ---------------------------------------------------------------------------------------- */

/**
 * A sum of terms as the content prints it: [3, 'x'], [-1, 'y'], [4, ''] is 3x - y + 4.
 * Never `+ -3`, `1x` or `-1x`; a zero term is left out, and nothing at all prints 0. The
 * letter part is printed as given, so a caller writes 'x^2', never 'x^1'. `spaced` is for
 * TeX; unspaced is the typed form an accepted answer is written in.
 */
export function sum(parts: readonly (readonly [number, string])[], spaced = true): string {
  const kept = parts.filter(([c]) => c !== 0)
  if (kept.length === 0) return '0'
  return kept
    .map(([c, v], i) => {
      const size = Math.abs(c)
      const body = v === '' ? show(size) : size === 1 ? v : `${show(size)}${v}`
      if (i === 0) return c < 0 ? `-${body}` : body
      const sign = c < 0 ? '-' : '+'
      return spaced ? ` ${sign} ${body}` : `${sign}${body}`
    })
    .join('')
}

/** A number as it is substituted into a formula: negatives in brackets, (−3). */
export const sub = (n: number) => (n < 0 ? `(${show(n)})` : show(n))

/** The coefficient in front of a letter: 1 prints nothing, −1 prints a minus. */
export const coef = (n: number, letter: string) => (n === 1 ? letter : n === -1 ? `-${letter}` : `${show(n)}${letter}`)

export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))

/** n/d in lowest terms with a positive denominator. */
export function reduce(n: number, d: number): [number, number] {
  const g = gcd(n, d) || 1
  return d < 0 ? [-n / g, -d / g] : [n / g, d / g]
}

/** A reduced fraction in TeX: 3, -\tfrac{1}{2}. */
export function fracTex(n: number, d: number, style = '\\tfrac'): string {
  const [p, q] = reduce(n, d)
  if (q === 1) return String(p)
  return `${p < 0 ? '-' : ''}${style}{${Math.abs(p)}}{${q}}`
}

/** A reduced fraction typed: 3, -1/2. */
export function fracText(n: number, d: number): string {
  const [p, q] = reduce(n, d)
  return q === 1 ? String(p) : `${p}/${q}`
}

/** Whether n/d is a terminating decimal. */
export function terminates(n: number, d: number): boolean {
  let q = reduce(n, d)[1]
  while (q % 2 === 0) q /= 2
  while (q % 5 === 0) q /= 5
  return q === 1
}

/**
 * The value of a formula as printed in TeX, for the second method: what the student reads,
 * with the numbers put in, worked out by reading the text rather than by the code that wrote
 * it. Reads numbers, single letters (with a subscript, E_k), \pi, \dfrac/\tfrac/\frac,
 * \sqrt and \sqrt[n], powers, brackets, \times, \div and implicit multiplication. Throws on
 * anything else, so a check cannot pass by misreading.
 */
export function evalTex(tex: string, vars: Record<string, number> = {}): number {
  const s = tex
    .replace(/\\left|\\right|\\,|\\;|\\!/g, '')
    .replace(/\\dfrac|\\tfrac/g, '\\frac')
    .replace(/\\times|\\cdot/g, '*')
    .replace(/\\div/g, '/')
    .replace(/\s+/g, '')
  let i = 0
  const fail = (): never => {
    throw new Error(`evalTex cannot read "${tex}" at ${i}`)
  }
  const group = (): number => {
    if (s[i] !== '{') fail()
    i++
    const v = expr()
    if (s[i] !== '}') fail()
    i++
    return v
  }
  const primary = (): number => {
    if (s.startsWith('\\frac', i)) {
      i += 5
      const a = group()
      return a / group()
    }
    if (s.startsWith('\\sqrt', i)) {
      i += 5
      let n = 2
      if (s[i] === '[') {
        const j = s.indexOf(']', i)
        n = Number(s.slice(i + 1, j))
        i = j + 1
      }
      const v = group()
      return n === 3 ? Math.cbrt(v) : v ** (1 / n)
    }
    if (s.startsWith('\\pi', i)) {
      i += 3
      return Math.PI
    }
    if (s[i] === '(') {
      i++
      const v = expr()
      if (s[i] !== ')') fail()
      i++
      return v
    }
    if (s[i] === '{') return group()
    const num = /^\d+(\.\d+)?/.exec(s.slice(i))
    if (num) {
      i += num[0].length
      return Number(num[0])
    }
    if (/[a-zA-Z]/.test(s[i] ?? '')) {
      let name = s[i++]!
      if (s[i] === '_') {
        i++
        if (s[i] === '{') {
          const j = s.indexOf('}', i)
          name += `_${s.slice(i + 1, j)}`
          i = j + 1
        } else name += `_${s[i++]}`
      }
      if (!(name in vars)) fail()
      return vars[name]!
    }
    return fail()
  }
  const power = (): number => {
    const b = primary()
    if (s[i] !== '^') return b
    i++
    if (s[i] === '{') return b ** group()
    const d = /^\d/.exec(s.slice(i)) ?? fail()
    i++
    return b ** Number(d[0])
  }
  const startsPrimary = () => /[\d(a-zA-Z{]/.test(s[i] ?? '') || s.startsWith('\\frac', i) || s.startsWith('\\sqrt', i) || s.startsWith('\\pi', i)
  const factor = (): number => {
    if (s[i] === '-') {
      i++
      return -factor()
    }
    return power()
  }
  const term = (): number => {
    let v = factor()
    for (;;) {
      if (s[i] === '*') {
        i++
        v *= factor()
      } else if (s[i] === '/') {
        i++
        v /= factor()
      } else if (startsPrimary()) v *= power()
      else return v
    }
  }
  const expr = (): number => {
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

/** Left side minus right side of a printed equation, at the given values. */
export function evalEquation(tex: string, vars: Record<string, number>): number {
  const [l, r, ...rest] = tex.split('=')
  if (r === undefined || rest.length) throw new Error(`not one equation: ${tex}`)
  return evalTex(l!, vars) - evalTex(r, vars)
}

export const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b))

type Builder = (r: Rng, slot: Question, turn: number) => Draft

/**
 * One generator for several written questions, each with its own builder: the written sheet
 * spreads different tasks across the slots, and each slot keeps its own.
 */
export function bySlot(id: string, topicId: string, builders: Record<string, Builder>): Generator {
  return {
    id,
    subjectId: 'maths',
    topicId,
    replaces: Object.keys(builders),
    build(r, slot, turn) {
      const b = builders[slot.id]
      if (!b) throw new Error(`${id} has no builder for ${slot.id}`)
      return b(r, slot, turn)
    },
  }
}

/** Letters for a formula made up for practice: no e, i, j, l or o, which read as numbers, π's i or each other. */
export const LETTERS = 'abcdfghkmnpqrstuvwxyz'.split('')
export const letters = (r: Rng, n: number) => shuffle(r, LETTERS).slice(0, n)

/** x rounded to `sf` significant figures. */
export function sigFig(x: number, sf: number): number {
  const p = sf - 1 - Math.floor(Math.log10(Math.abs(x)))
  return Number(roundTo(x, p).toFixed(Math.max(0, p)))
}
const sfPlaces = (x: number, sf: number) => Math.max(0, sf - 1 - Math.floor(Math.log10(Math.abs(x))))
/** x to `sf` significant figures as printed, keeping a trailing zero: 10.0, 3.90. */
export const sfText = (x: number, sf: number) => sigFig(x, sf).toFixed(sfPlaces(x, sf))
const clearOfHalfSf = (x: number, sf: number) => clearOfHalf(x, sfPlaces(x, sf))
/** Half a unit in the last significant figure: the tolerance of a rounded answer. */
const halfUnitSf = (x: number, sf: number) => 0.5 * 10 ** -sfPlaces(x, sf)

/** Solves f(x) = 0 on [lo, hi] by halving, for the second method of a rearranged formula. */
export function bisect(f: (x: number) => number, lo: number, hi: number): number {
  let a = lo
  let b = hi
  const fa = f(a)
  for (let k = 0; k < 200; k++) {
    const m = (a + b) / 2
    if (f(m) * fa > 0) a = m
    else b = m
  }
  return (a + b) / 2
}

/* ------------------------------------------------------------------------------------------
 * Substituting into formulae
 * ---------------------------------------------------------------------------------------- */

const SUB = 'substituting-into-formulae'
const PAIRS = [['a', 'b'], ['x', 'y'], ['p', 'q'], ['m', 'n'], ['s', 't'], ['c', 'd'], ['u', 'v'], ['g', 'h']] as const

/** The printed value of a formula agrees with the answer worked step by step. */
const agrees = (formula: string, vars: Record<string, number>, answer: number) => {
  const read = evalTex(formula, vars)
  return { agrees: near(read, answer), detail: `${formula} read with ${JSON.stringify(vars)}: ${read}` }
}

/** q1: 3a + 2b with positive values. q3: 5x − y with a negative value taken away. */
function linearExpression(r: Rng, slot: Question): Draft {
  const [a, b] = pick(r, PAIRS)
  if (slot.id === 'q1') {
    const p = int(r, 2, 9)
    const q = int(r, 2, 9)
    const va = int(r, 1, 12)
    const vb = int(r, 1, 12)
    const expr = `${p}${a} + ${q}${b}`
    const answer = p * va + q * vb
    return {
      question: {
        type: 'numeric',
        prompt: `Work out the value of $${expr}$ when $${a} = ${va}$ and $${b} = ${vb}$.`,
        solution: `$${p}(${va}) + ${q}(${vb}) = ${p * va} + ${q * vb} = ${answer}$.`,
        markScheme: scheme(slot, [], String(answer)),
        answer,
        tolerance: 0,
      },
      check: agrees(expr, { [a]: va, [b]: vb }, answer),
      values: { kind: 'positive', p, q, [a]: va, [b]: vb },
    }
  }
  const p = int(r, 2, 9)
  const q = pick(r, [1, 1, 2, 3, 4])
  const va = int(r, 1, 9)
  const vb = -int(r, 1, 9)
  const expr = `${p}${a} - ${coef(q, b)}`
  const answer = p * va - q * vb
  const second = q === 1 ? `(${vb})` : `${q}(${vb})`
  return {
    question: {
      type: 'numeric',
      prompt: `Work out the value of $${expr}$ when $${a} = ${va}$ and $${b} = ${vb}$.`,
      solution: `$${p}(${va}) - ${second} = ${p * va} + ${-q * vb} = ${answer}$. Subtracting a negative adds.`,
      markScheme: scheme(slot, [], String(answer)),
      answer,
      tolerance: 0,
    },
    check: agrees(expr, { [a]: va, [b]: vb }, answer),
    values: { kind: 'subtract a negative', p, q, [a]: va, [b]: vb },
  }
}

/** q2: a formula in words with a decimal to put in, as P = 2l + 2w with l = 8.5. */
function decimalSubstitution(r: Rng, slot: Question): Draft {
  const kind = pick(r, ['perimeter', 'hire', 'cooking'] as const)
  if (kind === 'perimeter') {
    const L = int(r, 2, 19) + 0.5
    const w = int(r, 2, 12)
    const answer = 2 * L + 2 * w
    return {
      question: {
        type: 'numeric',
        prompt: `The perimeter of a rectangle is $P = 2l + 2w$. Work out $P$ when $l = ${show(L)}$ cm and $w = ${w}$ cm.`,
        solution: `$P = 2(${show(L)}) + 2(${w}) = ${show(2 * L)} + ${2 * w} = ${show(answer)}$ cm.`,
        markScheme: scheme(slot, [`2 × ${show(L)} + 2 × ${w}`], show(answer)),
        answer,
        tolerance: 0,
        units: 'cm',
      },
      check: agrees('2l + 2w', { l: L, w }, answer),
      values: { kind, l: L, w },
    }
  }
  if (kind === 'hire') {
    const rate = pick(r, [2.5, 3.5, 4.5, 1.5, 5.5, 6.5])
    const fee = int(r, 2, 15)
    const h = int(r, 2, 9)
    const answer = rate * h + fee
    return {
      question: {
        type: 'numeric',
        prompt: `The cost in pounds of hiring a bike for $h$ hours is $C = ${show(rate)}h + ${fee}$. Work out $C$ when $h = ${h}$.`,
        solution: `$C = ${show(rate)}(${h}) + ${fee} = ${show(rate * h)} + ${fee} = ${show(answer)}$, so £${fixed(answer, 2).replace(/\.00$/, '')}.`,
        markScheme: scheme(slot, [`${show(rate)} × ${h} + ${fee}`], show(answer)),
        answer,
        tolerance: 0,
      },
      check: agrees(`${show(rate)}h + ${fee}`, { h }, answer),
      values: { kind, rate, fee, h },
    }
  }
  const per = pick(r, [40, 45, 50, 30, 35])
  const extra = pick(r, [20, 25, 30, 15])
  const W = int(r, 1, 7) + 0.5
  const answer = per * W + extra
  return {
    question: {
      type: 'numeric',
      prompt: `The time in minutes to roast a joint of meat weighing $w$ kg is $T = ${per}w + ${extra}$. Work out $T$ when $w = ${show(W)}$.`,
      solution: `$T = ${per}(${show(W)}) + ${extra} = ${show(per * W)} + ${extra} = ${show(answer)}$ minutes.`,
      markScheme: scheme(slot, [`${per} × ${show(W)} + ${extra}`], show(answer)),
      answer,
      tolerance: 0,
      units: 'minutes',
    },
    check: agrees(`${per}w + ${extra}`, { w: W }, answer),
    values: { kind, per, extra, w: W },
  }
}

/** q5: v = u + at with a negative acceleration. */
function suvatV(r: Rng, slot: Question): Draft {
  const u = int(r, 5, 30)
  const a = -int(r, 1, 9)
  const t = int(r, 2, 9)
  const answer = u + a * t
  return {
    question: {
      type: 'numeric',
      prompt: `$v = u + at$. Work out $v$ when $u = ${u}$, $a = ${a}$ and $t = ${t}$.`,
      solution: `$v = ${u} + (${a})(${t}) = ${u} - ${-a * t} = ${answer}$.`,
      markScheme: scheme(slot, [`${u} + (${a}) × ${t}`.replace(/-/g, '−')], String(answer).replace('-', '−')),
      answer,
      tolerance: 0,
    },
    check: agrees('u + at', { u, a, t }, answer),
    values: { u, a, t },
  }
}

/** q6: x² − 3x when x is negative. */
function negativeIntoQuadratic(r: Rng, slot: Question): Draft {
  const { a, c, x } = draw(
    r,
    (r) => ({ a: pick(r, [1, 1, 1, 2, 3]), c: pick(r, [-1, 1]) * int(r, 1, 9), x: -int(r, 2, 9) }),
    ({ a, c, x }) => a * x * x + c * x !== 0,
  )
  const expr = sum([[a, 'x^2'], [c, 'x']])
  const sq = a * x * x
  const lin = c * x
  const answer = sq + lin
  const first = a === 1 ? `(${x})^2` : `${a}(${x})^2`
  const second = `${c < 0 ? '-' : '+'} ${Math.abs(c) === 1 ? '' : Math.abs(c)}(${x})`
  const why = `A negative squared is positive, and $${c} \\times (${x})$ is $${lin > 0 ? '+' : ''}${lin}$.`
  return {
    question: {
      type: 'numeric',
      prompt: `Work out the value of $${expr}$ when $x = ${x}$.`,
      solution: `$${first} ${second} = ${sum([[sq, ''], [lin, '']])} = ${answer}$. ${why}`,
      markScheme: scheme(slot, [`${first.replace(/\^2/, '²')} ${second}, or ${sq} and ${Math.abs(lin)} seen`.replace(/-/g, '−')], String(answer).replace('-', '−')),
      answer,
      tolerance: 0,
    },
    check: agrees(expr, { x }, answer),
    values: { a, c, x },
  }
}

/** q7: E = ½mv². */
function kineticEnergy(r: Rng, slot: Question): Draft {
  const { m, v } = draw(r, (r) => ({ m: int(r, 1, 20), v: int(r, 2, 12) }), ({ m, v }) => (m * v * v) % 2 === 0 && m !== 2)
  const answer = (m * v * v) / 2
  return {
    question: {
      type: 'numeric',
      prompt: `$E_k = \\tfrac{1}{2}mv^2$. Work out $E_k$ when $m = ${m}$ and $v = ${v}$.`,
      solution: `$E_k = \\tfrac{1}{2} \\times ${m} \\times ${v}^2 = \\tfrac{1}{2} \\times ${m} \\times ${v * v} = ${answer}$. The square is on the $v$ alone.`,
      markScheme: scheme(slot, [`½ × ${m} × ${v * v}`], String(answer)),
      answer,
      tolerance: 0,
    },
    check: agrees('\\tfrac{1}{2}mv^2', { m, v }, answer),
    values: { m, v },
  }
}

/** q8: (a + 3b)/(a − b) with b negative, coming out as a decimal. */
function algebraicFraction(r: Rng, slot: Question): Draft {
  const [A, B] = pick(r, PAIRS)
  const { a, b, k, top, bottom } = draw(
    r,
    (r) => {
      const a = int(r, 2, 12)
      const b = -int(r, 1, 6)
      const k = pick(r, [-1, 1]) * int(r, 2, 5)
      return { a, b, k, top: a + k * b, bottom: a - b }
    },
    ({ top, bottom }) => top !== 0 && terminates(top, bottom) && Math.abs(top / bottom) <= 10 && top % bottom !== 0,
  )
  const answer = top / bottom
  const expr = `\\dfrac{${A} ${k < 0 ? '-' : '+'} ${Math.abs(k)}${B}}{${A} - ${B}}`
  const [n, d] = reduce(top, bottom)
  const cancel = n === top && d === bottom ? '' : ` = ${fracTex(top, bottom, '\\dfrac')}`
  return {
    question: {
      type: 'numeric',
      prompt: `Work out the value of $${expr}$ when $${A} = ${a}$ and $${B} = ${b}$.`,
      solution: `Top: $${a} ${k < 0 ? '-' : '+'} ${Math.abs(k)}(${b}) = ${top}$. Bottom: $${a} - (${b}) = ${bottom}$. So $\\dfrac{${top}}{${bottom}}${cancel} = ${show(answer)}$.`,
      markScheme: scheme(slot, [`numerator ${top} or denominator ${bottom}`.replace(/-/g, '−')], `${show(answer)} or ${fracText(top, bottom)}`.replace(/-/g, '−')),
      answer,
      tolerance: 0,
    },
    check: agrees(expr, { [A]: a, [B]: b }, answer),
    values: { a, b, k },
  }
}

/** q9: s = ut + ½at² with a negative. */
function suvatS(r: Rng, slot: Question): Draft {
  const { u, t, a } = draw(r, (r) => ({ u: int(r, 1, 20), t: int(r, 2, 8), a: -int(r, 1, 10) }), ({ t, a }) => (a * t * t) % 2 === 0)
  const ut = u * t
  const half = (a * t * t) / 2
  const answer = ut + half
  return {
    question: {
      type: 'numeric',
      prompt: `$s = ut + \\tfrac{1}{2}at^2$. Work out $s$ when $u = ${u}$, $t = ${t}$ and $a = ${a}$.`,
      solution: `$ut = ${u} \\times ${t} = ${ut}$ and $\\tfrac{1}{2} \\times (${a}) \\times ${t}^2 = ${half}$, so $s = ${ut} - ${-half} = ${answer}$.`,
      markScheme: scheme(slot, [`${ut} and ${half} seen`.replace(/-/g, '−')], String(answer).replace('-', '−')),
      answer,
      tolerance: 0,
    },
    check: agrees('ut + \\tfrac{1}{2}at^2', { u, t, a }, answer),
    values: { u, t, a },
  }
}

/** q10: v = u + at, find a or t. */
function suvatSolve(r: Rng, slot: Question, turn: number): Draft {
  const find = (['a', 't'] as const)[turn % 2]!
  const u = int(r, 0, 30)
  const a = r() < 0.25 ? -int(r, 2, 4) : int(r, 2, 9)
  const t = int(r, 2, 12)
  const v = u + a * t
  const other = find === 'a' ? t : a
  const answer = find === 'a' ? a : t
  const given = find === 'a' ? `$v = ${v}$, $u = ${u}$ and $t = ${t}$` : `$v = ${v}$, $u = ${u}$ and $a = ${a}$`
  const rhs = sum([[u, ''], [other, find]])
  const diff = v - u
  const solution = `Substitute: $${v} = ${rhs}$. Subtract ${u}: $${diff} = ${coef(other, find)}$. Divide by ${sub(other)}: $${find} = ${answer}$. Check: $${u} + ${sub(a)} \\times ${t} = ${v}$ ✓.`
  const minus = (s: string) => s.replace(/-/g, '−')
  return {
    question: {
      type: 'numeric',
      prompt: `$v = u + at$. Find $${find}$ when ${given}.`,
      solution,
      markScheme: scheme(slot, [minus(`${v} = ${rhs}`), minus(`${diff} = ${coef(other, find)}, or ${find} = (${v} - ${u}) ÷ ${sub(other)}`)], minus(String(answer))),
      answer,
      tolerance: 0,
    },
    check: agrees('u + at', { u, a, t }, v),
    values: { find, u, a, t, v },
  }
}

/** q12: the trapezium area formula, find the height. */
function trapeziumHeight(r: Rng, slot: Question): Draft {
  const { a, b, h } = draw(r, (r) => ({ a: int(r, 2, 15), b: int(r, 2, 15), h: int(r, 2, 15) }), ({ a, b, h }) => a !== b && ((a + b) * h) % 2 === 0)
  const A = ((a + b) * h) / 2
  const half = (a + b) / 2
  return {
    question: {
      type: 'numeric',
      prompt: `The area of a trapezium is $A = \\tfrac{1}{2}(a + b)h$. A trapezium has parallel sides $a = ${a}$ cm and $b = ${b}$ cm, and an area of ${A} cm². Find its height $h$.`,
      solution: `Substitute: $${A} = \\tfrac{1}{2}(${a} + ${b})h = ${show(half)}h$. Divide by ${show(half)}: $h = ${h}$ cm.`,
      markScheme: scheme(slot, [`${A} = ½ × ${a + b} × h, or ${A} = ${show(half)}h`], String(h)),
      answer: h,
      tolerance: 0,
      units: 'cm',
    },
    check: agrees('\\tfrac{1}{2}(a + b)h', { a, b, h }, A),
    values: { a, b, h, A },
  }
}

/** n(n + k)/d = target: the stories behind q14, each solved by a quadratic with one root that makes sense. */
const QUADRATIC_STORIES = [
  {
    kind: 'diagonals',
    k: -3,
    halve: true,
    letter: 'n',
    least: 5,
    most: 30,
    prompt: (t: number) => `A polygon with $n$ sides has $d = \\dfrac{n(n - 3)}{2}$ diagonals. A polygon has ${t} diagonals. How many sides does it have?`,
    reject: (x: number) => `A polygon cannot have $${x}$ sides`,
  },
  {
    kind: 'handshakes',
    k: -1,
    halve: true,
    letter: 'n',
    least: 4,
    most: 30,
    prompt: (t: number) => `When $n$ people each shake hands once with everyone else, there are $h = \\dfrac{n(n - 1)}{2}$ handshakes. At a meeting there were ${t} handshakes. How many people were there?`,
    reject: (x: number) => `There cannot be $${x}$ people`,
  },
  {
    kind: 'league',
    k: -1,
    halve: false,
    letter: 'n',
    least: 4,
    most: 24,
    prompt: (t: number) => `In a league of $n$ teams, every team plays every other team at home and away, so there are $m = n(n - 1)$ matches. A league has ${t} matches. How many teams are in it?`,
    reject: (x: number) => `A league cannot have $${x}$ teams`,
  },
  {
    kind: 'rectangle',
    k: 0,
    halve: false,
    letter: 'w',
    least: 2,
    most: 15,
    prompt: (t: number, k: number) => `A rectangle is $w$ cm wide and ${k} cm longer than it is wide, so its area is $A = w(w + ${k})$ cm². Its area is ${t} cm². How wide is it?`,
    reject: (x: number) => `A width cannot be $${x}$ cm`,
  },
] as const

/** q14: substitute, then solve the quadratic and reject the root that makes no sense. */
function quadraticFormula(r: Rng, slot: Question): Draft {
  const story = pick(r, QUADRATIC_STORIES)
  const k = story.kind === 'rectangle' ? int(r, 1, 9) : story.k
  const n = int(r, story.least, story.most)
  const product = n * (n + k)
  const target = story.halve ? product / 2 : product
  const L = story.letter
  const other = -(n + k)
  const bracket = (p: number) => `(${L} ${p < 0 ? '-' : '+'} ${Math.abs(p)})`
  const quad = sum([[1, `${L}^2`], [k, L], [-product, '']])
  const factored = `${bracket(-n)}${bracket(n + k)}`
  const setUp = story.halve
    ? `$${target} = \\dfrac{${L}(${sum([[1, L], [k, '']])})}{2}$, so $${L}(${sum([[1, L], [k, '']])}) = ${product}$`
    : `$${target} = ${L}(${sum([[1, L], [k, '']])})$`
  const checkText = story.halve ? `$\\dfrac{${n} \\times ${n + k}}{2} = ${target}$ ✓` : `$${n} \\times ${n + k} = ${target}$ ✓`
  // Second route: try each whole number in turn until the formula reaches the target.
  let trial = 0
  while (trial < 1000 && (story.halve ? (trial * (trial + k)) / 2 : trial * (trial + k)) < target) trial++
  return {
    question: {
      type: 'numeric',
      prompt: story.prompt(target, k),
      solution: `Substitute: ${setUp}. That is $${quad} = 0$, which factorises as $${factored} = 0$. ${story.reject(other)}, so $${L} = ${n}$. Check: ${checkText}.`,
      markScheme: scheme(slot, [`${L}(${sum([[1, L], [k, '']])}) = ${product}`.replace(/-/g, '−'), `${factored} = 0, or ${n} found by trial with ${n} × ${n + k} = ${product}`.replace(/-/g, '−')], String(n)),
      answer: n,
      tolerance: 0,
      ...(story.kind === 'rectangle' ? { units: 'cm' } : {}),
    },
    check: { agrees: trial === n && other <= 0 && (story.halve ? product % 2 === 0 : true), detail: `by trial ${trial}; other root ${other}` },
    values: { kind: story.kind, n, k, target },
  }
}

/** q15: h = 2 + 14t − 5t², back at the starting height. */
function backToStart(r: Rng, slot: Question): Draft {
  const h0 = int(r, 2, 20) / 2
  const b = draw(r, (r) => int(r, 6, 30), (b) => b % 5 !== 0 || r() < 0.2)
  const t = b / 5
  const formula = `${show(h0)} + ${b}t - 5t^2`
  return {
    question: {
      type: 'numeric',
      prompt: `A ball is thrown upwards from a height of ${show(h0)} m. Its height in metres after $t$ seconds is $h = ${formula}$. After how many seconds is it back at a height of ${show(h0)} m?`,
      solution: `Substitute $h = ${show(h0)}$: $${show(h0)} = ${formula}$, so $${b}t - 5t^2 = 0$. Factorise: $t(${b} - 5t) = 0$, so $t = 0$ or $t = ${show(t)}$. At $t = 0$ the ball is just being thrown, so it is back at ${show(h0)} m after $${show(t)}$ seconds.`,
      markScheme: scheme(slot, [`${show(h0)} = ${show(h0)} + ${b}t − 5t²`, `t(${b} − 5t) = 0`], `${show(t)}, rejecting t = 0`),
      answer: t,
      tolerance: 0,
      units: 's',
    },
    check: { agrees: near(evalTex(formula, { t }), h0) && t > 0, detail: `h at t = ${t}: ${evalTex(formula, { t })}` },
    values: { h0, b },
  }
}

const GRAVITY = [
  { g: 9.8, where: '' },
  { g: 9.81, where: '' },
  { g: 3.7, where: ' on Mars' },
  { g: 1.6, where: ' on the Moon' },
] as const

/** l = gT²/(4π²), and the same found without rearranging, by halving an interval. */
function pendulumLength(r: Rng, dp: number | 'sf3') {
  return draw(
    r,
    (r) => {
      const { g, where } = pick(r, GRAVITY)
      const T = int(r, 5, 50) / 10
      return { g, where, T, l: (g * T * T) / (4 * Math.PI * Math.PI) }
    },
    ({ l }) => l >= 0.25 && l <= 20 && (dp === 'sf3' ? clearOfHalfSf(l, 3) : clearOfHalf(l, dp)),
  )
}
const periodOf = (l: number, g: number) => evalTex('2\\pi\\sqrt{\\dfrac{l}{g}}', { l, g })

/** q17: the pendulum length for a given period, to 2 d.p. */
function pendulum(r: Rng, slot: Question): Draft {
  const { g, where, T, l } = pendulumLength(r, 2)
  const answer = roundTo(l, 2)
  const Ts = show(T)
  const gs = show(g)
  const byHalving = bisect((x) => periodOf(x, g) - T, 0, 50)
  return {
    question: {
      type: 'numeric',
      prompt: `The time in seconds for one complete swing of a pendulum, there and back, is $T = 2\\pi\\sqrt{\\dfrac{l}{g}}$, where $l$ is its length in metres and $g = ${gs}$${where}. A pendulum is needed with $T = ${Ts}$. How long should it be? Give your answer to 2 decimal places.`,
      solution: `Substitute: $${Ts} = 2\\pi\\sqrt{\\dfrac{l}{${gs}}}$. Divide by $2\\pi$: $\\sqrt{\\dfrac{l}{${gs}}} = \\dfrac{${Ts}}{2\\pi}$. Square both sides: $\\dfrac{l}{${gs}} = \\dfrac{${Ts}^2}{4\\pi^2}$, so $l = \\dfrac{${gs} \\times ${Ts}^2}{4\\pi^2} = ${l.toFixed(4)}\\ldots$, which is $${fixed(l, 2)}$ m to 2 decimal places.`,
      markScheme: scheme(slot, [`√(l ÷ ${gs}) = ${Ts}/(2π)`, `l = ${gs} × ${Ts}² ÷ (4π²)`], fixed(l, 2)),
      answer,
      tolerance: 0.005,
      units: 'm',
    },
    check: { agrees: roundTo(byHalving, 2) === answer, detail: `T(l) = ${Ts} solved by halving: ${byHalving}` },
    values: { g, T },
  }
}

/** q19: s = ut + ½at² from rest, find a. */
function accelerationFromRest(r: Rng, slot: Question): Draft {
  const whole = r() < 0.15
  const { s, t, a } = draw(
    r,
    (r) => {
      const t = int(r, 2, 12)
      const s = int(r, 2, 40) * 5
      return { s, t, a: (2 * s) / (t * t) }
    },
    ({ a }) => a >= 0.25 && a <= 12 && Number.isInteger(a * 1000) && Number.isInteger(a) === whole,
  )
  // Who moves depends on how hard: a sledge at 6 m/s² reaches 108 km/h in 5 seconds.
  const MOVERS: [string, number, number][] = [['A car', 0, 6], ['A cyclist', 0, 1.5], ['A train', 0, 1.5], ['A runner', 0, 3], ['A sledge', 0, 2], ['A dragster', 6, 12]]
  const who = pick(r, MOVERS.filter(([, least, most]) => a >= least && a <= most).map(([w]) => w))
  const k = (t * t) / 2
  const loose = Number.isInteger(a * 100) ? '' : `, or ${fixed(a, 2)}`
  return {
    question: {
      type: 'numeric',
      prompt: `${who} starts from rest, so $u = 0$, and travels ${s} m in ${t} seconds with a constant acceleration $a$. Using $s = ut + \\tfrac{1}{2}at^2$, find $a$.`,
      solution: `Substitute: $${s} = 0 \\times ${t} + \\tfrac{1}{2}a \\times ${t}^2 = ${show(k)}a$. Divide by ${show(k)}: $a = ${show(a)}$ m/s².`,
      markScheme: scheme(slot, [`${s} = 0 × ${t} + ½ × a × ${t}², or ${show(k)}a = ${s}`], `${show(a)}${loose}`),
      answer: a,
      tolerance: Math.min(0.005, a * 0.02),
      units: 'm/s²',
    },
    check: agrees('ut + \\tfrac{1}{2}at^2', { u: 0, t, a }, s),
    values: { s, t },
  }
}

/** Integer-sided triangles with a whole-number area and a whole-number s, sides to 40. */
const HERON: [number, number, number][] = []
for (let a = 3; a <= 40; a++)
  for (let b = a; b <= 40; b++)
    for (let c = b; c < a + b && c <= 40; c++) {
      if ((a + b + c) % 2) continue
      const s = (a + b + c) / 2
      const sq = s * (s - a) * (s - b) * (s - c)
      const root = Math.round(Math.sqrt(sq))
      if (root * root === sq && !(a === b && b === c)) HERON.push([a, b, c])
    }

/** q22: Heron's formula. */
function heron(r: Rng, _slot: Question): Draft {
  const [a, b, c] = shuffle(r, pick(r, HERON))
  const s = (a + b + c) / 2
  const product = s * (s - a) * (s - b) * (s - c)
  const area = Math.round(Math.sqrt(product))
  // Second route: put side c along the x-axis, find the third corner, and take half base times height.
  const x = (b * b + c * c - a * a) / (2 * c)
  const height = Math.sqrt(b * b - x * x)
  const other = (c * height) / 2
  return {
    question: {
      type: 'numeric',
      prompt: `Heron's formula gives the area of a triangle with sides $a$, $b$ and $c$ as $A = \\sqrt{s(s - a)(s - b)(s - c)}$, where $s = \\dfrac{a + b + c}{2}$. Work out the area of a triangle with sides ${a} cm, ${b} cm and ${c} cm.`,
      solution: `First $s = \\dfrac{${a} + ${b} + ${c}}{2} = ${s}$. Then $A = \\sqrt{${s} \\times ${s - a} \\times ${s - b} \\times ${s - c}} = \\sqrt{${product}} = ${area}$ cm².`,
      markScheme: [
        { code: 'B1', marks: 1, description: `s = ${s}` },
        { code: 'M1', marks: 1, description: `√(${s} × ${s - a} × ${s - b} × ${s - c}), or √${product}` },
        { code: 'A1', marks: 1, description: String(area) },
      ],
      answer: area,
      tolerance: 0,
      units: 'cm²',
    },
    check: { agrees: near(other, area, 1e-9) && area * area === product, detail: `half base × height: ${other}` },
    values: { a, b, c },
  }
}

export const substitutionGenerators: Generator[] = [
  bySlot('substitute-into-an-expression', SUB, { q1: linearExpression, q3: linearExpression, q6: negativeIntoQuadratic, q8: algebraicFraction }),
  bySlot('substitute-into-a-formula', SUB, { q2: decimalSubstitution, q5: suvatV, q7: kineticEnergy, q9: suvatS, q22: heron }),
  bySlot('substitute-and-solve', SUB, { q10: suvatSolve, q12: trapeziumHeight, q14: quadraticFormula, q15: backToStart, q17: pendulum, q19: accelerationFromRest }),
]

/* ------------------------------------------------------------------------------------------
 * Identities and rearranging formulae
 * ---------------------------------------------------------------------------------------- */

const REARRANGE = 'identities-and-rearranging-formulae'

/**
 * The second method for a rearrangement: values for every letter but the subject, the subject
 * from the printed answer, then both sides of the printed original. A wrong rearrangement
 * leaves the two sides unequal. Values are drawn until the answer is defined (a square root
 * of a positive, no division by zero), and at least five sets must agree.
 */
function substituteBack(original: string, answer: string, subject: string, others: string[], r: Rng, positive = false) {
  let tried = 0
  let passed = 0
  let worst = 0
  for (let k = 0; k < 400 && passed < 5; k++) {
    const vars: Record<string, number> = {}
    for (const o of others) vars[o] = (positive ? 1 : pick(r, [-1, 1])) * (int(r, 1, 40) / 4) * pick(r, [1, 1, 1, 10])
    const [, rhs] = answer.split('=')
    const value = evalTex(rhs!, vars)
    if (!Number.isFinite(value) || (positive && value <= 0)) continue
    tried++
    const gap = Math.abs(evalEquation(original, { ...vars, [subject]: value }))
    const scale = Math.max(1, ...Object.values(vars).map(Math.abs), Math.abs(value)) ** 3
    worst = Math.max(worst, gap / scale)
    if (gap / scale < 1e-9) passed++
  }
  return { agrees: passed >= 5 && passed === tried, detail: `${passed} of ${tried} substitutions satisfy ${original}; worst gap ${worst}` }
}

/** q2: v = u + at, make t the subject; letters and the sign vary. */
function linearSubject(r: Rng, slot: Question): Draft {
  const [L, K, M, S] = letters(r, 4) as [string, string, string, string]
  const minus = r() < 0.35
  const productFirst = r() < 0.3
  const op = minus ? '-' : '+'
  const rhs = productFirst && !minus ? `${M}${S} + ${K}` : `${K} ${op} ${M}${S}`
  const original = `${L} = ${rhs}`
  const top = minus ? `${K} - ${L}` : `${L} - ${K}`
  const answer = `${S} = \\dfrac{${top}}{${M}}`
  const step = minus ? `Add $${M}${S}$ and subtract $${L}$: $${K} - ${L} = ${M}${S}$` : `Subtract $${K}$: $${L} - ${K} = ${M}${S}$`
  const typedTop = top.replace(/ /g, '')
  const accepted = [`${S}=(${typedTop})/${M}`, `(${typedTop})/${M}`, ...(minus ? [`${S}=-(${L}-${K})/${M}`] : [])]
  return {
    question: {
      type: 'short-text',
      prompt: `Make $${S}$ the subject of $${original}$.`,
      solution: `${step}. Divide by $${M}$: $${answer}$.`,
      markScheme: scheme(slot, [`$${minus ? `${K} - ${L}` : `${L} - ${K}`} = ${M}${S}$`], `$${answer.replace('\\dfrac', '\\frac')}$`),
      accepted,
    },
    check: substituteBack(original, answer, S, [L, K, M], r),
    values: { original, subject: S, minus: minus ? 'yes' : 'no' },
  }
}

/** q3: y = 3x − 4, make x the subject. */
function numericLinearSubject(r: Rng, slot: Question): Draft {
  const [X, Y] = pick(r, [['x', 'y'], ['x', 'y'], ['p', 'q'], ['t', 's'], ['a', 'b'], ['n', 'm']] as const)
  const m = int(r, 2, 9)
  const c = int(r, 1, 15)
  const kind = pick(r, ['minus', 'plus', 'negative'] as const)
  let original: string
  let answer: string
  let accepted: string[]
  let solution: string
  let first: string
  if (kind === 'negative') {
    original = `${Y} = ${c} - ${m}${X}`
    answer = `${X} = \\dfrac{${c} - ${Y}}{${m}}`
    first = `${m}${X} = ${c} - ${Y}`
    solution = `Add $${m}${X}$ and subtract $${Y}$: $${first}$. Divide by $${m}$: $${answer}$. Undo the operations in reverse order: the $${Y}$ moves first, then the $\\times ${m}$ goes.`
    accepted = [`${X}=(${c}-${Y})/${m}`, `(${c}-${Y})/${m}`, `${X}=(-${Y}+${c})/${m}`]
  } else {
    const sign = kind === 'minus' ? '-' : '+'
    const undo = kind === 'minus' ? '+' : '-'
    original = `${Y} = ${m}${X} ${sign} ${c}`
    answer = `${X} = \\dfrac{${Y} ${undo} ${c}}{${m}}`
    first = `${Y} ${undo} ${c} = ${m}${X}`
    solution = `${kind === 'minus' ? 'Add' : 'Subtract'} $${c}$: $${first}$. Divide by $${m}$: $${answer}$. Undo the operations in reverse order: the $${sign}${c}$ first, then the $\\times ${m}$.`
    accepted = [`${X}=(${Y}${undo}${c})/${m}`, `(${Y}${undo}${c})/${m}`, ...(kind === 'minus' ? [`${X}=(${c}+${Y})/${m}`] : [`${X}=(-${c}+${Y})/${m}`])]
  }
  return {
    question: {
      type: 'short-text',
      prompt: `Make $${X}$ the subject of $${original}$.`,
      solution,
      markScheme: scheme(slot, [`$${first}$`], `$${answer.replace('\\dfrac', '\\frac')}$`),
      accepted,
    },
    check: substituteBack(original, answer, X, [Y], r),
    values: { kind, original },
  }
}

/** q4: expand and simplify to show an identity. */
function expandIdentity(r: Rng, slot: Question): Draft {
  const { a, b, c, d } = draw(
    r,
    (r) => ({ a: int(r, 2, 6), b: pick(r, [-1, 1]) * int(r, 1, 9), c: (r() < 0.3 ? -1 : 1) * int(r, 2, 6), d: pick(r, [-1, 1]) * int(r, 1, 9) }),
    ({ a, b, c, d }) => a + c !== 0 && a * b + c * d !== 0 && a !== Math.abs(c),
  )
  const P = a + c
  const Q = a * b + c * d
  const bracket = (k: number) => `(x ${k < 0 ? '-' : '+'} ${Math.abs(k)})`
  const lhs = `${a}${bracket(b)} ${c < 0 ? '-' : '+'} ${Math.abs(c)}${bracket(d)}`
  const rhs = sum([[P, 'x'], [Q, '']])
  const expanded = sum([[a, 'x'], [a * b, ''], [c, 'x'], [c * d, '']])
  const typed = sum([[P, 'x'], [Q, '']], false)
  const reversed = sum([[Q, ''], [P, 'x']], false)
  const xs = [-3, 0, 2, 5]
  const ok = xs.every((x) => near(evalTex(lhs, { x }), evalTex(rhs, { x })))
  return {
    question: {
      type: 'short-text',
      prompt: `Expand and simplify to show that $${lhs} \\equiv ${rhs}$. Write the simplified left-hand side.`,
      solution: `$${expanded} = ${rhs}$. Both sides are the same expression, so it is an identity: true for every $x$.`,
      markScheme: scheme(slot, [`$${expanded}$`], `$${rhs}$`),
      accepted: [...new Set([typed, reversed])],
    },
    check: { agrees: ok && typed !== '0', detail: `both sides at x = ${xs.join(', ')}` },
    values: { a, b, c, d, P, Q },
  }
}

/** q5: A = πr², make r the subject. */
function squareSubject(r: Rng, slot: Question): Draft {
  const [L, S, K] = letters(r, 3) as [string, string, string]
  const kind = pick(r, ['pi', 'letter', 'number', 'four pi'] as const)
  const n = int(r, 2, 9)
  const kTex = kind === 'pi' ? '\\pi' : kind === 'letter' ? K : kind === 'number' ? String(n) : '4\\pi'
  const kTyped = kind === 'pi' ? 'π' : kind === 'letter' ? K : kind === 'number' ? String(n) : '(4π)'
  const original = `${L} = ${kTex} ${S}^2`
  const answer = `${S} = \\sqrt{\\dfrac{${L}}{${kTex}}}`
  return {
    question: {
      type: 'short-text',
      prompt: `Make $${S}$ the subject of $${original}$, where $${S} > 0$.`,
      solution: `Divide by $${kTex}$: $${S}^2 = \\dfrac{${L}}{${kTex}}$. Square root: $${answer}$. Undo the square last, because it was applied first.`,
      markScheme: scheme(slot, [`$${S}^2 = \\frac{${L}}{${kTex}}$`], `$${answer.replace('\\dfrac', '\\frac')}$`),
      // √(v/4) simplifies to √v/2, and √(A/(4π)) to √A/(2√π): the forms a student reaches.
      accepted: [
        `${S}=sqrt(${L}/${kTyped})`,
        `sqrt(${L}/${kTyped})`,
        ...(kind === 'number' && Number.isInteger(Math.sqrt(n)) ? [`${S}=sqrt(${L})/${Math.sqrt(n)}`, `sqrt(${L})/${Math.sqrt(n)}`] : []),
        ...(kind === 'four pi' ? [`${S}=sqrt(${L})/(2sqrt(π))`, `sqrt(${L})/(2sqrt(π))`] : []),
      ],
    },
    check: substituteBack(original, answer, S, kind === 'letter' ? [L, K] : [L], r, true),
    values: { kind, original },
  }
}

/** q6: 3(x + a) + b(x − 2) ≡ 7x + 1, find a and b. */
function identityCoefficients(r: Rng, slot: Question): Draft {
  const { p, q, a, b } = draw(
    r,
    (r) => ({ p: int(r, 2, 6), q: pick(r, [-1, 1]) * int(r, 1, 6), a: pick(r, [-1, 1]) * int(r, 1, 9), b: (r() < 0.8 ? 1 : -1) * int(r, 2, 8) }),
    ({ p, q, a, b }) => p + b !== 0 && p * a - b * q !== 0 && b !== p,
  )
  const M = p + b
  const N = p * a - b * q
  const lhs = `${p}(x + a) + b(x ${q < 0 ? '+' : '-'} ${Math.abs(q)})`
  const rhs = sum([[M, 'x'], [N, '']])
  const xTerm = `(${p}+b)x`
  const cTerm = `(${p}a ${q < 0 ? '+' : '-'} ${coef(Math.abs(q), 'b')})`
  const xs = [-2, 1, 3]
  const ok = xs.every((x) => near(evalTex(lhs, { x, a, b }), evalTex(rhs, { x })))
  return {
    question: {
      type: 'short-text',
      prompt: `$${lhs} \\equiv ${rhs}$. Find the values of $a$ and $b$.`,
      solution: `Expand: $${p}x + ${p}a + bx ${q < 0 ? '+' : '-'} ${coef(Math.abs(q), 'b')} = ${xTerm} + ${cTerm}$. Compare with $${rhs}$. **$x$ terms**: $${p} + b = ${M}$, so $b = ${b}$. **Constants**: $${p}a ${q < 0 ? '+' : '-'} ${coef(Math.abs(q), 'b')} = ${N}$, so $${p}a ${-q * b < 0 ? '-' : '+'} ${Math.abs(q * b)} = ${N}$ and $a = ${a}$.`,
      markScheme: [
        { code: 'M1', marks: 1, description: `$${xTerm} + ${cTerm}$` },
        { code: 'A1', marks: 1, description: `$b = ${b}$` },
        { code: 'A1', marks: 1, description: `$a = ${a}$` },
      ].slice(3 - slot.marks),
      accepted: [`a=${a},b=${b}`, `a=${a}andb=${b}`, `a=${a}b=${b}`, `b=${b},a=${a}`, `b=${b}anda=${a}`, `a=${a};b=${b}`, `b=${b};a=${a}`, `${a},${b}`, `${a}and${b}`],
    },
    check: { agrees: ok, detail: `a = ${a}, b = ${b} make both sides equal at x = ${xs.join(', ')}` },
    values: { p, q, a, b },
  }
}

/** q7: y = (ax + b)/c, make x the subject. */
function fractionSubject(r: Rng, slot: Question): Draft {
  const [Y, X, A, B, C] = r() < 0.4 ? ['y', 'x', 'a', 'b', 'c'] : (letters(r, 5) as [string, string, string, string, string])
  const minus = r() < 0.4
  const op = minus ? '-' : '+'
  const undo = minus ? '+' : '-'
  const original = `${Y} = \\dfrac{${A}${X} ${op} ${B}}{${C}}`
  const answer = `${X} = \\dfrac{${C}${Y} ${undo} ${B}}{${A}}`
  return {
    question: {
      type: 'short-text',
      prompt: `Make $${X}$ the subject of $${original}$.`,
      solution: `Multiply by $${C}$: $${C}${Y} = ${A}${X} ${op} ${B}$. ${minus ? 'Add' : 'Subtract'} $${B}$: $${C}${Y} ${undo} ${B} = ${A}${X}$. Divide by $${A}$: $${answer}$.`,
      markScheme: scheme(slot, [`$${C}${Y} = ${A}${X} ${op} ${B}$`], `$${answer.replace('\\dfrac', '\\frac')}$`),
      accepted: [`${X}=(${C}${Y}${undo}${B})/${A}`, `(${C}${Y}${undo}${B})/${A}`, `${X}=(${Y}${C}${undo}${B})/${A}`],
    },
    check: substituteBack(original, answer, X, [Y, A, B, C], r),
    values: { original, minus: minus ? 'yes' : 'no' },
  }
}

/** q8: s = ut + ½at², make a the subject. */
function halfSquareSubject(r: Rng, slot: Question): Draft {
  const [L, P, Q, S] = r() < 0.3 ? ['s', 'u', 't', 'a'] : (letters(r, 4) as [string, string, string, string])
  const minus = r() < 0.35
  const original = `${L} = ${P}${Q} ${minus ? '-' : '+'} \\tfrac{1}{2}${S}${Q}^2`
  const diff = minus ? `${P}${Q} - ${L}` : `${L} - ${P}${Q}`
  const answer = `${S} = \\dfrac{2(${diff})}{${Q}^2}`
  const t = diff.replace(/ /g, '')
  const two = minus ? `2${P}${Q}-2${L}` : `2${L}-2${P}${Q}`
  const first = minus ? `${P}${Q} - ${L} = \\tfrac{1}{2}${S}${Q}^2` : `${L} - ${P}${Q} = \\tfrac{1}{2}${S}${Q}^2`
  const step = minus ? `Add $\\tfrac{1}{2}${S}${Q}^2$ and subtract $${L}$` : `Subtract $${P}${Q}$`
  return {
    question: {
      type: 'short-text',
      prompt: `Make $${S}$ the subject of $${original}$.`,
      solution: `${step}: $${first}$. Multiply by $2$: $2(${diff}) = ${S}${Q}^2$. Divide by $${Q}^2$: $${answer}$.`,
      markScheme: scheme(slot, [`$${first.replace('\\tfrac', '\\frac')}$`, `$2(${diff}) = ${S}${Q}^2$`], `$${answer.replace('\\dfrac', '\\frac')}$`),
      accepted: [`${S}=2(${t})/${Q}^2`, `${S}=(${two})/${Q}^2`, `2(${t})/${Q}^2`, `(${two})/${Q}^2`, `${S}=(2(${t}))/${Q}^2`],
    },
    check: substituteBack(original, answer, S, [L, P, Q], r),
    values: { original, minus: minus ? 'yes' : 'no' },
  }
}

/** q9: the radius of a circle from its area, to 3 s.f. */
function radiusFromArea(r: Rng, slot: Question): Draft {
  const A = draw(r, (r) => int(r, 5, 600), (A) => clearOfHalfSf(Math.sqrt(A / Math.PI), 3))
  const exact = Math.sqrt(A / Math.PI)
  const answer = sigFig(exact, 3)
  const byHalving = bisect((x) => evalTex('\\pi r^2', { r: x }) - A, 0, 100)
  return {
    question: {
      type: 'numeric',
      prompt: `The area of a circle is $${A}$ cm². Rearrange $A = \\pi r^2$ and find the radius to 3 significant figures.`,
      solution: `$r = \\sqrt{\\dfrac{A}{\\pi}} = \\sqrt{\\dfrac{${A}}{\\pi}} = \\sqrt{${(A / Math.PI).toFixed(3)}} = ${sfText(exact, 3)}$ cm.`,
      markScheme: scheme(slot, ['$r = \\sqrt{A/\\pi}$', `$\\sqrt{${A}/\\pi}$`], `${sfText(exact, 3)} cm`),
      answer,
      tolerance: halfUnitSf(exact, 3),
      units: 'cm',
    },
    check: { agrees: sigFig(byHalving, 3) === answer, detail: `πr² = ${A} solved by halving: ${byHalving}` },
    values: { A },
  }
}

/** q11: y = (x + 2)/(x − 3), make x the subject. */
function subjectTwice(r: Rng, slot: Question): Draft {
  const [S, L] = pick(r, [['x', 'y'], ['x', 'y'], ['t', 's'], ['a', 'b'], ['p', 'q'], ['m', 'n'], ['u', 'v']] as const)
  const { p, a, q } = draw(
    r,
    (r) => ({ p: pick(r, [1, 1, 1, 2, 3]), a: pick(r, [-1, 1]) * int(r, 1, 9), q: pick(r, [-1, 1]) * int(r, 1, 9) }),
    ({ p, a, q }) => p * q !== a,
  )
  const original = `${L} = \\dfrac{${sum([[p, S], [a, '']])}}{${sum([[1, S], [q, '']])}}`
  const num = sum([[-q, L], [a, '']])
  const den = sum([[1, L], [-p, '']])
  const answer = `${S} = \\dfrac{${num}}{${den}}`
  const T = (s: string) => s.replace(/ /g, '')
  const step1 = `${S}${L} ${q < 0 ? '-' : '+'} ${coef(Math.abs(q), L)} = ${sum([[p, S], [a, '']])}`
  const step2 = `${S}${L} - ${coef(p, S)} = ${num}`
  const step3 = `${S}(${den}) = ${num}`
  return {
    question: {
      type: 'short-text',
      prompt: `Make $${S}$ the subject of $${original}$.`,
      solution: `Multiply out: $${L}(${sum([[1, S], [q, '']])}) = ${sum([[p, S], [a, '']])}$, so $${step1}$. Collect the $${S}$ terms on one side: $${step2}$. Factorise: $${step3}$. Divide: $${answer}$.`,
      markScheme: scheme(slot, [`$${step1}$`, `$${step2}$`, `$${step3}$`], `$${answer.replace('\\dfrac', '\\frac')}$`),
      accepted: [
        `${S}=(${T(num)})/(${T(den)})`,
        `(${T(num)})/(${T(den)})`,
        `${S}=(${T(sum([[a, ''], [-q, L]]))})/(${T(den)})`,
        `${S}=-(${T(num)})/(${T(sum([[p, ''], [-1, L]]))})`,
      ],
    },
    check: substituteBack(original, answer, S, [L], r),
    values: { p, a, q, original },
  }
}

/** q12: (x + p)² + q ≡ x² − 8x + 3. */
function completedSquareIdentity(r: Rng, slot: Question): Draft {
  const { b, c } = draw(r, (r) => ({ b: pick(r, [-1, 1]) * 2 * int(r, 1, 8), c: int(r, -20, 20) }), ({ b, c }) => c !== 0 && c !== (b / 2) ** 2)
  const p = b / 2
  const q = c - p * p
  const rhs = sum([[1, 'x^2'], [b, 'x'], [c, '']])
  const xs = [-3, 0, 4]
  const ok = xs.every((x) => near((x + p) ** 2 + q, evalTex(rhs, { x })))
  return {
    question: {
      type: 'short-text',
      prompt: `$(x+p)^2 + q \\equiv ${rhs}$. Find $p$ and $q$.`,
      solution: `Expand: $x^2 + 2px + p^2 + q$. **$x$ terms**: $2p = ${b}$, so $p = ${p}$. **Constants**: $p^2 + q = ${c}$, so $${p * p} + q = ${c}$ and $q = ${q}$. This is completing the square, seen as an identity.`,
      markScheme: [
        { code: 'M1', marks: 1, description: '$x^2 + 2px + p^2 + q$' },
        { code: 'A1', marks: 1, description: `$p = ${p}$` },
        { code: 'A1', marks: 1, description: `$q = ${q}$` },
      ].slice(3 - slot.marks),
      accepted: [`p=${p},q=${q}`, `p=${p}andq=${q}`, `q=${q},p=${p}`, `p=${p};q=${q}`, `${p},${q}`, `p=${p}q=${q}`],
    },
    check: { agrees: ok && 2 * p === b, detail: `(x + ${p})² + ${q} against ${rhs} at x = ${xs.join(', ')}` },
    values: { b, c, p, q },
  }
}

/** q14: v² = u² + 2as, make u the subject. */
function squareRootSubject(r: Rng, slot: Question): Draft {
  const [L, S, A, B] = r() < 0.3 ? ['v', 'u', 'a', 's'] : (letters(r, 4) as [string, string, string, string])
  const k = pick(r, [1, 2, 2, 3, 4, 5])
  const squared = r() < 0.7
  const minus = r() < 0.3
  const left = squared ? `${L}^2` : L
  const kAB = `${k === 1 ? '' : k}${A}${B}`
  const original = `${left} = ${S}^2 ${minus ? '-' : '+'} ${kAB}`
  const inside = `${left} ${minus ? '+' : '-'} ${kAB}`
  const answer = `${S} = \\sqrt{${inside}}`
  const typed = inside.replace(/ /g, '')
  const wrong = minus ? `${squared ? L : `\\sqrt{${L}}`} + \\sqrt{${kAB}}` : `${squared ? L : `\\sqrt{${L}}`} - \\sqrt{${kAB}}`
  return {
    question: {
      type: 'short-text',
      prompt: `Make $${S}$ the subject of $${original}$, where $${S} > 0$.`,
      solution: `${minus ? 'Add' : 'Subtract'} $${kAB}$: $${S}^2 = ${inside}$. Square root: $${answer}$. A common error is to square-root each term separately: $\\sqrt{${inside}}$ is **not** $${wrong}$.`,
      markScheme: scheme(slot, [`$${S}^2 = ${inside}$`], `$${answer}$`),
      accepted: [`${S}=sqrt(${typed})`, `sqrt(${typed})`],
    },
    check: substituteBack(original, answer, S, [L, A, B], r, true),
    values: { original, squared: squared ? 'yes' : 'no', minus: minus ? 'yes' : 'no' },
  }
}

/** q15: a = (b + c)/(b − c), make b the subject. */
function collectAndFactorise(r: Rng, slot: Question): Draft {
  const [A, S, B] = r() < 0.3 ? ['a', 'b', 'c'] : (letters(r, 3) as [string, string, string])
  const k = pick(r, [1, 1, 2, 3])
  const minus = r() < 0.4
  const kB = coef(k, B)
  const original = minus ? `${A} = \\dfrac{${S} - ${kB}}{${S} + ${B}}` : `${A} = \\dfrac{${S} + ${kB}}{${S} - ${B}}`
  const ak = `${A} + ${k}`
  const tAB = `${A}${B}+${k === 1 ? '' : k}${B}`
  let steps: string[]
  let answer: string
  let accepted: string[]
  if (!minus) {
    steps = [`${A}${S} - ${A}${B} = ${S} + ${kB}`, `${A}${S} - ${S} = ${A}${B} + ${kB}`, `${S}(${A} - 1) = ${B}(${ak})`]
    answer = `${S} = \\dfrac{${B}(${ak})}{${A} - 1}`
    accepted = [`${S}=${B}(${A}+${k})/(${A}-1)`, `${B}(${A}+${k})/(${A}-1)`, `${S}=(${tAB})/(${A}-1)`, `(${tAB})/(${A}-1)`, `${S}=(${B}(${A}+${k}))/(${A}-1)`]
  } else {
    steps = [`${A}${S} + ${A}${B} = ${S} - ${kB}`, `${A}${S} - ${S} = -${A}${B} - ${kB}`, `${S}(${A} - 1) = -${B}(${ak})`]
    answer = `${S} = \\dfrac{${B}(${ak})}{1 - ${A}}`
    accepted = [`${S}=${B}(${A}+${k})/(1-${A})`, `${B}(${A}+${k})/(1-${A})`, `${S}=(${tAB})/(1-${A})`, `(${tAB})/(1-${A})`, `${S}=-${B}(${A}+${k})/(${A}-1)`, `${S}=(${B}(${A}+${k}))/(1-${A})`]
  }
  return {
    question: {
      type: 'short-text',
      prompt: `Make $${S}$ the subject of $${original}$.`,
      solution: `$${A}(${S} ${minus ? '+' : '-'} ${B}) = ${S} ${minus ? '-' : '+'} ${kB}$, so $${steps[0]}$. Collect $${S}$: $${steps[1]}$. Factorise both sides: $${steps[2]}$. Divide: $${answer}$.`,
      markScheme: scheme(slot, steps.map((s) => `$${s}$`), `$${answer.replace('\\dfrac', '\\frac')}$`),
      accepted,
    },
    check: substituteBack(original, answer, S, [A, B], r),
    values: { original, k, minus: minus ? 'yes' : 'no' },
  }
}

/** q18: rearrange the pendulum formula for l, then evaluate to 3 s.f. */
function pendulumRearranged(r: Rng, slot: Question): Draft {
  const { g, where, T, l } = pendulumLength(r, 'sf3')
  const answer = sigFig(l, 3)
  const Ts = show(T)
  const gs = show(g)
  const byHalving = bisect((x) => periodOf(x, g) - T, 0, 50)
  return {
    question: {
      type: 'numeric',
      prompt: `The formula $T = 2\\pi\\sqrt{\\dfrac{l}{g}}$ gives the period of a pendulum. Rearrange to make $l$ the subject, then find $l$ when $T = ${Ts}$ and $g = ${gs}$${where}. Give 3 significant figures.`,
      solution: `Divide by $2\\pi$: $\\dfrac{T}{2\\pi} = \\sqrt{\\dfrac{l}{g}}$. Square: $\\dfrac{T^2}{4\\pi^2} = \\dfrac{l}{g}$. Multiply by $g$: $l = \\dfrac{gT^2}{4\\pi^2}$. Then $l = \\dfrac{${gs} \\times ${Ts}^2}{4\\pi^2} = \\dfrac{${show(g * T * T)}}{${(4 * Math.PI * Math.PI).toFixed(2)}} = ${sfText(l, 3)}$ m.`,
      markScheme: [
        { code: 'M1', marks: 1, description: '$\\frac{T}{2\\pi} = \\sqrt{\\frac{l}{g}}$' },
        { code: 'M1', marks: 1, description: 'squared: $\\frac{T^2}{4\\pi^2} = \\frac{l}{g}$' },
        { code: 'A1', marks: 1, description: '$l = \\frac{gT^2}{4\\pi^2}$' },
        { code: 'A1', marks: 1, description: `${sfText(l, 3)} m` },
      ].slice(4 - slot.marks),
      answer,
      tolerance: halfUnitSf(l, 3),
      units: 'm',
    },
    check: { agrees: sigFig(byHalving, 3) === answer, detail: `T(l) = ${Ts} solved by halving: ${byHalving}` },
    values: { g, T },
  }
}

export const rearrangingGenerators: Generator[] = [
  bySlot('rearrange-a-formula', REARRANGE, {
    q2: linearSubject,
    q3: numericLinearSubject,
    q5: squareSubject,
    q7: fractionSubject,
    q8: halfSquareSubject,
    q11: subjectTwice,
    q14: squareRootSubject,
    q15: collectAndFactorise,
  }),
  bySlot('identity-coefficients', REARRANGE, { q4: expandIdentity, q6: identityCoefficients, q12: completedSquareIdentity }),
  bySlot('rearrange-and-evaluate', REARRANGE, { q9: radiusFromArea, q18: pendulumRearranged }),
]

/** Generators for substituting into formulae, identities and rearranging. */
export const formulaeGenerators: Generator[] = [...substitutionGenerators, ...rearrangingGenerators]
