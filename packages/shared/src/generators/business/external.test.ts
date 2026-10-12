import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { BORROWERS, COMPANIES, CHANGES, EXPORTS, EXTERNAL, FAULTY, GOODS, IMPORTS, TAX, externalGenerators } from './external.ts'

/**
 * Structural tests for the 1.5 generators. Each reads the prompt's figures back with its own
 * parsing, works the answer again from them alone, checks literal lines of the working and the
 * mark scheme, that the named wrong routes are marked wrong, and the spread over builds.
 */
const TOPIC = 'understanding-external-influences'
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
/** A printed figure as a number: £24 000, \$12 000, €1.25. */
const read = (s: string) => Number(s.replace(/[£€$\\,\s]/g, ''))
/** Thousands as the written questions print them in prose, from five digits: 24 000. Written here, not imported. */
const prose = (x: number) => (x >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : String(x))
const maths = (x: number) => prose(x).replace(/ /g, '\\,')
const comma = (x: number) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const pence = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(2))
const r2 = (x: number) => Math.round(x * 100) / 100

function share(built: Generated[], key: (b: Generated) => unknown) {
  const counts = new Map<unknown, number>()
  for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / built.length, distinct: counts.size }
}
function spread(id: string, slot: string, keys: string[], cap = 0.4) {
  const many = build(id, slot, 1000)
  expect(share(many, answer).worst, `${id} answer`).toBeLessThanOrEqual(cap)
  expect(share(many, answer).distinct, `${id} answers`).toBeGreaterThanOrEqual(10)
  for (const k of keys) expect(share(many, (b) => b.values[k]).worst, `${id} ${k}`).toBeLessThanOrEqual(0.4)
  return many
}

/** The answer typed as a student might: plain, with its symbol, with its thousands separated. */
function marksEveryTyping(b: Generated, unit = '£') {
  const a = answer(b)
  const typed = [String(a), `${unit}${a}`, comma(a), `${unit}${comma(a)}`, prose(a), `${unit}${prose(a)}`]
  for (const t of typed) expect(mark(b.question, t).correct, `${b.seed}: ${t}`).toBe(true)
}

const SLOTS = [
  ['business-exchange-conversion', 'q5'],
  ['business-exchange-import-cost', 'q11'],
  ['business-exchange-export-price', 'q19'],
  ['business-consumer-law-refunds', 'q29'],
  ['business-interest-rate-change', 'q30'],
  ['business-tax-change', 'q31'],
] as const

describe('every 1.5 build', () => {
  it('has one generator for each numeric written slot', () => {
    expect(externalGenerators.flatMap((g) => g.replaces).sort()).toEqual(SLOTS.map((s) => s[1]).sort())
    expect(bank.filter((q) => q.type === 'numeric').map((q) => q.id).sort()).toEqual(SLOTS.map((s) => s[1]).sort())
    for (const [g, id] of SLOTS) expect(externalGenerators.find((x) => x.id === g)!.replaces).toEqual([id])
  })

  it('keeps each slot\'s units, tolerance and mark codes, prints no article before a figure, and never fails to draw over 3000 seeds', () => {
    for (const g of externalGenerators) {
      for (const id of g.replaces) {
        const slot = written(id)
        for (let i = 0; i < 3000; i++) {
          const b = generate(g, slot, `throw-${i}`)
          if (i >= 300) continue
          const q = b.question
          if (q.type !== 'numeric' || slot.type !== 'numeric') throw new Error('not numeric')
          expect(q.units).toBe(slot.units)
          expect(q.tolerance).toBe(slot.tolerance)
          expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
          expect(q.prompt, b.seed).not.toMatch(/\ba (?:Irish|Italian|American)\b|\ban (?:German|French|Spanish|Dutch)\b/)
          expect(q.markScheme.map((l) => l.code)).toEqual(slot.markScheme.map((l) => l.code))
        }
      }
    }
  })

  it('repeats no prompt in a tenth of 1000 builds and the written one in at most a twentieth', () => {
    for (const [g, id] of SLOTS) {
      const counts = new Map<string, number>()
      for (const b of build(g, id, 1000, 'release')) counts.set(b.question.prompt, (counts.get(b.question.prompt) ?? 0) + 1)
      expect(Math.max(...counts.values()), g).toBeLessThanOrEqual(100)
      expect(counts.get(written(id).prompt) ?? 0, g).toBeLessThanOrEqual(50)
    }
  })
})

