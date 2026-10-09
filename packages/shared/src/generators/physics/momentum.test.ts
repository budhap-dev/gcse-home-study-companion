import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { dpTolerance } from './format.ts'

/**
 * Structural tests for the momentum generators. The release check proves each answer agrees
 * with a second route; these read the prompt's own numbers and the working printed on the way
 * and check each step is the right one, because a right answer can be reached by a wrong
 * route. Collisions are also checked for being ones that can happen, and the runs of builds
 * for contexts that rotate and values that do not crowd onto one.
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
const tex = (x: number) => `${x < 0 ? '-' : ''}${Math.abs(x) >= 10000 ? show(Math.abs(x)).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : show(Math.abs(x))}`
/** A number in prose: 12 000 from five digits. */
const prose = (x: number) => (Math.abs(x) >= 10000 ? show(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : show(x))
const values = (b: Generated) => b.values as Record<string, number>
/** The end of a worked solution as closes() prints it. */
const ends = (expr: string, answer: number, unit: string) => (answer < 10000 ? `${expr} = ${show(answer)}$ ${unit}` : `${expr}$, which is **${answer} ${unit}**`)
const decimals = (x: number) => (show(x).includes('.') ? show(x).split('.')[1]!.length : 0)
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context)).size
const SHIFTS = [0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000, 100000]
/** The q12 contexts that are vehicle crashes, which lose much of their kinetic energy. */
const VEHICLES = ['car and van', 'van and car']
/** Whether x is a power of ten: a ratio of figures that is one makes the answer a figure with its point moved. */
const powerOfTen = (x: number) => x > 0 && Math.abs(Math.log10(x) - Math.round(Math.log10(x))) < 1e-9
/** The largest share of the builds that one value of `key` takes, within each context. */
function worstShareByContext(built: Generated[], key: (b: Generated) => unknown) {
  const by = new Map<unknown, Generated[]>()
  for (const b of built) by.set(b.values.context, [...(by.get(b.values.context) ?? []), b])
  let worst = { context: '', share: 0 }
  for (const [context, group] of by) {
    const counts = new Map<unknown, number>()
    for (const b of group) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
    const share = Math.max(...counts.values()) / group.length
    if (share > worst.share) worst = { context: String(context), share }
  }
  return worst
}

/** Every build: no "a 8", the written slot's units, and the tolerance rounding allows. */
function common(b: Generated, unit: string) {
  expect(b.question.prompt, b.seed).not.toMatch(/\ba \d/)
  expect(units(b)).toBe(unit)
  expect(tolerance(b), b.seed).toBe(dpTolerance(answer(b)))
}

describe('p = m v', () => {
  it('multiplies the mass by the speed: vehicles in q1, balls and small things in q3', () => {
    for (const [slot, n] of [['q1', 8], ['q3', 8]] as const) {
      const built = build('momentum-from-mass-and-velocity', slot)
      for (const b of built) {
        const { m, v } = values(b)
        common(b, 'kg m/s')
        expect(b.question.prompt, b.seed).toContain(`${prose(m!)} kg`)
        expect(b.question.prompt).toContain(`${show(v!)} m/s`)
        expect(SHIFTS).not.toContain(m)
        expect(SHIFTS).not.toContain(v)
        expect(answer(b)).toBe(clean(m! * v!))
        expect(new Set([m, v, answer(b)]).size).toBe(3)
        expect(b.question.solution).toContain(ends(`p = m v = ${tex(m!)} \\times ${tex(v!)}`, answer(b), 'kg m/s'))
        expect(method(b, 0)).toBe(`$${tex(m!)} \\times ${tex(v!)}$`)
        expect(last(b)).toBe(`${prose(answer(b))} kg m/s`)
        if (slot === 'q1') expect(m).toBeGreaterThanOrEqual(70)
        else expect(m).toBeLessThanOrEqual(70)
      }
      expect(contexts(built)).toBe(n)
    }
  })

  it('divides the momentum by the mass for a velocity, and by the velocity for a mass', () => {
    for (const [id, slot] of [['velocity-from-momentum', 'q5'], ['mass-from-momentum', 'q6']] as const) {
      const built = build(id, slot)
      for (const b of built) {
        const { p } = values(b)
        const given = slot === 'q5' ? values(b).m! : values(b).v!
        common(b, slot === 'q5' ? 'm/s' : 'kg')
        expect(b.question.prompt, b.seed).toContain(`${prose(p!)} kg m/s`)
        expect(b.question.prompt).toContain(slot === 'q5' ? `${prose(given)} kg` : `${show(given)} m/s`)
        expect(answer(b) * given).toBeCloseTo(p!, 9)
        expect(new Set([p, given, answer(b)]).size).toBe(3)
        expect(SHIFTS).not.toContain(given)
        const [unknown, other, unit] = slot === 'q5' ? ['v', 'm', 'm/s'] : ['m', 'v', 'kg']
        expect(b.question.solution).toContain(ends(`${unknown} = \\dfrac{p}{${other}} = \\dfrac{${tex(p!)}}{${tex(given)}}`, answer(b), unit))
        expect(method(b, 0)).toBe(`$${unknown} = p \\div ${other}$`)
        expect(method(b, 1)).toBe(`$${tex(p!)} \\div ${tex(given)}$`)
      }
      expect(contexts(built)).toBe(7)
    }
  })
})

