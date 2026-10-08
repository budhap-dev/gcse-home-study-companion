import { clearOfHalf, fixed, roundTo, show } from '../format.ts'
import { draw, int, pick } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'

const TOPIC = 'compound-measures'
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a))
/**
 * Generated answers are exact, so they are marked exactly; the written questions' 0.5 would
 * have accepted 2.6 for a speed of 3 m/s. Only an answer rounded to 1 d.p. keeps half a unit.
 */

/** Journeys with a whole number of hours, and a realistic average speed for each. */
const JOURNEYS: { who: string; units: 'km/h' | 'm/s'; speed: [number, number]; time: [number, number] }[] = [
  { who: 'A car travels', units: 'km/h', speed: [35, 70], time: [2, 5] },
  { who: 'A coach travels', units: 'km/h', speed: [45, 80], time: [2, 6] },
  { who: 'A cyclist rides', units: 'km/h', speed: [12, 25], time: [2, 5] },
  { who: 'A walker covers', units: 'km/h', speed: [3, 6], time: [2, 6] },
  { who: 'A train travels', units: 'km/h', speed: [70, 150], time: [2, 4] },
  { who: 'A runner covers', units: 'm/s', speed: [3, 7], time: [40, 300] },
]
const BLOCKS: { name: string; d: number }[] = [
  { name: 'A block', d: 8 },
  { name: 'A block of aluminium', d: 2.7 },
  { name: 'A block of iron', d: 7.9 },
  { name: 'A block of copper', d: 8.9 },
  { name: 'A block of oak', d: 0.7 },
  { name: 'A block of pine', d: 0.5 },
  { name: 'A piece of glass', d: 2.5 },
  { name: 'A block of ice', d: 0.9 },
  { name: 'A brick', d: 1.9 },
  { name: 'A block of concrete', d: 2.4 },
  { name: 'A block of lead', d: 11.3 },
  { name: 'A block', d: 6 },
  { name: 'A block', d: 3 },
]
const LOADS: { text: (f: number, a: string) => string; force: [number, number] }[] = [
  { text: (f, a) => `A force of ${f} N acts on an area of ${a} m².`, force: [20, 2000] },
  { text: (f, a) => `A box with a weight of ${f} N rests on a base of area ${a} m².`, force: [50, 1200] },
  { text: (f, a) => `A crate weighing ${f} N stands on a floor, touching it over an area of ${a} m².`, force: [200, 3000] },
  { text: (f, a) => `A water tank weighing ${f} N stands on a base of area ${a} m².`, force: [1000, 9000] },
]

const BASIC: Record<string, 'speed' | 'density' | 'pressure'> = { q2: 'speed', q3: 'density', q4: 'pressure' }

/**
 * One compound measure from its two quantities: written as q2 (150 km in 3 hours), q3 (240 g
 * and 30 cm³) and q4 (200 N on 4 m²), all 2 marks on the core sheet. Each slot keeps its own
 * measure, so the sheet still asks for a speed, a density and a pressure.
 */
export const compoundMeasureBasic: Generator = {
  id: 'compound-measure-basic',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q2', 'q3', 'q4'],
  build(r, slot): Draft {
    const kind = BASIC[slot.id] ?? 'speed'
    let prompt: string, top: number, bottom: number, answer: number, units: string, method: string
    if (kind === 'speed') {
      const j = pick(r, JOURNEYS)
      const s = int(r, ...j.speed)
      const t = j.units === 'm/s' ? int(r, j.time[0] / 10, j.time[1] / 10) * 10 : int(r, ...j.time)
      top = s * t
      bottom = t
      answer = s
      units = j.units
      prompt = j.units === 'm/s'
        ? `${j.who} ${top} m in ${t} seconds. What is the average speed, in m/s?`
        : `${j.who} ${top} km in ${t} hours. What is the average speed, in km/h?`
      method = 'divides distance by time'
    } else if (kind === 'density') {
      const b = pick(r, BLOCKS)
      const V = Number.isInteger(b.d) ? int(r, 5, 60) * 5 : int(r, 2, 50) * 10
      top = Number(show(b.d * V))
      bottom = V
      answer = b.d
      units = 'g/cm³'
      prompt = `${b.name} has mass ${top} g and volume ${V} cm³. What is its density, in g/cm³?`
      method = 'divides mass by volume'
    } else {
      const l = pick(r, LOADS)
      const { f, a2 } = draw(r, (r) => ({ f: int(r, l.force[0] / 10, l.force[1] / 10) * 10, a2: int(r, 1, 16) }), ({ f, a2 }) => (f * 2) % a2 === 0 && a2 !== 2)
      top = f
      bottom = a2 / 2
      answer = (f * 2) / a2
      units = 'N/m²'
      prompt = `${l.text(f, show(bottom))} What is the pressure, in N/m²?`
      method = 'divides force by area'
    }
    const solution = `$${top} \\div ${show(bottom)} = ${show(answer)}$ ${units}.`
    // Second route: put the answer back. The measure times the bottom quantity must give the top.
    const back = answer * bottom
    return {
      question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [method], show(answer)), answer, tolerance: 0, units },
      check: { agrees: near(back, top) && answer > 0, detail: `${show(answer)} × ${show(bottom)} = ${show(back)}` },
      values: { kind, top, bottom: show(bottom) },
    }
  },
}

