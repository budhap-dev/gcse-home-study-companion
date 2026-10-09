import { clearOfHalf, fixed, show } from '../format.ts'
import { atMost, cap, figures, near, numeric, prose, tex } from '../physics/build.ts'
import { clearAtSigFigs, sfTolerance, sigFigs, sigText } from '../physics/format.ts'
import { draw, int, pick, shuffle, type Rng } from '../random.ts'
import type { Generator } from '../types.ts'
import { between, gcd, layered, rich, unitsOf } from './build.ts'
import { clean, clearOf, distinct, noOnes, places, powerOfTen, range, tenfold, threeFigures, toPlaces } from '../chemistry/build.ts'

/**
 * Bioenergetics and the food tests (AQA 8461, 4.1.4.1 enzymes and required practical 5, 4.2.2.1
 * the food tests and calorimetry, 4.4.1 photosynthesis and required practical 6, 4.4.2
 * respiration). Every numeric written slot in the four topics has a generator here but one: food
 * tests q4 asks the mass of 25 cm³ of water, which is the volume read again in grams, so its
 * answer is the given figure by design and there is nothing to work.
 *
 * Every figure is one the practical really gives. The amylase and starch test samples into iodine
 * every 10 seconds, so its times are whole tens of seconds; a catalase disc rises through hydrogen
 * peroxide in 5 to 60 s, timed to the half second; milk powder cleared by trypsin and milk turned
 * from pink by lipase take half a minute to a quarter of an hour. Rates use rate = 1000 ÷ time,
 * as the written slots do, and only times whose rate is exact with at most three figures are
 * drawn, so a rate printed in the working is the rate itself.
 *
 * Burned food heats 15 to 50 cm³ of water by 5 to 60 °C, and a piece of food weighs 0.2 to 2 g.
 * A simple calorimeter loses most of the heat, so the energy per gram found is 15 to 55% of the
 * value on the packet; packet values are the real ones, per 100 g: peanuts 2450 to 2650 kJ,
 * walnuts 2700 to 2850 kJ, cornflakes 1580 to 1650 kJ, marshmallows 1350 to 1450 kJ.
 *
 * Pondweed gives off 3 to 100 bubbles of oxygen a minute, or 1 to 20 cm³ an hour into a gas
 * syringe; lamps stand 5 to 100 cm away, and light intensity goes as 1/d². A respirometer's drop
 * moves about 1 to 8 mm a minute with germinating seeds, woodlice or maggots in it, and yeast with
 * glucose gives 2 to 30 bubbles of carbon dioxide a minute.
 */
const ENZYMES = 'enzymes-and-how-they-work'
const FOOD = 'food-tests-and-calorimetry'
const PHOTO = 'photosynthesis-and-limiting-factors'
const RESP = 'aerobic-and-anaerobic-respiration'

/** Exact to `dp` decimal places, with at most three significant figures. */
const tidy = (x: number, dp = 2) => atMost(x, dp) && figures(clean(x)) <= 3
/** An exact answer: half a unit in the last place it prints, none for a whole number. */
const exactTolerance = (x: number) => threeFigures(toPlaces(x, places(x)), x)
/** A fraction in maths: its decimal when that ends within four places, else p/q. */
const fracTex = (p: number, q: number) => (atMost(p / q, 4) ? show(p / q) : `\\dfrac{${p}}{${q}}`)

// =============================================================================================
// Enzymes: rate = 1000 ÷ time
// =============================================================================================

interface Practical {
  name: string
  /** As "In the …," names it. */
  short: string
  /** How the practical runs, so the time means something. */
  setup: string
  /** The end point, waiting for its time: "the iodine stopped turning blue-black after". */
  after: string
  /** Every time it can record, in s: on its own grid and at its own speed. */
  times: number[]
  /** The grid its repeats are read on, in s. */
  grid: number
}

/** Sampled into iodine every 10 s (the topic's own method): times are whole tens of seconds. */
const AMYLASE: Practical = {
  name: 'amylase',
  short: 'amylase and starch test',
  setup: 'In the amylase and starch practical, a drop of the mixture is added to iodine every 10 seconds; the starch has all been digested when the iodine stops turning blue-black.',
  after: 'the iodine stopped turning blue-black after',
  times: range(20, 800, 10),
  grid: 10,
}
/** A disc rises in 5 to 60 s, timed to the half second (repeats to a tenth). */
const CATALASE: Practical = {
  name: 'catalase',
  short: 'catalase disc test',
  setup: 'A filter paper disc soaked in catalase solution is dropped into a tube of hydrogen peroxide solution; the oxygen released carries the disc up to the surface.',
  after: 'the disc reached the surface after',
  times: range(5, 60, 0.5),
  grid: 0.1,
}
/** Half a minute to a quarter of an hour. */
const TRYPSIN: Practical = {
  name: 'trypsin',
  short: 'trypsin and milk test',
  setup: 'Trypsin, a protease, is added to a cloudy suspension of milk powder; the suspension goes clear as the milk protein is digested.',
  after: 'the suspension went clear after',
  times: range(30, 900),
  grid: 1,
}
/** One to fifteen minutes. */
const LIPASE: Practical = {
  name: 'lipase',
  short: 'lipase and milk test',
  setup: 'Lipase is added to milk mixed with sodium carbonate solution and phenolphthalein, which is pink in alkali; the fatty acids released neutralise the alkali, and the pink colour disappears.',
  after: 'the pink colour disappeared after',
  times: range(60, 900),
  grid: 1,
}
const PRACTICALS = [AMYLASE, CATALASE, TRYPSIN, LIPASE]

/** A rate as the answer: exact when 1000 ÷ t has at most three figures, else to 3 significant figures. */
interface Rate {
  t: number
  exact: boolean
  /** The answer: the rate itself, or its 3-figure rounding. */
  R: number
}
function rateAt(t: number): Rate {
  const e = clean(1000 / t)
  return tidy(e) && near(e * t, 1000) ? { t, exact: true, R: e } : { t, exact: false, R: sigFigs(1000 / t, 3) }
}
/** The marking room: half a unit in the last place of an exact rate, the 3-figure room of a rounded one. */
const rateTolerance = (x: Rate) => (x.exact ? exactTolerance(x.R) : sfTolerance(x.R, 3))
/** The rate as printed: 16.7, or 1.30 with its trailing zero. */
const rateText = (x: Rate) => (x.exact ? show(x.R) : sigText(1000 / x.t, 3))
/** The rate after its fraction in maths: "= 20" or "\approx 16.7". */
const rateEq = (x: Rate) => (x.exact ? `= ${show(x.R)}` : `\\approx ${rateText(x)}`)
/**
 * Times whose rate rounds clearly at three figures (or is exact), is never 1 nor a power of ten,
 * and is not the time with the point moved (100 s gives 10).
 */
const usable = (t: number) => {
  const x = rateAt(t)
  return (x.exact || clearAtSigFigs(1000 / t, 3)) && !powerOfTen(x.R) && noOnes(x.R) && !tenfold(x.R, t)
}
const rateTimes = (p: Practical) => p.times.filter(usable)
/** The working of 1000 ÷ t to its answer, as the solutions print it. */
const rateWorking = (x: Rate) =>
  x.exact ? `$\\dfrac{1000}{${show(x.t)}} = ${show(x.R)}$` : `$\\dfrac{1000}{${show(x.t)}} = ${cut(1000 / x.t, 5)}\\ldots$, which is ${rateText(x)} to 3 significant figures`

const RATE_PROMPTS = [
  (p: Practical, t: string) => `${p.setup} In one test, ${p.after} ${t} s. Calculate the rate using rate = 1000 ÷ time in seconds.`,
  (p: Practical, t: string) => `${p.setup} ${cap(p.after)} ${t} s. Using rate = 1000 ÷ time in seconds, calculate the rate of reaction.`,
  (p: Practical, t: string) => `${p.setup} A student finds that ${p.after} ${t} s. What is the rate of reaction, using rate = 1000 ÷ time in seconds?`,
  (p: Practical, t: string) => `${p.setup} When a student times the reaction, ${p.after} ${t} s. Using rate = 1000 ÷ time in seconds, what is the rate of reaction?`,
]

