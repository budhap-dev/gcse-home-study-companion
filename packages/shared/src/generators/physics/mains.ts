import { show } from '../format.ts'
import { draw, pick, type Rng } from '../random.ts'
import type { Generator } from '../types.ts'
import { atMost, cap, closes, figures, near, numeric, prose, tex } from './build.ts'
import { dpTolerance, sigText } from './format.ts'

/**
 * Mains electricity and electromagnetic devices (AQA 8463, topics 2.3 and 7): P = VI on the
 * 230 V mains, P = I²R, F = BIl, transformers and the alternator. Every numeric written
 * question in the two topics that is a calculation has a generator here. Two are not: the
 * mains pd (230 V) and the earth wire's potential (0 V) are facts to recall, so they keep
 * their written questions.
 *
 * Mains is 230 V as the written questions give it, appliances draw the currents their real
 * powers need, and each context carries its own ranges.
 */
const MAINS = 'mains-electricity'
const DEVICES = 'electromagnetic-devices'
/** The UK mains pd as the written questions state it. */
const MAINS_V = 230

const clean = (x: number) => Number(show(x))
const an = (noun: string) => `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`
/** lo, lo + step, … hi, free of binary residue. */
const range = (lo: number, hi: number, step = 1) => Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => clean(lo + i * step))

/** x is a power of ten: 1, 10, 0.001, 10 000 000. */
const isTen = (x: number) => {
  const l = Math.log10(Math.abs(x))
  return Number.isFinite(l) && Math.abs(l - Math.round(l)) < 1e-9
}
/** a and b are the same figure, or the same digits with the point moved. */
const tenfold = (a: number, b: number) => isTen(a / b)
/** No two figures the same, or the same with the point moved. */
const distinct = (...xs: number[]) => xs.every((x, i) => xs.slice(i + 1).every((y) => !tenfold(x, y)))
/** An answer that is none of the givens, nor one with the point moved, doubled or halved. */
const clear = (answer: number, ...givens: number[]) => givens.every((g) => !tenfold(answer, g) && !near(answer, 2 * g) && !near(2 * answer, g))
/** Multiplying or dividing by 1 is no step, and by 10 or 0.1 only moves the point. */
const noTens = (...xs: number[]) => xs.every((x) => !isTen(x))
/**
 * Figures to be multiplied whose product is not their sum, pair by pair and all together:
 * 2 × 2 is 2 + 2, so a student who doubled instead of squaring would be marked right.
 */
const noSum = (...xs: number[]) =>
  !near(
    xs.reduce((a, b) => a * b, 1),
    xs.reduce((a, b) => a + b, 0),
  ) && xs.every((x, i) => xs.slice(i + 1).every((y) => !near(x * y, x + y)))

// ---------------------------------------------------------------------------------------------
// Mains electricity
// ---------------------------------------------------------------------------------------------

interface Appliance {
  name: string
  /** The powers the appliance really has, in watts. */
  watts: [number, number]
  /** The current's step: a television draws well under an amp, so it goes to 0.01 A. */
  step?: number
}
const APPLIANCES: Appliance[] = [
  { name: 'kettle', watts: [2000, 3000] },
  { name: 'toaster', watts: [800, 1500] },
  { name: 'hairdryer', watts: [1000, 2200] },
  { name: 'microwave oven', watts: [1000, 1500] },
  { name: 'vacuum cleaner', watts: [500, 1600] },
  { name: 'television', watts: [50, 200], step: 0.01 },
  { name: 'fan heater', watts: [1500, 3000] },
  { name: 'iron', watts: [1200, 2800] },
]

/**
 * A current to the tenth of an amp that gives the appliance a power in its range. The current
 * is drawn first, so the power is a whole number of watts (230 × 0.1 is 23) and spread evenly.
 * Never 1 A or 10 A, which would print the power as 230 with the point moved.
 */
function mainsCurrent(r: Rng, a: Appliance): { I: number; P: number } {
  const step = a.step ?? 0.1
  const currents = range(step, 13, step).filter((I) => MAINS_V * I >= a.watts[0] && MAINS_V * I <= a.watts[1])
  return draw(
    r,
    (r) => {
      const I = pick(r, currents)
      return { I, P: clean(MAINS_V * I) }
    },
    ({ I, P }) => noTens(I) && distinct(I, MAINS_V) && clear(P, I, MAINS_V),
  )
}

