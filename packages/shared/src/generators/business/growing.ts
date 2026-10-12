import { show } from '../format.ts'
import { draw, pick } from '../random.ts'
import type { Generator } from '../types.ts'
import { businessBySlot, byKey, gbp, interestPercent, marketShare, near, num, numericDraft, percentChange, powerOfTen, readsOff, steps, styleOf, texNum, texPounds } from './build.ts'

/**
 * Business (Edexcel 1BS0) generators: Topic 2.1, growing the business. Eight numeric written
 * slots, one generator each; none is left written.
 *
 * - 2.1.1 sources of finance for growing and established businesses. Internal (retained profit,
 *   selling assets): retained profit (q4) and the shortfall left to raise externally (q14), both
 *   subtraction of Appendix 2 "revenue, costs and profit". External, share capital and stock
 *   market flotation: what a flotation raises (q6, Appendix 2 "calculations in a business
 *   context") and the founders' percentage of the shares afterwards (q27, Appendix 2
 *   "percentages and percentage changes"). Loan capital: interest as a percentage of the amount
 *   borrowed (q25, Appendix 3 "Interest (on loans)", `interestPercent`).
 * - 2.1.1 business growth: the percentage growth in revenue (q11, Appendix 2 "percentages and
 *   percentage changes", `percentChange`).
 * - 2.1.3 globalisation. Barriers to international trade, tariffs: a tariff as a percentage of
 *   the goods' value (q9, Appendix 2 "percentages and percentage changes"). Imports, competition
 *   from overseas: imports' share of the UK market (q26, Appendix 2 "market data, including
 *   market share", `marketShare`).
 *
 * Tariffs are 2% to 25% (never 10%, which only moves the point); loan interest 8% to 35% of the
 * amount borrowed over the life of a loan (from 8%, interest over the total repaid never rounds to
 * the answer); revenue growth 8% to 60% a year; dividends 20% to 75% of profit after tax (never
 * 50%, where retained profit and dividends are equal); founders keep 55% to 90% (above 90%, 100
 * less the issue as a percentage of the old holding rounds to the answer).
 */
const TOPIC = 'growing-the-business'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
/** Ranges with a step, cleaned of powers of ten (£1 000 000 turns a division into moving the point). */
const range = ([lo, hi]: readonly [number, number], step: number) => steps(lo, hi, step).filter((x) => !powerOfTen(x))

// ---------------------------------------------------------------------------------------------
// q4: retained profit
// ---------------------------------------------------------------------------------------------

interface Company {
  name: string
  /** As the prompt opens: "a chain of gyms". */
  who: string
  /** Profit after tax a year, in pounds. */
  profit: [number, number]
}
const COMPANIES: Company[] = [
  { name: 'business', who: 'a business', profit: [200000, 2000000] },
  { name: 'gyms', who: 'a chain of gyms', profit: [300000, 3000000] },
  { name: 'software', who: 'a software company', profit: [400000, 6000000] },
  { name: 'food', who: 'a food manufacturer', profit: [500000, 5000000] },
  { name: 'hotels', who: 'a hotel group', profit: [300000, 4000000] },
]
/** Dividends as a percentage of profit after tax; never 50, where the two halves are equal. */
const PAYOUTS = steps(20, 75, 5).filter((p) => p !== 50)