type Rearranged = 'mass' | 'volume' | 'distance' | 'force'
const REARRANGED: Rearranged[] = ['mass', 'volume', 'distance', 'force']
const WOODS: { name: string; d: number }[] = [
  { name: 'A piece of wood', d: 0.8 },
  { name: 'A piece of pine', d: 0.5 },
  { name: 'A piece of oak', d: 0.7 },
  { name: 'A block of aluminium', d: 2.7 },
  { name: 'A block of steel', d: 7.8 },
  { name: 'A piece of glass', d: 2.5 },
  { name: 'A block of ice', d: 0.9 },
  { name: 'A block of copper', d: 8.9 },
]

/**
 * A compound measure rearranged: written as q7 (density 0.8 g/cm³ and volume 250 cm³, find the
 * mass, 3 marks). Mass from density and volume, volume from mass and density, distance from
 * speed and time, and force from pressure and area.
 */
export const compoundMeasureRearranged: Generator = {
  id: 'compound-measure-rearranged',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q7'],
  build(r, slot): Draft {
    const kind = pick(r, REARRANGED)
    let prompt: string, solution: string, method: string[], answer: number, units: string, check: boolean, detail: string
    if (kind === 'mass' || kind === 'volume') {
      const w = pick(r, WOODS)
      const V = int(r, 5, 80) * 10
      const m = Number(show(w.d * V))
      if (kind === 'mass') {
        answer = m
        units = 'g'
        prompt = `${w.name} has density ${show(w.d)} g/cm³ and volume ${V} cm³. What is its mass, in g?`
        solution = `Mass $=$ density × volume $= ${show(w.d)} \\times ${V} = ${show(m)}$ g.`
        method = ['rearranges to density × volume', 'substitutes']
      } else {
        answer = V
        units = 'cm³'
        prompt = `${w.name} has density ${show(w.d)} g/cm³ and mass ${show(m)} g. What is its volume, in cm³?`
        solution = `Volume $=$ mass ÷ density $= ${show(m)} \\div ${show(w.d)} = ${V}$ cm³.`
        method = ['rearranges to mass ÷ density', 'substitutes']
      }
      // Second route: back to the density from the mass and the volume.
      check = near(m / V, w.d)
      detail = `${show(m)} ÷ ${V} = ${show(m / V)} g/cm³`
    } else if (kind === 'distance') {
      const who = pick(r, [
        { text: 'A car travels', ask: 'does the car travel', s: [40, 70] },
        { text: 'A cyclist rides', ask: 'does the cyclist ride', s: [12, 24] },
        { text: 'A train travels', ask: 'does the train travel', s: [80, 140] },
        { text: 'A walker walks', ask: 'does the walker walk', s: [3, 6] },
      ] as const)
      const s = int(r, who.s[0], who.s[1])
      const halves = int(r, 3, 10)
      const t = halves / 2
      answer = Number(show(s * t))
      units = 'km'
      prompt = `${who.text} at an average speed of ${s} km/h for ${show(t)} hours. How far ${who.ask}, in km?`
      solution = `Distance $=$ speed × time $= ${s} \\times ${show(t)} = ${show(answer)}$ km.`
      method = ['rearranges to speed × time', 'substitutes']
      check = near(answer / t, s)
      detail = `${show(answer)} ÷ ${show(t)} = ${show(answer / t)} km/h`
    } else {
      const p = int(r, 5, 60) * 10
      const a = int(r, 1, 12) / 2
      answer = Number(show(p * a))
      units = 'N'
      prompt = `A pressure of ${p} N/m² acts on an area of ${show(a)} m². What is the force, in N?`
      solution = `Force $=$ pressure × area $= ${p} \\times ${show(a)} = ${show(answer)}$ N.`
      method = ['rearranges to pressure × area', 'substitutes']
      check = near(answer / a, p)
      detail = `${show(answer)} ÷ ${show(a)} = ${show(answer / a)} N/m²`
    }
    return {
      question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, method, show(answer)), answer, tolerance: 0, units },
      check: { agrees: check && Number.isInteger(answer * 10), detail },
      values: { kind },
    }
  },
}

