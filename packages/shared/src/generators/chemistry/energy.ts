import { fixed } from '../format.ts'
import { near, numeric, prose, tex } from '../physics/build.ts'
import { draw, int, pick, shuffle } from '../random.ts'
import type { Generator } from '../types.ts'
import { clean, clearOf, distinct, equation, evenly, noOnes, powerOfTen, range, toPlaces, written, type Equation, type Term } from './build.ts'

/**
 * Energy changes (AQA 8462, 4.5.1). Three numeric written slots in "Exothermic and endothermic
 * reactions" (a temperature change read from two thermometer readings, with and without its
 * sign, and the mean rise of required practical 4 with an anomaly left out) and two in "Reaction
 * profiles and bond energies" (broken minus formed, from two totals and from a named equation)
 * have generators here.
 *
 * The alcohols topic's two numeric slots (q5, q12) are left written: each balances the
 * combustion of one alcohol, and the specification names four (methanol to butanol), so only
 * four real equations exist, too few to vary.
 *
 * Every reaction in a polystyrene cup is one required practical 4 names (4.5.1.1): neutralisation,
 * acid plus metal and displacement warm the mixture; acid plus a hydrogencarbonate (the
 * specification's citric acid and sodium hydrogencarbonate among them) cools it. A thermometer
 * reads to 0.1 °C, room temperature is 16 to 24 °C, and each reaction's change stays within what
 * a cup of 25 to 50 cm³ of solution gives: a neutralisation of dilute solutions 3 to 13.5 °C,
 * magnesium in acid or zinc in copper(II) sulfate solution up to 18 to 20 °C, a hydrogencarbonate
 * 2 to 10 °C of cooling.
 */
const CUP_TOPIC = 'exothermic-and-endothermic-reactions'
const BOND_TOPIC = 'reaction-profiles-and-bond-energies'

/** A temperature as a thermometer reading to 0.1 °C prints it: 26.0, never 26. */
const t1 = (x: number) => fixed(x, 1)
/** A signed figure as a mark scheme prints it: −6.5 with a true minus sign, +70 with a plus. */
const signed = (text: string, x: number) => (x < 0 ? `−${text.replace(/^-/, '')}` : x > 0 ? `+${text}` : text)
const list = (xs: string[]) => (xs.length === 1 ? xs[0]! : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)

// ---------------------------------------------------------------------------------------------
// Reactions in a polystyrene cup
// ---------------------------------------------------------------------------------------------

interface Cup {
  name: string
  /** The sentence that sets the reaction up, ending in a full stop. */
  text: string
  /** The reaction run again, for the repeats of q11: "the reaction of zinc powder with copper(II) sulfate solution". */
  repeat: string
  warms: boolean
  /** The size of the change, in °C, from the smallest to the largest a cup of dilute solution gives. */
  change: [number, number]
}

/** Exothermic: neutralisations, an acid and a metal, a displacement. */
const WARMING: Cup[] = [
  {
    name: 'hydrochloric acid and sodium hydroxide',
    text: 'A student adds sodium hydroxide solution to dilute hydrochloric acid in a polystyrene cup.',
    repeat: 'the neutralisation of dilute hydrochloric acid by sodium hydroxide solution',
    warms: true,
    change: [3, 13.5],
  },
  {
    name: 'nitric acid and potassium hydroxide',
    text: 'A student mixes dilute nitric acid with potassium hydroxide solution in a polystyrene cup.',
    repeat: 'the neutralisation of dilute nitric acid by potassium hydroxide solution',
    warms: true,
    change: [3, 13.5],
  },
  {
    name: 'magnesium and hydrochloric acid',
    text: 'A student drops a piece of magnesium ribbon into dilute hydrochloric acid in a polystyrene cup.',
    repeat: 'the reaction of magnesium ribbon with dilute hydrochloric acid',
    warms: true,
    change: [4, 18],
  },
  {
    name: 'zinc and copper(II) sulfate',
    text: 'A student stirs zinc powder into copper(II) sulfate solution in a polystyrene cup.',
    repeat: 'the reaction of zinc powder with copper(II) sulfate solution',
    warms: true,
    change: [4, 20],
  },
]

