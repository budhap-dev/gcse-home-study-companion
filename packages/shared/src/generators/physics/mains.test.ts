import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { dpTolerance } from './format.ts'

/**
 * Structural tests for the mains electricity and electromagnetic devices generators. The
 * release check proves each answer agrees with a second route; these read the prompt's own
 * numbers and the working printed on the way and check each step is the right one, and look
 * across a run of builds for a context list that never rotates or an answer that carries a slot.
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
/** A whole number inside maths as the generators print it: 12\,000 from five digits. */
const tex = (x: number) => (Math.abs(x) >= 10000 ? show(x).replace(/^(\d+)/, (w) => w.replace(/\B(?=(\d{3})+(?!\d))/g, '\\,')) : show(x))
/** A number in prose: 12 000 from five digits. */
const prose = (x: number) => (Math.abs(x) >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : show(x))
/** The end of a worked solution as closes() prints it: the maths runs to the answer under five digits and stops at the product from five. */
const ends = (expr: string, answer: number, unit: string) => (answer < 10000 ? `${expr} = ${show(answer)}$ ${unit}` : `${expr}$, which is **${answer} ${unit}**`)
const decimals = (x: number) => (show(x).includes('.') ? show(x).split('.')[1]!.length : 0)
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context)).size
/** A power of ten, at any size. */
const isTen = (x: number) => {
  const l = Math.log10(Math.abs(x))
  return Math.abs(l - Math.round(l)) < 1e-9
}
/** The same figure, or the same digits with the point moved. */
const tenfold = (a: number, b: number) => isTen(a / b)
/** Two figures to be multiplied whose sum is their product: 2 × 2 = 2 + 2. */
const sumIsProduct = (a: number, b: number) => clean(a * b) === clean(a + b)
/** Neither a given, nor one with the point moved, doubled or halved. */
const clearOf = (x: number, ...givens: number[]) => givens.every((g) => !tenfold(x, g) && clean(x) !== clean(2 * g) && clean(2 * x) !== clean(g))
/** No article before a figure: "a 8 kg" reads "an eight". */
const noArticle = (prompt: string) => expect(prompt).not.toMatch(/\b(a|A|an|An) \d/)

