import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { fixed, show } from '../format.ts'
import { sfTolerance, sigFigs } from '../physics/format.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { atoms, mr } from './build.ts'
import { nameOf } from './compounds.ts'
import { GAS_POOLS } from './gases.ts'

/**
 * Structural tests for the gas volume generators. The release check proves each answer agrees
 * with a second route; these read the prompt's own figures, formulae and equation back, work
 * the answer from them, check every printed step of the working, that every equation printed
 * balances, that the molar volume is never stated (no written slot states it), and look across
 * a run of builds for a context that never rotates or one value carrying a slot.
 */
const TOPIC = 'gas-volumes'
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/chemistry')
const bank = Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  expect(g.topicId).toBe(TOPIC)
  expect(g.replaces).toEqual([slotId])
  const slot = bank.find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `structure-${i}`))
}

const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const units = (b: Generated) => (b.question.type === 'numeric' ? b.question.units : 'not numeric')
const method = (b: Generated) => b.question.markScheme.slice(0, -1).map((l) => l.description)
const codes = (b: Generated) => b.question.markScheme.map((l) => l.code)
const last = (b: Generated) => b.question.markScheme.at(-1)!.description
const values = (b: Generated) => b.values as Record<string, any>
const clean = (x: number) => Number(x.toPrecision(12))
const places = (x: number) => (show(x).includes('.') ? show(x).split('.')[1]!.length : 0)
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context))
const tenfold = (a: number, b: number) => Math.abs(Math.log10(Math.abs(a / b)) - Math.round(Math.log10(Math.abs(a / b)))) < 1e-9
const powerOfTen = (x: number) => tenfold(x, 1)
/** Neither a given, nor one with the point moved, doubled or halved. */
const clearOf = (x: number, ...givens: number[]) => givens.every((g) => !tenfold(x, g) && clean(x) !== clean(2 * g) && clean(2 * x) !== clean(g))
const share = (xs: unknown[]) => {
  const counts = new Map<unknown, number>()
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1)
  return Math.max(...counts.values()) / xs.length
}
/** A formula printed with Unicode subscripts, back to plain digits: CO₂ is CO2. */
const plain = (s: string) => s.replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080))
const num = (s: string | undefined) => Number(s)

/** Every build: no "a 8 g", the written slot's units (none), the answer as the last mark line, and no molar volume given. */
function common(b: Generated) {
  expect(b.question.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
  expect(units(b)).toBeUndefined()
  expect(last(b)).toBe(show(answer(b)))
  expect(b.question.prompt, b.seed).not.toMatch(/(?<![\d.])24 dm|(?<![\d.])24 ?000|24\\,000|molar volume|occupies 24/)
  expect(b.question.solution).toContain(String(answer(b)))
}
/** Many answers in every context, none carrying it. */
function spread(built: Generated[], expected: number, least = 10, most = 0.1) {
  expect(contexts(built).size).toBe(expected)
  for (const name of contexts(built)) {
    const mine = built.filter((b) => b.values.context === name)
    expect(new Set(mine.map(answer)).size, String(name)).toBeGreaterThanOrEqual(least)
    expect(share(mine.map(answer)), String(name)).toBeLessThanOrEqual(most)
  }
}

/** The equation a prompt prints, read back to plain text: "C3H8 + 5O2 -> 3CO2 + 4H2O". */
function printedEquation(text: string): string {
  const term = '\\d*[A-Z][A-Za-z₀-₉()]*'
  const m = new RegExp(`(${term}(?: \\+ ${term})* → ${term}(?: \\+ ${term})*)`).exec(text)
  expect(m, text).not.toBeNull()
  return plain(m![1]!.replace(/\(g\)/g, '')).replace(' → ', ' -> ')
}
/** The atoms on each side, each formula multiplied by its balancing number. */
function sides(eq: string) {
  const side = (s: string) => {
    const out: Record<string, number> = {}
    const terms: { n: number; f: string }[] = []
    for (const t of s.split(' + ')) {
      const m = /^(\d*)(\S+)$/.exec(t.trim())!
      const n = Number(m[1] || 1)
      terms.push({ n, f: m[2]! })
      for (const [el, k] of Object.entries(atoms(m[2]!))) out[el] = (out[el] ?? 0) + k * n
    }
    return { out, terms }
  }
  const [l, r] = eq.split(' -> ')
  return { left: side(l!), right: side(r!) }
}
function balanced(eq: string): boolean {
  const { left, right } = sides(eq)
  return JSON.stringify(Object.entries(left.out).sort()) === JSON.stringify(Object.entries(right.out).sort())
}
/** The balancing number of a formula in a plain equation. */
function coefIn(eq: string, f: string): number {
  const { left, right } = sides(eq)
  const t = [...left.terms, ...right.terms].find((x) => x.f === f)
  expect(t, `${f} in ${eq}`).toBeDefined()
  return t!.n
}
/** The equations a solution prints in maths, read back to plain text. */
const solutionEquations = (s: string) =>
  (s.match(/\$[^$]*\\rightarrow[^$]*\$/g) ?? []).map((e) =>
    e
      .slice(1, -1)
      .replace(/\\mathrm\{([^}]*)\}/g, (_, f: string) => f.replace(/_\{?(\d+)\}?/g, '$1'))
      .replace(' \\rightarrow ', ' -> '),
  )
