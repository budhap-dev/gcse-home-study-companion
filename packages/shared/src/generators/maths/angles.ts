import type { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'
import { bySlot } from './formulae.ts'

/* ------------------------------------------------------------------------------------------
 * Plane geometry for the second methods: every angle a generator states is measured again
 * from coordinates, with vectors, rather than worked out by the angle fact the question uses.
 * ---------------------------------------------------------------------------------------- */

export const RAD = Math.PI / 180
export type Pt = readonly [number, number]

/** The point at `deg` degrees anticlockwise from the positive x axis, `r` from `c`. */
export const polar = (deg: number, r = 1, c: Pt = [0, 0]): Pt => [c[0] + r * Math.cos(deg * RAD), c[1] + r * Math.sin(deg * RAD)]
export const dist = (p: Pt, q: Pt) => Math.hypot(p[0] - q[0], p[1] - q[1])
export const plus = (p: Pt, q: Pt): Pt => [p[0] + q[0], p[1] + q[1]]

/** Angle PQR in degrees, from the vectors QP and QR: never more than 180. */
export function angleAt(p: Pt, q: Pt, r: Pt): number {
  const ux = p[0] - q[0]
  const uy = p[1] - q[1]
  const vx = r[0] - q[0]
  const vy = r[1] - q[1]
  return Math.atan2(Math.abs(ux * vy - uy * vx), ux * vx + uy * vy) / RAD
}

/** Where the line through p along u meets the line through q along v, by Cramer's rule. */
export function meet(p: Pt, u: Pt, q: Pt, v: Pt): Pt {
  const det = v[0] * u[1] - u[0] * v[1]
  const rx = q[0] - p[0]
  const ry = q[1] - p[1]
  const t = (v[0] * ry - rx * v[1]) / det
  return [p[0] + t * u[0], p[1] + t * u[1]]
}

/** The apex of a triangle on base (0,0)–(base,0) with angles a and b at the two ends. */
export const apex = (a: number, b: number, base = 1): Pt => meet([0, 0], polar(a), [base, 0], polar(180 - b))

/** Whole-degree agreement, allowing only floating-point noise. */
export const sameAngle = (x: number, y: number) => Math.abs(x - y) < 1e-6

const deg = (x: number) => `$${x}°$`
/** px + q as the content prints it inside an angle: 5x - 20, x + 30, 4x. */
export function lin(p: number, q: number, v = 'x'): string {
  const head = p === 1 ? v : `${p}${v}`
  return q === 0 ? head : `${head} ${q < 0 ? '-' : '+'} ${Math.abs(q)}`
}
const minus = (s: string) => s.replace(/ - /g, ' − ')

/* ------------------------------------------------------------------------------------------
 * Properties of angles
 * ---------------------------------------------------------------------------------------- */

const ANGLES = 'properties-of-angles'
const ORDINAL = ['first', 'second', 'third', 'fourth']
const COUNT = ['', '', 'Two', 'Three', 'Four']

/** Angles on a straight line, written as q1: three angles (sometimes four), all but one given. */
function onALine(r: Rng, slot: Question, turn: number): Draft {
  const n = turn % 3 === 2 ? 4 : 3
  const given = draw(
    r,
    (r) => Array.from({ length: n - 1 }, () => int(r, 12, 110)),
    (g) => {
      const rest = 180 - g.reduce((s, x) => s + x, 0)
      return rest >= 8 && rest <= 140 && new Set([...g, rest]).size === n
    },
  )
  const answer = 180 - given.reduce((s, x) => s + x, 0)
  const list = given.length === 2 ? `${deg(given[0]!)} and ${deg(given[1]!)}` : `${given.slice(0, -1).map(deg).join(', ')} and ${deg(given.at(-1)!)}`
  // Second route: rays from one point at the running totals of the given angles; the gap
  // between the last of them and the far end of the line, measured with vectors.
  const heading = given.reduce((s, x) => s + x, 0)
  const measured = angleAt(polar(heading), [0, 0], polar(180))
  const which = ORDINAL[n - 1]!
  return {
    question: {
      type: 'numeric',
      prompt: `${COUNT[n]} angles lie on a straight line. ${COUNT[n - 1]} are ${list}. Work out the ${which}, in degrees.`,
      solution: `Angles on a straight line add to $180°$, so the ${which} is $180 - ${given.join(' - ')} = ${answer}$ degrees.`,
      markScheme: scheme(slot, [`180 − ${given.join(' − ')}`], String(answer)),
      answer,
      tolerance: 0,
      units: 'degrees',
    },
    check: { agrees: sameAngle(measured, answer), detail: `ray at ${heading}° to the line's end, by vectors: ${measured.toFixed(6)}°` },
    values: { given: given.join(','), answer },
  }
}

/** Two crossing lines, the angle next to a given one: written as q4. */
function crossingLines(r: Rng, slot: Question): Draft {
  const x = draw(r, (r) => int(r, 15, 165), (x) => x !== 90)
  const answer = 180 - x
  const lead = pick(r, [
    `Two straight lines cross. One of the four angles is ${deg(x)}.`,
    `Two straight lines cross, and one of the angles they make is ${deg(x)}.`,
    `Two straight roads cross. One of the four angles between them is ${deg(x)}.`,
  ])
  // Second route: the two lines as directions 0° and x° through one point; the angle between
  // the second line and the other half of the first, by vectors.
  const measured = angleAt(polar(x), [0, 0], polar(180))
  return {
    question: {
      type: 'numeric',
      prompt: `${lead} Work out the angle next to it, in degrees.`,
      solution: `The two angles sit together on a straight line, and angles on a straight line add to $180°$, so the other is $180 - ${x} = ${answer}$ degrees.`,
      markScheme: scheme(slot, [`180 − ${x}`], String(answer)),
      answer,
      tolerance: 0,
      units: 'degrees',
    },
    check: { agrees: sameAngle(measured, answer), detail: `lines at 0° and ${x}°, neighbouring angle by vectors ${measured.toFixed(6)}°` },
    values: { x, answer },
  }
}

/** The co-interior angle to a given one between parallel lines: written as q6. */
function coInterior(r: Rng, slot: Question): Draft {
  const x = draw(r, (r) => int(r, 15, 165), (x) => x !== 90)
  const answer = 180 - x
  const lead = pick(r, [
    'Two parallel lines are cut by a transversal.',
    'A transversal crosses two parallel lines.',
    'A straight path crosses two parallel fences.',
  ])
  // Second route: the parallels y = 0 and y = 1 and a transversal at x° through the origin.
  // The angle at the upper crossing, between the parallel and the transversal pointing back
  // down, on the same side, is measured with vectors.
  const lower: Pt = [0, 0]
  const upper = meet(lower, polar(x), [0, 1], [1, 0])
  const measured = angleAt(plus(upper, [1, 0]), upper, lower)
  return {
    question: {
      type: 'numeric',
      prompt: `${lead} One angle is ${deg(x)}. Work out the co-interior angle to it, in degrees.`,
      solution: `Co-interior angles trace a **C** and add to $180°$, so the other is $180 - ${x} = ${answer}$ degrees.`,
      markScheme: scheme(slot, [`180 − ${x}`], String(answer)),
      answer,
      tolerance: 0,
      units: 'degrees',
    },
    check: { agrees: sameAngle(measured, answer), detail: `transversal at ${x}°, angle at the upper parallel by vectors ${measured.toFixed(6)}°` },
    values: { x, answer },
  }
}

const TRIANGLES = ['ABC', 'PQR', 'XYZ', 'LMN', 'DEF']

/** The third angle of a triangle: written as q7. */
function thirdAngle(r: Rng, slot: Question): Draft {
  const { a, b } = draw(r, (r) => ({ a: int(r, 15, 120), b: int(r, 15, 120) }), ({ a, b }) => a !== b && 180 - a - b >= 10)
  const answer = 180 - a - b
  const t = pick(r, TRIANGLES)
  const prompt = r() < 0.5
    ? `A triangle has angles of ${deg(a)} and ${deg(b)}. Work out the third angle, in degrees.`
    : `In triangle $${t}$, angle $${t[0]}$ is ${deg(a)} and angle $${t[1]}$ is ${deg(b)}. Work out angle $${t[2]}$, in degrees.`
  const c = apex(a, b)
  const measured = angleAt([0, 0], c, [1, 0])
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `Angles in a triangle add to $180°$, so the third is $180 - ${a} - ${b} = ${answer}$ degrees.`,
      markScheme: scheme(slot, [`180 − ${a} − ${b}`], String(answer)),
      answer,
      tolerance: 0,
      units: 'degrees',
    },
    check: { agrees: sameAngle(measured, answer), detail: `triangle drawn from its base with ${a}° and ${b}°; apex angle by vectors ${measured.toFixed(6)}°` },
    values: { a, b, answer },
  }
}

