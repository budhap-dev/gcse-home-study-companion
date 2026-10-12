import type { Question } from '../../content/questions.ts'
import { clearOfHalf, fixed, roundTo, show } from '../format.ts'
import { int, pick, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'
import { evalEquation, evalTex, gcd, near } from '../maths/formulae.ts'
import { angleAt, dist, plus, polar, sameAngle, type Pt } from '../maths/angles.ts'
import { bySlices, piTex } from '../maths/mensuration.ts'
import { fmBySlot } from './build.ts'

/**
 * Further Maths (AQA 8365), geometrical-proof: the numeric slots.
 *
 * 6.1  Knowledge of the area of trapezia and of the surface area and volume of cylinders and
 *      cones (the cone's volume formula is given, as the specification says it is not to be
 *      memorised); angle properties of polygons (exterior angles sum to 360°, interior angles to
 *      (n − 2) × 180°); the circle theorems: the angle at the centre is twice the angle at the
 *      circumference, opposite angles of a cyclic quadrilateral add up to 180°, the alternate
 *      segment theorem, and the 3.7 notes (the angle in a semicircle is 90°, a tangent meets the
 *      radius at 90°, the two tangents from a point are equal).
 * 6.2  The proofs themselves stay written (q11, q12, q17 and the multiple-choice q4, q8, q13,
 *      q16); these generators write the calculations a proof rests on.
 *
 * All non-calculator except q9: whole angles, whole or half lengths, products by hand. Every
 * angle is measured again from coordinates on a unit circle with vectors (maths/angles.ts),
 * never by the theorem the question uses; areas by the shoelace formula, the cone's volume by
 * slices, the cylinder's surface by substituting the answer into the area the prompt describes.
 */

const TOPIC = 'geometrical-proof'

/** The given angle as the prompt prints it: the first "= 40°" or "of 64°". */
const givenAngle = (text: string) => Number(/(?:= |of \$)(\d+)°/.exec(text)![1])

// ---------------------------------------------------------------------------------------
// q1: each exterior angle of a regular polygon. A regular pentagon: 72.
// q10: the interior angle sum. A hexagon: 720.
// ---------------------------------------------------------------------------------------

export const POLYGON_NAMES: Record<number, string> = { 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon', 9: 'nonagon', 10: 'decagon', 12: 'dodecagon' }
/** Regular polygons whose exterior angle is whole; a square left out, where interior and exterior are both 90°. */
export const WHOLE_EXTERIOR = [5, 6, 8, 9, 10, 12, 15, 18, 20, 24, 30, 36, 40, 45, 60, 72]
/** Exterior angles that terminate and divide by hand: 22.5°, 14.4°, 7.5° (not 32 sides: 11.25° is long division). */
export const HALF_EXTERIOR = [16, 25, 48]

/** The number of sides a prompt names: "a regular hexagon", "a polygon with $15$ sides", "has $7$ straight sides". */
export function sidesIn(text: string): number {
  const n = /\$(\d+)\$ (?:straight )?sides/.exec(text)
  if (n) return Number(n[1])
  const named = Object.entries(POLYGON_NAMES).find(([, name]) => new RegExp(`\\b${name}\\b`).test(text))
  if (!named) throw new Error(`no polygon in: ${text}`)
  return Number(named[0])
}

/** Things made as regular polygons, with the numbers of sides each comes in. */
const SHAPED: { thing: string; sides: number[] }[] = [
  { thing: 'A floor tile', sides: [6, 8] },
  { thing: 'A coaster', sides: [5, 6, 8, 9, 10, 12] },
  { thing: 'A badge', sides: [5, 6, 8, 10, 12] },
  { thing: 'A window', sides: [6, 8, 12] },
  { thing: 'A table top', sides: [6, 8, 10] },
  { thing: 'A bandstand floor', sides: [6, 8, 9, 10, 12] },
  { thing: 'A stained-glass panel', sides: [5, 6, 8, 9, 10, 12] },
  { thing: 'A picture frame', sides: [6, 8] },
  { thing: 'A road sign', sides: [8] },
  { thing: 'A mirror', sides: [6, 8, 10, 12] },
  { thing: 'A plate', sides: [6, 8, 12] },
  { thing: 'A gazebo floor', sides: [6, 8] },
]

const regularShape = (n: number) => (POLYGON_NAMES[n] ? `a regular ${POLYGON_NAMES[n]}` : `a regular polygon with $${n}$ sides`)

function exteriorAngle(r: Rng, slot: Question): Draft {
  const n = r() < 0.15 ? pick(r, HALF_EXTERIOR) : pick(r, WHOLE_EXTERIOR)
  const e = 360 / n
  const shape = regularShape(n)
  const things = SHAPED.filter((s) => s.sides.includes(n))
  const asks = [
    () => `Work out the size of each exterior angle of ${shape}.`,
    () => `Work out the size of one exterior angle of ${shape}.`,
    () => `Each exterior angle of ${shape} is $x°$. Work out the value of $x$.`,
    () => `What is the size of each exterior angle of ${shape}?`,
  ]
  let prompt = things.length && r() < 0.5 ? `${pick(r, things).thing} is in the shape of ${shape}. Work out the size of each of its exterior angles.` : pick(r, asks)()
  if (!Number.isInteger(e)) prompt += ' Give your answer as a decimal.'
  const solution = `The exterior angles of any polygon sum to $360°$, and ${shape} shares them equally between its $${n}$ vertices: $360° \\div ${n} = ${show(e)}°$. Each interior angle is then $${show(180 - e)}°$.`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], show(e)), answer: e, tolerance: 0 },
    check: (() => {
      // Second route: the regular polygon the prompt names, drawn on a unit circle; the turn at
      // each vertex is 180° less the measured interior angle, and the turns go once round.
      const m = sidesIn(prompt)
      const v = Array.from({ length: m }, (_, k) => polar((360 * k) / m))
      const turns = v.map((p, k) => 180 - angleAt(v[(k + m - 1) % m]!, p, v[(k + 1) % m]!))
      const total = turns.reduce((s, t) => s + t, 0)
      return { agrees: sameAngle(turns[0]!, e) && sameAngle(total, 360), detail: `${m} vertices: turn ${turns[0]!.toFixed(6)}°, all turns ${total.toFixed(6)}°` }
    })(),
    values: { n, exterior: e },
  }
}

