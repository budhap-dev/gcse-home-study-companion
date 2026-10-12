import type { Question } from '../../content/questions.ts'
import { roundTo, show } from '../format.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import type { Draft, Generator } from '../types.ts'
import {
  breakEven,
  businessBySlot,
  closingBalance,
  gbp,
  interestPercent,
  marginOfSafety,
  near,
  netCashFlow,
  num,
  numericDraft,
  profit,
  revenue,
  steps,
  stepped,
  styleOf,
  texGbp,
  texNum,
  texPounds,
  totalCosts,
  type Style,
} from './build.ts'

/**
 * Putting a business idea into practice (Pearson Edexcel 1BS0, Topic 1.3). Every numeric written
 * slot in the topic has a generator here, one per slot:
 *
 * - 1.3.2 revenues, costs and profits: revenue (q1), total costs (q3), profit from revenue and
 *   costs (q5), break-even level of output (q6), margin of safety (q7), break-even after a price
 *   rise (q11), profit from price, costs and sales (q13); interest on a loan as a percentage of
 *   the amount borrowed, from the total repaid (q12) and from monthly instalments (q26).
 * - 1.3.3 cash and cash-flow: net cash flow (q8) and from a list of items (q24), opening and
 *   closing balances (q9, q25) and over two months (q14).
 *
 * The formulae are Appendix 3's, from build.ts; each check reaches the answer a second way
 * (revenue equal to total costs at break-even, the balance worked back to the opening one).
 *
 * Each answer is drawn first and the givens fitted to it, in the scale of a small business of
 * the kind named. The advanced sheet also prints q23 (fixed costs £8000, price £20, variable
 * cost £12, break-even 1000) and q28 (a coffee van: £1200 a month, £3 a cup, £1 a cup, 750
 * cups), so q11 and q13 never use the coffee van and never print q23's figures; and q11 only
 * ever raises a price, since a rise in cost per unit is what q17 asks about.
 */
const TOPIC = 'putting-a-business-idea-into-practice'

// ---------------------------------------------------------------------------------------------
// Printing and drawing
// ---------------------------------------------------------------------------------------------

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
const sizes = (...xs: number[]) => new Set(xs.map((x) => Math.abs(roundTo(x, 2)))).size === xs.length

// Printing that only this topic's cash-flow questions need; figures and pounds inside $…$ come
// from build.ts (texNum, texPounds, texGbp).

/** A signed term after a plus in maths: 2000 + 500, 1500 + (-2000). */
const term = (x: number, style: Style) => (x < 0 ? `(${texPounds(x, style)})` : texPounds(x, style))
/** The written mark scheme's sum, as a subtraction when the term is negative: 1500 - 2000. */
const plusOrMinus = (a: number, b: number, style: Style) => `${texPounds(a, style)} ${b < 0 ? '-' : '+'} ${texPounds(Math.abs(b), style)}`
/** A net cash flow in a prompt, as the written ones print it: $-£2000$, £2000; with `signed`, $+£500$. */
const flow = (x: number, style: Style, signed = false) => (x < 0 ? `$${texGbp(x, style)}$` : signed ? `$+${texGbp(x, style)}$` : gbp(x, style))
/** A balance in a prompt: £1500, or $-£800$ (an overdraft). */
const balance = (x: number, style: Style) => (x < 0 ? `$${texGbp(x, style)}$ (an overdraft)` : gbp(x, style))

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WORDS = ['', 'one', 'two', 'three', 'four', 'five']

// ---------------------------------------------------------------------------------------------
// q1: revenue
// ---------------------------------------------------------------------------------------------

interface Sale {
  seller: string
  verb: string
  items: string
  /** [lo, hi, step] in pounds; a price step under £1 goes with sales in tens, so revenue is whole. */
  price: [number, number, number]
  quantity: [number, number, number]
  period: 'day' | 'week' | 'month'
}
const SALES: Sale[] = [
  { seller: 'a coffee stall', verb: 'sells', items: 'cups of coffee', price: [2.2, 3.8, 0.1], quantity: [80, 300, 10], period: 'day' },
  { seller: 'a florist', verb: 'sells', items: 'bouquets', price: [20, 60, 1], quantity: [15, 90, 1], period: 'week' },
  { seller: 'a jeweller', verb: 'sells', items: 'necklaces', price: [25, 120, 5], quantity: [8, 60, 1], period: 'month' },
  { seller: 'a homeware shop', verb: 'sells', items: 'kettles', price: [15, 60, 1], quantity: [20, 150, 1], period: 'month' },
  { seller: 'a bakery', verb: 'sells', items: 'loaves of bread', price: [1.8, 4.5, 0.1], quantity: [60, 250, 10], period: 'day' },
  { seller: 'a bicycle shop', verb: 'sells', items: 'bicycles', price: [250, 900, 10], quantity: [6, 40, 1], period: 'month' },
  { seller: 'a hairdresser', verb: 'gives', items: 'haircuts', price: [15, 45, 1], quantity: [60, 250, 1], period: 'month' },
  { seller: 'a sandwich bar', verb: 'sells', items: 'sandwiches', price: [3, 6.5, 0.1], quantity: [80, 300, 10], period: 'day' },
  { seller: 'a car wash', verb: 'washes', items: 'cars', price: [8, 20, 1], quantity: [100, 600, 10], period: 'month' },
  { seller: 'a pizza takeaway', verb: 'sells', items: 'pizzas', price: [8, 16, 0.5], quantity: [150, 700, 10], period: 'week' },
  { seller: 'a business', verb: 'sells', items: 'units of its product', price: [5, 50, 1], quantity: [100, 2000, 10], period: 'month' },
]

function buildRevenue(r: Rng, slot: Question): Draft {
  const style = styleOf(slot)
  const c = pick(r, SALES)
  const p = stepped(r, ...c.price)
  const q = stepped(r, ...c.quantity)
  const R = roundTo(revenue(p, q), 2)
  const prompt = pick(r, [
    () => `${cap(c.seller)} ${c.verb} ${num(q, style)} ${c.items} at ${gbp(p, style)} each in one ${c.period}. Calculate its revenue for the ${c.period}.`,
    () => `In one ${c.period}, ${c.seller} ${c.verb} ${num(q, style)} ${c.items} at ${gbp(p, style)} each. Calculate its revenue.`,
  ])()
  return numericDraft(
    slot,
    {
      prompt,
      solution: `Revenue $=$ price $\\times$ quantity $= ${texPounds(p, style)} \\times ${texNum(q, style)} = ${texGbp(R, style)}$.`,
      method: [`$${texPounds(p, style)} \\times ${texNum(q, style)}$`],
      answer: R,
    },
    // Second route: the revenue shared over the sales gives the price back.
    { agrees: near(R / q, p), detail: `${show(R)} ÷ ${q} = ${show(R / q)}` },
    { context: c.seller, price: p, quantity: q, revenue: R },
  )
}

