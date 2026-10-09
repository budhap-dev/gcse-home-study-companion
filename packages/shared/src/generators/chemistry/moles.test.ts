import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { fixed, show } from '../format.ts'
import { GENERATORS, generate } from '../index.ts'
import { dpTolerance, sfTolerance, sigFigs } from '../physics/format.ts'
import type { Generated } from '../types.ts'
import { mark } from '../../marking.ts'
import { figures as sigCount } from '../physics/build.ts'
import { atoms, equationTex, mr, threeFigures, toPlaces } from './build.ts'
import { MOLE_POOLS } from './moles.ts'

/**
 * Structural tests for the conservation of mass and moles generators. The release check
 * proves each answer agrees with a second route; these read the prompt's own figures and
 * formulae back, work the answer from them, check every printed step and equation, and
 * check the chemistry is real: the masses a reaction links are in the ratio its equation
 * gives, and every equation balances. They also look across a run of builds for a context
 * that never rotates, or one value carrying a slot.
 */
const TOPIC = 'conservation-of-mass-and-moles'
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/chemistry')
const bank = Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  expect(g.topicId).toBe(TOPIC)
  const slot = bank.find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `structure-${i}`))
}

const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const units = (b: Generated) => (b.question.type === 'numeric' ? b.question.units : 'not numeric')
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
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
/** Every build: no "a 8 g", the written slot's units (none), the right number of marks. */
function common(b: Generated) {
  expect(b.question.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
  expect(units(b)).toBeUndefined()
  expect(last(b)).toBe(show(answer(b)))
}
/** The figures in a string, in order. */
const figures = (s: string) => (s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
/** A formula printed with Unicode subscripts, back to plain digits: CO₂ is CO2. */
const plain = (s: string) => s.replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080))
/** "(Mr of CO₂ = 44)" read back. */
function mrOfIn(prompt: string): { formula: string; M: number } {
  const m = /\(Mr of (\S+) = ([\d.]+)\)$/.exec(prompt)
  expect(m, prompt).not.toBeNull()
  return { formula: plain(m![1]!), M: Number(m![2]) }
}
/** The atoms on each side of a TeX equation, each formula multiplied by its coefficient. */
function balanced(tex: string): boolean {
  const side = (s: string) => {
    const out: Record<string, number> = {}
    for (const term of s.trim().split(' + ')) {
      const m = /^(\d*)\\mathrm\{(.+)\}$/.exec(term.trim())
      if (!m) throw new Error(`cannot read ${term}`)
      for (const [el, n] of Object.entries(atoms(m[2]!.replace(/_/g, '')))) out[el] = (out[el] ?? 0) + n * Number(m[1] || 1)
    }
    return out
  }
  const [l, r] = tex.split('\\rightarrow')
  return JSON.stringify(Object.entries(side(l!)).sort()) === JSON.stringify(Object.entries(side(r!)).sort())
}
/** The equations a solution prints, in its maths. */
const equations = (solution: string) => (solution.match(/\$[^$]*\\rightarrow[^$]*\$/g) ?? []).map((e) => e.slice(1, -1))

