import { fixed, show } from '../format.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import type { Generator } from '../types.ts'
import { atMost, cap, closes, near, numeric, prose, tex } from './build.ts'
import { dpTolerance } from './format.ts'

/**
 * Electricity (AQA 8463, topic 2): charge and current, V = IR, P = VI, and the series and
 * parallel rules. Every numeric written question in the four circuit topics has a generator
 * here; the written questions are the model for the wording and the mark scheme. Supplies
 * are a lab power supply or a battery, resistances are whole ohms a lab has, and a current is
 * drawn from the values that come out clean rather than kept when it happens to.
 *
 * Never "a 4 Ω resistor" or "a 12 V supply": the article before a number read aloud cannot
 * be chosen from its digits, so the prompts say "a resistor of 4 Ω" and "a battery of 12 V".
 */
const RULES = 'circuit-rules'
const SERIES_PARALLEL = 'series-and-parallel-circuits'
const CURRENT = 'current-potential-difference-and-resistance'
const OHMS = 'resistance-and-ohms-law'

const clean = (x: number) => Number(show(x))
const an = (noun: string) => `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`
/** lo, lo + step, … hi, free of binary residue. */
const range = (lo: number, hi: number, step = 1) => Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => clean(lo + i * step))

/** a and b are the same figure, or the same digits with the point moved: a ÷ b is a power of ten. */
const tenfold = (a: number, b: number) => {
  const l = Math.log10(Math.abs(a / b))
  return Number.isFinite(l) && Math.abs(l - Math.round(l)) < 1e-9
}
/** No two figures the same, or the same with the point moved. */
const distinct = (...xs: number[]) => xs.every((x, i) => xs.slice(i + 1).every((y) => !tenfold(x, y)))
/** An answer that is none of the givens, nor one with the point moved, doubled or halved. */
const clear = (answer: number, ...givens: number[]) => givens.every((g) => !tenfold(answer, g) && !near(answer, 2 * g) && !near(2 * answer, g))
/** Multiplying or dividing by 1 is no step. */
const noOnes = (...xs: number[]) => !xs.includes(1)
/**
 * Figures to be multiplied whose product is not their sum, pair by pair and all together:
 * 6 × 1.2 is 7.2, which is 6 + 1.2, so a student who added would be marked right.
 */
const noSum = (...xs: number[]) =>
  !near(
    xs.reduce((a, b) => a * b, 1),
    xs.reduce((a, b) => a + b, 0),
  ) && xs.every((x, i) => xs.slice(i + 1).every((y) => !near(x * y, x + y)))

/**
 * Every candidate a slot allows, grouped by its answer and built once. A build draws the
 * answer evenly first and then a candidate that gives it, so the values that divide most
 * often (0.25 A, 0.5 A, 25 Ω) are no likelier than any other answer.
 */
const POOLS = new Map<string, { answers: number[]; groups: Map<number, unknown[]> }>()
function evenly<T>(r: Rng, key: string, make: () => T[], answerOf: (t: T) => number): T {
  let pool = POOLS.get(key)
  if (!pool) {
    const groups = new Map<number, T[]>()
    for (const t of make()) {
      const a = answerOf(t)
      const g = groups.get(a)
      if (g) g.push(t)
      else groups.set(a, [t])
    }
    if (!groups.size) throw new Error(`no candidates for ${key}`)
    pool = { answers: [...groups.keys()], groups: groups as Map<number, unknown[]> }
    POOLS.set(key, pool)
  }
  return pick(r, pool.groups.get(pick(r, pool.answers))!) as T
}
const cached = <T>(store: Map<string, T>, key: string, make: () => T): T => store.get(key) ?? (store.set(key, make()), store.get(key)!)

// ---------------------------------------------------------------------------------------------
// Series and parallel circuits
// ---------------------------------------------------------------------------------------------

interface Supply {
  name: string
  /** "a battery of 6 V" */
  text: (V: number) => string
  volts: number[]
}
/** A lab power pack set in whole volts, or a battery of the voltages batteries come in. */
const SUPPLIES: Supply[] = [
  { name: 'power supply', text: (V) => `a power supply of ${show(V)} V`, volts: range(2, 12) },
  { name: 'battery', text: (V) => `a battery of ${show(V)} V`, volts: [3, 4.5, 6, 9, 12] },
]
interface Part {
  noun: string
  ohms: [number, number]
}
const RESISTOR: Part = { noun: 'resistor', ohms: [2, 100] }
/** A lab filament lamp at its working temperature. */
const LAMP: Part = { noun: 'lamp', ohms: [4, 30] }
const ELEMENT: Part = { noun: 'heating element', ohms: [2, 20] }
interface Pair {
  name: string
  parts: [Part, Part]
}
const PAIRS: Pair[] = [
  { name: 'two resistors', parts: [RESISTOR, RESISTOR] },
  { name: 'resistor and lamp', parts: [RESISTOR, LAMP] },
  { name: 'resistor and heating element', parts: [RESISTOR, ELEMENT] },
]
interface Circuit {
  name: string
  supply: Supply
  pair: Pair
}
const CIRCUITS: Circuit[] = SUPPLIES.flatMap((supply) => PAIRS.map((pair) => ({ name: `${supply.name}, ${pair.name}`, supply, pair })))

/** "resistors of 4 Ω and 8 Ω", or "a resistor of 4 Ω and a lamp of resistance 8 Ω". */
function both(p: Pair, R1: number, R2: number): string {
  return p.parts[0].noun === p.parts[1].noun ? `resistors of ${R1} Ω and ${R2} Ω` : `a resistor of ${R1} Ω and ${an(p.parts[1].noun)} of resistance ${R2} Ω`
}
/** "the 8 Ω resistor" where both are resistors, otherwise "the lamp". */
function the(p: Pair, i: 0 | 1, R: number): string {
  return p.parts[0].noun === p.parts[1].noun ? `the ${R} Ω resistor` : `the ${p.parts[i].noun}`
}