/** Gases at 20 °C: no NO2 (boils at 21 °C), no SO3, no water. */
const GASES = new Set(['H2', 'O2', 'N2', 'Cl2', 'CO2', 'CH4', 'NH3', 'SO2', 'C2H6', 'C3H8', 'C4H10', 'H2S', 'He', 'Ne', 'Ar'])

describe('moles and volumes in dm³', () => {
  it('multiplies the moles of a real gas by 24', () => {
    const built = build('gas-volume-from-moles', 'q2', 600)
    for (const b of built) {
      common(b)
      const m = /([\d.]+) moles/.exec(b.question.prompt)!
      const n = num(m[1])
      const f = values(b).formula as string
      expect(GASES.has(f)).toBe(true)
      expect(b.question.prompt).toContain(` of ${GAS_POOLS.called(f)}`)
      expect(b.question.prompt).toContain('at RTP')
      expect(powerOfTen(n)).toBe(false)
      const V = clean(n * 24)
      expect(answer(b)).toBe(V)
      expect(b.question.solution).toBe(`$${show(n)} \\times 24 = $ **${show(V)} dm³**.`)
      expect(codes(b)).toEqual(['B1'])
      expect(tolerance(b)).toBe(GAS_POOLS.room(V, Math.max(places(V), places(n))))
    }
    spread(built, 3, 10, 0.05)
  })

  it('divides a volume in dm³ by 24 for an exact amount', () => {
    const built = build('gas-moles-from-volume', 'q4', 600)
    for (const b of built) {
      common(b)
      const V = num(/([\d.]+) dm³/.exec(b.question.prompt)![1])
      const n = clean(V / 24)
      expect(answer(b)).toBe(n)
      expect(places(n)).toBeLessThanOrEqual(3)
      expect(powerOfTen(n)).toBe(false)
      expect(clearOf(n, V)).toBe(true)
      expect(b.question.prompt).toContain('at RTP')
      expect(b.question.solution).toBe(`$\\dfrac{${show(V)}}{24} = ${show(n)}$ mol.`)
      if (b.values.context === 'party balloon') {
        expect(b.question.prompt).toContain('helium')
        expect(V >= 3 && V <= 15).toBe(true)
      } else expect(V >= 1.2 && V <= 96).toBe(true)
      if (values(b).gas !== 'gas') expect(GASES.has(values(b).gas)).toBe(true)
      expect(tolerance(b)).toBe(GAS_POOLS.room(n, Math.max(places(n), places(V))))
    }
    spread(built, 3, 10, 0.1)
  })
})

