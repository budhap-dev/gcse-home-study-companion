import { show } from '../format.ts'
import { pick } from '../random.ts'
import type { Generator } from '../types.ts'
import { atMost, cap, near, numeric } from '../physics/build.ts'
import { dpTolerance } from '../physics/format.ts'
import { atoms, balanced, clean, clearOf, coef, distinct, equation, evenly, mathrm, mr, noOnes, range, sub, tenfold, threeFigures, type Equation, type Term, written } from './build.ts'
import { nameOf } from './compounds.ts'

/**
 * Reacting masses and limiting reactants (AQA 8462, 4.3.2.2 to 4.3.2.4). Every numeric written
 * question in the topic has a generator here; the written questions are the model for the
 * wording and the mark scheme. Every equation is a real reaction, written once as text and
 * checked for balance when this file loads, so an unbalanced one cannot reach a student. Every
 * Mr and Ar is computed from its formula by `mr()`, never typed.
 *
 * Amounts are drawn so that every figure a student meets comes out exact: masses to 0.01 g, as
 * a school balance reads, moles to two decimal places, and each "moles ÷ balancing number" to
 * at most three. A limiting reactant is drawn with the other reactant at least a fifth in
 * excess, so the comparison is never a near tie, and the working names the one that runs out.
 *
 * The helpers above the generators (the Mr line, the ratio step) are exported for yield.ts; the
 * equations, the even draw and the figure checks are in build.ts, the names in compounds.ts.
 */
const TOPIC = 'reacting-masses-and-limiting-reactants'

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

// ---------------------------------------------------------------------------------------------
// The Mr line and the ratio step
// ---------------------------------------------------------------------------------------------

/** One atom of one element: its relative mass is an Ar, not an Mr. */
export const isElement = (f: string) => {
  const a = atoms(f)
  const k = Object.keys(a)
  return k.length === 1 && a[k[0]!] === 1
}
/**
 * The masses a prompt gives, in the written style: "(Mr of H₂ = 2)" for one, and for several
 * "(Mr: CaCO₃ = 100, CaO = 56)" or "(Ar: Fe = 56; Mr: Fe₂O₃ = 160, CO = 28)". Single atoms take
 * an Ar, everything else an Mr, each computed from its formula.
 */
export function given(...formulae: string[]): string {
  const fs = [...new Set(formulae)]
  const one = (f: string) => `${sub(f)} = ${show(mr(f))}`
  if (fs.length === 1) return `(${isElement(fs[0]!) ? 'Ar' : 'Mr'} of ${one(fs[0]!)})`
  const ar = fs.filter(isElement)
  const m = fs.filter((f) => !isElement(f))
  return `(${[ar.length ? `Ar: ${ar.map(one).join(', ')}` : '', m.length ? `Mr: ${m.map(one).join(', ')}` : ''].filter(Boolean).join('; ')})`
}

/**
 * From an amount of one substance to the amount of another by their balancing numbers a and c:
 * the ratio as printed ("1:2", or "4:2 = 2:1"), the working ("0.1 \times 2") and the result.
 */
export function scale(n: number, a: number, c: number) {
  const g = gcd(a, c)
  const p = a / g
  const q = c / g
  const value = clean((n * q) / p)
  const expr = p === 1 && q === 1 ? show(n) : p === 1 ? `${show(n)} \\times ${q}` : q === 1 ? `${show(n)} \\div ${p}` : `${show(n)} \\div ${p} \\times ${q}`
  const ratio = g > 1 ? `${a}:${c} = ${p}:${q}` : `${a}:${c}`
  return { value, expr, ratio, same: p === q }
}
/** "so $0.4$ mol" where the ratio is 1:1, otherwise "so $0.4 \times 2 = 0.8$ mol". */
const so = (s: ReturnType<typeof scale>) => (s.same ? `$${s.expr}$` : `$${s.expr} = ${show(s.value)}$`)
/** n ÷ a printed exactly: at most three decimal places. */
const exactDiv = (n: number, a: number) => atMost(n / a, 3)
/** The figure as a student types it: the solution must contain String(answer). */
const bold = (x: number, unit: string) => `**${show(x)}${unit ? ` ${unit}` : ''}**`

// ---------------------------------------------------------------------------------------------
// q2 and q4: moles from a mass, and a mass from moles
// ---------------------------------------------------------------------------------------------

interface Substance {
  f: string
  /** Lab masses, in grams. */
  mass: [number, number]
}
/**
 * Substances a school lab weighs out. None has an Mr of 100 (calcium carbonate is the written
 * one): every amount of it is its mass with the point moved, the coincidence the slot must not
 * teach.
 */
export const SUBSTANCES: Substance[] = [
  { f: 'MgO', mass: [1, 30] },
  { f: 'NaCl', mass: [1, 50] },
  { f: 'CuSO4', mass: [2, 50] },
  { f: 'NaOH', mass: [1, 30] },
  { f: 'H2O', mass: [1, 50] },
  { f: 'CO2', mass: [1, 30] },
  { f: 'Na2CO3', mass: [1, 50] },
  { f: 'CuO', mass: [1, 30] },
  { f: 'MgCO3', mass: [1, 40] },
  { f: 'ZnO', mass: [1, 40] },
]

interface MolesMass {
  n: number
  m: number
}
/** Every amount of a substance from 0.02 to 0.8 mol whose mass is to 0.01 g, in the lab range, and no coincidence. */
function molesMasses(s: Substance, ok: (x: MolesMass, Mr: number) => boolean): MolesMass[] {
  const Mr = mr(s.f)
  return range(0.02, 0.8, 0.01)
    .map((n) => ({ n, m: clean(n * Mr) }))
    .filter((x) => atMost(x.n * Mr, 2) && x.m >= s.mass[0] && x.m <= s.mass[1] && distinct(x.m, Mr) && noOnes(x.m) && ok(x, Mr))
}

export const molesFromMass: Generator = {
  id: 'reacting-moles-from-mass',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q2'],
  build(r, slot, turn) {
    const s = SUBSTANCES[turn % SUBSTANCES.length]!
    const Mr = mr(s.f)
    const name = nameOf(s.f)
    const { n, m } = evenly(r, `q2:${s.f}`, () => molesMasses(s, (x) => clearOf(x.n, x.m, Mr)), (x) => x.n)
    const prompt = pick(r, [
      `How many moles are there in ${show(m)} g of ${name}? (Mr = ${show(Mr)})`,
      `A sample of ${name} has a mass of ${show(m)} g. How many moles is this? ${given(s.f)}`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: `Moles $= \\dfrac{\\text{mass}}{M_r} = \\dfrac{${show(m)}}{${show(Mr)}} = $ ${bold(n, 'mol')}.`,
        method: [],
        answer: n,
        tolerance: dpTolerance(n),
      },
      // Second route: the moles times the Mr give back the mass.
      { agrees: near(n * Mr, m) && near(m / Mr, n), detail: `${n} × ${Mr} = ${show(n * Mr)} g` },
      { context: s.f, m, Mr, n },
    )
  },
}

