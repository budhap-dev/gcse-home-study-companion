import { show } from '../format.ts'
import { pick } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'
import { evalTex, fracTex, fracText, gcd, near } from '../maths/formulae.ts'
import { linear, wholeRoot } from '../maths/indices.ts'

/**
 * Further Maths (AQA 8365): quadratic-inequalities-and-index-equations.
 *
 * 2.18 Index laws, including fractional and negative indices and the solution of equations:
 *      27^(2/3), 8^(−2/3), 3^(2x − 1) = 27, x^(3/2) = 8 and 4^x = 8.
 */

const TOPIC = 'quadratic-inequalities-and-index-equations'

const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
const frac = (m: number, n: number, negative = false) => `${negative ? '-' : ''}\\frac{${m}}{${n}}`
const rootTex = (x: number | string, n: number) => (n === 2 ? `\\sqrt{${x}}` : `\\sqrt[${n}]{${x}}`)
const ROOT_WORD: Record<number, string> = { 2: 'Square root', 3: 'Cube root', 4: 'Fourth root', 5: 'Fifth root' }
const POWER_WORD: Record<number, string> = { 2: 'squared', 3: 'cubed', 4: 'to the power 4', 5: 'to the power 5' }
const VERBS = ['Work out', 'Work out', 'Evaluate', 'Find the value of']
/** A number in maths as the content prints it: a thin space between thousands from five digits, 10\,000. */
const thin = (n: number) => (n >= 10000 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : String(n))

/** Decimal places a terminating decimal needs. */
function places(x: number): number {
  let k = 0
  while (Math.abs(x * 10 ** k - Math.round(x * 10 ** k)) > 1e-9 && k < 15) k++
  return k
}

interface Index {
  /** The number raised to the power: root^n. */
  base: number
  root: number
  m: number
  n: number
}

function indices(roots: number[], ns: number[], ms: number[], ok: (f: Index) => boolean): Index[] {
  return roots.flatMap((root) => ns.flatMap((n) => ms.filter((m) => m !== n && gcd(m, n) === 1).map((m) => ({ base: root ** n, root, m, n })))).filter(ok)
}

// ---------------------------------------------------------------------------------------
// q3: 27^(2/3) = 9.
// ---------------------------------------------------------------------------------------

/**
 * base^(m/n) with m of 2 or more: a root, then a power. Base and answer at most 1000, by hand.
 * Never a root of 2 squared (8^(2/3), 32^(2/5)), where root × m gives the answer too.
 */
export const FRACTIONAL = indices(range(2, 10), [2, 3, 4, 5], [2, 3, 4, 5], ({ base, root, m }) => base <= 1000 && root ** m <= 1000 && !(root === 2 && m === 2))

