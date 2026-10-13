import type { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { draw, pick, type Rng } from '../random.ts'
import type { Draft, Generator } from '../types.ts'
import { businessBySlot, gbp, near, num, numericDraft, percentChange, powerOfTen, readsOff, revenue, steps, styleOf, texGbp, texNum, texPounds } from './build.ts'

/**
 * Business (Edexcel 1BS0) generators: Topic 2.2, making marketing decisions. Every numeric written
 * slot in the topic has a generator; none is left written.
 *
 * - 2.2.2 price, pricing strategies: a cost-plus price from a mark-up on cost (q5, q10, one
 *   generator, the same calculation), and the profit each unit earns from that mark-up (q13).
 *   A mark-up is a percentage of the cost (Appendix 2, "percentages and percentage changes");
 *   the specification has no mark-up formula, and Appendix 3 lists none.
 * - 2.2.1 product, extension strategies: the percentage increase in sales after one (q24,
 *   Appendix 2 "percentages and percentage changes"), and the revenue lost when the extension
 *   strategy is a price cut that lifts sales too little (q26, Appendix 3 revenue).
 * - 2.2.2 influences on pricing strategies, market segments: revenue from two segments priced
 *   differently (q25, Appendix 3 revenue = price × quantity, added over the segments).
 *
 * The higher sheet prints q21 (a hotel charging two segments £120 and £80), so q25 never uses a
 * hotel; the advanced sheet prints q17 and q18 (Loom & Last's blankets, £24.00 cost, 25% mark-up,
 * a 10% price cut) and q30 (Oakhill's £9 bags of coffee, cut by 20%), so q13 and q26 use neither
 * blankets nor coffee.
 */
const TOPIC = 'making-marketing-decisions'

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)
/** "an adult ticket", "a child ticket": every segment word here starts with its own sound. */
const an = (s: string) => `${/^[aeiou]/i.test(s) ? 'an' : 'a'} ${s}`

/** A mark-up of `percent`% on a cost, in pence, so the money stays exact (Appendix 2 percentages). */
const markUpPence = (costPence: number, percent: number) => (costPence * percent) / 100

// ---------------------------------------------------------------------------------------------
// q5, q10: selling price from a mark-up
// ---------------------------------------------------------------------------------------------

interface Good {
  name: string
  /** The sentence giving the cost, without its full stop. */
  cost: (C: string) => string
  /** Who sets the price: "business", "shop". */
  seller: string
  /** Cost to make or buy in, in pence (20p steps), and the selling price's real range in pounds. */
  costPence: [number, number]
  price: [number, number]
}
const GOODS: Good[] = [
  { name: 'unit', cost: (C) => `A unit costs ${C} to make`, seller: 'business', costPence: [400, 3000], price: [5, 60] },
  { name: 'candle', cost: (C) => `A scented candle costs ${C} to make`, seller: 'business', costPence: [300, 1200], price: [5, 25] },
  { name: 'mug', cost: (C) => `A hand-painted mug costs ${C} to make`, seller: 'business', costPence: [240, 800], price: [4, 15] },
  { name: 'T-shirt', cost: (C) => `A printed T-shirt costs ${C} to make`, seller: 'business', costPence: [400, 1200], price: [8, 25] },
  { name: 'cushion', cost: (C) => `A cushion costs ${C} to make`, seller: 'business', costPence: [600, 2000], price: [10, 40] },
  { name: 'phone case', cost: (C) => `A phone case costs ${C} to make`, seller: 'business', costPence: [300, 1000], price: [6, 20] },
  { name: 'kettle', cost: (C) => `A homeware shop buys each kettle for ${C}`, seller: 'shop', costPence: [1200, 3600], price: [15, 60] },
  { name: 'necklace', cost: (C) => `A silver necklace costs a jeweller ${C} to make`, seller: 'jeweller', costPence: [1500, 6000], price: [25, 120] },
  { name: 'bouquet', cost: (C) => `A bouquet costs a florist ${C} to make up`, seller: 'florist', costPence: [1500, 3600], price: [20, 60] },
  { name: 'chopping board', cost: (C) => `A wooden chopping board costs ${C} to make`, seller: 'business', costPence: [800, 2400], price: [12, 40] },
]