describe('collisions', () => {
  it('sticks to a still body: momentum before over the combined mass, never equal masses', () => {
    const built = build('sticking-to-a-still-body', 'q7')
    for (const b of built) {
      const { m1, m2, u } = values(b)
      common(b, 'm/s')
      expect(b.question.prompt, b.seed).toContain(`${prose(m1!)} kg`)
      expect(b.question.prompt).toContain(`${prose(m2!)} kg`)
      expect(b.question.prompt).toContain(`${show(u!)} m/s`)
      expect(b.question.prompt).toMatch(/stationary/)
      expect(m1).not.toBe(m2)
      const p = clean(m1! * u!)
      const M = clean(m1! + m2!)
      expect(answer(b)).toBe(clean(p / M))
      expect(answer(b)).not.toBe(u)
      expect(decimals(answer(b))).toBeLessThanOrEqual(2)
      expect(b.question.solution).toContain(`$= ${tex(m1!)} \\times ${show(u!)} + ${tex(m2!)} \\times 0 = ${tex(p)}$ kg m/s`)
      expect(b.question.solution).toContain(`combined mass is ${prose(M)} kg`)
      expect(b.question.solution).toContain(`v = ${tex(p)} \\div ${tex(M)} = ${show(answer(b))}$ m/s`)
      expect(method(b, 0)).toBe(`momentum before $= ${tex(m1!)} \\times ${show(u!)} = ${tex(p)}$ kg m/s`)
      expect(method(b, 1)).toBe(`$${tex(p)} = ${tex(M)} \\times v$`)
    }
    expect(contexts(built)).toBe(6)
  })

  it('meets head-on with right as positive: a negative velocity, the difference, to the right', () => {
    const built = build('head-on-sticking', 'q11')
    for (const b of built) {
      const { m1, u1, m2, u2 } = values(b)
      common(b, 'm/s')
      expect(b.question.prompt, b.seed).toContain(`${prose(m1!)} kg`)
      expect(b.question.prompt).toContain(`${prose(m2!)} kg`)
      expect(b.question.prompt).toContain(`${show(u1!)} m/s to the right`)
      expect(b.question.prompt).toContain(`${show(u2!)} m/s to the left`)
      expect(b.question.prompt).toMatch(/taking right as positive/i)
      const p1 = clean(m1! * u1!)
      const p2 = clean(m2! * u2!)
      const p = clean(p1 - p2)
      const M = clean(m1! + m2!)
      expect(p).toBeGreaterThan(0)
      expect(answer(b)).toBe(clean(p / M))
      expect(answer(b)).toBeGreaterThan(0)
      expect(new Set([m1, m2]).size).toBe(2)
      expect(new Set([u1, u2, answer(b)]).size).toBe(3)
      expect(b.question.solution).toContain(`velocity $-${show(u2!)}$ m/s`)
      expect(b.question.solution).toContain(`$= ${tex(m1!)} \\times ${show(u1!)} + ${tex(m2!)} \\times (-${show(u2!)}) = ${tex(p1)} - ${tex(p2)} = ${tex(p)}$ kg m/s`)
      expect(b.question.solution).toContain(`v = ${tex(p)} \\div ${tex(M)} = ${show(answer(b))}$ m/s, to the right.`)
      expect(method(b, 0)).toMatch(/^left-moving \w+ given a negative velocity$/)
      expect(method(b, 1)).toBe(`total before $= ${tex(p1)} - ${tex(p2)} = ${tex(p)}$ kg m/s`)
      expect(method(b, 2)).toBe(`$${tex(p)} = ${tex(M)} v$`)
      expect(last(b)).toBe(`${show(answer(b))} m/s to the right`)
    }
    expect(contexts(built)).toBe(5)
  })

  it('leaves both moving: only collisions that can happen, solved for the struck body', () => {
    const built = build('both-moving-after-a-collision', 'q12')
    for (const b of built) {
      const { m1, u1, m2, v1 } = values(b)
      common(b, 'm/s')
      expect(b.question.prompt, b.seed).toContain(`${prose(m1!)} kg`)
      expect(b.question.prompt).toContain(`${show(u1!)} m/s`)
      expect(b.question.prompt).toContain(`${prose(m2!)} kg`)
      expect(b.question.prompt).toContain(`same direction at ${show(v1!)} m/s`)
      const p = clean(m1! * u1!)
      const kept = clean(m1! * v1!)
      const rest = clean(p - kept)
      const v2 = answer(b)
      expect(v2).toBeCloseTo(rest / m2!, 9)
      // The struck body leaves ahead of the striker, and no kinetic energy appears from nowhere.
      expect(v2).toBeGreaterThan(v1!)
      expect(m1! * u1! ** 2).toBeGreaterThanOrEqual(m1! * v1! ** 2 + m2! * v2 ** 2)
      expect(v1).toBeLessThan(u1!)
      expect(new Set([u1, v1, v2]).size).toBe(3)
      // A vehicle crash loses much of its kinetic energy and never sends the struck vehicle off
      // faster than the striker arrived (the written one keeps 47%).
      if (VEHICLES.includes(String(b.values.context))) {
        expect(v2, b.seed).toBeLessThan(u1!)
        expect((m1! * v1! ** 2 + m2! * v2 ** 2) / (m1! * u1! ** 2), b.seed).toBeLessThanOrEqual(0.7 + 1e-9)
      }
      // The momentum lost is never the striker's mass with its point moved.
      expect(powerOfTen(clean(u1! - v1!)), b.seed).toBe(false)
      expect(b.question.solution).toContain(`$= ${tex(m1!)} \\times ${show(u1!)} = ${tex(p)}$ kg m/s`)
      expect(b.question.solution).toContain(`$${tex(m1!)} \\times ${show(v1!)} + ${tex(m2!)} v = ${tex(kept)} + ${tex(m2!)} v$`)
      expect(b.question.solution).toContain(`$${tex(m2!)} v = ${tex(rest)}$`)
      expect(b.question.solution).toContain(`v = ${tex(rest)} \\div ${tex(m2!)} = ${show(v2)}$ m/s`)
      expect(method(b, 2)).toBe(`$${tex(m2!)} v = ${tex(rest)}$`)
      expect(last(b)).toBe(`${show(v2)} m/s`)
    }
    expect(contexts(built)).toBe(5)
  })

  it('adds the speeds in and out for a rebound, with the rebound slower', () => {
    const built = build('change-in-momentum-on-rebound', 'q13')
    for (const b of built) {
      const { m, u, v } = values(b)
      common(b, 'kg m/s')
      expect(b.question.prompt, b.seed).toContain(`${prose(m!)} kg`)
      expect(b.question.prompt).toContain(`at ${show(u!)} m/s`)
      expect(b.question.prompt).toContain(`at ${show(v!)} m/s`)
      expect(b.question.prompt).toContain('magnitude of the change in momentum')
      expect(v).toBeLessThan(u!)
      expect(v).toBeGreaterThan(0)
      const before = clean(m! * u!)
      const after = clean(m! * v!)
      expect(answer(b)).toBe(clean(m! * (u! + v!)))
      expect(b.question.solution).toContain(`the change is not $${show(u!)} - ${show(v!)}$`)
      expect(b.question.solution).toContain(`before $= ${tex(m!)} \\times ${show(u!)} = ${tex(before)}$ kg m/s`)
      expect(b.question.solution).toContain(`after $= ${tex(m!)} \\times (-${show(v!)}) = ${tex(-after)}$ kg m/s`)
      expect(b.question.solution).toContain(`Change $= ${tex(-after)} - ${tex(before)} = ${tex(-answer(b))}$`)
      expect(method(b, 0)).toBe('rebound velocity given the opposite sign')
      expect(method(b, 1)).toBe(`$${tex(m!)} \\times (${show(u!)} + ${show(v!)})$ or $${tex(-after)} - ${tex(before)}$`)
    }
    expect(contexts(built)).toBe(5)
  })
})

