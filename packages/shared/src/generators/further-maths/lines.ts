import type { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Check, Draft, Generator } from '../types.ts'
import { evalTex, fracTex, fracText, gcd, near, reduce, sub, sum } from '../maths/formulae.ts'
import { lineTex, yOn } from '../maths/lines.ts'
import { fmBySlot, minus } from './build.ts'

/**
 * Further Maths (AQA 8365), gradients-distance-and-points-on-a-line. Non-calculator
 * throughout: whole coordinates, Pythagorean distances, decimals that terminate.
 *
 * 3.1  The gradient through two points, going down.
 * 3.2  The perpendicular gradient, the negative reciprocal, as a decimal; the specification's
 *      right-angled triangle A(0, 2), B(4, 6), C(10, 0), its area from the two perpendicular
 *      sides.
 * 3.3  The distance between two points by Pythagoras.
 * 3.5  ax + by = c rearranged to y = mx + c, the intercept read off.
 */

const TOPIC = 'gradients-distance-and-points-on-a-line'

const pm = (r: Rng) => (r() < 0.5 ? -1 : 1)
const pt = (x: number, y: number) => `(${x}, ${y})`

/** Every (x, y) printed in a text, in order: (2, 7), (-1, 4). */
export const pointsIn = (text: string) => [...text.matchAll(/\((-?\d+), (-?\d+)\)/g)].map((m) => [Number(m[1]), Number(m[2])] as [number, number])

/** Distinct sizes among the coordinates, and none of them the answer's size. */
const clean = (answer: number, coords: number[], distinct: number) =>
  !coords.some((v) => Math.abs(v) === Math.abs(answer)) && new Set(coords.map(Math.abs)).size >= distinct

// ---------------------------------------------------------------------------------------
// q1: a negative gradient through two points. (2, 7) and (6, -1): -2.
// ---------------------------------------------------------------------------------------

/**
 * Gradients going down, drawn first: whole from −2 to −7 four times in five, otherwise a decimal
 * asked for, mostly a half (−0.5, −1.5, −2.5) and now and then a quarter or a fifth. Never −1,
 * which run over rise also gives.
 */
const WHOLE = [-2, -3, -4, -5, -6, -7]
const HALVES: [number, number][] = [[-1, 2], [-3, 2], [-5, 2]]
const FRACTIONS: [number, number][] = [[-1, 4], [-3, 4], [-5, 4], [-2, 5], [-3, 5], [-4, 5]]

function negativeGradient(r: Rng, slot: Question): Draft {
  const whole = r() < 0.8
  const [p, q] = whole ? [pick(r, WHOLE), 1] : pick(r, r() < 0.7 ? HALVES : FRACTIONS)
  const m = p / q
  const { x1, y1, x2, y2 } = draw(
    r,
    (r) => {
      const run = q * (q === 1 ? int(r, 1, 5) : q === 2 ? int(r, 1, 3) : int(r, 1, 2))
      const x1 = int(r, -4, 8)
      const y1 = int(r, -5, 12)
      // The right-hand point first about a third of the time.
      const flip = r() < 0.3
      const [ax, ay, bx, by] = [x1, y1, x1 + run, y1 + (p * run) / q]
      return flip ? { x1: bx, y1: by, x2: ax, y2: ay } : { x1: ax, y1: ay, x2: bx, y2: by }
    },
    ({ x1, y1, x2, y2 }) =>
      Math.abs(x2) <= 12 && Math.abs(y2) <= 15 && Math.abs(y1) <= 15 && clean(m, [x1, y1, x2, y2], 4) &&
      // Adding where subtracting is due never lands on it.
      x1 + x2 !== 0 && (y1 + y2) / (x1 + x2) !== m,
  )
  const dy = y2 - y1
  const dx = x2 - x1
  const [rp, rq] = reduce(dy, dx)
  const named = r() < 0.3
  const prompt =
    (named
      ? `Find the gradient of the line joining $A${pt(x1, y1)}$ and $B${pt(x2, y2)}$.`
      : `Work out the gradient of the line through $${pt(x1, y1)}$ and $${pt(x2, y2)}$.`) + (whole ? '' : ' Give your answer as a decimal.')
  // −3/4 already in lowest terms goes straight to its decimal.
  const value = rq === 1 ? `${rp}` : rp === dy && rq === dx ? show(m) : `${fracTex(rp, rq, '\\dfrac')} = ${show(m)}`
  const solution = `$m = \\dfrac{${y2} - ${sub(y1)}}{${x2} - ${sub(x1)}} = \\dfrac{${dy}}{${dx}} = ${value}$: down $${-rp}$ for every $${rq}$ along. Subtract in the same order on the top and the bottom.`
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [], whole ? minus(m) : `${minus(show(m))} or ${minus(fracText(p, q))}`),
      answer: m,
      tolerance: 0,
    },
    check: (() => {
      // Second route: from the first printed point, m along the run reaches the second.
      const [[a, b], [c, d]] = pointsIn(prompt) as [[number, number], [number, number]]
      return { agrees: near(b + m * (c - a), d), detail: `${pt(a, b)} plus ${c - a} along at gradient ${m}: ${b + m * (c - a)}, the second point's y is ${d}` }
    })(),
    values: { p, q, x1, y1, x2, y2 },
  }
}

