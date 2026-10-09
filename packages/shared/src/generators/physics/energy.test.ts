import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'

/**
 * Structural tests for the Physics energy generators. The release check proves each answer
 * agrees with a second route; these read the prompt's own numbers and the working printed
 * on the way and check each step is the right one, because a right answer can be reached by
 * a wrong route (generator-helpers-need-structural-tests). They also look across a run of
 * builds for what no single build can show: a context list that never rotates.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/physics')
const bank = (topicId: string) => Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${topicId}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = bank(g.topicId).find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `structure-${i}`))
}

/** The numbers a prompt states outside maths, in order, as it prints them: "12 000 kg" is 12000. */
const numbers = (text: string) =>
  [...text.replace(/\$[^$]*\$/g, ' ').matchAll(/-?\d{1,3}(?: \d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0].replace(/ /g, '')))
const clean = (x: number) => Number(x.toPrecision(12))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const units = (b: Generated) => (b.question.type === 'numeric' ? b.question.units : 'not numeric')
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const last = (b: Generated) => b.question.markScheme.at(-1)!.description
/** A whole number inside maths as the generators print it: 12\,000 from five digits. */
const tex = (x: number) => (Math.abs(x) >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : show(x))
const values = (b: Generated) => b.values as Record<string, number>

describe('kinetic and gravitational potential energy', () => {
  it('halves the mass times the speed squared, squaring the speed in the working', () => {
    for (const [slotId, lo, hi] of [['q2', 0.1, 600], ['q4', 250, 40000]] as const) {
      const built = build('kinetic-energy', slotId)
      for (const b of built) {
        const { m, v } = values(b)
        expect(numbers(b.question.prompt), b.seed).toEqual([m, v])
        expect(m).toBeGreaterThanOrEqual(lo)
        expect(m).toBeLessThanOrEqual(hi)
        expect(answer(b)).toBeCloseTo((m! * v! * v!) / 2, 9)
        expect(b.question.solution).toContain(`${v}^2 = ${v! * v!}`)
        // "Not 2v" only where it differs from v²: at 2 m/s both are 4.
        expect(b.question.solution.includes(', not ')).toBe(v! > 2)
        expect(units(b)).toBe('J')
        expect(last(b)).toMatch(/ J$/)
      }
      expect(new Set(built.map((b) => b.values.context)).size).toBeGreaterThanOrEqual(5)
    }
  })

  it('multiplies the mass, 9.8 and the height gained, to at most one decimal place', () => {
    for (const b of build('gravitational-potential-energy', 'q3')) {
      const { m, h } = values(b)
      expect(numbers(b.question.prompt).slice(0, 2), b.seed).toEqual([m, h])
      expect(b.question.prompt).toContain('9.8')
      expect(answer(b)).toBeCloseTo(m! * 9.8 * h!, 9)
      expect(Math.abs(answer(b) * 10 - Math.round(answer(b) * 10))).toBeLessThan(1e-9)
      // Under five digits the maths runs to the answer; from five it stops at the product.
      expect(b.question.solution).toContain(`${tex(m!)} \\times 9.8 \\times ${tex(h!)}${answer(b) < 10000 ? ` = ${show(answer(b))}$ J` : '$, which is'}`)
    }
  })

  it('finds a whole height from the energy over the weight, with the weight in the working', () => {
    for (const b of build('potential-energy-height', 'q5')) {
      const [m, E] = numbers(b.question.prompt)
      expect(Number.isInteger(answer(b)), b.seed).toBe(true)
      expect(answer(b)).toBeCloseTo(E! / (m! * 9.8), 9)
      expect(b.question.solution).toContain(`\\dfrac{${tex(E!)}}{${tex(clean(m! * 9.8))}} = ${answer(b)}$ m`)
      expect(units(b)).toBe('m')
    }
  })

  it('takes the root of 2E over m, which is a perfect square', () => {
    for (const b of build('kinetic-energy-speed', 'q7')) {
      const [m, E] = numbers(b.question.prompt)
      const v2 = clean((2 * E!) / m!)
      expect(Number.isInteger(Math.sqrt(v2)), b.seed).toBe(true)
      expect(answer(b)).toBe(Math.sqrt(v2))
      expect(b.question.solution).toContain(`\\sqrt{${tex(v2)}} = ${answer(b)}$ m/s`)
      expect(units(b)).toBe('m/s')
    }
  })

  it('equates the two stores, cancels the mass and roots 2gh', () => {
    for (const slotId of ['q9', 'q14']) {
      const built = build('falling-object', slotId)
      for (const b of built) {
        const [m, h] = numbers(b.question.prompt)
        expect(b.question.prompt, b.seed).toContain('9.8')
        expect(b.values.n).not.toBe(14)
        expect(answer(b)).toBeCloseTo(Math.sqrt(2 * 9.8 * h!), 9)
        expect(b.question.solution).toContain(`2 \\times 9.8 \\times ${tex(h!)} = ${tex(clean(2 * 9.8 * h!))}`)
        expect(b.question.solution).toContain(`the ${show(m!)} kg is not needed`)
        expect(units(b)).toBe('m/s')
      }
      expect(new Set(built.map((b) => b.values.context)).size).toBeGreaterThanOrEqual(5)
    }
    for (const b of build('falling-object', 'q13')) {
      const [m, v] = numbers(b.question.prompt)
      expect(b.values.n, b.seed).not.toBe(14)
      expect(answer(b)).toBeCloseTo((v! * v!) / 19.6, 9)
      expect(b.question.solution).toContain(`$v^2 = ${show(v!)}^2 = ${tex(clean(v! * v!))}$`)
      expect(b.question.solution).toContain(`\\dfrac{${tex(clean(v! * v!))}}{19.6} = ${show(answer(b))}$ m`)
      expect(b.question.solution).toContain(`the ${show(m!)} kg is not needed`)
      expect(units(b)).toBe('m')
    }
  })

  it('converts a multiple of 9 km/h exactly before squaring', () => {
    for (const b of build('kinetic-energy-from-km-per-hour', 'q10')) {
      const [m, kmh] = numbers(b.question.prompt)
      expect(kmh! % 9, b.seed).toBe(0)
      const v = clean(kmh! / 3.6)
      expect(b.question.solution).toContain(`= ${show(v)}$ m/s`)
      expect(b.question.markScheme[0]!.description).toBe(`${kmh} km/h converted to ${show(v)} m/s`)
      expect(answer(b)).toBeCloseTo((m! * v * v) / 2, 6)
      expect(Number.isInteger(answer(b))).toBe(true)
    }
  })

  it('scales the energy by the share kept before the root, and rounds to three figures', () => {
    for (const b of build('fall-with-dissipation', 'q11')) {
      const [m, h, lost] = numbers(b.question.prompt)
      expect(b.question.prompt, b.seed).toContain('3 significant figures')
      const kept = (100 - lost!) / 100
      const v = Math.sqrt(2 * 9.8 * h! * kept)
      expect(answer(b)).toBe(Number(v.toPrecision(3)))
      // The answer box prints the number itself, so its third figure is never a 0 the box would drop.
      expect(answer(b).toPrecision(3).endsWith('0'), b.seed).toBe(false)
      expect(tolerance(b)).toBeGreaterThan(0)
      expect(tolerance(b)).toBeLessThanOrEqual(0.05)
      expect(b.question.solution).toContain(`${tex(m!)} \\times 9.8 \\times ${h} = `)
      expect(b.question.solution).toContain(`$E_k = ${show(kept)} \\times `)
      expect(b.question.solution).toContain(`${100 - lost!}% is transferred`)
      expect(units(b)).toBe('m/s')
    }
  })

  it('writes the standard form with a front number from 1 to 10 that reads back as the answer', () => {
    for (const b of build('kinetic-energy-standard-form', 'q15')) {
      const [m, v] = numbers(b.question.prompt)
      expect(answer(b), b.seed).toBe((m! * v! * v!) / 2)
      expect(answer(b)).toBeGreaterThanOrEqual(100000)
      const form = String(b.values.form)
      const [, mantissa, exponent] = /^(\d(?:\.\d+)?) \\times 10\^\{(\d+)\}$/.exec(form)!
      expect(Number(mantissa) * 10 ** Number(exponent)).toBeCloseTo(answer(b), 6)
      expect(b.question.solution).toContain(`**$${form}$ J**`)
      expect(last(b)).toBe(`$${form}$ J`)
    }
  })
})