/** Currents a lab circuit carries: an ammeter reads to 0.01 A, and a power pack gives a few amps. */
const MIN_I = 0.05
const MAX_I = 3
const cleanCurrent = (I: number) => atMost(I, 2) && I >= MIN_I - 1e-9 && I <= MAX_I + 1e-9

interface Series {
  V: number
  R1: number
  R2: number
  Rt: number
  I: number
  V1: number
  V2: number
}
const SERIES = new Map<string, Series[]>()
/**
 * Every supply and pair of resistances in series a circuit allows whose current has at most
 * two decimal places. distinct(V, Rt, I) keeps the current from being the supply pd with the
 * point moved.
 */
function allSeries(c: Circuit): Series[] {
  return cached(SERIES, c.name, () => {
    const [a, b] = c.pair.parts
    const out: Series[] = []
    for (const V of c.supply.volts) {
      for (const R1 of range(...a.ohms)) {
        for (const R2 of range(...b.ohms)) {
          const Rt = R1 + R2
          const I = clean(V / Rt)
          if (!cleanCurrent(V / Rt)) continue
          const s = { V, R1, R2, Rt, I, V1: clean(I * R1), V2: clean(I * R2) }
          if (distinct(V, R1, R2) && distinct(V, Rt, I) && noOnes(V, R1, R2, I)) out.push(s)
        }
      }
    }
    return out
  })
}
/** A series circuit for one slot: its answer drawn evenly, the current unless `answerOf` says otherwise. */
function series(r: Rng, c: Circuit, key: string, ok: (s: Series) => boolean, answerOf: (s: Series) => number = (s) => s.I): Series {
  return evenly(r, `${key}:${c.name}`, () => allSeries(c).filter(ok), answerOf)
}

interface Parallel {
  V: number
  R1: number
  R2: number
  I1: number
  I2: number
  I: number
}
/** Resistances each branch can have with this supply and a clean branch current. */
const branchOhms = (V: number, p: Part) => range(p.ohms[0], p.ohms[1]).filter((R) => cleanCurrent(V / R))

const PARALLEL = new Map<string, Parallel[]>()
/**
 * Every supply across two resistances in parallel a circuit allows, each branch current
 * clean. distinct(V, R, I) per branch keeps a branch current from being the pd with the point moved.
 */
function allParallel(c: Circuit): Parallel[] {
  return cached(PARALLEL, c.name, () => {
    const [a, b] = c.pair.parts
    const out: Parallel[] = []
    for (const V of c.supply.volts) {
      for (const R1 of branchOhms(V, a)) {
        for (const R2 of branchOhms(V, b)) {
          const I1 = clean(V / R1)
          const I2 = clean(V / R2)
          const p = { V, R1, R2, I1, I2, I: clean(I1 + I2) }
          if (p.I <= 5 && distinct(V, R1, R2) && distinct(V, R1, I1) && distinct(V, R2, I2) && distinct(I1, I2) && noOnes(V, R1, R2, I1, I2, p.I)) out.push(p)
        }
      }
    }
    return out
  })
}
/** A parallel circuit for one slot, its answer drawn evenly. */
function parallel(r: Rng, c: Circuit, key: string, ok: (p: Parallel) => boolean, answerOf: (p: Parallel) => number): Parallel {
  return evenly(r, `${key}:${c.name}`, () => allParallel(c).filter(ok), answerOf)
}

/** R1 + R2: written as circuit-rules q2 (1 mark) and series-and-parallel-circuits q1 (2 marks). */
function seriesResistance(id: string, topicId: string, slotId: string): Generator {
  return {
    id,
    subjectId: 'physics',
    topicId,
    replaces: [slotId],
    build(r, slot, turn) {
      const p = PAIRS[turn % PAIRS.length]!
      const [a, b] = p.parts
      const { R1, R2, Rt } = draw(
        r,
        (r) => {
          const R1 = int(r, ...a.ohms)
          const R2 = int(r, ...b.ohms)
          return { R1, R2, Rt: R1 + R2 }
        },
        ({ R1, R2, Rt }) => distinct(R1, R2) && clear(Rt, R1, R2),
      )
      const prompt = pick(r, [
        `${cap(both(p, R1, R2))} are connected in series. What is the total resistance, in ohms?`,
        `In a series circuit, ${both(p, R1, R2)} are connected one after the other. What is their total resistance, in ohms?`,
      ])
      return numeric(
        slot,
        {
          prompt,
          solution: `In series the resistances add: ${closes(`${R1} + ${R2}`, Rt, 'Ω')}`,
          method: [`adds the resistances: $${R1} + ${R2}$`],
          answer: Rt,
          units: 'Ω',
        },
        { agrees: Rt - R2 === R1 && Rt - R1 === R2, detail: `${Rt} − ${R2} = ${Rt - R2} Ω` },
        { context: p.name, R1, R2 },
      )
    },
  }
}

/**
 * I = V ÷ (R1 + R2): written as circuit-rules q5 (3 marks) and series-and-parallel-circuits q5
 * (2 marks). The method lines are the total resistance, then the current from it.
 */
