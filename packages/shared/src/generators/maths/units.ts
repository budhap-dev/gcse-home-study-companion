import { show } from '../format.ts'
import { draw, int, pick } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'

const TOPIC = 'units-conversion-and-estimation'

/** Whether `x` has at most `dp` decimal places, allowing for binary residue. */
const places = (x: number, dp: number) => Math.abs(x * 10 ** dp - Math.round(x * 10 ** dp)) < 1e-6
/** A whole number from lo × f to hi × f, for ranges written in decimals: 1.1 × 10 is not 11 in floating point. */
const scaled = (r: () => number, lo: number, hi: number, f: number) => int(r, Math.ceil(lo * f - 1e-9), Math.floor(hi * f + 1e-9))
/** A number with a thin space in its thousands, as the pack prints 10\,000 in maths. */
const thin = (n: number) => (Number.isInteger(n) && Math.abs(n) >= 10000 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : show(n))

/**
 * A number as a whole-number mantissa and a power of ten: 2.75 is 275 × 10⁻². Moving the
 * decimal point is then whole-number arithmetic, the second route for every metric change.
 */
function shift(x: number, power: number): number {
  let dp = 0
  while (!places(x, dp)) dp++
  const mantissa = Math.round(x * 10 ** dp)
  const p = power - dp
  return p >= 0 ? mantissa * 10 ** p : Number(show(mantissa / 10 ** -p))
}

interface Unit {
  symbol: string
  name: string
  /** Size as a power of ten of the base unit (metre, gram, litre). */
  power: number
}
const U = {
  mm: { symbol: 'mm', name: 'millimetres', power: -3 },
  cm: { symbol: 'cm', name: 'centimetres', power: -2 },
  m: { symbol: 'm', name: 'metres', power: 0 },
  km: { symbol: 'km', name: 'kilometres', power: 3 },
  g: { symbol: 'g', name: 'grams', power: 0 },
  kg: { symbol: 'kg', name: 'kilograms', power: 3 },
  t: { symbol: 'tonnes', name: 'tonnes', power: 6 },
  ml: { symbol: 'ml', name: 'millilitres', power: -3 },
  cl: { symbol: 'cl', name: 'centilitres', power: -2 },
  l: { symbol: 'litres', name: 'litres', power: 0 },
} satisfies Record<string, Unit>

const BASE_NAME: Record<string, string> = { mm: 'a millimetre', cm: 'a centimetre', m: 'a metre', km: 'a kilometre', g: 'a gram', kg: 'a kilogram', tonnes: 'a tonne', ml: 'a millilitre', cl: 'a centilitre', litres: 'a litre' }

/** Bigger to smaller (q1), smaller to bigger (q2), and capacity either way (q4). */
const PAIRS: Record<string, [Unit, Unit][]> = {
  q1: [[U.km, U.m], [U.m, U.cm], [U.m, U.mm], [U.cm, U.mm], [U.kg, U.g], [U.t, U.kg]],
  q2: [[U.cm, U.m], [U.m, U.km], [U.mm, U.cm], [U.mm, U.m], [U.g, U.kg], [U.kg, U.t]],
  q4: [[U.l, U.ml], [U.ml, U.l], [U.l, U.ml], [U.ml, U.l], [U.l, U.cl], [U.cl, U.ml]],
}

/**
 * One metric change: written as q1 (2.75 km to metres), q2 (450 cm to metres) and q4 (1.25
 * litres to millilitres), all on the core sheet. Each slot keeps its own kind: q1 goes to a
 * smaller unit, q2 to a bigger one, q4 is a capacity.
 */
export const metricConversion: Generator = {
  id: 'metric-conversion',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q1', 'q2', 'q4'],
  build(r, slot): Draft {
    const [from, to] = pick(r, PAIRS[slot.id] ?? PAIRS.q1!)
    const gap = from.power - to.power
    const factor = 10 ** Math.abs(gap)
    const bigger = gap > 0
    // To a smaller unit: a whole-number answer from a decimal; to a bigger one, a decimal answer.
    const { v, answer } = draw(
      r,
      (r) => {
        if (bigger) {
          const answer = int(r, Math.ceil(factor * 0.2), factor * 9)
          return { answer, v: Number(show(answer / factor)) }
        }
        const v = int(r, Math.ceil(factor * 0.15), factor * 12)
        return { v, answer: Number(show(v / factor)) }
      },
      ({ v, answer }) => !Number.isInteger(bigger ? v : answer) && places(bigger ? v : answer, 3),
    )
    const op = bigger ? `${show(v)} \\times ${factor} = ${show(answer)}` : `${show(v)} \\div ${factor} = ${show(answer)}`
    // Second route: move the decimal point through the base unit, in whole numbers.
    const viaBase = shift(shift(v, from.power), -to.power)
    return {
      question: {
        type: 'numeric',
        prompt: `Convert ${show(v)} ${from.name === 'litres' || from.name === 'tonnes' ? from.name : from.symbol} to ${to.name}.`,
        solution: `There are ${factor} ${(bigger ? to : from).symbol} in ${BASE_NAME[(bigger ? from : to).symbol]}. ${cap(BASE_NAME[to.symbol]!)} is ${bigger ? 'smaller, so multiply' : 'bigger, so divide'}: $${op}$ ${to.symbol}.`,
        markScheme: scheme(slot, [], show(answer)),
        answer,
        tolerance: 0,
        units: to.symbol,
      },
      check: { agrees: Math.abs(viaBase - answer) < 1e-9, detail: `through the base unit: ${show(v)} ${from.symbol} = ${show(shift(v, from.power))}, then ${show(viaBase)} ${to.symbol}` },
      values: { from: from.symbol, to: to.symbol, v },
    }
  },
}

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)

