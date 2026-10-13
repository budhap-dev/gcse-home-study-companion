import { draw, int, pick } from '../random.ts'
import type { Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'
import { sub } from '../maths/formulae.ts'
import { fromTex, mathIn, poly, polyOf, sumOf } from '../maths/quadratics.ts'
import { minus } from './build.ts'

/**
 * Further Maths (AQA 8365): expanding-and-the-binomial-expansion and
 * factorising-at-further-maths-level.
 *
 * 2.6  Expanding brackets and collecting like terms: the specification's own
 *      (y² − 2y + 3)(2y − 1) − 2(y³ − 3y² + 4y − 2), one coefficient asked.
 * 2.7  Expand (a + b)^n for positive integer n, with Pascal's triangle: a coefficient of a
 *      cube, of (1 + kx)^n, of (c + kx)^n, and of (x + b)^n read from the right end of the row.
 * 2.8  Factorising: the difference of two squares used on numbers, 76² − 24².
 */

const EXPAND = 'expanding-and-the-binomial-expansion'
const FACTORISE = 'factorising-at-further-maths-level'

/** Unicode superscript digits for a plain-text mark scheme line: 3⁴. */
export const sup = (n: number) => String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]!).replace('-', '⁻')

/** n choose k, from the row of Pascal's triangle built by adding. */
export function pascalRow(n: number): number[] {
  let row = [1]
  for (let i = 0; i < n; i++) row = [1, ...row.slice(1).map((c, j) => c + row[j]!), 1]
  return row
}
const choose = (n: number, k: number) => pascalRow(n)[k]!

/** The letter a term is written in: x most often, as the written questions are. */
const LETTERS = ['x', 'x', 'x', 'y', 't', 'p'] as const

/** v^k as TeX: x, x^2. Never x^1. */
const vPow = (v: string, k: number) => (k === 1 ? v : `${v}^${k}`)
/** c^k as TeX with a negative bracketed: 3, 3^2, (-3)^2, (-3). */
const cPow = (c: number, k: number) => (k === 1 ? sub(c) : `${sub(c)}^${k}`)
/** The letter part raised to a power, with its sign: x^4, (-x)^4, (-x). */
const lPow = (s: number, v: string, k: number) => (s === 1 ? vPow(v, k) : k === 1 ? `(-${v})` : `(-${v})^${k}`)

/**
 * A bracket (A + B)^n, one term a letter with coefficient ±1 or ±k, the other a whole
 * number. `letterFirst` keeps the order printed.
 */
interface Bracket {
  v: string
  /** The letter's coefficient. */
  k: number
  /** The constant. */
  c: number
  n: number
  letterFirst: boolean
}

const bracketTex = ({ v, k, c, n, letterFirst }: Bracket) => {
  const inner = letterFirst ? sumOf([[k, 1], [c, 0]], v) : `${c} ${k < 0 ? '-' : '+'} ${sumOf([[Math.abs(k), 1]], v)}`
  return `(${inner})^${n}`
}

/** The coefficient of v^r in the bracket, by the binomial formula: C(n, r) k^r c^(n−r). */
const coefficient = ({ k, c, n }: Bracket, r: number) => choose(n, r) * k ** r * c ** (n - r)

/** Second route: multiply the printed bracket out by brute force and read the coefficient. */
function expandedCheck(math: string, v: string, r: number, answer: number) {
  const tex = mathIn(math)
  const p = polyOf(fromTex(tex), v)
  const read = p?.[r]
  return { agrees: read === answer, detail: `${tex} multiplied out: ${p ? poly(p, v) : 'unreadable'}; coefficient of ${v}^${r} ${read}` }
}

// ---------------------------------------------------------------------------------------
// q2: a cube. (x + 3)^3, the coefficient of x^2.
// ---------------------------------------------------------------------------------------

/**
 * The coefficient of x² or x in a cube: written as q2, (x + 3)³. Either sign, either order,
 * a constant of 2 to 10 but not 3, so that neither the bare Pascal entry 3 nor the constant
 * left unsquared gives the answer.
 */
