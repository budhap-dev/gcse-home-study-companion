import { clearOfHalf, fixed, roundTo, show } from '../format.ts'
import { int, pick } from '../random.ts'
import type { Generator } from '../types.ts'
import { atMost, cap, near, numeric } from '../physics/build.ts'
import { dpTolerance } from '../physics/format.ts'
import { clean, clearOf, coef, distinct, equation, evenly, mathrm, mr, noOnes, range, sub, tenfold, written, type Equation, type Term } from './build.ts'
import { CONVERSIONS, given, oneToOne, ratioOf, type Conversion } from './reacting.ts'
import { nameOf } from './compounds.ts'

/**
 * Yield and atom economy (AQA 8462, 4.3.3). Every numeric written question in the topic has a
 * generator here. Atom economy reads a balanced equation: each one below is a real reaction,
 * checked for balance as it loads, and every Mr comes from `mr()`. Percentage yields are below
 * 100% and above a half, as a school preparation gives, and the masses are a lab's.
 */
const TOPIC = 'yield-and-atom-economy'

// ---------------------------------------------------------------------------------------------
// q1 and q6: percentage yield from the theoretical and actual masses
// ---------------------------------------------------------------------------------------------

interface YieldContext {
  name: string
  text: (T: string, A: string) => string
  /** Theoretical masses, in grams, and the step they are drawn in. */
  T: [number, number, number]
}
const SHOULD_GIVE: YieldContext[] = [
  { name: 'a reaction', text: (T, A) => `A reaction should give ${T} g of product but ${A} g is collected.`, T: [5, 80, 1] },
  { name: 'copper sulfate crystals', text: (T, A) => `A student expects to make ${T} g of copper sulfate crystals but collects ${A} g.`, T: [2, 30, 0.5] },
  { name: 'calcium oxide', text: (T, A) => `Heating calcium carbonate should produce ${T} g of calcium oxide, but ${A} g is obtained.`, T: [2, 30, 0.5] },
  { name: 'barium sulfate', text: (T, A) => `A precipitation should give ${T} g of barium sulfate, but only ${A} g is collected after filtering and drying.`, T: [1, 20, 0.5] },
  { name: 'magnesium oxide', text: (T, A) => `Burning magnesium in a crucible should form ${T} g of magnesium oxide, but ${A} g is weighed at the end.`, T: [0.5, 5, 0.1] },
]
const THEORETICAL: YieldContext[] = [
  { name: 'a reaction', text: (T, A) => `A reaction has a theoretical mass of ${T} g, and ${A} g of product is collected.`, T: [5, 60, 0.2] },
  { name: 'zinc sulfate crystals', text: (T, A) => `The theoretical mass of zinc sulfate crystals from a preparation is ${T} g. The student collects ${A} g of crystals.`, T: [2, 30, 0.2] },
  { name: 'iron', text: (T, A) => `In a thermite demonstration, the theoretical mass of iron is ${T} g, and ${A} g of iron is recovered.`, T: [5, 40, 0.2] },
  { name: 'copper', text: (T, A) => `A displacement reaction has a theoretical mass of ${T} g of copper. After washing and drying, ${A} g of copper is weighed.`, T: [1, 15, 0.1] },
  { name: 'magnesium sulfate crystals', text: (T, A) => `The theoretical mass of magnesium sulfate crystals from a preparation is ${T} g, and ${A} g is collected.`, T: [2, 30, 0.2] },
]

interface YieldDraw {
  Y: number
  T: number
  A: number
}
/**
 * Every whole-number yield from 55% to 96% with a theoretical mass in the context's range and an
 * actual mass to 0.01 g. The yield is drawn first, so the masses that divide most often do not
 * make the easy yields (80%, 90%) the common ones.
 */
function yieldDraws(c: YieldContext): YieldDraw[] {
  const out: YieldDraw[] = []
  for (const Y of range(55, 96, 1)) {
    for (const T of range(...c.T)) {
      if (!atMost((Y * T) / 100, 2)) continue
      const A = clean((Y * T) / 100)
      if (distinct(T, A) && clearOf(Y, T, A) && noOnes(T, A) && !tenfold(T, 100)) out.push({ Y, T, A })
    }
  }
  return out
}

