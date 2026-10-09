import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { dpTolerance } from './format.ts'

/**
 * Structural tests for the Physics forces generators. The release check proves each answer
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

const clean = (x: number) => Number(x.toPrecision(12))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const units = (b: Generated) => (b.question.type === 'numeric' ? b.question.units : 'not numeric')
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const last = (b: Generated) => b.question.markScheme.at(-1)!.description
/** A whole number inside maths as the generators print it: 12\,000 from five digits. */
const tex = (x: number) => (Math.abs(x) >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : show(x))
/** A number in prose: 12 000 from five digits. */
const prose = (x: number) => (Math.abs(x) >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : show(x))
const values = (b: Generated) => b.values as Record<string, number>
/** The end of a worked solution as closes() prints it: the maths runs to the answer under five digits and stops at the product from five. */
const ends = (expr: string, answer: number, unit: string) => (answer < 10000 ? `${expr} = ${show(answer)}$ ${unit}` : `${expr}$, which is **${answer} ${unit}**`)
const decimals = (x: number) => (show(x).includes('.') ? show(x).split('.')[1]!.length : 0)
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context)).size

describe("Newton's laws", () => {
  it('multiplies the mass by the acceleration, with neither 1 kg nor a force equal to a given figure', () => {
    const built = build('force-from-mass-and-acceleration', 'q1')
    for (const b of built) {
      const { m, a } = values(b)
      expect(b.question.prompt, b.seed).toContain(`${prose(m!)} kg`)
      expect(b.question.prompt).toContain(`${show(a!)} m/s²`)
      expect(b.question.prompt).not.toMatch(/\ba \d/)
      // A skateboarder is a person: "them", never "it".
      expect(b.question.prompt).not.toMatch(/skateboarder[^.]*\b(it|its)\b/)
      expect(m).not.toBe(1)
      expect(answer(b)).toBeCloseTo(m! * a!, 9)
      expect(answer(b)).not.toBe(m)
      expect(answer(b)).not.toBe(a)
      expect(decimals(answer(b))).toBeLessThanOrEqual(1)
      expect(b.question.solution).toContain(ends(`F = m a = ${tex(m!)} \\times ${show(a!)}`, answer(b), 'N'))
      expect(units(b)).toBe('N')
      expect(last(b)).toBe(`${show(answer(b))} N`)
    }
    expect(contexts(built)).toBeGreaterThanOrEqual(6)
  })

  it('divides a whole force by the mass, to at most one decimal place', () => {
    const built = build('acceleration-from-force-and-mass', 'q3')
    for (const b of built) {
      const { m, F } = values(b)
      expect(b.question.prompt, b.seed).toContain(`${prose(F!)} N`)
      expect(b.question.prompt).toContain(`${prose(m!)} kg`)
      expect(b.question.prompt).not.toMatch(/skateboarder[^.]*\b(it|its)\b/)
      expect(Number.isInteger(F)).toBe(true)
      expect(answer(b)).toBeCloseTo(F! / m!, 9)
      expect(answer(b)).not.toBe(F)
      expect(answer(b)).not.toBe(m)
      expect(decimals(answer(b))).toBeLessThanOrEqual(1)
      expect(b.question.solution).toContain(`a = F \\div m = ${tex(F!)} \\div ${tex(m!)} = ${show(answer(b))}$ m/s²`)
      expect(units(b)).toBe('m/s²')
    }
    expect(contexts(built)).toBeGreaterThanOrEqual(6)
  })

  it('divides the force by the acceleration for a mass, and calls it inertial mass in q17', () => {
    for (const slotId of ['q6', 'q17']) {
      const built = build('mass-from-force-and-acceleration', slotId)
      for (const b of built) {
        const { F, a } = values(b)
        expect(b.question.prompt, b.seed).toContain(`${prose(F!)} N`)
        expect(b.question.prompt).toContain(`${show(a!)} m/s²`)
        expect(answer(b)).toBeCloseTo(F! / a!, 9)
        expect(answer(b)).not.toBe(F)
        expect(answer(b)).not.toBe(a)
        expect(b.question.solution).toContain(ends(`${tex(F!)} \\div ${show(a!)}`, answer(b), 'kg'))
        expect(b.question.prompt.includes('inertial mass')).toBe(slotId === 'q17')
        expect(b.question.solution.includes('inertial mass')).toBe(slotId === 'q17')
        expect(units(b)).toBe('kg')
        if (slotId === 'q6') expect(answer(b)).toBeGreaterThanOrEqual(70)
      }
      expect(contexts(built)).toBeGreaterThanOrEqual(5)
    }
  })

  it('gives the size of a deceleration from a braking force', () => {
    const built = build('deceleration-from-braking-force', 'q9')
    for (const b of built) {
      const { m, F } = values(b)
      expect(b.question.prompt, b.seed).toContain('deceleration')
      expect(b.question.prompt).toContain(`${prose(F!)} N`)
      expect(answer(b)).toBeGreaterThan(0)
      expect(answer(b)).toBeCloseTo(F! / m!, 9)
      expect(answer(b)).toBeLessThanOrEqual(10)
      expect(b.question.solution).toContain(`${tex(F!)} \\div ${tex(m!)} = ${show(answer(b))}$ m/s², a deceleration`)
      expect(units(b)).toBe('m/s²')
      expect(last(b)).toBe(`${show(answer(b))} m/s²`)
    }
    expect(contexts(built)).toBeGreaterThanOrEqual(6)
  })

  it('finds the acceleration, the resultant, then adds the resistance for the driving force', () => {
    const built = build('driving-force-with-resistance', 'q11')
    for (const b of built) {
      const { m, v, t, R } = values(b)
      expect(b.question.prompt, b.seed).toContain(`from rest to ${v} m/s in ${t} s`)
      expect(b.question.prompt).toContain(`${prose(R!)} N`)
      const a = clean(v! / t!)
      expect(decimals(a)).toBeLessThanOrEqual(1)
      expect(a).not.toBe(1)
      const resultant = clean(m! * a)
      expect(Number.isInteger(resultant)).toBe(true)
      expect(resultant).not.toBe(R)
      expect(answer(b)).toBe(resultant + R!)
      expect(b.question.solution).toContain(`$a = \\Delta v \\div t = ${v} \\div ${t} = ${show(a)}$ m/s²`)
      expect(b.question.solution).toContain(`${tex(m!)} \\times ${show(a)} = ${tex(resultant)}$ N`)
      expect(b.question.markScheme.map((l) => l.code)).toEqual(['M1', 'M1', 'M1', 'A1'])
      expect(b.question.markScheme[2]!.description).toBe(`driving force $= ${tex(resultant)} + ${tex(R!)}$`)
      expect(units(b)).toBe('N')
    }
    expect(contexts(built)).toBeGreaterThanOrEqual(5)
  })

  it('takes the weight from the upward force and divides by the mass, upwards, within a believable margin', () => {
    for (const [slotId, lo, hi] of [['q14', 1, 60], ['q19', 0.3, 2]] as const) {
      const built = build('acceleration-against-weight', slotId)
      for (const b of built) {
        const { m, T } = values(b)
        expect(b.question.prompt, b.seed).toContain(`${prose(m!)} kg`)
        expect(b.question.prompt).toContain(`${prose(T!)} N`)
        expect(b.question.prompt).toContain('9.8')
        const W = clean(m! * 9.8)
        const R = clean(T! - W)
        expect(T).toBeGreaterThan(W)
        expect(answer(b)).toBeCloseTo(R / m!, 9)
        expect(answer(b)).toBeGreaterThanOrEqual(lo)
        expect(answer(b)).toBeLessThanOrEqual(hi)
        // Only a model rocket accelerates faster than 5 m/s².
        if (answer(b) > 5) expect(String(b.values.context)).toContain('model rocket')
        expect(answer(b)).not.toBe(1)
        expect(decimals(answer(b))).toBeLessThanOrEqual(1)
        expect(b.question.solution).toContain(`Weight $= m g = ${tex(m!)} \\times 9.8 = ${tex(W)}$ N`)
        expect(b.question.solution).toContain(`Resultant $= ${tex(T!)} - ${tex(W)} = ${tex(R)}$ N upwards`)
        expect(b.question.solution).toContain(`${tex(R)} \\div ${tex(m!)} = ${show(answer(b))}$ m/s² upwards`)
        expect(last(b)).toBe(`${show(answer(b))} m/s² upwards`)
        expect(units(b)).toBe('m/s²')
      }
      expect(contexts(built)).toBe(5)
    }
  })

  it('estimates from round figures: a speed with its mph, a whole number of newtons', () => {
    const built = build('estimating-a-resultant-force', 'q16')
    for (const b of built) {
      const { m, v, mph, t } = values(b)
      expect(b.question.prompt, b.seed).toContain('Estimate')
      expect(b.question.prompt).toContain(`${v} m/s`)
      expect(b.question.prompt).toContain(`about ${mph} mph`)
      expect(b.question.prompt).toContain(`in ${t} s`)
      expect(Math.abs(v! / 0.44704 - mph!)).toBeLessThan(1.5)
      const a = clean(v! / t!)
      expect(decimals(a)).toBeLessThanOrEqual(2)
      expect(a).not.toBe(1)
      expect(answer(b)).toBe(clean(m! * a))
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(b.question.solution).toContain(`$a = ${v} \\div ${t} = ${show(a)}$ m/s²`)
      expect(b.question.solution).toContain('About ')
      expect(units(b)).toBe('N')
    }
    expect(contexts(built)).toBe(6)
  })
})