export const massFromMoles: Generator = {
  id: 'reacting-mass-from-moles',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q4'],
  build(r, slot, turn) {
    const s = SUBSTANCES[turn % SUBSTANCES.length]!
    const Mr = mr(s.f)
    const name = nameOf(s.f)
    const { n, m } = evenly(r, `q4:${s.f}`, () => molesMasses(s, (x) => clearOf(x.m, x.n, Mr)), (x) => x.m)
    const prompt = pick(r, [
      `What mass, in grams, is ${show(n)} moles of ${name}? ${given(s.f)}`,
      `Calculate the mass, in grams, of ${show(n)} moles of ${name}. ${given(s.f)}`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: `Mass $= \\text{moles} \\times M_r = ${show(n)} \\times ${show(Mr)} = $ ${bold(m, 'g')}.`,
        method: [],
        answer: m,
        tolerance: threeFigures(dpTolerance(m), m),
      },
      // Second route: the mass over the Mr gives back the moles.
      { agrees: near(m / Mr, n), detail: `${m} ÷ ${Mr} = ${show(m / Mr)} mol` },
      { context: s.f, n, Mr, m },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q5: the mass of a product from the mass of a reactant, one to one
// ---------------------------------------------------------------------------------------------

export interface Conversion {
  eq: Equation
  from: string
  to: string
  /** "Calcium carbonate breaks down when it is heated" */
  process: string
  /** "10 g of calcium carbonate is heated until it has fully decomposed" */
  does: (m: number) => string
  /**
   * The start of a run that may lose product, with no claim it went to completion, for a yield:
   * "20 g of zinc carbonate is heated".
   */
  starts: (m: number) => string
  /** "is produced", or "is given off" for a gas. */
  made: string
  /** Lab masses of the reactant, in grams. */
  mass: [number, number]
}
const heated = (f: string) => (m: number) => `${show(m)} g of ${nameOf(f)} is heated until it has fully decomposed`
const warmed = (f: string) => (m: number) => `${show(m)} g of ${nameOf(f)} is heated`
/**
 * Reactions where one reactant gives one product mole for mole: carbonates that decompose on
 * heating, iron and zinc displacing copper from copper sulfate solution, and magnesium burning
 * (2 : 2). Calcium carbonate is left out on purpose: its Mr of 100 makes every amount the mass
 * with the point moved (13 g is 0.13 mol), the coincidence these slots must not teach.
 */
export const CONVERSIONS: Conversion[] = [
  { eq: equation('MgCO3 -> MgO + CO2'), from: 'MgCO3', to: 'MgO', process: 'Magnesium carbonate breaks down when it is heated', does: heated('MgCO3'), starts: warmed('MgCO3'), made: 'is produced', mass: [2, 30] },
  { eq: equation('CuCO3 -> CuO + CO2'), from: 'CuCO3', to: 'CuO', process: 'Copper carbonate breaks down when it is heated', does: heated('CuCO3'), starts: warmed('CuCO3'), made: 'is produced', mass: [2, 30] },
  { eq: equation('ZnCO3 -> ZnO + CO2'), from: 'ZnCO3', to: 'ZnO', process: 'Zinc carbonate breaks down when it is heated', does: heated('ZnCO3'), starts: warmed('ZnCO3'), made: 'is produced', mass: [2, 30] },
  { eq: equation('ZnCO3 -> ZnO + CO2'), from: 'ZnCO3', to: 'CO2', process: 'Zinc carbonate breaks down when it is heated', does: heated('ZnCO3'), starts: warmed('ZnCO3'), made: 'is given off', mass: [2, 30] },
  {
    eq: equation('Fe + CuSO4 -> FeSO4 + Cu'),
    from: 'Fe',
    to: 'Cu',
    process: 'Iron displaces copper from excess copper sulfate solution',
    does: (m) => `${show(m)} g of iron reacts completely with excess copper sulfate solution`,
    starts: (m) => `${show(m)} g of iron is added to excess copper sulfate solution`,
    made: 'is produced',
    mass: [1, 15],
  },
  {
    eq: equation('Zn + CuSO4 -> ZnSO4 + Cu'),
    from: 'Zn',
    to: 'Cu',
    process: 'Zinc displaces copper from excess copper sulfate solution',
    does: (m) => `${show(m)} g of zinc reacts completely with excess copper sulfate solution`,
    starts: (m) => `${show(m)} g of zinc is added to excess copper sulfate solution`,
    made: 'is produced',
    mass: [1, 15],
  },
  {
    eq: equation('2Mg + O2 -> 2MgO'),
    from: 'Mg',
    to: 'MgO',
    process: 'Magnesium burns in oxygen',
    does: (m) => `${show(m)} g of magnesium is burned completely in oxygen`,
    starts: (m) => `${show(m)} g of magnesium is burned in a crucible`,
    made: 'is produced',
    mass: [0.4, 5],
  },
]

export interface OneToOne {
  n: number
  m: number
  out: number
}
/**
 * Every amount of the reactant from 0.02 to 0.6 mol whose mass and product mass are to 0.01 g:
 * never a power of ten of a mole (10 g of an Mr of 100), never a product mass that is a given
 * or one doubled, halved or with the point moved.
 */
export function oneToOne(c: Conversion): OneToOne[] {
  const M1 = mr(c.from)
  const M2 = mr(c.to)
  return range(0.02, 0.6, 0.01)
    .map((n) => ({ n, m: clean(n * M1), out: clean(n * M2) }))
    .filter((x) => atMost(x.n * M1, 2) && atMost(x.n * M2, 2) && x.m >= c.mass[0] && x.m <= c.mass[1] && !tenfold(x.n, 1) && clearOf(x.out, x.m, M1, M2) && distinct(x.m, M1) && noOnes(x.m, x.out))
}
/** "the ratio $\mathrm{MgCO_3}:\mathrm{MgO}$ is $1:1$" */
export const ratioOf = (eq: Equation, a: string, b: string) => `the ratio $${mathrm(a)}:${mathrm(b)}$ is $${scale(1, coef(eq, a), coef(eq, b)).ratio}$`

export const massOfProduct: Generator = {
  id: 'reacting-mass-of-product',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q5'],
  build(r, slot, turn) {
    const c = CONVERSIONS[turn % CONVERSIONS.length]!
    const M1 = mr(c.from)
    const M2 = mr(c.to)
    const { n, m, out } = evenly(r, `q5:${c.from}:${c.to}`, () => oneToOne(c), (x) => x.out)
    const eq = written(c.eq)
    const prompt = pick(r, [
      `${c.process}: ${eq}. What mass of ${nameOf(c.to)}, in grams, ${c.made} from ${show(m)} g of ${nameOf(c.from)}? ${given(c.from, c.to)}`,
      `${cap(c.does(m))}: ${eq}. What mass of ${nameOf(c.to)}, in grams, ${c.made}? ${given(c.from, c.to)}`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: `Moles of ${sub(c.from)} $= \\dfrac{${show(m)}}{${show(M1)}} = ${show(n)}$; ${ratioOf(c.eq, c.from, c.to)}; mass of ${sub(c.to)} $= ${show(n)} \\times ${show(M2)} = $ ${bold(out, 'g')}.`,
        method: [`moles of ${sub(c.from)}: $\\dfrac{${show(m)}}{${show(M1)}} = ${show(n)}$`],
        answer: out,
        tolerance: threeFigures(dpTolerance(out), out),
      },
      // Second route: the reactant's mass scaled by the ratio of the two masses per mole.
      { agrees: near((m * M2) / M1, out) && coef(c.eq, c.from) === coef(c.eq, c.to), detail: `${m} × ${M2} ÷ ${M1} = ${show((m * M2) / M1)} g` },
      { context: `${c.from}->${c.to}`, m, n, out },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q8: from moles of a reactant to the mass of a product, through the ratio
// ---------------------------------------------------------------------------------------------

interface ToProduct {
  eq: Equation
  from: string
  to: string
  /** What the reactant meets in excess. */
  excess: string
  /** Moles of the reactant a school lab uses. */
  moles: [number, number]
}
const TO_PRODUCT: ToProduct[] = [
  { eq: equation('Mg + 2HCl -> MgCl2 + H2'), from: 'Mg', to: 'H2', excess: 'excess hydrochloric acid', moles: [0.02, 0.5] },
  { eq: equation('Zn + H2SO4 -> ZnSO4 + H2'), from: 'Zn', to: 'H2', excess: 'excess sulfuric acid', moles: [0.02, 0.3] },
  { eq: equation('2Al + 6HCl -> 2AlCl3 + 3H2'), from: 'Al', to: 'H2', excess: 'excess hydrochloric acid', moles: [0.02, 0.4] },
  { eq: equation('Mg + 2HCl -> MgCl2 + H2'), from: 'Mg', to: 'MgCl2', excess: 'excess hydrochloric acid', moles: [0.02, 0.5] },
  { eq: equation('Zn + 2HCl -> ZnCl2 + H2'), from: 'Zn', to: 'ZnCl2', excess: 'excess hydrochloric acid', moles: [0.02, 0.3] },
  { eq: equation('CaCO3 + 2HCl -> CaCl2 + H2O + CO2'), from: 'CaCO3', to: 'CO2', excess: 'excess hydrochloric acid', moles: [0.02, 0.3] },
  { eq: equation('Fe2O3 + 2Al -> Al2O3 + 2Fe'), from: 'Fe2O3', to: 'Fe', excess: 'excess aluminium powder', moles: [0.02, 0.2] },
]

export const massFromMolesByRatio: Generator = {
  id: 'reacting-mass-by-ratio',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q8'],
  build(r, slot, turn) {
    const c = TO_PRODUCT[turn % TO_PRODUCT.length]!
    const a = coef(c.eq, c.from)
    const k = coef(c.eq, c.to)
    const M = mr(c.to)
    const { n, p, out } = evenly(
      r,
      `q8:${c.eq.text}:${c.to}`,
      () =>
        range(...c.moles, 0.01)
          .map((n) => {
            const p = scale(n, a, k).value
            return { n, p, out: clean(p * M) }
          })
          .filter((x) => atMost((x.n * k) / a, 2) && atMost(x.p * M, 2) && !tenfold(x.out, x.n) && !tenfold(x.out, M) && noOnes(x.out)),
      (x) => x.out,
    )
    const s = scale(n, a, k)
    const eq = written(c.eq)
    const prompt = pick(r, [
      `What mass of ${nameOf(c.to)}, in grams, is produced when ${show(n)} moles of ${nameOf(c.from)} reacts fully with ${c.excess} in ${eq}? ${given(c.to)}`,
      `In ${eq}, ${show(n)} moles of ${nameOf(c.from)} reacts fully with ${c.excess}. What mass of ${nameOf(c.to)}, in grams, is produced? ${given(c.to)}`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: `${cap(ratioOf(c.eq, c.from, c.to))}, so ${so(s)} mol of ${nameOf(c.to)} forms: $${show(p)} \\times ${show(M)} = $ ${bold(out, 'g')}.`,
        method: [`$${show(p)}$ mol of ${sub(c.to)}`],
        answer: out,
        tolerance: threeFigures(dpTolerance(out), out),
      },
      // Second route: the mass per mole of reactant, n × (k × M ÷ a), without the moles of product.
      { agrees: near((n * k * M) / a, out), detail: `${n} × ${k} × ${M} ÷ ${a} = ${show((n * k * M) / a)} g` },
      { context: `${c.from}->${c.to}`, n, p, out },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q9 and q17: the limiting reactant from amounts in moles
// ---------------------------------------------------------------------------------------------

interface Limiting {
  /** Moles of the first and second reactant as the equation writes them. */
  n1: number
  n2: number
  /** Moles of the product. */
  p: number
}
/**
 * Every pair of amounts from lo to hi in which reactant `limit` (0 or 1) runs out first with the
 * other at least a fifth in excess, each amount over its balancing number exact to three
 * places, the product to two, no two amounts alike and the product none of them with the point
 * moved.
 */
function limitingPairs(a: [number, number], k: number, limit: 0 | 1, lo: number, hi: number): Limiting[] {
  const out: Limiting[] = []
  const amounts = range(lo, hi, 0.01)
  for (const n1 of amounts) {
    for (const n2 of amounts) {
      if (!exactDiv(n1, a[0]) || !exactDiv(n2, a[1])) continue
      const x = [n1 / a[0], n2 / a[1]]
      const L = x[limit]!
      const E = x[1 - limit]!
      if (E < 1.2 * L - 1e-9 || E > 4 * L) continue
      const nL = limit === 0 ? n1 : n2
      const p = clean((nL * k) / a[limit])
      if (!atMost((nL * k) / a[limit], 2)) continue
      if (!distinct(n1, n2) || tenfold(p, n1) || tenfold(p, n2) || !noOnes(n1, n2, p)) continue
      // The amount in excess is not the answer doubled or halved, which a wrong pick could reach.
      const nE = limit === 0 ? n2 : n1
      if (near(p, 2 * nE) || near(2 * p, nE)) continue
      out.push({ n1, n2, p })
    }
  }
  return out
}
/** "Oxygen is limiting ($0.1 \div 1 = 0.1$ against $0.3 \div 2 = 0.15$)." */
const against = (nL: number, aL: number, nE: number, aE: number) =>
  `$${show(nL)} \\div ${aL} = ${show(nL / aL)}$ against $${show(nE)} \\div ${aE} = ${show(nE / aE)}$`

interface MolesContext {
  eq: Equation
  limit: string
  product: string
  /** "is burned with", "reacts with" */
  verb: string
}
/**
 * Reactions met in the specification, each with the reactant that runs out and a product whose
 * ratio to it is not 1 : 1 (that would make the answer a given). In six of the eight the
 * reactant that runs out has the larger balancing number, so it can be the one with more moles;
 * there the draw makes it so about two times in three, and "fewer moles runs out" is right in
 * only about half the builds.
 */
const MOLES_CONTEXTS: MolesContext[] = [
  { eq: equation('2Mg + O2 -> 2MgO'), limit: 'O2', product: 'MgO', verb: 'is burned with' },
  { eq: equation('N2 + 3H2 -> 2NH3'), limit: 'H2', product: 'NH3', verb: 'reacts with' },
  { eq: equation('4Al + 3O2 -> 2Al2O3'), limit: 'Al', product: 'Al2O3', verb: 'is burned with' },
  { eq: equation('2Fe + 3Cl2 -> 2FeCl3'), limit: 'Cl2', product: 'FeCl3', verb: 'is heated with' },
  { eq: equation('CH4 + 2O2 -> CO2 + 2H2O'), limit: 'O2', product: 'CO2', verb: 'is burned with' },
  { eq: equation('2Al + 3Cl2 -> 2AlCl3'), limit: 'Cl2', product: 'AlCl3', verb: 'is heated with' },
  { eq: equation('4Na + O2 -> 2Na2O'), limit: 'Na', product: 'Na2O', verb: 'is burned with' },
  { eq: equation('4Al + 3O2 -> 2Al2O3'), limit: 'O2', product: 'Al2O3', verb: 'is burned with' },
]
const PAIRS = new Map<string, Limiting[]>()
/** How often the limiting reactant has more moles, where the context allows both. */
const MORE_SHARE = 0.65

export const limitingFromMoles: Generator = {
  id: 'reacting-limiting-from-moles',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q9'],
  build(r, slot, turn) {
    const c = MOLES_CONTEXTS[turn % MOLES_CONTEXTS.length]!
    const [R1, R2] = c.eq.left as [Term, Term]
    const limit: 0 | 1 = R1.f === c.limit ? 0 : 1
    const k = coef(c.eq, c.product)
    const key = `${c.eq.text}:${c.limit}`
    const all = PAIRS.get(key) ?? (PAIRS.set(key, limitingPairs([R1.n, R2.n], k, limit, 0.05, 0.9)), PAIRS.get(key)!)
    const hasMore = (x: Limiting) => (limit === 0 ? x.n1 > x.n2 : x.n2 > x.n1)
    const either = all.some(hasMore) && all.some((x) => !hasMore(x))
    // Whether the reactant that runs out has more moles is decided first, then the answer evenly.
    const more = either ? r() < MORE_SHARE : all.some(hasMore)
    const { n1, n2, p } = evenly(r, `q9:${c.eq.text}:${c.limit}:${more}`, () => all.filter((x) => hasMore(x) === more), (x) => x.p)
    const [L, E] = limit === 0 ? [R1, R2] : [R2, R1]
    const [nL, nE] = limit === 0 ? [n1, n2] : [n2, n1]
    const s = scale(nL, L.n, k)
    const eq = written(c.eq)
    const prompt = pick(r, [
      `In ${eq}, ${show(n1)} mol of ${nameOf(R1.f)} ${c.verb} ${show(n2)} mol of ${nameOf(R2.f)}. How many moles of ${nameOf(c.product)} form?`,
      `${show(n1)} mol of ${nameOf(R1.f)} ${c.verb} ${show(n2)} mol of ${nameOf(R2.f)}: ${eq}. How many moles of ${nameOf(c.product)} can form?`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: `${cap(nameOf(L.f))} is limiting (${against(nL, L.n, nE, E.n)}). ${cap(ratioOf(c.eq, L.f, c.product))}, so $${s.expr} = $ ${bold(p, 'mol')}.`,
        method: [`identifies ${nameOf(L.f)} as limiting`],
        answer: p,
        tolerance: dpTolerance(p),
      },
      // Second route: the product each reactant could make on its own; the smaller is the answer.
      (() => {
        const from1 = (n1 * k) / R1.n
        const from2 = (n2 * k) / R2.n
        return { agrees: near(Math.min(from1, from2), p) && (limit === 0 ? from1 < from2 : from2 < from1), detail: `${show(from1)} or ${show(from2)} mol: the smaller` }
      })(),
      { context: `${c.eq.text}:${c.limit}`, n1, n2, p, limitHasMore: nL > nE ? 1 : 0 },
    )
  },
}

/** The balancing numbers of A, B and C in the letters reaction, and which of A or B runs out. */
const LETTERS: { a: [number, number]; k: number; limit: 0 | 1 }[] = [
  { a: [1, 2], k: 1, limit: 1 },
  { a: [2, 1], k: 2, limit: 1 },
  { a: [1, 3], k: 2, limit: 1 },
  { a: [1, 2], k: 2, limit: 0 },
  { a: [3, 1], k: 2, limit: 0 },
  { a: [2, 3], k: 1, limit: 1 },
]
const lettersEq = (a: [number, number], k: number) => `${a[0] > 1 ? a[0] : ''}A + ${a[1] > 1 ? a[1] : ''}B → ${k > 1 ? k : ''}C`

export const limitingLetters: Generator = {
  id: 'reacting-limiting-letters',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q17'],
  build(r, slot, turn) {
    const c = LETTERS[turn % LETTERS.length]!
    const { n1, n2, p } = evenly(r, `q17:${c.a.join()}:${c.k}:${c.limit}`, () => limitingPairs(c.a, c.k, c.limit, 0.1, 1.5), (x) => x.p)
    const [Ln, En] = c.limit === 0 ? ['A', 'B'] : ['B', 'A']
    const [aL, aE] = c.limit === 0 ? c.a : [c.a[1], c.a[0]]
    const nL = c.limit === 0 ? n1 : n2
    const s = scale(nL, aL, c.k)
    const eq = lettersEq(c.a, c.k)
    const prompt = pick(r, [
      `A reaction ${eq} uses ${show(n1)} mol of A and ${show(n2)} mol of B. How many moles of C can form?`,
      `In the reaction ${eq}, ${show(n1)} mol of A is mixed with ${show(n2)} mol of B. What is the greatest number of moles of C that can form?`,
    ])
    const parts = [`A: $${show(n1)} \\div ${c.a[0]} = ${show(n1 / c.a[0])}$`, `B: $${show(n2)} \\div ${c.a[1]} = ${show(n2 / c.a[1])}$`]
    return numeric(
      slot,
      {
        prompt,
        solution: `${parts.join('; ')}. ${Ln} is limiting, and the ratio $\\mathrm{${Ln}}:\\mathrm{C}$ is $${s.ratio}$, so $${s.expr} = $ ${bold(p, 'mol')} of C.`,
        method: [`identifies ${Ln} as limiting`],
        answer: p,
        tolerance: dpTolerance(p),
      },
      (() => {
        const from1 = (n1 * c.k) / c.a[0]
        const from2 = (n2 * c.k) / c.a[1]
        return { agrees: near(Math.min(from1, from2), p) && (c.limit === 0 ? from1 < from2 : from2 < from1), detail: `${show(from1)} or ${show(from2)} mol of C: the smaller (${En} in excess)` }
      })(),
      { context: eq, n1, n2, p, aE },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q11, q12 and q15: the limiting reactant from masses
// ---------------------------------------------------------------------------------------------

interface MassReaction {
  eq: Equation
  /** Lab masses of the first and second reactant, in grams. */
  mass: [[number, number], [number, number]]
  /** How the first meets the second: "reacts with", "is heated with". */
  verb: string
}
/**
 * Lab amounts. Gases are kept to what a gas jar or syringe holds: oxygen up to 4.5 g (3.4 dm³) and
 * hydrogen up to 0.6 g. The Haber masses follow the written slot. Chlorine is left to the moles
 * slot: at a plausible 7 g, the amounts exact to 0.01 mol leave only three masses to draw.
 */
const R = {
  mgAcid: { eq: equation('Mg + 2HCl -> MgCl2 + H2'), mass: [[0.5, 10], [1, 15]], verb: 'reacts with' },
  znAcid: { eq: equation('Zn + 2HCl -> ZnCl2 + H2'), mass: [[1, 15], [1, 15]], verb: 'reacts with' },
  carbonate: { eq: equation('MgCO3 + 2HCl -> MgCl2 + H2O + CO2'), mass: [[2, 25], [1, 15]], verb: 'reacts with' },
  mgBurn: { eq: equation('2Mg + O2 -> 2MgO'), mass: [[0.5, 6], [0.5, 4]], verb: 'is burned in' },
  ironSulfur: { eq: equation('Fe + S -> FeS'), mass: [[1, 15], [1, 10]], verb: 'is heated with' },
  zincSulfur: { eq: equation('Zn + S -> ZnS'), mass: [[1, 15], [0.5, 8]], verb: 'is heated with' },
  mgSulfuric: { eq: equation('Mg + H2SO4 -> MgSO4 + H2'), mass: [[0.5, 10], [1, 25]], verb: 'reacts with' },
  znSulfuric: { eq: equation('Zn + H2SO4 -> ZnSO4 + H2'), mass: [[1, 15], [1, 25]], verb: 'reacts with' },
  copperSulfate: { eq: equation('CuO + H2SO4 -> CuSO4 + H2O'), mass: [[1, 25], [1, 25]], verb: 'reacts with' },
  haber: { eq: equation('N2 + 3H2 -> 2NH3'), mass: [[1, 40], [0.5, 10]], verb: 'reacts with' },
  water: { eq: equation('2H2 + O2 -> 2H2O'), mass: [[0.1, 0.6], [0.5, 4.5]], verb: 'is burned in' },
} satisfies Record<string, MassReaction>

/** "7.2 g of magnesium", or "hydrochloric acid containing 7.3 g of HCl" for an acid, whose mass is the solute's. */
export function amount(f: string, m: number): string {
  if (f === 'HCl' || f === 'H2SO4') return `${nameOf(f)} containing ${show(m)} g of ${sub(f)}`
  return `${show(m)} g of ${nameOf(f)}`
}

interface MassDraw {
  n1: number
  n2: number
  m1: number
  m2: number
  limit: 0 | 1
}
const MASS_DRAWS = new Map<string, MassDraw[]>()
/**
 * Every pair of amounts, to 0.01 mol, whose masses are to 0.01 g and in the lab range, one
 * reactant at least a fifth in excess, each amount over its balancing number exact to three
 * places, the two masses neither alike nor a power of ten apart, and neither amount 0.1 or 0.01 mol.
 */
function massDraws(x: MassReaction): MassDraw[] {
  const cached = MASS_DRAWS.get(x.eq.text)
  if (cached) return cached
  const [A, B] = x.eq.left as [Term, Term]
  const MA = mr(A.f)
  const MB = mr(B.f)
  const amounts = (M: number, [lo, hi]: [number, number]) =>
    range(0.01, 2, 0.01).filter((n) => atMost(n * M, 2) && n * M >= lo - 1e-9 && n * M <= hi + 1e-9)
  const out: MassDraw[] = []
  for (const n1 of amounts(MA, x.mass[0])) {
    if (!exactDiv(n1, A.n)) continue
    for (const n2 of amounts(MB, x.mass[1])) {
      if (!exactDiv(n2, B.n)) continue
      const x1 = n1 / A.n
      const x2 = n2 / B.n
      const limit: 0 | 1 = x1 < x2 ? 0 : 1
      const [L, E] = limit === 0 ? [x1, x2] : [x2, x1]
      if (E < 1.2 * L - 1e-9 || E > 4 * L) continue
      const m1 = clean(n1 * MA)
      const m2 = clean(n2 * MB)
      // A mole of 0.1 or 0.01 makes the mass an Mr with the point moved (3.2 g of O₂ is 0.1 mol).
      if (!distinct(m1, m2) || !distinct(n1, n2) || !noOnes(m1, m2) || tenfold(n1, 1) || tenfold(n2, 1)) continue
      out.push({ n1, n2, m1, m2, limit })
    }
  }
  MASS_DRAWS.set(x.eq.text, out)
  return out
}
/** Each reactant's moles and its moles over its balancing number, as the written working sets them out. */
function eachReactant(eq: Equation, d: MassDraw): string {
  return (eq.left as [Term, Term])
    .map((t, i) => {
      const m = i === 0 ? d.m1 : d.m2
      const n = i === 0 ? d.n1 : d.n2
      return `${sub(t.f)}: $\\dfrac{${show(m)}}{${show(mr(t.f))}} = ${show(n)}\\text{ mol}$, $\\div ${t.n} = ${show(n / t.n)}$`
    })
    .join('. ')
}
/** Whether the draw's limiting reactant is truly the one that makes less product. */
function limitHolds(eq: Equation, d: MassDraw): boolean {
  const [A, B] = eq.left as [Term, Term]
  const x1 = d.m1 / mr(A.f) / A.n
  const x2 = d.m2 / mr(B.f) / B.n
  return d.limit === 0 ? x1 < x2 : x2 < x1
}
const limitName = (f: string) => (f === 'HCl' || f === 'H2SO4' ? `The ${nameOf(f).split(' ')[1]}` : cap(nameOf(f)))

interface ProductContext {
  x: MassReaction
  product: string
}
/**
 * Reactions whose two reactants have masses per equation unit far enough apart that the
 * smaller mass is not always the one that runs out (zinc or a carbonate with hydrochloric acid
 * would make it so, and they stay in the excess slot only).
 */
const MOLES_OF_PRODUCT: ProductContext[] = [
  { x: R.mgAcid, product: 'H2' },
  { x: R.mgSulfuric, product: 'MgSO4' },
  { x: R.mgBurn, product: 'MgO' },
  { x: R.ironSulfur, product: 'FeS' },
  { x: R.znSulfuric, product: 'H2' },
  { x: R.copperSulfate, product: 'CuSO4' },
  { x: R.zincSulfur, product: 'ZnS' },
  { x: R.haber, product: 'NH3' },
]
const MASS_OF_PRODUCT: ProductContext[] = [
  { x: R.haber, product: 'NH3' },
  { x: R.mgBurn, product: 'MgO' },
  { x: R.ironSulfur, product: 'FeS' },
  { x: R.mgSulfuric, product: 'MgSO4' },
  { x: R.znSulfuric, product: 'ZnSO4' },
  { x: R.water, product: 'H2O' },
  { x: R.zincSulfur, product: 'ZnS' },
  { x: R.mgAcid, product: 'MgCl2' },
]

interface ProductDraw extends MassDraw {
  p: number
  out: number
}
function productDraws(c: ProductContext, asMass: boolean): ProductDraw[] {
  const k = coef(c.x.eq, c.product)
  const [A, B] = c.x.eq.left as [Term, Term]
  const M = mr(c.product)
  return massDraws(c.x)
    .map((d) => {
      const nL = d.limit === 0 ? d.n1 : d.n2
      const aL = d.limit === 0 ? A.n : B.n
      const p = clean((nL * k) / aL)
      return { ...d, p, out: asMass ? clean(p * M) : p, raw: asMass ? p * M : p, pRaw: (nL * k) / aL }
    })
    .filter((d) => atMost(d.pRaw, 2) && atMost(d.raw, 2) && clearOf(d.out, d.m1, d.m2) && !tenfold(d.out, M) && noOnes(d.out))
    .map(({ raw: _r, pRaw: _p, ...d }) => d)
}

function productBuild(slotKey: string, contexts: ProductContext[], asMass: boolean): Generator['build'] {
  return (r, slot, turn) => {
    const c = contexts[turn % contexts.length]!
    const eq = c.x.eq
    const [A, B] = eq.left as [Term, Term]
    const k = coef(eq, c.product)
    const M = mr(c.product)
    // Which reactant runs out is decided first, evenly, then the answer evenly within it.
    const limit: 0 | 1 = r() < 0.5 ? 0 : 1
    const d = evenly(r, `${slotKey}:${eq.text}:${c.product}:${limit}`, () => productDraws(c, asMass).filter((x) => x.limit === limit), (x) => x.out)
    const [L, nL] = d.limit === 0 ? [A, d.n1] : [B, d.n2]
    const s = scale(nL, L.n, k)
    const pName = nameOf(c.product)
    const ask = asMass ? `What mass of ${pName}, in grams, is formed?` : `How many moles of ${pName} are produced?`
    const masses = asMass ? given(A.f, B.f, c.product) : given(A.f, B.f)
    const prompt = pick(r, [
      `${cap(amount(A.f, d.m1))} ${c.x.verb} ${amount(B.f, d.m2)}: ${written(eq)}. ${ask} ${masses}`,
      `In ${written(eq)}, ${amount(A.f, d.m1)} ${c.x.verb} ${amount(B.f, d.m2)}. ${ask} ${masses}`,
    ])
    const ratio = cap(ratioOf(eq, L.f, c.product))
    const solution = asMass
      ? `${eachReactant(eq, d)}. ${limitName(L.f)} is **limiting**. ${ratio}, so ${so(s)} mol of ${pName} forms, a mass of $${show(d.p)} \\times ${show(M)} = $ ${bold(d.out, 'g')}.`
      : `${eachReactant(eq, d)}. ${limitName(L.f)} is **limiting**. ${ratio}, so ${s.same ? '' : `$${s.expr} = $ `}${bold(d.p, 'mol')} of ${pName} forms.`
    const method = asMass
      ? [`moles of both reactants: ${sub(A.f)} $${show(d.n1)}$, ${sub(B.f)} $${show(d.n2)}$`, `identifies ${nameOf(L.f)} as limiting`]
      : [`moles of each reactant: ${sub(A.f)} $${show(d.n1)}$, ${sub(B.f)} $${show(d.n2)}$`, `divides by the balancing numbers and picks ${sub(L.f)}`]
    // Second route: the mass of the limiting reactant scaled straight to the product, and the
    // limiting reactant confirmed from the masses as printed.
    const mL = d.limit === 0 ? d.m1 : d.m2
    const direct = (mL / mr(L.f)) * (k / L.n) * (asMass ? M : 1)
    return numeric(
      slot,
      { prompt, solution, method, answer: d.out, tolerance: threeFigures(dpTolerance(d.out), d.out) },
      { agrees: near(direct, d.out) && limitHolds(eq, d), detail: `${mL} ÷ ${mr(L.f)} × ${k}/${L.n}${asMass ? ` × ${M}` : ''} = ${show(direct)}` },
      { context: `${eq.text}:${c.product}`, m1: d.m1, m2: d.m2, n1: d.n1, n2: d.n2, limit: L.f, out: d.out },
    )
  }
}

export const limitingMolesFromMasses: Generator = {
  id: 'reacting-limiting-moles-from-masses',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q11'],
  build: productBuild('q11', MOLES_OF_PRODUCT, false),
}

export const limitingMassFromMasses: Generator = {
  id: 'reacting-limiting-mass-from-masses',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q15'],
  build: productBuild('q15', MASS_OF_PRODUCT, true),
}

interface ExcessContext {
  x: MassReaction
  /** The reactant asked about, which is in excess. */
  left: 0 | 1
}
const EXCESS: ExcessContext[] = [
  { x: R.mgAcid, left: 0 },
  { x: R.carbonate, left: 0 },
  { x: R.copperSulfate, left: 0 },
  { x: R.ironSulfur, left: 0 },
  { x: R.znAcid, left: 0 },
  { x: R.ironSulfur, left: 1 },
]

export const excessLeft: Generator = {
  id: 'reacting-excess-left',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q12'],
  build(r, slot, turn) {
    const c = EXCESS[turn % EXCESS.length]!
    const eq = c.x.eq
    const [A, B] = eq.left as [Term, Term]
    const [E, L] = c.left === 0 ? [A, B] : [B, A]
    const ME = mr(E.f)
    const d = evenly(
      r,
      `q12:${eq.text}:${c.left}`,
      () =>
        massDraws(c.x)
          .filter((d) => d.limit !== c.left)
          .map((d) => {
            const nE = c.left === 0 ? d.n1 : d.n2
            const nL = c.left === 0 ? d.n2 : d.n1
            const usedRaw = (nL * E.n) / L.n
            const used = clean(usedRaw)
            const left = clean(nE - used)
            return { ...d, nE, nL, used, left, out: clean(left * ME), ok: atMost(usedRaw, 2) && atMost(left * ME, 2) }
          })
          .filter((d) => {
            const mE = c.left === 0 ? d.m1 : d.m2
            const mL = c.left === 0 ? d.m2 : d.m1
            // Never 0.1 mol left, which makes the answer the Mr with the point moved (7.95 g of CuO).
            return d.ok && d.left > 0 && clearOf(d.out, mE, mL, ME) && !tenfold(d.left, 1) && !near(d.out, clean(d.used * ME)) && noOnes(d.out, d.used, d.left) && !tenfold(d.left, d.used)
          }),
      (d) => d.out,
    )
    const s = scale(d.nL, L.n, E.n)
    const mE = c.left === 0 ? d.m1 : d.m2
    const eName = nameOf(E.f)
    const prompt = pick(r, [
      `${cap(amount(A.f, d.m1))} ${c.x.verb} ${amount(B.f, d.m2)}: ${written(eq)}. What mass of ${eName}, in grams, is left unreacted? ${given(A.f, B.f)}`,
      `In ${written(eq)}, ${amount(A.f, d.m1)} ${c.x.verb} ${amount(B.f, d.m2)} until the reaction stops. What mass of ${eName}, in grams, is left over? ${given(A.f, B.f)}`,
    ])
    const reacts = s.same ? `$${show(d.used)}\\text{ mol}$` : `$${s.expr} = ${show(d.used)}\\text{ mol}$`
    const solution =
      `${eachReactant(eq, d)}. ${limitName(L.f)} runs out first. ` +
      `$${show(d.nL)}\\text{ mol}$ of ${sub(L.f)} reacts with ${reacts} of ${sub(E.f)} (${ratioOf(eq, L.f, E.f)}). ` +
      `Starting with $${show(d.nE)}\\text{ mol}$, that leaves $${show(d.nE)} - ${show(d.used)} = ${show(d.left)}\\text{ mol}$, a mass of $${show(d.left)} \\times ${show(ME)} = $ ${bold(d.out, 'g')}.`
    // Second route: the mass of the excess reactant less the mass of it that reacts.
    const second = mE - d.used * ME
    return numeric(
      slot,
      {
        prompt,
        solution,
        method: [`$${show(d.used)}$ mol of ${sub(E.f)} reacts`, `$${show(d.left)}$ mol left`],
        answer: d.out,
        tolerance: threeFigures(dpTolerance(d.out), d.out),
      },
      { agrees: near(second, d.out) && limitHolds(eq, d) && d.limit !== c.left, detail: `${mE} − ${show(d.used * ME)} = ${show(second)} g` },
      { context: `${eq.text}:${E.f}`, m1: d.m1, m2: d.m2, used: d.used, left: d.left, out: d.out },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q13: a balancing number from reacting masses
// ---------------------------------------------------------------------------------------------

interface Balancing {
  eq: Equation
  /** The reactant whose balancing number is asked for. */
  ask: string
  /** Lab masses of the first and second reactant, in grams. */
  mass: [[number, number], [number, number]]
}
/**
 * Reactions that go to completion when heated or burned, with lab amounts: no Haber (it is
 * reversible), and no alkali metal burned by the gram. The answers run 1 to 4, two contexts
 * each, so no balancing number carries the slot.
 */
const BALANCING: Balancing[] = [
  { eq: equation('Fe + S -> FeS'), ask: 'Fe', mass: [[1, 12], [0.5, 8]] },
  { eq: equation('2Mg + O2 -> 2MgO'), ask: 'Mg', mass: [[0.2, 6], [0.1, 4]] },
  { eq: equation('2Fe + 3Cl2 -> 2FeCl3'), ask: 'Cl2', mass: [[0.5, 10], [0.5, 9]] },
  { eq: equation('4Fe + 3O2 -> 2Fe2O3'), ask: 'Fe', mass: [[0.5, 10], [0.1, 4]] },
  { eq: equation('Zn + S -> ZnS'), ask: 'S', mass: [[1, 12], [0.5, 8]] },
  { eq: equation('2Cu + O2 -> 2CuO'), ask: 'Cu', mass: [[0.5, 12], [0.1, 4]] },
  { eq: equation('2Al + 3Cl2 -> 2AlCl3'), ask: 'Cl2', mass: [[0.2, 5], [0.5, 9]] },
  { eq: equation('4Al + 3O2 -> 2Al2O3'), ask: 'Al', mass: [[0.2, 5], [0.1, 4]] },
]

interface BalancingDraw {
  u: number
  n1: number
  n2: number
  m1: number
  m2: number
  m3: number
}
/**
 * Every amount of the equation, u mol, whose two amounts of reactant are exact to 0.01 mol, as a
 * student rounds them (0.035 rounded to 0.04 against 0.14 would give 3.5, not 4), and whose
 * masses are to 0.01 g in the lab range. No amount is 0.1 or 0.01 mol (an Ar with the point
 * moved), and no mass printed is the answer.
 */
function balancingDraws(c: Balancing): BalancingDraw[] {
  const [A, B] = c.eq.left as [Term, Term]
  const answer = coef(c.eq, c.ask)
  const out: BalancingDraw[] = []
  for (const u of range(0.0025, 0.5, 0.0025)) {
    const raw = [A.n * u, B.n * u]
    if (!raw.every((v) => atMost(v, 2))) continue
    const [n1, n2] = raw.map(clean) as [number, number]
    if (!atMost(n1 * mr(A.f), 2) || !atMost(n2 * mr(B.f), 2)) continue
    const m1 = clean(n1 * mr(A.f))
    const m2 = clean(n2 * mr(B.f))
    const m3 = clean(m1 + m2)
    const inRange = (m: number, [lo, hi]: [number, number]) => m >= lo - 1e-9 && m <= hi + 1e-9
    if (!inRange(m1, c.mass[0]) || !inRange(m2, c.mass[1])) continue
    if (tenfold(n1, 1) || tenfold(n2, 1) || !distinct(m1, m2, m3) || !noOnes(m1, m2, m3)) continue
    if ([m1, m2, m3].some((m) => tenfold(m, answer))) continue
    out.push({ u, n1, n2, m1, m2, m3 })
  }
  return out
}
/** A ratio figure as printed: 1.5, or \tfrac{4}{3} where it does not end. */
const ratioFigure = (x: number, k: number) => (atMost(x, 2) ? show(x) : `\\tfrac{${Math.round(x * k)}}{${k}}`)

export const balancingFromMasses: Generator = {
  id: 'reacting-balancing-from-masses',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q13'],
  build(r, slot, turn) {
    const c = BALANCING[turn % BALANCING.length]!
    const [A, B] = c.eq.left as [Term, Term]
    const P = c.eq.right[0]!
    const MA = mr(A.f)
    const MB = mr(B.f)
    const { u, n1, n2, m1, m2, m3 } = evenly(r, `q13:${c.eq.text}`, () => balancingDraws(c), (x) => x.m1)
    const small = Math.min(n1, n2)
    const r1 = n1 / small
    const r2 = n2 / small
    // The smallest whole-number multiplier: 1, 2 for 1 : 1.5, 3 for 4/3 : 1.
    const k = [1, 2, 3, 4].find((m) => Number.isInteger(clean(r1 * m)) && Number.isInteger(clean(r2 * m)))!
    const whole = `${clean(r1 * k)}:${clean(r2 * k)}`
    const answer = coef(c.eq, c.ask)
    const ratio = k === 1 ? `$${whole}$` : `$${ratioFigure(r1, k)}:${ratioFigure(r2, k)}$, and multiplying by ${k} for whole numbers gives $${whole}$`
    const ar = [...new Set([...Object.keys(atoms(A.f)), ...Object.keys(atoms(B.f))])]
    const arText = `(Ar: ${ar.map((s) => `${s} = ${show(mr(s))}`).join(', ')})`
    const molar = (t: Term, M: number, m: number, n: number) => `${sub(t.f)}${isElement(t.f) ? '' : ` ($M_r = ${show(M)}$)`}: $\\dfrac{${show(m)}}{${show(M)}} = ${show(n)}$`
    const [a, b, p, ask] = [nameOf(A.f), nameOf(B.f), nameOf(P.f), nameOf(c.ask)]
    const prompt = pick(r, [
      `${show(m1)} g of ${a} reacts completely with ${show(m2)} g of ${b} to form ${show(m3)} g of ${p}. What is the balancing number of ${ask} in the equation? ${arText}`,
      `When ${show(m1)} g of ${a} reacts completely with ${show(m2)} g of ${b}, ${show(m3)} g of ${p} forms. What is the balancing number of ${ask} in the balanced equation? ${arText}`,
      `A student heats ${show(m1)} g of ${a} with ${show(m2)} g of ${b}. Both react completely, forming ${show(m3)} g of ${p}. What is the balancing number of ${ask} in the equation? ${arText}`,
    ])
    const side = (ts: Term[]) => ts.map((t) => `${t.n > 1 ? t.n : ''}${mathrm(t.f)}`).join(' + ')
    return numeric(
      slot,
      {
        prompt,
        solution: `${molar(A, MA, m1, n1)}; ${molar(B, MB, m2, n2)}. Dividing by the smallest gives ${ratio}, so the equation is $${side(c.eq.left)} \\rightarrow ${side(c.eq.right)}$ and the balancing number of ${ask} is ${bold(answer, '')}.`,
        method: [`converts both masses to moles: $${show(n1)}$ and $${show(n2)}$`, k === 1 ? `divides by the smallest to get $${whole}$` : `divides by the smallest and scales to whole numbers: $${whole}$`],
        answer,
        tolerance: 0,
      },
      // Second route: the moles over each balancing number are equal, and the equation balances.
      { agrees: near(n1 / A.n, n2 / B.n) && balanced(c.eq) && near(m1 + m2, m3) && whole === `${A.n}:${B.n}`, detail: `${n1} ÷ ${A.n} = ${n2} ÷ ${B.n} = ${show(u)}` },
      { context: c.eq.text, m1, m2, m3, n1, n2 },
    )
  },
}

export const reactingGenerators: Generator[] = [
  molesFromMass,
  massFromMoles,
  massOfProduct,
  massFromMolesByRatio,
  limitingFromMoles,
  limitingMolesFromMasses,
  excessLeft,
  balancingFromMasses,
  limitingMassFromMasses,
  limitingLetters,
]