/** Endothermic: an acid and a hydrogencarbonate, each giving carbon dioxide. */
const COOLING: Cup[] = [
  {
    name: 'citric acid and sodium hydrogencarbonate',
    text: 'A student adds sodium hydrogencarbonate to citric acid solution in a polystyrene cup.',
    repeat: 'the reaction of citric acid solution with sodium hydrogencarbonate',
    warms: false,
    change: [2, 10],
  },
  {
    name: 'hydrochloric acid and sodium hydrogencarbonate',
    text: 'A student adds solid sodium hydrogencarbonate to dilute hydrochloric acid in a polystyrene cup.',
    repeat: 'the reaction of dilute hydrochloric acid with sodium hydrogencarbonate',
    warms: false,
    change: [2, 8],
  },
  {
    name: 'hydrochloric acid and potassium hydrogencarbonate',
    text: 'A student adds solid potassium hydrogencarbonate to dilute hydrochloric acid in a polystyrene cup.',
    repeat: 'the reaction of dilute hydrochloric acid with potassium hydrogencarbonate',
    warms: false,
    change: [2, 9],
  },
  {
    name: 'ethanoic acid and sodium hydrogencarbonate',
    text: 'A student adds sodium hydrogencarbonate to dilute ethanoic acid in a polystyrene cup.',
    repeat: 'the reaction of dilute ethanoic acid with sodium hydrogencarbonate',
    warms: false,
    change: [2, 6],
  },
]

/** Room temperature at the start, to 0.1 °C. */
const STARTS = range(16, 24, 0.1)

interface Reading {
  start: number
  end: number
  /** End minus start, with its sign. */
  change: number
}
/**
 * Every start and size of change for one reaction. The size is never 1 or a power of ten, never a
 * reading nor one with the point moved, doubled or halved; the two readings differ in their whole
 * degrees, so the change is not read off the tenths.
 */
const readings = (c: Cup): Reading[] =>
  range(c.change[0], c.change[1], 0.1)
    .filter((d) => noOnes(d) && !powerOfTen(d))
    .flatMap((d) =>
      STARTS.map((start) => {
        const end = clean(c.warms ? start + d : start - d)
        return { start, end, change: clean(end - start) }
      }).filter(({ start, end, change }) => clearOf(Math.abs(change), start, end) && distinct(start, end, Math.abs(change))),
    )

const RISE_PROMPTS = [
  (c: Cup, s: string, e: string) => `${c.text} The mixture starts at ${s} °C and finishes at ${e} °C. What is the temperature change, in °C?`,
  (c: Cup, s: string, e: string) => `${c.text} The temperature of the mixture rises from ${s} °C to ${e} °C. What is the temperature change, in °C?`,
]
const FALL_PROMPTS = [
  (c: Cup, s: string, e: string) => `${c.text} The reaction mixture cools from ${s} °C to ${e} °C. What is the temperature change (final minus starting temperature, with its sign), in °C?`,
  (c: Cup, s: string, e: string) =>
    `${c.text} The mixture starts at ${s} °C and its temperature falls to ${e} °C. What is the temperature change (final minus starting temperature, with its sign), in °C?`,
]

/**
 * Final minus starting temperature: written as q5 (a rise, 19.5 to 26.0 °C, answer 6.5) and q7
 * (a fall with its sign, 21.0 to 14.5 °C, answer −6.5). q5 is always a warming reaction and q7
 * always a cooling one, as written: q5 asks for no sign, q7 asks for it.
 */
