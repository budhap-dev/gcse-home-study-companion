import type { Question } from '../../content/questions.ts'
import { clearOfHalf, fixed, roundTo, show } from '../format.ts'
import { draw, int, pick, shuffle, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'
import { RAD, angleAt, dist, meet, polar, sameAngle, triple, type Pt } from './angles.ts'
import { bySlot } from './formulae.ts'

const sinD = (x: number) => Math.sin(x * RAD)
const cosD = (x: number) => Math.cos(x * RAD)
const tanD = (x: number) => Math.tan(x * RAD)
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b))

/** The written slot's tolerance, never more than 2% of the answer. */
function tolerance(slot: Question, answer: number): number {
  const t = slot.type === 'numeric' ? slot.tolerance : 0
  return Math.min(t, Math.floor(Math.abs(answer) * 0.02 * 1e4) / 1e4)
}

/** A length in tenths, printed: 35 is 3.5, 40 is 4. */
const tenthsText = (t: number) => show(t / 10)
/** The square of a length held in tenths, printed exactly: 15 (1.5) gives 2.25. */
const squareOfTenths = (t: number) => show((t * t) / 100)

/** The largest k with k² dividing n. */
export function largestSquareFactor(n: number): number {
  let best = 1
  for (let k = 2; k * k <= n; k++) if (n % (k * k) === 0) best = k
  return best
}
const isSquare = (n: number) => Number.isInteger(Math.sqrt(n))

/* ------------------------------------------------------------------------------------------
 * Pythagoras in 2D. The second method is trigonometry: the angle from two sides, then the
 * asked side from that angle, never the sum of squares the question uses.
 * ---------------------------------------------------------------------------------------- */

const PY2 = 'pythagoras-in-2d'

/** The hypotenuse from the legs, by an angle: tan for the angle, cos for the side. */
const hypByTrig = (a: number, b: number) => a / Math.cos(Math.atan2(b, a))
/** A leg from the hypotenuse and the other leg, by sin then cos. */
const legByTrig = (c: number, a: number) => c * Math.cos(Math.asin(a / c))

const UNITS = ['cm', 'cm', 'm', 'mm']

/** The hypotenuse, a whole number: written as q2. */
function hypotenuseWhole(r: Rng, slot: Question): Draft {
  const [a, b, c] = triple(r, 65)
  const unit = pick(r, UNITS)
  const prompt = r() < 0.5
    ? `A right-angled triangle has shorter sides ${a} ${unit} and ${b} ${unit}. Find the hypotenuse, in ${unit}.`
    : `The two shorter sides of a right-angled triangle are ${a} ${unit} and ${b} ${unit}. Find the length of the hypotenuse, in ${unit}.`
  const other = hypByTrig(a, b)
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `$${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${c * c}$, and $\\sqrt{${c * c}} = ${c}$ ${unit}.`,
      markScheme: scheme(slot, [`reaches ${c * c}`], String(c)),
      answer: c,
      tolerance: 0,
      units: unit,
    },
    check: { agrees: near(other, c), detail: `angle ${(Math.atan2(b, a) / RAD).toFixed(4)}°, ${a} ÷ cos = ${other.toFixed(6)}` },
    values: { a, b, c },
  }
}

/** A shorter side, a whole number: written as q3. */
function shorterWhole(r: Rng, slot: Question): Draft {
  const [a, b, c] = triple(r, 65)
  const unit = pick(r, UNITS)
  const prompt = r() < 0.5
    ? `A right-angled triangle has hypotenuse ${c} ${unit} and one shorter side ${a} ${unit}. Find the third side, in ${unit}.`
    : `The hypotenuse of a right-angled triangle is ${c} ${unit} and one of the other sides is ${a} ${unit}. Find the third side, in ${unit}.`
  const other = legByTrig(c, a)
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `The hypotenuse is known, so **subtract**: $${c * c} - ${a * a} = ${b * b}$, and $\\sqrt{${b * b}} = ${b}$ ${unit}.`,
      markScheme: scheme(slot, [`subtracts to reach ${b * b}`], String(b)),
      answer: b,
      tolerance: 0,
      units: unit,
    },
    check: { agrees: near(other, b) && b < c, detail: `angle ${(Math.asin(a / c) / RAD).toFixed(4)}°, ${c} cos = ${other.toFixed(6)}` },
    values: { a, b, c },
  }
}

/** A length in tenths: mostly whole, sometimes one decimal place. */
const lengthTenths = (r: Rng, lo: number, hi: number, decimals = 0.3) => (r() < decimals ? int(r, lo * 10, hi * 10) : 10 * int(r, lo, hi))

/** The hypotenuse to 2 decimal places: written as q5 (3 marks). */
function hypotenuseRounded(r: Rng, slot: Question): Draft {
  const { a, b, s } = draw(
    r,
    (r) => {
      const a = lengthTenths(r, 2, 25)
      const b = lengthTenths(r, 2, 25)
      return { a, b, s: (a * a + b * b) / 100 }
    },
    ({ a, b, s }) => a !== b && !isSquare(a * a + b * b) && clearOfHalf(Math.sqrt(s), 2),
  )
  const c = Math.sqrt(s)
  const unit = pick(r, ['cm', 'm'])
  const word = unit === 'm' ? 'metres' : 'cm'
  const other = hypByTrig(a / 10, b / 10)
  return {
    question: {
      type: 'numeric',
      prompt: `A right-angled triangle has shorter sides ${tenthsText(a)} ${unit} and ${tenthsText(b)} ${unit}. Find the hypotenuse in ${word}, to 2 decimal places.`,
      solution: `$${tenthsText(a)}^2 + ${tenthsText(b)}^2 = ${squareOfTenths(a)} + ${squareOfTenths(b)} = ${show(s)}$, so $c = \\sqrt{${show(s)}} = ${fixed(c, 2)}$ ${unit}. Keep the full value on the calculator and round only at the end.`,
      markScheme: scheme(slot, ['adds the squares', `reaches √${show(s)}`], fixed(c, 2)),
      answer: roundTo(c, 2),
      tolerance: 0.01,
      units: unit,
    },
    check: { agrees: roundTo(other, 2) === roundTo(c, 2), detail: `by tan then cos: ${other.toFixed(6)}` },
    values: { a: tenthsText(a), b: tenthsText(b) },
  }
}

const SLOPES = [
  { thing: 'ladder', find: 'height' },
  { thing: 'ladder', find: 'foot' },
  { thing: 'rope', find: 'foot' },
  { thing: 'ramp', find: 'height' },
] as const

/** A leaning ladder and its relatives, the hypotenuse known: written as q6 (3 marks). */
function ladder(r: Rng, slot: Question, turn: number): Draft {
  const s = SLOPES[turn % SLOPES.length]!
  const { L, k } = draw(
    r,
    (r) => {
      const L = lengthTenths(r, 3, 12, 0.5)
      // A ladder stands steep: its foot within half its length of the wall, so reaching most of
      // its length up it. A ramp lies shallow. A rope from a pole top can be at any angle. Drawn
      // at any angle, one ladder 8.9 m long reached 3 m up a wall (8 October 2026).
      const [lo, hi] = s.thing === 'ladder' ? (s.find === 'height' ? [0.25, 0.5] : [0.7, 0.9]) : s.thing === 'ramp' ? [0.75, 0.95] : [0.3, 0.8]
      return { L, k: int(r, Math.ceil(L * lo), Math.floor(L * hi)) }
    },
    ({ L, k }) => k % 5 === 0 && k < L && !isSquare(L * L - k * k) && clearOfHalf(Math.sqrt(L * L - k * k) / 10, 2),
  )
  const sq = (L * L - k * k) / 100
  const ans = Math.sqrt(sq)
  const Lt = tenthsText(L)
  const kt = tenthsText(k)
  let prompt: string
  if (s.thing === 'ladder' && s.find === 'height') prompt = `A ladder ${Lt} m long leans against a wall with its foot ${kt} m from the base of the wall. How far up the wall does it reach, in metres to 2 decimal places?`
  else if (s.thing === 'ladder') prompt = `A ladder ${Lt} m long leans against a vertical wall and reaches ${kt} m up it. How far is the foot of the ladder from the base of the wall, in metres to 2 decimal places?`
  else if (s.thing === 'rope') prompt = `A rope ${Lt} m long is pulled tight from the top of a vertical pole ${kt} m tall to a peg in the level ground. How far is the peg from the foot of the pole, in metres to 2 decimal places?`
  else prompt = `A straight ramp ${Lt} m long runs from the ground up to a platform, covering ${kt} m of level ground. How high is the platform, in metres to 2 decimal places?`
  const why = s.thing === 'ladder'
    ? 'The **ladder** is the hypotenuse, since the right angle is between wall and ground.'
    : s.thing === 'rope'
      ? 'The **rope** is the hypotenuse, since the right angle is between the pole and the ground.'
      : 'The **ramp** is the hypotenuse, since the right angle is between the platform and the ground.'
  const other = legByTrig(L / 10, k / 10)
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `${why} So **subtract**: $${squareOfTenths(L)} - ${squareOfTenths(k)} = ${show(sq)}$, and $\\sqrt{${show(sq)}} = ${fixed(ans, 2)}$ m. The answer must be less than ${Lt} m, and it is.`,
      markScheme: scheme(slot, [`identifies the ${s.thing} as the hypotenuse`, `subtracts to reach ${show(sq)}`], fixed(ans, 2)),
      answer: roundTo(ans, 2),
      tolerance: 0.01,
      units: 'm',
    },
    check: { agrees: roundTo(other, 2) === roundTo(ans, 2) && ans < L / 10, detail: `angle at the ground by sin, then cos: ${other.toFixed(6)}` },
    values: { context: `${s.thing} ${s.find}`, L: Lt, k: kt },
  }
}

