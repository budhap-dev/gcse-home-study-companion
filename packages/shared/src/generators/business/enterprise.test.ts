import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate, sheetQuestions } from '../index.ts'
import type { Generated } from '../types.ts'
import { ENTERPRISE, enterpriseGenerators } from './enterprise.ts'

/**
 * Structural tests for the Topic 1.1 generators. Each reads the prompt's own figures back
 * (pounds as printed, "£26 000") and works the answer from them alone, with no code shared
 * with the generator; checks every printed step, the routing, the named wrong routes, the
 * contexts' own ranges, and that no answer, input or calculation takes over a slot.
 */
const TOPIC = 'enterprise-and-entrepreneurship'
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/business')
const bank = Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8')).questions)
const slotOf = (id: string) => bank.find((q) => q.id === id)!

function build(generatorId: string, slotId: string, count = 300, prefix = 'structure'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  return Array.from({ length: count }, (_, i) => generate(g, slotOf(slotId), `${prefix}-${i}`))
}

/** Every amount of money in a text, in order: £26 000 is 26000, £6 is 6. */
const pounds = (text: string) => [...text.matchAll(/£(\d{1,3}(?: \d{3})+|\d+)(?!\.\d)/g)].map((m) => Number(m[1]!.replace(/ /g, '')))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const methods = (b: Generated) => b.question.markScheme.slice(0, -1).map((l) => l.description)
const accepts = (b: Generated, typed: string) => mark(b.question, typed).correct
/** The figure as the pack prints it in prose and in maths: 26 000 and 26\,000 from five digits. */
const prose = (x: number) => (x >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : String(x))
const tex = (x: number) => prose(x).replace(/ /g, '\\,')

function share(built: Generated[], key: (b: Generated) => unknown) {
  const counts = new Map<unknown, number>()
  for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / built.length, distinct: counts.size }
}

const SLOTS: [string, string][] = [
  ['enterprise-value-added-craft', 'q11'],
  ['enterprise-value-added-maker', 'q21'],
  ['enterprise-value-added-total', 'q29'],
  ['enterprise-value-added-profit', 'q12'],
  ['enterprise-profit-percentage-increase', 'q28'],
  ['enterprise-profit-against-salary', 'q30'],
]

