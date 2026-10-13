// Business (Edexcel 1BS0) generators: 1.5 Understanding external influences on business.
import type { Question } from '../../content/questions.ts'
import { clearOfHalf, fixed, roundTo, show } from '../format.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import type { Draft, Generator } from '../types.ts'
import { businessBySlot, gbp, near, num, numericDraft, stepped, steps, styleOf, texGbp, texNum, type Style } from './build.ts'

/**
 * Understanding external influences (Edexcel 1BS0 Topic 1.5). Six numeric written slots, one
 * generator each:
 *
 * - 1.5.4 the economy and business, changes in exchange rates: q5 (a supplier's price in dollars
 *   or euros turned into pounds), q11 (an import's cost in pounds before and after the rate
 *   moves), q19 (an export's price abroad before and after the rate moves).
 * - 1.5.3 legislation and business, consumer law and its cost: q29 (refunds of faulty goods).
 * - 1.5.4 changes in interest rates: q30 (the change in a year's interest on a loan).
 * - 1.5.4 government taxation: q31 (the change in profit after tax when the rate on company
 *   profits changes).
 *
 * All are percentages of an amount or conversions (Appendix 2, percentages and percentage
 * changes; changes in costs and prices); none needs an Appendix 3 formula. Exchange rates stay
 * near real ones (£1 = $1.20 to $1.60, £1 = €1.05 to €1.40), interest rates 2% to 12% a year,
 * the tax on company profits 19% to 25% (the UK's range), faulty goods 1.5% to 8% of those sold.
 */
const TOPIC = 'understanding-external-influences'

/** Rates in hundredths: 120 is £1 = $1.20. */
const DOLLAR = [120, 160] as const
const EURO = [105, 140] as const
const rate = (c: number) => fixed(c / 100, 2)

interface Currency {
  symbol: string
  /** The symbol as a prompt prints it: \$ outside maths, since $ opens maths. */
  printed: string
  word: string
  range: readonly [number, number]
}
const USD: Currency = { symbol: '$', printed: '\\$', word: 'dollars', range: DOLLAR }
const EUR: Currency = { symbol: '€', printed: '€', word: 'euros', range: EURO }
const foreign = (cur: Currency, x: number, style: Style) => gbp(x, style).replace('£', cur.printed)

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
/** A percentage as the decimal a calculator takes: 4.5 → 0.045. */
const decimal = (percent: number) => show(percent / 100)
/** lo and hi rounded inwards to multiples of `step`, for `stepped` when the step does not divide a bound. */
const within = (lo: number, hi: number, step: number) => [Math.ceil(lo / step) * step, Math.floor(hi / step) * step] as const

// ---------------------------------------------------------------------------------------------
// q5: a supplier's price turned into pounds
// ---------------------------------------------------------------------------------------------

interface Supplier {
  /** With its article: an American supplier. */
  name: string
  cur: Currency
}
const SUPPLY: Supplier[] = [
  { name: 'an American', cur: USD },
  { name: 'a German', cur: EUR },
  { name: 'an Italian', cur: EUR },
  { name: 'a French', cur: EUR },
  { name: 'a Spanish', cur: EUR },
]

interface Purchase {
  name: string
  /** With its article, then with "the". */
  a: string
  the: string
  /** The cost in pounds, which the answer is. */
  pounds: [number, number]
  from: string[]
}
const PURCHASES: Purchase[] = [
  { name: 'machine', a: 'a machine', the: 'the machine', pounds: [3000, 30000], from: ['an American', 'a German', 'an Italian'] },
  { name: 'van', a: 'a delivery van', the: 'the van', pounds: [15000, 35000], from: ['a German', 'a French', 'a Spanish'] },
  { name: 'coffee roaster', a: 'a coffee roaster', the: 'the roaster', pounds: [5000, 25000], from: ['an American', 'a German', 'an Italian'] },
  { name: 'software', a: "a year's software licences", the: 'the licences', pounds: [500, 8000], from: ['an American'] },
  { name: 'fabric', a: 'a consignment of fabric', the: 'the fabric', pounds: [1000, 12000], from: ['an Italian', 'a French', 'a Spanish'] },
  { name: 'pizza oven', a: 'a pizza oven', the: 'the oven', pounds: [2000, 12000], from: ['an Italian'] },
  { name: 'wine', a: 'a shipment of wine', the: 'the wine', pounds: [2000, 15000], from: ['a French', 'a Spanish', 'an Italian'] },
]

