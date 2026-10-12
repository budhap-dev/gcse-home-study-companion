import { show } from '../format.ts'
import { draw, int, pick } from '../random.ts'
import type { Generator } from '../types.ts'
import { businessBySlot, byKey, gbp, num, numericDraft, percentChange, powerOfTen, profit, readsOff, steps, type Style, styleOf, texNum } from './build.ts'

/**
 * Business (Edexcel 1BS0) generators: Topic 1.1, enterprise and entrepreneurship.
 *
 * - 1.1.3 the role of business enterprise: to add value. The specification lists only the ways
 *   value is added (convenience, branding, quality, design, unique selling points) and gives no
 *   formula; Appendix 3 has none either. The figure here is the one the written questions use,
 *   selling price minus the cost of the bought-in inputs (Appendix 2 "revenue, costs and
 *   profit"): per item (q11, q21), over a week or a month of sales (q29), and what is left of it
 *   as profit once the fixed costs are paid (q12).
 * - 1.1.2 risk and reward: profit as a reward, its percentage change (q28, Appendix 2
 *   "percentages and percentage changes"), and profit, revenue − total costs, against the salary
 *   given up to earn it (q30, Appendix 2 "revenue, costs and profit").
 *
 * Every numeric slot in the topic has a generator; none is left written.
 */
const TOPIC = 'enterprise-and-entrepreneurship'

/** A person in a context, with the pronouns the prompt needs. */
export interface Person {
  name: string
  she: string
  her: string
}
const PEOPLE: Person[] = [
  { name: 'Jess', she: 'she', her: 'her' },
  { name: 'Callum', she: 'he', her: 'his' },
  { name: 'Aisha', she: 'she', her: 'her' },
  { name: 'Ryan', she: 'he', her: 'his' },
  { name: 'Mei', she: 'she', her: 'her' },
  { name: 'Daniel', she: 'he', her: 'his' },
  { name: 'Sofia', she: 'she', her: 'her' },
  { name: 'Kwame', she: 'he', her: 'his' },
  { name: 'Grace', she: 'she', her: 'her' },
  { name: 'Liam', she: 'he', her: 'his' },
]

// ---------------------------------------------------------------------------------------------
// Value added per item: q11 (a craft business), q21 (a maker), q29 (a week or a month of sales)
// ---------------------------------------------------------------------------------------------

/** A made product: its selling price in pounds and the share of that price its bought-in inputs cost. */
interface Made {
  name: string
  item: string
  items: string
  inputs: string
  price: [number, number]
  share: [number, number]
}
interface PerItem {
  cost: number
  price: number
  added: number
}

/**
 * Every whole-pound cost and price for a product: the price in its real range, the inputs a
 * share of it, at least £2, and the value added never equal to the cost of the inputs (a student
 * who read the cost off would score).
 */
const PAIRS = new Map<string, PerItem[]>()
function pairs(m: Made): PerItem[] {
  let out = PAIRS.get(m.name)
  if (out) return out
  out = steps(m.price[0], m.price[1], 1).flatMap((price) =>
    steps(2, price, 1)
      .filter((cost) => cost / price >= m.share[0] && cost / price <= m.share[1] && price - cost !== cost)
      .map((cost) => ({ cost, price, added: price - cost })),
  )
  PAIRS.set(m.name, out)
  return out
}

/** Craft products for q11, as written: "A craft business buys materials for £6 and sells the finished item for £26". No chairs or restoring: q18 on the same sheet restores a chair. */
const CRAFTS: Made[] = [
  { name: 'item', item: 'item', items: 'items', inputs: 'materials', price: [15, 60], share: [0.15, 0.45] },
  { name: 'mug', item: 'mug', items: 'hand-thrown mugs', inputs: 'clay and glaze', price: [12, 30], share: [0.15, 0.45] },
  { name: 'chopping board', item: 'board', items: 'wooden chopping boards', inputs: 'timber and oil', price: [18, 45], share: [0.15, 0.45] },
  { name: 'candle', item: 'candle', items: 'scented candles', inputs: 'wax, wick and jar', price: [10, 28], share: [0.15, 0.45] },
  { name: 'scarf', item: 'scarf', items: 'knitted scarves', inputs: 'wool', price: [20, 50], share: [0.15, 0.45] },
  { name: 'cushion', item: 'cushion', items: 'patchwork cushions', inputs: 'fabric and filling', price: [18, 40], share: [0.15, 0.45] },
  { name: 'wallet', item: 'wallet', items: 'leather wallets', inputs: 'leather and thread', price: [25, 60], share: [0.15, 0.45] },
  { name: 'framed print', item: 'print', items: 'framed prints', inputs: 'paper, ink and frame', price: [25, 70], share: [0.15, 0.45] },
]