// ---------------------------------------------------------------------------------------
// q3: a distance by Pythagoras. (1, 5) and (7, 13): 10.
// ---------------------------------------------------------------------------------------

/**
 * Pythagorean triples whose distance is a square root known by heart, at most √625: seven
 * distances. 20-21-29, 10-24-26 and 18-24-30 are left out, their legs and roots too big by hand
 * and their points too far apart for coordinates within ±15.
 */
export const TRIPLES: [number, number, number][] = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17], [12, 16, 20], [7, 24, 25]]
/** The largest size of a printed coordinate. */
export const COORD = 15

function distance(r: Rng, slot: Question): Draft {
  const [a, b, d] = pick(r, TRIPLES)
  const [lx, ly] = r() < 0.5 ? [a, b] : [b, a]
  const { x1, y1, x2, y2 } = draw(
    r,
    (r) => {
      // The direction first, then the base point from the range that keeps both ends within ±15.
      const sx = pm(r)
      const sy = pm(r)
      const x1 = sx > 0 ? int(r, -COORD, COORD - lx) : int(r, -COORD + lx, COORD)
      const y1 = sy > 0 ? int(r, -COORD, COORD - ly) : int(r, -COORD + ly, COORD)
      return { x1, y1, x2: x1 + sx * lx, y2: y1 + sy * ly }
    },
    ({ x1, y1, x2, y2 }) => clean(d, [x1, y1, x2, y2], 3),
  )
  const dx = x2 - x1
  const dy = y2 - y1
  const prompt = pick(r, [
    `Work out the distance between $${pt(x1, y1)}$ and $${pt(x2, y2)}$.`,
    `$A$ is the point $${pt(x1, y1)}$ and $B$ is the point $${pt(x2, y2)}$. Work out the length of $AB$.`,
  ])
  const solution =
    `$d = \\sqrt{(${x2} - ${sub(x1)})^2 + (${y2} - ${sub(y1)})^2} = \\sqrt{${sub(dx)}^2 + ${sub(dy)}^2} = \\sqrt{${dx * dx} + ${dy * dy}} = \\sqrt{${d * d}} = ${d}$.`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], String(d)), answer: d, tolerance: 0 },
    check: (() => {
      const [[p1, q1], [p2, q2]] = pointsIn(prompt) as [[number, number], [number, number]]
      const h = Math.hypot(p2 - p1, q2 - q1)
      return { agrees: h === d, detail: `hypot of the printed points' differences: ${h}` }
    })(),
    values: { x1, y1, x2, y2, d },
  }
}

// ---------------------------------------------------------------------------------------
// q5: a perpendicular gradient as a decimal. 2/3: -1.5.
// ---------------------------------------------------------------------------------------