/**
 * Rates whose conversions come out in round figures: a cost in pounds that is a multiple of £10
 * becomes a foreign price that is a multiple of 10 when it is a multiple of 1000 ÷ gcd(c, 100).
 * Rates needing multiples of £1000 (1.37, 1.21) are left out, so every rate gives many costs.
 */
const roundStep = (c: number) => 1000 / gcd(c, 100)
const RATES = (cur: Currency) => steps(cur.range[0], cur.range[1], 1).filter((c) => roundStep(c) <= 500)

const CONVERT_PROMPTS = [
  (p: Purchase, s: Supplier, X: string, c: string) =>
    `A UK business buys ${p.a} from ${s.name} supplier for ${X}. The exchange rate is £1 = ${s.cur.printed}${c}. Calculate the cost of ${p.the} in pounds.`,
  (p: Purchase, s: Supplier, X: string, c: string) =>
    `A UK business orders ${p.a} from ${s.name} supplier, which charges ${X}. The exchange rate is £1 = ${s.cur.printed}${c}. Calculate how much ${p.the} will cost the business in pounds.`,
]

function convert(r: Rng, slot: Question): Draft {
  const style = styleOf(slot)
  const p = pick(r, PURCHASES)
  const from = pick(r, p.from)
  const s = SUPPLY.find((x) => x.name === from)!
  // The rate first, then the cost in pounds among the multiples that make the foreign price round.
  const c = pick(r, RATES(s.cur))
  const Y = stepped(r, ...within(p.pounds[0], p.pounds[1], roundStep(c)), roundStep(c))
  const X = (Y * c) / 100
  const answer = (X * 100) / c
  return numericDraft(
    slot,
    {
      prompt: pick(r, CONVERT_PROMPTS)(p, s, foreign(s.cur, X, style), rate(c)),
      solution:
        `Pounds $=$ ${s.cur.word} $\\div$ the rate: $${texNum(X, style)} \\div ${rate(c)} = ${texGbp(answer, style)}$. ` +
        `The rate says how many ${s.cur.word} one pound buys, so dividing turns ${s.cur.word} into pounds.`,
      method: [`$${texNum(X, style)} \\div ${rate(c)}$`],
      answer,
      line: gbp(answer, style),
    },
    // Second route: the pounds at the rate buy the foreign price back.
    { agrees: near(Y * (c / 100), X) && Number.isInteger(answer) && answer === Y, detail: `${Y} × ${rate(c)} = ${show(Y * (c / 100))}` },
    { context: p.name, currency: s.cur.symbol, supplier: s.name, rate: c / 100, foreign: X, pounds: answer },
  )
}

export const exchangeConversion = businessBySlot('business-exchange-conversion', TOPIC, { q5: convert })

// ---------------------------------------------------------------------------------------------
// q11: an import's cost in pounds before and after the rate moves
// ---------------------------------------------------------------------------------------------

interface Import {
  name: string
  /** The retailer and what it imports, starting a sentence, before the price. */
  text: (price: string) => string
  /** The phrase for one: "each pair of jeans". */
  each: string
  per: string
  cur: Currency
  price: [number, number]
  /** Prices in steps of €1, or €5 for the dearer goods. */
  step: number
}
export const IMPORTS: Import[] = [
  { name: 'jeans', text: (x) => `A UK clothing retailer imports jeans at ${x} a pair.`, each: 'each pair of jeans', per: 'per pair', cur: EUR, price: [25, 60], step: 1 },
  { name: 'trainers', text: (x) => `A UK shoe shop imports trainers from Italy at ${x} a pair.`, each: 'each pair of trainers', per: 'per pair', cur: EUR, price: [40, 110], step: 1 },
  { name: 'bicycles', text: (x) => `A UK bike shop imports bicycles from the Netherlands at ${x} each.`, each: 'each bicycle', per: 'per bicycle', cur: EUR, price: [200, 600], step: 5 },
  // Not a toy importer: q16 on the same sheet asks about one.
  { name: 'vases', text: (x) => `A UK homeware shop imports ceramic vases from Portugal at ${x} each.`, each: 'each vase', per: 'per vase', cur: EUR, price: [20, 45], step: 1 },
  { name: 'guitars', text: (x) => `A UK music shop imports guitars from an American maker at ${x} each.`, each: 'each guitar', per: 'per guitar', cur: USD, price: [150, 700], step: 5 },
  { name: 'jackets', text: (x) => `A UK outdoor-clothing shop imports jackets from the USA at ${x} each.`, each: 'each jacket', per: 'per jacket', cur: USD, price: [60, 200], step: 1 },
]