/** P = VI on the mains: written as q5 (9 A from the 230 V mains, 2 marks). */
export const mainsPowerFromCurrent: Generator = {
  id: 'mains-power-from-current',
  subjectId: 'physics',
  topicId: MAINS,
  replaces: ['q5'],
  build(r, slot, turn) {
    const a = APPLIANCES[turn % APPLIANCES.length]!
    const { I, P } = mainsCurrent(r, a)
    const prompt = pick(r, [
      `${cap(an(a.name))} draws ${show(I)} A from the 230 V mains. Calculate its power, in watts.`,
      `${cap(an(a.name))} runs from the 230 V mains and draws a current of ${show(I)} A. Calculate its power, in watts.`,
    ])
    return numeric(
      slot,
      { prompt, solution: closes(`P = V I = 230 \\times ${show(I)}`, P, 'W'), method: [`$P = V I = 230 \\times ${show(I)}$`], answer: P, tolerance: dpTolerance(P), units: 'W' },
      // Second route: the power over the mains pd gives back the current.
      { agrees: near(P / MAINS_V, I) && atMost(P, 1), detail: `${P} ÷ 230 = ${show(P / MAINS_V)} A` },
      { context: a.name, I },
    )
  },
}

/** I = P ÷ V on the mains: written as q6 (a 920 W appliance, 2 marks). */
export const mainsCurrentFromPower: Generator = {
  id: 'mains-current-from-power',
  subjectId: 'physics',
  topicId: MAINS,
  replaces: ['q6'],
  build(r, slot, turn) {
    const a = APPLIANCES[turn % APPLIANCES.length]!
    const { I, P } = mainsCurrent(r, a)
    // "Rated at 920 W" rather than "a 920 W kettle": the article cannot be chosen from the digits.
    const prompt = pick(r, [
      `${cap(an(a.name))} rated at ${prose(P)} W runs from the 230 V mains. Calculate the current it draws, in amperes.`,
      `${cap(an(a.name))} has a power of ${prose(P)} W on the 230 V mains. Calculate the current it draws, in amperes.`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: closes(`I = P \\div V = ${tex(P)} \\div 230`, I, 'A'),
        method: [`rearranges to $I = P \\div V$: $${tex(P)} \\div 230$`],
        answer: I,
        tolerance: dpTolerance(I),
        units: 'A',
      },
      { agrees: near(I * MAINS_V, P), detail: `${I} × 230 = ${show(I * MAINS_V)} W` },
      { context: a.name, P },
    )
  },
}

interface Heated {
  name: string
  /** "A heater of resistance 10 Ω carries 4 A." */
  text: (R: string, I: string) => string
  /** "its power" */
  ask: string
  ohms: [number, number, number]
  amps: [number, number, number]
  /** The pd I × R must land in, so a mains heater is on 230 V and a car's on 12 V. */
  volts?: [number, number]
}
const HEATED: Heated[] = [
  { name: 'heater', text: (R, I) => `A heater of resistance ${R} Ω carries ${I} A.`, ask: 'its power', ohms: [18, 53, 1], amps: [4, 13, 0.1], volts: [225, 235] },
  {
    name: 'kettle element',
    text: (R, I) => `The heating element of a kettle has a resistance of ${R} Ω and carries ${I} A.`,
    ask: 'its power',
    ohms: [18, 26, 0.5],
    amps: [8.5, 13, 0.1],
    volts: [225, 235],
  },
  {
    name: "car's rear-window heater",
    text: (R, I) => `A car's rear-window heater has a resistance of ${R} Ω and carries ${I} A.`,
    ask: 'its power',
    ohms: [1, 3, 0.1],
    amps: [4, 12, 0.5],
    volts: [11, 14.5],
  },
  {
    name: 'school experiment heater',
    text: (R, I) => `A heater used in a school experiment has a resistance of ${R} Ω and carries ${I} A.`,
    ask: 'its power',
    ohms: [2, 12, 0.5],
    amps: [1, 6, 0.5],
    volts: [6, 12],
  },
  {
    name: 'extension lead',
    text: (R, I) => `The wires of an extension lead have a total resistance of ${R} Ω and carry ${I} A.`,
    ask: 'the power transferred by heating in them',
    ohms: [0.1, 0.5, 0.05],
    amps: [3, 13, 0.5],
  },
  { name: 'resistor', text: (R, I) => `A resistor of ${R} Ω carries ${I} A.`, ask: 'its power', ohms: [2, 100, 1], amps: [0.1, 1, 0.05], volts: [1.5, 12] },
]

/** Every (R, I) a context allows whose power has at most one decimal place and no coincidence. */
function heatedPairs(h: Heated): { R: number; I: number; P: number }[] {
  const out: { R: number; I: number; P: number }[] = []
  for (const R of range(...h.ohms)) {
    for (const I of range(...h.amps)) {
      const V = R * I
      if (h.volts && (V < h.volts[0] || V > h.volts[1])) continue
      const P = clean(I * I * R)
      if (atMost(P, 1) && distinct(R, I) && noTens(R, I) && noSum(I, I, R) && clear(P, R, I)) out.push({ R, I, P })
    }
  }
  return out
}
const HEATED_PAIRS = new Map<string, { answers: number[]; pairs: ReturnType<typeof heatedPairs> }>()
/** A context's pairs and the powers they give, so a power is drawn evenly before a pair that gives it. */
function pairsFor(h: Heated) {
  let pool = HEATED_PAIRS.get(h.name)
  if (!pool) {
    const pairs = heatedPairs(h)
    pool = { answers: [...new Set(pairs.map((p) => p.P))], pairs }
    HEATED_PAIRS.set(h.name, pool)
  }
  return pool
}

