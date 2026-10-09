import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { dpTolerance } from './format.ts'

/**
 * Structural tests for the Hooke's law generators. The release check proves each answer
 * agrees with a second route; these read the prompt's own numbers and the working printed on
 * the way and check each step is the right one, because a right answer can be reached by a
 * wrong route (generator-helpers-need-structural-tests). They also look across a run of
 * builds for what no single build can show: a context list that never rotates, or one value
 * carrying the slot.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/physics')
const bank = Question.array().parse(JSON.parse(readFileSync(join(ROOT, 'hookes-law.json'), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  expect(g.topicId).toBe('hookes-law')
  const slot = bank.find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `structure-${i}`))
}

const clean = (x: number) => Number(x.toPrecision(12))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const units = (b: Generated) => (b.question.type === 'numeric' ? b.question.units : 'not numeric')
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const method = (b: Generated, i: number) => b.question.markScheme[i]!.description
const last = (b: Generated) => b.question.markScheme.at(-1)!.description
const values = (b: Generated) => b.values as Record<string, number>
const tex = (x: number) => (Math.abs(x) >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : show(x))
const prose = (x: number) => (Math.abs(x) >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : show(x))
const ends = (expr: string, answer: number, unit: string) => (answer < 10000 ? `${expr} = ${show(answer)}$ ${unit}` : `${expr}$, which is **${answer} ${unit}**`)
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context)).size
const powerOfTen = (x: number) => Math.abs(Math.log10(x) - Math.round(Math.log10(x))) < 1e-9
/** Every build: no "a 8 kg", the units the written slot has, the tolerance rounding allows. */
function common(b: Generated, unit: string) {
  expect(b.question.prompt, b.seed).not.toMatch(/\ba \d/)
  expect(units(b)).toBe(unit)
  expect(tolerance(b)).toBe(dpTolerance(answer(b)))
}

describe("Hooke's law", () => {
  it('multiplies the spring constant by an extension in metres that only a calculation moves', () => {
    const built = build('force-from-spring-constant', 'q2')
    for (const b of built) {
      const { k, e } = values(b)
      common(b, 'N')
      expect(b.question.prompt, b.seed).toContain(`${prose(k!)} N/m`)
      expect(b.question.prompt).toContain(` ${show(e!)} m`)
      expect(powerOfTen(e!)).toBe(false)
      expect(powerOfTen(k!)).toBe(false)
      expect(answer(b)).toBe(clean(k! * e!))
      // A school-lab spring takes at most about 10 N, to a tenth of a newton.
      if (b.values.context === 'a spring in a school lab') expect(answer(b) <= 10 && Math.abs(answer(b) * 10 - Math.round(answer(b) * 10)) < 1e-9).toBe(true)
      expect(answer(b)).not.toBe(k)
      expect(b.question.solution).toContain(ends(`F = k e = ${tex(k!)} \\times ${show(e!)}`, answer(b), 'N'))
      expect(method(b, 0)).toBe(`$F = ke = ${tex(k!)} \\times ${show(e!)}$`)
    }
    expect(contexts(built)).toBe(6)
  })

  it('divides the force by the spring constant for an extension in metres', () => {
    const built = build('extension-from-force', 'q5')
    for (const b of built) {
      const { k, F } = values(b)
      common(b, 'm')
      expect(b.question.prompt, b.seed).toContain(`${prose(F!)} N`)
      expect(b.question.prompt).toContain(`${prose(k!)} N/m`)
      expect(answer(b)).toBe(clean(F! / k!))
      expect(powerOfTen(answer(b))).toBe(false)
      expect(powerOfTen(k!)).toBe(false)
      expect(answer(b)).toBeLessThanOrEqual(0.5)
      expect(b.question.solution).toContain(`\\dfrac{${tex(F!)}}{${tex(k!)}} = ${show(answer(b))}$ m`)
      expect(method(b, 0)).toBe(`$e = F \\div k = ${tex(F!)} \\div ${tex(k!)}$`)
    }
    expect(contexts(built)).toBe(6)
  })

  it('converts cm to m, then divides the force by it, for stretched and squashed springs', () => {
    for (const slotId of ['q4', 'q13']) {
      const built = build('spring-constant-from-force-and-extension', slotId)
      for (const b of built) {
        const { F, e } = values(b)
        common(b, 'N/m')
        const em = clean(e! / 100)
        expect(b.question.prompt, b.seed).toContain(`${prose(F!)} N`)
        expect(b.question.prompt).toContain(` ${show(e!)} cm`)
        expect(powerOfTen(e!)).toBe(false)
        // 50 cm is 0.5 m, which makes k the force doubled.
        expect(e).not.toBe(50)
        expect(answer(b)).not.toBe(e)
        expect(powerOfTen(answer(b))).toBe(false)
        expect(Number.isInteger(answer(b))).toBe(true)
        expect(answer(b)).toBe(clean(F! / em))
        expect(answer(b)).not.toBe(F)
        expect(b.question.solution).toContain(`$${show(e!)}$ cm $= ${show(em)}$ m.`)
        expect(b.question.solution).toContain(ends(`k = \\dfrac{F}{e} = \\dfrac{${tex(F!)}}{${show(em)}}`, answer(b), 'N/m'))
        expect(method(b, 0)).toBe(`${show(e!)} cm converted to ${show(em)} m`)
        expect(method(b, 1)).toBe(`$k = F \\div e = ${tex(F!)} \\div ${show(em)}$`)
        expect(last(b)).toBe(`${prose(answer(b))} N/m`)
        expect(b.question.prompt.includes('compressed') || b.question.prompt.includes('squashed')).toBe(slotId === 'q13')
        expect(b.question.solution.includes('Compression follows the same law')).toBe(slotId === 'q13')
      }
      expect(contexts(built)).toBe(6)
    }
  })

  it('pogo sticks carry a child and pens a thumb: the force is what that really is', () => {
    for (const b of build('spring-constant-from-force-and-extension', 'q13')) {
      const { F } = values(b)
      if (b.values.context === 'the spring of a pogo stick') expect(F! >= 200 && F! <= 500, b.seed).toBe(true)
      if (b.values.context === 'the spring in a retractable pen') expect(F! >= 1 && F! <= 6, b.seed).toBe(true)
      if (b.values.context === 'a car suspension spring') expect(answer(b)).toBeGreaterThanOrEqual(20000)
    }
  })
})

