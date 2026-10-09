import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { atomGenerators } from './atoms.ts'

/**
 * Structural tests for the atomic-structure generators: the isotope in each prompt is read
 * back and checked against a table of real ones, every printed step of the working is checked,
 * and a run of builds is checked for spread, because a half-life chain or an isotope list can
 * look right one build at a time and still teach a pattern.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/physics')
const bank = (topicId: string) => Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${topicId}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = bank(g.topicId).find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `structure-${i}`))
}

const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const units = (b: Generated) => (b.question.type === 'numeric' ? b.question.units : 'not numeric')
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const last = (b: Generated) => b.question.markScheme.at(-1)!.description
const method = (b: Generated, i: number) => b.question.markScheme[i]!.description
const values = (b: Generated) => b.values as Record<string, number>
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context)).size
const tex = (x: number) => (Math.abs(x) >= 10000 ? show(x).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : show(x))
const prose = (x: number) => (Math.abs(x) >= 10000 ? show(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : show(x))
const front = (x: number) => Number(Math.abs(x).toExponential(9).split('e')[0])

/** Atomic numbers by element, checked against the periodic table independently of the generator. */
const Z: Record<string, number> = {
  lithium: 3, beryllium: 4, boron: 5, carbon: 6, nitrogen: 7, oxygen: 8, fluorine: 9, neon: 10, sodium: 11, magnesium: 12,
  aluminium: 13, silicon: 14, phosphorus: 15, sulfur: 16, chlorine: 17, argon: 18, potassium: 19, calcium: 20, scandium: 21,
  titanium: 22, vanadium: 23, chromium: 24, manganese: 25, iron: 26, cobalt: 27, nickel: 28, copper: 29, zinc: 30, gallium: 31,
  germanium: 32, arsenic: 33, selenium: 34, bromine: 35, krypton: 36, rubidium: 37, strontium: 38, yttrium: 39, zirconium: 40,
  molybdenum: 42, technetium: 43, silver: 47, cadmium: 48, tin: 50, antimony: 51, iodine: 53, xenon: 54, caesium: 55, barium: 56,
  gold: 79, mercury: 80, lead: 82, bismuth: 83, polonium: 84, astatine: 85, radon: 86, francium: 87, radium: 88, actinium: 89,
  thorium: 90, protactinium: 91, uranium: 92, neptunium: 93, plutonium: 94, americium: 95, curium: 96, californium: 98,
}
/** Alpha emitters by name, as nuclide tables list them. */
const ALPHA_EMITTERS = new Set([
  'uranium-238', 'uranium-235', 'uranium-234', 'uranium-233', 'thorium-232', 'thorium-230', 'thorium-229', 'thorium-228', 'radium-226',
  'radium-224', 'radium-223', 'radon-222', 'radon-220', 'radon-219', 'polonium-218', 'polonium-216', 'polonium-214', 'polonium-212',
  'polonium-210', 'plutonium-242', 'plutonium-240', 'plutonium-239', 'plutonium-238', 'americium-243', 'americium-241', 'curium-244',
  'curium-242', 'californium-252', 'neptunium-237', 'actinium-225', 'francium-221',
])
/** Half-lives as data books give them, rounded as the prompts state them. */
const HALF_LIFE: Record<string, [number, string]> = {
  'technetium-99m': [6, 'hours'], 'iodine-131': [8, 'days'], 'sodium-24': [15, 'hours'], 'phosphorus-32': [14, 'days'],
  'radon-222': [3.8, 'days'], 'cobalt-60': [5.3, 'years'], 'strontium-90': [29, 'years'], 'caesium-137': [30, 'years'],
  'iodine-123': [13, 'hours'], 'bismuth-214': [20, 'minutes'], 'fluorine-18': [110, 'minutes'], 'carbon-14': [5730, 'years'],
  'chromium-51': [28, 'days'],
}

describe('the model of the atom', () => {
  it('q3 subtracts the atomic number from the mass number of a real isotope', () => {
    const built = build('neutrons-from-mass-and-atomic-number', 'q3')
    for (const b of built) {
      const { Z: z, A } = values(b)
      expect(Z[String(b.values.element)], b.seed).toBe(z)
      expect(b.question.prompt).toContain(`atomic number of ${z}`)
      expect(b.question.prompt).toMatch(new RegExp(`mass number of ${A}\\b|-${A} `))
      expect(answer(b)).toBe(A! - z!)
      expect(answer(b)).not.toBe(z)
      expect(answer(b)).toBeGreaterThan(1)
      expect(b.question.solution).toContain(`$${A} - ${z} = $ **${answer(b)}** neutrons.`)
      expect(method(b, 0)).toBe(`mass number minus atomic number: $${A} - ${z}$`)
      expect(last(b)).toBe(String(answer(b)))
      expect(tolerance(b)).toBe(0)
      expect(units(b)).toBeUndefined()
    }
    expect(contexts(built)).toBe(3)
    expect(new Set(built.map((b) => b.values.element)).size).toBeGreaterThanOrEqual(40)
  })

  it('q10 gives the atomic number, never equal to the neutron count', () => {
    const built = build('electrons-in-a-neutral-atom', 'q10')
    for (const b of built) {
      const { Z: z, A } = values(b)
      expect(Z[String(b.values.element)], b.seed).toBe(z)
      expect(b.question.prompt).toContain(`atomic number of ${z}`)
      expect(b.question.prompt).toContain(String(A))
      expect(b.question.prompt).toMatch(/neutral/)
      expect(answer(b)).toBe(z)
      // Mass number less atomic number, the neutrons, must not land on the answer.
      expect(A! - z!).not.toBe(z)
      expect(b.question.solution).toContain(`which is the atomic number: **${z}**`)
      expect(method(b, 0)).toBe('electrons equal protons in a neutral atom')
      expect(units(b)).toBeUndefined()
    }
    expect(contexts(built)).toBe(3)
  })
})