/** P = I²R: written as q9 (a heater of 10 Ω carrying 4 A, 2 marks). */
export const powerFromCurrentAndResistance: Generator = {
  id: 'power-from-current-and-resistance',
  subjectId: 'physics',
  topicId: MAINS,
  replaces: ['q9'],
  build(r, slot, turn) {
    const h = HEATED[turn % HEATED.length]!
    const pool = pairsFor(h)
    const power = pick(r, pool.answers)
    const { R, I, P } = pick(
      r,
      pool.pairs.filter((p) => p.P === power),
    )
    const prompt = `${h.text(show(R), show(I))} ${pick(r, [`Calculate ${h.ask}, in watts.`, `What is ${h.ask}, in watts?`])}`
    const sq = clean(I * I)
    return numeric(
      slot,
      {
        prompt,
        solution: `${closes(`P = I^2 R = ${tex(I)}^2 \\times ${tex(R)} = ${tex(sq)} \\times ${tex(R)}`, P, 'W')} Square the current first.`,
        method: [`squares the current then multiplies by $R$: $${tex(I)}^2 \\times ${tex(R)}$`],
        answer: P,
        tolerance: dpTolerance(P),
        units: 'W',
      },
      // Second route: the pd across it, V = IR, times the current.
      { agrees: near(I * R * I, P), detail: `(${I} × ${R}) × ${I} = ${show(I * R * I)} W` },
      { context: h.name, R, I },
    )
  },
}

interface CurrentChange {
  c: number
  verb: string
  gerund: string
  /** What the power becomes. */
  times: string
}
const CURRENT_CHANGES: CurrentChange[] = [
  { c: 2, verb: 'doubles', gerund: 'doubling', times: 'four times larger' },
  { c: 3, verb: 'triples', gerund: 'tripling', times: 'nine times larger' },
  { c: 0.5, verb: 'halves', gerund: 'halving', times: 'a quarter of what it was' },
]
interface Carrier {
  name: string
  /** "a heating element", "the wires of an extension lead" */
  what: string
  plural?: boolean
  ohms: [number, number, number]
  /** The larger of the two currents. */
  amps: [number, number, number]
}
const CARRIERS: Carrier[] = [
  { name: 'heating element', what: 'a heating element', ohms: [5, 20, 1], amps: [1, 6, 0.5] },
  { name: 'resistor', what: 'a resistor', ohms: [10, 100, 5], amps: [0.2, 1, 0.05] },
  { name: 'extension lead', what: 'the wires of an extension lead', plural: true, ohms: [0.1, 0.4, 0.05], amps: [4, 13, 1] },
]

/**
 * The effect of squaring the current: written as q14 (4 A doubled to 8 A through 10 Ω, 3
 * marks, no units). The current doubles, triples or halves, and the solution sets the right
 * power beside the one a student who forgot to square would give.
 */