/** Places drawn as irregular polygons, for "has 7 straight sides". */
const PLOTS = ['A field', 'A garden', 'A plot of land', 'A courtyard', 'A paddock', 'A car park']

function interiorSum(r: Rng, slot: Question): Draft {
  const n = int(r, 5, 24)
  const S = (n - 2) * 180
  const name = POLYGON_NAMES[n]
  const shape = name ? `${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}` : `a polygon with $${n}$ sides`
  const asks = [
    () => `Work out the sum of the interior angles of ${shape}.`,
    () => `Work out the total of the interior angles of ${shape}.`,
    () => `The interior angles of ${shape} add up to $S°$. Work out the value of $S$.`,
    () => `What is the sum of the interior angles of ${shape}?`,
  ]
  const prompt = n <= 12 && r() < 0.3 ? `${pick(r, PLOTS)} has $${n}$ straight sides. Work out the sum of its interior angles.` : pick(r, asks)()
  const solution = `A polygon with $n$ sides splits into $n - 2$ triangles from one vertex, and the angles of each triangle sum to $180°$. With $${n}$ sides: $(${n} - 2) \\times 180° = ${n - 2} \\times 180° = ${S}°$.`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], String(S)), answer: S, tolerance: 0 },
    check: (() => {
      // Second route: an irregular convex polygon with the prompt's number of sides (vertices
      // unevenly spaced round a circle, each step at least 0.4 of an even one), its interior
      // angles measured one by one with vectors and added.
      const m = sidesIn(prompt)
      const v = Array.from({ length: m }, (_, k) => polar((360 * (k + 0.3 * Math.sin(1.7 * k))) / m))
      const total = v.reduce((s, p, k) => s + angleAt(v[(k + m - 1) % m]!, p, v[(k + 1) % m]!), 0)
      return { agrees: sameAngle(total, S), detail: `${m} measured interior angles total ${total.toFixed(6)}°` }
    })(),
    values: { n, sum: S },
  }
}

// ---------------------------------------------------------------------------------------
// q2: the angle at the centre. ∠AOB = 80°, C on the major arc: ∠ACB = 40°.
// ---------------------------------------------------------------------------------------

/** Three letters for the points on the circle; the centre is always O. */
const TRIO = [['A', 'B', 'C'], ['P', 'Q', 'R'], ['X', 'Y', 'Z'], ['D', 'E', 'F'], ['L', 'M', 'N'], ['S', 'T', 'U']] as const

/**
 * Even centre angles from 20° to 170°, leaving out 90° (half is 45°, the base angle of the
 * isosceles triangle OAB too) and 120° (half is 60°, the supplement 180° − 120° too).
 */
export const CENTRE_ANGLES = Array.from({ length: 76 }, (_, i) => 20 + 2 * i).filter((c) => c !== 90 && c !== 120)

function centreAngle(r: Rng, slot: Question): Draft {
  const c = pick(r, CENTRE_ANGLES)
  const h = c / 2
  const [A, B, C] = pick(r, TRIO)
  const toCircumference = r() < 0.7
  const prompt = toCircumference
    ? pick(r, [
        `$${A}$, $${B}$ and $${C}$ lie on a circle with centre $O$, and $\\angle ${A}O${B} = ${c}°$. Work out the size of $\\angle ${A}${C}${B}$, where $${C}$ is on the major arc $${A}${B}$.`,
        `$${A}$, $${B}$ and $${C}$ are points on a circle with centre $O$, and $${C}$ is on the major arc $${A}${B}$. $\\angle ${A}O${B} = ${c}°$. Work out the size of $\\angle ${A}${C}${B}$.`,
        `The chord $${A}${B}$ of a circle with centre $O$ subtends an angle of $${c}°$ at $O$. $${C}$ is a point on the major arc $${A}${B}$. Work out the size of $\\angle ${A}${C}${B}$.`,
      ])
    : pick(r, [
        `$${A}$, $${B}$ and $${C}$ lie on a circle with centre $O$, with $${C}$ on the major arc $${A}${B}$, and $\\angle ${A}${C}${B} = ${h}°$. Work out the size of $\\angle ${A}O${B}$.`,
        `$${C}$ is a point on the major arc $${A}${B}$ of a circle with centre $O$, and $\\angle ${A}${C}${B} = ${h}°$. Work out the size of $\\angle ${A}O${B}$.`,
      ])
  const answer = toCircumference ? h : c
  const solution = toCircumference
    ? `The angle at the centre is twice the angle at the circumference standing on the same arc, so $\\angle ${A}${C}${B} = ${c}° \\div 2 = ${h}°$.`
    : `The angle at the centre is twice the angle at the circumference standing on the same arc, so $\\angle ${A}O${B} = 2 \\times ${h}° = ${c}°$.`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], String(answer)), answer, tolerance: 0 },
    check: (() => {
      // Second route: A and B either side of the bottom of a unit circle, C near the top (on the
      // major arc); the printed angle drawn, the asked one measured.
      const g = givenAngle(prompt)
      const half = toCircumference ? g / 2 : g
      const pA = polar(270 - half)
      const pB = polar(270 + half)
      const pC = polar(90 + 25 * Math.sin(c))
      const atO = angleAt(pA, [0, 0], pB)
      const atC = angleAt(pA, pC, pB)
      const [drawn, measured] = toCircumference ? [atO, atC] : [atC, atO]
      return { agrees: sameAngle(drawn, g) && sameAngle(measured, answer), detail: `given drawn as ${drawn.toFixed(6)}°, asked measured ${measured.toFixed(6)}°` }
    })(),
    values: { find: toCircumference ? 'circumference' : 'centre', centre: c, answer },
  }
}