describe('q5: a supplier\'s price turned into pounds', () => {
  it('reads the price and rate back and divides', () => {
    for (const b of build('business-exchange-conversion', 'q5')) {
      const p = b.question.prompt
      const m = /(\\\$|€)([\d ]+)[.,]/.exec(p)!
      const X = read(m[2]!)
      const rate = /£1 = (?:\\\$|€)(\d\.\d\d)\./.exec(p)!
      const c = Number(rate[1])
      const Y = Math.round(X / c)
      expect(Math.abs(X / c - Y)).toBeLessThan(1e-6)
      expect(answer(b), b.seed).toBe(Y)
      // Rates near real ones: the dollar for an American supplier, the euro for the rest.
      if (m[1] === '€') expect(c >= 1.05 && c <= 1.4).toBe(true)
      else expect(c >= 1.2 && c <= 1.6 && /an American supplier/.test(p)).toBe(true)
      expect(X % 10).toBe(0)
      const word = m[1] === '€' ? 'euros' : 'dollars'
      expect(b.question.solution).toContain(`Pounds $=$ ${word} $\\div$ the rate: $${maths(X)} \\div ${rate[1]} = £${maths(Y)}$.`)
      expect(lines(b)).toEqual([`M1 $${maths(X)} \\div ${rate[1]}$`, `A1 £${prose(Y)}`])
      // Wrong route: multiplying by the rate.
      expect(mark(b.question, String(Math.round(X * c))).correct).toBe(false)
      expect(X).not.toBe(Y)
      marksEveryTyping(b)
    }
  })

  it('spreads its answers, rates and goods', () => {
    const many = spread('business-exchange-conversion', 'q5', ['rate', 'context', 'supplier', 'pounds'])
    expect(share(many, (b) => b.values.context).distinct).toBe(EXTERNAL.PURCHASES.length)
    expect(share(many, (b) => b.values.currency).worst).toBeLessThan(0.8)
    // Every rate gives a round foreign price from a cost that is a multiple of £10.
    for (const cur of EXTERNAL.SUPPLY.map((s) => s.cur)) for (const c of EXTERNAL.RATES(cur)) expect(EXTERNAL.roundStep(c) * c % 1000).toBe(0)
  })
})