function seriesCurrent(id: string, topicId: string, slotId: string): Generator {
  return {
    id,
    subjectId: 'physics',
    topicId,
    replaces: [slotId],
    build(r, slot, turn) {
      const c = CIRCUITS[turn % CIRCUITS.length]!
      const { V, R1, R2, Rt, I, V1, V2 } = series(r, c, id, (s) => clear(s.I, s.V, s.R1, s.R2, s.Rt))
      const supply = c.supply.text(V)
      const prompt = pick(r, [
        topicId === RULES
          ? `${cap(supply)} is in series with ${both(c.pair, R1, R2)}. What is the current, in amperes?`
          : `${cap(supply)} is connected to ${both(c.pair, R1, R2)} in series. What is the current, in amperes?`,
        `${cap(both(c.pair, R1, R2))} are connected in series to ${supply}. What is the current in the circuit, in amperes?`,
      ])
      return numeric(
        slot,
        {
          prompt,
          solution: `Total resistance $= ${R1} + ${R2} = ${Rt}$ Ω, so ${closes(`I = V \\div R = ${tex(V)} \\div ${Rt}`, I, 'A')} Use the **total** resistance, not one of them.`,
          method: [`total resistance $= ${R1} + ${R2} = ${Rt}$ Ω`, `$I = V \\div R_{\\text{total}} = ${tex(V)} \\div ${Rt}$`],
          answer: I,
          tolerance: dpTolerance(I),
          units: 'A',
        },
        // Second route: the pds across the two parts add up to the supply's.
        { agrees: near(V1 + V2, V) && near(I * Rt, V), detail: `${V1} + ${V2} = ${show(V1 + V2)} V` },
        { context: c.name, V, R1, R2 },
      )
    },
  }
}

/**
 * V = IR across one part of a series circuit: written as circuit-rules q6 (2 marks, the
 * current given) and series-and-parallel-circuits q6 (3 marks, the current found first).
 */
function seriesPd(id: string, topicId: string, slotId: string, currentGiven: boolean): Generator {
  return {
    id,
    subjectId: 'physics',
    topicId,
    replaces: [slotId],
    build(r, slot, turn) {
      const c = CIRCUITS[turn % CIRCUITS.length]!
      const i: 0 | 1 = int(r, 0, 1) as 0 | 1
      const s = series(
        r,
        c,
        `${id}:${i}`,
        (s) => {
          const Vx = i === 0 ? s.V1 : s.V2
          return clear(Vx, s.V, s.R1, s.R2, s.Rt, ...(currentGiven ? [s.I] : [])) && noSum(s.I, i === 0 ? s.R1 : s.R2)
        },
        (s) => (i === 0 ? s.V1 : s.V2),
      )
      const { V, R1, R2, Rt, I, V1, V2 } = s
      const Rx = i === 0 ? R1 : R2
      const Vx = i === 0 ? V1 : V2
      const Vo = i === 0 ? V2 : V1
      const which = the(c.pair, i, Rx)
      const other = the(c.pair, i === 0 ? 1 : 0, i === 0 ? R2 : R1)
      const supply = c.supply.text(V)
      const prompt = currentGiven
        ? pick(r, [
            `${cap(supply)} is in series with ${both(c.pair, R1, R2)}, and the current is ${show(I)} A. What is the potential difference across ${which}, in volts?`,
            `${cap(both(c.pair, R1, R2))} are connected in series to ${supply}. The current is ${show(I)} A. What is the potential difference across ${which}, in volts?`,
          ])
        : pick(r, [
            `${cap(supply)} is connected to ${both(c.pair, R1, R2)} in series. What is the potential difference across ${which}, in volts?`,
            `${cap(both(c.pair, R1, R2))} are connected in series to ${supply}. What is the potential difference across ${which}, in volts?`,
          ])
      const check = `Check: ${other} takes $${tex(Vo)}$ V, and $${tex(V1)} + ${tex(V2)} = ${tex(V)}$ V, the supply ✓`
      const solution = currentGiven
        ? `${closes(`V = I R = ${show(I)} \\times ${Rx}`, Vx, 'V')} ${check}`
        : `The current is the same through both: $I = V \\div R_{\\text{total}} = ${tex(V)} \\div (${R1} + ${R2}) = ${tex(V)} \\div ${Rt} = ${show(I)}$ A. Across ${which}: ${closes(`V = I R = ${show(I)} \\times ${Rx}`, Vx, 'V')} ${check}`
      const method = currentGiven
        ? [`$V = I R$ with ${which}'s own resistance: $${show(I)} \\times ${Rx}$`]
        : [`finds the current: $${tex(V)} \\div ${Rt} = ${show(I)}$ A`, `$V = I R$ on ${which}: $${show(I)} \\times ${Rx}$`]
      return numeric(
        slot,
        { prompt, solution, method, answer: Vx, tolerance: dpTolerance(Vx), units: 'V' },
        // Second route: the supply less the pd across the other part.
        { agrees: near(V - Vo, Vx) && near(Vx, (V * Rx) / Rt), detail: `${V} − ${Vo} = ${show(V - Vo)} V` },
        { context: c.name, V, R1, R2, I, asked: i + 1 },
      )
    },
  }
}

/**
 * The total current from a supply across two branches: written as circuit-rules q7 and
 * series-and-parallel-circuits q10 (3 marks each). Each branch has the full supply pd.
 */
