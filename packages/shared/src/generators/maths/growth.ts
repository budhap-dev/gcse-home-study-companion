import { clearOfHalf, fixed, money, pounds, roundTo, show } from '../format.ts'
import { draw, int, pick, shuffle } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Generator } from '../types.ts'

const TOPIC = 'compound-interest-growth-and-decay'
/** What depreciates, and what it can be worth new, in steps of £100. */
const ITEMS: { name: string; worth: [number, number] }[] = [
  { name: 'car', worth: [40, 300] },
  { name: 'van', worth: [80, 350] },
  { name: 'laptop', worth: [4, 20] },
  { name: 'motorbike', worth: [20, 120] },
  { name: 'boat', worth: [50, 600] },
]

/**
 * Compound growth and decay over whole years: written as q5 and q9 (value of an investment),
 * q6 (the interest earned) and q7 (a car's value after depreciation), all 3 marks. Any of
 * the three kinds can fill any of the slots, and a sheet with three or more has all three.
 */
export const compoundInterest: Generator = {
  id: 'compound-interest',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q5', 'q6', 'q7', 'q9'],
  build(r, slot, turn) {
    const kind = (['value', 'interest', 'depreciation'] as const)[turn % 3]!
    const down = kind === 'depreciation'
    const item = pick(r, ITEMS)
    const { P, rate, n, final } = draw(
      r,
      (r) => {
        const P = down ? int(r, ...item.worth) * 100 : int(r, 2, 40) * 250
        const rate = down ? int(r, 5, 25) : pick(r, [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6])
        const n = down ? int(r, 2, 6) : int(r, 2, 10)
        return { P, rate, n, final: P * (1 + (down ? -rate : rate) / 100) ** n }
      },
      ({ final }) => clearOfHalf(final, 2),
    )
    const m = show(1 + (down ? -rate : rate) / 100)
    const value = fixed(final, 2)
    const interest = fixed(roundTo(final, 2) - P, 2)
    const power = `${P} \\times ${m}^{${n}}`
    let prompt: string, solution: string, method: string[], answer: number
    if (kind === 'depreciation') {
      prompt = `A ${item.name} worth £${P} depreciates by ${rate}% a year. What is its value after ${n} years, in pounds to 2 decimal places?`
      solution = `A fall of ${rate}% a year is a multiplier of ${m}, so $${power} = £${value}$.`
      method = [`multiplier ${m}`, `power ${n}`]
      answer = roundTo(final, 2)
    } else if (kind === 'value') {
      prompt = `£${P} is invested at ${rate}% compound interest for ${n} years. What is the value, in pounds to 2 decimal places?`
      solution = `$${power} = £${value}$.`
      method = [`multiplier ${m}`, `power ${n}`]
      answer = roundTo(final, 2)
    } else {
      prompt = `£${P} is invested at ${rate}% compound interest for ${n} years. How much interest is earned, in pounds to 2 decimal places?`
      solution = `The value is $${power} = £${value}$, so the interest is $${value} - ${P} = £${interest}$.`
      method = [`${P} × ${m}^${n}`, `subtracts ${P}`]
      answer = Number(interest)
    }
    // Second route: a year at a time, adding or taking off the percentage of what is there.
    let v = P
    for (let i = 0; i < n; i++) v += (v * (down ? -rate : rate)) / 100
    const viaYears = kind === 'interest' ? roundTo(roundTo(v, 2) - P, 2) : roundTo(v, 2)
    return {
      question: {
        type: 'numeric',
        prompt,
        solution,
        markScheme: scheme(slot, method, kind === 'interest' ? interest : value),
        answer,
        tolerance: 0.01,
        units: '£',
      },
      check: { agrees: viaYears === answer, detail: `year by year: ${fixed(v, 4)}` },
      values: { kind, P, rate, n },
    }
  },
}

const SALE_ITEMS = ['coat', 'pair of trainers', 'tent', 'sofa', 'bike', 'watch']
const RISE_ITEMS = ['train ticket', 'gym membership', 'concert ticket', 'phone contract', 'bus pass']

/**
 * Original price from a price after a percentage change: written as q13 (a coat at £48 in a
 * 20% sale, 3 marks). A rise as well as a fall, so the student has to decide whether the
 * new price is more or less than 100%.
 */
