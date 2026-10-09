import { show } from '../format.ts'
import { draw, pick, type Rng } from '../random.ts'
import type { Generator } from '../types.ts'
import { cap, numeric, prose, tex } from './build.ts'

/**
 * Atomic structure (AQA 8463, topic 4): counting the particles in an atom, alpha decay and
 * half-life. Every numeric written question that a fresh number can stand in for has a
 * generator here. Every nucleus is a real isotope with its real atomic number, every alpha
 * emitter really decays by alpha emission, and every half-life is the one the isotope named
 * really has. Two written questions stay as written: the number of planets (stars and
 * galaxies q1) and the year the accelerating expansion was found (the Big Bang q5) are single
 * facts with no figure to vary.
 */
const ATOM = 'the-model-of-the-atom'
const RADIATION = 'radiation-and-nuclear-power'

/** "an americium", but "a uranium": the u is said "you". */
const an = (noun: string) => `${/^(?!ur)[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`

/** Element names and symbols by atomic number, for the isotopes below. */
const ELEMENTS: Record<number, [string, string]> = {
  3: ['lithium', 'Li'], 4: ['beryllium', 'Be'], 5: ['boron', 'B'], 6: ['carbon', 'C'], 7: ['nitrogen', 'N'], 8: ['oxygen', 'O'],
  9: ['fluorine', 'F'], 10: ['neon', 'Ne'], 11: ['sodium', 'Na'], 12: ['magnesium', 'Mg'], 13: ['aluminium', 'Al'], 14: ['silicon', 'Si'],
  15: ['phosphorus', 'P'], 16: ['sulfur', 'S'], 17: ['chlorine', 'Cl'], 18: ['argon', 'Ar'], 19: ['potassium', 'K'], 20: ['calcium', 'Ca'],
  21: ['scandium', 'Sc'], 22: ['titanium', 'Ti'], 23: ['vanadium', 'V'], 24: ['chromium', 'Cr'], 25: ['manganese', 'Mn'], 26: ['iron', 'Fe'],
  27: ['cobalt', 'Co'], 28: ['nickel', 'Ni'], 29: ['copper', 'Cu'], 30: ['zinc', 'Zn'], 31: ['gallium', 'Ga'], 32: ['germanium', 'Ge'],
  33: ['arsenic', 'As'], 34: ['selenium', 'Se'], 35: ['bromine', 'Br'], 36: ['krypton', 'Kr'], 37: ['rubidium', 'Rb'], 38: ['strontium', 'Sr'],
  39: ['yttrium', 'Y'], 40: ['zirconium', 'Zr'], 42: ['molybdenum', 'Mo'], 43: ['technetium', 'Tc'], 47: ['silver', 'Ag'], 48: ['cadmium', 'Cd'],
  50: ['tin', 'Sn'], 51: ['antimony', 'Sb'], 53: ['iodine', 'I'], 54: ['xenon', 'Xe'], 55: ['caesium', 'Cs'], 56: ['barium', 'Ba'],
  79: ['gold', 'Au'], 80: ['mercury', 'Hg'], 82: ['lead', 'Pb'], 83: ['bismuth', 'Bi'], 84: ['polonium', 'Po'], 85: ['astatine', 'At'],
  86: ['radon', 'Rn'], 87: ['francium', 'Fr'], 88: ['radium', 'Ra'], 89: ['actinium', 'Ac'], 90: ['thorium', 'Th'], 91: ['protactinium', 'Pa'],
  92: ['uranium', 'U'], 93: ['neptunium', 'Np'], 94: ['plutonium', 'Pu'], 95: ['americium', 'Am'], 96: ['curium', 'Cm'], 98: ['californium', 'Cf'],
}
const nameOf = (Z: number) => ELEMENTS[Z]![0]
const symbolOf = (Z: number) => ELEMENTS[Z]![1]

