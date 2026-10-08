import { clearOfHalf, fixed, roundTo, show } from '../format.ts'
import { draw, int, pick } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Generator } from '../types.ts'

const TOPIC = 'limits-of-accuracy-and-bounds'

/**
 * Bounds are worked in hundredths of the unit, as whole numbers: 7.5 is 750. Adding 0.05 to
 * 3.6 in floating point is the classic residue trap, and a half-unit of 0.05 is 5 here.
 */
const H = 100
const hundredths = (x: number) => Math.round(x * H)
const fromH = (n: number) => Number(show(n / H))

/** Rounds `x` (hundredths) to the nearest `step` (hundredths), a half rounding up. */
const roundToStep = (x: number, step: number) => Math.floor(x / step + 0.5) * step

/** A measurement and how it was rounded, with the values it can sensibly take. */
interface Measure {
  what: string
  unit: string
  accuracy: string
  /** The rounding step, in hundredths of the unit. */
  step: number
  /** The stated values, as multiples of the step. */
  range: [number, number]
}

const SINGLE: Measure[] = [
  { what: 'A length', unit: 'cm', accuracy: 'to the nearest cm', step: 100, range: [2, 99] },
  { what: 'A mass', unit: 'g', accuracy: 'to the nearest 10 g', step: 1000, range: [3, 99] },
  { what: 'A time', unit: 's', accuracy: 'to 1 decimal place', step: 10, range: [12, 300] },
  { what: 'A distance', unit: 'km', accuracy: 'to 1 decimal place', step: 10, range: [5, 250] },
  { what: 'A volume', unit: 'ml', accuracy: 'to the nearest 5 ml', step: 500, range: [4, 100] },
  { what: 'A height', unit: 'm', accuracy: 'to the nearest metre', step: 100, range: [3, 400] },
]

/**
 * The upper bound of one rounded measurement: written as q9 (7 cm to the nearest cm, 1 mark).
 * The accuracy varies, so the half-unit is not always 0.5.
 */
export const upperBound: Generator = {
  id: 'upper-bound',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q9'],
  build(r, slot) {
    const m = pick(r, SINGLE)
    const k = draw(r, (r) => int(r, ...m.range), (k) => m.step !== 10 || k % 10 !== 0)
    const v = k * m.step
    const half = m.step / 2
    const answer = fromH(v + half)
    // Second route: step up from the stated value a hundredth at a time until a value no
    // longer rounds to it. That first value is the upper bound (it rounds up, so is excluded).
    let x = v
    while (roundToStep(x, m.step) === v) x += 1
    const shown = show(v / H)
    const unitWord = m.step === 10 ? '0.1' : show(m.step / H)
    return {
      question: {
        type: 'numeric',
        prompt: `${m.what} is ${shown} ${m.unit} ${m.accuracy}. What is its upper bound, in ${m.unit}?`,
        solution: `Half of ${unitWord} ${m.unit} is ${show(half / H)} ${m.unit}, so the upper bound is $${shown} + ${show(half / H)} = ${show(answer)}$ ${m.unit}.`,
        markScheme: scheme(slot, [], show(answer)),
        answer,
        tolerance: slot.type === 'numeric' ? slot.tolerance : 0.001,
        units: m.unit,
      },
      check: { agrees: x === hundredths(answer), detail: `first value above ${shown} not rounding to it: ${show(x / H)}` },
      values: { value: shown, unit: m.unit, step: show(m.step / H) },
    }
  },
}