/**
 * Mark-ups real small businesses use. Never 100% (the mark-up equals the cost) nor 10% (only the
 * point moves). The two slots share a sheet, so consecutive turns take the two halves: q5 and
 * q10 never ask the same mark-up.
 */
const MARK_UPS = [
  [20, 25, 30, 40],
  [50, 60, 75, 80],
] as const

const PRICE_PROMPTS = [
  (g: Good, C: string, m: number) => `${g.cost(C)}. The ${g.seller} adds a mark-up of ${m}%. What is the selling price, in pounds?`,
  (g: Good, C: string, m: number) => `${g.cost(C)}, and the ${g.seller} adds a mark-up of ${m}% on cost. What is the selling price, in pounds?`,
  (g: Good, C: string, m: number) => `${g.cost(C)}. The ${g.seller} sets the price with a mark-up of ${m}% on cost. Calculate the selling price, in pounds.`,
]

/** Every cost in 20p steps that keeps the price in the good's range and reads off nothing. */
export function priceCosts(g: Good, m: number): number[] {
  return steps(g.costPence[0], g.costPence[1], 20).filter((c) => {
    const price = (c + markUpPence(c, m)) / 100
    return price >= g.price[0] && price <= g.price[1] && !readsOff(price, [m]) && !readsOff(markUpPence(c, m) / 100, [m])
  })
}

function markUpPrice(r: Rng, slot: Question, turn: number): Draft {
  const style = styleOf(slot)
  const g = pick(r, GOODS)
  const m = pick(r, MARK_UPS[turn % 2]!)
  const c = pick(r, priceCosts(g, m))
  const cost = c / 100
  const added = markUpPence(c, m) / 100
  const answer = (c + markUpPence(c, m)) / 100
  const P = (x: number) => texGbp(x, style, true)
  return numericDraft(
    slot,
    {
      prompt: pick(r, PRICE_PROMPTS)(g, gbp(cost, style, true), m),
      solution:
        `Mark-up $= ${P(cost)} \\times ${m}\\% = ${P(added)}$, so the price is $${P(cost)} + ${P(added)} = ${P(answer)}$. ` +
        `The ${m}% is taken of the cost, then added on top of it: this is cost-plus pricing, which makes sure every sale covers what the ${g.name} cost.`,
      method: [`finds ${m}% of ${gbp(cost, style, true)}`],
      answer,
      line: gbp(answer, style, true),
    },
    // Second route: the price over the cost gives 1 + the mark-up back.
    { agrees: near((answer / cost - 1) * 100, m), detail: `${show(answer)} ÷ ${show(cost)} = ${show(answer / cost)}` },
    { context: g.name, cost, markUp: m, added, price: answer },
  )
}

export const markUpPriceGenerator = businessBySlot('business-mark-up-price', TOPIC, { q5: markUpPrice, q10: markUpPrice })

// ---------------------------------------------------------------------------------------------
// q13: profit per unit from a mark-up
// ---------------------------------------------------------------------------------------------

interface Craft {
  item: string
  costPence: [number, number]
  price: [number, number]
}
/** Handmade goods a craft business sells, never blankets (q17 and q18 are about blankets). */
const CRAFTS: Craft[] = [
  { item: 'ceramic vase', costPence: [1200, 4000], price: [18, 70] },
  { item: 'leather bag', costPence: [2500, 8000], price: [40, 150] },
  { item: 'wooden stool', costPence: [2000, 6000], price: [30, 110] },
  { item: 'framed print', costPence: [1000, 3500], price: [15, 60] },
  { item: 'silver ring', costPence: [1500, 5000], price: [25, 90] },
  { item: 'knitted jumper', costPence: [2000, 5000], price: [30, 90] },
  { item: 'dog bed', costPence: [1200, 3500], price: [18, 60] },
  { item: 'wall clock', costPence: [1000, 3000], price: [15, 55] },
]
/** Never 50%: the cost less the mark-up (a discount, not a mark-up) would then equal the profit. */
const CRAFT_MARK_UPS = [20, 25, 30, 40, 60, 75, 80]

