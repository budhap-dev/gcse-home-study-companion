import { ELEMENTS } from '../../elements.ts'
import { clearOfHalf, fixed, roundTo, show } from '../format.ts'
import { cap, numeric } from '../physics/build.ts'
import { dpTolerance } from '../physics/format.ts'
import { pick } from '../random.ts'
import type { Generator } from '../types.ts'
import { AR, arLine, atoms, clean, clearOf, evenly, mr, mrWorking, parse, range, word } from './build.ts'
import { ORES, factual } from './compounds.ts'

/** A compound with the fact a prompt may say about it. */
type Named = { name: string; fact: string }

/**
 * Formulae and balancing equations (AQA 8462, 4.1.1.1 and 4.3.1): counting the atoms a
 * formula and its multiplier stand for, relative formula mass, and the percentage by mass of
 * an element. Every numeric written question in the topic has a generator here; the choice
 * and extended questions stay as written. Every formula is a real compound named as GCSE
 * names it, every Mr and Ar comes from build.ts (the AQA periodic table insert), and every
 * fact said about a compound is true of it. Formulae print plain (H2SO4), as the written
 * prompts print them.
 *
 * Names and facts come from compounds.ts, the figure checks and the even draw from build.ts.
 * Sodium nitrate is left out on purpose:
 * its formula, NaNO3, holds the letters NaN, which the release check reads as a broken number.
 */
const TOPIC = 'formulae-and-balancing-equations'

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const ELEMENT_NAMES = Object.fromEntries(ELEMENTS.map((e) => [e.symbol, e.name]))
/** An element's name from its symbol: Cl is chlorine. */
export const elementName = (symbol: string) => ELEMENT_NAMES[symbol]!


/** Mr a second way: each element's atoms counted out with brackets multiplied, then weighed. */
export const mrByAtoms = (formula: string) => clean(Object.entries(atoms(formula)).reduce((t, [s, n]) => t + n * AR[s]!, 0))

/** Mr working from the atom counts, brackets already multiplied out: CH3COOH is "(2 \times 12) + (4 \times 1) + (2 \times 16)". */
export const atomsWorking = (formula: string) =>
  Object.entries(atoms(formula))
    .map(([s, n]) => (n === 1 ? show(AR[s]!) : `(${n} \\times ${show(AR[s]!)})`))
    .join(' + ')

/** "$… = 18$." — the end of an unitless working. */
const ends = (expr: string, answer: number) => `$${expr} = ${show(answer)}$.`

// ---------------------------------------------------------------------------------------------
// Counting atoms: 2H2O holds four hydrogen atoms
// ---------------------------------------------------------------------------------------------

/**
 * Formulae whose elements each appear once and outside brackets, so the count of an element
 * is its one subscript. Brackets and repeated elements (CH3COOH) belong to Mr, not here.
 */
const COUNT_FORMULAE = [
  'H2O', 'CO2', 'NH3', 'CH4', 'SO2', 'SO3', 'NO2', 'H2S', 'HNO3', 'H2SO4', 'C2H6', 'C3H8', 'C2H4', 'C4H10', 'C6H12O6',
  'CaCl2', 'MgCl2', 'CuCl2', 'Na2O', 'Na2CO3', 'CaCO3', 'Al2O3', 'Fe2O3', 'CuSO4', 'K2SO4', 'Li2O', 'AlCl3', 'FeCl3', 'SiO2', 'H3PO4',
]
interface Count {
  formula: string
  symbol: string
  /** The multiplier in front: 3 in 3CO2. */
  k: number
  /** The subscript: 2 in CO2. */
  n: number
  total: number
}
interface CountContext {
  name: string
  has: (symbol: string) => boolean
}
const COUNT_CONTEXTS: CountContext[] = [
  { name: 'hydrogen atoms', has: (s) => s === 'H' },
  { name: 'oxygen atoms', has: (s) => s === 'O' },
  { name: 'atoms of other elements', has: (s) => s !== 'H' && s !== 'O' },
]
/** The subscripts printed in a formula. */
const subscripts = (formula: string) => (formula.match(/\d+/g) ?? []).map(Number)

/**
 * Every multiplier and element a context allows. The subscript is at least 2 (multiplying by
 * 1 is no step), the multiplier is 2 to 8 as balanced equations have them (2C8H18 burns in
 * 25O2), the count stays at 48 or under, and the
 * multiplier is none of the formula's own subscripts (4H2SO4 would leave a student choosing
 * between two 4s). 2 × 2 is 2 + 2, so a student who added would be marked right: never both 2.
 */