/** What lasts a decimal number of hours, and for how long. */
const DURATIONS: { text: (h: string) => string; hours: [number, number] }[] = [
  { text: (h) => `A film lasts ${h} hours.`, hours: [1.2, 3.4] },
  { text: (h) => `A train journey takes ${h} hours.`, hours: [0.6, 5.9] },
  { text: (h) => `A flight lasts ${h} hours.`, hours: [1.1, 11.9] },
  { text: (h) => `Priya revises for ${h} hours.`, hours: [0.4, 3.9] },
  { text: (h) => `A walk takes ${h} hours.`, hours: [1.1, 6.9] },
  { text: (h) => `A shift at a café lasts ${h} hours.`, hours: [3.1, 9.9] },
]

/** A decimal number of hours in minutes: written as q6 (1.6 hours is 96 minutes, 2 marks). */
export const hoursToMinutes: Generator = {
  id: 'hours-to-minutes',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q6'],
  build(r, slot): Draft {
    const d = pick(r, DURATIONS)
    // In hundredths of an hour: tenths, and quarters, which give whole minutes.
    const hh = draw(
      r,
      (r) => (r() < 0.75 ? scaled(r, d.hours[0], d.hours[1], 10) * 10 : scaled(r, d.hours[0], d.hours[1], 4) * 25),
      (hh) => hh % 100 !== 0 && hh % 50 !== 0,
    )
    const h = hh / 100
    const answer = Number(show(h * 60))
    const whole = Math.floor(h)
    // Second route: whole hours and the hundredths of an hour separately, in whole numbers.
    const mins = whole * 60 + ((hh % 100) * 60) / 100
    const left = answer - whole * 60
    const digits = String(hh % 100).padStart(2, '0')
    const hours = (n: number) => (n === 1 ? '1 hour' : `${n} hours`)
    const misread = whole > 0 ? `${hours(whole)} ${Number(digits)} minutes` : `${Number(digits)} minutes`
    const read = whole > 0 ? `${hours(whole)} ${left} minutes` : `${left} minutes`
    return {
      question: {
        type: 'numeric',
        prompt: `${d.text(show(h))} How many minutes is that?`,
        solution: `An hour is 60 minutes, so $${show(h)} \\times 60 = ${show(answer)}$ minutes (${read}, not ${misread}).`,
        markScheme: scheme(slot, [`${show(h)} × 60`], show(answer)),
        answer,
        tolerance: 0,
        units: 'minutes',
      },
      check: { agrees: Number.isInteger(mins) && mins === answer && left !== Number(digits), detail: `${whole} × 60 + ${hh % 100}/100 of 60 = ${show(mins)}` },
      values: { hours: show(h) },
    }
  },
}

/** Area units: the length factor squared. */
const AREA: Record<string, number> = { 'mm²': 0, 'cm²': 2, 'm²': 6 }
const AREA_CASES: { from: string; to: string; side: string }[] = [
  { from: 'cm²', to: 'm²', side: '100 cm by 100 cm' },
  { from: 'm²', to: 'cm²', side: '100 cm by 100 cm' },
  { from: 'mm²', to: 'cm²', side: '10 mm by 10 mm' },
  { from: 'cm²', to: 'mm²', side: '10 mm by 10 mm' },
]

/** The things that press on a floor, and their pressures in N/cm². */
const PRESSURES: { what: string; p: [number, number] }[] = [
  { what: 'A crate presses on the floor', p: [0.5, 9] },
  { what: 'A wardrobe presses on the floor', p: [0.5, 6] },
  { what: 'An elephant’s foot presses on the ground', p: [12, 30] },
  { what: 'A table leg presses on the floor', p: [2, 25] },
  { what: 'A stack of books presses on a shelf', p: [0.2, 3] },
  { what: 'A walking boot presses on the ground', p: [1, 8] },
]

/**
 * Area units and a rate per area: written as q7 (6800 cm² to m², 2 marks) and q24 (3 N/cm²
 * to N/m², 2 marks). Both turn on 1 m² being 10 000 cm², not 100.
 */
