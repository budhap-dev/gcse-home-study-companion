import { show } from '../format.ts'
import { draw, int, pick } from '../random.ts'
import type { Generator } from '../types.ts'
import { businessBySlot, byKey, gbp, marketShare, num, numericDraft, percentChange, powerOfTen, readsOff, steps, styleOf, texNum } from './build.ts'

/**
 * Business (Edexcel 1BS0) generators: Topic 1.2, spotting a business opportunity.
 *
 * - 1.2.2 the use of data in market research, and the reliability of market research data
 *   (Appendix 2 "marketing data, including market research data"): the share of a survey who
 *   would buy (q5), the same survey's share applied to a town (q29), and a small sample against
 *   a large one in percentage points (q11).
 * - 1.2.4 the competitive environment (Appendix 2 "market data, including market share"; the
 *   business's sales ÷ total market sales × 100, as the written questions work it): market share
 *   (q10) and its change in percentage points (q30).
 * - 1.2.2 the purpose of market research, to inform business decisions: the percentage rise in
 *   sales after a decision research informed (q28, Appendix 2 "percentages and percentage changes").
 *
 * Every numeric slot in the topic has a generator; none is left written. No sample is ever 100,
 * where the count who said yes would print the percentage itself, and no sample is 30 (the
 * advanced sheet's q12 surveys 30 friends).
 */
const TOPIC = 'spotting-a-business-opportunity'

// ---------------------------------------------------------------------------------------------
// q5: the percentage of a survey who would buy
// ---------------------------------------------------------------------------------------------

interface Survey {
  name: string
  text: (n: string, k: string) => string
  /** The percentages who say yes that fit the product. */
  percent: [number, number]
}
const SURVEYS: Survey[] = [
  { name: 'product', text: (n, k) => `A business surveys ${n} people. ${k} say they would buy the product. Calculate the percentage who would buy it.`, percent: [6, 85] },
  { name: 'gym', text: (n, k) => `A new gym surveys ${n} adults in its town. ${k} say they would join. Calculate the percentage who would join.`, percent: [5, 40] },
  { name: 'meal deal', text: (n, k) => `A café asks ${n} people passing its door about a lunchtime meal deal. ${k} say they would buy it. Calculate the percentage who would buy it.`, percent: [10, 75] },
  { name: 'gluten-free', text: (n, k) => `A bakery asks ${n} of its customers about a new gluten-free range. ${k} say they would buy from it. Calculate the percentage who would buy from it.`, percent: [8, 60] },
  { name: 'dog walking', text: (n, k) => `A dog-walking business surveys ${n} dog owners in its area. ${k} say they would pay for a weekly walk. Calculate the percentage who would pay for one.`, percent: [5, 45] },
  { name: 'cinema', text: (n, k) => `A cinema surveys ${n} of its customers. ${k} say they would come to a late-night showing. Calculate the percentage who would come.`, percent: [8, 60] },
]
/** Sample sizes a business could survey: never 100 (the count would be the percentage) nor 30. */
const SAMPLES = [40, 50, 60, 80, 120, 150, 200, 250, 300, 400, 500, 600, 800]
/** Samples whose count who said yes is whole for a whole percentage p. */
const fits = (n: number, p: number) => Number.isInteger((n * p) / 100)

