import { fixed, show } from '../format.ts'
import { atMost, cap, closes, figures, near, numeric, prose, tex } from '../physics/build.ts'
import { an, byFirst, clean, distinct, evenly, noOnes, places, powerOfTen, range, shiftFree, tenfold, toPlaces, word } from '../chemistry/build.ts'
import { int, pick } from '../random.ts'
import type { Generator } from '../types.ts'
import { balanced, between, layered, list, memo, rich, unitsOf, whole } from './build.ts'

/**
 * Ecology (AQA 8461, 4.7.2.1 quadrats, 4.7.4.3 decay, 4.7.5.2 to 4.7.5.6 energy transfer and
 * pyramids of biomass) and plant hormones (4.5.4.1 and 4.5.4.2). Every numeric written slot in
 * "Ecosystems and interdependence" and "Material cycles" has a generator here, and so do the two
 * numeric slots of "Plant adaptations, defences and hormones" (ethene ripening and a shoot bending
 * towards light). None is left written.
 *
 * Every figure is one the thing really has. Quadrats are 1 m² or 0.25 m² (50 cm by 50 cm), placed
 * at random in a field, park, meadow or shore of a few hundred to fifteen thousand square metres,
 * and each organism has its own density: dandelions 1.5 to 12 per m², daisies 3 to 25, clover 5 to
 * 30, limpets 5 to 40. Energy passes between trophic levels with an efficiency of about 10%, from 2%
 * (woodland herbivores, foxes) to 20% (zooplankton); a producer releases 40 to 65% of what it
 * captures in respiration. Compost and leaf litter lose 0.2 to 6% of their starting mass a day
 * (leaf litter on a woodland floor slowest, grass cuttings in a warm bin fastest), and rotting
 * fruit 15 to 45% over a few weeks. Ethene ripens 70 to 97.5% of a crate where 10 to 45% ripen in
 * air, and a seedling lit from one side grows 1.4 to 4 times as much on its shaded side.
 */
const ECO = 'ecosystems-and-interdependence'
const CYCLES = 'material-cycles'
const PLANT = 'plant-adaptations-defences-and-hormones'

// =============================================================================================
// Ecosystems and interdependence: quadrats
// =============================================================================================

interface Patch {
  name: string
  /** Plural, as counted: "daisies". */
  organism: string
  /** "on" a field, lawn or shore, "in" a park, pasture or meadow. */
  at: 'in' | 'on'
  /** "on a school field", "on a rocky shore", as a sentence places it: always `at` and the place. */
  place: string
  /** "field", after "the". */
  noun: string
  /** Plants (or limpets) per m², lowest and highest. */
  density: readonly [number, number]
  /** Areas in m² the place really has. */
  areas: number[]
}

/** Each with a density it really grows at, and the area its place really has. */
const PATCHES: Patch[] = [
  { name: 'daisies', organism: 'daisies', at: 'on', place: 'on a school field', noun: 'field', density: [3, 25], areas: range(2000, 9000, 100) },
  { name: 'dandelions', organism: 'dandelions', at: 'in', place: 'in a park', noun: 'park', density: [1.5, 12], areas: range(3000, 15000, 500) },
  { name: 'clover', organism: 'clover plants', at: 'in', place: 'in a pasture', noun: 'pasture', density: [5, 30], areas: range(1000, 6000, 100) },
  { name: 'buttercups', organism: 'buttercups', at: 'in', place: 'in a meadow', noun: 'meadow', density: [4, 25], areas: range(1500, 8000, 100) },
  { name: 'plantains', organism: 'ribwort plantains', at: 'on', place: 'on a playing field', noun: 'playing field', density: [2, 15], areas: range(2000, 10000, 100) },
  { name: 'limpets', organism: 'limpets', at: 'on', place: 'on a rocky shore', noun: 'shore', density: [5, 40], areas: range(300, 2000, 50) },
]

// ---------------------------------------------------------------------------------------------
// q6: a mean per 1 m² quadrat × the area
// ---------------------------------------------------------------------------------------------

interface Mean {
  n: number
  mean: number
  area: number
  answer: number
}
/** In words in the prompt, so never past twenty. */
const MEAN_COUNTS = [10, 12, 15, 20]
/** Means of n whole counts, on the 0.1 grid, in the patch's density. */
const meansFor = (p: Patch, n: number) => range(p.density[0], p.density[1], 0.1).filter((m) => whole(m * n))

const MEAN_PROMPTS = [
  (p: Patch, x: Mean) =>
    `${cap(word(x.n))} 1 m² quadrats placed at random ${p.place} give a mean of ${show(x.mean)} ${p.organism} per quadrat. Estimate the number of ${p.organism} ${p.at} the whole ${p.noun}, which has an area of ${prose(x.area)} m².`,
  (p: Patch, x: Mean) =>
    `A student places ${word(x.n)} 1 m² quadrats at random ${p.place} with an area of ${prose(x.area)} m² and finds a mean of ${show(x.mean)} ${p.organism} per quadrat. Estimate the population of ${p.organism} ${p.at} the ${p.noun}.`,
]

