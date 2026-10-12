import type { Question } from '../../content/questions.ts'
import { clearOfHalf, fixed, roundTo, show } from '../format.ts'
import { draw, int, pick, shuffle, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'
import { evalTex, fracTex, near, reduce, terminates } from '../maths/formulae.ts'
import { RAD, dist, meet, polar, type Pt } from '../maths/angles.ts'
import { QUADRUPLES, heron } from '../maths/triangles.ts'
import { fmBySlot, minus } from './build.ts'
import { TRIPLES } from './lines.ts'

/**
 * Further Maths (AQA 8365), trigonometry-and-pythagoras-in-2d-and-3d.
 *
 * 6.3  The sine rule for a side, the cosine rule for a side and for the largest angle, and the
 *      area ½ab sin C, in scalene triangles; the cosine rule and the area with an exact
 *      cosine (cos A = 3/5), sin A found from the Pythagorean triangle or sin² + cos² = 1.
 * 6.4  Pythagoras in 2D and 3D: the hypotenuse from the four triples the specification names
 *      (3, 4, 5; 5, 12, 13; 8, 15, 17; 7, 24, 25) and simple multiples; a cuboid's space diagonal.
 * 6.5  Trigonometry in 3D: the angle between a line and a plane (a cuboid's diagonal and its
 *      shadow on the base; a pyramid's sloping edge), the angle between two planes (a
 *      pyramid's sloping face and its base), and a triangle in a cuboid with no right angle.
 *
 * q1, q3, q9 and q14 are non-calculator: whole answers from triples and exact cosines, squares
 * known by hand. The rest are to two decimal places, drawn clear of a rounding boundary, with
 * tolerance 0.005 so the unrounded value passes too. Every answer is worked a second way from
 * the prompt's own numbers: a triangle drawn on coordinates and measured, a cuboid or pyramid
 * placed at the origin and measured with vectors, Heron's area for an angle, the shoelace area.
 */

const TOPIC = 'trigonometry-and-pythagoras-in-2d-and-3d'

const sinD = (x: number) => Math.sin(x * RAD)
const cosD = (x: number) => Math.cos(x * RAD)
const isSquare = (n: number) => Number.isInteger(Math.sqrt(n))
const TWO_DP = 'Give your answer to two decimal places.'

/** Safe to give to two places: clear of a half in the third place, and not already exact there. */
export const roundsCleanly = (x: number) =>
  clearOfHalf(x, 2, 0.05) && Math.abs(x * 100 - Math.round(x * 100)) > 1e-6 && !Number.isInteger(roundTo(x, 2))

/**
 * The sentence after a working with roots: keep them exact, and, where rounding the lengths to
 * two places first lands on a different answer, what it gives instead.
 */
function keepExact(keep: string, rounding: string, early: number, answer: number): string {
  return roundTo(early, 2) === answer
    ? ` Keep ${keep} exact until the last step.`
    : ` Keep ${keep} exact until the last step: rounding ${rounding} first gives $${fixed(early, 2)}°$, which is wrong.`
}

/** Every number that closes a maths span, in order: $8$, $PQ = 8$, $60°$ (not the 5 of \dfrac{3}{5}). */
export const printedNumbers = (text: string) => [...text.matchAll(/(?<![\w.{])(\d+(?:\.\d+)?)°?\$/g)].map((m) => Number(m[1]))
/** Named values as printed: $a = 4$, $AB = 4$, angle $A = 30°$ give { a: 4, AB: 4, A: 30 }. */
export const namedValues = (text: string): Record<string, number> =>
  Object.fromEntries([...text.matchAll(/\$([A-Za-z]+) = (\d+(?:\.\d+)?)°?\$/g)].map((m) => [m[1]!, Number(m[2])]))

/** √n as printed: 5 when n is 25, \sqrt{41} otherwise; and as the mark scheme types it. */
const rootTex = (n: number) => (isSquare(n) ? String(Math.sqrt(n)) : `\\sqrt{${n}}`)
const rootText = (n: number) => (isSquare(n) ? String(Math.sqrt(n)) : `√${n}`)

function weighted<T>(r: Rng, items: readonly (readonly [T, number])[]): T {
  let left = r() * items.reduce((s, [, w]) => s + w, 0)
  for (const [t, w] of items) if ((left -= w) < 0) return t
  return items.at(-1)![0]
}

type V3 = readonly [number, number, number]
const minus3 = (p: V3, q: V3): V3 => [p[0] - q[0], p[1] - q[1], p[2] - q[2]]
const dot3 = (p: V3, q: V3) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2]
const len3 = (p: V3) => Math.sqrt(dot3(p, p))
const cross3 = (p: V3, q: V3): V3 => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]]
/** The cuboid ABCDEFGH at the origin, AB along x, AD along y, E above A. */
export function cuboidAt(a: number, b: number, h: number): Record<string, V3> {
  return { A: [0, 0, 0], B: [a, 0, 0], C: [a, b, 0], D: [0, b, 0], E: [0, 0, h], F: [a, 0, h], G: [a, b, h], H: [0, b, h] }
}
/** The angle between a vector and the horizontal plane, in degrees. */
const toBase = (v: V3) => Math.asin(Math.abs(v[2]) / len3(v)) / RAD

// ---------------------------------------------------------------------------------------
// q1: the hypotenuse from a triple. 8 cm and 15 cm: 17.
// ---------------------------------------------------------------------------------------

/**
 * The specification's four triples and their multiples whose squares are known by hand: 3, 4, 5
 * up to 30, 40, 50; 5, 12, 13; 8, 15, 17; 7, 24, 25. Never 10, 24, 26, the right option of the
 * written q2 on the same sheet. Weighted so no one calculation is over an eighth of builds:
 * 3, 4, 5 has ten.
 */
export const HYPOTENUSE_FAMILIES = [
  { base: [3, 4, 5], ks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], weight: 0.64 },
  { base: [5, 12, 13], ks: [1], weight: 0.12 },
  { base: [8, 15, 17], ks: [1], weight: 0.12 },
  { base: [7, 24, 25], ks: [1], weight: 0.12 },
] as const

const RIGHT_NAMES = [['P', 'Q', 'R'], ['A', 'B', 'C'], ['X', 'Y', 'Z'], ['L', 'M', 'N']] as const

