import { clearOfHalf, fixed, roundTo, show } from '../format.ts'
import { atMost, cap, closes, figures, near, numeric, prose, tex } from '../physics/build.ts'
import { sfTolerance } from '../physics/format.ts'
import { clean, clearOf, distinct, noOnes, powerOfTen, range, shiftFree, tenfold, threeFigures, toPlaces } from '../chemistry/build.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import type { Generator } from '../types.ts'
import { balanced, between, cut, ending, fair, type Figure, figureTolerance, gcd, halfLastPlace, lcm, memo, piRoom, rich, toThree, unitsOf, whole } from './build.ts'

/**
 * Health and disease (AQA 8461, 4.2.2.6 and 4.2.2.7 non-communicable disease and its risk factors,
 * 4.3.1.1 to 4.3.1.6 pathogens and their spread, 4.3.1.6 and 4.3.1.7 defences and vaccination,
 * 4.3.1.8 antibiotics). Every numeric written slot in "Non-communicable disease and lifestyle",
 * "Pathogens and how disease spreads", "How the body fights infection", "The immune system and
 * immunisation" and "Antibiotics, new medicines and monoclonal antibodies" has a generator here.
 * None is left written.
 *
 * Every figure is one the thing really has. Adults are 1.50 to 1.80 m tall (women) or 1.60 to
 * 1.95 m (men), with a BMI of 18.6 to 35 (a rugby player 27 to 34, from muscle); waists measure 62
 * to 125 cm and hips 88 to 135 cm, and the lower-risk limit of the waist-to-hip ratio is 0.85 for
 * women and 0.90 for men. People with HIV are 10 to 30 times as likely to develop tuberculosis
 * (WHO: about 16 to 18 times), at 1 to 8% a year. Of symptomless young people screened, 3 to 10%
 * have chlamydia and 0.5 to 3% gonorrhoea. Malaria strikes 30 to 300 people per 1000 a year where
 * it is common, and bed nets cut it by 30 to 60%, indoor spraying by 25 to 55%, draining breeding
 * sites by 15 to 40%. Vaccines cut a country's cases by 85 to 99.5%. A booster's antibody peak is 3
 * to 30 times the first one's. Vaccines make 88 to 99.5% of children immune. Herd immunity
 * thresholds are 1 − 1/R₀ for the disease's real R₀: measles 12 to 18 (92 to 94%), rubella and
 * diphtheria 6 to 7 (84 to 85%), polio 5 to 7 (80 to 85%), mumps 4 to 7 (75 to 85%). Antibiotic
 * discs are 5 to 8 mm across and their clear zones 10 to 30 mm; an agar plate fills a 90 mm Petri
 * dish.
 */
const NCD = 'non-communicable-disease-and-lifestyle'
const PATHOGENS = 'pathogens-and-how-disease-spreads'
const FIGHTS = 'how-the-body-fights-infection'
const IMMUNE = 'the-immune-system-and-immunisation'
const ANTIBIOTICS = 'antibiotics-medicines-and-monoclonal-antibodies'

// =============================================================================================
// Non-communicable disease and lifestyle: BMI
// =============================================================================================

interface Person {
  name: string
  /** "A woman", starting a sentence. */
  noun: string
  /** "she", "he", "they". */
  sub: string
  /** "her", "his", "their". */
  pos: string
  /** Heights in cm, lowest and highest. */
  heights: readonly [number, number]
  /** BMI, lowest and highest. */
  bmi: readonly [number, number]
}
const WOMAN: Person = { name: 'woman', noun: 'A woman', sub: 'she', pos: 'her', heights: [150, 180], bmi: [18.6, 35] }
const MAN: Person = { name: 'man', noun: 'A man', sub: 'he', pos: 'his', heights: [160, 195], bmi: [18.6, 35] }
/** Heavy from muscle, so a BMI in the overweight or obese range that BMI cannot explain. */
const RUGBY: Person = { name: 'rugby player', noun: 'A rugby player', sub: 'they', pos: 'their', heights: [175, 195], bmi: [27, 34] }
const BMI_PEOPLE = [WOMAN, MAN, RUGBY]

/** Height in m as the prompt prints it: 1.60. */
const metres = (k: number) => fixed(k / 100, 2)
/** Height² in m², exact: 2.56, 3.0625. */
const squared = (k: number) => clean((k * k) / 10000)

/** NHS categories, from the exact BMI. */
const category = (b: number) => (b < 18.5 ? 'underweight' : b < 25 ? 'healthy' : b < 30 ? 'overweight' : 'obese')

interface Bmi {
  k: number
  m: number
  f: Figure
}
/** Every height and whole mass whose BMI is in the person's range, rounds fairly, and falls in the category its rounding shows. */
const bmis = (p: Person): Bmi[] =>
  range(...p.heights).flatMap((k) => {
    const h2 = squared(k)
    return range(Math.ceil(p.bmi[0] * h2), Math.floor(p.bmi[1] * h2))
      .map((m) => ({ k, m, f: toThree(m / h2) }))
      .filter((x) => between(x.f.exact, p.bmi) && fair(x.f) && category(x.f.exact) === category(x.f.answer) && clearOf(x.f.answer, x.m, x.k / 100, h2) && noOnes(x.f.answer))
  })

const BMI_PROMPTS = [
  (p: Person, x: Bmi) => `${p.noun} has a mass of ${x.m} kg and a height of ${metres(x.k)} m. Calculate ${p.pos} BMI using BMI = mass ÷ height².`,
  (p: Person, x: Bmi) => `${p.noun} is ${metres(x.k)} m tall and has a mass of ${x.m} kg. Using BMI = mass ÷ height², calculate ${p.pos} body mass index (BMI).`,
]

const RANGES = 'Under 18.5 is underweight, 18.5 to 24.9 healthy, 25 to 29.9 overweight and 30 or more obese.'