const PROFIT_PROMPTS = [
  (c: Craft, C: string, m: number) => `A ${c.item} costs ${C} to make and the business adds a mark-up of ${m}%. What is the profit on each ${c.item}, in pounds?`,
  (c: Craft, C: string, m: number) => `A craft business makes each ${c.item} for ${C} and sells it with a mark-up of ${m}% on cost. What is the profit on each ${c.item}, in pounds?`,
  (c: Craft, C: string, m: number) => `Each ${c.item} a small workshop makes costs ${C}, and the workshop prices it with a mark-up of ${m}%. Calculate the profit it makes on each ${c.item}, in pounds.`,
]

export function profitCosts(c: Craft, m: number): number[] {
  return steps(c.costPence[0], c.costPence[1], 20).filter((p) => {
    const added = markUpPence(p, m) / 100
    const price = (p + markUpPence(p, m)) / 100
    return price >= c.price[0] && price <= c.price[1] && !readsOff(added, [m, p / 100]) && !readsOff(price, [m])
  })
}

function markUpProfit(r: Rng, slot: Question): Draft {
  const style = styleOf(slot)
  const c = pick(r, CRAFTS)
  const m = pick(r, CRAFT_MARK_UPS)
  const pence = pick(r, profitCosts(c, m))
  const cost = pence / 100
  const answer = markUpPence(pence, m) / 100
  const price = (pence + markUpPence(pence, m)) / 100
  const P = (x: number) => texGbp(x, style, true)
  const G = (x: number) => gbp(x, style, true)
  return numericDraft(
    slot,
    {
      prompt: pick(r, PROFIT_PROMPTS)(c, G(cost), m),
      solution:
        `Mark-up $= ${P(cost)} \\times ${m}\\% = ${P(answer)}$, so the price is ${G(price)} and the **profit per ${c.item} is ${G(answer)}**. ` +
        `The profit is the gap between price and cost, $${P(price)} - ${P(cost)} = ${P(answer)}$, not the percentage.`,
      method: [`finds ${m}% of ${G(cost)}`, `identifies ${G(answer)}, the gap between the ${G(price)} price and the cost, as the profit per ${c.item}`],
      answer,
      line: G(answer),
    },
    // Second route: price − cost, from the price the mark-up gives.
    { agrees: near(price - cost, answer) && near(percentChange(cost, price), m), detail: `${show(price)} − ${show(cost)} = ${show(price - cost)}` },
    { context: c.item, cost, markUp: m, price, profit: answer },
  )
}

export const markUpProfitGenerator = businessBySlot('business-mark-up-profit', TOPIC, { q13: markUpProfit })

// ---------------------------------------------------------------------------------------------
// q24: percentage increase in sales after an extension strategy
// ---------------------------------------------------------------------------------------------