describe('q11: an import\'s cost before and after the rate moves', () => {
  it('reads price and both rates back; the answer is the rounded difference, within a penny of the exact one', () => {
    for (const b of build('business-exchange-import-cost', 'q11')) {
      const p = b.question.prompt
      const price = read(/at (?:\\\$|€)(\d+) (?:a pair|each)\./.exec(p)![1]!)
      const rates = [...p.matchAll(/£1 = (?:\\\$|€)(\d\.\d\d)/g)].map((m) => m[1]!)
      expect(rates).toHaveLength(2)
      const [s1, s2] = rates as [string, string]
      const [c1, c2] = [price / Number(s1), price / Number(s2)]
      const more = /how much more/.test(p)
      expect(more).toBe(Number(s2) < Number(s1))
      const exact = r2(Math.abs(r2(c2) - r2(c1)))
      expect(answer(b), b.seed).toBe(exact)
      expect(Math.abs(answer(b) - Math.abs(c2 - c1))).toBeLessThan(0.005 + 1e-9)
      expect(tolerance(b)).toBe(0.01)
      expect(answer(b)).toBeGreaterThanOrEqual(1)
      expect(p).toMatch(/Give your answer to the nearest penny\.$/)
      // One year converts exactly; the other is clear of a half penny.
      expect([c1, c2].some((c) => Math.abs(c * 100 - Math.round(c * 100)) < 1e-6)).toBe(true)
      for (const c of [c1, c2]) expect(Math.abs((c * 100) % 1 - 0.5)).toBeGreaterThan(0.04)
      const move = Math.abs(Number(s1) - Number(s2))
      expect(move >= 0.049 && move <= 0.201).toBe(true)
      const s = b.question.solution
      expect(s).toContain(`Last year: $${price} \\div ${s1} = £${pence(r2(c1))}$`)
      expect(s).toContain(`This year: $${price} \\div ${s2} = £${pence(r2(c2))}$`)
      expect(s).toContain(`$${pence(r2(Math.max(c1, c2)))} - ${pence(r2(Math.min(c1, c2)))} = £${pence(answer(b))}$`)
      expect(s).toContain(more ? 'The pound has weakened' : 'The pound has strengthened')
      expect(lines(b)).toEqual([`M1 $${price} \\div ${s1} = £${pence(r2(c1))}$`, `M1 $${price} \\div ${s2} = £${pence(r2(c2))}$`, 'M1 difference of the two', `A1 £${pence(answer(b))}`])
      // Wrong routes: multiplying by the rates; either year's cost on its own.
      for (const w of [price * move, r2(c1), r2(c2)]) expect(mark(b.question, w.toFixed(2)).correct, `${b.seed}: ${w}`).toBe(false)
      for (const t of [pence(answer(b)), `£${pence(answer(b))}`, String(Math.abs(c2 - c1))]) expect(mark(b.question, t).correct, t).toBe(true)
    }
  })

  it('spreads its answers and makes the pound weaken about half the time', () => {
    const many = spread('business-exchange-import-cost', 'q11', ['context', 'price', 'lastRate', 'thisRate'], 0.1)
    const weak = many.filter((b) => b.values.weakens === 'weakens').length / many.length
    expect(weak > 0.4 && weak < 0.6).toBe(true)
    expect(share(many, (b) => b.values.context).distinct).toBe(IMPORTS.length)
    // Per product: the exact year's cost drawn first, so no one cost (£50 for trainers took 47%)
    // fills a product; answers spread within each product too.
    for (const m of IMPORTS) {
      const group = many.filter((b) => b.values.context === m.name)
      expect(group.length, m.name).toBeGreaterThan(100)
      expect(share(group, (b) => (b.values.exact === 'last' ? b.values.last : b.values.now)).worst, m.name).toBeLessThanOrEqual(0.15)
      expect(share(group, answer).worst, m.name).toBeLessThanOrEqual(0.1)
      expect(share(group, answer).distinct, m.name).toBeGreaterThanOrEqual(50)
    }
  })

  it('never gives an answer within a penny of a printed rate, and has no toy importer (q16 on the same sheet is one)', () => {
    for (const b of build('business-exchange-import-cost', 'q11', 1000)) {
      for (const k of ['lastRate', 'thisRate']) expect(Math.abs(answer(b) - Number(b.values[k])), `${b.seed} ${k}`).toBeGreaterThan(0.01)
      expect(b.question.prompt).not.toMatch(/\btoys?\b/i)
      const exactCost = b.values.exact === 'last' ? b.values.last : b.values.now
      expect([10, 100, 1000]).not.toContain(exactCost)
    }
  })
})

describe('q19: an export\'s price abroad before and after the rate moves', () => {
  it('reads price and both rates back and multiplies', () => {
    for (const b of build('business-exchange-export-price', 'q19')) {
      const p = b.question.prompt
      const P = read(/(?:for|price at) (£\d+)/.exec(p)![1]!)
      const rates = [...p.matchAll(/£1 = €(\d\.\d\d)/g)].map((m) => m[1]!)
      const [s1, s2] = rates as [string, string]
      const [e1, e2] = [r2(P * Number(s1)), r2(P * Number(s2))]
      const falls = / falls\.$/.test(p)
      expect(falls).toBe(Number(s2) < Number(s1))
      const change = Math.round(Math.abs(e1 - e2))
      expect(Math.abs(Math.abs(e1 - e2) - change)).toBeLessThan(1e-6)
      expect(answer(b), b.seed).toBe(change)
      expect(Number(s1) >= 1.05 && Number(s2) <= 1.4 && Number(s2) >= 1.05 && Number(s1) <= 1.4).toBe(true)
      // Never £100, where the change is the rates' difference with the point moved.
      expect(P).not.toBe(100)
      expect(change).not.toBe(Math.round(Math.abs(Number(s1) - Number(s2)) * 100))
      const s = b.question.solution
      expect(s).toContain(`$${P} \\times ${s1} = €${pence(e1)}$`)
      expect(s).toContain(`$${P} \\times ${s2} = €${pence(e2)}$`)
      expect(s).toContain(`$${pence(Math.max(e1, e2))} - ${pence(Math.min(e1, e2))} = €${change}$`)
      expect(s).toContain(falls ? 'WPIDEC' : 'SPICED')
      expect(lines(b)).toEqual([`M1 $${P} \\times ${s1} = ${pence(e1)}$ or $${P} \\times ${s2} = ${pence(e2)}$`, 'M1 both prices found', `A1 €${change}`])
      // Wrong route: dividing by the rates (pounds, not euros).
      const divided = Math.abs(P / Number(s1) - P / Number(s2))
      expect(Math.abs(divided - change), b.seed).toBeGreaterThan(0.01)
      expect(mark(b.question, divided.toFixed(2)).correct).toBe(false)
      for (const t of [String(change), `€${change}`, `${change} euros`]) expect(mark(b.question, t).correct, t).toBe(true)
    }
  })

  it('spreads its answers and makes the pound weaken about half the time', () => {
    const many = spread('business-exchange-export-price', 'q19', ['context', 'country', 'price', 'lastRate', 'thisRate'], 0.15)
    const weak = many.filter((b) => b.values.weakens === 'weakens').length / many.length
    expect(weak > 0.4 && weak < 0.6).toBe(true)
    expect(share(many, (b) => b.values.context).distinct).toBe(EXPORTS.length)
    // Per product: gin and teapot had 8 answers each before their price ranges were widened.
    for (const e of EXPORTS) {
      const group = many.filter((b) => b.values.context === e.name)
      expect(share(group, answer).distinct, e.name).toBeGreaterThanOrEqual(10)
      expect(share(group, answer).worst, e.name).toBeLessThanOrEqual(0.2)
    }
    expect(EXPORTS.find((e) => e.name === 'gin')!.pounds).toEqual([20, 60])
    expect(EXPORTS.find((e) => e.name === 'teapot')!.pounds).toEqual([15, 60])
  })
})

