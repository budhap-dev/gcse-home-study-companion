import type { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { atMost, cap, figures } from '../physics/build.ts'
import { clearAtSigFigs, sfTolerance, sigFigs, sigText } from '../physics/format.ts'
import { pick, type Rng } from '../random.ts'
import { an, clean, places, toPlaces } from '../chemistry/build.ts'

/**
 * What the Biology generator files share beyond the subject-free helpers in ../physics/build.ts,
 * ../physics/format.ts and ../chemistry/build.ts (evenly, byFirst, shiftFree, an, word and the
 * rest are used from there, never copied). Each helper was written in one file and copied into
 * the next; this is the one copy. The draw helpers cache their candidates by key in one map for
 * all files, so a key starts with its generator's id.
 */

// ---------------------------------------------------------------------------------------------
// Slots and figures
// ---------------------------------------------------------------------------------------------

/** The written slot's units field, which every generated question keeps. */
export const unitsOf = (slot: Question) => (slot.type === 'numeric' ? slot.units : undefined)
/** lo ≤ x ≤ hi, allowing for binary residue at either end. */
export const between = (x: number, [lo, hi]: readonly [number, number]) => x >= lo - 1e-9 && x <= hi + 1e-9
/** A whole number, allowing for binary residue: 3.0000000000000004 is whole. */
export const whole = (x: number) => atMost(x, 0)
/** x lies on a grid of `step`: 12.5 is on the 0.5 grid, 12.3 is not. */
export const onGrid = (x: number, step: number) => Math.abs(x / step - Math.round(x / step)) < 1e-9
/** Greatest common divisor of two whole numbers. */
export const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
/** Least common multiple of two whole numbers. */
export const lcm = (a: number, b: number) => (a * b) / gcd(a, b)

// ---------------------------------------------------------------------------------------------
// Answers: exact to three figures, or rounded to three
// ---------------------------------------------------------------------------------------------

/** Exact to `dp` decimal places, with at most three significant figures. */
export const tidy = (x: number, dp = 2) => atMost(x, dp) && figures(clean(x)) <= 3
/** An exact answer's room: half a unit in the last place it prints (capped at 1.9%), none for a whole number. */
export const halfLastPlace = (x: number) => toPlaces(x, places(x))
/** x cut (not rounded) to n significant figures, as a calculator display is read: 23.4375 to 5 is "23.437". */
export function cut(x: number, n: number): string {
  const e = Math.floor(Math.log10(Math.abs(x)))
  const dp = Math.max(0, n - 1 - e)
  return (Math.floor(x * 10 ** dp + 1e-9) / 10 ** dp).toFixed(dp)
}
/** x to `dp` places, with an ellipsis when it runs on: 20.761\ldots, or 20.8 when it ends there. */
export const trail = (x: number, dp: number) => (atMost(x, dp) ? show(x) : `${(Math.floor(x * 10 ** dp + 1e-9) / 10 ** dp).toFixed(dp)}\\ldots`)
/** The full value as a calculator shows it: all of it when it ends within six places, else cut to six figures. */
export const full = (x: number) => (atMost(x, 6) ? show(x) : `${cut(x, 6)}\\ldots`)

/** A calculated answer: itself when it has three figures at most, else its 3-figure rounding. */
export interface Figure {
  exact: number
  answer: number
  rounded: boolean
}
export const toThree = (x: number): Figure => (tidy(x, 4) ? { exact: x, answer: clean(x), rounded: false } : { exact: x, answer: sigFigs(x, 3), rounded: true })
/** Rounds clearly, and does not end in a 0 the answer box would drop (24.0 prints as 24). */
export const fair = (f: Figure) => !f.rounded || (clearAtSigFigs(f.exact, 3) && sigText(f.exact, 3) === show(f.answer))
/** Half a unit in the last place of an exact answer, or in the third figure of a rounded one. */
export const figureTolerance = (f: Figure) => (f.rounded ? sfTolerance(f.answer, 3) : halfLastPlace(f.answer))
/** The end of a working in maths: "= 25$" or "= 23.4375$, which is 23.4 to 3 significant figures". */
export const ending = (f: Figure, unit = '') =>
  f.rounded ? `= ${full(f.exact)}$${unit}, which is ${show(f.answer)}${unit} to 3 significant figures` : `= ${show(f.answer)}$${unit}`

/**
 * The room for a student who uses π = 3.14: the gap from the answer to the unrounded 3.14 value,
 * plus half a unit for each rounding the working may take (one for a circle; two for a ring, whose
 * two areas may each be rounded first), and never less than half a unit at 1 decimal place.
 */
export const piRoom = (answer: number, raw314: number, roundings: number) => clean(Math.max(0.05, Math.abs(answer - raw314) + 0.05 * roundings))

// ---------------------------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------------------------

/** "7, 9, 6, 8 and 10". */
export const list = (xs: (number | string)[]) => `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`
/** "a cheek cell", "an onion epidermis cell", "a *Paramecium*": the article ignores the italics. */
export const withArticle = (noun: string) => an(noun.replace(/^\*/, '')) + ' ' + noun
/** The same at the start of a sentence: "A cheek cell", "An onion epidermis cell". */
export const WithArticle = (noun: string) => cap(withArticle(noun))

// ---------------------------------------------------------------------------------------------
// Draws
// ---------------------------------------------------------------------------------------------

/** A value built once per key: a pool of candidates that several draws read. */
const MEMO = new Map<string, unknown>()
export function memo<T>(key: string, make: () => T): () => T {
  return () => {
    if (!MEMO.has(key)) MEMO.set(key, make())
    return MEMO.get(key) as T
  }
}

/**
 * A candidate drawn evenly at each level in turn: among the values of the first key, then of the
 * second among the candidates left, and so on. The answer first then an input keeps one starting
 * mass that divides cleanly (4.00 g, 1.25 g) from filling a context, as drawing the answer alone
 * let it; an input first then the answer does the same for a time or a field of view. The pool
 * is built once per key; the levels may differ from one call to the next.
 */
const LAYERS = new Map<string, unknown[]>()
export function layered<T>(r: Rng, key: string, make: () => T[], ...levels: ((t: T) => number | string)[]): T {
  let pool = LAYERS.get(key) as T[] | undefined
  if (!pool) {
    pool = make()
    if (!pool.length) throw new Error(`no candidates for ${key}`)
    LAYERS.set(key, pool)
  }
  for (const level of levels) {
    const value: number | string = pick(r, [...new Set(pool.map(level))])
    pool = pool.filter((t) => level(t) === value)
  }
  return pick(r, pool)
}

/**
 * Only the candidates whose first key goes with at least `n` values of the second (and then of
 * any further keys, each in turn): an answer that several inputs give, so drawing the answer first
 * cannot fix the input, or an input that allows several answers, so drawing the input first
 * cannot fix the answer.
 */
export function rich<T>(pool: T[], first: (t: T) => number, second: (t: T) => number, n = 3, ...more: ((t: T) => number)[]): T[] {
  return [second, ...more].reduce((left, key) => {
    const seen = new Map<number, Set<number>>()
    for (const t of left) seen.set(first(t), (seen.get(first(t)) ?? new Set()).add(key(t)))
    return left.filter((t) => seen.get(first(t))!.size >= n)
  }, pool)
}

/**
 * A candidate drawn so that no value of any key is much likelier than another: the candidates'
 * weights are scaled, key by key and round after round, until each value of each key carries
 * about the same share (iterative proportional fitting). Where a time, a mass and the answer all
 * have to be spread, no order of drawing them one after another does it: the mass first let one
 * answer fill a context, the answer first let one mass. The last key is matched exactly; the
 * others as nearly as the candidates allow. Weights are built once per key.
 */
const BALANCED = new Map<string, { items: unknown[]; cumulative: number[] }>()
export function balanced<T>(r: Rng, key: string, make: () => T[], ...keys: ((t: T) => number | string)[]): T {
  let b = BALANCED.get(key)
  if (!b) {
    const items = make()
    if (!items.length) throw new Error(`no candidates for ${key}`)
    const w = items.map(() => 1)
    for (let round = 0; round < 20; round++) {
      for (const k of keys) {
        const totals = new Map<number | string, number>()
        items.forEach((t, i) => totals.set(k(t), (totals.get(k(t)) ?? 0) + w[i]!))
        items.forEach((t, i) => (w[i]! /= totals.get(k(t))! * totals.size))
      }
    }
    let sum = 0
    b = { items, cumulative: w.map((x) => (sum += x)) }
    BALANCED.set(key, b)
  }
  const target = r() * b.cumulative.at(-1)!
  let lo = 0
  let hi = b.cumulative.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (b.cumulative[mid]! < target) lo = mid + 1
    else hi = mid
  }
  return b.items[lo] as T
}
