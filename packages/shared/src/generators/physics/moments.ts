import { show } from '../format.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import type { Generator } from '../types.ts'
import { G, G_STATED, atMost, closes, near, numeric, prose, stepped, tex } from './build.ts'
import { dpTolerance } from './format.ts'

/**
 * Moments, levers and gears (AQA 8463, 5.4): M = F d, balancing moments, the forces on a beam
 * held at both ends, and gears passing a moment and a speed on. Every numeric question
 * without a diagram has a generator here (q4, q6, q9 and q13 keep their written diagrams);
 * the written questions are the model for the wording and the mark scheme, and the contexts
 * carry the forces, distances, masses and teeth each one really has.
 */
const TOPIC = 'moments-levers-and-gears'

const clean = (x: number) => Number(show(x))
/** Distances and factors that would only move the decimal point, or multiply by nothing. */
const SHIFTS = [0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000, 100000]
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b
/** A multiple of `step` from lo to hi, or 0 when there is none, so a draw can reject the candidate. */
const multipleIn = (r: Rng, step: number, lo: number, hi: number) => (Math.ceil(lo / step) <= Math.floor(hi / step) ? int(r, Math.ceil(lo / step), Math.floor(hi / step)) * step : 0)

// ---------------------------------------------------------------------------------------------
// M = F d
// ---------------------------------------------------------------------------------------------

interface Turned {
  name: string
  text: (F: string, d: string) => string
  /** What the moment is about: "the moment of the force about the hinges". */
  ask: string
  force: [number, number]
  fStep: number
  dist: [number, number]
  dStep: number
}
/** Forces at right angles to a lever, with the forces and distances each really has, in metres. */
const TURNED: Turned[] = [
  { name: 'pivot', text: (F, d) => `A force of ${F} N acts at a perpendicular distance of ${d} m from a pivot.`, ask: 'the moment', force: [5, 200], fStep: 5, dist: [0.2, 2], dStep: 0.1 },
  { name: 'door', text: (F, d) => `A person pushes a door with a force of ${F} N at right angles to the door, ${d} m from the hinges.`, ask: 'the moment of the force about the hinges', force: [5, 40], fStep: 1, dist: [0.6, 0.9], dStep: 0.05 },
  { name: 'spanner', text: (F, d) => `A mechanic pulls on a spanner with a force of ${F} N, at right angles to the spanner and ${d} m from the nut.`, ask: 'the moment on the nut', force: [30, 150], fStep: 10, dist: [0.15, 0.4], dStep: 0.05 },
  { name: 'wheelbarrow', text: (F, d) => `A gardener lifts the handles of a wheelbarrow with an upward force of ${F} N. The handles are ${d} m from the axle of the wheel, measured horizontally.`, ask: 'the moment of the force about the axle', force: [100, 300], fStep: 10, dist: [1.1, 1.5], dStep: 0.1 },
  { name: 'pedal', text: (F, d) => `A cyclist pushes straight down on a pedal with a force of ${F} N while the crank is horizontal. The crank is ${d} m long.`, ask: 'the moment about the axle', force: [100, 600], fStep: 50, dist: [0.165, 0.175], dStep: 0.005 },
  { name: 'crowbar', text: (F, d) => `A worker pushes on the end of a crowbar with a force of ${F} N, at right angles to the bar and ${d} m from the pivot.`, ask: 'the moment about the pivot', force: [100, 400], fStep: 10, dist: [0.8, 1.5], dStep: 0.1 },
  { name: 'seesaw', text: (F, d) => `A child pushes straight down on one end of a level seesaw with a force of ${F} N, ${d} m from the pivot.`, ask: 'the moment about the pivot', force: [200, 500], fStep: 10, dist: [1.2, 2.5], dStep: 0.1 },
]

/**
 * M = F d: written as q2 (10 N at 0.3 m, 3 N m, 2 marks). The distance is never 1 m or a
 * power of ten, where the moment would be the force with its point moved, and the moment has
 * at most two decimal places.
 */
