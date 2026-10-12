import { show } from '../format.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import type { Generator } from '../types.ts'
import { businessBySlot, gbp, near, num, numericDraft, percentChange, readsOff, steps, styleOf, texGbp, texNum, texPounds, totalCosts } from './build.ts'

/**
 * Business (Edexcel 1BS0) generators: Topic 2.3, making operational decisions. Every numeric
 * written slot in the topic has a generator; none is left written.
 *
 * - 2.3.1 production processes, keeping productivity up and costs down: productivity per worker
 *   (q4), output ÷ workers (Appendix 2 "averages"; the specification gives no productivity
 *   formula and Appendix 3 lists none); the percentage increase in productivity after new
 *   technology (q25, 2.3.1 impacts of technology on production, Appendix 2 "percentages and
 *   percentage changes"); and the fall in cost per unit when a flow line swaps variable cost for
 *   fixed cost (q26, 2.3.1 types of production process, Appendix 3 total costs, then the average
 *   cost per unit, Appendix 2 "revenue, costs and profit").
 * - 2.3.2 managing stock, interpretation of bar gate stock graphs (Appendix 2 "information from
 *   graphs and charts"): the buffer stock from the reorder level, usage and lead time (q6), each
 *   delivery from the maximum and the buffer (q10), and the reorder level from the buffer,
 *   usage and lead time (q24). The specification gives no stock formulae; these are the readings
 *   of the graph the written questions use.
 *
 * q6, q10 and q24 share the higher sheet, so each draws from its own list of stock (q24's is all
 * kilograms, as its written units are): no two of them print the same business. Lead times are
 * always two periods or more, so usage alone (one period) never stands in for usage during the
 * lead time.
 */
const TOPIC = 'making-operational-decisions'

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']

/** Productivity, output per worker (Appendix 2 averages). */
const productivity = (output: number, workers: number) => output / workers

// ---------------------------------------------------------------------------------------------
// q4: productivity per worker
// ---------------------------------------------------------------------------------------------

interface Team {
  name: string
  /** The place, after "in": "a furniture workshop". */
  place: string
  workers: string
  /** What the workers do to the items: "make", "repair". */
  verb: string
  items: string
  /** The period: "week", "day". */
  per: string
  /** Output per worker in the period, and the team size. */
  each: [number, number]
  size: [number, number]
}
/**
 * Small teams with an output each worker could make by hand. Totals stay at 400 or under and
 * teams at 12 or under, so the division works without a calculator (the slot is "either").
 */
const TEAMS: Team[] = [
  { name: 'chairs', place: 'a furniture workshop', workers: 'workers', verb: 'make', items: 'chairs', per: 'week', each: [6, 20], size: [2, 12] },
  { name: 'loaves', place: 'a bakery', workers: 'bakers', verb: 'bake', items: 'loaves', per: 'day', each: [20, 45], size: [2, 8] },
  { name: 'bicycles', place: 'a bicycle workshop', workers: 'mechanics', verb: 'assemble', items: 'bicycles', per: 'week', each: [8, 25], size: [2, 12] },
  { name: 'T-shirts', place: 'a T-shirt printer', workers: 'printers', verb: 'print', items: 'T-shirts', per: 'day', each: [20, 40], size: [2, 9] },
  { name: 'repairs', place: 'a phone-repair shop', workers: 'technicians', verb: 'repair', items: 'phones', per: 'day', each: [5, 12], size: [2, 6] },
  { name: 'haircuts', place: 'a salon', workers: 'stylists', verb: 'give', items: 'haircuts', per: 'day', each: [6, 12], size: [2, 8] },
  { name: 'cakes', place: 'a cake shop', workers: 'decorators', verb: 'decorate', items: 'cakes', per: 'week', each: [10, 30], size: [2, 8] },
  { name: 'cars', place: 'a car valeting business', workers: 'valeters', verb: 'valet', items: 'cars', per: 'day', each: [4, 9], size: [2, 10] },
]
const MAX_OUTPUT = 400

