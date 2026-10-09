import { show } from '../format.ts'
import { draw, pick, type Rng } from '../random.ts'
import type { Generator } from '../types.ts'
import { G, atMost, cap, closes, near, numeric, prose, tex } from './build.ts'
import { dpTolerance } from './format.ts'

/**
 * Pressure in fluids (AQA 8463, 5.5): p = F ÷ A, p = hρg, upthrust and floating. Every
 * numeric question in the topic has a generator here. The constants are the topic's own:
 * water 1000 kg/m³, sea water 1030 kg/m³, g = 9.8 N/kg, atmospheric pressure 101 000 Pa as
 * the written q11 gives it. Contexts carry the forces, areas and depths each really has: a
 * diver is at most 40 m down, a car tyre presses on the road at about 200 kPa.
 */
const TOPIC = 'pressure-in-fluids'

const clean = (x: number) => Number(show(x))
/** Every value from lo to hi in steps of `step`. */
const steps = (lo: number, hi: number, step: number) => Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => clean(lo + i * step))
/** 0.1, 1, 10, 100: a figure that only moves the point. */
const powerOfTen = (x: number) => x > 0 && Math.abs(Math.log10(x) - Math.round(Math.log10(x))) < 1e-9

/**
 * One value from the first list, then one from the values that suit it, each drawn evenly. A
 * first value with nothing to suit it is drawn again, so the first list's spread survives.
 */
function follow<A, B>(r: Rng, firsts: A[], seconds: (a: A) => B[]): [A, B] {
  return draw(
    r,
    (r) => {
      const a = pick(r, firsts)
      const bs = seconds(a)
      return bs.length ? ([a, pick(r, bs)] as [A, B]) : null
    },
    (x) => x !== null,
  )!
}

interface Liquid {
  rho: number
  /** As the written prompts state it. */
  stated: string
}
const WATER: Liquid = { rho: 1000, stated: 'Density of water $= 1000$ kg/m³, $g = 9.8$ N/kg.' }
const SEA: Liquid = { rho: 1030, stated: 'Density of sea water $= 1030$ kg/m³, $g = 9.8$ N/kg.' }
const ATMOSPHERE = 101000

// ---------------------------------------------------------------------------------------------
// p = F ÷ A
// ---------------------------------------------------------------------------------------------

interface Pressed {
  name: string
  text: (F: string, A: string) => string
  /** Pressure range and step: the answer is drawn from it first. */
  p: [number, number]
  pStep: number
  areas: number[]
  /** The force the thing really has. */
  F: [number, number]
}
/** A force on an area, as q1 asks it. */
const FORCES: Pressed[] = [
  { name: 'force on an area', text: (F, A) => `A force of ${F} N acts on an area of ${A} m². Calculate the pressure.`, p: [20, 500], pStep: 5, areas: steps(0.2, 8, 0.2), F: [20, 2000] },
  { name: 'sail', text: (F, A) => `The wind pushes on a sail of area ${A} m² with a force of ${F} N. Calculate the pressure of the wind on the sail, in pascals.`, p: [50, 400], pStep: 5, areas: steps(2, 20, 0.5), F: [100, 8000] },
  { name: 'snow on a roof', text: (F, A) => `Snow lying on a flat garage roof of area ${A} m² pushes down on it with a force of ${F} N. Calculate the pressure of the snow on the roof, in pascals.`, p: [500, 2000], pStep: 50, areas: steps(12, 30, 1), F: [6000, 60000] },
  { name: 'fish tank', text: (F, A) => `The water in a fish tank pushes down on the base, of area ${A} m², with a force of ${F} N. Calculate the pressure on the base, in pascals.`, p: [2000, 5000], pStep: 50, areas: steps(0.15, 0.6, 0.05), F: [300, 3000] },
  { name: 'hydraulic jack', text: (F, A) => `The piston of a hydraulic jack has an area of ${A} m² and pushes with a force of ${F} N. Calculate the pressure in the oil, in pascals.`, p: [1000000, 8000000], pStep: 100000, areas: steps(0.0005, 0.004, 0.0005), F: [1000, 30000] },
]
/** A weight resting on the area in contact, as q3 asks it. */
const RESTING: Pressed[] = [
  { name: 'box', text: (F, A) => `A box weighing ${F} N rests on the floor. The area in contact is ${A} m². Calculate the pressure on the floor.`, p: [50, 1500], pStep: 10, areas: steps(0.1, 0.8, 0.05), F: [20, 300] },
  { name: 'person', text: (F, A) => `A person weighing ${F} N stands on both feet. The area of their feet in contact with the ground is ${A} m². Calculate the pressure on the ground.`, p: [8000, 25000], pStep: 100, areas: steps(0.03, 0.06, 0.005), F: [400, 900] },
  { name: 'car', text: (F, A) => `A car weighing ${F} N rests on its four tyres. The total area of tyre touching the road is ${A} m². Calculate the pressure on the road.`, p: [150000, 250000], pStep: 5000, areas: steps(0.04, 0.08, 0.005), F: [8000, 16000] },
  { name: 'skier', text: (F, A) => `A skier weighing ${F} N stands on two skis. The total area of ski touching the snow is ${A} m². Calculate the pressure on the snow.`, p: [1500, 4500], pStep: 50, areas: steps(0.2, 0.4, 0.02), F: [500, 900] },
  { name: 'elephant', text: (F, A) => `An elephant weighing ${F} N stands on all four feet. The total area of its feet on the ground is ${A} m². Calculate the pressure on the ground.`, p: [40000, 150000], pStep: 1000, areas: steps(0.4, 1, 0.05), F: [30000, 60000] },
  { name: 'fridge', text: (F, A) => `A fridge weighing ${F} N stands on four small feet with a total area of ${A} m² on the floor. Calculate the pressure on the floor.`, p: [100000, 300000], pStep: 5000, areas: steps(0.002, 0.006, 0.0005), F: [400, 1000] },
]

/**
 * A pressure from its context's range, then an area whose force is a whole number of newtons
 * in the range the thing really has. Never an area of 0.5 m² (the pressure would be the force
 * doubled) or a power of ten, and never a pressure equal to the force.
 */
function pressed(r: Rng, c: Pressed) {
  const [p, A] = follow(r, steps(c.p[0], c.p[1], c.pStep), (p) =>
    c.areas.filter((A) => {
      const F = clean(p * A)
      return Number.isInteger(F) && F >= c.F[0] && F <= c.F[1] && !powerOfTen(A) && !powerOfTen(p) && A !== 0.5 && A !== 2 && F !== p
    }),
  )
  return { p, A, F: clean(p * A) }
}