// ---------------------------------------------------------------------------------------------
// q3: total costs
// ---------------------------------------------------------------------------------------------

interface Maker {
  who: string
  unit: string
  units: string
  fixed: [number, number, number]
  variable: [number, number, number]
  output: [number, number, number]
}
const MAKERS: Maker[] = [
  { who: 'a business', unit: 'unit', units: 'units', fixed: [800, 6000, 100], variable: [2, 15, 1], output: [100, 900, 10] },
  { who: 'a bakery', unit: 'loaf', units: 'loaves', fixed: [1500, 4000, 100], variable: [0.3, 1.2, 0.1], output: [1500, 6000, 100] },
  { who: 'a furniture workshop', unit: 'table', units: 'tables', fixed: [1500, 5000, 100], variable: [40, 150, 5], output: [8, 40, 1] },
  { who: 'a T-shirt printer', unit: 'T-shirt', units: 'T-shirts', fixed: [800, 3000, 100], variable: [2.5, 8, 0.5], output: [200, 1000, 10] },
  { who: 'a candle maker', unit: 'candle', units: 'candles', fixed: [400, 1500, 50], variable: [1.2, 4, 0.1], output: [200, 1200, 10] },
  { who: 'a cake maker', unit: 'cake', units: 'cakes', fixed: [600, 2000, 100], variable: [4, 12, 0.5], output: [60, 300, 10] },
]

function buildTotalCosts(r: Rng, slot: Question): Draft {
  const style = styleOf(slot)
  const c = pick(r, MAKERS)
  // The written question's fixed costs equal its variable costs (£1200 each): never here.
  const { F, v, q } = draw(
    r,
    (r) => ({ F: stepped(r, ...c.fixed), v: stepped(r, ...c.variable), q: stepped(r, ...c.output) }),
    ({ F, v, q }) => !near(F, v * q) && sizes(F, v, q, v * q),
  )
  const V = roundTo(v * q, 2)
  const T = roundTo(totalCosts(F, v, q), 2)
  const prompt = pick(r, [
    () => `${cap(c.who)} has fixed costs of ${gbp(F, style)} a month and variable costs of ${gbp(v, style)} per ${c.unit}. It makes ${num(q, style)} ${c.units}. Calculate its total costs for the month.`,
    () => `In one month ${c.who} makes ${num(q, style)} ${c.units}. Its fixed costs are ${gbp(F, style)} a month and its variable cost is ${gbp(v, style)} per ${c.unit}. Calculate its total costs for the month.`,
  ])()
  return numericDraft(
    slot,
    {
      prompt,
      solution: `Total costs $=$ fixed $+$ variable $= ${texPounds(F, style)} + ${texPounds(v, style)} \\times ${texNum(q, style)} = ${texPounds(F, style)} + ${texPounds(V, style)} = ${texGbp(T, style)}$.`,
      method: [`$${texPounds(F, style)} + ${texPounds(v, style)} \\times ${texNum(q, style)}$`],
      answer: T,
    },
    // Second route: take the fixed costs away and share the rest over the output.
    { agrees: near((T - F) / q, v), detail: `(${show(T)} − ${F}) ÷ ${q} = ${show((T - F) / q)}` },
    { context: c.who, fixed: F, variable: v, output: q, total: T },
  )
}

// ---------------------------------------------------------------------------------------------
// q5: profit from revenue and costs
// ---------------------------------------------------------------------------------------------

interface Trader {
  who: string
  year: boolean
}
const TRADERS: Trader[] = [
  { who: 'a business', year: false },
  { who: 'a café', year: false },
  { who: 'a gift shop', year: false },
  { who: 'a bakery', year: false },
  { who: 'a sandwich bar', year: false },
  { who: 'a small hotel', year: true },
  { who: 'a garden centre', year: true },
]

function buildProfit(r: Rng, slot: Question): Draft {
  const style = styleOf(slot)
  const c = pick(r, TRADERS)
  const k = c.year ? 10 : 1
  const step = 100 * k
  // The profit first, then the costs; revenue is what they add to. The written profit equalled
  // its fixed costs (£2500): no profit here equals a cost or the total costs.
  // Profit at most 40% of revenue and variable costs at least a quarter of it, as a real shop's are.
  const P = stepped(r, 500 * k, 6000 * k, step)
  const { F, V } = draw(
    r,
    (r) => ({ F: stepped(r, 1000 * k, 8000 * k, step), V: stepped(r, 1000 * k, 12000 * k, step) }),
    ({ F, V }) => {
      const R = P + F + V
      return P <= 0.4 * R && V >= 0.25 * R && sizes(P, F, V, F + V, R)
    },
  )
  const T = F + V
  const R = P + T
  const month = pick(r, MONTHS)
  const when = c.year ? 'last year' : `in ${month}`
  const forWhen = c.year ? 'for the year' : `for ${month}`
  const prompt = pick(r, [
    () => `${cap(c.who)} has revenue of ${gbp(R, style)}, fixed costs of ${gbp(F, style)} and variable costs of ${gbp(V, style)} ${when}. Calculate its profit ${forWhen}.`,
    () => `${cap(when)}, ${c.who} took ${gbp(R, style)} in revenue. Its fixed costs ${forWhen} were ${gbp(F, style)} and its variable costs were ${gbp(V, style)}. Calculate its profit ${forWhen}.`,
  ])()
  return numericDraft(
    slot,
    {
      prompt,
      solution: `Total costs $= ${texPounds(F, style)} + ${texPounds(V, style)} = ${texGbp(T, style)}$. Profit $=$ revenue $-$ total costs $= ${texPounds(R, style)} - ${texPounds(T, style)} = ${texGbp(P, style)}$.`,
      method: [`total costs $= ${texPounds(F, style)} + ${texPounds(V, style)} = ${texPounds(T, style)}$`, `$${texPounds(R, style)} - ${texPounds(T, style)}$`],
      answer: P,
    },
    // Second route: each cost taken off the revenue in turn, variable first.
    { agrees: R - V - F === P && profit(R, T) === P, detail: `${R} − ${V} − ${F} = ${R - V - F}` },
    { context: c.who, revenue: R, fixed: F, variable: V, profit: P },
  )
}

// ---------------------------------------------------------------------------------------------
// Break-even (q6, q11, q13) and margin of safety (q7)
// ---------------------------------------------------------------------------------------------