function hypotenuse(r: Rng, slot: Question): Draft {
  const fam = weighted(r, HYPOTENUSE_FAMILIES.map((f) => [f, f.weight] as const))
  const k = pick(r, fam.ks)
  const [p, q, c] = fam.base.map((x) => x * k) as [number, number, number]
  const [x, y] = r() < 0.5 ? [p, q] : [q, p]
  const u = pick(r, ['cm', 'cm', 'm', 'mm'])
  const form = int(r, 0, 2)
  const [P, Q, R] = pick(r, RIGHT_NAMES)
  const prompt =
    form === 0
      ? `A right-angled triangle has shorter sides of $${x}$ ${u} and $${y}$ ${u}. Work out the length of the hypotenuse.`
      : form === 1
        ? `The two sides that meet at the right angle of a triangle are $${x}$ ${u} and $${y}$ ${u}. Work out the length of the longest side.`
        : `Triangle $${P}${Q}${R}$ has a right angle at $${Q}$, with $${P}${Q} = ${x}$ ${u} and $${Q}${R} = ${y}$ ${u}. Work out the length of $${P}${R}$.`
  const [b0, b1, b2] = fam.base
  const note = k === 1 ? `This is the $${b0}, ${b1}, ${b2}$ triple, one of the four in the specification.` : `This is the $${b0}, ${b1}, ${b2}$ triple multiplied by $${k}$.`
  const lead = form === 2 ? `${P}${R} = ` : ''
  const solution = `Square, add, root: $${lead}\\sqrt{${x}^2 + ${y}^2} = \\sqrt{${x * x} + ${y * y}} = \\sqrt{${c * c}} = ${c}$ ${u}. ${note}`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], String(c)), answer: c, tolerance: 0 },
    check: (() => {
      // Second route: the angle at one end by tan, then the hypotenuse as adjacent ÷ cos.
      const [s, t] = printedNumbers(prompt) as [number, number]
      const h = s / Math.cos(Math.atan2(t, s))
      return { agrees: near(h, c), detail: `legs ${s}, ${t}: angle by tan, then ${s} ÷ cos = ${h}` }
    })(),
    values: { triple: fam.base.join('-'), k, x, y, form },
  }
}

// ---------------------------------------------------------------------------------------
// q3: a cuboid's space diagonal. 4 by 3 by 12: 13.
// ---------------------------------------------------------------------------------------

/** Cuboids with three different edges up to 20 and a whole diagonal up to 30: nineteen of them. */
export const CUBOIDS = QUADRUPLES.filter(([a, b, c, d]) => a !== b && b !== c && c <= 20 && d <= 30)

/** The diagonals the cuboids have: twelve, 21 shared by five cuboids. */
const DIAGONALS = [...new Set(CUBOIDS.map((x) => x[3]))]

function cuboidDiagonal(r: Rng, slot: Question): Draft {
  // The diagonal first, evenly, then a cuboid that has it: picking cuboids evenly made 21 a quarter of answers.
  const d = pick(r, DIAGONALS)
  const [ea, eb, ec, diag] = pick(r, CUBOIDS.filter((x) => x[3] === d))
  const [a, b, c] = shuffle(r, [ea, eb, ec]) as [number, number, number]
  const form = int(r, 0, 2)
  const u = form === 1 ? 'cm' : pick(r, ['cm', 'cm', 'm', 'mm'])
  const prompt =
    form === 0
      ? `A cuboid measures $${a}$ ${u} by $${b}$ ${u} by $${c}$ ${u}. Work out the length of the diagonal from one corner to the opposite corner.`
      : form === 1
        ? `A box is $${a}$ cm long, $${b}$ cm wide and $${c}$ cm high. Work out the length of the longest straight rod that fits inside it.`
        : `The cuboid $ABCDEFGH$ has $AB = ${a}$ ${u}, $BC = ${b}$ ${u} and $CG = ${c}$ ${u}, with $E$, $F$, $G$, $H$ vertically above $A$, $B$, $C$, $D$. Work out the length of $AG$.`
  const S = a * a + b * b + c * c
  const base = a * a + b * b
  const oneLine = `\\sqrt{${a}^2 + ${b}^2 + ${c}^2} = \\sqrt{${a * a} + ${b * b} + ${c * c}} = \\sqrt{${S}} = ${diag}`
  const solution = isSquare(base)
    ? `Base diagonal $\\sqrt{${a}^2 + ${b}^2} = ${Math.sqrt(base)}$, then $\\sqrt{${Math.sqrt(base)}^2 + ${c}^2} = ${diag}$ ${u}. In one line, $${oneLine}$.`
    : `$${oneLine}$ ${u}: the base diagonal squared, $${a}^2 + ${b}^2 = ${base}$, plus the height squared, $${c}^2$, under one root.`
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [`√(${a}² + ${b}² + ${c}²)${isSquare(base) ? ` or a base diagonal of ${Math.sqrt(base)}` : ''}`], String(diag)),
      answer: diag,
      tolerance: 0,
    },
    check: (() => {
      // Second route: the diagonal's angle with the base by tan, then the length as height ÷ sin.
      const [p, q, h] = printedNumbers(prompt) as [number, number, number]
      const theta = Math.atan2(h, Math.sqrt(p * p + q * q))
      const other = h / Math.sin(theta)
      return { agrees: near(other, diag), detail: `edges ${p}, ${q}, ${h}: angle with the base ${(theta / RAD).toFixed(4)}°, height ÷ sin = ${other}` }
    })(),
    values: { a, b, c, d: diag, form },
  }
}

// ---------------------------------------------------------------------------------------
// q4: the area ½ab sin C. 7, 8 and 60°: 14√3 = 24.25.
// ---------------------------------------------------------------------------------------

/** Angles for the general case: whole degrees 20 to 160 without 30°, 45°, 60°, 90°, 120°, 135°, 150°. */
export const AREA_ANGLES = Array.from({ length: 141 }, (_, i) => i + 20).filter((C) => ![30, 45, 60, 90, 120, 135, 150].includes(C))

const halfAbSinC = (a: number, b: number, C: number) => 0.5 * a * b * sinD(C)

