import type { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { draw, int, pick, shuffle, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Check, Draft, Generator } from '../types.ts'
import { coef, evalEquation, evalTex, near, sub, sum } from '../maths/formulae.ts'
import { poly } from '../maths/quadratics.ts'
import { fmBySlot, minus } from './build.ts'
import { notPrinted, weighted } from './functions.ts'

/**
 * Further Maths (AQA 8365): simultaneous-equations-including-three-unknowns. Non-calculator
 * throughout: whole solutions, small coefficients, prices in quarters and tenths.
 *
 * 2.15  Two linear equations by substitution (one has a coefficient of 1) and by elimination
 *       with both equations scaled; one linear and one second order: a line touching a
 *       parabola, found by the discriminant, and xy = P with x − y = d or x + y = s.
 * 2.16  Three unknowns: eliminating z from two pairs, substituting two letters in terms of a
 *       third, and three prices from three bills.
 */

const TOPIC = 'simultaneous-equations-including-three-unknowns'

const pm = (r: Rng) => (r() < 0.5 ? -1 : 1)
const ORD = ['first', 'second', 'third'] as const
/** A list of signed numbers as a sum: 2 - 2 + 3. */
const signed = (xs: number[]) => xs.map((v, i) => (i === 0 ? String(v) : v < 0 ? ` - ${-v}` : ` + ${v}`)).join('')
/** ax + by as printed: 3x + 2y, x - 2y. */
const lhs = (a: number, b: number) => sum([[a, 'x'], [b, 'y']])

/** Every printed equation holds at the solution: the second route for every system here. */
function solves(equations: string[], vars: Record<string, number>): Check {
  const gaps = equations.map((e) => evalEquation(e, vars))
  return { agrees: gaps.every((g) => near(g, 0)), detail: `${JSON.stringify(vars)} in ${equations.join(', ')}: ${gaps.join(', ')}` }
}

// ---------------------------------------------------------------------------------------
// q1: substitution. 3x + 2y = 12 and x − y = 4, x = 4.
// ---------------------------------------------------------------------------------------

/**
 * ax + by = c with x ± y = d, the solution drawn first. a is 2 to 5 and never |b|, |b| is 2 to 4;
 * neither
 * x nor y is zero; the asked value is never a printed number, and the sign slipped in
 * y = ±(d − x) gives another value.
 */
function substitutionPair(r: Rng, slot: Question): Draft {
  const ask = r() < 0.6 ? 'x' : 'y'
  const { a, b, x, y, s, d } = draw(
    r,
    (r) => {
      const x = pm(r) * int(r, 1, 9)
      const y = pm(r) * int(r, 1, 9)
      const s = r() < 0.6 ? -1 : 1
      return { a: int(r, 2, 5), b: pm(r) * int(r, 2, 4), x, y, s, d: x + s * y }
    },
    ({ a, b, x, y, s, d }) => {
      const c = a * x + b * y
      if (c === 0 || d === 0 || Math.abs(c) === Math.abs(d) || Math.abs(c) > 40 || a === Math.abs(b) || a - b * s === 0) return false
      const xw = a + b * s === 0 ? NaN : (c + b * s * d) / (a + b * s)
      const slip = ask === 'x' ? xw : s * (xw - d)
      return notPrinted(ask === 'x' ? x : y, [a, b, c, d]) && slip !== (ask === 'x' ? x : y)
    },
  )
  const c = a * x + b * y
  const e1 = `${lhs(a, b)} = ${c}`
  const e2 = `${sum([[1, 'x'], [s, 'y']])} = ${d}`
  const firstScaled = r() < 0.75
  const [p1, p2] = firstScaled ? [e1, e2] : [e2, e1]
  // y from x ± y = d: x − d, or d − x.
  const yParts: [number, string][] = s === -1 ? [[1, 'x'], [-d, '']] : [[d, ''], [-1, 'x']]
  const substituted = sum([[a, 'x'], ...yParts.map(([k, v]) => [b * k, v] as [number, string])])
  const K = a - b * s
  const R = c - b * s * d
  const prompt = `Solve $${p1}$ and $${p2}$. Give the value of $${ask}$.`
  const solution =
    `From the ${firstScaled ? 'second' : 'first'}, $y = ${sum(yParts)}$. Substitute: $${substituted} = ${c}$, so ${K === 1 ? '' : `$${coef(K, 'x')} = ${R}$ and `}$x = ${x}$. ` +
    `Then $y = ${y}$. Check: $${sum([[a * x, ''], [b * y, '']])} = ${c}$.`
  const answer = ask === 'x' ? x : y
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, ['substitutes or eliminates'], minus(answer)), answer, tolerance: 0 },
    check: solves([e1, e2], { x, y }),
    values: { a, b, c, s, d, x, y, ask },
  }
}