/** Sides of regular polygons whose exterior angle is a whole number of degrees. */
export const WHOLE_EXTERIOR = [5, 6, 8, 9, 10, 12, 15, 18, 20, 24, 30, 36, 40, 45, 60, 72] as const
const NAMES: Record<number, string> = { 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon', 9: 'nonagon', 10: 'decagon', 12: 'dodecagon' }
const OBJECTS = ['A floor tile', 'A coaster', 'A badge', 'A window', 'A table top', 'A paving slab', 'A garden pond', 'A stained-glass panel', 'A picture frame', 'A gazebo floor']

/** "regular octagon" or "regular polygon with 15 sides". */
const regular = (n: number) => (NAMES[n] ? `regular ${NAMES[n]}` : `regular polygon with ${n} sides`)
const article = (s: string) => (/^[aeiou]/i.test(s) ? 'an' : 'a')

/** Each exterior angle of a regular polygon: written as q8. */
function exteriorAngle(r: Rng, slot: Question): Draft {
  const n = pick(r, WHOLE_EXTERIOR.filter((n) => n <= 40))
  const answer = 360 / n
  const shape = regular(n)
  const prompt = r() < 0.3
    ? `Work out the size of each exterior angle of ${article(shape)} ${shape}, in degrees.`
    : `${pick(r, OBJECTS)} is in the shape of ${article(shape)} ${shape}. Work out the size of each of its exterior angles, in degrees.`
  // Second route: the interior angle by (n - 2) × 180 ÷ n, then the straight line.
  const interior = ((n - 2) * 180) / n
  const named = NAMES[n] ? `${article(NAMES[n]!)} ${NAMES[n]} has $${n}$` : `this polygon has $${n}$`
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `Exterior angles always add to $360°$, and ${named}, so each is $\\dfrac{360}{${n}} = ${answer}$ degrees.`,
      markScheme: scheme(slot, [`360 ÷ ${n}`], String(answer)),
      answer,
      tolerance: 0,
      units: 'degrees',
    },
    check: { agrees: Number.isInteger(answer) && sameAngle(180 - interior, answer), detail: `interior (n − 2) × 180 ÷ n = ${show(interior)}, so exterior ${show(180 - interior)}` },
    values: { n, answer },
  }
}

/** The total of the interior angles of a polygon: written as q10 (a decagon, 2 marks). */
function interiorTotal(r: Rng, slot: Question): Draft {
  const n = int(r, 5, 30)
  const answer = (n - 2) * 180
  const what = NAMES[n] ? `${article(NAMES[n]!)} ${NAMES[n]}, which has ${n} sides` : `a polygon with ${n} sides`
  const prompt = r() < 0.4
    ? `Work out the total of the interior angles of ${what}. Give your answer in degrees.`
    : `${pick(r, OBJECTS)} is in the shape of ${what}. Work out the sum of its interior angles, in degrees.`
  // Second route: a straight line at each vertex is 180° for every interior and exterior pair,
  // and the exterior angles take 360° of that.
  const other = n * 180 - 360
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `The interior angles of an $n$-sided polygon total $(n - 2) \\times 180°$, so for $n = ${n}$ that is $${n - 2} \\times 180 = ${answer}$ degrees.`,
      markScheme: scheme(slot, [`(${n} − 2) × 180`], String(answer)),
      answer,
      tolerance: 0,
      units: 'degrees',
    },
    check: { agrees: other === answer, detail: `${n} straight lines of 180° less 360° of exterior angles: ${other}` },
    values: { n, answer },
  }
}

/** The number of sides from an exterior or interior angle: written as q11 (8-9, 2 marks). */
function numberOfSides(r: Rng, slot: Question, turn: number): Draft {
  const n = pick(r, WHOLE_EXTERIOR)
  const e = 360 / n
  const i = 180 - e
  const fromInterior = turn % 2 === 1
  const obj = r() < 0.4 ? 'A regular polygon' : `${pick(r, OBJECTS)} in the shape of a regular polygon`
  const prompt = fromInterior
    ? `${obj} has interior angles of ${deg(i)} each. How many sides does it have?`
    : `${obj} has an exterior angle of ${deg(e)}. How many sides does it have?`
  const solution = fromInterior
    ? `An interior angle and its exterior angle lie on a straight line, so each exterior angle is $180 - ${i} = ${e}°$. Exterior angles total $360°$, so the number of sides is $\\dfrac{360}{${e}} = ${n}$.`
    : `Exterior angles total $360°$, so the number of sides is $\\dfrac{360}{${e}} = ${n}$.`
  // Second route: the interior angle of a regular n-gon by (n - 2) × 180 ÷ n.
  const interior = ((n - 2) * 180) / n
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [fromInterior ? `180 − ${i} = ${e}, then 360 ÷ ${e}` : `360 ÷ ${e}`], String(n)),
      answer: n,
      tolerance: 0,
    },
    check: { agrees: Number.isInteger(n) && n >= 3 && sameAngle(interior, i), detail: `(n − 2) × 180 ÷ n for n = ${n}: ${show(interior)}°, against ${i}°` },
    values: { n, exterior: e, interior: i, from: fromInterior ? 'interior' : 'exterior' },
  }
}

/** Each interior angle from the exterior angle: written as q12 (8-9, 1 mark). */
function interiorFromExterior(r: Rng, slot: Question): Draft {
  const n = pick(r, WHOLE_EXTERIOR)
  const e = 360 / n
  const answer = 180 - e
  const obj = r() < 0.4 ? 'a regular polygon' : `${pick(r, OBJECTS).toLowerCase()} in the shape of a regular polygon`
  const interior = ((n - 2) * 180) / n
  return {
    question: {
      type: 'numeric',
      prompt: `Work out the size of each interior angle of ${obj} whose exterior angle is ${deg(e)}. Give your answer in degrees.`,
      solution: `An interior angle and its exterior angle sit on a straight line, so they add to $180°$. The interior angle is $180 - ${e} = ${answer}$ degrees.`,
      markScheme: scheme(slot, [], String(answer)),
      answer,
      tolerance: 0,
      units: 'degrees',
    },
    check: { agrees: sameAngle(interior, answer), detail: `${n} sides from 360 ÷ ${e}; (n − 2) × 180 ÷ n = ${show(interior)}` },
    values: { n, exterior: e, answer },
  }
}

export const angleFacts = bySlot('angle-facts', ANGLES, { q1: onALine, q4: crossingLines, q6: coInterior, q7: thirdAngle })
export const polygonAngles = bySlot('polygon-angles', ANGLES, { q8: exteriorAngle, q10: interiorTotal, q11: numberOfSides, q12: interiorFromExterior })

/* ------------------------------------------------------------------------------------------
 * Properties of 2D shapes
 * ---------------------------------------------------------------------------------------- */

const SHAPES = 'properties-of-2d-shapes'
const QUADS = ['ABCD', 'PQRS', 'WXYZ', 'EFGH', 'KLMN', 'JKLM'] as const
/** The angle at each vertex of a quadrilateral, named by three letters: DAB, ABC, BCD, ADC. */
const cornerNames = (q: string) => [`${q[3]}${q[0]}${q[1]}`, `${q[0]}${q[1]}${q[2]}`, `${q[1]}${q[2]}${q[3]}`, `${q[0]}${q[3]}${q[2]}`]

/** Corners of a parallelogram with angle x at the first vertex. */
function parallelogram(x: number): Pt[] {
  const a: Pt = [0, 0]
  const b: Pt = [1.7, 0]
  const d = polar(x)
  return [a, b, plus(b, d), d]
}
const anglesOf = (pts: Pt[]) => pts.map((p, i) => angleAt(pts[(i + 3) % 4]!, p, pts[(i + 1) % 4]!))

