import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { show } from '../format.ts'
import { figures } from '../physics/build.ts'
import { sigFigs } from '../physics/format.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { clearOf, distinct, places, toPlaces } from './build.ts'
import { RATES, rateGenerators } from './rates.ts'

/**
 * Structural tests for the rate generators. Each reads the prompt's volume and time, or the
 * tangent's rise and run, back and works the rate again from them alone; checks the reaction's
 * gas, the syringe's 100 cm³, and that dividing by the wrong time is marked wrong. Across builds
 * they check every reaction turns up and that no answer or input fills a context.
 */
const TOPIC = 'measuring-rates-of-reaction'
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/chemistry')
const bankOf = (topic: string) => Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${topic}.json`), 'utf8')).questions)
const bank = bankOf(TOPIC)

function build(generatorId: string, slotId: string, count = 300): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = bank.find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `structure-${i}`))
}

const clean = (x: number) => Number(x.toPrecision(12))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const method = (b: Generated) => b.question.markScheme.slice(0, -1).map((l) => l.description)
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context)).size
const reaction = (b: Generated) => RATES.REACTIONS.find((c) => c.name === b.values.context)!
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

describe('every rate build', () => {
  it('has a generator for each numeric written slot it can vary; the equilibrium and Haber slots stay written', () => {
    expect(rateGenerators.flatMap((g) => g.replaces).sort()).toEqual(['q2', 'q6'])
    expect(bank.filter((q) => q.type === 'numeric').map((q) => q.id).sort()).toEqual(['q2', 'q6'])
    // Recall (200 atm, 450 °C, the same energy both ways) and one fixed equation each: nothing to vary.
    for (const t of ['equilibria-and-le-chateliers-principle', 'the-haber-process-and-fertilisers']) expect(GENERATORS.some((g) => g.topicId === t)).toBe(false)
  })

  it('prints no article before a figure, asks in cm³/s with no units field, and reaches the answer', () => {
    for (const g of rateGenerators) {
      for (const id of g.replaces) {
        for (const b of build(g.id, id, 150)) {
          const q = b.question
          expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
          expect(q.type === 'numeric' && q.units, b.seed).toBeUndefined()
          expect(q.prompt).toMatch(/in cm³\/s\.$/)
          expect(q.solution, b.seed).toContain(String(answer(b)))
          expect(q.markScheme.at(-1)!.description).toBe(`${show(answer(b))} cm³/s`)
          expect(q.prompt.startsWith(reaction(b).text)).toBe(true)
          // An exact rate of three figures at most, so its three-figure rounding is itself.
          expect(figures(answer(b))).toBeLessThanOrEqual(3)
          expect(places(answer(b))).toBeLessThanOrEqual(2)
          expect(sigFigs(answer(b), 3)).toBe(answer(b))
          expect(mark(q, String(answer(b))).correct).toBe(true)
          expect(tolerance(b)).toBe(toPlaces(answer(b), 2))
        }
      }
    }
  })

  it('never fails to draw, over 3000 seeds per slot', () => {
    for (const g of rateGenerators) {
      for (const id of g.replaces) {
        const slot = bank.find((q) => q.id === id)!
        expect(() => {
          for (let i = 0; i < 3000; i++) generate(g, slot, `throw-${i}`)
        }, `${g.id} ${id}`).not.toThrow()
      }
    }
  })

  it('gives each reaction the speed it has, and never 10 or 100 s', () => {
    const r = Object.fromEntries(RATES.REACTIONS.map((c) => [c.name, c.rate]))
    expect(r['zinc and sulfuric acid']![1]).toBeLessThan(r['marble chips and hydrochloric acid']![1])
    expect(r['marble chips and hydrochloric acid']![1]).toBeLessThan(r['magnesium and hydrochloric acid']![1])
    for (const c of RATES.REACTIONS) for (const t of c.times) expect([10, 100]).not.toContain(t)
    expect(RATES.RUNS).not.toContain(10)
    expect(RATES.RUNS).not.toContain(100)
    expect(Math.max(...RATES.VOLUMES)).toBeLessThanOrEqual(100)
  })
})

describe('rates of reaction', () => {
  it('q2: volume of gas over the time it took', () => {
    const built = build('reaction-mean-rate', 'q2')
    for (const b of built) {
      const p = b.question.prompt
      const c = reaction(b)
      const v = Number(new RegExp(`(\\d+) cm³ of ${c.gas}`).exec(p)![1])
      const t = Number(/(\d+) s\b/.exec(p)![1])
      expect(answer(b)).toBe(clean(v / t))
      expect(v).toBeLessThanOrEqual(100)
      expect(c.times).toContain(t)
      expect(answer(b) >= c.rate[0] && answer(b) <= c.rate[1]).toBe(true)
      expect(clearOf(answer(b), v, t) && distinct(v, t, answer(b))).toBe(true)
      expect(b.question.solution).toContain(`\\dfrac{${v}}{${t}} = ${show(answer(b))}$ cm³/s`)
      expect(method(b)).toEqual(['divides the volume by the time'])
      // Time over volume is marked wrong.
      expect(mark(b.question, String(clean(t / v))).correct).toBe(false)
    }
    expect(contexts(built)).toBe(4)
    spread('reaction-mean-rate', 'q2', ['v', 't'])
  })

  it('q6: the tangent rise over its run, not over the time it touches', () => {
    const built = build('reaction-rate-tangent', 'q6')
    for (const b of built) {
      const p = b.question.prompt
      const c = reaction(b)
      const at = Number(/at (\d+) s/.exec(p)![1])
      const rise = Number(/rises (\d+) cm³/.exec(p)![1])
      const run = Number(/run of (\d+) s/.exec(p)![1])
      expect(p).toContain(`volume of ${c.gas} against time`)
      expect(answer(b)).toBe(clean(rise / run))
      expect(answer(b) >= c.rate[0] && answer(b) <= c.rate[1]).toBe(true)
      expect(RATES.RUNS).toContain(run)
      expect(at).not.toBe(run)
      // The curve lies above its tangent, so the gas by then is at least rate × time: inside the syringe.
      expect(answer(b) * at).toBeLessThanOrEqual(90)
      expect(mark(b.question, String(clean(rise / at))).correct).toBe(false)
      expect(clearOf(answer(b), rise, run, at) && distinct(rise, run, at, answer(b))).toBe(true)
      expect(b.question.solution).toContain(`\\dfrac{${rise}}{${run}} = ${show(answer(b))}$ cm³/s`)
      expect(method(b)).toEqual(['divides rise by run'])
    }
    expect(contexts(built)).toBe(4)
    spread('reaction-rate-tangent', 'q6', ['rise', 'run', 'at'])
    // Drawn by gradient, not by run: tenths, which most runs divide into, do not crowd out the rest.
    const many = build('reaction-rate-tangent', 'q6', 2000)
    for (const c of RATES.REACTIONS) {
      const group = many.filter((b) => b.values.context === c.name)
      const fifths = group.filter((b) => Math.abs(answer(b) * 5 - Math.round(answer(b) * 5)) < 1e-9).length
      expect(fifths / group.length, c.name).toBeLessThan(0.25)
    }
    expect(worstShare(many, answer).worst).toBeLessThan(0.1)
  })
})
