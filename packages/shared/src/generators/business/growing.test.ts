import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { GROWING, growingGenerators } from './growing.ts'

/**
 * Structural tests for the Topic 2.1 generators. Each reads the prompt's own figures back
 * ("£1,600,000", "1 300 000", "£4.70") and works the answer from them alone, with no code shared
 * with the generator; checks every printed step against literal text, the routing, the named
 * wrong routes (growth over the new revenue, interest over the total repaid, the UK makers'
 * share, one internal source forgotten, the new shares over the old), the contexts' ranges, and
 * that no answer, input or calculation takes over a slot.
 */
const TOPIC = 'growing-the-business'
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/business')
const bank = Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8')).questions)
const slotOf = (id: string) => bank.find((q) => q.id === id)!

function build(generatorId: string, slotId: string, count = 300, prefix = 'structure'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  return Array.from({ length: count }, (_, i) => generate(g, slotOf(slotId), `${prefix}-${i}`))
}

const FIGURE = /(\d{1,3}(?:,\d{3})+|\d{1,3}(?: \d{3})+|\d+(?:\.\d+)?)/g
/** Every figure in a text, in order, as a number: "£1,600,000" is 1600000, "1 300 000" is 1300000. */
const figures = (text: string) => [...text.matchAll(FIGURE)].map((m) => Number(m[1]!.replace(/[, ]/g, '')))
/** Every amount of money in a text, in order. */
const pounds = (text: string) => [...text.matchAll(/£(\d{1,3}(?:,\d{3})+|\d{1,3}(?: \d{3})+|\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]!.replace(/[, ]/g, '')))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const methods = (b: Generated) => b.question.markScheme.slice(0, -1).map((l) => l.description)
const accepts = (b: Generated, typed: string) => mark(b.question, typed).correct
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9
/** As the comma-style questions print: 1,600,000; 900. */
const comma = (x: number) => x.toLocaleString('en-GB', { maximumFractionDigits: 2 })
/** Money as the comma-style questions print it: £4.70, £3, £1,600,000. */
const money = (x: number) => `£${Number.isInteger(x) ? comma(x) : x.toFixed(2)}`
/** A figure in maths as the space-style questions print it: 2\,400\,000 from five digits. */
const tex = (x: number) => (x >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : String(x))
/** In prose, space style: 50 150, 9000. */
const spaced = (x: number) => (x >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : String(x))
/** Whether a printed figure, its point moved, is the answer (75 000 against 7.5). */
const readsOff = (a: number, fs: number[]) => fs.some((f) => [1, 10, 100, 1000, 10000, 100000, 1000000].some((k) => near(f / k, a) || near(f * k, a)))
const within = (x: number, [lo, hi]: readonly [number, number]) => x >= lo && x <= hi
/** A wrong route as a student would type it: unrounded, whole, and to 1 d.p. */
const typed = (x: number) => [x, Math.round(x), Math.round(x * 10) / 10]

function share(built: Generated[], key: (b: Generated) => unknown) {
  const counts = new Map<unknown, number>()
  for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / built.length, distinct: counts.size }
}

const SLOTS: [string, string][] = [
  ['growing-retained-profit', 'q4'],
  ['growing-flotation-raised', 'q6'],
  ['growing-tariff', 'q9'],
  ['growing-revenue-growth', 'q11'],
  ['growing-finance-shortfall', 'q14'],
  ['growing-loan-interest', 'q25'],
  ['growing-import-share', 'q26'],
  ['growing-flotation-ownership', 'q27'],
]