interface Product {
  name: string
  who: string
  /** One unit, and what the business sells: "bouquet", "bouquets". */
  unit: string
  units: string
  prices: number[]
  /** The step a variable cost takes: £1, £10 for a bicycle, 50p for a cup of coffee. */
  vcStep: number
  /** Variable cost as a share of the price. */
  share: [number, number]
  /** Break-even output a month: [lo, hi, step]. The hi is also the most it sells in a month (q13) and the old break-even's limit (q11). */
  be: [number, number, number]
  /** Fixed costs a month: [lo, hi]. A shop pays at least about £1500 in rent, rates and wages; a coffee van about £400. */
  fixed: [number, number]
  /** Fixed costs are a month's; the generic business, as written, names no period. */
  monthly: boolean
  /** What a prompt says it sells, where that is not just the units: "cups of coffee". */
  sells?: string
}
const PRODUCTS: Product[] = [
  // The generic business stays near the written scale (£6000, £25, 400 units): fixed costs under £30 000.
  { name: 'generic', who: 'a business', unit: 'unit', units: 'units', prices: steps(10, 40, 1), vcStep: 1, share: [0.3, 0.7], be: [100, 1000, 10], fixed: [1000, 30000], monthly: false },
  { name: 'florist', who: 'a florist', unit: 'bouquet', units: 'bouquets', prices: steps(20, 60, 1), vcStep: 1, share: [0.35, 0.55], be: [40, 300, 5], fixed: [1500, 10000], monthly: true },
  { name: 'jeweller', who: 'a jeweller', unit: 'necklace', units: 'necklaces', prices: steps(25, 120, 5), vcStep: 1, share: [0.3, 0.5], be: [15, 120, 5], fixed: [1500, 9000], monthly: true },
  { name: 'kettles', who: 'a homeware shop', unit: 'kettle', units: 'kettles', prices: steps(15, 60, 1), vcStep: 1, share: [0.5, 0.7], be: [40, 250, 10], fixed: [1500, 7500], monthly: true },
  { name: 'T-shirts', who: 'a T-shirt printer', unit: 'T-shirt', units: 'T-shirts', prices: steps(10, 25, 1), vcStep: 1, share: [0.25, 0.5], be: [150, 600, 10], fixed: [1500, 10000], monthly: true },
  { name: 'bicycles', who: 'a bicycle shop', unit: 'bicycle', units: 'bicycles', prices: steps(250, 900, 10), vcStep: 10, share: [0.5, 0.7], be: [8, 40, 1], fixed: [1500, 15000], monthly: true },
  { name: 'coffee', who: 'a coffee van', unit: 'cup', units: 'cups', prices: [2.5, 3, 3.5, 4], vcStep: 0.5, share: [0.12, 0.45], be: [300, 1200, 10], fixed: [400, 4000], monthly: true, sells: 'cups of coffee' },
]
/** q11 and q13 sit on the advanced sheet beside q28's coffee van. */
const ADVANCED = PRODUCTS.filter((p) => p.name !== 'coffee')

/** The variable costs per unit that fit a price: in the context's share, and never equal to the contribution (F ÷ v would pay). */
const variableCosts = (c: Product, p: number) =>
  steps(c.vcStep, p, c.vcStep).filter((v) => v / p >= c.share[0] - 1e-9 && v / p <= c.share[1] + 1e-9 && !near(v, p - v) && v < p)

/** Every price and variable cost the context allows. */
const PRICE_COSTS = new Map(PRODUCTS.map((c) => [c.name, c.prices.flatMap((p) => variableCosts(c, p).map((v) => ({ p, v })))]))
/** Fixed costs in the context's range for a month. */
const fixedFits = (c: Product, F: number) => F >= c.fixed[0] && F <= c.fixed[1]

/** q23's figures: fixed costs £8000 (then £8800), price £20, variable cost £12. */
const isQ23 = (F: number, p: number, v: number) => (F === 8000 || F === 8800) && p === 20 && v === 12

/** "a month" after a fixed cost, where the context has a period. */
const monthly = (c: Product) => (c.monthly ? ' a month' : '')
/** What the business sells, as a prompt names it: "its product", "bouquets". */
const sells = (c: Product) => (c.name === 'generic' ? 'its product' : (c.sells ?? c.units))
/** A count of units, with what they are where the context names them: "120 units, which is 120 bouquets a month". */
const unitsAre = (c: Product, n: number, style: Style) => (c.name === 'generic' ? '' : `, which is ${num(n, style)} ${c.units} a month`)

function buildBreakEven(r: Rng, slot: Question): Draft {
  const style = styleOf(slot)
  const c = pick(r, PRODUCTS)
  // The break-even output first, then a price and cost per unit; the fixed costs follow.
  const { B, p, v } = draw(
    r,
    (r) => {
      const B = stepped(r, ...c.be)
      const fits = PRICE_COSTS.get(c.name)!.filter(({ p, v }) => fixedFits(c, B * (p - v)) && sizes(B, p, v, p - v, B * (p - v)))
      return fits.length ? { B, ...pick(r, fits) } : { B, p: NaN, v: NaN }
    },
    ({ p }) => !Number.isNaN(p),
  )
  const cu = roundTo(p - v, 2)
  const F = roundTo(B * cu, 2)
  const prompt = pick(r, [
    () => `${cap(c.who)} has fixed costs of ${gbp(F, style)}${monthly(c)}. It sells ${sells(c)} for ${gbp(p, style)}${c.name === 'generic' ? '' : ' each'} and the variable cost per ${c.unit} is ${gbp(v, style)}. Calculate the break-even level of output.`,
    () => `${cap(c.who)} sells ${sells(c)} at ${gbp(p, style)} ${c.name === 'generic' ? 'per unit' : 'each'}. Each ${c.unit} has a variable cost of ${gbp(v, style)}, and the fixed costs are ${gbp(F, style)}${monthly(c)}. Calculate the break-even level of output.`,
  ])()
  return numericDraft(
    slot,
    {
      prompt,
      solution: `Break-even $=$ fixed costs $\\div$ (price $-$ variable cost per unit) $= ${texPounds(F, style)} \\div (${texPounds(p, style)} - ${texPounds(v, style)}) = ${texPounds(F, style)} \\div ${texPounds(cu, style)} = ${texNum(B, style)}$ units${unitsAre(c, B, style)}. Each sale contributes ${gbp(cu, style)} towards the ${gbp(F, style)} of fixed costs.`,
      method: [`$${texPounds(p, style)} - ${texPounds(v, style)} = ${texPounds(cu, style)}$`, `$${texPounds(F, style)} \\div ${texPounds(cu, style)}$`],
      answer: B,
    },
    // Second route: at break-even, revenue equals total costs.
    { agrees: near(revenue(p, B), totalCosts(F, v, B)) && near(breakEven(F, p, v), B), detail: `${p} × ${B} = ${show(p * B)}; ${F} + ${v} × ${B} = ${show(F + v * B)}` },
    { context: c.name, fixed: F, price: p, variable: v, breakEven: B },
  )
}

