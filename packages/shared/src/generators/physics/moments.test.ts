import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { dpTolerance } from './format.ts'

/**
 * Structural tests for the moments, levers and gears generators. The release check proves each
 * answer agrees with a second route; these read the prompt's own numbers and the working
 * printed on the way and check each step is the right one, because a right answer can be
 * reached by a wrong route. They also look across a run of builds for what no single build can
 * show: a context list that never rotates, or one value that most draws land on.
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
const method = (b: Generated, i: number) => b.question.markScheme[i]!.description
/** A number inside maths as the generators print it: 12\,000 from five digits. */
const tex = (x: number) => (Math.abs(x) >= 10000 ? show(x).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : show(x))
/** A number in prose: 12 000 from five digits. */
const prose = (x: number) => (Math.abs(x) >= 10000 ? show(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : show(x))
const values = (b: Generated) => b.values as Record<string, number>
/** The end of a worked solution as closes() prints it. */
const ends = (expr: string, answer: number, unit: string) => (answer < 10000 ? `${expr} = ${show(answer)}$ ${unit}` : `${expr}$, which is **${answer} ${unit}**`)
const decimals = (x: number) => (show(x).includes('.') ? show(x).split('.')[1]!.length : 0)
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context)).size
const SHIFTS = [0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000, 100000]

/** Every build: no "a 8", the written slot's units, and the tolerance rounding allows. */
function common(b: Generated, unit: string) {
  expect(b.question.prompt, b.seed).not.toMatch(/\ba \d/)
  expect(units(b)).toBe(unit)
  expect(tolerance(b), b.seed).toBe(dpTolerance(answer(b)))
}

describe('M = F d', () => {
  it('multiplies the force by a distance in metres that is never a power of ten', () => {
    const built = build('moment-from-force-and-distance', 'q2')
    for (const b of built) {
      const { F, d } = values(b)
      common(b, 'N m')
      expect(b.question.prompt, b.seed).toContain(`${prose(F!)} N`)
      expect(b.question.prompt).toContain(`${show(d!)} m`)
      expect(b.question.prompt).toMatch(/N m[.?]/)
      expect(SHIFTS).not.toContain(d)
      expect(answer(b)).toBe(clean(F! * d!))
      expect(answer(b)).not.toBe(F)
      expect(answer(b)).not.toBe(d)
      expect(decimals(answer(b))).toBeLessThanOrEqual(2)
      expect(b.question.solution).toContain(ends(`M = F d = ${tex(F!)} \\times ${tex(d!)}`, answer(b), 'N m'))
      expect(method(b, 0)).toBe(`$${tex(F!)} \\times ${tex(d!)}$`)
      expect(last(b)).toBe(`${prose(answer(b))} N m`)
    }
    expect(contexts(built)).toBe(7)
  })

  it('converts centimetres to metres in the working and the first mark', () => {
    const built = build('moment-with-a-unit-conversion', 'q5')
    for (const b of built) {
      const { L, F } = values(b)
      common(b, 'N m')
      const d = clean(L! / 100)
      expect(b.question.prompt, b.seed).toContain(`${show(L!)} cm`)
      expect(b.question.prompt).toContain(`${prose(F!)} N`)
      expect(b.question.prompt).not.toMatch(/\d m\b/)
      expect(SHIFTS).not.toContain(d)
      expect(SHIFTS).not.toContain(F)
      expect(answer(b)).toBe(clean(F! * d))
      expect(answer(b)).not.toBe(F)
      expect(answer(b)).not.toBe(L)
      expect(b.question.solution).toContain(`$${show(L!)}$ cm $= ${show(d)}$ m.`)
      expect(b.question.solution).toContain(ends(`M = F d = ${tex(F!)} \\times ${show(d)}`, answer(b), 'N m'))
      expect(method(b, 0)).toBe(`${show(L!)} cm converted to ${show(d)} m`)
      expect(b.question.markScheme.map((l) => l.code)).toEqual(['M1', 'A1'])
    }
    expect(contexts(built)).toBe(6)
  })

  it('finds the weight with g = 9.8, then its moment, never 1 kg nor a moment of 9.8', () => {
    const built = build('moment-of-a-weight', 'q8')
    for (const b of built) {
      const { m, d } = values(b)
      common(b, 'N m')
      expect(b.question.prompt, b.seed).toContain(`${prose(m!)} kg`)
      expect(b.question.prompt).toContain(`${show(d!)} m`)
      expect(b.question.prompt).toMatch(/9\.8\$? N\/kg/)
      const W = clean(m! * 9.8)
      expect(m).not.toBe(1)
      expect(SHIFTS).not.toContain(d)
      expect(answer(b)).toBe(clean(W * d!))
      expect(answer(b)).not.toBe(9.8)
      expect(answer(b)).not.toBe(W)
      expect(b.question.solution).toContain(`Weight $= m g = ${tex(m!)} \\times 9.8 = ${tex(W)}$ N.`)
      expect(b.question.solution).toContain(ends(`Moment $= ${tex(W)} \\times ${tex(d!)}`, answer(b), 'N m'))
      expect(method(b, 0)).toBe(`$W = ${tex(W)}$ N`)
      expect(method(b, 1)).toBe(`$${tex(W)} \\times ${tex(d!)}$`)
    }
    expect(contexts(built)).toBe(6)
  })
})

