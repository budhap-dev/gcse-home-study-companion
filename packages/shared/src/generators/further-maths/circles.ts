import type { Question } from '../../content/questions.ts'
import { clearOfHalf, fixed, roundTo, show } from '../format.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Check, Draft, Generator } from '../types.ts'
import { evalEquation, evalTex, fracTex, fracText, near, sub, sum, terminates } from '../maths/formulae.ts'
import { fmBySlot, minus } from './build.ts'
import { COORD, TRIPLES, pointsIn } from './lines.ts'

/**
 * Further Maths (AQA 8365), circles-and-the-tangent-at-a-point.
 *
 * 3.7  x² + y² = r²: the radius read from the equation (the square root of the right-hand
 *      side), a circle from the ends of a diameter, where a line meets the circle, and the
 *      circle facts the specification names: the angle between tangent and radius is 90°, so
 *      the length of a tangent from an external point comes from Pythagoras.
 * 3.8  (x − a)² + (y − b)² = r²: the centre from the signs in the brackets, the radius.
 * 3.9  The tangent at a point: its gradient as the negative reciprocal of the radius', the
 *      tangent condition c² = r²(1 + m²) from a repeated root, and the triangle a tangent makes
 *      with the axes.
 *
 * Non-calculator except q15: whole coordinates within ±15, Pythagorean distances, decimals
 * that terminate. Every answer is checked a second way from the printed text: a point
 * substituted into the printed circle, a dot product for a perpendicular, the foot of the
 * perpendicular from the centre for a tangent, the shoelace formula for an area.
 */

const TOPIC = 'circles-and-the-tangent-at-a-point'

const pm = (r: Rng) => (r() < 0.5 ? -1 : 1)
const pt = (x: number, y: number) => `(${show(x)}, ${show(y)})`
const isSquare = (n: number) => Number.isInteger(Math.sqrt(n))

/** (x − a)² with the sign as the bracket prints it: (x + 1)^2 for a = −1, x^2 for a = 0. */
const bracketSq = (v: string, k: number) => (k === 0 ? `${v}^2` : `(${v} ${k < 0 ? '+' : '-'} ${Math.abs(k)})^2`)
/** A circle in TeX: x^2 + y^2 = 49, or (x + 1)^2 + (y - 3)^2 = 20. */
export const circleTex = (a: number, b: number, N: number) => `${bracketSq('x', a)} + ${bracketSq('y', b)} = ${show(N)}`

/** One item by weight. */
function weighted<T>(r: Rng, items: readonly T[], weight: (t: T) => number): T {
  const ws = items.map(weight)
  let left = r() * ws.reduce((a, b) => a + b, 0)
  return items.find((_, i) => (left -= ws[i]!) < 0) ?? items[items.length - 1]!
}

/** The first printed equation in a text: its TeX between dollars. */
export const equationIn = (text: string) => [...text.matchAll(/\$([^$]*=[^$]*)\$/g)].map((m) => m[1]!)[0]!
/** Every printed equation in a text. */
const equationsIn = (text: string) => [...text.matchAll(/\$([^$]*=[^$]*)\$/g)].map((m) => m[1]!)

/** √N as k√m with m square-free, in TeX, with its decimal when it is not whole. */
function rootTex(N: number): string {
  for (let k = Math.floor(Math.sqrt(N)); k >= 1; k--) {
    if (N % (k * k) === 0) {
      const m = N / (k * k)
      if (m === 1) return `\\sqrt{${N}} = ${k}`
      const surd = k === 1 ? `\\sqrt{${N}}` : `\\sqrt{${N}} = ${k}\\sqrt{${m}}`
      return `${surd} \\approx ${fixed(Math.sqrt(N), 2)}`
    }
  }
  return `\\sqrt{${N}}`
}

/** No printed size equals the answer's size. */
const noneIs = (answer: number, printed: number[]) => !printed.some((v) => Math.abs(v) === Math.abs(answer))

// ---------------------------------------------------------------------------------------
// q1: the radius from the equation. x² + y² = 49: 7.
// ---------------------------------------------------------------------------------------

/** Whole radii for x² + y² = r², 6 left out: the written q2 on the same sheet asks for x² + y² = 36. */
const RADII = [2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15]
/** A half for the radius, now and then: 2.5² = 6.25, by heart. */
const HALF_RADII = [1.5, 2.5, 3.5, 4.5]

const RADIUS_ASK = [
  (E: string) => `Write down the radius of the circle $${E}$.`,
  (E: string) => `A circle has equation $${E}$. Write down its radius.`,
  (E: string) => `Write down the radius of the circle with equation $${E}$.`,
]