const CRAFT_PROMPTS = [
  (m: Made, x: PerItem, s: Style) =>
    `A craft business makes ${m.items}. It buys the ${m.inputs} for ${gbp(x.cost, s)} per ${m.item} and sells each ${m.item} for ${gbp(x.price, s)}. Calculate the value added per ${m.item}.`,
  (m: Made, x: PerItem, s: Style) =>
    `A craft business makes ${m.items}, selling each one for ${gbp(x.price, s)}. The ${m.inputs} for one ${m.item} cost ${gbp(x.cost, s)}. Calculate the value added per ${m.item}.`,
]

/** q11: price − cost of inputs, 3 marks (the definition earns a mark). Written: £26 − £6 = £20. */
const craftAdded = businessBySlot('enterprise-value-added-craft', TOPIC, {
  q11(r, slot) {
    const s = styleOf(slot)
    const m = pick(r, CRAFTS)
    const x = byKey(r, pairs(m), (y) => y.added)
    const prompt =
      m.name === 'item'
        ? `A craft business buys materials for ${gbp(x.cost, s)} and sells the finished item for ${gbp(x.price, s)}. Calculate the value added per item.`
        : pick(r, CRAFT_PROMPTS)(m, x, s)
    return numericDraft(
      slot,
      {
        prompt,
        solution: `Added value $=$ selling price $-$ cost of the inputs $= ${x.price} - ${x.cost} = ${gbp(x.added, s)}$. The ${gbp(x.added, s)} pays for the maker's time and skill and, once the other costs are met, becomes profit. It is **not** the profit on its own.`,
        method: ['added value $=$ price $-$ cost of inputs', `$${x.price} - ${x.cost}$`],
        answer: x.added,
        line: gbp(x.added, s),
      },
      // Second route: the inputs and the value added rebuild the price the customer pays.
      { agrees: x.cost + x.added === x.price, detail: `${x.cost} + ${x.added} = ${x.cost + x.added}` },
      { context: m.name, cost: x.cost, price: x.price },
    )
  },
})

/** A maker for q21, as written: "A jeweller buys silver and stones for £14 per necklace". */
interface Maker extends Made {
  maker: string
}
const MAKERS: Maker[] = [
  { name: 'necklace', maker: 'jeweller', item: 'necklace', items: 'necklaces', inputs: 'silver and stones', price: [25, 120], share: [0.2, 0.45] },
  { name: 'bracelet', maker: 'jeweller', item: 'bracelet', items: 'bracelets', inputs: 'silver and beads', price: [20, 90], share: [0.2, 0.45] },
  { name: 'vase', maker: 'potter', item: 'vase', items: 'vases', inputs: 'clay and glaze', price: [20, 80], share: [0.15, 0.4] },
  { name: 'belt', maker: 'leatherworker', item: 'belt', items: 'belts', inputs: 'leather and a buckle', price: [20, 60], share: [0.2, 0.45] },
  { name: 'stool', maker: 'furniture maker', item: 'stool', items: 'stools', inputs: 'timber and fittings', price: [40, 120], share: [0.2, 0.45] },
  { name: 'dress', maker: 'dressmaker', item: 'dress', items: 'dresses', inputs: 'fabric and thread', price: [40, 150], share: [0.2, 0.45] },
]