/** A shorter side to 2 decimal places: written as q8 (3 marks). */
function shorterRounded(r: Rng, slot: Question): Draft {
  const { c, a } = draw(
    r,
    (r) => {
      const c = lengthTenths(r, 5, 30)
      return { c, a: lengthTenths(r, 2, Math.floor(c / 10) - 1) }
    },
    ({ c, a }) => a < c && a > 0 && !isSquare(c * c - a * a) && clearOfHalf(Math.sqrt(c * c - a * a) / 10, 2),
  )
  const sq = (c * c - a * a) / 100
  const b = Math.sqrt(sq)
  const unit = pick(r, ['cm', 'cm', 'm'])
  const other = legByTrig(c / 10, a / 10)
  return {
    question: {
      type: 'numeric',
      prompt: `A right-angled triangle has hypotenuse ${tenthsText(c)} ${unit} and one shorter side ${tenthsText(a)} ${unit}. Find the third side in ${unit}, to 2 decimal places.`,
      solution: `$${squareOfTenths(c)} - ${squareOfTenths(a)} = ${show(sq)}$, so the side is $\\sqrt{${show(sq)}} = ${fixed(b, 2)}$ ${unit}. It must be less than the hypotenuse ${tenthsText(c)}, and it is.`,
      markScheme: scheme(slot, [`subtracts to reach ${show(sq)}`, 'takes the square root'], fixed(b, 2)),
      answer: roundTo(b, 2),
      tolerance: 0.01,
      units: unit,
    },
    check: { agrees: roundTo(other, 2) === roundTo(b, 2), detail: `by sin then cos: ${other.toFixed(6)}` },
    values: { c: tenthsText(c), a: tenthsText(a) },
  }
}

const paren = (n: number) => (n < 0 ? `(${n})` : String(n))

/** The distance between two points: written as q10 (3 marks). */
function pointDistance(r: Rng, slot: Question): Draft {
  const { p, q } = draw(
    r,
    (r) => ({ p: [int(r, -8, 12), int(r, -8, 12)] as const, q: [int(r, -8, 12), int(r, -8, 12)] as const }),
    ({ p, q }) => {
      const dx = q[0] - p[0]
      const dy = q[1] - p[1]
      return dx !== 0 && dy !== 0 && !isSquare(dx * dx + dy * dy) && clearOfHalf(Math.hypot(dx, dy), 2)
    },
  )
  const dx = q[0] - p[0]
  const dy = q[1] - p[1]
  const n = dx * dx + dy * dy
  const d = Math.sqrt(n)
  // Second route: the direction of the line from its angle, then the length from one component.
  const other = Math.abs(dx) / Math.abs(Math.cos(Math.atan2(dy, dx)))
  return {
    question: {
      type: 'numeric',
      prompt: `Find the distance between the points $(${p[0]}, ${p[1]})$ and $(${q[0]}, ${q[1]})$, to 2 decimal places.`,
      solution: `The differences are $${q[0]} - ${paren(p[0])} = ${dx}$ across and $${q[1]} - ${paren(p[1])} = ${dy}$ up. So the distance is $\\sqrt{${paren(dx)}^2 + ${paren(dy)}^2} = \\sqrt{${n}} = ${fixed(d, 2)}$. **Subtract the coordinates first, then square**: squaring the coordinates themselves is the standard error.`,
      markScheme: scheme(slot, [`finds the differences ${dx} and ${dy}`, `reaches √${n}`], fixed(d, 2)),
      answer: roundTo(d, 2),
      tolerance: 0.01,
    },
    check: { agrees: roundTo(other, 2) === roundTo(d, 2), detail: `|dx| ÷ cos of the line's angle: ${other.toFixed(6)}` },
    values: { p: p.join(','), q: q.join(',') },
  }
}

/** Heron's formula: the area from three sides, with no angle and no right angle. */
export function heron(a: number, b: number, c: number): number {
  const s = (a + b + c) / 2
  return Math.sqrt(s * (s - a) * (s - b) * (s - c))
}

/** The height of an isosceles triangle: written as q12 (4 marks). */
function isoscelesHeight(r: Rng, slot: Question): Draft {
  const [h, H, s] = triple(r, 65)
  const base = 2 * h
  const unit = pick(r, ['cm', 'cm', 'm', 'mm'])
  // A tent or a roof only at the size of a tent or a roof: the triple is drawn first.
  const prompt = pick(r, [
    `An isosceles triangle has two sides of ${s} ${unit} and a base of ${base} ${unit}. Find its height, in ${unit}.`,
    ...(unit === 'm' && s <= 6 ? [`The end of a tent is an isosceles triangle with sloping sides of ${s} ${unit} and a base of ${base} ${unit}. Find its height, in ${unit}.`] : []),
    ...(unit === 'm' && s <= 15 ? [`A roof truss is an isosceles triangle with equal sides of ${s} ${unit} and a base of ${base} ${unit}. Find its height, in ${unit}.`] : []),
  ])
  // Second route: Heron's formula for the area, then height = 2 × area ÷ base.
  const other = (2 * heron(s, s, base)) / base
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `There is no right angle marked, so **make one**: drop a perpendicular from the apex to the **midpoint** of the base. That gives a right-angled triangle with hypotenuse ${s} and base $${base} \\div 2 = ${h}$. Then $h = \\sqrt{${s * s} - ${h * h}} = \\sqrt{${H * H}} = ${H}$ ${unit}.`,
      markScheme: scheme(slot, ['drops a perpendicular to the base', `uses half the base, ${h}`, `subtracts to reach ${H * H}`], String(H)),
      answer: H,
      tolerance: 0,
      units: unit,
    },
    check: { agrees: near(other, H) && 2 * s > base, detail: `Heron's area ${heron(s, s, base).toFixed(4)}, so height ${other.toFixed(6)}` },
    values: { s, base, H },
  }
}

/** Each setting with the sizes it comes in: a field is tens of metres, a gate a few; a 63 m gate was drawn once. */
const RECTANGLES: { text: (a: number, b: number, u: string) => string; fits: (a: number, b: number, u: string) => boolean }[] = [
  { text: (a, b, u) => `A rectangle is ${a} ${u} by ${b} ${u}. Find the length of its diagonal, in ${u}.`, fits: () => true },
  { text: (a, b, u) => `A rectangular field is ${a} ${u} long and ${b} ${u} wide. A path runs straight across it from one corner to the opposite corner. How long is the path, in ${u}?`, fits: (a, b, u) => u === 'm' && Math.min(a, b) >= 20 },
  { text: (a, b, u) => `A rectangular gate is ${a} ${u} wide and ${b} ${u} tall, with a diagonal brace from one corner to the opposite corner. How long is the brace, in ${u}?`, fits: (a, b, u) => (u === 'm' && Math.max(a, b) <= 5) || (u === 'cm' && Math.min(a, b) >= 50) },
  { text: (a, b, u) => `A rectangular screen is ${a} ${u} wide and ${b} ${u} high. Find the length of its diagonal, in ${u}.`, fits: (a, b, u) => u === 'cm' && Math.min(a, b) >= 20 },
]

/** The diagonal of a rectangle: written as q16 (3 marks). */
function rectangleDiagonal(r: Rng, slot: Question): Draft {
  const [a, b, c] = triple(r, 100, 10)
  const unit = pick(r, ['cm', 'm'])
  const other = hypByTrig(a, b)
  return {
    question: {
      type: 'numeric',
      prompt: pick(r, RECTANGLES.filter((x) => x.fits(a, b, unit))).text(a, b, unit),
      solution: `The diagonal splits the rectangle into two right-angled triangles with legs ${a} and ${b}, and the diagonal is the hypotenuse of each. $${a * a} + ${b * b} = ${c * c}$, so the diagonal is $\\sqrt{${c * c}} = ${c}$ ${unit}.`,
      markScheme: scheme(slot, ['identifies the diagonal as a hypotenuse', `reaches ${c * c}`], String(c)),
      answer: c,
      tolerance: 0,
      units: unit,
    },
    check: { agrees: near(other, c), detail: `angle of the diagonal, then ${a} ÷ cos: ${other.toFixed(6)}` },
    values: { a, b, c },
  }
}

/** Two sides of a right-angled triangle whose third side is √n, with n as asked. */
function surdSides(r: Rng, simplest: boolean, add: boolean) {
  return draw(
    r,
    (r) => {
      if (add) {
        const a = int(r, 2, simplest ? 20 : 15)
        const b = int(r, 2, simplest ? 20 : 15)
        return { a, b, n: a * a + b * b }
      }
      const c = int(r, 4, 20)
      const a = int(r, 2, c - 1)
      return { a, b: c, n: c * c - a * a }
    },
    ({ a, b, n }) => a !== b && !isSquare(n) && n <= 600 && (simplest ? largestSquareFactor(n) > 1 : largestSquareFactor(n) === 1),
  )
}