function radiusFromEquation(r: Rng, slot: Question): Draft {
  // The circle centred at the origin as written more often than not; otherwise a centre (a, b)
  // (3.8), drawn so that neither coordinate has the radius' size and they differ, and never the
  // written q3's (x − 3)² + (y + 2)² = 16 on the same sheet.
  const centred = r() < 0.45
  const half = !centred && r() < 0.1
  const radius = half ? pick(r, HALF_RADII) : pick(r, RADII)
  const { a, b } = centred
    ? draw(
        r,
        (r) => {
          const zero = r() < 0.1 ? pick(r, ['a', 'b']) : ''
          return { a: zero === 'a' ? 0 : pm(r) * int(r, 1, 9), b: zero === 'b' ? 0 : pm(r) * int(r, 1, 9) }
        },
        ({ a, b }) => Math.abs(a) !== Math.abs(b) && noneIs(radius, [a, b]) && !(a === 3 && b === -2 && radius === 4),
      )
    : { a: 0, b: 0 }
  const N = radius * radius
  const E = circleTex(a, b, N)
  const prompt = pick(r, RADIUS_ASK)(E) + (half ? ' Give your answer as a decimal.' : '')
  const solution = centred
    ? `$r^2 = ${N}$, so $r = ${radius}$: the square root of the right-hand side, not the right-hand side itself. The centre is $${pt(a, b)}$.`
    : `$r^2 = ${show(N)}$, so $r = ${show(radius)}$. The circle passes through $${pt(radius, 0)}$, $${pt(0, radius)}$, $${pt(-radius, 0)}$ and $${pt(0, -radius)}$.`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], show(radius)), answer: radius, tolerance: 0 },
    check: (() => {
      // Second route: the points one radius east and one radius south of the centre satisfy
      // the printed equation, and the point a unit further east does not.
      const eq = equationIn(prompt)
      const east = evalEquation(eq, { x: a + radius, y: b })
      const south = evalEquation(eq, { x: a, y: b - radius })
      const beyond = evalEquation(eq, { x: a + radius + 1, y: b })
      return { agrees: near(east, 0) && near(south, 0) && !near(beyond, 0), detail: `printed equation at (a + r, b): ${east}, at (a, b − r): ${south}, at (a + r + 1, b): ${beyond}` }
    })(),
    values: { form: centred ? 'centre' : 'origin', a, b, r: radius, N },
  }
}

// ---------------------------------------------------------------------------------------
// q4: the centre from the signs. (x + 1)² + (y − 3)² = 20, the value of a: −1.
// ---------------------------------------------------------------------------------------

const SQUARES = [4, 9, 16, 25, 36, 49, 64, 81, 100]
const NON_SQUARES = [5, 8, 10, 13, 17, 18, 20, 29, 32, 40, 45, 50]

const CENTRE_ASK = [
  (E: string, L: string) => `The circle $${E}$ has centre $(a, b)$. Write down the value of $${L}$.`,
  (E: string, L: string) => `The circle with equation $${E}$ has centre $(a, b)$. Write down the value of $${L}$.`,
  (E: string, L: string) => `The centre of the circle $${E}$ is $(a, b)$. Write down the value of $${L}$.`,
]

/** How the bracket gives the coordinate: x + 1 is x − (−1), so a = −1. */
function signExplained(v: string, L: string, k: number): string {
  if (k === 0) return `there is no bracket on $${v}$, so $${L} = 0$`
  return k < 0 ? `$${v} + ${-k}$ is $${v} - (${k})$, so $${L} = ${k}$` : `$${v} - ${k}$ matches $${v} - ${L}$ directly, so $${L} = ${k}$`
}

function centreFromSigns(r: Rng, slot: Question): Draft {
  const askA = r() < 0.6
  // The asked coordinate first, never zero; the other may be zero one time in ten; the sizes
  // differ, and neither the right-hand side nor the radius is one of them.
  const { a, b, N } = draw(
    r,
    (r) => {
      const asked = pm(r) * int(r, 1, 9)
      const other = r() < 0.1 ? 0 : pm(r) * int(r, 1, 9)
      const N = pick(r, r() < 0.5 ? SQUARES : NON_SQUARES)
      return askA ? { a: asked, b: other, N } : { a: other, b: asked, N }
    },
    ({ a, b, N }) => Math.abs(a) !== Math.abs(b) && ![N, Math.sqrt(N)].some((v) => v === Math.abs(a) || v === Math.abs(b)) && !(a === 3 && b === -2 && N === 16),
  )
  const E = circleTex(a, b, N)
  const L = askA ? 'a' : 'b'
  const answer = askA ? a : b
  const prompt = pick(r, CENTRE_ASK)(E, L)
  const explained = askA ? signExplained('x', 'a', a) : signExplained('y', 'b', b)
  const other = askA ? `b = ${b}` : `a = ${a}`
  const solution = `${explained} and $${other}$: the centre is $${pt(a, b)}$. The radius is $${rootTex(N)}$.`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], minus(answer)), answer, tolerance: 0 },
    check: (() => {
      // Second route: the printed left-hand side is 0 at the centre and 1 a unit away on each axis.
      const lhs = equationIn(prompt).split('=')[0]!
      const at = (x: number, y: number) => evalTex(lhs, { x, y })
      const centre = at(a, b)
      const east = at(a + 1, b)
      const north = at(a, b + 1)
      return { agrees: near(centre, 0) && near(east, 1) && near(north, 1), detail: `printed left side at (a, b): ${centre}, a unit east: ${east}, a unit north: ${north}` }
    })(),
    values: { asked: L, a, b, N },
  }
}