export const reversePercentage: Generator = {
  id: 'reverse-percentage',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q13'],
  build(r, slot) {
    const rise = r() < 0.4
    const p = rise ? pick(r, [5, 8, 10, 12, 15, 20, 25, 30]) : pick(r, [5, 10, 12, 15, 20, 25, 30, 35, 40])
    const orig = int(r, 8, 400)
    // Whole pounds times a whole percentage is a whole number of pence, so the price is exact.
    const pence = orig * (rise ? 100 + p : 100 - p)
    const price = pence / 100
    const m = show((rise ? 100 + p : 100 - p) / 100)
    const percent = rise ? 100 + p : 100 - p
    const trap = roundTo(price * (rise ? 1 - p / 100 : 1 + p / 100), 2)
    const prompt = rise
      ? `After a ${p}% price rise, a ${pick(r, RISE_ITEMS)} costs ${money(price)}. What was the price before the rise, in pounds?`
      : `A ${pick(r, SALE_ITEMS)} costs ${money(price)} in a ${p}% sale. What was the original price, in pounds?`
    const wrongWay = rise
      ? `Taking ${p}% off ${money(price)} gives ${money(trap)}, which is wrong: the ${p}% was added to the original price, not to the new one.`
      : `Adding ${p}% to ${money(price)} gives ${money(trap)}, which is wrong: the ${p}% was taken off the original price, not the sale price.`
    return {
      question: {
        type: 'numeric',
        prompt,
        solution: `${money(price)} is ${percent}% of the original, so $${pounds(price)} \\div ${m} = £${orig}$. ${wrongWay}`,
        markScheme: scheme(slot, [`identifies ${m}`, 'divides'], String(orig)),
        answer: orig,
        tolerance: 0,
        units: '£',
      },
      // Second route: the student's division, in floating point, against the exact pence.
      check: { agrees: Math.abs(price / Number(m) - orig) < 1e-9 && trap !== orig, detail: `${pounds(price)} ÷ ${m} = ${show(price / Number(m))}` },
      values: { p, orig, direction: rise ? 'rise' : 'fall' },
    }
  },
}

/**
 * The same idea as multiple choice: written as q14 (£120 after a 20% increase, options
 * £100, £96, £144 and £24). Each wrong option is a named slip, built from the numbers.
 */
export const reversePercentageChoice: Generator = {
  id: 'reverse-percentage-choice',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q14'],
  build(r, slot) {
    const rise = r() < 0.5
    const { p, orig } = draw(r, (r) => ({ p: pick(r, [10, 20, 25, 30, 40]), orig: int(r, 4, 60) * 5 }), ({ p, orig }) => rise || p < 40 || orig > 40)
    const price = (orig * (rise ? 100 + p : 100 - p)) / 100
    const m = show((rise ? 100 + p : 100 - p) / 100)
    const percent = rise ? 100 + p : 100 - p
    const slips = [
      { value: price * (rise ? 1 - p / 100 : 1 + p / 100), name: rise ? `took ${p}% off the new price` : `added ${p}% to the new price` },
      { value: price * (rise ? 1 + p / 100 : 1 - p / 100), name: rise ? `added another ${p}%` : `took another ${p}% off` },
      { value: (price * p) / 100, name: `gave ${p}% of the new price, not the original` },
    ].map((s) => ({ ...s, value: roundTo(s.value, 2) }))
    const options = shuffle(r, [{ value: orig, name: null as string | null }, ...slips])
    const distinct = new Set(options.map((o) => o.value)).size === options.length
    return {
      question: {
        type: 'multiple-choice',
        prompt: `A price is ${money(price)} after a ${p}% ${rise ? 'increase' : 'decrease'}. What was it before?`,
        options: options.map((o) => money(o.value)),
        correct: [options.findIndex((o) => o.name === null)],
        mistakes: options.map((o) => o.name),
        solution: `${money(price)} is **${percent}%** of the original, so divide: $${pounds(price)} \\div ${m} = £${orig}$. ${rise ? `Taking ${p}% off` : `Adding ${p}% to`} ${money(price)} gives ${money(slips[0]!.value)}, which is wrong.`,
        markScheme: scheme(slot, [], money(orig)),
      },
      check: { agrees: Math.abs(orig * Number(m) - price) < 1e-9 && distinct && slips.every((s) => s.value > 0), detail: `${money(orig)} × ${m} = ${money(orig * Number(m))}; ${options.length} different options` },
      values: { p, orig, direction: rise ? 'rise' : 'fall' },
    }
  },
}
