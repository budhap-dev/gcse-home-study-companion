import { clearOfHalf, fixed, roundTo, show } from '../format.ts'
import { atMost, cap, figures, near, numeric, prose, tex } from '../physics/build.ts'
import { dpTolerance } from '../physics/format.ts'
import { pick, type Rng } from '../random.ts'
import type { Generator } from '../types.ts'
import { an, byFirst, clean, clearOf, distinct, evenly, hundredths, places, powerOfTen, range, shiftFree, tenfold, threeFigures, toPlaces } from './build.ts'

/**
 * Using resources (AQA 8462, 4.10): carats, the copper in an ore or in phytomining ash, the
 * mass a nail gains as it rusts, the zinc on galvanised steel, and the comparative life cycle
 * assessments of shopping bags and recycling. Left written, because each is a fact to recall
 * with nothing to vary: the gold in 24 carat gold (alloys q2, 100%: "24 carat is pure gold" is
 * the point) and the oxygen in the air (development-of-the-atmosphere q1, about 20%).
 *
 * Every figure is one the thing really has: carats are the hallmarks and standards in use
 * (9, 14, 18 and 22 in the UK; 10, 15, 20 and 21 elsewhere or formerly); a copper ore mined
 * today is 0.4 to 2.5% copper and a spoil heap less; galvanised coatings carry 0.03 to 0.9 kg
 * of zinc per m² by process; recycling saves the share of energy usually quoted for each
 * material (aluminium about 95%, copper about 85%, steel 60 to 75%, paper 35 to 65%, glass 20 to
 * 35%); a paper bag takes a few times a thin plastic bag's energy and a cotton bag over fifty.
 */


// ---------------------------------------------------------------------------------------------
// alloys-ceramics-polymers-and-composites q5, q9, q15: carats
// ---------------------------------------------------------------------------------------------

const ALLOYS = 'alloys-ceramics-polymers-and-composites'

/**
 * Carats in use: 9, 14, 18 and 22 are UK hallmarks, 10 the lowest sold as gold in the US, 15 a
 * former UK standard, 20 and 21 common in Asia and the Middle East. 12 carat (50%) is left out:
 * half is no calculation. 24 carat is the written q2, left as written.
 */
const CARATS = [9, 10, 14, 15, 18, 20, 21, 22]
/** For masses of gold, the UK hallmarks only. */
const HALLMARKS = [9, 14, 18, 22]
/** Per cent gold, when it ends: 37.5 for 9 carat, 75 for 18. */
const ends = (c: number) => atMost((c / 24) * 100, 1)
const percent = (c: number) => clean((c / 24) * 100)

interface Item {
  name: string
  /** Masses in grams, to 0.1 g. */
  mass: [number, number]
}
const ITEMS: Item[] = [
  { name: 'ring', mass: [2, 12] },
  { name: 'chain', mass: [4, 30] },
  { name: 'bracelet', mass: [8, 40] },
  { name: 'pendant', mass: [1.5, 8] },
]
const JEWELLERY = ['ring', 'chain', 'bracelet', 'necklace', 'pendant', 'brooch', 'watch case', 'earring']

const PERCENT_CONTEXTS: { name: string; prompts: ((c: number, item: string) => string)[] }[] = [
  {
    name: 'gold',
    prompts: [(c) => `What percentage of ${c} carat gold is gold?`, (c) => `${c} carat gold is an alloy of gold with other metals. What percentage of it is gold?`],
  },
  {
    name: 'item',
    prompts: [
      (c, item) => `${cap(an(item))} ${item} is made of ${c} carat gold. What percentage of its mass is gold?`,
      (c, item) => `What percentage of the mass of ${an(item)} ${item} made of ${c} carat gold is gold?`,
    ],
  },
  {
    name: 'stamp',
    prompts: [(c, item) => `A gold ${item} is stamped ${c}ct, meaning ${c} carat. What percentage of the ${item} is gold?`],
  },
]

export const caratPercentage: Generator = {
  id: 'carat-percentage',
  subjectId: 'chemistry',
  topicId: ALLOYS,
  replaces: ['q5'],
  build(r, slot, turn) {
    const ctx = PERCENT_CONTEXTS[turn % PERCENT_CONTEXTS.length]!
    const c = pick(r, CARATS)
    const raw = percent(c)
    const answer = roundTo(raw, 1)
    const exact = ends(c)
    const prompt = `${pick(r, ctx.prompts)(c, pick(r, JEWELLERY))}${exact ? '' : ' Give your answer to one decimal place.'}`
    const solution = exact
      ? `$\\dfrac{${c}}{24} \\times 100 = $ **${show(answer)}%**.`
      : `$\\dfrac{${c}}{24} \\times 100 \\approx ${fixed(raw, 2)}$, so **${show(answer)}%** to one decimal place.`
    return numeric(
      slot,
      { prompt, solution, method: [`divides ${c} by 24`], answer, tolerance: toPlaces(answer, places(answer)) },
      // Second route: the share of the alloy that is not gold, taken from 100.
      { agrees: near(roundTo(100 - ((24 - c) / 24) * 100, 1), answer) && clearOfHalf(raw, 1), detail: `100 - ${24 - c}/24 = ${show(100 - ((24 - c) / 24) * 100)}` },
      { context: ctx.name, c },
    )
  },
}