// ---------------------------------------------------------------------------------------
// q7: the gradient of the tangent at a point. x² + y² = 100 at (6, 8): −0.75.
// ---------------------------------------------------------------------------------------

/**
 * Points (p, q) in the first quadrant whose tangent gradient −p/q terminates: q at least 2 (so
 * the answer is never the x coordinate), p not q² (never the y coordinate), p ≠ q (never −1,
 * which negating the radius gradient alone also gives), and x² + y² at most 250.
 */
export const TANGENT_POINTS: [number, number][] = []
for (let p = 1; p <= 15; p++) for (let q = 2; q <= 15; q++) if (p !== q && p !== q * q && p * p + q * q <= 250 && terminates(p, q)) TANGENT_POINTS.push([p, q])

const TANGENT_ASK = [
  (E: string, P: string) => `Work out the gradient of the tangent to the circle $${E}$ at the point $${P}$.`,
  (E: string, P: string) => `$P${P}$ lies on the circle $${E}$. Work out the gradient of the tangent to the circle at $P$.`,
  (E: string, P: string) => `The point $${P}$ lies on the circle $${E}$. Find the gradient of the tangent at this point.`,
]

function tangentGradient(r: Rng, slot: Question): Draft {
  // A whole gradient one time in five, as the decimals outnumber them; the circle centred at
  // the origin three times in four, otherwise at (a, b) with the point a + p, b + q.
  const whole = r() < 0.2
  const centred = r() < 0.25
  const pool = TANGENT_POINTS.filter(([p, q]) => Number.isInteger(p / q) === whole && (!centred || (p <= 9 && q <= 9)))
  const v = draw(
    r,
    (r) => {
      const [p0, q0] = pick(r, pool)
      const p = pm(r) * p0
      const q = pm(r) * q0
      const a = centred ? (r() < 0.15 ? 0 : pm(r) * int(r, 1, 6)) : 0
      const b = centred ? (a === 0 ? pm(r) * int(r, 1, 6) : r() < 0.15 ? 0 : pm(r) * int(r, 1, 6)) : 0
      return { p, q, a, b, N: p0 * p0 + q0 * q0 }
    },
    ({ p, q, a, b, N }) =>
      // Never the written q8's (±3, ±4) on x² + y² = 25 (its gradient −0.75, same higher sheet),
      // q6's (x − 1)² + (y − 2)² = 25 nor q16's (x − 1)² + (y + 2)² = 25; no printed figure has
      // the answer's size; and with a centre, the centre, the origin and the point are never
      // collinear (a·q = b·p, where ignoring the centre or flipping its signs still gives the
      // answer), and the origin is not on the circle.
      !(a === 0 && b === 0 && N === 25 && Math.abs(p) === 3 && Math.abs(q) === 4) &&
      !(a === 1 && Math.abs(b) === 2 && N === 25) &&
      noneIs(p / q, [a, b, N, a + p, b + q]) &&
      (!centred || (a * q !== b * p && a * a + b * b !== N)),
  )
  const { p, q, a, b, N } = v
  const x = a + p
  const y = b + q
  const m = -p / q
  const E = circleTex(a, b, N)
  const P = pt(x, y)
  const prompt = pick(r, TANGENT_ASK)(E, P) + (whole ? '' : ' Give your answer as a decimal.')
  // The radius gradient as the fraction first read, then reduced where that changes it.
  const raw = centred ? `\\frac{${y} - ${sub(b)}}{${x} - ${sub(a)}}` : `\\frac{${q}}{${p}}`
  const reduced = fracTex(q, p, '\\frac')
  const radiusGradient = centred || reduced !== raw ? `${raw} = ${reduced}` : raw
  const tangent = whole ? `${m}` : `${fracTex(-p, q, '\\frac')} = ${show(m)}`
  const solution =
    (centred ? `The centre is $${pt(a, b)}$. The radius from $${pt(a, b)}$ to $${P}$` : `The radius to $${P}$`) +
    ` has gradient $${radiusGradient}$. The tangent is perpendicular, so its gradient is $${tangent}$.`
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [], whole ? minus(m) : `${minus(fracText(-p, q))} or ${minus(show(m))}`),
      answer: m,
      tolerance: 0,
    },
    check: (() => {
      // Second route: the printed point is on the printed circle; the direction (1, m) is at
      // right angles to the radius vector; and the line's points a step either way lie outside.
      const eq = equationIn(prompt)
      const [[px, py]] = pointsIn(prompt) as [[number, number]]
      const on = evalEquation(eq, { x: px, y: py })
      const dot = (px - a) * 1 + (py - b) * m
      const ahead = evalEquation(eq, { x: px + 1, y: py + m })
      const behind = evalEquation(eq, { x: px - 1, y: py - m })
      return { agrees: near(on, 0) && near(dot, 0) && ahead > 0 && behind > 0, detail: `on the circle: ${on}; radius · (1, m): ${dot}; a step along the tangent: ${ahead}, ${behind}` }
    })(),
    values: { form: centred ? 'centre' : 'origin', p, q, a, b, N },
  }
}