function areaFormula(r: Rng, slot: Question): Draft {
  // 60° and 120° a fifth of the time, with the exact form √3 as the written mark scheme gives it.
  const special = r() < 0.2
  const form = pick(r, [0, 0, 1, 2])
  const { a, b, C } = draw(
    r,
    (r) => ({ a: int(r, 3, 20), b: int(r, 3, 20), C: special ? pick(r, [60, 120]) : pick(r, AREA_ANGLES) }),
    ({ a, b, C }) => {
      const area = halfAbSinC(a, b, C)
      // ab sin C, ½ab cos C and the calculator in radians all give something else.
      return a !== b && roundsCleanly(area) && Math.abs(0.5 * a * b * Math.sin(C) - area) > 0.02 && Math.abs(0.5 * a * b * Math.abs(cosD(C)) - area) > 0.02
    },
  )
  const area = halfAbSinC(a, b, C)
  const answer = roundTo(area, 2)
  const u = form === 2 ? 'm' : pick(r, ['cm', 'cm', 'm'])
  const prompt =
    form === 0
      ? `Two sides of a triangle are $${a}$ ${u} and $${b}$ ${u}, and the angle between them is $${C}°$. Work out the area. ${TWO_DP}`
      : form === 1
        ? `In triangle $ABC$, $AB = ${a}$ ${u}, $AC = ${b}$ ${u} and angle $BAC = ${C}°$. Work out the area of the triangle. ${TWO_DP}`
        : `A triangular garden has two straight edges of $${a}$ m and $${b}$ m, meeting at an angle of $${C}°$. Work out the area of the garden. ${TWO_DP}`
  const [n, d] = reduce(a * b, 4)
  const exactTex = d === 1 ? `${n}\\sqrt{3}` : `\\frac{${n}\\sqrt{3}}{${d}}`
  const exactText = d === 1 ? `${n}√3` : `${n}√3/${d}`
  const start = `Area $= \\frac{1}{2} \\times ${a} \\times ${b} \\times \\sin ${C}°`
  const solution = special
    ? `${start} = ${show((a * b) / 2)} \\times \\frac{\\sqrt{3}}{2} = ${exactTex} = ${fixed(area, 2)}$ ${u}² to two decimal places.${C === 120 ? ' Here $\\sin 120° = \\sin 60°$, so the obtuse angle gives the same sine.' : ''}`
    : `${start} = ${show((a * b) / 2)} \\sin ${C}° = ${fixed(area, 2)}$ ${u}² to two decimal places.${C > 90 ? ' The formula works for an obtuse angle too.' : ''}`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], special ? `${exactText} or ${fixed(area, 2)}` : fixed(area, 2)), answer, tolerance: 0.005 },
    check: (() => {
      // Second route: the two sides drawn on coordinates at the printed angle, the shoelace area.
      const [s, t, A] = printedNumbers(prompt) as [number, number, number]
      const [px, py] = polar(A, s)
      const shoelace = Math.abs(t * py) / 2
      const exactOk = special ? near(evalTex(exactTex), shoelace) : true
      return { agrees: roundTo(shoelace, 2) === answer && exactOk, detail: `(0, 0), (${t}, 0), (${px.toFixed(4)}, ${py.toFixed(4)}): shoelace ${shoelace}` }
    })(),
    values: { a, b, C, special: special ? 'yes' : 'no', form },
  }
}

// ---------------------------------------------------------------------------------------
// q5: the sine rule for a side. a = 4, A = 30°, B = 45°: b = 4√2 = 5.66.
// ---------------------------------------------------------------------------------------

type L = 'A' | 'B' | 'C'
const low = (x: string) => x.toLowerCase()

function sineRuleSide(r: Rng, slot: Question): Draft {
  const [X, Y] = shuffle(r, ['A', 'B', 'C'] as L[]) as [L, L, L]
  const { x, P, Q } = draw(
    r,
    (r) => ({ x: int(r, 3, 20), P: int(r, 20, 125), Q: int(r, 20, 125) }),
    ({ x, P, Q }) => {
      const R = 180 - P - Q
      const y = (x * sinD(Q)) / sinD(P)
      // Scalene, and the ratio upside down gives something else.
      return P !== Q && R >= 15 && R !== P && R !== Q && roundsCleanly(y) && Math.abs((x * sinD(P)) / sinD(Q) - y) > 0.02
    },
  )
  const y = (x * sinD(Q)) / sinD(P)
  const answer = roundTo(y, 2)
  const u = pick(r, ['cm', 'cm', 'm'])
  const prompt =
    r() < 0.6
      ? `In triangle $ABC$, $${low(X)} = ${x}$ ${u}, angle $${X} = ${P}°$ and angle $${Y} = ${Q}°$. Work out $${low(Y)}$. ${TWO_DP}`
      : `In triangle $ABC$, angle $${X} = ${P}°$ and angle $${Y} = ${Q}°$. The side opposite angle $${X}$ is $${low(X)} = ${x}$ ${u}. Work out $${low(Y)}$, the side opposite angle $${Y}$. ${TWO_DP}`
  const solution = `Sine rule: $${low(Y)} = \\dfrac{${low(X)} \\sin ${Y}}{\\sin ${X}} = \\dfrac{${x} \\sin ${Q}°}{\\sin ${P}°} = ${fixed(y, 2)}$ ${u}.`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], fixed(y, 2)), answer, tolerance: 0.005 },
    check: (() => {
      // Second route: the triangle drawn from the known side and its two end angles, the side measured.
      const v = namedValues(prompt)
      const ask = /Work out \$([abc])\$/.exec(prompt)![1]!
      const known = Object.keys(v).find((k) => /^[abc]$/.test(k))!
      const angX = v[known.toUpperCase()]!
      const angY = v[ask.toUpperCase()]!
      const angZ = 180 - angX - angY
      const Zp: Pt = [v[known]!, 0]
      const Xp = meet([0, 0], polar(angY), Zp, polar(180 - angZ))
      const measured = dist(Xp, Zp)
      return { agrees: roundTo(measured, 2) === answer, detail: `side ${v[known]} with end angles ${angY}° and ${angZ}°, side opposite ${angY}° measured ${measured}` }
    })(),
    values: { X, Y, x, P, Q },
  }
}

// ---------------------------------------------------------------------------------------
// q6: the cosine rule for a side. 5, 7 and 60°: √39 = 6.24.
// ---------------------------------------------------------------------------------------

