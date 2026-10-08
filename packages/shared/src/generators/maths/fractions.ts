import { grouped, show } from '../format.ts'
import { draw, int, pick } from '../random.ts'
import type { Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'

const TOPIC = 'calculating-with-fractions-and-negatives'

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b

/** A number as the mark schemes print it, with a true minus sign: −11, −0.36. */
const txt = (x: number) => (x < 0 ? `−${show(-x)}` : show(x))

/** A fraction in maths, the sign in front: -\dfrac{7}{20}. A whole number prints bare. */
const tex = (n: number, d: number) => (d === 1 ? String(n) : `${n < 0 ? '-' : ''}\\dfrac{${Math.abs(n)}}{${d}}`)

/** A fraction as the mark schemes and answers type it: −7/20 in the scheme, -7/20 typed. */
const slash = (n: number, d: number) => `${n < 0 ? '−' : ''}${Math.abs(n)}/${d}`

/** The forms a typed fraction is accepted in, the printed one first, as the written q12 lists them. */
const typed = (n: number, d: number) => (n < 0 ? [`${n}/${d}`, `(${n})/${d}`] : [`${n}/${d}`])

const reduce = (n: number, d: number): [number, number] => {
  const g = gcd(Math.abs(n), Math.abs(d))
  return d < 0 ? [-n / g, -d / g] : [n / g, d / g]
}

/** Lowest terms by trial division: the second route to what gcd claims. */
export function inLowestTerms(n: number, d: number): boolean {
  for (let k = 2; k <= Math.abs(d); k++) if (n % k === 0 && d % k === 0) return false
  return true
}

/** `\dfrac{10}{24} = \dfrac{5}{12}` when it simplifies, `\dfrac{13}{24}` when it does not. */
function simplified(n: number, d: number): string {
  const [rn, rd] = reduce(n, d)
  return rd === d ? tex(n, d) : `${tex(n, d)} = ${tex(rn, rd)}`
}

interface Mixed {
  w: number
  n: number
  d: number
}
const improper = (m: Mixed) => m.w * m.d + m.n
const mixedTex = (m: Mixed) => `${m.w}\\dfrac{${m.n}}{${m.d}}`
const mixedValue = (m: Mixed) => m.w + m.n / m.d

/** A proper fraction in lowest terms with a denominator from lo to hi. */
function properFraction(r: Rng, lo: number, hi: number): [number, number] {
  return draw(r, (r) => {
    const d = int(r, lo, hi)
    return [int(r, 1, d - 1), d] as [number, number]
  }, ([n, d]) => gcd(n, d) === 1)
}

/**
 * Reads the maths the prompt prints and works it out: numbers, + − × ÷ and brackets, with
 * a minus sign in front of a number. The second route for the negative-number questions:
 * whatever the generator meant, this is what the student is shown.
 */
export function evaluate(expr: string): number {
  const tokens = expr.replace(/\\times/g, '*').replace(/\\div/g, '/').replace(/\\left|\\right/g, '').replace(/\s+/g, '').match(/\d+(?:\.\d+)?|[-+*/()]/g) ?? []
  let i = 0
  const factor = (): number => {
    const t = tokens[i++]
    if (t === '-') return -factor()
    if (t === '(') {
      const v = sum()
      i++
      return v
    }
    return t !== undefined && /\d/.test(t) ? Number(t) : NaN
  }
  const product = (): number => {
    let v = factor()
    while (tokens[i] === '*' || tokens[i] === '/') v = tokens[i++] === '*' ? v * factor() : v / factor()
    return v
  }
  function sum(): number {
    let v = product()
    while (tokens[i] === '+' || tokens[i] === '-') v = tokens[i++] === '+' ? v + product() : v - product()
    return v
  }
  const v = sum()
  return i === tokens.length ? v : NaN
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b))

/** A negative number as a term after an operator: (-6). */
const term = (x: number) => (x < 0 ? `(${x})` : String(x))

/**
 * −8 + 3 − (−6): written as q2. Three numbers, one of them a negative being subtracted,
 * which is the step the mark is for.
 */
