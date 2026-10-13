import type { Question } from '../../content/questions.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Check, Draft, Generator } from '../types.ts'
import { evalTex, near, sub } from '../maths/formulae.ts'
import { poly, type Poly } from '../maths/quadratics.ts'
import { fmBySlot, minus } from './build.ts'

/**
 * Further Maths (AQA 8365): differentiation-and-the-gradient-function,
 * tangents-normals-and-increasing-functions and maxima-minima-and-optimisation.
 *
 * 4.1–4.3  The gradient function: differentiating kxⁿ and sums of such terms, the gradient of
 *          a quadratic or a cubic at a point.
 * 4.4      The tangent at a point: the y coordinate from the curve, the gradient from dy/dx.
 * 4.5      Where the gradient is zero (a horizontal tangent), and where it has a given value.
 * 4.6      d²y/dx² at a point.
 * 4.7      Stationary points of a quadratic: the x coordinate, and the y coordinate of a minimum
 *          or a maximum.
 * 4.8      Optimisation: a pen against a wall, A = Lx − 2x², and a closed box with a square
 *          base, S = 2x² + 4V/x.
 *
 * Every answer is checked a second way by numbers alone, never by differentiating again: a
 * central difference on the printed curve for a gradient, a second difference for d²y/dx², and
 * neighbours and a grid of the printed curve or formula for a stationary point.
 */

const DIFF = 'differentiation-and-the-gradient-function'
const TANGENT = 'tangents-normals-and-increasing-functions'
const STATIONARY = 'maxima-minima-and-optimisation'

const pm = (r: Rng) => (r() < 0.5 ? -1 : 1)
/** A whole number from lo to hi in size, either sign. */
const either = (r: Rng, lo: number, hi: number) => pm(r) * int(r, lo, hi)
/** Picks by weight: [value, weight] pairs. */
function weighted<T>(r: Rng, items: readonly (readonly [T, number])[]): T {
  let left = r() * items.reduce((s, [, w]) => s + w, 0)
  for (const [v, w] of items) if ((left -= w) < 0) return v
  return items[items.length - 1]![0]
}
/** An x value to substitute: ±1 (which only sums the coefficients) about one time in seven. */
const at = (r: Rng, choices: number[]) => (r() < 0.14 ? pick(r, [-1, 1]) : pick(r, choices))

/** The derivative by the power rule: kxⁿ → nkxⁿ⁻¹. */
export const deriv = (p: Poly): Poly => (p.length <= 1 ? [0] : p.slice(1).map((c, i) => c * (i + 1)))
const valueAt = (p: Poly, x: number) => p.reduce((s, c, n) => s + c * x ** n, 0)
const dydx = '\\frac{dy}{dx}'
const d2ydx2 = '\\frac{d^2y}{dx^2}'

/** A signed list of numbers as a sum: 48 - 9, -16 + 32 - 3. */
const signed = (xs: number[]) => xs.map((v, i) => (i === 0 ? String(v) : v < 0 ? ` - ${-v}` : ` + ${v}`)).join('')

/**
 * Substituting x into a polynomial, as the written solutions show it: 12 \times 2^2 - 9 =
 * 12 \times 4 - 9 = 48 - 9 = 39. Each line is built from the same terms, so every step
 * evaluates to the answer (calculus.test.ts reads each one back).
 */
export function substitution(p: Poly, x: number): string {
  const terms = p.map((c, n) => [c, n] as const).reverse().filter(([c]) => c !== 0)
  const join = (parts: [number, string][]) => parts.map(([c, s], i) => (i === 0 ? (c < 0 ? `-${s}` : s) : c < 0 ? ` - ${s}` : ` + ${s}`)).join('')
  const term = (c: number, n: number, powered: boolean) => {
    const size = Math.abs(c)
    if (n === 0) return String(size)
    // A bare power after a minus is bracketed whatever x's sign, -(2)^2 as -(-3)^2, so it is
    // never read as -2^2 squared with its sign.
    const bare = size === 1 && c < 0 ? `(${x})` : sub(x)
    const base = n === 1 ? sub(x) : powered ? String(x ** n) : `${bare}^${n}`
    return size === 1 ? base : `${size} \\times ${base}`
  }
  const lines = [
    join(terms.map(([c, n]) => [c, term(c, n, false)])),
    join(terms.map(([c, n]) => [c, term(c, n, true)])),
    signed(terms.map(([c, n]) => c * x ** n)),
    String(valueAt(p, x)),
  ]
  return lines.filter((l, i) => l !== lines[i - 1]).join(' = ')
}

