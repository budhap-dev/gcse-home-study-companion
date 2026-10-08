import type { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'
import { bySlot, coef, evalTex, sum } from './formulae.ts'

const SEQ = 'linear-quadratic-and-geometric-sequences'

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st. */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13
  const end = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
  return `${n}${end}`
}

const list = (xs: number[]) => xs.join(', ')
/** The terms of a printed nth-term rule, read from its text: the second method for every nth term. */
export const termsOf = (rule: string, from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => evalTex(rule, { n: from + i }))
const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]!) < 1e-9)
const differences = (xs: number[]) => xs.slice(1).map((x, i) => x - xs[i]!)
const minus = (s: string) => s.replace(/-/g, '−')

/** q1: the nth term of a linear sequence. */
function linearNthTerm(r: Rng, slot: Question): Draft {
  const { d, c } = draw(
    r,
    (r) => ({ d: r() < 0.85 ? int(r, 2, 9) : -int(r, 2, 6), c: int(r, -10, 12) }),
    ({ d, c }) => c !== 0 && Math.abs(c) !== Math.abs(d),
  )
  const terms = [1, 2, 3, 4].map((n) => d * n + c)
  const multiples = [1, 2, 3, 4].map((n) => d * n)
  const rule = sum([[d, 'n'], [c, '']])
  const table = d > 0 ? `The ${d} times table is ${list(multiples)}` : `$${d}n$ gives ${list(multiples)}`
  const gap = `each ${Math.abs(c)} ${c > 0 ? 'less' : 'more'} than the sequence`
  return {
    question: {
      type: 'short-text',
      prompt: `Find the nth term of ${list(terms)}.`,
      solution: `The differences are all ${d}, so the rule starts $${d}n$. ${table}, ${gap}, so the nth term is $${rule}$.`,
      markScheme: scheme(slot, [`difference of ${minus(String(d))}`], minus(rule)),
      accepted: [sum([[d, 'n'], [c, '']], false), sum([[c, ''], [d, 'n']], false)],
    },
    check: { agrees: same(termsOf(rule, 1, 4), terms) && terms[0]! - d === c, detail: `${rule} for n = 1 to 4: ${termsOf(rule, 1, 4)}` },
    values: { d, c },
  }
}

/** q2: a term from the nth-term rule. */
function termFromRule(r: Rng, slot: Question): Draft {
  const a = r() < 0.85 ? int(r, 2, 9) : -int(r, 2, 5)
  const b = draw(r, (r) => int(r, -10, 10), (b) => b !== 0)
  const k = int(r, 5, 30)
  const rule = sum([[a, 'n'], [b, '']])
  const answer = a * k + b
  // Second route: start at the first term and add the difference k − 1 times.
  let t = a + b
  for (let i = 1; i < k; i++) t += a
  return {
    question: {
      type: 'numeric',
      prompt: `A sequence has nth term $${rule}$. What is the ${ordinal(k)} term?`,
      solution: `$${a} \\times ${k} ${b < 0 ? '-' : '+'} ${Math.abs(b)} = ${a * k} ${b < 0 ? '-' : '+'} ${Math.abs(b)} = ${answer}$.`,
      markScheme: scheme(slot, [], minus(String(answer))),
      answer,
      tolerance: 0,
    },
    check: { agrees: t === answer && evalTex(rule, { n: k }) === answer, detail: `first term ${a + b} plus ${k - 1} steps of ${a}: ${t}` },
    values: { a, b, k },
  }
}