const MOVERS: { who: string; speed: [number, number] }[] = [
  { who: 'A cyclist covers', speed: [12, 30] },
  { who: 'A runner covers', speed: [8, 16] },
  { who: 'A car travels', speed: [30, 70] },
  { who: 'A train travels', speed: [60, 120] },
  { who: 'A rower covers', speed: [6, 12] },
  { who: 'A walker covers', speed: [4, 6] },
]
/** Minutes that are a terminating decimal of an hour, under an hour (q9) and over (q5). */
const MINUTES: Record<string, number[]> = {
  q9: [12, 15, 18, 24, 30, 36, 42, 45, 48, 54],
  q5: [66, 72, 75, 78, 84, 90, 96, 102, 105, 108, 114, 126, 132, 135, 138, 144, 150, 156, 165],
}

/**
 * Speed in km/h from a time in minutes: written as q5 (90 km in 90 minutes) and q9 (12 km in
 * 45 minutes), both 3 marks on the higher sheet. q5 keeps a time over an hour and q9 one
 * under, so the sheet asks for both conversions.
 */
export const speedFromMinutes: Generator = {
  id: 'speed-from-minutes',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q5', 'q9'],
  build(r, slot): Draft {
    const m = pick(r, MOVERS)
    const { s, mins } = draw(
      r,
      (r) => ({ s: int(r, ...m.speed), mins: pick(r, MINUTES[slot.id] ?? MINUTES.q9!) }),
      ({ s, mins }) => Number.isInteger((s * mins) / 6),
    )
    // Distance in tenths of a km: s × mins / 60 km.
    const d = Number(show((s * mins) / 60))
    const h = Number(show(mins / 60))
    // Second route: km per minute, then sixty minutes' worth.
    const perMinute = d / mins
    const viaMinute = perMinute * 60
    return {
      question: {
        type: 'numeric',
        prompt: `${m.who} ${show(d)} km in ${mins} minutes. What is the average speed, in km/h?`,
        solution: `${mins} minutes is $${mins} \\div 60 = ${show(h)}$ hours, so $${show(d)} \\div ${show(h)} = ${s}$ km/h.`,
        markScheme: scheme(slot, [slot.id === 'q5' ? 'converts the time' : `converts to ${show(h)} hours`, 'divides'], String(s)),
        answer: s,
        tolerance: 0,
        units: 'km/h',
      },
      check: { agrees: near(viaMinute, s) && near(d / h, s), detail: `${show(d)} km ÷ ${mins} min = ${perMinute.toFixed(5)} km a minute; × 60 = ${show(viaMinute)}` },
      values: { s, mins, d },
    }
  },
}

const LEGS: { who: string; speed: [number, number]; dist: [number, number] }[] = [
  { who: 'A car drives', speed: [20, 120], dist: [20, 200] },
  { who: 'A cyclist rides', speed: [8, 30], dist: [5, 60] },
  { who: 'A coach travels', speed: [30, 100], dist: [30, 180] },
  { who: 'A train travels', speed: [40, 160], dist: [40, 320] },
]

