import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { dpTolerance } from '../physics/format.ts'
import { atoms, mr } from './build.ts'
import { reactingGenerators } from './reacting.ts'

/**
 * Structural tests for the reacting-masses generators. The release check proves each answer
 * agrees with a second route; these read the prompt's own numbers, formulae and equation back,
 * work the chemistry again from them alone (which reactant runs out, the ratio, the mass), and
 * check each printed step is that working, because a right answer can come by a wrong route.
 * They also look across builds for what no single build can show: contexts that never rotate,
 * one answer carrying a context, or "fewer moles runs out" being always true.
 */
const TOPIC = 'reacting-masses-and-limiting-reactants'
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/chemistry')
const bank = Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = bank.find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `structure-${i}`))
}

const clean = (x: number) => Number(x.toPrecision(12))
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const values = (b: Generated) => b.values as Record<string, number>
const decimals = (x: number) => (show(x).includes('.') ? show(x).split('.')[1]!.length : 0)
const tenfold = (a: number, b: number) => {
  const l = Math.log10(Math.abs(a / b))
  return Math.abs(l - Math.round(l)) < 1e-9
}
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context)).size

const SUB = '₀₁₂₃₄₅₆₇₈₉'
/** CaCO₃ back to CaCO3. */
const unsub = (s: string) => s.replace(/[₀-₉]/g, (d) => String(SUB.indexOf(d)))
interface Term {
  n: number
  f: string
}
/** The equation a prompt prints, read back into formulae and balancing numbers. */
function equationIn(text: string): { left: Term[]; right: Term[] } {
  const m = /[A-Za-z0-9₀-₉()]+(?: \+ [A-Za-z0-9₀-₉()]+)* → [A-Za-z0-9₀-₉()]+(?: \+ [A-Za-z0-9₀-₉()]+)*/.exec(text)
  if (!m) throw new Error(`no equation in ${text}`)
  const side = (s: string) =>
    s.split(' + ').map((t) => {
      const x = /^(\d*)(.+)$/.exec(unsub(t))!
      return { n: x[1] ? Number(x[1]) : 1, f: x[2]! }
    })
  const [l, r] = m[0].split(' → ')
  return { left: side(l!), right: side(r!) }
}
function atomCount(terms: Term[]) {
  const out: Record<string, number> = {}
  for (const t of terms) for (const [s, k] of Object.entries(atoms(t.f))) out[s] = (out[s] ?? 0) + k * t.n
  return out
}
/** Counts every atom on each side with atoms(): the equation printed must balance. */
function expectBalanced(eq: { left: Term[]; right: Term[] }, seed: string) {
  expect(atomCount(eq.left), seed).toEqual(atomCount(eq.right))
}
/** Every "X = n" the prompt's bracket of masses prints is mr(X). */
function expectMassesRight(prompt: string, seed: string): number {
  const bracket = /\(((?:Ar|Mr)[^)]*(?:\([^)]*\)[^)]*)*)\)\s*$/.exec(prompt)
  expect(bracket, `${seed}: ${prompt}`).not.toBeNull()
  let n = 0
  for (const m of bracket![1]!.matchAll(/([A-Za-z0-9₀-₉()]+) = (\d+(?:\.\d+)?)/g)) {
    expect(Number(m[2]), `${seed}: ${m[0]}`).toBe(mr(unsub(m[1]!)))
    n++
  }
  return n
}
/** No article before a figure: "a 8 g" reads "an eight". */
const noArticle = (prompt: string) => expect(prompt).not.toMatch(/\b(a|A|an|An) \d/)
/** The largest share of the builds that one value takes, within any one context. */
function worstShare(built: Generated[], key: (b: Generated) => unknown) {
  const by = new Map<unknown, Generated[]>()
  for (const b of built) by.set(b.values.context, [...(by.get(b.values.context) ?? []), b])
  let worst = 0
  let fewest = Infinity
  for (const group of by.values()) {
    const counts = new Map<unknown, number>()
    for (const b of group) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
    worst = Math.max(worst, Math.max(...counts.values()) / group.length)
    fewest = Math.min(fewest, counts.size)
  }
  return { worst, fewest }
}

