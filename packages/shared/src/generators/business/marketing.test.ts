import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate, sheetQuestions } from '../index.ts'
import type { Generated } from '../types.ts'
import { MARKETING, marketingGenerators } from './marketing.ts'

/**
 * Structural tests for the Topic 2.2 generators. Each reads the prompt's own figures back with
 * its own parsing and works the answer from them alone, sharing no code with the generator;
 * checks literal lines of the working and the mark scheme, the routing, the named wrong routes,
 * each context's ranges, the spread over builds, and what each sheet prints beside them.
 */
const TOPIC = 'making-marketing-decisions'
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/business')
const json = JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8'))
const bank = Question.array().parse(json.questions)
const written = (id: string) => bank.find((q) => q.id === id)!
const sheet = (level: string) => (json.worksheets[level].questionIds as string[]).map(written)

function build(generatorId: string, slotId: string, count = 300, prefix = 'structure'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  return Array.from({ length: count }, (_, i) => generate(g, written(slotId), `${prefix}-${i}`))
}

const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const lines = (b: Generated) => b.question.markScheme.map((l) => `${l.code} ${l.description}`)
const accepts = (b: Generated, typed: string) => mark(b.question, typed).correct
/** Pence to two places, as the pack prints £8.00. */
const p2 = (x: number) => x.toFixed(2)
/** A figure with commas from four digits, as Theme 2 prints it; in maths the comma is {,}. */
const comma = (x: number) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const texComma = (x: number) => comma(x).replace(/,/g, '{,}')
/** Thousands with spaces from five digits, as the q25 written question's style prints them. */
const prose = (x: number) => (x >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : String(x))
const texProse = (x: number) => prose(x).replace(/ /g, '\\,')
/** Money as a solution prints it: whole pounds bare, otherwise two places. */
const money = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(2))
/** A number read from the prompt: 2,000 or 2 000 or £8.40. */
const read = (s: string) => Number(s.replace(/[£,\s]/g, ''))

function share(built: Generated[], key: (b: Generated) => unknown) {
  const counts = new Map<unknown, number>()
  for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / built.length, distinct: counts.size }
}

const SLOTS: [string, string][] = [
  ['business-mark-up-price', 'q5'],
  ['business-mark-up-price', 'q10'],
  ['business-mark-up-profit', 'q13'],
  ['business-extension-sales-increase', 'q24'],
  ['business-segment-revenue', 'q25'],
  ['business-price-cut-revenue', 'q26'],
]

describe('every 2.2 build', () => {
  it('cites the specification, with mark-up and percentage change as Appendix 2 skills', () => {
    const header = readFileSync(join(import.meta.dirname, 'marketing.ts'), 'utf8').split('const TOPIC')[0]!
    expect(header).toContain('2.2.2 price')
    expect(header).toContain('2.2.1 product, extension strategies')
    expect(header).toContain('(Appendix 2, "percentages and percentage changes")')
    expect(header).toContain('Appendix 3 revenue')
    expect(header).not.toMatch(/Appendix 3 (?:mark-up|percentage)/)
  })

  it('has a generator for each numeric written slot, routed by slot', () => {
    expect(marketingGenerators.flatMap((g) => g.replaces).sort()).toEqual(bank.filter((q) => q.type === 'numeric').map((q) => q.id).sort())
    for (const [id, slot] of SLOTS) expect(marketingGenerators.find((g) => g.id === id)!.replaces).toContain(slot)
    for (const g of marketingGenerators) {
      expect(g.subjectId).toBe('business')
      expect(g.topicId).toBe(TOPIC)
    }
  })

  it('keeps each slot\'s units, tolerance and mark-scheme codes, prints no article before a figure, and never fails to draw over 3000 seeds', () => {
    for (const [gid, id] of SLOTS) {
      const g = GENERATORS.find((x) => x.id === gid)!
      const slot = written(id)
      for (let i = 0; i < 3000; i++) {
        const b = generate(g, slot, `throw-${i}`)
        if (i >= 300) continue
        const q = b.question
        if (q.type !== 'numeric' || slot.type !== 'numeric') throw new Error('not numeric')
        expect(q.units).toBe(slot.units)
        expect(q.tolerance).toBe(slot.tolerance ?? 0)
        expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
        expect(q.markScheme.map((l) => l.code)).toEqual(slot.markScheme.map((l) => l.code))
        expect(b.check.agrees, b.seed).toBe(true)
        expect(accepts(b, String(q.answer + 1))).toBe(false)
      }
    }
  })

  it('repeats no prompt in a tenth of 1000 builds and the written one in at most a twentieth', () => {
    for (const [gid, id] of SLOTS) {
      const built = build(gid, id, 1000, 'release')
      const counts = new Map<string, number>()
      for (const b of built) counts.set(b.question.prompt, (counts.get(b.question.prompt) ?? 0) + 1)
      expect(Math.max(...counts.values()), id).toBeLessThanOrEqual(50)
      expect(counts.get(written(id).prompt) ?? 0).toBeLessThanOrEqual(50)
    }
  })

  it('exact slots are exact, and the pence slots keep 0.01 as written', () => {
    const tol = (id: string) => {
      const q = written(id)
      return q.type === 'numeric' ? (q.tolerance ?? 0) : NaN
    }
    for (const id of ['q5', 'q10', 'q13']) expect(tol(id)).toBe(0.01)
    for (const id of ['q24', 'q25', 'q26']) expect(tol(id)).toBe(0)
  })
})