describe('force from the change in momentum', () => {
  it('finds Δp, then divides by a contact time that is never a power of ten, to whole newtons', () => {
    for (const slot of ['q8', 'q14']) {
      const built = build('force-from-change-in-momentum', slot)
      for (const b of built) {
        const { m, dv, t } = values(b)
        common(b, 'N')
        expect(b.question.prompt, b.seed).toContain(`${show(m!)} kg`)
        expect(b.question.prompt).toContain(`${show(dv!)} m/s`)
        expect(b.question.prompt).toContain(`${show(t!)} s`)
        expect(b.question.prompt).toMatch(slot === 'q14' ? /from rest/ : /velocity changes by|changes its velocity by/)
        expect(SHIFTS).not.toContain(t)
        expect(powerOfTen(clean(m! / t!)), b.seed).toBe(false)
        expect(powerOfTen(clean(dv! / t!)), b.seed).toBe(false)
        const dp = clean(m! * dv!)
        expect(answer(b)).toBeCloseTo(dp / t!, 6)
        expect(Number.isInteger(answer(b))).toBe(true)
        expect(b.question.solution).toContain(`${tex(m!)} \\times ${show(dv!)} = ${tex(dp)}$ kg m/s`)
        expect(b.question.solution).toContain(ends(`F = \\dfrac{\\Delta p}{\\Delta t} = \\dfrac{${tex(dp)}}{${show(t!)}}`, answer(b), 'N'))
        expect(method(b, 0)).toBe(`$\\Delta p = ${tex(m!)} \\times ${show(dv!)} = ${tex(dp)}$ kg m/s`)
        expect(b.question.markScheme.at(-2)!.description).toBe(`$${tex(dp)} \\div ${show(t!)}$`)
        if (slot === 'q14') expect(method(b, 1)).toBe('$F = \\Delta p \\div \\Delta t$')
        // "That large" only where the force is.
        expect(b.question.solution.includes('A force that large')).toBe(slot === 'q14' && answer(b) >= 1000)
      }
      expect(contexts(built)).toBe(slot === 'q8' ? 6 : 5)
    }
  })
})