export const momentFromForceAndDistance: Generator = {
  id: 'moment-from-force-and-distance',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q2'],
  build(r, slot, turn) {
    const c = TURNED[turn % TURNED.length]!
    const { F, d, M } = draw(
      r,
      (r) => {
        const F = stepped(r, c.force[0], c.force[1], c.fStep)
        const d = stepped(r, c.dist[0], c.dist[1], c.dStep)
        return { F, d, M: clean(F * d) }
      },
      ({ F, d, M }) => !SHIFTS.includes(d) && F !== d && M !== F && M !== d && atMost(M, 2),
    )
    const prompt = `${c.text(prose(F), show(d))} ${pick(r, [`Calculate ${c.ask}, in N m.`, `What is ${c.ask}? Give your answer in N m.`])}`
    // Second route: the moment over the distance gives the force back.
    const fBack = M / d
    return numeric(
      slot,
      {
        prompt,
        solution: closes(`M = F d = ${tex(F)} \\times ${tex(d)}`, M, 'N m'),
        method: [`$${tex(F)} \\times ${tex(d)}$`],
        answer: M,
        tolerance: dpTolerance(M),
        units: 'N m',
      },
      { agrees: near(fBack, F) && near(M / F, d), detail: `${M} ÷ ${d} = ${show(fBack)} N` },
      { context: c.name, F, d },
    )
  },
}

interface Handle {
  text: (L: string, F: string) => string
  ask: string
  /** Length in cm. */
  len: [number, number]
  lStep: number
  force: [number, number]
  fStep: number
}
/** Levers measured in centimetres, with the lengths and forces each really has. */
const HANDLES: Handle[] = [
  { text: (L, F) => `A spanner is ${L} cm long. A force of ${F} N is applied at its end, perpendicular to the spanner.`, ask: 'the moment on the nut', len: [15, 40], lStep: 1, force: [20, 150], fStep: 5 },
  { text: (L, F) => `A wheel brace used to undo a wheel nut has an arm ${L} cm long. A force of ${F} N is applied at the end of the arm, at right angles to it.`, ask: 'the moment on the wheel nut', len: [30, 45], lStep: 1, force: [100, 300], fStep: 10 },
  { text: (L, F) => `A door handle is ${L} cm from the hinges. A force of ${F} N is applied to the handle at right angles to the door.`, ask: 'the moment about the hinges', len: [70, 90], lStep: 1, force: [5, 30], fStep: 1 },
  { text: (L, F) => `A bicycle crank is ${L} cm long. The cyclist pushes on the pedal with a force of ${F} N, at right angles to the crank.`, ask: 'the moment about the axle', len: [16.5, 17.5], lStep: 0.5, force: [100, 600], fStep: 10 },
  { text: (L, F) => `A screwdriver is used as a lever to open a tin of paint, with the rim of the tin as the pivot. A force of ${F} N is applied at right angles to the handle, ${L} cm from the rim.`, ask: 'the moment of the force about the rim', len: [12, 20], lStep: 1, force: [10, 50], fStep: 5 },
  { text: (L, F) => `A torque wrench is ${L} cm long from the bolt to its handle. A force of ${F} N is applied to the handle, at right angles to the wrench.`, ask: 'the moment on the bolt', len: [30, 60], lStep: 1, force: [50, 200], fStep: 10 },
]

/**
 * M = F d with the distance in centimetres: written as q5 (a 25 cm spanner, 40 N, 10 N m, 2
 * marks). The conversion is the first mark, as written. Never 100 cm, nor a force that is a
 * power of ten, where the moment would be a given figure with its point moved.
 */
export const momentWithAConversion: Generator = {
  id: 'moment-with-a-unit-conversion',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q5'],
  build(r, slot, turn) {
    const c = HANDLES[turn % HANDLES.length]!
    const { L, d, F, M } = draw(
      r,
      (r) => {
        const L = stepped(r, c.len[0], c.len[1], c.lStep)
        const F = stepped(r, c.force[0], c.force[1], c.fStep)
        const d = clean(L / 100)
        return { L, d, F, M: clean(F * d) }
      },
      ({ L, d, F, M }) => !SHIFTS.includes(d) && !SHIFTS.includes(F) && F !== L && M !== F && M !== L && atMost(M, 2),
    )
    const prompt = `${c.text(show(L), prose(F))} ${pick(r, [`Calculate ${c.ask}, in N m.`, `What is ${c.ask}? Give your answer in N m.`])}`
    // Second route: in N cm first, then to N m.
    const inNcm = F * L
    return numeric(
      slot,
      {
        prompt,
        solution: `$${show(L)}$ cm $= ${show(d)}$ m. ${closes(`M = F d = ${tex(F)} \\times ${show(d)}`, M, 'N m')}`,
        method: [`${show(L)} cm converted to ${show(d)} m`],
        answer: M,
        tolerance: dpTolerance(M),
        units: 'N m',
      },
      { agrees: near(inNcm / 100, M), detail: `${F} × ${L} = ${show(inNcm)} N cm = ${show(inNcm / 100)} N m` },
      { context: c.ask, L, F },
    )
  },
}

