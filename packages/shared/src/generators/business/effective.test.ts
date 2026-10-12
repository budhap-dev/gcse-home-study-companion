import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { numericDraft } from './build.ts'
import { EFFECTIVE, effectiveGenerators } from './effective.ts'

/**
 * Structural tests for the 1.4 generators. Each reads the prompt's figures back with its own
 * parsing, works the answer again from them alone, checks literal lines of the working and the
 * mark scheme, that the named wrong routes are marked wrong, and the spread over builds.
 */
const TOPIC = 'making-the-business-effective'
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/business')
const bank = Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8')).questions)
const written = (id: string) => bank.find((q) => q.id === id)!

function build(generatorId: string, slotId: string, count = 300, prefix = 'structure'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  return Array.from({ length: count }, (_, i) => generate(g, written(slotId), `${prefix}-${i}`))
}

const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const lines = (b: Generated) => b.question.markScheme.map((l) => `${l.code} ${l.description}`)
/** A printed figure as a number: £24 000, 2,000, 7.5. */
const read = (s: string) => Number(s.replace(/[£,\s]/g, ''))
/** Thousands as the written questions print them in prose, from five digits: 24 000. Written here, not imported. */
const prose = (x: number) => (x >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : String(x))
const maths = (x: number) => prose(x).replace(/ /g, '\\,')
const comma = (x: number) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

function share(built: Generated[], key: (b: Generated) => unknown) {
  const counts = new Map<unknown, number>()
  for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / built.length, distinct: counts.size }
}

/** The answer typed as a student might: plain, with £, with its thousands separated. */
function marksEveryTyping(b: Generated, unit = '£') {
  const a = answer(b)
  const typed = [String(a), `${unit}${a}`, comma(a), `${unit}${comma(a)}`, prose(a), `${unit}${prose(a)}`]
  for (const t of typed) expect(mark(b.question, t).correct, `${b.seed}: ${t}`).toBe(true)
}

describe('every 1.4 build', () => {
  it('has one generator for each numeric written slot', () => {
    expect(effectiveGenerators.flatMap((g) => g.replaces).sort()).toEqual(['q31', 'q32', 'q33'])
    expect(bank.filter((q) => q.type === 'numeric').map((q) => q.id).sort()).toEqual(['q31', 'q32', 'q33'])
    for (const g of effectiveGenerators) expect(g.subjectId).toBe('business')
  })

  it('keeps each slot\'s units and exact tolerance, prints no article before a figure, and never fails to draw over 3000 seeds', () => {
    for (const g of effectiveGenerators) {
      for (const id of g.replaces) {
        const slot = written(id)
        for (let i = 0; i < 3000; i++) {
          const b = generate(g, slot, `throw-${i}`)
          if (i >= 300) continue
          const q = b.question
          expect(q.type).toBe('numeric')
          if (q.type !== 'numeric' || slot.type !== 'numeric') continue
          expect(q.units).toBe(slot.units)
          expect(q.tolerance).toBe(0)
          expect(Number.isInteger(q.answer)).toBe(true)
          expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
          expect(q.markScheme.map((l) => l.code)).toEqual(slot.markScheme.map((l) => l.code))
          expect(mark(q, String(q.answer + 1)).correct).toBe(false)
        }
      }
    }
  })

  it('repeats no prompt in a tenth of 1000 builds and the written one in at most a twentieth', () => {
    for (const g of effectiveGenerators) {
      for (const id of g.replaces) {
        const built = build(g.id, id, 1000, 'release')
        const counts = new Map<string, number>()
        for (const b of built) counts.set(b.question.prompt, (counts.get(b.question.prompt) ?? 0) + 1)
        expect(Math.max(...counts.values())).toBeLessThanOrEqual(100)
        expect(counts.get(written(id).prompt) ?? 0).toBeLessThanOrEqual(50)
      }
    }
  })
})

describe('q31: a franchise royalty', () => {
  const built = build('business-franchise-royalty', 'q31')

  it('reads the rate and revenue back and finds the royalty from them alone', () => {
    for (const b of built) {
      const p = b.question.prompt
      const rate = Number(/(\d+(?:\.\d+)?)% of its revenue/.exec(p)![1])
      const R = read(/revenue (?:was|in its \w+ year of trading was) (£[\d ]+)\./.exec(p)![1]!)
      const royalty = Math.round((rate * R) / 100)
      expect(answer(b), b.seed).toBe(royalty)
      expect(Math.abs((rate * R) / 100 - royalty)).toBeLessThan(1e-6)
      // Real franchise royalties, 4% to 12%, never 10%; a year's revenue an outlet could take.
      expect(rate >= 4 && rate <= 12 && rate !== 10).toBe(true)
      expect(R >= 50000 && R <= 700000 && R % 5000 === 0).toBe(true)
      expect(b.question.solution).toContain(`Royalty $= ${rate}\\% \\times ${maths(R)} = ${rate / 100} \\times ${maths(R)} = £${maths(royalty)}$.`)
      expect(lines(b)).toEqual([`M1 $${rate / 100} \\times ${maths(R)}$`, `A1 £${prose(royalty)}`])
      // Wrong routes: the percentage not divided by 100; 0.8 for 8%; revenue ÷ rate.
      for (const wrong of [rate * R, (rate / 10) * R, R / rate]) expect(mark(b.question, String(wrong)).correct).toBe(false)
      marksEveryTyping(b)
    }
  })

  it('spreads its answers and inputs', () => {
    const many = build('business-franchise-royalty', 'q31', 1000)
    expect(share(many, answer).worst).toBeLessThanOrEqual(0.4)
    expect(share(many, answer).distinct).toBeGreaterThanOrEqual(10)
    for (const k of ['rate', 'revenue', 'context', 'year']) expect(share(many, (b) => b.values[k]).worst, k).toBeLessThanOrEqual(0.4)
    expect(share(many, (b) => b.values.context).distinct).toBe(EFFECTIVE.FRANCHISES.length)
  })
})