/**
 * p = F ÷ A: written as q1 (200 N on 4 m², 50 Pa, 2 marks) and q3 (a box weighing 60 N on
 * 0.5 m², 120 Pa, 2 marks). q1 keeps to a force acting on an area and q3 to a weight resting
 * on the area in contact. The pressure is drawn first and is a whole number of pascals.
 */
export const pressureFromForce: Generator = {
  id: 'pressure-from-force-and-area',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q1', 'q3'],
  build(r, slot, turn) {
    const list = slot.id === 'q1' ? FORCES : RESTING
    const c = list[turn % list.length]!
    const { p, A, F } = pressed(r, c)
    // Second route: forwards, the pressure found times the area.
    return numeric(
      slot,
      {
        prompt: c.text(prose(F), show(A)),
        solution: closes(`p = \\dfrac{F}{A} = \\dfrac{${tex(F)}}{${tex(A)}}`, p, 'Pa'),
        method: [`$${tex(F)} \\div ${tex(A)}$`],
        answer: p,
        units: 'Pa',
      },
      { agrees: near(p * A, F) && Number.isInteger(p), detail: `${p} × ${show(A)} = ${show(p * A)} N` },
      { context: c.name, F, A },
    )
  },
}

interface Pushing {
  name: string
  text: (p: string, A: string) => string
  ask: string
  p: [number, number]
  pStep: number
  areas: number[]
}
/** Fluids pushing on a surface, with the pressures and areas each really has. */
const PUSHING: Pushing[] = [
  { name: 'gas on a surface', text: (p, A) => `The pressure of a gas on a surface is ${p} Pa. The surface has an area of ${A} m².`, ask: 'the force on the surface', p: [500, 5000], pStep: 100, areas: steps(0.01, 0.09, 0.005) },
  { name: 'piston', text: (p, A) => `The gas in an engine cylinder is at a pressure of ${p} Pa. The piston has an area of ${A} m².`, ask: 'the force of the gas on the piston', p: [200000, 800000], pStep: 10000, areas: steps(0.002, 0.008, 0.0005) },
  { name: 'window', text: (p, A) => `The air outside a window is at a pressure of ${p} Pa. The window has an area of ${A} m².`, ask: 'the force of the air on the outside of the window', p: [99000, 103000], pStep: 500, areas: steps(0.4, 2, 0.1) },
  { name: 'hatch', text: (p, A) => `Sea water presses on a submarine's hatch with a pressure of ${p} Pa. The hatch has an area of ${A} m².`, ask: 'the force of the water on the hatch', p: [500000, 3000000], pStep: 100000, areas: steps(0.2, 0.6, 0.05) },
  { name: 'mask', text: (p, A) => `Water presses on the glass of a diver's mask with a pressure of ${p} Pa. The glass has an area of ${A} m².`, ask: 'the force of the water on the glass', p: [120000, 400000], pStep: 5000, areas: steps(0.008, 0.02, 0.001) },
  { name: 'cooker valve', text: (p, A) => `The steam in a pressure cooker is at a pressure of ${p} Pa. The safety valve has an area of ${A} m².`, ask: 'the force of the steam on the valve', p: [150000, 250000], pStep: 5000, areas: steps(0.00002, 0.0001, 0.00001) },
]

/**
 * F = pA: written as q6 (2000 Pa on 0.02 m², 40 N, 3 marks). The force is a whole number of
 * newtons; never an area of 0.5 or 2 m² (halving or doubling) or a power of ten, which leaves
 * the pressure's digits, and never a pressure that is a power of ten.
 */
export const forceFromPressure: Generator = {
  id: 'force-from-pressure-and-area',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q6'],
  build(r, slot, turn) {
    const c = PUSHING[turn % PUSHING.length]!
    const [p, A] = follow(r, steps(c.p[0], c.p[1], c.pStep).filter((p) => !powerOfTen(p)), (p) =>
      c.areas.filter((A) => {
        const F = clean(p * A)
        return Number.isInteger(F) && F >= 2 && !powerOfTen(A) && A !== 0.5 && A !== 2 && !powerOfTen(F) && !powerOfTen(F / p) && F !== p
      }),
    )
    const F = clean(p * A)
    const prompt = pick(r, [`${c.text(prose(p), show(A))} Calculate ${c.ask}.`, `${c.text(prose(p), show(A))} Calculate ${c.ask}, in newtons.`])
    // Second route: the force found over the area gives the pressure back.
    return numeric(
      slot,
      {
        prompt,
        solution: `Rearrange $p = \\dfrac{F}{A}$ to ${closes(`F = p A = ${tex(p)} \\times ${tex(A)}`, F, 'N')}`,
        method: ['$F = p A$', `$${tex(p)} \\times ${tex(A)}$`],
        answer: F,
        units: 'N',
      },
      { agrees: near(F / A, p) && Number.isInteger(F), detail: `${F} ÷ ${show(A)} = ${show(F / A)} Pa` },
      { context: c.name, p, A },
    )
  },
}

interface Footed {
  name: string
  text: (A: string, F: string) => string
  /** Area in cm². */
  areas: number[]
  F: [number, number]
  fStep: number
}
/** Small contact areas given in cm², with the forces each really carries. */
const FOOTED: Footed[] = [
  { name: 'chair leg', text: (A, F) => `A chair leg has a square end of area ${A} cm². It presses on the floor with a force of ${F} N.`, areas: steps(4, 25, 1), F: [40, 250], fStep: 5 },
  { name: 'table leg', text: (A, F) => `A table leg has an end of area ${A} cm². It presses on the floor with a force of ${F} N.`, areas: steps(9, 40, 1), F: [100, 400], fStep: 10 },
  { name: 'piano leg', text: (A, F) => `Each leg of a piano rests on the floor on an area of ${A} cm² and carries a force of ${F} N.`, areas: steps(12, 30, 1), F: [500, 1500], fStep: 10 },
  { name: 'heel', text: (A, F) => `The tip of a stiletto heel has an area of ${A} cm². It presses on the floor with a force of ${F} N.`, areas: [1.5, 2, 2.5, 3], F: [200, 450], fStep: 10 },
  { name: 'skate blade', text: (A, F) => `The blade of an ice skate touches the ice over an area of ${A} cm². The skater pushes down on it with a force of ${F} N.`, areas: steps(3, 8, 0.5), F: [400, 800], fStep: 10 },
  { name: 'book', text: (A, F) => `A book lies flat on a table with an area of ${A} cm² in contact. It weighs ${F} N.`, areas: steps(250, 600, 10), F: [4, 20], fStep: 1 },
  { name: 'tripod foot', text: (A, F) => `Each foot of a camera tripod has an area of ${A} cm² on the ground and carries a force of ${F} N.`, areas: steps(1.5, 5, 0.5), F: [10, 40], fStep: 1 },
]