/** A fractional index, root then power: written as q3, 27^(2/3) = 9. */
export const fractionalIndex: Generator = {
  id: 'fm-fractional-index',
  subjectId: 'further-maths',
  topicId: TOPIC,
  replaces: ['q3'],
  build(r, slot): Draft {
    const { base, root, m, n } = pick(r, FRACTIONAL)
    const answer = root ** m
    // Second route: the power taken in floating point, straight from the printed index.
    const direct = evalTex(`${base}^{${frac(m, n)}}`)
    return {
      question: {
        type: 'numeric',
        prompt: `${pick(r, VERBS)} $${base}^{${frac(m, n)}}$.`,
        solution: `Root first: $${rootTex(base, n)} = ${root}$. Then the power: $${root}^${m} = ${answer}$.`,
        markScheme: scheme(slot, [], String(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: Math.abs(direct - answer) < 1e-9 * answer && wholeRoot(base, n) === root, detail: `${base}^(${m}/${n}) = ${direct}` },
      values: { base, m, n },
    }
  },
}

// ---------------------------------------------------------------------------------------
// q6: 8^(-2/3) = 0.25.
// ---------------------------------------------------------------------------------------

/**
 * base^(−m/n) whose value 1/root^m is a decimal of at most 3 places: a root made of 2s and 5s.
 * With a power of 2 or 3 (8^(−2/3)) and, a third of the time, a power of 1 (64^(−1/3)): too
 * few of the first stop at three places to vary the question on their own.
 */
// Bases a student knows on sight: powers up to 1024, squares up to 50², powers of ten. 3125 (5⁵), 4096 (8⁴) and 8000 (20³) are not.
const known = (base: number, root: number, n: number) => base <= 1024 || root === 10 || (n === 2 && base <= 2500)
export const NEGATIVE_POWER = indices([2, 5, 10], [2, 3, 4, 5], [2, 3], ({ base, root, m, n }) => known(base, root, n) && places(1 / root ** m) <= 3)
export const NEGATIVE_ROOT = indices([2, 4, 5, 8, 10, 20, 25, 40, 50], [2, 3, 4, 5], [1], ({ base, root, n }) => known(base, root, n) && places(1 / root) <= 3)

/** A negative fractional index: written as q6, 8^(−2/3) = 0.25. */
export const negativeFractionalIndex: Generator = {
  id: 'fm-negative-fractional-index',
  subjectId: 'further-maths',
  topicId: TOPIC,
  replaces: ['q6'],
  build(r, slot): Draft {
    const { base, root, m, n } = pick(r, r() < 0.67 ? NEGATIVE_POWER : NEGATIVE_ROOT)
    const whole = root ** m
    const answer = Number(show(1 / whole))
    const steps = m === 1
      ? `${ROOT_WORD[n]} of $${thin(base)}$ is $${root}$`
      : `${ROOT_WORD[n]} of $${thin(base)}$ is $${root}$, ${POWER_WORD[m]} is $${whole}$`
    const power = `${thin(base)}^{${frac(m, n, true)}}`
    const prompt = r() < 0.25 ? `Write $${power}$ as a decimal.` : `${pick(r, VERBS)} $${power}$. Give your answer as a decimal.`
    // Second route: the power from the printed text, and the decimal's digits times root^m a power of ten.
    const direct = evalTex(power)
    const dp = places(answer)
    const digits = Math.round(answer * 10 ** dp)
    return {
      question: {
        type: 'numeric',
        prompt,
        solution: `The negative index is a reciprocal: $\\dfrac{1}{${thin(base)}^{${frac(m, n)}}}$. ${steps}, so the value is $\\frac{1}{${whole}} = ${show(answer)}$, positive.`,
        markScheme: scheme(slot, [], `1/${whole} or ${show(answer)}`),
        answer,
        tolerance: 0,
      },
      check: { agrees: near(direct, answer) && digits * whole === 10 ** dp && wholeRoot(base, n) === root, detail: `${base}^(−${m}/${n}) = ${direct}; ${digits} × ${whole} = ${digits * whole}` },
      values: { base, m, n },
    }
  },
}

// ---------------------------------------------------------------------------------------
// q7: 3^(2x - 1) = 27, x = 2.
// ---------------------------------------------------------------------------------------

interface Equating {
  c: number
  p: number
  q: number
  k: number
  x: number
}

/** The largest power of each base that is printed: 2^9 = 512, 3^6 = 729, 10^3 = 1000. */
const TOP: Record<number, number> = { 2: 9, 3: 6, 4: 4, 5: 4, 6: 3, 7: 3, 10: 3 }

/**
 * Every c^(px + q) = c^k with a whole x from −5 to 6 (not 0), p from 2 to 4 and q from −9 to 9
 * (not 0, nor ±p), k from 1 to the base's top power or, for a fraction, −1 to −3. x is never
 * one of the printed numbers or k, either sign.
 */
export const EQUATING: Equating[] = Object.entries(TOP).flatMap(([cs, top]) => {
  const c = Number(cs)
  return range(-3, top)
    .filter((k) => k !== 0 && (k > 0 || c ** -k <= 125))
    .flatMap((k) =>
      range(2, 4).flatMap((p) =>
        range(-5, 6)
          .filter((x) => x !== 0)
          .map((x) => ({ c, p, k, x, q: k - p * x }))
          .filter(({ q, x }) => q !== 0 && Math.abs(q) <= 9 && Math.abs(q) !== p && ![p, q, k, c, c ** Math.abs(k)].some((g) => Math.abs(g) === Math.abs(x))),
      ),
    )
})

const powerTex = (c: number, k: number) => (k > 0 ? String(c ** k) : `\\frac{1}{${c ** -k}}`)

/** Equal bases, equal indices: written as q7, 3^(2x − 1) = 27 and x = 2. The answer x is drawn first. */
export const equatingIndices: Generator = {
  id: 'fm-equating-indices',
  subjectId: 'further-maths',
  topicId: TOPIC,
  replaces: ['q7'],
  build(r, slot): Draft {
    const xs = [...new Set(EQUATING.map((e) => e.x))]
    const x = pick(r, xs)
    // A fraction on the right about a fifth of the time.
    const pool = EQUATING.filter((e) => e.x === x)
    const fractions = pool.filter((e) => e.k < 0)
    const wholes = pool.filter((e) => e.k > 0)
    // x = −5 has only fractions on the right: 2x + 9 = −1 at most.
    const { c, p, q, k } = pick(r, (fractions.length && r() < 0.2) || !wholes.length ? fractions : wholes)
    const rhs = powerTex(c, k)
    const exponent = linear(p, q)
    const prompt = `Solve $${c}^{${exponent}} = ${rhs}$.`
    const kTex = k === 1 ? `${c}^1` : `${c}^{${k}}`
    const solution =
      `$${rhs} = ${kTex}$, so $${exponent} = ${k}$, $${p}x = ${k - q}$ and $x = ${x}$. Check: $${c}^{${p} \\times ${x < 0 ? `(${x})` : x} ${q < 0 ? '-' : '+'} ${Math.abs(q)}} = ${kTex} = ${rhs}$.`
    // Second route: put x back into the printed equation and work out both sides.
    const [left, right] = prompt.slice(prompt.indexOf('$') + 1, prompt.lastIndexOf('$')).split('=')
    const l = evalTex(left!, { x })
    const rv = evalTex(right!)
    return {
      question: {
        type: 'numeric',
        prompt,
        solution,
        markScheme: scheme(slot, [], String(x).replace('-', '−')),
        answer: x,
        tolerance: 0,
      },
      check: { agrees: near(l, rv), detail: `x = ${x}: left ${l}, right ${rv}` },
      values: { c, p, q, k },
    }
  },
}

// ---------------------------------------------------------------------------------------
// q9: x^(3/2) = 8, x = 4.
// ---------------------------------------------------------------------------------------

interface Undo {
  t: number
  m: number
  n: number
}

/**
 * x^(m/n) = t^m, so x = t^n: t at most 10 and both powers at most 1024, roots a student can
 * recall. m and n from 2 to 5 and different: the index is a power over a root either way up,
 * 3/2 as written, and 2/3.
 */
export const UNDO: Undo[] = range(2, 10).flatMap((t) =>
  range(2, 5).flatMap((m) => range(2, 5).filter((n) => n !== m && gcd(m, n) === 1 && t ** m <= 1024 && t ** n <= 1024).map((n) => ({ t, m, n }))),
)

/** Undoing a fractional index: written as q9, x^(3/2) = 8, x > 0, and x = 4. */
export const undoingFractionalIndex: Generator = {
  id: 'fm-undoing-fractional-index',
  subjectId: 'further-maths',
  topicId: TOPIC,
  replaces: ['q9'],
  build(r, slot): Draft {
    const { t, m, n } = pick(r, UNDO)
    const v = pick(r, ['x', 'x', 'x', 'y', 'a', 'p'])
    const N = t ** m
    const answer = t ** n
    const prompt = `Solve $${v}^{${frac(m, n)}} = ${N}$, where $${v} > 0$.`
    const solution =
      `Raise both sides to the power $${frac(n, m)}$: $${v} = ${N}^{${frac(n, m)}} = \\left(${rootTex(N, m)}\\right)^${n} = ${t}^${n} = ${answer}$. ` +
      `Check: $${answer}^{${frac(m, n)}} = ${t}^${m} = ${N}$.`
    // Second route: raise the answer to the printed index and compare with the printed right side.
    const back = evalTex(`${v}^{${frac(m, n)}}`, { [v]: answer })
    return {
      question: {
        type: 'numeric',
        prompt,
        solution,
        markScheme: scheme(slot, [], String(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: near(back, N) && wholeRoot(N, m) === t, detail: `${answer}^(${m}/${n}) = ${back} against ${N}` },
      values: { t, m, n, v },
    }
  },
}

// ---------------------------------------------------------------------------------------
// q13: 4^x = 8, x = 1.5.
// ---------------------------------------------------------------------------------------

interface Shared {
  c: number
  u: number
  w: number
}

/**
 * (c^u)^x = c^w with x = w/u a decimal that is not whole, at most 3 places: u of 2, 4 or 5
 * (8 for c = 2). Both sides at most 1024 (or a fraction 1/c^|w|), and never b ÷ a = x, as
 * 4^x = 2 would make it (2 ÷ 4 = 0.5).
 */
export const SHARED: Shared[] = [2, 3, 5, 6, 7, 10].flatMap((c) =>
  (c === 2 ? [2, 4, 5, 8] : [2, 4, 5]).flatMap((u) =>
    range(-6, 10)
      .filter((w) => w !== 0 && w % u !== 0 && c ** u <= 1024 && c ** Math.abs(w) <= (w > 0 ? 1024 : 125))
      .map((w) => ({ c, u, w })),
  ),
).filter(({ c, u, w }) => !near(c ** w / c ** u, w / u) && !near(c ** u / c ** w, w / u))

const sideTex = (c: number, w: number) => (w > 0 ? String(c ** w) : `\\frac{1}{${c ** -w}}`)

/** A shared base: written as q13, 4^x = 8 and x = 1.5. */
export const sharedBase: Generator = {
  id: 'fm-shared-base',
  subjectId: 'further-maths',
  topicId: TOPIC,
  replaces: ['q13'],
  build(r, slot): Draft {
    const negative = SHARED.filter((s) => s.w < 0)
    const { c, u, w } = pick(r, r() < 0.2 ? negative : SHARED.filter((s) => s.w > 0))
    const a = c ** u
    const answer = Number(show(w / u))
    const b = sideTex(c, w)
    const v = pick(r, ['x', 'x', 'x', 'y', 'n', 't'])
    const prompt = `Solve $${a}^${v} = ${b}$. Give your answer as a decimal.`
    const wTex = w === 1 ? `${c}^1` : `${c}^{${w}}`
    const back = Math.abs(w) === 1 && w > 0 ? `${rootTex(a, u)} = ${b}` : `\\left(${rootTex(a, u)}\\right)^{${w}} = ${b}`
    const solution =
      `Both are powers of $${c}$: $${c}^{${u}${v}} = ${wTex}$, so $${u}${v} = ${w}$ and $${v} = ${fracTex(w, u, '\\frac')} = ${show(answer)}$. ` +
      `Check: $${a}^{${show(answer)}} = ${back}$.`
    // Second route: the printed left side at the answer against the printed right side.
    const [lhs, rhs] = prompt.slice(prompt.indexOf('$') + 1, prompt.indexOf('$', prompt.indexOf('$') + 1)).split('=')
    const left = evalTex(lhs!.replace(/\^([a-z])/, '^{$1}'), { [v]: answer })
    const right = evalTex(rhs!)
    return {
      question: {
        type: 'numeric',
        prompt,
        solution,
        markScheme: scheme(slot, [], `${fracText(w, u)} or ${show(answer)}`.replace(/-/g, '−')),
        answer,
        tolerance: 0,
      },
      check: { agrees: near(left, right) && !Number.isInteger(answer), detail: `${a}^${answer} = ${left} against ${right}` },
      values: { c, u, w, v },
    }
  },
}

export const indexEquationGenerators: Generator[] = [fractionalIndex, negativeFractionalIndex, equatingIndices, undoingFractionalIndex, sharedBase]