/** Mean per m² × area: written as q6 (a mean of 6 in ten 1 m² quadrats, 2000 m², 12000). */
export const quadratMean: Generator = {
  id: 'quadrat-mean-estimate',
  subjectId: 'biology',
  topicId: ECO,
  replaces: ['q6'],
  build(r, slot, turn) {
    const p = PATCHES[turn % PATCHES.length]!
    const n = pick(r, MEAN_COUNTS)
    // A mean that is not a power of ten and not 2 or 5 with the point moved (the answer would be
    // the area with the point moved, or it doubled or halved); an area that is not one either
    // (7.9 × 5000 is the mean with the point moved); three figures that differ; and an estimate
    // of three figures at most, as an estimate from a few quadrats is printed.
    const fits = (m: number, a: number) => figures(clean(m * a)) <= 3 && shiftFree(clean(m * a), a, n, m) && distinct(m, n, a)
    const means = memo(`quadrat-mean:${p.name}:${n}`, () => meansFor(p, n).filter((m) => noOnes(m) && !powerOfTen(m) && p.areas.some((a) => fits(m, a))))()
    const mean = pick(r, means)
    const area = pick(r, p.areas.filter((a) => fits(mean, a)))
    const answer = clean(mean * area)
    const x = { n, mean, area, answer }
    return numeric(
      slot,
      {
        prompt: pick(r, MEAN_PROMPTS)(p, x),
        solution:
          `Each quadrat is 1 m², so a mean of ${show(mean)} per quadrat is ${show(mean)} per m². Estimated population: ${closes(`${show(mean)} \\times ${tex(area)}`, answer, p.organism)} ` +
          `The number of quadrats, ${n}, does not enter the calculation: more quadrats make the mean more reliable.`,
        method: [`finds the number per square metre, ${show(mean)}`, `multiplies by the area of ${prose(area)} m²`],
        answer,
      },
      // Second route: the estimate shared back over the area gives the mean.
      { agrees: near(answer / area, mean), detail: `${answer} ÷ ${area} = ${mean}` },
      { context: p.name, n, mean, area },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q19: a total over n quadrats of 0.25 m², to a density, × the area
// ---------------------------------------------------------------------------------------------

interface Quarter {
  n: number
  total: number
  mean: number
  density: number
  area: number
  answer: number
}
const QUARTER_COUNTS = [10, 15, 20, 25, 30, 40]
/** Every total of n quadrats whose mean prints exactly, then every area that gives a whole estimate of three figures at most. */
const quarters = (p: Patch): Quarter[] =>
  QUARTER_COUNTS.flatMap((n) =>
    range(Math.ceil((p.density[0] * n) / 4), Math.floor((p.density[1] * n) / 4)).flatMap((total) => {
      const mean = clean(total / n)
      const density = clean(mean * 4)
      if (!atMost(mean, 2) || !noOnes(mean, density) || powerOfTen(density)) return []
      return p.areas
        .map((area) => ({ n, total, mean, density, area, answer: clean(density * area) }))
        .filter((x) => whole(x.answer) && figures(x.answer) <= 3 && shiftFree(x.answer, x.area, x.total, x.n, x.mean, x.density) && distinct(x.n, x.total, x.area) && !tenfold(x.mean, x.area))
    }),
  )

const QUARTER_PROMPTS = [
  (p: Patch, x: Quarter) =>
    `A student places ${x.n} quadrats, each 0.25 m², at random ${p.place} of ${prose(x.area)} m². The total number of ${p.organism} counted in all ${x.n} quadrats is ${x.total}. Estimate the number of ${p.organism} ${p.at} the ${p.noun}.`,
  (p: Patch, x: Quarter) =>
    `${cap(p.organism)} are sampled ${p.place} with an area of ${prose(x.area)} m², using ${x.n} quadrats placed at random. Each quadrat measures 50 cm by 50 cm, an area of 0.25 m². Altogether ${x.total} ${p.organism} are counted. Estimate the total number of ${p.organism} ${p.at} the ${p.noun}.`,
]

/** Mean per quadrat ÷ 0.25 × area: written as q19 (90 buttercups in twenty 0.25 m² quadrats, 1500 m², 27000). */
export const quadratQuarter: Generator = {
  id: 'quadrat-quarter-metre-estimate',
  subjectId: 'biology',
  topicId: ECO,
  replaces: ['q19'],
  build(r, slot, turn) {
    const p = PATCHES[turn % PATCHES.length]!
    // The number of quadrats first, then a total among those it allows, so the counts that divide
    // most cleanly do not fill the context; the area last.
    const pool = memo(`quarter:${p.name}`, () => quarters(p))
    const n = pick(r, QUARTER_COUNTS.filter((k) => pool().some((x) => x.n === k)))
    const total = pick(r, [...new Set(pool().filter((x) => x.n === n).map((x) => x.total))])
    const x = pick(r, pool().filter((y) => y.n === n && y.total === total))
    return numeric(
      slot,
      {
        prompt: pick(r, QUARTER_PROMPTS)(p, x),
        solution:
          `Mean per quadrat $= ${x.total} \\div ${x.n} = ${show(x.mean)}$. Each quadrat is only $0.25$ m², so the density is $${show(x.mean)} \\div 0.25 = ${show(x.density)}$ per m². ` +
          `Estimated population: ${closes(`${show(x.density)} \\times ${tex(x.area)}`, x.answer, p.organism)}`,
        method: [`finds the mean per quadrat, ${show(x.mean)}`, `divides by 0.25 to get ${show(x.density)} per square metre`],
        answer: x.answer,
      },
      // Second route: the area in quadrats, times the mean per quadrat.
      { agrees: near((x.area / 0.25) * (x.total / x.n), x.answer), detail: `${x.area} ÷ 0.25 × ${x.mean}` },
      { context: p.name, n: x.n, total: x.total, area: x.area },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q30: five, eight or ten counts in 1 m² quadrats, to a mean, × the area
// ---------------------------------------------------------------------------------------------

/** The smaller sites q30 samples: a field of a few hundred square metres to a couple of thousand. */
const COUNTED: Patch[] = [
  { name: 'clover', organism: 'clover plants', at: 'in', place: 'in a field', noun: 'field', density: [5, 14], areas: range(150, 2500, 10) },
  { name: 'daisies', organism: 'daisies', at: 'on', place: 'on a lawn', noun: 'lawn', density: [3, 16], areas: range(120, 900, 10) },
  { name: 'dandelions', organism: 'dandelions', at: 'in', place: 'in a park', noun: 'park', density: [1, 9], areas: range(800, 2500, 10) },
  { name: 'buttercups', organism: 'buttercups', at: 'in', place: 'in a meadow', noun: 'meadow', density: [4, 18], areas: range(300, 2500, 10) },
  { name: 'limpets', organism: 'limpets', at: 'on', place: 'on a rocky shore', noun: 'shore', density: [5, 25], areas: range(200, 1500, 10) },
]
/** Never ten, whose mean is the total with the point moved. */
const COUNT_NS = [5, 6, 8, 12]

const COUNT_PROMPTS = [
  (p: Patch, counts: number[], area: number) =>
    `A student estimates the number of ${p.organism} ${p.place} of ${prose(area)} m². The student places ${word(counts.length)} 1 m² quadrats at random and counts ${list(counts)} ${p.organism} in them. Estimate the number of ${p.organism} ${p.at} the whole ${p.noun}.`,
  (p: Patch, counts: number[], area: number) =>
    `To estimate the population of ${p.organism} ${p.place}, a student places ${word(counts.length)} 1 m² quadrats at random. The counts are ${list(counts)}. The ${p.noun} has an area of ${prose(area)} m². Estimate the number of ${p.organism} ${p.at} the ${p.noun}.`,
]

/** Mean of the counts × area: written as q30 (7, 9, 6, 8 and 10 clover plants, 350 m², 2800). */
export const quadratCounts: Generator = {
  id: 'quadrat-counts-estimate',
  subjectId: 'biology',
  topicId: ECO,
  replaces: ['q30'],
  build(r, slot, turn) {
    const p = COUNTED[turn % COUNTED.length]!
    const n = pick(r, COUNT_NS)
    // Counts that differ, with a mean that prints exactly and is not 1 or 10, then an area that
    // makes a whole estimate of three figures at most and is not the answer, nor the mean, with the
    // point moved, doubled or halved.
    let counts: number[] = []
    let total = 0
    let mean = 0
    let areas: number[] = []
    for (let i = 0; ; i++) {
      if (i > 500) throw new Error(`no counts for ${p.name}`)
      counts = Array.from({ length: n }, () => int(r, p.density[0], p.density[1]))
      total = counts.reduce((s, c) => s + c, 0)
      mean = clean(total / n)
      if (new Set(counts).size < Math.max(3, n / 2) || !atMost(mean, 2) || !noOnes(mean) || powerOfTen(mean)) continue
      areas = p.areas.filter((a) => whole(clean(mean * a)) && figures(clean(mean * a)) <= 3 && shiftFree(clean(mean * a), a, total, mean) && distinct(a, total) && !tenfold(mean, a))
      if (areas.length) break
    }
    const area = pick(r, areas)
    const answer = clean(mean * area)
    return numeric(
      slot,
      {
        prompt: pick(r, COUNT_PROMPTS)(p, counts, area),
        solution:
          `Total counted $= ${counts.join(' + ')} = ${total}$ ${p.organism} in ${n} m², so the mean is $\\dfrac{${total}}{${n}} = ${show(mean)}$ ${p.organism} per m². ` +
          `The ${p.noun} is ${prose(area)} m², so the estimate is ${closes(`${show(mean)} \\times ${tex(area)}`, answer, p.organism)} ` +
          'The method relies on the quadrats being a fair sample: they must be placed at **random**, for example by using random numbers as coordinates, so that the student does not choose the patches with most ' +
          `${p.organism}, and the more quadrats used, the more reliable the mean.`,
        method: [`finds the mean per m², ${total} ÷ ${n} = ${show(mean)}, and multiplies by the area of ${prose(area)} m²`],
        answer,
      },
      // Second route: the total spread over the area sampled, scaled up to the whole area.
      { agrees: near((total * area) / n, answer), detail: `${total} × ${area} ÷ ${n}` },
      { context: p.name, n, total, area },
    )
  },
}

// =============================================================================================
// Ecosystems and interdependence: energy and biomass between trophic levels
// =============================================================================================

// ---------------------------------------------------------------------------------------------
// q11: next level ÷ this level × 100
// ---------------------------------------------------------------------------------------------

interface Chain {
  name: string
  habitat: string
  /** The lower level as the prompt names it, and short; `has` agrees with it: "the grass contains". */
  lower: string
  has: 'contains' | 'contain'
  from: string
  upper: string
  to: string
  /** Energy in the lower level, kJ per m²: lowest, highest, step. */
  energy: readonly [number, number, number]
  /** Efficiency of the transfer, %. */
  efficiency: readonly [number, number]
  /**
   * What never enters the next level, after "is not stored in the bodies of the rabbits:". The lower
   * level's figure already has its own respiration taken out; the consumers' respiration is said
   * after this.
   */
  losses: string
}
/** Efficiencies about 10%: lower for woodland herbivores and for foxes, higher in water. */
const CHAINS: Chain[] = [
  {
    name: 'grass to rabbits', has: 'contains', habitat: 'a grassland', lower: 'the grass (the producers)', from: 'the grass', upper: 'the rabbits (the primary consumers)', to: 'the rabbits',
    energy: [5000, 20000, 100], efficiency: [2, 12], losses: 'some is in roots and parts of the grass the rabbits do not eat, some passes out in their faeces',
  },
  {
    name: 'phytoplankton to zooplankton', has: 'contain', habitat: 'the sea', lower: 'the phytoplankton (the producers)', from: 'the phytoplankton', upper: 'the zooplankton (the primary consumers)', to: 'the zooplankton',
    energy: [2000, 9000, 100], efficiency: [8, 20], losses: 'some is in cells that die and sink without being eaten, some passes out in the zooplankton’s faeces',
  },
  {
    name: 'oak leaves to caterpillars', has: 'contain', habitat: 'an oak woodland', lower: 'the oak leaves (the producers)', from: 'the oak leaves', upper: 'the caterpillars (the primary consumers)', to: 'the caterpillars',
    energy: [3000, 12000, 100], efficiency: [2, 10], losses: 'some is in leaves that are not eaten, some passes out in the caterpillars’ droppings',
  },
  {
    name: 'caterpillars to blue tits', has: 'contain', habitat: 'an oak woodland', lower: 'the caterpillars (the primary consumers)', from: 'the caterpillars', upper: 'the blue tits (the secondary consumers)', to: 'the blue tits',
    energy: [200, 1200, 10], efficiency: [4, 10], losses: 'some is in caterpillars that are not eaten, some passes out in the birds’ droppings',
  },
  {
    name: 'zooplankton to sticklebacks', has: 'contain', habitat: 'a lake', lower: 'the zooplankton (the primary consumers)', from: 'the zooplankton', upper: 'the sticklebacks (the secondary consumers)', to: 'the sticklebacks',
    energy: [400, 2500, 10], efficiency: [8, 20], losses: 'some is in zooplankton that are not eaten, some passes out in the fishes’ faeces',
  },
  {
    name: 'rabbits to foxes', has: 'contain', habitat: 'a grassland', lower: 'the rabbits (the primary consumers)', from: 'the rabbits', upper: 'the foxes (the secondary consumers)', to: 'the foxes',
    energy: [100, 800, 10], efficiency: [2, 8], losses: 'some is in bones and fur the foxes do not eat, some passes out in their faeces and urine',
  },
]

interface Transfer {
  lower: number
  upper: number
  e: number
}
/** Every lower level and efficiency (to the half per cent) that leaves a whole number of kJ in the next level. */
const transfers = (c: Chain): Transfer[] =>
  range(...c.energy).flatMap((lower) =>
    range(c.efficiency[0], c.efficiency[1], 0.5)
      .map((e) => ({ lower, e, upper: clean((lower * e) / 100) }))
      .filter((x) => whole(x.upper) && x.upper >= 10 && shiftFree(x.e, x.lower, x.upper) && distinct(x.lower, x.upper)),
  )

const TRANSFER_PROMPTS = [
  (c: Chain, x: Transfer) =>
    `In ${c.habitat}, ${c.lower} ${c.has} ${prose(x.lower)} kJ of energy per m², and ${c.upper}, the next trophic level, contain ${prose(x.upper)} kJ per m². What is the efficiency of energy transfer from ${c.from} to ${c.to}, as a percentage?`,
  (c: Chain, x: Transfer) =>
    `A trophic level in ${c.habitat}, ${c.lower}, contains ${prose(x.lower)} kJ of energy per m². The next trophic level, ${c.upper}, contains ${prose(x.upper)} kJ per m². Calculate the efficiency of energy transfer between the two levels, as a percentage.`,
]

/** Efficiency = next ÷ this × 100: written as q11 (1000 kJ and 80 kJ, 8%). */
export const trophicEfficiency: Generator = {
  id: 'trophic-transfer-efficiency',
  subjectId: 'biology',
  topicId: ECO,
  replaces: ['q11'],
  build(r, slot, turn) {
    const c = CHAINS[turn % CHAINS.length]!
    const x = evenly(r, `trophic-transfer-efficiency:${c.name}`, () => transfers(c), (y) => y.e)
    return numeric(
      slot,
      {
        prompt: pick(r, TRANSFER_PROMPTS)(c, x),
        solution:
          `$\\dfrac{${tex(x.upper)}}{${tex(x.lower)}} \\times 100 = ${show(x.e)}\\%$. ` +
          `The other ${show(100 - x.e)}% is not stored in the bodies of ${c.to}: ${c.losses}, and much is used by ${c.to} in respiration and lost as heat.`,
        method: [`divides ${prose(x.upper)} by ${prose(x.lower)} and multiplies by 100`],
        answer: x.e,
        units: unitsOf(slot),
        line: `${show(x.e)}`,
      },
      // Second route: the lower level at that efficiency gives the next level back.
      { agrees: near((x.lower * x.e) / 100, x.upper), detail: `${x.lower} × ${x.e}% = ${x.upper}` },
      { context: c.name, lower: x.lower, upper: x.upper, e: x.e },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q20: a pyramid of biomass, producers to secondary consumers
// ---------------------------------------------------------------------------------------------

interface Pyramid {
  name: string
  habitat: string
  producers: string
  primary: string
  secondary: string
  /** Producers' dry biomass, g/m²: lowest, highest, step. */
  biomass: readonly [number, number, number]
}
const PYRAMIDS: Pyramid[] = [
  { name: 'grassland', habitat: 'a grassland', producers: 'grasses', primary: 'grasshoppers and other plant-eating insects', secondary: 'spiders', biomass: [800, 3000, 50] },
  { name: 'pond', habitat: 'a pond', producers: 'pondweed and algae', primary: 'water snails and water fleas', secondary: 'small fish', biomass: [400, 2000, 10] },
  { name: 'salt marsh', habitat: 'a salt marsh', producers: 'cord grass', primary: 'periwinkles', secondary: 'shore crabs', biomass: [1000, 4000, 50] },
  { name: 'hedgerow', habitat: 'a hedgerow', producers: 'hawthorn and bramble', primary: 'caterpillars and aphids', secondary: 'blue tits and ladybirds', biomass: [2000, 6000, 100] },
]

interface Levels {
  p: number
  c1: number
  c2: number
  e1: number
  e2: number
  answer: number
}
/**
 * Each step 3 to 20% of the level below, the two steps different, the producers and primary
 * consumers whole numbers of g/m² and the secondary consumers to 0.1 g/m², and
 * the answer not one step's percentage with the point moved, doubled or halved: a step of 10%
 * makes the answer the other step ÷ 10, and a student who gave one step would be marked near it.
 */
const levels = (py: Pyramid): Levels[] =>
  range(...py.biomass).flatMap((p) =>
    range(3, 20).flatMap((e1) =>
      range(3, 20)
        .filter((e2) => e2 !== e1)
        .map((e2) => ({ p, e1, e2, c1: clean((p * e1) / 100), c2: clean((p * e1 * e2) / 10000), answer: clean((e1 * e2) / 100) }))
        .filter((x) => whole(x.c1) && atMost(x.c2, 1) && x.c2 >= 2 && between(x.answer, [0.2, 2.5]) && shiftFree(x.answer, x.p, x.c1, x.c2, x.e1, x.e2) && distinct(x.p, x.c1, x.c2)),
    ),
  )

const PYRAMID_PROMPTS = [
  (py: Pyramid, x: Levels) =>
    `A pyramid of biomass for ${py.habitat} has producers (${py.producers}) of ${prose(x.p)} g/m², primary consumers (${py.primary}) of ${x.c1} g/m² and secondary consumers (${py.secondary}) of ${x.c2} g/m². What percentage of the producers' biomass is present in the secondary consumers?`,
  (py: Pyramid, x: Levels) =>
    `In ${py.habitat}, the dry biomass of the producers, ${py.producers}, is ${prose(x.p)} g/m². The primary consumers, ${py.primary}, have ${x.c1} g/m², and the secondary consumers, ${py.secondary}, have ${x.c2} g/m². Calculate the biomass of the secondary consumers as a percentage of the biomass of the producers.`,
]

/** Top ÷ bottom × 100, checked as the product of the two steps: written as q20 (2500, 175 and 14 g/m², 0.56%). */
export const biomassPyramid: Generator = {
  id: 'pyramid-of-biomass-percentage',
  subjectId: 'biology',
  topicId: ECO,
  replaces: ['q20'],
  build(r, slot, turn) {
    const py = PYRAMIDS[turn % PYRAMIDS.length]!
    // The producers' biomass first, among those giving ten or more answers: 2000 g/m² divides by
    // most percentages and would fill the context. Then the answer evenly.
    const x = byFirst(r, `pyramid-of-biomass-percentage:${py.name}`, memo(`pyramid:${py.name}`, () => levels(py)), (y) => y.p, (y) => y.answer, 10)
    return numeric(
      slot,
      {
        prompt: pick(r, PYRAMID_PROMPTS)(py, x),
        solution:
          `$\\dfrac{${x.c2}}{${tex(x.p)}} \\times 100 = ${show(x.answer)}\\%$. Checking level by level: $\\dfrac{${x.c1}}{${tex(x.p)}} \\times 100 = ${x.e1}\\%$, ` +
          `then $\\dfrac{${x.c2}}{${x.c1}} \\times 100 = ${x.e2}\\%$, and $${show(x.e1 / 100)} \\times ${show(x.e2 / 100)} = ${show(x.answer / 100)}$, which is $${show(x.answer)}\\%$.`,
        method: [`divides ${x.c2} by ${prose(x.p)}, or multiplies the two level percentages`, 'multiplies by 100'],
        answer: x.answer,
        tolerance: toPlaces(x.answer, 2),
        units: unitsOf(slot),
        line: show(x.answer),
      },
      // Second route: the two steps' fractions multiplied.
      { agrees: near((x.c1 / x.p) * (x.c2 / x.c1) * 100, x.answer), detail: `${x.e1}% × ${x.e2}%` },
      { context: py.name, p: x.p, c1: x.c1, c2: x.c2 },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q31: what the producers capture, less respiration and what is not eaten
// ---------------------------------------------------------------------------------------------

interface Producer {
  name: string
  /** "the grass growing on one square metre of a grassland captures". */
  subject: string
  verb: string
  /** "the grass", as the losses and the question name it. */
  short: string
  /** After "and N kJ": "is in roots and dead leaves that the grazing animals do not eat". */
  notEaten: string
  consumers: string
  /** The consumers again, in the question: "the snails and other animals". */
  eaters: string
  /** Energy captured, kJ per m² per year: lowest, highest. */
  captured: readonly [number, number]
  efficiency: readonly [number, number]
}
const PRODUCERS: Producer[] = [
  {
    name: 'grassland', subject: 'the grass growing on one square metre of a grassland', verb: 'captures', short: 'the grass',
    notEaten: 'is in roots and dead leaves that the grazing animals do not eat', consumers: 'the grazing animals', eaters: 'the grazing animals', captured: [3000, 9000], efficiency: [4, 15],
  },
  {
    name: 'pond', subject: 'the pondweed and algae in one square metre of a pond', verb: 'capture', short: 'the pondweed and algae',
    notEaten: 'is in plant material that dies and sinks without being eaten', consumers: 'the snails and other animals that feed on them', eaters: 'the snails and other animals', captured: [3000, 10000], efficiency: [5, 15],
  },
  {
    name: 'woodland', subject: 'the trees and shrubs on one square metre of a woodland', verb: 'capture', short: 'the trees and shrubs',
    notEaten: 'is in wood, roots and fallen leaves that animals do not eat', consumers: 'the plant-eating insects and other animals', eaters: 'the plant-eating animals', captured: [8000, 20000], efficiency: [2, 7],
  },
  {
    name: 'sea', subject: 'the phytoplankton in one square metre of the sea surface', verb: 'capture', short: 'the phytoplankton',
    notEaten: 'is in cells that die and sink without being eaten', consumers: 'the zooplankton that feed on them', eaters: 'the zooplankton', captured: [2000, 8000], efficiency: [10, 20],
  },
  {
    name: 'moorland', subject: 'the heather on one square metre of a moorland', verb: 'captures', short: 'the heather',
    notEaten: 'is in woody stems and roots that the grazing animals do not eat', consumers: 'the sheep and red grouse that graze it', eaters: 'the sheep and grouse', captured: [3000, 8000], efficiency: [2, 8],
  },
]

interface Budget {
  c: number
  e: number
  t: number
  /** Every respiration loss, in 50 kJ steps, that leaves 15% or more uneaten. */
  rs: number[]
}
const budgets = (pr: Producer): Budget[] =>
  range(pr.captured[0], pr.captured[1], 100).flatMap((c) =>
    range(pr.efficiency[0], pr.efficiency[1], 0.5).flatMap((e) => {
      const t = clean((c * e) / 100)
      if (!whole(t)) return []
      const rs = range(Math.ceil((c * 0.4) / 50) * 50, Math.floor((c * 0.65) / 50) * 50, 50).filter((rr) => {
        const n = c - rr - t
        return n >= c * 0.15 && rr !== n && distinct(c, rr, n, t) && shiftFree(e, c, rr, n, t)
      })
      return rs.length >= 3 ? [{ c, e, t, rs }] : []
    }),
  )

/** Efficiency after both losses: written as q31 (4000 kJ less 2500 and 1200 kJ, 7.5%). */
export const energyAfterLosses: Generator = {
  id: 'energy-transfer-after-losses',
  subjectId: 'biology',
  topicId: ECO,
  replaces: ['q31'],
  build(r, slot, turn) {
    const pr = PRODUCERS[turn % PRODUCERS.length]!
    const b = evenly(r, `energy-transfer-after-losses:${pr.name}`, () => budgets(pr), (y) => y.e)
    const resp = pick(r, b.rs)
    const lost = b.c - resp - b.t
    return numeric(
      slot,
      {
        prompt:
          `In one year, ${pr.subject} ${pr.verb} ${prose(b.c)} kJ of energy by photosynthesis. Of this, ${prose(resp)} kJ is released by ${pr.short} in respiration and transferred to the surroundings as heat, ` +
          `and ${prose(lost)} kJ ${pr.notEaten}. The rest is transferred to ${pr.consumers}. Calculate the efficiency of the energy transfer from ${pr.short} to ${pr.eaters}, as a percentage of the energy ${pr.short} captured.`,
        solution:
          `Energy transferred to ${pr.eaters} $= ${tex(b.c)} - ${tex(resp)} - ${tex(lost)} = ${tex(b.t)}$ kJ. Efficiency $= \\dfrac{${tex(b.t)}}{${tex(b.c)}} \\times 100 = ${show(b.e)}\\%$. ` +
          'The two losses here are among the usual ones at every trophic level (energy is also lost in faeces and urine at the next level): energy released in **respiration** and lost as **heat**, ' +
          'and energy in parts of the organism that are **not eaten**, which goes to the decomposers instead. Because so little passes on, each trophic level holds far less energy and biomass than the one below, ' +
          'which is why a pyramid of biomass has its shape and why food chains rarely have more than four or five levels.',
        method: [
          `subtracts both losses to find the energy passed on: ${prose(b.c)} − ${prose(resp)} − ${prose(lost)} = ${prose(b.t)} kJ`,
          `divides by the energy captured and multiplies by 100: ${prose(b.t)} ÷ ${prose(b.c)} × 100`,
        ],
        answer: b.e,
        units: unitsOf(slot),
      },
      // Second route: 100% less the two losses as percentages.
      { agrees: near(100 - (resp / b.c) * 100 - (lost / b.c) * 100, b.e), detail: `100 − ${fixed((resp / b.c) * 100, 2)} − ${fixed((lost / b.c) * 100, 2)}` },
      { context: pr.name, captured: b.c, respired: resp, uneaten: lost, e: b.e },
    )
  },
}

// =============================================================================================
// Material cycles: decay
// =============================================================================================

interface Heap {
  name: string
  /** "a sample of grass cuttings", as a sentence names it. */
  sample: string
  /** "in a warm compost bin", "on a woodland floor". */
  place: string
  /** Percentage of the starting mass lost per day, lowest and highest. */
  perDay: readonly [number, number]
  days: readonly [number, number]
  masses: number[]
}
/** Grass cuttings decay fastest; leaf litter in a mesh bag on a woodland floor slowest. */
const HEAPS: Heap[] = [
  { name: 'grass cuttings', sample: 'a sample of grass cuttings', place: 'in a warm compost bin', perDay: [2, 6], days: [4, 12], masses: range(100, 500, 10) },
  { name: 'vegetable peelings', sample: 'a sample of vegetable peelings', place: 'in a compost heap', perDay: [1.5, 5], days: [5, 14], masses: range(150, 600, 10) },
  { name: 'leaf litter', sample: 'a mesh bag of leaf litter', place: 'on a woodland floor', perDay: [0.2, 1.2], days: [10, 42], masses: range(40, 200, 5) },
  { name: 'fallen leaves', sample: 'a sample of fallen leaves', place: 'in a garden compost bin', perDay: [0.8, 3], days: [7, 28], masses: range(100, 400, 10) },
]

interface Decay {
  m0: number
  m1: number
  loss: number
  d: number
  /** g per day. */
  rate: number
  /** Percentage of the starting mass lost over the d days, and per day. */
  pct: number
  perDay: number
}
/** Every mass, time and whole-gram loss in the heap's range, at most 60% of the mass. */
const decays = (h: Heap): Decay[] =>
  h.masses.flatMap((m0) =>
    range(h.days[0], h.days[1]).flatMap((d) =>
      range(Math.max(2, Math.ceil((m0 * h.perDay[0] * d) / 100)), Math.min(Math.floor(m0 * 0.6), Math.floor((m0 * h.perDay[1] * d) / 100))).map((loss) => {
        const pct = clean((loss / m0) * 100)
        return { m0, m1: m0 - loss, loss, d, rate: clean(loss / d), pct, perDay: clean(pct / d) }
      }),
    ),
  )

const RATE_PROMPTS = [
  (h: Heap, x: Decay) => `${cap(h.sample)} with a mass of ${x.m0} g decays to ${x.m1} g over ${x.d} days. What is the rate of decay, in grams per day?`,
  (h: Heap, x: Decay) => `A student leaves ${h.sample} ${h.place}. Its mass falls from ${x.m0} g to ${x.m1} g in ${x.d} days. Calculate the mean rate of decay, in grams per day.`,
]
const PER_DAY_PROMPTS = [
  (h: Heap, x: Decay) => `${cap(h.sample)} with a mass of ${x.m0} g decays to ${x.m1} g over ${x.d} days. What percentage of the original mass is lost per day?`,
  (h: Heap, x: Decay) => `A student leaves ${h.sample} ${h.place}. Its mass falls from ${x.m0} g to ${x.m1} g in ${x.d} days. Calculate the mean percentage of the starting mass lost per day.`,
]

/** Loss ÷ days: written as material-cycles q11 (200 g to 140 g in 6 days, 10 g/day). */
export const decayRate: Generator = {
  id: 'decay-rate-grams-per-day',
  subjectId: 'biology',
  topicId: CYCLES,
  replaces: ['q11'],
  build(r, slot, turn) {
    const h = HEAPS[turn % HEAPS.length]!
    // The time first, so the times that divide most losses cleanly do not fill the context; then the rate.
    const pool = memo(`decay-rate:${h.name}`, () =>
      decays(h).filter((x) => atMost(x.rate, 2) && figures(x.rate) <= 3 && noOnes(x.rate) && distinct(x.m0, x.m1, x.loss, x.d, x.rate) && shiftFree(x.rate, x.m0, x.m1, x.loss, x.d)),
    )
    const x = byFirst(r, `decay-rate-grams-per-day:${h.name}`, pool, (y) => y.d, (y) => y.rate, 10)
    return numeric(
      slot,
      {
        prompt: pick(r, RATE_PROMPTS)(h, x),
        solution: `$${x.m0} - ${x.m1} = ${x.loss}$ g lost, and $${x.loss} \\div ${x.d} = ${show(x.rate)}$ g per day.`,
        method: [`finds the change in mass, ${x.loss} g`, `divides by the time, ${x.d} days`],
        answer: x.rate,
        units: unitsOf(slot),
        line: show(x.rate),
      },
      // Second route: the rate over the days takes the starting mass down to the final one.
      { agrees: near(x.m0 - x.rate * x.d, x.m1), detail: `${x.m0} − ${x.rate} × ${x.d} = ${x.m1}` },
      { context: h.name, m0: x.m0, m1: x.m1, d: x.d },
    )
  },
}

/** Percentage lost ÷ days: written as material-cycles q12 (200 g to 140 g in 6 days, 5%/day). */
export const decayPercentPerDay: Generator = {
  id: 'decay-percent-per-day',
  subjectId: 'biology',
  topicId: CYCLES,
  replaces: ['q12'],
  build(r, slot, turn) {
    const h = HEAPS[turn % HEAPS.length]!
    // The percentage over the time and per day both exact to 2 decimal places; the per-day figure is
    // not the percentage over the time, nor the grams per day, with the point moved.
    // Only masses that give eight answers or more: 230 g gives an exact percentage only for a loss
    // of 20, 30 or 40%, and would fill the context with those. Then the mass, the time and the
    // answer each spread evenly.
    const pool = () =>
      rich(rich(
        decays(h).filter(
          (x) =>
            atMost(x.pct, 2) && atMost(x.perDay, 2) && figures(x.perDay) <= 3 && noOnes(x.perDay) && between(x.perDay, h.perDay) &&
            distinct(x.m0, x.m1, x.loss, x.d) && shiftFree(x.perDay, x.pct, x.m0, x.m1, x.loss, x.d, x.loss / x.d),
        ),
        (y) => y.m0,
        (y) => y.perDay,
        8,
      ), (y) => y.perDay, (y) => y.m0, 3)
    const x = balanced(r, `decay-percent-per-day:${h.name}`, pool, (y) => y.perDay, (y) => y.d, (y) => y.m0)
    return numeric(
      slot,
      {
        prompt: pick(r, PER_DAY_PROMPTS)(h, x),
        solution:
          `$${x.m0} - ${x.m1} = ${x.loss}$ g lost. $${x.loss}$ g of $${x.m0}$ g is $\\dfrac{${x.loss}}{${x.m0}} \\times 100 = ${show(x.pct)}\\%$ over ${x.d} days, so $${show(x.pct)} \\div ${x.d} = ${show(x.perDay)}\\%$ per day.`,
        method: [`finds the percentage lost, ${show(x.pct)}%`, `divides by the time, ${x.d} days`],
        answer: x.perDay,
        // Half a unit in the answer's last place, and never tighter than the written slot's 0.05 needs.
        tolerance: toPlaces(x.perDay, Math.max(1, places(x.perDay))),
        units: unitsOf(slot),
        line: show(x.perDay),
      },
      // Second route: the grams lost per day as a percentage of the starting mass.
      { agrees: near((x.loss / x.d / x.m0) * 100, x.perDay), detail: `${x.loss} ÷ ${x.d} ÷ ${x.m0} × 100` },
      { context: h.name, m0: x.m0, m1: x.m1, d: x.d },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// material-cycles q19: a table of masses, the rate over the first two intervals
// ---------------------------------------------------------------------------------------------

interface Bag {
  name: string
  /** "a bag of leaves", as the prompt names it. */
  sample: string
  place: string
  /** % of the starting mass lost per day over the first two intervals. */
  perDay: readonly [number, number]
  masses: number[]
}
const BAGS: Bag[] = [
  { name: 'grass cuttings', sample: 'a mesh bag of grass cuttings', place: 'a warm compost bin', perDay: [2, 5], masses: range(100, 400, 10) },
  { name: 'leaves', sample: 'a bag of leaves', place: 'a compost heap', perDay: [1, 4], masses: range(100, 400, 10) },
  { name: 'vegetable peelings', sample: 'a bag of vegetable peelings', place: 'a compost bin', perDay: [1.5, 4.5], masses: range(150, 400, 10) },
]
/** Days between readings: never 5, which makes the first ten days and the per-day figure differ only by the point. */
const INTERVALS = [3, 4, 6, 7]

interface Table {
  i: number
  m0: number
  loss: number
  pct: number
  perDay: number
}
const tables = (b: Bag): Table[] =>
  INTERVALS.flatMap((i) =>
    b.masses.flatMap((m0) =>
      range(10, Math.floor(m0 * 0.5)).map((loss) => {
        const pct = clean((loss / m0) * 100)
        return { i, m0, loss, pct, perDay: clean(pct / (2 * i)) }
      }),
    ),
  ).filter(
    (x) =>
      atMost(x.pct, 1) && atMost(x.perDay, 1) && between(x.perDay, b.perDay) && noOnes(x.perDay) &&
      distinct(x.m0, x.m0 - x.loss, x.loss) && shiftFree(x.perDay, x.pct, x.m0, x.m0 - x.loss, x.loss, 2 * x.i, x.loss / (2 * x.i)),
  )

/** Mass lost over the first two intervals ÷ starting mass ÷ days: written as material-cycles q19 (250 g to 178 g in 8 days, 3.6%/day). */
export const decayTable: Generator = {
  id: 'decay-percent-from-a-table',
  subjectId: 'biology',
  topicId: CYCLES,
  replaces: ['q19'],
  build(r, slot, turn) {
    const b = BAGS[turn % BAGS.length]!
    // The starting mass first, then the interval, then the answer: 250 g alone gives an exact
    // percentage for every gram and would fill the context.
    const x = layered(r, `decay-percent-from-a-table:${b.name}`, () => rich(tables(b), (y) => y.m0, (y) => y.perDay, 3), (y) => y.m0, (y) => y.i, (y) => y.perDay)
    // The first interval loses half or a little more of the first two intervals' loss, and the third
    // interval less than the second: decay slows as the easily digested material goes.
    const first = int(r, Math.ceil(x.loss / 2), Math.floor(x.loss * 0.6))
    const second = x.loss - first
    const third = int(r, Math.max(2, Math.ceil(second * 0.3)), Math.floor(second * 0.7))
    const days = [0, x.i, 2 * x.i, 3 * x.i]
    const masses = [x.m0, x.m0 - first, x.m0 - x.loss, x.m0 - x.loss - third]
    const k = 2 * x.i
    return numeric(
      slot,
      {
        prompt:
          `A student measured the mass of ${b.sample} as it decayed in ${b.place}.\n\n| Day | Mass (g) |\n|---|---|\n${days.map((d, j) => `| ${d} | ${masses[j]} |`).join('\n')}\n\n` +
          `Calculate the mean rate of decay over the first ${k} days, as a percentage of the starting mass lost per day.`,
        solution:
          `Mass lost in ${k} days $= ${x.m0} - ${masses[2]} = ${x.loss}$ g. As a percentage of the starting mass: $\\dfrac{${x.loss}}{${x.m0}} \\times 100 = ${show(x.pct)}\\%$ over ${k} days. ` +
          `Per day: $${show(x.pct)} \\div ${k} = ${show(x.perDay)}\\%$ per day. (The table also shows decay slowing later: only ${third} g is lost between day ${k} and day ${3 * x.i}.)`,
        method: [`finds the mass lost, ${x.loss} g`, `divides by the starting mass and by ${k} days`],
        answer: x.perDay,
        tolerance: toPlaces(x.perDay, 1),
        units: unitsOf(slot),
        line: show(x.perDay),
      },
      { agrees: near((x.loss / k / x.m0) * 100, x.perDay), detail: `${x.loss} ÷ ${k} ÷ ${x.m0} × 100` },
      { context: b.name, i: x.i, m0: x.m0, loss: x.loss, first, third },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// material-cycles q30: the percentage of a fruit's mass lost as it rots
// ---------------------------------------------------------------------------------------------

interface Fruit {
  name: string
  place: string
  masses: readonly [number, number]
  weeks: readonly [number, number]
  lost: readonly [number, number]
}
const FRUITS: Fruit[] = [
  { name: 'apple', place: 'a warm room', masses: [120, 250], weeks: [3, 5], lost: [15, 45] },
  { name: 'pear', place: 'a warm kitchen', masses: [140, 230], weeks: [3, 5], lost: [15, 45] },
  { name: 'tomato', place: 'a warm greenhouse', masses: [70, 150], weeks: [1, 3], lost: [15, 40] },
  { name: 'orange', place: 'a warm room', masses: [150, 260], weeks: [3, 5], lost: [12, 35] },
  { name: 'peach', place: 'a warm kitchen', masses: [120, 200], weeks: [2, 4], lost: [15, 45] },
]

interface Rot {
  m0: number
  m1: number
  loss: number
  p: number
}
/** Whole-gram masses whose loss is an exact percentage to 1 decimal place, never 50%, never a given with the point moved. */
const rots = (f: Fruit): Rot[] =>
  range(...f.masses).flatMap((m0) =>
    range(Math.ceil((m0 * f.lost[0]) / 100), Math.floor((m0 * f.lost[1]) / 100))
      .map((loss) => ({ m0, m1: m0 - loss, loss, p: clean((loss / m0) * 100) }))
      .filter((x) => atMost(x.p, 1) && x.p !== 50 && shiftFree(x.p, x.m0, x.m1, x.loss) && distinct(x.m0, x.m1, x.loss)),
  )

const weeks = (w: number) => (w === 1 ? 'one week' : `${word(w)} weeks`)
const ROT_PROMPTS = [
  (f: Fruit, x: Rot, w: number) =>
    `${cap(an(f.name))} ${f.name} with a mass of ${x.m0} g is left in ${f.place}. After ${weeks(w)} it has decayed and its mass is ${x.m1} g. Calculate the percentage of the ${f.name}'s original mass that has been lost.`,
  (f: Fruit, x: Rot, w: number) =>
    `A student leaves ${an(f.name)} ${f.name} in ${f.place} and weighs it as it rots: its mass is ${x.m0} g at the start and ${x.m1} g ${weeks(w)} later. Calculate the percentage of its original mass that has been lost.`,
]

/** Mass lost ÷ original × 100: written as material-cycles q30 (an apple 250 g to 190 g, 24%). */
export const fruitMassLost: Generator = {
  id: 'decay-percentage-mass-lost',
  subjectId: 'biology',
  topicId: CYCLES,
  replaces: ['q30'],
  build(r, slot, turn) {
    const f = FRUITS[turn % FRUITS.length]!
    // The mass first, among those that give five or more exact percentages, then the percentage:
    // 125 g and 250 g give one for every gram and would fill the context.
    const x = byFirst(r, `decay-percentage-mass-lost:${f.name}`, memo(`rot:${f.name}`, () => rots(f)), (y) => y.m0, (y) => y.p, 5)
    const w = int(r, f.weeks[0], f.weeks[1])
    return numeric(
      slot,
      {
        prompt: pick(r, ROT_PROMPTS)(f, x, w),
        solution:
          `Mass lost $= ${x.m0} - ${x.m1} = ${x.loss}$ g. Percentage lost $= \\dfrac{${x.loss}}{${x.m0}} \\times 100 = ${show(x.p)}\\%$. ` +
          `The mass is lost because the decomposer microorganisms digest the ${f.name} and respire the products, releasing carbon dioxide and water vapour to the air, and because water evaporates from the decaying tissue. ` +
          `The warmth speeds this up, since the microorganisms' enzymes work faster at higher temperatures.`,
        method: [`finds the mass lost, ${x.m0} − ${x.m1} = ${x.loss} g, and divides by the original ${x.m0} g (× 100)`],
        answer: x.p,
        units: unitsOf(slot),
      },
      // Second route: 100% less the percentage of the mass that is left.
      { agrees: near(100 - (x.m1 / x.m0) * 100, x.p), detail: `100 − ${x.m1} ÷ ${x.m0} × 100` },
      { context: f.name, m0: x.m0, m1: x.m1, weeks: w },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// material-cycles q31: two rates over different times, compared
// ---------------------------------------------------------------------------------------------

interface Bins {
  name: string
  material: string
  /** What the two samples go into: "compost bins". */
  into: string
  /** Where sample A and sample B are kept, after "in". */
  a: string
  b: string
  /** % of the sample lost per day in each. */
  aPerDay: readonly [number, number]
  bPerDay: readonly [number, number]
  /** Why A is faster, the closing sentence of the solution. */
  why: string
}
const BINS: Bins[] = [
  {
    name: 'warm and cold', material: 'grass cuttings', into: 'compost bins', a: 'a warm, well-aerated bin', b: 'a cold bin', aPerDay: [2, 6], bPerDay: [0.3, 1.5],
    why: 'The warm bin speeds up the decomposers’ enzymes, and good aeration supplies the oxygen they need for aerobic respiration, which is why composters keep heaps warm, moist and turned.',
  },
  {
    name: 'moist and dry', material: 'leaf litter', into: 'compost heaps', a: 'a moist compost heap', b: 'a heap that is kept dry under a cover', aPerDay: [1, 4], bPerDay: [0.2, 0.8],
    why: 'Decomposers need water: their enzymes work in solution and they absorb the digested food dissolved in it, so a dry heap hardly decays, which is why dried food keeps.',
  },
  {
    name: 'turned and waterlogged', material: 'vegetable peelings', into: 'compost heaps', a: 'a heap that is turned every few days', b: 'a waterlogged heap', aPerDay: [2, 6], bPerDay: [0.3, 1.5],
    why: 'Turning lets air into the heap, so the decomposers have the oxygen they need for aerobic respiration; in a waterlogged heap the water fills the air spaces and decay is slow.',
  },
]
const SAMPLE_MASSES = range(200, 500, 50)

interface Compare {
  m: number
  ta: number
  tb: number
  a: number
  b: number
  ra: number
  rb: number
  k: number
  naive: number
}
/** Every pair of samples whose rates print exactly, compared to 1 decimal place, with the student's ratio well wide of it. */
const compares = (bn: Bins): Compare[] =>
  SAMPLE_MASSES.flatMap((m) => {
    const side = (perDay: readonly [number, number], days: number[]) =>
      days.flatMap((t) =>
        range(Math.max(2, Math.ceil((m * perDay[0] * t) / 100)), Math.min(Math.floor(m * 0.6), Math.floor((m * perDay[1] * t) / 100)))
          .map((loss) => ({ t, loss, rate: clean(loss / t) }))
          .filter((s) => atMost(s.rate, 2) && noOnes(s.rate) && !powerOfTen(s.rate)),
      )
    const as = side(bn.aPerDay, range(3, 10))
    const bs = side(bn.bPerDay, range(6, 21))
    return as.flatMap((A) =>
      bs
        .map((B) => ({ m, ta: A.t, tb: B.t, a: A.loss, b: B.loss, ra: A.rate, rb: B.rate, k: clean(A.rate / B.rate), naive: clean(A.loss / B.loss) }))
        .filter(
          (x) =>
            x.ta !== x.tb && atMost(x.k, 1) && between(x.k, [1.5, 8]) && atMost(x.naive, 2) && x.naive >= 1.1 && Math.abs(x.naive - x.k) >= 0.5 &&
            distinct(x.a, x.b) && [x.m, x.ta, x.tb, x.a, x.b, x.ra, x.rb, x.naive].every((g) => !tenfold(x.k, g)),
        ),
    )
  })

/** Rate A ÷ rate B, each over its own time: written as material-cycles q31 (72 g in 6 days against 30 g in 10, 4). */
export const decayComparison: Generator = {
  id: 'decay-rates-compared',
  subjectId: 'biology',
  topicId: CYCLES,
  replaces: ['q31'],
  build(r, slot, turn) {
    const bn = BINS[turn % BINS.length]!
    // Whether sample A had the shorter time first, so the student's ratio is too small about half the
    // time and too large the rest; then the answer evenly.
    const x = layered(r, `decay-rates-compared:${bn.name}`, () => compares(bn), (y) => (y.ta < y.tb ? 0 : 1), (y) => y.ta, (y) => y.tb, (y) => y.k)
    const ignored = x.ta < x.tb
      ? `The student's comparison ignored the fact that sample B was given ${x.tb} days to lose its ${x.b} g.`
      : `The student's comparison ignored the fact that sample A was given ${x.ta} days to lose its ${x.a} g, longer than the ${x.tb} days of sample B.`
    return numeric(
      slot,
      {
        prompt:
          `Two identical ${x.m} g samples of ${bn.material} are put into ${bn.into}. Sample A, in ${bn.a}, loses ${x.a} g in ${x.ta} days. Sample B, in ${bn.b}, loses ${x.b} g in ${x.tb} days. ` +
          `A student says that sample A decayed ${show(x.naive)} times as fast as sample B, because ${x.a} ÷ ${x.b} = ${show(x.naive)}. Calculate how many times greater the rate of decay of sample A was than that of sample B.`,
        solution:
          `The two masses were lost over **different times**, so each must be turned into a rate first. Sample A: $\\dfrac{${x.a}}{${x.ta}} = ${show(x.ra)}$ g per day. Sample B: $\\dfrac{${x.b}}{${x.tb}} = ${show(x.rb)}$ g per day. ` +
          `Rate of A divided by rate of B $= \\dfrac{${show(x.ra)}}{${show(x.rb)}} = ${show(x.k)}$, so sample A decayed ${show(x.k)} times as fast, not ${show(x.naive)} times. ${ignored} ${bn.why}`,
        method: [`converts both losses to rates: ${x.a} ÷ ${x.ta} = ${show(x.ra)} g per day and ${x.b} ÷ ${x.tb} = ${show(x.rb)} g per day`, 'divides the rate for A by the rate for B'],
        answer: x.k,
        units: unitsOf(slot),
      },
      // Second route: cross-multiplied, without the rates.
      { agrees: near((x.a * x.tb) / (x.b * x.ta), x.k), detail: `(${x.a} × ${x.tb}) ÷ (${x.b} × ${x.ta})` },
      { context: bn.name, m: x.m, a: x.a, ta: x.ta, b: x.b, tb: x.tb, k: x.k },
    )
  },
}

// =============================================================================================
// Plant hormones
// =============================================================================================

// ---------------------------------------------------------------------------------------------
// q25: percentages ripened with and without ethene
// ---------------------------------------------------------------------------------------------

interface Crop {
  name: string
  /** Plural: "bananas". */
  fruits: string
  /** "crates", "trays". */
  container: string
  /** Fruits per container. */
  counts: number[]
  /** The ripening room's owner: "A shop". */
  business: string
}
const CROPS: Crop[] = [
  { name: 'bananas', fruits: 'bananas', container: 'crates', counts: [40, 48, 60, 75, 80, 120, 125, 150], business: 'A shop' },
  { name: 'tomatoes', fruits: 'tomatoes', container: 'trays', counts: [24, 30, 40, 48, 60, 75, 80], business: 'A wholesaler' },
  { name: 'avocados', fruits: 'avocados', container: 'boxes', counts: [20, 24, 25, 30, 40, 48, 60], business: 'A supermarket depot' },
  { name: 'mangoes', fruits: 'mangoes', container: 'crates', counts: [20, 24, 25, 30, 32, 40, 48, 50, 60], business: 'A fruit importer' },
]
/** Ripe in ethene, and in air, as percentages. */
const ETHENE: readonly [number, number] = [70, 97.5]
const AIR: readonly [number, number] = [10, 45]

interface Ripened {
  n: number
  x: number
  y: number
  px: number
  py: number
  diff: number
}
const ripenings = (c: Crop): Ripened[] =>
  c.counts.flatMap((n) =>
    range(1, n).flatMap((x) =>
      range(1, x - 1).map((y) => ({ n, x, y, px: clean((x / n) * 100), py: clean((y / n) * 100), diff: clean(((x - y) / n) * 100) })),
    ),
  ).filter(
    (z) =>
      between(z.px, ETHENE) && between(z.py, AIR) && atMost(z.px, 1) && atMost(z.py, 1) &&
      distinct(z.n, z.x, z.y) && shiftFree(z.diff, z.n, z.x, z.y, z.x - z.y, z.px, z.py),
  )

const RIPEN_PROMPTS = [
  (c: Crop, z: Ripened, d: number) =>
    `${c.business} receives two ${c.container}, each holding ${z.n} unripe ${c.fruits}. One is kept for ${word(d)} days in a room containing ethene gas; the other is kept for ${word(d)} days in ordinary air at the same temperature. ` +
    `After the ${word(d)} days, ${z.x} of the ${c.fruits} kept in ethene are ripe and ${z.y} of the ${c.fruits} kept in ordinary air are ripe. Calculate the difference between the percentages of ${c.fruits} that have ripened in the two ${c.container}.`,
  (c: Crop, z: Ripened, d: number) =>
    `To test ethene, ${c.business.toLowerCase()} puts ${z.n} unripe ${c.fruits} in a ripening room with ethene gas and another ${z.n} in ordinary air at the same temperature. ` +
    `After ${word(d)} days, ${z.x} of the ${c.fruits} in ethene and ${z.y} of those in ordinary air are ripe. Calculate the difference between the percentages that have ripened in the two groups.`,
]

/** Two percentages, then their difference: written as q25 (68 and 24 of 80 bananas, 55). */
export const ethenePercentages: Generator = {
  id: 'ethene-ripening-percentages',
  subjectId: 'biology',
  topicId: PLANT,
  replaces: ['q25'],
  build(r, slot, turn) {
    const c = CROPS[turn % CROPS.length]!
    const z = byFirst(r, `ethene-ripening-percentages:${c.name}`, memo(`ripen:${c.name}`, () => ripenings(c)), (y) => y.n, (y) => y.diff, 10)
    const d = int(r, 3, 5)
    return numeric(
      slot,
      {
        prompt: pick(r, RIPEN_PROMPTS)(c, z, d),
        solution:
          `In ethene: $\\dfrac{${z.x}}{${z.n}} \\times 100 = ${show(z.px)}\\%$. Ordinary air: $\\dfrac{${z.y}}{${z.n}} \\times 100 = ${show(z.py)}\\%$. Difference $= ${show(z.px)} - ${show(z.py)} = ${show(z.diff)}$ percentage points. ` +
          `Ethene is the plant hormone that triggers **ripening**. ${cap(c.fruits)} are picked and transported unripe, when they are firm and do not bruise, and then exposed to ethene so that they ripen just before they are sold. ` +
          `The ${show(z.py)}% in ordinary air ripened because ripening ${c.fruits} release ethene of their own, which spreads to the fruit around them.`,
        method: [`works out both percentages, ${show(z.px)}% and ${show(z.py)}%, or divides both counts by ${z.n}`],
        answer: z.diff,
        units: unitsOf(slot),
        line: show(z.diff),
      },
      // Second route: the difference in counts as a percentage of the crate.
      { agrees: near(((z.x - z.y) * 100) / z.n, z.diff), detail: `(${z.x} − ${z.y}) ÷ ${z.n} × 100` },
      { context: c.name, n: z.n, x: z.x, y: z.y },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q26: growth on the shaded and lit sides of a shoot
// ---------------------------------------------------------------------------------------------

interface Seedling {
  name: string
  /** "an oat seedling". */
  noun: string
  /** Starting length, mm. */
  start: readonly [number, number]
  /** Growth of the shaded side and of the lit side, mm. */
  shaded: readonly [number, number]
  lit: readonly [number, number]
}
const SEEDLINGS: Seedling[] = [
  { name: 'oat', noun: 'an oat seedling', start: [10, 25], shaded: [4, 18], lit: [2, 10] },
  { name: 'wheat', noun: 'a wheat seedling', start: [10, 25], shaded: [4, 18], lit: [2, 10] },
  { name: 'maize', noun: 'a maize seedling', start: [15, 40], shaded: [6, 24], lit: [2, 14] },
  { name: 'cress', noun: 'a cress seedling', start: [8, 20], shaded: [3, 12], lit: [2, 7] },
  { name: 'sunflower', noun: 'a sunflower seedling', start: [30, 60], shaded: [6, 24], lit: [2, 14] },
]

interface Bend {
  l0: number
  gs: number
  gl: number
  s: number
  lf: number
  k: number
  naive: number
}
const bends = (sd: Seedling): Bend[] =>
  range(...sd.start).flatMap((l0) =>
    range(...sd.shaded).flatMap((gs) =>
      range(...sd.lit).map((gl) => ({ l0, gs, gl, s: l0 + gs, lf: l0 + gl, k: clean(gs / gl), naive: (l0 + gs) / (l0 + gl) })),
    ),
  ).filter(
    (b) =>
      atMost(b.k, 2) && figures(b.k) <= 3 && between(b.k, [1.4, 4]) && b.naive >= 1.06 && b.k - b.naive >= 0.3 &&
      distinct(b.l0, b.s, b.lf) && b.gs !== b.l0 && b.gl !== b.l0 && [b.l0, b.s, b.lf, b.gs, b.gl].every((g) => !tenfold(b.k, g)),
  )

/** The student's division, as the prompt prints it: "32 ÷ 26 = 1.23" when exact, "is about 1.23" when not. */
const naiveText = (b: Bend) => (atMost(b.naive, 2) ? `${b.s} ÷ ${b.lf} = ${show(b.naive)}` : `${b.s} ÷ ${b.lf} is about ${fixed(b.naive, 2)}`)

/** Increase ÷ increase, not final ÷ final: written as q26 (20 mm to 32 and 26 mm, 2). */
export const shootBending: Generator = {
  id: 'phototropism-growth-comparison',
  subjectId: 'biology',
  topicId: PLANT,
  replaces: ['q26'],
  build(r, slot, turn) {
    const sd = SEEDLINGS[turn % SEEDLINGS.length]!
    // The lit side's growth first, so the 2 mm that divides into most growths does not fill the context; then the answer.
    const b = byFirst(r, `phototropism-growth-comparison:${sd.name}`, memo(`bend:${sd.name}`, () => bends(sd)), (y) => y.gl, (y) => y.k, 2)
    const d = int(r, 2, 3)
    return numeric(
      slot,
      {
        prompt:
          `The shoot of ${sd.noun} is ${b.l0} mm long. It is lit from one side for ${word(d)} days and bends towards the light. Afterwards the side of the shoot that was in shade measures ${b.s} mm from base to tip and the side that faced the light measures ${b.lf} mm. ` +
          `A student says that the shaded side grew about ${fixed(b.naive, 1)} times as much as the lit side, because ${naiveText(b)}. Calculate how many times greater the increase in length of the shaded side was than the increase in length of the lit side.`,
        solution:
          `Both sides started at ${b.l0} mm, so the student should compare the **increases**, not the final lengths. Shaded side: $${b.s} - ${b.l0} = ${b.gs}$ mm of growth. Lit side: $${b.lf} - ${b.l0} = ${b.gl}$ mm of growth. ` +
          `So the shaded side grew $\\dfrac{${b.gs}}{${b.gl}} = ${show(b.k)}$ times as much. Dividing the final lengths hides most of the difference, because the original ${b.l0} mm is counted in both. ` +
          'The result matches the auxin explanation: auxin made in the tip moves to the **shaded side**, where it makes the cells **elongate** more, so that side becomes longer and the shoot curves towards the light.',
        method: [`finds the two increases in length: ${b.gs} mm and ${b.gl} mm`, 'divides the increase on the shaded side by the increase on the lit side'],
        answer: b.k,
        units: unitsOf(slot),
      },
      // Second route: the lit side's growth scaled by the answer, added to the start, gives the shaded side.
      { agrees: near(b.l0 + b.gl * b.k, b.s), detail: `${b.l0} + ${b.gl} × ${b.k} = ${b.s}` },
      { context: sd.name, l0: b.l0, gs: b.gs, gl: b.gl },
    )
  },
}

export const ecologyGenerators: Generator[] = [
  quadratMean,
  trophicEfficiency,
  quadratQuarter,
  biomassPyramid,
  quadratCounts,
  energyAfterLosses,
  decayRate,
  decayPercentPerDay,
  decayTable,
  fruitMassLost,
  decayComparison,
  ethenePercentages,
  shootBending,
]

/** For the tests. */
export const ECOLOGY = { PATCHES, COUNTED, CHAINS, PYRAMIDS, PRODUCERS, HEAPS, BAGS, INTERVALS, FRUITS, BINS, CROPS, ETHENE, AIR, SEEDLINGS, SAMPLE_MASSES }