describe('alpha decay', () => {
  it('q4 subtracts 4 from a real alpha emitter and names the nucleus it becomes', () => {
    const built = build('mass-number-after-alpha-decay', 'q4')
    for (const b of built) {
      const { Z: z, A } = values(b)
      const element = String(b.values.element)
      expect(ALPHA_EMITTERS.has(`${element}-${A}`), `${b.seed} ${element}-${A}`).toBe(true)
      expect(Z[element]).toBe(z)
      expect(b.question.prompt).toContain(String(A))
      expect(b.question.prompt).toContain('alpha particle')
      expect(b.question.prompt).not.toMatch(/\ban u/)
      expect(answer(b)).toBe(A! - 4)
      expect(b.question.solution).toContain(`$${A} - 4 = $ **${A! - 4}**.`)
      const daughter = Object.keys(Z).find((k) => Z[k] === z! - 2)!
      if (!['wording 1', 'wording 5'].includes(String(b.values.context))) expect(b.question.solution).toContain(`The new nucleus is ${daughter}-${A! - 4}, with atomic number ${z! - 2}.`)
      expect(method(b, 0)).toBe(`subtracts 4: $${A} - 4$`)
      expect(units(b)).toBeUndefined()
    }
    expect(contexts(built)).toBe(5)
  })

  it('q20 balances the top row for the missing mass number, either side, and checks the bottom row', () => {
    const SYMBOL: Record<number, string> = { 82: 'Pb', 84: 'Po', 85: 'At', 86: 'Rn', 87: 'Fr', 88: 'Ra', 89: 'Ac', 90: 'Th', 91: 'Pa', 92: 'U', 93: 'Np', 94: 'Pu', 95: 'Am', 96: 'Cm', 98: 'Cf' }
    const built = build('alpha-equation-mass-number', 'q20')
    for (const b of built) {
      const { Z: z, A } = values(b)
      const parentMissing = b.values.context === 'parent missing'
      expect(ALPHA_EMITTERS.has(`${b.values.element}-${A}`), b.seed).toBe(true)
      const top = parentMissing ? 'A' : String(A)
      const bottom = parentMissing ? String(A! - 4) : 'A'
      expect(b.question.prompt).toContain(`$\\mathrm{^{${top}}_{${z}}${SYMBOL[z!]}} \\rightarrow \\mathrm{^{${bottom}}_{${z! - 2}}${SYMBOL[z! - 2]}} + \\mathrm{^{4}_{2}He}$`)
      expect(answer(b)).toBe(parentMissing ? A : A! - 4)
      // The prompt never gives the answer away in a name such as "polonium-210".
      if (parentMissing) expect(b.question.prompt).not.toContain(`-${A}`)
      expect(method(b, 0)).toBe(parentMissing ? `$A = ${A! - 4} + 4$` : `$${A} = A + 4$`)
      expect(b.question.solution).toContain(`so $A = $ **${answer(b)}**. The bottom row checks it: $${z} = ${z! - 2} + 2$.`)
      expect(units(b)).toBeUndefined()
    }
    expect(contexts(built)).toBe(2)
  })
})