export const areaUnits: Generator = {
  id: 'area-units',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q7', 'q24'],
  build(r, slot): Draft {
    if (slot.id === 'q24') {
      const c = pick(r, PRESSURES)
      const toBig = r() < 0.6
      const p = scaled(r, c.p[0], c.p[1], 10) / 10
      const perM2 = Number(show(p * 10000))
      const [given, unitIn, unitOut, answer] = toBig ? [p, 'N/cm²', 'N/m²', perM2] : [perM2, 'N/m²', 'N/cm²', p]
      const solution = toBig
        ? `The bottom unit is an area. 1 m² is $100 \\times 100 = 10\\,000$ cm², so a square metre carries $10\\,000$ times the force on one square centimetre: $${show(p)} \\times 10\\,000 = ${show(perM2)}$ N/m². A square metre is bigger, so the number per m² must be bigger.`
        : `The bottom unit is an area. 1 m² is $100 \\times 100 = 10\\,000$ cm², so one square centimetre carries a ten-thousandth of the force on a square metre: $${thin(perM2)} \\div 10\\,000 = ${show(p)}$ N/cm². A square centimetre is smaller, so the number per cm² must be smaller.`
      // Second route: one square centimetre is 0.0001 m², and pressure is force over area.
      const other = toBig ? p / 0.0001 : perM2 * 0.0001
      return {
        question: {
          type: 'numeric',
          prompt: `${c.what} with a pressure of ${toBig ? show(given) : thinText(given)} ${unitIn}. What is this pressure in ${unitOut}?`,
          solution,
          markScheme: scheme(slot, ['1 m² = 10 000 cm²'], show(answer)),
          answer,
          tolerance: 0,
          units: unitOut,
        },
        check: { agrees: Math.abs(other - answer) < 1e-6, detail: `1 cm² = 0.0001 m²: ${show(other)} ${unitOut}` },
        values: { kind: toBig ? 'N/cm² to N/m²' : 'N/m² to N/cm²', p, given },
      }
    }
    const c = pick(r, AREA_CASES)
    const gap = AREA[c.from]! - AREA[c.to]!
    const factor = 10 ** Math.abs(gap)
    const bigger = gap > 0
    // To the smaller unit, a decimal with up to 2 places is multiplied; to the bigger one, a
    // whole number is divided and comes out with up to 2 places.
    const { v, answer } = draw(
      r,
      (r) => {
        if (bigger) {
          const v = factor === 100 ? int(r, 5, 500) / 10 : int(r, 5, 2000) / 100
          return { v, answer: Number(show(v * factor)) }
        }
        const v = factor === 100 ? int(r, 50, 5000) : int(r, 5, 900) * 100
        return { v, answer: Number(show(v / factor)) }
      },
      ({ v, answer }) => !Number.isInteger(bigger ? v : answer) && places(bigger ? v : answer, 2),
    )
    const big = c.from === 'm²' || c.to === 'm²' ? 'm²' : 'cm²'
    const small = big === 'm²' ? 'cm²' : 'mm²'
    const f = thin(factor)
    const solution = `1 ${big} is ${c.side}, which is $${c.side.split(' ')[0]} \\times ${c.side.split(' ')[0]} = ${f}$ ${small}, and ${c.to} is the ${bigger ? 'smaller unit, so multiply' : 'bigger unit, so divide'}: $${thin(v)} ${bigger ? '\\times' : '\\div'} ${f} = ${show(answer)}$ ${c.to}.`
    // Second route: through square millimetres, moving the decimal point in whole numbers.
    const viaMm = shift(shift(v, AREA[c.from]!), -AREA[c.to]!)
    return {
      question: {
        type: 'numeric',
        prompt: `Convert ${thinText(v)} ${c.from} to ${c.to}.`,
        solution,
        markScheme: scheme(slot, [`${bigger ? 'multiplies' : 'divides'} by ${factor === 10000 ? '10 000' : factor}`], show(answer)),
        answer,
        tolerance: 0,
        units: c.to,
      },
      check: { agrees: Math.abs(viaMm - answer) < 1e-9 && factor === (c.side.startsWith('100') ? 10000 : 100), detail: `through mm²: ${show(viaMm)} ${c.to}` },
      values: { from: c.from, to: c.to, v },
    }
  },
}

/** A large whole number in running text, with a space in its thousands: 25 000. */
const thinText = (n: number) => (Number.isInteger(n) && n >= 10000 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : show(n))