/** An isosceles triangle, base angles to the third or the third to the base angles: written as q4. */
function isosceles(r: Rng, slot: Question, turn: number): Draft {
  const toApex = turn % 2 === 0
  const t = pick(r, TRIANGLES)
  const [A, B, C] = [t[0], t[1], t[2]]
  let base: number
  let top: number
  let prompt: string
  let solution: string
  let method: string
  let answer: number
  if (toApex) {
    base = draw(r, (r) => int(r, 20, 85), (b) => b !== 60)
    top = 180 - 2 * base
    answer = top
    prompt = r() < 0.5
      ? `An isosceles triangle has two equal base angles of ${deg(base)}. Work out the size of the third angle, in degrees.`
      : `In triangle $${t}$, $${A}${B} = ${A}${C}$ and angle $${A}${B}${C} = ${base}°$. Work out angle $${B}${A}${C}$, in degrees.`
    solution = `The two base angles are equal, so together they make $2 \\times ${base} = ${2 * base}°$. The angles of a triangle add to $180°$, so the third angle is $180 - ${2 * base} = ${top}°$.`
    method = `180 − 2 × ${base}`
  } else {
    top = draw(r, (r) => 2 * int(r, 5, 70), (a) => a !== 60)
    base = (180 - top) / 2
    answer = base
    prompt = r() < 0.5
      ? `An isosceles triangle has an angle of ${deg(top)} between its two equal sides. Work out the size of each of its other two angles, in degrees.`
      : `In triangle $${t}$, $${A}${B} = ${A}${C}$ and angle $${B}${A}${C} = ${top}°$. Work out angle $${A}${B}${C}$, in degrees.`
    solution = `The other two angles are the equal base angles. They share $180 - ${top} = ${180 - top}°$, so each is $${180 - top} \\div 2 = ${base}°$.`
    method = `(180 − ${top}) ÷ 2`
  }
  // Second route: draw the triangle from its base with both base angles, and measure the
  // angle at the apex with vectors.
  const p = apex(base, base)
  const measured = angleAt([0, 0], p, [1, 0])
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [method], String(answer)), answer, tolerance: 0, units: 'degrees' },
    check: { agrees: sameAngle(measured, top) && base > 0 && top > 0, detail: `base angles ${base}° drawn, apex measured ${measured.toFixed(6)}°` },
    values: { base, top, answer, find: toApex ? 'top' : 'base' },
  }
}

/** The angle next to a given angle of a parallelogram: written as q8. */
function parallelogramNeighbour(r: Rng, slot: Question): Draft {
  const x = draw(r, (r) => int(r, 20, 160), (x) => x !== 90)
  const answer = 180 - x
  const q = pick(r, QUADS)
  const names = cornerNames(q)
  const at = int(r, 0, 3)
  const next = (at + (r() < 0.5 ? 1 : 3)) % 4
  const prompt = r() < 0.35
    ? `One angle of a parallelogram is ${deg(x)}. Work out the size of an angle next to it, in degrees.`
    : `$${q}$ is a parallelogram. Angle $${names[at]} = ${x}°$. Work out angle $${names[next]}$, in degrees.`
  const angles = anglesOf(parallelogram(x))
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `Neighbouring angles of a parallelogram add to $180°$ (co-interior angles between parallel sides), so the angle is $180 - ${x} = ${answer}°$.`,
      markScheme: scheme(slot, [`180 − ${x}`], String(answer)),
      answer,
      tolerance: 0,
      units: 'degrees',
    },
    check: { agrees: sameAngle(angles[1]!, answer) && sameAngle(angles[3]!, answer) && sameAngle(angles[2]!, x), detail: `parallelogram drawn with ${x}°: angles ${angles.map((a) => a.toFixed(4)).join(', ')}` },
    values: { x, answer },
  }
}

/** A kite with AB = AD and CB = CD, from its corners: A at the origin, C at (1, 0). */
function kite(a: number, c: number): Pt[] {
  const A: Pt = [0, 0]
  const C: Pt = [1, 0]
  const B = meet(A, polar(a / 2), C, polar(180 - c / 2))
  const D: Pt = [B[0], -B[1]]
  return [A, B, C, D]
}

/** A missing angle of a kite: written as q9 (2 marks). */
function kiteAngle(r: Rng, slot: Question, turn: number): Draft {
  const q = pick(r, QUADS)
  const [A, B, C, D] = [q[0], q[1], q[2], q[3]]
  const findSide = turn % 2 === 0
  const { a, c } = draw(
    r,
    (r) => ({ a: int(r, 40, 150), c: int(r, 30, 150) }),
    ({ a, c }) => a !== c && (a + c) % 2 === 0 && (360 - a - c) / 2 > 15 && (360 - a - c) / 2 < 165 && (360 - a - c) / 2 !== 90,
  )
  const b = (360 - a - c) / 2
  const lead = `$${q}$ is a kite with $${A}${B} = ${A}${D}$ and $${C}${B} = ${C}${D}$.`
  let prompt: string
  let solution: string
  let method: string
  let answer: number
  if (findSide) {
    answer = b
    prompt = `${lead} Angle $${B}${A}${D} = ${a}°$ and angle $${B}${C}${D} = ${c}°$. Work out angle $${A}${B}${C}$, in degrees.`
    solution = `In a kite the angles between the unequal sides are equal: here angles $${B}$ and $${D}$. The angles of a quadrilateral add to $360°$, so $${B}$ and $${D}$ share $360 - ${a} - ${c} = ${2 * b}°$, and angle $${A}${B}${C} = ${2 * b} \\div 2 = ${b}°$.`
    method = `360 − ${a} − ${c}, then halved`
  } else {
    answer = c
    prompt = `${lead} Angle $${B}${A}${D} = ${a}°$ and angle $${A}${B}${C} = ${b}°$. Work out angle $${B}${C}${D}$, in degrees.`
    solution = `In a kite the angles between the unequal sides are equal, so angle $${A}${D}${C}$ is also $${b}°$. The angles of a quadrilateral add to $360°$, so angle $${B}${C}${D} = 360 - ${a} - ${b} - ${b} = ${c}°$.`
    method = `360 − ${a} − 2 × ${b}`
  }
  const k = kite(a, c)
  const angles = anglesOf(k)
  const sides = [dist(k[0]!, k[1]!), dist(k[0]!, k[3]!), dist(k[2]!, k[1]!), dist(k[2]!, k[3]!)]
  const ok = sameAngle(angles[0]!, a) && sameAngle(angles[2]!, c) && sameAngle(angles[1]!, b) && sameAngle(angles[3]!, b) && Math.abs(sides[0]! - sides[1]!) < 1e-9 && Math.abs(sides[2]! - sides[3]!) < 1e-9
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [method], String(answer)), answer, tolerance: 0, units: 'degrees' },
    check: { agrees: ok, detail: `kite drawn from its axis: angles ${angles.map((x) => x.toFixed(4)).join(', ')}` },
    values: { a, b, c, answer, find: findSide ? 'side angle' : 'apex angle' },
  }
}

/** Rhombus corners with angle x at the first vertex and sides of 1. */
function rhombus(x: number): Pt[] {
  const a: Pt = [0, 0]
  const b: Pt = [1, 0]
  const d = polar(x)
  return [a, b, plus(b, d), d]
}

/** The angle between a side and a diagonal of a rhombus: written as q11 (2 marks). */
function rhombusDiagonal(r: Rng, slot: Question, turn: number): Draft {
  const q = pick(r, QUADS)
  const [A, B, C, D] = [q[0], q[1], q[2], q[3]]
  const x = draw(r, (r) => 2 * int(r, 10, 80), (x) => x !== 90)
  const answer = (180 - x) / 2
  // Either the angle at A with diagonal BD, or the angle at B with diagonal AC.
  const atA = turn % 2 === 0
  const [vx, given, diag, asked, other] = atA
    ? [A, `${B}${A}${D}`, `${B}${D}`, `${A}${B}${D}`, `${A}${D}${B}`]
    : [B, `${A}${B}${C}`, `${A}${C}`, `${B}${A}${C}`, `${B}${C}${A}`]
  const [s1, s2] = atA ? [`${A}${B}`, `${A}${D}`] : [`${B}${A}`, `${B}${C}`]
  // Second route: a rhombus of side 1 drawn with the given angle at its first corner, and
  // the angle between a side and the diagonal measured with vectors.
  const pts = rhombus(x)
  const measured = angleAt(pts[0]!, pts[1]!, pts[3]!)
  return {
    question: {
      type: 'numeric',
      prompt: `$${q}$ is a rhombus with angle $${given} = ${x}°$. The diagonal $${diag}$ is drawn. Work out angle $${asked}$, in degrees.`,
      solution: `$${s1} = ${s2}$, since all the sides of a rhombus are equal, so the triangle at $${vx}$ is isosceles with equal base angles $${asked}$ and $${other}$. They share $180 - ${x} = ${180 - x}°$, so angle $${asked} = ${answer}°$.`,
      markScheme: scheme(slot, [`(180 − ${x}) ÷ 2, using the isosceles triangle`], String(answer)),
      answer,
      tolerance: 0,
      units: 'degrees',
    },
    check: { agrees: sameAngle(measured, answer), detail: `rhombus drawn with ${x}°; side to diagonal by vectors ${measured.toFixed(6)}°` },
    values: { x, answer, at: atA ? 'A' : 'B' },
  }
}

/** px + q = angle for a whole x, with a printable constant. */
function expressionFor(r: Rng, angle: number, x: number, pLo: number, pHi: number, avoid?: number): [number, number] | undefined {
  for (let i = 0; i < 20; i++) {
    const p = int(r, pLo, pHi)
    if (p === avoid) continue
    const q = angle - p * x
    if (q !== 0 && Math.abs(q) <= 80) return [p, q]
  }
  return undefined
}

