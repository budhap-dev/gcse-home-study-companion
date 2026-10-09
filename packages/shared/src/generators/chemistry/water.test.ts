import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { toPlaces } from './build.ts'
import { WATER, waterGenerators } from './water.ts'

/**
 * Structural tests for the dissolved-solids generators (required practical 8). Each reads the
 * prompt's own masses and volumes back, works the answer again from them alone, and checks the
 * printed working and the conversion to dm³. Across builds they check every water turns up, each
 * with the dissolved solids it really has, and that no answer or input fills a context.
 */
const TOPIC = 'potable-and-waste-water'
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/chemistry')
const bank = Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = bank.find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `structure-${i}`))
}

const clean = (x: number) => Number(x.toPrecision(12))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const tenfold = (a: number, b: number) => {
  const l = Math.log10(Math.abs(a / b))
  return Math.abs(l - Math.round(l)) < 1e-9
}
const shifted = (a: number, b: number) => tenfold(a, b) || tenfold(a, 2 * b) || tenfold(2 * a, b)
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context)).size
const places = (text: string) => (text.includes('.') ? text.split('.')[1]!.length : 0)
const method = (b: Generated) => b.question.markScheme.slice(0, -1).map((l) => l.description)
const water = (b: Generated) => WATER.WATERS.find((w) => w.name === b.values.context)!
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
  const many = build(id, slot, 1000)
  const a = worstShare(many, answer)
  expect(a.worst, `${id} answer`).toBeLessThanOrEqual(0.4)
  expect(a.fewest, `${id} answers per context`).toBeGreaterThanOrEqual(fewest)
  for (const k of keys) expect(worstShare(many, (b) => b.values[k]).worst, `${id} ${k}`).toBeLessThanOrEqual(0.4)
}