const NAME: Record<string, string> = {
  magnesium: 'Mg', zinc: 'Zn', iron: 'Fe', copper: 'Cu', aluminium: 'Al', sodium: 'Na', lithium: 'Li', sulfur: 'S',
  hydrogen: 'H2', oxygen: 'O2', nitrogen: 'N2', chlorine: 'Cl2', methane: 'CH4', 'magnesium carbonate': 'MgCO3', 'copper(II) oxide': 'CuO',
}
/** The masses a prompt gives, by formula: "7.2 g of magnesium" and "hydrochloric acid containing 7.3 g of HCl". */
function massesIn(prompt: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const m of prompt.matchAll(/containing (\d+(?:\.\d+)?) g of ([A-Za-z0-9₀-₉]+)/g)) out[unsub(m[2]!)] = Number(m[1])
  for (const m of prompt.matchAll(/(\d+(?:\.\d+)?) g of (magnesium carbonate|copper\(II\) oxide|[a-z]+)/g)) if (NAME[m[2]!]) out[NAME[m[2]!]!] = Number(m[1])
  return out
}

describe('every reacting-masses build', () => {
  it('has a generator for each numeric written slot it claims, and nothing else', () => {
    expect(reactingGenerators.flatMap((g) => g.replaces).sort()).toEqual(['q11', 'q12', 'q13', 'q15', 'q17', 'q2', 'q4', 'q5', 'q8', 'q9'].sort())
    for (const g of reactingGenerators) for (const id of g.replaces) expect(bank.find((q) => q.id === id)!.type).toBe('numeric')
  })

  it('prints no article before a figure, keeps the written units, and rounds as the rule says', () => {
    for (const g of reactingGenerators) {
      for (const id of g.replaces) {
        for (const b of build(g.id, id, 150)) {
          noArticle(b.question.prompt)
          expect(b.question.type).toBe('numeric')
          if (b.question.type === 'numeric') expect(b.question.units, b.seed).toBeUndefined()
          expect(tolerance(b), b.seed).toBe(dpTolerance(answer(b)))
          expect(b.question.solution, b.seed).toContain(`**${show(answer(b))}`)
          expect(b.question.markScheme.at(-1)!.description).toBe(show(answer(b)))
          // A two-digit count in maths is braced: H_{18}, never H_18 (an H₁ then an 8).
          for (const t of [b.question.solution, ...b.question.markScheme.map((l) => l.description)]) expect(t, b.seed).not.toMatch(/_\d\d/)
        }
      }
    }
  })

  it('never fails to draw, over 3000 seeds per slot', () => {
    for (const g of reactingGenerators) {
      const slot = bank.find((q) => q.id === g.replaces[0])!
      expect(() => {
        for (let i = 0; i < 3000; i++) generate(g, slot, `throw-${i}`)
      }, g.id).not.toThrow()
    }
  })
})

