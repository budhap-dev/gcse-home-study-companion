import type { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { draw, int, pick, type Rng, weighted } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Check, Draft, Generator } from '../types.ts'
import { coef, evalEquation, evalTex, fracTex, near, reduce, sum } from '../maths/formulae.ts'
import { lin, poly } from '../maths/quadratics.ts'
import { substitution } from './calculus.ts'
import { sup } from './expansion.ts'
import { pointsIn } from './lines.ts'
import { fmBySlot, minus } from './build.ts'

/**
 * Further Maths (AQA 8365): functions-domain-range-composite-and-inverse,
 * algebraic-fractions-at-further-maths-level and rearranging-formulae-and-algebraic-proof.
 * Non-calculator throughout.
 *
 * 2.2   Function notation: f(x) = x² − 9 evaluated at a whole number.
 * 2.4   Composite functions: an unknown constant inside fg(x), found by comparing coefficients.
 * 2.5   Inverse functions: where f meets f⁻¹, on the line y = x.
 * 2.13  Exponential graphs y = abˣ and y = ab⁻ˣ: a and b from two points.
 * 2.9   Rational expressions: an equation in algebraic fractions whose x² terms cancel.
 * 2.19  Algebraic proof: (an + b)² − (an − b)² = 4abn is a multiple of 4ab, and its value at n.
 */

const FUNC = 'functions-domain-range-composite-and-inverse'
const FRACTIONS = 'algebraic-fractions-at-further-maths-level'
const PROOF = 'rearranging-formulae-and-algebraic-proof'

const pm = (r: Rng) => (r() < 0.5 ? -1 : 1)
const pt = (x: number, y: number) => `(${x}, ${y})`
/** None of the printed numbers has the answer's size. */
export const notPrinted = (answer: number, printed: number[]) => !printed.some((v) => Math.abs(v) === Math.abs(answer))

export { weighted } from '../random.ts'

/** The function names the written questions use, f most often. */
const NAMES = ['f', 'f', 'f', 'g', 'h'] as const

/** The body printed after "$f(x) = " in a prompt. */
function bodyOf(prompt: string, name: string): string {
  const m = new RegExp(`\\$${name}\\(x\\) = ([^$]+)\\$`).exec(prompt)
  if (!m) throw new Error(`no ${name}(x) in ${prompt}`)
  return m[1]!
}

// ---------------------------------------------------------------------------------------
// Functions q1: f(x) = x² − 9, work out f(5). 16.
// ---------------------------------------------------------------------------------------

/**
 * ax² + c at a whole input, a = 1 seven times in ten. ±1 (only the coefficients summed) is
 * rare; a negative input about a third of the time. No slip pays: the square forgotten, a
 * negative squared to a negative, the constant's sign lost, or a printed number read off; no
 * two printed numbers are alike.
 */
function evaluateQuadratic(r: Rng, slot: Question): Draft {
  const name = pick(r, NAMES)
  const { a, c, k } = draw(
    r,
    (r) => ({
      a: r() < 0.7 ? 1 : pick(r, [2, 3]),
      c: pm(r) * int(r, 1, 20),
      k: r() < 0.12 ? pick(r, [-1, 1]) : (r() < 0.35 ? -1 : 1) * int(r, 2, 9),
    }),
    ({ a, c, k }) => {
      const v = a * k * k + c
      return v !== 0 && v !== a * k + c && v !== -a * k * k + c && v !== a * k * k - c && notPrinted(v, [a, c, k]) && new Set([a === 1 ? 0 : a, Math.abs(c), Math.abs(k)]).size === 3
    },
  )
  const p = [c, 0, a]
  const answer = a * k * k + c
  const prompt = `$${name}(x) = ${poly(p)}$. Work out $${name}(${k})$.`
  const steps = `${a === 1 ? 'square the input' : `square the input, multiply by $${a}$`}, then ${c < 0 ? 'subtract' : 'add'} $${Math.abs(c)}$`
  const read = evalTex(bodyOf(prompt, name), { x: k })
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `$${name}(${k}) = ${substitution(p, k)}$: ${steps}.`,
      markScheme: scheme(slot, [], minus(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: read === answer, detail: `printed ${name}(x) read at x = ${k}: ${read}` },
    values: { name, a, c, k },
  }
}