function cosineRuleSide(r: Rng, slot: Question): Draft {
  // 60° and 120° about one time in seven, where cos is ±½ and the square is whole, as written.
  const special = r() < 0.15
  const { p, q, A } = draw(
    r,
    (r) => ({ p: int(r, 3, 20), q: int(r, 3, 20), A: special ? pick(r, [60, 120]) : int(r, 20, 160) }),
    ({ p, q, A }) => {
      const sq = p * p + q * q - 2 * p * q * cosD(A)
      const side = Math.sqrt(sq)
      // The sign of the last term flipped, or the 2 left out, gives something else.
      return (
        p !== q && (special || ![60, 90, 120].includes(A)) && roundsCleanly(side) &&
        Math.abs(Math.sqrt(p * p + q * q + 2 * p * q * cosD(A)) - side) > 0.02 && Math.abs(Math.sqrt(Math.max(0, p * p + q * q - p * q * cosD(A))) - side) > 0.02
      )
    },
  )
  const sq = p * p + q * q - 2 * p * q * cosD(A)
  const side = Math.sqrt(sq)
  const answer = roundTo(side, 2)
  const u = pick(r, ['cm', 'cm', 'm'])
  const lettered = r() < 0.4
  const X = pick(r, ['A', 'B', 'C'] as L[])
  const [l1, l2] = (['a', 'b', 'c'] as const).filter((l) => l !== low(X))
  const s = lettered ? low(X) : 'a'
  const prompt = lettered
    ? `In triangle $ABC$, $${l1} = ${p}$ ${u}, $${l2} = ${q}$ ${u} and angle $${X} = ${A}°$. Work out $${s}$. ${TWO_DP}`
    : `Two sides of a triangle are $${p}$ ${u} and $${q}$ ${u}, and the angle between them is $${A}°$. Work out the third side. ${TWO_DP}`
  const sub = `${s}^2 = ${p}^2 + ${q}^2 - 2 \\times ${p} \\times ${q} \\times \\cos ${A}°`
  const n = Math.round(sq)
  const solution = special
    ? `Cosine rule: $${sub} = ${p * p} + ${q * q} ${A === 60 ? '-' : '+'} ${p * q} = ${n}$${A === 120 ? ' (as $\\cos 120° = -\\frac{1}{2}$, the last term is added)' : ''}, so $${s} = \\sqrt{${n}} = ${fixed(side, 2)}$ ${u}.`
    : `Cosine rule: $${sub} = ${p * p} + ${q * q} - ${2 * p * q} \\cos ${A}° = ${sq.toFixed(4)}$ to four decimal places, so $${s} = ${fixed(side, 2)}$ ${u}.`
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [minus(`${s}² = ${p}² + ${q}² - 2 × ${p} × ${q} × cos ${A}°`)], special ? `√${n} or ${fixed(side, 2)}` : fixed(side, 2)),
      answer,
      tolerance: 0.005,
    },
    check: (() => {
      // Second route: the two sides drawn from one point at the printed angle, the third measured.
      const [s1, s2, ang] = printedNumbers(prompt) as [number, number, number]
      const measured = dist(polar(0, s2), polar(ang, s1))
      return { agrees: roundTo(measured, 2) === answer && (!special || near(measured * measured, n)), detail: `sides ${s1}, ${s2} at ${ang}°: third side measured ${measured}` }
    })(),
    values: { p, q, A, lettered: lettered ? X : 'no' },
  }
}

// ---------------------------------------------------------------------------------------
// q7: the largest angle from three sides. 4, 6, 8: 104.48°.
// ---------------------------------------------------------------------------------------

function largestAngle(r: Rng, slot: Question): Draft {
  // Obtuse seven times in ten, as written; otherwise acute, so the negative cosine is not the only cue.
  const obtuse = r() < 0.7
  const { a, b, c } = draw(
    r,
    (r) => {
      const a = int(r, 5, 20)
      const [b, c] = [int(r, 3, a - 1), int(r, 3, a - 1)].sort((x, y) => x - y) as [number, number]
      return { a, b, c }
    },
    ({ a, b, c }) => {
      if (b === c || b + c <= a) return false
      const gap = b * b + c * c - a * a
      if (obtuse ? gap >= 0 : gap <= 0) return false
      const t = Math.acos(gap / (2 * b * c)) / RAD
      // Never cos = −¼, the written 104.48° in another triangle (5, 14, 16).
      return 4 * gap !== -2 * b * c && t <= 160 && t >= 62 && roundsCleanly(t)
    },
  )
  const num = b * b + c * c - a * a
  const den = 2 * b * c
  const theta = Math.acos(num / den) / RAD
  const answer = roundTo(theta, 2)
  const u = pick(r, ['cm', 'cm', 'm'])
  const order = r() < 0.5 ? [b, c, a] : shuffle(r, [a, b, c])
  const named = r() < 0.35
  // PQ is opposite R, QR opposite P and PR opposite Q.
  const sides = ['PQ', 'QR', 'PR'] as const
  const opposite = { PQ: 'R', QR: 'P', PR: 'Q' } as const
  const at = named ? opposite[sides[order.indexOf(a)]!] : '\\theta'
  const prompt = named
    ? `Triangle $PQR$ has $PQ = ${order[0]}$ ${u}, $QR = ${order[1]}$ ${u} and $PR = ${order[2]}$ ${u}. Work out the size of its largest angle. ${TWO_DP}`
    : `A triangle has sides of $${order[0]}$ ${u}, $${order[1]}$ ${u} and $${order[2]}$ ${u}. Work out the size of its largest angle. ${TWO_DP}`
  const [rn, rd] = reduce(num, den)
  // A decimal when it stops within three places, as written (−0.25); a fraction otherwise.
  const decimal = terminates(rn, rd) && Number.isInteger(Math.round((num / den) * 1e9) / 1e6)
  const cosTex = decimal ? show(num / den) : fracTex(rn, rd, '\\frac')
  const inv = decimal ? `\\cos^{-1}(${cosTex})` : `\\cos^{-1}\\left(${cosTex}\\right)`
  const note = obtuse ? 'The negative cosine says the angle is obtuse.' : 'The cosine is positive, so even the largest angle is acute.'
  const which = named ? `, so the largest angle is $${at}$` : ''
  const solution =
    `The largest angle is opposite the longest side, $${a}$${which}. Cosine rule: $\\cos ${at} = \\dfrac{${b}^2 + ${c}^2 - ${a}^2}{2 \\times ${b} \\times ${c}} = \\dfrac{${b * b} + ${c * c} - ${a * a}}{${den}} = ${cosTex}$, ` +
    `so $${at} = ${inv} = ${fixed(theta, 2)}°$. ${note}`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [`cosine rule arranged for the angle opposite ${a}`], fixed(theta, 2)), answer, tolerance: 0.005 },
    check: (() => {
      // Second route: Heron's area, then sin of the angle from area = ½bc sin A, obtuse when a² > b² + c².
      const [s, t, w] = (printedNumbers(prompt) as number[]).sort((x, y) => x - y) as [number, number, number]
      const sin = (2 * heron(s, t, w)) / (s * t)
      const acute = Math.asin(Math.min(1, sin)) / RAD
      const other = w * w > s * s + t * t ? 180 - acute : acute
      return { agrees: roundTo(other, 2) === answer, detail: `Heron's area ${heron(s, t, w)}, sin ${sin}, angle ${other}` }
    })(),
    values: { a, b, c, obtuse: obtuse ? 'yes' : 'no', named: named ? 'yes' : 'no' },
  }
}

