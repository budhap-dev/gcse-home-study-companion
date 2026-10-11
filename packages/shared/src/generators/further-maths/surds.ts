import type { Question } from '../../content/questions.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'
import { coef, evalTex, near, sum } from '../maths/formulae.ts'
import { surdTex, wholeSqrt } from '../maths/surds.ts'
import { fmBySlot, minus } from './build.ts'

/**
 * Further Maths (AQA 8365), surds-and-exact-calculation: specification 1.3, manipulation of
 * surds and the use of surds in exact calculations. Collecting like surds after simplifying
 * each (q2), the exact area of a square with a surd side (q7) and comparing rational and surd
 * parts to find an unknown (q12).
 */

const TOPIC = 'surds-and-exact-calculation'

/** The first maths span of a text. */
const firstMath = (text: string) => /\$([^$]+)\$/.exec(text)![1]!

/** Whether n is a perfect square. */
const isSquare = (n: number) => n >= 0 && wholeSqrt(n) !== undefined

/**
 * q2: √12 + √27 = 5√3, so a = 5. Both roots need simplifying, as in the written question;
 * sometimes a difference. The numbers under the roots stay within 200, where a student knows
 * the square factors by heart.
 */
function collectingLikeSurds(r: Rng, slot: Question): Draft {
  const add = r() < 0.75
  // m first and outside the draw: rerolling m with k1 and k2 favoured m = 2, which fits the most k.
  const m = pick(r, [2, 3, 5, 6, 7, 10])
  const most = Math.floor(Math.sqrt(200 / m))
  const { k1, k2 } = draw(
    r,
    (r) => ({ k1: int(r, 2, most), k2: int(r, 2, most) }),
    ({ k1, k2 }) => {
      const K = add ? k1 + k2 : k1 - k2
      return (
        k1 !== k2 && k1 * k1 * m <= 200 && k2 * k2 * m <= 200 && K >= 2 &&
        // An answer equal to the number left under the root reads as a copy.
        K !== m &&
        // √(a ± b) must not simplify too, or adding under the root gives a clean wrong answer.
        !isSquare(add ? k1 * k1 + k2 * k2 : k1 * k1 - k2 * k2)
      )
    },
  )
  const K = add ? k1 + k2 : k1 - k2
  const a = k1 * k1 * m
  const b = k2 * k2 * m
  const op = add ? '+' : '-'
  const prompt = `Write $\\sqrt{${a}} ${op} \\sqrt{${b}}$ in the form $a\\sqrt{${m}}$. What is $a$?`
  const result = add ? `together they make $${surdTex(K, m)}$` : `the difference is $${surdTex(k1, m)} - ${surdTex(k2, m)} = ${surdTex(K, m)}$`
  // Second route: the printed sum as a decimal, divided by √m.
  const read = evalTex(firstMath(prompt)) / Math.sqrt(m)
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `$\\sqrt{${a}} = \\sqrt{${k1 * k1}} \\times \\sqrt{${m}} = ${surdTex(k1, m)}$ and $\\sqrt{${b}} = \\sqrt{${k2 * k2}} \\times \\sqrt{${m}} = ${surdTex(k2, m)}$; ${result}, so $a = ${K}$.`,
      markScheme: scheme(slot, [], `a = ${K}`),
      answer: K,
      tolerance: 0,
    },
    check: { agrees: near(read, K), detail: `printed sum ÷ √${m} = ${read}` },
    values: { m, k1, k2, add: String(add) },
  }
}

/** Named squares and the smallest side each can sensibly have; a plain square fits any side. */
export const SQUARES = [
  { noun: 'A square', unit: 'cm', least: 0 },
  { noun: 'A square tile', unit: 'cm', least: 5 },
  { noun: 'A square photo frame', unit: 'cm', least: 5 },
  { noun: 'A square garden', unit: 'm', least: 3 },
  { noun: 'A square patio', unit: 'm', least: 3 },
]

/**
 * q7: a square of side (k√m ± b) has area (a ± c√m); find a = k²m + b². b is at least 3, so
 * forgetting to square it (k²m + b) does not give the answer and 2² = 2 × 2 cannot pay; b is
 * never 2k, where b² = 2kb and adding the printed surd coefficient to (k√m)² would. k is 2 or 3
 * in some builds, so (k√m)² = km is a slip that shows. The side is worked out first and a named
 * object used only where it is in scale.
 */