/** Given gradients s·p/q whose negative reciprocal −s·q/p terminates and is not whole. */
export const PERPENDICULAR: [number, number][] = [2, 4, 5, 8, 10].flatMap((p) =>
  [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((q) => gcd(p, q) === 1).map((q) => [p, q] as [number, number]),
)

const ASK = [
  (m: string) => `A line has gradient $${m}$. Work out the gradient of a line perpendicular to it.`,
  (m: string) => `Line $L$ has gradient $${m}$. Line $M$ is perpendicular to $L$. Work out the gradient of $M$.`,
  (m: string) => `Two lines are perpendicular. One has gradient $${m}$. Work out the gradient of the other.`,
]

function perpendicularGradient(r: Rng, slot: Question): Draft {
  // A fraction most of the time, as written; a whole gradient (4 → −0.25) one time in five.
  const wholeGiven = r() < 0.2
  const pool = PERPENDICULAR.filter(([, q]) => (q === 1) === wholeGiven)
  const [p, q] = pick(r, pool)
  const s = r() < 0.65 ? 1 : -1
  const given = q === 1 ? String(s * p) : fracTex(s * p, q, '\\dfrac')
  const out = fracTex(-s * q, p, '\\frac')
  const answer = (-s * q) / p
  const bracket = (t: string) => (t.startsWith('-') ? `\\left(${t}\\right)` : t)
  const prompt = `${pick(r, ASK)(given)} Give your answer as a decimal.`
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `The negative reciprocal of $${given.replace('\\dfrac', '\\frac')}$ is $${out} = ${show(answer)}$. Check: $${given.replace('\\dfrac', '\\frac')} \\times ${bracket(out)} = -1$.`,
      markScheme: scheme(slot, [], `${minus(show(answer))} or ${minus(fracText(-s * q, p))}`),
      answer,
      tolerance: 0,
    },
    check: (() => {
      const read = evalTex(/has gradient \$([^$]+)\$/.exec(prompt)![1]!)
      return { agrees: near(read * answer, -1), detail: `printed gradient ${read} times the answer: ${read * answer}` }
    })(),
    values: { p, q, s },
  }
}

// ---------------------------------------------------------------------------------------
// q8: ax + by = c in the form y = mx + c, the value of c. 3x + 2y = 12: 6.
// ---------------------------------------------------------------------------------------

/**
 * The intercept k drawn first, then ax + by = bk (or with the terms the other way round, or as
 * ax + by − bk = 0). b is never ±1, so the right-hand side is never c itself; |a| ≠ |b|, so
 * the x-intercept is never ±c; the gradient −a/b is never ±c, and no printed number is.
 */
function interceptFromGeneralForm(r: Rng, slot: Question): Draft {
  const form = pick(r, ['ax+by=c', 'ax+by=c', 'by+ax=c', 'ax+by+d=0'] as const)
  const { k, a, b } = draw(
    r,
    (r) => ({ k: pm(r) * int(r, 1, 12), a: (r() < 0.7 ? 1 : -1) * int(r, 2, 9), b: (r() < 0.7 ? 1 : -1) * int(r, 2, 6) }),
    ({ k, a, b }) => Math.abs(a) !== Math.abs(b) && Math.abs(b * k) <= 60 && Math.abs(a / b) !== Math.abs(k) && ![a, b, b * k].some((v) => Math.abs(v) === Math.abs(k)),
  )
  const R = b * k
  const lhs = form === 'by+ax=c' ? sum([[b, 'y'], [a, 'x']]) : sum([[a, 'x'], [b, 'y']])
  const equation = form === 'ax+by+d=0' ? `${sum([[a, 'x'], [b, 'y'], [-R, '']])} = 0` : `${lhs} = ${R}`
  const moved = `${b}y = ${sum([[-a, 'x'], [R, '']])}`
  const line = lineTex(-a, b, k)
  const [mp, mq] = reduce(-a, b)
  const prompt = `Write $${equation}$ in the form $y = mx + c$. Give the value of $c$.`
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `$${moved}$, so $${line}$: gradient $${fracTex(mp, mq)}$ and $y$-intercept $c = ${k}$.`,
      markScheme: scheme(slot, [], minus(k)),
      answer: k,
      tolerance: 0,
    },
    check: (() => {
      // Second route: y where the printed equation meets x = 0.
      const y = yOn([...prompt.matchAll(/\$([^$]+)\$/g)][0]![1]!, 0)
      return { agrees: near(y, k), detail: `the printed equation at x = 0 gives y = ${y}` }
    })(),
    values: { form, a, b, k },
  }
}