export const binomialCube: Generator = {
  id: 'fm-binomial-cube',
  subjectId: 'further-maths',
  topicId: EXPAND,
  replaces: ['q2'],
  build(r, slot): Draft {
    const v = pick(r, LETTERS)
    const power = r() < 0.6 ? 2 : 1
    // Never 3, the cube's own power and Pascal entry (3 × 3 and 3² pay for slips), and for the x
    // term never 2: 3 × 2² is what 3 × 2 × 2 also gives.
    const size = pick(r, power === 1 ? [4, 5, 6, 7, 8, 9, 10] : [2, 4, 5, 6, 7, 8, 9, 10])
    const form = pick(r, ['x+b', 'x+b', 'x-b', 'x-b', 'b+x', 'b-x'] as const)
    const B: Bracket = { v, n: 3, letterFirst: form[0] === 'x', k: form === 'b-x' ? -1 : 1, c: form === 'x-b' ? -size : size }
    const answer = coefficient(B, power)
    const C = choose(3, power)
    const tex = bracketTex(B)
    const ask = `$${vPow(v, power)}$`
    const prompt = r() < 0.7 ? `In the expansion of $${tex}$, what is the coefficient of ${ask}?` : `Find the coefficient of ${ask} in the expansion of $${tex}$.`
    const parts = B.letterFirst ? [lPow(B.k, v, power), cPow(B.c, 3 - power)] : [cPow(B.c, 3 - power), lPow(B.k, v, power)]
    const full = polyOf(fromTex(tex), v)!
    return {
      question: {
        type: 'numeric',
        prompt,
        solution: `Row 3 gives $1, 3, 3, 1$, so the ${ask} term is $${C} \\times ${parts.join(' \\times ')} = ${sumOf([[answer, power]], v)}$. The full cube is $${poly(full, v)}$.`,
        markScheme: scheme(slot, [], minus(answer)),
        answer,
        tolerance: 0,
      },
      check: expandedCheck(`$${tex}$`, v, power, answer),
      values: { form, c: size, power, v },
    }
  },
}

// ---------------------------------------------------------------------------------------
// q6 and q11: one coefficient of (1 + kx)^n, and (c + kx)^n at grade 8-9.
// ---------------------------------------------------------------------------------------

interface Single {
  n: number
  r: number
  k: number
  /** The constant: 1 for q6, 1, 2 or 3 for q11. */
  a: number
}

/**
 * Every (n, r, k, a) asked. r runs from 2 to 5 and to n − 2, so the entry is never n itself
 * (the slip "use n for the binomial number" gives the right answer at r = 1 and r = n − 1),
 * and never n/2, where the entry counted from the wrong end is the same. The power always
 * reaches the k (k ≥ 2, so leaving k unpowered is wrong), the bracket's two numbers differ,
 * and no step is 2², which 2 × 2 also gives.
 */
function singles(ns: number[], ks: number[], as: number[], ok: (s: Single, size: number) => boolean): Single[] {
  const out: Single[] = []
  for (const n of ns) for (let r = 2; r <= Math.min(5, n - 2); r++) for (const k of ks) for (const a of as) {
    const s = { n, r, k, a }
    const twoSquared = (k === 2 && r === 2) || (a === 2 && n - r === 2)
    // Never a neighbouring coefficient equal to the one asked: the term off by one would score.
    const at = (j: number) => choose(n, j) * a ** (n - j) * k ** j
    if (2 * r !== n && a !== k && !twoSquared && at(r - 1) !== at(r) && at(r + 1) !== at(r) && ok(s, at(r))) out.push(s)
  }
  return out
}
/** q6, grade 6-7: (1 + kx)^n with a coefficient of at most 1000 before its sign. */
export const SINGLE_Q6 = singles([5, 6, 7, 8], [2, 3, 4, 5, 6], [1], (_, size) => size <= 1000)
/** q11, grade 8-9: up to row 8, a constant of 1, 2 or 3, a coefficient from 150 to 3000. */
export const SINGLE_Q11 = singles([5, 6, 7, 8], [2, 3, 4, 5], [1, 2, 3], (_, size) => size >= 150 && size <= 3000)
const Q11_ONE = SINGLE_Q11.filter((s) => s.a === 1)
// Never (3 + 2x)⁵ and x³, the written q16 on the same sheet, nor (3 + 2x)⁶ and x⁴, whose 2160 is (2 + 3x)⁶ and x²'s too.
const Q11_MORE = SINGLE_Q11.filter((s) => s.a !== 1 && !(s.a === 3 && s.k === 2 && ((s.n === 5 && s.r === 3) || (s.n === 6 && s.r === 4))))