describe('q5, q10: selling price from a mark-up', () => {
  for (const id of ['q5', 'q10']) {
    it(`${id}: reads the cost and mark-up back and adds the mark-up to the cost`, () => {
      for (const b of build('business-mark-up-price', id)) {
        const p = b.question.prompt
        const cost = read(/(£\d+\.\d\d)/.exec(p)![1]!)
        const m = Number(/mark-up of (\d+)%/.exec(p)![1])
        const pence = Math.round(cost * 100)
        const addedPence = (pence * m) / 100
        expect(Number.isInteger(addedPence)).toBe(true)
        const price = (pence + addedPence) / 100
        expect(answer(b), b.seed).toBeCloseTo(price, 9)
        // Real mark-ups, never 10% or 100%; the price in the good's own range.
        expect([20, 25, 30, 40, 50, 60, 75, 80]).toContain(m)
        // "The jeweller sets the price", never "sets its price".
        expect(p).not.toMatch(/sets its price/)
        const g = MARKETING.GOODS.find((x) => x.name === b.values.context)!
        expect(price >= g.price[0] && price <= g.price[1], `${b.seed} ${g.name} ${price}`).toBe(true)
        expect(b.question.solution).toContain(`Mark-up $= £${p2(cost)} \\times ${m}\\% = £${p2(addedPence / 100)}$, so the price is $£${p2(cost)} + £${p2(addedPence / 100)} = £${p2(price)}$.`)
        expect(lines(b)).toEqual([`M1 finds ${m}% of £${p2(cost)}`, `A1 £${p2(price)}`])
        // Wrong routes: the mark-up alone (q13's answer); a margin on price; a discount; the
        // percentage added as pounds. None within the tolerance, none marked right.
        for (const wrong of [(cost * m) / 100, cost / (1 - m / 100), cost * (1 - m / 100), cost + m]) {
          expect(Math.abs(wrong - price), b.seed).toBeGreaterThan(0.05)
          expect(accepts(b, wrong.toFixed(2))).toBe(false)
        }
        // No answer a printed figure reads off as.
        for (const k of [1, 10, 100]) expect(m / k).not.toBe(price)
        for (const t of [String(price), `£${price}`, `£${p2(price)}`, p2(price)]) expect(accepts(b, t), t).toBe(true)
      }
    })
  }

  it('spreads answers, costs, mark-ups and goods; the two slots on one sheet never share a half of the mark-ups', () => {
    for (const id of ['q5', 'q10']) {
      const many = build('business-mark-up-price', id, 1000)
      expect(share(many, answer).worst).toBeLessThanOrEqual(0.05)
      expect(share(many, answer).distinct).toBeGreaterThanOrEqual(200)
      for (const k of ['cost', 'markUp', 'context']) expect(share(many, (b) => b.values[k]).worst, k).toBeLessThanOrEqual(0.2)
      expect(share(many, (b) => b.values.context).distinct).toBe(MARKETING.GOODS.length)
      expect(share(many, (b) => b.values.markUp).distinct).toBe(8)
    }
    const higher = sheet('higher')
    for (let i = 0; i < 200; i++) {
      const s = sheetQuestions('business', TOPIC, higher, `sheet-${i}`)
      const [a, b] = ['q5', 'q10'].map((id) => Number(s.find((x) => x.question.id === id)!.generated!.values.markUp))
      expect(MARKETING.MARK_UPS.findIndex((h) => (h as readonly number[]).includes(a!))).not.toBe(MARKETING.MARK_UPS.findIndex((h) => (h as readonly number[]).includes(b!)))
    }
  })
})

