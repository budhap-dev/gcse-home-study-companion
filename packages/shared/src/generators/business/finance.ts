import type { Question } from '../../content/questions.ts'
import { roundTo, show } from '../format.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import type { Draft, Generator } from '../types.ts'
import {
  averageRateOfReturn,
  businessBySlot,
  byKey,
  gbp,
  grossMargin,
  grossProfit,
  near,
  netMargin,
  numericDraft,
  percentChange,
  powerOfTen,
  readsOff,
  steps,
  styleOf,
  texGbp,
  texNum,
} from './build.ts'

/**
 * Business (Edexcel 1BS0) generators: Topic 2.4, making financial decisions. One generator for
 * each of the topic's nine numeric written slots:
 *
 * - 2.4.1 business calculations, the concept and calculation of gross and net profit, and the
 *   calculation of gross profit margin, net profit margin and average rate of return (all
 *   Appendix 3 formulae, which the exam does not give): gross profit (q2), gross profit margin
 *   (q4), net profit (q5), net profit margin (q6), net profit margin from the accounts (q26), and
 *   ARR from a total profit (q7), from yearly returns that must first have the cost taken off
 *   (q11), and from a list of yearly profits (q25).
 * - 2.4.2 understanding business performance, financial data compared between years: the
 *   percentage change in net profit (q24; Appendix 2, "percentages and percentage changes").
 *
 * The formulae are build.ts's; each check reaches the answer a second way by putting it back
 * (the margin of the revenue gives the profit, the ARR of the cost gives the yearly returns).
 * Every answer is drawn first and the givens fitted to it, at the size of the business named.
 * Every slot is exact, as written, and every figure prints in the written question's comma style.
 *
 * The sheets print other questions these must not answer or mirror: q3 (core) asks which cost is
 * an operating expense, with coffee-shop options, so no core context is a café; q23 (core) asks
 * the name of net profit, so the core solutions never name it; q13, q17 and q18 (advanced) are a
 * café and a coffee chain, q28 a pet shop, q29 a toy shop and q30 a laundry, so no context is any
 * of those; q14, q18, q22 and q30 cost £20,000, £40,000 and £50,000 and q18 returns £8,000 a year, so q11 never prints
 * any of those.
 */
const TOPIC = 'making-financial-decisions'

const low = (s: string) => s[0]!.toLowerCase() + s.slice(1)
const toStep = (x: number, step: number) => Math.round(x / step) * step
/** Uniform on [lo, hi]. */
const between = (r: Rng, lo: number, hi: number) => lo + r() * (hi - lo)
/** A percentage rounded as a student types it: whole, and to one place. */
const typed = (x: number) => [Math.round(x), roundTo(x, 1)]
/** A percentage that is not a whole number, printed as the solution says it: about 48.3%. */
const about = (x: number) => (Number.isInteger(roundTo(x, 9)) ? `${show(x)}%` : `about ${show(roundTo(x, 1))}%`)

// ---------------------------------------------------------------------------------------------
// The businesses whose accounts q2, q4, q5, q6, q24 and q26 print
// ---------------------------------------------------------------------------------------------

export interface Firm {
  name: string
  /** The business, starting a sentence: "A bookshop", "An electrical retailer". */
  who: string
  /** A year's sales revenue, in pounds. */
  revenue: [number, number]
  /** Gross and net profit margins a business of this kind makes, in whole percentages. */
  gross: [number, number]
  net: [number, number]
  /** A year's net profit, in pounds, for q24. */
  profit: [number, number]
}

/**
 * Small UK businesses with the margins their kind makes: food and goods retail keep 30% to 70%
 * of sales after the cost of sales and 2% to 15% after everything; a salon or a web agency,
 * whose cost of sales is products or freelancers, keeps more. "A business" stays near the
 * written questions' size (£480,000 and £320,000 of sales).
 */
export const FIRMS: Firm[] = [
  { name: 'business', who: 'A business', revenue: [200000, 900000], gross: [30, 70], net: [4, 20], profit: [20000, 150000] },
  { name: 'shop', who: 'A shop', revenue: [150000, 700000], gross: [35, 55], net: [4, 12], profit: [15000, 80000] },
  { name: 'clothing shop', who: 'A clothing shop', revenue: [150000, 800000], gross: [45, 60], net: [4, 14], profit: [10000, 90000] },
  { name: 'bookshop', who: 'A bookshop', revenue: [120000, 500000], gross: [30, 42], net: [2, 8], profit: [5000, 35000] },
  { name: 'florist', who: 'A florist', revenue: [100000, 400000], gross: [50, 65], net: [5, 15], profit: [8000, 50000] },
  { name: 'bakery', who: 'A bakery', revenue: [150000, 600000], gross: [55, 70], net: [5, 14], profit: [10000, 70000] },
  { name: 'hair salon', who: 'A hair salon', revenue: [80000, 400000], gross: [75, 90], net: [8, 20], profit: [10000, 60000] },
  { name: 'garden centre', who: 'A garden centre', revenue: [400000, 2000000], gross: [35, 50], net: [3, 10], profit: [20000, 150000] },
  { name: 'bike shop', who: 'A bike shop', revenue: [200000, 900000], gross: [30, 45], net: [3, 10], profit: [10000, 70000] },
  { name: 'furniture shop', who: 'A furniture shop', revenue: [300000, 1500000], gross: [40, 55], net: [4, 12], profit: [20000, 140000] },
  { name: 'restaurant', who: 'A restaurant', revenue: [300000, 1200000], gross: [60, 72], net: [3, 12], profit: [15000, 120000] },
  { name: 'electrical retailer', who: 'An electrical retailer', revenue: [300000, 1500000], gross: [22, 35], net: [2, 7], profit: [10000, 90000] },
  { name: 'jeweller', who: 'A jeweller', revenue: [150000, 800000], gross: [45, 60], net: [5, 15], profit: [10000, 100000] },
  { name: 'printing firm', who: 'A printing firm', revenue: [200000, 1000000], gross: [40, 60], net: [5, 15], profit: [15000, 120000] },
  { name: 'web design agency', who: 'A web design agency', revenue: [100000, 600000], gross: [60, 80], net: [10, 25], profit: [15000, 120000] },
  { name: 'shoe shop', who: 'A shoe shop', revenue: [150000, 600000], gross: [40, 55], net: [3, 10], profit: [8000, 50000] },
]