/** Opposite (or neighbouring) angles of a parallelogram as expressions in x: written as q15 (3 marks). */
function parallelogramAlgebra(r: Rng, slot: Question, turn: number): Draft {
  const opposite = turn % 2 === 0
  const v = pick(r, QUADS)
  const [P, Q, R, S] = [v[0], v[1], v[2], v[3]]
  const made = draw(
    r,
    (r) => {
      const x = int(r, 6, 40)
      const angle = int(r, 30, 150)
      const e1 = expressionFor(r, angle, x, 2, 7)
      const e2 = opposite ? expressionFor(r, angle, x, 1, 6, e1?.[0]) : expressionFor(r, 180 - angle, x, 1, 6)
      return { x, angle, e1, e2 }
    },
    ({ angle, e1, e2 }) => angle !== 90 && e1 !== undefined && e2 !== undefined && (!opposite || e1[0] !== e2[0]),
  )
  const { x, angle } = made
  const [p, q] = made.e1!
  const [s, t] = made.e2!
  let prompt: string
  let solution: string
  let lines: [string, string]
  let answer: number
  if (opposite) {
    answer = 180 - angle
    prompt = `$${v}$ is a parallelogram. Angle $${P} = (${lin(p, q)})°$ and the opposite angle $${R} = (${lin(s, t)})°$. Work out the size of angle $${Q}$, in degrees.`
    solution = `Opposite angles of a parallelogram are equal: $${lin(p, q)} = ${lin(s, t)}$, so $${p - s === 1 ? '' : p - s}x = ${t - q}$${p - s === 1 ? '' : ` and $x = ${x}$`}. Then angle $${P} = ${p} \\times ${x} ${q < 0 ? '-' : '+'} ${Math.abs(q)} = ${angle}°$. $${Q}$ is next to $${P}$, so angle $${Q} = 180 - ${angle} = ${answer}°$.`
    lines = [minus(`${lin(p, q)} = ${lin(s, t)}`), `x = ${x}, so ${P} = ${angle}`]
  } else {
    answer = angle
    prompt = `$${v}$ is a parallelogram. Angle $${P} = (${lin(p, q)})°$ and the neighbouring angle $${Q} = (${lin(s, t)})°$. Work out the size of angle $${R}$, in degrees.`
    solution = `Neighbouring angles of a parallelogram add to $180°$: $${lin(p, q)} + ${lin(s, t)} = 180$, so $${p + s}x ${q + t < 0 ? '-' : '+'} ${Math.abs(q + t)} = 180$ and $x = ${x}$. Then angle $${P} = ${p} \\times ${x} ${q < 0 ? '-' : '+'} ${Math.abs(q)} = ${angle}°$. $${R}$ is opposite $${P}$, so angle $${R} = ${answer}°$.`
    lines = [minus(`${lin(p, q)} + ${lin(s, t)} = 180`), `x = ${x}, so ${P} = ${angle}`]
  }
  // Second route: the expressions at x, and the asked angle measured on a parallelogram drawn
  // with angle P at its first corner (Q next to it, R opposite).
  const angles = anglesOf(parallelogram(angle))
  const e1 = p * x + q
  const e2 = s * x + t
  const exprOk = e1 === angle && (opposite ? e2 === angle : e2 === 180 - angle)
  const measured = opposite ? angles[1]! : angles[2]!
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: [
        { code: 'M1', marks: 1, description: lines[0] },
        { code: 'A1', marks: 1, description: lines[1] },
        { code: 'A1', marks: slot.marks - 2, description: `${opposite ? Q : R} = ${answer}` },
      ],
      answer,
      tolerance: 0,
      units: 'degrees',
    },
    check: { agrees: exprOk && sameAngle(measured, answer), detail: `at x = ${x}: ${e1}° and ${e2}°; drawn parallelogram gives ${measured.toFixed(6)}°` },
    values: { x, P: angle, answer, given: opposite ? 'opposite' : 'neighbouring', S },
  }
}

/** A kite's angles as expressions in x: written as q16 (3 marks). */
function kiteAlgebra(r: Rng, slot: Question): Draft {
  const v = pick(r, QUADS)
  const [A, B, C, D] = [v[0], v[1], v[2], v[3]]
  const made = draw(
    r,
    (r) => {
      const x = int(r, 8, 40)
      const b = int(r, 50, 125)
      const eb = expressionFor(r, b, x, 2, 6)
      const ed = expressionFor(r, b, x, 1, 7, eb?.[0])
      const k = int(r, 1, 6)
      const a = k * x + (r() < 0.5 ? 0 : int(r, -30, 30))
      return { x, b, eb, ed, k, a }
    },
    ({ b, eb, ed, a }) => {
      const c = 360 - 2 * b - a
      return eb !== undefined && ed !== undefined && eb[0] !== ed[0] && a >= 30 && a <= 150 && c >= 20 && c <= 160 && c !== a && b !== 90
    },
  )
  const { x, b, k, a } = made
  const [p, q] = made.eb!
  const [s, t] = made.ed!
  const at = a - k * x
  const c = 360 - 2 * b - a
  const aText = at === 0 ? `${k === 1 ? '' : k}x` : lin(k, at)
  const aWorked = at === 0 ? `${k} \\times ${x}` : `${k} \\times ${x} ${at < 0 ? '-' : '+'} ${Math.abs(at)}`
  // Second route: triangle ABC drawn from side AB with half the angle at A (the diagonal AC
  // is the kite's line of symmetry) and the angle at B; the angle at C, doubled.
  const tip = apex(a / 2, b)
  const half = angleAt([0, 0], tip, [1, 0])
  return {
    question: {
      type: 'numeric',
      prompt: `$${v}$ is a kite with $${A}${B} = ${A}${D}$ and $${C}${B} = ${C}${D}$. Angle $${A}${B}${C} = (${lin(p, q)})°$, angle $${A}${D}${C} = (${lin(s, t)})°$ and angle $${B}${A}${D} = ${at === 0 ? aText : `(${aText})`}°$. Work out the size of angle $${B}${C}${D}$, in degrees.`,
      solution: `The angles at $${B}$ and $${D}$ lie between the unequal sides, so they are equal: $${lin(p, q)} = ${lin(s, t)}$, giving $x = ${x}$. So $${B} = ${D} = ${b}°$ and angle $${B}${A}${D} = ${aWorked} = ${a}°$. The angles add to $360°$: angle $${B}${C}${D} = 360 - ${b} - ${b} - ${a} = ${c}°$.`,
      markScheme: scheme(slot, [minus(`${lin(p, q)} = ${lin(s, t)}`), `x = ${x}, and 360 minus the other three angles`], String(c)),
      answer: c,
      tolerance: 0,
      units: 'degrees',
    },
    check: { agrees: p * x + q === b && s * x + t === b && sameAngle(2 * half, c), detail: `B = D = ${b} at x = ${x}; triangle ABC drawn from ${a / 2}° and ${b}° gives ${half.toFixed(6)}° at C, doubled ${(2 * half).toFixed(6)}` },
    values: { x, a, b, c },
  }
}

/** Isosceles trapezium ABCD, AB parallel to DC, with angle DAB = a: A at the origin. */
function trapezium(a: number): Pt[] {
  const A: Pt = [0, 0]
  const B: Pt = [4, 0]
  const D = polar(a)
  const C: Pt = [B[0] - D[0], D[1]]
  return [A, B, C, D]
}

/** An isosceles trapezium's co-interior angles as expressions in x: written as q22 (3 marks). */
function trapeziumAlgebra(r: Rng, slot: Question, turn: number): Draft {
  const v = pick(r, QUADS)
  const [A, B, C, D] = [v[0], v[1], v[2], v[3]]
  const made = draw(
    r,
    (r) => {
      const x = int(r, 8, 45)
      const a = int(r, 40, 140)
      return { x, a, e1: expressionFor(r, a, x, 1, 5), e2: expressionFor(r, 180 - a, x, 1, 5) }
    },
    ({ a, e1, e2 }) => a !== 90 && e1 !== undefined && e2 !== undefined,
  )
  const { x, a } = made
  const [p, q] = made.e1!
  const [s, t] = made.e2!
  const d = 180 - a
  const askB = turn % 2 === 0
  const answer = askB ? a : d
  const asked = askB ? `${A}${B}${C}` : `${B}${C}${D}`
  const pair = askB ? `${D}${A}${B}` : `${A}${D}${C}`
  const k = q + t
  const solution = `$${D}${A}${B}$ and $${A}${D}${C}$ are co-interior angles between the parallel sides $${A}${B}$ and $${D}${C}$, so they add to $180°$: $${p + s}x ${k < 0 ? '-' : '+'} ${Math.abs(k)} = 180$, so $x = ${x}$, angle $${D}${A}${B} = ${a}°$ and angle $${A}${D}${C} = ${d}°$. In an isosceles trapezium the two angles on the same parallel side are equal, so angle $${asked}$ = angle $${pair} = ${answer}°$.`
  const pts = trapezium(a)
  const angles = anglesOf(pts)
  const legs = Math.abs(dist(pts[0]!, pts[3]!) - dist(pts[1]!, pts[2]!)) < 1e-9
  return {
    question: {
      type: 'numeric',
      prompt: `$${v}$ is an isosceles trapezium. $${A}${B}$ is parallel to $${D}${C}$ and $${A}${D} = ${B}${C}$. Angle $${D}${A}${B} = (${lin(p, q)})°$ and angle $${A}${D}${C} = (${lin(s, t)})°$. Work out the size of angle $${asked}$, in degrees.`,
      solution,
      markScheme: [
        { code: 'M1', marks: 1, description: minus(`${lin(p, q)} + ${lin(s, t)} = 180`) },
        { code: 'A1', marks: 1, description: `x = ${x}, angle ${D}${A}${B} = ${a}` },
        { code: 'A1', marks: slot.marks - 2, description: `angle ${asked} = ${answer}, by the symmetry of the isosceles trapezium` },
      ],
      answer,
      tolerance: 0,
      units: 'degrees',
    },
    check: {
      agrees: legs && p * x + q === a && s * x + t === d && sameAngle(askB ? angles[1]! : angles[2]!, answer),
      detail: `trapezium drawn with ${a}° at A: angles ${angles.map((x) => x.toFixed(4)).join(', ')}`,
    },
    values: { x, a, d, answer, asked: askB ? 'ABC' : 'BCD' },
  }
}

