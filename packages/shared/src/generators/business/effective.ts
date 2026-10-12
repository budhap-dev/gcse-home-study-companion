// Business (Edexcel 1BS0) generators: 1.4 Making the business effective.
import type { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import type { Draft, Generator } from '../types.ts'
import { breakEven, businessBySlot, gbp, near, num, numericDraft, profit, revenue, stepped, steps, styleOf, texGbp, texNum, totalCosts, type Style } from './build.ts'

/**
 * Making the business effective (Edexcel 1BS0 Topic 1.4). Three numeric written slots, one
 * generator each:
 *
 * - q31, a franchise royalty (1.4.1, the advantages and disadvantages of franchising): a
 *   percentage of revenue (Appendix 2, percentages).
 * - q32, the break-even output a business plan forecasts (1.4.4, forecast revenue, cost and
 *   profit; the role of the plan in minimising risk): the Appendix 3 break-even formula.
 * - q33, two locations compared by profit (1.4.2, proximity to the market): revenue, total
 *   costs and profit (Appendix 2 and 3) for each site, then the difference.
 *
 * Every figure prints in the written question's own style (`styleOf`): all three use spaces.
 */
const TOPIC = 'making-the-business-effective'

/** A percentage as the decimal a calculator takes: 8 → 0.08, 5.5 → 0.055. */
const decimal = (percent: number) => show(percent / 100)
/** lo and hi rounded inwards to multiples of `step`, for `stepped` when a bound is computed. */
const within = (lo: number, hi: number, step: number) => [Math.ceil(lo / step) * step, Math.floor(hi / step) * step] as const

// ---------------------------------------------------------------------------------------------
// q31: a franchise royalty
// ---------------------------------------------------------------------------------------------

interface Franchise {
  name: string
  /** The franchisee, starting a sentence. */
  who: string
  /** A year's revenue, in pounds, for one outlet of this kind. */
  revenue: [number, number]
  /** Royalty rates, as a percentage of revenue, franchisors of this kind charge. */
  rates: number[]
}
/**
 * Royalties are a share of revenue, 4% to 12% in UK franchising: food and fitness at the lower
 * end, services with low running costs higher. Never 10%, which only moves the point.
 */
const FRANCHISES: Franchise[] = [
  { name: 'franchisee', who: 'A franchisee', revenue: [80000, 400000], rates: [5, 6, 7, 8, 9] },
  { name: 'coffee shop', who: 'A coffee-shop franchisee', revenue: [150000, 450000], rates: [5, 6, 7, 8] },
  { name: 'sandwich bar', who: 'A sandwich-bar franchisee', revenue: [120000, 350000], rates: [5, 6, 6.5, 7, 8] },
  { name: 'gym', who: 'A gym franchisee', revenue: [200000, 700000], rates: [4, 4.5, 5, 6, 7] },
  { name: 'pizza takeaway', who: 'A pizza-takeaway franchisee', revenue: [200000, 600000], rates: [5, 5.5, 6, 7.5] },
  { name: 'home cleaning', who: 'A home-cleaning franchisee', revenue: [60000, 250000], rates: [7, 8, 9, 12] },
  { name: 'tutoring', who: 'A tutoring franchisee', revenue: [50000, 200000], rates: [8, 9, 12] },
  { name: 'estate agency', who: 'An estate-agency franchisee', revenue: [150000, 500000], rates: [6, 7.5, 8, 9] },
]
const YEARS = ['first', 'second', 'third', 'fourth']

const ROYALTY_PROMPTS = [
  (f: Franchise, rate: string, rev: string, year: string) =>
    `${f.who} pays the franchisor a royalty of ${rate}% of its revenue each year. In its ${year} year the franchisee's revenue was ${rev}. Calculate the royalty paid to the franchisor for the year.`,
  (f: Franchise, rate: string, rev: string, year: string) =>
    `${f.who} must pay the franchisor ${rate}% of its revenue each year as a royalty. Its revenue in its ${year} year of trading was ${rev}. Calculate the royalty it paid to the franchisor that year.`,
]

function royalty(r: Rng, slot: Question): Draft {
  const style = styleOf(slot)
  const f = pick(r, FRANCHISES)
  const rate = pick(r, f.rates)
  // Revenue in steps of £5000, so the royalty is whole: rate × 2 is whole and 5000 ÷ 200 is too.
  const R = stepped(r, f.revenue[0], f.revenue[1], 5000)
  const answer = rate * 2 * (R / 200)
  const year = pick(r, YEARS)
  const prompt = pick(r, ROYALTY_PROMPTS)(f, show(rate), gbp(R, style), year)
  return numericDraft(
    slot,
    {
      prompt,
      solution:
        `Royalty $= ${show(rate)}\\% \\times ${texNum(R, style)} = ${decimal(rate)} \\times ${texNum(R, style)} = ${texGbp(answer, style)}$. ` +
        'The royalty is paid on revenue, not on profit, so the franchisee owes it whether or not the year was profitable; that ongoing payment is one of the disadvantages of franchising, set against the benefits of a known brand and a proven way of operating.',
      method: [`$${decimal(rate)} \\times ${texNum(R, style)}$`],
      answer,
      line: gbp(answer, style),
    },
    // Second route: the royalty as a share of the revenue gives the rate back.
    { agrees: near((answer / R) * 100, rate) && Number.isInteger(answer), detail: `${answer} ÷ ${R} × 100 = ${show((answer / R) * 100)}%` },
    { context: f.name, rate, revenue: R, year, royalty: answer },
  )
}

export const franchiseRoyalty = businessBySlot('business-franchise-royalty', TOPIC, { q31: royalty })

// ---------------------------------------------------------------------------------------------
// q32: break-even in a business plan
// ---------------------------------------------------------------------------------------------

/**
 * The written slot's unit is candles, so every version is a candle maker. Candles sell for £8 to
 * £40; the wax, wick and jar are 30% to 70% of the price; a new maker breaks even at 300 to 5000
 * candles a year, on fixed costs of £5000 to £60 000.
 */
export const CANDLES = { price: [8, 40], share: [0.3, 0.7], breakEven: [300, 5000], fixed: [5000, 60000], contribution: [4, 20] } as const

const CANDLE_PROMPTS = [
  (F: string, P: string, V: string) =>
    `A business plan for a new candle maker forecasts fixed costs of ${F} a year. Each candle will sell for ${P} and its variable cost will be ${V}. Calculate the break-even level of output for the year.`,
  (F: string, P: string, V: string) =>
    `A start-up that makes scented candles is writing its business plan. It forecasts fixed costs of ${F} for the year, a selling price of ${P} a candle and a variable cost of ${V} a candle. Calculate the number of candles it must sell in the year to break even.`,
  (F: string, P: string, V: string) =>
    `The business plan for a new candle-making business shows forecast fixed costs of ${F} a year. It plans to sell each candle for ${P}, and the wax, wick and jar for each candle will cost ${V}. Calculate the break-even level of output for the year.`,
]

function candleBreakEven(r: Rng, slot: Question): Draft {
  const style = styleOf(slot)
  const x = draw(
    r,
    (r) => {
      // The contribution first, then a variable cost that keeps the price and its share in range,
      // then the answer from the break-even outputs whose fixed costs stay in range.
      const C = int(r, CANDLES.contribution[0], CANDLES.contribution[1])
      const vLo = Math.max(2, Math.ceil((CANDLES.share[0] * C) / (1 - CANDLES.share[0])), CANDLES.price[0] - C)
      const vHi = Math.min(Math.floor((CANDLES.share[1] * C) / (1 - CANDLES.share[1])), CANDLES.price[1] - C)
      // Never a variable cost equal to the contribution: fixed ÷ variable cost would pay.
      const vs = steps(vLo, vHi, 1).filter((v) => v !== C)
      const V = pick(r, vs)
      const B = stepped(r, ...within(Math.max(CANDLES.breakEven[0], CANDLES.fixed[0] / C), Math.min(CANDLES.breakEven[1], CANDLES.fixed[1] / C), 100), 100)
      return { C, V, P: V + C, B, F: B * C }
    },
    // No printed figure equal to the answer.
    (x) => ![x.P, x.V, x.C].includes(x.B),
  )
  const { C, V, P, F } = x
  const answer = breakEven(F, P, V)
  const prompt = pick(r, CANDLE_PROMPTS)(gbp(F, style), gbp(P, style), gbp(V, style))
  const at = (q: number) => profit(revenue(P, q), totalCosts(F, V, q))
  return numericDraft(
    slot,
    {
      prompt,
      solution:
        `Break-even output $= \\dfrac{\\text{fixed costs}}{\\text{sales price} - \\text{variable cost}} = \\dfrac{${texNum(F, style)}}{${P} - ${V}} = \\dfrac{${texNum(F, style)}}{${C}} = ${answer}$ candles. ` +
        `Below ${num(answer, style)} the plan shows a loss; above it, every candle adds £${C} towards profit. A forecast like this is how a business plan minimises risk: the owner learns before opening how many candles must be sold.`,
      method: [`$${P} - ${V} = ${C}$`, `$${texNum(F, style)} \\div ${C}$`],
      answer,
      line: `${num(answer, style)} candles`,
    },
    // Second route: revenue equals total costs at the answer, and one candle fewer makes a loss.
    { agrees: at(answer) === 0 && at(answer - 1) < 0 && Number.isInteger(answer), detail: `profit at ${answer} = ${at(answer)}, at ${answer - 1} = ${at(answer - 1)}` },
    { fixed: F, price: P, variable: V, contribution: C, breakEven: answer },
  )
}

export const candleBreakEvenGenerator = businessBySlot('business-plan-break-even', TOPIC, { q32: candleBreakEven })

// ---------------------------------------------------------------------------------------------
// q33: two locations compared by profit
// ---------------------------------------------------------------------------------------------

interface Shop {
  name: string
  /** The business, starting a sentence. */
  who: string
  items: string
  /** What the site is expected to do with them: sell, carry out. */
  verb: string
  /** The sentence stating price and cost. */
  each: (P: string, V: string) => string
  /** The cost line's name in the working: flowers, ingredients. */
  cost: string
  price: [number, number]
  /** The cost per item as a share of its price. */
  share: [number, number]
  /** Items a month at the out-of-town site, and the extra the town centre brings. */
  out: [number, number]
  extra: [number, number]
  step: number
  /** Monthly rents, in pounds. */
  rentOut: [number, number]
  rentTown: [number, number]
}

/**
 * Small single-site businesses, each with prices in its real range and a month's work one site
 * could do: a florist's bouquets at £20 to £45, a sandwich bar's 1500 to 5000 sandwiches.
 */
export const SHOPS: Shop[] = [
  {
    name: 'florist', who: 'A florist', items: 'bouquets', verb: 'sell', cost: 'flowers',
    each: (P, V) => `Each bouquet sells for ${P} and its flowers cost ${V}.`,
    price: [20, 45], share: [0.3, 0.5], out: [150, 400], extra: [50, 250], step: 10, rentOut: [400, 1500], rentTown: [1000, 3500],
  },
  {
    name: 'sandwich bar', who: 'A sandwich bar', items: 'sandwiches', verb: 'sell', cost: 'ingredients',
    each: (P, V) => `Each sandwich sells for ${P} and its ingredients cost ${V}.`,
    price: [5, 9], share: [0.2, 0.5], out: [1500, 3500], extra: [300, 1500], step: 10, rentOut: [800, 2000], rentTown: [1800, 5000],
  },
  {
    name: 'hairdresser', who: 'A hairdresser', items: 'haircuts', verb: 'carry out', cost: 'products',
    each: (P, V) => `Each haircut is charged at ${P} and uses products costing ${V}.`,
    price: [18, 45], share: [0.08, 0.2], out: [200, 450], extra: [50, 200], step: 10, rentOut: [500, 1500], rentTown: [1200, 3500],
  },
  {
    name: 'phone repair', who: 'A phone-repair business', items: 'repairs', verb: 'carry out', cost: 'parts',
    each: (P, V) => `Each repair is charged at ${P} and its parts cost ${V}.`,
    price: [40, 90], share: [0.3, 0.55], out: [80, 250], extra: [40, 150], step: 10, rentOut: [400, 1200], rentTown: [900, 3000],
  },
  {
    name: 'cake maker', who: 'A bakery that makes celebration cakes', items: 'cakes', verb: 'sell', cost: 'ingredients',
    each: (P, V) => `Each cake sells for ${P} and its ingredients cost ${V}.`,
    price: [20, 40], share: [0.25, 0.45], out: [80, 250], extra: [40, 150], step: 10, rentOut: [400, 1200], rentTown: [900, 3000],
  },
]

interface Sites {
  P: number
  V: number
  C: number
  Q1: number
  Q2: number
  R1: number
  R2: number
  D: number
}

/** The answer between £50 and £2000 a month, in steps that keep the rent difference a multiple of £50. */
const ANSWER = [50, 2000] as const
const MIN_PROFIT = 200
const MIN_COST = 2

/** Each cost per item, with the prices it is the right share of; never half the price. */
export function costsOf(s: Shop): Map<number, number[]> {
  const out = new Map<number, number[]>()
  for (const P of steps(s.price[0], s.price[1], 1)) {
    for (const V of steps(Math.max(MIN_COST, Math.ceil(P * s.share[0])), Math.floor(P * s.share[1]), 1)) {
      if (2 * V !== P) out.set(V, [...(out.get(V) ?? []), P])
    }
  }
  return out
}

function sites(r: Rng, s: Shop, townBetter: boolean): Sites | null {
  // The cost per item first, evenly, then a price it fits: drawing the price first left the
  // sandwich bar's ingredients at £2 in three builds in four. At least £2 an item: a £1 cost
  // locked its working to one shape.
  const byCost = costsOf(s)
  const V = pick(r, [...byCost.keys()])
  const P = pick(r, byCost.get(V)!)
  const C = P - V
  const Q2 = stepped(r, s.out[0], s.out[1], s.step)
  const dQ = stepped(r, s.extra[0], s.extra[1], s.step)
  const X = dQ * C
  // The rent difference runs from £200 to the widest the two ranges allow, in steps of £50, so
  // the answer is X − ΔR (town better) or ΔR − X (out of town better): drawn evenly from the
  // answers that leave ΔR in range.
  const dRlo = Math.max(200, s.rentTown[0] - s.rentOut[1])
  const dRhi = s.rentTown[1] - s.rentOut[0]
  const answers = steps(ANSWER[0], ANSWER[1], 10).filter((d) => {
    const dR = townBetter ? X - d : X + d
    return dR % 50 === 0 && dR >= dRlo && dR <= dRhi
  })
  if (!answers.length) return null
  const D = pick(r, answers)
  const dR = townBetter ? X - D : X + D
  // The out-of-town rent, keeping the town rent in its range and both sites in profit.
  const lo = Math.max(s.rentOut[0], s.rentTown[0] - dR)
  const hi = Math.min(s.rentOut[1], s.rentTown[1] - dR, Q2 * C - MIN_PROFIT, (Q2 + dQ) * C - dR - MIN_PROFIT)
  if (Math.floor(hi / 50) < Math.ceil(lo / 50)) return null
  const R2 = stepped(r, ...within(lo, hi, 50), 50)
  return { P, V, C, Q1: Q2 + dQ, Q2, R1: R2 + dR, R2, D }
}

/** Every figure a student could stop at or misread: none may equal the answer. */
export function siteFigures(x: Sites) {
  const p1 = x.Q1 * x.C - x.R1
  const p2 = x.Q2 * x.C - x.R2
  const dQ = x.Q1 - x.Q2
  const dR = x.R1 - x.R2
  return {
    printed: [x.P, x.V, x.Q1, x.Q2, x.R1, x.R2],
    working: [x.C, dQ, dR, p1, p2, x.Q1 * x.P, x.Q2 * x.P, x.Q1 * x.V, x.Q2 * x.V],
    // Rents forgotten (the extra contribution alone); costs per item forgotten (revenue less
    // rent); revenue alone; the rent difference added instead of taken away.
    wrong: { noRent: dQ * x.C, noCosts: Math.abs(dQ * x.P - dR), revenueOnly: dQ * x.P, rentAdded: dQ * x.C + dR, rentOnly: dR },
  }
}

const SITE_PROMPTS = [
  (s: Shop, x: Sites, style: Style, townBetter: boolean) =>
    `${s.who} is choosing between two units. A town-centre unit has rent of ${gbp(x.R1, style)} a month and is expected to ${s.verb} ${num(x.Q1, style)} ${s.items} a month. ` +
    `An out-of-town unit has rent of ${gbp(x.R2, style)} a month and is expected to ${s.verb} ${num(x.Q2, style)} ${s.items} a month. ${s.each(gbp(x.P, style), gbp(x.V, style))} ` +
    `Calculate how much more profit a month the ${townBetter ? 'town-centre unit is expected to make than the out-of-town unit' : 'out-of-town unit is expected to make than the town-centre unit'}.`,
  (s: Shop, x: Sites, style: Style, townBetter: boolean) =>
    `${s.who} must choose where to open. In the town centre the rent would be ${gbp(x.R1, style)} a month and it expects to ${s.verb} ${num(x.Q1, style)} ${s.items} a month. ` +
    `On an out-of-town retail park the rent would be ${gbp(x.R2, style)} a month and it expects to ${s.verb} ${num(x.Q2, style)} ${s.items} a month. ${s.each(gbp(x.P, style), gbp(x.V, style))} ` +
    `Calculate how much more profit a month it would expect to make ${townBetter ? 'in the town centre than out of town' : 'out of town than in the town centre'}.`,
]

function comparingSites(r: Rng, slot: Question): Draft {
  const style = styleOf(slot)
  // The business and which site wins, outside the draw, so a rare case is never rerolled away.
  const s = pick(r, SHOPS)
  const townBetter = r() < 0.5
  const x = draw(
    r,
    (r) => sites(r, s, townBetter),
    (x): x is Sites => {
      if (!x) return false
      const f = siteFigures(x)
      return ![...f.printed, ...f.working, ...Object.values(f.wrong)].includes(x.D)
    },
  )!
  const site = (q: number, rent: number) => {
    const rev = revenue(x.P, q)
    const cost = x.V * q
    // The working subtracts the costs and the rent from revenue; the profit itself comes from the formulae.
    return { rev, cost, profit: profit(rev, totalCosts(rent, x.V, q)), line: `${texNum(rev, style)} - ${texNum(cost, style)} - ${texNum(rent, style)}`, raw: rev - cost - rent }
  }
  const town = site(x.Q1, x.R1)
  const out = site(x.Q2, x.R2)
  const answer = townBetter ? town.profit - out.profit : out.profit - town.profit
  const [hi, lo] = townBetter ? [town, out] : [out, town]
  const dQ = x.Q1 - x.Q2
  const dR = x.R1 - x.R2
  const X = dQ * x.C
  const working = (name: string, q: number, s2: typeof town) =>
    `${name}: revenue $= ${texNum(q, style)} \\times ${x.P} = ${texGbp(s2.rev, style)}$; ${s.cost} $= ${texNum(q, style)} \\times ${x.V} = ${texGbp(s2.cost, style)}$; profit $= ${s2.line} = ${texGbp(s2.profit, style)}$.`
  const close = townBetter
    ? `Being close to the market brings ${num(dQ, style)} extra ${s.items} a month, worth ${gbp(X, style)} after ${s.cost}, which more than covers the extra ${gbp(dR, style)} of rent.`
    : `The town centre brings ${num(dQ, style)} extra ${s.items} a month, but they add only ${gbp(X, style)} after ${s.cost}, less than the extra ${gbp(dR, style)} of rent, so the busier site is the less profitable one.`
  return numericDraft(
    slot,
    {
      prompt: pick(r, SITE_PROMPTS)(s, x, style, townBetter),
      solution:
        `${working('Town centre', x.Q1, town)} ${working('Out of town', x.Q2, out)} ` +
        `Difference $= ${texNum(hi.profit, style)} - ${texNum(lo.profit, style)} = ${texGbp(answer, style)}$ a month more ${townBetter ? 'in the town centre' : 'out of town'}. ${close}`,
      method: [`town-centre profit $${town.line} = ${texNum(town.profit, style)}$`, `out-of-town profit $${out.line} = ${texNum(out.profit, style)}$`],
      answer,
      line: gbp(answer, style),
    },
    // Second route: the extra contribution from the busier site against the extra rent.
    { agrees: answer === (townBetter ? X - dR : dR - X) && answer > 0 && town.raw === town.profit && out.raw === out.profit, detail: `${dQ} × ${x.C} = ${X}; rent difference ${dR}` },
    { context: s.name, townBetter: townBetter ? 'town' : 'out', price: x.P, cost: x.V, townSales: x.Q1, outSales: x.Q2, townRent: x.R1, outRent: x.R2, difference: answer },
  )
}

export const comparingSitesGenerator = businessBySlot('business-location-profit', TOPIC, { q33: comparingSites })

export const effectiveGenerators: Generator[] = [franchiseRoyalty, candleBreakEvenGenerator, comparingSitesGenerator]

/** For the tests. */
export const EFFECTIVE = { FRANCHISES, SHOPS, CANDLES, ANSWER, MIN_PROFIT, MIN_COST }
