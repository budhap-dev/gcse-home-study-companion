import type { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'
import { evalTex, fracTex, fracText, gcd, near, reduce, sum } from '../maths/formulae.ts'
import { ordinal } from '../maths/sequences.ts'
import { fmBySlot, minus } from './build.ts'

/**
 * Further Maths (AQA 8365), sequences-and-limiting-values: specification 2.20 (using nth
 * terms, the limiting value as n → ∞, the difference between two terms of a fraction
 * sequence), 2.21 (which term of a linear sequence has a given value, going up and going
 * down) and 2.22 (which term of a quadratic sequence has a given value).
 */

const TOPIC = 'sequences-and-limiting-values'

const list = (xs: number[]) => xs.join(', ')

/** q2 and q15: which term of a linear sequence has a given value; q15 goes down past zero. */
function whichTerm(r: Rng, slot: Question): Draft {
  if (slot.id === 'q15') return whichTermGoingDown(r, slot)
  // The position first, so the answers spread.
  const N = int(r, 12, 60)
  const { a, b } = draw(
    r,
    (r) => ({ a: int(r, 2, 9), b: draw(r, (r) => int(r, -9, 9), (v) => v !== 0) }),
    ({ a, b }) => a + b !== 0 && ![a, Math.abs(b)].includes(N) && ![1, 2, 3, 4].map((n) => Math.abs(a * n + b)).includes(N),
  )
  const T = a * N + b
  const rule = sum([[a, 'n'], [b, '']])
  const terms = [1, 2, 3, 4].map((n) => a * n + b)
  // Second route: count up from the first term in steps of a.
  let n = 1
  let t = terms[0]!
  while (t < T) {
    t += a
    n++
  }
  return {
    question: {
      type: 'numeric',
      prompt: `The sequence $${list(terms)}, \\ldots$ has $n$th term $${rule}$. Which term has value ${T}?`,
      solution: `$${rule} = ${T}$ gives $${a}n = ${T - b}$, so $n = ${N}$. The ${ordinal(N)} term.`,
      markScheme: scheme(slot, [], String(N)),
      answer: N,
      tolerance: 0,
    },
    check: { agrees: n === N && t === T && evalTex(rule, { n: N }) === T, detail: `counting up in ${a}s from ${terms[0]}: term ${n} is ${t}` },
    values: { a, b, N, T },
  }
}

function whichTermGoingDown(r: Rng, slot: Question): Draft {
  const N = int(r, 20, 200)
  const { a, c } = draw(
    r,
    (r) => ({ a: int(r, 2, 9), c: int(r, 10, 200) }),
    ({ a, c }) => {
      const T = c - a * N
      return T <= -10 && T >= -1500 && ![a, c, -T].includes(N) && ![1, 2, 3].map((n) => c - a * n).includes(N)
    },
  )
  const T = c - a * N
  const rule = sum([[c, ''], [-a, 'n']])
  const terms = [1, 2, 3].map((n) => c - a * n)
  let n = 1
  let t = terms[0]!
  while (t > T) {
    t -= a
    n++
  }
  return {
    question: {
      type: 'numeric',
      prompt: `The sequence $${list(terms)}, \\ldots$ has $n$th term $${rule}$. Which term has value $${T}$?`,
      solution: `$${rule} = ${T}$ gives $${a}n = ${c - T}$, so $n = ${N}$. The ${ordinal(N)} term.`,
      markScheme: scheme(slot, [], String(N)),
      answer: N,
      tolerance: 0,
    },
    check: { agrees: n === N && t === T && evalTex(rule, { n: N }) === T, detail: `counting down in ${a}s from ${terms[0]}: term ${n} is ${t}` },
    values: { a, c, N, T },
  }
}

/** Limiting values a student can write down: whole numbers, halves, quarters and fifths. */
const LIMITS: { L: number; den: number[] }[] = [
  ...[2, 3, 4, 5, 6, 7].map((L) => ({ L, den: [2, 3, 4, 5] })),
  ...[-2, -3].map((L) => ({ L, den: [2, 3] })),
  ...[0.5, 1.5, 2.5, 3.5, -1.5].map((L) => ({ L, den: [2, 4, 6] })),
  ...[0.25, 0.75, 1.25].map((L) => ({ L, den: [4, 8] })),
  ...[0.4, 0.6, 1.2].map((L) => ({ L, den: [5, 10] })),
]

/** q3 and q7: the limiting value of (an + b)/(cn + d). */
function limitingValue(r: Rng, slot: Question): Draft {
  // The answer first, then a denominator coefficient that makes a whole numerator.
  const { L, den } = pick(r, LIMITS)
  const { a, b, c, d } = draw(
    r,
    (r) => {
      const c = pick(r, den)
      return { a: Math.round(L * c), b: draw(r, (r) => int(r, -9, 9), (v) => v !== 0), c, d: draw(r, (r) => int(r, 1 - c, 9), (v) => v !== 0) }
    },
    ({ a, b, c, d }) =>
      Math.abs(a) <= 30 &&
      // A real coefficient on top, as written: never n or -n.
      Math.abs(a) !== 1 &&
      // ad = bc would make every term equal to the limit.
      a * d !== b * c &&
      a + b !== 0 &&
      // No a/d or b/c coincidence: c = |d| or |a| = |b| would let those routes land near the answer.
      c !== Math.abs(d) &&
      Math.abs(a) !== Math.abs(b) &&
      // No common factor across all four, as in (8n - 2)/(2n + 2).
      gcd(gcd(a, b), gcd(c, d)) === 1 &&
      // No printed number may equal the answer, and the constants' ratio b/d must not either.
      ![a, b, c, d].some((v) => Math.abs(v) === Math.abs(L)) &&
      !near(b / d, L),
  )
  const top = sum([[a, 'n'], [b, '']])
  const bottom = sum([[c, 'n'], [d, '']])
  const fraction = `\\dfrac{${top}}{${bottom}}`
  const tail = Number.isInteger(L) ? '' : ' Give your answer as a decimal.'
  const prompt =
    slot.id === 'q7'
      ? `The $n$th term of a sequence is $${fraction}$. Write down its limiting value as $n \\to \\infty$.${tail}`
      : `Write down the limiting value of $${fraction}$ as $n \\to \\infty$.${tail}`
  const over = (k: number, v: number) => `${k} ${v < 0 ? '-' : '+'} \\frac{${Math.abs(v)}}{n}`
  const divided = `$\\dfrac{${over(a, b)}}{${over(c, d)}} \\to \\dfrac{${a}}{${c}} = ${show(L)}$`
  let solution = `Divide top and bottom by $n$: ${divided}. The ratio of the leading coefficients.`
  if (slot.id === 'q7') {
    const [fn, fd] = reduce(a + b, c + d)
    const raw = c + d === 1 ? String(a + b) : `${a + b < 0 ? '-' : ''}\\frac{${Math.abs(a + b)}}{${c + d}}`
    const first = fd === c + d ? raw : `${raw} = ${fracTex(fn, fd, '\\frac')}`
    // (an + b)/(cn + d) rises with n when ad − bc > 0, the denominator being positive.
    const climbs = a * d - b * c > 0
    solution = `Divide by $n$: ${divided}. The first term is $${first}$, and the terms ${climbs ? 'climb' : 'fall'} towards $${show(L)}$ without reaching it.`
  }
  // Second route: the printed fraction at a very large n.
  const far = evalTex(fraction, { n: 1e7 })
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [], minus(show(L))),
      answer: L,
      tolerance: 0,
    },
    check: { agrees: Math.abs(far - L) < 1e-4 && !near(b / d, L), detail: `printed fraction at n = 10^7: ${far}` },
    values: { a, b, c, d, L },
  }
}

