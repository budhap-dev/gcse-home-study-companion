import type { Question } from '../../content/questions.ts'
import { roundTo, show } from '../format.ts'
import { pick, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Check, Draft, Generator } from '../types.ts'

/**
 * Business (Edexcel 1BS0) generators: the printing and the formulae every topic shares.
 *
 * Every Business calculation comes from the specification's quantitative skills (Appendix 2)
 * or its formulae (Appendix 3), which the exam does not give. Appendix 3 lists total costs,
 * revenue, break-even, margin of safety, interest, net cash flow, opening and closing
 * balances, gross and net profit and their margins, and the average rate of return. Profit,
 * percentage change, market share and staff turnover are Appendix 2 skills (revenue, costs
 * and profit; percentages and percentage changes; market data, including market share).
 * Written once so a topic file cannot drift from them; a generator's check must still reach
 * its answer a second way and never call the same formula twice.
 */

type Builder = (r: Rng, slot: Question, turn: number) => Draft

/** One Business generator for several written questions, each routed to its own builder by slot id. */
export function businessBySlot(id: string, topicId: string, builders: Record<string, Builder>): Generator {
  return {
    id,
    subjectId: 'business',
    topicId,
    replaces: Object.keys(builders),
    build(r, slot, turn) {
      const b = builders[slot.id]
      if (!b) throw new Error(`${id} has no builder for ${slot.id}`)
      return b(r, slot, turn)
    },
  }
}

/**
 * How the written question groups thousands. The pack prints both: "£1500" and "£26 000"
 * (a space from five digits) in most topics, "£1,600" and "£24,000" (a comma from four) in
 * most of Theme 2. A generated question keeps its written question's style, whichever it is.
 */
export type Style = 'space' | 'comma'
export const styleOf = (slot: Question): Style => (/\d,\d{3}(?!\d)/.test(`${slot.prompt} ${slot.solution}`) ? 'comma' : 'space')

/** A count in the written question's style: 1500, 24 000, 2 000 000; or 1,500, 24,000. No sign. */
export function num(x: number, style: Style): string {
  const s = show(Math.abs(x))
  const [whole, frac] = s.split('.')
  const groups = style === 'comma' ? Number(whole) >= 1000 : Number(whole) >= 10000
  const w = groups ? whole!.replace(/\B(?=(\d{3})+(?!\d))/g, style === 'comma' ? ',' : ' ') : whole!
  return `${x < 0 ? '-' : ''}${w}${frac ? `.${frac}` : ''}`
}

/**
 * Pounds in the written question's style: £1500, £26 000, £1,600, £4.36. `pence` prints two
 * places on a whole amount as well (£8.00), for the slots whose written question does. A
 * negative amount is -£500, as the written cash-flow questions print it; put it inside
 * maths ($-£2000$) where the written question does.
 */
export function gbp(x: number, style: Style, pence = false): string {
  const v = roundTo(x, 2)
  const size = Math.abs(v)
  const whole = Math.trunc(size)
  const p = Math.round((size - whole) * 100)
  const tail = p || pence ? `.${String(p).padStart(2, '0')}` : ''
  return `${v < 0 ? '-' : ''}£${num(whole, style)}${tail}`
}

/**
 * A figure inside $…$ in the written question's style. Maths mode needs its own separators: a
 * plain comma there reads as punctuation ("24, 000"), so commas become {,}, and spaces become
 * \, (a thin space). Decimals print as they are: 0.045, 1.25.
 */
export function texNum(x: number, style: Style): string {
  return num(x, style).replace(/,/g, '{,}').replace(/ /g, '\\,')
}

/** An amount of money inside $…$, without the £: 17\,100, 1{,}600, 2.70 (pence kept to two places). */
export function texPounds(x: number, style: Style): string {
  return gbp(x, style).replace('£', '').replace(/,/g, '{,}').replace(/ /g, '\\,')
}

/** Pounds inside $…$: £17\,100, £1{,}600, -£500, £8.00 with `pence`. */
export function texGbp(x: number, style: Style, pence = false): string {
  return gbp(x, style, pence).replace(/,/g, '{,}').replace(/ /g, '\\,')
}

/** lo, lo + step, … hi, each cleaned of binary residue (0.1 steps stay 0.3, not 0.30000000000000004). */
export const steps = (lo: number, hi: number, step: number) => Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => Number(show(lo + i * step)))
export const stepped = (r: Rng, lo: number, hi: number, step: number) => pick(r, steps(lo, hi, step))

