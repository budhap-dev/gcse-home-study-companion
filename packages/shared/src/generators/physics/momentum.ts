import { show } from '../format.ts'
import { draw, pick, type Rng } from '../random.ts'
import type { Generator } from '../types.ts'
import { atMost, cap, closes, near, numeric, prose, sciExact, stepped, tex } from './build.ts'
import { dpTolerance } from './format.ts'

/**
 * Momentum (AQA 8463, 5.7, physics only): p = m v and its rearrangements, conservation in
 * collisions, recoil and explosions, and force as the rate of change of momentum. Every
 * numeric written question in the topic has a generator here. Where a question has
 * directions, the written sign convention and wording are kept, the answer is the size the
 * written mark scheme marks, and the direction is in the solution and the mark scheme's last
 * line where the written one puts it there.
 */
const TOPIC = 'momentum'

const clean = (x: number) => Number(show(x))
const an = (noun: string) => `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`
/** Figures that would only move the decimal point, or multiply by nothing. */
const SHIFTS = [0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000, 100000]
/** No two of the figures are equal. */
const distinct = (...xs: number[]) => new Set(xs).size === xs.length
/**
 * Whether x is a power of ten (0.0001 … 100 000): a ratio of figures that is one makes the
 * answer another figure with its point moved, a step a student could take without the physics.
 */
const powerOfTen = (x: number) => x > 0 && Math.abs(Math.log10(x) - Math.round(Math.log10(x))) < 1e-9
/** Picks one of the candidates that pass, or null when none does, so a draw can reject the rest. */
function oneOf<T>(r: Rng, candidates: T[], ok: (x: T) => boolean): T | null {
  const fits = candidates.filter(ok)
  return fits.length ? pick(r, fits) : null
}
/** lo, lo + step, … up to hi, cleaned of residue. */
const steps = (lo: number, hi: number, step: number) => Array.from({ length: Math.max(0, Math.floor((hi - lo) / step + 1e-9) + 1) }, (_, k) => clean(lo + k * step))
const kgms = 'kg m/s'

// ---------------------------------------------------------------------------------------------
// p = m v and its rearrangements
// ---------------------------------------------------------------------------------------------

interface Mover {
  name: string
  /** "a motorbike and rider" take "their" and plural verbs. */
  plural?: boolean
  /** A skateboarder or runner takes "their", with singular verbs. */
  person?: boolean
  mass: [number, number]
  mStep: number
  speed: [number, number]
  vStep: number
}
const its = (b: Mover) => (b.plural || b.person ? 'their' : 'its')
/** "a car of mass 1200 kg", never "a 1200 kg car": the article cannot be chosen from the digits. */
const sized = (b: Mover, m: number) => (b.plural ? `${an(b.name)} with a total mass of ${prose(m)} kg` : `${an(b.name)} of mass ${prose(m)} kg`)

/** Vehicles at the speeds and masses they really have, for q1. */
const VEHICLES: Mover[] = [
  { name: 'car', mass: [900, 1800], mStep: 50, speed: [5, 30], vStep: 1 },
  { name: 'van', mass: [1800, 3500], mStep: 100, speed: [5, 25], vStep: 1 },
  { name: 'lorry', mass: [10000, 40000], mStep: 1000, speed: [5, 25], vStep: 1 },
  { name: 'bus', mass: [10000, 14000], mStep: 500, speed: [5, 15], vStep: 1 },
  { name: 'motorbike and rider', plural: true, mass: [200, 350], mStep: 10, speed: [10, 30], vStep: 1 },
  { name: 'bicycle and rider', plural: true, mass: [70, 100], mStep: 1, speed: [3, 12], vStep: 0.5 },
  { name: 'train', mass: [100000, 400000], mStep: 10000, speed: [10, 40], vStep: 1 },
  { name: 'tram', mass: [30000, 50000], mStep: 1000, speed: [5, 15], vStep: 1 },
]
/** Balls and small things, for q3, with their real masses and the speeds they really reach. */
const SMALL: Mover[] = [
  { name: 'ball', mass: [0.2, 1], mStep: 0.1, speed: [2, 20], vStep: 1 },
  { name: 'cricket ball', mass: [0.16, 0.16], mStep: 0.01, speed: [20, 40], vStep: 1 },
  { name: 'football', mass: [0.42, 0.45], mStep: 0.01, speed: [8, 30], vStep: 1 },
  { name: 'tennis ball', mass: [0.06, 0.06], mStep: 0.01, speed: [15, 60], vStep: 1 },
  { name: 'basketball', mass: [0.6, 0.6], mStep: 0.1, speed: [3, 12], vStep: 0.5 },
  { name: 'bowling ball', mass: [5, 7], mStep: 0.5, speed: [3, 9], vStep: 0.5 },
  { name: 'trolley', mass: [0.5, 3], mStep: 0.5, speed: [0.2, 3], vStep: 0.1 },
  { name: 'skateboarder', person: true, mass: [40, 70], mStep: 1, speed: [2, 6], vStep: 0.5 },
]
/** Things for the rearranging slots, q5 and q6: the written ones have "an object" and "a trolley". */
const MOVERS: Mover[] = [
  { name: 'object', mass: [2, 20], mStep: 1, speed: [2, 15], vStep: 1 },
  { name: 'trolley', mass: [0.5, 3], mStep: 0.5, speed: [0.5, 4], vStep: 0.5 },
  { name: 'car', mass: [900, 1800], mStep: 50, speed: [5, 30], vStep: 1 },
  { name: 'skateboarder', person: true, mass: [40, 70], mStep: 1, speed: [2, 6], vStep: 0.5 },
  { name: 'bowling ball', mass: [5, 7], mStep: 0.5, speed: [3, 9], vStep: 0.5 },
  { name: 'runner', person: true, mass: [50, 80], mStep: 1, speed: [3, 9], vStep: 0.5 },
  { name: 'boat', mass: [200, 1000], mStep: 50, speed: [2, 8], vStep: 0.5 },
]

/**
 * A mass and a speed from a mover's ranges whose momentum has at most two decimal places, with
 * no coincidence: neither figure is 1 or a power of ten, and the momentum equals neither.
 */
function moving(r: Rng, b: Mover) {
  return draw(
    r,
    (r) => {
      const m = stepped(r, b.mass[0], b.mass[1], b.mStep)
      const v = stepped(r, b.speed[0], b.speed[1], b.vStep)
      return { m, v, p: clean(m * v) }
    },
    ({ m, v, p }) => !SHIFTS.includes(m) && !SHIFTS.includes(v) && distinct(m, v, p) && atMost(p, 2),
  )
}

/**
 * p = m v: written as q1 (a 1200 kg car at 20 m/s, 24 000 kg m/s, 2 marks) and q3 (a 0.5 kg
 * ball at 12 m/s, 6 kg m/s, 2 marks). q1 takes vehicles and q3 balls and small things.
 */
