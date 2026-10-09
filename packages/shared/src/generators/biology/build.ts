import type { Question } from '../../content/questions.ts'
import { atMost, cap } from '../physics/build.ts'
import { pick, type Rng } from '../random.ts'
import { an } from '../chemistry/build.ts'

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