interface Hung {
  name: string
  text: (m: string, d: string) => string
  /** "its weight", "the child's weight". */
  whose: string
  about: string
  mass: [number, number]
  mStep: number
  dist: [number, number]
  dStep: number
}
/** Masses hanging or sitting at a distance from a pivot, with the masses and distances each really has. */
const HUNG: Hung[] = [
  { name: 'mass', text: (m, d) => `A mass of ${m} kg hangs ${d} m from a pivot.`, whose: 'its weight', about: 'the pivot', mass: [0.5, 5], mStep: 0.5, dist: [0.15, 0.9], dStep: 0.05 },
  { name: 'hanging basket', text: (m, d) => `A hanging basket of mass ${m} kg hangs from a wall bracket, ${d} m from the wall.`, whose: 'its weight', about: 'the point where the bracket meets the wall', mass: [2, 8], mStep: 0.5, dist: [0.2, 0.5], dStep: 0.05 },
  { name: 'shop sign', text: (m, d) => `A shop sign of mass ${m} kg hangs from the end of a bracket, ${d} m from the wall.`, whose: 'its weight', about: 'the point where the bracket meets the wall', mass: [5, 20], mStep: 1, dist: [0.5, 1.2], dStep: 0.1 },
  { name: 'crane', text: (m, d) => `A tower crane holds a load of mass ${m} kg at a horizontal distance of ${d} m from its tower.`, whose: "the load's weight", about: 'the tower', mass: [500, 3000], mStep: 100, dist: [12, 40], dStep: 1 },
  { name: 'fishing rod', text: (m, d) => `An angler holds a fishing rod still with a fish of mass ${m} kg hanging from its tip, ${d} m horizontally from the angler's hands.`, whose: "the fish's weight", about: "the angler's hands", mass: [0.5, 3], mStep: 0.5, dist: [1.5, 3], dStep: 0.5 },
  { name: 'child', text: (m, d) => `A child of mass ${m} kg sits on a seesaw, ${d} m from the pivot.`, whose: "the child's weight", about: 'the pivot', mass: [20, 45], mStep: 1, dist: [1.2, 2.5], dStep: 0.1 },
]

/**
 * Weight, then its moment: written as q8 (2 kg at 0.5 m, 9.8 N m, 3 marks). Never 1 kg (the
 * weight would be the stated 9.8), never a moment of 9.8 N m (the written one's coincidence),
 * and the moment has at most two decimal places.
 */