/** The printed curve y = … from the prompt, as a function evaluated from its text. */
function printedCurve(prompt: string): (x: number) => number {
  const math = [...prompt.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]!).find((m) => /^[A-Za-z] = /.test(m))
  if (!math) throw new Error(`no curve in ${prompt}`)
  const rhs = math.slice(math.indexOf('=') + 1)
  return (x) => evalTex(rhs, { x })
}
/** The x the prompt substitutes, read from its "x = …". */
const printedX = (prompt: string) => Number(/\$x = (-?\d+)\$/.exec(prompt)![1])

/** Gradient by a central difference on the printed curve: no differentiating. */
const centralDifference = (f: (x: number) => number, x: number, h = 1e-4) => (f(x + h) - f(x - h)) / (2 * h)
/** d²y/dx² by a second difference on the printed curve. */
const secondDifference = (f: (x: number) => number, x: number, h = 1e-3) => (f(x + h) - 2 * f(x) + f(x - h)) / (h * h)

function gradientCheck(prompt: string, answer: number): Check {
  const f = printedCurve(prompt)
  const x = printedX(prompt)
  const g = centralDifference(f, x)
  return { agrees: Math.abs(g - answer) < 1e-5 * Math.max(1, Math.abs(answer)), detail: `central difference of the printed curve at x = ${x}: ${g}` }
}

/**
 * A stationary point checked by its neighbours: the printed curve at x ± 0.001 and on a grid
 * 0.25 apart over 10 either side is never below a minimum (above a maximum), and its central
 * difference there is zero.
 */
function turningCheck(prompt: string, x: number, kind: 'min' | 'max', y?: number): Check {
  const f = printedCurve(prompt)
  const fx = f(x)
  const s = kind === 'min' ? 1 : -1
  const near1 = [x - 1e-3, x + 1e-3].every((t) => s * (f(t) - fx) > 0)
  const grid = Array.from({ length: 81 }, (_, i) => x - 10 + i / 4)
  const best = grid.every((t) => s * (f(t) - fx) >= -1e-9)
  const flat = Math.abs(centralDifference(f, x)) < 1e-6
  const height = y === undefined || near(fx, y)
  return { agrees: near1 && best && flat && height, detail: `printed curve at x = ${x}: ${fx}; neighbours ${kind === 'min' ? 'above' : 'below'}: ${near1}; grid: ${best}; central difference ${centralDifference(f, x)}` }
}

/** None of the printed numbers is the answer, by size. */
const notPrinted = (answer: number, printed: number[]) => !printed.some((v) => Math.abs(v) === Math.abs(answer))

// ---------------------------------------------------------------------------------------
// The gradient of a quadratic at a point: differentiation q5, tangents q5.
// ---------------------------------------------------------------------------------------

interface Quad {
  a: number
  b: number
  c: number
  x0: number
}

/**
 * y = ax² + bx + c and x₀ with the gradient 2ax₀ + b drawn first. The leading coefficient is
 * 1 about two times in five, as written; no slip pays: the curve's own value, the power left
 * on the coefficient (ax₀ + b), the constant kept (2ax₀ + b + c), or a printed number.
 */
function drawGradientQuadratic(r: Rng): Quad & { g: number } {
  return draw(
    r,
    (r) => {
      const g = either(r, 1, 25)
      const a = r() < 0.4 ? 1 : pick(r, [2, 3, 4, 5, -1, -2, -3])
      const x0 = at(r, [-3, -2, 2, 3, 4, 5])
      return { g, a, x0, b: g - 2 * a * x0, c: either(r, 1, 12) }
    },
    ({ g, a, b, c, x0 }) =>
      Math.abs(b) >= 2 && Math.abs(b) <= 15 &&
      g !== a * x0 * x0 + b * x0 + c && g !== a * x0 + b && g !== 2 * a * x0 + b + c &&
      notPrinted(g, [a, b, c, x0]),
  )
}

