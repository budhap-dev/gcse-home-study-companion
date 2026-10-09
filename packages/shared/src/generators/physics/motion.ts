import { show } from '../format.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import type { Generator } from '../types.ts'
import { cap, closes, near, numeric, prose, stepped, tex } from './build.ts'
import { clearAtSigFigs, dpTolerance, sfTolerance, sigFigs, sigText } from './format.ts'

/**
 * Describing motion and stopping distances (AQA 8463, topic 5): speed, velocity and
 * acceleration, the equation v² − u² = 2as, thinking, braking and stopping distances.
 *
 * Every numeric question without a diagram in the two topics has a generator here. The
 * written questions are the model for the wording and the mark-scheme steps; each context
 * list carries the speeds, accelerations, masses and reaction times its vehicles and people
 * really have, so a draw can never be absurd. A deceleration is answered as its size, as the
 * written questions answer it.
 */
const MOTION = 'describing-motion'
const STOPPING = 'stopping-distances'

/** A computed figure with its binary residue removed: 1.5 × 60 as 90. */
const clean = (x: number) => Number(show(x))

/**
 * Whether rounding x to n significant figures is a real step the answer box can print:
 * clear of a half, not already exact, and with a last figure that is not a 0 the box would
 * drop (it prints 19, not the 19.0 the prompt asks for).
 */
const roundsWell = (x: number, n: number) => clearAtSigFigs(x, n) && x !== sigFigs(x, n) && !sigText(sigFigs(x, n), n).endsWith('0')

/**
 * The unrounded value a solution prints before it rounds, truncated to n figures with an
 * ellipsis: 8.333…, 0.2474…. A value exact at n figures is printed as it is.
 */
function unrounded(x: number, n: number): string {
  const k = Math.max(0, n - 1 - Math.floor(Math.log10(Math.abs(x))))
  const t = Math.floor(Number((x * 10 ** k).toPrecision(12))) / 10 ** k
  return near(t, x) ? show(x) : `${t.toFixed(k)}\\ldots`
}

/** The size of an acceleration or deceleration with the slot's unit, for a check's detail. */
const ms2 = (a: number) => `${show(a)} m/s²`

/**
 * Half a unit in the last of n significant figures of a rounded answer: how far the exact
 * value can sit from it when the rounding is right. The marker's tolerance is this capped at
 * 2%, which at two figures (0.14 from 0.1355) is tighter than the rounding itself.
 */
const halfUnit = (answer: number, n: number) => 0.5 * 10 ** (Math.floor(Math.log10(Math.abs(answer))) - (n - 1)) + 1e-12

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
/** The smallest whole number whose square is a multiple of n: 4 for 8, 3 for 9, 10 for 10. A speed that is a multiple of it has a square n divides. */
function rootMultiple(n: number): number {
  for (let m = 1; ; m++) if ((m * m) % n === 0) return m
}
/** A multiple of `step` from lo to hi, or 0 when there is none, so a draw can reject the candidate. */
const multipleIn = (r: Rng, step: number, lo: number, hi: number) => (Math.ceil(lo / step) <= Math.floor(hi / step) ? int(r, Math.ceil(lo / step), Math.floor(hi / step)) * step : 0)

/**
 * A deceleration from the range in quarter steps, then a speed from the range whose braking
 * distance u² ÷ 2a is whole, so each deceleration is offered evenly. Rejected afterwards:
 * a of 0.5 or 1 (s is u² or half of it) and a distance that is 1, 2, 3 or 4 times the
 * speed. a = u ÷ 4 is on offer for every speed and made s = 2u a quarter of all draws, a
 * pattern a student would learn as a rule.
 */
function brakingPair(r: Rng, uRange: [number, number], aRange: [number, number]) {
  const a = stepped(r, aRange[0], aRange[1], 0.25)
  // 2a as p/q in lowest terms (q is 1 or 2): s is whole exactly when p divides u².
  const q = Number.isInteger(2 * a) ? 1 : 2
  const u = multipleIn(r, rootMultiple(Math.round(2 * a * q)), uRange[0], uRange[1])
  return { u, a, s: u ? clean((u * u) / (2 * a)) : 0 }
}
const cleanBraking = ({ u, a, s }: { u: number; a: number; s: number }) => u > 0 && Number.isInteger(s) && a !== 0.5 && a !== 1 && a !== u && !(Number.isInteger(s / u) && s / u <= 4)

/**
 * A thing with its mass: "900 kg car", or "car of mass 1800 kg" where "a" before the figure
 * would be read "an" (eighteen hundred, eleven thousand, eighty). The prompt puts "a" in front.
 */
const massed = (noun: string, m: number) => (/^(8|11|18)/.test(String(m)) ? `${noun} of mass ${prose(m)} kg` : `${prose(m)} kg ${noun}`)

// ---------------------------------------------------------------------------------------------
// Describing motion
// ---------------------------------------------------------------------------------------------

interface Steady {
  noun: string
  verb: string
  speed: [number, number]
  step: number
  time: [number, number]
  tstep: number
}
/** Things that move at a steady speed, with the speeds and the times each really keeps up. */
const STEADY: Steady[] = [
  { noun: 'runner', verb: 'runs at a steady', speed: [2, 6], step: 1, time: [20, 120], tstep: 10 },
  { noun: 'cyclist', verb: 'rides at a constant', speed: [4, 12], step: 1, time: [10, 90], tstep: 5 },
  { noun: 'car', verb: 'travels at a constant', speed: [10, 30], step: 1, time: [5, 60], tstep: 1 },
  { noun: 'train', verb: 'travels at a steady', speed: [20, 60], step: 5, time: [10, 120], tstep: 10 },
  { noun: 'walker', verb: 'walks at a steady', speed: [1.5, 2], step: 0.5, time: [60, 600], tstep: 30 },
  { noun: 'swimmer', verb: 'swims at a constant', speed: [1.2, 1.8], step: 0.2, time: [20, 120], tstep: 10 },
  { noun: 'bus', verb: 'travels at a steady', speed: [8, 15], step: 1, time: [10, 60], tstep: 5 },
  { noun: 'horse', verb: 'gallops at a steady', speed: [8, 15], step: 1, time: [10, 60], tstep: 5 },
  { noun: 'lorry', verb: 'travels at a constant', speed: [10, 25], step: 1, time: [5, 60], tstep: 1 },
  { noun: 'ferry', verb: 'sails at a steady', speed: [5, 10], step: 1, time: [60, 600], tstep: 60 },
]

/**
 * s = vt: written as q1 (a runner at 3 m/s for 40 s, 2 marks). The distance is a whole
 * number and never equal to the speed or the time, so neither given figure is the answer.
 */
export const distanceFromSpeedAndTime: Generator = {
  id: 'distance-from-speed-and-time',
  subjectId: 'physics',
  topicId: MOTION,
  replaces: ['q1'],
  build(r, slot, turn) {
    const c = STEADY[turn % STEADY.length]!
    const { v, t, s } = draw(
      r,
      (r) => {
        const v = stepped(r, c.speed[0], c.speed[1], c.step)
        const t = stepped(r, c.time[0], c.time[1], c.tstep)
        return { v, t, s: clean(v * t) }
      },
      ({ v, t, s }) => Number.isInteger(s) && s !== v && s !== t && v !== t,
    )
    const prompt = pick(r, [
      `A ${c.noun} ${c.verb} ${show(v)} m/s for ${t} s. Calculate the distance covered.`,
      `A ${c.noun} ${c.verb} ${show(v)} m/s for ${t} s. How far does the ${c.noun} travel, in metres?`,
      `How far does a ${c.noun} travel in ${t} s at a steady ${show(v)} m/s? Give your answer in metres.`,
    ])
    // Second route: the distance over the time gives the speed back, and over the speed the time.
    return numeric(
      slot,
      {
        prompt,
        solution: `${closes(`s = v t = ${tex(v)} \\times ${t}`, s, 'm')} The speed is steady, so distance is speed multiplied by time.`,
        method: [`$${tex(v)} \\times ${t}$`],
        answer: s,
        units: 'm',
      },
      { agrees: near(s / t, v) && near(s / v, t), detail: `${s} ÷ ${t} = ${show(s / t)} m/s; ${s} ÷ ${show(v)} = ${show(s / v)} s` },
      { context: c.noun, v, t },
    )
  },
}

interface Speeder {
  noun: string
  its: string
  /** The pronoun that stands for it mid-prompt: a person is never "it". */
  it: string
  a: [number, number]
  step: number
  t: [number, number]
  tstep: number
  vmax: number
  /** A speed it can already have when it starts to accelerate; absent where it starts from rest. */
  from?: [number, number]
}
const SPEEDERS: Speeder[] = [
  { noun: 'a cyclist', its: 'her acceleration', it: 'she', a: [1, 3], step: 0.5, t: [2, 8], tstep: 1, vmax: 12, from: [2, 5] },
  { noun: 'a car', its: 'its acceleration', it: 'it', a: [1, 4], step: 0.5, t: [3, 15], tstep: 1, vmax: 30, from: [5, 15] },
  { noun: 'a sprinter', its: 'her acceleration', it: 'she', a: [2, 4], step: 0.5, t: [2, 3], tstep: 1, vmax: 10 },
  { noun: 'a train', its: 'its acceleration', it: 'it', a: [0.5, 1.5], step: 0.5, t: [10, 40], tstep: 5, vmax: 50, from: [5, 20] },
  { noun: 'a motorbike', its: 'its acceleration', it: 'it', a: [2, 5], step: 0.5, t: [2, 8], tstep: 1, vmax: 35, from: [5, 15] },
  { noun: 'a bus', its: 'its acceleration', it: 'it', a: [0.5, 1.5], step: 0.5, t: [4, 16], tstep: 2, vmax: 15, from: [2, 6] },
  { noun: 'an aircraft taking off', its: 'its acceleration', it: 'it', a: [2, 4], step: 0.5, t: [10, 30], tstep: 5, vmax: 80 },
  { noun: 'a lift', its: 'its acceleration', it: 'it', a: [0.5, 1.5], step: 0.5, t: [2, 4], tstep: 1, vmax: 4 },
  { noun: 'a skateboarder', its: 'his acceleration', it: 'he', a: [0.5, 2], step: 0.5, t: [2, 6], tstep: 1, vmax: 8 },
  { noun: 'a dog', its: 'its acceleration', it: 'it', a: [2, 4], step: 0.5, t: [2, 3], tstep: 1, vmax: 10 },
]

