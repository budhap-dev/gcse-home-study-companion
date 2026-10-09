import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { clearOfHalf, roundTo, show } from '../format.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { dpTolerance } from '../physics/format.ts'
import { atoms, mr } from './build.ts'
import { ATOM_ECONOMY, yieldGenerators } from './yield.ts'

/**
 * Structural tests for the yield and atom economy generators. Each reads the prompt's own
 * figures and equation back, works the answer again from them alone, and checks every printed
 * step: the theoretical mass, the total Mr with its balancing numbers, the rounding. Across
 * builds they check the contexts rotate and no answer or input carries a context.
 */
const TOPIC = 'yield-and-atom-economy'
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
const tenfold = (a: number, b: number) => {
  const l = Math.log10(Math.abs(a / b))
  return Math.abs(l - Math.round(l)) < 1e-9
}
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context)).size
const noArticle = (prompt: string) => expect(prompt).not.toMatch(/\b(a|A|an|An) \d/)
const figures = (s: string) => [...s.matchAll(/(\d+(?:\.\d+)?)(?= ?(?:g|%))/g)].map((m) => Number(m[1]))

const SUB = '₀₁₂₃₄₅₆₇₈₉'
const unsub = (s: string) => s.replace(/[₀-₉]/g, (d) => String(SUB.indexOf(d)))
interface Term {
  n: number
  f: string
}
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
const atomCount = (terms: Term[]) => {
  const out: Record<string, number> = {}
  for (const t of terms) for (const [s, k] of Object.entries(atoms(t.f))) out[s] = (out[s] ?? 0) + k * t.n
  return out
}
/** The bracket of masses: every "X = n" is mr(X), and the formulae it names. */
function massesGiven(prompt: string, seed: string): string[] {
  const bracket = /\(((?:Ar|Mr)[^)]*(?:\([^)]*\)[^)]*)*)\)\s*$/.exec(prompt)
  expect(bracket, `${seed}: ${prompt}`).not.toBeNull()
  const out: string[] = []
  for (const m of bracket![1]!.matchAll(/([A-Za-z0-9₀-₉()]+) = (\d+(?:\.\d+)?)/g)) {
    expect(Number(m[2]), `${seed}: ${m[0]}`).toBe(mr(unsub(m[1]!)))
    out.push(unsub(m[1]!))
  }
  return out
}
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