const TANKS: { text: string; m3: [number, number] }[] = [
  { text: 'A tank holds', m3: [0.2, 2.5] },
  { text: 'A garden pond holds', m3: [0.4, 3] },
  { text: 'A hot tub holds', m3: [0.8, 1.6] },
  { text: 'A water butt holds', m3: [0.1, 0.35] },
  { text: 'An aquarium holds', m3: [0.05, 0.6] },
]
const CUBOIDS: { text: string; held: string; dims: [[number, number], [number, number], [number, number]] }[] = [
  { text: 'A fish tank is a cuboid', held: 'of water does it hold when full', dims: [[40, 120], [25, 50], [25, 60]] },
  { text: 'A storage box is a cuboid', held: 'does it hold', dims: [[30, 80], [20, 50], [15, 40]] },
  { text: 'A water trough is a cuboid', held: 'of water does it hold when full', dims: [[80, 200], [30, 60], [30, 50]] },
  { text: 'A paddling pool is a cuboid', held: 'of water does it hold when full', dims: [[100, 220], [80, 160], [20, 40]] },
  { text: 'A planter is a cuboid', held: 'of compost does it take to fill it', dims: [[40, 120], [20, 40], [20, 40]] },
]

/**
 * Volume and capacity: written as q8 (0.3 m³ in litres, 2 marks) and q12 (a 60 by 40 by 25 cm
 * tank in litres, 3 marks), on the higher sheet. Each slot keeps its own task.
 */
export const capacityAndVolume: Generator = {
  id: 'capacity-and-volume',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q8', 'q12'],
  build(r, slot): Draft {
    if (slot.id === 'q12') {
      const c = pick(r, CUBOIDS)
      const [l, w, h] = draw(r, (r) => c.dims.map(([lo, hi]) => scaled(r, lo, hi, 0.2) * 5), ([l, w, h]) => l! > w! && (l! * w! * h!) % 100 === 0)
      const cm3 = l! * w! * h!
      const answer = Number(show(cm3 / 1000))
      // Second route: each length in decimetres; a cubic decimetre is a litre.
      const dm = (l! / 10) * (w! / 10) * (h! / 10)
      return {
        question: {
          type: 'numeric',
          prompt: `${c.text} ${l} cm long, ${w} cm wide and ${h} cm high. How many litres ${c.held}?`,
          solution: `Volume $= ${l} \\times ${w} \\times ${h} = ${thin(cm3)}$ cm³. There are 1000 cm³ in a litre, so it holds $${thin(cm3)} \\div 1000 = ${show(answer)}$ litres.`,
          markScheme: scheme(slot, [`${thinText(cm3)} cm³`, 'divides by 1000'], show(answer)),
          answer,
          tolerance: 0,
          units: 'litres',
        },
        check: { agrees: Math.abs(dm - answer) < 1e-9, detail: `in decimetres: ${show(l! / 10)} × ${show(w! / 10)} × ${show(h! / 10)} = ${show(dm)} litres` },
        values: { l: l!, w: w!, h: h! },
      }
    }
    const c = pick(r, TANKS)
    const toLitres = r() < 0.6
    const m3 = draw(r, (r) => scaled(r, c.m3[0], c.m3[1], 100) / 100, (m) => !Number.isInteger(m))
    const litres = Number(show(m3 * 1000))
    // Second route: through cubic centimetres, a million to a cubic metre and a thousand to a litre.
    const viaCm3 = Math.round(m3 * 100) * 10000 / 1000
    const answer = toLitres ? litres : m3
    return {
      question: {
        type: 'numeric',
        prompt: toLitres ? `${c.text} ${show(m3)} m³ of water. How many litres is that?` : `${c.text} ${litres} litres of water. How many m³ is that?`,
        solution: toLitres
          ? `1 m³ is 1000 litres, so $${show(m3)} \\times 1000 = ${show(litres)}$ litres.`
          : `1 m³ is 1000 litres, and m³ is the bigger unit, so divide: $${show(litres)} \\div 1000 = ${show(m3)}$ m³.`,
        markScheme: scheme(slot, ['1 m³ = 1000 litres'], show(answer)),
        answer,
        tolerance: 0,
        units: toLitres ? 'litres' : 'm³',
      },
      check: { agrees: viaCm3 === litres, detail: `${show(m3)} m³ = ${thinText(Math.round(m3 * 100) * 10000)} cm³ = ${show(viaCm3)} litres` },
      values: { direction: toLitres ? 'm³ to litres' : 'litres to m³', m3 },
    }
  },
}