describe('q29: refunds under consumer law', () => {
  it('reads sales, rate and price back and finds the cost', () => {
    for (const b of build('business-consumer-law-refunds', 'q29')) {
      const p = b.question.prompt
      const N = read(/sold ([\d ]+) [a-z]/.exec(p)![1]!)
      const f = Number(/(\d+(?:\.\d+)?)%/.exec(p)![1])
      const R = read(/(£\d+) each/.exec(p)![1]!)
      const F = Math.round((N * f) / 100)
      expect(Math.abs((N * f) / 100 - F)).toBeLessThan(1e-9)
      expect(answer(b), b.seed).toBe(F * R)
      expect(FAULTY).toContain(f)
      expect(f >= 1 && f <= 10).toBe(true)
      expect(N >= EXTERNAL.SOLD[0] && N <= EXTERNAL.SOLD[1]).toBe(true)
      const g = GOODS.find((x) => x.name === b.values.context)!
      expect(R >= g.price[0] && R <= g.price[1]).toBe(true)
      expect(b.question.solution).toContain(`$= ${f}\\% \\times ${maths(N)} = ${F}$. Refunds $= ${F} \\times ${R} = £${maths(F * R)}$.`)
      expect(lines(b)).toEqual([`M1 $${f}\\% \\times ${maths(N)} = ${F}$ ${g.items}`, `A1 £${prose(F * R)}`])
      // Wrong routes: rate × price (only right when 100 are sold); all the takings; the takings
      // from the goods that were not faulty.
      for (const w of [f * R, N * R, (N - F) * R]) expect(w, b.seed).not.toBe(F * R)
      expect([N, R, f]).not.toContain(F * R)
      expect(F).not.toBe(R)
      marksEveryTyping(b)
    }
  })

  it('spreads its answers and inputs', () => {
    const many = spread('business-consumer-law-refunds', 'q29', ['context', 'sold', 'faulty', 'price', 'count'])
    expect(share(many, (b) => b.values.context).distinct).toBe(GOODS.length)
  })
})