const MAKER_PROMPTS = [
  (m: Maker, x: PerItem, s: Style) => `A ${m.maker} buys ${m.inputs} for ${gbp(x.cost, s)} per ${m.item} and sells each ${m.item} for ${gbp(x.price, s)}. Calculate the value added per ${m.item}.`,
  (m: Maker, x: PerItem, s: Style) => `A ${m.maker} sells each ${m.item} for ${gbp(x.price, s)}. The ${m.inputs} for one ${m.item} cost ${gbp(x.cost, s)}. Calculate the value added per ${m.item}.`,
]

/** q21: price − cost of the bought-in inputs, 2 marks. Written: £45 − £14 = £31. */
const makerAdded = businessBySlot('enterprise-value-added-maker', TOPIC, {
  q21(r, slot) {
    const s = styleOf(slot)
    const m = pick(r, MAKERS)
    const x = byKey(r, pairs(m), (y) => y.added)
    return numericDraft(
      slot,
      {
        prompt: pick(r, MAKER_PROMPTS)(m, x, s),
        solution: `Added value $=$ selling price $-$ cost of the bought-in inputs $= ${x.price} - ${x.cost} = ${gbp(x.added, s)}$. The ${m.maker}'s time and the rent of the workshop were not bought in to make the ${m.item}, so they are not subtracted here: they come out of the ${gbp(x.added, s)} later, on the way to profit.`,
        method: [`$${x.price} - ${x.cost}$`],
        answer: x.added,
        line: gbp(x.added, s),
      },
      { agrees: x.cost + x.added === x.price, detail: `${x.cost} + ${x.added} = ${x.cost + x.added}` },
      { context: m.name, cost: x.cost, price: x.price },
    )
  },
})

/** A seller for q29, with what it sells in a week and in a month. */
interface Seller extends Made {
  who: string
  /** "A florist buys flowers and wrapping": the subject of the first sentence. */
  opening: string
  week: [number, number, number]
  month: [number, number, number]
}
const SELLERS: Seller[] = [
  { name: 'bouquet', opening: 'A florist', who: 'the florist', item: 'bouquet', items: 'bouquets', inputs: 'flowers and wrapping', price: [20, 60], share: [0.25, 0.5], week: [40, 200, 5], month: [160, 800, 10] },
  { name: 'cake', opening: 'A baker', who: 'the baker', item: 'celebration cake', items: 'celebration cakes', inputs: 'ingredients and decorations', price: [25, 80], share: [0.2, 0.45], week: [8, 40, 1], month: [30, 150, 5] },
  { name: 'candle', opening: 'A candle maker', who: 'the candle maker', item: 'candle', items: 'candles', inputs: 'wax, a wick and a jar', price: [10, 28], share: [0.2, 0.45], week: [50, 300, 10], month: [200, 1000, 20] },
  { name: 'T-shirt', opening: 'A T-shirt printer', who: 'the printer', item: 'T-shirt', items: 'T-shirts', inputs: 'a blank shirt and ink', price: [12, 25], share: [0.25, 0.5], week: [40, 250, 10], month: [150, 900, 10] },
  { name: 'hamper', opening: 'A hamper business', who: 'the business', item: 'hamper', items: 'hampers', inputs: 'food, drink and a basket', price: [30, 90], share: [0.4, 0.6], week: [10, 60, 2], month: [40, 240, 5] },
]