describe('masses and volumes, through moles', () => {
  /** "(Mr of CO₂ = 44)" read back, checked against the formula. */
  function mrOf(prompt: string) {
    const m = /\(Mr of (\S+) = ([\d.]+)\)$/.exec(prompt)
    expect(m, prompt).not.toBeNull()
    const f = plain(m![1]!)
    expect(num(m![2])).toBe(mr(f))
    expect(GASES.has(f), f).toBe(true)
    expect(prompt).toContain(` of ${nameOf(f)}`)
    return { f, M: mr(f) }
  }

  it('divides the mass by the Mr, then multiplies by 24', () => {
    const built = build('gas-volume-from-mass', 'q5', 900)
    for (const b of built) {
      common(b)
      const { f, M } = mrOf(b.question.prompt)
      expect(f).toBe(values(b).formula)
      const m = num(/([\d.]+) g\b/.exec(b.question.prompt)![1])
      const n = clean(m / M)
      expect(places(n)).toBeLessThanOrEqual(2)
      expect(powerOfTen(n)).toBe(false)
      const V = clean(n * 24)
      expect(answer(b)).toBe(V)
      expect(clearOf(V, m, M, n)).toBe(true)
      for (const x of [m + M, m - M, M - m]) expect(clean(x)).not.toBe(V)
      expect(m >= 0.5 && m <= 100).toBe(true)
      expect(b.question.solution).toBe(`Moles $= \\dfrac{${show(m)}}{${show(M)}} = ${show(n)}$; volume $= ${show(n)} \\times 24 = $ **${show(V)} dm³**.`)
      expect(method(b)).toEqual([`${show(n)} mol`])
      expect(codes(b)).toEqual(['M1', 'A1'])
      expect(tolerance(b)).toBe(GAS_POOLS.room(V, Math.max(places(V), places(m))))
    }
    // The substance is drawn first, then its amount evenly: the largest volumes come only from
    // the lightest carbonates under 15 g, so a context's answers are not quite even.
    spread(built, 3, 10, 0.15)
    for (const name of contexts(built)) expect(share(built.filter((b) => b.values.context === name).map((b) => b.values.formula)), String(name)).toBeLessThanOrEqual(0.6)
    for (const name of contexts(built)) expect(share(built.filter((b) => b.values.context === name).map((b) => b.values.formula)), String(name)).toBeLessThanOrEqual(0.45)
  })

  it('divides the volume by 24, then multiplies by the Mr', () => {
    const built = build('gas-mass-from-volume', 'q7', 900)
    for (const b of built) {
      common(b)
      const { M } = mrOf(b.question.prompt)
      const V = num(/([\d.]+) dm³/.exec(b.question.prompt)![1])
      const n = clean(V / 24)
      expect(places(n)).toBeLessThanOrEqual(2)
      expect(powerOfTen(n)).toBe(false)
      const m = clean(n * M)
      expect(answer(b)).toBe(m)
      expect(clearOf(m, V, M, n)).toBe(true)
      for (const x of [V + M, V - M, M - V]) expect(clean(x)).not.toBe(m)
      expect(tenfold(V, M)).toBe(false)
      expect(b.question.solution).toBe(`Moles $= \\dfrac{${show(V)}}{24} = ${show(n)}$; mass $= ${show(n)} \\times ${show(M)} = $ **${show(m)} g**.`)
      expect(method(b)).toEqual([`${show(n)} mol`])
      expect(tolerance(b)).toBe(GAS_POOLS.room(m, Math.max(places(m), places(V))))
    }
    spread(built, 3, 10, 0.1)
  })
})

