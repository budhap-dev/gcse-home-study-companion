import { ELEMENTS } from '../../elements.ts'
import { clearOfHalf, fixed, roundTo, show } from '../format.ts'
import { cap, closes, near, numeric, prose, tex } from '../physics/build.ts'
import { pick } from '../random.ts'
import type { Generator } from '../types.ts'
import { AR, an, byFirst, clean, clearOf, distinct, evenly, places, powerOfTen, range, shiftFree, tenfold, toPlaces, word } from './build.ts'

/**
 * Atomic structure, bonding and separating mixtures (AQA 8462, 4.1.1, 4.2.1, 4.2.4 and 4.8.1).
 * The numeric written questions here that can be varied: neutrons from the mass number,
 * relative atomic mass from isotope abundances, electrons in an ion, the ratio of ions in an
 * ionic compound, the surface area to volume ratio of cube-shaped nanoparticles, and Rf values.
 *
 * Left written, because each is a fact to recall with nothing to vary: the shared pairs in O₂
 * (covalent-bonding q2: the specification's eight molecules give too few questions, and each
 * answer is the molecule's bonding recalled) and the nanometres in a metre
 * (carbon-structures-and-nanoparticles q9).
 *
 * Every nuclide is a real one, every abundance the IUPAC figure rounded so the isotopes still
 * total 100, every ion has the charge GCSE gives it, every nanoparticle is 1 to 100 nm, and
 * every Rf value comes from a spot that stops short of the solvent front.
 */

const ELEMENT = Object.fromEntries(ELEMENTS.map((e) => [e.symbol, e]))
const zOf = (symbol: string) => ELEMENT[symbol]!.z
const nameOf = (symbol: string) => ELEMENT[symbol]!.name

// ---------------------------------------------------------------------------------------------
// atoms-ions-and-isotopes q2: neutrons from the mass number and atomic number
// ---------------------------------------------------------------------------------------------

const ATOMS = 'atoms-ions-and-isotopes'

/**
 * Real nuclides, all stable but carbon-14, by symbol and mass number. One whose neutrons equal
 * its protons (carbon-12, oxygen-16, calcium-40) is left out: its answer would be the atomic
 * number, a given figure, and "the neutrons are the atomic number" would pay.
 */
const NUCLIDES: [string, number][] = [
  ['Li', 7], ['Be', 9], ['B', 11], ['C', 13], ['C', 14], ['N', 15], ['O', 17], ['O', 18], ['F', 19], ['Ne', 21], ['Ne', 22],
  ['Na', 23], ['Mg', 25], ['Mg', 26], ['Al', 27], ['Si', 29], ['Si', 30], ['P', 31], ['S', 33], ['S', 34], ['Cl', 35], ['Cl', 37],
  ['Ar', 40], ['K', 39], ['K', 41], ['Ca', 44], ['Ti', 48], ['Cr', 52], ['Mn', 55], ['Fe', 54], ['Fe', 56], ['Co', 59], ['Ni', 58],
  ['Ni', 60], ['Cu', 63], ['Cu', 65], ['Zn', 64], ['Zn', 66], ['Ga', 69], ['Ga', 71], ['Br', 79], ['Br', 81], ['Kr', 84], ['Rb', 85],
  ['Sr', 88], ['Ag', 107], ['Ag', 109], ['Sn', 120], ['I', 127], ['Ba', 138], ['Au', 197], ['Pb', 208],
]
interface Nuclide {
  symbol: string
  z: number
  a: number
  n: number
}
const nuclides = (): Nuclide[] =>
  NUCLIDES.map(([symbol, a]) => ({ symbol, a, z: zOf(symbol), n: a - zOf(symbol) })).filter((x) => x.n !== x.z && clearOf(x.n, x.z, x.a))