// ---------------------------------------------------------------------------------------
// q9: the cosine rule with an exact cosine. b = 6, c = 5, cos A = 3/5: a = 5.
// ---------------------------------------------------------------------------------------

export interface ExactCosine {
  /** The two sides either side of the angle, shorter first. */
  b: number
  c: number
  /** The cosine p/q, in lowest terms. */
  p: number
  q: number
  /** The third side. */
  a: number
}

/**
 * Two sides from 2 to 15 and a cosine ±p/q with q up to 8 where 2bc·p/q is whole (at most
 * 200) and the third side is a whole number up to 20 that is none of the printed figures or
 * the 2bc cos A term. The written 6, 5, 3/5 gives 5, a printed side, so it is left out.
 */
export const EXACT_COSINES: ExactCosine[] = (() => {
  const out: ExactCosine[] = []
  for (let q = 2; q <= 8; q++)
    for (let p0 = 1; p0 < q; p0++) {
      if (reduce(p0, q)[1] !== q) continue
      for (const p of [p0, -p0])
        for (let b = 2; b <= 15; b++)
          for (let c = b + 1; c <= 15; c++) {
            const t = (2 * b * c * p) / q
            if (!Number.isInteger(t) || Math.abs(t) > 200) continue
            const a2 = b * b + c * c - t
            const a = Math.sqrt(a2)
            if (!Number.isInteger(a) || a > 20 || [b, c, p0, q, Math.abs(t)].includes(a)) continue
            out.push({ b, c, p, q, a })
          }
    }
  return out
})()

/** The angle, the two sides next to it in alphabetical order, and the side opposite. */
function letters(r: Rng) {
  const V = pick(r, ['A', 'B', 'C'] as L[])
  const [l1, l2] = (['a', 'b', 'c'] as const).filter((l) => l !== low(V)) as [string, string]
  return { V, v: low(V), l1, l2 }
}

const cosPrinted = (p: number, q: number) => fracTex(p, q, '\\dfrac')
/** The cosine as a factor in working: \frac{3}{5}, or \left(-\frac{1}{4}\right). */
const cosFactor = (p: number, q: number) => (p < 0 ? `\\left(${fracTex(p, q, '\\frac')}\\right)` : fracTex(p, q, '\\frac'))

/** The triangle with sides s1 and s2 from the origin at the printed cosine, by coordinates. */
function exactTriangle(prompt: string) {
  const [s1, s2] = printedNumbers(prompt) as [number, number]
  const cos = evalTex(/\$\\cos [ABC] = ([^$]+)\$/.exec(prompt)![1]!)
  const far: Pt = [s2 * cos, s2 * Math.sqrt(1 - cos * cos)]
  return { s1, s2, cos, near: [s1, 0] as Pt, far }
}

function exactCosineSide(r: Rng, slot: Question): Draft {
  const { b, c, p, q, a } = pick(r, EXACT_COSINES)
  const [s1, s2] = r() < 0.5 ? [b, c] : [c, b]
  const { V, v, l1, l2 } = letters(r)
  const u = pick(r, ['cm', 'cm', 'm'])
  const prompt = `In triangle $ABC$, $${l1} = ${s1}$ ${u}, $${l2} = ${s2}$ ${u} and $\\cos ${V} = ${cosPrinted(p, q)}$. Work out the length of $${v}$.`
  const t = (2 * b * c * p) / q
  const note = p < 0 ? ` The cosine is negative, so angle $${V}$ is obtuse and the last term is added.` : ' The fraction is given so the arithmetic is exact.'
  const solution = `Cosine rule: $${v}^2 = ${s1}^2 + ${s2}^2 - 2 \\times ${s1} \\times ${s2} \\times ${cosFactor(p, q)} = ${s1 * s1} + ${s2 * s2} ${t < 0 ? '+' : '-'} ${Math.abs(t)} = ${a * a}$, so $${v} = ${a}$ ${u}.${note}`
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [minus(`substitution with 2 × ${s1} × ${s2} × ${p < 0 ? `(${p}/${q})` : `${p}/${q}`} = ${t}`)], String(a)),
      answer: a,
      tolerance: 0,
    },
    check: (() => {
      // Second route: the two sides drawn from the angle at the printed cosine, the third measured.
      const tri = exactTriangle(prompt)
      const measured = dist(tri.near, tri.far)
      return { agrees: near(measured, a), detail: `sides ${tri.s1}, ${tri.s2} at cos ${tri.cos}: third side measured ${measured}` }
    })(),
    values: { b, c, p, q, a, V },
  }
}

// ---------------------------------------------------------------------------------------
// q14: the area from an exact cosine. b = 6, c = 5, cos A = 3/5: 12.
// ---------------------------------------------------------------------------------------

/** Cosines whose sine is rational, from the four triples: 3/5 gives sin 4/5. */
const PYTH_COSINES: [number, number, number][] = [[3, 4, 5], [4, 3, 5], [5, 12, 13], [12, 5, 13], [8, 15, 17], [15, 8, 17], [7, 24, 25], [24, 7, 25]]

export interface ExactArea {
  b: number
  c: number
  /** cos = p/q (p may be negative), sin = s/q. */
  p: number
  s: number
  q: number
  area: number
}

/**
 * Two sides from 2 to 20 (product at most 200) and a cosine ±p/q with a rational sine s/q,
 * where the area ½bc·s/q is whole, at most 120, and none of the printed figures or the sine's
 * numerator.
 */
export const EXACT_AREAS: ExactArea[] = PYTH_COSINES.flatMap(([p0, s, q]) =>
  [p0, -p0].flatMap((p) => {
    const out: ExactArea[] = []
    for (let b = 2; b <= 20; b++)
      for (let c = b + 1; c <= 20; c++) {
        if (b * c > 200 || (b * c * s) % (2 * q) !== 0) continue
        const area = (b * c * s) / (2 * q)
        if (area > 120 || [b, c, p0, s, q].includes(area)) continue
        out.push({ b, c, p, s, q, area })
      }
    return out
  }),
)
/** Grouped by cosine, each weighted by the square root of its count. */
const AREA_GROUPS = [...new Set(EXACT_AREAS.map((x) => `${x.p}/${x.q}`))].map((key) => EXACT_AREAS.filter((x) => `${x.p}/${x.q}` === key))

