import { ELEMENTS } from '../../elements.ts'
import { show } from '../format.ts'
import { figures, near } from '../physics/build.ts'
import { sfTolerance } from '../physics/format.ts'
import { pick, type Rng } from '../random.ts'

/**
 * What every Chemistry generator file needs beyond the Physics helpers (`../physics/build.ts`
 * and `../physics/format.ts` hold the subject-free ones: near, atMost, stepped, tex, closes,
 * numeric, sigFigs, dpTolerance). Relative atomic masses come from the AQA periodic table
 * insert as `elements.ts` holds it, so a generated Cu is 63.5 and Cl 35.5, never a value
 * recalled from elsewhere.
 */

/** Relative atomic mass by symbol, for the elements whose mass the insert prints without brackets. */
export const AR: Record<string, number> = Object.fromEntries(
  ELEMENTS.filter((e) => !e.mass.startsWith('[')).map((e) => [e.symbol, Number(e.mass)]),
)

/** One part of a formula: an element or a bracketed group, with how many of it there are. */
export type Part = { symbol: string; n: number } | { group: Part[]; n: number }

/** Reads "Ca(OH)2", "CuSO4" or "Al2(SO4)3" into parts in written order. */
export function parse(formula: string): Part[] {
  let i = 0
  const count = () => {
    const m = /^\d+/.exec(formula.slice(i))
    if (!m) return 1
    i += m[0].length
    return Number(m[0])
  }
  const run = (): Part[] => {
    const parts: Part[] = []
    while (i < formula.length && formula[i] !== ')') {
      if (formula[i] === '(') {
        i++
        const group = run()
        if (formula[i] !== ')') throw new Error(`Unclosed bracket in ${formula}`)
        i++
        parts.push({ group, n: count() })
        continue
      }
      const m = /^[A-Z][a-z]?/.exec(formula.slice(i))
      if (!m || AR[m[0]] === undefined) throw new Error(`Unknown element at ${i} in ${formula}`)
      i += m[0].length
      parts.push({ symbol: m[0], n: count() })
    }
    return parts
  }
  const parts = run()
  if (i !== formula.length) throw new Error(`Unexpected ) in ${formula}`)
  return parts
}

const sum = (parts: Part[]): number =>
  parts.reduce((t, p) => t + p.n * ('symbol' in p ? AR[p.symbol]! : sum(p.group)), 0)

/** Relative formula mass, cleaned of binary residue: Ca(OH)2 is 74, CuCl2 is 134.5. */
export const mr = (formula: string) => Number(show(sum(parse(formula))))

/** The atoms of each element in a formula, brackets multiplied out: Ca(OH)2 gives Ca 1, O 2, H 2. */
export function atoms(formula: string): Record<string, number> {
  const out: Record<string, number> = {}
  const add = (parts: Part[], k: number) => {
    for (const p of parts) {
      if ('symbol' in p) out[p.symbol] = (out[p.symbol] ?? 0) + p.n * k
      else add(p.group, p.n * k)
    }
  }
  add(parse(formula), 1)
  return out
}

/**
 * The working for Mr in the written questions' style, without the "= Mr": H2O is
 * "(2 \times 1) + 16", CaCO3 "40 + 12 + (3 \times 16)", Mg(OH)2 "24 + 2 \times (16 + 1)".
 */
export function mrWorking(formula: string): string {
  const term = (p: Part, top: boolean): string => {
    if ('symbol' in p) return p.n === 1 ? show(AR[p.symbol]!) : `(${p.n} \\times ${show(AR[p.symbol]!)})`
    const inner = p.group.map((q) => term(q, false)).join(' + ')
    return p.n === 1 ? inner : `${top ? '' : '('}${p.n} \\times (${inner})${top ? '' : ')'}`
  }
  return parse(formula).map((p) => term(p, true)).join(' + ')
}

const SUB = '₀₁₂₃₄₅₆₇₈₉'
/** A formula with Unicode subscripts, as most written prompts print it: CaCO₃, Al₂(SO₄)₃. */
export const sub = (formula: string) => formula.replace(/\d/g, (d) => SUB[Number(d)]!)

