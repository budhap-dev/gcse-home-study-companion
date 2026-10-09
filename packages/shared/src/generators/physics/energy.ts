import { roundTo, show } from '../format.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import type { Check, Generator } from '../types.ts'
import { G, G_STATED, atMost, cap, closes, figures, near, numeric, prose, sciExact, stepped, tex } from './build.ts'
import { clearAtSigFigs, dpTolerance, sfTolerance, sigFigs, sigText } from './format.ts'

/**
 * Energy (AQA 8463, topic 1): kinetic and gravitational potential energy, energy transfers and
 * dissipation, power and efficiency. Every numeric question in the three topics has a
 * generator here; the written questions are the model for the wording, the equations as the
 * content names them, g = 9.8 N/kg stated where the written prompt states it, and realistic
 * contexts drawn from lists that carry the masses, heights and speeds each one can have.
 */
const KE = 'kinetic-and-gravitational-potential-energy'
const DISSIPATION = 'energy-transfers-and-dissipation'
const POWER = 'power-and-efficiency'

// ---------------------------------------------------------------------------------------------
// Kinetic and gravitational potential energy
// ---------------------------------------------------------------------------------------------

interface Mover {
  name: string
  verb: string
  its: string
  mass: [number, number]
  step: number
  speed: [number, number]
}

/** Things a Year 9 can picture moving, with the masses and speeds each really has. */
const SMALL_MOVERS: Mover[] = [
  { name: 'a ball', verb: 'rolls at', its: 'its', mass: [0.2, 2], step: 0.1, speed: [2, 12] },
  { name: 'a football', verb: 'is kicked and moves at', its: 'its', mass: [0.4, 0.5], step: 0.1, speed: [8, 25] },
  { name: 'a cricket ball', verb: 'is bowled at', its: 'its', mass: [0.16, 0.16], step: 0.01, speed: [20, 40] },
  { name: 'a dog', verb: 'runs at', its: 'its', mass: [10, 30], step: 1, speed: [2, 9] },
  { name: 'a runner', verb: 'runs at', its: 'her', mass: [50, 80], step: 1, speed: [3, 9] },
  { name: 'a shopping trolley', verb: 'is pushed at', its: 'its', mass: [20, 40], step: 1, speed: [1, 3] },
  { name: 'a skateboarder', verb: 'rolls at', its: 'his', mass: [40, 70], step: 1, speed: [2, 8] },
  { name: 'a toy car', verb: 'moves at', its: 'its', mass: [0.2, 1], step: 0.1, speed: [1, 4] },
  { name: 'a horse', verb: 'gallops at', its: 'its', mass: [400, 600], step: 10, speed: [5, 15] },
]
const VEHICLES: Mover[] = [
  { name: 'a car', verb: 'travels at', its: 'its', mass: [900, 1600], step: 50, speed: [10, 30] },
  { name: 'a van', verb: 'travels at', its: 'its', mass: [1800, 3000], step: 100, speed: [10, 25] },
  { name: 'a motorbike and rider', verb: 'travel at', its: 'their', mass: [250, 350], step: 10, speed: [15, 35] },
  { name: 'a bus', verb: 'travels at', its: 'its', mass: [10000, 14000], step: 500, speed: [5, 15] },
  { name: 'a lorry', verb: 'travels at', its: 'its', mass: [8000, 20000], step: 1000, speed: [10, 25] },
  { name: 'a tram', verb: 'travels at', its: 'its', mass: [30000, 40000], step: 1000, speed: [5, 15] },
]
/** Heavy enough that the kinetic energy has six figures or more, for the standard-form slot. */
const HEAVY: Mover[] = [
  { name: 'a lorry', verb: 'travels at', its: 'its', mass: [10000, 30000], step: 1000, speed: [10, 25] },
  { name: 'a van', verb: 'travels at', its: 'its', mass: [1500, 3000], step: 100, speed: [10, 30] },
  { name: 'a bus', verb: 'travels at', its: 'its', mass: [10000, 14000], step: 500, speed: [5, 20] },
  { name: 'a train', verb: 'travels at', its: 'its', mass: [40000, 100000], step: 5000, speed: [20, 40] },
  { name: 'a car', verb: 'travels at', its: 'its', mass: [900, 1600], step: 50, speed: [15, 30] },
  { name: 'a tram', verb: 'travels at', its: 'its', mass: [30000, 40000], step: 1000, speed: [5, 15] },
]
const KE_PROMPTS: ((c: Mover, m: string, v: number) => string)[] = [
  (c, m, v) => `${cap(c.name)} of mass ${m} kg ${c.verb} ${v} m/s. Calculate ${c.its} kinetic energy in joules.`,
  (c, m, v) => `Calculate the kinetic energy, in joules, of ${c.name} of mass ${m} kg moving at ${v} m/s.`,
  (c, m, v) => `${cap(c.name)} of mass ${m} kg ${c.verb} ${v} m/s. What is ${c.its} kinetic energy, in joules?`,
]

/** Masses and speeds for a kinetic energy with at most one decimal place. */
function kinetic(r: Rng, c: Pick<Mover, 'mass' | 'step' | 'speed'>, ok: (E: number) => boolean = () => true) {
  return draw(
    r,
    (r) => {
      const m = stepped(r, c.mass[0], c.mass[1], c.step)
      const v = int(r, ...c.speed)
      return { m, v, E: Number(show((m * v * v) / 2)) }
    },
    ({ E }) => atMost(E, 1) && E >= 1 && ok(E),
  )
}

/** The second route back from a kinetic energy: the speed from E and m, and the mass from E and v. */
function kineticCheck(E: number, m: number, v: number): Check {
  const vBack = Math.sqrt((2 * E) / m)
  const mBack = (2 * E) / (v * v)
  return { agrees: near(vBack, v) && near(mBack, m), detail: `√(2 × ${E} ÷ ${m}) = ${show(vBack)} m/s; 2 × ${E} ÷ ${v}² = ${show(mBack)} kg` }
}

/**
 * E_k = ½mv² from a mass and a speed: written as q2 (a 0.5 kg ball at 4 m/s, grade 4–5) and
 * q4 (a 900 kg car at 20 m/s, grade 6–7), both 2 marks. q2 keeps to balls, animals and
 * people, q4 to vehicles, so each slot keeps its band.
 */
export const kineticEnergy: Generator = {
  id: 'kinetic-energy',
  subjectId: 'physics',
  topicId: KE,
  replaces: ['q2', 'q4'],
  build(r, slot, turn) {
    const list = slot.id === 'q4' ? VEHICLES : SMALL_MOVERS
    const c = list[turn % list.length]!
    const { m, v, E } = kinetic(r, c)
    const expr = `E_k = \\tfrac{1}{2} m v^2 = \\tfrac{1}{2} \\times ${tex(m)} \\times ${v}^2 = \\tfrac{1}{2} \\times ${tex(m)} \\times ${tex(v * v)}`
    return numeric(
      slot,
      {
        prompt: pick(r, KE_PROMPTS)(c, prose(m), v),
        // "Not 2v" only where 2v and v² differ: at 2 m/s they are both 4.
        solution: `${closes(expr, E, 'J')} Square the speed first: $${v}^2 = ${tex(v * v)}$${v > 2 ? `, not ${tex(2 * v)}` : ''}.`,
        method: [`$\\frac{1}{2} \\times ${tex(m)} \\times ${v}^2$`],
        answer: E,
        tolerance: dpTolerance(E),
        units: 'J',
      },
      kineticCheck(E, m, v),
      { context: c.name, m, v },
    )
  },
}

