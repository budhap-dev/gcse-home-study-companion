import { show } from '../format.ts'
import { draw, int, pick } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'

const LAWS = 'laws-of-indices'
const ROOTS = 'powers-and-roots'

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))

/** b × b × … × b, n times, by repeated multiplication. */
function power(b: number, n: number): number {
  let out = 1
  for (let k = 0; k < n; k++) out *= b
  return out
}

/** The whole-number nth root of x found by counting up, or undefined when x is not a perfect nth power. */
export function wholeRoot(x: number, n: number): number | undefined {
  for (let k = 0; power(k, n) <= x; k++) if (power(k, n) === x) return k
  return undefined
}

/** Decimal places a terminating decimal needs. */
function places(x: number): number {
  let k = 0
  while (Math.abs(x * 10 ** k - Math.round(x * 10 ** k)) > 1e-9 && k < 15) k++
  return k
}

const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b))
const root = (x: number | string, n: number) => (n === 2 ? `\\sqrt{${x}}` : `\\sqrt[${n}]{${x}}`)
const VERBS = ['Evaluate', 'Work out', 'Find the value of']

/** Every b^n a student is asked to evaluate: up to 10 000, bases to 20, longer powers only for small bases. */
const POWERS: [number, number][] = []
for (let b = 2; b <= 20; b++) {
  const top = b === 2 ? 10 : b === 3 ? 7 : b <= 10 ? 5 : 3
  for (let n = 2; n <= top; n++) if (power(b, n) <= 10000) POWERS.push([b, n])
}