describe('elastic potential energy', () => {
  it('converts cm to m and works out a half of k times e squared', () => {
    const built = build('elastic-potential-energy', 'q7')
    for (const b of built) {
      const { k, e } = values(b)
      common(b, 'J')
      const em = clean(e! / 100)
      expect(b.question.prompt, b.seed).toContain(`${prose(k!)} N/m`)
      expect(b.question.prompt).toContain(` ${show(e!)} cm`)
      expect(b.question.prompt).toContain('elastic potential energy')
      expect(powerOfTen(e!)).toBe(false)
      expect(answer(b)).toBe(clean(0.5 * k! * em * em))
      expect(powerOfTen(k!)).toBe(false)
      expect(answer(b)).toBeGreaterThanOrEqual(0.01)
      // Never 0.098 J or 4.9 J: g with its point moved, or its half.
      for (const g of [9.8, 4.9, 19.6]) expect(powerOfTen(answer(b) / g)).toBe(false)
      expect(b.question.solution).toContain(`$${show(e!)}$ cm $= ${show(em)}$ m.`)
      expect(b.question.solution).toContain(ends(`E_e = \\tfrac{1}{2} k e^2 = \\tfrac{1}{2} \\times ${tex(k!)} \\times ${show(em)}^2`, answer(b), 'J'))
      expect(method(b, 0)).toBe(`$\\frac{1}{2} \\times ${tex(k!)} \\times ${show(em)}^2$ with cm converted`)
    }
    expect(contexts(built)).toBe(6)
  })

  it('finds k from the first extension, then the energy at the second', () => {
    const built = build('elastic-energy-at-another-extension', 'q10')
    for (const b of built) {
      const { F, e, e2 } = values(b)
      common(b, 'J')
      expect(b.question.prompt, b.seed).toContain(`${prose(F!)} N`)
      expect(b.question.prompt).toContain(` ${show(e!)} cm`)
      expect(b.question.prompt).toContain(` ${show(e2!)} cm`)
      expect(b.question.prompt).toContain('limit of proportionality')
      expect(e).not.toBe(e2)
      const k = clean(F! / (e! / 100))
      expect(Number.isInteger(k)).toBe(true)
      expect(powerOfTen(k)).toBe(false)
      const em2 = clean(e2! / 100)
      expect(answer(b)).toBe(clean(0.5 * k * em2 * em2))
      expect(powerOfTen(answer(b) / F!)).toBe(false)
      expect(answer(b)).not.toBe(e)
      expect(answer(b)).not.toBe(e2)
      expect(e2).not.toBe(F)
      expect(b.question.solution).toContain(`\\dfrac{${tex(F!)}}{${show(clean(e! / 100))}} = ${tex(k)}$ N/m`)
      expect(b.question.solution).toContain(ends(`E_e = \\tfrac{1}{2} \\times ${tex(k)} \\times ${show(em2)}^2`, answer(b), 'J'))
      expect(b.question.markScheme.map((l) => l.description)).toEqual([`$k = ${tex(k)}$ N/m`, `${show(e2!)} cm converted to ${show(em2)} m`, `$\\frac{1}{2} \\times ${tex(k)} \\times ${show(em2)}^2$`, `${show(answer(b))} J`])
    }
    expect(contexts(built)).toBe(6)
  })

  it('doubles the energy and divides by the extension in metres squared', () => {
    const built = build('spring-constant-from-stored-energy', 'q15')
    for (const b of built) {
      const { E, e } = values(b)
      common(b, 'N/m')
      const em = clean(e! / 100)
      expect(b.question.prompt, b.seed).toContain(`${show(E!)} J`)
      expect(b.question.prompt).toContain(` ${show(e!)} cm`)
      expect(powerOfTen(e!)).toBe(false)
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(powerOfTen(answer(b))).toBe(false)
      expect(answer(b)).toBe(clean((2 * E!) / (em * em)))
      expect(b.question.solution).toContain(`\\dfrac{2 \\times ${show(E!)}}{${show(em)}^2} = \\dfrac{${show(clean(2 * E!))}}{${show(clean(em * em))}}`)
      expect(method(b, 0)).toBe('$k = 2E_e \\div e^2$')
      expect(method(b, 1)).toBe(`${show(e!)} cm converted to ${show(em)} m and squared`)
    }
    expect(contexts(built)).toBe(6)
  })
})