/** Rate = 1000 ÷ time, to 3 significant figures where it does not end sooner: written as q6 (50 s, 20). */
export const enzymeRate: Generator = {
  id: 'enzyme-rate',
  subjectId: 'biology',
  topicId: ENZYMES,
  replaces: ['q6'],
  build(r, slot, turn) {
    const p = PRACTICALS[turn % PRACTICALS.length]!
    const x = rateAt(pick(r, rateTimes(p)))
    return numeric(
      slot,
      {
        prompt: pick(r, RATE_PROMPTS)(p, show(x.t)),
        solution: `${rateWorking(x)}, in arbitrary units. The shorter the time, the higher the rate.`,
        method: ['divides 1000 by the time'],
        answer: x.R,
        tolerance: rateTolerance(x),
        units: unitsOf(slot),
        line: rateText(x),
      },
      // Second route: the rate kept for the whole time gives the 1000 back, to the rounding.
      { agrees: Math.abs(x.R * x.t - 1000) <= rateTolerance(x) * x.t + 1e-9, detail: `${show(x.R)} × ${show(x.t)} = ${show(x.R * x.t)}` },
      { context: p.name, t: x.t, rate: x.R },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q15: how many times faster, from two times
// ---------------------------------------------------------------------------------------------

interface Contrast {
  name: string
  p: Practical
  /** The faster condition, then the slower. */
  fast: string
  slow: string
  /** How many times faster the faster one is, lowest and highest. */
  k: readonly [number, number]
  /** The figures the two conditions print. */
  figures: number[]
  why: string
}
const CONTRASTS: Contrast[] = [
  { name: 'amylase pH 7 and 5', p: AMYLASE, fast: 'pH 7', slow: 'pH 5', k: [2, 5], figures: [7, 5], why: 'pH 5 is further from the optimum of amylase, so fewer active sites keep the shape that fits starch' },
  { name: 'amylase 40 and 20 °C', p: AMYLASE, fast: '40 °C', slow: '20 °C', k: [1.5, 4], figures: [40, 20], why: 'at 20 °C the molecules move more slowly, so enzyme and substrate collide less often' },
  { name: 'amylase 40 and 60 °C', p: AMYLASE, fast: '40 °C', slow: '60 °C', k: [2, 8], figures: [40, 60], why: 'at 60 °C many amylase molecules have denatured, so their active sites no longer fit starch' },
  { name: 'catalase 30 and 10 °C', p: CATALASE, fast: '30 °C', slow: '10 °C', k: [1.5, 4], figures: [30, 10], why: 'at 10 °C the molecules move more slowly, so enzyme and substrate collide less often' },
  { name: 'trypsin pH 8 and 5', p: TRYPSIN, fast: 'pH 8', slow: 'pH 5', k: [2, 6], figures: [8, 5], why: 'trypsin works best in the alkaline small intestine, and pH 5 changes the shape of its active site' },
  { name: 'lipase 35 and 15 °C', p: LIPASE, fast: '35 °C', slow: '15 °C', k: [1.5, 4], figures: [35, 15], why: 'at 15 °C the molecules move more slowly, so enzyme and substrate collide less often' },
]

interface Compared {
  t1: number
  t2: number
  k: number
}
/**
 * Pairs of times on the practical's grid whose ratio fits the contrast, exact to 1 place as the
 * written 3 is (2 places let one time own the odd ratios and fill a context), never a time with
 * the point moved, nor their difference, nor a condition's figure, nor one doubled or halved
 * (3.5 beside pH 7, 4 beside 40 °C).
 */
const compared = (c: Contrast): Compared[] =>
  c.p.times.flatMap((t1) =>
    c.p.times
      .filter((t2) => t2 > t1)
      .map((t2) => ({ t1, t2, k: clean(t2 / t1) }))
      .filter(({ t1, t2, k }) => tidy(k, 1) && between(k, c.k) && noOnes(k) && distinct(t1, t2, k) && !near(k, t2 - t1) && t2 <= 800 && clearOf(k, ...c.figures)),
  )

/** How many times faster, from the times: written as q15 (pH 7 20 s, pH 5 60 s, 3). */
export const enzymeTimesFaster: Generator = {
  id: 'enzyme-times-faster',
  subjectId: 'biology',
  topicId: ENZYMES,
  replaces: ['q15'],
  build(r, slot, turn) {
    const c = CONTRASTS[turn % CONTRASTS.length]!
    // The ratio first, among those two times or more give, then the time.
    const x = layered(r, `enzyme-times-faster:${c.name}`, () => rich(compared(c), (y) => y.k, (y) => y.t1, 2), (y) => y.k, (y) => y.t1)
    const fastFirst = r() < 0.5
    const [a, ta, b, tb] = fastFirst ? [c.fast, x.t1, c.slow, x.t2] : [c.slow, x.t2, c.fast, x.t1]
    const prompt =
      `${c.p.setup} At ${a} ${c.p.after} ${show(ta)} s; at ${b} it took ${show(tb)} s. ` +
      `A student says the reaction at ${c.slow} was faster, because ${show(x.t2)} is the bigger number. Calculate how many times faster the reaction at ${c.fast} actually was.`
    return numeric(
      slot,
      {
        prompt,
        solution:
          `The student has it the wrong way round: a **longer** time is a **slower** reaction. Rates are $\\dfrac{1000}{${show(x.t1)}} ${rateEq(rateAt(x.t1))}$ at ${c.fast} and $\\dfrac{1000}{${show(x.t2)}} ${rateEq(rateAt(x.t2))}$ at ${c.slow}, ` +
          `and $\\dfrac{1000/${show(x.t1)}}{1000/${show(x.t2)}} = \\dfrac{${show(x.t2)}}{${show(x.t1)}} = ${show(x.k)}$. More simply, **${show(x.k)} times the time means a rate ${show(x.k)} times smaller**, so ${c.fast} is **${show(x.k)} times** faster: ${c.why}.`,
        method: [`converts both times to rates, or compares the times directly: ${show(x.t2)} ÷ ${show(x.t1)}`],
        answer: x.k,
        tolerance: exactTolerance(x.k),
        units: unitsOf(slot),
        line: `${show(x.k)} times faster`,
      },
      // Second route: the two rates divided.
      { agrees: near(1000 / x.t1 / (1000 / x.t2), x.k), detail: `${show(1000 / x.t1)} ÷ ${show(1000 / x.t2)}` },
      { context: c.name, t1: x.t1, t2: x.t2, k: x.k, fastFirst: String(fastFirst) },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q25: the mean of three repeats, then the rate
// ---------------------------------------------------------------------------------------------

/** The widest a set of three repeats runs, highest less lowest, as a share of their mean: the written 38, 40, 42 s run 10%. */
const SPREAD = 0.15
/**
 * Three repeats about a mean, on the practical's grid, running at most SPREAD of the mean from
 * highest to lowest. Two may be equal, or one may sit on the mean, as the written 40 s does; all
 * three equal is no repeat.
 */
function repeats(r: Rng, mean: number, grid: number, spread = SPREAD): number[] {
  const most = Math.floor((mean * spread) / grid + 1e-9)
  const devs = draw(
    r,
    () => {
      const d1 = int(r, -most, most)
      const d2 = int(r, -most, most)
      return [d1, d2, -d1 - d2]
    },
    (ds) => Math.max(...ds) - Math.min(...ds) <= most && ds.some((d) => d !== 0),
  )
  return devs.map((d) => clean(mean + d * grid))
}
/** Means on the grid with room for repeats two grid steps apart: amylase, sampled every 10 s, from 140 s. */
const meanTimes = (p: Practical) => rateTimes(p).filter((m) => Math.floor((m * SPREAD) / p.grid + 1e-9) >= 2)

const MEAN_PROMPTS = [
  (p: Practical, ts: string) => `${p.setup} A student repeats the test three times. ${cap(p.after)} ${ts}. Calculate the mean time, then calculate the rate using rate = 1000 ÷ time in seconds.`,
  (p: Practical, ts: string) => `A student repeats the ${p.short} three times. ${p.setup} ${cap(p.after)} ${ts}. Calculate the mean time, then calculate the rate using rate = 1000 ÷ time in seconds.`,
]

/** Mean time then 1000 ÷ mean: written as q25 (38, 40 and 42 s, 25). */
export const enzymeMeanRate: Generator = {
  id: 'enzyme-mean-rate',
  subjectId: 'biology',
  topicId: ENZYMES,
  replaces: ['q25'],
  build(r, slot, turn) {
    const p = PRACTICALS[turn % PRACTICALS.length]!
    const x = rateAt(pick(r, meanTimes(p)))
    const m = x.t
    const ts = draw(
      r,
      () => shuffle(r, repeats(r, m, p.grid)),
      (xs) => xs.every((y) => !tenfold(y, x.R) && y > 0),
    )
    const sum = clean(ts[0]! + ts[1]! + ts[2]!)
    const list = `${show(ts[0]!)} s, ${show(ts[1]!)} s and ${show(ts[2]!)} s`
    return numeric(
      slot,
      {
        prompt: pick(r, MEAN_PROMPTS)(p, list),
        solution:
          `Mean time first: $\\dfrac{${ts.map(show).join(' + ')}}{3} = \\dfrac{${show(sum)}}{3} = ${show(m)}$ s. Then the rate: ${rateWorking(x)}. ` +
          `A shorter time means a faster reaction, and the rate turns that round so that a bigger number means faster; here it is ${rateText(x)}.`,
        method: [`mean time ${show(m)} s`, `divides 1000 by ${show(m)}`],
        answer: x.R,
        tolerance: rateTolerance(x),
        units: unitsOf(slot),
        line: rateText(x),
      },
      // Second route: the repeats' differences from the mean add to nothing, and the rate gives 1000 back.
      {
        agrees: near(ts.reduce((s, y) => s + (y - m), 0), 0) && Math.abs(x.R * m - 1000) <= rateTolerance(x) * m + 1e-9,
        detail: `${ts.map((y) => show(y - m)).join(' + ')} = 0; ${show(x.R)} × ${show(m)} = ${show(x.R * m)}`,
      },
      { context: p.name, t1: ts[0]!, t2: ts[1]!, t3: ts[2]!, mean: m, rate: x.R },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q26: the percentage increase in rate, from two times
// ---------------------------------------------------------------------------------------------

interface Rise {
  name: string
  p: Practical
  /** The first condition and the second, faster one. */
  from: string
  to: string
  /** The change, as "when the … was …". */
  change: string
  /** The percentage increases it gives, lowest and highest. */
  pct: readonly [number, number]
  /** Every figure the prompt prints besides the times. */
  figures: number[]
  why: string
}
const WARMER = 'gives the molecules more kinetic energy, so enzyme and substrate collide more often'
const RISES: Rise[] = [
  {
    name: 'amylase 30 to 40 °C', p: AMYLASE, from: '30 °C', to: '40 °C', change: 'temperature was raised from 30 °C to 40 °C', pct: [30, 220], figures: [30, 40],
    why: `Warming the mixture ${WARMER}, and at 40 °C amylase is at or near its optimum, so it has not yet begun to denature.`,
  },
  {
    name: 'amylase 20 to 30 °C', p: AMYLASE, from: '20 °C', to: '30 °C', change: 'temperature was raised from 20 °C to 30 °C', pct: [30, 220], figures: [20, 30],
    why: `Warming the mixture ${WARMER}; 30 °C is still below the optimum of amylase.`,
  },
  {
    name: 'amylase pH 5 to 7', p: AMYLASE, from: 'pH 5', to: 'pH 7', change: 'pH was changed from 5 to 7', pct: [50, 400], figures: [5, 7],
    why: 'At pH 7 amylase is at about its optimum, so more of its active sites have the shape that fits starch.',
  },
  {
    name: 'catalase 15 to 25 °C', p: CATALASE, from: '15 °C', to: '25 °C', change: 'temperature was raised from 15 °C to 25 °C', pct: [30, 220], figures: [15, 25],
    why: `Warming the mixture ${WARMER}; 25 °C is still below the optimum of catalase.`,
  },
  {
    name: 'trypsin 25 to 35 °C', p: TRYPSIN, from: '25 °C', to: '35 °C', change: 'temperature was raised from 25 °C to 35 °C', pct: [30, 220], figures: [25, 35],
    why: `Warming the mixture ${WARMER}; 35 °C is still at or below the optimum of trypsin.`,
  },
  {
    name: 'lipase 20 to 30 °C', p: LIPASE, from: '20 °C', to: '30 °C', change: 'temperature was raised from 20 °C to 30 °C', pct: [30, 220], figures: [20, 30],
    why: `Warming the mixture ${WARMER}; 30 °C is still below the optimum of lipase.`,
  },
]

interface Increase {
  t1: number
  t2: number
  r1: Rate
  r2: Rate
  /** The increase, a whole percentage, exact from the times. */
  pct: number
  /** The increase worked from the printed rates, which a student keying them reaches. */
  worked: number
  /** The percentage fall in time, the slip the written solution names. */
  fall: number
}
/** Room for an increase worked from 3-figure rates: half a percentage point, never over 1.9%. */
const increaseTolerance = (pct: number) => Number(Math.min(0.5, pct * 0.019).toPrecision(10))
/**
 * The time ratio first, as a whole-number increase, then the pairs of times on the grid that give
 * it. Rates are printed to 3 significant figures, so only pairs whose increase worked from those
 * printed rates (and that rounded to three figures) lands within the tolerance are kept. Never
 * 100%, and none of the figures printed or worked: not a time, a rate, the increase in rate, the
 * percentage fall in time, nor a temperature or pH, the same, with the point moved, doubled or
 * halved (60% beside 30 °C).
 */
const increases = (c: Rise): Increase[] => {
  const ts = rateTimes(c.p)
  const on = new Set(ts.map((t) => show(t)))
  const out: Increase[] = []
  for (let pct = c.pct[0]; pct <= c.pct[1]; pct++) {
    if (powerOfTen(pct)) continue
    const tol = increaseTolerance(pct)
    for (const t2 of ts) {
      const t1 = clean((t2 * (100 + pct)) / 100)
      if (!on.has(show(t1))) continue
      const r1 = rateAt(t1)
      const r2 = rateAt(t2)
      const a = Number(rateText(r1))
      const b = Number(rateText(r2))
      const worked = ((b - a) / a) * 100
      if (Math.abs(worked - pct) > tol * 0.9 || Math.abs(sigFigs(worked, 3) - pct) > tol * 0.9) continue
      const fall = ((t1 - t2) / t1) * 100
      if (!clearOf(pct, t1, t2, a, b, clean(b - a), sigFigs(fall, 3), ...c.figures)) continue
      out.push({ t1, t2, r1, r2, pct, worked, fall })
    }
  }
  return out
}

const INCREASE_PROMPTS = [
  (c: Rise, x: Increase) =>
    `${c.p.setup} At ${c.from}, ${c.p.after} ${show(x.t1)} s; at ${c.to}, ${c.p.after} ${show(x.t2)} s. Using rate = 1000 ÷ time in seconds, calculate the percentage increase in the rate of reaction when the ${c.change}.`,
  // The written slot's own shape, which names no set-up: only for amylase, whose iodine test the topic teaches.
  (c: Rise, x: Increase) =>
    `In the ${c.p.short}, ${c.p.after} ${show(x.t1)} s at ${c.from} and after ${show(x.t2)} s at ${c.to}. Using rate = 1000 ÷ time in seconds, calculate the percentage increase in the rate of reaction when the ${c.change}.`,
]

/** Rates from both times, then (new − old) ÷ old × 100: written as q26 (50 s and 20 s, 150%). */
export const enzymeRateIncrease: Generator = {
  id: 'enzyme-rate-increase',
  subjectId: 'biology',
  topicId: ENZYMES,
  replaces: ['q26'],
  build(r, slot, turn) {
    const c = RISES[turn % RISES.length]!
    // The time ratio (so the increase) and the faster time in either order: an exact rate such as
    // 250 s (4) gives the most whole increases, so the increase first gives it half a context.
    const levels: ((y: Increase) => number)[] = r() < 0.5 ? [(y) => y.pct, (y) => y.t2] : [(y) => y.t2, (y) => y.pct]
    const x = layered(r, `enzyme-rate-increase:${c.name}`, () => increases(c), ...levels)
    const a = rateText(x.r1)
    const b = rateText(x.r2)
    // The difference to as many places as the rates print: 5 − 2.30 = 2.70.
    const dp = Math.max(...[a, b].map((v) => (v.includes('.') ? v.split('.')[1]!.length : 0)))
    const d = (Number(b) - Number(a)).toFixed(dp)
    const exactly = x.r1.exact && x.r2.exact && near(x.worked, x.pct)
    const fall = atMost(x.fall, 2) ? `= ${show(x.fall)}` : `\\approx ${sigText(x.fall, 3)}`
    const tolerance = increaseTolerance(x.pct)
    return numeric(
      slot,
      {
        prompt: pick(r, c.p === AMYLASE ? INCREASE_PROMPTS : INCREASE_PROMPTS.slice(0, 1))(c, x),
        solution:
          `Convert both times to rates first: at ${c.from}, $\\dfrac{1000}{${show(x.t1)}} ${rateEq(x.r1)}$; at ${c.to}, $\\dfrac{1000}{${show(x.t2)}} ${rateEq(x.r2)}$. ` +
          `The increase is $${b} - ${a} = ${d}$, and as a percentage of the original rate, ` +
          (exactly
            ? `$\\dfrac{${d}}{${a}} \\times 100 = ${show(x.pct)}\\%$. `
            : `$\\dfrac{${d}}{${a}} \\times 100 = ${fixed(x.worked, 1)}\\%$, which is ${x.pct}% to the nearest whole number (from the times exactly, $\\left(\\dfrac{${show(x.t1)}}{${show(x.t2)}} - 1\\right) \\times 100 = ${x.pct}\\%$). `) +
          `Working from the times instead gives $\\dfrac{${show(x.t1)} - ${show(x.t2)}}{${show(x.t1)}} \\times 100 ${fall}\\%$, which is the percentage fall in **time**, not the rise in rate. ${c.why}`,
        method: [`converts both times to rates: ${a} and ${b}`, `(${b} − ${a}) ÷ ${a} × 100`],
        answer: x.pct,
        tolerance,
        units: unitsOf(slot),
      },
      // Second route: from the times alone, the new rate is old × t1 ÷ t2; and the printed rates land within the tolerance.
      { agrees: near((x.t1 / x.t2 - 1) * 100, x.pct) && Math.abs(x.worked - x.pct) <= tolerance, detail: `(${show(x.t1)} ÷ ${show(x.t2)} − 1) × 100; from the printed rates ${x.worked.toFixed(3)}` },
      { context: c.name, t1: x.t1, t2: x.t2, pct: x.pct },
    )
  },
}

// =============================================================================================
// Calorimetry
// =============================================================================================

interface Food {
  name: string
  /** As "burns 0.6 g of …" and "per gram of …" name it. */
  noun: string
  /** As the packet names it: "A packet of peanuts". */
  packetText: string
  /** The packet's value, kJ per 100 g, lowest and highest. */
  packet: readonly [number, number]
  /** Masses of the piece burned, in g. */
  masses: number[]
}
/** Real packet values per 100 g. A piece of a nut or a crisp, a few flakes of cereal. */
const FOODS: Food[] = [
  { name: 'peanut', noun: 'peanut', packetText: 'A packet of roasted peanuts states that they contain', packet: [2450, 2650], masses: range(0.3, 0.9, 0.1) },
  { name: 'cashew', noun: 'cashew nut', packetText: 'A bag of cashew nuts states that they contain', packet: [2400, 2550], masses: range(0.6, 1.8, 0.1) },
  { name: 'walnut', noun: 'walnut', packetText: 'A bag of walnuts states that they contain', packet: [2700, 2850], masses: range(0.3, 1.5, 0.1) },
  { name: 'crisps', noun: 'ready salted crisp', packetText: 'A packet of ready salted crisps states that they contain', packet: [2100, 2250], masses: range(0.3, 1.5, 0.1) },
  { name: 'cornflakes', noun: 'cornflakes', packetText: 'A box of cornflakes states that they contain', packet: [1580, 1650], masses: range(0.2, 1, 0.1) },
  { name: 'pasta', noun: 'dried pasta', packetText: 'A packet of dried pasta states that it contains', packet: [1480, 1550], masses: range(0.2, 1.6, 0.1) },
  { name: 'marshmallow', noun: 'marshmallow', packetText: 'A bag of marshmallows states that they contain', packet: [1350, 1450], masses: range(0.4, 2.5, 0.1) },
  { name: 'crispbread', noun: 'crispbread', packetText: 'A packet of crispbread states that it contains', packet: [1400, 1550], masses: range(0.4, 2.5, 0.1) },
]
/** What a simple calorimeter finds, as a share of the packet's value. */
const FOUND: readonly [number, number] = [0.15, 0.55]
/** The energy per gram, J/g, a food burned in the lab can give. */
const labRange = (f: Food): [number, number] => [FOUND[0] * f.packet[0] * 10, FOUND[1] * f.packet[1] * 10]

interface Burn {
  V: number
  dT: number
  m: number
  E: number
  /** Energy per gram, J/g. */
  L: number
}
/** Water heated by burning food: 15 to 50 cm³, never 10, by 5 to 60 °C. */
const WATER = range(15, 50, 5)
const RISES_C = range(5, 60)
const BURNS = new Map<string, Burn[]>()
/**
 * Every water volume, rise and mass whose energy per gram is a whole number with at most three
 * figures, in the lab's range for the food, and none of the figures given or worked: not the
 * energy (nor it doubled, so never 0.5 g), the volume, the rise, the mass or the 4.2 (4200 J/g).
 */
function burns(f: Food, maxV = 50): Burn[] {
  const key = `${f.name}:${maxV}`
  const hit = BURNS.get(key)
  if (hit) return hit
  const out: Burn[] = []
  for (const V of WATER.filter((v) => v <= maxV))
    for (const dT of RISES_C)
      for (const m of f.masses) {
        const E = clean(V * 4.2 * dT)
        const L = clean(E / m)
        if (Number.isInteger(L) && figures(L) <= 3 && near(L * m, E) && between(L, labRange(f)) && noOnes(m) && clearOf(L, E, V, dT, m, 4.2) && distinct(V, dT)) out.push({ V, dT, m, E, L })
      }
  BURNS.set(key, out)
  return out
}

const PER_GRAM_PROMPTS = [
  (f: Food, b: Burn) => `Burning ${show(b.m)} g of ${f.noun} raised the temperature of ${b.V} cm³ of water by ${b.dT} °C. Calculate the energy released per gram of ${f.noun}, in J/g.`,
  (f: Food, b: Burn) => `A student burns ${show(b.m)} g of ${f.noun} under ${b.V} cm³ of water, and the temperature of the water rises by ${b.dT} °C. Calculate the energy released per gram of ${f.noun}, in J/g.`,
]
const EQUATION = 'Use energy transferred (J) = mass of water (g) × 4.2 × temperature rise (°C); 1 cm³ of water has a mass of 1 g.'

/**
 * Mass of water × 4.2 × rise, ÷ mass of food: written as q6 (0.8 g, 50 cm³, 20 °C, 5250 J/g) and
 * q25 (0.3 g of cereal, 40 cm³ from 17 °C to 32 °C, 8400 J/g), which gives the two readings.
 */
export const calorimetryPerGram: Generator = {
  id: 'calorimetry-per-gram',
  subjectId: 'biology',
  topicId: FOOD,
  replaces: ['q6', 'q25'],
  build(r, slot, turn) {
    const f = FOODS[turn % FOODS.length]!
    const readings = slot.id === 'q25'
    // A boiling tube holds 40 cm³ comfortably; the rise-only slot does not name the vessel. The volume
    // and mass first: drawing the answer first let the mass that divides most cleanly take 60% of the builds.
    const b = layered(r, `calorimetry-per-gram:${slot.id}:${f.name}`, () => burns(f, readings ? 40 : 50), (x) => x.V, (x) => x.m, (x) => x.L)
    const start = readings ? pick(r, range(14, 22).filter((s) => distinct(s, s + b.dT, b.dT, b.V))) : 0
    const end = start + b.dT
    const energy = `${b.V} \\times 4.2 \\times ${b.dT} = ${tex(b.E)}`
    const prompt = readings
      ? `A student burns ${show(b.m)} g of ${f.noun} under a boiling tube containing ${b.V} cm³ of water. The temperature of the water rises from ${start} °C to ${end} °C. Calculate the energy released per gram of ${f.noun}, in J/g. ${EQUATION}`
      : pick(r, PER_GRAM_PROMPTS)(f, b)
    const solution = readings
      ? `Temperature rise $= ${end} - ${start} = ${b.dT}$ °C, and ${b.V} cm³ of water has a mass of **${b.V} g**. Energy transferred to the water $= ${energy}$ J. Per gram of **${f.noun}**: $\\dfrac{${tex(b.E)}}{${show(b.m)}} = ${tex(b.L)}$ J/g. ` +
        `Divide by the mass of the **food**, not the water${b.m < 1 ? ', and dividing by a mass below 1 g must make the number bigger, which is a quick check' : ''}.`
      : `Energy: $${energy}$ J. Per gram: $\\dfrac{${tex(b.E)}}{${show(b.m)}} = ${tex(b.L)}$ J/g.`
    return numeric(
      slot,
      {
        prompt,
        solution: b.L >= 10000 ? solution.replace(`= ${tex(b.L)}$ J/g.`, `$, which is **${b.L} J/g**.`) : solution,
        method: readings
          ? [`temperature rise ${b.dT} °C, and energy = ${b.V} × 4.2 × ${b.dT} = ${prose(b.E)} J`, `divides by ${show(b.m)} g, the mass of the food`]
          : [`uses mass of water × 4.2 × temperature rise: ${b.V} × 4.2 × ${b.dT} = ${prose(b.E)} J`, `divides by ${show(b.m)} g, the mass of the food`],
        answer: b.L,
        tolerance: exactTolerance(b.L),
        units: unitsOf(slot),
        line: `${prose(b.L)} J/g`,
      },
      // Second route: the energy per gram times the mass, shared over the water, gives the rise back.
      { agrees: near((b.L * b.m) / (b.V * 4.2), b.dT), detail: `${b.L} × ${show(b.m)} ÷ (${b.V} × 4.2) = ${show((b.L * b.m) / (b.V * 4.2))} °C` },
      { context: f.name, V: b.V, dT: b.dT, m: b.m, ...(readings ? { start } : {}), L: b.L },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q15: two foods compared per gram
// ---------------------------------------------------------------------------------------------

interface Matchup {
  name: string
  /** The food with more energy per gram, then the one with less. */
  rich: Food
  poor: Food
  /** As the setup names each piece. */
  richPiece: string
  poorPiece: string
}
const food = (name: string) => FOODS.find((f) => f.name === name)!
const MATCHUPS: Matchup[] = [
  { name: 'peanut and crispbread', rich: food('peanut'), poor: food('crispbread'), richPiece: 'a peanut', poorPiece: 'a piece of crispbread' },
  { name: 'walnut and marshmallow', rich: food('walnut'), poor: food('marshmallow'), richPiece: 'a piece of walnut', poorPiece: 'a piece of marshmallow' },
  { name: 'cashew and crispbread', rich: food('cashew'), poor: food('crispbread'), richPiece: 'a cashew nut', poorPiece: 'a piece of crispbread' },
  { name: 'crisps and pasta', rich: food('crisps'), poor: food('pasta'), richPiece: 'a ready salted crisp', poorPiece: 'a piece of dried pasta' },
]
/** Energies a boiling tube of water can take up from one piece: 500 to 10 000 J. */
const ENERGY: readonly [number, number] = [500, 10000]
/** Energies per gram on a 100 J/g grid. */
const grid100 = (lo: number, hi: number) => range(Math.ceil(lo / 100) * 100, Math.floor(hi / 100) * 100, 100)

interface Duel {
  pR: number
  pP: number
  k: number
}
/**
 * How many times more per gram, exact to 2 places (the written 1.4 is marked to 0.01): at least 1.2, and 0.8 to
 * 1.3 times the packets' ratio, since both foods lose heat the same way in the same apparatus.
 */
/** The packet values' ratio, middle to middle: the lab ratio stays within 0.8 to 1.3 times it. */
const packetRatio = (x: Matchup) => (x.rich.packet[0] + x.rich.packet[1]) / (x.poor.packet[0] + x.poor.packet[1])
const duels = (x: Matchup): Duel[] =>
  grid100(...labRange(x.rich)).flatMap((pR) =>
    grid100(...labRange(x.poor))
      .map((pP) => ({ pR, pP, k: clean(pR / pP) }))
      .filter(({ k }) => tidy(k, 2) && between(k, [Math.max(1.2, 0.8 * packetRatio(x)), 1.3 * packetRatio(x)]) && noOnes(k)),
  )
interface Pieces {
  mR: number
  mP: number
  eR: number
  eP: number
}
/**
 * Masses of each food's own pieces such that the food with less energy per gram releases more joules (the
 * student's mistake depends on it), both energies in range, no mass a match for the answer, and
 * the raw joules' ratio at least 0.1 from it, so comparing them is never marked right.
 */
const pieces = (x: Matchup, d: Duel): Pieces[] =>
  x.rich.masses.filter((m) => noOnes(m)).flatMap((mR) =>
    x.poor.masses.filter((m) => noOnes(m)).map((mP) => ({ mR, mP, eR: clean(d.pR * mR), eP: clean(d.pP * mP) })).filter(
      ({ mR, mP, eR, eP }) => eP > eR * 1.05 && between(eR, ENERGY) && between(eP, ENERGY) && mR !== mP && clearOf(d.k, mR, mP, eR, eP) && Math.abs(eP / eR - d.k) >= 0.1 && distinct(eR, eP, d.pR, d.pP),
    ),
  )
/** Every duel with every set of pieces that suits it. */
interface Bout {
  d: Duel
  s: Pieces
}
const bouts = (x: Matchup): Bout[] => duels(x).flatMap((d) => pieces(x, d).map((s) => ({ d, s })))

/** Energy ÷ mass for each, then one ÷ the other: written as q15 (2100 J from 0.5 g against 3000 J from 1.0 g, 1.4). */
export const foodComparison: Generator = {
  id: 'calorimetry-food-comparison',
  subjectId: 'biology',
  topicId: FOOD,
  replaces: ['q15'],
  build(r, slot, turn) {
    const x = MATCHUPS[turn % MATCHUPS.length]!
    // The richer food's mass first (a small piece is the only one that can release fewer joules,
    // and drawing the ratio first let one mass take 83% of a context), then the ratio and the
    // poorer food's energy per gram in either order: 5000 J/g gives the most ratios, so the ratio
    // first gives it half a context, and it first gives ratio 2 or 1.5 the same.
    const kp: ((y: Bout) => number)[] = r() < 0.5 ? [(y) => y.d.k, (y) => y.d.pP] : [(y) => y.d.pP, (y) => y.d.k]
    const { d, s } = layered(r, `calorimetry-food-comparison:${x.name}`, () => rich(bouts(x), (y) => y.s.mR, (y) => y.d.k, 6), (y) => y.s.mR, ...kp, (y) => y.s.mP)
    // Which letter the richer food carries: half each, so "A is the better one" pays half the time.
    const richIsA = r() < 0.5
    const [A, B] = richIsA ? ['A', 'B'] : ['B', 'A']
    const pieceA = richIsA ? x.richPiece : x.poorPiece
    const pieceB = richIsA ? x.poorPiece : x.richPiece
    const [eA, mA, pA] = richIsA ? [s.eR, s.mR, d.pR] : [s.eP, s.mP, d.pP]
    const [eB, mB, pB] = richIsA ? [s.eP, s.mP, d.pP] : [s.eR, s.mR, d.pR]
    const prompt =
      `A student burns ${pieceA} (Food A) and ${pieceB} (Food B), each under a boiling tube of water. Food A gives ${prose(eA)} J from ${show(mA)} g. Food B gives ${prose(eB)} J from ${show(mB)} g. ` +
      `A second student says Food ${B} contains more energy, because it released more joules. Calculate how many times more energy per gram Food ${A} contains than Food ${B}.`
    return numeric(
      slot,
      {
        prompt,
        solution:
          `Food A: $\\dfrac{${tex(eA)}}{${show(mA)}} = ${tex(pA)}$ J/g. Food B: $\\dfrac{${tex(eB)}}{${show(mB)}} = ${tex(pB)}$ J/g. Then $\\dfrac{${tex(d.pR)}}{${tex(d.pP)}} = ${show(d.k)}$. ` +
          `Comparing the **raw** joules would have made Food ${B} look better, which is exactly why the per-gram step exists.`,
        method: [`finds ${prose(pA)} J/g for Food A`, `finds ${prose(pB)} J/g for Food B`],
        answer: d.k,
        tolerance: threeFigures(toPlaces(d.k, 2), d.k),
        units: unitsOf(slot),
        line: `${show(d.k)} times`,
      },
      // Second route: the energies and masses in one fraction.
      { agrees: near((s.eR * s.mP) / (s.eP * s.mR), d.k), detail: `(${s.eR} × ${show(s.mP)}) ÷ (${s.eP} × ${show(s.mR)})` },
      { context: x.name, pR: d.pR, pP: d.pP, mR: s.mR, mP: s.mP, k: d.k, richIsA: String(richIsA) },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q26: the lab's value as a percentage of the packet's
// ---------------------------------------------------------------------------------------------

interface Labelled {
  burn: Burn
  P: number
  pct: number
}
/** Packet values on a 10 kJ grid; the lab value 15 to 55% of it, exact to 1 place, at most three figures. */
const LABELLED = new Map<string, Labelled[]>()
function labelled(f: Food): Labelled[] {
  const hit = LABELLED.get(f.name)
  if (hit) return hit
  const out: Labelled[] = []
  const Ps = range(f.packet[0], f.packet[1], 10)
  for (const burn of burns(f, 40))
    for (const P of Ps) {
      const pct = clean((burn.L / (P * 10)) * 100)
      if (tidy(pct, 1) && between(pct, [FOUND[0] * 100, FOUND[1] * 100]) && clearOf(pct, burn.V, burn.dT, burn.m)) out.push({ burn, P, pct })
    }
  LABELLED.set(f.name, out)
  return out
}

/** Energy per gram from the burning, then ÷ the packet's in J/g: written as q26 (6300 J/g against 2100 kJ per 100 g, 30%). */
export const calorimetryPacket: Generator = {
  id: 'calorimetry-packet-percentage',
  subjectId: 'biology',
  topicId: FOOD,
  replaces: ['q26'],
  build(r, slot, turn) {
    const f = FOODS[turn % FOODS.length]!
    // The packet, the mass and the water in turn, in one of three orders: 0.7 g and 30 cm³ divide 4.2
    // most cleanly, so whichever always came later filled nearly half a context.
    const P = (y: Labelled) => y.P
    const m = (y: Labelled) => y.burn.m
    const V = (y: Labelled) => y.burn.V
    const x = layered(r, `calorimetry-packet-percentage:${f.name}`, () => labelled(f), ...pick(r, [[P, m, V], [P, V, m], [V, P, m]]), (y) => y.pct)
    const b = x.burn
    const start = pick(r, range(14, 22).filter((s) => distinct(s, s + b.dT, b.dT, b.V) && !tenfold(s, x.pct) && !tenfold(s + b.dT, x.pct)))
    const end = start + b.dT
    const perGram = x.P * 10
    return numeric(
      slot,
      {
        prompt:
          `${f.packetText} ${prose(x.P)} kJ per 100 g. A student burns ${show(b.m)} g of ${f.noun} under a boiling tube containing ${b.V} cm³ of water, and the temperature of the water rises from ${start} °C to ${end} °C. ` +
          `Calculate the energy per gram found by the student as a percentage of the packet's value. ${EQUATION}`,
        solution:
          `Temperature rise $= ${end} - ${start} = ${b.dT}$ °C. Energy transferred to the water $= ${b.V} \\times 4.2 \\times ${b.dT} = ${tex(b.E)}$ J. Per gram of ${f.noun}: $\\dfrac{${tex(b.E)}}{${show(b.m)}} = ${tex(b.L)}$ J/g. ` +
          `The packet's value in the same units: ${prose(x.P)} kJ per 100 g is $${tex(x.P * 1000)}$ J per 100 g, which is $${tex(perGram)}$ J/g. So the student found $\\dfrac{${tex(b.L)}}{${tex(perGram)}} \\times 100 = ${show(x.pct)}$ %. ` +
          `The other ${show(clean(100 - x.pct))} % was lost to the air and the apparatus, or was never released because the ${f.noun} did not burn completely — a simple calorimeter is expected to read low.`,
        method: [`energy = ${b.V} × 4.2 × ${b.dT} = ${prose(b.E)} J, so ${prose(b.L)} J/g`, `converts ${prose(x.P)} kJ per 100 g to ${prose(perGram)} J/g and divides`],
        answer: x.pct,
        tolerance: exactTolerance(x.pct),
        units: unitsOf(slot),
        line: `${show(x.pct)} %`,
      },
      // Second route: the packet's energy in a piece of that mass, against what the water took up.
      { agrees: near((b.E / ((x.P * 1000 * b.m) / 100)) * 100, x.pct), detail: `${b.E} J ÷ (${x.P} kJ × ${show(b.m)} ÷ 100)` },
      { context: f.name, P: x.P, V: b.V, dT: b.dT, m: b.m, start, pct: x.pct },
    )
  },
}

// =============================================================================================
// Photosynthesis
// =============================================================================================

interface Weed {
  name: string
  /** How the set-up is described. */
  text: string
  /** Bubbles per minute it gives. */
  rate: readonly [number, number]
}
const WEEDS: Weed[] = [
  { name: 'Elodea, lamp near', text: 'Canadian pondweed (*Elodea*) in a beaker of water is lit by a lamp 10 cm away.', rate: [15, 60] },
  { name: 'Cabomba, sodium hydrogencarbonate', text: 'A piece of *Cabomba* pondweed stands in dilute sodium hydrogencarbonate solution, which supplies carbon dioxide, under a bright lamp.', rate: [20, 80] },
  { name: 'Elodea, lamp far', text: 'Canadian pondweed (*Elodea*) in a beaker of water is lit by a lamp 50 cm away.', rate: [3, 15] },
  { name: 'pondweed, cool water', text: 'Pondweed in a test tube of water at 15 °C is lit by a lamp.', rate: [4, 20] },
]
const COUNT_MINUTES = [3, 4, 5, 6, 8]

interface Counted {
  n: number
  t: number
  rate: number
}
/** Counts over 3 to 8 minutes whose rate fits the set-up, exact to 1 place, at most three figures, and none of the givens. */
const counted = (w: Weed): Counted[] =>
  COUNT_MINUTES.flatMap((t) =>
    range(5, 400)
      .map((n) => ({ n, t, rate: clean(n / t) }))
      .filter(({ n, t, rate }) => tidy(rate, 1) && between(rate, w.rate) && noOnes(rate) && clearOf(rate, n, t) && distinct(n, t, rate)),
  )

const COUNT_PROMPTS = [
  (w: Weed, x: Counted) => `${w.text} It gives off ${x.n} bubbles of oxygen in ${x.t} minutes. Calculate the rate of photosynthesis in bubbles per minute.`,
  (w: Weed, x: Counted) => `${w.text} A student counts ${x.n} bubbles of oxygen in ${x.t} minutes. Calculate the rate of photosynthesis in bubbles per minute.`,
]

/** Count ÷ minutes: written as q7 (36 bubbles in 3 minutes, 12). */
export const bubbleRate: Generator = {
  id: 'photosynthesis-bubble-rate',
  subjectId: 'biology',
  topicId: PHOTO,
  replaces: ['q7'],
  build(r, slot, turn) {
    const w = WEEDS[turn % WEEDS.length]!
    const x = layered(r, `photosynthesis-bubble-rate:${w.name}`, () => counted(w), (y) => y.t, (y) => y.rate)
    return numeric(
      slot,
      {
        prompt: pick(r, COUNT_PROMPTS)(w, x),
        solution: `Rate = number ÷ time = ${x.n} ÷ ${x.t} = ${show(x.rate)} bubbles per minute.`,
        method: [`${x.n} ÷ ${x.t}`],
        answer: x.rate,
        tolerance: exactTolerance(x.rate),
        units: unitsOf(slot),
      },
      { agrees: near(x.rate * x.t, x.n), detail: `${show(x.rate)} × ${x.t} = ${show(x.rate * x.t)}` },
      { context: w.name, n: x.n, t: x.t, rate: x.rate },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q9: the distance doubled, tripled, halved or cut to a third
// ---------------------------------------------------------------------------------------------

interface Move {
  name: string
  /** New distance ÷ old. */
  f: number
  /** What the move does to the intensity, as the solution says it. */
  says: string
  /** The mark scheme's reason. */
  because: string
  /** Old distances, cm. */
  from: number[]
}
const MOVES: Move[] = [
  { name: 'double', f: 2, says: 'Doubling the distance divides the light intensity by $2^2 = 4$', because: 'doubling the distance gives a quarter of the intensity', from: range(10, 50, 5) },
  { name: 'halve', f: 0.5, says: 'Halving the distance multiplies the light intensity by $2^2 = 4$', because: 'halving the distance gives four times the intensity', from: range(20, 100, 10) },
  { name: 'triple', f: 3, says: 'Tripling the distance divides the light intensity by $3^2 = 9$', because: 'tripling the distance gives a ninth of the intensity', from: range(10, 30, 5) },
  { name: 'third', f: 1 / 3, says: 'A third of the distance multiplies the light intensity by $3^2 = 9$', because: 'a third of the distance gives nine times the intensity', from: [30, 45, 60, 75, 90] },
]
/** Bubbles per minute, both before and after: 2 to 100. */
const BUBBLES: readonly [number, number] = [2, 100]

interface Moved {
  d1: number
  d2: number
  R: number
  A: number
}
const moved = (m: Move): Moved[] =>
  m.from.flatMap((d1) =>
    range(2, 100)
      .map((R) => ({ d1, d2: clean(d1 * m.f), R, A: clean(R / (m.f * m.f)) }))
      .filter(({ d1, d2, R, A }) => tidy(A, 1) && between(A, BUBBLES) && between(d2, [10, 100]) && Number.isInteger(d2) && noOnes(A) && clearOf(A, d1, d2, R) && distinct(A, d1, d2) && ![d1, d2].includes(R)),
  )

const MOVE_PROMPTS = [
  (x: Moved) => `A lamp ${x.d1} cm from pondweed gives ${x.R} bubbles per minute. Predict the rate when the lamp is moved to ${x.d2} cm, assuming light is the limiting factor throughout.`,
  (x: Moved) => `Pondweed gives off ${x.R} bubbles of oxygen per minute with a lamp ${x.d1} cm away. The lamp is moved to ${x.d2} cm. Assuming light is the limiting factor throughout, predict the new rate in bubbles per minute.`,
]

/** Rate ∝ 1/d², the distance by a whole factor: written as q9 (20 cm to 40 cm, 48 to 12). */
export const lampMoved: Generator = {
  id: 'photosynthesis-lamp-moved',
  subjectId: 'biology',
  topicId: PHOTO,
  replaces: ['q9'],
  build(r, slot, turn) {
    const m = MOVES[turn % MOVES.length]!
    const x = layered(r, `photosynthesis-lamp-moved:${m.name}`, () => moved(m), (y) => y.A, (y) => y.d1)
    const n = m.f > 1 ? m.f * m.f : 1 / (m.f * m.f)
    const op = m.f > 1 ? '\\div' : '\\times'
    return numeric(
      slot,
      {
        prompt: pick(r, MOVE_PROMPTS)(x),
        solution: `${m.says}. Rate is proportional to light intensity, so $${x.R} ${op} ${n} = ${show(x.A)}$ bubbles per minute.`,
        method: [`${x.R} ${m.f > 1 ? '÷' : '×'} ${n}, because ${m.because}`],
        answer: x.A,
        tolerance: exactTolerance(x.A),
        units: unitsOf(slot),
        line: show(x.A),
      },
      // Second route: rate × d² is the same at both distances.
      { agrees: near(x.R * x.d1 * x.d1, x.A * x.d2 * x.d2), detail: `${x.R} × ${x.d1}² = ${show(x.A)} × ${x.d2}²` },
      { context: m.name, d1: x.d1, d2: x.d2, R: x.R, A: x.A },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q10: 1/d² to 2 significant figures
// ---------------------------------------------------------------------------------------------

/** The first n significant figures of x, cut short rather than rounded, for "0.001111…". */
function cut(x: number, n: number): string {
  const e = Math.floor(Math.log10(x))
  const dp = Math.max(0, n - 1 - e)
  return (Math.floor(x * 10 ** dp + 1e-9) / 10 ** dp).toFixed(dp)
}
interface Inverse {
  d: number
  exact: number
  answer: number
}
/**
 * Distances of 5 to 100 cm whose 1/d² rounds clearly to 2 figures that do not end in a 0 the
 * answer box would drop (10 cm gives 0.010), and whose exact value the tolerance accepts.
 */
const INVERSES: Inverse[] = range(5, 100)
  .map((d) => ({ d, exact: 1 / (d * d), answer: sigFigs(1 / (d * d), 2) }))
  .filter(({ exact, answer }) => clearAtSigFigs(exact, 2) && !answer.toPrecision(2).endsWith('0') && Math.abs(exact - answer) <= sfTolerance(answer, 2))

const SETTINGS = [
  { name: 'plant', text: (d: number) => `A lamp is ${d} cm from a plant.` },
  { name: 'pondweed', text: (d: number) => `A student places a lamp ${d} cm from a beaker of pondweed.` },
  { name: 'leaf discs', text: (d: number) => `A lamp stands ${d} cm from a beaker of floating leaf discs.` },
]

/** 1 ÷ d², as a decimal to 2 significant figures: written as q10 (25 cm, 0.0016). */
export const inverseSquare: Generator = {
  id: 'photosynthesis-inverse-square',
  subjectId: 'biology',
  topicId: PHOTO,
  replaces: ['q10'],
  build(r, slot, turn) {
    const s = SETTINGS[turn % SETTINGS.length]!
    const x = pick(r, INVERSES)
    const sq = x.d * x.d
    const exactly = near(x.exact, x.answer)
    return numeric(
      slot,
      {
        prompt: `${s.text(x.d)} Calculate 1/d², where d is the distance in cm. Give your answer as a decimal to 2 significant figures.`,
        solution: exactly
          ? `d² = ${x.d} × ${x.d} = ${sq}, so 1/d² = 1 ÷ ${sq} = ${show(x.answer)}.`
          : `d² = ${x.d} × ${x.d} = ${sq}, so 1/d² = 1 ÷ ${sq} = ${cut(x.exact, 4)}…, which is ${show(x.answer)} to 2 significant figures.`,
        method: [`${x.d}² = ${sq}`],
        answer: x.answer,
        tolerance: sfTolerance(x.answer, 2),
        units: unitsOf(slot),
      },
      // Second route: the answer times d² is 1, to the rounding.
      { agrees: Math.abs(x.answer * sq - 1) <= 0.5 * 10 ** (Math.floor(Math.log10(x.answer)) - 1) * sq, detail: `${show(x.answer)} × ${sq} = ${show(x.answer * sq)}` },
      { context: s.name, d: x.d, answer: x.answer },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q15: percentage increase in the rate
// ---------------------------------------------------------------------------------------------

interface Boost {
  name: string
  /** "When …, the rate of photosynthesis rose from". */
  when: string
  /** Bubbles per minute before. */
  before: readonly [number, number]
  pct: readonly [number, number]
  /** Figures the prompt prints besides the rates. */
  figures: number[]
}
const BOOSTS: Boost[] = [
  { name: 'carbon dioxide', when: 'When the carbon dioxide concentration was increased', before: [4, 40], pct: [20, 200], figures: [] },
  { name: 'sodium hydrogencarbonate', when: 'When sodium hydrogencarbonate was added to the water around some pondweed, raising the carbon dioxide concentration', before: [4, 40], pct: [20, 200], figures: [] },
  { name: 'warmer', when: 'When the water around some pondweed was warmed from 15 °C to 25 °C', before: [4, 40], pct: [20, 150], figures: [15, 25] },
  { name: 'lamp closer', when: 'When a lamp was moved closer to some pondweed', before: [3, 30], pct: [25, 300], figures: [] },
]
interface Boosted {
  a: number
  b: number
  pct: number
}
const boosted = (c: Boost): Boosted[] =>
  range(c.before[0], c.before[1]).flatMap((a) =>
    range(a + 1, 90)
      .map((b) => ({ a, b, pct: clean(((b - a) / a) * 100) }))
      .filter(({ a, b, pct }) => tidy(pct, 1) && between(pct, c.pct) && !powerOfTen(pct) && clearOf(pct, a, b, b - a, ...c.figures) && distinct(a, b, b - a) && b - a >= 2 && !c.figures.includes(a) && !c.figures.includes(b)),
  )

/** (new − old) ÷ old × 100: written as q15 (8 to 14 bubbles per minute, 75%). */
export const photosynthesisIncrease: Generator = {
  id: 'photosynthesis-percentage-increase',
  subjectId: 'biology',
  topicId: PHOTO,
  replaces: ['q15'],
  build(r, slot, turn) {
    const c = BOOSTS[turn % BOOSTS.length]!
    const x = layered(r, `photosynthesis-percentage-increase:${c.name}`, () => rich(boosted(c), (y) => y.pct, (y) => y.a), (y) => y.pct, (y) => y.a)
    const d = x.b - x.a
    return numeric(
      slot,
      {
        prompt: `${c.when}, the rate of photosynthesis rose from ${x.a} to ${x.b} bubbles per minute. Calculate the percentage increase.`,
        solution: `Increase = ${x.b} − ${x.a} = ${d}. Percentage increase = ${d} ÷ ${x.a} × 100 = ${show(x.pct)}%.`,
        method: [`(${x.b} − ${x.a}) ÷ ${x.a}`],
        answer: x.pct,
        tolerance: exactTolerance(x.pct),
        units: unitsOf(slot),
      },
      // Second route: the new rate as a multiple of the old.
      { agrees: near((x.b / x.a - 1) * 100, x.pct), detail: `(${x.b} ÷ ${x.a} − 1) × 100` },
      { context: c.name, a: x.a, b: x.b, pct: x.pct },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q24: cm³ of oxygen per hour
// ---------------------------------------------------------------------------------------------

interface Syringe {
  name: string
  text: string
  /** cm³ of oxygen an hour, and the least volume collected, cm³. */
  rate: readonly [number, number]
  least: number
}
const SYRINGES: Syringe[] = [
  { name: 'Elodea', text: 'Canadian pondweed (*Elodea*) in a beaker of water is lit by a lamp.', rate: [2, 12], least: 0.2 },
  { name: 'Cabomba', text: 'A shoot of *Cabomba* pondweed in dilute sodium hydrogencarbonate solution is lit by a bright lamp.', rate: [4, 20], least: 0.2 },
  { name: 'dim', text: 'Pondweed in a beaker of water is lit by a lamp at the far end of the bench.', rate: [1, 5], least: 0.5 },
]
/** Minutes of collecting: never 6 (×10), 30 (×2) or 60 (×1). */
const SYRINGE_MINUTES = [4, 5, 8, 10, 12, 15, 20, 24, 25, 40, 45]
interface Collected {
  v: number
  t: number
  rate: number
}
/** Volumes read off a gas syringe to 0.1 cm³; the rate exact to 1 place with at most three figures, none of the givens. */
const collected = (s: Syringe): Collected[] =>
  SYRINGE_MINUTES.flatMap((t) =>
    range(s.least, 6, 0.1)
      .map((v) => ({ v, t, rate: clean((v * 60) / t) }))
      .filter(({ v, t, rate }) => tidy(rate, 1) && between(rate, s.rate) && noOnes(rate) && noOnes(v) && clearOf(rate, v, t) && distinct(v, t, rate)),
  )

/** Volume ÷ minutes × 60: written as q24 (1.8 cm³ in 12 minutes, 9 cm³/hour). */
export const oxygenPerHour: Generator = {
  id: 'photosynthesis-oxygen-per-hour',
  subjectId: 'biology',
  topicId: PHOTO,
  replaces: ['q24'],
  build(r, slot, turn) {
    const s = SYRINGES[turn % SYRINGES.length]!
    const x = layered(r, `photosynthesis-oxygen-per-hour:${s.name}`, () => collected(s), (y) => y.rate, (y) => y.t)
    const perMin = x.v / x.t
    const lots = 60 / x.t
    const route = atMost(perMin, 4)
      ? `In ${x.t} minutes, ${show(x.v)} cm³ was collected, so the rate is $\\dfrac{${show(x.v)}}{${x.t}} = ${show(perMin)}$ cm³ per minute. There are 60 minutes in an hour, so $${show(perMin)} \\times 60 = ${show(x.rate)}$ cm³ per hour.`
      : `In ${x.t} minutes, ${show(x.v)} cm³ was collected, so the rate is $\\dfrac{${show(x.v)}}{${x.t}}$ cm³ per minute. There are 60 minutes in an hour, so $\\dfrac{${show(x.v)}}{${x.t}} \\times 60 = ${show(x.rate)}$ cm³ per hour.`
    const alt = Number.isInteger(lots) ? ` (Or: an hour is ${lots} lots of ${x.t} minutes, so $${show(x.v)} \\times ${lots} = ${show(x.rate)}$.)` : ''
    return numeric(
      slot,
      {
        prompt: `${s.text} The oxygen it gives off is collected in a gas syringe: ${show(x.v)} cm³ of oxygen is collected in ${x.t} minutes. Calculate the rate of photosynthesis in cm³ of oxygen per hour.`,
        solution: `Rate $= \\dfrac{\\text{volume}}{\\text{time}}$. ${route}${alt} Measuring the volume of gas is more reliable than counting bubbles, because bubbles differ in size.`,
        method: [`divides ${show(x.v)} by ${x.t} and scales to an hour (×60)${Number.isInteger(lots) ? `, or multiplies ${show(x.v)} by ${lots}` : ''}`],
        answer: x.rate,
        tolerance: exactTolerance(x.rate),
        units: unitsOf(slot),
        line: `${show(x.rate)} cm³ per hour`,
      },
      { agrees: near((x.rate * x.t) / 60, x.v), detail: `${show(x.rate)} × ${x.t} ÷ 60 = ${show((x.rate * x.t) / 60)} cm³` },
      { context: s.name, v: x.v, t: x.t, rate: x.rate },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q25: the inverse square law against the student's straight proportion
// ---------------------------------------------------------------------------------------------

interface Ratio {
  /** Old distance : new distance, in lowest terms. */
  p: number
  q: number
  /** "three quarters of", "one and a third times". */
  words: string
}
const AWAY: Ratio[] = [
  { p: 2, q: 3, words: 'two thirds of' },
  { p: 3, q: 4, words: 'three quarters of' },
  { p: 3, q: 5, words: 'three fifths of' },
  { p: 4, q: 5, words: 'four fifths of' },
  { p: 2, q: 5, words: 'two fifths of' },
]
const CLOSER: Ratio[] = [
  { p: 3, q: 2, words: 'one and a half times' },
  { p: 4, q: 3, words: 'one and a third times' },
  { p: 5, q: 4, words: 'one and a quarter times' },
  { p: 5, q: 2, words: 'two and a half times' },
]
const DIRECTIONS = [
  { name: 'away', ratios: AWAY },
  { name: 'closer', ratios: CLOSER },
]
interface Squared {
  ratio: Ratio
  d1: number
  d2: number
  R: number
  /** The student's straight-proportion prediction, and the right one. */
  W: number
  A: number
}
/** Distances on a 5 cm grid from 5 to 100 cm, rates 2 to 100 bubbles per minute, both predictions exact to 1 place. */
const squared = (ratios: Ratio[]): Squared[] =>
  ratios.flatMap((ratio) =>
    range(1, 20)
      .map((u) => ({ d1: ratio.p * u * 5, d2: ratio.q * u * 5 }))
      .filter(({ d1, d2 }) => d1 <= 100 && d2 <= 100)
      .flatMap(({ d1, d2 }) =>
        range(2, 100)
          .map((R) => ({ ratio, d1, d2, R, W: clean((R * ratio.p) / ratio.q), A: clean((R * ratio.p * ratio.p) / (ratio.q * ratio.q)) }))
          .filter(({ d1, d2, R, W, A }) => tidy(A, 1) && tidy(W, 1) && between(A, BUBBLES) && between(W, BUBBLES) && noOnes(A) && clearOf(A, d1, d2, R, W) && distinct(A, d1, d2, R)),
      ),
  )

/** R × (d1/d2)²: written as q25 (15 cm to 20 cm, 32 bubbles per minute, the student says 24, 18). */
export const inverseSquarePrediction: Generator = {
  id: 'photosynthesis-inverse-square-prediction',
  subjectId: 'biology',
  topicId: PHOTO,
  replaces: ['q25'],
  build(r, slot, turn) {
    const dir = DIRECTIONS[turn % DIRECTIONS.length]!
    // The distance ratio first, so each is as likely, then the answer, then the distances.
    const x = layered(r, `photosynthesis-inverse-square-prediction:${dir.name}`, () => squared(dir.ratios), (y) => `${y.ratio.p}/${y.ratio.q}`, (y) => y.A, (y) => y.d1)
    const { p, q } = x.ratio
    const s1 = x.d1 * x.d1
    const s2 = x.d2 * x.d2
    const g = gcd(p * p, q * q)
    const factor = fracTex((p * p) / g, (q * q) / g)
    const linear = fracTex(p, q)
    const away = x.d2 > x.d1
    const reason = `${x.d1} cm is ${x.ratio.words} ${x.d2} cm`
    return numeric(
      slot,
      {
        prompt:
          `With a lamp ${x.d1} cm from pondweed, a student counts ${x.R} bubbles per minute. The lamp is moved to ${x.d2} cm. The student predicts ${show(x.W)} bubbles per minute, reasoning that ${reason}. ` +
          'Light intensity is proportional to 1/d², where d is the distance from the lamp, and light is the limiting factor throughout. Calculate the rate the student should actually predict.',
        solution:
          `Light intensity $\\propto \\dfrac{1}{d^2}$, and with light limiting the rate is proportional to the light intensity. Moving from ${x.d1} cm to ${x.d2} cm multiplies the intensity by ` +
          `$\\left(\\dfrac{${x.d1}}{${x.d2}}\\right)^2 = \\dfrac{${s1}}{${s2}} = ${factor}$, not by $\\dfrac{${x.d1}}{${x.d2}} = ${linear}$. So the predicted rate is $${x.R} \\times ${factor} = ${show(x.A)}$ bubbles per minute. ` +
          `(Check with the values of $1/d^2$: $\\dfrac{1}{${s1}}$ at ${x.d1} cm and $\\dfrac{1}{${s2}}$ at ${x.d2} cm, and $${x.R} \\times \\dfrac{${s1}}{${s2}} = ${show(x.A)}$.) ` +
          `The student forgot the square: intensity depends on the square of the distance because the light spreads over an area. The rate ${away ? 'falls as the distance rises' : 'rises as the distance falls'}, an inverse relationship, but because light intensity is proportional to $1/d^2$ the rate is inversely proportional to $d^2$, not to $d$.`,
        method: [
          `uses rate proportional to 1/d²: the intensity ratio is (${x.d1}/${x.d2})² = ${s1}/${s2}, or 1/${s1} against 1/${s2}`,
          `multiplies ${x.R} by ${atMost((p * p) / (q * q), 4) ? `${show((p * p) / (q * q))} (or by ${s1}/${s2})` : `${s1}/${s2}`}`,
        ],
        answer: x.A,
        tolerance: exactTolerance(x.A),
        units: unitsOf(slot),
      },
      // Second route: rate × d² is the same at both distances.
      { agrees: near(x.R * s1, x.A * s2), detail: `${x.R} × ${s1} = ${show(x.A)} × ${s2}` },
      { context: dir.name, ratio: `${p}/${q}`, d1: x.d1, d2: x.d2, R: x.R, A: x.A },
    )
  },
}

// =============================================================================================
// Respiration
// =============================================================================================

interface Respirer {
  name: string
  /** As "a respirometer holding …" names them. */
  text: string
  /** Drop movement, mm per minute, at the cooler temperature and the warmer. */
  cool: readonly [number, number]
  /** The two temperatures it is compared at, 10 °C apart. */
  temps: readonly [number, number]
}
/** Seeds tolerate 30 °C; woodlice and maggots are kept at 25 °C or below. */
const RESPIRERS: Respirer[] = [
  { name: 'germinating peas', text: 'germinating peas', cool: [1.5, 6], temps: [20, 30] },
  { name: 'woodlice', text: 'woodlice', cool: [0.8, 3.5], temps: [15, 25] },
  { name: 'maggots', text: 'maggots', cool: [1.5, 5], temps: [15, 25] },
  { name: 'germinating wheat', text: 'germinating wheat grains', cool: [1, 5], temps: [10, 20] },
]
/** Minutes the drop is timed for: never 10, which only moves the point, nor 2, which halves. */
const DROP_MINUTES = [3, 4, 5, 6, 7, 8, 9, 12, 15]

interface Drop {
  D: number
  t: number
  rate: number
}
/** Drops moved a whole number of mm, up to 90 mm, at a rate exact to 1 place with at most three figures. */
const drops = (lo: number, hi: number, minutes = DROP_MINUTES): Drop[] =>
  minutes.flatMap((t) =>
    range(3, 90)
      .map((D) => ({ D, t, rate: clean(D / t) }))
      .filter(({ D, t, rate }) => tidy(rate, 1) && between(rate, [lo, hi]) && noOnes(rate) && clearOf(rate, D, t) && distinct(D, t, rate)),
  )
const warmRange = (x: Respirer): [number, number] => [x.cool[0] * 1.2, x.cool[1] * 2]

const DROP_PROMPTS = [
  (x: Respirer, d: Drop, T: number) => `A drop of liquid in a respirometer holding ${x.text} at ${T} °C moved ${d.D} mm in ${d.t} minutes. Calculate the rate of respiration in mm per minute.`,
  (x: Respirer, d: Drop, T: number) => `A student sets up a respirometer with ${x.text} at ${T} °C. The drop of liquid moves ${d.D} mm in ${d.t} minutes. Calculate the rate of respiration in mm per minute.`,
]

/** Distance ÷ minutes: written as q6 (42 mm in 7 minutes, 6 mm/min). */
export const respirometerRate: Generator = {
  id: 'respirometer-rate',
  subjectId: 'biology',
  topicId: RESP,
  replaces: ['q6'],
  build(r, slot, turn) {
    const x = RESPIRERS[turn % RESPIRERS.length]!
    const warm = r() < 0.5
    const [lo, hi] = warm ? warmRange(x) : x.cool
    const T = warm ? x.temps[1] : x.temps[0]
    const d = layered(r, `respirometer-rate:${x.name}:${warm}`, () => drops(lo, hi).filter((y) => distinct(y.D, y.t, y.rate, T)), (y) => y.t, (y) => y.rate)
    return numeric(
      slot,
      {
        prompt: pick(r, DROP_PROMPTS)(x, d, T),
        solution: `$\\dfrac{${d.D}}{${d.t}} = ${show(d.rate)}$ mm/min.`,
        method: ['divides the distance by the time'],
        answer: d.rate,
        tolerance: exactTolerance(d.rate),
        units: unitsOf(slot),
        line: `${show(d.rate)} mm/min`,
      },
      { agrees: near(d.rate * d.t, d.D), detail: `${show(d.rate)} × ${d.t} = ${show(d.rate * d.t)} mm` },
      { context: x.name, D: d.D, t: d.t, rate: d.rate, T },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q16: how many times faster, to 2 decimal places
// ---------------------------------------------------------------------------------------------

interface Warmed {
  c: Drop
  w: Drop
  k: number
  /** The student's whole number: how many times the cool distance the warm one looks. */
  n: number
  /** "almost" when the distances' ratio falls just short of n, "just over" when past it. */
  how: 'almost' | 'just over'
}
const WARMED = new Map<string, Warmed[]>()
/**
 * A cool and a warm reading whose distances look about two or three times apart (1.75 to 1.95,
 * or 2.05 to 2.2, times n), while the rates differ by a factor 1.3 to 2.5 that is at least 0.3
 * from it, rounds clearly to 2 places, and is not the time ratio. The warm reading is timed for
 * longer, as in the written question, so the raw distances overstate the difference; no distance or
 * time is a temperature, nor one with the point moved.
 */
function warmed(x: Respirer): Warmed[] {
  const hit = WARMED.get(x.name)
  if (hit) return hit
  const cools = drops(...x.cool)
  const warms = drops(...warmRange(x))
  const out: Warmed[] = []
  for (const c of cools)
    for (const w of warms) {
      const exact = w.rate / c.rate
      const dist = w.D / c.D
      const n = Math.round(dist)
      if (n < 2 || n > 3) continue
      const off = dist / n
      const kind = off >= 0.875 && off <= 0.975 ? 'almost' : off >= 1.025 && off <= 1.1 ? 'just over' : null
      const k = Number(fixed(exact, 2))
      if (!kind || !between(exact, [1.3, 2.5]) || Math.abs(exact - n) < 0.3 || !clearOfHalf(exact, 2, 0.05)) continue
      if (w.t <= c.t || Math.abs(exact - w.t / c.t) < 0.05 || !distinct(c.D, w.D, c.t, w.t, ...x.temps) || !clearOf(k, c.D, w.D, c.t, w.t, c.rate, w.rate) || !noOnes(k)) continue
      out.push({ c, w, k, n, how: kind })
    }
  WARMED.set(x.name, out)
  return out
}
const TIMES_WORD = ['', '', 'twice', 'three times']

/** Both rates, then one ÷ the other: written as q16 (45 mm in 5 min against 84 mm in 6 min, 1.56). */
export const respirometerComparison: Generator = {
  id: 'respirometer-comparison',
  subjectId: 'biology',
  topicId: RESP,
  replaces: ['q16'],
  build(r, slot, turn) {
    const x = RESPIRERS[turn % RESPIRERS.length]!
    // The two times in either order: the warm one is the longer, so whichever comes second leans to its end of the range.
    const times: ((z: Warmed) => number)[] = r() < 0.5 ? [(z) => z.w.t, (z) => z.c.t] : [(z) => z.c.t, (z) => z.w.t]
    const y = layered(r, `respirometer-comparison:${x.name}`, () => warmed(x), ...times, (z) => z.k)
    const [T1, T2] = x.temps
    const exact = y.w.rate / y.c.rate
    const many = TIMES_WORD[y.n]!
    return numeric(
      slot,
      {
        prompt:
          `In a respirometer holding ${x.text} at ${T1} °C, the drop moved ${y.c.D} mm in ${y.c.t} minutes. Warmed to ${T2} °C, the drop moved ${y.w.D} mm in ${y.w.t} minutes. ` +
          `A student says the warmed ${x.text} respired ${y.how} ${many} as fast, because ${y.w.D} mm is ${y.how} ${many} ${y.c.D} mm. Calculate how many times faster, to two decimal places, the warmed ${x.text} were actually respiring.`,
        solution:
          `Rates are $\\dfrac{${y.c.D}}{${y.c.t}} = ${show(y.c.rate)}$ mm/min and $\\dfrac{${y.w.D}}{${y.w.t}} = ${show(y.w.rate)}$ mm/min, so $\\dfrac{${show(y.w.rate)}}{${show(y.c.rate)}} = ${atMost(exact, 2) ? show(exact) : `${cut(exact, 4)}\\ldots`}$${atMost(exact, 2) ? '' : `, which is **${fixed(y.k, 2)}** to two decimal places`}. ` +
          `Comparing the raw distances, ${y.w.D} against ${y.c.D}, would have suggested a much larger difference, because the **times were not the same**.`,
        method: [`converts both readings to rates: ${show(y.c.rate)} and ${show(y.w.rate)} mm/min`, `divides ${show(y.w.rate)} by ${show(y.c.rate)}`],
        answer: y.k,
        tolerance: toPlaces(y.k, 2),
        units: unitsOf(slot),
        line: fixed(y.k, 2),
      },
      // Second route: distances and times in one fraction.
      { agrees: Math.abs((y.w.D * y.c.t) / (y.c.D * y.w.t) - y.k) <= 0.005, detail: `(${y.w.D} × ${y.c.t}) ÷ (${y.c.D} × ${y.w.t}) = ${((y.w.D * y.c.t) / (y.c.D * y.w.t)).toFixed(4)}` },
      { context: x.name, D1: y.c.D, t1: y.c.t, D2: y.w.D, t2: y.w.t, k: y.k },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q25: yeast bubbles, the mean of three counts over a time
// ---------------------------------------------------------------------------------------------

interface Brew {
  name: string
  T: number
  /** Bubbles of carbon dioxide a minute. */
  rate: readonly [number, number]
}
/** Yeast with glucose ferments faster as it warms to about 35 to 40 °C. */
const BREWS: Brew[] = [
  { name: '20 °C', T: 20, rate: [2, 8] },
  { name: '25 °C', T: 25, rate: [4, 12] },
  { name: '30 °C', T: 30, rate: [6, 18] },
  { name: '35 °C', T: 35, rate: [8, 25] },
]
const BREW_MINUTES = [3, 4, 5, 6, 8]
interface Brewed {
  m: number
  t: number
  rate: number
}
/** Whole mean counts over 3 to 8 minutes, rates exact to 2 places with at most three figures. */
const brewed = (b: Brew): Brewed[] =>
  BREW_MINUTES.flatMap((t) =>
    range(10, 200)
      .map((m) => ({ m, t, rate: clean(m / t) }))
      .filter(({ m, t, rate }) => tidy(rate, 2) && between(rate, b.rate) && noOnes(rate) && clearOf(rate, m, t, b.T) && distinct(m, t, rate, b.T)),
  )

const BREW_PROMPTS = [
  (b: Brew, cs: number[], t: number) =>
    `A student investigates anaerobic respiration in yeast by counting the bubbles of carbon dioxide released from a yeast and glucose mixture at ${b.T} °C in ${t} minutes. Three repeats give ${cs[0]}, ${cs[1]} and ${cs[2]} bubbles. Calculate the mean rate of respiration, in bubbles per minute.`,
  (b: Brew, cs: number[], t: number) =>
    `Yeast is kept with glucose solution at ${b.T} °C with no air, and a student counts the bubbles of carbon dioxide it releases in ${t} minutes. Three repeats give ${cs[0]}, ${cs[1]} and ${cs[2]} bubbles. Calculate the mean rate of respiration, in bubbles per minute.`,
]

/** Mean count ÷ minutes: written as q25 (45, 51 and 48 bubbles in 4 minutes, 12). */
export const yeastBubbles: Generator = {
  id: 'yeast-bubble-rate',
  subjectId: 'biology',
  topicId: RESP,
  replaces: ['q25'],
  build(r, slot, turn) {
    const b = BREWS[turn % BREWS.length]!
    const x = layered(r, `yeast-bubble-rate:${b.name}`, () => brewed(b), (y) => y.t, (y) => y.rate)
    // Repeats running at most 15% of the mean (3 bubbles for small counts), none the answer, the minutes or the temperature.
    const cs = draw(
      r,
      () => shuffle(r, repeats(r, x.m, 1, Math.max(SPREAD, 3 / x.m))),
      (xs) => xs.every((c) => c > 0 && distinct(c, x.rate) && distinct(c, x.t) && distinct(c, b.T)),
    )
    const sum = cs[0]! + cs[1]! + cs[2]!
    return numeric(
      slot,
      {
        prompt: pick(r, BREW_PROMPTS)(b, cs, x.t),
        solution:
          `Mean count $= \\dfrac{${cs.join(' + ')}}{3} = \\dfrac{${sum}}{3} = ${x.m}$ bubbles in ${x.t} minutes. Rate $= \\dfrac{${x.m}}{${x.t}} = ${show(x.rate)}$ bubbles per minute. ` +
          'Averaging the three counts first and then dividing by the time gives the same answer as working out three rates and averaging those, but it is quicker.',
        method: [`mean of the three counts = ${x.m}`, `divides by the ${x.t} minutes`],
        answer: x.rate,
        tolerance: exactTolerance(x.rate),
        units: unitsOf(slot),
      },
      // Second route: the three rates averaged.
      { agrees: near((cs[0]! / x.t + cs[1]! / x.t + cs[2]! / x.t) / 3, x.rate), detail: `mean of ${cs.map((c) => show(c / x.t)).join(', ')}` },
      { context: b.name, c1: cs[0]!, c2: cs[1]!, c3: cs[2]!, m: x.m, t: x.t, rate: x.rate },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q26: allowing for the control, then the percentage increase
// ---------------------------------------------------------------------------------------------

interface Controlled {
  D1: number
  t1: number
  D2: number
  t2: number
  /** The control's movement, and which temperature it moved at (1 the cooler, 2 the warmer). */
  c: number
  at: 1 | 2
  r1: number
  r2: number
  pct: number
}
const CONTROLLED = new Map<string, Controlled[]>()
/**
 * A cool and a warm reading, one with a control that moved 2 to 8 mm the same way (at most a
 * fifth of its drop's movement), the corrected rates exact to 2 places, the warm one 1.3 to 2.5
 * times the cool, and the increase exact to 1 place with at most three figures; never 100%, and
 * at least 5 points from the increase found without the correction.
 */
function controlled(x: Respirer, at: 1 | 2): Controlled[] {
  const key = `${x.name}:${at}`
  const hit = CONTROLLED.get(key)
  if (hit) return hit
  const out: Controlled[] = []
  const minutes = [4, 5, 6, 8, 9, 12]
  const corrected = (lo: number, hi: number) =>
    minutes.flatMap((t) =>
      range(5, 90).flatMap((D) =>
        [0, ...range(2, 8)]
          .map((c) => ({ D, t, c, rate: clean((D - c) / t) }))
          .filter(({ D, c, rate }) => tidy(rate, 2) && between(rate, [lo, hi]) && c <= D / 5 && noOnes(rate) && distinct(D, t)),
      ),
    )
  const cool = corrected(...x.cool).filter((y) => (at === 1 ? y.c > 0 : y.c === 0))
  const warm = corrected(...warmRange(x)).filter((y) => (at === 2 ? y.c > 0 : y.c === 0))
  for (const a of cool)
    for (const b of warm) {
      const ratio = b.rate / a.rate
      if (ratio < 1.3 || ratio > 2.5) continue
      const pct = clean(((b.rate - a.rate) / a.rate) * 100)
      const raw = ((b.D / b.t - a.D / a.t) / (a.D / a.t)) * 100
      const c = at === 1 ? a.c : b.c
      if (!tidy(pct, 1) || powerOfTen(pct) || Math.abs(raw - pct) < 5 || a.D === b.D) continue
      if (!clearOf(pct, a.D, a.t, b.D, b.t, c, a.rate, b.rate, clean(b.rate - a.rate), ...x.temps)) continue
      out.push({ D1: a.D, t1: a.t, D2: b.D, t2: b.t, c, at, r1: a.rate, r2: b.rate, pct })
    }
  CONTROLLED.set(key, out)
  return out
}

/** Subtract the control's movement, rates, then (new − old) ÷ old × 100: written as q26 (27 mm in 9 min; 50 − 5 mm in 10 min; 50%). */
export const respirometerControl: Generator = {
  id: 'respirometer-control',
  subjectId: 'biology',
  topicId: RESP,
  replaces: ['q26'],
  build(r, slot, turn) {
    const x = RESPIRERS[turn % RESPIRERS.length]!
    // Which temperature's control moved: half each, so correcting the warm reading by habit pays half the time.
    const at: 1 | 2 = r() < 0.5 ? 1 : 2
    const y = layered(r, `respirometer-control:${x.name}:${at}`, () => controlled(x, at), (z) => z.t2, (z) => z.c, (z) => z.t1, (z) => z.pct)
    const [T1, T2] = x.temps
    const still = 'the drop in the control tube of glass beads did not move'
    const moved = `the drop in the control tube of glass beads moved ${y.c} mm in the same direction in the same time`
    const d = clean(y.r2 - y.r1)
    const fix = (D: number, t: number, rate: number) => `the control moved ${y.c} mm: that is movement caused by the temperature or pressure of the room rather than by respiration, so it is subtracted. $${D} - ${y.c} = ${D - y.c}$ mm, and the rate is $\\dfrac{${D - y.c}}{${t}} = ${show(rate)}$ mm/min`
    const plain = (D: number, t: number, rate: number) => `the control did not move, so the rate is $\\dfrac{${D}}{${t}} = ${show(rate)}$ mm/min`
    return numeric(
      slot,
      {
        prompt:
          `In a respirometer holding ${x.text} at ${T1} °C, the drop moved ${y.D1} mm in ${y.t1} minutes, and ${y.at === 1 ? moved : still}. ` +
          `At ${T2} °C, the drop moved ${y.D2} mm in ${y.t2} minutes, while ${y.at === 2 ? moved : still}. Allowing for the control, calculate the percentage increase in the rate of respiration between ${T1} °C and ${T2} °C.`,
        solution:
          `At ${T1} °C ${y.at === 1 ? fix(y.D1, y.t1, y.r1) : plain(y.D1, y.t1, y.r1)}. At ${T2} °C ${y.at === 2 ? fix(y.D2, y.t2, y.r2) : plain(y.D2, y.t2, y.r2)}. ` +
          `The increase is $${show(y.r2)} - ${show(y.r1)} = ${show(d)}$ mm/min, and $\\dfrac{${show(d)}}{${show(y.r1)}} \\times 100 = ${show(y.pct)}$ %. ` +
          `Respiration is enzyme-controlled, so warming by 10 °C speeds it up, as long as the enzymes stay below their optimum temperature.`,
        method: [
          y.at === 2 ? `rates of ${show(y.r1)} mm/min and, after subtracting the control, ${show(y.r2)} mm/min` : `rates of ${show(y.r1)} mm/min after subtracting the control, and ${show(y.r2)} mm/min`,
          'increase divided by the original rate, × 100',
        ],
        answer: y.pct,
        tolerance: exactTolerance(y.pct),
        units: unitsOf(slot),
        line: `${show(y.pct)} %`,
      },
      // Second route: the corrected distances and times in one fraction.
      {
        agrees: near((((y.D2 - (y.at === 2 ? y.c : 0)) * y.t1) / ((y.D1 - (y.at === 1 ? y.c : 0)) * y.t2) - 1) * 100, y.pct),
        detail: `corrected distances ${y.D1 - (y.at === 1 ? y.c : 0)} and ${y.D2 - (y.at === 2 ? y.c : 0)} mm`,
      },
      { context: x.name, D1: y.D1, t1: y.t1, D2: y.D2, t2: y.t2, c: y.c, at: y.at, pct: y.pct },
    )
  },
}

export const bioenergeticsGenerators: Generator[] = [
  enzymeRate,
  enzymeTimesFaster,
  enzymeMeanRate,
  enzymeRateIncrease,
  calorimetryPerGram,
  foodComparison,
  calorimetryPacket,
  bubbleRate,
  lampMoved,
  inverseSquare,
  photosynthesisIncrease,
  oxygenPerHour,
  inverseSquarePrediction,
  respirometerRate,
  respirometerComparison,
  yeastBubbles,
  respirometerControl,
]

/** For the tests. */
export const BIOENERGETICS = { PRACTICALS, CONTRASTS, RISES, FOODS, FOUND, MATCHUPS, WEEDS, MOVES, BOOSTS, SYRINGES, AWAY, CLOSER, RESPIRERS, BREWS, labRange, warmRange, rateTimes, SPREAD }