/** 2^6 = 64: written as q1. */
export const evaluateAPower: Generator = {
  id: 'evaluate-a-power',
  subjectId: 'maths',
  topicId: LAWS,
  replaces: ['q1'],
  build(r, slot) {
    const [b, n] = pick(r, POWERS)
    const answer = b ** n
    // Second route: divide back down by the base n times and land on exactly 1.
    let back = answer
    for (let k = 0; k < n; k++) back /= b
    return {
      question: {
        type: 'numeric',
        prompt: `${pick(r, VERBS)} $${b}^{${n}}$.`,
        solution: `$${b}^{${n}} = ${Array(n).fill(b).join(' \\times ')} = ${answer}$.`,
        markScheme: scheme(slot, [], String(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: back === 1 && answer === power(b, n), detail: `${answer} divided by ${b} ${n} times: ${back}` },
      values: { b, n },
    }
  },
}

const DIVIDE_BASES: { b: number; most: number }[] = [
  { b: 10, most: 6 },
  { b: 2, most: 10 },
  { b: 3, most: 6 },
  { b: 5, most: 5 },
]

/** 10^7 ÷ 10^4 = 1000: written as q3. Subtract the indices, then evaluate. */
export const dividingPowers: Generator = {
  id: 'dividing-powers',
  subjectId: 'maths',
  topicId: LAWS,
  replaces: ['q3'],
  build(r, slot) {
    const { b, most } = pick(r, DIVIDE_BASES)
    const k = int(r, b === 10 ? 1 : 2, most)
    const n = int(r, 2, 9)
    const m = k + n
    const answer = power(b, k)
    // Second route: evaluate both powers in full and divide.
    const direct = b ** m / b ** n
    return {
      question: {
        type: 'numeric',
        prompt: `Work out $${b}^{${m}} \\div ${b}^{${n}}$.`,
        solution: `Subtract the indices: $${b}^{${m}-${n}} = ${b}^{${k}} = ${answer}$.`,
        markScheme: scheme(slot, [], String(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: direct === answer, detail: `${b ** m} ÷ ${b ** n} = ${direct}` },
      values: { b, m, n },
    }
  },
}

/** Bases made of 2s and 5s only, so every reciprocal is a terminating decimal. */
const TWOS_AND_FIVES = [2, 4, 5, 8, 10, 16, 20, 25, 32, 40, 50, 64, 80, 100, 125, 200, 250, 500]

/** b^−n with a decimal of at most six places: 4^−2 = 0.0625. A power of 1 only for bases of 8 and more. */
const RECIPROCALS: [number, number][] = TWOS_AND_FIVES.flatMap((b) =>
  [1, 2, 3, 4, 5, 6].filter((n) => power(b, n) <= 10000 && (n >= 2 || b >= 8) && places(1 / power(b, n)) <= 6).map((n) => [b, n] as [number, number]),
)

/** 4^−2 = 0.0625: written as q4. */
export const negativeIndex: Generator = {
  id: 'negative-index',
  subjectId: 'maths',
  topicId: LAWS,
  replaces: ['q4'],
  build(r, slot) {
    const [b, n] = pick(r, RECIPROCALS)
    const whole = power(b, n)
    const answer = Number(show(1 / whole))
    const dp = places(answer)
    const expr = `${b}^{-${n}}`
    const prompt = r() < 0.25 ? `Write $${expr}$ as a decimal.` : `${pick(r, VERBS)} $${expr}$. Give your answer as a decimal.`
    const powerStep = n === 1 ? '' : ` = \\dfrac{1}{${whole}}`
    // Second route: the decimal's digits times b^n must make an exact power of ten.
    const digits = Math.round(answer * 10 ** dp)
    return {
      question: {
        type: 'numeric',
        prompt,
        solution: `A negative index means a reciprocal: $${expr} = \\dfrac{1}{${b}${n === 1 ? '' : `^${n}`}}${powerStep} = ${show(answer)}$.`,
        markScheme: scheme(slot, [], `${show(answer)} or $\\frac{1}{${whole}}$`),
        answer,
        tolerance: 0,
      },
      check: { agrees: digits * whole === 10 ** dp, detail: `${digits} × ${whole} = ${digits * whole}, against 10^${dp}` },
      values: { b, n },
    }
  },
}

interface Fractional {
  /** The number raised to the power. */
  base: number
  /** Its nth root. */
  r: number
  m: number
  n: number
}

/** x^(m/n) with x a perfect nth power, the root r, and r^m no more than `most`. */
function fractionals(roots: number[], ns: number[], ms: number[], ok: (f: Fractional) => boolean): Fractional[] {
  return roots.flatMap((r) => ns.flatMap((n) => ms.filter((m) => gcd(m, n) === 1).map((m) => ({ base: power(r, n), r, m, n })))).filter(ok)
}

const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
/** 8^(1/3): a root, up to 25² and 12³. */
const UNIT = fractionals(range(2, 25), [2, 3, 4, 5, 6], [1], ({ base, n }) => base <= (n === 2 ? 625 : n === 3 ? 1728 : 1296))
/** 25^(3/2): a root then a power, the answer at most 10 000. */
const POWER = fractionals(range(2, 21), [2, 3, 4, 5], [2, 3, 4, 5], ({ base, r, m }) => m >= 2 && power(r, m) <= 10000 && base <= 10000)
/** 32^(−2/5): root, power, reciprocal; a terminating decimal of at most six places. */
const NEGATIVE = fractionals([2, 4, 5, 8, 10, 16, 20, 25, 40, 50, 100], [2, 3, 4, 5, 6], [1, 2, 3, 4], ({ base, r, m }) => base <= 100000 && power(r, m) <= 10000 && places(1 / power(r, m)) <= 6)

interface FractionBase {
  p: number
  q: number
  n: number
  m: number
}
/** (8/27)^(−2/3) = (3/2)² = 2.25: the top's root made of 2s and 5s, so the answer terminates. */
const FRACTION_BASES: FractionBase[] = [2, 4, 5, 8, 10].flatMap((p) =>
  range(2, 12).flatMap((q) =>
    ([[2, 3], [3, 2]] as const)
      .map(([n, m]) => ({ p, q, n, m }))
      .filter(({ p, q, n, m }) => {
        const answer = power(q, m) / power(p, m)
        return gcd(p, q) === 1 && power(p, n) <= 1000 && power(q, n) <= 1000 && answer <= 60 && answer >= 0.01 && places(answer) <= 6
      }),
  ),
)

const frac = (m: number, n: number, negative = false) => `${negative ? '-' : ''}\\frac{${m}}{${n}}`
const POWER_WORD: Record<number, string> = { 2: 'Square', 3: 'Cube', 4: 'Raise to the power 4', 5: 'Raise to the power 5' }

/**
 * Fractional indices: written as q5 (8^(1/3), 1 mark), q7 (25^(3/2), 2 marks), q9
 * (32^(−2/5), grade 8-9) and q15 ((8/27)^(−2/3), 3 marks, grade 8-9). Each slot keeps its own
 * step: a root; a root then a power; a root, power and reciprocal; and a fraction flipped
 * before the root and power.
 */
export const fractionalIndices: Generator = {
  id: 'fractional-indices',
  subjectId: 'maths',
  topicId: LAWS,
  replaces: ['q5', 'q7', 'q9', 'q15'],
  build(r, slot): Draft {
    const verb = pick(r, VERBS)
    if (slot.id === 'q15') {
      const { p, q, n, m } = pick(r, FRACTION_BASES)
      const P = power(p, n)
      const Q = power(q, n)
      const top = power(q, m)
      const bottom = power(p, m)
      const answer = Number(show(top / bottom))
      const rootWord = n === 2 ? 'Square roots' : 'Cube roots'
      // Second route: the power taken in floating point, straight from the question.
      const direct = (P / Q) ** (-m / n)
      return {
        question: {
          type: 'numeric',
          prompt: `${verb} $\\left(\\dfrac{${P}}{${Q}}\\right)^{${frac(m, n, true)}}$. Give your answer as a decimal or a fraction.`,
          solution: `Flip for the negative index: $\\left(\\tfrac{${Q}}{${P}}\\right)^{${frac(m, n)}}$. ${rootWord}: $\\tfrac{${q}}{${p}}$. ${POWER_WORD[m]}: $\\tfrac{${top}}{${bottom}} = ${show(answer)}$.`,
          markScheme: scheme(slot, ['Fraction inverted for the negative index', `$${root(Q, n)} = ${q}$ and $${root(P, n)} = ${p}$`], `$\\frac{${top}}{${bottom}}$ or ${show(answer)}`),
          answer,
          tolerance: 0,
        },
        check: { agrees: near(direct, answer) && wholeRoot(P, n) === p && wholeRoot(Q, n) === q, detail: `(${P}/${Q})^(−${m}/${n}) = ${direct}` },
        values: { kind: 'fraction base', P, Q, m, n },
      }
    }
    if (slot.id === 'q9') {
      // A power of 1 a third of the time: there are too few with a larger power to vary the question enough.
      const pool = r() < 0.67 ? NEGATIVE.filter((f) => f.m >= 2) : NEGATIVE.filter((f) => f.m === 1)
      const { base, r: rt, m, n } = pick(r, pool)
      const whole = power(rt, m)
      const answer = Number(show(1 / whole))
      const direct = base ** (-m / n)
      const steps = m === 1
        ? `Root, then reciprocal: $${root(base, n)} = ${rt}$, and the negative index gives $\\dfrac{1}{${rt}} = ${show(answer)}$.`
        : `Root, power, then reciprocal: $${root(base, n)} = ${rt}$, $${rt}^${m} = ${whole}$, and the negative index gives $\\dfrac{1}{${whole}} = ${show(answer)}$.`
      return {
        question: {
          type: 'numeric',
          prompt: `${verb} $${base}^{${frac(m, n, true)}}$. Give your answer as a fraction or a decimal.`,
          solution: steps,
          markScheme: scheme(slot, [`$${root(base, n)} = ${rt}$${m === 1 ? '' : ` or $${base}^{${frac(m, n)}} = ${whole}$`} seen`], `$\\frac{1}{${whole}}$ or ${show(answer)}`),
          answer,
          tolerance: 0,
        },
        check: { agrees: near(direct, answer) && wholeRoot(base, n) === rt, detail: `${base}^(−${m}/${n}) = ${direct}` },
        values: { kind: 'negative', base, m, n },
      }
    }
    if (slot.id === 'q7') {
      const { base, r: rt, m, n } = pick(r, POWER)
      const answer = power(rt, m)
      const direct = base ** (m / n)
      return {
        question: {
          type: 'numeric',
          prompt: `${verb} $${base}^{${frac(m, n)}}$.`,
          solution: `Take the root first, then the power: $${base}^{${frac(m, n)}} = (${root(base, n)})^${m} = ${rt}^${m} = ${answer}$.`,
          markScheme: scheme(slot, [`$${root(base, n)} = ${rt}$ or $${rt}^${m}$ seen`], String(answer)),
          answer,
          tolerance: 0,
        },
        check: { agrees: Math.abs(direct - answer) < 1e-6 && wholeRoot(base, n) === rt, detail: `${base}^(${m}/${n}) = ${direct}` },
        values: { kind: 'root then power', base, m, n },
      }
    }
    const { base, r: rt, n } = pick(r, UNIT)
    const direct = base ** (1 / n)
    return {
      question: {
        type: 'numeric',
        prompt: `${verb} $${base}^{${frac(1, n)}}$.`,
        solution: `A unit fraction index is a root: $${base}^{${frac(1, n)}} = ${root(base, n)} = ${rt}$.`,
        markScheme: scheme(slot, [], String(rt)),
        answer: rt,
        tolerance: 0,
      },
      check: { agrees: Math.abs(direct - rt) < 1e-9 && power(rt, n) === base, detail: `${base}^(1/${n}) = ${direct}; ${rt}^${n} = ${power(rt, n)}` },
      values: { kind: 'root', base, n },
    }
  },
}

/** px + q as it is printed: 2x - 3, x, -x + 4, 3. `minus` is the sign to print. */
export function linear(p: number, q: number, minus = '-'): string {
  const x = p === 0 ? '' : p === 1 ? 'x' : p === -1 ? `${minus}x` : `${p < 0 ? minus : ''}${Math.abs(p)}x`
  if (q === 0) return x || '0'
  if (!x) return `${q < 0 ? minus : ''}${Math.abs(q)}`
  return `${x} ${q < 0 ? minus : '+'} ${Math.abs(q)}`
}

const COMMON_BASES: { c: number; most: number }[] = [
  { c: 2, most: 5 },
  { c: 3, most: 4 },
  { c: 5, most: 3 },
]

/** 8^x = 4^(x+1), so x = 2: written as q10. Both bases powers of one number, a whole-number answer. */
export const equationsWithIndices: Generator = {
  id: 'equations-with-indices',
  subjectId: 'maths',
  topicId: LAWS,
  replaces: ['q10'],
  build(r, slot) {
    const { c, most } = pick(r, COMMON_BASES)
    const v = draw(
      r,
      (r) => ({ u: int(r, 1, most), w: int(r, 1, most), p: int(r, 1, 3), q: int(r, -4, 4), s: int(r, 1, 3), t: int(r, -4, 4) }),
      ({ u, w, p, q, s, t }) => {
        const coef = u * p - w * s
        const rhs = w * t - u * q
        if (u === w || coef === 0 || rhs % coef !== 0 || (p === s && q === t)) return false
        const x = rhs / coef
        return x !== 0 && Math.abs(x) <= 8 && Math.abs(p * x + q) <= 12 && Math.abs(s * x + t) <= 12 && (q !== 0 || t !== 0)
      },
    )
    const { u, w, p, q, s, t } = v
    const a = power(c, u)
    const b = power(c, w)
    const coef = u * p - w * s
    const rhs = w * t - u * q
    const x = rhs / coef
    const as = (k: number, base: number, P: number, Q: number) => (k === 1 ? `$${base}^{${linear(P, Q)}}$ is already a power of ${c}` : `$${base}^{${linear(P, Q)}} = ${c}^{${linear(k * P, k * Q)}}$`)
    const equation = `${linear(u * p, u * q)} = ${linear(w * s, w * t)}`
    const collect = coef === 1 ? ',' : `. Collecting terms, $${linear(coef, 0)} = ${rhs}$,`
    // Second route: put x back in and work out both sides as numbers.
    const left = a ** (p * x + q)
    const right = b ** (s * x + t)
    return {
      question: {
        type: 'numeric',
        prompt: `Solve $${a}^{${linear(p, q)}} = ${b}^{${linear(s, t)}}$.`,
        solution: `Write both sides as powers of ${c}: ${as(u, a, p, q)} and ${as(w, b, s, t)}. Equal bases mean equal indices, so $${equation}$${collect} giving $x = ${x}$.`,
        markScheme: scheme(slot, [`Both sides written as powers of ${c}`, `$${equation}$`], `$x = ${x}$`),
        answer: x,
        tolerance: 0,
      },
      check: { agrees: Number.isInteger(x) && near(left, right), detail: `x = ${x}: left ${left}, right ${right}` },
      values: { c, a, b, p, q, s, t },
    }
  },
}

/** 2^a × 4^b = 2^10 and a = 2b, so b = 2.5: written as q14. */
export const powersOfACommonBase: Generator = {
  id: 'powers-of-a-common-base',
  subjectId: 'maths',
  topicId: LAWS,
  replaces: ['q14'],
  build(r, slot) {
    const c = pick(r, [2, 3, 5])
    const k = pick(r, [2, 3])
    const multiple = r() < 0.6
    const { m, N } = draw(
      r,
      (r) => ({ m: int(r, multiple ? 2 : 1, multiple ? 4 : 6), N: int(r, 5, 24) }),
      ({ m, N }) => {
        const b = multiple ? N / (m + k) : (N - m) / (1 + k)
        return b > 0 && places(b) <= 1
      },
    )
    const ck = power(c, k)
    const b = Number(show(multiple ? N / (m + k) : (N - m) / (1 + k)))
    const a = Number(show(multiple ? m * b : b + m))
    const relation = multiple ? `a = ${m}b` : `a = b + ${m}`
    const substituted = multiple ? `${m + k}b = ${N}` : `${1 + k}b + ${m} = ${N}`
    const finish = multiple ? '' : `, so $${1 + k}b = ${N - m}$`
    // Second route: put a and b back into the powers and compare with c^N.
    const lhs = c ** a * ck ** b
    const rhsValue = c ** N
    return {
      question: {
        type: 'numeric',
        prompt: `$${c}^a \\times ${ck}^b = ${c}^{${N}}$ and $${relation}$. Find the value of $b$.`,
        solution: `$${ck}^b = ${c}^{${k}b}$, so $${c}^{a + ${k}b} = ${c}^{${N}}$ and $a + ${k}b = ${N}$. Substituting $${relation}$: $${substituted}$${finish}, so $b = ${show(b)}$.`,
        markScheme: scheme(slot, [`$a + ${k}b = ${N}$`, `$${substituted}$`], `$b = ${show(b)}$`),
        answer: b,
        tolerance: 0,
      },
      check: { agrees: near(lhs / rhsValue, 1), detail: `a = ${a}, b = ${b}: ${c}^a × ${ck}^b = ${lhs}; ${c}^${N} = ${rhsValue}` },
      values: { c, k, relation, N },
    }
  },
}

/** Each square with the areas it can have: a patio is not 400 m², nor a tile 30 cm². */
const SQUARES: { area: [number, number]; unit: string; text: (a: number, u: string, ask: string) => string }[] = [
  { area: [20, 400], unit: 'cm', text: (a, u, ask) => `A square has an area of $${a}$ ${u}². Its side length lies between two consecutive whole numbers of centimetres. Write down the ${ask} one.` },
  { area: [100, 900], unit: 'cm', text: (a, u, ask) => `A square floor tile has an area of $${a}$ ${u}². The length of its side lies between two consecutive whole numbers of centimetres. Write down the ${ask} one.` },
  { area: [10, 80], unit: 'm', text: (a, u, ask) => `A square patio has an area of $${a}$ ${u}². The length of each side lies between two consecutive whole numbers of metres. Write down the ${ask} one.` },
  { area: [150, 900], unit: 'm', text: (a, u, ask) => `A square field has an area of $${a}$ ${u}². The length of each side lies between two consecutive whole numbers of metres. Write down the ${ask} one.` },
]

/**
 * A square root between consecutive whole numbers: written as q11 (√150, the smaller one,
 * 2 marks) and q16 (a square of area 90 cm², the larger one, 3 marks). q11 is the bare root
 * and q16 the area; on one sheet the two ask for opposite ends, as written.
 */
export const rootBetweenWholeNumbers: Generator = {
  id: 'root-between-whole-numbers',
  subjectId: 'maths',
  topicId: ROOTS,
  replaces: ['q11', 'q16'],
  build(r, slot, turn): Draft {
    const larger = turn % 2 === 1
    const ask = larger ? 'larger' : 'smaller'
    const area = slot.id === 'q16'
    const context = area ? pick(r, SQUARES) : undefined
    const n = draw(r, (r) => int(r, ...(context?.area ?? [20, 400])), (n) => wholeRoot(n, 2) === undefined)
    // The bracketing squares by counting up; the second route is the calculator's square root.
    let low = 1
    while ((low + 1) * (low + 1) <= n) low++
    const high = low + 1
    const answer = larger ? high : low
    const between = `$${low}^2 = ${low * low}$ and $${high}^2 = ${high * high}$`
    const inside = `$${low * low} < ${n} < ${high * high}$`
    if (!context) {
      return {
        question: {
          type: 'numeric',
          prompt: `$\\sqrt{${n}}$ lies between two consecutive whole numbers. Write down the ${ask} one.`,
          solution: `${between}. Since ${inside}, $\\sqrt{${n}}$ lies between $${low}$ and $${high}$, so the ${ask} is $${answer}$.`,
          markScheme: scheme(slot, [`$${low}^2 = ${low * low}$ and $${high}^2 = ${high * high}$ identified`], `$${answer}$`),
          answer,
          tolerance: 0,
        },
        check: { agrees: Math.floor(Math.sqrt(n)) === low && low * low < n && n < high * high, detail: `√${n} = ${Math.sqrt(n)}` },
        values: { ask, n },
      }
    }
    const u = context.unit
    return {
      question: {
        type: 'numeric',
        prompt: context.text(n, u, ask),
        solution: `The side length is $\\sqrt{${n}}$. ${between}, and ${inside}, so the side is between $${low}$ ${u} and $${high}$ ${u}. The ${ask} is $${answer}$.`,
        markScheme: scheme(slot, [`side length recognised as $\\sqrt{${n}}$`, inside], `$${answer}$`),
        answer,
        tolerance: 0,
      },
      check: { agrees: Math.floor(Math.sqrt(n)) === low && low * low < n && n < high * high, detail: `√${n} = ${Math.sqrt(n)}` },
      values: { ask, n, unit: u },
    }
  },
}

interface NegativePower {
  /** The size of the base: 4, or 0.3. */
  a: number
  n: number
}
const DECIMALS = range(1, 9).map((k) => k / 10)
/** (−a)^n: squares to 20, cubes to 10, fourth powers to 6, fifth to 4, and decimals squared or cubed. */
const BRACKETED: NegativePower[] = [
  ...range(2, 20).map((a) => ({ a, n: 2 })),
  ...range(2, 10).map((a) => ({ a, n: 3 })),
  ...range(2, 6).map((a) => ({ a, n: 4 })),
  ...range(2, 4).map((a) => ({ a, n: 5 })),
  ...DECIMALS.flatMap((a) => [{ a, n: 2 }, { a, n: 3 }]),
]
/** −a^n with an even n, where the missing bracket changes the answer: squares to 20, fourth powers to 6, decimals to 2.5 squared. */
const UNBRACKETED: NegativePower[] = [
  ...range(2, 20).map((a) => ({ a, n: 2 })),
  ...range(2, 6).map((a) => ({ a, n: 4 })),
  ...range(1, 25).filter((k) => k % 10 !== 0).map((k) => ({ a: k / 10, n: 2 })),
]
const POWER_NAME: Record<number, string> = { 2: 'squared', 3: 'cubed', 4: 'raised to the power 4', 5: 'raised to the power 5' }
const signed = (a: number) => `(${show(-a)})`

/** Multiplied out a factor at a time, so the sign comes from the multiplying and not from a rule. */
function multiplyOut(x: number, n: number): number {
  let out = 1
  for (let k = 0; k < n; k++) out = Number(show(out * x))
  return out
}

/**
 * Powers of negative numbers: written as q5 ((−4)², with a bracket), q6 (−5², without) and
 * q13 ((−2)⁴ − (−2)³, grade 8-9). The bracket and no-bracket pair sit on one sheet, so each
 * slot keeps its own: q5 always has the bracket and q6 never does.
 */
export const powersOfNegatives: Generator = {
  id: 'powers-of-negatives',
  subjectId: 'maths',
  topicId: ROOTS,
  replaces: ['q5', 'q6', 'q13'],
  build(r, slot): Draft {
    const verb = pick(r, VERBS)
    if (slot.id === 'q13') {
      const same = r() < 0.7
      const { a, b, m, n } = draw(
        r,
        (r) => {
          const a = int(r, 2, 5)
          return { a, b: same ? a : int(r, 2, 5), m: int(r, 2, 5), n: int(r, 2, 5) }
        },
        ({ a, b, m, n }) => m !== n && power(a, m) <= 256 && power(b, n) <= 256 && (same || a !== b) && (m % 2 !== n % 2 || r() < 0.3),
      )
      const plus = r() < 0.35
      const first = power(-a, m)
      const second = power(-b, n)
      const answer = plus ? first + second : first - second
      const describe = (base: number, k: number, value: number) => `${k % 2 === 0 ? 'An even power of a negative is positive' : 'An odd power stays negative'}: $${signed(base)}^${k} = ${value}$`
      const op = plus ? '+' : '-'
      const combine = second < 0
        ? `${plus ? 'Adding a negative subtracts' : 'Subtracting a negative adds'}: $${first} ${op} (${second}) = ${answer}$.`
        : `Then $${first} ${op} ${second} = ${answer}$.`
      // Second route: the signs multiplied out a factor at a time.
      const byMultiplying = plus ? multiplyOut(-a, m) + multiplyOut(-b, n) : multiplyOut(-a, m) - multiplyOut(-b, n)
      return {
        question: {
          type: 'numeric',
          prompt: `${verb} $${signed(a)}^${m} ${op} ${signed(b)}^${n}$.`,
          solution: `${describe(a, m, first)}. ${describe(b, n, second)}. ${combine}`,
          markScheme: scheme(slot, [`$${signed(a)}^${m} = ${first}$`, `$${signed(b)}^${n} = ${second}$`], `$${answer}$`),
          answer,
          tolerance: 0,
        },
        check: { agrees: byMultiplying === answer, detail: `multiplied out: ${byMultiplying}` },
        values: { kind: 'two powers', a, m, b, n, op },
      }
    }
    const bracket = slot.id === 'q5'
    const { a, n } = pick(r, bracket ? BRACKETED : UNBRACKETED)
    const size = Number(show(a ** n))
    const as = show(a)
    if (bracket) {
      const answer = n % 2 === 0 ? size : -size
      const factors = Array(n).fill(signed(a)).join(' \\times ')
      const why = n % 2 === 0 ? 'A negative times a negative is positive.' : 'An odd number of negatives multiplied together is negative.'
      return {
        question: {
          type: 'numeric',
          prompt: `${verb} $${signed(a)}^${n}$.`,
          solution: `The bracket means the whole of $-${as}$ is ${POWER_NAME[n]}: $${factors} = ${show(answer)}$. ${why}`,
          markScheme: scheme(slot, [`$${factors}$`], `$${show(answer)}$`),
          answer,
          tolerance: 0,
        },
        check: { agrees: multiplyOut(-a, n) === answer, detail: `multiplied out: ${multiplyOut(-a, n)}` },
        values: { kind: 'bracket', a: as, n },
      }
    }
    const answer = -size
    return {
      question: {
        type: 'numeric',
        prompt: `${verb} $-${as}^${n}$.`,
        solution: `With no bracket, the power is applied first and the minus sign stays outside: $-(${as}^${n}) = ${show(answer)}$. Compare $(-${as})^${n} = ${show(size)}$.`,
        markScheme: scheme(slot, [`${n === 2 ? 'squares' : `raises to the power ${n}`} first, keeping the minus sign outside`], `$${show(answer)}$`),
        answer,
        tolerance: 0,
      },
      check: { agrees: -multiplyOut(a, n) === answer && multiplyOut(-a, n) === size, detail: `−(${as}^${n}) = ${-multiplyOut(a, n)}; (−${as})^${n} = ${multiplyOut(-a, n)}` },
      values: { kind: 'no bracket', a: as, n },
    }
  },
}

/** ∛−125 + √121 = 6: written as q12. A negative cube root and a square root, in either order. */
export const cubeRootAndSquareRoot: Generator = {
  id: 'cube-root-and-square-root',
  subjectId: 'maths',
  topicId: ROOTS,
  replaces: ['q12'],
  build(r, slot) {
    const form = int(r, 0, 3)
    const { a, b } = draw(r, (r) => ({ a: int(r, 2, 6), b: int(r, 2, 15) }), ({ a, b }) => {
      const answer = [-a + b, b - a, b + a, -a - b][form]!
      return answer !== 0 && a !== b
    })
    const cube = -power(a, 3)
    const square = b * b
    const cubeRoot = root(cube, 3)
    const squareRoot = root(square, 2)
    const expr = [`${cubeRoot} + ${squareRoot}`, `${squareRoot} + ${cubeRoot}`, `${squareRoot} - ${cubeRoot}`, `${cubeRoot} - ${squareRoot}`][form]!
    const answer = [-a + b, b - a, b + a, -a - b][form]!
    const sum = [`$-${a} + ${b} = ${answer}$`, `$${b} + (-${a}) = ${answer}$`, `$${b} - (-${a}) = ${b} + ${a} = ${answer}$`, `$-${a} - ${b} = ${answer}$`][form]!
    // Second route: the calculator's roots.
    const direct = [Math.cbrt(cube) + Math.sqrt(square), Math.sqrt(square) + Math.cbrt(cube), Math.sqrt(square) - Math.cbrt(cube), Math.cbrt(cube) - Math.sqrt(square)][form]!
    return {
      question: {
        type: 'numeric',
        prompt: `Work out $${expr}$.`,
        solution: `A cube root of a negative number is negative: $(-${a})^3 = ${cube}$, so $${cubeRoot} = -${a}$. The $\\sqrt{\\ }$ sign means the positive root, so $${squareRoot} = ${b}$. Then ${sum}.`,
        markScheme: scheme(slot, [`$${cubeRoot} = -${a}$`, `$${squareRoot} = ${b}$`], `$${answer}$`),
        answer,
        tolerance: 0,
      },
      check: { agrees: near(direct, answer) && wholeRoot(-cube, 3) === a && wholeRoot(square, 2) === b, detail: `calculator: ${direct}` },
      values: { form, a, b },
    }
  },
}

/** √0.04 = 0.2: written as q14. The root of a decimal with an even number of places. */
export const squareRootOfADecimal: Generator = {
  id: 'square-root-of-a-decimal',
  subjectId: 'maths',
  topicId: ROOTS,
  replaces: ['q14'],
  build(r, slot) {
    // Not k = 1: the slip below would then be the number itself.
    const { k, j } = draw(r, (r) => ({ k: int(r, 2, 25), j: int(r, 1, 2) }), ({ k }) => k % 10 !== 0)
    const N = Number(show((k * k) / 10 ** (2 * j)))
    const answer = Number(show(k / 10 ** j))
    // The slip: the root of the digits with as many places as the number had.
    const slip = Number(show(k / 10 ** (2 * j)))
    // Written out in full: show() gives 1e-8 for a number this small.
    const slipSquared = (slip * slip).toFixed(4 * j).replace(/0+$/, '')
    const direct = Math.sqrt(N)
    return {
      question: {
        type: 'numeric',
        prompt: `${pick(r, VERBS)} $\\sqrt{${show(N)}}$.`,
        solution: `Ask what squares to $${show(N)}$. $${show(answer)} \\times ${show(answer)} = ${show(N)}$, so the answer is $${show(answer)}$.${N < 1 ? ` The common wrong answer is $${show(slip)}$; check it by squaring, since $${show(slip)}^2 = ${slipSquared}$.` : ''}`,
        markScheme: scheme(slot, [`$${show(answer)} \\times ${show(answer)} = ${show(N)}$, or $\\sqrt{\\tfrac{${k * k}}{${10 ** (2 * j)}}}$`], `$${show(answer)}$`),
        answer,
        tolerance: 0,
      },
      check: { agrees: near(direct, answer) && Math.round(answer * 10 ** j) === k && slip !== answer, detail: `√${N} = ${direct}` },
      values: { k, j },
    }
  },
}

const LETTERS = ['n', 'x', 'k', 't']
/** p/q with q made of 2s and 5s so the root terminates: 1/4, 9/5, 7/8. */
const ROOT_FRACTIONS: [number, number][] = [2, 4, 5, 8, 10, 16, 20, 25].flatMap((q) =>
  range(1, 12).filter((p) => p !== q && gcd(p, q) === 1 && places(p / q) <= 4).map((p) => [p, q] as [number, number]),
)

/** n² = 1/16 and n < 0, so n = −0.25: written as q15. */
export const negativeSquareRoot: Generator = {
  id: 'negative-square-root',
  subjectId: 'maths',
  topicId: ROOTS,
  replaces: ['q15'],
  build(r, slot) {
    const [p, q] = pick(r, ROOT_FRACTIONS)
    const v = pick(r, LETTERS)
    const P = p * p
    const Q = q * q
    const answer = -Number(show(p / q))
    const phrasing = pick(r, [
      `$${v}^2 = \\dfrac{${P}}{${Q}}$ and $${v} < 0$. Find the value of $${v}$.`,
      `$${v}^2 = \\dfrac{${P}}{${Q}}$ and $${v}$ is negative. Find the value of $${v}$.`,
      `Given that $${v} < 0$ and $${v}^2 = \\dfrac{${P}}{${Q}}$, find the value of $${v}$.`,
    ])
    // Second route: square the answer back, in whole numbers over Q.
    const back = Math.round(answer * q) ** 2
    return {
      question: {
        type: 'numeric',
        prompt: phrasing,
        solution: `Squaring loses the sign, so there are two numbers whose square is $\\tfrac{${P}}{${Q}}$: $${v} = \\tfrac{${p}}{${q}}$ or $${v} = -\\tfrac{${p}}{${q}}$. The condition $${v} < 0$ picks the negative one: $${v} = ${show(answer)}$.`,
        markScheme: scheme(slot, [`$${v} = \\pm\\dfrac{${p}}{${q}}$`, `negative root chosen because $${v} < 0$`], `$${show(answer)}$`),
        answer,
        tolerance: 0,
      },
      check: { agrees: answer < 0 && back === P && near(answer * answer, P / Q), detail: `(${answer})² = ${answer * answer}; P/Q = ${P / Q}` },
      values: { p, q, letter: v },
    }
  },
}

/** Generators for laws-of-indices and powers-and-roots. */
export const indicesGenerators: Generator[] = [
  evaluateAPower,
  dividingPowers,
  negativeIndex,
  fractionalIndices,
  equationsWithIndices,
  powersOfACommonBase,
  rootBetweenWholeNumbers,
  powersOfNegatives,
  cubeRootAndSquareRoot,
  squareRootOfADecimal,
  negativeSquareRoot,
]

