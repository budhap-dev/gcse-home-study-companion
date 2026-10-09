import type { Question } from '../../content/questions.ts'
import { clearOfHalf, fixed, roundTo, show } from '../format.ts'
import { atMost, cap, figures, near, numeric, tex } from '../physics/build.ts'
import { draw, int, pick, shuffle, type Rng } from '../random.ts'
import type { Generator } from '../types.ts'
import { clean, clearOf, distinct, evenly, noOnes, powerOfTen, range, shiftFree, tenfold, threeFigures, toPlaces, word } from '../chemistry/build.ts'

/**
 * Transport in cells and plants (AQA 8461, 4.1.3 and 4.2.3): osmosis in potato cylinders
 * (required practical 3), surface area to volume ratio and Fick's law, magnification and
 * stomatal density in the leaf, and the potometer. Every numeric written slot in the four topics
 * has a generator here; none is left written.
 *
 * Every figure is one the thing really has. A potato cylinder cut with a cork borer weighs 1 to
 * 5 g; it gains mass in distilled water and dilute sucrose and loses it in concentrated sucrose,
 * by up to about 25 to 30%, and its cell contents match about 0.2 to 0.45 mol/dm³ sucrose.
 * Plant cells are 10 to 100 µm, animal cells 10 to 30 µm, a flatworm a few millimetres long and
 * under a millimetre thick. A light microscope's field of view at ×400 is 0.39 to 0.56 mm across,
 * so 0.12 to 0.25 mm²; a leaf's lower surface carries 100 to 300 stomata per mm² and its upper
 * surface fewer. A potometer's capillary tube has a bore of 0.5 to 1.5 mm, and its bubble moves
 * from about half a millimetre a minute in humid air to about 12 in moving air.
 */
const OSMOSIS = 'diffusion-osmosis-and-active-transport'
const EXCHANGE = 'exchange-surfaces-and-gas-exchange'
const LEAF = 'leaf-root-and-transport-tissues'
const TRANSPIRATION = 'transpiration-and-translocation'

/** A signed figure in prose, with a true minus: +4.5, −12. */
const pm = (x: number) => (x < 0 ? `−${show(-x)}` : `+${show(x)}`)
/** A signed reading to 1 decimal place, as a results table prints it: +10.0, −4.5. */
const pm1 = (x: number) => (x < 0 ? `−${fixed(-x, 1)}` : `+${fixed(x, 1)}`)
/** A signed figure in maths: +4.5, -12. */
const ms = (x: number) => (x < 0 ? `-${show(-x)}` : `+${show(x)}`)
/** A reading in a sum in maths, to 1 decimal place and bracketed when negative: (-4.5). */
const term = (x: number) => (x < 0 ? `(${fixed(x, 1)})` : fixed(x, 1))
/** Two decimal places, as a balance reading to 0.01 g prints a mass: 2.50. */
const g2 = (x: number) => fixed(x, 2)
/** The written slot's units field, which every generated question keeps. */
const unitsOf = (slot: Question) => (slot.type === 'numeric' ? slot.units : undefined)
/**
 * A candidate drawn evenly at each level in turn: among the values of the first key, then of the
 * second among the candidates left, and so on. The answer first then an input keeps one starting
 * mass that divides cleanly (4.00 g, 1.25 g) from filling a context, as drawing the answer alone
 * let it; an input first then the answer does the same for a time or a field of view. Pools are
 * built once per key.
 */
const LAYERS = new Map<string, unknown[]>()
function layered<T>(r: Rng, key: string, make: () => T[], ...levels: ((t: T) => number | string)[]): T {
  let pool = LAYERS.get(key) as T[] | undefined
  if (!pool) {
    pool = make()
    if (!pool.length) throw new Error(`no candidates for ${key}`)
    LAYERS.set(key, pool)
  }
  for (const level of levels) {
    const value: number | string = pick(r, [...new Set(pool.map(level))])
    pool = pool.filter((t) => level(t) === value)
  }
  return pick(r, pool)
}
/**
 * Only the candidates whose first key has at least `n` values of the second (and of any further
 * keys): no answer that one mass, one edge or one thickness alone gives.
 */
function rich<T>(pool: T[], first: (t: T) => number, second: (t: T) => number, n: number, ...more: ((t: T) => number)[]): T[] {
  return [second, ...more].reduce((left, key) => {
    const seen = new Map<number, Set<number>>()
    for (const t of left) seen.set(first(t), (seen.get(first(t)) ?? new Set()).add(key(t)))
    return left.filter((t) => seen.get(first(t))!.size >= n)
  }, pool)
}
/** The factor in maths: exact if it ends within 4 places, else its first 4 places and an ellipsis. */
const factorTex = (x: number) => (atMost(x, 4) ? show(x) : `${String(Math.floor(x * 1e4) / 1e4)}\\ldots`)
const between = (x: number, [lo, hi]: readonly [number, number]) => x >= lo - 1e-9 && x <= hi + 1e-9

// =============================================================================================
// Diffusion, osmosis and active transport: the potato cylinders of required practical 3
// =============================================================================================

// ---------------------------------------------------------------------------------------------
// q5: the percentage change in mass of one cylinder, with its sign
// ---------------------------------------------------------------------------------------------

interface Bath {
  name: string
  /** The percentage changes in mass a potato cylinder really shows in it, signed. */
  change: readonly [number, number]
}
/**
 * Gains in distilled water and 0.1 mol/dm³ sucrose, losses in 0.8 and 1.0 mol/dm³, in the
 * order that alternates the sign from one turn to the next: a student who always types a minus
 * is right half the time.
 */
const BATHS: Bath[] = [
  { name: 'distilled water', change: [8, 25] },
  { name: '0.8 mol/dm³ sucrose solution', change: [-25, -8] },
  { name: '0.1 mol/dm³ sucrose solution', change: [3, 15] },
  { name: '1.0 mol/dm³ sucrose solution', change: [-30, -10] },
]
/** Starting masses of a cork-borer cylinder, 1.20 to 5.00 g, in hundredths of a gram. */
const START_MASSES = range(120, 500)

interface Change {
  m0: number
  m1: number
  d: number
  p: number
}
/**
 * Every starting mass and change that gives a percentage in the bath's range exact to 1 decimal
 * place, with a change of at least 0.10 g, and a percentage that is none of the masses or the
 * change, nor one doubled or halved with the point moved (2.00 g makes it fifty times the change).
 */
function changes(b: Bath): Change[] {
  const out: Change[] = []
  for (const M of START_MASSES) {
    for (let P = Math.round(b.change[0] * 10); P <= Math.round(b.change[1] * 10); P++) {
      if ((M * P) % 1000 !== 0) continue
      const D = (M * P) / 1000
      if (Math.abs(D) < 10) continue
      const m0 = clean(M / 100)
      const m1 = clean((M + D) / 100)
      const d = clean(D / 100)
      const p = clean(P / 10)
      if (!shiftFree(Math.abs(p), m0, m1, Math.abs(d)) || !distinct(m0, m1, Math.abs(d))) continue
      out.push({ m0, m1, d, p })
    }
  }
  return out
}

const TIMES = ['an hour', 'two hours', 'three hours']
const CHANGE_PROMPTS = [
  (b: Bath, x: Change) =>
    `A potato cylinder in ${b.name} started at ${g2(x.m0)} g and finished at ${g2(x.m1)} g. Calculate the percentage change in mass. Give your answer including the sign.`,
  (b: Bath, x: Change, time: string) =>
    `A student weighs a potato cylinder at ${g2(x.m0)} g, leaves it in ${b.name} for ${time}, then blots it dry and weighs it again at ${g2(x.m1)} g. Calculate the percentage change in mass. Give your answer including the sign.`,
]