describe('q13: profit per unit from a mark-up', () => {
  it('reads the cost and mark-up back; the profit is the mark-up, never the price or the percentage', () => {
    for (const b of build('business-mark-up-profit', 'q13')) {
      const p = b.question.prompt
      const cost = read(/(£\d+\.\d\d)/.exec(p)![1]!)
      const m = Number(/mark-up of (\d+)%/.exec(p)![1])
      const item = /profit (?:on|it makes on) each ([a-z ]+), in pounds/.exec(p)![1]!
      const profitPence = (Math.round(cost * 100) * m) / 100
      expect(Number.isInteger(profitPence)).toBe(true)
      const profit = profitPence / 100
      const price = (Math.round(cost * 100) + profitPence) / 100
      expect(answer(b), b.seed).toBeCloseTo(profit, 9)
      const c = MARKETING.CRAFTS.find((x) => x.item === item)!
      expect(c, item).toBeDefined()
      expect(price >= c.price[0] && price <= c.price[1]).toBe(true)
      expect(p).not.toMatch(/blanket/)
      // Never 50%: the cost less the mark-up would equal the profit.
      expect(MARKETING.CRAFT_MARK_UPS).toContain(m)
      expect(m).not.toBe(50)
      expect(b.question.solution).toContain(`Mark-up $= £${p2(cost)} \\times ${m}\\% = £${p2(profit)}$, so the price is £${p2(price)} and the **profit per ${item} is £${p2(profit)}**.`)
      expect(b.question.solution).toContain(`$£${p2(price)} - £${p2(cost)} = £${p2(profit)}$, not the percentage.`)
      expect(lines(b)).toEqual([`M1 finds ${m}% of £${p2(cost)}`, `M1 identifies £${p2(profit)}, the gap between the £${p2(price)} price and the cost, as the profit per ${item}`, `A1 £${p2(profit)}`])
      // Wrong routes: the selling price, the percentage, the cost, the cost less the mark-up.
      for (const wrong of [price, m, cost, cost - profit]) {
        expect(Math.abs(wrong - profit), b.seed).toBeGreaterThan(0.05)
        expect(accepts(b, String(wrong))).toBe(false)
      }
      for (const k of [1, 10, 100]) expect([m / k, cost / k]).not.toContain(profit)
      for (const t of [String(profit), `£${profit}`, `£${p2(profit)}`]) expect(accepts(b, t), t).toBe(true)
    }
  })

  it('spreads answers, costs, mark-ups and goods', () => {
    const many = build('business-mark-up-profit', 'q13', 1000)
    expect(share(many, answer).worst).toBeLessThanOrEqual(0.05)
    expect(share(many, answer).distinct).toBeGreaterThanOrEqual(200)
    for (const k of ['cost', 'markUp', 'context']) expect(share(many, (b) => b.values[k]).worst, k).toBeLessThanOrEqual(0.2)
    expect(share(many, (b) => b.values.context).distinct).toBe(MARKETING.CRAFTS.length)
  })
})