interface Extension {
  name: string
  who: string
  items: string
  /** What it did, after "it": "launched a new flavour". */
  move: string
  /** The event, after "the year before": "the launch". */
  event: string
  /** What the strategy cost, for the closing sentence: "the new flavour". */
  thing: string
  /** A year's sales before, in units. */
  sales: [number, number]
}
/** Small food, drink and consumer brands, with a year's sales one of them could make. */
const EXTENSIONS: Extension[] = [
  { name: 'drinks', who: 'A drinks business', items: 'bottles', move: 'launched a new flavour', event: 'the launch', thing: 'the new flavour', sales: [5000, 60000] },
  { name: 'sauce', who: 'A sauce maker', items: 'jars', move: 'launched a spicier version of its best-selling sauce', event: 'the launch', thing: 'the new version', sales: [3000, 40000] },
  { name: 'cereal', who: 'A small cereal brand', items: 'boxes', move: 'redesigned its packaging', event: 'the redesign', thing: 'the new packaging', sales: [10000, 90000] },
  { name: 'soap', who: 'A soap maker', items: 'bars of soap', move: 'brought out three new scents', event: 'the launch of the new scents', thing: 'the new scents', sales: [2000, 30000] },
  { name: 'board game', who: 'A board-game publisher', items: 'games', move: 'brought out a travel edition of its game', event: 'the launch of the travel edition', thing: 'the travel edition', sales: [1000, 20000] },
  { name: 'chocolate', who: 'A chocolate maker', items: 'bars', move: 'launched a larger sharing size', event: 'the launch', thing: 'the sharing size', sales: [5000, 80000] },
  { name: 'skincare', who: 'A skincare brand', items: 'jars of moisturiser', move: 'started selling in a new market abroad', event: 'the move abroad', thing: 'entering the new market', sales: [2000, 30000] },
  { name: 'dog treats', who: 'A dog-treat maker', items: 'bags', move: 'ran an advertising campaign to remind owners of its treats', event: 'the campaign', thing: 'the campaign', sales: [3000, 40000] },
]

/**
 * Whole percentages and halves, 8% to 40%: below 8%, the rise over the new figure rounds to the
 * answer. A whole percentage three times in four, as the pack's are mostly whole.
 */
const WHOLE_RISES = steps(8, 40, 1)
const HALF_RISES = steps(8.5, 39.5, 1)

/** Sales before in hundreds, the rise in tens, no figure reading off as the answer, no power of ten. */
export function salesBefore(e: Extension, p: number): number[] {
  return steps(e.sales[0], e.sales[1], 100).filter((b) => {
    const rise = (b * p) / 100
    return Number.isInteger(rise / 10) && !powerOfTen(b) && !readsOff(p, [b, rise, b + rise])
  })
}