interface NeutronContext {
  name: string
  prompts: ((x: Nuclide) => string)[]
  solution: (x: Nuclide) => string
}
const counts = 'The mass number counts protons and neutrons together, and the atomic number counts the protons.'
const NEUTRON_CONTEXTS: NeutronContext[] = [
  {
    name: 'numbers',
    prompts: [
      (x) => `An atom has atomic number ${x.z} and mass number ${x.a}. How many neutrons does it have?`,
      (x) => `An atom has mass number ${x.a} and atomic number ${x.z}. How many neutrons are in its nucleus?`,
      (x) => `The nucleus of an atom has mass number ${x.a}. Its atomic number is ${x.z}. How many neutrons does the nucleus contain?`,
    ],
    solution: (x) => `$${x.a} - ${x.z} = ${x.n}$ neutrons. ${counts}`,
  },
  {
    name: 'named',
    prompts: [
      (x) => `An atom of ${nameOf(x.symbol)}-${x.a} has atomic number ${x.z}. How many neutrons does it have?`,
      (x) => `${cap(nameOf(x.symbol))} has atomic number ${x.z}. How many neutrons are there in an atom of ${nameOf(x.symbol)}-${x.a}?`,
    ],
    solution: (x) => `The ${x.a} in ${nameOf(x.symbol)}-${x.a} is the mass number, so $${x.a} - ${x.z} = ${x.n}$ neutrons. ${counts}`,
  },
  {
    name: 'symbol',
    prompts: [
      (x) => `An atom is shown as $^{${x.a}}_{${x.z}}\\mathrm{${x.symbol}}$. How many neutrons does it have?`,
      (x) => `How many neutrons are there in an atom of $^{${x.a}}_{${x.z}}\\mathrm{${x.symbol}}$?`,
    ],
    solution: (x) => `The top number, ${x.a}, is the mass number and the bottom number, ${x.z}, is the atomic number: $${x.a} - ${x.z} = ${x.n}$ neutrons. ${counts}`,
  },
]

