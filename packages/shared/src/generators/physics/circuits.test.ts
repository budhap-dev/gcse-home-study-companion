import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { dpTolerance } from './format.ts'

/**
 * Structural tests for the Physics circuit generators. The release check proves each answer
 * agrees with a second route; these read the prompt's own numbers and the working printed on
 * the way and check each step is the right one, because a right answer can be reached by a
 * wrong route. They also look across a run of builds for what no single build can show: a
 * context list that never rotates, or one answer carrying a slot.
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
const values = (b: Generated) => b.values as Record<string, number>
/** The end of a worked solution as closes() prints it, for answers under five digits. */
const ends = (expr: string, answer: number, unit: string) => `${expr} = ${show(answer)}$ ${unit}`
const decimals = (x: number) => (show(x).includes('.') ? show(x).split('.')[1]!.length : 0)
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context)).size
/** The same figure, or the same digits with the point moved, at any power of ten. */
const tenfold = (a: number, b: number) => {
  const l = Math.log10(Math.abs(a / b))
  return Math.abs(l - Math.round(l)) < 1e-9
}
/** Two figures to be multiplied whose sum is their product: 6 × 1.2 = 6 + 1.2. */
const sumIsProduct = (a: number, b: number) => clean(a * b) === clean(a + b)
/** Neither a given, nor one with the point moved, doubled or halved. */
const clearOf = (x: number, ...givens: number[]) => givens.every((g) => !tenfold(x, g) && clean(x) !== clean(2 * g) && clean(2 * x) !== clean(g))
/** No article before a figure: "a 8 kg" reads "an eight". */
const noArticle = (prompt: string) => expect(prompt).not.toMatch(/\b(a|A|an|An) \d/)
/** The two parts as the prompt names them. */
const parts = (b: Generated, R1: number, R2: number) => {
  const ctx = String(b.values.context)
  if (ctx.endsWith('two resistors')) return `resistors of ${R1} Ω and ${R2} Ω`
  const noun = ctx.endsWith('lamp') ? 'lamp' : 'heating element'
  return `a resistor of ${R1} Ω and a ${noun} of resistance ${R2} Ω`
}
/** "the 8 Ω resistor" where both are resistors, otherwise the part's noun. */
const named = (b: Generated, i: number, R: number) => {
  const ctx = String(b.values.context)
  if (ctx.endsWith('two resistors')) return `the ${R} Ω resistor`
  return i === 1 ? 'the resistor' : ctx.endsWith('lamp') ? 'the lamp' : 'the heating element'
}
const supplyOk = (b: Generated, V: number) => {
  const ctx = String(b.values.context)
  if (ctx.startsWith('battery')) {
    expect([3, 4.5, 6, 9, 12]).toContain(V)
    expect(b.question.prompt).toContain(`battery of ${show(V)} V`)
  } else {
    expect(Number.isInteger(V) && V >= 2 && V <= 12).toBe(true)
    expect(b.question.prompt).toContain(`power supply of ${show(V)} V`)
  }
}
/** Each part within the range a lab has for it. */
const rangesOk = (b: Generated, R1: number, R2: number) => {
  const ctx = String(b.values.context)
  expect(R1 >= 2 && R1 <= 100, b.seed).toBe(true)
  const [lo, hi] = ctx.endsWith('lamp') ? [4, 30] : ctx.endsWith('heating element') ? [2, 20] : [2, 100]
  expect(R2 >= lo && R2 <= hi, b.seed).toBe(true)
}