function buildMarginOfSafety(r: Rng, slot: Question): Draft {
  const style = styleOf(slot)
  const c = pick(r, PRODUCTS)
  const budgeted = r() < 0.5
  // Break-even first, then the margin in the context's steps: actual sales 1.15 to 2.8 times
  // break-even, never exactly twice it (the margin would equal break-even) and never 100 (the
  // margin as a percentage of sales would equal the margin).
  const B = pick(r, steps(...c.be).filter((b) => b !== 100))
  const [, , step] = c.be
  const lo = Math.max(step, Math.ceil((0.15 * B) / step) * step)
  const hi = Math.floor((1.8 * B) / step) * step
  const M = pick(
    r,
    steps(lo, hi, step).filter((m) => m !== B && B + m !== 100),
  )
  const A = B + M
  const per = c.monthly ? ' a month' : ''
  const what = c.name === 'generic' ? 'units' : c.units
  const prompt = budgeted
    ? `${cap(c.who)}'s break-even level of output is ${num(B, style)} ${what}${per}. It expects to sell ${num(A, style)} ${what}${per}. Calculate its margin of safety.`
    : pick(r, [
        () => `${cap(c.who)} breaks even at ${num(B, style)} ${what}${per} and actually sells ${num(A, style)}${per}. Calculate its margin of safety.`,
        () => `${cap(c.who)} actually sells ${num(A, style)} ${what}${per}. Its break-even level of output is ${num(B, style)} ${what}${per}. Calculate its margin of safety.`,
      ])()
  const sales = budgeted ? 'budgeted sales' : 'actual output'
  const after = budgeted
    ? `If it sells as many as it expects, sales could fall by ${num(M, style)} before it makes a loss.`
    : `Sales could fall by ${num(M, style)} before it makes a loss.`
  return numericDraft(
    slot,
    {
      prompt,
      solution: `Margin of safety $=$ ${sales} $-$ break-even output $= ${texNum(A, style)} - ${texNum(B, style)} = ${texNum(M, style)}$ units. ${after}`,
      method: [`$${texNum(A, style)} - ${texNum(B, style)}$`],
      answer: marginOfSafety(A, B),
    },
    // Second route: break-even plus the margin is the sales.
    { agrees: B + M === A && marginOfSafety(A, B) === M, detail: `${B} + ${M} = ${B + M}` },
    { context: c.name, budgeted: budgeted ? 'budgeted' : 'actual', breakEven: B, sales: A, margin: M },
  )
}

interface Rise {
  p1: number
  p2: number
  v: number
}
/** Every price rise of 8% to 40% the context allows, with its variable cost. */
const RISES = new Map<string, Rise[]>(
  ADVANCED.map((c) => [
    c.name,
    c.prices.flatMap((p1) =>
      variableCosts(c, p1).flatMap((v) => c.prices.filter((p2) => p2 > p1 && (p2 - p1) / p1 >= 0.08 && (p2 - p1) / p1 <= 0.4 && !near(v, p2 - v)).map((p2) => ({ p1, p2, v }))),
    ),
  ]),
)

function buildPriceRise(r: Rng, slot: Question): Draft {
  const style = styleOf(slot)
  const c = pick(r, ADVANCED)
  // The new break-even first; then a price rise whose contributions both divide the fixed
  // costs, so the old break-even the solution compares with is whole too.
  const { B2, x } = draw(
    r,
    (r) => {
      const B2 = stepped(r, ...c.be)
      const fits = RISES.get(c.name)!.filter(({ p1, p2, v }) => {
        const F = B2 * (p2 - v)
        const B1 = F / (p1 - v)
        // Never a doubled contribution: the old break-even would be twice the new, so the fall paid.
        return Number.isInteger(roundTo(B1, 9)) && B1 <= c.be[1] && fixedFits(c, F) && !near(p2 - v, 2 * (p1 - v)) && !isQ23(F, p1, v) && !isQ23(F, p2, v) && sizes(B2, B1, F, p1, p2, v, p2 - v, p1 - v)
      })
      return { B2, x: fits.length ? pick(r, fits) : undefined }
    },
    ({ x }) => x !== undefined,
  )
  const { p1, p2, v } = x!
  const c1 = p1 - v
  const c2 = p2 - v
  const F = B2 * c2
  const B1 = roundTo(F / c1, 9)
  const per = monthly(c)
  const prompt = pick(r, [
    () =>
      `${cap(c.who)} has fixed costs of ${gbp(F, style)}${per}, a variable cost of ${gbp(v, style)} per ${c.unit} and sells at ${gbp(p1, style)}${c.name === 'generic' ? '' : ` a ${c.unit}`}. It raises its price to ${gbp(p2, style)}. Calculate the new break-even level of output.`,
    () =>
      `${cap(c.who)} sells ${sells(c)} at ${gbp(p1, style)} ${c.name === 'generic' ? 'per unit' : 'each'}. The variable cost per ${c.unit} is ${gbp(v, style)} and the fixed costs are ${gbp(F, style)}${per}. It then puts its price up to ${gbp(p2, style)}. Calculate the new break-even level of output.`,
  ])()
  return numericDraft(
    slot,
    {
      prompt,
      solution:
        `New contribution per unit $= ${texPounds(p2, style)} - ${texPounds(v, style)} = ${texGbp(c2, style)}$. Break-even $= ${texPounds(F, style)} \\div ${texPounds(c2, style)} = ${texNum(B2, style)}$ units, down from ${num(B1, style)}. ` +
        `A higher price means each sale covers more fixed cost, so fewer sales are needed; the risk is that fewer customers buy at ${gbp(p2, style)}.`,
      method: [`$${texPounds(p2, style)} - ${texPounds(v, style)} = ${texPounds(c2, style)}$`, `$${texPounds(F, style)} \\div ${texPounds(c2, style)}$`],
      answer: B2,
    },
    // Second route: at the new break-even, revenue at the new price equals total costs.
    { agrees: near(revenue(p2, B2), totalCosts(F, v, B2)) && near(breakEven(F, p2, v), B2), detail: `${p2} × ${B2} = ${p2 * B2}; ${F} + ${v} × ${B2} = ${F + v * B2}` },
    { context: c.name, fixed: F, oldPrice: p1, newPrice: p2, variable: v, oldBreakEven: B1, breakEven: B2 },
  )
}