/** A year's move in the rate: 5 to 20 cents (or euro cents) on the pound. */
const MOVE = [5, 20] as const

interface Costs {
  p: number
  /** Last year's and this year's rates, in hundredths. */
  r1: number
  r2: number
  /** Which year's cost in pounds is exact to the penny; the other is rounded to it. */
  exact: 'last' | 'this'
  c1: number
  c2: number
  answer: number
}

/**
 * Every price and rate whose cost in pounds is exact to the penny (100p ÷ (c/100) whole in
 * pence), grouped by that cost. Never a round £10, £100 or £1000 (a price of $157 at $1.57).
 * Drawing the rate first let one cost fill half a product's builds: £50 is exact at every even
 * euro rate for trainers at €40 to €110, and some rates had no other.
 */
const EXACT = new Map<string, Map<number, { p: number; c: number }[]>>()
export function exactCosts(m: Import): Map<number, { p: number; c: number }[]> {
  let out = EXACT.get(m.name)
  if (out) return out
  out = new Map()
  for (const c of steps(m.cur.range[0], m.cur.range[1], 1)) {
    for (const p of steps(m.price[0], m.price[1], m.step)) {
      if ((10000 * p) % c !== 0) continue
      const cost = (10000 * p) / c / 100
      if ([10, 100, 1000].includes(cost)) continue
      out.set(cost, [...(out.get(cost) ?? []), { p, c }])
    }
  }
  EXACT.set(m.name, out)
  return out
}

function importCosts(r: Rng, m: Import, weakens: boolean, exact: 'last' | 'this'): Costs | null {
  // The exact year's cost in pounds first, evenly, then a price and rate that give it, then the
  // move, keeping the other year's cost clear of a half penny.
  const byCost = exactCosts(m)
  const { p, c: cExact } = pick(r, byCost.get(pick(r, [...byCost.keys()]))!)
  // Weakening: this year's rate is lower. The other rate sits above or below the exact one.
  const otherBelow = (exact === 'last') === weakens
  const moves = steps(MOVE[0], MOVE[1], 1).filter((d) => {
    const c = otherBelow ? cExact - d : cExact + d
    return c >= m.cur.range[0] && c <= m.cur.range[1] && clearOfHalf((100 * p) / c, 2, 0.05) && (10000 * p) % c !== 0
  })
  if (!moves.length) return null
  const d = pick(r, moves)
  const cOther = otherBelow ? cExact - d : cExact + d
  const [r1, r2] = exact === 'last' ? [cExact, cOther] : [cOther, cExact]
  const cost = (c: number) => roundTo((100 * p) / c, 2)
  const c1 = cost(r1)
  const c2 = cost(r2)
  return { p, r1, r2, exact, c1, c2, answer: roundTo(Math.abs(c2 - c1), 2) }
}

/** The answers a slip gives: multiplying by the rates, or dividing the price by the rates' difference. */
export const importSlips = (x: Costs) => ({
  multiplied: roundTo((x.p * Math.abs(x.r1 - x.r2)) / 100, 2),
  rateDifference: roundTo(x.p / (Math.abs(x.r1 - x.r2) / 100), 2),
})