describe('q24: percentage increase in sales after an extension strategy', () => {
  it('reads sales back and divides the rise by the sales before', () => {
    for (const b of build('business-extension-sales-increase', 'q24')) {
      const p = b.question.prompt
      const [before, after] = [...p.matchAll(/(\d{1,3}(?:,\d{3})+|\d{4,})/g)].map((m) => read(m[1]!)) as [number, number]
      const rise = after - before
      const pct = (rise * 100) / before
      expect(answer(b), b.seed).toBe(pct)
      expect(pct >= 8 && pct <= 40 && Number.isInteger(pct * 2)).toBe(true)
      expect(before % 100).toBe(0)
      expect(rise % 10).toBe(0)
      expect([1000, 10000, 100000]).not.toContain(before)
      expect(p).toMatch(/extension strategy/)
      // An event, not a product: "the year before the launch of the new scents".
      expect(p).not.toMatch(/year (?:before|after) the (?:new scents|travel edition)/)
      expect(p).toMatch(/Calculate the percentage increase in its sales\.$/)
      const items = new RegExp(`\\$${texComma(after).replace(/[{}]/g, '\\$&')} - ${texComma(before).replace(/[{}]/g, '\\$&')} = ${texComma(rise).replace(/[{}]/g, '\\$&')}\\$ ([a-z ]+), so`).exec(b.question.solution)
      expect(items, b.seed).not.toBeNull()
      expect(b.question.solution).toContain(`so the increase is $${texComma(rise)} \\div ${texComma(before)} \\times 100 = ${pct}\\%$.`)
      expect(b.question.solution).toContain(`$${texComma(rise)} \\div ${texComma(after)}$ gives a smaller, wrong answer`)
      expect(lines(b)).toEqual([`M1 $(${texComma(after)} - ${texComma(before)}) \\div ${texComma(before)} \\times 100$`, `A1 ${pct}%`])
      // Wrong routes, rounded as a student would type them: over the new sales; the new as a
      // percentage of the old; the rise itself.
      const overNew = (rise / after) * 100
      for (const wrong of [Math.round(overNew), Math.round(overNew * 10) / 10, (after / before) * 100, rise]) {
        expect(wrong, b.seed).not.toBe(pct)
        expect(accepts(b, String(wrong))).toBe(false)
      }
      for (const f of [before, after, rise]) for (const k of [1, 10, 100, 1000]) expect(f / k).not.toBe(pct)
      for (const t of [String(pct), `${pct}%`, `${pct} %`]) expect(accepts(b, t), t).toBe(true)
    }
  })

  it('spreads answers, sales and contexts; mostly whole percentages', () => {
    const many = build('business-extension-sales-increase', 'q24', 1000)
    expect(share(many, answer).worst).toBeLessThanOrEqual(0.06)
    expect(share(many, answer).distinct).toBeGreaterThanOrEqual(40)
    for (const k of ['before', 'context']) expect(share(many, (b) => b.values[k]).worst, k).toBeLessThanOrEqual(0.2)
    expect(share(many, (b) => b.values.context).distinct).toBe(MARKETING.EXTENSIONS.length)
    const halves = many.filter((b) => !Number.isInteger(answer(b))).length / many.length
    expect(halves > 0.15 && halves < 0.35).toBe(true)
  })
})