function exactArea(r: Rng, slot: Question): Draft {
  const plus = r() < 0.65
  const { k, m, b } = draw(
    r,
    (r) => ({ k: r() < 0.6 ? 1 : pick(r, [2, 3]), m: pick(r, [2, 3, 5, 6, 7, 10, 11, 13]), b: int(r, 3, 7) }),
    ({ k, m, b }) => {
      const c = 2 * k * b
      return (
        k * k * m <= 63 && b !== m && b !== k && c !== m && b !== 2 * k &&
        // The side must be positive.
        (plus || k * k * m > b * b)
      )
    },
  )
  const a = k * k * m + b * b
  const c = 2 * k * b
  const root = surdTex(k, m)
  const bFirst = plus && r() < 0.35
  const side = plus ? (bFirst ? `${b} + ${root}` : `${root} + ${b}`) : `${root} - ${b}`
  const op = plus ? '+' : '-'
  const area = `${a} ${op} ${c}\\sqrt{${m}}`
  const length = k * Math.sqrt(m) + (plus ? b : -b)
  const { noun, unit } = pick(r, SQUARES.filter((s) => length >= s.least))
  const prompt = `${noun} has sides of length $(${side})$ ${unit}. Its exact area is $(a ${op} ${c}\\sqrt{${m}})$ ${unit}². What is $a$?`
  const rootSq = k * k * m
  const terms = bFirst ? `${b * b} + ${c}\\sqrt{${m}} + ${rootSq}` : `${rootSq} ${op} ${c}\\sqrt{${m}} + ${b * b}`
  const squareRoot = k === 1 ? '' : ` Here $(${root})^2 = ${k * k} \\times ${m} = ${rootSq}$.`
  // Second route: the printed side squared as a decimal, less the surd part of the printed area.
  const sideValue = evalTex(side)
  const read = sideValue ** 2 - (plus ? 1 : -1) * evalTex(`${c}\\sqrt{${m}}`)
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `$(${side})^2 = ${terms} = ${area}$, so $a = ${a}$.${squareRoot} Squaring the side squares the whole bracket, middle term included.`,
      markScheme: scheme(slot, [], `a = ${a}`),
      answer: a,
      tolerance: 0,
    },
    check: { agrees: sideValue > 0 && near(read, a), detail: `(${side})² less the surd part: ${read}` },
    values: { k, m, b, plus: String(plus), unit },
  }
}

/**
 * q12: (p + q√m)(c ± √m) = R + S√m with p and q whole; find p. Rational and surd parts give
 * two equations, solved by substitution as the written solution does.
 */
function comparingParts(r: Rng, slot: Question): Draft {
  // p first, so its spread is the drawn one; p = ±1 is left out (the written p is 3).
  const p = (r() < 0.5 ? -1 : 1) * int(r, 2, 7)
  const { q, c, e, m } = draw(
    r,
    (r) => ({ q: (r() < 0.5 ? -1 : 1) * int(r, 1, 5), c: int(r, 2, 5), e: r() < 0.6 ? -1 : 1, m: pick(r, [2, 3, 5, 6, 7]) }),
    ({ q, c, e, m }) => {
      const R = c * p + e * m * q
      const S = e * p + c * q
      // Swapping which part is rational: cp + emq = S, ep + cq = R, solved for p.
      const swapped = (c * S - e * m * R) / (c * c - m)
      // Sign slip on √m × √m: cp − emq = R with the surd equation right.
      const slip = (c * R + e * m * S) / (c * c + m)
      return (
        R !== 0 && S !== 0 && c !== m && Math.abs(R) <= 40 && Math.abs(S) <= 30 && Math.abs(q) !== Math.abs(p) &&
        // The answer is not a printed number.
        ![Math.abs(R), Math.abs(S), c, m].includes(Math.abs(p)) &&
        swapped !== p && slip !== p
      )
    },
  )
  const R = c * p + e * m * q
  const S = e * p + c * q
  const rt = `\\sqrt{${m}}`
  const lhs = `(p + q${rt})(${c} ${e < 0 ? '-' : '+'} ${rt})`
  const rhs = `${R} ${S < 0 ? '-' : '+'} ${surdTex(Math.abs(S), m)}`
  const prompt = `Given that $${lhs} = ${rhs}$, where $p$ and $q$ are integers, find $p$.`
  const rational = sum([[c, 'p'], [e * m, 'q']])
  const surdPart = sum([[c, 'q'], [e, 'p']])
  const expanded = sum([[c, 'p'], [e, `p${rt}`], [c, `q${rt}`], [e * m, 'q']])
  // From cq + ep = S: p = e(S − cq).
  const pExpr = -e * c > 0 ? sum([[-e * c, 'q'], [e * S, '']]) : sum([[e * S, ''], [-e * c, 'q']])
  const substituted = sum([[-e * c * c, 'q'], [c * e * S, ''], [e * m, 'q']])
  const Q = -e * c * c + e * m
  const rhsQ = R - c * e * S
  // Collected: 7q = −7; or, where q's coefficient is ±1, q + 4 = 8 (never 1q).
  const solveQ = Math.abs(Q) === 1 ? `$${sum([[Q, 'q'], [c * e * S, '']])} = ${R}$, ` : `$${coef(Q, 'q')} = ${rhsQ}$, `
  const solution =
    `Expand: $${expanded} = (${rational}) + (${surdPart})${rt}$. ` +
    `Rational parts: $${rational} = ${R}$. Surd parts: $${surdPart} = ${S}$, so $p = ${pExpr}$. ` +
    `Then $${substituted} = ${R}$, so ${solveQ}$q = ${q}$ and $p = ${p}$.`
  // Second route: the answer put back into the printed left side, against the printed right
  // side; and p by elimination, independent of the substitution above.
  const back = evalTex(lhs, { p, q })
  const want = evalTex(rhs)
  const eliminated = (c * R - e * m * S) / (c * c - m)
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [minus(`expands and separates the two parts: ${rational} = ${R} and ${surdPart} = ${S}`)], minus(`p = ${p}`)),
      answer: p,
      tolerance: 0,
    },
    check: { agrees: near(back, want) && eliminated === p && Q * q === rhsQ, detail: `printed left side at p = ${p}, q = ${q}: ${back}, right side ${want}; elimination ${eliminated}` },
    values: { p, q, c, e, m, R, S },
  }
}

export const surdGenerators: Generator[] = [
  fmBySlot('fm-surds-collecting', TOPIC, { q2: collectingLikeSurds }),
  fmBySlot('fm-surds-exact-area', TOPIC, { q7: exactArea }),
  fmBySlot('fm-surds-comparing-parts', TOPIC, { q12: comparingParts }),
]