describe('recoil and explosions', () => {
  it('sets the two momenta equal and opposite, from zero before, in each slot’s own working', () => {
    for (const [slot, n] of [['q10', 5], ['q15', 5], ['q16', 4]] as const) {
      const built = build('recoil-speed', slot)
      for (const b of built) {
        const { M, m, v } = values(b)
        common(b, 'm/s')
        expect(b.question.prompt, b.seed).toContain(`${prose(M!)} kg`)
        expect(b.question.prompt).toContain(`${prose(m!)} kg`)
        expect(b.question.prompt).toContain(`${show(v!)} m/s`)
        expect(M).not.toBe(m)
        expect([2, 0.5]).not.toContain(clean(M! / m!))
        expect(powerOfTen(clean(m! / M!)), b.seed).toBe(false)
        const p = clean(m! * v!)
        expect(answer(b)).toBe(clean(p / M!))
        expect(new Set([M, m, v, p, answer(b)]).size).toBe(5)
        expect(decimals(answer(b))).toBeLessThanOrEqual(2)
        expect(b.question.solution).toContain(`$${tex(m!)} \\times ${show(v!)} = ${tex(p)}$ kg m/s`)
        expect(b.question.solution).toContain(`v = ${tex(p)} \\div ${tex(M!)} = ${show(answer(b))}$ m/s`)
        expect(b.question.solution).toMatch(/zero|is 0/)
        expect(last(b)).toBe(`${show(answer(b))} m/s`)
        if (slot === 'q10') {
          expect(b.question.prompt).toContain('recoil speed')
          expect(b.question.solution).toContain('backwards')
          expect(method(b, 1)).toContain(`equal and opposite: $${tex(M!)} v = ${tex(p)}$`)
        } else {
          expect(method(b, 0)).toBe('total momentum before is zero')
        }
        if (slot === 'q15') {
          expect(method(b, 1)).toBe(`$${tex(M!)} v = ${tex(m!)} \\times ${show(v!)}$`)
          // The other one moves at a speed in the same range as the first.
          expect(answer(b) / v!).toBeGreaterThan(0.1)
          expect(answer(b) / v!).toBeLessThan(10)
        }
        if (slot === 'q16') {
          expect(b.question.markScheme).toHaveLength(4)
          expect(method(b, 2)).toBe(`$${tex(M!)} v = ${tex(p)}$`)
        }
      }
      expect(contexts(built)).toBe(n)
    }
  })
})