/** A formula inside maths, as the written solutions print it: \mathrm{Al_2(SO_4)_3}, \mathrm{C_8H_{18}}. */
export const mathrm = (formula: string) => `\\mathrm{${formula.replace(/(\d+)/g, (d) => (d.length > 1 ? `_{${d}}` : `_${d}`))}}`

/** The "Relative atomic masses: Ca 40, C 12, O 16." sentence, elements in the order the formulae first use them. */
export function arLine(...formulae: string[]): string {
  const seen: string[] = []
  for (const f of formulae) for (const s of Object.keys(atoms(f))) if (!seen.includes(s)) seen.push(s)
  return `Relative atomic masses: ${seen.map((s) => `${s} ${show(AR[s]!)}`).join(', ')}.`
}

// ---------------------------------------------------------------------------------------------
// Figures: the checks every Chemistry generator draws its numbers through
// ---------------------------------------------------------------------------------------------

/** A figure cleaned of binary residue. */
export const clean = (x: number) => Number(show(x))
/** lo, lo + step, … hi, free of binary residue. */
export const range = (lo: number, hi: number, step = 1) => Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => clean(lo + i * step))
/** a and b are the same figure, or the same digits with the point moved: a ÷ b is a power of ten. */
export const tenfold = (a: number, b: number) => {
  const l = Math.log10(Math.abs(a / b))
  return Number.isFinite(l) && Math.abs(l - Math.round(l)) < 1e-9
}
/** 1, 10, 0.1, 0.01: multiplying or dividing by one moves only the point. */
export const powerOfTen = (x: number) => tenfold(x, 1)
/** No two figures the same, or the same with the point moved. */
export const distinct = (...xs: number[]) => xs.every((x, i) => xs.slice(i + 1).every((y) => !tenfold(x, y)))
/** An answer that is none of the givens, nor one with the point moved, doubled or halved. */
export const clearOf = (answer: number, ...givens: number[]) => givens.every((g) => !tenfold(answer, g) && !near(answer, 2 * g) && !near(2 * answer, g))
/**
 * Not a given, nor one doubled or halved, with or without the point moved: the answer to
 * 35 g/dm³ in 50 cm³ (1.75 g) is 35 halved with the point moved, and a student who halves gets it.
 */
export const shiftFree = (answer: number, ...givens: number[]) => givens.every((g) => !tenfold(answer, g) && !tenfold(answer, 2 * g) && !tenfold(2 * answer, g))
/** Multiplying or dividing by 1 is no step. */
export const noOnes = (...xs: number[]) => xs.every((x) => !near(x, 1))
/** The decimal places x prints with: 2 for 0.25, 0 for 40. */
export const places = (x: number) => (show(x).includes('.') ? show(x).split('.')[1]!.length : 0)
/**
 * Half a unit in the `dp`-th decimal place, capped at 1.9% as dpTolerance is, and none at no
 * places. A slot passes the places its givens carry, not only the answer's printed ones:
 * 0.79, 0.83 and 0.78 g have a mean of 0.80, which prints as 0.8, and dpTolerance(0.8) would
 * mark 0.81 right.
 */
export const toPlaces = (x: number, dp: number) => (dp <= 0 ? 0 : Number(Math.min(0.5 * 10 ** -dp, Math.abs(x) * 0.019).toPrecision(10)))

/**
 * A calculated answer the prompt gives no precision for, widened so its three-figure rounding
 * is marked right: 0.24 × 43 = 10.32 g, and 10.3 g is how a student writes it. Only for
 * answers with more than three figures that come from multiplying or dividing; a sum such as
 * an Mr (134.5) or a mass difference (11.88 g) stays exact.
 */
export const threeFigures = (tolerance: number, answer: number) =>
  figures(answer) > 3 ? Math.max(tolerance, sfTolerance(answer, 3)) : tolerance

/**
 * Every candidate a slot allows, grouped by its answer and built once per key. A build draws
 * the answer evenly first and then a candidate that gives it, so an answer that many
 * candidates share (the values that divide cleanly most often) is no likelier than any other.
 * Keys are global: each caller prefixes its own with its generator or slot.
 */
