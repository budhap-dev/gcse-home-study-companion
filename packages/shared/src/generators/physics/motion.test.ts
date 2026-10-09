import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { sigText } from './format.ts'

/**
 * Structural tests for the Physics motion generators. The release check proves each answer
 * agrees with a second route; these read the prompt's own numbers and the working printed
 * on the way and check each step is the right one, because a right answer can be reached by
 * a wrong route (generator-helpers-need-structural-tests). They also look across a run of
 * builds for what no single build can show: a context list that never rotates, a variant
 * that never appears, a coincidence that teaches a false rule.
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
const method = (b: Generated, i: number) => b.question.markScheme[i]!.description
/** A whole number inside maths as the generators print it: 12\,000 from five digits. */
const tex = (x: number) => (Math.abs(x) >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : show(x))
/** A number in prose: 12 000 from five digits. */
const prose = (x: number) => (Math.abs(x) >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : show(x))
const values = (b: Generated) => b.values as Record<string, number>
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context)).size
/** The unrounded value a solution prints before rounding: x truncated to n figures with an ellipsis, or x itself when it is exact there. */
function unrounded(x: number, n: number): string {
  const k = Math.max(0, n - 1 - Math.floor(Math.log10(x)))
  const t = Math.floor(Number((x * 10 ** k).toPrecision(12))) / 10 ** k
  return Math.abs(t - x) < 1e-9 * x ? show(x) : `${t.toFixed(k)}\\ldots`
}