// ---------------------------------------------------------------------------------------
// q5: elimination with both equations scaled. 2x + 3y = 7 and 5x − 2y = 8, y = 1.
// ---------------------------------------------------------------------------------------

/** Pairs of coefficients where neither divides the other, so both equations must be scaled. */
const COPRIME: [number, number][] = [[2, 3], [3, 2], [2, 5], [5, 2], [3, 4], [4, 3], [3, 5], [5, 3], [4, 5], [5, 4]]
/** The x coefficient left once y is eliminated: the first times |b₂|, the second times b₁, added when b₂ < 0. */
const eliminatedX = (a1: number, b1: number, a2: number, b2: number) => (b2 < 0 ? Math.abs(b2) * a1 + b1 * a2 : Math.abs(b2) * a1 - b1 * a2)

/**
 * a₁x + b₁y = c₁ and a₂x + b₂y = c₂, each pair of coefficients coprime so both equations are
 * scaled. The eliminated equation keeps to the written size (19x = 38): its x coefficient is
 * at most 25. The asked value's size is drawn first, evenly from 1 to 9, and the coefficients
 * drawn round it so none has that size; the other value is ±1 to ±7. Adding (b₂ < 0) is
 * chosen before the draw: with a size of 2 or 3 every sum of scaled x coefficients passes 25
 * or the pair is mirrored, so those subtract. The second equation is never the first mirrored
 * (5x + 4y with 4x + 5y), where adding gives 9(x + y) as a shortcut and two givens repeat.
 */
function bothScaled(r: Rng, slot: Question): Draft {
  const ask = r() < 0.55 ? 'y' : 'x'
  const size = int(r, 1, 9)
  const adding = size !== 2 && size !== 3 && r() < 0.6
  const v = draw(
    r,
    (r) => {
      const [b1, b2s] = pick(r, COPRIME.filter((p) => !p.includes(size)))
      const [a1, a2] = pick(r, COPRIME.filter((p) => !p.includes(size)))
      const b2 = (adding ? -1 : 1) * b2s
      const asked = pm(r) * size
      const other = pm(r) * int(r, 1, 7)
      const [x, y] = ask === 'x' ? [asked, other] : [other, asked]
      return { a1, b1, a2, b2, x, y, c1: a1 * x + b1 * y, c2: a2 * x + b2 * y }
    },
    ({ a1, b1, a2, b2, x, y, c1, c2 }) =>
      c1 !== 0 && c2 !== 0 && Math.abs(c1) !== Math.abs(c2) && Math.abs(c1) <= 45 && Math.abs(c2) <= 45 && a1 * b2 - a2 * b1 !== 0 &&
      Math.abs(eliminatedX(a1, b1, a2, b2)) <= 25 &&
      !(a1 === Math.abs(b2) && a2 === b1) &&
      a1 !== b1 && a2 !== Math.abs(b2) && notPrinted(ask === 'x' ? x : y, [a1, b1, c1, a2, b2, c2]),
  )
  const { a1, b1, a2, b2, x, y, c1, c2 } = v
  const e1 = `${lhs(a1, b1)} = ${c1}`
  const e2 = `${lhs(a2, b2)} = ${c2}`
  const k1 = Math.abs(b2)
  const k2 = b1
  const add = b2 < 0
  const K = eliminatedX(a1, b1, a2, b2)
  const R = add ? k1 * c1 + k2 * c2 : k1 * c1 - k2 * c2
  const prompt = `Solve $${e1}$ and $${e2}$. Give the value of $${ask}$.`
  const solution =
    `Multiply the first by $${k1}$ and the second by $${k2}$: $${lhs(k1 * a1, k1 * b1)} = ${k1 * c1}$ and $${lhs(k2 * a2, k2 * b2)} = ${k2 * c2}$. ` +
    `${add ? 'Add' : 'Subtract the second from the first'}: ${K === 1 ? '' : `$${coef(K, 'x')} = ${R}$, so `}$x = ${x}$, and then $${sum([[a1 * x, ''], [b1, 'y']])} = ${c1}$ gives $y = ${y}$.`
  const answer = ask === 'x' ? x : y
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, ['matches a coefficient'], minus(answer)), answer, tolerance: 0 },
    check: solves([e1, e2], { x, y }),
    values: { a1, b1, c1, a2, b2, c2, x, y, ask },
  }
}