interface Lift {
  text: (m: string, h: string) => string
  mass: [number, number]
  step: number
  height: [number, number]
  halves?: boolean
}
const LIFTS: Lift[] = [
  { text: (m, h) => `A box of mass ${m} kg is lifted ${h} m onto a shelf.`, mass: [5, 20], step: 1, height: [1, 2], halves: true },
  { text: (m, h) => `A climber of mass ${m} kg climbs ${h} m up a rock face.`, mass: [50, 80], step: 1, height: [5, 30] },
  { text: (m, h) => `A crane lifts a load of mass ${m} kg through a height of ${h} m.`, mass: [200, 1000], step: 50, height: [5, 20] },
  { text: (m, h) => `A student of mass ${m} kg climbs a flight of stairs ${h} m high.`, mass: [45, 70], step: 1, height: [3, 6] },
  { text: (m, h) => `A bag of shopping of mass ${m} kg is lifted ${h} m onto a table.`, mass: [2, 8], step: 1, height: [0.5, 1.5], halves: true },
  { text: (m, h) => `A lift carries a person of mass ${m} kg up ${h} m.`, mass: [50, 80], step: 1, height: [10, 40] },
  { text: (m, h) => `A weightlifter raises a bar of mass ${m} kg through ${h} m.`, mass: [60, 150], step: 10, height: [1, 2], halves: true },
  { text: (m, h) => `A drone of mass ${m} kg rises ${h} m.`, mass: [2, 5], step: 1, height: [10, 60] },
]

/**
 * E_p = mgh from a mass and a height gained: written as q3 (a 10 kg box lifted 2 m, 2
 * marks). Whole kilograms and heights in halves keep the answer to one decimal place.
 */
export const gravitationalPotentialEnergy: Generator = {
  id: 'gravitational-potential-energy',
  subjectId: 'physics',
  topicId: KE,
  replaces: ['q3'],
  build(r, slot) {
    const c = pick(r, LIFTS)
    const m = stepped(r, c.mass[0], c.mass[1], c.step)
    const h = c.halves ? stepped(r, c.height[0], c.height[1], 0.5) : int(r, ...c.height)
    const E = Number(show(m * G * h))
    // Second route: the height back from the energy and the weight.
    const hBack = E / (m * G)
    return numeric(
      slot,
      {
        prompt: `${c.text(prose(m), show(h))} ${pick(r, G_STATED)} Calculate the gravitational potential energy gained, in joules.`,
        solution: `${closes(`E_p = m g h = ${tex(m)} \\times 9.8 \\times ${tex(h)}`, E, 'J')} $h$ is the height gained, ${show(h)} m.`,
        method: [`$${tex(m)} \\times 9.8 \\times ${tex(h)}$`],
        answer: E,
        tolerance: dpTolerance(E),
        units: 'J',
      },
      { agrees: near(hBack, h) && atMost(E, 1), detail: `${E} ÷ (${m} × 9.8) = ${show(hBack)} m` },
      { m, h },
    )
  },
}

interface Climb {
  text: (m: string, E: string) => string
  what: string
  mass: [number, number]
  step: number
  height: [number, number]
}
const CLIMBS: Climb[] = [
  { text: (m, E) => `A ${m} kg child gains ${E} J of gravitational potential energy climbing a ladder.`, what: 'the height climbed', mass: [20, 40], step: 1, height: [2, 6] },
  { text: (m, E) => `A climber of mass ${m} kg gains ${E} J of gravitational potential energy.`, what: 'the height climbed', mass: [50, 80], step: 1, height: [10, 40] },
  { text: (m, E) => `A crane lifting a load of mass ${m} kg transfers ${E} J to the load's gravitational potential store.`, what: 'the height the load is lifted', mass: [200, 1000], step: 50, height: [5, 20] },
  { text: (m, E) => `A lift carrying a person of mass ${m} kg gives them ${E} J of gravitational potential energy.`, what: 'the height the lift rises', mass: [50, 80], step: 1, height: [10, 30] },
  { text: (m, E) => `A drone of mass ${m} kg gains ${E} J of gravitational potential energy as it rises.`, what: 'the height it rises', mass: [2, 5], step: 1, height: [10, 60] },
  { text: (m, E) => `A bucket of water of mass ${m} kg is raised from a well, gaining ${E} J of gravitational potential energy.`, what: 'the height it is raised', mass: [5, 15], step: 1, height: [5, 20] },
  { text: (m, E) => `A flag of mass ${m} kg is raised up a flagpole, gaining ${E} J of gravitational potential energy.`, what: 'the height it is raised', mass: [1, 3], step: 1, height: [6, 12] },
]

/**
 * h = E_p ÷ mg: written as q5 (a 30 kg child gains 2940 J, 3 marks). The mass times the
 * height is a multiple of 5, so the energy given is a whole number of joules.
 */
export const potentialEnergyHeight: Generator = {
  id: 'potential-energy-height',
  subjectId: 'physics',
  topicId: KE,
  replaces: ['q5'],
  build(r, slot) {
    const c = pick(r, CLIMBS)
    const { m, h } = draw(r, (r) => ({ m: stepped(r, c.mass[0], c.mass[1], c.step), h: int(r, ...c.height) }), ({ m, h }) => (m * h) % 5 === 0)
    const E = Math.round(m * G * h)
    const mg = Number(show(m * G))
    // Second route: forwards, the mass times g times the height found.
    const forward = m * G * h
    return numeric(
      slot,
      {
        prompt: `${c.text(prose(m), prose(E))} ${pick(r, G_STATED)} Calculate ${c.what}, in metres.`,
        solution: `Rearrange $E_p = m g h$ to $h = \\dfrac{E_p}{m g} = \\dfrac{${tex(E)}}{${tex(m)} \\times 9.8} = \\dfrac{${tex(E)}}{${tex(mg)}} = ${h}$ m.`,
        method: ['$h = \\frac{E_p}{mg}$', `$\\frac{${tex(E)}}{${tex(mg)}}$`],
        answer: h,
        units: 'm',
      },
      { agrees: near(forward, E) && Number.isInteger(E), detail: `${m} × 9.8 × ${h} = ${show(forward)} J` },
      { m, h, E },
    )
  },
}

interface Energetic {
  text: (m: string, E: string) => string
  its: string
  mass: [number, number]
  step: number
  speed: [number, number]
}
const ENERGETIC: Energetic[] = [
  { text: (m, E) => `An object of mass ${m} kg has ${E} J of kinetic energy.`, its: 'its', mass: [2, 20], step: 1, speed: [2, 20] },
  { text: (m, E) => `A ball of mass ${m} kg has ${E} J of kinetic energy.`, its: 'its', mass: [0.5, 2], step: 0.5, speed: [2, 20] },
  { text: (m, E) => `A dog of mass ${m} kg has ${E} J of kinetic energy.`, its: 'its', mass: [10, 30], step: 1, speed: [2, 9] },
  { text: (m, E) => `A runner of mass ${m} kg has ${E} J of kinetic energy.`, its: 'his', mass: [50, 80], step: 1, speed: [3, 9] },
  { text: (m, E) => `A shopping trolley of mass ${m} kg has ${E} J of kinetic energy.`, its: 'its', mass: [20, 40], step: 1, speed: [1, 3] },
  { text: (m, E) => `A car of mass ${m} kg has ${E} J of kinetic energy.`, its: 'its', mass: [900, 1600], step: 50, speed: [10, 30] },
  { text: (m, E) => `A cyclist and bike of mass ${m} kg have ${E} J of kinetic energy.`, its: 'their', mass: [70, 100], step: 1, speed: [4, 10] },
]