describe('every enterprise build', () => {
  it('cites the specification without claiming an Appendix 3 formula for added value or profit', () => {
    const header = readFileSync(join(import.meta.dirname, 'enterprise.ts'), 'utf8').split('const TOPIC')[0]!
    expect(header).not.toMatch(/Appendix 3 (?:profit|formula)|its own definition/)
    expect(header).toContain('Appendix 2 "revenue, costs and')
    expect(header).toContain('convenience, branding, quality, design, unique selling points')
  })

  it('has a generator for each numeric written slot, routed to its own builder', () => {
    expect(enterpriseGenerators.flatMap((g) => g.replaces).sort()).toEqual(bank.filter((q) => q.type === 'numeric').map((q) => q.id).sort())
    for (const [id, slot] of SLOTS) expect(enterpriseGenerators.find((g) => g.id === id)!.replaces).toEqual([slot])
    for (const g of enterpriseGenerators) expect(() => g.build(() => 0.5, slotOf('q1'), 0)).toThrow(/no builder/)
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
        expect(Number.isInteger(q.answer)).toBe(true)
        expect(q.answer).toBeGreaterThan(0)
        expect(q.markScheme.map((l) => l.code)).toEqual(slot.markScheme.map((l) => l.code))
        expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
        expect(q.prompt).not.toMatch(/£\d+\.\d/)
        expect(b.check.agrees, b.seed).toBe(true)
      }
    }
  })

  it('is marked right typed plain, with £, and with a thousands separator', () => {
    for (const [id, slotId] of SLOTS) {
      for (const b of build(id, slotId, 100)) {
        const a = answer(b)
        expect(accepts(b, String(a)), b.seed).toBe(true)
        if (slotId === 'q28') {
          expect(accepts(b, `${a}%`)).toBe(true)
        } else {
          expect(accepts(b, `£${a}`)).toBe(true)
          expect(accepts(b, `£${a.toLocaleString('en-GB')}`)).toBe(true)
          expect(accepts(b, prose(a))).toBe(true)
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

  it('gives the written prompt in under 5% of builds and no prompt in over 5%; spreads answers and calculations', () => {
    for (const [id, slotId] of SLOTS) {
      const many = build(id, slotId, 1000, 'spread')
      const prompts = share(many, (b) => b.question.prompt)
      expect(prompts.worst, id).toBeLessThan(0.05)
      expect(many.filter((b) => b.question.prompt === slotOf(slotId).prompt).length / many.length, id).toBeLessThan(0.05)
      const answers = share(many, answer)
      expect(answers.worst, `${id} answer`).toBeLessThanOrEqual(0.1)
      expect(answers.distinct, `${id} answers`).toBeGreaterThanOrEqual(10)
      // One calculation: the same printed figures, whatever the words round them.
      expect(share(many, (b) => pounds(b.question.prompt).join(',') + '|' + (b.question.prompt.match(/\b\d+\b(?! ?%)/g) ?? []).join(',')).worst, `${id} calculation`).toBeLessThan(1 / 6)
      for (const [k, v] of Object.entries(many[0]!.values)) if (typeof v === 'number') expect(share(many, (b) => b.values[k]).worst, `${id} ${k}`).toBeLessThanOrEqual(0.4)
    }
  })
})

describe('value added per item (1.1.3)', () => {
  /** Price and cost from the prompt: the inputs cost under half the price, so the larger is the price. */
  function perItem(b: Generated) {
    const m = pounds(b.question.prompt)
    expect(m).toHaveLength(2)
    return { price: Math.max(...m), cost: Math.min(...m) }
  }

  it('q11: a craft business, price − cost of the materials, with the definition as a method mark', () => {
    const built = build('enterprise-value-added-craft', 'q11')
    for (const b of built) {
      const { price, cost } = perItem(b)
      const c = ENTERPRISE.CRAFTS.find((x) => x.name === b.values.context)!
      expect(answer(b)).toBe(price - cost)
      expect(price).toBeGreaterThanOrEqual(c.price[0])
      expect(price).toBeLessThanOrEqual(c.price[1])
      expect(cost / price).toBeGreaterThanOrEqual(0.15)
      expect(cost / price).toBeLessThanOrEqual(0.45)
      expect(b.question.prompt).toMatch(/^A craft business /)
      expect(b.question.prompt).toMatch(/Calculate the value added per \w+\.$/)
      // q18 on the same sheet restores a chair.
      expect(b.question.prompt).not.toMatch(/chair|restor/)
      expect(methods(b)).toEqual(['added value $=$ price $-$ cost of inputs', `$${price} - ${cost}$`])
      expect(b.question.markScheme.at(-1)!.description).toBe(`£${price - cost}`)
      expect(b.question.solution).toContain(`= ${price} - ${cost} = £${price - cost}$`)
      expect(b.question.solution).toContain('It is **not** the profit on its own.')
      // Wrong routes: price and cost added, the cost or the price read off.
      for (const wrong of [price + cost, cost, price]) expect(accepts(b, String(wrong))).toBe(false)
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(ENTERPRISE.CRAFTS.length)
  })

  it('q21: a maker, the time and workshop rent not subtracted', () => {
    const built = build('enterprise-value-added-maker', 'q21')
    for (const b of built) {
      const { price, cost } = perItem(b)
      const m = ENTERPRISE.MAKERS.find((x) => x.name === b.values.context)!
      expect(answer(b)).toBe(price - cost)
      expect(price >= m.price[0] && price <= m.price[1]).toBe(true)
      expect(cost / price >= m.share[0] && cost / price <= m.share[1]).toBe(true)
      expect(b.question.prompt).toMatch(new RegExp(`^A ${m.maker} `))
      expect(b.question.prompt).toContain(`per ${m.item}.`)
      expect(methods(b)).toEqual([`$${price} - ${cost}$`])
      expect(b.question.solution).toContain(`The ${m.maker}'s time and the rent of the workshop were not bought in to make the ${m.item}`)
      for (const wrong of [price + cost, cost, price]) expect(accepts(b, String(wrong))).toBe(false)
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(ENTERPRISE.MAKERS.length)
    // A necklace from £25 to £120, as the brief's ranges have it.
    expect(ENTERPRISE.MAKERS.find((m) => m.name === 'necklace')!.price).toEqual([25, 120])
  })

  it('q29: value added per item times what is sold in the week or month; revenue is marked wrong', () => {
    const built = build('enterprise-value-added-total', 'q29')
    for (const b of built) {
      const p = b.question.prompt
      const { price, cost } = perItem(b)
      const period = /In one (week|month) /.exec(p)![1] as 'week' | 'month'
      const q = Number(/ sells (\d+) /.exec(p)![1])
      const s = ENTERPRISE.SELLERS.find((x) => x.name === b.values.context)!
      expect(answer(b)).toBe((price - cost) * q)
      expect(p).toMatch(new RegExp(`Calculate the total value added in the ${period}\\.$`))
      expect(price >= s.price[0] && price <= s.price[1]).toBe(true)
      expect(q >= s[period][0] && q <= s[period][1]).toBe(true)
      expect([price, cost, price - cost]).not.toContain(q)
      expect(methods(b)).toEqual([`$${price} - ${cost} = ${price - cost}$`, `$${price - cost} \\times ${q}$`])
      expect(b.question.solution).toContain(`= ${price - cost} \\times ${q} = £${tex(answer(b))}$`)
      expect(b.question.solution).toContain('is not profit')
      // Wrong routes: revenue, the cost of the inputs, value added per item alone.
      for (const wrong of [price * q, cost * q, price - cost, (price + cost) * q]) expect(accepts(b, String(wrong))).toBe(false)
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(ENTERPRISE.SELLERS.length)
    expect(new Set(built.map((b) => b.values.period)).size).toBe(2)
  })

  it('q21 and q29 share a sheet and never sell the same thing', () => {
    const makers = new Set(ENTERPRISE.MAKERS.map((m) => m.item))
    for (const s of ENTERPRISE.SELLERS) expect(makers.has(s.item)).toBe(false)
    const higher = ['q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q21', 'q26', 'q28', 'q29', 'q31'].map(slotOf)
    for (let i = 0; i < 50; i++) {
      const sheet = sheetQuestions('business', TOPIC, higher, `sheet-${i}`)
      expect(sheet.filter((x) => x.generated).length).toBe(3)
    }
  })
})

describe('value added and profit (1.1.3)', () => {
  it('q12: value added × quantity − fixed costs; forgetting or doubling the fixed costs is marked wrong', () => {
    const built = build('enterprise-value-added-profit', 'q12')
    for (const b of built) {
      const p = b.question.prompt
      const [v, fixed] = pounds(p) as [number, number]
      const n = Number(/sells (\d+) /.exec(p)![1])
      const c = ENTERPRISE.ADDERS.find((x) => x.name === b.values.context)!
      const total = v * n
      expect(answer(b)).toBe(total - fixed)
      expect(p).toMatch(/Its fixed costs are £[\d ]+ a month\. Calculate its profit for the month\.$/)
      expect(v >= c.added[0] && v <= c.added[1]).toBe(true)
      expect(n >= c.sold[0] && n <= c.sold[1]).toBe(true)
      expect(fixed % 100).toBe(0)
      expect(fixed / total >= 0.45 && fixed / total <= 0.85).toBe(true)
      expect([fixed, v, n]).not.toContain(answer(b))
      expect(methods(b)).toEqual([`$${v} \\times ${tex(n)} = ${tex(total)}$`, 'added value understood as covering fixed costs', `$${tex(total)} - ${tex(fixed)}$`])
      expect(b.question.solution).toContain(`profit $= ${tex(total)} - ${tex(fixed)} = £${tex(answer(b))}$`)
      expect(b.question.solution).toContain('That is what is left after the bought-in inputs, so profit')
      expect(b.question.solution).not.toContain('materials')
      for (const wrong of [total, total - 2 * fixed, fixed, v * n + fixed]) expect(accepts(b, String(wrong))).toBe(false)
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(ENTERPRISE.ADDERS.length)
  })

  it('q12 never shares a context with q11 on the advanced sheet, so it never prints the value added q11 asks for', () => {
    const crafts = new Set(ENTERPRISE.CRAFTS.map((c) => c.name))
    for (const a of ENTERPRISE.ADDERS) expect(crafts.has(a.name), a.name).toBe(false)
    const advanced = ['q11', 'q12', 'q13', 'q18', 'q16', 'q14', 'q15', 'q17', 'q27', 'q30', 'q32', 'q33', 'q34'].map(slotOf)
    for (let i = 0; i < 300; i++) {
      const sheet = sheetQuestions('business', TOPIC, advanced, `advanced-${i}`)
      const q11 = sheet.find((x) => x.question.id === 'q11')!.generated!
      const q12 = sheet.find((x) => x.question.id === 'q12')!.generated!
      expect(q11.values.context).not.toBe(q12.values.context)
      expect(q12.question.prompt).not.toMatch(/each item|candle/)
    }
  })
})

describe('risk and reward (1.1.2)', () => {
  it('q28: the rise over the first profit, never over the second', () => {
    const built = build('enterprise-profit-percentage-increase', 'q28')
    for (const b of built) {
      const [before, after] = pounds(b.question.prompt) as [number, number]
      const rise = after - before
      const p = (rise * 100) / before
      expect(answer(b)).toBe(p)
      expect(p >= 8 && p <= 60).toBe(true)
      expect(before % 100).toBe(0)
      expect(rise % 10).toBe(0)
      expect([1000, 10000, 100000]).not.toContain(before)
      // Wrong routes: over the new profit, the new as a percentage of the old, the rise itself.
      for (const wrong of [(rise / after) * 100, (after / before) * 100, rise]) expect(Math.abs(wrong - p)).toBeGreaterThan(0.5)
      expect(accepts(b, String(Math.round((rise / after) * 100)))).toBe(false)
      // No printed figure reads off as the answer (£2400 with 24%).
      for (const f of [before, after, rise]) for (const k of [1, 10, 100, 1000]) expect(f / k).not.toBe(p)
      expect(methods(b)).toEqual([`$\\dfrac{${tex(after)} - ${tex(before)}}{${tex(before)}} \\times 100$`])
      expect(b.question.solution).toContain(`\\times 100 = ${p}\\%$`)
      expect(b.question.markScheme.at(-1)!.description).toBe(`${p}%`)
      expect(b.question.prompt).toMatch(/Calculate the percentage increase in profit\.$/)
    }
    expect(new Set(built.map((b) => b.values.form)).size).toBe(3)
  })

  it('q30: profit (revenue − total costs) less the salary given up, with pronouns that agree', () => {
    const built = build('enterprise-profit-against-salary', 'q30')
    for (const b of built) {
      const p = b.question.prompt
      const [salary, revenue, costs] = pounds(p) as [number, number, number]
      const made = revenue - costs
      expect(answer(b)).toBe(made - salary)
      const v = ENTERPRISE.VENTURES.find((x) => x.name === b.values.venture)!
      expect(revenue >= v.revenue[0] && revenue <= v.revenue[1]).toBe(true)
      expect(revenue % 1000).toBe(0)
      expect(salary >= 18000 && salary <= 40000 && salary % 500 === 0).toBe(true)
      // The venture's own margin: food businesses at most 42%, services at most 65%.
      expect(made / revenue >= v.margin[0] && made / revenue <= v.margin[1], `${v.name} ${made}/${revenue}`).toBe(true)
      if (['catering business', 'bakery'].includes(v.name)) expect(made / revenue).toBeLessThanOrEqual(0.42)
      expect(answer(b) >= 500 && answer(b) <= 15000).toBe(true)
      // Wrong routes: costs ignored, salary ignored, costs − salary; no figure equals another.
      for (const wrong of [revenue - salary, made, costs - salary, salary - made]) expect(accepts(b, String(wrong))).toBe(false)
      expect(new Set([salary, revenue, costs, made, answer(b)]).size).toBe(5)
      const person = ENTERPRISE.PEOPLE.find((x) => x.name === b.values.person)!
      const [she, her] = person.she === 'she' ? ['She', 'her'] : ['He', 'his']
      expect(p).toContain(`${person.name} earned a salary of`)
      expect(p).toContain(`. ${she} left ${her} job to run ${her} own ${v.name}.`)
      expect(p).toContain(`than ${she.toLowerCase()} would have earned from ${her} salary.`)
      expect(b.question.solution).not.toMatch(person.she === 'she' ? /\b(he|his)\b/ : /\b(she|her)\b/)
      expect(methods(b)).toEqual([`$${tex(revenue)} - ${tex(costs)} = ${tex(made)}$`, `$${tex(made)} - ${tex(salary)}$`])
      expect(b.question.solution).toContain(`$${tex(made)} - ${tex(salary)} = £${tex(answer(b))}$ more`)
    }
    expect(new Set(built.map((b) => b.values.venture)).size).toBe(ENTERPRISE.VENTURES.length)
  })
})