describe('weights on springs and the practical', () => {
  it('converts grams to kilograms, finds the weight, divides by k and gives the extension in cm', () => {
    const built = build('extension-from-hung-mass', 'q9')
    for (const b of built) {
      const { m, k } = values(b)
      common(b, 'cm')
      expect(b.question.prompt, b.seed).toContain(` ${prose(m!)} g `)
      expect(b.question.prompt).toContain(`${prose(k!)} N/m`)
      expect(b.question.prompt).toContain('9.8')
      expect(powerOfTen(k!)).toBe(false)
      expect(k).not.toBe(98)
      const kg = clean(m! / 1000)
      const W = clean(kg * 9.8)
      const em = clean(W / k!)
      expect(answer(b)).toBe(clean(em * 100))
      expect(answer(b) * 10).toBeCloseTo(Math.round(answer(b) * 10), 9)
      expect([4.9, 9.8, 19.6]).not.toContain(answer(b))
      // An extension in cm that is the mass in g with its point moved (k = 98) teaches nothing.
      expect(powerOfTen(answer(b) / m!)).toBe(false)
      expect(answer(b)).not.toBe(k)
      expect(b.question.solution).toContain(`${prose(m!)} g $= ${show(kg)}$ kg`)
      expect(b.question.solution).toContain(`\\dfrac{${show(W)}}{${tex(k!)}} = ${show(em)}$ m $= ${show(answer(b))}$ cm.`)
      expect(method(b, 0)).toBe(`$W = ${show(kg)} \\times 9.8 = ${show(W)}$ N`)
      expect(method(b, 1)).toBe(`$e = ${show(W)} \\div ${tex(k!)}$`)
    }
    expect(contexts(built)).toBe(6)
  })

  it('reads the extensions from the lengths, leaves out the last point and divides weight by extension', () => {
    const built = build('spring-constant-from-practical-data', 'q16')
    for (const b of built) {
      const { dm, de, L0, n, extra } = values(b)
      common(b, 'N/m')
      const masses = Array.from({ length: n! }, (_, i) => (i + 1) * dm!)
      const lengths = masses.map((_, i) => clean(L0! + (i + 1) * de! + (i === n! - 1 ? extra! : 0)))
      expect(b.question.prompt, b.seed).toContain(`${L0!.toFixed(1)} cm`)
      for (const [i, m] of masses.entries()) expect(b.question.prompt).toContain(`${m} g gives ${lengths[i]!.toFixed(1)} cm`)
      // The prompt's lengths, read back, give the answer from the last straight point.
      const ext = lengths.map((l) => clean(l - L0!))
      const W = clean((masses[n! - 2]! / 1000) * 9.8)
      expect(answer(b)).toBe(clean(W / (ext[n! - 2]! / 100)))
      // The last point lies off the line, by at least half a centimetre.
      expect(ext[n! - 1]! - (n! * ext[0]!)).toBeGreaterThanOrEqual(0.5 - 1e-9)
      // An unstretched length equal to the step makes the total length proportional to the load.
      expect(L0).not.toBe(de)
      expect(lengths).not.toContain(answer(b))
      expect([9.8, 19.6, 98, 49, 4.9, 10, 100]).not.toContain(answer(b))
      expect(b.question.solution).toContain(`\\dfrac{${show(W)}}{${show(clean(ext[n! - 2]! / 100))}}`)
      expect(b.question.solution).toContain(`the ${masses.at(-1)} g point is past the limit of proportionality`)
      expect(method(b, 0)).toBe(`Extension = total length − ${L0!.toFixed(1)} cm, converted to metres`)
      expect(method(b, 2)).toBe(`${masses.at(-1)} g result excluded as beyond the limit of proportionality`)
    }
    expect(contexts(built)).toBe(3)
    expect(new Set(built.map((b) => b.values.n))).toEqual(new Set([4, 5]))
  })
})