describe('q32: break-even in a business plan', () => {
  const built = build('business-plan-break-even', 'q32')

  it('reads fixed costs, price and variable cost back and finds the break-even output', () => {
    for (const b of built) {
      const p = b.question.prompt
      const F = read(/fixed costs of (£[\d ]+)/.exec(p)![1]!)
      const P = read(/(?:sell for|selling price of|each candle for) (£\d+)/.exec(p)![1]!)
      const V = read(/(?:variable cost will be|variable cost of|will cost) (£\d+)/.exec(p)![1]!)
      const C = P - V
      const B = F / C
      expect(answer(b), b.seed).toBe(B)
      expect(Number.isInteger(B)).toBe(true)
      // A candle at £8 to £40, its materials 30% to 70% of the price; a new maker's year.
      expect(P >= 8 && P <= 40).toBe(true)
      expect(V / P >= 0.3 && V / P <= 0.7).toBe(true)
      expect(B >= 300 && B <= 5000 && F >= 5000 && F <= 60000).toBe(true)
      expect(b.question.solution).toContain(`= \\dfrac{${maths(F)}}{${P} - ${V}} = \\dfrac{${maths(F)}}{${C}} = ${B}$ candles.`)
      expect(b.question.solution).toContain(`every candle adds £${C} towards profit`)
      expect(lines(b)).toEqual([`M1 $${P} - ${V} = ${C}$`, `M1 $${maths(F)} \\div ${C}$`, `A1 ${B} candles`])
      // Wrong routes: fixed ÷ price; fixed ÷ variable cost; fixed ÷ (price + variable cost).
      for (const wrong of [F / P, F / V, F / (P + V)]) {
        expect(Math.abs(wrong - B), b.seed).toBeGreaterThan(0.5)
        expect(mark(b.question, String(Math.round(wrong))).correct).toBe(false)
      }
      expect([P, V, C]).not.toContain(B)
      for (const t of [String(B), `${B} candles`, comma(B)]) expect(mark(b.question, t).correct, t).toBe(true)
    }
  })

  it('spreads its answers and inputs', () => {
    const many = build('business-plan-break-even', 'q32', 1000)
    expect(share(many, answer).worst).toBeLessThanOrEqual(0.4)
    expect(share(many, answer).distinct).toBeGreaterThanOrEqual(10)
    for (const k of ['fixed', 'price', 'variable', 'contribution']) expect(share(many, (b) => b.values[k]).worst, k).toBeLessThanOrEqual(0.4)
  })
})

