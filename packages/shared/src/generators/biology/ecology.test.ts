import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { ECOLOGY, ecologyGenerators } from './ecology.ts'

/**
 * Structural tests for the ecology, decay and plant hormone generators. Each reads the prompt's
 * own figures back, works the answer again from them alone with plain arithmetic, and checks every
 * printed step: the mean per quadrat and the ÷ 0.25, the two losses taken from the energy captured,
 * the change in mass before the division by time, the rates found before they are compared, the
 * increases in length found before they are divided. Across builds they check every context turns
 * up, every figure is real for what is named, and that no answer or input fills a context. Some
 * lines are checked as literal text, never rebuilt with the generator's own helpers.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/biology')
const bankOf = (topic: string) => Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${topic}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300, prefix = 'structure'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = bankOf(g.topicId).find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `${prefix}-${i}`))
}

/** A figure as plain arithmetic prints it, free of binary residue. */
const c = (x: number) => Number(x.toPrecision(12))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const method = (b: Generated) => b.question.markScheme.slice(0, -1).map((l) => l.description)
const last = (b: Generated) => b.question.markScheme.at(-1)!.description
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context)).size
const sigFigures = (x: number) => String(c(x)).replace('.', '').replace(/^0+/, '').replace(/0+$/, '').length
const decimals = (x: number) => (String(c(x)).split('.')[1] ?? '').length
/** A number from the prompt, read with its thin-space thousands: "14 000" is 14000. */
const num = (re: RegExp, s: string) => {
  const m = re.exec(s)
  if (!m) throw new Error(`${re} not in: ${s}`)
  return Number(m[1]!.replace(/ /g, ''))
}
const within = (x: number, lo: number, hi: number) => x >= lo - 1e-9 && x <= hi + 1e-9
const isPowerOfTen = (x: number) => Math.abs(Math.log10(Math.abs(x)) - Math.round(Math.log10(Math.abs(x)))) < 1e-9
/** In maths, from five digits a thin space between thousands: 14\\,000. */
const texed = (x: number) => (x >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : String(x))
/** In prose, from five digits a space between thousands: 14 000. */
const spaced = (x: number) => (x >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : String(x))
const WORDS: Record<string, number> = { ten: 10, twelve: 12, fifteen: 15, twenty: 20, five: 5, six: 6, eight: 8 }

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
function spread(id: string, slot: string, keys: string[], fewest = 10) {
  const many = build(id, slot, 2000, 'spread')
  const a = worstShare(many, answer)
  expect(a.worst, `${id} ${slot} answer`).toBeLessThanOrEqual(0.4)
  expect(a.fewest, `${id} ${slot} answers per context`).toBeGreaterThanOrEqual(fewest)
  for (const k of keys) expect(worstShare(many, (b) => b.values[k]).worst, `${id} ${slot} ${k}`).toBeLessThanOrEqual(0.4)
}

/** The written answer box takes this: the answer to three significant figures. */
const threeSf = (x: number) => Number(x.toPrecision(3))