// ---------------------------------------------------------------------------------------
// q3: opposite angles of a cyclic quadrilateral. ∠PQR = 110°: ∠PSR = 70°.
// ---------------------------------------------------------------------------------------

const QUADS = ['ABCD', 'PQRS', 'WXYZ', 'EFGH', 'KLMN', 'JKLM']
/** Whole angles 25° to 155°, never 90° (its opposite angle is 90° too). */
export const CYCLIC_ANGLES = Array.from({ length: 131 }, (_, i) => 25 + i).filter((x) => x !== 90)

function cyclicQuadrilateral(r: Rng, slot: Question): Draft {
  const x = pick(r, CYCLIC_ANGLES)
  const answer = 180 - x
  const Q = pick(r, QUADS)
  const i = int(r, 0, 3)
  const at = (k: number) => Q[(i + k) % 4]!
  const [prev, G, next, K] = [at(3), at(0), at(1), at(2)]
  const given = `${prev}${G}${next}`
  const asked = `${prev}${K}${next}`
  const lead = pick(r, [
    `$${Q}$ is a cyclic quadrilateral and`,
    `The four vertices of quadrilateral $${Q}$ lie on a circle, and`,
    `$${Q[0]}$, $${Q[1]}$, $${Q[2]}$ and $${Q[3]}$ lie on a circle, in that order, and`,
  ])
  const prompt = `${lead} $\\angle ${given} = ${x}°$. Work out the size of $\\angle ${asked}$.`
  const solution = `$${G}$ and $${K}$ are opposite vertices, and opposite angles of a cyclic quadrilateral sum to $180°$: $\\angle ${asked} = 180° - ${x}° = ${answer}°$.`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], String(answer)), answer, tolerance: 0 },
    check: (() => {
      // Second route: the neighbours of the given vertex at 0° and 2x on a unit circle (so the
      // given angle stands on a 2x arc), the opposite vertex inside that arc, the given vertex
      // across from it; the four angles are measured, and add to 360°.
      const g = givenAngle(prompt)
      const v: Record<string, Pt> = { [prev]: polar(0), [K]: polar(g), [next]: polar(2 * g), [G]: polar(g + 180) }
      const angle = (p: string, q: string, s: string) => angleAt(v[p]!, v[q]!, v[s]!)
      const drawn = angle(prev, G, next)
      const measured = angle(prev, K, next)
      const total = drawn + measured + angle(G, prev, K) + angle(G, next, K)
      return { agrees: sameAngle(drawn, g) && sameAngle(measured, answer) && sameAngle(total, 360), detail: `${given} drawn as ${drawn.toFixed(6)}°, ${asked} measured ${measured.toFixed(6)}°, the four total ${total.toFixed(6)}°` }
    })(),
    values: { quad: Q, given, x, answer },
  }
}

// ---------------------------------------------------------------------------------------
// q6: the angle in a semicircle. AB a diameter, ∠ABC = 35°: ∠BAC = 55°.
// ---------------------------------------------------------------------------------------

/** 10° to 80°, never 45° (the answer would be the given), 30° (twice it is the answer) or 60° (half it is). */
export const SEMICIRCLE_ANGLES = Array.from({ length: 71 }, (_, i) => 10 + i).filter((g) => ![30, 45, 60].includes(g))

function semicircle(r: Rng, slot: Question): Draft {
  const g = pick(r, SEMICIRCLE_ANGLES)
  const answer = 90 - g
  const [U, V, W] = pick(r, TRIO)
  // The given angle at V and the asked at U, as written, or the other way round.
  const [K, G] = r() < 0.6 ? [U, V] : [V, U]
  const fact = `$\\angle ${K}${G}${W} = ${g}°$. Work out the size of $\\angle ${G}${K}${W}$.`
  const prompt = pick(r, [
    `$${U}${V}$ is a diameter of a circle and $${W}$ is a point on the circle. ${fact}`,
    `$${U}$, $${V}$ and $${W}$ lie on a circle, and $${U}${V}$ is a diameter. ${fact}`,
    `$${W}$ is a point on a circle with diameter $${U}${V}$, and ${fact}`,
    `$${U}${V}$ is a diameter of a circle with centre $O$, and $${W}$ is another point on the circle. ${fact}`,
  ])
  const solution = `The angle in a semicircle is $90°$, so $\\angle ${K}${W}${G} = 90°$. Angles in a triangle sum to $180°$: $\\angle ${G}${K}${W} = 180° - 90° - ${g}° = ${answer}°$.`
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [`angle ${K}${W}${G} = 90° with the reason`], String(answer)),
      answer,
      tolerance: 0,
    },
    check: (() => {
      // Second route: the diameter from (1, 0) (the given vertex) to (−1, 0), the third point at
      // 180° − 2g round the circle; both base angles measured.
      const gv = givenAngle(prompt)
      const pG: Pt = [1, 0]
      const pK: Pt = [-1, 0]
      const pW = polar(180 - 2 * gv)
      const drawn = angleAt(pK, pG, pW)
      const measured = angleAt(pG, pK, pW)
      const right = angleAt(pK, pW, pG)
      return { agrees: sameAngle(drawn, gv) && sameAngle(measured, answer) && sameAngle(right, 90), detail: `given drawn ${drawn.toFixed(6)}°, right angle ${right.toFixed(6)}°, asked measured ${measured.toFixed(6)}°` }
    })(),
    values: { given: g, at: G, answer },
  }
}