const perWorker = businessBySlot('business-productivity-per-worker', TOPIC, {
  q4(r, slot) {
    const s = styleOf(slot)
    const t = pick(r, TEAMS)
    // The answer first, then a team that keeps the total by hand; never one or ten workers (the
    // division is trivial), never as many workers as the answer.
    const p = int(r, t.each[0], t.each[1])
    const w = pick(r, steps(t.size[0], t.size[1], 1).filter((n) => n !== p && n !== 10 && n * p <= MAX_OUTPUT))
    const out = w * p
    const prompt = pick(r, [
      () => `${cap(WORDS[w]!)} ${t.workers} in ${t.place} ${t.verb} ${num(out, s)} ${t.items} in a ${t.per}. What is the productivity per worker?`,
      () => `In one ${t.per}, ${w} ${t.workers} in ${t.place} ${t.verb} ${num(out, s)} ${t.items} between them. Calculate the productivity per worker.`,
      () => `${cap(t.place)} employs ${w} ${t.workers}, who ${t.verb} ${num(out, s)} ${t.items} a ${t.per} in total. What is the productivity per worker?`,
    ])()
    return numericDraft(
      slot,
      {
        prompt,
        solution: `Productivity is output per worker: $${texNum(out, s)} \\div ${w} = $ **${p}** ${t.items} per worker per ${t.per}. The more each worker makes, the less labour cost each of the ${t.items} carries, which is how productivity keeps costs down.`,
        method: [`divides output by workers: $${texNum(out, s)} \\div ${w}$`],
        answer: productivity(out, w),
        line: String(p),
      },
      // Second route: the answer times the team gives the output back.
      { agrees: p * w === out && productivity(out, w) === p, detail: `${p} × ${w} = ${p * w}` },
      { context: t.name, workers: w, output: out, perWorker: p },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// Bar gate stock: q6 (buffer), q10 (delivery), q24 (reorder level)
// ---------------------------------------------------------------------------------------------

interface Stock {
  name: string
  who: string
  /** Short name for later in the sentence: "the bakery". */
  short: string
  /** The stock as a noun phrase after a figure: "tyres", "litres of milk". */
  thing: string
  /** The unit asked for: "tyres", "litres". */
  unit: string
  per: 'day' | 'week'
  /** Usage per period [lo, hi, step], lead time in periods, buffer [lo, hi, step]. */
  usage: [number, number, number]
  lead: [number, number]
  buffer: [number, number, number]
}

/** q6: the buffer from the reorder level. No kilograms (q24's) and none of q10's stock. */
const BUFFERS: Stock[] = [
  { name: 'units', who: 'A business', short: 'business', thing: 'units', unit: 'units', per: 'week', usage: [50, 300, 10], lead: [2, 4], buffer: [50, 400, 10] },
  { name: 'tyres', who: 'A tyre-fitting garage', short: 'garage', thing: 'tyres', unit: 'tyres', per: 'day', usage: [4, 16, 1], lead: [2, 4], buffer: [10, 40, 2] },
  { name: 'milk', who: 'A café', short: 'café', thing: 'litres of milk', unit: 'litres', per: 'day', usage: [15, 60, 5], lead: [2, 4], buffer: [10, 60, 5] },
  { name: 'fabric', who: 'A curtain maker', short: 'curtain maker', thing: 'metres of fabric', unit: 'metres', per: 'week', usage: [40, 150, 10], lead: [2, 4], buffer: [50, 200, 10] },
  { name: 'paper', who: 'A print shop', short: 'print shop', thing: 'reams of paper', unit: 'reams', per: 'day', usage: [10, 40, 5], lead: [2, 5], buffer: [20, 100, 5] },
]

/** q24: the reorder level, in kilograms as the written slot's units are. */
const REORDERS: Stock[] = [
  { name: 'flour', who: 'A bakery', short: 'bakery', thing: 'kilograms of flour', unit: 'kilograms', per: 'day', usage: [30, 150, 5], lead: [2, 6], buffer: [50, 400, 10] },
  { name: 'coffee', who: 'A coffee roaster', short: 'roaster', thing: 'kilograms of green coffee beans', unit: 'kilograms', per: 'day', usage: [10, 60, 2], lead: [3, 7], buffer: [40, 300, 10] },
  { name: 'potatoes', who: 'A chip shop', short: 'chip shop', thing: 'kilograms of potatoes', unit: 'kilograms', per: 'day', usage: [40, 150, 5], lead: [2, 4], buffer: [50, 300, 10] },
  { name: 'cheese', who: 'A pizza takeaway', short: 'takeaway', thing: 'kilograms of mozzarella', unit: 'kilograms', per: 'day', usage: [5, 25, 1], lead: [2, 4], buffer: [10, 60, 2] },
  { name: 'clay', who: 'A pottery', short: 'pottery', thing: 'kilograms of clay', unit: 'kilograms', per: 'week', usage: [50, 200, 10], lead: [2, 3], buffer: [50, 250, 10] },
  { name: 'sugar', who: 'A sweet maker', short: 'sweet maker', thing: 'kilograms of sugar', unit: 'kilograms', per: 'day', usage: [20, 80, 5], lead: [2, 5], buffer: [40, 250, 10] },
  { name: 'rice', who: 'A restaurant', short: 'restaurant', thing: 'kilograms of rice', unit: 'kilograms', per: 'day', usage: [8, 30, 1], lead: [2, 5], buffer: [20, 100, 5] },
]

interface Holding {
  name: string
  who: string
  thing: string
  unit: string
  /** Maximum stock [lo, hi, step]. */
  max: [number, number, number]
}
/** q10: maximum and buffer. None of q6's or q24's stock. */
const HOLDINGS: Holding[] = [
  { name: 'oak', who: 'A furniture workshop', thing: 'metres of oak', unit: 'metres', max: [200, 800, 50] },
  { name: 'metres', who: 'A business', thing: 'metres', unit: 'metres', max: [200, 1000, 50] },
  { name: 'cement', who: "A builders' merchant", thing: 'bags of cement', unit: 'bags', max: [200, 1000, 50] },
  { name: 'trainers', who: 'A shoe shop', thing: 'pairs of trainers', unit: 'pairs', max: [80, 400, 10] },
  { name: 'compost', who: 'A garden centre', thing: 'bags of compost', unit: 'bags', max: [100, 600, 10] },
  { name: 'paint', who: 'A decorating shop', thing: 'tins of paint', unit: 'tins', max: [100, 500, 10] },
]

const periods = (n: number, per: string) => `${n} ${per}s`

interface Lead {
  u: number
  L: number
  B: number
}
function leadDraw(r: Rng, c: Stock): Lead {
  return { u: pick(r, steps(...c.usage)), L: int(r, c.lead[0], c.lead[1]), B: pick(r, steps(...c.buffer)) }
}
/** No two givens equal, and the buffer never equal to the stock used during the lead time (the written q6's coincidence). */
const leadOk = (x: Lead) => new Set([x.u, x.L, x.B, x.u * x.L]).size === 4

const bufferStock = businessBySlot('business-stock-buffer', TOPIC, {
  q6(r, slot) {
    const s = styleOf(slot)
    const c = pick(r, BUFFERS)
    const x = draw(r, (r) => leadDraw(r, c), leadOk)
    const used = x.u * x.L
    const R = x.B + used
    const prompt = pick(r, [
      () => `${c.who} reorders at ${num(R, s)} ${c.thing}, uses ${num(x.u, s)} a ${c.per}, and the supplier takes ${periods(x.L, c.per)}. What is the buffer stock, in ${c.unit}?`,
      () => `${c.who} uses ${num(x.u, s)} ${c.thing} a ${c.per}. It reorders when its stock falls to ${num(R, s)} ${c.unit}, and each delivery arrives ${periods(x.L, c.per)} after the order. What is its buffer stock, in ${c.unit}?`,
    ])()
    return numericDraft(
      slot,
      {
        prompt,
        solution: `It uses $${texNum(x.u, s)} \\times ${x.L} = ${texNum(used, s)}$ ${c.unit} during the lead time, so stock falls from ${num(R, s)} to **${num(x.B, s)}**. That is the buffer stock: the lowest point of each sawtooth on the bar gate stock graph, the stock left as each delivery arrives.`,
        method: [`usage × lead time: $${texNum(x.u, s)} \\times ${x.L} = ${texNum(used, s)}$`],
        answer: x.B,
        line: num(x.B, s),
      },
      // Second route: reordering at the buffer plus the lead time's usage gives the printed reorder level.
      { agrees: x.B + x.u * x.L === R && x.B > 0, detail: `${x.B} + ${x.u} × ${x.L} = ${x.B + x.u * x.L}` },
      { context: c.name, reorder: R, usage: x.u, lead: x.L, buffer: x.B },
    )
  },
})

const reorderLevel = businessBySlot('business-stock-reorder-level', TOPIC, {
  q24(r, slot) {
    const s = styleOf(slot)
    const c = pick(r, REORDERS)
    const x = draw(r, (r) => leadDraw(r, c), leadOk)
    const used = x.u * x.L
    const answer = x.B + used
    const prompt = pick(r, [
      () => `${c.who} uses ${num(x.u, s)} ${c.thing} a ${c.per}. Its supplier takes ${periods(x.L, c.per)} to deliver, and the ${c.short} keeps a buffer stock of ${num(x.B, s)} kilograms. Calculate the stock level, in kilograms, at which the ${c.short} should reorder.`,
      () => `${c.who} keeps a buffer stock of ${num(x.B, s)} ${c.thing} and uses ${num(x.u, s)} kilograms a ${c.per}. Each delivery arrives ${periods(x.L, c.per)} after it is ordered. Calculate the stock level, in kilograms, at which the ${c.short} should reorder.`,
    ])()
    return numericDraft(
      slot,
      {
        prompt,
        solution:
          `During the ${periods(x.L, c.per)} a delivery takes, the ${c.short} uses $${texNum(x.u, s)} \\times ${x.L} = ${texNum(used, s)}$ kg. To be left with its buffer when the delivery arrives, it must reorder at buffer stock $+$ the stock used while waiting $= ${texNum(x.B, s)} + ${texNum(used, s)} = ${texNum(answer, s)}$ kg. ` +
          'On a bar gate stock graph this is the reorder level, the line at which each new order is placed.',
        method: [`$${texNum(x.u, s)} \\times ${x.L} = ${texNum(used, s)}$ kg used while waiting for the delivery`],
        answer,
      },
      // Second route: stock at the reorder level, run down for the lead time, leaves the buffer.
      { agrees: answer - x.L * x.u === x.B, detail: `${answer} − ${x.L} × ${x.u} = ${answer - x.L * x.u}` },
      { context: c.name, usage: x.u, lead: x.L, buffer: x.B, reorder: answer },
    )
  },
})

const deliverySize = businessBySlot('business-stock-delivery', TOPIC, {
  q10(r, slot) {
    const s = styleOf(slot)
    const c = pick(r, HOLDINGS)
    const [lo, hi, step] = c.max
    // The maximum, then a buffer of 10% to 40% of it in steps of 10 (or 25 where the maximum
    // moves in fifties), never half: the buffer stepped like the maximum sat at 100 or 50 in a
    // third of builds.
    const M = pick(r, steps(lo, hi, step))
    const bStep = step >= 50 ? 25 : 10
    const B = pick(r, steps(bStep, M, bStep).filter((b) => b >= 0.1 * M && b <= 0.4 * M && 2 * b !== M))
    const D = M - B
    const prompt = pick(r, [
      () => `${c.who} holds a maximum of ${num(M, s)} ${c.thing} and its buffer stock is ${num(B, s)} ${c.unit}. What size is each delivery, in ${c.unit}?`,
      () => `${c.who} keeps a buffer stock of ${num(B, s)} ${c.thing} and holds at most ${num(M, s)} ${c.unit}. What size is each delivery, in ${c.unit}?`,
    ])()
    return numericDraft(
      slot,
      {
        prompt,
        solution: `The delivery refills from the buffer back to the maximum: $${texNum(M, s)} - ${texNum(B, s)} = $ **${num(D, s)}** ${c.unit}. On a bar gate stock graph it is the height of each vertical line, from the bottom of the sawtooth to the top.`,
        method: [`maximum minus buffer: $${texNum(M, s)} - ${texNum(B, s)}$`],
        answer: D,
        line: num(D, s),
      },
      // Second route: the buffer topped up by a delivery reaches the maximum.
      { agrees: B + D === M && D > B, detail: `${B} + ${D} = ${B + D}` },
      { context: c.name, max: M, buffer: B, delivery: D },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// q25: percentage increase in productivity after new technology
// ---------------------------------------------------------------------------------------------

interface Upgrade {
  name: string
  place: string
  workers: string
  /** What the workers did and do to the items: "made", "make". */
  did: string
  do: string
  items: string
  per: string
  /** "a new machine was installed", and its short form after "With": "the machine". */
  before: string
  after: string
  /** Output per worker before, in the period. */
  each: [number, number]
  size: [number, number]
}
const UPGRADES: Upgrade[] = [
  { name: 'workshop', place: 'a workshop', workers: 'workers', did: 'made', do: 'make', items: 'units', per: 'week', before: 'a new machine was installed', after: 'the machine', each: [25, 200], size: [3, 15] },
  { name: 'bakery', place: 'a bakery', workers: 'bakers', did: 'baked', do: 'bake', items: 'loaves', per: 'day', before: 'new ovens were installed', after: 'the new ovens', each: [25, 200], size: [3, 10] },
  { name: 'call centre', place: 'a call centre', workers: 'staff', did: 'handled', do: 'handle', items: 'calls', per: 'day', before: 'new software was introduced', after: 'the software', each: [25, 100], size: [5, 20] },
  { name: 'print works', place: 'a print works', workers: 'printers', did: 'printed', do: 'print', items: 'T-shirts', per: 'day', before: 'an automatic press was installed', after: 'the press', each: [25, 200], size: [3, 12] },
  { name: 'warehouse', place: 'a warehouse', workers: 'pickers', did: 'packed', do: 'pack', items: 'orders', per: 'day', before: 'handheld scanners were introduced', after: 'the scanners', each: [25, 200], size: [4, 20] },
  { name: 'factory', place: 'a clothing factory', workers: 'machinists', did: 'sewed', do: 'sew', items: 'garments', per: 'week', before: 'faster sewing machines were installed', after: 'the new machines', each: [25, 200], size: [5, 20] },
]
/**
 * Increases from 8% (below it, the rise over the new figure rounds to the answer) to 45%, each a
 * multiple of 4 or 5, so a whole output per worker grows to a whole one.
 */
/**
 * Output per worker runs 25 to 200 (the call centre to 100 calls a day), so the rises that need
 * a multiple of 25 have six or more to choose from; a narrower range left 75 in 18% of builds.
 */
const PRODUCTIVITY_RISES = [8, 12, 15, 16, 20, 24, 25, 28, 30, 32, 35, 36, 40, 45]

const productivityIncrease = businessBySlot('business-productivity-increase', TOPIC, {
  q25(r, slot) {
    const s = styleOf(slot)
    const u = pick(r, UPGRADES)
    // The rises that need a multiple of 25 (8%, 12%, … 36%) two times in five, the rest three in
    // five: evenly, output per worker sat at 75 in a tenth of builds.
    const quarters = PRODUCTIVITY_RISES.filter((x) => x % 4 === 0 && x % 5 !== 0)
    const p = pick(r, r() < 0.4 ? quarters : PRODUCTIVITY_RISES.filter((x) => !quarters.includes(x)))
    const x = draw(
      r,
      (r) => {
        const each = steps(u.each[0], u.each[1], 1).filter((b) => Number.isInteger((b * p) / 100))
        return { b: pick(r, each), w: int(r, u.size[0], u.size[1]) }
      },
      ({ b, w }) => {
        const b2 = (b * p) / 100 + b
        return w !== 10 && new Set([b, w, p]).size === 3 && !readsOff(p, [w, b, b2, b2 - b, w * b, w * b2, w * (b2 - b)])
      },
    )
    const { b, w } = x
    const b2 = b + (b * p) / 100
    const out1 = w * b
    const out2 = w * b2
    const T = (n: number) => texNum(n, s)
    const prompt = pick(r, [
      () => `Before ${u.before}, ${w} ${u.workers} in ${u.place} ${u.did} ${num(out1, s)} ${u.items} a ${u.per}. With ${u.after}, the same ${w} ${u.workers} ${u.do} ${num(out2, s)} ${u.items} a ${u.per}. Calculate the percentage increase in productivity.`,
      () => `${cap(u.place)} has ${w} ${u.workers}, who ${u.did} ${num(out1, s)} ${u.items} a ${u.per} between them before ${u.before}. Now the same ${w} ${u.workers} ${u.do} ${num(out2, s)} ${u.items} a ${u.per}. Calculate the percentage increase in productivity.`,
    ])()
    const answer = percentChange(productivity(out1, w), productivity(out2, w))
    return numericDraft(
      slot,
      {
        prompt,
        solution:
          `Productivity is output per worker. Before: $${T(out1)} \\div ${w} = ${T(b)}$ ${u.items} a ${u.per} each. After: $${T(out2)} \\div ${w} = ${T(b2)}$ ${u.items}. The increase is $${T(b2 - b)} \\div ${T(b)} \\times 100 = ${p}\\%$. ` +
          `Because the number of workers has not changed, the rise in output, $${T(out2 - out1)} \\div ${T(out1)} \\times 100 = ${p}\\%$, gives the same answer. Higher productivity means each of the ${u.items} carries less labour cost, which is how technology keeps costs down.`,
        method: [`$${T(out1)} \\div ${w} = ${T(b)}$ and $${T(out2)} \\div ${w} = ${T(b2)}$, or $${T(out2 - out1)} \\div ${T(out1)}$`],
        answer: p,
        line: `${p}%`,
      },
      // Second route: the output's own percentage rise, the same because the team is the same.
      { agrees: near(answer, p) && near(((out2 - out1) / out1) * 100, p), detail: `${out2 - out1} ÷ ${out1} × 100 = ${show(((out2 - out1) / out1) * 100)}` },
      { context: u.name, workers: w, before: out1, after: out2, perWorker: b, percent: p },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// q26: fall in cost per unit with a flow production line
// ---------------------------------------------------------------------------------------------

interface Plant {
  name: string
  /** The opening: "A factory makes". */
  who: string
  items: string
  /** One of them, for the costs "a unit": "unit", "chair". */
  item: string
  /** Weekly outputs a plant of this kind could make. */
  outputs: number[]
  /** Variable cost per unit now [lo, hi, step], in pounds. */
  variable: [number, number, number]
  /** Fixed costs a week now, in pounds. */
  fixed: [number, number]
  /** The fall in cost per unit [lo, hi, step], in pence: a plant's own scale. */
  fall: [number, number, number]
}
/**
 * Factories that could move to a flow line. Never a bakery: q30 on the same sheet asks whether a
 * bakery should install one.
 */
const PLANTS: Plant[] = [
  { name: 'factory', who: 'A factory makes', items: 'units', item: 'unit', outputs: [2000, 2500, 4000, 5000, 8000, 10000], variable: [2, 12, 1], fixed: [5000, 40000], fall: [20, 150, 5] },
  { name: 'toys', who: 'A toy factory makes', items: 'toys', item: 'toy', outputs: [2000, 2500, 4000, 5000, 8000], variable: [3, 10, 1], fixed: [5000, 30000], fall: [20, 120, 5] },
  { name: 'chairs', who: 'A furniture factory makes', items: 'chairs', item: 'chair', outputs: [400, 500, 800, 1000, 1250, 2000], variable: [20, 60, 2], fixed: [8000, 40000], fall: [50, 400, 10] },
  { name: 'T-shirts', who: 'A clothing factory makes', items: 'T-shirts', item: 'T-shirt', outputs: [4000, 5000, 8000, 10000, 20000], variable: [2, 6, 0.5], fixed: [8000, 40000], fall: [10, 80, 5] },
  { name: 'shoes', who: 'A shoe factory makes', items: 'pairs of shoes', item: 'pair', outputs: [1000, 2000, 2500, 4000, 5000], variable: [10, 25, 1], fixed: [10000, 50000], fall: [30, 250, 10] },
  { name: 'bottles', who: 'A bottling plant fills', items: 'bottles', item: 'bottle', outputs: [20000, 25000, 40000, 50000], variable: [0.4, 1.2, 0.1], fixed: [5000, 30000], fall: [3, 15, 1] },
]

interface Line {
  Q: number
  V1: number
  V2: number
  F1: number
  F2: number
  /** The fall in cost per unit, in pence. */
  fall: number
}

/** Everything printed or worked out, and the wrong routes, in pence: none may equal the fall. */
export function lineFigures(x: Line) {
  const c = (n: number) => Math.round(n * 100)
  const u1 = x.F1 / x.Q + x.V1
  const u2 = x.F2 / x.Q + x.V2
  return {
    printed: [x.V1, x.V2].map(c),
    working: [u1, u2, x.F1 / x.Q, x.F2 / x.Q].map(c),
    // Variable costs alone; the rise in fixed cost per unit; the total weekly saving.
    wrong: [x.V1 - x.V2, (x.F2 - x.F1) / x.Q, (u1 - u2) * x.Q].map(c),
  }
}

const flowUnitCost = businessBySlot('business-flow-unit-cost', TOPIC, {
  q26(r, slot) {
    const s = styleOf(slot)
    const c = pick(r, PLANTS)
    // The answer first, from the plant's own range, outside the draw: fitting the fall to the
    // costs left the bottling plant at 5p in 28% of builds.
    const fall = pick(r, steps(...c.fall))
    const x = draw(
      r,
      (r): Line | null => {
        const Q = pick(r, c.outputs)
        // Fixed costs in thousands that share out to whole pence a unit.
        const F1 = pick(r, steps(c.fixed[0], c.fixed[1], 1000).filter((F) => (F * 100) % Q === 0))
        const V1 = pick(r, steps(...c.variable))
        // The line cuts the variable cost by 20% to 60%, by more than the fall and never by twice
        // it, leaving new fixed costs in whole hundreds, 1.2 to 3 times the old.
        const cuts = steps(c.variable[2], V1, c.variable[2]).filter((d) => {
          const dvp = Math.round(d * 100)
          const F2 = F1 + (Q * (dvp - fall)) / 100
          return d >= 0.2 * V1 - 1e-9 && d <= 0.6 * V1 + 1e-9 && dvp > fall && dvp !== 2 * fall && Number.isInteger(F2 / 100) && F2 >= 1.2 * F1 && F2 <= 3 * F1
        })
        if (!cuts.length) return null
        const dvp = Math.round(pick(r, cuts) * 100)
        return { Q, V1, V2: Number(show(V1 - dvp / 100)), F1, F2: F1 + (Q * (dvp - fall)) / 100, fall }
      },
      (x): x is Line => {
        if (!x) return false
        const f = lineFigures(x)
        return ![...f.printed, ...f.working, ...f.wrong].includes(x.fall)
      },
    )!
    const unit1 = totalCosts(x.F1, x.V1, x.Q) / x.Q
    const unit2 = totalCosts(x.F2, x.V2, x.Q) / x.Q
    const answer = x.fall / 100
    const T = (n: number) => texNum(n, s)
    const Pd = (n: number) => texPounds(n, s)
    const P = (n: number) => texGbp(n, s, true)
    const t1 = Number(show(totalCosts(x.F1, x.V1, x.Q)))
    const t2 = Number(show(totalCosts(x.F2, x.V2, x.Q)))
    const v1 = Number(show(x.V1 * x.Q))
    const v2 = Number(show(x.V2 * x.Q))
    const prompt = pick(r, [
      () => `${c.who} ${num(x.Q, s)} ${c.items} a week. Its fixed costs are ${gbp(x.F1, s)} a week and its variable costs are ${gbp(x.V1, s)} a ${c.item}. A new flow production line would raise fixed costs to ${gbp(x.F2, s)} a week and cut variable costs to ${gbp(x.V2, s)} a ${c.item}, with output unchanged at ${num(x.Q, s)} ${c.items}. Calculate the fall in the cost per ${c.item}.`,
      () => `${c.who} ${num(x.Q, s)} ${c.items} a week, with fixed costs of ${gbp(x.F1, s)} a week and variable costs of ${gbp(x.V1, s)} a ${c.item}. Moving to flow production would cut variable costs to ${gbp(x.V2, s)} a ${c.item} but raise fixed costs to ${gbp(x.F2, s)} a week; output would stay at ${num(x.Q, s)} ${c.items}. Calculate the fall in the cost per ${c.item}.`,
    ])()
    return numericDraft(
      slot,
      {
        prompt,
        solution:
          `Total cost $=$ fixed costs $+$ variable cost per unit $\\times$ output. Now: $${T(x.F1)} + ${Pd(x.V1)} \\times ${T(x.Q)} = ${texGbp(t1, s)}$, so the cost per ${c.item} is $${T(t1)} \\div ${T(x.Q)} = ${P(unit1)}$. ` +
          `With the line: $${T(x.F2)} + ${Pd(x.V2)} \\times ${T(x.Q)} = ${texGbp(t2, s)}$, so $${T(t2)} \\div ${T(x.Q)} = ${P(unit2)}$. The fall is $${P(unit1).replace('£', '')} - ${P(unit2).replace('£', '')} = ${P(answer)}$ a ${c.item}. ` +
          'The line swaps variable cost for fixed cost, so the saving depends on output: at a much lower output the higher fixed costs could wipe it out.',
        method: [`$${T(x.F1)} + ${T(v1)} = ${T(t1)}$, so ${gbp(unit1, s, true)} a ${c.item}`, `$${T(x.F2)} + ${T(v2)} = ${T(t2)}$, so ${gbp(unit2, s, true)} a ${c.item}`],
        answer,
        line: gbp(answer, s, true),
      },
      // Second route: the saving in variable cost less the extra fixed cost shared over the output.
      { agrees: near(x.V1 - x.V2 - (x.F2 - x.F1) / x.Q, answer) && near(unit1 - unit2, answer) && answer > 0, detail: `${show(x.V1 - x.V2)} − ${x.F2 - x.F1} ÷ ${x.Q} = ${show(x.V1 - x.V2 - (x.F2 - x.F1) / x.Q)}` },
      { context: c.name, output: x.Q, fixedBefore: x.F1, fixedAfter: x.F2, variableBefore: x.V1, variableAfter: x.V2, fall: answer },
    )
  },
})

export const operationsGenerators: Generator[] = [perWorker, bufferStock, deliverySize, reorderLevel, productivityIncrease, flowUnitCost]

/** For the tests. */
export const OPERATIONS = { TEAMS, MAX_OUTPUT, BUFFERS, REORDERS, HOLDINGS, UPGRADES, PRODUCTIVITY_RISES, PLANTS }