/** (new − old) ÷ old × 100, signed: written as q5 (2.5 g to 2.2 g, −12). */
export const osmosisChange: Generator = {
  id: 'osmosis-percentage-change',
  subjectId: 'biology',
  topicId: OSMOSIS,
  replaces: ['q5'],
  build(r, slot, turn) {
    const b = BATHS[turn % BATHS.length]!
    // A percentage first, among those three masses or more give, then a mass: a percentage such as
    // 13.5 that only 4.00 g gives would let one mass fill a third of the context.
    const x = layered(r, `osmosis-percentage-change:${b.name}`, () => rich(changes(b), (y) => y.p, (y) => y.m0, 3), (y) => y.p, (y) => y.m0)
    const sign = x.p > 0
      ? 'Positive, so water moved **in** by osmosis and the solution was **more dilute** than the cell contents.'
      : 'Negative, so water moved **out** by osmosis and the solution was **more concentrated** than the cell contents.'
    return numeric(
      slot,
      {
        prompt: pick(r, CHANGE_PROMPTS)(b, x, pick(r, TIMES)),
        solution: `Change $= ${g2(x.m1)} - ${g2(x.m0)} = ${g2(x.d)}$ g. $\\dfrac{${g2(x.d)}}{${g2(x.m0)}} \\times 100 = ${show(x.p)}\\%$. ${sign}`,
        method: ['divides the change by the original mass'],
        answer: x.p,
        tolerance: toPlaces(x.p, 1),
        units: unitsOf(slot),
        line: `${show(x.p)}%`,
      },
      // Second route: the starting mass grown by the percentage gives the final mass back.
      { agrees: near((x.m0 * (100 + x.p)) / 100, x.m1), detail: `${g2(x.m0)} × ${show(1 + x.p / 100)} = ${show((x.m0 * (100 + x.p)) / 100)} g` },
      { context: b.name, m0: x.m0, m1: x.m1, p: x.p },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q14: why a percentage is used — the same change in mass on two starting masses
// ---------------------------------------------------------------------------------------------

interface Way {
  name: string
  verb: string
  /** What the prompt compares: "percentage change" for a gain, as written. */
  measure: string
  /** The raw figures the solution says are identical. */
  raw: string
  setting: string
}
const WAYS: Way[] = [
  { name: 'gain', verb: 'gains', measure: 'percentage change', raw: 'gains', setting: 'Two potato cylinders of different sizes are left in the same dilute sucrose solution.' },
  { name: 'loss', verb: 'loses', measure: 'percentage loss in mass', raw: 'losses', setting: 'Two potato cylinders of different sizes are left in the same concentrated sucrose solution.' },
]
const MORE_THAN = ['', '', 'twice', 'three times', 'four times']

interface Pair {
  a: number
  b: number
  g: number
  pA: number
  pB: number
  /** pA ÷ pB unrounded, and to 1 decimal place. */
  exact: number
  k: number
}
/**
 * Both cylinders 1 to 5 g, B 2.15 to 4.9 times A, so the claim "more than twice, three times or
 * four times" is true and stays true at 1 decimal place; both percentages exact to 2 decimal
 * places, A's no more than 30%, B's at least 1.5%; the ratio clear of a half at 1 decimal place,
 * never whole and never ending in .1 ("3.1 times" reads to the release check as "1 times"); no
 * figure 1, no two figures the same, and the ratio none of the figures with the point moved.
 */
const PAIRS: Pair[] = (() => {
  const out: Pair[] = []
  for (let A = 101; A <= 230; A++) {
    // B under 5 g: 5.00 g divides so cleanly that it was B in a third of the builds.
    for (let B = Math.ceil(A * 2.15); B <= Math.min(495, Math.floor(A * 4.9)); B++) {
      const exact = B / A
      const k = roundTo(exact, 1)
      const K = Math.round(k * 10)
      if (K % 10 === 0 || K % 10 === 1 || Math.floor(k) !== Math.floor(exact) || !clearOfHalf(exact, 1, 0.1)) continue
      for (let G = 10; G <= 80; G++) {
        if ((G * 10000) % A !== 0 || (G * 10000) % B !== 0) continue
        const pA = clean((G * 100) / A)
        const pB = clean((G * 100) / B)
        if (pA > 30 || pA < 4 || pB < 1.5) continue
        const a = clean(A / 100)
        const b = clean(B / 100)
        const g = clean(G / 100)
        if (!noOnes(a, b, g) || !distinct(a, b, g, pA, pB) || !clearOf(k, a, b, g, pA, pB)) continue
        out.push({ a, b, g, pA, pB, exact, k })
      }
    }
  }
  return out
})()

/** The ratio of two percentages of the same change: written as q14 (0.4 g on 2.5 g and on 8.0 g, 3.2). */
export const osmosisComparison: Generator = {
  id: 'osmosis-percentage-comparison',
  subjectId: 'biology',
  topicId: OSMOSIS,
  replaces: ['q14'],
  build(r, slot, turn) {
    const w = WAYS[turn % WAYS.length]!
    const x = layered(r, 'osmosis-percentage-comparison', () => PAIRS, (y) => y.k, (y) => y.b, (y) => y.a)
    const more = MORE_THAN[Math.floor(x.k)]!
    const pc = (p: number) => `${show(p)}\\%`
    return numeric(
      slot,
      {
        prompt:
          `${w.setting} Cylinder A ${w.verb} ${g2(x.g)} g from a starting mass of ${g2(x.a)} g. Cylinder B ${w.verb} ${g2(x.g)} g from a starting mass of ${g2(x.b)} g. ` +
          `Show that the ${w.measure} for A is more than ${more} the ${w.measure} for B, and give how many times greater it is, to one decimal place.`,
        solution:
          `A: $\\dfrac{${g2(x.g)}}{${g2(x.a)}} \\times 100 = ${pc(x.pA)}$. B: $\\dfrac{${g2(x.g)}}{${g2(x.b)}} \\times 100 = ${pc(x.pB)}$. ` +
          `$${show(x.pA)} \\div ${show(x.pB)} = ${atMost(x.exact, 1) ? show(x.k) : `${factorTex(x.exact)} = ${show(x.k)}`}$${atMost(x.exact, 1) ? '' : ' to one decimal place'}, so A's is **${show(x.k)} times** greater — more than ${more} — even though the **raw ${w.raw} are identical**. ` +
          'That is exactly why a percentage is used: it allows for the different starting masses.',
        method: [`finds ${show(x.pA)}% for A`, `finds ${show(x.pB)}% for B`],
        answer: x.k,
        tolerance: toPlaces(x.k, 1),
        units: unitsOf(slot),
        line: `${show(x.k)} times`,
      },
      // Second route: the same change on both, so the ratio of percentages is B's mass over A's.
      { agrees: near(roundTo(x.b / x.a, 1), x.k) && near(roundTo(x.pA / x.pB, 1), x.k), detail: `${g2(x.b)} ÷ ${g2(x.a)} = ${show(x.b / x.a)}` },
      { context: w.name, a: x.a, b: x.b, g: x.g, k: x.k },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q24: the mean of three repeats, keeping the sign
// ---------------------------------------------------------------------------------------------

interface Repeat {
  name: string
  /** The mean percentage change in mass of potato in it, signed. */
  mean: readonly [number, number]
}
/** Potato cell contents match about 0.25 to 0.3 mol/dm³ sucrose: gains below, losses above, alternating by turn. */
const REPEATS: Repeat[] = [
  { name: '0.2 mol/dm³ sucrose', mean: [1.5, 7] },
  { name: '0.6 mol/dm³ sucrose', mean: [-14, -6] },
  { name: '0.1 mol/dm³ sucrose', mean: [5, 12] },
  { name: '0.8 mol/dm³ sucrose', mean: [-18, -9] },
  { name: 'distilled water', mean: [10, 22] },
  { name: '1.0 mol/dm³ sucrose', mean: [-24, -12] },
]

const MEAN_PROMPTS = [
  (c: Repeat, rs: number[]) =>
    `Three potato cylinders in ${c.name} gave percentage changes in mass of ${pm1(rs[0]!)}%, ${pm1(rs[1]!)}% and ${pm1(rs[2]!)}%. Calculate the mean percentage change. Give your answer including the sign.`,
  (c: Repeat, rs: number[]) =>
    `A student leaves three potato cylinders in ${c.name} for an hour. Their percentage changes in mass are ${pm1(rs[0]!)}%, ${pm1(rs[1]!)}% and ${pm1(rs[2]!)}%. Calculate the mean percentage change, giving your answer including the sign.`,
]

/**
 * Three readings about a mean: each within a quarter of the mean and 1.5 percentage points of it,
 * none equal to it, no two the same, all of the mean's sign.
 */
function readings(r: Rng, m: number): number[] {
  const M = Math.round(m * 10)
  const most = Math.max(3, Math.min(15, Math.round(Math.abs(M) / 4)))
  const devs = draw(
    r,
    () => {
      const d1 = int(r, -most, most)
      const d2 = int(r, Math.max(-most, -most - d1), Math.min(most, most - d1))
      return [d1, d2, -d1 - d2]
    },
    (ds) => ds.every((d) => d !== 0) && new Set(ds).size === 3 && ds.every((d) => Math.sign(M + d) === Math.sign(M) && Math.abs(M + d) >= 5),
  )
  return devs.map((d) => clean((M + d) / 10))
}

/** The mean of three signed repeats: written as q24 (+4.5, +5.1, +4.2, +4.6%). */
export const osmosisMean: Generator = {
  id: 'osmosis-mean-change',
  subjectId: 'biology',
  topicId: OSMOSIS,
  replaces: ['q24'],
  build(r, slot, turn) {
    const c = REPEATS[turn % REPEATS.length]!
    const m = pick(r, range(c.mean[0], c.mean[1], 0.1))
    const rs = readings(r, m)
    const sum = clean(rs[0]! + rs[1]! + rs[2]!)
    const sign = m > 0
      ? 'positive means the cylinders gained mass, so water moved **in**, and the solution was more dilute than the cell contents.'
      : 'negative means the cylinders lost mass, so water moved **out**, and the solution was more concentrated than the cell contents.'
    return numeric(
      slot,
      {
        prompt: pick(r, MEAN_PROMPTS)(c, rs),
        solution: `Add the three and divide by three: $\\dfrac{${rs.map(term).join(' + ')}}{3} = \\dfrac{${show(sum)}}{3} = ${show(m)}$, so the mean change is $${ms(m)}\\%$. The sign stays: ${sign}`,
        method: ['adds the three values and divides by 3'],
        answer: m,
        tolerance: toPlaces(m, 1),
        units: unitsOf(slot),
        line: `${pm(m)}%`,
      },
      // Second route: the readings' differences from the mean add to nothing.
      { agrees: near(rs.reduce((s, x) => s + (x - m), 0), 0), detail: `${rs.map((x) => show(x - m)).join(' + ')} = 0` },
      { context: c.name, r1: rs[0]!, r2: rs[1]!, r3: rs[2]!, mean: m },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q25: where the line between two results crosses 0%
// ---------------------------------------------------------------------------------------------

interface Series {
  name: string
  /** The sucrose concentrations tested, from 0 in equal steps, in mol/dm³. */
  step: number
  top: number
  /** The two tested concentrations either side of the crossing. */
  pairs: [number, number][]
}
/**
 * The series a class tests, and the pairs of tested concentrations either side of potato's
 * crossing, which lies at about 0.2 to 0.45 mol/dm³.
 */
const SERIES: Series[] = [
  { name: 'steps of 0.1', step: 0.1, top: 0.6, pairs: [[0.2, 0.3], [0.3, 0.4]] },
  { name: 'steps of 0.2', step: 0.2, top: 1.0, pairs: [[0.2, 0.4]] },
  { name: 'steps of 0.25', step: 0.25, top: 1.0, pairs: [[0.25, 0.5]] },
]

interface Crossing {
  c1: number
  c2: number
  p1: number
  p2: number
  drop: number
  per: number
  shift: number
  x: number
}
/**
 * Every pair of signed means, to 1 decimal place and at least 0.5 from zero, that falls 30 to 70
 * percentage points per mol/dm³ as potato does, with a value per point of at most 4 decimal places
 * and a crossing exact to 2; the two means are never the same size (the crossing would be the
 * midpoint, and halfway would be right by luck), never 1 (1 points), and the crossing is none of
 * the figures with the point moved (3.2% and 0.32 mol/dm³).
 */
function crossings(s: Series): Crossing[] {
  const out: Crossing[] = []
  for (const [c1, c2] of s.pairs) {
    const dc = clean(c2 - c1)
    for (let P1 = 5; P1 <= 200; P1++) {
      for (let P2 = -5; P2 >= -200; P2--) {
        const drop = clean((P1 - P2) / 10)
        if (drop / dc < 30 || drop / dc > 70 || P1 === -P2) continue
        const p1 = clean(P1 / 10)
        const p2 = clean(P2 / 10)
        const per = clean(dc / drop)
        if (!atMost(per, 4)) continue
        const shift = clean(p1 * per)
        const x = clean(c1 + shift)
        // Not within marking distance of the midpoint either: 0.37 between 0.25 and 0.5 is 0.375 to a student who halves.
        if (!atMost(x, 2) || x > 0.45 || Math.abs(x - (c1 + c2) / 2) < 0.006 || !noOnes(p1, -p2) || !shiftFree(x, p1, -p2, drop, dc)) continue
        out.push({ c1, c2, p1, p2, drop, per, shift, x })
      }
    }
  }
  return out
}

/** Linear interpolation to 0% change: written as q25 (+6% at 0.2, −4% at 0.4, 0.32 mol/dm³). */
export const osmosisCrossing: Generator = {
  id: 'osmosis-crossing-point',
  subjectId: 'biology',
  topicId: OSMOSIS,
  replaces: ['q25'],
  build(r, slot, turn) {
    const s = SERIES[turn % SERIES.length]!
    const x = evenly(r, `osmosis-crossing-point:${s.name}`, () => crossings(s), (y) => y.x)
    return numeric(
      slot,
      {
        prompt:
          `In the osmosis core practical, a student puts potato cylinders in sucrose solutions from 0 to ${fixed(s.top, 1)} mol/dm³ in steps of ${show(s.step)} mol/dm³. ` +
          pick(r, [
            `The mean percentage change in mass was ${pm(x.p1)}% in ${show(x.c1)} mol/dm³ sucrose and ${pm(x.p2)}% in ${show(x.c2)} mol/dm³ sucrose. `,
            `The two results either side of zero are a mean change in mass of ${pm(x.p1)}% in ${show(x.c1)} mol/dm³ sucrose and ${pm(x.p2)}% in ${show(x.c2)} mol/dm³ sucrose. `,
          ]) +
          'Taking the line between these two points as straight, calculate the sucrose concentration at which the line crosses 0% change, which is the concentration of the potato cell contents.',
        solution:
          `Between the two concentrations the change falls from $${ms(x.p1)}\\%$ to $${ms(x.p2)}\\%$, a drop of **${show(x.drop)} percentage points** across **${show(clean(x.c2 - x.c1))} mol/dm³**, ` +
          `so each percentage point is worth $${show(clean(x.c2 - x.c1))} \\div ${show(x.drop)} = ${show(x.per)}$ mol/dm³. ` +
          `The line has to fall by ${show(x.p1)} points from $${ms(x.p1)}\\%$ to reach zero, which takes $${show(x.p1)} \\times ${show(x.per)} = ${show(x.shift)}$ mol/dm³. ` +
          `So the crossing is at $${show(x.c1)} + ${show(x.shift)} = ${show(x.x)}$ mol/dm³. ` +
          'That is the concentration at which there is no net movement of water, so it matches the cell contents. It lies between the two tested values, which is why it is read from the line and not from the nearest result.',
        method: [
          `a fall of ${show(x.drop)} percentage points across ${show(clean(x.c2 - x.c1))} mol/dm³, so ${show(x.per)} mol/dm³ per point`,
          `${show(x.p1)} points from ${pm(x.p1)}% to zero is ${show(x.p1)} × ${show(x.per)} = ${show(x.shift)} mol/dm³ beyond ${show(x.c1)}`,
        ],
        answer: x.x,
        tolerance: threeFigures(toPlaces(x.x, 2), x.x),
        units: unitsOf(slot),
        line: `${show(x.x)} mol/dm³`,
      },
      // Second route: back from the other end, rising |p2| points from the higher concentration.
      { agrees: near(x.c2 + x.p2 * x.per, x.x), detail: `${show(x.c2)} − ${show(-x.p2)} × ${show(x.per)} = ${show(x.c2 + x.p2 * x.per)}` },
      { context: s.name, c1: x.c1, c2: x.c2, p1: x.p1, p2: x.p2, x: x.x },
    )
  },
}

// =============================================================================================
// Exchange surfaces: surface area to volume ratio and Fick's law
// =============================================================================================

// ---------------------------------------------------------------------------------------------
// q2: the surface area of a cube
// ---------------------------------------------------------------------------------------------

interface Cube {
  name: string
  unit: string
  /** Sides it really has, in its unit; never 6, where surface area and volume are the same number. */
  sides: number[]
  prompts: ((s: number) => string)[]
}
const CUBES: Cube[] = [
  {
    // Agar cubes for the diffusion practical are cut 5 to 30 mm.
    name: 'agar cube',
    unit: 'mm',
    sides: range(5, 30).filter((s) => s !== 6 && s !== 10),
    prompts: [
      (s) => `Calculate the surface area, in mm², of a cube of agar jelly with sides of ${s} mm.`,
      (s) => `A student cuts a cube of agar jelly with sides of ${s} mm to model a cell. Calculate its surface area in mm².`,
    ],
  },
  {
    // Potato cubes for an osmosis practical, 8 to 25 mm.
    name: 'potato cube',
    unit: 'mm',
    sides: range(8, 25).filter((s) => s !== 10),
    prompts: [
      (s) => `Calculate the surface area, in mm², of a cube of potato with sides of ${s} mm.`,
      (s) => `A student cuts a cube of potato with sides of ${s} mm for an osmosis practical. Calculate its surface area in mm².`,
    ],
  },
  {
    // Plant cells are 10 to 100 µm; 20 to 40 µm keeps the answer under 10 000.
    name: 'plant cell',
    unit: 'µm',
    sides: range(20, 40),
    prompts: [
      (s) => `A plant cell is modelled as a cube with sides of ${s} µm. Calculate its surface area in µm².`,
      (s) => `Calculate the surface area, in µm², of a plant cell modelled as a cube with sides of ${s} µm.`,
    ],
  },
  {
    // Animal cells are 10 to 30 µm.
    name: 'animal cell',
    unit: 'µm',
    sides: range(11, 30),
    prompts: [
      (s) => `An animal cell is modelled as a cube with sides of ${s} µm. Calculate its surface area in µm².`,
      (s) => `Calculate the surface area, in µm², of an animal cell modelled as a cube with sides of ${s} µm.`,
    ],
  },
]

/** Six square faces: written as q2 (sides of 3 cm, 54 cm²). */
export const cubeArea: Generator = {
  id: 'cube-surface-area',
  subjectId: 'biology',
  topicId: EXCHANGE,
  replaces: ['q2'],
  build(r, slot, turn) {
    const c = CUBES[turn % CUBES.length]!
    const s = pick(r, c.sides)
    const face = s * s
    const area = 6 * face
    return numeric(
      slot,
      {
        prompt: pick(r, c.prompts)(s),
        solution: `Six faces, each $${s} \\times ${s} = ${face}$ ${c.unit}², so $6 \\times ${face} = ${area}$ ${c.unit}².`,
        method: [],
        // Exact: a whole-millimetre cube has a whole-number area, which nobody rounds.
        answer: area,
        tolerance: 0,
        units: unitsOf(slot),
        line: `${area} ${c.unit}²`,
      },
      // Second route: four sides and two ends.
      { agrees: 4 * s * s + 2 * s * s === area, detail: `4 × ${face} + 2 × ${face} = ${4 * face + 2 * face}` },
      { context: c.name, s, area },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q5: the surface area to volume ratio of a cube
// ---------------------------------------------------------------------------------------------

interface RatioCube {
  name: string
  unit: string
  /** Sides it really has, in its unit; only those whose ratio 6 ÷ side is exact. */
  sides: number[]
  prompts: ((s: number, r: Rng) => string)[]
}
const AGAR_DYES = ['made pink with phenolphthalein and sodium hydroxide', 'containing universal indicator', 'containing cresol red indicator']
const RATIO_ENDS = ['Calculate its surface area to volume ratio, giving the number before the colon.', 'Calculate the ratio of its surface area to its volume. Give the ratio in the form n : 1 and enter n.']
/** A side that is not 1, 6 or a power of ten, and a ratio exact to 3 decimal places with at most three figures, never a power of ten, and none of the side's figures. */
const exactRatio = (s: number) => {
  const q = clean(6 / s)
  return s !== 6 && noOnes(s) && !powerOfTen(s) && atMost(q, 3) && figures(q) <= 3 && !powerOfTen(q) && clearOf(q, s)
}
const RATIO_CUBES: RatioCube[] = [
  {
    // Agar cubes for the diffusion practical, 0.5 to 5 cm.
    name: 'agar cube in cm',
    unit: 'cm',
    sides: range(0.5, 5, 0.1).filter(exactRatio),
    prompts: [
      (s, r) => `A student cuts a cube of agar jelly ${pick(r, AGAR_DYES)} with sides of ${s} cm. ${pick(r, RATIO_ENDS)}`,
      (s, r) => `A cube has sides of ${s} cm. ${pick(r, RATIO_ENDS)}`,
    ],
  },
  {
    // The same cubes measured in millimetres, 5 to 40 mm.
    name: 'agar cube in mm',
    unit: 'mm',
    sides: range(5, 40).filter(exactRatio),
    prompts: [
      (s, r) => `A student cuts a cube of agar jelly ${pick(r, AGAR_DYES)} with sides of ${s} mm. ${pick(r, RATIO_ENDS)}`,
      (s, r) => `A cube has sides of ${s} mm. ${pick(r, RATIO_ENDS)}`,
    ],
  },
  {
    // Plant cells 10 to 100 µm; animal cells only up to 30 µm.
    name: 'cell',
    unit: 'µm',
    sides: range(10, 100).filter(exactRatio),
    prompts: [(s, r) => `${s <= 30 ? pick(r, ['A plant cell', 'An animal cell']) : 'A plant cell'} is modelled as a cube with sides of ${s} µm. ${pick(r, RATIO_ENDS)}`],
  },
]

/** Surface area ÷ volume of a cube: written as q5 (sides of 3 cm, 2 : 1). */
export const cubeRatio: Generator = {
  id: 'cube-surface-area-to-volume',
  subjectId: 'biology',
  topicId: EXCHANGE,
  replaces: ['q5'],
  build(r, slot, turn) {
    const c = RATIO_CUBES[turn % RATIO_CUBES.length]!
    const s = pick(r, c.sides)
    const area = clean(6 * s * s)
    const volume = clean(s * s * s)
    const ratio = clean(area / volume)
    return numeric(
      slot,
      {
        prompt: pick(r, c.prompts)(s, r),
        solution: `Surface area $= 6 \\times ${tex(clean(s * s))} = ${tex(area)}$ ${c.unit}²; volume $= ${s}^3 = ${tex(volume)}$ ${c.unit}³. Ratio $= ${tex(area)} \\div ${tex(volume)} = ${show(ratio)} : 1$.`,
        method: ['finds both the surface area and the volume'],
        answer: ratio,
        tolerance: threeFigures(0, ratio),
        units: unitsOf(slot),
        line: `${show(ratio)} : 1`,
      },
      // Second route: a cube's ratio is 6 ÷ its side.
      { agrees: near(6 / s, ratio), detail: `6 ÷ ${s} = ${show(6 / s)}` },
      { context: c.name, s, ratio },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q26: the surface area to volume ratio of a cuboid
// ---------------------------------------------------------------------------------------------

interface Block {
  name: string
  unit: string
  /** Every cuboid it really makes, as [a, b, c]. */
  dims: () => [number, number, number][]
  prompt: (d: [number, number, number]) => string
  /** What the solution calls it. */
  noun: string
}
const N1 = 'Calculate its surface area to volume ratio. Give the ratio in the form n : 1 and enter n.'
const N2 = 'Calculate the ratio of its surface area to its volume, in the form n : 1, and enter n.'
const BLOCKS: Block[] = [
  {
    // Agar blocks for the diffusion practical, 1.25 to 8 cm on a side, not cubes. Half a centimetre
    // is left out: its exact reciprocal made it the thin side of nearly half the blocks; the
    // quarter-centimetre sides widen the ratios so no one edge fills the blocks.
    name: 'agar block',
    unit: 'cm',
    dims: () => {
      const L = [1.25, 1.5, 2, 2.5, 3, 3.75, 4, 5, 6, 7.5, 8]
      return L.flatMap((a, i) => L.slice(i).flatMap((b, j) => L.slice(i + j).map((c) => [a, b, c] as [number, number, number]))).filter(([a, b, c]) => !(a === b && b === c))
    },
    prompt: ([a, b, c]) => `A block of agar jelly measures ${a} cm by ${b} cm by ${c} cm. ${N1}`,
    noun: 'block',
  },
  {
    // A flatworm 8 to 25 mm long, 2 to 5 mm wide and 0.25 to 0.5 mm thick.
    name: 'flatworm',
    unit: 'mm',
    dims: () => range(8, 25).flatMap((l) => [2, 2.5, 3, 4, 5].flatMap((w) => [0.25, 0.4, 0.5].map((t) => [l, w, t] as [number, number, number]))),
    prompt: ([l, w, t]) =>
      `A flatworm has no lungs or gills: oxygen diffuses in through its body surface. It is modelled as a cuboid ${l} mm long, ${w} mm wide and ${t} mm thick. ${N1}`,
    noun: 'cuboid',
  },
  {
    // A palisade cell 16 to 32 µm across and 40 to 100 µm tall.
    name: 'palisade cell',
    unit: 'µm',
    dims: () => range(16, 32).flatMap((w) => range(40, 100, 5).map((h) => [w, w, h] as [number, number, number])),
    prompt: ([w, , h]) => `A palisade mesophyll cell is modelled as a cuboid ${w} µm by ${w} µm by ${h} µm. ${N1}`,
    noun: 'cuboid',
  },
]

interface Cuboid {
  d: [number, number, number]
  area: number
  volume: number
  ratio: number
}
const cuboid = (d: [number, number, number]): Cuboid => {
  const [a, b, c] = d
  const area = clean(2 * (a * b + a * c + b * c))
  const volume = clean(a * b * c)
  return { d, area, volume, ratio: clean(area / volume) }
}
/** A ratio exact to 3 decimal places with at most three figures, none of the dimensions with the point moved, doubled or halved, and never 1. */
const cuboids = (b: Block) =>
  b.dims().map(cuboid).filter((x) => atMost(x.ratio, 3) && figures(x.ratio) <= 3 && !powerOfTen(x.ratio) && noOnes(...x.d) && clearOf(x.ratio, ...x.d))

/** The faces in the written solution's words: two of each pair, or two ends and four sides when two edges match. */
function faces([a, b, c]: [number, number, number], unit: string, noun: string): { text: string; sum: string } {
  const ab = clean(a * b)
  const ac = clean(a * c)
  const bc = clean(b * c)
  const [p, q] = a === b ? [ab, ac] : b === c ? [bc, ab] : a === c ? [ac, ab] : [NaN, NaN]
  if (!Number.isNaN(p)) {
    const [e, s] = a === b ? [`${a} \\times ${a}`, `${a} \\times ${c}`] : b === c ? [`${b} \\times ${b}`, `${a} \\times ${b}`] : [`${a} \\times ${a}`, `${a} \\times ${b}`]
    return {
      text: `The ${noun} has two faces of $${e} = ${tex(p)}$ ${unit}² and four faces of $${s} = ${tex(q!)}$ ${unit}²`,
      sum: `(2 \\times ${tex(p)}) + (4 \\times ${tex(q!)}) = ${tex(clean(2 * p))} + ${tex(clean(4 * q!))}`,
    }
  }
  return {
    text: `The ${noun} has two faces each of $${a} \\times ${b} = ${tex(ab)}$, $${a} \\times ${c} = ${tex(ac)}$ and $${b} \\times ${c} = ${tex(bc)}$ ${unit}²`,
    sum: `2 \\times (${tex(ab)} + ${tex(ac)} + ${tex(bc)})`,
  }
}

/** Surface area ÷ volume of a cuboid: written as q26 (2 × 2 × 4 cm, 2.5 : 1). */
export const cuboidRatio: Generator = {
  id: 'cuboid-surface-area-to-volume',
  subjectId: 'biology',
  topicId: EXCHANGE,
  replaces: ['q26'],
  build(r, slot, turn) {
    const b = BLOCKS[turn % BLOCKS.length]!
    // The ratio first, then the longest edge and the middle one among the blocks that give it. For
    // an agar block only ratios that two or more of each edge give: a ratio only 8 cm blocks gave
    // made 8 cm the longest edge of two blocks in five.
    // Drawing the ratio alone let 5 cm be the longest edge of half the blocks.
    const x = layered(
      r,
      `cuboid-surface-area-to-volume:${b.name}`,
      () => (b.name === 'agar block' ? rich(cuboids(b), (y) => y.ratio, (y) => y.d[0], 2, (y) => y.d[1], (y) => y.d[2]) : cuboids(b)),
      (y) => y.ratio,
      (y) => y.d[2],
      (y) => y.d[1],
      (y) => y.d.join(' '),
    )
    const [a, bb, c] = x.d
    const f = faces(x.d, b.unit, b.noun)
    return numeric(
      slot,
      {
        prompt: b.prompt(x.d).replace(N1, pick(r, [N1, N2])),
        solution:
          `${f.text}, so the surface area is $${f.sum} = ${tex(x.area)}$ ${b.unit}². The volume is $${a} \\times ${bb} \\times ${c} = ${tex(x.volume)}$ ${b.unit}³. ` +
          `The ratio is $\\dfrac{${tex(x.area)}}{${tex(x.volume)}} = ${show(x.ratio)}$, written **${show(x.ratio)} : 1**.`,
        method: [`surface area ${show(x.area)} ${b.unit}² and volume ${show(x.volume)} ${b.unit}³`],
        answer: x.ratio,
        tolerance: threeFigures(0, x.ratio),
        units: unitsOf(slot),
        line: `${show(x.ratio)} : 1`,
      },
      // Second route: the ratio is 2 × (1/a + 1/b + 1/c).
      { agrees: near(2 * (1 / a + 1 / bb + 1 / c), x.ratio), detail: `2 × (1/${a} + 1/${bb} + 1/${c}) = ${show(2 * (1 / a + 1 / bb + 1 / c))}` },
      { context: b.name, a, b: bb, c, ratio: x.ratio },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Fick's law: rate ∝ surface area × concentration difference ÷ thickness of membrane
// ---------------------------------------------------------------------------------------------

interface Surface {
  name: string
  /** Whether it is a real organ, whose area can at most triple and whose membrane stays within half to three times as thick. */
  organ: boolean
  /** "the surface area of …" */
  area: string
  /** "… membrane thickness" or "the thickness of the membrane …" */
  membrane: string
}
const SURFACES: Surface[] = [
  { name: 'exchange surface', organ: false, area: 'the surface area of an exchange surface', membrane: 'its membrane thickness' },
  { name: 'alveoli', organ: true, area: 'the surface area of the alveoli in a lung', membrane: 'the thickness of the membrane between the air and the blood' },
  { name: 'gills', organ: true, area: 'the surface area of the gill filaments of a fish', membrane: 'the thickness of the membrane between the water and the blood' },
  { name: 'villi', organ: true, area: 'the surface area of the villi in the small intestine', membrane: 'the thickness of the membrane between the gut contents and the blood' },
]

/** A change to the surface area: what it does, and what the student says the rate must then do. */
const AREA_CHANGES: { f: number; does: string; claim: string }[] = [
  { f: 1.5, does: 'increases by half', claim: 'increase by half' },
  { f: 2, does: 'doubles', claim: 'double' },
  { f: 2.5, does: 'becomes two and a half times as large', claim: 'become two and a half times as fast' },
  { f: 3, does: 'triples', claim: 'triple' },
  { f: 4, does: 'becomes four times as large', claim: 'become four times as fast' },
  { f: 5, does: 'becomes five times as large', claim: 'become five times as fast' },
  { f: 6, does: 'becomes six times as large', claim: 'become six times as fast' },
  { f: 0.5, does: 'halves', claim: 'halve' },
  { f: 0.25, does: 'falls to a quarter', claim: 'fall to a quarter' },
]
const THICKNESS_CHANGES: { f: number; does: string }[] = [
  { f: 1.5, does: 'increases by half' },
  { f: 2, does: 'doubles' },
  { f: 2.5, does: 'becomes two and a half times as great' },
  { f: 3, does: 'triples' },
  { f: 4, does: 'becomes four times as great' },
  { f: 5, does: 'becomes five times as great' },
  { f: 0.5, does: 'halves' },
  { f: 0.25, does: 'falls to a quarter' },
]

interface Claim {
  A: (typeof AREA_CHANGES)[number]
  T: (typeof THICKNESS_CHANGES)[number]
  k: number
}
/**
 * Every pair whose factor is exact to 3 decimal places with at most three figures, is not 0.1 or
 * 10, and is not the thickness factor itself (4 ÷ 2 = 2); 1 is kept once per pair that cancels, as
 * written.
 */
const CLAIMS: Claim[] = AREA_CHANGES.flatMap((A) => THICKNESS_CHANGES.map((T) => ({ A, T, k: clean(A.f / T.f) }))).filter(
  ({ T, k }) => atMost(k, 3) && figures(k) <= 3 && (k === 1 || !powerOfTen(k)) && !near(k, T.f),
)
/**
 * The changes a surface can really undergo. "An exchange surface", as written, takes any; the
 * alveoli, gills and villi of a real animal at most triple in area, and their membrane stays
 * between half and three times as thick.
 */
const claimsFor = (s: Surface) => (s.organ ? CLAIMS.filter((c) => c.A.f <= 3 && c.T.f >= 0.5 && c.T.f <= 3) : CLAIMS)

const CLAIM_PROMPTS = [
  (s: Surface, x: Claim) =>
    `A student says that if ${s.area} ${x.A.does} and ${s.membrane} ${x.A.f === x.T.f ? 'also ' : ''}${x.T.does}, the rate of diffusion must ${x.A.claim}. Using Fick's law, calculate the factor by which the rate actually changes.`,
  (s: Surface, x: Claim) =>
    `${cap(s.area)} ${x.A.does} and ${s.membrane} ${x.A.f === x.T.f ? 'also ' : ''}${x.T.does}. A student says the rate of diffusion must ${x.A.claim}. Use Fick's law to calculate the factor by which the rate of diffusion really changes.`,
]

/** Area factor ÷ thickness factor, against a student's claim: written as q12 (both double, 1). */
export const fickClaim: Generator = {
  id: 'fick-factor-claim',
  subjectId: 'biology',
  topicId: EXCHANGE,
  replaces: ['q12'],
  build(r, slot, turn) {
    const s = SURFACES[turn % SURFACES.length]!
    const x = evenly(r, `fick-factor-claim:${s.organ}`, () => claimsFor(s), (y) => y.k)
    const end =
      x.k === 1
        ? 'The two cancel and the rate is **unchanged** — a useful check that you have the fraction the right way up.'
        : `Together the rate is multiplied by ${show(x.k)}, not by ${show(x.A.f)}: the student left out the thickness.`
    return numeric(
      slot,
      {
        prompt: pick(r, CLAIM_PROMPTS)(s, x),
        solution: `The student is wrong. $\\dfrac{${show(x.A.f)}}{${show(x.T.f)}} = ${show(x.k)}$. Surface area is on the **top**, so it multiplies the rate by ${show(x.A.f)}; thickness is on the **bottom**, so it divides it by ${show(x.T.f)}. ${end}`,
        method: ['divides the area factor by the thickness factor'],
        answer: x.k,
        units: unitsOf(slot),
        line: x.k === 1 ? '1, so the rate is unchanged' : show(x.k),
      },
      // Second route: a surface of 60, difference 5 and thickness 2 before and after the changes.
      { agrees: near(((60 * x.A.f * 5) / (2 * x.T.f)) / ((60 * 5) / 2), x.k), detail: `${show((60 * x.A.f * 5) / (2 * x.T.f))} ÷ 150` },
      { context: s.name, area: x.A.f, thickness: x.T.f, k: x.k },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q13: a disease reduces the area and thickens the membrane, to 2 decimal places
// ---------------------------------------------------------------------------------------------

interface Disease {
  name: string
  /** What does the damage: "In pulmonary fibrosis, scarring". */
  cause: string
  organ: string
  barrier: string
}
/** Each disease really reduces the exchange area and thickens the barrier. */
const DISEASES: Disease[] = [
  { name: 'pulmonary fibrosis', cause: 'In pulmonary fibrosis, scarring', organ: 'the alveoli', barrier: 'the membrane between the air and the blood' },
  { name: 'asbestosis', cause: 'In asbestosis, scarring caused by breathing in asbestos fibres', organ: 'the alveoli', barrier: 'the membrane between the air and the blood' },
  {
    name: 'amoebic gill disease',
    cause: 'In amoebic gill disease of farmed salmon, the gill filaments swell and stick together, which',
    organ: 'the gills',
    barrier: 'the membrane between the water and the blood',
  },
]
const AREA_LOSSES: { f: number; text: (organ: string) => string }[] = [
  { f: 0.5, text: (o) => `halves the surface area of ${o}` },
  { f: 0.25, text: (o) => `reduces the surface area of ${o} to a quarter of its healthy value` },
  { f: 0.75, text: (o) => `reduces the surface area of ${o} to three quarters of its healthy value` },
  ...[0.3, 0.4, 0.6, 0.7, 0.8].map((f) => ({ f, text: (o: string) => `reduces the surface area of ${o} to ${show(f * 100)}% of its healthy value` })),
]
const THICKENINGS: { f: number; text: string }[] = [
  { f: 1.5, text: 'one and a half times as thick' },
  { f: 2, text: 'twice as thick' },
  { f: 2.5, text: 'two and a half times as thick' },
  { f: 3, text: 'three times as thick' },
  { f: 4, text: 'four times as thick' },
  { f: 5, text: 'five times as thick' },
]
interface Scarring {
  A: (typeof AREA_LOSSES)[number]
  T: (typeof THICKENINGS)[number]
  exact: number
  k: number
}
/**
 * Every pair whose factor is at least 0.11, clear of a half at 2 decimal places, and none of the
 * figures with the point moved; and whose unrounded factor is within the tolerance, so a student
 * who types 0.5 ÷ 3 in full is marked right. Below about 0.26 the 1.9% cap is tighter than the
 * rounding, so 0.1666… against 0.17 is left out. Halving the area when the membrane is twice as thick gives a
 * quarter: the method itself, so it stays.
 */
const SCARRINGS: Scarring[] = AREA_LOSSES.flatMap((A) =>
  THICKENINGS.map((T) => ({ A, T, exact: A.f / T.f, k: roundTo(A.f / T.f, 2) })),
).filter(
  (x) => x.k >= 0.11 && clearOfHalf(x.exact, 2, 0.05) && !powerOfTen(x.k) && distinct(x.k, x.A.f, x.T.f) && Math.abs(x.exact - x.k) <= toPlaces(x.k, 2),
)


/** Area factor ÷ thickness factor to 2 decimal places: written as q13 (0.5 ÷ 3, 0.17). */
export const fickDisease: Generator = {
  id: 'fick-factor-disease',
  subjectId: 'biology',
  topicId: EXCHANGE,
  replaces: ['q13'],
  build(r, slot, turn) {
    const d = DISEASES[turn % DISEASES.length]!
    const x = evenly(r, 'fick-factor-disease', () => SCARRINGS, (y) => y.k)
    const k2 = fixed(x.k, 2)
    return numeric(
      slot,
      {
        prompt: `${d.cause} ${x.A.text(d.organ)} and makes ${d.barrier} ${x.T.text}. ${pick(r, ["Using Fick's law, by what factor does the rate of diffusion change?", "Use Fick's law to calculate the factor by which the rate of diffusion changes."])} Give your answer to two decimal places.`,
        solution:
          (atMost(x.exact, 2) ? `$\\dfrac{${show(x.A.f)}}{${show(x.T.f)}} = ${k2}$. ` : `$\\dfrac{${show(x.A.f)}}{${show(x.T.f)}} = ${factorTex(x.exact)}$, which is ${k2} to two decimal places. `) +
          `Both changes slow diffusion — less area on the top, more thickness on the bottom — so the rate falls to ${k2} of its healthy value.`,
        method: [`uses ${show(x.A.f)} for the surface area`, `divides by ${show(x.T.f)} for the thickness`],
        answer: x.k,
        tolerance: toPlaces(x.k, 2),
        units: unitsOf(slot),
        line: k2,
      },
      // Second route: a rate of 60 × 5 ÷ 2 before, and after the changes.
      { agrees: near(roundTo(((60 * x.A.f * 5) / (2 * x.T.f)) / 150, 2), x.k), detail: `${show((60 * x.A.f * 5) / (2 * x.T.f))} ÷ 150` },
      { context: d.name, area: x.A.f, thickness: x.T.f, k: x.k },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q20: a rate in arbitrary units
// ---------------------------------------------------------------------------------------------

const RATE_SURFACES = [
  { name: 'exchange surface', text: 'An exchange surface' },
  { name: 'alveoli', text: 'A model of the alveoli in a lung' },
  { name: 'gills', text: 'A model of a fish gill' },
  { name: 'villi', text: 'A model of the villi in the small intestine' },
]
const THICKNESSES = [0.2, 0.25, 0.4, 0.5, 2, 2.5, 4, 5]
interface Fick {
  area: number
  diff: number
  t: number
  rate: number
}
/**
 * Areas 20 to 120 in fives and differences 2 to 12, never 100 or 10, which would only move the
 * point; a whole-number rate of at most three figures
 * under 10 000, none of the givens, nor one doubled or halved, and no two givens the same.
 */
const FICKS: Fick[] = range(20, 120, 5).flatMap((area) =>
  range(2, 12).flatMap((diff) =>
    THICKNESSES.map((t) => ({ area, diff, t, rate: clean((area * diff) / t) })).filter(
      (x) =>
        Number.isInteger(x.rate) && figures(x.rate) <= 3 && x.rate < 10000 && !powerOfTen(x.area) && !powerOfTen(x.diff) && clearOf(x.rate, x.area, x.diff, x.t) && distinct(x.area, x.diff, x.t),
    ),
  ),
)

/** Surface area × concentration difference ÷ thickness: written as q20 (70 × 3 ÷ 0.5, 420). */
export const fickRate: Generator = {
  id: 'fick-rate',
  subjectId: 'biology',
  topicId: EXCHANGE,
  replaces: ['q20'],
  build(r, slot, turn) {
    const s = RATE_SURFACES[turn % RATE_SURFACES.length]!
    // A thickness first, so the thin membranes that give the most whole answers do not crowd out
    // the thick ones, then a rate evenly among those it gives.
    const t = pick(r, THICKNESSES)
    const x = evenly(r, `fick-rate:${t}`, () => FICKS.filter((y) => y.t === t), (y) => y.rate)
    const product = x.area * x.diff
    const effect =
      x.t < 1
        ? `Dividing by ${show(x.t)} ${x.t === 0.5 ? '**doubles** the value' : `multiplies the value by ${show(1 / x.t)}`}, so a thin membrane gives a high rate.`
        : `Dividing by ${show(x.t)} makes the value smaller, so a thicker membrane gives a lower rate.`
    return numeric(
      slot,
      {
        prompt: `${s.text} has a surface area of ${x.area}, a concentration difference of ${x.diff} and a membrane thickness of ${show(x.t)}, all in arbitrary units. Use Fick's law to calculate the rate of diffusion in arbitrary units.`,
        solution:
          `Rate $\\propto \\dfrac{\\text{surface area} \\times \\text{concentration difference}}{\\text{thickness}} = \\dfrac{${x.area} \\times ${x.diff}}{${show(x.t)}} = \\dfrac{${product}}{${show(x.t)}} = ${x.rate}$ arbitrary units. ` +
          `${effect} The answer has no real unit such as m/s, because Fick's law is a proportionality.`,
        method: [`substitutes ${x.area} × ${x.diff} ÷ ${show(x.t)}`],
        answer: x.rate,
        units: unitsOf(slot),
        line: String(x.rate),
      },
      // Second route: the rate times the thickness is the area times the difference.
      { agrees: near(x.rate * x.t, product), detail: `${x.rate} × ${show(x.t)} = ${show(x.rate * x.t)}` },
      { context: s.name, area: x.area, diff: x.diff, t: x.t, rate: x.rate },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q27: the percentage decrease in the rate when a disease strikes
// ---------------------------------------------------------------------------------------------

const PATIENTS = [
  { name: 'exchange surface', healthy: 'A healthy exchange surface has', disease: 'A disease' },
  { name: 'pulmonary fibrosis', healthy: 'The alveoli of a healthy lung have', disease: 'Pulmonary fibrosis' },
  { name: 'amoebic gill disease', healthy: 'The gills of a healthy salmon have', disease: 'Amoebic gill disease' },
]
interface Decline {
  A1: number
  A2: number
  c: number
  T1: number
  T2: number
  R1: number
  R2: number
  pct: number
}
const HEALTHY_T = [0.5, 1.5, 2, 2.5, 3, 4]
const DISEASED_T = [1.5, 2, 2.5, 3, 4, 5, 6]
/**
 * Healthy areas of 30 to 120 (never 100, which would move the point), the diseased membrane no
 * more than four times as thick, rates exact to 1 decimal place, and a decrease of 20 to 90%
 * exact to 1 decimal place with at most three figures; never a healthy rate of 100, where the
 * decrease is the percentage, and the percentage none of the figures, the rates or the decrease
 * with the point moved, doubled or halved.
 */
const DECLINES: Decline[] = (() => {
  const out: Decline[] = []
  for (const A1 of range(30, 120, 5).filter((a) => a !== 100))
    for (const c of range(2, 10))
      for (const T1 of HEALTHY_T)
        for (const T2 of DISEASED_T) {
          if (T2 <= T1 || T2 / T1 > 4) continue
          const R1 = clean((A1 * c) / T1)
          if (!atMost(R1, 1) || powerOfTen(R1)) continue
          for (const A2 of range(15, A1 - 5, 5)) {
            if (A2 < 0.3 * A1) continue
            const R2 = clean((A2 * c) / T2)
            if (!atMost(R2, 1)) continue
            const pct = clean(((R1 - R2) / R1) * 100)
            if (!atMost(pct, 1) || figures(pct) > 3 || pct < 20 || pct > 90) continue
            if (!distinct(A1, A2, c, T1, T2) || !clearOf(pct, A1, A2, c, T1, T2, R1, R2, clean(R1 - R2))) continue
            out.push({ A1, A2, c, T1, T2, R1, R2, pct })
          }
        }
  return out
})()

/** Both rates, then the fall as a percentage of the healthy one: written as q27 (150 to 75, 50%). */
export const fickPercentage: Generator = {
  id: 'fick-percentage-decrease',
  subjectId: 'biology',
  topicId: EXCHANGE,
  replaces: ['q27'],
  build(r, slot, turn) {
    const p = PATIENTS[turn % PATIENTS.length]!
    // The percentage first, evenly, among those four healthy areas, healthy thicknesses and
    // diseased thicknesses or more give; then the inputs. Drawing inputs first let 75, 80 and
    // 87.5% fill half the builds; the percentage alone let 75 and 1.5 fill nearly half.
    const x = layered(
      r,
      'fick-percentage-decrease',
      () => rich(DECLINES, (y) => y.pct, (y) => y.A1, 4, (y) => y.T1, (y) => y.T2),
      (y) => y.pct,
      (y) => y.T1,
      (y) => y.T2,
      (y) => y.A1,
    )
    const fall = clean(x.R1 - x.R2)
    return numeric(
      slot,
      {
        prompt:
          `${p.healthy} a surface area of ${x.A1}, a concentration difference of ${x.c} and a membrane thickness of ${show(x.T1)}, all in arbitrary units. ` +
          `${p.disease} reduces the surface area to ${x.A2} and makes the membrane ${show(x.T2)} units thick, while the concentration difference stays at ${x.c}. ` +
          `Use Fick's law, rate of diffusion ∝ (surface area × concentration difference) ÷ thickness of membrane, to calculate the percentage decrease in the rate of diffusion.`,
        solution:
          `Healthy: rate $\\propto \\dfrac{${x.A1} \\times ${x.c}}{${show(x.T1)}} = \\dfrac{${x.A1 * x.c}}{${show(x.T1)}} = ${x.R1}$ arbitrary units. ` +
          `Diseased: $\\dfrac{${x.A2} \\times ${x.c}}{${show(x.T2)}} = \\dfrac{${x.A2 * x.c}}{${show(x.T2)}} = ${x.R2}$ arbitrary units. ` +
          `The decrease is $${x.R1} - ${x.R2} = ${fall}$, and $\\dfrac{${fall}}{${x.R1}} \\times 100 = ${show(x.pct)}$ %. ` +
          'Both changes work the same way: less area on the top and more thickness on the bottom each slow diffusion.',
        method: [`rates of ${x.R1} and ${x.R2} arbitrary units`, 'decrease divided by the original rate, × 100'],
        answer: x.pct,
        tolerance: toPlaces(x.pct, 1),
        units: unitsOf(slot),
        line: `${show(x.pct)} %`,
      },
      // Second route: the diseased rate is the healthy one times the area factor over the thickness factor.
      { agrees: near((1 - (x.A2 / x.A1) / (x.T2 / x.T1)) * 100, x.pct), detail: `(1 − ${show(x.A2 / x.A1)} ÷ ${show(x.T2 / x.T1)}) × 100` },
      { context: p.name, A1: x.A1, A2: x.A2, c: x.c, T1: x.T1, T2: x.T2, pct: x.pct },
    )
  },
}

// =============================================================================================
// The leaf, root hair cells, xylem and phloem
// =============================================================================================

// ---------------------------------------------------------------------------------------------
// q13: the magnification of a drawing
// ---------------------------------------------------------------------------------------------

interface Drawn {
  name: string
  /** What the prompt calls the real thing: "cell", "guard cell". */
  short: string
  /** Real lengths it has, in mm. */
  real: number[]
  fact: string
}
const DRAWN: Drawn[] = [
  {
    // A root hair cell with its hair is 0.2 to 1 mm long.
    name: 'root hair cell',
    short: 'cell',
    real: range(0.2, 1, 0.01),
    fact: 'The long, thin hair gives the cell a large surface area for absorbing water and mineral ions.',
  },
  {
    // Guard cells are 20 to 50 µm long.
    name: 'guard cell',
    short: 'guard cell',
    real: range(0.02, 0.05, 0.001),
    fact: 'A pair of guard cells changes shape to open and close each stoma.',
  },
  {
    // Palisade cells are 40 to 100 µm tall.
    name: 'palisade mesophyll cell',
    short: 'cell',
    real: range(0.04, 0.1, 0.001),
    fact: 'Palisade cells are packed with chloroplasts, so most photosynthesis happens in them.',
  },
  {
    // Sieve tube elements are 0.1 to 0.5 mm long.
    name: 'phloem sieve tube element',
    short: 'sieve tube element',
    real: range(0.1, 0.5, 0.01),
    fact: 'Sieve tube elements join end to end through sieve plates to carry dissolved sugars.',
  },
]
interface Drawing {
  D: number
  R: number
  M: number
}
/**
 * Drawings 20 to 150 mm long at a whole-number magnification of ×20 to ×1500 with at most three
 * figures, never a power of ten, and none of the lengths with the point moved, doubled or halved
 * (40 mm of a 0.5 mm cell is ×80, the drawing doubled).
 */
const drawings = (c: Drawn): Drawing[] =>
  c.real.flatMap((R) =>
    range(20, 150)
      .map((D) => ({ D, R, M: clean(D / R) }))
      .filter((x) => Number.isInteger(x.M) && x.M >= 20 && x.M <= 1500 && figures(x.M) <= 3 && !powerOfTen(x.M) && shiftFree(x.M, x.D, x.R) && distinct(x.D, x.R)),
  )

/** Image ÷ actual: written as q13 (40 mm of a 0.5 mm root hair cell, 80). */
export const drawingMagnification: Generator = {
  id: 'leaf-drawing-magnification',
  subjectId: 'biology',
  topicId: LEAF,
  replaces: ['q13'],
  build(r, slot, turn) {
    const c = DRAWN[turn % DRAWN.length]!
    // A magnification first, among those three real lengths or more give, then a length.
    const x = layered(r, `leaf-drawing-magnification:${c.name}`, () => rich(drawings(c), (y) => y.M, (y) => y.R, 3), (y) => y.M, (y) => y.R)
    return numeric(
      slot,
      {
        prompt: `A drawing of a ${c.name} is ${x.D} mm long. The real ${c.short} is ${show(x.R)} mm long. Calculate the magnification of the drawing. Give your answer as a number only, without the × sign.`,
        solution: `Magnification = image size ÷ actual size = ${x.D} ÷ ${show(x.R)} = ${x.M}. In an exam you would write this as ×${x.M}; type just ${x.M} here. ${c.fact}`,
        method: [`${x.D} ÷ ${show(x.R)}`],
        answer: x.M,
        units: unitsOf(slot),
        line: String(x.M),
      },
      // Second route: the real length magnified gives the drawing back.
      { agrees: near(x.M * x.R, x.D), detail: `${x.M} × ${show(x.R)} = ${show(x.M * x.R)} mm` },
      { context: c.name, D: x.D, R: x.R, M: x.M },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q24: the real size from a photograph, in µm
// ---------------------------------------------------------------------------------------------

interface Tissue {
  name: string
  /** The photograph: "a section through a leaf". */
  photo: string
  /** "the palisade layer is", "a guard cell is" */
  subject: string
  /** "thick", "long" */
  measure: string
  /** "the real thickness of the palisade layer" */
  asked: string
  /** Its real size, in µm. */
  real: readonly [number, number]
  fact: string
}
const TISSUES: Tissue[] = [
  {
    name: 'palisade layer',
    photo: 'a section through a leaf',
    subject: 'the palisade layer is',
    measure: 'thick',
    asked: 'the real thickness of the palisade layer',
    real: [60, 150],
    fact: 'The palisade layer is a single layer of tall, closely packed cells near the top of the leaf, holding most of its chloroplasts.',
  },
  {
    name: 'spongy mesophyll',
    photo: 'a section through a leaf',
    subject: 'the spongy mesophyll layer is',
    measure: 'thick',
    asked: 'the real thickness of the spongy mesophyll layer',
    real: [80, 200],
    fact: 'The spongy mesophyll has air spaces between its cells, so carbon dioxide and water vapour can diffuse through the leaf.',
  },
  {
    name: 'upper epidermis',
    photo: 'a section through a leaf',
    subject: 'the upper epidermis is',
    measure: 'thick',
    asked: 'the real thickness of the upper epidermis',
    real: [10, 25],
    fact: 'The upper epidermis is a single layer of transparent cells, so light passes through it to the palisade layer.',
  },
  {
    name: 'whole leaf',
    photo: 'a section through a leaf',
    subject: 'the whole leaf is',
    measure: 'thick',
    asked: 'the real thickness of the leaf',
    real: [150, 400],
    fact: 'A leaf is thin, so carbon dioxide has only a short distance to diffuse to the cells inside it.',
  },
  {
    name: 'guard cell',
    photo: 'the lower epidermis of a leaf',
    subject: 'a guard cell is',
    measure: 'long',
    asked: 'the real length of the guard cell',
    real: [20, 50],
    fact: 'A pair of guard cells changes shape to open and close each stoma.',
  },
]
/**
 * Light micrograph magnifications. ×50, ×100, ×200, ×500 and ×1000 are left out: each makes the
 * answer the image size with the point moved, doubled or halved (16 mm at ×200 is 80 µm).
 */
const PHOTO_MAGNIFICATIONS = [40, 80, 150, 250, 300, 400, 600, 800]
interface Photo {
  real: number
  M: number
  image: number
  mm: number
}
/** A whole number of µm in the tissue's range, an image 5 to 150 mm exact to 1 decimal place, and an answer clear of the image. */
const PHOTOS = new Map<string, Photo[]>()
const photos = (t: Tissue): Photo[] => {
  const hit = PHOTOS.get(t.name)
  if (hit) return hit
  const out = range(t.real[0], t.real[1]).flatMap((real) =>
    PHOTO_MAGNIFICATIONS.map((M) => ({ real, M, image: clean((real * M) / 1000), mm: clean(real / 1000) })).filter(
      (x) => atMost(x.image, 1) && x.image >= 5 && x.image <= 150 && shiftFree(x.real, x.image, x.M) && distinct(x.real, x.image, x.M),
    ),
  )
  PHOTOS.set(t.name, out)
  return out
}

/** Image ÷ magnification, then × 1000: written as q24 (16 mm at ×200, 80 µm). */
export const leafRealSize: Generator = {
  id: 'leaf-real-size',
  subjectId: 'biology',
  topicId: LEAF,
  replaces: ['q24'],
  build(r, slot, turn) {
    const t = TISSUES[turn % TISSUES.length]!
    // A magnification first, evenly among those giving three sizes or more, then a size evenly.
    const usable = PHOTO_MAGNIFICATIONS.filter((M) => new Set(photos(t).filter((x) => x.M === M).map((x) => x.real)).size >= 3)
    const M = pick(r, usable)
    const x = evenly(r, `leaf-real-size:${t.name}:${M}`, () => photos(t).filter((y) => y.M === M), (y) => y.real)
    return numeric(
      slot,
      {
        prompt:
          `A photograph of ${t.photo} is magnified ×${x.M}. In the photograph ${t.subject} ${show(x.image)} mm ${t.measure}. Magnification = image size ÷ real size. ` +
          `Calculate ${t.asked} in micrometres (µm). There are 1000 µm in 1 mm.`,
        solution:
          `Real size $= \\dfrac{\\text{image size}}{\\text{magnification}} = \\dfrac{${show(x.image)}}{${x.M}} = ${show(x.mm)}$ mm. Converting, $${show(x.mm)} \\times 1000 = ${x.real}$ µm. ${t.fact}`,
        method: [`divides ${show(x.image)} mm by ${x.M} to get ${show(x.mm)} mm`, `multiplies ${show(x.mm)} mm by 1000 to give µm`],
        answer: x.real,
        units: unitsOf(slot),
        line: `${x.real} µm`,
      },
      // Second route: the real size in µm, magnified and turned back into mm, is the image.
      { agrees: near((x.real * x.M) / 1000, x.image), detail: `${x.real} × ${x.M} ÷ 1000 = ${show((x.real * x.M) / 1000)} mm` },
      { context: t.name, image: x.image, M: x.M, real: x.real },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q25: stomatal density from three fields of view
// ---------------------------------------------------------------------------------------------

interface LeafSurface {
  name: string
  /** Stomata per mm² it really carries. */
  density: readonly [number, number]
  fact: string
}
const LEAF_SURFACES: LeafSurface[] = [
  {
    name: 'lower',
    density: [100, 300],
    fact: 'Most stomata are on the lower surface, which is shaded and cooler, so less water is lost through them.',
  },
  {
    name: 'upper',
    density: [20, 100],
    fact: 'The upper surface has fewer stomata than the lower one, because it is in direct sunlight and would lose more water through them.',
  },
]
/**
 * Fields of view at ×400, 0.39 to 0.56 mm across. 0.1 mm² would only move the point and 0.2 mm²
 * makes the answer the mean halved with the point moved.
 */
const FIELDS = [0.12, 0.125, 0.15, 0.16, 0.18, 0.25]
interface Density {
  area: number
  D: number
  m: number
}
/** A whole mean count of at least 5 per field and a whole-number density in the surface's range, never a power of ten. */
const densities = (s: LeafSurface): Density[] =>
  FIELDS.flatMap((area) =>
    range(s.density[0], s.density[1])
      .map((D) => ({ area, D, m: clean(D * area) }))
      // Never 100 per mm² or another power of ten, where the mean is the field's area with the point moved.
      .filter((x) => Number.isInteger(x.m) && x.m >= 5 && !powerOfTen(x.D) && !tenfold(x.m, x.area)),
  )

/**
 * Every set of three counts about a mean: none equal to it (the middle count would be the mean),
 * no two the same, each within a fifth of the mean or 3 of it, and the density none of them, the
 * mean or the total with the point moved, doubled or halved.
 */
function countSets(m: number, D: number): number[][] {
  const most = Math.max(3, Math.round(m / 5))
  const out: number[][] = []
  for (let d1 = -most; d1 <= most; d1++)
    for (let d2 = d1 + 1; d2 <= most; d2++) {
      const d3 = -d1 - d2
      if (d3 <= d2 || d3 > most) continue
      const cs = [m + d1, m + d2, m + d3]
      if (cs.some((c) => c === m || c <= 0) || !shiftFree(D, ...cs, m, 3 * m)) continue
      out.push(cs)
    }
  return out
}

/** Mean count ÷ field area: written as q25 (32, 36 and 40 in 0.25 mm², 144 per mm²). */
export const stomatalDensity: Generator = {
  id: 'leaf-stomatal-density',
  subjectId: 'biology',
  topicId: LEAF,
  replaces: ['q25'],
  build(r, slot, turn) {
    const s = LEAF_SURFACES[turn % LEAF_SURFACES.length]!
    // A field first, among those giving two densities or more, then a density: 0.18 mm² on the
    // upper surface gives only 50 per mm², which then filled a sixth of the builds.
    const x = layered(r, `leaf-stomatal-density:${s.name}`, () => rich(densities(s).filter((y) => countSets(y.m, y.D).length > 0), (y) => y.area, (y) => y.D, 2), (y) => y.area, (y) => y.D)
    const cs = shuffle(r, pick(r, countSets(x.m, x.D)))
    const sum = cs[0]! + cs[1]! + cs[2]!
    const lots = clean(1 / x.area)
    const scale = atMost(lots, 3) ? ` (or $${x.m} \\times ${show(lots)} = ${x.D}$, since 1 mm² holds ${show(lots)} fields of view)` : ''
    return numeric(
      slot,
      {
        prompt:
          `A student looks at the ${s.name} surface of a leaf under a microscope. The field of view covers an area of ${show(x.area)} mm². ` +
          `The student counts the stomata in three different fields of view: ${cs[0]}, ${cs[1]} and ${cs[2]}. Calculate the mean number of stomata per mm² on the ${s.name} surface of this leaf.`,
        solution:
          `Mean count per field $= \\dfrac{${cs.join(' + ')}}{3} = \\dfrac{${sum}}{3} = ${x.m}$ stomata in ${show(x.area)} mm². ` +
          `Dividing by the area gives the number in 1 mm²: $\\dfrac{${x.m}}{${show(x.area)}} = ${x.D}$ stomata per mm²${scale}. ` +
          `Taking several fields of view and averaging matters because stomata are not evenly spread; a single field could be unusually dense or sparse. ${s.fact}`,
        method: [`finds the mean count: ${sum} ÷ 3 = ${x.m}`, `scales ${show(x.area)} mm² up to 1 mm²: divides by ${show(x.area)}`],
        answer: x.D,
        units: unitsOf(slot),
        line: `${x.D} stomata per mm²`,
      },
      // Second route: the density back over the field gives the mean count, and three of them the total.
      { agrees: near(x.D * x.area * 3, sum), detail: `${x.D} × ${show(x.area)} × 3 = ${show(x.D * x.area * 3)}` },
      { context: s.name, area: x.area, m: x.m, D: x.D, c1: cs[0]!, c2: cs[1]!, c3: cs[2]! },
    )
  },
}

// =============================================================================================
// Transpiration: the potometer and the mass a plant loses
// =============================================================================================

interface Condition {
  name: string
  /** Where the shoot stands: "in still air at room temperature". */
  text: string
  /** The rates its bubble moves, in mm per minute. */
  rate: readonly [number, number]
}
const CONDITIONS: Condition[] = [
  { name: 'still air', text: 'in still air at room temperature', rate: [1.5, 5] },
  { name: 'fan', text: 'with a fan blowing across its leaves', rate: [4, 12] },
  { name: 'humid', text: 'inside a clear plastic bag, which keeps the air around its leaves humid', rate: [0.5, 2.5] },
  { name: 'lamp', text: 'under a bright lamp', rate: [3, 9] },
]
/** Minutes a reading is timed over: never 1 or 10, which would only move the point. */
const MINUTES = range(2, 20).filter((t) => t !== 10)

interface Uptake {
  d: number
  t: number
  rate: number
}
/** Distances 5 to 95 mm whose rate fits the condition, exact to 2 decimal places with at most three figures, and none of the figures. */
const uptakes = (c: Condition): Uptake[] =>
  MINUTES.flatMap((t) =>
    range(5, 95)
      .map((d) => ({ d, t, rate: clean(d / t) }))
      .filter((x) => atMost(x.rate, 2) && figures(x.rate) <= 3 && between(x.rate, c.rate) && noOnes(x.rate) && clearOf(x.rate, x.d, x.t) && distinct(x.d, x.t, x.rate)),
  )
/**
 * A time first, evenly among those allowing three rates or more, then a rate evenly. Drawing the
 * rate first let 4 and 5 minutes, which most rates allow, fill two thirds of a context.
 */
function uptake(r: Rng, key: string, c: Condition, ok: (x: Uptake) => boolean = () => true): Uptake {
  return layered(
    r,
    `${key}:${c.name}`,
    () => {
      const all = uptakes(c).filter(ok)
      return all.filter((x) => new Set(all.filter((y) => y.t === x.t).map((y) => y.rate)).size >= 3)
    },
    (x) => x.t,
    (x) => x.rate,
  )
}
const rateTolerance = (rate: number) => threeFigures(toPlaces(rate, 2), rate)

// ---------------------------------------------------------------------------------------------
// q6: distance ÷ time
// ---------------------------------------------------------------------------------------------

const UPTAKE_PROMPTS = [
  (c: Condition, x: Uptake) =>
    `A leafy shoot is set up in a potometer ${c.text}. The air bubble moves ${x.d} mm in ${x.t} minutes. Calculate the rate of water uptake in mm per minute. Type the number only.`,
  (c: Condition, x: Uptake) =>
    `In a potometer holding a leafy shoot ${c.text}, the air bubble moves ${x.d} mm in ${x.t} minutes. Calculate the rate of water uptake in mm per minute. Type the number only.`,
]

/** Distance ÷ time: written as q6 (24 mm in 3 minutes, 8 mm per minute). */
export const potometerRate: Generator = {
  id: 'potometer-rate',
  subjectId: 'biology',
  topicId: TRANSPIRATION,
  replaces: ['q6'],
  build(r, slot, turn) {
    const c = CONDITIONS[turn % CONDITIONS.length]!
    const x = uptake(r, 'potometer-rate', c)
    return numeric(
      slot,
      {
        prompt: pick(r, UPTAKE_PROMPTS)(c, x),
        solution: `Rate = distance ÷ time = ${x.d} ÷ ${x.t} = ${show(x.rate)} mm per minute.`,
        method: [`${x.d} ÷ ${x.t}`],
        answer: x.rate,
        tolerance: rateTolerance(x.rate),
        units: unitsOf(slot),
        line: `${show(x.rate)} mm per minute`,
      },
      { agrees: near(x.rate * x.t, x.d), detail: `${show(x.rate)} × ${x.t} = ${show(x.rate * x.t)} mm` },
      { context: c.name, d: x.d, t: x.t, rate: x.rate },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q24: two scale readings
// ---------------------------------------------------------------------------------------------

/** (end − start) ÷ time: written as q24 (8 mm to 50 mm in six minutes, 7 mm per minute). */
export const potometerScale: Generator = {
  id: 'potometer-scale-readings',
  subjectId: 'biology',
  topicId: TRANSPIRATION,
  replaces: ['q24'],
  build(r, slot, turn) {
    const c = CONDITIONS[turn % CONDITIONS.length]!
    // A scale 100 mm long: the bubble starts at 2 to 40 mm and ends by 98 mm.
    const x = uptake(r, 'potometer-scale-readings', c, (y) => y.d <= 90)
    const s = draw(
      r,
      () => int(r, 2, Math.min(40, 98 - x.d)),
      (v) => distinct(v, v + x.d, x.t, x.d, x.rate) && clearOf(x.rate, v, v + x.d),
    )
    const e = s + x.d
    return numeric(
      slot,
      {
        prompt: `A leafy shoot is set up in a potometer ${c.text}. At the start the air bubble is level with the ${s} mm mark on the scale. ${cap(word(x.t))} minutes later it is level with the ${e} mm mark. Calculate the rate of water uptake in mm per minute.`,
        solution:
          `Distance moved $= ${e} - ${s} = ${x.d}$ mm. Rate $= \\dfrac{${x.d}}{${x.t}} = ${show(x.rate)}$ mm per minute. ` +
          'The bubble moves because water taken up by the shoot pulls the column of water along the capillary tube behind it, so the distance the bubble travels in a set time measures the rate of water **uptake**, which is close to, though not exactly the same as, the rate of transpiration.',
        method: [`finds the distance moved, ${e} − ${s} = ${x.d} mm, and divides by ${x.t} minutes`],
        answer: x.rate,
        tolerance: rateTolerance(x.rate),
        units: unitsOf(slot),
        line: `${show(x.rate)} mm per minute`,
      },
      { agrees: near(s + x.rate * x.t, e), detail: `${s} + ${show(x.rate)} × ${x.t} = ${show(s + x.rate * x.t)}` },
      { context: c.name, start: s, end: e, t: x.t, rate: x.rate },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q17: one row of a table
// ---------------------------------------------------------------------------------------------

interface Factor {
  name: string
  header: string
  /** Each set of four levels a class uses, in increasing order. */
  levels: (number | string)[][]
  /** Whether the rate rises along the levels. */
  rising: boolean
  /** The rates, in mm per minute, of the slowest and the fastest row: each its own condition's. */
  slow: readonly [number, number]
  fast: readonly [number, number]
  intro: string
  keep: string
  at: (v: number | string) => string
}
const FACTORS: Factor[] = [
  {
    // A cool room is slower than still air at room temperature; a warm one as fast as a lamp.
    name: 'temperature',
    header: 'Temperature (°C)',
    levels: [[15, 20, 25, 30], [10, 15, 20, 25], [20, 25, 30, 35]],
    rising: true,
    slow: [1, 3],
    fast: [3, 8],
    intro: 'at four temperatures',
    keep: 'keeping light and air movement the same',
    at: (v) => `at ${v} °C`,
  },
  {
    // The nearer the lamp, the brighter the light and the faster the uptake: dim light far away,
    // the bright-lamp condition close to.
    name: 'light',
    header: 'Distance of lamp from shoot (cm)',
    levels: [[10, 20, 30, 40], [15, 30, 45, 60], [20, 40, 60, 80]],
    rising: false,
    slow: [1, 3],
    fast: [3, 9],
    intro: 'with a lamp at four distances from the shoot',
    keep: 'keeping temperature and air movement the same',
    at: (v) => `with the lamp ${v} cm away`,
  },
  {
    // Fan off is still air; fan on high is the moving-air condition.
    name: 'air movement',
    header: 'Fan setting',
    levels: [['off', 'low', 'medium', 'high']],
    rising: true,
    slow: [1.5, 5],
    fast: [4, 12],
    intro: 'at four fan settings',
    keep: 'keeping light and temperature the same',
    at: (v) => (v === 'off' ? 'with the fan off' : `with the fan on ${v}`),
  },
  {
    // The more humid the air, the slower the uptake: the most humid row is the humid condition,
    // the driest still air.
    name: 'humidity',
    header: 'Relative humidity (%)',
    levels: [[30, 45, 60, 75], [40, 55, 70, 85], [20, 40, 60, 80]],
    rising: false,
    slow: [0.5, 2.5],
    fast: [1.5, 5],
    intro: 'at four humidities',
    keep: 'keeping light, temperature and air movement the same',
    at: (v) => `at ${v}% humidity`,
  },
]
const TABLE_MINUTES = [4, 5, 6, 8]

interface Ends {
  lo: number
  hi: number
}
/**
 * The slowest and fastest distances a factor gives over T minutes: each in its own condition's
 * range, at least 4 mm and more than the minutes (so no row is the time), at most 95 mm, the
 * fastest 1.5 to 3.5 times the slowest, and 6 mm apart or more so two rows fit between.
 */
const endsFor = (f: Factor, T: number): Ends[] =>
  range(Math.max(4, T + 1, Math.ceil(f.slow[0] * T)), Math.floor(f.slow[1] * T)).flatMap((lo) =>
    range(Math.ceil(f.fast[0] * T), Math.min(95, Math.floor(f.fast[1] * T)))
      .filter((hi) => hi / lo >= 1.5 && hi / lo <= 3.5 && hi - lo >= 6)
      .map((hi) => ({ lo, hi })),
  )
/** Whether the asked distance d can sit at position j (0 slowest, 3 fastest) between these ends. */
const fits = (e: Ends, d: number, j: number) => (j === 0 ? e.lo === d : j === 3 ? e.hi === d : j === 1 ? d - 2 >= e.lo && d + 4 <= e.hi : d - 4 >= e.lo && d + 2 <= e.hi)

interface Row {
  d: number
  rate: number
}
/**
 * Asked distances whose rate is exact to 2 decimal places with at most three figures, never 1 and
 * none of the figures, that some pair of ends allows at their position.
 */
const ROWS = new Map<string, Row[]>()
const rowsFor = (f: Factor, T: number, j: number): Row[] => {
  const key = `${f.name}:${T}:${j}`
  const hit = ROWS.get(key)
  if (hit) return hit
  const ends = endsFor(f, T)
  const out = range(4, 95)
    .map((d) => ({ d, rate: clean(d / T) }))
    .filter((x) => atMost(x.rate, 2) && figures(x.rate) <= 3 && noOnes(x.rate) && clearOf(x.rate, x.d, T) && distinct(x.d, T, x.rate))
    .filter((x) => ends.some((e) => fits(e, x.d, j)))
  ROWS.set(key, out)
  return out
}

/** Rate from one row of a table: written as q17 (31 mm in 5 minutes at 30 °C, 6.2 mm per minute). */
export const potometerTable: Generator = {
  id: 'potometer-table',
  subjectId: 'biology',
  topicId: TRANSPIRATION,
  replaces: ['q17'],
  build(r, slot, turn) {
    const f = FACTORS[turn % FACTORS.length]!
    const levels = pick(r, f.levels)
    const T = pick(r, TABLE_MINUTES)
    const i = int(r, 0, 3)
    // Position of the asked row among the distances in increasing order.
    const j = f.rising ? i : 3 - i
    const asked = evenly(r, `potometer-table:${f.name}:${T}:${j}`, () => rowsFor(f, T, j), (x) => x.rate)
    const ends = endsFor(f, T).filter((e) => fits(e, asked.d, j))
    // No row is the answer, with or without the point moved, nor the minutes.
    const ds = draw(
      r,
      () => {
        const { lo, hi } = pick(r, ends)
        if (j === 1) return [lo, asked.d, int(r, asked.d + 2, hi - 2), hi]
        if (j === 2) return [lo, int(r, lo + 2, asked.d - 2), asked.d, hi]
        const m1 = int(r, lo + 2, hi - 4)
        return [lo, m1, int(r, m1 + 2, hi - 2), hi]
      },
      (up) => up.every((d, k) => k === j || (!tenfold(d, asked.rate) && d !== T)),
    )
    const column = f.rising ? ds : [...ds].reverse()
    const table = [`| ${f.header} | Distance moved in ${T} minutes (mm) |`, '|---|---|', ...levels.map((v, k) => `| ${v} | ${column[k]} |`)].join('\n')
    return numeric(
      slot,
      {
        prompt:
          `A student uses a potometer ${f.intro}, ${f.keep}. The table shows how far the air bubble moved in ${T} minutes.\n\n${table}\n\n` +
          `Calculate the rate of water uptake ${f.at(levels[i]!)} in mm per minute. Type the number only.`,
        solution: `Rate = distance ÷ time = ${asked.d} ÷ ${T} = **${show(asked.rate)} mm per minute**.`,
        method: [`${asked.d} ÷ ${T}`],
        answer: asked.rate,
        tolerance: rateTolerance(asked.rate),
        units: unitsOf(slot),
        line: `${show(asked.rate)} mm per minute`,
      },
      { agrees: near(asked.rate * T, column[i]!), detail: `${show(asked.rate)} × ${T} = ${show(asked.rate * T)} mm, the table's ${column[i]} mm` },
      { context: f.name, T, row: i, d: asked.d, rate: asked.rate, d1: column[0]!, d2: column[1]!, d3: column[2]!, d4: column[3]! },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q25: the percentage increase between two conditions timed differently
// ---------------------------------------------------------------------------------------------

interface Comparison {
  name: string
  compare: string
  keep: string
  base: string
  changed: string
  baseLabel: string
  changedLabel: string
  cause: string
  /** The rates under the first condition, in mm per minute, and how many times faster the second is. */
  baseRate: readonly [number, number]
  factor: readonly [number, number]
  why: string
}
const COMPARISONS: Comparison[] = [
  {
    name: 'fan',
    compare: 'in still air and in moving air',
    keep: 'keeping the light intensity and temperature the same',
    base: 'In still air',
    changed: 'With a fan blowing across the leaves',
    baseLabel: 'Still air',
    changedLabel: 'Moving air',
    cause: 'the moving air',
    baseRate: [1.5, 5],
    factor: [1.5, 4],
    why: 'Moving air sweeps away the water vapour that collects around the stomata, so the concentration gradient from the inside of the leaf to the outside stays steep and water vapour diffuses out faster.',
  },
  {
    name: 'light',
    compare: 'in dim light and in bright light',
    keep: 'keeping the temperature and air movement the same',
    base: 'In dim light',
    changed: 'Under a bright lamp',
    baseLabel: 'Dim light',
    changedLabel: 'Bright light',
    cause: 'the bright light',
    baseRate: [1, 4],
    factor: [1.3, 3],
    why: 'In bright light the guard cells open the stomata wider, so more water vapour diffuses out of the leaf and more water is drawn up the xylem to replace it.',
  },
  {
    name: 'temperature',
    compare: 'at 15 °C and at 25 °C',
    keep: 'keeping the light intensity and air movement the same',
    base: 'At 15 °C',
    changed: 'At 25 °C',
    baseLabel: 'At 15 °C',
    changedLabel: 'At 25 °C',
    cause: 'the higher temperature',
    baseRate: [1.5, 5],
    factor: [1.3, 2.5],
    why: 'At a higher temperature water evaporates from the cells inside the leaf faster, and the water vapour molecules diffuse out faster because they have more kinetic energy.',
  },
  {
    name: 'humidity',
    compare: 'in humid air and in dry air',
    keep: 'keeping the light intensity and temperature the same',
    base: 'With a clear plastic bag over the shoot, keeping the air around it humid,',
    changed: 'With the bag removed,',
    baseLabel: 'Humid air',
    changedLabel: 'Dry air',
    cause: 'removing the bag',
    baseRate: [0.5, 2.5],
    factor: [1.5, 4],
    why: 'Without the bag the air around the leaves is drier, so the concentration gradient of water vapour from the inside of the leaf to the air is steeper and water vapour diffuses out faster.',
  },
]
/** The ratio of the two distances a student might quote, in words. */
const TIMES_WORDS: Record<string, string> = {
  1.5: 'one and a half times',
  2: 'twice',
  2.5: 'two and a half times',
  3: 'three times',
  3.5: 'three and a half times',
  4: 'four times',
}
const COMPARE_MINUTES = range(3, 15).filter((t) => t !== 10)

interface Pairing {
  d1: number
  t1: number
  d2: number
  t2: number
  r1: number
  r2: number
  n: number
  pct: number
}
/**
 * Distances up to 95 mm whose ratio the student can say in words, over two different times, so the
 * claim from the raw distances is wrong; rates exact to 2 decimal places, at most 12 mm per minute;
 * a percentage of 20 to 300 exact to 1 decimal place with at most three figures, never the claim's
 * percentage, and none of the figures.
 */
const pairings = (c: Comparison): Pairing[] => {
  const out: Pairing[] = []
  for (const t1 of COMPARE_MINUTES)
    for (const t2 of COMPARE_MINUTES) {
      if (t1 === t2) continue
      for (const d1 of range(5, 95)) {
        const r1 = clean(d1 / t1)
        if (!atMost(r1, 2) || !between(r1, c.baseRate)) continue
        for (const n of Object.keys(TIMES_WORDS).map(Number)) {
          const d2 = clean(n * d1)
          if (!Number.isInteger(d2) || d2 > 95) continue
          const r2 = clean(d2 / t2)
          if (!atMost(r2, 2) || r2 > 12 || !between(r2 / r1, c.factor) || near(r2 / r1, n)) continue
          const pct = clean(((r2 - r1) / r1) * 100)
          if (!atMost(pct, 1) || figures(pct) > 3 || pct < 20 || pct > 300) continue
          if (!distinct(d1, d2, t1, t2) || !clearOf(pct, d1, d2, t1, t2, r1, r2, clean(r2 - r1))) continue
          out.push({ d1, t1, d2, t2, r1, r2, n, pct })
        }
      }
    }
  return out
}

/** Both rates, then the rise as a percentage of the first: written as q25 (36 mm in 12 and 90 mm in 10 minutes, 200%). */
export const potometerComparison: Generator = {
  id: 'potometer-percentage-increase',
  subjectId: 'biology',
  topicId: TRANSPIRATION,
  replaces: ['q25'],
  build(r, slot, turn) {
    const c = COMPARISONS[turn % COMPARISONS.length]!
    // The percentage first, evenly, among those two second timings or more give, then the timings:
    // 5 minutes, which divides most distances, was otherwise the second timing in over a third.
    const x = layered(r, `potometer-percentage-increase:${c.name}`, () => rich(pairings(c), (y) => y.pct, (y) => y.t2, 2), (y) => y.pct, (y) => y.t2, (y) => y.t1)
    const said = TIMES_WORDS[String(x.n)]!
    const inc = clean(x.r2 - x.r1)
    const factor = clean(x.r2 / x.r1)
    const verdict =
      factor > x.n
        ? `The rate was multiplied by ${show(factor)}, not ${said}: comparing the raw distances understated the effect because the second reading was taken over a shorter time.`
        : `The rate was multiplied by only ${show(factor)}, not ${said}: comparing the raw distances overstated the effect because the second reading was taken over a longer time.`
    return numeric(
      slot,
      {
        prompt:
          `A student uses a potometer to compare water uptake by a leafy shoot ${c.compare}, ${c.keep}. ${c.base} the bubble moves ${x.d1} mm in ${x.t1} minutes. ` +
          `${c.changed} it moves ${x.d2} mm in ${x.t2} minutes. The student says ${c.cause} made the shoot take up water ${said} as fast, because ${x.d2} is ${said} ${x.d1}. ` +
          `Calculate the actual percentage increase in the rate of water uptake caused by ${c.cause}.`,
        solution:
          `The two readings were taken over **different times**, so they must be turned into rates first. ${c.baseLabel}: $\\dfrac{${x.d1}}{${x.t1}} = ${show(x.r1)}$ mm per minute. ` +
          `${c.changedLabel}: $\\dfrac{${x.d2}}{${x.t2}} = ${show(x.r2)}$ mm per minute. The increase is $${show(x.r2)} - ${show(x.r1)} = ${show(inc)}$ mm per minute, ` +
          `and as a percentage of the original rate that is $\\dfrac{${show(inc)}}{${show(x.r1)}} \\times 100 = ${show(x.pct)}\\%$. ${verdict} ${c.why}`,
        method: [
          `converts both readings to rates: ${show(x.r1)} and ${show(x.r2)} mm per minute`,
          `finds the increase and divides by the original rate (× 100): (${show(x.r2)} − ${show(x.r1)}) ÷ ${show(x.r1)} × 100`,
        ],
        answer: x.pct,
        tolerance: toPlaces(x.pct, 1),
        units: unitsOf(slot),
        line: `${show(x.pct)}%`,
      },
      // Second route: the distances' ratio corrected by the times' ratio.
      { agrees: near(((x.d2 * x.t1) / (x.d1 * x.t2) - 1) * 100, x.pct), detail: `(${x.d2} × ${x.t1}) ÷ (${x.d1} × ${x.t2}) = ${show((x.d2 * x.t1) / (x.d1 * x.t2))}` },
      { context: c.name, d1: x.d1, t1: x.t1, d2: x.d2, t2: x.t2, pct: x.pct },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q9: the volume taken up, π r² × distance
// ---------------------------------------------------------------------------------------------

/** Capillary radii 0.25 to 0.75 mm: bores of 0.5 to 1.5 mm. */
const RADII = [0.25, 0.3, 0.4, 0.5, 0.6, 0.75]
interface Volume {
  radius: number
  d: number
  t: number
  exact: number
  v: number
}
/**
 * Distances 10 to 95 mm over 3 to 20 minutes at a rate that fits the condition; the volume to
 * 1 decimal place is the same with π as with 3.14, clear of a half, and none of the figures.
 */
const VOLUMES = new Map<string, Volume[]>()
const volumes = (c: Condition): Volume[] => {
  const hit = VOLUMES.get(c.name)
  if (hit) return hit
  const out = RADII.flatMap((radius) =>
    MINUTES.filter((t) => t >= 3).flatMap((t) =>
      range(10, 95)
        .filter((d) => between(d / t, c.rate))
        .map((d) => ({ radius, d, t, exact: Math.PI * radius * radius * d, v: roundTo(Math.PI * radius * radius * d, 1) }))
        .filter((x) => clearOfHalf(x.exact, 1, 0.1) && roundTo(3.14 * x.radius * x.radius * x.d, 1) === x.v && clearOf(x.v, x.radius, x.d, x.t) && !tenfold(x.v, x.d)),
    ),
  )
  VOLUMES.set(c.name, out)
  return out
}

/** π r² × distance to 1 decimal place: written as q9 (radius 0.5 mm, 50 mm, 39.3 mm³). */
export const potometerVolume: Generator = {
  id: 'potometer-volume',
  subjectId: 'biology',
  topicId: TRANSPIRATION,
  replaces: ['q9'],
  build(r, slot, turn) {
    const c = CONDITIONS[turn % CONDITIONS.length]!
    const radius = pick(r, RADII)
    const x = pick(r, volumes(c).filter((y) => y.radius === radius))
    const r2 = clean(radius * radius)
    const r2d = clean(r2 * x.d)
    return numeric(
      slot,
      {
        prompt:
          `A potometer has a capillary tube of radius ${show(radius)} mm. A leafy shoot ${c.text}${c.text.includes(', which') ? ',' : ''} is set up in it, and the bubble moves ${x.d} mm in ${x.t} minutes. ` +
          'Calculate the volume of water taken up. Use volume = π × r² × distance. Give your answer in mm³ to 1 decimal place; type the number only.',
        solution: `Volume = π × ${show(radius)}² × ${x.d} = π × ${show(r2)} × ${x.d} = ${fixed(x.v, 1)} mm³ (about ${show(roundTo(x.exact / x.t, 2))} mm³ per minute).`,
        method: [`π × ${show(radius)}² × ${x.d}`, `${show(r2d)}π`],
        answer: x.v,
        tolerance: toPlaces(x.v, 1),
        units: unitsOf(slot),
        line: `${fixed(x.v, 1)} mm³`,
      },
      // Second route: the radius squared times the distance first, then π.
      { agrees: near(roundTo(r2d * Math.PI, 1), x.v), detail: `${show(r2d)} × π = ${show(roundTo(r2d * Math.PI, 3))}` },
      { context: c.name, radius, d: x.d, t: x.t, v: x.v },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q13: the percentage of its mass a plant loses
// ---------------------------------------------------------------------------------------------

interface Weighed {
  name: string
  text: (m0: string, m1: string) => string
  /** Its starting mass in g, the places the balance prints, and the percentage it loses. */
  mass: readonly [number, number]
  dp: number
  loss: readonly [number, number]
  /** How many starting masses a percentage must have to be drawn: see plantMassLoss. */
  masses: number
  fact: string
}
const WEIGHED: Weighed[] = [
  {
    // A small potted plant with its pot, 150 to 600 g, loses 2 to 12% in a day.
    name: 'potted plant',
    text: (m0, m1) =>
      `A potted plant, with its pot and soil sealed inside a plastic bag so that water is lost only from the leaves, has a mass of ${m0} g at the start of a day and ${m1} g at the end.`,
    mass: [150, 600],
    dp: 1,
    loss: [2, 12],
    masses: 10,
    fact: 'Nearly all of the mass lost is water that evaporated inside the leaves and diffused out through the stomata: the bag stops the soil losing any.',
  },
  {
    // A test tube, its water and a shoot, 40 to 90 g, lose 2 to 8% in a day.
    name: 'shoot in a tube',
    text: (m0, m1) =>
      `A leafy shoot stands in a test tube of water with a layer of oil on the surface to stop evaporation. The tube and shoot have a mass of ${m0} g at the start and ${m1} g 24 hours later.`,
    mass: [40, 90],
    dp: 1,
    loss: [2, 8],
    masses: 3,
    fact: 'The oil stops water evaporating from the tube, so the mass lost is water the shoot took up and lost from its leaves by transpiration.',
  },
  {
    // A picked leaf, 1 to 4 g, loses 5 to 30% in two days.
    name: 'picked leaf',
    text: (m0, m1) => `A freshly picked leaf, with the cut end of its stalk sealed with petroleum jelly, is hung up to dry. Its mass is ${m0} g, and two days later it is ${m1} g.`,
    mass: [1.01, 4],
    dp: 2,
    loss: [5, 30],
    masses: 3,
    fact: 'The petroleum jelly seals the cut stalk, so the mass lost is water that evaporated inside the leaf and diffused out through its stomata.',
  },
]
interface Loss {
  m0: number
  m1: number
  loss: number
  p: number
}
/**
 * Starting masses at the balance's places, losses exact at them, a percentage exact to 1 decimal
 * place, and the percentage none of the masses or the loss, doubled or halved, with or without the
 * point moved (a plant of 200.0 g makes the percentage half the loss).
 */
function losses(w: Weighed): Loss[] {
  const f = 10 ** w.dp
  const out: Loss[] = []
  for (let M = Math.round(w.mass[0] * f); M <= Math.round(w.mass[1] * f); M++) {
    for (let P = Math.round(w.loss[0] * 10); P <= Math.round(w.loss[1] * 10); P++) {
      if ((M * P) % 1000 !== 0) continue
      const L = (M * P) / 1000
      const m0 = clean(M / f)
      const loss = clean(L / f)
      const m1 = clean((M - L) / f)
      const p = clean(P / 10)
      if (!shiftFree(p, m0, m1, loss) || !distinct(m0, m1, loss)) continue
      out.push({ m0, m1, loss, p })
    }
  }
  return out
}

/** Loss ÷ starting mass × 100: written as q13 (20.0 g to 18.4 g, 8%). */
export const plantMassLoss: Generator = {
  id: 'plant-mass-loss',
  subjectId: 'biology',
  topicId: TRANSPIRATION,
  replaces: ['q13'],
  build(r, slot, turn) {
    const w = WEIGHED[turn % WEIGHED.length]!
    // A percentage first, among those enough masses give, then a mass: a potted plant's 6.3%, which
    // only whole hundreds of grams give, put 600.0 g in a fifth of the builds, so a potted plant
    // needs ten masses for its percentage.
    const x = layered(r, `plant-mass-loss:${w.name}`, () => rich(losses(w), (y) => y.p, (y) => y.m0, w.masses), (y) => y.p, (y) => y.m0)
    const m = (v: number) => fixed(v, w.dp)
    return numeric(
      slot,
      {
        prompt: `${w.text(m(x.m0), m(x.m1))} Calculate the percentage decrease in mass. Type the number only.`,
        solution: `Loss = ${m(x.m0)} − ${m(x.m1)} = ${m(x.loss)} g. Percentage = ${m(x.loss)} ÷ ${m(x.m0)} × 100 = ${show(x.p)}%. ${w.fact}`,
        method: [`${m(x.loss)} ÷ ${m(x.m0)} × 100`],
        answer: x.p,
        tolerance: toPlaces(x.p, 1),
        units: unitsOf(slot),
        line: `${show(x.p)}%`,
      },
      { agrees: near(x.m0 * (1 - x.p / 100), x.m1), detail: `${m(x.m0)} × ${show(1 - x.p / 100)} = ${show(x.m0 * (1 - x.p / 100))} g` },
      { context: w.name, m0: x.m0, m1: x.m1, p: x.p },
    )
  },
}

export const transportGenerators: Generator[] = [
  osmosisChange,
  osmosisComparison,
  osmosisMean,
  osmosisCrossing,
  cubeArea,
  cubeRatio,
  cuboidRatio,
  fickClaim,
  fickDisease,
  fickRate,
  fickPercentage,
  drawingMagnification,
  leafRealSize,
  stomatalDensity,
  potometerRate,
  potometerScale,
  potometerTable,
  potometerComparison,
  potometerVolume,
  plantMassLoss,
]

/** For the tests. */
export const TRANSPORT = {
  cuboids,
  densities,
  countSets,
  BATHS,
  REPEATS,
  SERIES,
  CUBES,
  RATIO_CUBES,
  BLOCKS,
  CLAIMS,
  SCARRINGS,
  THICKNESSES,
  DECLINES,
  DRAWN,
  TISSUES,
  PHOTO_MAGNIFICATIONS,
  LEAF_SURFACES,
  FIELDS,
  CONDITIONS,
  FACTORS,
  COMPARISONS,
  TIMES_WORDS,
  RADII,
  WEIGHED,
  PAIRS,
}
