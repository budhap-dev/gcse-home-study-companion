import { show } from '../format.ts'
import { draw, int } from '../random.ts'
import type { Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'

const TOPIC = 'standard-form'

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹'
/** 10⁻³ as the written prompts print it. */
const sup = (n: number) => `${n < 0 ? '⁻' : ''}${[...String(Math.abs(n))].map((d) => SUPERSCRIPT[Number(d)]).join('')}`
/** 2.4 × 10⁻³ */
const sf = (a: number, n: number) => `${show(a)} × 10${sup(n)}`
/** The same in maths: 2.4 \times 10^{-3} */
const sfTex = (a: number, n: number) => `${show(a)} \\times 10^{${n}}`
/** 73 000 and 4 500 000, as the pack prints large numbers. */
const grouped = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
/** The same in maths, with thin spaces: 300\,000 */
const groupedTex = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, '\\,')

/**
 * The forms a standard-form answer is accepted in, as the written q1 and q8 list them. The
 * last, the power flattened onto the 10, only for a positive power: 2 x 10-3 reads as a sum.
 */
const typed = (a: number, n: number) => [`${show(a)} x 10^${n}`, `${show(a)} × 10^${n}`, `${show(a)}e${n}`, ...(n > 0 ? [`${show(a)} x 10${n}`] : [])]

/**
 * A number's standard form worked out from the number itself, by counting how far it is
 * from 1: the second route for every generator here, which all build the answer from the
 * front number and the power instead.
 */
export function fromOrdinary(x: number): { a: number; n: number } {
  let n = Math.floor(Math.log10(Math.abs(x)))
  let a = Number((x / 10 ** n).toPrecision(10))
  // log10 can land a hair under a whole number: 1000 gives 2.9999999999999996.
  if (Math.abs(a) >= 10) {
    a = Number((a / 10).toPrecision(10))
    n++
  }
  if (Math.abs(a) < 1) {
    a = Number((a * 10).toPrecision(10))
    n--
  }
  return { a, n }
}

/** A front number with 1 to 3 significant figures, its last figure not 0: 7.3, 4, 6.05. */
function front(r: Rng): number {
  // Mostly two or three figures, as in 73 000; a single figure, as in 8 000, a quarter of the time.
  const figures = r() < 0.25 ? 1 : int(r, 2, 3)
  const digits = draw(r, (r) => int(r, 10 ** (figures - 1), 10 ** figures - 1), (d) => figures === 1 || d % 10 !== 0)
  return Number(show(digits / 10 ** (figures - 1)))
}

const figuresAfterPoint = (a: number) => (show(a).split('.')[1] ?? '').length

/** 73 000 = 7.3 × 10⁴: written as q1. */
export const toStandardForm: Generator = {
  id: 'to-standard-form',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q1'],
  build(r, slot) {
    const a = front(r)
    const n = draw(r, (r) => int(r, 3, 9), (n) => n >= figuresAfterPoint(a))
    const digits = Math.round(a * 10 ** figuresAfterPoint(a))
    const ordinary = String(digits) + '0'.repeat(n - figuresAfterPoint(a))
    const back = fromOrdinary(Number(ordinary))
    return {
      question: {
        type: 'short-text',
        prompt: `Write ${grouped(ordinary)} in standard form.`,
        solution: `The point moves **${n} places left**, so $${sfTex(a, n)}$.`,
        markScheme: scheme(slot, [], typed(a, n)[0]!),
        accepted: typed(a, n),
      },
      check: {
        agrees: back.a === a && back.n === n && Number(`${a}e${n}`) === Number(ordinary) && ordinary.length - 1 === n,
        detail: `${ordinary}: ${ordinary.length} digits, so power ${ordinary.length - 1}; by logarithm ${back.a} × 10^${back.n}`,
      },
      values: { a, n },
    }
  },
}