/** The hypotenuse (or a leg) in surd form: written as q19 (2 marks, no square factor) and q20 (3 marks, simplest form). */
function surdForm(r: Rng, slot: Question, turn: number): Draft {
  const simplest = slot.id === 'q20'
  const add = turn % 3 !== 2
  const { a, b, n } = surdSides(r, simplest, add)
  const unit = pick(r, ['cm', 'cm', 'm'])
  const k = largestSquareFactor(n)
  const m = n / (k * k)
  const form = simplest ? `${k}√${m}` : `√${n}`
  const ask = simplest ? 'Give your answer as a surd in its simplest form.' : 'Give your answer in surd form.'
  const prompt = add
    ? `A right-angled triangle has shorter sides ${a} ${unit} and ${b} ${unit}. Find the ${simplest ? 'hypotenuse' : 'length of the hypotenuse'}. ${ask}`
    : `A right-angled triangle has hypotenuse ${b} ${unit} and one shorter side ${a} ${unit}. Find the length of the third side. ${ask}`
  const first = add ? `c^2 = ${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${n}` : `x^2 = ${b}^2 - ${a}^2 = ${b * b} - ${a * a} = ${n}`
  const letter = add ? 'c' : 'x'
  const solution = simplest
    ? `$${first}$, so $${letter} = \\sqrt{${n}}$. That is not simplest form: $${n} = ${k * k} \\times ${m}$, and ${k * k} is a square, so $\\sqrt{${n}} = \\sqrt{${k * k}}\\sqrt{${m}} = $ **${form}** ${unit}. Stopping at $\\sqrt{${n}}$ loses the final mark, because the question said simplest form.`
    : `$${first}$, so $${letter} = $ **${form}** ${unit}. Surd form means leaving the root: ${n} has no square factor, so $\\sqrt{${n}}$ is already as simple as it gets, and ${fixed(Math.sqrt(n), 2)} would throw the accuracy mark away.`
  const method = simplest
    ? [`reaches √${n}`, `takes out the square factor ${k * k}`]
    : [add ? `adds the squares to ${n}` : `subtracts the squares to ${n}`]
  // Second route: the side by trigonometry, against the surd read as a number.
  const side = add ? a / Math.cos(Math.atan2(b, a)) : b * Math.cos(Math.asin(a / b))
  return {
    question: { type: 'short-text', prompt, solution, markScheme: scheme(slot, method, form), accepted: [form, `${form} ${unit}`] },
    check: { agrees: near(k * Math.sqrt(m), side) && largestSquareFactor(m) === 1 && (simplest ? k > 1 : k === 1), detail: `${form} = ${(k * Math.sqrt(m)).toFixed(6)}; by trigonometry ${side.toFixed(6)}` },
    values: { a, b, n, k, m, add: add ? 'add' : 'subtract' },
  }
}

export const pythagoras2d = bySlot('pythagoras-2d', PY2, {
  q2: hypotenuseWhole,
  q3: shorterWhole,
  q5: hypotenuseRounded,
  q6: ladder,
  q8: shorterRounded,
  q10: pointDistance,
  q12: isoscelesHeight,
  q16: rectangleDiagonal,
})
export const pythagorasSurds = bySlot('pythagoras-surds', PY2, { q19: surdForm, q20: surdForm })

/* ------------------------------------------------------------------------------------------
 * Pythagoras and trigonometry in 3D. The second method takes the angle with the base by one
 * ratio and the length by another, or measures from coordinates.
 * ---------------------------------------------------------------------------------------- */

const PY3 = 'pythagoras-in-3d'
const TRIG3 = 'trigonometry-in-3d'

/** Cuboids a × b × c (2 to 24) whose space diagonal is a whole number. */
export const QUADRUPLES: readonly (readonly [number, number, number, number])[] = (() => {
  const out: [number, number, number, number][] = []
  for (let a = 2; a <= 24; a++)
    for (let b = a; b <= 24; b++)
      for (let c = b; c <= 24; c++) {
        const d = Math.sqrt(a * a + b * b + c * c)
        if (Number.isInteger(d)) out.push([a, b, c, d])
      }
  return out
})()

/** The space diagonal by trigonometry: the angle with the base from tan, then the length from sin. */
const spaceByTrig = (a: number, b: number, c: number) => c / Math.sin(Math.atan2(c, Math.hypot(a, b)))

const BOXES = [
  (d: string, u: string) => `A cuboid measures ${d}. What is its space diagonal, in ${u}?`,
  (d: string, u: string) => `A box measures ${d}. What is the length of the longest straight rod that fits inside it, in ${u}?`,
  (d: string, u: string) => `A block of wood is a cuboid measuring ${d}. How long is the straight line from one corner to the opposite corner, through the block, in ${u}?`,
]
const dims = (xs: number[], u: string) => `${xs.slice(0, -1).map((x) => `${x} ${u}`).join(' by ')} by ${xs.at(-1)} ${u}`

/** A whole-number space diagonal: written as q5, q7 and q9, all on the higher sheet. */
function spaceDiagonalWhole(r: Rng, slot: Question, turn: number): Draft {
  const [a, b, c, d] = pick(r, QUADRUPLES)
  const sides = shuffle(r, [a, b, c])
  const context = turn % BOXES.length
  const unit = context === 0 ? pick(r, ['cm', 'cm', 'm']) : 'cm'
  const other = spaceByTrig(sides[0]!, sides[1]!, sides[2]!)
  const sq = sides.map((x) => x * x)
  return {
    question: {
      type: 'numeric',
      prompt: BOXES[context]!(dims(sides, unit), unit),
      solution: `$${sq.join(' + ')} = ${d * d}$, so $d = \\sqrt{${d * d}} = ${d}$ ${unit}.`,
      markScheme: scheme(slot, ['squares and adds', 'takes the root'], `${d} ${unit}`),
      answer: d,
      tolerance: tolerance(slot, d),
      units: unit,
    },
    check: { agrees: near(other, d), detail: `angle with the base by tan, length by sin: ${other.toFixed(6)}` },
    values: { sides: sides.join('x'), d, context },
  }
}

/** The diagonal of the base: written as q6 (2 marks). */
function baseDiagonal(r: Rng, slot: Question): Draft {
  const [a, b, c] = triple(r, 65)
  const unit = pick(r, ['cm', 'cm', 'm'])
  const h = int(r, 2, 30)
  const prompt = r() < 0.5
    ? `A cuboid has a base ${a} ${unit} by ${b} ${unit}. What is the diagonal of its base, in ${unit}?`
    : `A cuboid is ${a} ${unit} long, ${b} ${unit} wide and ${h} ${unit} tall. What is the diagonal of its base, in ${unit}?`
  const other = hypByTrig(a, b)
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `The base is a rectangle, so its diagonal is the hypotenuse of a right-angled triangle with legs ${a} and ${b}: $\\sqrt{${a * a} + ${b * b}} = \\sqrt{${c * c}} = ${c}$ ${unit}.${prompt.includes('tall') ? ' The height plays no part.' : ''}`,
      markScheme: scheme(slot, ['uses Pythagoras on the base'], `${c} ${unit}`),
      answer: c,
      tolerance: tolerance(slot, c),
      units: unit,
    },
    check: { agrees: near(other, c), detail: `angle of the diagonal, then ${a} ÷ cos: ${other.toFixed(6)}` },
    values: { a, b, c },
  }
}

/** The third edge from the space diagonal: written as q11 (3 marks). */
function thirdEdge(r: Rng, slot: Question): Draft {
  const [a, b, c, d] = pick(r, QUADRUPLES)
  const [x, y, z] = shuffle(r, [a, b, c]) as [number, number, number]
  const unit = pick(r, ['cm', 'cm', 'm'])
  // Second route: the diagonal makes an angle with the face holding x and y; the third edge is d sin of it.
  const phi = Math.acos(Math.hypot(x, y) / d)
  const other = d * Math.sin(phi)
  return {
    question: {
      type: 'numeric',
      prompt: `A cuboid has a space diagonal of ${d} ${unit} and edges of ${x} ${unit} and ${y} ${unit}. What is the third edge, in ${unit}?`,
      solution: `$${d}^2 = ${x}^2 + ${y}^2 + c^2$: $${d * d} = ${x * x} + ${y * y} + c^2$, so $c^2 = ${z * z}$ and $c = ${z}$ ${unit}.`,
      markScheme: scheme(slot, ['substitutes into the formula', 'rearranges'], `${z} ${unit}`),
      answer: z,
      tolerance: tolerance(slot, z),
      units: unit,
    },
    check: { agrees: near(other, z), detail: `angle with the ${x} by ${y} face ${(phi / RAD).toFixed(4)}°, d sin = ${other.toFixed(6)}` },
    values: { d, x, y, z },
  }
}

/** A space diagonal to 1 decimal place: written as q12 (3 marks). */
function spaceDiagonalRounded(r: Rng, slot: Question): Draft {
  const sides = draw(
    r,
    (r) => [int(r, 2, 20), int(r, 2, 20), int(r, 2, 20)],
    (s) => {
      const n = s.reduce((t, x) => t + x * x, 0)
      return !isSquare(n) && clearOfHalf(Math.sqrt(n), 1)
    },
  )
  const n = sides.reduce((t, x) => t + x * x, 0)
  const d = Math.sqrt(n)
  // Metres only for something a few metres across, and a crate is a crate in tens of centimetres:
  // "a storage crate 18 m by 14 m by 11 m" is a building.
  const unit = Math.max(...sides) > 4 ? 'cm' : pick(r, ['cm', 'cm', 'm'])
  const things = unit === 'm' ? ['A cuboid', 'A storage container'] : Math.min(...sides) >= 10 ? ['A box', 'A cuboid', 'A storage crate'] : ['A box', 'A cuboid']
  const other = spaceByTrig(sides[0]!, sides[1]!, sides[2]!)
  const answer = roundTo(d, 1)
  return {
    question: {
      type: 'numeric',
      prompt: `${pick(r, things)} measures ${dims(sides, unit)}. What is its space diagonal, in ${unit}, to 1 decimal place?`,
      solution: `$${sides.map((x) => x * x).join(' + ')} = ${n}$, so $d = \\sqrt{${n}} = ${fixed(d, 1)}$ ${unit} to 1 decimal place.`,
      markScheme: scheme(slot, ['squares and adds', 'takes the root'], `${fixed(d, 1)} ${unit}`),
      answer,
      tolerance: tolerance(slot, answer),
      units: unit,
    },
    check: { agrees: roundTo(other, 1) === answer, detail: `angle with the base by tan, length by sin: ${other.toFixed(6)}` },
    values: { sides: sides.join('x') },
  }
}

export const spaceDiagonals = bySlot('space-diagonals', PY3, { q5: spaceDiagonalWhole, q7: spaceDiagonalWhole, q9: spaceDiagonalWhole, q6: baseDiagonal, q11: thirdEdge, q12: spaceDiagonalRounded })