const POOLS = new Map<string, { answers: number[]; groups: Map<number, unknown[]> }>()
export function evenly<T>(r: Rng, key: string, make: () => T[], answerOf: (t: T) => number): T {
  let pool = POOLS.get(key)
  if (!pool) {
    const groups = new Map<number, T[]>()
    for (const t of make()) {
      const a = answerOf(t)
      const g = groups.get(a)
      if (g) g.push(t)
      else groups.set(a, [t])
    }
    if (!groups.size) throw new Error(`no candidates for ${key}`)
    pool = { answers: [...groups.keys()], groups: groups as Map<number, unknown[]> }
    POOLS.set(key, pool)
  }
  return pick(r, pool.groups.get(pick(r, pool.answers))!) as T
}

/**
 * One input first, evenly among the values that allow at least `min` answers, then an answer
 * evenly among the draws it allows. Drawing the answer alone let one burette concentration fill
 * 45% of a context (0.0500 mol/dm³ gives the most exact answers) and one volume 88% of the
 * sea-water samples: the value that divides most cleanly wins.
 */
export function byFirst<T>(r: Rng, key: string, make: () => T[], first: (x: T) => number, answerOf: (x: T) => number, min = 1): T {
  const usable = () => {
    const all = make()
    return [...new Set(all.map(first))].filter((f) => new Set(all.filter((x) => first(x) === f).map(answerOf)).size >= min)
  }
  const f = evenly(r, `${key}:first`, usable, (x) => x)
  return evenly(r, `${key}:${f}`, () => make().filter((x) => first(x) === f), answerOf)
}

// ---------------------------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------------------------

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
/** Small counts in words, as the written mark schemes put them: "multiplies oxygen by three". */
export const word = (n: number) => WORDS[n] ?? String(n)
/** "a" or "an" before a word: an oxide ion, a sodium ion. */
export const an = (w: string) => (/^[aeiou]/i.test(w) ? 'an' : 'a')
/** A balance reading's last two digits, in hundredths of a gram: 4.87 g gives 87. */
export const hundredths = (x: number) => Math.round(x * 100) % 100

// ---------------------------------------------------------------------------------------------
// Equations
// ---------------------------------------------------------------------------------------------

export interface Term {
  n: number
  f: string
}
export interface Equation {
  /** As written in the source: '2Mg + O2 -> 2MgO'. */
  text: string
  left: Term[]
  right: Term[]
}

/** The atoms on one side of an equation, balancing numbers multiplied in. */
export function count(terms: Term[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const t of terms) for (const [s, k] of Object.entries(atoms(t.f))) out[s] = (out[s] ?? 0) + k * t.n
  return out
}
export function balanced(eq: Equation): boolean {
  const l = count(eq.left)
  const r = count(eq.right)
  const keys = new Set([...Object.keys(l), ...Object.keys(r)])
  return [...keys].every((k) => l[k] === r[k])
}
/** Reads '2Mg + O2 -> 2MgO', and refuses an equation that does not balance. */
export function equation(text: string): Equation {
  const side = (s: string) =>
    s.split(' + ').map((t) => {
      const m = /^(\d*)(\S+)$/.exec(t.trim())
      if (!m) throw new Error(`Bad term ${t} in ${text}`)
      return { n: m[1] ? Number(m[1]) : 1, f: m[2]! }
    })
  const [l, r] = text.split(' -> ')
  const eq = { text, left: side(l!), right: side(r!) }
  if (!balanced(eq)) throw new Error(`Unbalanced equation: ${text}`)
  return eq
}
const term = (t: Term) => `${t.n > 1 ? t.n : ''}${sub(t.f)}`
/** The equation as the prompts print it: Mg + 2HCl → MgCl₂ + H₂. */
export const written = (eq: Equation) => `${eq.left.map(term).join(' + ')} → ${eq.right.map(term).join(' + ')}`
/** The equation in maths: "2\mathrm{H_2O_2} \rightarrow 2\mathrm{H_2O} + \mathrm{O_2}". */
export const equationTex = (eq: Equation) =>
  [eq.left, eq.right].map((side) => side.map((t) => `${t.n > 1 ? t.n : ''}${mathrm(t.f)}`).join(' + ')).join(' \\rightarrow ')
/** The balancing number of a formula in an equation. */
export function coef(eq: Equation, f: string): number {
  const t = [...eq.left, ...eq.right].find((x) => x.f === f)
  if (!t) throw new Error(`${f} is not in ${eq.text}`)
  return t.n
}