// ---------------------------------------------------------------------------------------
// q9: the radius from the ends of a diameter. (−1, 4) and (7, −2): 5.
// ---------------------------------------------------------------------------------------

const DIAMETER_ASK = [
  (A: string, B: string) => `$${A}$ and $${B}$ are the ends of a diameter of a circle. Work out the radius of the circle.`,
  (A: string, B: string) => `A circle has a diameter with ends $A${A}$ and $B${B}$. Work out the radius of the circle.`,
  (A: string, B: string) => `The points $${A}$ and $${B}$ are the ends of a diameter of a circle. Work out its radius.`,
]

/** A horizontal or vertical diameter, about one time in sixteen: no Pythagoras, the length read off. */
const FLAT_DIAMETERS = [4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 16, 18]

function radiusFromDiameter(r: Rng, slot: Question): Draft {
  const flat = r() < 0.06
  const [lx, ly, d] = flat
    ? (() => {
        const d = pick(r, FLAT_DIAMETERS)
        return r() < 0.5 ? [d, 0, d] : [0, d, d]
      })()
    : (() => {
        const [a, b, d] = pick(r, TRIPLES)
        return r() < 0.5 ? [a, b, d] : [b, a, d]
      })()
  const radius = d / 2
  const { x1, y1, x2, y2 } = draw(
    r,
    (r) => {
      const sx = pm(r)
      const sy = pm(r)
      const x1 = sx > 0 ? int(r, -COORD, COORD - lx) : int(r, -COORD + lx, COORD)
      const y1 = sy > 0 ? int(r, -COORD, COORD - ly) : int(r, -COORD + ly, COORD)
      return { x1, y1, x2: x1 + sx * lx, y2: y1 + sy * ly }
    },
    ({ x1, y1, x2, y2 }) => noneIs(radius, [x1, y1, x2, y2]) && new Set([x1, y1, x2, y2].map(Math.abs)).size >= 3,
  )
  const dx = x2 - x1
  const dy = y2 - y1
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const A = pt(x1, y1)
  const B = pt(x2, y2)
  const prompt = pick(r, DIAMETER_ASK)(A, B) + (Number.isInteger(radius) ? '' : ' Give your answer as a decimal.')
  // 7 − (−1) is written 7 + 1, as the written solution has it.
  const diff = (to: number, from: number) => `${to} ${from < 0 ? '+' : '-'} ${Math.abs(from)}`
  // A flat diameter's length is the larger coordinate less the smaller, whichever end is printed first.
  const [hi, lo] = dx === 0 ? [Math.max(y1, y2), Math.min(y1, y2)] : [Math.max(x1, x2), Math.min(x1, x2)]
  const solution = flat
    ? `The ends share ${dx === 0 ? 'an $x$-coordinate, so the diameter is vertical' : 'a $y$-coordinate, so the diameter is horizontal'}: its length is $${diff(hi, lo)} = ${d}$, so the radius is $${show(radius)}$. The centre is the midpoint, $${pt(mx, my)}$.`
    : `The diameter is $\\sqrt{(${diff(x2, x1)})^2 + (${diff(y2, y1)})^2} = \\sqrt{${dx * dx} + ${dy * dy}} = \\sqrt{${d * d}} = ${d}$, so the radius is $${show(radius)}$. The centre is the midpoint, $${pt(mx, my)}$.`
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [minus(`distance between the ends ${d}, or the midpoint ${pt(mx, my)}`)], minus(show(radius))),
      answer: radius,
      tolerance: 0,
    },
    check: (() => {
      // Second route: both printed ends are one radius from the midpoint.
      const [[ax, ay], [bx, by]] = pointsIn(prompt) as [[number, number], [number, number]]
      const cx = (ax + bx) / 2
      const cy = (ay + by) / 2
      const ra = Math.hypot(ax - cx, ay - cy)
      const rb = Math.hypot(bx - cx, by - cy)
      return { agrees: near(ra, radius) && near(rb, radius), detail: `from the midpoint (${cx}, ${cy}) to each end: ${ra}, ${rb}` }
    })(),
    values: { kind: flat ? 'flat' : 'pythagoras', x1, y1, x2, y2, d },
  }
}

// ---------------------------------------------------------------------------------------
// q10: where a line meets a circle. y = x + 1 and x² + y² = 25, first quadrant: x = 3.
// ---------------------------------------------------------------------------------------

interface Meet {
  m: number
  c: number
  N: number
  /** The two points, in order of x. */
  points: [[number, number], [number, number]]
}

const quadrantOf = (x: number, y: number) => (x > 0 ? (y > 0 ? 'first' : 'fourth') : y > 0 ? 'second' : 'third')

