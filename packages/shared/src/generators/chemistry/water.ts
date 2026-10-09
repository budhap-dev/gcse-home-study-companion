import { fixed, show } from '../format.ts'
import { near, numeric } from '../physics/build.ts'
import { pick, type Rng } from '../random.ts'
import type { Generator } from '../types.ts'
import { byFirst, clean, distinct, noOnes, places, powerOfTen, range, shiftFree, toPlaces } from './build.ts'
import { dm3Text } from './concentration.ts'

/**
 * Potable and waste water (AQA 8462, 4.10.1, required practical 8). The numeric written
 * questions are the dissolved-solids practical: a dish weighed before and after a sample is
 * evaporated, the mass per dm³, heating to constant mass, and the mass a known concentration
 * leaves. Every one has a generator here; the rest of the topic is recall and choice.
 *
 * Each water carries the dissolved solids it really has, in g/dm³: UK tap water about 0.05 to
 * 0.5, bottled mineral water 0.1 to 1.2, river water 0.1 to 0.6, estuary (brackish) water 5 to
 * 20, sea water 33 to 38. A school balance reads to 0.01 g, so every mass is to 0.01 g and an
 * evaporating dish weighs 30 to 60 g.
 */
const TOPIC = 'potable-and-waste-water'

const CM3 = '\\text{ cm}^3'
const DM3 = '\\text{ dm}^3'

interface Water {
  name: string
  /** "a sample of tap water" */
  sample: string
  /** "tap water", after a volume: "250 cm³ of tap water". */
  noun: string
  /** The sentence that states the concentration, for q17. */
  contains: (c: string) => string
  /** Dissolved solids, g/dm³, as a range and the step drawn in. */
  conc: [number, number, number]
  /** Sample volumes evaporated in a dish, cm³: 500 at most. */
  volumes: number[]
  /**
   * Water a dish of its residue loses on its first reheating, in grams. A fresh water leaves 0.05 to
   * 0.15 g of solids, which can hold only a few hundredths of a gram of water; salt from sea water holds more.
   */
  firstLoss: [number, number]
}
/** 100 and 1000 cm³ are left out of every list: dividing by 0.1 or 1 dm³ moves only the point. */
const WATERS: Water[] = [
  {
    name: 'tap water',
    sample: 'a sample of tap water',
    noun: 'tap water',
    contains: (c) => `The tap water in one town contains ${c} g/dm³ of dissolved solids.`,
    conc: [0.08, 0.5, 0.01],
    volumes: [150, 250, 300, 375, 400, 450, 500],
    firstLoss: [0.02, 0.04],
  },
  {
    name: 'mineral water',
    sample: 'a sample of bottled mineral water',
    noun: 'bottled mineral water',
    contains: (c) => `A bottle of mineral water lists ${c} g/dm³ of dissolved solids on its label.`,
    conc: [0.1, 1.2, 0.01],
    volumes: [150, 250, 300, 375, 400, 450, 500],
    firstLoss: [0.02, 0.04],
  },
  {
    name: 'river water',
    sample: 'a filtered sample of river water',
    noun: 'filtered river water',
    contains: (c) => `Filtered water from one river contains ${c} g/dm³ of dissolved solids.`,
    conc: [0.1, 0.6, 0.01],
    volumes: [150, 250, 300, 375, 400, 450, 500],
    firstLoss: [0.02, 0.04],
  },
  {
    name: 'sea water',
    sample: 'a sample of sea water',
    noun: 'sea water',
    contains: (c) => `Sea water contains about ${c} g/dm³ of dissolved solids.`,
    conc: [33, 38, 0.5],
    volumes: [10, 15, 20, 25, 30, 40, 50, 60, 75, 80],
    firstLoss: [0.08, 0.3],
  },
  {
    name: 'estuary water',
    sample: 'a sample of brackish water from an estuary',
    noun: 'brackish water from an estuary',
    contains: (c) => `Brackish water from one estuary contains about ${c} g/dm³ of dissolved solids.`,
    conc: [5, 20, 0.5],
    volumes: [15, 20, 25, 30, 40, 50, 60, 75, 80],
    firstLoss: [0.06, 0.25],
  },
]

interface Evaporated {
  c: number
  v: number
  m: number
}
/**
 * Every concentration and sample volume whose residue is to 0.01 g, at least 0.05 g (a balance
 * reading to 0.01 g can just see it), and is none of the figures printed, nor one doubled or
 * halved, with or without the point moved.
 */