/**
 * The power asked first, then the row, then the rest. Picking from the whole list made x² most
 * of the draws, since small powers fit most often; picking the power evenly made q6's one x⁵
 * calculation, (1 ± 2x)⁷, a quarter of the slot. With `weighted`, each power counts by the square
 * root of how many calculations it has; q11's pool is even enough to draw the power evenly.
 */
function drawSingle(r: Rng, pool: Single[], weighted = false): Single {
  const powers = [...new Set(pool.map((s) => s.r))]
  // Even, except that a power with a single calculation counts half, so that one calculation is not a sixth of the slot.
  const weights = powers.map((p) => (weighted ? Math.sqrt(pool.filter((s) => s.r === p).length) : Math.min(1, pool.filter((s) => s.r === p).length / 2)))
  let left = r() * weights.reduce((a, b) => a + b, 0)
  const power = powers.find((_, i) => (left -= weights[i]!) < 0) ?? powers.at(-1)!
  const rows = pool.filter((s) => s.r === power)
  const n = pick(r, [...new Set(rows.map((s) => s.n))])
  return pick(r, rows.filter((s) => s.n === n))
}

/**
 * A single coefficient of (1 + kx)^n: written as q6, (1 + 2x)⁴ and x³, and q11, (1 + 3x)⁶
 * and x⁴ with Pascal's triangle named (grade 8-9, 2 marks). The k can be negative; q11's
 * constant can be 2 or 3, as the specification's (3 + 2x)⁵.
 */
export const binomialCoefficient: Generator = {
  id: 'fm-binomial-coefficient',
  subjectId: 'further-maths',
  topicId: EXPAND,
  replaces: ['q6', 'q11'],
  build(r, slot): Draft {
    const hard = slot.id === 'q11'
    // q11: a constant of 2 or 3, as the specification's (3 + 2x)⁵, a quarter of the time.
    const s = hard ? (r() < 0.25 ? pick(r, Q11_MORE) : drawSingle(r, Q11_ONE)) : drawSingle(r, SINGLE_Q6, true)
    const v = pick(r, LETTERS)
    // Negative half the time: with odd powers about half the draws, a negative answer in a quarter.
    const k = (r() < 0.5 ? -1 : 1) * s.k
    const B: Bracket = { v, k, c: s.a, n: s.n, letterFirst: false }
    const answer = coefficient(B, s.r)
    const C = choose(s.n, s.r)
    const kr = k ** s.r
    const ar = s.a ** (s.n - s.r)
    const tex = bracketTex(B)
    const row = pascalRow(s.n).join(', ')
    const ask = `$${vPow(v, s.r)}$`
    const prompt = hard
      ? `Use Pascal's triangle to find the coefficient of ${ask} in the expansion of $${tex}$.`
      : `${pick(r, ['Find', 'Work out'])} the coefficient of ${ask} in the expansion of $${tex}$.`
    const kx = `(${sumOf([[k, 1]], v)})^${s.r}`
    const krTerm = kr < 0 ? `(${sumOf([[kr, s.r]], v)})` : sumOf([[kr, s.r]], v)
    const middle = s.a === 1 ? `${C} \\times ${krTerm}` : `${C} \\times ${ar} \\times ${krTerm}`
    const solution = `Row ${s.n} is $${row}$; the ${ask} entry is $${C}$. The term is $${C} \\times ${s.a}^${s.n - s.r} \\times ${kx} = ${middle} = ${sumOf([[answer, s.r]], v)}$. The power $${s.r}$ applies to the $${k}$ as well as the $${v}$${s.a === 1 ? '' : `, and the $${s.a}$ takes the power $${s.n - s.r}$`}.`
    const method = s.a === 1 ? `${C} × ${minus(sub(k))}${sup(s.r)}` : `${C} × ${s.a}${sup(s.n - s.r)} × ${minus(sub(k))}${sup(s.r)}`
    return {
      question: {
        type: 'numeric',
        prompt,
        solution,
        markScheme: scheme(slot, [method], minus(answer)),
        answer,
        tolerance: 0,
      },
      check: expandedCheck(`$${tex}$`, v, s.r, answer),
      values: { n: s.n, r: s.r, k, a: s.a, v },
    }
  },
}

