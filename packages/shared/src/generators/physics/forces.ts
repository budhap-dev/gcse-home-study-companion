import { fixed, show } from '../format.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import type { Generator } from '../types.ts'
import { G, G_STATED, atMost, cap, closes, near, numeric, prose, stepped, tex } from './build.ts'
import { clearAtSigFigs, dpTolerance, sfTolerance, sigFigs, sigText } from './format.ts'

/**
 * Forces (AQA 8463, topic 5): weight, resultant forces and work done, Newton's laws and
 * F = ma, inertial mass. Every numeric question without a diagram in the two topics has a
 * generator here; the written questions are the model for the wording and the mark scheme,
 * g = 9.8 N/kg is stated where the written prompt states it, and the contexts are drawn from
 * lists that carry the masses, forces and accelerations each one really has.
 */
const NEWTON = 'newtons-laws'
const RESULTANT = 'resultant-forces'

const clean = (x: number) => Number(show(x))
const an = (noun: string) => `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`

// ---------------------------------------------------------------------------------------------
// Newton's laws: F = ma
// ---------------------------------------------------------------------------------------------

interface Body {
  name: string
  /** "a motorbike and rider" take "their" and "them", and plural verbs. */
  plural?: boolean
  /** A skateboarder takes "their" and "them" too, with singular verbs. */
  person?: boolean
  mass: [number, number]
  step: number
  accel: [number, number]
  aStep: number
}
const its = (b: Body) => (b.plural || b.person ? 'their' : 'its')
const them = (b: Body) => (b.plural || b.person ? 'them' : 'it')
/**
 * "a trolley of mass 2 kg", or "a motorbike and rider with a total mass of 300 kg". Never
 * "a 8 kg box": the article before a number read aloud ("an eight") cannot be chosen from
 * its digits.
 */
const sized = (b: { name: string; plural?: boolean }, m: number) => (b.plural ? `${an(b.name)} with a total mass of ${prose(m)} kg` : `${an(b.name)} of mass ${prose(m)} kg`)

/** Things a Year 10 can picture being pushed, with the masses and accelerations each really has. */
const SMALL_BODIES: Body[] = [
  { name: 'trolley', mass: [0.5, 5], step: 0.5, accel: [0.2, 3], aStep: 0.1 },
  { name: 'box', mass: [2, 50], step: 1, accel: [0.2, 2], aStep: 0.1 },
  { name: 'shopping trolley', mass: [20, 40], step: 1, accel: [0.2, 1], aStep: 0.1 },
  { name: 'sledge', mass: [5, 20], step: 1, accel: [0.5, 3], aStep: 0.5 },
  { name: 'skateboarder', person: true, mass: [40, 70], step: 1, accel: [0.5, 2], aStep: 0.5 },
  { name: 'bicycle and rider', plural: true, mass: [70, 100], step: 1, accel: [0.5, 2], aStep: 0.1 },
  { name: 'go-kart and driver', plural: true, mass: [100, 200], step: 10, accel: [1, 3], aStep: 0.5 },
]
const VEHICLES: Body[] = [
  { name: 'motorbike and rider', plural: true, mass: [200, 350], step: 10, accel: [1, 5], aStep: 0.5 },
  { name: 'car', mass: [900, 1800], step: 50, accel: [1, 4], aStep: 0.5 },
  { name: 'van', mass: [2000, 3500], step: 100, accel: [0.5, 2.5], aStep: 0.5 },
  { name: 'bicycle and rider', plural: true, mass: [70, 100], step: 1, accel: [0.5, 2], aStep: 0.1 },
  { name: 'lorry', mass: [10000, 30000], step: 1000, accel: [0.2, 1], aStep: 0.1 },
  { name: 'bus', mass: [10000, 14000], step: 500, accel: [0.5, 1.5], aStep: 0.1 },
  { name: 'train', mass: [100000, 400000], step: 10000, accel: [0.2, 1], aStep: 0.1 },
]
/** Unnamed things for the inertial-mass slot, as the written question has "an object". */
const OBJECTS: Body[] = [
  { name: 'object', mass: [5, 100], step: 5, accel: [0.2, 3], aStep: 0.1 },
  { name: 'crate', mass: [20, 100], step: 5, accel: [0.2, 2], aStep: 0.1 },
  { name: 'trolley', mass: [0.5, 5], step: 0.5, accel: [0.2, 3], aStep: 0.1 },
  { name: 'boat', mass: [200, 1000], step: 50, accel: [0.2, 1], aStep: 0.1 },
  { name: 'go-kart and driver', plural: true, mass: [100, 200], step: 10, accel: [1, 3], aStep: 0.5 },
  { name: 'sledge', mass: [5, 20], step: 1, accel: [0.5, 3], aStep: 0.5 },
]

/**
 * A mass and an acceleration from a body's ranges whose product is a force with at most one
 * decimal place (or a whole number when `wholeForce`), with no coincidence: the mass is never
 * 1 kg, and the force never equals the mass or the acceleration.
 */
function pushed(r: Rng, b: Body, wholeForce: boolean) {
  return draw(
    r,
    (r) => {
      const m = stepped(r, b.mass[0], b.mass[1], b.step)
      const a = stepped(r, b.accel[0], b.accel[1], b.aStep)
      return { m, a, F: clean(m * a) }
    },
    ({ m, a, F }) => m !== 1 && a !== m && F >= 1 && (wholeForce ? Number.isInteger(F) : atMost(F, 1)) && F !== m && F !== a,
  )
}

/**
 * F = ma: written as q1 (a 2 kg trolley at 3 m/s², 2 marks, grade 4–5). Small bodies only,
 * so the slot keeps its band.
 */
export const forceFromMassAndAcceleration: Generator = {
  id: 'force-from-mass-and-acceleration',
  subjectId: 'physics',
  topicId: NEWTON,
  replaces: ['q1'],
  build(r, slot, turn) {
    const b = SMALL_BODIES[turn % SMALL_BODIES.length]!
    const { m, a, F } = pushed(r, b, false)
    const prompt = pick(r, [
      `A resultant force acts on ${sized(b, m)} and gives ${them(b)} an acceleration of ${show(a)} m/s². Calculate the resultant force, in newtons.`,
      `${cap(sized(b, m))} accelerates at ${show(a)} m/s². Calculate the resultant force on ${them(b)}, in newtons.`,
    ])
    // Second route: the acceleration back from the force and the mass.
    const aBack = F / m
    return numeric(
      slot,
      {
        prompt,
        solution: closes(`F = m a = ${tex(m)} \\times ${tex(a)}`, F, 'N'),
        method: [`$${tex(m)} \\times ${tex(a)}$`],
        answer: F,
        tolerance: dpTolerance(F),
        units: 'N',
      },
      { agrees: near(aBack, a) && near(F / a, m), detail: `${F} ÷ ${m} = ${show(aBack)} m/s²` },
      { context: b.name, m, a },
    )
  },
}