/** The angle between the space diagonal and the base, measured from the corner coordinates by sin. */
const angleBySin = (a: number, b: number, h: number) => Math.asin(h / Math.hypot(a, b, h)) / RAD
const decimalIfTerminating = (top: number, bottom: number) => (Number.isInteger((top / bottom) * 10000) ? ` = ${show(top / bottom)}` : '')

const SOLIDS = [
  (a: number, b: number, h: number, u: string) => `A cuboid has a base ${a} ${u} by ${b} ${u} and a height of ${h} ${u}.`,
  (a: number, b: number, h: number, u: string) => `A closed box is ${a} ${u} long, ${b} ${u} wide and ${h} ${u} tall.`,
  (a: number, b: number, h: number, u: string) => `A glass tank is a cuboid with a base ${a} ${u} by ${b} ${u} and a height of ${h} ${u}.`,
]

/** The angle with the base from a cuboid's edges: written as q5 and q6 (whole base diagonal) and q11 (a surd one). */
function angleWithBase(r: Rng, slot: Question, turn: number): Draft {
  const surd = slot.id === 'q11'
  const { a, b, h } = draw(
    r,
    (r) => {
      if (surd) return { a: int(r, 2, 20), b: int(r, 2, 20), h: int(r, 2, 25) }
      const [a, b] = triple(r, 40)
      return { a, b, h: int(r, 2, 30) }
    },
    ({ a, b, h }) => {
      const n = a * a + b * b
      const t = Math.atan2(h, Math.sqrt(n)) / RAD
      return (surd ? !isSquare(n) && a !== b : true) && h * h !== n && t >= 10 && t <= 80 && clearOfHalf(t, 1)
    },
  )
  const n = a * a + b * b
  const base = Math.sqrt(n)
  const theta = Math.atan2(h, base) / RAD
  const answer = roundTo(theta, 1)
  const unit = turn % SOLIDS.length === 0 ? pick(r, ['cm', 'cm', 'm']) : 'cm'
  const baseTex = surd ? `\\sqrt{${n}}` : String(base)
  const baseLine = surd ? `Base diagonal $= \\sqrt{${a * a} + ${b * b}} = \\sqrt{${n}}$ ${unit}` : `Base diagonal $= \\sqrt{${a * a} + ${b * b}} = ${base}$ ${unit}`
  const ratio = surd ? `\\tan \\theta = \\dfrac{${h}}{\\sqrt{${n}}}` : `\\tan \\theta = \\tfrac{${h}}{${base}}${decimalIfTerminating(h, base)}`
  const other = angleBySin(a, b, h)
  return {
    question: {
      type: 'numeric',
      prompt: `${SOLIDS[turn % SOLIDS.length]!(a, b, h, unit)} What is the angle between its space diagonal and the base, in degrees to 1 decimal place?`,
      solution: `${baseLine}, keeping it exact. In the upright triangle the height ${h} is opposite the angle and the base diagonal is adjacent, so $${ratio}$ and $\\theta = ${fixed(theta, 1)}°$.`,
      markScheme: scheme(slot, [`finds the base diagonal, $${baseTex}$`, 'uses tan'], `${fixed(theta, 1)}°`),
      answer,
      tolerance: tolerance(slot, answer),
      units: '°',
    },
    check: { agrees: roundTo(other, 1) === answer, detail: `from the corners, sin θ = height ÷ space diagonal: ${other.toFixed(6)}°` },
    values: { a, b, h, context: turn % SOLIDS.length },
  }
}

/** The angle from the base diagonal and the height: written as q9 (2 marks). */
function angleFromDiagonal(r: Rng, slot: Question): Draft {
  const { d, h } = draw(
    r,
    (r) => ({ d: int(r, 3, 30), h: int(r, 2, 30) }),
    ({ d, h }) => {
      const t = Math.atan2(h, d) / RAD
      return d !== h && t >= 8 && t <= 82 && clearOfHalf(t, 1)
    },
  )
  const theta = Math.atan2(h, d) / RAD
  const answer = roundTo(theta, 1)
  const unit = pick(r, ['cm', 'm'])
  // Second route: the space diagonal by Pythagoras, then the angle by cos.
  const other = Math.acos(d / Math.hypot(d, h)) / RAD
  return {
    question: {
      type: 'numeric',
      prompt: `A cuboid has a base diagonal of ${d} ${unit} and a height of ${h} ${unit}. What is the angle between the space diagonal and the base, to 1 decimal place?`,
      solution: `The height is opposite the angle and the base diagonal is adjacent: $\\tan \\theta = \\tfrac{${h}}{${d}}$, so $\\theta = ${fixed(theta, 1)}°$.`,
      markScheme: scheme(slot, ['uses tan'], `${fixed(theta, 1)}°`),
      answer,
      tolerance: tolerance(slot, answer),
      units: '°',
    },
    check: { agrees: roundTo(other, 1) === answer, detail: `space diagonal ${Math.hypot(d, h).toFixed(4)}, cos⁻¹: ${other.toFixed(6)}°` },
    values: { d, h },
  }
}

/** The height that makes the angle 45°: written as q13 (3 marks). */
function heightFor45(r: Rng, slot: Question): Draft {
  const [a, b, c] = triple(r, 65)
  const what = pick(r, ['A cuboid', 'A box', 'A glass tank'])
  const unit = what === 'A cuboid' ? pick(r, ['cm', 'm']) : 'cm'
  // Second route: draw the upright triangle with that height and measure the angle with vectors.
  const measured = angleAt([c, 0], [0, 0], [c, c])
  return {
    question: {
      type: 'numeric',
      prompt: `${what} has a base ${a} ${unit} by ${b} ${unit}. What height makes the angle between its space diagonal and the base exactly 45°, in ${unit}?`,
      solution: `Base diagonal $= \\sqrt{${a * a} + ${b * b}} = ${c}$ ${unit}. For 45°, $\\tan 45° = 1$, so the height must equal the base diagonal: **${c} ${unit}**.`,
      markScheme: scheme(slot, [`finds the base diagonal, ${c}`, 'uses tan 45° = 1'], `${c} ${unit}`),
      answer: c,
      tolerance: tolerance(slot, c),
      units: unit,
    },
    check: { agrees: sameAngle(measured, 45) && near(Math.hypot(a, b), c), detail: `upright triangle ${c} by ${c}: angle ${measured.toFixed(6)}°` },
    values: { a, b, c },
  }
}

export const anglesIn3d = bySlot('angle-with-the-base', TRIG3, { q5: angleWithBase, q6: angleWithBase, q11: angleWithBase, q9: angleFromDiagonal, q13: heightFor45 })

/* ------------------------------------------------------------------------------------------
 * Sine rule, cosine rule and area. Each triangle is drawn on coordinates (rays meeting,
 * or a circle meeting a ray) and its sides and angles measured there.
 * ---------------------------------------------------------------------------------------- */

const SINE = 'sine-rule-cosine-rule-and-area'

/** Area from coordinates, by the shoelace formula, for two sides a and b at angle C. */
function shoelace(a: number, b: number, C: number): number {
  const A = polar(C, a)
  const B: Pt = [b, 0]
  return Math.abs(A[0] * B[1] - A[1] * B[0]) / 2
}

/** ½ab sin C: q4 (30°, exact), q7 (any angle, 2 d.p.), q9 (obtuse, 1 d.p.). */
function triangleArea(r: Rng, slot: Question): Draft {
  const dp = slot.id === 'q4' ? 0 : slot.id === 'q7' ? 2 : 1
  const unit = pick(r, ['cm', 'cm', 'm'])
  const { a, b, C } = draw(
    r,
    (r) => {
      const a = int(r, 3, 25)
      const b = int(r, 3, 25)
      const C = slot.id === 'q4' ? 30 : slot.id === 'q7' ? int(r, 20, 85) : int(r, 95, 170)
      return { a, b, C }
    },
    ({ a, b, C }) => a !== b && (slot.id === 'q4' ? (a * b) % 2 === 0 : clearOfHalf(0.5 * a * b * sinD(C), dp)),
  )
  const half = (a * b) / 2
  const area = slot.id === 'q4' ? half / 2 : half * sinD(C)
  const answer = slot.id === 'q4' ? area : roundTo(area, dp)
  const shown = slot.id === 'q4' ? show(area) : fixed(area, dp)
  const ask = dp === 0 ? `in ${unit}²` : `to ${dp} decimal place${dp > 1 ? 's' : ''}, in ${unit}²`
  const prompt = r() < 0.5
    ? `Find the area of a triangle with sides ${a} ${unit} and ${b} ${unit} meeting at ${C}°, ${ask}.`
    : `Two sides of a triangle are ${a} ${unit} and ${b} ${unit}, and the angle between them is ${C}°. Find the area of the triangle, ${ask}.`
  const working = slot.id === 'q4'
    ? `$\\dfrac{1}{2} \\times ${a} \\times ${b} \\times \\sin 30° = ${show(half)} \\times 0.5 = ${shown}$ ${unit}².`
    : `$\\dfrac{1}{2} \\times ${a} \\times ${b} \\times \\sin ${C}° = ${show(half)} \\sin ${C}° = ${shown}$ ${unit}².${C > 90 ? ' The formula works for an obtuse angle too.' : ''}`
  const other = shoelace(a, b, C)
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: working,
      markScheme: scheme(slot, [slot.id === 'q4' ? 'uses half a b sin C' : `${show(half)} sin ${C}°`], shown),
      answer,
      tolerance: tolerance(slot, answer),
      units: `${unit}²`,
    },
    check: { agrees: slot.id === 'q4' ? near(other, answer) : roundTo(other, dp) === answer, detail: `corners on coordinates, shoelace area ${other.toFixed(6)}` },
    values: { a, b, C },
  }
}