describe('volumes in cm³', () => {
  it('divides by 24 000 cm³ per mole, and prints the conversion as the method mark', () => {
    const built = build('gas-moles-from-cm3', 'q8', 600)
    for (const b of built) {
      common(b)
      const V = num(/(\d+) cm³/.exec(b.question.prompt)![1])
      const n = clean(V / 24000)
      expect(answer(b)).toBe(n)
      expect(powerOfTen(n)).toBe(false)
      expect(clearOf(n, V)).toBe(true)
      expect(b.question.prompt).toContain('at RTP')
      const gas = /moles of ([a-z ]+?) (?:are|does)/.exec(b.question.prompt)![1]!
      expect(b.question.prompt).toContain(`${V} cm³ of ${gas} at RTP`)
      const room = { 'gas syringe': [30, 100], 'measuring cylinder': [60, 250], 'gas jar': [250, 504] }[values(b).context as string]!
      expect(V >= room[0]! && V <= room[1]!, `${b.seed} ${V}`).toBe(true)
      expect(b.question.prompt).toContain(values(b).context)
      // The gas each reaction really gives.
      if (b.question.prompt.includes('Magnesium') || b.question.prompt.includes('Zinc')) expect(gas).toBe('hydrogen')
      if (b.question.prompt.includes('Marble')) expect(gas).toBe('carbon dioxide')
      if (b.question.prompt.includes('peroxide')) expect(gas).toBe('oxygen')
      expect(b.question.solution).toBe(`One mole of gas occupies $24\\text{ dm}^3 = 24\\,000\\text{ cm}^3$ at RTP, so $\\dfrac{${V}}{24\\,000} = ${show(n)}$ mol.`)
      expect(method(b)).toEqual(['uses 24 000 cm³ per mole'])
      expect(tolerance(b)).toBe(GAS_POOLS.room(n, places(n)))
    }
    for (const name of contexts(built)) {
      const mine = built.filter((b) => b.values.context === name)
      expect(new Set(mine.map(answer)).size, String(name)).toBeGreaterThanOrEqual(10)
      expect(share(mine.map(answer)), String(name)).toBeLessThanOrEqual(0.12)
    }
    expect(contexts(built).size).toBe(3)
  })
})

describe('a mass of reactant to a volume of gas', () => {
  it('goes through moles and a 1 : 1 balanced equation of a reaction that really happens', () => {
    const built = build('gas-volume-from-reactant-mass', 'q10', 900)
    const heated = ['MgCO3', 'CuCO3', 'ZnCO3']
    for (const b of built) {
      common(b)
      const f = values(b).formula as string
      expect(['CaCO3', 'Mg']).not.toContain(f)
      const metal = ['Zn', 'Fe'].includes(f)
      expect(b.question.prompt).toMatch(new RegExp(`\\((?:${metal ? 'Ar' : 'Mr'}) of ${f.replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]!)} = ${mr(f)}\\)$`))
      const m = num(/([\d.]+) g of/.exec(b.question.prompt)![1])
      expect(b.question.prompt).toContain(`${show(m)} g of ${nameOf(f)}`)
      const gas = metal ? 'H2' : 'CO2'
      expect(b.question.prompt).toContain(`What volume of ${nameOf(gas)}, in dm³ at RTP, is produced?`)
      if (heated.includes(f)) expect(b.question.prompt).toMatch(/heat/)
      else expect(b.question.prompt).toMatch(/excess dilute (hydrochloric|sulfuric) acid/)
      const [eq] = solutionEquations(b.question.solution)
      expect(balanced(eq!), eq).toBe(true)
      expect(coefIn(eq!, f)).toBe(1)
      expect(coefIn(eq!, gas)).toBe(1)
      if (heated.includes(f)) expect(eq).toBe(`${f} -> ${f.replace('CO3', 'O')} + CO2`)
      const n = clean(m / mr(f))
      expect(powerOfTen(n)).toBe(false)
      const V = clean(n * 24)
      expect(answer(b)).toBe(V)
      expect(clearOf(V, m, mr(f), n)).toBe(true)
      expect(b.question.solution).toContain(`\\dfrac{${show(m)}}{${show(mr(f))}} = ${show(n)}$; ratio $1:1$, so $${show(n)}\\text{ mol}$`)
      expect(b.question.solution).toContain(`volume $= ${show(n)} \\times 24 = $ **${show(V)} dm³**.`)
      expect(method(b)).toEqual([`${show(n)} mol of ${nameOf(f)}`, 'uses the 1 : 1 ratio'])
      expect(tolerance(b)).toBe(GAS_POOLS.room(V, Math.max(places(V), places(m))))
    }
    // The substance is drawn first, then its amount evenly: the largest volumes come only from
    // the lightest carbonates under 15 g, so a context's answers are not quite even.
    spread(built, 3, 10, 0.15)
    for (const name of contexts(built)) expect(share(built.filter((b) => b.values.context === name).map((b) => b.values.formula)), String(name)).toBeLessThanOrEqual(0.6)
  })
})