/**
 * a = F ÷ m: written as q3 (30 N on a 5 kg box, 2 marks, grade 4–5). The force given is a
 * whole number of newtons and the acceleration has at most one decimal place.
 */
export const accelerationFromForce: Generator = {
  id: 'acceleration-from-force-and-mass',
  subjectId: 'physics',
  topicId: NEWTON,
  replaces: ['q3'],
  build(r, slot, turn) {
    const b = SMALL_BODIES[turn % SMALL_BODIES.length]!
    const { m, a, F } = pushed(r, b, true)
    const prompt = pick(r, [
      `A resultant force of ${prose(F)} N acts on ${sized(b, m)}. Calculate ${its(b)} acceleration, in m/s².`,
      `${cap(sized(b, m))} ${b.plural ? 'are' : 'is'} pushed with a resultant force of ${prose(F)} N. What is ${its(b)} acceleration, in m/s²?`,
    ])
    // Second route: forwards, the mass times the acceleration found.
    const forward = m * a
    return numeric(
      slot,
      {
        prompt,
        solution: closes(`a = F \\div m = ${tex(F)} \\div ${tex(m)}`, a, 'm/s²'),
        method: [`$${tex(F)} \\div ${tex(m)}$`],
        answer: a,
        tolerance: dpTolerance(a),
        units: 'm/s²',
      },
      { agrees: near(forward, F) && near(F / m, a), detail: `${m} × ${a} = ${show(forward)} N` },
      { context: b.name, m, F },
    )
  },
}

/**
 * m = F ÷ a: written as q6 (450 N gives a motorbike and rider 1.5 m/s², 2 marks) and q17 (24 N
 * gives an object 0.8 m/s², "inertial mass", 2 marks). q6 keeps to vehicles and q17 to
 * unnamed objects, and q17 keeps the written question's word.
 */
export const massFromForceAndAcceleration: Generator = {
  id: 'mass-from-force-and-acceleration',
  subjectId: 'physics',
  topicId: NEWTON,
  replaces: ['q6', 'q17'],
  build(r, slot, turn) {
    const inertial = slot.id === 'q17'
    const list = inertial ? OBJECTS : VEHICLES
    const b = list[turn % list.length]!
    const { m, a, F } = pushed(r, b, true)
    const what = inertial ? `${its(b)} inertial mass` : b.plural ? 'their total mass' : 'its mass'
    const prompt = pick(r, [
      `A resultant force of ${prose(F)} N gives ${an(b.name)} an acceleration of ${show(a)} m/s². Calculate ${what}, in kg.`,
      `${cap(an(b.name))} ${b.plural ? 'accelerate' : 'accelerates'} at ${show(a)} m/s² when the resultant force on ${them(b)} is ${prose(F)} N. Calculate ${what}, in kg.`,
    ])
    const expr = `${tex(F)} \\div ${tex(a)}`
    const solution = inertial
      ? `${closes(`\\text{inertial mass} = F \\div a = ${expr}`, m, 'kg')} Inertial mass is the ratio of force to acceleration: it measures how hard it is to change ${its(b)} velocity.`
      : closes(`m = F \\div a = ${expr}`, m, 'kg')
    // Second route: forwards, the mass found times the acceleration.
    const forward = m * a
    return numeric(
      slot,
      {
        prompt,
        solution,
        method: [`$${expr}$`],
        answer: m,
        tolerance: dpTolerance(m),
        units: 'kg',
      },
      { agrees: near(forward, F) && near(F / a, m), detail: `${m} × ${a} = ${show(forward)} N` },
      { context: b.name, F, a },
    )
  },
}

/** Vehicles braking, with the decelerations their brakes really give. */
const BRAKERS: Body[] = [
  { name: 'car', mass: [900, 1800], step: 50, accel: [3, 10], aStep: 0.5 },
  { name: 'van', mass: [2000, 3500], step: 100, accel: [3, 8], aStep: 0.5 },
  { name: 'lorry', mass: [10000, 30000], step: 1000, accel: [2, 6], aStep: 0.5 },
  { name: 'train', mass: [100000, 400000], step: 10000, accel: [0.5, 2], aStep: 0.1 },
  { name: 'bicycle and rider', plural: true, mass: [70, 100], step: 1, accel: [2, 6], aStep: 0.5 },
  { name: 'motorbike and rider', plural: true, mass: [200, 350], step: 10, accel: [3, 9], aStep: 0.5 },
  { name: 'bus', mass: [10000, 14000], step: 500, accel: [2, 5], aStep: 0.5 },
]

/**
 * A deceleration from a braking force: written as q9 (a 1600 kg car braking with 8000 N, 2
 * marks). The answer is the size of the deceleration, as the written question marks it.
 */
export const decelerationFromBrakingForce: Generator = {
  id: 'deceleration-from-braking-force',
  subjectId: 'physics',
  topicId: NEWTON,
  replaces: ['q9'],
  build(r, slot, turn) {
    const b = BRAKERS[turn % BRAKERS.length]!
    const { m, a, F } = pushed(r, b, true)
    const prompt = pick(r, [
      `${cap(sized(b, m))} ${b.plural ? 'brake' : 'brakes'} with a resultant force of ${prose(F)} N. Calculate ${its(b)} deceleration, in m/s².`,
      `${cap(an(b.name))} of ${b.plural ? 'total ' : ''}mass ${prose(m)} kg ${b.plural ? 'brake' : 'brakes'}. The resultant force on ${them(b)} is ${prose(F)} N. Calculate ${its(b)} deceleration, in m/s².`,
    ])
    // Second route: forwards, the mass times the deceleration found.
    const forward = m * a
    return numeric(
      slot,
      {
        prompt,
        solution: `${closes(`a = F \\div m = ${tex(F)} \\div ${tex(m)}`, a, 'm/s²').slice(0, -1)}, a deceleration because the resultant force opposes the motion.`,
        method: [`$${tex(F)} \\div ${tex(m)}$`],
        answer: a,
        tolerance: dpTolerance(a),
        units: 'm/s²',
      },
      { agrees: near(forward, F) && near(F / m, a), detail: `${m} × ${a} = ${show(forward)} N` },
      { context: b.name, m, F },
    )
  },
}