describe('series and parallel circuits', () => {
  it('adds two different resistances in series', () => {
    for (const [id, slotId] of [['series-resistance-rules', 'q2'], ['series-resistance', 'q1']] as const) {
      const built = build(id, slotId)
      for (const b of built) {
        const { R1, R2 } = values(b)
        noArticle(b.question.prompt)
        expect(b.question.prompt.toLowerCase(), b.seed).toContain(parts(b, R1!, R2!).toLowerCase())
        expect(b.question.prompt).toContain('series')
        rangesOk(b, R1!, R2!)
        expect(R1).not.toBe(R2)
        expect(answer(b)).toBe(R1! + R2!)
        expect(clearOf(answer(b), R1!, R2!)).toBe(true)
        expect(b.question.solution).toBe(`In series the resistances add: $${R1} + ${R2} = ${answer(b)}$ Ω.`)
        expect(b.question.markScheme.map((l) => l.code)).toEqual(slotId === 'q2' ? ['B1'] : ['M1', 'A1'])
        if (slotId === 'q1') expect(b.question.markScheme[0]!.description).toBe(`adds the resistances: $${R1} + ${R2}$`)
        expect(last(b)).toBe(`${answer(b)} Ω`)
        expect(units(b)).toBe('Ω')
        expect(tolerance(b)).toBe(0)
      }
      expect(contexts(built)).toBe(3)
    }
  })

  it('finds the total resistance, then divides the supply pd by it', () => {
    for (const [id, slotId] of [['series-current-rules', 'q5'], ['series-current', 'q5']] as const) {
      const built = build(id, slotId)
      for (const b of built) {
        const { V, R1, R2 } = values(b)
        noArticle(b.question.prompt)
        supplyOk(b, V!)
        rangesOk(b, R1!, R2!)
        expect(b.question.prompt.toLowerCase(), b.seed).toContain(parts(b, R1!, R2!).toLowerCase())
        const Rt = R1! + R2!
        const I = clean(V! / Rt)
        expect(answer(b)).toBe(I)
        expect(decimals(I)).toBeLessThanOrEqual(2)
        expect(I >= 0.05 && I <= 3).toBe(true)
        // Never the supply pd with the point moved (a total of 10 Ω or 100 Ω), never 1 A.
        expect(tenfold(I, V!)).toBe(false)
        expect(clearOf(I, V!, R1!, R2!, Rt)).toBe(true)
        expect(b.question.solution).toContain(`Total resistance $= ${R1} + ${R2} = ${Rt}$ Ω, so $${ends(`I = V \\div R = ${show(V!)} \\div ${Rt}`, I, 'A')}`)
        expect(b.question.markScheme[0]!.description).toBe(`total resistance $= ${R1} + ${R2} = ${Rt}$ Ω`)
        expect(b.question.markScheme.length).toBe(slotId === 'q5' && id === 'series-current-rules' ? 3 : 2)
        if (id === 'series-current-rules') expect(b.question.markScheme[1]!.description).toBe(`$I = V \\div R_{\\text{total}} = ${show(V!)} \\div ${Rt}$`)
        expect(units(b)).toBe('A')
        expect(tolerance(b)).toBe(dpTolerance(I))
      }
      expect(contexts(built)).toBe(6)
    }
  })

  it('multiplies the current by the one part asked about, and the two pds add to the supply', () => {
    for (const [id, slotId, given] of [['series-pd-with-current-given', 'q6', true], ['series-pd', 'q6', false]] as const) {
      const built = build(id, slotId)
      for (const b of built) {
        const { V, R1, R2, I, asked } = values(b)
        noArticle(b.question.prompt)
        supplyOk(b, V!)
        const Rt = R1! + R2!
        expect(I).toBe(clean(V! / Rt))
        const Rx = asked === 1 ? R1! : R2!
        const Vx = clean(I! * Rx)
        const Vo = clean(V! - Vx)
        expect(answer(b), b.seed).toBe(Vx)
        expect(b.question.prompt).toContain(`across ${named(b, asked!, Rx)}, in volts`)
        expect(b.question.prompt.includes(`current is ${show(I!)} A`)).toBe(given)
        expect(clearOf(Vx, V!, R1!, R2!, Rt)).toBe(true)
        if (given) expect(clearOf(Vx, I!)).toBe(true)
        expect(sumIsProduct(I!, Rx), b.seed).toBe(false)
        expect(b.question.solution).toContain(ends(`V = I R = ${show(I!)} \\times ${Rx}`, Vx, 'V'))
        expect(b.question.solution).toContain(`takes $${show(Vo)}$ V`)
        expect(b.question.solution).toContain(`= ${show(V!)}$ V, the supply ✓`)
        if (!given) {
          expect(b.question.solution).toContain(`$I = V \\div R_{\\text{total}} = ${show(V!)} \\div (${R1} + ${R2}) = ${show(V!)} \\div ${Rt} = ${show(I!)}$ A`)
          expect(b.question.markScheme[0]!.description).toBe(`finds the current: $${show(V!)} \\div ${Rt} = ${show(I!)}$ A`)
        }
        expect(b.question.markScheme.at(-2)!.description).toContain(`$${show(I!)} \\times ${Rx}$`)
        expect(units(b)).toBe('V')
        expect(tolerance(b)).toBe(dpTolerance(Vx))
      }
      expect(new Set(built.map((b) => b.values.asked))).toEqual(new Set([1, 2]))
      expect(contexts(built)).toBe(6)
    }
  })

  it('puts the full supply pd across each branch and adds the branch currents', () => {
    for (const [id, slotId] of [['parallel-total-current-rules', 'q7'], ['parallel-total-current', 'q10']] as const) {
      const built = build(id, slotId)
      for (const b of built) {
        const { V, R1, R2 } = values(b)
        noArticle(b.question.prompt)
        supplyOk(b, V!)
        rangesOk(b, R1!, R2!)
        expect(b.question.prompt).toContain('in parallel')
        expect(b.question.prompt).toContain('total current')
        const I1 = clean(V! / R1!)
        const I2 = clean(V! / R2!)
        for (const Ib of [I1, I2]) {
          expect(decimals(Ib), b.seed).toBeLessThanOrEqual(2)
          expect(Ib >= 0.05 && Ib <= 3).toBe(true)
          expect(tenfold(Ib, V!)).toBe(false)
        }
        expect(I1).not.toBe(I2)
        expect(answer(b)).toBe(clean(I1 + I2))
        expect(answer(b)).toBeLessThanOrEqual(5)
        expect(clearOf(answer(b), V!, R1!, R2!, I1, I2)).toBe(true)
        const branches = `$${show(V!)} \\div ${R1} = ${show(I1)}$ A and $${show(V!)} \\div ${R2} = ${show(I2)}$ A`
        expect(b.question.solution).toContain(`Each branch has the full ${show(V!)} V: ${branches}.`)
        expect(b.question.solution).toContain(ends(`${show(I1)} + ${show(I2)}`, answer(b), 'A'))
        expect(b.question.markScheme[0]!.description).toBe(`full ${show(V!)} V across each branch: ${branches}`)
        expect(b.question.markScheme[1]!.description).toBe(`adds the branch currents: $${show(I1)} + ${show(I2)}$`)
        expect(units(b)).toBe('A')
        expect(tolerance(b)).toBe(dpTolerance(answer(b)))
      }
      expect(contexts(built)).toBe(6)
    }
  })

  it('divides the full supply pd by the one branch asked about', () => {
    const built = build('parallel-branch-current', 'q7')
    for (const b of built) {
      const { V, R1, R2, asked } = values(b)
      noArticle(b.question.prompt)
      supplyOk(b, V!)
      const Rx = asked === 1 ? R1! : R2!
      const Ix = clean(V! / Rx)
      expect(answer(b), b.seed).toBe(Ix)
      expect(b.question.prompt).toContain(`current through ${named(b, asked!, Rx)}, in amperes`)
      expect(clearOf(Ix, V!, R1!, R2!)).toBe(true)
      expect(b.question.solution).toContain(`Each branch has the full ${show(V!)} V, so $${ends(`I = V \\div R = ${show(V!)} \\div ${Rx}`, Ix, 'A')}`)
      expect(b.question.markScheme[0]!.description).toBe(`uses the full ${show(V!)} V on the branch: $${show(V!)} \\div ${Rx}$`)
      expect(units(b)).toBe('A')
      expect(tolerance(b)).toBe(dpTolerance(Ix))
    }
    expect(new Set(built.map((b) => b.values.asked))).toEqual(new Set([1, 2]))
    expect(contexts(built)).toBe(6)
  })

  it('adds the replacement to the part kept, divides, and says which way the current moved', () => {
    const built = build('series-part-replaced', 'q13')
    for (const b of built) {
      const { V, R1, R2, R3, replaced } = values(b)
      noArticle(b.question.prompt)
      supplyOk(b, V!)
      const Rx = replaced === 1 ? R1! : R2!
      const kept = replaced === 1 ? R2! : R1!
      expect(b.question.prompt).toContain(`${named(b, replaced!, Rx).replace(/^the/, 'The')} is`)
      expect(b.question.prompt).toContain(`replaced by`)
      expect(b.question.prompt).toContain(`${R3} Ω`)
      expect(R3).not.toBe(Rx)
      const Rt = R1! + R2!
      const Rt2 = kept + R3!
      const I = clean(V! / Rt)
      const I2 = clean(V! / Rt2)
      expect(answer(b), b.seed).toBe(I2)
      expect(decimals(I2)).toBeLessThanOrEqual(2)
      expect(tenfold(I2, V!)).toBe(false)
      expect(clearOf(I2, V!, R1!, R2!, R3!, Rt, Rt2)).toBe(true)
      expect(b.question.solution).toContain(`New total resistance $= ${kept} + ${R3} = ${Rt2}$ Ω, so $${ends(`I = V \\div R = ${show(V!)} \\div ${Rt2}`, I2, 'A')}`)
      const moved = Rt2 > Rt ? `has fallen from ${show(I)} A to ${show(I2)} A, because the total resistance rose from ${Rt} Ω to ${Rt2} Ω` : `has risen from ${show(I)} A to ${show(I2)} A, because the total resistance fell from ${Rt} Ω to ${Rt2} Ω`
      expect(b.question.solution).toContain(moved)
      expect(b.question.markScheme[0]!.description).toBe(`new total resistance $= ${kept} + ${R3} = ${Rt2}$ Ω`)
      expect(units(b)).toBeUndefined()
      expect(last(b)).toBe(show(I2))
      expect(tolerance(b)).toBe(dpTolerance(I2))
    }
    expect(new Set(built.map((b) => b.values.replaced))).toEqual(new Set([1, 2]))
    expect(contexts(built)).toBe(6)
  })
})