// ---------------------------------------------------------------------------------------
// q8: three unknowns by elimination. x + y + z = 6, 2x − y + z = 3, x + 2y − z = 2: z = 3.
// ---------------------------------------------------------------------------------------

/** [x, y, z coefficients, right-hand side]. */
type Eq = [number, number, number, number]
const eqTex = ([p, q, e, s]: Eq) => `${sum([[p, 'x'], [q, 'y'], [e, 'z']])} = ${s}`
const det3 = ([a, b, c]: Eq, [d, e, f]: Eq, [g, h, i]: Eq) => a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)

/** A pair of equations with z eliminated: added when the z signs differ, else the smaller-x one subtracted from the other. */
function eliminateZ(eqs: Eq[], i: number, j: number): { A: number; B: number; C: number; text: string } {
  const [p, q, e, s] = eqs[i]!
  const [u, v, f, t] = eqs[j]!
  if (e !== f) return { A: p + u, B: q + v, C: s + t, text: `Add the ${ORD[i]} and ${ORD[j]}` }
  return u - p >= 0
    ? { A: u - p, B: v - q, C: t - s, text: `Subtract the ${ORD[i]} from the ${ORD[j]}` }
    : { A: p - u, B: q - v, C: s - t, text: `Subtract the ${ORD[j]} from the ${ORD[i]}` }
}

/**
 * x + y + z = s₁ with two more equations whose x coefficient is 1 or 2, y coefficient ±1 or ±2
 * (one 2 each, and the two rows differ in x or y) and z coefficient ±1, as written. z is eliminated from two pairs; the pair whose
 * result has a y coefficient of ±1 is solved for y and substituted. The solution is drawn
 * first: three distinct non-zero values, the asked one 3 to 7 in size (never a coefficient)
 * and never a right-hand side. `turn` rotates the letter asked, so q8 and q10 on one sheet
 * never ask the same one.
 */
function threeByElimination(r: Rng, slot: Question, turn: number): Draft {
  const ask = (['z', 'x', 'y'] as const)[turn % 3]!
  const v = draw(
    r,
    (r) => {
      const asked = pm(r) * int(r, 3, 7)
      const other = () => pm(r) * int(r, 1, 6)
      const vals = { x: other(), y: other(), z: other(), [ask]: asked } as Record<'x' | 'y' | 'z', number>
      const row = (): Eq => {
        const c = [1, pm(r), pm(r)]
        c[int(r, 0, 1)]! *= 2
        return [c[0]!, c[1]!, c[2]!, c[0]! * vals.x + c[1]! * vals.y + c[2]! * vals.z]
      }
      const eqs: Eq[] = [[1, 1, 1, vals.x + vals.y + vals.z], row(), row()]
      const pairs = shuffle(r, [[0, 1], [0, 2], [1, 2]] as [number, number][]).slice(0, 2)
      const reduced = pairs.map(([i, j]) => eliminateZ(eqs, i, j))
      const good = (q: { A: number; B: number }) => q.A !== 0 && Math.abs(q.B) === 1
      const usable = (q: { A: number; B: number }) => q.A !== 0 && q.B !== 0
      const [r1, r2] = good(reduced[1]!) && usable(reduced[0]!) ? [reduced[0]!, reduced[1]!] : [reduced[1]!, reduced[0]!]
      return { vals, eqs, r1, r2 }
    },
    ({ vals, eqs, r1, r2 }) => {
      const sides = eqs.map((e) => e[3])
      return (
        new Set([vals.x, vals.y, vals.z]).size === 3 && new Set(sides.map(Math.abs)).size === 3 && sides.every((s) => s !== 0 && Math.abs(s) <= 20) &&
        !(eqs[1]![0] === eqs[2]![0] && eqs[1]![1] === eqs[2]![1]) &&
        det3(eqs[0]!, eqs[1]!, eqs[2]!) !== 0 && r1.A !== 0 && r1.B !== 0 && r2.A !== 0 && Math.abs(r2.B) === 1 &&
        r1.A + r1.B * (-r2.A / r2.B) !== 0 && notPrinted(vals[ask], sides)
      )
    },
  )
  const { vals, eqs, r1, r2 } = v
  const { x, y, z } = vals
  // y = mx + k from the second reduced equation.
  const m = -r2.A / r2.B
  const k = r2.C / r2.B
  const yParts: [number, string][] = r2.B === 1 ? [[k, ''], [m, 'x']] : [[m, 'x'], [k, '']]
  const substituted = sum([[r1.A, 'x'], [r1.B * k, ''], [r1.B * m, 'x']])
  const K = r1.A + r1.B * m
  const R = r1.C - r1.B * k
  const checkRow = eqs[1]!
  const prompt = `Solve $${eqTex(eqs[0]!)}$, $${eqTex(eqs[1]!)}$ and $${eqTex(eqs[2]!)}$. Give the value of $${ask}$.`
  const solution =
    `${r1.text}: $${lhs(r1.A, r1.B)} = ${r1.C}$. ${r2.text}: $${lhs(r2.A, r2.B)} = ${r2.C}$, so $y = ${sum(yParts)}$. ` +
    `Then $${substituted} = ${r1.C}$ gives ${K === 1 ? '' : `$${coef(K, 'x')} = ${R}$, so `}$x = ${x}$, $y = ${y}$, and $z = ${eqs[0]![3]} - ${sub(x)} - ${sub(y)} = ${z}$. ` +
    `Check the second: $${signed([checkRow[0] * x, checkRow[1] * y, checkRow[2] * z])} = ${checkRow[3]}$.`
  const answer = vals[ask]
  const back = solves(eqs.map(eqTex), { x, y, z })
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, ['eliminates z from two pairs'], minus(answer)), answer, tolerance: 0 },
    check: { agrees: back.agrees && det3(eqs[0]!, eqs[1]!, eqs[2]!) !== 0, detail: `${back.detail}; determinant ${det3(eqs[0]!, eqs[1]!, eqs[2]!)}` },
    values: { x, y, z, ask, e2: eqTex(eqs[1]!), e3: eqTex(eqs[2]!) },
  }
}

