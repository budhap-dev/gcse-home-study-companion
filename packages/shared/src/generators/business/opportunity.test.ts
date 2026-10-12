import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { OPPORTUNITY, opportunityGenerators } from './opportunity.ts'

/**
 * Structural tests for the Topic 1.2 generators. Each reads the prompt's own figures back
 * (counts, pounds as printed, "£2 400 000") and works the answer from them alone, with no code
 * shared with the generator; checks every printed step, the routing, the named wrong routes
 * (dividing by the new value, percentage change for percentage points, a survey not divided by
 * its sample), the contexts' ranges, and that no answer, input or calculation takes over a slot.
 */
const TOPIC = 'spotting-a-business-opportunity'
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/business')
const bank = Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8')).questions)
const slotOf = (id: string) => bank.find((q) => q.id === id)!

function build(generatorId: string, slotId: string, count = 300, prefix = 'structure'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  return Array.from({ length: count }, (_, i) => generate(g, slotOf(slotId), `${prefix}-${i}`))
}

const GROUPED = String.raw`\d{1,3}(?: \d{3})+|\d+`
/** Every amount of money in a text, in order: £2 400 000 is 2400000. */
const pounds = (text: string) => [...text.matchAll(new RegExp(`£(${GROUPED})(?!\\.\\d)`, 'g'))].map((m) => Number(m[1]!.replace(/ /g, '')))
/** One count, by the words round it. */
const count = (text: string, re: RegExp) => Number(re.exec(text)![1]!.replace(/ /g, ''))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const methods = (b: Generated) => b.question.markScheme.slice(0, -1).map((l) => l.description)
const accepts = (b: Generated, typed: string) => mark(b.question, typed).correct
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9
/** The figure in maths as the pack prints it: 2\,400\,000 from five digits. */
const tex = (x: number) => (x >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : String(x))
/** Whether a printed figure, its point moved, is the answer (75 000 against 7.5). */
const readsOff = (a: number, figures: number[]) => figures.some((f) => [1, 10, 100, 1000, 10000, 100000, 1000000].some((k) => near(f / k, a)))

function share(built: Generated[], key: (b: Generated) => unknown) {
  const counts = new Map<unknown, number>()
  for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / built.length, distinct: counts.size }
}

const SLOTS: [string, string][] = [
  ['opportunity-survey-percentage', 'q5'],
  ['opportunity-market-share', 'q10'],
  ['opportunity-sample-size-points', 'q11'],
  ['opportunity-sales-percentage-increase', 'q28'],
  ['opportunity-survey-scaled-up', 'q29'],
  ['opportunity-market-share-change', 'q30'],
]

