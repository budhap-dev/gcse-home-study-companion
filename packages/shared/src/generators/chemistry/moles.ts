import { fixed, show } from '../format.ts'
import { cap, closes, near, numeric, prose, stepped, tex } from '../physics/build.ts'
import { clearAtSigFigs, dpTolerance, sfTolerance, sigFigs, sigText } from '../physics/format.ts'
import { pick, shuffle, type Rng } from '../random.ts'
import type { Generator } from '../types.ts'
import { clean, clearOf, equation, equationTex, evenly, mr, places, powerOfTen, range, sub, tenfold, toPlaces, type Equation } from './build.ts'
import { nameOf } from './compounds.ts'

/**
 * Conservation of mass and moles (AQA 8462, 4.3.1 and 4.3.2): closed systems, gases
 * escaping, the mean and uncertainty of repeat readings, moles from a mass and back, reacting
 * masses, the Avogadro constant, kilograms to grams, and Mr from a mass and an amount. Every
 * numeric written question in the topic has a generator here; the choice and extended
 * questions stay as written.
 *
 * Every reaction is real and happens as stated (each carbonate named breaks down on heating
 * to its oxide; hydrogen peroxide gives oxygen over manganese(IV) oxide), every Mr comes from
 * build.ts, and the masses that a reaction links are worked from its equation, so 20 g of
 * calcium carbonate leaves 11.2 g of calcium oxide and never another figure. Masses fit a
 * school lab except where the context says it is a garden or a
 * technician's stock for a whole school.
 */
const TOPIC = 'conservation-of-mass-and-moles'

/** Oxygen, nitrogen, hydrogen and chlorine as the gas of molecules, so "moles of oxygen" cannot mean atoms. */
const ELEMENT_GASES = ['O2', 'N2', 'H2', 'Cl2']
const substance = (f: string) => (ELEMENT_GASES.includes(f) ? `${nameOf(f)} gas` : nameOf(f))

/** "(Mr of CO₂ = 44)", as the written prompts give it. */
const mrOf = (f: string) => `(Mr of ${sub(f)} = ${show(mr(f))})`
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
/** 10²³ in prose. */
const power = (e: number) => `10${String(e).replace(/\d/g, (d) => SUP[Number(d)]!)}`

// ---------------------------------------------------------------------------------------------
// Closed systems and gases that escape
// ---------------------------------------------------------------------------------------------

interface Closed {
  name: string
  /** The reaction and how the flask is closed. */
  setting: string
  /** What is weighed. */
  what: string
  /** Why nothing leaves. */
  why: string
}
/** Reactions done in a closed system: a gas caught in a balloon, or a precipitate in a stoppered flask. */
const CLOSED: Closed[] = [
  {
    name: 'marble chips and acid',
    setting: 'Marble chips and dilute hydrochloric acid react in a conical flask with a balloon stretched over its neck.',
    what: 'the flask, balloon and contents',
    why: 'The carbon dioxide made is caught in the balloon, so it is still weighed.',
  },
  {
    name: 'magnesium and acid',
    setting: 'Magnesium ribbon and dilute sulfuric acid react in a conical flask with a balloon stretched over its neck.',
    what: 'the flask, balloon and contents',
    why: 'The hydrogen made is caught in the balloon, so it is still weighed.',
  },
  {
    name: 'barium sulfate precipitate',
    setting: 'Barium chloride solution and sodium sulfate solution are mixed in a stoppered flask, and a white precipitate forms.',
    what: 'the flask and its contents',
    why: 'The precipitate is made of atoms that were already in the flask.',
  },
  {
    name: 'copper hydroxide precipitate',
    setting: 'Copper(II) sulfate solution and sodium hydroxide solution are mixed in a stoppered flask, and a blue precipitate forms.',
    what: 'the flask and its contents',
    why: 'The precipitate is made of atoms that were already in the flask.',
  },
]

/** The mass of a closed system is unchanged: written as q2 (a sealed flask of 82.5 g, 1 mark). */
export const closedSystemMass: Generator = {
  id: 'closed-system-mass',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q2'],
  build(r, slot, turn) {
    const c = CLOSED[turn % CLOSED.length]!
    // A conical flask of 60 to 160 g holding 25 to 110 g of reactants, each weighed to 0.1 g.
    const flask = stepped(r, 60, 160, 0.1)
    const contents = stepped(r, 25, 110, 0.1)
    const total = clean(flask + contents)
    const prompt = pick(r, [
      `${c.setting} At the start, ${c.what} have a mass of ${fixed(total, 1)} g. After the reaction is complete, what is the mass of ${c.what}, in grams?`,
      `${c.setting} Before the reaction, ${c.what} have a mass of ${fixed(total, 1)} g. What is their mass, in grams, when the reaction has finished?`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: `Nothing can enter or leave a closed system, so the mass is unchanged: **${fixed(total, 1)} g**. ${c.why}`,
        method: [],
        answer: total,
        tolerance: toPlaces(total, Math.max(places(total), 1)),
      },
      // Second route: the flask and the products, which weigh what the reactants did, added in tenths of a gram.
      { agrees: near((Math.round(flask * 10) + Math.round(contents * 10)) / 10, total), detail: `${show(flask)} g of flask and ${show(contents)} g of products` },
      { context: c.name, flask, contents },
    )
  },
}