describe('every potable water build', () => {
  it('has a generator for each numeric written slot', () => {
    expect(waterGenerators.flatMap((g) => g.replaces).sort()).toEqual(['q13', 'q17', 'q5', 'q8'])
    expect(bank.filter((q) => q.type === 'numeric').map((q) => q.id).sort()).toEqual(['q13', 'q17', 'q5', 'q8'])
  })

  it('prints no article before a figure, keeps the written units, and ends on the answer', () => {
    for (const g of waterGenerators) {
      for (const id of g.replaces) {
        for (const b of build(g.id, id, 150)) {
          expect(b.question.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
          if (b.question.type === 'numeric') expect(b.question.units, b.seed).toBeUndefined()
          expect(b.question.solution, b.seed).toContain(String(answer(b)))
          expect(b.question.markScheme.at(-1)!.description).toBe(show(answer(b)))
          expect(b.question.prompt).toMatch(/in grams|g\/dm³\?/)
        }
      }
    }
  })

  it('never fails to draw, over 3000 seeds per slot', () => {
    for (const g of waterGenerators) {
      for (const id of g.replaces) {
        const slot = bank.find((q) => q.id === id)!
        expect(() => {
          for (let i = 0; i < 3000; i++) generate(g, slot, `throw-${i}`)
        }, `${g.id} ${id}`).not.toThrow()
      }
    }
  })

  it('gives each water the dissolved solids it really has', () => {
    const range = Object.fromEntries(WATER.WATERS.map((w) => [w.name, w.conc]))
    expect(range['tap water']![1]).toBeLessThanOrEqual(0.5)
    expect(range['sea water']![0]).toBeGreaterThanOrEqual(33)
    expect(range['sea water']![1]).toBeLessThanOrEqual(38)
    for (const w of [...WATER.WATERS, ...WATER.LEFT]) expect(w.volumes).not.toContain(100)
    // A sample evaporated in a weighed dish is 500 cm³ at most.
    for (const w of WATER.WATERS) expect(Math.max(...w.volumes)).toBeLessThanOrEqual(500)
    // A balance reading to 0.01 g can just see 0.05 g of solids.
    for (const [lo] of Object.values(WATER.RESIDUES)) expect(lo).toBeGreaterThanOrEqual(0.05)
  })
})

describe('the dissolved solids practical', () => {
  it('q5: the dish after less the dish before, both to 0.01 g', () => {
    const built = build('water-dissolved-solids-mass', 'q5')
    for (const b of built) {
      const [d, a] = [...b.question.prompt.matchAll(/(\d+\.\d\d) g/g)].map((m) => m[1]!)
      expect(Number(d) >= 30 && Number(d) <= 60).toBe(true)
      expect(Number(a)).toBeGreaterThan(Number(d))
      expect(answer(b)).toBe(clean(Number(a) - Number(d)))
      const [lo, hi] = WATER.RESIDUES[String(b.values.context)]!
      expect(answer(b) >= lo - 1e-9 && answer(b) <= hi + 1e-9).toBe(true)
      expect(b.question.prompt).toContain(water(b).sample)
      expect(b.question.solution).toContain(`$${a} - ${d} = $ **${answer(b).toFixed(2)} g**`)
      // The answer is not the dish's last two digits read off.
      expect(d!.endsWith(answer(b).toFixed(2).slice(-2))).toBe(false)
      expect(tolerance(b)).toBe(toPlaces(answer(b), 2))
    }
    expect(contexts(built)).toBe(5)
    spread('water-dissolved-solids-mass', 'q5', ['dish'])
  })

  it('q8: the mass over the volume in dm³, the conversion its method line', () => {
    const built = build('water-dissolved-solids-concentration', 'q8')
    for (const b of built) {
      const p = b.question.prompt
      const v = Number(/(\d+) cm³/.exec(p)![1])
      const mText = /(\d+\.\d\d) g/.exec(p)![1]!
      const m = Number(mText)
      expect(p).toContain(water(b).noun)
      expect(answer(b)).toBe(clean(m / (v / 1000)))
      expect(method(b)).toEqual([`converts to ${show(v / 1000)} dm3`])
      expect(b.question.solution).toContain(`\\dfrac{${mText}}{${show(v / 1000)}} = $ **${show(answer(b))} g/dm³**`)
      const [lo, hi] = water(b).conc
      expect(answer(b) >= lo && answer(b) <= hi).toBe(true)
      expect(m).toBeGreaterThanOrEqual(0.05)
      expect([10, 100, 1000]).not.toContain(v)
      expect(shifted(answer(b), m) || shifted(answer(b), v) || shifted(m, v)).toBe(false)
      expect(tolerance(b)).toBe(toPlaces(answer(b), Math.max(places(show(answer(b))), 2)))
    }
    expect(contexts(built)).toBe(5)
    spread('water-dissolved-solids-concentration', 'q8', ['v', 'm'])
  })

  it('q13: readings that fall less each time until two agree, the last of them the answer', () => {
    const built = build('water-constant-mass', 'q13')
    for (const b of built) {
      const xs = [...b.question.prompt.matchAll(/(\d+\.\d\d)/g)].map((m) => Number(m[1]))
      expect([4, 5]).toContain(xs.length)
      expect(xs.at(-1)).toBe(xs.at(-2))
      const losses = xs.slice(1, -1).map((x, i) => clean(xs[i]! - x))
      for (const l of losses) expect(l).toBeGreaterThan(0)
      for (let i = 1; i < losses.length; i++) expect(losses[i]!).toBeLessThan(losses[i - 1]!)
      const [lo, hi] = water(b).firstLoss
      expect(losses[0]! >= lo - 1e-9 && losses[0]! <= hi + 1e-9).toBe(true)
      // A fresh water's 0.05 to 0.15 g of solids holds only a few hundredths of a gram of water.
      if (!['sea water', 'estuary water'].includes(String(b.values.context))) expect(clean(xs[0]! - xs.at(-1)!)).toBeLessThanOrEqual(0.06)
      expect(answer(b)).toBe(xs.at(-1))
      expect(method(b)).toEqual(['identifies that the mass has stopped changing'])
      expect(b.question.solution).toContain(`**${answer(b).toFixed(2)} g**`)
      expect(tolerance(b)).toBe(toPlaces(answer(b), 2))
    }
    expect(contexts(built)).toBe(5)
    spread('water-constant-mass', 'q13', ['final', 'first'])
  })

  it('q17: the concentration times the volume in dm³, "about" for a natural water whose figure varies', () => {
    const built = build('water-mass-left', 'q17')
    for (const b of built) {
      const p = b.question.prompt
      const c = Number(/(\d+(?:\.\d+)?) g\/dm³/.exec(p)![1])
      const v = Number(/(\d+) cm³/.exec(p)![1])
      expect(p).toContain(water(b).contains(show(c)))
      if (['sea water', 'estuary water'].includes(String(b.values.context))) expect(p).toContain('about')
      expect(answer(b)).toBe(clean((c * v) / 1000))
      expect(method(b)).toEqual([`converts to ${show(v / 1000)} dm3`])
      expect(b.question.solution).toContain(`${show(c)} \\times ${show(v / 1000)} = $ **${show(answer(b))} g**`)
      const [lo, hi] = water(b).conc
      expect(c >= lo && c <= hi).toBe(true)
      expect(answer(b)).toBeGreaterThanOrEqual(0.05)
      expect(Number.isInteger(answer(b) * 100) || Math.abs(answer(b) * 100 - Math.round(answer(b) * 100)) < 1e-6).toBe(true)
      expect([10, 100, 1000]).not.toContain(v)
      expect(shifted(answer(b), c) || shifted(answer(b), v)).toBe(false)
    }
    expect(contexts(built)).toBe(5)
    spread('water-mass-left', 'q17', ['v', 'c'])
  })
})