// ---------------------------------------------------------------------------------------
// Functions q9: f(x) = 3x − 2, the x for which f(x) = f⁻¹(x). 1.
// ---------------------------------------------------------------------------------------

/**
 * f(x) = ax + b meets its inverse on y = x, so ax + b = x. The meeting point X is drawn first
 * and b = X(1 − a) fitted; a is never ±1 (a = 1 never meets, a = −1 is its own inverse) and
 * never 2, where b would be −X. X is never the root of f, nor a printed number, and never
 * ±1: there f(X) = X is its own reciprocal, so reading f⁻¹ as 1/f (f(x)² = 1) would land on
 * it, and f(1) would be only the coefficients summed.
 */
function meetsInverse(r: Rng, slot: Question): Draft {
  const name = pick(r, NAMES)
  const { a, b, X } = draw(
    r,
    (r) => {
      const X = pm(r) * int(r, 2, 9)
      const a = pick(r, [3, 4, 5, -2, -3])
      return { a, X, b: X * (1 - a) }
    },
    ({ a, b, X }) => Math.abs(b) <= 24 && notPrinted(X, [a, b]) && X !== -b / a,
  )
  const body = sum([[a, 'x'], [b, '']])
  const inverse = a > 0 ? `\\frac{${sum([[1, 'x'], [-b, '']])}}{${a}}` : `\\frac{${sum([[b, ''], [-1, 'x']])}}{${-a}}`
  const prompt = pick(r, [
    `$${name}(x) = ${body}$. Work out the value of $x$ for which $${name}(x) = ${name}^{-1}(x)$.`,
    `$${name}(x) = ${body}$. Find the value of $x$ where the graphs of $y = ${name}(x)$ and $y = ${name}^{-1}(x)$ meet.`,
  ])
  const solution =
    `The graphs of $${name}$ and $${name}^{-1}$ meet on the line $y = x$, so solve $${name}(x) = x$: $${body} = x$ gives $${coef(a - 1, 'x')} = ${-b}$, so $x = ${X}$. ` +
    `Check: $${name}^{-1}(x) = ${inverse}$ and $${name}^{-1}(${X}) = ${X}$.`
  // Second route: the printed f and the printed inverse both send X to itself, and f undoes the inverse.
  const fX = evalTex(bodyOf(prompt, name), { x: X })
  const invX = evalTex(inverse, { x: X })
  const undo = evalTex(bodyOf(prompt, name), { x: evalTex(inverse, { x: 7 }) })
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], minus(X)), answer: X, tolerance: 0 },
    check: { agrees: fX === X && near(invX, X) && near(undo, 7), detail: `${name}(${X}) = ${fX}, ${name}⁻¹(${X}) = ${invX}, ${name}(${name}⁻¹(7)) = ${undo}` },
    values: { name, a, b, X },
  }
}

// ---------------------------------------------------------------------------------------
// Functions q6: f(x) = 2x + 1, g(x) = x² + k, fg(x) = 2x² + 7. k = 3.
// ---------------------------------------------------------------------------------------

/**
 * fg(x) = a(x² + k) + b = ax² + (ak + b). k is drawn first; a is 2 to 5 so the slip of not
 * multiplying k (k = C − b) fails, b is never zero so ignoring it or flipping its sign fails,
 * and k is never a printed number. The linear function is g a third of the time, asking gf;
 * composing in the wrong order, (ax + b)² + k, has constant b² + k, so k is never C − b².
 */