describe('volume ratios from an equation', () => {
  it('scales the given volume by the balancing numbers of a balanced equation, never 1 : 1', () => {
    const built = build('gas-volume-ratio', 'q6', 900)
    for (const b of built) {
      common(b)
      const eq = printedEquation(b.question.prompt)
      expect(balanced(eq), eq).toBe(true)
      const [g, a] = [values(b).given as string, values(b).asked as string]
      expect(GASES.has(g) && GASES.has(a)).toBe(true)
      const V = num(/(\d+) cm³ of/.exec(b.question.prompt)![1])
      expect(b.question.prompt).toContain(`${V} cm³ of ${nameOf(g)}`)
      expect(b.question.prompt).toContain(`volume of ${nameOf(a)}, in cm³`)
      const [kg, ka] = [coefIn(eq, g), coefIn(eq, a)]
      expect(kg).not.toBe(ka)
      const ans = (V * ka) / kg
      expect(Number.isInteger(ans)).toBe(true)
      expect(answer(b)).toBe(ans)
      expect(tenfold(ans, V)).toBe(false)
      expect(b.question.solution).toContain(`The ratio $\\mathrm{${g.replace(/(\d+)/g, '_$1')}} : \\mathrm{${a.replace(/(\d+)/g, '_$1')}}$ is $${kg} : ${ka}`)
      expect(b.question.solution).toContain(` = $ **${ans} cm³**.`)
      // Water is never asked for: it is a liquid at room conditions.
      expect(a).not.toBe('H2O')
      expect(codes(b)).toEqual(['B1'])
      expect(tolerance(b)).toBe(0)
    }
    spread(built, 5, 10, 0.1)
    for (const name of contexts(built)) expect(new Set(built.filter((b) => b.values.context === name).map((b) => `${b.values.given}>${b.values.asked}`)).size).toBeGreaterThanOrEqual(2)
  })

  it('every ratio equation balances', () => {
    for (const c of GAS_POOLS.RATIOS) expect(balanced(c.eq.text), c.name).toBe(true)
  })
})