function gradientOfQuadratic(r: Rng, slot: Question, tangent: boolean): Draft {
  const { g, a, b, c, x0 } = drawGradientQuadratic(r)
  const p = [c, b, a]
  const curve = poly(p)
  const d = deriv(p)
  const prompt = tangent
    ? `Work out the gradient of the tangent to $y = ${curve}$ at the point where $x = ${x0}$.`
    : pick(r, [`The curve $y = ${curve}$ is given. Work out the gradient of the curve at $x = ${x0}$.`, `Work out the gradient of the curve $y = ${curve}$ at the point where $x = ${x0}$.`])
  const solution = tangent
    ? `Differentiate: $${dydx} = ${poly(d)}$. Substitute $x = ${x0}$: $${substitution(d, x0)}$. The tangent's gradient is the curve's gradient there, $${g}$.`
    : `Differentiate first: $${dydx} = ${poly(d)}$. Now substitute $x = ${x0}$: $${substitution(d, x0)}$. The gradient there is $${g}$.`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], minus(g)), answer: g, tolerance: 0 },
    check: gradientCheck(prompt, g),
    values: { a, b, c, x0, g },
  }
}

// ---------------------------------------------------------------------------------------
// Differentiation q8: the gradient of a cubic at a point. y = 4x^3 - 9x at x = 2.
// ---------------------------------------------------------------------------------------

/**
 * y = ax³ + bx, with a constant or an x² term now and then. No slip pays: the curve's value,
 * the power not brought down (ax₀² + …), the power not reduced (3ax₀³ + …), the sign of a
 * negative x₀ lost in the square, or a printed number.
 */
function gradientOfCubic(r: Rng, slot: Question): Draft {
  const form = weighted(r, [['ax3+bx', 5], ['ax3+bx+d', 2], ['ax3+kx2+bx', 2]] as const)
  const { p, x0, g } = draw(
    r,
    (r) => {
      const a = r() < 0.75 ? pick(r, [2, 3, 4, 5]) : pick(r, [1, -1, -2])
      const b = either(r, 2, 12)
      const k = form === 'ax3+kx2+bx' ? either(r, 2, 6) : 0
      const d = form === 'ax3+bx+d' ? either(r, 1, 15) : 0
      const p: Poly = [d, b, k, a]
      const x0 = at(r, [-3, -2, 2, 3])
      return { p, x0, g: valueAt(deriv(p), x0) }
    },
    ({ p, x0, g }) => {
      const [d, b, k, a] = p as [number, number, number, number]
      const slips = [valueAt(p, x0), a * x0 ** 2 + k * x0 + b, 3 * a * x0 ** 3 + 2 * k * x0 ** 2 + b, -3 * a * x0 ** 2 + 2 * k * x0 + b]
      return g !== 0 && !slips.includes(g) && notPrinted(g, [a, b, k, d, x0])
    },
  )
  const curve = poly(p)
  const d = deriv(p)
  const prompt = `Work out the gradient of the curve $y = ${curve}$ at the point where $x = ${x0}$.`
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `Differentiate: $${dydx} = ${poly(d)}$. Substitute $x = ${x0}$: $${substitution(d, x0)}$.`,
      markScheme: scheme(slot, [], minus(g)),
      answer: g,
      tolerance: 0,
    },
    check: gradientCheck(prompt, g),
    values: { form, curve, x0, g },
  }
}

// ---------------------------------------------------------------------------------------
// Differentiation q13: the second derivative at a point. y = 2x^4 - 5x^2 + 11 at x = 1.
// ---------------------------------------------------------------------------------------

/**
 * d²y/dx² of ax⁴ + bx² + c (as written), ax⁴ + bx³ + cx or a cubic, at x₀. No slip pays:
 * dy/dx at x₀ (differentiating once), (dy/dx)² (the q16 confusion), the curve's value, or a
 * printed number. The second route is a second difference of the printed curve.
 */