function compositeUnknown(r: Rng, slot: Question): Draft {
  const swap = r() < 0.35
  const [L, Q] = swap ? ['g', 'f'] : ['f', 'g']
  const { a, b, k } = draw(
    r,
    (r) => ({ a: int(r, 2, 5), b: pm(r) * int(r, 1, 9), k: pm(r) * int(r, 1, 8) }),
    ({ a, b, k }) => {
      const C = a * k + b
      return C !== 0 && Math.abs(C) <= 40 && new Set([a, Math.abs(b), Math.abs(C)]).size === 3 && notPrinted(k, [a, b, C]) && k !== C - b && k !== (C + b) / a && k !== C / a && k !== C - b * b
    },
  )
  const C = a * k + b
  const linear = sum([[a, 'x'], [b, '']])
  const target = sum([[a, 'x^2'], [C, '']])
  const sign = b < 0 ? '-' : '+'
  const prompt = `$${L}(x) = ${linear}$ and $${Q}(x) = x^2 + k$. Given that $${L}${Q}(x) = ${target}$, work out $k$.`
  const expanded = `${a}x^2 + ${a}k ${sign} ${Math.abs(b)}`
  const solution = `$${L}${Q}(x) = ${L}(x^2 + k) = ${a}(x^2 + k) ${sign} ${Math.abs(b)} = ${expanded}$. Comparing with $${target}$: $${a}k ${sign} ${Math.abs(b)} = ${C}$, so $${a}k = ${C - b}$ and $k = ${k}$.`
  // Second route: the printed linear function applied to the printed quadratic, with k put in,
  // is the printed composite at three values of x.
  const xs = [-3, 0.5, 2]
  const read = xs.map((x) => evalTex(bodyOf(prompt, L), { x: evalTex(bodyOf(prompt, Q), { x, k }) }) - evalTex(target, { x }))
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [minus(`${L}${Q}(x) = ${a}x² + ${a}k ${sign} ${Math.abs(b)}`)], minus(k)),
      answer: k,
      tolerance: 0,
    },
    check: { agrees: read.every((g) => near(g, 0)), detail: `${L}(${Q}(x)) minus the printed composite at x = ${xs.join(', ')}: ${read.join(', ')}` },
    values: { a, b, k, linear: L },
  }
}

// ---------------------------------------------------------------------------------------
// Exponentials: q8, y = abˣ through (0, 3) and (2, 12), b = 2; q16, y = ab⁻ˣ through
// (1, 20) and (2, 10), a = 40.
// ---------------------------------------------------------------------------------------

/**
 * Second route for either curve: the two printed points and the answer. Asked b, a follows
 * from the first point and must reach the second; asked a, b follows from the ratio of the
 * y values and both points must hold. `sign` is +1 for abˣ and −1 for ab⁻ˣ.
 */
function exponentialCheck(prompt: string, ask: 'a' | 'b', answer: number, sign: 1 | -1): Check {
  const [[x1, y1], [x2, y2]] = pointsIn(prompt) as [[number, number], [number, number]]
  if (ask === 'b') {
    const a = y1 / answer ** (sign * x1)
    const y = a * answer ** (sign * x2)
    return { agrees: answer > 0 && answer !== 1 && near(y, y2), detail: `b = ${answer} with a = ${a} from ${pt(x1, y1)}: at x = ${x2}, y = ${y}, printed ${y2}` }
  }
  const b = (y2 / y1) ** (sign / (x2 - x1))
  const ys = [answer * b ** (sign * x1), answer * b ** (sign * x2)]
  return { agrees: answer > 0 && near(ys[0]!, y1) && near(ys[1]!, y2), detail: `b = ${b} from the ratio of the printed y values; a = ${answer} gives y = ${ys.join(' and ')}` }
}

