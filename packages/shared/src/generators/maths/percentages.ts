import { show } from '../format.ts'
import { draw, int, pick } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Generator } from '../types.ts'

const TOPIC = 'fractions-decimals-and-percentages'

/** Find 12% of 350: written as q7 (2 marks) and q9 (1 mark). */
export const percentageOfAnAmount: Generator = {
  id: 'percentage-of-an-amount',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q7', 'q9'],
  build(r, slot) {
    // p × n a multiple of 10 keeps the answer to one decimal place at most; multiples of 10%
    // and 50 itself are too easy to be worth a question here.
    const { p, n } = draw(r, (r) => ({ p: int(r, 3, 95), n: int(r, 12, 480) }), ({ p, n }) => (p * n) % 10 === 0 && p % 10 !== 0 && p !== 25 && p !== 75)
    const answer = Number(show((p * n) / 100))
    const tens = Math.floor(p / 10)
    const units = p % 10
    const ten = show(n / 10)
    const one = show(n / 100)
    const times = (k: number, v: string) => (k === 1 ? v : `${k} \\times ${v}`)
    const parts = [tens ? times(tens, ten) : '', units ? times(units, one) : ''].filter(Boolean).join(' + ')
    // Second route: 10% and 1% in whole hundredths, so no floating point is involved.
    const viaParts = (tens * n * 10 + units * n) / 100
    const viaDecimal = (p / 100) * n
    return {
      question: {
        type: 'numeric',
        prompt: `Find ${p}% of ${n}.`,
        solution: `$10\\% = ${ten}$ and $1\\% = ${one}$, so $${p}\\% = ${parts} = ${show(answer)}$. Or $${show(p / 100)} \\times ${n} = ${show(answer)}$.`,
        markScheme: scheme(slot, [`uses ${show(p / 100)} × ${n} or builds from 10% and 1%`], show(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: viaParts === answer && Math.abs(viaDecimal - answer) < 1e-9, detail: `10% and 1%: ${show(viaParts)}; decimal multiplier: ${show(viaDecimal)}` },
      values: { p, n },
    }
  },
}

const AS_A_PERCENTAGE = [
  (a: number, b: number) => `A student scores ${a} out of ${b}. What is this as a percentage?`,
  (a: number, b: number) => `${a} of the ${b} seeds in a tray grow. What percentage of the seeds grow?`,
  (a: number, b: number) => `A team wins ${a} of its ${b} matches. What percentage of its matches does it win?`,
  (a: number, b: number) => `${a} of the ${b} people asked in a survey own a dog. What percentage own a dog?`,
]

/** 18 out of 40 as a percentage: written as q8. */
export const asAPercentage: Generator = {
  id: 'as-a-percentage',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q8'],
  build(r, slot) {
    const { b, p } = draw(r, (r) => ({ b: pick(r, [20, 25, 40, 50, 80, 120, 200, 250]), p: int(r, 6, 95) }), ({ b, p }) => (p * b) % 100 === 0 && p !== 50)
    const a = (p * b) / 100
    const decimal = show(p / 100)
    return {
      question: {
        type: 'numeric',
        prompt: pick(r, AS_A_PERCENTAGE)(a, b),
        solution: `$\\frac{${a}}{${b}} = ${decimal}$, which is **${p}%**. Part divided by whole, then times 100.`,
        markScheme: scheme(slot, [`${a} ÷ ${b}`], String(p)),
        answer: p,
        tolerance: 0,
        units: '%',
      },
      // Cross-multiplying in whole numbers: a/b = p/100 exactly when 100a = pb.
      check: { agrees: a * 100 === p * b && Math.abs((a / b) * 100 - p) < 1e-9, detail: `${a} × 100 = ${a * 100}; ${p} × ${b} = ${p * b}` },
      values: { a, b },
    }
  },
}

/** Each context with the sizes it can have: a Year 10 of 24 students reads as wrong. */
const FRACTION_OF: { size: [number, number]; text: (f: string, n: number) => string }[] = [
  { size: [12, 400], text: (f, n) => `Find ${f} of ${n}.` },
  { size: [90, 300], text: (f, n) => `A school has ${n} students in Year 10, and ${f} of them walk to school. How many walk to school?` },
  { size: [30, 400], text: (f, n) => `A farmer has ${n} sheep, and ${f} of them are black. How many black sheep are there?` },
  { size: [12, 80], text: (f, n) => `A bag holds ${n} counters, and ${f} of them are red. How many red counters are there?` },
]

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

/** 3/8 of 96: written as q6. */
export const fractionOfAnAmount: Generator = {
  id: 'fraction-of-an-amount',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q6'],
  build(r, slot) {
    const context = pick(r, FRACTION_OF)
    const [lo, hi] = context.size
    const { a, b, n } = draw(r, (r) => {
      const b = int(r, 3, 12)
      return { a: int(r, 2, b - 1), b, n: b * int(r, Math.ceil(lo / b), Math.floor(hi / b)) }
    }, ({ a, b, n }) => gcd(a, b) === 1 && n >= lo && n <= hi && n / b >= 3)
    const part = n / b
    const answer = part * a
    return {
      question: {
        type: 'numeric',
        prompt: context.text(`$\\frac{${a}}{${b}}$`, n),
        solution: `Divide by the bottom, $${n} \\div ${b} = ${part}$, then multiply by the top, $${part} \\times ${a} = ${answer}$.`,
        markScheme: scheme(slot, [`${n} ÷ ${b} = ${part}`], String(answer)),
        answer,
        tolerance: 0,
      },
      // Multiply first, then divide: the other order a student may use.
      check: { agrees: (n * a) % b === 0 && (n * a) / b === answer, detail: `${n} × ${a} = ${n * a}; ÷ ${b} = ${(n * a) / b}` },
      values: { a, b, n },
    }
  },
}