describe('mains electricity', () => {
  const WATTS: Record<string, [number, number]> = {
    kettle: [2000, 3000],
    toaster: [800, 1500],
    hairdryer: [1000, 2200],
    'microwave oven': [1000, 1500],
    'vacuum cleaner': [500, 1600],
    television: [50, 200],
    'fan heater': [1500, 3000],
    iron: [1200, 2800],
  }

  it('multiplies 230 V by a current to a tenth of an amp (a hundredth for a television), for a power the appliance really has', () => {
    const built = build('mains-power-from-current', 'q5')
    for (const b of built) {
      const { I } = values(b)
      const name = String(b.values.context)
      noArticle(b.question.prompt)
      expect(b.question.prompt, b.seed).toContain(`${show(I!)} A`)
      expect(b.question.prompt).toContain('230 V mains')
      expect(b.question.prompt.toLowerCase()).toContain(name)
      const tv = name === 'television'
      expect(decimals(I!)).toBeLessThanOrEqual(tv ? 2 : 1)
      expect(isTen(I!)).toBe(false)
      const P = clean(230 * I!)
      expect(answer(b)).toBe(P)
      expect(decimals(P)).toBeLessThanOrEqual(tv ? 1 : 0)
      expect(P >= WATTS[name]![0] && P <= WATTS[name]![1]).toBe(true)
      expect(clearOf(P, I!, 230)).toBe(true)
      expect(b.question.solution).toBe(`$${ends(`P = V I = 230 \\times ${show(I!)}`, P, 'W')}.`)
      expect(b.question.markScheme[0]!.description).toBe(`$P = V I = 230 \\times ${show(I!)}$`)
      expect(units(b)).toBe('W')
      expect(tolerance(b)).toBe(dpTolerance(P))
    }
    expect(contexts(built)).toBe(8)
  })

  it('divides a rated power by 230 V, the power never "a 920 W"', () => {
    const built = build('mains-current-from-power', 'q6')
    for (const b of built) {
      const { P } = values(b)
      const name = String(b.values.context)
      noArticle(b.question.prompt)
      expect(b.question.prompt, b.seed).toContain(`${prose(P!)} W`)
      expect(b.question.prompt).toContain('230 V mains')
      expect(P! >= WATTS[name]![0] && P! <= WATTS[name]![1]).toBe(true)
      const I = clean(P! / 230)
      expect(answer(b)).toBe(I)
      expect(decimals(I)).toBeLessThanOrEqual(name === 'television' ? 2 : 1)
      expect(isTen(I)).toBe(false)
      expect(b.question.solution).toBe(`$${ends(`I = P \\div V = ${tex(P!)} \\div 230`, I, 'A')}.`)
      expect(b.question.markScheme[0]!.description).toBe(`rearranges to $I = P \\div V$: $${tex(P!)} \\div 230$`)
      expect(units(b)).toBe('A')
      expect(tolerance(b)).toBe(dpTolerance(I))
    }
    expect(contexts(built)).toBe(8)
  })

  it('squares the current before multiplying by R, with a pd that fits the context', () => {
    const PD: Record<string, [number, number]> = {
      heater: [225, 235],
      'kettle element': [225, 235],
      "car's rear-window heater": [11, 14.5],
      'school experiment heater': [6, 12],
      resistor: [1.5, 12],
      'extension lead': [0, 10],
    }
    const built = build('power-from-current-and-resistance', 'q9')
    for (const b of built) {
      const { R, I } = values(b)
      const name = String(b.values.context)
      noArticle(b.question.prompt)
      expect(b.question.prompt, b.seed).toContain(`${show(R!)} Ω`)
      expect(b.question.prompt).toContain(`${show(I!)} A`)
      const V = R! * I!
      expect(V >= PD[name]![0] - 1e-9 && V <= PD[name]![1] + 1e-9, `${b.seed} ${name} ${V}`).toBe(true)
      expect(isTen(R!) || isTen(I!)).toBe(false)
      const sq = clean(I! * I!)
      const P = clean(sq * R!)
      expect(answer(b)).toBe(P)
      expect(decimals(P)).toBeLessThanOrEqual(1)
      expect(clearOf(P, R!, I!)).toBe(true)
      expect(sumIsProduct(I!, I!) || sumIsProduct(I!, R!), b.seed).toBe(false)
      expect(b.question.solution).toBe(`$${ends(`P = I^2 R = ${show(I!)}^2 \\times ${show(R!)} = ${tex(sq)} \\times ${show(R!)}`, P, 'W')}. Square the current first.`)
      expect(b.question.markScheme[0]!.description).toBe(`squares the current then multiplies by $R$: $${show(I!)}^2 \\times ${show(R!)}$`)
      expect(units(b)).toBe('W')
      expect(tolerance(b)).toBe(dpTolerance(P))
    }
    expect(contexts(built)).toBe(6)
  })

  it('squares the new current, and sets the power beside the one that forgot to square', () => {
    const SAYS: Record<number, [string, string, string]> = { 2: ['doubles', 'doubling', 'four times larger'], 3: ['triples', 'tripling', 'nine times larger'], 0.5: ['halves', 'halving', 'a quarter of what it was'] }
    const built = build('power-after-current-change', 'q14')
    for (const b of built) {
      const { R, I1, I2 } = values(b)
      const c = clean(I2! / I1!)
      noArticle(b.question.prompt)
      expect(SAYS[c], b.seed).toBeDefined()
      const [verb, gerund, times] = SAYS[c]!
      expect(b.question.prompt).toContain(`${verb} from ${show(I1!)} A to ${show(I2!)} A`)
      expect(b.question.prompt).toContain(`${show(R!)} Ω`)
      if (b.values.context === 'extension lead') expect(b.question.prompt).toMatch(/wires of an extension lead( have|, with| doubles| triples| halves)/)
      if (b.values.context === 'extension lead') expect(b.question.prompt).not.toMatch(/\bit\b/)
      expect(isTen(R!) || isTen(I1!) || isTen(I2!)).toBe(false)
      const sq = clean(I2! * I2!)
      const P1 = clean(I1! * I1! * R!)
      const P2 = clean(sq * R!)
      expect(answer(b)).toBe(P2)
      expect(decimals(P2)).toBeLessThanOrEqual(1)
      expect(clearOf(P2, R!, I1!, I2!)).toBe(true)
      expect(sumIsProduct(I2!, I2!) || sumIsProduct(I2!, R!), b.seed).toBe(false)
      expect(b.question.solution).toContain(`$P = I^2 R = ${show(I2!)}^2 \\times ${show(R!)} = ${tex(sq)} \\times ${show(R!)} = ${show(P2)}$ W.`)
      expect(b.question.solution).toContain(`${gerund} it makes the power **${times}**: ${prose(P1)} W becomes ${prose(P2)} W, not ${prose(clean(P1 * c))} W.`)
      expect(b.question.markScheme.map((l) => l.description)).toEqual([`squares the new current: $${show(I2!)}^2 = ${tex(sq)}$`, `multiplies by $R$: $${tex(sq)} \\times ${show(R!)}$`, show(P2)])
      expect(units(b)).toBeUndefined()
      expect(tolerance(b)).toBe(dpTolerance(P2))
    }
    expect(new Set(built.map((b) => clean(values(b).I2! / values(b).I1!)))).toEqual(new Set([2, 3, 0.5]))
    expect(contexts(built)).toBe(3)
  })
})