describe('gas volume after an exact reaction', () => {
  it('adds the gaseous products, the oxygen used up, and never the volume before', () => {
    const built = build('gas-total-volume-after', 'q12', 800)
    for (const b of built) {
      common(b)
      const eq = printedEquation(b.question.prompt)
      expect(balanced(eq), eq).toBe(true)
      expect(b.question.prompt).toContain('H₂O(g)')
      expect(b.question.prompt).toMatch(/water (remains|to remain) a gas/)
      const fuelText = /(\d+) cm³ of ([a-z]+) (?:reacts|is burned)/.exec(b.question.prompt)!
      const [Vf, fuelName] = [num(fuelText[1]), fuelText[2]!]
      const Vo = num(/(\d+) cm³ of oxygen/.exec(b.question.prompt)![1])
      const fuel = { hydrogen: 'H2', propane: 'C3H8', ethane: 'C2H6', butane: 'C4H10' }[fuelName]!
      // Exactly in proportion: neither gas is left.
      expect(Vf * coefIn(eq, 'O2')).toBe(Vo * coefIn(eq, fuel))
      const k = Vf / coefIn(eq, fuel)
      const steam = k * coefIn(eq, 'H2O')
      const co2 = fuel === 'H2' ? 0 : k * coefIn(eq, 'CO2')
      expect(answer(b)).toBe(steam + co2)
      // Adding the volumes given is never right.
      expect(answer(b)).not.toBe(Vf + Vo)
      expect(clearOf(answer(b), Vo)).toBe(fuel === 'H2' ? false : true)
      if (fuel === 'H2') {
        expect(answer(b)).toBe(Vf)
        expect(method(b)).toEqual(['uses the 2 : 2 ratio for hydrogen to water', 'notes the oxygen is completely used'])
      } else {
        expect(b.question.solution).toContain(`gives $${co2}\\text{ cm}^3$ of carbon dioxide and $${steam}\\text{ cm}^3$ of steam`)
        expect(b.question.solution).toContain(`$${co2} + ${steam} = $ **${co2 + steam} cm³**.`)
        expect(method(b)).toEqual([`uses the ${coefIn(eq, fuel)} : ${coefIn(eq, 'CO2')} : ${coefIn(eq, 'H2O')} ratio for ${fuelName} to carbon dioxide and water`, 'notes the oxygen is completely used'])
      }
      expect(b.question.solution).toContain(`The oxygen ($${Vo}\\text{ cm}^3$) is fully used`)
    }
    spread(built, 4, 10, 0.1)
  })
})

describe('hydrogen in cm³ back to the metal', () => {
  it('works moles of hydrogen, the 1 : 1 ratio, then the Ar, for zinc or iron', () => {
    const built = build('gas-metal-mass-from-hydrogen', 'q14', 900)
    for (const b of built) {
      common(b)
      const eq = printedEquation(b.question.prompt)
      expect(balanced(eq), eq).toBe(true)
      const ar = /\(Ar of ([A-Z][a-z]?) = ([\d.]+)\)$/.exec(b.question.prompt)!
      const [f, Ar] = [ar[1]!, num(ar[2])]
      // Magnesium makes the mass the volume with the point moved; aluminium is not a 4.4.2.1 metal.
      expect(['Zn', 'Fe']).toContain(f)
      expect(b.question.prompt).toMatch(/H₂SO₄|2HCl/)
      expect(Ar).toBe(mr(f))
      expect(b.question.prompt).toMatch(new RegExp(`mass of (the )?${nameOf(f)}, in grams`))
      const V = num(/(\d+) cm³ of hydrogen/.exec(b.question.prompt)![1])
      expect(b.question.prompt).toMatch(V <= 100 ? /gas syringe/ : /measuring cylinder/)
      expect(V >= 36 && V <= 250).toBe(true)
      const [aM, aH] = [coefIn(eq, f), coefIn(eq, 'H2')]
      expect([aM, aH]).toEqual([1, 1])
      const nH = clean(V / 24000)
      const nM = clean((nH * aM) / aH)
      const m = clean(nM * Ar)
      expect(answer(b)).toBe(m)
      expect(places(m)).toBeLessThanOrEqual(4)
      expect(clearOf(m, V, Ar, nH, nM)).toBe(true)
      expect(b.question.solution).toContain(`Moles of $\\mathrm{H_2} = \\dfrac{${V}}{24\\,000} = ${show(nH)}$.`)
      expect(b.question.solution).toContain(`is $${aM}:${aH}$`)
      expect(b.question.solution).toContain(`Mass $= ${show(nM)} \\times ${show(Ar)} = $ **${show(m)} g**.`)
      expect(b.question.solution).toContain(`so $${show(nM)}\\text{ mol}$ of ${nameOf(f)}.`)
      expect(method(b)).toEqual([`moles of hydrogen = ${show(nH)}`, `uses the ${aM} : ${aH} ratio`, `multiplies by ${show(Ar)}`])
      expect(codes(b)).toEqual(['M1', 'M1', 'M1', 'A1'])
      expect(tolerance(b)).toBe(GAS_POOLS.room(m, places(m)))
    }
    spread(built, 2, 10, 0.1)
    for (const name of contexts(built)) expect(new Set(built.filter((b) => b.values.context === name).map((b) => b.values.equation)).size, String(name)).toBe(2)
  })
})