function secondDerivative(r: Rng, slot: Question): Draft {
  const form = weighted(r, [['ax4+bx2+c', 2], ['ax4+bx3+cx', 1], ['cubic', 1]] as const)
  const { p, x0, g } = draw(
    r,
    (r) => {
      const a = r() < 0.8 ? either(r, 2, 4) : 1
      const b = either(r, 2, 9)
      const c = either(r, 1, 12)
      const p: Poly = form === 'ax4+bx2+c' ? [c, 0, b, 0, a] : form === 'ax4+bx3+cx' ? [0, c, 0, b, a] : [either(r, 1, 12), c, b, a]
      const x0 = at(r, [-2, 2, 3, -3])
      return { p, x0, g: valueAt(deriv(deriv(p)), x0) }
    },
    ({ p, x0, g }) => {
      const once = valueAt(deriv(p), x0)
      const slips = [once, once * once, valueAt(p, x0)]
      // Sizes a student works by hand at x₀ = ±3: a quartic's x⁴ stays below 400.
      return g !== 0 && Math.abs(g) <= 400 && !slips.includes(g) && notPrinted(g, [...p, x0])
    },
  )
  const curve = poly(p)
  const d1 = deriv(p)
  const d2 = deriv(d1)
  const prompt = `Given $y = ${curve}$, work out the value of $${d2ydx2}$ when $x = ${x0}$.`
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `Differentiate once: $${dydx} = ${poly(d1)}$. Differentiate again: $${d2ydx2} = ${poly(d2)}$. Substitute $x = ${x0}$: $${substitution(d2, x0)}$.`,
      markScheme: scheme(slot, [], minus(g)),
      answer: g,
      tolerance: 0,
    },
    check: (() => {
      const f = printedCurve(prompt)
      const s = secondDifference(f, printedX(prompt))
      return { agrees: Math.abs(s - g) < 1e-3, detail: `second difference of the printed curve at x = ${x0}: ${s}` }
    })(),
    values: { form, curve, x0, g },
  }
}

// ---------------------------------------------------------------------------------------
// Tangents q2: the y coordinate at x. y = x^2 + 2x - 3 at x = 1.
// ---------------------------------------------------------------------------------------

/**
 * The y coordinate from the original curve, the answer drawn first. It is never the gradient
 * there (the slip of substituting into dy/dx), never the constant c, never the value with a
 * negative x₀'s square given a minus sign, never a printed number.
 */
function yCoordinate(r: Rng, slot: Question): Draft {
  const { a, b, c, x0, y0 } = draw(
    r,
    (r) => {
      const y0 = int(r, -15, 20)
      const a = r() < 0.7 ? 1 : pick(r, [2, 3, -1])
      const b = either(r, 2, 8)
      const x0 = at(r, [-4, -3, -2, 2, 3, 4])
      return { a, b, x0, y0, c: y0 - a * x0 * x0 - b * x0 }
    },
    ({ a, b, c, x0, y0 }) =>
      c !== 0 && Math.abs(c) <= 15 && y0 !== 2 * a * x0 + b && y0 !== c && y0 !== -a * x0 * x0 + b * x0 + c && (y0 === 0 || notPrinted(y0, [a, b, c, x0])),
  )
  const p = [c, b, a]
  const prompt = `The curve $y = ${poly(p)}$ is given. Work out the $y$ coordinate of the point where $x = ${x0}$.`
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `Substitute into the **original equation**: $${substitution(p, x0)}$. The point is $(${x0}, ${y0})$.`,
      markScheme: scheme(slot, [], minus(y0)),
      answer: y0,
      tolerance: 0,
    },
    check: (() => {
      const v = printedCurve(prompt)(printedX(prompt))
      return { agrees: near(v, y0), detail: `printed curve read at x = ${x0}: ${v}` }
    })(),
    values: { a, b, c, x0, y0 },
  }
}

// ---------------------------------------------------------------------------------------
// Where dy/dx is zero (tangents q8, maxima q4) or has a given value (tangents q13).
// ---------------------------------------------------------------------------------------

/**
 * y = ax² + bx + c with its turning point at a whole x*, drawn first. No slip pays: −b/a
 * (dropping the 2), b/(2a) (the sign), the y value, a root of the curve (it never touches the
 * axis there), or a printed number, the written 2x² − 8x + 1 among them (x = 2 = a).
 */
function drawTurning(r: Rng, leadOne: number, positive = false): Quad & { y: number } {
  return draw(
    r,
    (r) => {
      const x0 = r() < 0.12 ? pick(r, [-1, 1]) : pick(r, [-5, -4, -3, -2, 2, 3, 4, 5, 6, 7, 8])
      const a = r() < leadOne ? 1 : pick(r, positive ? [2, 3, 4, 5] : [2, 3, 4, 5, -1, -2, -3])
      const c = either(r, 1, 15)
      const b = -2 * a * x0
      return { a, b, c, x0, y: c - a * x0 * x0 }
    },
    ({ a, b, c, x0, y }) => Math.abs(b) <= 30 && y !== 0 && y !== x0 && notPrinted(x0, [a, b, c]),
  )
}