/**
 * a = Δv ÷ t: written as q3 (a cyclist from rest to 12 m/s in 4 s, 2 marks). Mostly from
 * rest, as written; where the context can already be moving, some start at a speed so Δv
 * is a real subtraction. No given figure equals the answer, and Δv is never the time (a = 1)
 * or the starting speed (v = 2u).
 */
export const accelerationFromSpeedChange: Generator = {
  id: 'acceleration-from-speed-change',
  subjectId: 'physics',
  topicId: MOTION,
  replaces: ['q3'],
  build(r, slot, turn) {
    const c = SPEEDERS[turn % SPEEDERS.length]!
    const moving = Boolean(c.from) && r() < 0.4
    const { u, v, t, a } = draw(
      r,
      (r) => {
        const a = stepped(r, c.a[0], c.a[1], c.step)
        const t = stepped(r, c.t[0], c.t[1], c.tstep)
        const u = moving ? int(r, c.from![0], c.from![1]) : 0
        return { u, v: clean(u + a * t), t, a }
      },
      ({ u, v, t, a }) => Number.isInteger(v) && v <= c.vmax && v > u && a !== t && a !== v && a !== u && v !== t && v - u !== t && v - u !== u,
    )
    const dv = v - u
    const prompt = moving
      ? pick(r, [
          `${cap(c.noun)} speeds up from ${u} m/s to ${v} m/s in ${t} s. Calculate ${c.its}.`,
          `${cap(c.noun)} is travelling at ${u} m/s. Over the next ${t} s ${c.it} accelerates to ${v} m/s. Calculate ${c.its}, in m/s².`,
        ])
      : pick(r, [
          `${cap(c.noun)} accelerates from rest to ${v} m/s in ${t} s. Calculate ${c.its}.`,
          `${cap(c.noun)} starts from rest and reaches ${v} m/s after ${t} s. Calculate ${c.its}, in m/s².`,
        ])
    const solution = moving
      ? `$\\Delta v = ${v} - ${u} = ${dv}$ m/s. ${closes(`a = \\Delta v \\div t = ${dv} \\div ${t}`, a, 'm/s²')} Divide the change in speed by the time, not the final speed.`
      : `${closes(`a = \\Delta v \\div t = ${v} \\div ${t}`, a, 'm/s²')} From rest, the change in speed is the final speed itself.`
    // Second route: forwards, the start speed plus the acceleration times the time.
    return numeric(
      slot,
      {
        prompt,
        solution,
        method: [moving ? `$(${v} - ${u}) \\div ${t}$` : `$${v} \\div ${t}$`],
        answer: a,
        tolerance: dpTolerance(a),
        units: 'm/s²',
      },
      { agrees: near(u + a * t, v), detail: `${u} + ${show(a)} × ${t} = ${show(u + a * t)} m/s` },
      { context: c.noun, start: moving ? 'moving' : 'rest', u, v, t },
    )
  },
}

interface Accelerating {
  noun: string
  its: string
  a: [number, number]
  step: number
  v: [number, number]
}
const ACCELERATING: Accelerating[] = [
  { noun: 'a car', its: 'its', a: [1, 4], step: 0.5, v: [10, 30] },
  { noun: 'a cyclist', its: 'her', a: [0.5, 2], step: 0.5, v: [4, 12] },
  { noun: 'a train', its: 'its', a: [0.5, 1.5], step: 0.5, v: [15, 40] },
  { noun: 'a motorbike', its: 'its', a: [2, 5], step: 0.5, v: [15, 35] },
  { noun: 'a sprinter', its: 'his', a: [2, 4], step: 0.5, v: [6, 10] },
  { noun: 'an aircraft', its: 'its', a: [2, 4], step: 0.5, v: [60, 80] },
  { noun: 'a ball rolling down a slope', its: 'its', a: [1, 4], step: 0.5, v: [4, 10] },
  { noun: 'a speedboat', its: 'its', a: [1, 2], step: 0.5, v: [10, 20] },
]

/**
 * v² = 2as from rest: written as q7 (2.5 m/s² over 80 m, 20 m/s, 3 marks). The acceleration
 * is drawn first, then a speed whose square 2a divides, so v² is a perfect square, the
 * distance is whole and never the speed, and each acceleration is drawn evenly: drawing
 * both at random made a = 2, which needs only an even speed, 38% of draws.
 */
export const finalVelocityFromRest: Generator = {
  id: 'final-velocity-from-rest',
  subjectId: 'physics',
  topicId: MOTION,
  replaces: ['q7'],
  build(r, slot, turn) {
    const c = ACCELERATING[turn % ACCELERATING.length]!
    const { a, v, s } = draw(
      r,
      (r) => {
        const a = stepped(r, c.a[0], c.a[1], c.step)
        const v = multipleIn(r, rootMultiple(Math.round(2 * a)), c.v[0], c.v[1])
        return { a, v, s: v ? clean((v * v) / (2 * a)) : 0 }
      },
      // Never a = 1: "2 × 1 × s" makes the doubling a step in name only.
      ({ a, v, s }) => v > 0 && Number.isInteger(s) && s >= 2 && s !== v && s !== a && a !== 1 && v !== a,
    )
    const v2 = v * v
    const prompt = pick(r, [
      `${cap(c.noun)} accelerates from rest at ${show(a)} m/s² over a distance of ${prose(s)} m. Calculate ${c.its} final velocity.`,
      `${cap(c.noun)} starts from rest and accelerates uniformly at ${show(a)} m/s². Calculate ${c.its} velocity after ${prose(s)} m, in m/s.`,
    ])
    // Second route: v² over 2s gives the acceleration back.
    return numeric(
      slot,
      {
        prompt,
        solution: `$v^2 - u^2 = 2 a s$. From rest $u = 0$, so $v^2 = 2 \\times ${tex(a)} \\times ${tex(s)} = ${tex(v2)}$. ${closes(`v = \\sqrt{${tex(v2)}}`, v, 'm/s')} Take the square root last.`,
        method: [`$v^2 = 2 \\times ${tex(a)} \\times ${tex(s)}$`, `$v^2 = ${tex(v2)}$`],
        answer: v,
        units: 'm/s',
      },
      { agrees: near(v2 / (2 * s), a) && Number.isInteger(v), detail: `${v2} ÷ (2 × ${s}) = ${show(v2 / (2 * s))} m/s²` },
      { context: c.noun, a, s, v },
    )
  },
}

interface Stopper {
  noun: string
  its: string
  u: [number, number]
  a: [number, number]
  step: number
  t: [number, number]
  tstep: number
}
/** Things that brake, with the speeds they have and the decelerations their brakes give. */
const STOPPERS: Stopper[] = [
  { noun: 'a train', its: 'its', u: [10, 60], a: [0.5, 2], step: 0.5, t: [10, 60], tstep: 5 },
  { noun: 'a car', its: 'its', u: [10, 30], a: [2, 8], step: 0.5, t: [2, 10], tstep: 1 },
  { noun: 'a cyclist', its: 'her', u: [4, 12], a: [1, 4], step: 0.5, t: [2, 6], tstep: 1 },
  { noun: 'a lorry', its: 'its', u: [10, 25], a: [1, 5], step: 0.5, t: [3, 12], tstep: 1 },
  { noun: 'a bus', its: 'its', u: [8, 20], a: [1, 4], step: 0.5, t: [3, 10], tstep: 1 },
  { noun: 'a runner', its: 'his', u: [3, 9], a: [1, 3], step: 0.5, t: [2, 5], tstep: 1 },
  { noun: 'a motorbike', its: 'its', u: [15, 35], a: [3, 9], step: 0.5, t: [2, 8], tstep: 1 },
  { noun: 'a landing aircraft', its: 'its', u: [50, 80], a: [2, 5], step: 0.5, t: [10, 30], tstep: 5 },
  { noun: 'a tram', its: 'its', u: [8, 20], a: [1, 2], step: 0.5, t: [5, 15], tstep: 1 },
  { noun: 'a skateboarder', its: 'her', u: [3, 8], a: [0.5, 2], step: 0.5, t: [2, 6], tstep: 1 },
]

/**
 * Deceleration from a speed change and a time: written as q9 (a train from 30 m/s to a stop
 * in 6 s, 2 marks). The working carries the minus sign and the answer is the size, as the
 * written one is. Mostly to a stop; sometimes to a lower speed, so Δv is a subtraction.
 */