interface Piece {
  m: number
  c: number
  gold: number
  others: number
}
/**
 * Every mass of an item and hallmark whose gold and other metals both end within two decimal
 * places and three figures, neither of them a given nor one with the point moved, doubled or
 * halved, nor each other.
 */
const pieces = (item: Item): Piece[] =>
  HALLMARKS.flatMap((c) =>
    range(item.mass[0], item.mass[1], 0.1)
      .map((m) => ({ m, c, gold: clean((m * c) / 24), others: clean((m * (24 - c)) / 24) }))
      .filter(
        (x) =>
          [x.gold, x.others].every((v) => places(v) <= 2 && figures(v) <= 3 && clearOf(v, x.m, x.c)) && !powerOfTen(x.m) && distinct(x.gold, x.others),
      ),
  )

/** "18/24 = 75 per cent gold", or the fraction alone when the per cent does not end. */
const shareLine = (c: number, of: string) => (ends(c) ? `${c}/24 = ${show(percent(c))} per cent ${of}` : `${c}/24 of the mass is ${of}`)

const GOLD_PROMPTS = [
  (item: string, m: string, c: number) => `${cap(an(item))} ${item} has a mass of ${m} g and is ${c} carat gold. What mass of gold, in grams, does it contain?`,
  (item: string, m: string, c: number) => `${cap(an(item))} ${item} made of ${c} carat gold has a mass of ${m} g. What mass of gold, in grams, is in the ${item}?`,
]
const OTHER_PROMPTS = [
  (item: string, m: string, c: number) => `${cap(an(item))} ${item} has a mass of ${m} g and is ${c} carat gold. What mass of metals other than gold, in grams, does it contain?`,
  (item: string, m: string, c: number) =>
    `${cap(an(item))} ${item} made of ${c} carat gold has a mass of ${m} g. The rest of the alloy is other metals, such as silver and copper. What mass of these other metals, in grams, does it contain?`,
]

export const caratGoldMass: Generator = {
  id: 'carat-gold-mass',
  subjectId: 'chemistry',
  topicId: ALLOYS,
  replaces: ['q9'],
  build(r, slot, turn) {
    const item = ITEMS[turn % ITEMS.length]!
    // The carat first, then the answer: 18 carat gives the most masses that end, and filled half the builds.
    const x = byFirst(r, `carat-gold-mass:${item.name}`, () => pieces(item), (y) => y.c, (y) => y.gold)
    const m = fixed(x.m, 1)
    const solution = ends(x.c)
      ? `${x.c} carat is $\\dfrac{${x.c}}{24} = ${show(percent(x.c))}\\%$ gold, so $${show(percent(x.c) / 100)} \\times ${m} = $ **${show(x.gold)} g**.`
      : `${x.c} carat is $\\dfrac{${x.c}}{24}$ gold, so $\\dfrac{${x.c}}{24} \\times ${m} = $ **${show(x.gold)} g**.`
    return numeric(
      slot,
      {
        prompt: pick(r, GOLD_PROMPTS)(item.name, m, x.c),
        solution,
        method: [shareLine(x.c, 'gold')],
        answer: x.gold,
        tolerance: threeFigures(dpTolerance(x.gold), x.gold),
      },
      // Second route: the whole less the other metals.
      { agrees: near(clean(x.m - x.m * ((24 - x.c) / 24)), x.gold), detail: `${m} - ${show(x.others)} = ${show(x.m - x.others)}` },
      { context: item.name, m: x.m, c: x.c },
    )
  },
}