describe('closed systems and escaping gases', () => {
  it('keeps the mass of a closed system, and says why', () => {
    const built = build('closed-system-mass', 'q2')
    for (const b of built) {
      common(b)
      const [m] = figures(b.question.prompt)
      expect(answer(b)).toBe(m)
      expect(answer(b)).toBe(clean(values(b).flask + values(b).contents))
      expect(m! >= 85 && m! <= 270).toBe(true)
      expect(places(m!)).toBeLessThanOrEqual(1)
      expect(b.question.prompt).toMatch(/balloon|stoppered/)
      expect(b.question.solution).toContain(`unchanged: **${fixed(m!, 1)} g**.`)
      expect(b.question.prompt).toContain(`mass of ${fixed(m!, 1)} g`)
      expect(b.question.solution).toMatch(/caught in the balloon|already in the flask/)
      expect(codes(b)).toEqual(['B1'])
      expect(tolerance(b)).toBe(toPlaces(m!, Math.max(places(m!), 1)))
    }
    expect(contexts(built).size).toBe(4)
  })

  it('takes the oxide from the carbonate, in the ratio the equation gives', () => {
    const built = build('mass-of-gas-escaping', 'q4', 600)
    for (const b of built) {
      common(b)
      const c = MOLE_POOLS.CARBONATES.find((x) => b.question.prompt.includes(`g of ${MOLE_POOLS.called(x.carbonate)}`))!
      expect(c, b.seed).toBeDefined()
      expect(b.question.prompt).toContain(`g of ${MOLE_POOLS.called(c.oxide)}`)
      const [m, oxide] = figures(b.question.prompt)
      // Real chemistry: the moles of carbonate and of oxide are equal.
      expect(clean(m! / mr(c.carbonate))).toBe(clean(oxide! / mr(c.oxide)))
      expect(m! >= 2 && m! <= 30).toBe(true)
      expect(answer(b)).toBe(clean(m! - oxide!))
      expect(answer(b)).toBe(clean((m! / mr(c.carbonate)) * 44))
      expect(clearOf(answer(b), m!, oxide!)).toBe(true)
      expect(powerOfTen(values(b).n)).toBe(false)
      expect(b.question.solution).toContain(`$${show(m!)} - ${show(oxide!)} = ${show(answer(b))}$ g of carbon dioxide escaped.`)
      for (const e of equations(b.question.solution)) expect(balanced(e), e).toBe(true)
      expect(equations(b.question.solution)).toEqual([MOLE_POOLS.decomposition(c)])
      expect(tolerance(b)).toBe(toPlaces(answer(b), Math.max(places(answer(b)), places(m!), places(oxide!))))
    }
    expect(contexts(built).size).toBe(4)
    for (const name of contexts(built)) {
      const mine = built.filter((b) => b.values.context === name)
      expect(new Set(mine.map(answer)).size, String(name)).toBeGreaterThanOrEqual(10)
      expect(share(mine.map(answer)), String(name)).toBeLessThanOrEqual(0.15)
    }
  })

  it('every carbonate equation balances', () => {
    for (const c of MOLE_POOLS.CARBONATES) expect(balanced(MOLE_POOLS.decomposition(c)), c.carbonate).toBe(true)
  })
})