describe('weight, work done and resultant forces', () => {
  it('multiplies a whole mass, never 1 kg, by 9.8', () => {
    const built = build('weight-from-mass', 'q2')
    for (const b of built) {
      const { m } = values(b)
      expect(b.question.prompt, b.seed).toContain(`${prose(m!)} kg`)
      expect(b.question.prompt).toContain('9.8')
      expect(m).not.toBe(1)
      expect(answer(b)).toBeCloseTo(m! * 9.8, 9)
      expect(decimals(answer(b))).toBeLessThanOrEqual(1)
      expect(b.question.solution).toContain(ends(`W = m g = ${tex(m!)} \\times 9.8`, answer(b), 'N'))
      expect(units(b)).toBe('N')
    }
    expect(contexts(built)).toBeGreaterThanOrEqual(8)
  })

  it('divides a weight by 9.8 to a whole mass', () => {
    const built = build('mass-from-weight', 'q7')
    for (const b of built) {
      const { W } = values(b)
      expect(b.question.prompt, b.seed).toContain(`${prose(W!)} N`)
      expect(b.question.prompt).toContain('9.8')
      expect(answer(b)).toBeCloseTo(W! / 9.8, 9)
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(answer(b)).not.toBe(1)
      expect(b.question.solution).toContain(`m = W \\div g = ${tex(W!)} \\div 9.8 = ${show(answer(b))}$ kg`)
      expect(units(b)).toBe('kg')
      expect(tolerance(b)).toBe(0)
    }
    expect(contexts(built)).toBeGreaterThanOrEqual(8)
  })

  it('multiplies the force by the distance, which never equals it', () => {
    const built = build('work-done-from-force-and-distance', 'q5')
    for (const b of built) {
      const { F, s } = values(b)
      expect(b.question.prompt, b.seed).toContain(`${prose(F!)} N`)
      expect(b.question.prompt).toContain(`${show(s!)} m`)
      expect(F).not.toBe(s)
      expect(answer(b)).toBe(clean(F! * s!))
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(b.question.solution).toContain(`W = F s = ${tex(F!)} \\times ${tex(s!)}`)
      expect(units(b)).toBe('J')
    }
    expect(contexts(built)).toBeGreaterThanOrEqual(7)
  })

  it('divides the work by the distance to a whole force', () => {
    const built = build('force-from-work-done', 'q10')
    for (const b of built) {
      const { W, s } = values(b)
      expect(b.question.prompt, b.seed).toContain(`${prose(W!)} J`)
      expect(b.question.prompt).toContain(`${s} m`)
      expect(answer(b)).toBe(W! / s!)
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(answer(b)).not.toBe(s)
      expect(b.question.solution).toContain(`F = W \\div s = ${tex(W!)} \\div ${tex(s!)} = ${answer(b)}$ N`)
      expect(units(b)).toBe('N')
    }
    expect(contexts(built)).toBeGreaterThanOrEqual(5)
  })

  it('resolves with cos θ, shows the unrounded value, rounds to two figures that never end in 0', () => {
    const built = build('resolving-a-force', 'q13')
    for (const b of built) {
      const { F, angle } = values(b)
      expect(b.question.prompt, b.seed).toContain(`a force of ${F} N`)
      expect(b.question.prompt).not.toMatch(/\ba \d/)
      expect(b.question.prompt).toContain(`${angle}° above the horizontal`)
      expect(b.question.prompt).toContain('scale drawing')
      expect(b.question.prompt).toContain('2 significant figures')
      expect([30, 37, 40, 45, 50, 53, 60]).toContain(angle)
      const raw = F! * Math.cos((angle! * Math.PI) / 180)
      expect(answer(b)).toBe(Number(raw.toPrecision(2)))
      expect(answer(b)).toBeGreaterThanOrEqual(27)
      expect(answer(b).toPrecision(2).endsWith('0')).toBe(false)
      expect(Math.abs(raw - answer(b))).toBeLessThanOrEqual(0.5)
      expect(tolerance(b)).toBe(Number(Math.min(1, answer(b) * 0.019).toPrecision(10)))
      expect(b.question.solution).toContain(`$${F} \\cos ${angle}° = ${raw.toFixed(2)}$ N, which is **${answer(b)} N** to 2 s.f.`)
      expect(b.question.solution).toContain(`$${F} \\sin ${angle}° = `)
      expect(b.question.solution.includes('3, 4, 5 triangle')).toBe(angle === 37 || angle === 53)
      expect(b.question.markScheme[0]!.description).toContain(`$${F} \\cos ${angle}°$`)
      expect(last(b)).toBe(`${answer(b)} N`)
      expect(units(b)).toBe('N')
    }
    expect(new Set(built.map((b) => b.values.angle)).size).toBe(7)
    expect(contexts(built)).toBe(5)
  })

  it('subtracts the resistance, multiplies by the distance and names the kinetic store', () => {
    const built = build('work-done-by-a-resultant-force', 'q15')
    for (const b of built) {
      const { D, R, s } = values(b)
      expect(b.question.prompt, b.seed).toContain(`${prose(D!)} N`)
      expect(b.question.prompt).toContain(`${prose(R!)} N`)
      expect(b.question.prompt).toContain(`${s} m`)
      const F = D! - R!
      expect(F).toBeGreaterThan(0)
      expect(F).not.toBe(R)
      expect(F).not.toBe(s)
      expect(answer(b)).toBe(F * s!)
      expect(b.question.solution).toContain(`Resultant $= ${tex(D!)} - ${tex(R!)} = ${tex(F)}$ N`)
      expect(b.question.solution).toContain(`= F s = ${tex(F)} \\times ${tex(s!)}`)
      expect(b.question.solution).toContain('kinetic store')
      expect(b.question.solution).not.toContain('kinetic energy store')
      expect(units(b)).toBe('J')
    }
    expect(contexts(built)).toBe(6)
  })

  it('divides a weight by a mass to a real g, never Earth', () => {
    const G = { 'the Moon': 1.6, Mars: 3.7, Mercury: 3.7, Venus: 8.9, Jupiter: 24.8, Saturn: 10.4, Uranus: 8.7, Neptune: 11.2, Pluto: 0.6 }
    const built = build('field-strength-from-weight', 'q17')
    for (const b of built) {
      const { m, W } = values(b)
      const body = String(b.values.context) as keyof typeof G
      expect(G[body], b.seed).toBeDefined()
      expect(b.question.prompt).toContain(`${prose(m!)} kg`)
      expect(b.question.prompt).toContain(`${show(W!)} N`)
      expect(b.question.prompt).not.toContain('Earth')
      expect(decimals(W!)).toBeLessThanOrEqual(1)
      expect(answer(b)).toBe(G[body])
      expect(answer(b)).toBeCloseTo(W! / m!, 9)
      expect(b.question.solution).toContain(`g = W \\div m = ${tex(W!)} \\div ${tex(m!)} = ${show(answer(b))}$ N/kg, ${answer(b) < 9.8 ? 'less' : 'more'} than Earth's 9.8 N/kg`)
      expect(units(b)).toBe('N/kg')
      expect(tolerance(b)).toBe(dpTolerance(answer(b)))
      expect(tolerance(b)).toBeGreaterThan(0)
    }
    expect(contexts(built)).toBe(9)
  })

  it('finds the weight, subtracts the smaller force from the larger and gives the direction', () => {
    const built = build('resultant-with-weight', 'q19')
    for (const b of built) {
      const { m, F } = values(b)
      const direction = String(b.values.direction)
      expect(b.question.prompt, b.seed).toContain(`${prose(m!)} kg`)
      expect(b.question.prompt).toContain(`${prose(F!)} N`)
      expect(b.question.prompt).toContain('9.8')
      const W = clean(m! * 9.8)
      expect(direction).toBe(F! > W ? 'upwards' : 'downwards')
      expect(answer(b)).toBeCloseTo(Math.abs(F! - W), 9)
      // The upward force sits in the share of the weight each moment really has: a balloon's
      // upthrust is no more than a tenth over, a skydiver who has just jumped meets at most half.
      const ratio = F! / W
      expect(ratio).toBeGreaterThanOrEqual(0.1 - 1e-9)
      expect(ratio).toBeLessThanOrEqual(3 + 1e-9)
      if (b.values.context === 'the balloon upwards') expect(ratio).toBeLessThanOrEqual(1.1 + 1e-9)
      expect(answer(b)).toBeGreaterThanOrEqual(W / 50 - 1e-9)
      expect(answer(b)).not.toBe(m)
      expect(b.question.solution).toContain(`Weight $= ${tex(m!)} \\times 9.8 = ${tex(W)}$ N downwards`)
      expect(b.question.solution).toContain(`Resultant $= ${tex(Math.max(F!, W))} - ${tex(Math.min(F!, W))}`)
      expect(b.question.solution).toContain(`**${direction}**`)
      expect(last(b)).toBe(`${prose(answer(b))} N ${direction}`)
      expect(units(b)).toBe('N')
    }
    expect(new Set(built.map((b) => b.values.direction))).toEqual(new Set(['upwards', 'downwards']))
    expect(contexts(built)).toBe(7)
  })
})