export const momentumFromMassAndVelocity: Generator = {
  id: 'momentum-from-mass-and-velocity',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q1', 'q3'],
  build(r, slot, turn) {
    const list = slot.id === 'q1' ? VEHICLES : SMALL
    const b = list[turn % list.length]!
    const { m, v, p } = moving(r, b)
    const verb = slot.id === 'q1' ? (b.plural ? 'travel' : 'travels') : b.plural ? 'move' : 'moves'
    const prompt = pick(r, [
      `${cap(sized(b, m))} ${verb} at ${show(v)} m/s. Calculate ${its(b)} momentum.`,
      `Calculate the momentum of ${sized(b, m)} moving at ${show(v)} m/s, in kg m/s.`,
    ])
    // Second route: the momentum over the speed gives the mass back.
    const mBack = p / v
    return numeric(
      slot,
      {
        prompt,
        solution: closes(`p = m v = ${tex(m)} \\times ${tex(v)}`, p, kgms),
        method: [`$${tex(m)} \\times ${tex(v)}$`],
        answer: p,
        tolerance: dpTolerance(p),
        units: kgms,
      },
      { agrees: near(mBack, m) && near(p / m, v), detail: `${p} ÷ ${v} = ${show(mBack)} kg` },
      { context: b.name, m, v },
    )
  },
}

/** v = p ÷ m: written as q5 (30 kg m/s and 6 kg, 5 m/s, 3 marks). */
export const velocityFromMomentum: Generator = {
  id: 'velocity-from-momentum',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q5'],
  build(r, slot, turn) {
    const b = MOVERS[turn % MOVERS.length]!
    const { m, v, p } = moving(r, b)
    const prompt = pick(r, [
      `${cap(an(b.name))} has momentum ${prose(p)} kg m/s and mass ${prose(m)} kg. Calculate ${its(b)} velocity.`,
      `${cap(sized(b, m))} has a momentum of ${prose(p)} kg m/s. Calculate ${its(b)} velocity, in m/s.`,
    ])
    // Second route: forwards, the mass times the velocity found.
    const forward = m * v
    return numeric(
      slot,
      {
        prompt,
        solution: `Rearrange $p = m v$ to ${closes(`v = \\dfrac{p}{m} = \\dfrac{${tex(p)}}{${tex(m)}}`, v, 'm/s')}`,
        method: ['$v = p \\div m$', `$${tex(p)} \\div ${tex(m)}$`],
        answer: v,
        tolerance: dpTolerance(v),
        units: 'm/s',
      },
      { agrees: near(forward, p) && near(p / m, v), detail: `${m} × ${v} = ${show(forward)} kg m/s` },
      { context: b.name, m, p },
    )
  },
}