describe('repeat readings', () => {
  /** The three readings, from "are 46, 50 and 51 cm³". */
  function readings(prompt: string): number[] {
    const m = /(?:are|readings) ([\d.]+), ([\d.]+) and ([\d.]+) (cm³|g)/.exec(prompt)
    expect(m, prompt).not.toBeNull()
    return [m![1]!, m![2]!, m![3]!].map(Number)
  }
  const kind = (b: Generated) => MOLE_POOLS.READINGS.find((k) => k.name === b.values.context)!

  it('takes the mean of three different readings, none of them the mean', () => {
    const built = build('mean-of-three-readings', 'q5', 600)
    for (const b of built) {
      common(b)
      const k = kind(b)
      const xs = readings(b.question.prompt)
      expect(new Set(xs).size).toBe(3)
      const mean = clean((xs[0]! + xs[1]! + xs[2]!) / 3)
      expect(answer(b)).toBe(mean)
      expect(places(mean)).toBeLessThanOrEqual(k.dp)
      for (const x of xs) {
        expect(x).not.toBe(mean)
        expect(x >= k.lo && x <= k.hi, `${b.seed} ${x}`).toBe(true)
        // Printed to the instrument's resolution: 1.90 g, never 1.9 g.
        expect(b.question.prompt).toContain(k.dp ? fixed(x, k.dp) : show(x))
      }
      expect(b.question.prompt).toContain(`in ${k.unit}?`)
      // Printed to the readings' places: 24.30 ÷ 3 = 8.10, not 8.1.
      const r = (x: number) => (k.dp ? fixed(x, k.dp) : show(x))
      expect(b.question.solution).toContain(`\\div 3 = ${r(clean(xs[0]! + xs[1]! + xs[2]!))} \\div 3 = ${r(mean)}$ ${k.unit}.`)
      expect(codes(b)).toEqual(['B1'])
      expect(tolerance(b)).toBe(toPlaces(mean, Math.max(places(mean), k.dp)))
    }
    expect(contexts(built).size).toBe(3)
    for (const name of contexts(built)) {
      const mine = built.filter((b) => b.values.context === name)
      expect(new Set(mine.map(answer)).size, String(name)).toBeGreaterThanOrEqual(10)
      expect(share(mine.map(answer)), String(name)).toBeLessThanOrEqual(0.1)
    }
  })

  it('halves the range, and gives the result as mean ± uncertainty', () => {
    const built = build('uncertainty-half-range', 'q6', 900)
    for (const b of built) {
      common(b)
      const k = kind(b)
      const xs = readings(b.question.prompt)
      expect(new Set(xs).size).toBe(3)
      const [lo, hi] = [Math.min(...xs), Math.max(...xs)]
      const width = clean(hi - lo)
      const u = clean(width / 2)
      const mean = clean((xs[0]! + xs[1]! + xs[2]!) / 3)
      expect(answer(b)).toBe(u)
      expect(places(mean)).toBeLessThanOrEqual(k.dp)
      // An odd range halves to a half-step: ±2.5 cm³, ±0.015 g.
      expect(places(u)).toBeLessThanOrEqual(k.dp + 1)
      for (const x of [...xs, mean]) expect(tenfold(u, x), `${b.seed} ${u} ${x}`).toBe(false)
      const r = (x: number) => (k.dp ? fixed(x, k.dp) : show(x))
      expect(b.question.solution).toBe(
        `Range $= ${r(hi)} - ${r(lo)} = ${r(width)}$; half of that is **${show(u)} ${k.unit}**, so the result is $${r(mean)} \\pm ${show(u)}${k.unit === 'g' ? '\\text{ g}' : '\\text{ cm}^3'}$.`,
      )
      expect(method(b)).toEqual([`range $= ${r(width)}$`])
      expect(tolerance(b)).toBe(toPlaces(u, Math.max(places(u), k.dp)))
    }
    expect(contexts(built).size).toBe(3)
    for (const name of contexts(built)) {
      const mine = built.filter((b) => b.values.context === name)
      const k = MOLE_POOLS.READINGS.find((x) => x.name === name)!
      // The uncertainty comes from the ranges the context allows, each about as often.
      expect(new Set(mine.map(answer))).toEqual(new Set(k.ranges.map((s) => clean((s * k.step) / 2))))
      expect(k.ranges.length, String(name)).toBeGreaterThanOrEqual(10)
      expect(share(mine.map(answer)), String(name)).toBeLessThanOrEqual(0.2)
      expect(share(mine.map((b) => b.values.mean)), String(name)).toBeLessThanOrEqual(0.1)
    }
  })

  it('offsets add to zero and differ', () => {
    for (const reach of [4, 6, 9]) {
      for (const set of MOLE_POOLS.offsets(reach, false)) {
        expect(set[0]! + set[1]! + set[2]!).toBe(0)
        expect(new Set(set).size).toBe(3)
        expect(set).not.toContain(0)
      }
    }
  })
})

