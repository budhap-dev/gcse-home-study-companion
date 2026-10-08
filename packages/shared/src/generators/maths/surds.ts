import { draw, int, pick } from '../random.ts'
import type { Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Check, Draft, Generator } from '../types.ts'
import { fromTex, gcd, largestSquareFactor, mathIn, parseWith, valueOf } from './quadratics.ts'

const SURDS = 'surds'

/** Whole numbers 2 to 30 with no square factor: the numbers a surd in its simplest form keeps under the root. */
export const SQUARE_FREE = Array.from({ length: 29 }, (_, i) => i + 2).filter((n) => largestSquareFactor(n) === 1)
const squareFreeUpTo = (most: number) => SQUARE_FREE.filter((n) => n <= most)

/** The whole-number square root, by counting up; undefined when n is not a perfect square. */
export function wholeSqrt(n: number): number | undefined {
  for (let k = 0; k * k <= n; k++) if (k * k === n) return k
  return undefined
}

/** k√m printed: 4\sqrt{2}, \sqrt{2}, -\sqrt{2}. */
export const surdTex = (k: number, m: number) => `${k < 0 ? '-' : ''}${Math.abs(k) === 1 ? '' : Math.abs(k)}\\sqrt{${m}}`
/** k√m typed, as the written answers are: 4√2, √2, -√2. */
export const surdTyped = (k: number, m: number) => `${k < 0 ? '-' : ''}${Math.abs(k) === 1 ? '' : Math.abs(k)}√${m}`

/** r + s√m typed both ways round, as written q6 lists them: 2√2-1 and -1+2√2. */
function mixedForms(rational: number, k: number, m: number): string[] {
  const surdFirst = `${surdTyped(k, m)}${rational < 0 ? '-' : '+'}${Math.abs(rational)}`
  const rationalFirst = `${rational}${k < 0 ? '-' : '+'}${surdTyped(Math.abs(k), m)}`
  return [surdFirst, rationalFirst]
}
/** r + k√m printed: 2\sqrt{2} - 1. */
const mixedTex = (rational: number, k: number, m: number) => `${surdTex(k, m)} ${rational < 0 ? '-' : '+'} ${Math.abs(rational)}`

const close = (a: number, b: number) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b))

/** Every accepted form read as a number agrees with the value worked from the prompt's own printed maths. */
function valueCheck(accepted: string[], want: number, extra = true, note = ''): Check {
  const bad = accepted.filter((a) => !close(valueOf(a), want))
  return { agrees: bad.length === 0 && extra, detail: `${note}; prompt value ${want}; wrong forms: ${bad.join(' | ')}` }
}

/**
 * Whether a typed answer still has a root below a fraction line, read by structure: in
 * 15/7-5/7√2 the root multiplies 5/7, so it is not below; in 3/√2 it is. Unreadable counts as yes.
 */
export function rootBelowALine(typed: string): boolean {
  interface Node {
    root: boolean
    bad: boolean
  }
  const both = (a: Node, b: Node): Node => ({ root: a.root || b.root, bad: a.bad || b.bad })
  const leaf = (): Node => ({ root: false, bad: false })
  try {
    return parseWith<Node>(typed, {
      num: leaf,
      letter: leaf,
      add: both,
      mul: both,
      div: (a, b) => ({ root: a.root || b.root, bad: a.bad || b.bad || b.root }),
      neg: (a) => a,
      pow: (a) => a,
      sqrt: (a) => ({ root: true, bad: a.bad }),
    }).bad
  } catch {
    return true
  }
}

/** A typed k√m read back into its whole numbers. */
function readSurd(typed: string): { k: number; m: number } | null {
  const m = /^(\d*)√(\d+)$/.exec(typed)
  return m ? { k: m[1] ? Number(m[1]) : 1, m: Number(m[2]) } : null
}