function parallelTotal(id: string, topicId: string, slotId: string): Generator {
  return {
    id,
    subjectId: 'physics',
    topicId,
    replaces: [slotId],
    build(r, slot, turn) {
      const c = CIRCUITS[turn % CIRCUITS.length]!
      const { V, R1, R2, I1, I2, I } = parallel(r, c, id, (p) => clear(p.I, p.V, p.R1, p.R2, p.I1, p.I2), (p) => p.I)
      const supply = c.supply.text(V)
      const prompt = pick(r, [
        topicId === RULES
          ? `${cap(supply)} is across ${both(c.pair, R1, R2)} in parallel. What is the total current, in amperes?`
          : `${cap(supply)} is connected to ${both(c.pair, R1, R2)} in parallel. What is the total current, in amperes?`,
        `${cap(both(c.pair, R1, R2))} are connected in parallel across ${supply}. What is the total current from the ${c.supply.name}, in amperes?`,
      ])
      const branches = `$${tex(V)} \\div ${R1} = ${show(I1)}$ A and $${tex(V)} \\div ${R2} = ${show(I2)}$ A`
      // Second route: the supply over the combined resistance, R1 R2 ÷ (R1 + R2).
      const combined = (V * (R1 + R2)) / (R1 * R2)
      return numeric(
        slot,
        {
          prompt,
          solution: `Each branch has the full ${show(V)} V: ${branches}. The branch currents add: ${closes(`${show(I1)} + ${show(I2)}`, I, 'A')}`,
          method: [`full ${show(V)} V across each branch: ${branches}`, `adds the branch currents: $${show(I1)} + ${show(I2)}$`],
          answer: I,
          tolerance: dpTolerance(I),
          units: 'A',
        },
        { agrees: near(combined, I), detail: `${V} × (${R1} + ${R2}) ÷ (${R1} × ${R2}) = ${show(combined)} A` },
        { context: c.name, V, R1, R2 },
      )
    },
  }
}

/** The current in one branch: written as series-and-parallel-circuits q7 (2 marks). */
export const parallelBranchCurrent: Generator = {
  id: 'parallel-branch-current',
  subjectId: 'physics',
  topicId: SERIES_PARALLEL,
  replaces: ['q7'],
  build(r, slot, turn) {
    const c = CIRCUITS[turn % CIRCUITS.length]!
    const i: 0 | 1 = int(r, 0, 1) as 0 | 1
    const { V, R1, R2, I1, I2 } = parallel(
      r,
      c,
      `parallel-branch-current:${i}`,
      (p) => clear(i === 0 ? p.I1 : p.I2, p.V, p.R1, p.R2),
      (p) => (i === 0 ? p.I1 : p.I2),
    )
    const Rx = i === 0 ? R1 : R2
    const Ix = i === 0 ? I1 : I2
    const which = the(c.pair, i, Rx)
    const supply = c.supply.text(V)
    const prompt = pick(r, [
      `${cap(supply)} is connected to ${both(c.pair, R1, R2)} in parallel. What is the current through ${which}, in amperes?`,
      `${cap(both(c.pair, R1, R2))} are connected in parallel across ${supply}. What is the current through ${which}, in amperes?`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: `Each branch has the full ${show(V)} V, so ${closes(`I = V \\div R = ${tex(V)} \\div ${Rx}`, Ix, 'A')} The other branch does not change the pd across this one.`,
        method: [`uses the full ${show(V)} V on the branch: $${tex(V)} \\div ${Rx}$`],
        answer: Ix,
        tolerance: dpTolerance(Ix),
        units: 'A',
      },
      // Second route: the current found times the branch resistance is the supply pd.
      { agrees: near(Ix * Rx, V), detail: `${Ix} × ${Rx} = ${show(Ix * Rx)} V` },
      { context: c.name, V, R1, R2, asked: i + 1 },
    )
  },
}

/**
 * One part of a series circuit replaced: written as circuit-rules q13 (a 12 V supply with
 * 4 Ω and 8 Ω, the 8 Ω replaced by 20 Ω, 3 marks, no units). The new resistance is drawn
 * from those that give a clean new current, and the solution says how the current moved.
 */