/** q8: which term of n^2 + bn + c has a given value. */
function quadraticWhichTerm(r: Rng, slot: Question): Draft {
  // Factor pairs a student can find by hand: the larger root is at most 22.
  const N = int(r, 5, 15)
  const { b, c } = draw(
    r,
    // b is never ±1, so the n term keeps a real coefficient; −2 is as low as it goes and the terms still rise.
    (r) => ({ b: pick(r, [-2, 2, 3, 4, 5, 6, 7]), c: r() < 0.6 ? 0 : draw(r, (r) => int(r, -9, 9), (v) => v !== 0) }),
    ({ b, c }) => N + b > 0 && ![Math.abs(b), Math.abs(c)].includes(N) && ![1, 2, 3, 4].map((n) => Math.abs(n * n + b * n + c)).includes(N),
  )
  const T = N * N + b * N + c
  const rule = sum([[1, 'n^2'], [b, 'n'], [c, '']])
  const terms = [1, 2, 3, 4].map((n) => n * n + b * n + c)
  const quad = sum([[1, 'n^2'], [b, 'n'], [c - T, '']])
  const other = N + b
  const factors = `(n + ${other})(n - ${N})`
  // Second route: the printed rule, term by term, until it reaches T.
  let n = 1
  while (evalTex(rule, { n }) < T && n < 200) n++
  return {
    question: {
      type: 'numeric',
      prompt: `The sequence $${list(terms)}, \\ldots$ has $n$th term $${rule}$. Which term has value ${T}?`,
      solution: `$${rule} = ${T}$, so $${quad} = 0$ and $${factors} = 0$. A position is positive, so $n = ${N}$: the ${ordinal(N)} term.`,
      markScheme: scheme(slot, [`${minus(quad.replace('^2', '²'))} = 0 factorised`], String(N)),
      answer: N,
      tolerance: 0,
    },
    check: { agrees: n === N && evalTex(rule, { n }) === T && evalTex(quad, { n: -other }) === 0, detail: `terms counted up to ${T}: term ${n}` },
    values: { b, c, N, T },
  }
}

