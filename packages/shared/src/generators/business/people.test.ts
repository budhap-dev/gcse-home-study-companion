import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { PEOPLE, peopleGenerators } from './people.ts'

/**
 * Structural tests for the Topic 2.5 generators. Each reads the prompt's own figures back
 * ("£1,600", "120 staff") and works the answer from them alone, with no code shared with the
 * generator; checks every printed step against literal text, the routing, the named wrong routes
 * (staff over leavers, a percentage fall for percentage points, stopping at the supervisors,
 * commission alone, the gross saving before the programme's cost), the contexts' ranges, and
 * that no answer, input or calculation takes over a slot.
 */
const TOPIC = 'making-human-resource-decisions'
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/business')
const bank = Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8')).questions)
const slotOf = (id: string) => bank.find((q) => q.id === id)!

function build(generatorId: string, slotId: string, count = 300, prefix = 'structure'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  return Array.from({ length: count }, (_, i) => generate(g, slotOf(slotId), `${prefix}-${i}`))
}

const FIGURE = /(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)/g
/** Every figure in a text, in order: "£1,600" is 1600. */
const figures = (text: string) => [...text.matchAll(FIGURE)].map((m) => Number(m[1]!.replace(/,/g, '')))
const pounds = (text: string) => [...text.matchAll(/£(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]!.replace(/,/g, '')))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const methods = (b: Generated) => b.question.markScheme.slice(0, -1).map((l) => l.description)
const accepts = (b: Generated, typed: string) => mark(b.question, typed).correct
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9
/** As the comma-style questions print: £2,800 in prose, 2{,}800 in maths. */
const comma = (x: number) => x.toLocaleString('en-GB')
const texComma = (x: number) => comma(x).replace(/,/g, '{,}')
const readsOff = (a: number, fs: number[]) => fs.some((f) => [1, 10, 100, 1000, 10000, 100000, 1000000].some((k) => near(f / k, a) || near(f * k, a)))
/** The worst share of one key within each context, over many builds. */
function perContext(built: Generated[], key: (b: Generated) => unknown) {
  const by = new Map<unknown, Generated[]>()
  for (const b of built) by.set(b.values.context, [...(by.get(b.values.context) ?? []), b])
  return Math.max(...[...by.values()].map((bs) => share(bs, key).worst))
}
const within = (x: number, [lo, hi]: readonly [number, number]) => x >= lo && x <= hi
/** A wrong route as a student would type it: unrounded, whole, and to 1 d.p. */
const typed = (x: number) => [x, Math.round(x), Math.round(x * 10) / 10]

function share(built: Generated[], key: (b: Generated) => unknown) {
  const counts = new Map<unknown, number>()
  for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / built.length, distinct: counts.size }
}

const SLOTS: [string, string][] = [
  ['people-staff-turnover', 'q5'],
  ['people-turnover-points', 'q12'],
  ['people-hierarchy-managers', 'q24'],
  ['people-commission', 'q25'],
  ['people-training-saving', 'q26'],
]

