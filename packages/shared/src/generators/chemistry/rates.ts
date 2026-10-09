import { show } from '../format.ts'
import { figures, near, numeric } from '../physics/build.ts'
import { pick } from '../random.ts'
import type { Generator } from '../types.ts'
import { byFirst, clearOf, distinct, noOnes, places, powerOfTen, range, threeFigures, toPlaces } from './build.ts'

/**
 * Rates of reaction (AQA 8462, 4.6.1.1). The two numeric written slots in "Measuring rates of
 * reaction" have generators here: a mean rate from a volume of gas and a time (q2), and the rate
 * at a moment from a tangent's rise and run (q6, higher tier). Both are in cm³/s, as written.
 *
 * Left written, with nothing to vary: in "Equilibria and Le Chatelier's principle", q2 (a forward
 * reaction absorbs 50 kJ, so the reverse releases 50 kJ: the answer is the given figure by design,
 * and real reactions have one fixed energy change each) and q17 (the gas molecules on the left of
 * 2SO₂ + O₂ ⇌ 2SO₃, one fixed equation); in "The Haber process and fertilisers", q3 and q5 (the
 * pressure and temperature recalled, 200 atm and 450 °C) and q17 (the molecules on the left of
 * N₂ + 3H₂ ⇌ 2NH₃, the topic's own equation).
 *
 * Every reaction gives off a gas a student collects in a 100 cm³ gas syringe, so no volume
 * collected passes 100 cm³, and each runs at the speed it really does with dilute acid at room
 * temperature: magnesium ribbon and hydrogen peroxide with a catalyst quickly, marble chips more
 * slowly, zinc granules slowest of all.
 */
const TOPIC = 'measuring-rates-of-reaction'

interface Collected {
  name: string
  /** The sentence that sets the reaction up. */
  text: string
  gas: string
  /** The mean rates it gives, in cm³/s. */
  rate: [number, number]
  /** Times over which its gas is collected, in seconds: never 10 or 100, which only move the point. */
  times: number[]
}
const REACTIONS: Collected[] = [
  {
    name: 'magnesium and hydrochloric acid',
    text: 'A student adds magnesium ribbon to dilute hydrochloric acid and collects the hydrogen in a gas syringe.',
    gas: 'hydrogen',
    rate: [0.3, 4],
    times: [15, 20, 25, 30, 40, 45, 50, 60, 75, 80, 90],
  },
  {
    name: 'hydrogen peroxide and manganese(IV) oxide',
    text: 'A student adds manganese(IV) oxide, a catalyst, to hydrogen peroxide solution and collects the oxygen in a gas syringe.',
    gas: 'oxygen',
    rate: [0.3, 4],
    times: [15, 20, 25, 30, 40, 45, 50, 60, 75, 80, 90],
  },
  {
    name: 'marble chips and hydrochloric acid',
    text: 'A student adds marble chips to dilute hydrochloric acid and collects the carbon dioxide in a gas syringe.',
    gas: 'carbon dioxide',
    rate: [0.15, 1.5],
    times: [20, 25, 30, 40, 45, 50, 60, 75, 80, 90, 120, 150, 180],
  },
  {
    name: 'zinc and sulfuric acid',
    text: 'A student adds zinc granules to dilute sulfuric acid and collects the hydrogen in a gas syringe.',
    gas: 'hydrogen',
    rate: [0.05, 0.6],
    times: [60, 75, 80, 90, 120, 150, 180, 240, 300],
  },
]

/** Volumes read off a gas syringe, to the nearest cm³: 8 to 95 cm³. */
const VOLUMES = range(8, 95, 1)

interface Mean {
  v: number
  t: number
  rate: number
}
/**
 * Every volume and time whose mean rate fits the reaction, is exact to 2 decimal places with at
 * most three figures, is never 1 nor a power of ten, and is none of the figures given, nor one
 * with the point moved, doubled or halved.
 */
const means = (c: Collected): Mean[] =>
  c.times.flatMap((t) =>
    VOLUMES.map((v) => ({ v, t, rate: Number(show(v / t)) }))
      .filter(({ v, t, rate }) => near(rate * t, v) && places(rate) <= 2 && figures(rate) <= 3)
      .filter(({ v, t, rate }) => rate >= c.rate[0] && rate <= c.rate[1] && noOnes(rate) && !powerOfTen(rate) && clearOf(rate, v, t) && distinct(v, t, rate)),
  )

const MEAN_PROMPTS = [
  (c: Collected, v: number, t: number) => `${c.text} The reaction produces ${v} cm³ of ${c.gas} in ${t} s. Calculate the mean rate of reaction in cm³/s.`,
  (c: Collected, v: number, t: number) => `${c.text} In the first ${t} s, ${v} cm³ of ${c.gas} is collected. Calculate the mean rate of reaction over this time, in cm³/s.`,
]