const extensionSales = businessBySlot('business-extension-sales-increase', TOPIC, {
  q24(r, slot) {
    const s = styleOf(slot)
    const e = pick(r, EXTENSIONS)
    // The answer first, then sales that make it exact.
    const p = r() < 0.75 ? pick(r, WHOLE_RISES) : pick(r, HALF_RISES)
    const before = pick(r, salesBefore(e, p))
    const rise = (before * p) / 100
    const after = before + rise
    const T = (x: number) => texNum(x, s)
    const prompt = pick(r, [
      () => `${e.who} ${e.move} as an extension strategy. In the year before ${e.event} it sold ${num(before, s)} ${e.items}; in the year after ${e.event} it sold ${num(after, s)} ${e.items}. Calculate the percentage increase in its sales.`,
      () => `As an extension strategy, ${e.who.toLowerCase()} ${e.move}. Its sales were ${num(before, s)} ${e.items} in the year before ${e.event} and ${num(after, s)} ${e.items} in the year after. Calculate the percentage increase in its sales.`,
    ])()
    return numericDraft(
      slot,
      {
        prompt,
        solution:
          `Percentage change $=$ change $\\div$ original $\\times 100$. The change is $${T(after)} - ${T(before)} = ${T(rise)}$ ${e.items}, so the increase is $${T(rise)} \\div ${T(before)} \\times 100 = ${show(p)}\\%$. ` +
          `Divide by the figure **before** the change: $${T(rise)} \\div ${T(after)}$ gives a smaller, wrong answer. The rise in sales of ${show(p)}% is what the extension strategy bought; whether it was worth it depends on what ${e.thing} cost.`,
        method: [`$(${T(after)} - ${T(before)}) \\div ${T(before)} \\times 100$`],
        answer: p,
        line: `${show(p)}%`,
      },
      // Second route: the old sales grown by p% give the new ones.
      { agrees: near(before * (1 + p / 100), after) && near(percentChange(before, after), p), detail: `${before} × ${show(1 + p / 100)} = ${show(before * (1 + p / 100))}` },
      { context: e.name, before, after, percent: p },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// q25: revenue from two segments priced differently
// ---------------------------------------------------------------------------------------------

interface Venue {
  name: string
  /** The opening clause, before the colon: "A cinema prices two market segments differently". */
  who: string
  /** Each segment's ticket or service, singular and plural: "adult ticket", "adult tickets". */
  high: [string, string]
  low: [string, string]
  /** The verb for the quantity: "sells", "gives". */
  verb: string
  /** The time: "evening", "day". */
  when: string
  /** Price ranges, whole pounds, the dearer segment's first; the gap at least £2. */
  pHigh: [number, number]
  pLow: [number, number]
  /** Quantities and their step. */
  qHigh: [number, number]
  qLow: [number, number]
  step: number
  /** Why the segments pay differently, for the solution. */
  why: string
}
/** Never a hotel: q21 on the same sheet is a hotel's two segments. */
const VENUES: Venue[] = [
  { name: 'cinema', who: 'A cinema', high: ['adult ticket', 'adult tickets'], low: ['child ticket', 'child tickets'], verb: 'sells', when: 'evening', pHigh: [9, 15], pLow: [5, 9], qHigh: [60, 300], qLow: [20, 200], step: 5, why: 'charge adults more without pricing families out' },
  { name: 'theatre', who: 'A theatre', high: ['full-price ticket', 'full-price tickets'], low: ['student ticket', 'student tickets'], verb: 'sells', when: 'performance', pHigh: [18, 45], pLow: [10, 30], qHigh: [100, 450], qLow: [30, 200], step: 5, why: 'fill seats with students, who could not pay the full price, without cutting the price for everyone else' },
  { name: 'swimming pool', who: 'A swimming pool', high: ['adult swim', 'adult swims'], low: ['child swim', 'child swims'], verb: 'sells', when: 'day', pHigh: [4, 8], pLow: [2, 5], qHigh: [100, 400], qLow: [50, 300], step: 5, why: 'charge adults more while keeping swimming affordable for families' },
  { name: 'bowling alley', who: 'A bowling alley', high: ['adult game', 'adult games'], low: ['child game', 'child games'], verb: 'sells', when: 'evening', pHigh: [6, 10], pLow: [3, 7], qHigh: [60, 250], qLow: [20, 150], step: 5, why: 'charge adults more without pricing families out' },
  { name: 'museum', who: 'A museum', high: ['adult ticket', 'adult tickets'], low: ['student ticket', 'student tickets'], verb: 'sells', when: 'day', pHigh: [10, 20], pLow: [5, 12], qHigh: [100, 600], qLow: [40, 300], step: 10, why: 'attract students, who have less to spend, while adults pay the full price' },
  { name: 'football club', who: 'A football club', high: ['adult ticket', 'adult tickets'], low: ['junior ticket', 'junior tickets'], verb: 'sells', when: 'match', pHigh: [15, 35], pLow: [5, 15], qHigh: [500, 3000], qLow: [100, 800], step: 50, why: 'bring in young fans, who may buy tickets for years, while adults pay the full price' },
  { name: 'hair salon', who: 'A hair salon', high: ['adult haircut', 'adult haircuts'], low: ['child haircut', 'child haircuts'], verb: 'gives', when: 'week', pHigh: [25, 45], pLow: [10, 20], qHigh: [40, 120], qLow: [15, 60], step: 1, why: 'win families, whose parents may then book their own cuts, while adults pay the full price' },
  { name: 'climbing wall', who: 'A climbing centre', high: ['adult session', 'adult sessions'], low: ['child session', 'child sessions'], verb: 'sells', when: 'day', pHigh: [12, 20], pLow: [7, 14], qHigh: [40, 200], qLow: [20, 150], step: 5, why: 'charge adults more while keeping sessions affordable for families' },
]

interface Segments {
  p1: number
  p2: number
  q1: number
  q2: number
}

/** Every figure printed or worked, and the wrong routes: none may equal the answer, nor two givens each other. */
export function segmentFigures(x: Segments) {
  return {
    printed: [x.p1, x.p2, x.q1, x.q2],
    working: [x.p1 * x.q1, x.p2 * x.q2],
    // One price for everyone (either one); prices and quantities added first; the average price.
    wrong: [x.p1 * (x.q1 + x.q2), x.p2 * (x.q1 + x.q2), (x.p1 + x.p2) * (x.q1 + x.q2), ((x.p1 + x.p2) / 2) * (x.q1 + x.q2)],
  }
}

const segmentRevenue = businessBySlot('business-segment-revenue', TOPIC, {
  q25(r, slot) {
    const s = styleOf(slot)
    const v = pick(r, VENUES)
    const x = draw(
      r,
      (r): Segments => {
        const p1 = pick(r, steps(v.pHigh[0], v.pHigh[1], 1))
        // The cheaper segment at most 80% of the dearer price, and at least £2 less.
        const p2 = pick(r, steps(v.pLow[0], Math.min(v.pLow[1], p1 - 2, Math.floor(0.8 * p1)), 1))
        return { p1, p2, q1: pick(r, steps(v.qHigh[0], v.qHigh[1], v.step)), q2: pick(r, steps(v.qLow[0], v.qLow[1], v.step)) }
      },
      (x) => {
        const f = segmentFigures(x)
        const answer = x.p1 * x.q1 + x.p2 * x.q2
        return new Set(f.printed).size === 4 && ![...f.printed, ...f.working, ...f.wrong].includes(answer)
      },
    )
    const a1 = revenue(x.p1, x.q1)
    const a2 = revenue(x.p2, x.q2)
    const answer = a1 + a2
    const T = (n: number) => texNum(n, s)
    const prompt = pick(r, [
      () => `${v.who} prices two market segments differently: ${gbp(x.p1, s)} for ${an(v.high[0])} and ${gbp(x.p2, s)} for ${an(v.low[0])}. In one ${v.when} it ${v.verb} ${num(x.q1, s)} ${v.high[1]} and ${num(x.q2, s)} ${v.low[1]}. Calculate its total revenue for the ${v.when}.`,
      () => `${v.who} charges ${gbp(x.p1, s)} for each ${v.high[0]} and ${gbp(x.p2, s)} for each ${v.low[0]}, pricing two market segments differently. In one ${v.when} it ${v.verb} ${num(x.q1, s)} ${v.high[1]} and ${num(x.q2, s)} ${v.low[1]}. Calculate its total revenue for the ${v.when}.`,
    ])()
    return numericDraft(
      slot,
      {
        prompt,
        solution:
          `Revenue $=$ price $\\times$ quantity for each segment, then add them. ${cap(v.high[1])}: $${T(x.p1)} \\times ${T(x.q1)} = ${texGbp(a1, s)}$. ${cap(v.low[1])}: $${T(x.p2)} \\times ${T(x.q2)} = ${texGbp(a2, s)}$. ` +
          `Total revenue $= ${T(a1)} + ${T(a2)} = ${texGbp(answer, s)}$. Pricing the two segments differently lets the ${v.name} ${v.why}.`,
        method: [`$${T(x.p1)} \\times ${T(x.q1)} = ${T(a1)}$ and $${T(x.p2)} \\times ${T(x.q2)} = ${T(a2)}$`],
        answer,
        line: gbp(answer, s),
      },
      // Second route: everyone at the lower price, plus the extra the dearer segment pays.
      { agrees: x.p2 * (x.q1 + x.q2) + (x.p1 - x.p2) * x.q1 === answer, detail: `${x.p2} × ${x.q1 + x.q2} + ${x.p1 - x.p2} × ${x.q1}` },
      { context: v.name, high: x.p1, low: x.p2, highSold: x.q1, lowSold: x.q2, revenue: answer },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// q26: revenue after a price cut used as an extension strategy
// ---------------------------------------------------------------------------------------------

interface Brand {
  name: string
  who: string
  items: string
  /** One item, for "every … now earns". */
  item: string
  /** Monthly sales before the cut and their step; the rise in sales steps by `rise`. */
  sales: [number, number, number]
  rise: number
  /** Price range and step, in pounds. */
  price: [number, number, number]
}
/** Never blankets (q17's 10% cut) nor coffee (q30's 20% cut); a month's sales one brand could make. */
const BRANDS: Brand[] = [
  { name: 'business', who: 'A business', items: 'units', item: 'unit', sales: [1000, 5000, 100], rise: 50, price: [10, 40, 1] },
  { name: 'board game', who: 'A board-game maker', items: 'games', item: 'game', sales: [800, 3000, 100], rise: 10, price: [15, 40, 1] },
  { name: 'phone case', who: 'A phone-case brand', items: 'cases', item: 'case', sales: [1000, 6000, 100], rise: 50, price: [8, 20, 1] },
  { name: 'smoothie', who: 'A smoothie brand', items: 'bottles', item: 'bottle', sales: [5000, 30000, 500], rise: 100, price: [2, 4, 0.2] },
  { name: 'candle', who: 'A candle brand', items: 'candles', item: 'candle', sales: [1000, 5000, 100], rise: 50, price: [10, 30, 1] },
  { name: 'headphones', who: 'A headphone brand', items: 'pairs of headphones', item: 'pair', sales: [500, 3000, 100], rise: 10, price: [30, 90, 5] },
  { name: 'magazine', who: 'A magazine publisher', items: 'copies', item: 'copy', sales: [5000, 30000, 500], rise: 100, price: [3, 6, 0.2] },
]
/** Price cuts as a percentage; never 50%. */
const CUTS = [10, 15, 20, 25, 30]

interface Cut {
  P: number
  P2: number
  Q1: number
  Q2: number
  F: number
}

/** Every figure printed or worked out, and the wrong routes: none may equal the fall. */
export function cutFigures(x: Cut, c: number) {
  const R1 = x.Q1 * x.P
  const R2 = x.Q2 * x.P2
  return {
    printed: [x.P, x.Q1, x.Q2, c],
    working: [R1, R2, x.P2, x.Q2 - x.Q1],
    wrong: {
      // The cut on the old sales only; the extra sales' revenue; the price cut in pounds; the
      // cut and the rise in sales taken off as percentages of the old revenue.
      oldSalesOnly: x.Q1 * (x.P - x.P2),
      extraOnly: (x.Q2 - x.Q1) * x.P2,
      cutInPounds: R1 - x.Q2 * (x.P - c),
      // The extra sales priced at the old price.
      extraAtOldPrice: (x.Q2 - x.Q1) * x.P,
      percentages: (R1 * (c - ((x.Q2 - x.Q1) / x.Q1) * 100)) / 100,
      newPriceAsCut: R1 - x.Q2 * ((x.P * c) / 100),
    },
  }
}

/** Revenue whole to the penny: prices and sales are in steps that make it so. */
const whole = (x: number) => Math.abs(x - Math.round(x)) < 1e-9

function cutDraw(r: Rng, b: Brand, c: number): Cut | null {
  const P = pick(r, steps(...b.price))
  const P2 = Number(show((P * (100 - c)) / 100))
  if (!whole(P * (100 - c))) return null
  const Q1 = pick(r, steps(b.sales[0], b.sales[1], b.sales[2]))
  const R1 = revenue(P, Q1)
  // Sales rise by at least 3%, and revenue falls by at least 2%: the answer drawn from the falls these allow.
  const options = steps(b.rise, Q1, b.rise)
    .map((d) => Q1 + d)
    .filter((Q2) => Q2 >= Q1 * 1.03 && whole(Q2 * P2) && revenue(P2, Q2) <= R1 * 0.98 && Q2 !== Q1 * (1 + c / 100))
  if (!options.length) return null
  const Q2 = pick(r, options)
  return { P, P2, Q1, Q2, F: Math.round(R1 - revenue(P2, Q2)) }
}

const priceCut = businessBySlot('business-price-cut-revenue', TOPIC, {
  q26(r, slot) {
    const s = styleOf(slot)
    // The brand and the cut outside the draw, so a rare pair is never rerolled away.
    const b = pick(r, BRANDS)
    const c = pick(r, CUTS)
    const x = draw(
      r,
      (r) => cutDraw(r, b, c),
      (x): x is Cut => {
        if (!x) return false
        const f = cutFigures(x, c)
        const sizes = [...f.printed, ...f.working, ...Object.values(f.wrong)].map((n) => Math.round(Math.abs(n) * 100))
        // Never a price equal to the cut (£20 cut by 20%).
        return !sizes.includes(x.F * 100) && !readsOff(x.F, f.printed) && x.P !== c
      },
    )!
    // Both revenues are whole pounds by construction (cutDraw): rounding only clears binary residue.
    const R1 = Math.round(revenue(x.P, x.Q1))
    const R2 = Math.round(revenue(x.P2, x.Q2))
    const answer = R1 - R2
    const dQ = x.Q2 - x.Q1
    const rose = percentChange(x.Q1, x.Q2)
    const T = (n: number) => texNum(n, s)
    const Pd = (n: number) => texPounds(n, s)
    const prompt = pick(r, [
      () => `${b.who} sells ${num(x.Q1, s)} ${b.items} a month at ${gbp(x.P, s)} each. As an extension strategy it cuts the price by ${c}%, and its sales rise to ${num(x.Q2, s)} ${b.items} a month. Calculate the fall in its monthly revenue.`,
      () => `${b.who} has been selling ${num(x.Q1, s)} ${b.items} a month at ${gbp(x.P, s)} each, but sales have stopped growing. As an extension strategy it cuts the price by ${c}%, and sales rise to ${num(x.Q2, s)} ${b.items} a month. Calculate the fall in its monthly revenue.`,
    ])()
    const roseText = Number.isInteger(rose) ? `${num(dQ, s)} ${b.items} a month, ${rose}%` : `${num(dQ, s)} ${b.items} a month`
    return numericDraft(
      slot,
      {
        prompt,
        solution:
          `Revenue before $= ${T(x.Q1)} \\times ${Pd(x.P)} = ${texGbp(R1, s)}$. A ${c}% cut takes the price to $${Pd(x.P)} \\times ${show(1 - c / 100)} = ${texGbp(x.P2, s)}$. ` +
          `Revenue after $= ${T(x.Q2)} \\times ${Pd(x.P2)} = ${texGbp(R2, s)}$. The fall is $${T(R1)} - ${T(R2)} = ${texGbp(answer, s)}$ a month. ` +
          `Sales rose by ${roseText}, but every ${b.item} now earns ${c}% less, so revenue fell: a price cut only pays if the extra sales outweigh the lower price, and here they did not.`,
        method: [`$${T(x.Q1)} \\times ${Pd(x.P)} = ${T(R1)}$`, `new price ${gbp(x.P2, s)}, so $${T(x.Q2)} \\times ${Pd(x.P2)} = ${T(R2)}$`],
        answer,
        line: gbp(answer, s),
      },
      // Second route: the cut lost on the old sales, less what the extra sales bring in.
      { agrees: near(x.Q1 * (x.P - x.P2) - dQ * x.P2, answer) && answer > 0 && whole(answer), detail: `${x.Q1} × ${show(x.P - x.P2)} − ${dQ} × ${show(x.P2)}` },
      { context: b.name, cut: c, price: x.P, newPrice: x.P2, before: x.Q1, after: x.Q2, fall: answer },
    )
  },
})

export const marketingGenerators: Generator[] = [markUpPriceGenerator, markUpProfitGenerator, extensionSales, segmentRevenue, priceCut]

/** For the tests. */
export const MARKETING = { GOODS, MARK_UPS, CRAFTS, CRAFT_MARK_UPS, EXTENSIONS, WHOLE_RISES, HALF_RISES, VENUES, BRANDS, CUTS }