describe('every opportunity build', () => {
  it('cites market share as Appendix 2 market data, not an Appendix 3 formula', () => {
    const header = readFileSync(join(import.meta.dirname, 'opportunity.ts'), 'utf8').split('const TOPIC')[0]!
    expect(header).not.toContain('Appendix 3')
    expect(header).toContain('Appendix 2 "market data, including market share"')
  })

  it('has a generator for each numeric written slot, routed to its own builder', () => {
    expect(opportunityGenerators.flatMap((g) => g.replaces).sort()).toEqual(bank.filter((q) => q.type === 'numeric').map((q) => q.id).sort())
    for (const [id, slot] of SLOTS) expect(opportunityGenerators.find((g) => g.id === id)!.replaces).toEqual([slot])
    for (const g of opportunityGenerators) expect(() => g.build(() => 0.5, slotOf('q1'), 0)).toThrow(/no builder/)
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
        // Whole, or a half where the written answer is (7.5%, 2.5 points).
        expect(Number.isInteger(q.answer * (slotId === 'q10' || slotId === 'q30' ? 2 : 1)), b.seed).toBe(true)
        expect(q.markScheme.map((l) => l.code)).toEqual(slot.markScheme.map((l) => l.code))
        expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
        expect(q.prompt).not.toMatch(/\b1 percentage points|£\d+\.\d/)
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
        expect(accepts(b, `${a}${units === '%' ? '%' : ` ${units}`}`), `${b.seed} ${units}`).toBe(true)
        if (a >= 1000) expect(accepts(b, a.toLocaleString('en-GB'))).toBe(true)
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

  it('gives the written prompt in under 5% of builds and no prompt in over 5%; spreads answers and calculations', () => {
    for (const [id, slotId] of SLOTS) {
      const many = build(id, slotId, 1000, 'spread')
      expect(share(many, (b) => b.question.prompt).worst, id).toBeLessThan(0.05)
      expect(many.filter((b) => b.question.prompt === slotOf(slotId).prompt).length / many.length, id).toBeLessThan(0.05)
      const answers = share(many, answer)
      expect(answers.worst, `${id} answer`).toBeLessThanOrEqual(0.1)
      expect(answers.distinct, `${id} answers`).toBeGreaterThanOrEqual(10)
      expect(share(many, (b) => (b.question.prompt.match(new RegExp(GROUPED, 'g')) ?? []).join(',')).worst, `${id} calculation`).toBeLessThan(1 / 6)
      for (const [k, v] of Object.entries(many[0]!.values)) if (typeof v === 'number') expect(share(many, (b) => b.values[k]).worst, `${id} ${k}`).toBeLessThanOrEqual(0.4)
    }
  })
})

describe('market research data (1.2.2)', () => {
  it('q5: those who said yes over those asked, × 100', () => {
    const built = build('opportunity-survey-percentage', 'q5')
    for (const b of built) {
      const p = b.question.prompt
      const n = count(p, /(?:surveys|asks) (\d+) /)
      const k = count(p, /\. (\d+) say/)
      const c = OPPORTUNITY.SURVEYS.find((x) => x.name === b.values.context)!
      expect(answer(b)).toBe((k * 100) / n)
      expect(answer(b) >= c.percent[0] && answer(b) <= c.percent[1]).toBe(true)
      expect([100, 30]).not.toContain(n)
      expect(answer(b)).not.toBe(50)
      expect(readsOff(answer(b), [n, k])).toBe(false)
      expect(methods(b)).toEqual([`$${k} \\div ${n}$`])
      expect(b.question.solution).toBe(`$\\dfrac{${k}}{${n}} \\times 100 = ${answer(b)}\\%$.`)
      for (const wrong of [(n * 100) / k, k / n, k]) expect(accepts(b, String(wrong))).toBe(false)
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(OPPORTUNITY.SURVEYS.length)
  })

  it('q11: the small sample less the large, in percentage points, not as a percentage change', () => {
    const built = build('opportunity-sample-size-points', 'q11')
    for (const b of built) {
      const p = b.question.prompt
      const n1 = count(p, /(?:surveys|asks) (\d+) people/)
      const k1 = count(p, /(?:and (\d+) say they would buy|, and (\d+) say yes)/.exec(p)![1] ? /and (\d+) say they would buy/ : /, and (\d+) say yes/)
      const n2 = count(p, new RegExp(`(?:then surveys|survey of) (${GROUPED}) people`))
      const k2 = count(p, new RegExp(`(${GROUPED}) (?:say they would\\.|who would\\.)`))
      const price = pounds(p)
      expect(price).toHaveLength(1)
      const p1 = (k1 * 100) / n1
      const p2 = (k2 * 100) / n2
      expect(answer(b)).toBe(p1 - p2)
      expect(Number.isInteger(p1) && Number.isInteger(p2)).toBe(true)
      expect(OPPORTUNITY.SMALL).toContain(n1)
      expect(OPPORTUNITY.LARGE).toContain(n2)
      expect(p1 >= 50 && p1 <= 95 && p2 >= 15).toBe(true)
      const o = OPPORTUNITY.OFFERS.find((x) => x.name === b.values.context)!
      expect(price[0]! >= o.price[0] && price[0]! <= o.price[1]).toBe(true)
      expect(p).toContain(o.offer)
      // Percentage change between the results, either share alone, the counts' difference.
      for (const wrong of [((p1 - p2) / p1) * 100, ((p1 - p2) / p2) * 100, p1, p2, Math.abs(k1 - k2)]) expect(near(wrong, answer(b)), b.seed).toBe(false)
      expect(readsOff(answer(b), [n1, k1, n2, k2, price[0]!])).toBe(false)
      // The percentage change rounded to a whole or to 1 d.p. is not the points answer (95% → 90%: 5.26).
      const change = ((p1 - p2) / p1) * 100
      for (const rounded of [Math.round(change), Math.round(change * 10) / 10]) {
        expect(rounded, b.seed).not.toBe(answer(b))
        expect(accepts(b, String(rounded))).toBe(false)
      }
      // The price plays no part, so it is never one of the counts (£10 with 10 saying yes).
      expect([n1, k1, n2, k2]).not.toContain(price[0])
      expect(methods(b)).toEqual([`$${k1} \\div ${n1} = ${p1}\\%$`, `$${k2} \\div ${n2} = ${p2}\\%$`, 'subtracting the two'])
      expect(b.question.solution).toContain(`$${p1} - ${p2} = ${answer(b)}$ percentage points`)
      expect(b.question.markScheme.at(-1)!.description).toBe(`${answer(b)} percentage points`)
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(OPPORTUNITY.OFFERS.length)
  })

  it('q29: the sample share applied to the town; forgetting to divide by the sample is marked wrong', () => {
    const built = build('opportunity-survey-scaled-up', 'q29')
    for (const b of built) {
      const p = b.question.prompt
      const n = count(p, /surveys (\d+) households/)
      const k = count(p, /and (\d+) say/)
      const town = count(p, new RegExp(`There are (${GROUPED}) households`))
      const pc = (k * 100) / n
      expect(answer(b)).toBe((k * town) / n)
      expect(Number.isInteger(pc)).toBe(true)
      expect([10, 50]).not.toContain(pc)
      const c = OPPORTUNITY.SCALED.find((x) => x.name === b.values.context)!
      expect(pc >= c.percent[0] && pc <= c.percent[1]).toBe(true)
      expect(OPPORTUNITY.TOWN_SAMPLES).toContain(n)
      expect(town >= 2000 && town <= 40000 && town !== 10000 && town % 500 === 0).toBe(true)
      expect(p).toMatch(/, assuming the sample is typical\.$/)
      // k × town (not divided by the sample), the percentage × town, the share alone.
      for (const wrong of [k * town, pc * town, pc, (n * town) / k]) expect(accepts(b, String(wrong))).toBe(false)
      expect(readsOff(answer(b), [n, k, town])).toBe(false)
      const dec = String(pc / 100)
      expect(methods(b)).toEqual([`$${k} \\div ${n} = ${pc}\\%$`, `$${dec} \\times ${tex(town)}$`])
      expect(b.question.solution).toContain(`$${dec} \\times ${tex(town)} = ${tex(answer(b))}$ households`)
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(OPPORTUNITY.SCALED.length)
  })

  it('q28: the rise in sales over the old sales, never over the new', () => {
    const built = build('opportunity-sales-percentage-increase', 'q28')
    for (const b of built) {
      const [before, after] = pounds(b.question.prompt) as [number, number]
      const rise = after - before
      const p = (rise * 100) / before
      expect(answer(b)).toBe(p)
      expect(p >= 8 && p <= 40).toBe(true)
      expect(rise % 10).toBe(0)
      const c = OPPORTUNITY.CHANGES.find((x) => x.name === b.values.context)!
      expect(before >= c.sales[0] && before <= c.sales[1]).toBe(true)
      expect(b.question.prompt).toContain(`a ${c.period}.`)
      // Over the new sales, rounded or not; the new as a percentage of the old; the rise itself.
      for (const wrong of [(rise / after) * 100, (after / before) * 100, rise]) expect(Math.abs(wrong - p)).toBeGreaterThan(0.5)
      expect(accepts(b, String(Math.round((rise / after) * 100)))).toBe(false)
      expect(readsOff(p, [before, after, rise])).toBe(false)
      expect(methods(b)).toEqual([`$\\dfrac{${tex(after)} - ${tex(before)}}{${tex(before)}} \\times 100$`])
      expect(b.question.solution).toContain(`\\times 100 = ${p}\\%$`)
      expect(b.question.solution).toContain(`informed is worth £${rise >= 10000 ? tex(rise).replace(/\\,/g, ' ') : rise} a ${c.period}.`)
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(OPPORTUNITY.CHANGES.length)
  })
})

describe('the competitive environment: market share (1.2.4)', () => {
  it('q10: sales over the market, × 100', () => {
    const built = build('opportunity-market-share', 'q10')
    for (const b of built) {
      const [m, sales] = pounds(b.question.prompt) as [number, number]
      const s = (sales * 100) / m
      expect(answer(b)).toBe(s)
      expect(s >= 2 && s <= 30).toBe(true)
      expect(sales % 1000).toBe(0)
      expect(Number.isInteger(Math.log10(m))).toBe(false)
      const c = OPPORTUNITY.SHARE_MARKETS.find((x) => x.name === b.values.context)!
      expect(m >= c.size[0] && m <= c.size[1]).toBe(true)
      expect(sales >= c.revenue[0] && sales <= c.revenue[1]).toBe(true)
      // The market over the sales, no × 100, the figures with the point moved.
      // The market over the sales, either way up with × 100: at a 10% share the wrong way up is 10 too.
      expect(s).not.toBe(10)
      for (const wrong of [(m * 100) / sales, sales / m, m / sales]) expect(accepts(b, String(wrong))).toBe(false)
      expect(readsOff(s, [m, sales])).toBe(false)
      expect(methods(b)).toEqual([`$${tex(sales)} \\div ${tex(m)}$`, '$\\times 100$'])
      expect(b.question.solution).toContain(`\\dfrac{${tex(sales)}}{${tex(m)}} \\times 100 = ${s}\\%$`)
      expect(b.question.markScheme.at(-1)!.description).toBe(`${s}%`)
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(OPPORTUNITY.SHARE_MARKETS.length)
    // Halves as written (7.5%) and whole shares both turn up.
    const halves = built.filter((b) => !Number.isInteger(answer(b))).length / built.length
    expect(halves > 0.3 && halves < 0.7).toBe(true)
  })

  it("q30: this year's share less last year's, not the revenue's percentage rise", () => {
    const built = build('opportunity-market-share-change', 'q30')
    for (const b of built) {
      const [m, r1, r2] = pounds(b.question.prompt) as [number, number, number]
      const s1 = (r1 * 100) / m
      const s2 = (r2 * 100) / m
      const d = s2 - s1
      expect(near(answer(b), d)).toBe(true)
      expect(Number.isInteger(s1 * 2) && Number.isInteger(s2 * 2)).toBe(true)
      expect(r1 >= 40000 && r1 % 1000 === 0 && r2 % 1000 === 0).toBe(true)
      expect(s2 <= 22 && d > 0 && s1 >= 2 * d).toBe(true)
      expect((r2 - r1) / r1).toBeLessThanOrEqual(0.5)
      const c = OPPORTUNITY.CHANGE_MARKETS.find((x) => x.name === b.values.context)!
      expect(m >= c.size[0] && m <= c.size[1]).toBe(true)
      for (const rev of [r1, r2]) expect(rev >= c.revenue[0] && rev <= c.revenue[1]).toBe(true)
      const rise = ((r2 - r1) / r1) * 100
      // The revenue's percentage rise, last year's share, this year's share.
      for (const wrong of [rise, s1, s2]) expect(near(wrong, d), b.seed).toBe(false)
      expect(accepts(b, String(Math.round(rise)))).toBe(false)
      expect(readsOff(d, [m, r1, r2])).toBe(false)
      expect(methods(b)).toEqual([`$${tex(r1)} \\div ${tex(m)} = ${s1}\\%$`, `$${tex(r2)} \\div ${tex(m)} = ${s2}\\%$`])
      const unit = d === 1 ? 'percentage point' : 'percentage points'
      expect(b.question.solution).toContain(`Change $= ${s2} - ${s1} = ${d}$ ${unit}.`)
      const exact = Number.isInteger(Math.round(rise * 1e6) / 1e5)
      expect(b.question.solution).toContain(`the revenue itself rose by ${exact ? `${Math.round(rise * 10) / 10}%` : `about ${Math.round(rise)}%`}.`)
      expect(b.question.markScheme.at(-1)!.description).toBe(`${d} ${unit}`)
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(OPPORTUNITY.CHANGE_MARKETS.length)
    // Every context allows the whole range of changes, so none is held to small ones.
    for (const c of OPPORTUNITY.CHANGE_MARKETS) expect(new Set(OPPORTUNITY.shifts(c).map((x) => x.d)).size, c.name).toBe(14)
    for (const c of OPPORTUNITY.SHARE_MARKETS) expect(new Set(OPPORTUNITY.shares(c).map((x) => x.share)).size, c.name).toBeGreaterThanOrEqual(40)
  })
})