interface Carbonate {
  carbonate: string
  oxide: string
  /** Moles of carbonate a school lab heats: about 2 to 30 g. */
  moles: number[]
}
/** Carbonates that really break down in a Bunsen flame to their oxide and carbon dioxide. */
const CARBONATES: Carbonate[] = [
  { carbonate: 'CaCO3', oxide: 'CaO', moles: range(0.03, 0.25, 0.01) },
  { carbonate: 'MgCO3', oxide: 'MgO', moles: range(0.03, 0.3, 0.01) },
  { carbonate: 'CuCO3', oxide: 'CuO', moles: range(0.02, 0.24, 0.01) },
  { carbonate: 'ZnCO3', oxide: 'ZnO', moles: range(0.02, 0.2, 0.01) },
]
/** "\mathrm{CaCO_3} \rightarrow \mathrm{CaO} + \mathrm{CO_2}", checked for balance. */
const decomposition = (c: Carbonate) => equationTex(equation(`${c.carbonate} -> ${c.oxide} + CO2`))

interface Heated {
  n: number
  m: number
  oxide: number
  co2: number
}
/** Every amount of a carbonate whose mass and products print to two decimal places at most. */
const heated = (c: Carbonate): Heated[] =>
  c.moles
    .filter((n) => !powerOfTen(n))
    .map((n) => ({ n, m: clean(n * mr(c.carbonate)), oxide: clean(n * mr(c.oxide)), co2: clean(n * mr('CO2')) }))
    .filter((h) => places(h.m) <= 2 && places(h.oxide) <= 2 && h.m >= 2 && h.m <= 30)