/** "A bookshop's", "A business's". */
const its = (f: Firm) => `${f.who}'s`

/**
 * Revenues, in steps of £5,000, on which a whole-number margin gives a profit in whole £500s
 * (£335,000 at 7% is £23,450, refused; £350,000 at 7% is £24,500). Whole thousands forced a round
 * £100,000 on every margin prime to 10, so two revenues in three were one; whole £500s leave it
 * about one in three. Never a power of ten (£1,000,000 makes the division trivial) nor one whose
 * profit prints the margin itself (£100,000 at 6% is £6,000, which reads off).
 */
const REVENUES = new Map<string, number[]>()
export function revenuesFor(f: Firm, margin: number): number[] {
  const key = `${f.name}/${margin}`
  let out = REVENUES.get(key)
  if (!out) {
    out = steps(f.revenue[0], f.revenue[1], 5000).filter((R) => (R * margin) % 50000 === 0 && !powerOfTen(R) && !readsOff(margin, [R, (R * margin) / 100]))
    REVENUES.set(key, out)
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// q2: gross profit
// ---------------------------------------------------------------------------------------------

const GROSS_PROMPTS = [
  (f: Firm, R: string, C: string) => `${f.who} has sales revenue of ${R} and cost of sales of ${C}. What is its gross profit, in pounds?`,
  (f: Firm, R: string, C: string) => `Last year ${low(f.who)} had sales revenue of ${R}. Its cost of sales was ${C}. What was its gross profit, in pounds?`,
  (f: Firm, R: string, C: string) => `${its(f)} sales revenue for the year was ${R} and its cost of sales was ${C}. Calculate its gross profit, in pounds.`,
]

/** q2: revenue − cost of sales, 2 marks. Written: £480,000 − £192,000 = £288,000. */
function grossProfitQ(r: Rng, slot: Question): Draft {
  const s = styleOf(slot)
  const f = pick(r, FIRMS)
  const x = draw(
    r,
    (r) => {
      // The revenue to the nearest £1,000, a margin of the business's kind, and the cost of sales to the nearest £1,000.
      const R = toStep(between(r, f.revenue[0], f.revenue[1]), 1000)
      const g = int(r, f.gross[0], f.gross[1])
      const C = toStep((R * (100 - g)) / 100, 1000)
      return { R, C, GP: R - C }
    },
    // Never half (the cost of sales would be the answer), and no answer read off a printed figure.
    (x) => x.GP !== x.C && !readsOff(x.GP, [x.R, x.C]) && !powerOfTen(x.R),
  )
  const { R, C } = x
  const answer = grossProfit(R, C)
  const T = (v: number) => texNum(v, s)
  return numericDraft(
    slot,
    {
      prompt: pick(r, GROSS_PROMPTS)(f, gbp(R, s), gbp(C, s)),
      solution: `Gross profit $=$ sales revenue $-$ cost of sales $= ${T(R)} - ${T(C)} = $ **${gbp(answer, s)}**. Only the cost of sales is taken away to reach gross profit.`,
      method: [`$${T(R)} - ${T(C)}$`],
      answer,
      line: gbp(answer, s),
    },
    // Second route: the cost of sales and the gross profit add back to the revenue.
    { agrees: answer + C === R && answer > 0, detail: `${C} + ${answer} = ${C + answer}` },
    { context: f.name, revenue: R, costOfSales: C, grossProfit: answer, margin: show(roundTo((answer / R) * 100, 1)) },
  )
}

// ---------------------------------------------------------------------------------------------
// q4: gross profit margin
// ---------------------------------------------------------------------------------------------

const GROSS_MARGIN_PROMPTS = [
  (f: Firm, GP: string, R: string) => `${f.who} has gross profit of ${GP} and sales revenue of ${R}. What is its gross profit margin, as a percentage?`,
  (f: Firm, GP: string, R: string) => `${its(f)} sales revenue last year was ${R} and its gross profit was ${GP}. What was its gross profit margin, as a percentage?`,
  (f: Firm, GP: string, R: string) => `${f.who} made a gross profit of ${GP} on sales revenue of ${R}. Calculate its gross profit margin, as a percentage.`,
]

/** Gross margins a firm can be given: never 50%, where the cost of sales equals the gross profit. */
export const grossMargins = (f: Firm) => steps(f.gross[0], f.gross[1], 1).filter((g) => g !== 50 && revenuesFor(f, g).length > 0)

/** q4: gross profit ÷ revenue × 100, 2 marks. Written: £288,000 of £480,000, 60%. The margin first. */
function grossMarginQ(r: Rng, slot: Question): Draft {
  const s = styleOf(slot)
  const f = pick(r, FIRMS)
  const g = pick(r, grossMargins(f))
  const R = pick(r, revenuesFor(f, g))
  const GP = (R * g) / 100
  const T = (v: number) => texNum(v, s)
  return numericDraft(
    slot,
    {
      prompt: pick(r, GROSS_MARGIN_PROMPTS)(f, gbp(GP, s), gbp(R, s)),
      solution: `Gross profit margin $= \\dfrac{\\text{gross profit}}{\\text{sales revenue}} \\times 100 = (${T(GP)} \\div ${T(R)}) \\times 100 = $ **${g}%**. Divide by the sales revenue, the figure the profit was made from.`,
      method: [`$(${T(GP)} \\div ${T(R)}) \\times 100$`],
      answer: g,
      line: `${g}%`,
    },
    // Second route: that margin of the revenue gives the gross profit back.
    { agrees: (R * g) / 100 === GP && near(grossMargin(GP, R), g), detail: `${g}% of ${R} = ${(R * g) / 100}` },
    { context: f.name, revenue: R, grossProfit: GP, margin: g },
  )
}

// ---------------------------------------------------------------------------------------------
// q5: net profit
// ---------------------------------------------------------------------------------------------

const NET_COMBINED = [
  (f: Firm, GP: string, E: string) => `${its(f)} gross profit for the year was ${GP} and its other operating expenses and interest came to ${E}. What was its net profit, in pounds?`,
  (f: Firm, GP: string, E: string) => `${f.who} made a gross profit of ${GP} last year. Its other operating expenses and interest totalled ${E}. What was its net profit, in pounds?`,
]
/** The written wording, which names no business: only for "A business". */
const NET_BARE = (GP: string, E: string) => `Gross profit is ${GP} and other operating expenses and interest are ${E}. What is the net profit, in pounds?`
const NET_SEPARATE = [
  (f: Firm, GP: string, E: string, I: string) => `${f.who} made a gross profit of ${GP} last year. Its other operating expenses were ${E} and it paid ${I} in interest. What was its net profit, in pounds?`,
  (f: Firm, GP: string, E: string, I: string) => `${its(f)} gross profit for the year was ${GP}. Its other operating expenses came to ${E} and its interest to ${I}. What was its net profit, in pounds?`,
]

/**
 * q5: gross profit − other operating expenses and interest, 2 marks. Written: £288,000 − £216,000
 * = £72,000. The revenue is never printed; it sizes the gross and net profit to the business's
 * margins. Two in five print the interest apart from the other expenses, so both come off.
 */
function netProfitQ(r: Rng, slot: Question): Draft {
  const s = styleOf(slot)
  const f = pick(r, FIRMS)
  const separate = r() < 0.4
  const x = draw(
    r,
    (r) => {
      const R = toStep(between(r, f.revenue[0], f.revenue[1]), 10000)
      const g = int(r, f.gross[0], f.gross[1])
      const n = int(r, f.net[0], Math.min(f.net[1], g - 15))
      const GP = toStep((R * g) / 100, 1000)
      const NP = toStep((R * n) / 100, 1000)
      // Interest of 0.5% to 2.5% of sales, to the nearest £500: a small business's loan.
      const I = Math.max(500, toStep(R * between(r, 0.005, 0.025), 500))
      return { R, GP, NP, I, X: GP - NP }
    },
    (x) => {
      const E = separate ? x.X - x.I : x.X
      const printed = separate ? [x.GP, E, x.I] : [x.GP, x.X]
      // Never half the gross profit (the expenses would be the answer); the expenses at least
      // twice the interest; no answer read off a printed figure or equal to a wrong route.
      return x.NP >= 2000 && x.NP !== x.X && E > 2 * x.I && !readsOff(x.NP, printed) && !(separate ? [x.GP + x.X, x.GP - E, x.GP - x.I] : [x.GP + x.X]).includes(x.NP)
    },
  )
  const { GP, NP, I, X } = x
  const E = separate ? X - I : X
  const answer = separate ? GP - E - I : GP - X
  const T = (v: number) => texNum(v, s)
  const bare = f.name === 'business' && !separate && r() < 0.5
  const prompt = separate
    ? pick(r, NET_SEPARATE)(f, gbp(GP, s), gbp(E, s), gbp(I, s))
    : bare
      ? NET_BARE(gbp(GP, s), gbp(X, s))
      : pick(r, NET_COMBINED)(f, gbp(GP, s), gbp(X, s))
  const line = separate ? `${T(GP)} - ${T(E)} - ${T(I)}` : `${T(GP)} - ${T(X)}`
  return numericDraft(
    slot,
    {
      prompt,
      solution:
        `Net profit $=$ gross profit $-$ other operating expenses and interest $= ${line} = $ **${gbp(answer, s)}**. ` +
        (separate ? 'The interest is taken away as well as the other operating expenses.' : 'Everything else the business spent, interest included, comes off the gross profit.'),
      method: [`$${line}$`],
      answer,
      line: gbp(answer, s),
    },
    // Second route: the net profit and everything taken off add back to the gross profit.
    { agrees: answer + E + (separate ? I : 0) === GP && answer === NP && answer > 0, detail: `${answer} + ${X} = ${answer + X}` },
    { context: f.name, separate: separate ? 'yes' : 'no', grossProfit: GP, expenses: E, ...(separate ? { interest: I } : {}), netProfit: answer },
  )
}

// ---------------------------------------------------------------------------------------------
// q6: net profit margin
// ---------------------------------------------------------------------------------------------

const NET_MARGIN_PROMPTS = [
  (f: Firm, NP: string, R: string) => `${f.who} made a net profit of ${NP} on sales revenue of ${R}. What is its net profit margin, as a percentage?`,
  (f: Firm, NP: string, R: string) => `${its(f)} sales revenue last year was ${R} and its net profit was ${NP}. What was its net profit margin, as a percentage?`,
  (f: Firm, NP: string, R: string) => `${f.who} had sales revenue of ${R} and a net profit of ${NP} for the year. Calculate its net profit margin, as a percentage.`,
]
const NET_MARGIN_BARE = (NP: string, R: string) => `Net profit is ${NP} and sales revenue is ${R}. What is the net profit margin, as a percentage?`

/** Net margins a firm can be given: never 10%, where revenue ÷ net profit gives 10 as well. */
/**
 * Revenue and net margin pairs the advanced sheet's own questions print: q30's laundry (£250,000
 * of sales, £30,000 net profit, 12%) and q29's toy shop (£500,000 at 6%). q26 never draws them.
 */
export const SHEET_ACCOUNTS: [number, number][] = [
  [250000, 12],
  [500000, 6],
]
const accountsRevenues = (f: Firm, n: number) => revenuesFor(f, n).filter((R) => !SHEET_ACCOUNTS.some(([r, m]) => r === R && m === n))

export const netMargins = (f: Firm) => steps(f.net[0], f.net[1], 1).filter((n) => n !== 10 && revenuesFor(f, n).length > 0)

/** q6: net profit ÷ revenue × 100, 2 marks. Written: £72,000 of £480,000, 15%. The margin first. */
function netMarginQ(r: Rng, slot: Question): Draft {
  const s = styleOf(slot)
  const f = pick(r, FIRMS)
  const n = pick(r, netMargins(f))
  const R = pick(r, revenuesFor(f, n))
  const NP = (R * n) / 100
  const T = (v: number) => texNum(v, s)
  const prompt = f.name === 'business' && r() < 0.5 ? NET_MARGIN_BARE(gbp(NP, s), gbp(R, s)) : pick(r, NET_MARGIN_PROMPTS)(f, gbp(NP, s), gbp(R, s))
  return numericDraft(
    slot,
    {
      prompt,
      solution: `Net profit margin $= \\dfrac{\\text{net profit}}{\\text{sales revenue}} \\times 100 = (${T(NP)} \\div ${T(R)}) \\times 100 = $ **${n}%**. It divides by **revenue**, not by gross profit.`,
      method: [`$(${T(NP)} \\div ${T(R)}) \\times 100$`],
      answer: n,
      line: `${n}%`,
    },
    // Second route: that margin of the revenue gives the net profit back.
    { agrees: (R * n) / 100 === NP && near(netMargin(NP, R), n), detail: `${n}% of ${R} = ${(R * n) / 100}` },
    { context: f.name, revenue: R, netProfit: NP, margin: n },
  )
}

// ---------------------------------------------------------------------------------------------
// The investments q7, q11 and q25 print
// ---------------------------------------------------------------------------------------------

export interface Investment {
  name: string
  /** As the subject of a sentence: "A new delivery van". */
  what: string
  /** With its article inside a sentence, and its noun alone: "a new delivery van", "van". */
  a: string
  noun: string
  cost: [number, number]
  /** The years it is used for. */
  years: [number, number]
}

/**
 * q7: an investment with a total profit over its life. Costs a small business pays for each (a
 * van £18,000 to £45,000, a till system £2,000 to £10,000) and lives it could last.
 */
export const TOTAL_INVESTMENTS: Investment[] = [
  { name: 'investment', what: 'An investment', a: 'an investment', noun: 'investment', cost: [10000, 120000], years: [2, 5] },
  { name: 'delivery van', what: 'A new delivery van', a: 'a new delivery van', noun: 'van', cost: [18000, 45000], years: [3, 6] },
  { name: 'oven', what: 'A new oven for a bakery', a: 'a new oven for a bakery', noun: 'oven', cost: [6000, 25000], years: [3, 6] },
  { name: 'website', what: 'A new website for an online shop', a: 'a new website for an online shop', noun: 'website', cost: [3000, 15000], years: [2, 4] },
  { name: 'packaging machine', what: 'A packaging machine', a: 'a packaging machine', noun: 'machine', cost: [20000, 120000], years: [3, 6] },
  { name: 'till system', what: 'A new till system for a shop', a: 'a new till system for a shop', noun: 'till system', cost: [2000, 10000], years: [3, 5] },
  { name: 'minibus', what: 'A minibus for a tour company', a: 'a minibus for a tour company', noun: 'minibus', cost: [25000, 60000], years: [3, 6] },
  { name: 'extension', what: 'An extension to a restaurant', a: 'an extension to a restaurant', noun: 'extension', cost: [40000, 200000], years: [4, 6] },
]
/** ARRs of 8% to 50% a year: a project worth doing, never one that pays for itself each year. */
export const ARR_TOTAL = [8, 50] as const

/** q11: an investment with yearly returns. Never a laundry's machines (q30) nor a coffee machine (q18). */
export const RETURN_INVESTMENTS: Investment[] = [
  { name: 'refurbishment', what: 'A refurbishment', a: 'a refurbishment', noun: 'refurbishment', cost: [10000, 80000], years: [3, 6] },
  { name: 'shop refit', what: 'A shop refit', a: 'a shop refit', noun: 'refit', cost: [10000, 60000], years: [3, 6] },
  { name: 'delivery van', what: 'A new delivery van', a: 'a new delivery van', noun: 'van', cost: [18000, 45000], years: [3, 6] },
  { name: 'machine', what: 'A new machine', a: 'a new machine', noun: 'machine', cost: [15000, 100000], years: [3, 6] },
  { name: 'kitchen', what: 'A new kitchen for a restaurant', a: 'a new kitchen for a restaurant', noun: 'kitchen', cost: [25000, 90000], years: [4, 6] },
  { name: 'online shop', what: 'A new online shop', a: 'a new online shop', noun: 'online shop', cost: [4000, 20000], years: [3, 4] },
  { name: 'extension', what: 'An extension to a hotel', a: 'an extension to a hotel', noun: 'extension', cost: [40000, 150000], years: [4, 6] },
]
/** ARRs of 6% to 25%: at 25% over 3 years a project returns 58% of its cost each year, as high as a small project goes. */
export const ARR_RETURNS = [6, 25] as const
/** The costs other questions on the advanced sheet print (q14, q18, q22, q30). */
export const SHEET_COSTS = [20000, 40000, 50000]
/** q18's project B returns £8,000 a year. */
export const SHEET_RETURN = 8000

/** q25: an asset with a profit each year, then scrapped. Each at least £15,000. */
export const YEARLY_INVESTMENTS: Investment[] = [
  { name: 'machine', what: 'A machine', a: 'a machine', noun: 'machine', cost: [15000, 80000], years: [3, 5] },
  { name: 'delivery van', what: 'A delivery van', a: 'a delivery van', noun: 'van', cost: [18000, 45000], years: [3, 5] },
  { name: 'forklift truck', what: 'A forklift truck', a: 'a forklift truck', noun: 'forklift truck', cost: [15000, 35000], years: [3, 5] },
  { name: 'printing press', what: 'A printing press', a: 'a printing press', noun: 'press', cost: [30000, 150000], years: [4, 5] },
  { name: 'tractor', what: 'A tractor', a: 'a tractor', noun: 'tractor', cost: [40000, 120000], years: [4, 5] },
  { name: 'oven', what: 'A commercial oven', a: 'a commercial oven', noun: 'oven', cost: [15000, 40000], years: [3, 5] },
  { name: 'minibus', what: 'A minibus', a: 'a minibus', noun: 'minibus', cost: [25000, 60000], years: [3, 5] },
]
export const ARR_YEARLY = [10, 40] as const

/** Costs in whole thousands that fit (used by q25, whose cost is never more than a quarter of any context's builds). */
function costsFor(inv: Investment, ok: (I: number) => boolean, tidy: (I: number) => boolean): number[] {
  const all = steps(inv.cost[0], inv.cost[1], 1000).filter((I) => !powerOfTen(I) && ok(I))
  const neat = all.filter(tidy)
  return neat.length ? neat : all
}

export interface Draw {
  A: number
  Y: number
  I: number
}
/** The fewest costs an ARR may have in whole hundreds before whole £10s are allowed for it too. */
export const MIN_COSTS = 3
const DRAWS = new Map<string, Map<number, Draw[]>>()
/**
 * Every (ARR, years, cost) that fits a context, by ARR. For each ARR, only those keeping the
 * printed total in whole hundreds when at least MIN_COSTS costs do; otherwise every one, in whole
 * £10s. q7 and q11 then draw the ARR evenly, the cost evenly among that ARR's, and the years.
 * Drawing the ARR first and the cost last from a filtered list put the van at £30,000 in 58% of
 * its builds; drawing the cost first and preferring whole hundreds left most costs only 10%, 15%,
 * 20% and 25%, which took 86% of builds. Three costs is the measured balance: at five, one total in
 * four on q11 was in whole £10s; at two, the website took 43% of its builds at one cost.
 */
function drawsFor(key: string, arr: readonly [number, number], years: [number, number], costs: number[], ok: (d: Draw) => boolean, tidy: (d: Draw) => boolean) {
  let out = DRAWS.get(key)
  if (!out) {
    out = new Map()
    for (const A of steps(arr[0], arr[1], 1)) {
      const all = costs.flatMap((I) => steps(years[0], years[1], 1).map((Y) => ({ A, Y, I }))).filter(ok)
      const neat = all.filter(tidy)
      const use = new Set(neat.map((d) => d.I)).size >= MIN_COSTS ? neat : all
      if (use.length) out.set(A, use)
    }
    DRAWS.set(key, out)
  }
  return out
}
/** The ARR evenly, then the cost evenly among that ARR's, then the years. */
function drawArr(r: Rng, draws: Map<number, Draw[]>): Draw {
  const list = draws.get(pick(r, [...draws.keys()]))!
  return byKey(r, list, (d) => d.I)
}

/** q7: whole-pound totals, never equal to the cost, the ARR never the years, no wrong route paying. */
export const totalDraws = (v: Investment) => {
  const T = (d: Draw) => (d.I * d.A * d.Y) / 100
  return drawsFor(
    `q7/${v.name}`,
    ARR_TOTAL,
    v.years,
    steps(v.cost[0], v.cost[1], 1000).filter((I) => !powerOfTen(I)),
    (d) => Number.isInteger(T(d)) && d.A * d.Y !== 100 && d.A !== d.Y && !readsOff(d.A, [d.I, T(d)]) && !arrTotalWrong(d.I, T(d), d.Y).flatMap(typed).includes(d.A),
    (d) => T(d) % 100 === 0,
  )
}

/** q11: a whole-pound return that is not a figure the advanced sheet prints, never a sheet cost, no wrong route paying. */
export const returnDraws = (v: Investment) => {
  const R = (d: Draw) => (d.I * d.A) / 100 + d.I / d.Y
  return drawsFor(
    `q11/${v.name}`,
    ARR_RETURNS,
    v.years,
    steps(v.cost[0], v.cost[1], 1000).filter((I) => !powerOfTen(I) && !SHEET_COSTS.includes(I) && I !== SHEET_RETURN),
    (d) =>
      Number.isInteger(R(d)) &&
      !SHEET_COSTS.includes(R(d)) &&
      R(d) !== SHEET_RETURN &&
      // Never ARR × years = 100: the total profit would equal the cost, and cost ÷ years ÷ cost would score.
      d.A * d.Y !== 100 &&
      d.A !== d.Y &&
      !readsOff(d.A, [d.I, R(d), R(d) * d.Y]) &&
      !arrReturnWrong(d.I, R(d), d.Y).flatMap(typed).includes(d.A),
    (d) => R(d) % 100 === 0,
  )
}

// ---------------------------------------------------------------------------------------------
// q7: ARR from a total profit
// ---------------------------------------------------------------------------------------------

const ARR_TOTAL_PROMPTS = [
  (v: Investment, I: string, T: string, Y: number) => `${v.what} costs ${I} and gives a total profit of ${T} over ${Y} years. What is the ARR, as a percentage?`,
  (v: Investment, I: string, T: string, Y: number) => `${v.what} costs ${I}. Over the next ${Y} years it is expected to make a total profit of ${T}. What is its average rate of return (ARR), as a percentage?`,
  (v: Investment, I: string, T: string, Y: number) => `A business is considering ${v.a}, costing ${I}. It expects a total profit of ${T} from it over ${Y} years. Calculate the ARR, as a percentage.`,
]

/** The wrong routes for q7, as a student would type them: years forgotten; the cost taken off a profit again. */
export const arrTotalWrong = (I: number, T: number, Y: number) => [(T / I) * 100, ((T - I) / Y / I) * 100, (I / (T / Y)) * 100, ((T / Y) / I) * 100 * Y]

/** q7: (total profit ÷ years) ÷ cost × 100, 3 marks. Written: £90,000 over 3 years on £50,000, 60%. */
function arrTotalQ(r: Rng, slot: Question): Draft {
  const s = styleOf(slot)
  const v = pick(r, TOTAL_INVESTMENTS)
  const { A, Y, I } = drawArr(r, totalDraws(v))
  const T = (I * A * Y) / 100
  const P = T / Y
  const answer = averageRateOfReturn(I, T, Y)
  const M = (n: number) => texNum(n, s)
  return numericDraft(
    slot,
    {
      prompt: pick(r, ARR_TOTAL_PROMPTS)(v, gbp(I, s), gbp(T, s), Y),
      solution:
        `Average annual profit $= ${M(T)} \\div ${Y} = ${M(P)}$; then $(${M(P)} \\div ${M(I)}) \\times 100 = $ **${show(answer)}%**. ` +
        `The ${gbp(T, s)} is already profit, so the cost is not taken off it again.`,
      method: [`$${M(T)} \\div ${Y} = ${M(P)}$`, `$(${M(P)} \\div ${M(I)}) \\times 100$`],
      answer: roundTo(answer, 9),
      line: `${show(answer)}%`,
    },
    // Second route: that ARR of the cost, over the years, gives the total profit back.
    { agrees: near(answer, A) && (I * A * Y) / 100 === T && Number.isInteger(T), detail: `${A}% of ${I} × ${Y} = ${(I * A * Y) / 100}` },
    { context: v.name, cost: I, totalProfit: T, years: Y, arr: A },
  )
}

// ---------------------------------------------------------------------------------------------
// q11: ARR from yearly returns
// ---------------------------------------------------------------------------------------------

const ARR_RETURN_PROMPTS = [
  (v: Investment, I: string, R: string, Y: number) => `${v.what} costs ${I} and returns ${R} a year for ${Y} years. What is the ARR, as a percentage?`,
  (v: Investment, I: string, R: string, Y: number) =>
    `${v.what} will cost ${I}. It is expected to bring in returns of ${R} a year for ${Y} years. Calculate its average rate of return (ARR), as a percentage.`,
  (v: Investment, I: string, R: string, Y: number) => `A business is considering ${v.a} costing ${I}, which is expected to return ${R} a year for ${Y} years. What is the ARR, as a percentage?`,
]

/**
 * The wrong routes for q11, as typed: the cost never taken off (returns ÷ cost); the years never
 * divided by; that slip divided by the years again; returns ÷ cost less 100.
 */
export const arrReturnWrong = (I: number, R: number, Y: number) => [(R / I) * 100, ((R * Y - I) / I) * 100, (R / I / Y) * 100, (R / I) * 100 - 100, ((R * Y) / I) * 100]

/** q11: (returns × years − cost) ÷ years ÷ cost × 100, 3 marks. Written: £8,000 a year for 4 years on £20,000, 15%. */
function arrReturnQ(r: Rng, slot: Question): Draft {
  const s = styleOf(slot)
  const v = pick(r, RETURN_INVESTMENTS)
  const { A, Y, I } = drawArr(r, returnDraws(v))
  const R = (I * A) / 100 + I / Y
  const total = R * Y
  const TP = total - I
  const P = TP / Y
  const answer = averageRateOfReturn(I, TP, Y)
  const M = (n: number) => texNum(n, s)
  return numericDraft(
    slot,
    {
      prompt: pick(r, ARR_RETURN_PROMPTS)(v, gbp(I, s), gbp(R, s), Y),
      solution:
        `Total returns $= ${M(R)} \\times ${Y} = ${M(total)}$. These are **returns**, not profit, so subtract the investment: $${M(total)} - ${M(I)} = ${M(TP)}$ total profit. ` +
        `Average annual profit $= ${M(TP)} \\div ${Y} = ${M(P)}$, so $(${M(P)} \\div ${M(I)}) \\times 100 = $ **${show(answer)}%**. Forgetting to subtract gives ${about((R / I) * 100)}.`,
      method: [`$${M(R)} \\times ${Y} - ${M(I)} = ${M(TP)}$`, `$(${M(TP)} \\div ${Y} \\div ${M(I)}) \\times 100$`],
      answer: roundTo(answer, 9),
      line: `${show(answer)}%`,
    },
    // Second route: the yearly return is that ARR of the cost plus the cost spread over the years.
    { agrees: near(answer, A) && near((I * A) / 100 + I / Y, R) && Number.isInteger(R), detail: `${A}% of ${I} + ${I} ÷ ${Y} = ${(I * A) / 100 + I / Y}` },
    { context: v.name, cost: I, returns: R, years: Y, arr: A },
  )
}

// ---------------------------------------------------------------------------------------------
// q24: percentage change in net profit
// ---------------------------------------------------------------------------------------------

const RISE_PROMPTS = [
  (f: Firm, O: string, N: string) => `${its(f)} net profit was ${O} last year and ${N} this year. Calculate the percentage change in its net profit.`,
  (f: Firm, O: string, N: string) => `${f.who} made a net profit of ${O} last year. This year its net profit rose to ${N}. Calculate the percentage change in its net profit.`,
  (f: Firm, O: string, N: string) => `${its(f)} net profit rose from ${O} last year to ${N} this year. Calculate the percentage increase in its net profit.`,
]
const FALL_PROMPTS = [
  (f: Firm, O: string, N: string) => `${its(f)} net profit was ${O} last year and ${N} this year. Calculate the percentage decrease in its net profit.`,
  (f: Firm, O: string, N: string) => `${its(f)} net profit fell from ${O} last year to ${N} this year. Calculate the percentage decrease in its net profit.`,
]
/** Rises of 8% to 60% and falls of 8% to 40%: below 8%, dividing by the new figure rounds to the same whole number. */
export const RISE = [8, 60] as const
export const FALL = [8, 40] as const

/** The wrong routes for q24, as typed: the change divided by the new figure; new ÷ old × 100. */
export const changeWrong = (O: number, N: number) => [(Math.abs(N - O) / N) * 100, (N / O) * 100, (O / N) * 100]

/**
 * Last year's profits, in whole thousands, so the change is in whole £10s. A change in whole
 * hundreds forced a round £10,000 on every percentage prime to 10 (three builds in five, the
 * written £40,000 in one in thirteen). Never a power of ten (the change would print the percentage).
 */
export const startsFor = (f: Firm, p: number) =>
  steps(f.profit[0], f.profit[1], 1000).filter((O) => (O * p) % 1000 === 0 && !powerOfTen(O) && !readsOff(p, [O, (O * p) / 100]))

/** q24: (new − old) ÷ old × 100, 2 marks. Written: £40,000 to £48,000, 20%. A rise in three builds in five. */
function profitChangeQ(r: Rng, slot: Question): Draft {
  const s = styleOf(slot)
  const f = pick(r, FIRMS)
  const rise = r() < 0.6
  const x = draw(
    r,
    (r) => {
      const [lo, hi] = rise ? RISE : FALL
      const p = int(r, lo, hi)
      const starts = startsFor(f, p)
      if (!starts.length) return null
      const O = pick(r, starts)
      return { p, O, N: rise ? (O * (100 + p)) / 100 : (O * (100 - p)) / 100 }
    },
    (x) => !!x && !readsOff(x.p, [x.N]) && !changeWrong(x.O, x.N).flatMap(typed).includes(x.p),
  )!
  const { p, O, N } = x
  const change = Math.abs(N - O)
  const answer = rise ? percentChange(O, N) : -percentChange(O, N)
  const M = (n: number) => texNum(n, s)
  const prompt = pick(r, rise ? RISE_PROMPTS : FALL_PROMPTS)(f, gbp(O, s), gbp(N, s))
  const working = rise ? `(${M(N)} - ${M(O)}) \\div ${M(O)} \\times 100` : `(${M(O)} - ${M(N)}) \\div ${M(O)} \\times 100`
  return numericDraft(
    slot,
    {
      prompt,
      solution:
        `Percentage ${rise ? 'change' : 'decrease'} $=$ ${rise ? 'change' : 'fall'} $\\div$ original $\\times 100 = ${working} = ${M(change)} \\div ${M(O)} \\times 100 = ${show(answer)}\\%$. ` +
        `Divide by last year's figure, the one the change is measured from. A ${rise ? 'rise' : 'fall'} of ${show(answer)}% is a comparison between two years, which is what turns a profit figure into evidence about performance.`,
      method: [`$${working}$`],
      answer: roundTo(answer, 9),
    },
    // Second route: last year's profit moved by that percentage gives this year's.
    { agrees: near(answer, p) && (O * (100 + (rise ? p : -p))) / 100 === N, detail: `${O} × ${(100 + (rise ? p : -p)) / 100} = ${(O * (100 + (rise ? p : -p))) / 100}` },
    { context: f.name, direction: rise ? 'rise' : 'fall', before: O, after: N, percent: p },
  )
}

// ---------------------------------------------------------------------------------------------
// q25: ARR from a list of yearly profits
// ---------------------------------------------------------------------------------------------

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth']
/** "£4,000, £7,000 and £10,000". */
const listed = (xs: string[]) => `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`

const YEARLY_PROMPTS = [
  (v: Investment, I: string, xs: string[]) =>
    `${v.what} costs ${I}. It is expected to earn a profit of ${listed(xs.map((x, i) => `${x} in its ${ORDINALS[i]} year`))}, after which it will be scrapped. Calculate the average rate of return on the ${v.noun}.`,
  (v: Investment, I: string, xs: string[]) =>
    `A business buys ${v.a} for ${I}. The ${v.noun} is expected to make profits of ${listed(xs)} in years 1 to ${xs.length} of its life, and will then be scrapped. Calculate the average rate of return on the ${v.noun}.`,
]

type Shape = 'rising' | 'peak' | 'falling'

/** Y distinct yearly profits in whole hundreds adding to S, none equal to their average, in the shape asked. */
function yearly(r: Rng, S: number, Y: number, shape: Shape): number[] | null {
  // In hundreds of pounds: each year the average moved by a whole number of hundreds, the last balancing the rest.
  const U = S / 100
  const mean = U / Y
  const spread = Math.max(2, Math.round(mean * between(r, 0.2, 0.6)))
  const first = Array.from({ length: Y - 1 }, () => Math.round(mean) + (r() < 0.5 ? -1 : 1) * int(r, 1, spread))
  const hundreds = [...first, U - first.reduce((a, b) => a + b, 0)]
  if (hundreds.some((h) => h < Math.max(5, 0.2 * mean) || Math.abs(h - mean) > 1.5 * spread + 1)) return null
  const sorted = hundreds.map((h) => h * 100).sort((a, b) => a - b)
  // Distinct years, at least 5% of the average apart, none equal to the average.
  if (sorted.some((v, i) => i > 0 && v - sorted[i - 1]! < Math.max(200, 0.05 * (S / Y))) || sorted.some((v) => near(v, S / Y))) return null
  if (shape === 'rising') return sorted
  if (shape === 'falling') return [...sorted].reverse()
  const rest = sorted.slice(0, -1)
  return [...rest.filter((_, i) => i % 2 === 0), sorted[Y - 1]!, ...rest.filter((_, i) => i % 2 === 1).reverse()]
}

/**
 * The wrong routes for q25, as typed: the cost taken off profits again; the years never divided
 * by; one year's profit (first, last, largest, smallest, middle) or the first and last averaged,
 * taken as the average.
 */
export function yearlyWrong(I: number, xs: number[]): number[] {
  const S = xs.reduce((a, b) => a + b, 0)
  const Y = xs.length
  const sorted = [...xs].sort((a, b) => a - b)
  const median = Y % 2 ? sorted[(Y - 1) / 2]! : (sorted[Y / 2 - 1]! + sorted[Y / 2]!) / 2
  const asAverage = [...xs, (xs[0]! + xs[Y - 1]!) / 2, median, S / (Y - 1), S / (Y + 1)]
  return [((S - I) / Y / I) * 100, (S / I) * 100, ...asAverage.map((p) => (p / I) * 100)]
}

/** q25: (sum of yearly profits ÷ years) ÷ cost × 100, 3 marks. Written: £4,000, £7,000, £10,000 on £25,000, 28%. */
function arrYearlyQ(r: Rng, slot: Question): Draft {
  const s = styleOf(slot)
  const v = pick(r, YEARLY_INVESTMENTS)
  // Profits rising in half the builds, as the written ones do; rising then falling, or falling as the asset wears, in the rest.
  const u = r()
  const shape: Shape = u < 0.5 ? 'rising' : u < 0.75 ? 'peak' : 'falling'
  const x = draw(
    r,
    (r) => {
      const A = int(r, ARR_YEARLY[0], ARR_YEARLY[1])
      const Y = int(r, v.years[0], v.years[1])
      const costs = costsFor(
        v,
        (I) => ((I * A * Y) / 100) % 100 === 0 && !readsOff(A, [I]),
        () => true,
      )
      if (!costs.length) return null
      const I = pick(r, costs)
      const xs = yearly(r, (I * A * Y) / 100, Y, shape)
      return xs ? { A, Y, I, xs } : null
    },
    (x) => !!x && x.A * x.Y !== 100 && x.A !== x.Y && !readsOff(x.A, x.xs) && !x.xs.includes(x.I) && !yearlyWrong(x.I, x.xs).flatMap(typed).includes(x.A),
  )!
  const { Y, I, xs } = x
  const S = xs.reduce((a, b) => a + b, 0)
  const P = S / Y
  const answer = averageRateOfReturn(I, S, Y)
  const G = (n: number) => texGbp(n, s)
  const M = (n: number) => texNum(n, s)
  return numericDraft(
    slot,
    {
      prompt: pick(r, YEARLY_PROMPTS)(v, gbp(I, s), xs.map((p) => gbp(p, s))),
      solution:
        `Total profit $= ${xs.map(M).join(' + ')} = ${G(S)}$. Average annual profit $= ${M(S)} \\div ${Y} = ${G(P)}$. ` +
        `Average rate of return $=$ average annual profit $\\div$ cost of investment $\\times 100 = ${M(P)} \\div ${M(I)} \\times 100 = ${show(answer)}\\%$. ` +
        `The figures given are already profits, so the ${gbp(I, s)} cost is not subtracted from them again.`,
      method: [`$${M(S)} \\div ${Y} = ${M(P)}$`, `$${M(P)} \\div ${M(I)} \\times 100$`],
      answer: roundTo(answer, 9),
    },
    // Second route: the ARR of the cost, for each year, adds up to the yearly profits.
    { agrees: near(answer, x.A) && (I * x.A * Y) / 100 === S, detail: `${x.A}% of ${I} × ${Y} = ${(I * x.A * Y) / 100}; profits add to ${S}` },
    { context: v.name, shape, cost: I, years: Y, profits: xs.join(' '), arr: x.A },
  )
}

// ---------------------------------------------------------------------------------------------
// q26: net profit margin from the accounts
// ---------------------------------------------------------------------------------------------

const ACCOUNTS_PROMPTS = [
  (f: Firm, R: string, C: string, E: string, I: string) =>
    `${f.who} had sales revenue of ${R} last year. Its cost of sales was ${C}, its other operating expenses were ${E} and it paid ${I} in interest. Calculate its net profit margin.`,
  (f: Firm, R: string, C: string, E: string, I: string) =>
    `Last year ${low(f.who)} had sales revenue of ${R}, cost of sales of ${C}, other operating expenses of ${E} and interest of ${I}. Calculate its net profit margin.`,
  (f: Firm, R: string, C: string, E: string, I: string) =>
    `${its(f)} accounts for last year show sales revenue of ${R}, cost of sales of ${C}, other operating expenses of ${E} and interest paid of ${I}. Calculate its net profit margin.`,
]

/**
 * The wrong routes for q26, as typed: net profit ÷ gross profit; interest left out; the gross
 * margin; the cost of sales as a share of revenue; all the costs as a share of revenue.
 */
export const accountsWrong = (R: number, C: number, E: number, I: number) => {
  const GP = R - C
  const NP = GP - E - I
  return [(NP / GP) * 100, ((GP - E) / R) * 100, (GP / R) * 100, (C / R) * 100, ((E + I) / R) * 100, ((GP - I) / R) * 100]
}

/**
 * q26: gross profit, then net profit, then ÷ revenue × 100, 3 marks. Written: a clothing shop,
 * £320,000 − £140,000 − £110,000 − £6,000 = £64,000, 20%. The net margin first, then a revenue on
 * which it gives whole thousands, then a gross margin at least 15 points above it.
 */
function accountsQ(r: Rng, slot: Question): Draft {
  const s = styleOf(slot)
  const f = pick(r, FIRMS)
  const n = pick(r, netMargins(f).filter((m) => accountsRevenues(f, m).length > 0))
  const R = pick(r, accountsRevenues(f, n))
  const NP = (R * n) / 100
  const x = draw(
    r,
    (r) => {
      const g = int(r, Math.max(f.gross[0], n + 15), f.gross[1])
      const C = toStep((R * (100 - g)) / 100, 1000)
      // Interest of 0.6% to 3% of sales, to the nearest £500: enough that leaving it out changes the whole-number margin.
      const I = toStep(R * between(r, 0.006, 0.03), 500)
      return { C, I, E: R - C - NP - I }
    },
    (x) => 2 * x.C !== R && x.C !== x.E && x.I >= 1000 && x.I / R >= 0.006 && x.E > 2 * x.I && x.E >= 0.1 * R && !readsOff(n, [R, x.C, x.E, x.I]) && !accountsWrong(R, x.C, x.E, x.I).flatMap(typed).includes(n),
  )
  const { C, I, E } = x
  const GP = grossProfit(R, C)
  const net = GP - E - I
  const answer = netMargin(net, R)
  const M = (v: number) => texNum(v, s)
  const G = (v: number) => texGbp(v, s)
  return numericDraft(
    slot,
    {
      prompt: pick(r, ACCOUNTS_PROMPTS)(f, gbp(R, s), gbp(C, s), gbp(E, s), gbp(I, s)),
      solution:
        `Gross profit $=$ sales revenue $-$ cost of sales $= ${M(R)} - ${M(C)} = ${G(GP)}$. ` +
        `Net profit $=$ gross profit $-$ other operating expenses and interest $= ${M(GP)} - ${M(E)} - ${M(I)} = ${G(net)}$. ` +
        `Net profit margin $=$ net profit $\\div$ sales revenue $\\times 100 = ${M(net)} \\div ${M(R)} \\times 100 = ${show(answer)}\\%$. ` +
        'Gross first, then net, then divide by sales revenue, not by gross profit.',
      method: [`$${M(R)} - ${M(C)} = ${M(GP)}$`, `$${M(GP)} - ${M(E)} - ${M(I)} = ${M(net)}$`],
      answer: roundTo(answer, 9),
    },
    // Second route: that margin of the revenue, with every cost, adds back to the revenue.
    { agrees: near(answer, n) && (R * n) / 100 + C + E + I === R && net === NP, detail: `${n}% of ${R} + ${C} + ${E} + ${I} = ${(R * n) / 100 + C + E + I}` },
    { context: f.name, revenue: R, costOfSales: C, expenses: E, interest: I, netProfit: net, margin: n },
  )
}

// ---------------------------------------------------------------------------------------------

export const grossProfitGenerator = businessBySlot('finance-gross-profit', TOPIC, { q2: grossProfitQ })
export const grossMarginGenerator = businessBySlot('finance-gross-profit-margin', TOPIC, { q4: grossMarginQ })
export const netProfitGenerator = businessBySlot('finance-net-profit', TOPIC, { q5: netProfitQ })
export const netMarginGenerator = businessBySlot('finance-net-profit-margin', TOPIC, { q6: netMarginQ })
export const arrTotalGenerator = businessBySlot('finance-arr-total-profit', TOPIC, { q7: arrTotalQ })
export const arrReturnGenerator = businessBySlot('finance-arr-from-returns', TOPIC, { q11: arrReturnQ })
export const profitChangeGenerator = businessBySlot('finance-profit-percentage-change', TOPIC, { q24: profitChangeQ })
export const arrYearlyGenerator = businessBySlot('finance-arr-yearly-profits', TOPIC, { q25: arrYearlyQ })
export const accountsGenerator = businessBySlot('finance-net-margin-from-accounts', TOPIC, { q26: accountsQ })

export const financeGenerators: Generator[] = [
  grossProfitGenerator,
  grossMarginGenerator,
  netProfitGenerator,
  netMarginGenerator,
  arrTotalGenerator,
  arrReturnGenerator,
  profitChangeGenerator,
  arrYearlyGenerator,
  accountsGenerator,
]