const evaporated = (w: Water): Evaporated[] =>
  range(...w.conc).flatMap((c) =>
    w.volumes
      .map((v) => ({ c, v, m: clean((c * v) / 1000) }))
      .filter(({ c, v, m }) => places(m) <= 2 && m >= 0.05 && m <= 20 && noOnes(c, m) && !powerOfTen(m) && shiftFree(c, m, v) && shiftFree(m, c, v) && distinct(c, m, v)),
  )

/** The sample's volume first, among those allowing three answers or more, then an answer evenly (see byFirst). */
const byVolume = (r: Rng, key: string, w: Water, answerOf: (x: Evaporated) => number) => byFirst(r, key, () => evaporated(w), (x) => x.v, answerOf, 3)

// ---------------------------------------------------------------------------------------------
// q5: dissolved solids from the dish's two masses
// ---------------------------------------------------------------------------------------------

/** Residues each water leaves in the dish, in grams, from the sample volumes a student evaporates. */
const RESIDUES: Record<string, [number, number]> = {
  'tap water': [0.05, 0.15],
  'mineral water': [0.05, 0.3],
  'river water': [0.05, 0.2],
  'sea water': [0.35, 0.95],
  'estuary water': [0.12, 0.6],
}

export const dissolvedSolidsMass: Generator = {
  id: 'water-dissolved-solids-mass',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q5'],
  build(r, slot, turn) {
    const w = WATERS[turn % WATERS.length]!
    const solids = pick(r, range(RESIDUES[w.name]![0], RESIDUES[w.name]![1], 0.01).filter((x) => !powerOfTen(x)))
    // The dish's hundredths are not the residue's, so the answer is not read off the last digits.
    const dish = pick(r, range(30, 60, 0.01).filter((d) => !near(clean(d * 100) % 100, clean(solids * 100)) && !near(clean(d * 100) % 100, 0)))
    const after = clean(dish + solids)
    const [d, a] = [fixed(dish, 2), fixed(after, 2)]
    const prompt = pick(r, [
      `An empty evaporating dish weighs ${d} g. After evaporating ${w.sample} it weighs ${a} g. What mass of dissolved solids, in grams, was present?`,
      `A student weighs an empty evaporating dish at ${d} g. They evaporate ${w.sample} in it, let the dish cool and reweigh it at ${a} g. What mass of dissolved solids, in grams, did the sample contain?`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: `The solids are what is left when the water has gone: $${a} - ${d} = $ **${fixed(solids, 2)} g**.`,
        method: [],
        answer: solids,
        tolerance: toPlaces(solids, 2),
      },
      { agrees: near(clean(dish + solids), after) && near(Math.round(after * 100) - Math.round(dish * 100), Math.round(solids * 100)), detail: `${d} + ${fixed(solids, 2)} = ${a}` },
      { context: w.name, dish, after, solids },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q8: dissolved solids in g/dm³
// ---------------------------------------------------------------------------------------------

export const dissolvedSolidsConcentration: Generator = {
  id: 'water-dissolved-solids-concentration',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q8'],
  build(r, slot, turn) {
    const w = WATERS[turn % WATERS.length]!
    const { c, v, m } = byVolume(r, `water-dissolved-solids-concentration:${w.name}`, w, (x) => x.c)
    const prompt = pick(r, [
      `${show(v)} cm³ of ${w.noun} is evaporated and leaves ${fixed(m, 2)} g of dissolved solids. What is this in g/dm³?`,
      `A student evaporates ${show(v)} cm³ of ${w.noun} to dryness in a dish, leaving ${fixed(m, 2)} g of dissolved solids. What is the concentration of dissolved solids, in g/dm³?`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: `$${show(v)}${CM3} = ${dm3Text(v, 0)}${DM3}$, so $\\dfrac{${fixed(m, 2)}}{${dm3Text(v, 0)}} = $ **${show(c)} g/dm³**.`,
        method: [`converts to ${dm3Text(v, 0)} dm3`],
        answer: c,
        // The mass is to 0.01 g, so 0.4 g/dm³ from 0.24 g is 0.40.
        tolerance: toPlaces(c, Math.max(places(c), 2)),
      },
      { agrees: near(clean((c * v) / 1000), m), detail: `${show(c)} × ${show(v)} ÷ 1000 = ${show((c * v) / 1000)} g` },
      { context: w.name, c, v, m },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q13: heating to constant mass
// ---------------------------------------------------------------------------------------------

/** Each heating drives off less water than the one before, until two readings agree. */
function heatings(r: Rng, w: Water, final: number, count: number): number[] {
  // Losses in hundredths of a gram, largest first, then each a quarter to three-fifths of the
  // one before and always smaller, down to 0.01 g. Three losses need a first of 0.05 g or more.
  const first = Math.round(Math.max(w.firstLoss[0], count === 5 ? 0.05 : 0.02) * 100)
  let k = pick(r, range(first, Math.round(w.firstLoss[1] * 100), 1))
  const losses = [k / 100]
  for (let i = 1; i < count - 2; i++) {
    const lo = Math.max(1, Math.ceil(k * 0.25))
    const hi = Math.min(k - 1, Math.max(lo, Math.floor(k * 0.6)))
    k = pick(r, range(lo, hi, 1))
    losses.push(k / 100)
  }
  const out = [final, final]
  let m = final
  for (const loss of [...losses].reverse()) {
    m = clean(m + loss)
    out.unshift(m)
  }
  return out
}

const AT_CONSTANT = [
  (w: Water, xs: string) => `A student heats a dish of residue from ${w.sample} to constant mass. Readings are ${xs} g. What is the final mass, in grams, they should use?`,
  (w: Water, xs: string) => `After evaporating ${w.sample}, a student heats the dish, cools it and weighs it, again and again. The readings are ${xs} g. What mass of the dish and solids, in grams, should they record?`,
]

export const constantMass: Generator = {
  id: 'water-constant-mass',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q13'],
  build(r, slot, turn) {
    const w = WATERS[turn % WATERS.length]!
    const final = pick(r, range(30, 60, 0.01))
    // Three losses need a first of 0.05 g or more, which only a salty residue holds.
    const count = w.firstLoss[1] >= 0.05 ? pick(r, [4, 4, 5]) : 4
    const xs = heatings(r, w, final, count)
    const texts = xs.map((x) => fixed(x, 2))
    const list = `${texts.slice(0, -1).join(', ')} and ${texts.at(-1)}`
    return numeric(
      slot,
      {
        prompt: pick(r, AT_CONSTANT)(w, list),
        solution: `Heating is repeated until the mass **stops changing**. The last two readings agree at **${fixed(final, 2)} g**, so that is the constant mass — the earlier, higher readings still included water.`,
        method: ['identifies that the mass has stopped changing'],
        answer: final,
        tolerance: toPlaces(final, 2),
      },
      // Second route: the lowest reading, which only a mass that has stopped falling can repeat.
      { agrees: near(Math.min(...xs), final) && near(xs.at(-1)!, xs.at(-2)!) && xs.slice(0, -1).every((x, i) => x > xs[i + 1]! || i === xs.length - 2), detail: texts.join(', ') },
      { context: w.name, final, count, first: xs[0]! },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q17: the mass a known concentration leaves
// ---------------------------------------------------------------------------------------------

/** For q17, which evaporates to dryness without weighing a dish, larger samples too: up to 800 cm³ of a fresh water. */
const LEFT: Water[] = WATERS.map((w) => ({ ...w, volumes: [...w.volumes, ...(w.conc[0] >= 5 ? [150, 200, 250, 300, 400, 500] : [600, 750, 800])] }))

export const massLeft: Generator = {
  id: 'water-mass-left',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q17'],
  build(r, slot, turn) {
    const w = LEFT[turn % LEFT.length]!
    const { c, v, m } = byVolume(r, `water-mass-left:${w.name}`, w, (x) => x.m)
    const prompt = `${w.contains(show(c))} ${pick(r, [`What mass, in grams, would be left if ${show(v)} cm³ were evaporated to dryness?`, `What mass of solids, in grams, is left when ${show(v)} cm³ of it is evaporated to dryness?`])}`
    return numeric(
      slot,
      {
        prompt,
        solution: `$${show(v)}${CM3} = ${dm3Text(v, 0)}${DM3}$, so $${show(c)} \\times ${dm3Text(v, 0)} = $ **${show(m)} g**.`,
        method: [`converts to ${dm3Text(v, 0)} dm3`],
        answer: m,
        tolerance: toPlaces(m, Math.max(places(m), 2)),
      },
      { agrees: near(clean((m / v) * 1000), c), detail: `${show(m)} ÷ ${show(v / 1000)} = ${show((m / v) * 1000)} g/dm³` },
      { context: w.name, c, v, m },
    )
  },
}

export const waterGenerators: Generator[] = [dissolvedSolidsMass, dissolvedSolidsConcentration, constantMass, massLeft]

/** For the tests. */
export const WATER = { WATERS, LEFT, RESIDUES, evaporated }