function buildProfitFromSales(r: Rng, slot: Question): Draft {
  const style = styleOf(slot)
  const c = pick(r, ADVANCED)
  // Break-even and the margin above it first: the profit is the margin times the contribution.
  // Sales 1.15 to 2.5 times break-even.
  // Sales never pass the most the context sells in a month (its break-even limit).
  const [, , step] = c.be
  const { B, p, v, M } = draw(
    r,
    (r) => {
      const B = pick(r, steps(...c.be).filter((b) => Math.ceil((0.15 * b) / step) * step + b <= c.be[1]))
      const lo = Math.max(step, Math.ceil((0.15 * B) / step) * step)
      const hi = Math.min(Math.floor((1.5 * B) / step) * step, c.be[1] - B)
      const M = pick(r, steps(lo, Math.max(lo, hi), step))
      const fits = PRICE_COSTS.get(c.name)!.filter(({ p, v }) => fixedFits(c, B * (p - v)) && !isQ23(B * (p - v), p, v))
      return fits.length ? { B, M, ...pick(r, fits) } : { B, M, p: NaN, v: NaN }
    },
    ({ B, p, v, M }) => {
      if (Number.isNaN(p)) return false
      const F = B * (p - v)
      const Q = B + M
      return Q <= c.be[1] && M !== B && sizes(F, p, v, Q, p * Q, v * Q, F + v * Q, M * (p - v), p - v, B, M)
    },
  )
  const cu = p - v
  const F = B * cu
  const Q = B + M
  const Rv = revenue(p, Q)
  const VC = v * Q
  const T = totalCosts(F, v, Q)
  const P = profit(Rv, T)
  const per = monthly(c)
  const prompt = pick(r, [
    () =>
      `${cap(c.who)} sells at ${gbp(p, style)} per ${c.unit} with a variable cost of ${gbp(v, style)} per ${c.unit} and fixed costs of ${gbp(F, style)}${per}. It sells ${num(Q, style)} ${c.units}${per}. Calculate its profit${c.monthly ? ' for one month' : ''}.`,
    () =>
      `${cap(c.who)} sells ${sells(c)} for ${gbp(p, style)} ${c.name === 'generic' ? 'per unit' : 'each'}. Each ${c.unit} has a variable cost of ${gbp(v, style)}, and the fixed costs are ${gbp(F, style)}${per}. ${c.monthly ? 'In one month it' : 'It'} sells ${num(Q, style)} ${c.units}. Calculate its profit${c.monthly ? ' for the month' : ''}.`,
  ])()
  return numericDraft(
    slot,
    {
      prompt,
      solution:
        `Revenue $= ${texPounds(p, style)} \\times ${texNum(Q, style)} = ${texGbp(Rv, style)}$. Total costs $= ${texPounds(F, style)} + ${texPounds(v, style)} \\times ${texNum(Q, style)} = ${texPounds(F, style)} + ${texPounds(VC, style)} = ${texGbp(T, style)}$. ` +
        `Profit $= ${texPounds(Rv, style)} - ${texPounds(T, style)} = ${texGbp(P, style)}$. Check: break-even is $${texPounds(F, style)} \\div ${texPounds(cu, style)} = ${texNum(B, style)}$ units, and the ${num(M, style)} units above it each contribute ${gbp(cu, style)}, which is ${gbp(P, style)}.`,
      method: [`revenue $= ${texPounds(Rv, style)}$`, `variable costs $= ${texPounds(VC, style)}$`, `total costs $= ${texPounds(T, style)}$`],
      answer: P,
    },
    // Second route: each unit above break-even contributes p − v.
    { agrees: near(M * cu, P), detail: `${M} × ${cu} = ${M * cu}` },
    { context: c.name, fixed: F, price: p, variable: v, sold: Q, breakEven: B, profit: P },
  )
}

// ---------------------------------------------------------------------------------------------
// Cash flow: q8, q24, q9, q25, q14
// ---------------------------------------------------------------------------------------------

const FIRMS = ['a café', 'a building firm', 'a garden centre', 'a bakery', 'a gift shop', 'a small hotel', 'a hairdresser', 'a printing firm']

/** Why the sign matters, after a net cash flow or closing balance. */
const flowNote = (n: number) => (n < 0 ? ' The negative figure means more cash left the business than came into it that month.' : '')
function balanceNote(closing: number, opening: number) {
  if (closing < 0) return 'A negative closing balance means the business needs an overdraft or it cannot pay its bills.'
  if (opening < 0) return 'The business has cleared its overdraft and has cash in the bank again.'
  if (closing < opening) return 'The business still has cash, but less than it started the month with.'
  return 'The business ends the month with more cash than it started with.'
}

function buildNetCashFlow(r: Rng, slot: Question): Draft {
  const style = styleOf(slot)
  // The net cash flow first: positive in two builds in three, as the written one is.
  const sign = r() < 2 / 3 ? 1 : -1
  const { N, I } = draw(
    r,
    (r) => ({ N: sign * stepped(r, 200, 6000, 100), I: stepped(r, 3000, 20000, 100) }),
    ({ N, I }) => I - N >= 1500 && sizes(N, I, I - N),
  )
  const X = I - N
  const who = pick(r, FIRMS)
  const month = pick(r, MONTHS)
  const prompt = pick(r, [
    () => `In one month a business has cash inflows of ${gbp(I, style)} and cash outflows of ${gbp(X, style)}. Calculate its net cash flow.`,
    () => `In ${month}, ${who} receives ${gbp(I, style)} in cash and pays out ${gbp(X, style)}. Calculate its net cash flow for ${month}.`,
    () => `${cap(who)}'s cash inflows for ${month} are ${gbp(I, style)} and its cash outflows are ${gbp(X, style)}. Calculate its net cash flow for ${month}.`,
  ])()
  return numericDraft(
    slot,
    {
      prompt,
      solution: `Net cash flow $=$ inflows $-$ outflows $= ${texPounds(I, style)} - ${texPounds(X, style)} = ${texGbp(N, style)}$.${flowNote(N)}`,
      method: [`$${texPounds(I, style)} - ${texPounds(X, style)}$`],
      answer: netCashFlow(I, X),
    },
    // Second route: the outflows plus the net cash flow are the inflows.
    { agrees: X + N === I, detail: `${X} + (${N}) = ${X + N}` },
    { sign: sign > 0 ? 'positive' : 'negative', inflows: I, outflows: X, net: N },
  )
}