export const caratOtherMetals: Generator = {
  id: 'carat-other-metals',
  subjectId: 'chemistry',
  topicId: ALLOYS,
  replaces: ['q15'],
  build(r, slot, turn) {
    const item = ITEMS[turn % ITEMS.length]!
    const x = byFirst(r, `carat-other-metals:${item.name}`, () => pieces(item), (y) => y.c, (y) => y.others)
    const m = fixed(x.m, 1)
    const rest = 24 - x.c
    const solution = ends(x.c)
      ? `${x.c} carat is $${show(percent(x.c))}\\%$ gold, so $${show(100 - percent(x.c))}\\%$ is other metals: $${show((100 - percent(x.c)) / 100)} \\times ${m} = $ **${show(x.others)} g**.`
      : `${x.c} carat is $\\dfrac{${x.c}}{24}$ gold, so $\\dfrac{${rest}}{24}$ is other metals: $\\dfrac{${rest}}{24} \\times ${m} = $ **${show(x.others)} g**.`
    const second = ends(x.c) ? `${show(100 - percent(x.c))} per cent is other metals` : `${rest}/24 of the mass is other metals`
    return numeric(
      slot,
      {
        prompt: pick(r, OTHER_PROMPTS)(item.name, m, x.c),
        solution,
        method: [shareLine(x.c, 'gold'), second],
        answer: x.others,
        tolerance: threeFigures(dpTolerance(x.others), x.others),
      },
      // Second route: the whole less the gold.
      { agrees: near(clean(x.m - (x.m * x.c) / 24), x.others), detail: `${m} - ${show(x.gold)} = ${show(x.m - x.gold)}` },
      { context: item.name, m: x.m, c: x.c },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// alternative-extraction-of-metals q3, q10, q17: copper in ore and ash
// ---------------------------------------------------------------------------------------------

const EXTRACTION = 'alternative-extraction-of-metals'

interface Ore {
  name: string
  /** "copper ore", "waste rock from an old copper mine": the noun, without an article. */
  noun: string
  /** Per cent copper, as a range and its step. */
  grade: [number, number, number]
}
/** Copper ores mined today are about 0.4 to 2.5% copper; the low-grade ores the specification means, and the waste heaps, less. */
const ORE_GRADES: Ore[] = [
  { name: 'ore', noun: 'copper ore', grade: [0.4, 2.5, 0.1] },
  { name: 'low-grade ore', noun: 'low-grade copper ore', grade: [0.15, 0.95, 0.05] },
  { name: 'waste rock', noun: 'waste rock from an old copper mine', grade: [0.1, 0.4, 0.02] },
]
const PER_TONNE = [
  (o: Ore, p: string) => `How many kg of copper are in one tonne (1000 kg) of ${o.noun} containing ${p}% copper?`,
  (o: Ore, p: string) => `${cap(o.noun)} contains ${p}% copper by mass. What mass of copper, in kg, is in one tonne (1000 kg) of it?`,
  (o: Ore, p: string) => `What mass of copper, in kg, is in one tonne (1000 kg) of ${o.noun} that is ${p}% copper by mass?`,
]

/**
 * One tonne is the written slot's design, so the answer is always the per cent with the point
 * moved one place: that is the lesson (a 2% ore gives 20 kg a tonne), not a coincidence to
 * filter. A grade of 1% (10 kg) and 0.1% would make it a power of ten, and are left out.
 */
export const copperPerTonne: Generator = {
  id: 'copper-per-tonne-of-ore',
  subjectId: 'chemistry',
  topicId: EXTRACTION,
  replaces: ['q3'],
  build(r, slot, turn) {
    const o = ORE_GRADES[turn % ORE_GRADES.length]!
    const p = pick(r, range(...o.grade).filter((g) => !powerOfTen(g)))
    const answer = clean(p * 10)
    return numeric(
      slot,
      {
        prompt: pick(r, PER_TONNE)(o, show(p)),
        solution: `$\\dfrac{${show(p)}}{100} \\times 1000 = $ **${show(answer)} kg**.`,
        method: [],
        answer,
        tolerance: dpTolerance(answer),
      },
      { agrees: near(clean((answer / 1000) * 100), p), detail: `${show(answer)} ÷ 1000 × 100 = ${show(p)}%` },
      { context: o.name, p },
    )
  },
}

interface Load {
  name: string
  prompts: ((t: number, p: string) => string)[]
  /** Tonnes, as a range and its step. */
  tonnes: [number, number, number]
  grade: [number, number, number]
}
const TONNE = '(1 tonne = 1000 kg)'
/** A lorry carries 15 to 30 tonnes, a mine's haul truck 100 to 300; a spoil heap holds thousands of tonnes of poorer rock. */
const LOADS: Load[] = [
  {
    name: 'lorry',
    tonnes: [15, 30, 1],
    grade: [0.4, 2, 0.1],
    prompts: [
      (t, p) => `A lorry carries ${t} tonnes of copper ore containing ${p}% copper. What mass of copper, in kg, does the load contain? ${TONNE}`,
      (t, p) => `A load of ${t} tonnes of ore contains ${p}% copper. What mass of copper, in kg, does it contain? ${TONNE}`,
    ],
  },
  {
    name: 'haul truck',
    tonnes: [110, 300, 10],
    grade: [0.3, 1.2, 0.1],
    prompts: [
      (t, p) => `A haul truck at a copper mine carries ${t} tonnes of ore that is ${p}% copper. What mass of copper, in kg, is in the load? ${TONNE}`,
      (t, p) => `One truckload of ore from an open-pit copper mine is ${t} tonnes, and the ore is ${p}% copper. What mass of copper, in kg, is in the truckload? ${TONNE}`,
    ],
  },
  {
    name: 'spoil heap',
    tonnes: [500, 5000, 100],
    grade: [0.1, 0.4, 0.05],
    prompts: [
      (t, p) => `A heap of ${prose(t)} tonnes of waste rock from an old copper mine contains ${p}% copper. What mass of copper, in kg, does it contain? ${TONNE}`,
      (t, p) => `Bioleaching is tried on a spoil heap of ${prose(t)} tonnes of rock containing ${p}% copper. What mass of copper, in kg, does the heap contain? ${TONNE}`,
    ],
  },
]
interface Loaded {
  t: number
  p: number
  answer: number
}
/**
 * Every load and grade whose copper is under 10 000 kg and of three figures at most, and is none
 * of the givens, nor one of them doubled or halved, with or without the point moved; nor 1000 kg,
 * the printed conversion, or a power of ten (250 t at 0.4% is 1000 kg).
 */
const loads = (l: Load): Loaded[] =>
  range(...l.tonnes).flatMap((t) =>
    range(...l.grade)
      .map((p) => ({ t, p, answer: clean(t * 10 * p) }))
      .filter(({ t, p, answer }) => !powerOfTen(t) && !powerOfTen(p) && answer < 10000 && figures(answer) <= 3 && places(answer) <= 1 && clearOf(answer, t, p, 1000) && shiftFree(answer, t, p)),
  )

export const copperInALoad: Generator = {
  id: 'copper-in-a-load-of-ore',
  subjectId: 'chemistry',
  topicId: EXTRACTION,
  replaces: ['q10'],
  build(r, slot, turn) {
    const l = LOADS[turn % LOADS.length]!
    const x = evenly(r, `copper-in-a-load-of-ore:${l.name}`, () => loads(l), (y) => y.answer)
    const kg = x.t * 1000
    return numeric(
      slot,
      {
        prompt: pick(r, l.prompts)(x.t, show(x.p)),
        solution: `$${tex(x.t)}\\text{ tonnes} = ${tex(kg)}\\text{ kg}$; $\\dfrac{${show(x.p)}}{100} \\times ${tex(kg)} = $ **${show(x.answer)} kg**.`,
        method: [`converts to ${prose(kg)} kg`],
        answer: x.answer,
        tolerance: threeFigures(dpTolerance(x.answer), x.answer),
      },
      // Second route: the copper in one tonne, times the tonnes.
      { agrees: near(clean(x.p * 10 * x.t), x.answer), detail: `${show(x.p * 10)} kg a tonne × ${x.t}` },
      { context: l.name, t: x.t, p: x.p },
    )
  },
}

interface Ash {
  name: string
  metal: string
  /** Per cent of the metal in the ash. */
  grade: [number, number, number]
  prompts: ((p: string, m: number) => string)[]
  /** What the ash is richer than. */
  richer: string
}
/**
 * Ash from plants grown for copper is a few per cent copper (the written slot's 8%); plants that
 * take up nickel (hyperaccumulators such as Alyssum, grown in field trials) leave ash of 10 to
 * 20% nickel. 10% is left out: the answer would be the ash's mass with the point moved.
 */
const ASHES: Ash[] = [
  {
    name: 'copper',
    metal: 'copper',
    grade: [5, 9.5, 0.5],
    prompts: [
      (p, m) => `Phytomining ash contains ${p}% copper by mass. What mass of copper, in kg, is in ${m} kg of ash?`,
      (p, m) => `Plants grown on a copper mine's spoil heap are harvested and burned. The ash is ${p}% copper by mass. What mass of copper, in kg, is in ${m} kg of the ash?`,
    ],
    richer: 'far richer than the ore the plants grew on',
  },
  {
    name: 'nickel',
    metal: 'nickel',
    grade: [10.5, 20, 0.5],
    prompts: [
      (p, m) => `Plants that take up nickel are grown on nickel-rich soil, harvested and burned. The ash is ${p}% nickel by mass. What mass of nickel, in kg, is in ${m} kg of the ash?`,
      (p, m) => `Phytomining ash from nickel-gathering plants contains ${p}% nickel by mass. What mass of nickel, in kg, is in ${m} kg of the ash?`,
    ],
    richer: 'far richer than the soil the plants grew in',
  },
]
interface Burned {
  p: number
  m: number
  answer: number
}
const ASH_MASSES = range(40, 900, 10).filter((m) => !powerOfTen(m))
/** Every grade and mass of ash whose metal ends within two places and three figures, clear of both givens as loads are. */
const burned = (a: Ash): Burned[] =>
  range(...a.grade)
    .filter((p) => !powerOfTen(p))
    .flatMap((p) => ASH_MASSES.map((m) => ({ p, m, answer: clean((p * m) / 100) })))
    .filter(({ p, m, answer }) => places(answer) <= 2 && figures(answer) <= 3 && clearOf(answer, p, m) && shiftFree(answer, p, m) && distinct(p, m))

export const metalInAsh: Generator = {
  id: 'metal-in-phytomining-ash',
  subjectId: 'chemistry',
  topicId: EXTRACTION,
  replaces: ['q17'],
  build(r, slot, turn) {
    const a = ASHES[turn % ASHES.length]!
    const x = evenly(r, `metal-in-phytomining-ash:${a.name}`, () => burned(a), (y) => y.answer)
    return numeric(
      slot,
      {
        prompt: pick(r, a.prompts)(show(x.p), x.m),
        solution: `$\\dfrac{${show(x.p)}}{100} \\times ${x.m} = $ **${show(x.answer)} kg** — ${a.richer}.`,
        method: [`takes ${show(x.p)}% of ${x.m}`],
        answer: x.answer,
        tolerance: threeFigures(dpTolerance(x.answer), x.answer),
      },
      { agrees: near(clean((x.answer / x.m) * 100), x.p), detail: `${show(x.answer)} ÷ ${x.m} × 100 = ${show((x.answer / x.m) * 100)}%` },
      { context: a.name, p: x.p, m: x.m },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// corrosion-and-its-prevention q7, q17: mass gained by rusting, zinc on galvanised steel
// ---------------------------------------------------------------------------------------------

const CORROSION = 'corrosion-and-its-prevention'

interface Rusting {
  name: string
  /** Mass before, grams, to 0.01 g: a 2.5 to 7.5 cm iron nail, or a pad of steel wool. */
  before: [number, number]
  /** Mass gained, grams. */
  gain: [number, number]
  /** Largest gain as a share of the mass: a week's rust on a nail is a few per cent, steel wool rusts through faster. */
  most: number
  prompts: ((b: string, a: string) => string)[]
}
const RUSTING: Rusting[] = [
  {
    name: 'nail in water',
    before: [2, 7],
    gain: [0.05, 0.3],
    most: 0.1,
    prompts: [
      (b, a) => `A nail weighs ${b} g before rusting and ${a} g after. What is the increase in mass, in grams?`,
      (b, a) => `An iron nail weighs ${b} g. It is left in a test tube of tap water, open to the air, for a week, then dried and weighed again: ${a} g. What is the increase in mass, in grams?`,
    ],
  },
  {
    name: 'nail in salt water',
    before: [2, 7],
    gain: [0.1, 0.45],
    most: 0.12,
    prompts: [
      (b, a) => `An iron nail weighs ${b} g. After a week in salty water open to the air, it is dried and weighs ${a} g. What is the increase in mass, in grams?`,
      (b, a) => `A student leaves an iron nail of mass ${b} g in salt water, open to the air. A week later the dried, rusted nail weighs ${a} g. What is the increase in mass, in grams?`,
    ],
  },
  {
    name: 'steel wool',
    before: [1, 3],
    gain: [0.05, 0.35],
    most: 0.15,
    prompts: [
      (b, a) => `A pad of steel wool weighs ${b} g. It is dampened and left in air for a few days, then dried and weighed again: ${a} g. What is the increase in mass, in grams?`,
      (b, a) => `Damp steel wool rusts quickly. A pad weighing ${b} g is left in air for three days, then dried; it now weighs ${a} g. What is the increase in mass, in grams?`,
    ],
  },
]

export const rustMassGain: Generator = {
  id: 'rusting-mass-gain',
  subjectId: 'chemistry',
  topicId: CORROSION,
  replaces: ['q7'],
  build(r, slot, turn) {
    const c = RUSTING[turn % RUSTING.length]!
    const gain = pick(r, range(c.gain[0], c.gain[1], 0.01).filter((g) => !powerOfTen(g)))
    // The nail's hundredths are not the gain's, so the answer is not read off its last digits.
    const before = pick(
      r,
      range(c.before[0], c.before[1], 0.01).filter((b) => gain <= b * c.most && hundredths(b) !== 0 && hundredths(b) !== hundredths(gain) && clearOf(gain, b)),
    )
    const after = clean(before + gain)
    const [b, a] = [fixed(before, 2), fixed(after, 2)]
    return numeric(
      slot,
      {
        prompt: pick(r, c.prompts)(b, a),
        solution: `$${a} - ${b} = $ **${fixed(gain, 2)} g**. The iron has combined with oxygen and water from the air to form rust, so the mass goes up.`,
        method: [],
        answer: gain,
        tolerance: toPlaces(gain, 2),
      },
      { agrees: Math.round(after * 100) - Math.round(before * 100) === Math.round(gain * 100), detail: `${b} + ${fixed(gain, 2)} = ${a}` },
      { context: c.name, before, gain },
    )
  },
}

interface Coating {
  name: string
  /** kg of zinc per m², range and step. */
  rate: [number, number, number]
  /** m² of surface, range and step. */
  area: [number, number, number]
  prompts: ((r: string, a: number) => string)[]
}
/**
 * Coating masses by process: galvanised roofing sheet (Z100 to Z275, both sides) 0.1 to 0.3
 * kg/m², hot-dip galvanised structural steel 0.4 to 0.9, electro-galvanised car body steel 0.03
 * to 0.09 (the written slot's 0.05).
 */
const COATINGS: Coating[] = [
  {
    name: 'roof',
    rate: [0.11, 0.3, 0.01],
    area: [20, 200, 5],
    prompts: [
      (k, a) => `A galvanised steel sheet holds ${k} kg of zinc per m². A barn roof made from it has ${a} m² of surface. What mass of zinc, in kg, does the roof carry?`,
      (k, a) => `Galvanised roofing sheet carries ${k} kg of zinc per m² of surface. What mass of zinc, in kg, is on ${a} m² of it?`,
    ],
  },
  {
    name: 'footbridge',
    rate: [0.4, 0.9, 0.05],
    area: [40, 400, 10],
    prompts: [
      (k, a) => `Hot-dip galvanising coats the steel of a footbridge with ${k} kg of zinc per m². The bridge has ${a} m² of steel surface. What mass of zinc, in kg, does it carry?`,
      (k, a) => `A galvanised steel structure holds ${k} kg of zinc per m². It has ${a} m² of surface. What mass of zinc, in kg, does it carry?`,
    ],
  },
  {
    name: 'car body',
    rate: [0.03, 0.09, 0.005],
    area: [20, 60, 1],
    prompts: [
      (k, a) => `Galvanised steel for car bodies holds ${k} kg of zinc per m². One car body has ${a} m² of steel surface. What mass of zinc, in kg, does it carry?`,
      (k, a) => `A galvanised sheet holds ${k} kg of zinc per m². A structure has ${a} m² of surface. What mass of zinc, in kg, does it carry?`,
    ],
  },
]
interface Coated {
  k: number
  a: number
  answer: number
}
/** Every coating and area whose zinc ends within two places and three figures, clear of both givens as loads are. */
const coated = (c: Coating): Coated[] =>
  range(...c.rate).flatMap((k) =>
    range(...c.area)
      .map((a) => ({ k, a, answer: clean(k * a) }))
      .filter(({ k, a, answer }) => !powerOfTen(k) && !powerOfTen(a) && places(answer) <= 2 && figures(answer) <= 3 && clearOf(answer, k, a) && shiftFree(answer, k, a) && !near(k + a, answer) && distinct(k, a)),
  )

export const zincOnGalvanisedSteel: Generator = {
  id: 'zinc-on-galvanised-steel',
  subjectId: 'chemistry',
  topicId: CORROSION,
  replaces: ['q17'],
  build(r, slot, turn) {
    const c = COATINGS[turn % COATINGS.length]!
    const x = evenly(r, `zinc-on-galvanised-steel:${c.name}`, () => coated(c), (y) => y.answer)
    return numeric(
      slot,
      {
        prompt: pick(r, c.prompts)(show(x.k), x.a),
        solution: `$${show(x.k)} \\times ${x.a} = $ **${show(x.answer)} kg** of zinc, which corrodes in place of the iron wherever the steel is exposed.`,
        method: [`multiplies ${show(x.k)} by ${x.a}`],
        answer: x.answer,
        tolerance: threeFigures(dpTolerance(x.answer), x.answer),
      },
      { agrees: near(clean(x.answer / x.a), x.k), detail: `${show(x.answer)} ÷ ${x.a} = ${show(x.answer / x.a)} kg/m²` },
      { context: c.name, k: x.k, a: x.a },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// life-cycle-assessment-and-recycling q8, q12, q17
// ---------------------------------------------------------------------------------------------

const LCA = 'life-cycle-assessment-and-recycling'

interface Bag {
  name: string
  /** As a prompt names it first, and after "the". */
  full: string
  short: string
  /** How many plastic bags' worth of energy it takes, by integer, as LCAs find. */
  times: [number, number]
}
/**
 * Uses needed to match a thin plastic bag (the Environment Agency's 2011 study found about 3
 * for paper, 4 for a thick plastic bag-for-life and 131 for cotton, by carbon): paper 2 to 8,
 * bag-for-life 3 to 9, cotton 50 to 200.
 */
const BAGS: Bag[] = [
  { name: 'paper', full: 'paper bag', short: 'paper bag', times: [2, 8] },
  { name: 'bag-for-life', full: 'bag-for-life made of thick plastic', short: 'bag-for-life', times: [3, 9] },
  { name: 'cotton', full: 'cotton bag', short: 'cotton bag', times: [50, 200] },
]
/**
 * A thin plastic bag's energy, in the written slot's units: 0.4 to 1.2. 0.5 is left out (dividing
 * by it doubles), 1, and 1.1 (3.3 ÷ 1.1 = 3 reads off the heavy bag's figure).
 */
const THIN = range(0.4, 1.2, 0.1).filter((e) => !near(e, 0.5) && !near(e, 1) && !near(e, 1.1))
interface Matched {
  heavy: number
  light: number
  answer: number
}
const matched = (b: Bag): Matched[] =>
  range(b.times[0], b.times[1])
    .filter((n) => !powerOfTen(n))
    .flatMap((answer) => THIN.map((light) => ({ answer, light, heavy: clean(answer * light) })))
    // The answer is never the heavy bag's whole-number part: 4.8 ÷ 1.2 = 4 would read off the given.
    .filter(({ answer, light, heavy }) => clearOf(answer, heavy, light) && distinct(heavy, light) && Math.floor(heavy) !== answer)

const MATCH_PROMPTS = [
  (b: Bag, h: string, l: string) =>
    `${cap(an(b.full))} ${b.full} takes ${h} units of energy to make and a plastic bag ${l} units. How many times must the ${b.short} be used for its energy per use to match a plastic bag used once?`,
  (b: Bag, h: string, l: string) =>
    `Making ${an(b.full)} ${b.full} uses ${h} units of energy; making a thin plastic bag uses ${l} units. How many times must the ${b.short} be used before its energy per use falls to that of a plastic bag used once?`,
]

export const bagUsesToMatch: Generator = {
  id: 'lca-bag-uses-to-match',
  subjectId: 'chemistry',
  topicId: LCA,
  replaces: ['q8'],
  build(r, slot, turn) {
    const b = BAGS[turn % BAGS.length]!
    const x = evenly(r, `lca-bag-uses-to-match:${b.name}`, () => matched(b), (y) => y.answer)
    const [h, l] = [fixed(x.heavy, 1), fixed(x.light, 1)]
    return numeric(
      slot,
      {
        prompt: pick(r, MATCH_PROMPTS)(b, h, l),
        solution: `$\\dfrac{${h}}{${l}} = $ **${x.answer} times**. The ${b.short} is the one that has to be reused to catch up; the plastic bag is already lower on its first use.`,
        method: [`divides ${h} by ${l}`],
        answer: x.answer,
      },
      { agrees: near(clean(x.answer * x.light), x.heavy), detail: `${x.answer} × ${l} = ${h}` },
      { context: b.name, light: x.light, heavy: x.heavy },
    )
  },
}

interface Material {
  name: string
  /** Percentage of energy recycling saves: range, step 0.5. */
  saving: [number, number]
  prompts: ((e: number, r: number) => string)[]
}
const MATERIALS: Material[] = [
  {
    name: 'aluminium',
    saving: [92, 97],
    prompts: [
      (e, r) => `Extracting aluminium from ore uses ${e} units of energy per kg; recycling it uses ${r} units. What percentage of the energy is saved by recycling?`,
      (e, r) => `Recycling aluminium uses ${r} units of energy per kg, compared with ${e} units to extract it from its ore by electrolysis. What percentage of the energy is saved by recycling?`,
    ],
  },
  {
    name: 'copper',
    saving: [80, 90],
    prompts: [
      (e, r) => `Extracting copper from its ore uses ${e} units of energy per kg; recycling scrap copper uses ${r} units. What percentage of the energy is saved by recycling?`,
      (e, r) => `Recycling copper uses ${r} units of energy per kg, compared with ${e} units to extract it from ore. What percentage of the energy is saved by recycling?`,
    ],
  },
  {
    name: 'steel',
    saving: [60, 75],
    prompts: [
      (e, r) => `Making steel from iron ore uses ${e} units of energy per kg; making it from scrap steel uses ${r} units. What percentage of the energy is saved by recycling?`,
      (e, r) => `Recycling steel uses ${r} units of energy per kg, compared with ${e} units to make it from iron ore. What percentage of the energy is saved by recycling?`,
    ],
  },
  {
    name: 'paper',
    saving: [35, 65],
    prompts: [
      (e, r) => `Making paper from wood pulp uses ${e} units of energy per kg; making it from waste paper uses ${r} units. What percentage of the energy is saved by recycling?`,
      (e, r) => `Recycling paper uses ${r} units of energy per kg, compared with ${e} units to make it from wood. What percentage of the energy is saved by recycling?`,
    ],
  },
  {
    name: 'glass',
    saving: [20, 35],
    prompts: [
      (e, r) => `Making glass bottles from sand, limestone and sodium carbonate uses ${e} units of energy per kg; making them from crushed recycled glass uses ${r} units. What percentage of the energy is saved by recycling?`,
      (e, r) => `Making new glass from raw materials uses ${e} units of energy per kg; melting down recycled glass uses ${r} units. What percentage of the energy is saved by recycling?`,
    ],
  },
]
interface Saved {
  e: number
  r: number
  answer: number
}
/**
 * Whole energies from 20 to 400 units (100, and so every power of ten, left out: with 100 the
 * per cent saved is the units saved), whose saving is a whole or half per cent in the
 * material's range (a saving such as 95.2% needs an energy of 125, 250 or 375, which then fills
 * the context), clear of both energies and of the units saved. A saving of 50% is left out:
 * half is no calculation.
 */
const saved = (m: Material): Saved[] =>
  range(20, 400)
    .filter((e) => !powerOfTen(e))
    .flatMap((e) => range(2, e - 1).map((r) => ({ e, r, answer: clean(((e - r) / e) * 100) })))
    .filter(({ e, r, answer }) => answer >= m.saving[0] && answer <= m.saving[1] && atMost(answer * 2, 0) && figures(answer) <= 3 && answer !== 50 && clearOf(answer, e, r) && !tenfold(answer, e - r) && distinct(e, r))

export const recyclingEnergySaved: Generator = {
  id: 'recycling-energy-saved',
  subjectId: 'chemistry',
  topicId: LCA,
  replaces: ['q12'],
  build(r, slot, turn) {
    const m = MATERIALS[turn % MATERIALS.length]!
    // The saving first, evenly, then an energy that gives it, evenly: drawing the energy first let
    // the savings that end most often (37.5, 50, 62.5) fill over half the paper builds.
    const x = byFirst(r, `recycling-energy-saved:${m.name}`, () => saved(m), (y) => y.answer, (y) => y.e)
    return numeric(
      slot,
      {
        prompt: pick(r, m.prompts)(x.e, x.r),
        solution: `$\\dfrac{${x.e} - ${x.r}}{${x.e}} \\times 100 = $ **${show(x.answer)}%**.`,
        method: [`finds the saving of ${x.e - x.r} units`],
        answer: x.answer,
        tolerance: threeFigures(dpTolerance(x.answer), x.answer),
      },
      // Second route: 100 less the per cent recycling still uses.
      { agrees: near(clean(100 - (x.r / x.e) * 100), x.answer), detail: `100 - ${show((x.r / x.e) * 100)} = ${show(100 - (x.r / x.e) * 100)}` },
      { context: m.name, e: x.e, r: x.r },
    )
  },
}

interface Reuse {
  name: string
  item: string
  short: string
  other: string
  /** The reused bag's energy, its uses, and the other bag's energy for one use: range and step. */
  energy: [number, number, number]
  uses: [number, number, number]
  single: [number, number, number]
}
const REUSES: Reuse[] = [
  { name: 'plastic', item: 'plastic bag', short: 'plastic bag', other: 'paper bag', energy: [0.3, 1.6, 0.1], uses: [2, 12, 1], single: [2, 4, 0.1] },
  { name: 'bag-for-life', item: 'bag-for-life', short: 'bag-for-life', other: 'thin plastic bag', energy: [2, 6, 0.1], uses: [8, 40, 1], single: [0.4, 1, 0.1] },
  { name: 'cotton', item: 'cotton bag', short: 'cotton bag', other: 'thin plastic bag', energy: [40, 90, 1], uses: [50, 300, 5], single: [0.4, 1, 0.1] },
]
interface PerUse {
  e: number
  n: number
  raw: number
  answer: number
}
/**
 * Every energy and number of uses whose energy per use, to two decimal places, is 0.1 or more,
 * ends in a figure the answer box keeps (0.13, not 0.10), is clear of a half in the third place,
 * and is clear of the energy and the uses.
 */
const perUse = (x: Reuse): PerUse[] =>
  range(...x.energy)
    .filter((e) => !powerOfTen(e))
    .flatMap((e) => range(...x.uses).filter((n) => !powerOfTen(n)).map((n) => ({ e, n, raw: e / n, answer: roundTo(e / n, 2) })))
    .filter(({ e, n, raw, answer }) => answer >= 0.1 && hundredths(answer) % 10 !== 0 && clearOfHalf(raw, 2) && clearOf(answer, e, n) && shiftFree(answer, e, n) && distinct(e, n))

const PER_USE_PROMPTS = [
  (x: Reuse, e: string, o: string, n: number) =>
    `${cap(an(x.item))} ${x.item} uses ${e} units of energy and ${an(x.other)} ${x.other} ${o} units. If the ${x.short} is used ${n} times, what is its energy per use, in units, to two decimal places?`,
  (x: Reuse, e: string, o: string, n: number) =>
    `Making ${an(x.item)} ${x.item} uses ${e} units of energy; making ${an(x.other)} ${x.other} uses ${o} units. The ${x.short} is used ${n} times. What is its energy per use, in units, to two decimal places?`,
]

export const energyPerUse: Generator = {
  id: 'lca-energy-per-use',
  subjectId: 'chemistry',
  topicId: LCA,
  replaces: ['q17'],
  build(r, slot, turn) {
    const x = REUSES[turn % REUSES.length]!
    // The uses first, among those allowing three answers or more, then the answer: drawn by answer
    // alone, 3 and 5 uses each filled about 30% of the plastic bag builds.
    const u = byFirst(r, `lca-energy-per-use:${x.name}`, () => perUse(x), (y) => y.n, (y) => y.answer, 3)
    const o = pickSingle(r, x, u.answer)
    const [e, ot] = [show(u.e), show(o)]
    const exact = atMost(u.raw, 3)
    const below = u.answer < o
    const compare = below ? (u.answer * 2 < o ? 'well below' : 'below') : 'still above'
    return numeric(
      slot,
      {
        prompt: pick(r, PER_USE_PROMPTS)(x, e, ot, u.n),
        solution: `$\\dfrac{${e}}{${u.n}} ${exact ? `= ${show(u.raw)}` : `\\approx ${fixed(u.raw, 3)}`}$, which is **${fixed(u.answer, 2)} units per use** — ${compare} the ${x.other}'s ${ot} units for a single use.`,
        method: [`divides ${e} by ${u.n}`],
        answer: u.answer,
        tolerance: toPlaces(u.answer, 2),
      },
      { agrees: near(roundTo(u.e / u.n, 2), u.answer) && Math.abs(u.answer * u.n - u.e) <= 0.005 * u.n + 1e-9, detail: `${fixed(u.answer, 2)} × ${u.n} ≈ ${e}` },
      { context: x.name, e: u.e, n: u.n, other: o },
    )
  },
}
/** The other bag's single-use energy: never the answer, nor within 0.05 of it, nor the reused bag's energy. */
function pickSingle(r: Rng, x: Reuse, answer: number): number {
  return pick(r, range(...x.single).filter((o) => Math.abs(o - answer) >= 0.05 && !powerOfTen(o) && clearOf(answer, o) && shiftFree(answer, o)))
}

export const materialGenerators: Generator[] = [
  caratPercentage,
  caratGoldMass,
  caratOtherMetals,
  copperPerTonne,
  copperInALoad,
  metalInAsh,
  rustMassGain,
  zincOnGalvanisedSteel,
  bagUsesToMatch,
  recyclingEnergySaved,
  energyPerUse,
]

/** For the tests. */
export const MATERIALS_DATA = { CARATS, HALLMARKS, ITEMS, ORE_GRADES, LOADS, ASHES, RUSTING, COATINGS, BAGS, THIN, MATERIALS, REUSES, pieces, loads, burned, coated, matched, saved, perUse }