/** q5: yes ÷ asked × 100, 2 marks. Written: 46 of 200, 23%. The percentage is drawn first. */
const surveyPercent = businessBySlot('opportunity-survey-percentage', TOPIC, {
  q5(r, slot) {
    const s = styleOf(slot)
    const c = pick(r, SURVEYS)
    // Never 50%: "half" needs no division.
    const p = pick(r, steps(c.percent[0], c.percent[1], 1).filter((x) => x !== 50))
    const n = pick(r, SAMPLES.filter((m) => fits(m, p) && !readsOff(p, [m, (m * p) / 100])))
    const k = (n * p) / 100
    return numericDraft(
      slot,
      {
        prompt: c.text(num(n, s), num(k, s)),
        solution: `$\\dfrac{${k}}{${n}} \\times 100 = ${p}\\%$.`,
        method: [`$${k} \\div ${n}$`],
        answer: p,
        line: `${p}%`,
      },
      // Second route: p% of the sample is the number who said yes.
      { agrees: (p * n) / 100 === k && Math.abs((k / n) * 100 - p) < 1e-9, detail: `${p}% of ${n} = ${show((p * n) / 100)}` },
      { context: c.name, asked: n, yes: k },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// q10 and q30: market share, and its change in percentage points
// ---------------------------------------------------------------------------------------------

interface Market {
  name: string
  /** The market, its size in pounds a year. */
  market: (m: string) => string
  /** The business, as the prompt names it ("A business's", "One gym's"). */
  one: string
  /** The business as the question asks it ("its", "the gym's"). */
  its: string
  size: [number, number]
  /** What one business of the kind takes in a year, in pounds: a takeaway never £1 million. */
  revenue: [number, number]
}
const SHARE_MARKETS: Market[] = [
  { name: 'market', market: (m) => `A market is worth ${m} a year.`, one: "A business's sales are", its: 'its', size: [400000, 8000000], revenue: [10000, 1500000] },
  { name: 'wedding cakes', market: (m) => `The market for wedding cakes in a region is worth ${m} a year.`, one: "A bakery's sales of wedding cakes are", its: "the bakery's", size: [400000, 3000000], revenue: [20000, 250000] },
  { name: 'gyms', market: (m) => `The gym market in a city is worth ${m} a year.`, one: "One gym's sales are", its: "the gym's", size: [1000000, 8000000], revenue: [150000, 1000000] },
  { name: 'takeaways', market: (m) => `Takeaway food in a town sells ${m} a year.`, one: "One takeaway's sales are", its: "the takeaway's", size: [1000000, 6000000], revenue: [100000, 600000] },
  { name: 'driving lessons', market: (m) => `The market for driving lessons in a city is worth ${m} a year.`, one: "A driving school's sales are", its: "the driving school's", size: [1000000, 6000000], revenue: [60000, 600000] },
]

/**
 * Market sizes in whole hundred thousands, so a share in halves gives sales in whole thousands
 * when the hundreds are even. Never a power of ten, which turns the division into moving the point.
 */
const sizes = (c: { size: [number, number] }, ...shares: number[]) =>
  steps(c.size[0], c.size[1], 100000).filter((m) => !powerOfTen(m) && shares.every((x) => Number.isInteger((m / 100000) * x)))
const within = (x: number, [lo, hi]: [number, number]) => x >= lo && x <= hi

interface Shared {
  share: number
  m: number
}
/**
 * Every share (2% to 30%, in halves) and market size whose sales one business of the kind could
 * make. Never 10%: the market over the sales, the wrong way up, is then 10 as well.
 */
const SHARES = new Map<string, Shared[]>()
function shares(c: Market): Shared[] {
  let out = SHARES.get(c.name)
  if (out) return out
  out = steps(4, 60, 1).filter((h) => h !== 20).flatMap((h) => {
    const share = h / 2
    return sizes(c, share)
      .filter((m) => within((m * share) / 100, c.revenue) && !readsOff(share, [m, (m * share) / 100]))
      .map((m) => ({ share, m }))
  })
  SHARES.set(c.name, out)
  return out
}

/** q10: sales ÷ market × 100, 3 marks. Written: 60 000 of 800 000, 7.5%. The context first, then the share evenly among those it allows. */
const share = businessBySlot('opportunity-market-share', TOPIC, {
  q10(r, slot) {
    const s = styleOf(slot)
    const c = pick(r, SHARE_MARKETS)
    const { share: sh, m } = byKey(r, shares(c), (x) => x.share)
    const sales = (m * sh) / 100
    const T = (x: number) => texNum(x, s)
    return numericDraft(
      slot,
      {
        prompt: `${c.market(gbp(m, s))} ${c.one} ${gbp(sales, s)}${c.name === 'market' ? '' : ' a year'}. Calculate ${c.its} market share.`,
        solution: `Market share $= \\dfrac{\\text{the business's sales}}{\\text{total market sales}} \\times 100 = \\dfrac{${T(sales)}}{${T(m)}} \\times 100 = ${show(sh)}\\%$.`,
        method: [`$${T(sales)} \\div ${T(m)}$`, '$\\times 100$'],
        answer: sh,
        line: `${show(sh)}%`,
      },
      // Second route: the share of the market gives the sales back.
      { agrees: (m * sh) / 100 === sales && Math.abs(marketShare(sales, m) - sh) < 1e-9, detail: `${show(sh)}% of ${m} = ${show((m * sh) / 100)}` },
      { context: c.name, market: m, sales },
    )
  },
})

const CHANGE_MARKETS: Market[] = [
  { name: 'takeaways', market: (m) => `A town's takeaway market is worth ${m} a year.`, one: "A takeaway's", its: 'its', size: [1000000, 6000000], revenue: [100000, 600000] },
  { name: 'gyms', market: (m) => `A city's gym market is worth ${m} a year.`, one: "One gym's", its: 'its', size: [2000000, 8000000], revenue: [150000, 1000000] },
  { name: 'hairdressing', market: (m) => `A town's hairdressing market is worth ${m} a year.`, one: "One salon's", its: 'its', size: [800000, 4000000], revenue: [60000, 400000] },
  { name: 'driving lessons', market: (m) => `A city's market for driving lessons is worth ${m} a year.`, one: "A driving school's", its: 'its', size: [1000000, 6000000], revenue: [60000, 600000] },
  { name: 'wedding photography', market: (m) => `A region's wedding photography market is worth ${m} a year.`, one: "One wedding photography studio's", its: 'its', size: [800000, 4000000], revenue: [40000, 300000] },
]

interface Shift {
  d: number
  s1: number
  s2: number
  m: number
}
/**
 * Every change (0.5 to 7 points, in halves), last year's share and market whose two revenues one
 * business of the kind could take. Last year's share is at least twice the change, so it never
 * equals the change (a student giving last year's share would score) and the revenue rises by
 * 50% at most; this year's is at most 22%.
 */
const SHIFTS = new Map<string, Shift[]>()
function shifts(c: Market): Shift[] {
  let out = SHIFTS.get(c.name)
  if (out) return out
  out = steps(1, 14, 1).flatMap((h) => {
    const d = h / 2
    return steps(4 * d, 44 - 2 * d, 1).flatMap((k) => {
      const s1 = k / 2
      const s2 = s1 + d
      return sizes(c, s1, s2)
        .filter((m) => within((m * s1) / 100, c.revenue) && within((m * s2) / 100, c.revenue) && !readsOff(d, [m, (m * s1) / 100, (m * s2) / 100]))
        .map((m) => ({ d, s1, s2, m }))
    })
  })
  SHIFTS.set(c.name, out)
  return out
}

/**
 * q30: this year's share − last year's, 3 marks. Written: 7.5% → 10%, 2.5 percentage points. The
 * context first, then the change evenly among those it allows, then a share and market (see
 * `shifts`). The revenue's own percentage rise is change ÷ old share × 100, which equals the
 * change only at a 100% share: never.
 */
const points = (x: number) => (x === 1 ? 'percentage point' : 'percentage points')

const shareChange = businessBySlot('opportunity-market-share-change', TOPIC, {
  q30(r, slot) {
    const s = styleOf(slot)
    const c = pick(r, CHANGE_MARKETS)
    const x = byKey(r, shifts(c), (y) => y.d)
    const r1 = (x.m * x.s1) / 100
    const r2 = (x.m * x.s2) / 100
    const answer = x.d
    const rise = percentChange(r1, r2)
    const riseText = Number.isInteger(Number(show(rise * 10))) ? `${show(rise)}%` : `about ${Math.round(rise)}%`
    const T = (v: number) => texNum(v, s)
    return numericDraft(
      slot,
      {
        prompt: `${c.market(gbp(x.m, s))} ${c.one} revenue rose from ${gbp(r1, s)} last year to ${gbp(r2, s)} this year, while the size of the market did not change. Calculate the change in its market share in percentage points.`,
        solution: `Market share $=$ the business's revenue $\\div$ the size of the market $\\times 100$. Last year: $\\dfrac{${T(r1)}}{${T(x.m)}} \\times 100 = ${show(x.s1)}\\%$. This year: $\\dfrac{${T(r2)}}{${T(x.m)}} \\times 100 = ${show(x.s2)}\\%$. Change $= ${show(x.s2)} - ${show(x.s1)} = ${show(answer)}$ ${points(answer)}. This is not a ${show(answer)}% rise in sales: the revenue itself rose by ${riseText}.`,
        method: [`$${T(r1)} \\div ${T(x.m)} = ${show(x.s1)}\\%$`, `$${T(r2)} \\div ${T(x.m)} = ${show(x.s2)}\\%$`],
        answer,
        line: `${show(answer)} ${points(answer)}`,
      },
      // Second route: the rise in revenue as a share of the market.
      { agrees: Math.abs(((r2 - r1) / x.m) * 100 - answer) < 1e-9, detail: `(${r2} − ${r1}) ÷ ${x.m} × 100 = ${show(((r2 - r1) / x.m) * 100)}` },
      { context: c.name, market: x.m, before: r1, after: r2 },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// q11: a small sample against a large one, in percentage points
// ---------------------------------------------------------------------------------------------

/** What the business asks about, at a price in its real range. */
const OFFERS: { name: string; offer: string; price: [number, number] }[] = [
  { name: 'product', offer: 'the product', price: [2, 15] },
  { name: 'smoothie', offer: 'its new smoothie', price: [3, 5] },
  { name: 'candle', offer: 'a scented candle', price: [8, 20] },
  { name: 'phone case', offer: 'its new phone case', price: [10, 25] },
  { name: 'lunch box', offer: 'a reusable lunch box', price: [6, 15] },
]
/** First samples, small; second, large. No 30: q12 on the same sheet surveys 30 friends. */
const SMALL = [20, 25, 40, 50]
const LARGE = [200, 250, 300, 400, 500, 600, 800, 1000]

/**
 * q11: first share − second share, 4 marks. Written: 30 of 40 (75%), 240 of 400 (60%), 15 points.
 * The difference (5 to 40) is drawn first, then the small sample, then a first share of 50% to
 * 95% that sample can give, then the large sample, the two counts never differing by the answer
 * and the price never equal to a count or a sample.
 * The percentage change between the two results, difference ÷ first × 100, would equal the
 * difference only at a first share of 100%: never.
 */
const samplePoints = businessBySlot('opportunity-sample-size-points', TOPIC, {
  q11(r, slot) {
    const s = styleOf(slot)
    const o = pick(r, OFFERS)
    const d = int(r, 5, 40)
    const x = draw(
      r,
      (rr) => {
        const price = int(rr, o.price[0], o.price[1])
        const n1 = pick(rr, SMALL)
        // The percentage change, d ÷ p1 × 100, rounded to a whole or to 1 d.p., is never d (95% → 90%: 5.26).
        const p1 = pick(rr, steps(Math.max(50, d + 15), 95, 1).filter((p) => fits(n1, p) && Math.round((100 * d) / p) !== d && Math.round((1000 * d) / p) / 10 !== d))
        const p2 = p1 - d
        const n2 = pick(rr, LARGE.filter((n) => fits(n, p2)))
        return { price, n1, p1, n2, p2, k1: (n1 * p1) / 100, k2: (n2 * p2) / 100 }
      },
      (y) => y.p1 !== undefined && y.n2 !== undefined && y.p2 !== d && Math.abs(y.k1 - y.k2) !== d && ![y.n1, y.k1, y.n2, y.k2].includes(y.price) && !readsOff(d, [y.n1, y.k1, y.n2, y.k2, y.price]),
    )
    const price = x.price
    const prompt =
      int(r, 0, 1) === 0
        ? `A business surveys ${x.n1} people and ${x.k1} say they would buy ${o.offer} at ${gbp(price, s)}. It then surveys ${num(x.n2, s)} people and ${num(x.k2, s)} say they would. How many percentage points lower is the second result?`
        : `A business asks ${x.n1} people whether they would buy ${o.offer} at ${gbp(price, s)}, and ${x.k1} say yes. A second survey of ${num(x.n2, s)} people finds ${num(x.k2, s)} who would. How many percentage points lower is the second result?`
    return numericDraft(
      slot,
      {
        prompt,
        solution: `First: $\\dfrac{${x.k1}}{${x.n1}} \\times 100 = ${x.p1}\\%$. Second: $\\dfrac{${x.k2}}{${x.n2}} \\times 100 = ${x.p2}\\%$. The difference is $${x.p1} - ${x.p2} = ${d}$ percentage points. The larger sample is the more reliable, so planning on ${x.p1}% would have been over-optimistic.`,
        method: [`$${x.k1} \\div ${x.n1} = ${x.p1}\\%$`, `$${x.k2} \\div ${x.n2} = ${x.p2}\\%$`, 'subtracting the two'],
        answer: d,
        line: `${d} percentage points`,
      },
      // Second route: over a common denominator, (k1·n2 − k2·n1) ÷ (n1·n2) × 100.
      { agrees: ((x.k1 * x.n2 - x.k2 * x.n1) * 100) / (x.n1 * x.n2) === d, detail: `(${x.k1}×${x.n2} − ${x.k2}×${x.n1}) × 100 ÷ (${x.n1}×${x.n2})` },
      { context: o.name, price, first: x.n1, firstYes: x.k1, second: x.n2, secondYes: x.k2 },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// q28: percentage increase in sales after a decision research informed
// ---------------------------------------------------------------------------------------------

interface Change {
  name: string
  text: (a: string, b: string) => string
  period: 'week' | 'month'
  source: string
  /** Sales before, in pounds, and the step they come in. */
  sales: [number, number, number]
}
const CHANGES: Change[] = [
  { name: 'café', text: (a, b) => `A café's sales were ${a} a week. After it widened its menu in response to a customer survey, sales rose to ${b} a week.`, period: 'week', source: 'survey', sales: [1500, 6000, 100] },
  { name: 'salon', text: (a, b) => `A hair salon's sales were ${a} a week. After it opened late on Thursdays in response to a survey of its clients, sales rose to ${b} a week.`, period: 'week', source: 'survey', sales: [2000, 8000, 100] },
  { name: 'bakery', text: (a, b) => `A bakery's sales were ${a} a week. After it added a gluten-free range suggested by a focus group, sales rose to ${b} a week.`, period: 'week', source: 'focus group', sales: [2000, 9000, 100] },
  { name: 'gym', text: (a, b) => `A gym's sales were ${a} a month. After it added early-morning classes in response to a questionnaire to its members, sales rose to ${b} a month.`, period: 'month', source: 'questionnaire', sales: [15000, 60000, 500] },
  { name: 'bike shop', text: (a, b) => `A bike shop's sales were ${a} a month. After it started a repair service its customers had asked for in a survey, sales rose to ${b} a month.`, period: 'month', source: 'survey', sales: [8000, 40000, 500] },
]

/**
 * q28: (new − old) ÷ old × 100, 2 marks. Written: £2400 → £2760, 15%. The percentage (8% to 40%; below 8%, the rise over the new sales rounds to the answer)
 * is drawn first, then sales in whole hundreds that make the rise whole tens; no figure reads off
 * as the answer, and £10 000 is left out.
 */
const salesIncrease = businessBySlot('opportunity-sales-percentage-increase', TOPIC, {
  q28(r, slot) {
    const s = styleOf(slot)
    const c = pick(r, CHANGES)
    const p = int(r, 8, 40)
    const [lo, hi, step] = c.sales
    // The rise in whole tens: £2400 → £2760, never £53 675.
    const before = pick(r, steps(lo, hi, step).filter((a) => Number.isInteger((a * p) / 1000) && !powerOfTen(a) && !readsOff(p, [a, (a * p) / 100, a + (a * p) / 100])))
    const rise = (before * p) / 100
    const after = before + rise
    const T = (x: number) => texNum(x, s)
    return numericDraft(
      slot,
      {
        prompt: `${c.text(gbp(before, s), gbp(after, s))} Calculate the percentage increase in sales.`,
        solution: `Increase $= ${T(after)} - ${T(before)} = £${T(rise)}$. Percentage increase $= \\dfrac{${T(rise)}}{${T(before)}} \\times 100 = ${p}\\%$. One purpose of market research on the specification is to inform business decisions; here the decision the ${c.source} informed is worth ${gbp(rise, s)} a ${c.period}.`,
        method: [`$\\dfrac{${T(after)} - ${T(before)}}{${T(before)}} \\times 100$`],
        answer: p,
        line: `${p}%`,
      },
      { agrees: Math.abs(before * (1 + p / 100) - after) < 1e-6 && Math.abs(percentChange(before, after) - p) < 1e-9, detail: `${before} × ${show(1 + p / 100)} = ${show(before * (1 + p / 100))}` },
      { context: c.name, before, after, percent: p },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// q29: a survey's share applied to the whole town
// ---------------------------------------------------------------------------------------------

interface Scaled {
  name: string
  /** "A business surveys 200 households in a town and 56 say they would buy its product." */
  text: (n: string, k: string) => string
  /** "expected to buy the product" */
  expected: string
  /** "Share who would buy" in the solution. */
  would: string
  percent: [number, number]
}
const SCALED: Scaled[] = [
  { name: 'product', text: (n, k) => `A business surveys ${n} households in a town and ${k} say they would buy its product.`, expected: 'buy the product', would: 'buy', percent: [5, 60] },
  { name: 'vegetable box', text: (n, k) => `A farm surveys ${n} households in a town and ${k} say they would order a weekly vegetable box.`, expected: 'order one', would: 'order one', percent: [5, 30] },
  { name: 'window cleaning', text: (n, k) => `A window-cleaning business surveys ${n} households in a town and ${k} say they would use its service.`, expected: 'use the service', would: 'use it', percent: [10, 50] },
  { name: 'broadband', text: (n, k) => `A broadband provider surveys ${n} households in a town and ${k} say they would switch to its full-fibre service.`, expected: 'switch', would: 'switch', percent: [10, 60] },
  { name: 'recipe box', text: (n, k) => `A meal-kit company surveys ${n} households in a town and ${k} say they would try its weekly recipe box.`, expected: 'try it', would: 'try it', percent: [5, 35] },
]
const TOWN_SAMPLES = [50, 80, 120, 150, 200, 250, 300, 400, 500]

/**
 * q29: yes ÷ asked × households, 3 marks. Written: 56 of 200 (28%) of 12 000, 3360 households.
 * The percentage is drawn first, then the sample and the town (2000 to 40 000 households in
 * whole five hundreds, never 10 000). Multiplying the count who said yes by the town, without
 * dividing by the sample, gives a figure many times too big.
 */
const scaledUp = businessBySlot('opportunity-survey-scaled-up', TOPIC, {
  q29(r, slot) {
    const s = styleOf(slot)
    const c = pick(r, SCALED)
    // Never 10% (a tenth of the town reads off the town's own figure) nor 50% (half needs no division).
    const p = pick(r, steps(c.percent[0], c.percent[1], 1).filter((x) => x !== 10 && x !== 50))
    const n = pick(r, TOWN_SAMPLES.filter((m) => fits(m, p)))
    const k = (n * p) / 100
    const town = pick(r, steps(2000, 40000, 500).filter((h) => !powerOfTen(h) && !readsOff((h * p) / 100, [h, n, k])))
    const answer = (town * p) / 100
    const T = (x: number) => texNum(x, s)
    return numericDraft(
      slot,
      {
        prompt: `${c.text(num(n, s), num(k, s))} There are ${num(town, s)} households in the town. Calculate the number of households in the town that would be expected to ${c.expected}, assuming the sample is typical.`,
        solution: `Share who would ${c.would} $= \\dfrac{${k}}{${n}} \\times 100 = ${p}\\%$. Applied to the town: $${show(p / 100)} \\times ${T(town)} = ${T(answer)}$ households. This is only an estimate: it holds if the ${n} households surveyed are typical of the ${num(town, s)}, which is why the reliability of market research data matters.`,
        method: [`$${k} \\div ${n} = ${p}\\%$`, `$${show(p / 100)} \\times ${T(town)}$`],
        answer,
        line: num(answer, s),
      },
      // Second route: the town is so many samples' worth, each with k who would buy.
      { agrees: Math.abs((town / n) * k - answer) < 1e-6, detail: `${town} ÷ ${n} × ${k} = ${show((town / n) * k)}` },
      { context: c.name, asked: n, yes: k, town },
    )
  },
})

export const opportunityGenerators: Generator[] = [surveyPercent, share, samplePoints, salesIncrease, scaledUp, shareChange]

/** For the tests. */
export const OPPORTUNITY = { shares, shifts, SURVEYS, SAMPLES, SHARE_MARKETS, CHANGE_MARKETS, OFFERS, SMALL, LARGE, CHANGES, SCALED, TOWN_SAMPLES }