/** Equal to within rounding residue. */
export const near = (a: number, b: number) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))

/**
 * One of `items`, the key (usually the answer) evenly first and then an item with that key.
 * Picking an item evenly lets the key most items share take most builds: the answer drawn
 * last from a filtered list.
 */
export function byKey<T>(r: Rng, items: readonly T[], key: (t: T) => number | string): T {
  const groups = new Map<number | string, T[]>()
  for (const t of items) groups.set(key(t), [...(groups.get(key(t)) ?? []), t])
  return pick(r, groups.get(pick(r, [...groups.keys()]))!)
}

/**
 * A numeric draft in the written slot's units and tolerance. `line` is the A1 answer as the
 * written mark scheme prints it; left out, it is the answer in the slot's unit (−£500, 15%,
 * 250 units). `tolerance` overrides the slot's only where the generated question rounds
 * where the written one does not.
 */
export function numericDraft(
  slot: Question,
  b: { prompt: string; solution: string; method: string[]; answer: number; line?: string; tolerance?: number },
  check: Check,
  values: Draft['values'],
): Draft {
  if (slot.type !== 'numeric') throw new Error(`${slot.id} is not numeric`)
  const style = styleOf(slot)
  const line = b.line ?? (slot.units === '£' ? minus(gbp(b.answer, style)) : slot.units === '%' ? `${minus(show(b.answer))}%` : `${minus(num(b.answer, style))}${slot.units ? ` ${slot.units}` : ''}`)
  return {
    question: {
      type: 'numeric',
      prompt: b.prompt,
      solution: b.solution,
      markScheme: scheme(slot, b.method, line),
      answer: b.answer,
      tolerance: b.tolerance ?? slot.tolerance ?? 0,
      ...(slot.units ? { units: slot.units } : {}),
    },
    check,
    values,
  }
}

/**
 * Whether the answer can be read off a printed figure: equal to it, or equal to it with the
 * point moved (75 000 against 7.5, 2400 against 24).
 */
export const readsOff = (answer: number, printed: number[]) =>
  printed.some((f) => [0, 1, 2, 3, 4, 5, 6].some((k) => Math.abs(f / 10 ** k - answer) < 1e-9))

/** A power of ten, which makes a division trivial (a market of £1 000 000). */
export const powerOfTen = (x: number) => x > 0 && Number.isInteger(Math.log10(x))

/** Mark-scheme text: negatives with the Unicode minus. */
export const minus = (s: string | number) => String(s).replace(/-/g, '−')

// The formulae (Appendix 3, and the Appendix 2 skills above). Each returns the unrounded value; round as the written slot does.

export const revenue = (price: number, quantity: number) => price * quantity
export const totalCosts = (fixed: number, variablePerUnit: number, quantity: number) => fixed + variablePerUnit * quantity
export const profit = (revenueValue: number, totalCostsValue: number) => revenueValue - totalCostsValue
/** Break-even output = fixed costs ÷ (selling price − variable cost per unit). */
export const breakEven = (fixed: number, price: number, variablePerUnit: number) => fixed / (price - variablePerUnit)
export const marginOfSafety = (actual: number, breakEvenOutput: number) => actual - breakEvenOutput
export const netCashFlow = (inflows: number, outflows: number) => inflows - outflows
export const closingBalance = (opening: number, netFlow: number) => opening + netFlow
/** Interest as a percentage of the amount borrowed = (total repaid − borrowed) ÷ borrowed × 100. */
export const interestPercent = (borrowed: number, repaid: number) => ((repaid - borrowed) / borrowed) * 100
export const percentChange = (before: number, after: number) => ((after - before) / before) * 100
export const marketShare = (sales: number, market: number) => (sales / market) * 100
export const grossProfit = (revenueValue: number, costOfSales: number) => revenueValue - costOfSales
export const grossMargin = (gross: number, revenueValue: number) => (gross / revenueValue) * 100
export const netMargin = (net: number, revenueValue: number) => (net / revenueValue) * 100
/** ARR = average annual profit ÷ cost of investment × 100, where the profit is net of the cost. */
export const averageRateOfReturn = (cost: number, totalProfit: number, years: number) => (totalProfit / years / cost) * 100
export const staffTurnover = (leavers: number, staff: number) => (leavers / staff) * 100