describe('the limiting gas', () => {
  it('divides by the balancing numbers, names the gas that runs out and scales it to the product', () => {
    const built = build('gas-limiting-volume', 'q16', 1200)
    for (const b of built) {
      common(b)
      const eq = printedEquation(b.question.prompt)
      expect(balanced(eq), eq).toBe(true)
      const m = /, (\d+) cm³ of ([a-z]+) is mixed with (\d+) cm³ of ([a-z]+)\./.exec(b.question.prompt)!
      const [V1, n1, V2, n2] = [num(m[1]), m[2]!, num(m[3]), m[4]!]
      const formula = (n: string) => ({ nitrogen: 'N2', hydrogen: 'H2', propane: 'C3H8', ethane: 'C2H6', oxygen: 'O2' })[n]!
      const [f1, f2] = [formula(n1), formula(n2)]
      const [a1, a2] = [coefIn(eq, f1), coefIn(eq, f2)]
      const product = f1 === 'N2' ? 'NH3' : 'CO2'
      const k = coefIn(eq, product)
      const [x1, x2] = [V1 / a1, V2 / a2]
      expect(places(x1)).toBeLessThanOrEqual(2)
      expect(places(x2)).toBeLessThanOrEqual(2)
      const [L, VL, aL, xL, xE] = x1 < x2 ? [n1, V1, a1, x1, x2] : [n2, V2, a2, x2, x1]
      // Never a near tie, never absurdly far.
      expect(xE >= 1.2 * xL - 1e-9 && xE <= 4 * xL).toBe(true)
      const p = (VL * k) / aL
      expect(answer(b)).toBe(p)
      expect(Number.isInteger(p)).toBe(true)
      expect(tenfold(p, V1) || tenfold(p, V2)).toBe(false)
      expect(p).not.toBe(Math.abs(V1 - V2))
      expect(p).not.toBe(V1 + V2)
      // A hydrocarbon short of oxygen burns incompletely, so only the fuel runs out.
      if (product === 'CO2') {
        expect(L).toBe(n1)
        expect(b.question.solution).toContain('The oxygen is in excess')
      }
      expect(b.question.solution).toContain(`${n1} $${V1} \\div ${a1} = ${show(x1)}$, ${n2} $${V2} \\div ${a2} = ${show(x2)}$`)
      expect(b.question.solution).toContain(`**${L[0]!.toUpperCase()}${L.slice(1)} is limiting.**`)
      expect(b.question.solution).toContain(` = $ **${p} cm³**.`)
      expect(method(b)).toEqual(['divides each volume by its balancing number', `identifies ${L} as limiting`])
      if (product === 'NH3') expect(b.question.solution).toContain('reversible')
    }
    spread(built, 3, 10, 0.1)
    // Ammonia on three turns in five; in it either gas runs out, hydrogen about four times in five.
    const ammonia = built.filter((b) => b.values.context === 'ammonia')
    expect(ammonia.length / built.length > 0.5 && ammonia.length / built.length < 0.7).toBe(true)
    const hydrogen = ammonia.filter((b) => b.values.limit === 'H2').length / ammonia.length
    expect(hydrogen > 0.7 && hydrogen < 0.9, `hydrogen runs out in ${hydrogen}`).toBe(true)
    for (const name of ['propane', 'ethane']) expect(new Set(built.filter((b) => b.values.context === name).map((b) => b.values.limit))).toEqual(new Set([name === 'propane' ? 'C3H8' : 'C2H6']))
    // "The smaller volume runs out" is no rule across the slot: right in about half the builds.
    const smaller = built.filter((b) => b.values.smallerRunsOut === 1).length / built.length
    expect(smaller > 0.4 && smaller < 0.6, `smaller runs out in ${smaller}`).toBe(true)
  })
})