describe('spread across builds', () => {
  const share = (built: Generated[], key: (b: Generated) => unknown) => {
    const counts = new Map<unknown, number>()
    for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
    return Math.max(...counts.values()) / built.length
  }
  const cases: [string, string, (b: Generated) => unknown][] = [
    ['momentum-from-mass-and-velocity', 'q1', answer],
    ['momentum-from-mass-and-velocity', 'q3', answer],
    ['velocity-from-momentum', 'q5', answer],
    ['mass-from-momentum', 'q6', answer],
    ['sticking-to-a-still-body', 'q7', answer],
    ['sticking-to-a-still-body', 'q7', (b) => values(b).u],
    ['head-on-sticking', 'q11', answer],
    ['head-on-sticking', 'q11', (b) => values(b).u1],
    ['head-on-sticking', 'q11', (b) => values(b).u2],
    ['both-moving-after-a-collision', 'q12', answer],
    ['both-moving-after-a-collision', 'q12', (b) => values(b).v1],
    ['change-in-momentum-on-rebound', 'q13', answer],
    ['force-from-change-in-momentum', 'q8', answer],
    ['force-from-change-in-momentum', 'q8', (b) => values(b).t],
    ['force-from-change-in-momentum', 'q14', answer],
    ['force-from-change-in-momentum', 'q14', (b) => values(b).t],
    ['recoil-speed', 'q10', answer],
    ['recoil-speed', 'q15', answer],
    ['recoil-speed', 'q16', answer],
  ]
  for (const [id, slot, key] of cases) {
    it(`${id} ${slot}: no value is more than 40% of the draws`, () => {
      expect(share(build(id, slot), key)).toBeLessThanOrEqual(0.4)
    })
  }

  it('both-moving-after-a-collision q12: a vehicle crash keeps at most 70% of the kinetic energy, across 1000 seeds', () => {
    const built = build('both-moving-after-a-collision', 'q12', 1000).filter((b) => VEHICLES.includes(String(b.values.context)))
    expect(built.length).toBeGreaterThan(300)
    for (const b of built) {
      const { m1, u1, m2, v1 } = values(b)
      const v2 = answer(b)
      expect(v2, b.seed).toBeLessThan(u1!)
      expect((m1! * v1! ** 2 + m2! * v2 ** 2) / (m1! * u1! ** 2), b.seed).toBeLessThanOrEqual(0.7 + 1e-9)
    }
  })

  it('both-moving-after-a-collision q12: within each context, no speed after nor loss of speed is more than 40%', () => {
    const built = build('both-moving-after-a-collision', 'q12', 1500)
    expect(worstShareByContext(built, (b) => values(b).v1).share).toBeLessThanOrEqual(0.4)
    expect(worstShareByContext(built, (b) => clean(values(b).u1! - values(b).v1!)).share).toBeLessThanOrEqual(0.4)
  })

  it('within each context, no contact time in q8 or q14 and no mass in q10, q15 or q16 is more than 40%', () => {
    for (const slot of ['q8', 'q14']) expect(worstShareByContext(build('force-from-change-in-momentum', slot, 1000), (b) => values(b).t).share, slot).toBeLessThanOrEqual(0.4)
    for (const slot of ['q10', 'q15', 'q16']) {
      const built = build('recoil-speed', slot, 1000)
      expect(worstShareByContext(built, (b) => values(b).m).share, slot).toBeLessThanOrEqual(0.4)
      expect(worstShareByContext(built, (b) => values(b).M).share, slot).toBeLessThanOrEqual(0.4)
    }
  })

  it('no ratio of figures is a power of ten across 1000 seeds: m ÷ t and Δv ÷ t, m ÷ M, the speed lost', () => {
    for (const slot of ['q8', 'q14']) {
      for (const b of build('force-from-change-in-momentum', slot, 1000)) {
        const { m, dv, t } = values(b)
        expect(powerOfTen(clean(m! / t!)) || powerOfTen(clean(dv! / t!)), `${slot} ${b.seed}`).toBe(false)
      }
    }
    for (const slot of ['q10', 'q15', 'q16']) {
      for (const b of build('recoil-speed', slot, 1000)) expect(powerOfTen(clean(values(b).m! / values(b).M!)), `${slot} ${b.seed}`).toBe(false)
    }
    for (const b of build('both-moving-after-a-collision', 'q12', 1000)) expect(powerOfTen(clean(values(b).u1! - values(b).v1!)), b.seed).toBe(false)
  })

  it('never fails to draw, over 5000 seeds per slot', () => {
    for (const g of GENERATORS.filter((x) => x.topicId === 'momentum')) {
      for (const id of g.replaces) {
        const slot = bank(g.topicId).find((q) => q.id === id)!
        expect(() => {
          for (let i = 0; i < 5000; i++) generate(g, slot, `throw-${i}`)
        }, `${g.id} ${id}`).not.toThrow()
      }
    }
  })
})