/**
 * The shapes of q8, weighted so no answer dominates: a = y at x = 0 and b from x = 1, 2 or
 * 3 (b = ½ now and then, asked as a decimal), or two points at x = 1 and x = 2 or 3 divided
 * to give bᵈ, asking b or a. The answer is never a printed coordinate, which rules out the
 * written b = 2 with its point at x = 2. At x = 3 the base is 2 only half the time, so a
 * printed x = 3 does not teach "write 2": 4 (only a = 2 fits: a = 3 prints 3 twice, a = 4
 * prints the answer, a = 5 passes 300) or ½ the rest.
 */
const GROWTH = [['zero 1', 10], ['zero 2', 35], ['zero 3', 12], ['ratio b', 25], ['ratio a', 18]] as const

interface Expo {
  x1: number
  x2: number
  a: number
  b: number
  ask: 'a' | 'b'
}

function exponentialGrowth(r: Rng, slot: Question): Draft {
  const kind = weighted(r, GROWTH)
  const v = draw(
    r,
    (r): Expo => {
      if (kind === 'zero 1') return { x1: 0, x2: 1, a: int(r, 2, 12), b: int(r, 3, 8), ask: 'b' }
      if (kind === 'zero 2') {
        const b = pick(r, [3, 4, 5, 0.5])
        return { x1: 0, x2: 2, a: b === 0.5 ? 4 * int(r, 1, 10) : int(r, 2, 12), b, ask: 'b' }
      }
      if (kind === 'zero 3') {
        const b = pick(r, [2, 2, 4, 0.5])
        // ½: a = 8k ends at (3, k), and k is never the printed 3.
        const a = b === 2 ? int(r, 4, 12) : b === 4 ? 2 : 8 * pick(r, [1, 2, 4, 5, 6, 7, 8, 9, 10])
        return { x1: 0, x2: 3, a, b, ask: 'b' }
      }
      if (kind === 'ratio b') {
        const x2 = r() < 0.6 ? 2 : 3
        const b = x2 === 2 ? pick(r, [3, 4, 5]) : pick(r, [2, 4])
        return { x1: 1, x2, a: int(r, 2, x2 === 3 && b === 4 ? 4 : 10), b, ask: 'b' }
      }
      return { x1: 1, x2: 2, a: int(r, 3, 12), b: pick(r, [3, 4, 5]), ask: 'a' }
    },
    ({ x1, x2, a, b, ask }) => {
      const y1 = a * b ** x1
      const y2 = a * b ** x2
      const answer = ask === 'a' ? a : b
      return Number.isInteger(y1) && Number.isInteger(y2) && y2 <= 300 && a !== b && notPrinted(answer, [x1, y1, x2, y2]) && new Set([x1, y1, x2, y2]).size === 4
    },
  )
  const { x1, x2, a, b, ask } = v
  const y1 = a * b ** x1
  const y2 = a * b ** x2
  const answer = ask === 'a' ? a : b
  const decimal = !Number.isInteger(b)
  const prompt = `The curve $y = ab^x$ passes through $${pt(x1, y1)}$ and $${pt(x2, y2)}$. ${pick(r, [`Work out $${ask}$.`, `Work out the value of $${ask}$.`])}${decimal ? ' Give your answer as a decimal.' : ''}`
  let solution: string
  let method: string[]
  if (x1 === 0) {
    const n = x2
    const bShown = decimal ? `${fracTex(1, 2, '\\tfrac')} = ${show(b)}` : String(b)
    const second = n === 1
      ? `$${a}b = ${y2}$, so $b = ${bShown}$`
      : `$${a}b^${n} = ${y2}$, so $b^${n} = ${fracTex(y2, a, '\\tfrac')}$ and $b = ${bShown}$${n === 2 ? ', taking the positive value for a base' : ''}`
    solution = `At $x = 0$, $y = a = ${a}$. At $x = ${n}$, ${second}.`
    method = [`a = ${a}`]
  } else {
    const d = x2 - x1
    const power = d === 1 ? 'b' : `b^${d}`
    const divide = `Dividing the second $y$ by the first: $\\dfrac{${y2}}{${y1}} = \\dfrac{ab^${x2}}{ab} = ${power}$, so ${d === 1 ? `$b = ${b}$` : `$b^${d} = ${y2 / y1}$ and $b = ${b}$`}.`
    if (ask === 'b') {
      solution = `${divide} Then $ab = ${y1}$ gives $a = ${a}$. Check: at $x = ${x2}$, $${a} \\times ${b}^${x2} = ${y2}$.`
      method = [`${y2} ÷ ${y1} = ${d === 1 ? 'b' : `b${sup(d)}`}`]
    } else {
      solution = `${divide} Then $ab = ${y1}$ gives $a = \\dfrac{${y1}}{${b}} = ${a}$. Check: at $x = ${x2}$, $${a} \\times ${b}^${x2} = ${y2}$.`
      method = [`b = ${b}`]
    }
  }
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, method, show(answer)), answer, tolerance: 0 },
    check: exponentialCheck(prompt, ask, answer, 1),
    values: { kind, x1, y1, x2, y2, a, b, ask },
  }
}