function allCounts(c: CountContext): Count[] {
  const out: Count[] = []
  for (const formula of COUNT_FORMULAE) {
    for (const p of parse(formula)) {
      // A count of 10 (C4H10's hydrogens) would make the step a times-ten.
      if (!('symbol' in p) || p.n < 2 || p.n === 10 || !c.has(p.symbol)) continue
      for (const k of range(2, 8)) {
        if (subscripts(formula).includes(k) || (k === 2 && p.n === 2) || k * p.n > 48) continue
        out.push({ formula, symbol: p.symbol, k, n: p.n, total: k * p.n })
      }
    }
  }
  return out
}

const COUNT_PROMPTS = [
  (el: string, f: string) => `How many ${el} atoms are there in ${f}?`,
  (el: string, f: string) => `A balanced equation contains ${f}. How many ${el} atoms does ${f} stand for?`,
  (el: string, f: string) => `How many atoms of ${el} are shown by ${f}?`,
]

/** Multiplier × subscript: written as q2 (2H2O, 4 hydrogen atoms, 2 marks). */
export const atomsInAFormula: Generator = {
  id: 'atoms-in-a-formula',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q2'],
  build(r, slot, turn) {
    const ctx = COUNT_CONTEXTS[turn % COUNT_CONTEXTS.length]!
    const { formula, symbol, k, n, total } = evenly(r, `atoms-in-a-formula:${ctx.name}`, () => allCounts(ctx), (c) => c.total)
    const el = elementName(symbol)
    const written = `${k}${formula}`
    const prompt = pick(r, COUNT_PROMPTS)(el, written)
    // Second route: write the formula out k times and count every atom of the element.
    const counted = atoms(formula.repeat(k))[symbol]
    return numeric(
      slot,
      {
        prompt,
        solution: `The subscript gives ${n} ${el} atoms in each ${formula}, and the multiplier gives ${k} of them: $${k} \\times ${n} = ${total}$.`,
        method: [`multiplies the subscript ${n} by the multiplier ${k}`],
        answer: total,
      },
      { agrees: counted === total, detail: `${formula} written ${k} times holds ${counted} ${symbol}` },
      { context: ctx.name, formula, symbol, k, n },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Relative formula mass
// ---------------------------------------------------------------------------------------------

type MrKind = 'two' | 'three' | 'brackets'
interface Family {
  name: string
  formulae: string[]
}
/**
 * The compounds each kind of written slot asks about: two elements, one of them more than
 * once (q3, H2O); three elements without brackets (q5, CaCO3; q10, H2SO4); one bracket with
 * a subscript (q6, Mg(OH)2). The family is the context that rotates.
 */
const MR_FAMILIES: Record<MrKind, Family[]> = {
  two: [
    { name: 'small molecules', formulae: ['H2O', 'CO2', 'NH3', 'CH4', 'SO2', 'SO3', 'NO2', 'H2S'] },
    { name: 'hydrocarbons', formulae: ['C2H6', 'C3H8', 'C4H10', 'C5H12', 'C8H18', 'C2H4', 'C3H6'] },
    { name: 'giant structures', formulae: ['MgCl2', 'CaCl2', 'CuCl2', 'ZnCl2', 'FeCl3', 'AlCl3', 'Na2O', 'Li2O', 'Al2O3', 'Fe2O3', 'CaF2', 'SiO2'] },
  ],
  three: [
    { name: 'carbonates', formulae: ['CaCO3', 'Na2CO3', 'MgCO3', 'CuCO3', 'ZnCO3', 'Li2CO3', 'K2CO3', 'BaCO3', 'FeCO3'] },
    { name: 'sulfates', formulae: ['CuSO4', 'K2SO4', 'MgSO4', 'ZnSO4', 'Na2SO4', 'FeSO4', 'BaSO4'] },
    { name: 'acids and other compounds', formulae: ['H2SO4', 'HNO3', 'H3PO4', 'KNO3', 'AgNO3', 'NH4Cl', 'C6H12O6', 'KMnO4'] },
  ],
  brackets: [
    { name: 'hydroxides', formulae: ['Mg(OH)2', 'Ca(OH)2', 'Al(OH)3', 'Fe(OH)2', 'Fe(OH)3', 'Cu(OH)2', 'Zn(OH)2', 'Ba(OH)2'] },
    { name: 'nitrates', formulae: ['Ca(NO3)2', 'Mg(NO3)2', 'Cu(NO3)2', 'Zn(NO3)2', 'Pb(NO3)2', 'Ba(NO3)2', 'Fe(NO3)3', 'Al(NO3)3'] },
    { name: 'sulfates, phosphates and carbonates', formulae: ['Al2(SO4)3', 'Fe2(SO4)3', '(NH4)2SO4', '(NH4)3PO4', '(NH4)2CO3', 'Ca3(PO4)2', 'Mg3(PO4)2'] },
  ],
}
/** Which kind of compound each written slot asks about. */
const MR_SLOTS: Record<string, MrKind> = { q3: 'two', q5: 'three', q10: 'three', q6: 'brackets' }

/** The elements printed outside the bracket with their counts, in order: Mg 1 for Mg(OH)2; S 1 and O 4 for (NH4)2SO4. */
const outside = (formula: string) => parse(formula).flatMap((p) => ('symbol' in p ? [p] : []))
/** "40 for the calcium", "$2 \times 27$ for the aluminium". */
const adds = (formula: string) =>
  list(outside(formula).map((p) => `${p.n === 1 ? show(AR[p.symbol]!) : `$${p.n} \\times ${show(AR[p.symbol]!)}$`} for the ${elementName(p.symbol)}`))
/** The subscript on the one bracket: 2 for Mg(OH)2. */
function bracket(formula: string): number {
  const groups = parse(formula).filter((p) => !('symbol' in p))
  if (groups.length !== 1) throw new Error(`${formula} needs exactly one bracket`)
  return groups[0]!.n
}
/** "magnesium", "sulfur and oxygen", "calcium, carbon and oxygen". */
const list = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)

/** The shape each kind's formulae must have, checked when the module loads. */
function shapeOk(kind: MrKind, formula: string): boolean {
  const parts = parse(formula)
  const symbols = parts.flatMap((p) => ('symbol' in p ? [p.symbol] : []))
  const once = new Set(symbols).size === symbols.length
  if (kind === 'brackets') return parts.filter((p) => !('symbol' in p) && p.n >= 2).length === 1 && parts.every((p) => 'symbol' in p || p.group.every((q) => 'symbol' in q))
  const plain = parts.every((p) => 'symbol' in p) && once && parts.some((p) => p.n >= 2)
  return plain && parts.length === (kind === 'two' ? 2 : 3)
}
for (const [kind, families] of Object.entries(MR_FAMILIES) as [MrKind, Family[]][]) {
  for (const f of families.flatMap((x) => x.formulae)) {
    if (!shapeOk(kind, f)) throw new Error(`${f} is not a ${kind} formula`)
    factual(f)
  }
}

const MR_PROMPTS = [
  (f: string, _c: Named, ar: string) => `Calculate the relative formula mass of ${f}. ${ar}`,
  (f: string, c: Named, ar: string) => `Calculate the relative formula mass of ${c.name}, ${f}. ${ar}`,
  (f: string, c: Named, ar: string) => `${cap(c.name)} has the formula ${f}. Calculate its relative formula mass. ${ar}`,
  (f: string, _c: Named, ar: string) => `What is the relative formula mass (Mr) of ${f}? ${ar}`,
  (f: string, c: Named, ar: string) => `${cap(c.name)}, ${f}, ${c.fact}. Calculate its relative formula mass. ${ar}`,
  (f: string, c: Named, ar: string) => `${cap(c.name)}, ${f}, ${c.fact}. What is its relative formula mass? ${ar}`,
  (f: string, _c: Named, ar: string) => `Work out the relative formula mass of ${f}. ${ar}`,
]

/** What each element of a bracket-free formula weighs in it: CaCO3 is "40 + 12 + 48". */
const products = (formula: string) => parse(formula).map((p) => ('symbol' in p ? show(p.n * AR[p.symbol]!) : '?'))

function mrDraft(kind: MrKind, formula: string): { solution: string; method: string[] } {
  const M = mr(formula)
  if (kind === 'two') {
    const counted = parse(formula).flatMap((p) => ('symbol' in p && p.n > 1 ? [`${word(p.n)} ${elementName(p.symbol)} atoms`] : []))
    return { solution: ends(mrWorking(formula), M), method: [`counts ${list(counted)}`] }
  }
  if (kind === 'three') {
    const times = parse(formula).flatMap((p) => ('symbol' in p && p.n > 1 ? [`${elementName(p.symbol)} by ${word(p.n)}`] : []))
    return {
      solution: ends(`${mrWorking(formula)} = ${products(formula).join(' + ')}`, M),
      method: [`multiplies ${list(times)}`, 'adds all three elements'],
    }
  }
  const k = bracket(formula)
  const wrongFormula = formula.replace(/\)\d+/, ')')
  const wrong = mr(wrongFormula)
  return {
    solution: `The subscript applies to everything in the brackets: ${ends(mrWorking(formula), M).slice(0, -1)}. Reading it as $${mrWorking(wrongFormula)} = ${show(wrong)}$ is the commonest error.`,
    method: [`applies the subscript ${k} to everything in the brackets`, `adds ${adds(formula)}`],
  }
}

/**
 * Relative formula mass from the formula and the Ars: written as q3 (H2O, 2 marks), q5
 * (CaCO3, 3 marks), q6 (Mg(OH)2, 3 marks) and q10 (H2SO4, 3 marks). Each slot keeps its kind
 * of compound and its mark scheme's steps; the Ar sentence lists the elements in the order
 * the formula uses them, as the written prompts do.
 */
export const relativeFormulaMass: Generator = {
  id: 'relative-formula-mass',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q3', 'q5', 'q6', 'q10'],
  build(r, slot, turn) {
    const kind = MR_SLOTS[slot.id]
    if (!kind) throw new Error(`relative-formula-mass has no kind for ${slot.id}`)
    const families = MR_FAMILIES[kind]
    const family = families[turn % families.length]!
    const formula = pick(r, family.formulae)
    const compound = factual(formula)
    const template = Math.floor(r() * MR_PROMPTS.length)
    const prompt = MR_PROMPTS[template]!(formula, compound, arLine(formula))
    const M = mr(formula)
    const { solution, method } = mrDraft(kind, formula)
    const second = mrByAtoms(formula)
    return numeric(
      slot,
      { prompt, solution, method, answer: M, tolerance: dpTolerance(M) },
      { agrees: second === M, detail: `atoms counted out: ${JSON.stringify(atoms(formula))} weigh ${second}` },
      { context: family.name, formula, template },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Percentage by mass
// ---------------------------------------------------------------------------------------------

interface Share {
  formula: string
  symbol: string
  /** Atoms of the element in the formula, brackets multiplied out. */
  n: number
  /** n × Ar. */
  mass: number
  M: number
  exact: number
  answer: number
}
const share = (formula: string, symbol: string): Share => {
  const n = atoms(formula)[symbol]!
  const mass = clean(n * AR[symbol]!)
  const M = mr(formula)
  const exact = (100 * mass) / M
  return { formula, symbol, n, mass, M, exact, answer: clean(roundTo(exact, 1)) }
}
/** Every element of every formula, as shares. */
const sharesOf = (formulae: string[]) => formulae.flatMap((f) => Object.keys(atoms(f)).map((s) => share(f, s)))
/**
 * The percentage is none of the figures printed or worked on the way (each Ar, the element's
 * mass, the Mr), nor one with the point moved, doubled or halved: CaCO3's 40% calcium is the
 * Ar of calcium, because its Mr is 100.
 */
const pctClear = (s: Share) => clearOf(s.answer, s.mass, s.M, ...Object.keys(atoms(s.formula)).map((x) => AR[x]!))

/**
 * Compounds whose percentages come out exact to at most one decimal place, for q8 (CaCO3's
 * 40% calcium, no rounding in the written answer). A share under 5% is left out: the answer
 * box's tolerance would be most of it. So is 50%, which a student guessing "half" reaches.
 */
const EXACT_FAMILIES: Family[] = [
  { name: 'metal compounds', formulae: ['MgO', 'Fe2O3', 'TiO2', 'NaOH', 'MgSO4', 'Fe2(SO4)3', 'ZnCO3', 'Cu(NO3)2', 'Li3N', 'CaC2'] },
  { name: 'non-metal compounds', formulae: ['CH4', 'C2H6', 'C6H12O6', 'CH3OH', 'CH3COOH', 'SiC', 'NH4NO3', 'HF', 'N2H4', 'SO3'] },
]
const exactShares = (family: Family) =>
  sharesOf(family.formulae).filter((s) => Math.abs(s.exact - s.answer) < 1e-9 && s.answer >= 5 && s.answer <= 95 && s.answer !== 50 && pctClear(s))

/** Where q16's percentage of an element is read: fertilisers, ores, and compounds where fewer atoms carry more mass. */
interface RoundedFamily extends Family {
  /** Which elements of the formulae the family asks about. */
  asks: (s: Share) => boolean
}
/**
 * The element has fewer atoms than another element of the compound, yet more of its mass:
 * NH3's one nitrogen weighs 14 against its three hydrogens' 3.
 */
function outweighs(s: Share): string | undefined {
  const counts = atoms(s.formula)
  const other = Object.entries(counts).find(([x, n]) => x !== s.symbol && n > s.n && n * AR[x]! < s.mass)
  if (!other) return undefined
  const [x, n] = other
  const one = s.n === 1 ? `one ${elementName(s.symbol)}` : `${word(s.n)} ${elementName(s.symbol)} atoms`
  return `${cap(word(n))} ${elementName(x)} atoms against ${one}, yet the ${elementName(s.symbol)} weighs more: ${show(s.mass)} against ${show(n * AR[x]!)}.`
}
const ROUNDED_FAMILIES: RoundedFamily[] = [
  {
    name: 'fertilisers',
    formulae: ['NH3', 'NH4Cl', '(NH4)2SO4', 'KNO3', 'Ca(NO3)2', 'CO(NH2)2', '(NH4)3PO4', 'K2SO4', 'KCl'],
    asks: (s) => ['N', 'P', 'K'].includes(s.symbol),
  },
  {
    name: 'ores',
    formulae: ['Fe3O4', 'FeCO3', 'Cu2S', 'CuFeS2', 'ZnS', 'PbS', 'Cu2O', 'SnO2', 'MnO2'],
    asks: (s) => !['C', 'O', 'S'].includes(s.symbol),
  },
  {
    name: 'fewer atoms, more mass',
    formulae: ['H2O', 'H2S', 'C3H8', 'C4H10', 'C2H4', 'C3H6', 'C5H12', 'C8H18', 'CaF2', 'C2H5OH', 'PH3', 'NH4Cl', 'NH3', 'Al2O3'],
    asks: (s) => outweighs(s) !== undefined,
  },
]
/**
 * Shares that need rounding to one decimal place, clear of a half-way case, and that do not
 * round to a whole number (82.0 would be marked as 82 and the answer box drops the 0).
 */
const roundedShares = (family: RoundedFamily) =>
  sharesOf(family.formulae).filter(
    (s) =>
      family.asks(s) &&
      Math.abs(s.exact * 10 - Math.round(s.exact * 10)) > 1e-6 &&
      clearOfHalf(s.exact, 1) &&
      !Number.isInteger(s.answer) &&
      s.answer >= 10 &&
      s.answer <= 95 &&
      pctClear(s),
  )

for (const f of [...EXACT_FAMILIES, ...ROUNDED_FAMILIES].flatMap((x) => x.formulae)) if (!ORES[f]) factual(f)
for (const f of ROUNDED_FAMILIES.find((x) => x.name === 'ores')!.formulae) if (!ORES[f]) throw new Error(`No mineral for ${f}`)

const PCT_PROMPTS = [
  (el: string, f: string, _c: Named, ar: string) => `Calculate the percentage by mass of ${el} in ${f}. ${ar}`,
  (el: string, f: string, _c: Named, ar: string) => `What percentage of the mass of ${f} is ${el}? ${ar}`,
  (el: string, f: string, c: Named, ar: string) => `${cap(c.name)}, ${f}, ${c.fact}. Calculate the percentage by mass of ${el} in ${c.name}. ${ar}`,
  (el: string, f: string, c: Named, ar: string) => `Calculate the percentage by mass of ${el} in ${c.name}, ${f}. ${ar}`,
]
/** For an ore the name is the mineral's: "Galena is a lead ore. It is mostly PbS." */
const ORE_PROMPTS = [
  (el: string, f: string, c: Named, ar: string) => `${cap(c.name)} ${c.fact}, made mostly of ${f}. Calculate the percentage by mass of ${el} in ${f}. ${ar}`,
  (el: string, f: string, c: Named, ar: string) => `Calculate the percentage by mass of ${el} in ${f}, the main compound in the ore ${c.name}. ${ar}`,
  (el: string, f: string, _c: Named, ar: string) => `What percentage of the mass of ${f} is ${el}? ${ar}`,
]

/** "there is one calcium of mass 40" or "the two iron atoms have mass $2 \times 56 = 112$". */
const massOf = (s: Share) =>
  s.n === 1
    ? `there is one ${elementName(s.symbol)} of mass ${show(s.mass)}`
    : `the ${word(s.n)} ${elementName(s.symbol)} atoms have mass $${s.n} \\times ${show(AR[s.symbol]!)} = ${show(s.mass)}$`

/** Second route: 100 less every other element's percentage. */
const byDifference = (s: Share) => 100 - Object.keys(atoms(s.formula)).filter((x) => x !== s.symbol).reduce((t, x) => t + share(s.formula, x).exact, 0)

function percentage(id: string, slotId: string, rounded: boolean): Generator {
  const families: Family[] = rounded ? ROUNDED_FAMILIES : EXACT_FAMILIES
  return {
    id,
    subjectId: 'chemistry',
    topicId: TOPIC,
    replaces: [slotId],
    build(r, slot, turn) {
      const family = families[turn % families.length]!
      const s = evenly(r, `${id}:${family.name}`, () => (rounded ? roundedShares(family as RoundedFamily) : exactShares(family)), (x) => x.answer)
      const ore = family.name === 'ores'
      const compound = ore ? ORES[s.formula]! : factual(s.formula)
      const el = elementName(s.symbol)
      const prompts = ore ? ORE_PROMPTS : PCT_PROMPTS
      const template = Math.floor(r() * prompts.length)
      const precision = rounded ? ' Give your answer to 1 decimal place.' : ''
      const prompt = prompts[template]!(el, s.formula, compound, arLine(s.formula)) + precision
      const working = atomsWorking(s.formula)
      const fraction = `\\dfrac{${show(s.mass)}}{${show(s.M)}} \\times 100`
      const solution = rounded
        ? `$M_r = ${working} = ${show(s.M)}$, and ${massOf(s)}, so $${fraction} = ${fixed(s.exact, 3)}\\ldots$, which is ${show(s.answer)}% to 1 decimal place.${outweighs(s) ? ` ${outweighs(s)}` : ''}`
        : `$M_r = ${working} = ${show(s.M)}$, and ${massOf(s)}, so $${fraction} = ${show(s.answer)}\\%$.`
      const method = rounded
        ? [`finds the $M_r$ as ${show(s.M)}`, `divides ${show(s.mass)} by ${show(s.M)}`]
        : [`finds the $M_r$: $${working} = ${show(s.M)}$`, `divides the ${el} mass, ${show(s.mass)}, by the $M_r$`]
      const second = byDifference(s)
      return numeric(
        slot,
        { prompt, solution, method, answer: s.answer, tolerance: dpTolerance(s.answer), units: '%' },
        { agrees: Math.abs(second - s.exact) < 1e-9 && Math.abs(second - s.answer) < 0.05 + 1e-9, detail: `100 less the other elements: ${show(roundTo(second, 6))}%` },
        { context: family.name, formula: s.formula, symbol: s.symbol, template },
      )
    },
  }
}

/** % by mass with no rounding: written as q8 (calcium in CaCO3, 40%). */
export const percentageByMass = percentage('percentage-by-mass', 'q8', false)
/** % by mass to 1 decimal place: written as q16 (nitrogen in NH3, 82.4%). */
export const percentageByMassRounded = percentage('percentage-by-mass-rounded', 'q16', true)

export const formulaGenerators: Generator[] = [atomsInAFormula, relativeFormulaMass, percentageByMass, percentageByMassRounded]

/** For tests: the pools each generator draws from. */
export const FORMULAE_POOLS = {
  countContexts: COUNT_CONTEXTS.map((c) => c.name),
  allCounts: (name: string) => allCounts(COUNT_CONTEXTS.find((c) => c.name === name)!),
  mrFamilies: MR_FAMILIES,
  mrSlots: MR_SLOTS,
  exact: () => EXACT_FAMILIES.map((f) => ({ name: f.name, shares: exactShares(f) })),
  rounded: () => ROUNDED_FAMILIES.map((f) => ({ name: f.name, shares: roundedShares(f) })),
  outweighs: (formula: string, symbol: string) => outweighs(share(formula, symbol)),
}