describe('a beam on two supports', () => {
  it('gives a right support that moments make true, and takes it from the total down', () => {
    const built = build('support-force-from-balance', 'q10')
    for (const b of built) {
      const { len, x, Wb, P, R } = values(b)
      common(b, 'N')
      expect(b.question.prompt, b.seed).toContain(`length ${show(len!)} m`)
      expect(b.question.prompt).toContain(`weight ${prose(Wb!)} N`)
      expect(b.question.prompt).toContain(`${prose(P!)} N`)
      expect(b.question.prompt).toContain(`${show(x!)} m from the left end`)
      expect(b.question.prompt).toContain(`force of ${prose(R!)} N`)
      // The given right support is the one moments about the left end give.
      expect(R! * len!).toBeCloseTo(P! * x! + Wb! * (len! / 2), 9)
      expect(x).not.toBe(len! / 2)
      expect(x).toBeGreaterThan(0)
      expect(x).toBeLessThan(len!)
      const L = P! + Wb! - R!
      expect(answer(b)).toBe(L)
      expect(Number.isInteger(L)).toBe(true)
      expect(new Set([L, R, P, Wb]).size).toBe(4)
      expect(b.question.solution).toContain(`$L + ${tex(R!)} = ${tex(P!)} + ${tex(Wb!)}$`)
      expect(b.question.solution).toContain(ends(`L = ${tex(P! + Wb!)} - ${tex(R!)}`, L, 'N'))
      expect(b.question.solution).toContain(`$R \\times ${show(len!)} = ${tex(P!)} \\times ${show(x!)} + ${tex(Wb!)} \\times ${show(len! / 2)} = ${tex(clean(R! * len!))}$`)
      expect(method(b, 0)).toBe(`$L + R = ${tex(P! + Wb!)}$`)
      expect(last(b)).toBe(`${prose(L)} N`)
    }
    expect(contexts(built)).toBe(6)
  })
})

describe('balancing with masses', () => {
  it('equates the moments, cancels g and divides, landing where the seesaw or rule reaches', () => {
    const built = build('balancing-with-masses', 'q12')
    const reach: Record<string, [number, number]> = { 'child and adult': [0.4, 2.5], 'adult and child': [0.8, 2.5], 'two children': [0.6, 2.5], 'metre rule': [0.05, 0.49], crane: [15, 60] }
    for (const b of built) {
      const { m1, d1, m2 } = values(b)
      common(b, 'm')
      expect(b.question.prompt, b.seed).toContain(`${prose(m1!)} kg`)
      expect(b.question.prompt).toContain(`${show(d1!)} m`)
      expect(b.question.prompt).toContain(`${prose(m2!)} kg`)
      const product = clean(m1! * d1!)
      const d2 = answer(b)
      expect(d2).toBeCloseTo(product / m2!, 9)
      expect(decimals(d2)).toBeLessThanOrEqual(2)
      const [lo, hi] = reach[String(b.values.context)]!
      expect(d2).toBeGreaterThanOrEqual(lo)
      expect(d2).toBeLessThanOrEqual(hi)
      expect(m1).not.toBe(m2)
      expect([2, 0.5]).not.toContain(clean(m2! / m1!))
      expect(d2).not.toBe(d1)
      expect(b.question.solution).toContain(`$${tex(m1!)}g \\times ${show(d1!)} = ${tex(m2!)}g \\times d$`)
      expect(b.question.solution).toContain(`$${tex(product)} = ${tex(m2!)}d$`)
      expect(b.question.solution).toContain(ends(`d = ${tex(product)} \\div ${tex(m2!)}`, d2, 'm'))
      expect(method(b, 1)).toBe(`$${tex(product)} = ${tex(m2!)} d$`)
    }
    expect(contexts(built)).toBe(5)
  })
})