/**
 * v from E_k and m: written as q7 (8 kg with 400 J, 3 marks). The energy is a whole number
 * and 2E ÷ m a perfect square, so the root comes out whole.
 */
export const kineticEnergySpeed: Generator = {
  id: 'kinetic-energy-speed',
  subjectId: 'physics',
  topicId: KE,
  replaces: ['q7'],
  build(r, slot) {
    const c = pick(r, ENERGETIC)
    const { m, v, E } = kinetic(r, c, (E) => Number.isInteger(E))
    const v2 = v * v
    // Second route: forwards, half the mass times the speed squared.
    const forward = (m * v2) / 2
    return numeric(
      slot,
      {
        prompt: `${c.text(prose(m), prose(E))} Calculate ${c.its} speed in m/s.`,
        solution: `$v^2 = \\dfrac{2 E_k}{m} = \\dfrac{${tex(2 * E)}}{${tex(m)}} = ${tex(v2)}$, so $v = \\sqrt{${tex(v2)}} = ${v}$ m/s. Rearrange first, substitute second, square root last.`,
        method: ['$v^2 = \\frac{2E_k}{m}$', `$v^2 = ${tex(v2)}$`],
        answer: v,
        units: 'm/s',
      },
      { agrees: near(forward, E) && near((2 * E) / m, v2), detail: `½ × ${m} × ${v}² = ${show(forward)} J` },
      { m, v, E },
    )
  },
}

interface Drop {
  setup: (m: string, x: string) => string
  ask: string
  mass: [number, number]
  step: number
  /** The range of n, where the height is 0.1n² m and the speed 1.4n m/s, so both print exactly. */
  n: [number, number]
}
/** Big drops, for q9: the speed at the bottom. */
const FALLS: Drop[] = [
  { setup: (m, h) => `A diver of mass ${m} kg steps off a ${h} m platform.`, ask: 'her speed as she reaches the water', mass: [50, 80], step: 1, n: [5, 10] },
  { setup: (m, h) => `A stone of mass ${m} kg is dropped from a bridge ${h} m above the river.`, ask: 'its speed as it hits the water', mass: [0.5, 2], step: 0.1, n: [10, 20] },
  { setup: (m, h) => `A ball of mass ${m} kg is dropped from a window ${h} m above the ground.`, ask: 'its speed as it hits the ground', mass: [0.2, 1], step: 0.1, n: [4, 9] },
  { setup: (m, h) => `A sledge and rider of mass ${m} kg start from rest and slide down a slope with a vertical height of ${h} m.`, ask: 'their speed at the bottom', mass: [40, 80], step: 1, n: [5, 10] },
  { setup: (m, h) => `A roller coaster car of mass ${m} kg starts from rest and drops through a vertical height of ${h} m.`, ask: 'its speed at the bottom of the drop', mass: [400, 800], step: 50, n: [12, 20] },
  { setup: (m, h) => `A skateboarder of mass ${m} kg rolls from rest down a ramp ${h} m high.`, ask: 'his speed at the bottom of the ramp', mass: [40, 70], step: 1, n: [4, 7] },
  { setup: (m, h) => `An apple of mass ${m} kg falls from a branch ${h} m above the ground.`, ask: 'its speed as it hits the ground', mass: [0.1, 0.3], step: 0.1, n: [3, 6] },
  { setup: (m, h) => `A climber drops a water bottle of mass ${m} kg from a ledge ${h} m up.`, ask: 'its speed as it hits the ground', mass: [0.5, 1.5], step: 0.1, n: [8, 16] },
]
/** Small swings and tracks, for q14: the speed at the lowest point, in a setting the student may not have met. */
const SWINGS: Drop[] = [
  { setup: (m, h) => `A pendulum bob of mass ${m} kg is pulled to one side so that it is ${h} m above its lowest point, then released.`, ask: 'its speed at the lowest point', mass: [0.1, 0.5], step: 0.1, n: [1, 3] },
  { setup: (m, h) => `A child of mass ${m} kg sits on a swing. The seat is pulled back until it is ${h} m above its lowest point, then let go.`, ask: "the child's speed at the lowest point", mass: [20, 40], step: 1, n: [2, 4] },
  { setup: (m, h) => `A marble of mass ${m} kg is released from rest at the top of a curved track, ${h} m above the bottom.`, ask: 'its speed at the bottom of the track', mass: [0.01, 0.05], step: 0.01, n: [1, 3] },
  { setup: (m, h) => `A conker of mass ${m} kg hangs on a string. It is pulled up until it is ${h} m above its lowest point and released.`, ask: 'its speed at the lowest point', mass: [0.01, 0.03], step: 0.01, n: [1, 3] },
  { setup: (m, h) => `A wrecking ball of mass ${m} kg is pulled back so that it is ${h} m above its lowest point, then released.`, ask: 'its speed at the lowest point', mass: [300, 1000], step: 50, n: [3, 5] },
  { setup: (m, h) => `A toy car of mass ${m} kg is released from rest ${h} m above the bottom of a track.`, ask: 'its speed at the bottom', mass: [0.1, 0.5], step: 0.1, n: [2, 4] },
  { setup: (m, h) => `A skateboarder of mass ${m} kg drops into a half-pipe from a point ${h} m above the bottom.`, ask: 'her speed at the bottom', mass: [40, 70], step: 1, n: [3, 5] },
]
/** Impacts, for q13: the height from the speed on landing. */
const LANDINGS: Drop[] = [
  { setup: (m, v) => `A mass of ${m} kg is dropped and hits the ground at ${v} m/s.`, ask: 'the height it was dropped from', mass: [1, 5], step: 1, n: [3, 12] },
  { setup: (m, v) => `A ball of mass ${m} kg is dropped from a window and hits the ground at ${v} m/s.`, ask: 'the height of the window above the ground', mass: [0.2, 1], step: 0.1, n: [3, 10] },
  { setup: (m, v) => `A stone of mass ${m} kg is dropped down a well and hits the water at ${v} m/s.`, ask: 'how far it fell', mass: [0.5, 2], step: 0.1, n: [8, 20] },
  { setup: (m, v) => `A bag of mass ${m} kg is dropped from a balcony and lands at ${v} m/s.`, ask: 'the height of the balcony', mass: [2, 6], step: 1, n: [3, 8] },
  { setup: (m, v) => `A coconut of mass ${m} kg falls from a palm tree and hits the sand at ${v} m/s.`, ask: 'the height it fell from', mass: [1, 2], step: 0.1, n: [6, 12] },
  { setup: (m, v) => `A climber drops a water bottle of mass ${m} kg. It hits the ground at ${v} m/s.`, ask: 'the height it fell', mass: [0.5, 1.5], step: 0.1, n: [8, 16] },
  { setup: (m, v) => `A hammer of mass ${m} kg slips from a roof and hits the ground at ${v} m/s.`, ask: 'the height of the roof', mass: [1, 2], step: 0.1, n: [4, 10] },
]
const DROP_LISTS: Record<string, Drop[]> = { q9: FALLS, q13: LANDINGS, q14: SWINGS }
const CONDITIONS = ['Ignoring air resistance and taking $g = 9.8$ N/kg', 'Taking $g = 9.8$ N/kg and ignoring air resistance']