/** Solving 4x − 8 = 0 (or = 4) as the written solutions do: 4x = 8, so x = 2. */
function solveLinear(k: number, m: number, rhs: number, x: number): string {
  const lhs = poly([m, k])
  const moved = rhs - m
  return `$${lhs} = ${rhs}$, so $${k}x = ${moved}$ and $x = ${x}$`
}

function horizontalTangent(r: Rng, slot: Question): Draft {
  const maxima = slot.id === 'q4'
  // q4 is the core sheet's grade 4-5 slot: a minimum, as the written y = x² − 6x + 11, mostly monic.
  const { a, b, c, x0 } = drawTurning(r, maxima ? 0.6 : 0.2, maxima)
  const p = [c, b, a]
  const d = deriv(p)
  const prompt = maxima
    ? `The curve $y = ${poly(p)}$ has one stationary point. Work out the value of $x$ there.`
    : `The curve $y = ${poly(p)}$ has a horizontal tangent at one point. Work out the value of $x$ there.`
  const lead = maxima ? 'Differentiate' : 'Horizontal means the gradient is zero. Differentiate'
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `${lead}: $${dydx} = ${poly(d)}$. Set it to zero: ${solveLinear(d[1]!, d[0]!, 0, x0)}.`,
      markScheme: scheme(slot, [], minus(x0)),
      answer: x0,
      tolerance: 0,
    },
    check: turningCheck(prompt, x0, a > 0 ? 'min' : 'max'),
    values: { a, b, c, x0 },
  }
}

/**
 * Tangents q13: the x at which the gradient is g, the question run backwards. No slip pays:
 * (g − b)/a, (g + b)/(2a), a solution of y = g, or a printed number.
 */
function givenGradient(r: Rng, slot: Question): Draft {
  const { a, b, c, x0, g } = draw(
    r,
    (r) => {
      const x0 = r() < 0.12 ? pick(r, [-1, 1]) : pick(r, [-4, -3, -2, 2, 3, 4, 5, 6])
      const a = r() < 0.2 ? 1 : pick(r, [2, 3, 4, -1, -2])
      const b = either(r, 2, 12)
      return { a, b, x0, c: either(r, 1, 12), g: 2 * a * x0 + b }
    },
    ({ a, b, c, x0, g }) => g !== 0 && Math.abs(g) <= 30 && a * x0 * x0 + b * x0 + c !== g && notPrinted(x0, [a, b, c, g]),
  )
  const p = [c, b, a]
  const d = deriv(p)
  const prompt = `On the curve $y = ${poly(p)}$, find the value of $x$ at which the tangent has gradient $${g}$.`
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `Differentiate: $${dydx} = ${poly(d)}$. Set the gradient function equal to the wanted gradient: ${solveLinear(d[1]!, d[0]!, g, x0)}. This is the standard question run backwards — instead of being given $x$ and finding the gradient, you are given the gradient and find $x$.`,
      markScheme: scheme(slot, [], minus(x0)),
      answer: x0,
      tolerance: 0,
    },
    check: (() => {
      const s = centralDifference(printedCurve(prompt), x0)
      return { agrees: Math.abs(s - g) < 1e-6, detail: `central difference of the printed curve at x = ${x0}: ${s}` }
    })(),
    values: { a, b, c, x0, g },
  }
}

// ---------------------------------------------------------------------------------------
// Maxima q5 and q12: the y coordinate of a minimum, or of a maximum.
// ---------------------------------------------------------------------------------------

/**
 * y = a(x − x*)² + y* multiplied out, x* and y* drawn first: a minimum (q5, a > 0) or a
 * maximum (q12, a < 0). No slip pays: c (the y-intercept, which f(2x*) also gives when the 2 is
 * dropped), f(−x*), x* itself, or a printed number.
 */