export const percentageYield: Generator = {
  id: 'yield-percentage',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q1', 'q6'],
  build(r, slot, turn) {
    const list = slot.id === 'q1' ? SHOULD_GIVE : THEORETICAL
    const c = list[turn % list.length]!
    const { Y, T, A } = evenly(r, `yield-q1q6:${slot.id}:${c.name}`, () => yieldDraws(c), (x) => x.Y)
    const prompt = `${c.text(show(T), show(A))} ${pick(r, ['What is the percentage yield?', 'Calculate the percentage yield.'])}`
    return numeric(
      slot,
      {
        prompt,
        solution: `Percentage yield $= \\dfrac{\\text{mass collected}}{\\text{theoretical mass}} \\times 100 = \\dfrac{${show(A)}}{${show(T)}} \\times 100 = $ **${show(Y)}%**.`,
        method: [],
        answer: Y,
        tolerance: dpTolerance(Y),
      },
      // Second route: the yield applied to the theoretical mass gives back the mass collected.
      { agrees: near((Y * T) / 100, A) && near((100 * A) / T, Y), detail: `${Y}% of ${T} g = ${show((Y * T) / 100)} g` },
      { context: c.name, T, A, Y },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q5 and q12: the theoretical mass from a reactant's mass, and the yield from it
// ---------------------------------------------------------------------------------------------

export const theoreticalMass: Generator = {
  id: 'yield-theoretical-mass',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q5'],
  build(r, slot, turn) {
    const c = CONVERSIONS[turn % CONVERSIONS.length]!
    const M1 = mr(c.from)
    const M2 = mr(c.to)
    const { n, m, out } = evenly(r, `yield-q5:${c.from}:${c.to}`, () => oneToOne(c), (x) => x.out)
    const prompt = pick(r, [
      `${cap(c.does(m))}: ${written(c.eq)}. What is the theoretical mass of ${nameOf(c.to)}, in grams? ${given(c.from, c.to)}`,
      `${cap(c.does(m))}: ${written(c.eq)}. What is the theoretical mass of ${nameOf(c.to)} that can form, in grams? ${given(c.from, c.to)}`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: `Moles of ${sub(c.from)} $= \\dfrac{${show(m)}}{${show(M1)}} = ${show(n)}$; ${ratioOf(c.eq, c.from, c.to)}; mass $= ${show(n)} \\times ${show(M2)} = $ **${show(out)} g**.`,
        method: [`$${show(n)}$ mol of ${sub(c.from)}`],
        answer: out,
        tolerance: dpTolerance(out),
      },
      { agrees: near((m * M2) / M1, out), detail: `${m} × ${M2} ÷ ${M1} = ${show((m * M2) / M1)} g` },
      { context: `${c.from}->${c.to}`, m, n, out },
    )
  },
}

/** Products collected as solids: carbon dioxide escapes, so it is no product to weigh. */
const COLLECTED: Conversion[] = CONVERSIONS.filter((c) => c.to !== 'CO2')

interface YieldFromMass {
  n: number
  m: number
  T: number
  A: number
  Y: number
}
const YIELD_FROM_MASS = new Map<string, YieldFromMass[]>()
/**
 * Each theoretical mass a conversion allows with every actual mass to 0.1 g from 55% to 97% of
 * it, where the yield to one decimal place is clear of a half-way case and does not end in a 0
 * the answer box would drop.
 */
function yieldFromMass(c: Conversion): YieldFromMass[] {
  const key = `${c.from}->${c.to}`
  const hit = YIELD_FROM_MASS.get(key)
  if (hit) return hit
  const out: YieldFromMass[] = []
  for (const { n, m, out: T } of oneToOne(c)) {
    for (let k = Math.ceil(T * 5.5); k <= Math.floor(T * 9.7); k++) {
      const A = k / 10
      const raw = (100 * A) / T
      const Y = roundTo(raw, 1)
      if (!clearOfHalf(raw, 1) || atMost(Y, 0) || !distinct(m, A, T) || !clearOf(Y, m, A, T) || !noOnes(A)) continue
      // Nor a mass collected that is a given Ar or Mr with the point moved (5.6 g beside Fe = 56).
      if (tenfold(A, mr(c.from)) || tenfold(A, mr(c.to))) continue
      out.push({ n, m, T, A, Y })
    }
  }
  YIELD_FROM_MASS.set(key, out)
  return out
}

export const yieldFromReactantMass: Generator = {
  id: 'yield-from-reactant-mass',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q12'],
  build(r, slot, turn) {
    const c = COLLECTED[turn % COLLECTED.length]!
    const M1 = mr(c.from)
    const M2 = mr(c.to)
    // The theoretical mass first, evenly, then an actual mass that fits it.
    const T = evenly(r, `yield-q12:${c.from}:${c.to}`, () => [...new Set(yieldFromMass(c).map((x) => x.T))], (t) => t)
    const options = yieldFromMass(c).filter((x) => x.T === T)
    const { n, m, A, Y } = options[int(r, 0, options.length - 1)]!
    const raw = (100 * A) / T
    const exact = atMost(raw, 1)
    const prompt = pick(r, [
      `${cap(c.starts(m))}, and ${fixed(A, 1)} g of ${nameOf(c.to)} is collected: ${written(c.eq)}. What is the percentage yield, to one decimal place? ${given(c.from, c.to)}`,
      `${cap(c.starts(m))}: ${written(c.eq)}. Only ${fixed(A, 1)} g of ${nameOf(c.to)} is collected. What is the percentage yield, to one decimal place? ${given(c.from, c.to)}`,
    ])
    const end = exact ? `= $ **${show(Y)}%**.` : `= ${(Math.floor(raw * 100) / 100).toFixed(2)}\\ldots$, which is **${show(Y)}%** to one decimal place.`
    return numeric(
      slot,
      {
        prompt,
        solution: `Moles of ${sub(c.from)} $= \\dfrac{${show(m)}}{${show(M1)}} = ${show(n)}$; ${ratioOf(c.eq, c.from, c.to)}, so the theoretical mass $= ${show(n)} \\times ${show(M2)} = ${show(T)}\\text{ g}$; yield $= \\dfrac{${fixed(A, 1)}}{${show(T)}} \\times 100 ${end}`,
        method: [`theoretical mass $${show(T)}$ g`, `divides $${fixed(A, 1)}$ by $${show(T)}$`],
        answer: Y,
        tolerance: dpTolerance(Y),
      },
      // Second route: the actual mass against the reactant's mass scaled by the two Mr values.
      (() => {
        const second = (100 * A) / ((m * M2) / M1)
        return { agrees: near(roundTo(second, 1), Y), detail: `${A} ÷ (${m} × ${M2} ÷ ${M1}) × 100 = ${show(second)}%` }
      })(),
      { context: `${c.from}->${c.to}`, m, T, A, Y },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q3, q8 and q11: atom economy from a balanced equation
// ---------------------------------------------------------------------------------------------

interface Route {
  eq: Equation
  /** The desired product. */
  want: string
}
const route = (text: string, ...want: string[]): Route[] => {
  const eq = equation(text)
  return want.map((w) => {
    coef(eq, w)
    return { eq, want: w }
  })
}
/**
 * Real reactions read as a way of making one product: decompositions, salt preparations,
 * displacement, extraction by reduction, precipitation, cracking and dehydration. The reactions
 * that make one product only (100% atom economy) are left to the multiple-choice slots, apart
 * from the total-Mr slot, which asks nothing about the product.
 */
const ROUTES: Route[] = [
  ...route('CaCO3 -> CaO + CO2', 'CaO', 'CO2'),
  ...route('MgCO3 -> MgO + CO2', 'MgO', 'CO2'),
  ...route('ZnCO3 -> ZnO + CO2', 'ZnO', 'CO2'),
  ...route('CuCO3 -> CuO + CO2', 'CuO', 'CO2'),
  ...route('C10H22 -> C8H18 + C2H4', 'C2H4', 'C8H18'),
  ...route('C2H5OH -> C2H4 + H2O', 'C2H4'),
  ...route('CuO + H2SO4 -> CuSO4 + H2O', 'CuSO4'),
  ...route('ZnO + H2SO4 -> ZnSO4 + H2O', 'ZnSO4'),
  ...route('MgO + H2SO4 -> MgSO4 + H2O', 'MgSO4'),
  ...route('Mg + H2SO4 -> MgSO4 + H2', 'MgSO4', 'H2'),
  ...route('Zn + H2SO4 -> ZnSO4 + H2', 'ZnSO4', 'H2'),
  ...route('Fe + H2SO4 -> FeSO4 + H2', 'FeSO4'),
  ...route('Fe + CuSO4 -> FeSO4 + Cu', 'Cu'),
  ...route('Zn + CuSO4 -> ZnSO4 + Cu', 'Cu'),
  ...route('Mg + CuSO4 -> MgSO4 + Cu', 'Cu'),
  ...route('NaOH + HCl -> NaCl + H2O', 'NaCl'),
  ...route('KOH + HCl -> KCl + H2O', 'KCl'),
  ...route('KOH + HNO3 -> KNO3 + H2O', 'KNO3'),
  ...route('CuCO3 + H2SO4 -> CuSO4 + H2O + CO2', 'CuSO4'),
  ...route('ZnCO3 + H2SO4 -> ZnSO4 + H2O + CO2', 'ZnSO4'),
  ...route('MgCO3 + H2SO4 -> MgSO4 + H2O + CO2', 'MgSO4'),
  ...route('ZnO + C -> Zn + CO', 'Zn'),
  ...route('CuO + H2 -> Cu + H2O', 'Cu'),
  ...route('CuO + CO -> Cu + CO2', 'Cu'),
  ...route('ZnO + CO -> Zn + CO2', 'Zn'),
  ...route('AgNO3 + KCl -> AgCl + KNO3', 'AgCl'),
  ...route('AgNO3 + KBr -> AgBr + KNO3', 'AgBr'),
  ...route('AgNO3 + KI -> AgI + KNO3', 'AgI'),
  ...route('BaCl2 + Na2SO4 -> BaSO4 + 2NaCl', 'BaSO4'),
  ...route('Ca(OH)2 + CO2 -> CaCO3 + H2O', 'CaCO3'),
  ...route('Na2CO3 + CaCl2 -> CaCO3 + 2NaCl', 'CaCO3'),
  ...route('CuSO4 + Na2CO3 -> CuCO3 + Na2SO4', 'CuCO3'),
  // With balancing numbers other than 1.
  ...route('Fe2O3 + 3CO -> 2Fe + 3CO2', 'Fe'),
  ...route('2Fe2O3 + 3C -> 4Fe + 3CO2', 'Fe'),
  ...route('Fe2O3 + 3H2 -> 2Fe + 3H2O', 'Fe'),
  ...route('Fe2O3 + 2Al -> Al2O3 + 2Fe', 'Fe'),
  ...route('Cr2O3 + 2Al -> Al2O3 + 2Cr', 'Cr'),
  ...route('2CuO + C -> 2Cu + CO2', 'Cu'),
  ...route('2PbO + C -> 2Pb + CO2', 'Pb'),
  ...route('WO3 + 3H2 -> W + 3H2O', 'W'),
  ...route('TiCl4 + 4Na -> Ti + 4NaCl', 'Ti'),
  ...route('TiCl4 + 2Mg -> Ti + 2MgCl2', 'Ti'),
  ...route('2Al2O3 -> 4Al + 3O2', 'Al'),
  ...route('2ZnS + 3O2 -> 2ZnO + 2SO2', 'ZnO'),
  ...route('C6H12O6 -> 2C2H5OH + 2CO2', 'C2H5OH'),
  ...route('2NaCl + 2H2O -> 2NaOH + H2 + Cl2', 'NaOH', 'Cl2', 'H2'),
  ...route('CH4 + H2O -> CO + 3H2', 'H2'),
  ...route('2NaHCO3 -> Na2CO3 + H2O + CO2', 'Na2CO3'),
  ...route('2H2O2 -> 2H2O + O2', 'O2'),
  ...route('Mg + 2HCl -> MgCl2 + H2', 'MgCl2'),
  ...route('Zn + 2HCl -> ZnCl2 + H2', 'ZnCl2'),
  ...route('2Al + 6HCl -> 2AlCl3 + 3H2', 'AlCl3', 'H2'),
  ...route('CaCO3 + 2HCl -> CaCl2 + H2O + CO2', 'CaCl2'),
  ...route('MgCO3 + 2HCl -> MgCl2 + H2O + CO2', 'MgCl2'),
  ...route('ZnCO3 + 2HCl -> ZnCl2 + H2O + CO2', 'ZnCl2'),
  ...route('2NaOH + H2SO4 -> Na2SO4 + 2H2O', 'Na2SO4'),
  ...route('2KOH + H2SO4 -> K2SO4 + 2H2O', 'K2SO4'),
  ...route('CuO + 2HCl -> CuCl2 + H2O', 'CuCl2'),
  ...route('MgO + 2HCl -> MgCl2 + H2O', 'MgCl2'),
  ...route('ZnO + 2HCl -> ZnCl2 + H2O', 'ZnCl2'),
  ...route('CaO + 2HCl -> CaCl2 + H2O', 'CaCl2'),
  ...route('Ca(OH)2 + 2HCl -> CaCl2 + 2H2O', 'CaCl2'),
  ...route('Na2CO3 + 2HCl -> 2NaCl + H2O + CO2', 'NaCl'),
  ...route('2KI + Cl2 -> 2KCl + I2', 'I2'),
  ...route('2NaBr + Cl2 -> 2NaCl + Br2', 'Br2'),
  ...route('Pb(NO3)2 + 2KI -> PbI2 + 2KNO3', 'PbI2'),
  ...route('CuSO4 + 2NaOH -> Cu(OH)2 + Na2SO4', 'Cu(OH)2'),
]
/** Reactions with one product, for the total-Mr slot only. */
const ONE_PRODUCT: Route[] = [...route('N2 + 3H2 -> 2NH3', 'NH3'), ...route('2NH3 + H2SO4 -> (NH4)2SO4', '(NH4)2SO4'), ...route('2Mg + O2 -> 2MgO', 'MgO')]
// The names the prompts print must exist for every formula used, and no formula may print
// "NaN" (sodium nitrate, NaNO3), which the release check rightly reads as a broken number.
for (const x of [...ROUTES, ...ONE_PRODUCT]) {
  for (const t of [...x.eq.left, ...x.eq.right]) nameOf(t.f)
  if (written(x.eq).includes('NaN')) throw new Error(`${x.eq.text} prints NaN`)
}

const total = (terms: Term[]) => clean(terms.reduce((s, t) => s + t.n * mr(t.f), 0))
/** Every balancing number on the reactants and the wanted product is 1. */
const allOnes = (x: Route) => x.eq.left.every((t) => t.n === 1) && coef(x.eq, x.want) === 1

interface Economy {
  /** Mass of the wanted product in the equation: its balancing number times its Mr. */
  wanted: number
  total: number
  raw: number
  answer: number
  /** Whether the percentage is exact to one decimal place, so the prompt needs no rounding. */
  exact: boolean
}
function economy(x: Route): Economy {
  const wanted = clean(coef(x.eq, x.want) * mr(x.want))
  const t = total(x.eq.left)
  const raw = (100 * wanted) / t
  const exact = atMost(raw, 1)
  return { wanted, total: t, raw, answer: exact ? clean(raw) : roundTo(raw, 1), exact }
}
/**
 * Whether a route makes a fair atom economy question: not 100%, rounding clear of a half-way
 * case and not to a whole number with a dropped 0, and the answer never a given Mr with the
 * point moved (calcium carbonate's total of 100 makes the atom economy the product's Mr).
 */
function fair(x: Route): boolean {
  const e = economy(x)
  if (e.raw >= 100 - 1e-9) return false
  if (!e.exact && (!clearOfHalf(e.raw, 1) || atMost(e.answer, 0))) return false
  const givens = [...new Set([...x.eq.left.map((t) => mr(t.f)), mr(x.want)])]
  if (!givens.every((g) => !tenfold(e.answer, g))) return false
  // A student who forgets to divide lands on the total Mr or the wanted Mr: NaOH + HCl totals
  // 76.5, and its atom economy for NaCl is 76.5%. No figure on the way may be the answer.
  const tol = dpTolerance(e.answer)
  return [...givens, e.total, e.wanted].every((g) => Math.abs(e.answer - g) > tol + 1e-9)
}

const SIMPLE = ROUTES.filter((x) => allOnes(x) && fair(x))
const WITH_NUMBERS = ROUTES.filter((x) => !allOnes(x) && fair(x))
const TOTALS: Route[] = [...ROUTES, ...ONE_PRODUCT].filter((x, i, all) => x.eq.left.some((t) => t.n > 1) && all.findIndex((y) => y.eq.text === x.eq.text) === i)

/** "$160 + (3 \times 28) = 160 + 84 = 244$" without the last figure, which the caller bolds or not. */
function sumWorking(terms: Term[]): { first: string; second: string | null } {
  const first = terms.map((t) => (t.n > 1 ? `(${t.n} \\times ${show(mr(t.f))})` : show(mr(t.f)))).join(' + ')
  const anyMultiple = terms.some((t) => t.n > 1)
  const second = anyMultiple && terms.length > 1 ? terms.map((t) => show(t.n * mr(t.f))).join(' + ') : null
  return { first: terms.length === 1 && terms[0]!.n > 1 ? `${terms[0]!.n} \\times ${show(mr(terms[0]!.f))}` : first, second }
}
/** The ending of an atom economy calculation: exact, or rounded from the figures it truncates. */
function percentEnd(e: Economy): string {
  return e.exact ? `= $ **${show(e.answer)}%**.` : `= ${(Math.floor(e.raw * 100) / 100).toFixed(2)}\\ldots$, which is **${show(e.answer)}%** to one decimal place.`
}

export const atomEconomySimple: Generator = {
  id: 'yield-atom-economy-simple',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q3'],
  build(r, slot, turn) {
    const x = SIMPLE[turn % SIMPLE.length]!
    const e = economy(x)
    const eq = written(x.eq)
    const name = nameOf(x.want)
    const as = e.exact ? 'as a percentage' : 'as a percentage to one decimal place'
    const masses = given(...x.eq.left.map((t) => t.f), x.want)
    const prompt = pick(r, [
      `For ${eq}, what is the atom economy for making ${name}, ${as}? ${masses}`,
      `${cap(name)} is made by the reaction ${eq}. What is the atom economy for ${name}, ${as}? ${masses}`,
      `Calculate the atom economy for making ${name} in the reaction ${eq}, ${as}. ${masses}`,
      `In the reaction ${eq}, ${name} is the useful product. What is the atom economy, ${as}? ${masses}`,
    ])
    const bottom = x.eq.left.length > 1 ? `${x.eq.left.map((t) => show(mr(t.f))).join(' + ')}` : show(e.total)
    return numeric(
      slot,
      {
        prompt,
        solution: `Atom economy $= \\dfrac{M_r \\text{ of } ${mathrm(x.want)}}{\\text{total } M_r \\text{ of reactants}} \\times 100 = \\dfrac{${show(e.wanted)}}{${bottom}} \\times 100 ${percentEnd(e)}`,
        method: [],
        answer: e.answer,
        tolerance: dpTolerance(e.answer),
      },
      // Second route: 100% less the share the other products take, from the products' side.
      (() => {
        const waste = total(x.eq.right) - e.wanted
        const second = 100 - (100 * waste) / total(x.eq.right)
        return { agrees: near(second, e.raw) && near(total(x.eq.right), e.total), detail: `100 − ${show(waste)} ÷ ${show(total(x.eq.right))} × 100 = ${show(second)}%` }
      })(),
      { context: `${x.eq.text}:${x.want}`, wanted: e.wanted, total: e.total, answer: e.answer },
    )
  },
}

export const totalMrOfReactants: Generator = {
  id: 'yield-total-mr-of-reactants',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q8'],
  build(r, slot, turn) {
    const x = TOTALS[turn % TOTALS.length]!
    const t = total(x.eq.left)
    const eq = written(x.eq)
    const masses = given(...x.eq.left.map((y) => y.f))
    const prompt = pick(r, [
      `For ${eq}, what is the total Mr of all the reactants? ${masses}`,
      `An atom economy calculation for ${eq} needs the total Mr of the reactants. What is it? ${masses}`,
      `What is the total relative formula mass of all the reactants in ${eq}? ${masses}`,
      `The reaction ${eq} is used to make ${nameOf(x.want)}. What is the total Mr of all the reactants? ${masses}`,
    ])
    const w = sumWorking(x.eq.left)
    const multiples = x.eq.left.filter((y) => y.n > 1)
    return numeric(
      slot,
      {
        prompt,
        solution: `Each Mr is multiplied by its balancing number: $${w.first} = ${w.second ? `${w.second} = ` : ''}$ **${show(t)}**.`,
        method: [`uses ${multiples.map((y) => `$${y.n} \\times ${show(mr(y.f))}$ for the ${nameOf(y.f)}`).join(' and ')}`],
        answer: t,
        tolerance: dpTolerance(t),
      },
      // Second route: mass is conserved, so the products' total is the same.
      { agrees: near(total(x.eq.right), t), detail: `products total ${show(total(x.eq.right))}` },
      { context: x.eq.text, total: t },
    )
  },
}

export const atomEconomy: Generator = {
  id: 'yield-atom-economy',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q11'],
  build(r, slot, turn) {
    const x = WITH_NUMBERS[turn % WITH_NUMBERS.length]!
    const e = economy(x)
    const eq = written(x.eq)
    const name = nameOf(x.want)
    const k = coef(x.eq, x.want)
    const M = mr(x.want)
    const masses = given(x.want, ...x.eq.left.map((t) => t.f))
    const prompt = pick(r, [
      `For ${eq}, calculate the atom economy for ${name}, as a percentage to one decimal place. ${masses}`,
      `${cap(name)} is made by the reaction ${eq}. Calculate the atom economy for ${name}, as a percentage to one decimal place. ${masses}`,
      `In the reaction ${eq}, ${name} is the desired product. What is the atom economy, as a percentage to one decimal place? ${masses}`,
      `Calculate the percentage atom economy for making ${name} by ${eq}. Give your answer to one decimal place. ${masses}`,
    ])
    const w = sumWorking(x.eq.left)
    const wantedText = k > 1 ? `${k} \\times ${show(M)} = ${show(e.wanted)}` : `${show(e.wanted)}`
    const reactants = `${w.first} = ${w.second ? `${w.second} = ` : ''}${show(e.total)}`
    return numeric(
      slot,
      {
        prompt,
        solution: `Wanted: $${wantedText}$. All reactants: $${reactants}$. $\\dfrac{${show(e.wanted)}}{${show(e.total)}} \\times 100 ${percentEnd(e)}`,
        method: [k > 1 ? `uses $${k} \\times ${show(M)} = ${show(e.wanted)}$ for the ${name}` : `uses $${show(M)}$ for the ${name}`, `total reactants $= ${show(e.total)}$`],
        answer: e.answer,
        tolerance: dpTolerance(e.answer),
      },
      (() => {
        const waste = total(x.eq.right) - e.wanted
        const second = 100 - (100 * waste) / total(x.eq.right)
        return { agrees: near(second, e.raw) && near(roundTo(second, 1), e.answer), detail: `100 − ${show(waste)} ÷ ${show(total(x.eq.right))} × 100 = ${show(second)}%` }
      })(),
      { context: `${x.eq.text}:${x.want}`, wanted: e.wanted, total: e.total, answer: e.answer },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q15 and q17: applying an atom economy, then a yield, to a mass of reactants
// ---------------------------------------------------------------------------------------------

const PERCENTS = range(15, 95, 1).filter((p) => p !== 50 && p !== 20 && p !== 25)
const MASSES = range(20, 500, 5)

interface Applied {
  AE: number
  m: number
  out: number
}
function appliedDraws(): Applied[] {
  const out: Applied[] = []
  for (const AE of PERCENTS) {
    for (const m of MASSES) {
      if (!atMost((AE * m) / 100, 1) || tenfold(m, 100)) continue
      const product = clean((AE * m) / 100)
      if (distinct(AE, m, product) && clearOf(product, AE, m) && noOnes(product) && !tenfold(product, clean(m - product))) out.push({ AE, m, out: product })
    }
  }
  return out
}

const APPLIED_TEXT = [
  (AE: number, m: number) => `A route makes a product with an atom economy of ${AE}%. For every ${m} g of reactants used, what mass of product, in grams, is obtained if the yield is 100%?`,
  (AE: number, m: number) => `A reaction has an atom economy of ${AE}%. If the yield is 100%, what mass of the desired product, in grams, forms from ${m} g of reactants?`,
  (AE: number, m: number) => `In a laboratory trial, a process with an atom economy of ${AE}% uses ${m} g of reactants. At 100% yield, what mass of the desired product, in grams, is made?`,
]

export const massFromAtomEconomy: Generator = {
  id: 'yield-mass-from-atom-economy',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q15'],
  build(r, slot, turn) {
    const which = turn % APPLIED_TEXT.length
    // The atom economy first, evenly, then a mass of reactants that gives a product to 0.1 g.
    const AE = evenly(r, 'yield-q15:ae', () => [...new Set(appliedDraws().map((x) => x.AE))], (a) => a)
    const fits = appliedDraws().filter((x) => x.AE === AE)
    const { m, out } = fits[int(r, 0, fits.length - 1)]!
    const waste = clean(m - out)
    return numeric(
      slot,
      {
        prompt: APPLIED_TEXT[which]!(AE, m),
        solution: `At 100% yield, the product mass is the atom economy applied to the reactants: $\\dfrac{${AE}}{100} \\times ${m} = $ **${show(out)} g**. The remaining $${show(waste)}\\text{ g}$ leaves as by-products.`,
        method: [`takes ${AE}% of ${m}`],
        answer: out,
        tolerance: dpTolerance(out),
      },
      // Second route: the reactants less the by-products, which take the rest of the mass.
      { agrees: near(m - ((100 - AE) * m) / 100, out), detail: `${m} − ${100 - AE}% of ${m} = ${show(m - ((100 - AE) * m) / 100)} g` },
      { context: `text ${which}`, AE, m, out },
    )
  },
}

const ECONOMY_YIELD = [
  (AE: number, Y: number, m: number) => `A reaction has an atom economy of ${AE}% and a percentage yield of ${Y}%. Starting with ${m} g of reactants, what mass of desired product, in grams, is actually obtained?`,
  (AE: number, Y: number, m: number) => `A process uses ${m} g of reactants. Its atom economy is ${AE}% and its percentage yield is ${Y}%. What mass of the desired product, in grams, is collected?`,
  (AE: number, Y: number, m: number) => `A preparation has a percentage yield of ${Y}%, and the reaction has an atom economy of ${AE}%. What mass of the desired product, in grams, does ${m} g of reactants actually give?`,
]
const YIELDS = range(40, 95, 1).filter((y) => y !== 50)

interface Combined {
  AE: number
  Y: number
  m: number
  T: number
  out: number
}
let COMBINED: Combined[] | null = null
/**
 * Every atom economy, yield and mass of reactants where the theoretical product is to 0.01 g and
 * the mass obtained to 0.01 g, the two percentages different, and no figure a given with the
 * point moved: 100 g of reactants would make the theoretical mass the atom economy's figure.
 */
function combinedDraws(): Combined[] {
  if (COMBINED) return COMBINED
  const out: Combined[] = []
  for (const AE of PERCENTS) {
    for (const m of range(50, 500, 10)) {
      if (tenfold(m, 100) || !atMost((AE * m) / 100, 2)) continue
      const T = clean((AE * m) / 100)
      for (const Y of YIELDS) {
        if (!atMost((Y * T) / 100, 2)) continue
        const v = clean((Y * T) / 100)
        if (!distinct(AE, Y, m) || !distinct(T, AE, Y, m) || !clearOf(v, AE, Y, m, T) || !noOnes(v)) continue
        out.push({ AE, Y, m, T, out: v })
      }
    }
  }
  COMBINED = out
  return out
}

export const atomEconomyAndYield: Generator = {
  id: 'yield-atom-economy-and-yield',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q17'],
  build(r, slot, turn) {
    const which = turn % ECONOMY_YIELD.length
    // The mass of reactants first, evenly (the round 200, 250 and 500 g fit most often), then
    // any atom economy and yield that fit it.
    const m = evenly(r, 'yield-q17:m', () => [...new Set(combinedDraws().map((x) => x.m))], (x) => x)
    const fits = combinedDraws().filter((x) => x.m === m)
    const { AE, Y, T, out } = fits[int(r, 0, fits.length - 1)]!
    return numeric(
      slot,
      {
        prompt: ECONOMY_YIELD[which]!(AE, Y, m),
        solution: `Atom economy gives the theoretical product: $\\dfrac{${AE}}{100} \\times ${m} = ${show(T)}\\text{ g}$. The yield is then applied to that: $\\dfrac{${Y}}{100} \\times ${show(T)} = $ **${show(out)} g**. Applying only one of the two percentages is the usual error.`,
        method: [`theoretical product $${show(T)}$ g from the atom economy`, `applies the ${Y}% yield to $${show(T)}$ g`],
        answer: out,
        tolerance: dpTolerance(out),
      },
      // Second route: both percentages as one fraction of the reactants.
      { agrees: near((m * AE * Y) / 10000, out), detail: `${m} × ${AE} × ${Y} ÷ 10000 = ${show((m * AE * Y) / 10000)} g` },
      { context: `text ${which}`, AE, Y, m, T, out },
    )
  },
}

export const yieldGenerators: Generator[] = [
  percentageYield,
  atomEconomySimple,
  theoreticalMass,
  totalMrOfReactants,
  atomEconomy,
  yieldFromReactantMass,
  massFromAtomEconomy,
  atomEconomyAndYield,
]

/** For the tests: the reaction lists as the generators read them. */
export const ATOM_ECONOMY = { SIMPLE, WITH_NUMBERS, TOTALS, economy, called: nameOf }