describe('charge, V = IR and P = VI', () => {
  const amps = (I: number) => (I < 100 && Math.abs(I * 10 - Math.round(I * 10)) < 1e-6 ? I.toFixed(1) : show(I))

  it('multiplies the current by the time in seconds, converting minutes first in q7', () => {
    for (const slotId of ['q1', 'q7']) {
      const built = build('charge-from-current-and-time', slotId)
      for (const b of built) {
        const { I, t, m } = values(b)
        noArticle(b.question.prompt)
        expect(b.question.prompt, b.seed).toContain(`${amps(I!)} A`)
        expect(I).not.toBe(1)
        const Q = clean(I! * t!)
        expect(answer(b)).toBe(Q)
        expect(decimals(Q)).toBeLessThanOrEqual(1)
        expect(clearOf(Q, I!, t!)).toBe(true)
        expect(tenfold(I!, t!)).toBe(false)
        expect(sumIsProduct(I!, t!)).toBe(false)
        const product = `Q = I t = ${amps(I!)} \\times ${show(t!)}`
        expect(b.question.solution).toContain(product)
        if (slotId === 'q7') {
          expect(t).toBe(m! * 60)
          expect(b.question.prompt).toContain(`for ${m} minutes`)
          expect(b.question.solution).toContain(`${m} minutes is ${show(t!)} s, so`)
          expect(b.question.solution).toContain('The time must be in seconds.')
          expect(b.question.markScheme[0]!.description).toBe(`converts to ${show(t!)} s`)
          expect(b.values.context).not.toBe('car starter motor')
        } else {
          expect(b.question.prompt).toContain(`for ${show(t!)} s`)
          expect(b.question.markScheme[0]!.description).toBe(`$Q = I t = ${amps(I!)} \\times ${show(t!)}$`)
        }
        if (b.values.context === 'car starter motor') expect(t).toBeLessThanOrEqual(4)
        if (b.values.context === 'kettle') expect(I! >= 8.5 && I! <= 13).toBe(true)
        expect(units(b)).toBe('C')
        expect(tolerance(b)).toBe(dpTolerance(Q))
      }
      expect(contexts(built)).toBe(slotId === 'q1' ? 6 : 5)
    }
  })

  /** "a resistor of 15 Ω", "a filament lamp of resistance 15 Ω" */
  const thing = (b: Generated, R: number) => (b.values.context === 'resistor' ? `resistor of ${show(R)} Ω` : `${b.values.context} of resistance ${show(R)} Ω`)

  it('divides the pd by the resistance for a current', () => {
    for (const [id, slotId] of [['current-from-pd-and-resistance', 'q5'], ['ohms-law-current', 'q2']] as const) {
      const built = build(id, slotId)
      for (const b of built) {
        const { V, R } = values(b)
        noArticle(b.question.prompt)
        expect(b.question.prompt, b.seed).toContain(`${show(V!)} V`)
        expect(b.question.prompt).toContain(thing(b, R!))
        const I = clean(V! / R!)
        expect(answer(b)).toBe(I)
        expect(decimals(I)).toBeLessThanOrEqual(2)
        expect(clearOf(I, V!, R!)).toBe(true)
        expect(tenfold(V!, R!)).toBe(false)
        if (b.values.context === 'car headlamp bulb') {
          expect(V! >= 12 && V! <= 14).toBe(true)
          expect(V! * I >= 20 && V! * I <= 60).toBe(true)
        }
        expect(b.question.solution).toBe(`$${ends(`I = V \\div R = ${show(V!)} \\div ${show(R!)}`, I, 'A')}.`)
        expect(b.question.markScheme[0]!.description).toContain(`$I = ${id === 'ohms-law-current' ? 'V \\div R = ' : ''}${show(V!)} \\div ${show(R!)}$`)
        if (id !== 'ohms-law-current') expect(b.question.markScheme[0]!.description).toContain('rearranges $V = IR$')
        expect(units(b)).toBe('A')
        expect(tolerance(b)).toBe(dpTolerance(I))
      }
      expect(contexts(built)).toBe(5)
    }
  })

  it('divides the pd by the current for a resistance', () => {
    for (const [id, slotId] of [['resistance-from-pd-and-current', 'q6'], ['ohms-law-resistance', 'q5']] as const) {
      const built = build(id, slotId)
      for (const b of built) {
        const { V, I } = values(b)
        noArticle(b.question.prompt)
        expect(b.question.prompt, b.seed).toContain(`${show(V!)} V`)
        expect(b.question.prompt).toContain(`${show(I!)} A`)
        const R = clean(V! / I!)
        expect(answer(b)).toBe(R)
        expect(clearOf(R, V!, I!)).toBe(true)
        expect(tenfold(V!, I!)).toBe(false)
        expect(b.question.solution).toContain(ends(`R = V \\div I = ${show(V!)} \\div ${show(I!)}`, R, 'Ω'))
        if (id === 'ohms-law-resistance') expect(b.question.solution).toContain(`Check: $${show(I!)} \\times ${show(R)} = ${show(V!)}$ ✓`)
        expect(units(b)).toBe('Ω')
        expect(tolerance(b)).toBe(dpTolerance(R))
      }
      expect(contexts(built)).toBe(5)
    }
  })

  it('multiplies the current by the resistance for a pd, from contexts whose pd can vary', () => {
    const built = build('pd-from-current-and-resistance', 'q4')
    for (const b of built) {
      const { I, R } = values(b)
      noArticle(b.question.prompt)
      expect(b.question.prompt, b.seed).toContain(thing(b, R!))
      expect(b.question.prompt).toContain(`${show(I!)} A`)
      const V = clean(I! * R!)
      expect(answer(b)).toBe(V)
      expect(clearOf(V, I!, R!)).toBe(true)
      expect(sumIsProduct(I!, R!), b.seed).toBe(false)
      expect(b.question.solution).toBe(`$${ends(`V = I R = ${show(I!)} \\times ${show(R!)}`, V, 'V')}.`)
      expect(units(b)).toBe('V')
      expect(tolerance(b)).toBe(dpTolerance(V))
    }
    expect(new Set(built.map((b) => b.values.context))).toEqual(new Set(['resistor', 'filament lamp', 'heating element']))
  })

  it('multiplies the pd by the current, and checks with I²R', () => {
    const built = build('power-from-pd-and-current', 'q9')
    for (const b of built) {
      const { V, I } = values(b)
      noArticle(b.question.prompt)
      expect(b.question.prompt, b.seed).toContain(`${show(V!)} V`)
      expect(b.question.prompt).toContain(`${show(I!)} A`)
      const P = clean(V! * I!)
      const R = clean(V! / I!)
      expect(answer(b)).toBe(P)
      expect(decimals(P)).toBeLessThanOrEqual(2)
      expect(decimals(R)).toBeLessThanOrEqual(2)
      expect(clearOf(P, V!, I!)).toBe(true)
      expect(sumIsProduct(V!, I!), b.seed).toBe(false)
      expect(b.question.solution).toContain(ends(`P = V I = ${show(V!)} \\times ${show(I!)}`, P, 'W'))
      expect(b.question.solution).toContain(`the resistance is $${show(V!)} \\div ${show(I!)} = ${show(R)}$ Ω, and $P = I^2 R = ${show(I!)}^2 \\times ${show(R)} = ${show(P)}$ W ✓`)
      expect(b.question.markScheme[0]!.description).toBe(`$P = V I = ${show(V!)} \\times ${show(I!)}$`)
      expect(units(b)).toBe('W')
      expect(tolerance(b)).toBe(dpTolerance(P))
    }
    expect(contexts(built)).toBe(5)
  })

  it('divides the pd by the changed resistance and names what the change does to the current', () => {
    const words: Record<number, [string, string]> = { 2: ['doubl', 'halves'], 3: ['tripl', 'falls to a third'], 4: ['quadrupl', 'falls to a quarter'], 0.5: ['halv', 'doubles'] }
    const built = build('current-after-resistance-change', 'q14')
    for (const b of built) {
      const { V, R1, R2, change } = values(b)
      noArticle(b.question.prompt)
      expect(R2).toBe(clean(R1! * change!))
      expect(b.question.prompt, b.seed).toContain(`supply of ${show(V!)} V`)
      expect(b.question.prompt).toContain(`from ${show(R1!)} Ω to ${show(R2!)} Ω`)
      const [stem, effect] = words[change!]!
      expect(b.question.prompt).toMatch(new RegExp(`resistance (is )?${stem}`))
      if (b.values.context === 'thermistor') expect(b.question.prompt.includes('cools')).toBe(change! > 1)
      if (b.values.context === 'light-dependent resistor') expect(b.question.prompt.includes('dims')).toBe(change! > 1)
      const I1 = clean(V! / R1!)
      const I2 = clean(V! / R2!)
      expect(answer(b)).toBe(I2)
      expect(clearOf(I2, V!, R1!, R2!)).toBe(true)
      expect(b.question.solution).toContain(`Originally $I = V \\div R = ${show(V!)} \\div ${show(R1!)} = ${show(I1)}$ A.`)
      expect(b.question.solution).toContain(ends(`I = ${show(V!)} \\div ${show(R2!)}`, I2, 'A'))
      expect(b.question.markScheme[0]!.description).toBe(`uses $I = V \\div R$ with the new resistance: $${show(V!)} \\div ${show(R2!)}$`)
      expect(b.question.markScheme[1]!.description).toBe(`recognises the current ${effect}, from ${show(I1)} A`)
      expect(units(b)).toBeUndefined()
      expect(last(b)).toBe(show(I2))
      expect(tolerance(b)).toBe(dpTolerance(I2))
    }
    expect(new Set(built.map((b) => b.values.change))).toEqual(new Set([2, 3, 4, 0.5]))
    expect(contexts(built)).toBe(4)
  })
})