/**
 * Lines y = mx + c, m = ±1, ±2 or ±3 and c whole, that meet x² + y² = N at two lattice points
 * in different quadrants, off the axes, within ±15 and with N at most 200: the two x
 * coordinates x₁, x₂ fix c = −(x₁ + x₂)(1 + m²)/2m, and the quadratic after substituting is
 * (1 + m²)x² + 2mcx + c² − N = 0, which divides to x² − (x₁ + x₂)x + x₁x₂ = 0.
 */
export const MEETS: Meet[] = []
for (const m of [1, -1, 2, -2, 3, -3]) {
  const A = 1 + m * m
  for (let x1 = -9; x1 <= 9; x1++)
    for (let x2 = x1 + 1; x2 <= 9; x2++) {
      const c = (-(x1 + x2) * A) / (2 * m)
      if (!Number.isInteger(c) || c === 0 || Math.abs(c) > 20) continue
      const y1 = m * x1 + c
      const y2 = m * x2 + c
      if ([x1, y1, x2, y2].some((v) => v === 0 || Math.abs(v) > 15)) continue
      const N = x1 * x1 + y1 * y1
      // |c| = N (y = −3x − 5 with x² + y² = 5) would print the same figure twice.
      if (N > 200 || N !== x2 * x2 + y2 * y2 || Math.abs(c) === N) continue
      if (quadrantOf(x1, y1) === quadrantOf(x2, y2)) continue
      MEETS.push({ m, c, N, points: [[x1, y1], [x2, y2]] })
    }
}

/**
 * The coordinates that may be asked for: not 1, not a printed figure, not the point's other
 * coordinate, and never a y of the other root's size: for m = −1 the points are (x₁, x₂) and
 * (x₂, x₁), so the y asked would be the other root of the quadratic, written down.
 */
function askable({ m, c, N, points }: Meet): { which: 0 | 1; coord: 'x' | 'y' }[] {
  const out: { which: 0 | 1; coord: 'x' | 'y' }[] = []
  for (const which of [0, 1] as const)
    for (const coord of ['x', 'y'] as const) {
      const [x, y] = points[which]
      const [ox] = points[1 - which]!
      const v = coord === 'x' ? x : y
      const other = coord === 'x' ? y : x
      if (coord === 'y' && Math.abs(v) === Math.abs(ox)) continue
      if (Math.abs(v) !== 1 && noneIs(v, [m, c, N, other])) out.push({ which, coord })
    }
  return out
}

function lineMeetsCircle(r: Rng, slot: Question): Draft {
  // The gradient by the square root of how many calculations it has, then one of them.
  const byM = [1, -1, 2, -2, 3, -3].map((m) => MEETS.filter((x) => x.m === m && askable(x).length > 0))
  const group = weighted(r, byM, (g) => Math.sqrt(g.length))
  const meet = pick(r, group)
  const { m, c, N, points } = meet
  const asks = askable(meet)
  const wantX = r() < 0.6
  const fitting = asks.filter((a) => (a.coord === 'x') === wantX)
  const { which, coord } = pick(r, fitting.length ? fitting : asks)
  const [x, y] = points[which]
  const [ox, oy] = points[1 - which]!
  const answer = coord === 'x' ? x : y
  const quadrant = quadrantOf(x, y)
  const A = 1 + m * m
  const s = x + ox
  const p = x * ox
  // x + y = c for m = −1 half the time; otherwise y = mx + c.
  const sumForm = m === -1 && r() < 0.5
  const line = sumForm ? `x + y = ${c}` : `y = ${sum([[m, 'x'], [c, '']])}`
  const E = circleTex(0, 0, N)
  const named = r() < 0.3
  const prompt = named
    ? `The line $L$ has equation $${line}$. $L$ meets the circle $${E}$ at two points. Work out the $${coord}$-coordinate of the point in the ${quadrant} quadrant.`
    : `The line $${line}$ meets the circle $${E}$ at two points. Work out the $${coord}$-coordinate of the point in the ${quadrant} quadrant.`
  const inner = sumForm ? sum([[c, ''], [-1, 'x']]) : sum([[m, 'x'], [c, '']])
  const expanded = sum([[A, 'x^2'], [2 * m * c, 'x'], [c * c - N, '']])
  const monic = sum([[1, 'x^2'], [-s, 'x'], [p, '']])
  const factor = (root: number) => `(x ${root < 0 ? '+' : '-'} ${Math.abs(root)})`
  const solution =
    `Substitute${sumForm ? ` $y = ${inner}$` : ''}: $x^2 + (${inner})^2 = ${N}$, so $${expanded} = 0$ and $${monic} = ${factor(x)}${factor(ox)} = 0$. ` +
    `The points are $${pt(x, y)}$ and $${pt(ox, oy)}$; the one in the ${quadrant} quadrant has $${coord} = ${answer}$.`
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, ['substitutes and forms a quadratic', minus(`solves ${monic.replace('x^2', 'x²')} = 0`)], `${coord} = ${minus(answer)}`),
      answer,
      tolerance: 0,
    },
    check: (() => {
      // Second route: both points satisfy the printed line and the printed circle (a line meets
      // a circle at most twice, so they are the two), only the asked one is in the asked quadrant.
      const [lineTex, circle] = equationsIn(prompt) as [string, string]
      const gaps = [[x, y], [ox, oy]].map(([px, py]) => [evalEquation(lineTex, { x: px!, y: py! }), evalEquation(circle, { x: px!, y: py! })])
      const onBoth = gaps.every(([l, k]) => near(l!, 0) && near(k!, 0))
      const quadrants = quadrantOf(x, y) === quadrant && quadrantOf(ox, oy) !== quadrant
      return { agrees: onBoth && quadrants, detail: `line and circle at the two points: ${JSON.stringify(gaps)}; quadrants ${quadrantOf(x, y)}, ${quadrantOf(ox, oy)}` }
    })(),
    values: { m, c, N, x1: points[0][0], x2: points[1][0], coord, quadrant },
  }
}