function importCost(r: Rng, slot: Question): Draft {
  const style = styleOf(slot)
  const m = pick(r, IMPORTS)
  const weakens = r() < 0.5
  const exact = r() < 0.5 ? 'last' : 'this'
  const x = draw(
    r,
    (r) => importCosts(r, m, weakens, exact),
    (x): x is Costs => {
      if (!x) return false
      const slips = importSlips(x)
      // An answer of £1 or more keeps the penny tolerance within 2%; no slip within a penny of it.
      // No answer within a penny of a printed rate read as pounds (£1.36 beside €1.36).
      const rates = [x.r1 / 100, x.r2 / 100]
      return rates.every((c) => Math.abs(c - x.answer) > 0.01) && x.answer >= 1 && Object.values(slips).every((v) => Math.abs(v - x.answer) > 0.02) && ![x.p, x.c1, x.c2].includes(x.answer)
    },
  )!
  const { p, r1, r2, c1, c2, answer } = x
  const word = weakens ? 'more' : 'less'
  const rounded = (c: number) => ((10000 * p) % c === 0 ? '' : ' to the nearest penny')
  const P = foreign(m.cur, p, style)
  const prompt =
    `${m.text(P)} Last year the exchange rate was £1 = ${m.cur.printed}${rate(r1)}; this year it is £1 = ${m.cur.printed}${rate(r2)}. ` +
    `Calculate how much ${word}, in pounds, ${m.each} costs the retailer this year. Give your answer to the nearest penny.`
  const [big, small] = c2 > c1 ? [c2, c1] : [c1, c2]
  return numericDraft(
    slot,
    {
      prompt,
      solution:
        `Last year: $${p} \\div ${rate(r1)} = ${texGbp(c1, style)}$${rounded(r1)}. This year: $${p} \\div ${rate(r2)} = ${texGbp(c2, style)}$${rounded(r2)}. ` +
        `The ${weakens ? 'increase' : 'fall'} is $${texGbp(big, style).slice(1)} - ${texGbp(small, style).slice(1)} = ${texGbp(answer, style)}$ ${m.per}. ` +
        (weakens
          ? 'The pound has weakened, so imports cost more; the retailer has to raise its price or accept a smaller profit margin.'
          : 'The pound has strengthened, so imports cost less; the retailer can cut its price or keep a larger profit margin.'),
      method: [`$${p} \\div ${rate(r1)} = ${texGbp(c1, style)}$`, `$${p} \\div ${rate(r2)} = ${texGbp(c2, style)}$`, 'difference of the two'],
      answer,
      line: gbp(answer, style),
      tolerance: 0.01,
    },
    // Second route: the rounded cost this year, times its rate, buys the foreign price back to
    // within half a penny's worth; the answer added to the cheaper year gives the dearer one.
    {
      agrees: Math.abs(c2 * (r2 / 100) - p) <= 0.005 * (r2 / 100) + 1e-9 && Math.abs(c1 * (r1 / 100) - p) <= 0.005 * (r1 / 100) + 1e-9 && near(small + answer, big) && (weakens ? c2 > c1 : c2 < c1),
      detail: `${show(c1)} × ${rate(r1)} ≈ ${p}; ${show(c2)} × ${rate(r2)} ≈ ${p}`,
    },
    { context: m.name, weakens: weakens ? 'weakens' : 'strengthens', exact: x.exact, price: p, lastRate: r1 / 100, thisRate: r2 / 100, last: c1, now: c2, difference: answer },
  )
}

export const importCostGenerator = businessBySlot('business-exchange-import-cost', TOPIC, { q11: importCost })

// ---------------------------------------------------------------------------------------------
// q19: an export's price abroad before and after the rate moves
// ---------------------------------------------------------------------------------------------

interface Export {
  name: string
  /** With its article. */
  a: string
  pounds: [number, number]
}
export const EXPORTS: Export[] = [
  { name: 'product', a: 'a product', pounds: [12, 80] },
  { name: 'jumper', a: 'a wool jumper', pounds: [40, 90] },
  { name: 'gin', a: 'a bottle of gin', pounds: [20, 60] },
  { name: 'teapot', a: 'a teapot', pounds: [15, 60] },
  { name: 'handbag', a: 'a leather handbag', pounds: [80, 250] },
  { name: 'boots', a: 'a pair of walking boots', pounds: [60, 150] },
]
/** Each euro country, its adjective, and the article before the adjective. */
const COUNTRIES: [string, string, string][] = [
  ['France', 'French', 'a'],
  ['Germany', 'German', 'a'],
  ['Spain', 'Spanish', 'a'],
  ['Ireland', 'Irish', 'an'],
  ['Italy', 'Italian', 'an'],
  ['the Netherlands', 'Dutch', 'a'],
]

interface Prices {
  P: number
  r1: number
  r2: number
  d: number
  answer: number
}