export const decelerationFromSpeedChange: Generator = {
  id: 'deceleration-from-speed-change',
  subjectId: 'physics',
  topicId: MOTION,
  replaces: ['q9'],
  build(r, slot, turn) {
    const c = STOPPERS[turn % STOPPERS.length]!
    const slowing = r() < 0.3
    const { u, v, t, a } = draw(
      r,
      (r) => {
        const a = stepped(r, c.a[0], c.a[1], c.step)
        const t = stepped(r, c.t[0], c.t[1], c.tstep)
        const v = slowing ? int(r, 1, c.u[1]) : 0
        return { u: clean(v + a * t), v, t, a }
      },
      ({ u, v, t, a }) => Number.isInteger(u) && u >= c.u[0] && u <= c.u[1] && a !== t && a !== u && a !== v && u !== t && u - v !== t && v !== u - v,
    )
    const dv = u - v
    const prompt = slowing
      ? `${cap(c.noun)} slows from ${u} m/s to ${v} m/s in ${t} s. Calculate ${c.its} deceleration, in m/s².`
      : pick(r, [
          `${cap(c.noun)} travelling at ${u} m/s brakes to a stop in ${t} s. Calculate ${c.its} deceleration.`,
          `${cap(c.noun)} moving at ${u} m/s comes to rest in ${t} s. Calculate ${c.its} deceleration, in m/s².`,
        ])
    // Second route: forwards, the start speed less the deceleration times the time.
    return numeric(
      slot,
      {
        prompt,
        solution: `$\\Delta v = ${v} - ${u} = -${dv}$ m/s. $a = -${dv} \\div ${t} = -${show(a)}$ m/s², a deceleration of **${show(a)} m/s²**. The minus sign shows the velocity is falling; the deceleration is its size.`,
        method: [`$${dv} \\div ${t}$`],
        answer: a,
        tolerance: dpTolerance(a),
        units: 'm/s²',
      },
      { agrees: near(u - a * t, v), detail: `${u} − ${show(a)} × ${t} = ${show(u - a * t)} m/s` },
      { context: c.noun, end: slowing ? 'slower' : 'stop', u, v, t },
    )
  },
}

interface Braker {
  noun: string
  it: string
  u: [number, number]
  a: [number, number]
}
/** Vehicles braking to a stop, with the speeds they have and the decelerations they manage. */
const BRAKERS: Braker[] = [
  { noun: 'a car', it: 'it', u: [10, 30], a: [2.5, 8] },
  { noun: 'a lorry', it: 'it', u: [10, 25], a: [1.5, 5] },
  { noun: 'a train', it: 'it', u: [20, 60], a: [0.5, 2] },
  { noun: 'a cyclist', it: 'she', u: [4, 12], a: [1, 4] },
  { noun: 'a motorbike', it: 'it', u: [15, 35], a: [3, 9] },
  { noun: 'a bus', it: 'it', u: [8, 20], a: [1.5, 5] },
  { noun: 'a landing aircraft', it: 'it', u: [50, 80], a: [2, 5] },
  { noun: 'a van', it: 'it', u: [10, 25], a: [2, 8] },
]

/** A speed and a deceleration from a braker's ranges whose braking distance u² ÷ 2a is whole and no small multiple of the speed. */
function braking(r: Rng, c: Braker) {
  return draw(r, (r) => brakingPair(r, c.u, c.a), (x) => cleanBraking(x) && x.s !== x.a)
}

/**
 * s = u² ÷ 2a with v = 0: written as q11 (25 m/s at 6.25 m/s², 50 m, 3 marks). The working
 * keeps the signs the written one keeps: 0 − u² = 2 × (−a) × s.
 */
export const brakingDistanceFromDeceleration: Generator = {
  id: 'braking-distance-from-deceleration',
  subjectId: 'physics',
  topicId: MOTION,
  replaces: ['q11'],
  build(r, slot, turn) {
    const c = BRAKERS[turn % BRAKERS.length]!
    const { u, a, s } = braking(r, c)
    const u2 = u * u
    const a2 = clean(2 * a)
    const prompt = pick(r, [
      `${cap(c.noun)} travelling at ${u} m/s brakes with a constant deceleration of ${show(a)} m/s². Calculate the distance ${c.it} travels while stopping.`,
      `${cap(c.noun)} is travelling at ${u} m/s when the brakes are applied, giving a constant deceleration of ${show(a)} m/s². Calculate the braking distance, in metres.`,
    ])
    // Second route: forwards, 2as is u².
    return numeric(
      slot,
      {
        prompt,
        solution: `$v^2 - u^2 = 2 a s$ with $v = 0$, $u = ${u}$, $a = -${show(a)}$: $0 - ${tex(u2)} = 2 \\times (-${show(a)}) \\times s$, so ${closes(`s = ${tex(u2)} \\div ${show(a2)}`, s, 'm')} The deceleration is a negative acceleration, so the two minus signs cancel.`,
        method: [`$0 - ${u}^2 = 2 \\times (-${show(a)}) \\times s$, or $${tex(u2)} = ${show(a2)} s$`, `$s = ${tex(u2)} \\div ${show(a2)}$`],
        answer: s,
        units: 'm',
      },
      { agrees: near(2 * a * s, u2), detail: `2 × ${show(a)} × ${s} = ${show(2 * a * s)}, and ${u}² = ${u2}` },
      { context: c.noun, u, a, s },
    )
  },
}

interface Journey {
  text: (d1: string, v1: string, d2: string, v2: string) => string
  whole: string
  first: string
  second: string
  v1: [number, number]
  step1: number
  t1: [number, number]
  tstep1: number
  v2: [number, number]
  step2: number
  t2: [number, number]
  tstep2: number
}
/** Two-stage journeys with the speeds each stage really has; times in whole minutes or half-minutes so the distances come out whole. */
const JOURNEYS: Journey[] = [
  { text: (d1, v1, d2, v2) => `A student walks ${d1} m to a bus stop at ${v1} m/s, then rides ${d2} m on a bus at an average of ${v2} m/s.`, whole: 'journey', first: 'walking', second: 'bus', v1: [1, 2], step1: 0.5, t1: [120, 600], tstep1: 60, v2: [8, 15], step2: 1, t2: [60, 600], tstep2: 30 },
  { text: (d1, v1, d2, v2) => `A runner jogs ${d1} m at ${v1} m/s, then walks ${d2} m at ${v2} m/s.`, whole: 'journey', first: 'jogging', second: 'walking', v1: [2, 3], step1: 0.5, t1: [60, 600], tstep1: 60, v2: [1, 2], step2: 0.5, t2: [60, 600], tstep2: 60 },
  { text: (d1, v1, d2, v2) => `A commuter cycles ${d1} m to the station at ${v1} m/s, then travels ${d2} m by train at an average of ${v2} m/s.`, whole: 'journey', first: 'cycling', second: 'train', v1: [4, 8], step1: 1, t1: [120, 600], tstep1: 60, v2: [20, 40], step2: 5, t2: [300, 1200], tstep2: 60 },
  { text: (d1, v1, d2, v2) => `A car covers ${d1} m through a town at an average of ${v1} m/s, then ${d2} m on a motorway at ${v2} m/s.`, whole: 'journey', first: 'town', second: 'motorway', v1: [8, 15], step1: 1, t1: [120, 600], tstep1: 60, v2: [25, 30], step2: 1, t2: [300, 1200], tstep2: 60 },
  { text: (d1, v1, d2, v2) => `In a race an athlete swims ${d1} m at ${v1} m/s, then runs ${d2} m at ${v2} m/s.`, whole: 'race', first: 'swimming', second: 'running', v1: [1.2, 1.4], step1: 0.2, t1: [300, 600], tstep1: 60, v2: [3, 5], step2: 0.5, t2: [300, 1500], tstep2: 60 },
  { text: (d1, v1, d2, v2) => `A hiker walks ${d1} m uphill at ${v1} m/s, then ${d2} m downhill at ${v2} m/s.`, whole: 'walk', first: 'uphill', second: 'downhill', v1: [0.5, 1.5], step1: 0.5, t1: [600, 1800], tstep1: 60, v2: [1.5, 2], step2: 0.5, t2: [600, 1800], tstep2: 60 },
  { text: (d1, v1, d2, v2) => `A lorry travels ${d1} m on an A-road at an average of ${v1} m/s, then ${d2} m on a motorway at ${v2} m/s.`, whole: 'journey', first: 'A-road', second: 'motorway', v1: [10, 18], step1: 1, t1: [300, 900], tstep1: 60, v2: [20, 25], step2: 1, t2: [600, 1800], tstep2: 60 },
  { text: (d1, v1, d2, v2) => `A passenger crosses ${d1} m of water on a ferry at ${v1} m/s, then walks ${d2} m at ${v2} m/s.`, whole: 'journey', first: 'ferry', second: 'walking', v1: [4, 8], step1: 1, t1: [300, 900], tstep1: 60, v2: [1, 2], step2: 0.5, t2: [300, 900], tstep2: 60 },
]

/**
 * Average speed over two stages, to 3 significant figures: written as q16 (600 m at 5 m/s
 * then 900 m at 15 m/s, 8.33 m/s, 4 marks). The stages never take the same time, so the
 * answer is never the mean of the two speeds, and the division never comes out to three
 * figures by itself.
 */