export const temperatureChange: Generator = {
  id: 'reaction-temperature-change',
  subjectId: 'chemistry',
  topicId: CUP_TOPIC,
  replaces: ['q5', 'q7'],
  build(r, slot, turn) {
    const cups = slot.id === 'q7' ? COOLING : WARMING
    const c = cups[turn % cups.length]!
    // The size of the change evenly first, then a starting temperature that fits.
    const x = evenly(r, `reaction-temperature-change:${c.name}`, () => readings(c), (y) => y.change)
    const [s, e] = [t1(x.start), t1(x.end)]
    const prompt = pick(r, c.warms ? RISE_PROMPTS : FALL_PROMPTS)(c, s, e)
    const why = c.warms
      ? 'The mixture warmed up, so the reaction is **exothermic**: it transferred energy to the surroundings.'
      : 'The negative sign shows the surroundings cooled, so the reaction is **endothermic**.'
    return numeric(
      slot,
      {
        prompt,
        solution: `Change = final − starting = $${e} - ${s} = ${t1(x.change)}$ °C. ${why}`,
        method: ['final minus starting'],
        answer: x.change,
        tolerance: toPlaces(x.change, 1),
        units: '°C',
        line: `${signed(t1(x.change), c.warms ? 0 : x.change)} °C`,
      },
      // Second route: in tenths of a degree, as whole numbers.
      { agrees: Math.round(x.end * 10) - Math.round(x.start * 10) === Math.round(x.change * 10) && x.change > 0 === c.warms, detail: `${e} − ${s}` },
      { context: c.name, start: x.start, end: x.end, change: x.change },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q11: the mean rise of four repeats, one of them anomalous
// ---------------------------------------------------------------------------------------------

/** The mean's own spread, in °C, before MEANS keeps only those with room for an anomaly above and below. */
const REPEATED: (Cup & { mean: [number, number] })[] = [
  { ...WARMING[0]!, mean: [4, 13] },
  { ...WARMING[2]!, mean: [5, 16] },
  { ...WARMING[3]!, mean: [5, 18] },
  { ...COOLING[0]!, mean: [3.5, 9.5] },
]
/**
 * How far each of the three agreeing repeats sits from their mean, in tenths of a degree: three
 * different offsets that sum to nothing, none of them zero, so no repeat is the mean itself and
 * the middle repeat is not the answer.
 */
const OFFSETS: [number, number, number][] = []
for (let a = -4; a <= 4; a++)
  for (let b = a + 1; b <= 4; b++) {
    const c = -a - b
    if (c > b && c <= 4 && a !== 0 && b !== 0 && c !== 0) OFFSETS.push([a, b, c])
  }

/**
 * Where the anomaly may sit: at least 1.5 °C and a quarter of the mean away from it, so it stands
 * out, but no lower than a quarter of the mean (heat lost with the lid off, too little stirring)
 * and no higher than three-fifths above it nor past what the reaction can give (a thermometer
 * misread, a cup not rinsed out from the last run).
 */
const gapOf = (mean: number) => Math.max(1.5, mean / 4)
function anomalies(c: Cup, mean: number, high: boolean): number[] {
  const g = gapOf(mean)
  if (high) return range(clean(Math.ceil(clean((mean + g) * 10)) / 10), Math.min(c.change[1], clean(Math.floor(clean(mean * 16)) / 10)), 0.1)
  return range(Math.max(0.8, clean(Math.ceil(clean(mean * 2.5)) / 10)), clean(Math.floor(clean((mean - g) * 10)) / 10), 0.1)
}
/** The means a context allows: never 1 nor a power of ten, and with room for an anomaly on either side. */
const MEANS = new Map(
  REPEATED.map((c) => [c.name, range(c.mean[0], c.mean[1], 0.1).filter((m) => noOnes(m) && !powerOfTen(m) && anomalies(c, m, true).length >= 3 && anomalies(c, m, false).length >= 3)]),
)

const MEAN_PROMPTS = [
  (c: Cup, xs: string) =>
    `A student repeats ${c.repeat} four times in a polystyrene cup, using the same amounts each time. The temperature ${c.warms ? 'rises' : 'falls'} are ${xs} °C. Ignoring the anomaly, what is the mean ${c.warms ? 'rise' : 'fall'}, in °C?`,
  (c: Cup, xs: string) =>
    `Four repeats of ${c.repeat} in a polystyrene cup give temperature ${c.warms ? 'rises' : 'falls'} of ${xs} °C. Ignoring the anomalous result, what is the mean temperature ${c.warms ? 'rise' : 'fall'}, in °C?`,
]

export const meanTemperatureChange: Generator = {
  id: 'reaction-mean-temperature-change',
  subjectId: 'chemistry',
  topicId: CUP_TOPIC,
  replaces: ['q11'],
  build(r, slot, turn) {
    const c = REPEATED[turn % REPEATED.length]!
    // The anomaly is high or low with equal chance, so "drop the lowest" pays only half the time.
    const high = pick(r, [true, false])
    const mean = pick(r, MEANS.get(c.name)!)
    const repeats = pick(r, OFFSETS).map((d) => clean(mean + d / 10))
    const anomaly = pick(r, anomalies(c, mean, high).filter((a) => clearOf(mean, a) && repeats.every((x) => !near(x, a)) && distinct(a, ...repeats)))
    const shown = shuffle(r, [...repeats, anomaly])
    const sum = clean(repeats[0]! + repeats[1]! + repeats[2]!)
    const kept = shown.filter((x) => x !== anomaly).map(t1)
    return numeric(
      slot,
      {
        prompt: pick(r, MEAN_PROMPTS)(c, list(shown.map(t1))),
        solution: `${t1(anomaly)} °C is anomalous: it is far from the other three, so it is excluded. Mean $= \\dfrac{${kept.join(' + ')}}{3} = \\dfrac{${t1(sum)}}{3} = ${t1(mean)}$ °C.`,
        method: ['excludes the anomaly'],
        answer: mean,
        tolerance: toPlaces(mean, 1),
        units: '°C',
        line: `${t1(mean)} °C`,
      },
      // Second route: the four readings' total less the anomaly, in tenths.
      {
        agrees: Math.round(shown.reduce((s, x) => s + x, 0) * 10) - Math.round(anomaly * 10) === Math.round(mean * 30) && repeats.every((x) => Math.abs(x - mean) < 0.45),
        detail: `(${shown.map(t1).join(' + ')} − ${t1(anomaly)}) ÷ 3`,
      },
      { context: c.name, mean, anomaly, low: Math.min(...repeats), side: high ? 'high' : 'low' },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Bond energies: broken minus formed
// ---------------------------------------------------------------------------------------------

/** q7: the size of the change, 20 to 900 kJ/mol, never a power of ten. */
const SIZES = range(20, 900, 1).filter((x) => !powerOfTen(x))
/** Totals from 600 to 3600 kJ/mol; the change is neither total nor one with the point moved, doubled or halved. */
const fits = (size: number, broken: number, formed: number) => formed >= 600 && formed <= 3600 && clearOf(size, broken, formed) && distinct(broken, formed, size)

const TOTAL_PROMPTS = [
  (b: string, f: string) => `A reaction breaks bonds totalling ${b} kJ/mol and forms bonds totalling ${f} kJ/mol. What is the overall energy change, in kJ/mol?`,
  (b: string, f: string) =>
    `In a reaction, the energy needed to break the bonds in the reactants is ${b} kJ/mol and the energy released when the bonds in the products form is ${f} kJ/mol. What is the overall energy change, in kJ/mol?`,
  (b: string, f: string) =>
    `Forming the bonds in the products of a reaction releases ${f} kJ/mol. Breaking the bonds in the reactants takes in ${b} kJ/mol. What is the overall energy change, in kJ/mol?`,
]

const verdict = (change: number) =>
  change < 0
    ? 'Negative, so the reaction is **exothermic**: forming the new bonds releases more energy than breaking the old ones takes in.'
    : 'Positive, so the reaction is **endothermic**: breaking the bonds takes in more energy than forming the new ones releases.'

/** Broken minus formed from two totals: written as q7 (1450 and 1380 kJ/mol, +70). Half the builds are exothermic and half endothermic. */
export const bondEnergyTotals: Generator = {
  id: 'bond-energy-totals',
  subjectId: 'chemistry',
  topicId: BOND_TOPIC,
  replaces: ['q7'],
  build(r, slot, turn) {
    const sign = turn % 2 === 0 ? 1 : -1
    // The answer first, then the bonds broken that leave both totals in range.
    const size = pick(r, SIZES)
    const broken = draw(r, (q) => int(q, 600, 3600), (b) => fits(size, b, b - sign * size))
    const formed = broken - sign * size
    const change = broken - formed
    return numeric(
      slot,
      {
        prompt: pick(r, TOTAL_PROMPTS)(prose(broken), prose(formed)),
        solution: `Overall = broken − formed = $${tex(broken)} - ${tex(formed)} = ${change > 0 ? '+' : ''}${tex(change)}$ kJ/mol. ${verdict(change)}`,
        method: ['broken minus formed'],
        answer: change,
        tolerance: 0,
        units: 'kJ/mol',
        line: `${signed(prose(change), change)} kJ/mol`,
      },
      { agrees: formed + change === broken && Math.sign(change) === sign, detail: `${formed} + ${change} = ${broken}` },
      { context: change < 0 ? 'exothermic' : 'endothermic', broken, formed, change },
    )
  },
}

/**
 * Average bond energies in kJ/mol, and where each comes from.
 * - The topic's own (its lesson and q17 name them): H–H 436, O=O 498, O–H 464.
 * - The figures in the topic's lesson (its second worked example): C–H 412, C=O 805.
 * - The figures AQA papers print: C=C 614, Cl–Cl 242, H–Cl 431, C–Cl 327.
 * - The rest, which neither the content nor those papers give, are standard data-book averages:
 *   C–C 348, C–O 360, C≡O 1077 (carbon monoxide), O–O 146, N≡N 945, N–H 391, Br–Br 193,
 *   H–Br 366, C–Br 276, I–I 151, H–I 298.
 */
export const BOND_ENERGY: Record<string, number> = {
  'H–H': 436,
  'O=O': 498,
  'O–H': 464,
  'C–H': 412,
  'C=O': 805,
  'C=C': 614,
  'Cl–Cl': 242,
  'H–Cl': 431,
  'C–Cl': 327,
  'C–C': 348,
  'C–O': 360,
  'C≡O': 1077,
  'O–O': 146,
  'N≡N': 945,
  'N–H': 391,
  'Br–Br': 193,
  'H–Br': 366,
  'C–Br': 276,
  'I–I': 151,
  'H–I': 298,
}

const alkane = (n: number) => ({ ...(n > 1 ? { 'C–C': n - 1 } : {}), 'C–H': 2 * n + 2 })
const alcohol = (n: number) => ({ ...(n > 1 ? { 'C–C': n - 1 } : {}), 'C–H': 2 * n + 1, 'C–O': 1, 'O–H': 1 })

/** The bonds in each molecule, by structure: every one is checked against its formula's valences in the test. */
export const BONDS: Record<string, Record<string, number>> = {
  H2: { 'H–H': 1 },
  O2: { 'O=O': 1 },
  N2: { 'N≡N': 1 },
  Cl2: { 'Cl–Cl': 1 },
  Br2: { 'Br–Br': 1 },
  I2: { 'I–I': 1 },
  HCl: { 'H–Cl': 1 },
  HBr: { 'H–Br': 1 },
  HI: { 'H–I': 1 },
  H2O: { 'O–H': 2 },
  H2O2: { 'O–H': 2, 'O–O': 1 },
  CO2: { 'C=O': 2 },
  CO: { 'C≡O': 1 },
  NH3: { 'N–H': 3 },
  CH4: alkane(1),
  C2H6: alkane(2),
  C3H8: alkane(3),
  C4H10: alkane(4),
  C5H12: alkane(5),
  C6H14: alkane(6),
  C8H18: alkane(8),
  C10H22: alkane(10),
  C2H4: { 'C=C': 1, 'C–H': 4 },
  C3H6: { 'C=C': 1, 'C–C': 1, 'C–H': 6 },
  CH3OH: alcohol(1),
  C2H5OH: alcohol(2),
  C3H7OH: alcohol(3),
  C4H9OH: alcohol(4),
  C2H4Br2: { 'C–C': 1, 'C–H': 4, 'C–Br': 2 },
  C2H4Cl2: { 'C–C': 1, 'C–H': 4, 'C–Cl': 2 },
  C3H6Br2: { 'C–C': 2, 'C–H': 6, 'C–Br': 2 },
  CH3Cl: { 'C–H': 3, 'C–Cl': 1 },
  CH3Br: { 'C–H': 3, 'C–Br': 1 },
}

export interface Reaction {
  eq: Equation
  /** "the complete combustion of methane" */
  name: string
  /** Reversible: printed with ⇌. */
  reversible?: boolean
}
const reaction = (text: string, name: string, reversible = false): Reaction => ({ eq: equation(text), name, ...(reversible ? { reversible } : {}) })

/**
 * Exothermic: combustion, addition to an alkene, substitution in light, hydrogen with a halogen,
 * the Haber process, and carbon monoxide's reactions. Each entry is drawn as often as any other.
 * The combustions of butane and propanol are left out: balanced in whole numbers they take two
 * molecules, and their totals pass 13 000 kJ/mol.
 */
const EXOTHERMIC: Reaction[][] = [
  [reaction('2H2 + O2 -> 2H2O', 'the burning of hydrogen in oxygen')],
  [reaction('CH4 + 2O2 -> CO2 + 2H2O', 'the complete combustion of methane')],
  [reaction('2C2H6 + 7O2 -> 4CO2 + 6H2O', 'the complete combustion of ethane')],
  [reaction('C3H8 + 5O2 -> 3CO2 + 4H2O', 'the complete combustion of propane')],
  [reaction('C5H12 + 8O2 -> 5CO2 + 6H2O', 'the complete combustion of pentane')],
  [reaction('C2H4 + 3O2 -> 2CO2 + 2H2O', 'the complete combustion of ethene')],
  [reaction('2C3H6 + 9O2 -> 6CO2 + 6H2O', 'the complete combustion of propene')],
  [reaction('2CH3OH + 3O2 -> 2CO2 + 4H2O', 'the complete combustion of methanol')],
  [reaction('C2H5OH + 3O2 -> 2CO2 + 3H2O', 'the complete combustion of ethanol')],
  [reaction('C4H9OH + 6O2 -> 4CO2 + 5H2O', 'the complete combustion of butanol')],
  [reaction('2CO + O2 -> 2CO2', 'the burning of carbon monoxide')],
  [reaction('C2H4 + H2 -> C2H6', 'the reaction of ethene with hydrogen over a nickel catalyst')],
  [reaction('C3H6 + H2 -> C3H8', 'the reaction of propene with hydrogen over a nickel catalyst')],
  [reaction('C2H4 + Br2 -> C2H4Br2', 'the reaction of ethene with bromine')],
  [reaction('C3H6 + Br2 -> C3H6Br2', 'the reaction of propene with bromine')],
  [reaction('C2H4 + Cl2 -> C2H4Cl2', 'the reaction of ethene with chlorine')],
  [reaction('C2H4 + H2O -> C2H5OH', 'the reaction of ethene with steam over a catalyst', true)],
  [reaction('CH4 + Cl2 -> CH3Cl + HCl', 'the reaction of methane with chlorine in ultraviolet light')],
  [reaction('CH4 + Br2 -> CH3Br + HBr', 'the reaction of methane with bromine in ultraviolet light')],
  [reaction('H2 + Cl2 -> 2HCl', 'the reaction of hydrogen with chlorine')],
  [reaction('H2 + Br2 -> 2HBr', 'the reaction of hydrogen with bromine', true)],
  [reaction('N2 + 3H2 -> 2NH3', 'the Haber process', true)],
  [reaction('2H2O2 -> 2H2O + O2', 'the decomposition of hydrogen peroxide')],
  [reaction('CO + 2H2 -> CH3OH', 'the manufacture of methanol from carbon monoxide and hydrogen', true)],
  [reaction('CO + H2O -> CO2 + H2', 'the reaction of carbon monoxide with steam', true)],
]
/**
 * Endothermic: cracking, dehydrogenation, decompositions, electrolysis of water, reforming. The
 * three crackings share one change (two C–C broken, one C=C formed) and are one entry between
 * them; so are the two dehydrogenations.
 */
const ENDOTHERMIC: Reaction[][] = [
  [
    reaction('C10H22 -> C8H18 + C2H4', 'the cracking of decane'),
    reaction('C8H18 -> C6H14 + C2H4', 'the cracking of octane'),
    reaction('C6H14 -> C4H10 + C2H4', 'the cracking of hexane'),
  ],
  [reaction('C2H6 -> C2H4 + H2', 'the cracking of ethane to make ethene'), reaction('C3H8 -> C3H6 + H2', 'the conversion of propane to propene and hydrogen')],
  [reaction('C2H5OH -> C2H4 + H2O', 'the dehydration of ethanol over a hot catalyst', true)],
  [reaction('2NH3 -> N2 + 3H2', 'the decomposition of ammonia', true)],
  [reaction('2H2O -> 2H2 + O2', 'the electrolysis of water')],
  [reaction('CH4 + H2O -> CO + 3H2', 'the reaction of methane with steam to make hydrogen', true)],
  [reaction('CH4 + CO2 -> 2CO + 2H2', 'the reaction of methane with carbon dioxide to make hydrogen', true)],
  [reaction('CO2 + H2 -> CO + H2O', 'the reaction of carbon dioxide with hydrogen', true)],
  [reaction('CH3OH -> CO + 2H2', 'the decomposition of methanol over a catalyst', true)],
  [reaction('2HI -> H2 + I2', 'the decomposition of hydrogen iodide on heating', true)],
  [reaction('2HBr -> H2 + Br2', 'the decomposition of hydrogen bromide on heating', true)],
]

/** The bonds on one side, balancing numbers multiplied in, in the order they first appear. */
export function bondsOf(side: Term[]): [string, number][] {
  const out = new Map<string, number>()
  for (const t of side) for (const [b, k] of Object.entries(BONDS[t.f]!)) out.set(b, (out.get(b) ?? 0) + k * t.n)
  return [...out]
}
export const total = (bonds: [string, number][]) => bonds.reduce((s, [b, k]) => s + k * BOND_ENERGY[b]!, 0)

/** "4 C–H and 2 O=O: $4 \times 412 + 2 \times 498 = 2644$ kJ/mol", "6 N–H: $6 \times 391 = 2346$ kJ/mol", "one N≡N, 945 kJ/mol" */
function sideWorking(bonds: [string, number][]): string {
  const names = list(bonds.map(([b, k]) => `${k === 1 ? 'one' : k} ${b}`))
  const terms = bonds.map(([b, k]) => (k === 1 ? `${BOND_ENERGY[b]}` : `${k} \\times ${BOND_ENERGY[b]}`))
  return bonds.length === 1 && bonds[0]![1] === 1 ? `one ${bonds[0]![0]}, ${tex(total(bonds))} kJ/mol` : `${names}: $${terms.join(' + ')} = ${tex(total(bonds))}$ kJ/mol`
}

export const printed = (x: Reaction) => (x.reversible ? written(x.eq).replace(' → ', ' ⇌ ') : written(x.eq))

const EQUATION_PROMPTS = [
  (x: Reaction, b: string, f: string) => `${printed(x)}. Bonds broken total ${b} kJ/mol; bonds formed total ${f} kJ/mol. What is the overall energy change, in kJ/mol?`,
  (x: Reaction, b: string, f: string) =>
    `For ${x.name}, ${printed(x)}, breaking the bonds in the reactants takes in ${b} kJ/mol and forming the bonds in the products releases ${f} kJ/mol. What is the overall energy change, in kJ/mol?`,
  (x: Reaction, b: string, f: string) => `For the reaction ${printed(x)}, the bonds broken total ${b} kJ/mol and the bonds formed total ${f} kJ/mol. Calculate the overall energy change, in kJ/mol.`,
  (x: Reaction, b: string, f: string) =>
    `In ${x.name}, ${printed(x)}, forming the new bonds releases ${f} kJ/mol and breaking the old ones takes in ${b} kJ/mol. What is the overall energy change, in kJ/mol?`,
]

/**
 * Broken minus formed for a named equation: written as q11 (2H₂ + O₂ → 2H₂O, 1370 and 1856
 * kJ/mol, −486). The totals are the reaction's own, summed from the bond energies above, and the
 * solution shows the sums. Half the builds are exothermic and half endothermic, so "burning is
 * negative" is not the whole skill.
 */
export const bondEnergyEquation: Generator = {
  id: 'bond-energy-equation',
  subjectId: 'chemistry',
  topicId: BOND_TOPIC,
  replaces: ['q11'],
  build(r, slot, turn) {
    const pool = turn % 2 === 0 ? EXOTHERMIC : ENDOTHERMIC
    const x = pick(r, pick(r, pool))
    const [inB, outB] = [bondsOf(x.eq.left), bondsOf(x.eq.right)]
    const [broken, formed] = [total(inB), total(outB)]
    const change = broken - formed
    // Second route: bond by bond, the number of each broken less the number formed, times its energy.
    const net = Object.keys(BOND_ENERGY).reduce((s, b) => s + ((inB.find(([y]) => y === b)?.[1] ?? 0) - (outB.find(([y]) => y === b)?.[1] ?? 0)) * BOND_ENERGY[b]!, 0)
    return numeric(
      slot,
      {
        prompt: pick(r, EQUATION_PROMPTS)(x, prose(broken), prose(formed)),
        solution:
          `Bonds broken: ${sideWorking(inB)}. Bonds formed: ${sideWorking(outB)}.\n\n` +
          `Overall = broken − formed = $${tex(broken)} - ${tex(formed)} = ${change > 0 ? '+' : ''}${tex(change)}$ kJ/mol. ${verdict(change)}`,
        method: ['broken minus formed'],
        answer: change,
        tolerance: 0,
        units: 'kJ/mol',
        line: `${signed(prose(change), change)} kJ/mol`,
      },
      { agrees: net === change && (pool === EXOTHERMIC ? change < 0 : change > 0), detail: `net bonds ${net}` },
      { context: pool === EXOTHERMIC ? 'exothermic' : 'endothermic', reaction: x.eq.text, broken, formed, change },
    )
  },
}

export const energyGenerators: Generator[] = [temperatureChange, meanTemperatureChange, bondEnergyTotals, bondEnergyEquation]

/** For the tests. */
export const ENERGY = { WARMING, COOLING, REPEATED, OFFSETS, MEANS, EXO_GROUPS: EXOTHERMIC, ENDO_GROUPS: ENDOTHERMIC, EXOTHERMIC: EXOTHERMIC.flat(), ENDOTHERMIC: ENDOTHERMIC.flat(), EQUATION_PROMPTS, readings, SIZES }