export const powerAfterCurrentChange: Generator = {
  id: 'power-after-current-change',
  subjectId: 'physics',
  topicId: MAINS,
  replaces: ['q14'],
  build(r, slot, turn) {
    const k = CARRIERS[turn % CARRIERS.length]!
    const { ch, R, I1, I2, P1, P2 } = draw(
      r,
      (r) => {
        const ch = pick(r, CURRENT_CHANGES)
        const R = pick(r, range(...k.ohms))
        // The larger current from the range; the smaller one is it divided by the change.
        const high = pick(r, range(...k.amps))
        const low = clean(high / (ch.c > 1 ? ch.c : 1 / ch.c))
        const [I1, I2] = ch.c > 1 ? [low, high] : [high, low]
        return { ch, R, I1, I2, P1: clean(I1 * I1 * R), P2: clean(I2 * I2 * R) }
      },
      ({ R, I1, I2, P1, P2 }) => atMost(I1, 2) && atMost(I2, 2) && atMost(P1, 1) && atMost(P2, 1) && noTens(R, I1, I2) && noSum(I2, I2, R) && distinct(R, I1) && distinct(R, I2) && clear(P2, R, I1, I2) && clear(P1, R),
    )
    const wrong = clean(P1 * ch.c)
    const subject = cap(k.what)
    const prompt = pick(r, [
      `The current through ${k.what} ${ch.verb} from ${show(I1)} A to ${show(I2)} A, with resistance unchanged at ${show(R)} Ω. What is the new power, in watts?`,
      `${subject} ${k.plural ? 'have' : 'has'} a resistance of ${show(R)} Ω, which stays the same. The current through ${k.plural ? 'them' : 'it'} ${ch.verb} from ${show(I1)} A to ${show(I2)} A. What is the new power, in watts?`,
    ])
    const sq = clean(I2 * I2)
    return numeric(
      slot,
      {
        prompt,
        solution: `${closes(`P = I^2 R = ${tex(I2)}^2 \\times ${tex(R)} = ${tex(sq)} \\times ${tex(R)}`, P2, 'W').slice(0, -1)}. Because the current is **squared**, ${ch.gerund} it makes the power **${ch.times}**: ${prose(P1)} W becomes ${prose(P2)} W, not ${prose(wrong)} W.`,
        method: [`squares the new current: $${tex(I2)}^2 = ${tex(sq)}$`, `multiplies by $R$: $${tex(sq)} \\times ${tex(R)}$`],
        answer: P2,
        tolerance: dpTolerance(P2),
      },
      // Second route: the old power times the change squared.
      { agrees: near(P1 * ch.c * ch.c, P2), detail: `${P1} × ${ch.c}² = ${show(P1 * ch.c * ch.c)} W` },
      { context: k.name, R, I1, I2 },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Electromagnetic devices
// ---------------------------------------------------------------------------------------------

interface Field {
  name: string
  text: (l: string, I: string, B: string) => string
  tesla: [number, number, number]
  amps: [number, number, number]
  metres: [number, number, number]
}
/** Wires in fields, with the flux densities, currents and lengths each really has. */
const FIELDS: Field[] = [
  {
    name: 'wire',
    text: (l, I, B) => `A wire of length ${l} m carries ${I} A at right angles to a magnetic field of ${B} T.`,
    tesla: [0.05, 0.5, 0.05],
    amps: [1, 6, 0.5],
    metres: [0.05, 0.5, 0.05],
  },
  {
    name: 'motor coil',
    text: (l, I, B) => `One side of the coil in an electric motor is ${l} m long. It carries ${I} A at right angles to a magnetic field of ${B} T.`,
    tesla: [0.1, 0.8, 0.05],
    amps: [0.5, 5, 0.5],
    metres: [0.02, 0.2, 0.01],
  },
  {
    name: 'loudspeaker',
    text: (l, I, B) => `The coil of a loudspeaker has ${l} m of wire at right angles to a magnetic field of ${B} T. It carries a current of ${I} A.`,
    tesla: [0.5, 1.5, 0.1],
    amps: [0.1, 2, 0.1],
    metres: [2, 10, 0.5],
  },
  {
    name: 'copper rod',
    text: (l, I, B) => `A copper rod rests across two rails between the poles of a magnet. A length of ${l} m of it is in the field of ${B} T, at right angles to it, and it carries ${I} A.`,
    tesla: [0.05, 0.3, 0.05],
    amps: [1, 8, 0.5],
    metres: [0.05, 0.15, 0.01],
  },
]

/** F = BIl: written as q3 (0.5 m, 4 A, 0.15 T, 2 marks). */
export const forceOnAWire: Generator = {
  id: 'force-on-a-current-carrying-wire',
  subjectId: 'physics',
  topicId: DEVICES,
  replaces: ['q3'],
  build(r, slot, turn) {
    const f = FIELDS[turn % FIELDS.length]!
    const { B, I, l, F } = draw(
      r,
      (r) => {
        const B = pick(r, range(...f.tesla))
        const I = pick(r, range(...f.amps))
        const l = pick(r, range(...f.metres))
        return { B, I, l, F: clean(B * I * l) }
      },
      ({ B, I, l, F }) => F >= 0.01 && atMost(F, 3) && figures(F) <= 3 && noTens(B, I, l) && noSum(B, I, l) && distinct(B, I, l) && clear(F, B, I, l),
    )
    const prompt = `${f.text(show(l), show(I), show(B))} ${pick(r, ['Calculate the force on it, in newtons.', 'What is the size of the force on it, in newtons?'])}`
    const expr = `F = B I l = ${tex(B)} \\times ${tex(I)} \\times ${tex(l)}`
    return numeric(
      slot,
      { prompt, solution: closes(expr, F, 'N'), method: [`$${expr}$`], answer: F, tolerance: dpTolerance(F), units: 'N' },
      // Second route: the force over B and I gives back the length.
      { agrees: near(F / (B * I), l), detail: `${F} ÷ (${B} × ${I}) = ${show(F / (B * I))} m` },
      { context: f.name, B, I, l },
    )
  },
}

interface Transformer {
  name: string
  /** "a transformer", "the transformer in a neon sign" */
  what: string
  /** Each primary pd with a secondary pd it really gives. */
  pairs: [number, number][]
  /** q6: the primary turns, from lo to hi in steps. */
  turns?: [number, number, number]
  /** q10: the secondary current, from lo to hi in steps, and the most the primary may draw. */
  secondary?: [number, number, number]
  maxPrimary?: number
}
/** Pairs from whole-number ratios: never 10, which only moves the point. */
const stepUp = (Vp: number, ratios: number[]): [number, number][] => ratios.map((k) => [Vp, Vp * k])
const STEP_UP_RATIOS = [3, 4, 5, 6, 7, 8, 9, 11, 12, 15]
const NEON_RATIOS = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65]

/**
 * Transformers whose secondary pd is the answer, so it must be free to vary: a neon sign
 * runs at 4.6 kV to 15 kV, an adapter gives the outputs adapters are sold at, and a school
 * power pack's tappings give 2 V to 12 V. Grid transformers are left to q10, since their pds
 * are fixed at 132, 275 and 400 kV.
 */
const PD_TRANSFORMERS: Transformer[] = [
  { name: 'step-up transformer', what: 'a transformer', pairs: stepUp(MAINS_V, STEP_UP_RATIOS), turns: [50, 500, 50] },
  { name: 'neon sign', what: 'the transformer in a neon sign', pairs: stepUp(MAINS_V, NEON_RATIOS), turns: [200, 1000, 50] },
  {
    name: 'mains adapter',
    what: 'the transformer in a mains adapter',
    pairs: [3, 4.5, 5, 6, 7.5, 9, 12, 15, 18, 19, 20, 24].map((Vs) => [MAINS_V, Vs]),
    turns: [500, 5000, 5],
  },
  {
    name: 'school power pack',
    what: 'the transformer in a school low-voltage power pack',
    pairs: [2, 3, 4, 5, 6, 7, 8, 9, 11, 12].map((Vs) => [MAINS_V, Vs]),
    turns: [500, 3000, 5],
  },
]
/**
 * Transformers whose secondary current is the answer. A power station steps 20–25 kV up to
 * the grid's 275 kV or 400 kV and sends out hundreds of megawatts; a wind farm steps 33 kV up
 * to 132 kV and sends out tens of megawatts.
 */
const POWER_TRANSFORMERS: Transformer[] = [
  { name: 'step-up transformer', what: 'a transformer', pairs: stepUp(MAINS_V, STEP_UP_RATIOS), secondary: [0.2, 3, 0.1], maxPrimary: 13 },
  { name: 'neon sign', what: 'the transformer in a neon sign', pairs: stepUp(MAINS_V, NEON_RATIOS), secondary: [0.01, 0.03, 0.001], maxPrimary: 2 },
  {
    name: 'power station',
    what: 'a step-up transformer at a power station',
    pairs: [
      [25000, 400000],
      [25000, 275000],
      [20000, 400000],
      [22000, 275000],
    ],
    secondary: [200, 1500, 50],
    maxPrimary: 25000,
  },
  { name: 'wind farm', what: 'the step-up transformer at a wind farm', pairs: [[33000, 132000]], secondary: [50, 400, 10], maxPrimary: 2000 },
]
const pd = (V: number) => `${prose(V)} V`
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

interface Turns {
  Vp: number
  Vs: number
  np: number
  ns: number
}
const TURNS = new Map<string, { answers: number[]; groups: Map<number, Turns[]> }>()
/**
 * Every primary turns count in a context's range that gives a whole number of secondary
 * turns, grouped by the secondary pd so each pd is drawn evenly.
 */
function turnsFor(t: Transformer) {
  let pool = TURNS.get(t.name)
  if (!pool) {
    const groups = new Map<number, Turns[]>()
    for (const [Vp, Vs] of t.pairs) {
      for (const np of range(...t.turns!)) {
        const ns = clean((np * Vs) / Vp)
        if (!Number.isInteger(ns) || ns < 10) continue
        if (!distinct(Vp, np, ns) || !clear(Vs, Vp, np, ns)) continue
        const g = groups.get(Vs) ?? (groups.set(Vs, []), groups.get(Vs)!)
        g.push({ Vp, Vs, np, ns })
      }
    }
    pool = { answers: [...groups.keys()], groups }
    TURNS.set(t.name, pool)
  }
  return pool
}

/**
 * Vs = Vp × ns ÷ np: written as q6 (100 and 500 turns, 230 V, 3 marks). Where the turns ratio
 * is a whole number, or a tenth, one way round, the working is "turns ratio, then multiply"
 * for a step-up and "turns ratio, then divide" for a step-down, as the written solution sets
 * it out; where it is not (230 V to 12 V), the ratio is kept as a fraction of the turns.
 */
export const transformerSecondaryPd: Generator = {
  id: 'transformer-secondary-pd',
  subjectId: 'physics',
  topicId: DEVICES,
  replaces: ['q6'],
  build(r, slot, turn) {
    const t = PD_TRANSFORMERS[turn % PD_TRANSFORMERS.length]!
    const pool = turnsFor(t)
    const { Vp, Vs, np, ns } = pick(r, pool.groups.get(pick(r, pool.answers))!)
    const up = ns > np
    const k = clean(up ? ns / np : np / ns)
    const prompt = pick(r, [
      `${cap(t.what)} has ${prose(np)} primary turns and ${prose(ns)} secondary turns, with ${pd(Vp)} across the primary. Calculate the secondary pd, in volts.`,
      `There are ${prose(np)} turns on the primary coil of ${t.what} and ${prose(ns)} turns on its secondary coil. The primary pd is ${pd(Vp)}. Calculate the secondary pd, in volts.`,
    ])
    const kind = `a ${up ? 'step-up' : 'step-down'} transformer.`
    let solution: string
    let method: string[]
    if (atMost(k, 1)) {
      const ratio = up ? `${tex(ns)} \\div ${tex(np)}` : `${tex(np)} \\div ${tex(ns)}`
      const step = up ? `V_s = ${tex(Vp)} \\times ${tex(k)}` : `V_s = ${tex(Vp)} \\div ${tex(k)}`
      solution = `Turns ratio $= ${ratio} = ${tex(k)}$, so ${closes(step, Vs, 'V').slice(0, -1)}, ${kind}`
      method = [`turns ratio $= ${ratio} = ${tex(k)}$`, up ? `multiplies the primary pd: $${tex(Vp)} \\times ${tex(k)}$` : `divides the primary pd: $${tex(Vp)} \\div ${tex(k)}$`]
    } else {
      solution = `The pds are in the ratio of the turns, $\\dfrac{V_s}{V_p} = \\dfrac{n_s}{n_p}$, so ${closes(`V_s = ${tex(Vp)} \\times \\dfrac{${tex(ns)}}{${tex(np)}}`, Vs, 'V').slice(0, -1)}, ${kind}`
      method = [`turns ratio $n_s \\div n_p = ${tex(ns)} \\div ${tex(np)}$`, `multiplies the primary pd by it: $${tex(Vp)} \\times ${tex(ns)} \\div ${tex(np)}$`]
    }
    return numeric(
      slot,
      { prompt, solution, method, answer: Vs, tolerance: dpTolerance(Vs), units: 'V' },
      // Second route: the pds are in the ratio of the turns, Vp ÷ Vs = np ÷ ns.
      { agrees: near(Vp / Vs, np / ns) && near((Vp * ns) / np, Vs), detail: `${Vp} ÷ ${Vs} = ${show(Vp / Vs)}; ${np} ÷ ${ns} = ${show(np / ns)}` },
      { context: t.name, Vp, np, ns },
    )
  },
}

interface Currents {
  Vp: number
  Vs: number
  Ip: number
  Is: number
  P: number
}
const CURRENTS = new Map<string, { answers: number[]; groups: Map<number, Currents[]> }>()
/** Every secondary current a context allows with a clean primary current, grouped by itself. */
function currentsFor(t: Transformer) {
  let pool = CURRENTS.get(t.name)
  if (!pool) {
    const groups = new Map<number, Currents[]>()
    for (const [Vp, Vs] of t.pairs) {
      for (const Is of range(...t.secondary!)) {
        const Ip = clean((Is * Vs) / Vp)
        const P = clean(Vp * Ip)
        if (!atMost(Ip, 3) || Ip > t.maxPrimary! || !atMost(P, 2)) continue
        if (!noTens(Ip, Is, P) || !noSum(Vp, Ip) || !distinct(Vp, Ip, Vs) || !clear(Is, Vp, Ip, Vs, P)) continue
        const g = groups.get(Is) ?? (groups.set(Is, []), groups.get(Is)!)
        g.push({ Vp, Vs, Ip, Is, P })
      }
    }
    pool = { answers: [...groups.keys()], groups }
    CURRENTS.set(t.name, pool)
  }
  return pool
}

/**
 * Vp Ip = Vs Is: written as q10 (5 A at 230 V, 1150 V out, 3 marks). The secondary current is
 * drawn evenly first, and the primary current follows from the ratio.
 */
export const transformerSecondaryCurrent: Generator = {
  id: 'transformer-secondary-current',
  subjectId: 'physics',
  topicId: DEVICES,
  replaces: ['q10'],
  build(r, slot, turn) {
    const t = POWER_TRANSFORMERS[turn % POWER_TRANSFORMERS.length]!
    const pool = currentsFor(t)
    const { Vp, Vs, Ip, Is, P } = pick(r, pool.groups.get(pick(r, pool.answers))!)
    const k = clean(Vs / Vp)
    const prompt = pick(r, [
      `${cap(t.what)} draws ${prose(Ip)} A at ${pd(Vp)} and its secondary pd is ${pd(Vs)}. Assuming 100% efficiency, what is the secondary current, in amperes?`,
      `The primary coil of ${t.what} takes ${prose(Ip)} A at ${pd(Vp)}. The secondary pd is ${pd(Vs)}. Assuming the transformer is 100% efficient, calculate the secondary current, in amperes.`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: `Power in $= V_p I_p = ${tex(Vp)} \\times ${tex(Ip)} = ${tex(P)}$ W. With 100% efficiency the power out is the same, so ${closes(`I_s = ${tex(P)} \\div ${tex(Vs)}`, Is, 'A')} The pd rose ${show(k)}× so the current fell ${show(k)}×.`,
        method: [`calculates the input power: $${tex(Vp)} \\times ${tex(Ip)} = ${tex(P)}$ W`, `divides by the secondary pd: $${tex(P)} \\div ${tex(Vs)}$`],
        answer: Is,
        tolerance: dpTolerance(Is),
        units: 'A',
      },
      // Second route: the currents are in the inverse ratio of the pds.
      { agrees: near(Ip / Is, Vs / Vp), detail: `${Ip} ÷ ${Is} = ${show(Ip / Is)}; ${Vs} ÷ ${Vp} = ${show(Vs / Vp)}` },
      { context: t.name, Vp, Vs, Ip },
    )
  },
}

interface Cable {
  name: string
  text: (R: string, I1: string, I2: string) => string
  /** "the cables" or "the line" */
  wasted: string
  ohms: [number, number, number]
  /** The smaller, stepped-up current. */
  amps: [number, number, number]
  /** The most the cable carries before. */
  maxBefore: number
}
const CABLES: Cable[] = [
  {
    name: 'transmission cables',
    text: (R, a, b) => `Transmission cables of resistance ${R} Ω carry ${a} A. The current is reduced to ${b} A for the same power delivered.`,
    wasted: 'in the cables',
    ohms: [2, 10, 0.5],
    amps: [20, 100, 5],
    maxBefore: 1500,
  },
  {
    name: 'overhead line',
    text: (R, a, b) => `An overhead power line has a resistance of ${R} Ω and carries ${a} A. A transformer raises the pd so the line carries only ${b} A for the same power delivered.`,
    wasted: 'in the line',
    ohms: [1, 6, 0.5],
    amps: [10, 60, 5],
    maxBefore: 1000,
  },
  {
    name: 'underground cable',
    text: (R, a, b) => `An underground cable of resistance ${R} Ω carries ${a} A. The supply pd is stepped up, and the current falls to ${b} A for the same power delivered.`,
    wasted: 'in the cable',
    ohms: [0.5, 3, 0.5],
    amps: [10, 50, 5],
    maxBefore: 800,
  },
]
/** How many times the current falls: never 10, which moves the point. */
const FALLS = [2, 3, 4, 5, 6, 8, 12, 15, 16, 20]

/**
 * The power wasted in a cable, P = I²R, before and after the current falls: written as q14
 * (4 Ω, 100 A to 20 A, factor 25, 3 marks, no units). The factor is drawn first, so no
 * answer dominates.
 */
export const transmissionLossFactor: Generator = {
  id: 'transmission-loss-factor',
  subjectId: 'physics',
  topicId: DEVICES,
  replaces: ['q14'],
  build(r, slot, turn) {
    const c = CABLES[turn % CABLES.length]!
    const { k, R, I1, I2, P1, P2 } = draw(
      r,
      (r) => {
        const k = pick(r, FALLS)
        const R = pick(r, range(...c.ohms))
        const I2 = pick(r, range(...c.amps))
        const I1 = I2 * k
        return { k, R, I1, I2, P1: clean(I1 * I1 * R), P2: clean(I2 * I2 * R) }
      },
      ({ k, R, I1, I2 }) => I1 <= c.maxBefore && noTens(R, I1, I2) && noSum(I2, I2, R) && distinct(R, I1, I2) && clear(k * k, R, I1, I2),
    )
    const f = k * k
    const prompt = `${c.text(show(R), prose(I1), prose(I2))} ${pick(r, [`By what factor does the power wasted ${c.wasted} fall?`, `How many times smaller is the power wasted ${c.wasted}?`])}`
    return numeric(
      slot,
      {
        prompt,
        solution: `At ${prose(I1)} A: $P = I^2 R = ${tex(I1)}^2 \\times ${tex(R)} = ${tex(P1)}$ W. At ${prose(I2)} A: $${tex(I2)}^2 \\times ${tex(R)} = ${tex(P2)}$ W. The factor is $${tex(P1)} \\div ${tex(P2)} = $ **${f}**: the current fell ${k}×, and because it is **squared**, the waste fell $${k}^2 = ${f}$ times.`,
        method: [
          `uses $P = I^2 R$ for both currents: $${tex(I1)}^2 \\times ${tex(R)} = ${tex(P1)}$ W and $${tex(I2)}^2 \\times ${tex(R)} = ${tex(P2)}$ W`,
          `divides to find the factor: $${tex(P1)} \\div ${tex(P2)}$`,
        ],
        answer: f,
      },
      // Second route: the ratio of the currents, squared.
      { agrees: near(P1 / P2, f) && near((I1 / I2) ** 2, f), detail: `(${I1} ÷ ${I2})² = ${show((I1 / I2) ** 2)}` },
      { context: c.name, R, I1, I2 },
    )
  },
}

interface Alternator {
  name: string
  /** "a model alternator turned by hand" */
  what: string
  /** Turns per second it really makes. */
  rates: number[]
  peaks: [number, number, number]
}
/** Alternators whose coil turns, as the written question has it, at the rates each really turns. */
const ALTERNATORS: Alternator[] = [
  { name: 'hand-turned', what: 'a model alternator turned by hand', rates: [0.8, 1.2, 1.25, 1.5, 1.6, 2, 2.4, 2.5, 3.75, 4, 5, 6], peaks: [0.5, 3, 0.1] },
  { name: 'motor-driven', what: 'a model alternator driven by an electric motor', rates: [8, 12, 12.5, 15, 16, 20, 24, 25, 30, 40, 50], peaks: [2, 12, 0.5] },
  { name: 'model wind turbine', what: 'an alternator turned by a model wind turbine', rates: [2, 2.5, 3, 4, 5, 6, 6.25, 7.5, 8, 12, 12.5], peaks: [1, 6, 0.5] },
]
interface Reading {
  f: number
  /** Complete cycles read off the graph, and the time they take. */
  N: number
  t: number
}
const READINGS = new Map<string, { answers: number[]; groups: Map<number, Reading[]> }>()
/**
 * The ways a rate can be read off a graph: one cycle and its period, or several cycles and
 * the time they take. A time is one a graph's axis shows, to two significant figures (0.040 s,
 * 2.0 s), never 0.0625 s, and never a power of ten or a cycle count the answer simply repeats.
 */
function readingsFor(a: Alternator) {
  let pool = READINGS.get(a.name)
  if (!pool) {
    const groups = new Map<number, Reading[]>()
    for (const f of a.rates) {
      const ways: Reading[] = []
      for (let N = 1; N <= 9; N++) {
        const t = clean(N / f)
        if (figures(t) > 2 || noTens(t) === false || (N > 1 && !clear(f, N, t))) continue
        ways.push({ f, N, t })
      }
      if (ways.length) groups.set(f, ways)
    }
    pool = { answers: [...groups.keys()], groups }
    READINGS.set(a.name, pool)
  }
  return pool
}
/** A time as the written question prints it, to two figures with its zero: 0.040 s, 0.50 s, 2.0 s. */
const period = (T: number) => sigText(T, 2)
const NOT_NEEDED = 'The peak pd is not needed: only the time for a cycle sets how many times the coil turns each second.'

/**
 * Turns per second from a pd–time graph: written as q26 (one cycle in 0.040 s, 2 marks, no
 * units). The prompt states what the graph shows, as the written one does: the time for one
 * cycle, or for several, and the peak pd, which the answer does not use. The rate is drawn
 * evenly, then a way of reading it.
 */
export const turnsPerSecondFromPeriod: Generator = {
  id: 'alternator-turns-per-second',
  subjectId: 'physics',
  topicId: DEVICES,
  replaces: ['q26'],
  build(r, slot, turn) {
    const a = ALTERNATORS[turn % ALTERNATORS.length]!
    const pool = readingsFor(a)
    const { f, N, t } = pick(r, pool.groups.get(pick(r, pool.answers))!)
    const peak = draw(
      r,
      (r) => pick(r, range(...a.peaks)),
      (peak) => noTens(peak) && distinct(peak, t, N) && clear(f, peak),
    )
    const shown = N === 1 ? `one complete cycle takes ${period(t)} s` : `${N} complete cycles take ${period(t)} s`
    const prompt = pick(r, [
      `On a graph of pd against time for ${a.what}, the pd peaks at ${show(peak)} V and ${shown}. How many times does the coil turn each second?`,
      `${cap(a.what)} produces an alternating pd. On a graph of pd against time, ${shown} and the peak pd is ${show(peak)} V. How many times does the coil turn each second?`,
    ])
    const solution =
      N === 1
        ? `One turn of the coil is one cycle, so turns per second $= \\dfrac{1}{${period(t)}} = $ **${show(f)}**. The output frequency is ${show(f)} Hz. ${NOT_NEEDED}`
        : `One turn of the coil is one cycle, and ${N} cycles take ${period(t)} s, so turns per second $= ${N} \\div ${period(t)} = $ **${show(f)}**. The output frequency is ${show(f)} Hz. ${NOT_NEEDED}`
    return numeric(
      slot,
      {
        prompt,
        solution,
        method: [N === 1 ? `$1 \\div ${period(t)}$` : `$${N} \\div ${period(t)}$`],
        answer: f,
        tolerance: dpTolerance(f),
      },
      // Second route: that many turns, each taking one period, fill one second.
      { agrees: near((f * t) / N, 1), detail: `${f} × ${t} ÷ ${N} = ${show((f * t) / N)}` },
      { context: a.name, N, t, peak },
    )
  },
}

export const mainsGenerators: Generator[] = [
  mainsPowerFromCurrent,
  mainsCurrentFromPower,
  powerFromCurrentAndResistance,
  powerAfterCurrentChange,
  forceOnAWire,
  transformerSecondaryPd,
  transformerSecondaryCurrent,
  transmissionLossFactor,
  turnsPerSecondFromPeriod,
]
