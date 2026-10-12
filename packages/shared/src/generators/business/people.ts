import { show } from '../format.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import type { Generator } from '../types.ts'
import { businessBySlot, gbp, near, num, numericDraft, readsOff, steps, styleOf, texNum, staffTurnover } from './build.ts'

/**
 * Business (Edexcel 1BS0) generators: Topic 2.5, making human resource decisions. Five numeric
 * written slots, one generator each; none is left written.
 *
 * - 2.5.3 why businesses train and develop employees, the link between training, motivation and
 *   retention: staff turnover (q5), its fall in percentage points (q12), and the net saving of a
 *   training programme that cuts leavers (q26). Staff turnover is an Appendix 2 skill
 *   ("percentages and percentage changes"; `staffTurnover`), not an Appendix 3 formula; the
 *   saving is Appendix 2 "revenue, costs and profit".
 * - 2.5.1 organisational structures, hierarchical and flat (spans of control): the managers a
 *   hierarchy needs (q24, a calculation in a business context).
 * - 2.5.4 financial methods of motivation, commission: a month's pay of basic salary plus
 *   commission (q25, Appendix 2 "percentages and percentage changes").
 *
 * Staff turnover stays 7% to 45% a year (lower in an accountancy firm, higher in a call centre;
 * below 7%, leavers over those who stayed rounds to the answer), 4% at least after a fall;
 * no business has 100 staff, where the leavers would print the percentage itself.
 */
const TOPIC = 'making-human-resource-decisions'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
/** One of `items`, each with chance in proportion to its weight. */
function weighted<T>(r: Rng, items: readonly T[], weight: (t: T) => number): T {
  const total = items.reduce((s, t) => s + weight(t), 0)
  let x = r() * total
  for (const t of items) if ((x -= weight(t)) < 0) return t
  return items[items.length - 1]!
}
const whole = (x: number) => Number.isInteger(x)

// ---------------------------------------------------------------------------------------------
// q5 and q12: staff turnover
// ---------------------------------------------------------------------------------------------

interface Employer {
  name: string
  /** "a hotel" */
  who: string
  staff: [number, number]
  /** Leavers a year as a percentage of staff, the range the kind of business sees. */
  turnover: [number, number]
}
const EMPLOYERS: Employer[] = [
  { name: 'business', who: 'a business', staff: [40, 800], turnover: [7, 40] },
  { name: 'hotel', who: 'a hotel', staff: [40, 600], turnover: [15, 45] },
  { name: 'call centre', who: 'a call centre', staff: [80, 800], turnover: [20, 45] },
  { name: 'supermarket', who: 'a supermarket', staff: [60, 600], turnover: [10, 40] },
  { name: 'care home', who: 'a care home', staff: [30, 120], turnover: [10, 40] },
  { name: 'accountancy', who: 'an accountancy firm', staff: [20, 160], turnover: [7, 20] },
]
/**
 * Staff in round numbers a student can divide by: fives under 100, tens to 200, twenties to 400,
 * then hundreds to 800; never 100. The hundreds give an odd turnover more than one staff count.
 */
const STAFF = [...steps(5, 95, 5), ...steps(110, 200, 10), ...steps(220, 400, 20), ...steps(500, 800, 100)]
const staffing = (e: { staff: [number, number] }) => STAFF.filter((n) => n >= e.staff[0] && n <= e.staff[1])

/**
 * Every turnover (never 50%) and staff count that make the leavers whole for one kind of
 * employer, no figure reading off as the answer. A turnover fewer than four staff counts give is
 * left out, so no one count takes a small employer's builds (a care home of 50 for every 14%).
 */
const RATES = new Map<string, { p: number; N: number }[]>()
function rates(e: Employer): { p: number; N: number }[] {
  let out = RATES.get(e.name)
  if (out) return out
  out = steps(e.turnover[0], e.turnover[1], 1)
    .filter((p) => p !== 50)
    .map((p) => staffing(e).filter((n) => whole((n * p) / 100) && !readsOff(p, [n, (n * p) / 100])).map((N) => ({ p, N })))
    .filter((fits) => fits.length >= 4)
    .flat()
  RATES.set(e.name, out)
  return out
}