// ---------------------------------------------------------------------------------------
// q7: the alternate segment theorem in an isosceles triangle. Tangent at C makes 64° with CB,
// CA = CB: ∠ACB = 52°. Or back: ∠ACB = 52°, the tangent's acute angle with CB: 64°.
// ---------------------------------------------------------------------------------------

/** The tangent point, the chord's other end and the third point: written C, B, A. */
const ASTRIO = [['C', 'B', 'A'], ['R', 'Q', 'P'], ['Z', 'Y', 'X'], ['T', 'S', 'U'], ['N', 'M', 'L'], ['F', 'E', 'D']] as const
/**
 * 20° to 85°, never 45° (the angle at the centre, 2t, would be the answer), 60° (the triangle
 * is equilateral) or 72° (half of it is the apex, 36°, and twice the apex is it).
 */
export const TANGENT_CHORD = Array.from({ length: 66 }, (_, i) => 20 + i).filter((t) => ![45, 60, 72].includes(t))

function alternateSegment(r: Rng, slot: Question): Draft {
  const t = pick(r, TANGENT_CHORD)
  const x = 180 - 2 * t
  const [T, U, V] = pick(r, ASTRIO)
  const forward = r() < 0.7
  const equal = `$${T}${V} = ${T}${U}$`
  let prompt: string, solution: string, method: string, answer: number
  if (forward) {
    answer = x
    prompt = pick(r, [
      `The tangent to a circle at $${T}$ makes an angle of $${t}°$ with the chord $${T}${U}$. $${V}$ is a point on the circle with ${equal}. Work out the size of $\\angle ${V}${T}${U}$.`,
      `$${V}$, $${U}$ and $${T}$ lie on a circle, and ${equal}. The tangent to the circle at $${T}$ makes an angle of $${t}°$ with the chord $${T}${U}$. Work out the size of $\\angle ${V}${T}${U}$.`,
      `Triangle $${V}${U}${T}$ has all three vertices on a circle, and ${equal}. The tangent to the circle at $${T}$ makes an angle of $${t}°$ with $${T}${U}$. Work out the size of $\\angle ${V}${T}${U}$.`,
    ])
    solution = `By the alternate segment theorem, $\\angle ${T}${V}${U} = ${t}°$. Since ${equal}, the base angles are equal, so $\\angle ${T}${U}${V} = ${t}°$ too. Then $\\angle ${V}${T}${U} = 180° - ${t}° - ${t}° = ${x}°$.`
    method = `angle ${T}${V}${U} = ${t}° by the alternate segment theorem`
  } else {
    answer = t
    prompt = pick(r, [
      `$${V}$, $${U}$ and $${T}$ lie on a circle, with ${equal} and $\\angle ${V}${T}${U} = ${x}°$. Work out the size of the acute angle between the tangent to the circle at $${T}$ and the chord $${T}${U}$.`,
      `Triangle $${V}${U}${T}$ has all three vertices on a circle, ${equal} and $\\angle ${V}${T}${U} = ${x}°$. The tangent to the circle at $${T}$ makes an acute angle with the chord $${T}${U}$. Work out the size of that angle.`,
    ])
    solution = `Since ${equal}, the base angles are equal: $\\angle ${T}${V}${U} = \\angle ${T}${U}${V} = \\frac{180° - ${x}°}{2} = ${t}°$. By the alternate segment theorem, the angle between the tangent at $${T}$ and the chord $${T}${U}$ equals $\\angle ${T}${V}${U}$, the angle in the alternate segment: $${t}°$.`
    method = `angle ${T}${V}${U} = (180 − ${x}) ÷ 2 = ${t}°, base angles equal`
  }
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [method], String(answer)), answer, tolerance: 0 },
    check: (() => {
      // Second route: the tangent point at the bottom of a unit circle with the tangent along
      // y = −1; the chord's end and the third point mirror each other at ±2t, so the chords are
      // equal; the tangent-chord angle and the angle at the tangent point both measured.
      const g = givenAngle(prompt)
      const tt = forward ? g : (180 - g) / 2
      const pT = polar(270)
      const pU = polar(270 + 2 * tt)
      const pV = polar(270 - 2 * tt)
      const tangentChord = angleAt(plus(pT, [1, 0]), pT, pU)
      const apex = angleAt(pV, pT, pU)
      const [drawn, measured] = forward ? [tangentChord, apex] : [apex, tangentChord]
      const ok = sameAngle(drawn, g) && sameAngle(measured, answer) && near(dist(pT, pU), dist(pT, pV)) && tangentChord < 90
      return { agrees: ok, detail: `tangent-chord ${tangentChord.toFixed(6)}°, apex ${apex.toFixed(6)}°, chords ${dist(pT, pU).toFixed(6)} and ${dist(pT, pV).toFixed(6)}` }
    })(),
    values: { direction: forward ? 'tangent to apex' : 'apex to tangent', t, apex: x, answer },
  }
}

// ---------------------------------------------------------------------------------------
// q14: equal tangents. ∠APB = 40°: ∠PAB = 70°.
// q15: tangents, the centre and the circumference. ∠APB = 40°, C on the major arc: ∠ACB = 70°.
// Both on the advanced sheet: the two slots draw ∠APB from different halves of the list (by
// the turn, which runs one apart on a sheet), so q14 never prints q15's figures or answer.
// ---------------------------------------------------------------------------------------

/** The outside point, the two touching points and the point on the major arc; the centre is O. */
const TANGENT_SETS = [['P', 'A', 'B', 'C'], ['T', 'R', 'S', 'Q'], ['X', 'A', 'B', 'C'], ['P', 'Q', 'R', 'S'], ['E', 'F', 'G', 'H']] as const
/** Even angles 20° to 160° between the tangents, never 60° (equilateral: the answer equals it) or 90° (half of it is the answer). */
export const TANGENT_ANGLES = Array.from({ length: 71 }, (_, i) => 20 + 2 * i).filter((p) => p !== 60 && p !== 90)
/**
 * The two halves the sheet's q14 and q15 draw from. Each slot prints or answers an angle p
 * between the tangents and the base angle y = (180 − p) / 2, so the halves are chosen so that no
 * figure of one half's question is a figure of the other's: p and y joined to every other
 * angle whose p or y they share (y = 70 with p = 70, whose y is 55, and so on), and each
 * joined group kept in one half, the groups dealt to the smaller half.
 */