describe('half-life', () => {
  const COUNT = ['', '', 'two', 'three', 'four', 'five']
  const HALVES = ['', '', 'twice', 'three times', 'four times', 'five times']

  it('q6 halves the activity once per half-life, with the half-life the isotope really has', () => {
    const built = build('activity-after-half-lives', 'q6')
    for (const b of built) {
      const { start, half, n } = values(b)
      const name = String(b.values.context)
      if (HALF_LIFE[name]) {
        expect(half, b.seed).toBe(HALF_LIFE[name]![0])
        expect(b.question.prompt).toContain(`${prose(half!)} ${HALF_LIFE[name]![1]}`)
      }
      const time = Number(show(n! * half!))
      expect(n).toBeGreaterThanOrEqual(2)
      expect(n).toBeLessThanOrEqual(5)
      expect(b.question.prompt).toContain(`${prose(start!)} Bq`)
      expect(b.question.prompt).toContain(`after ${prose(time)} `)
      expect(start).toBeGreaterThanOrEqual(200)
      expect(start).toBeLessThanOrEqual(20000)
      expect(answer(b)).toBe(start! / 2 ** n!)
      expect(Number.isInteger(answer(b))).toBe(true)
      for (const g of [half!, time]) for (const x of [answer(b), start!]) expect([1, 2, 5]).not.toContain(front(x / g))
      const chain = Array.from({ length: n! }, (_, i) => `${tex(start! / 2 ** i)} \\to `).join('')
      expect(b.question.solution).toBe(`$${tex(time)} \\div ${tex(half!)} = ${n}$ half-lives, so halve ${HALVES[n!]}: $${chain}$ **${answer(b)} Bq**.`)
      expect(method(b, 0)).toBe(`${COUNT[n!]} half-lives: $${tex(time)} \\div ${tex(half!)} = ${n}$`)
      expect(method(b, 1)).toBe(`halves ${HALVES[n!]}`)
      expect(last(b)).toBe(String(answer(b)))
      expect(tolerance(b)).toBe(0)
      expect(units(b)).toBe('Bq')
    }
    expect(contexts(built)).toBe(14)
    expect(new Set(built.map((b) => b.values.n))).toEqual(new Set([2, 3, 4, 5]))
  })

  it('q13 converts the time to the half-life’s unit first, then halves', () => {
    const PER: Record<string, number> = { minute: 60, hour: 60, day: 24, week: 7 }
    const built = build('count-rate-after-half-lives', 'q13')
    for (const b of built) {
      const { start, half, time, n } = values(b)
      const name = String(b.values.context)
      if (HALF_LIFE[name]) expect(half, b.seed).toBe(HALF_LIFE[name]![0])
      const [, big] = /after [\d.]+ (minute|hour|day|week)s?/.exec(b.question.prompt)!
      const inSmall = time! * PER[big!]!
      expect(b.question.prompt).toContain(`${prose(start!)} counts per minute`)
      expect(b.question.prompt).toMatch(new RegExp(`half-life (of|is) ${half} `))
      expect(b.question.prompt).toMatch(new RegExp(`after ${show(time!)} ${big}`))
      expect(time).toBeGreaterThanOrEqual(1)
      expect(inSmall / half!).toBe(n)
      expect(answer(b)).toBe(start! / 2 ** n!)
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(method(b, 0)).toMatch(new RegExp(`^converts ${show(time!)} ${big}s? to ${show(inSmall)} \\w+: \\$${show(inSmall)} \\\\div ${half} = ${n}\\$ half-lives$`))
      expect(method(b, 1)).toBe(`halves ${HALVES[n!]} or divides by $2^${n}$`)
      expect(b.question.solution).toContain(`= **${n}** half-lives.`)
      expect(b.question.solution).toContain(`$${tex(start!)} \\div 2^${n} = ${tex(start!)} \\div ${2 ** n!} = ${answer(b)}$.`)
      expect(units(b)).toBeUndefined()
    }
    expect(contexts(built)).toBe(5)
  })

  it('q13 never asks one context the same span: no n or time is more than 40% of its builds', () => {
    // Bismuth-214 was always 3 half-lives in 1 hour, and technetium-99m always 4 in 1 day.
    const share = (xs: unknown[]) => Math.max(...[...new Set(xs)].map((x) => xs.filter((y) => y === x).length)) / xs.length
    const built = build('count-rate-after-half-lives', 'q13', 600)
    const byContext = new Map<unknown, Generated[]>()
    for (const b of built) byContext.set(b.values.context, [...(byContext.get(b.values.context) ?? []), b])
    for (const [context, group] of byContext) {
      expect(share(group.map((b) => b.values.n)), `${context} n`).toBeLessThanOrEqual(0.4)
      expect(share(group.map((b) => b.values.time)), `${context} time`).toBeLessThanOrEqual(0.4)
    }
  })
})

describe('spread across builds', () => {
  const share = (xs: unknown[]) => {
    const counts = new Map<unknown, number>()
    for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1)
    return Math.max(...counts.values()) / xs.length
  }
  const slots = atomGenerators.flatMap((g) => g.replaces.map((id) => [g.id, id] as const))

  it('covers the six slots a number can stand in for', () => expect(slots).toHaveLength(6))

  for (const [id, slotId] of slots) {
    it(`${id} ${slotId}: no answer is more than 40% of the builds, in all or in any context`, () => {
      const built = build(id, slotId)
      for (const b of built) expect(b.question.prompt).not.toMatch(/\ba \d/)
      expect(share(built.map(answer))).toBeLessThanOrEqual(0.4)
      const byContext = new Map<unknown, number[]>()
      for (const b of built) byContext.set(b.values.context, [...(byContext.get(b.values.context) ?? []), answer(b)])
      for (const [context, answers] of byContext) {
        expect(share(answers), `${context}`).toBeLessThanOrEqual(0.4)
        expect(new Set(answers).size, `${context}`).toBeGreaterThanOrEqual(3)
      }
    })
  }
})