/**
 * Energy transferred from the gravitational store to the kinetic store, or back: written as
 * q9 (a 60 kg diver from 10 m, find the speed), q13 (a 2 kg mass landing at 7 m/s, find the
 * height) and q14 (a 0.2 kg pendulum bob raised 0.1 m, find the speed), all 3 marks. Heights
 * are 0.1n² m, so 2gh is (1.4n)² and the speed is exact; the mass is given and cancels, as
 * in the written questions.
 */
export const fallingObject: Generator = {
  id: 'falling-object',
  subjectId: 'physics',
  topicId: KE,
  replaces: ['q9', 'q13', 'q14'],
  build(r, slot, turn) {
    const task = slot.id === 'q13' ? 'height' : 'speed'
    const list = DROP_LISTS[slot.id] ?? FALLS
    const c = list[turn % list.length]!
    // Never n = 14: the height 0.1n² and the speed 1.4n would both be 19.6, a coincidence
    // that teaches a false rule.
    const n = draw(r, (r) => int(r, ...c.n), (n) => n !== 14)
    const m = stepped(r, c.mass[0], c.mass[1], c.step)
    const h = Number(show(0.1 * n * n))
    const v = Number(show(1.4 * n))
    const v2 = Number(show(1.96 * n * n))
    // Second route: the two stores hold the same energy with the mass in, and the root of 2gh.
    const Ep = m * G * h
    const Ek = (m * v * v) / 2
    const check: Check = { agrees: near(Ep, Ek) && near(Math.sqrt(2 * G * h), v) && near(v2, 2 * G * h), detail: `mgh = ${show(Ep)} J, ½mv² = ${show(Ek)} J; √(2 × 9.8 × ${h}) = ${show(Math.sqrt(2 * G * h))}` }
    const values = { task, context: c.setup('m', 'x').slice(0, 20), n, m, h, v }
    if (task === 'height') {
      return numeric(
        slot,
        {
          prompt: `${c.setup(prose(m), show(v))} ${pick(r, CONDITIONS)}, calculate ${c.ask}, in metres.`,
          solution: `$m g h = \\tfrac{1}{2} m v^2$, so $h = \\dfrac{v^2}{2 g}$. $v^2 = ${show(v)}^2 = ${tex(v2)}$, so $h = \\dfrac{${tex(v2)}}{19.6} = ${show(h)}$ m. The mass cancels, so the ${prose(m)} kg is not needed.`,
          method: ['$mgh = \\frac{1}{2} m v^2$, so $h = \\frac{v^2}{2g}$', `$h = \\frac{${tex(v2)}}{19.6}$`],
          answer: h,
          tolerance: dpTolerance(h),
          units: 'm',
        },
        check,
        values,
      )
    }
    return numeric(
      slot,
      {
        prompt: `${c.setup(prose(m), show(h))} ${pick(r, CONDITIONS)}, calculate ${c.ask}, in m/s.`,
        solution: `All the gravitational potential energy becomes kinetic energy: $m g h = \\tfrac{1}{2} m v^2$, so $v^2 = 2 g h = 2 \\times 9.8 \\times ${tex(h)} = ${tex(v2)}$ and $v = \\sqrt{${tex(v2)}} = ${show(v)}$ m/s. The mass cancels, so the ${prose(m)} kg is not needed.`,
        method: ['$mgh = \\frac{1}{2} m v^2$, so $v^2 = 2gh$', `$v^2 = ${tex(v2)}$`],
        answer: v,
        tolerance: dpTolerance(v),
        units: 'm/s',
      },
      check,
      values,
    )
  },
}

interface Traveller {
  name: string
  plural: boolean
  /** How it moves, where "travels at" would read oddly: a runner runs. */
  verb?: string
  its: string
  mass: [number, number]
  step: number
  /** Speeds in km/h that are an exact number of m/s, or an exact half. */
  kmh: number[]
}
const TRAVELLERS: Traveller[] = [
  { name: 'A cyclist and bike', plural: true, its: 'their', mass: [70, 100], step: 1, kmh: [18, 27, 36, 45] },
  { name: 'A runner', plural: false, verb: 'runs at', its: 'her', mass: [50, 80], step: 1, kmh: [9, 18, 27] },
  { name: 'A car', plural: false, its: 'its', mass: [900, 1600], step: 50, kmh: [36, 45, 54, 63, 72, 81, 90, 99, 108, 117, 126] },
  { name: 'A motorbike and rider', plural: true, its: 'their', mass: [250, 350], step: 10, kmh: [36, 54, 72, 90, 108, 126] },
  { name: 'A van', plural: false, its: 'its', mass: [1800, 3000], step: 100, kmh: [36, 54, 72, 90] },
  { name: 'A horse and rider', plural: true, its: 'their', mass: [500, 600], step: 10, kmh: [36, 45, 54] },
  { name: 'A bus', plural: false, its: 'its', mass: [10000, 14000], step: 500, kmh: [36, 45, 54, 72] },
]

/**
 * E_k with the speed given in km/h: written as q10 (80 kg at 36 km/h, 3 marks). The first
 * mark is the conversion, so every speed is a multiple of 9 km/h and converts exactly.
 */
export const kineticEnergyFromKmh: Generator = {
  id: 'kinetic-energy-from-km-per-hour',
  subjectId: 'physics',
  topicId: KE,
  replaces: ['q10'],
  build(r, slot) {
    const c = pick(r, TRAVELLERS)
    const { m, kmh, v, E } = draw(
      r,
      (r) => {
        const m = stepped(r, c.mass[0], c.mass[1], c.step)
        const kmh = pick(r, c.kmh)
        const v = Number(show((kmh * 1000) / 3600))
        return { m, kmh, v, E: Number(show((m * v * v) / 2)) }
      },
      ({ E }) => Number.isInteger(E),
    )
    const expr = `E_k = \\tfrac{1}{2} \\times ${tex(m)} \\times ${show(v)}^2 = \\tfrac{1}{2} \\times ${tex(m)} \\times ${tex(v * v)}`
    // Second route: the speed in m/s times 3.6 is the speed in km/h, and the energy from it.
    const viaKmh = (m * (kmh / 3.6) ** 2) / 2
    return numeric(
      slot,
      {
        prompt: `${c.name} ${c.plural ? 'have a combined mass of' : 'has a mass of'} ${prose(m)} kg and ${c.verb ?? (c.plural ? 'travel at' : 'travels at')} ${kmh} km/h. Calculate ${c.its} kinetic energy in joules.`,
        solution: `Convert the speed first: $${kmh}$ km/h $= \\dfrac{${tex(kmh * 1000)}}{3600} = ${show(v)}$ m/s. Then ${closes(expr, E, 'J')}`,
        method: [`${kmh} km/h converted to ${show(v)} m/s`, `$\\frac{1}{2} \\times ${tex(m)} \\times ${show(v)}^2$`],
        answer: E,
        units: 'J',
      },
      { agrees: near(v * 3.6, kmh) && near(viaKmh, E), detail: `${v} × 3.6 = ${show(v * 3.6)} km/h; ½ × ${m} × (${kmh} ÷ 3.6)² = ${show(viaKmh)} J` },
      { context: c.name, m, kmh, v },
    )
  },
}