/** Each side of a rectangle: what it is and how it was rounded. */
interface Side {
  step: number
  range: [number, number]
  accuracy: string
}
const RECTANGLES: { shape: string; unit: string; sides: [Side, Side] }[] = [
  { shape: 'A rectangle', unit: 'cm', sides: [{ step: 100, range: [6, 30], accuracy: 'to the nearest cm' }, { step: 100, range: [3, 20], accuracy: 'to the nearest cm' }] },
  { shape: 'A rectangular rug', unit: 'cm', sides: [{ step: 100, range: [90, 240], accuracy: 'to the nearest cm' }, { step: 100, range: [60, 170], accuracy: 'to the nearest cm' }] },
  { shape: 'A rectangular room', unit: 'm', sides: [{ step: 100, range: [3, 12], accuracy: 'to the nearest metre' }, { step: 100, range: [2, 9], accuracy: 'to the nearest metre' }] },
  { shape: 'A rectangular field', unit: 'm', sides: [{ step: 1000, range: [5, 30], accuracy: 'to the nearest 10 m' }, { step: 1000, range: [3, 20], accuracy: 'to the nearest 10 m' }] },
]
/** The 8-9 slot: the two sides rounded to different accuracies. */
const MIXED: { shape: string; unit: string; sides: [Side, Side] }[] = [
  { shape: 'A rectangular table top', unit: 'cm', sides: [{ step: 1000, range: [8, 24], accuracy: 'to the nearest 10 cm' }, { step: 100, range: [45, 95], accuracy: 'to the nearest cm' }] },
  { shape: 'A rectangular garden', unit: 'm', sides: [{ step: 1000, range: [2, 6], accuracy: 'to the nearest 10 m' }, { step: 100, range: [4, 18], accuracy: 'to the nearest metre' }] },
  { shape: 'A rectangular poster', unit: 'cm', sides: [{ step: 1000, range: [4, 12], accuracy: 'to the nearest 10 cm' }, { step: 100, range: [21, 59], accuracy: 'to the nearest cm' }] },
  ...RECTANGLES.slice(0, 2),
]

/** Which bound each written slot asks for: q6 and q7 sit on one sheet, upper then lower. */
const AREA_BOUND: Record<string, 'upper' | 'lower'> = { q6: 'upper', q7: 'lower', q14: 'upper' }

/**
 * Bounds of a rectangle's area: written as q6 (upper) and q7 (lower), 12 cm by 8 cm, and
 * q14 (upper, 15 cm by 6 cm). q14 is the 8-9 slot, where it may round the sides to
 * different accuracies.
 */
export const rectangleAreaBounds: Generator = {
  id: 'rectangle-area-bounds',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q6', 'q7', 'q14'],
  build(r, slot) {
    const which = AREA_BOUND[slot.id] ?? 'upper'
    const shape = pick(r, slot.id === 'q14' ? MIXED : RECTANGLES)
    const [s1, s2] = shape.sides
    const { a, b } = draw(r, (r) => ({ a: int(r, ...s1.range) * s1.step, b: int(r, ...s2.range) * s2.step }), ({ a, b }) => a > b)
    const bounds = (v: number, s: Side) => [v - s.step / 2, v + s.step / 2] as const
    const [aLo, aHi] = bounds(a, s1)
    const [bLo, bHi] = bounds(b, s2)
    const [x, y] = which === 'upper' ? [aHi, bHi] : [aLo, bLo]
    // Hundredths times hundredths is ten-thousandths: exact in whole numbers.
    const answer = Number(show((x * y) / (H * H)))
    // Second route: every pairing of a bound of one side with a bound of the other.
    const corners = [aLo, aHi].flatMap((p) => [bLo, bHi].map((q) => (p * q) / (H * H)))
    const extreme = which === 'upper' ? Math.max(...corners) : Math.min(...corners)
    const same = s1.step === s2.step
    const sideText = same
      ? `${show(a / H)} ${shape.unit} by ${show(b / H)} ${shape.unit}, each ${s1.accuracy}`
      : `${show(a / H)} ${shape.unit} (${s1.accuracy}) by ${show(b / H)} ${shape.unit} (${s2.accuracy})`
    const u = shape.unit
    return {
      question: {
        type: 'numeric',
        prompt: `${shape.shape} is ${sideText}. What is the ${which} bound of its area, in ${u}²?`,
        solution: `The sides lie between ${show(aLo / H)} and ${show(aHi / H)} ${u}, and between ${show(bLo / H)} and ${show(bHi / H)} ${u}. The ${which === 'upper' ? 'largest' : 'smallest'} area uses both ${which} bounds: $${show(x / H)} \\times ${show(y / H)} = ${show(answer)}$ ${u}².`,
        markScheme: scheme(slot, [slot.id === 'q14' ? `finds both ${which} bounds` : `uses both ${which} bounds`, 'multiplies'], show(answer)),
        answer,
        tolerance: 0.01,
        units: `${u}²`,
      },
      check: { agrees: Math.abs(extreme - answer) < 1e-9, detail: `four pairings: ${corners.map((c) => show(c)).join(', ')}; ${which}: ${show(extreme)}` },
      values: { bound: which, a: show(a / H), b: show(b / H), halfA: show(s1.step / 2 / H), halfB: show(s2.step / 2 / H), unit: u },
    }
  },
}