describe('describing motion', () => {
  it('multiplies a steady speed by the time, with neither given figure as the answer', () => {
    const built = build('distance-from-speed-and-time', 'q1')
    for (const b of built) {
      const { v, t } = values(b)
      expect([...numbers(b.question.prompt)].sort((a, c) => a - c), b.seed).toEqual([v, t].sort((a, c) => a - c))
      expect(answer(b)).toBe(clean(v! * t!))
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(answer(b)).not.toBe(v)
      expect(answer(b)).not.toBe(t)
      expect(v).not.toBe(t)
      expect(b.question.solution).toContain(`$s = v t = ${tex(v!)} \\times ${t} = ${show(answer(b))}$ m.`)
      expect(method(b, 0)).toBe(`$${tex(v!)} \\times ${t}$`)
      expect(units(b)).toBe('m')
      expect(last(b)).toBe(`${prose(answer(b))} m`)
    }
    expect(contexts(built)).toBeGreaterThanOrEqual(6)
  })

  it('divides the change in speed by the time, subtracting the start speed where there is one', () => {
    const built = build('acceleration-from-speed-change', 'q3')
    for (const b of built) {
      const { u, v, t } = values(b)
      const nums = numbers(b.question.prompt)
      expect(answer(b), b.seed).toBeCloseTo((v! - u!) / t!, 9)
      expect(answer(b)).not.toBe(t)
      expect(answer(b)).not.toBe(v)
      expect(v).not.toBe(t)
      if (b.values.start === 'moving') {
        expect(u).toBeGreaterThan(0)
        expect([...nums].sort((a, c) => a - c)).toEqual([u, v, t].sort((a, c) => a - c))
        expect(b.question.solution).toContain(`$\\Delta v = ${v} - ${u} = ${v! - u!}$ m/s. $a = \\Delta v \\div t = ${v! - u!} \\div ${t} = ${show(answer(b))}$ m/s².`)
        expect(method(b, 0)).toBe(`$(${v} - ${u}) \\div ${t}$`)
        // Δv is never the time (a = 1) or the start speed (v = 2u): either hides which figure the student used.
        expect(v! - u!).not.toBe(t)
        expect(v! - u!).not.toBe(u)
      } else {
        expect(u).toBe(0)
        expect(nums).toEqual([v, t])
        expect(b.question.solution).toContain(`$a = \\Delta v \\div t = ${v} \\div ${t} = ${show(answer(b))}$ m/s².`)
        expect(method(b, 0)).toBe(`$${v} \\div ${t}$`)
      }
      expect(tolerance(b)).toBe(Number.isInteger(answer(b)) ? 0 : tolerance(b))
      expect(tolerance(b)).toBeLessThanOrEqual(answer(b) * 0.02)
      expect(units(b)).toBe('m/s²')
    }
    expect(new Set(built.map((b) => b.values.start))).toEqual(new Set(['rest', 'moving']))
    expect(contexts(built)).toBeGreaterThanOrEqual(6)
  })

  it('squares the final speed as 2as from rest, and the root is whole', () => {
    const built = build('final-velocity-from-rest', 'q7')
    for (const b of built) {
      const [a, s] = numbers(b.question.prompt)
      const v2 = clean(2 * a! * s!)
      expect(Number.isInteger(Math.sqrt(v2)), b.seed).toBe(true)
      expect(answer(b)).toBe(Math.sqrt(v2))
      expect(a).not.toBe(1)
      expect(s).not.toBe(answer(b))
      expect(b.question.solution).toContain(`$v^2 = 2 \\times ${tex(a!)} \\times ${tex(s!)} = ${tex(v2)}$. $v = \\sqrt{${tex(v2)}} = ${answer(b)}$ m/s.`)
      expect(method(b, 0)).toBe(`$v^2 = 2 \\times ${tex(a!)} \\times ${tex(s!)}$`)
      expect(method(b, 1)).toBe(`$v^2 = ${tex(v2)}$`)
      expect(units(b)).toBe('m/s')
    }
    expect(contexts(built)).toBeGreaterThanOrEqual(6)
  })

  it('carries the minus sign through the working and answers the size of the deceleration', () => {
    const built = build('deceleration-from-speed-change', 'q9')
    for (const b of built) {
      const { u, v, t } = values(b)
      const dv = u! - v!
      expect(answer(b), b.seed).toBeCloseTo(dv / t!, 9)
      expect(answer(b)).toBeGreaterThan(0)
      expect(numbers(b.question.prompt)).toEqual(b.values.end === 'stop' ? [u, t] : [u, v, t])
      expect(b.question.solution).toContain(`$\\Delta v = ${v} - ${u} = -${dv}$ m/s. $a = -${dv} \\div ${t} = -${show(answer(b))}$ m/s², a deceleration of **${show(answer(b))} m/s²**.`)
      expect(method(b, 0)).toBe(`$${dv} \\div ${t}$`)
      expect(answer(b)).not.toBe(t)
      expect(answer(b)).not.toBe(u)
      expect(dv).not.toBe(t)
      expect(u).not.toBe(t)
      if (v! > 0) expect(v).not.toBe(dv)
      expect(units(b)).toBe('m/s²')
      expect(last(b)).toBe(`${show(answer(b))} m/s²`)
    }
    expect(new Set(built.map((b) => b.values.end))).toEqual(new Set(['stop', 'slower']))
    expect(contexts(built)).toBeGreaterThanOrEqual(6)
  })

  it('finds the braking distance as u² over 2a, keeping both minus signs in the working', () => {
    const built = build('braking-distance-from-deceleration', 'q11')
    for (const b of built) {
      const [u, a] = numbers(b.question.prompt)
      const u2 = u! * u!
      const a2 = clean(2 * a!)
      expect(answer(b), b.seed).toBeCloseTo(u2 / a2, 9)
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(a).not.toBe(1)
      expect(answer(b)).not.toBe(u)
      expect(b.question.solution).toContain(`$0 - ${tex(u2)} = 2 \\times (-${show(a!)}) \\times s$, so $s = ${tex(u2)} \\div ${show(a2)} = ${answer(b)}$ m.`)
      expect(method(b, 0)).toBe(`$0 - ${u}^2 = 2 \\times (-${show(a!)}) \\times s$, or $${tex(u2)} = ${show(a2)} s$`)
      expect(method(b, 1)).toBe(`$s = ${tex(u2)} \\div ${show(a2)}$`)
      expect(units(b)).toBe('m')
    }
    expect(contexts(built)).toBeGreaterThanOrEqual(6)
  })

  it('times each stage, adds distances and times, and rounds a division that is never the mean of the speeds', () => {
    const built = build('average-speed-over-stages', 'q16')
    for (const b of built) {
      const [d1, v1, d2, v2] = numbers(b.question.prompt)
      expect(b.question.prompt, b.seed).toContain('3 significant figures')
      const t1 = clean(d1! / v1!)
      const t2 = clean(d2! / v2!)
      expect(Number.isInteger(t1)).toBe(true)
      expect(Number.isInteger(t2)).toBe(true)
      expect(t1).not.toBe(t2)
      expect(v1).not.toBe(1)
      expect(v2).not.toBe(1)
      const D = d1! + d2!
      const T = t1 + t2
      const rate = D / T
      expect(answer(b)).toBe(Number(rate.toPrecision(3)))
      expect(answer(b)).not.toBe(rate)
      expect(answer(b).toPrecision(3).endsWith('0')).toBe(false)
      // Equal stage times would make the average speed the mean of the two speeds, a false rule.
      expect(answer(b)).not.toBe(Number(((v1! + v2!) / 2).toPrecision(3)))
      expect(b.question.solution).toContain(`$= ${tex(d1!)} \\div ${show(v1!)} = ${t1}$ s.`)
      expect(b.question.solution).toContain(`$= ${tex(d2!)} \\div ${show(v2!)} = ${t2}$ s.`)
      // The unrounded division is printed before the rounding: 18.92 exactly, or 8.333… truncated.
      expect(b.question.solution).toContain(`Total distance ${prose(D)} m in ${T} s. Average speed $= ${tex(D)} \\div ${T} = ${unrounded(rate, 4)}$, so **${sigText(answer(b), 3)} m/s** to 3 significant figures. Not the average of ${show(v1!)} and ${show(v2!)}`)
      expect(method(b, 0)).toMatch(new RegExp(`^[A-Za-z-]+ time ${t1} s$`))
      expect(method(b, 1)).toMatch(new RegExp(`^[A-Za-z-]+ time ${t2} s$`))
      expect(method(b, 2)).toBe(`$${tex(D)} \\div ${T}$`)
      expect(last(b)).toBe(`${sigText(answer(b), 3)} m/s`)
      expect(tolerance(b)).toBeGreaterThan(0)
      expect(tolerance(b)).toBeLessThanOrEqual(0.05)
      expect(units(b)).toBe('m/s')
    }
    expect(contexts(built)).toBeGreaterThanOrEqual(6)
  })

  it('adds u² to 2as before the root, and rounds a root that is never whole to three figures', () => {
    const built = build('final-velocity-with-a-running-start', 'q18')
    for (const b of built) {
      const [u, a, s] = numbers(b.question.prompt)
      expect(b.question.prompt, b.seed).toContain('3 significant figures')
      const u2 = u! * u!
      const gain = clean(2 * a! * s!)
      const v2 = u2 + gain
      expect(b.values.v2).toBe(v2)
      expect(Number.isInteger(Math.sqrt(v2))).toBe(false)
      const v = Math.sqrt(v2)
      expect(answer(b)).toBe(Number(v.toPrecision(3)))
      expect(answer(b).toPrecision(3).endsWith('0')).toBe(false)
      expect(b.question.solution).toContain(`$v^2 = ${u}^2 + 2 \\times ${tex(a!)} \\times ${tex(s!)} = ${tex(u2)} + ${tex(gain)} = ${tex(v2)}$. $v = \\sqrt{${tex(v2)}} = ${unrounded(v, 4)}$, so **${sigText(answer(b), 3)} m/s** to 3 significant figures.`)
      expect(method(b, 0)).toBe(`$v^2 = ${u}^2 + 2 \\times ${tex(a!)} \\times ${tex(s!)}$`)
      expect(method(b, 1)).toBe(`$v^2 = ${tex(v2)}$`)
      expect(last(b)).toBe(`${sigText(answer(b), 3)} m/s`)
      expect(tolerance(b)).toBeGreaterThan(0)
      expect(tolerance(b)).toBeLessThanOrEqual(0.05)
      expect(units(b)).toBe('m/s')
    }
    expect(contexts(built)).toBeGreaterThanOrEqual(6)
  })
})