/**
 * Average speed over two legs: written as q11 (60 km at 60 km/h then 60 km at 30 km/h, 40 km/h)
 * and q14 (100 km at 50 then 100 km at 25, 33.3 km/h to 1 decimal place), on the advanced
 * sheet. Total distance over total time, never the mean of the two speeds.
 */
export const twoLegAverageSpeed: Generator = {
  id: 'two-leg-average-speed',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q11', 'q14'],
  build(r, slot): Draft {
    const rounded = slot.id === 'q14'
    const c = pick(r, LEGS)
    const equal = r() < 0.65
    // Each leg takes a whole number of quarter hours, so its time prints cleanly: the times
    // are drawn first, then the distances (equal legs) or the speeds (unequal ones).
    const inRange = (x: number, [lo, hi]: readonly [number, number]) => Number.isInteger(x) && x >= lo && x <= hi
    const { d1, v1, d2, v2, avg } = draw(
      r,
      (r) => {
        const q1 = int(r, 2, 16)
        const q2 = int(r, 2, 16)
        if (equal) {
          const d = int(r, c.dist[0] / 5, c.dist[1] / 5) * 5
          return { d1: d, d2: d, v1: (4 * d) / q1, v2: (4 * d) / q2, avg: (8 * d) / (q1 + q2) }
        }
        const v1 = int(r, ...c.speed)
        const v2 = int(r, ...c.speed)
        const d1 = (v1 * q1) / 4
        const d2 = (v2 * q2) / 4
        return { d1, d2, v1, v2, avg: ((d1 + d2) * 4) / (q1 + q2) }
      },
      ({ d1, v1, d2, v2, avg }) => {
        if (!inRange(v1, c.speed) || !inRange(v2, c.speed) || !inRange(d1, c.dist) || !inRange(d2, c.dist) || v1 === v2) return false
        const mean = (v1 + v2) / 2
        const whole = Math.abs(avg - Math.round(avg)) < 1e-9
        // Far enough from the mean of the speeds that the wrong method is plainly wrong.
        return Math.abs(avg - mean) >= 3 && (rounded ? !whole && clearOfHalf(avg, 1) : whole)
      },
      5000,
    )
    const t1 = d1 / v1
    const t2 = d2 / v2
    const D = d1 + d2
    const T = t1 + t2
    const answer = rounded ? roundTo(avg, 1) : Math.round(avg)
    const mean = (v1 + v2) / 2
    const shown = rounded ? `${fixed(avg, 1)}$ km/h to 1 d.p.` : `${answer}$ km/h.`
    const slower = v1 < v2 ? 'first' : 'second'
    const why = equal ? `The ${slower} leg is slower, so it takes longer and counts for more.` : 'The legs take different times, so the speeds count unequally.'
    // Second route: the harmonic mean of the speeds, weighted by the share of the distance.
    const harmonic = 1 / ((d1 / D) / v1 + (d2 / D) / v2)
    return {
      question: {
        type: 'numeric',
        prompt: `${c.who} ${d1} km at ${v1} km/h, then ${d2} km at ${v2} km/h. What is the average speed, in km/h${rounded ? ' to 1 decimal place' : ''}?`,
        solution: `The legs take $${d1} \\div ${v1} = ${show(t1)}$ h and $${d2} \\div ${v2} = ${show(t2)}$ h, so the total time is ${show(T)} h. Total distance over total time: $${D} \\div ${show(T)} = ${shown} Not ${show(mean)}, the mean of the speeds. ${why}`,
        markScheme: scheme(slot, ['finds both times', 'total ÷ total'], rounded ? fixed(avg, 1) : String(answer)),
        answer,
        tolerance: rounded ? 0.05 : 0,
        units: 'km/h',
      },
      check: {
        agrees: (rounded ? roundTo(harmonic, 1) : Math.round(harmonic)) === answer && Math.abs(harmonic - mean) > 2.5,
        detail: `weighted harmonic mean ${harmonic.toFixed(4)}; mean of speeds ${show(mean)}`,
      },
      values: { d1, v1, d2, v2, equalLegs: equal ? 'yes' : 'no', mean: show(mean) },
    }
  },
}

export const compoundMeasuresGenerators: Generator[] = [compoundMeasureBasic, compoundMeasureRearranged, speedFromMinutes, twoLegAverageSpeed]