/**
 * Every price and move whose change is a whole number of euros (P × d ÷ 100 whole), grouped by
 * that change. Never £10 or £100, where the change only moves the point of the rates' difference.
 */
const PAIRS = new Map<string, Map<number, { P: number; d: number }[]>>()
export function exportPairs(e: Export): Map<number, { P: number; d: number }[]> {
  let out = PAIRS.get(e.name)
  if (out) return out
  out = new Map()
  for (const d of steps(MOVE[0], MOVE[1], 1)) {
    for (const P of steps(e.pounds[0], e.pounds[1], 1)) {
      if ((P * d) % 100 !== 0 || P === 10 || P === 100) continue
      const A = (P * d) / 100
      out.set(A, [...(out.get(A) ?? []), { P, d }])
    }
  }
  PAIRS.set(e.name, out)
  return out
}

/** The change first, evenly among those the product's prices allow, then a price and move that give it, then the rates. */
function exportDraw(r: Rng, e: Export, weakens: boolean): Prices {
  const byAnswer = exportPairs(e)
  const answer = pick(r, [...byAnswer.keys()])
  const { P, d } = pick(r, byAnswer.get(answer)!)
  const low = int(r, EURO[0], EURO[1] - d)
  const [r1, r2] = weakens ? [low + d, low] : [low, low + d]
  return { P, r1, r2, d, answer }
}

/** Euros as the written question prints them: €25, €22.60. */
const euros = (x: number) => (Number.isInteger(roundTo(x, 2)) ? show(x) : fixed(x, 2))

function exportPrice(r: Rng, slot: Question): Draft {
  const style = styleOf(slot)
  const e = pick(r, EXPORTS)
  const [country, adj, article] = pick(r, COUNTRIES)
  const weakens = r() < 0.5
  const x = draw(
    r,
    (r) => exportDraw(r, e, weakens),
    // No printed figure, and no slip (dividing by the rates), equal to the answer.
    (x) => x.answer !== x.P && Math.abs(x.P / (x.r2 / 100) - x.P / (x.r1 / 100) - x.answer) > 0.01 && Math.abs(Math.abs(x.P / (x.r2 / 100) - x.P / (x.r1 / 100)) - x.answer) > 0.01,
  )
  const { P, r1, r2, answer } = x
  const e1 = roundTo((P * r1) / 100, 2)
  const e2 = roundTo((P * r2) / 100, 2)
  const verb = weakens ? 'falls' : 'rises'
  const prompts = [
    `A UK business sells ${e.a} for ${gbp(P, style)} in ${country}. The exchange rate moves from £1 = €${rate(r1)} to £1 = €${rate(r2)}. Calculate by how many euros the ${adj} price ${verb}.`,
    `A UK business exports ${e.a} to ${country} and keeps its price at ${gbp(P, style)}. The exchange rate changes from £1 = €${rate(r1)} to £1 = €${rate(r2)}. Calculate by how many euros the price ${article} ${adj} customer pays ${verb}.`,
  ]
  const [big, small] = weakens ? [e1, e2] : [e2, e1]
  return numericDraft(
    slot,
    {
      prompt: pick(r, prompts),
      solution:
        `Going **from** pounds, multiply. At £1 = €${rate(r1)} the price is $${P} \\times ${rate(r1)} = €${euros(e1)}$; at £1 = €${rate(r2)} it is $${P} \\times ${rate(r2)} = €${euros(e2)}$. ` +
        `The price ${verb} by $${euros(big)} - ${euros(small)} = €${show(answer)}$. ` +
        (weakens ? 'A weaker pound makes exports cheaper: WPIDEC.' : 'A stronger pound makes exports dearer: SPICED.'),
      method: [`$${P} \\times ${rate(r1)} = ${euros(e1)}$ or $${P} \\times ${rate(r2)} = ${euros(e2)}$`, 'both prices found'],
      answer,
      line: `€${show(answer)}`,
    },
    // Second route: the two prices in euros, subtracted.
    { agrees: near(big - small, answer) && Number.isInteger(answer), detail: `${euros(big)} − ${euros(small)} = ${show(big - small)}` },
    { context: e.name, country, weakens: weakens ? 'weakens' : 'strengthens', price: P, lastRate: r1 / 100, thisRate: r2 / 100, change: answer },
  )
}

