import { fixed, roundTo, show } from '../format.ts'
import { figures, near, numeric } from '../physics/build.ts'
import { sfTolerance, sigText } from '../physics/format.ts'
import { pick, shuffle } from '../random.ts'
import type { Generator } from '../types.ts'
import { byFirst, clean, coef, distinct, equation, evenly, mr, noOnes, places, powerOfTen, range, shiftFree, sub, tenfold, toPlaces, written, type Equation } from './build.ts'
import { nameOf } from './compounds.ts'

/**
 * Concentrations and titrations (AQA 8462, 4.3.4 and 4.3.5). Every numeric written question in
 * the topic has a generator here except q1 (how many cm³ in one dm³), a fact to recall with
 * nothing to vary.
 *
 * Titrations follow the lesson: hydrochloric, sulfuric or nitric acid against sodium or
 * potassium hydroxide, each a real neutralisation whose equation is checked for balance as this
 * file loads. The solution of unknown concentration is the one pipetted into the flask (20.0 or
 * 25.0 cm³); the known one is in the burette. Titres sit on a 50 cm³ burette's 0.05 cm³
 * scale, from 12 to 45 cm³, and concordant titres agree within 0.10 cm³. Lab solutions are
 * 0.05 to 2 mol/dm³. Every titration answer, and every amount in moles its working prints, is
 * exact at three significant figures or fewer, so a student who rounds each step to three
 * figures lands on the answer. q5, q11 and q12 also take a two-figure answer (sfTolerance at 2)
 * wherever that is within the 1.9% the tolerance is capped at.
 */
const TOPIC = 'concentrations-and-titrations'

/** Names compounds.ts does not hold. */
const LOCAL: Record<string, string> = { NaNO3: 'sodium nitrate' }
const called = (f: string) => LOCAL[f] ?? nameOf(f)

const CM3 = '\\text{ cm}^3'
const DM3 = '\\text{ dm}^3'


/** A volume in dm³ with the figures its cm³ reading carried: 25.0 is 0.0250, 22.45 is 0.02245, 250 is 0.25. */
export const dm3Text = (v: number, dp: number) => (dp === 0 ? show(v / 1000) : fixed(v / 1000, dp + 3))

/** The decimal places a printed figure shows, trailing zeros counted: 6 for 0.000930. */
export const dpOf = (text: string) => (text.includes('.') ? text.split('.')[1]!.length : 0)

/** A concentration or an amount to three significant figures, as titration working prints it: 0.150, 0.00200. */
const sf3 = (x: number) => (figures(x) <= 3 ? sigText(x, 3) : show(x))

// ---------------------------------------------------------------------------------------------
// q2: cm³ to dm³
// ---------------------------------------------------------------------------------------------

interface Volume {
  name: string
  /** Volumes in cm³ and the decimal places they are read to. */
  volumes: number[]
  dp: number
  text: (v: string) => string
}
const VOLUMES: Volume[] = [
  { name: 'plain', volumes: range(20, 950, 5), dp: 0, text: (v) => `What is ${v} cm³ in dm³?` },
  {
    name: 'titre',
    volumes: range(12, 45, 0.05),
    dp: 2,
    text: (v) => `A student adds ${v} cm³ of acid from a burette. What is this volume in dm³?`,
  },
  {
    name: 'measuring cylinder',
    volumes: range(10, 99.5, 0.5),
    dp: 1,
    text: (v) => `A measuring cylinder holds ${v} cm³ of solution. What is this volume in dm³?`,
  },
  {
    name: 'beaker of solution',
    volumes: range(50, 900, 10),
    dp: 0,
    text: (v) => `A beaker holds ${v} cm³ of copper(II) sulfate solution. What is this volume in dm³?`,
  },
]