/** Moving things and realistic speeds, in km/h and m/s. */
const KMH: { who: string; kmh: [number, number] }[] = [
  { who: 'A train travels', kmh: [72, 324] },
  { who: 'A car is driving', kmh: [27, 117] },
  { who: 'A plane flies', kmh: [540, 900] },
  { who: 'A cyclist rides', kmh: [18, 45] },
  { who: 'A horse gallops', kmh: [27, 63] },
  { who: 'A coach travels', kmh: [45, 108] },
]
const MS: { who: string; ms: [number, number] }[] = [
  { who: 'A sprinter runs', ms: [6, 11] },
  { who: 'A cyclist rides', ms: [5, 14] },
  { who: 'A car is driving', ms: [9, 33] },
  { who: 'A train travels', ms: [20, 90] },
  { who: 'A plane flies', ms: [150, 250] },
  { who: 'A greyhound runs', ms: [14, 19] },
]
/** Pairs to compare: one timed in m/s, the other in km/h, close enough to make it a question. */
const RACES: { a: string; A: string; ms: [number, number]; b: string; B: string; kmh: [number, number] }[] = [
  { a: 'A cheetah is timed running at', A: 'cheetah', ms: [25, 31], b: 'A car is travelling at', B: 'car', kmh: [80, 112] },
  { a: 'A sprinter is timed running at', A: 'sprinter', ms: [8, 11], b: 'A cyclist is riding at', B: 'cyclist', kmh: [25, 42] },
  { a: 'A greyhound is timed running at', A: 'greyhound', ms: [15, 19], b: 'A racehorse is galloping at', B: 'racehorse', kmh: [52, 70] },
  { a: 'A swift is timed flying at', A: 'swift', ms: [25, 31], b: 'A motorbike is travelling at', B: 'motorbike', kmh: [80, 115] },
  { a: 'A peregrine falcon is timed diving at', A: 'falcon', ms: [80, 100], b: 'A high-speed train is travelling at', B: 'train', kmh: [270, 330] },
]

/**
 * Speed units: written as q9 (108 km/h in m/s, 2 marks) and q17 (a cheetah at 30 m/s against a
 * car at 100 km/h, 2 marks). q9 goes either way between km/h and m/s; q17 compares.
 */
export const speedUnits: Generator = {
  id: 'speed-units',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q9', 'q17'],
  build(r, slot): Draft {
    if (slot.id === 'q17') {
      const c = pick(r, RACES)
      // In tenths of a km/h, so the difference is exact: v m/s is 36v tenths of a km/h.
      const { v, k } = draw(r, (r) => ({ v: int(r, ...c.ms), k: int(r, ...c.kmh) }), ({ v, k }) => Math.abs(v * 36 - k * 10) >= 10 && v * 36 !== k * 10)
      const converted = Number(show((v * 36) / 10))
      const aFaster = v * 36 > k * 10
      const answer = Number(show(Math.abs(v * 36 - k * 10) / 10))
      const { A, B } = c
      const [fast, slow] = aFaster ? [A, B] : [B, A]
      // Second route: the km/h speed in m/s, the difference in m/s, then back to km/h.
      const kInMs = (k * 1000) / 3600
      const viaMs = Math.abs(v - kInMs) * 3.6
      return {
        question: {
          type: 'numeric',
          prompt: `${c.a} ${v} m/s. ${c.b} ${k} km/h. How many km/h faster than the ${slow} is the ${fast}?`,
          solution: `Put both in km/h: $${v} \\times 3.6 = ${show(converted)}$ km/h. The ${fast} is $${aFaster ? `${show(converted)} - ${k}` : `${k} - ${show(converted)}`} = ${show(answer)}$ km/h faster.`,
          markScheme: scheme(slot, [`${v} × 3.6 = ${show(converted)}`], show(answer)),
          answer,
          tolerance: 0,
          units: 'km/h',
        },
        check: { agrees: Math.abs(viaMs - answer) < 1e-9, detail: `${k} km/h = ${kInMs.toFixed(4)} m/s; difference ${Math.abs(v - kInMs).toFixed(4)} m/s × 3.6 = ${show(viaMs)}` },
        values: { kind: 'compare', v, k, faster: fast },
      }
    }
    const toMs = r() < 0.6
    if (toMs) {
      const c = pick(r, KMH)
      // A multiple of 9 km/h is a multiple of 2.5 m/s, so the answer ends cleanly.
      const k = draw(r, (r) => int(r, Math.ceil(c.kmh[0] / 9), Math.floor(c.kmh[1] / 9)) * 9, (k) => k >= c.kmh[0])
      const answer = Number(show(k / 3.6))
      const metres = k * 1000
      // Second route: whole metres per hour, then whole seconds in an hour.
      const viaChain = metres / 3600
      return {
        question: {
          type: 'numeric',
          prompt: `${c.who} at ${k} km/h. What is this speed in m/s?`,
          solution: `${k} km is $${thin(metres)}$ m and an hour is 3600 s: $${thin(metres)} \\div 3600 = ${show(answer)}$ m/s. Or $${k} \\div 3.6 = ${show(answer)}$.`,
          markScheme: scheme(slot, [`${thinText(metres)} ÷ 3600, or ${k} ÷ 3.6`], show(answer)),
          answer,
          tolerance: 0,
          units: 'm/s',
        },
        check: { agrees: Math.abs(viaChain - answer) < 1e-9, detail: `${metres} m ÷ 3600 s = ${show(viaChain)}` },
        values: { kind: 'km/h to m/s', k },
      }
    }
    const c = pick(r, MS)
    const v = int(r, ...c.ms)
    const answer = Number(show((v * 36) / 10))
    const perHour = v * 3600
    const viaChain = perHour / 1000
    return {
      question: {
        type: 'numeric',
        prompt: `${c.who} at ${v} m/s. What is this speed in km/h?`,
        solution: `In an hour of 3600 s it goes $${v} \\times 3600 = ${thin(perHour)}$ m, which is $${thin(perHour)} \\div 1000 = ${show(answer)}$ km. So ${show(answer)} km/h. Or $${v} \\times 3.6 = ${show(answer)}$.`,
        markScheme: scheme(slot, [`${v} × 3600 ÷ 1000, or ${v} × 3.6`], show(answer)),
        answer,
        tolerance: 0,
        units: 'km/h',
      },
      check: { agrees: Math.abs(viaChain - answer) < 1e-9, detail: `${v} × 3600 = ${perHour} m an hour, ÷ 1000 = ${show(viaChain)}` },
      values: { kind: 'm/s to km/h', v },
    }
  },
}