/**
 * No single value carries the slot (aggregate-only-defects): drawing two numbers and keeping
 * the clean pairs let the easiest value dominate in Forces A.
 */
describe('spread across builds', () => {
  const share = (built: Generated[], key: (b: Generated) => unknown) => {
    const counts = new Map<unknown, number>()
    for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
    return Math.max(...counts.values()) / built.length
  }
  const cases: [string, string, (b: Generated) => unknown][] = [
    ['force-from-spring-constant', 'q2', answer],
    ['force-from-spring-constant', 'q2', (b) => values(b).e],
    ['extension-from-force', 'q5', answer],
    ['spring-constant-from-force-and-extension', 'q4', answer],
    ['spring-constant-from-force-and-extension', 'q4', (b) => values(b).e],
    ['spring-constant-from-force-and-extension', 'q13', answer],
    ['elastic-potential-energy', 'q7', answer],
    ['elastic-potential-energy', 'q7', (b) => values(b).e],
    ['elastic-energy-at-another-extension', 'q10', answer],
    ['spring-constant-from-stored-energy', 'q15', answer],
    ['extension-from-hung-mass', 'q9', answer],
    ['extension-from-hung-mass', 'q9', (b) => values(b).k],
    ['spring-constant-from-practical-data', 'q16', answer],
  ]
  for (const [id, slot, key] of cases) {
    it(`${id} ${slot}: no value is more than 40% of the draws`, () => {
      expect(share(build(id, slot), key)).toBeLessThanOrEqual(0.4)
    })
  }
  // k = 98 was 56% of one context's draws while the slot as a whole looked fine.
  it('extension-from-hung-mass q9: no spring constant or extension is more than 30% of any one context', () => {
    const built = build('extension-from-hung-mass', 'q9', 1200)
    for (const name of new Set(built.map((b) => b.values.context))) {
      const mine = built.filter((b) => b.values.context === name)
      expect(mine.length).toBeGreaterThan(100)
      expect(share(mine, (b) => values(b).k), String(name)).toBeLessThanOrEqual(0.3)
      expect(share(mine, answer), String(name)).toBeLessThanOrEqual(0.3)
    }
  })
})