/**
 * y = ab⁻ˣ: each step in x divides y by b. The smaller y is drawn first, then the larger is
 * b or b² times it and a is the larger times b to the power of its x. The answer (a seven
 * times in ten, else b) is never a printed coordinate, and the smaller y is never b itself.
 */
function exponentialDecay(r: Rng, slot: Question): Draft {
  const ask = r() < 0.7 ? 'a' : 'b'
  const { b, x1, x2, y1, y2, a } = draw(
    r,
    (r) => {
      const b = pick(r, [2, 2, 3, 4, 5])
      const x1 = r() < 0.7 ? 1 : 2
      const d = r() < 0.7 ? 1 : 2
      const m = int(r, 1, 12)
      return { b, x1, x2: x1 + d, y2: m, y1: m * b ** d, a: m * b ** (x1 + d) }
    },
    ({ b, x1, x2, y1, y2, a }) => a <= 500 && y1 <= 250 && y2 !== b && notPrinted(ask === 'a' ? a : b, [x1, y1, x2, y2]) && new Set([x1, y1, x2, y2]).size === 4,
  )
  const d = x2 - x1
  const ratio = b ** d
  const bx1 = b ** x1
  const first = d === 1
    ? `Each step in $x$ divides $y$ by $b$, and $${y1}$ to $${y2}$ is a division by $${b}$, so $b = ${b}$.`
    : `Each step in $x$ divides $y$ by $b$. From $x = ${x1}$ to $x = ${x2}$ is two steps, and $${y1}$ to $${y2}$ is a division by $${ratio}$, so $b^2 = ${ratio}$ and $b = ${b}$.`
  const at1 = x1 === 1 ? `\\frac{a}{${b}}` : `\\frac{a}{${b}^2} = \\frac{a}{${bx1}}`
  const solution = `${first} Then $y = ${at1}$ at $x = ${x1}$ gives $a = ${y1} \\times ${bx1} = ${a}$. Check: at $x = ${x2}$, $\\frac{${a}}{${b ** x2}} = ${y2}$.`
  const prompt = `The curve $y = ab^{-x}$ passes through $${pt(x1, y1)}$ and $${pt(x2, y2)}$. ${pick(r, [`Work out $${ask}$.`, `Work out the value of $${ask}$.`])}`
  const answer = ask === 'a' ? a : b
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [ask === 'a' ? `b = ${b}` : `${y1} ÷ ${y2} = ${ratio}`], String(answer)),
      answer,
      tolerance: 0,
    },
    check: exponentialCheck(prompt, ask, answer, -1),
    values: { x1, y1, x2, y2, a, b, ask },
  }
}

// ---------------------------------------------------------------------------------------
// Algebraic fractions q9: x/(x − 2) − 3/(x + 2) = 1. x = 10.
// ---------------------------------------------------------------------------------------