export const averageSpeedOverStages: Generator = {
  id: 'average-speed-over-stages',
  subjectId: 'physics',
  topicId: MOTION,
  replaces: ['q16'],
  build(r, slot, turn) {
    const c = JOURNEYS[turn % JOURNEYS.length]!
    const { v1, t1, d1, v2, t2, d2, rate } = draw(
      r,
      (r) => {
        const v1 = stepped(r, c.v1[0], c.v1[1], c.step1)
        const t1 = stepped(r, c.t1[0], c.t1[1], c.tstep1)
        const v2 = stepped(r, c.v2[0], c.v2[1], c.step2)
        const t2 = stepped(r, c.t2[0], c.t2[1], c.tstep2)
        const d1 = clean(v1 * t1)
        const d2 = clean(v2 * t2)
        return { v1, t1, d1, v2, t2, d2, rate: (d1 + d2) / (t1 + t2) }
      },
      // Never a stage at 1 m/s: its time would be its distance, and the division a step in name
      // only. And never an answer that rounds to the mean of the two speeds, which would mark
      // the wrong method right.
      ({ d1, d2, t1, t2, v1, v2, rate }) =>
        Number.isInteger(d1) && Number.isInteger(d2) && t1 !== t2 && v1 !== v2 && v1 !== 1 && v2 !== 1 && d1 !== d2 && roundsWell(rate, 3) && sigFigs(rate, 3) !== sigFigs((v1 + v2) / 2, 3),
    )
    const D = d1 + d2
    const T = t1 + t2
    const answer = sigFigs(rate, 3)
    const tolerance = sfTolerance(answer, 3)
    // Second route: the total time is the sum of each distance over its speed, and the average times that time is the total distance.
    const total = d1 / v1 + d2 / v2
    return numeric(
      slot,
      {
        prompt: `${c.text(prose(d1), show(v1), prose(d2), show(v2))} Calculate the average speed for the whole ${c.whole}, in m/s. Give your answer to 3 significant figures.`,
        solution: `Time ${c.first} $= ${tex(d1)} \\div ${show(v1)} = ${t1}$ s. Time ${c.second} $= ${tex(d2)} \\div ${show(v2)} = ${t2}$ s. Total distance ${prose(D)} m in ${T} s. Average speed $= ${tex(D)} \\div ${T} = ${unrounded(rate, 4)}$, so **${sigText(answer, 3)} m/s** to 3 significant figures. Not the average of ${show(v1)} and ${show(v2)}: the two stages take different times.`,
        method: [`${c.first} time ${t1} s`, `${c.second} time ${t2} s`, `$${tex(D)} \\div ${T}$`],
        answer,
        tolerance,
        units: 'm/s',
        line: `${sigText(answer, 3)} m/s`,
      },
      { agrees: near(total, T) && Math.abs(D / total - answer) <= tolerance, detail: `${d1} ÷ ${show(v1)} + ${d2} ÷ ${show(v2)} = ${show(total)} s; ${D} ÷ ${show(total)} = ${(D / total).toFixed(5)}` },
      { context: c.first, v1, t1, d1, v2, t2, d2, rate: rate.toFixed(5) },
    )
  },
}

interface Running {
  text: (u: number, a: string, s: string) => string
  ask: string
  u: [number, number]
  a: [number, number]
  step: number
  s: [number, number]
  sstep: number
  /** The final speed the context can believably reach. */
  v: [number, number]
}
const RUNNING: Running[] = [
  { text: (u, a, s) => `An aircraft on a runway is moving at ${u} m/s when its engines give it an acceleration of ${a} m/s². It travels a further ${s} m before taking off.`, ask: 'its take-off velocity', u: [15, 30], a: [2, 4], step: 0.5, s: [200, 600], sstep: 50, v: [50, 80] },
  { text: (u, a, s) => `A car joins a motorway from a slip road at ${u} m/s and accelerates at ${a} m/s² over ${s} m.`, ask: 'its velocity at the end of the slip road', u: [10, 20], a: [1, 3], step: 0.5, s: [50, 200], sstep: 10, v: [15, 31] },
  { text: (u, a, s) => `A train is moving at ${u} m/s as it leaves a station. It accelerates at ${a} m/s² over the next ${s} m.`, ask: 'its velocity at the end of that distance', u: [5, 15], a: [0.5, 1], step: 0.5, s: [200, 800], sstep: 50, v: [15, 42] },
  { text: (u, a, s) => `A cyclist crosses the top of a hill at ${u} m/s and accelerates down it at ${a} m/s² for ${s} m.`, ask: 'her velocity at the bottom', u: [3, 8], a: [0.5, 1.5], step: 0.5, s: [20, 100], sstep: 10, v: [6, 18] },
  { text: (u, a, s) => `A bobsleigh is pushed off at ${u} m/s and then accelerates at ${a} m/s² down a straight ${s} m long.`, ask: 'its velocity at the end of the straight', u: [5, 10], a: [1, 3], step: 0.5, s: [100, 300], sstep: 10, v: [15, 40] },
  { text: (u, a, s) => `A speedboat moving at ${u} m/s opens its throttle and accelerates at ${a} m/s² over ${s} m.`, ask: 'its final velocity', u: [5, 10], a: [1, 2], step: 0.5, s: [50, 200], sstep: 10, v: [12, 29] },
  { text: (u, a, s) => `A ski jumper is moving at ${u} m/s part-way down the in-run and accelerates at ${a} m/s² over the remaining ${s} m.`, ask: 'his velocity at the take-off point', u: [5, 10], a: [2, 4], step: 0.5, s: [50, 100], sstep: 10, v: [15, 27] },
  { text: (u, a, s) => `A motorbike travelling at ${u} m/s accelerates at ${a} m/s² over ${s} m.`, ask: 'its final velocity', u: [10, 20], a: [2, 5], step: 0.5, s: [50, 200], sstep: 10, v: [20, 40] },
]

/**
 * v² = u² + 2as with a running start, to 3 significant figures: written as q18 (an aircraft
 * at 20 m/s, 3 m/s² over 400 m, 52.9 m/s, 3 marks). v² is a whole number that is never a
 * perfect square (a whole speed under 100 would print its third figure as 0), so the root is
 * a real rounding.
 */