export const cm3ToDm3: Generator = {
  id: 'concentration-cm3-to-dm3',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q2'],
  build(r, slot, turn) {
    const c = VOLUMES[turn % VOLUMES.length]!
    // 100 cm³ is 0.1 dm³: a power of ten in, a power of ten out.
    const v = pick(r, c.volumes.filter((x) => !powerOfTen(x)))
    const text = c.dp ? fixed(v, c.dp) : show(v)
    const answer = clean(v / 1000)
    return numeric(
      slot,
      {
        prompt: c.text(text),
        solution: `There are $1000${CM3}$ in $1${DM3}$, so $${text} \\div 1000 = $ **${dm3Text(v, c.dp)} dm³**.`,
        method: [],
        answer,
        // The reading's own places, three further on: 250 cm³ is 0.250 dm³ to the cm³.
        tolerance: toPlaces(answer, Math.max(places(answer), c.dp + 3)),
      },
      { agrees: near(clean(answer * 1000), v), detail: `${show(answer)} × 1000 = ${show(answer * 1000)} cm³` },
      { context: c.name, v },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q3: g/dm³ from a mass and a volume
// ---------------------------------------------------------------------------------------------

/** Solids dissolved in water, each soluble well beyond the most concentrated solution drawn. */
const SOLUTES = ['NaCl', 'CuSO4', 'C6H12O6', 'KNO3', 'NaOH', 'Na2CO3']
/** The volumetric flasks a school has: only these are "made up to". */
const FLASKS = [25, 50, 100, 200, 250, 500]
/** Volumes of solution a lab makes, in cm³. 100 and 1000 are left out: dividing by 0.1 or 1 moves only the point. */
const MADE_UP = [20, 25, 40, 50, 150, 200, 250, 400, 500]

interface MassConc {
  c: number
  m: number
  v: number
}
const massConcs = (): MassConc[] =>
  range(2, 150, 0.5).flatMap((c) =>
    MADE_UP.map((v) => ({ c, v, m: clean((c * v) / 1000) })).filter(
      ({ c, m, v }) => places(m) <= 2 && figures(c) <= 3 && m >= 0.5 && m <= 60 && noOnes(m) && shiftFree(c, m, v) && distinct(m, v) && !near(c, m + v / 1000) && !near(c, (m * v) / 1000),
    ),
  )

export const concentrationInGrams: Generator = {
  id: 'concentration-g-per-dm3',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q3'],
  build(r, slot, turn) {
    const f = SOLUTES[turn % SOLUTES.length]!
    const { c, m, v } = byFirst(r, 'concentration-g-per-dm3', massConcs, (x) => x.v, (x) => x.c, 4)
    const name = called(f)
    const prompt = pick(r, [
      `What is the concentration, in g/dm³, of ${show(m)} g of ${name} in ${show(v)} cm³ of solution?`,
      FLASKS.includes(v)
        ? `A student dissolves ${show(m)} g of ${name} in water and makes the solution up to ${show(v)} cm³ in a volumetric flask. What is its concentration in g/dm³?`
        : `A student dissolves ${show(m)} g of ${name} in water to make ${show(v)} cm³ of solution. What is its concentration in g/dm³?`,
      `${show(m)} g of ${name} is dissolved to make ${show(v)} cm³ of solution. What is the concentration of the solution, in g/dm³?`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: `$${show(v)}${CM3} = ${dm3Text(v, 0)}${DM3}$, so $\\dfrac{${show(m)}}{${dm3Text(v, 0)}} = $ **${show(c)} g/dm³**.`,
        method: [`${dm3Text(v, 0)} dm3`],
        answer: c,
        tolerance: toPlaces(c, Math.max(places(c), places(m))),
      },
      { agrees: near(clean((c * v) / 1000), m), detail: `${show(c)} × ${show(v)} ÷ 1000 = ${show((c * v) / 1000)} g` },
      { context: f, c, m, v },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q5: moles from a concentration and a volume
// ---------------------------------------------------------------------------------------------

/** Concentrations a lab makes up, to three significant figures at most. */
const LAB = [...range(0.05, 0.5, 0.005), ...range(0.51, 1, 0.01), ...range(1.05, 2, 0.05)].filter((c) => !powerOfTen(c))
/** Standard solutions for the burette: the concentrations a technician makes up for a class. */
const STANDARD = [0.05, 0.075, 0.08, 0.12, 0.125, 0.15, 0.2, 0.25, 0.3, 0.4]
/** A 50 cm³ burette read to 0.05 cm³: titres from 12 to 45 cm³. */
const TITRES = range(12, 45, 0.05)

interface Portion {
  name: string
  volumes: number[]
  dp: number
  concs: number[]
  /** Formulae it may be a solution of. */
  of: string[]
  text: (v: string, c: string, f: string) => string
}
const solution = (f: string) => (called(f).endsWith('acid') ? called(f) : `${called(f)} solution`)
const PORTIONS: Portion[] = [
  {
    name: 'pipette',
    // 25.0 cm³ only: 20.0 makes the moles the concentration doubled with the point moved, 50.0 halved.
    volumes: [25],
    dp: 1,
    concs: LAB,
    of: ['NaOH', 'KOH', 'HCl', 'CuSO4', 'NaCl'],
    text: (v, c, f) => `A pipette transfers ${v} cm³ of ${c} mol/dm³ ${solution(f)} into a conical flask. How many moles of ${called(f)} is this?`,
  },
  {
    name: 'burette',
    volumes: TITRES,
    dp: 2,
    concs: STANDARD,
    of: ['HCl', 'HNO3', 'H2SO4', 'NaOH'],
    text: (v, c, f) => `In a titration, ${v} cm³ of ${c} mol/dm³ ${solution(f)} is added from a burette. How many moles of ${called(f)} were added?`,
  },
  {
    name: 'measuring cylinder',
    volumes: range(15, 95, 1),
    dp: 0,
    concs: LAB,
    of: ['CuSO4', 'NaCl', 'KNO3', 'NaOH', 'Na2CO3'],
    text: (v, c, f) => `How many moles are there in ${v} cm³ of ${c} mol/dm³ ${solution(f)}?`,
  },
]

interface Amount {
  c: number
  v: number
  n: number
}
const amounts = (p: Portion): Amount[] =>
  p.concs.flatMap((c) =>
    p.volumes
      .filter((v) => !powerOfTen(v))
      .map((v) => ({ c, v, n: clean((c * v) / 1000) }))
      .filter(({ c, v, n }) => figures(n) <= 3 && shiftFree(n, c, v) && distinct(c, v)),
  )

export const molesFromConcentration: Generator = {
  id: 'concentration-moles-in-solution',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q5'],
  build(r, slot, turn) {
    const p = PORTIONS[turn % PORTIONS.length]!
    const { c, v, n } = evenly(r, `concentration-moles-in-solution:${p.name}`, () => amounts(p), (x) => x.n)
    const f = pick(r, p.of)
    const vText = p.dp ? fixed(v, p.dp) : show(v)
    const vDm3 = dm3Text(v, p.dp)
    return numeric(
      slot,
      {
        prompt: p.text(vText, sigText(c, 3), f),
        solution: `$${vText}${CM3} = ${vDm3}${DM3}$, so $n = c \\times V = ${sigText(c, 3)} \\times ${vDm3} = $ **${sf3(n)} mol**.`,
        method: [`converts to ${vDm3} dm3`],
        answer: n,
        // A volume like 52 cm³ carries two figures, so a two-figure answer is marked right.
        tolerance: sfTolerance(n, 2),
      },
      { agrees: near(clean((n / c) * 1000), v), detail: `${show(n)} ÷ ${show(c)} = ${show(n / c)} dm³` },
      { context: p.name, c, v, n, formula: f },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q7: mol/dm³ to g/dm³
// ---------------------------------------------------------------------------------------------

interface Dissolved {
  f: string
  /** The most concentrated solution drawn, in mol/dm³. */
  max: number
}
const DISSOLVED: Dissolved[] = [
  { f: 'NaOH', max: 2 },
  { f: 'HCl', max: 2 },
  { f: 'H2SO4', max: 2 },
  { f: 'KOH', max: 2 },
  { f: 'HNO3', max: 2 },
  { f: 'NaCl', max: 2 },
  // Not CuSO4: 159.5 times a concentration has three figures for only three of them.
  { f: 'MgSO4', max: 1.5 },
  { f: 'Na2CO3', max: 1 },
]
/**
 * Every concentration to two decimal places whose mass in a dm³ prints to two places and three
 * figures at most, so a three-figure answer is the answer itself. A
 * concentration whose only digits are 1, 2 or 5 (0.1, 0.2, 0.05) makes the answer the Mr, or
 * the Mr doubled or halved, with the point moved: shiftFree refuses them.
 */
const toGrams = (d: Dissolved) =>
  range(0.05, d.max, 0.01)
    .map((c) => ({ c, g: clean(c * mr(d.f)) }))
    .filter(({ c, g }) => places(g) <= 2 && figures(g) <= 3 && distinct(c, mr(d.f)) && shiftFree(g, c, mr(d.f)) && !tenfold(c, 2) && !tenfold(c, 5) && !near(g, c + mr(d.f)))

export const molToGrams: Generator = {
  id: 'concentration-mol-to-grams',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q7'],
  build(r, slot, turn) {
    const d = DISSOLVED[turn % DISSOLVED.length]!
    const M = mr(d.f)
    const { c, g } = evenly(r, `concentration-mol-to-grams:${d.f}`, () => toGrams(d), (x) => x.g)
    const name = called(d.f)
    const given = `(Mr of ${sub(d.f)} = ${show(M)})`
    const prompt = pick(r, [
      `A solution is ${show(c)} mol/dm³ of ${name}. What is this in g/dm³? ${given}`,
      `A bottle of ${solution(d.f)} is labelled ${show(c)} mol/dm³. What is its concentration in g/dm³? ${given}`,
      `The concentration of some ${solution(d.f)} is ${show(c)} mol/dm³. What is its concentration in g/dm³? ${given}`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: `Each mole of ${sub(d.f)} has a mass of ${show(M)} g, so $${show(c)} \\times ${show(M)} = $ **${show(g)} g/dm³**.`,
        method: [`multiplies ${show(c)} by the Mr, ${show(M)}`],
        answer: g,
        tolerance: toPlaces(g, Math.max(places(g), places(c))),
      },
      { agrees: near(clean(g / M), c), detail: `${show(g)} ÷ ${show(M)} = ${show(g / M)} mol/dm³` },
      { context: d.f, c, g },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q9: the mean of three concordant titres
// ---------------------------------------------------------------------------------------------

/**
 * Three titres on the 0.05 cm³ scale agreeing within 0.10 cm³, in steps above the lowest. The
 * set 0, 1, 2 is left out: its mean is the middle titre, and "pick the middle one" would pay.
 * Three different titres within 0.10 cm³ can only be that set, so each of these repeats one.
 */
const SPREADS = [
  [0, 0, 1],
  [0, 1, 1],
  [0, 0, 2],
  [0, 2, 2],
]

interface Titration {
  /** The equation, as written in the lesson's order. */
  eq: Equation
  acid: string
  alkali: string
  /** Which solution is pipetted into the flask: its concentration is the unknown. */
  unknown: 'acid' | 'alkali'
}
const titration = (text: string, acid: string, alkali: string, unknown: 'acid' | 'alkali'): Titration => ({ eq: equation(text), acid, alkali, unknown })
const known = (t: Titration) => (t.unknown === 'acid' ? t.alkali : t.acid)
const unknownOf = (t: Titration) => (t.unknown === 'acid' ? t.acid : t.alkali)
const other = (t: Titration) => (t.unknown === 'acid' ? 'alkali' : 'acid')
/** Moles of the unknown for each mole of the known, from the balancing numbers. */
const ratio = (t: Titration) => coef(t.eq, unknownOf(t)) / coef(t.eq, known(t))
const nameT = (t: Titration) => `${called(t.alkali)} and ${called(t.acid)}${t.unknown === 'acid' ? ', acid in the flask' : ''}`

const ONE_TO_ONE: Titration[] = [
  titration('NaOH + HCl -> NaCl + H2O', 'HCl', 'NaOH', 'alkali'),
  titration('KOH + HNO3 -> KNO3 + H2O', 'HNO3', 'KOH', 'alkali'),
  titration('NaOH + HNO3 -> NaNO3 + H2O', 'HNO3', 'NaOH', 'acid'),
  titration('KOH + HCl -> KCl + H2O', 'HCl', 'KOH', 'acid'),
]
/** Sulfuric acid: the alkali doubles the acid's moles, and the acid halves the alkali's. */
const ONE_TO_TWO: Titration[] = [
  titration('H2SO4 + 2NaOH -> Na2SO4 + 2H2O', 'H2SO4', 'NaOH', 'alkali'),
  titration('H2SO4 + 2KOH -> K2SO4 + 2H2O', 'H2SO4', 'KOH', 'acid'),
  titration('H2SO4 + 2KOH -> K2SO4 + 2H2O', 'H2SO4', 'KOH', 'alkali'),
  titration('H2SO4 + 2NaOH -> Na2SO4 + 2H2O', 'H2SO4', 'NaOH', 'acid'),
]

interface MeanContext {
  name: string
  text: (titres: string, rough: string, t: Titration) => string
}
const MEAN_CONTEXTS: MeanContext[] = [
  { name: 'concordant titres', text: (x) => `What is the mean of the concordant titres ${x} cm³? Give your answer to two decimal places.` },
  {
    name: 'rough titre first',
    text: (x, rough) => `A student's rough titre is ${rough} cm³. The next three titres are ${x} cm³, and they are concordant. What is the mean of the concordant titres? Give your answer to two decimal places.`,
  },
  {
    name: 'named titration',
    text: (x, _, t) => `A student titrates ${solution(unknownOf(t))} with ${solution(known(t))}. The concordant titres are ${x} cm³. What is the mean titre, in cm³? Give your answer to two decimal places.`,
  },
]
const list = (xs: string[]) => `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`

export const meanTitre: Generator = {
  id: 'titration-mean-titre',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q9'],
  build(r, slot, turn) {
    const c = MEAN_CONTEXTS[turn % MEAN_CONTEXTS.length]!
    const low = pick(r, range(14, 44.5, 0.05))
    const steps = shuffle(r, pick(r, SPREADS))
    const xs = steps.map((s) => clean(low + 0.05 * s))
    const texts = xs.map((x) => fixed(x, 2))
    // A rough titre overshoots the end point by 0.40 to 1.50 cm³.
    const rough = clean(Math.max(...xs) + pick(r, range(0.4, 1.5, 0.05)))
    const sum = clean(xs[0]! + xs[1]! + xs[2]!)
    const raw = sum / 3
    const answer = roundTo(raw, 2)
    return numeric(
      slot,
      {
        prompt: c.text(list(texts), fixed(rough, 2), pick(r, ONE_TO_ONE)),
        solution: `$(${texts.join(' + ')}) \\div 3 = ${fixed(sum, 2)} \\div 3 = ${(Math.floor(raw * 10000) / 10000).toFixed(4)}\\ldots$, which is **${fixed(answer, 2)} cm³** to two decimal places.${c.name === 'rough titre first' ? ' The rough titre is left out: only concordant titres are averaged.' : ''}`,
        method: [`adds the three concordant titres: ${fixed(sum, 2)}`],
        answer,
        tolerance: toPlaces(answer, 2),
      },
      // Second route: the lowest titre plus the mean of the steps above it.
      { agrees: near(roundTo(low + (0.05 * (steps[0]! + steps[1]! + steps[2]!)) / 3, 2), answer), detail: `${fixed(low, 2)} + 0.05 × ${steps.join('+')} ÷ 3` },
      { context: c.name, low, answer, rough },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q10: mol/dm³ from a mass dissolved and a volume
// ---------------------------------------------------------------------------------------------

/** Solids weighed out and made up to a solution; the cap keeps each well below its solubility. */
const WEIGHED: Dissolved[] = [
  { f: 'NaOH', max: 2 },
  { f: 'NaCl', max: 2 },
  { f: 'CuSO4', max: 0.9 },
  { f: 'Na2CO3', max: 1 },
  { f: 'KNO3', max: 1.4 },
  { f: 'C6H12O6', max: 0.8 },
]
/** Volumes of solution made up, in cm³. 100 and 1000 are left out, and 500 and 200, which only double or halve-and-shift the moles. */
const MADE_UP_MOL = [40, 50, 80, 125, 150, 250, 300, 400, 750, 800]

interface Made {
  c: number
  v: number
  n: number
  m: number
}
const madeUp = (d: Dissolved): Made[] => {
  const M = mr(d.f)
  return range(0.05, d.max, 0.01).flatMap((c) =>
    MADE_UP_MOL.map((v) => {
      const n = clean((c * v) / 1000)
      return { c, v, n, m: clean(n * M) }
    }).filter(
      ({ c, v, n, m }) =>
        places(n) <= 4 && figures(n) <= 3 && places(m) <= 2 && m >= 0.5 && m <= 60 && !powerOfTen(n) && !powerOfTen(c) && noOnes(m, c) && shiftFree(c, m, n, M, v) && distinct(m, v, M),
    ),
  )
}

export const concentrationFromMass: Generator = {
  id: 'concentration-mol-from-mass',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q10'],
  build(r, slot, turn) {
    const d = WEIGHED[turn % WEIGHED.length]!
    const M = mr(d.f)
    const { c, v, n, m } = byFirst(r, `concentration-mol-from-mass:${d.f}`, () => madeUp(d), (x) => x.v, (x) => x.c, 4)
    const name = called(d.f)
    const given = `(Mr of ${sub(d.f)} = ${show(M)})`
    const prompt = pick(r, [
      `${show(m)} g of ${name} is dissolved to make ${show(v)} cm³ of solution. What is its concentration in mol/dm³? ${given}`,
      FLASKS.includes(v)
        ? `A student dissolves ${show(m)} g of ${name} in water and makes the solution up to ${show(v)} cm³ in a volumetric flask. What is the concentration of the solution, in mol/dm³? ${given}`
        : `A student dissolves ${show(m)} g of ${name} in water to make ${show(v)} cm³ of solution. What is the concentration of the solution, in mol/dm³? ${given}`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: `Moles $= \\dfrac{${show(m)}}{${show(M)}} = ${show(n)}$; volume $= ${dm3Text(v, 0)}${DM3}$; concentration $= \\dfrac{${show(n)}}{${dm3Text(v, 0)}} = $ **${show(c)} mol/dm³**.`,
        method: [`${show(n)} mol`, `${dm3Text(v, 0)} dm3`],
        answer: c,
        tolerance: toPlaces(c, Math.max(places(c), places(m))),
      },
      { agrees: near(clean(((c * v) / 1000) * M), m), detail: `${show(c)} × ${show(v / 1000)} × ${show(M)} = ${show((c * v * M) / 1000)} g` },
      { context: d.f, c, v, n, m },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q11, q12 and q15: the unknown concentration from a titration
// ---------------------------------------------------------------------------------------------

/**
 * The pipettes: 20.0 and 25.0 cm³ (10.0 would only move the point). Where the unknown has twice
 * the known's moles, 20.0 cm³ makes the answer its moles times 100, so those q12 contexts and
 * one q15 context are 25.0 cm³ only; elsewhere 25.0 cm³ is a little over half the draws.
 */
const PIPETTES = [20, 25]

interface Titrated {
  ck: number
  v: number
  titre: number
  nk: number
  nu: number
  cu: number
}
/**
 * Every standard solution, pipette and titre whose moles and unknown concentration are exact at
 * three significant figures, the concentration from 0.05 to below 1 mol/dm³, and is none of the figures printed, nor
 * one doubled or halved, nor the moles a student might stop at with the point moved.
 */
function titrated(t: Titration): Titrated[] {
  const k = ratio(t)
  const out: Titrated[] = []
  for (const ck of STANDARD) {
    for (const v of PIPETTES) {
      for (const titre of TITRES) {
        const nk = clean((ck * titre) / 1000)
        const nu = clean(nk * k)
        const cu = clean((nu * 1000) / v)
        // Every amount the working prints is exact at three figures: rounding 0.001836 to 0.00184 would miss.
        if (figures(nk) > 3 || figures(nu) > 3 || figures(cu) > 3 || cu < 0.05 || cu >= 1) continue
        if (!distinct(ck, titre, v) || !shiftFree(cu, ck, titre, v) || tenfold(cu, nk) || tenfold(cu, nu)) continue
        out.push({ ck, v, titre, nk, nu, cu })
      }
    }
  }
  return out
}

const role = (t: Titration) => t.unknown
/** "25.0 cm³ of sodium hydroxide solution is neutralised by 22.45 cm³ of 0.150 mol/dm³ hydrochloric acid." */
const neutralised = (t: Titration, x: Titrated) =>
  `${fixed(x.v, 1)} cm³ of ${solution(unknownOf(t))} is neutralised by ${fixed(x.titre, 2)} cm³ of ${sigText(x.ck, 3)} mol/dm³ ${solution(known(t))}.`
const titrates = (t: Titration, x: Titrated) =>
  `A student titrates ${fixed(x.v, 1)} cm³ of ${solution(unknownOf(t))} with ${sigText(x.ck, 3)} mol/dm³ ${solution(known(t))}. The mean titre is ${fixed(x.titre, 2)} cm³.`

/** Moles of the known solution, the ratio step, and the unknown's moles. */
function ratioStep(t: Titration, x: Titrated): string {
  const k = ratio(t)
  if (k === 1) return `Ratio $1:1$, so the ${role(t)} is $${sf3(x.nu)}\\text{ mol}$.`
  const [a, b] = [coef(t.eq, t.acid), coef(t.eq, t.alkali)]
  const step = k > 1 ? `2 \\times ${sf3(x.nk)}` : `${sf3(x.nk)} \\div 2`
  return `The ratio of acid to alkali is $${a} : ${b}$, so the ${role(t)} is $${step} = ${sf3(x.nu)}\\text{ mol}$.`
}


function titrationGenerator(id: string, slots: string[], contexts: Titration[]): Generator {
  return {
    id,
    subjectId: 'chemistry',
    topicId: TOPIC,
    replaces: slots,
    build(r, slot, turn) {
      const t = contexts[turn % contexts.length]!
      const x = byFirst(r, `${id}:${t.eq.text}:${t.unknown}`, () => titrated(t), (y) => y.ck, (y) => y.cu)
      const k = ratio(t)
      const prompt = `${pick(r, [neutralised(t, x), titrates(t, x)])} ${written(t.eq)}. What is the concentration of the ${role(t)}, in mol/dm³?`
      const first = `Moles of ${other(t)} $= ${sigText(x.ck, 3)} \\times ${dm3Text(x.titre, 2)} = ${sf3(x.nk)}$.`
      const last = `Concentration $= \\dfrac{${sf3(x.nu)}}{${dm3Text(x.v, 1)}} = $ **${sigText(x.cu, 3)} mol/dm³**.`
      const warn = k === 1 ? '' : ` Assuming $1:1$ would ${k > 1 ? 'halve' : 'double'} the answer.`
      const method =
        k === 1
          ? [`moles of ${other(t)} = ${sf3(x.nk)}`, `divides by ${dm3Text(x.v, 1)}`]
          : [`moles of ${other(t)} = ${sf3(x.nk)}`, `${k > 1 ? 'doubles' : 'halves'} for the 1 : 2 ratio`, `divides by ${dm3Text(x.v, 1)}`]
      return numeric(
        slot,
        {
          prompt,
          solution: `${first} ${ratioStep(t, x)} ${last}${warn}`,
          method,
          answer: x.cu,
          tolerance: sfTolerance(x.cu, 2),
        },
        // Second route: c₁V₁ against c₂V₂, scaled by the balancing numbers, in cm³ throughout.
        { agrees: near(x.cu * x.v * coef(t.eq, known(t)), x.ck * x.titre * coef(t.eq, unknownOf(t))), detail: `${x.cu} × ${x.v} against ${x.ck} × ${x.titre} × ${k}` },
        { context: nameT(t), ck: x.ck, v: x.v, titre: x.titre, cu: x.cu },
      )
    },
  }
}

export const titrationOneToOne = titrationGenerator('titration-concentration', ['q11'], ONE_TO_ONE)
export const titrationOneToTwo = titrationGenerator('titration-concentration-sulfuric', ['q12'], ONE_TO_TWO)

interface InGrams extends Titrated {
  g: number
}
const inGrams = (t: Titration): InGrams[] => {
  const M = mr(unknownOf(t))
  return titrated(t)
    .map((x) => ({ ...x, g: clean(x.cu * M) }))
    .filter((x) => places(x.g) <= 2 && figures(x.g) <= 3 && distinct(x.ck, x.titre, x.v, M) && shiftFree(x.g, M, x.cu, x.ck, x.titre, x.v, x.nk))
}

export const titrationInGrams: Generator = {
  id: 'titration-concentration-in-grams',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q15'],
  build(r, slot, turn) {
    const t = ONE_TO_ONE[turn % ONE_TO_ONE.length]!
    const u = unknownOf(t)
    const M = mr(u)
    const x = byFirst(r, `titration-concentration-in-grams:${t.eq.text}:${t.unknown}`, () => inGrams(t), (y) => y.ck, (y) => y.g)
    const prompt = pick(r, [
      `A titration gives a mean titre of ${fixed(x.titre, 2)} cm³ of ${sigText(x.ck, 3)} mol/dm³ ${solution(known(t))} against ${fixed(x.v, 1)} cm³ of ${solution(u)}. ${written(t.eq)}. What is the concentration of the ${called(u)} in g/dm³? (Mr of ${sub(u)} = ${show(M)})`,
      `${titrates(t, x)} ${written(t.eq)}. What is the concentration of the ${called(u)}, in g/dm³? (Mr of ${sub(u)} = ${show(M)})`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: `Moles of ${other(t)} $= ${sigText(x.ck, 3)} \\times ${dm3Text(x.titre, 2)} = ${sf3(x.nk)}$. Ratio $1:1$, so the ${role(t)} is $${sf3(x.nu)}\\text{ mol}$. Concentration $= \\dfrac{${sf3(x.nu)}}{${dm3Text(x.v, 1)}} = ${sigText(x.cu, 3)}\\text{ mol/dm}^3$. In g/dm³: $${sigText(x.cu, 3)} \\times ${show(M)} = $ **${show(x.g)} g/dm³**.`,
        method: [`moles of ${other(t)} = ${sf3(x.nk)}`, `concentration ${sigText(x.cu, 3)} mol/dm3`, `multiplies by the Mr, ${show(M)}`],
        answer: x.g,
        tolerance: toPlaces(x.g, Math.max(places(x.g), 2)),
      },
      { agrees: near((x.g / M) * x.v, x.ck * x.titre), detail: `${x.g} ÷ ${M} × ${x.v} against ${x.ck} × ${x.titre}` },
      { context: nameT(t), ck: x.ck, v: x.v, titre: x.titre, cu: x.cu, g: x.g },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q17: the volume of the known solution needed
// ---------------------------------------------------------------------------------------------

interface Needed {
  cb: number
  cp: number
  v: number
  titre: number
  n: number
}
/** Concentrations for both solutions: three significant figures at most, from 0.05 to 1 mol/dm³. */
const BOTH = [...range(0.05, 0.5, 0.005), ...range(0.51, 1, 0.01)].filter((c) => !powerOfTen(c))
const NEEDED = new Map<string, Needed[]>()
/**
 * Every titre on the burette's scale reached from two lab concentrations and a pipette. The
 * titre is none of the figures printed, nor the pipette's volume doubled or halved (0.200
 * against 0.100 gives exactly half), and the two concentrations differ.
 */
function needed(): Needed[] {
  const hit = NEEDED.get('all')
  if (hit) return hit
  const out: Needed[] = []
  const lab = new Set(BOTH)
  for (const titre of TITRES) {
    for (const v of PIPETTES) {
      for (const cp of BOTH) {
        const cb = clean((cp * v) / titre)
        if (!lab.has(cb)) continue
        const n = clean((cp * v) / 1000)
        if (figures(n) > 3 || !distinct(cp, cb, v, titre) || !shiftFree(titre, cp, cb, v)) continue
        out.push({ cb, cp, v, titre, n })
      }
    }
  }
  NEEDED.set('all', out)
  return out
}

export const titreNeeded: Generator = {
  id: 'titration-volume-needed',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q17'],
  build(r, slot, turn) {
    const t = ONE_TO_ONE[turn % ONE_TO_ONE.length]!
    // Whole titres divide most cleanly and were a third of the answers: one in ten here.
    const whole = r() < 0.1
    const key = `titration-volume-needed:${whole ? 'whole' : 'part'}`
    const x = byFirst(r, key, () => needed().filter((y) => Number.isInteger(y.titre) === whole), (y) => y.v, (y) => y.titre)
    const [b, p] = [known(t), unknownOf(t)]
    const prompt = pick(r, [
      `${written(t.eq)}. What volume, in cm³, of ${sigText(x.cb, 3)} mol/dm³ ${solution(b)} is needed to neutralise ${fixed(x.v, 1)} cm³ of ${sigText(x.cp, 3)} mol/dm³ ${solution(p)}?`,
      `A student pipettes ${fixed(x.v, 1)} cm³ of ${sigText(x.cp, 3)} mol/dm³ ${solution(p)} into a conical flask and titrates it with ${sigText(x.cb, 3)} mol/dm³ ${solution(b)}. ${written(t.eq)}. What volume of ${solution(b)}, in cm³, will neutralise it?`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: `Moles of ${role(t)} $= ${sigText(x.cp, 3)} \\times ${dm3Text(x.v, 1)} = ${sf3(x.n)}$. Ratio $1:1$, so the ${other(t)} is $${sf3(x.n)}\\text{ mol}$. Volume $= \\dfrac{n}{c} = \\dfrac{${sf3(x.n)}}{${sigText(x.cb, 3)}} = ${show(x.titre / 1000)}${DM3} = $ **${fixed(x.titre, 2)} cm³**.`,
        method: [`moles of ${role(t)} = ${sf3(x.n)}`, `divides moles by concentration`],
        answer: x.titre,
        // A burette is read to 0.05 cm³: 43.8 and 43.7 for 43.75 are both a reading.
        tolerance: 0.05,
      },
      { agrees: near(x.titre * x.cb, x.cp * x.v), detail: `${x.titre} × ${x.cb} against ${x.cp} × ${x.v}` },
      { context: nameT(t), cb: x.cb, cp: x.cp, v: x.v, titre: x.titre },
    )
  },
}

export const concentrationGenerators: Generator[] = [
  cm3ToDm3,
  concentrationInGrams,
  molesFromConcentration,
  molToGrams,
  meanTitre,
  concentrationFromMass,
  titrationOneToOne,
  titrationOneToTwo,
  titrationInGrams,
  titreNeeded,
]

/** For the tests: the contexts and their limits. */
export const CONCENTRATION = { VOLUMES, SOLUTES, PORTIONS, DISSOLVED, WEIGHED, ONE_TO_ONE, ONE_TO_TWO, STANDARD, TITRES, SPREADS, MEAN_CONTEXTS, ratio, known, unknownOf, called }