describe('moles, mass and Mr', () => {
  it('divides the mass by an Mr that is the formula’s own', () => {
    const built = build('moles-from-mass', 'q7', 900)
    for (const b of built) {
      common(b)
      const { formula, M } = mrOfIn(b.question.prompt)
      expect(M).toBe(mr(formula))
      expect(formula).toBe(values(b).formula)
      const [m] = figures(b.question.prompt.replace(/\(Mr.*$/, ''))
      const n = clean(m! / M)
      expect(answer(b)).toBe(n)
      expect(places(m!)).toBeLessThanOrEqual(2)
      expect(m! >= 0.5 && m! <= 200).toBe(true)
      expect(powerOfTen(n)).toBe(false)
      expect(clearOf(n, m!, M)).toBe(true)
      expect(b.question.solution).toBe(`$\\dfrac{${show(m!)}}{${show(M)}} = ${show(n)}$ mol.`)
      expect(tolerance(b)).toBe(toPlaces(n, Math.max(places(n), places(m!))))
      if (['O2', 'N2', 'Cl2'].includes(formula)) expect(b.question.prompt).toContain(' gas')
    }
    spread(built)
  })

  it('multiplies the moles by an Mr that is the formula’s own', () => {
    const built = build('mass-from-moles', 'q8', 900)
    for (const b of built) {
      common(b)
      const { formula, M } = mrOfIn(b.question.prompt)
      expect(M).toBe(mr(formula))
      const [n] = figures(b.question.prompt.replace(/\(Mr.*$/, ''))
      const m = clean(n! * M)
      expect(answer(b)).toBe(m)
      expect(b.question.prompt).toContain(`${show(n!)} moles of`)
      expect(powerOfTen(n!)).toBe(false)
      expect(clean(n! * M)).not.toBe(clean(n! + M))
      expect(places(m)).toBeLessThanOrEqual(2)
      expect(m >= 0.5 && m <= 200).toBe(true)
      expect(b.question.solution).toBe(`$${show(n!)} \\times ${show(M)} = ${show(m)}$ g.`)
      // A product: its three-figure rounding is marked right as well (10.32 g as 10.3 g).
      expect(tolerance(b)).toBe(threeFigures(toPlaces(m, Math.max(places(m), places(n!))), m))
    }
    spread(built)
  })

  /** Three families rotating, each with many answers, and no substance or answer carrying one. */
  function spread(built: Generated[]) {
    expect(contexts(built)).toEqual(new Set(MOLE_POOLS.SUBSTANCES.map((f) => f.name)))
    for (const name of contexts(built)) {
      const mine = built.filter((b) => b.values.context === name)
      expect(new Set(mine.map(answer)).size, String(name)).toBeGreaterThanOrEqual(10)
      expect(share(mine.map(answer)), String(name)).toBeLessThanOrEqual(0.1)
      expect(share(mine.map((b) => b.values.formula)), String(name)).toBeLessThanOrEqual(0.4)
      expect(share(mine.map((b) => b.values.n)), String(name)).toBeLessThanOrEqual(0.1)
    }
  }

  it('scales the carbonate’s mass by the two Mrs it prints, through a balanced 1 : 1 equation', () => {
    const built = build('reacting-mass-from-decomposition', 'q10', 800)
    for (const b of built) {
      common(b)
      const m = /\(Mr: (\S+) = ([\d.]+), (\S+) = ([\d.]+)\)$/.exec(b.question.prompt)
      expect(m, b.seed).not.toBeNull()
      const [c, Mc, p, Mp] = [plain(m![1]!), Number(m![2]), plain(m![3]!), Number(m![4])]
      expect(Mc).toBe(mr(c))
      expect(Mp).toBe(mr(p))
      expect(b.question.prompt).toContain(MOLE_POOLS.called(c))
      expect(b.question.prompt).toContain(`mass of ${MOLE_POOLS.called(p)} ${p === 'CO2' ? 'is given off' : 'is left'}`)
      const [mass] = figures(b.question.prompt)
      expect(mass! >= 2 && mass! <= 30).toBe(true)
      const ans = clean((mass! / Mc) * Mp)
      expect(answer(b)).toBe(ans)
      expect(places(ans)).toBeLessThanOrEqual(2)
      expect(powerOfTen(clean(mass! / Mc))).toBe(false)
      expect(clearOf(ans, mass!, Mc, Mp)).toBe(true)
      const [eq] = equations(b.question.solution)
      expect(balanced(eq!)).toBe(true)
      expect(eq).toContain(`\\mathrm{${c.replace(/(\d+)/g, '_$1')}} \\rightarrow`)
      expect(b.question.solution).toContain(`$\\dfrac{${show(mass!)}}{${show(Mc)}} \\times ${show(Mp)} = ${show(ans)}$ g.`)
      expect(method(b)).toEqual([`scales by $\\dfrac{${show(mass!)}}{${show(Mc)}}$`])
      expect(tolerance(b)).toBe(threeFigures(toPlaces(ans, Math.max(places(ans), places(mass!))), ans))
    }
    expect(contexts(built).size).toBe(8)
    for (const name of contexts(built)) {
      const mine = built.filter((b) => b.values.context === name)
      expect(new Set(mine.map(answer)).size, String(name)).toBeGreaterThanOrEqual(10)
      expect(share(mine.map(answer)), String(name)).toBeLessThanOrEqual(0.2)
    }
  })

  it('multiplies by the Avogadro constant and rounds to three significant figures', () => {
    const built = build('particles-from-moles', 'q11', 600)
    for (const b of built) {
      common(b)
      const m = /there in ([\d.]+) moles|contains ([\d.]+) moles/.exec(b.question.prompt)
      const n = Number(m![1] ?? m![2])
      const e = { '²²': 22, '²³': 23 }[/as a multiple of 10(²²|²³)\.$/.exec(b.question.prompt)![1]!]!
      const mantissa = (n * 6.02) / 10 ** (e - 23)
      expect(mantissa >= 1 && mantissa < 10, b.seed).toBe(true)
      expect(answer(b)).toBe(sigFigs(mantissa, 3))
      // Three figures that the answer box keeps: never 1.20.
      expect(show(answer(b)).replace('.', '').length).toBe(3)
      // The constant is recalled (AQA 4.3.2.1), not given: the insert does not print it.
      expect(b.question.prompt).not.toContain('6.02')
      expect(b.question.prompt).toContain('three significant figures')
      expect(powerOfTen(n) || tenfold(n, 2) || tenfold(n, 0.5)).toBe(false)
      expect(b.question.solution).toContain(`$${show(n)} \\times 6.02 \\times 10^{23} = ${show(clean(mantissa))} \\times 10^{${e}}$`)
      expect(b.question.solution).toContain(`\\mathbf{${show(answer(b))} \\times 10^{${e}}}`)
      expect(method(b)).toEqual([`multiplies ${show(n)} by the Avogadro constant`])
      expect(tolerance(b)).toBe(sfTolerance(answer(b), 3))
      const metal = b.values.context === 'atoms of a metal'
      expect(b.question.prompt).toContain(metal ? 'atoms' : 'molecules')
    }
    expect(contexts(built).size).toBe(3)
    expect(new Set(built.map((b) => b.values.e))).toEqual(new Set([22, 23]))
    expect(share(built.map(answer))).toBeLessThanOrEqual(0.05)
  })

  it('converts kilograms to grams before dividing, and prints the conversion as the method mark', () => {
    const built = build('moles-from-kilograms', 'q12', 600)
    for (const b of built) {
      common(b)
      const m = /([\d.]+) kg of/.exec(b.question.prompt)
      const kg = Number(m![1])
      const M = Number(/\(Mr = ([\d.]+)\)$/.exec(b.question.prompt)![1])
      expect(M).toBe(mr(values(b).formula))
      const g = clean(kg * 1000)
      const n = clean(g / M)
      expect(answer(b)).toBe(n)
      expect(Number.isInteger(n)).toBe(true)
      expect(powerOfTen(n) || tenfold(n, kg) || tenfold(n, M)).toBe(false)
      const garden = b.values.context === 'garden'
      expect(places(kg)).toBeLessThanOrEqual(garden ? 1 : 2)
      expect(garden ? kg >= 5 && kg <= 25 : kg >= 0.5 && kg <= 5).toBe(true)
      const texG = g >= 10000 ? String(g).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : String(g)
      expect(b.question.solution).toContain(`$${show(kg)}\\text{ kg} = ${texG}\\text{ g}$, so $\\dfrac{${texG}}{${show(M)}} = ${n}$ mol.`)
      expect(b.question.solution).toContain(`gives ${show(n / 1000)}, a thousand times too small.`)
      expect(method(b)).toEqual([`converts ${show(kg)} kg to ${g >= 10000 ? String(g).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : g} g`])
      expect(tolerance(b)).toBe(0)
    }
    expect(contexts(built).size).toBe(2)
    for (const name of contexts(built)) {
      const mine = built.filter((b) => b.values.context === name)
      expect(new Set(mine.map(answer)).size, String(name)).toBeGreaterThanOrEqual(10)
      expect(share(mine.map(answer)), String(name)).toBeLessThanOrEqual(0.15)
      expect(share(mine.map((b) => b.values.formula)), String(name)).toBeLessThanOrEqual(0.4)
    }
  })

  it('uses the mass lost as the mass of gas, from a balanced equation', () => {
    const built = build('moles-from-mass-lost', 'q15', 900)
    for (const b of built) {
      common(b)
      const { formula, M } = mrOfIn(b.question.prompt)
      expect(M).toBe(mr(formula))
      const both = /mass of ([\d.]+) g at the start and ([\d.]+) g at the end/.exec(b.question.prompt)
      const loss = both ? clean(Number(both[1]) - Number(both[2])) : Number(/lose ([\d.]+) g, all of it/.exec(b.question.prompt)![1])
      const n = clean(loss / M)
      expect(answer(b)).toBe(n)
      expect(places(loss)).toBeLessThanOrEqual(2)
      expect(powerOfTen(n)).toBe(false)
      expect(clearOf(n, loss, M)).toBe(true)
      expect(b.question.solution).toContain(`$\\dfrac{${show(loss)}}{${show(M)}} = ${show(n)}$ mol.`)
      if (both) {
        expect(b.question.solution).toContain(`$${both[1]} - ${both[2]} = ${show(loss)}$ g`)
        expect(method(b)).toEqual([`uses the mass lost, $${both[1]} - ${both[2]} = ${show(loss)}$ g, as the mass of gas`])
      } else expect(method(b)).toEqual(['uses the mass lost as the mass of gas'])
      const [eq] = equations(b.question.solution)
      expect(balanced(eq!), eq).toBe(true)
      expect(eq).toContain(`\\mathrm{${formula.replace(/(\d+)/g, '_$1')}}`)
      expect(tolerance(b)).toBe(toPlaces(n, Math.max(places(n), 3)))
    }
    expect(contexts(built).size).toBe(3)
    expect(new Set(built.map((b) => b.values.given))).toEqual(new Set(['loss', 'before and after']))
    for (const name of contexts(built)) {
      const mine = built.filter((b) => b.values.context === name)
      expect(new Set(mine.map(answer)).size, String(name)).toBeGreaterThanOrEqual(8)
      expect(share(mine.map(answer)), String(name)).toBeLessThanOrEqual(0.15)
    }
    for (const e of MOLE_POOLS.ESCAPES) expect(balanced(equationTex(e.equation)), e.name).toBe(true)
  })

  it('divides the mass by the moles for an Mr a real compound has', () => {
    const built = build('relative-formula-mass-from-moles', 'q17', 900)
    for (const b of built) {
      common(b)
      const n = Number(/([\d.]+) mol/.exec(b.question.prompt)![1])
      const m = Number(/([\d.]+) g\b/.exec(b.question.prompt)![1])
      const M = clean(m / n)
      expect(answer(b), b.seed).toBe(M)
      expect(M).toBe(mr(values(b).formula))
      expect(powerOfTen(n) || tenfold(n, 0.5) || tenfold(n, 0.25)).toBe(false)
      expect(clearOf(M, m, n)).toBe(true)
      // 0.26 mol of calcium carbonate is 26 g: the mass is never the amount with the point moved.
      expect(tenfold(m, n), b.seed).toBe(false)
      expect(b.question.solution).toContain(`= \\dfrac{${show(m)}}{${show(n)}} = ${show(M)}$.`)
      expect(b.question.solution).toContain(`, has this $M_r$, for example.`)
      expect(method(b)).toEqual([`rearranges to mass divided by moles: $\\dfrac{${show(m)}}{${show(n)}}$`])
      expect(tolerance(b)).toBe(dpTolerance(M))
    }
    expect(contexts(built).size).toBe(2)
    for (const name of contexts(built)) {
      const mine = built.filter((b) => b.values.context === name)
      expect(new Set(mine.map(answer)).size, String(name)).toBeGreaterThanOrEqual(10)
      expect(share(mine.map(answer)), String(name)).toBeLessThanOrEqual(0.15)
      expect(share(mine.map((b) => b.values.n)), String(name)).toBeLessThanOrEqual(0.1)
    }
  })

  /** The slots whose answer is a product or quotient, whose three-figure rounding is marked right. */
  const WIDENED = new Set(['mass-from-moles', 'reacting-mass-from-decomposition'])

  it('marks the three-figure rounding of a product right, and keeps sums and differences exact', () => {
    let longer = 0
    for (const id of WIDENED) {
      const slot = id === 'mass-from-moles' ? 'q8' : 'q10'
      for (const b of build(id, slot, 600)) {
        if (b.question.type !== 'numeric') continue
        const a = b.question.answer
        expect(mark(b.question, String(sigFigs(a, 3))).correct, `${id} ${b.seed}: ${a}`).toBe(true)
        if (sigCount(a) > 3) longer++
      }
    }
    expect(longer).toBeGreaterThan(100)
    // A mass difference (23 − 12.88 = 10.12 g) and a closed system's mass are read, not
    // calculated by multiplying: their three-figure rounding is wrong.
    let exact = 0
    for (const [id, slot] of [['mass-of-gas-escaping', 'q4'], ['closed-system-mass', 'q2']] as const) {
      for (const b of build(id, slot, 600)) {
        if (b.question.type !== 'numeric') continue
        const a = b.question.answer
        if (sigCount(a) > 3 && sigFigs(a, 3) !== a) {
          exact++
          expect(mark(b.question, String(sigFigs(a, 3))).correct, `${id} ${b.seed}: ${a}`).toBe(false)
        }
      }
    }
    expect(exact).toBeGreaterThan(100)
  })

  it('never marks more loosely than half a unit in the last place of the figures it gives', () => {
    // The answer's printed places are not enough: 0.79, 0.83 and 0.78 g have a mean of 0.80,
    // printed 0.8, and half a unit in its last place would mark 0.81 right.
    const slots: [string, string][] = [
      ['closed-system-mass', 'q2'],
      ['mass-of-gas-escaping', 'q4'],
      ['mean-of-three-readings', 'q5'],
      ['uncertainty-half-range', 'q6'],
      ['moles-from-mass', 'q7'],
      ['mass-from-moles', 'q8'],
      ['reacting-mass-from-decomposition', 'q10'],
      ['moles-from-mass-lost', 'q15'],
    ]
    let trailing = 0
    for (const [id, slot] of slots) {
      for (const b of build(id, slot, 600)) {
        const given = (b.question.prompt.replace(/\(Mr.*$/, '').match(/\d+(?:\.\d+)?/g) ?? []).map((f) => (f.includes('.') ? f.split('.')[1]!.length : 0))
        const dp = Math.max(0, ...given)
        if (dp > places(answer(b))) trailing++
        const exact = dp === 0 && places(answer(b)) === 0 ? 0 : 0.5 * 10 ** -Math.max(dp, places(answer(b)))
        // A product or quotient may also take its three-figure rounding; nothing else is widened.
        const bound = WIDENED.has(id) ? threeFigures(exact, answer(b)) : exact
        expect(tolerance(b), `${id} ${b.seed}: ${answer(b)} from figures to ${dp} places`).toBeLessThanOrEqual(bound + 1e-12)
      }
    }
    // The case the rule is for turns up: an answer printed with fewer places than its givens.
    expect(trailing).toBeGreaterThan(50)
  })
})