/** Materials with densities in g/cm³, to 2 decimal places. */
const MATERIALS: { name: string; d: [number, number] }[] = [
  { name: 'A plastic', d: [0.9, 1.45] },
  { name: 'A type of wood', d: [0.4, 0.9] },
  { name: 'A type of glass', d: [2.4, 2.8] },
  { name: 'A type of stone', d: [2.3, 2.9] },
  { name: 'A type of rubber', d: [1.1, 1.5] },
  { name: 'A type of cork', d: [0.12, 0.25] },
]
const METALS: { name: string; d: number; v: [number, number] }[] = [
  { name: 'steel', d: 7.8, v: [5, 60] },
  { name: 'copper', d: 8.9, v: [2, 30] },
  { name: 'aluminium', d: 2.7, v: [5, 80] },
  { name: 'iron', d: 7.9, v: [5, 50] },
  { name: 'brass', d: 8.5, v: [2, 30] },
  { name: 'lead', d: 11.3, v: [1, 20] },
  { name: 'titanium', d: 4.5, v: [2, 40] },
]
const OBJECTS: [string, string][] = [['A metal bar', 'bar'], ['A metal beam', 'beam'], ['A solid metal block', 'block'], ['A metal plate', 'plate']]

/**
 * Density units: written as q10 (1.3 g/cm³ in kg/m³, 2 marks) and q16 (the mass in kg of a
 * 0.02 m³ bar at 8.9 g/cm³, 3 marks).
 */
export const densityUnits: Generator = {
  id: 'density-units',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q10', 'q16'],
  build(r, slot): Draft {
    if (slot.id === 'q16') {
      const metal = pick(r, METALS)
      // Thousandths of a cubic metre: 0.002 to 0.08 m³.
      const vt = int(r, ...metal.v)
      const object = pick(r, OBJECTS)
      const V = vt / 1000
      const perM3 = Number(show(metal.d * 1000))
      const answer = Number(show((Math.round(metal.d * 10) * vt) / 10))
      // Second route: the volume in cm³, the mass in grams, then kilograms, in whole numbers.
      const cm3 = vt * 1000
      const grams = (Math.round(metal.d * 10) * cm3) / 10
      const viaGrams = grams / 1000
      return {
        question: {
          type: 'numeric',
          prompt: `${object[0]} has a volume of ${show(V)} m³. The metal is ${metal.name}, with a density of ${show(metal.d)} g/cm³. Find the mass of the ${object[1]} in kg.`,
          solution: `Change the density to match the volume: ${show(metal.d)} g/cm³ is $${show(metal.d)} \\times 1000 = ${show(perM3)}$ kg/m³. Mass $= ${show(perM3)} \\times ${show(V)} = ${show(answer)}$ kg.`,
          markScheme: scheme(slot, [`${show(perM3)} kg/m³, or ${thinText(cm3)} cm³`, 'density × volume'], show(answer)),
          answer,
          tolerance: 0,
          units: 'kg',
        },
        check: { agrees: Math.abs(viaGrams - answer) < 1e-9, detail: `${cm3} cm³ × ${show(metal.d)} g = ${show(grams)} g = ${show(viaGrams)} kg` },
        values: { metal: metal.name, V: show(V) },
      }
    }
    const m = pick(r, MATERIALS)
    const toKg = r() < 0.6
    const hd = draw(r, (r) => scaled(r, m.d[0], m.d[1], 100), (hd) => hd % 100 !== 0)
    const d = hd / 100
    const perM3 = hd * 10
    const answer = toKg ? perM3 : d
    // Second route: a cubic metre is a million cm³, so a million times the grams, then kg.
    const grams = hd * 10000
    const viaChain = grams / 1000
    return {
      question: {
        type: 'numeric',
        prompt: toKg ? `${m.name} has a density of ${show(d)} g/cm³. What is its density in kg/m³?` : `${m.name} has a density of ${perM3} kg/m³. What is its density in g/cm³?`,
        solution: toKg
          ? `A cubic metre holds $1\\,000\\,000$ cm³, so it has $${show(d)} \\times 1\\,000\\,000 = ${thin(grams)}$ g, which is $${thin(grams)} \\div 1000 = ${perM3}$ kg. So ${perM3} kg/m³.`
          : `A cubic metre holds $1\\,000\\,000$ cm³, and ${perM3} kg is $${thin(grams)}$ g, so each cm³ has $${thin(grams)} \\div 1\\,000\\,000 = ${show(d)}$ g. So ${show(d)} g/cm³: in short, divide by 1000.`,
        markScheme: scheme(slot, [toKg ? 'multiplies by 1 000 000 and divides by 1000, or multiplies by 1000' : 'multiplies by 1000 and divides by 1 000 000, or divides by 1000'], show(answer)),
        answer,
        tolerance: 0,
        units: toKg ? 'kg/m³' : 'g/cm³',
      },
      check: { agrees: viaChain === perM3 && Math.abs(d * 1000 - perM3) < 1e-9, detail: `${show(d)} × 1 000 000 = ${grams} g, ÷ 1000 = ${show(viaChain)} kg in a m³` },
      values: { direction: toKg ? 'to kg/m³' : 'to g/cm³', d: show(d) },
    }
  },
}