/** Who is moving, how far and how fast, in metres and seconds. */
const MOVERS: { who: string; d: [number, number]; v: [number, number]; dStep: number; dWord: string }[] = [
  { who: 'A car travels', d: [80, 600], v: [10, 30], dStep: 1, dWord: 'to the nearest metre' },
  { who: 'A runner covers', d: [100, 1500], v: [4, 9], dStep: 1, dWord: 'to the nearest metre' },
  { who: 'A cyclist rides', d: [200, 2000], v: [5, 13], dStep: 1, dWord: 'to the nearest metre' },
  { who: 'A swimmer swims', d: [25, 400], v: [1, 2.2], dStep: 1, dWord: 'to the nearest metre' },
  { who: 'A train travels', d: [500, 3000], v: [20, 60], dStep: 10, dWord: 'to the nearest 10 m' },
]
const SPEED_BOUND: Record<string, 'upper' | 'lower'> = { q11: 'upper', q16: 'lower' }

/**
 * Bounds of an average speed: written as q11 (upper, 100 m in 8 s) and q16 (lower, 200 m in
 * 25 s, to 2 decimal places). Both sit on the advanced sheet, upper then lower. The upper
 * bound divides the greatest distance by the shortest time.
 */
export const speedBounds: Generator = {
  id: 'speed-bounds',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q11', 'q16'],
  build(r, slot) {
    const which = SPEED_BOUND[slot.id] ?? 'upper'
    const m = pick(r, MOVERS)
    // In tenths of a metre and of a second, so the bounds are whole numbers.
    const { d, t, value } = draw(
      r,
      (r) => {
        const d = int(r, m.d[0] / m.dStep, m.d[1] / m.dStep) * m.dStep
        const t = int(r, Math.max(4, Math.ceil(d / m.v[1])), Math.floor(d / m.v[0]))
        const dB = which === 'upper' ? d * 10 + m.dStep * 5 : d * 10 - m.dStep * 5
        const tB = which === 'upper' ? t * 10 - 5 : t * 10 + 5
        return { d, t, value: dB / tB }
      },
      // The bound must differ from the stated speed at 2 d.p., or the question hides its own point.
      ({ d, t, value }) => t >= 4 && d / t >= m.v[0] && d / t <= m.v[1] && d % t !== 0 && clearOfHalf(value, 2) && roundTo(value, 2) !== roundTo(d / t, 2),
    )
    const half = m.dStep / 2
    const dLo = d - half
    const dHi = d + half
    const tLo = t - 0.5
    const tHi = t + 0.5
    const [dd, tt] = which === 'upper' ? [dHi, tLo] : [dLo, tHi]
    const answer = roundTo(value, 2)
    // Second route: all four pairings of the bounds, the largest or smallest quotient.
    const corners = [dLo, dHi].flatMap((p) => [tLo, tHi].map((q) => p / q))
    const extreme = which === 'upper' ? Math.max(...corners) : Math.min(...corners)
    const why = which === 'upper' ? 'Fastest is the **greatest distance** over the **shortest time**' : 'Slowest is the **shortest distance** over the **longest time**'
    return {
      question: {
        type: 'numeric',
        prompt: `${m.who} ${d} m ${m.dWord} in ${t} s to the nearest second. What is the ${which} bound of the average speed, in m/s to 2 decimal places?`,
        solution: `The distance lies between ${show(dLo)} and ${show(dHi)} m, and the time between ${show(tLo)} and ${show(tHi)} s. ${why}: $\\dfrac{${show(dd)}}{${show(tt)}} = ${fixed(value, 2)}$ m/s to 2 d.p.`,
        markScheme: scheme(slot, which === 'upper' ? ['upper distance', 'over lower time'] : ['lower distance', 'over upper time'], fixed(value, 2)),
        answer,
        tolerance: 0.01,
        units: 'm/s',
      },
      check: { agrees: roundTo(extreme, 2) === answer, detail: `four pairings: ${corners.map((c) => c.toFixed(4)).join(', ')}` },
      values: { bound: which, d, t, half: show(half), distanceUsed: show(dd), timeUsed: show(tt) },
    }
  },
}

export const boundsGenerators: Generator[] = [upperBound, rectangleAreaBounds, speedBounds]