// ---------------------------------------------------------------------------------------
// q12: the tangent condition from the discriminant. y = 3x + c tangent to x² + y² = 10, c < 0: −10.
// ---------------------------------------------------------------------------------------

/**
 * For y = mx + c to touch x² + y² = N the repeated root needs c² = N(1 + m²), so N(1 + m²) must
 * be a square: N up to 200 with |c| up to 40, 17 calculations (nine for m = 1, five for m = 2,
 * three for m = 3). N = 1 + m² itself is left out, where |c| would equal the printed N.
 */
export const TANGENT_CONDITIONS: { m: number; N: number; k: number }[] = []
for (const m of [1, 2, 3])
  for (let N = 2; N <= 200; N++) {
    const k = Math.sqrt(N * (1 + m * m))
    if (Number.isInteger(k) && N !== 1 + m * m && k <= 40) TANGENT_CONDITIONS.push({ m, N, k })
  }

const CONDITION_ASK = [
  (line: string, E: string, L: string, cond: string) => `The line $${line}$ is a tangent to the circle $${E}$, and $${L} ${cond}$. Work out the value of $${L}$.`,
  (line: string, E: string, L: string, cond: string) => `The straight line $${line}$, where $${L} ${cond}$, is a tangent to the circle $${E}$. Find the value of $${L}$.`,
  (line: string, E: string, L: string, cond: string) => `$${line}$ is a tangent to the circle $${E}$. Given that $${L} ${cond}$, work out the value of $${L}$.`,
]

function tangentCondition(r: Rng, slot: Question): Draft {
  // The three gradient sizes equally, as the written has m = 3; within a size, the smallest
  // circle N = 4(1 + m²) (8, 20, 40), where |c| is N/2 and a halving slip pays, at half weight.
  const size = pick(r, [1, 2, 3])
  const { N, k } = weighted(r, TANGENT_CONDITIONS.filter((t) => t.m === size), (t) => (t.N === 4 * (1 + t.m * t.m) ? 0.5 : 1))
  const m = pm(r) * size
  const negative = r() < 0.55
  const c = negative ? -k : k
  const L = r() < 0.65 ? 'c' : 'k'
  const A = 1 + m * m
  const B = 2 * m
  const cond = negative ? '< 0' : '> 0'
  const line = `y = ${sum([[m, 'x'], [1, L]])}`
  const E = circleTex(0, 0, N)
  const prompt = pick(r, CONDITION_ASK)(line, E, L, cond)
  const tx = (-m * c) / A
  const ty = m * tx + c
  const solution =
    `Substituting $${line}$ gives $x^2 + (${sum([[m, 'x'], [1, L]])})^2 = ${N}$, so $${sum([[A, 'x^2'], [B, `${L}x`], [1, `${L}^2`], [-N, '']])} = 0$. ` +
    `A tangent means a repeated root: $(${B}${L})^2 - 4(${A})(${L}^2 - ${N}) = ${4 * A * N} - 4${L}^2 = 0$, so $${L} = \\pm ${k}$. ` +
    `With $${L} ${cond}$, $${L} = ${c}$; the line touches at $${pt(tx, ty)}$.`
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, ['substitutes and forms a quadratic in x', 'sets the discriminant to zero'], `${L} = ${minus(c)}`),
      answer: c,
      tolerance: 0,
    },
    check: (() => {
      // Second route: the foot of the perpendicular from the centre to the printed line, with
      // the answer put in, lies on the printed circle and on the line, and the sign is as asked.
      const [lineTex, circle] = equationsIn(prompt) as [string, string]
      const rhs = lineTex.split('=')[1]!
      const grad = evalTex(rhs, { x: 1, [L]: 0 }) - evalTex(rhs, { x: 0, [L]: 0 })
      const fx = (-grad * c) / (1 + grad * grad)
      const fy = c / (1 + grad * grad)
      const onCircle = evalEquation(circle, { x: fx, y: fy })
      const onLine = evalEquation(lineTex, { x: fx, y: fy, [L]: c })
      return { agrees: near(onCircle, 0) && near(onLine, 0) && (negative ? c < 0 : c > 0), detail: `foot of the perpendicular (${fx}, ${fy}): circle ${onCircle}, line ${onLine}` }
    })(),
    values: { m, N, c, letter: L },
  }
}