// ---------------------------------------------------------------------------------------
// q12: which end of the row. (x + 2)^6, the coefficient of x^4.
// ---------------------------------------------------------------------------------------

interface End {
  n: number
  r: number
  b: number
}
/**
 * (x + b)^n with r ≠ n − r, so the entry counted from the wrong end gives a different answer,
 * r from 2 to n − 2 so the entry is never n, never 2² (which 2 × 2 also gives), and a
 * coefficient of at most 2000 by hand.
 */
export const ENDS: End[] = [5, 6, 7, 8].flatMap((n) =>
  [2, 3, 4, 5].flatMap((b) =>
    Array.from({ length: n - 3 }, (_, i) => i + 2)
      .filter((r) => r !== n - r && !(b === 2 && n - r === 2) && choose(n, r) * b ** (n - r) <= 2000 && [r - 1, r + 1].every((j) => choose(n, j) * b ** (n - j) !== choose(n, r) * b ** (n - r)))
      .map((r) => ({ n, r, b })),
  ),
)

/** The coefficient of x^r in (x + b)^n or (b + x)^n: written as q12, (x + 2)⁶ and x⁴. */
export const binomialWhichEnd: Generator = {
  id: 'fm-binomial-which-end',
  subjectId: 'further-maths',
  topicId: EXPAND,
  replaces: ['q12'],
  build(r, slot): Draft {
    const { n, r: power, b } = pick(r, ENDS)
    const v = pick(r, LETTERS)
    const letterFirst = r() < 0.7
    const negative = r() < 0.4
    // (x - b): the constant is negative. (b - x): the letter is.
    const B: Bracket = { v, n, letterFirst, k: !letterFirst && negative ? -1 : 1, c: letterFirst && negative ? -b : b }
    const answer = coefficient(B, power)
    const wrongEnd = coefficient(B, n - power)
    const C = choose(n, power)
    const tex = bracketTex(B)
    const letterTerm = B.k === 1 ? v : `-${v}`
    const [aTex, bTex] = letterFirst ? [letterTerm, String(B.c)] : [String(B.c), letterTerm]
    const [i, j] = letterFirst ? [power, n - power] : [n - power, power]
    const parts = letterFirst ? [lPow(B.k, v, power), cPow(B.c, n - power)] : [cPow(B.c, n - power), lPow(B.k, v, power)]
    const wrongParts = B.k === 1 ? cPow(B.c, power) : `${cPow(B.c, power)} \\times (-1)^${n - power}`
    // Past 2000 the wrong end's value is left as its product: a non-calculator solution
    // should not ask anyone to check a five-figure power.
    const wrongValue = Math.abs(wrongEnd) > 2000 ? `$${C} \\times ${wrongParts}$, a different number` : `$${C} \\times ${wrongParts} = ${wrongEnd}$`
    // The method line carries the same signed powers as the working: (−1)^r when the letter is negative.
    const method = `${C} × ${minus(sub(B.c))}${sup(n - power)}${B.k === -1 ? ` × (−1)${sup(power)}` : ''}`
    const ask = `$${vPow(v, power)}$`
    const solution =
      `Row ${n} is $${pascalRow(n).join(', ')}$. Here $a = ${aTex}$ and $b = ${bTex}$, and the ${ask} term has $a^${i} b^${j}$, whose entry is $${C}$: ` +
      `$${C} \\times ${parts.join(' \\times ')} = ${sumOf([[answer, power]], v)}$. ` +
      `Counting the entry from the wrong end of the row would give ${wrongValue}, the coefficient of $${vPow(v, n - power)}$.`
    return {
      question: {
        type: 'numeric',
        prompt: `Find the coefficient of ${ask} in the expansion of $${tex}$.`,
        solution,
        markScheme: scheme(slot, [`the entry with ${letterFirst ? `a${sup(power)} b${sup(n - power)}` : `a${sup(n - power)} b${sup(power)}`}: ${method}`], minus(answer)),
        answer,
        tolerance: 0,
      },
      check: expandedCheck(`$${tex}$`, v, power, answer),
      values: { n, r: power, b: B.c, k: B.k, letterFirst: String(letterFirst), v },
    }
  },
}