const FLOWS: { what: string; per: 'minute' | 'hour'; units: string; range: [number, number] }[] = [
  { what: 'A tap delivers water at', per: 'minute', units: 'litres per minute', range: [4.5, 15] },
  { what: 'A shower uses water at', per: 'minute', units: 'litres per minute', range: [6, 15] },
  { what: 'A garden hose delivers water at', per: 'minute', units: 'litres per minute', range: [9, 30] },
  { what: 'A fuel pump delivers petrol at', per: 'minute', units: 'litres per minute', range: [30, 45] },
  { what: 'A fire hose delivers water at', per: 'minute', units: 'litres per minute', range: [300, 900] },
  { what: 'A dripping gutter leaks water at', per: 'hour', units: 'litres per hour', range: [0.6, 6] },
  { what: 'A slow-fill valve lets water into a cistern at', per: 'hour', units: 'litres per hour', range: [15, 90] },
]
const POOLS: { what: string; m3: [number, number]; rate: [number, number] }[] = [
  { what: 'A garden pond holds', m3: [0.6, 3], rate: [6, 20] },
  { what: 'A paddling pool holds', m3: [0.3, 1.2], rate: [5, 15] },
  { what: 'A hot tub holds', m3: [0.8, 1.6], rate: [8, 25] },
  { what: 'A fish pond holds', m3: [1.5, 6], rate: [10, 30] },
  { what: 'A water storage tank holds', m3: [0.5, 4], rate: [8, 40] },
  { what: 'A small swimming pool holds', m3: [8, 30], rate: [40, 120] },
  { what: 'A garden water feature holds', m3: [0.2, 0.9], rate: [4, 12] },
]
const PIPES: { what: string; v: [number, number]; a: [number, number] }[] = [
  { what: 'Water flows along a pipe', v: [0.3, 2.5], a: [5, 60] },
  { what: 'Water flows through a hosepipe', v: [0.5, 3], a: [2, 5] },
  { what: 'Water flows along a drainage pipe', v: [0.2, 1.5], a: [50, 300] },
  { what: 'Oil flows along a pipe', v: [0.5, 2], a: [10, 80] },
]

/**
 * Rates of flow: written as q14 (12 litres a minute in cm³ a second), q15 (how many hours a
 * hose at 8 litres a minute takes to fill a 1.2 m³ pond) and q21 (litres a minute from a
 * pipe, from the speed of the water and the pipe's cross-section), all 3 marks on the
 * advanced sheet. Each slot keeps its own task.
 */