export const quadrilateralAngles = bySlot('quadrilateral-angles', SHAPES, { q4: isosceles, q8: parallelogramNeighbour, q9: kiteAngle, q11: rhombusDiagonal })
export const quadrilateralAlgebra = bySlot('quadrilateral-algebra', SHAPES, { q15: parallelogramAlgebra, q16: kiteAlgebra, q22: trapeziumAlgebra })

/* ------------------------------------------------------------------------------------------
 * Circle theorems. Every configuration is drawn on a unit circle centred at the origin and
 * the angle asked for is measured there with vectors.
 * ---------------------------------------------------------------------------------------- */

const CIRCLES = 'circle-theorems'
const O: Pt = [0, 0]

function circleDraft(slot: Question, prompt: string, solution: string, method: string[], answer: number, measured: number, detail: string, values: Draft['values']): Draft {
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, method, `${answer}°`), answer, tolerance: 0, units: '°' },
    check: { agrees: sameAngle(measured, answer) && answer > 0 && answer < 180, detail: `${detail}: ${measured.toFixed(6)}°` },
    values,
  }
}

/** Angle at the centre and at the circumference: written as q1. */
function centreAngle(r: Rng, slot: Question, turn: number): Draft {
  const c = 2 * int(r, 10, 85)
  const half = c / 2
  // A and B around the bottom of the circle, C anywhere on the major arc.
  const A = polar(270 - half)
  const B = polar(270 + half)
  const C = polar(90 + int(r, -40, 40))
  const toCircumference = turn % 2 === 0
  if (toCircumference) {
    return circleDraft(
      slot,
      `$A$, $B$ and $C$ are points on a circle with centre $O$. Angle $AOB = ${c}°$. Find angle $ACB$, where $C$ is on the major arc.`,
      `The angle at the centre is **twice** the angle at the circumference standing on the same arc, so angle $ACB = ${c} \\div 2 = ${half}°$.`,
      [`${c} ÷ 2`],
      half,
      angleAt(A, C, B),
      'angle ACB measured',
      { centre: c, answer: half, find: 'circumference' },
    )
  }
  return circleDraft(
    slot,
    `$A$, $B$ and $C$ are points on a circle with centre $O$, with $C$ on the major arc. Angle $ACB = ${half}°$. Find angle $AOB$.`,
    `The angle at the centre is **twice** the angle at the circumference standing on the same arc, so angle $AOB = 2 \\times ${half} = ${c}°$.`,
    [`2 × ${half}`],
    c,
    angleAt(A, O, B),
    'angle AOB measured',
    { centre: c, answer: c, find: 'centre' },
  )
}

/** The angle in a semicircle: written as q2 (2 marks). */
function semicircle(r: Rng, slot: Question, turn: number): Draft {
  const a = int(r, 10, 80)
  const b = 90 - a
  const A: Pt = [-1, 0]
  const B: Pt = [1, 0]
  // Angle CAB = a stands on arc CB, so the centre angle COB is 2a.
  const C = polar(2 * a)
  const fromA = turn % 2 === 0
  const [given, asked, g, ans, measured] = fromA ? ['CAB', 'ABC', a, b, angleAt(A, B, C)] : ['ABC', 'CAB', b, a, angleAt(C, A, B)]
  return circleDraft(
    slot,
    `$AB$ is a diameter of a circle and $C$ is a point on the circumference. Angle $${given} = ${g}°$. Find angle $${asked}$.`,
    `The angle in a semicircle is $90°$, so angle $ACB = 90°$. Angles in a triangle: $180 - 90 - ${g} = ${ans}°$.`,
    ['angle $ACB = 90°$'],
    ans,
    measured,
    `angle ${asked} measured`,
    { given: g, answer: ans },
  )
}

/** Opposite angles of a cyclic quadrilateral: written as q3. */
function cyclicQuadrilateral(r: Rng, slot: Question, turn: number): Draft {
  const x = draw(r, (r) => int(r, 20, 160), (x) => x !== 90)
  const answer = 180 - x
  const atB = turn % 2 === 0
  // The given angle stands on an arc whose centre angle is 2x: its two ends at 0° and 2x, the
  // fourth vertex inside that arc at x, and the given vertex on the other arc at x + 180.
  // Clockwise the order is then A, B, C, D, a cyclic quadrilateral either way.
  const ends = [polar(0), polar(2 * x)] as const
  const inside = polar(x)
  const vertex = polar(x + 180)
  const [given, asked] = atB ? ['ABC', 'ADC'] : ['BCD', 'DAB']
  const g = angleAt(ends[0], vertex, ends[1])
  const measured = angleAt(ends[0], inside, ends[1])
  return circleDraft(
    slot,
    `$ABCD$ is a cyclic quadrilateral. Angle $${given} = ${x}°$. Find angle $${asked}$.`,
    `Opposite angles of a cyclic quadrilateral add to $180°$: $180 - ${x} = ${answer}°$.`,
    [`180 − ${x}`],
    answer,
    sameAngle(g, x) ? measured : -1,
    `given angle drawn as ${g.toFixed(4)}°, angle ${asked} measured`,
    { given: x, answer, pair: `${given}+${asked}` },
  )
}

/** Two tangents from an outside point: written as q5 (angle at the centre) and q13 (angle OAB). */
function tangentKite(x: number) {
  // A and B at ±half of angle AOB; the tangents meet on the x axis at 1 / cos(half).
  const half = (180 - x) / 2
  const A = polar(half)
  const B = polar(-half)
  const P: Pt = [1 / Math.cos(half * RAD), 0]
  return { A, B, P }
}

function tangentsCentre(r: Rng, slot: Question, turn: number): Draft {
  const p = draw(r, (r) => int(r, 20, 160), (p) => p !== 90)
  const c = 180 - p
  const { A, B, P } = tangentKite(p)
  const toCentre = turn % 2 === 0
  if (toCentre) {
    return circleDraft(
      slot,
      `Two tangents from a point $P$ touch a circle with centre $O$ at $A$ and $B$. Angle $APB = ${p}°$. Find angle $AOB$.`,
      `The tangent meets each radius at $90°$, so $OAPB$ is a quadrilateral with two right angles. Its angles add to $360°$: $360 - 90 - 90 - ${p} = ${c}°$.`,
      ['two right angles at $A$ and $B$'],
      c,
      angleAt(A, O, B),
      'angle AOB measured',
      { APB: p, answer: c },
    )
  }
  return circleDraft(
    slot,
    `Two tangents from a point $P$ touch a circle with centre $O$ at $A$ and $B$. Angle $AOB = ${c}°$. Find angle $APB$.`,
    `The tangent meets each radius at $90°$, so $OAPB$ is a quadrilateral with two right angles. Its angles add to $360°$: $360 - 90 - 90 - ${c} = ${p}°$.`,
    ['two right angles at $A$ and $B$'],
    p,
    angleAt(A, P, B),
    'angle APB measured',
    { AOB: c, answer: p },
  )
}