// ---------------------------------------------------------------------------------------
// q14: the length of a tangent from a point. (8, 6) to x² + y² = 36: 8.
// ---------------------------------------------------------------------------------------

interface TangentLength {
  p: number
  q: number
  /** The tangent length. */
  t: number
  /** r², a square when the radius is whole. */
  N: number
}

/**
 * Whole radii: p² + q² = t² + r² with p, q, t, r all different and at least 3, so neither the
 * tangent nor the radius is a printed coordinate, never t = r (an isosceles slip pays), and r²
 * is not a coordinate either (9 from (7, 9) to x² + y² = 9). The written (8, 6) to
 * x² + y² = 36 is left out by the first rule: its answer 8 is printed.
 */
export const WHOLE_RADIUS: TangentLength[] = []
for (let p = 2; p <= 14; p++)
  for (let q = p + 1; q <= 14; q++) {
    const S = p * p + q * q
    if (S > 230) continue
    for (let t = 3; t <= 14; t++)
      for (let rad = 3; rad <= 14; rad++)
        if (t !== rad && t * t + rad * rad === S && ![p, q].includes(t) && ![p, q].includes(rad) && ![p, q].includes(rad * rad)) WHOLE_RADIUS.push({ p, q, t, N: rad * rad })
  }

/** r² not a square: the radius is never needed, only r². Coordinates from 2, as in the whole table. */
export const SURD_RADIUS: TangentLength[] = []
for (let p = 2; p <= 12; p++)
  for (let q = 2; q <= 12; q++) {
    if (p === q) continue
    const S = p * p + q * q
    if (S > 230) continue
    for (let t = 3; t <= 12; t++) {
      const N = S - t * t
      if (t === p || t === q || N < 5 || isSquare(N) || N === t || N === p || N === q) continue
      SURD_RADIUS.push({ p, q, t, N })
    }
  }

const LENGTH_ASK = [
  (P: string, E: string) => `A tangent is drawn from the point $${P}$ to the circle $${E}$. Work out the length of the tangent.`,
  (P: string, E: string) => `$P$ is the point $${P}$. A tangent from $P$ touches the circle $${E}$ at $T$. Work out the length $PT$.`,
  (P: string, E: string) => `From the point $P${P}$, a tangent is drawn to the circle $${E}$. Work out the length of the tangent from $P$ to the point where it touches the circle.`,
]

function tangentLength(r: Rng, slot: Question): Draft {
  const whole = r() < 0.4
  const base = pick(r, whole ? WHOLE_RADIUS : SURD_RADIUS)
  // Either order of the coordinates, in any quadrant.
  const [p0, q0] = whole && r() < 0.5 ? [base.q, base.p] : [base.p, base.q]
  const p = pm(r) * p0
  const q = pm(r) * q0
  const { t, N } = base
  const S = p * p + q * q
  const ask = int(r, 0, 2)
  const P = pt(p, q)
  const prompt = LENGTH_ASK[ask]!(P, circleTex(0, 0, N))
  const radius = whole ? `$${Math.sqrt(N)}$` : `$r$, where $r^2 = ${N}$,`
  const solution =
    `${ask === 0 ? 'Call the point $P$. ' : ''}The tangent meets the radius at $90°$, so the tangent, the radius ${radius} and $OP$ form a right-angled triangle with $OP$ as hypotenuse. ` +
    `$OP^2 = ${sub(p)}^2 + ${sub(q)}^2 = ${S}$, so the tangent length is $\\sqrt{${S} - ${N}} = \\sqrt{${t * t}} = ${t}$.`
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [`OP² = ${S}, or the right angle between tangent and radius`, `√(${S} − ${N})`], String(t)),
      answer: t,
      tolerance: 0,
    },
    check: touchingPoint(prompt, t),
    values: { kind: whole ? 'whole radius' : 'surd radius', p, q, N, S },
  }
}

/**
 * Second route: the point where a tangent from the printed P touches the printed circle,
 * T = (N·P + t·√N·P⊥)/|P|², built from the answer t: T is on the circle, PT is t long and OT
 * is at right angles to PT.
 */
function touchingPoint(prompt: string, t: number): Check {
  const [[p, q]] = pointsIn(prompt) as [[number, number]]
  const circle = equationsIn(prompt).find((e) => e.includes('x^2 + y^2'))!
  const N = evalTex(circle.split('=')[1]!)
  const S = p * p + q * q
  const tx = (N * p - t * Math.sqrt(N) * q) / S
  const ty = (N * q + t * Math.sqrt(N) * p) / S
  const on = evalEquation(circle, { x: tx, y: ty })
  const length = Math.hypot(p - tx, q - ty)
  const dot = tx * (p - tx) + ty * (q - ty)
  return { agrees: near(on, 0) && near(length, t) && near(dot, 0), detail: `touching point (${tx}, ${ty}): on the circle ${on}, PT ${length}, OT·PT ${dot}` }
}