/** √5 × √20 = 10: written as q2. */
export const multiplyingSurds: Generator = {
  id: 'multiplying-surds',
  subjectId: 'maths',
  topicId: SURDS,
  replaces: ['q2'],
  build(r, slot): Draft {
    const { s, k, m } = draw(r, (r) => ({ s: pick(r, squareFreeUpTo(15)), k: int(r, 1, 6), m: int(r, 1, 6) }), ({ s, k, m }) => k !== m && s * k * k <= 200 && s * m * m <= 200)
    const a = s * k * k
    const b = s * m * m
    const answer = s * k * m
    // Second route: a × b is a perfect square, found by counting, whose root is the answer.
    const root = wholeSqrt(a * b)
    return {
      question: {
        type: 'numeric',
        prompt: `Work out $\\sqrt{${a}} \\times \\sqrt{${b}}$.`,
        solution: `$\\sqrt{${a}} \\times \\sqrt{${b}} = \\sqrt{${a * b}} = ${answer}$.`,
        markScheme: scheme(slot, [], String(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: root === answer, detail: `√${a * b} by counting: ${root}` },
      values: { a, b },
    }
  },
}

/** √32 = 4√2: written as q3. */
export const simplifyingASurd: Generator = {
  id: 'simplifying-a-surd',
  subjectId: 'maths',
  topicId: SURDS,
  replaces: ['q3'],
  build(r, slot): Draft {
    const { k, m } = draw(r, (r) => ({ k: int(r, 2, 12), m: pick(r, SQUARE_FREE) }), ({ k, m }) => k * k * m <= 400)
    const n = k * k * m
    // The exam's two wordings of the same task.
    const prompt = r() < 0.6 ? `Simplify $\\sqrt{${n}}$.` : `Write $\\sqrt{${n}}$ in the form $a\\sqrt{b}$, where $a$ and $b$ are whole numbers and $b$ is as small as possible.`
    const accepted = [surdTyped(k, m)]
    // Second route: square the answer in whole numbers and get the number under the printed root back; nothing square left inside.
    const printed = valueOf(fromTex(mathIn(prompt))) ** 2
    const read = readSurd(accepted[0]!)
    const ok = !!read && read.k * read.k * read.m === n && Math.round(printed) === n && largestSquareFactor(read.m) === 1
    return {
      question: {
        type: 'short-text',
        prompt,
        solution: `The largest square factor of ${n} is ${k * k}: $\\sqrt{${n}} = \\sqrt{${k * k}} \\times \\sqrt{${m}} = ${surdTex(k, m)}$.`,
        markScheme: scheme(slot, [`$\\sqrt{${k * k}} \\times \\sqrt{${m}}$ or $\\sqrt{${k * k} \\times ${m}}$ seen`], `$${surdTex(k, m)}$`),
        accepted,
      },
      check: { agrees: ok, detail: `(${accepted[0]})² = ${read && read.k * read.k * read.m}, against ${n}` },
      values: { n },
    }
  },
}

/** √45 + √20 = 5√5: written as q4. Sometimes a difference, like surds subtracting. */
export const addingSurds: Generator = {
  id: 'adding-surds',
  subjectId: 'maths',
  topicId: SURDS,
  replaces: ['q4'],
  build(r, slot): Draft {
    const add = r() < 0.7
    const { m, k1, k2 } = draw(
      r,
      (r) => ({ m: pick(r, squareFreeUpTo(11)), k1: int(r, 1, 7), k2: int(r, 1, 7) }),
      ({ m, k1, k2 }) => k1 !== k2 && (k1 > 1 || k2 > 1) && k1 * k1 * m <= 200 && k2 * k2 * m <= 200 && (add || k1 > k2),
    )
    const a = k1 * k1 * m
    const b = k2 * k2 * m
    const K = add ? k1 + k2 : k1 - k2
    const say = (k: number, n: number) => (k === 1 ? `$\\sqrt{${n}}$ is already as simple as it gets` : `$\\sqrt{${n}} = ${surdTex(k, m)}$`)
    const seen = [k1, k2].filter((k) => k > 1).map((k) => `$${surdTex(k, m)}$`).join(' or ')
    // Second route, in whole numbers: (√a ± √b)² = a + b ± 2√(ab), with ab a perfect square, against (K√m)² = K²m.
    const root = wholeSqrt(a * b)
    const squared = root === undefined ? NaN : a + b + (add ? 2 : -2) * root
    const accepted = [surdTyped(K, m)]
    const read = readSurd(accepted[0]!)
    return {
      question: {
        type: 'short-text',
        prompt: `Simplify $\\sqrt{${a}} ${add ? '+' : '-'} \\sqrt{${b}}$.`,
        solution: `${say(k1, a)} and ${say(k2, b)}. Like surds ${add ? 'add' : 'subtract'}: $${surdTex(k1, m)} ${add ? '+' : '-'} ${surdTex(k2, m)} = ${surdTex(K, m)}$.`,
        markScheme: scheme(slot, [`${seen} seen`], `$${surdTex(K, m)}$`),
        accepted,
      },
      check: { agrees: !!read && read.k * read.k * read.m === squared && largestSquareFactor(read.m) === 1, detail: `(√${a} ${add ? '+' : '-'} √${b})² = ${squared}` },
      values: { a, b, add: String(add) },
    }
  },
}

/** 10/√5 = 2√5: written as q5. */
export const rationalisingASurd: Generator = {
  id: 'rationalising-a-surd',
  subjectId: 'maths',
  topicId: SURDS,
  replaces: ['q5'],
  build(r, slot): Draft {
    const { m, k } = draw(r, (r) => ({ m: pick(r, squareFreeUpTo(23)), k: int(r, 1, 10) }), ({ m, k }) => m * k <= 120)
    const a = m * k
    const accepted = [surdTyped(k, m)]
    const read = readSurd(accepted[0]!)
    // Second route: the answer times the root in the denominator gives the numerator back, in whole numbers; no root left below a line.
    const ok = !!read && read.m === m && read.k * m === a && !rootBelowALine(accepted[0]!)
    return {
      question: {
        type: 'short-text',
        prompt: `Rationalise the denominator of $\\dfrac{${a}}{\\sqrt{${m}}}$. Simplify your answer.`,
        solution: `Multiply top and bottom by $\\sqrt{${m}}$: $\\dfrac{${a}\\sqrt{${m}}}{${m}} = ${surdTex(k, m)}$.`,
        markScheme: scheme(slot, [`$\\frac{${a}\\sqrt{${m}}}{${m}}$ seen`], `$${surdTex(k, m)}$`),
        accepted,
      },
      check: { agrees: ok, detail: `${accepted[0]} × √${m} = ${read && read.k * m}` },
      values: { a, m },
    }
  },
}

/** (√2 + 3)(√2 - 1) = 2√2 - 1: written as q6. */
export const expandingSurdBrackets: Generator = {
  id: 'expanding-surd-brackets',
  subjectId: 'maths',
  topicId: SURDS,
  replaces: ['q6'],
  build(r, slot): Draft {
    const { m, a, b } = draw(
      r,
      (r) => ({ m: pick(r, squareFreeUpTo(15)), a: (r() < 0.5 ? -1 : 1) * int(r, 1, 9), b: (r() < 0.5 ? -1 : 1) * int(r, 1, 9) }),
      ({ m, a, b }) => a !== b && a + b !== 0 && m + a * b !== 0,
    )
    const R = m + a * b
    const K = a + b
    const rootFirst = r() < 0.7
    // A negative number goes after the root: (√10 − 6), never (−6 + √10).
    const bracket = (n: number) => (rootFirst || n < 0 ? `\\sqrt{${m}} ${n < 0 ? '-' : '+'} ${Math.abs(n)}` : `${n} + \\sqrt{${m}}`)
    const prompt = `Expand and simplify $(${bracket(a)})(${bracket(b)})$.`
    const t = (n: number) => (n < 0 ? `(${n})` : String(n))
    const terms = `$\\sqrt{${m}}\\times\\sqrt{${m}} = ${m}$, $\\sqrt{${m}}\\times${t(b)} = ${surdTex(b, m)}$, $${a}\\times\\sqrt{${m}} = ${surdTex(a, m)}$, $${a}\\times${t(b)} = ${a * b}$`
    const collect = `${m} ${a * b < 0 ? '-' : '+'} ${Math.abs(a * b)} ${b < 0 ? '-' : '+'} ${surdTex(Math.abs(b), m)} ${a < 0 ? '-' : '+'} ${surdTex(Math.abs(a), m)}`
    const accepted = mixedForms(R, K, m)
    // Second route: the printed brackets worked out as decimals, against each accepted form read as a decimal.
    const want = valueOf(fromTex(mathIn(prompt)))
    return {
      question: {
        type: 'short-text',
        prompt,
        solution: `Four terms: ${terms}. Collect: $${collect} = ${mixedTex(R, K, m)}$.`,
        markScheme: scheme(slot, ['Four correct terms', `$\\sqrt{${m}}\\times\\sqrt{${m}} = ${m}$`], `$${mixedTex(R, K, m)}$`),
        accepted,
      },
      check: valueCheck(accepted, want, accepted.every((f) => !f.includes('/')), `(${a} + √${m})(${b} + √${m})`),
      values: { m, a, b },
    }
  },
}

/** (2√3)² = 12: written as q7. */
export const squaringASurd: Generator = {
  id: 'squaring-a-surd',
  subjectId: 'maths',
  topicId: SURDS,
  replaces: ['q7'],
  build(r, slot): Draft {
    const { k, m } = draw(r, (r) => ({ k: int(r, 2, 9), m: pick(r, SQUARE_FREE) }), ({ k, m }) => k * k * m <= 600)
    const answer = k * k * m
    const prompt = `${pick(r, ['Work out', 'Evaluate'])} $(${surdTex(k, m)})^2$.`
    const printed = valueOf(fromTex(mathIn(prompt)))
    return {
      question: {
        type: 'numeric',
        prompt,
        solution: `$(${surdTex(k, m)})^2 = ${k}^2 \\times (\\sqrt{${m}})^2 = ${k * k} \\times ${m} = ${answer}$.`,
        markScheme: scheme(slot, [], String(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: close(printed, answer), detail: `${k}√${m} squared as decimals: ${printed}` },
      values: { k, m },
    }
  },
}

/**
 * Rationalising with a conjugate: 3/(√5 - √2) = √5 + √2 as q9 (two roots below the line, the
 * numerator a multiple of a - b so everything cancels) and 5/(3 + √2) = (15 - 5√2)/7 as q15
 * (a whole number and a root below, nothing cancels).
 */
export const rationalisingWithAConjugate: Generator = {
  id: 'rationalising-with-a-conjugate',
  subjectId: 'maths',
  topicId: SURDS,
  replaces: ['q9', 'q15'],
  build(r, slot): Draft {
    const minus = r() < 0.6
    if (slot.id === 'q9') {
      const { a, b, k } = draw(r, (r) => ({ a: pick(r, SQUARE_FREE), b: pick(r, SQUARE_FREE), k: pick(r, [1, 1, 1, 2, 3]) }), ({ a, b, k }) => a - b >= 2 && a - b <= 20 && k * (a - b) <= 40)
      const n = k * (a - b)
      const below = `\\sqrt{${a}} ${minus ? '-' : '+'} \\sqrt{${b}}`
      const conj = `\\sqrt{${a}} ${minus ? '+' : '-'} \\sqrt{${b}}`
      const sign = minus ? '+' : '-'
      const coef = k === 1 ? '' : String(k)
      const answerTex = `${coef}\\sqrt{${a}} ${sign} ${coef}\\sqrt{${b}}`
      const accepted = minus
        ? [`${coef}√${a}+${coef}√${b}`, `${coef}√${b}+${coef}√${a}`]
        : [`${coef}√${a}-${coef}√${b}`, `-${coef}√${b}+${coef}√${a}`]
      if (k > 1) accepted.push(`${k}(√${a}${sign}√${b})`)
      const prompt = `Rationalise the denominator of $\\dfrac{${n}}{${below}}$. Simplify your answer.`
      const tail = k === 1
        ? `The ${n}s cancel: $${answerTex}$.`
        : `$${n} \\div ${a - b} = ${k}$, so the answer is $${answerTex}$.`
      // Second route: each accepted form times the printed denominator gives the numerator; (√a - √b)(√a + √b) = a - b in whole numbers.
      const den = valueOf(fromTex(below))
      const bad = accepted.filter((f) => !close(valueOf(f) * den, n) || rootBelowALine(f))
      return {
        question: {
          type: 'short-text',
          prompt,
          solution: `Multiply top and bottom by the conjugate $${conj}$. The denominator becomes $${a} - ${b} = ${a - b}$, the numerator $${n}(${conj})$. ${tail}`,
          markScheme: scheme(slot, [`Multiplies by $\\frac{${conj.replace(/ /g, '')}}{${conj.replace(/ /g, '')}}$`, `Denominator $${a} - ${b} = ${a - b}$`], `$${answerTex}$`),
          accepted,
        },
        check: { agrees: bad.length === 0 && n % (a - b) === 0, detail: `wrong forms: ${bad.join(' | ')}` },
        values: { a, b, n, minus: String(minus) },
      }
    }
    const { a, m, n } = draw(
      r,
      (r) => ({ a: int(r, 2, 6), m: pick(r, SQUARE_FREE), n: int(r, 2, 9) }),
      ({ a, m, n }) => {
        const d = a * a - m
        return d >= 2 && gcd(n, d) === 1 && gcd(a, d) === 1
      },
    )
    const d = a * a - m
    const below = `${a}${minus ? '-' : '+'}\\sqrt{${m}}`
    const conj = `${a}${minus ? '+' : '-'}\\sqrt{${m}}`
    const s = minus ? '+' : '-'
    const accepted = [
      `${n}(${a}${s}√${m})/${d}`,
      `(${n * a}${s}${n}√${m})/${d}`,
      `${n * a}/${d}${s}${n}√${m}/${d}`,
      `${n * a}/${d}${s}(${n}/${d})√${m}`,
      `${n * a}/${d}${s}${n}/${d}√${m}`,
    ]
    const prompt = `Rationalise the denominator of $\\dfrac{${n}}{${below}}$.`
    // Second route: each accepted form times the printed denominator gives the numerator back, and no root sits below a line.
    const den = valueOf(fromTex(below))
    const bad = accepted.filter((f) => !close(valueOf(f) * den, n) || rootBelowALine(f))
    return {
      question: {
        type: 'short-text',
        prompt,
        solution: `Multiply top and bottom by the conjugate $${conj}$: denominator $${a * a} - ${m} = ${d}$, numerator $${n}(${conj}) = ${n * a} ${s} ${n}\\sqrt{${m}}$. The ${d} does not cancel, so the answer is $\\dfrac{${n * a} ${s} ${n}\\sqrt{${m}}}{${d}}$.`,
        markScheme: scheme(slot, ['Multiplies by the conjugate', `Denominator ${d}`], `$\\frac{${n * a}${s}${n}\\sqrt{${m}}}{${d}}$`),
        accepted,
      },
      check: { agrees: bad.length === 0 && (n * a) * (n * a) - n * n * m === n * n * d, detail: `wrong forms: ${bad.join(' | ')}` },
      values: { a, m, n, minus: String(minus) },
    }
  },
}

const RECTANGLES = [
  { noun: 'A rectangle', unit: 'cm' },
  { noun: 'A rectangular tile', unit: 'cm' },
  { noun: 'A rectangular sheet of card', unit: 'cm' },
  { noun: 'A rectangular patio', unit: 'm' },
]

/** A rectangle with sides (2 + √3) and (2 - √3) has area 1: written as q11. */
export const surdRectangleArea: Generator = {
  id: 'surd-rectangle-area',
  subjectId: 'maths',
  topicId: SURDS,
  replaces: ['q11'],
  build(r, slot): Draft {
    const { noun, unit } = pick(r, RECTANGLES)
    const { a, b, m } = draw(r, (r) => ({ a: int(r, 2, 12), b: pick(r, [1, 1, 1, 2, 3]), m: pick(r, squareFreeUpTo(15)) }), ({ a, b, m }) => a * a - b * b * m >= 1)
    const answer = a * a - b * b * m
    const s = surdTex(b, m)
    const side1 = `${a} + ${s}`
    const side2 = `${a} - ${s}`
    // Second route: multiply the two printed sides as decimals.
    const product = valueOf(fromTex(side1)) * valueOf(fromTex(side2))
    return {
      question: {
        type: 'numeric',
        prompt: `${noun} has sides of length $(${side1})$ ${unit} and $(${side2})$ ${unit}. Work out its area, in ${unit}².`,
        solution: `Area $= (${a}+${s})(${a}-${s}) = ${a * a} - ${surdTex(a * b, m)} + ${surdTex(a * b, m)} - ${b * b * m} = ${answer}$ ${unit}².`,
        markScheme: scheme(slot, [`$(${a}+${s})(${a}-${s})$ expanded with the surd terms cancelling`], String(answer)),
        answer,
        tolerance: 0,
        units: `${unit}²`,
      },
      check: { agrees: close(product, answer), detail: `as decimals: ${product}` },
      values: { a, b, m, unit },
    }
  },
}

/** (√8 + √2)/√2 = 3: written as q12. Each root simplified first, then the division. */
export const simplifyingBeforeDividing: Generator = {
  id: 'simplifying-before-dividing',
  subjectId: 'maths',
  topicId: SURDS,
  replaces: ['q12'],
  build(r, slot): Draft {
    const add = r() < 0.7
    const { m, p, q } = draw(
      r,
      (r) => ({ m: pick(r, squareFreeUpTo(10)), p: int(r, 1, 7), q: int(r, 1, 5) }),
      ({ m, p, q }) => p !== q && (p > 1 || q > 1) && p * p * m <= 200 && q * q * m <= 200 && (add || p > q),
    )
    const answer = add ? p + q : p - q
    const A = p * p * m
    const B = q * q * m
    const op = add ? '+' : '-'
    const said = [[p, A], [q, B]].filter(([k]) => k! > 1).map(([k, n]) => `$\\sqrt{${n}} = ${surdTex(k!, m)}$`)
    const prompt = `Work out $\\dfrac{\\sqrt{${A}} ${op} \\sqrt{${B}}}{\\sqrt{${m}}}$.`
    const printed = valueOf(fromTex(mathIn(prompt)))
    return {
      question: {
        type: 'numeric',
        prompt,
        solution: `${said.join(' and ')}, so the numerator is $${surdTex(answer, m)}$. Dividing by $\\sqrt{${m}}$ leaves $${answer}$.`,
        markScheme: scheme(slot, [`${said[0]} or numerator $${surdTex(answer, m)}$`], String(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: close(printed, answer), detail: `as decimals: ${printed}` },
      values: { m, p, q, add: String(add) },
    }
  },
}

/** (4 + √12)/2 = 2 + √3: written as q13. */
export const simplifyingASurdFraction: Generator = {
  id: 'simplifying-a-surd-fraction',
  subjectId: 'maths',
  topicId: SURDS,
  replaces: ['q13'],
  build(r, slot): Draft {
    const add = r() < 0.7
    const { c, i, j, m } = draw(r, (r) => ({ c: int(r, 2, 5), i: int(r, 1, 6), j: pick(r, [1, 1, 2, 3]), m: pick(r, squareFreeUpTo(15)) }), ({ c, i, j, m }) => c * c * j * j * m <= 300 && gcd(i, j) === 1)
    const n = c * c * j * j * m
    const op = add ? '+' : '-'
    const prompt = `Simplify fully $\\dfrac{${c * i} ${op} \\sqrt{${n}}}{${c}}$.`
    const answer = `${i} ${op} ${surdTex(j, m)}`
    const accepted = add ? [`${i}+${surdTyped(j, m)}`, `${surdTyped(j, m)}+${i}`] : [`${i}-${surdTyped(j, m)}`, `-${surdTyped(j, m)}+${i}`]
    // Second route: the root simplified in whole numbers, and the printed fraction as a decimal against each accepted form.
    const want = valueOf(fromTex(mathIn(prompt)))
    return {
      question: {
        type: 'short-text',
        prompt,
        solution: `$\\sqrt{${n}} = ${surdTex(c * j, m)}$, so the numerator is $${c * i} ${op} ${surdTex(c * j, m)} = ${c}(${answer})$. Dividing by ${c} leaves $${answer}$.`,
        markScheme: scheme(slot, [`$\\sqrt{${n}} = ${surdTex(c * j, m)}$`], `$${answer}$`),
        accepted,
      },
      check: valueCheck(accepted, want, (c * j) ** 2 * m === n && largestSquareFactor(m) === 1, `√${n} = ${c * j}√${m}`),
      values: { c, i, j, m, add: String(add) },
    }
  },
}

/** √50/√2 = √25 = 5: written as q16. */
export const dividingSurds: Generator = {
  id: 'dividing-surds',
  subjectId: 'maths',
  topicId: SURDS,
  replaces: ['q16'],
  build(r, slot): Draft {
    const nonSquare = Array.from({ length: 29 }, (_, i) => i + 2).filter((n) => wholeSqrt(n) === undefined)
    const { b, k } = draw(r, (r) => ({ b: pick(r, nonSquare), k: int(r, 2, 10) }), ({ b, k }) => b * k * k <= 800)
    const a = b * k * k
    const quotient = wholeSqrt(a / b)
    return {
      question: {
        type: 'numeric',
        prompt: `Work out $\\dfrac{\\sqrt{${a}}}{\\sqrt{${b}}}$.`,
        solution: `$\\dfrac{\\sqrt{${a}}}{\\sqrt{${b}}} = \\sqrt{${k * k}} = ${k}$.`,
        markScheme: scheme(slot, [], String(k)),
        answer: k,
        tolerance: 0,
      },
      check: { agrees: a % b === 0 && quotient === k, detail: `${a} ÷ ${b} = ${a / b}, root by counting ${quotient}` },
      values: { a, b },
    }
  },
}

/** Every k√m with k²m up to 1000, for the reverse step. */
const SINGLE_ROOTS: [number, number][] = Array.from({ length: 9 }, (_, i) => i + 2).flatMap((k) => SQUARE_FREE.filter((m) => k * k * m <= 1000).map((m) => [k, m] as [number, number]))

/** 3√5 = √45: written as q17. */
export const surdAsASingleRoot: Generator = {
  id: 'surd-as-a-single-root',
  subjectId: 'maths',
  topicId: SURDS,
  replaces: ['q17'],
  build(r: Rng, slot): Draft {
    const [k, m] = pick(r, SINGLE_ROOTS)
    const N = k * k * m
    const accepted = [`√${N}`]
    // Second route: square both sides in whole numbers, (k√m)² = k²m, against the number under the accepted root.
    const read = readSurd(accepted[0]!)
    return {
      question: {
        type: 'short-text',
        prompt: `Write $${surdTex(k, m)}$ as a single square root.`,
        solution: `$${k} = \\sqrt{${k * k}}$, so $${surdTex(k, m)} = \\sqrt{${k * k}} \\times \\sqrt{${m}} = \\sqrt{${N}}$. Simplifying in reverse: put the number back under the root by squaring it.`,
        markScheme: scheme(slot, [], `$\\sqrt{${N}}$`),
        accepted,
      },
      check: { agrees: !!read && read.k === 1 && read.m === N && close(Math.sqrt(read.m), k * Math.sqrt(m)), detail: `(${k}√${m})² = ${k * k * m}` },
      values: { k, m },
    }
  },
}

/** Every generator in this file. */
export const surdsGenerators: Generator[] = [
  multiplyingSurds,
  simplifyingASurd,
  addingSurds,
  rationalisingASurd,
  expandingSurdBrackets,
  squaringASurd,
  rationalisingWithAConjugate,
  surdRectangleArea,
  simplifyingBeforeDividing,
  simplifyingASurdFraction,
  dividingSurds,
  surdAsASingleRoot,
]