/** Angles in the same segment: written as q7. */
function sameSegment(r: Rng, slot: Question, turn: number): Draft {
  const x = int(r, 15, 80)
  // A, B, C, D in order round the circle, so the chords AC and BD cross. The two angles stand
  // on the arc between two neighbouring points, U and V: those sit close together at the
  // bottom, and the other two points W and Z further round the major arc.
  const letters = 'ABCD'
  const k = int(r, 0, 3)
  const [U, V, W, Z] = [0, 1, 2, 3].map((i) => letters[(k + i) % 4]!)
  const span = 360 - 2 * x
  const u = polar(270 - x)
  const v = polar(270 + x)
  const w = polar(270 + x + span * 0.3)
  const z = polar(270 + x + span * 0.7)
  const atW = `${U}${W}${V}`
  const atZ = `${U}${Z}${V}`
  const flip = turn % 2 === 1
  const [given, asked] = flip ? [atZ, atW] : [atW, atZ]
  const g = flip ? angleAt(u, z, v) : angleAt(u, w, v)
  const measured = flip ? angleAt(u, w, v) : angleAt(u, z, v)
  return circleDraft(
    slot,
    `$A$, $B$, $C$ and $D$ are points on a circle, in that order. Chords $AC$ and $BD$ cross. Angle $${given} = ${x}°$. Find angle $${asked}$.`,
    `Angles $${given}$ and $${asked}$ both stand on the arc $${U}${V}$, so they are in the **same segment** and equal: $${x}°$.`,
    [],
    x,
    sameAngle(g, x) ? measured : -1,
    `given angle drawn as ${g.toFixed(4)}°, angle ${asked} measured`,
    { given: x, answer: x, pair: `${given}=${asked}` },
  )
}

/** The alternate segment theorem: written as q8. */
function alternateSegment(r: Rng, slot: Question, turn: number): Draft {
  const t = int(r, 20, 85)
  // Tangent along y = -1 at A = (0, -1); B is 2t round the circle, so the chord AB makes t with
  // the tangent; C is in the alternate segment, on the far arc.
  const A = polar(270)
  const B = polar(270 + 2 * t)
  const C = polar(270 + 2 * t + (360 - 2 * t) / 2)
  const tangent = angleAt(plus(A, [1, 0]), A, B)
  const inscribed = angleAt(A, C, B)
  const fromTangent = turn % 2 === 0
  if (fromTangent) {
    return circleDraft(
      slot,
      `A tangent touches a circle at $A$. $B$ and $C$ are points on the circle, and the angle between the tangent and the chord $AB$ is $${t}°$. Find angle $ACB$, where $C$ is in the alternate segment.`,
      `The **alternate segment theorem**: the angle between a tangent and a chord equals the angle in the alternate segment. So angle $ACB = ${t}°$.`,
      [],
      t,
      inscribed,
      `tangent-chord angle ${tangent.toFixed(4)}°, angle ACB measured`,
      { given: t, answer: t, from: 'tangent' },
    )
  }
  return circleDraft(
    slot,
    `A tangent touches a circle at $A$. $B$ and $C$ are points on the circle, with $C$ in the alternate segment, and angle $ACB = ${t}°$. Find the angle between the tangent and the chord $AB$.`,
    `The **alternate segment theorem**: the angle between a tangent and a chord equals the angle in the alternate segment. So the angle is $${t}°$.`,
    [],
    t,
    tangent,
    `angle ACB ${inscribed.toFixed(4)}°, tangent-chord angle measured`,
    { given: t, answer: t, from: 'inscribed' },
  )
}

/** Two radii make an isosceles triangle: written as q9 (2 marks). */
function radiiIsosceles(r: Rng, slot: Question, turn: number): Draft {
  const base = int(r, 10, 80)
  const centre = 180 - 2 * base
  const A = polar(90 + centre / 2)
  const B = polar(90 - centre / 2)
  const toCentre = turn % 2 === 0
  if (toCentre) {
    return circleDraft(
      slot,
      `$O$ is the centre of a circle and $A$ and $B$ are on the circumference. Angle $OAB = ${base}°$. Find angle $AOB$.`,
      `$OA$ and $OB$ are both radii, so triangle $OAB$ is **isosceles** and angle $OBA = ${base}°$ too. Then angle $AOB = 180 - ${base} - ${base} = ${centre}°$.`,
      [`angle $OBA = ${base}°$, isosceles`],
      centre,
      angleAt(A, O, B),
      'angle AOB measured',
      { OAB: base, answer: centre },
    )
  }
  return circleDraft(
    slot,
    `$O$ is the centre of a circle and $A$ and $B$ are on the circumference. Angle $AOB = ${centre}°$. Find angle $OAB$.`,
    `$OA$ and $OB$ are both radii, so triangle $OAB$ is **isosceles** and angles $OAB$ and $OBA$ are equal. They share $180 - ${centre} = ${180 - centre}°$, so angle $OAB = ${base}°$.`,
    ['$OA = OB$, isosceles, so the base angles are equal'],
    base,
    angleAt(O, A, B),
    'angle OAB measured',
    { AOB: centre, answer: base },
  )
}

/** Tangents from P, then the isosceles triangle OAB: written as q13 (3 marks). */
function tangentsChord(r: Rng, slot: Question, turn: number): Draft {
  const p = draw(r, (r) => 2 * int(r, 10, 80), (p) => p !== 90)
  const oab = p / 2
  const centre = 180 - p
  const pab = (180 - p) / 2
  const { A, B, P } = tangentKite(p)
  const toOAB = turn % 2 === 0
  if (toOAB) {
    return circleDraft(
      slot,
      `Two tangents from $P$ touch a circle with centre $O$ at $A$ and $B$. Angle $APB = ${p}°$. Find angle $OAB$.`,
      `Angle $AOB = 360 - 90 - 90 - ${p} = ${centre}°$ (two right angles between tangent and radius). Triangle $OAB$ is isosceles (radii), so angle $OAB = (180 - ${centre}) \\div 2 = ${oab}°$. Alternatively: $PA = PB$ (equal tangents), so angle $PAB = ${pab}°$, and $OAB = 90 - ${pab} = ${oab}°$.`,
      [`angle $AOB = ${centre}°$, or angle $PAB = ${pab}°$ from equal tangents`, `isosceles triangle $OAB$, or $90 - ${pab}$`],
      oab,
      angleAt(O, A, B),
      'angle OAB measured',
      { APB: p, answer: oab },
    )
  }
  return circleDraft(
    slot,
    `Two tangents from $P$ touch a circle with centre $O$ at $A$ and $B$. Angle $OAB = ${oab}°$. Find angle $APB$.`,
    `Triangle $OAB$ is isosceles (radii), so angle $AOB = 180 - ${oab} - ${oab} = ${centre}°$. The tangents meet the radii at $90°$, so in the quadrilateral $OAPB$ angle $APB = 360 - 90 - 90 - ${centre} = ${p}°$. Alternatively: angle $PAB = 90 - ${oab} = ${pab}°$, and $PA = PB$ (equal tangents), so $APB = 180 - 2 \\times ${pab} = ${p}°$.`,
    [`angle $AOB = ${centre}°$, or angle $PAB = ${pab}°$`, `$360 - 90 - 90 - ${centre}$, or $180 - 2 \\times ${pab}$`],
    p,
    angleAt(A, P, B),
    'angle APB measured',
    { OAB: oab, answer: p },
  )
}

/** The tangent meets the radius at 90°: written as q14 (2 marks). */
function tangentRadius(r: Rng, slot: Question, turn: number): Draft {
  const oab = int(r, 10, 80)
  const t = 90 - oab
  // A at the bottom with the tangent along y = -1; the tangent-chord angle t puts B at 2t round.
  const A = polar(270)
  const B = polar(270 + 2 * t)
  const toTangent = turn % 2 === 0
  if (toTangent) {
    return circleDraft(
      slot,
      `A tangent touches a circle with centre $O$ at $A$. $B$ is on the circle and angle $OAB = ${oab}°$. Find the angle between the tangent and the chord $AB$.`,
      `The tangent and the radius $OA$ meet at $90°$, and the chord sits inside that right angle: $90 - ${oab} = ${t}°$.`,
      [`$90 - ${oab}$`],
      t,
      angleAt(plus(A, [1, 0]), A, B),
      'tangent-chord angle measured',
      { OAB: oab, answer: t },
    )
  }
  return circleDraft(
    slot,
    `A tangent touches a circle with centre $O$ at $A$. $B$ is on the circle, and the angle between the tangent and the chord $AB$ is $${t}°$. Find angle $OAB$.`,
    `The tangent and the radius $OA$ meet at $90°$, and the chord sits inside that right angle: $90 - ${t} = ${oab}°$.`,
    [`$90 - ${t}$`],
    oab,
    angleAt(O, A, B),
    'angle OAB measured',
    { tangent: t, answer: oab },
  )
}