/** q4: profit after tax − dividends, 1 mark. Written: £600,000 and £250,000, £350,000. */
const retained = businessBySlot('growing-retained-profit', TOPIC, {
  q4(r, slot) {
    const s = styleOf(slot)
    const c = pick(r, COMPANIES)
    const payout = pick(r, PAYOUTS)
    // Profit in £20,000s, so the dividends come in whole thousands.
    const P = pick(r, range(c.profit, 20000).filter((p) => !readsOff(p - (p * payout) / 100, [p, (p * payout) / 100])))
    const D = (P * payout) / 100
    const R = P - D
    const prompt = pick(r, [
      () => `${cap(c.who)} makes ${gbp(P, s)} profit after tax and pays ${gbp(D, s)} in dividends. What is its retained profit, in pounds?`,
      () => `${cap(c.who)} made a profit after tax of ${gbp(P, s)} last year and paid ${gbp(D, s)} of it to its shareholders as dividends. Calculate its retained profit, in pounds.`,
      () => `Last year ${c.who} made ${gbp(P, s)} profit after tax. It paid out ${gbp(D, s)} in dividends to its shareholders. What was its retained profit, in pounds?`,
    ])()
    return numericDraft(
      slot,
      {
        prompt,
        solution: `${gbp(P, s)} − ${gbp(D, s)} = **${gbp(R, s)}**. Retained profit is what is left after tax and after dividends; it is an internal source of finance the business can spend on growth without borrowing or selling shares.`,
        method: [],
        answer: R,
        line: String(R),
      },
      // Second route: the share of profit kept, applied to the profit.
      { agrees: R + D === P && near((P * (100 - payout)) / 100, R), detail: `${P} × ${show((100 - payout) / 100)} = ${show((P * (100 - payout)) / 100)}` },
      { context: c.name, profit: P, dividends: D, payout },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// q6: what a flotation raises
// ---------------------------------------------------------------------------------------------

const FLOATERS: { name: string; who: string }[] = [
  { name: 'business', who: 'A business' },
  { name: 'retailer', who: 'A fashion retailer' },
  { name: 'games', who: 'A games developer' },
  { name: 'engineering', who: 'An engineering company' },
  { name: 'brewery', who: 'A brewery' },
]
/**
 * Shares in quarter-millions, 1 to 8 million; prices 50p to £4 in 5p steps, never £1 (the answer
 * would be the shares): a small flotation of £2 million to £32 million, near the written £3.5 million.
 */
const FLOAT_SHARES = range([1000000, 8000000], 250000)
const FLOAT_PENCE = steps(50, 400, 5).filter((p) => p !== 100)

/** q6: shares × price per share, 2 marks. Written: 2,000,000 at £1.75, £3,500,000. */
const flotation = businessBySlot('growing-flotation-raised', TOPIC, {
  q6(r, slot) {
    const s = styleOf(slot)
    const c = pick(r, FLOATERS)
    const n = pick(r, FLOAT_SHARES)
    // At least £2 million raised: a flotation is not worth its costs for less.
    const pence = pick(r, FLOAT_PENCE.filter((p) => (n / 100) * p >= 2000000))
    const price = pence / 100
    const A = (n / 100) * pence
    const prompt = pick(r, [
      () => `${c.who} floats ${num(n, s)} shares at ${gbp(price, s)} each. How much does the flotation raise, in pounds?`,
      () => `${c.who} becomes a public limited company and sells ${num(n, s)} shares to the public at ${gbp(price, s)} each when it floats on the stock market. Calculate how much the flotation raises, in pounds.`,
    ])()
    return numericDraft(
      slot,
      {
        prompt,
        solution: `${num(n, s)} × ${gbp(price, s)} = **${gbp(A, s)}**. This is share capital, an external source of finance: it never has to be repaid, but the new shareholders now own part of the company.`,
        method: [`multiplies ${num(n, s)} shares by ${gbp(price, s)} per share`],
        answer: A,
        line: String(A),
      },
      // Second route: the money raised shared among the shares is the price.
      { agrees: near(A / n, price) && Number.isInteger(A), detail: `${A} ÷ ${n} = ${show(A / n)}` },
      { context: c.name, shares: n, price },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// q9: a tariff on an export
// ---------------------------------------------------------------------------------------------

interface Export {
  name: string
  /** "A product worth £900 is exported to a country that charges a tariff of 12%." */
  text: (v: string, p: number) => string
  value: [number, number]
  step: number
}
const EXPORTS: Export[] = [
  { name: 'product', text: (v, p) => `A product worth ${v} is exported to a country that charges a tariff of ${p}%.`, value: [200, 3000], step: 50 },
  { name: 'sofa', text: (v, p) => `A UK furniture maker exports a sofa worth ${v} to a country that charges a tariff of ${p}% on imported furniture.`, value: [600, 3000], step: 50 },
  { name: 'whisky', text: (v, p) => `A Scottish distillery exports a case of whisky worth ${v} to a country that charges a tariff of ${p}% on imported spirits.`, value: [300, 2000], step: 25 },
  { name: 'cheese', text: (v, p) => `A UK dairy exports a pallet of cheese worth ${v} to a country that charges a tariff of ${p}% on imported cheese.`, value: [1500, 8000], step: 100 },
  { name: 'guitar', text: (v, p) => `A UK guitar maker exports an electric guitar worth ${v} to a country that charges a tariff of ${p}% on imported instruments.`, value: [400, 3000], step: 50 },
]
const TARIFFS = steps(2, 25, 1).filter((p) => p !== 10)

/** q9: value × rate ÷ 100, 2 marks. Written: £900 at 12%, £108. The rate first, then a value that makes the tariff whole. */
const tariff = businessBySlot('growing-tariff', TOPIC, {
  q9(r, slot) {
    const s = styleOf(slot)
    const c = pick(r, EXPORTS)
    const p = pick(r, TARIFFS)
    const V = pick(r, range(c.value, c.step).filter((v) => Number.isInteger((v * p) / 100) && (v * p) / 100 !== p && !readsOff((v * p) / 100, [v, v + (v * p) / 100])))
    const T = (V * p) / 100
    const ask = pick(r, ['What is the tariff, in pounds?', 'Calculate the tariff on it, in pounds.'])
    return numericDraft(
      slot,
      {
        prompt: `${c.text(gbp(V, s), p)} ${ask}`,
        solution: `${gbp(V, s)} × ${show(p / 100)} = **${gbp(T, s)}**, taking the landed cost to ${gbp(V + T, s)}. A tariff is a tax on imports and a barrier to trade: it makes the goods dearer than those made inside the country.`,
        method: [`finds ${p}% of ${num(V, s)}`],
        answer: T,
        line: String(T),
      },
      // Second route: the landed cost over the value, less one, is the rate.
      { agrees: near(((V + T) / V - 1) * 100, p), detail: `(${V + T} ÷ ${V} − 1) × 100 = ${show(((V + T) / V - 1) * 100)}` },
      { context: c.name, value: V, rate: p },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// q11: percentage growth in revenue
// ---------------------------------------------------------------------------------------------

interface Grower {
  name: string
  who: string
  poss: string
  revenue: [number, number]
}
const GROWERS: Grower[] = [
  { name: 'business', who: 'A business', poss: "A business's", revenue: [1000000, 9000000] },
  { name: 'coffee', who: 'A chain of coffee shops', poss: "A coffee shop chain's", revenue: [800000, 6000000] },
  { name: 'clothing', who: 'An online clothing retailer', poss: "An online clothing retailer's", revenue: [500000, 8000000] },
  { name: 'furniture', who: 'A garden furniture maker', poss: "A garden furniture maker's", revenue: [1000000, 9000000] },
  { name: 'software', who: 'A software company', poss: "A software company's", revenue: [400000, 5000000] },
]
/** From 8%: below it, the increase over the new revenue rounds to the answer. Never 10% or 50%. */
const GROWTH = steps(8, 60, 1).filter((p) => p !== 10 && p !== 50)

/** q11: (new − old) ÷ old × 100, 3 marks. Written: £4,200,000 → £5,460,000, 30%. The percentage first. */
const growth = businessBySlot('growing-revenue-growth', TOPIC, {
  q11(r, slot) {
    const s = styleOf(slot)
    const c = pick(r, GROWERS)
    const p = pick(r, GROWTH)
    // Revenue in £100,000s, so the increase is whole thousands.
    const R1 = pick(r, range(c.revenue, 100000).filter((x) => !readsOff(p, [x, (x * p) / 100, x + (x * p) / 100])))
    const inc = (R1 * p) / 100
    const R2 = R1 + inc
    const prompt = pick(r, [
      () => `${c.who} grows its revenue from ${gbp(R1, s)} to ${gbp(R2, s)} in a year. What is the percentage growth?`,
      () => `${c.poss} revenue rose from ${gbp(R1, s)} last year to ${gbp(R2, s)} this year. Calculate the percentage growth in its revenue.`,
    ])()
    return numericDraft(
      slot,
      {
        prompt,
        solution: `Increase = ${gbp(R2, s)} − ${gbp(R1, s)} = ${gbp(inc, s)}. Percentage = ${gbp(inc, s)} ÷ ${gbp(R1, s)} × 100 = **${p}%**. Growth is measured against the original revenue, not the new one.`,
        method: [`finds the increase of ${inc}`, `divides by the original revenue of ${R1}`],
        answer: p,
        line: String(p),
      },
      // Second route: the old revenue grown by the percentage is the new.
      { agrees: near(R1 * (1 + p / 100), R2) && near(percentChange(R1, R2), p), detail: `${R1} × ${show(1 + p / 100)} = ${show(R1 * (1 + p / 100))}` },
      { context: c.name, before: R1, after: R2, percent: p },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// q14: the shortfall left after internal sources
// ---------------------------------------------------------------------------------------------

interface Project {
  name: string
  what: string
  /** "subtracts from the cost of the factory" */
  short: string
  cost: [number, number]
}
const PROJECTS: Project[] = [
  { name: 'factory', what: 'a new factory', short: 'factory', cost: [1000000, 6000000] },
  { name: 'warehouse', what: 'a second warehouse', short: 'warehouse', cost: [600000, 3000000] },
  { name: 'store', what: 'a new flagship store', short: 'store', cost: [500000, 2500000] },
  { name: 'vans', what: 'a fleet of electric delivery vans', short: 'vans', cost: [300000, 1500000] },
  { name: 'line', what: 'a new production line', short: 'production line', cost: [400000, 2500000] },
]
/** What it sells, and the most such an asset could fetch: old machinery never £2 million. */
const ASSETS: { name: string; most: number }[] = [
  { name: 'an asset', most: Infinity },
  { name: 'some land it no longer needs', most: 3000000 },
  { name: 'an empty building', most: 2000000 },
  { name: 'its old machinery', most: 300000 },
]

/**
 * q14: cost − (retained profit + asset sale), 3 marks. Written: £2,000,000 − (£350,000 +
 * £480,000), £1,170,000. The cost first, then the shortfall (25% to 70% of it, in £10,000s), then
 * the internal sources split 30:70 to 70:30; the two sources, the shortfall and their total all differ.
 */
const shortfall = businessBySlot('growing-finance-shortfall', TOPIC, {
  q14(r, slot) {
    const s = styleOf(slot)
    const c = pick(r, PROJECTS)
    const x = draw(
      r,
      (rr) => {
        const C = pick(rr, range(c.cost, 50000))
        const S = pick(rr, steps(Math.ceil((0.25 * C) / 10000) * 10000, Math.floor((0.7 * C) / 10000) * 10000, 10000))
        const I = C - S
        const R = pick(rr, steps(Math.ceil((0.3 * I) / 10000) * 10000, Math.floor((0.7 * I) / 10000) * 10000, 10000))
        return { C, S, I, R, A: I - R }
      },
      (y) => y.R !== y.A && ![y.R, y.A, y.I].includes(y.S) && !readsOff(y.S, [y.C, y.R, y.A, y.I]),
    )
    const { C, S, I, R, A } = x
    // The asset after the split, among those that could fetch the sum.
    const asset = pick(r, ASSETS.filter((y) => A <= y.most)).name
    const prompt = pick(r, [
      () => `A business needs ${gbp(C, s)} for ${c.what}. It has ${gbp(R, s)} retained profit and sells ${asset} for ${gbp(A, s)}. What is the shortfall it must raise externally, in pounds?`,
      () => `To pay for ${c.what} costing ${gbp(C, s)}, a business will use ${gbp(R, s)} of retained profit and ${gbp(A, s)} from selling ${asset}. Calculate the shortfall it must raise from external sources, in pounds.`,
    ])()
    return numericDraft(
      slot,
      {
        prompt,
        solution: `Internal sources give ${gbp(R, s)} + ${gbp(A, s)} = ${gbp(I, s)}. The shortfall is ${gbp(C, s)} − ${gbp(I, s)} = **${gbp(S, s)}**. It must come from external sources: loan capital, or share capital.`,
        method: [`adds the two internal sources to get ${I}`, `subtracts from the cost of the ${c.short}`],
        answer: S,
        line: String(S),
      },
      // Second route: take each internal source off the cost in turn.
      { agrees: C - R - A === S, detail: `${C} − ${R} − ${A} = ${C - R - A}` },
      { context: c.name, asset, cost: C, retained: R, sold: A },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// q25: interest on loan capital as a percentage of the amount borrowed
// ---------------------------------------------------------------------------------------------

interface Purpose {
  name: string
  /** "to pay for a new warehouse" */
  why: string
  loan: [number, number]
  step: number
}
const PURPOSES: Purpose[] = [
  { name: 'warehouse', why: 'to pay for a new warehouse', loan: [200000, 1500000], step: 10000 },
  { name: 'shop', why: 'to open a second shop', loan: [50000, 400000], step: 5000 },
  { name: 'machinery', why: 'to buy new machinery', loan: [80000, 800000], step: 10000 },
  { name: 'vans', why: 'to buy a fleet of delivery vans', loan: [60000, 500000], step: 5000 },
  { name: 'overseas', why: 'to open its first office overseas', loan: [100000, 800000], step: 10000 },
]
/** Never 10%: the interest would be the loan with the point moved. */
const INTEREST = steps(8, 35, 1).filter((p) => p !== 10)

/** q25: (repaid − borrowed) ÷ borrowed × 100, 2 marks. Written: £500 000 and £575 000, 15%. The percentage first. */
const loanInterest = businessBySlot('growing-loan-interest', TOPIC, {
  q25(r, slot) {
    const s = styleOf(slot)
    const c = pick(r, PURPOSES)
    const pct = pick(r, INTEREST)
    const B = pick(r, range(c.loan, c.step).filter((b) => !readsOff(pct, [b, (b * pct) / 100, b + (b * pct) / 100])))
    const I = (B * pct) / 100
    const R = B + I
    const T = (x: number) => texPounds(x, s)
    const prompt = pick(r, [
      () => `${cap(c.why)}, a business borrows ${gbp(B, s)} from a bank and repays a total of ${gbp(R, s)} over the life of the loan. Calculate the interest on the loan as a percentage of the amount borrowed.`,
      () => `A business takes out a bank loan of ${gbp(B, s)} ${c.why}. Over the life of the loan it repays ${gbp(R, s)} in total. Calculate the interest on the loan as a percentage of the amount borrowed.`,
    ])()
    return numericDraft(
      slot,
      {
        prompt,
        solution:
          `Interest (%) $= \\dfrac{\\text{total repayment} - \\text{amount borrowed}}{\\text{amount borrowed}} \\times 100 = \\dfrac{${T(R)} - ${T(B)}}{${T(B)}} \\times 100 = \\dfrac{${T(I)}}{${T(B)}} \\times 100 = ${pct}\\%$. ` +
          `Loan capital is an external source of finance: the business keeps full ownership, unlike with share capital, but it must find the ${gbp(I, s)} of interest from its profit.`,
        method: [`$(${T(R)} - ${T(B)}) \\div ${T(B)} \\times 100$`],
        answer: pct,
        line: `${pct}%`,
      },
      // Second route: the loan grown by the percentage is the total repaid.
      { agrees: near((B * (100 + pct)) / 100, R) && near(interestPercent(B, R), pct), detail: `${B} × ${show((100 + pct) / 100)} = ${show((B * (100 + pct)) / 100)}` },
      { context: c.name, borrowed: B, repaid: R, percent: pct },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// q26: imports' share of the UK market
// ---------------------------------------------------------------------------------------------

interface Import {
  name: string
  item: string
  /** Units sold in the UK a year, and the step they come in. */
  market: [number, number]
  step: number
  /** The overseas makers' share, as a whole percentage. */
  share: [number, number]
}
const IMPORTS: Import[] = [
  { name: 'scooters', item: 'electric scooters', market: [100000, 600000], step: 10000, share: [20, 85] },
  { name: 'e-bikes', item: 'electric bikes', market: [100000, 500000], step: 10000, share: [25, 85] },
  { name: 'tents', item: 'tents', market: [300000, 1500000], step: 50000, share: [40, 90] },
  { name: 'lawnmowers', item: 'lawnmowers', market: [500000, 1500000], step: 50000, share: [30, 80] },
  { name: 'pianos', item: 'pianos', market: [10000, 40000], step: 1000, share: [40, 95] },
  { name: 'sofas', item: 'sofas', market: [1500000, 4000000], step: 100000, share: [15, 60] },
]

/**
 * q26: overseas sales ÷ the UK market × 100, 2 marks. Written: 72 000 of 240 000, 30%. The share
 * first (never 10% or 50%: at 50% the UK makers' share pays), then a market that makes the
 * overseas sales whole.
 */
const importShare = businessBySlot('growing-import-share', TOPIC, {
  q26(r, slot) {
    const s = styleOf(slot)
    const c = pick(r, IMPORTS)
    const p = pick(r, steps(c.share[0], c.share[1], 1).filter((x) => x !== 10 && x !== 50))
    const M = pick(r, range(c.market, c.step).filter((m) => Number.isInteger((m * p) / 100) && !readsOff(p, [m, (m * p) / 100])))
    const O = (M * p) / 100
    const T = (x: number) => texNum(x, s)
    const prompt = pick(r, [
      () => `Customers in the UK buy ${num(M, s)} ${c.item} a year. Overseas manufacturers now sell ${num(O, s)} of them. Calculate the overseas manufacturers' share of the UK market.`,
      () => `Each year ${num(M, s)} ${c.item} are sold in the UK, and ${num(O, s)} of them are made by overseas manufacturers. Calculate the overseas manufacturers' share of the UK market.`,
    ])()
    return numericDraft(
      slot,
      {
        prompt,
        solution:
          `Market share $= \\dfrac{${T(O)}}{${T(M)}} \\times 100 = ${show(p / 100)} \\times 100 = ${p}\\%$. ` +
          `Competition from overseas is one of the ways globalisation reaches a business through imports: ${p} in every 100 ${c.item} sold in the UK now come from abroad, so UK makers must compete on price, product or service to hold the other ${100 - p}%.`,
        method: [`$${T(O)} \\div ${T(M)} \\times 100$`],
        answer: p,
        line: `${p}%`,
      },
      // Second route: the share of the market gives the overseas sales back.
      { agrees: (M * p) / 100 === O && near(marketShare(O, M), p), detail: `${p}% of ${M} = ${show((M * p) / 100)}` },
      { context: c.name, market: M, overseas: O },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// q27: the founders' percentage after a flotation
// ---------------------------------------------------------------------------------------------

interface Owner {
  name: string
  /** "The two founders of a company own all of its 2 000 000 shares." */
  text: (o: string) => string
  /** "the founders own" */
  ask: string
  /** "Founders' share" */
  label: string
  /** "the founders now own" */
  now: string
  /** "the founders" */
  them: string
}
const OWNERS: Owner[] = [
  { name: 'two founders', text: (o) => `The two founders of a company own all of its ${o} shares.`, ask: 'the founders own', label: "Founders' share", now: 'the founders now own', them: 'the founders' },
  { name: 'three founders', text: (o) => `The three founders of a company own all of its ${o} shares.`, ask: 'the founders own', label: "Founders' share", now: 'the founders now own', them: 'the founders' },
  { name: 'founder', text: (o) => `The founder of a company owns all of its ${o} shares.`, ask: 'the founder owns', label: "Founder's share", now: 'the founder now owns', them: 'the founder' },
  { name: 'family', text: (o) => `A family owns all ${o} shares in the company it started.`, ask: 'the family owns', label: "Family's share", now: 'the family now owns', them: 'the family' },
]

interface Issue {
  a: number
  O: number
  N: number
}
/**
 * Every share the founders keep (55% to 90%) and total after the issue (2 to 36 million, in whole
 * millions, never 10 million): the founders' holding is then a whole number of ten thousands. The
 * issue is at least 250 000, so some price up to £8 raises £2 million; no figure reads off as the answer.
 */
let ISSUES: Issue[] | undefined
function issues(): Issue[] {
  ISSUES ??= steps(55, 90, 1).flatMap((a) =>
    range([2000000, 36000000], 1000000)
      .map((T) => ({ a, O: (a * T) / 100, N: ((100 - a) * T) / 100 }))
      .filter((x) => x.N >= 250000 && x.N !== x.O && !readsOff(a, [x.O, x.N, x.O + x.N]) && issuePrices(a, x.N).length > 0),
  )
  return ISSUES
}
const ISSUE_PENCE = steps(50, 800, 25)
/** Prices that raise at least £2 million on the issue, never the answer with the point moved (£6.50 against 65%). */
const issuePrices = (a: number, N: number) => ISSUE_PENCE.filter((p) => (N / 100) * p >= 2000000 && !readsOff(a, [p / 100]))

/**
 * q27: old ÷ (old + new) × 100, 3 marks. Written: 2 000 000 and 500 000 new, 80%. The founders'
 * percentage first, evenly, then a holding that fits it. Taking the new shares off 100% as a
 * share of the old (500 000 ÷ 2 000 000 = 25%, so 75%) never gives the answer.
 */
const ownership = businessBySlot('growing-flotation-ownership', TOPIC, {
  q27(r, slot) {
    const s = styleOf(slot)
    const c = pick(r, OWNERS)
    const { a, O, N } = byKey(r, issues(), (x) => x.a)
    const pence = pick(r, issuePrices(a, N))
    const price = pence / 100
    const total = O + N
    const raised = (N / 100) * pence
    const T = (x: number) => texNum(x, s)
    return numericDraft(
      slot,
      {
        prompt: `${c.text(num(O, s))} To pay for growth the company floats on the stock market, issuing ${num(N, s)} new shares at ${gbp(price, s)} each to the public. Calculate the percentage of the company's shares ${c.ask} after the flotation.`,
        solution:
          `Shares after the flotation $= ${T(O)} + ${T(N)} = ${T(total)}$. ${c.label} $= \\dfrac{${T(O)}}{${T(total)}} \\times 100 = ${a}\\%$. ` +
          `The flotation raises $${T(N)} \\times ${texPounds(price, s)} = £${texPounds(raised, s)}$ of share capital, and the price of it is that ${c.now} ${a}% rather than everything; an issue of more than ${num(O, s)} new shares would leave ${c.them} with less than half of the shares, and so without control.`,
        method: [`total shares $${T(O)} + ${T(N)} = ${T(total)}$`, `$${T(O)} \\div ${T(total)} \\times 100$`],
        answer: a,
        line: `${a}%`,
      },
      // Second route: the new shareholders' percentage, taken from 100.
      { agrees: near(100 - (N / total) * 100, a) && near((a * total) / 100, O), detail: `100 − ${N} ÷ ${total} × 100 = ${show(100 - (N / total) * 100)}` },
      { context: c.name, held: O, issued: N, price },
    )
  },
})

export const growingGenerators: Generator[] = [retained, flotation, tariff, growth, shortfall, loanInterest, importShare, ownership]

/** For the tests. */
export const GROWING = { COMPANIES, PAYOUTS, FLOATERS, FLOAT_SHARES, FLOAT_PENCE, EXPORTS, TARIFFS, GROWERS, GROWTH, PROJECTS, ASSETS, PURPOSES, INTEREST, IMPORTS, OWNERS, issues, ISSUE_PENCE, issuePrices }
