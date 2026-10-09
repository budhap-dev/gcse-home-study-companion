import { clearOfHalf, fixed, show } from '../format.ts'
import { atMost, cap, figures, near, numeric, prose, tex } from '../physics/build.ts'
import { sfTolerance } from '../physics/format.ts'
import { pick } from '../random.ts'
import type { Generator } from '../types.ts'
import { clean, clearOf, coef, distinct, equation, equationTex, evenly, mathrm, mr, noOnes, places, powerOfTen, range, sub, tenfold, toPlaces, written, type Equation } from './build.ts'
import { nameOf } from './compounds.ts'

/**
 * Gas volumes (AQA 8462, 4.3.5, chemistry only, higher tier): one mole of any gas occupies
 * 24 dm³ at room temperature and pressure. Every numeric written question in the topic has a
 * generator here except q1, which asks for the molar volume itself: there is nothing to vary.
 *
 * None of the written slots states the molar volume (students recall it), so no generated
 * prompt does either; each says "at RTP" where the written one does. The cm³ slots keep their
 * conversion: 24 000 cm³ per mole is a method mark, as written. Every gas named is a gas at
 * 20 °C (no nitrogen dioxide, which boils at 21 °C, and no sulfur trioxide), every equation is
 * real and checked for balance when this file loads, and every Mr and Ar comes from `mr()`.
 *
 * Coincidences the figures avoid: calcium carbonate (Mr 100) and magnesium (Ar 24) are left out
 * wherever a mass of them is given or asked, since every mass of the first is its moles with
 * the point moved and every mass of magnesium in grams equals its hydrogen volume in dm³ (and
 * its cm³ with the point moved). An amount of 1 or a power of ten is never drawn.
 */
const TOPIC = 'gas-volumes'

/** Monatomic gases, which compounds.ts does not name. */
const NOBLE: Record<string, string> = { He: 'helium', Ne: 'neon', Ar: 'argon' }
const called = (f: string) => NOBLE[f] ?? nameOf(f)
/** One atom of one element (a metal) takes an Ar; everything else an Mr. */
const massOf = (f: string) => (/^[A-Z][a-z]?$/.test(f) ? `(Ar of ${f} = ${show(mr(f))})` : `(Mr of ${sub(f)} = ${show(mr(f))})`)
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
/**
 * The marking room for an answer the prompt asks no precision of: half a unit in the last place
 * of the answer or its givens, and, where the answer has more than three significant figures,
 * room for a student who gives three (42.72 dm³ marked right as 42.7). sfTolerance stays under
 * the release check's 2% cap.
 */
const room = (x: number, dp: number) => (figures(x) > 3 ? Math.max(toPlaces(x, dp), sfTolerance(x, 3)) : toPlaces(x, dp))

// ---------------------------------------------------------------------------------------------
// q2: moles to a volume in dm³
// ---------------------------------------------------------------------------------------------

interface Family {
  name: string
  formulae: string[]
}
/** Gases at room temperature, in three families that rotate. */
const MOLAR_FAMILIES: Family[] = [
  { name: 'elements', formulae: ['N2', 'O2', 'H2', 'Cl2'] },
  { name: 'compounds', formulae: ['CO2', 'CH4', 'NH3', 'SO2', 'C3H8'] },
  { name: 'noble gases', formulae: ['He', 'Ne', 'Ar'] },
]
/** Amounts from 0.02 to 0.98 mol in hundredths and 1.1 to 6 mol in tenths: never 1 or a power of ten. */
const MOLAR_AMOUNTS = [...range(0.02, 0.98, 0.01), ...range(1.1, 6, 0.1)].filter((n) => !powerOfTen(n))