function turningY(r: Rng, slot: Question): Draft {
  const maximum = slot.id === 'q12'
  const { a, b, c, x0, y0 } = draw(
    r,
    (r) => {
      const x0 = r() < 0.12 ? pick(r, [-1, 1]) : pick(r, [-5, -4, -3, -2, 2, 3, 4, 5, 6])
      const y0 = int(r, -15, 20)
      const size = r() < 0.4 ? 1 : pick(r, maximum ? [2, 3, 4] : [2, 3])
      const a = maximum ? -size : size
      return { a, x0, y0, b: -2 * a * x0, c: a * x0 * x0 + y0 }
    },
    ({ a, b, c, x0, y0 }) => {
      const f = (x: number) => a * x * x + b * x + c
      return c !== 0 && Math.abs(c) <= 60 && Math.abs(b) <= 30 && y0 !== x0 && y0 !== f(-x0) && (y0 === 0 || notPrinted(y0, [a, b, c]))
    },
  )
  const p = [c, b, a]
  const d = deriv(p)
  const values = signed([a * x0 * x0, b * x0, c])
  const prompt = maximum
    ? `The curve $y = ${poly(p)}$ has one stationary point. Work out the $y$ coordinate there.`
    : `The curve $y = ${poly(p)}$ has a minimum. Work out the $y$ coordinate at that minimum.`
  const solution = maximum
    ? `Differentiate: $${dydx} = ${poly(d)}$. Set to zero: ${solveLinear(d[1]!, d[0]!, 0, x0)}. Substituting into the curve: $y = ${values} = ${y0}$. The second derivative is $${2 * a}$, negative, so it is a maximum.`
    : `Differentiate: $${dydx} = ${poly(d)}$. Set to zero: ${solveLinear(d[1]!, d[0]!, 0, x0)}. Substituting into the **original**: $y = ${values} = ${y0}$. So the minimum point is $(${x0}, ${y0})$.`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], minus(y0)), answer: y0, tolerance: 0 },
    check: turningCheck(prompt, x0, maximum ? 'max' : 'min', y0),
    values: { a, b, c, x0, y0 },
  }
}

// ---------------------------------------------------------------------------------------
// Maxima q8: a pen against a wall. A = 40x - 2x^2, the greatest area.
// ---------------------------------------------------------------------------------------

/**
 * Fence of L = 4k metres on three sides of a rectangle against a wall, the two ends x m:
 * A = x(L − 2x), greatest at x = k with A = 2k². Each setting has fence lengths in its own
 * scale: a vegetable plot's edging is 16 to 40 m, a paddock's fence 60 to 100 m. L × k is at
 * most 2500, a product worked by hand; the short route k × 2k is printed too.
 */
const PENS = [
  { k: [4, 20], open: (L: number) => `A rectangular pen is built against a wall with $${L}$ m of fence on the other three sides.` },
  { k: [15, 25], open: (L: number) => `A farmer fences a rectangular paddock against a long straight wall, using $${L}$ m of fencing for the other three sides.` },
  { k: [6, 25], open: (L: number) => `A rectangular play area is fenced against the side of a building, with $${L}$ m of fence on the other three sides.` },
  { k: [4, 10], open: (L: number) => `A rectangular vegetable plot is marked out against a garden wall, with $${L}$ m of edging along the other three sides.` },
] as const

function penAgainstWall(r: Rng, slot: Question): Draft {
  const setting = weighted(r, PENS.map((s) => [s, Math.sqrt(s.k[1] - s.k[0] + 1)] as const))
  const k = int(r, setting.k[0], setting.k[1])
  const L = 4 * k
  const answer = 2 * k * k
  const bracket = r() < 0.35
  const formula = bracket ? `A = x(${L} - 2x)` : `A = ${L}x - 2x^2`
  // Two ways of naming the ends, so 55 fence lengths × 2 formulas × 2 give well over 100 prompts.
  const ends = r() < 0.6 ? 'With the two ends each $x$ m' : 'If each of the two ends is $x$ m long'
  const prompt = `${setting.open(L)} ${ends}, the area is $${formula}$. Work out the greatest possible area, in m².`
  const expand = bracket ? `Multiply out first: $A = ${L}x - 2x^2$. ` : ''
  const solution =
    `${expand}Differentiate: $\\frac{dA}{dx} = ${L} - 4x$. Set to zero: $4x = ${L}$, so $x = ${k}$. The second derivative is $-4$, negative, so this is a maximum. ` +
    `Substituting back: $A = ${L}(${k}) - 2(${k})^2 = ${L * k} - ${answer} = ${answer}$ m². The side along the wall is $${L} - 2(${k}) = ${2 * k}$ m, so the rectangle is $${k}$ m by $${2 * k}$ m: $A = ${k} \\times ${2 * k} = ${answer}$ m².`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], String(answer)), answer, tolerance: 0 },
    check: optimumCheck(prompt, 'A', k, answer, 'max', [0, L / 2]),
    values: { L, k, bracket: String(bracket) },
  }
}