interface Descent {
  text: (m: string, h: string) => string
  who: string
  mass: [number, number]
  step: number
  height: [number, number]
  lost: number[]
}
const DESCENTS: Descent[] = [
  { text: (m, h) => `A roller coaster car of mass ${m} kg drops through a vertical height of ${h} m.`, who: 'the car at the bottom of the drop', mass: [400, 800], step: 50, height: [15, 60], lost: [10, 15, 20, 25, 30] },
  { text: (m, h) => `A rider of mass ${m} kg goes down a water slide with a vertical drop of ${h} m.`, who: 'the rider at the bottom of the slide', mass: [40, 80], step: 1, height: [5, 20], lost: [20, 25, 30, 35, 40] },
  { text: (m, h) => `A sledge and rider of mass ${m} kg slide from rest down a hill ${h} m high.`, who: 'the sledge at the bottom of the hill', mass: [40, 80], step: 1, height: [5, 30], lost: [10, 15, 20, 25, 30] },
  { text: (m, h) => `A skier of mass ${m} kg starts from rest and descends a vertical height of ${h} m.`, who: 'the skier at the bottom', mass: [50, 90], step: 1, height: [20, 60], lost: [10, 15, 20, 25, 30, 35, 40] },
  { text: (m, h) => `A cyclist and bike of mass ${m} kg freewheel from rest down a hill with a vertical drop of ${h} m.`, who: 'the cyclist at the bottom of the hill', mass: [70, 100], step: 1, height: [10, 40], lost: [10, 15, 20, 25, 30] },
  { text: (m, h) => `A ball of mass ${m} kg is dropped from a tower ${h} m high.`, who: 'the ball as it reaches the ground', mass: [0.5, 2], step: 0.1, height: [20, 60], lost: [10, 15, 20, 25] },
]

/**
 * A drop with a share of the energy dissipated, to 3 significant figures: written as q11 (a
 * 500 kg roller coaster car drops 30 m with 20% dissipated, 4 marks). The percentage is
 * applied to E_p before the root, and the answer is drawn again when its third figure sits
 * on a rounding boundary.
 */
export const fallWithDissipation: Generator = {
  id: 'fall-with-dissipation',
  subjectId: 'physics',
  topicId: KE,
  replaces: ['q11'],
  build(r, slot) {
    const c = pick(r, DESCENTS)
    const { m, h, lost, kept, Ep, Ek, v2, v } = draw(
      r,
      (r) => {
        const m = stepped(r, c.mass[0], c.mass[1], c.step)
        const h = int(r, ...c.height)
        const lost = pick(r, c.lost)
        const kept = (100 - lost) / 100
        const Ep = Number(show(m * G * h))
        const Ek = Number(show(kept * Ep))
        const v2 = Number(show((2 * Ek) / m))
        return { m, h, lost, kept, Ep, Ek, v2, v: Math.sqrt(v2) }
      },
      // No third figure of 0: the answer box would print 19, not the 19.0 the prompt asks for.
      ({ v }) => clearAtSigFigs(v, 3) && v >= 5 && v <= 40 && !sigText(sigFigs(v, 3), 3).endsWith('0'),
    )
    const answer = sigFigs(v, 3)
    const tolerance = sfTolerance(answer, 3)
    // Second route: the mass cancels, so v² is 2gh times the fraction kept.
    const direct = 2 * G * h * kept
    return numeric(
      slot,
      {
        prompt: `${c.text(prose(m), String(h))} ${lost}% of the energy is dissipated to the surroundings. Taking $g = 9.8$ N/kg, calculate the speed of ${c.who}, in m/s. Give your answer to 3 significant figures.`,
        solution: `$E_p = m g h = ${tex(m)} \\times 9.8 \\times ${h} = ${tex(Ep)}$ J. ${100 - lost}% is transferred to the kinetic store: $E_k = ${show(kept)} \\times ${tex(Ep)} = ${tex(Ek)}$ J. Then $v^2 = \\dfrac{2 \\times ${tex(Ek)}}{${tex(m)}} = ${tex(v2)}$, so $v = \\sqrt{${tex(v2)}} = ${sigText(answer, 3)}$ m/s to 3 significant figures. Scale the energy by the share kept before taking the root, never after.`,
        method: [`$E_p = ${tex(Ep)}$ J`, `$E_k = ${show(kept)} \\times ${tex(Ep)} = ${tex(Ek)}$ J`, `$v^2 = ${tex(v2)}$`],
        answer,
        tolerance,
        units: 'm/s',
        line: `${sigText(answer, 3)} m/s`,
      },
      { agrees: near(direct, v2) && Math.abs(Math.sqrt(direct) - answer) <= tolerance, detail: `2 × 9.8 × ${h} × ${kept} = ${show(direct)}; √ = ${Math.sqrt(direct).toFixed(5)}` },
      { context: c.who, m, h, lost, v: v.toFixed(5) },
    )
  },
}

const SF_PROMPTS: ((c: Mover, m: string, v: number) => string)[] = [
  (c, m, v) => `${cap(c.name)} of mass ${m} kg ${c.verb} ${v} m/s. Calculate ${c.its} kinetic energy in joules. Give your answer in standard form.`,
  (c, m, v) => `Calculate the kinetic energy, in joules, of ${c.name} of mass ${m} kg travelling at ${v} m/s. Give your answer in standard form.`,
]

/**
 * E_k of something heavy, answered in standard form: written as q15 (1500 kg at 30 m/s,
 * 6.75 × 10⁵ J, 2 marks). The energy has six figures or more and no more than three of them
 * are significant, so the front number is short.
 */