/** Mass of gas = mass before − mass after: written as q4 (20 g of calcium carbonate leaves 11.2 g, 1 mark). */
export const gasEscapingMass: Generator = {
  id: 'mass-of-gas-escaping',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q4'],
  build(r, slot, turn) {
    const c = CARBONATES[turn % CARBONATES.length]!
    const h = evenly(r, `mass-of-gas-escaping:${c.carbonate}`, () => heated(c).filter((h) => clearOf(h.co2, h.m, h.oxide)), (h) => h.co2)
    const [carbonate, oxide] = [nameOf(c.carbonate), nameOf(c.oxide)]
    const prompt = pick(r, [
      `Heating ${show(h.m)} g of ${carbonate} leaves ${show(h.oxide)} g of ${oxide}. What mass of carbon dioxide escaped, in grams?`,
      `A student heats ${show(h.m)} g of ${carbonate} in an open crucible until it has all broken down, leaving ${show(h.oxide)} g of ${oxide}. What mass of carbon dioxide escaped, in grams?`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: `${cap(carbonate)} breaks down as $${decomposition(c)}$, so $${show(h.m)} - ${show(h.oxide)} = ${show(h.co2)}$ g of carbon dioxide escaped. The mass has not been lost: it left as a gas.`,
        method: [],
        answer: h.co2,
        tolerance: toPlaces(h.co2, Math.max(places(h.co2), places(h.m), places(h.oxide))),
      },
      // Second route: the moles of carbonate give the same moles of CO2, at 44 g each.
      { agrees: near(clean(h.n * mr('CO2')), h.co2), detail: `${h.n} mol × 44 = ${show(h.n * 44)} g` },
      { context: nameOf(c.carbonate), n: h.n, m: h.m, oxide: h.oxide },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Repeat readings: the mean and the uncertainty
// ---------------------------------------------------------------------------------------------

interface Readings {
  name: string
  /** The resolution readings are taken to. */
  step: number
  dp: number
  lo: number
  hi: number
  unit: 'cm³' | 'g'
  /** "A student repeats … The volumes are" */
  says: string
  /** What the mean is a mean of: "volume". */
  quantity: string
  /** The largest offset from the mean, in steps, for q5. */
  reach: number
  /** Ranges, in steps, q6 may have. */
  ranges: number[]
}
const READINGS: Readings[] = [
  {
    name: 'gas syringe',
    step: 1,
    dp: 0,
    lo: 25,
    hi: 95,
    unit: 'cm³',
    says: 'A student repeats an experiment three times and collects the gas in a gas syringe. The volumes are',
    quantity: 'volume',
    reach: 4,
    ranges: [2, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  },
  {
    name: 'solid product',
    step: 0.01,
    dp: 2,
    lo: 1.2,
    hi: 9.8,
    unit: 'g',
    says: 'A student repeats an experiment three times and weighs the solid product each time. The masses are',
    quantity: 'mass',
    reach: 9,
    // A range of 3 steps has no three different readings with a clean mean.
    ranges: range(2, 16).filter((s) => s !== 3),
  },
  {
    name: 'mass lost',
    step: 0.01,
    dp: 2,
    lo: 0.3,
    hi: 2.5,
    unit: 'g',
    says: 'A student reacts marble chips with acid in an open flask three times and records the mass lost each time. The losses are',
    quantity: 'mass lost',
    reach: 6,
    ranges: range(2, 12).filter((s) => s !== 3),
  },
]
for (const k of READINGS) for (const s of k.ranges) if (!offsets(s, true).some((o) => o[2]! - o[0]! === s)) throw new Error(`${k.name}: no readings span ${s} steps`)

/** Three different whole offsets that add to zero, none bigger than `reach`; `zero` allows one of them to be 0. */
function offsets(reach: number, zero: boolean): number[][] {
  const out: number[][] = []
  for (let a = -reach; a <= reach; a++) {
    for (let b = a + 1; b <= reach; b++) {
      const c = -a - b
      if (c > b && c <= reach && (zero || (a !== 0 && b !== 0 && c !== 0))) out.push([a, b, c])
    }
  }
  return out
}
const reading = (x: number, k: Readings) => (k.dp ? fixed(x, k.dp) : show(x))
/** "\text{ cm}^3" */
const texUnit = (k: Readings) => (k.unit === 'cm³' ? '\\text{ cm}^3' : '\\text{ g}')

/** Three readings and their mean, the readings in a drawn order. */
function readingsAbout(r: Rng, k: Readings, mean: number, set: number[]): number[] {
  return shuffle(r, set).map((d) => clean(mean + d * k.step))
}

/**
 * The mean of three readings: written as q5 (18.4, 18.6 and 18.5 cm³, 1 mark). The mean is
 * drawn first and the readings around it, all three different from it and from each other,
 * so the answer is never a reading copied out.
 */
export const meanOfReadings: Generator = {
  id: 'mean-of-three-readings',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q5'],
  build(r, slot, turn) {
    const k = READINGS[turn % READINGS.length]!
    const sets = offsets(k.reach, false)
    const means = range(k.lo + k.reach * k.step, k.hi - k.reach * k.step, k.step)
    const mean = pick(r, means)
    const set = pick(r, sets)
    const xs = readingsAbout(r, k, mean, set)
    const [a, b, c] = xs.map((x) => reading(x, k))
    const prompt = pick(r, [
      `Three readings are ${a}, ${b} and ${c} ${k.unit}. What is the mean, in ${k.unit}?`,
      `${k.says} ${a}, ${b} and ${c} ${k.unit}. What is the mean ${k.quantity}, in ${k.unit}?`,
    ])
    const sum = clean(xs[0]! + xs[1]! + xs[2]!)
    return numeric(
      slot,
      {
        prompt,
        solution: `$(${a} + ${b} + ${c}) \\div 3 = ${reading(sum, k)} \\div 3 = ${reading(mean, k)}$ ${k.unit}.`,
        method: [],
        answer: mean,
        tolerance: toPlaces(mean, Math.max(places(mean), k.dp)),
      },
      // Second route: the readings' distances from the mean add to zero.
      { agrees: near(xs.reduce((t, x) => t + (x - mean), 0), 0) && near(sum / 3, mean), detail: `offsets ${set.join(', ')} steps of ${k.step}` },
      { context: k.name, mean, a: xs[0]!, b: xs[1]!, c: xs[2]! },
    )
  },
}

/**
 * Half the range: written as q6 (18.4 to 18.6 cm³, ±0.1, 2 marks). The range is drawn first
 * from the ones a context allows, then readings with that range whose mean is a clean figure,
 * so the solution can give the result as mean ± uncertainty. An odd range halves to a
 * half-step (±2.5 cm³, ±0.015 g), which keeps every context at ten or more answers.
 */
export const uncertaintyHalfRange: Generator = {
  id: 'uncertainty-half-range',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q6'],
  build(r, slot, turn) {
    const k = READINGS[turn % READINGS.length]!
    const spread = pick(r, k.ranges)
    const set = pick(r, offsets(spread, true).filter((s) => s[2]! - s[0]! === spread))
    const lowest = Math.min(...set)
    const highest = Math.max(...set)
    const means = range(k.lo - lowest * k.step, k.hi - highest * k.step, k.step)
    const u = clean((spread * k.step) / 2)
    const mean = pick(r, means.filter((m) => !set.some((d) => tenfold(u, clean(m + d * k.step))) && !tenfold(u, m)))
    const xs = readingsAbout(r, k, mean, set)
    const [a, b, c] = xs.map((x) => reading(x, k))
    const [lo, hi] = [Math.min(...xs), Math.max(...xs)]
    const width = clean(hi - lo)
    const prompt = pick(r, [
      `For the readings ${a}, ${b} and ${c} ${k.unit}, what is the uncertainty in ${k.unit}, taken as half the range?`,
      `${k.says} ${a}, ${b} and ${c} ${k.unit}. What is the uncertainty in the mean, in ${k.unit}, taken as half the range?`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: `Range $= ${reading(hi, k)} - ${reading(lo, k)} = ${reading(width, k)}$; half of that is **${show(u)} ${k.unit}**, so the result is $${reading(mean, k)} \\pm ${show(u)}${texUnit(k)}$.`,
        method: [`range $= ${reading(width, k)}$`],
        answer: u,
        tolerance: toPlaces(u, Math.max(places(u), k.dp)),
      },
      // Second route: the furthest readings sit u either side of the middle of the range.
      { agrees: near(clean((hi + lo) / 2 + u), hi) && near(width / 2, u), detail: `${reading(lo, k)} to ${reading(hi, k)}` },
      { context: k.name, mean, a: xs[0]!, b: xs[1]!, c: xs[2]!, range: width },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Moles, mass and Mr
// ---------------------------------------------------------------------------------------------

interface Family {
  name: string
  formulae: string[]
}
/** Substances for moles from a mass and back. CaCO3 (Mr 100) is left out: every mass of it is its moles with the point moved. */
const SUBSTANCES: Family[] = [
  { name: 'gases', formulae: ['CO2', 'O2', 'N2', 'Cl2', 'NH3', 'CH4', 'SO2', 'C3H8'] },
  { name: 'solids', formulae: ['CaO', 'MgO', 'NaCl', 'NaOH', 'CuSO4', 'CuO', 'Na2CO3', 'Fe2O3', 'Al2O3', 'C6H12O6', 'MgSO4', 'ZnO'] },
  { name: 'liquids', formulae: ['H2O', 'C2H5OH', 'C6H14', 'C8H18'] },
]
/** Amounts a lab weighs out: 0.02 to 0.5 mol in hundredths, then 0.6 to 4 mol in tenths. */
const AMOUNTS = [...range(0.02, 0.5, 0.01), ...range(0.6, 4, 0.1)]

interface Sample {
  formula: string
  n: number
  M: number
  m: number
}
/**
 * Every amount of every substance in a family whose mass prints to two decimal places and
 * fits a lab (0.5 to 200 g). No amount is 1 or a power of ten, and no amount is the Mr with
 * the point moved, doubled or halved.
 */
const samples = (f: Family): Sample[] =>
  f.formulae.flatMap((formula) =>
    AMOUNTS.map((n) => ({ formula, n, M: mr(formula), m: clean(n * mr(formula)) })).filter(
      (s) => !powerOfTen(s.n) && places(s.m) <= 2 && s.m >= 0.5 && s.m <= 200 && clearOf(s.n, s.M) && !near(s.n * s.M, s.n + s.M),
    ),
  )

/** n = m ÷ Mr: written as q7 (88 g of CO2, 2 mol, 1 mark). */
export const molesFromMass: Generator = {
  id: 'moles-from-mass',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q7'],
  build(r, slot, turn) {
    const f = SUBSTANCES[turn % SUBSTANCES.length]!
    const s = evenly(r, `moles-from-mass:${f.name}`, () => samples(f).filter((s) => clearOf(s.n, s.m)), (s) => s.n)
    const name = substance(s.formula)
    const prompt = pick(r, [
      `How many moles are there in ${show(s.m)} g of ${name}? ${mrOf(s.formula)}`,
      `A sample of ${name} has a mass of ${show(s.m)} g. How many moles of ${name} is this? ${mrOf(s.formula)}`,
      `Calculate the number of moles in ${show(s.m)} g of ${name}. ${mrOf(s.formula)}`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: `$\\dfrac{${show(s.m)}}{${show(s.M)}} = ${show(s.n)}$ mol.`,
        method: [],
        answer: s.n,
        tolerance: toPlaces(s.n, Math.max(places(s.n), places(s.m))),
      },
      { agrees: near(clean(s.n * s.M), s.m), detail: `${s.n} × ${s.M} = ${show(s.n * s.M)} g` },
      { context: f.name, formula: s.formula, n: s.n, m: s.m },
    )
  },
}

/** m = n × Mr: written as q8 (0.5 mol of CaO, 28 g, 1 mark). */
export const massFromMoles: Generator = {
  id: 'mass-from-moles',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q8'],
  build(r, slot, turn) {
    const f = SUBSTANCES[turn % SUBSTANCES.length]!
    const s = evenly(r, `mass-from-moles:${f.name}`, () => samples(f), (s) => s.m)
    const name = substance(s.formula)
    const prompt = pick(r, [
      `What is the mass, in grams, of ${show(s.n)} moles of ${name}? ${mrOf(s.formula)}`,
      `A reaction needs ${show(s.n)} moles of ${name}. What mass of ${name} is this, in grams? ${mrOf(s.formula)}`,
      `Calculate the mass, in grams, of ${show(s.n)} moles of ${name}. ${mrOf(s.formula)}`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: closes(`${show(s.n)} \\times ${show(s.M)}`, s.m, 'g'),
        method: [],
        answer: s.m,
        tolerance: toPlaces(s.m, Math.max(places(s.m), places(s.n))),
      },
      { agrees: near(s.m / s.M, s.n), detail: `${show(s.m)} ÷ ${s.M} = ${show(s.m / s.M)} mol` },
      { context: f.name, formula: s.formula, n: s.n, m: s.m },
    )
  },
}

/** A carbonate heated, and which product the question asks about. */
interface Decomposition {
  name: string
  c: Carbonate
  product: string
  /** "is left" for the oxide, "is given off" for the gas. */
  verb: string
}
const DECOMPOSITIONS: Decomposition[] = CARBONATES.flatMap((c) => [
  { name: `${nameOf(c.carbonate)} to ${nameOf(c.oxide)}`, c, product: c.oxide, verb: 'is left' },
  { name: `${nameOf(c.carbonate)} to carbon dioxide`, c, product: 'CO2', verb: 'is given off' },
])

/**
 * Reacting masses through a 1 : 1 equation: written as q10 (25 g of CaCO3 leaves 14 g of
 * CaO, 2 marks). The product asked for is the oxide or the carbon dioxide, rotating.
 */
export const reactingMassDecomposition: Generator = {
  id: 'reacting-mass-from-decomposition',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q10'],
  build(r, slot, turn) {
    const d = DECOMPOSITIONS[turn % DECOMPOSITIONS.length]!
    const { c, product } = d
    const answerOf = (h: Heated) => (product === 'CO2' ? h.co2 : h.oxide)
    const other = (h: Heated) => (product === 'CO2' ? h.oxide : h.co2)
    const h = evenly(r, `reacting-mass:${d.name}`, () => heated(c).filter((h) => clearOf(answerOf(h), h.m, mr(c.carbonate), mr(product))), answerOf)
    const ans = answerOf(h)
    const [Mc, Mp] = [mr(c.carbonate), mr(product)]
    const masses = `(Mr: ${sub(c.carbonate)} = ${show(Mc)}, ${sub(product)} = ${show(Mp)})`
    const prompt = pick(r, [
      `Heating ${show(h.m)} g of ${nameOf(c.carbonate)} fully decomposes it. What mass of ${nameOf(product)} ${d.verb}, in grams? ${masses}`,
      `A student heats ${show(h.m)} g of ${nameOf(c.carbonate)} until it has all decomposed. What mass of ${nameOf(product)} ${d.verb}, in grams? ${masses}`,
    ])
    const scale = `\\dfrac{${show(h.m)}}{${show(Mc)}}`
    return numeric(
      slot,
      {
        prompt,
        solution: `The equation $${decomposition(c)}$ gives one ${sub(product)} for each ${sub(c.carbonate)}, so ${closes(`${scale} \\times ${show(Mp)}`, ans, 'g')}`,
        method: [`scales by $${scale}$`],
        answer: ans,
        tolerance: toPlaces(ans, Math.max(places(ans), places(h.m))),
      },
      // Second route: conservation of mass — the carbonate less the other product.
      { agrees: near(clean(h.m - other(h)), ans), detail: `${show(h.m)} − ${show(other(h))} = ${show(h.m - other(h))} g` },
      { context: d.name, n: h.n, m: h.m },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// The Avogadro constant
// ---------------------------------------------------------------------------------------------

interface Particles {
  name: string
  /** "molecules", "atoms" */
  particles: string
  formulae: string[]
  /** "carbon dioxide", "oxygen gas, O₂", "magnesium" */
  of: (f: string) => string
}
const PARTICLES: Particles[] = [
  { name: 'molecules of a compound', particles: 'molecules', formulae: ['CO2', 'H2O', 'NH3', 'CH4', 'SO2'], of: (f) => nameOf(f) },
  { name: 'molecules of an element', particles: 'molecules', formulae: ELEMENT_GASES, of: (f) => `${substance(f)}, ${sub(f)}` },
  { name: 'atoms of a metal', particles: 'atoms', formulae: ['Mg', 'Fe', 'Cu', 'Zn', 'Al'], of: (f) => nameOf(f) },
]
const AVOGADRO = 6.02
/** Amounts to two significant figures: 0.02 to 0.16 mol in steps of 0.005, then 0.17 to 1.6 mol. */
const AVOGADRO_AMOUNTS = [...range(0.02, 0.16, 0.005), ...range(0.17, 0.99, 0.01), ...range(1.1, 1.6, 0.1)]
interface Count {
  n: number
  /** n × 6.02 × 10²³ written as mantissa × 10^e. */
  mantissa: number
  e: number
  answer: number
}
/**
 * Every amount whose particle count rounds cleanly to three significant figures and does not
 * end in a 0 the answer box would drop (0.2 mol gives 1.204, which is 1.20). No amount is 1, a
 * power of ten, 2 or 0.5 with the point moved: those give 6.02 itself, or it doubled or halved.
 */
const COUNTS: Count[] = AVOGADRO_AMOUNTS.flatMap((n) => {
  const product = clean(n * AVOGADRO)
  const shift = Math.floor(Math.log10(product))
  const mantissa = clean(product / 10 ** shift)
  const answer = sigFigs(mantissa, 3)
  const ok = !powerOfTen(n) && !tenfold(n, 2) && !tenfold(n, 0.5) && clearAtSigFigs(mantissa, 3) && sigText(answer, 3) === String(answer) && !tenfold(answer, AVOGADRO)
  return ok ? [{ n, mantissa, e: 23 + shift, answer }] : []
})

/** N = n × 6.02 × 10²³: written as q11 (0.2 mol of CO2, 2 marks). */
export const avogadroParticles: Generator = {
  id: 'particles-from-moles',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q11'],
  build(r, slot, turn) {
    const p = PARTICLES[turn % PARTICLES.length]!
    const f = pick(r, p.formulae)
    const c = evenly(r, 'particles-from-moles', () => COUNTS, (c) => c.answer)
    const prompt = pick(r, [
      `How many ${p.particles} are there in ${show(c.n)} moles of ${p.of(f)}? Give your answer in standard form to three significant figures, as a multiple of ${power(c.e)}.`,
      `A sample contains ${show(c.n)} moles of ${p.of(f)}. How many ${p.particles} does it contain? Give your answer in standard form to three significant figures, as a multiple of ${power(c.e)}.`,
    ])
    const text = sigText(c.answer, 3)
    // Second route: whole-number arithmetic, n in thousandths times 602, then the point placed.
    const second = sigFigs((Math.round(c.n * 1000) * 602) / 10 ** (5 + c.e - 23), 3)
    return numeric(
      slot,
      {
        prompt,
        solution: `$${show(c.n)} \\times 6.02 \\times 10^{23} = ${show(c.mantissa)} \\times 10^{${c.e}}$, which is $\\mathbf{${text} \\times 10^{${c.e}}}$ ${p.particles} to three significant figures.`,
        method: [`multiplies ${show(c.n)} by the Avogadro constant`],
        answer: c.answer,
        tolerance: sfTolerance(c.answer, 3),
      },
      { agrees: second === c.answer, detail: `${Math.round(c.n * 1000)} × 602 = ${Math.round(c.n * 1000) * 602}` },
      { context: p.name, formula: f, n: c.n, e: c.e },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Kilograms to grams
// ---------------------------------------------------------------------------------------------

interface Bulk {
  name: string
  /** Kilograms the setting holds. */
  kg: [number, number]
  /** The places the kilograms are weighed to: a garden sack to 0.1 kg, a technician's balance to 0.01 kg. */
  dp: number
  formulae: string[]
  /** The sentence that sets it: "A gardener spreads 6.4 kg of ammonium nitrate fertiliser on a field." */
  setting: (kg: string, f: string) => string
  /** The question after the setting. */
  ask: (f: string) => string
}
const FERTILISER: Record<string, string> = {
  NH4NO3: 'ammonium nitrate fertiliser on a vegetable plot',
  '(NH4)2SO4': 'ammonium sulfate fertiliser on a vegetable plot',
  'CO(NH2)2': 'urea fertiliser on a vegetable plot',
  'Ca(OH)2': 'calcium hydroxide (slaked lime) on a vegetable plot to neutralise acid soil',
}
const BULK: Bulk[] = [
  {
    name: 'garden',
    kg: [5, 25],
    dp: 1,
    formulae: Object.keys(FERTILISER),
    setting: (kg, f) => `A gardener spreads ${kg} kg of ${FERTILISER[f]}.`,
    ask: (f) => `How many moles of ${nameOf(f)} is this?`,
  },
  {
    name: 'prep room',
    kg: [0.5, 5],
    dp: 2,
    formulae: ['NaCl', 'NaOH', 'Na2CO3', 'MgSO4', 'NaHCO3', 'Na2SO4'],
    setting: (kg, f) => `A technician weighs out ${kg} kg of ${nameOf(f)} for the school's chemistry classes.`,
    ask: (f) => `How many moles of ${nameOf(f)} is this?`,
  },
]
interface Bulked {
  formula: string
  n: number
  M: number
  g: number
  kg: number
}
/**
 * Every whole number of moles whose mass, in kilograms, has no more places than the setting
 * weighs to and lies within its range. The moles are never a power of ten, nor the kilograms or the Mr with the point
 * moved: 2 kg of calcium carbonate (Mr 100) is 20 mol, the 2 with a 0 added.
 */
const bulked = (b: Bulk): Bulked[] =>
  b.formulae.flatMap((formula) => {
    const M = mr(formula)
    const out: Bulked[] = []
    for (let n = 5; n <= 500; n++) {
      const g = clean(n * M)
      const kg = clean(g / 1000)
      if (places(kg) > b.dp || kg < b.kg[0] || kg > b.kg[1] || powerOfTen(n) || tenfold(n, kg) || tenfold(n, M)) continue
      out.push({ formula, n, M, g, kg })
    }
    return out
  })

/** n = (kg × 1000) ÷ Mr: written as q12 (2 kg of CaCO3, 20 mol, 2 marks). */
export const molesFromKilograms: Generator = {
  id: 'moles-from-kilograms',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q12'],
  build(r, slot, turn) {
    const b = BULK[turn % BULK.length]!
    // The substance first, then its amount: urea's many clean amounts would otherwise carry the garden.
    const formula = pick(r, b.formulae)
    const s = evenly(r, `moles-from-kilograms:${b.name}:${formula}`, () => bulked(b).filter((s) => s.formula === formula), (s) => s.n)
    const kg = show(s.kg)
    const masses = `(Mr = ${show(s.M)})`
    const prompt = pick(r, [`${b.setting(kg, s.formula)} ${b.ask(s.formula)} ${masses}`, `How many moles are there in ${kg} kg of ${nameOf(s.formula)}? ${masses}`])
    return numeric(
      slot,
      {
        prompt,
        solution: `$${kg}\\text{ kg} = ${tex(s.g)}\\text{ g}$, so $\\dfrac{${tex(s.g)}}{${show(s.M)}} = ${s.n}$ mol. Failing to convert to grams gives ${show(s.n / 1000)}, a thousand times too small.`,
        method: [`converts ${kg} kg to ${prose(s.g)} g`],
        answer: s.n,
        tolerance: 0,
      },
      { agrees: near(clean((s.n * s.M) / 1000), s.kg), detail: `${s.n} × ${s.M} = ${show(s.n * s.M)} g` },
      { context: b.name, formula: s.formula, n: s.n, kg: s.kg },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Moles of gas from a mass lost
// ---------------------------------------------------------------------------------------------

interface Escape {
  name: string
  gas: string
  /** The balanced equation. */
  equation: Equation
  setting: string
  /** "flask", "crucible" */
  vessel: string
  /** Mass of the vessel and contents at the start. */
  start: [number, number]
  moles: number[]
}
const ESCAPES: Escape[] = [
  {
    name: 'marble chips and acid',
    gas: 'CO2',
    equation: equation('CaCO3 + 2HCl -> CaCl2 + H2O + CO2'),
    setting: 'Marble chips react with dilute hydrochloric acid in an open flask.',
    vessel: 'flask',
    start: [90, 200],
    moles: range(0.005, 0.1, 0.005),
  },
  {
    name: 'hydrogen peroxide',
    gas: 'O2',
    equation: equation('2H2O2 -> 2H2O + O2'),
    setting: 'Hydrogen peroxide solution decomposes in an open flask, with a little manganese(IV) oxide as a catalyst.',
    vessel: 'flask',
    start: [90, 200],
    moles: range(0.005, 0.06, 0.005),
  },
  {
    name: 'heating copper carbonate',
    gas: 'CO2',
    equation: equation('CuCO3 -> CuO + CO2'),
    setting: 'A student heats copper(II) carbonate in an open crucible until it has all broken down.',
    vessel: 'crucible',
    start: [18, 40],
    moles: range(0.005, 0.05, 0.005),
  },
]
interface Lost {
  n: number
  loss: number
}
const losses = (e: Escape): Lost[] =>
  e.moles
    .map((n) => ({ n, loss: clean(n * mr(e.gas)) }))
    .filter((l) => !powerOfTen(l.n) && places(l.loss) <= 2 && clearOf(l.n, l.loss, mr(e.gas)))

/**
 * n = mass lost ÷ Mr of the gas: written as q15 (0.88 g of CO2 lost, 0.02 mol, 2 marks).
 * Half the prompts give the loss, as the written one does; the rest give the masses before
 * and after, and the subtraction is part of the method mark.
 */
export const molesFromMassLost: Generator = {
  id: 'moles-from-mass-lost',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q15'],
  build(r, slot, turn) {
    const e = ESCAPES[turn % ESCAPES.length]!
    const l = evenly(r, `moles-from-mass-lost:${e.name}`, () => losses(e), (l) => l.n)
    const gas = nameOf(e.gas)
    const M = mr(e.gas)
    const both = r() < 0.5
    const before = stepped(r, e.start[0], e.start[1], 0.01)
    const after = clean(before - l.loss)
    const told = both
      ? `The ${e.vessel} and its contents have a mass of ${fixed(before, 2)} g at the start and ${fixed(after, 2)} g at the end, and all of the mass lost is ${gas}.`
      : `The ${e.vessel} and its contents lose ${show(l.loss)} g, all of it ${gas}.`
    const prompt = `${e.setting} ${told} How many moles of ${gas} were produced? ${mrOf(e.gas)}`
    const lost = both ? `$${fixed(before, 2)} - ${fixed(after, 2)} = ${show(l.loss)}$ g` : `${show(l.loss)} g`
    return numeric(
      slot,
      {
        prompt,
        solution: `The mass lost is the mass of gas that escaped, ${lost}, so $\\dfrac{${show(l.loss)}}{${show(M)}} = ${show(l.n)}$ mol. The equation is $${equationTex(e.equation)}$.`,
        method: [both ? `uses the mass lost, $${fixed(before, 2)} - ${fixed(after, 2)} = ${show(l.loss)}$ g, as the mass of gas` : 'uses the mass lost as the mass of gas'],
        answer: l.n,
        // Amounts come in steps of 0.005 mol, so three places even when 0.050 prints as 0.05.
        tolerance: toPlaces(l.n, Math.max(places(l.n), 3)),
      },
      { agrees: near(clean(l.n * M), l.loss) && near(clean(before - after), l.loss), detail: `${show(l.n)} × ${show(M)} = ${show(l.n * M)} g` },
      { context: e.name, n: l.n, loss: l.loss, before, given: both ? 'before and after' : 'loss' },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Mr from a mass and an amount
// ---------------------------------------------------------------------------------------------

interface Unknown {
  name: string
  /** "gas", "solid compound" */
  kind: string
  formulae: string[]
}
/** HCl is not among the gases: every question names it hydrochloric acid, the solution. */
const UNKNOWNS: Unknown[] = [
  { name: 'gas', kind: 'gas', formulae: ['CO2', 'NH3', 'CH4', 'SO2', 'Cl2', 'O2', 'N2', 'C2H6', 'H2S', 'NO2', 'C4H10', 'C3H8'] },
  { name: 'solid', kind: 'solid compound', formulae: ['MgO', 'NaCl', 'NaOH', 'Na2CO3', 'CaO', 'CuO', 'CuSO4', 'Fe2O3', 'Al2O3', 'ZnO', 'MgSO4', 'KNO3', 'C6H12O6'] },
]
const UNKNOWN_AMOUNTS = range(0.02, 0.48, 0.01)
interface Weighed {
  formula: string
  n: number
  M: number
  m: number
}
/**
 * Every amount and compound whose mass prints to two decimal places at most. The amount is
 * never a power of ten (4.4 g in 0.1 mol is 44 with the point moved) nor 0.5 or 0.25, which
 * turn the division into doubling or quadrupling the mass, and the mass is never the amount
 * with the point moved: calcium carbonate (Mr 100) is left out, since 0.26 mol of it is 26 g.
 */
const weighed = (u: Unknown): Weighed[] =>
  u.formulae.flatMap((formula) =>
    UNKNOWN_AMOUNTS.map((n) => ({ formula, n, M: mr(formula), m: clean(n * mr(formula)) })).filter(
      (w) => !powerOfTen(w.n) && !tenfold(w.n, 0.5) && !tenfold(w.n, 0.25) && !tenfold(w.m, w.n) && places(w.m) <= 2 && w.m >= 0.5 && clearOf(w.M, w.m, w.n),
    ),
  )

/** Mr = m ÷ n: written as q17 (4.4 g in 0.1 mol, Mr 44, 2 marks). */
export const mrFromMassAndMoles: Generator = {
  id: 'relative-formula-mass-from-moles',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q17'],
  build(r, slot, turn) {
    const u = UNKNOWNS[turn % UNKNOWNS.length]!
    const w = evenly(r, `mr-from-moles:${u.name}`, () => weighed(u), (w) => w.M)
    const [n, m] = [show(w.n), show(w.m)]
    const prompt = pick(r, [
      `A sample of a ${u.kind} contains ${n} mol and has a mass of ${m} g. What is its relative formula mass?`,
      `The mass of ${n} mol of a ${u.kind} is ${m} g. What is its relative formula mass?`,
      `A student finds that ${n} mol of an unknown ${u.kind} has a mass of ${m} g. What is the relative formula mass of the ${u.kind}?`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: `Rearranging, $M_r = \\dfrac{\\text{mass}}{\\text{moles}} = \\dfrac{${m}}{${n}} = ${show(w.M)}$. ${cap(nameOf(w.formula))}, ${sub(w.formula)}, has this $M_r$, for example.`,
        method: [`rearranges to mass divided by moles: $\\dfrac{${m}}{${n}}$`],
        answer: w.M,
        tolerance: dpTolerance(w.M),
      },
      { agrees: near(w.m / w.M, w.n), detail: `${m} ÷ ${show(w.M)} = ${show(w.m / w.M)} mol` },
      { context: u.name, formula: w.formula, n: w.n, m: w.m },
    )
  },
}

export const moleGenerators: Generator[] = [
  closedSystemMass,
  gasEscapingMass,
  meanOfReadings,
  uncertaintyHalfRange,
  molesFromMass,
  massFromMoles,
  reactingMassDecomposition,
  avogadroParticles,
  molesFromKilograms,
  molesFromMassLost,
  mrFromMassAndMoles,
]

/** For tests. */
export const MOLE_POOLS = { CARBONATES, READINGS, SUBSTANCES, COUNTS, BULK, ESCAPES, UNKNOWNS, offsets, decomposition, called: nameOf }