describe('moles and mass of one substance', () => {
  it('q2 divides the mass printed by the Mr printed, and the Mr is the formula\'s', () => {
    const built = build('reacting-moles-from-mass', 'q2')
    for (const b of built) {
      const f = String(b.values.context)
      const { m, Mr, n } = values(b)
      expect(Mr).toBe(mr(f))
      expect(b.question.prompt).toMatch(new RegExp(`(Mr = ${show(Mr!)}|Mr of [^ ]+ = ${show(Mr!)})\\)$`))
      expect(b.question.prompt).toMatch(new RegExp(`\\b${show(m!).replace('.', '\\.')} g\\b`))
      expect(answer(b)).toBe(clean(m! / Mr!))
      expect(n).toBe(answer(b))
      expect(decimals(m!)).toBeLessThanOrEqual(2)
      expect(m! >= 1 && m! <= 50).toBe(true)
      // Never the mass with the point moved: no Mr of 100 and no amount of 0.1 mol.
      expect(tenfold(m!, Mr!)).toBe(false)
      expect(tenfold(answer(b), m!)).toBe(false)
      expect(b.question.solution).toContain(`\\dfrac{${show(m!)}}{${show(Mr!)}} = $ **${show(n!)} mol**`)
    }
    expect(contexts(built)).toBe(10)
  })

  it('q4 multiplies the moles printed by the Mr printed', () => {
    const built = build('reacting-mass-from-moles', 'q4')
    for (const b of built) {
      const f = String(b.values.context)
      const { n, Mr } = values(b)
      expect(Mr).toBe(mr(f))
      expectMassesRight(b.question.prompt, b.seed)
      expect(b.question.prompt).toContain(`${show(n!)} moles of`)
      expect(answer(b)).toBe(clean(n! * Mr!))
      expect(tenfold(answer(b), Mr!) || tenfold(answer(b), n!)).toBe(false)
      expect(b.question.solution).toContain(`${show(n!)} \\times ${show(Mr!)} = $ **${show(answer(b))} g**`)
    }
    expect(contexts(built)).toBe(10)
  })
})

describe('reacting masses through a balanced equation', () => {
  it('q5: a real one-to-one reaction, the moles of the reactant, then the mass of the product', () => {
    const built = build('reacting-mass-of-product', 'q5')
    for (const b of built) {
      const eq = equationIn(b.question.prompt)
      expectBalanced(eq, b.seed)
      const [from, to] = String(b.values.context).split('->') as [string, string]
      expect(eq.left.some((t) => t.f === from)).toBe(true)
      expect(eq.right.some((t) => t.f === to)).toBe(true)
      // One mole of reactant, one of product.
      expect(eq.left.find((t) => t.f === from)!.n).toBe(eq.right.find((t) => t.f === to)!.n)
      expect(expectMassesRight(b.question.prompt, b.seed)).toBe(2)
      const m = massesIn(b.question.prompt)[from] ?? values(b).m!
      expect(b.question.prompt).toContain(`${show(m)} g of`)
      const n = clean(m / mr(from))
      expect(answer(b), b.seed).toBe(clean(n * mr(to)))
      expect(b.question.solution).toContain(`\\dfrac{${show(m)}}{${show(mr(from))}} = ${show(n)}$`)
      expect(b.question.solution).toContain(`${show(n)} \\times ${show(mr(to))} = $`)
      expect(b.question.markScheme[0]!.description).toContain(`= ${show(n)}$`)
      expect(tenfold(n, 1)).toBe(false)
      expect(tenfold(answer(b), m) || near(answer(b), 2 * m) || near(2 * answer(b), m)).toBe(false)
    }
    expect(contexts(built)).toBe(7)
  })

  it('q8: the ratio from the printed equation turns moles of reactant into moles of product', () => {
    const built = build('reacting-mass-by-ratio', 'q8')
    for (const b of built) {
      const eq = equationIn(b.question.prompt)
      expectBalanced(eq, b.seed)
      const [from, to] = String(b.values.context).split('->') as [string, string]
      const a = eq.left.find((t) => t.f === from)!.n
      const k = eq.right.find((t) => t.f === to)!.n
      const n = Number(/(\d+(?:\.\d+)?) moles of/.exec(b.question.prompt)![1])
      expect(b.question.prompt).toContain('excess')
      expect(expectMassesRight(b.question.prompt, b.seed)).toBe(1)
      const p = clean((n * k) / a)
      expect(b.question.markScheme[0]!.description).toContain(`$${show(p)}$ mol`)
      expect(answer(b), b.seed).toBe(clean(p * mr(to)))
      expect(b.question.solution).toContain(`${show(p)} \\times ${show(mr(to))} = $`)
      expect(n >= 0.02 && n <= 0.5).toBe(true)
    }
    expect(contexts(built)).toBe(7)
    // The 2 : 3 of aluminium and the 1 : 2 of the thermite reaction turn up, not only 1 : 1.
    expect(built.some((b) => b.question.solution.includes('$2:3$'))).toBe(true)
    expect(built.some((b) => b.question.solution.includes('$1:2$'))).toBe(true)
  })
})