/**
 * x/(x + u) + c/(x + v) = 1 clears to x(x + v) + c(x + u) = (x + u)(x + v); the x² terms cancel
 * and (c − u)x = u(v − c). The answer X is drawn first with u and c, and v = c + X(c − u)/u
 * fitted where it is a whole number. c is 2 to 9 in size and unlike u and v in size. X never
 * makes a denominator zero, is never a printed number, and neither slip gives it: the c not
 * multiplied by its bracket, or a minus lost.
 */
function fractionEquation(r: Rng, slot: Question): Draft {
  const { X, u, v, c } = draw(
    r,
    (r) => {
      const X = pm(r) * int(r, 2, 15)
      const u = pm(r) * int(r, 1, 6)
      const c = pm(r) * int(r, 2, 9)
      return { X, u, c, v: c + (X * (c - u)) / u }
    },
    ({ X, u, v, c }) =>
      Number.isInteger(v) && v !== 0 && Math.abs(v) <= 9 && Math.abs(c) !== Math.abs(u) && Math.abs(c) !== Math.abs(v) && X + u !== 0 && X + v !== 0 && notPrinted(X, [u, v, c]) &&
      X !== (c - u * v) / u && (c + u === 0 || X !== (-u * (v + c)) / (c + u)),
  )
  const den1 = lin(1, u, 'x', true)
  const den2 = lin(1, v, 'x', true)
  const sign = c < 0 ? '-' : '+'
  const cFrac = `\\dfrac{${Math.abs(c)}}{${den2}}`
  const xFrac = `\\dfrac{x}{${den1}}`
  // The number fraction first now and then, when it is added.
  const swapped = c > 0 && r() < 0.3
  const equation = swapped ? `${cFrac} + ${xFrac} = 1` : `${xFrac} ${sign} ${cFrac} = 1`
  const prompt = `Solve $${equation}$.`
  const K = c - u
  const R = u * v - c * u
  const leaving = K === 1 ? `leaving $x = ${X}$` : `leaving $${coef(K, 'x')} = ${R}$, so $x = ${X}$`
  // The check: each fraction at x = X as printed, with the printed operator and any negative
  // inside its braces, then reduced, adding to 1. Reducing a negative denominator can turn a
  // subtraction into an addition, so the raw stage always comes first.
  const [n1, d1] = reduce(X, X + u)
  const [n2, d2] = reduce(c, X + v)
  const xRaw = `\\frac{${X}}{${X + u}}`
  const cRaw = `\\frac{${Math.abs(c)}}{${X + v}}`
  // In the printed order: the number fraction first when swapped (then always added).
  const raw = swapped ? `${cRaw} + ${xRaw}` : `${xRaw} ${sign} ${cRaw}`
  const reduced = swapped
    ? `${fracTex(n2, d2, '\\frac')} ${n1 < 0 ? '-' : '+'} ${fracTex(Math.abs(n1), d1, '\\frac')}`
    : `${fracTex(n1, d1, '\\frac')} ${n2 < 0 ? '-' : '+'} ${fracTex(Math.abs(n2), d2, '\\frac')}`
  const stages = raw !== reduced ? `${raw} = ${reduced}` : reduced
  const solution =
    `Combine: $\\dfrac{${swapped ? `${c}(${den1}) + x(${den2})` : `x(${den2}) ${sign} ${Math.abs(c)}(${den1})`}}{${swapped ? `(${den2})(${den1})` : `(${den1})(${den2})`}} = 1$, so $${poly([c * u, v + c, 1])} = ${poly([u * v, u + v, 1])}$. ` +
    `The $x^2$ terms cancel, ${leaving}. Check: $${stages} = 1$.`
  const gap = evalEquation(equation, { x: X })
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, ['clears the denominators'], minus(X)), answer: X, tolerance: 0 },
    check: { agrees: near(gap, 0) && X + u !== 0 && X + v !== 0, detail: `printed equation at x = ${X}: left minus right ${gap}` },
    values: { X, u, v, c, swapped: String(swapped) },
  }
}