describe('stopping distances', () => {
  /** The Highway Code's typical figures: thinking distances a reaction of 0.2 s to 1 s gives, and the dry braking distance. */
  const HIGHWAY: Record<number, { thinking: [number, number]; braking: number }> = {
    20: { thinking: [3, 9], braking: 6 },
    30: { thinking: [4, 13], braking: 14 },
    40: { thinking: [5, 18], braking: 24 },
    50: { thinking: [7, 22], braking: 38 },
    60: { thinking: [8, 27], braking: 55 },
    70: { thinking: [9, 31], braking: 75 },
  }

  it('adds the thinking and braking distances, with figures the Highway Code gives for the speed and road', () => {
    const built = build('stopping-distance-from-parts', 'q1')
    for (const b of built) {
      const [mph, thinking, braking] = numbers(b.question.prompt)
      const h = HIGHWAY[mph!]!
      expect(h, b.seed).toBeDefined()
      expect(answer(b)).toBe(thinking! + braking!)
      expect(thinking).not.toBe(braking)
      expect(thinking).toBeGreaterThanOrEqual(h.thinking[0])
      expect(thinking).toBeLessThanOrEqual(h.thinking[1])
      const wet = b.question.prompt.includes('wet road')
      const icy = b.question.prompt.includes('icy road')
      expect(braking).toBeGreaterThanOrEqual(Math.ceil(h.braking * (icy ? 4 : wet ? 1.5 : 0.8)))
      expect(braking).toBeLessThanOrEqual(Math.floor(h.braking * (icy ? 10 : wet ? 2.5 : 1.2)))
      expect(b.question.solution).toContain(`$= ${thinking} + ${braking} = ${answer(b)}$ m.`)
      expect(b.question.solution.includes('lengthens the braking distance, not the thinking distance')).toBe(wet || icy)
      expect(method(b, 0)).toBe(`$${thinking} + ${braking}$`)
      expect(units(b)).toBe('m')
    }
    expect(contexts(built)).toBeGreaterThanOrEqual(12)
  })

  it('multiplies the speed by a reaction time in tenths of a second that is never 1.0', () => {
    const built = build('thinking-distance', 'q3')
    for (const b of built) {
      const { v, react } = values(b)
      const nums = numbers(b.question.prompt)
      expect(nums, b.seed).toContain(v)
      expect(nums).toContain(react)
      expect(react).toBeGreaterThanOrEqual(0.2)
      expect(react).toBeLessThanOrEqual(0.9)
      expect(Math.abs(react! * 10 - Math.round(react! * 10))).toBeLessThan(1e-9)
      expect(answer(b)).toBe(clean(v! * react!))
      expect(answer(b)).not.toBe(v)
      expect(b.question.solution).toContain(`Thinking distance $= ${v} \\times ${show(react!)} = ${show(answer(b))}$ m.`)
      expect(method(b, 0)).toBe(`$${v} \\times ${show(react!)}$`)
      expect(tolerance(b) === 0).toBe(Number.isInteger(answer(b)))
      expect(units(b)).toBe('m')
    }
    expect(built.some((b) => /tired|distracted/.test(String(b.values.context)))).toBe(true)
    expect(contexts(built)).toBeGreaterThanOrEqual(6)
  })

  it('divides a whole thinking distance by the speed for a reaction time under a second', () => {
    const built = build('reaction-time-from-thinking-distance', 'q5')
    for (const b of built) {
      const [v, d] = numbers(b.question.prompt)
      expect(Number.isInteger(d), b.seed).toBe(true)
      expect(d).not.toBe(v)
      expect(answer(b)).toBe(clean(d! / v!))
      expect(answer(b)).toBeGreaterThanOrEqual(0.2)
      expect(answer(b)).toBeLessThan(1)
      expect(b.question.solution).toContain(`reaction time $= ${d} \\div ${v} = ${show(answer(b))}$ s.`)
      expect(method(b, 0)).toBe(`$${d} \\div ${v}$`)
      expect(tolerance(b)).toBeGreaterThan(0)
      expect(tolerance(b)).toBeLessThanOrEqual(answer(b) * 0.02)
      expect(units(b)).toBe('s')
    }
    expect(contexts(built)).toBeGreaterThanOrEqual(6)
  })

  it('finds the kinetic energy, then divides it by the braking distance for a whole force', () => {
    const built = build('braking-force-from-kinetic-energy', 'q8')
    for (const b of built) {
      const [m, v, s] = numbers(b.question.prompt)
      const E = clean((m! * v! * v!) / 2)
      expect(Number.isInteger(E), b.seed).toBe(true)
      expect(answer(b)).toBe(clean(E / s!))
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(s).not.toBe(v)
      // The force over the mass is a deceleration the vehicle's brakes really give.
      expect(answer(b) / m!).toBeGreaterThanOrEqual(0.5)
      expect(answer(b) / m!).toBeLessThanOrEqual(10)
      expect(b.question.solution).toContain(`$E_k = \\tfrac{1}{2} \\times ${tex(m!)} \\times ${v}^2 = ${tex(E)}$ J.`)
      expect(b.question.solution).toContain(`$F = ${tex(E)} \\div ${tex(s!)}`)
      expect(method(b, 0)).toBe(`$E_k = \\tfrac{1}{2} \\times ${tex(m!)} \\times ${v}^2 = ${tex(E)}$ J`)
      expect(method(b, 1)).toBe(`$F = ${tex(E)} \\div ${tex(s!)}$`)
      expect(units(b)).toBe('N')
      expect(last(b)).toBe(`${prose(answer(b))} N`)
    }
    expect(contexts(built)).toBeGreaterThanOrEqual(6)
  })

  it('scales a braking distance by the square of a clean speed ratio, up or down', () => {
    const built = build('braking-distance-at-another-speed', 'q9')
    for (const b of built) {
      const [v1, d1, v2] = numbers(b.question.prompt)
      const faster = b.values.direction === 'faster'
      const k = clean(faster ? v2! / v1! : v1! / v2!)
      expect([1.5, 2, 3, 4], b.seed).toContain(k)
      const k2 = clean(k * k)
      expect(answer(b)).toBe(clean(d1! * (v2! / v1!) ** 2))
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(d1).not.toBe(v1)
      expect(answer(b)).not.toBe(v2)
      if (faster) {
        expect(b.question.solution).toContain(`$${show(k)}^2 = ${show(k2)}$ times the distance: $${tex(d1!)} \\times ${show(k2)} = ${answer(b)}$ m.`)
        expect(method(b, 0)).toBe(`$\\times ${show(k2)}$, from $${show(k)}^2$`)
      } else {
        expect(b.question.solution).toContain(`divided by $${show(k)}^2 = ${show(k2)}$: $${tex(d1!)} \\div ${show(k2)} = ${answer(b)}$ m.`)
        expect(method(b, 0)).toBe(`$\\div ${show(k2)}$, from $${show(k)}^2$`)
      }
      expect(units(b)).toBe('m')
    }
    expect(new Set(built.map((b) => b.values.direction))).toEqual(new Set(['faster', 'slower']))
    expect(new Set(built.map((b) => b.values.k))).toEqual(new Set([1.5, 2, 3, 4]))
    expect(contexts(built)).toBeGreaterThanOrEqual(6)
  })

  it('finds the deceleration from the stopping time, then multiplies by the mass', () => {
    const built = build('braking-force-from-stopping-time', 'q11')
    for (const b of built) {
      const [m, u, t] = numbers(b.question.prompt)
      const a = clean(u! / t!)
      expect(a, b.seed).toBeGreaterThanOrEqual(0.5)
      expect(a).toBeLessThanOrEqual(10)
      expect(a).not.toBe(t)
      expect(answer(b)).toBe(clean(m! * a))
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(b.question.solution).toContain(`$a = ${u} \\div ${t} = ${show(a)}$ m/s². $F = m a = ${tex(m!)} \\times ${show(a)}`)
      expect(method(b, 0)).toBe(`$a = ${u} \\div ${t} = ${show(a)}$ m/s²`)
      expect(method(b, 1)).toBe(`$${tex(m!)} \\times ${show(a)}$`)
      expect(units(b)).toBe('N')
      expect(last(b)).toBe(`${prose(answer(b))} N`)
    }
    expect(contexts(built)).toBeGreaterThanOrEqual(6)
  })

  it('adds a whole thinking distance to a whole braking distance, each by its own equation', () => {
    const built = build('stopping-distance-from-reaction-and-deceleration', 'q14')
    for (const b of built) {
      const [u, react, a] = numbers(b.question.prompt)
      const thinking = clean(u! * react!)
      const braking = clean((u! * u!) / (2 * a!))
      expect(Number.isInteger(thinking), b.seed).toBe(true)
      expect(Number.isInteger(braking)).toBe(true)
      expect(thinking).not.toBe(braking)
      expect(react).toBeLessThan(1)
      expect(answer(b)).toBe(thinking + braking)
      const u2 = u! * u!
      const a2 = clean(2 * a!)
      expect(b.question.solution).toContain(`Thinking distance $= ${u} \\times ${show(react!)} = ${thinking}$ m.`)
      expect(b.question.solution).toContain(`$0 - ${tex(u2)} = 2 \\times (-${show(a!)}) \\times s$, so $s = ${tex(u2)} \\div ${show(a2)} = ${braking}$ m.`)
      expect(b.question.solution).toContain(`Stopping distance $= ${thinking} + ${braking} = ${answer(b)}$ m.`)
      expect(b.question.markScheme.map((l) => l.description)).toEqual([
        `thinking distance $${u} \\times ${show(react!)} = ${thinking}$ m`,
        `$${tex(u2)} = ${show(a2)} s$ or equivalent`,
        `braking distance ${braking} m`,
        `${answer(b)} m`,
      ])
      expect(units(b)).toBe('m')
    }
    expect(contexts(built)).toBeGreaterThanOrEqual(5)
  })

  it('converts centimetres to metres, roots 2s over g and rounds to two figures', () => {
    const built = build('reaction-time-from-a-ruler-drop', 'q15')
    for (const b of built) {
      const d = values(b).d!
      expect(b.question.prompt, b.seed).toContain(`${d} cm`)
      expect(b.question.prompt).toContain('2 significant figures')
      expect(d).toBeGreaterThanOrEqual(8)
      expect(d).toBeLessThanOrEqual(45)
      const sText = (d / 100).toFixed(2)
      const t2 = (2 * d) / 100 / 9.8
      const t = Math.sqrt(t2)
      expect(answer(b)).toBe(Number(t.toPrecision(2)))
      expect(answer(b).toPrecision(2).endsWith('0')).toBe(false)
      expect(b.question.solution).toContain(`$t = \\sqrt{2 s \\div g} = \\sqrt{2 \\times ${sText} \\div 9.8} = \\sqrt{${sigText(t2, 3)}} = ${unrounded(t, 4)}$ s, so **${sigText(answer(b), 2)} s** to 2 significant figures. Note the conversion of ${d} cm to ${sText} m.`)
      // The root of the three-figure t² printed agrees with the exact root to the figures shown.
      expect(Number(Math.sqrt(Number(sigText(t2, 3))).toPrecision(3))).toBe(Number(t.toPrecision(3)))
      expect(method(b, 0)).toBe(`$t^2 = 2 \\times ${sText} \\div 9.8$`)
      expect(method(b, 1)).toBe('square root taken')
      expect(last(b)).toBe(`${sigText(answer(b), 2)} s`)
      expect(tolerance(b)).toBeGreaterThan(0)
      expect(tolerance(b)).toBeLessThanOrEqual(0.005)
      expect(units(b)).toBe('s')
    }
    expect(contexts(built)).toBeGreaterThanOrEqual(4)
  })

  it('divides the speed by a time under a second, multiplies by the mass, and says why a longer time helps', () => {
    const built = build('crash-force', 'q17')
    for (const b of built) {
      const { m, u, t, a } = values(b)
      expect(b.question.prompt, b.seed).toContain(prose(m!))
      expect(b.question.prompt).toContain(`${u} m/s`)
      expect(b.question.prompt).toContain(`${show(t!)} s.`)
      expect(t).not.toBe(1)
      expect(a).toBe(clean(u! / t!))
      expect(Number.isInteger(a)).toBe(true)
      expect(answer(b)).toBe(clean(m! * a!))
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(b.question.solution).toContain(`$a = ${u} \\div ${show(t!)} = ${a}$ m/s². $F = m a = ${tex(m!)} \\times ${a}`)
      expect(b.question.solution).toMatch(/time/)
      expect(method(b, 0)).toBe(`$a = ${u} \\div ${show(t!)} = ${a}$ m/s²`)
      expect(method(b, 1)).toBe(`$${tex(m!)} \\times ${a}$`)
      expect(units(b)).toBe('N')
      expect(last(b)).toBe(`${prose(answer(b))} N`)
    }
    expect(contexts(built)).toBeGreaterThanOrEqual(6)
  })

  it("finds the kinetic energy, divides by the brakes' mass times c, and rounds to three figures", () => {
    const built = build('brake-temperature-rise', 'q19')
    for (const b of built) {
      const [m, v, md, c] = numbers(b.question.prompt)
      expect(b.question.prompt, b.seed).toContain('3 significant figures')
      const E = clean((m! * v! * v!) / 2)
      expect(Number.isInteger(E)).toBe(true)
      const mc = clean(md! * c!)
      const rise = E / mc
      expect(rise).toBeGreaterThanOrEqual(5)
      expect(rise).toBeLessThanOrEqual(350)
      expect(answer(b)).toBe(Number(rise.toPrecision(3)))
      expect(answer(b)).not.toBe(rise)
      expect(answer(b).toPrecision(3).endsWith('0')).toBe(false)
      expect(b.question.solution).toContain(`$E_k = \\tfrac{1}{2} \\times ${tex(m!)} \\times ${v}^2 = ${tex(E)}$ J.`)
      expect(b.question.solution).toContain(`\\dfrac{${tex(E)}}{${tex(md!)} \\times ${c}} = \\dfrac{${tex(E)}}{${tex(mc)}} = ${unrounded(rise, 4)}$, so **${sigText(answer(b), 3)} °C** to 3 significant figures.`)
      expect(b.question.markScheme.map((l) => l.description)).toEqual([`$E_k = ${tex(E)}$ J`, '$\\Delta\\theta = \\Delta E \\div (m c)$', `$${tex(E)} \\div ${tex(mc)}$`, `${sigText(answer(b), 3)} °C`])
      // Half a unit in the third figure: 0.05 under 100 °C, 0.5 above, never more than 2%.
      expect(tolerance(b)).toBeGreaterThan(0)
      expect(tolerance(b)).toBeLessThanOrEqual(answer(b) >= 100 ? 0.5 : 0.05)
      expect(tolerance(b)).toBeLessThanOrEqual(answer(b) * 0.02)
      expect(units(b)).toBe('°C')
    }
    expect(contexts(built)).toBeGreaterThanOrEqual(6)
  })
})