export const exportPriceGenerator = businessBySlot('business-exchange-export-price', TOPIC, { q19: exportPrice })

// ---------------------------------------------------------------------------------------------
// q29: the cost of refunds under consumer law
// ---------------------------------------------------------------------------------------------

interface Goods {
  name: string
  items: string
  price: [number, number]
}
export const GOODS: Goods[] = [
  { name: 'kettles', items: 'kettles', price: [15, 60] },
  { name: 'toasters', items: 'toasters', price: [20, 50] },
  { name: 'hairdryers', items: 'hairdryers', price: [15, 60] },
  { name: 'headphones', items: 'pairs of headphones', price: [20, 120] },
  { name: 'toothbrushes', items: 'electric toothbrushes', price: [20, 80] },
  { name: 'lamps', items: 'table lamps', price: [15, 50] },
  { name: 'chargers', items: 'phone chargers', price: [10, 25] },
]
/** Faulty goods as a percentage of those sold. */
export const FAULTY = [1.5, 2, 2.5, 3, 4, 5, 6, 7, 8]
const SOLD = [200, 2000] as const

const REFUND_PROMPTS = [
  (g: Goods, N: string, f: string, R: string) =>
    `A shop sold ${N} ${g.items} last year. Under consumer law it had to refund the ${f}% of them that turned out to be faulty, at ${R} each. Calculate the total cost of the refunds.`,
  (g: Goods, N: string, f: string, R: string) =>
    `An electrical retailer sold ${N} ${g.items} last year at ${R} each. Of these, ${f}% turned out to be faulty, and under consumer law it refunded the full price of each faulty one. Calculate the total cost of the refunds.`,
]

function refunds(r: Rng, slot: Question): Draft {
  const style = styleOf(slot)
  const g = pick(r, GOODS)
  const f = pick(r, FAULTY)
  // Sales in multiples that make the faulty count whole: N × f ÷ 100 whole.
  const step = 200 / gcd(f * 2, 200)
  const x = draw(
    r,
    (r) => {
      const N = stepped(r, SOLD[0], SOLD[1], step)
      const R = int(r, g.price[0], g.price[1])
      const F = (N * f * 2) / 200
      return { N, R, F, answer: F * R }
    },
    // At least three faulty; a faulty count unlike the rate and the price; an answer equal to no
    // printed figure. N = 100 (rate × price) is outside the range.
    (x) => x.F >= 3 && x.F !== f && x.F !== x.R && ![x.N, x.R].includes(x.answer),
  )
  const { N, R, F, answer } = x
  return numericDraft(
    slot,
    {
      prompt: pick(r, REFUND_PROMPTS)(g, num(N, style), show(f), gbp(R, style)),
      solution:
        `Faulty ${g.items} $= ${show(f)}\\% \\times ${texNum(N, style)} = ${F}$. Refunds $= ${F} \\times ${R} = ${texGbp(answer, style)}$. ` +
        'Consumer law gives customers the right to goods of satisfactory quality, so the shop must refund, repair or replace faulty goods; meeting that obligation costs money, and not meeting it costs more, in legal action and lost reputation.',
      method: [`$${show(f)}\\% \\times ${texNum(N, style)} = ${F}$ ${g.items}`],
      answer,
      line: gbp(answer, style),
    },
    // Second route: the refunds as a share of the year's takings give the faulty rate back.
    { agrees: near((answer / (N * R)) * 100, f) && Number.isInteger(F), detail: `${answer} ÷ (${N} × ${R}) × 100 = ${show((answer / (N * R)) * 100)}%` },
    { context: g.name, sold: N, faulty: f, price: R, count: F, refunds: answer },
  )
}

export const refundsGenerator = businessBySlot('business-consumer-law-refunds', TOPIC, { q29: refunds })

// ---------------------------------------------------------------------------------------------
// q30: a change in the interest on a loan
// ---------------------------------------------------------------------------------------------