interface Inflow {
  /** The prompt's words after "£1500 from …" or "£1500 …". */
  text: (amount: string) => string
  why: string
}
const OTHER_INFLOWS: Inflow[] = [
  { text: (a) => `${a} from a bank loan`, why: 'The loan counts as an inflow because cash arrived, even though it is not revenue and will have to be repaid.' },
  { text: (a) => `${a} of the owner's own savings`, why: "The owner's savings count as an inflow because cash came into the business, even though they are not revenue." },
  { text: (a) => `${a} from selling an old van`, why: 'The money from the van counts as an inflow because cash arrived, even though it is not from selling the products the business makes.' },
  { text: (a) => `${a} from a local council grant`, why: 'The grant counts as an inflow because cash arrived, even though it is not revenue.' },
]
/** The third outflow beside suppliers and wages; a loan repayment never in a month a loan arrives. */
const THIRD_OUTFLOWS: { name: string; share: [number, number] }[] = [
  { name: 'rent', share: [0.1, 0.25] },
  { name: 'loan repayments', share: [0.08, 0.2] },
  { name: 'electricity', share: [0.05, 0.12] },
  { name: 'advertising', share: [0.05, 0.12] },
  { name: 'insurance', share: [0.04, 0.1] },
]
/**
 * Firms whose month of sales the list fits (a hotel or garden centre takes far more), and whose
 * largest outflow is paying suppliers: a hairdresser's would be wages.
 */
const ITEM_FIRMS = ['a business', 'a café', 'a bakery', 'a gift shop', 'a printing firm', 'a building firm']

function buildCashFlowItems(r: Rng, slot: Question): Draft {
  const style = styleOf(slot)
  const other = pick(r, OTHER_INFLOWS)
  const loan = other === OTHER_INFLOWS[0]
  const third = pick(r, THIRD_OUTFLOWS.filter((t) => !(loan && t.name === 'loan repayments')))
  // The net cash flow first, then the inflows; the outflows split what is left: suppliers
  // largest, then wages, then the third item.
  const sign = r() < 0.7 ? 1 : -1
  const x = draw(
    r,
    (r) => {
      const N = sign * stepped(r, 200, 2500, 100)
      const S = stepped(r, 3000, 15000, 100)
      const L = stepped(r, 500, 4000, 100)
      const T = S + L - N
      const oth = Math.round((T * (third.share[0] + (third.share[1] - third.share[0]) * r())) / 100) * 100
      const wag = Math.round((T * (0.22 + 0.13 * r())) / 100) * 100
      return { N, S, L, T, sup: T - oth - wag, wag, oth }
    },
    ({ N, S, L, T, sup, wag, oth }) => sup > wag && wag > oth && oth >= 300 && sizes(N, S, L, sup, wag, oth, S + L, T) && L <= 0.4 * S,
  )
  const { N, S, L, T, sup, wag, oth } = x
  const In = S + L
  const month = pick(r, MONTHS)
  const who = pick(r, ITEM_FIRMS)
  const prompt = `In ${month} ${who} receives ${gbp(S, style)} from sales and ${other.text(gbp(L, style))}. In the same month it pays ${gbp(sup, style)} to suppliers, ${gbp(wag, style)} in wages and ${gbp(oth, style)} ${third.name === 'loan repayments' ? 'in loan repayments' : `for ${third.name}`}. Calculate its net cash flow for ${month}.`
  return numericDraft(
    slot,
    {
      prompt,
      solution:
        `Cash inflows $= ${texPounds(S, style)} + ${texPounds(L, style)} = ${texGbp(In, style)}$. Cash outflows $= ${texPounds(sup, style)} + ${texPounds(wag, style)} + ${texPounds(oth, style)} = ${texGbp(T, style)}$. ` +
        `Net cash flow $=$ inflows $-$ outflows $= ${texPounds(In, style)} - ${texPounds(T, style)} = ${texGbp(N, style)}$. ${other.why}${flowNote(N)}`,
      method: [`inflows $${texPounds(In, style)}$ and outflows $${texPounds(T, style)}$`],
      answer: netCashFlow(In, T),
    },
    // Second route: item by item, each inflow added and each outflow taken off in turn.
    { agrees: S - sup + L - wag - oth === N, detail: `${S} − ${sup} + ${L} − ${wag} − ${oth} = ${S - sup + L - wag - oth}` },
    { sign: sign > 0 ? 'positive' : 'negative', who, other: other.text('').trim(), third: third.name, sales: S, otherInflow: L, suppliers: sup, wages: wag, thirdOutflow: oth, net: N },
  )
}

type Case = 'down-below-zero' | 'down-still-positive' | 'up' | 'out-of-overdraft'
const CASES: Case[] = ['down-below-zero', 'down-still-positive', 'up', 'out-of-overdraft']

/** An opening balance and net cash flow for each case, the closing balance drawn first. */
function openingAndFlow(r: Rng, c: Case): { O: number; N: number; C: number } {
  return draw(
    r,
    (r) => {
      if (c === 'down-below-zero') {
        const C = -stepped(r, 100, 3000, 100)
        const O = stepped(r, 500, 5000, 100)
        return { O, N: C - O, C }
      }
      if (c === 'down-still-positive') {
        const C = stepped(r, 100, 4000, 100)
        const O = C + stepped(r, 300, 6000, 100)
        return { O, N: C - O, C }
      }
      if (c === 'up') {
        const C = stepped(r, 600, 9000, 100)
        const N = stepped(r, 200, 6000, 100)
        return { O: C - N, N, C }
      }
      const C = stepped(r, 100, 5000, 100)
      const O = -stepped(r, 200, 3000, 100)
      return { O, N: C - O, C }
    },
    ({ O, N, C }) => O !== 0 && N !== 0 && C !== 0 && (c !== 'up' || O > 0) && sizes(O, N, C) && Math.abs(O - N) !== Math.abs(C),
  )
}

function buildClosingBalance(r: Rng, slot: Question): Draft {
  const style = styleOf(slot)
  const c = pick(r, CASES)
  const { O, N, C } = openingAndFlow(r, c)
  const month = pick(r, MONTHS)
  const who = pick(r, FIRMS)
  const prompt = pick(r, [
    () => `A business starts the month with an opening balance of ${balance(O, style)}. Its net cash flow for the month is ${flow(N, style)}. Calculate its closing balance.`,
    () => `${cap(who)} starts ${month} with an opening balance of ${balance(O, style)}. Its net cash flow for ${month} is ${flow(N, style)}. Calculate its closing balance at the end of ${month}.`,
  ])()
  return numericDraft(
    slot,
    {
      prompt,
      solution: `Closing balance $=$ opening balance $+$ net cash flow $= ${texPounds(O, style)} + ${term(N, style)} = ${texGbp(C, style)}$. ${balanceNote(C, O)}`,
      method: ['opening $+$ net cash flow', `$${plusOrMinus(O, N, style)}$`],
      answer: closingBalance(O, N),
    },
    // Second route: work back from the closing balance to the opening one.
    { agrees: C - N === O, detail: `${C} − (${N}) = ${C - N}` },
    { case: c, opening: O, net: N, closing: C },
  )
}