const LETTERS = ['A', 'B', 'C'] as const
type L = (typeof LETTERS)[number]
const low = (x: L) => x.toLowerCase()

/**
 * A triangle with angles X and Y and the side x opposite X, drawn on coordinates: Y at the
 * origin, Z at (x, 0), X where the rays at Y and Z meet. Returns the side opposite Y.
 */
function sideByRays(x: number, X: number, Y: number): number {
  const Z = 180 - X - Y
  const Yp: Pt = [0, 0]
  const Zp: Pt = [x, 0]
  const Xp = meet(Yp, polar(Y), Zp, polar(180 - Z))
  return dist(Xp, Zp)
}

/** Draws X at the origin, Z at (y, 0) and finds Y on the ray at angle X with |YZ| = x: every Y on that ray. */
function circleOnRay(x: number, X: number, y: number): Pt[] {
  const u = polar(X)
  const uz = u[0] * y
  const disc = uz * uz - (y * y - x * x)
  if (disc < 0) return []
  const ts = [uz - Math.sqrt(disc), uz + Math.sqrt(disc)].filter((t) => t > 1e-9)
  return ts.map((t) => [t * u[0], t * u[1]] as Pt)
}

/** The sine rule for a side: written as q5 (3 marks). */
function sineRuleSide(r: Rng, slot: Question): Draft {
  const [X, Y] = shuffle(r, LETTERS) as [L, L, L]
  const { x, A1, A2 } = draw(
    r,
    (r) => ({ x: lengthTenths(r, 4, 20), A1: int(r, 20, 120), A2: int(r, 20, 120) }),
    ({ x, A1, A2 }) => A1 !== A2 && A1 + A2 <= 160 && clearOfHalf(((x / 10) * sinD(A2)) / sinD(A1), 2),
  )
  const xs = tenthsText(x)
  const y = ((x / 10) * sinD(A2)) / sinD(A1)
  const answer = roundTo(y, 2)
  const other = sideByRays(x / 10, A1, A2)
  return {
    question: {
      type: 'numeric',
      prompt: `In a triangle, $${low(X)} = ${xs}$, $${X} = ${A1}°$ and $${Y} = ${A2}°$. Find $${low(Y)}$ to 2 decimal places.`,
      solution: `The sine rule with the unknown side on top: $\\dfrac{${low(Y)}}{\\sin ${Y}} = \\dfrac{${low(X)}}{\\sin ${X}}$, so $${low(Y)} = \\dfrac{${xs} \\sin ${A2}°}{\\sin ${A1}°} = ${fixed(y, 2)}$.`,
      markScheme: scheme(slot, [`sine rule with ${low(Y)} on top`, 'substitutes correctly'], fixed(y, 2)),
      answer,
      tolerance: tolerance(slot, answer),
    },
    check: { agrees: roundTo(other, 2) === answer, detail: `triangle drawn from side ${xs} and its two end angles; side measured ${other.toFixed(6)}` },
    values: { known: `${low(X)}=${xs}`, [X]: A1, [Y]: A2 },
  }
}

/** The acute angle from the sine rule, its triangle, and whether an obtuse one exists too. */
function sineRuleAngle(x: number, X: number, y: number) {
  const s = (y * sinD(X)) / x
  const acute = Math.asin(s) / RAD
  const tips = circleOnRay(x, X, y)
  return { s, acute, tips }
}

/** The sine rule for an angle, unambiguous because the known angle faces the longer side: q6 (3 marks). */
function sineRuleAngleDraft(r: Rng, slot: Question): Draft {
  const [X, Y] = shuffle(r, LETTERS) as [L, L, L]
  const { x, y, A } = draw(
    r,
    (r) => ({ x: int(r, 5, 25), y: int(r, 3, 24), A: int(r, 25, 140) }),
    ({ x, y, A }) => {
      if (y >= x) return false
      const t = Math.asin((y * sinD(A)) / x) / RAD
      return t >= 10 && clearOfHalf(t, 1)
    },
  )
  const { s, acute, tips } = sineRuleAngle(x, A, y)
  const answer = roundTo(acute, 1)
  // Second route: Y found where a circle of radius x round Z meets the ray from X; one
  // triangle only, since y < x; the angle at Y measured with vectors.
  const measured = tips.length === 1 ? angleAt([0, 0], tips[0]!, [y, 0]) : NaN
  return {
    question: {
      type: 'numeric',
      prompt: `In a triangle, $${low(X)} = ${x}$, $${X} = ${A}°$ and $${low(Y)} = ${y}$. Find angle $${Y}$ to 1 decimal place.`,
      solution: `Sines on top: $\\dfrac{\\sin ${Y}}{${y}} = \\dfrac{\\sin ${A}°}{${x}}$, so $\\sin ${Y} = \\dfrac{${y} \\sin ${A}°}{${x}} = ${s.toFixed(4)}$ and $${Y} = ${fixed(acute, 1)}°$. Only the acute angle is possible here, because $${low(Y)}$ is shorter than $${low(X)}$, so $${Y}$ is smaller than $${X}$.`,
      markScheme: scheme(slot, ['sines on top', `finds sin ${Y}`], fixed(acute, 1)),
      answer,
      tolerance: tolerance(slot, answer),
    },
    check: { agrees: tips.length === 1 && roundTo(measured, 1) === answer, detail: `triangles on the ray: ${tips.length}; angle measured ${measured.toFixed(6)}°` },
    values: { x, y, A },
  }
}

/** The obtuse partner of a sine-rule angle, possible or not: written as q14 (3 marks). */
function obtusePartner(r: Rng, slot: Question, turn: number): Draft {
  const [X, Y] = shuffle(r, LETTERS) as [L, L, L]
  const possible = turn % 2 === 0
  const { x, y, A } = draw(
    r,
    (r) => ({ x: int(r, 4, 24), y: int(r, 4, 24), A: int(r, 20, 75) }),
    ({ x, y, A }) => {
      const s = (y * sinD(A)) / x
      if (s >= 0.97) return false
      const t = Math.asin(s) / RAD
      if (t < 10 || !clearOfHalf(t, 1)) return false
      return possible ? y > x && A + 180 - t <= 172 : y < x
    },
  )
  const { acute, tips } = sineRuleAngle(x, A, y)
  const acute1 = roundTo(acute, 1)
  const answer = roundTo(180 - acute1, 1)
  const verdict = possible
    ? `Here it is possible too, since $${A} + ${fixed(answer, 1)} = ${fixed(A + answer, 1)}$ is less than $180$: a second triangle fits.`
    : `Here it is impossible, since $${A} + ${fixed(answer, 1)} > 180$.`
  // Second route: the triangles where a circle of radius x round Z meets the ray from X. Two
  // when the obtuse angle is possible, one when not; the obtuse one measured with vectors.
  const angles = tips.map((t) => angleAt([0, 0], t, [y, 0]))
  const obtuse = angles.find((a) => a > 90)
  const acuteMeasured = angles.find((a) => a < 90)!
  const ok = possible ? tips.length === 2 && obtuse !== undefined && roundTo(obtuse, 1) === answer : tips.length === 1 && roundTo(180 - acuteMeasured, 1) === answer
  return {
    question: {
      type: 'numeric',
      prompt: `In a triangle, $${low(X)} = ${x}$, $${X} = ${A}°$ and $${low(Y)} = ${y}$. The sine rule gives an acute angle $${Y}$. What is the obtuse alternative, to 1 decimal place?`,
      solution: `$\\sin ${Y} = \\dfrac{${y} \\sin ${A}°}{${x}}$, so the acute answer is $${fixed(acute1, 1)}°$, and the obtuse partner is $180 - ${fixed(acute1, 1)} = ${fixed(answer, 1)}°$. ${verdict}`,
      markScheme: scheme(slot, [`finds the acute angle ${fixed(acute1, 1)}°`, 'subtracts from 180'], fixed(answer, 1)),
      answer,
      tolerance: tolerance(slot, answer),
    },
    check: { agrees: ok, detail: `triangles on the ray: ${tips.length}; angles measured ${angles.map((a) => a.toFixed(4)).join(', ')}` },
    values: { x, y, A, possible: possible ? 'yes' : 'no' },
  }
}

/** The third angle of a triangle: written as q16 (2 marks). */
function thirdAngleSine(r: Rng, slot: Question): Draft {
  const { a, b } = draw(r, (r) => ({ a: int(r, 15, 120), b: int(r, 15, 120) }), ({ a, b }) => a !== b && 180 - a - b >= 10)
  const c = 180 - a - b
  const prompt = r() < 0.5
    ? `A triangle has two angles of ${a}° and ${b}°. What is the third angle, in degrees?`
    : `In triangle $ABC$, $A = ${a}°$ and $B = ${b}°$. Before using the sine rule, find angle $C$, in degrees.`
  const tip = meet([0, 0], polar(a), [1, 0], polar(180 - b))
  const measured = angleAt([0, 0], tip, [1, 0])
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `Angles in a triangle sum to $180°$: $180 - ${a} - ${b} = ${c}°$.`,
      markScheme: scheme(slot, ['subtracts both from 180'], String(c)),
      answer: c,
      tolerance: 0,
    },
    check: { agrees: sameAngle(measured, c), detail: `triangle drawn from ${a}° and ${b}°, third angle measured ${measured.toFixed(6)}°` },
    values: { a, b, c },
  }
}