describe('every ecology build', () => {
  it('has a generator for each numeric written slot in the three topics', () => {
    const claimed = ecologyGenerators.flatMap((g) => g.replaces.map((id) => `${g.topicId}/${id}`)).sort()
    expect(claimed).toEqual(
      [
        ...['q6', 'q11', 'q19', 'q20', 'q30', 'q31'].map((q) => `ecosystems-and-interdependence/${q}`),
        ...['q11', 'q12', 'q19', 'q30', 'q31'].map((q) => `material-cycles/${q}`),
        ...['q25', 'q26'].map((q) => `plant-adaptations-defences-and-hormones/${q}`),
      ].sort(),
    )
  })

  it('prints no article before a figure, keeps the written units, and is marked right with its own answer and its three-figure rounding', () => {
    for (const g of ecologyGenerators) {
      for (const id of g.replaces) {
        const slot = bankOf(g.topicId).find((q) => q.id === id)!
        for (const b of build(g.id, id, 150)) {
          expect(b.question.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
          expect(b.question.type === 'numeric' && b.question.units, `${g.id} ${id}`).toBe(slot.type === 'numeric' && slot.units)
          expect(b.question.solution, b.seed).toContain(String(answer(b)))
          expect(mark(b.question, String(answer(b))).correct, b.seed).toBe(true)
          expect(mark(b.question, String(threeSf(answer(b)))).correct, `${b.seed} ${answer(b)}`).toBe(true)
          expect(tolerance(b), b.seed).toBeLessThanOrEqual(Math.abs(answer(b)) * 0.02)
        }
      }
    }
  })

  it('never fails to draw, over 3000 seeds per slot', () => {
    for (const g of ecologyGenerators) {
      for (const s of g.replaces) {
        const slot = bankOf(g.topicId).find((q) => q.id === s)!
        expect(() => {
          for (let i = 0; i < 3000; i++) generate(g, slot, `throw-${i}`)
        }, `${g.id} ${s}`).not.toThrow()
      }
    }
  }, 120_000)
})

// =============================================================================================
// Quadrats
// =============================================================================================

describe('quadrats', () => {
  const patch = (name: string) => ECOLOGY.PATCHES.find((p) => p.name === name)!

  it('q6: a mean per 1 m² quadrat is the density, times the area', () => {
    const built = build('quadrat-mean-estimate', 'q6')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = patch(b.values.context as string)
      const n = WORDS[/^(\w+) 1 m² quadrats|places (\w+) 1 m² quadrats/i.exec(p)!.slice(1).find(Boolean)!.toLowerCase()]!
      const mean = num(/mean of ([\d.]+)/, p)
      const area = num(/area of ([\d ]+) m²/, p)
      expect([10, 12, 15, 20]).toContain(n)
      expect(Number.isInteger(c(mean * n)), b.seed).toBe(true)
      expect(within(mean, ...ctx.density)).toBe(true)
      expect(ctx.areas).toContain(area)
      expect(answer(b)).toBe(c(mean * area))
      // Never the area, nor the mean, with the point moved, doubled or halved: 7.9 × 5000 = 39 500 would be.
      for (const g of [area, mean]) for (const x of [g, g * 2, g / 2]) expect(isPowerOfTen(answer(b) / x), `${b.seed} ${mean} × ${area}`).toBe(false)
      // An estimate from a few quadrats: three figures at most, and exact.
      expect(sigFigures(answer(b)), b.seed).toBeLessThanOrEqual(3)
      expect(p).toContain(`${ctx.at} the`)
      expect(b.question.solution).toContain(`Each quadrat is 1 m², so a mean of ${mean} per quadrat is ${mean} per m².`)
      expect(b.question.solution).toContain(`The number of quadrats, ${n}, does not enter the calculation: more quadrats make the mean more reliable.`)
      expect(b.question.solution).toContain(
        answer(b) < 10000 ? `$${mean} \\times ${area} = ${answer(b)}$ ${ctx.organism}.` : `$${mean} \\times ${texed(area)}$, which is **${answer(b)} ${ctx.organism}**`,
      )
      expect(method(b)).toEqual([`finds the number per square metre, ${mean}`, `multiplies by the area of ${spaced(area)} m²`])
      expect(tolerance(b)).toBe(0)
      // Multiplying by the number of quadrats as well is marked wrong.
      expect(mark(b.question, String(c(mean * area * n))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(ECOLOGY.PATCHES.length)
    // The written slot's figures: a mean of 6 over 2000 m².
    expect(c(6 * 2000)).toBe(12000)
    spread('quadrat-mean-estimate', 'q6', ['n', 'mean', 'area'])
  })

  it('q19: total ÷ quadrats is the mean, ÷ 0.25 the density, × the area the estimate', () => {
    const built = build('quadrat-quarter-metre-estimate', 'q19')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = patch(b.values.context as string)
      const n = num(/ (\d+) quadrats/, p)
      const total = num(/(?:quadrats is|Altogether) (\d+)/, p)
      const area = num(/(?:of|area of) ([\d ]+) m²[.,]/, p)
      expect(p).toContain('0.25 m²')
      const mean = c(total / n)
      const density = c(mean / 0.25)
      expect(decimals(mean), b.seed).toBeLessThanOrEqual(2)
      expect(within(density, ...ctx.density)).toBe(true)
      expect(ctx.areas).toContain(area)
      expect(answer(b)).toBe(c(density * area))
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(sigFigures(answer(b)), b.seed).toBeLessThanOrEqual(3)
      expect(tolerance(b)).toBe(0)
      for (const g of [area, mean, density]) for (const x of [g, g * 2, g / 2]) expect(isPowerOfTen(answer(b) / x), b.seed).toBe(false)
      expect(p).toContain(`${ctx.place} `)
      expect(p).toMatch(new RegExp(`Estimate the (?:total )?number of ${ctx.organism} ${ctx.at} the ${ctx.noun}\\.$`))
      expect(b.question.solution).toContain(`Mean per quadrat $= ${total} \\div ${n} = ${mean}$. Each quadrat is only $0.25$ m², so the density is $${mean} \\div 0.25 = ${density}$ per m².`)
      expect(b.question.solution).toContain(answer(b) < 10000 ? `$${density} \\times ${area} = ${answer(b)}$` : `$${density} \\times ${texed(area)}$, which is **${answer(b)} `)
      expect(method(b)).toEqual([`finds the mean per quadrat, ${mean}`, `divides by 0.25 to get ${density} per square metre`])
      // Forgetting the 0.25 m², or multiplying by it, is marked wrong.
      expect(mark(b.question, String(c(mean * area))).correct).toBe(false)
      expect(mark(b.question, String(c(mean * 0.25 * area))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(ECOLOGY.PATCHES.length)
    spread('quadrat-quarter-metre-estimate', 'q19', ['n', 'total', 'area'])
  })

  it('every patch is "on" a school or playing field, lawn or shore and "in" a park, pasture, meadow or field, in each sentence', () => {
    for (const x of [...ECOLOGY.PATCHES, ...ECOLOGY.COUNTED]) {
      expect(x.place.startsWith(`${x.at} `)).toBe(true)
      // On a school or playing field, a lawn or a shore; in a park, pasture, meadow or farmer's field.
      expect(x.at, x.place).toBe(/school field|playing field|lawn|shore/.test(x.place) ? 'on' : 'in')
    }
    for (const [id, slot] of [['quadrat-mean-estimate', 'q6'], ['quadrat-quarter-metre-estimate', 'q19'], ['quadrat-counts-estimate', 'q30']] as const) {
      for (const b of build(id, slot, 200)) {
        expect(b.question.prompt, b.seed).not.toMatch(/\bin (?:the |the whole |a )(?:school field|playing field|lawn|shore|rocky shore)\b|\bon (?:the |the whole |a )(?:park|pasture|meadow)\b/)
        if (b.values.context === 'limpets') expect(b.question.prompt).toMatch(/limpets on the (?:whole )?shore[.,]/)
      }
    }
  })

  it('q19: the written figures give the written answer', () => {
    // 90 buttercups in twenty 0.25 m² quadrats in 1500 m²: 4.5, 18, 27000.
    expect(c((90 / 20 / 0.25) * 1500)).toBe(27000)
  })

  it('q30: the counts summed and shared, times the area', () => {
    const built = build('quadrat-counts-estimate', 'q30')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = ECOLOGY.COUNTED.find((x) => x.name === b.values.context)!
      const counts = /(?:counts|counts are) ((?:\d+, )*\d+ and \d+)/.exec(p)![1]!.split(/, | and /).map(Number)
      const n = WORDS[/places (\w+) 1 m² quadrats/.exec(p)![1]!]!
      const area = num(/(?:of|area of) ([\d ]+) m²/, p)
      expect(counts).toHaveLength(n)
      expect([5, 6, 8, 12]).toContain(n)
      for (const k of counts) expect(within(k, ...ctx.density)).toBe(true)
      expect(new Set(counts).size).toBeGreaterThanOrEqual(Math.max(3, n / 2))
      expect(ctx.areas).toContain(area)
      const total = counts.reduce((s, k) => s + k, 0)
      const mean = c(total / n)
      expect(answer(b)).toBe(c(mean * area))
      expect(sigFigures(answer(b)), b.seed).toBeLessThanOrEqual(3)
      expect(tolerance(b)).toBe(0)
      for (const g of [area, mean]) for (const x of [g, g * 2, g / 2]) expect(isPowerOfTen(answer(b) / x), b.seed).toBe(false)
      expect(p).toMatch(new RegExp(`Estimate the number of ${ctx.organism} ${ctx.at} the (?:whole )?${ctx.noun}\\.$`))
      expect(b.question.solution).toContain(`Total counted $= ${counts.join(' + ')} = ${total}$ ${ctx.organism} in ${n} m², so the mean is $\\dfrac{${total}}{${n}} = ${mean}$ ${ctx.organism} per m².`)
      expect(b.question.solution).toContain('placed at **random**')
      expect(method(b)).toEqual([`finds the mean per m², ${total} ÷ ${n} = ${mean}, and multiplies by the area of ${spaced(area)} m²`])
      // The total times the area is marked wrong.
      expect(mark(b.question, String(total * area)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(ECOLOGY.COUNTED.length)
    spread('quadrat-counts-estimate', 'q30', ['n', 'total', 'area'])
  })
})

// =============================================================================================
// Energy and biomass
// =============================================================================================

describe('energy and biomass between trophic levels', () => {
  it('q11: the next level ÷ this level × 100, about 10%', () => {
    const built = build('trophic-transfer-efficiency', 'q11')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = ECOLOGY.CHAINS.find((x) => x.name === b.values.context)!
      const lower = num(/ ([\d ]+) kJ of energy per m²/, p)
      const upper = num(/contains? ([\d ]+) kJ per m²/, p)
      expect(answer(b)).toBe(c((upper / lower) * 100))
      expect(within(answer(b), ...ctx.efficiency) && within(answer(b), 2, 20)).toBe(true)
      expect(Number.isInteger(answer(b) * 2)).toBe(true)
      expect(within(lower, ctx.energy[0], ctx.energy[1])).toBe(true)
      expect(Number.isInteger(upper)).toBe(true)
      expect(tolerance(b)).toBe(0)
      expect(b.question.solution).toBe(
        `$\\dfrac{${texed(upper)}}{${texed(lower)}} \\times 100 = ${answer(b)}\\%$. The other ${c(100 - answer(b))}% is not stored in the bodies of ${ctx.to}: ${ctx.losses}, and much is used by ${ctx.to} in respiration and lost as heat.`,
      )
      expect(b.question.solution).not.toContain('most is released in respiration')
      expect(method(b)).toEqual([`divides ${spaced(upper)} by ${spaced(lower)} and multiplies by 100`])
      expect(last(b)).toBe(String(answer(b)))
      // A grass level "contains"; plural levels "contain".
      expect(p).not.toMatch(/the grass \(the producers\) contain /)
      // Dividing the wrong way is marked wrong.
      expect(mark(b.question, String(c((lower / upper) * 100))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(ECOLOGY.CHAINS.length)
    spread('trophic-transfer-efficiency', 'q11', ['lower', 'upper'])
  })

  it('q20: secondary consumers ÷ producers × 100, checked as the product of the two steps', () => {
    const built = build('pyramid-of-biomass-percentage', 'q20')
    for (const b of built) {
      const [p, c1, c2] = [...b.question.prompt.matchAll(/(\d[\d .]*) g\/m²/g)].map((m) => Number(m[1]!.replace(/ /g, '')))
      const ctx = ECOLOGY.PYRAMIDS.find((x) => x.name === b.values.context)!
      const e1 = c((c1! / p!) * 100)
      const e2 = c((c2! / c1!) * 100)
      expect(answer(b)).toBe(c((c2! / p!) * 100))
      expect(within(p!, ctx.biomass[0], ctx.biomass[1])).toBe(true)
      expect(Number.isInteger(p!) && Number.isInteger(c1!) && decimals(c2!) <= 1).toBe(true)
      for (const e of [e1, e2]) expect(Number.isInteger(e) && within(e, 3, 20)).toBe(true)
      expect(e1).not.toBe(e2)
      // Neither step is 5, 10 or 20%, which would make the answer the other step with the point moved, doubled or halved.
      for (const e of [e1, e2]) for (const x of [e, e * 2, e / 2]) expect(isPowerOfTen(answer(b) / x), b.seed).toBe(false)
      expect(within(answer(b), 0.2, 2.5)).toBe(true)
      expect(tolerance(b)).toBe(c(Math.min(0.005, answer(b) * 0.019)))
      expect(b.question.solution).toBe(
        `$\\dfrac{${c2}}{${texed(p!)}} \\times 100 = ${answer(b)}\\%$. Checking level by level: $\\dfrac{${c1}}{${texed(p!)}} \\times 100 = ${e1}\\%$, ` +
          `then $\\dfrac{${c2}}{${c1}} \\times 100 = ${e2}\\%$, and $${c(e1 / 100)} \\times ${c(e2 / 100)} = ${c(answer(b) / 100)}$, which is $${answer(b)}\\%$.`,
      )
      expect(method(b)).toEqual([`divides ${c2} by ${spaced(p!)}, or multiplies the two level percentages`, 'multiplies by 100'])
      // Forgetting the × 100, or giving one step's percentage, is marked wrong.
      expect(mark(b.question, String(c(c2! / p!))).correct).toBe(false)
      expect(mark(b.question, String(e2)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(ECOLOGY.PYRAMIDS.length)
    spread('pyramid-of-biomass-percentage', 'q20', ['p', 'c1', 'c2'])
  })

  it('q31: the energy captured less respiration and what is not eaten, as a percentage', () => {
    const built = build('energy-transfer-after-losses', 'q31')
    for (const b of built) {
      const p = b.question.prompt
      const ctx = ECOLOGY.PRODUCERS.find((x) => x.name === b.values.context)!
      const cap = num(/captures? ([\d ]+) kJ/, p)
      const resp = num(/Of this, ([\d ]+) kJ/, p)
      const lost = num(/heat, and ([\d ]+) kJ/, p)
      const passed = cap - resp - lost
      expect(answer(b)).toBe(c((passed / cap) * 100))
      expect(within(answer(b), ...ctx.efficiency)).toBe(true)
      expect(within(cap, ...ctx.captured)).toBe(true)
      expect(within(resp / cap, 0.4, 0.65)).toBe(true)
      expect(lost / cap).toBeGreaterThanOrEqual(0.15)
      expect(resp).not.toBe(lost)
      expect(p).toContain(`${ctx.verb} ${spaced(cap)} kJ of energy by photosynthesis`)
      expect(p).toContain(`Calculate the efficiency of the energy transfer from ${ctx.short} to ${ctx.eaters}, as a percentage of the energy ${ctx.short} captured.`)
      expect(b.question.solution).toContain(`$= ${texed(cap)} - ${texed(resp)} - ${texed(lost)} = ${texed(passed)}$ kJ. Efficiency $= \\dfrac{${texed(passed)}}{${texed(cap)}} \\times 100 = ${answer(b)}\\%$.`)
      expect(b.question.solution).toContain('**respiration** and lost as **heat**')
      expect(method(b)).toEqual([
        `subtracts both losses to find the energy passed on: ${spaced(cap)} − ${spaced(resp)} − ${spaced(lost)} = ${spaced(passed)} kJ`,
        `divides by the energy captured and multiplies by 100: ${spaced(passed)} ÷ ${spaced(cap)} × 100`,
      ])
      expect(last(b)).toBe(`${answer(b)}%`)
      // Taking only one loss away is marked wrong.
      expect(mark(b.question, String(c(((cap - resp) / cap) * 100))).correct).toBe(false)
      expect(mark(b.question, String(c(((cap - lost) / cap) * 100))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(ECOLOGY.PRODUCERS.length)
    spread('energy-transfer-after-losses', 'q31', ['captured', 'respired', 'uneaten'])
  })

  it('q31: the written figures give the written answer', () => {
    expect(c(((4000 - 2500 - 1200) / 4000) * 100)).toBe(7.5)
  })
})

// =============================================================================================
// Decay
// =============================================================================================

const decayed = (p: string) => {
  const m = /mass of (\d+) g decays to (\d+) g over (\d+) days|falls from (\d+) g to (\d+) g in (\d+) days/.exec(p)!
  const [m0, m1, d] = (m[1] ? m.slice(1, 4) : m.slice(4, 7)).map(Number)
  return { m0: m0!, m1: m1!, d: d! }
}

describe('decay', () => {
  it('material-cycles q11: the change in mass ÷ days', () => {
    const built = build('decay-rate-grams-per-day', 'q11')
    for (const b of built) {
      const { m0, m1, d } = decayed(b.question.prompt)
      const h = ECOLOGY.HEAPS.find((x) => x.name === b.values.context)!
      expect(h.masses).toContain(m0)
      expect(within(d, ...h.days)).toBe(true)
      expect(within((((m0 - m1) / m0) * 100) / d, ...h.perDay)).toBe(true)
      expect(m1 / m0).toBeGreaterThanOrEqual(0.4)
      expect(answer(b)).toBe(c((m0 - m1) / d))
      expect(decimals(answer(b))).toBeLessThanOrEqual(2)
      expect(sigFigures(answer(b))).toBeLessThanOrEqual(3)
      expect(tolerance(b)).toBe(0)
      expect(b.question.solution).toBe(`$${m0} - ${m1} = ${m0 - m1}$ g lost, and $${m0 - m1} \\div ${d} = ${answer(b)}$ g per day.`)
      expect(method(b)).toEqual([`finds the change in mass, ${m0 - m1} g`, `divides by the time, ${d} days`])
      expect(last(b)).toBe(String(answer(b)))
      // The mass lost alone is marked wrong.
      expect(mark(b.question, String(m0 - m1)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(ECOLOGY.HEAPS.length)
    expect(new Set(built.map((b) => /on a woodland floor|in a/.exec(b.question.prompt)?.[0]).filter(Boolean)).size).toBeGreaterThan(0)
    spread('decay-rate-grams-per-day', 'q11', ['m0', 'm1', 'd'])
  })

  it('material-cycles q12: the percentage lost, ÷ days', () => {
    const built = build('decay-percent-per-day', 'q12')
    for (const b of built) {
      const { m0, m1, d } = decayed(b.question.prompt)
      const h = ECOLOGY.HEAPS.find((x) => x.name === b.values.context)!
      const pct = c(((m0 - m1) / m0) * 100)
      expect(answer(b)).toBe(c(pct / d))
      expect(within(answer(b), ...h.perDay)).toBe(true)
      expect(decimals(pct)).toBeLessThanOrEqual(2)
      expect(decimals(answer(b))).toBeLessThanOrEqual(2)
      // The written slot's 0.05 for a whole or 1 d.p. answer, 0.005 at 2 d.p., capped at 1.9%.
      expect(tolerance(b)).toBe(c(Math.min(0.5 * 10 ** -Math.max(1, decimals(answer(b))), answer(b) * 0.019)))
      expect(b.question.solution).toBe(
        `$${m0} - ${m1} = ${m0 - m1}$ g lost. $${m0 - m1}$ g of $${m0}$ g is $\\dfrac{${m0 - m1}}{${m0}} \\times 100 = ${pct}\\%$ over ${d} days, so $${pct} \\div ${d} = ${answer(b)}\\%$ per day.`,
      )
      expect(method(b)).toEqual([`finds the percentage lost, ${pct}%`, `divides by the time, ${d} days`])
      // The percentage over the whole time, and the grams per day, are marked wrong.
      expect(mark(b.question, String(pct)).correct).toBe(false)
      expect(mark(b.question, String(c((m0 - m1) / d))).correct).toBe(false)
      expect(b.question.prompt).not.toMatch(/in on|in in/)
    }
    expect(contexts(built)).toBe(ECOLOGY.HEAPS.length)
    spread('decay-percent-per-day', 'q12', ['m0', 'm1', 'd'])
  })

  it('material-cycles q12: the written figures, 200 g to 140 g in 6 days', () => {
    expect(c((((200 - 140) / 200) * 100) / 6)).toBe(5)
  })

  it('material-cycles q19: a table of four readings, the first two intervals asked', () => {
    const built = build('decay-percent-from-a-table', 'q19')
    for (const b of built) {
      const p = b.question.prompt
      const rows = [...p.matchAll(/^\| (\d+) \| (\d+) \|$/gm)].map((m) => [Number(m[1]), Number(m[2])] as const)
      expect(rows).toHaveLength(4)
      const days = rows.map(([d]) => d)
      const mass = rows.map(([, m]) => m)
      const i = days[1]!
      expect(days).toEqual([0, i, 2 * i, 3 * i])
      expect(ECOLOGY.INTERVALS).toContain(i)
      const k = num(/over the first (\d+) days/, p)
      expect(k).toBe(2 * i)
      const ctx = ECOLOGY.BAGS.find((x) => x.name === b.values.context)!
      const [first, second, third] = [mass[0]! - mass[1]!, mass[1]! - mass[2]!, mass[2]! - mass[3]!]
      // Decay keeps going and slows: each interval loses less than or as much as the one before, the last clearly less.
      expect(first).toBeGreaterThanOrEqual(second)
      expect(third).toBeLessThan(second)
      expect(third).toBeGreaterThanOrEqual(2)
      const lost = mass[0]! - mass[2]!
      const pct = c((lost / mass[0]!) * 100)
      expect(answer(b)).toBe(c(pct / k))
      expect(within(answer(b), ...ctx.perDay)).toBe(true)
      expect(decimals(answer(b))).toBeLessThanOrEqual(1)
      expect(tolerance(b)).toBe(c(Math.min(0.05, answer(b) * 0.019)))
      expect(b.question.solution).toBe(
        `Mass lost in ${k} days $= ${mass[0]} - ${mass[2]} = ${lost}$ g. As a percentage of the starting mass: $\\dfrac{${lost}}{${mass[0]}} \\times 100 = ${pct}\\%$ over ${k} days. ` +
          `Per day: $${pct} \\div ${k} = ${answer(b)}\\%$ per day. (The table also shows decay slowing later: only ${third} g is lost between day ${k} and day ${3 * i}.)`,
      )
      expect(method(b)).toEqual([`finds the mass lost, ${lost} g`, `divides by the starting mass and by ${k} days`])
      // The whole table, or the last reading's day, is marked wrong.
      expect(mark(b.question, String(c((((mass[0]! - mass[3]!) / mass[0]!) * 100) / (3 * i)))).correct).toBe(false)
      expect(mark(b.question, String(pct)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(ECOLOGY.BAGS.length)
    spread('decay-percent-from-a-table', 'q19', ['i', 'm0', 'loss'])
  })

  it('material-cycles q30: the mass lost as a percentage of the original', () => {
    const built = build('decay-percentage-mass-lost', 'q30')
    for (const b of built) {
      const p = b.question.prompt
      const f = ECOLOGY.FRUITS.find((x) => x.name === b.values.context)!
      const m = /mass of (\d+) g .* its mass is (\d+) g|its mass is (\d+) g at the start and (\d+) g/.exec(p)!
      const [m0, m1] = (m[1] ? m.slice(1, 3) : m.slice(3, 5)).map(Number)
      expect(within(m0!, ...f.masses)).toBe(true)
      expect(answer(b)).toBe(c(((m0! - m1!) / m0!) * 100))
      expect(within(answer(b), ...f.lost)).toBe(true)
      expect(answer(b)).not.toBe(50)
      expect(decimals(answer(b))).toBeLessThanOrEqual(1)
      expect(tolerance(b)).toBe(0)
      expect(p).toContain(f.name)
      expect(p).not.toMatch(/\bone weeks\b/)
      expect(b.question.solution).toContain(`Mass lost $= ${m0} - ${m1} = ${m0! - m1!}$ g. Percentage lost $= \\dfrac{${m0! - m1!}}{${m0}} \\times 100 = ${answer(b)}\\%$.`)
      expect(method(b)).toEqual([`finds the mass lost, ${m0} − ${m1} = ${m0! - m1!} g, and divides by the original ${m0} g (× 100)`])
      expect(last(b)).toBe(`${answer(b)}%`)
      // The percentage left, and the grams lost, are marked wrong.
      expect(mark(b.question, String(c(100 - answer(b)))).correct).toBe(false)
      expect(mark(b.question, String(m0! - m1!)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(ECOLOGY.FRUITS.length)
    expect(build('decay-percentage-mass-lost', 'q30', 600).some((b) => b.question.prompt.includes('one week'))).toBe(true)
    spread('decay-percentage-mass-lost', 'q30', ['m0', 'm1', 'weeks'])
  })

  it('material-cycles q31: each loss turned into a rate before they are compared', () => {
    const built = build('decay-rates-compared', 'q31')
    let longerA = 0
    for (const b of built) {
      const p = b.question.prompt
      const bn = ECOLOGY.BINS.find((x) => x.name === b.values.context)!
      const m = num(/identical (\d+) g samples/, p)
      const [a, ta] = /Sample A, in [^,]+(?:, [^,]+)?, loses (\d+) g in (\d+) days/.exec(p)!.slice(1).map(Number)
      const [bb, tb] = /Sample B, in [^,]+, loses (\d+) g in (\d+) days/.exec(p)!.slice(1).map(Number)
      const naive = num(/as sample B, because \d+ ÷ \d+ = ([\d.]+)\./, p)
      expect(ECOLOGY.SAMPLE_MASSES).toContain(m)
      expect(naive).toBe(c(a! / bb!))
      const ra = c(a! / ta!)
      const rb = c(bb! / tb!)
      expect(answer(b)).toBe(c(ra / rb))
      expect(within(((ra / m) * 100), ...bn.aPerDay)).toBe(true)
      expect(within(((rb / m) * 100), ...bn.bPerDay)).toBe(true)
      expect(ta).not.toBe(tb)
      expect(Math.abs(naive - answer(b))).toBeGreaterThanOrEqual(0.5)
      expect(decimals(answer(b))).toBeLessThanOrEqual(1)
      expect(within(answer(b), 1.5, 8)).toBe(true)
      if (ta! > tb!) longerA++
      expect(b.question.solution).toContain(`Sample A: $\\dfrac{${a}}{${ta}} = ${ra}$ g per day. Sample B: $\\dfrac{${bb}}{${tb}} = ${rb}$ g per day.`)
      expect(b.question.solution).toContain(`$= \\dfrac{${ra}}{${rb}} = ${answer(b)}$, so sample A decayed ${answer(b)} times as fast, not ${naive} times.`)
      expect(b.question.solution).toContain(ta! < tb! ? `sample B was given ${tb} days to lose its ${bb} g.` : `sample A was given ${ta} days to lose its ${a} g, longer than the ${tb} days of sample B.`)
      expect(b.question.solution.endsWith(bn.why)).toBe(true)
      expect(method(b)).toEqual([`converts both losses to rates: ${a} ÷ ${ta} = ${ra} g per day and ${bb} ÷ ${tb} = ${rb} g per day`, 'divides the rate for A by the rate for B'])
      // The student's ratio is marked wrong.
      expect(mark(b.question, String(naive)).correct).toBe(false)
    }
    // The student's ratio is too small about half the time and too large the rest.
    expect(longerA / built.length).toBeGreaterThan(0.35)
    expect(longerA / built.length).toBeLessThan(0.65)
    expect(contexts(built)).toBe(ECOLOGY.BINS.length)
    spread('decay-rates-compared', 'q31', ['m', 'a', 'ta', 'b', 'tb'])
  })

  it('material-cycles q31: the written figures, 72 g in 6 days against 30 g in 10', () => {
    expect(c(72 / 6 / (30 / 10))).toBe(4)
  })
})

// =============================================================================================
// Plant hormones
// =============================================================================================

describe('plant hormones', () => {
  it('q25: two percentages ripened, then their difference', () => {
    const built = build('ethene-ripening-percentages', 'q25')
    for (const b of built) {
      const p = b.question.prompt
      const crop = ECOLOGY.CROPS.find((x) => x.name === b.values.context)!
      const n = num(/(?:holding|puts) (\d+) unripe/, p)
      const x = num(/(\d+) of the \w+ (?:kept )?in ethene/, p)
      const y = num(/(\d+) of (?:the \w+ kept|those) in ordinary air/, p)
      expect(crop.counts).toContain(n)
      const px = c((x / n) * 100)
      const py = c((y / n) * 100)
      expect(within(px, ...ECOLOGY.ETHENE) && within(py, ...ECOLOGY.AIR)).toBe(true)
      expect(answer(b)).toBe(c(px - py))
      expect(tolerance(b)).toBe(0)
      expect(b.question.solution).toContain(`In ethene: $\\dfrac{${x}}{${n}} \\times 100 = ${px}\\%$. Ordinary air: $\\dfrac{${y}}{${n}} \\times 100 = ${py}\\%$. Difference $= ${px} - ${py} = ${answer(b)}$ percentage points.`)
      expect(b.question.solution).toContain('triggers **ripening**')
      expect(method(b)).toEqual([`works out both percentages, ${px}% and ${py}%, or divides both counts by ${n}`])
      expect(last(b)).toBe(String(answer(b)))
      // The difference in counts is marked wrong.
      expect(mark(b.question, String(x - y)).correct).toBe(false)
    }
    expect(contexts(built)).toBe(ECOLOGY.CROPS.length)
    spread('ethene-ripening-percentages', 'q25', ['n', 'x', 'y'])
  })

  it('q26: the increases divided, not the final lengths', () => {
    const built = build('phototropism-growth-comparison', 'q26')
    for (const b of built) {
      const p = b.question.prompt
      const sd = ECOLOGY.SEEDLINGS.find((x) => x.name === b.values.context)!
      const l0 = num(/is (\d+) mm long/, p)
      const s = num(/in shade measures (\d+) mm/, p)
      const lf = num(/faced the light measures (\d+) mm/, p)
      const [gs, gl] = [s - l0, lf - l0]
      expect(within(l0, ...sd.start) && within(gs, ...sd.shaded) && within(gl, ...sd.lit)).toBe(true)
      expect(answer(b)).toBe(c(gs / gl))
      expect(within(answer(b), 1.4, 4)).toBe(true)
      expect(decimals(answer(b))).toBeLessThanOrEqual(2)
      const naive = s / lf
      const claim = Math.round(naive * 10) / 10
      expect(p).toContain(`grew about ${claim.toFixed(1)} times as much as the lit side, because ${s} ÷ ${lf} `)
      expect(p).toMatch(Number.isInteger(c(naive * 100)) ? new RegExp(`${s} ÷ ${lf} = ${c(naive)}\\.`) : new RegExp(`${s} ÷ ${lf} is about ${(Math.round(naive * 100) / 100).toFixed(2)}\\.`))
      expect(claim).toBeGreaterThan(1)
      expect(answer(b) - naive).toBeGreaterThanOrEqual(0.3)
      expect(b.question.solution).toContain(`Shaded side: $${s} - ${l0} = ${gs}$ mm of growth. Lit side: $${lf} - ${l0} = ${gl}$ mm of growth. So the shaded side grew $\\dfrac{${gs}}{${gl}} = ${answer(b)}$ times as much.`)
      expect(b.question.solution).toContain('**shaded side**')
      expect(method(b)).toEqual([`finds the two increases in length: ${gs} mm and ${gl} mm`, 'divides the increase on the shaded side by the increase on the lit side'])
      expect(mark(b.question, String(c(naive))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(ECOLOGY.SEEDLINGS.length)
    spread('phototropism-growth-comparison', 'q26', ['l0', 'gs', 'gl'])
  })

  it('q26: the written figures, 20 mm to 32 and 26 mm', () => {
    expect((32 - 20) / (26 - 20)).toBe(2)
  })
})

// =============================================================================================
// Literal text: whole builds at one seed, worked by hand, so a helper that prints a figure wrongly
// cannot pass by building the expected text the same way.
// =============================================================================================

describe('builds read as worked by hand', () => {
  const at = (id: string) => {
    const g = ecologyGenerators.find((x) => x.id === id)!
    return generate(g, bankOf(g.topicId).find((q) => q.id === g.replaces[0])!, 'literal')
  }

  it('q6: 13.8 buttercups per m² over 1500 m²', () => {
    const b = at('quadrat-mean-estimate')
    expect(b.question.prompt).toBe(
      'A student places twenty 1 m² quadrats at random in a meadow with an area of 1500 m² and finds a mean of 13.8 buttercups per quadrat. Estimate the population of buttercups in the meadow.',
    )
    expect(b.question.solution).toBe(
      'Each quadrat is 1 m², so a mean of 13.8 per quadrat is 13.8 per m². Estimated population: $13.8 \\times 1500$, which is **20700 buttercups** ($2.07 \\times 10^{4}$ buttercups). The number of quadrats, 20, does not enter the calculation: more quadrats make the mean more reliable.',
    )
    expect(answer(b)).toBe(20700)
    // Exact, as the written method gives it: 20 800 is marked wrong.
    expect(tolerance(b)).toBe(0)
    expect(mark(b.question, '20800').correct).toBe(false)
  })

  it('q19: 28 plantains in ten 0.25 m² quadrats over 7500 m²', () => {
    const b = at('quadrat-quarter-metre-estimate')
    expect(b.question.prompt).toBe(
      'Ribwort plantains are sampled on a playing field with an area of 7500 m², using 10 quadrats placed at random. Each quadrat measures 50 cm by 50 cm, an area of 0.25 m². Altogether 28 ribwort plantains are counted. Estimate the total number of ribwort plantains on the playing field.',
    )
    expect(b.question.solution).toBe(
      'Mean per quadrat $= 28 \\div 10 = 2.8$. Each quadrat is only $0.25$ m², so the density is $2.8 \\div 0.25 = 11.2$ per m². Estimated population: $11.2 \\times 7500$, which is **84000 ribwort plantains** ($8.4 \\times 10^{4}$ ribwort plantains).',
    )
    expect(method(b)).toEqual(['finds the mean per quadrat, 2.8', 'divides by 0.25 to get 11.2 per square metre'])
  })

  it('material-cycles q19: 400 g to 288 g in the first 8 days', () => {
    const b = at('decay-percent-from-a-table')
    expect(b.question.prompt).toBe(
      'A student measured the mass of a bag of vegetable peelings as it decayed in a compost bin.\n\n| Day | Mass (g) |\n|---|---|\n| 0 | 400 |\n| 4 | 336 |\n| 8 | 288 |\n| 12 | 266 |\n\nCalculate the mean rate of decay over the first 8 days, as a percentage of the starting mass lost per day.',
    )
    expect(b.question.solution).toBe(
      'Mass lost in 8 days $= 400 - 288 = 112$ g. As a percentage of the starting mass: $\\dfrac{112}{400} \\times 100 = 28\\%$ over 8 days. Per day: $28 \\div 8 = 3.5\\%$ per day. (The table also shows decay slowing later: only 22 g is lost between day 8 and day 12.)',
    )
    expect(answer(b)).toBe(3.5)
    expect(tolerance(b)).toBe(0.05)
  })

  it('material-cycles q31: 36 g in 8 days against 15 g in 6 days', () => {
    const b = at('decay-rates-compared')
    expect(b.question.prompt).toBe(
      'Two identical 350 g samples of leaf litter are put into compost heaps. Sample A, in a moist compost heap, loses 36 g in 8 days. Sample B, in a heap that is kept dry under a cover, loses 15 g in 6 days. A student says that sample A decayed 2.4 times as fast as sample B, because 36 ÷ 15 = 2.4. Calculate how many times greater the rate of decay of sample A was than that of sample B.',
    )
    expect(method(b)).toEqual(['converts both losses to rates: 36 ÷ 8 = 4.5 g per day and 15 ÷ 6 = 2.5 g per day', 'divides the rate for A by the rate for B'])
    expect(b.question.solution).toContain('Rate of A divided by rate of B $= \\dfrac{4.5}{2.5} = 1.8$, so sample A decayed 1.8 times as fast, not 2.4 times.')
    expect(answer(b)).toBe(1.8)
  })

  it('q26: a wheat shoot from 16 mm to 28 and 19 mm', () => {
    const b = at('phototropism-growth-comparison')
    expect(b.question.prompt).toBe(
      'The shoot of a wheat seedling is 16 mm long. It is lit from one side for three days and bends towards the light. Afterwards the side of the shoot that was in shade measures 28 mm from base to tip and the side that faced the light measures 19 mm. A student says that the shaded side grew about 1.5 times as much as the lit side, because 28 ÷ 19 is about 1.47. Calculate how many times greater the increase in length of the shaded side was than the increase in length of the lit side.',
    )
    expect(b.question.solution).toContain('Shaded side: $28 - 16 = 12$ mm of growth. Lit side: $19 - 16 = 3$ mm of growth. So the shaded side grew $\\dfrac{12}{3} = 4$ times as much.')
    expect(answer(b)).toBe(4)
  })
})