interface Driven extends Body {
  speed: [number, number]
  time: [number, number]
  resist: [number, number]
  rStep: number
  /** What provides the driving force: "the engine". */
  source: string
}
const DRIVEN: Driven[] = [
  { name: 'car', mass: [900, 1800], step: 50, accel: [1, 4], aStep: 0.1, speed: [10, 30], time: [4, 12], resist: [300, 800], rStep: 50, source: 'the engine' },
  { name: 'van', mass: [2000, 3500], step: 100, accel: [0.5, 2.5], aStep: 0.1, speed: [10, 25], time: [6, 15], resist: [500, 1200], rStep: 100, source: 'the engine' },
  { name: 'motorbike and rider', plural: true, mass: [200, 350], step: 10, accel: [2, 6], aStep: 0.1, speed: [15, 35], time: [3, 8], resist: [100, 300], rStep: 50, source: 'the engine' },
  { name: 'lorry', mass: [10000, 30000], step: 1000, accel: [0.2, 1], aStep: 0.1, speed: [10, 25], time: [15, 40], resist: [2000, 6000], rStep: 500, source: 'the engine' },
  { name: 'bus', mass: [10000, 14000], step: 500, accel: [0.4, 1.2], aStep: 0.1, speed: [8, 15], time: [8, 20], resist: [1000, 3000], rStep: 500, source: 'the engine' },
  { name: 'train', mass: [100000, 400000], step: 10000, accel: [0.2, 1], aStep: 0.1, speed: [20, 40], time: [30, 80], resist: [20000, 60000], rStep: 5000, source: 'the motors' },
]

/**
 * a = Δv ÷ t, F = ma, then the driving force is the resultant plus the resistance: written
 * as q11 (a 900 kg car, rest to 15 m/s in 6 s, 500 N of resistance, 4 marks). The speed and
 * time give an acceleration to one decimal place, and the resultant is a whole number.
 */
export const drivingForceWithResistance: Generator = {
  id: 'driving-force-with-resistance',
  subjectId: 'physics',
  topicId: NEWTON,
  replaces: ['q11'],
  build(r, slot, turn) {
    const c = DRIVEN[turn % DRIVEN.length]!
    const { m, v, t, a, R, F } = draw(
      r,
      (r) => {
        const m = stepped(r, c.mass[0], c.mass[1], c.step)
        const v = int(r, ...c.speed)
        const t = int(r, ...c.time)
        const a = clean(v / t)
        const R = stepped(r, c.resist[0], c.resist[1], c.rStep)
        return { m, v, t, a, R, F: clean(m * a) }
      },
      // Never a = 1 (the resultant would equal the mass) and never a resultant equal to the
      // resistance, which would read as doubling.
      ({ a, R, F }) => atMost(a, 1) && a >= c.accel[0] && a <= c.accel[1] && a !== 1 && Number.isInteger(F) && F !== R,
    )
    const driving = F + R
    const prompt = pick(r, [
      `${cap(sized(c, m))} ${c.plural ? 'accelerate' : 'accelerates'} from rest to ${v} m/s in ${t} s. The resistive forces total ${prose(R)} N. Calculate the driving force from ${c.source}, in newtons.`,
      `${cap(an(c.name))} of ${c.plural ? 'total ' : ''}mass ${prose(m)} kg ${c.plural ? 'go' : 'goes'} from rest to ${v} m/s in ${t} s against resistive forces totalling ${prose(R)} N. Calculate the driving force from ${c.source}, in newtons.`,
    ])
    // Second route: the driving force less the resistance, over the mass, is the speed over the time.
    const aBack = (driving - R) / m
    return numeric(
      slot,
      {
        prompt,
        solution: `$a = \\Delta v \\div t = ${v} \\div ${t} = ${show(a)}$ m/s². Resultant force $= m a = ${tex(m)} \\times ${show(a)} = ${tex(F)}$ N. The driving force must also overcome the ${prose(R)} N of resistance: ${closes(`${tex(F)} + ${tex(R)}`, driving, 'N')}`,
        method: [`$a = ${v} \\div ${t} = ${show(a)}$ m/s²`, `resultant $= ${tex(m)} \\times ${show(a)} = ${tex(F)}$ N`, `driving force $= ${tex(F)} + ${tex(R)}$`],
        answer: driving,
        units: 'N',
      },
      { agrees: near(aBack, v / t) && Number.isInteger(driving), detail: `(${driving} − ${R}) ÷ ${m} = ${show(aBack)} m/s²; ${v} ÷ ${t} = ${show(v / t)}` },
      { context: c.name, m, v, t, R },
    )
  },
}

interface Lifted {
  text: (m: string, F: string) => string
  ask: string
  mass: [number, number]
  step: number
  accel: [number, number]
}
/** Things that take off, for q14, with the initial accelerations their thrust really gives. */
const THRUSTERS: Lifted[] = [
  { text: (m, F) => `A rocket of mass ${m} kg produces a thrust of ${F} N at launch.`, ask: "the rocket's initial acceleration", mass: [5000, 50000], step: 1000, accel: [1, 5] },
  { text: (m, F) => `A model rocket of mass ${m} kg produces a thrust of ${F} N at launch.`, ask: "the model rocket's initial acceleration", mass: [0.5, 2], step: 0.5, accel: [2, 5] },
  { text: (m, F) => `A drone of mass ${m} kg takes off. Its rotors push it upwards with a force of ${F} N.`, ask: "the drone's initial acceleration", mass: [1, 5], step: 0.5, accel: [1, 4] },
  { text: (m, F) => `A helicopter of mass ${m} kg takes off. Its rotors provide an upward lift force of ${F} N.`, ask: "the helicopter's initial acceleration", mass: [2000, 5000], step: 500, accel: [1, 3] },
  { text: (m, F) => `A jump jet of mass ${m} kg takes off vertically with a thrust of ${F} N.`, ask: "the jet's initial acceleration", mass: [5000, 10000], step: 500, accel: [1, 4] },
]
/** Things hauled up on a cable or rope, for q19. */
const HAULED: Lifted[] = [
  { text: (m, F) => `A lift of mass ${m} kg is pulled upwards by a cable with a tension of ${F} N.`, ask: 'the acceleration of the lift', mass: [600, 1500], step: 50, accel: [0.5, 3] },
  { text: (m, F) => `A crane lifts a load of mass ${m} kg. The tension in the cable is ${F} N.`, ask: 'the acceleration of the load', mass: [500, 5000], step: 100, accel: [0.5, 2] },
  { text: (m, F) => `A bucket of mass ${m} kg is hauled up a well by a rope with a tension of ${F} N.`, ask: 'the acceleration of the bucket', mass: [5, 20], step: 1, accel: [0.5, 3] },
  { text: (m, F) => `A climber of mass ${m} kg is hauled upwards by a rope with a tension of ${F} N.`, ask: 'the acceleration of the climber', mass: [50, 90], step: 1, accel: [0.5, 2] },
  { text: (m, F) => `A helicopter winch lifts a person of mass ${m} kg. The tension in the winch cable is ${F} N.`, ask: 'the acceleration of the person', mass: [60, 100], step: 1, accel: [0.5, 2] },
]

/**
 * Weight, then the resultant of an upward force and the weight, then a = F ÷ m: written as
 * q14 (a 5000 kg rocket with 60 000 N of thrust, 2.2 m/s², 4 marks) and q19 (a 600 kg lift
 * on a cable at 7200 N, 2.2 m/s², 4 marks). The acceleration is drawn first, to one decimal
 * place and in the range the thing really manages, and the upward force follows from it, so
 * the force always exceeds the weight by a believable margin. The answer is "upwards", as
 * the written mark schemes have it.
 */