/** The cosine rule for a side: written as q11 (3 marks). */
function cosineRuleSide(r: Rng, slot: Question): Draft {
  const X = pick(r, LETTERS)
  const [Y, Z] = LETTERS.filter((l) => l !== X) as [L, L]
  const { p, q, A } = draw(
    r,
    (r) => ({ p: int(r, 3, 20), q: int(r, 3, 20), A: int(r, 20, 150) }),
    ({ p, q, A }) => p !== q && A !== 90 && clearOfHalf(Math.sqrt(p * p + q * q - 2 * p * q * cosD(A)), 2),
  )
  const sq = p * p + q * q - 2 * p * q * cosD(A)
  const side = Math.sqrt(sq)
  const answer = roundTo(side, 2)
  // Second route: X at the origin, the two known sides along rays at 0° and A, the third measured.
  const other = dist(polar(0, q), polar(A, p))
  return {
    question: {
      type: 'numeric',
      prompt: `A triangle has $${low(Y)} = ${p}$, $${low(Z)} = ${q}$ and the angle between them $${X} = ${A}°$. Find $${low(X)}$ to 2 decimal places.`,
      solution: `The cosine rule: $${low(X)}^2 = ${p}^2 + ${q}^2 - 2 \\times ${p} \\times ${q} \\cos ${A}° = ${p * p} + ${q * q} - ${2 * p * q}\\cos ${A}° = ${sq.toFixed(3)}$, so $${low(X)} = ${fixed(side, 2)}$.`,
      markScheme: scheme(slot, ['substitutes into the cosine rule', `evaluates ${low(X)}²`], fixed(side, 2)),
      answer,
      tolerance: tolerance(slot, answer),
    },
    check: { agrees: roundTo(other, 2) === answer, detail: `two sides drawn at ${A}°, third measured ${other.toFixed(6)}` },
    values: { p, q, A, X },
  }
}

/** The largest angle of a triangle from its sides, obtuse: written as q12 (3 marks). */
function largestAngle(r: Rng, slot: Question): Draft {
  const { a, b, c } = draw(
    r,
    (r) => {
      const b = int(r, 3, 20)
      const c = int(r, 3, 20)
      return { a: int(r, Math.max(b, c) + 1, b + c - 1), b, c }
    },
    ({ a, b, c }) => {
      if (!(a * a > b * b + c * c) || a >= b + c || b === c) return false
      const t = Math.acos((b * b + c * c - a * a) / (2 * b * c)) / RAD
      return t <= 165 && clearOfHalf(t, 1)
    },
  )
  const cosA = (b * b + c * c - a * a) / (2 * b * c)
  const A = Math.acos(cosA) / RAD
  const answer = roundTo(A, 1)
  const unit = pick(r, ['cm', 'cm', 'm'])
  const order = shuffle(r, [a, b, c])
  // Second route: Heron's area, then sin A = 2 × area ÷ bc, taking the obtuse angle.
  const other = 180 - Math.asin((2 * heron(a, b, c)) / (b * c)) / RAD
  return {
    question: {
      type: 'numeric',
      prompt: `A triangle has sides ${order[0]}, ${order[1]} and ${order[2]} ${unit}. Find its largest angle in degrees, to 1 decimal place.`,
      solution: `The largest angle faces the longest side, ${a}: $\\cos A = \\dfrac{${b}^2 + ${c}^2 - ${a}^2}{2 \\times ${b} \\times ${c}} = \\dfrac{${b * b} + ${c * c} - ${a * a}}{${2 * b * c}} = ${cosA.toFixed(4)}$, giving $A = ${fixed(A, 1)}°$. The cosine is negative, so the angle is obtuse.`,
      markScheme: scheme(slot, [`uses the side of ${a} as a`, 'negative cosine'], fixed(A, 1)),
      answer,
      tolerance: tolerance(slot, answer),
    },
    check: { agrees: roundTo(other, 1) === answer && a < b + c, detail: `Heron's area ${heron(a, b, c).toFixed(4)}, sin A from it, obtuse: ${other.toFixed(6)}°` },
    values: { a, b, c },
  }
}

export const triangleAreas = bySlot('area-half-ab-sin-c', SINE, { q4: triangleArea, q7: triangleArea, q9: triangleArea })
export const sineRule = bySlot('sine-rule', SINE, { q5: sineRuleSide, q6: sineRuleAngleDraft, q14: obtusePartner, q16: thirdAngleSine })
export const cosineRule = bySlot('cosine-rule', SINE, { q11: cosineRuleSide, q12: largestAngle })

/* ------------------------------------------------------------------------------------------
 * Exact trigonometric values. Each is checked against the calculator's own sin, cos and tan.
 * ---------------------------------------------------------------------------------------- */

const EXACT = 'exact-trigonometric-values'

interface Exact {
  fn: 'sin' | 'cos' | 'tan'
  angle: number
  /** As KaTeX: \dfrac{\sqrt{3}}{2}. */
  tex: string
  /** As a mark scheme writes it: √3/2. */
  text: string
}
const EXACTS: Exact[] = [
  { fn: 'sin', angle: 0, tex: '0', text: '0' },
  { fn: 'sin', angle: 30, tex: '\\dfrac{1}{2}', text: '1/2' },
  { fn: 'sin', angle: 45, tex: '\\dfrac{1}{\\sqrt{2}}', text: '1/√2' },
  { fn: 'sin', angle: 60, tex: '\\dfrac{\\sqrt{3}}{2}', text: '√3/2' },
  { fn: 'sin', angle: 90, tex: '1', text: '1' },
  { fn: 'cos', angle: 0, tex: '1', text: '1' },
  { fn: 'cos', angle: 30, tex: '\\dfrac{\\sqrt{3}}{2}', text: '√3/2' },
  { fn: 'cos', angle: 45, tex: '\\dfrac{1}{\\sqrt{2}}', text: '1/√2' },
  { fn: 'cos', angle: 60, tex: '\\dfrac{1}{2}', text: '1/2' },
  { fn: 'cos', angle: 90, tex: '0', text: '0' },
  { fn: 'tan', angle: 0, tex: '0', text: '0' },
  { fn: 'tan', angle: 30, tex: '\\dfrac{1}{\\sqrt{3}}', text: '1/√3' },
  { fn: 'tan', angle: 45, tex: '1', text: '1' },
  { fn: 'tan', angle: 60, tex: '\\sqrt{3}', text: '√3' },
]
const exact = (fn: Exact['fn'], angle: number) => EXACTS.find((e) => e.fn === fn && e.angle === angle)!
/** The calculator's value, for the second method. */
export const calc = (fn: Exact['fn'], angle: number) => (fn === 'sin' ? sinD(angle) : fn === 'cos' ? cosD(angle) : tanD(angle))
const named = (e: Exact) => `${e.fn} ${e.angle}°`
const namedTex = (e: Exact) => `\\${e.fn} ${e.angle}°`

/** The exact values that are whole or a half. */
const RATIONAL: [Exact['fn'], number, number][] = [['sin', 30, 0.5], ['cos', 60, 0.5], ['tan', 45, 1], ['sin', 90, 1], ['cos', 0, 1]]

/** A fraction p/q in lowest terms as KaTeX, or a whole number. */
function fracTex(p: number, q: number): string {
  const g = gcd(Math.abs(p), q)
  const [n, d] = [p / g, q / g]
  return d === 1 ? String(n) : `\\dfrac{${n}}{${d}}`
}
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
/** "= 7.5" after a fraction that is not whole, so the decimal the marker takes is on the page. */
const decimalTail = (p: number, q: number) => (p % q === 0 ? '' : ` = ${show(p / q)}`)

/** k × a whole-or-half exact value: written as q5 (2 marks). */
function multipleOfExact(r: Rng, slot: Question): Draft {
  const [fn, angle, value] = pick(r, RATIONAL)
  const k = int(r, 2, 30)
  const e = exact(fn, angle)
  const answer = k * value
  const work = value === 1 ? `$${k} \\times 1 = ${answer}$` : `$${k} \\times \\dfrac{1}{2} = ${fracTex(k, 2)}${decimalTail(k, 2)}$`
  return {
    question: {
      type: 'numeric',
      prompt: `Work out the exact value of $${k} ${namedTex(e)}$.`,
      solution: `$${namedTex(e)} = ${e.tex}$, so ${work}.`,
      markScheme: scheme(slot, [`uses ${named(e)} = ${e.text}`], show(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: near(k * calc(fn, angle), answer), detail: `calculator: ${k} × ${fn} ${angle}° = ${(k * calc(fn, angle)).toFixed(9)}` },
    values: { k, fn, angle },
  }
}

/** An exact side from a 30°, 60° or 45° triangle: written as q8 (2 marks). */
function exactSide(r: Rng, slot: Question, turn: number): Draft {
  const kind = turn % 3
  const unit = pick(r, ['cm', 'cm', 'm'])
  let prompt: string
  let solution: string
  let method: string
  let answer: number
  let other: number
  if (kind === 0 || kind === 1) {
    const h = 2 * int(r, 2, 25)
    const angle = kind === 0 ? 30 : 60
    const side = kind === 0 ? 'opposite' : 'adjacent to'
    const fn = kind === 0 ? 'sin' : 'cos'
    answer = h / 2
    prompt = `A right-angled triangle has hypotenuse ${h} ${unit} and an angle of ${angle}°. What is the exact length, in ${unit}, of the side ${side} the ${angle}° angle?`
    solution = `$${h} \\${fn} ${angle}° = ${h} \\times \\dfrac{1}{2} = ${answer}$ ${unit}.`
    method = `uses ${h} ${fn} ${angle}°`
    other = h * calc(fn, angle)
  } else {
    const a = int(r, 3, 30)
    answer = a
    prompt = `A right-angled triangle has an angle of 45°, and the side adjacent to it is ${a} ${unit}. What is the exact length, in ${unit}, of the side opposite the 45° angle?`
    solution = `$${a} \\tan 45° = ${a} \\times 1 = ${a}$ ${unit}. A 45° right-angled triangle is isosceles.`
    method = `uses ${a} tan 45°`
    other = a * calc('tan', 45)
  }
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [method], String(answer)), answer, tolerance: 0, units: unit },
    check: { agrees: near(other, answer), detail: `calculator: ${other.toFixed(9)}` },
    values: { kind, answer },
  }
}