// ---------------------------------------------------------------------------------------
// Proof q10: (3n + 1)² − (3n − 1)² is a multiple of 12; its value at n = 7 is 84.
// ---------------------------------------------------------------------------------------

/**
 * (an + b)² − (an − b)² = 4abn, so a multiple of 4ab; one time in five the brackets are the
 * other way round and the value is negative. a = 1 is rare and never with b = 3, the core
 * sheet's (n + 3)² − (n − 3)². n is 5 to 14 so it is never a or b, the value M × n is never
 * a printed number, and an ≠ b, where the middle term of (an − b)² missed would give it too.
 */
function differenceOfSquaresProof(r: Rng, slot: Question): Draft {
  const { a, b, N, swapped } = draw(
    r,
    (r) => ({ a: r() < 0.15 ? 1 : int(r, 2, 5), b: int(r, 1, 5), N: int(r, 5, 14), swapped: r() < 0.2 }),
    // a·n ≠ b: there the middle term of (an − b)² missed, 2abn + 2b², is the answer too.
    ({ a, b, N }) => !(a === 1 && b === 3) && a !== b && N !== a && a * N !== b && N !== 4 * a * b && notPrinted(4 * a * b * N, [a, b, 4 * a * b, N]),
  )
  const M = 4 * a * b
  const V = (swapped ? -1 : 1) * M * N
  const plusSq = `(${lin(a, b, 'n', true)})^2`
  const minusSq = `(${lin(a, -b, 'n', true)})^2`
  const expression = swapped ? `${minusSq} - ${plusSq}` : `${plusSq} - ${minusSq}`
  const prompt = `Prove that $${expression}$ is a multiple of $${M}$ for every integer $n$. What is the value of the expression when $n = ${N}$?`
  const plus = poly([b * b, 2 * a * b, a * a], 'n')
  const minusExp = poly([b * b, -2 * a * b, a * a], 'n')
  const big = a * N + b
  const small = a * N - b
  const solution = swapped
    ? `$(${minusExp}) - (${plus}) = -${M}n$, which is $${M}$ times the integer $-n$. When $n = ${N}$ it is $-${M} \\times ${N} = ${V}$. ` +
      `Check: $${small}^2 - ${big}^2 = (${small} + ${big})(${small} - ${big}) = ${small + big} \\times (${small - big}) = ${V}$.`
    : `$(${plus}) - (${minusExp}) = ${M}n$, which is $${M}$ times the integer $n$. When $n = ${N}$ it is $${M} \\times ${N} = ${V}$. ` +
      `Check: $${big}^2 - ${small}^2 = (${big} + ${small})(${big} - ${small}) = ${big + small} \\times ${big - small} = ${V}$.`
  // Second route: the printed expression read at n = N, and at other integers it is a multiple of M.
  const read = evalTex(expression, { n: N })
  const multiples = [-3, 1, 2, 3, 4, 6].every((n) => evalTex(expression, { n }) % M === 0)
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [`expands and simplifies to ${swapped ? '−' : ''}${M}n`], minus(V)),
      answer: V,
      tolerance: 0,
    },
    check: { agrees: read === V && multiples, detail: `printed expression at n = ${N}: ${read}; a multiple of ${M} at other n: ${multiples}` },
    values: { a, b, N, M, swapped: String(swapped) },
  }
}

export const functionGenerators: Generator[] = [
  fmBySlot('fm-function-value-and-inverse', FUNC, { q1: evaluateQuadratic, q9: meetsInverse }),
  fmBySlot('fm-composite-unknown', FUNC, { q6: compositeUnknown }),
  fmBySlot('fm-exponential-from-points', FUNC, { q8: exponentialGrowth, q16: exponentialDecay }),
  fmBySlot('fm-fraction-equation', FRACTIONS, { q9: fractionEquation }),
  fmBySlot('fm-difference-of-squares-proof', PROOF, { q10: differenceOfSquaresProof }),
]