export const seriesPartReplaced: Generator = {
  id: 'series-part-replaced',
  subjectId: 'physics',
  topicId: RULES,
  replaces: ['q13'],
  build(r, slot, turn) {
    const c = CIRCUITS[turn % CIRCUITS.length]!
    const i: 0 | 1 = int(r, 0, 1) as 0 | 1
    const part = c.pair.parts[i]
    // The old circuit, then the new current drawn evenly from those a replacement can give.
    const { s, R3, Rt2, I2 } = draw(
      r,
      (r) => {
        const s = series(r, c, 'series-part-replaced', () => true)
        const kept = i === 0 ? s.R2 : s.R1
        const options = range(...part.ohms)
          .map((R3) => ({ s, R3, Rt2: kept + R3, I2: clean(s.V / (kept + R3)) }))
          .filter(({ R3, Rt2, I2 }) => cleanCurrent(s.V / Rt2) && distinct(s.V, s.R1, s.R2, R3) && distinct(s.V, Rt2, I2) && noOnes(R3, I2) && clear(I2, s.V, s.R1, s.R2, R3, s.Rt, Rt2) && I2 !== s.I)
        if (!options.length) return null
        const I2 = pick(r, [...new Set(options.map((o) => o.I2))])
        return pick(
          r,
          options.filter((o) => o.I2 === I2),
        )
      },
      (o) => o !== null,
    )!
    const { V, R1, R2, Rt, I } = s
    const Rx = i === 0 ? R1 : R2
    const kept = i === 0 ? R2 : R1
    const which = the(c.pair, i, Rx)
    const replacement = part.noun === 'resistor' ? `a resistor of ${R3} Ω` : `another ${part.noun}, of resistance ${R3} Ω`
    const supply = c.supply.text(V)
    const prompt = pick(r, [
      `${cap(supply)} is in series with ${both(c.pair, R1, R2)}. ${cap(which)} is replaced by ${replacement}. What is the new current, in amperes?`,
      `${cap(both(c.pair, R1, R2))} are connected in series to ${supply}. ${cap(which)} is then replaced by ${replacement}. What is the new current, in amperes?`,
    ])
    const rose = Rt2 > Rt
    const how = rose
      ? `The current has fallen from ${show(I)} A to ${show(I2)} A, because the total resistance rose from ${Rt} Ω to ${Rt2} Ω: the same supply pd drives less current through more resistance.`
      : `The current has risen from ${show(I)} A to ${show(I2)} A, because the total resistance fell from ${Rt} Ω to ${Rt2} Ω: the same supply pd drives more current through less resistance.`
    return numeric(
      slot,
      {
        prompt,
        solution: `New total resistance $= ${kept} + ${R3} = ${Rt2}$ Ω, so ${closes(`I = V \\div R = ${tex(V)} \\div ${Rt2}`, I2, 'A')} ${how}`,
        method: [`new total resistance $= ${kept} + ${R3} = ${Rt2}$ Ω`, `$I = V \\div R_{\\text{total}} = ${tex(V)} \\div ${Rt2}$`],
        answer: I2,
        tolerance: dpTolerance(I2),
      },
      // Second route: the current scales inversely with the total resistance.
      { agrees: near((I * Rt) / Rt2, I2), detail: `${I} × ${Rt} ÷ ${Rt2} = ${show((I * Rt) / Rt2)} A` },
      { context: c.name, V, R1, R2, R3, replaced: i + 1 },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Charge, V = IR and P = VI
// ---------------------------------------------------------------------------------------------

interface Flow {
  name: string
  /** "A current of 2.0 A flows for 30 s." */
  text: (I: string, t: string) => string
  amps: [number, number, number]
  seconds: [number, number, number]
  /** Null where minutes make no sense: a starter motor turns for a second or two. */
  minutes: [number, number] | null
}
/** Currents and how long each really flows. */
const FLOWS: Flow[] = [
  { name: 'lab circuit', text: (I, t) => `A current of ${I} A flows for ${t}.`, amps: [0.2, 3, 0.1], seconds: [10, 120, 5], minutes: [2, 20] },
  { name: 'phone charging', text: (I, t) => `A phone charges with a current of ${I} A for ${t}.`, amps: [0.5, 2.4, 0.1], seconds: [30, 600, 30], minutes: [10, 90] },
  { name: 'kettle', text: (I, t) => `A kettle draws a current of ${I} A for ${t}.`, amps: [8.5, 13, 0.1], seconds: [60, 240, 10], minutes: [2, 4] },
  { name: 'torch bulb', text: (I, t) => `A torch bulb carries a current of ${I} A for ${t}.`, amps: [0.2, 0.6, 0.05], seconds: [20, 300, 10], minutes: [5, 60] },
  { name: 'car starter motor', text: (I, t) => `A car's starter motor draws a current of ${I} A for ${t}.`, amps: [100, 250, 10], seconds: [1, 4, 0.5], minutes: null },
  { name: 'laptop charging', text: (I, t) => `A laptop charges with a current of ${I} A for ${t}.`, amps: [1.5, 3.5, 0.1], seconds: [30, 600, 30], minutes: [10, 90] },
]
/** A current as the written questions print it, to the tenth of an amp at least: 2.0 A, 0.25 A, 150 A. */
const amps = (I: number) => (I < 100 && atMost(I, 1) ? fixed(I, 1) : show(I))

/**
 * Q = It: written as q1 (2.0 A for 30 s, 2 marks) and q7 (3.0 A for 5 minutes, 3 marks,
 * the minutes converted to seconds as a method mark).
 */
export const chargeFromCurrentAndTime: Generator = {
  id: 'charge-from-current-and-time',
  subjectId: 'physics',
  topicId: CURRENT,
  replaces: ['q1', 'q7'],
  build(r, slot, turn) {
    const inMinutes = slot.id === 'q7'
    const list = inMinutes ? FLOWS.filter((f) => f.minutes) : FLOWS
    const f = list[turn % list.length]!
    const { I, m, t, Q } = draw(
      r,
      (r) => {
        const I = pick(r, range(...f.amps))
        const m = inMinutes ? int(r, ...f.minutes!) : 0
        const t = inMinutes ? m * 60 : pick(r, range(...f.seconds))
        return { I, m, t, Q: clean(I * t) }
      },
      ({ I, m, t, Q }) => atMost(Q, 1) && noOnes(I, m, t) && noSum(I, t) && distinct(I, t) && clear(Q, I, t, ...(inMinutes ? [m] : [])) && (!inMinutes || distinct(I, m)),
    )
    const time = inMinutes ? `${m} minutes` : `${show(t)} s`
    const prompt = `${f.text(amps(I), time)} ${pick(r, ['What charge flows, in coulombs?', 'Calculate the charge that flows, in coulombs.'])}`
    const product = `Q = I t = ${amps(I)} \\times ${tex(t)}`
    const solution = inMinutes ? `${m} minutes is ${prose(t)} s, so ${closes(product, Q, 'C')} The time must be in seconds.` : closes(product, Q, 'C')
    // Second route: the charge over the current gives back the time.
    return numeric(
      slot,
      {
        prompt,
        solution,
        method: inMinutes ? [`converts to ${prose(t)} s`, `$${product}$`] : [`$${product}$`],
        answer: Q,
        tolerance: dpTolerance(Q),
        units: 'C',
      },
      { agrees: near(Q / I, t) && (!inMinutes || t === 60 * m), detail: `${Q} ÷ ${I} = ${show(Q / I)} s` },
      { context: f.name, I, t, ...(inMinutes ? { m } : {}) },
    )
  },
}

interface Device {
  name: string
  noun: string
  volts: number[]
  ohms: [number, number, number]
  amps: [number, number]
  /** The powers it really runs at, where that bounds it: a headlamp bulb is 20 W to 60 W. */
  watts?: [number, number]
}
/**
 * Components a pd is put across, with the pds, resistances and currents each really has. A
 * torch runs on one to four cells; a car's electrical system sits at 12 V to 14 V.
 */
const DEVICES: Device[] = [
  { name: 'resistor', noun: 'resistor', volts: range(1.5, 12, 0.5), ohms: [2, 100, 1], amps: [0.02, 3] },
  { name: 'filament lamp', noun: 'filament lamp', volts: range(1.5, 12, 0.5), ohms: [3, 40, 1], amps: [0.05, 3] },
  { name: 'torch bulb', noun: 'torch bulb', volts: [1.5, 3, 4.5, 6], ohms: [2, 30, 0.5], amps: [0.1, 1] },
  { name: 'car headlamp bulb', noun: 'car headlamp bulb', volts: range(12, 14, 0.5), ohms: [2.4, 9.6, 0.1], amps: [1.5, 5], watts: [20, 60] },
  { name: 'heating element', noun: 'heating element', volts: range(6, 12, 0.5), ohms: [1.5, 12, 0.5], amps: [0.5, 6] },
]

interface Ohmic {
  V: number
  R: number
  I: number
}
/** "a resistor of 15 Ω", "a filament lamp of resistance 15 Ω". */
const sized = (d: Device, R: number) => (d.noun === 'resistor' ? `a resistor of ${show(R)} Ω` : `${an(d.noun)} of resistance ${show(R)} Ω`)

const OHMIC = new Map<string, Ohmic[]>()
/** Every pd and resistance a device allows whose current is clean, in its range and at a power it has. */
function allOhmic(d: Device): Ohmic[] {
  return cached(OHMIC, d.name, () => {
    const out: Ohmic[] = []
    for (const V of d.volts) {
      for (const R of range(...d.ohms)) {
        const I = clean(V / R)
        if (!atMost(V / R, 2) || I < d.amps[0] || I > d.amps[1]) continue
        if (d.watts && (V * I < d.watts[0] || V * I > d.watts[1])) continue
        if (distinct(V, R, I) && noOnes(V, R, I)) out.push({ V, R, I })
      }
    }
    return out
  })
}
/**
 * A pd, resistance and current for one slot, the slot's answer drawn evenly first: the
 * current, the resistance or the pd, so 25 Ω or 0.5 A, which divide most often, carry no slot.
 */
function ohmic(r: Rng, d: Device, key: string, ok: (o: Ohmic) => boolean, answerOf: (o: Ohmic) => number): Ohmic {
  return evenly(r, `${key}:${d.name}`, () => allOhmic(d).filter(ok), answerOf)
}

/**
 * I = V ÷ R: written as current-potential-difference-and-resistance q5 and
 * resistance-and-ohms-law q2 (2 marks each).
 */
function currentFromPd(id: string, topicId: string, slotId: string): Generator {
  return {
    id,
    subjectId: 'physics',
    topicId,
    replaces: [slotId],
    build(r, slot, turn) {
      const d = DEVICES[turn % DEVICES.length]!
      const { V, R, I } = ohmic(r, d, id, (o) => clear(o.I, o.V, o.R), (o) => o.I)
      const thing = sized(d, R)
      const prompt = pick(r, [
        topicId === CURRENT
          ? `A potential difference of ${show(V)} V is applied across ${thing}. What is the current, in amperes?`
          : `${cap(thing)} has a potential difference of ${show(V)} V across it. Calculate the current, in amperes.`,
        `There is a potential difference of ${show(V)} V across ${thing}. ${topicId === CURRENT ? 'What is the current through it, in amperes?' : 'Calculate the current through it, in amperes.'}`,
      ])
      const expr = `I = V \\div R = ${tex(V)} \\div ${tex(R)}`
      return numeric(
        slot,
        {
          prompt,
          solution: closes(expr, I, 'A'),
          method: [topicId === CURRENT ? `rearranges $V = IR$: $I = ${tex(V)} \\div ${tex(R)}$` : `$I = V \\div R = ${tex(V)} \\div ${tex(R)}$`],
          answer: I,
          tolerance: dpTolerance(I),
          units: 'A',
        },
        // Second route: forwards, the current times the resistance is the pd.
        { agrees: near(I * R, V), detail: `${I} × ${R} = ${show(I * R)} V` },
        { context: d.name, V, R },
      )
    },
  }
}

/**
 * R = V ÷ I: written as current-potential-difference-and-resistance q6 and
 * resistance-and-ohms-law q5 (2 marks each).
 */
function resistanceFromPd(id: string, topicId: string, slotId: string): Generator {
  return {
    id,
    subjectId: 'physics',
    topicId,
    replaces: [slotId],
    build(r, slot, turn) {
      const d = DEVICES[turn % DEVICES.length]!
      const { V, R, I } = ohmic(r, d, id, (o) => clear(o.R, o.V, o.I), (o) => o.R)
      const prompt = pick(r, [
        topicId === CURRENT
          ? `A current of ${show(I)} A flows when ${show(V)} V is applied across ${an(d.noun)}. What is its resistance, in ohms?`
          : `${cap(an(d.noun))} has ${show(V)} V across it and carries ${show(I)} A. Calculate its resistance, in ohms.`,
        `${cap(an(d.noun))} carries a current of ${show(I)} A when the potential difference across it is ${show(V)} V. ${topicId === CURRENT ? 'What is its resistance, in ohms?' : 'Calculate its resistance, in ohms.'}`,
      ])
      const expr = `R = V \\div I = ${tex(V)} \\div ${tex(I)}`
      return numeric(
        slot,
        {
          prompt,
          solution: topicId === CURRENT ? closes(expr, R, 'Ω') : `${closes(expr, R, 'Ω')} Check: $${tex(I)} \\times ${tex(R)} = ${tex(V)}$ ✓`,
          method: [topicId === CURRENT ? `rearranges $V = IR$: $R = ${tex(V)} \\div ${tex(I)}$` : `$R = V \\div I = ${tex(V)} \\div ${tex(I)}$`],
          answer: R,
          tolerance: dpTolerance(R),
          units: 'Ω',
        },
        { agrees: near(I * R, V), detail: `${I} × ${R} = ${show(I * R)} V` },
        { context: d.name, V, I },
      )
    },
  }
}

/**
 * Where the pd is the answer it must be free to vary: a car headlamp is held at 12 V to 14 V
 * and a torch bulb runs on whole cells, so they are left out.
 */
const SPREAD_PD = DEVICES.filter((d) => ['resistor', 'filament lamp', 'heating element'].includes(d.name))

/** V = IR: written as resistance-and-ohms-law q4 (0.5 A through 24 Ω, 2 marks). */
export const pdFromCurrentAndResistance: Generator = {
  id: 'pd-from-current-and-resistance',
  subjectId: 'physics',
  topicId: OHMS,
  replaces: ['q4'],
  build(r, slot, turn) {
    const d = SPREAD_PD[turn % SPREAD_PD.length]!
    const { V, R, I } = ohmic(r, d, 'pd-from-current-and-resistance', (o) => clear(o.V, o.R, o.I) && noSum(o.I, o.R), (o) => o.V)
    const thing = sized(d, R)
    const prompt = pick(r, [
      `A current of ${show(I)} A flows through ${thing}. Calculate the potential difference across it, in volts.`,
      `${cap(thing)} carries a current of ${show(I)} A. Calculate the potential difference across it, in volts.`,
    ])
    const expr = `V = I R = ${tex(I)} \\times ${tex(R)}`
    return numeric(
      slot,
      { prompt, solution: closes(expr, V, 'V'), method: [`$${expr}$`], answer: V, tolerance: dpTolerance(V), units: 'V' },
      // Second route: the pd over the resistance gives back the current.
      { agrees: near(V / R, I), detail: `${V} ÷ ${R} = ${show(V / R)} A` },
      { context: d.name, I, R },
    )
  },
}

/** Where a supply and a current are named for P = VI, with the supply each really has. */
const POWERED: (Device & { across: (V: string, I: string) => string })[] = [
  { ...DEVICES[0]!, across: (V, I) => `A supply of ${V} V is connected across a resistor and a current of ${I} A flows.` },
  { ...DEVICES[1]!, across: (V, I) => `A filament lamp is connected to a supply of ${V} V and a current of ${I} A flows through it.` },
  { ...DEVICES[2]!, across: (V, I) => `A torch bulb is lit by a battery of ${V} V and carries a current of ${I} A.` },
  { ...DEVICES[3]!, across: (V, I) => `A car headlamp bulb runs at ${V} V from the car's electrical system and carries a current of ${I} A.` },
  { ...DEVICES[4]!, across: (V, I) => `A heating element is connected to a supply of ${V} V and a current of ${I} A flows.` },
]

/**
 * P = VI: written as resistance-and-ohms-law q9 (12 V and 3 A, 2 marks). The solution checks
 * with P = I²R, so the resistance V ÷ I is a clean figure too: it is drawn first.
 */
export const powerFromPdAndCurrent: Generator = {
  id: 'power-from-pd-and-current',
  subjectId: 'physics',
  topicId: OHMS,
  replaces: ['q9'],
  build(r, slot, turn) {
    const d = POWERED[turn % POWERED.length]!
    const { V, R, I } = ohmic(
      r,
      d,
      'power-from-pd-and-current',
      (o) => atMost(o.V * o.I, 2) && clear(clean(o.V * o.I), o.V, o.I) && noSum(o.V, o.I),
      (o) => clean(o.V * o.I),
    )
    const P = clean(V * I)
    const prompt = `${d.across(show(V), show(I))} ${pick(r, ['Calculate the power, in watts.', 'What is the power transferred, in watts?'])}`
    const I2 = clean(I * I)
    return numeric(
      slot,
      {
        prompt,
        solution: `${closes(`P = V I = ${tex(V)} \\times ${tex(I)}`, P, 'W')} Checking with the other form: the resistance is $${tex(V)} \\div ${tex(I)} = ${tex(R)}$ Ω, and $P = I^2 R = ${tex(I)}^2 \\times ${tex(R)} = ${tex(P)}$ W ✓`,
        method: [`$P = V I = ${tex(V)} \\times ${tex(I)}$`],
        answer: P,
        tolerance: dpTolerance(P),
        units: 'W',
      },
      { agrees: near(I2 * R, P), detail: `${I}² × ${R} = ${show(I2 * R)} W` },
      { context: d.name, V, I },
    )
  },
}

interface Change {
  c: number
  /** "Its resistance is doubled" */
  passive: string
  /** "its resistance doubles" */
  active: string
  /** "recognises the current halves" */
  effect: string
  /** "doubling the resistance halves the current" */
  rule: string
}
const CHANGES: Change[] = [
  { c: 2, passive: 'doubled', active: 'doubles', effect: 'halves', rule: 'doubling the resistance halves the current' },
  { c: 3, passive: 'tripled', active: 'triples', effect: 'falls to a third', rule: 'tripling the resistance cuts the current to a third' },
  { c: 4, passive: 'quadrupled', active: 'quadruples', effect: 'falls to a quarter', rule: 'quadrupling the resistance cuts the current to a quarter' },
  { c: 0.5, passive: 'halved', active: 'halves', effect: 'doubles', rule: 'halving the resistance doubles the current' },
]
interface Variable {
  name: string
  noun: string
  volts: number[]
  ohms: [number, number, number]
  /** The sentence that changes the resistance. */
  how: (ch: Change, from: string, to: string) => string
  /** Decimal places a current may have: a thermistor or LDR carries milliamps. */
  dp: number
}
/** Components whose resistance changes, by a setting, by temperature or by light. */
const VARIABLES: Variable[] = [
  { name: 'component', noun: 'component', volts: range(2, 12), ohms: [2, 60, 1], dp: 2, how: (ch, a, b) => `Its resistance is ${ch.passive} from ${a} Ω to ${b} Ω.` },
  { name: 'variable resistor', noun: 'variable resistor', volts: range(2, 12), ohms: [2, 100, 1], dp: 2, how: (ch, a, b) => `Its resistance is ${ch.passive} from ${a} Ω to ${b} Ω.` },
  {
    name: 'thermistor',
    noun: 'thermistor',
    volts: range(3, 12),
    ohms: [100, 1000, 10],
    dp: 3,
    how: (ch, a, b) => `As it ${ch.c > 1 ? 'cools' : 'warms up'}, its resistance ${ch.active} from ${a} Ω to ${b} Ω.`,
  },
  {
    name: 'light-dependent resistor',
    noun: 'light-dependent resistor (LDR)',
    volts: range(3, 12),
    ohms: [100, 2000, 50],
    dp: 3,
    how: (ch, a, b) => `As the light ${ch.c > 1 ? 'dims' : 'gets brighter'}, its resistance ${ch.active} from ${a} Ω to ${b} Ω.`,
  },
]

/**
 * A resistance changed at a fixed pd: written as resistance-and-ohms-law q14 (12 V across a
 * component, 4 Ω doubled to 8 Ω, 3 marks, no units). The change is doubled, tripled, four
 * times or halved, and the second method mark names what that does to the current.
 */
export const currentAfterResistanceChange: Generator = {
  id: 'current-after-resistance-change',
  subjectId: 'physics',
  topicId: OHMS,
  replaces: ['q14'],
  build(r, slot, turn) {
    const v = VARIABLES[turn % VARIABLES.length]!
    // The new current is drawn evenly, then a pd, change and resistance that give it, so a
    // thermistor's or LDR's smallest current is no likelier than any other.
    const { V, ch, R1, R2, I1, I2 } = evenly(
      r,
      `current-after-resistance-change:${v.name}`,
      () => {
        const out: { V: number; ch: Change; R1: number; R2: number; I1: number; I2: number }[] = []
        for (const V of v.volts) {
          for (const ch of CHANGES) {
            for (const R1 of range(...v.ohms)) {
              const R2 = clean(R1 * ch.c)
              if (!Number.isInteger(R2) || R2 < v.ohms[0] || R2 > v.ohms[1] || (R2 - v.ohms[0]) % v.ohms[2] !== 0) continue
              if (!atMost(V / R1, v.dp) || !atMost(V / R2, v.dp) || V / R2 < 0.005 || V / R1 > 6) continue
              const I1 = clean(V / R1)
              const I2 = clean(V / R2)
              if (distinct(V, R1, I1) && distinct(V, R2, I2) && noOnes(V, R1, R2, I1, I2) && clear(I2, V, R1, R2)) out.push({ V, ch, R1, R2, I1, I2 })
            }
          }
        }
        return out
      },
      (o) => o.I2,
    )
    const prompt = pick(r, [
      `A supply of ${show(V)} V is across ${an(v.noun)}. ${v.how(ch, show(R1), show(R2))} What is the new current, in amperes?`,
      `${cap(an(v.noun))} is connected to a supply of ${show(V)} V. ${v.how(ch, show(R1), show(R2))} What is the new current, in amperes?`,
    ])
    return numeric(
      slot,
      {
        prompt,
        solution: `Originally $I = V \\div R = ${tex(V)} \\div ${tex(R1)} = ${show(I1)}$ A. With $R$ ${ch.passive}, ${closes(`I = ${tex(V)} \\div ${tex(R2)}`, I2, 'A')} At a fixed potential difference, **${ch.rule}**.`,
        method: [`uses $I = V \\div R$ with the new resistance: $${tex(V)} \\div ${tex(R2)}$`, `recognises the current ${ch.effect}, from ${show(I1)} A`],
        answer: I2,
        tolerance: dpTolerance(I2),
      },
      // Second route: the old current scaled by the change.
      { agrees: near(I1 / ch.c, I2), detail: `${I1} ÷ ${ch.c} = ${show(I1 / ch.c)} A` },
      { context: v.name, V, R1, R2, change: ch.c },
    )
  },
}

export const circuitGenerators: Generator[] = [
  seriesResistance('series-resistance-rules', RULES, 'q2'),
  seriesCurrent('series-current-rules', RULES, 'q5'),
  seriesPd('series-pd-with-current-given', RULES, 'q6', true),
  parallelTotal('parallel-total-current-rules', RULES, 'q7'),
  seriesPartReplaced,
  chargeFromCurrentAndTime,
  currentFromPd('current-from-pd-and-resistance', CURRENT, 'q5'),
  resistanceFromPd('resistance-from-pd-and-current', CURRENT, 'q6'),
  currentFromPd('ohms-law-current', OHMS, 'q2'),
  pdFromCurrentAndResistance,
  resistanceFromPd('ohms-law-resistance', OHMS, 'q5'),
  powerFromPdAndCurrent,
  currentAfterResistanceChange,
  seriesResistance('series-resistance', SERIES_PARALLEL, 'q1'),
  seriesCurrent('series-current', SERIES_PARALLEL, 'q5'),
  seriesPd('series-pd', SERIES_PARALLEL, 'q6', false),
  parallelBranchCurrent,
  parallelTotal('parallel-total-current', SERIES_PARALLEL, 'q10'),
]