describe('q25: revenue from two segments priced differently', () => {
  it('reads both prices and quantities back and adds the two revenues', () => {
    for (const b of build('business-segment-revenue', 'q25')) {
      const p = b.question.prompt
      const prices = [...p.matchAll(/£(\d+)/g)].map((m) => Number(m[1]))
      const counts = [...p.replace(/£\d+/g, '').matchAll(/\d[\d ]*\d|\d/g)].map((m) => read(m[0]))
      expect(prices).toHaveLength(2)
      expect(counts).toHaveLength(2)
      const [p1, p2v] = prices as [number, number]
      const [q1, q2] = counts as [number, number]
      const total = p1 * q1 + p2v * q2
      expect(answer(b), b.seed).toBe(total)
      // The dearer segment first, at least £2 more; four different givens.
      expect(p1 - p2v).toBeGreaterThanOrEqual(2)
      expect(p2v).toBeLessThanOrEqual(0.8 * p1)
      expect(new Set([p1, p2v, q1, q2]).size).toBe(4)
      const v = MARKETING.VENUES.find((x) => x.name === b.values.context)!
      expect(p1 >= v.pHigh[0] && p1 <= v.pHigh[1] && p2v >= v.pLow[0] && p2v <= v.pLow[1]).toBe(true)
      expect(q1 >= v.qHigh[0] && q1 <= v.qHigh[1] && q2 >= v.qLow[0] && q2 <= v.qLow[1]).toBe(true)
      expect(p).not.toMatch(/hotel|night/i)
      // In scale: a salon cuts at most 120 adults' hair a week.
      if (v.name === 'hair salon') expect(q1).toBeLessThanOrEqual(120)
      expect(p).toMatch(/market segments/)
      expect(b.question.solution).toContain(`$${p1} \\times ${texProse(q1)} = £${texProse(p1 * q1)}$.`)
      expect(b.question.solution).toContain(`$${p2v} \\times ${texProse(q2)} = £${texProse(p2v * q2)}$.`)
      expect(b.question.solution).toContain(`Total revenue $= ${texProse(p1 * q1)} + ${texProse(p2v * q2)} = £${texProse(total)}$.`)
      expect(lines(b)).toEqual([`M1 $${p1} \\times ${texProse(q1)} = ${texProse(p1 * q1)}$ and $${p2v} \\times ${texProse(q2)} = ${texProse(p2v * q2)}$`, `A1 £${prose(total)}`])
      // Wrong routes: one price for everyone; prices and quantities added first; the average
      // price for everyone; one segment alone.
      const wrongs = [p1 * (q1 + q2), p2v * (q1 + q2), (p1 + p2v) * (q1 + q2), ((p1 + p2v) / 2) * (q1 + q2), p1 * q1, p2v * q2]
      for (const w of wrongs) {
        expect(w, b.seed).not.toBe(total)
        expect(accepts(b, String(w))).toBe(false)
      }
      for (const t of [String(total), `£${total}`, comma(total), `£${comma(total)}`, prose(total), `£${prose(total)}`]) expect(accepts(b, t), t).toBe(true)
    }
  })

  it('spreads answers, prices, quantities and venues', () => {
    const many = build('business-segment-revenue', 'q25', 1000)
    expect(share(many, answer).worst).toBeLessThanOrEqual(0.02)
    expect(share(many, answer).distinct).toBeGreaterThanOrEqual(300)
    for (const k of ['context', 'high', 'low', 'highSold', 'lowSold']) expect(share(many, (b) => b.values[k]).worst, k).toBeLessThanOrEqual(0.2)
    expect(share(many, (b) => b.values.context).distinct).toBe(MARKETING.VENUES.length)
    for (const v of MARKETING.VENUES) {
      const group = many.filter((b) => b.values.context === v.name)
      expect(share(group, answer).worst, v.name).toBeLessThanOrEqual(0.1)
    }
  })
})