function exactCosineArea(r: Rng, slot: Question): Draft {
  const group = weighted(r, AREA_GROUPS.map((g) => [g, Math.sqrt(g.length)] as const))
  const { b, c, p, s, q, area } = pick(r, group)
  const [s1, s2] = r() < 0.5 ? [b, c] : [c, b]
  const { V, l1, l2 } = letters(r)
  const u = pick(r, ['cm', 'cm', 'm'])
  const prompt = `In triangle $ABC$, $${l1} = ${s1}$ ${u}, $${l2} = ${s2}$ ${u} and $\\cos ${V} = ${cosPrinted(p, q)}$. Work out the area of the triangle.`
  const [lo, hi] = [Math.abs(p), s].sort((x, y) => x - y)
  const why = p < 0
    ? `Angle $${V}$ is obtuse, but its sine is still positive: the $${lo}, ${hi}, ${q}$ triangle gives $\\sin ${V} = \\frac{${s}}{${q}}$`
    : `Since $\\cos ${V} = \\frac{${p}}{${q}}$, the $${lo}, ${hi}, ${q}$ triangle gives $\\sin ${V} = \\frac{${s}}{${q}}$`
  const solution =
    `The area formula needs $\\sin ${V}$. ${why} (or $\\sin^2 ${V} = 1 - \\frac{${p * p}}{${q * q}} = \\frac{${s * s}}{${q * q}}$). ` +
    `Area $= \\frac{1}{2} \\times ${s1} \\times ${s2} \\times \\frac{${s}}{${q}} = ${area}$ ${u}².`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [`sin ${V} = ${s}/${q}`], String(area)), answer: area, tolerance: 0 },
    check: (() => {
      // Second route: the triangle on coordinates at the printed cosine, the shoelace area.
      const tri = exactTriangle(prompt)
      const shoelace = Math.abs(tri.near[0] * tri.far[1] - tri.near[1] * tri.far[0]) / 2
      return { agrees: near(shoelace, area), detail: `sides ${tri.s1}, ${tri.s2} at cos ${tri.cos}: shoelace ${shoelace}` }
    })(),
    values: { b, c, p, q, area, V },
  }
}

// ---------------------------------------------------------------------------------------
// q8: a cuboid's diagonal and the base. AB = 4, AD = 3, AE = 12, AG: 67.38°.
// ---------------------------------------------------------------------------------------

/** Each space diagonal, bottom end first: its shadow on the base, and the vertical edge that closes the triangle. */
export const SPACE_DIAGONALS = {
  AG: { shadow: 'AC', foot: 'C', vertical: 'CG' },
  BH: { shadow: 'BD', foot: 'D', vertical: 'DH' },
  CE: { shadow: 'CA', foot: 'A', vertical: 'AE' },
  DF: { shadow: 'DB', foot: 'B', vertical: 'BF' },
} as const
type Diagonal = keyof typeof SPACE_DIAGONALS
const ABOVE_ALL = 'with $E$, $F$, $G$, $H$ vertically above $A$, $B$, $C$, $D$'

/** Base edges with a whole diagonal: the triples with both legs up to 20. */
const BASE_TRIPLES = TRIPLES.filter(([x, y]) => x <= 20 && y <= 20)
/** The written cuboid, 4 by 3 by 12 high, kept for the written questions. */
const writtenCuboid = (a: number, b: number, h: number) => h === 12 && a * b === 12 && a + b === 7

function lineAndPlane(r: Rng, slot: Question): Draft {
  // A whole base diagonal half the time, as written; a surd one otherwise.
  const whole = r() < 0.5
  const { a, b, h } = draw(
    r,
    (r) => {
      const [x, y] = whole ? (pick(r, BASE_TRIPLES) as unknown as [number, number]) : [int(r, 2, 15), int(r, 2, 15)]
      const [a, b] = r() < 0.5 ? [x, y] : [y, x]
      return { a, b, h: int(r, 2, 25) }
    },
    ({ a, b, h }) => {
      const n = a * a + b * b
      const t = Math.atan2(h, Math.sqrt(n)) / RAD
      return a !== b && isSquare(n) === whole && h !== a && h !== b && h * h !== n && t >= 12 && t <= 78 && roundsCleanly(t) && !writtenCuboid(a, b, h)
    },
  )
  const diag = pick(r, Object.keys(SPACE_DIAGONALS) as Diagonal[])
  const { shadow, foot, vertical } = SPACE_DIAGONALS[diag]
  const width = pick(r, ['AD', 'BC'])
  const height = pick(r, ['AE', 'BF', 'CG', 'DH'])
  const above = r() < 0.5 ? `with $${diag[1]}$ vertically above $${foot}$` : ABOVE_ALL
  const u = pick(r, ['cm', 'cm', 'm'])
  const n = a * a + b * b
  const theta = Math.atan2(h, Math.sqrt(n)) / RAD
  const answer = roundTo(theta, 2)
  const prompt = `In the cuboid $ABCDEFGH$, $AB = ${a}$ ${u}, $${width} = ${b}$ ${u} and $${height} = ${h}$ ${u}, ${above}. Work out the angle between $${diag}$ and the base $ABCD$. ${TWO_DP}`
  const tri = `${diag[0]}${foot}${diag[1]}`
  const solution =
    `The shadow of $${diag}$ on the base is $${shadow} = \\sqrt{${a}^2 + ${b}^2} = ${rootTex(n)}$. ` +
    `In triangle $${tri}$, right-angled at $${foot}$: $\\tan \\theta = \\dfrac{${vertical}}{${shadow}} = \\dfrac{${h}}{${rootTex(n)}}$, so $\\theta = ${fixed(theta, 2)}°$.` +
    (isSquare(n) ? '' : keepExact(`$${shadow} = \\sqrt{${n}}$`, `it to $${fixed(Math.sqrt(n), 2)}$`, Math.atan(h / roundTo(Math.sqrt(n), 2)) / RAD, answer))
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [`${shadow} = ${rootText(n)}`, `tan θ = ${h}/${rootText(n)}`], fixed(theta, 2)),
      answer,
      tolerance: 0.005,
    },
    check: (() => {
      // Second route: the cuboid placed at the origin from the printed edges, the diagonal as a
      // vector, its angle with the horizontal by sin.
      const v = namedValues(prompt)
      const P = cuboidAt(v.AB!, v.AD ?? v.BC!, v.AE ?? v.BF ?? v.CG ?? v.DH!)
      const name = /between \$([A-H])([A-H])\$ and the base/.exec(prompt)!
      const measured = toBase(minus3(P[name[2]!]!, P[name[1]!]!))
      return { agrees: roundTo(measured, 2) === answer, detail: `${name[1]}${name[2]} as a vector from the corners: ${measured}°` }
    })(),
    values: { a, b, h, diag, whole: whole ? 'yes' : 'no' },
  }
}