/** q29: (price − cost) × quantity, 3 marks. Written: (£24 − £9) × 120 = £1800. */
const totalAdded = businessBySlot('enterprise-value-added-total', TOPIC, {
  q29(r, slot) {
    const s = styleOf(slot)
    const m = pick(r, SELLERS)
    const x = byKey(r, pairs(m), (y) => y.added)
    const period = pick(r, ['week', 'month'] as const)
    const [lo, hi, step] = m[period]
    // The quantity differs from every price on the page, so no figure does double duty.
    const q = draw(r, (rr) => lo + step * int(rr, 0, Math.round((hi - lo) / step)), (n) => ![x.added, x.cost, x.price].includes(n))
    const total = x.added * q
    const T = (v: number) => texNum(v, s)
    return numericDraft(
      slot,
      {
        prompt: `${m.opening} buys ${m.inputs} for ${gbp(x.cost, s)} per ${m.item} and sells each ${m.item} for ${gbp(x.price, s)}. In one ${period} ${m.who} sells ${num(q, s)} ${m.items}. Calculate the total value added in the ${period}.`,
        solution: `Value added per ${m.item} $=$ selling price $-$ cost of the bought-in inputs $= ${x.price} - ${x.cost} = £${x.added}$. Total value added $= ${x.added} \\times ${T(q)} = £${T(total)}$. The ${gbp(total, s)} is not profit: ${m.who === 'the business' ? "the business's" : `${m.who}'s`} rent, wages and other costs still have to come out of it.`,
        method: [`$${x.price} - ${x.cost} = ${x.added}$`, `$${x.added} \\times ${T(q)}$`],
        answer: total,
        line: gbp(total, s),
      },
      // Second route: revenue less the cost of the inputs, over the whole period.
      { agrees: x.price * q - x.cost * q === total, detail: `${x.price} × ${q} − ${x.cost} × ${q} = ${x.price * q - x.cost * q}` },
      { context: m.name, period, cost: x.cost, price: x.price, quantity: q },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// q12: value added over a month, less the fixed costs
// ---------------------------------------------------------------------------------------------

interface Adder {
  name: string
  /** "A business adds value of £14 on each item and sells 350 items a month." */
  text: (v: string, n: string) => string
  added: [number, number]
  sold: [number, number, number]
}
/**
 * No generic item and no candle: q11 on the same advanced sheet makes both, and its answer is the
 * value added per item that q12 prints. The two slots never share a context.
 */
const ADDERS: Adder[] = [
  { name: 'cake', text: (v, n) => `A bakery adds value of ${v} on each celebration cake and sells ${n} cakes a month.`, added: [12, 40], sold: [40, 200, 5] },
  { name: 'table', text: (v, n) => `A furniture workshop adds value of ${v} on each table and sells ${n} tables a month.`, added: [80, 250], sold: [10, 40, 1] },
  { name: 'T-shirt', text: (v, n) => `A print shop adds value of ${v} on each printed T-shirt and sells ${n} T-shirts a month.`, added: [8, 18], sold: [200, 800, 10] },
  { name: 'pizza', text: (v, n) => `A takeaway adds value of ${v} on each pizza and sells ${n} pizzas a month.`, added: [5, 10], sold: [800, 2400, 50] },
  { name: 'hanging basket', text: (v, n) => `A garden centre adds value of ${v} on each hanging basket and sells ${n} baskets a month.`, added: [8, 20], sold: [100, 400, 10] },
  { name: 'bike', text: (v, n) => `A bike builder adds value of ${v} on each custom-built bike and sells ${n} bikes a month.`, added: [150, 400], sold: [8, 30, 1] },
]

/**
 * q12: value added × quantity − fixed costs, 4 marks. Written: 14 × 350 − 3200 = £1700. The fixed
 * costs are whole hundreds, 45% to 85% of the value added, so the profit is positive and never
 * the fixed costs themselves (V = 2F), the value added per item or the quantity.
 */
const addedProfit = businessBySlot('enterprise-value-added-profit', TOPIC, {
  q12(r, slot) {
    const s = styleOf(slot)
    const c = pick(r, ADDERS)
    const v = int(r, c.added[0], c.added[1])
    const [lo, hi, step] = c.sold
    const n = draw(r, (rr) => lo + step * int(rr, 0, Math.round((hi - lo) / step)), (k) => k !== v)
    const total = v * n
    const fixedOptions = steps(100, total, 100).filter((f) => f >= 0.45 * total && f <= 0.85 * total && !readsOff(total - f, [f, v, n]))
    const fixed = pick(r, fixedOptions)
    const answer = profit(total, fixed)
    const T = (x: number) => texNum(x, s)
    return numericDraft(
      slot,
      {
        prompt: `${c.text(gbp(v, s), num(n, s))} Its fixed costs are ${gbp(fixed, s)} a month. Calculate its profit for the month.`,
        solution: `Total value added $= ${v} \\times ${T(n)} = £${T(total)}$. That is what is left after the bought-in inputs, so profit $= ${T(total)} - ${T(fixed)} = £${T(answer)}$. Added value covers the fixed costs first; only what remains is profit.`,
        method: [`$${v} \\times ${T(n)} = ${T(total)}$`, 'added value understood as covering fixed costs', `$${T(total)} - ${T(fixed)}$`],
        answer,
        line: gbp(answer, s),
      },
      // Second route: the fixed costs spread over the items, taken from each item's value added.
      { agrees: Math.abs((v - fixed / n) * n - answer) < 1e-6, detail: `(${v} − ${fixed}/${n}) × ${n} = ${show((v - fixed / n) * n)}` },
      { context: c.name, added: v, sold: n, fixed },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// q28: percentage increase in profit
// ---------------------------------------------------------------------------------------------

const TRADES = ['dog-grooming', 'window-cleaning', 'catering', 'landscape gardening', 'mobile hairdressing', 'web design', 'cake-making', 'bike repair']
const YEARS = [
  ['first', 'second'],
  ['second', 'third'],
  ['third', 'fourth'],
] as const

/**
 * q28: (new − old) ÷ old × 100, 2 marks. Written: £5000 → £6200, 24%. The percentage is drawn
 * first, 8% to 60% (below 8%, the rise over the new profit rounds to the answer), then the first
 * profit in whole hundreds that make the increase whole tens; no profit reads off as the answer
 * (£2400 with 24%), and £10 000 is left out.
 */
const profitIncrease = businessBySlot('enterprise-profit-percentage-increase', TOPIC, {
  q28(r, slot) {
    const s = styleOf(slot)
    const p = int(r, 8, 60)
    // The rise in whole tens, as accounts round: £5000 → £6200, never £8393.
    const before = pick(r, steps(2000, 40000, 100).filter((a) => Number.isInteger((a * p) / 1000) && !powerOfTen(a) && !readsOff(p, [a, (a * p) / 100, a + (a * p) / 100])))
    const rise = (before * p) / 100
    const after = before + rise
    const who = pick(r, PEOPLE)
    const trade = pick(r, TRADES)
    const form = int(r, 0, 2)
    const [y1, y2] = pick(r, YEARS)
    const prompt =
      form === 0
        ? `An entrepreneur's business made a profit of ${gbp(before, s)} in its ${y1} year and ${gbp(after, s)} in its ${y2} year. Calculate the percentage increase in profit.`
        : form === 1
          ? `${who.name}'s ${trade} business made a profit of ${gbp(before, s)} in its ${y1} year and ${gbp(after, s)} in its ${y2} year. Calculate the percentage increase in profit.`
          : `${who.name} runs a ${trade} business. Its profit rose from ${gbp(before, s)} last year to ${gbp(after, s)} this year. Calculate the percentage increase in profit.`
    const T = (x: number) => texNum(x, s)
    return numericDraft(
      slot,
      {
        prompt,
        solution: `Increase $= ${T(after)} - ${T(before)} = £${T(rise)}$. Percentage increase $= \\dfrac{${T(rise)}}{${T(before)}} \\times 100 = ${p}\\%$. Profit is one of the three rewards on the specification, with business success and independence; the rise shows the reward growing as the business becomes established.`,
        method: [`$\\dfrac{${T(after)} - ${T(before)}}{${T(before)}} \\times 100$`],
        answer: p,
        line: `${p}%`,
      },
      // Second route: the old profit grown by p% gives the new one.
      { agrees: Math.abs(before * (1 + p / 100) - after) < 1e-6 && Math.abs(percentChange(before, after) - p) < 1e-9, detail: `${before} × ${show(1 + p / 100)} = ${show(before * (1 + p / 100))}` },
      { form, person: who.name, trade, before, after, percent: p },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// q30: profit against the salary given up
// ---------------------------------------------------------------------------------------------

/**
 * A business a person could leave a job to run, with the revenue it could make in its first year
 * and its profit as a share of that revenue: food businesses buy ingredients for every sale, so
 * keep 20% to 42%; service businesses, mostly the owner's time, 25% to 65%.
 */
const FOOD: [number, number] = [0.2, 0.42]
const SERVICE: [number, number] = [0.25, 0.65]
const VENTURES: { name: string; revenue: [number, number]; margin: [number, number] }[] = [
  { name: 'catering business', revenue: [40000, 150000], margin: FOOD },
  { name: 'plumbing business', revenue: [50000, 150000], margin: SERVICE },
  { name: 'dog-grooming business', revenue: [40000, 90000], margin: SERVICE },
  { name: 'landscape gardening business', revenue: [40000, 150000], margin: SERVICE },
  { name: 'web design business', revenue: [40000, 120000], margin: SERVICE },
  { name: 'wedding photography business', revenue: [40000, 100000], margin: SERVICE },
  { name: 'bakery', revenue: [60000, 180000], margin: FOOD },
  { name: 'mobile hairdressing business', revenue: [40000, 80000], margin: SERVICE },
]

/**
 * q30: (revenue − total costs) − salary, 3 marks. Written: (84 000 − 52 000) − 26 000 = £6000.
 * The answer is drawn first (£500 to £15 000), then the salary (£18 000 to £40 000), then a
 * revenue in whole thousands with the profit in the venture's margin range. Total costs never equal the
 * profit (revenue twice the profit) nor any other figure, so costs − salary does not pay.
 */
const salaryGivenUp = businessBySlot('enterprise-profit-against-salary', TOPIC, {
  q30(r, slot) {
    const s = styleOf(slot)
    const venture = pick(r, VENTURES)
    const who = pick(r, PEOPLE)
    const [rLo, rHi] = venture.revenue
    const [mLo, mHi] = venture.margin
    const more = 100 * int(r, 5, 150)
    const revenues = (salary: number) => {
      const made = salary + more
      return steps(1000 * Math.ceil(Math.max(rLo, made / mHi) / 1000), 1000 * Math.floor(Math.min(rHi, made / mLo) / 1000), 1000).filter((rev) => {
        const costs = rev - made
        return rev !== 2 * made && ![salary, more, made].includes(costs) && !readsOff(more, [rev, costs, salary])
      })
    }
    // Only salaries that leave a revenue in the venture's range and clear of every coincidence.
    const salary = pick(r, steps(18000, 40000, 500).filter((sal) => sal !== more && revenues(sal).length > 0))
    const made = salary + more
    const rev = pick(r, revenues(salary))
    const costs = rev - made
    const T = (x: number) => texNum(x, s)
    const answer = profit(rev, costs) - salary
    return numericDraft(
      slot,
      {
        prompt: `${who.name} earned a salary of ${gbp(salary, s)} a year. ${cap(who.she)} left ${who.her} job to run ${who.her} own ${venture.name}. In its first year the business had revenue of ${gbp(rev, s)} and total costs of ${gbp(costs, s)}. Calculate how much more ${who.name} earned from the business in that year than ${who.she} would have earned from ${who.her} salary.`,
        solution: `Profit $=$ revenue $-$ total costs $= ${T(rev)} - ${T(costs)} = £${T(made)}$. Compared with the salary ${who.she} gave up: $${T(made)} - ${T(salary)} = £${T(answer)}$ more. The ${gbp(salary, s)} salary is what ${who.she} risked by leaving: had the business made a profit under ${gbp(salary, s)} ${who.she} would have been worse off, and with no sick pay or holiday pay ${who.she} also gave up security to earn the extra ${gbp(answer, s)}.`,
        method: [`$${T(rev)} - ${T(costs)} = ${T(made)}$`, `$${T(made)} - ${T(salary)}$`],
        answer,
        line: gbp(answer, s),
      },
      // Second route: the salary, the extra and the costs together use up the revenue.
      { agrees: salary + answer + costs === rev && answer === more, detail: `${salary} + ${answer} + ${costs} = ${salary + answer + costs}` },
      { person: who.name, venture: venture.name, salary, revenue: rev, costs },
    )
  },
})

const cap = (w: string) => w[0]!.toUpperCase() + w.slice(1)

export const enterpriseGenerators: Generator[] = [craftAdded, makerAdded, totalAdded, addedProfit, profitIncrease, salaryGivenUp]

/** For the tests. */
export const ENTERPRISE = { CRAFTS, MAKERS, SELLERS, ADDERS, VENTURES, PEOPLE, TRADES, pairs }