// ---------------------------------------------------------------------------------------
// q16: the area of a right-angled triangle from its vertices. A(0, 2), B(4, 6), C(10, 0): 24.
// ---------------------------------------------------------------------------------------

interface Right {
  /** The direction of one perpendicular side, coprime and both non-zero. */
  p: number
  q: number
  /** How many steps of it each side takes. */
  s: number
  t: number
}

/**
 * Directions (p, q) and step counts with whole areas ½·s·t·(p² + q²) by hand: legs up to 6√2,
 * 4√5, 3√10, 3√13. Thirteen areas from 4 to 39.
 */
export const RIGHTS: Right[] = [[1, 1], [1, 2], [2, 1], [1, 3], [3, 1], [2, 3], [3, 2]].flatMap(([p, q]) => {
  const n = p! * p! + q! * q!
  const most = n === 2 ? 6 : n === 5 ? 4 : 3
  const out: Right[] = []
  for (let s = 1; s <= most; s++) for (let t = 1; t <= most; t++) if (s !== t && (s * t * n) % 2 === 0 && (s * t * n) / 2 >= 4) out.push({ p: p!, q: q!, s, t })
  return out
})

/** One calculation: n and the unordered pair of step counts, 2:{4,6}. */
export const calcKey = ({ p, q, s, t }: Right) => `${p * p + q * q}:{${Math.min(s, t)},${Math.max(s, t)}}`

/** √(k²n) as k√n, n square-free here. */
const surd = (k: number, n: number) => (k === 1 ? `\\sqrt{${n}}` : `${k}\\sqrt{${n}}`)
const surdText = (k: number, n: number) => (k === 1 ? `√${n}` : `${k}√${n}`)