describe('energy transfers and dissipation', () => {
  it('subtracts the useful from the total, with an efficiency the device really has', () => {
    for (const slotId of ['q2', 'q5', 'q8']) {
      const built = build('energy-dissipated', slotId)
      for (const b of built) {
        const [total, useful] = numbers(b.question.prompt)
        expect(answer(b), b.seed).toBe(total! - useful!)
        expect(useful! / total!).toBeGreaterThanOrEqual(slotId === 'q8' ? 0.5 : 0.05)
        expect(useful! / total!).toBeLessThanOrEqual(slotId === 'q8' ? 0.98 : 0.95)
        expect(b.question.solution).toContain(`$${total} - ${useful} = ${answer(b)}$ J`)
        if (slotId === 'q8') expect(b.question.prompt).toContain('closed system')
        if (slotId === 'q5') expect(b.question.prompt).toContain('wasted')
        expect(units(b)).toBe('J')
      }
      if (slotId !== 'q8') expect(new Set(built.map((b) => b.values.device)).size).toBeGreaterThanOrEqual(6)
    }
  })

  it('divides the drop by the minutes and rounds to two figures, which the division alone never gives', () => {
    for (const b of build('cooling-rate', 'q19')) {
      const { start, end, t } = values(b)
      expect(b.question.prompt, b.seed).toContain(`from ${start} °C to ${end} °C`)
      expect(b.question.prompt).toContain(`${t} minutes`)
      const rate = (start! - end!) / t!
      expect(answer(b)).toBe(Number(rate.toPrecision(2)))
      expect(answer(b)).not.toBe(rate)
      expect(b.question.solution).toContain(`${start! - end!} \\div ${t} = `)
      expect(units(b)).toBeUndefined()
      expect(last(b)).toBe(show(answer(b)))
    }
  })

  it('finds the energy with mcΔθ, turns minutes into seconds and divides', () => {
    for (const b of build('cooling-power', 'q24')) {
      const { start, end, t } = values(b)
      const m = Number(b.values.m)
      expect(b.question.prompt, b.seed).toContain(`${b.values.m} kg`)
      const dE = Math.round(m * 4200 * (start! - end!))
      expect(answer(b)).toBeCloseTo(dE / (t! * 60), 9)
      expect(Math.abs(answer(b) * 100 - Math.round(answer(b) * 100))).toBeLessThan(1e-9)
      expect(b.question.solution).toContain(`${b.values.m} \\times 4200 \\times ${start! - end!} = ${tex(dE)}$ J`)
      expect(b.question.solution).toContain(`${t} \\times 60 = ${t! * 60}$ s`)
      expect(units(b)).toBe('W')
    }
  })
})