export const neutronsInAnAtom: Generator = {
  id: 'neutrons-in-an-atom',
  subjectId: 'chemistry',
  topicId: ATOMS,
  replaces: ['q2'],
  build(r, slot, turn) {
    const ctx = NEUTRON_CONTEXTS[turn % NEUTRON_CONTEXTS.length]!
    const x = evenly(r, `neutrons-in-an-atom:${ctx.name}`, nuclides, (y) => y.n)
    return numeric(
      slot,
      {
        prompt: pick(r, ctx.prompts)(x),
        solution: ctx.solution(x),
        method: ['subtracts atomic number from mass number'],
        answer: x.n,
      },
      // Second route: the periodic table's atomic number for the element, and protons plus neutrons back to the mass number.
      { agrees: zOf(x.symbol) === x.z && x.z + x.n === x.a, detail: `${x.symbol}: ${x.z} protons + ${x.n} neutrons = ${x.a}` },
      { context: ctx.name, symbol: x.symbol, z: x.z, a: x.a },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// atoms-ions-and-isotopes q6: relative atomic mass from isotope abundances
// ---------------------------------------------------------------------------------------------

/**
 * Natural isotope abundances (IUPAC representative compositions), rounded to whole per cent and
 * to tenths where each rounding still totals 100. An isotope under 0.05% (potassium-40,
 * sulfur-36) is left out, as a textbook does. An element whose answer to one decimal place is
 * its relative atomic mass on the AQA insert (chlorine 35.5, bromine 80, silver 108, argon 40,
 * carbon 12) is left out: reading the insert would score. So is zinc, whose mean is 65.45.
 */
interface Isotopes {
  symbol: string
  masses: number[]
  whole?: number[]
  tenths?: number[]
}
const ISOTOPES: Isotopes[] = [
  { symbol: 'Li', masses: [6, 7], whole: [8, 92], tenths: [7.6, 92.4] },
  { symbol: 'B', masses: [10, 11], whole: [20, 80], tenths: [19.9, 80.1] },
  { symbol: 'Ne', masses: [20, 21, 22], tenths: [90.5, 0.3, 9.2] },
  { symbol: 'Mg', masses: [24, 25, 26], whole: [79, 10, 11] },
  { symbol: 'Si', masses: [28, 29, 30], whole: [92, 5, 3], tenths: [92.2, 4.7, 3.1] },
  { symbol: 'S', masses: [32, 33, 34], tenths: [95, 0.8, 4.2] },
  { symbol: 'K', masses: [39, 41], whole: [93, 7], tenths: [93.3, 6.7] },
  { symbol: 'Cr', masses: [50, 52, 53, 54], whole: [4, 84, 10, 2], tenths: [4.3, 83.8, 9.5, 2.4] },
  { symbol: 'Fe', masses: [54, 56, 57, 58], tenths: [5.8, 91.8, 2.1, 0.3] },
  { symbol: 'Cu', masses: [63, 65], whole: [69, 31], tenths: [69.2, 30.8] },
  { symbol: 'Ga', masses: [69, 71], whole: [60, 40], tenths: [60.1, 39.9] },
  { symbol: 'Rb', masses: [85, 87], whole: [72, 28], tenths: [72.2, 27.8] },
  { symbol: 'In', masses: [113, 115], whole: [4, 96], tenths: [4.3, 95.7] },
  { symbol: 'Sb', masses: [121, 123], whole: [57, 43], tenths: [57.2, 42.8] },
  { symbol: 'Re', masses: [185, 187], whole: [37, 63], tenths: [37.4, 62.6] },
  { symbol: 'Ir', masses: [191, 193], whole: [37, 63], tenths: [37.3, 62.7] },
  { symbol: 'Tl', masses: [203, 205], whole: [30, 70], tenths: [29.5, 70.5] },
  { symbol: 'Pb', masses: [204, 206, 207, 208], tenths: [1.4, 24.1, 22.1, 52.4] },
]

interface Abundances {
  symbol: string
  masses: number[]
  /** Per cent, or atoms in every hundred or thousand. */
  amounts: number[]
  /** 1 for whole per cent, 0.1 for tenths. */
  step: number
  total: number
  raw: number
  answer: number
}
/** Each element's every rounding, the products' total, the mean and its value to one decimal place. */
const abundances = (): Abundances[] =>
  ISOTOPES.flatMap((iso) =>
    ([[iso.whole, 1], [iso.tenths, 0.1]] as const).flatMap(([amounts, step]) => {
      if (!amounts) return []
      const total = clean(amounts.reduce((t, a, i) => t + a * iso.masses[i]!, 0))
      const raw = clean(total / 100)
      return [{ symbol: iso.symbol, masses: iso.masses, amounts: [...amounts], step, total, raw, answer: roundTo(raw, 1) }]
    }),
  ).filter((x) => clearOfHalf(x.raw, 1) && !near(x.answer, AR[x.symbol]!) && Math.abs(x.answer - AR[x.symbol]!) > 0.05)


interface MeanContext {
  name: string
  /** Whether the figures are counts of atoms, in every hundred or (for tenths of a per cent) every thousand. */
  atoms: boolean
  prompts: ((el: string, x: Abundances, figs: string[]) => string)[]
}
const listed = (items: string[]) => (items.length === 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)
const toOneDp = 'to one decimal place'
const MEAN_CONTEXTS: MeanContext[] = [
  {
    name: 'per cent',
    atoms: false,
    prompts: [
      (el, x, f) => `${cap(el)} is ${listed(x.masses.map((m, i) => `${f[i]}% ${el}-${m}`))}. Calculate its relative atomic mass, ${toOneDp}.`,
      (el, x, f) => `Naturally occurring ${el} is ${listed(x.masses.map((m, i) => `${f[i]}% ${el}-${m}`))}. Calculate the relative atomic mass of ${el}, ${toOneDp}.`,
    ],
  },
  {
    name: 'atoms',
    atoms: true,
    prompts: [
      (el, x, f) => `Out of every ${per(x)} atoms of ${el}, ${listed(x.masses.map((m, i) => `${f[i]} are ${el}-${m}`))}. Calculate the relative atomic mass of ${el}, ${toOneDp}.`,
      (el, x, f) => `In a sample of ${el}, every ${per(x)} atoms are made up of ${listed(x.masses.map((m, i) => `${f[i]} atoms of ${el}-${m}`))}. Calculate the relative atomic mass of ${el}, ${toOneDp}.`,
    ],
  },
  {
    name: 'sample',
    atoms: false,
    prompts: [
      (el, x, f) => `A sample of ${el} contains ${listed(x.masses.map((m, i) => `${el}-${m} (${f[i]}%)`))}. Calculate the relative atomic mass of ${el}, ${toOneDp}.`,
      (el, x, f) => `The isotopes in a sample of ${el} are ${listed(x.masses.map((m, i) => `${el}-${m} (${f[i]}%)`))}. Calculate its relative atomic mass, ${toOneDp}.`,
    ],
  },
]
/** Counting atoms: whole per cents are atoms in every hundred, tenths are atoms in every thousand. */
const per = (x: Abundances) => (x.step === 1 ? 100 : 1000)

export const relativeAtomicMass: Generator = {
  id: 'relative-atomic-mass-from-abundance',
  subjectId: 'chemistry',
  topicId: ATOMS,
  replaces: ['q6'],
  build(r, slot, turn) {
    const ctx = MEAN_CONTEXTS[turn % MEAN_CONTEXTS.length]!
    const x = evenly(r, `relative-atomic-mass-from-abundance:${ctx.name}`, abundances, (y) => y.answer)
    const el = nameOf(x.symbol)
    const T = ctx.atoms ? per(x) : 100
    const k = T / 100
    // The figures as printed: atoms are whole numbers, per cents keep their tenths (95.0%).
    const amounts = x.amounts.map((a) => clean(a * k))
    const figs = amounts.map((a) => (ctx.atoms || x.step === 1 ? show(a) : fixed(a, 1)))
    const products = amounts.map((a, i) => clean(a * x.masses[i]!))
    const total = clean(products.reduce((t, p) => t + p, 0))
    const raw = clean(total / T)
    const major = x.masses[amounts.indexOf(Math.max(...amounts))]!
    const [lo, hi] = [x.masses[0]!, x.masses.at(-1)!]
    const where =
      x.masses.length === 2
        ? `It lies between ${lo} and ${hi}, nearer ${major}, the more abundant isotope.`
        : `It lies between ${lo} and ${hi}, pulled towards ${major}, the most abundant isotope.`
    const solution =
      `$${figs.map((fg, i) => `(${fg} \\times ${x.masses[i]})`).join(' + ')} = ${products.map(tex).join(' + ')} = ${tex(total)}$, ` +
      `and $${tex(total)} \\div ${T} = ${show(raw)}$, so **${show(x.answer)}** ${toOneDp}. ${where}`
    // Second route: the lightest mass plus each heavier isotope's share of the extra mass.
    const second = clean(lo + amounts.reduce((t, a, i) => t + (a * (x.masses[i]! - lo)) / T, 0))
    return numeric(
      slot,
      {
        prompt: pick(r, ctx.prompts)(el, x, figs),
        solution,
        method: ['multiplies each mass by its abundance', `divides the total by ${T}`],
        answer: x.answer,
        tolerance: toPlaces(x.answer, 1),
      },
      { agrees: near(roundTo(second, 1), x.answer) && near(raw, x.raw) && near(clean(x.amounts.reduce((t, a) => t + a, 0)), 100), detail: `${lo} + extra = ${show(second)}` },
      { context: ctx.name, symbol: x.symbol, step: x.step },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// atoms-ions-and-isotopes q7: electrons in an ion
// ---------------------------------------------------------------------------------------------

/**
 * Ions with the charges GCSE gives them (4.1.1.4, 4.2.1.2, 4.8.3): Groups 1, 2, 3, 6 and 7 and
 * nitrogen and phosphorus, and the transition metal ions the tests for ions name, with a few more
 * of theirs. Selenide (Group 6, like oxide and sulfide) gives the 2- ions a third answer.
 * Beryllium is left out: Be2+ keeps 2 electrons, its own charge.
 */
const IONS: [string, number, string][] = [
  ['Li', 1, 'lithium'], ['Na', 1, 'sodium'], ['K', 1, 'potassium'], ['Rb', 1, 'rubidium'], ['Cs', 1, 'caesium'],
  ['Mg', 2, 'magnesium'], ['Ca', 2, 'calcium'], ['Sr', 2, 'strontium'], ['Ba', 2, 'barium'], ['Al', 3, 'aluminium'],
  ['Fe', 2, 'iron(II)'], ['Fe', 3, 'iron(III)'], ['Cu', 2, 'copper(II)'], ['Zn', 2, 'zinc'], ['Ag', 1, 'silver'],
  ['Pb', 2, 'lead(II)'], ['Ni', 2, 'nickel(II)'], ['Co', 2, 'cobalt(II)'], ['Mn', 2, 'manganese(II)'], ['Cr', 3, 'chromium(III)'], ['Sn', 2, 'tin(II)'],
  ['F', -1, 'fluoride'], ['Cl', -1, 'chloride'], ['Br', -1, 'bromide'], ['I', -1, 'iodide'],
  ['O', -2, 'oxide'], ['S', -2, 'sulfide'], ['Se', -2, 'selenide'], ['N', -3, 'nitride'], ['P', -3, 'phosphide'],
]
interface Ion {
  symbol: string
  charge: number
  name: string
  z: number
  electrons: number
}
/** The ion as the written prompt prints it, plainly: O2-, Na+, Fe3+. */
const ionText = (x: Ion) => `${x.symbol}${Math.abs(x.charge) === 1 ? '' : Math.abs(x.charge)}${x.charge > 0 ? '+' : '-'}`
/** The charge as the mark scheme names it: 2-, 1+. */
const chargeText = (q: number) => `${Math.abs(q)}${q > 0 ? '+' : '-'}`
/** Electron arrangement up to calcium, as GCSE draws it: 2,8,8. */
function arrangement(e: number): string {
  const shells: number[] = []
  for (const cap of [2, 8, 8, 2]) {
    if (e <= 0) break
    shells.push(Math.min(cap, e))
    e -= cap
  }
  return shells.join(',')
}
const ions = (sign: 1 | -1): Ion[] =>
  IONS.filter(([, q]) => Math.sign(q) === sign)
    .map(([symbol, charge, name]) => ({ symbol, charge, name, z: zOf(symbol), electrons: zOf(symbol) - charge }))
    // A charge of 1 prints no figure (Na+), so only a printed charge is a given to keep clear of.
    .filter((x) => clearOf(x.electrons, x.z, ...(Math.abs(x.charge) > 1 ? [Math.abs(x.charge)] : [])))

const ION_PROMPTS = [
  (x: Ion, el: string) => `${cap(an(x.name))} ${x.name} ion is written ${ionText(x)}. ${cap(el)} has atomic number ${x.z}. How many electrons does the ion have?`,
  (x: Ion, el: string) => `${cap(el)} (atomic number ${x.z}) forms the ${x.name} ion, ${ionText(x)}. How many electrons are there in one ${x.name} ion?`,
  (x: Ion, el: string) => `How many electrons are there in ${an(x.name)} ${x.name} ion, ${ionText(x)}? The atomic number of ${el} is ${x.z}.`,
  (x: Ion, el: string) => `The atomic number of ${el} is ${x.z}. How many electrons does the ${ionText(x)} ion have?`,
  (x: Ion, el: string) => `${cap(an(x.name))} ${x.name} ion has the formula ${ionText(x)}, and ${el} has atomic number ${x.z}. How many electrons are in the ion?`,
]
const ION_CONTEXTS: { name: string; sign: 1 | -1 }[] = [
  { name: 'positive', sign: 1 },
  { name: 'negative', sign: -1 },
]

export const electronsInAnIon: Generator = {
  id: 'electrons-in-an-ion',
  subjectId: 'chemistry',
  topicId: ATOMS,
  replaces: ['q7'],
  build(r, slot, turn) {
    const ctx = ION_CONTEXTS[turn % ION_CONTEXTS.length]!
    // The charge first, evenly, then the ion: drawing by answer alone made the 1- ions (the only
    // ones with 36 and 54 electrons) two builds in three, so "add one" paid 68% of the time.
    const x = byFirst(r, `electrons-in-an-ion:${ctx.name}`, () => ions(ctx.sign), (y) => y.charge, (y) => y.electrons)
    const el = nameOf(x.symbol)
    const q = Math.abs(x.charge)
    const lost = x.charge > 0
    const sum = lost ? `${x.z} - ${q}` : `${x.z} - (-${q})`
    const shells = x.z <= 20 ? `, giving ${arrangement(x.electrons)} — a full outer shell` : ''
    const solution = `$${sum} = ${x.electrons}$ electrons. ${cap(el)} has ${x.z} protons, and the atom has **${lost ? 'lost' : 'gained'} ${word(q)}** electron${q > 1 ? 's' : ''}${shells}.`
    return numeric(
      slot,
      {
        prompt: pick(r, ION_PROMPTS)(x, el),
        solution,
        method: [`accounts for the ${chargeText(x.charge)} charge`],
        answer: x.electrons,
      },
      // Second route: the protons less the electrons give back the ion's charge.
      { agrees: zOf(x.symbol) - x.electrons === x.charge && x.electrons > 0, detail: `${x.z} protons - ${x.electrons} electrons = ${x.charge}` },
      { context: ctx.name, ion: ionText(x), z: x.z },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// ionic-bonding q12: how many of one ion for so many of the other
// ---------------------------------------------------------------------------------------------

const IONIC = 'ionic-bonding'

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
/** An ion as the written prompt prints it, with Unicode: M³⁺, O²⁻, Cl⁻. */
const sup = (symbol: string, q: number) => `${symbol}${Math.abs(q) === 1 ? '' : SUP[Math.abs(q)]}${q > 0 ? '⁺' : '⁻'}`
const SUBS = '₀₁₂₃₄₅₆₇₈₉'
const subscript = (n: number) => (n === 1 ? '' : SUBS[n]!)

/** Anions and their charges, two names to each charge so far as GCSE has them. */
const ANIONS: { name: string; symbol: string; charge: number }[] = [
  { name: 'chloride', symbol: 'Cl', charge: 1 },
  { name: 'fluoride', symbol: 'F', charge: 1 },
  { name: 'bromide', symbol: 'Br', charge: 1 },
  { name: 'oxide', symbol: 'O', charge: 2 },
  { name: 'sulfide', symbol: 'S', charge: 2 },
  { name: 'nitride', symbol: 'N', charge: 3 },
]
interface Ratio {
  /** The metal ion's charge, the anion's, and how many of the given ion. */
  a: number
  b: number
  k: number
  answer: number
}
/** The direction asked: anions for so many metal ions, or metal ions for so many anions. */
type Direction = 'anions' | 'metal ions'
/**
 * Every metal charge 1+ to 3+, anion charge 1- to 3- and count of the given ion from two to
 * twelve where the other count is whole and 18 at most. The answer is none of the three figures the student
 * reads (the written M³⁺, O²⁻, two → 3 is left out: "the answer is the metal's charge" would
 * pay) and the given count is neither charge.
 */
function ratios(d: Direction): Ratio[] {
  const out: Ratio[] = []
  for (const a of [1, 2, 3])
    for (const b of [1, 2, 3])
      for (const k of range(2, 12)) {
        const answer = d === 'anions' ? (k * a) / b : (k * b) / a
        if (!Number.isInteger(answer) || answer < 2 || answer > 18 || [a, b, k].includes(answer) || k === a || k === b) continue
        out.push({ a, b, k, answer })
      }
  return out
}
const LETTERS = ['M', 'X', 'Q']

export const ionRatio: Generator = {
  id: 'ionic-formula-ratio',
  subjectId: 'chemistry',
  topicId: IONIC,
  replaces: ['q12'],
  build(r, slot, turn) {
    const d: Direction = (['anions', 'metal ions'] as const)[turn % 2]!
    // The pair of charges first, evenly, then the count: drawing the answer first let a 1- anion
    // fill over half the builds and six of the given ion nearly half.
    const pair = evenly(r, `ionic-formula-ratio:${d}:pair`, () => ratios(d), (y) => y.a * 10 + y.b)
    const x = evenly(r, `ionic-formula-ratio:${d}:${pair.a}${pair.b}`, () => ratios(d).filter((y) => y.a === pair.a && y.b === pair.b), (y) => y.k)
    const anion = pick(r, ANIONS.filter((y) => y.charge === x.b))
    const M = pick(r, LETTERS)
    const cation = sup(M, x.a)
    const anionIon = sup(anion.symbol, -x.b)
    const metal = `${cation} ions`
    const anions = `${anion.name} ions, ${anionIon}`
    const lead = `A metal ${M} forms ${cation} ions. In its ${anion.name}, how many`
    const prompt =
      d === 'anions'
        ? `${lead} ${anions}, are there for every ${word(x.k)} ${metal}? Give your answer as a number.`
        : `${lead} ${metal} are there for every ${word(x.k)} ${anions}? Give your answer as a number.`
    const charge = x.k * (d === 'anions' ? x.a : x.b)
    const g = gcd(x.a, x.b)
    const formula = `${M}${subscript(x.b / g)}${anion.symbol}${subscript(x.a / g)}`
    const solution =
      d === 'anions'
        ? `${cap(word(x.k))} ${cation} carry ${charge}+. Each ${anionIon} carries ${x.b}−, so **${x.answer}** are needed to give ${charge}−: ${formula}.`
        : `${cap(word(x.k))} ${anionIon} carry ${charge}−. Each ${cation} carries ${x.a}+, so **${x.answer}** are needed to give ${charge}+: ${formula}.`
    // Second route: the simplest formula's ratio, scaled to the count given.
    const [metals, nonmetals] = [x.b / g, x.a / g]
    const second = d === 'anions' ? (x.k / metals) * nonmetals : (x.k / nonmetals) * metals
    return numeric(
      slot,
      { prompt, solution, method: [], answer: x.answer },
      { agrees: near(second, x.answer) && metals * x.a === nonmetals * x.b, detail: `${formula}: ${x.k} given → ${second}` },
      { context: d, a: x.a, b: x.b, k: x.k, anion: anion.name },
    )
  },
}
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

// ---------------------------------------------------------------------------------------------
// carbon-structures-and-nanoparticles q16: surface area to volume ratio of cubes
// ---------------------------------------------------------------------------------------------

const CARBON = 'carbon-structures-and-nanoparticles'

/**
 * Cube sides from 1 to 100 nm, the specification's nanoparticle range (4.2.4.1), whose ratio
 * 6 ÷ side ends: 1 nm and 6 nm are left out (a ratio of 6 or 1), and 60 nm (0.1 per nm, the
 * point moved). 10 nm, whose ratio is 0.6, is the written slot's given cube and only a given.
 */
const SIDES = [2, 3, 4, 5, 8, 12, 15, 20, 24, 25, 30, 40, 50, 75, 80, 100]
const GIVEN_SIDES = [...SIDES, 10]
/** Cube-shaped nanoparticles that are made: silver, gold, platinum and iron oxide nanocubes. */
const NANO = ['silver', 'gold', 'platinum', 'iron oxide']

interface Cubes {
  s1: number
  s2: number
  r1: number
  answer: number
}
/**
 * Every pair of cubes where the asked cube is smaller (or larger) than the given one, the sides
 * are not the same digits with the point moved (the ratio would be too), and the answer is none
 * of the three figures printed, nor one of them with the point moved.
 */
const cubes = (smaller: boolean): Cubes[] =>
  GIVEN_SIDES.flatMap((s1) =>
    SIDES.filter((s2) => (smaller ? s2 < s1 : s2 > s1))
      .map((s2) => ({ s1, s2, r1: clean(6 / s1), answer: clean(6 / s2) }))
      .filter(({ s1, s2, r1, answer }) => !tenfold(s1, s2) && distinct(s1, s2, r1) && shiftFree(answer, s1, s2, r1)),
  )

const CUBE_PROMPTS = [
  (x: Cubes) => `A cube-shaped nanoparticle of side ${x.s1} nm has a surface area to volume ratio of ${show(x.r1)} per nm. What is the ratio for a cube of side ${x.s2} nm? Give your answer in the same units.`,
  (x: Cubes, m: string) =>
    `A cube-shaped ${m} nanoparticle has sides of ${x.s1} nm and a surface area to volume ratio of ${show(x.r1)} per nm. What is the surface area to volume ratio of a cube-shaped ${m} nanoparticle of side ${x.s2} nm? Give your answer in the same units.`,
  (x: Cubes, m: string) =>
    `Nanocubes of ${m} with sides of ${x.s1} nm have a surface area to volume ratio of ${show(x.r1)} per nm. What is the ratio for ${m} nanocubes with sides of ${x.s2} nm? Give your answer in the same units.`,
]

export const surfaceAreaToVolume: Generator = {
  id: 'nanoparticle-surface-area-to-volume',
  subjectId: 'chemistry',
  topicId: CARBON,
  replaces: ['q16'],
  build(r, slot, turn) {
    const smaller = turn % 2 === 0
    const x = evenly(r, `nanoparticle-surface-area-to-volume:${smaller}`, () => cubes(smaller), (y) => y.answer)
    const area = 6 * x.s2 ** 2
    const volume = x.s2 ** 3
    const k = smaller ? x.s1 / x.s2 : x.s2 / x.s1
    const scale = Number.isInteger(k)
      ? ` ${smaller ? 'Dividing' : 'Multiplying'} the side by ${word(k)} ${smaller ? 'multiplies' : 'divides'} the ratio by ${word(k)}.`
      : ` The ${smaller ? 'smaller cube has the larger' : 'larger cube has the smaller'} ratio.`
    const solution =
      `For a cube of side $s$ the surface area is $6s^2$ and the volume $s^3$, so the ratio is $6s^2 \\div s^3 = 6 \\div s$: ` +
      `$6 \\div ${x.s1} = ${show(x.r1)}$ per nm for the given cube. For a side of ${x.s2} nm the surface area is $6 \\times ${x.s2}^2 = ${tex(area)}\\text{ nm}^2$ ` +
      `and the volume $${x.s2}^3 = ${tex(volume)}\\text{ nm}^3$, so the ratio is ${closes(`${tex(area)} \\div ${tex(volume)}`, x.answer, 'per nm')}${scale}`
    return numeric(
      slot,
      {
        prompt: pick(r, CUBE_PROMPTS)(x, pick(r, NANO)),
        solution,
        method: [`Ratio = 6 ÷ side, or surface area ${prose(area)} nm² and volume ${prose(volume)} nm³`],
        answer: x.answer,
        // 6 ÷ a whole side ends exactly, so a student working from the givens lands on it: none, as written.
        tolerance: 0,
        units: 'per nm',
        line: show(x.answer),
      },
      // Second route: the given ratio scaled by how many times the side has shrunk or grown.
      { agrees: near(clean((x.r1 * x.s1) / x.s2), x.answer) && near(area / volume, x.answer), detail: `${show(x.r1)} × ${x.s1} ÷ ${x.s2} = ${show((x.r1 * x.s1) / x.s2)}` },
      { context: smaller ? 'smaller' : 'larger', s1: x.s1, s2: x.s2 },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// pure-substances-and-formulations q5: Rf values
// ---------------------------------------------------------------------------------------------

const PURE = 'pure-substances-and-formulations'

interface Paper {
  name: string
  intro: string
  /** Solvent front distances, cm, from a sheet of chromatography paper 10 to 15 cm tall. */
  front: [number, number]
}
const PAPERS: Paper[] = [
  { name: 'ink', intro: 'A student separates the dyes in a black ink by paper chromatography.', front: [5, 9.5] },
  { name: 'food colouring', intro: 'A student runs a paper chromatogram of a green food colouring.', front: [6, 11] },
  { name: 'leaf pigments', intro: 'A student separates the pigments in an extract of spinach leaves by paper chromatography.', front: [7, 12] },
]
interface Spot {
  d: number
  f: number
  rf: number
}
/**
 * Every front and spot, both to 0.1 cm, whose Rf ends within two decimal places. The spot stops
 * at least 0.5 cm short of the front and 0.5 cm past the start line. A front of 10.0 cm is left
 * out (the Rf would be the spot's distance with the point moved), and so are 5.5 and 11.0 cm
 * (3.3 ÷ 11.0 = 0.3 reads off the spot), as are Rf 0.5 (half), 0.1, and an Rf that is a given
 * doubled or halved with the point moved.
 */
const UNREADABLE = (f: number) => ![55, 100, 110].includes(Math.round(f * 10))
const spots = (p: Paper): Spot[] =>
  range(p.front[0], p.front[1], 0.1).flatMap((f) =>
    range(0.5, clean(f - 0.5), 0.1)
      .map((d) => ({ d, f, rf: clean(d / f) }))
      .filter(({ d, f, rf }) => UNREADABLE(f) && Number.isInteger(clean(rf * 100)) && rf >= 0.12 && rf <= 0.95 && rf !== 0.5 && !powerOfTen(rf) && clearOf(rf, d, f) && shiftFree(rf, d, f)),
  )

const RF_PROMPTS = [
  (p: Paper, d: string, f: string) => `${p.intro} A spot moves ${d} cm while the solvent front moves ${f} cm. Calculate the Rf value.`,
  (p: Paper, d: string, f: string) => `${p.intro} The solvent front is ${f} cm from the start line and one spot is ${d} cm from it. Calculate the Rf value of the spot.`,
  (p: Paper, d: string, f: string) => `${p.intro} One spot travels ${d} cm from the start line and the solvent travels ${f} cm. Calculate the Rf value of the spot.`,
]

export const rfValue: Generator = {
  id: 'chromatography-rf-value',
  subjectId: 'chemistry',
  topicId: PURE,
  replaces: ['q5'],
  build(r, slot, turn) {
    const p = PAPERS[turn % PAPERS.length]!
    // The front first, among those allowing three Rf values or more, then the Rf: drawing the Rf
    // alone let the front with the most divisors fill over half the builds.
    // Two-place Rf values (0.75, as written) in 60% of builds: one-place ones divide more often and
    // filled 78% when every Rf was equally likely.
    const dp = r() < 0.6 ? 2 : 1
    const x = byFirst(r, `chromatography-rf-value:${p.name}:${dp}`, () => spots(p).filter((y) => places(y.rf) === dp), (y) => y.f, (y) => y.rf, 3)
    const [d, f] = [fixed(x.d, 1), fixed(x.f, 1)]
    return numeric(
      slot,
      {
        prompt: pick(r, RF_PROMPTS)(p, d, f),
        solution: `$R_f = \\dfrac{${d}}{${f}} = ${show(x.rf)}$. No unit, because the centimetres cancel.`,
        method: ['divides spot distance by solvent distance'],
        answer: x.rf,
        tolerance: toPlaces(x.rf, 2),
      },
      // Second route: the Rf times the solvent front gives back the spot's distance.
      { agrees: near(clean(x.rf * x.f), x.d) && x.d < x.f, detail: `${show(x.rf)} × ${f} = ${show(x.rf * x.f)}` },
      { context: p.name, d: x.d, f: x.f },
    )
  },
}

export const structureGenerators: Generator[] = [neutronsInAnAtom, relativeAtomicMass, electronsInAnIon, ionRatio, surfaceAreaToVolume, rfValue]

/** For the tests. */
export const STRUCTURE = { NUCLIDES, ISOTOPES, IONS, ANIONS, SIDES, GIVEN_SIDES, NANO, PAPERS, nuclides, abundances, ions, ratios, cubes, spots, arrangement }