/** Primitive Pythagorean triples, shorter leg first. */
export const TRIPLES: readonly (readonly [number, number, number])[] = [
  [3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [12, 35, 37], [9, 40, 41], [28, 45, 53], [11, 60, 61], [33, 56, 65], [16, 63, 65],
]
/** A scaled triple with hypotenuse at most `max`, legs in either order. */
export function triple(r: Rng, max: number, min = 5): [number, number, number] {
  return draw(
    r,
    (r) => {
      const [a, b, c] = pick(r, TRIPLES)
      const k = int(r, 1, Math.max(1, Math.floor(max / c)))
      return (r() < 0.5 ? [a * k, b * k, c * k] : [b * k, a * k, c * k]) as [number, number, number]
    },
    ([, , c]) => c <= max && c >= min,
  )
}

/** The perpendicular from the centre bisects a chord: written as q6 (distance) and q18 (chord). */
function chordDistance(r: Rng, slot: Question): Draft {
  const [h, d, radius] = triple(r, 65)
  const unit = pick(r, ['cm', 'cm', 'mm', 'm'])
  const chord = 2 * h
  // Second route: trigonometry in the triangle, the half-angle at the centre from the half chord.
  const theta = Math.asin(h / radius)
  const other = radius * Math.cos(theta)
  return {
    question: {
      type: 'numeric',
      prompt: `A chord of length ${chord} ${unit} is drawn in a circle of radius ${radius} ${unit}. Find the distance from the centre to the chord, in ${unit}.`,
      solution: `The perpendicular from the centre **bisects** the chord, so it meets the chord ${h} ${unit} from each end. That makes a right-angled triangle with hypotenuse ${radius} (the radius) and one side ${h}: the distance is $\\sqrt{${radius}^2 - ${h}^2} = \\sqrt{${d * d}} = ${d}$ ${unit}.`,
      markScheme: scheme(slot, [`half the chord, ${h} ${unit}`, `$\\sqrt{${radius}^2 - ${h}^2}$`], `${d} ${unit}`),
      answer: d,
      tolerance: 0,
      units: unit,
    },
    check: { agrees: Math.abs(other - d) < 1e-9 && h < radius, detail: `half-angle ${(theta / RAD).toFixed(4)}°, r cos = ${other.toFixed(6)}` },
    values: { chord, radius, answer: d },
  }
}

function chordLength(r: Rng, slot: Question): Draft {
  const [h, d, radius] = triple(r, 65)
  const unit = pick(r, ['cm', 'cm', 'mm', 'm'])
  const chord = 2 * h
  const theta = Math.acos(d / radius)
  const other = 2 * radius * Math.sin(theta)
  return {
    question: {
      type: 'numeric',
      prompt: `A circle has radius ${radius} ${unit}. A chord is ${d} ${unit} from the centre. Find the length of the chord, in ${unit}.`,
      solution: `The perpendicular from the centre bisects the chord and makes a right-angled triangle with the radius as hypotenuse: half the chord is $\\sqrt{${radius}^2 - ${d}^2} = \\sqrt{${h * h}} = ${h}$ ${unit}, so the chord is $${chord}$ ${unit}. Forgetting to double is the usual slip.`,
      markScheme: scheme(slot, [`$\\sqrt{${radius}^2 - ${d}^2}$`, `${h} ${unit} as half the chord`], `${chord} ${unit}`),
      answer: chord,
      tolerance: 0,
      units: unit,
    },
    check: { agrees: Math.abs(other - chord) < 1e-9 && d < radius, detail: `half-angle ${(theta / RAD).toFixed(4)}°, 2r sin = ${other.toFixed(6)}` },
    values: { distance: d, radius, answer: chord },
  }
}

export const circleTheoremAngles = bySlot('circle-theorem-angles', CIRCLES, {
  q1: centreAngle,
  q2: semicircle,
  q3: cyclicQuadrilateral,
  q5: tangentsCentre,
  q7: sameSegment,
  q8: alternateSegment,
  q9: radiiIsosceles,
  q13: tangentsChord,
  q14: tangentRadius,
})
export const chordsAndRadii = bySlot('chords-and-radii', CIRCLES, { q6: chordDistance, q18: chordLength })

/* ------------------------------------------------------------------------------------------
 * Scale drawings and bearings
 * ---------------------------------------------------------------------------------------- */

const BEARINGS = 'scale-drawings-and-bearings'

/** A bearing in three figures: 45 is 045, 8 is 008. */
export const threeFigures = (b: number) => String(b).padStart(3, '0')
/** The same, built digit by digit, for the second method. */
const byDigits = (b: number) => `${Math.floor(b / 100)}${Math.floor(b / 10) % 10}${b % 10}`

/** The bearing back: add 180 under 180, subtract it from 180 up. */
export const backBearing = (b: number) => (b < 180 ? b + 180 : b - 180)
/** The back bearing by vectors: the displacement reversed, and its direction measured from north. */
export function backByVectors(b: number): number {
  const east = -Math.sin(b * RAD)
  const north = -Math.cos(b * RAD)
  return Math.round(((Math.atan2(east, north) / RAD) % 360 + 360) % 360)
}

/** Writing a bearing in three figures: written as q1. */
function writeBearing(r: Rng, slot: Question): Draft {
  const b = int(r, 1, 99)
  const t = threeFigures(b)
  const prompt = pick(r, [
    `Write a bearing of ${b} degrees correctly.`,
    `Write a bearing of ${b}° as a three-figure bearing.`,
    `A ship sails ${b}° clockwise from north. Write its bearing correctly.`,
  ])
  return {
    question: {
      type: 'short-text',
      prompt,
      solution: `Bearings take three figures, so $${b}°$ is written **${t}°**.`,
      markScheme: scheme(slot, [], `${t}°`),
      accepted: [t, `${t}°`, `${t} degrees`],
    },
    check: { agrees: byDigits(b) === t && t.length === 3 && Number(t) === b, detail: `digit by digit: ${byDigits(b)}` },
    values: { bearing: b, written: t },
  }
}

/** Forward bearings for the back-bearing slots: q5 under 180, q6 and q15 over it. */
function forwardBearing(r: Rng, slot: Question): number {
  if (slot.id === 'q5') return pick(r, [() => int(r, 1, 12), () => int(r, 168, 179), () => int(r, 13, 167), () => int(r, 13, 167)])()
  if (slot.id === 'q15') return int(r, 181, 279)
  return pick(r, [() => int(r, 181, 192), () => int(r, 348, 359), () => int(r, 193, 347), () => int(r, 193, 347)])()
}

const PLACES = [
  ['B', 'A'], ['Q', 'P'], ['Y', 'X'], ['the lighthouse', 'the ship'], ['the church', 'the farm'], ['the harbour', 'the buoy'], ['the tower', 'the school'],
] as const

/** The back bearing: written as q5 (under 180), q6 (over 180) and q15 (over 180, a numeric answer under 100). */
function backBearingDraft(r: Rng, slot: Question): Draft {
  const b = forwardBearing(r, slot)
  const back = backBearing(b)
  const [to, from] = pick(r, PLACES)
  const prompt = `The bearing of ${to} from ${from} is ${threeFigures(b)}°. What is the bearing of ${from} from ${to}${slot.type === 'numeric' ? ', in degrees' : ''}?`
  const add = b < 180
  const solution = add
    ? `$${threeFigures(b)}°$ is under $180°$, so add: $${b} + 180 = ${back}$, written **${threeFigures(back)}°**.`
    : `$${threeFigures(b)}°$ is over $180°$, so subtract: $${b} - 180 = ${back}$, written **${threeFigures(back)}°**.`
  const vec = backByVectors(b)
  const check = { agrees: vec === back && back > 0 && back < 360, detail: `displacement reversed, direction from north by atan2: ${vec}°` }
  const method = [add ? 'adds 180' : 'subtracts 180']
  if (slot.type === 'numeric') {
    return {
      question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, method, String(back)), answer: back, tolerance: 0 },
      check,
      values: { forward: b, back },
    }
  }
  const t = threeFigures(back)
  return {
    question: { type: 'short-text', prompt, solution, markScheme: scheme(slot, method, `${t}°`), accepted: [t, `${t}°`, `${t} degrees`] },
    check,
    values: { forward: b, back },
  }
}

/** "25 000" for text, "25\,000" for KaTeX. */
const spaced = (n: number, sep = ' ') => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep)
const THINGS = ['A road', 'A river', 'A footpath', 'A railway line', 'A canal', 'A cycle path', 'A coastline path']