export const accelerationAgainstWeight: Generator = {
  id: 'acceleration-against-weight',
  subjectId: 'physics',
  topicId: NEWTON,
  replaces: ['q14', 'q19'],
  build(r, slot, turn) {
    const list = slot.id === 'q14' ? THRUSTERS : HAULED
    const c = list[turn % list.length]!
    const { m, a, W, T, R } = draw(
      r,
      (r) => {
        const m = stepped(r, c.mass[0], c.mass[1], c.step)
        const a = stepped(r, c.accel[0], c.accel[1], 0.1)
        const W = clean(m * G)
        const R = clean(m * a)
        return { m, a, W, T: clean(W + R), R }
      },
      // Never a = 1 (the resultant would equal the mass), m = 1 kg (the resultant would equal
      // the acceleration) nor an acceleration equal to the mass.
      ({ m, a, W, T }) => atMost(W, 1) && atMost(T, 1) && a !== 1 && m !== 1 && a !== m,
    )
    // Second route: the force over the mass, less g, is the acceleration.
    const aBack = T / m - G
    return numeric(
      slot,
      {
        prompt: `${c.text(prose(m), prose(T))} ${pick(r, G_STATED)} Calculate ${c.ask}, in m/s².`,
        solution: `Weight $= m g = ${tex(m)} \\times 9.8 = ${tex(W)}$ N. Resultant $= ${tex(T)} - ${tex(W)} = ${tex(R)}$ N upwards. $a = F \\div m = ${tex(R)} \\div ${tex(m)} = ${show(a)}$ m/s² upwards.`,
        method: [`weight $= ${tex(m)} \\times 9.8 = ${tex(W)}$ N`, `resultant $= ${tex(T)} - ${tex(W)} = ${tex(R)}$ N`, `$${tex(R)} \\div ${tex(m)}$`],
        answer: a,
        tolerance: dpTolerance(a),
        units: 'm/s²',
        line: `${show(a)} m/s² upwards`,
      },
      { agrees: near(aBack, a) && near((T - W) / m, a) && T > W, detail: `${T} ÷ ${m} − 9.8 = ${show(aBack)} m/s²` },
      { context: c.ask, m, a, W, T },
    )
  },
}

interface Estimate {
  name: string
  plural?: boolean
  masses: number[]
  /** Speeds in m/s with the round mph each is "about". */
  speeds: [number, number][]
  time: [number, number]
  accel: [number, number]
}
const ESTIMATES: Estimate[] = [
  { name: 'car', masses: [1000, 1200, 1500], speeds: [[9, 20], [13, 30], [18, 40]], time: [6, 12], accel: [1, 3] },
  { name: 'van', masses: [2000, 2500, 3000], speeds: [[9, 20], [13, 30]], time: [8, 15], accel: [0.8, 2] },
  { name: 'lorry', masses: [10000, 15000, 20000, 30000], speeds: [[9, 20], [13, 30]], time: [15, 30], accel: [0.3, 1] },
  { name: 'bus', masses: [10000, 12000, 15000], speeds: [[9, 20], [13, 30]], time: [10, 20], accel: [0.5, 1.2] },
  { name: 'motorbike and rider', plural: true, masses: [200, 250, 300], speeds: [[13, 30], [18, 40], [27, 60]], time: [4, 8], accel: [2, 5] },
  { name: 'bicycle and rider', plural: true, masses: [80, 90, 100], speeds: [[9, 20]], time: [6, 10], accel: [0.8, 2] },
]

/**
 * An estimate of a resultant force from round figures: written as q16 (a 1000 kg car, rest
 * to 13 m/s, about 30 mph, in 10 s, 1300 N, 3 marks). The acceleration has at most two
 * decimal places and the force is a whole number of newtons.
 */