// ---------------------------------------------------------------------------------------
// q8: the specification example. (y^2 - 2y + 3)(2y - 1) - 2(y^3 - 3y^2 + 4y - 2).
// ---------------------------------------------------------------------------------------

interface Spec {
  p: number
  q: number
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

const either = (r: Rng, most: number) => (r() < 0.5 ? -1 : 1) * int(r, 1, most)
const either2 = (r: Rng, most: number) => (r() < 0.5 ? -1 : 1) * int(r, 2, most)

const drawSpec = (r: Rng): Spec =>
  draw(
    r,
    // p, d and e are never ±1, as the written −2y, −3y² and 4y are not: a bare y would hide the multiplication.
    (r) => ({ p: either2(r, 5), q: either(r, 6), a: int(r, 2, 4), b: either(r, 6), c: int(r, 2, 4), d: either2(r, 5), e: either2(r, 6), f: either(r, 6) }),
    (s) => {
      // A non-zero answer, and no two of the numbers that make the y² coefficient the same size but one.
      const sizes = new Set([Math.abs(s.p), s.a, Math.abs(s.b), s.c, Math.abs(s.d)])
      const answer = s.p * s.a + s.b - s.c * s.d
      // No printed number is the answer, either sign; neither the y³ nor the y coefficient is;
      // and the first product's y² terms never cancel, which would pay for ignoring it.
      const printed = [s.p, s.q, s.a, s.b, -s.c, s.d, s.e, s.f]
      const others = [s.a - s.c, s.p * s.b + s.q * s.a - s.c * s.e]
      return (
        answer !== 0 && sizes.size >= 4 && s.a !== s.c && s.p * s.a + s.b !== 0 &&
        !printed.some((x) => Math.abs(x) === Math.abs(answer)) && !others.includes(answer)
      )
    },
  )

/**
 * The y² coefficient of (y² + py + q)(ay + b) − c(y³ + dy² + ey + f): written as q8, the
 * specification's own example in 2.6. The answer is pa + b − cd; each slip (the minus not
 * distributed, the c not multiplied in, a cross term missed) gives another number.
 */
export const expandAndSimplify: Generator = {
  id: 'fm-expand-and-simplify',
  subjectId: 'further-maths',
  topicId: EXPAND,
  replaces: ['q8'],
  build(r, slot): Draft {
    const s = drawSpec(r)
    const v = pick(r, ['y', 'y', 'y', 'x', 't'])
    const { p, q, a, b, c, d, e, f } = s
    const tex = `(${poly([q, p, 1], v)})(${poly([b, a], v)}) - ${c}(${poly([f, e, d, 1], v)})`
    const answer = p * a + b - c * d
    const first = p * a + b
    const second = -c * d
    const full = polyOf(fromTex(tex), v)!
    const t = (k: number, n: number) => sumOf([[k, n]], v)
    const plainTerm = (k: number) => minus(t(k, 2).replace('^2', '²'))
    const together = `together $${t(first, 2)}$`
    const solution =
      `From the first product the $${vPow(v, 2)}$ terms are $${t(p, 1)} \\times ${t(a, 1)} = ${t(p * a, 2)}$ and $${vPow(v, 2)} \\times ${sub(b)} = ${t(b, 2)}$, ${together}; ` +
      `the second contributes $-${c} \\times ${d < 0 ? `(${t(d, 2)})` : t(d, 2)} = ${second > 0 ? '+' : ''}${t(second, 2)}$. ` +
      `So $${first} + ${sub(second)} = ${answer}$: the whole expression is $${poly(full, v)}$.`
    return {
      question: {
        type: 'numeric',
        prompt: `Expand and simplify $${tex}$. What is the coefficient of $${vPow(v, 2)}$?`,
        solution,
        markScheme: scheme(slot, [`both products expanded with the minus distributed: ${plainTerm(first)} from the first and ${second > 0 ? '+' : ''}${plainTerm(second)} from the second`], minus(answer)),
        answer,
        tolerance: 0,
      },
      check: expandedCheck(`$${tex}$`, v, 2, answer),
      values: { ...s, v },
    }
  },
}

// ---------------------------------------------------------------------------------------
// Factorising q9: 76^2 - 24^2 by the difference of two squares.
// ---------------------------------------------------------------------------------------

/**
 * a² − b² worked as (a − b)(a + b): written as q9, 76² − 24² = 52 × 100. The pair adds to a
 * round 100, 200 or 1000, or differs by 10 or 100, so the product is easy by hand.
 */
export const differenceOfSquaresNumbers: Generator = {
  id: 'fm-difference-of-squares-numbers',
  subjectId: 'further-maths',
  topicId: FACTORISE,
  replaces: ['q9'],
  build(r, slot): Draft {
    const kind = pick(r, ['sum 100', 'sum 100', 'sum 200', 'sum 1000', 'difference 10', 'difference 100'] as const)
    let a: number
    let b: number
    if (kind === 'sum 100') {
      a = int(r, 52, 95)
      b = 100 - a
    } else if (kind === 'sum 200') {
      a = int(r, 102, 190)
      b = 200 - a
    } else if (kind === 'sum 1000') {
      a = 500 + int(r, 2, 30)
      b = 1000 - a
    } else if (kind === 'difference 10') {
      b = int(r, 11, 85)
      a = b + 10
    } else {
      b = int(r, 5, 60)
      a = b + 100
    }
    const answer = (a - b) * (a + b)
    return {
      question: {
        type: 'numeric',
        prompt: `Work out $${a}^2 - ${b}^2$ without a calculator, using the difference of two squares.`,
        solution: `$${a}^2 - ${b}^2 = (${a} - ${b})(${a} + ${b}) = ${a - b} \\times ${a + b} = ${answer >= 10000 ? String(answer).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : answer}$. No squaring needed.`,
        markScheme: scheme(slot, [`(${a} − ${b})(${a} + ${b})`], String(answer)),
        answer,
        tolerance: 0,
      },
      // Second route: square each number by repeated addition and subtract.
      check: (() => {
        let A = 0
        let Bs = 0
        for (let i = 0; i < a; i++) A += a
        for (let i = 0; i < b; i++) Bs += b
        return { agrees: A - Bs === answer, detail: `${A} − ${Bs} = ${A - Bs}` }
      })(),
      values: { kind, a, b },
    }
  },
}

export const expansionGenerators: Generator[] = [binomialCube, binomialCoefficient, binomialWhichEnd, expandAndSimplify, differenceOfSquaresNumbers]