/** 2.4 × 10⁻³ = 0.0024: written as q2. */
export const toOrdinaryNumber: Generator = {
  id: 'to-ordinary-number',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q2'],
  build(r, slot) {
    const a = front(r)
    const k = int(r, 1, 6)
    const answer = Number(show(a * 10 ** -k))
    // Second route: the digits written out with k − 1 zeros after the point, as text.
    const digits = show(a).replace('.', '')
    const written = `0.${'0'.repeat(k - 1)}${digits}`
    return {
      question: {
        type: 'numeric',
        prompt: `Write ${sf(a, -k)} as an ordinary number.`,
        solution: `The point moves **${k} ${k === 1 ? 'place' : 'places'} left**: $${show(answer)}$. A negative power means a small positive number.`,
        markScheme: scheme(slot, [], show(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: written === show(answer) && fromOrdinary(answer).a === a && fromOrdinary(answer).n === -k, detail: `written out: ${written}` },
      values: { a, k },
    }
  },
}

/** A power for a calculation: mostly positive, sometimes negative, never 0 or 1. */
const somePower = (r: Rng) => (r() < 0.25 ? -int(r, 2, 8) : int(r, 2, 9))
/** A front number for a calculation: a whole number, or one decimal place a third of the time. */
const someFront = (r: Rng) => (r() < 0.33 ? int(r, 11, 95) / 10 : int(r, 2, 9))

/**
 * Multiplying and dividing in standard form: written as q5 ((2 × 10³) × (4 × 10⁵), what is
 * n?), q6 ((6 × 10⁸) ÷ (3 × 10²), what is A?) and q8 ((5 × 10⁶) × (4 × 10⁷) in standard
 * form, which needs the front number put back between 1 and 10). Each slot keeps its own
 * operation and what it asks for; q5 and q6 sometimes need that same step.
 */
export const standardFormCalculations: Generator = {
  id: 'standard-form-calculations',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q5', 'q6', 'q8'],
  build(r, slot): Draft {
    const divide = slot.id === 'q6'
    const { a, b, p, q } = draw(
      r,
      (r) => ({ a: someFront(r), b: someFront(r), p: somePower(r), q: somePower(r) }),
      ({ a, b, p, q }) => {
        const rawPower = divide ? p - q : p + q
        // A raw power from −1 to 1 can end at 10⁰, which reads oddly as an answer: 3.57 × 10⁰.
        if (a === b || Math.abs(rawPower) > 15 || [-1, 0, 1].includes(rawPower)) return false
        if (divide) {
          const raw = a / b
          const A = raw < 1 ? raw * 10 : raw
          return Number.isInteger(a) && figuresAfterPoint(Number(show(A))) <= 2 && p !== q
        }
        const product = Number(show(a * b))
        // q8 always needs the front number brought back under 10, as written.
        return figuresAfterPoint(product) <= 2 && (slot.id !== 'q8' || product >= 10)
      },
    )
    const raw = Number(show(divide ? a / b : a * b))
    const rawPower = divide ? p - q : p + q
    const shift = raw >= 10 ? 1 : raw < 1 ? -1 : 0
    const A = Number(show(raw / 10 ** shift))
    const n = rawPower + shift
    const fronts = `Fronts: $${show(a)} ${divide ? '\\div' : '\\times'} ${show(b)} = ${show(raw)}$.`
    const powers = `Powers: $${divide ? `${p} - ${q < 0 ? `(${q})` : q}` : `${p} + ${q < 0 ? `(${q})` : q}`} = ${rawPower}$.`
    const tidy =
      shift === 0
        ? `So $${sfTex(A, n)}$, and $${show(A)}$ is already between 1 and 10`
        : `That gives $${sfTex(raw, rawPower)}$, but $${show(raw)}$ is not between 1 and 10, so it becomes $${sfTex(A, n)}$`
    const calc = `(${sf(a, p)}) ${divide ? '÷' : '×'} (${sf(b, q)})`
    // Second route: the calculation done on the ordinary numbers, then put into standard form from scratch.
    const ordinary = divide ? (a * 10 ** p) / (b * 10 ** q) : a * 10 ** p * (b * 10 ** q)
    const back = fromOrdinary(ordinary)
    const check = { agrees: back.a === A && back.n === n && A >= 1 && A < 10, detail: `as ordinary numbers: ${ordinary}, which is ${back.a} × 10^${back.n}` }
    const values = { a, b, p, q, op: divide ? 'divide' : 'multiply', asks: slot.id === 'q5' ? 'n' : slot.id === 'q6' ? 'A' : 'standard form' }
    if (slot.id === 'q8') {
      return {
        question: {
          type: 'short-text',
          prompt: r() < 0.5 ? `${calc} written correctly in standard form is what?` : `Work out ${calc}. Give your answer in standard form.`,
          solution: `${fronts} ${powers} ${tidy}.`,
          markScheme: scheme(slot, [], typed(A, n)[0]!),
          accepted: typed(A, n),
        },
        check,
        values,
      }
    }
    const askN = slot.id === 'q5'
    const answer = askN ? n : A
    return {
      question: {
        type: 'numeric',
        prompt: `${calc} = A × 10ⁿ in standard form. What is ${askN ? 'n' : 'A'}?`,
        solution: `${fronts} ${powers} ${tidy}, so $${askN ? 'n' : 'A'} = ${show(answer)}$.`,
        markScheme: scheme(slot, [askN ? 'adds the powers' : 'divides the front numbers'], answer < 0 ? `−${show(-answer)}` : show(answer)),
        answer,
        tolerance: 0,
      },
      check,
      values,
    }
  },
}

/** (3 × 10⁵) + (4 × 10⁴) = 3.4 × 10⁵: written as q13. The powers must be matched before adding. */
export const addingInStandardForm: Generator = {
  id: 'adding-in-standard-form',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q13'],
  build(r, slot) {
    const p = int(r, 3, 8)
    const gap = int(r, 1, 2)
    const { a, b } = draw(
      r,
      (r) => ({ a: r() < 0.3 ? int(r, 11, 89) / 10 : int(r, 1, 8), b: gap === 1 && r() < 0.3 ? int(r, 11, 95) / 10 : int(r, 1, 9) }),
      ({ a, b }) => a + b / 10 ** gap < 10,
    )
    const q = p - gap
    const moved = Number(show(b / 10 ** gap))
    const A = Number(show(a + moved))
    const largerFirst = r() < 0.6
    const big = `(${sf(a, p)})`
    const small = `(${sf(b, q)})`
    // Second route: both as ordinary numbers, added in whole numbers, then divided back down.
    const tenths = (x: number) => Math.round(x * 10)
    const total = tenths(a) * 10 ** p + tenths(b) * 10 ** q
    const ordinary = (x: number, k: number) => groupedTex(String(tenths(x) * 10 ** (k - 1)))
    const viaOrdinary = total / 10 / 10 ** p
    return {
      question: {
        type: 'numeric',
        prompt: `${largerFirst ? `${big} + ${small}` : `${small} + ${big}`} = A × 10${sup(p)}. What is A?`,
        solution: `Make the powers match: $${sfTex(b, q)} = ${show(moved)} \\times 10^{${p}}$. Then $${show(a)} + ${show(moved)} = ${show(A)}$, so the answer is $${sfTex(A, p)}$. Checking as ordinary numbers: $${ordinary(a, p)} + ${ordinary(b, q)} = ${groupedTex(String(total / 10))}$.`,
        markScheme: scheme(slot, ['rewrites one number with a matching power', 'adds the front numbers'], show(A)),
        answer: A,
        tolerance: 0,
      },
      check: { agrees: Math.abs(viaOrdinary - A) < 1e-9 && A < 10 && A >= 1, detail: `${total / 10} ÷ 10^${p} = ${viaOrdinary}` },
      values: { a, b, p, gap, order: largerFirst ? 'larger first' : 'smaller first' },
    }
  },
}

/** Generators for standard-form. */
export const standardFormGenerators: Generator[] = [toStandardForm, toOrdinaryNumber, standardFormCalculations, addingInStandardForm]