/** q4: the next term of a Fibonacci-type sequence. */
function fibonacciNext(r: Rng, slot: Question): Draft {
  const a = int(r, 1, 15)
  const b = int(r, 1, 15)
  const shown = pick(r, [4, 4, 5])
  const terms = [a, b]
  while (terms.length < shown + 1) terms.push(terms.at(-1)! + terms.at(-2)!)
  const answer = terms.at(-1)!
  const given = terms.slice(0, shown)
  // Second route: the terms as multiples of the first two, F(n−2)a + F(n−1)b.
  const fib = [0, 1, 1, 2, 3, 5, 8]
  const direct = fib[shown - 1]! * a + fib[shown]! * b
  return {
    question: {
      type: 'numeric',
      prompt: `What is the next term of the Fibonacci-type sequence ${list(given)}?`,
      solution: `Each term is the sum of the two before: $${given.at(-2)} + ${given.at(-1)} = ${answer}$.`,
      markScheme: scheme(slot, [], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: direct === answer, detail: `${fib[shown - 1]} × ${a} + ${fib[shown]} × ${b} = ${direct}` },
    values: { a, b, shown },
  }
}

/** q5: which term has a given value. */
function whichTerm(r: Rng, slot: Question): Draft {
  const a = int(r, 2, 9)
  const b = draw(r, (r) => int(r, -10, 10), (b) => b !== 0)
  const N = int(r, 10, 80)
  const T = a * N + b
  const rule = sum([[a, 'n'], [b, '']])
  let n = 1
  let t = a + b
  while (t < T) {
    t += a
    n++
  }
  return {
    question: {
      type: 'numeric',
      prompt: `A sequence has nth term $${rule}$. Which term is equal to ${T}?`,
      solution: `$${rule} = ${T}$ gives $${a}n = ${T - b}$, so $n = ${N}$. It is the **${ordinal(N)}** term.`,
      markScheme: scheme(slot, [`sets ${minus(rule)} = ${T}`], String(N)),
      answer: N,
      tolerance: 0,
    },
    check: { agrees: n === N && t === T, detail: `counting up in ${a}s from ${a + b}: term ${n} is ${t}` },
    values: { a, b, N },
  }
}

/** q6: the coefficient of n² from the second difference. */
function secondDifference(r: Rng, slot: Question): Draft {
  const given = r() < 0.3
  const a = given ? pick(r, [1, 2, 3, 4, 5, 6, 7, 8, 9, -1, -2, -3, 0.5, 1.5, 2.5, 3.5]) : pick(r, [1, 2, 3, 4, 5, 6, -1, -2, -3])
  if (given) {
    const second = 2 * a
    return {
      question: {
        type: 'numeric',
        prompt: `A quadratic sequence has a second difference of ${show(second)}. What is the coefficient of $n^2$?`,
        solution: `The second difference is $2a$, so $a = ${sub(second)} \\div 2 = ${show(a)}$.`,
        markScheme: scheme(slot, ['second difference = 2a'], minus(show(a))),
        answer: a,
        tolerance: 0,
      },
      check: { agrees: show(2 * a) === show(second) && differences(differences([1, 2, 3, 4].map((n) => a * n * n)))[0] === second, detail: `second differences of ${show(a)}n²: ${second}` },
      values: { a, given: 'second difference' },
    }
  }
  const b = int(r, -6, 6)
  const c = int(r, -5, 10)
  const terms = [1, 2, 3, 4].map((n) => a * n * n + b * n + c)
  const first = differences(terms)
  const second = differences(first)
  return {
    question: {
      type: 'numeric',
      prompt: `A quadratic sequence begins ${list(terms)}. What is the coefficient of $n^2$ in its nth term?`,
      solution: `First differences ${list(first)}; second differences ${show(second[0]!)}. The second difference is $2a$, so $a = ${sub(second[0]!)} \\div 2 = ${show(a)}$.`,
      markScheme: scheme(slot, ['second difference = 2a'], minus(show(a))),
      answer: a,
      tolerance: 0,
    },
    check: { agrees: second.every((s) => Math.abs(s - 2 * a) < 1e-9), detail: `second differences of the terms: ${second}` },
    values: { a, b, c, given: 'terms' },
  }
}
const sub = (n: number) => (n < 0 ? `(${show(n)})` : show(n))

/** q7: the common ratio of a geometric sequence. */
function commonRatio(r: Rng, slot: Question): Draft {
  const ratio = pick(r, [2, 3, 4, 5, 6, -2, -3, 0.5, 2, 3])
  const a = ratio === 0.5 ? 4 * int(r, 2, 40) : int(r, 1, 20)
  const terms = [a, a * ratio, a * ratio * ratio]
  return {
    question: {
      type: 'numeric',
      prompt: `A geometric sequence starts ${list(terms)}. What is the common ratio?`,
      solution: `$${terms[1]} \\div ${sub(terms[0]!)} = ${show(ratio)}$ and $${terms[2]} \\div ${sub(terms[1]!)} = ${show(ratio)}$, so $r = ${show(ratio)}$.`,
      markScheme: scheme(slot, [], minus(show(ratio))),
      answer: ratio,
      tolerance: 0,
    },
    check: { agrees: terms[1]! * ratio === terms[2] && terms[0]! * ratio * ratio === terms[2], detail: `${a} × ${ratio}² = ${a * ratio * ratio}` },
    values: { a, ratio },
  }
}

const SHRINK: Record<number, { verb: string; done: string; times: (k: number) => string }> = {
  2: { verb: 'halves each time', done: 'halve', times: (k) => `halves ${WORDS[k]} times` },
  3: { verb: 'is divided by 3 each time', done: 'divide by 3', times: (k) => `divides by 3 ${WORDS[k]} times` },
  10: { verb: 'is divided by 10 each time', done: 'divide by 10', times: (k) => `divides by 10 ${WORDS[k]} times` },
}
const WORDS = ['no', 'once', 'twice', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

/** q8: a term of a shrinking geometric sequence: n − 1 steps, not n. */
function shrinkingTerm(r: Rng, slot: Question): Draft {
  const D = pick(r, [2, 2, 2, 3, 10])
  const { n, k } = draw(r, (r) => ({ n: int(r, 4, 8), k: int(r, 1, 30) }), ({ n, k }) => k * D ** (n - 1) <= 100000 && k % D !== 0)
  const start = k * D ** (n - 1)
  const chain = Array.from({ length: n }, (_, i) => start / D ** i)
  const word = SHRINK[D]!
  const steps = n - 1
  return {
    question: {
      type: 'numeric',
      prompt: `A geometric sequence starts ${start} and ${word.verb}. What is its ${ordinal(n)} term?`,
      solution: `To reach the ${ordinal(n)} term you ${word.done} **${WORDS[steps]}** times: $${chain.join(' \\to ')}$.`,
      markScheme: scheme(slot, [`${word.times(steps)}, not ${WORDS[n]}`], String(k)),
      answer: k,
      tolerance: 0,
    },
    check: { agrees: Math.abs(start * (1 / D) ** (n - 1) - k) < 1e-9 && chain.at(-1) === k, detail: `${start} × (1/${D})^${n - 1} = ${start * (1 / D) ** (n - 1)}` },
    values: { start, D, n },
  }
}

/** q11: the nth term of a quadratic sequence. */
function quadraticNthTerm(r: Rng, slot: Question): Draft {
  const { a, b, c } = draw(
    r,
    (r) => ({ a: pick(r, [1, 1, 2, 2, 3, -1]), b: int(r, -8, 8), c: int(r, -8, 10) }),
    ({ a, b, c }) => b !== 0 && [1, 2, 3, 4].every((n) => Math.abs(a * n * n + b * n + c) <= 80) && b + c !== 0,
  )
  const terms = [1, 2, 3, 4].map((n) => a * n * n + b * n + c)
  const first = differences(terms)
  const second = differences(first)[0]!
  const left = [1, 2, 3, 4].map((n) => b * n + c)
  const rest = sum([[b, 'n'], [c, '']])
  const rule = sum([[a, 'n^2'], [b, 'n'], [c, '']])
  const an2 = coef(a, 'n^2')
  return {
    question: {
      type: 'short-text',
      prompt: `Find the nth term of the quadratic sequence ${list(terms)}.`,
      solution: `First differences ${list(first)}; second differences ${second}, so $a = ${a}$. Subtracting $${an2}$ leaves ${list(left)}, which is $${rest}$. The nth term is $${rule}$.`,
      markScheme: scheme(slot, [`second difference ${minus(String(second))}, so a = ${minus(String(a))}`, `subtracts ${an2.replace('^2', '²')} to leave ${minus(rest)}`], minus(rule.replace('^2', '²'))),
      accepted: [sum([[a, 'n^2'], [b, 'n'], [c, '']], false)],
    },
    check: { agrees: same(termsOf(rule, 1, 4), terms) && second === 2 * a, detail: `${rule} for n = 1 to 4: ${termsOf(rule, 1, 4)}` },
    values: { a, b, c },
  }
}

/** q12: a term of a growing geometric sequence, by a power of n − 1. */
function geometricTerm(r: Rng, slot: Question): Draft {
  const { a, ratio, n } = draw(
    r,
    (r) => ({ a: int(r, 2, 9), ratio: pick(r, [2, 2, 3, 3, -2, 4, 5]), n: int(r, 5, 10) }),
    ({ a, ratio, n }) => Math.abs(a * ratio ** (n - 1)) <= 200000,
  )
  const power = ratio ** (n - 1)
  const answer = a * power
  let t = a
  for (let i = 1; i < n; i++) t *= ratio
  const r0 = sub(ratio)
  return {
    question: {
      type: 'numeric',
      prompt: `A geometric sequence starts ${a} and has common ratio ${ratio}. What is its ${ordinal(n)} term?`,
      solution: `To reach the ${ordinal(n)} term you multiply by ${ratio} **${WORDS[n - 1]}** times: $${a} \\times ${r0}^{${n - 1}} = ${a} \\times ${sub(power)} = ${answer}$.`,
      markScheme: scheme(slot, [`uses ${ratio} to the power ${n - 1}, not ${n}`, `${a} × ${minus(String(power))}`], minus(String(answer))),
      answer,
      tolerance: 0,
    },
    check: { agrees: t === answer, detail: `multiplied by ${ratio} one step at a time: ${t}` },
    values: { a, ratio, n },
  }
}

/** q14: which term of a quadratic sequence has a given value. */
function quadraticWhichTerm(r: Rng, slot: Question): Draft {
  const { b, c, N } = draw(
    r,
    (r) => ({ b: int(r, -3, 8), c: pick(r, [0, 0, 0, int(r, -5, 10)]), N: int(r, 4, 15) }),
    // b = 0 made it "n² = 81", a square root rather than the quadratic the 3 marks are for.
    ({ b, N }) => b !== 0 && N + b > 0 && 1 + b > 0,
  )
  const T = N * N + b * N + c
  const rule = sum([[1, 'n^2'], [b, 'n'], [c, '']])
  const k = c - T
  const other = -(N + b)
  const quad = sum([[1, 'n^2'], [b, 'n'], [k, '']])
  const factor = (root: number) => `(n ${root < 0 ? '+' : '-'} ${Math.abs(root)})`
  let n = 1
  while (evalTex(rule, { n }) < T && n < 100) n++
  return {
    question: {
      type: 'numeric',
      prompt: `The nth term of a sequence is $${rule}$. Which term is equal to ${T}?`,
      solution: `$${rule} = ${T}$ gives $${quad} = 0$, which factorises as $${factor(other)}${factor(N)} = 0$. Rejecting $n = ${other}$, since a position cannot be negative, leaves $n = ${N}$.`,
      markScheme: scheme(slot, [`forms ${minus(quad.replace('^2', '²'))} = 0`, 'factorises and rejects the negative root'], String(N)),
      answer: N,
      tolerance: 0,
    },
    check: { agrees: n === N && evalTex(rule, { n }) === T, detail: `terms counted up to ${T}: term ${n}` },
    values: { b, c, N },
  }
}

/** q16: the difference between two terms of a linear sequence. */
function termDifference(r: Rng, slot: Question): Draft {
  const a = int(r, 2, 9)
  const b = draw(r, (r) => int(r, -10, 12), (b) => b !== 0)
  const { N, M } = draw(r, (r) => ({ N: int(r, 8, 40), M: int(r, 2, 30) }), ({ N, M }) => N > M + 2)
  const rule = sum([[a, 'n'], [b, '']])
  const tN = a * N + b
  const tM = a * M + b
  const answer = a * (N - M)
  return {
    question: {
      type: 'numeric',
      prompt: `A sequence has nth term $${rule}$. What is the difference between the ${ordinal(N)} and the ${ordinal(M)} terms?`,
      solution: `The ${ordinal(N)} is $${tN}$ and the ${ordinal(M)} is $${tM}$, a difference of ${answer}. Or note that ${N - M} steps of ${a} is $${N - M} \\times ${a} = ${answer}$.`,
      markScheme: scheme(slot, [`finds both terms, or uses ${N - M} steps of ${a}`], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: evalTex(rule, { n: N }) - evalTex(rule, { n: M }) === answer, detail: `${tN} − ${tM}` },
    values: { a, b, N, M },
  }
}

/** Generators for linear, quadratic and geometric sequences. */
export const sequencesGenerators: Generator[] = [
  bySlot('sequence-linear', SEQ, { q1: linearNthTerm, q2: termFromRule, q5: whichTerm, q16: termDifference }),
  bySlot('sequence-other', SEQ, { q4: fibonacciNext, q6: secondDifference, q11: quadraticNthTerm, q14: quadraticWhichTerm }),
  bySlot('sequence-geometric', SEQ, { q7: commonRatio, q8: shrinkingTerm, q12: geometricTerm }),
]