/** Real isotopes, [atomic number, mass number]: stable ones and the familiar radioactive ones. */
const ISOTOPES: [number, number][] = [
  [3, 7], [4, 9], [5, 11], [6, 13], [6, 14], [7, 15], [8, 17], [8, 18], [9, 19], [10, 22], [11, 23], [11, 24], [12, 25], [12, 26],
  [13, 27], [14, 29], [14, 30], [15, 31], [15, 32], [16, 33], [16, 34], [17, 35], [17, 37], [18, 40], [19, 39], [19, 41], [20, 44],
  [21, 45], [22, 48], [23, 51], [24, 52], [25, 55], [26, 56], [27, 59], [27, 60], [28, 58], [28, 60], [29, 63], [29, 65], [30, 64],
  [30, 66], [31, 69], [32, 74], [33, 75], [34, 80], [35, 79], [35, 81], [36, 84], [37, 85], [38, 88], [38, 90], [39, 89], [40, 90],
  [42, 98], [43, 99], [47, 107], [47, 109], [48, 114], [50, 120], [51, 121], [53, 127], [53, 131], [54, 132], [55, 133], [55, 137],
  [56, 138], [79, 197], [80, 202], [82, 206], [82, 207], [82, 208], [83, 209], [84, 210], [86, 222], [88, 226], [90, 232], [92, 235],
  [92, 238], [94, 239], [95, 241],
]

// ---------------------------------------------------------------------------------------------
// The model of the atom: protons, neutrons and electrons
// ---------------------------------------------------------------------------------------------

const NEUTRON_PROMPTS = [
  (_n: string, Z: number, A: number) => `An atom has a mass number of ${A} and an atomic number of ${Z}. How many neutrons does it have?`,
  (n: string, Z: number, A: number) => `An atom of ${n} has an atomic number of ${Z} and a mass number of ${A}. How many neutrons are in its nucleus?`,
  (n: string, Z: number, A: number) => `${cap(n)}-${A} has an atomic number of ${Z}. How many neutrons are in the nucleus of one of its atoms?`,
]

/**
 * Neutrons = mass number − atomic number: written as q3 (14 and 6, 8 neutrons, 2 marks). The
 * isotope is real and never one with as many neutrons as protons, whose answer would be the
 * atomic number given.
 */
export const neutronsInAnAtom: Generator = {
  id: 'neutrons-from-mass-and-atomic-number',
  subjectId: 'physics',
  topicId: ATOM,
  replaces: ['q3'],
  build(r, slot, turn) {
    const [Z, A] = pick(r, ISOTOPES.filter(([Z, A]) => A !== 2 * Z))
    const N = A - Z
    const k = turn % NEUTRON_PROMPTS.length
    // Second route: protons and neutrons together make the mass number.
    return numeric(
      slot,
      {
        prompt: NEUTRON_PROMPTS[k]!(nameOf(Z), Z, A),
        solution: `The mass number counts the protons and neutrons; the atomic number counts the protons alone. $${A} - ${Z} = $ **${N}** neutrons.`,
        method: [`mass number minus atomic number: $${A} - ${Z}$`],
        answer: N,
      },
      { agrees: Z + N === A && N !== Z && N > 1, detail: `${Z} + ${N} = ${Z + N}` },
      { context: `wording ${k + 1}`, element: nameOf(Z), Z, A },
    )
  },
}

const ELECTRON_PROMPTS = [
  (_n: string, Z: number, A: number) => `A neutral atom has an atomic number of ${Z} and a mass number of ${A}. How many electrons does it have?`,
  (n: string, Z: number, A: number) => `An atom of ${n} has a mass number of ${A} and an atomic number of ${Z}. The atom is neutral. How many electrons does it have?`,
  (n: string, Z: number, A: number) => `A neutral atom of ${n}-${A} has an atomic number of ${Z}. How many electrons does it have?`,
]

/**
 * Electrons in a neutral atom = the atomic number: written as q10 (11 and 23, 11 electrons, 2
 * marks). The answer is the atomic number given, which is the point; the isotope never has as
 * many neutrons as protons, so taking the mass number minus the atomic number cannot land on
 * the right answer by the wrong route.
 */