/**
 * The optimum of a printed formula found by numbers: its value at x* is the answer, it is
 * worse at x* ± 0.001, and no point of a 400-step grid across the domain beats it.
 */
function optimumCheck(prompt: string, letter: string, x: number, answer: number, kind: 'min' | 'max', [lo, hi]: [number, number]): Check {
  const math = [...prompt.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]!).find((m) => m.startsWith(`${letter} = `))!
  const f = (t: number) => evalTex(math.slice(letter.length + 3), { x: t })
  const s = kind === 'min' ? 1 : -1
  const fx = f(x)
  const grid = Array.from({ length: 399 }, (_, i) => lo + ((hi - lo) * (i + 1)) / 400)
  const beaten = grid.filter((t) => s * (f(t) - fx) < -1e-9)
  const sides = [x - 1e-3, x + 1e-3].every((t) => s * (f(t) - fx) > 0)
  return { agrees: near(fx, answer) && sides && beaten.length === 0, detail: `printed ${letter} at x = ${x}: ${fx}; neighbours worse: ${sides}; grid points better: ${beaten.length}` }
}

// ---------------------------------------------------------------------------------------
// Maxima q14: the least surface area of a box with a square base.
// ---------------------------------------------------------------------------------------

/**
 * A closed box of side x and volume V = x³, so S = 2x² + 4V/x, least when the box is a cube,
 * S = 6x². Closed only: q18 on the same sheet is the open-topped tank, and asks why its answer
 * is not a cube. Never x = 6, where the answer is V itself (216), nor 11 or more, whose cube
 * roots (∛1331) are beyond recall. Volumes from 8 cm³ to 1728 cm³.
 */
/** Never 3: the box of side 3 is the written question's, its answer 54. */
export const BOX_SIDES = [2, 4, 5, 7, 8, 9, 10, 12]
const BOXES = ['A closed box', 'A closed cardboard box', 'A closed metal box', 'A closed gift box']

function leastSurfaceArea(r: Rng, slot: Question): Draft {
  const x = pick(r, BOX_SIDES)
  const V = x ** 3
  const K = 4 * V
  const answer = 6 * x * x
  const name = pick(r, BOXES)
  const power = r() < 0.5
  const formula = `S = 2x^2 + ${power ? `${K}x^{-1}` : `\\dfrac{${K}}{x}`}`
  const holds = pick(r, [`and volume $${V}$ cm³`, `and holds $${V}$ cm³`])
  const prompt = `${name} has a square base of side $x$ cm ${holds}, so its surface area is $${formula}$. Work out the least possible surface area, in cm².`
  const solution =
    `Differentiate: $\\frac{dS}{dx} = 4x - ${K}x^{-2}$. Set to zero: $4x^3 = ${K}$, so $x^3 = ${V}$ and $x = ${x}$. ` +
    `The second derivative there is $${4 + (2 * K) / x ** 3}$, positive, so it is a minimum. ` +
    `Substituting: $S = 2(${x * x}) + \\frac{${K}}{${x}} = ${2 * x * x} + ${K / x} = ${answer}$ cm². The box is a cube of side ${x} cm.`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], String(answer)), answer, tolerance: 0 },
    check: optimumCheck(prompt, 'S', x, answer, 'min', [0.2, 3 * x]),
    values: { x, V, name },
  }
}

export const calculusGenerators: Generator[] = [
  fmBySlot('fm-gradient-at-a-point', DIFF, { q5: (r, s) => gradientOfQuadratic(r, s, false), q8: gradientOfCubic, q13: secondDerivative }),
  fmBySlot('fm-tangent-steps', TANGENT, { q2: yCoordinate, q5: (r, s) => gradientOfQuadratic(r, s, true), q8: horizontalTangent, q13: givenGradient }),
  fmBySlot('fm-stationary-points', STATIONARY, { q4: horizontalTangent, q5: turningY, q12: turningY }),
  fmBySlot('fm-optimisation', STATIONARY, { q8: penAgainstWall, q14: leastSurfaceArea }),
]