export const TANGENT_HALVES: number[][] = (() => {
  const parent = new Map(TANGENT_ANGLES.map((p) => [p, p]))
  const root = (p: number): number => (parent.get(p) === p ? p : root(parent.get(p)!))
  const figures = (p: number) => [p, (180 - p) / 2]
  for (const p of TANGENT_ANGLES) for (const q of TANGENT_ANGLES) if (figures(p).some((v) => figures(q).includes(v))) parent.set(root(p), root(q))
  const groups = new Map<number, number[]>()
  for (const p of TANGENT_ANGLES) groups.set(root(p), [...(groups.get(root(p)) ?? []), p])
  const halves: number[][] = [[], []]
  for (const g of [...groups.values()].sort((a, b) => b.length - a.length || a[0]! - b[0]!)) halves[halves[0]!.length <= halves[1]!.length ? 0 : 1]!.push(...g)
  return halves.map((h) => h.sort((a, b) => a - b))
})()

/** The kite O, A, P, B on a unit circle for an angle p between the tangents, with C on the major arc. */
function tangentKite(p: number) {
  const half = (180 - p) / 2
  const A = polar(half)
  const B = polar(-half)
  const P: Pt = [1 / Math.cos((half * Math.PI) / 180), 0]
  const C = polar(180 + 20 * Math.sin(p))
  return { A, B, P, C, O: [0, 0] as Pt }
}

function equalTangents(r: Rng, slot: Question, turn: number): Draft {
  const p = pick(r, TANGENT_HALVES[turn % 2]!)
  const y = (180 - p) / 2
  const [P, A, B] = pick(r, TANGENT_SETS)
  const forward = r() < 0.7
  const from = `Two tangents from a point $${P}$ touch a circle at $${A}$ and $${B}$`
  const pair = `$${P}${A}$ and $${P}${B}$ are tangents to a circle, touching it at $${A}$ and $${B}$`
  let prompt: string, solution: string, answer: number
  if (forward) {
    answer = y
    prompt = pick(r, [
      `${from}, and $\\angle ${A}${P}${B} = ${p}°$. Work out the size of $\\angle ${P}${A}${B}$.`,
      `${pair}, and $\\angle ${A}${P}${B} = ${p}°$. Work out the size of $\\angle ${P}${A}${B}$.`,
      `The tangents to a circle at $${A}$ and $${B}$ meet at the point $${P}$, and $\\angle ${A}${P}${B} = ${p}°$. Work out the size of $\\angle ${P}${B}${A}$.`,
    ])
    solution = `Tangents from an external point are equal, so $${P}${A} = ${P}${B}$ and triangle $${P}${A}${B}$ is isosceles. Its base angles are equal: $\\angle ${P}${A}${B} = \\angle ${P}${B}${A} = \\frac{180° - ${p}°}{2} = ${y}°$.`
  } else {
    answer = p
    const [X, Z] = r() < 0.5 ? [A, B] : [B, A]
    prompt = pick(r, [
      `${from}, and $\\angle ${P}${X}${Z} = ${y}°$. Work out the size of $\\angle ${A}${P}${B}$.`,
      `${pair}, and $\\angle ${P}${X}${Z} = ${y}°$. Work out the size of $\\angle ${A}${P}${B}$.`,
    ])
    solution = `Tangents from an external point are equal, so $${P}${A} = ${P}${B}$ and triangle $${P}${A}${B}$ is isosceles: $\\angle ${P}${A}${B} = \\angle ${P}${B}${A} = ${y}°$. Then $\\angle ${A}${P}${B} = 180° - ${y}° - ${y}° = ${p}°$.`
  }
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [`${P}${A} = ${P}${B}, tangents from a point are equal`], String(answer)), answer, tolerance: 0 },
    check: (() => {
      // Second route: the kite on a unit circle; the tangents' lengths compared, each radius
      // shown perpendicular to its tangent, and the angles at P and A measured.
      const g = givenAngle(prompt)
      const k = tangentKite(forward ? g : 180 - 2 * g)
      const atP = angleAt(k.A, k.P, k.B)
      const atA = angleAt(k.P, k.A, k.B)
      const [drawn, measured] = forward ? [atP, atA] : [atA, atP]
      const radial = angleAt(k.O, k.A, k.P)
      return {
        agrees: sameAngle(drawn, g) && sameAngle(measured, answer) && near(dist(k.P, k.A), dist(k.P, k.B)) && sameAngle(radial, 90),
        detail: `angle at ${P} ${atP.toFixed(6)}°, at ${A} ${atA.toFixed(6)}°, radius to tangent ${radial.toFixed(6)}°`,
      }
    })(),
    values: { direction: forward ? 'APB to PAB' : 'PAB to APB', APB: p, answer },
  }
}