/** Map scales "1 cm to k km", paper to real (q3) and real to paper (q7 whole, q9 a decimal). */
function mapScale(r: Rng, slot: Question): Draft {
  const toReal = slot.id === 'q3'
  const k = pick(r, [2, 4, 5, 5, 10, 20, 25, 50])
  // Lengths in tenths of a centimetre, so nothing is a floating-point product.
  const tenths = draw(
    r,
    (r) => (slot.id === 'q9' ? int(r, 11, 150) : slot.id === 'q7' ? 10 * int(r, 2, 20) : r() < 0.7 ? 10 * int(r, 2, 20) : int(r, 11, 150)),
    (t) => slot.id !== 'q9' || t % 10 !== 0,
  )
  const cm = tenths / 10
  const km = (tenths * k) / 10
  // Second route: the scale as a ratio 1 : n, n centimetres to k km, and back through units.
  const n = k * 100000
  const kmByRatio = (tenths * n) / 10 / 100000
  const cmByRatio = (km * 100000) / n
  const thing = pick(r, THINGS)
  if (toReal) {
    return {
      question: {
        type: 'numeric',
        prompt: `A map has a scale of 1 cm to ${k} km. ${thing} measures ${show(cm)} cm on the map. How long is it, in km?`,
        solution: `Paper to real means multiply: $${show(cm)} \\times ${k} = ${show(km)}$ km.`,
        markScheme: scheme(slot, [`multiplies by ${k}`], show(km)),
        answer: Number(show(km)),
        tolerance: 0,
      },
      check: { agrees: Math.abs(kmByRatio - km) < 1e-9, detail: `1 : ${n}, ${show(cm)} × ${n} cm = ${show(kmByRatio)} km` },
      values: { k, cm: show(cm), km: show(km) },
    }
  }
  const prompt = slot.id === 'q7'
    ? `A map has a scale of 1 cm to ${k} km. How many centimetres represent ${show(km)} km?`
    : `A map has a scale of 1 cm to ${k} km. A journey of ${show(km)} km is drawn. How many centimetres long is the line?`
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: slot.id === 'q7' ? `Real to paper means divide: $${show(km)} \\div ${k} = ${show(cm)}$ cm.` : `$${show(km)} \\div ${k} = ${show(cm)}$ cm.`,
      markScheme: scheme(slot, [`divides by ${k}`], show(cm)),
      answer: Number(show(cm)),
      tolerance: 0,
    },
    check: { agrees: Math.abs(cmByRatio - cm) < 1e-9, detail: `1 : ${n}, ${show(km)} km = ${show(km * 100000)} cm, ÷ ${n} = ${show(cmByRatio)}` },
    values: { k, cm: show(cm), km: show(km) },
  }
}

/** A ratio scale 1 : n to kilometres: written as q11 (3 marks). */
function ratioScale(r: Rng, slot: Question): Draft {
  const n = pick(r, [10000, 20000, 25000, 40000, 50000, 100000, 200000, 250000])
  const tenths = draw(r, (r) => (r() < 0.6 ? 10 * int(r, 2, 24) : int(r, 15, 240)), (t) => (t * n) % 1000 === 0)
  const cm = tenths / 10
  const real = (tenths * n) / 10 // centimetres, a whole number
  const metres = real / 100
  const km = metres / 1000
  // Second route: 1 cm on the map is n ÷ 100 000 km on the ground.
  const perCm = n / 100000
  const other = cm * perCm
  const thing = pick(r, ['Two places', 'Two villages', 'Two hilltops', 'Two bus stops', 'Two lakes'])
  return {
    question: {
      type: 'numeric',
      prompt: `A map has a scale of 1 : ${spaced(n)}. ${thing} are ${show(cm)} cm apart on the map. How far apart are they, in km?`,
      solution: `$${show(cm)} \\times ${spaced(n, '\\,')} = ${spaced(real, '\\,')}$ cm. Dividing by 100 gives ${show(metres)} m, and by 1000 gives **${show(km)} km**.`,
      markScheme: scheme(slot, [`multiplies by ${spaced(n)}`, 'converts cm to m to km'], show(km)),
      answer: Number(show(km)),
      tolerance: 0,
    },
    check: { agrees: Math.abs(other - km) < 1e-9, detail: `1 cm is ${show(perCm)} km: ${show(cm)} × ${show(perCm)} = ${show(other)}` },
    values: { n, cm: show(cm), km: show(km) },
  }
}

/** The turn from one bearing to the next, -180 to 180, positive clockwise. */
export const turnBetween = (b1: number, b2: number) => ((b2 - b1 + 540) % 360) - 180

/** Position after legs of given bearings and lengths, x east and y north. */
function walk(legs: [number, number][]): Pt[] {
  const pts: Pt[] = [[0, 0]]
  for (const [b, d] of legs) {
    const last = pts.at(-1)!
    pts.push([last[0] + d * Math.sin(b * RAD), last[1] + d * Math.cos(b * RAD)])
  }
  return pts
}

function describeTurn(b1: number, b2: number): string {
  const t = turnBetween(b1, b2)
  const way = t > 0 ? 'clockwise' : 'anticlockwise'
  const size = Math.abs(t)
  const plain = Math.abs(b2 - b1) === size
  const sum = plain
    ? `$${Math.max(b1, b2)} - ${Math.min(b1, b2)} = ${size}°$ ${way}`
    : t > 0
      ? `$${size}°$ ${way}, through north: $${b2} + 360 - ${b1} = ${size}$`
      : `$${size}°$ ${way}, through north: $${b1} + 360 - ${b2} = ${size}$`
  return `The turn at B, from $${threeFigures(b1)}°$ to $${threeFigures(b2)}°$, is ${sum}`
}

/** The angle inside the triangle at the turning point: written as q12 (3 marks). */
function interiorAtTurn(r: Rng, slot: Question): Draft {
  const { b1, b2 } = draw(
    r,
    (r) => ({ b1: int(r, 1, 359), b2: int(r, 1, 359) }),
    ({ b1, b2 }) => {
      const t = Math.abs(turnBetween(b1, b2))
      return t >= 20 && t <= 160 && t !== 90
    },
  )
  const turn = Math.abs(turnBetween(b1, b2))
  const answer = 180 - turn
  const [A, B, C] = walk([[b1, 1], [b2, 1]]) as [Pt, Pt, Pt]
  const measured = angleAt(A, B, C)
  return {
    question: {
      type: 'numeric',
      prompt: `A journey goes from A on a bearing of ${threeFigures(b1)}° to B, then from B on a bearing of ${threeFigures(b2)}° to C. What is the angle inside the triangle at B, in degrees?`,
      solution: `${describeTurn(b1, b2)}. That is how far the direction changes, not the angle inside the triangle: the angle inside is $180 - ${turn} = ${answer}°$.`,
      markScheme: scheme(slot, [`finds the turn of ${turn}°`, 'subtracts the turn from 180'], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: sameAngle(measured, answer), detail: `legs drawn by bearing; angle ABC by vectors ${measured.toFixed(6)}°` },
    values: { b1, b2, turn, answer },
  }
}

/** Two legs at right angles: written as q13 (3 marks). */
function rightAngleJourney(r: Rng, slot: Question): Draft {
  const [d1, d2, d] = triple(r, 100)
  const { b1, b2 } = draw(
    r,
    (r) => {
      const b1 = int(r, 1, 359)
      return { b1, b2: (((b1 + (r() < 0.5 ? 90 : -90)) % 360) + 360) % 360 }
    },
    ({ b2 }) => b2 !== 0,
  )
  const unit = pick(r, ['km', 'km', 'm'])
  const who = pick(r, ['A boat sails', 'A walker walks', 'A plane flies', 'A ship sails', 'A drone flies'])
  const pts = walk([[b1, d1], [b2, d2]])
  const straight = dist(pts[0]!, pts[2]!)
  const angleB = angleAt(pts[0]!, pts[1]!, pts[2]!)
  return {
    question: {
      type: 'numeric',
      prompt: `${who} ${d1} ${unit} on a bearing of ${threeFigures(b1)}°, then ${d2} ${unit} on a bearing of ${threeFigures(b2)}°. How far is it from its start, in ${unit}?`,
      solution: `${describeTurn(b1, b2)}, so the angle inside the triangle at B is $180 - 90 = 90°$ and Pythagoras applies: $\\sqrt{${d1}^2 + ${d2}^2} = \\sqrt{${d * d}} = ${d}$ ${unit}.`,
      markScheme: scheme(slot, ['spots the right angle', 'uses Pythagoras'], String(d)),
      answer: d,
      tolerance: 0,
      units: unit,
    },
    check: { agrees: Math.abs(straight - d) < 1e-9 && sameAngle(angleB, 90), detail: `legs added as vectors: ${straight.toFixed(6)} ${unit}, angle at B ${angleB.toFixed(4)}°` },
    values: { b1, b2, d1, d2, answer: d },
  }
}

export const bearingsGenerator = bySlot('bearings', BEARINGS, { q1: writeBearing, q5: backBearingDraft, q6: backBearingDraft, q15: backBearingDraft, q12: interiorAtTurn, q13: rightAngleJourney })
export const mapScales = bySlot('map-scales', BEARINGS, { q3: mapScale, q7: mapScale, q9: mapScale, q11: ratioScale })

/** Generators for angles, 2D shapes, circle theorems, scale drawings and bearings. */
export const anglesGenerators: Generator[] = [
  angleFacts,
  polygonAngles,
  quadrilateralAngles,
  quadrilateralAlgebra,
  circleTheoremAngles,
  chordsAndRadii,
  bearingsGenerator,
  mapScales,
]