export const negativeNumberSums: Generator = {
  id: 'negative-number-sums',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q2'],
  build(r, slot): Draft {
    const form = int(r, 0, 2)
    const { a, b, c } = draw(r, (r) => ({ a: int(r, 2, 15), b: int(r, 2, 12), c: int(r, 2, 12) }), ({ a, b, c }) => {
      const answer = form === 0 ? -a + b + c : form === 1 ? -a - b + c : b + c - a
      return answer !== 0 && a !== b && b !== c && a !== c
    })
    let expr: string, solution: string, answer: number
    if (form === 0) {
      const s = -a + b
      answer = s + c
      expr = `-${a} + ${b} - (-${c})`
      solution = `$-${a} + ${b} = ${s}$, and subtracting a negative adds: $${s} + ${c} = ${answer}$.`
    } else if (form === 1) {
      const s = -a - b
      answer = s + c
      expr = `-${a} - ${b} - (-${c})`
      solution = `$-${a} - ${b} = ${s}$, and subtracting a negative adds: $${s} + ${c} = ${answer}$.`
    } else {
      const s = b + c
      answer = s - a
      expr = `${b} - (-${c}) - ${a}`
      solution = `Subtracting a negative adds: $${b} - (-${c}) = ${b} + ${c} = ${s}$. Then $${s} - ${a} = ${answer}$.`
    }
    const read = evaluate(expr)
    return {
      question: {
        type: 'numeric',
        prompt: `Work out $${expr}$.`,
        solution,
        markScheme: scheme(slot, [`treats −(−${c}) as +${c}`], txt(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: read === answer, detail: `the printed expression read back: ${read}` },
      values: { form, a, b, c },
    }
  },
}

/**
 * (−5) × 4 ÷ (−2): written as q3. Signs on any of the three numbers, at least one negative,
 * and the division always exact.
 */
export const negativeNumberProducts: Generator = {
  id: 'negative-number-products',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q3'],
  build(r, slot): Draft {
    const divideFirst = r() < 0.4
    const { p, q, s } = draw(
      r,
      (r) => {
        const sign = () => (r() < 0.5 ? -1 : 1)
        return { p: sign() * int(r, 2, 12), q: sign() * int(r, 2, 12), s: sign() * int(r, 2, 9) }
      },
      ({ p, q, s }) => (p < 0 || q < 0 || s < 0) && (divideFirst ? p % s === 0 && Math.abs(p) !== Math.abs(s) : (p * q) % s === 0 && Math.abs(q) !== Math.abs(s) && Math.abs(p) !== Math.abs(s)),
    )
    const negatives = [p, q, s].filter((x) => x < 0).length
    const first = divideFirst ? p / s : p * q
    const answer = divideFirst ? first * q : first / s
    const expr = divideFirst ? `${term(p)} \\div ${term(s)} \\times ${term(q)}` : `${term(p)} \\times ${term(q)} \\div ${term(s)}`
    const step1 = divideFirst ? `$${term(p)} \\div ${term(s)} = ${first}$` : `$${term(p)} \\times ${term(q)} = ${first}$`
    const step2 = divideFirst ? `$${term(first)} \\times ${term(q)} = ${answer}$` : `$${first} \\div ${term(s)} = ${answer}$`
    const rule = ['', 'One negative, so negative', 'Two negatives, so positive', 'Three negatives, so negative'][negatives]
    // Second route: the sign from counting negatives, the size from the sizes alone.
    const magnitude = divideFirst ? (Math.abs(p) / Math.abs(s)) * Math.abs(q) : (Math.abs(p) * Math.abs(q)) / Math.abs(s)
    const bySignRule = (negatives % 2 === 0 ? 1 : -1) * magnitude
    const read = evaluate(expr)
    return {
      question: {
        type: 'numeric',
        prompt: `Work out $${expr}$.`,
        solution: `${step1}, and ${step2}. ${rule}: $${answer}$.`,
        markScheme: scheme(slot, [`${txt(first)}, or a correct sign rule`], txt(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: Number.isInteger(answer) && bySignRule === answer && read === answer, detail: `sign rule: ${bySignRule}; printed expression read back: ${read}` },
      values: { p, q, s, order: divideFirst ? 'divide first' : 'multiply first' },
    }
  },
}

/** Each temperature setting with the range it really has: a freezer is not at 5 °C. */
const TEMPERATURES: { start: [number, number]; change: [number, number]; rises: boolean; text: (t: string, c: number) => string; verb: string }[] = [
  { start: [-6, 6], change: [3, 12], rises: false, verb: 'Falling is subtracting', text: (t, c) => `At midnight the temperature is ${t} °C. By 6 am it has fallen by ${c} degrees. What is the temperature at 6 am?` },
  { start: [-10, -1], change: [4, 15], rises: true, verb: 'Rising is adding', text: (t, c) => `At 7 am the temperature in a town is ${t} °C. By 2 pm it has risen by ${c} degrees. What is the temperature at 2 pm?` },
  { start: [-24, -16], change: [3, 12], rises: true, verb: 'Rising is adding', text: (t, c) => `A freezer is kept at ${t} °C. During a power cut its temperature rises by ${c} degrees. What is its temperature now?` },
  { start: [2, 12], change: [8, 20], rises: false, verb: 'Colder is subtracting', text: (t, c) => `At the foot of a mountain the temperature is ${t} °C. At the summit it is ${c} degrees colder. What is the temperature at the summit?` },
  { start: [-5, 4], change: [4, 14], rises: false, verb: 'Dropping is subtracting', text: (t, c) => `At noon the temperature in Oslo is ${t} °C. By midnight it has dropped by ${c} degrees. What is the temperature at midnight?` },
  { start: [-15, -3], change: [5, 18], rises: true, verb: 'Warmer is adding', text: (t, c) => `On a winter morning the temperature in a garden is ${t} °C. In the afternoon it is ${c} degrees warmer. What is the temperature in the afternoon?` },
]

/** −4 °C falling by 7 degrees: written as q5. The number line has to cross zero or stay below it. */
export const temperatureChange: Generator = {
  id: 'temperature-change',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q5'],
  build(r, slot): Draft {
    const context = pick(r, TEMPERATURES)
    const { t, c } = draw(r, (r) => ({ t: int(r, ...context.start), c: int(r, ...context.change) }), ({ t, c }) => {
      const end = context.rises ? t + c : t - c
      return end !== 0 && t !== 0 && (t < 0 || end < 0)
    })
    const answer = context.rises ? t + c : t - c
    // Second route: count along the number line a degree at a time.
    let walked = t
    for (let k = 0; k < c; k++) walked += context.rises ? 1 : -1
    return {
      question: {
        type: 'numeric',
        prompt: context.text(`$${t}$`, c),
        solution: `${context.verb}: $${t} ${context.rises ? '+' : '-'} ${c} = ${answer}$ °C.`,
        markScheme: scheme(slot, [], txt(answer)),
        answer,
        tolerance: 0,
        units: '°C',
      },
      check: { agrees: walked === answer, detail: `counted ${c} degrees ${context.rises ? 'up' : 'down'} from ${t}: ${walked}` },
      values: { t, c, rises: String(context.rises) },
    }
  },
}

/**
 * Adding and subtracting fractions: written as q4 (3/8 + 1/6, core) and q12 (−3/4 + 2/5,
 * higher). Each slot keeps its own kind: q4 two positive fractions with a positive answer,
 * q12 a negative fraction in the sum. Answers stay between −1 and 1, as the written ones do,
 * so "a fraction in its simplest form" is never a mixed number.
 */
export const addingAndSubtractingFractions: Generator = {
  id: 'adding-and-subtracting-fractions',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q4', 'q12'],
  build(r, slot): Draft {
    const negative = slot.id === 'q12'
    const form = negative ? int(r, 0, 2) : int(r, 0, 1)
    const { a, b, c, d } = draw(
      r,
      (r) => {
        const [a, b] = properFraction(r, 2, 12)
        const [c, d] = properFraction(r, 2, 12)
        if (b === 11 || d === 11) return { a: 0, b: 1, c: 0, d: 1 }
        return { a, b, c, d }
      },
      ({ a, b, c, d }) => {
        if (a === 0 || c === 0 || b === d || lcm(b, d) > 40) return false
        const x = a / b
        const y = c / d
        // q4: x + y < 1 or x − y > 0. q12: −x + y, x − y with y bigger, −x − y.
        if (!negative) return form === 0 ? x + y < 1 : x > y
        if (form === 0) return x !== y
        if (form === 1) return y > x
        return x + y < 1
      },
    )
    // Signs of the two fractions as they are combined: [first, second].
    const [s1, s2] = negative ? ([[-1, 1], [1, -1], [-1, -1]] as const)[form]! : ([[1, 1], [1, -1]] as const)[form]!
    const L = lcm(b, d)
    const n1 = (s1 * a * L) / b
    const n2 = (s2 * c * L) / d
    const raw = n1 + n2
    const [n, den] = reduce(raw, L)
    const op = (s: number) => (s < 0 ? '-' : '+')
    const shown = (s: number, x: number, y: number) => `${s < 0 ? '-' : ''}\\dfrac{${x}}{${y}}`
    const expr = `${s1 < 0 ? '-' : ''}\\dfrac{${a}}{${b}} ${op(s2)} \\dfrac{${c}}{${d}}`
    const over = `${shown(s1, Math.abs(n1), L)} ${op(s2)} \\dfrac{${Math.abs(n2)}}{${L}}`
    const lcmNote = `using the LCM of ${b} and ${d}, which is ${L}`
    let why = ''
    // Form 2 has no positive part to compare: both fractions are negative.
    if (negative) why = form === 2 ? ' Both parts are negative, so the answer is negative.' : n < 0 ? ' The negative part is bigger, so the answer is negative.' : ' The positive part is bigger, so the answer is positive.'
    // Second route: cross-multiply over b × d, then cancel by trial division; and the decimal value.
    let cn = s1 * a * d + s2 * c * b
    let cd = b * d
    for (let k = cd; k >= 2; k--) if (cn % k === 0 && cd % k === 0) {
      cn /= k
      cd /= k
    }
    const decimal = s1 * (a / b) + s2 * (c / d)
    return {
      question: {
        type: 'short-text',
        prompt: `Work out $${expr}$. Give your answer as a fraction in its simplest form.`,
        solution: `$${expr} = ${over} = ${simplified(raw, L)}$, ${lcmNote}.${why}`,
        markScheme: scheme(slot, [negative ? `common denominator of ${L}` : `uses a common denominator, such as ${L}${b * d !== L ? ` or ${b * d}` : ''}`], slash(n, den)),
        accepted: typed(n, den),
      },
      check: {
        agrees: cn === n && cd === den && inLowestTerms(n, den) && near(n / den, decimal) && n !== 0 && den > 1,
        detail: `over ${b * d} and cancelled: ${cn}/${cd}; decimal ${decimal}`,
      },
      values: { kind: negative ? 'with a negative' : 'positive', form, a, b, c, d, lcm: L, n, d2: den },
    }
  },
}

/**
 * 2 1/5 − 1 2/3: written as q9. The whole parts differ by one and the second fraction part
 * is the bigger, so splitting into parts needs the minus sign kept: the trap the written
 * question sets. The answer is a proper fraction.
 */
export const subtractingMixedNumbers: Generator = {
  id: 'subtracting-mixed-numbers',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q9'],
  build(r, slot): Draft {
    const { A, B } = draw(
      r,
      (r) => {
        const w = int(r, 1, 4)
        const [a, b] = properFraction(r, 2, 9)
        const [c, d] = properFraction(r, 2, 9)
        return { A: { w: w + 1, n: a, d: b }, B: { w, n: c, d } }
      },
      ({ A, B }) => A.d !== B.d && B.n / B.d > A.n / A.d && lcm(A.d, B.d) <= 45,
    )
    const L = lcm(A.d, B.d)
    const p = improper(A)
    const q = improper(B)
    const raw = (p * L) / A.d - (q * L) / B.d
    const [n, den] = reduce(raw, L)
    // The parts: 1 + (a/b − c/d) = 1 − (c/d − a/b).
    const [gn, gd] = reduce((B.n * L) / B.d - (A.n * L) / A.d, L)
    const viaParts = reduce(gd - gn, gd)
    return {
      question: {
        type: 'short-text',
        prompt: `Work out $${mixedTex(A)}$ $-$ $${mixedTex(B)}$. Give your answer as a fraction in its simplest form.`,
        solution: `Improper first: $\\dfrac{${p}}{${A.d}} - \\dfrac{${q}}{${B.d}} = \\dfrac{${(p * L) / A.d}}{${L}} - \\dfrac{${(q * L) / B.d}}{${L}} = ${simplified(raw, L)}$. Splitting into parts gives $1 + \\left(\\dfrac{${A.n}}{${A.d}} - \\dfrac{${B.n}}{${B.d}}\\right) = 1 - ${tex(gn, gd)}$, the same, as long as the minus sign is kept.`,
        markScheme: scheme(slot, ['improper fractions over a common denominator'], slash(n, den)),
        accepted: typed(n, den),
      },
      check: {
        agrees: viaParts[0] === n && viaParts[1] === den && inLowestTerms(n, den) && near(n / den, mixedValue(A) - mixedValue(B)) && n > 0 && n < den,
        detail: `by parts: 1 − ${gn}/${gd} = ${viaParts[0]}/${viaParts[1]}`,
      },
      values: { A: `${A.w} ${A.n}/${A.d}`, B: `${B.w} ${B.n}/${B.d}`, lcm: L, improperA: p, improperB: q },
    }
  },
}

function mixedNumbers(maxWhole: number, maxDen: number): Mixed[] {
  const out: Mixed[] = []
  for (let w = 1; w <= maxWhole; w++) for (let d = 2; d <= maxDen; d++) for (let n = 1; n < d; n++) if (gcd(n, d) === 1) out.push({ w, n, d })
  return out
}

/** The whole-number answer of a pair: A ÷ B or A × B. */
const wholeAnswer = ([A, B]: [Mixed, Mixed], divide: boolean) =>
  divide ? (improper(A) * B.d) / (A.d * improper(B)) : (improper(A) * improper(B)) / (A.d * B.d)

/** Pairs whose product is a whole number up to 30: 1 7/8 × 2 2/3 = 5. */
const PRODUCTS: [Mixed, Mixed][] = mixedNumbers(4, 9).flatMap((A) =>
  mixedNumbers(4, 9).filter((B) => (improper(A) * improper(B)) % (A.d * B.d) === 0 && (improper(A) * improper(B)) / (A.d * B.d) <= 30).map((B) => [A, B] as [Mixed, Mixed]),
)
/** Pairs whose quotient is a whole number from 2 to 12: 4 1/2 ÷ 1 1/8 = 4. */
const QUOTIENTS: [Mixed, Mixed][] = mixedNumbers(6, 10).flatMap((A) =>
  mixedNumbers(3, 10).filter((B) => {
    const top = improper(A) * B.d
    const bottom = A.d * improper(B)
    return top % bottom === 0 && top / bottom >= 2 && top / bottom <= 12
  }).map((B) => [A, B] as [Mixed, Mixed]),
)

/**
 * Multiplying and dividing mixed numbers: written as q10 (1 7/8 × 2 2/3 = 5) and q11
 * (4 1/2 ÷ 1 1/8 = 4), side by side on the higher sheet. q10 always multiplies and q11
 * always divides, and the answer is a whole number, as in both written questions.
 */
export const multiplyingAndDividingMixedNumbers: Generator = {
  id: 'multiplying-and-dividing-mixed-numbers',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q10', 'q11'],
  build(r, slot): Draft {
    const divide = slot.id === 'q11'
    // The answer first, then a pair that gives it: drawn from the pairs alone, most quotients were 2.
    const pairs = divide ? QUOTIENTS : PRODUCTS
    const value = pick(r, [...new Set(pairs.map((pair) => wholeAnswer(pair, divide)))])
    const [A, B] = pick(r, pairs.filter((pair) => wholeAnswer(pair, divide) === value))
    const p = improper(A)
    const q = improper(B)
    let solution: string, answer: number, agrees: boolean, detail: string
    if (divide) {
      const top = p * B.d
      const bottom = A.d * q
      answer = top / bottom
      solution = `$\\dfrac{${p}}{${A.d}} \\div \\dfrac{${q}}{${B.d}} = \\dfrac{${p}}{${A.d}} \\times \\dfrac{${B.d}}{${q}} = \\dfrac{${top}}{${bottom}} = ${answer}$. Check: $${mixedTex(B)} \\times ${answer} = ${mixedTex(A)}$ ✓.`
      // Second route: multiply back, B × answer = A, in whole numbers, and the decimal quotient.
      agrees = q * answer * A.d === p * B.d && near(mixedValue(A) / mixedValue(B), answer)
      detail = `${q}/${B.d} × ${answer} = ${(q * answer) / B.d}, and A = ${p / A.d}`
    } else {
      const top = p * q
      const bottom = A.d * B.d
      answer = top / bottom
      solution = `Improper fractions first: $${mixedTex(A)} = \\dfrac{${p}}{${A.d}}$ and $${mixedTex(B)} = \\dfrac{${q}}{${B.d}}$. Then $\\dfrac{${p}}{${A.d}} \\times \\dfrac{${q}}{${B.d}} = \\dfrac{${top}}{${bottom}} = ${answer}$. Cancelling before multiplying gives the same with smaller numbers.`
      // Second route: divide the answer by B and get A back, in whole numbers; and the decimals multiplied.
      agrees = answer * B.d * A.d === q * p && near(mixedValue(A) * mixedValue(B), answer)
      detail = `${answer} ÷ ${q}/${B.d} = ${(answer * B.d) / q}; decimals: ${mixedValue(A) * mixedValue(B)}`
    }
    return {
      question: {
        type: 'numeric',
        prompt: `Work out $${mixedTex(A)}$ $${divide ? '\\div' : '\\times'}$ $${mixedTex(B)}$.`,
        solution,
        markScheme: scheme(slot, [divide ? 'keep, change, flip with improper fractions' : 'converts both to improper fractions'], String(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: agrees && Number.isInteger(answer), detail },
      values: { op: divide ? 'divide' : 'multiply', A: `${A.w} ${A.n}/${A.d}`, B: `${B.w} ${B.n}/${B.d}`, improperA: p, improperB: q },
    }
  },
}


/** One significant figure, for an estimate. */
function oneFigure(x: number): number {
  const p = 10 ** Math.floor(Math.log10(Math.abs(x)))
  return Number(show(Math.round(x / p) * p))
}

/** The digits of a whole number with a point put in `places` from the right: 1692, 4 → 0.1692. */
export function placePoint(digits: string, places: number): string {
  const padded = digits.padStart(places + 1, '0')
  const out = places === 0 ? padded : `${padded.slice(0, -places)}.${padded.slice(-places)}`
  return out.includes('.') ? out.replace(/0+$/, '').replace(/\.$/, '') : out
}

const twoDigit = (r: Rng) => draw(r, (r) => int(r, 12, 99), (x) => x % 10 !== 0 && x % 11 !== 0)

/**
 * Using a product you are given: written as q7 (47 × 36 = 1692, so 4.7 × 0.036; 2 marks)
 * and q19 (23 × 47 = 1081, so 10.81 ÷ 0.023; 3 marks, grade 8-9). q7 always multiplies and
 * q19 always divides, as written.
 */
export const usingAGivenProduct: Generator = {
  id: 'using-a-given-product',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q7', 'q19'],
  build(r, slot): Draft {
    const { a, b } = draw(r, (r) => ({ a: twoDigit(r), b: twoDigit(r) }), ({ a, b }) => a !== b && (a * b) % 10 !== 0)
    const P = a * b
    const given = `You are told that $${a} \\times ${b} = ${P}$.`
    if (slot.id === 'q19') {
      // Dividend P ÷ 10^i, divisor a ÷ 10^j (or b), answer the other factor × 10^(j − i).
      const byFirst = r() < 0.5
      const [divisorDigits, other] = byFirst ? [a, b] : [b, a]
      const { i, j } = draw(r, (r) => ({ i: int(r, 0, 3), j: int(r, 1, 3) }), ({ i, j }) => i !== j && j - i <= 2 && j - i >= -2 && (i > 0 || j > 0))
      const D = Number(show(P / 10 ** i))
      const dv = Number(show(divisorDigits / 10 ** j))
      const shift = j - i
      const answer = Number(show(other * 10 ** shift))
      const dPart = i === 0 ? `$${D}$ is the product itself` : `$${D} = ${P} \\div ${grouped(10 ** i)}$`
      const vPart = `$${dv} = ${divisorDigits} \\div ${grouped(10 ** j)}$`
      const adjust = shift > 0 ? `\\times ${grouped(10 ** shift)}` : `\\div ${grouped(10 ** -shift)}`
      // An estimate that is not a round number is rounded again: 500 ÷ 0.7 ≈ 700, not 714.2857….
      const rough = oneFigure(D) / oneFigure(dv)
      const est = oneFigure(rough)
      const estSign = near(rough, est) ? '=' : '\\approx'
      const read = D / dv
      return {
        question: {
          type: 'numeric',
          prompt: `${given} Work out $${D} \\div ${dv}$.`,
          solution: `${dPart} and ${vPart}. So $${D} \\div ${dv} = (${P} \\div ${divisorDigits}) ${adjust} = ${other} ${adjust} = ${show(answer)}$. Estimate: $${show(oneFigure(D))} \\div ${show(oneFigure(dv))} ${estSign} ${show(est)}$ ✓.`,
          markScheme: scheme(slot, [`uses ${P} ÷ ${divisorDigits} = ${other}`, 'adjusts by the correct power of 10'], show(answer)),
          answer,
          tolerance: 0,
        },
        // Second route: the division done directly, and the answer multiplied back by the divisor.
        check: { agrees: near(read, answer) && near(answer * dv, D) && est / answer > 0.2 && est / answer < 5, detail: `${D} ÷ ${dv} = ${read}; ${answer} × ${dv} = ${answer * dv}; estimate ${est}` },
        values: { op: 'divide', a, b, i, j, divisor: divisorDigits },
      }
    }
    const { i, j } = draw(r, (r) => ({ i: int(r, 0, 2), j: int(r, 1, 3) }), ({ i, j }) => i + j >= 2 && i + j <= 4)
    const swap = r() < 0.5
    const x = Number(show(a / 10 ** i))
    const y = Number(show(b / 10 ** j))
    const [left, right, dl, dr] = swap ? [y, x, j, i] : [x, y, i, j]
    const k = i + j
    const answer = Number(show(P / 10 ** k))
    const est = Number(show(oneFigure(left) * oneFigure(right)))
    // Second route: the point placed in the digits of the product as text, and the decimals multiplied.
    const placed = placePoint(String(P), k)
    return {
      question: {
        type: 'numeric',
        prompt: `${given} Work out $${left} \\times ${right}$.`,
        solution: `$${left} \\times ${right}$ has $${dl} + ${dr} = ${k}$ decimal places, so it is $${P}$ with ${k} decimal places: $${show(answer)}$. Estimate: $${show(oneFigure(left))} \\times ${show(oneFigure(right))} = ${show(est)}$ ✓.`,
        markScheme: scheme(slot, [`counts ${k} decimal places, or scales ${P} by ${grouped(10 ** k)}`], show(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: placed === show(answer) && near(left * right, answer) && est / answer > 0.2 && est / answer < 5, detail: `point placed in ${P}: ${placed}; ${left} × ${right} = ${left * right}` },
      values: { op: 'multiply', a, b, i, j },
    }
  },
}

/** 7.2 ÷ 0.03 = 240: written as q8. Divisor between 0 and 1, whole-number answer. */
export const dividingByADecimal: Generator = {
  id: 'dividing-by-a-decimal',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q8'],
  build(r, slot): Draft {
    const { k, j, N } = draw(
      r,
      (r) => ({ k: pick(r, [2, 3, 4, 5, 6, 7, 8, 9, 12, 15, 25]), j: int(r, 1, 2), N: int(r, 12, 900) }),
      ({ k, j, N }) => N * k <= 3000 && N % 100 !== 0 && (N * k) % 10 ** j !== 0 && k < 10 ** j,
    )
    const scale = 10 ** j
    const divisor = Number(show(k / scale))
    const dividend = Number(show((N * k) / scale))
    const expr = `${dividend} \\div ${divisor}`
    // Second route: read the printed division back, and multiply the answer by the divisor in whole numbers.
    const read = evaluate(expr)
    const back = Number(String(dividend).replace('.', '').replace(/^0+/, '')) * 10 ** (j - (String(dividend).split('.')[1]?.length ?? 0))
    return {
      question: {
        type: 'numeric',
        prompt: `Work out $${expr}$.`,
        solution: `Multiply both numbers by ${scale}: $${expr} = ${N * k} \\div ${k} = ${N}$. Dividing a positive number by a number between 0 and 1 makes the answer bigger.`,
        markScheme: scheme(slot, [`scales to ${N * k} ÷ ${k}`], String(N)),
        answer: N,
        tolerance: 0,
      },
      check: { agrees: near(read, N) && back === N * k, detail: `printed division read back: ${read}; ${dividend} × ${scale} = ${back} = ${N} × ${k}` },
      values: { k, j, N },
    }
  },
}

/**
 * −1.2 × 0.3 − (−0.5) = 0.14: written as q14. A product of decimals with at least one
 * negative, then a negative subtracted. Worked in hundredths, so no floating point decides it.
 */
export const decimalsWithNegatives: Generator = {
  id: 'decimals-with-negatives',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q14'],
  build(r, slot): Draft {
    const signs = pick(r, [[-1, 1], [1, -1], [-1, -1]] as const)
    const { x, y, z } = draw(
      r,
      (r) => ({ x: int(r, 2, 25), y: int(r, 1, 9), z: int(r, 1, 9) }),
      ({ x, y, z }) => x % 10 !== 0 && (x * y) % 10 !== 0 && signs[0] * signs[1] * x * y + z * 10 !== 0,
    )
    const p = signs[0] * x
    const q = signs[1] * y
    const productH = p * q // hundredths
    const answerH = productH + z * 10
    const tenths = (t: number) => show(t / 10)
    const pt = tenths(p)
    const qt = q < 0 ? `(${tenths(q)})` : tenths(q)
    const expr = `${pt} \\times ${qt} - (-${tenths(z)})`
    const product = Number(show(productH / 100))
    const answer = Number(show(answerH / 100))
    const read = evaluate(expr)
    return {
      question: {
        type: 'numeric',
        prompt: `Work out $${expr}$.`,
        solution: `$${pt} \\times ${qt} = ${show(product)}$ (${productH < 0 ? 'different signs' : 'same signs, so positive'}; $${x} \\times ${y} = ${x * y}$ with 2 decimal places). Then $${show(product)} - (-${tenths(z)}) = ${show(product)} + ${tenths(z)} = ${show(answer)}$.`,
        markScheme: scheme(slot, [txt(product)], txt(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: near(read, answer), detail: `printed expression read back: ${read}; in hundredths ${answerH}` },
      values: { p: pt, q: tenths(q), z: tenths(z) },
    }
  },
}

/** Fraction arithmetic in whole numbers, kept in lowest terms with a positive denominator. */
type Frac = [number, number]
const fAdd = (a: Frac, b: Frac): Frac => reduce(a[0] * b[1] + b[0] * a[1], a[1] * b[1])
const fSub = (a: Frac, b: Frac): Frac => fAdd(a, [-b[0], b[1]])
const fDiv = (a: Frac, b: Frac): Frac => reduce(a[0] * b[1], a[1] * b[0])
const fromMixed = (m: Mixed): Frac => [improper(m), m.d]

const randomMixed = (r: Rng): Mixed => {
  const [n, d] = properFraction(r, 2, 8)
  return { w: int(r, 1, 3), n, d }
}

/**
 * Multi-step fractions, grade 8-9: written as q15 ((2 1/3 − 3 1/2) ÷ (−1 3/4) = 2/3) and
 * q22 (1 7/8 ÷ (−2 1/4) + 2/3 = −1/6). Each slot keeps its own structure: q15 a bracket of
 * mixed numbers divided by a negative mixed number, q22 a division by a negative mixed number
 * then a fraction added or taken away. Three steps, mixed numbers, negatives and the order
 * of operations, as written; the answer is a proper fraction.
 */
export const multiStepFractions: Generator = {
  id: 'multi-step-fractions',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q15', 'q22'],
  build(r, slot): Draft {
    const neg = (f: Frac) => `\\left(${tex(f[0], f[1])}\\right)`
    const ok = (f: Frac) => f[0] !== 0 && Math.abs(f[0]) < f[1] && f[1] <= 30
    if (slot.id === 'q15') {
      const { A, B, C } = draw(r, (r) => ({ A: randomMixed(r), B: randomMixed(r), C: randomMixed(r) }), ({ A, B, C }) => {
        const bracket = fSub(fromMixed(A), fromMixed(B))
        return A.d !== B.d && bracket[0] !== 0 && bracket[1] <= 24 && ok(fDiv(bracket, [-improper(C), C.d]))
      })
      const L = lcm(A.d, B.d)
      const pa = improper(A)
      const pb = improper(B)
      const rawBracket = (pa * L) / A.d - (pb * L) / B.d
      const bracket = reduce(rawBracket, L)
      const divisor: Frac = [-improper(C), C.d]
      const flipped: Frac = [-C.d, improper(C)]
      const topRaw = bracket[0] * flipped[0]
      const bottomRaw = bracket[1] * flipped[1]
      const answer = reduce(topRaw, bottomRaw)
      const negatives = (bracket[0] < 0 ? 1 : 0) + 1
      const expr = `\\left(${mixedTex(A)} - ${mixedTex(B)}\\right) \\div \\left(-${mixedTex(C)}\\right)`
      const decimal = (mixedValue(A) - mixedValue(B)) / -mixedValue(C)
      return {
        question: {
          type: 'short-text',
          prompt: `Work out $${expr}$. Give your answer as a fraction in its simplest form.`,
          solution: `The bracket: $\\dfrac{${pa}}{${A.d}} - \\dfrac{${pb}}{${B.d}} = \\dfrac{${(pa * L) / A.d}}{${L}} - \\dfrac{${(pb * L) / B.d}}{${L}} = ${simplified(rawBracket, L)}$. Then $${tex(...bracket)} \\div ${neg(divisor)} = ${tex(...bracket)} \\times ${neg(flipped)} = ${simplified(topRaw, bottomRaw)}$. ${negatives === 2 ? 'Two negatives, so positive.' : 'One negative, so negative.'}`,
          markScheme: scheme(slot, [`bracket = ${slash(...bracket)}`, `keep, change, flip with ${slash(...divisor)}`], slash(...answer)),
          accepted: typed(...answer),
        },
        check: { agrees: near(answer[0] / answer[1], decimal) && inLowestTerms(...answer), detail: `decimals: ${decimal}` },
        values: { form: 'bracket then divide', A: `${A.w} ${A.n}/${A.d}`, B: `${B.w} ${B.n}/${B.d}`, C: `-${C.w} ${C.n}/${C.d}`, bracket: slash(...bracket) },
      }
    }
    const plus = r() < 0.5
    const { A, C, f } = draw(r, (r) => ({ A: randomMixed(r), C: randomMixed(r), f: properFraction(r, 2, 9) }), ({ A, C, f }) => {
      const q = fDiv(fromMixed(A), [-improper(C), C.d])
      const res = plus ? fAdd(q, f) : fSub(q, f)
      return q[1] > 1 && q[1] !== f[1] && q[1] <= 12 && ok(res)
    })
    const pa = improper(A)
    const divisor: Frac = [-improper(C), C.d]
    const flipped: Frac = [-C.d, improper(C)]
    const topRaw = pa * flipped[0]
    const bottomRaw = A.d * flipped[1]
    const quotient = reduce(topRaw, bottomRaw)
    const L = lcm(quotient[1], f[1])
    const raw = (quotient[0] * L) / quotient[1] + ((plus ? 1 : -1) * f[0] * L) / f[1]
    const answer = reduce(raw, L)
    const op = plus ? '+' : '-'
    const expr = `${mixedTex(A)} \\div \\left(-${mixedTex(C)}\\right) ${op} \\dfrac{${f[0]}}{${f[1]}}`
    const decimal = mixedValue(A) / -mixedValue(C) + (plus ? 1 : -1) * (f[0] / f[1])
    return {
      question: {
        type: 'short-text',
        prompt: `Work out $${expr}$. Give your answer as a fraction in its simplest form.`,
        solution: `Division first: $\\dfrac{${pa}}{${A.d}} \\div ${neg(divisor)} = \\dfrac{${pa}}{${A.d}} \\times ${neg(flipped)} = ${simplified(topRaw, bottomRaw)}$. Then $${tex(...quotient)} ${op} \\dfrac{${f[0]}}{${f[1]}} = ${tex((quotient[0] * L) / quotient[1], L)} ${op} \\dfrac{${(f[0] * L) / f[1]}}{${L}} = ${simplified(raw, L)}$.`,
        markScheme: scheme(slot, [`divides first: ${slash(...quotient)}`, `common denominator for the ${plus ? 'addition' : 'subtraction'}`], slash(...answer)),
        accepted: typed(...answer),
      },
      check: { agrees: near(answer[0] / answer[1], decimal) && inLowestTerms(...answer), detail: `decimals: ${decimal}` },
      values: { form: plus ? 'divide then add' : 'divide then subtract', A: `${A.w} ${A.n}/${A.d}`, C: `-${C.w} ${C.n}/${C.d}`, f: `${f[0]}/${f[1]}`, quotient: slash(...quotient) },
    }
  },
}

/** Generators for calculating-with-fractions-and-negatives. */
export const fractionsGenerators: Generator[] = [
  negativeNumberSums,
  negativeNumberProducts,
  temperatureChange,
  addingAndSubtractingFractions,
  subtractingMixedNumbers,
  multiplyingAndDividingMixedNumbers,
  usingAGivenProduct,
  dividingByADecimal,
  decimalsWithNegatives,
  multiStepFractions,
]