describe('power and efficiency', () => {
  it('divides the energy by the seconds, printed as the written question prints them', () => {
    for (const b of build('power-from-energy-and-time', 'q2')) {
      const { E, t, P } = values(b)
      expect(E! / t!, b.seed).toBe(P)
      expect(answer(b)).toBe(P)
      expect(Number.isInteger(P)).toBe(true)
      expect(b.question.prompt).toContain(t! < 10 ? `${t}.0 s` : `${t} s`)
      expect(units(b)).toBe('W')
    }
  })

  it('gives the efficiency as a whole percentage of useful over total', () => {
    for (const b of build('efficiency-as-a-percentage', 'q4')) {
      const [total, useful] = numbers(b.question.prompt)
      expect(answer(b), b.seed).toBe(clean((useful! / total!) * 100))
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(b.question.solution).toContain(`\\dfrac{${useful}}{${total}} = `)
      expect(units(b)).toBe('%')
      expect(last(b)).toBe(`${answer(b)}%`)
    }
  })

  it('converts kilowatts and minutes first, then multiplies', () => {
    for (const b of build('energy-from-power-and-time', 'q5')) {
      const [kw, t] = numbers(b.question.prompt)
      const W = Math.round(kw! * 1000)
      const s = Math.round(t! * 60)
      expect(answer(b), b.seed).toBe(W * s)
      expect(b.question.solution).toContain(`${show(kw!)} kW = **${W} W**`)
      expect(b.question.solution).toContain(`${show(t!)} minutes = **${s} s**`)
      expect(units(b)).toBe('J')
    }
  })

  it('gives the efficiency as a decimal from two powers in the same unit', () => {
    const built = build('efficiency-from-powers', 'q6')
    for (const b of built) {
      const [useful, total] = numbers(b.question.prompt)
      expect(answer(b), b.seed).toBeCloseTo(useful! / total!, 9)
      expect(answer(b)).toBeGreaterThan(0)
      expect(answer(b)).toBeLessThan(1)
      const unit = b.values.unit
      expect(b.question.prompt).toContain(`${show(useful!)} ${unit} and a total power input of ${total} ${unit}`)
      expect(units(b)).toBeUndefined()
    }
    expect(built.filter((b) => b.values.unit === 'kW').length).toBeGreaterThan(30)
  })
})