/** Mass ÷ height²: written as q2 (64 kg, 1.60 m, 25). */
export const bmiFromMass: Generator = {
  id: 'lifestyle-bmi-from-mass-and-height',
  subjectId: 'biology',
  topicId: NCD,
  replaces: ['q2'],
  build(r, slot, turn) {
    const p = BMI_PEOPLE[turn % BMI_PEOPLE.length]!
    // Height, mass and answer each spread: the heights whose square divides most masses cleanly would fill the context.
    const x = balanced(r, `health:bmi-from-mass-and-height:${p.name}`, () => bmis(p), (y) => y.k, (y) => y.m, (y) => y.f.answer)
    const h2 = squared(x.k)
    const cat = category(x.f.answer)
    const muscle = ` That is in the ${cat} range${p === RUGBY ? ', but a rugby player carries a lot of muscle, and BMI cannot tell muscle from fat' : ''}.`
    return numeric(
      slot,
      {
        prompt: pick(r, BMI_PROMPTS)(p, x),
        solution: `Height² $= ${metres(x.k)}^2 = ${show(h2)}$. BMI $= ${x.m} \\div ${show(h2)} ${ending(x.f)}.${muscle} ${RANGES}`,
        method: [`squares the height and divides: ${x.m} ÷ ${metres(x.k)}²`],
        answer: x.f.answer,
        tolerance: figureTolerance(x.f),
        units: unitsOf(slot),
        line: show(x.f.answer),
      },
      // Second route: the BMI times the height squared gives the mass back, to the rounding.
      { agrees: Math.abs(x.f.answer * h2 - x.m) <= figureTolerance(x.f) * h2 + 1e-9, detail: `${show(x.f.answer)} × ${show(h2)} = ${show(x.f.answer * h2)}` },
      { context: p.name, k: x.k, m: x.m, bmi: x.f.answer },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q10: mass = BMI × height²
// ---------------------------------------------------------------------------------------------

interface Mass {
  k: number
  b: number
  f: Figure
}
const MASS_PEOPLE: Person[] = [
  { ...WOMAN, bmi: [19, 30] },
  { ...MAN, bmi: [19, 32] },
]
const masses = (p: Person): Mass[] =>
  range(...p.heights).flatMap((k) =>
    range(p.bmi[0], p.bmi[1])
      .map((b) => ({ k, b, f: toThree(b * squared(k)) }))
      .filter((x) => fair(x.f) && clearOf(x.f.answer, x.b, x.k / 100, squared(x.k), clean(x.b * x.k / 100))),
  )

const MASS_PROMPTS = [
  (p: Person, x: Mass) => `${p.noun} is ${metres(x.k)} m tall and has a BMI of ${x.b}. Calculate ${p.pos} mass in kg.`,
  (p: Person, x: Mass) => `${p.noun} has a height of ${metres(x.k)} m and a BMI of ${x.b}. Using BMI = mass ÷ height², calculate ${p.pos} mass in kg.`,
]

/** BMI × height²: written as q10 (1.75 m, BMI 24, 73.5 kg). */
export const massFromBmi: Generator = {
  id: 'mass-from-bmi-and-height',
  subjectId: 'biology',
  topicId: NCD,
  replaces: ['q10'],
  build(r, slot, turn) {
    const p = MASS_PEOPLE[turn % MASS_PEOPLE.length]!
    const x = balanced(r, `health:mass-from-bmi-and-height:${p.name}`, () => masses(p), (y) => y.k, (y) => y.b, (y) => y.f.answer)
    const h2 = squared(x.k)
    return numeric(
      slot,
      {
        prompt: pick(r, MASS_PROMPTS)(p, x),
        solution:
          `Rearrange BMI = mass ÷ height²: mass = BMI × height² $= ${x.b} \\times ${metres(x.k)}^2 = ${x.b} \\times ${show(h2)} ${ending(x.f, ' kg')}. ` +
          `Dividing by the height instead of multiplying by its square is the usual slip.`,
        method: [`rearranges to mass = BMI × height² and substitutes: ${x.b} × ${metres(x.k)}²`],
        answer: x.f.answer,
        tolerance: figureTolerance(x.f),
        units: unitsOf(slot),
      },
      // Second route: the mass over the height squared gives the BMI back, to the rounding.
      { agrees: Math.abs(x.f.answer / h2 - x.b) <= figureTolerance(x.f) / h2 + 1e-9, detail: `${show(x.f.answer)} ÷ ${show(h2)} = ${show(x.f.answer / h2)}` },
      { context: p.name, k: x.k, b: x.b, mass: x.f.answer },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q14: the mass to lose to reach a BMI of 25
// ---------------------------------------------------------------------------------------------

interface Loss {
  k: number
  m: number
  target: number
  answer: number
  now: number
}
const LOSS_PEOPLE: Person[] = [
  { ...WOMAN, bmi: [26, 35] },
  { ...MAN, bmi: [26, 35] },
]
/**
 * Even heights only, so 25 × height² ends within two places (25 × 1.72² = 73.96), as the written
 * 81 kg does; a loss of 2 to 30 kg, never a given, nor one with the point moved, doubled or halved.
 */
const losses = (p: Person): Loss[] =>
  range(...p.heights)
    .filter((k) => k % 2 === 0)
    .flatMap((k) => {
      const h2 = squared(k)
      const target = clean(25 * h2)
      return range(Math.ceil(p.bmi[0] * h2), Math.floor(p.bmi[1] * h2)).map((m) => ({ k, m, target, answer: clean(m - target), now: m / h2 }))
    })
    .filter((x) => between(x.answer, [2, 30]) && between(x.now, [26, 35]) && clearOf(x.answer, x.m, x.target, x.k / 100, squared(x.k), 25) && noOnes(x.answer))

const LOSS_PROMPTS = [
  (p: Person, x: Loss) => `${p.noun} has a mass of ${x.m} kg and a height of ${metres(x.k)} m. How much mass would ${p.sub} need to lose to reach a BMI of 25?`,
  (p: Person, x: Loss) =>
    `${p.noun} is ${metres(x.k)} m tall and has a mass of ${x.m} kg. A BMI of 25 is the top of the healthy range. Using BMI = mass ÷ height², calculate the mass in kg ${p.sub} would need to lose to bring ${p.pos} BMI down to 25.`,
]

/** 25 × height², taken from the mass: written as q14 (90 kg, 1.80 m, 9 kg). */
export const massToLose: Generator = {
  id: 'mass-to-lose-for-a-bmi-of-25',
  subjectId: 'biology',
  topicId: NCD,
  replaces: ['q14'],
  build(r, slot, turn) {
    const p = LOSS_PEOPLE[turn % LOSS_PEOPLE.length]!
    const x = balanced(r, `health:mass-to-lose-for-a-bmi-of-25:${p.name}`, () => losses(p), (y) => y.k, (y) => y.m, (y) => y.answer)
    const h2 = squared(x.k)
    const now = `$${x.m} \\div ${show(h2)} ${atMost(x.now, 1) ? '=' : '\\approx'} ${atMost(x.now, 1) ? show(x.now) : fixed(x.now, 1)}$`
    return numeric(
      slot,
      {
        prompt: pick(r, LOSS_PROMPTS)(p, x),
        solution:
          `Mass at a BMI of 25 $= 25 \\times ${metres(x.k)}^2 = 25 \\times ${show(h2)} = ${show(x.target)}$ kg. ${cap(p.sub)} would need to lose $${x.m} - ${show(x.target)} = ${show(x.answer)}$ kg. ` +
          `(${cap(p.pos)} BMI now is ${now}, in the ${category(x.now)} range.)`,
        method: [`squares the height: ${metres(x.k)}² = ${show(h2)}`, `finds the mass at a BMI of 25: 25 × ${show(h2)} = ${show(x.target)} kg`],
        answer: x.answer,
        tolerance: halfLastPlace(x.answer),
        units: unitsOf(slot),
      },
      // Second route: the mass left after the loss, over the height squared, is a BMI of 25.
      { agrees: near((x.m - x.answer) / h2, 25), detail: `(${x.m} − ${show(x.answer)}) ÷ ${show(h2)} = ${show((x.m - x.answer) / h2)}` },
      { context: p.name, k: x.k, m: x.m, loss: x.answer },
    )
  },
}

// =============================================================================================
// Non-communicable disease and lifestyle: waist-to-hip ratio
// =============================================================================================

interface Body {
  name: string
  noun: string
  owner: string
  pos: string
  /** Doctors' upper limit of the lower-risk range. */
  limit: number
  /** "for women". */
  group: string
  waists: readonly [number, number]
  hips: readonly [number, number]
  ratios: readonly [number, number]
}
const WOMEN_BODY: Body = { name: 'woman', noun: 'A woman', owner: "A woman's", pos: 'her', limit: 0.85, group: 'women', waists: [62, 110], hips: [88, 130], ratios: [0.68, 0.98] }
const MEN_BODY: Body = { name: 'man', noun: 'A man', owner: "A man's", pos: 'his', limit: 0.9, group: 'men', waists: [72, 125], hips: [88, 135], ratios: [0.8, 1.1] }
const BODIES = [WOMEN_BODY, MEN_BODY]

interface Ratio {
  w: number
  h: number
  f: Figure
}
/**
 * The written slot marks to 2 decimal places (0.005), so the ratio is clear of a half-way case at 2
 * places as well as fair at 3 figures, and clear of the doctor's limit, so "above" or "below" is
 * plain.
 */
const ratios = (b: Body): Ratio[] =>
  range(...b.waists).flatMap((w) =>
    range(...b.hips)
      .filter((h) => !powerOfTen(h))
      .map((h) => ({ w, h, f: toThree(w / h) }))
      .filter((x) => between(x.f.exact, b.ratios) && fair(x.f) && clearOfHalf(x.f.exact, 2) && Math.abs(x.f.exact - b.limit) >= 0.01 && shiftFree(x.f.answer, x.w, x.h) && x.w !== x.h),
  )

const RATIO_PROMPTS = [
  (b: Body, x: Ratio) => `${b.owner} waist measures ${x.w} cm and ${b.pos} hips ${x.h} cm. Calculate ${b.pos} waist-to-hip ratio.`,
  (b: Body, x: Ratio) => `${b.noun} has a waist measurement of ${x.w} cm and a hip measurement of ${x.h} cm. Calculate ${b.pos} waist-to-hip ratio, using waist-to-hip ratio = waist ÷ hips.`,
]

/** Waist ÷ hips: written as q5 (84 cm and 105 cm, 0.8). */
export const waistToHip: Generator = {
  id: 'lifestyle-waist-to-hip-ratio',
  subjectId: 'biology',
  topicId: NCD,
  replaces: ['q5'],
  build(r, slot, turn) {
    const b = BODIES[turn % BODIES.length]!
    const x = balanced(r, `health:waist-to-hip-ratio:${b.name}`, () => ratios(b), (y) => y.w, (y) => y.h, (y) => y.f.answer)
    const above = x.f.exact > b.limit
    return numeric(
      slot,
      {
        prompt: pick(r, RATIO_PROMPTS)(b, x),
        solution:
          `Ratio = waist ÷ hips $= ${x.w} \\div ${x.h} ${ending(x.f)}. Both are in cm, so the units cancel and the ratio has none. ` +
          `Doctors use ${fixed(b.limit, 2)} as the upper limit of the lower-risk range for ${b.group}, so this ratio is ${above ? 'above' : 'below'} it: ` +
          (above ? 'fat stored around the abdomen is linked to a higher risk of cardiovascular disease and type 2 diabetes.' : 'less of the fat is stored around the abdomen, where it carries the higher risk of cardiovascular disease and type 2 diabetes.'),
        method: [`divides the waist by the hips: ${x.w} ÷ ${x.h}`],
        answer: x.f.answer,
        // The written slot's 0.005: a ratio given to 2 decimal places is right.
        tolerance: threeFigures(toPlaces(x.f.answer, 2), x.f.answer),
        units: unitsOf(slot),
        line: show(x.f.answer),
      },
      // Second route: the ratio times the hips gives the waist back, to the rounding.
      { agrees: Math.abs(x.f.answer * x.h - x.w) <= 0.005 * x.h + 1e-9, detail: `${show(x.f.answer)} × ${x.h} = ${show(x.f.answer * x.h)}` },
      { context: b.name, w: x.w, h: x.h, ratio: x.f.answer },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q27: how far the waist must shrink to bring the ratio to the limit
// ---------------------------------------------------------------------------------------------

interface Shrink {
  w: number
  h: number
  now: number
  target: number
  answer: number
}
/** Ratios now from just over the limit to 1.10 (men) or 1.00 (women); a decrease of 1 to 20 cm. */
const SHRINK: Record<string, { waists: readonly [number, number]; hips: readonly [number, number]; now: readonly [number, number] }> = {
  woman: { waists: [76, 115], hips: [88, 130], now: [0.87, 1] },
  man: { waists: [84, 125], hips: [90, 130], now: [0.92, 1.1] },
}
/**
 * Women's hips even, so 0.85 × hips ends at one place (0.85 × 96 = 81.6) as the men's 0.90 × hips
 * does; the decrease to 1 place at most, never a given nor one with the point moved, doubled or halved.
 */
const shrinks = (b: Body): Shrink[] => {
  const s = SHRINK[b.name]!
  return range(...s.waists).flatMap((w) =>
    range(...s.hips)
      .filter((h) => (b.limit === 0.9 || h % 2 === 0) && !powerOfTen(h))
      .map((h) => {
        const target = clean(b.limit * h)
        return { w, h, now: w / h, target, answer: clean(w - target) }
      })
      .filter((x) => between(x.now, s.now) && between(x.answer, [1, 20]) && atMost(x.answer, 1) && clearOf(x.answer, x.w, x.h, x.target) && shiftFree(x.answer, b.limit) && distinct(x.w, x.h) && !powerOfTen(x.answer)),
  )
}

const SHRINK_PROMPTS = [
  (b: Body, x: Shrink) =>
    `${b.owner} waist measures ${x.w} cm and ${b.pos} hips ${x.h} cm. Waist-to-hip ratio = waist ÷ hips. ${cap(b.pos)} doctor uses a ratio of ${fixed(b.limit, 2)} as the upper limit of the lower-risk range for ${b.group}. ` +
    `Calculate by how many centimetres the ${b.name}'s waist would need to decrease, with ${b.pos} hip measurement unchanged, for ${b.pos} ratio to fall to ${fixed(b.limit, 2)}.`,
  (b: Body, x: Shrink) =>
    `${b.noun} has a waist of ${x.w} cm and hips of ${x.h} cm. For ${b.group}, a waist-to-hip ratio (waist ÷ hips) above ${fixed(b.limit, 2)} is linked to a higher risk of cardiovascular disease and type 2 diabetes. ` +
    `If ${b.pos} hips stay the same, by how many centimetres would ${b.pos} waist need to decrease for ${b.pos} ratio to fall to ${fixed(b.limit, 2)}?`,
]

/** Limit × hips, taken from the waist: written as q27 (90 cm and 95 cm, 0.90, 4.5 cm). */
export const waistDecrease: Generator = {
  id: 'waist-decrease-for-a-ratio',
  subjectId: 'biology',
  topicId: NCD,
  replaces: ['q27'],
  build(r, slot, turn) {
    const b = BODIES[turn % BODIES.length]!
    const x = balanced(r, `health:waist-decrease-for-a-ratio:${b.name}`, memo(`health:shrink:${b.name}`, () => shrinks(b)), (y) => y.w, (y) => y.h, (y) => y.answer)
    const L = fixed(b.limit, 2)
    const now = atMost(x.now, 3) ? `= ${show(x.now)}` : `\\approx ${fixed(x.now, 3)}`
    return numeric(
      slot,
      {
        prompt: pick(r, SHRINK_PROMPTS)(b, x),
        solution:
          `${cap(b.pos)} ratio now is $\\dfrac{${x.w}}{${x.h}} ${now}$, above the limit of ${L}. For a ratio of ${L} with hips of ${x.h} cm, the waist must be $${L} \\times ${x.h} = ${show(x.target)}$ cm. ` +
          `Decrease needed $= ${x.w} - ${show(x.target)} = ${show(x.answer)}$ cm. The waist-to-hip ratio shows **where** fat is stored: fat around the abdomen is linked to a higher risk of cardiovascular disease and type 2 diabetes, ` +
          'which is why it is measured alongside BMI, which cannot tell muscle from fat.',
        method: [`rearranges: waist = ${L} × ${x.h} = ${show(x.target)} cm`, `subtracts from the present waist: ${x.w} − ${show(x.target)}`],
        answer: x.answer,
        tolerance: halfLastPlace(x.answer),
        units: unitsOf(slot),
      },
      // Second route: the smaller waist over the same hips is the limit.
      { agrees: near((x.w - x.answer) / x.h, b.limit), detail: `(${x.w} − ${show(x.answer)}) ÷ ${x.h} = ${show((x.w - x.answer) / x.h)}` },
      { context: b.name, w: x.w, h: x.h, decrease: x.answer },
    )
  },
}

// =============================================================================================
// Non-communicable disease and lifestyle: a rise in deaths
// =============================================================================================

interface Death {
  name: string
  /** "6 400 people died from alcohol-related liver disease". */
  died: (n: string) => string
  /** "The number of deaths from alcohol-related liver disease". */
  title: string
  /** Deaths in the first year, lowest and highest (steps of 100). */
  old: readonly [number, number]
  /** Rise, %, lowest and highest. */
  rise: readonly [number, number]
  why: string
}
const DEATHS: Death[] = [
  {
    name: 'alcohol', died: (n) => `${n} people died from alcohol-related liver disease`, title: 'deaths from alcohol-related liver disease', old: [3000, 12000], rise: [5, 60],
    why: 'Alcohol is a toxin that the liver breaks down; years of heavy drinking kill liver cells, which are replaced by scar tissue (cirrhosis), and raise the risk of liver cancer.',
  },
  {
    name: 'diabetes', died: (n) => `${n} people died from type 2 diabetes`, title: 'deaths from type 2 diabetes', old: [4000, 25000], rise: [5, 50],
    why: 'Obesity is the main risk factor for type 2 diabetes, in which the body cells no longer respond to insulin, so a rise in obesity is followed years later by a rise in deaths.',
  },
  {
    name: 'lung cancer', died: (n) => `${n} women died from lung cancer`, title: 'deaths from lung cancer among women', old: [8000, 20000], rise: [5, 30],
    why: 'Smoking is the main risk factor: tobacco smoke contains carcinogens. Lung cancer takes decades to develop, so a rise in deaths now follows a rise in smoking among women many years earlier.',
  },
]
const DECADES = [[2010, 2020], [2008, 2018], [2012, 2022]] as const

interface Rise {
  old: number
  now: number
  change: number
  pct: number
}
const rises = (d: Death): Rise[] =>
  range(d.old[0], d.old[1], 100).flatMap((old) =>
    range(d.rise[0], d.rise[1], 0.5)
      .map((pct) => ({ old, pct, now: clean((old * (100 + pct)) / 100) }))
      .filter((x) => whole(x.now))
      .map((x) => ({ ...x, change: clean(x.now - x.old) }))
      .filter((x) => !powerOfTen(x.old) && distinct(x.old, x.now, x.change) && shiftFree(x.pct, x.old, x.now, x.change)),
  )

const RISE_PROMPTS = [
  (d: Death, x: Rise, [y0, y1]: readonly [number, number]) =>
    `In one country, ${d.died(prose(x.old))} in ${y0}. In ${y1} the figure was ${prose(x.now)}. Calculate the percentage increase in the number of deaths.`,
  (d: Death, x: Rise, [y0, y1]: readonly [number, number]) =>
    `In one country, the number of ${d.title} rose from ${prose(x.old)} in ${y0} to ${prose(x.now)} in ${y1}. Calculate the percentage increase.`,
]

/** (new − old) ÷ old × 100: written as q26 (6 400 to 8 000 deaths, 25%). */
export const deathsIncrease: Generator = {
  id: 'non-communicable-deaths-increase',
  subjectId: 'biology',
  topicId: NCD,
  replaces: ['q26'],
  build(r, slot, turn) {
    const d = DEATHS[turn % DEATHS.length]!
    const x = balanced(r, `health:non-communicable-deaths-increase:${d.name}`, () => rises(d), (y) => y.old, (y) => y.pct)
    return numeric(
      slot,
      {
        prompt: pick(r, RISE_PROMPTS)(d, x, pick(r, DECADES)),
        solution:
          `Increase $= ${tex(x.now)} - ${tex(x.old)} = ${tex(x.change)}$. Percentage increase $= \\dfrac{${tex(x.change)}}{${tex(x.old)}} \\times 100 = ${show(x.pct)}\\%$. ` +
          `A rise in deaths across a whole country is an effect at the **national** scale: more treatment for the health service to pay for, and more people lost to the workforce. ${d.why}`,
        method: [`finds the increase, ${prose(x.change)}, and divides it by the original ${prose(x.old)} (× 100)`],
        answer: x.pct,
        tolerance: halfLastPlace(x.pct),
        units: unitsOf(slot),
      },
      // Second route: the original grown by that percentage is the new figure.
      { agrees: near((x.old * (100 + x.pct)) / 100, x.now), detail: `${x.old} × ${show(1 + x.pct / 100)} = ${x.now}` },
      { context: d.name, old: x.old, now: x.now, pct: x.pct },
    )
  },
}

// =============================================================================================
// Pathogens and how disease spreads
// =============================================================================================

// ---------------------------------------------------------------------------------------------
// q21: how many times more likely, from two rates
// ---------------------------------------------------------------------------------------------

interface Risk {
  k: number
  r1: number
  r2: number
  n1: number
  a: number
  n2: number
  b: number
}
/** WHO puts the risk at about 16 to 18 times; studies range 10 to 30. Never 10, a power of ten. */
const RISK_KS = range(11, 30, 0.5)
/** TB a year among people with HIV, %, to 0.1 so that most ratios leave a rate without HIV of 2 places. */
const HIV_RATES = range(1, 8, 0.1)
/** Without HIV, % a year: 0.05 to 0.6, as in a country where TB is common. */
const NO_HIV: readonly [number, number] = [0.05, 0.6]
const N1 = range(500, 5000, 100)
const N2 = range(5000, 60000, 1000)
/** Rates without HIV that make the division a doubling (0.5), or move the point (0.1, 0.05 halved). */
const TRIVIAL_R2 = [0.5, 0.1, 0.05]

/**
 * Every study: a rate with HIV and a ratio whose rate without HIV is exact to 2 places and in the
 * range, then group sizes that give whole numbers of cases. No ratio of ten between the groups (the
 * answer would be the cases' ratio with the point moved), and the answer is no given, nor the cases'
 * ratio or the groups' ratio with the point moved.
 */
const risks = memo('health:hiv-risks', (): Risk[] =>
  RISK_KS.flatMap((k) => HIV_RATES.map((r1) => ({ k, r1, r2: clean(r1 / k) })))
    .filter((x) => atMost(x.r2, 2) && between(x.r2, NO_HIV) && !TRIVIAL_R2.includes(x.r2))
    .flatMap((x) =>
      N1.filter((n) => whole((n * x.r1) / 100)).flatMap((n1) =>
        N2.filter((n) => whole((n * x.r2) / 100) && (n * x.r2) / 100 >= 4).map((n2) => ({ ...x, n1, a: clean((n1 * x.r1) / 100), n2, b: clean((n2 * x.r2) / 100) })),
      ),
    )
    .filter((x) => distinct(x.n1, x.n2, x.a, x.b) && clearOf(x.k, x.n1, x.n2, x.a, x.b) && !tenfold(x.k, x.a / x.b) && !tenfold(x.k, x.n2 / x.n1)),
)

/**
 * Only rates without HIV that three or more ratios reach, then the rate and the ratio each spread
 * evenly. Drawn as they came, 0.25% filled 28% of builds and 0.5% (where dividing by it doubles)
 * 19%; drawn by the rate alone, the few ratios that leave a short decimal (12.5, 20, 25) took 86%.
 */
const risk = (r: Rng): Risk => balanced(r, 'health:hiv-risk', () => rich(risks(), (y) => y.r2, (y) => y.k, 3), (y) => y.k, (y) => y.r2)

const RISK_PROMPTS = [
  (x: Risk) =>
    `In a made-up study, ${x.a} of ${prose(x.n1)} people living with HIV developed tuberculosis in one year, compared with ${x.b} of ${prose(x.n2)} people without HIV. How many times more likely was a person with HIV to develop tuberculosis?`,
  (x: Risk) =>
    `A made-up study followed ${prose(x.n1)} people living with HIV and ${prose(x.n2)} people without HIV for a year. Of the people with HIV, ${x.a} developed tuberculosis, and of the people without HIV, ${x.b} did. How many times more likely was a person with HIV to develop tuberculosis?`,
]

/** Rate ÷ rate: written as q21 (60 of 2000 and 30 of 20 000, 20 times). */
export const hivTuberculosis: Generator = {
  id: 'hiv-tuberculosis-relative-risk',
  subjectId: 'biology',
  topicId: PATHOGENS,
  replaces: ['q21'],
  build(r, slot) {
    const x = risk(r)
    return numeric(
      slot,
      {
        prompt: pick(r, RISK_PROMPTS)(x),
        solution:
          `With HIV: $\\dfrac{${x.a}}{${tex(x.n1)}} \\times 100 = ${show(x.r1)}\\%$. Without HIV: $\\dfrac{${x.b}}{${tex(x.n2)}} \\times 100 = ${show(x.r2)}\\%$. ` +
          `So $${show(x.r1)} \\div ${show(x.r2)} = ${show(x.k)}$ times more likely. Comparing the numbers of cases alone would be wrong, because the two groups are different sizes. ` +
          'HIV destroys white blood cells, weakening the immune system, so tuberculosis bacteria are not destroyed.',
        method: [`finds the rate with HIV, ${show(x.r1)}% or ${show(x.r1 / 100)}`, `finds the rate without HIV, ${show(x.r2)}% or ${show(x.r2 / 100)}`],
        answer: x.k,
        tolerance: halfLastPlace(x.k),
        units: unitsOf(slot),
        line: show(x.k),
      },
      // Second route: cross-multiplied counts, a × n2 ÷ (b × n1).
      { agrees: near((x.a * x.n2) / (x.b * x.n1), x.k), detail: `${x.a} × ${x.n2} ÷ (${x.b} × ${x.n1})` },
      { context: 'hiv', r1: x.r1, r2: x.r2, n1: x.n1, a: x.a, n2: x.n2, b: x.b, k: x.k },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q27: the share of a screened group found infected
// ---------------------------------------------------------------------------------------------

interface Infection {
  name: string
  intro: string
  /** % positive, lowest, highest and step. */
  pct: readonly [number, number, number]
  after: (n: number) => string
}
const INFECTIONS: Infection[] = [
  {
    name: 'chlamydia', pct: [3, 10, 0.1],
    intro: 'Chlamydia is a sexually transmitted infection caused by the bacterium *Chlamydia trachomatis*. It often causes no symptoms, so infected people can pass it on without knowing.',
    after: (n) =>
      `Every one of these ${n} people felt well, so without the test they would not have known they were infected and could have passed the bacterium on through unprotected sex. ` +
      'Screening finds them so they can be treated with antibiotics, which works because *Chlamydia trachomatis* is a bacterium, and condoms stop the bacterium passing between partners in the meantime.',
  },
  {
    name: 'gonorrhoea', pct: [0.5, 3, 0.05],
    intro: 'Gonorrhoea is a sexually transmitted infection caused by a bacterium. Many infected people, especially women, have no symptoms, so they can pass it on without knowing.',
    after: (n) =>
      `None of these ${n} people had symptoms, so without the test they could have passed the bacterium on through unprotected sex. ` +
      'Screening finds them so they can be treated with antibiotics, although many strains are now resistant to penicillin, and condoms stop the bacterium passing between partners.',
  },
]

interface Screen {
  n: number
  pos: number
  pct: number
}
const screens = (inf: Infection): Screen[] =>
  range(400, 6000, 50).flatMap((n) =>
    range(...inf.pct)
      .map((pct) => ({ n, pct, pos: clean((n * pct) / 100) }))
      .filter((x) => whole(x.pos) && x.pos >= 5 && figures(x.pct) <= 3 && !powerOfTen(x.n) && distinct(x.n, x.pos) && shiftFree(x.pct, x.n, x.pos) && noOnes(x.pct)),
  )

const SCREEN_PROMPTS = [
  (inf: Infection, x: Screen) =>
    `${inf.intro} A screening programme tested ${prose(x.n)} young people who had no symptoms, and ${x.pos} of them tested positive. Calculate the percentage of the people tested who were infected.`,
  (inf: Infection, x: Screen) =>
    `${inf.intro} A clinic offered a test to young people with no symptoms. Of the ${prose(x.n)} who were tested, ${x.pos} tested positive. What percentage of those tested were infected?`,
]

/** Positives ÷ tested × 100: written as q27 (175 of 2500, 7%). */
export const screeningPercentage: Generator = {
  id: 'screening-percentage-infected',
  subjectId: 'biology',
  topicId: PATHOGENS,
  replaces: ['q27'],
  build(r, slot, turn) {
    const inf = INFECTIONS[turn % INFECTIONS.length]!
    const x = balanced(r, `health:screening-percentage-infected:${inf.name}`, () => screens(inf), (y) => y.n, (y) => y.pct)
    return numeric(
      slot,
      {
        prompt: pick(r, SCREEN_PROMPTS)(inf, x),
        solution: `Percentage infected $= \\dfrac{${x.pos}}{${tex(x.n)}} \\times 100 = ${show(x.pct)}$%. ${inf.after(x.pos)}`,
        method: [`divides ${x.pos} by ${prose(x.n)} and multiplies by 100`],
        answer: x.pct,
        tolerance: halfLastPlace(x.pct),
        units: unitsOf(slot),
      },
      // Second route: that percentage of the people tested is the number found.
      { agrees: near((x.pct / 100) * x.n, x.pos), detail: `${show(x.pct)}% of ${x.n} = ${show((x.pct / 100) * x.n)}` },
      { context: inf.name, n: x.n, pos: x.pos, pct: x.pct },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q28: malaria cases per 1000 before and after a control measure
// ---------------------------------------------------------------------------------------------

interface Control {
  name: string
  /** "Insecticide-treated bed nets were then given to every household". */
  measure: string
  /** Cut in cases, %. */
  cut: readonly [number, number]
  why: string
}
const CONTROLS: Control[] = [
  {
    name: 'bed nets', measure: 'Insecticide-treated bed nets were then given to every household', cut: [30, 60],
    why: 'The nets work because malaria is spread by a mosquito vector that bites at night: fewer bites, so fewer people receive the protist.',
  },
  {
    name: 'spraying', measure: 'The inside walls of every house were then sprayed with insecticide', cut: [25, 55],
    why: 'The spraying works because malaria is spread by a mosquito vector, which rests on walls after feeding: fewer mosquitoes, so fewer people receive the protist.',
  },
  {
    name: 'breeding sites', measure: 'Ponds, ditches and other standing water near the houses were then drained or covered', cut: [15, 40],
    why: 'This works because malaria is spread by a mosquito vector whose larvae grow in standing water: fewer places to breed, so fewer mosquitoes to pass on the protist.',
  },
]
/** Thousands of people: 2 000 to 15 000. */
const LOTS = range(2, 15)

interface Malaria {
  r1: number
  r2: number
  pct: number
}
const malarias = (c: Control): Malaria[] =>
  range(30, 300).flatMap((r1) =>
    range(Math.ceil(r1 * (1 - c.cut[1] / 100)), Math.floor(r1 * (1 - c.cut[0] / 100)))
      .map((r2) => ({ r1, r2, pct: clean(((r1 - r2) / r1) * 100) }))
      .filter((x) => whole(x.pct) && between(x.pct, c.cut) && distinct(x.r1, x.r2, x.r1 - x.r2) && shiftFree(x.pct, x.r1, x.r2, x.r1 - x.r2)),
  )

const MALARIA_PROMPTS = [
  (c: Control, x: Malaria, place: string, N: number) =>
    `${place} has ${prose(N)} people. In one year it recorded ${x.r1} cases of malaria for every 1000 people. ${c.measure}, and in the following year ${prose(x.r2 * N / 1000)} cases of malaria were recorded in the whole ${place.slice(2)}. ` +
    'Calculate the percentage decrease in the number of cases per 1000 people.',
  (c: Control, x: Malaria, place: string, N: number) =>
    `Malaria is common in ${place.toLowerCase()} of ${prose(N)} people, where ${x.r1} cases were recorded per 1000 people in one year. ${c.measure}. In the next year there were ${prose(x.r2 * N / 1000)} cases in the whole ${place.slice(2)}. ` +
    'Calculate the percentage decrease in the number of cases per 1000 people.',
]

/** Per 1000 both years, then the fall over the first: written as q28 (40 per 1000, 288 of 12 000, 40%). */
export const malariaControl: Generator = {
  id: 'malaria-control-percentage-decrease',
  subjectId: 'biology',
  topicId: PATHOGENS,
  replaces: ['q28'],
  build(r, slot, turn) {
    const c = CONTROLS[turn % CONTROLS.length]!
    // Only falls that several rates give, then only rates that give several falls: 300 per 1000 gives
    // a whole-number fall far more often than any other rate and would fill the context.
    const pool = memo(`health:malaria:${c.name}`, () => rich(rich(malarias(c), (y) => y.pct, (y) => y.r1, 3), (y) => y.r1, (y) => y.pct, 3))
    const x = balanced(r, `health:malaria-control-percentage-decrease:${c.name}`, pool, (y) => y.r1, (y) => y.pct)
    // The village size last: never a figure the answer is with the point moved, doubled or halved.
    const L = draw(r, (r) => pick(r, LOTS), (l) => shiftFree(x.pct, l, x.r2 * l, x.r1 * l) && distinct(l, x.r1, x.r2))
    const N = L * 1000
    const c1 = x.r1 * L
    const c2 = x.r2 * L
    const place = N <= 9000 ? 'A village' : 'A town'
    return numeric(
      slot,
      {
        prompt: pick(r, MALARIA_PROMPTS)(c, x, place, N),
        solution:
          `First put both years on the same footing. The ${place.slice(2)} is $${tex(N)} \\div 1000 = ${L}$ lots of 1000 people, so the second year's rate is $\\dfrac{${tex(c2)}}{${L}} = ${x.r2}$ cases per 1000. ` +
          `The fall is $${x.r1} - ${x.r2} = ${x.r1 - x.r2}$ per 1000, and $\\dfrac{${x.r1 - x.r2}}{${x.r1}} \\times 100 = ${show(x.pct)}$%. ` +
          `(Checking the other way: ${x.r1} per 1000 in ${place.slice(2) === 'village' ? 'a village' : 'a town'} of ${prose(N)} is $${x.r1} \\times ${L} = ${tex(c1)}$ cases, and $\\dfrac{${tex(c1)} - ${tex(c2)}}{${tex(c1)}} \\times 100 = ${show(x.pct)}$%.) ${c.why}`,
        method: [
          `converts ${prose(c2)} cases in ${prose(N)} people to ${x.r2} per 1000 (or ${x.r1} per 1000 to ${prose(c1)} cases)`,
          `divides the fall by the original figure: ${x.r1 - x.r2}/${x.r1} or ${prose(c1 - c2)}/${prose(c1)}`,
        ],
        answer: x.pct,
        tolerance: halfLastPlace(x.pct),
        units: unitsOf(slot),
      },
      // Second route: whole-village case counts, as the solution's check does.
      { agrees: near(((c1 - c2) / c1) * 100, x.pct), detail: `(${c1} − ${c2}) ÷ ${c1} × 100` },
      { context: c.name, r1: x.r1, c2, N, pct: x.pct },
    )
  },
}

// =============================================================================================
// How the body fights infection
// =============================================================================================

// ---------------------------------------------------------------------------------------------
// q24: the fall in a country's cases after a vaccine
// ---------------------------------------------------------------------------------------------

interface Vaccinated {
  name: string
  disease: string
  /** Cases a year before the vaccine: lowest, highest, step. */
  before: readonly [number, number, number]
  /** Fall, %. */
  fall: readonly [number, number]
}
const VACCINATED: Vaccinated[] = [
  { name: 'measles', disease: 'measles', before: [100000, 500000, 1000], fall: [90, 99.5] },
  { name: 'whooping cough', disease: 'whooping cough', before: [30000, 120000, 1000], fall: [85, 98] },
  { name: 'mumps', disease: 'mumps', before: [10000, 60000, 500], fall: [85, 99] },
  { name: 'rubella', disease: 'rubella', before: [10000, 50000, 500], fall: [90, 99.5] },
  { name: 'polio', disease: 'polio', before: [2000, 8000, 100], fall: [90, 99.5] },
]

interface Fall {
  before: number
  after: number
  change: number
  pct: number
}
const falls = (v: Vaccinated): Fall[] =>
  range(...v.before).flatMap((before) =>
    range(v.fall[0], v.fall[1], 0.5)
      .map((pct) => ({ before, pct, after: clean((before * (100 - pct)) / 100) }))
      .filter((x) => whole(x.after) && x.after >= 10)
      .map((x) => ({ ...x, change: clean(x.before - x.after) }))
      .filter((x) => !powerOfTen(x.before) && distinct(x.before, x.after, x.change) && shiftFree(x.pct, x.before, x.after, x.change) && !tenfold(100 - x.pct, x.after)),
  )

const FALL_PROMPTS = [
  (v: Vaccinated, x: Fall) =>
    `Before a vaccine against ${v.disease} was introduced, a country recorded ${prose(x.before)} cases of ${v.disease} in a year. Ten years after the vaccine was introduced, it recorded ${prose(x.after)} cases in a year. Calculate the percentage decrease in the number of cases.`,
  (v: Vaccinated, x: Fall) =>
    `A country recorded ${prose(x.before)} cases of ${v.disease} in the year before it began vaccinating children against the disease, and ${prose(x.after)} cases in a year a decade later. Calculate the percentage decrease in the number of cases.`,
]

/** (old − new) ÷ old × 100: written as q24 (56 000 to 1 400 cases, 97.5%). */
export const vaccineFall: Generator = {
  id: 'vaccine-cases-percentage-decrease',
  subjectId: 'biology',
  topicId: FIGHTS,
  replaces: ['q24'],
  build(r, slot, turn) {
    const v = VACCINATED[turn % VACCINATED.length]!
    const x = balanced(r, `health:vaccine-cases-percentage-decrease:${v.name}`, memo(`health:fall:${v.name}`, () => falls(v)), (y) => y.before, (y) => y.pct)
    return numeric(
      slot,
      {
        prompt: pick(r, FALL_PROMPTS)(v, x),
        solution:
          `Percentage decrease $= \\dfrac{\\text{decrease}}{\\text{original}} \\times 100$. The decrease is $${tex(x.before)} - ${tex(x.after)} = ${tex(x.change)}$ cases. ` +
          `So $\\dfrac{${tex(x.change)}}{${tex(x.before)}} \\times 100 = ${show(x.pct)}\\%$. Dividing by the new figure, ${prose(x.after)}, instead of the original would be wrong: a percentage change is always measured against the starting value. ` +
          `Only ${show(clean(100 - x.pct))}% of the former cases remain.`,
        method: [`finds the decrease of ${prose(x.change)} and divides by the original ${prose(x.before)}`],
        answer: x.pct,
        tolerance: halfLastPlace(x.pct),
        units: unitsOf(slot),
      },
      // Second route: the cases left are (100 − p)% of the original.
      { agrees: near((x.before * (100 - x.pct)) / 100, x.after), detail: `${x.before} × ${show(1 - x.pct / 100)} = ${x.after}` },
      { context: v.name, before: x.before, after: x.after, pct: x.pct },
    )
  },
}

// =============================================================================================
// Antibiotic discs and clear zones (used by two topics)
// =============================================================================================

const DRUGS = ['penicillin', 'streptomycin', 'tetracycline', 'ampicillin', 'chloramphenicol']
/** Paper discs, mm across. */
const DISCS = [5, 6, 7, 8]
/** Clear zones, mm across, including the disc. */
const ZONE: readonly [number, number] = [10, 30]

/** Area in mm², exact, of a circle `d` mm across. */
const circle = (d: number) => Math.PI * (d / 2) ** 2
/**
 * Clear of a half-way case at 1 place, and not ending in .0, which the answer box would print as a
 * whole number although the prompt asks for 1 decimal place.
 */
const oneDp = (x: number) => clearOfHalf(x, 1) && !whole(roundTo(x, 1))

/**
 * A student without a π key uses 3.14, and the written q27 accepts it ("accept 285.7 from π = 3.14").
 * The room is the gap from the answer to the 3.14 value, plus half a unit for rounding that value to
 * 1 place, and never less than half a unit. A ring adds a second half unit: its 3.14 route may round
 * each area to 1 place before subtracting, and an area such as 3.14 × 2.25 = 7.065 sits on a
 * half-way case that rounds either way.
 */
const PI_STUDENT = 3.14
/** The 3.14 answer of a circle of radius r, unrounded. */
const circle314 = (rad: number) => clean(PI_STUDENT * rad * rad)
/** The 3.14 answers a student writes for a ring, to 1 place: on the difference, and from the two areas rounded first. */
const ring314 = (R: number, r: number) => [
  roundTo(clean(PI_STUDENT * (R * R - r * r)), 1),
  clean(roundTo(circle314(R), 1) - roundTo(circle314(r), 1)),
]
/** "(accept 285.7 from π = 3.14)": every 1-place 3.14 answer, once each. */
const accept314 = (values: number[]) => {
  const shown = [...new Set(values.map((v) => fixed(v, 1)))]
  return `(accept ${shown.join(' or ')} from π = 3.14)`
}

interface Ring {
  d: number
  D: number
  /** Areas to 1 place, as the solution prints them. */
  zone: number
  disc: number
  exact: number
}
/**
 * Every disc and zone (at least 4 mm wider than the disc) whose ring, to 1 place and to the nearest
 * whole number, is clear of a half-way case, and whose two areas rounded to 1 place subtract to the
 * ring's own 1-place rounding, so "314.2 − 28.3 = 285.9" holds as printed.
 */
const rings = memo('health:clear-zone-rings', (): Ring[] =>
  DISCS.flatMap((d) =>
    range(Math.max(ZONE[0], d + 4), ZONE[1]).map((D) => ({ d, D, zone: roundTo(circle(D), 1), disc: roundTo(circle(d), 1), exact: circle(D) - circle(d) })),
  ).filter((x) => oneDp(x.exact) && clearOfHalf(x.exact, 0) && near(clean(x.zone - x.disc), roundTo(x.exact, 1)) && Math.round(roundTo(x.exact, 1)) === Math.round(x.exact) && x.exact >= 30),
)

const SETUPS = [
  (drug: string) => `A paper disc soaked in ${drug} is placed on an agar plate spread with bacteria, and the plate is incubated.`,
  (drug: string) => `To test ${drug}, a student places a paper disc soaked in it on agar jelly covered with bacteria and incubates the plate.`,
]

/** π × (R² − r²) in maths, from the two diameters. */
const ringWorking = (x: Ring) => {
  const R = clean(x.D / 2)
  const r = clean(x.d / 2)
  return { R, r, R2: clean(R * R), r2: clean(r * r), diff: clean(R * R - r * r) }
}

// ---------------------------------------------------------------------------------------------
// how-the-body-fights-infection q25: the ring where the bacteria did not grow, to the nearest whole number
// ---------------------------------------------------------------------------------------------

/**
 * Rings whose 3.14 working, on the difference or from two areas rounded to 1 place, rounds to the
 * same whole number as π: 6 mm in 25 mm gives 463 with π and 462 with 3.14.
 */
const wholeRings = memo('health:clear-zone-whole-rings', () =>
  rings().filter((x) => {
    const raw = clean(PI_STUDENT * ((x.D / 2) ** 2 - (x.d / 2) ** 2))
    return Math.abs(raw - Math.round(x.exact)) + 0.1 < 0.5
  }),
)

const WHOLE_PROMPTS = [
  (drug: string, x: Ring) =>
    `To test ${drug}, a paper disc soaked in it is placed on agar jelly covered with growing bacteria. After two days the bacteria have not grown in a circular clear zone around the disc. ` +
    `The disc has a diameter of ${x.d} mm, and the clear zone, measured straight across the disc, has a diameter of ${x.D} mm. ` +
    'Calculate the area of agar in which the bacteria did not grow, not counting the agar under the disc itself. Give your answer in mm² to the nearest whole number.',
  (drug: string, x: Ring) =>
    `A paper disc ${x.d} mm across, soaked in ${drug}, is placed on agar covered with bacteria. After incubation, a circular clear zone ${x.D} mm across, measured through the middle of the disc, surrounds it. ` +
    'Calculate the area of agar around the disc in which the bacteria did not grow, not counting the area under the disc. Give your answer in mm² to the nearest whole number.',
]

/** π R² − π r², to the nearest mm²: written as q25 (6 mm and 20 mm, 286 mm²). */
export const clearZoneWhole: Generator = {
  id: 'clear-zone-ring-nearest-whole',
  subjectId: 'biology',
  topicId: FIGHTS,
  replaces: ['q25'],
  build(r, slot, turn) {
    const drug = DRUGS[turn % DRUGS.length]!
    const x = balanced(r, 'health:clear-zone-ring-nearest-whole', wholeRings, (y) => y.d, (y) => y.D)
    const w = ringWorking(x)
    const answer = Math.round(x.exact)
    const alt = Math.round(PI_STUDENT * w.diff)
    return numeric(
      slot,
      {
        prompt: pick(r, WHOLE_PROMPTS)(drug, x),
        solution:
          `The area of a circle is $\\pi r^2$, and both measurements given are **diameters**, so halve them first. The clear zone has radius $${x.D} \\div 2 = ${show(w.R)}$ mm, so its area is $\\pi \\times ${show(w.R)}^2 = ${fixed(x.zone, 1)}\\ \\text{mm}^2$. ` +
          `The disc has radius $${x.d} \\div 2 = ${show(w.r)}$ mm, so it covers $\\pi \\times ${show(w.r)}^2 = ${fixed(x.disc, 1)}\\ \\text{mm}^2$. ` +
          `The agar where the bacteria did not grow is the ring between them: $${fixed(x.zone, 1)} - ${fixed(x.disc, 1)} = ${fixed(x.exact, 1)}$, which is $${answer}\\ \\text{mm}^2$ to the nearest whole number. ` +
          `The same answer comes from $\\pi \\times (${show(w.R2)} - ${show(w.r2)}) = \\pi \\times ${show(w.diff)}$. The commonest slip is to square the diameter, which gives four times the true area; the next is to forget the disc, which gives ${Math.round(circle(x.D))}. Using π = 3.14 gives ${alt} as well.`,
        method: [`halves both diameters to radii of ${show(w.R)} mm and ${show(w.r)} mm`, `subtracts the disc area from the clear-zone area: π × ${show(w.R)}² − π × ${show(w.r)}²`],
        answer,
        // Half a unit in the place asked for; π = 3.14 rounds to the same whole number.
        tolerance: 0.5,
        units: unitsOf(slot),
        line: `${answer} mm² (accept ${alt} from π = 3.14)`,
      },
      // Second route: π times the difference of the squared radii.
      { agrees: Math.abs(Math.PI * w.diff - answer) < 0.5, detail: `π × ${show(w.diff)} = ${fixed(Math.PI * w.diff, 3)}` },
      { context: drug, d: x.d, D: x.D, area: answer },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// antibiotics q4: area from a radius
// ---------------------------------------------------------------------------------------------

/** Radii 4 to 15 mm (zones 8 to 30 mm across, wider than any disc), whose area is clear of a half-way case at 1 place. */
const RADII = range(4, 15, 0.5).filter((rad) => oneDp(Math.PI * rad * rad))

/** The end of an area's working: "= 78.539…, which is 78.5 mm² to 1 decimal place". */
const toOne = (x: number) => `${cut(x, 6)}\\ldots$, which is ${fixed(x, 1)} mm² to 1 decimal place`

const RADIUS_PROMPTS = [
  (drug: string, rad: number, r: Rng) =>
    `${pick(r, SETUPS)(drug)} The clear zone that forms around the disc has a radius of ${show(rad)} mm. Calculate its area using πr². Give your answer to 1 decimal place.`,
  (drug: string, rad: number, r: Rng) =>
    `${pick(r, SETUPS)(drug)} A circular clear zone with a radius of ${show(rad)} mm forms where the bacteria could not grow. Using πr², calculate the area of the clear zone. Give your answer to 1 decimal place.`,
]

/** π r²: written as q4 (radius 5 mm, 78.5 mm²). */
export const clearZoneRadius: Generator = {
  id: 'clear-zone-area-from-radius',
  subjectId: 'biology',
  topicId: ANTIBIOTICS,
  replaces: ['q4'],
  build(r, slot, turn) {
    const drug = DRUGS[turn % DRUGS.length]!
    const rad = pick(r, RADII)
    const exact = Math.PI * rad * rad
    const answer = roundTo(exact, 1)
    const raw = circle314(rad)
    return numeric(
      slot,
      {
        prompt: pick(r, RADIUS_PROMPTS)(drug, rad, r),
        solution: `Area $= \\pi r^2 = \\pi \\times ${show(rad)}^2 = \\pi \\times ${show(rad * rad)} = ${toOne(exact)}.`,
        method: [`substitutes into πr²: π × ${show(rad)}²`],
        answer,
        tolerance: piRoom(answer, raw, 1),
        units: unitsOf(slot),
        line: `${show(answer)} mm² ${accept314([raw])}`,
      },
      // Second route: a circle is a quarter of π d².
      { agrees: Math.abs((Math.PI * (2 * rad) ** 2) / 4 - answer) <= 0.05, detail: `π × ${show(2 * rad)}² ÷ 4` },
      { context: drug, radius: rad, area: answer },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// antibiotics q7: area from a diameter
// ---------------------------------------------------------------------------------------------

const DIAMETERS = range(ZONE[0], ZONE[1]).filter((D) => oneDp(circle(D)))

const DIAMETER_PROMPTS = [
  (drug: string, D: number, r: Rng) => `${pick(r, SETUPS)(drug)} The clear zone that forms around the disc has a diameter of ${D} mm. Calculate its area. Give your answer to 1 decimal place.`,
  (drug: string, D: number, r: Rng) =>
    `${pick(r, SETUPS)(drug)} The bacteria do not grow in a circular clear zone, which measures ${D} mm across. Calculate the area of the clear zone. Give your answer to 1 decimal place.`,
]

/** π (d ÷ 2)²: written as q7 (diameter 14 mm, 153.9 mm²). */
export const clearZoneDiameter: Generator = {
  id: 'clear-zone-area-from-diameter',
  subjectId: 'biology',
  topicId: ANTIBIOTICS,
  replaces: ['q7'],
  build(r, slot, turn) {
    const drug = DRUGS[turn % DRUGS.length]!
    const D = pick(r, DIAMETERS)
    const rad = clean(D / 2)
    const exact = circle(D)
    const answer = roundTo(exact, 1)
    const raw = circle314(rad)
    return numeric(
      slot,
      {
        prompt: pick(r, DIAMETER_PROMPTS)(drug, D, r),
        solution:
          `Halve the diameter first: $r = ${D} \\div 2 = ${show(rad)}$ mm. Area $= \\pi \\times ${show(rad)}^2 = \\pi \\times ${show(rad * rad)} = ${toOne(exact)}. ` +
          `Using the diameter instead of the radius is the most common mistake: it gives $\\pi \\times ${D}^2$, four times too big.`,
        method: [`r = ${show(rad)} and π × ${show(rad)}²`],
        answer,
        tolerance: piRoom(answer, raw, 1),
        units: unitsOf(slot),
        line: `${show(answer)} mm² ${accept314([raw])}`,
      },
      // Second route: a quarter of π d².
      { agrees: Math.abs((Math.PI * D * D) / 4 - answer) <= 0.05, detail: `π × ${D}² ÷ 4` },
      { context: drug, D, area: answer },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// antibiotics q11 and q27: the ring of clear agar around the disc, to 1 decimal place
// ---------------------------------------------------------------------------------------------

const RING_PROMPTS: Record<string, ((drug: string, x: Ring) => string)[]> = {
  q11: [
    (drug, x) =>
      `A paper disc of diameter ${x.d} mm, soaked in ${drug}, sits in the middle of a clear zone of diameter ${x.D} mm on an agar plate of bacteria. Calculate the area of clear agar, not counting the area under the disc. Give your answer to 1 decimal place.`,
    (drug, x) =>
      `On an agar plate spread with bacteria, a clear zone of diameter ${x.D} mm forms around a paper disc of diameter ${x.d} mm soaked in ${drug}. The disc sits in the middle of the zone. Calculate the area of clear agar around the disc, not counting the area under the disc. Give your answer to 1 decimal place.`,
  ],
  q27: [
    (drug, x) =>
      `A paper disc of diameter ${x.d} mm, soaked in ${drug}, is placed on an agar plate spread with bacteria. After incubation the clear zone, measured across and including the disc, has a diameter of ${x.D} mm. ` +
      'Using area = πr², calculate the area of the clear agar around the disc, not counting the disc itself. Give your answer in mm² to 1 decimal place.',
    (drug, x) =>
      `A student places a paper disc soaked in ${drug} on agar covered with bacteria. The disc has a diameter of ${x.d} mm. After incubation, the clear zone measured straight across, including the disc, is ${x.D} mm. ` +
      'Using area = πr², calculate the area of clear agar around the disc, not counting the disc itself. Give your answer in mm² to 1 decimal place.',
  ],
}

/** π R² − π r², to 1 place: written as q11 and q27 (6 mm and 20 mm, 285.9 mm²). */
export const clearZoneRing: Generator = {
  id: 'clear-zone-ring-area',
  subjectId: 'biology',
  topicId: ANTIBIOTICS,
  replaces: ['q11', 'q27'],
  build(r, slot, turn) {
    const drug = DRUGS[turn % DRUGS.length]!
    const x = balanced(r, 'health:clear-zone-ring-area', rings, (y) => y.d, (y) => y.D)
    const w = ringWorking(x)
    const answer = roundTo(x.exact, 1)
    const raw = clean(PI_STUDENT * w.diff)
    const q27 = slot.id === 'q27'
    const solution = q27
      ? `Halve each diameter first. Clear zone including the disc: $r = ${show(w.R)}$ mm, area $= \\pi \\times ${show(w.R)}^2 = ${fixed(x.zone, 1)}$ mm². Disc: $r = ${show(w.r)}$ mm, area $= \\pi \\times ${show(w.r)}^2 = ${fixed(x.disc, 1)}$ mm². ` +
        `Clear agar around the disc $= ${fixed(x.zone, 1)} - ${fixed(x.disc, 1)} = ${fixed(answer, 1)}$ mm² (exactly, $\\pi \\times (${show(w.R2)} - ${show(w.r2)}) = \\pi \\times ${show(w.diff)} = ${show(answer)}$ mm² to 1 decimal place). ` +
        'The disc is subtracted because the bacteria could never have grown under it, so only the ring around it shows the antibiotic at work. Using the diameter as the radius is the common mistake: it gives an area four times too big.'
      : `Clear agar = area of the zone − area of the disc $= \\pi \\times ${show(w.R)}^2 - \\pi \\times ${show(w.r)}^2 = \\pi \\times (${show(w.R2)} - ${show(w.r2)}) = \\pi \\times ${show(w.diff)} = ${show(answer)}$ mm² to 1 decimal place. ` +
        `Both radii are half the diameters: $${x.D} \\div 2 = ${show(w.R)}$ mm and $${x.d} \\div 2 = ${show(w.r)}$ mm.`
    const method = q27
      ? [`halves both diameters and finds both areas: ${fixed(x.zone, 1)} mm² and ${fixed(x.disc, 1)} mm²`]
      : [`radii ${show(w.R)} and ${show(w.r)}`, `π × ${show(w.R)}² − π × ${show(w.r)}²`]
    return numeric(
      slot,
      {
        prompt: pick(r, RING_PROMPTS[slot.id] ?? RING_PROMPTS.q11!)(drug, x),
        solution,
        method,
        answer,
        tolerance: piRoom(answer, raw, 2),
        units: unitsOf(slot),
        line: `${show(answer)} mm² ${accept314(ring314(w.R, w.r))}`,
      },
      // Second route: π times the difference of the squared radii.
      { agrees: Math.abs(Math.PI * w.diff - answer) <= 0.05, detail: `π × ${show(w.diff)} = ${fixed(Math.PI * w.diff, 3)}` },
      { context: drug, d: x.d, D: x.D, area: answer },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// antibiotics q21: the mean of two diameters at right angles
// ---------------------------------------------------------------------------------------------

interface Oval {
  D1: number
  D2: number
  mean: number
  rad: number
  answer: number
}
/** Two diameters 1 to 4 mm apart and within a quarter of their mean, never equal, in the zone range. */
const ovals = memo('health:clear-zone-ovals', (): Oval[] =>
  range(...ZONE).flatMap((D1) =>
    range(D1 + 1, Math.min(ZONE[1], D1 + 4))
      .map((D2) => {
        const mean = clean((D1 + D2) / 2)
        const rad = clean(mean / 2)
        return { D1, D2, mean, rad, answer: roundTo(Math.PI * rad * rad, 1) }
      })
      .filter((x) => (x.D2 - x.D1) / x.mean <= 0.25 && oneDp(Math.PI * x.rad * x.rad)),
  ),
)

const OVAL_PROMPTS = [
  (drug: string, a: number, b: number) =>
    `A clear zone around a disc soaked in ${drug} is not a perfect circle. A student measures its diameter twice, at right angles to each other: ${a} mm and ${b} mm. Use the mean diameter to calculate the area of the clear zone. Give your answer to 1 decimal place.`,
  (drug: string, a: number, b: number) =>
    `The clear zone around a paper disc soaked in ${drug} is slightly oval. Measured across in one direction it is ${a} mm, and at right angles to that ${b} mm. Using the mean of the two diameters, calculate the area of the clear zone. Give your answer to 1 decimal place.`,
]

/** Mean diameter, halved, then π r²: written as q21 (14 mm and 18 mm, 201.1 mm²). */
export const clearZoneMean: Generator = {
  id: 'clear-zone-area-from-two-diameters',
  subjectId: 'biology',
  topicId: ANTIBIOTICS,
  replaces: ['q21'],
  build(r, slot, turn) {
    const drug = DRUGS[turn % DRUGS.length]!
    const x = pick(r, ovals())
    // Either order: the smaller first is no rule.
    const [a, b] = r() < 0.5 ? [x.D1, x.D2] : [x.D2, x.D1]
    return numeric(
      slot,
      {
        prompt: pick(r, OVAL_PROMPTS)(drug, a, b),
        solution:
          `Mean diameter $= (${a} + ${b}) \\div 2 = ${show(x.mean)}$ mm, so $r = ${show(x.mean)} \\div 2 = ${show(x.rad)}$ mm. Area $= \\pi \\times ${show(x.rad)}^2 = \\pi \\times ${show(x.rad * x.rad)} = ${toOne(Math.PI * x.rad * x.rad)}. ` +
          'Averaging two diameters at right angles allows for a zone that is not a perfect circle.',
        method: [`mean diameter ${show(x.mean)} mm, so r = ${show(x.rad)}`, `π × ${show(x.rad)}²`],
        answer: x.answer,
        tolerance: piRoom(x.answer, circle314(x.rad), 1),
        units: unitsOf(slot),
        line: `${show(x.answer)} mm² ${accept314([circle314(x.rad)])}`,
      },
      // Second route: π × (sum of diameters)² ÷ 16.
      { agrees: Math.abs((Math.PI * (a + b) ** 2) / 16 - x.answer) <= 0.05, detail: `π × (${a} + ${b})² ÷ 16` },
      { context: drug, D1: x.D1, D2: x.D2, area: x.answer },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// antibiotics q28: the clear zone's share of a 90 mm plate
// ---------------------------------------------------------------------------------------------

/** A standard Petri dish. */
const DISH = 90
const DISH_AREA = roundTo(circle(DISH), 1)

interface Share {
  D: number
  f: Figure
}
/**
 * Zones whose share of the plate is exact to three figures or rounds clearly at three, never ends
 * in a 0 the answer box drops, and comes out the same from the two areas rounded to 1 place.
 */
const shares = memo('health:clear-zone-shares', (): Share[] =>
  range(...ZONE)
    .map((D) => ({ D, f: toThree((D * D) / 81) }))
    .filter((x) => fair(x.f) && noOnes(x.f.answer) && Math.abs((roundTo(circle(x.D), 1) / DISH_AREA) * 100 - x.f.answer) <= sfTolerance(x.f.answer, 3) * 0.9 && shiftFree(x.f.answer, x.D, DISH, x.D / 2)),
)

const SHARE_PROMPTS = [
  (drug: string, D: number) =>
    `A Petri dish is filled with agar to a diameter of ${DISH} mm and spread with bacteria. A single disc soaked in ${drug} is placed at the centre, and after incubation a circular clear zone of diameter ${D} mm has formed around it. ` +
    'Using area = πr², calculate the percentage of the agar surface that is clear.',
  (drug: string, D: number) =>
    `A student spreads bacteria over the agar in a Petri dish ${DISH} mm across and places one paper disc soaked in ${drug} in the middle. After incubation, the circular clear zone around the disc is ${D} mm across. ` +
    'Using area = πr², calculate what percentage of the agar surface is clear.',
]

/** Zone area ÷ plate area × 100: written as q28 (18 mm on a 90 mm plate, 4%). */
export const clearZoneShare: Generator = {
  id: 'clear-zone-share-of-the-plate',
  subjectId: 'biology',
  topicId: ANTIBIOTICS,
  replaces: ['q28'],
  build(r, slot, turn) {
    const drug = DRUGS[turn % DRUGS.length]!
    const x = pick(r, shares())
    const R = clean(x.D / 2)
    const zone = roundTo(circle(x.D), 1)
    return numeric(
      slot,
      {
        prompt: pick(r, SHARE_PROMPTS)(drug, x.D),
        solution:
          `Radii first: the agar has $r = ${DISH / 2}$ mm and the clear zone $r = ${show(R)}$ mm. Area of agar $= \\pi \\times ${DISH / 2}^2 = ${fixed(DISH_AREA, 1)}$ mm². Area of clear zone $= \\pi \\times ${show(R)}^2 = ${fixed(zone, 1)}$ mm². ` +
          `Percentage clear $= \\dfrac{${fixed(zone, 1)}}{${fixed(DISH_AREA, 1)}} \\times 100$. Since π cancels, the exact value is $\\dfrac{${show(R * R)}}{${(DISH / 2) ** 2}} \\times 100 ${ending(x.f, '%')}. ` +
          'The clear zone is where the antibiotic diffused far enough through the agar to stop the bacteria growing.',
        method: [`halves both diameters to radii of ${DISH / 2} mm and ${show(R)} mm and finds both areas (${fixed(DISH_AREA, 1)} and ${fixed(zone, 1)} mm²)`, 'divides the clear-zone area by the agar area and multiplies by 100'],
        answer: x.f.answer,
        tolerance: figureTolerance(x.f),
        units: unitsOf(slot),
      },
      // Second route: the ratio of the diameters, squared.
      { agrees: Math.abs((x.D / DISH) ** 2 * 100 - x.f.answer) <= figureTolerance(x.f) + 1e-9, detail: `(${x.D} ÷ ${DISH})² × 100` },
      { context: drug, D: x.D, share: x.f.answer },
    )
  },
}

// =============================================================================================
// The immune system and immunisation
// =============================================================================================

// ---------------------------------------------------------------------------------------------
// q19: the second response's peak over the first's
// ---------------------------------------------------------------------------------------------

interface Exposure {
  name: string
  first: string
  second: string
  /** Days to the first peak and to the second, lowest and highest. */
  d1: readonly [number, number]
  d2: readonly [number, number]
  why: string
}
const EXPOSURES: Exposure[] = [
  {
    name: 'pathogen', first: 'After a first exposure to a pathogen', second: 'After a second exposure to the same pathogen', d1: [9, 14], d2: [3, 7],
    why: 'Both differences come from the **memory lymphocytes** made during the first response: they recognise the antigen at once and make the right antibody quickly, before the pathogen can cause illness.',
  },
  {
    name: 'booster', first: 'After a first dose of a tetanus vaccine', second: 'After a booster dose of the same vaccine some years later', d1: [18, 30], d2: [7, 14],
    why: 'Both differences come from the **memory lymphocytes** made after the first dose: they recognise the antigen at once and make the right antibody quickly, which is why booster doses are given.',
  },
]

interface Peak {
  p1: number
  p2: number
  k: number
}
/** First peaks of 5 to 60 units, a second 3 to 30 times as high (never 10) and at most 900. */
const peaks = memo('health:antibody-peaks', (): Peak[] =>
  range(5, 60).flatMap((p1) =>
    range(3, 30, 0.5)
      .map((k) => ({ p1, k, p2: clean(p1 * k) }))
      .filter((x) => whole(x.p2) && x.p2 <= 900 && !powerOfTen(x.k) && distinct(x.p1, x.p2) && clearOf(x.k, x.p1, x.p2)),
  ),
)

const PEAK_PROMPTS = [
  (e: Exposure, x: Peak, d1: number, d2: number) =>
    `${e.first}, the antibody concentration in a person's blood peaked at ${x.p1} arbitrary units on day ${d1}. ${e.second}, it peaked at ${x.p2} arbitrary units on day ${d2}. How many times higher was the peak in the second response?`,
  (e: Exposure, x: Peak, d1: number, d2: number) =>
    `${e.first}, a person's antibody concentration rose to a peak of ${x.p1} arbitrary units, reached on day ${d1}. ${e.second}, the peak was ${x.p2} arbitrary units, reached on day ${d2}. Calculate how many times higher the second peak was than the first.`,
]

/** Second peak ÷ first: written as q19 (20 and 180 units, 9). */
export const antibodyPeaks: Generator = {
  id: 'antibody-peak-ratio',
  subjectId: 'biology',
  topicId: IMMUNE,
  replaces: ['q19'],
  build(r, slot, turn) {
    const e = EXPOSURES[turn % EXPOSURES.length]!
    const x = balanced(r, 'health:antibody-peak-ratio', peaks, (y) => y.p1, (y) => y.k)
    // Days: never the answer, nor the gap between them, nor one doubled or halved, with or without the point moved.
    const [d1, d2] = draw(r, (r) => [int(r, ...e.d1), int(r, ...e.d2)] as const, ([a, b]) => a > b && shiftFree(x.k, a, b, a - b))
    return numeric(
      slot,
      {
        prompt: pick(r, PEAK_PROMPTS)(e, x, d1, d2),
        solution: `$${x.p2} \\div ${x.p1} = ${show(x.k)}$ times higher. The second response also peaked ${d1 - d2} days sooner. ${e.why}`,
        method: [`divides ${x.p2} by ${x.p1}`],
        answer: x.k,
        tolerance: halfLastPlace(x.k),
        units: unitsOf(slot),
        line: show(x.k),
      },
      // Second route: the first peak that many times over is the second.
      { agrees: near(x.p1 * x.k, x.p2), detail: `${x.p1} × ${show(x.k)} = ${x.p2}` },
      { context: e.name, p1: x.p1, p2: x.p2, k: x.k },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q27: the share of a trial made immune
// ---------------------------------------------------------------------------------------------

interface Trial {
  name: string
  disease: string
  /** % made immune, lowest and highest. */
  immune: readonly [number, number]
}
/** One dose of measles vaccine makes about 93% immune, two about 97%; rubella about 97%; mumps less; polio over 95% after a full course. */
const TRIALS: Trial[] = [
  { name: 'measles', disease: 'measles', immune: [90, 98] },
  { name: 'mumps', disease: 'mumps', immune: [88, 96] },
  { name: 'rubella', disease: 'rubella', immune: [93, 99] },
  { name: 'polio', disease: 'polio', immune: [93, 99.5] },
]

interface Immune {
  n: number
  m: number
  pct: number
}
const immunes = (t: Trial): Immune[] =>
  range(200, 5000, 50).flatMap((n) =>
    range(t.immune[0], t.immune[1], 0.5)
      .map((pct) => ({ n, pct, m: clean((n * pct) / 100) }))
      .filter((x) => whole(x.m) && !powerOfTen(x.n) && distinct(x.n, x.m, x.n - x.m) && shiftFree(x.pct, x.n, x.m, x.n - x.m) && !tenfold(100 - x.pct, x.n - x.m)),
  )

const TRIAL_PROMPTS = [
  (t: Trial, x: Immune) =>
    `In a trial of a new vaccine against ${t.disease}, ${prose(x.n)} children were given the vaccine. Blood tests later showed that ${prose(x.m)} of them had become immune to the disease. Calculate the percentage of the children who became immune.`,
  (t: Trial, x: Immune) =>
    `A new ${t.disease} vaccine was given to ${prose(x.n)} children in a trial. Blood tests afterwards found that ${prose(x.m)} of the children were immune to ${t.disease}. What percentage of the children became immune?`,
]

/** Immune ÷ vaccinated × 100: written as q27 (1552 of 1600, 97%). */
export const vaccineTrial: Generator = {
  id: 'vaccine-trial-percentage-immune',
  subjectId: 'biology',
  topicId: IMMUNE,
  replaces: ['q27'],
  build(r, slot, turn) {
    const t = TRIALS[turn % TRIALS.length]!
    const x = balanced(r, `health:vaccine-trial-percentage-immune:${t.name}`, memo(`health:trial:${t.name}`, () => immunes(t)), (y) => y.n, (y) => y.pct)
    const left = clean(100 - x.pct)
    return numeric(
      slot,
      {
        prompt: pick(r, TRIAL_PROMPTS)(t, x),
        solution:
          `$\\dfrac{${tex(x.m)}}{${tex(x.n)}} \\times 100 = ${show(x.pct)}$%. The other ${show(left)}%, ${prose(x.n - x.m)} children, did not become immune: not everyone responds to a vaccine, which is one of its disadvantages and one reason herd immunity matters.`,
        method: [`divides ${prose(x.m)} by ${prose(x.n)} and multiplies by 100`],
        answer: x.pct,
        tolerance: halfLastPlace(x.pct),
        units: unitsOf(slot),
      },
      // Second route: that percentage of the children is the number made immune.
      { agrees: near((x.pct / 100) * x.n, x.m), detail: `${show(x.pct)}% of ${x.n} = ${show((x.pct / 100) * x.n)}` },
      { context: t.name, n: x.n, m: x.m, pct: x.pct },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q28: how many more must be vaccinated for herd immunity
// ---------------------------------------------------------------------------------------------

interface Herd {
  name: string
  disease: string
  /** "Two doses of the MMR vaccine give". */
  vaccine: string
  /** R₀, lowest and highest. */
  r0: readonly [number, number]
  /** Vaccine efficacy, %. */
  efficacy: readonly [number, number]
}
const HERDS: Herd[] = [
  { name: 'measles', disease: 'measles', vaccine: 'Two doses of the MMR vaccine give', r0: [12, 18], efficacy: [96, 98] },
  { name: 'rubella', disease: 'rubella', vaccine: 'The MMR vaccine gives', r0: [6, 7], efficacy: [95, 98] },
  { name: 'polio', disease: 'polio', vaccine: 'A full course of polio vaccine gives', r0: [5, 7], efficacy: [95, 99] },
  { name: 'mumps', disease: 'mumps', vaccine: 'Two doses of the MMR vaccine give', r0: [4, 7], efficacy: [85, 90] },
  { name: 'diphtheria', disease: 'diphtheria', vaccine: 'A full course of diphtheria vaccine gives', r0: [6, 7], efficacy: [94, 97] },
]
/** Whole-number thresholds inside 1 − 1/R₀ for the disease's R₀. */
const thresholds = (h: Herd) => range(Math.ceil(100 * (1 - 1 / h.r0[0])), Math.floor(100 * (1 - 1 / h.r0[1])))

interface Town {
  H: number
  E: number
  N: number
  V: number
  needed: number
  answer: number
}
/** Threshold and efficacy pairs that leave at least 1% unvaccinated even at full coverage. */
const pairs = (h: Herd) => thresholds(h).flatMap((H) => range(...h.efficacy).filter((E) => H / E <= 0.98).map((E) => ({ H, E })))

function town(r: Rng, h: Herd): Town {
  // The efficacy first, outside the retries: drawn inside them, the efficacies that divide most
  // towns cleanly came up most often (measles 98% in 41% of builds).
  const E = pick(r, [...new Set(pairs(h).map((x) => x.E))])
  const Hs = pairs(h).filter((x) => x.E === E).map((x) => x.H)
  return draw(
    r,
    (r) => {
      const H = pick(r, Hs)
      // N a multiple of 100 and of E ÷ gcd(H, E), so H% of N is whole and so is H/E of N.
      const unit = lcm(100, E / gcd(H, E))
      const N = unit * int(r, Math.ceil(10000 / unit), Math.floor(100000 / unit))
      const needed = clean((H * N) / E)
      // Already vaccinated: from 75% of the town to 1% short of what is needed, in hundreds.
      const V = 100 * int(r, Math.ceil((0.75 * N) / 100), Math.floor((needed - 0.01 * N) / 100))
      return { H, E, N, V, needed, answer: needed - V }
    },
    (x) => x.answer >= 100 && x.answer < 10000 && figures(x.answer) <= 3 && x.V >= 0.75 * x.N && x.V < x.needed && distinct(x.N, x.V, x.needed) && clearOf(x.answer, x.N, x.V, x.needed, (x.H * x.N) / 100 - (x.E * x.V) / 100),
  )
}

const HERD_PROMPTS = [
  (h: Herd, x: Town) =>
    `${h.vaccine} immunity against ${h.disease} to ${x.E}% of the people vaccinated. For herd immunity against ${h.disease}, at least ${x.H}% of a population must be immune. ` +
    `A town has ${prose(x.N)} people, of whom ${prose(x.V)} have been vaccinated. Calculate how many more people must be vaccinated for the town to reach herd immunity.`,
  (h: Herd, x: Town) =>
    `Herd immunity against ${h.disease} needs at least ${x.H}% of a population to be immune. ${h.vaccine} immunity to ${x.E}% of the people vaccinated. ` +
    `In a town of ${prose(x.N)} people, ${prose(x.V)} have been vaccinated. How many more people must be vaccinated for the town to reach herd immunity?`,
]

/** H ÷ E of the town, less those vaccinated: written as q28 (96%, 84%, 60 000 and 48 000, 4 500). */
export const herdImmunity: Generator = {
  id: 'herd-immunity-more-to-vaccinate',
  subjectId: 'biology',
  topicId: IMMUNE,
  replaces: ['q28'],
  build(r, slot, turn) {
    const h = HERDS[turn % HERDS.length]!
    const x = town(r, h)
    const mustBe = clean((x.H * x.N) / 100)
    const are = clean((x.E * x.V) / 100)
    const short = clean(mustBe - are)
    // The share to vaccinate as a percentage when H ÷ E ends within 3 places of a per cent, else as the fraction.
    const share = clean((x.H / x.E) * 100)
    const shareText = atMost(share, 3)
      ? `the percentage vaccinated must be $\\dfrac{${x.H}}{${x.E}} \\times 100 = ${show(share)}$%. For ${prose(x.N)} people that is $${show(share / 100)} \\times ${tex(x.N)} = ${tex(x.needed)}$ vaccinated`
      : `the number vaccinated must be $\\dfrac{${x.H}}{${x.E}} \\times ${tex(x.N)} = ${tex(x.needed)}$`
    return numeric(
      slot,
      {
        prompt: pick(r, HERD_PROMPTS)(h, x),
        solution:
          `Only ${x.E}% of those vaccinated become immune, so to make ${x.H}% of the population immune, ${shareText}. The town has ${prose(x.V)}, so ${closes(`${tex(x.needed)} - ${tex(x.V)}`, x.answer, 'more people must be vaccinated')} ` +
          `(Another route: $${show(x.H / 100)} \\times ${tex(x.N)} = ${tex(mustBe)}$ must be immune and $${show(x.E / 100)} \\times ${tex(x.V)} = ${tex(are)}$ already are, so ${prose(short)} more immune people are needed, and $${tex(short)} \\div ${show(x.E / 100)} = ${tex(x.answer)}$.) ` +
          `The threshold comes from how fast the disease spreads: in a population with no immunity, one person with ${h.disease} infects ${h.r0[0]} to ${h.r0[1]} others (its basic reproduction number, $R_0$), and at least $1 - 1/R_0$ of the population must be immune to stop the spread. ` +
          `Herd immunity protects the people who cannot be vaccinated and the ${100 - x.E}% in whom the vaccine did not work, because a pathogen cannot spread when most of the people it could pass to are immune.`,
        method: [
          atMost(share, 3)
            ? `divides ${x.H} by ${x.E} to find that ${show(share)}% must be vaccinated, or finds that ${prose(mustBe)} must be immune and ${prose(are)} already are`
            : `finds ${x.H}/${x.E} of ${prose(x.N)} = ${prose(x.needed)} must be vaccinated, or finds that ${prose(mustBe)} must be immune and ${prose(are)} already are`,
          `subtracts the ${prose(x.V)} already vaccinated from ${prose(x.needed)}, or divides the shortfall of ${prose(short)} by ${show(x.E / 100)}`,
        ],
        answer: x.answer,
        units: unitsOf(slot),
      },
      // Second route: the immune shortfall over the efficacy.
      { agrees: near(short / (x.E / 100), x.answer), detail: `${short} ÷ ${x.E / 100} = ${show(short / (x.E / 100))}` },
      { context: h.name, H: x.H, E: x.E, N: x.N, V: x.V },
    )
  },
}

export const healthGenerators: Generator[] = [
  bmiFromMass,
  waistToHip,
  massFromBmi,
  massToLose,
  deathsIncrease,
  waistDecrease,
  hivTuberculosis,
  screeningPercentage,
  malariaControl,
  vaccineFall,
  clearZoneWhole,
  antibodyPeaks,
  vaccineTrial,
  herdImmunity,
  clearZoneRadius,
  clearZoneDiameter,
  clearZoneRing,
  clearZoneMean,
  clearZoneShare,
]

/** For the tests. */
export const HEALTH = { BMI_PEOPLE, MASS_PEOPLE, LOSS_PEOPLE, BODIES, SHRINK, DEATHS, DECADES, INFECTIONS, CONTROLS, VACCINATED, DRUGS, DISCS, ZONE, EXPOSURES, TRIALS, HERDS, DISH }