function buildClosingFromFlows(r: Rng, slot: Question): Draft {
  const style = styleOf(slot)
  const c = pick(r, CASES)
  const { O, N, C } = openingAndFlow(r, c)
  // Inflows and outflows that net to N, both larger than any balance.
  const I = draw(
    r,
    (r) => stepped(r, 2000, 15000, 100),
    (I) => I - N >= 1500 && sizes(I, I - N, O, N, C),
  )
  const X = I - N
  const m = int(r, 0, 11)
  const [before, month] = [MONTHS[m]!, MONTHS[(m + 1) % 12]!]
  const who = pick(r, ['a business', ...FIRMS])
  const prompt = pick(r, [
    () => `${cap(who)}'s closing balance at the end of ${before} was ${balance(O, style)}. In ${month} its cash inflows are ${gbp(I, style)} and its cash outflows are ${gbp(X, style)}. Calculate its closing balance at the end of ${month}.`,
    () => `At the end of ${before}, ${who} had a closing balance of ${balance(O, style)}. During ${month} it receives ${gbp(I, style)} and pays out ${gbp(X, style)}. Calculate its closing balance at the end of ${month}.`,
  ])()
  return numericDraft(
    slot,
    {
      prompt,
      solution:
        `The opening balance for ${month} is the closing balance of ${before}: ${O < 0 ? `$${texGbp(O, style)}$` : gbp(O, style)}. Net cash flow for ${month} $= ${texPounds(I, style)} - ${texPounds(X, style)} = ${texGbp(N, style)}$. ` +
        `Closing balance $=$ opening balance $+$ net cash flow $= ${texPounds(O, style)} + ${term(N, style)} = ${texGbp(C, style)}$. ${balanceNote(C, O)}`,
      method: [`opening balance for ${month} $= ${texPounds(O, style)}$, the closing balance of ${before}`, `$${texPounds(I, style)} - ${texPounds(X, style)} = ${texPounds(N, style)}$`],
      answer: closingBalance(O, netCashFlow(I, X)),
    },
    // Second route: the opening balance and inflows together, then the outflows taken off.
    { agrees: O + I - X === C, detail: `${O} + ${I} − ${X} = ${O + I - X}` },
    { case: c, opening: O, inflows: I, outflows: X, net: N, closing: C },
  )
}

type Pair = '+-below' | '+-above' | '-+' | '--'
const PAIRS: Pair[] = ['+-below', '+-above', '-+', '--']

function buildTwoMonths(r: Rng, slot: Question): Draft {
  const style = styleOf(slot)
  const pair = pick(r, PAIRS)
  // The final closing balance and the first month's flow first, then the second month's.
  const { O, N1, N2, M, C } = draw(
    r,
    (r) => {
      const O = stepped(r, 500, 5000, 100)
      const sgn1 = pair[0] === '+' ? 1 : -1
      const N1 = sgn1 * stepped(r, 200, 4000, 100)
      const M = O + N1
      const C = pair === '+-below' || pair === '--' ? -stepped(r, 100, 3000, 100) : stepped(r, 100, 6000, 100)
      return { O, N1, M, C, N2: C - M }
    },
    ({ O, N1, N2, M, C }) => {
      const signs = pair === '-+' ? N2 > 0 : N2 < 0
      return signs && M !== 0 && N2 !== 0 && N1 + N2 !== 0 && sizes(O, N1, N2, M, C) && Math.abs(O + N2) !== Math.abs(C)
    },
  )
  const m = int(r, 0, 11)
  const [first, second] = [MONTHS[m]!, MONTHS[(m + 1) % 12]!]
  const who = pick(r, ['a business', ...FIRMS])
  const prompt = pick(r, [
    () => `${cap(who)} has an opening balance of ${gbp(O, style)} in ${first}. Net cash flow is ${flow(N1, style, true)} in ${first} and ${flow(N2, style, true)} in ${second}. Calculate the closing balance at the end of ${second}.`,
    () => `${cap(who)} starts ${first} with an opening balance of ${gbp(O, style)}. Its net cash flow is ${flow(N1, style, true)} in ${first} and ${flow(N2, style, true)} in ${second}. Calculate its closing balance at the end of ${second}.`,
  ])()
  const Mtext = M < 0 ? `$${texGbp(M, style)}$` : gbp(M, style)
  return numericDraft(
    slot,
    {
      prompt,
      solution:
        `${first} closing $= ${texPounds(O, style)} + ${term(N1, style)} = ${texGbp(M, style)}$. ${second} opening is the same ${Mtext}. ${second} closing $= ${texPounds(M, style)} + ${term(N2, style)} = ${texGbp(C, style)}$. ` +
        'The closing balance of one month is the opening balance of the next; skipping that link is the usual error.',
      method: [`${first} closing $= ${texPounds(M, style)}$`, `carried forward as ${second}'s opening balance`, `$${plusOrMinus(M, N2, style)}$`],
      answer: closingBalance(closingBalance(O, N1), N2),
    },
    // Second route: the two months' flows together, added to the opening balance.
    { agrees: O + (N1 + N2) === C, detail: `${O} + (${N1 + N2}) = ${O + N1 + N2}` },
    { pair, opening: O, first: N1, second: N2, middle: M, closing: C },
  )
}

// ---------------------------------------------------------------------------------------------
// Interest on loans: q12, q26
// ---------------------------------------------------------------------------------------------

interface Borrower {
  who: string
  why: string
  /** The loan: [lo, hi] in pounds. */
  loan: [number, number]
}
const BORROWERS: Borrower[] = [
  { who: 'a business', why: '', loan: [3000, 50000] },
  { who: 'a café', why: ' to buy a new coffee machine', loan: [3000, 9000] },
  { who: 'a builder', why: ' to buy a van', loan: [8000, 30000] },
  { who: 'a bakery', why: ' to buy new ovens', loan: [5000, 25000] },
  { who: 'a gift shop', why: ' to refit the shop', loan: [5000, 20000] },
  { who: 'a hairdresser', why: ' to open a second salon', loan: [20000, 60000] },
]
/** Loans in round sums: £500 steps under £10 000, then £1000 steps. */
const loans = (b: Borrower) => [...steps(b.loan[0], Math.min(b.loan[1], 9500), 500).filter((x) => x <= b.loan[1]), ...(b.loan[1] >= 10000 ? steps(Math.max(10000, b.loan[0]), b.loan[1], 1000) : [])]