describe('every yield and atom economy build', () => {
  it('has a generator for each numeric written slot, and nothing else', () => {
    expect(yieldGenerators.flatMap((g) => g.replaces).sort()).toEqual(['q1', 'q11', 'q12', 'q15', 'q17', 'q3', 'q5', 'q6', 'q8'].sort())
    for (const g of yieldGenerators) for (const id of g.replaces) expect(bank.find((q) => q.id === id)!.type).toBe('numeric')
  })

  it('prints no article before a figure, keeps the written units, and rounds as the rule says', () => {
    for (const g of yieldGenerators) {
      for (const id of g.replaces) {
        for (const b of build(g.id, id, 150)) {
          noArticle(b.question.prompt)
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
    for (const g of yieldGenerators) {
      for (const id of g.replaces) {
        const slot = bank.find((q) => q.id === id)!
        expect(() => {
          for (let i = 0; i < 3000; i++) generate(g, slot, `throw-${i}`)
        }, `${g.id} ${id}`).not.toThrow()
      }
    }
  })
})

describe('percentage yield', () => {
  it('q1 and q6: the mass collected over the theoretical mass printed, below 100%', () => {
    for (const slot of ['q1', 'q6']) {
      const built = build('yield-percentage', slot)
      for (const b of built) {
        const [T, A] = figures(b.question.prompt)
        expect(T, b.seed).toBe(values(b).T)
        expect(A, b.seed).toBe(values(b).A)
        expect(A!).toBeLessThan(T!)
        expect(answer(b)).toBe(clean((100 * A!) / T!))
        expect(Number.isInteger(answer(b))).toBe(true)
        expect(answer(b) >= 55 && answer(b) <= 96).toBe(true)
        expect(b.question.solution).toContain(`\\dfrac{${show(A!)}}{${show(T!)}} \\times 100 = $ **${answer(b)}%**`)
        // No figure a given with the point moved: 50 g of product made 80% look like 40 g.
        expect(tenfold(answer(b), T!) || tenfold(answer(b), A!) || tenfold(T!, 100)).toBe(false)
        if (slot === 'q6') expect(b.question.prompt).toContain('theoretical mass')
        else expect(b.question.prompt).toMatch(/should|expects/)
      }
      expect(contexts(built)).toBe(5)
      const { worst, fewest } = worstShare(build('yield-percentage', slot, 1000), answer)
      expect(worst).toBeLessThanOrEqual(0.4)
      expect(fewest).toBeGreaterThanOrEqual(10)
      expect(worstShare(build('yield-percentage', slot, 1000), (b) => values(b).T).worst).toBeLessThanOrEqual(0.4)
    }
  })

  it('q5: the theoretical mass from the reactant\'s mass, one to one in a balanced equation', () => {
    const built = build('yield-theoretical-mass', 'q5')
    for (const b of built) {
      const eq = equationIn(b.question.prompt)
      expect(atomCount(eq.left)).toEqual(atomCount(eq.right))
      const [from, to] = String(b.values.context).split('->') as [string, string]
      expect(eq.left.find((t) => t.f === from)!.n).toBe(eq.right.find((t) => t.f === to)!.n)
      expect(massesGiven(b.question.prompt, b.seed).sort()).toEqual([from, to].sort())
      const m = figures(b.question.prompt)[0]!
      expect(m).toBe(values(b).m)
      const n = clean(m / mr(from))
      expect(b.question.markScheme[0]!.description).toBe(`$${show(n)}$ mol of ${b.question.solution.split(' ')[2]}`)
      expect(answer(b)).toBe(clean(n * mr(to)))
      expect(b.question.solution).toContain(`\\dfrac{${show(m)}}{${show(mr(from))}} = ${show(n)}$`)
      expect(b.question.solution).toContain(`${show(n)} \\times ${show(mr(to))} = $`)
      expect(tenfold(n, 1)).toBe(false)
    }
    expect(contexts(built)).toBe(7)
    const { worst, fewest } = worstShare(build('yield-theoretical-mass', 'q5', 1000), answer)
    expect(worst).toBeLessThanOrEqual(0.4)
    expect(fewest).toBeGreaterThanOrEqual(10)
  })

  it('q12: the theoretical mass first, then the mass collected over it, to one decimal place', () => {
    const built = build('yield-from-reactant-mass', 'q12')
    for (const b of built) {
      const eq = equationIn(b.question.prompt)
      expect(atomCount(eq.left)).toEqual(atomCount(eq.right))
      const [from, to] = String(b.values.context).split('->') as [string, string]
      expect(to).not.toBe('CO2')
      massesGiven(b.question.prompt, b.seed)
      const m = values(b).m!
      const A = values(b).A!
      expect(b.question.prompt).toContain(`${show(m)} g of`)
      // The mass collected is printed to 0.1 g, with its 0: "9.0 g".
      expect(b.question.prompt).toContain(`${A.toFixed(1)} g of`)
      expect(b.question.prompt).toContain('to one decimal place')
      // A run that lost product cannot have gone to completion.
      expect(b.question.prompt).not.toMatch(/fully decomposed|completely/)
      expect(tenfold(A, mr(from)) || tenfold(A, mr(to)) || tenfold(m, mr(from)), b.seed).toBe(false)
      const T = clean((m / mr(from)) * mr(to))
      expect(b.question.markScheme[0]!.description).toBe(`theoretical mass $${show(T)}$ g`)
      expect(b.question.markScheme[1]!.description).toBe(`divides $${A.toFixed(1)}$ by $${show(T)}$`)
      const raw = (100 * A) / T
      expect(answer(b)).toBe(roundTo(raw, 1))
      expect(clearOfHalf(raw, 1)).toBe(true)
      // The answer box would print 80.0 as 80, so no answer rounds to a whole number.
      expect(Number.isInteger(answer(b))).toBe(false)
      expect(answer(b) > 55 && answer(b) < 97.5).toBe(true)
      expect(b.question.solution).toContain(`\\dfrac{${A.toFixed(1)}}{${show(T)}} \\times 100`)
    }
    expect(contexts(built)).toBe(6)
    const many = build('yield-from-reactant-mass', 'q12', 1000)
    for (const key of [answer, (b: Generated) => values(b).m, (b: Generated) => values(b).A]) {
      const { worst, fewest } = worstShare(many, key)
      expect(worst).toBeLessThanOrEqual(0.4)
      expect(fewest).toBeGreaterThanOrEqual(10)
    }
  })
})

describe('atom economy', () => {
  /** The wanted product and the reaction as the build names them. */
  const wanted = (b: Generated) => String(b.values.context).split(':').at(-1)!
  const sumMr = (terms: Term[]) => clean(terms.reduce((s, t) => s + t.n * mr(t.f), 0))

  it('every reaction in the lists balances, and makes more than one product where atom economy is asked', () => {
    for (const x of [...ATOM_ECONOMY.SIMPLE, ...ATOM_ECONOMY.WITH_NUMBERS, ...ATOM_ECONOMY.TOTALS]) {
      expect(atomCount(x.eq.left), x.eq.text).toEqual(atomCount(x.eq.right))
      for (const t of [...x.eq.left, ...x.eq.right]) expect(ATOM_ECONOMY.called(t.f)).toMatch(/[a-z]/)
    }
    for (const x of [...ATOM_ECONOMY.SIMPLE, ...ATOM_ECONOMY.WITH_NUMBERS]) expect(x.eq.right.length, x.eq.text).toBeGreaterThan(1)
    expect(ATOM_ECONOMY.SIMPLE.length).toBeGreaterThanOrEqual(30)
    expect(ATOM_ECONOMY.WITH_NUMBERS.length).toBeGreaterThanOrEqual(30)
    expect(ATOM_ECONOMY.TOTALS.length).toBeGreaterThanOrEqual(30)
  })

  for (const [id, slot] of [['yield-atom-economy-simple', 'q3'], ['yield-atom-economy', 'q11']] as const) {
    it(`${slot}: the wanted product's mass over the reactants' total, from the printed equation and Mr values`, () => {
      const built = build(id, slot)
      for (const b of built) {
        const eq = equationIn(b.question.prompt)
        expect(atomCount(eq.left), b.seed).toEqual(atomCount(eq.right))
        const w = wanted(b)
        const k = eq.right.find((t) => t.f === w)!.n
        // Every reactant and the wanted product have their Mr (or Ar) printed, and only those.
        expect(massesGiven(b.question.prompt, b.seed).sort()).toEqual([...new Set([w, ...eq.left.map((t) => t.f)])].sort())
        const top = clean(k * mr(w))
        const bottom = sumMr(eq.left)
        const raw = (100 * top) / bottom
        expect(raw).toBeLessThan(100)
        const exact = Math.abs(raw * 10 - Math.round(raw * 10)) < 1e-6
        expect(answer(b), b.seed).toBe(exact ? clean(raw) : roundTo(raw, 1))
        expect(b.question.prompt.includes('one decimal place')).toBe(slot === 'q11' || !exact)
        if (!exact) {
          expect(clearOfHalf(raw, 1)).toBe(true)
          expect(Number.isInteger(answer(b))).toBe(false)
        }
        expect(b.question.solution).toContain(`\\dfrac{${show(top)}}{`)
        // Never a given Mr with the point moved (calcium carbonate's 100 made 44% the Mr of CO2).
        for (const t of [...eq.left, { n: 1, f: w }]) expect(tenfold(answer(b), mr(t.f)), b.seed).toBe(false)
        // Nor any figure on the way, within the marking room: a student who forgets to divide
        // types the total (NaOH + HCl totals 76.5, and the answer for NaCl is 76.5%).
        for (const g of [bottom, top, ...eq.left.map((t) => mr(t.f)), mr(w)]) expect(Math.abs(answer(b) - g), `${b.seed}: ${g}`).toBeGreaterThan(tolerance(b))
        if (slot === 'q3') {
          expect(eq.left.every((t) => t.n === 1) && k === 1).toBe(true)
        } else {
          expect(eq.left.some((t) => t.n > 1) || k > 1).toBe(true)
          expect(b.question.markScheme[0]!.description).toBe(k > 1 ? `uses $${k} \\times ${show(mr(w))} = ${show(top)}$ for the ${ATOM_ECONOMY.called(w)}` : `uses $${show(mr(w))}$ for the ${ATOM_ECONOMY.called(w)}`)
          expect(b.question.markScheme[1]!.description).toBe(`total reactants $= ${show(bottom)}$`)
          expect(b.question.solution).toContain(`= ${show(bottom)}$.`)
        }
      }
      const all = slot === 'q3' ? ATOM_ECONOMY.SIMPLE : ATOM_ECONOMY.WITH_NUMBERS
      const many = build(id, slot, 1000)
      expect(contexts(many)).toBe(all.length)
      // The answer is set by the reaction, so the spread is across reactions.
      const counts = new Map<number, number>()
      for (const b of many) counts.set(answer(b), (counts.get(answer(b)) ?? 0) + 1)
      expect(counts.size).toBeGreaterThanOrEqual(25)
      for (const c of counts.values()) expect(c / many.length).toBeLessThanOrEqual(0.1)
    })
  }

  it('q8: each reactant\'s Mr times its balancing number, added', () => {
    const built = build('yield-total-mr-of-reactants', 'q8')
    for (const b of built) {
      const eq = equationIn(b.question.prompt)
      expect(atomCount(eq.left), b.seed).toEqual(atomCount(eq.right))
      expect(massesGiven(b.question.prompt, b.seed).sort()).toEqual(eq.left.map((t) => t.f).sort())
      const t = sumMr(eq.left)
      expect(answer(b)).toBe(t)
      // Mass is conserved: the products add up to the same.
      expect(sumMr(eq.right)).toBe(t)
      const multiples = eq.left.filter((x) => x.n > 1)
      expect(multiples.length).toBeGreaterThan(0)
      for (const x of multiples) {
        expect(b.question.markScheme[0]!.description).toContain(`$${x.n} \\times ${show(mr(x.f))}$ for the ${ATOM_ECONOMY.called(x.f)}`)
        expect(b.question.solution).toContain(`${x.n} \\times ${show(mr(x.f))}`)
      }
    }
    const many = build('yield-total-mr-of-reactants', 'q8', 1000)
    expect(contexts(many)).toBe(ATOM_ECONOMY.TOTALS.length)
    const counts = new Map<number, number>()
    for (const b of many) counts.set(answer(b), (counts.get(answer(b)) ?? 0) + 1)
    for (const c of counts.values()) expect(c / many.length).toBeLessThanOrEqual(0.1)
  })
})

describe('applying atom economy and yield to a mass of reactants', () => {
  it('q15: the atom economy of the reactants\' mass, the rest as by-products', () => {
    const built = build('yield-mass-from-atom-economy', 'q15')
    for (const b of built) {
      const AE = Number(/atom economy of (\d+)%/.exec(b.question.prompt)![1])
      const m = Number(/(\d+) g of reactants/.exec(b.question.prompt)![1])
      expect(b.question.prompt).toContain('100%')
      expect(AE).toBe(values(b).AE)
      expect(m).toBe(values(b).m)
      expect(answer(b)).toBe(clean((AE * m) / 100))
      expect(b.question.markScheme[0]!.description).toBe(`takes ${AE}% of ${m}`)
      expect(b.question.solution).toContain(`\\dfrac{${AE}}{100} \\times ${m} = $`)
      expect(b.question.solution).toContain(`remaining $${show(clean(m - answer(b)))}\\text{ g}$`)
      // 50% would make the product half the reactants, and 100 g would make it the percentage.
      expect(AE).not.toBe(50)
      expect(tenfold(m, 100)).toBe(false)
      expect(tenfold(answer(b), AE) || tenfold(answer(b), m) || near(2 * answer(b), m)).toBe(false)
    }
    expect(contexts(built)).toBe(3)
    const many = build('yield-mass-from-atom-economy', 'q15', 1000)
    for (const key of [answer, (b: Generated) => values(b).AE, (b: Generated) => values(b).m]) expect(worstShare(many, key).worst).toBeLessThanOrEqual(0.4)
    expect(worstShare(many, answer).fewest).toBeGreaterThanOrEqual(10)
  })

  it('q17: the atom economy gives the theoretical product, and the yield is applied to that', () => {
    const built = build('yield-atom-economy-and-yield', 'q17')
    for (const b of built) {
      const AE = Number(/atom economy (?:of|is) (\d+)%/.exec(b.question.prompt)![1])
      const Y = Number(/percentage yield (?:of|is) (\d+)%/.exec(b.question.prompt)![1])
      const m = Number(/(\d+) g of reactants/.exec(b.question.prompt)![1])
      const T = clean((AE * m) / 100)
      expect(b.question.markScheme[0]!.description).toBe(`theoretical product $${show(T)}$ g from the atom economy`)
      expect(b.question.markScheme[1]!.description).toBe(`applies the ${Y}% yield to $${show(T)}$ g`)
      expect(answer(b)).toBe(clean((Y * T) / 100))
      expect(b.question.solution).toContain(`\\dfrac{${AE}}{100} \\times ${m} = ${show(T)}\\text{ g}$`)
      expect(b.question.solution).toContain(`\\dfrac{${Y}}{100} \\times ${show(T)} = $`)
      expect(AE).not.toBe(Y)
      expect(Y).toBeLessThan(100)
      expect(tenfold(m, 100)).toBe(false)
      // Applying only one percentage gives a different number from the answer.
      expect(near(answer(b), T) || near(answer(b), clean((Y * m) / 100))).toBe(false)
      for (const g of [AE, Y, m, T]) expect(tenfold(answer(b), g)).toBe(false)
    }
    expect(contexts(built)).toBe(3)
    const many = build('yield-atom-economy-and-yield', 'q17', 1000)
    for (const key of [answer, (b: Generated) => values(b).AE, (b: Generated) => values(b).Y, (b: Generated) => values(b).m]) expect(worstShare(many, key).worst).toBeLessThanOrEqual(0.4)
    expect(worstShare(many, answer).fewest).toBeGreaterThanOrEqual(10)
  })
})