interface Borrower {
  name: string
  /** Starting a sentence, then as "the …". */
  who: string
  the: string
  loan: [number, number]
}
export const BORROWERS: Borrower[] = [
  { name: 'business', who: 'A business', the: 'the business', loan: [20000, 150000] },
  { name: 'café', who: 'A café', the: 'the café', loan: [10000, 60000] },
  { name: 'haulage firm', who: 'A haulage firm', the: 'the firm', loan: [50000, 250000] },
  { name: 'builder', who: 'A building firm', the: 'the firm', loan: [15000, 80000] },
  { name: 'farm shop', who: 'A farm shop', the: 'the shop', loan: [15000, 100000] },
  { name: 'manufacturer', who: 'A small manufacturer', the: 'the manufacturer', loan: [40000, 200000] },
]
/** Changes in the rate, in percentage points: never 1, which only moves the point. */
export const CHANGES = [0.5, 1.5, 2, 2.5, 3]
const LOAN_RATE = [2, 12] as const

function interestChange(r: Rng, slot: Question): Draft {
  const style = styleOf(slot)
  const b = pick(r, BORROWERS)
  const rises = r() < 0.5
  const g = pick(r, CHANGES)
  // The lower rate in half points, never equal to the change: a rise from 2% to 4% would make
  // the increase equal to the interest before it.
  // Never a rate of 10%, nor a loan of £10 000 or £100 000: the interest would be a point move.
  const lows = steps(LOAN_RATE[0] * 2, (LOAN_RATE[1] - g) * 2, 1).map((h) => h / 2).filter((a) => a !== g && a !== 10 && a + g !== 10)
  const low = pick(r, lows)
  const [a, c] = rises ? [low, low + g] : [low + g, low]
  const L = draw(r, (rr) => stepped(rr, b.loan[0], b.loan[1], 5000), (x) => x !== 10000 && x !== 100000)
  const Ia = (L / 200) * (a * 2)
  const Ic = (L / 200) * (c * 2)
  const answer = (L / 200) * (g * 2)
  const [big, small] = rises ? [Ic, Ia] : [Ia, Ic]
  const prompts = [
    `${b.who} has a bank loan of ${gbp(L, style)}. The interest rate on the loan ${rises ? 'rises' : 'falls'} from ${show(a)}% a year to ${show(c)}% a year. Calculate the ${rises ? 'increase' : 'fall'} in the interest ${b.the} pays each year.`,
    `${b.who} has borrowed ${gbp(L, style)} from a bank at a variable interest rate. The rate has just ${rises ? 'risen' : 'fallen'} from ${show(a)}% a year to ${show(c)}% a year. Calculate how much ${rises ? 'more' : 'less'} interest ${b.the} will pay each year.`,
  ]
  return numericDraft(
    slot,
    {
      prompt: pick(r, prompts),
      solution:
        `Interest at ${show(a)}% $= ${decimal(a)} \\times ${texNum(L, style)} = ${texGbp(Ia, style)}$; at ${show(c)}% $= ${decimal(c)} \\times ${texNum(L, style)} = ${texGbp(Ic, style)}$. ` +
        `${rises ? 'Increase' : 'Fall'} $= ${texNum(big, style)} - ${texNum(small, style)} = ${texGbp(answer, style)}$ a year, which is ${show(g)}% of ${gbp(L, style)}, the change in the rate. ` +
        (rises
          ? 'The rise comes straight out of profit, and customers who borrow to buy also face higher repayments, so a rise in interest rates can hit a business on both its costs and its sales.'
          : 'The saving adds straight to profit, and customers who borrow to buy also find repayments cheaper, so a fall in interest rates can help a business on both its costs and its sales.'),
      method: [`$${decimal(g)} \\times ${texNum(L, style)}$ or $${texNum(big, style)} - ${texNum(small, style)}$`],
      answer,
      line: gbp(answer, style),
    },
    // Second route: the change in the rate on the loan.
    { agrees: near((g / 100) * L, answer) && answer === big - small && Number.isInteger(answer), detail: `${decimal(g)} × ${L} = ${show((g / 100) * L)}` },
    { context: b.name, rises: rises ? 'rises' : 'falls', loan: L, from: a, to: c, change: answer },
  )
}

export const interestGenerator = businessBySlot('business-interest-rate-change', TOPIC, { q30: interestChange })

// ---------------------------------------------------------------------------------------------
// q31: a change in the tax on company profits
// ---------------------------------------------------------------------------------------------