describe('gears', () => {
  it('multiplies the moment by the teeth ratio, always onto a larger output gear', () => {
    const built = build('moment-through-gears', 'q14')
    for (const b of built) {
      const { n1, n2, M1 } = values(b)
      common(b, 'N m')
      expect(b.question.prompt, b.seed).toContain(`${n1} teeth`)
      expect(b.question.prompt).toContain(`${n2} teeth`)
      expect(b.question.prompt).toContain(`${show(M1!)} N m`)
      for (const n of [n1!, n2!]) {
        expect(Number.isInteger(n)).toBe(true)
        expect(n).toBeGreaterThanOrEqual(10)
        expect(n).toBeLessThanOrEqual(60)
      }
      const ratio = clean(n2! / n1!)
      expect(ratio).toBeGreaterThanOrEqual(1.25)
      expect(ratio).toBeLessThanOrEqual(5)
      expect(decimals(ratio)).toBeLessThanOrEqual(2)
      expect(answer(b)).toBe(clean(M1! * ratio))
      expect(answer(b)).not.toBe(M1)
      expect(b.question.solution).toContain(`$${n2} \\div ${n1} = ${show(ratio)}$`)
      expect(b.question.solution).toContain(ends(`${tex(M1!)} \\times ${show(ratio)}`, answer(b), 'N m'))
      expect(method(b, 0)).toBe(`ratio $${n2} \\div ${n1} = ${show(ratio)}$`)
      expect(method(b, 1)).toBe('same force at the teeth, larger radius')
    }
    expect(contexts(built)).toBe(5)
  })

  it('turns the driven gear at the driver speed times the teeth ratio, a whole number of rpm', () => {
    const built = build('speed-through-gears', 'q16')
    for (const b of built) {
      const { n1, n2, f1 } = values(b)
      expect(b.question.prompt, b.seed).not.toMatch(/\ba \d/)
      expect(units(b)).toBe('rpm')
      expect(tolerance(b)).toBe(0)
      expect(b.question.prompt).toContain(`${n1} teeth`)
      expect(b.question.prompt).toContain(`${n2} teeth`)
      expect(b.question.prompt).toContain(`${prose(f1!)} revolutions per minute`)
      expect(n1).not.toBe(n2)
      const f2 = answer(b)
      expect(f2 * n2!).toBe(f1! * n1!)
      expect(Number.isInteger(f2)).toBe(true)
      expect(new Set([f2, f1, n1, n2]).size).toBe(4)
      expect(b.question.solution).toContain(n2! < n1! ? `$${n1} \\div ${n2}$ revolutions for each turn of the ${n1}-tooth gear` : `$${n1} \\div ${n2}$ of a revolution`)
      expect(b.question.solution).toContain(ends(`${tex(f1!)} \\times ${n1} \\div ${n2}`, f2, 'rpm'))
      expect(b.question.solution).toContain(n2! < n1! ? 'faster but with a smaller moment' : 'more slowly but with a larger moment')
      expect(method(b, 0)).toBe(`ratio ${n1}:${n2}, or $${tex(f1!)} \\times ${n1} \\div ${n2}$`)
      expect(last(b)).toBe(prose(f2))
    }
    expect(new Set(built.map((b) => values(b).n2! < values(b).n1!))).toEqual(new Set([true, false]))
    expect(contexts(built)).toBe(5)
  })
})

describe('spread across builds', () => {
  const share = (built: Generated[], key: (b: Generated) => unknown) => {
    const counts = new Map<unknown, number>()
    for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
    return Math.max(...counts.values()) / built.length
  }
  const cases: [string, string, (b: Generated) => unknown][] = [
    ['moment-from-force-and-distance', 'q2', answer],
    ['moment-from-force-and-distance', 'q2', (b) => values(b).d],
    ['moment-with-a-unit-conversion', 'q5', answer],
    ['moment-with-a-unit-conversion', 'q5', (b) => values(b).L],
    ['moment-of-a-weight', 'q8', answer],
    ['moment-of-a-weight', 'q8', (b) => values(b).d],
    ['support-force-from-balance', 'q10', answer],
    ['support-force-from-balance', 'q10', (b) => values(b).x],
    ['balancing-with-masses', 'q12', answer],
    ['balancing-with-masses', 'q12', (b) => clean(values(b).m2! / values(b).m1!)],
    ['moment-through-gears', 'q14', answer],
    ['moment-through-gears', 'q14', (b) => clean(values(b).n2! / values(b).n1!)],
    ['moment-through-gears', 'q14', (b) => values(b).n1],
    ['speed-through-gears', 'q16', answer],
    ['speed-through-gears', 'q16', (b) => values(b).f1],
  ]
  for (const [id, slot, key] of cases) {
    it(`${id} ${slot}: no value is more than 40% of the draws`, () => {
      expect(share(build(id, slot), key)).toBeLessThanOrEqual(0.4)
    })
  }

  it('never fails to draw, over 5000 seeds per slot', () => {
    for (const g of GENERATORS.filter((x) => x.topicId === 'moments-levers-and-gears')) {
      for (const id of g.replaces) {
        const slot = bank(g.topicId).find((q) => q.id === id)!
        expect(() => {
          for (let i = 0; i < 5000; i++) generate(g, slot, `throw-${i}`)
        }, `${g.id} ${id}`).not.toThrow()
      }
    }
  })
})
