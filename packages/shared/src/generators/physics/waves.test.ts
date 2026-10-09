import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { dpTolerance } from './format.ts'
import { waveGenerators } from './waves.ts'

/**
 * Structural tests for the waves generators. The release check proves each answer agrees with
 * a second route; these read the prompt's own numbers and the working printed on the way and
 * check each step is the right one, because a right answer can be reached by a wrong route
 * (generator-helpers-need-structural-tests). They also look across a run of builds for what
 * no single build can show: a context that never rotates, or one value carrying a context.
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
const codes = (b: Generated) => b.question.markScheme.map((l) => l.code)
/** A number inside maths as the generators print it: 12\,000 from five digits. */
const tex = (x: number) => (Math.abs(x) >= 10000 ? show(x).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : show(x))
/** A number in prose: 12 000 from five digits. */
const prose = (x: number) => (Math.abs(x) >= 10000 ? show(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : show(x))
const values = (b: Generated) => b.values as Record<string, number>
const contexts = (built: Generated[]) => new Set(built.map((b) => b.values.context)).size
const sigFigures = (x: number) => Math.abs(x).toExponential(11).split('e')[0]!.replace('.', '').replace(/0+$/, '').length
/** The front number of x, 4.8 for 0.048, worked by strings rather than logarithms. */
const front = (x: number) => Number(Math.abs(x).toExponential(9).split('e')[0])
const power = (x: number) => Number(Math.abs(x).toExponential(9).split('e')[1])
/** Standard form as the prompts print it, with two figures at least: [2.4, 9] is "2.4", 4 × 10⁹ is "4.0". */
function standard(x: number): [string, number] {
  const m = String(front(x))
  return [m.includes('.') ? m : `${m}.0`, power(x)]
}
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const sup = (e: number) => String(e).split('').map((c) => (c === '-' ? '⁻' : SUP[Number(c)])).join('')
const prosed = (x: number) => `${standard(x)[0]} × 10${sup(standard(x)[1])}`
const texed = (x: number) => `${standard(x)[0]} \\times 10^{${standard(x)[1]}}`
/** The answer is a given figure with the point moved, doubled or halved. */
const echoes = (a: number, g: number) => [1, 2, 5].includes(front(a / g))

describe('the electromagnetic spectrum', () => {
  /** The frequencies each radio band really uses, in Hz. */
  const BANDS: Record<string, [number, number]> = {
    'low frequency': [30e3, 300e3],
    'medium wave': [531e3, 1602e3],
    shortwave: [3e6, 30e6],
    VHF: [30e6, 300e6],
    'UHF television': [470e6, 694e6],
  }

  it('q5 divides 3 × 10⁸ by a radio band’s own wavelength, stated speed, exact frequency', () => {
    const built = build('radio-frequency-from-wavelength', 'q5')
    for (const b of built) {
      const { lambda: l } = values(b)
      const f = answer(b)
      expect(b.question.prompt, b.seed).toContain(`wavelength of ${prose(l!)} m`)
      expect(b.question.prompt).toMatch(/Take the wave speed as 3 × 10⁸ m\/s\.|Radio waves travel at 3 × 10⁸ m\/s\./)
      expect(b.question.prompt).not.toMatch(/\ba \d/)
      expect(f).toBe(clean(3e8 / l!))
      expect(Number.isInteger(f)).toBe(true)
      expect(sigFigures(f)).toBeLessThanOrEqual(3)
      const [lo, hi] = BANDS[String(b.values.context)]!
      expect(f).toBeGreaterThanOrEqual(lo)
      expect(f).toBeLessThanOrEqual(hi)
      // Never the speed's 3 with the point moved, nor 1.5 or 6: a wavelength that is 1, 2 or 5 is filtered.
      expect(echoes(f, 3e8)).toBe(false)
      expect(b.question.solution).toContain(`\\dfrac{3 \\times 10^8}{${tex(l!)}}$, which is **${f} Hz**`)
      expect(b.question.solution).toMatch(/That is [\d.]+ (MHz|kHz)\.$/)
      expect(codes(b)).toEqual(['M1', 'M1', 'A1'])
      expect(method(b, 1)).toBe(`$3 \\times 10^8 \\div ${tex(l!)}$`)
      expect(last(b)).toBe(f >= 1e6 ? `$${texed(f)}$ Hz` : `${prose(f)} Hz`)
      expect(tolerance(b)).toBe(0)
      expect(units(b)).toBe('Hz')
    }
    expect(contexts(built)).toBe(5)
  })

  it('q14 gives no speed, so the solution states it and names the radio group', () => {
    const built = build('radio-frequency-from-wavelength', 'q14')
    for (const b of built) {
      const { lambda: l } = values(b)
      expect(b.question.prompt, b.seed).toMatch(new RegExp(` ${prose(l!)} m\\b`))
      expect(b.question.prompt).toContain('electromagnetic wave')
      expect(b.question.prompt).not.toContain('10⁸')
      expect(l).toBeGreaterThanOrEqual(10)
      expect(answer(b)).toBe(clean(3e8 / l!))
      expect(b.question.solution).toMatch(/^Every electromagnetic wave travels at \$3 \\times 10\^8\$ m\/s in air\./)
      expect(b.question.solution).toContain('which puts it in the radio group.')
      expect(units(b)).toBe('Hz')
    }
    expect(contexts(built)).toBe(3)
  })

  it('q6 and q19 divide 3 × 10⁸ by a microwave frequency the source really uses', () => {
    const RANGES: Record<string, [number, number]> = {
      microwave: [1e9, 3e11],
      'mobile phone': [7.5e8, 3.75e9],
      'Wi-Fi': [2.4e9, 7.1e10],
      satellite: [4e9, 4e10],
      radar: [1e9, 4e10],
    }
    for (const slotId of ['q6', 'q19']) {
      const built = build('microwave-wavelength-from-frequency', slotId)
      for (const b of built) {
        const { f } = values(b)
        const l = answer(b)
        const [m, e] = standard(f!)
        const [lo, hi] = RANGES[String(b.values.context)]!
        expect(f, b.seed).toBeGreaterThanOrEqual(lo)
        expect(f).toBeLessThanOrEqual(hi)
        if (b.values.context === 'Wi-Fi') expect([2.4e9, 6e9, 6.25e9, 6e10, 6.25e10]).toContain(f)
        // The UK mobile bands only; 2.4 GHz is Wi-Fi's.
        if (b.values.context === 'mobile phone') expect([7.5e8, 8e8, 1.5e9, 2.5e9, 3.75e9]).toContain(f)
        expect(l).toBe(clean(3e8 / f!))
        expect(sigFigures(l)).toBeLessThanOrEqual(3)
        expect(echoes(l, 3e8)).toBe(false)
        expect(echoes(l, f!)).toBe(false)
        expect(tolerance(b)).toBe(dpTolerance(l))
        expect(units(b)).toBe('m')
        expect(b.question.prompt).not.toMatch(/\ba \d/)
        if (slotId === 'q6') {
          expect(b.question.prompt).toContain(`frequency of ${prosed(f!)} Hz`)
          expect(b.question.prompt).not.toContain('speed')
          expect(b.question.solution).toContain(`\\dfrac{3 \\times 10^8}{${texed(f!)}} = ${show(l)}$ m.`)
          expect(method(b, 1)).toBe(`$3 \\times 10^8 \\div (${texed(f!)})$`)
          expect(last(b)).toBe(`${show(l)} m`)
        } else {
          const q = clean(3 / Number(m))
          expect(b.question.prompt).toContain(`frequency of $${texed(f!)}$ Hz`)
          expect(b.question.prompt).toContain('The speed of light is $3.0 \\times 10^8$ m/s.')
          expect(b.question.prompt).toContain('Give your answer in standard form.')
          expect(b.question.solution).toContain(`$3.0 \\div ${m} = ${show(q)}$, and subtract the powers, $10^{8-${e}} = 10^{${8 - e}}$`)
          if (q < 1) expect(b.question.solution).toContain(`$${show(q)} \\times 10^{${8 - e}} = ${texed(l)}$, so `)
          expect(b.question.solution).toContain(`**$${texed(l)}$ m**, which is ${show(l)} m.`)
          expect(last(b)).toBe(`$${texed(l)}$ m`)
        }
      }
      expect(contexts(built)).toBe(5)
    }
  })

  it('q11 handles the negative power and marks to half a unit in the third figure', () => {
    const RANGES: Record<string, [number, number]> = { 'X-ray': [1e-11, 1e-8], gamma: [1e-12, 1e-11], ultraviolet: [1e-8, 4e-7] }
    const built = build('short-wavelength-frequency', 'q11')
    for (const b of built) {
      const { lambda: l } = values(b)
      const f = answer(b)
      const [m, e] = standard(l!)
      const [lo, hi] = RANGES[String(b.values.context)]!
      expect(l, b.seed).toBeGreaterThanOrEqual(lo)
      expect(l).toBeLessThanOrEqual(hi)
      expect(b.question.prompt).toContain(`wavelength of ${prosed(l!)} m`)
      expect(b.question.prompt).toContain('Give your answer in standard form.')
      expect(b.question.prompt).not.toMatch(/\ba X/)
      expect(f).toBe(clean(3e8 / l!))
      expect(f).toBeLessThan(1e21)
      expect(sigFigures(f)).toBeLessThanOrEqual(3)
      expect(tolerance(b)).toBe(Number((0.5 * 10 ** (power(f) - 2)).toPrecision(10)))
      expect(b.question.solution).toContain(`\\dfrac{3 \\times 10^8}{${texed(l!)}}`)
      expect(b.question.solution).toContain(`$3 \\div ${m} = ${show(clean(3 / Number(m)))}$`)
      expect(b.question.solution).toContain(`$10^{8-(${e})} = 10^{${8 - e}}$`)
      expect(b.question.solution).toContain(`**$${texed(f)}$ Hz**, which is ${String(f)} Hz.`)
      expect(method(b, 1)).toBe(`handles the negative power: $10^{8-(${e})} = 10^{${8 - e}}$`)
      expect(units(b)).toBe('Hz')
    }
    expect(contexts(built)).toBe(3)
  })

  it('q9 divides a real dose in mSv by 1000', () => {
    const RANGES: Record<string, [number, number]> = {
      'CT scan of the abdomen': [6, 14],
      'CT scan of the head': [1.2, 3],
      'X-ray of the lower spine': [0.5, 1.5],
      background: [1.5, 4],
      'airline pilot': [1, 5],
      'nuclear power station worker': [0.5, 6],
    }
    const built = build('radiation-dose-in-sieverts', 'q9')
    for (const b of built) {
      const { dose: d } = values(b)
      const [lo, hi] = RANGES[String(b.values.context)]!
      expect(d, b.seed).toBeGreaterThanOrEqual(lo)
      expect(d).toBeLessThanOrEqual(hi)
      expect([1, 10]).not.toContain(d)
      expect(b.question.prompt).toContain(`dose of ${show(d!)} mSv`)
      expect(b.question.prompt).toContain('sieverts')
      expect(answer(b)).toBe(clean(d! / 1000))
      expect(b.question.solution).toBe(`1000 mSv = 1 Sv, so $${show(d!)} \\div 1000 = ${show(answer(b))}$ Sv.`)
      expect(tolerance(b)).toBe(dpTolerance(answer(b)))
      expect(units(b)).toBe('Sv')
    }
    expect(contexts(built)).toBe(6)
  })
})

describe('lenses', () => {
  it('divides the image height by the object height, larger in q5 and smaller in q6', () => {
    for (const slotId of ['q5', 'q6']) {
      const built = build('lens-magnification', slotId)
      for (const b of built) {
        const { o, i, mag } = values(b)
        expect(b.question.prompt, b.seed).toContain(`${show(o!)} cm`)
        expect(b.question.prompt).toContain(`${show(i!)} cm`)
        expect(b.question.prompt).toContain('What is the magnification?')
        expect(answer(b)).toBe(mag)
        expect(answer(b)).toBeCloseTo(i! / o!, 9)
        if (slotId === 'q5') expect(answer(b)).toBeGreaterThan(1)
        else expect(answer(b)).toBeLessThan(1)
        // Never 1, 10 or 0.1, and never a given figure moved, doubled or halved.
        expect(front(answer(b))).not.toBe(1)
        expect(echoes(answer(b), o!)).toBe(false)
        expect(echoes(answer(b), i!)).toBe(false)
        expect(i).not.toBe(o)
        if (b.values.context === 'magnifying glass') expect(answer(b)).toBeLessThanOrEqual(5)
        if (b.values.context === 'projector') expect(answer(b)).toBeGreaterThanOrEqual(20)
        if (b.values.context === 'camera') expect(answer(b)).toBeLessThan(0.02)
        expect(b.question.solution).toContain(`\\dfrac{${tex(i!)}}{${tex(o!)}} = ${show(answer(b))}$`)
        expect(b.question.solution).toContain(slotId === 'q5' ? 'Greater than 1' : 'Less than 1')
        expect(method(b, 0)).toBe(`image height over object height: $${tex(i!)} \\div ${tex(o!)}$`)
        expect(tolerance(b)).toBe(dpTolerance(answer(b)))
        expect(units(b)).toBeUndefined()
      }
      expect(contexts(built)).toBe(4)
    }
  })

  it('q14 converts to one unit first, with a mark for it', () => {
    const FACTOR: Record<string, [string, string, number]> = {
      'mm and cm': ['mm', 'cm', 0.1],
      ant: ['cm', 'mm', 10],
      projector: ['m', 'mm', 1000],
      'convex lens and screen': ['cm', 'mm', 10],
    }
    const built = build('lens-magnification', 'q14')
    for (const b of built) {
      const { o, i, mag } = values(b)
      const [iUnit, oUnit, factor] = FACTOR[String(b.values.context)]!
      const same = clean(i! * factor)
      expect(b.question.prompt, b.seed).toContain(`${show(i!)} ${iUnit}`)
      expect(b.question.prompt).toContain(`${show(o!)} ${oUnit}`)
      expect(answer(b)).toBe(mag)
      expect(answer(b)).toBeCloseTo(same / o!, 9)
      expect(front(answer(b))).not.toBe(1)
      expect(b.question.solution).toContain(`Convert first: ${show(i!)} ${iUnit} is ${show(same)} ${oUnit}.`)
      expect(b.question.solution).toContain(`Using ${show(i!)} and ${show(o!)} directly would give ${show(clean(i! / o!))}`)
      expect(method(b, 0)).toBe(`converts to the same unit: ${show(i!)} ${iUnit} $= ${tex(same)}$ ${oUnit}`)
      expect(method(b, 1)).toBe(`image height over object height: $${tex(same)} \\div ${tex(o!)}$`)
      expect(codes(b)).toEqual(['M1', 'M1', 'A1'])
      expect(units(b)).toBeUndefined()
    }
    expect(contexts(built)).toBe(4)
  })
})

describe('light: required practical 9', () => {
  it('q19 gives the angle of reflection equal to the angle of incidence', () => {
    const built = build('angle-of-reflection', 'q19')
    for (const b of built) {
      const { a } = values(b)
      expect(b.question.prompt, b.seed).toContain(`${a}°`)
      expect(b.question.prompt).toMatch(/normal|angle of incidence/)
      expect(b.question.prompt).toMatch(/glass block|Perspex block/)
      expect(a).toBeGreaterThanOrEqual(10)
      expect(a).toBeLessThanOrEqual(75)
      expect(answer(b)).toBe(a)
      expect(b.question.solution).toContain(`**${a}°**`)
      expect(codes(b)).toEqual(['B1'])
      expect(tolerance(b)).toBe(0)
    }
    expect(contexts(built)).toBe(2)
  })

  it('q24 takes the inverse tangent of shift over thickness and rounds clear of a half', () => {
    const built = build('angle-of-refraction-from-a-trace', 'q24')
    for (const b of built) {
      const { T, s } = values(b)
      const deg = (Math.atan(s! / T!) * 180) / Math.PI
      expect(b.question.prompt, b.seed).toContain(`${T!.toFixed(1)} cm thick`)
      expect(b.question.prompt).toContain(`${s!.toFixed(1)} cm`)
      expect(b.question.prompt).toContain('to the nearest degree')
      expect(answer(b)).toBe(Math.round(deg))
      expect(Math.abs(deg - Math.floor(deg) - 0.5)).toBeGreaterThan(0.06)
      // A student who rounds tan r first, to 2 decimal places as the written solution does or to
      // 2 significant figures, reaches the same whole degree (9.0 cm and 2.2 cm did not: 13.74° but tan 0.24 gives 13.50°).
      for (const t of [Number((s! / T!).toFixed(2)), Number((s! / T!).toPrecision(2))]) expect(Math.round((Math.atan(t) * 180) / Math.PI), `${b.seed} tan ${t}`).toBe(answer(b))
      expect(answer(b)).toBeGreaterThanOrEqual(8)
      expect(answer(b)).toBeLessThanOrEqual(40)
      expect(b.question.solution).toContain(`$\\tan r = \\dfrac{${s!.toFixed(1)}}{${T!.toFixed(1)}}`)
      expect(b.question.solution).toContain(`$r = ${deg.toFixed(1)}°$, which is **${answer(b)}°** to the nearest degree`)
      expect(method(b, 0)).toBe(`$\\tan r = ${s!.toFixed(1)} \\div ${T!.toFixed(1)}$`)
      expect(last(b)).toBe(String(answer(b)))
      expect(tolerance(b)).toBe(0)
    }
    expect(contexts(built)).toBe(2)
  })
})

describe('sound', () => {
  it('q5 divides 340 by the frequency a source really makes', () => {
    const RANGES: Record<string, [number, number]> = {
      'signal generator': [20, 20000],
      whistle: [2000, 4500],
      'bass guitar': [41, 400],
      foghorn: [50, 300],
      singer: [80, 1100],
      bird: [1000, 8000],
    }
    const built = build('sound-wavelength-in-air', 'q5')
    for (const b of built) {
      const { f } = values(b)
      const [lo, hi] = RANGES[String(b.values.context)]!
      expect(f, b.seed).toBeGreaterThanOrEqual(lo)
      expect(f).toBeLessThanOrEqual(hi)
      expect(b.question.prompt).toContain(`${prose(f!)} Hz`)
      expect(b.question.prompt).toContain('340 m/s')
      expect(b.question.prompt).not.toMatch(/\ba \d/)
      expect(answer(b)).toBe(clean(340 / f!))
      expect(sigFigures(answer(b))).toBeLessThanOrEqual(3)
      expect(echoes(answer(b), 340)).toBe(false)
      expect(echoes(answer(b), f!)).toBe(false)
      expect(b.question.solution).toBe(`$\\lambda = \\dfrac{v}{f} = \\dfrac{340}{${tex(f!)}} = ${show(answer(b))}$ m.`)
      expect(tolerance(b)).toBe(dpTolerance(answer(b)))
      expect(units(b)).toBe('m')
    }
    expect(contexts(built)).toBe(6)
  })

  it('q7 and q12 leave the limit to the student and convert 20 kHz in q12', () => {
    for (const slotId of ['q7', 'q12']) {
      const upper = slotId === 'q12'
      const built = build('wavelength-at-a-limit-of-hearing', slotId)
      for (const b of built) {
        const { v } = values(b)
        expect(v, b.seed).toBeGreaterThanOrEqual(330)
        expect(v).toBeLessThanOrEqual(350)
        // An even speed keeps the answer to three figures: 335 m/s gave 16.75 m, and 16.8 was marked wrong.
        expect(v! % 2).toBe(0)
        expect(sigFigures(answer(b))).toBeLessThanOrEqual(3)
        expect(b.question.prompt).toContain(`${v} m/s`)
        expect(b.question.prompt).not.toMatch(/\b20\b|kHz/)
        expect(b.question.prompt).toMatch(upper ? /upper|highest|top/ : /lower|lowest|bottom/)
        expect(answer(b)).toBe(clean(v! / (upper ? 20000 : 20)))
        expect(method(b, 0)).toBe(upper ? 'converts 20 kHz to 20 000 Hz' : 'identifies the lower limit as 20 Hz')
        expect(method(b, 1)).toBe(`uses $\\lambda = v \\div f$: $${v} \\div ${upper ? '20\\,000' : '20'}$`)
        expect(b.question.solution).toContain(upper ? `\\dfrac{${v}}{20\\,000} = ${show(answer(b))}$ m` : `\\dfrac{${v}}{20} = ${show(answer(b))}$ m`)
        if (upper) expect(b.question.solution).toContain(`gives ${show(v! / 20)} m, a thousand times too big`)
        expect(tolerance(b)).toBe(dpTolerance(answer(b)))
        expect(units(b)).toBe('m')
      }
      expect(contexts(built)).toBe(6)
      expect(new Set(built.map((b) => b.values.speed)).size).toBe(3)
      expect(new Set(built.map((b) => b.question.prompt)).size).toBeGreaterThan(120)
    }
  })
})

describe('wave properties', () => {
  it('q4 multiplies a frequency and wavelength each wave really has', () => {
    const SPEEDS: Record<string, [number, number]> = {
      'ripple tank': [0.1, 0.35],
      sea: [2, 12],
      pond: [0.3, 2],
      slinky: [0.5, 4],
      rope: [1, 10],
      seismic: [5000, 8000],
      wave: [0.3, 20],
    }
    const built = build('wave-speed-from-frequency-and-wavelength', 'q4')
    for (const b of built) {
      const { f, l } = values(b)
      const v = answer(b)
      expect(b.question.prompt, b.seed).toContain(`frequency of ${prose(f!)} Hz`)
      expect(b.question.prompt).toContain(`wavelength of ${prose(l!)} m`)
      expect(v).toBe(clean(f! * l!))
      const [lo, hi] = SPEEDS[String(b.values.context)]!
      expect(v).toBeGreaterThanOrEqual(lo)
      expect(v).toBeLessThanOrEqual(hi)
      // A water wave runs near the deep-water speed for its wavelength.
      if (['sea', 'pond'].includes(String(b.values.context))) expect(Math.abs(v / Math.sqrt((9.8 * l!) / (2 * Math.PI)) - 1)).toBeLessThanOrEqual(0.3)
      expect(echoes(v, f!)).toBe(false)
      expect(echoes(v, l!)).toBe(false)
      expect(b.question.solution).toBe(`$v = f\\lambda = ${tex(f!)} \\times ${tex(l!)} = ${show(v)}$ m/s.`)
      expect(tolerance(b)).toBe(dpTolerance(v))
      expect(units(b)).toBe('m/s')
    }
    expect(contexts(built)).toBe(7)
  })

  it('q5 takes the reciprocal of a period whose reciprocal ends cleanly', () => {
    const built = build('frequency-from-period', 'q5')
    for (const b of built) {
      const { T } = values(b)
      expect(b.question.prompt, b.seed).toContain(` ${show(T!)} s.`)
      expect([1.25, 1.6, 2.5, 4, 6.25, 8]).toContain(front(T!))
      expect(answer(b)).toBe(clean(1 / T!))
      expect(b.question.solution).toBe(`$f = \\dfrac{1}{T} = \\dfrac{1}{${show(T!)}} = ${show(answer(b))}$ Hz. Period and frequency are reciprocals.`)
      expect(tolerance(b)).toBe(dpTolerance(answer(b)))
      expect(units(b)).toBe('Hz')
    }
    expect(contexts(built)).toBe(7)
  })

  it('q6 divides a medium’s own speed by the frequency, substituting both', () => {
    const SPEED: Record<string, number[]> = { 'sea water': [1500], air: [340], steel: [6000], seismic: [6000, 7000, 8000] }
    const built = build('wavelength-from-speed-and-frequency', 'q6')
    for (const b of built) {
      const { v, f } = values(b)
      const speeds = SPEED[String(b.values.context)]
      if (speeds) expect(speeds, b.seed).toContain(v)
      // Each speed carries the frequencies a wave at that speed really has, in whole hertz.
      const [lo, hi] = ({ 'sea water': [100, 20000], air: [20, 20000], steel: [200, 4000], seismic: [0.5, 20] } as Record<string, number[]>)[String(b.values.context)] ?? ({ 1500: [100, 5000], 340: [50, 5000], 45: [5, 120], 12: [1, 20], 2.4: [1, 10] } as Record<number, number[]>)[v!] ?? [4, 20]
      expect(f).toBeGreaterThanOrEqual(lo!)
      expect(f).toBeLessThanOrEqual(hi!)
      if (b.values.context !== 'seismic') expect(Number.isInteger(f)).toBe(true)
      expect(b.question.prompt).toContain(`${prose(v!)} m/s`)
      expect(b.question.prompt).toContain(`${prose(f!)} Hz`)
      expect(answer(b)).toBe(clean(v! / f!))
      expect(echoes(answer(b), v!)).toBe(false)
      expect(echoes(answer(b), f!)).toBe(false)
      expect(method(b, 0)).toBe('rearranges to $\\lambda = v \\div f$')
      expect(method(b, 1)).toBe(`substitutes ${prose(v!)} and ${prose(f!)}: $${tex(v!)} \\div ${tex(f!)}$`)
      expect(units(b)).toBe('m')
    }
    expect(contexts(built)).toBe(6)
  })

  it('q13 doubles the distance to the reflector and divides by the time', () => {
    const built = build('speed-of-sound-from-an-echo', 'q13')
    for (const b of built) {
      const { d, t } = values(b)
      expect(b.question.prompt, b.seed).toContain(`${show(d!)} m`)
      expect(b.question.prompt).toContain(`${t!.toFixed(2)} s`)
      expect(answer(b)).toBe(clean((2 * d!) / t!))
      expect(Number.isInteger(answer(b))).toBe(true)
      // A tape measures whole metres; a stopwatch reads to 0.01 s.
      expect(Number.isInteger(d)).toBe(true)
      expect(Number.isInteger(Math.round(t! * 100 * 1e6) / 1e6)).toBe(true)
      expect(answer(b)).toBeGreaterThanOrEqual(330)
      expect(answer(b)).toBeLessThanOrEqual(345)
      expect(t).not.toBe(1)
      expect(b.question.solution).toContain(`$2 \\times ${show(d!)} = ${show(clean(2 * d!))}$ m`)
      expect(b.question.solution).toContain(`\\dfrac{${show(clean(2 * d!))}}{${t!.toFixed(2)}} = ${answer(b)}$ m/s`)
      expect(method(b, 0)).toBe(`doubles the distance to ${show(clean(2 * d!))} m`)
      expect(method(b, 1)).toBe(`divides by ${t!.toFixed(2)}`)
      expect(tolerance(b)).toBe(0)
      expect(units(b)).toBe('m/s')
    }
    expect(contexts(built)).toBe(3)
  })

  it('q20 halves the loop count into wavelengths, then multiplies by the frequency', () => {
    const built = build('wave-speed-on-a-string', 'q20')
    for (const b of built) {
      const { L, f } = values(b)
      const n = Number(String(b.values.context).split(' ')[0])
      const l = clean((2 * L!) / n)
      expect([3, 4, 5, 6]).toContain(n)
      expect(b.question.prompt, b.seed).toContain(`${n} loops`)
      expect(b.question.prompt).toContain(`${L!.toFixed(2)} m`)
      expect(b.question.prompt).toContain(`${f} Hz`)
      expect(Number.isInteger(f)).toBe(true)
      expect(answer(b)).toBe(clean(f! * l))
      expect(answer(b)).toBeGreaterThanOrEqual(8)
      expect(answer(b)).toBeLessThanOrEqual(40)
      expect(b.question.solution).toContain(`One loop is $${L!.toFixed(2)} \\div ${n} = ${(L! / n).toFixed(2)}$ m, so $\\lambda = ${l.toFixed(2)}$ m.`)
      expect(b.question.solution).toContain(`$v = f\\lambda = ${f} \\times ${l.toFixed(2)} = $ **${show(answer(b))} m/s**`)
      expect(method(b, 0)).toBe(`$\\lambda = ${l.toFixed(2)}$ m`)
      expect(last(b)).toBe(show(answer(b)))
      // The written slot has no units field, and the generated one keeps it that way.
      expect(units(b)).toBeUndefined()
    }
    expect(contexts(built)).toBe(4)
  })
})

describe('waves for detection', () => {
  it('q5 multiplies 1500 by the echo time and halves it to a whole depth', () => {
    const built = build('echo-sounding-depth', 'q5')
    for (const b of built) {
      const { t } = values(b)
      const whole = clean(1500 * t!)
      expect(b.question.prompt, b.seed).toContain(`${show(t!)} s`)
      expect(b.question.prompt).toContain('1500 m/s')
      expect(b.question.prompt).not.toMatch(/the a /)
      expect(answer(b)).toBe(clean(whole / 2))
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(echoes(answer(b), 1500)).toBe(false)
      expect(method(b, 0)).toBe(`speed times time: $1500 \\times ${show(t!)} = ${tex(whole)}$ m`)
      expect(method(b, 1)).toBe('divides by two for the return journey')
      expect(b.question.solution).toContain(`$${tex(whole)} \\div 2 = ${tex(answer(b))}$ m`)
      if (b.values.context === 'ocean floor') expect(answer(b)).toBeGreaterThanOrEqual(1500)
      else expect(answer(b)).toBeLessThanOrEqual(300)
      expect(tolerance(b)).toBe(0)
      expect(units(b)).toBe('m')
    }
    expect(contexts(built)).toBe(4)
  })

  it('q10 halves the round trip in tissue to a depth an organ really lies at', () => {
    const built = build('ultrasound-depth', 'q10')
    for (const b of built) {
      const { t } = values(b)
      const whole = clean(1500 * t!)
      expect(b.question.prompt, b.seed).toContain(`${show(t!)} s`)
      expect(sigFigures(t!)).toBeLessThanOrEqual(2)
      expect(answer(b)).toBe(clean(whole / 2))
      expect(answer(b)).toBeGreaterThanOrEqual(0.02)
      expect(answer(b)).toBeLessThanOrEqual(0.15)
      expect(method(b, 0)).toBe(`speed times time: $1500 \\times ${show(t!)} = ${show(whole)}$ m`)
      expect(method(b, 1)).toBe('halves it')
      expect(tolerance(b)).toBe(dpTolerance(answer(b)))
      expect(units(b)).toBe('m')
    }
    expect(contexts(built)).toBe(4)
  })

  it('q14 doubles the depth and divides by 1500', () => {
    const built = build('ultrasound-echo-time', 'q14')
    for (const b of built) {
      const { d } = values(b)
      const there = clean(2 * d!)
      expect(b.question.prompt, b.seed).toContain(`${show(d!)} m`)
      expect(answer(b)).toBe(clean(there / 1500))
      expect(sigFigures(answer(b))).toBeLessThanOrEqual(2)
      expect(String(answer(b))).not.toMatch(/e/)
      expect(echoes(answer(b), 1500)).toBe(false)
      expect(method(b, 0)).toBe(`doubles the distance for the return journey: $2 \\times ${show(d!)} = ${show(there)}$ m`)
      expect(method(b, 1)).toBe(`divides by the speed: $${show(there)} \\div 1500$`)
      expect(b.question.solution).toContain('**doubled**, not halved')
      expect(tolerance(b)).toBe(dpTolerance(answer(b)))
      expect(units(b)).toBe('s')
    }
    expect(contexts(built)).toBe(4)
  })
})

/**
 * No single value carries a slot or a context. Drawing two figures at random and keeping the
 * pairs that divide cleanly makes the easiest value dominate (aggregate-only-defects), and
 * pooling contexts can hide one that offers only a value or two.
 */
describe('spread across builds', () => {
  const share = (xs: unknown[]) => {
    const counts = new Map<unknown, number>()
    for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1)
    return Math.max(...counts.values()) / xs.length
  }
  const slots = waveGenerators.flatMap((g) => g.replaces.map((id) => [g.id, id] as const))

  it('covers all 22 written slots', () => expect(slots).toHaveLength(22))

  for (const [id, slotId] of slots) {
    it(`${id} ${slotId}: no answer is more than 40% of the builds, in all or in any context`, () => {
      const built = build(id, slotId)
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