/**
 * q5: leavers ÷ staff × 100, 2 marks. Written: 30 of 120, 25%. The percentage first, evenly
 * among those four or more staff counts give, then one of those counts (see `weighted`).
 */
const turnover = businessBySlot('people-staff-turnover', TOPIC, {
  q5(r, slot) {
    const s = styleOf(slot)
    const e = pick(r, EMPLOYERS)
    const all = rates(e)
    const p = pick(r, [...new Set(all.map((x) => x.p))])
    // Among the counts that give it, each weighted by how rarely it fits: 120 fits most
    // turnovers a care home has, so an even pick handed it a fifth of the builds.
    const N = weighted(
      r,
      all.filter((x) => x.p === p).map((x) => x.N),
      (n) => 1 / all.filter((x) => x.N === n).length,
    )
    const L = (N * p) / 100
    const prompt = pick(r, [
      () => `${cap(e.who)} has ${num(N, s)} staff and ${num(L, s)} leave during the year. What is its staff turnover, as a percentage?`,
      () => `Last year ${num(L, s)} of the ${num(N, s)} staff at ${e.who} left. Calculate its staff turnover, as a percentage.`,
    ])()
    return numericDraft(
      slot,
      {
        prompt,
        solution: `$(${L} \\div ${N}) \\times 100 = $ **${p}%**. Staff turnover is the leavers as a percentage of all staff; each leaver must be replaced, recruited and trained.`,
        method: [`leavers ÷ total staff × 100: $${L} \\div ${N} \\times 100$`],
        answer: p,
        line: String(p),
      },
      // Second route: p% of the staff are the leavers.
      { agrees: (p * N) / 100 === L && near(staffTurnover(L, N), p), detail: `${p}% of ${N} = ${show((p * N) / 100)}` },
      { context: e.name, staff: N, leavers: L },
    )
  },
})

interface Fall {
  d: number
  p1: number
  N: number
}
/**
 * Every fall (4 to 20 points), turnover before and staff that make both years' leavers whole for
 * one kind of employer; the turnover after is at least 4% and at least a third of the turnover
 * before (written: 25% → 10%), and is never the fall itself. A fall only one staff count gives
 * is left out, so no one count takes a small employer's builds.
 */
const FALLS = new Map<string, Fall[]>()
function falls(e: Employer): Fall[] {
  let out = FALLS.get(e.name)
  if (out) return out
  out = steps(4, 20, 1).flatMap((d) =>
    steps(Math.max(e.turnover[0], d + 4), e.turnover[1], 1)
      .filter((p1) => p1 - d !== d && 3 * (p1 - d) >= p1)
      .flatMap((p1) =>
        staffing(e)
          .filter((n) => whole((n * p1) / 100) && whole((n * (p1 - d)) / 100) && !readsOff(d, [n, (n * p1) / 100, (n * (p1 - d)) / 100]))
          .map((N) => ({ d, p1, N })),
      ),
  )
  const counts = new Map<number, Set<number>>()
  for (const x of out) counts.set(x.d, (counts.get(x.d) ?? new Set()).add(x.N))
  out = out.filter((x) => counts.get(x.d)!.size >= 2)
  FALLS.set(e.name, out)
  return out
}

/**
 * q12: leavers before and after over the staff, × 100, then the difference, 3 marks. Written:
 * 120 staff, 30 → 12 leavers, 25% → 10%, 15 points. The fall first, evenly. The percentage fall
 * in turnover, d ÷ before × 100, equals d only at a turnover of 100%: never.
 */