// ---------------------------------------------------------------------------------------
// q15: the triangle a tangent makes with the axes. x² + y² = 25 at (3, 4): 625/24 = 26.04.
// ---------------------------------------------------------------------------------------

const AREA_ASK = [
  (E: string, P: string) => `The tangent to the circle $${E}$ at $${P}$ meets the $x$ axis at $A$ and the $y$ axis at $B$. Work out the area of triangle $OAB$. Give your answer to two decimal places.`,
  (E: string, P: string) => `$P${P}$ lies on the circle $${E}$. The tangent at $P$ crosses the $x$ axis at $A$ and the $y$ axis at $B$. Work out the area of triangle $OAB$, where $O$ is the origin. Give your answer to two decimal places.`,
]

function tangentTriangle(r: Rng, slot: Question): Draft {
  const { p, q, N, area } = draw(
    r,
    (r) => {
      // Coordinates from 2, so an intercept N/p is a real fraction and never N itself.
      const p = pm(r) * int(r, 2, 10)
      const q = pm(r) * int(r, 2, 10)
      const N = p * p + q * q
      return { p, q, N, area: (N * N) / (2 * Math.abs(p * q)) }
    },
    ({ p, q, N, area }) =>
      Math.abs(p) !== Math.abs(q) &&
      // The written (3, 4) on x² + y² = 25 is left out in every order and quadrant, so a retry
      // never hands back its 625/24; the rounding is real (not exact at 2 places) and clear of
      // a half; the area is not a printed figure and stays sensible.
      !(Math.abs(p) + Math.abs(q) === 7 && Math.abs(p * q) === 12) &&
      Math.abs(area * 100 - Math.round(area * 100)) > 1e-6 &&
      clearOfHalf(area, 2, 0.05) &&
      area <= 600 &&
      noneIs(roundTo(area, 2), [p, q, N]),
  )
  const answer = roundTo(area, 2)
  const E = circleTex(0, 0, N)
  const P = pt(p, q)
  const prompt = pick(r, AREA_ASK)(E, P)
  // px + qy = N, multiplied through by −1 when p is negative so the x coefficient is positive.
  const sgn = p < 0 ? -1 : 1
  const tangent = `${sum([[sgn * p, 'x'], [sgn * q, 'y']])} = ${sgn * N}`
  const xA = fracTex(N, p, '\\frac')
  const yB = fracTex(N, q, '\\frac')
  const lengths = p < 0 || q < 0 ? ' ($OA$ and $OB$ are lengths, so the signs are dropped.)' : ''
  const solution =
    `The radius to $${P}$ has gradient $${fracTex(q, p, '\\frac')}$, so the tangent has gradient $${fracTex(-p, q, '\\frac')}$ and, through $${P}$, its equation is $${tangent}$. ` +
    `At $y = 0$, $x = ${xA}$, so $A = \\left(${xA}, 0\\right)$; at $x = 0$, $y = ${yB}$, so $B = \\left(0, ${yB}\\right)$. ` +
    `The area is $\\frac{1}{2} \\times ${fracTex(N, Math.abs(p), '\\frac')} \\times ${fracTex(N, Math.abs(q), '\\frac')} = ${fracTex(N * N, 2 * Math.abs(p * q), '\\frac')} = ${fixed(area, 2)}$ to two decimal places.${lengths}`
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [minus(`tangent ${tangent}`), 'both intercepts'], `${fracText(N * N, 2 * Math.abs(p * q))} or ${fixed(area, 2)}`),
      answer,
      tolerance: 0.005,
    },
    check: (() => {
      // Second route: the tangent as the line through the printed point in the direction
      // (−q, p), its axis crossings by parameter, and the shoelace area of O, A and B; the
      // printed fraction, read back, must agree too.
      const [[px, py]] = pointsIn(prompt) as [[number, number]]
      const ax = px + (-py / px) * -py
      const by = py + (px / py) * px
      const shoelace = Math.abs(ax * by) / 2
      const printed = evalTex(/= (\\frac\{\d+\}\{\d+\}) = [\d.]+\$ to two/.exec(solution)![1]!)
      const onCircle = evalEquation(equationIn(prompt), { x: px, y: py })
      return { agrees: near(onCircle, 0) && roundTo(shoelace, 2) === answer && near(printed, shoelace), detail: `A = (${ax}, 0), B = (0, ${by}), shoelace ${shoelace}, printed ${printed}` }
    })(),
    values: { p, q, N, area },
  }
}

export const circleGenerators: Generator[] = [
  fmBySlot('fm-circle-equation', TOPIC, { q1: radiusFromEquation, q4: centreFromSigns, q9: radiusFromDiameter }),
  fmBySlot('fm-circle-tangent', TOPIC, { q7: tangentGradient, q10: lineMeetsCircle, q12: tangentCondition, q14: tangentLength, q15: tangentTriangle }),
]