function tangentsAndCircumference(r: Rng, slot: Question, turn: number): Draft {
  const p = pick(r, TANGENT_HALVES[turn % 2]!)
  const c = 180 - p
  const x = c / 2
  const [P, A, B, C] = pick(r, TANGENT_SETS)
  const forward = r() < 0.7
  const from = `Two tangents from a point $${P}$ touch a circle with centre $O$ at $${A}$ and $${B}$`
  const pair = `$${P}${A}$ and $${P}${B}$ are tangents to a circle with centre $O$, touching it at $${A}$ and $${B}$`
  const meet = `The tangents to a circle with centre $O$ at the points $${A}$ and $${B}$ meet at $${P}$`
  const onArc = `$${C}$ is a point on the major arc $${A}${B}$`
  const rightAngles = `A tangent meets the radius at $90°$, so $\\angle O${A}${P} = \\angle O${B}${P} = 90°$`
  let prompt: string, solution: string, method: string[], answer: number
  if (forward) {
    answer = x
    prompt = pick(r, [
      `${from}, and $\\angle ${A}${P}${B} = ${p}°$. ${onArc}. Work out the size of $\\angle ${A}${C}${B}$.`,
      `${pair}, and $\\angle ${A}${P}${B} = ${p}°$. ${onArc}. Work out the size of $\\angle ${A}${C}${B}$.`,
      `${meet}, and $\\angle ${A}${P}${B} = ${p}°$. ${onArc}. Work out the size of $\\angle ${A}${C}${B}$.`,
    ])
    solution = `${rightAngles}. In the quadrilateral $O${A}${P}${B}$, angles sum to $360°$: $\\angle ${A}O${B} = 360° - 90° - 90° - ${p}° = ${c}°$. The angle at the centre is twice the angle at the circumference, so $\\angle ${A}${C}${B} = ${c}° \\div 2 = ${x}°$.`
    method = [`two right angles at ${A} and ${B}`, `angle ${A}O${B} = ${c}°`]
  } else {
    answer = p
    prompt = pick(r, [
      `${from}. ${onArc}, and $\\angle ${A}${C}${B} = ${x}°$. Work out the size of $\\angle ${A}${P}${B}$.`,
      `${pair}. ${onArc}, and $\\angle ${A}${C}${B} = ${x}°$. Work out the size of $\\angle ${A}${P}${B}$.`,
    ])
    solution = `The angle at the centre is twice the angle at the circumference, so $\\angle ${A}O${B} = 2 \\times ${x}° = ${c}°$. ${rightAngles}. In the quadrilateral $O${A}${P}${B}$, angles sum to $360°$: $\\angle ${A}${P}${B} = 360° - 90° - 90° - ${c}° = ${p}°$.`
    method = [`angle ${A}O${B} = ${c}°`, `two right angles at ${A} and ${B}, then 360 − 90 − 90 − ${c}`]
  }
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, method, String(answer)), answer, tolerance: 0 },
    check: (() => {
      // Second route: the kite on a unit circle with C on the far side of the circle; the
      // radii shown perpendicular to the tangents, the angles at P, O and C measured.
      const g = givenAngle(prompt)
      const k = tangentKite(forward ? g : 180 - 2 * g)
      const atP = angleAt(k.A, k.P, k.B)
      const atC = angleAt(k.A, k.C, k.B)
      const [drawn, measured] = forward ? [atP, atC] : [atC, atP]
      const radial = [angleAt(k.O, k.A, k.P), angleAt(k.O, k.B, k.P)]
      return {
        agrees: sameAngle(drawn, g) && sameAngle(measured, answer) && radial.every((a) => sameAngle(a, 90)),
        detail: `angle at ${P} ${atP.toFixed(6)}°, at ${C} ${atC.toFixed(6)}°, at O ${angleAt(k.A, k.O, k.B).toFixed(6)}°`,
      }
    })(),
    values: { direction: forward ? 'APB to ACB' : 'ACB to APB', APB: p, AOB: c, answer },
  }
}

// ---------------------------------------------------------------------------------------
// q5: the area of a trapezium. Parallel sides 5 cm and 9 cm, 4 cm apart: 28.
// ---------------------------------------------------------------------------------------

interface Trapezium {
  /** Null for a plain trapezium. */
  lead: string | null
  unit: 'cm' | 'm'
  side: [number, number]
  h: [number, number]
  step: number
}
const TRAPEZIA: Trapezium[] = [
  { lead: null, unit: 'cm', side: [2, 20], h: [3, 12], step: 1 },
  { lead: null, unit: 'cm', side: [2, 20], h: [3, 12], step: 1 },
  { lead: 'A flower bed', unit: 'm', side: [2, 9], h: [3, 6], step: 1 },
  { lead: 'A patio', unit: 'm', side: [2, 8], h: [3, 5], step: 1 },
  { lead: 'A lawn', unit: 'm', side: [4, 15], h: [3, 10], step: 1 },
  { lead: 'A field', unit: 'm', side: [30, 120], h: [20, 80], step: 10 },
  { lead: 'A window pane', unit: 'cm', side: [20, 60], h: [20, 50], step: 5 },
]

const inSteps = (r: Rng, [lo, hi]: [number, number], step: number) => step * int(r, lo / step, hi / step)