describe('electromagnetic devices', () => {
  it('multiplies B, I and l for the force, to at most three figures', () => {
    const RANGES: Record<string, [number, number][]> = {
      wire: [[0.05, 0.5], [1, 6], [0.05, 0.5]],
      'motor coil': [[0.1, 0.8], [0.5, 5], [0.02, 0.2]],
      loudspeaker: [[0.5, 1.5], [0.1, 2], [2, 10]],
      'copper rod': [[0.05, 0.3], [1, 8], [0.05, 0.15]],
    }
    const built = build('force-on-a-current-carrying-wire', 'q3')
    for (const b of built) {
      const { B, I, l } = values(b)
      noArticle(b.question.prompt)
      expect(b.question.prompt, b.seed).toContain(`${show(B!)} T`)
      expect(b.question.prompt).toContain(`${show(I!)} A`)
      expect(b.question.prompt).toContain(`${show(l!)} m`)
      expect(b.question.prompt).toContain('right angles')
      const [rb, ri, rl] = RANGES[String(b.values.context)]!
      for (const [x, [lo, hi]] of [[B!, rb!], [I!, ri!], [l!, rl!]] as const) expect(x >= lo - 1e-9 && x <= hi + 1e-9).toBe(true)
      expect(isTen(B!) || isTen(I!) || isTen(l!)).toBe(false)
      const F = clean(B! * I! * l!)
      expect(answer(b)).toBe(F)
      expect(decimals(F)).toBeLessThanOrEqual(3)
      expect(show(F).replace('.', '').replace(/^0+/, '').length).toBeLessThanOrEqual(3)
      expect(clearOf(F, B!, I!, l!)).toBe(true)
      expect(sumIsProduct(B!, I!) || sumIsProduct(B!, l!) || sumIsProduct(I!, l!) || F === clean(B! + I! + l!), b.seed).toBe(false)
      expect(b.question.solution).toBe(`$${ends(`F = B I l = ${show(B!)} \\times ${show(I!)} \\times ${show(l!)}`, F, 'N')}.`)
      expect(units(b)).toBe('N')
      expect(tolerance(b)).toBe(dpTolerance(F))
    }
    expect(contexts(built)).toBe(4)
  })

  it('finds the turns ratio, then multiplies for a step-up and divides for a step-down, or keeps a fraction of the turns', () => {
    const OUTPUTS: Record<string, number[]> = {
      'step-up transformer': [3, 4, 5, 6, 7, 8, 9, 11, 12, 15].map((k) => 230 * k),
      'neon sign': [20, 25, 30, 35, 40, 45, 50, 55, 60, 65].map((k) => 230 * k),
      'mains adapter': [3, 4.5, 5, 6, 7.5, 9, 12, 15, 18, 19, 20, 24],
      'school power pack': [2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
    }
    const built = build('transformer-secondary-pd', 'q6')
    for (const b of built) {
      const { Vp, np, ns } = values(b)
      noArticle(b.question.prompt)
      expect(b.question.prompt, b.seed).toContain(prose(np!))
      expect(b.question.prompt).toContain(prose(ns!))
      expect(b.question.prompt).toContain(`${prose(Vp!)} V`)
      expect(Vp).toBe(230)
      const Vs = clean((Vp! * ns!) / np!)
      expect(answer(b)).toBe(Vs)
      expect(OUTPUTS[String(b.values.context)]).toContain(Vs)
      expect(clearOf(Vs, Vp!, np!, ns!)).toBe(true)
      const up = ns! > np!
      const k = clean(up ? ns! / np! : np! / ns!)
      const kind = `a ${up ? 'step-up' : 'step-down'} transformer.`
      if (decimals(k) <= 1) {
        const ratio = up ? `${tex(ns!)} \\div ${tex(np!)}` : `${tex(np!)} \\div ${tex(ns!)}`
        expect(b.question.solution).toContain(`Turns ratio $= ${ratio} = ${show(k)}$, so $`)
        expect(b.question.solution).toContain(ends(`V_s = ${tex(Vp!)} ${up ? '\\times' : '\\div'} ${show(k)}`, Vs, 'V'))
        expect(b.question.solution.endsWith(kind)).toBe(true)
        expect(b.question.markScheme[0]!.description).toBe(`turns ratio $= ${ratio} = ${show(k)}$`)
        expect(b.question.markScheme[1]!.description).toBe(up ? `multiplies the primary pd: $${tex(Vp!)} \\times ${show(k)}$` : `divides the primary pd: $${tex(Vp!)} \\div ${show(k)}$`)
      } else {
        expect(b.question.solution).toContain(`${ends(`V_s = ${tex(Vp!)} \\times \\dfrac{${tex(ns!)}}{${tex(np!)}}`, Vs, 'V')}, ${kind}`)
        expect(b.question.markScheme[0]!.description).toBe(`turns ratio $n_s \\div n_p = ${tex(ns!)} \\div ${tex(np!)}$`)
        expect(b.question.markScheme[1]!.description).toBe(`multiplies the primary pd by it: $${tex(Vp!)} \\times ${tex(ns!)} \\div ${tex(np!)}$`)
      }
      expect(last(b)).toBe(`${prose(Vs)} V`)
      expect(units(b)).toBe('V')
      expect(tolerance(b)).toBe(dpTolerance(Vs))
    }
    expect(contexts(built)).toBe(4)
  })

  it('finds the input power, divides by the secondary pd, at the pds and powers each transformer really has', () => {
    const PAIRS: Record<string, [number, number][]> = {
      'power station': [
        [25000, 400000],
        [25000, 275000],
        [20000, 400000],
        [22000, 275000],
      ],
      'wind farm': [[33000, 132000]],
    }
    const built = build('transformer-secondary-current', 'q10')
    for (const b of built) {
      const { Vp, Vs, Ip } = values(b)
      const name = String(b.values.context)
      noArticle(b.question.prompt)
      expect(b.question.prompt, b.seed).toContain(`${prose(Ip!)} A at ${prose(Vp!)} V`)
      expect(b.question.prompt).toContain(`secondary pd is ${prose(Vs!)} V`)
      expect(b.question.prompt).toMatch(/100% efficien/)
      const k = clean(Vs! / Vp!)
      expect(k).toBeGreaterThan(1)
      const P = clean(Vp! * Ip!)
      const Is = clean(P / Vs!)
      expect(answer(b)).toBe(Is)
      expect(isTen(Ip!) || isTen(Is)).toBe(false)
      expect(clearOf(Is, Vp!, Ip!, Vs!, P)).toBe(true)
      if (PAIRS[name]) expect(PAIRS[name]).toContainEqual([Vp, Vs])
      else expect(Vp).toBe(230)
      // A power station sends out hundreds of megawatts, a wind farm tens.
      if (name === 'power station') expect(P >= 50e6 && P <= 700e6, `${P}`).toBe(true)
      if (name === 'wind farm') expect(P >= 5e6 && P <= 60e6, `${P}`).toBe(true)
      if (name === 'step-up transformer') expect(Ip).toBeLessThanOrEqual(13)
      if (name === 'neon sign') expect(Is >= 0.01 && Is <= 0.03).toBe(true)
      expect(b.question.solution).toContain(`Power in $= V_p I_p = ${tex(Vp!)} \\times ${tex(Ip!)} = ${tex(P)}$ W.`)
      expect(b.question.solution).toContain(ends(`I_s = ${tex(P)} \\div ${tex(Vs!)}`, Is, 'A'))
      expect(b.question.solution).toContain(`The pd rose ${show(k)}× so the current fell ${show(k)}×.`)
      expect(b.question.markScheme[0]!.description).toBe(`calculates the input power: $${tex(Vp!)} \\times ${tex(Ip!)} = ${tex(P)}$ W`)
      expect(b.question.markScheme[1]!.description).toBe(`divides by the secondary pd: $${tex(P)} \\div ${tex(Vs!)}$`)
      expect(units(b)).toBe('A')
      expect(tolerance(b)).toBe(dpTolerance(Is))
    }
    expect(contexts(built)).toBe(4)
  })

  it('works out both wasted powers and divides, the factor the square of the fall', () => {
    const built = build('transmission-loss-factor', 'q14')
    for (const b of built) {
      const { R, I1, I2 } = values(b)
      noArticle(b.question.prompt)
      expect(b.question.prompt, b.seed).toContain(`${show(R!)} Ω`)
      expect(b.question.prompt).toContain(`${prose(I1!)} A`)
      expect(b.question.prompt).toContain(`${prose(I2!)} A`)
      const k = I1! / I2!
      expect([2, 3, 4, 5, 6, 8, 12, 15, 16, 20]).toContain(k)
      expect(isTen(I1!) || isTen(I2!) || isTen(R!)).toBe(false)
      const P1 = clean(I1! * I1! * R!)
      const P2 = clean(I2! * I2! * R!)
      expect(answer(b)).toBe(k * k)
      expect(clearOf(k * k, R!, I1!, I2!)).toBe(true)
      expect(b.question.solution).toContain(`$P = I^2 R = ${tex(I1!)}^2 \\times ${show(R!)} = ${tex(P1)}$ W.`)
      expect(b.question.solution).toContain(`$${tex(I2!)}^2 \\times ${show(R!)} = ${tex(P2)}$ W.`)
      expect(b.question.solution).toContain(`The factor is $${tex(P1)} \\div ${tex(P2)} = $ **${k * k}**: the current fell ${k}×`)
      expect(b.question.solution).toContain(`$${k}^2 = ${k * k}$ times`)
      expect(b.question.markScheme[1]!.description).toBe(`divides to find the factor: $${tex(P1)} \\div ${tex(P2)}$`)
      expect(units(b)).toBeUndefined()
      expect(last(b)).toBe(String(k * k))
      expect(tolerance(b)).toBe(0)
    }
    expect(contexts(built)).toBe(3)
  })

  it('divides the cycles by the time they take, a time a graph shows to two figures, and says the peak pd is not needed', () => {
    const built = build('alternator-turns-per-second', 'q26')
    for (const b of built) {
      const { N, t, peak } = values(b)
      noArticle(b.question.prompt)
      const printed = t!.toPrecision(2)
      expect(show(t!).replace('.', '').replace(/^0+/, '').replace(/0+$/, '').length, b.seed).toBeLessThanOrEqual(2)
      expect(isTen(t!)).toBe(false)
      const shown = N === 1 ? `one complete cycle takes ${printed} s` : `${N} complete cycles take ${printed} s`
      expect(b.question.prompt).toContain(shown)
      expect(b.question.prompt).toContain(`${show(peak!)} V`)
      expect(b.question.prompt).toContain('How many times does the coil turn each second?')
      const f = clean(N! / t!)
      expect(answer(b)).toBe(f)
      expect(clearOf(f, peak!)).toBe(true)
      if (N! > 1) expect(clearOf(f, N!, t!)).toBe(true)
      if (b.values.context === 'hand-turned') expect(f).toBeLessThanOrEqual(6)
      const step = N === 1 ? `\\dfrac{1}{${printed}}` : `${N} \\div ${printed}`
      expect(b.question.solution).toContain(`turns per second $= ${step} = $ **${show(f)}**. The output frequency is ${show(f)} Hz.`)
      expect(b.question.solution).toContain('The peak pd is not needed')
      expect(b.question.markScheme[0]!.description).toBe(N === 1 ? `$1 \\div ${printed}$` : `$${N} \\div ${printed}$`)
      expect(units(b)).toBeUndefined()
      expect(tolerance(b)).toBe(dpTolerance(f))
    }
    expect(new Set(built.map((b) => b.values.N === 1))).toEqual(new Set([true, false]))
    expect(contexts(built)).toBe(3)
  })
})

describe('spread across builds', () => {
  /** The share of the draws the k commonest values take together. */
  const top = (built: Generated[], key: (b: Generated) => unknown, k = 1) => {
    const counts = new Map<unknown, number>()
    for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
    return [...counts.values()].sort((a, b) => b - a).slice(0, k).reduce((a, b) => a + b, 0) / built.length
  }
  // Each context must give ten or more answers with none carrying it: a mains adapter gave
  // four, a hand-turned alternator four (2.5 at 30%), and a television five, before this was so.
  const cases = [
    ['mains-power-from-current', 'q5'],
    ['mains-current-from-power', 'q6'],
    ['power-from-current-and-resistance', 'q9'],
    ['power-after-current-change', 'q14'],
    ['force-on-a-current-carrying-wire', 'q3'],
    ['transformer-secondary-pd', 'q6'],
    ['transformer-secondary-current', 'q10'],
    ['transmission-loss-factor', 'q14'],
    ['alternator-turns-per-second', 'q26'],
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

  it('the coincidence checks see a power of ten past 10⁴, and no two figures multiplied give their sum', () => {
    expect(tenfold(500, 0.005)).toBe(true)
    expect(isTen(1e7)).toBe(true)
    expect(sumIsProduct(2, 2)).toBe(true)
    for (const b of build('transformer-secondary-current', 'q10', 600)) {
      const { Vp, Vs, Ip } = values(b)
      for (const g of [Vp!, Vs!, Ip!]) expect(tenfold(answer(b), g), b.seed).toBe(false)
    }
  })
})