export const finalVelocityWithRunningStart: Generator = {
  id: 'final-velocity-with-a-running-start',
  subjectId: 'physics',
  topicId: MOTION,
  replaces: ['q18'],
  build(r, slot, turn) {
    const c = RUNNING[turn % RUNNING.length]!
    const { u, a, s, v2, v } = draw(
      r,
      (r) => {
        const u = int(r, ...c.u)
        const a = stepped(r, c.a[0], c.a[1], c.step)
        const s = stepped(r, c.s[0], c.s[1], c.sstep)
        const v2 = clean(u * u + 2 * a * s)
        return { u, a, s, v2, v: Math.sqrt(v2) }
      },
      ({ u, a, v2, v }) => Number.isInteger(v2) && v >= c.v[0] && v <= c.v[1] && roundsWell(v, 3) && u !== a,
    )
    const u2 = u * u
    const gain = clean(2 * a * s)
    const answer = sigFigs(v, 3)
    const tolerance = sfTolerance(answer, 3)
    const prompt = pick(r, [
      `${c.text(u, show(a), prose(s))} Calculate ${c.ask}. Give your answer to 3 significant figures.`,
      `${c.text(u, show(a), prose(s))} Calculate ${c.ask}, in m/s, to 3 significant figures.`,
    ])
    // Second route: the acceleration back from the exact root, and the rounded answer within its tolerance of it.
    const back = (v * v - u2) / (2 * s)
    return numeric(
      slot,
      {
        prompt,
        solution: `$v^2 - u^2 = 2 a s$: $v^2 = ${u}^2 + 2 \\times ${tex(a)} \\times ${tex(s)} = ${tex(u2)} + ${tex(gain)} = ${tex(v2)}$. $v = \\sqrt{${tex(v2)}} = ${unrounded(v, 4)}$, so **${sigText(answer, 3)} m/s** to 3 significant figures. The starting speed is squared before it is added: $u^2$, not $u$.`,
        method: [`$v^2 = ${u}^2 + 2 \\times ${tex(a)} \\times ${tex(s)}$`, `$v^2 = ${tex(v2)}$`],
        answer,
        tolerance,
        units: 'm/s',
        line: `${sigText(answer, 3)} m/s`,
      },
      { agrees: near(back, a) && Math.abs(v - answer) <= tolerance, detail: `(${v.toFixed(5)}² − ${u2}) ÷ (2 × ${s}) = ${ms2(back)}` },
      { context: c.ask, u, a, s, v2, v: v.toFixed(5) },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Stopping distances
// ---------------------------------------------------------------------------------------------

interface HighwaySpeed {
  mph: number
  /** Thinking distances at this speed, metres: a reaction of about 0.3 s up to 0.9 s. */
  thinking: [number, number]
  /** The Highway Code's typical braking distance on a dry road, metres. */
  braking: number
}
const HIGHWAY: HighwaySpeed[] = [
  { mph: 20, thinking: [3, 8], braking: 6 },
  { mph: 30, thinking: [4, 12], braking: 14 },
  { mph: 40, thinking: [5, 16], braking: 24 },
  { mph: 50, thinking: [7, 20], braking: 38 },
  { mph: 60, thinking: [8, 24], braking: 55 },
  { mph: 70, thinking: [9, 28], braking: 75 },
]
/** Road conditions, with how much they multiply the dry braking distance. */
const ROADS: { text: string; factor: [number, number] }[] = [
  { text: '', factor: [0.8, 1.2] },
  { text: ' on a wet road', factor: [1.5, 2.5] },
  { text: ' on an icy road', factor: [4, 10] },
]
const VEHICLES = ['car', 'van', 'lorry', 'motorbike', 'taxi', 'coach']
/** Lorries and coaches are limited to 60 mph. */
const vehiclesAt = (mph: number) => (mph > 60 ? VEHICLES.filter((v) => v !== 'lorry' && v !== 'coach') : VEHICLES)

/**
 * Stopping distance as thinking plus braking: written as q1 (9 m and 14 m at 30 mph, 2
 * marks). The figures are the Highway Code's for the speed, with a wet or icy road
 * lengthening the braking distance only.
 */
export const stoppingDistanceFromParts: Generator = {
  id: 'stopping-distance-from-parts',
  subjectId: 'physics',
  topicId: STOPPING,
  replaces: ['q1'],
  build(r, slot, turn) {
    const h = HIGHWAY[turn % HIGHWAY.length]!
    const road = pick(r, ROADS)
    const vehicle = pick(r, vehiclesAt(h.mph))
    const { thinking, braking } = draw(
      r,
      (r) => ({ thinking: int(r, ...h.thinking), braking: int(r, Math.ceil(h.braking * road.factor[0]), Math.floor(h.braking * road.factor[1])) }),
      ({ thinking, braking }) => thinking !== braking && thinking + braking !== h.mph,
    )
    const answer = thinking + braking
    const prompt = pick(r, [
      `At ${h.mph} mph${road.text}, a ${vehicle}'s thinking distance is ${thinking} m and its braking distance is ${braking} m. Calculate the stopping distance.`,
      `A ${vehicle} travelling at ${h.mph} mph${road.text} has a thinking distance of ${thinking} m and a braking distance of ${braking} m. What is its stopping distance, in metres?`,
    ])
    // Second route: the stopping distance less the braking distance is the thinking distance.
    return numeric(
      slot,
      {
        prompt,
        solution: `Stopping distance $=$ thinking distance $+$ braking distance $= ${thinking} + ${braking} = ${answer}$ m.${road.text ? ` The ${road.text.replace(' on an ', '').replace(' on a ', '')} lengthens the braking distance, not the thinking distance.` : ''}`,
        method: [`$${thinking} + ${braking}$`],
        answer,
        units: 'm',
      },
      { agrees: answer - braking === thinking && answer > braking, detail: `${answer} − ${braking} = ${answer - braking}` },
      { context: `${h.mph} mph${road.text}`, vehicle, thinking, braking },
    )
  },
}

interface Driver {
  noun: string
  driver: string
  v: [number, number]
  /** Reaction times, seconds: alert 0.2–0.6, tired or distracted 0.7–0.9. Never 1.0, which would make the thinking distance the speed. */
  react: [number, number]
  /** Why the reaction is slow, as a phrase after "is": "distracted by a phone". */
  state?: string
  /** The same as a single adjective before "driver": "distracted". */
  adj?: string
}
const DRIVERS: Driver[] = [
  { noun: 'a car', driver: 'driver', v: [10, 30], react: [0.2, 0.6] },
  { noun: 'a car', driver: 'driver', v: [10, 30], react: [0.7, 0.9], state: 'tired', adj: 'tired' },
  { noun: 'a lorry', driver: 'driver', v: [10, 25], react: [0.3, 0.7] },
  { noun: 'a motorbike', driver: 'rider', v: [10, 30], react: [0.2, 0.6] },
  { noun: 'a bus', driver: 'driver', v: [8, 20], react: [0.3, 0.7] },
  { noun: 'a van', driver: 'driver', v: [10, 25], react: [0.7, 0.9], state: 'distracted by a phone', adj: 'distracted' },
  { noun: 'a bicycle', driver: 'rider', v: [4, 12], react: [0.2, 0.6] },
  { noun: 'a taxi', driver: 'driver', v: [10, 25], react: [0.3, 0.7] },
]

/**
 * Thinking distance = speed × reaction time: written as q3 (20 m/s and 0.5 s, 2 marks).
 * Reaction times in tenths of a second, longer for a tired or distracted driver, and never
 * 1.0 s, which would make the answer the speed.
 */
export const thinkingDistance: Generator = {
  id: 'thinking-distance',
  subjectId: 'physics',
  topicId: STOPPING,
  replaces: ['q3'],
  build(r, slot, turn) {
    const c = DRIVERS[turn % DRIVERS.length]!
    const v = int(r, ...c.v)
    const react = stepped(r, c.react[0], c.react[1], 0.1)
    const d = clean(v * react)
    const prompt = c.state
      ? pick(r, [
          `A ${c.adj} ${c.driver} has a reaction time of ${show(react)} s. ${cap(c.noun.replace(/^an? /, 'the '))} is travelling at ${v} m/s. Calculate the thinking distance, in metres.`,
          `${cap(c.noun)} travels at ${v} m/s. The ${c.driver} is ${c.state}, and has a reaction time of ${show(react)} s. Calculate the thinking distance.`,
        ])
      : pick(r, [
          `${cap(c.noun)} travels at ${v} m/s. The ${c.driver}'s reaction time is ${show(react)} s. Calculate the thinking distance.`,
          `${cap(c.noun)} is travelling at ${v} m/s when the ${c.driver} sees a hazard. The ${c.driver}'s reaction time is ${show(react)} s. Calculate the thinking distance, in metres.`,
        ])
    // Second route: the thinking distance over the reaction time gives the speed back.
    return numeric(
      slot,
      {
        prompt,
        solution: `Thinking distance ${closes(`= ${v} \\times ${show(react)}`, d, 'm')} ${cap(c.noun.replace(/^an? /, 'the '))} keeps moving at ${v} m/s for the whole of the reaction time.`,
        method: [`$${v} \\times ${show(react)}$`],
        answer: d,
        tolerance: dpTolerance(d),
        units: 'm',
      },
      { agrees: near(d / react, v) && react < 1, detail: `${show(d)} ÷ ${show(react)} = ${show(d / react)} m/s` },
      { context: `${c.noun}${c.state ? `, ${c.state}` : ''}`, v, react },
    )
  },
}

/**
 * Reaction time = thinking distance ÷ speed: written as q5 (18 m at 24 m/s, 0.75 s, 2
 * marks). Reaction times in twentieths of a second, as the written 0.75 is, and the thinking
 * distance a whole number of metres. The reaction time is drawn first and the speed from
 * the multiples that make the distance whole, so each reaction time is drawn evenly: 0.5 s
 * needs only an even speed and was the answer in a quarter of draws.
 */
export const reactionTimeFromThinkingDistance: Generator = {
  id: 'reaction-time-from-thinking-distance',
  subjectId: 'physics',
  topicId: STOPPING,
  replaces: ['q5'],
  build(r, slot, turn) {
    const c = DRIVERS[turn % DRIVERS.length]!
    const { v, react, d } = draw(
      r,
      (r) => {
        const react = stepped(r, c.react[0], c.react[1], 0.05)
        // react is n/20 in lowest terms, so the distance is whole when the speed is a multiple of the denominator.
        const v = multipleIn(r, 20 / gcd(Math.round(react * 20), 20), c.v[0], c.v[1])
        return { v, react, d: clean(v * react) }
      },
      ({ v, react, d }) => v > 0 && Number.isInteger(d) && d !== v && react < 1,
    )
    const prompt = pick(r, [
      `A ${c.driver} travelling at ${v} m/s has a thinking distance of ${d} m. Calculate the ${c.driver}'s reaction time.`,
      `${cap(c.noun)} travelling at ${v} m/s has a thinking distance of ${d} m. Calculate the ${c.driver}'s reaction time, in seconds.`,
    ])
    // Second route: forwards, the speed times the reaction time is the thinking distance.
    return numeric(
      slot,
      {
        prompt,
        solution: `Thinking distance $=$ speed $\\times$ reaction time, so reaction time ${closes(`= ${d} \\div ${v}`, react, 's')}`,
        method: [`$${d} \\div ${v}$`],
        answer: react,
        tolerance: dpTolerance(react),
        units: 's',
      },
      { agrees: near(v * react, d), detail: `${v} × ${show(react)} = ${show(v * react)} m` },
      { context: `${c.noun}${c.state ? `, ${c.state}` : ''}`, v, d },
    )
  },
}

interface Massive {
  noun: string
  /** Whose kinetic energy: "its", or "their" for a cyclist and bike. */
  its: string
  mass: [number, number]
  step: number
  v: [number, number]
  a: [number, number]
}
/** Vehicles with the masses and speeds they have and the decelerations their brakes give. */
const MASSIVE: Massive[] = [
  { noun: 'car', its: 'its', mass: [900, 1800], step: 50, v: [10, 30], a: [3, 9] },
  { noun: 'van', its: 'its', mass: [1800, 3000], step: 100, v: [10, 25], a: [2, 8] },
  { noun: 'lorry', its: 'its', mass: [10000, 30000], step: 1000, v: [10, 25], a: [1.5, 5] },
  { noun: 'bus', its: 'its', mass: [10000, 14000], step: 500, v: [8, 20], a: [1.5, 5] },
  { noun: 'motorbike and rider', its: 'their', mass: [250, 350], step: 10, v: [15, 35], a: [3, 9] },
  { noun: 'cyclist and bike', its: 'their', mass: [70, 100], step: 1, v: [4, 12], a: [1, 4] },
  { noun: 'train', its: 'its', mass: [40000, 100000], step: 5000, v: [20, 40], a: [0.5, 1.5] },
  { noun: 'tram', its: 'its', mass: [30000, 40000], step: 1000, v: [5, 15], a: [1, 2] },
]

/** A mass, speed and deceleration from a vehicle's ranges, with the kinetic energy, braking distance and force all whole. */
function stopping(r: Rng, c: Massive, ok: (x: { m: number; v: number; a: number; E: number; s: number; F: number }) => boolean = () => true) {
  return draw(
    r,
    (r) => {
      const m = stepped(r, c.mass[0], c.mass[1], c.step)
      const v = int(r, ...c.v)
      const a = stepped(r, c.a[0], c.a[1], 0.5)
      const E = clean((m * v * v) / 2)
      const s = clean((v * v) / (2 * a))
      return { m, v, a, E, s, F: clean(m * a) }
    },
    // Never a = 1: the force would be the mass.
    (x) => Number.isInteger(x.E) && Number.isInteger(x.s) && Number.isInteger(x.F) && x.s !== x.v && x.s !== x.m && x.a !== 1 && ok(x),
  )
}

/**
 * Braking force as kinetic energy over braking distance: written as q8 (a 900 kg car at
 * 10 m/s stopping in 15 m, 3000 N, 3 marks). The distance comes from a deceleration the
 * vehicle's brakes really give, so the force is whole and believable.
 */
export const brakingForceFromKineticEnergy: Generator = {
  id: 'braking-force-from-kinetic-energy',
  subjectId: 'physics',
  topicId: STOPPING,
  replaces: ['q8'],
  build(r, slot, turn) {
    const c = MASSIVE[turn % MASSIVE.length]!
    const { m, v, a, E, s, F } = stopping(r, c)
    const plural = c.its === 'their'
    const prompt = pick(r, [
      `A ${massed(c.noun, m)} travelling at ${v} m/s ${plural ? 'stop' : 'stops'} in a braking distance of ${prose(s)} m. Calculate the braking force.`,
      `A ${c.noun} of mass ${prose(m)} kg ${plural ? 'are' : 'is'} travelling at ${v} m/s. The brakes bring ${plural ? 'them' : 'it'} to a stop in ${prose(s)} m. Calculate the braking force, in newtons.`,
    ])
    // Second route: the force times the distance is the work done, which is the kinetic energy; and F = ma.
    return numeric(
      slot,
      {
        prompt,
        solution: `$E_k = \\tfrac{1}{2} \\times ${tex(m)} \\times ${v}^2 = ${tex(E)}$ J. Work done by the brakes equals this: $F s = E_k$, so ${closes(`F = ${tex(E)} \\div ${tex(s)}`, F, 'N')}`,
        method: [`$E_k = \\tfrac{1}{2} \\times ${tex(m)} \\times ${v}^2 = ${tex(E)}$ J`, `$F = ${tex(E)} \\div ${tex(s)}$`],
        answer: F,
        units: 'N',
      },
      { agrees: near(F * s, E) && near(m * a, F), detail: `${F} × ${s} = ${show(F * s)} J; ${m} × ${show(a)} = ${show(m * a)} N` },
      { context: c.noun, m, v, a, E, s },
    )
  },
}

interface Scaled {
  noun: string
  vmax: number
  a: [number, number]
}
const SCALED: Scaled[] = [
  { noun: 'car', vmax: 30, a: [3, 8] },
  { noun: 'lorry', vmax: 25, a: [1.5, 5] },
  { noun: 'van', vmax: 25, a: [2, 8] },
  { noun: 'motorbike', vmax: 35, a: [3, 9] },
  { noun: 'bicycle', vmax: 12, a: [1, 4] },
  { noun: 'bus', vmax: 20, a: [1.5, 5] },
  { noun: 'train', vmax: 60, a: [0.5, 1.5] },
]
const RATIOS = [1.5, 2, 3, 4]
const TIMES: Record<number, string> = { 1.5: '1.5 times', 2: 'Twice', 3: 'Three times', 4: 'Four times' }

/**
 * Braking distance ∝ v²: written as q9 (8 m at 10 m/s, so 72 m at 30 m/s, 2 marks). A
 * clean speed ratio of 1.5, 2, 3 or 4, and distances from the decelerations the vehicle's
 * brakes really give, so the faster distance stays believable. Sometimes the slower speed
 * is asked for, dividing by the square.
 */
export const brakingDistanceAtAnotherSpeed: Generator = {
  id: 'braking-distance-at-another-speed',
  subjectId: 'physics',
  topicId: STOPPING,
  replaces: ['q9'],
  build(r, slot, turn) {
    const c = SCALED[turn % SCALED.length]!
    const faster = r() < 0.7
    const k = pick(r, RATIOS)
    const k2 = clean(k * k)
    const { v1, v2, d1, d2 } = draw(
      r,
      (r) => {
        // The slow pair is drawn first whichever speed is asked for, and the fast pair scaled
        // up from it, so both are whole by construction: scaling the fast pair down left
        // almost nothing acceptable at a ratio of 4.
        const slow = int(r, 3, Math.floor(c.vmax / k))
        const dSlow = int(r, Math.ceil((slow * slow) / (2 * c.a[1])), Math.floor((slow * slow) / (2 * c.a[0])))
        const fast = clean(slow * k)
        const dFast = clean(dSlow * k2)
        return faster ? { v1: slow, d1: dSlow, v2: fast, d2: dFast } : { v1: fast, d1: dFast, v2: slow, d2: dSlow }
      },
      // Never d1 = k²: squaring the given distance would give the answer.
      ({ v1, v2, d1, d2 }) => Number.isInteger(v1) && Number.isInteger(v2) && Number.isInteger(d1) && Number.isInteger(d2) && d1 >= 2 && d2 >= 2 && d1 !== v1 && d2 !== v2 && d1 !== v2 && d2 !== v1 && d1 !== k2,
    )
    const prompt = pick(r, [
      `A ${c.noun}'s braking distance at ${v1} m/s is ${prose(d1)} m. Estimate its braking distance at ${v2} m/s with the same braking force.`,
      `At ${v1} m/s a ${c.noun} has a braking distance of ${prose(d1)} m. With the same braking force, estimate its braking distance at ${v2} m/s, in metres.`,
    ])
    const solution = faster
      ? `Braking distance is proportional to speed squared. ${TIMES[k]} the speed gives $${show(k)}^2 = ${show(k2)}$ times the distance: ${closes(`${tex(d1)} \\times ${show(k2)}`, d2, 'm')}`
      : `Braking distance is proportional to speed squared. The speed is divided by ${show(k)}, so the distance is divided by $${show(k)}^2 = ${show(k2)}$: ${closes(`${tex(d1)} \\div ${show(k2)}`, d2, 'm')}`
    // Second route: the ratio of the distances is the square of the ratio of the speeds.
    return numeric(
      slot,
      {
        prompt,
        solution,
        method: [faster ? `$\\times ${show(k2)}$, from $${show(k)}^2$` : `$\\div ${show(k2)}$, from $${show(k)}^2$`],
        answer: d2,
        units: 'm',
      },
      { agrees: near(d2 / d1, (v2 / v1) ** 2), detail: `${d2} ÷ ${d1} = ${show(d2 / d1)}; (${v2} ÷ ${v1})² = ${show((v2 / v1) ** 2)}` },
      { context: c.noun, direction: faster ? 'faster' : 'slower', k, v1, d1, v2 },
    )
  },
}

interface Decelerating {
  noun: string
  mass: [number, number]
  step: number
  u: [number, number]
  a: [number, number]
  t: [number, number]
}
/** Vehicles braking hard, with the decelerations an emergency stop really gives and the times it takes. */
const DECELERATING: Decelerating[] = [
  { noun: 'car', mass: [900, 1800], step: 50, u: [10, 30], a: [5, 8], t: [2, 6] },
  { noun: 'lorry', mass: [10000, 30000], step: 1000, u: [10, 25], a: [1.5, 5], t: [3, 12] },
  { noun: 'van', mass: [1800, 3000], step: 100, u: [10, 25], a: [3, 8], t: [2, 8] },
  { noun: 'bus', mass: [10000, 14000], step: 500, u: [8, 20], a: [1.5, 5], t: [2, 10] },
  { noun: 'motorbike and rider', mass: [250, 350], step: 10, u: [15, 35], a: [4, 9], t: [2, 8] },
  { noun: 'cyclist and bike', mass: [70, 100], step: 1, u: [4, 12], a: [1, 4], t: [2, 6] },
  { noun: 'train', mass: [40000, 100000], step: 5000, u: [20, 50], a: [0.5, 1.5], t: [20, 60] },
  { noun: 'tram', mass: [30000, 40000], step: 1000, u: [8, 20], a: [1, 2], t: [5, 15] },
]

/** A mass, a deceleration and a time whose product with the deceleration is a whole speed in range, and whose force is whole. */
function forced(r: Rng, c: Decelerating, tstep: number, ok: (x: { m: number; u: number; t: number; a: number; F: number }) => boolean) {
  return draw(
    r,
    (r) => {
      const m = stepped(r, c.mass[0], c.mass[1], c.step)
      const a = stepped(r, c.a[0], c.a[1], 0.5)
      const t = stepped(r, c.t[0], c.t[1], tstep)
      return { m, u: clean(a * t), t, a, F: clean(m * a) }
    },
    (x) => Number.isInteger(x.u) && x.u >= c.u[0] && x.u <= c.u[1] && Number.isInteger(x.F) && x.a !== x.t && x.a !== x.u && x.u !== x.t && ok(x),
  )
}

/**
 * Braking force from a stopping time: written as q11 (a 1200 kg car from 30 m/s in 3 s,
 * 12 000 N, 3 marks). The deceleration is one an emergency stop gives, so the force is the
 * size a real braking force is.
 */
export const brakingForceFromStoppingTime: Generator = {
  id: 'braking-force-from-stopping-time',
  subjectId: 'physics',
  topicId: STOPPING,
  replaces: ['q11'],
  build(r, slot, turn) {
    const c = DECELERATING[turn % DECELERATING.length]!
    const { m, u, t, a, F } = forced(r, c, 1, () => true)
    const plural = c.noun.includes(' and ')
    const prompt = pick(r, [
      `Estimate the average braking force on a ${massed(c.noun, m)} that ${plural ? 'stop' : 'stops'} from ${u} m/s in ${t} s.`,
      `A ${c.noun} of mass ${prose(m)} kg ${plural ? 'brake' : 'brakes'} from ${u} m/s to a stop in ${t} s. Estimate the average braking force on ${plural ? 'them' : 'it'}, in newtons.`,
    ])
    // Second route: the force over the mass gives the deceleration, and that times the time the speed.
    return numeric(
      slot,
      {
        prompt,
        solution: `$a = ${u} \\div ${t} = ${show(a)}$ m/s². ${closes(`F = m a = ${tex(m)} \\times ${show(a)}`, F, 'N')}`,
        method: [`$a = ${u} \\div ${t} = ${show(a)}$ m/s²`, `$${tex(m)} \\times ${show(a)}$`],
        answer: F,
        units: 'N',
      },
      { agrees: near(F / m, a) && near(a * t, u), detail: `${F} ÷ ${m} = ${ms2(F / m)}; ${show(a)} × ${t} = ${show(a * t)} m/s` },
      { context: c.noun, m, u, t, a },
    )
  },
}

interface Full {
  noun: string
  driver: string
  u: [number, number]
  react: [number, number]
  a: [number, number]
}
const FULL: Full[] = [
  { noun: 'a car', driver: 'driver', u: [10, 30], react: [0.2, 0.9], a: [2.5, 8] },
  { noun: 'a lorry', driver: 'driver', u: [10, 25], react: [0.3, 0.9], a: [1.5, 5] },
  { noun: 'a van', driver: 'driver', u: [10, 25], react: [0.3, 0.9], a: [2, 8] },
  { noun: 'a motorbike', driver: 'rider', u: [10, 30], react: [0.2, 0.8], a: [3, 9] },
  { noun: 'a bus', driver: 'driver', u: [8, 20], react: [0.3, 0.9], a: [1.5, 5] },
  { noun: 'a taxi', driver: 'driver', u: [10, 25], react: [0.3, 0.9], a: [2.5, 8] },
]

/**
 * Thinking distance plus braking distance from a reaction time and a deceleration: written
 * as q14 (25 m/s, 0.6 s and 6.25 m/s², 65 m, 4 marks). Both distances are whole numbers and
 * never equal, and the reaction time is never 1.0 s.
 */
export const stoppingDistanceFromReactionAndDeceleration: Generator = {
  id: 'stopping-distance-from-reaction-and-deceleration',
  subjectId: 'physics',
  topicId: STOPPING,
  replaces: ['q14'],
  build(r, slot, turn) {
    const c = FULL[turn % FULL.length]!
    const { u, react, a, thinking, braking } = draw(
      r,
      (r) => {
        const { u, a, s } = brakingPair(r, c.u, c.a)
        const react = stepped(r, c.react[0], c.react[1], 0.1)
        return { u, react, a, thinking: clean(u * react), braking: s }
      },
      ({ u, react, a, thinking, braking }) => cleanBraking({ u, a, s: braking }) && Number.isInteger(thinking) && thinking !== braking && thinking !== u && thinking + braking !== u && react < 1,
    )
    const u2 = u * u
    const a2 = clean(2 * a)
    const answer = thinking + braking
    const prompt = pick(r, [
      `${cap(c.noun)} travels at ${u} m/s. The ${c.driver}'s reaction time is ${show(react)} s and the brakes give a deceleration of ${show(a)} m/s². Calculate the total stopping distance.`,
      `${cap(c.noun)} is travelling at ${u} m/s when the ${c.driver} sees a hazard. The ${c.driver}'s reaction time is ${show(react)} s, and the brakes then give a deceleration of ${show(a)} m/s². Calculate the total stopping distance, in metres.`,
    ])
    // Second route: forwards from the parts, each by its own equation.
    const forward = u * react + u2 / (2 * a)
    return numeric(
      slot,
      {
        prompt,
        solution: `Thinking distance $= ${u} \\times ${show(react)} = ${thinking}$ m. Braking distance from $v^2 - u^2 = 2 a s$: $0 - ${tex(u2)} = 2 \\times (-${show(a)}) \\times s$, so $s = ${tex(u2)} \\div ${show(a2)} = ${braking}$ m. Stopping distance $= ${thinking} + ${braking} = ${answer}$ m.`,
        method: [`thinking distance $${u} \\times ${show(react)} = ${thinking}$ m`, `$${tex(u2)} = ${show(a2)} s$ or equivalent`, `braking distance ${braking} m`],
        answer,
        units: 'm',
      },
      { agrees: near(forward, answer) && near(2 * a * braking, u2), detail: `${u} × ${show(react)} + ${u2} ÷ (2 × ${show(a)}) = ${show(forward)} m` },
      { context: c.noun, u, react, a, thinking, braking },
    )
  },
}

const DROPS: ((d: number) => string)[] = [
  (d) => `In a ruler drop test a student catches the ruler after it has fallen ${d} cm.`,
  (d) => `A student measures a friend's reaction time with a ruler drop test. The ruler falls ${d} cm before it is caught.`,
  (d) => `In a ruler drop test the ruler is released from the 0 cm mark at the catcher's fingers and caught at the ${d} cm mark.`,
  (d) => `A student's reaction time is measured with a ruler drop test. The ruler drops ${d} cm before the student grabs it.`,
  (d) => `A ruler is held just above a student's open fingers and let go without warning. The student catches it after it has dropped ${d} cm.`,
  (d) => `In a reaction test a metre rule is dropped between a student's finger and thumb. It falls ${d} cm before the student catches it.`,
]

/**
 * Reaction time from a ruler drop, to 2 significant figures: written as q15 (30 cm, 0.25 s,
 * 3 marks). A fall of 12 cm to 45 cm, as a ruler drop gives; the root is never clean, and
 * the drop is redrawn when the answer would round to a 0 the box cannot print (0.20 s).
 */
export const reactionTimeFromRulerDrop: Generator = {
  id: 'reaction-time-from-a-ruler-drop',
  subjectId: 'physics',
  topicId: STOPPING,
  replaces: ['q15'],
  build(r, slot, turn) {
    const text = DROPS[turn % DROPS.length]!
    const { d, s, t2, t } = draw(
      r,
      (r) => {
        // No drop under 12 cm: 8 cm would be 0.13 s, quicker than anyone reacts.
        const d = int(r, 12, 45)
        const s = d / 100
        const t2 = (2 * s) / 9.8
        return { d, s, t2, t: Math.sqrt(t2) }
      },
      // The printed √(t² to 3 figures) must agree with the exact root to the 3 figures printed.
      ({ t2, t }) => roundsWell(t, 2) && sigFigs(Math.sqrt(sigFigs(t2, 3)), 3) === sigFigs(t, 3),
    )
    const sText = s.toFixed(2)
    const t2Text = sigText(t2, 3)
    const answer = sigFigs(t, 2)
    const tolerance = sfTolerance(answer, 2)
    // Second route: forwards, ½gt² with the exact root is the distance in metres, and the rounded answer is within half a unit of its last figure of the root.
    const back = 0.5 * 9.8 * t * t
    return numeric(
      slot,
      {
        prompt: `${text(d)} Use $s = \\tfrac{1}{2} g t^2$ with $g = 9.8$ m/s² to calculate the reaction time. Give your answer to 2 significant figures.`,
        solution: `$t = \\sqrt{2 s \\div g} = \\sqrt{2 \\times ${sText} \\div 9.8} = \\sqrt{${t2Text}} = ${unrounded(t, 4)}$ s, so **${sigText(answer, 2)} s** to 2 significant figures. Note the conversion of ${d} cm to ${sText} m.`,
        method: [`$t^2 = 2 \\times ${sText} \\div 9.8$`, 'square root taken'],
        answer,
        tolerance,
        units: 's',
        line: `${sigText(answer, 2)} s`,
      },
      { agrees: near(back, s) && Math.abs(t - answer) <= halfUnit(answer, 2), detail: `½ × 9.8 × ${t.toFixed(5)}² = ${show(back)} m; ${d} cm = ${sText} m; root ${t.toFixed(5)} rounds to ${sigText(answer, 2)}` },
      { context: text(0).slice(0, 24), d, s: sText, t2: t2.toFixed(6), t: t.toFixed(5) },
    )
  },
}

interface Crash {
  /** The setup, given the thing with its mass ("1500 kg car", "car of mass 1800 kg"), the speed and the time. */
  text: (who: string, u: number, t: string) => string
  noun: string
  on: string
  why: string
  mass: [number, number]
  step: number
  u: [number, number]
  t: [number, number]
}
/** Things brought to rest suddenly, with the masses and speeds they have and the times a real impact takes. */
const CRASHES: Crash[] = [
  { text: (who, u, t) => `In a crash, a ${who} travelling at ${u} m/s is brought to rest in ${t} s.`, noun: 'car', on: 'the car', why: 'A force this size is why crashes are so damaging; crumple zones lengthen the time and lower it.', mass: [900, 1800], step: 50, u: [10, 30], t: [0.2, 0.9] },
  { text: (who, u, t) => `A ${who} travelling at ${u} m/s hits a barrier and stops in ${t} s.`, noun: 'van', on: 'the van', why: 'Crumple zones lengthen the stopping time, and a longer time means a smaller force.', mass: [1800, 3000], step: 100, u: [10, 25], t: [0.3, 0.9] },
  { text: (who, u, t) => `A ${who} travelling at ${u} m/s crashes and is brought to rest in ${t} s.`, noun: 'lorry', on: 'the lorry', why: 'The same change in motion over a longer time would mean a smaller force.', mass: [10000, 30000], step: 1000, u: [10, 25], t: [0.5, 1.5] },
  { text: (who, u, t) => `A ${who} are travelling at ${u} m/s when they hit a crash barrier and stop in ${t} s.`, noun: 'motorbike and rider with a combined mass of', on: 'the motorbike and rider', why: 'Barriers that give way lengthen the stopping time and lower the force.', mass: [250, 350], step: 10, u: [15, 35], t: [0.2, 0.6] },
  { text: (who, u, t) => `In a crash test, a ${who} moving at ${u} m/s is stopped by an airbag in ${t} s.`, noun: 'crash-test dummy', on: 'the dummy', why: 'The airbag lengthens the stopping time; stopped by the dashboard in a fraction of that time, the force would be far larger.', mass: [70, 80], step: 1, u: [10, 20], t: [0.1, 0.4] },
  { text: (who, u, t) => `A fielder catches a ${who} travelling at ${u} m/s, bringing it to rest in ${t} s.`, noun: 'cricket ball', on: 'the ball', why: 'A fielder draws the hands back as the ball arrives: a longer stopping time means a smaller force on the hands.', mass: [0.16, 0.16], step: 0.01, u: [20, 40], t: [0.1, 0.4] },
  { text: (who, u, t) => `A ${who} lands on a mat at ${u} m/s and is brought to rest in ${t} s.`, noun: 'gymnast', on: 'the gymnast', why: 'Bending the knees and a thick mat lengthen the stopping time and lower the force.', mass: [50, 80], step: 1, u: [4, 8], t: [0.1, 0.4] },
  { text: (who, u, t) => `A ${who} rolls into the buffers at ${u} m/s and is brought to rest in ${t} s.`, noun: 'train', on: 'the train', why: 'The buffers compress to lengthen the stopping time and lower the force.', mass: [40000, 100000], step: 5000, u: [2, 5], t: [0.5, 2] },
]

/**
 * The average force in an impact, from a = Δv ÷ t then F = ma: written as q17 (a 1500 kg
 * car from 20 m/s in 0.5 s, 60 000 N, 3 marks). The deceleration is whole, the time is never
 * a whole second (the deceleration would equal the speed), and each context ends with why a
 * longer time means a smaller force.
 */
export const crashForce: Generator = {
  id: 'crash-force',
  subjectId: 'physics',
  topicId: STOPPING,
  replaces: ['q17'],
  build(r, slot, turn) {
    const c = CRASHES[turn % CRASHES.length]!
    const { m, u, t, a, F } = draw(
      r,
      (r) => {
        const m = stepped(r, c.mass[0], c.mass[1], c.step)
        const u = int(r, ...c.u)
        const t = stepped(r, c.t[0], c.t[1], 0.1)
        const a = clean(u / t)
        return { m, u, t, a, F: clean(m * a) }
      },
      ({ u, t, a, F }) => Number.isInteger(a) && Number.isInteger(F) && F >= 10 && a !== u && t !== 1 && u !== t,
    )
    // Second route: the force over the mass gives the deceleration, and that times the time the speed.
    return numeric(
      slot,
      {
        prompt: `${c.text(c.noun.endsWith(' of') ? `${c.noun} ${prose(m)} kg` : massed(c.noun, m), u, show(t))} Estimate the average force on ${c.on}.`,
        solution: `$a = ${u} \\div ${show(t)} = ${a}$ m/s². ${closes(`F = m a = ${tex(m)} \\times ${a}`, F, 'N')} ${c.why}`,
        method: [`$a = ${u} \\div ${show(t)} = ${a}$ m/s²`, `$${tex(m)} \\times ${a}$`],
        answer: F,
        units: 'N',
      },
      { agrees: near(F / m, a) && near(a * t, u), detail: `${F} ÷ ${show(m)} = ${ms2(F / m)}; ${a} × ${show(t)} = ${show(a * t)} m/s` },
      { context: c.on, m, u, t, a },
    )
  },
}

interface Braked {
  /** The setup, given the vehicle with its mass ("1000 kg car", "car of mass 1800 kg"), its speed and the brakes' mass and specific heat capacity. */
  text: (who: string, v: number, md: string, c: number) => string
  noun: string
  what: string
  whose: string
  mass: [number, number]
  step: number
  v: [number, number]
  disc: [number, number]
  dstep: number
  c: number
}
/** Vehicles and the brakes that take their kinetic energy, with the masses the brake parts really have: steel 450 J/kg°C, aluminium rims 900. */
const BRAKED: Braked[] = [
  { text: (who, v, md, c) => `A ${who} travelling at ${v} m/s brakes to a stop. All of its kinetic energy is transferred to the thermal store of its four brake discs, which have a total mass of ${md} kg and a specific heat capacity of ${c} J/kg°C.`, noun: 'car', what: 'the discs', whose: "the car's", mass: [900, 1800], step: 50, v: [10, 30], disc: [8, 16], dstep: 1, c: 450 },
  { text: (who, v, md, c) => `A ${who} brake to a stop from ${v} m/s. All of their kinetic energy is transferred to the thermal store of the two brake discs, which have a total mass of ${md} kg and a specific heat capacity of ${c} J/kg°C.`, noun: 'motorbike and rider of total mass', what: 'the discs', whose: "the motorbike's", mass: [250, 350], step: 10, v: [15, 35], disc: [2, 4], dstep: 0.5, c: 450 },
  { text: (who, v, md, c) => `A ${who} travelling at ${v} m/s brakes to a stop. All of its kinetic energy is transferred to the thermal store of its brake drums, which have a total mass of ${md} kg and a specific heat capacity of ${c} J/kg°C.`, noun: 'lorry', what: 'the drums', whose: "the lorry's", mass: [10000, 30000], step: 1000, v: [10, 25], disc: [80, 200], dstep: 10, c: 450 },
  { text: (who, v, md, c) => `A ${who} brakes to a stop from ${v} m/s. All of its kinetic energy is transferred to the thermal store of the brake discs on its axles, which have a total mass of ${md} kg and a specific heat capacity of ${c} J/kg°C.`, noun: 'train', what: 'the discs', whose: "the train's", mass: [40000, 100000], step: 5000, v: [20, 40], disc: [400, 1000], dstep: 50, c: 450 },
  { text: (who, v, md, c) => `A ${who} brake to a stop from ${v} m/s. All of their kinetic energy is transferred to the thermal store of the two aluminium wheel rims, which have a total mass of ${md} kg and a specific heat capacity of ${c} J/kg°C.`, noun: 'cyclist and bike of total mass', what: 'the rims', whose: "the cyclist's", mass: [70, 100], step: 1, v: [5, 12], disc: [0.5, 1], dstep: 0.1, c: 900 },
  { text: (who, v, md, c) => `A ${who} travelling at ${v} m/s brakes to a stop. All of its kinetic energy is transferred to the thermal store of its four brake discs, which have a total mass of ${md} kg and a specific heat capacity of ${c} J/kg°C.`, noun: 'van', what: 'the discs', whose: "the van's", mass: [1800, 3000], step: 100, v: [10, 25], disc: [12, 20], dstep: 1, c: 450 },
  { text: (who, v, md, c) => `A ${who} brakes to a stop from ${v} m/s. All of its kinetic energy is transferred to the thermal store of its brake discs, which have a total mass of ${md} kg and a specific heat capacity of ${c} J/kg°C.`, noun: 'tram', what: 'the discs', whose: "the tram's", mass: [30000, 40000], step: 1000, v: [5, 15], disc: [200, 400], dstep: 50, c: 450 },
  { text: (who, v, md, c) => `A ${who} brake to a stop from ${v} m/s. All of their kinetic energy is transferred to the thermal store of the single steel brake disc, which has a mass of ${md} kg and a specific heat capacity of ${c} J/kg°C.`, noun: 'go-kart and driver of total mass', what: 'the disc', whose: "the go-kart's", mass: [150, 200], step: 10, v: [15, 25], disc: [1, 2], dstep: 0.5, c: 450 },
]

/**
 * Kinetic energy into the thermal store of the brakes, to 3 significant figures: written as
 * q19 (a 1000 kg car at 20 m/s, 10 kg of discs at 450 J/kg°C, 44.4 °C, 4 marks). The brake
 * mass is what the vehicle's brakes really weigh, so the rise is one that happens; the
 * division never comes out to three figures by itself.
 */
export const brakeTemperatureRise: Generator = {
  id: 'brake-temperature-rise',
  subjectId: 'physics',
  topicId: STOPPING,
  replaces: ['q19'],
  build(r, slot, turn) {
    const c = BRAKED[turn % BRAKED.length]!
    const { m, v, md, E, mc, rise } = draw(
      r,
      (r) => {
        const m = stepped(r, c.mass[0], c.mass[1], c.step)
        const v = int(r, ...c.v)
        const md = stepped(r, c.disc[0], c.disc[1], c.dstep)
        const E = clean((m * v * v) / 2)
        const mc = clean(md * c.c)
        return { m, v, md, E, mc, rise: E / mc }
      },
      ({ E, rise }) => Number.isInteger(E) && rise >= 5 && rise <= 350 && roundsWell(rise, 3),
    )
    const answer = sigFigs(rise, 3)
    const tolerance = sfTolerance(answer, 3)
    // Second route: the exact rise times the brakes' mass and specific heat capacity is the kinetic energy, and the rounded answer is within its tolerance of it.
    return numeric(
      slot,
      {
        prompt: `${c.text(c.noun.endsWith(' mass') ? `${c.noun} ${prose(m)} kg` : massed(c.noun, m), v, show(md), c.c)} Calculate the temperature rise of ${c.what}. Give your answer to 3 significant figures.`,
        solution: `$E_k = \\tfrac{1}{2} \\times ${tex(m)} \\times ${v}^2 = ${tex(E)}$ J. $\\Delta E = m c \\Delta\\theta$, so $\\Delta\\theta = \\dfrac{\\Delta E}{m c} = \\dfrac{${tex(E)}}{${tex(md)} \\times ${c.c}} = \\dfrac{${tex(E)}}{${tex(mc)}} = ${unrounded(rise, 4)}$, so **${sigText(answer, 3)} °C** to 3 significant figures. The mass in $m c \\Delta\\theta$ is the mass of ${c.what}, not ${c.whose}.`,
        method: [`$E_k = ${tex(E)}$ J`, '$\\Delta\\theta = \\Delta E \\div (m c)$', `$${tex(E)} \\div ${tex(mc)}$`],
        answer,
        tolerance,
        units: '°C',
        line: `${sigText(answer, 3)} °C`,
      },
      { agrees: near(rise * mc, E) && Math.abs(rise - answer) <= tolerance, detail: `${rise.toFixed(5)} × ${mc} = ${show(rise * mc)} J, against ½ × ${m} × ${v}² = ${E} J` },
      { context: c.whose, m, v, md, c: c.c, E, rise: rise.toFixed(5) },
    )
  },
}

export const motionGenerators: Generator[] = [
  distanceFromSpeedAndTime,
  accelerationFromSpeedChange,
  finalVelocityFromRest,
  decelerationFromSpeedChange,
  brakingDistanceFromDeceleration,
  averageSpeedOverStages,
  finalVelocityWithRunningStart,
  stoppingDistanceFromParts,
  thinkingDistance,
  reactionTimeFromThinkingDistance,
  brakingForceFromKineticEnergy,
  brakingDistanceAtAnotherSpeed,
  brakingForceFromStoppingTime,
  stoppingDistanceFromReactionAndDeceleration,
  reactionTimeFromRulerDrop,
  crashForce,
  brakeTemperatureRise,
]