export const electronsInANeutralAtom: Generator = {
  id: 'electrons-in-a-neutral-atom',
  subjectId: 'physics',
  topicId: ATOM,
  replaces: ['q10'],
  build(r, slot, turn) {
    const [Z, A] = pick(r, ISOTOPES.filter(([Z, A]) => A !== 2 * Z))
    const k = turn % ELECTRON_PROMPTS.length
    return numeric(
      slot,
      {
        prompt: ELECTRON_PROMPTS[k]!(nameOf(Z), Z, A),
        solution: `In a neutral atom the number of electrons **equals** the number of protons, which is the atomic number: **${Z}**. The mass number, ${A}, counts the protons and neutrons in the nucleus, so it plays no part.`,
        method: ['electrons equal protons in a neutral atom'],
        answer: Z,
      },
      // Second route: the protons are the mass number less the neutrons, and the wrong route lands elsewhere.
      { agrees: A - (A - Z) === Z && A - Z !== Z, detail: `${A} − ${A - Z} neutrons = ${Z} protons; mass − atomic = ${A - Z}` },
      { context: `wording ${k + 1}`, element: nameOf(Z), Z, A },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Radiation: alpha decay
// ---------------------------------------------------------------------------------------------

/** Real alpha emitters, [atomic number, mass number]. */
const ALPHA: [number, number][] = [
  [92, 238], [92, 235], [92, 234], [92, 233], [90, 232], [90, 230], [90, 229], [90, 228], [88, 226], [88, 224], [88, 223],
  [86, 222], [86, 220], [86, 219], [84, 218], [84, 216], [84, 214], [84, 212], [84, 210], [94, 242], [94, 240], [94, 239],
  [94, 238], [95, 243], [95, 241], [96, 244], [96, 242], [98, 252], [93, 237], [89, 225], [87, 221],
]

const NEW_MASS_PROMPTS = [
  (_n: string, _Z: number, A: number) => `A nucleus of mass number ${A} emits an alpha particle. What is the new mass number?`,
  (n: string, _Z: number, A: number) => `A nucleus of ${n}-${A} emits an alpha particle. What is the mass number of the nucleus it becomes?`,
  (n: string, Z: number, A: number) => `${cap(n)}-${A} decays by emitting an alpha particle. Its atomic number is ${Z}. What is the mass number of the new nucleus?`,
  (n: string, Z: number, A: number) => `${cap(an(n))} nucleus has a mass number of ${A} and an atomic number of ${Z}. It emits an alpha particle. What is the new mass number?`,
  (_n: string, Z: number, A: number) => `The nucleus of an atom with mass number ${A} and atomic number ${Z} emits an alpha particle. What mass number does the new nucleus have?`,
]

/**
 * The mass number after alpha decay: written as q4 (238, 234, 2 marks). Every nucleus is a
 * real alpha emitter; where the prompt names it, the solution names what it becomes.
 */
export const massNumberAfterAlpha: Generator = {
  id: 'mass-number-after-alpha-decay',
  subjectId: 'physics',
  topicId: RADIATION,
  replaces: ['q4'],
  build(r, slot, turn) {
    const [Z, A] = pick(r, ALPHA)
    const k = turn % NEW_MASS_PROMPTS.length
    const after = A - 4
    const named = k > 0 && k < 4 ? ` The new nucleus is ${nameOf(Z - 2)}-${after}, with atomic number ${Z - 2}.` : ''
    return numeric(
      slot,
      {
        prompt: NEW_MASS_PROMPTS[k]!(nameOf(Z), Z, A),
        solution: `An alpha particle carries away 4 from the mass number: $${A} - 4 = $ **${after}**.${named}`,
        method: [`subtracts 4: $${A} - 4$`],
        answer: after,
      },
      // Second route: the new nucleus and the alpha particle together make the old mass number.
      { agrees: after + 4 === A && ELEMENTS[Z - 2] !== undefined, detail: `${after} + 4 = ${after + 4}` },
      { context: `wording ${k + 1}`, element: nameOf(Z), Z, A },
    )
  },
}

/** The equation as the written question prints it: $\mathrm{^{210}_{84}Po} \rightarrow …$. */
const nucleus = (A: number | string, Z: number) => `\\mathrm{^{${A}}_{${Z}}${symbolOf(Z)}}`
const equation = (top: number | string, Z: number, bottom: number | string) => `$${nucleus(top, Z)} \\rightarrow ${nucleus(bottom, Z - 2)} + \\mathrm{^{4}_{2}He}$`

/**
 * The missing mass number in an alpha-decay equation: written as q20 (polonium-210 to lead,
 * A = 206, 2 marks). The missing number is the new nucleus's or, on alternate turns, the
 * decaying one's, and the bottom row checks it as the written solution does.
 */
export const alphaEquationMassNumber: Generator = {
  id: 'alpha-equation-mass-number',
  subjectId: 'physics',
  topicId: RADIATION,
  replaces: ['q20'],
  build(r, slot, turn) {
    const [Z, A] = pick(r, ALPHA)
    const parent = nameOf(Z)
    const daughter = nameOf(Z - 2)
    const missingParent = turn % 2 === 1
    const after = A - 4
    let prompt: string
    let solution: string
    let line: string
    if (missingParent) {
      const eq = equation('A', Z, after)
      prompt = pick(r, [
        `${cap(an(parent))} nucleus emits an alpha particle and becomes ${daughter}-${after}: ${eq}. What is the mass number $A$ of the ${parent} nucleus?`,
        `Complete this alpha decay of ${parent}: ${eq}. What is the mass number $A$ of the ${parent} nucleus?`,
        `Alpha decay turns ${an(parent)} nucleus into ${daughter}-${after}: ${eq}. Find the mass number $A$ of the ${parent} nucleus.`,
      ])
      solution = `The top row must balance: $A = ${after} + 4$, so $A = $ **${A}**. The bottom row checks it: $${Z} = ${Z - 2} + 2$.`
      line = `$A = ${after} + 4$`
    } else {
      const eq = equation(A, Z, 'A')
      prompt = pick(r, [
        `${cap(parent)}-${A} emits an alpha particle: ${eq}. What is the mass number $A$ of the ${daughter} nucleus?`,
        `When ${parent}-${A} decays by alpha emission it becomes ${daughter}: ${eq}. Find the mass number $A$ of the ${daughter} nucleus.`,
        `Alpha decay turns ${parent}-${A} into ${daughter}: ${eq}. What is the mass number $A$ of the new nucleus?`,
      ])
      solution = `The top row must balance: $${A} = A + 4$, so $A = $ **${after}**. The bottom row checks it: $${Z} = ${Z - 2} + 2$.`
      line = `$${A} = A + 4$`
    }
    const answer = missingParent ? A : after
    return numeric(
      slot,
      { prompt, solution, method: [line], answer },
      // Second route: both rows balance.
      { agrees: after + 4 === A && Z - 2 + 2 === Z, detail: `${after} + 4 = ${A}; ${Z - 2} + 2 = ${Z}` },
      { context: missingParent ? 'parent missing' : 'daughter missing', element: parent, Z, A },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Radiation: half-life
// ---------------------------------------------------------------------------------------------

const COUNT = ['', '', 'two', 'three', 'four', 'five']
const HALVES = ['', '', 'twice', 'three times', 'four times', 'five times']

/** "800 \to 400 \to 200 \to " as the written solutions print the halving. */
const halving = (start: number, n: number) => Array.from({ length: n }, (_, i) => `${tex(start / 2 ** i)} \\to `).join('')

/**
 * The value whose spread matters first: the number of half-lives, then the final reading from
 * the range that keeps the starting one between `lo` and `hi`, in steps of `step`. A final or
 * starting reading that is a given figure with the point moved, doubled or halved is drawn
 * again: 11 000 Bq against a half-life of 110 minutes reads as one number twice.
 */
function decay(r: Rng, n: number, lo: number, hi: number, step: number, givens: number[]) {
  const from = Math.ceil(lo / 2 ** n / step)
  const to = Math.floor(hi / 2 ** n / step)
  return draw(
    r,
    (r) => step * (from + Math.floor(r() * (to - from + 1))),
    (end) => end > 1 && [end, end * 2 ** n].every((x) => givens.every((g) => ![1, 2, 5].includes(front(x / g)))),
  )
}
/** The front number of x: 4.8 for 0.048. */
function front(x: number): number {
  let m = Math.abs(x) / 10 ** Math.floor(Math.log10(Math.abs(x)))
  if (m >= 10 - 1e-9) m /= 10
  if (m < 1 - 1e-9) m *= 10
  return Number(m.toPrecision(10))
}

interface Isotope {
  /** Null for an unnamed source, as the written question has. */
  name: string | null
  halves: number[]
  unit: string
}
/** Isotopes with the half-lives they really have; unnamed sources take round ones. */
const SAMPLES: Isotope[] = [
  { name: 'technetium-99m', halves: [6], unit: 'hours' },
  { name: 'iodine-131', halves: [8], unit: 'days' },
  { name: 'sodium-24', halves: [15], unit: 'hours' },
  { name: 'phosphorus-32', halves: [14], unit: 'days' },
  { name: 'radon-222', halves: [3.8], unit: 'days' },
  { name: 'cobalt-60', halves: [5.3], unit: 'years' },
  { name: 'strontium-90', halves: [29], unit: 'years' },
  { name: 'caesium-137', halves: [30], unit: 'years' },
  { name: 'iodine-123', halves: [13], unit: 'hours' },
  { name: 'bismuth-214', halves: [20], unit: 'minutes' },
  { name: 'fluorine-18', halves: [110], unit: 'minutes' },
  { name: 'carbon-14', halves: [5730], unit: 'years' },
  { name: null, halves: [2, 3, 4, 5, 6, 8, 10, 12], unit: 'hours' },
  { name: null, halves: [3, 4, 6, 8, 12, 15, 20, 25], unit: 'minutes' },
]

/**
 * Activity after a whole number of half-lives: written as q6 (800 Bq, 2 hours, after 6 hours,
 * 100 Bq, 3 marks). The number of half-lives is drawn first, from 2 to 5, then the final
 * activity, so the starting one lies between 200 and 20 000 Bq.
 */
export const activityAfterHalfLives: Generator = {
  id: 'activity-after-half-lives',
  subjectId: 'physics',
  topicId: RADIATION,
  replaces: ['q6'],
  build(r, slot, turn) {
    const c = SAMPLES[turn % SAMPLES.length]!
    const half = pick(r, c.halves)
    const n = 2 + Math.floor(r() * 4)
    const time = Number(show(n * half))
    const end = decay(r, n, 200, 20000, 5, [half, time])
    const start = end * 2 ** n
    const h = `${prose(half)} ${c.unit}`
    const t = `${prose(time)} ${c.unit}`
    const prompt = c.name
      ? pick(r, [
          `A sample of ${c.name} has an activity of ${prose(start)} Bq. The half-life of ${c.name} is ${h}. What is its activity after ${t}, in Bq?`,
          `${cap(c.name)} has a half-life of ${h}. A source of ${c.name} has an activity of ${prose(start)} Bq. What will its activity be after ${t}, in Bq?`,
        ])
      : pick(r, [
          `A source of activity ${prose(start)} Bq has a half-life of ${h}. What is its activity after ${t}, in Bq?`,
          `A radioactive source has a half-life of ${h} and an activity of ${prose(start)} Bq. Calculate its activity after ${t}, in Bq.`,
        ])
    // Second route: the starting activity divided by 2 to the power of the half-lives.
    const direct = start / 2 ** (time / half)
    return numeric(
      slot,
      {
        prompt,
        solution: `$${tex(time)} \\div ${tex(half)} = ${n}$ half-lives, so halve ${HALVES[n]}: $${halving(start, n)}$ **${end} Bq**.`,
        method: [`${COUNT[n]} half-lives: $${tex(time)} \\div ${tex(half)} = ${n}$`, `halves ${HALVES[n]}`],
        answer: end,
        units: 'Bq',
        line: show(end),
      },
      { agrees: Math.abs(direct - end) < 1e-9 && Number.isInteger(end), detail: `${start} ÷ 2^${show(time / half)} = ${show(direct)}` },
      { context: c.name ?? `source in ${c.unit}`, start, half, n },
    )
  },
}

interface Counted {
  name: string | null
  /** Half-life and elapsed-time units, and how many of the first make one of the second. */
  small: string
  big: string
  per: number
  halves: number[]
}
/**
 * Sources whose half-life is in one unit and the time asked in a larger one, as q13 has. A
 * named isotope must fit several spans: bismuth-214 (20 minutes) fits only 1 hour and
 * technetium-99m (6 hours) only 1 day, so they would always ask the same thing.
 */
const COUNTED: Counted[] = [
  { name: null, small: 'seconds', big: 'minute', per: 60, halves: [15, 20, 24, 30, 36, 40, 45] },
  { name: null, small: 'minutes', big: 'hour', per: 60, halves: [15, 20, 24, 30, 36, 40, 45] },
  { name: null, small: 'hours', big: 'day', per: 24, halves: [8, 9, 12, 16, 18] },
  { name: 'phosphorus-32', small: 'days', big: 'week', per: 7, halves: [14] },
  { name: 'chromium-51', small: 'days', big: 'week', per: 7, halves: [28] },
]
/** Every half-life and number of half-lives, 2 to 5, that fill a whole or half number of the larger unit, at least one. */
const spans = (c: Counted) =>
  c.halves.flatMap((half) =>
    [2, 3, 4, 5]
      .map((n) => ({ half, n, time: (n * half) / c.per }))
      .filter(({ time }) => time >= 1 && Number.isInteger(time * 2)),
  )
const plural = (x: number, unit: string) => `${show(x)} ${x === 1 ? unit : `${unit}s`}`

/**
 * Count rate after a whole number of half-lives, with the time in a larger unit: written as
 * q13 (1600 counts per minute, 15 minutes, after 1 hour, 100, 3 marks with "four half-lives").
 * The conversion is the first mark, as the written scheme's "60 minutes ÷ 15 minutes" is.
 */
export const countRateAfterHalfLives: Generator = {
  id: 'count-rate-after-half-lives',
  subjectId: 'physics',
  topicId: RADIATION,
  replaces: ['q13'],
  build(r, slot, turn) {
    const c = COUNTED[turn % COUNTED.length]!
    // The number of half-lives first, then a span that has it, so neither n nor the time carries the context.
    const all = spans(c)
    const n = pick(r, [...new Set(all.map((x) => x.n))])
    const { half, time } = pick(r, all.filter((x) => x.n === n))
    const inSmall = time * c.per
    const end = decay(r, n, 200, 8000, 1, [half, time, inSmall])
    const start = end * 2 ** n
    const t = plural(time, c.big)
    const prompt = c.name
      ? pick(r, [
          `A detector near a sample of ${c.name} records ${prose(start)} counts per minute. ${cap(c.name)} has a half-life of ${half} ${c.small}. What will the count rate be after ${t}, in counts per minute?`,
          `A sample of ${c.name} gives a count rate of ${prose(start)} counts per minute. Its half-life is ${half} ${c.small}. What is the count rate after ${t}?`,
        ])
      : pick(r, [
          `A source has a count rate of ${prose(start)} counts per minute and a half-life of ${half} ${c.small}. What is the count rate after ${t}?`,
          `A radioactive source has a half-life of ${half} ${c.small}. Its count rate is ${prose(start)} counts per minute. What will the count rate be after ${t}, in counts per minute?`,
        ])
    // Second route: the starting rate divided by 2 to the power of the half-lives.
    const direct = start / 2 ** (inSmall / half)
    return numeric(
      slot,
      {
        prompt,
        solution: `${t} is ${show(inSmall)} ${c.small}, and ${show(inSmall)} ${c.small} ÷ ${half} ${c.small} = **${n}** half-lives. $${halving(start, n)}$ **${end}** counts per minute. Or $${tex(start)} \\div 2^${n} = ${tex(start)} \\div ${2 ** n} = ${end}$.`,
        method: [`converts ${t} to ${show(inSmall)} ${c.small}: $${show(inSmall)} \\div ${half} = ${n}$ half-lives`, `halves ${HALVES[n]} or divides by $2^${n}$`],
        answer: end,
      },
      { agrees: Math.abs(direct - end) < 1e-9 && Number.isInteger(end), detail: `${start} ÷ 2^${show(inSmall / half)} = ${show(direct)}` },
      { context: c.name ?? `source in ${c.small}`, start, half, time, n },
    )
  },
}

export const atomGenerators: Generator[] = [
  neutronsInAnAtom,
  electronsInANeutralAtom,
  massNumberAfterAlpha,
  alphaEquationMassNumber,
  activityAfterHalfLives,
  countRateAfterHalfLives,
]