/**
 * No single value carries the slot. Drawing two figures at random and keeping the pairs that
 * divide cleanly made a = 2 the acceleration in 38% of one slot, a 0.5 s reaction time a
 * quarter of another, and a braking distance of exactly twice the speed a quarter of a third:
 * patterns a student would learn as rules (aggregate-only-defects).
 */
describe('spread across builds', () => {
  const share = (built: Generated[], key: (b: Generated) => unknown) => {
    const counts = new Map<unknown, number>()
    for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
    return Math.max(...counts.values()) / built.length
  }
  const cases: [string, string, string, (b: Generated) => unknown][] = [
    ['final-velocity-from-rest', 'describing-motion', 'q7', (b) => values(b).a],
    ['braking-distance-from-deceleration', 'describing-motion', 'q11', (b) => values(b).a],
    ['braking-distance-from-deceleration', 'describing-motion', 'q11', (b) => values(b).s / values(b).u],
    ['reaction-time-from-thinking-distance', 'stopping-distances', 'q5', (b) => answer(b)],
    ['stopping-distance-from-reaction-and-deceleration', 'stopping-distances', 'q14', (b) => values(b).a],
    ['stopping-distance-from-reaction-and-deceleration', 'stopping-distances', 'q14', (b) => values(b).react],
    ['stopping-distance-from-reaction-and-deceleration', 'stopping-distances', 'q14', (b) => values(b).braking / values(b).u],
  ]
  for (const [id, topic, slot, key] of cases) {
    it(`${id} ${slot}: no value is more than 40% of the draws`, () => {
      const g = GENERATORS.find((x) => x.id === id)!
      expect(g.topicId).toBe(topic)
      expect(share(build(id, slot), key)).toBeLessThanOrEqual(0.4)
    })
  }

  it('braking distance at another speed never throws, over 20 000 seeds', () => {
    const g = GENERATORS.find((x) => x.id === 'braking-distance-at-another-speed')!
    const slot = bank(g.topicId).find((q) => g.replaces.includes(q.id))!
    expect(() => {
      for (let i = 0; i < 20000; i++) generate(g, slot, `throw-${i}`)
    }).not.toThrow()
  })
})