describe('spread across builds', () => {
  /** The share of the draws the k commonest values take together. */
  const top = (built: Generated[], key: (b: Generated) => unknown, k = 1) => {
    const counts = new Map<unknown, number>()
    for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
    return [...counts.values()].sort((a, b) => b - a).slice(0, k).reduce((a, b) => a + b, 0) / built.length
  }
  // The answer is drawn evenly, so no value that divides often (25 Ω, 0.5 A, 0.25 A) carries a
  // context: the reviewer found three resistances at 43% of the lamp builds and 0.25 A and
  // 0.5 A at 37% of the current slots before this was so.
  const cases: string[][] = [
    ['series-resistance-rules', 'q2'],
    ['series-current-rules', 'q5'],
    ['series-pd-with-current-given', 'q6'],
    ['parallel-total-current-rules', 'q7'],
    ['series-part-replaced', 'q13'],
    ['charge-from-current-and-time', 'q1'],
    ['charge-from-current-and-time', 'q7'],
    ['current-from-pd-and-resistance', 'q5'],
    ['resistance-from-pd-and-current', 'q6'],
    ['ohms-law-current', 'q2'],
    ['pd-from-current-and-resistance', 'q4'],
    ['ohms-law-resistance', 'q5'],
    ['power-from-pd-and-current', 'q9'],
    ['current-after-resistance-change', 'q14'],
    ['series-resistance', 'q1'],
    ['series-current', 'q5'],
    ['series-pd', 'q6'],
    ['parallel-branch-current', 'q7'],
    ['parallel-total-current', 'q10'],
  ]
  for (const [id, slot] of cases) {
    it(`${id} ${slot}: every context gives ten or more answers, none carrying it`, () => {
      const built = build(id!, slot!, 1800)
      expect(top(built, answer)).toBeLessThanOrEqual(0.4)
      for (const name of new Set(built.map((b) => b.values.context))) {
        const mine = built.filter((b) => b.values.context === name)
        expect(new Set(mine.map(answer)).size, String(name)).toBeGreaterThanOrEqual(10)
        expect(top(mine, answer), String(name)).toBeLessThanOrEqual(0.2)
        expect(top(mine, answer, 2), String(name)).toBeLessThanOrEqual(0.3)
        expect(top(mine, answer, 3), String(name)).toBeLessThanOrEqual(0.4)
      }
    })
  }

  it("a thermistor's or LDR's smallest current is no likelier than any other", () => {
    const built = build('current-after-resistance-change', 'q14', 1800)
    for (const name of ['thermistor', 'light-dependent resistor']) {
      const mine = built.filter((b) => b.values.context === name)
      const least = Math.min(...mine.map(answer))
      expect(mine.filter((b) => answer(b) === least).length / mine.length, name).toBeLessThanOrEqual(0.1)
    }
  })

  it('the coincidence checks see a power of ten past 10⁴: 500 Ω and 0.005 A are the same digits', () => {
    expect(tenfold(500, 0.005)).toBe(true)
    expect(tenfold(3, 3e-7)).toBe(true)
    expect(tenfold(500, 0.006)).toBe(false)
    for (const [id, slot] of [['current-after-resistance-change', 'q14'], ['ohms-law-current', 'q2'], ['series-part-replaced', 'q13']]) {
      for (const b of build(id!, slot!, 600)) {
        const givens = Object.entries(values(b))
          .filter(([k, v]) => typeof v === 'number' && !['asked', 'replaced', 'change'].includes(k))
          .map(([, v]) => v)
        for (const g of givens) expect(tenfold(answer(b), g), `${b.seed} ${answer(b)} ${g}`).toBe(false)
      }
    }
  })

  it('the drawing-heavy generators never throw, over 5000 seeds', () => {
    for (const [id, slotId] of [['series-part-replaced', 'q13'], ['parallel-total-current', 'q10'], ['parallel-branch-current', 'q7'], ['current-after-resistance-change', 'q14']]) {
      const g = GENERATORS.find((x) => x.id === id)!
      const slot = bank(g.topicId).find((q) => q.id === slotId)!
      expect(() => {
        for (let i = 0; i < 5000; i++) generate(g, slot, `throw-${i}`)
      }, id).not.toThrow()
    }
  })
})