describe('every people build', () => {
  it('cites staff turnover as an Appendix 2 skill, not an Appendix 3 formula', () => {
    const header = readFileSync(join(import.meta.dirname, 'people.ts'), 'utf8').split('const TOPIC')[0]!
    expect(header).toContain('Staff turnover is an Appendix 2 skill')
    expect(header).toContain('not an Appendix 3 formula')
    for (const ref of ['2.5.1', '2.5.3', '2.5.4']) expect(header).toContain(ref)
    expect(header).not.toMatch(/AQA/)
  })

  it('has a generator for each numeric written slot, routed to its own builder', () => {
    expect(peopleGenerators.flatMap((g) => g.replaces).sort()).toEqual(bank.filter((q) => q.type === 'numeric').map((q) => q.id).sort())
    for (const [id, slot] of SLOTS) expect(peopleGenerators.find((g) => g.id === id)!.replaces).toEqual([slot])
    for (const g of peopleGenerators) expect(() => g.build(() => 0.5, slotOf('q1'), 0)).toThrow(/no builder/)
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
      const units = (slotOf(slotId) as { units?: string }).units
      for (const b of build(id, slotId, 100)) {
        const a = answer(b)
        expect(accepts(b, String(a)), b.seed).toBe(true)
        const withUnit = units === '£' ? `£${a}` : units ? `${a} ${units}` : slotId === 'q5' ? `${a}%` : `${a} percentage points`
        expect(accepts(b, withUnit), `${b.seed} ${withUnit}`).toBe(true)
        if (a >= 1000) {
          expect(accepts(b, comma(a))).toBe(true)
          expect(accepts(b, `£${comma(a)}`)).toBe(true)
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
      // q24's managers run 2 to 12, eleven answers drawn evenly.
      expect(answers.worst, `${id} answer`).toBeLessThanOrEqual(slotId === 'q24' ? 0.13 : 0.1)
      expect(answers.distinct, `${id} answers`).toBeGreaterThanOrEqual(10)
      expect(share(many, (b) => figures(b.question.prompt).join(',')).worst, `${id} calculation`).toBeLessThan(1 / 6)
      for (const [k, v] of Object.entries(many[0]!.values)) if (typeof v === 'number') expect(share(many, (b) => b.values[k]).worst, `${id} ${k}`).toBeLessThanOrEqual(0.4)
    }
  })
})

describe('training, motivation and retention: staff turnover (2.5.3)', () => {
  it('q5: leavers over staff, × 100', () => {
    const built = build('people-staff-turnover', 'q5')
    for (const b of built) {
      const p = b.question.prompt
      const m = /has (\d+) staff and (\d+) leave/.exec(p) ?? /year (\d+) of the (\d+) staff/.exec(p)!
      const [N, L] = p.startsWith('Last year') ? [Number(m[2]), Number(m[1])] : [Number(m[1]), Number(m[2])]
      const t = (L * 100) / N
      expect(answer(b)).toBe(t)
      const e = PEOPLE.EMPLOYERS.find((x) => x.name === b.values.context)!
      expect(within(N, e.staff) && within(t, e.turnover)).toBe(true)
      expect(p.toLowerCase()).toContain(e.who)
      expect(N).not.toBe(100)
      expect(t).not.toBe(50)
      // Staff over leavers, over those who stayed, the leavers themselves.
      for (const wrong of [...typed((N / L) * 100), ...typed((L / (N - L)) * 100), L]) expect(accepts(b, String(wrong)), `${b.seed} ${wrong}`).toBe(false)
      expect(readsOff(t, [N, L])).toBe(false)
      expect(methods(b)).toEqual([`leavers ÷ total staff × 100: $${L} \\div ${N} \\times 100$`])
      expect(b.question.solution.startsWith(`$(${L} \\div ${N}) \\times 100 = $ **${t}%**.`)).toBe(true)
      expect(b.question.markScheme.at(-1)!.description).toBe(String(t))
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(PEOPLE.EMPLOYERS.length)
    // Fix 6: staff counts spread within each employer as well as overall, answers still spread.
    const many = build('people-staff-turnover', 'q5', 3000, 'staff')
    expect(share(many, (b) => b.values.staff).worst).toBeLessThanOrEqual(0.1)
    expect(perContext(many, (b) => b.values.staff)).toBeLessThanOrEqual(0.22)
    expect(share(many, answer).worst).toBeLessThanOrEqual(0.08)
  })

  it('q12: the difference of the two turnovers in percentage points, not a percentage fall', () => {
    const built = build('people-turnover-points', 'q12')
    for (const b of built) {
      const [N, L1, L2] = figures(b.question.prompt) as [number, number, number]
      const p1 = (L1 * 100) / N
      const p2 = (L2 * 100) / N
      const d = p1 - p2
      expect(answer(b)).toBe(d)
      expect(Number.isInteger(p1) && Number.isInteger(p2)).toBe(true)
      expect(d >= 4 && d <= 20 && p2 >= 4 && 3 * p2 >= p1).toBe(true)
      const e = PEOPLE.EMPLOYERS.find((x) => x.name === b.values.context)!
      expect(within(N, e.staff) && within(p1, e.turnover)).toBe(true)
      // The percentage fall in turnover, either turnover alone, the fall in leavers.
      for (const wrong of [...typed((d / p1) * 100), p1, p2, L1 - L2]) expect(accepts(b, String(wrong)), `${b.seed} ${wrong}`).toBe(false)
      expect(readsOff(d, [N, L1, L2])).toBe(false)
      expect(methods(b)).toEqual([`calculates ${p1}%`, `calculates ${p2}%`])
      expect(b.question.solution).toBe(
        `Before: $(${L1} \\div ${N}) \\times 100 = ${p1}\\%$. After: $(${L2} \\div ${N}) \\times 100 = ${p2}\\%$. The fall is **${d} percentage points**, which is ${L1 - L2} fewer ${L1 - L2 === 1 ? 'person' : 'people'} to recruit, induct and train.`,
      )
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(PEOPLE.EMPLOYERS.length)
    // Fix 5: no staff count in over 15% of builds (200, 300 and 400 took 78% of the odd falls).
    const many = build('people-turnover-points', 'q12', 2000, 'staff')
    expect(share(many, (b) => b.values.staff).worst).toBeLessThanOrEqual(0.15)
    const odd = many.filter((b) => answer(b) % 2 === 1)
    expect(share(odd, (b) => b.values.staff).worst).toBeLessThanOrEqual(0.2)
  })

  it('q26: replacement costs now less replacement costs with the programme and its cost', () => {
    const built = build('people-training-saving', 'q26')
    for (const b of built) {
      const [N, L1, cost, P, L2] = figures(b.question.prompt) as [number, number, number, number, number]
      const now = L1 * cost
      const after = L2 * cost + P
      const S = now - after
      expect(answer(b)).toBe(S)
      const p1 = (L1 * 100) / N
      const p2 = (L2 * 100) / N
      expect(Number.isInteger(p1) && Number.isInteger(p2) && p1 - p2 >= 5 && p2 >= 0.45 * p1).toBe(true)
      const c = PEOPLE.RETAINERS.find((x) => x.name === b.values.context)!
      expect(within(N, c.staff) && within(p1, c.turnover) && within(cost, c.cost)).toBe(true)
      expect(b.question.prompt.startsWith(`${c.who} has `)).toBe(true)
      expect(P % 1000 === 0 && P >= 5000 && P <= 80000).toBe(true)
      expect(S >= 1000).toBe(true)
      // The gross saving (the programme's cost forgotten), the cost added, either year's replacement bill.
      // Fix 1: "cut to" read as "cut by" (leavers after = L1 − L2) gives L2 × cost − programme.
      expect(L1).not.toBe(2 * L2)
      for (const wrong of [(L1 - L2) * cost, (L1 - L2) * cost + P, now, L2 * cost, after, L2 * cost - P]) expect(accepts(b, String(wrong)), `${b.seed} ${wrong}`).toBe(false)
      expect([P, cost]).not.toContain(S)
      expect(readsOff(S, [N, L1, L2, cost, P]), b.seed).toBe(false)
      expect(readsOff(P, [N, L1, L2]), b.seed).toBe(false)
      expect(methods(b)).toEqual([`$${L1} \\times ${texComma(cost)} = ${texComma(now)}$`, `$${L2} \\times ${texComma(cost)} + ${texComma(P)} = ${texComma(after)}$`])
      expect(b.question.solution).toContain(`Saving $= ${texComma(now)} - ${texComma(after)} =$ **£${comma(S)}**.`)
      expect(b.question.solution).toContain(`falls from $${L1} \\div ${N} \\times 100 = ${p1}\\%$ to $${L2} \\div ${N} \\times 100 = ${p2}\\%$`)
      expect(b.question.markScheme.at(-1)!.description).toBe(`£${comma(S)}`)
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(PEOPLE.RETAINERS.length)
    // Fix 2: no pair of turnovers in over 20% of an employer's builds (accountancy 20% → 10% took 59%).
    const many = build('people-training-saving', 'q26', 2000, 'pairs')
    expect(perContext(many, (b) => `${(Number(b.values.before) * 100) / Number(b.values.staff)}/${(Number(b.values.after) * 100) / Number(b.values.staff)}`)).toBeLessThanOrEqual(0.2)
    expect(perContext(many, (b) => b.values.staff)).toBeLessThanOrEqual(0.15)
  })
})

describe('organisational structures and motivation (2.5.1, 2.5.4)', () => {
  it('q24: staff over the first span, then over the second; stopping at the middle layer is wrong', () => {
    const built = build('people-hierarchy-managers', 'q24')
    for (const b of built) {
      const [N, s1, s2] = figures(b.question.prompt) as [number, number, number]
      const sup = N / s1
      const m = sup / s2
      expect(answer(b)).toBe(m)
      expect(Number.isInteger(sup) && Number.isInteger(m)).toBe(true)
      expect(m >= 2 && m <= 12 && s2 >= 3 && s2 <= 8 && s1 >= 4 && s1 <= 12).toBe(true)
      expect(new Set([m, s1, s2]).size).toBe(3)
      const h = PEOPLE.HIERARCHIES.find((x) => x.name === b.values.context)!
      expect(N).toBeLessThanOrEqual(h.most)
      expect(b.question.prompt).toContain(`Each ${h.middle} has ${s1} operational staff`)
      // The middle layer, the staff over the second span, over the sum of the spans.
      for (const wrong of [sup, N / s2, N / (s1 + s2)]) expect(near(wrong, m), b.seed).toBe(false)
      expect(accepts(b, String(sup))).toBe(false)
      expect(readsOff(m, [N, sup])).toBe(false)
      expect(methods(b)).toEqual([`$${N} \\div ${s1} = ${sup}$ ${h.middle}s`])
      expect(b.question.solution).toContain(`$${N} \\div ${s1} = ${sup}$. Managers: $${sup} \\div ${s2} = ${m}$.`)
      expect(b.question.markScheme.at(-1)!.description).toBe(`${m} managers`)
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(PEOPLE.HIERARCHIES.length)
  })

  it('q25: the basic salary plus the rate of the sales; commission alone is wrong', () => {
    const built = build('people-commission', 'q25')
    for (const b of built) {
      const p = b.question.prompt
      const [basic, sales] = pounds(p) as [number, number]
      const rate = Number(/commission of ([\d.]+)%/.exec(p)![1])
      const C = (sales * rate) / 100
      const T = basic + C
      expect(answer(b)).toBe(T)
      expect(Number.isInteger(C) && C !== basic).toBe(true)
      const c = PEOPLE.SELLERS.find((x) => x.name === b.values.context)!
      expect(within(basic, c.basic) && within(sales, [c.sales[0], c.sales[1]]) && c.rates.includes(rate)).toBe(true)
      // Fix 4: a month's pay in scale; a car salesperson on 0.5% to 1.5%, a kitchen designer on 2% to 5% of up to £80,000.
      expect(T).toBeLessThanOrEqual(5000)
      expect(basic).toBeGreaterThanOrEqual(1700)
      if (c.name === 'cars') expect(rate >= 0.5 && rate <= 1.5).toBe(true)
      if (c.name === 'kitchens') expect(rate >= 2 && rate <= 5 && sales <= 80000).toBe(true)
      expect(p.startsWith(`${c.who} is paid`) && p.includes(` ${c.goods}.`)).toBe(true)
      expect(/ she sells .* her total pay| he sells .* his total pay/.test(p)).toBe(true)
      // Commission alone, the rate unscaled, the rate read as tenths, the basic grown by the rate, commission on the pay too.
      for (const wrong of [C, basic + sales * rate, basic + (sales * rate) / 10, basic * (1 + rate / 100), basic + ((basic + sales) * rate) / 100]) expect(accepts(b, String(wrong)), `${b.seed} ${wrong}`).toBe(false)
      expect(readsOff(T, [basic, sales, C])).toBe(false)
      expect(methods(b)).toEqual([`$${rate / 100} \\times ${texComma(sales)} = ${texComma(C)}$`])
      expect(b.question.solution).toContain(`Commission $= ${rate}\\% \\times ${texComma(sales)} = ${rate / 100} \\times ${texComma(sales)} = £${texComma(C)}$.`)
      expect(b.question.solution).toContain(`$= ${texComma(basic)} + ${texComma(C)} =$ **£${comma(T)}**.`)
      expect(b.question.markScheme.at(-1)!.description).toBe(`£${comma(T)}`)
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(PEOPLE.SELLERS.length)
  })
})