function trapeziumArea(r: Rng, slot: Question): Draft {
  const t = pick(r, TRAPEZIA)
  const u = t.unit
  // Two different parallel sides, a height unlike either, and an area that is none of them.
  let a = 0, b = 0, h = 0
  for (;;) {
    a = inSteps(r, t.side, t.step)
    b = inSteps(r, t.side, t.step)
    h = inSteps(r, t.h, t.step)
    const area = ((a + b) * h) / 2
    if (a !== b && h !== a && h !== b && ![a, b, h].includes(area)) break
  }
  // Shorter side first, as written, three times in four.
  if ((a > b) === r() < 0.75) [a, b] = [b, a]
  const area = ((a + b) * h) / 2
  const whole = Number.isInteger(area)
  const sides = `$${a}$ ${u} and $${b}$ ${u}`
  let prompt = t.lead
    ? `${t.lead} is in the shape of a trapezium. Its parallel sides are ${sides} long, and the perpendicular distance between them is $${h}$ ${u}. Work out its area in ${u}².`
    : pick(r, [
        `A trapezium has parallel sides of ${sides}, and the perpendicular distance between them is $${h}$ ${u}. Work out its area.`,
        `The parallel sides of a trapezium are ${sides} long, and its perpendicular height is $${h}$ ${u}. Work out the area of the trapezium.`,
      ])
  if (!whole) prompt += ' Give your answer as a decimal.'
  const solution = `Area $= \\frac{1}{2}(a + b)h = \\frac{1}{2}(${a} + ${b}) \\times ${h} = \\frac{1}{2} \\times ${a + b} \\times ${h} = ${show(area)}$ ${u}². The specification expects this formula to be known.`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], show(area)), answer: area, tolerance: 0 },
    check: (() => {
      // Second route: the trapezium the prompt describes drawn with the longer side on the x
      // axis, its area by the shoelace formula; the printed substitution read back too.
      const [pa, pb, ph] = [...prompt.matchAll(/\$(\d+)\$ (?:cm|m)\b/g)].map((m) => Number(m[1])) as [number, number, number]
      const s = (pb - pa) / 2
      const v: Pt[] = [[0, 0], [pb, 0], [s + pa, ph], [s, ph]]
      const shoelace = Math.abs(v.reduce((acc, p, k) => acc + p[0] * v[(k + 1) % 4]![1] - v[(k + 1) % 4]![0] * p[1], 0)) / 2
      const printed = evalTex(/= (\\frac\{1\}\{2\}\(\d+ \+ \d+\) \\times \d+) =/.exec(solution)![1]!)
      return { agrees: near(shoelace, area) && near(printed, area), detail: `shoelace ${shoelace}, printed substitution ${printed}` }
    })(),
    values: { context: t.lead ?? 'plain', a, b, h, area },
  }
}

// ---------------------------------------------------------------------------------------
// q9: the volume of a cone, formula given, to 2 d.p. r 3, h 4: 12π = 37.70.
// ---------------------------------------------------------------------------------------

interface Cone {
  lead: string
  unit: 'cm' | 'm'
  r: [number, number]
  /** The height as a multiple of the radius, lowest and highest: a traffic cone is 3.5 to 5 times as tall as its radius. */
  ratio: [number, number]
  /** Whether a half-unit radius is realistic. */
  halves: boolean
}
export const CONES: Cone[] = [
  { lead: 'A cone has', unit: 'cm', r: [2, 12], ratio: [0.6, 2.5], halves: false },
  { lead: 'A cone has', unit: 'cm', r: [2, 12], ratio: [0.6, 2.5], halves: true },
  { lead: 'An ice cream cone has', unit: 'cm', r: [2, 4], ratio: [2, 4], halves: true },
  { lead: 'A party hat is a cone with', unit: 'cm', r: [5, 10], ratio: [1.8, 3], halves: false },
  { lead: 'A traffic cone has', unit: 'cm', r: [10, 16], ratio: [3.5, 5], halves: false },
  // Sand settles at about 34° or less: the height at most two thirds of the radius.
  { lead: 'A pile of sand is a cone with', unit: 'm', r: [3, 6], ratio: [0.25, 2 / 3], halves: true },
  { lead: 'A funnel is a cone with', unit: 'cm', r: [4, 9], ratio: [1, 2], halves: false },
  { lead: 'A paper drinking cup is a cone with', unit: 'cm', r: [3, 5], ratio: [1.8, 3], halves: true },
]

/** (n/d)π as the mark scheme prints it: 12π, 20π/3. */
function piText(n: number, d: number): string {
  const g = gcd(n, d)
  const [a, b] = [n / g, d / g]
  return b === 1 ? `${a}π` : `${a}π/${b}`
}

function coneVolume(r: Rng, slot: Question): Draft {
  const c = pick(r, CONES)
  const u = c.unit
  let rad = 0, h = 0, V = 0
  for (;;) {
    rad = c.halves && r() < 0.5 ? int(r, c.r[0], c.r[1] - 1) + 0.5 : int(r, c.r[0], c.r[1])
    // A whole height in the context's proportions: ceil(lo × r) to floor(hi × r).
    h = int(r, Math.ceil(c.ratio[0] * rad - 1e-9), Math.floor(c.ratio[1] * rad + 1e-9))
    V = (Math.PI * rad * rad * h) / 3
    // Radius and height differ (so r²h and rh² differ), and the volume is clear of a rounding
    // boundary at two places.
    if (rad !== h && clearOfHalf(V, 2, 0.05)) break
  }
  const answer = roundTo(V, 2)
  // (2r)² h over 12 keeps a half radius in whole numbers: r²h/3 = (2r)²h/12.
  const n = 4 * rad * rad * h
  const prompt =
    `${c.lead} base radius $${show(rad)}$ ${u} and perpendicular height $${h}$ ${u}. The volume of a cone is $\\frac{1}{3}\\pi r^2 h$. ` +
    pick(r, ['Work out the volume. Give your answer to two decimal places.', `Work out its volume in ${u}³. Give your answer to two decimal places.`])
  const solution = `Volume $= \\frac{1}{3} \\times \\pi \\times ${show(rad)}^2 \\times ${h} = ${piTex(n, 12)} \\approx ${fixed(V, 2)}$ ${u}³. The question gives this formula because the specification says it is not to be memorised.`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], `${piText(n, 12)} or ${fixed(V, 2)}`), answer, tolerance: 0.005 },
    check: (() => {
      // Second route: the cone the prompt describes cut into slices, each a circle whose radius
      // shrinks in proportion up the height (Simpson's rule, exact for a cone); the printed
      // substitution and its multiple of π read back too.
      const [pr, ph] = [...prompt.matchAll(/\$([\d.]+)\$ (?:cm|m)\b/g)].map((m) => Number(m[1])) as [number, number]
      const slices = bySlices(ph, (z) => Math.PI * (pr * (1 - z / ph)) ** 2)
      const sub = /= (\\frac\{1\}\{3\} \\times \\pi \\times [\d.]+\^2 \\times \d+) = ([^ ]+) \\approx/.exec(solution)!
      const printed = evalTex(sub[1]!)
      const multiple = evalTex(sub[2]!)
      return { agrees: near(slices, V) && near(printed, V) && near(multiple, V) && roundTo(slices, 2) === answer, detail: `by slices ${slices}, printed ${printed}, ${sub[2]} = ${multiple}` }
    })(),
    values: { context: c.lead, r: rad, h, unit: u },
  }
}