// ---------------------------------------------------------------------------------------
// q10: three unknowns by substitution. x + y + z = 10, x − y = 2, y − z = 1: x = 5.
// ---------------------------------------------------------------------------------------

type Letter = 'x' | 'y' | 'z'
const LETTERS: Letter[] = ['x', 'y', 'z']
/** How a letter O is tied to the pivot P: O − P = d, P − O = d, or O + P = s. */
type Tie = 'O-P' | 'P-O' | 'O+P'
const TIES = [['O-P', 40], ['P-O', 35], ['O+P', 25]] as const

/**
 * x + y + z = S with two equations each tying one other letter to a pivot, so both are
 * written in terms of the pivot and substituted. The solution is drawn first: three distinct
 * non-zero values; the asked value is never 1 nor a printed number. `turn` rotates the letter
 * asked, offset from q8's.
 */
function threeBySubstitution(r: Rng, slot: Question, turn: number): Draft {
  const ask = (['x', 'y', 'z'] as const)[turn % 3]!
  const v = draw(
    r,
    (r) => {
      const vals = { x: pm(r) * int(r, 1, 9), y: pm(r) * int(r, 1, 9), z: pm(r) * int(r, 1, 9) }
      const P = pick(r, LETTERS)
      const others = LETTERS.filter((l) => l !== P) as [Letter, Letter]
      const ties = [weighted(r, TIES), weighted(r, TIES)] as [Tie, Tie]
      return { vals, P, others, ties }
    },
    ({ vals, P, others, ties }) => {
      const rhs = others.map((O, i) => (ties[i] === 'O-P' ? vals[O] - vals[P] : ties[i] === 'P-O' ? vals[P] - vals[O] : vals[O] + vals[P]))
      const S = vals.x + vals.y + vals.z
      return (
        new Set([vals.x, vals.y, vals.z]).size === 3 && S !== 0 && rhs.every((d) => d !== 0) && new Set([S, ...rhs].map(Math.abs)).size === 3 &&
        Math.abs(vals[ask]) !== 1 && notPrinted(vals[ask], [S, ...rhs])
      )
    },
  )
  const { vals, P, others, ties } = v
  const S = vals.x + vals.y + vals.z
  const tied = others.map((O, i) => {
    const t = ties[i]!
    const d = t === 'O-P' ? vals[O] - vals[P] : t === 'P-O' ? vals[P] - vals[O] : vals[O] + vals[P]
    const equation = t === 'O-P' ? `${O} - ${P} = ${d}` : t === 'P-O' ? `${P} - ${O} = ${d}` : `${[O, P].sort().join(' + ')} = ${d}`
    const parts: [number, string][] = t === 'O-P' ? [[1, P], [d, '']] : t === 'P-O' ? [[1, P], [-d, '']] : [[d, ''], [-1, P]]
    return { O, d, equation, parts }
  })
  const e1 = `x + y + z = ${S}`
  const eqs = [e1, tied[0]!.equation, tied[1]!.equation]
  // The first equation with each other letter replaced, in x, y, z order, uncollected.
  const parts = LETTERS.flatMap((l) => (l === P ? [[1, P] as [number, string]] : tied.find((t) => t.O === l)!.parts))
  const K = parts.filter(([, v]) => v === P).reduce((s, [c]) => s + c, 0)
  const constant = parts.filter(([, v]) => v === '').reduce((s, [c]) => s + c, 0)
  const R = S - constant
  const prompt = `Solve $${eqs[0]}$, $${eqs[1]}$ and $${eqs[2]}$. Give the value of $${ask}$.`
  const solution =
    `From the second and third, $${tied[0]!.O} = ${sum(tied[0]!.parts)}$ and $${tied[1]!.O} = ${sum(tied[1]!.parts)}$. ` +
    `Substitute into the first: $${sum(parts)} = ${S}$, so ${K === 1 ? '' : `$${coef(K, P)} = ${R}$, `}$${P} = ${vals[P]}$, and $${tied[0]!.O} = ${vals[tied[0]!.O]}$, $${tied[1]!.O} = ${vals[tied[1]!.O]}$.`
  const answer = vals[ask]
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [`expresses ${tied[0]!.O} and ${tied[1]!.O} in terms of ${P}`], minus(answer)),
      answer,
      tolerance: 0,
    },
    check: solves(eqs, vals),
    values: { ...vals, pivot: P, ties: ties.join(' '), ask },
  }
}