// ---------------------------------------------------------------------------------------
// q11 and q12: a square-based pyramid, its face and its edge with the base. 6 and 4: 53.13°, 43.31°.
// ---------------------------------------------------------------------------------------

interface Pyramid {
  s: number
  h: number
  form: number
  u: string
}

/**
 * A pyramid in one of three settings: plain (cm or m), lettered VABCD (cm), or a tower roof in
 * metres (base 4 to 12, height 2 to 9). Never the written 6 and 4 or a pyramid of its shape
 * (12 and 8), whose angles are the written answers and whose slant height and sloping edge the
 * written q17 on the same sheet asks for.
 */
function pyramid(r: Rng, evenOnly: boolean, angle: (s: number, h: number) => number, other: (s: number, h: number) => number): Pyramid {
  const form = pick(r, [0, 0, 1, 2])
  const u = form === 2 ? 'm' : form === 1 ? 'cm' : pick(r, ['cm', 'cm', 'm'])
  const { s, h } = draw(
    r,
    (r) => {
      const s = form === 2 ? 2 * int(r, 2, 6) : evenOnly || r() < 0.7 ? 2 * int(r, 2, 10) : 2 * int(r, 2, 7) + 1
      return { s, h: form === 2 ? int(r, 2, 9) : int(r, 3, 20) }
    },
    ({ s, h }) => {
      const t = angle(s, h)
      // Not the written pyramid, not 45°, clear of a rounding boundary, and the other angle differs.
      // A pyramid, not a needle: the height at most twice the base edge.
      // Not the height equal to the edge either, which always gives 54.74° for the edge.
      return 3 * h !== 2 * s && 2 * h !== s && h !== s && h <= 2 * s && t >= 15 && t <= 80 && roundsCleanly(t) && Math.abs(other(s, h) - t) > 0.5
    },
  )
  return { s, h, form, u }
}

const faceAngle = (s: number, h: number) => Math.atan2(h, s / 2) / RAD
const edgeAngle = (s: number, h: number) => Math.atan2(h, s / Math.SQRT2) / RAD

function pyramidPrompt({ s, h, form, u }: Pyramid, face: boolean): string {
  if (form === 0) return `A square-based pyramid has base edges of $${s}$ ${u} and vertical height $${h}$ ${u}. Work out the angle between a sloping ${face ? 'face' : 'edge'} and the base. ${TWO_DP}`
  if (form === 1)
    return `The pyramid $VABCD$ has a square base $ABCD$ with $AB = ${s}$ ${u}, and its apex $V$ is $${h}$ ${u} vertically above the centre of the base. Work out the angle between ${face ? 'the face $VAB$' : 'the edge $VA$'} and the base. ${TWO_DP}`
  return `The roof of a tower is a square-based pyramid with base edges of $${s}$ m and vertical height $${h}$ m. Work out the angle between a sloping ${face ? 'face' : 'edge'} of the roof and the horizontal. ${TWO_DP}`
}

/** Base corners A(0, 0, 0), B(s, 0, 0), C(s, s, 0), D(0, s, 0) and the apex V over the centre. */
function pyramidAt(prompt: string) {
  const [s, h] = printedNumbers(prompt) as [number, number]
  return { s, h, A: [0, 0, 0] as V3, B: [s, 0, 0] as V3, V: [s / 2, s / 2, h] as V3 }
}

function faceAndBase(r: Rng, slot: Question): Draft {
  const pyr = pyramid(r, false, faceAngle, edgeAngle)
  const { s, h, u } = pyr
  const theta = faceAngle(s, h)
  const answer = roundTo(theta, 2)
  const half = show(s / 2)
  const prompt = pyramidPrompt(pyr, true)
  const solution =
    `From the centre of the base to the midpoint of an edge is $${half}$ ${u}. The triangle from that midpoint up the face to the apex has height $${h}$ and base $${half}$, ` +
    `so $\\tan \\theta = \\frac{${h}}{${half}}$ and $\\theta = ${fixed(theta, 2)}°$. The two lines are both perpendicular to the base edge, as the angle between planes requires.`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [`the triangle with ${half} and ${h}, from the midpoint of an edge`], fixed(theta, 2)), answer, tolerance: 0.005 },
    check: (() => {
      // Second route: the face's normal from a cross product, against the base's normal (0, 0, 1).
      const { A, B, V } = pyramidAt(prompt)
      const normal = cross3(minus3(B, A), minus3(V, A))
      const measured = Math.acos(Math.abs(normal[2]) / len3(normal)) / RAD
      return { agrees: roundTo(measured, 2) === answer, detail: `normal to face VAB (${normal.map((x) => x.toFixed(3)).join(', ')}): ${measured}°` }
    })(),
    values: { s, h, form: pyr.form },
  }
}

function edgeAndBase(r: Rng, slot: Question): Draft {
  const pyr = pyramid(r, true, edgeAngle, faceAngle)
  const { s, h } = pyr
  const k = s / 2
  const theta = edgeAngle(s, h)
  const answer = roundTo(theta, 2)
  const prompt = pyramidPrompt(pyr, false)
  const solution =
    `A sloping edge runs from a corner of the base to the apex. Its shadow is from the corner to the centre, half the base diagonal: $\\frac{1}{2}\\sqrt{${s}^2 + ${s}^2} = ${k}\\sqrt{2}$. ` +
    `So $\\tan \\theta = \\dfrac{${h}}{${k}\\sqrt{2}}$ and $\\theta = ${fixed(theta, 2)}°$, smaller than the face angle because the edge has further to travel.` +
    keepExact(`$${k}\\sqrt{2}$`, `it to $${fixed(k * Math.SQRT2, 2)}$`, Math.atan(h / roundTo(k * Math.SQRT2, 2)) / RAD, answer)
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [`half the diagonal, ${k}√2`, `tan θ = ${h}/(${k}√2)`], fixed(theta, 2)),
      answer,
      tolerance: 0.005,
    },
    check: (() => {
      // Second route: the edge VA as a vector from the corners, its angle with the horizontal by sin.
      const { A, V } = pyramidAt(prompt)
      const measured = toBase(minus3(V, A))
      return { agrees: roundTo(measured, 2) === answer, detail: `VA as a vector: ${measured}°` }
    })(),
    values: { s, h, form: pyr.form },
  }
}