export const flowRates: Generator = {
  id: 'flow-rates',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q14', 'q15', 'q21'],
  build(r, slot): Draft {
    if (slot.id === 'q15') {
      const c = pick(r, POOLS)
      const { m3, rate, minutes } = draw(
        r,
        (r) => {
          // In twentieths of a cubic metre, 50 litres each.
          const m3 = scaled(r, c.m3[0], c.m3[1], 20) / 20
          const rate = int(r, ...c.rate)
          return { m3, rate, minutes: (Math.round(m3 * 20) * 50) / rate }
        },
        // Whole minutes that make a tenth or a quarter of an hour, and not a whole number of hours.
        ({ minutes }) => Number.isInteger(minutes) && (minutes % 6 === 0 || minutes % 15 === 0) && minutes % 60 !== 0 && minutes >= 30 && minutes <= 900,
        2000,
      )
      const litres = Number(show(m3 * 1000))
      const answer = Number(show(minutes / 60))
      // Second route: the hose's rate in m³ an hour, then the volume over the rate.
      const perHour = (rate * 60) / 1000
      const viaRate = m3 / perHour
      return {
        question: {
          type: 'numeric',
          prompt: `${c.what} ${show(m3)} m³ of water. A hose fills it at ${rate} litres per minute. How many hours does it take to fill it from empty?`,
          solution: `${show(m3)} m³ is $${show(m3)} \\times 1000 = ${litres}$ litres. At ${rate} litres a minute that takes $${litres} \\div ${rate} = ${minutes}$ minutes, which is $${minutes} \\div 60 = ${show(answer)}$ hours.`,
          markScheme: scheme(slot, [`${litres} litres`, `${minutes} minutes`], show(answer)),
          answer,
          tolerance: 0,
          units: 'hours',
        },
        check: { agrees: Math.abs(viaRate - answer) < 1e-9, detail: `${rate} l/min is ${show(perHour)} m³ an hour; ${show(m3)} ÷ ${show(perHour)} = ${show(viaRate)} hours` },
        values: { kind: 'fill time', m3, rate },
      }
    }
    if (slot.id === 'q21') {
      const c = pick(r, PIPES)
      const { v, a } = draw(r, (r) => ({ v: scaled(r, c.v[0], c.v[1], 10) / 10, a: int(r, ...c.a) }), ({ v }) => !Number.isInteger(v))
      const cms = Math.round(v * 100)
      const perSecond = cms * a
      const litresPerSecond = Number(show(perSecond / 1000))
      const answer = Number(show((perSecond * 60) / 1000))
      // Second route: in metres. The area is a/10 000 m², the volume each second v × that in m³.
      const viaMetres = v * (a / 10000) * 1000 * 60
      const liquid = c.what.split(' ')[0]!.toLowerCase()
      return {
        question: {
          type: 'numeric',
          prompt: `${c.what} at ${show(v)} m/s. The area of the cross-section of the pipe is ${a} cm². How many litres of ${liquid} flow out of the pipe each minute?`,
          solution: `${show(v)} m/s is ${cms} cm/s, so each second a column of ${liquid} ${cms} cm long and ${a} cm² in cross-section comes out: $${cms} \\times ${a} = ${thin(perSecond)}$ cm³, which is ${show(litresPerSecond)} litres. In a minute that is $${show(litresPerSecond)} \\times 60 = ${show(answer)}$ litres.`,
          markScheme: scheme(slot, [`${cms} cm/s`, `${thinText(perSecond)} cm³ each second`], show(answer)),
          answer,
          tolerance: 0,
          units: 'litres',
        },
        check: { agrees: Math.abs(viaMetres - answer) < 1e-9, detail: `${show(v)} × ${show(a / 10000)} m² = ${show(v * (a / 10000))} m³ a second; × 1000 × 60 = ${show(viaMetres)}` },
        values: { kind: 'pipe', v, a },
      }
    }
    const c = pick(r, FLOWS)
    // A multiple of 0.3 litres gives a whole number of cm³ per second or per minute.
    const l3 = scaled(r, c.range[0], c.range[1], 10 / 3)
    const L = Number(show((l3 * 3) / 10))
    // 0.3 litres is 300 cm³, so whole numbers throughout.
    const cm3 = l3 * 300
    const answer = cm3 / 60
    const small = c.per === 'minute' ? 'second' : 'minute'
    // Second route: how long one litre takes to come out, and 1000 cm³ over that time.
    const perLitre = 60 / L
    const viaLitre = 1000 / perLitre
    return {
      question: {
        type: 'numeric',
        prompt: `${c.what} ${show(L)} ${c.units}. What is this rate in cm³ per ${small}?`,
        solution: `${show(L)} litres is $${show(L)} \\times 1000 = ${thin(cm3)}$ cm³, and a ${c.per} is 60 ${small}s. So the rate is $${thin(cm3)} \\div 60 = ${show(answer)}$ cm³ per ${small}.`,
        markScheme: scheme(slot, [`${thinText(cm3)} cm³`, 'divides by 60'], show(answer)),
        answer,
        tolerance: 0,
        units: `cm³/${small === 'second' ? 's' : 'min'}`,
      },
      check: { agrees: Number.isInteger(answer) && Math.abs(viaLitre - answer) < 1e-9, detail: `one litre takes ${show(perLitre)} ${small}s; 1000 ÷ ${show(perLitre)} = ${show(viaLitre)}` },
      values: { kind: 'rate', L, per: c.per },
    }
  },
}

export const unitsGenerators: Generator[] = [metricConversion, hoursToMinutes, areaUnits, capacityAndVolume, speedUnits, densityUnits, flowRates]