function buildInterest(r: Rng, slot: Question): Draft {
  const style = styleOf(slot)
  const b = pick(r, BORROWERS)
  const n = int(r, 2, 5)
  // The total interest as a percentage first: 2% to 8% a year over the loan, never the number of years.
  const pct = pick(r, steps(2 * n, 8 * n, 1).filter((x) => x !== n && x !== 10 * n))
  const B = pick(r, loans(b))
  const I = (B * pct) / 100
  const R = B + I
  const years = `${WORDS[n]} years`
  const prompt = b.why || r() < 0.5
    ? `${cap(b.who)} takes out a bank loan of ${gbp(B, style)}${b.why}. Over ${years} it repays ${gbp(R, style)} in total. Calculate the total interest as a percentage of the amount borrowed.`
    : `${cap(b.who)} borrows ${gbp(B, style)} and repays ${gbp(R, style)} in total over ${years}. Calculate the total interest as a percentage of the amount borrowed.`
  return numericDraft(
    slot,
    {
      prompt,
      solution:
        `Interest $=$ total repayment $-$ amount borrowed $= ${texPounds(R, style)} - ${texPounds(B, style)} = ${texGbp(I, style)}$. As a percentage of the loan: $${texPounds(I, style)} \\div ${texPounds(B, style)} \\times 100 = ${pct}\\%$. ` +
        `This is the total interest over the ${years}, not a rate per year.`,
      method: [`$${texPounds(R, style)} - ${texPounds(B, style)} = ${texPounds(I, style)}$`, `$${texPounds(I, style)} \\div ${texPounds(B, style)}$`, '$\\times 100$'],
      answer: roundTo(interestPercent(B, R), 9),
    },
    // Second route: the loan grown by the percentage is the total repaid.
    { agrees: near((B * (100 + pct)) / 100, R) && near(interestPercent(B, R), pct), detail: `${B} × ${(100 + pct) / 100} = ${(B * (100 + pct)) / 100}` },
    { context: b.who, years: n, borrowed: B, repaid: R, interest: I, percent: pct },
  )
}

const TERMS = [12, 18, 24, 36, 48, 60]
const termWords = (months: number) => (months === 12 ? 'year' : months === 18 ? '18 months' : `${WORDS[months / 12]} years`)

function buildInstalments(r: Rng, slot: Question): Draft {
  const style = styleOf(slot)
  const b = pick(r, BORROWERS)
  const months = pick(r, TERMS)
  const y = months / 12
  // The percentage first (2% to 12% a year on a loan paid off as it goes, about 1.1y to 6.6y in
  // all), then a loan in hundreds whose total repaid shares into whole-pound instalments,
  // in round £500s where one fits.
  const pct = pick(r, steps(Math.max(2, Math.ceil(1.1 * y)), Math.floor(6.6 * y), 1).filter((x) => x !== months && x !== y))
  const g = months / gcd(months, 100 + pct)
  const ok = (B: number) => B >= b.loan[0] && B <= b.loan[1] && ((B / 100) * (100 + pct)) % months === 0
  const all = steps(Math.ceil(b.loan[0] / 100) * 100, b.loan[1], 100).filter(ok)
  const round = all.filter((B) => B % 500 === 0)
  const B = pick(r, round.length >= 2 ? round : all.length ? all : [g * 100 * Math.ceil(b.loan[0] / (g * 100))])
  const R = (B / 100) * (100 + pct)
  const m = R / months
  const I = R - B
  const prompt = pick(r, [
    () => `${cap(b.who)} borrows ${gbp(B, style)}${b.why} and repays it in ${months} monthly instalments of ${gbp(m, style)}. Calculate the total interest as a percentage of the amount borrowed.`,
    () => `${cap(b.who)} takes out a loan of ${gbp(B, style)}${b.why}. It repays the loan in ${months} monthly instalments of ${gbp(m, style)}. Calculate the total interest as a percentage of the amount borrowed.`,
  ])()
  return numericDraft(
    slot,
    {
      prompt,
      solution:
        `Total repayment $= ${months} \\times ${texPounds(m, style)} = ${texGbp(R, style)}$. Interest $=$ total repayment $-$ amount borrowed $= ${texPounds(R, style)} - ${texPounds(B, style)} = ${texGbp(I, style)}$. ` +
        `As a percentage of the amount borrowed: $\\dfrac{${texPounds(I, style)}}{${texPounds(B, style)}} \\times 100 = ${pct}\\%$. ` +
        `This is the specification's formula for interest on loans; it gives the total interest over the ${termWords(months)}${months === 12 ? '' : ', not a rate per year'}.`,
      method: [`$${months} \\times ${texPounds(m, style)} = ${texPounds(R, style)}$`, `$\\dfrac{${texPounds(R, style)} - ${texPounds(B, style)}}{${texPounds(B, style)}} \\times 100$`],
      answer: roundTo(interestPercent(B, months * m), 9),
    },
    // Second route: the loan grown by the percentage, shared over the months, is the instalment.
    { agrees: near((B * (100 + pct)) / 100 / months, m) && near(interestPercent(B, months * m), pct), detail: `${B} × ${(100 + pct) / 100} ÷ ${months} = ${(B * (100 + pct)) / 100 / months}` },
    { context: b.who, months, instalment: m, borrowed: B, repaid: R, interest: I, percent: pct },
  )
}

// ---------------------------------------------------------------------------------------------

const one = (id: string, slotId: string, build: (r: Rng, slot: Question) => Draft): Generator => businessBySlot(id, TOPIC, { [slotId]: build })

export const practiceGenerators: Generator[] = [
  one('practice-revenue', 'q1', buildRevenue),
  one('practice-total-costs', 'q3', buildTotalCosts),
  one('practice-profit', 'q5', buildProfit),
  one('practice-break-even', 'q6', buildBreakEven),
  one('practice-margin-of-safety', 'q7', buildMarginOfSafety),
  one('practice-net-cash-flow', 'q8', buildNetCashFlow),
  one('practice-closing-balance', 'q9', buildClosingBalance),
  one('practice-break-even-price-rise', 'q11', buildPriceRise),
  one('practice-loan-interest', 'q12', buildInterest),
  one('practice-profit-from-sales', 'q13', buildProfitFromSales),
  one('practice-cash-flow-two-months', 'q14', buildTwoMonths),
  one('practice-net-cash-flow-items', 'q24', buildCashFlowItems),
  one('practice-closing-balance-flows', 'q25', buildClosingFromFlows),
  one('practice-loan-instalments', 'q26', buildInstalments),
]

/** For the tests. */
export const PRACTICE = { ITEM_FIRMS, SALES, MAKERS, TRADERS, PRODUCTS, ADVANCED, BORROWERS, TERMS, variableCosts, isQ23 }