describe('rounding to three decimal places', () => {
  it('divides by 24 and rounds an amount that needs it, never to a trailing 0', () => {
    const built = build('gas-moles-from-volume-rounded', 'q17', 600)
    for (const b of built) {
      common(b)
      expect(b.question.prompt).toContain('to three decimal places')
      expect(b.question.prompt).toContain('at RTP')
      const V = num(/([\d.]+) dm³/.exec(b.question.prompt)![1])
      expect(V >= 0.65 && V <= 2.4).toBe(true)
      expect(V).not.toBe(1)
      expect(b.question.prompt).not.toMatch(/chlorine|electrolysis/)
      const n = V / 24
      expect(answer(b)).toBe(Number(fixed(n, 3)))
      expect(fixed(n, 3)).toBe(String(answer(b)))
      // Rounding is needed, and clear of a half.
      expect(Math.abs(n * 1000 - Math.round(n * 1000))).toBeGreaterThan(1e-6)
      expect(Math.abs((n * 1000) % 1 - 0.5)).toBeGreaterThan(0.05)
      expect(b.question.solution).toBe(`$\\dfrac{${show(V)}}{24} = ${fixed(n, 5)}$, which is **${String(answer(b))} mol** to three decimal places.`)
      expect(method(b)).toEqual(['divides by 24'])
      expect(tolerance(b)).toBe(0.0005)
    }
    spread(built, 3, 10, 0.1)
  })
})

describe('every gas generator', () => {
  it('marks no more loosely than its figures or three significant figures allow, and accepts an answer given to three', () => {
    const slots: [string, string][] = [
      ['gas-volume-from-moles', 'q2'],
      ['gas-moles-from-volume', 'q4'],
      ['gas-volume-from-mass', 'q5'],
      ['gas-mass-from-volume', 'q7'],
      ['gas-moles-from-cm3', 'q8'],
      ['gas-volume-from-reactant-mass', 'q10'],
      ['gas-metal-mass-from-hydrogen', 'q14'],
    ]
    let fourFigures = 0
    for (const [id, slot] of slots) {
      for (const b of build(id, slot, 300)) {
        const q = b.question
        if (q.type !== 'numeric') throw new Error('not numeric')
        const given = (q.prompt.replace(/\((Mr|Ar) of.*$/, '').match(/\d+(?:\.\d+)?/g) ?? []).map((f) => (f.includes('.') ? f.split('.')[1]!.length : 0))
        const dp = Math.max(places(q.answer), ...given)
        const byPlaces = dp === 0 ? 0 : 0.5 * 10 ** -dp
        const rounded = sigFigs(q.answer, 3)
        if (rounded !== q.answer) fourFigures++
        expect(q.tolerance, `${id} ${b.seed}`).toBeLessThanOrEqual(Math.max(byPlaces, rounded !== q.answer ? sfTolerance(q.answer, 3) : 0) + 1e-12)
        expect(q.tolerance).toBeLessThanOrEqual(Math.abs(q.answer) * 0.02)
        // A student who gives three significant figures is marked right.
        expect(mark(q, String(rounded)).correct, `${id} ${b.seed}: ${q.answer} as ${rounded}`).toBe(true)
      }
    }
    // The case the rule is for turns up.
    expect(fourFigures).toBeGreaterThan(300)
  })
})