/** From two amounts and the printed equation, which reactant runs out, worked from nothing else. */
function limitingOf(eq: { left: Term[] }, n: [number, number]) {
  const x = [n[0] / eq.left[0]!.n, n[1] / eq.left[1]!.n]
  const i = x[0]! < x[1]! ? 0 : 1
  return { i, ratio: Math.max(x[0]!, x[1]!) / Math.min(x[0]!, x[1]!) }
}
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)

describe('limiting reactants', () => {
  it('q9: the reactant named as limiting is the one with less per balancing number, and the product follows from it', () => {
    const built = build('reacting-limiting-from-moles', 'q9')
    for (const b of built) {
      const eq = equationIn(b.question.prompt)
      expectBalanced(eq, b.seed)
      const amounts = [...b.question.prompt.matchAll(/(\d+(?:\.\d+)?) mol of ([a-z]+)/g)]
      expect(amounts.map((m) => NAME[m[2]!])).toEqual(eq.left.map((t) => t.f))
      const n: [number, number] = [Number(amounts[0]![1]), Number(amounts[1]![1])]
      const { i, ratio } = limitingOf(eq, n)
      expect(ratio, b.seed).toBeGreaterThanOrEqual(1.2 - 1e-9)
      const L = eq.left[i]!
      const name = Object.keys(NAME).find((k) => NAME[k] === L.f)!
      expect(b.question.solution.startsWith(`${cap(name)} is limiting`), b.seed).toBe(true)
      expect(b.question.markScheme[0]!.description).toBe(`identifies ${name} as limiting`)
      const productName = /How many moles of (.+?) (?:can )?form/.exec(b.question.prompt)![1]!
      const P = eq.right.find((t) => ({ 'magnesium oxide': 'MgO', ammonia: 'NH3', 'aluminium oxide': 'Al2O3', 'iron(III) chloride': 'FeCl3', water: 'H2O', 'sodium chloride': 'NaCl', 'carbon dioxide': 'CO2', 'aluminium chloride': 'AlCl3', 'sodium oxide': 'Na2O' })[productName] === t.f)!
      expect(answer(b), b.seed).toBe(clean((n[i]! * P.n) / L.n))
      expect(n[0]).not.toBe(n[1])
      expect(n.some((x) => tenfold(answer(b), x))).toBe(false)
      expect(b.question.solution).toContain(`$${show(n[i]!)} \\div ${L.n} = ${show(n[i]! / L.n)}$`)
    }
    expect(contexts(built)).toBe(8)
  })

  it('q9: "the one with fewer moles runs out" is right in no more than about 60% of builds', () => {
    const built = build('reacting-limiting-from-moles', 'q9', 2000)
    const fewer = (b: Generated) => {
      const amounts = [...b.question.prompt.matchAll(/(\d+(?:\.\d+)?) mol of ([a-z]+)/g)].map((m) => Number(m[1]))
      const eq = equationIn(b.question.prompt)
      const { i } = limitingOf(eq, [amounts[0]!, amounts[1]!])
      return amounts[i]! < amounts[1 - i]!
    }
    const share = built.filter(fewer).length / built.length
    expect(share).toBeLessThanOrEqual(0.6)
    expect(share).toBeGreaterThanOrEqual(0.3)
    // Six of the eight contexts can go either way, and do.
    const either = new Set(built.filter((b) => !fewer(b)).map((b) => b.values.context))
    expect(either.size).toBeGreaterThanOrEqual(6)
  })

  it('q17: letters, each coefficient read from the printed equation', () => {
    const built = build('reacting-limiting-letters', 'q17')
    for (const b of built) {
      const m = /(\d?)A \+ (\d?)B → (\d?)C/.exec(b.question.prompt)!
      const a = [Number(m[1] || 1), Number(m[2] || 1)]
      const k = Number(m[3] || 1)
      const nA = Number(/(\d+(?:\.\d+)?) mol of A/.exec(b.question.prompt)![1])
      const nB = Number(/(\d+(?:\.\d+)?) mol of B/.exec(b.question.prompt)![1])
      const xA = nA / a[0]!
      const xB = nB / a[1]!
      expect(Math.max(xA, xB) / Math.min(xA, xB)).toBeGreaterThanOrEqual(1.2 - 1e-9)
      const L = xA < xB ? 'A' : 'B'
      expect(b.question.solution).toContain(`${L} is limiting`)
      expect(b.question.markScheme[0]!.description).toBe(`identifies ${L} as limiting`)
      expect(answer(b), b.seed).toBe(clean(Math.min(xA, xB) * k))
      expect(b.question.solution).toContain(`A: $${show(nA)} \\div ${a[0]} = ${show(xA)}$`)
      expect(b.question.solution).toContain(`B: $${show(nB)} \\div ${a[1]} = ${show(xB)}$`)
      // Never the limiting amount itself: a 1 : 1 ratio would make the answer a given.
      expect(tenfold(answer(b), nA) || tenfold(answer(b), nB)).toBe(false)
    }
    expect(contexts(built)).toBe(6)
  })

  for (const [id, slotId, asMass] of [['reacting-limiting-moles-from-masses', 'q11', false], ['reacting-limiting-mass-from-masses', 'q15', true]] as const) {
    it(`${slotId}: moles of each reactant from its printed mass, the limiting one picked, then the product`, () => {
      const built = build(id, slotId)
      for (const b of built) {
        const eq = equationIn(b.question.prompt)
        expectBalanced(eq, b.seed)
        expect(expectMassesRight(b.question.prompt, b.seed)).toBe(asMass ? 3 : 2)
        const masses = massesIn(b.question.prompt)
        const n = eq.left.map((t) => clean(masses[t.f]! / mr(t.f))) as [number, number]
        for (const [j, t] of eq.left.entries()) {
          expect(masses[t.f], `${b.seed} ${t.f}`).toBeDefined()
          expect(decimals(masses[t.f]!)).toBeLessThanOrEqual(2)
          expect(b.question.solution).toContain(`\\dfrac{${show(masses[t.f]!)}}{${show(mr(t.f))}} = ${show(n[j]!)}\\text{ mol}$, $\\div ${t.n} = ${show(n[j]! / t.n)}$`)
        }
        const { i, ratio } = limitingOf(eq, n)
        expect(ratio).toBeGreaterThanOrEqual(1.2 - 1e-9)
        const L = eq.left[i]!
        expect(String(b.values.limit)).toBe(L.f)
        const shown = L.f === 'HCl' || L.f === 'H2SO4' ? 'The acid' : cap(Object.keys(NAME).find((k) => NAME[k] === L.f)!)
        expect(b.question.solution, b.seed).toContain(`${shown} is **limiting**`)
        const product = String(b.values.context).split(':').at(-1)!
        const P = eq.right.find((t) => t.f === product)!
        const p = clean((n[i]! * P.n) / L.n)
        expect(answer(b), b.seed).toBe(asMass ? clean(p * mr(product)) : p)
        if (asMass) expect(b.question.solution).toContain(`$${show(p)} \\times ${show(mr(product))} = $`)
        expect(Object.values(masses).some((m) => tenfold(answer(b), m) || near(answer(b), 2 * m) || near(2 * answer(b), m))).toBe(false)
      }
      expect(contexts(built)).toBe(8)
    })

    it(`${slotId}: within every context each reactant runs out in 35–65% of builds, and the smaller mass is not a rule`, () => {
      const built = build(id, slotId, 2000)
      const by = new Map<unknown, Generated[]>()
      for (const b of built) by.set(b.values.context, [...(by.get(b.values.context) ?? []), b])
      for (const [context, group] of by) {
        const eq = equationIn(group[0]!.question.prompt)
        const firsts = group.filter((b) => b.values.limit === eq.left[0]!.f).length / group.length
        expect(firsts, String(context)).toBeGreaterThanOrEqual(0.35)
        expect(firsts, String(context)).toBeLessThanOrEqual(0.65)
      }
      const smaller = built.filter((b) => {
        const v = values(b)
        const eq = equationIn(b.question.prompt)
        return (v.m1! < v.m2! ? eq.left[0]!.f : eq.left[1]!.f) === String(b.values.limit)
      }).length
      expect(smaller / built.length).toBeLessThanOrEqual(0.75)
      // No amount is 0.1 or 0.01 mol, which makes the mass an Mr with the point moved.
      for (const b of built) expect(tenfold(values(b).n1!, 1) || tenfold(values(b).n2!, 1), b.seed).toBe(false)
    })
  }

  it('q12: the reactant asked about really is in excess, and what is left is its moles less the moles used', () => {
    const built = build('reacting-excess-left', 'q12')
    for (const b of built) {
      const eq = equationIn(b.question.prompt)
      expectBalanced(eq, b.seed)
      expectMassesRight(b.question.prompt, b.seed)
      const masses = massesIn(b.question.prompt)
      const n = eq.left.map((t) => clean(masses[t.f]! / mr(t.f))) as [number, number]
      const { i } = limitingOf(eq, n)
      const asked = String(b.values.context).split(':').at(-1)!
      const e = eq.left.findIndex((t) => t.f === asked)
      expect(e, b.seed).toBe(1 - i)
      const E = eq.left[e]!
      const L = eq.left[i]!
      const used = clean((n[i]! * E.n) / L.n)
      const left = clean(n[e]! - used)
      expect(left).toBeGreaterThan(0)
      expect(b.question.markScheme[0]!.description).toContain(`$${show(used)}$ mol`)
      expect(b.question.markScheme[1]!.description).toBe(`$${show(left)}$ mol left`)
      expect(b.question.solution).toContain(`$${show(n[e]!)} - ${show(used)} = ${show(left)}\\text{ mol}$`)
      expect(answer(b), b.seed).toBe(clean(left * mr(asked)))
      expect(b.question.solution).toContain(`${show(left)} \\times ${show(mr(asked))} = $`)
      expect(tenfold(answer(b), masses[asked]!) || tenfold(answer(b), masses[L.f]!)).toBe(false)
      // Never 0.1 mol left, which makes the answer the Mr with the point moved (7.95 g of CuO).
      expect(tenfold(left, 1), b.seed).toBe(false)
      expect(tenfold(answer(b), mr(asked)), b.seed).toBe(false)
      expect(tenfold(n[0]!, 1) || tenfold(n[1]!, 1), b.seed).toBe(false)
    }
    expect(contexts(built)).toBe(6)
  })

  it('q13: the masses printed fit the equation, balance, and give the balancing number asked for', () => {
    const built = build('reacting-balancing-from-masses', 'q13')
    for (const b of built) {
      const eqText = String(b.values.context)
      const [l, r] = eqText.split(' -> ')
      const side = (s: string) => s.split(' + ').map((t) => ({ n: Number(/^\d*/.exec(t)![0] || 1), f: t.replace(/^\d+/, '') }))
      const eq = { left: side(l!), right: side(r!) }
      expectBalanced(eq, b.seed)
      const nums = [...b.question.prompt.matchAll(/(\d+(?:\.\d+)?) g of/g)].map((m) => Number(m[1]))
      expect(nums).toHaveLength(3)
      // Mass is conserved: the product's mass is the two reactants' together.
      expect(clean(nums[0]! + nums[1]!)).toBe(nums[2])
      const n = eq.left.map((t, j) => nums[j]! / mr(t.f))
      expect(near(n[0]! / eq.left[0]!.n, n[1]! / eq.left[1]!.n), b.seed).toBe(true)
      const asked = /balancing number of ([a-z]+)/.exec(b.question.prompt)![1]!
      const t = eq.left.find((x) => x.f === NAME[asked])!
      expect(answer(b)).toBe(t.n)
      // Moles exact to 0.01 mol, as a student rounds them, so the rounded ratio is the true one.
      for (const x of n) {
        expect(decimals(clean(x)), b.seed).toBeLessThanOrEqual(2)
        expect(tenfold(clean(x), 1), b.seed).toBe(false)
      }
      const rounded = n.map((x) => Math.round(x * 100) / 100)
      expect(near(rounded[0]! / eq.left[0]!.n, rounded[1]! / eq.left[1]!.n), b.seed).toBe(true)
      // No mass printed is the answer ("form 2 g of magnesium oxide", answer 2).
      for (const m of nums) expect(tenfold(m, answer(b)), b.seed).toBe(false)
      // Only reactions that go to completion: never the reversible Haber reaction.
      expect(eqText).not.toContain('NH3')
      // The bracket gives the Ar of each element, as the written one does.
      for (const m of /\(Ar: ([^)]*)\)/.exec(b.question.prompt)![1]!.matchAll(/([A-Z][a-z]?) = (\d+(?:\.\d+)?)/g)) expect(Number(m[2])).toBe(mr(m[1]!))
      expect(b.question.markScheme[0]!.description).toBe(`converts both masses to moles: $${show(clean(n[0]!))}$ and $${show(clean(n[1]!))}$`)
    }
    expect(contexts(built)).toBe(8)
    // The balancing number is set by the reaction, so the spread is across reactions: 1 to 4, none over 40%.
    const counts = new Map<number, number>()
    for (const b of built) counts.set(answer(b), (counts.get(answer(b)) ?? 0) + 1)
    expect([...counts.keys()].sort()).toEqual([1, 2, 3, 4])
    for (const c of counts.values()) expect(c / built.length).toBeLessThanOrEqual(0.4)
  })
})