/** m = p ÷ v: written as q6 (a trolley at 9 m/s with 45 kg m/s, 5 kg, 3 marks). */
export const massFromMomentum: Generator = {
  id: 'mass-from-momentum',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q6'],
  build(r, slot, turn) {
    const b = MOVERS[turn % MOVERS.length]!
    const { m, v, p } = moving(r, b)
    const prompt = pick(r, [
      `${cap(an(b.name))} moving at ${show(v)} m/s has momentum ${prose(p)} kg m/s. Calculate ${its(b)} mass.`,
      `${cap(an(b.name))} has a momentum of ${prose(p)} kg m/s when moving at ${show(v)} m/s. Calculate ${its(b)} mass, in kg.`,
    ])
    // Second route: forwards, the mass found times the velocity.
    const forward = m * v
    return numeric(
      slot,
      {
        prompt,
        solution: closes(`m = \\dfrac{p}{v} = \\dfrac{${tex(p)}}{${tex(v)}}`, m, 'kg'),
        method: ['$m = p \\div v$', `$${tex(p)} \\div ${tex(v)}$`],
        answer: m,
        tolerance: dpTolerance(m),
        units: 'kg',
      },
      { agrees: near(forward, p) && near(p / v, m), detail: `${m} × ${v} = ${show(forward)} kg m/s` },
      { context: b.name, v, p },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Collisions
// ---------------------------------------------------------------------------------------------

interface Pair {
  name: string
  m1: [number, number]
  m1Step: number
  m2: [number, number]
  m2Step: number
  u: [number, number]
  uStep: number
}
interface Stuck extends Pair {
  text: (m1: string, u: string, m2: string) => string
  ask: string
  /** The first body, as the solution names it. */
  first: string
}
/** One body runs into a still one and they move off together, for q7. */
const STUCK: Stuck[] = [
  { name: 'trolleys', text: (m1, u, m2) => `A trolley of mass ${m1} kg moving at ${u} m/s collides with a stationary trolley of mass ${m2} kg. They stick together.`, ask: 'their velocity after the collision', first: 'first trolley', m1: [0.5, 3], m1Step: 0.5, m2: [0.5, 3], m2Step: 0.5, u: [0.5, 4], uStep: 0.5 },
  { name: 'wagons', text: (m1, u, m2) => `A railway wagon of mass ${m1} kg rolling at ${u} m/s runs into a stationary wagon of mass ${m2} kg. The wagons couple together.`, ask: 'the velocity of the coupled wagons just after they join', first: 'first wagon', m1: [15000, 40000], m1Step: 1000, m2: [15000, 40000], m2Step: 1000, u: [1, 4], uStep: 0.5 },
  { name: 'skaters', text: (m1, u, m2) => `An ice skater of mass ${m1} kg gliding at ${u} m/s grabs hold of a stationary skater of mass ${m2} kg, and they move off together.`, ask: 'their velocity just after the grab', first: 'first skater', m1: [45, 90], m1Step: 1, m2: [30, 70], m2Step: 1, u: [2, 6], uStep: 0.5 },
  { name: 'cars', text: (m1, u, m2) => `A car of mass ${m1} kg travelling at ${u} m/s crashes into the back of a stationary car of mass ${m2} kg. The two cars lock together.`, ask: 'their velocity just after the collision', first: 'first car', m1: [900, 1800], m1Step: 50, m2: [900, 1800], m2Step: 50, u: [5, 20], uStep: 1 },
  { name: 'pellet', text: (m1, u, m2) => `A pellet of mass ${m1} kg moving at ${u} m/s embeds itself in a stationary block of wood of mass ${m2} kg on a smooth surface.`, ask: 'the velocity of the block and pellet just after the impact', first: 'pellet', m1: [0.01, 0.05], m1Step: 0.005, m2: [0.5, 2], m2Step: 0.1, u: [100, 300], uStep: 10 },
  { name: 'rugby', text: (m1, u, m2) => `A rugby player of mass ${m1} kg running at ${u} m/s tackles a stationary player of mass ${m2} kg, and they move off together.`, ask: 'their velocity just after the tackle', first: 'tackler', m1: [70, 110], m1Step: 1, m2: [70, 110], m2Step: 1, u: [3, 8], uStep: 0.5 },
]

/**
 * Momentum before, then the combined mass: written as q7 (2 kg at 4 m/s into a still 2 kg,
 * 2 m/s, 3 marks). Never equal masses, where the speed would only halve, and the velocity
 * after has at most two decimal places.
 */
export const stickingToAStillBody: Generator = {
  id: 'sticking-to-a-still-body',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q7'],
  build(r, slot, turn) {
    const c = STUCK[turn % STUCK.length]!
    const { m1, m2, u, p, M, v } = draw(
      r,
      (r) => {
        const m1 = stepped(r, c.m1[0], c.m1[1], c.m1Step)
        const m2 = stepped(r, c.m2[0], c.m2[1], c.m2Step)
        const u = stepped(r, c.u[0], c.u[1], c.uStep)
        const p = clean(m1 * u)
        const M = clean(m1 + m2)
        return { m1, m2, u, p, M, v: clean(p / M) }
      },
      ({ m1, m2, u, p, M, v }) => distinct(m1, m2, u, v, p, M) && !SHIFTS.includes(u) && atMost(v, 2) && v >= 0.1,
    )
    const prompt = `${c.text(prose(m1), show(u), prose(m2))} ${pick(r, [`Calculate ${c.ask}.`, `Calculate ${c.ask}, in m/s.`])}`
    // Second route: the momentum after, worked from the velocity found, matches the momentum before.
    const after = M * v
    return numeric(
      slot,
      {
        prompt,
        solution: `Momentum before $= ${tex(m1)} \\times ${show(u)} + ${tex(m2)} \\times 0 = ${tex(p)}$ kg m/s. After, the combined mass is ${prose(M)} kg and momentum is conserved: $${tex(M)} v = ${tex(p)}$, so ${closes(`v = ${tex(p)} \\div ${tex(M)}`, v, 'm/s').slice(0, -1)}, in the direction the ${c.first} was moving.`,
        method: [`momentum before $= ${tex(m1)} \\times ${show(u)} = ${tex(p)}$ kg m/s`, `$${tex(p)} = ${tex(M)} \\times v$`],
        answer: v,
        tolerance: dpTolerance(v),
        units: 'm/s',
      },
      { agrees: near(after, m1 * u), detail: `${M} × ${v} = ${show(after)} kg m/s; ${m1} × ${u} = ${show(m1 * u)}` },
      { context: c.name, m1, m2, u },
    )
  },
}

interface HeadOn extends Pair {
  /** The text, with the first body moving right and the second left. */
  text: (m1: string, u1: string, m2: string, u2: string) => string
  /** The second body, as the solution names it: "the cart moving left". */
  second: string
  u2: [number, number]
}
/** Two bodies meet head-on and move off together, for q11. */
const HEAD_ON: HeadOn[] = [
  { name: 'carts', text: (m1, u1, m2, u2) => `A cart of mass ${m1} kg moving at ${u1} m/s to the right collides head-on with a cart of mass ${m2} kg moving at ${u2} m/s to the left. They stick together.`, second: 'cart moving left', m1: [0.5, 4], m1Step: 0.5, m2: [0.5, 4], m2Step: 0.5, u: [1, 5], uStep: 0.5, u2: [1, 5] },
  { name: 'wagons', text: (m1, u1, m2, u2) => `A railway wagon of mass ${m1} kg rolling at ${u1} m/s to the right meets a wagon of mass ${m2} kg rolling at ${u2} m/s to the left, and they couple together.`, second: 'wagon rolling left', m1: [15000, 40000], m1Step: 1000, m2: [15000, 40000], m2Step: 1000, u: [0.5, 3], uStep: 0.5, u2: [0.5, 3] },
  { name: 'rugby', text: (m1, u1, m2, u2) => `A rugby player of mass ${m1} kg running at ${u1} m/s to the right tackles a player of mass ${m2} kg running at ${u2} m/s to the left. They hold on to each other and move together.`, second: 'player running left', m1: [70, 110], m1Step: 1, m2: [70, 110], m2Step: 1, u: [2, 8], uStep: 0.5, u2: [2, 8] },
  { name: 'clay', text: (m1, u1, m2, u2) => `A lump of modelling clay of mass ${m1} kg moving at ${u1} m/s to the right hits a lump of mass ${m2} kg moving at ${u2} m/s to the left. They stick together.`, second: 'lump moving left', m1: [0.1, 0.5], m1Step: 0.05, m2: [0.1, 0.5], m2Step: 0.05, u: [1, 5], uStep: 0.5, u2: [1, 5] },
  { name: 'cars', text: (m1, u1, m2, u2) => `A car of mass ${m1} kg travelling at ${u1} m/s to the right collides head-on with a car of mass ${m2} kg travelling at ${u2} m/s to the left. The cars lock together.`, second: 'car travelling left', m1: [900, 1800], m1Step: 50, m2: [900, 1800], m2Step: 50, u: [5, 20], uStep: 1, u2: [5, 20] },
]

/**
 * Opposite directions with right as positive: written as q11 (3 kg at 4 m/s right into 1 kg
 * at 2 m/s left, 2.5 m/s to the right, 4 marks). The body moving right always carries more
 * momentum, so the velocity after is to the right and positive, as the written one is; the
 * answer marked is that velocity and the last line names the direction, as written.
 */
export const headOnSticking: Generator = {
  id: 'head-on-sticking',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q11'],
  build(r, slot, turn) {
    const c = HEAD_ON[turn % HEAD_ON.length]!
    // The masses and the left-mover's speed first, then the right-mover's speed from those in
    // range that give a clean velocity after: drawing all four and hoping met a clean answer
    // too rarely for the rugby players, whose combined mass divides little.
    const ok = ({ m1, u1, m2, u2, p1, p2, p, M, v }: Record<'m1' | 'u1' | 'm2' | 'u2' | 'p1' | 'p2' | 'p' | 'M' | 'v', number>) =>
      p > 0 && p2 >= p1 / 6 && distinct(m1, m2, M) && distinct(u1, u2, v) && v !== m1 && v !== m2 && p !== p2 && atMost(v, 2) && v >= 0.1 && !SHIFTS.includes(m1) && !SHIFTS.includes(m2) && !SHIFTS.includes(u1) && !SHIFTS.includes(u2)
    const { m1, u1, m2, u2, p1, p2, p, M, v } = draw(
      r,
      (r) => {
        const m1 = stepped(r, c.m1[0], c.m1[1], c.m1Step)
        const m2 = stepped(r, c.m2[0], c.m2[1], c.m2Step)
        const u2 = stepped(r, c.u2[0], c.u2[1], c.uStep)
        const p2 = clean(m2 * u2)
        const M = clean(m1 + m2)
        const fits = []
        for (let k = Math.round(c.u[0] / c.uStep); k <= Math.round(c.u[1] / c.uStep); k++) {
          const u1 = clean(k * c.uStep)
          const p1 = clean(m1 * u1)
          const p = clean(p1 - p2)
          const x = { m1, u1, m2, u2, p1, p2, p, M, v: clean(p / M) }
          if (ok(x)) fits.push(x)
        }
        return fits.length ? pick(r, fits) : null
      },
      (x) => x !== null,
    )!
    const prompt = `${c.text(prose(m1), show(u1), prose(m2), show(u2))} ${pick(r, ['Calculate their velocity after the collision, taking right as positive.', 'Taking right as positive, calculate their velocity after the collision.'])}`
    // Second route: the momentum each loses and gains. The right-mover's momentum falls by
    // m1 (u1 − v); the left-mover's rises by m2 (v + u2); the two must be equal.
    const lost = m1 * (u1 - v)
    const gained = m2 * (v + u2)
    return numeric(
      slot,
      {
        prompt,
        solution: `Take right as positive, so the ${c.second} has velocity $-${show(u2)}$ m/s. Momentum before $= ${tex(m1)} \\times ${show(u1)} + ${tex(m2)} \\times (-${show(u2)}) = ${tex(p1)} - ${tex(p2)} = ${tex(p)}$ kg m/s. Combined mass ${prose(M)} kg: $${tex(M)} v = ${tex(p)}$, ${closes(`v = ${tex(p)} \\div ${tex(M)}`, v, 'm/s').slice(0, -1)}, to the right.`,
        method: [`left-moving ${c.second.split(' ')[0]} given a negative velocity`, `total before $= ${tex(p1)} - ${tex(p2)} = ${tex(p)}$ kg m/s`, `$${tex(p)} = ${tex(M)} v$`],
        answer: v,
        tolerance: dpTolerance(v),
        units: 'm/s',
        line: `${show(v)} m/s to the right`,
      },
      { agrees: near(lost, gained) && v > 0, detail: `${m1} × (${u1} − ${v}) = ${show(lost)}; ${m2} × (${v} + ${u2}) = ${show(gained)} kg m/s` },
      { context: c.name, m1, u1, m2, u2 },
    )
  },
}

interface Knock extends Pair {
  text: (m1: string, u1: string, m2: string, v1: string) => string
  /** The striker's speed after goes in steps of this many m/s. */
  vStep: number
  /**
   * A crash between vehicles loses much of its kinetic energy and never sends the struck one
   * off faster than the striker arrived: the share of the kinetic energy it may keep. The
   * written question keeps 47%. Bouncy collisions (trolleys, wagons, bowling) have no limit.
   */
  keep?: number
  /** The body that was still, as the question asks for it. */
  struck: string
}
/** One body hits a still one and both move on, for q12, with masses and speeds each really has. */
const KNOCKS: Knock[] = [
  { name: 'car and van', text: (m1, u1, m2, v1) => `A car of mass ${m1} kg moving at ${u1} m/s hits a stationary van of mass ${m2} kg. After the collision the car continues in the same direction at ${v1} m/s.`, struck: 'the van', m1: [800, 1500], m1Step: 50, m2: [1500, 3000], m2Step: 100, u: [8, 20], uStep: 1, vStep: 0.5, keep: 0.7 },
  { name: 'trolleys', text: (m1, u1, m2, v1) => `A trolley of mass ${m1} kg moving at ${u1} m/s hits a stationary trolley of mass ${m2} kg. After the collision the first trolley continues in the same direction at ${v1} m/s.`, struck: 'the second trolley', m1: [0.5, 3], m1Step: 0.5, m2: [0.5, 3], m2Step: 0.5, u: [1, 4], uStep: 0.5, vStep: 0.1 },
  { name: 'bowling', text: (m1, u1, m2, v1) => `A bowling ball of mass ${m1} kg rolling at ${u1} m/s hits a stationary pin of mass ${m2} kg. After the collision the ball continues in the same direction at ${v1} m/s.`, struck: 'the pin', m1: [5, 7], m1Step: 0.5, m2: [1.5, 1.6], m2Step: 0.1, u: [5, 9], uStep: 0.5, vStep: 0.1 },
  // A van, not a lorry: a striker more than about twice the mass of the car keeps over 70% of
  // the kinetic energy even when the two lock together, so no lorry crash could lose enough.
  { name: 'van and car', text: (m1, u1, m2, v1) => `A van of mass ${m1} kg moving at ${u1} m/s hits a stationary car of mass ${m2} kg. After the collision the van continues in the same direction at ${v1} m/s.`, struck: 'the car', m1: [1800, 2600], m1Step: 100, m2: [1100, 1500], m2Step: 50, u: [8, 20], uStep: 1, vStep: 0.5, keep: 0.7 },
  { name: 'wagons', text: (m1, u1, m2, v1) => `A railway wagon of mass ${m1} kg rolling at ${u1} m/s hits a stationary wagon of mass ${m2} kg. After the collision the first wagon rolls on in the same direction at ${v1} m/s.`, struck: 'the second wagon', m1: [15000, 40000], m1Step: 1000, m2: [15000, 40000], m2Step: 1000, u: [1, 4], uStep: 0.5, vStep: 0.1 },
]

/**
 * Conservation with both bodies moving afterwards: written as q12 (an 800 kg car at 15 m/s
 * into a still 1200 kg van, the car on at 3 m/s, 8 m/s, 4 marks). Only collisions that can
 * happen are drawn: the struck body moves off at least as fast as the striker, and no kinetic
 * energy is gained. A vehicle crash also keeps at most 70% of the kinetic energy and never
 * sends the struck vehicle off faster than the striker arrived.
 */
export const bothMovingAfter: Generator = {
  id: 'both-moving-after-a-collision',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q12'],
  build(r, slot, turn) {
    const c = KNOCKS[turn % KNOCKS.length]!
    const { m1, u1, m2, v1, p, kept, v2 } = draw(
      r,
      (r) => {
        const m1 = stepped(r, c.m1[0], c.m1[1], c.m1Step)
        const m2 = stepped(r, c.m2[0], c.m2[1], c.m2Step)
        const u1 = stepped(r, c.u[0], c.u[1], c.uStep)
        // The window a real collision allows, with ratio = m1 ÷ m2: below ratio × u1 ÷ (1 + ratio)
        // the struck body leaves faster than the striker, and from u1 (ratio − 1) ÷ (ratio + 1)
        // up no kinetic energy is gained. The striker's speed after is drawn evenly from it.
        const ratio = m1 / m2
        const lo = Math.max(c.vStep, (u1 * (ratio - 1)) / (ratio + 1))
        const hi = (ratio * u1) / (1 + ratio)
        const candidates = steps(Math.ceil(lo / c.vStep - 1e-9) * c.vStep, u1 - c.vStep, c.vStep).map((v1) => {
          const p = clean(m1 * u1)
          const kept = clean(m1 * v1)
          return { m1, u1, m2, v1, p, kept, v2: clean((p - kept) / m2) }
        })
        // u1 − v1 is never 1 or a power of ten, where the momentum lost is the striker's mass
        // with its point moved.
        return oneOf(r, candidates, ({ v1, v2 }) =>
          v1 < hi && v2 > v1 && m1 * u1 * u1 >= m1 * v1 * v1 + m2 * v2 * v2 && (!c.keep || (v2 < u1 && m1 * v1 * v1 + m2 * v2 * v2 <= c.keep * m1 * u1 * u1)) && distinct(m1, m2) && distinct(u1, v1, v2) && v2 !== m2 && v2 !== m1 && atMost(v2, 2) && !SHIFTS.includes(m2) && !SHIFTS.includes(u1) && !SHIFTS.includes(v1) && !powerOfTen(clean(u1 - v1)))
      },
      (x) => x !== null,
    )!
    const rest = clean(p - kept)
    const prompt = `${c.text(prose(m1), show(u1), prose(m2), show(v1))} ${pick(r, [`Calculate the velocity of ${c.struck} after the collision.`, `Calculate the velocity of ${c.struck} after the collision, in m/s.`])}`
    // Second route: the momentum the striker loses is the momentum the struck body gains.
    const lost = m1 * (u1 - v1)
    return numeric(
      slot,
      {
        prompt,
        solution: `Momentum before $= ${tex(m1)} \\times ${show(u1)} = ${tex(p)}$ kg m/s. After: $${tex(m1)} \\times ${show(v1)} + ${tex(m2)} v = ${tex(kept)} + ${tex(m2)} v$. Conservation: $${tex(kept)} + ${tex(m2)} v = ${tex(p)}$, so $${tex(m2)} v = ${tex(rest)}$ and ${closes(`v = ${tex(rest)} \\div ${tex(m2)}`, v2, 'm/s').slice(0, -1)}, in the same direction.`,
        method: [`before $= ${tex(m1)} \\times ${show(u1)} = ${tex(p)}$ kg m/s`, `after $= ${tex(m1)} \\times ${show(v1)} + ${tex(m2)} v$`, `$${tex(m2)} v = ${tex(rest)}$`],
        answer: v2,
        tolerance: dpTolerance(v2),
        units: 'm/s',
      },
      { agrees: near(lost, m2 * v2), detail: `${m1} × (${u1} − ${v1}) = ${show(lost)}; ${m2} × ${v2} = ${show(m2 * v2)} kg m/s` },
      { context: c.name, m1, u1, m2, v1 },
    )
  },
}

interface Rebound {
  name: string
  text: (m: string, u: string, v: string) => string
  /** What it hits: "the wall", "the floor". */
  surface: string
  mass: [number, number]
  mStep: number
  speed: [number, number]
  uStep: number
  /** The rebound speed as a share of the speed in, as the thing really bounces. */
  bounce: [number, number]
  vStep: number
}
const REBOUNDS: Rebound[] = [
  { name: 'tennis ball', text: (m, u, v) => `A tennis ball of mass ${m} kg hits a wall at ${u} m/s and rebounds at ${v} m/s.`, surface: 'the wall', mass: [0.06, 0.06], mStep: 0.01, speed: [10, 30], uStep: 1, bounce: [0.5, 0.85], vStep: 1 },
  { name: 'football', text: (m, u, v) => `A football of mass ${m} kg hits a wall at ${u} m/s and bounces straight back at ${v} m/s.`, surface: 'the wall', mass: [0.42, 0.45], mStep: 0.01, speed: [8, 25], uStep: 1, bounce: [0.5, 0.85], vStep: 1 },
  { name: 'squash ball', text: (m, u, v) => `A squash ball of mass ${m} kg hits the front wall of the court at ${u} m/s and rebounds at ${v} m/s.`, surface: 'the wall', mass: [0.024, 0.024], mStep: 0.001, speed: [20, 50], uStep: 1, bounce: [0.3, 0.6], vStep: 1 },
  { name: 'rubber ball', text: (m, u, v) => `A rubber ball of mass ${m} kg hits the floor at ${u} m/s and bounces straight back up at ${v} m/s.`, surface: 'the floor', mass: [0.05, 0.2], mStep: 0.01, speed: [3, 10], uStep: 0.5, bounce: [0.6, 0.9], vStep: 0.5 },
  { name: 'crash test', text: (m, u, v) => `In a crash test, a car of mass ${m} kg hits a solid wall at ${u} m/s and rebounds at ${v} m/s.`, surface: 'the wall', mass: [900, 1500], mStep: 50, speed: [10, 15], uStep: 1, bounce: [0.05, 0.25], vStep: 0.5 },
]

/**
 * The change in momentum when the velocity reverses: written as q13 (a 0.06 kg tennis ball,
 * 20 m/s in and 15 m/s out, 2.1 kg m/s, 3 marks). The rebound is slower than the speed in, by
 * the share each thing really keeps, and the answer is the magnitude, as written.
 */
export const changeOnRebound: Generator = {
  id: 'change-in-momentum-on-rebound',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q13'],
  build(r, slot, turn) {
    const c = REBOUNDS[turn % REBOUNDS.length]!
    const { m, u, v, before, after, dp } = draw(
      r,
      (r) => {
        const m = stepped(r, c.mass[0], c.mass[1], c.mStep)
        const u = stepped(r, c.speed[0], c.speed[1], c.uStep)
        const lo = Math.ceil((u * c.bounce[0]) / c.vStep)
        const hi = Math.floor((u * c.bounce[1]) / c.vStep)
        const v = lo <= hi ? stepped(r, lo * c.vStep, hi * c.vStep, c.vStep) : 0
        const before = clean(m * u)
        const after = clean(m * v)
        return { m, u, v, before, after, dp: clean(m * (u + v)) }
      },
      ({ m, u, v, dp }) => v > 0 && distinct(m, u, v, dp) && u !== 2 * v && dp !== clean(m * (u - v)) && atMost(dp, 3),
    )
    const what = c.name === 'crash test' ? 'the car' : `the ${c.name.split(' ').at(-1)}`
    const prompt = `${c.text(prose(m), show(u), show(v))} ${pick(r, [`Calculate the magnitude of the change in momentum of ${what}.`, `What is the magnitude of the change in momentum of ${what}, in kg m/s?`])}`
    const total = clean(-after - before)
    const big = Math.abs(dp) >= 10000
    // Second route: the speed in plus the speed out, times the mass.
    const viaSum = m * (u + v)
    return numeric(
      slot,
      {
        prompt,
        solution: `Velocity reverses, so the change is not $${show(u)} - ${show(v)}$. Take towards ${c.surface} as positive: before $= ${tex(m)} \\times ${show(u)} = ${tex(before)}$ kg m/s; after $= ${tex(m)} \\times (-${show(v)}) = ${tex(-after)}$ kg m/s. Change $= ${tex(-after)} - ${tex(before)} = ${tex(total)}$, so the magnitude is ${big ? `**${dp} kg m/s** ($${sciExact(dp)}$ kg m/s)` : `$${show(dp)}$ kg m/s`}.`,
        method: ['rebound velocity given the opposite sign', `$${tex(m)} \\times (${show(u)} + ${show(v)})$ or $${tex(-after)} - ${tex(before)}$`],
        answer: dp,
        tolerance: dpTolerance(dp),
        units: kgms,
      },
      { agrees: near(viaSum, dp) && near(Math.abs(total), dp), detail: `${m} × (${u} + ${v}) = ${show(viaSum)} kg m/s` },
      { context: c.name, m, u, v },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Force as the rate of change of momentum
// ---------------------------------------------------------------------------------------------

interface Struck {
  name: string
  /** The text with the mass, the speed (or change in velocity) and the time. */
  text: (m: string, dv: string, t: string) => string
  ask: string
  masses: number[]
  dv: [number, number]
  dvStep: number
  time: [number, number]
  tStep: number
}
/** A velocity that changes by an amount in a time, for q8. */
const CHANGED: Struck[] = [
  { name: 'cricket ball', text: (m, dv, t) => `A cricket ball of mass ${m} kg is struck so that its velocity changes by ${dv} m/s in ${t} s.`, ask: 'the average force on the ball', masses: [0.16], dv: [20, 60], dvStep: 1, time: [0.0015, 0.004], tStep: 0.0005 },
  { name: 'tennis ball', text: (m, dv, t) => `A tennis ball of mass ${m} kg is hit by a racket, which changes its velocity by ${dv} m/s in ${t} s.`, ask: 'the average force on the ball', masses: [0.06], dv: [30, 70], dvStep: 1, time: [0.003, 0.006], tStep: 0.0005 },
  { name: 'football', text: (m, dv, t) => `A football of mass ${m} kg is kicked so that its velocity changes by ${dv} m/s in ${t} s.`, ask: 'the average force on the ball', masses: [0.42, 0.43, 0.44, 0.45], dv: [15, 40], dvStep: 1, time: [0.008, 0.015], tStep: 0.001 },
  { name: 'goalkeeper', text: (m, dv, t) => `A goalkeeper catches a football of mass ${m} kg and brings it to rest. Its velocity changes by ${dv} m/s in ${t} s.`, ask: 'the average force on the ball', masses: [0.42, 0.43, 0.44, 0.45], dv: [10, 30], dvStep: 1, time: [0.05, 0.2], tStep: 0.01 },
  { name: 'hammer', text: (m, dv, t) => `A hammer head of mass ${m} kg hits a nail, and its velocity changes by ${dv} m/s in ${t} s.`, ask: 'the average force on the hammer head', masses: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8], dv: [5, 10], dvStep: 0.5, time: [0.002, 0.01], tStep: 0.001 },
  { name: 'crash', text: (m, dv, t) => `A car of mass ${m} kg crashes into a barrier. Its velocity changes by ${dv} m/s in ${t} s as the crumple zone folds.`, ask: 'the average force on the car', masses: [900, 1000, 1100, 1200, 1300, 1400, 1500, 1600], dv: [8, 20], dvStep: 1, time: [0.05, 0.2], tStep: 0.01 },
]
/** Struck from rest, for q14. */
const FROM_REST: Struck[] = [
  { name: 'golf ball', text: (m, v, t) => `A golf ball of mass ${m} kg is struck from rest and leaves the club at ${v} m/s. The club is in contact with the ball for ${t} s.`, ask: 'the average force exerted by the club', masses: [0.045], dv: [40, 75], dvStep: 1, time: [0.0004, 0.0006], tStep: 0.00005 },
  { name: 'football', text: (m, v, t) => `A football of mass ${m} kg is kicked from rest and leaves the boot at ${v} m/s. The boot is in contact with the ball for ${t} s.`, ask: 'the average force exerted by the boot', masses: [0.42, 0.43, 0.44, 0.45], dv: [15, 30], dvStep: 1, time: [0.008, 0.015], tStep: 0.001 },
  { name: 'tennis serve', text: (m, v, t) => `A tennis ball of mass ${m} kg is served from rest at the top of the toss and leaves the racket at ${v} m/s. The racket is in contact with the ball for ${t} s.`, ask: 'the average force exerted by the racket', masses: [0.06], dv: [40, 60], dvStep: 1, time: [0.004, 0.006], tStep: 0.0005 },
  { name: 'hockey ball', text: (m, v, t) => `A hockey ball of mass ${m} kg is hit from rest and leaves the stick at ${v} m/s. The stick is in contact with the ball for ${t} s.`, ask: 'the average force exerted by the stick', masses: [0.16], dv: [10, 30], dvStep: 1, time: [0.005, 0.02], tStep: 0.001 },
  { name: 'cue ball', text: (m, v, t) => `A snooker cue ball of mass ${m} kg is struck from rest by the cue and leaves it at ${v} m/s. The cue is in contact with the ball for ${t} s.`, ask: 'the average force exerted by the cue', masses: [0.17], dv: [2, 8], dvStep: 0.5, time: [0.001, 0.003], tStep: 0.0005 },
]

/**
 * F = Δp ÷ Δt: written as q8 (a 0.16 kg cricket ball, Δv 25 m/s in 0.02 s, 200 N, 3 marks)
 * and q14 (a 0.045 kg golf ball from rest to 50 m/s in 0.0005 s, 4500 N, 4 marks). The force
 * is a whole number of newtons; the contact time is never a power of ten, where dividing by
 * it would only move the point.
 */
export const forceFromChangeInMomentum: Generator = {
  id: 'force-from-change-in-momentum',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q8', 'q14'],
  build(r, slot, turn) {
    const fromRest = slot.id === 'q14'
    const list = fromRest ? FROM_REST : CHANGED
    const c = list[turn % list.length]!
    const { m, dv, t, dp, F } = draw(
      r,
      (r) => {
        // The mass and the time first, then the change in velocity from those that give a
        // whole force: drawing all three let the time that divides most often take half the draws.
        const m = pick(r, c.masses)
        const t = stepped(r, c.time[0], c.time[1], c.tStep)
        const candidates = steps(c.dv[0], c.dv[1], c.dvStep).map((dv) => {
          const dp = clean(m * dv)
          return { m, dv, t, dp, F: clean(dp / t) }
        })
        // m ÷ t or Δv ÷ t a power of ten would make the force a given figure with its point moved.
        return oneOf(r, candidates, ({ dv, dp, F }) => !SHIFTS.includes(t) && !SHIFTS.includes(dv) && !powerOfTen(clean(m / t)) && !powerOfTen(clean(dv / t)) && atMost(dp, 3) && Number.isInteger(F) && distinct(m, dv, dp, F))
      },
      (x) => x !== null,
    )!
    const prompt = `${c.text(prose(m), show(dv), show(t))} ${pick(r, [`Calculate ${c.ask}.`, `Calculate ${c.ask}, in newtons.`])}`
    const product = `${tex(m)} \\times ${show(dv)} = ${tex(dp)}`
    const dpLine = `$\\Delta p = ${product}$ kg m/s`
    // Second route: F = m a, with a = Δv ÷ Δt.
    const viaMa = m * (dv / t)
    return numeric(
      slot,
      {
        prompt,
        solution: `${fromRest ? dpLine : `Change in momentum $= ${product}$ kg m/s`}. ${closes(`F = \\dfrac{\\Delta p}{\\Delta t} = \\dfrac{${tex(dp)}}{${show(t)}}`, F, 'N')}${fromRest && F >= 1000 ? ' A force that large is fine for a tiny fraction of a second.' : ''}`,
        method: fromRest ? [dpLine, '$F = \\Delta p \\div \\Delta t$', `$${tex(dp)} \\div ${show(t)}$`] : [dpLine, `$${tex(dp)} \\div ${show(t)}$`],
        answer: F,
        units: 'N',
      },
      { agrees: near(viaMa, F), detail: `${m} × (${dv} ÷ ${t}) = ${show(viaMa)} N` },
      { context: c.name, m, dv, t },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Recoil and explosions: total momentum zero before
// ---------------------------------------------------------------------------------------------

interface Recoil {
  name: string
  /** The prompt, with the big mass M, the small mass m and its speed v. */
  text: (M: string, m: string, v: string) => string
  ask: string
  /** The small thing and the big one, as the working names them. */
  small: string
  big: string
  /** How the moment before is named: "firing", "the throw". */
  before: string
  M: [number, number]
  MStep: number
  m: [number, number]
  mStep: number
  v: [number, number]
  vStep: number
}
/** A gun and bullet and the like, for q10. */
const FIRED: Recoil[] = [
  { name: 'gun', text: (M, m, v) => `A gun of mass ${M} kg fires a bullet of mass ${m} kg at ${v} m/s.`, ask: 'the recoil speed of the gun', small: 'bullet', big: 'gun', before: 'firing', M: [1.5, 4], MStep: 0.5, m: [0.01, 0.05], mStep: 0.005, v: [300, 500], vStep: 10 },
  { name: 'rifle', text: (M, m, v) => `A rifle of mass ${M} kg fires a bullet of mass ${m} kg at ${v} m/s.`, ask: 'the recoil speed of the rifle', small: 'bullet', big: 'rifle', before: 'firing', M: [3, 5], MStep: 0.5, m: [0.004, 0.012], mStep: 0.001, v: [700, 1000], vStep: 10 },
  { name: 'cannon', text: (M, m, v) => `A cannon of mass ${M} kg fires a cannonball of mass ${m} kg at ${v} m/s.`, ask: 'the recoil speed of the cannon', small: 'cannonball', big: 'cannon', before: 'firing', M: [1000, 3000], MStep: 100, m: [5, 15], mStep: 1, v: [150, 400], vStep: 10 },
  { name: 'skateboarder', text: (M, m, v) => `A skateboarder standing still on a skateboard throws a medicine ball of mass ${m} kg forwards at ${v} m/s. The skateboarder and skateboard have a total mass of ${M} kg.`, ask: 'the recoil speed of the skateboarder', small: 'medicine ball', big: 'skateboarder and skateboard', before: 'the throw', M: [40, 80], MStep: 1, m: [2, 5], mStep: 0.5, v: [2, 6], vStep: 0.5 },
  { name: 'boat', text: (M, m, v) => `A person standing in a stationary rowing boat throws a bag of mass ${m} kg onto the bank at ${v} m/s. The person and boat have a total mass of ${M} kg.`, ask: 'the recoil speed of the person and boat', small: 'bag', big: 'person and boat', before: 'the throw', M: [100, 250], MStep: 5, m: [2, 10], mStep: 1, v: [2, 6], vStep: 0.5 },
]
/** Two things at rest pushed apart, for q15. The other one moves off at a speed in the same range as the first, so a light trolley never flies off at 24 m/s. */
const APART: Recoil[] = [
  { name: 'trolleys', text: (_M, m, v) => `Two trolleys are held together with a compressed spring between them. When released, the trolley of mass ${m} kg moves off at ${v} m/s.`, ask: `the speed of the other trolley, of mass {M} kg`, small: 'first trolley', big: 'other trolley', before: 'release', M: [0.5, 3], MStep: 0.5, m: [0.5, 3], mStep: 0.5, v: [0.5, 6], vStep: 0.5 },
  { name: 'skaters', text: (_M, m, v) => `Two ice skaters stand still, facing each other, and push apart. The skater of mass ${m} kg moves off at ${v} m/s.`, ask: 'the speed of the other skater, of mass {M} kg', small: 'first skater', big: 'other skater', before: 'they push apart', M: [30, 90], MStep: 1, m: [30, 90], mStep: 1, v: [0.5, 3], vStep: 0.1 },
  { name: 'astronauts', text: (_M, m, v) => `Two astronauts float at rest beside each other in a space station and push apart. The astronaut of mass ${m} kg drifts off at ${v} m/s.`, ask: 'the speed of the other astronaut, of mass {M} kg', small: 'first astronaut', big: 'other astronaut', before: 'they push apart', M: [60, 110], MStep: 1, m: [60, 110], mStep: 1, v: [0.2, 1.5], vStep: 0.1 },
  { name: 'canoes', text: (_M, m, v) => `Two canoes float at rest side by side, and their paddlers push them apart. The canoe and paddler with a total mass of ${m} kg move off at ${v} m/s.`, ask: 'the speed of the other canoe and paddler, with a total mass of {M} kg', small: 'first canoe and paddler', big: 'other canoe and paddler', before: 'they push apart', M: [80, 130], MStep: 1, m: [80, 130], mStep: 1, v: [0.5, 2], vStep: 0.1 },
  { name: 'explosion', text: (_M, m, v) => `An object at rest explodes into two pieces. One piece, of mass ${m} kg, flies off at ${v} m/s.`, ask: 'the speed of the other piece, of mass {M} kg', small: 'first piece', big: 'other piece', before: 'the explosion', M: [0.5, 5], MStep: 0.5, m: [0.5, 5], mStep: 0.5, v: [2, 20], vStep: 1 },
]
/** Recoil in space, for q16: the written one says to take the mass after firing as before. */
const IN_SPACE: Recoil[] = [
  { name: 'satellite', text: (M, m, v) => `A satellite of mass ${M} kg is at rest. It fires ${m} kg of gas from a thruster at ${v} m/s.`, ask: "the speed of the satellite after firing. Take the satellite's mass after firing to be {M} kg", small: 'gas', big: 'satellite', before: 'firing', M: [500, 5000], MStep: 100, m: [1, 20], mStep: 1, v: [500, 3000], vStep: 100 },
  { name: 'probe', text: (M, m, v) => `A space probe of mass ${M} kg is at rest in deep space. Its thruster fires ${m} kg of gas at ${v} m/s.`, ask: "the speed of the probe after firing. Take the probe's mass after firing to be {M} kg", small: 'gas', big: 'probe', before: 'firing', M: [200, 1500], MStep: 50, m: [0.5, 5], mStep: 0.5, v: [1000, 3000], vStep: 100 },
  { name: 'jet pack', text: (M, m, v) => `An astronaut at rest outside a space station fires a gas jet pack, which sends out ${m} kg of gas at ${v} m/s. The astronaut and jet pack have a mass of ${M} kg.`, ask: 'the speed of the astronaut after firing. Take the mass of the astronaut and jet pack after firing to be {M} kg', small: 'gas', big: 'astronaut', before: 'firing', M: [120, 200], MStep: 5, m: [0.1, 0.5], mStep: 0.05, v: [50, 200], vStep: 10 },
  { name: 'tool', text: (M, m, v) => `An astronaut floats at rest outside a space station and throws a tool of mass ${m} kg away at ${v} m/s. The astronaut and spacesuit have a mass of ${M} kg.`, ask: 'the speed of the astronaut after the throw', small: 'tool', big: 'astronaut', before: 'the throw', M: [100, 160], MStep: 5, m: [0.5, 4], mStep: 0.5, v: [2, 10], vStep: 0.5 },
]

/**
 * Total momentum zero before, so the two momenta after are equal and opposite: written as q10
 * (a 2 kg gun, a 0.05 kg bullet at 400 m/s, 10 m/s, 3 marks), q15 (trolleys pushed apart by a
 * spring, 0.5 kg at 6 m/s and 1.5 kg, 2 m/s, 3 marks) and q16 (a 4000 kg satellite firing
 * 10 kg of gas at 800 m/s, 2 m/s, 4 marks). The answer is the speed, as the written ones ask,
 * with "the other way" in the working. The two masses are never equal and the speed found is
 * never a given figure.
 */
export const recoilSpeed: Generator = {
  id: 'recoil-speed',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q10', 'q15', 'q16'],
  build(r, slot, turn) {
    const list = slot.id === 'q10' ? FIRED : slot.id === 'q15' ? APART : IN_SPACE
    const c = list[turn % list.length]!
    const { M, m, v, p, V } = draw(
      r,
      (r) => {
        // The big mass first, then the small mass from those that have a speed giving a clean
        // recoil, then that speed: drawing all three, or any one last, let a figure that
        // divides well take the draws (a 3 kg tool, a 125 kg astronaut, a 2.5 kg trolley).
        const M = stepped(r, c.M[0], c.M[1], c.MStep)
        const fits = steps(c.m[0], c.m[1], c.mStep)
          .flatMap((m) =>
            steps(c.v[0], c.v[1], c.vStep).map((v) => {
              const p = clean(m * v)
              return { M, m, v, p, V: clean(p / M) }
            }),
          )
          // m ÷ M a power of ten would make the recoil speed the projectile's with its point moved.
          .filter(({ m, v, p, V }) => distinct(M, m, v, p, V) && !SHIFTS.includes(M) && !SHIFTS.includes(m) && clean(M / m) !== 2 && clean(m / M) !== 2 && !powerOfTen(clean(m / M)) && atMost(p, 2) && atMost(V, 2) && V >= 0.01 && (slot.id !== 'q15' || (V >= c.v[0] && V <= c.v[1])))
        if (!fits.length) return null
        const m = pick(r, [...new Set(fits.map((x) => x.m))])
        return pick(r, fits.filter((x) => x.m === m))
      },
      (x) => x !== null,
    )!
    const ask = c.ask.replace('{M}', prose(M))
    const prompt = `${c.text(prose(M), prose(m), show(v))} Calculate ${ask}.`
    const theOne = `$${tex(m)} \\times ${show(v)} = ${tex(p)}$ kg m/s`
    const solve = closes(`v = ${tex(p)} \\div ${tex(M)}`, V, 'm/s')
    const solution =
      slot.id === 'q15'
        ? `Before ${c.before} the total momentum is zero, so afterwards the two momenta are equal and opposite. ${theOne} one way means $${tex(M)} \\times v = ${tex(p)}$ the other way, so ${solve}`
        : slot.id === 'q10'
          ? `Before ${c.before}, total momentum is 0. After, the ${c.small} has ${theOne} forwards, so the ${c.big} must have ${prose(p)} kg m/s backwards: $${tex(M)} v = ${tex(p)}$, so ${solve}`
          : `Total momentum starts at zero. The ${c.small} has ${theOne} one way, so the ${c.big} must have ${prose(p)} kg m/s the other way: $${tex(M)} v = ${tex(p)}$, so ${solve}`
    const method =
      slot.id === 'q10'
        ? [`${c.small} momentum $= ${tex(m)} \\times ${show(v)} = ${tex(p)}$ kg m/s`, `${c.big} momentum equal and opposite: $${tex(M)} v = ${tex(p)}$`]
        : slot.id === 'q15'
          ? ['total momentum before is zero', `$${tex(M)} v = ${tex(m)} \\times ${show(v)}$`]
          : ['total momentum before is zero', `${c.small} momentum $= ${tex(m)} \\times ${show(v)} = ${tex(p)}$ kg m/s`, `$${tex(M)} v = ${tex(p)}$`]
    // Second route: the momenta after add to zero, with the recoil taken as negative.
    const total = m * v + M * -V
    return numeric(
      slot,
      { prompt, solution, method, answer: V, tolerance: dpTolerance(V), units: 'm/s' },
      { agrees: Math.abs(total) < 1e-9 * Math.max(1, m * v), detail: `${m} × ${v} + ${M} × (−${V}) = ${show(total)} kg m/s` },
      { context: c.name, M, m, v },
    )
  },
}

export const momentumGenerators: Generator[] = [
  momentumFromMassAndVelocity,
  velocityFromMomentum,
  massFromMomentum,
  stickingToAStillBody,
  headOnSticking,
  bothMovingAfter,
  changeOnRebound,
  forceFromChangeInMomentum,
  recoilSpeed,
]