export const kineticEnergyStandardForm: Generator = {
  id: 'kinetic-energy-standard-form',
  subjectId: 'physics',
  topicId: KE,
  replaces: ['q15'],
  build(r, slot) {
    const c = pick(r, HEAVY)
    const { m, v, E } = kinetic(r, c, (E) => E >= 100000 && Number.isInteger(E) && figures(E) <= 3)
    const form = sciExact(E)
    // Second route: the standard form read back as a number, and the speed back from the energy.
    const [, mantissa, exponent] = /^([\d.]+) \\times 10\^\{(-?\d+)\}$/.exec(form)!
    const readBack = Number(mantissa) * 10 ** Number(exponent)
    const back = kineticCheck(E, m, v)
    return numeric(
      slot,
      {
        prompt: pick(r, SF_PROMPTS)(c, prose(m), v),
        solution: `$E_k = \\tfrac{1}{2}mv^2 = \\tfrac{1}{2} \\times ${tex(m)} \\times ${v}^2 = ${tex(m / 2)} \\times ${tex(v * v)}$, which is **${E} J**. In standard form that is **$${form}$ J**: the front number sits between 1 and 10, and the power counts how many places the point moved. Only the speed is squared.`,
        method: [`$\\frac{1}{2} \\times ${tex(m)} \\times ${v}^2$`],
        answer: E,
        units: 'J',
        line: `$${form}$ J`,
      },
      { agrees: back.agrees && near(readBack, E) && Number(mantissa) >= 1 && Number(mantissa) < 10, detail: `${back.detail}; ${mantissa} × 10^${exponent} = ${readBack}` },
      { context: c.name, m, v, form },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Energy transfers and dissipation
// ---------------------------------------------------------------------------------------------

interface Device {
  name: string
  useful: (y: string) => string
  /** Efficiency range in percent, so the useful share is one the device really manages. */
  eff: [number, number]
}
const DEVICES: Device[] = [
  { name: 'A motor', useful: (y) => `transfers ${y} J usefully`, eff: [60, 90] },
  { name: 'An electric drill', useful: (y) => `transfers ${y} J usefully to the kinetic store of the drill bit`, eff: [50, 80] },
  { name: 'A kettle', useful: (y) => `transfers ${y} J to the water`, eff: [70, 90] },
  { name: 'A filament lamp', useful: (y) => `transfers ${y} J usefully as light`, eff: [5, 20] },
  { name: 'An LED lamp', useful: (y) => `transfers ${y} J usefully as light`, eff: [80, 95] },
  { name: 'A hairdryer', useful: (y) => `transfers ${y} J usefully`, eff: [60, 90] },
  { name: 'A loudspeaker', useful: (y) => `transfers ${y} J usefully as sound`, eff: [5, 15] },
  { name: 'A toaster', useful: (y) => `transfers ${y} J to the bread`, eff: [50, 80] },
  { name: 'A phone charger', useful: (y) => `transfers ${y} J to the battery`, eff: [80, 95] },
  { name: 'A petrol engine', useful: (y) => `transfers ${y} J usefully to the kinetic store of the car`, eff: [25, 35] },
  { name: 'An electric fan', useful: (y) => `transfers ${y} J usefully to the kinetic store of the air`, eff: [40, 70] },
]
const TOTALS = [100, 150, 200, 250, 300, 400, 500, 600, 750, 800, 1000, 1200, 1500, 2000, 2400, 2500, 3000, 4000, 5000, 6000, 8000]
const STORES = ['the kinetic store', 'the gravitational potential store', 'the elastic potential store of a spring', 'the thermal store of the water in the kettle', 'the kinetic store of the trolley']

/** A total and the useful share of it, as whole joules with an efficiency the device really has. */
function supplied(r: Rng, eff: [number, number]) {
  return draw(
    r,
    (r) => {
      const total = pick(r, TOTALS)
      const percent = int(r, ...eff)
      return { total, percent, useful: (total * percent) / 100 }
    },
    ({ useful }) => Number.isInteger(useful),
  )
}

/**
 * Energy dissipated as total minus useful: written as q2 (a motor, 500 J in and 400 J
 * useful), q5 (a kettle, "wasted") and q8 (a closed system of 750 J with 600 J left in the
 * kinetic store), all 2 marks. q5 and q8 sit on one sheet, so q8 keeps the closed-system
 * form and the device slots rotate through the list by turn.
 */
export const energyDissipated: Generator = {
  id: 'energy-dissipated',
  subjectId: 'physics',
  topicId: DISSIPATION,
  replaces: ['q2', 'q5', 'q8'],
  build(r, slot, turn) {
    if (slot.id === 'q8') {
      // At least half the total is still in the store, and at least 50 J has been dissipated.
      const total = int(r, 4, 40) * 50
      const left = int(r, Math.ceil(total / 100), total / 50 - 1) * 50
      const store = pick(r, STORES)
      const answer = total - left
      const prompt = pick(r, [
        `A closed system contains ${total} J. After a change, ${left} J is in ${store} and the rest has been dissipated. How much, in joules, has been dissipated?`,
        `A closed system holds ${total} J in total. After a change, ${left} J is in ${store}. How much energy, in joules, has been dissipated?`,
      ])
      return numeric(
        slot,
        {
          prompt,
          solution: `In a closed system the total is unchanged, so $${total} - ${left} = ${answer}$ J has been dissipated to the surroundings. It has not gone: it is stored in less useful ways, spread out as thermal energy.`,
          method: ['uses the unchanged total'],
          answer,
          units: 'J',
        },
        { agrees: left + answer === total && answer > 0, detail: `${left} + ${answer} = ${left + answer}` },
        { kind: 'closed system', total, useful: left, store },
      )
    }
    const d = DEVICES[turn % DEVICES.length]!
    const { total, percent, useful } = supplied(r, d.eff)
    const answer = total - useful
    const wasted = slot.id === 'q5'
    const prompt = wasted
      ? pick(r, [
          `${d.name} takes in ${total} J and ${d.useful(String(useful))}. How much energy, in joules, is wasted?`,
          `${d.name} is supplied with ${total} J and ${d.useful(String(useful))}. Calculate how much energy, in joules, is wasted.`,
        ])
      : pick(r, [
          `${d.name} is supplied with ${total} J and ${d.useful(String(useful))}. How much energy, in joules, is dissipated?`,
          `${d.name} is supplied with ${total} J of energy. It ${d.useful(String(useful))}. Calculate the energy dissipated, in joules.`,
        ])
    return numeric(
      slot,
      {
        prompt,
        solution: `$${total} - ${useful} = ${answer}$ J, dissipated to the surroundings, mostly as thermal energy.${wasted ? ' Wasted energy is not destroyed: it is stored in less useful ways.' : ''}`,
        method: ['subtracts useful from total'],
        answer,
        units: 'J',
      },
      { agrees: useful + answer === total && answer > 0 && percent >= 5 && percent <= 95, detail: `${useful} + ${answer} = ${useful + answer}; ${percent}% useful` },
      { kind: wasted ? 'wasted' : 'dissipated', device: d.name, total, useful, percent },
    )
  },
}

const WRAPS: { text: string; drop: [number, number] }[] = [
  { text: 'with no insulation', drop: [24, 35] },
  { text: 'wrapped in bubble wrap', drop: [15, 28] },
  { text: 'wrapped in newspaper', drop: [15, 26] },
  { text: 'wrapped in cotton wool', drop: [12, 24] },
  { text: 'wrapped in foil', drop: [18, 30] },
  { text: 'wrapped in foam', drop: [10, 22] },
  { text: 'wrapped in a woollen sock', drop: [12, 24] },
]
const COOLING_TIMES = [10, 12, 15, 20]

/**
 * The mean rate of cooling from required practical 2, to 2 significant figures: written as
 * q19 (85 °C to 57 °C in 15 minutes, 1.9 °C per minute, 2 marks, no unit on the answer).
 * The division never comes out to two figures by itself, so the rounding is a real step.
 */
export const coolingRate: Generator = {
  id: 'cooling-rate',
  subjectId: 'physics',
  topicId: DISSIPATION,
  replaces: ['q19'],
  build(r, slot) {
    const w = pick(r, WRAPS)
    const { start, drop, t, rate } = draw(
      r,
      (r) => {
        const start = int(r, 75, 90)
        const drop = int(r, ...w.drop)
        const t = pick(r, COOLING_TIMES)
        return { start, drop, t, rate: drop / t }
      },
      ({ rate }) => rate !== sigFigs(rate, 2) && clearAtSigFigs(rate, 2),
    )
    const end = start - drop
    const answer = sigFigs(rate, 2)
    const prompt = pick(r, [
      `In required practical 2, a beaker of water ${w.text} cooled from ${start} °C to ${end} °C in ${t} minutes. Calculate the mean rate of cooling, in °C per minute, to 2 significant figures.`,
      `A beaker of hot water ${w.text} was left for ${t} minutes. Its temperature fell from ${start} °C to ${end} °C. Calculate the mean rate of cooling, in °C per minute, to 2 significant figures.`,
    ])
    // Second route: the rate times the time gives the drop back.
    return numeric(
      slot,
      {
        prompt,
        solution: `Drop $= ${start} - ${end} = ${drop}$ °C. Rate $= ${drop} \\div ${t} = ${sigText(rate, 3)}$, so **${sigText(answer, 2)} °C per minute** to 2 significant figures.`,
        method: [`${drop} ÷ ${t}`],
        answer,
        tolerance: sfTolerance(answer, 2),
        line: sigText(answer, 2),
      },
      { agrees: near(rate * t, drop) && near((start - end) / t, rate), detail: `${show(rate)} × ${t} = ${show(rate * t)} °C` },
      { wrap: w.text, start, end, t, rate: rate.toFixed(4) },
    )
  },
}

/** Masses of water as the practical prints them, in kilograms. */
const WATER = ['0.080', '0.100', '0.120', '0.150', '0.200', '0.250']
const POWER_TIMES = [10, 12, 15, 20, 25, 30]
const BEAKERS = ['an insulated beaker', 'a beaker wrapped in newspaper', 'a beaker wrapped in bubble wrap', 'a beaker wrapped in cotton wool', 'a beaker with no insulation']

/**
 * The mean power out of cooling water, through ΔE = mcΔθ and P = E ÷ t: written as q24
 * (0.080 kg from 86 °C to 62 °C in 15 minutes, 8.96 W, 3 marks). The numbers are drawn so the
 * power is exact to two decimal places and between 2 W and 40 W.
 */
export const coolingPower: Generator = {
  id: 'cooling-power',
  subjectId: 'physics',
  topicId: DISSIPATION,
  replaces: ['q24'],
  build(r, slot) {
    const beaker = pick(r, BEAKERS)
    const { mText, m, start, drop, t, dE, seconds, P } = draw(
      r,
      (r) => {
        const mText = pick(r, WATER)
        const m = Number(mText)
        const start = int(r, 75, 90)
        const drop = int(r, 10, 30)
        const t = pick(r, POWER_TIMES)
        const dE = Math.round(m * 4200 * drop)
        const seconds = t * 60
        return { mText, m, start, drop, t, dE, seconds, P: dE / seconds }
      },
      ({ P }) => atMost(P, 2) && P >= 2 && P <= 40,
    )
    const end = start - drop
    const answer = roundTo(P, 2)
    // Second route: the power times the time gives the energy back, and the energy is mcΔθ.
    return numeric(
      slot,
      {
        prompt: `Water in ${beaker} cools from ${start} °C to ${end} °C in ${t} minutes. The water has a mass of ${mText} kg and a specific heat capacity of 4200 J/kg °C. Calculate the mean rate at which energy is transferred out of the water, in watts.`,
        solution: `Energy out $= m c \\Delta\\theta = ${mText} \\times 4200 \\times ${drop} = ${tex(dE)}$ J. Time $= ${t} \\times 60 = ${seconds}$ s. Rate $= \\dfrac{${tex(dE)}}{${seconds}} = ${show(answer)}$ W. A watt is a joule per second, so the time must be in seconds.`,
        method: [`$\\Delta E = ${mText} \\times 4200 \\times ${drop} = ${tex(dE)}$ J`, `divides by ${seconds} s`],
        answer,
        tolerance: dpTolerance(answer),
        units: 'W',
      },
      { agrees: near(answer * seconds, dE) && near(m * 4200 * (start - end), dE), detail: `${answer} × ${seconds} = ${show(answer * seconds)} J; ${m} × 4200 × ${start - end} = ${show(m * 4200 * (start - end))} J` },
      { beaker, m: mText, start, end, t, dE },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Power and efficiency
// ---------------------------------------------------------------------------------------------

interface Powered {
  text: (E: string, t: string) => string
  whose: string
  work?: boolean
  power: [number, number]
  step: number
  time: [number, number]
}
const POWERED: Powered[] = [
  { text: (E, t) => `A device transfers ${E} J in ${t} s.`, whose: 'its', power: [50, 500], step: 10, time: [2, 20] },
  { text: (E, t) => `A motor transfers ${E} J in ${t} s.`, whose: 'its', power: [100, 2000], step: 50, time: [5, 60] },
  { text: (E, t) => `A filament lamp transfers ${E} J in ${t} s.`, whose: 'its', power: [40, 100], step: 10, time: [5, 60] },
  { text: (E, t) => `A kettle transfers ${E} J to the water in ${t} s.`, whose: 'its', power: [1800, 3000], step: 100, time: [20, 120] },
  { text: (E, t) => `A student runs up a flight of stairs, doing ${E} J of work in ${t} s.`, whose: "the student's", work: true, power: [200, 600], step: 50, time: [3, 10] },
  { text: (E, t) => `A crane lifts a load, doing ${E} J of work in ${t} s.`, whose: "the crane's", work: true, power: [1000, 5000], step: 500, time: [10, 60] },
  { text: (E, t) => `A microwave oven transfers ${E} J to the food in ${t} s.`, whose: 'its', power: [700, 1000], step: 50, time: [30, 120] },
  { text: (E, t) => `An electric heater transfers ${E} J in ${t} s.`, whose: 'its', power: [1000, 2500], step: 100, time: [10, 60] },
]
/** Seconds as the written questions print them: 8.0 s under ten, 25 s above. */
const seconds = (t: number) => (t < 10 ? `${t}.0` : String(t))

/**
 * P = E ÷ t, or W ÷ t for work done: written as q2 (1200 J in 8.0 s, 150 W, 2 marks). The
 * power is drawn from what the device really manages and the energy follows from it.
 */
export const powerFromEnergy: Generator = {
  id: 'power-from-energy-and-time',
  subjectId: 'physics',
  topicId: POWER,
  replaces: ['q2'],
  build(r, slot) {
    const c = pick(r, POWERED)
    const P = stepped(r, c.power[0], c.power[1], c.step)
    const t = int(r, ...c.time)
    const E = P * t
    const letter = c.work ? 'W' : 'E'
    // Second route: the power times the time gives the energy back.
    return numeric(
      slot,
      {
        prompt: `${c.text(prose(E), seconds(t))} Calculate ${c.whose} power, in watts.`,
        solution: `$P = \\dfrac{${letter}}{t} = \\dfrac{${tex(E)}}{${seconds(t)}} = ${P}$ W.${c.work ? ' Work done is energy transferred, so the two forms of the equation are the same.' : ''}`,
        method: [`uses P = ${letter}/t`],
        answer: P,
        units: 'W',
      },
      { agrees: P * t === E && Number.isInteger(P), detail: `${P} × ${t} = ${P * t} J` },
      { context: c.whose, E, t, P },
    )
  },
}

const EFFICIENT: Device[] = [
  { name: 'A filament lamp', useful: (y) => `transfers ${y} J usefully as light`, eff: [5, 10] },
  { name: 'An LED lamp', useful: (y) => `transfers ${y} J usefully as light`, eff: [80, 90] },
  { name: 'A motor', useful: (y) => `transfers ${y} J usefully`, eff: [60, 90] },
  { name: 'A kettle', useful: (y) => `transfers ${y} J to the water`, eff: [70, 90] },
  { name: 'A petrol engine', useful: (y) => `transfers ${y} J usefully to the kinetic store of the car`, eff: [25, 35] },
  { name: 'A solar panel', useful: (y) => `transfers ${y} J usefully to the circuit it supplies`, eff: [15, 22] },
  { name: 'A wind turbine', useful: (y) => `transfers ${y} J usefully to the grid`, eff: [30, 45] },
  { name: 'A gas boiler', useful: (y) => `transfers ${y} J to the water`, eff: [85, 95] },
  { name: 'A phone charger', useful: (y) => `transfers ${y} J to the battery`, eff: [80, 90] },
  { name: 'A loudspeaker', useful: (y) => `transfers ${y} J usefully as sound`, eff: [5, 10] },
]

/**
 * Efficiency as a percentage from energies: written as q4 (a lamp, 5 J of 100 J, 5%, 2
 * marks). Each device's efficiency is drawn from the range it really has.
 */
export const efficiencyAsPercentage: Generator = {
  id: 'efficiency-as-a-percentage',
  subjectId: 'physics',
  topicId: POWER,
  replaces: ['q4'],
  build(r, slot) {
    const d = pick(r, EFFICIENT)
    const { total, percent, useful } = supplied(r, d.eff)
    const decimal = show(percent / 100)
    const prompt = pick(r, [
      `${d.name} is supplied with ${total} J and ${d.useful(String(useful))}. Calculate its efficiency as a percentage.`,
      `${d.name} is supplied with ${total} J of energy and ${d.useful(String(useful))}. What is its efficiency, as a percentage?`,
    ])
    // Second route: the percentage of the total is the useful energy.
    const back = (percent / 100) * total
    return numeric(
      slot,
      {
        prompt,
        solution: `$\\text{efficiency} = \\dfrac{${useful}}{${total}} = ${decimal}$, and $${decimal} \\times 100 = ${percent}\\%$. Useful divided by total, never the other way round: an efficiency can never be more than 100%.`,
        method: ['divides useful by total'],
        answer: percent,
        units: '%',
      },
      { agrees: near(back, useful) && percent >= 5 && percent <= 95, detail: `${percent}% of ${total} = ${show(back)} J` },
      { device: d.name, total, useful, percent },
    )
  },
}

interface Rated {
  name: (kw: string) => string
  kw: [number, number]
}
const RATED: Rated[] = [
  { name: (p) => `A ${p} kW kettle`, kw: [2, 3] },
  { name: (p) => `A ${p} kW electric heater`, kw: [1, 2.5] },
  { name: (p) => `A ${p} kW hairdryer`, kw: [1.2, 2] },
  { name: (p) => `A ${p} kW microwave oven`, kw: [0.8, 1.2] },
  { name: (p) => `An electric oven rated ${p} kW`, kw: [2, 3] },
  { name: (p) => `An iron rated ${p} kW`, kw: [1, 2.4] },
  { name: (p) => `An electric shower rated ${p} kW`, kw: [7, 10] },
  { name: (p) => `A ${p} kW motor`, kw: [1.5, 5] },
  { name: (p) => `A ${p} kW toaster`, kw: [0.8, 1.5] },
]
const MINUTES = [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 10]

/**
 * E = Pt with the power in kilowatts and the time in minutes: written as q5 (a 2.5 kW kettle
 * for 2.0 minutes, 300 000 J, 3 marks). Both conversions are the first mark.
 */
export const energyFromPower: Generator = {
  id: 'energy-from-power-and-time',
  subjectId: 'physics',
  topicId: POWER,
  replaces: ['q5'],
  build(r, slot) {
    const c = pick(r, RATED)
    const kw = stepped(r, c.kw[0], c.kw[1], 0.1)
    const t = pick(r, MINUTES)
    const W = Math.round(kw * 1000)
    const s = Math.round(t * 60)
    const E = W * s
    const prompt = pick(r, [
      `${c.name(show(kw))} runs for ${show(t)} minutes. Calculate the energy transferred, in joules.`,
      `${c.name(show(kw))} is switched on for ${show(t)} minutes. How much energy, in joules, does it transfer?`,
    ])
    // Second route: the energy divided by the power in watts is the time in seconds.
    const tBack = E / W / 60
    return numeric(
      slot,
      {
        prompt,
        solution: `Convert both first: ${show(kw)} kW = **${W} W**, and ${show(t)} minutes = **${s} s**. Then ${closes(`E = P t = ${W} \\times ${s}`, E, 'J')}`,
        method: ['converts kW to W and minutes to seconds', 'uses E = Pt'],
        answer: E,
        units: 'J',
      },
      { agrees: near(tBack, t) && near(kw * 1000 * t * 60, E), detail: `${E} ÷ ${W} ÷ 60 = ${show(tBack)} minutes` },
      { device: c.name('P'), kw, t, W, s },
    )
  },
}

interface PoweredDevice {
  name: string
  unit: 'W' | 'kW'
  total: number[]
  eff: [number, number]
}
const POWERED_DEVICES: PoweredDevice[] = [
  { name: 'A motor', unit: 'W', total: [200, 250, 400, 500, 800, 1000, 1200, 1500, 2000, 2500, 3000], eff: [60, 90] },
  { name: 'A kettle', unit: 'W', total: [2000, 2200, 2400, 2500, 3000], eff: [70, 90] },
  { name: 'An LED lamp', unit: 'W', total: [5, 8, 10, 12, 15, 20], eff: [80, 90] },
  { name: 'A filament lamp', unit: 'W', total: [40, 60, 100], eff: [5, 10] },
  { name: 'An electric car motor', unit: 'kW', total: [50, 60, 80, 100, 120, 150], eff: [85, 95] },
  { name: 'A wind turbine', unit: 'kW', total: [500, 1000, 1500, 2000, 2500, 3000], eff: [30, 45] },
  { name: 'A petrol engine', unit: 'kW', total: [50, 60, 80, 100, 120], eff: [25, 35] },
  { name: 'A solar panel', unit: 'W', total: [200, 250, 300, 400, 500], eff: [15, 22] },
  { name: 'A loudspeaker', unit: 'W', total: [20, 40, 50, 100], eff: [5, 10] },
]

/**
 * Efficiency as a decimal from powers: written as q6 (600 W useful of 1000 W in, 0.6, 2
 * marks). Some devices are rated in kilowatts, both figures alike, so the ratio needs no
 * conversion: the unfamiliar step is noticing that.
 */
export const efficiencyFromPowers: Generator = {
  id: 'efficiency-from-powers',
  subjectId: 'physics',
  topicId: POWER,
  replaces: ['q6'],
  build(r, slot) {
    const d = pick(r, POWERED_DEVICES)
    const { total, percent, useful } = draw(
      r,
      (r) => {
        const total = pick(r, d.total)
        const percent = int(r, ...d.eff)
        return { total, percent, useful: Number(show((total * percent) / 100)) }
      },
      ({ useful }) => atMost(useful, 1),
    )
    const answer = Number(show(percent / 100))
    // Second route: the decimal times the total power is the useful power.
    const back = answer * total
    return numeric(
      slot,
      {
        prompt: `${d.name} has a useful power output of ${show(useful)} ${d.unit} and a total power input of ${total} ${d.unit}. Calculate its efficiency as a decimal.`,
        solution: `$\\text{efficiency} = \\dfrac{${show(useful)}}{${total}} = ${show(answer)}$. ${d.unit === 'kW' ? 'Both powers are in kilowatts, so the ratio needs no conversion: the units cancel.' : 'Efficiency can be found from powers as well as energies: the seconds cancel, so the ratio is the same.'}`,
        method: ['divides useful power by total power'],
        answer,
        tolerance: dpTolerance(answer),
      },
      { agrees: near(back, useful) && answer > 0 && answer < 1, detail: `${answer} × ${total} = ${show(back)} ${d.unit}` },
      { device: d.name, unit: d.unit, total, useful, percent },
    )
  },
}

export const energyGenerators: Generator[] = [
  kineticEnergy,
  gravitationalPotentialEnergy,
  potentialEnergyHeight,
  kineticEnergySpeed,
  fallingObject,
  kineticEnergyFromKmh,
  fallWithDissipation,
  kineticEnergyStandardForm,
  energyDissipated,
  coolingRate,
  coolingPower,
  powerFromEnergy,
  efficiencyAsPercentage,
  energyFromPower,
  efficiencyFromPowers,
]