export const momentOfAWeight: Generator = {
  id: 'moment-of-a-weight',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q8'],
  build(r, slot, turn) {
    const c = HUNG[turn % HUNG.length]!
    const { m, d, W, M } = draw(
      r,
      (r) => {
        const m = stepped(r, c.mass[0], c.mass[1], c.mStep)
        const d = stepped(r, c.dist[0], c.dist[1], c.dStep)
        const W = clean(m * G)
        return { m, d, W, M: clean(W * d) }
      },
      ({ m, d, W, M }) => m !== 1 && !SHIFTS.includes(d) && m !== d && M !== G && M !== W && M !== m && atMost(W, 2) && atMost(M, 2),
    )
    const prompt = `${c.text(prose(m), show(d))} ${pick(r, G_STATED)} ${pick(r, [`Calculate the moment of ${c.whose} about ${c.about}, in N m.`, `What is the moment of ${c.whose} about ${c.about}? Give your answer in N m.`])}`
    // Second route: the mass times the distance first, then times g.
    const viaMd = m * d * G
    return numeric(
      slot,
      {
        prompt,
        solution: `Weight $= m g = ${tex(m)} \\times 9.8 = ${tex(W)}$ N. Moment ${closes(`= ${tex(W)} \\times ${tex(d)}`, M, 'N m')}`,
        method: [`$W = ${tex(W)}$ N`, `$${tex(W)} \\times ${tex(d)}$`],
        answer: M,
        tolerance: dpTolerance(M),
        units: 'N m',
      },
      { agrees: near(viaMd, M), detail: `${m} × ${d} × 9.8 = ${show(viaMd)} N m` },
      { context: c.name, m, d, W },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// A beam on two supports
// ---------------------------------------------------------------------------------------------

interface Beam {
  name: string
  beam: (len: string, W: string) => string
  load: (P: string, x: string) => string
  len: [number, number]
  lenStep: number
  weight: [number, number]
  /** An even number of newtons, so half the weight is whole. */
  wStep: number
  pull: [number, number]
  pStep: number
  /** The load's distance from the left end goes in steps of this many metres. */
  xStep: number
}
/** Uniform beams with a load, each with the lengths, weights and loads it really has. */
const BEAMS: Beam[] = [
  { name: 'beam', beam: (l, W) => `A uniform beam of length ${l} m and weight ${W} N rests on supports at each end.`, load: (P, x) => `A load of ${P} N is placed ${x} m from the left end.`, len: [3, 8], lenStep: 1, weight: [50, 300], wStep: 10, pull: [100, 600], pStep: 10, xStep: 0.5 },
  { name: 'plank', beam: (l, W) => `A uniform plank of length ${l} m and weight ${W} N lies across a stream, resting on the bank at each end.`, load: (P, x) => `A walker weighing ${P} N stands ${x} m from the left end.`, len: [2, 4], lenStep: 0.5, weight: [100, 250], wStep: 10, pull: [500, 900], pStep: 10, xStep: 0.25 },
  { name: 'shelf', beam: (l, W) => `A uniform shelf of length ${l} m and weight ${W} N rests on a bracket at each end.`, load: (P, x) => `A box of books weighing ${P} N sits ${x} m from the left end.`, len: [0.8, 1.6], lenStep: 0.2, weight: [20, 60], wStep: 2, pull: [40, 200], pStep: 5, xStep: 0.1 },
  { name: 'scaffold board', beam: (l, W) => `A uniform scaffold board of length ${l} m and weight ${W} N rests on a trestle at each end.`, load: (P, x) => `A decorator weighing ${P} N stands ${x} m from the left end.`, len: [3, 4], lenStep: 0.5, weight: [150, 250], wStep: 10, pull: [600, 900], pStep: 10, xStep: 0.25 },
  { name: 'bench', beam: (l, W) => `A uniform bench of length ${l} m and weight ${W} N rests on a support at each end.`, load: (P, x) => `A person weighing ${P} N sits ${x} m from the left end.`, len: [1.5, 3], lenStep: 0.5, weight: [100, 300], wStep: 20, pull: [400, 800], pStep: 10, xStep: 0.25 },
  { name: 'footbridge', beam: (l, W) => `A uniform footbridge of length ${l} m and weight ${W} N rests on supports at each end.`, load: (P, x) => `A cyclist and bicycle weighing ${P} N together are ${x} m from the left end.`, len: [10, 20], lenStep: 2, weight: [20000, 60000], wStep: 2000, pull: [700, 1100], pStep: 10, xStep: 1 },
]

/**
 * The upward forces on a beam add up to the downward ones: written as q10 (a 6 m beam of 120 N
 * with 300 N at 2 m and 160 N from the right support, 260 N, 2 marks). The given right support
 * is the one moments about the left end give, so the check in the solution holds. The load is
 * never at the middle (the supports would share equally), and no support force equals a given
 * figure or the other support.
 */
export const leftSupportFromBalance: Generator = {
  id: 'support-force-from-balance',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q10'],
  build(r, slot, turn) {
    const c = BEAMS[turn % BEAMS.length]!
    const { len, x, Wb, P, R, L } = draw(
      r,
      (r) => {
        const len = stepped(r, c.len[0], c.len[1], c.lenStep)
        const x = stepped(r, c.xStep, len - c.xStep, c.xStep)
        const Wb = stepped(r, c.weight[0], c.weight[1], c.wStep)
        // P x ÷ len is whole when P is a multiple of the denominator of x ÷ len in lowest terms.
        const xi = Math.round(x / c.xStep)
        const li = Math.round(len / c.xStep)
        const P = multipleIn(r, lcm(c.pStep, li / gcd(xi, li)), c.pull[0], c.pull[1])
        const R = clean((P * x) / len + Wb / 2)
        return { len, x, Wb, P, R, L: clean(P + Wb - R) }
      },
      ({ len, x, Wb, P, R, L }) => P > 0 && P !== Wb && x !== len / 2 && Number.isInteger(R) && Number.isInteger(L) && L !== R && L !== P && L !== Wb && R !== P && R !== Wb,
    )
    const ask = pick(r, ['Calculate the upward force from the left support, in newtons.', 'What is the upward force from the left support? Give your answer in newtons.'])
    const prompt = `${c.beam(show(len), prose(Wb))} ${c.load(prose(P), show(x))} The right support pushes up with a force of ${prose(R)} N. ${ask}`
    const down = P + Wb
    // Second route: moments about the right end give the left support on their own.
    const viaRight = (P * (len - x) + Wb * (len / 2)) / len
    return numeric(
      slot,
      {
        prompt,
        solution: `Upward forces equal downward forces: $L + ${tex(R)} = ${tex(P)} + ${tex(Wb)}$, so ${closes(`L = ${tex(down)} - ${tex(R)}`, L, 'N')} Check with moments about the left end: $R \\times ${show(len)} = ${tex(P)} \\times ${show(x)} + ${tex(Wb)} \\times ${show(len / 2)} = ${tex(clean(R * len))}$, so $R = ${tex(R)}$ N, as given.`,
        method: [`$L + R = ${tex(down)}$`],
        answer: L,
        units: 'N',
      },
      { agrees: near(viaRight, L), detail: `(${P} × ${show(len - x)} + ${Wb} × ${show(len / 2)}) ÷ ${len} = ${show(viaRight)} N` },
      { context: c.name, len, x, Wb, P, R },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Balancing with masses
// ---------------------------------------------------------------------------------------------

interface Balanced {
  name: string
  text: (m1: string, d1: string, m2: string) => string
  /** The two ways of asking where the second mass goes. */
  asks: (m2: string) => [string, string]
  m1: [number, number]
  m1Step: number
  d1: [number, number]
  dStep: number
  m2: [number, number]
  m2Step: number
  /** Where the second mass can really go: a seesaw is about 2.5 m each side. */
  reach: [number, number]
}
const BALANCED: Balanced[] = [
  {
    name: 'child and adult',
    text: (m1, d1) => `A child of mass ${m1} kg sits ${d1} m from the pivot of a seesaw.`,
    asks: (m2) => [`Where must an adult of mass ${m2} kg sit on the other side to balance it? Give the distance from the pivot in metres.`, `How far from the pivot must an adult of mass ${m2} kg sit on the other side to balance it? Give your answer in metres.`],
    m1: [20, 45], m1Step: 1, d1: [1.2, 2.5], dStep: 0.1, m2: [55, 90], m2Step: 1, reach: [0.4, 2.5],
  },
  {
    name: 'adult and child',
    text: (m1, d1) => `An adult of mass ${m1} kg sits ${d1} m from the pivot of a seesaw.`,
    asks: (m2) => [`Where must a child of mass ${m2} kg sit on the other side to balance it? Give the distance from the pivot in metres.`, `How far from the pivot must a child of mass ${m2} kg sit on the other side to balance it? Give your answer in metres.`],
    m1: [55, 90], m1Step: 1, d1: [0.5, 1.2], dStep: 0.1, m2: [20, 45], m2Step: 1, reach: [0.8, 2.5],
  },
  {
    name: 'two children',
    text: (m1, d1) => `A child of mass ${m1} kg sits ${d1} m from the pivot of a seesaw.`,
    asks: (m2) => [`Where must a second child, of mass ${m2} kg, sit on the other side to balance it? Give the distance from the pivot in metres.`, `How far from the pivot must a second child, of mass ${m2} kg, sit on the other side to balance it? Give your answer in metres.`],
    m1: [20, 50], m1Step: 1, d1: [1, 2.5], dStep: 0.1, m2: [20, 50], m2Step: 1, reach: [0.6, 2.5],
  },
  {
    name: 'metre rule',
    text: (m1, d1) => `A metre rule is balanced on a pivot at its centre. A mass of ${m1} kg hangs ${d1} m to the left of the pivot.`,
    asks: (m2) => [`Where must a mass of ${m2} kg hang on the right to balance the rule? Give the distance from the pivot in metres.`, `How far to the right of the pivot must a mass of ${m2} kg hang to balance the rule? Give your answer in metres.`],
    m1: [0.1, 0.5], m1Step: 0.05, d1: [0.1, 0.45], dStep: 0.05, m2: [0.1, 0.5], m2Step: 0.05, reach: [0.05, 0.49],
  },
  {
    name: 'crane',
    text: (m1, d1) => `A tower crane has a counterweight of mass ${m1} kg, ${d1} m from the tower on one side.`,
    asks: (m2) => [`Where must a load of mass ${m2} kg hang on the other side for the crane to balance? Give the distance from the tower in metres.`, `How far from the tower must a load of mass ${m2} kg hang on the other side for the crane to balance? Give your answer in metres.`],
    m1: [10000, 20000], m1Step: 1000, d1: [10, 15], dStep: 1, m2: [2000, 8000], m2Step: 500, reach: [15, 60],
  },
]

/**
 * Moments balance with g cancelling: written as q12 (30 kg at 1.5 m against 60 kg, 0.75 m, 3
 * marks). The second distance has at most two decimal places and lies where the seesaw, rule
 * or jib really reaches. Never a mass ratio of 2 or a half (the distance would only halve or
 * double, as in the written one), nor equal masses.
 */
export const balancingWithMasses: Generator = {
  id: 'balancing-with-masses',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q12'],
  build(r, slot, turn) {
    const c = BALANCED[turn % BALANCED.length]!
    const { m1, d1, m2, d2 } = draw(
      r,
      (r) => {
        const m1 = stepped(r, c.m1[0], c.m1[1], c.m1Step)
        const d1 = stepped(r, c.d1[0], c.d1[1], c.dStep)
        const m2 = stepped(r, c.m2[0], c.m2[1], c.m2Step)
        return { m1, d1, m2, d2: clean((m1 * d1) / m2) }
      },
      ({ m1, d1, m2, d2 }) => {
        const ratio = clean(m2 / m1)
        return m1 !== m2 && ratio !== 2 && ratio !== 0.5 && atMost(d2, 2) && d2 >= c.reach[0] && d2 <= c.reach[1] && d2 !== d1 && d2 !== m1 && d2 !== m2 && near(m1 * d1, m2 * d2)
      },
    )
    const product = clean(m1 * d1)
    const prompt = `${c.text(prose(m1), show(d1), prose(m2))} ${pick(r, c.asks(prose(m2)))}`
    // Second route: the two weights' moments, with g kept in, are equal at the distance found.
    const left = m1 * G * d1
    const right = m2 * G * d2
    return numeric(
      slot,
      {
        prompt,
        solution: `Moments balance: $${tex(m1)}g \\times ${show(d1)} = ${tex(m2)}g \\times d$. The $g$ cancels: $${tex(product)} = ${tex(m2)}d$, so ${closes(`d = ${tex(product)} \\div ${tex(m2)}`, d2, 'm')}`,
        method: [`moments equated with weights or masses: $${tex(m1)}g \\times ${show(d1)} = ${tex(m2)}g \\times d$`, `$${tex(product)} = ${tex(m2)} d$`],
        answer: d2,
        tolerance: dpTolerance(d2),
        units: 'm',
      },
      { agrees: near(left, right), detail: `${m1} × 9.8 × ${d1} = ${show(left)}; ${m2} × 9.8 × ${d2} = ${show(right)} N m` },
      { context: c.name, m1, d1, m2 },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Gears
// ---------------------------------------------------------------------------------------------

interface Geared {
  name: string
  text: (n1: number, M: string, n2: number) => string
  teeth: [number, number]
  moment: [number, number]
  mStep: number
}
/** Gears that turn a small input moment into a larger output one, with the moments each really carries. */
const GEARED: Geared[] = [
  { name: 'gears', text: (n1, M, n2) => `An input gear with ${n1} teeth has a moment of ${M} N m applied to it. It drives an output gear with ${n2} teeth.`, teeth: [10, 60], moment: [0.5, 10], mStep: 0.5 },
  { name: 'winch', text: (n1, M, n2) => `A hand winch has an input gear with ${n1} teeth, turned by a handle with a moment of ${M} N m. It drives an output gear with ${n2} teeth on the winch drum.`, teeth: [10, 60], moment: [5, 40], mStep: 1 },
  { name: 'screwdriver', text: (n1, M, n2) => `In an electric screwdriver, a gear with ${n1} teeth on the motor shaft applies a moment of ${M} N m. It drives an output gear with ${n2} teeth.`, teeth: [10, 50], moment: [0.2, 1], mStep: 0.1 },
  { name: 'gearbox', text: (n1, M, n2) => `In a car gearbox, an input gear with ${n1} teeth carries a moment of ${M} N m from the engine. It drives an output gear with ${n2} teeth.`, teeth: [15, 45], moment: [100, 300], mStep: 10 },
  { name: 'windlass', text: (n1, M, n2) => `A windlass applies a moment of ${M} N m to an input gear with ${n1} teeth to open a canal lock paddle. The input gear drives an output gear with ${n2} teeth.`, teeth: [12, 60], moment: [30, 80], mStep: 5 },
]

/**
 * The moment through a pair of gears: written as q14 (20 teeth to 60, 2 N m, 6 N m, 3 marks).
 * The output gear is always the larger, as written, by a ratio from 1.25 to 5 with at most
 * two decimal places, and never 10. The ratio is printed in maths, so 2.1 times never reads
 * as "1 times" to the release check.
 */
export const momentThroughGears: Generator = {
  id: 'moment-through-gears',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q14'],
  build(r, slot, turn) {
    const c = GEARED[turn % GEARED.length]!
    const { n1, n2, M1, ratio, M2 } = draw(
      r,
      (r) => {
        const n1 = int(r, c.teeth[0], c.teeth[1])
        const n2 = int(r, c.teeth[0], c.teeth[1])
        const M1 = stepped(r, c.moment[0], c.moment[1], c.mStep)
        const ratio = clean(n2 / n1)
        return { n1, n2, M1, ratio, M2: clean((M1 * n2) / n1) }
      },
      ({ n1, n2, M1, ratio, M2 }) => ratio >= 1.25 && ratio <= 5 && atMost(ratio, 2) && M1 !== 1 && atMost(M2, 2) && M2 !== n1 && M2 !== n2 && M2 !== M1 && M1 !== n1 && M1 !== n2,
    )
    const ask = pick(r, ['Calculate the moment on the output gear, in N m.', 'What is the moment on the output gear? Give your answer in N m.'])
    // Second route: energy per turn. One turn of the output takes n2 ÷ n1 turns of the input,
    // and the work in, 2π M1 per turn, equals the work out.
    const workIn = 2 * Math.PI * M1 * (n2 / n1)
    const workOut = 2 * Math.PI * M2
    return numeric(
      slot,
      {
        prompt: `${c.text(n1, show(M1), n2)} ${ask}`,
        solution: `The teeth ratio is $${n2} \\div ${n1} = ${show(ratio)}$, so the output gear has $${show(ratio)}$ times the radius. The force at the meshing teeth is the same, so the moment is $${show(ratio)}$ times larger: ${closes(`${tex(M1)} \\times ${show(ratio)}`, M2, 'N m')} The output turns $${show(ratio)}$ times more slowly.`,
        method: [`ratio $${n2} \\div ${n1} = ${show(ratio)}$`, 'same force at the teeth, larger radius'],
        answer: M2,
        tolerance: dpTolerance(M2),
        units: 'N m',
      },
      { agrees: near(workIn, workOut), detail: `2π × ${M1} × ${n2}/${n1} = ${workIn.toFixed(4)}; 2π × ${M2} = ${workOut.toFixed(4)}` },
      { context: c.name, n1, n2, M1, ratio },
    )
  },
}

interface Spun {
  text: (n1: number, f: string, n2: number) => string
  /** How the driven gear is named in the question: "the 60-tooth gear", "the beater gear". */
  driven: (n2: number) => string
  /** Teeth on the driving gear and the driven one. */
  drive: [number, number]
  follow: [number, number]
  rpm: [number, number]
  fStep: number
}
const SPUN: Spun[] = [
  { text: (n1, f, n2) => `A gear with ${n1} teeth drives a gear with ${n2} teeth. The ${n1}-tooth gear turns at ${f} revolutions per minute.`, driven: (n2) => `the ${n2}-tooth gear`, drive: [10, 60], follow: [10, 60], rpm: [30, 300], fStep: 10 },
  { text: (n1, f, n2) => `In a hand whisk, the handle turns a large gear with ${n1} teeth at ${f} revolutions per minute. It drives a small gear with ${n2} teeth on the beaters.`, driven: () => 'the beater gear', drive: [40, 60], follow: [10, 20], rpm: [60, 150], fStep: 5 },
  { text: (n1, f, n2) => `In a hand drill, the handle turns a gear with ${n1} teeth at ${f} revolutions per minute. It drives a gear with ${n2} teeth on the chuck.`, driven: () => 'the chuck gear', drive: [40, 60], follow: [10, 20], rpm: [60, 120], fStep: 5 },
  { text: (n1, f, n2) => `In a toy car, the motor turns a gear with ${n1} teeth at ${f} revolutions per minute. It drives a gear with ${n2} teeth on the axle.`, driven: () => 'the axle gear', drive: [10, 15], follow: [30, 60], rpm: [3000, 9000], fStep: 100 },
  { text: (n1, f, n2) => `An electric motor turns a gear with ${n1} teeth at ${f} revolutions per minute. It drives a gear with ${n2} teeth on a winch drum.`, driven: () => 'the drum gear', drive: [10, 20], follow: [40, 60], rpm: [1000, 3000], fStep: 50 },
]

/**
 * The speed through a pair of gears: written as q16 (20 teeth driving 60 at 90 rpm, 30, 2
 * marks). The driving speed is drawn from the multiples that make the answer a whole number,
 * so no speed is favoured, and the teeth are never equal or in a ratio of 10.
 */
export const speedThroughGears: Generator = {
  id: 'speed-through-gears',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q16'],
  build(r, slot, turn) {
    const c = SPUN[turn % SPUN.length]!
    const { n1, n2, f1, f2 } = draw(
      r,
      (r) => {
        const n1 = int(r, c.drive[0], c.drive[1])
        const n2 = int(r, c.follow[0], c.follow[1])
        // f1 × n1 ÷ n2 is whole when f1 is a multiple of n2 ÷ gcd(n1, n2).
        const f1 = multipleIn(r, lcm(c.fStep, n2 / gcd(n1, n2)), c.rpm[0], c.rpm[1])
        return { n1, n2, f1, f2: (f1 * n1) / n2 }
      },
      ({ n1, n2, f1, f2 }) => f1 > 0 && n1 !== n2 && n1 !== 10 * n2 && n2 !== 10 * n1 && Number.isInteger(f2) && f2 !== n1 && f2 !== n2 && f2 !== f1,
    )
    const who = c.driven(n2)
    const ask = pick(r, [`Calculate how many revolutions per minute ${who} makes.`, `How many revolutions per minute does ${who} make?`])
    const faster = n2 < n1
    // Second route: teeth passing the meshing point each minute are the same for both gears.
    const teethIn = f1 * n1
    const teethOut = f2 * n2
    return numeric(
      slot,
      {
        prompt: `${c.text(n1, prose(f1), n2)} ${ask}`,
        solution: `Each turn of the ${n1}-tooth gear moves ${n1} teeth past, so the ${n2}-tooth gear turns ${faster ? `$${n1} \\div ${n2}$ revolutions for each turn of the ${n1}-tooth gear` : `$${n1} \\div ${n2}$ of a revolution`}: ${closes(`${tex(f1)} \\times ${n1} \\div ${n2}`, f2, 'rpm')} The ${n2}-tooth gear turns ${faster ? 'faster but with a smaller moment' : 'more slowly but with a larger moment'}.`,
        method: [`ratio ${n1}:${n2}, or $${tex(f1)} \\times ${n1} \\div ${n2}$`],
        answer: f2,
        units: 'rpm',
        line: prose(f2),
      },
      { agrees: teethIn === teethOut, detail: `${f1} × ${n1} = ${teethIn}; ${f2} × ${n2} = ${teethOut} teeth a minute` },
      { context: who === `the ${n2}-tooth gear` ? 'gear' : who, n1, n2, f1 },
    )
  },
}

export const momentGenerators: Generator[] = [
  momentFromForceAndDistance,
  momentWithAConversion,
  momentOfAWeight,
  leftSupportFromBalance,
  balancingWithMasses,
  momentThroughGears,
  speedThroughGears,
]