/** V = n × 24: written as q2 (3 moles of nitrogen, 72 dm³, 1 mark). */
export const volumeFromMoles: Generator = {
  id: 'gas-volume-from-moles',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q2'],
  build(r, slot, turn) {
    const f = MOLAR_FAMILIES[turn % MOLAR_FAMILIES.length]!
    const formula = pick(r, f.formulae)
    const n = pick(r, MOLAR_AMOUNTS)
    const V = clean(n * 24)
    const gas = called(formula)
    const prompt = pick(r, [
      `What volume, in dm³, does ${show(n)} moles of ${gas} occupy at RTP?`,
      `Calculate the volume, in dm³, of ${show(n)} moles of ${gas} at RTP.`,
      `A sample of ${gas} contains ${show(n)} moles. What volume, in dm³, does it occupy at RTP?`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: `$${show(n)} \\times 24 = $ **${show(V)} dm³**.`,
        method: [],
        answer: V,
        tolerance: room(V, Math.max(places(V), places(n))),
      },
      // Second route: the volume shared back out at 24 dm³ a mole gives the amount.
      { agrees: near(V / 24, n), detail: `${show(V)} ÷ 24 = ${show(V / 24)} mol` },
      { context: f.name, formula, n },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q4: a volume in dm³ to moles
// ---------------------------------------------------------------------------------------------

interface Sample {
  name: string
  /** Volumes in dm³ the setting holds. */
  volumes: number[]
  gases: string[]
  ask: (V: string, gas: string) => string[]
}
/**
 * Volumes are multiples of 0.6 dm³, so every amount is exact to three places (0.025 mol steps).
 * A party balloon holds 3 to 15 dm³.
 */
const SAMPLES: Sample[] = [
  {
    name: 'any gas',
    volumes: range(1.2, 96, 0.6),
    gases: ['gas'],
    ask: (V) => [`How many moles of gas are there in ${V} dm³ at RTP?`, `A sample of gas has a volume of ${V} dm³ at RTP. How many moles of gas does it contain?`],
  },
  {
    name: 'named gas',
    volumes: range(1.2, 48, 0.6),
    gases: ['CO2', 'O2', 'N2', 'CH4', 'NH3', 'H2'],
    ask: (V, gas) => [`${V} dm³ of ${gas} is collected at RTP. How many moles of ${gas} is this?`, `How many moles of ${gas} are there in ${V} dm³ of the gas at RTP?`],
  },
  {
    name: 'party balloon',
    volumes: range(3, 15, 0.6),
    gases: ['He'],
    ask: (V) => [
      `A party balloon is filled with ${V} dm³ of helium at RTP. How many moles of helium does it hold?`,
      `A helium balloon holds ${V} dm³ of gas at RTP. How many moles of helium are in the balloon?`,
      `How many moles of helium does a balloon hold if it is filled with ${V} dm³ of helium at RTP?`,
    ],
  },
]

/** n = V ÷ 24: written as q4 (48 dm³, 2 mol, 1 mark). */
export const molesFromVolume: Generator = {
  id: 'gas-moles-from-volume',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q4'],
  build(r, slot, turn) {
    const s = SAMPLES[turn % SAMPLES.length]!
    const wording = Math.floor(r() * 3)
    const V = evenly(r, `gas-moles-from-volume:${s.name}`, () => s.volumes.filter((v) => !powerOfTen(v / 24) && clearOf(clean(v / 24), v)), (v) => v)
    const n = clean(V / 24)
    const g = pick(r, s.gases)
    const gas = g === 'gas' ? 'gas' : called(g)
    return numeric(
      slot,
      {
        prompt: s.ask(show(V), gas)[wording % s.ask(show(V), gas).length]!,
        solution: `$\\dfrac{${show(V)}}{24} = ${show(n)}$ mol.`,
        method: [],
        answer: n,
        tolerance: room(n, Math.max(places(n), places(V))),
      },
      { agrees: near(n * 24, V), detail: `${show(n)} × 24 = ${show(n * 24)} dm³` },
      { context: s.name, V, gas: g },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q5 and q7: a mass to a volume and back, through moles
// ---------------------------------------------------------------------------------------------

/** Gases with an Mr to print. Hydrogen is left out: its masses are a few tenths of a gram. */
const MASS_FAMILIES: Family[] = [
  { name: 'element gases', formulae: ['O2', 'N2', 'Cl2'] },
  { name: 'fuel gases', formulae: ['CH4', 'C2H6', 'C3H8', 'C4H10'] },
  { name: 'other compounds', formulae: ['CO2', 'NH3', 'SO2', 'H2S'] },
]
interface Weighed {
  formula: string
  M: number
  n: number
  m: number
  V: number
}
/**
 * Every amount from 0.05 to 2.5 mol, in hundredths, whose mass prints to two places at most and
 * lies from 0.5 to 100 g. The amount is never a power of ten (16 g of oxygen in 0.5 mol is fine;
 * 3.2 g in 0.1 mol is the Mr with the point moved), and the volume is none of the mass, the Mr
 * or the amount with the point moved, doubled or halved: 1.25 mol of ethane is 30 dm³, its Mr.
 * Nor is either answer the other given plus or minus the Mr.
 */
const weighed = (f: Family): Weighed[] =>
  f.formulae.flatMap((formula) => {
    const M = mr(formula)
    return range(0.05, 2.5, 0.01)
      .map((n) => ({ formula, M, n, m: clean(n * M), V: clean(n * 24) }))
      .filter(
        (w) =>
          !powerOfTen(w.n) &&
          places(w.m) <= 2 &&
          w.m >= 0.5 &&
          w.m <= 100 &&
          distinct(w.m, w.M, w.V) &&
          clearOf(w.V, w.m, w.M, w.n) &&
          clearOf(w.m, w.V, w.M, w.n) &&
          // Neither answer is the other given plus or minus the Mr, which adding or subtracting would reach.
          ![w.m + w.M, w.m - w.M, w.M - w.m].some((x) => near(x, w.V)) &&
          ![w.V + w.M, w.V - w.M, w.M - w.V].some((x) => near(x, w.m)),
      )
  })

/** V = (m ÷ Mr) × 24: written as q5 (16 g of oxygen, 0.5 mol, 12 dm³, 2 marks). */
export const volumeFromMass: Generator = {
  id: 'gas-volume-from-mass',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q5'],
  build(r, slot, turn) {
    const f = MASS_FAMILIES[turn % MASS_FAMILIES.length]!
    const formula = pick(r, f.formulae)
    const w = evenly(r, `gas-volume-from-mass:${formula}`, () => weighed(f).filter((x) => x.formula === formula), (x) => x.V)
    const gas = called(formula)
    const prompt = pick(r, [
      `What volume, in dm³ at RTP, does ${show(w.m)} g of ${gas} occupy? ${massOf(formula)}`,
      `A sample of ${gas} has a mass of ${show(w.m)} g. What volume does it occupy, in dm³ at RTP? ${massOf(formula)}`,
      `Calculate the volume, in dm³ at RTP, of ${show(w.m)} g of ${gas}. ${massOf(formula)}`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: `Moles $= \\dfrac{${show(w.m)}}{${show(w.M)}} = ${show(w.n)}$; volume $= ${show(w.n)} \\times 24 = $ **${show(w.V)} dm³**.`,
        method: [`${show(w.n)} mol`],
        answer: w.V,
        tolerance: room(w.V, Math.max(places(w.V), places(w.m))),
      },
      // Second route: the volume of one gram, 24 ÷ Mr, times the mass.
      { agrees: near((24 / w.M) * w.m, w.V), detail: `24 ÷ ${show(w.M)} × ${show(w.m)} = ${show((24 / w.M) * w.m)} dm³` },
      { context: f.name, formula, n: w.n, m: w.m },
    )
  },
}

/** m = (V ÷ 24) × Mr: written as q7 (6 dm³ of carbon dioxide, 0.25 mol, 11 g, 2 marks). */
export const massFromVolume: Generator = {
  id: 'gas-mass-from-volume',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q7'],
  build(r, slot, turn) {
    const f = MASS_FAMILIES[turn % MASS_FAMILIES.length]!
    const formula = pick(r, f.formulae)
    const w = evenly(r, `gas-mass-from-volume:${formula}`, () => weighed(f).filter((x) => x.formula === formula), (x) => x.m)
    const gas = called(formula)
    const prompt = pick(r, [
      `What mass, in grams, is ${show(w.V)} dm³ of ${gas} at RTP? ${massOf(formula)}`,
      `A sample of ${gas} has a volume of ${show(w.V)} dm³ at RTP. What is its mass, in grams? ${massOf(formula)}`,
      `Calculate the mass, in grams, of ${show(w.V)} dm³ of ${gas} at RTP. ${massOf(formula)}`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: `Moles $= \\dfrac{${show(w.V)}}{24} = ${show(w.n)}$; mass $= ${show(w.n)} \\times ${show(w.M)} = $ **${show(w.m)} g**.`,
        method: [`${show(w.n)} mol`],
        answer: w.m,
        tolerance: room(w.m, Math.max(places(w.m), places(w.V))),
      },
      // Second route: the mass of one mole spread over 24 dm³, times the volume.
      { agrees: near((w.M / 24) * w.V, w.m), detail: `${show(w.M)} ÷ 24 × ${show(w.V)} = ${show((w.M / 24) * w.V)} g` },
      { context: f.name, formula, n: w.n, V: w.V },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q8: cm³ to moles
// ---------------------------------------------------------------------------------------------

interface Collected {
  name: string
  /** Volumes in cm³ the apparatus holds, each an exact number of 0.00025 mol. */
  volumes: number[]
  /** The setting for each gas, ending where the volume follows. */
  settings: { gas: string; say: (V: number) => string; ask: string }[]
}
const COLLECTED: Collected[] = [
  {
    name: 'gas syringe',
    // A 100 cm³ syringe, in steps of 6 cm³.
    volumes: range(30, 96, 6),
    settings: [
      { gas: 'H2', say: (V) => `Magnesium ribbon reacts with dilute hydrochloric acid, and a gas syringe collects ${V} cm³ of hydrogen at RTP.`, ask: 'How many moles of hydrogen are collected?' },
      { gas: 'CO2', say: (V) => `Marble chips react with dilute hydrochloric acid, and a gas syringe collects ${V} cm³ of carbon dioxide at RTP.`, ask: 'How many moles of carbon dioxide are collected?' },
      {
        gas: 'O2',
        say: (V) => `Hydrogen peroxide solution decomposes over a manganese(IV) oxide catalyst, and a gas syringe collects ${V} cm³ of oxygen at RTP.`,
        ask: 'How many moles of oxygen are collected?',
      },
    ],
  },
  {
    name: 'measuring cylinder',
    // A 250 cm³ cylinder, in steps of 12 cm³; 240 cm³ is 0.01 mol, a power of ten.
    volumes: range(60, 228, 12),
    settings: [
      {
        gas: 'H2',
        say: (V) => `Zinc reacts with dilute sulfuric acid, and the hydrogen is collected over water in an upturned measuring cylinder. It collects ${V} cm³ of hydrogen at RTP.`,
        ask: 'How many moles of hydrogen are collected?',
      },
      {
        gas: 'O2',
        say: (V) => `Hydrogen peroxide solution decomposes over a manganese(IV) oxide catalyst, and the oxygen is collected over water in an upturned measuring cylinder. It collects ${V} cm³ of oxygen at RTP.`,
        ask: 'How many moles of oxygen are collected?',
      },
    ],
  },
  {
    name: 'gas jar',
    volumes: range(252, 504, 12),
    settings: ['O2', 'CO2', 'N2', 'Cl2'].map((gas) => ({
      gas,
      say: (V: number) => `A gas jar holds ${V} cm³ of ${nameOf(gas)} at RTP.`,
      ask: `How many moles of ${nameOf(gas)} does it hold?`,
    })),
  },
]

/** n = V ÷ 24 000 with V in cm³: written as q8 (120 cm³ in a gas syringe, 0.005 mol, 2 marks). */
export const molesFromCm3: Generator = {
  id: 'gas-moles-from-cm3',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q8'],
  build(r, slot, turn) {
    const c = COLLECTED[turn % COLLECTED.length]!
    const s = pick(r, c.settings)
    const V = evenly(r, `gas-moles-from-cm3:${c.name}`, () => c.volumes.filter((v) => !powerOfTen(v / 24000) && clearOf(clean(v / 24000), v)), (v) => v)
    const n = clean(V / 24000)
    return numeric(
      slot,
      {
        prompt: `${s.say(V)} ${s.ask}`,
        solution: `One mole of gas occupies $24\\text{ dm}^3 = ${tex(24000)}\\text{ cm}^3$ at RTP, so $\\dfrac{${V}}{${tex(24000)}} = ${show(n)}$ mol.`,
        method: [`uses ${prose(24000)} cm³ per mole`],
        answer: n,
        tolerance: room(n, places(n)),
      },
      // Second route: convert to dm³ first, then divide by 24.
      { agrees: near(V / 1000 / 24, n), detail: `${V} cm³ = ${show(V / 1000)} dm³; ÷ 24 = ${show(V / 1000 / 24)} mol` },
      { context: c.name, gas: s.gas, V },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q10: a mass of reactant to a volume of gas, through a 1 : 1 equation
// ---------------------------------------------------------------------------------------------

interface Source {
  f: string
  eq: Equation
  gas: 'CO2' | 'H2'
  /** The sentence that sets the reaction, from a mass printed. */
  says: (m: string, name: string) => string[]
  moles: number[]
  mass: [number, number]
}
interface SourceFamily {
  name: string
  sources: Source[]
}
const heats = (m: string, name: string) => [`${m} g of ${name} decomposes fully when it is heated.`, `A student heats ${m} g of ${name} until it has fully decomposed.`]
const withAcid = (acid: string) => (m: string, name: string) => [`${m} g of ${name} reacts with excess dilute ${acid}.`, `A student adds ${m} g of ${name} to excess dilute ${acid}.`]
const CARBONATE_MOLES = range(0.02, 0.3, 0.01)
const METAL_MOLES = range(0.005, 0.1, 0.005)
/**
 * Reactions giving one gas molecule for each formula unit of the solid: carbonates that break
 * down in a Bunsen flame (not calcium carbonate, Mr 100), carbonates with acid (sodium and
 * potassium carbonate do not decompose on heating, so they meet acid), and metals with acid
 * (not magnesium, Ar 24).
 */
const SOURCES: SourceFamily[] = [
  {
    name: 'heating a carbonate',
    sources: [
      { f: 'MgCO3', eq: equation('MgCO3 -> MgO + CO2'), gas: 'CO2', says: heats, moles: CARBONATE_MOLES, mass: [1, 30] },
      { f: 'CuCO3', eq: equation('CuCO3 -> CuO + CO2'), gas: 'CO2', says: heats, moles: CARBONATE_MOLES, mass: [1, 30] },
      { f: 'ZnCO3', eq: equation('ZnCO3 -> ZnO + CO2'), gas: 'CO2', says: heats, moles: CARBONATE_MOLES, mass: [1, 30] },
    ],
  },
  {
    name: 'carbonate and acid',
    sources: [
      { f: 'Na2CO3', eq: equation('Na2CO3 + 2HCl -> 2NaCl + H2O + CO2'), gas: 'CO2', says: withAcid('hydrochloric acid'), moles: CARBONATE_MOLES, mass: [1, 15] },
      { f: 'NaHCO3', eq: equation('NaHCO3 + HCl -> NaCl + H2O + CO2'), gas: 'CO2', says: withAcid('hydrochloric acid'), moles: CARBONATE_MOLES, mass: [1, 15] },
      { f: 'K2CO3', eq: equation('K2CO3 + 2HCl -> 2KCl + H2O + CO2'), gas: 'CO2', says: withAcid('hydrochloric acid'), moles: CARBONATE_MOLES, mass: [1, 15] },
    ],
  },
  {
    name: 'metal and acid',
    sources: [
      { f: 'Zn', eq: equation('Zn + 2HCl -> ZnCl2 + H2'), gas: 'H2', says: withAcid('hydrochloric acid'), moles: METAL_MOLES, mass: [0.3, 7] },
      { f: 'Fe', eq: equation('Fe + H2SO4 -> FeSO4 + H2'), gas: 'H2', says: withAcid('sulfuric acid'), moles: METAL_MOLES, mass: [0.25, 6] },
    ],
  },
]
interface Reacted {
  n: number
  m: number
  V: number
}
/** Every amount whose mass prints to three places at most within the source's range, and no coincidence. */
const reacted = (s: Source): Reacted[] => {
  const M = mr(s.f)
  return s.moles
    .map((n) => ({ n, m: clean(n * M), V: clean(n * 24) }))
    .filter((x) => !powerOfTen(x.n) && places(x.m) <= 3 && x.m >= s.mass[0] && x.m <= s.mass[1] && distinct(x.m, M) && clearOf(x.V, x.m, M, x.n) && noOnes(x.m, x.V))
}

/** Mass → moles → 1 : 1 → × 24: written as q10 (10 g of calcium carbonate, 2.4 dm³, 3 marks). */
export const volumeFromReactantMass: Generator = {
  id: 'gas-volume-from-reactant-mass',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q10'],
  build(r, slot, turn) {
    const fam = SOURCES[turn % SOURCES.length]!
    const s = pick(r, fam.sources)
    const x = evenly(r, `gas-volume-from-reactant-mass:${s.f}`, () => reacted(s), (x) => x.V)
    const M = mr(s.f)
    const name = nameOf(s.f)
    const gas = nameOf(s.gas)
    if (coef(s.eq, s.f) !== 1 || coef(s.eq, s.gas) !== 1) throw new Error(`${s.eq.text} is not 1 : 1`)
    const prompt = `${pick(r, s.says(show(x.m), name))} What volume of ${gas}, in dm³ at RTP, is produced? ${massOf(s.f)}`
    return numeric(
      slot,
      {
        prompt,
        solution:
          `The equation is $${equationTex(s.eq)}$. Moles of $${mathrm(s.f)} = \\dfrac{${show(x.m)}}{${show(M)}} = ${show(x.n)}$; ratio $1:1$, so $${show(x.n)}\\text{ mol}$ of $${mathrm(s.gas)}$; ` +
          `volume $= ${show(x.n)} \\times 24 = $ **${show(x.V)} dm³**.`,
        method: [`${show(x.n)} mol of ${name}`, 'uses the 1 : 1 ratio'],
        answer: x.V,
        tolerance: room(x.V, Math.max(places(x.V), places(x.m))),
      },
      // Second route: the gas volume one gram of the solid gives, 24 ÷ Mr, times the mass.
      { agrees: near((24 / M) * x.m, x.V), detail: `24 ÷ ${show(M)} × ${show(x.m)} = ${show((24 / M) * x.m)} dm³` },
      { context: fam.name, formula: s.f, n: x.n, m: x.m },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q6: volume ratios from an equation
// ---------------------------------------------------------------------------------------------

interface RatioContext {
  name: string
  eq: Equation
  /** [given, asked]: the gas whose volume is printed and the one asked for. Never 1 : 1. */
  pairs: [string, string][]
}
/** Reactions between gases; water is never asked for, since at room conditions it is a liquid. */
const RATIOS: RatioContext[] = [
  { name: 'methane', eq: equation('CH4 + 2O2 -> CO2 + 2H2O'), pairs: [['CH4', 'O2'], ['O2', 'CH4'], ['O2', 'CO2']] },
  { name: 'propane', eq: equation('C3H8 + 5O2 -> 3CO2 + 4H2O'), pairs: [['C3H8', 'O2'], ['C3H8', 'CO2'], ['O2', 'CO2']] },
  { name: 'ethane', eq: equation('2C2H6 + 7O2 -> 4CO2 + 6H2O'), pairs: [['C2H6', 'O2'], ['C2H6', 'CO2'], ['O2', 'C2H6']] },
  { name: 'ammonia', eq: equation('N2 + 3H2 -> 2NH3'), pairs: [['N2', 'H2'], ['H2', 'N2']] },
  { name: 'hydrogen', eq: equation('2H2 + O2 -> 2H2O'), pairs: [['H2', 'O2'], ['O2', 'H2']] },
]
for (const c of RATIOS) for (const [g, a] of c.pairs) if (coef(c.eq, g) === coef(c.eq, a)) throw new Error(`${c.name}: ${g} and ${a} are 1 : 1`)
const isReactant = (eq: Equation, f: string) => eq.left.some((t) => t.f === f)
/** "1 : 2", or "4 : 2 = 2 : 1" where it reduces. */
function ratioText(a: number, c: number): string {
  const g = gcd(a, c)
  return g > 1 ? `${a} : ${c} = ${a / g} : ${c / g}` : `${a} : ${c}`
}
/** V × c ÷ a in the fewest steps: "25 \times 2", "40 \div 2", "40 \div 2 \times 7". */
function scaleExpr(V: number, a: number, c: number): string {
  const g = gcd(a, c)
  const [p, q] = [a / g, c / g]
  return p === 1 ? `${V} \\times ${q}` : q === 1 ? `${V} \\div ${p}` : `${V} \\div ${p} \\times ${q}`
}

/** Gas volumes in the ratio of the balancing numbers: written as q6 (25 cm³ of methane, 50 cm³ of oxygen, 1 mark). */
export const volumeRatio: Generator = {
  id: 'gas-volume-ratio',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q6'],
  build(r, slot, turn) {
    const c = RATIOS[turn % RATIOS.length]!
    const [g, a] = pick(r, c.pairs)
    const [kg, ka] = [coef(c.eq, g), coef(c.eq, a)]
    // Whole cm³ from 10 to 100 given, a whole number asked, up to 400 cm³.
    const V = evenly(
      r,
      `gas-volume-ratio:${c.name}:${g}:${a}`,
      () => range(10, 100).filter((v) => Number.isInteger((v * ka) / kg) && (v * ka) / kg >= 5 && (v * ka) / kg <= 400 && !tenfold((v * ka) / kg, v)),
      (v) => (v * ka) / kg,
    )
    const ans = clean((V * ka) / kg)
    const eq = written(c.eq)
    const prompt = isReactant(c.eq, a)
      ? pick(r, [
          `In ${eq}, what volume of ${called(a)}, in cm³, reacts with ${V} cm³ of ${called(g)} at the same conditions?`,
          `${V} cm³ of ${called(g)} reacts with ${called(a)}: ${eq}. What volume of ${called(a)}, in cm³, does it react with, measured at the same conditions?`,
        ])
      : pick(r, [
          `In ${eq}, what volume of ${called(a)}, in cm³, forms when ${V} cm³ of ${called(g)} reacts completely, with all volumes measured at the same conditions?`,
          `${V} cm³ of ${called(g)} is used up in the reaction ${eq}. What volume of ${called(a)}, in cm³, forms at the same conditions?`,
        ])
    return numeric(
      slot,
      {
        prompt,
        solution: `Equal volumes of gases hold equal numbers of moles, so the volumes are in the ratio of the balancing numbers. The ratio $${mathrm(g)} : ${mathrm(a)}$ is $${ratioText(kg, ka)}$, so $${scaleExpr(V, kg, ka)} = $ **${show(ans)} cm³**.`,
        method: [],
        answer: ans,
        tolerance: 0,
      },
      // Second route: through moles at RTP, cm³ ÷ 24 000, scaled and back.
      { agrees: near(((V / 24000) * ka * 24000) / kg, ans), detail: `${V} cm³ is ${show(V / 24000)} mol; × ${ka} ÷ ${kg}` },
      { context: c.name, given: g, asked: a, V },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q12: the total volume of gas after an exact reaction, water as steam
// ---------------------------------------------------------------------------------------------

interface Burn {
  name: string
  eq: Equation
  fuel: string
  /** The fuel's volume is its balancing number times k. */
  k: number[]
}
/**
 * Fuels burned in exactly the oxygen they need, the water staying as steam. Methane is left out:
 * its gas volume after (1 + 2) equals the volume before (1 + 2), so adding the two given
 * volumes would be marked right. Hydrogen is the written reaction; its answer is the hydrogen's
 * own volume by the 2 : 2 ratio, which is the point of the written question.
 */
const BURNS: Burn[] = [
  { name: 'hydrogen', eq: equation('2H2 + O2 -> 2H2O'), fuel: 'H2', k: range(10, 100) },
  { name: 'propane', eq: equation('C3H8 + 5O2 -> 3CO2 + 4H2O'), fuel: 'C3H8', k: range(10, 60) },
  { name: 'ethane', eq: equation('2C2H6 + 7O2 -> 4CO2 + 6H2O'), fuel: 'C2H6', k: range(5, 40) },
  { name: 'butane', eq: equation('2C4H10 + 13O2 -> 8CO2 + 10H2O'), fuel: 'C4H10', k: range(5, 25) },
]
for (const b of BURNS) {
  const before = b.eq.left.reduce((t, x) => t + x.n, 0)
  const after = b.eq.right.reduce((t, x) => t + x.n, 0)
  const steam = coef(b.eq, 'H2O')
  if (before === after || (b.fuel !== 'H2' && before === steam)) throw new Error(`${b.name}: the gas volume after must differ from the volumes given`)
}
/** The equation as printed, the water marked as a gas: 2H₂ + O₂ → 2H₂O(g). */
const withSteam = (eq: Equation) => written(eq).replace('H₂O', 'H₂O(g)')

/** Volume of gas after an exact reaction: written as q12 (100 cm³ of hydrogen and 50 cm³ of oxygen, 100 cm³ of steam, 3 marks). */
export const totalVolumeAfter: Generator = {
  id: 'gas-total-volume-after',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q12'],
  build(r, slot, turn) {
    const b = BURNS[turn % BURNS.length]!
    const k = pick(r, b.k)
    const [aF, aO, aW] = [coef(b.eq, b.fuel), coef(b.eq, 'O2'), coef(b.eq, 'H2O')]
    const aC = b.fuel === 'H2' ? 0 : coef(b.eq, 'CO2')
    const [Vf, Vo, Vc, Vw] = [aF * k, aO * k, aC * k, aW * k]
    const total = Vc + Vw
    const fuel = called(b.fuel)
    const prompt = pick(r, [
      `In ${withSteam(b.eq)}, ${Vf} cm³ of ${fuel} reacts exactly with ${Vo} cm³ of oxygen. What total volume of gas, in cm³, is present after the reaction if all measurements are at the same conditions and the water remains a gas?`,
      `${Vf} cm³ of ${fuel} is burned in exactly ${Vo} cm³ of oxygen: ${withSteam(b.eq)}. All volumes are measured at the same conditions, hot enough for the water to remain a gas. What total volume of gas, in cm³, is present after the reaction?`,
    ])
    const solution =
      b.fuel === 'H2'
        ? `The ratio $\\mathrm{H_2} : \\mathrm{H_2O}$ is $2 : 2$, so $${Vf}\\text{ cm}^3$ of hydrogen gives **${Vw} cm³** of steam. The oxygen ($${Vo}\\text{ cm}^3$) is fully used, so the only gas left is the water vapour.`
        : `The ratio $${mathrm(b.fuel)} : \\mathrm{CO_2} : \\mathrm{H_2O}$ is $${aF} : ${aC} : ${aW}$, so $${Vf}\\text{ cm}^3$ of ${fuel} gives $${Vc}\\text{ cm}^3$ of carbon dioxide and $${Vw}\\text{ cm}^3$ of steam. ` +
          `The oxygen ($${Vo}\\text{ cm}^3$) is fully used, so the gas left is $${Vc} + ${Vw} = $ **${total} cm³**.`
    const method =
      b.fuel === 'H2'
        ? ['uses the 2 : 2 ratio for hydrogen to water', 'notes the oxygen is completely used']
        : [`uses the ${aF} : ${aC} : ${aW} ratio for ${fuel} to carbon dioxide and water`, 'notes the oxygen is completely used']
    return numeric(
      slot,
      { prompt, solution, method, answer: total, tolerance: 0 },
      // Second route: the gas volume changes by (moles after − moles before) for every k cm³.
      (() => {
        const before = b.eq.left.reduce((t, x) => t + x.n, 0)
        const after = b.eq.right.reduce((t, x) => t + x.n, 0)
        return { agrees: near(Vf + Vo + (after - before) * k, total), detail: `${Vf + Vo} cm³ before, change ${(after - before) * k} cm³` }
      })(),
      { context: b.name, k, fuel: Vf, oxygen: Vo },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q14: a volume of hydrogen in cm³ back to the mass of metal that made it
// ---------------------------------------------------------------------------------------------

interface Metal {
  name: string
  f: string
  /** The metal's reactions with dilute acids, each giving hydrogen in the same ratio. */
  eqs: Equation[]
  /** Volumes of hydrogen, in cm³, that give amounts exact to five places. */
  volumes: number[]
}
/**
 * Metals with dilute hydrochloric and sulfuric acid, as AQA 4.4.2.1 names them (magnesium, zinc
 * and iron), collected in a gas syringe up to 100 cm³ and an upturned measuring cylinder
 * beyond. Every reaction is 1 : 1, as the written mark scheme has it. Not magnesium: at Ar 24
 * its mass in grams is the hydrogen's cm³ with the point moved (72 cm³, 0.072 g), so dividing
 * by 1000 would be marked right. Not aluminium: its oxide layer keeps it from dissolving
 * readily in dilute acid, and the specification does not name it.
 */
const METALS: Metal[] = [
  { name: 'zinc', f: 'Zn', eqs: [equation('Zn + 2HCl -> ZnCl2 + H2'), equation('Zn + H2SO4 -> ZnSO4 + H2')], volumes: range(36, 228, 12) },
  { name: 'iron', f: 'Fe', eqs: [equation('Fe + H2SO4 -> FeSO4 + H2'), equation('Fe + 2HCl -> FeCl2 + H2')], volumes: range(36, 228, 12) },
]
interface Hydrogen {
  V: number
  nH: number
  nM: number
  m: number
}
for (const x of METALS) for (const e of x.eqs) if (coef(e, x.f) !== 1 || coef(e, 'H2') !== 1) throw new Error(`${x.name}: ${e.text} is not 1 : 1`)
const hydrogen = (x: Metal): Hydrogen[] => {
  const [aM, aH, Ar] = [coef(x.eqs[0]!, x.f), coef(x.eqs[0]!, 'H2'), mr(x.f)]
  return x.volumes
    .map((V) => {
      const nH = clean(V / 24000)
      const nM = clean((nH * aM) / aH)
      return { V, nH, nM, m: clean(nM * Ar) }
    })
    .filter((h) => atMost(h.nH, 5) && atMost(h.nM, 5) && places(h.m) <= 4 && !powerOfTen(h.nH) && !powerOfTen(h.nM) && clearOf(h.m, h.V, Ar, h.nH, h.nM))
}

/** n(H₂) = V ÷ 24 000, the ratio, × Ar: written as q14 (72 cm³ of hydrogen from magnesium, 0.072 g, 4 marks). */
export const metalMassFromHydrogen: Generator = {
  id: 'gas-metal-mass-from-hydrogen',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q14'],
  build(r, slot, turn) {
    const x = METALS[turn % METALS.length]!
    const h = evenly(r, `gas-metal-mass-from-hydrogen:${x.f}`, () => hydrogen(x), (h) => h.m)
    const eq = pick(r, x.eqs)
    const [aM, aH, Ar] = [coef(eq, x.f), coef(eq, 'H2'), mr(x.f)]
    const metal = nameOf(x.f)
    const apparatus = h.V <= 100 ? 'A gas syringe collects' : 'An upturned measuring cylinder, filled with water, collects'
    const prompt = pick(r, [
      `${apparatus} ${h.V} cm³ of hydrogen at RTP from ${written(eq)}. What mass of ${metal}, in grams, reacted? ${massOf(x.f)}`,
      `${cap(metal)} reacts with excess dilute acid: ${written(eq)}. ${apparatus} ${h.V} cm³ of hydrogen at RTP. What mass of ${metal}, in grams, reacted? ${massOf(x.f)}`,
      `A piece of ${metal} dissolves completely in excess dilute acid: ${written(eq)}. ${apparatus} ${h.V} cm³ of hydrogen at RTP. What was the mass of the ${metal}, in grams? ${massOf(x.f)}`,
    ])
    const same = aM === aH
    const toMetal = same ? `so $${show(h.nM)}\\text{ mol}$ of ${metal}` : `so $${show(h.nH)} \\div ${aH} \\times ${aM} = ${show(h.nM)}\\text{ mol}$ of ${metal}`
    return numeric(
      slot,
      {
        prompt,
        solution: `Moles of $\\mathrm{H_2} = \\dfrac{${h.V}}{${tex(24000)}} = ${show(h.nH)}$. The ratio $${mathrm(x.f)} : \\mathrm{H_2}$ is $${aM}:${aH}$, ${toMetal}. Mass $= ${show(h.nM)} \\times ${show(Ar)} = $ **${show(h.m)} g**.`,
        method: [`moles of hydrogen = ${show(h.nH)}`, `uses the ${aM} : ${aH} ratio`, `multiplies by ${show(Ar)}`],
        answer: h.m,
        tolerance: room(h.m, places(h.m)),
      },
      // Second route: the mass of metal that gives one cm³ of hydrogen, times the volume.
      { agrees: near(((Ar * aM) / (aH * 24000)) * h.V, h.m), detail: `${show(Ar)} × ${aM} ÷ (${aH} × 24000) × ${h.V} = ${show(((Ar * aM) / (aH * 24000)) * h.V)} g` },
      { context: x.name, V: h.V, nH: h.nH, nM: h.nM, equation: eq.text },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q16: the limiting reactant among gases
// ---------------------------------------------------------------------------------------------

interface Limited {
  name: string
  eq: Equation
  product: string
  /** The reactant that must run out, where the other may not. */
  only?: string
  /** The sentence after the volumes. */
  ask: string
  /** Said after the answer. */
  note: string
}
/**
 * Reactions of two gases where the product's volume from the limiting reactant is not a copy of
 * a given: carbon monoxide (2CO → 2CO₂) and methane (CH₄ → CO₂) are left out, since the answer
 * would be the limiting volume itself. In the combustions only the fuel runs out (`only`): with
 * too little oxygen a hydrocarbon burns incompletely to carbon monoxide and soot (AQA 4.9.3.1),
 * so carbon dioxide would not be the product.
 */
const LIMITED: Limited[] = [
  {
    name: 'ammonia',
    eq: equation('N2 + 3H2 -> 2NH3'),
    product: 'NH3',
    ask: 'What volume of ammonia, in cm³, forms if the reaction goes to completion?',
    note: ' In practice the reaction is reversible, so less ammonia forms.',
  },
  {
    name: 'propane',
    eq: equation('C3H8 + 5O2 -> 3CO2 + 4H2O'),
    product: 'CO2',
    only: 'C3H8',
    ask: 'The mixture is ignited. What volume of carbon dioxide, in cm³, forms when the reaction is complete, with all volumes measured at the same conditions?',
    note: ' The oxygen is in excess, so the propane burns completely.',
  },
  {
    name: 'ethane',
    eq: equation('2C2H6 + 7O2 -> 4CO2 + 6H2O'),
    product: 'CO2',
    only: 'C2H6',
    ask: 'The mixture is ignited. What volume of carbon dioxide, in cm³, forms when the reaction is complete, with all volumes measured at the same conditions?',
    note: ' The oxygen is in excess, so the ethane burns completely.',
  },
]
const [AMMONIA, PROPANE, ETHANE] = LIMITED as [Limited, Limited, Limited]
/**
 * The turns, ammonia on three in five. Only in ammonia can the reactant that runs out be the
 * larger volume (hydrogen, at three times nitrogen's balancing number); in a combustion the fuel
 * that runs out is always the smaller volume. Hydrogen runs out in four ammonia builds in five,
 * so "the smaller volume runs out" pays in about 1 − 0.6 × 0.8 = 52% of builds across the slot.
 */
const LIMIT_TURNS: Limited[] = [AMMONIA, PROPANE, AMMONIA, ETHANE, AMMONIA]
const HYDROGEN_RUNS_OUT = 0.8
interface Mix {
  V1: number
  V2: number
  /** Index of the reactant that runs out. */
  limit: 0 | 1
  p: number
}
/**
 * Every pair of whole volumes from 10 to 200 cm³ in which reactant `limit` runs out with the
 * other at least a fifth in excess, each volume over its balancing number exact to two places,
 * the product a whole number of cm³ and no copy of a given. Where the reactant that runs out
 * has the larger balancing number, it is always the larger volume, so "the smaller volume runs
 * out" is right only when the other one does: about half the builds.
 */
function mixes(eq: Equation, product: string, limit: 0 | 1): Mix[] {
  const [A, B] = eq.left as [{ n: number; f: string }, { n: number; f: string }]
  const k = coef(eq, product)
  const out: Mix[] = []
  for (let V1 = 10; V1 <= 200; V1++) {
    for (let V2 = 10; V2 <= 200; V2++) {
      if (!atMost(V1 / A.n, 2) || !atMost(V2 / B.n, 2)) continue
      const x = [V1 / A.n, V2 / B.n]
      const [L, E] = [x[limit]!, x[1 - limit]!]
      if (E < 1.2 * L - 1e-9 || E > 4 * L) continue
      const [VL, VE, aL] = limit === 0 ? [V1, V2, A.n] : [V2, V1, B.n]
      const bigger = (limit === 0 ? A.n : B.n) > (limit === 0 ? B.n : A.n)
      if (bigger && VL <= VE) continue
      const p = (VL * k) / aL
      if (!Number.isInteger(p) || p > 400) continue
      if (!distinct(V1, V2) || tenfold(p, V1) || tenfold(p, V2) || near(p, 2 * VE) || near(2 * p, VE)) continue
      // Not the givens' difference or sum, which a student combining the two volumes would reach.
      if (near(p, Math.abs(V1 - V2)) || near(p, V1 + V2)) continue
      out.push({ V1, V2, limit, p })
    }
  }
  return out
}

/** Divide by the balancing numbers, pick the limiting gas, scale to the product: written as q16 (40 cm³ of N₂, 90 cm³ of H₂, 60 cm³ of NH₃, 3 marks). */
export const limitingGasVolume: Generator = {
  id: 'gas-limiting-volume',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q16'],
  build(r, slot, turn) {
    const c = LIMIT_TURNS[turn % LIMIT_TURNS.length]!
    const [first] = c.eq.left as [{ n: number; f: string }, { n: number; f: string }]
    const limit: 0 | 1 = c.only ? (first.f === c.only ? 0 : 1) : r() < HYDROGEN_RUNS_OUT ? (first.f === 'H2' ? 0 : 1) : first.f === 'H2' ? 1 : 0
    const mix = evenly(r, `gas-limiting-volume:${c.name}:${limit}`, () => mixes(c.eq, c.product, limit), (m) => m.p)
    const [A, B] = c.eq.left as [{ n: number; f: string }, { n: number; f: string }]
    const L = limit === 0 ? A : B
    const VL = limit === 0 ? mix.V1 : mix.V2
    const k = coef(c.eq, c.product)
    const g = gcd(k, L.n)
    const [num, den] = [k / g, L.n / g]
    const expr = den === 1 ? `${VL} \\times ${num}` : `${VL} \\times \\frac{${num}}{${den}}`
    const prompt = `In ${written(c.eq)}, ${mix.V1} cm³ of ${called(A.f)} is mixed with ${mix.V2} cm³ of ${called(B.f)}. ${c.ask}`
    const each = `${called(A.f)} $${mix.V1} \\div ${A.n} = ${show(mix.V1 / A.n)}$, ${called(B.f)} $${mix.V2} \\div ${B.n} = ${show(mix.V2 / B.n)}$`
    return numeric(
      slot,
      {
        prompt,
        solution: `Divide by the balancing numbers: ${each}. **${cap(called(L.f))} is limiting.** The ratio $${mathrm(L.f)} : ${mathrm(c.product)}$ is $${L.n} : ${k}$, so $${expr} = $ **${mix.p} cm³**.${c.note}`,
        method: ['divides each volume by its balancing number', `identifies ${called(L.f)} as limiting`],
        answer: mix.p,
        tolerance: 0,
      },
      // Second route: the product each gas could make on its own; the smaller is the answer.
      (() => {
        const from1 = (mix.V1 * k) / A.n
        const from2 = (mix.V2 * k) / B.n
        return { agrees: near(Math.min(from1, from2), mix.p) && (limit === 0 ? from1 < from2 : from2 < from1), detail: `${show(from1)} or ${show(from2)} cm³: the smaller` }
      })(),
      { context: c.name, V1: mix.V1, V2: mix.V2, limit: L.f, smallerRunsOut: VL === Math.min(mix.V1, mix.V2) ? 1 : 0 },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q17: moles from a volume, rounded to three decimal places
// ---------------------------------------------------------------------------------------------

interface Produced {
  name: string
  says: (V: string) => string
  /** What the moles are of. */
  of: string
}
const PRODUCED: Produced[] = [
  { name: 'any reaction', says: (V) => `A reaction produces ${V} dm³ of gas at RTP.`, of: 'How many moles is that, to three decimal places?' },
  {
    name: 'fermentation',
    says: (V) => `Yeast ferments a glucose solution in a warm flask and produces ${V} dm³ of carbon dioxide, measured at RTP.`,
    of: 'How many moles of carbon dioxide is that, to three decimal places?',
  },
  {
    name: 'hydrogen peroxide',
    says: (V) => `Hydrogen peroxide solution decomposes over a manganese(IV) oxide catalyst and gives ${V} dm³ of oxygen, measured at RTP.`,
    of: 'How many moles of oxygen is that, to three decimal places?',
  },
]
interface Rounded {
  V: number
  n: number
  answer: number
}
/**
 * Volumes from 0.65 to 2.4 dm³ in hundredths whose amount needs rounding (not exact at three
 * places), is clear of a half in the third place, and does not end in a 0 the answer box would
 * drop (0.25 dm³ gives 0.010). From 0.65 dm³ the answer is at least 0.027, where half a unit in
 * the third place is within the 2% the release check allows.
 */
const ROUNDED: Rounded[] = range(0.65, 2.4, 0.01)
  .map((V) => ({ V, n: V / 24, answer: Number(fixed(V / 24, 3)) }))
  .filter((x) => x.V !== 1 && !atMost(x.n, 3) && clearOfHalf(x.n, 3, 0.05) && fixed(x.n, 3).at(-1) !== '0' && clearOf(x.answer, x.V))

/** n = V ÷ 24 to three decimal places: written as q17 (0.25 dm³, 0.010 mol, 2 marks). */
export const molesFromVolumeRounded: Generator = {
  id: 'gas-moles-from-volume-rounded',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q17'],
  build(r, slot, turn) {
    const p = PRODUCED[turn % PRODUCED.length]!
    const x = evenly(r, 'gas-moles-from-volume-rounded', () => ROUNDED, (x) => x.answer)
    const text = fixed(x.answer, 3)
    return numeric(
      slot,
      {
        prompt: `${p.says(show(x.V))} ${p.of}`,
        solution: `$\\dfrac{${show(x.V)}}{24} = ${fixed(x.n, 5)}$, which is **${text} mol** to three decimal places.`,
        method: ['divides by 24'],
        answer: x.answer,
        tolerance: toPlaces(x.answer, 3),
      },
      // Second route: the rounded amount back at 24 dm³ a mole lands within half a thousandth of a mole of the volume.
      { agrees: Math.abs(x.answer * 24 - x.V) < 0.0005 * 24 && text === String(x.answer), detail: `${text} × 24 = ${show(x.answer * 24)} dm³ against ${show(x.V)}` },
      { context: p.name, V: x.V },
    )
  },
}

export const gasGenerators: Generator[] = [
  volumeFromMoles,
  molesFromVolume,
  volumeFromMass,
  volumeRatio,
  massFromVolume,
  molesFromCm3,
  volumeFromReactantMass,
  totalVolumeAfter,
  metalMassFromHydrogen,
  limitingGasVolume,
  molesFromVolumeRounded,
]

/** For tests. */
export const GAS_POOLS = { LIMIT_TURNS, room, MOLAR_FAMILIES, SAMPLES, MASS_FAMILIES, COLLECTED, SOURCES, RATIOS, BURNS, METALS, LIMITED, PRODUCED, ROUNDED, called }