function rightTriangleArea(r: Rng, slot: Question): Draft {
  // Each n = p² + q² weighted by the square root of how many calculations it has, a calculation
  // being n and the pair {s, t}: mirror directions and the order of s and t count once. Within
  // n, each calculation is equally likely.
  const groups = [2, 5, 10, 13].map((n) => {
    const all = RIGHTS.filter((x) => x.p * x.p + x.q * x.q === n)
    return [...new Set(all.map(calcKey))].map((key) => all.filter((x) => calcKey(x) === key))
  })
  const weights = groups.map((g) => Math.sqrt(g.length))
  let left = r() * weights.reduce((a, b) => a + b, 0)
  const group = groups.find((_, i) => (left -= weights[i]!) < 0) ?? groups[0]!
  const { p, q, s, t } = pick(r, pick(r, group))
  const n = p * p + q * q
  const area = (s * t * n) / 2
  const at = pick(r, ['A', 'B', 'B', 'C'] as const)
  const verts = draw(
    r,
    (r) => {
      // Rotate the pair of directions a quarter turn at a time, and pick which side comes first.
      const turn = int(r, 0, 3)
      const rot = ([x, y]: [number, number]): [number, number] => [[x, y], [-y, x], [-x, -y], [y, -x]][turn] as [number, number]
      const u = rot([p, q])
      const v = rot([-q, p])
      const R: [number, number] = [int(r, -2, 10), int(r, -2, 10)]
      const P: [number, number] = [R[0] + s * u[0], R[1] + s * u[1]]
      const Q: [number, number] = [R[0] + t * v[0], R[1] + t * v[1]]
      const others = r() < 0.5 ? [P, Q] : [Q, P]
      return at === 'A' ? [R, others[0]!, others[1]!] : at === 'B' ? [others[0]!, R, others[1]!] : [others[0]!, others[1]!, R]
    },
    (vs) => vs.flat().every((c) => c >= -4 && c <= 14) && clean(area, vs.flat(), 3),
  )
  const names = ['A', 'B', 'C'] as const
  const ri = names.indexOf(at)
  const [oi, oj] = [0, 1, 2].filter((i) => i !== ri) as [number, number]
  const R = verts[ri]!
  const P = verts[oi]!
  const Q = verts[oj]!
  // Each side named in alphabetical order, as written (AB, BC), and its gradient worked in that order.
  const name = (i: number) => [names[ri], names[i]].sort().join('')
  const sideP = name(oi)
  const sideQ = name(oj)
  const ordered = (i: number): [[number, number], [number, number]] => (i < ri ? [verts[i]!, R] : [R, verts[i]!])
  // Which step count belongs to which side follows the drawn vertices.
  const legP = Math.round(Math.hypot(P[0] - R[0], P[1] - R[1]) / Math.sqrt(n))
  const legQ = Math.round(Math.hypot(Q[0] - R[0], Q[1] - R[1]) / Math.sqrt(n))
  const grad = (A: [number, number], B: [number, number]) => `\\dfrac{${B[1]} - ${sub(A[1])}}{${B[0]} - ${sub(A[0])}} = ${fracTex(B[1] - A[1], B[0] - A[0])}`
  const sq = (A: [number, number], B: [number, number]) => `\\sqrt{${sub(B[0] - A[0])}^2 + ${sub(B[1] - A[1])}^2}`
  /** √(dx² + dy²) = √(k²n) = k√n, the middle step left out when k is 1. */
  const length = ([A, B]: [[number, number], [number, number]], k: number) => `${sq(A, B)} = \\sqrt{${k * k * n}}${k === 1 ? '' : ` = ${surd(k, n)}`}`
  const prompt = `Work out the area of the triangle with vertices $A${pt(...verts[0]!)}$, $B${pt(...verts[1]!)}$ and $C${pt(...verts[2]!)}$.`
  const solution =
    `The gradient of $${sideP}$ is $${grad(...ordered(oi))}$ and of $${sideQ}$ is $${grad(...ordered(oj))}$; they multiply to $-1$, so the triangle is right-angled at $${at}$. ` +
    `$${sideP} = ${length(ordered(oi), legP)}$ and $${sideQ} = ${length(ordered(oj), legQ)}$. ` +
    `The area is $\\frac{1}{2} \\times ${sideP} \\times ${sideQ} = \\frac{1}{2} \\times ${surd(legP, n)} \\times ${surd(legQ, n)} = \\frac{1}{2} \\times ${legP * legQ} \\times ${n} = ${area}$.`
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [`${sideP} = ${surdText(legP, n)} and ${sideQ} = ${surdText(legQ, n)}, the sides meeting at the right angle`], String(area)),
      answer: area,
      tolerance: 0,
    },
    check: shoelace(prompt, area),
    values: { at, p, q, s, t, n },
  }
}

/** Second route: the shoelace formula on the three printed vertices. */
function shoelace(prompt: string, area: number): Check {
  const [[x1, y1], [x2, y2], [x3, y3]] = pointsIn(prompt) as [[number, number], [number, number], [number, number]]
  const twice = Math.abs(x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2))
  return { agrees: twice === 2 * area, detail: `shoelace on the printed vertices: ${twice} / 2` }
}

export const lineGenerators: Generator[] = [
  fmBySlot('fm-gradient-and-distance', TOPIC, { q1: negativeGradient, q3: distance, q5: perpendicularGradient, q8: interceptFromGeneralForm }),
  fmBySlot('fm-right-angled-triangle-area', TOPIC, { q16: rightTriangleArea }),
]