describe('spread across builds', () => {
  // q13's amounts are exact to 0.01 mol and the gases kept to a gas jar, which leaves the 2:3 and
  // 4:3 reactions three or four masses each: no mass over 40%, but fewer than ten.
  it('reacting-balancing-from-masses q13: within each context, no mass is over 40% of builds', () => {
    const { worst, fewest } = worstShare(build('reacting-balancing-from-masses', 'q13', 1000), (b) => values(b).m1)
    expect(worst).toBeLessThanOrEqual(0.4)
    expect(fewest).toBeGreaterThanOrEqual(3)
  })

  const slots: [string, string, (b: Generated) => unknown][] = [
    ['reacting-moles-from-mass', 'q2', answer],
    ['reacting-mass-from-moles', 'q4', answer],
    ['reacting-mass-of-product', 'q5', answer],
    ['reacting-mass-by-ratio', 'q8', answer],
    ['reacting-limiting-from-moles', 'q9', answer],
    ['reacting-limiting-moles-from-masses', 'q11', answer],
    ['reacting-excess-left', 'q12', answer],
    ['reacting-limiting-mass-from-masses', 'q15', answer],
    ['reacting-limiting-letters', 'q17', answer],
    // The inputs too: the first mass or amount in each prompt.
    ['reacting-limiting-moles-from-masses', 'q11', (b) => values(b).m1],
    ['reacting-limiting-mass-from-masses', 'q15', (b) => values(b).m2],
    ['reacting-limiting-from-moles', 'q9', (b) => values(b).n1],
  ]
  for (const [id, slot, key] of slots) {
    it(`${id} ${slot}: within each context, no value is over 40% of builds, and there are at least 10`, () => {
      const { worst, fewest } = worstShare(build(id, slot, 1000), key)
      expect(worst).toBeLessThanOrEqual(0.4)
      expect(fewest).toBeGreaterThanOrEqual(10)
    })
  }
})