// ---------------------------------------------------------------------------------------
// q14: three prices from three bills. Two coffees, a tea and a cake £9.50 …: a cake £2.25.
// ---------------------------------------------------------------------------------------

interface Shop {
  items: [string, string, string]
  plural: [string, string, string]
  /** Each item's price band in pence, [lowest, highest], in steps of `step`. */
  bands: [[number, number], [number, number], [number, number]]
  step: number
  /** [dearer, cheaper] item indexes that must hold, so the shop is consistent with itself. */
  dearer: [number, number][]
}

const SHOPS: Shop[] = [
  { items: ['coffee', 'tea', 'cake'], plural: ['coffees', 'teas', 'cakes'], bands: [[200, 475], [100, 300], [150, 400]], step: 25, dearer: [[0, 1]] },
  { items: ['loaf', 'roll', 'bun'], plural: ['loaves', 'rolls', 'buns'], bands: [[100, 350], [50, 150], [50, 200]], step: 25, dearer: [[0, 1], [0, 2]] },
  {
    items: ['adult ticket', 'child ticket', 'senior ticket'],
    plural: ['adult tickets', 'child tickets', 'senior tickets'],
    bands: [[600, 1200], [300, 700], [400, 900]],
    step: 50,
    dearer: [[0, 1], [0, 2], [2, 1]],
  },
  { items: ['pen', 'pencil', 'ruler'], plural: ['pens', 'pencils', 'rulers'], bands: [[50, 250], [30, 120], [40, 200]], step: 10, dearer: [[0, 1]] },
  { items: ['apple', 'banana', 'orange'], plural: ['apples', 'bananas', 'oranges'], bands: [[30, 80], [20, 60], [30, 90]], step: 10, dearer: [] },
  { items: ['burger', 'hot dog', 'milkshake'], plural: ['burgers', 'hot dogs', 'milkshakes'], bands: [[250, 600], [150, 450], [150, 400]], step: 25, dearer: [[0, 1]] },
]

/** The three bills: each item doubled in turn (as written), tripled in turn, or doubled twice with one plain bill. */
const PATTERNS = [
  ['doubled', [[2, 1, 1], [1, 2, 1], [1, 1, 2]], 60],
  ['tripled', [[3, 1, 1], [1, 3, 1], [1, 1, 3]], 15],
  ['one plain', [[2, 1, 1], [1, 2, 1], [1, 1, 1]], 25],
] as const

const WORDS = ['', 'a', 'two', 'three']
const an = (s: string) => (/^[aeiou]/.test(s) ? `an ${s}` : `a ${s}`)
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)
/** "Two coffees, a tea and a cake". */
function phrase(row: readonly number[], shop: Shop): string {
  const parts = row.map((n, i) => (n === 1 ? an(shop.items[i]!) : `${WORDS[n]} ${shop.plural[i]!}`))
  return `${parts[0]}, ${parts[1]} and ${parts[2]}`
}