export const estimatingAForce: Generator = {
  id: 'estimating-a-resultant-force',
  subjectId: 'physics',
  topicId: NEWTON,
  replaces: ['q16'],
  build(r, slot, turn) {
    const c = ESTIMATES[turn % ESTIMATES.length]!
    const { m, v, mph, t, a, F } = draw(
      r,
      (r) => {
        const m = pick(r, c.masses)
        const [v, mph] = pick(r, c.speeds)
        const t = int(r, ...c.time)
        const a = clean(v / t)
        return { m, v, mph, t, a, F: clean(m * a) }
      },
      ({ a, F }) => atMost(a, 2) && a >= c.accel[0] && a <= c.accel[1] && a !== 1 && Number.isInteger(F),
    )
    const who = sized(c, m)
    const prompt = pick(r, [
      `Estimate the resultant force on ${who} that ${c.plural ? 'go' : 'goes'} from rest to ${v} m/s, about ${mph} mph, in ${t} s.`,
      `${cap(who)} ${c.plural ? 'go' : 'goes'} from rest to ${v} m/s (about ${mph} mph) in ${t} s. Estimate the resultant force on ${c.plural ? 'them' : 'it'}, in newtons.`,
    ])
    const rough = F >= 1000 ? `About ${prose(F)} N, or roughly ${show(sigFigs(F / 1000, 2))} kN.` : `About ${F} N.`
    // Second route: the force times the time over the speed is the mass.
    const mBack = (F * t) / v
    return numeric(
      slot,
      {
        prompt,
        solution: `$a = ${v} \\div ${t} = ${show(a)}$ m/s². ${closes(`F = m a = ${tex(m)} \\times ${show(a)}`, F, 'N')} ${rough}`,
        method: [`$a = ${v} \\div ${t} = ${show(a)}$ m/s²`, `$${tex(m)} \\times ${show(a)}$`],
        answer: F,
        units: 'N',
      },
      { agrees: near(mBack, m) && Number.isInteger(F), detail: `${F} × ${t} ÷ ${v} = ${show(mBack)} kg` },
      { context: c.name, m, v, mph, t },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Weight and work done
// ---------------------------------------------------------------------------------------------

interface Weighed {
  name: string
  mass: [number, number]
  step: number
}
/** Things weighed on Earth, in whole kilograms, so the weight has at most one decimal place. */
const WEIGHED: Weighed[] = [
  { name: 'bag of potatoes', mass: [2, 10], step: 1 },
  { name: 'cat', mass: [3, 6], step: 1 },
  { name: 'dog', mass: [10, 30], step: 1 },
  { name: 'suitcase', mass: [15, 25], step: 1 },
  { name: 'student', mass: [40, 70], step: 1 },
  { name: 'bicycle', mass: [8, 15], step: 1 },
  { name: 'box of books', mass: [5, 20], step: 1 },
  { name: 'washing machine', mass: [60, 80], step: 1 },
  { name: 'car', mass: [900, 1500], step: 50 },
  { name: 'person', mass: [40, 90], step: 1 },
  { name: 'sack of flour', mass: [10, 25], step: 1 },
  { name: 'horse', mass: [400, 600], step: 10 },
]
const their = (name: string) => (name === 'person' || name === 'student' ? 'their' : 'its')

/**
 * W = mg: written as q2 (a 5 kg bag of potatoes, 49 N, 2 marks). Never a 1 kg mass, whose
 * weight would be the 9.8 the prompt states.
 */
export const weightFromMass: Generator = {
  id: 'weight-from-mass',
  subjectId: 'physics',
  topicId: RESULTANT,
  replaces: ['q2'],
  build(r, slot, turn) {
    const c = WEIGHED[turn % WEIGHED.length]!
    const m = draw(r, (r) => stepped(r, c.mass[0], c.mass[1], c.step), (m) => m !== 1)
    const W = clean(m * G)
    const prompt = pick(r, [
      `Calculate the weight, in newtons, of ${an(c.name)} of mass ${prose(m)} kg on Earth. $g = 9.8$ N/kg.`,
      `${cap(an(c.name))} has a mass of ${prose(m)} kg. ${pick(r, G_STATED)} Calculate ${their(c.name)} weight, in newtons.`,
    ])
    // Second route: the weight over g gives the mass back.
    const mBack = W / G
    return numeric(
      slot,
      {
        prompt,
        solution: closes(`W = m g = ${tex(m)} \\times 9.8`, W, 'N'),
        method: [`$${tex(m)} \\times 9.8$`],
        answer: W,
        tolerance: dpTolerance(W),
        units: 'N',
      },
      { agrees: near(mBack, m) && atMost(W, 1), detail: `${W} ÷ 9.8 = ${show(mBack)} kg` },
      { context: c.name, m },
    )
  },
}

/**
 * m = W ÷ g: written as q7 (a person weighing 735 N, 75 kg, 2 marks). The weight given is a
 * whole number of kilograms times 9.8, so the division comes out whole.
 */
export const massFromWeight: Generator = {
  id: 'mass-from-weight',
  subjectId: 'physics',
  topicId: RESULTANT,
  replaces: ['q7'],
  build(r, slot, turn) {
    const c = WEIGHED[turn % WEIGHED.length]!
    const m = draw(r, (r) => stepped(r, c.mass[0], c.mass[1], c.step), (m) => m !== 1)
    const W = clean(m * G)
    const prompt = pick(r, [
      `${cap(an(c.name))} weighs ${prose(W)} N on Earth, where $g = 9.8$ N/kg. Calculate ${their(c.name)} mass, in kg.`,
      `The weight of ${an(c.name)} on Earth is ${prose(W)} N. ${pick(r, G_STATED)} Calculate ${their(c.name)} mass, in kg.`,
    ])
    // Second route: forwards, the mass found times g.
    const forward = m * G
    return numeric(
      slot,
      {
        prompt,
        solution: `$W = m g$, so ${closes(`m = W \\div g = ${tex(W)} \\div 9.8`, m, 'kg')}`,
        method: [`$${tex(W)} \\div 9.8$`],
        answer: m,
        units: 'kg',
      },
      { agrees: near(forward, W) && near(W / G, m), detail: `${m} × 9.8 = ${show(forward)} N` },
      { context: c.name, W },
    )
  },
}

interface Push {
  text: (F: string, s: string) => string
  force: [number, number]
  fStep: number
  dist: [number, number]
  dStep: number
}
const PUSHES: Push[] = [
  { text: (F, s) => `A removal worker pushes a piano ${s} m across a floor with a steady force of ${F} N.`, force: [100, 200], fStep: 10, dist: [5, 20], dStep: 1 },
  { text: (F, s) => `A child pulls a sledge ${s} m along the snow with a steady force of ${F} N.`, force: [30, 80], fStep: 5, dist: [20, 100], dStep: 10 },
  { text: (F, s) => `A shopper pushes a trolley ${s} m along an aisle with a steady force of ${F} N.`, force: [10, 40], fStep: 5, dist: [10, 50], dStep: 5 },
  { text: (F, s) => `A tug pulls a barge ${s} m along a canal with a steady force of ${F} N.`, force: [2000, 5000], fStep: 500, dist: [100, 500], dStep: 50 },
  { text: (F, s) => `A horse pulls a cart ${s} m along a track with a steady force of ${F} N.`, force: [500, 1000], fStep: 50, dist: [50, 200], dStep: 10 },
  { text: (F, s) => `A crane lifts a load with a force of ${F} N through a height of ${s} m.`, force: [5000, 20000], fStep: 1000, dist: [5, 30], dStep: 1 },
  { text: (F, s) => `A cyclist pedals ${s} m along a flat road with a steady forward force of ${F} N.`, force: [40, 100], fStep: 10, dist: [100, 500], dStep: 50 },
  { text: (F, s) => `A student lifts a box with a force of ${F} N through a height of ${s} m.`, force: [50, 200], fStep: 10, dist: [1, 2], dStep: 0.5 },
  { text: (F, s) => `Three people push a broken-down car ${s} m along a road with a steady force of ${F} N.`, force: [300, 600], fStep: 50, dist: [5, 30], dStep: 5 },
]

/**
 * W = Fs: written as q5 (a piano pushed 15 m with 120 N, 1800 J, 2 marks). The work done is
 * a whole number of joules, and the force never equals the distance.
 */
export const workDone: Generator = {
  id: 'work-done-from-force-and-distance',
  subjectId: 'physics',
  topicId: RESULTANT,
  replaces: ['q5'],
  build(r, slot, turn) {
    const c = PUSHES[turn % PUSHES.length]!
    const { F, s, W } = draw(
      r,
      (r) => {
        const F = stepped(r, c.force[0], c.force[1], c.fStep)
        const s = stepped(r, c.dist[0], c.dist[1], c.dStep)
        return { F, s, W: clean(F * s) }
      },
      ({ F, s, W }) => Number.isInteger(W) && F !== s,
    )
    // Second route: the work over the force gives the distance back.
    const sBack = W / F
    return numeric(
      slot,
      {
        prompt: `${c.text(prose(F), show(s))} Calculate the work done, in joules.`,
        solution: closes(`W = F s = ${tex(F)} \\times ${tex(s)}`, W, 'J'),
        method: [`$${tex(F)} \\times ${tex(s)}$`],
        answer: W,
        units: 'J',
      },
      { agrees: near(sBack, s) && Number.isInteger(W), detail: `${W} ÷ ${F} = ${show(sBack)} m` },
      { context: c.text('F', 's').split(' ').slice(0, 2).join(' '), F, s },
    )
  },
}

interface Resisted {
  text: (W: string, s: string) => string
  ask: string
  force: [number, number]
  fStep: number
  dist: [number, number]
  dStep: number
}
const RESISTED: Resisted[] = [
  { text: (W, s) => `A cyclist does ${W} J of work against air resistance over ${s} m.`, ask: 'the average force of air resistance', force: [20, 80], fStep: 5, dist: [10, 200], dStep: 10 },
  { text: (W, s) => `A sledge is dragged ${s} m across snow, and ${W} J of work is done against friction.`, ask: 'the average force of friction', force: [20, 100], fStep: 10, dist: [5, 50], dStep: 5 },
  { text: (W, s) => `A car does ${W} J of work against resistive forces over ${s} m.`, ask: 'the average resistive force', force: [300, 800], fStep: 50, dist: [100, 1000], dStep: 100 },
  { text: (W, s) => `A swimmer does ${W} J of work against the drag of the water over ${s} m.`, ask: 'the average drag force', force: [20, 60], fStep: 5, dist: [25, 100], dStep: 25 },
  { text: (W, s) => `A box is pushed ${s} m across a rough floor, and ${W} J of work is done against friction.`, ask: 'the average force of friction', force: [20, 150], fStep: 10, dist: [2, 20], dStep: 1 },
  { text: (W, s) => `A runner does ${W} J of work against air resistance over ${s} m.`, ask: 'the average force of air resistance', force: [5, 30], fStep: 5, dist: [100, 400], dStep: 100 },
  { text: (W, s) => `A lorry does ${W} J of work against resistive forces over ${s} m.`, ask: 'the average resistive force', force: [2000, 6000], fStep: 500, dist: [100, 1000], dStep: 100 },
]

/**
 * F = W ÷ s: written as q10 (600 J against air resistance over 12 m, 50 N, 2 marks). The
 * force is drawn from what the resistance really is and the work follows from it.
 */
export const forceFromWorkDone: Generator = {
  id: 'force-from-work-done',
  subjectId: 'physics',
  topicId: RESULTANT,
  replaces: ['q10'],
  build(r, slot, turn) {
    const c = RESISTED[turn % RESISTED.length]!
    const { F, s, W } = draw(
      r,
      (r) => {
        const F = stepped(r, c.force[0], c.force[1], c.fStep)
        const s = stepped(r, c.dist[0], c.dist[1], c.dStep)
        return { F, s, W: F * s }
      },
      ({ F, s }) => F !== s,
    )
    // Second route: forwards, the force found times the distance.
    const forward = F * s
    return numeric(
      slot,
      {
        prompt: `${c.text(prose(W), String(s))} Calculate ${c.ask}, in newtons.`,
        solution: `$W = F s$, so ${closes(`F = W \\div s = ${tex(W)} \\div ${tex(s)}`, F, 'N')}`,
        method: [`$${tex(W)} \\div ${tex(s)}$`],
        answer: F,
        units: 'N',
      },
      { agrees: forward === W && W / s === F, detail: `${F} × ${s} = ${forward} J` },
      { context: c.text('W', 's').split(' ').slice(0, 2).join(' '), W, s },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Resolving, resultants and g elsewhere
// ---------------------------------------------------------------------------------------------

interface Angled {
  text: (F: string, angle: number) => string
  thing: string
  force: [number, number]
  step: number
}
/** Pulls through a rope or handle, so the vertical component lifts rather than pushes down. */
const ANGLED: Angled[] = [
  { text: (F, a) => `A child pulls a sledge with a force of ${F} N through a rope at ${a}° above the horizontal.`, thing: 'sledge', force: [30, 80], step: 5 },
  { text: (F, a) => `A traveller pulls a suitcase with a force of ${F} N through its handle at ${a}° above the horizontal.`, thing: 'suitcase', force: [20, 60], step: 5 },
  { text: (F, a) => `A gardener pulls a trolley with a force of ${F} N through its handle at ${a}° above the horizontal.`, thing: 'trolley', force: [40, 100], step: 5 },
  { text: (F, a) => `A person pulls a wheeled bin with a force of ${F} N through its handle at ${a}° above the horizontal.`, thing: 'bin', force: [30, 80], step: 5 },
  { text: (F, a) => `A farmer pulls a hay bale with a force of ${F} N through a rope at ${a}° above the horizontal.`, thing: 'bale', force: [60, 150], step: 10 },
  { text: (F, a) => `A dog walker is pulled by the lead with a force of ${F} N at ${a}° above the horizontal.`, thing: 'walker', force: [20, 60], step: 5 },
]
/** Angles a rope or handle really makes, whose cosines are clean at two figures. */
const ANGLES = [30, 37, 40, 45, 50, 53, 60]
const rad = (deg: number) => (deg * Math.PI) / 180

/**
 * The horizontal component of a force, to 2 significant figures: written as q13 (50 N at 37°
 * above the horizontal, 40 N, 3 marks). The written question's scale-drawing framing is kept,
 * with the note on the vertical component. The answer is drawn again when its rounding sits on
 * a half or its second figure is a 0 the answer box would not show.
 */
export const resolvingAForce: Generator = {
  id: 'resolving-a-force',
  subjectId: 'physics',
  topicId: RESULTANT,
  replaces: ['q13'],
  build(r, slot, turn) {
    const c = ANGLED[turn % ANGLED.length]!
    const { F, angle, raw, answer } = draw(
      r,
      (r) => {
        const F = stepped(r, c.force[0], c.force[1], c.step)
        const angle = pick(r, ANGLES)
        const raw = F * Math.cos(rad(angle))
        return { F, angle, raw, answer: sigFigs(raw, 2) }
      },
      // From 27 N the marking room is half a newton, the full rounding margin; between 10 and
      // 26 the 2% cap would leave a correctly unrounded value outside it.
      ({ raw, answer }) => raw >= 27 && clearAtSigFigs(raw, 2) && !sigText(answer, 2).endsWith('0') && sigFigs(Number(fixed(raw, 2)), 2) === answer,
    )
    const vertical = F * Math.sin(rad(angle))
    const tolerance = sfTolerance(answer, 2)
    const triangle = angle === 37 || angle === 53 ? ', so the components make a 3, 4, 5 triangle' : ''
    // Second route: the sine of the other angle, and Pythagoras from the vertical component.
    const viaSin = F * Math.sin(rad(90 - angle))
    const viaPythagoras = Math.sqrt(F * F - vertical * vertical)
    return numeric(
      slot,
      {
        prompt: `${c.text(String(F), angle)} A scale drawing resolves the force into components. Find the horizontal component of the force, in newtons. Give your answer to 2 significant figures.`,
        solution: `Draw the ${F} N force at ${angle}° to scale, then drop a vertical line from its head to the horizontal; the horizontal component is the base of the triangle. It measures $${F} \\cos ${angle}° = ${fixed(raw, 2)}$ N, which is **${sigText(answer, 2)} N** to 2 s.f. The vertical component is $${F} \\sin ${angle}° = ${fixed(vertical, 1)}$ N${triangle}; it pulls upwards on the ${c.thing} and does not move it along.`,
        method: [`force drawn to scale at ${angle}°, or $${F} \\cos ${angle}°$`, 'horizontal component taken as the base of the right-angled triangle'],
        answer,
        tolerance,
        units: 'N',
        line: `${sigText(answer, 2)} N`,
      },
      { agrees: near(viaSin, raw) && near(viaPythagoras, raw) && Math.abs(raw - answer) <= tolerance, detail: `${F} sin ${90 - angle}° = ${viaSin.toFixed(4)}; √(${F}² − ${vertical.toFixed(3)}²) = ${viaPythagoras.toFixed(4)}` },
      { context: c.thing, F, angle, raw: raw.toFixed(4) },
    )
  },
}

interface Driving {
  text: (D: string, R: string, s: string) => string
  store: string
  drive: [number, number]
  dStep: number
  resist: [number, number]
  rStep: number
  dist: [number, number]
  sStep: number
}
const DRIVING: Driving[] = [
  { text: (D, R, s) => `A car's engine provides a forward force of ${D} N while resistive forces total ${R} N. The car travels ${s} m.`, store: "the car's kinetic store", drive: [500, 2000], dStep: 50, resist: [200, 800], rStep: 50, dist: [20, 200], sStep: 10 },
  { text: (D, R, s) => `A van's engine provides a forward force of ${D} N while resistive forces total ${R} N. The van travels ${s} m.`, store: "the van's kinetic store", drive: [1000, 3000], dStep: 100, resist: [400, 1200], rStep: 100, dist: [20, 200], sStep: 10 },
  { text: (D, R, s) => `A cyclist pedals with a forward force of ${D} N while air resistance and friction total ${R} N. The cyclist travels ${s} m.`, store: 'the kinetic store of the cyclist and bike', drive: [50, 150], dStep: 10, resist: [20, 60], rStep: 5, dist: [50, 200], sStep: 10 },
  { text: (D, R, s) => `A tug pulls a barge with a force of ${D} N while the drag of the water on the barge is ${R} N. The barge moves ${s} m.`, store: "the barge's kinetic store", drive: [3000, 8000], dStep: 500, resist: [1000, 3000], rStep: 500, dist: [100, 500], sStep: 50 },
  { text: (D, R, s) => `A dog pulls a sledge with a force of ${D} N while friction on the sledge is ${R} N. The sledge moves ${s} m.`, store: "the sledge's kinetic store", drive: [60, 150], dStep: 10, resist: [20, 60], rStep: 10, dist: [10, 50], sStep: 5 },
  { text: (D, R, s) => `A lorry's engine provides a forward force of ${D} N while resistive forces total ${R} N. The lorry travels ${s} m.`, store: "the lorry's kinetic store", drive: [5000, 15000], dStep: 500, resist: [2000, 6000], rStep: 500, dist: [50, 300], sStep: 50 },
]

/**
 * The resultant, then the work it does: written as q15 (600 N forward, 350 N resistive, 40 m,
 * 10 000 J, 3 marks). The resultant never equals the resistance (which would read as a
 * doubling) nor the distance, and the solution names the store the energy goes to.
 */
export const workDoneByResultant: Generator = {
  id: 'work-done-by-a-resultant-force',
  subjectId: 'physics',
  topicId: RESULTANT,
  replaces: ['q15'],
  build(r, slot, turn) {
    const c = DRIVING[turn % DRIVING.length]!
    const { D, R, s, F, W } = draw(
      r,
      (r) => {
        const D = stepped(r, c.drive[0], c.drive[1], c.dStep)
        const R = stepped(r, c.resist[0], c.resist[1], c.rStep)
        const s = stepped(r, c.dist[0], c.dist[1], c.sStep)
        const F = D - R
        return { D, R, s, F, W: F * s }
      },
      ({ R, s, F }) => F > 0 && F !== R && F !== s && F >= R / 5,
    )
    // Second route: the work over the distance, plus the resistance, is the forward force.
    const dBack = W / s + R
    return numeric(
      slot,
      {
        prompt: `${c.text(prose(D), prose(R), String(s))} Calculate the work done by the resultant force, in joules.`,
        solution: `Resultant $= ${tex(D)} - ${tex(R)} = ${tex(F)}$ N. Work done ${closes(`= F s = ${tex(F)} \\times ${tex(s)}`, W, 'J')} This is the energy transferred to ${c.store}.`,
        method: [`resultant $${tex(D)} - ${tex(R)} = ${tex(F)}$ N`, `$${tex(F)} \\times ${tex(s)}$`],
        answer: W,
        units: 'J',
      },
      { agrees: dBack === D && Number.isInteger(W) && W > 0, detail: `${W} ÷ ${s} + ${R} = ${dBack} N` },
      { context: c.store, D, R, s },
    )
  },
}

interface World {
  body: string
  /** Where the weight is measured: "on the surface of Mars", "at the cloud tops of Jupiter". */
  where: string
  /** Where the field strength is asked for: "on Mars", "there". */
  at: string
  g: number
  objects: string[]
}
/** Gravitational field strengths to one decimal place, never Earth's. */
const WORLDS: World[] = [
  { body: 'the Moon', where: 'on the surface of the Moon', at: 'on the Moon', g: 1.6, objects: ['probe', 'lander', 'rover', 'astronaut in a spacesuit'] },
  { body: 'Mars', where: 'on the surface of Mars', at: 'on Mars', g: 3.7, objects: ['probe', 'lander', 'rover'] },
  { body: 'Mercury', where: 'on the surface of Mercury', at: 'on Mercury', g: 3.7, objects: ['probe', 'lander'] },
  { body: 'Venus', where: 'on the surface of Venus', at: 'on Venus', g: 8.9, objects: ['probe', 'lander'] },
  { body: 'Jupiter', where: 'at the cloud tops of Jupiter', at: 'there', g: 24.8, objects: ['probe'] },
  { body: 'Saturn', where: 'at the cloud tops of Saturn', at: 'there', g: 10.4, objects: ['probe'] },
  { body: 'Uranus', where: 'at the cloud tops of Uranus', at: 'there', g: 8.7, objects: ['probe'] },
  { body: 'Neptune', where: 'at the cloud tops of Neptune', at: 'there', g: 11.2, objects: ['probe'] },
  { body: 'Pluto', where: 'on the surface of Pluto', at: 'on Pluto', g: 0.6, objects: ['probe', 'lander'] },
]
const OBJECT_MASS: Record<string, { range: [number, number]; step: number }> = {
  probe: { range: [20, 200], step: 10 },
  lander: { range: [200, 1000], step: 50 },
  rover: { range: [100, 1000], step: 50 },
  'astronaut in a spacesuit': { range: [80, 130], step: 5 },
}

/**
 * g = W ÷ m on another body: written as q17 (a 40 kg probe weighing 148 N on Mars, 3.7 N/kg,
 * 2 marks). Whole kilograms times a field strength to one decimal place give a weight that
 * prints to at most one decimal place.
 */
export const fieldStrengthFromWeight: Generator = {
  id: 'field-strength-from-weight',
  subjectId: 'physics',
  topicId: RESULTANT,
  replaces: ['q17'],
  build(r, slot, turn) {
    const w = WORLDS[turn % WORLDS.length]!
    const object = pick(r, w.objects)
    const { range, step } = OBJECT_MASS[object]!
    const m = stepped(r, range[0], range[1], step)
    const W = clean(m * w.g)
    const prompt = pick(r, [
      `${cap(an(object))} of mass ${prose(m)} kg has a weight of ${prose(W)} N ${w.where}. Calculate the gravitational field strength ${w.at}, in N/kg.`,
      `${cap(w.where)}, ${an(object)} of mass ${prose(m)} kg weighs ${prose(W)} N. Calculate the gravitational field strength ${w.at}, in N/kg.`,
    ])
    // Second route: forwards, the mass times the field strength found.
    const forward = m * w.g
    return numeric(
      slot,
      {
        prompt,
        solution: `$W = m g$, so ${closes(`g = W \\div m = ${tex(W)} \\div ${tex(m)}`, w.g, 'N/kg').slice(0, -1)}, ${w.g < G ? 'less' : 'more'} than Earth's 9.8 N/kg.`,
        method: [`$${tex(W)} \\div ${tex(m)}$`],
        answer: w.g,
        tolerance: dpTolerance(w.g),
        units: 'N/kg',
      },
      { agrees: near(forward, W) && near(W / m, w.g) && atMost(W, 1), detail: `${m} × ${w.g} = ${show(forward)} N` },
      { context: w.body, object, m, W },
    )
  },
}

interface Vertical {
  text: (m: string, F: string) => string
  who: string
  /** The upward force as the solution names it. */
  force: string
  /** Whether the upward force exceeds the weight, so the resultant is upwards. */
  up: boolean
  then: string
  mass: [number, number]
  step: number
  other: [number, number]
  oStep: number
}
const VERTICAL: Vertical[] = [
  { text: (m, F) => `A skydiver of mass ${m} kg is falling at terminal velocity. The parachute opens and air resistance rises to ${F} N.`, who: 'the skydiver', force: 'Air resistance', up: true, then: 'the skydiver decelerates', mass: [60, 100], step: 1, other: [1000, 2000], oStep: 50 },
  { text: (m, F) => `A skydiver of mass ${m} kg has just jumped from a plane. Air resistance on the skydiver is ${F} N.`, who: 'the skydiver', force: 'Air resistance', up: false, then: 'the skydiver speeds up', mass: [60, 100], step: 1, other: [100, 500], oStep: 50 },
  { text: (m, F) => `A hot-air balloon and its basket have a total mass of ${m} kg. The hot air gives an upward force of ${F} N.`, who: 'the balloon', force: 'The hot air pushes with', up: true, then: 'the balloon accelerates upwards', mass: [400, 800], step: 50, other: [4000, 9000], oStep: 100 },
  { text: (m, F) => `A drone of mass ${m} kg takes off. Its rotors push it upwards with a force of ${F} N.`, who: 'the drone', force: 'The rotors push with', up: true, then: 'the drone accelerates upwards', mass: [2, 5], step: 1, other: [25, 70], oStep: 1 },
  { text: (m, F) => `A helicopter of mass ${m} kg is descending. Its rotors provide an upward lift of ${F} N.`, who: 'the helicopter', force: 'Lift', up: false, then: 'the helicopter speeds up as it descends', mass: [2000, 4000], step: 100, other: [15000, 40000], oStep: 1000 },
  { text: (m, F) => `A bungee jumper of mass ${m} kg reaches the lowest point of the jump. The tension in the cord is ${F} N.`, who: 'the jumper', force: 'Tension', up: true, then: 'the jumper is pulled back upwards', mass: [60, 90], step: 1, other: [1500, 2500], oStep: 100 },
  { text: (m, F) => `A crate of mass ${m} kg is lowered by a rope. The tension in the rope is ${F} N.`, who: 'the crate', force: 'Tension', up: false, then: 'the crate speeds up as it is lowered', mass: [50, 200], step: 10, other: [300, 2000], oStep: 50 },
]

/**
 * Weight, then the resultant of it and an upward force: written as q19 (an 80 kg skydiver
 * whose parachute brings 1200 N of air resistance, 416 N upwards, 3 marks). Some contexts have
 * the upward force below the weight, so the resultant is downwards; the direction is in the
 * solution and the mark scheme, as written, and the answer is the size.
 */
export const resultantWithWeight: Generator = {
  id: 'resultant-with-weight',
  subjectId: 'physics',
  topicId: RESULTANT,
  replaces: ['q19'],
  build(r, slot, turn) {
    const c = VERTICAL[turn % VERTICAL.length]!
    const { m, F, W, R } = draw(
      r,
      (r) => {
        const m = stepped(r, c.mass[0], c.mass[1], c.step)
        const F = stepped(r, c.other[0], c.other[1], c.oStep)
        const W = clean(m * G)
        return { m, F, W, R: clean(Math.abs(F - W)) }
      },
      // The two forces differ by at least a twentieth of the weight, and the resultant is
      // never the mass's own figure.
      ({ m, F, W, R }) => (c.up ? F > W : F < W) && R >= W / 20 && R !== m && atMost(W, 1),
    )
    const direction = c.up ? 'upwards' : 'downwards'
    const [big, small] = c.up ? [F, W] : [W, F]
    // Second route: the weight and the resultant together give the upward force back.
    const fBack = c.up ? W + R : W - R
    return numeric(
      slot,
      {
        prompt: `${c.text(prose(m), prose(F))} ${pick(r, G_STATED)} Calculate the resultant force on ${c.who} at that moment, in newtons.`,
        solution: `Weight $= ${tex(m)} \\times 9.8 = ${tex(W)}$ N downwards. ${c.force} ${tex(F)} N upwards. Resultant ${closes(`= ${tex(big)} - ${tex(small)}`, R, 'N')} It acts **${direction}**, so ${c.then}.`,
        method: [`weight ${prose(W)} N`, `$${tex(big)} - ${tex(small)}$`],
        answer: R,
        tolerance: dpTolerance(R),
        units: 'N',
        line: `${prose(R)} N ${direction}`,
      },
      { agrees: near(fBack, F) && near(W / G, m), detail: `${W} ${c.up ? '+' : '−'} ${R} = ${show(fBack)} N` },
      { context: `${c.who} ${direction}`, direction, m, F, W },
    )
  },
}

export const forceGenerators: Generator[] = [
  forceFromMassAndAcceleration,
  accelerationFromForce,
  massFromForceAndAcceleration,
  decelerationFromBrakingForce,
  drivingForceWithResistance,
  accelerationAgainstWeight,
  estimatingAForce,
  weightFromMass,
  massFromWeight,
  workDone,
  forceFromWorkDone,
  resolvingAForce,
  workDoneByResultant,
  fieldStrengthFromWeight,
  resultantWithWeight,
]