interface Company {
  name: string
  /** The sentence that states the profit before tax. */
  opening: (profit: string) => string
  profit: [number, number]
}
export const COMPANIES: Company[] = [
  { name: 'company', opening: (x) => `A company's profit before tax is ${x}.`, profit: [20000, 400000] },
  { name: 'manufacturer', opening: (x) => `A manufacturing company's profit before tax is ${x}.`, profit: [100000, 800000] },
  { name: 'software', opening: (x) => `A small software company made a profit before tax of ${x} last year.`, profit: [30000, 250000] },
  { name: 'restaurants', opening: (x) => `A private limited company running three restaurants has a profit before tax of ${x}.`, profit: [40000, 300000] },
  { name: 'builder', opening: (x) => `A building company's profit before tax is ${x}.`, profit: [50000, 400000] },
]
/** The UK's rate on company profits has been 19% to 25%. */
export const TAX = [19, 25] as const

function taxChange(r: Rng, slot: Question): Draft {
  const style = styleOf(slot)
  const co = pick(r, COMPANIES)
  const raises = r() < 0.5
  // The change first (2 to 6 points; 1 only moves the point), then the lower rate.
  const g = int(r, 2, TAX[1] - TAX[0])
  const low = int(r, TAX[0], TAX[1] - g)
  const [a, c] = raises ? [low, low + g] : [low + g, low]
  const P = stepped(r, co.profit[0], co.profit[1], 1000)
  const Ta = (P / 100) * a
  const Tc = (P / 100) * c
  const Aa = P - Ta
  const Ac = P - Tc
  const answer = Math.abs(Aa - Ac)
  const opening = co.opening(gbp(P, style))
  const change = raises ? 'raises' : 'cuts'
  const prompts = [
    `${opening} The government ${change} the rate of tax on company profits from ${a}% to ${c}%. Calculate the ${raises ? 'fall' : 'rise'} in the company's profit after tax.`,
    `${opening} Corporation tax, the tax on company profits, ${raises ? 'rises' : 'falls'} from ${a}% to ${c}%. Calculate by how much the company's profit after tax ${raises ? 'falls' : 'rises'}.`,
  ]
  const line = (tax: number, after: number) => `${texNum(P, style)} - ${texNum(tax, style)} = ${texNum(after, style)}`
  const [big, small] = raises ? [Aa, Ac] : [Ac, Aa]
  return numericDraft(
    slot,
    {
      prompt: pick(r, prompts),
      solution:
        `At ${a}%: tax $= ${fixed(a / 100, 2)} \\times ${texNum(P, style)} = ${texGbp(Ta, style)}$, so profit after tax $= ${texNum(P, style)} - ${texNum(Ta, style)} = ${texGbp(Aa, style)}$. ` +
        `At ${c}%: tax $= ${fixed(c / 100, 2)} \\times ${texNum(P, style)} = ${texGbp(Tc, style)}$, so profit after tax $= ${texNum(P, style)} - ${texNum(Tc, style)} = ${texGbp(Ac, style)}$. ` +
        `${raises ? 'Fall' : 'Rise'} $= ${texNum(big, style)} - ${texNum(small, style)} = ${texGbp(answer, style)}$, which is ${g}% of ${gbp(P, style)}. ` +
        `Government taxation is one of the six parts of the economic climate on the specification; a ${raises ? 'higher rate leaves less' : 'lower rate leaves more'} profit for the owners to reinvest or take as dividends.`,
      method: [`profit after tax at ${a}%: $${line(Ta, Aa)}$`, `profit after tax at ${c}%: $${line(Tc, Ac)}$`],
      answer,
      line: gbp(answer, style),
    },
    // Second route: the change in the rate, on the profit before tax.
    { agrees: near((g / 100) * P, answer) && Number.isInteger(answer), detail: `${g}% of ${P} = ${show((g / 100) * P)}` },
    { context: co.name, raises: raises ? 'raises' : 'cuts', profit: P, from: a, to: c, change: answer },
  )
}

export const taxGenerator = businessBySlot('business-tax-change', TOPIC, { q31: taxChange })

export const externalGenerators: Generator[] = [exchangeConversion, importCostGenerator, exportPriceGenerator, refundsGenerator, interestGenerator, taxGenerator]

/** For the tests. */
export const EXTERNAL = { DOLLAR, EURO, MOVE, SOLD, LOAN_RATE, PURCHASES, SUPPLY, RATES, roundStep }