function threePrices(r: Rng, slot: Question): Draft {
  const shop = pick(r, SHOPS)
  const [pattern, rows] = weighted(r, PATTERNS.map((p) => [[p[0], p[1]] as const, p[2]] as const))
  const which = int(r, 0, 2)
  const { prices, order } = draw(
    r,
    (r) => ({
      prices: shop.bands.map(([lo, hi]) => shop.step * int(r, lo / shop.step, hi / shop.step)),
      order: shuffle(r, [0, 1, 2]),
    }),
    ({ prices, order }) => {
      const totals = order.map((i) => rows[i]!.reduce((s, n, j) => s + n * prices[j]!, 0))
      return new Set(prices).size === 3 && new Set(totals).size === 3 && shop.dearer.every(([d, c]) => prices[d]! > prices[c]!)
    },
  )
  const bills = order.map((i) => ({ row: rows[i]!, total: rows[i]!.reduce((s, n, j) => s + n * prices[j]!, 0) }))
  const pounds = (pence: number) => show(pence / 100)
  const letters = ['x', 'y', 'z'] as const
  const L = letters[which]!
  const answer = prices[which]! / 100
  const prompt = `${bills.map((b) => `${cap(phrase(b.row, shop))} cost £${(b.total / 100).toFixed(2)}.`).join(' ')} Work out the price of ${an(shop.items[which]!)} in pounds.`
  const equations = bills.map((b) => `${sum([[b.row[0]!, 'x'], [b.row[1]!, 'y'], [b.row[2]!, 'z']])} = ${pounds(b.total)}`)
  const setUp = `With ${shop.items[0]} $x$, ${shop.items[1]} $y$ and ${shop.items[2]} $z$: ${equations.map((e) => `$${e}$`).join(', ')}.`
  const others = [0, 1, 2].filter((i) => i !== which)
  const checkAt = (i: number) => `check the ${ORD[i]}: $${signed(bills[i]!.row.map((n, j) => (n * prices[j]!) / 100))} = ${pounds(bills[i]!.total)}$`
  let working: string
  let sumOfAll = 0
  if (pattern === 'one plain') {
    const plain = bills.findIndex((b) => b.row.every((n) => n === 1))
    const doubledAt = (j: number) => bills.findIndex((b) => b.row[j] === 2)
    const T = bills[plain]!.total
    const [p0, p1] = [prices[0]!, prices[1]!]
    const line = (j: number) => `$${letters[j]} = ${pounds(bills[doubledAt(j)]!.total)} - ${pounds(T)} = ${pounds(prices[j]!)}$`
    working =
      `The ${ORD[plain]} equation gives $x + y + z = ${pounds(T)}$ directly. Subtracting it from the ${ORD[doubledAt(0)]} leaves ${line(0)}, and from the ${ORD[doubledAt(1)]}, ${line(1)}. ` +
      `Then $z = ${pounds(T)} - ${pounds(p0)} - ${pounds(p1)} = ${pounds(prices[2]!)}$; ${checkAt(doubledAt(0))}.`
  } else {
    const n = pattern === 'doubled' ? 4 : 5
    sumOfAll = bills.reduce((s, b) => s + b.total, 0)
    const total = sumOfAll / n
    const at = bills.findIndex((b) => b.row[which]! > 1)
    const leaves = pattern === 'doubled'
      ? `$${L} = ${pounds(bills[at]!.total)} - ${pounds(total)} = ${pounds(prices[which]!)}$`
      : `$2${L} = ${pounds(bills[at]!.total)} - ${pounds(total)} = ${pounds(2 * prices[which]!)}$, so $${L} = ${pounds(prices[which]!)}$`
    const likewise = others.map((i) => `$${letters[i]} = ${pounds(prices[i]!)}$`).join(' and ')
    working =
      `Adding all three gives $${n}(x + y + z) = ${pounds(sumOfAll)}$, so $x + y + z = ${pounds(total)}$. Subtracting that from the ${ORD[at]} equation leaves ${leaves}. ` +
      `Likewise ${likewise}; ${checkAt(others.map((i) => bills.findIndex((b) => b.row[i]! > 1)).find((i) => i !== at)!)}.`
  }
  // Second route: each bill read back from the words, counts and total, against the prices.
  const gaps = [...prompt.matchAll(/([A-Z][^.]*?) cost £(\d+\.\d\d)\./g)].map((m) => {
    const count = (i: number) => {
      const w = new RegExp(`\\b(a|an|two|three) (${shop.items[i]}|${shop.plural[i]})\\b`, 'i').exec(m[1]!)
      return w ? WORDS.indexOf(w[1]!.toLowerCase().replace('an', 'a')) : 0
    }
    return [0, 1, 2].reduce((s, i) => s + count(i) * prices[i]!, 0) - Math.round(Number(m[2]) * 100)
  })
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `${setUp} ${working}`,
      markScheme: scheme(slot, ['three equations'], show(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: gaps.length === 3 && gaps.every((g) => g === 0), detail: `bills read from the words against the prices ${prices.join(', ')}p: gaps ${gaps.join(', ')}` },
    values: { shop: shop.items[0]!, pattern, which, prices: prices.join(' '), order: order.join('') },
  }
}