interface Difference {
  a: number
  k: number
  N: number
  M: number
  /** The difference as a reduced fraction. */
  num: number
  den: number
}

/**
 * Every an/(n + k) with Nth − Mth terms a terminating decimal that is not whole, and that
 * the wrong route (the term at N − M) does not also give. Grouped by answer, so the answer is
 * drawn first and no one value dominates.
 */
const DIFFERENCES: Map<number, Difference[]> = (() => {
  const out = new Map<number, Difference[]>()
  for (let a = 2; a <= 6; a++)
    for (let k = 1; k <= 9; k++)
      for (let M = 2; M <= 20; M++)
        for (let N = M + 3; N <= 30; N++) {
          if (a === k) continue
          const [num, den] = reduce(a * k * (N - M), (N + k) * (M + k))
          // Not whole, and at most 3 decimal places (so it terminates).
          if (den === 1 || (1000 * num) % den !== 0) continue
          // The two terms over a common denominator a student can work with.
          const q1 = reduce(a * N, N + k)[1]
          const q2 = reduce(a * M, M + k)[1]
          if ((q1 * q2) / gcd(q1, q2) > 100) continue
          // The term at N − M, a slip for "the difference between the terms".
          const [wn, wd] = reduce(a * (N - M), N - M + k)
          if (wn === num && wd === den) continue
          const D = num / den
          // An answer equal to either term reads as if one term were the difference.
          if (near(D, (a * N) / (N + k)) || near(D, (a * M) / (M + k))) continue
          const list = out.get(D) ?? []
          list.push({ a, k, N, M, num, den })
          out.set(D, list)
        }
  return out
})()
const ANSWERS = [...DIFFERENCES.keys()].sort((x, y) => x - y)

/** q12: the difference between two terms of an/(n + k), as a decimal. */
function termDifference(r: Rng, slot: Question): Draft {
  const D = pick(r, ANSWERS)
  const { a, k, N, M, num, den } = pick(r, DIFFERENCES.get(D)!)
  const rule = `\\dfrac{${a}n}{n + ${k}}`
  const term = (n: number) => {
    const [p, q] = reduce(a * n, n + k)
    const raw = `\\frac{${a * n}}{${n + k}}`
    return { p, q, tex: q === n + k ? raw : `${raw} = ${fracTex(p, q, '\\frac')}` }
  }
  const big = term(N)
  const small = term(M)
  const common = (big.q * small.q) / gcd(big.q, small.q)
  const reduced = fracTex(num, den, '\\frac')
  const subtraction =
    big.q === small.q
      ? `${fracTex(big.p, big.q, '\\frac')} - ${fracTex(small.p, small.q, '\\frac')} = ${reduced}`
      : `${fracTex(big.p, big.q, '\\frac')} - ${fracTex(small.p, small.q, '\\frac')} = \\frac{${(big.p * common) / big.q}}{${common}} - \\frac{${(small.p * common) / small.q}}{${common}} = ${reduced}`
  const answer = Number(show(D))
  // Second route: the printed rule at N and at M.
  const read = evalTex(rule, { n: N }) - evalTex(rule, { n: M })
  return {
    question: {
      type: 'numeric',
      prompt: `The $n$th term of a sequence is $${rule}$. Work out the difference between the ${ordinal(N)} and ${ordinal(M)} terms. Give your answer as a decimal.`,
      solution: `The ${ordinal(N)} term is $${big.tex}$; the ${ordinal(M)} is $${small.tex}$. The difference is $${subtraction} = ${show(answer)}$.`,
      markScheme: scheme(slot, ['both terms found and simplified'], `${show(answer)} (${fracText(num, den)})`),
      answer,
      tolerance: 0,
    },
    check: { agrees: Math.abs(read - answer) < 1e-12 && (big.p * small.q - small.p * big.q) * den === num * big.q * small.q, detail: `printed rule at ${N} minus at ${M}: ${read}` },
    values: { a, k, N, M },
  }
}

export const limitingValueGenerators: Generator[] = [
  fmBySlot('fm-sequence-which-term', TOPIC, { q2: whichTerm, q15: whichTerm }),
  fmBySlot('fm-sequence-limiting-value', TOPIC, { q3: limitingValue, q7: limitingValue }),
  fmBySlot('fm-sequence-quadratic-which-term', TOPIC, { q8: quadraticWhichTerm }),
  fmBySlot('fm-sequence-term-difference', TOPIC, { q12: termDifference }),
]