// ---------------------------------------------------------------------------------------
// q16: a triangle in a cuboid with no right angle. AB = 4, BC = 3, BF = 12, angle CAF: 75.35°.
// ---------------------------------------------------------------------------------------

/** Triangle ACF: the angle asked, at which vertex, and the sides either side and opposite. */
export const ACF_ANGLES = {
  CAF: { at: 'A', sides: ['AC', 'AF'], opposite: 'CF' },
  ACF: { at: 'C', sides: ['AC', 'CF'], opposite: 'AF' },
  AFC: { at: 'F', sides: ['AF', 'CF'], opposite: 'AC' },
} as const
type AcfAngle = keyof typeof ACF_ANGLES

function triangleInCuboid(r: Rng, slot: Question): Draft {
  // The written angle at A half the time; at C or at F otherwise.
  const ask = weighted(r, [['CAF', 2], ['ACF', 1], ['AFC', 1]] as const) as AcfAngle
  const { at, sides, opposite } = ACF_ANGLES[ask]
  const angleOf = (a: number, b: number, h: number) => {
    const P = cuboidAt(a, b, h)
    return angleAt3(P[ask[0]!]!, P[ask[1]!]!, P[ask[2]!]!)
  }
  const { a, b, h } = draw(
    r,
    (r) => ({ a: int(r, 2, 15), b: int(r, 2, 15), h: int(r, 2, 15) }),
    ({ a, b, h }) => new Set([a, b, h]).size === 3 && !writtenCuboid(a, b, h) && roundsCleanly(angleOf(a, b, h)) && angleOf(a, b, h) >= 15,
  )
  const sq: Record<string, number> = { AC: a * a + b * b, AF: a * a + h * h, CF: b * b + h * h }
  const [s1, s2] = sides
  const num = sq[s1]! + sq[s2]! - sq[opposite]!
  // 2 × √X × √Y with the whole roots gathered into the number in front: 2 × 5 × √160 = 10√160.
  const roots = [sq[s1]!, sq[s2]!]
  const coef = 2 * roots.filter(isSquare).reduce((p, x) => p * Math.sqrt(x), 1)
  const surds = roots.filter((x) => !isSquare(x)).map((x) => `\\sqrt{${x}}`).join(' \\times ')
  // Each side rounded to two places before the cosine rule, as a student keying lengths would.
  const len = (x: number) => (isSquare(x) ? Math.sqrt(x) : roundTo(Math.sqrt(x), 2))
  const [r1, r2, ro] = [len(sq[s1]!), len(sq[s2]!), len(sq[opposite]!)]
  const early = Math.acos((r1 * r1 + r2 * r2 - ro * ro) / (2 * r1 * r2)) / RAD
  const theta = angleOf(a, b, h)
  const answer = roundTo(theta, 2)
  const u = pick(r, ['cm', 'cm', 'm'])
  const above = r() < 0.5 ? 'with $F$ vertically above $B$' : ABOVE_ALL
  const prompt = `In the cuboid $ABCDEFGH$, $AB = ${a}$ ${u}, $BC = ${b}$ ${u} and $BF = ${h}$ ${u}, ${above}. Work out the angle $${ask}$. ${TWO_DP}`
  const solution =
    `Triangle $ACF$ has no right angle, so find its sides: $AC^2 = ${a}^2 + ${b}^2 = ${sq.AC}$, $AF^2 = ${a}^2 + ${h}^2 = ${sq.AF}$ and $CF^2 = ${b}^2 + ${h}^2 = ${sq.CF}$. ` +
    `Cosine rule for the angle at $${at}$, opposite $${opposite}$: $\\cos ${at} = \\dfrac{${sq[s1]} + ${sq[s2]} - ${sq[opposite]}}{2 \\times ${rootTex(sq[s1]!)} \\times ${rootTex(sq[s2]!)}} = \\dfrac{${num}}{${coef}${surds}}$, so $${at} = ${fixed(theta, 2)}°$.` +
    keepExact('the square roots', 'the sides to two decimal places', early, answer)
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [`AC² = ${sq.AC}, AF² = ${sq.AF} and CF² = ${sq.CF}`, `cosine rule for angle ${at}`], fixed(theta, 2)),
      answer,
      tolerance: 0.005,
    },
    check: (() => {
      // Second route: the corners from the printed edges, the angle by the dot product; and the
      // printed final fraction read back must give the same angle.
      const v = namedValues(prompt)
      const P = cuboidAt(v.AB!, v.BC!, v.BF!)
      const name = /the angle \$([A-H]{3})\$/.exec(prompt)![1]!
      const measured = angleAt3(P[name[0]!]!, P[name[1]!]!, P[name[2]!]!)
      const printed = Math.acos(evalTex(/= (\\dfrac\{\d+\}\{[^$]+\})\$, so/.exec(solution)![1]!)) / RAD
      return { agrees: roundTo(measured, 2) === answer && near(printed, measured), detail: `angle ${name} by the dot product ${measured}°, printed fraction ${printed}°` }
    })(),
    values: { a, b, h, ask },
  }
}

/** Angle PQR in degrees from the vectors QP and QR, in 3D. */
function angleAt3(p: V3, q: V3, r: V3): number {
  const u = minus3(p, q)
  const w = minus3(r, q)
  return Math.acos(dot3(u, w) / (len3(u) * len3(w))) / RAD
}

export const pythagorasGenerators: Generator[] = [
  fmBySlot('fm-pythagoras-triples', TOPIC, { q1: hypotenuse, q3: cuboidDiagonal }),
  fmBySlot('fm-sine-and-cosine-rules', TOPIC, { q4: areaFormula, q5: sineRuleSide, q6: cosineRuleSide, q7: largestAngle, q9: exactCosineSide, q14: exactCosineArea }),
  fmBySlot('fm-trigonometry-in-3d', TOPIC, { q8: lineAndPlane, q11: faceAndBase, q12: edgeAndBase, q16: triangleInCuboid }),
]