describe('q33: two locations compared by profit', () => {
  const built = build('business-location-profit', 'q33')

  it('reads both sites back and finds the difference in profit, the right way round', () => {
    for (const b of built) {
      const p = b.question.prompt
      const rents = [...p.matchAll(/rent (?:of|would be) (£[\d ]+) a month/g)].map((m) => read(m[1]!))
      const sales = [...p.matchAll(/(?:sell|carry out) ([\d ]+) \w+ a month/g)].map((m) => read(m[1]!))
      const each = /(?:sells for|charged at) (£\d+) and (?:its \w+ cost|uses products costing) (£\d+)/.exec(p)!
      const [P, V] = [read(each[1]!), read(each[2]!)]
      expect(rents).toHaveLength(2)
      expect(sales).toHaveLength(2)
      const [R1, R2] = rents as [number, number]
      const [Q1, Q2] = sales as [number, number]
      const town = Q1 * P - Q1 * V - R1
      const out = Q2 * P - Q2 * V - R2
      const townFirst = /(?:town-centre unit is expected to make than|in the town centre than)/.test(p)
      expect(townFirst).toBe(b.values.townBetter === 'town')
      const D = townFirst ? town - out : out - town
      expect(answer(b), b.seed).toBe(D)
      expect(D).toBeGreaterThan(0)
      // Each site in profit; the town centre busier and dearer; the price above the cost.
      expect(town >= EFFECTIVE.MIN_PROFIT && out >= EFFECTIVE.MIN_PROFIT).toBe(true)
      expect(Q1 > Q2 && R1 > R2 && P > V && P !== 2 * V).toBe(true)
      expect(D >= EFFECTIVE.ANSWER[0] && D <= EFFECTIVE.ANSWER[1]).toBe(true)
      const s = b.question.solution
      expect(s).toContain(`profit $= ${maths(Q1 * P)} - ${maths(Q1 * V)} - ${maths(R1)} = £${maths(town)}$.`)
      expect(s).toContain(`profit $= ${maths(Q2 * P)} - ${maths(Q2 * V)} - ${maths(R2)} = £${maths(out)}$.`)
      expect(s).toContain(`Difference $= ${maths(Math.max(town, out))} - ${maths(Math.min(town, out))} = £${maths(D)}$ a month more ${townFirst ? 'in the town centre' : 'out of town'}.`)
      expect(lines(b)).toEqual([
        `M1 town-centre profit $${maths(Q1 * P)} - ${maths(Q1 * V)} - ${maths(R1)} = ${maths(town)}$`,
        `M1 out-of-town profit $${maths(Q2 * P)} - ${maths(Q2 * V)} - ${maths(R2)} = ${maths(out)}$`,
        `A1 £${prose(D)}`,
      ])
      // Wrong routes: rent forgotten; costs per item forgotten; revenue alone; rent added; rent
      // difference alone; the other site's profit; either profit on its own.
      const dQ = Q1 - Q2
      const dR = R1 - R2
      const wrong = [dQ * (P - V), Math.abs(dQ * P - dR), dQ * P, dQ * (P - V) + dR, dR, town, out, P, V, Q1, Q2, R1, R2]
      for (const w of wrong) expect(w, `${b.seed}: ${w}`).not.toBe(D)
      expect(mark(b.question, String(-D)).correct).toBe(false)
      marksEveryTyping(b)
    }
  })

  it('makes either site the better one about half the time, and spreads answers and inputs in each case', () => {
    const many = build('business-location-profit', 'q33', 1000)
    const town = many.filter((b) => b.values.townBetter === 'town').length / many.length
    expect(town).toBeGreaterThan(0.4)
    expect(town).toBeLessThan(0.6)
    for (const side of ['town', 'out']) {
      const group = many.filter((b) => b.values.townBetter === side)
      expect(share(group, answer).worst, side).toBeLessThanOrEqual(0.1)
      expect(share(group, answer).distinct, side).toBeGreaterThanOrEqual(10)
    }
    for (const k of ['context', 'price', 'cost', 'townSales', 'outSales', 'townRent', 'outRent']) expect(share(many, (b) => b.values[k]).worst, k).toBeLessThanOrEqual(0.4)
    expect(share(many, (b) => b.values.context).distinct).toBe(EFFECTIVE.SHOPS.length)
    // Per business: a cost of at least £2 an item (the sandwich bar sat at £1 in every build, with
    // 40 answers), and answers mostly distinct: each business gets about 180 of the 1000 builds,
    // at least 90 and two in five of them different answers (measured floor 93, the sandwich bar).
    for (const s of EFFECTIVE.SHOPS) {
      const group = many.filter((b) => b.values.context === s.name)
      expect(Math.min(...group.map((b) => Number(b.values.cost))), s.name).toBeGreaterThanOrEqual(2)
      expect(share(group, answer).distinct, s.name).toBeGreaterThanOrEqual(Math.max(90, group.length * 0.4))
      expect(share(group, answer).worst, s.name).toBeLessThanOrEqual(0.05)
      expect(share(group, (b) => b.values.cost).worst, s.name).toBeLessThanOrEqual(0.4)
    }
    expect(EFFECTIVE.SHOPS.find((s) => s.name === 'sandwich bar')!.price).toEqual([5, 9])
  })
})

describe('tolerance', () => {
  it('defaults to the written slot\'s own tolerance when a builder gives none', () => {
    const slot = { ...written('q31'), tolerance: 0.01 } as typeof bank[number]
    const d = numericDraft(slot, { prompt: 'p', solution: 's 4.36', method: ['m'], answer: 4.36, line: '£4.36' }, { agrees: true, detail: '' }, {})
    expect(d.question.type === 'numeric' && d.question.tolerance).toBe(0.01)
    const exact = numericDraft(written('q31'), { prompt: 'p', solution: 's 4', method: ['m'], answer: 4, line: '£4' }, { agrees: true, detail: '' }, {})
    expect(exact.question.type === 'numeric' && exact.question.tolerance).toBe(0)
  })

  it('is exact on every slot, as written', () => {
    for (const [g, id] of [['business-franchise-royalty', 'q31'], ['business-plan-break-even', 'q32'], ['business-location-profit', 'q33']] as const) {
      for (const b of build(g, id, 50)) expect(tolerance(b)).toBe(0)
    }
  })
})