// ---------------------------------------------------------------------------------------
// q11: a tangent by the discriminant. y = 2x + c touches y = x² + 4: c = 3.
// ---------------------------------------------------------------------------------------

/**
 * y = mx + c against y = ±x² + bx + k: equating gives x² + (b − m)x + (k − c) = 0 (or its
 * negative), a repeated root when (b − m)² = 4(k − c). m is even and b even or zero, so c is
 * whole; the curve is never y = x² (q18 on the same sheet). No slip pays: c = k, the 4
 * dropped or halved, the sign of the square turned, or a printed number. The second route is
 * numeric: the printed curve and line, with c put in, meet at the touch and do not cross.
 */
function tangentByDiscriminant(r: Rng, slot: Question): Draft {
  const { a, m, b, k, c } = draw(
    r,
    (r) => {
      const a = r() < 0.8 ? 1 : -1
      const m = pm(r) * pick(r, [2, 2, 4, 4, 6, 8])
      const b = r() < 0.65 ? 0 : pm(r) * pick(r, [2, 4])
      const k = pm(r) * int(r, 1, 12)
      return { a, m, b, k, c: k - (a * (m - b) ** 2) / 4 }
    },
    ({ a, m, b, k, c }) => {
      const d = (m - b) ** 2
      const slips = [k, k - a * d, k + (a * d) / 4, k - (a * d) / 2, -c]
      return m !== b && c !== 0 && Math.abs(c) <= 30 && !slips.includes(c) && notPrinted(c, [m, b, k]) && new Set([Math.abs(m), Math.abs(b), Math.abs(k)].filter((v) => v !== 0)).size === (b === 0 ? 2 : 3)
    },
  )
  const curve = poly([k, b, a])
  const line = sum([[m, 'x'], [1, 'c']])
  // Everything on one side with x² positive: x² + Bx + (bracket) = 0.
  const B = a === 1 ? b - m : m - b
  const bracket = a === 1 ? sum([[k, ''], [-1, 'c']]) : sum([[1, 'c'], [-k, '']])
  const quad = `${sum([[1, 'x^2'], [B, 'x']])} + (${bracket})`
  const plainQuad = sum(a === 1 ? [[1, 'x²'], [B, 'x'], [k, ''], [-1, 'c']] : [[1, 'x²'], [B, 'x'], [1, 'c'], [-k, '']])
  const x0 = -B / 2
  const y0 = m * x0 + c
  const prompt = pick(r, [
    `The line $y = ${line}$ is a tangent to the curve $y = ${curve}$. Work out the value of $c$.`,
    `Find the value of $c$ for which the line $y = ${line}$ is a tangent to the curve $y = ${curve}$.`,
  ])
  const solution =
    `Equate: $${curve} = ${line}$, so $${quad} = 0$. A tangent gives a repeated root, so the discriminant is zero: $${B * B} - 4(${bracket}) = 0$, ` +
    `so $4(${bracket}) = ${B * B}$, $${bracket} = ${(B * B) / 4}$ and $c = ${c}$. The touch is at $x = ${x0}$, $(${x0}, ${y0})$.`
  // Second route: the printed curve minus the printed line, with c put in, is zero at the touch
  // and has one sign either side of it: it touches without crossing.
  const texts = [...prompt.matchAll(/\$y = ([^$]+)\$/g)].map((x) => x[1]!)
  const lineTex = texts.find((t) => t.includes('c'))!
  const curveTex = texts.find((t) => !t.includes('c'))!
  const g = (x: number) => evalTex(curveTex, { x }) - evalTex(lineTex, { x, c })
  const touches = near(g(x0), 0) && g(x0 - 1) * g(x0 + 1) > 0 && g(x0 - 0.5) * g(x0 + 0.5) > 0
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [`discriminant of ${minus(plainQuad)}`], minus(c)),
      answer: c,
      tolerance: 0,
    },
    check: { agrees: touches, detail: `curve minus line with c = ${c} at x = ${x0}: ${g(x0)}; either side ${g(x0 - 1)}, ${g(x0 + 1)}` },
    values: { a, m, b, k, c, x0 },
  }
}