describe('every growing build', () => {
  it('cites the spec: interest from Appendix 3, percentages and market share from Appendix 2', () => {
    const header = readFileSync(join(import.meta.dirname, 'growing.ts'), 'utf8').split('const TOPIC')[0]!
    const flat = header.replace(/\n \*\s*/g, ' ')
    expect(flat).toContain('Appendix 3 "Interest (on loans)"')
    expect(flat).toContain('Appendix 2 "market data, including market share"')
    expect(flat).toContain('Appendix 2 "percentages and percentage changes"')
    expect(flat).not.toMatch(/Appendix 3 "(?!Interest)/)
    for (const ref of ['2.1.1', '2.1.3']) expect(header).toContain(ref)
    expect(header).not.toMatch(/AQA/)
  })

  it('has a generator for each numeric written slot, routed to its own builder', () => {
    expect(growingGenerators.flatMap((g) => g.replaces).sort()).toEqual(bank.filter((q) => q.type === 'numeric').map((q) => q.id).sort())
    for (const [id, slot] of SLOTS) expect(growingGenerators.find((g) => g.id === id)!.replaces).toEqual([slot])
    for (const g of growingGenerators) expect(() => g.build(() => 0.5, slotOf('q1'), 0)).toThrow(/no builder/)
  })

  it("keeps the written slot's units, tolerance and mark-scheme codes; prints no article before a figure", () => {
    for (const [id, slotId] of SLOTS) {
      const slot = slotOf(slotId)
      for (const b of build(id, slotId, 150)) {
        const q = b.question
        expect(q.type).toBe('numeric')
        if (q.type !== 'numeric' || slot.type !== 'numeric') continue
        expect(q.units).toBe(slot.units)
        expect(q.tolerance).toBe(0)
        expect(q.answer).toBeGreaterThan(0)
        expect(Number.isInteger(q.answer), b.seed).toBe(true)
        expect(q.markScheme.map((l) => l.code)).toEqual(slot.markScheme.map((l) => l.code))
        expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
        expect(b.check.agrees, b.seed).toBe(true)
      }
    }
  })

  it('is marked right typed plain, with its unit, and with a thousands separator', () => {
    for (const [id, slotId] of SLOTS) {
      const units = (slotOf(slotId) as { units?: string }).units!
      for (const b of build(id, slotId, 100)) {
        const a = answer(b)
        expect(accepts(b, String(a)), b.seed).toBe(true)
        expect(accepts(b, units === '£' ? `£${a}` : `${a}%`), `${b.seed} ${units}`).toBe(true)
        if (a >= 1000) {
          expect(accepts(b, a.toLocaleString('en-GB'))).toBe(true)
          expect(accepts(b, `£${a.toLocaleString('en-GB')}`)).toBe(true)
        }
        expect(accepts(b, String(a + 1))).toBe(false)
      }
    }
  })

  it('never fails to draw, over 3000 seeds per slot', () => {
    for (const [id, slotId] of SLOTS) {
      const g = GENERATORS.find((x) => x.id === id)!
      expect(() => {
        for (let i = 0; i < 3000; i++) {
          const q = generate(g, slotOf(slotId), `throw-${i}`).question
          if (q.type !== 'numeric' || !Number.isFinite(q.answer) || /NaN|undefined/.test(q.prompt)) throw new Error(`throw-${i}: ${q.prompt}`)
        }
      }, id).not.toThrow()
    }
  })

  it('gives the written prompt in under 5% of builds and no prompt in over 5%; spreads answers, inputs and calculations', () => {
    for (const [id, slotId] of SLOTS) {
      const many = build(id, slotId, 1000, 'spread')
      expect(share(many, (b) => b.question.prompt).worst, id).toBeLessThan(0.05)
      expect(many.filter((b) => b.question.prompt === slotOf(slotId).prompt).length / many.length, id).toBeLessThan(0.05)
      const answers = share(many, answer)
      expect(answers.worst, `${id} answer`).toBeLessThanOrEqual(0.1)
      expect(answers.distinct, `${id} answers`).toBeGreaterThanOrEqual(10)
      expect(share(many, (b) => figures(b.question.prompt).join(',')).worst, `${id} calculation`).toBeLessThan(1 / 6)
      for (const k of Object.keys(many[0]!.values)) expect(share(many, (b) => b.values[k]).worst, `${id} ${k}`).toBeLessThanOrEqual(0.4)
    }
  })
})

describe('sources of finance (2.1.1)', () => {
  it('q4: profit after tax less dividends; adding them, or giving the dividends, is wrong', () => {
    const built = build('growing-retained-profit', 'q4')
    for (const b of built) {
      const [P, D] = pounds(b.question.prompt) as [number, number]
      const R = P - D
      expect(answer(b)).toBe(R)
      const c = GROWING.COMPANIES.find((x) => x.name === b.values.context)!
      expect(within(P, c.profit)).toBe(true)
      expect(b.question.prompt.toLowerCase()).toContain(c.who)
      const payout = (D * 100) / P
      expect(payout >= 20 && payout <= 75 && payout !== 50 && Number.isInteger(payout)).toBe(true)
      expect(D % 1000).toBe(0)
      for (const wrong of [P + D, D, P]) expect(accepts(b, String(wrong))).toBe(false)
      expect(readsOff(R, [P, D])).toBe(false)
      expect(b.question.solution.startsWith(`${money(P)} − ${money(D)} = **${money(R)}**.`)).toBe(true)
      expect(b.question.markScheme).toEqual([{ code: 'B1', marks: 1, description: String(R) }])
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(GROWING.COMPANIES.length)
  })

  it('q6: shares times the price per share, a small flotation', () => {
    const built = build('growing-flotation-raised', 'q6')
    for (const b of built) {
      const p = b.question.prompt
      const n = Number(/(?:floats|sells) ([\d,]+) shares/.exec(p)![1]!.replace(/,/g, ''))
      const price = Number(/at £(\d+(?:\.\d\d)?) each/.exec(p)![1])
      const pence = Math.round(price * 100)
      expect(answer(b)).toBe((n * pence) / 100)
      expect(n >= 1000000 && n <= 8000000 && n % 250000 === 0).toBe(true)
      expect(pence >= 50 && pence <= 400 && pence !== 100 && pence % 5 === 0).toBe(true)
      // Pence print as the written £1.75 does; a whole price as £3.
      expect(p).toContain(`at ${money(price)} each`)
      expect(accepts(b, String(n / price))).toBe(false)
      expect(answer(b)).toBeLessThanOrEqual(32000000)
      // Fix 9: a flotation raises at least £2 million.
      expect(answer(b)).toBeGreaterThanOrEqual(2000000)
      expect(methods(b)).toEqual([`multiplies ${comma(n)} shares by ${money(price)} per share`])
      expect(b.question.solution.startsWith(`${comma(n)} × ${money(price)} = **${money(answer(b))}**.`)).toBe(true)
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(GROWING.FLOATERS.length)
  })

  it('q14: the cost less both internal sources; forgetting one, or giving their total, is wrong', () => {
    const built = build('growing-finance-shortfall', 'q14')
    for (const b of built) {
      const [C, R, A] = pounds(b.question.prompt) as [number, number, number]
      const I = R + A
      const S = C - I
      expect(answer(b)).toBe(S)
      const c = GROWING.PROJECTS.find((x) => x.name === b.values.context)!
      expect(within(C, c.cost)).toBe(true)
      expect(b.question.prompt).toContain(c.what)
      expect(S >= 0.25 * C && S <= 0.7 * C).toBe(true)
      expect(R >= 0.3 * I - 1e-6 && R <= 0.7 * I + 1e-6 && R !== A).toBe(true)
      for (const wrong of [C - R, C - A, I, C - R + A, C - A + R, C]) expect(near(wrong, S), b.seed).toBe(false)
      expect(readsOff(S, [C, R, A, I])).toBe(false)
      expect(methods(b)).toEqual([`adds the two internal sources to get ${I}`, `subtracts from the cost of the ${c.short}`])
      expect(b.question.solution.startsWith(`Internal sources give ${money(R)} + ${money(A)} = ${money(I)}. The shortfall is ${money(C)} − ${money(I)} = **${money(S)}**.`)).toBe(true)
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(GROWING.PROJECTS.length)
    expect(new Set(built.map((b) => b.values.asset)).size).toBe(GROWING.ASSETS.length)
    // Fix 7: an asset fetches what such an asset could (old machinery never £2,370,000).
    const most: Record<string, number> = { 'its old machinery': 300000, 'an empty building': 2000000, 'some land it no longer needs': 3000000, 'an asset': Infinity }
    for (const b of build('growing-finance-shortfall', 'q14', 1000, 'assets')) {
      const [, , A] = pounds(b.question.prompt) as [number, number, number]
      expect(b.question.prompt).toContain(String(b.values.asset))
      expect(A, b.seed).toBeLessThanOrEqual(most[String(b.values.asset)]!)
    }
  })

  it('q25: interest over the amount borrowed, never over the total repaid', () => {
    const built = build('growing-loan-interest', 'q25')
    for (const b of built) {
      const [B, R] = pounds(b.question.prompt) as [number, number]
      const I = R - B
      const pct = (I * 100) / B
      expect(answer(b)).toBe(pct)
      expect(pct >= 8 && pct <= 35).toBe(true)
      // Fix 8: never 10%, where the interest is the loan with the point moved.
      expect(pct).not.toBe(10)
      const c = GROWING.PURPOSES.find((x) => x.name === b.values.context)!
      expect(within(B, c.loan)).toBe(true)
      expect(b.question.prompt.toLowerCase()).toContain(c.why)
      // Over the total repaid (rounded as typed), the repaid over the borrowed, the interest itself.
      for (const wrong of [...typed((I / R) * 100), (R / B) * 100, I]) expect(accepts(b, String(wrong)), `${b.seed} ${wrong}`).toBe(false)
      expect(readsOff(pct, [B, R, I])).toBe(false)
      expect(methods(b)).toEqual([`$(${tex(R)} - ${tex(B)}) \\div ${tex(B)} \\times 100$`])
      expect(b.question.solution).toContain(`= \\dfrac{${tex(R)} - ${tex(B)}}{${tex(B)}} \\times 100 = \\dfrac{${tex(I)}}{${tex(B)}} \\times 100 = ${pct}\\%$.`)
      expect(b.question.solution).toContain(`find the £${spaced(I)} of interest`)
      expect(b.question.markScheme.at(-1)!.description).toBe(`${pct}%`)
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(GROWING.PURPOSES.length)
  })

  it("q27: the founders' shares over all the shares after the issue, not the issue over the old", () => {
    const built = build('growing-flotation-ownership', 'q27')
    for (const b of built) {
      const p = b.question.prompt
      const [O, N] = figures(p) as [number, number]
      const price = pounds(p)[0]!
      const T = O + N
      const a = (O * 100) / T
      expect(answer(b)).toBe(a)
      expect(a >= 55 && a <= 90).toBe(true)
      // Fix 3: the total in whole millions, 2 to 36 million, never 10 million; holdings in ten thousands.
      expect(T % 1000000 === 0 && T >= 2000000 && T <= 36000000 && T !== 10000000).toBe(true)
      expect(O % 10000 === 0 && N % 10000 === 0 && N >= 250000).toBe(true)
      expect(price >= 0.5 && price <= 8).toBe(true)
      // Fix 9: the issue raises at least £2 million; fix 3: the price is never the answer with the point moved.
      expect(N * price).toBeGreaterThanOrEqual(2000000)
      expect(price * 10).not.toBe(a)
      // 100 less the issue as a share of the old (the written: 75 for 80), the issue over the
      // old, the new holders' share, the old over the issue: none pays, rounded or not.
      for (const wrong of [100 - (N / O) * 100, (N / O) * 100, (N / T) * 100, (O / N) * 100]) for (const t of typed(wrong)) expect(accepts(b, String(t)), `${b.seed} ${t}`).toBe(false)
      expect(readsOff(a, [O, N, T, price])).toBe(false)
      expect(methods(b)).toEqual([`total shares $${tex(O)} + ${tex(N)} = ${tex(T)}$`, `$${tex(O)} \\div ${tex(T)} \\times 100$`])
      expect(b.question.solution).toContain(`\\dfrac{${tex(O)}}{${tex(T)}} \\times 100 = ${a}\\%$`)
      expect(b.question.solution).toContain(`$${tex(N)} \\times ${money(price).slice(1)} = £${tex(Math.round(N * price))}$ of share capital`)
      expect(b.question.solution).toContain(`an issue of more than ${spaced(O)} new shares would leave`)
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(GROWING.OWNERS.length)
    expect(new Set(GROWING.issues().map((x) => x.a)).size).toBe(36)
    // Fix 3: at least three calculations for every answer, and no total in over 10% of builds.
    for (let a = 55; a <= 90; a++) expect(GROWING.issues().filter((x) => x.a === a).length, `${a}`).toBeGreaterThanOrEqual(3)
    const many = build('growing-flotation-ownership', 'q27', 1000, 'totals')
    const totals = new Map<number, number>()
    for (const b of many) {
      const [O, N] = figures(b.question.prompt) as [number, number]
      totals.set(O + N, (totals.get(O + N) ?? 0) + 1)
    }
    expect(Math.max(...totals.values()) / many.length).toBeLessThanOrEqual(0.1)
  })
})

describe('business growth and globalisation (2.1.1, 2.1.3)', () => {
  it('q9: the rate of the value, not the landed cost', () => {
    const built = build('growing-tariff', 'q9')
    for (const b of built) {
      const V = pounds(b.question.prompt)[0]!
      const rate = Number(/tariff of (\d+)%/.exec(b.question.prompt)![1])
      const T = (V * rate) / 100
      expect(answer(b)).toBe(T)
      expect(rate >= 2 && rate <= 25 && rate !== 10).toBe(true)
      const c = GROWING.EXPORTS.find((x) => x.name === b.values.context)!
      expect(within(V, c.value)).toBe(true)
      // The landed cost, the value times the rate unscaled, the value over the rate.
      for (const wrong of [V + T, V * rate, V / rate]) expect(accepts(b, String(wrong))).toBe(false)
      expect(T).not.toBe(rate)
      expect(readsOff(T, [V, V + T])).toBe(false)
      expect(methods(b)).toEqual([`finds ${rate}% of ${comma(V)}`])
      expect(b.question.solution.startsWith(`${money(V)} × ${rate / 100} = **${money(T)}**, taking the landed cost to ${money(V + T)}.`)).toBe(true)
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(GROWING.EXPORTS.length)
  })

  it('q11: the increase over the original revenue, never over the new', () => {
    const built = build('growing-revenue-growth', 'q11')
    for (const b of built) {
      const [R1, R2] = pounds(b.question.prompt) as [number, number]
      const inc = R2 - R1
      const p = (inc * 100) / R1
      expect(answer(b)).toBe(p)
      expect(p >= 8 && p <= 60 && p !== 10 && p !== 50).toBe(true)
      expect(inc % 1000).toBe(0)
      const c = GROWING.GROWERS.find((x) => x.name === b.values.context)!
      expect(within(R1, c.revenue)).toBe(true)
      for (const wrong of [...typed((inc / R2) * 100), (R2 / R1) * 100, inc]) expect(accepts(b, String(wrong)), `${b.seed} ${wrong}`).toBe(false)
      expect(readsOff(p, [R1, R2, inc])).toBe(false)
      expect(methods(b)).toEqual([`finds the increase of ${inc}`, `divides by the original revenue of ${R1}`])
      expect(b.question.solution.startsWith(`Increase = ${money(R2)} − ${money(R1)} = ${money(inc)}. Percentage = ${money(inc)} ÷ ${money(R1)} × 100 = **${p}%**.`)).toBe(true)
      expect(b.question.markScheme.at(-1)!.description).toBe(String(p))
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(GROWING.GROWERS.length)
  })

  it("q26: overseas sales over the UK market; the UK makers' share never pays", () => {
    const built = build('growing-import-share', 'q26')
    for (const b of built) {
      const [M, O] = figures(b.question.prompt) as [number, number]
      const p = (O * 100) / M
      expect(answer(b)).toBe(p)
      expect(p).not.toBe(50)
      expect(p).not.toBe(10)
      const c = GROWING.IMPORTS.find((x) => x.name === b.values.context)!
      expect(within(M, c.market) && within(p, c.share)).toBe(true)
      expect(b.question.prompt).toContain(` ${c.item} `)
      for (const wrong of [100 - p, ...typed((M / O) * 100), ...typed((O / (M - O)) * 100)]) expect(accepts(b, String(wrong)), `${b.seed} ${wrong}`).toBe(false)
      expect(readsOff(p, [M, O])).toBe(false)
      expect(methods(b)).toEqual([`$${tex(O)} \\div ${tex(M)} \\times 100$`])
      expect(b.question.solution).toContain(`$= \\dfrac{${tex(O)}}{${tex(M)}} \\times 100 = ${p / 100} \\times 100 = ${p}\\%$.`)
      expect(b.question.solution).toContain(`${p} in every 100 ${c.item} sold in the UK`)
      expect(b.question.solution).toContain(`to hold the other ${100 - p}%.`)
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(GROWING.IMPORTS.length)
  })
})