/** Products of exact values whose surds cancel, with the product as p/q. */
const PRODUCTS: [Exact['fn'], number, Exact['fn'], number, number, number][] = [
  ['tan', 60, 'tan', 30, 1, 1],
  ['sin', 60, 'cos', 30, 3, 4],
  ['sin', 45, 'cos', 45, 1, 2],
  ['tan', 60, 'sin', 60, 3, 2],
  ['cos', 30, 'tan', 30, 1, 2],
  ['sin', 60, 'tan', 30, 1, 2],
  ['tan', 60, 'cos', 30, 3, 2],
  ['cos', 30, 'sin', 60, 3, 4],
  ['sin', 45, 'sin', 45, 1, 2],
]
const coefTex = (k: number, body: string) => (k === 1 ? body : `${k}${body}`)

/** A product of exact values: written as q11 (3 marks). */
function exactProduct(r: Rng, slot: Question): Draft {
  const [f1, a1, f2, a2, p, q] = pick(r, PRODUCTS)
  const k1 = r() < 0.3 ? 1 : int(r, 2, 9)
  const k2 = r() < 0.3 ? 1 : int(r, 2, 9)
  const e1 = exact(f1, a1)
  const e2 = exact(f2, a2)
  const k = k1 * k2
  const answer = (k * p) / q
  const expr = `${coefTex(k1, namedTex(e1))} \\times ${coefTex(k2, namedTex(e2))}`
  const same = f1 === f2 && a1 === a2
  const values = same ? `$${namedTex(e1)} = ${e1.tex}$` : `$${namedTex(e1)} = ${e1.tex}$ and $${namedTex(e2)} = ${e2.tex}$`
  const product = `${k === 1 ? '' : `${k} \\times `}${e1.tex} \\times ${e2.tex}`
  const result = `${k === 1 ? '' : `${k} \\times `}${fracTex(p, q)}`
  const tail = k === 1 ? `${fracTex(p, q)}${decimalTail(p, q)}` : `${result} = ${fracTex(k * p, q)}${decimalTail(k * p, q)}`
  const solution = `${values}, so $${expr} = ${product} = ${tail}$.`
  return {
    question: {
      type: 'numeric',
      prompt: `Work out the exact value of $${expr}$.`,
      solution,
      // The same value twice earns the second mark for multiplying, not for naming it again.
      markScheme: scheme(slot, same ? [`${named(e1)} = ${e1.text}`, `${e1.text} × ${e1.text} = ${p}/${q}`] : [`${named(e1)} = ${e1.text}`, `${named(e2)} = ${e2.text}`], show(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: near(k1 * calc(f1, a1) * k2 * calc(f2, a2), answer), detail: `calculator: ${(k1 * calc(f1, a1) * k2 * calc(f2, a2)).toFixed(9)}` },
    values: { expr: `${k1} ${f1}${a1} x ${k2} ${f2}${a2}` },
  }
}

/** sin² and cos² of 30°, 45° and 60° as quarters. */
const SQUARES: Record<string, { tex: string; text: string; quarters: number }> = {
  sin30: { tex: '\\left(\\dfrac{1}{2}\\right)^2', text: '1/4', quarters: 1 },
  sin45: { tex: '\\left(\\dfrac{1}{\\sqrt{2}}\\right)^2', text: '1/2', quarters: 2 },
  sin60: { tex: '\\left(\\dfrac{\\sqrt{3}}{2}\\right)^2', text: '3/4', quarters: 3 },
  cos30: { tex: '\\left(\\dfrac{\\sqrt{3}}{2}\\right)^2', text: '3/4', quarters: 3 },
  cos45: { tex: '\\left(\\dfrac{1}{\\sqrt{2}}\\right)^2', text: '1/2', quarters: 2 },
  cos60: { tex: '\\left(\\dfrac{1}{2}\\right)^2', text: '1/4', quarters: 1 },
}

/** p sin² α + q cos² β: written as q14 (3 marks, sin² 30° + cos² 30°). */
function squaresOfExact(r: Rng, slot: Question): Draft {
  const a = pick(r, [30, 45, 60])
  const b = r() < 0.4 ? a : pick(r, [30, 45, 60])
  const p = r() < 0.35 ? 1 : int(r, 2, 9)
  const q = r() < 0.35 ? 1 : int(r, 2, 9)
  const s = SQUARES[`sin${a}`]!
  const c = SQUARES[`cos${b}`]!
  const quarters = p * s.quarters + q * c.quarters
  const answer = quarters / 4
  const expr = `${coefTex(p, `\\sin^2 ${a}°`)} + ${coefTex(q, `\\cos^2 ${b}°`)}`
  const sq1 = fracTex(s.quarters, 4)
  const sq2 = fracTex(c.quarters, 4)
  const t1 = p === 1 ? sq1 : `${p} \\times ${sq1}`
  const t2 = q === 1 ? sq2 : `${q} \\times ${sq2}`
  const v1 = fracTex(p * s.quarters, 4)
  const v2 = fracTex(q * c.quarters, 4)
  const middle = t1 === v1 && t2 === v2 ? '' : ` = ${v1} + ${v2}`
  return {
    question: {
      type: 'numeric',
      prompt: `Using exact values, work out $${expr}$.`,
      solution: `$\\sin^2 ${a}° = ${s.tex} = ${sq1}$ and $\\cos^2 ${b}° = ${c.tex} = ${sq2}$, so the value is $${t1} + ${t2}${middle} = ${fracTex(quarters, 4)}${decimalTail(quarters, 4)}$.`,
      markScheme: scheme(slot, ['squares both exact values', `sin² ${a}° = ${s.text} and cos² ${b}° = ${c.text}`], show(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: near(p * sinD(a) ** 2 + q * cosD(b) ** 2, answer), detail: `calculator: ${(p * sinD(a) ** 2 + q * cosD(b) ** 2).toFixed(9)}` },
    values: { expr: `${p} sin2 ${a} + ${q} cos2 ${b}` },
  }
}

/** p f₁ ± q f₂ of whole-or-half exact values: written as q16 (3 marks). */
function sumOfExact(r: Rng, slot: Question): Draft {
  const [first, second] = shuffle(r, RATIONAL).slice(0, 2) as [(typeof RATIONAL)[number], (typeof RATIONAL)[number]]
  const p = int(r, 2, 12)
  const q = int(r, 2, 12)
  const sign = p * first[2] > q * second[2] && r() < 0.4 ? -1 : 1
  const e1 = exact(first[0], first[1])
  const e2 = exact(second[0], second[1])
  const v1 = p * first[2]
  const v2 = q * second[2]
  const answer = v1 + sign * v2
  const op = sign < 0 ? '-' : '+'
  const half = (v: number) => (v === 1 ? '1' : '\\dfrac{1}{2}')
  return {
    question: {
      type: 'numeric',
      prompt: `Work out the exact value of $${p} ${namedTex(e1)} ${op} ${q} ${namedTex(e2)}$.`,
      solution: `$${namedTex(e1)} = ${e1.tex}$ and $${namedTex(e2)} = ${e2.tex}$, so the value is $${p} \\times ${half(first[2])} ${op} ${q} \\times ${half(second[2])} = ${show(v1)} ${op} ${show(v2)} = ${show(answer)}$.`,
      markScheme: scheme(slot, [`${named(e1)} = ${e1.text} and ${named(e2)} = ${e2.text}`, `${show(v1)} ${op === '-' ? '−' : '+'} ${show(v2)}`], show(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: near(p * calc(first[0], first[1]) + sign * q * calc(second[0], second[1]), answer), detail: `calculator: ${(p * calc(first[0], first[1]) + sign * q * calc(second[0], second[1])).toFixed(9)}` },
    values: { expr: `${p} ${first[0]}${first[1]} ${op} ${q} ${second[0]}${second[1]}` },
  }
}

/** k√m, typed as the written accepted lists type it: 4√2, 4sqrt2, and with the unit. */
const surdForms = (k: number, m: number, unit: string) => [`${k}√${m}`, `${k}sqrt${m}`, `${k}√${m} ${unit}`]

/** An exact side as a√2 (q12) or a√3 (q13), 3 marks. */
function exactSurdSide(r: Rng, slot: Question, turn: number): Draft {
  const unit = pick(r, ['cm', 'cm', 'm'])
  const two = slot.id === 'q12'
  const kind = two ? turn % 2 : turn % 4
  let prompt: string
  let solution: string
  let method: [string, string]
  let k: number
  let other: number
  const m = two ? 2 : 3
  if (two && kind === 0) {
    const h = 2 * int(r, 2, 25)
    k = h / 2
    const side = pick(r, ['a shorter side', 'the side opposite the 45° angle', 'the side adjacent to the 45° angle'])
    prompt = `A right-angled triangle has hypotenuse ${h} ${unit} and an angle of 45°. Find the exact length of ${side}, in the form $a\\sqrt{b}$.`
    solution = `$${h} \\sin 45° = ${h} \\times \\dfrac{1}{\\sqrt{2}} = \\dfrac{${h}}{\\sqrt{2}}$. Rationalising gives $\\dfrac{${h}\\sqrt{2}}{2} = ${k}\\sqrt{2}$ ${unit}.`
    method = [`uses ${h} sin 45°`, 'rationalises the denominator']
    other = h * sinD(45)
  } else if (two) {
    k = int(r, 2, 25)
    prompt = `A right-angled triangle has an angle of 45°, and each of its shorter sides is ${k} ${unit}. Find the exact length of the hypotenuse, in the form $a\\sqrt{b}$.`
    solution = `$\\cos 45° = \\dfrac{${k}}{h}$, so $h = \\dfrac{${k}}{\\cos 45°} = ${k} \\div \\dfrac{1}{\\sqrt{2}} = ${k}\\sqrt{2}$ ${unit}. Pythagoras agrees: $h^2 = ${k}^2 + ${k}^2 = ${2 * k * k}$, and $(${k}\\sqrt{2})^2 = ${2 * k * k}$.`
    method = [`uses ${k} ÷ cos 45°, or Pythagoras`, `dividing by 1/√2 multiplies by √2`]
    other = k / cosD(45)
  } else if (kind === 0 || kind === 1) {
    const h = 2 * int(r, 2, 25)
    k = h / 2
    const [angle, fn, side] = kind === 0 ? [30, 'cos', 'adjacent to'] as const : [60, 'sin', 'opposite'] as const
    prompt = `A right-angled triangle has hypotenuse ${h} ${unit} and an angle of ${angle}°. Find the exact length of the side ${side} the ${angle}° angle, in the form $a\\sqrt{b}$.`
    solution = `$${h} \\${fn} ${angle}° = ${h} \\times \\dfrac{\\sqrt{3}}{2} = ${k}\\sqrt{3}$ ${unit}. Writing ${fixed(k * Math.sqrt(3), 2)} would not be exact.`
    method = [`uses ${h} ${fn} ${angle}°`, `${fn} ${angle}° = √3/2`]
    other = h * calc(fn, angle)
  } else {
    k = int(r, 2, 25)
    const [angle, given, fn] = kind === 2 ? [60, 'adjacent to', 'tan'] as const : [30, 'opposite', 'tan'] as const
    if (kind === 2) {
      prompt = `A right-angled triangle has an angle of 60°, and the side adjacent to it is ${k} ${unit}. Find the exact length of the side opposite the 60° angle, in the form $a\\sqrt{b}$.`
      solution = `$${k} \\tan 60° = ${k} \\times \\sqrt{3} = ${k}\\sqrt{3}$ ${unit}.`
      method = [`uses ${k} tan 60°`, 'tan 60° = √3']
      other = k * calc(fn, angle)
    } else {
      prompt = `A right-angled triangle has an angle of 30°, and the side ${given} it is ${k} ${unit}. Find the exact length of the side adjacent to the 30° angle, in the form $a\\sqrt{b}$.`
      solution = `$\\tan 30° = \\dfrac{${k}}{x}$, so $x = \\dfrac{${k}}{\\tan 30°} = ${k} \\div \\dfrac{1}{\\sqrt{3}} = ${k}\\sqrt{3}$ ${unit}.`
      method = [`uses ${k} ÷ tan 30°`, 'tan 30° = 1/√3']
      other = k / calc(fn, angle)
    }
  }
  const accepted = surdForms(k, m, unit)
  return {
    question: { type: 'short-text', prompt, solution, markScheme: scheme(slot, method, `${k}√${m}`), accepted },
    check: { agrees: near(k * Math.sqrt(m), other), detail: `${k}√${m} = ${(k * Math.sqrt(m)).toFixed(9)}; calculator ${other.toFixed(9)}` },
    values: { kind, k, m },
  }
}

export const exactValues = bySlot('exact-trig-values', EXACT, { q5: multipleOfExact, q8: exactSide, q11: exactProduct, q14: squaresOfExact, q16: sumOfExact })
export const exactSurdSides = bySlot('exact-surd-sides', EXACT, { q12: exactSurdSide, q13: exactSurdSide })

/* ------------------------------------------------------------------------------------------
 * Trigonometric graphs: solving sin, cos or tan x = k for 0° to 360°. The second method finds
 * every root numerically, by scanning for a change of sign and halving.
 * ---------------------------------------------------------------------------------------- */

const GRAPHS = 'trigonometric-graphs'

/** Every solution of fn(x) = k for 0 ≤ x ≤ 360, by scanning and bisection. */
export function rootsIn360(fn: 'sin' | 'cos' | 'tan', k: number): number[] {
  const f = (x: number) => calc(fn, x) - k
  const out: number[] = []
  const step = 0.25
  for (let x = 0; x < 360; x += step) {
    let a = x
    let b = x + step
    const fa = f(a)
    const fb = f(b)
    if (fn === 'tan' && (Math.abs(fa) > 100 || Math.abs(fb) > 100)) continue
    if (fa === 0) {
      out.push(a)
      continue
    }
    if (fa * fb > 0) continue
    for (let i = 0; i < 60; i++) {
      const m = (a + b) / 2
      if (f(a) * f(m) <= 0) b = m
      else a = m
    }
    out.push((a + b) / 2)
  }
  return out.filter((x, i) => i === 0 || Math.abs(x - out[i - 1]!) > 0.01)
}

/** The other solution from one given: written as q7 (sin, 1 mark); cos and tan in turn. */
function otherSolution(r: Rng, slot: Question, turn: number): Draft {
  const fn = (['sin', 'cos', 'tan'] as const)[turn % 3]!
  const alpha = draw(r, (r) => int(r, 5, 85), (a) => a !== 45 || fn !== 'tan')
  const k = roundTo(calc(fn, alpha), 3)
  const answer = fn === 'sin' ? 180 - alpha : fn === 'cos' ? 360 - alpha : alpha + 180
  const solution = fn === 'sin'
    ? `For sine, the partner solution is $180° - x$, so the other one is $180 - ${alpha} = ${answer}$ degrees.`
    : fn === 'cos'
      ? `The cosine graph is symmetrical about $180°$, so the partner solution is $360° - x$: the other one is $360 - ${alpha} = ${answer}$ degrees.`
      : `The tangent graph repeats every $180°$, so the other solution is $${alpha} + 180 = ${answer}$ degrees.`
  const roots = rootsIn360(fn, k).map((x) => Math.round(x))
  return {
    question: {
      type: 'numeric',
      prompt: `One solution of $\\${fn} x = ${show(k)}$ is $x = ${alpha}°$, to the nearest degree. What is the other solution between $0°$ and $360°$? Give your answer in degrees, to the nearest degree.`,
      solution,
      markScheme: scheme(slot, [], String(answer)),
      answer,
      tolerance: 0,
      units: 'degrees',
    },
    check: { agrees: roots.length === 2 && roots.includes(alpha) && roots.includes(answer), detail: `roots found by scanning: ${roots.join(', ')}` },
    values: { fn, alpha, k: show(k) },
  }
}

/** Both solutions of cos x = k (q8) or tan x = k (q12), to the nearest degree, 2 marks. */
function bothSolutions(r: Rng, slot: Question): Draft {
  const fn = slot.id === 'q8' ? 'cos' : 'tan'
  const { k, base } = draw(
    r,
    (r) => {
      const k = fn === 'cos' ? int(r, 50, 950) / 1000 : (r() < 0.5 ? -1 : 1) * (r() < 0.5 ? int(r, 11, 60) / 10 : int(r, 12, 99) / 100)
      const base = (fn === 'cos' ? Math.acos(k) : Math.atan(k)) / RAD
      return { k, base }
    },
    ({ base }) => clearOfHalf(base, 0) && clearOfHalf(base, 1) && Math.abs(base) >= 3,
  )
  let exactRoots: number[]
  let solution: string
  const inv = fn === 'cos' ? '\\cos^{-1}' : '\\tan^{-1}'
  const kTex = k < 0 ? `(${show(k)})` : show(k)
  if (fn === 'cos') {
    exactRoots = [base, 360 - base]
    solution = `The calculator gives $${inv} ${kTex} = ${fixed(base, 1)}°$. For cosine the partner is $360° - x$, so the second solution is $360 - ${fixed(base, 1)} = ${fixed(360 - base, 1)}°$. To the nearest degree: $${Math.round(base)}°$ and $${Math.round(360 - base)}°$.`
  } else if (k > 0) {
    exactRoots = [base, base + 180]
    solution = `The calculator gives $${inv} ${kTex} = ${fixed(base, 1)}°$. The tangent graph repeats every $180°$, not $360°$, so the next solution is $${fixed(base, 1)} + 180 = ${fixed(base + 180, 1)}°$; the one after that is over $360°$. To the nearest degree: $${Math.round(base)}°$ and $${Math.round(base + 180)}°$.`
  } else {
    exactRoots = [base + 180, base + 360]
    solution = `The calculator gives $${inv} ${kTex} = ${fixed(base, 1)}°$, which is outside the range. The tangent graph repeats every $180°$, so add $180°$: $${fixed(base + 180, 1)}°$, and again: $${fixed(base + 360, 1)}°$. To the nearest degree: $${Math.round(base + 180)}°$ and $${Math.round(base + 360)}°$.`
  }
  const [x1, x2] = exactRoots.map((x) => Math.round(x)) as [number, number]
  const roots = rootsIn360(fn, k).map((x) => Math.round(x))
  return {
    question: {
      type: 'short-text',
      prompt: `Solve $\\${fn} x = ${show(k)}$ for $0° \\le x \\le 360°$. Give both answers in degrees, to the nearest degree, separated by a comma.`,
      solution,
      markScheme: scheme(slot, [`${fn}⁻¹ ${k < 0 ? `(−${show(-k)})` : show(k)} = ${fixed(base, 1).replace('-', '−')}`], `${x1} and ${x2}`),
      accepted: [`${x1}, ${x2}`, `${x2}, ${x1}`],
    },
    check: { agrees: roots.length === 2 && roots[0] === x1 && roots[1] === x2 && x1 >= 0 && x2 <= 360, detail: `roots found by scanning: ${roots.join(', ')}` },
    values: { fn, k: show(k), x1, x2 },
  }
}

export const trigEquations = bySlot('trig-equation-solutions', GRAPHS, { q7: otherSolution, q8: bothSolutions, q12: bothSolutions })

/** Generators for Pythagoras, trigonometry in 3D, sine and cosine rules, exact values, trigonometric graphs. */
export const trianglesGenerators: Generator[] = [
  pythagoras2d,
  pythagorasSurds,
  spaceDiagonals,
  anglesIn3d,
  triangleAreas,
  sineRule,
  cosineRule,
  exactValues,
  exactSurdSides,
  trigEquations,
]