describe('q30: a change in the interest on a loan', () => {
  it('reads the loan and both rates back and finds the change', () => {
    for (const b of build('business-interest-rate-change', 'q30')) {
      const p = b.question.prompt
      const L = read(/(£[\d ]+)(?: from a bank|\.)/.exec(p)![1]!)
      const [a, c] = [...p.matchAll(/(\d+(?:\.\d+)?)% a year/g)].map((m) => Number(m[1]))
      const rises = /rises|risen/.test(p)
      expect(rises).toBe(c! > a!)
      const Ia = (L * a!) / 100
      const Ic = (L * c!) / 100
      const change = Math.abs(Ic - Ia)
      expect(answer(b), b.seed).toBeCloseTo(change, 6)
      for (const x of [a!, c!]) expect(x >= 2 && x <= 12).toBe(true)
      const g = Math.abs(c! - a!)
      expect(CHANGES).toContain(g)
      expect(g).not.toBe(1)
      const s = b.question.solution
      expect(s).toContain(`Interest at ${a}% $= ${a! / 100} \\times ${maths(L)} = £${maths(Ia)}$; at ${c}% $= ${c! / 100} \\times ${maths(L)} = £${maths(Ic)}$.`)
      expect(s).toContain(`$= ${maths(Math.max(Ia, Ic))} - ${maths(Math.min(Ia, Ic))} = £${maths(change)}$ a year`)
      expect(lines(b)).toEqual([`M1 $${g / 100} \\times ${maths(L)}$ or $${maths(Math.max(Ia, Ic))} - ${maths(Math.min(Ia, Ic))}$`, `A1 £${prose(change)}`])
      // Wrong routes: the interest before or after the change; the change as a percentage of the old rate.
      for (const w of [Ia, Ic, Math.round((g / Math.min(a!, c!)) * 100)]) expect(w, b.seed).not.toBe(change)
      marksEveryTyping(b)
    }
  })

  it('spreads its answers and inputs and makes the rate rise about half the time', () => {
    const many = spread('business-interest-rate-change', 'q30', ['context', 'loan', 'from', 'to'])
    const rises = many.filter((b) => b.values.rises === 'rises').length / many.length
    expect(rises > 0.4 && rises < 0.6).toBe(true)
    expect(share(many, (b) => b.values.context).distinct).toBe(BORROWERS.length)
  })
})

describe('q31: a change in the tax on company profits', () => {
  it('reads the profit and both rates back and finds the change in profit after tax', () => {
    for (const b of build('business-tax-change', 'q31')) {
      const p = b.question.prompt
      const P = read(/(£[\d ]+)(?: last year)?\./.exec(p)![1]!)
      const [a, c] = [...p.matchAll(/(\d+)% to (\d+)%/g)][0]!.slice(1).map(Number) as [number, number]
      const raises = /(?:raises|rises) (?:the rate of tax on company profits )?from/.test(p)
      expect(raises).toBe(c > a)
      for (const x of [a, c]) expect(x >= TAX[0] && x <= TAX[1]).toBe(true)
      const Aa = P - (P * a) / 100
      const Ac = P - (P * c) / 100
      const change = Math.abs(Aa - Ac)
      expect(answer(b), b.seed).toBe(change)
      expect(p).toMatch(raises ? /(?:the fall in the company's profit after tax|profit after tax falls)\.$/ : /(?:the rise in the company's profit after tax|profit after tax rises)\.$/)
      const s = b.question.solution
      // Two places, as the written prints 0.20: never 0.2.
      expect(s).toContain(`At ${c}%: tax $= ${(c / 100).toFixed(2)} \\times ${maths(P)}`)
      expect(s).toContain(`At ${a}%: tax $= ${(a / 100).toFixed(2)} \\times ${maths(P)} = £${maths((P * a) / 100)}$, so profit after tax $= ${maths(P)} - ${maths((P * a) / 100)} = £${maths(Aa)}$.`)
      expect(s).toContain(`$= ${maths(Math.max(Aa, Ac))} - ${maths(Math.min(Aa, Ac))} = £${maths(change)}$`)
      expect(lines(b)).toEqual([
        `M1 profit after tax at ${a}%: $${maths(P)} - ${maths((P * a) / 100)} = ${maths(Aa)}$`,
        `M1 profit after tax at ${c}%: $${maths(P)} - ${maths((P * c) / 100)} = ${maths(Ac)}$`,
        `A1 £${prose(change)}`,
      ])
      // Wrong routes: the change in rate on profit after tax (the wrong base); either tax bill.
      for (const w of [Math.round((Math.abs(c - a) / 100) * Aa), (P * a) / 100, (P * c) / 100]) expect(w, b.seed).not.toBe(change)
      marksEveryTyping(b)
    }
  })

  it('spreads its answers and inputs and raises the rate about half the time', () => {
    const many = spread('business-tax-change', 'q31', ['context', 'profit', 'from', 'to'])
    const raises = many.filter((b) => b.values.raises === 'raises').length / many.length
    expect(raises > 0.4 && raises < 0.6).toBe(true)
    expect(share(many, (b) => b.values.context).distinct).toBe(COMPANIES.length)
  })
})