describe('q26: revenue after a price cut', () => {
  it('reads sales, price and cut back, finds both revenues and the fall', () => {
    for (const b of build('business-price-cut-revenue', 'q26')) {
      const p = b.question.prompt
      const m = /(?:sells|selling) ([\d,]+) [a-z ]+ a month at £([\d.]+) each/.exec(p)!
      const Q1 = read(m[1]!)
      const P = Number(m[2])
      const c = Number(/cuts the price by (\d+)%/.exec(p)![1])
      const Q2 = read(/rise to ([\d,]+) /.exec(p)![1]!)
      const P2 = Math.round(P * (100 - c)) / 100
      const R1 = Math.round(Q1 * P * 100) / 100
      const R2 = Math.round(Q2 * P2 * 100) / 100
      const F = R1 - R2
      expect(Number.isInteger(R1) && Number.isInteger(R2)).toBe(true)
      expect(answer(b), b.seed).toBe(F)
      // Sales rose by at least 3%, revenue fell by at least 2%; a real cut, never half.
      expect(Q2 >= Q1 * 1.03).toBe(true)
      expect(R2 <= R1 * 0.98).toBe(true)
      expect([10, 15, 20, 25, 30]).toContain(c)
      const brand = MARKETING.BRANDS.find((x) => x.name === b.values.context)!
      expect(Q1 >= brand.sales[0] && Q1 <= brand.sales[1] && P >= brand.price[0] && P <= brand.price[1]).toBe(true)
      expect(p).not.toMatch(/blanket|coffee/i)
      const s = b.question.solution
      expect(s).toContain(`Revenue before $= ${texComma(Q1)} \\times ${money(P)} = £${texComma(R1)}$.`)
      expect(s).toContain(`A ${c}% cut takes the price to $${money(P)} \\times ${1 - c / 100} = £${money(P2)}$.`)
      expect(s).toContain(`Revenue after $= ${texComma(Q2)} \\times ${money(P2)} = £${texComma(R2)}$.`)
      expect(s).toContain(`The fall is $${texComma(R1)} - ${texComma(R2)} = £${texComma(F)}$ a month.`)
      expect(lines(b)).toEqual([`M1 $${texComma(Q1)} \\times ${money(P)} = ${texComma(R1)}$`, `M1 new price £${money(P2)}, so $${texComma(Q2)} \\times ${money(P2)} = ${texComma(R2)}$`, `A1 £${comma(F)}`])
      // Wrong routes: the cut on the old sales only; the extra sales' revenue alone; the cut taken
      // in pounds; the extra sales at the old price; the cut and the sales rise as percentages of the old revenue (rounded); the new
      // price taken as the cut; the fall the other way round.
      const rise = ((Q2 - Q1) / Q1) * 100
      expect(P).not.toBe(c)
      const wrongs = [Q1 * (P - P2), (Q2 - Q1) * P2, (Q2 - Q1) * P, R1 - Q2 * (P - c), Math.round((R1 * (c - rise)) / 100), R1 - Q2 * ((P * c) / 100), R1, R2]
      for (const w of wrongs) {
        expect(Math.abs(w - F), `${b.seed}: ${w}`).toBeGreaterThan(0.5)
        expect(accepts(b, String(Math.round(w)))).toBe(false)
      }
      expect(accepts(b, String(-F))).toBe(false)
      for (const f of [Q1, Q2, P, c]) expect(f).not.toBe(F)
      for (const t of [String(F), `£${F}`, comma(F), `£${comma(F)}`]) expect(accepts(b, t), t).toBe(true)
    }
  })

  it('spreads answers, cuts, prices and brands, and every brand and cut is drawn', () => {
    const many = build('business-price-cut-revenue', 'q26', 1000)
    expect(share(many, answer).worst).toBeLessThanOrEqual(0.02)
    expect(share(many, answer).distinct).toBeGreaterThanOrEqual(300)
    for (const k of ['context', 'cut', 'price', 'before', 'after']) expect(share(many, (b) => b.values[k]).worst, k).toBeLessThanOrEqual(0.25)
    expect(share(many, (b) => b.values.context).distinct).toBe(MARKETING.BRANDS.length)
    expect(share(many, (b) => b.values.cut).distinct).toBe(MARKETING.CUTS.length)
  })
})

describe('the advanced sheet', () => {
  it('never prints blankets beside Loom & Last, nor coffee beside Oakhill', () => {
    const advanced = sheet('advanced')
    for (let i = 0; i < 200; i++) {
      const s = sheetQuestions('business', TOPIC, advanced, `advanced-${i}`)
      for (const id of ['q13', 'q26']) {
        const q = s.find((x) => x.question.id === id)!
        expect(q.generated).toBeDefined()
        expect(q.question.prompt).not.toMatch(/blanket|coffee/i)
      }
    }
  })
})