// ---------------------------------------------------------------------------------------
// q18: a cylinder's surface area with the radius unknown. Closed, h = 2r, 150π: r = 5.
// ---------------------------------------------------------------------------------------

interface Cylinder {
  lead: string
  closed: boolean
  unit: 'cm' | 'm'
  r: [number, number]
  k: [number, number]
}
export const CYLINDERS: Cylinder[] = [
  { lead: 'A closed cylinder has', closed: true, unit: 'cm', r: [2, 12], k: [1, 4] },
  { lead: 'A closed tin is a cylinder with', closed: true, unit: 'cm', r: [3, 8], k: [1, 3] },
  { lead: 'A closed water tank is a cylinder with', closed: true, unit: 'm', r: [2, 6], k: [1, 2] },
  { lead: 'A cylinder, open at the top and closed at the bottom, has', closed: false, unit: 'cm', r: [2, 12], k: [1, 4] },
  { lead: 'A plant pot is a cylinder, open at the top, with', closed: false, unit: 'cm', r: [5, 12], k: [1, 2] },
  { lead: 'A pencil pot is a cylinder, open at the top, with', closed: false, unit: 'cm', r: [3, 6], k: [2, 3] },
]

/** The height as printed: r, 2r, 3r. */
const heightTex = (k: number) => (k === 1 ? 'r' : `${k}r`)
const TIMES = ['', 'equal to', 'twice', 'three times', 'four times']

function cylinderRadius(r: Rng, slot: Question): Draft {
  const c = pick(r, CYLINDERS)
  const u = c.unit
  const k = int(r, c.k[0], c.k[1])
  const ends = c.closed ? 2 : 1
  const coef = ends + 2 * k
  // The radius never equals the height's multiple, and the area stays at most 1000π by hand.
  const top = Math.min(c.r[1], Math.floor(Math.sqrt(1000 / coef)))
  const radii = Array.from({ length: top - c.r[0] + 1 }, (_, i) => c.r[0] + i).filter((x) => x !== k)
  const rad = pick(r, radii)
  const N = coef * rad * rad
  const area = c.closed ? 'Its total surface area is' : 'The total area of its base and curved surface is'
  const size = r() < 0.6 ? `radius $r$ ${u} and height $${heightTex(k)}$ ${u}.` : `radius $r$ ${u}, and its height is ${TIMES[k]} its radius.`
  const prompt = `${c.lead} ${size} ${area} $${N}\\pi$ ${u}². Work out the value of $r$.`
  const endsTex = c.closed ? '2\\pi r^2' : '\\pi r^2'
  const curved = `2\\pi r \\times ${heightTex(k)}`
  const solution =
    `${c.closed ? 'Total surface area' : 'Base and curved surface'} $= ${endsTex} + 2\\pi r h$ with $h = ${heightTex(k)}$: $${endsTex} + ${curved} = ${endsTex} + ${2 * k}\\pi r^2 = ${coef}\\pi r^2$. ` +
    `So $${coef}\\pi r^2 = ${N}\\pi$, $r^2 = ${rad * rad}$ and $r = ${rad}$. The cylinder formulae are ones the specification expects to be known.`
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [`${coef}πr² from ${c.closed ? 'the two ends' : 'the base'} and the curved surface`], `r = ${rad}`),
      answer: rad,
      tolerance: 0,
    },
    check: (() => {
      // Second route: the cylinder the prompt describes, its surface built face by face at the
      // answer (one or two discs and the unrolled rectangle, 2πr by the height), against the
      // printed area; a radius one more or one less does not fit, and the printed equation holds.
      const pN = Number(/\$(\d+)\\pi\$/.exec(prompt)![1])
      const digits = /height \$(\d*)r\$/.exec(prompt)
      const pk = digits ? Number(digits[1] || 1) : TIMES.indexOf(/height is (.+) its radius/.exec(prompt)![1]!)
      const discs = /open at the top/.test(prompt) ? 1 : 2
      const surface = (x: number) => discs * Math.PI * x * x + 2 * Math.PI * x * (pk * x)
      const eq = /So \$([^$]+)\$/.exec(solution)![1]!
      const ok = near(surface(rad), pN * Math.PI) && !near(surface(rad + 1), pN * Math.PI) && !near(surface(rad - 1), pN * Math.PI) && near(evalEquation(eq, { r: rad }), 0)
      return { agrees: ok, detail: `${discs} disc(s) and a ${show(roundTo(2 * Math.PI * rad, 4))} by ${pk * rad} rectangle: ${show(roundTo(surface(rad) / Math.PI, 6))}π against ${pN}π` }
    })(),
    values: { context: c.lead, closed: c.closed ? 'closed' : 'open', k, r: rad, N },
  }
}

export const geometryGenerators: Generator[] = [
  fmBySlot('fm-polygon-angles', TOPIC, { q1: exteriorAngle, q10: interiorSum }),
  fmBySlot('fm-circle-theorem-angles', TOPIC, { q2: centreAngle, q3: cyclicQuadrilateral, q6: semicircle, q7: alternateSegment }),
  fmBySlot('fm-tangents-from-a-point', TOPIC, { q14: equalTangents, q15: tangentsAndCircumference }),
  fmBySlot('fm-area-and-volume', TOPIC, { q5: trapeziumArea, q9: coneVolume, q18: cylinderRadius }),
]