/** Volume of gas ÷ time: written as q2 (60 cm³ in 25 s, 2.4 cm³/s). */
export const meanRate: Generator = {
  id: 'reaction-mean-rate',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q2'],
  build(r, slot, turn) {
    const c = REACTIONS[turn % REACTIONS.length]!
    // A time first, among those allowing three rates or more, then a rate evenly.
    const x = byFirst(r, `reaction-mean-rate:${c.name}`, () => means(c), (y) => y.t, (y) => y.rate, 3)
    return numeric(
      slot,
      {
        prompt: pick(r, MEAN_PROMPTS)(c, x.v, x.t),
        solution: `Mean rate $= \\dfrac{\\text{volume of gas}}{\\text{time}} = \\dfrac{${x.v}}{${x.t}} = ${show(x.rate)}$ cm³/s.`,
        method: ['divides the volume by the time'],
        answer: x.rate,
        tolerance: threeFigures(toPlaces(x.rate, 2), x.rate),
        line: `${show(x.rate)} cm³/s`,
      },
      // Second route: the rate kept up for the whole time gives the volume back.
      { agrees: near(x.rate * x.t, x.v), detail: `${show(x.rate)} × ${x.t} = ${show(x.rate * x.t)} cm³` },
      { context: c.name, v: x.v, t: x.t, rate: x.rate },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q6: the gradient of a tangent
// ---------------------------------------------------------------------------------------------

/** Runs of a tangent's triangle, read off the time axis in seconds: never 10 or 100. */
const RUNS = range(15, 120, 5).filter((x) => x !== 100)
/** Times the tangent touches the curve, in seconds. */
const AT = range(10, 120, 5)

interface Tangent {
  rise: number
  run: number
  at: number
  rate: number
}
/**
 * Every rise and run whose gradient fits the reaction, exact to 2 decimal places, with at most
 * three figures; the gas collected by the time the tangent touches is at least the tangent's rate
 * times that time (the curve lies above its tangent), so rate × time stays under the syringe's
 * 100 cm³. Dividing the rise by the time of the tangent instead of the run gives a wrong answer.
 */
const tangents = (c: Collected): Tangent[] =>
  RUNS.flatMap((run) =>
    VOLUMES.map((rise) => ({ rise, run, rate: Number(show(rise / run)) }))
      .filter(({ rise, run, rate }) => near(rate * run, rise) && places(rate) <= 2 && figures(rate) <= 3)
      .filter(({ rise, run, rate }) => rate >= c.rate[0] && rate <= c.rate[1] && noOnes(rate) && !powerOfTen(rate) && clearOf(rate, rise, run) && distinct(rise, run, rate))
      .flatMap((x) =>
        AT.filter((at) => at !== x.run && x.rate * at <= 90 && distinct(at, x.rise, x.run) && clearOf(x.rate, at) && Math.abs(x.rise / at - x.rate) > 0.05 * x.rate).map((at) => ({ ...x, at })),
      ),
  )

/**
 * The tangents for each gradient, grouped by run. Only gradients two runs or more can give are
 * kept: a gradient such as 0.62 cm³/s comes only from a run of 50 s, and keeping those let one
 * run fill nearly half a context.
 */
const GRADIENTS = new Map<string, Map<number, Map<number, Tangent[]>>>()
function byGradient(c: Collected): Map<number, Map<number, Tangent[]>> {
  let out = GRADIENTS.get(c.name)
  if (out) return out
  out = new Map()
  for (const x of tangents(c)) {
    const runs = out.get(x.rate) ?? new Map<number, Tangent[]>()
    runs.set(x.run, [...(runs.get(x.run) ?? []), x])
    out.set(x.rate, runs)
  }
  for (const [rate, runs] of out) if (runs.size < 2) out.delete(rate)
  GRADIENTS.set(c.name, out)
  return out
}

const TANGENT_PROMPTS = [
  (c: Collected, x: Tangent) =>
    `${c.text} A tangent drawn on the graph of volume of ${c.gas} against time at ${x.at} s rises ${x.rise} cm³ over a run of ${x.run} s. Calculate the rate of reaction at ${x.at} s, in cm³/s.`,
  (c: Collected, x: Tangent) =>
    `${c.text} On the graph of volume of ${c.gas} against time, the student draws a tangent to the curve at ${x.at} s. The tangent rises ${x.rise} cm³ over a run of ${x.run} s. Calculate the rate at that moment, in cm³/s.`,
]

/** Rise ÷ run: written as q6 (30 cm³ over 20 s, 1.5 cm³/s). */
export const tangentRate: Generator = {
  id: 'reaction-rate-tangent',
  subjectId: 'chemistry',
  topicId: TOPIC,
  replaces: ['q6'],
  build(r, slot, turn) {
    const c = REACTIONS[turn % REACTIONS.length]!
    // The gradient evenly first, then a run evenly among those that give it, then a rise and time.
    // Drawing the run first let tenths, which most runs divide into, take three builds in five.
    const byRate = byGradient(c)
    const rate = pick(r, [...byRate.keys()])
    const byRun = byRate.get(rate)!
    const x = pick(r, byRun.get(pick(r, [...byRun.keys()]))!)
    return numeric(
      slot,
      {
        prompt: pick(r, TANGENT_PROMPTS)(c, x),
        solution: `The rate at that moment is the gradient of the tangent, **rise ÷ run**: $\\dfrac{${x.rise}}{${x.run}} = ${show(x.rate)}$ cm³/s. The time the tangent touches, ${x.at} s, is not part of the gradient.`,
        method: ['divides rise by run'],
        answer: x.rate,
        tolerance: threeFigures(toPlaces(x.rate, 2), x.rate),
        line: `${show(x.rate)} cm³/s`,
      },
      { agrees: near(x.rate * x.run, x.rise), detail: `${show(x.rate)} × ${x.run} = ${show(x.rate * x.run)} cm³` },
      { context: c.name, rise: x.rise, run: x.run, at: x.at, rate: x.rate },
    )
  },
}

export const rateGenerators: Generator[] = [meanRate, tangentRate]

/** For the tests. */
export const RATES = { REACTIONS, VOLUMES, RUNS, AT, means, tangents, byGradient }