/**
 * p = F ÷ A with the area in cm²: written as q7 (a chair leg, 25 cm², 50 N, 20 000 Pa, 3
 * marks). The area is drawn first and then a force that gives a whole number of pascals;
 * never an area of 1, 10 or 100 cm², a force equal to the area's figure, or a pressure that is
 * a power of ten (380 N on 38 cm² is 100 000 Pa).
 */
export const pressureFromSmallArea: Generator = {
  id: 'pressure-from-an-area-in-square-centimetres',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q7'],
  build(r, slot, turn) {
    const c = FOOTED[turn % FOOTED.length]!
    const [A, F] = follow(
      r,
      c.areas.filter((A) => !powerOfTen(A)),
      (A) => steps(c.F[0], c.F[1], c.fStep).filter((F) => Number.isInteger(clean((F * 10000) / A)) && !powerOfTen(clean((F * 10000) / A)) && clean((F * 10000) / A) !== A && F !== A),
    )
    const Am = clean(A / 10000)
    const p = clean(F / Am)
    const prompt = pick(r, [`${c.text(show(A), prose(F))} Calculate the pressure under it, in pascals.`, `${c.text(show(A), prose(F))} Calculate the pressure it exerts, in Pa.`])
    // Second route: the pressure in N/cm², times the 10 000 cm² in a square metre.
    const viaCm = (F / A) * 10000
    return numeric(
      slot,
      {
        prompt,
        solution: `Convert the area first: $${show(A)}$ cm² $= ${show(A)} \\div 10\\,000 = ${tex(Am)}$ m². Then ${closes(`p = \\dfrac{${tex(F)}}{${tex(Am)}}`, p, 'Pa')} Leaving the area in cm² gives a pressure ten thousand times too small.`,
        method: [`$${show(A)}$ cm² $= ${tex(Am)}$ m²`, `$${tex(F)} \\div ${tex(Am)}$`],
        answer: p,
        units: 'Pa',
      },
      { agrees: near(viaCm, p) && Number.isInteger(p), detail: `${F} ÷ ${show(A)} × 10 000 = ${show(viaCm)} Pa` },
      { context: c.name, A, F },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// p = hρg
// ---------------------------------------------------------------------------------------------

interface Deep {
  name: string
  liquid: Liquid
  /** The prompt's setting with the depth in it. */
  text: (h: string) => string
  depths: number[]
}
/** Fresh water, for q5. */
const FRESH: Deep[] = [
  { name: 'swimming pool', liquid: WATER, text: (h) => `Calculate the pressure due to the water at a depth of ${h} m in a swimming pool.`, depths: steps(1.2, 3.5, 0.1) },
  { name: 'diving pool', liquid: WATER, text: (h) => `A diving pool is ${h} m deep. Calculate the pressure due to the water at the bottom of the pool.`, depths: steps(3, 6, 0.5) },
  { name: 'lake', liquid: WATER, text: (h) => `A diver swims ${h} m below the surface of a lake. Calculate the pressure due to the water on the diver.`, depths: steps(3, 40, 1) },
  { name: 'reservoir', liquid: WATER, text: (h) => `The water behind a dam is ${h} m deep. Calculate the pressure due to the water at the foot of the dam.`, depths: steps(15, 60, 1) },
  { name: 'fish tank', liquid: WATER, text: (h) => `A fish tank is filled with water to a depth of ${h} m. Calculate the pressure due to the water on the bottom of the tank.`, depths: steps(0.2, 0.6, 0.05) },
  { name: 'water tower', liquid: WATER, text: (h) => `The tank of a water tower holds water ${h} m deep. Calculate the pressure due to the water on the floor of the tank.`, depths: steps(2, 9, 0.5) },
]
/** Sea water at 1030 kg/m³, for q10: half-metre depths keep the pressure whole. */
const SALT: Deep[] = [
  { name: 'sea', liquid: SEA, text: (h) => `Calculate the pressure due to the sea water at a depth of ${h} m.`, depths: steps(2, 40, 0.5) },
  { name: 'scuba diver', liquid: SEA, text: (h) => `A scuba diver swims at a depth of ${h} m in the sea. Calculate the pressure due to the sea water on the diver.`, depths: steps(3, 40, 0.5) },
  { name: 'submarine', liquid: SEA, text: (h) => `A submarine cruises at a depth of ${h} m. Calculate the pressure due to the sea water on its hull.`, depths: steps(50, 300, 10) },
  { name: 'harbour', liquid: SEA, text: (h) => `The sea bed in a harbour is ${h} m below the surface. Calculate the pressure due to the sea water on the sea bed.`, depths: steps(4, 20, 0.5) },
  { name: 'free diver', liquid: SEA, text: (h) => `A free diver reaches a depth of ${h} m in the sea. Calculate the pressure due to the sea water on the diver at that depth.`, depths: steps(5, 60, 1) },
]

/** A pressure from p = hρg that prints whole, from a depth that is not a power of ten. */
const atDepth = (h: number, rho: number) => clean(h * rho * G)
const depthsFor = (c: Deep) => c.depths.filter((h) => !powerOfTen(h) && Number.isInteger(atDepth(h, c.liquid.rho)))

/**
 * p = hρg: written as q5 (2 m in a swimming pool, 19 600 Pa, 3 marks) and q10 (10 m of sea
 * water, 100 940 Pa, 3 marks). q5 keeps to fresh water and q10 to sea water at 1030 kg/m³,
 * each with the constants stated as its written prompt states them. Never a depth of 1 or
 * 10 m, whose pressure is ρg with its point moved.
 */
export const pressureAtDepth: Generator = {
  id: 'pressure-at-a-depth',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q5', 'q10'],
  build(r, slot, turn) {
    const sea = slot.id === 'q10'
    const list = sea ? SALT : FRESH
    const c = list[turn % list.length]!
    const h = pick(r, depthsFor(c))
    const rho = c.liquid.rho
    const p = atDepth(h, rho)
    const prompt = sea
      ? pick(r, [`Sea water has a density of 1030 kg/m³. ${c.text(show(h))} $g = 9.8$ N/kg.`, `${c.text(show(h))} Sea water has a density of 1030 kg/m³ and $g = 9.8$ N/kg.`])
      : `${c.text(show(h))} ${c.liquid.stated}`
    const product = `${tex(h)} \\times ${rho} \\times 9.8`
    // Second route: the pressure over ρg gives the depth back.
    return numeric(
      slot,
      {
        prompt,
        solution: closes(`p = h \\rho g = ${product}`, p, 'Pa'),
        method: [sea ? '$p = h \\rho g$' : '$p = h \\rho g$ selected', `$${product}$`],
        answer: p,
        units: 'Pa',
      },
      { agrees: near(p / (rho * G), h) && Number.isInteger(p), detail: `${p} ÷ (${rho} × 9.8) = ${show(p / (rho * G))} m` },
      { context: c.name, h, rho },
    )
  },
}

interface Gauged {
  name: string
  liquid: Liquid
  text: (p: string) => string
  ask: string
  depths: number[]
}
/** A pressure read, and the depth asked for. */
const GAUGED: Gauged[] = [
  { name: 'fresh water', liquid: WATER, text: (p) => `At what depth in fresh water is the pressure due to the water ${p} Pa?`, ask: '', depths: steps(1.5, 40, 0.5) },
  { name: 'lake bed', liquid: WATER, text: (p) => `A pressure sensor on the bed of a lake reads ${p} Pa due to the water above it.`, ask: 'Calculate the depth of the lake at that point, in metres.', depths: steps(2, 40, 1) },
  { name: 'pool', liquid: WATER, text: (p) => `The pressure due to the water at the bottom of a swimming pool is ${p} Pa.`, ask: 'Calculate the depth of the pool, in metres.', depths: steps(1.2, 4, 0.1) },
  { name: 'diver', liquid: SEA, text: (p) => `A diver's gauge shows that the pressure due to the sea water is ${p} Pa.`, ask: "Calculate the diver's depth, in metres.", depths: steps(3, 40, 0.5) },
  { name: 'submarine', liquid: SEA, text: (p) => `The pressure due to the sea water on a submarine's hull is ${p} Pa.`, ask: 'Calculate the depth of the submarine, in metres.', depths: steps(50, 300, 10) },
]

/**
 * h = p ÷ (ρg): written as q9 (49 000 Pa in fresh water, 5 m, 3 marks). The depth is drawn
 * first and the pressure follows; sea-water contexts state 1030 kg/m³.
 */
export const depthFromPressure: Generator = {
  id: 'depth-from-pressure',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q9'],
  build(r, slot, turn) {
    const c = GAUGED[turn % GAUGED.length]!
    const rho = c.liquid.rho
    const h = pick(r, c.depths.filter((h) => !powerOfTen(h) && Number.isInteger(atDepth(h, rho))))
    const p = atDepth(h, rho)
    const rg = clean(rho * G)
    const prompt = c.ask ? `${c.text(prose(p))} ${c.liquid.stated} ${c.ask}` : `${c.text(prose(p))} ${c.liquid.stated}`
    // Second route: forwards, the depth found times ρg.
    return numeric(
      slot,
      {
        prompt,
        solution: `Rearrange $p = h \\rho g$ to ${closes(`h = \\dfrac{p}{\\rho g} = \\dfrac{${tex(p)}}{${rho} \\times 9.8} = \\dfrac{${tex(p)}}{${tex(rg)}}`, h, 'm')}`,
        method: ['$h = p \\div (\\rho g)$', `$${tex(p)} \\div ${tex(rg)}$`],
        answer: h,
        tolerance: dpTolerance(h),
        units: 'm',
      },
      { agrees: near(h * rho * G, p), detail: `${show(h)} × ${rho} × 9.8 = ${show(h * rho * G)} Pa` },
      { context: c.name, p, rho },
    )
  },
}

interface Total {
  name: string
  liquid: Liquid
  surface: string
  who: string
  /** The same, named again: "the diver". */
  the: string
  depths: number[]
}
const TOTALS: Total[] = [
  { name: 'lake diver', liquid: WATER, surface: 'a lake', who: 'a diver', the: 'the diver', depths: steps(3, 40, 1) },
  { name: 'sea diver', liquid: SEA, surface: 'the sea', who: 'a diver', the: 'the diver', depths: steps(3, 40, 0.5) },
  { name: 'diving pool', liquid: WATER, surface: 'a diving pool', who: 'a swimmer', the: 'the swimmer', depths: steps(2, 5, 0.5) },
  { name: 'reservoir sensor', liquid: WATER, surface: 'a reservoir', who: 'a sensor', the: 'the sensor', depths: steps(5, 50, 1) },
  { name: 'submarine', liquid: SEA, surface: 'the sea', who: 'the hull of a submarine', the: "the submarine's hull", depths: steps(20, 200, 10) },
]

/**
 * The water's pressure plus the atmosphere's: written as q11 (15 m in a lake under 101 000
 * Pa, 248 000 Pa, 4 marks). The atmosphere is 101 000 Pa, as written; never a depth of 10 m,
 * where fresh water adds 98 000 Pa and sea water almost exactly one atmosphere.
 */
export const totalPressure: Generator = {
  id: 'total-pressure-with-the-atmosphere',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q11'],
  build(r, slot, turn) {
    const c = TOTALS[turn % TOTALS.length]!
    const rho = c.liquid.rho
    const h = pick(r, c.depths.filter((h) => !powerOfTen(h) && Number.isInteger(atDepth(h, rho))))
    const water = atDepth(h, rho)
    const total = water + ATMOSPHERE
    const prompt = pick(r, [
      `Atmospheric pressure at the surface of ${c.surface} is 101 000 Pa. Calculate the total pressure on ${c.who} at a depth of ${show(h)} m. ${c.liquid.stated}`,
      `${cap(c.who)} is ${show(h)} m below the surface of ${c.surface}, where atmospheric pressure is 101 000 Pa. ${c.liquid.stated} Calculate the total pressure on ${c.the}.`,
    ])
    const product = `${tex(h)} \\times ${rho} \\times 9.8`
    // Second route: the total less the atmosphere, over ρg, is the depth.
    const hBack = (total - ATMOSPHERE) / (rho * G)
    return numeric(
      slot,
      {
        prompt,
        solution: `The water adds $h \\rho g = ${product} = ${tex(water)}$ Pa on top of the atmosphere already pressing on the surface. ${closes(`\\text{Total} = 101\\,000 + ${tex(water)}`, total, 'Pa')} Forgetting the atmosphere loses the last mark.`,
        method: [`$${product}$`, `$${tex(water)}$ Pa from the water`, 'atmospheric pressure added'],
        answer: total,
        units: 'Pa',
      },
      { agrees: near(hBack, h) && Number.isInteger(total), detail: `(${total} − 101 000) ÷ (${rho} × 9.8) = ${show(hBack)} m` },
      { context: c.name, h, rho },
    )
  },
}

interface Moving {
  name: string
  liquid: Liquid
  who: string
  /** "in the sea". */
  where: string
  depths: number[]
}
const MOVING: Moving[] = [
  { name: 'sea diver', liquid: SEA, who: 'A diver', where: 'in the sea', depths: steps(2, 40, 1) },
  { name: 'lake diver', liquid: WATER, who: 'A diver', where: 'in a lake', depths: steps(2, 40, 1) },
  { name: 'submarine', liquid: SEA, who: 'A submarine', where: 'in the sea', depths: steps(20, 300, 10) },
  { name: 'free diver', liquid: SEA, who: 'A free diver', where: 'in the sea', depths: steps(2, 60, 1) },
  { name: 'remote sub', liquid: WATER, who: 'A remote-controlled camera', where: 'in a flooded quarry', depths: steps(2, 50, 1) },
]
/** The density and g as one instruction: "Use density of sea water $= 1030$ kg/m³ and $g = 9.8$ N/kg." */
const use = (l: Liquid) => `Use density of ${l === SEA ? 'sea water' : 'water'} $= ${l.rho}$ kg/m³ and $g = 9.8$ N/kg.`

/**
 * Δp = Δh ρg: written as q14 (5 m to 25 m in sea water, 201 880 Pa, 3 marks). Some go up, so
 * the pressure falls; the answer is the size of the change. The change in depth is drawn
 * first, evenly, then a shallower depth that leaves room for it: drawing the two depths let
 * small changes, which fit in more ways, dominate. Never a change of 1, 10 or 100 m, and never
 * a change equal to the shallower depth (the deeper would be twice it, and the change a depth
 * given).
 */
export const pressureChange: Generator = {
  id: 'pressure-change-between-depths',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q14'],
  build(r, slot, turn) {
    const c = MOVING[turn % MOVING.length]!
    const rho = c.liquid.rho
    const shallowFor = (dh: number) => c.depths.filter((a) => c.depths.includes(clean(a + dh)) && dh !== a)
    const changes = [...new Set(c.depths.flatMap((a) => c.depths.filter((b) => b > a).map((b) => clean(b - a))))].filter(
      (dh) => !powerOfTen(dh) && Number.isInteger(atDepth(dh, rho)),
    )
    const [dh, shallow] = follow(r, changes, shallowFor)
    const deep = clean(shallow + dh)
    const dp = atDepth(dh, rho)
    const down = pick(r, [true, false])
    const [from, to] = down ? [shallow, deep] : [deep, shallow]
    const verb = down ? 'descends' : 'rises'
    const change = down ? 'increase' : 'decrease'
    const what = c.who === 'A submarine' ? 'on its hull' : c.who === 'A remote-controlled camera' ? 'on the camera' : 'on the diver'
    const prompt = `${c.who} ${verb} from ${from} m to ${to} m ${c.where}. ${use(c.liquid)} Calculate the ${change} in pressure ${what}.`
    const product = `${dh} \\times ${rho} \\times 9.8`
    // Second route: the pressure due to the liquid at each depth, one taken from the other.
    const viaEach = atDepth(deep, rho) - atDepth(shallow, rho)
    return numeric(
      slot,
      {
        prompt,
        solution: `Only the change in depth matters: $\\Delta h = ${deep} - ${shallow} = ${dh}$ m. ${closes(`\\Delta p = \\Delta h \\, \\rho g = ${product}`, dp, 'Pa')} Atmospheric pressure is the same at both depths, so it cancels.`,
        method: [`$\\Delta h = ${dh}$ m`, `$${product}$`],
        answer: dp,
        units: 'Pa',
      },
      { agrees: near(viaEach, dp) && Number.isInteger(dp), detail: `${show(atDepth(deep, rho))} − ${show(atDepth(shallow, rho))} = ${show(viaEach)} Pa` },
      { context: c.name, from, to, rho, direction: change },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Upthrust and floating
// ---------------------------------------------------------------------------------------------

interface Block {
  name: string
  /** A cube when it has one side. */
  cube: boolean
  text: (dims: string, d: string) => string
  thing: string
  /** Side lengths in m the block can have. */
  sides: number[]
  /** Decimal places the upthrust may print to. */
  dp: number
}
/**
 * A cube's upthrust is its side cubed times 9800 and nothing else, so cubes need many sides to
 * vary: every 0.05 m (not 0.1) up to 0.6 m, with the upthrust to three decimal places (1.225 N
 * at 0.05 m). Sides in 0.01 m steps would need four: s³ × 9800 has two decimal places only
 * when s is a whole number of tenths.
 */
const CUBE_SIDES = steps(0.05, 0.6, 0.05).filter((s) => s !== 0.1)
const BLOCKS: Block[] = [
  { name: 'cube', cube: true, text: (s, d) => `A cube of side ${s} m is fully submerged in water with its top face ${d} m below the surface.`, thing: 'the cube', sides: CUBE_SIDES, dp: 3 },
  { name: 'sealed box', cube: true, text: (s, d) => `A sealed metal box in the shape of a cube of side ${s} m is held under water, with its top face ${d} m below the surface.`, thing: 'the box', sides: CUBE_SIDES, dp: 3 },
  { name: 'concrete block', cube: false, text: (dims, d) => `A concrete block hangs from a crane cable, fully under water. It is a cuboid ${dims}, with its top face horizontal and ${d} m below the surface.`, thing: 'the block', sides: steps(0.3, 0.8, 0.05), dp: 2 },
  { name: 'rectangular block', cube: false, text: (dims, d) => `A rectangular block is held fully under water with its top face horizontal and ${d} m below the surface. The block is ${dims}.`, thing: 'the block', sides: steps(0.05, 0.5, 0.05).filter((s) => s !== 0.1), dp: 2 },
]
/**
 * The upthrust from the pressures on the top and bottom faces: written as q12 (a cube of side
 * 0.1 m, top 0.2 m down, 9.8 N, 4 marks). Cubes and cuboids in fresh water. Never a height of
 * 0.1 m (the pressure difference would be 980 Pa, g with its point moved), never an upthrust
 * that is 9.8 with its point moved, and never a top face as deep as the block is tall, long or
 * wide. A concrete block on a crane is at least 0.3 m each way.
 */
export const upthrustFromPressures: Generator = {
  id: 'upthrust-from-a-pressure-difference',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q12'],
  build(r, slot, turn) {
    const c = BLOCKS[turn % BLOCKS.length]!
    const { L, W, H, d, F } = draw(
      r,
      (r) => {
        const H = pick(r, c.sides)
        const [L, W] = c.cube ? [H, H] : [pick(r, c.sides), pick(r, c.sides)]
        const d = clean(0.1 * Math.floor(r() * 20 + 1))
        return { L, W, H, d, F: clean(H * L * W * 1000 * G) }
      },
      ({ L, W, H, d, F }) => atMost(F, c.dp) && F >= 1 && !powerOfTen(F / 9.8) && !powerOfTen(d) && !powerOfTen(clean(L * W)) && d !== H && d !== L && d !== W && (c.cube || (L !== W && L !== H && W !== H)),
    )
    const A = clean(L * W)
    const top = atDepth(d, 1000)
    const bottomDepth = clean(d + H)
    const bottom = atDepth(bottomDepth, 1000)
    const diff = clean(bottom - top)
    const V = clean(L * W * H)
    const dims = c.cube ? show(H) : `${show(L)} m by ${show(W)} m across its top face and ${show(H)} m tall`
    const prompt = `${c.text(dims, show(d))} Calculate the upthrust on ${c.thing}. ${WATER.stated}`
    const areaText = c.cube ? `${show(L)} \\times ${show(L)}` : `${show(L)} \\times ${show(W)}`
    // Second route: the weight of the water displaced.
    const displaced = V * 1000 * G
    return numeric(
      slot,
      {
        prompt,
        solution: `Pressure on the top face: $${show(d)} \\times 1000 \\times 9.8 = ${tex(top)}$ Pa. The bottom face is at $${show(bottomDepth)}$ m: $${show(bottomDepth)} \\times 1000 \\times 9.8 = ${tex(bottom)}$ Pa. The difference, $${tex(diff)}$ Pa, acts on a face of area $${areaText} = ${tex(A)}$ m²: ${closes(`F = ${tex(diff)} \\times ${tex(A)}`, F, 'N').slice(0, -1)} upwards. Check: ${c.thing} displaces $${tex(V)}$ m³ of water, which weighs $${tex(V)} \\times 1000 \\times 9.8 = ${show(displaced)}$ N. Upthrust equals the weight of fluid displaced.`,
        method: [`pressure at the top, ${prose(top)} Pa, and at the bottom, ${prose(bottom)} Pa`, `difference ${prose(diff)} Pa`, `$F = p A$ with $A = ${tex(A)}$ m²`],
        answer: F,
        tolerance: dpTolerance(F),
        units: 'N',
      },
      { agrees: near(displaced, F), detail: `${show(V)} m³ × 1000 × 9.8 = ${show(displaced)} N` },
      { context: c.name, L, W, H, d },
    )
  },
}

interface Submerged {
  name: string
  /** "A steel block" or "A plastic ball". */
  noun: string
  /** Weight over upthrust: the object's density over water's. */
  ratio: [number, number]
  /** Upthrust range in newtons. */
  U: [number, number]
  /** What follows from the resultant. */
  then: string
}
const SUBMERGED: Submerged[] = [
  { name: 'steel', noun: 'steel block', ratio: [7.6, 8], U: [1, 6], then: 'so the block sinks. It would float only if the upthrust could reach its weight.' },
  { name: 'aluminium', noun: 'block of aluminium', ratio: [2.6, 2.8], U: [2, 15], then: 'so the block sinks. It would float only if the upthrust could reach its weight.' },
  { name: 'stone', noun: 'stone', ratio: [2.4, 2.8], U: [1, 10], then: 'so the stone sinks. It would float only if the upthrust could reach its weight.' },
  { name: 'brick', noun: 'brick', ratio: [1.8, 2], U: [8, 12], then: 'so the brick sinks. It would float only if the upthrust could reach its weight.' },
  { name: 'tin of sand', noun: 'sealed tin part-filled with sand', ratio: [1.1, 1.4], U: [5, 15], then: 'so the tin sinks, slowly. It would float only if the upthrust could reach its weight.' },
  { name: 'wood', noun: 'block of wood', ratio: [0.5, 0.7], U: [5, 20], then: 'so the block rises. It floats with part of it above the surface, where the upthrust has fallen to equal its weight.' },
  { name: 'ball', noun: 'plastic ball', ratio: [0.05, 0.2], U: [5, 30], then: 'so the ball shoots up. It floats with most of it above the surface, where the upthrust has fallen to equal its weight.' },
  { name: 'ice', noun: 'block of ice', ratio: [0.9, 0.92], U: [10, 40], then: 'so the ice rises. It floats with about a tenth of it above the surface, where the upthrust has fallen to equal its weight.' },
]
const an = (noun: string) => `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`

/**
 * The resultant of the weight and the upthrust: written as q13 (a block weighing 12 N with
 * 9.8 N of upthrust, 2.2 N downwards, 3 marks). The upthrust is drawn first, to a tenth of a
 * newton, then a weight to a tenth inside the ratio the material really has: steel weighs
 * about 7.8 times the water it displaces, wood about 0.6. Things lighter than water are let
 * go under the surface and the resultant is upwards.
 */
export const resultantWithUpthrust: Generator = {
  id: 'resultant-of-weight-and-upthrust',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q13'],
  build(r, slot, turn) {
    const c = SUBMERGED[turn % SUBMERGED.length]!
    const [U, W] = follow(r, steps(c.U[0], c.U[1], 0.1).filter((U) => !powerOfTen(U)), (U) =>
      steps(Math.max(0.1, Math.ceil(U * c.ratio[0] * 10) / 10), Math.floor(U * c.ratio[1] * 10) / 10, 0.1).filter((W) => {
        const R = clean(Math.abs(W - U))
        return W !== U && R >= 0.1 && R !== U && R !== W && W / U >= c.ratio[0] && W / U <= c.ratio[1]
      }),
    )
    const R = clean(Math.abs(W - U))
    const up = U > W
    const direction = up ? 'upwards' : 'downwards'
    const [big, small] = up ? [U, W] : [W, U]
    const thing = c.noun.split(' ')[0] === 'sealed' ? 'tin' : c.noun.includes('block') ? 'block' : c.noun.split(' ').at(-1)!
    const prompt = up
      ? pick(r, [
          `${cap(an(c.noun))} weighing ${show(W)} N is held fully under water and then let go. The upthrust on it is ${show(U)} N. Calculate the resultant force on the ${thing} as it is let go.`,
          `${cap(an(c.noun))} weighs ${show(W)} N. It is pushed fully under water, where the upthrust on it is ${show(U)} N, and released. Calculate the resultant force on the ${thing} at the moment it is released.`,
        ])
      : pick(r, [
          `${cap(an(c.noun))} weighs ${show(W)} N. When it is fully submerged in water the upthrust on it is ${show(U)} N. Calculate the resultant force on the ${thing}.`,
          `${cap(an(c.noun))} weighing ${show(W)} N is lowered into water until it is fully submerged. The upthrust on it is then ${show(U)} N. Calculate the resultant force on the ${thing}.`,
        ])
    // Second route: the weight and the resultant together give the upthrust back.
    const uBack = up ? W + R : W - R
    return numeric(
      slot,
      {
        prompt,
        solution: `Weight acts down, upthrust acts up. Resultant $= ${show(big)} - ${show(small)} = ${show(R)}$ N ${direction}, ${c.then}`,
        method: ['weight and upthrust identified as opposite', `$${show(big)} - ${show(small)}$`],
        answer: R,
        tolerance: dpTolerance(R),
        units: 'N',
        line: `${show(R)} N ${direction}`,
      },
      { agrees: near(uBack, U), detail: `${show(W)} ${up ? '+' : '−'} ${show(R)} = ${show(uBack)} N` },
      { context: c.name, W, U, direction },
    )
  },
}

interface Standing {
  /** The pressure's owner in the method line: "elephant", "heel". */
  label: string
  /** The sentence giving the weight and the area of each part. */
  text: (W: string, a: string) => string
  /** "under the heels". */
  under: string
  /** "Heels" in the solution. */
  short: string
  W: [number, number]
  wStep: number
  parts: number
  areas: number[]
}
interface Comparison {
  name: string
  /** The side with the greater pressure. */
  high: Standing
  low: Standing
  moral: string
}
const COMPARISONS: Comparison[] = [
  {
    name: 'heels and elephant',
    high: { label: 'heel', short: 'Heels', text: (W, a) => `A person weighs ${W} N and stands on two stiletto heels, each of area ${a} m².`, under: 'under the heels', W: [450, 800], wStep: 10, parts: 2, areas: [0.0001, 0.00012, 0.00015, 0.0002] },
    low: { label: 'elephant', short: 'Elephant', text: (W, a) => `An elephant weighs ${W} N and stands on four feet, each of area ${a} m².`, under: "under the elephant's feet", W: [30000, 60000], wStep: 1000, parts: 4, areas: steps(0.04, 0.1, 0.01) },
    moral: 'The much smaller force wins because the area is smaller by far more.',
  },
  {
    name: 'boots and skis',
    high: { label: 'boot', short: 'Boots', text: (W, a) => `A walker weighs ${W} N and stands in two boots, each with an area of ${a} m² on the snow.`, under: "under the walker's boots", W: [500, 900], wStep: 10, parts: 2, areas: steps(0.02, 0.04, 0.005) },
    low: { label: 'ski', short: 'Skis', text: (W, a) => `A skier weighs ${W} N and stands on two skis, each with an area of ${a} m² on the snow.`, under: "under the skier's skis", W: [500, 900], wStep: 10, parts: 2, areas: steps(0.15, 0.25, 0.01) },
    moral: 'Skis spread the weight over a far larger area, which is why the skier does not sink into the snow.',
  },
  {
    name: 'car and tractor',
    high: { label: 'car', short: 'Car', text: (W, a) => `A car weighs ${W} N and rests on four tyres, each touching the ground over ${a} m².`, under: "under the car's tyres", W: [9000, 16000], wStep: 100, parts: 4, areas: steps(0.012, 0.02, 0.001) },
    low: { label: 'tractor', short: 'Tractor', text: (W, a) => `A tractor weighs ${W} N and rests on four wide tyres, each touching the ground over ${a} m².`, under: "under the tractor's tyres", W: [40000, 80000], wStep: 1000, parts: 4, areas: steps(0.15, 0.3, 0.01) },
    moral: 'The tractor is far heavier but its wide tyres spread the weight, so it sinks less into a soft field.',
  },
  {
    name: 'skates and snowshoes',
    high: { label: 'skate', short: 'Skates', text: (W, a) => `An ice skater weighs ${W} N and stands on two blades, each touching the ice over ${a} m².`, under: "under the skater's blades", W: [400, 700], wStep: 10, parts: 2, areas: [0.0003, 0.0004, 0.0005, 0.0006] },
    low: { label: 'snowshoe', short: 'Snowshoes', text: (W, a) => `A walker weighs ${W} N and stands on two snowshoes, each of area ${a} m².`, under: "under the walker's snowshoes", W: [500, 900], wStep: 10, parts: 2, areas: steps(0.08, 0.15, 0.01) },
    moral: 'The narrow blades concentrate the weight onto a tiny area; snowshoes spread it out.',
  },
  {
    name: 'horse and camel',
    high: { label: 'horse', short: 'Horse', text: (W, a) => `A horse weighs ${W} N and stands on four hooves, each of area ${a} m².`, under: "under the horse's hooves", W: [4000, 6000], wStep: 100, parts: 4, areas: steps(0.01, 0.015, 0.001) },
    low: { label: 'camel', short: 'Camel', text: (W, a) => `A camel weighs ${W} N and stands on four wide, padded feet, each of area ${a} m².`, under: "under the camel's feet", W: [4000, 6500], wStep: 100, parts: 4, areas: steps(0.03, 0.05, 0.002) },
    moral: "The camel's wide feet spread its weight, which is why it does not sink into soft sand.",
  },
]
const WORDS: Record<number, string> = { 2: 'two', 4: 'four' }

/** A weight from the side's range whose pressure on the side's total area is whole, and accepted by `ok`. */
function stood(r: Rng, s: Standing, ok: (p: number, W: number) => boolean) {
  const a = pick(r, s.areas)
  const total = clean(s.parts * a)
  const Ws = steps(s.W[0], s.W[1], s.wStep).filter((W) => Number.isInteger(clean(W / total)) && ok(clean(W / total), W))
  if (!Ws.length) return null
  const W = pick(r, Ws)
  return { a, total, W, p: clean(W / total) }
}

/**
 * The ratio of two pressures: written as q15 (an elephant on four feet and a person on two
 * stiletto heels, 15 times, 4 marks). Each pressure is a whole number of pascals and the
 * ratio is a whole number from 2 to 1000, never 10, 100 or 1000.
 */
export const comparingPressures: Generator = {
  id: 'comparing-pressures',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q15'],
  build(r, slot, turn) {
    const c = COMPARISONS[turn % COMPARISONS.length]!
    const { lo, hi } = draw(
      r,
      (r) => {
        const lo = stood(r, c.low, () => true)
        if (!lo) return null
        const hi = stood(r, c.high, (p, W) => W !== lo.W && p > lo.p && Number.isInteger(clean(p / lo.p)) && !powerOfTen(p / lo.p) && p / lo.p <= 1000)
        return hi ? { lo, hi } : null
      },
      (x) => x !== null,
    )!
    const { p: pLo } = lo
    const { p: pHi } = hi
    const ratio = clean(pHi / pLo)
    const sentences = [c.low.text(prose(lo.W), show(lo.a)), c.high.text(prose(hi.W), show(hi.a))]
    const prompt = `${pick(r, [sentences.join(' '), [...sentences].reverse().join(' ')])} How many times greater is the pressure ${c.high.under} than ${c.low.under}?`
    const side = (s: Standing, x: { a: number; total: number; W: number }, p: number) =>
      `${s.short}: total area $${s.parts} \\times ${tex(x.a)} = ${tex(x.total)}$ m², so $p = ${tex(x.W)} \\div ${tex(x.total)} = ${tex(p)}$ Pa.`
    // Second route: the ratio of the weights times the inverse ratio of the areas.
    const viaRatios = (hi.W / lo.W) * (lo.total / hi.total)
    return numeric(
      slot,
      {
        prompt,
        solution: `${side(c.low, lo, pLo)} ${side(c.high, hi, pHi)} Ratio $= ${tex(pHi)} \\div ${tex(pLo)} = ${ratio}$. ${c.moral}`,
        method: [`${c.low.label} pressure $= ${tex(lo.W)} \\div ${tex(lo.total)} = ${tex(pLo)}$ Pa`, `${c.high.label} pressure $= ${tex(hi.W)} \\div ${tex(hi.total)} = ${tex(pHi)}$ Pa`, 'ratio of the two pressures'],
        answer: ratio,
      },
      { agrees: near(viaRatios, ratio) && Number.isInteger(ratio) && ratio >= 2, detail: `(${hi.W} ÷ ${lo.W}) × (${show(lo.total)} ÷ ${show(hi.total)}) = ${show(viaRatios)}` },
      { context: c.name, Wlo: lo.W, alo: lo.a, Whi: hi.W, ahi: hi.a, parts: `${WORDS[c.low.parts]}/${WORDS[c.high.parts]}` },
    )
  },
}

interface Floater {
  name: string
  liquid: Liquid
  /** The sentence with the mass in it. */
  text: (m: string) => string
  /** For fresh water, masses; for sea water, displaced volumes, so the mass is 1030 times one. */
  m?: number[]
  V?: number[]
  water: string
}
const FLOATERS: Floater[] = [
  { name: 'rowing boat', liquid: WATER, text: (m) => `A rowing boat of mass ${m} kg floats on a lake.`, m: steps(150, 600, 10), water: 'water' },
  { name: 'yacht', liquid: SEA, text: (m) => `A yacht of mass ${m} kg floats in the sea.`, V: steps(2, 6, 0.1), water: 'sea water' },
  { name: 'canoe', liquid: WATER, text: (m) => `A canoe and paddler with a total mass of ${m} kg float on a river.`, m: steps(100, 250, 5), water: 'water' },
  { name: 'fishing boat', liquid: SEA, text: (m) => `A fishing boat of mass ${m} kg floats in a harbour.`, V: steps(5, 20, 0.5), water: 'sea water' },
  { name: 'narrowboat', liquid: WATER, text: (m) => `A narrowboat of mass ${m} kg floats on a canal.`, m: steps(12000, 20000, 500), water: 'water' },
  { name: 'buoy', liquid: SEA, text: (m) => `A marker buoy of mass ${m} kg floats in the sea.`, V: steps(0.2, 0.9, 0.1), water: 'sea water' },
  { name: 'log', liquid: WATER, text: (m) => `A log of mass ${m} kg floats down a river.`, m: steps(50, 400, 10), water: 'water' },
]

/**
 * Floating: upthrust equals weight, so the displaced water's mass is the object's own, and
 * V = m ÷ ρ: written as q18 (a 500 kg boat on fresh water, 0.5 m³, 4 marks). Fresh water
 * alternates with sea water at 1030 kg/m³, so dividing by the density is a step and not only
 * a shift of the point; sea-water masses are 1030 times a displaced volume to a tenth.
 */
export const displacedVolume: Generator = {
  id: 'displaced-volume-when-floating',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q18'],
  build(r, slot, turn) {
    const c = FLOATERS[turn % FLOATERS.length]!
    const rho = c.liquid.rho
    const { m, V } = draw(
      r,
      (r) => {
        if (c.V) {
          const V = pick(r, c.V)
          return { m: clean(V * rho), V }
        }
        const m = pick(r, c.m!)
        return { m, V: clean(m / rho) }
      },
      ({ m, V }) => !powerOfTen(V) && Number.isInteger(m),
    )
    const W = clean(m * G)
    const plural = c.name === 'canoe'
    const it = plural ? 'they displace' : 'it displaces'
    const prompt = `${c.text(prose(m))} Calculate the volume of ${c.water} ${it}. ${c.liquid.stated}`
    // Second route: forwards, the displaced volume times ρg is the weight.
    const forward = V * rho * G
    return numeric(
      slot,
      {
        prompt,
        solution: `Floating means the upthrust equals the weight. Weight $= ${tex(m)} \\times 9.8 = ${tex(W)}$ N, so the upthrust is ${prose(W)} N, which is the weight of the ${c.water} displaced. Mass of ${c.water} displaced $= ${tex(W)} \\div 9.8 = ${tex(m)}$ kg, and its volume $= ${tex(m)} \\div ${rho} = ${show(V)}$ m³. A floating object always displaces its own mass of ${c.water}.`,
        method: ['floating means upthrust $=$ weight', `weight $= ${tex(m)} \\times 9.8 = ${tex(W)}$ N, so ${prose(m)} kg of ${c.water} displaced`, 'volume $=$ mass $\\div$ density'],
        answer: V,
        tolerance: dpTolerance(V),
        units: 'm³',
      },
      { agrees: near(forward, W), detail: `${show(V)} × ${rho} × 9.8 = ${show(forward)} N` },
      { context: c.name, m, rho },
    )
  },
}

export const pressureGenerators: Generator[] = [
  pressureFromForce,
  forceFromPressure,
  pressureFromSmallArea,
  pressureAtDepth,
  depthFromPressure,
  totalPressure,
  pressureChange,
  upthrustFromPressures,
  resultantWithUpthrust,
  comparingPressures,
  displacedVolume,
]