const turnoverFall = businessBySlot('people-turnover-points', TOPIC, {
  q12(r, slot) {
    const s = styleOf(slot)
    // The fall first, evenly; then an employer that can see it.
    const fall = pick(r, steps(4, 20, 1))
    const e = pick(r, EMPLOYERS.filter((x) => falls(x).some((y) => y.d === fall)))
    const ofFall = falls(e).filter((x) => x.d === fall)
    // A staff count weighted by how few falls it gives, as in q5, then a turnover before evenly.
    const N = weighted(r, [...new Set(ofFall.map((x) => x.N))], (n) => 1 / new Set(falls(e).filter((x) => x.N === n).map((x) => x.d)).size)
    const { d, p1 } = pick(r, ofFall.filter((x) => x.N === N))
    const p2 = p1 - d
    const L1 = (N * p1) / 100
    const L2 = (N * p2) / 100
    const fewer = L1 - L2
    const prompt = pick(r, [
      () => `${cap(e.who)} with ${num(N, s)} staff cuts leavers from ${L1} to ${L2} a year. By how many percentage points does its staff turnover fall?`,
      () => `${cap(e.who)} has ${num(N, s)} staff. After it improves its training, the number who leave each year falls from ${L1} to ${L2}. By how many percentage points does its staff turnover fall?`,
    ])()
    return numericDraft(
      slot,
      {
        prompt,
        solution: `Before: $(${L1} \\div ${N}) \\times 100 = ${p1}\\%$. After: $(${L2} \\div ${N}) \\times 100 = ${p2}\\%$. The fall is **${d} percentage points**, which is ${fewer} ${fewer === 1 ? 'fewer person' : 'fewer people'} to recruit, induct and train.`,
        method: [`calculates ${p1}%`, `calculates ${p2}%`],
        answer: d,
        line: String(d),
      },
      // Second route: the fall in leavers as a share of the staff.
      { agrees: near(((L1 - L2) / N) * 100, d), detail: `(${L1} − ${L2}) ÷ ${N} × 100 = ${show(((L1 - L2) / N) * 100)}` },
      { context: e.name, staff: N, before: L1, after: L2 },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// q24: managers in a hierarchy
// ---------------------------------------------------------------------------------------------

interface Hierarchy {
  name: string
  /** "a warehouse" */
  who: string
  /** The middle layer, singular: supervisor, team leader. */
  middle: string
  /** Most operational staff the place could have. */
  most: number
}
const HIERARCHIES: Hierarchy[] = [
  { name: 'business', who: 'a business', middle: 'supervisor', most: 600 },
  { name: 'warehouse', who: 'a warehouse', middle: 'supervisor', most: 600 },
  { name: 'call centre', who: 'a call centre', middle: 'team leader', most: 600 },
  { name: 'supermarket', who: 'a supermarket', middle: 'team leader', most: 400 },
  { name: 'factory', who: 'a factory', middle: 'supervisor', most: 800 },
]

/**
 * q24: staff ÷ the first span ÷ the second, 2 marks. Written: 48 ÷ 6 ÷ 4, 2 managers. The
 * managers first (2 to 12), then spans of 3 to 8 and 4 to 12, all three different; the
 * supervisors are never a span either, and no figure reads off as the answer.
 */
const hierarchy = businessBySlot('people-hierarchy-managers', TOPIC, {
  q24(r, slot) {
    const s = styleOf(slot)
    const h = pick(r, HIERARCHIES)
    const m = int(r, 2, 12)
    const { s1, s2 } = draw(
      r,
      (rr) => ({ s2: int(rr, 3, 8), s1: int(rr, 4, 12) }),
      (y) => new Set([m, y.s1, y.s2]).size === 3 && m * y.s2 !== y.s1 && m * y.s2 !== y.s2 && m * y.s1 * y.s2 <= h.most && !readsOff(m, [m * y.s1 * y.s2, m * y.s2]),
    )
    const sup = m * s2
    const N = sup * s1
    const mid = h.middle
    const mids = `${mid}s`
    return numericDraft(
      slot,
      {
        prompt: `${cap(h.who)} has ${num(N, s)} operational staff. Each ${mid} has ${s1} operational staff reporting to them, and each manager has ${s2} ${mids} reporting to them. Calculate the number of managers ${h.who.replace(/^an? /, 'the ')} needs.`,
        solution:
          `Work up the hierarchy one layer at a time. ${cap(mids)}: $${N} \\div ${s1} = ${sup}$. Managers: $${sup} \\div ${s2} = ${m}$. ` +
          `The structure has three layers: ${num(N, s)} operational staff, ${sup} ${mids} and ${m} managers. Widening the spans of control, so that more staff report to each ${mid}, would need fewer ${mids} and managers and make the structure flatter.`,
        method: [`$${N} \\div ${s1} = ${sup}$ ${mids}`],
        answer: m,
      },
      // Second route: each manager heads s2 × s1 operational staff.
      { agrees: N / (s1 * s2) === m && m * s2 * s1 === N, detail: `${N} ÷ (${s1} × ${s2}) = ${N / (s1 * s2)}` },
      { context: h.name, staff: N, span1: s1, span2: s2 },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// q25: basic salary plus commission
// ---------------------------------------------------------------------------------------------

interface Seller {
  name: string
  /** "A salesperson" */
  who: string
  /** "of goods" */
  goods: string
  /** Basic salary a month, in pounds. */
  basic: [number, number]
  /** Sales a month, in pounds, and their step. */
  sales: [number, number, number]
  rates: number[]
}
const SELLERS: Seller[] = [
  { name: 'salesperson', who: 'A salesperson', goods: 'of goods', basic: [1700, 2300], sales: [10000, 40000, 1000], rates: steps(2, 8, 1) },
  { name: 'cars', who: 'A car salesperson', goods: 'of cars', basic: [1800, 2300], sales: [60000, 250000, 5000], rates: [0.5, 1, 1.5] },
  { name: 'kitchens', who: 'A kitchen designer', goods: 'of kitchens', basic: [1900, 2400], sales: [20000, 80000, 1000], rates: steps(2, 5, 1) },
  { name: 'furniture', who: 'A sales assistant in a furniture showroom', goods: 'of furniture', basic: [1700, 2100], sales: [15000, 50000, 1000], rates: steps(2, 5, 1) },
  { name: 'phones', who: 'A sales adviser in a mobile phone shop', goods: 'of phones and contracts', basic: [1700, 2100], sales: [8000, 30000, 500], rates: steps(2, 6, 1) },
]

/**
 * q25: basic + rate × sales, 2 marks. Written: £1,600 + 5% of £24,000, £2,800. Commission in
 * whole pounds, never equal to the basic; a month's pay at most £5,000 (a car salesperson earns
 * 0.5% to 1.5% of what they sell, not 4%).
 */
const MOST_PAY = 5000
const commission = businessBySlot('people-commission', TOPIC, {
  q25(r, slot) {
    const s = styleOf(slot)
    const c = pick(r, SELLERS)
    const [she, her] = pick(r, [
      ['she', 'her'],
      ['he', 'his'],
    ] as const)
    const x = draw(
      r,
      (rr) => {
        const rate = pick(rr, c.rates)
        const sales = pick(rr, steps(c.sales[0], c.sales[1], c.sales[2]))
        const basic = pick(rr, steps(c.basic[0], c.basic[1], 50))
        return { rate, sales, basic, C: (sales * rate) / 100 }
      },
      (y) => whole(y.C) && y.C !== y.basic && y.basic + y.C <= MOST_PAY && !readsOff(y.basic + y.C, [y.basic, y.sales, y.C]),
    )
    const { rate, sales, basic, C } = x
    const T = basic + C
    const N = (v: number) => texNum(v, s)
    return numericDraft(
      slot,
      {
        prompt: `${c.who} is paid a basic salary of ${gbp(basic, s)} a month plus commission of ${show(rate)}% of the value of everything ${she} sells. In one month ${she} sells ${gbp(sales, s)} ${c.goods}. Calculate ${her} total pay for the month.`,
        solution:
          `Commission $= ${show(rate)}\\% \\times ${N(sales)} = ${show(rate / 100)} \\times ${N(sales)} = £${N(C)}$. Total pay $=$ basic salary $+$ commission $= ${N(basic)} + ${N(C)} =$ **${gbp(T, s)}**. ` +
          `Commission is a financial method of motivation: the more ${she} sells, the more ${she} earns, so the business pays most in the months it earns most.`,
        method: [`$${show(rate / 100)} \\times ${N(sales)} = ${N(C)}$`],
        answer: T,
      },
      // Second route: the pay less the basic, as a share of the sales, is the rate.
      { agrees: near(((T - basic) / sales) * 100, rate), detail: `(${T} − ${basic}) ÷ ${sales} × 100 = ${show(((T - basic) / sales) * 100)}` },
      { context: c.name, basic, sales, rate },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// q26: the net saving of a training programme
// ---------------------------------------------------------------------------------------------

interface Retainer {
  name: string
  who: string
  staff: [number, number]
  /** Turnover before the programme. */
  turnover: [number, number]
  /** Recruiting and training one replacement, in pounds. */
  cost: [number, number]
}
const RETAINERS: Retainer[] = [
  { name: 'business', who: 'A business', staff: [80, 300], turnover: [20, 40], cost: [1500, 4000] },
  { name: 'care homes', who: 'A group of care homes', staff: [80, 300], turnover: [25, 45], cost: [1000, 3000] },
  { name: 'hotels', who: 'A hotel chain', staff: [100, 400], turnover: [25, 45], cost: [1000, 3000] },
  { name: 'call centre', who: 'A call centre', staff: [100, 400], turnover: [25, 45], cost: [1500, 3500] },
  { name: 'accountancy', who: 'An accountancy firm', staff: [40, 240], turnover: [12, 30], cost: [4000, 8000] },
]

interface Cut {
  N: number
  p1: number
  p2: number
}
/**
 * Every staff count (fives, tens and twenties, as for q5) and pair of whole turnovers whose
 * leavers are whole: the one after at least 45% of the one before and at least 5 points lower,
 * and never half of it (then "cut to" read as "cut by" gives the same leavers), with enough
 * leavers saved to pay for a programme.
 */
const CUTS = new Map<string, Cut[]>()
function cuts(c: Retainer): Cut[] {
  let out = CUTS.get(c.name)
  if (out) return out
  out = staffing(c)
    .filter((N) => N !== 100)
    .flatMap((N) =>
      steps(c.turnover[0], c.turnover[1], 1).flatMap((p1) =>
        steps(Math.max(5, Math.ceil(0.45 * p1)), p1 - 5, 1)
          .filter((p2) => p1 !== 2 * p2 && whole((N * p1) / 100) && whole((N * p2) / 100) && ((N * (p1 - p2)) / 100) * c.cost[1] >= 8000)
          .map((p2) => ({ N, p1, p2 })),
      ),
    )
  // A staff count that allows only one or two pairs (110 staff: 30% → 20% or 40% → 30%) is left out.
  const pairs = new Map<number, number>()
  for (const y of out) pairs.set(y.N, (pairs.get(y.N) ?? 0) + 1)
  out = out.filter((y) => pairs.get(y.N)! >= 3)
  CUTS.set(c.name, out)
  return out
}
/**
 * A weight for each of an employer's cuts that makes every staff count and every pair of
 * turnovers about equally likely, as far as the cuts allow: the rows (staff counts) and columns
 * (pairs) are scaled in turn until both even out. Drawing the staff first handed 30% → 20% and
 * 40% → 30% half the builds; drawing the pair first handed 200 and 300 staff most of them.
 */
const BALANCED = new Map<string, number[]>()
function balanced(c: Retainer): number[] {
  let w = BALANCED.get(c.name)
  if (w) return w
  const all = cuts(c)
  const pairOf = (y: Cut) => `${y.p1}/${y.p2}`
  w = all.map(() => 1)
  for (let round = 0; round < 60; round++) {
    for (const key of [pairOf, (y: Cut) => String(y.N)]) {
      const sums = new Map<string, number>()
      all.forEach((y, i) => sums.set(key(y), (sums.get(key(y)) ?? 0) + w![i]!))
      w = w.map((v, i) => v / sums.get(key(all[i]!))!)
    }
  }
  BALANCED.set(c.name, w)
  return w
}

/**
 * q26: leavers before × cost − (leavers after × cost + programme), 3 marks. Written: 45 × £2,000
 * − (24 × £2,000 + £30,000), £12,000. A staff count and pair of turnovers together (see `cuts`
 * and `balanced`; written: 30% → 16%); the programme
 * costs 40% to 85% of the replacement costs it saves, in whole thousands, so the saving is
 * positive; the saving is never the programme's cost, one replacement's, the replacement bill
 * with the programme, or a printed count with the point moved, and the programme's cost is
 * never a printed count with the point moved (£46,000 against 46 leavers).
 */
const trainingSaving = businessBySlot('people-training-saving', TOPIC, {
  q26(r, slot) {
    const s = styleOf(slot)
    const c = pick(r, RETAINERS)
    // The staff count and pair of turnovers together, balanced (see `balanced`).
    const w = balanced(c)
    const { N, p1, p2 } = weighted(r, cuts(c), (y) => w[cuts(c).indexOf(y)]!)
    const x = draw(
      r,
      (rr) => {
        const cost = pick(rr, steps(c.cost[0], c.cost[1], 500))
        const L1 = (N * p1) / 100
        const L2 = (N * p2) / 100
        const gross = (L1 - L2) * cost
        const lo = Math.max(5000, Math.ceil((0.4 * gross) / 1000) * 1000)
        const hi = Math.min(80000, Math.floor((0.85 * gross) / 1000) * 1000)
        const P = hi >= lo ? pick(rr, steps(lo, hi, 1000)) : NaN
        return { cost, L1, L2, P, S: gross - P }
      },
      (y) =>
        whole(y.L1) &&
        whole(y.L2) &&
        Number.isFinite(y.P) &&
        y.S >= 1000 &&
        ![y.P, y.cost, y.L2 * y.cost, y.L2 * y.cost - y.P].includes(y.S) &&
        y.P !== y.cost &&
        !readsOff(y.P, [N, y.L1, y.L2]) &&
        !readsOff(y.S, [N, y.L1, y.L2, y.cost, y.P]),
    )
    const { cost, L1, L2, P, S } = x
    const now = L1 * cost
    const replace = L2 * cost
    const after = replace + P
    const T = (v: number) => texNum(v, s)
    return numericDraft(
      slot,
      {
        prompt: `${c.who} has ${num(N, s)} staff, and ${L1} of them leave each year. Recruiting and training each replacement costs the business ${gbp(cost, s)}. A training and development programme costing ${gbp(P, s)} a year is expected to cut the number of leavers to ${L2}. Calculate the net saving the programme would make in its first year, after its own cost has been paid.`,
        solution:
          `Cost of replacing leavers now $= ${L1} \\times ${T(cost)} = £${T(now)}$. With the programme: $${L2} \\times ${T(cost)} = £${T(replace)}$ of replacement costs plus ${gbp(P, s)} for the programme $= £${T(after)}$. Saving $= ${T(now)} - ${T(after)} =$ **${gbp(S, s)}**. ` +
          `Staff turnover falls from $${L1} \\div ${N} \\times 100 = ${p1}\\%$ to $${L2} \\div ${N} \\times 100 = ${p2}\\%$, which is the link the specification draws between training, motivation and retention.`,
        method: [`$${L1} \\times ${T(cost)} = ${T(now)}$`, `$${L2} \\times ${T(cost)} + ${T(P)} = ${T(after)}$`],
        answer: S,
      },
      // Second route: the leavers saved, each worth one replacement, less the programme.
      { agrees: (L1 - L2) * cost - P === S && now - after === S, detail: `(${L1} − ${L2}) × ${cost} − ${P} = ${(L1 - L2) * cost - P}` },
      { context: c.name, staff: N, before: L1, after: L2, cost, programme: P },
    )
  },
})

export const peopleGenerators: Generator[] = [turnover, turnoverFall, hierarchy, commission, trainingSaving]

/** For the tests. */
export const PEOPLE = { EMPLOYERS, STAFF, staffing, rates, falls, cuts, balanced, MOST_PAY, HIERARCHIES, SELLERS, RETAINERS }