// ---------------------------------------------------------------------------------------
// q16: a product and a difference. xy = 12 and x − y = 1: the positive x is 4.
// ---------------------------------------------------------------------------------------

/**
 * xy = P with x − y = d (three times in four) or x + y = s. The positive solution (p, q) is
 * drawn first, both 2 to 12 with a product of at most 60 and distinct, so with the difference the other solution is
 * (−q, −p) and exactly one x (or y) is positive; with the sum both are positive and the
 * larger is asked. The asked value is never P or the difference, and the specification's
 * xy = 8, x + y = 6 (q6 on the higher sheet) is left out.
 */
function productPair(r: Rng, slot: Question): Draft {
  const form = r() < 0.75 ? 'difference' : 'sum'
  const askY = form === 'difference' && r() < 0.3
  const { p, q } = draw(
    r,
    (r) => ({ p: int(r, 2, 12), q: int(r, 2, 12) }),
    ({ p, q }) => {
      if (p === q || p * q > 60) return false
      if (form === 'sum') return !(p * q === 8 && p + q === 6) && notPrinted(Math.max(p, q), [p * q, p + q])
      return notPrinted(askY ? q : p, [p * q, p - q])
    },
  )
  const P = p * q
  const productFirst = r() < 0.7
  let second: string
  let solution: string
  let quad: string
  let answer: number
  let pairs: [number, number][]
  let wording: string
  if (form === 'difference') {
    const d = p - q
    second = `x - y = ${d}`
    pairs = [[p, q], [-q, -p]]
    if (askY) {
      const xExpr = sum([[1, 'y'], [d, '']])
      quad = poly([-P, d, 1], 'y')
      solution = `$x = ${xExpr}$, so $y(${xExpr}) = ${P}$ and $${quad} = 0$, giving $(y - ${q})(y + ${p}) = 0$. $y = ${q}$, $x = ${p}$ or $y = ${-p}$, $x = ${-q}$. The positive $y$ is $${q}$.`
      answer = q
      wording = 'the positive value of $y$'
    } else {
      const yExpr = sum([[1, 'x'], [-d, '']])
      quad = poly([-P, -d, 1])
      solution = `$y = ${yExpr}$, so $x(${yExpr}) = ${P}$ and $${quad} = 0$, giving $(x - ${p})(x + ${q}) = 0$. $x = ${p}$, $y = ${q}$ or $x = ${-q}$, $y = ${-p}$. The positive $x$ is $${p}$.`
      answer = p
      wording = 'the positive value of $x$'
    }
  } else {
    const s = p + q
    const [lo, hi] = [Math.min(p, q), Math.max(p, q)]
    second = `x + y = ${s}`
    pairs = [[p, q], [q, p]]
    quad = poly([P, -s, 1])
    solution = `$y = ${s} - x$, so $x(${s} - x) = ${P}$, which rearranges to $${quad} = 0$, giving $(x - ${lo})(x - ${hi}) = 0$. $x = ${lo}$, $y = ${hi}$ or $x = ${hi}$, $y = ${lo}$. The larger $x$ is $${hi}$.`
    answer = hi
    wording = 'the larger value of $x$'
  }
  const first = `xy = ${P}`
  const prompt = `Solve $${productFirst ? first : second}$ and $${productFirst ? second : first}$. Give ${wording}.`
  // Second route: both solution pairs satisfy both printed equations, and the answer is the
  // one positive (or the larger) value of the letter asked among them.
  const eqs = [first, second]
  const hold = pairs.every(([x, y]) => eqs.every((e) => near(evalEquation(e, { x, y }), 0)))
  const asked = pairs.map(([x, y]) => (askY ? y : x))
  const unique = form === 'difference' ? asked.filter((v) => v > 0).length === 1 && asked.includes(answer) && answer > 0 : Math.max(...asked) === answer
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [`${minus(quad.replace(/\^2/, '²'))} = 0`], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: hold && unique, detail: `pairs ${pairs.map(([x, y]) => `(${x}, ${y})`).join(' and ')} in ${eqs.join(' and ')}: ${hold}; asked values ${asked.join(', ')}` },
    values: { form, p, q, P, askY: String(askY) },
  }
}

export const simultaneousGenerators: Generator[] = [
  fmBySlot('fm-simultaneous-linear', TOPIC, { q1: substitutionPair, q5: bothScaled }),
  fmBySlot('fm-three-unknowns', TOPIC, { q8: threeByElimination, q10: threeBySubstitution, q14: threePrices }),
  fmBySlot('fm-line-and-curve', TOPIC, { q11: tangentByDiscriminant, q16: productPair }),
]
