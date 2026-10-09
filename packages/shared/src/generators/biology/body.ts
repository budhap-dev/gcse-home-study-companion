import { clearOfHalf, fixed, roundTo, show } from '../format.ts'
import { atMost, cap, closes, figures, near, numeric, prose, tex } from '../physics/build.ts'
import { clearAtSigFigs, sfTolerance, sigFigs, sigText } from '../physics/format.ts'
import { draw, int, pick, shuffle, type Rng } from '../random.ts'
import type { Generator } from '../types.ts'
import { balanced, between, layered, list, memo, rich, trail, unitsOf, whole, withArticle, WithArticle } from './build.ts'
import { clean, distinct, evenly, noOnes, powerOfTen, range, shiftFree, tenfold, toPlaces, word } from '../chemistry/build.ts'

/**
 * The human body's coordination and control (AQA 8461, 4.2.2 and 4.5): BMI and the waist to hip
 * ratio, blood glucose and insulin, cardiac output, adrenalin, nerve impulses and the reflex arc,
 * the ruler-drop test, the pupil and colour blindness, thermoregulation, the kidney, and
 * contraception and IVF. Every numeric written slot in the nine topics has a generator here except
 * the two ruler-drop questions read from the reaction-time table (senses q4 and q12), which keep
 * their table.
 *
 * Every figure is one a person really has. Adults are 1.45 to 2.0 m tall with a BMI of 16 to 45;
 * a waist to hip ratio is 0.7 to 1.1. Resting heart rate is 50 to 100 beats per minute and stroke
 * volume 60 to 120 cm³; exercise raises the heart rate to at most about 190. Blood glucose sits at
 * about 4 to 10 mmol per litre. A myelinated neurone carries an impulse at 40 to 110 m/s, one
 * without myelin at 1 to 2 m/s; a synapse takes 0.5 to 0.9 ms. Reaction times from a ruler drop are
 * 0.15 to 0.35 s. A pupil is 2 to 4 mm across in bright light and 4.5 to 8 mm in dim light; about
 * 8% of boys and 0.5% of girls have red-green colour blindness. Skin blood flow at rest is a few
 * hundred cm³ per minute; a person sweats up to about 1.5 kg an hour, and each gram that evaporates
 * takes 2.4 kJ (the written figure). The kidneys filter 150 to 190 litres a day and return about
 * 99% of it. Typical-use pregnancy rates follow the NHS figures (about 9% a year on the pill, 6% on the
 * injection, 18% with male condoms and 12 to 29% with a diaphragm); IVF succeeds in 5
 * to 40% of cycles, falling with age.
 */
const GLUCOSE = 'blood-glucose-control-and-diabetes'
const HEART = 'the-heart-blood-vessels-and-blood'
const HORMONES = 'hormones-and-the-endocrine-system'
const NERVES = 'the-nervous-system-and-the-brain'
const SENSES = 'senses-nerves-and-reaction-time'
const EYE = 'the-eye-and-its-defects'
const THERMO = 'thermoregulation'
const KIDNEY = 'osmoregulation-and-the-kidneys'
const FERTILITY = 'the-menstrual-cycle-and-fertility'

/** A figure the working prints to 3 s.f.: exact when it is, else its first places and the rounding. */
const threeWorking = (exact: number, shown: number) => (near(exact, shown) ? show(shown) : `${trail(exact, 3)} \\approx ${sigText(shown, 3)}`)

// =============================================================================================
// Blood glucose control and diabetes
// =============================================================================================

// ---------------------------------------------------------------------------------------------
// q10, q11: BMI from mass and height, to 1 decimal place
// ---------------------------------------------------------------------------------------------

interface Band {
  name: string
  /** The BMI to 1 decimal place the band holds. */
  lo: number
  hi: number
  says: string
}
/** The NHS adult bands, in the order the turns visit them: a student cannot expect a healthy answer. */
const BANDS: Band[] = [
  { name: 'healthy', lo: 18.5, hi: 24.9, says: 'in the healthy range, 18.5 to 24.9' },
  { name: 'overweight', lo: 25, hi: 29.9, says: 'in the overweight range, 25 to 29.9' },
  { name: 'underweight', lo: 16, hi: 18.4, says: 'below 18.5, which is classed as underweight' },
  { name: 'obese', lo: 30, hi: 45, says: '30 or more, which is classed as obese' },
]
interface Adult {
  noun: string
  his: string
  he: string
  /** Heights in m the noun is used for. */
  lo: number
  hi: number
}
const ADULTS: Adult[] = [
  { noun: 'woman', his: 'her', he: 'she', lo: 1.45, hi: 1.85 },
  { noun: 'man', his: 'his', he: 'he', lo: 1.55, hi: 2.0 },
  { noun: 'person', his: 'their', he: 'they', lo: 1.45, hi: 2.0 },
]
const adultFor = (r: Rng, h: number, people = ADULTS) => pick(r, people.filter((a) => between(h, [a.lo, a.hi])))

interface Bmi {
  m: number
  h: number
  h2: number
  exact: number
  bmi: number
}
/** Whole masses of 40 to 150 kg and heights of 1.45 to 2.00 m whose BMI rounds clearly into the band. */
function bmis(b: Band): Bmi[] {
  const out: Bmi[] = []
  for (let H = 145; H <= 200; H++) {
    const h = clean(H / 100)
    const h2 = clean(h * h)
    for (let m = 40; m <= 150; m++) {
      const exact = m / h2
      const bmi = roundTo(exact, 1)
      if (!between(bmi, [b.lo, b.hi]) || !clearOfHalf(exact, 1, 0.05)) continue
      out.push({ m, h, h2, exact, bmi })
    }
  }
  return out
}

const BMI_PROMPTS = [
  (a: Adult, x: Bmi) => `A ${a.noun} has a mass of ${x.m} kg and a height of ${fixed(x.h, 2)} m. What is ${a.his} BMI, to 1 decimal place?`,
  (a: Adult, x: Bmi) => `A ${a.noun} is ${fixed(x.h, 2)} m tall and has a mass of ${x.m} kg. Using BMI = mass (kg) ÷ height (m)², calculate ${a.his} BMI to 1 decimal place.`,
  (a: Adult, x: Bmi) => `At a health check, a ${a.noun} has a mass of ${x.m} kg and a height of ${fixed(x.h, 2)} m. Calculate ${a.his} body mass index (BMI), to 1 decimal place.`,
]

/** mass ÷ height²: written as q10 (60 kg, 1.70 m, 20.8) and q11 (80 kg, 1.75 m, 26.1). */
export const bmi: Generator = {
  id: 'bmi-from-mass-and-height',
  subjectId: 'biology',
  topicId: GLUCOSE,
  replaces: ['q10', 'q11'],
  build(r, slot, turn) {
    const b = BANDS[turn % BANDS.length]!
    // The BMI first, then a height that gives it: a short person's heavy mass cannot fill a band.
    const x = layered(r, `bmi-from-mass-and-height:${b.name}`, () => bmis(b), (y) => y.bmi, (y) => y.h)
    const a = adultFor(r, x.h)
    return numeric(
      slot,
      {
        prompt: pick(r, BMI_PROMPTS)(a, x),
        solution: `$${fixed(x.h, 2)}^2 = ${show(x.h2)}$, and $${x.m} \\div ${show(x.h2)} = ${trail(x.exact, 3)}$, which is **${fixed(x.bmi, 1)}** to 1 decimal place. A BMI of ${fixed(x.bmi, 1)} is ${b.says}.`,
        method: [`squares the height: ${fixed(x.h, 2)}² = ${show(x.h2)}`, `divides the mass by ${show(x.h2)}`],
        answer: x.bmi,
        tolerance: toPlaces(x.bmi, 1),
        units: unitsOf(slot),
        line: fixed(x.bmi, 1),
      },
      // Second route: the BMI times the height squared gives the mass back, within the rounding.
      { agrees: Math.abs(x.bmi * x.h2 - x.m) <= 0.05 * x.h2 + 1e-9, detail: `${fixed(x.bmi, 1)} × ${show(x.h2)} = ${show(x.bmi * x.h2)} ≈ ${x.m}` },
      { context: b.name, m: x.m, h: x.h, bmi: x.bmi },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q12: the waist to hip ratio, to 2 decimal places
// ---------------------------------------------------------------------------------------------

interface Shape {
  name: string
  his: string
  waist: readonly [number, number]
  hips: readonly [number, number]
  ratio: readonly [number, number]
  /** The WHO ratio at or above which the risk of type 2 diabetes and heart disease is raised. */
  risk: number
}
const SHAPES: Shape[] = [
  { name: 'woman', his: 'her', waist: [62, 105], hips: [85, 125], ratio: [0.7, 0.98], risk: 0.85 },
  { name: 'man', his: 'his', waist: [72, 120], hips: [88, 118], ratio: [0.8, 1.12], risk: 0.9 },
]
interface Ratio {
  w: number
  p: number
  exact: number
  ratio: number
}
/**
 * Whole-centimetre waists and hips whose ratio rounds clearly to 2 places inside the range, never
 * the WHO threshold itself, never 1.00, never hips of 100 cm (the waist with the point moved) and never the waist or hips with the
 * point moved.
 */
function ratios(s: Shape): Ratio[] {
  const out: Ratio[] = []
  for (let w = s.waist[0]; w <= s.waist[1]; w++) {
    for (let p = s.hips[0]; p <= s.hips[1]; p++) {
      const exact = w / p
      const ratio = roundTo(exact, 2)
      if (w === p || p === 100 || near(ratio, 1) || !between(ratio, s.ratio) || !clearOfHalf(exact, 2, 0.05)) continue
      // Never a ratio that rounds to the WHO threshold (0.849 is 0.85 to 2 places but below it), so "at or above" is never in doubt.
      if (tenfold(ratio, w) || tenfold(ratio, p) || near(ratio, s.risk)) continue
      out.push({ w, p, exact, ratio })
    }
  }
  return out
}
const RATIO_PROMPTS = [
  (s: Shape, x: Ratio) => `A ${s.name} has a waist of ${x.w} cm and hips of ${x.p} cm. What is ${s.his} waist to hip ratio, to 2 decimal places?`,
  (s: Shape, x: Ratio) => `A ${s.name}'s waist measures ${x.w} cm and ${s.his} hips measure ${x.p} cm. Calculate ${s.his} waist to hip ratio, to 2 decimal places.`,
]

/** waist ÷ hips: written as q12 (100 cm and 90 cm, 1.11). */
export const waistToHip: Generator = {
  id: 'waist-to-hip-ratio',
  subjectId: 'biology',
  topicId: GLUCOSE,
  replaces: ['q12'],
  build(r, slot, turn) {
    const s = SHAPES[turn % SHAPES.length]!
    const x = layered(r, `waist-to-hip-ratio:${s.name}`, () => ratios(s), (y) => y.ratio, (y) => y.w)
    const above = x.ratio >= s.risk - 1e-9
    return numeric(
      slot,
      {
        prompt: pick(r, RATIO_PROMPTS)(s, x),
        solution:
          `$${x.w} \\div ${x.p} = ${trail(x.exact, 4)}$, which is **${fixed(x.ratio, 2)}** to 2 decimal places. Both are in cm, so the ratio has no units. ` +
          `For a ${s.name}, a ratio of ${fixed(s.risk, 2)} or more means more fat is carried around the abdomen, which raises the risk of type 2 diabetes and heart disease; ${fixed(x.ratio, 2)} is ${above ? 'at or above' : 'below'} that.`,
        method: ['divides the waist by the hip measurement'],
        answer: x.ratio,
        tolerance: toPlaces(x.ratio, 2),
        units: unitsOf(slot),
        line: fixed(x.ratio, 2),
      },
      // Second route: the ratio times the hips gives the waist back, within the rounding.
      { agrees: Math.abs(x.ratio * x.p - x.w) <= 0.005 * x.p + 1e-9, detail: `${fixed(x.ratio, 2)} × ${x.p} = ${show(x.ratio * x.p)} ≈ ${x.w}` },
      { context: s.name, w: x.w, p: x.p, ratio: x.ratio, above: above ? 'yes' : 'no' },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q25: the percentage fall in blood glucose as insulin acts
// ---------------------------------------------------------------------------------------------

interface Fall {
  name: string
  /** Blood glucose before and after, in mmol per litre. */
  before: readonly [number, number]
  after: readonly [number, number]
  prompt: (x: Drop, u: string, r: Rng) => string
  why: string
}
interface Drop {
  b: number
  a: number
  d: number
  /** The percentage unrounded, and to 3 s.f. */
  exact: number
  p: number
}
const INSULIN = 'moving glucose from the blood into cells and by making the liver and muscles convert glucose into glycogen'
const FALLS: Fall[] = [
  {
    name: 'after a meal',
    before: [6.5, 8.5],
    after: [4.3, 5.8],
    prompt: (x, u, r) =>
      `${pick(r, ['Thirty minutes', 'Forty-five minutes'])} after a meal a person's blood glucose concentration was ${fixed(x.b, 1)} ${u}. Two hours later, after insulin had acted, it was ${fixed(x.a, 1)} ${u}. Calculate the percentage decrease in blood glucose concentration over those two hours.`,
    why: `Insulin from the pancreas brought the level down by ${INSULIN}.`,
  },
  {
    name: 'glucose tolerance test',
    before: [7, 9.5],
    after: [4.5, 6.5],
    prompt: (x, u) =>
      `In a glucose tolerance test, a person drinks a glucose solution. An hour later their blood glucose concentration is ${fixed(x.b, 1)} ${u}; an hour after that, as insulin acts, it has fallen to ${fixed(x.a, 1)} ${u}. Calculate the percentage decrease in blood glucose concentration over that hour.`,
    why: `Insulin from the pancreas brought the level down by ${INSULIN}; in a person with diabetes the level would fall far less.`,
  },
  {
    name: 'type 1 injection',
    before: [8, 10],
    after: [4.5, 7],
    prompt: (x, u, r) =>
      `A person with type 1 diabetes finds that their blood glucose concentration is ${fixed(x.b, 1)} ${u}, higher than it should be, so they inject insulin. ${pick(r, ['Two hours', 'Ninety minutes'])} later it is ${fixed(x.a, 1)} ${u}. Calculate the percentage decrease in blood glucose concentration.`,
    why: 'The pancreas of a person with type 1 diabetes makes little or no insulin, so the injected insulin did the work, moving glucose from the blood into cells and making the liver and muscles convert glucose into glycogen.',
  },
]
/**
 * Readings to 0.1, a fall of at least 1.0, and a percentage whose 3 s.f. rounding is clear and is
 * none of the readings with the point moved, nor within a point of 50%. Only exact percentages left too few starting values:
 * 8.0 filled half a context, since 10.0 makes the answer the fall with the point moved.
 */
function drops(f: Fall): Drop[] {
  const out: Drop[] = []
  for (const b of range(f.before[0], f.before[1], 0.1)) {
    for (const a of range(f.after[0], f.after[1], 0.1)) {
      const d = clean(b - a)
      const exact = (d / b) * 100
      const p = sigFigs(exact, 3)
      // Never a fall to about half, where the percentage left is the answer too.
      if (d < 1 || Math.abs(exact - 50) < 1 || !clearAtSigFigs(exact, 3, 0.1) || !shiftFree(p, b, a, d)) continue
      out.push({ b, a, d, exact, p })
    }
  }
  return out
}

/** (before − after) ÷ before × 100: written as q25 (7.5 to 5.1 mmol per litre, 32%). */
export const glucoseFall: Generator = {
  id: 'blood-glucose-percentage-fall',
  subjectId: 'biology',
  topicId: GLUCOSE,
  replaces: ['q25'],
  build(r, slot, turn) {
    const f = FALLS[turn % FALLS.length]!
    // The starting value first, then the answer: drawing the answer alone let 8.0 and 10.0, which divide cleanly, fill two thirds of a context.
    const x = layered(r, `blood-glucose-percentage-fall:${f.name}`, () => rich(drops(f), (y) => y.b, (y) => y.p, 3), (y) => y.b, (y) => y.p)
    const u = pick(r, ['mmol per litre', 'mmol/dm³'])
    return numeric(
      slot,
      {
        prompt: f.prompt(x, u, r),
        solution:
          `Decrease $= ${fixed(x.b, 1)} - ${fixed(x.a, 1)} = ${fixed(x.d, 1)}$ ${u}. As a percentage of the starting value, $\\dfrac{${fixed(x.d, 1)}}{${fixed(x.b, 1)}} \\times 100 = ${near(x.exact, x.p) ? show(x.p) : `${trail(x.exact, 3)} = ${sigText(x.p, 3)}`}\\%$${near(x.exact, x.p) ? '' : ' to 3 significant figures'}. ` +
          `Divide by the value before the fall, ${fixed(x.b, 1)}, not the value after it. ${f.why}`,
        method: [`finds the decrease, ${fixed(x.d, 1)}, and divides it by the starting value of ${fixed(x.b, 1)}`],
        answer: x.p,
        // The 3 s.f. answer, wide enough for the unrounded one.
        tolerance: sfTolerance(x.p, 3),
        units: unitsOf(slot),
      },
      // Second route: the starting value less the percentage gives the later value, within the rounding.
      { agrees: Math.abs((x.b * (100 - x.p)) / 100 - x.a) <= (x.b * sfTolerance(x.p, 3)) / 100 + 1e-9, detail: `${x.b} × ${show(1 - x.p / 100)} = ${show((x.b * (100 - x.p)) / 100)} ≈ ${x.a}` },
      { context: f.name, b: x.b, a: x.a, p: x.p },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q26: the mass to lose to bring a BMI down to a target
// ---------------------------------------------------------------------------------------------

interface Target {
  name: string
  to: number
  /** The BMI now, to 1 decimal place. */
  from: readonly [number, number]
  aim: (his: string) => string
}
const TARGETS: Target[] = [
  { name: 'down to 25', to: 25, from: [27, 35], aim: (his) => `to reduce ${his} risk of type 2 diabetes` },
  { name: 'down to 30', to: 30, from: [32, 42], aim: (his) => `as a first step, to reduce ${his} risk of type 2 diabetes` },
]
interface Loss {
  b1: number
  h: number
  h2: number
  d: number
  /** The two masses and the loss unrounded, and to 0.1 kg. */
  m1: number
  m2: number
  exact: number
  r1: number
  r2: number
  loss: number
}
/**
 * Heights of 1.50 to 1.95 m and a BMI now to 0.1, a fall of at least 2.0, and a loss of 10 to 40 kg
 * whose rounding to 0.1 kg (its third figure) is clear and is exactly what the two masses rounded
 * to 0.1 kg give, so the working can print masses as a scale shows them.
 */
function losses(t: Target): Loss[] {
  const out: Loss[] = []
  for (let H = 150; H <= 195; H++) {
    const h = clean(H / 100)
    const h2 = clean(h * h)
    for (const b1 of range(t.from[0], t.from[1], 0.1)) {
      const d = clean(b1 - t.to)
      if (d < 2) continue
      const m1 = clean(b1 * h2)
      const m2 = clean(t.to * h2)
      const exact = clean(m1 - m2)
      const loss = roundTo(exact, 1)
      const [r1, r2] = [roundTo(m1, 1), roundTo(m2, 1)]
      if (exact < 10 || exact > 40 || !clearOfHalf(exact, 1, 0.1) || !clearOfHalf(m1, 1, 0.1) || !clearOfHalf(m2, 1, 0.1) || !near(clean(r1 - r2), loss)) continue
      // Never the BMI, the target, the fall or the height with the point moved, doubled or halved: 18.9 kg at 1.89 m.
      if (!shiftFree(loss, b1, t.to, h, d)) continue
      out.push({ b1, h, h2, d, m1, m2, exact, r1, r2, loss })
    }
  }
  return out
}

const MEN_AND_WOMEN = ADULTS.filter((a) => a.noun !== 'person')

/** BMI × height² before and after: written as q26 (30.0 to 25.0 at 1.80 m, 16.2 kg). */
export const bmiLoss: Generator = {
  id: 'bmi-mass-to-lose',
  subjectId: 'biology',
  topicId: GLUCOSE,
  replaces: ['q26'],
  build(r, slot, turn) {
    const t = TARGETS[turn % TARGETS.length]!
    const x = layered(r, `bmi-mass-to-lose:${t.name}`, () => losses(t), (y) => y.d, (y) => y.h)
    const a = adultFor(r, x.h, MEN_AND_WOMEN)
    const kg = (m: number, r: number) => (near(m, r) ? `${fixed(r, 1)}` : `${trail(m, 2)} = ${fixed(r, 1)}`)
    return numeric(
      slot,
      {
        prompt:
          `A ${a.noun} has a BMI of ${fixed(x.b1, 1)} and a height of ${fixed(x.h, 2)} m. ${a.he === 'she' ? 'She wants' : 'He wants'} to bring ${a.his} BMI down to ${fixed(t.to, 1)} ${t.aim(a.his)}. ` +
          `Using BMI = mass (kg) ÷ height (m)², calculate the mass ${a.he} must lose, in kg.`,
        solution:
          `Rearrange: mass = BMI × height². Height squared: $${fixed(x.h, 2)}^2 = ${show(x.h2)}$. Mass now: $${fixed(x.b1, 1)} \\times ${show(x.h2)} = ${kg(x.m1, x.r1)}$ kg. ` +
          `Mass at a BMI of ${fixed(t.to, 1)}: $${fixed(t.to, 1)} \\times ${show(x.h2)} = ${kg(x.m2, x.r2)}$ kg. Mass to lose: $${fixed(x.r1, 1)} - ${fixed(x.r2, 1)} = ${show(x.loss)}$ kg. ` +
          `(The shortcut: a fall of ${fixed(x.d, 1)} in BMI $\\times ${show(x.h2)} = ${kg(x.exact, x.loss)}$ kg, the same answer.) ` +
          'Obesity is a risk factor for type 2 diabetes, so lowering BMI lowers the risk, though BMI says nothing about where the fat is carried, which is why the waist to hip ratio is used as well.',
        method: [`squares the height, ${show(x.h2)}, and rearranges to mass = BMI × height²`, `finds ${fixed(x.r1, 1)} kg and ${fixed(x.r2, 1)} kg (or ${fixed(x.d, 1)} × ${show(x.h2)})`],
        answer: x.loss,
        // Half a unit in the first decimal place, wide enough for the unrounded loss.
        tolerance: toPlaces(x.loss, 1),
        units: unitsOf(slot),
      },
      // Second route: the fall in BMI times the height squared.
      { agrees: near(roundTo(x.d * x.h2, 1), x.loss), detail: `${fixed(x.d, 1)} × ${show(x.h2)} = ${show(x.d * x.h2)}` },
      { context: t.name, b1: x.b1, h: x.h, d: x.d, loss: x.loss },
    )
  },
}

// =============================================================================================
// The heart: cardiac output = stroke volume × heart rate
// =============================================================================================

/** A resting adult's cardiac output, in cm³/min. */
const REST_OUTPUT = [4000, 7000] as const

interface Pumping {
  name: string
  hr: readonly [number, number]
  sv: readonly [number, number]
}

// ---------------------------------------------------------------------------------------------
// q5: cardiac output from stroke volume and heart rate
// ---------------------------------------------------------------------------------------------

interface Output extends Pumping {
  prompt: (sv: number, hr: number, r: Rng) => string
  note: string
}
const OUTPUTS: Output[] = [
  {
    name: 'at rest',
    hr: [55, 95],
    sv: [60, 95],
    prompt: (sv, hr, r) =>
      pick(r, [
        `A person has a stroke volume of ${sv} cm³ and a heart rate of ${hr} beats per minute. Calculate their cardiac output, in cm³/min.`,
        `A person sitting at rest has a heart rate of ${hr} beats per minute and a stroke volume of ${sv} cm³. Calculate their cardiac output, in cm³/min.`,
      ]),
    note: 'A resting adult pumps about five litres of blood a minute, roughly all of the blood in the body.',
  },
  {
    name: 'athlete at rest',
    hr: [50, 60],
    sv: [90, 120],
    prompt: (sv, hr) => `A trained athlete at rest has a heart rate of ${hr} beats per minute and a stroke volume of ${sv} cm³. Calculate the athlete's cardiac output, in cm³/min.`,
    note: 'Training makes the heart muscle stronger, so it pumps more with each beat and can supply the body at rest with fewer beats.',
  },
  {
    name: 'exercise',
    hr: [120, 190],
    sv: [90, 120],
    prompt: (sv, hr) => `During hard exercise, a person's heart rate is ${hr} beats per minute and their stroke volume is ${sv} cm³. Calculate their cardiac output, in cm³/min.`,
    note: 'During exercise the heart beats faster and pumps more with each beat, delivering more oxygen and glucose to the muscles for respiration.',
  },
]

/** stroke volume × heart rate: written as q5 (80 cm³ at 70 beats per minute, 5600 cm³/min). */
export const cardiacOutput: Generator = {
  id: 'cardiac-output',
  subjectId: 'biology',
  topicId: HEART,
  replaces: ['q5'],
  build(r, slot, turn) {
    const c = OUTPUTS[turn % OUTPUTS.length]!
    // A resting output of 4 to 7 litres a minute, exact (tolerance 0, as written). Keeping only outputs of three figures, as
    // the written 5600, let one stroke volume fill half the exercising builds.
    const pool = () =>
      range(c.hr[0], c.hr[1]).flatMap((h) =>
        range(c.sv[0], c.sv[1])
          .filter((s) => distinct(s, h) && !powerOfTen(s) && !powerOfTen(h) && (c.name === 'exercise' || between(s * h, REST_OUTPUT)))
          .map((s) => [s, h] as const),
      )
    const [sv, hr] = layered(r, `cardiac-output:${c.name}`, pool, ([, h]) => h, ([s]) => s)
    const co = sv * hr
    return numeric(
      slot,
      {
        prompt: c.prompt(sv, hr, r),
        solution: `${closes(`${sv} \\times ${hr}`, co, 'cm³/min')} The beats cancel, leaving cubic centimetres per minute. ${c.note}`,
        method: ['multiplies stroke volume by heart rate'],
        answer: co,
        tolerance: 0,
        units: unitsOf(slot),
        line: `${prose(co)} cm³/min`,
      },
      // Second route: the output shared among the beats gives the stroke volume back.
      { agrees: near(co / hr, sv), detail: `${co} ÷ ${hr} = ${show(co / hr)}` },
      { context: c.name, sv, hr, co },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q12: the increase in stroke volume during exercise
// ---------------------------------------------------------------------------------------------

interface Effort {
  name: string
  doing: string
  hr: readonly [number, number]
}
const EFFORTS: Effort[] = [
  { name: 'light', doing: 'walking briskly', hr: [90, 115] },
  { name: 'moderate', doing: 'jogging', hr: [120, 155] },
  { name: 'hard', doing: 'running hard', hr: [160, 185] },
]

/** cardiac output ÷ heart rate, less the resting stroke volume: written as q12 (70 cm³; 7200 at 90, 10 cm³). */
export const strokeVolumeRise: Generator = {
  id: 'stroke-volume-increase',
  subjectId: 'biology',
  topicId: HEART,
  replaces: ['q12'],
  build(r, slot, turn) {
    const e = EFFORTS[turn % EFFORTS.length]!
    // The increase first, evenly, then a resting volume that leaves room for it under 120 cm³.
    const [inc, rest, hr] = draw(
      r,
      () => {
        const i = int(r, 5, 35)
        return [i, int(r, 60, Math.min(95, 120 - i)), int(r, e.hr[0], e.hr[1])] as const
      },
      // The stroke volume rises by at most half during exercise.
      ([i, s, h]) => distinct(s, h, s + i) && distinct(i, s, h) && shiftFree(i, s, h, s + i) && !powerOfTen(h) && s + i <= 1.5 * s,
    )
    const ex = rest + inc
    const co = ex * hr
    const prompts = [
      `At rest, a person has a stroke volume of ${rest} cm³. During exercise their cardiac output is ${prose(co)} cm³/min at a heart rate of ${hr} beats per minute. Calculate how much their stroke volume has increased, in cm³.`,
      `A person's stroke volume at rest is ${rest} cm³. While ${e.doing}, their heart rate is ${hr} beats per minute and their cardiac output is ${prose(co)} cm³/min. Calculate the increase in their stroke volume, in cm³.`,
    ]
    return numeric(
      slot,
      {
        prompt: pick(r, prompts),
        solution:
          `Stroke volume during exercise $= \\dfrac{${tex(co)}}{${hr}} = ${ex}$ cm³ per beat. Dividing cm³ per minute by beats per minute leaves cm³ per beat, which checks the rearrangement. ` +
          `The increase is $${ex} - ${rest} = ${inc}$ cm³: during exercise the heart pumps more with each beat as well as beating faster.`,
        method: [`divides cardiac output by heart rate to get ${ex} cm³`],
        answer: inc,
        tolerance: 0,
        units: unitsOf(slot),
      },
      // Second route: the resting volume plus the increase, times the heart rate, is the output.
      { agrees: (rest + inc) * hr === co, detail: `(${rest} + ${inc}) × ${hr} = ${(rest + inc) * hr}` },
      { context: e.name, rest, hr, co, inc },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q19: heart rate from cardiac output and stroke volume
// ---------------------------------------------------------------------------------------------

interface Rating extends Pumping {
  lead: string
}
const RATINGS: Rating[] = [
  { name: 'at rest', hr: [55, 95], sv: [60, 95], lead: 'At rest, a person' },
  { name: 'exercise', hr: [110, 185], sv: [85, 120], lead: 'During exercise, a person' },
]

/** cardiac output ÷ stroke volume: written as q19 (6000 cm³/min and 75 cm³, 80 beats per minute). */
export const heartRateFromOutput: Generator = {
  id: 'heart-rate-from-cardiac-output',
  subjectId: 'biology',
  topicId: HEART,
  replaces: ['q19'],
  build(r, slot, turn) {
    const c = RATINGS[turn % RATINGS.length]!
    const [hr, sv] = draw(
      r,
      () => [int(r, c.hr[0], c.hr[1]), int(r, c.sv[0], c.sv[1])] as const,
      ([h, s]) => distinct(h, s) && !powerOfTen(s) && !powerOfTen(h) && (c.name === 'exercise' || between(h * s, REST_OUTPUT)),
    )
    const co = hr * sv
    return numeric(
      slot,
      {
        prompt: `${pick(r, [c.lead, 'A person'])} has a cardiac output of ${prose(co)} cm³/min and a stroke volume of ${sv} cm³. Calculate their heart rate, in beats per minute.`,
        solution:
          `$\\text{heart rate} = \\dfrac{\\text{cardiac output}}{\\text{stroke volume}} = \\dfrac{${tex(co)}}{${sv}} = ${hr}$ beats per minute. ` +
          'Dividing cm³ per minute by cm³ per beat leaves beats per minute, which checks the rearrangement.',
        method: ['divides cardiac output by stroke volume'],
        answer: hr,
        tolerance: 0,
        units: unitsOf(slot),
      },
      // Second route: the heart rate times the stroke volume gives the output back.
      { agrees: hr * sv === co, detail: `${hr} × ${sv} = ${hr * sv}` },
      { context: c.name, hr, sv, co },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q25: the percentage increase in cardiac output during exercise
// ---------------------------------------------------------------------------------------------

interface Rise {
  name: string
  during: string
  /** The percentage increases it allows. */
  p: readonly [number, number]
}
const RISES: Rise[] = [
  { name: 'brisk walk', during: 'During a brisk walk', p: [40, 100] },
  { name: 'steady jog', during: 'During a steady jog', p: [101, 200] },
  { name: 'hard run', during: 'During a hard run', p: [201, 300] },
]
interface Increase {
  a: number
  b: number
  d: number
  p: number
}
/**
 * Increases from a multiple of `step` to a multiple of `to`, by a whole percentage in the range: no
 * figure is the percentage with the point moved, doubled or halved.
 */
function increases(lo: number, hi: number, step: number, to: number, p: readonly [number, number], top: number): Increase[] {
  const out: Increase[] = []
  for (let a = lo; a <= hi; a += step) {
    for (let q = p[0]; q <= p[1]; q++) {
      const b = (a * (100 + q)) / 100
      if (!whole(b / to) || b > top) continue
      const d = b - a
      if (!shiftFree(q, a, b, d)) continue
      out.push({ a, b, d, p: q })
    }
  }
  return out
}

/** (exercise − rest) ÷ rest × 100: written as q25 (5600 to 12 600 cm³/min, 125%). */
export const outputIncrease: Generator = {
  id: 'cardiac-output-percentage-increase',
  subjectId: 'biology',
  topicId: HEART,
  replaces: ['q25'],
  build(r, slot, turn) {
    const c = RISES[turn % RISES.length]!
    // A resting output of 4200 to 7200 cm³/min (60 to 80 beats of 70 to 90 cm³) to the nearest 100, an exercising one to the
    // nearest 10, at most 22 800. The resting output first: drawing the percentage alone let 5000 fill half a context.
    const x = layered(r, `cardiac-output-percentage-increase:${c.name}`, () => rich(increases(4200, 7200, 100, 10, c.p, 22800), (y) => y.a, (y) => y.p, 8), (y) => y.a, (y) => y.p)
    const k = clean(x.b / x.a)
    return numeric(
      slot,
      {
        prompt: `At rest, a person's cardiac output is ${prose(x.a)} cm³/min. ${c.during} it rises to ${prose(x.b)} cm³/min. Calculate the percentage increase in cardiac output.`,
        solution:
          `Increase $= ${tex(x.b)} - ${tex(x.a)} = ${tex(x.d)}$ cm³/min. Percentage increase $= \\dfrac{${tex(x.d)}}{${tex(x.a)}} \\times 100 = ${x.p}$ %. ` +
          `The output has become ${show(k)} times what it was, which is an increase of ${x.p} %, not ${100 + x.p} %: the percentage change is the **change** divided by the original.`,
        method: [`increase of ${prose(x.d)} divided by the resting ${prose(x.a)}, × 100`],
        answer: x.p,
        tolerance: 0,
        units: unitsOf(slot),
      },
      // Second route: the resting output grown by the percentage is the exercising one.
      { agrees: near((x.a * (100 + x.p)) / 100, x.b), detail: `${x.a} × ${show(1 + x.p / 100)} = ${show((x.a * (100 + x.p)) / 100)}` },
      { context: c.name, rest: x.a, exercise: x.b, p: x.p },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q26: how many times greater the cardiac output is during exercise
// ---------------------------------------------------------------------------------------------

interface Session {
  name: string
  hr: readonly [number, number]
}
const SESSIONS: Session[] = [
  { name: 'cycling', hr: [110, 150] },
  { name: 'running', hr: [140, 175] },
  { name: 'sprint training', hr: [165, 190] },
]
interface Times {
  hr1: number
  sv1: number
  hr2: number
  sv2: number
  k: number
  s: number
  co1: number
  co2: number
  ratio: number
}
/**
 * Resting rates of 55 to 90 and volumes of 60 to 90 cm³, a resting output of 4000 to 7000 cm³/min;
 * exercising volumes at least 6 cm³ more, at most 120 and at most 1.5 times the resting volume. The heart rate's factor exact to 2 places (the student's claim prints it), the
 * stroke volume's to 3, and the output's to 2 with at most three figures, never the heart rate's
 * factor, the stroke volume's, nor their sum (a student who adds them).
 */
function times(s: Session): Times[] {
  const out: Times[] = []
  for (let hr1 = 55; hr1 <= 90; hr1++) {
    for (let hr2 = s.hr[0]; hr2 <= s.hr[1]; hr2++) {
      const k = clean(hr2 / hr1)
      if (!atMost(k, 2)) continue
      for (let sv1 = 60; sv1 <= 90; sv1++) {
        if (hr1 * sv1 < 4000 || hr1 * sv1 > 7000) continue
        for (let sv2 = sv1 + 6; sv2 <= Math.min(120, 1.5 * sv1); sv2++) {
          const f = clean(sv2 / sv1)
          const ratio = clean(k * f)
          if (!atMost(f, 3) || !atMost(ratio, 2) || figures(ratio) > 3) continue
          if (!distinct(hr1, sv1, hr2, sv2) || near(ratio, k + f) || !shiftFree(ratio, hr1, sv1, hr2, sv2)) continue
          out.push({ hr1, sv1, hr2, sv2, k, s: f, co1: hr1 * sv1, co2: hr2 * sv2, ratio })
        }
      }
    }
  }
  return out
}

/** (exercising SV × HR) ÷ (resting SV × HR): written as q26 (72 × 75 and 90 × 150, 2.5). */
export const outputRatio: Generator = {
  id: 'cardiac-output-ratio',
  subjectId: 'biology',
  topicId: HEART,
  replaces: ['q26'],
  build(r, slot, turn) {
    const c = SESSIONS[turn % SESSIONS.length]!
    // The resting volume, then the ratio, then the resting rate: a balanced draw let 75 cm³, which gives clean factors, fill a
    // quarter of a context.
    const x = layered(r, `cardiac-output-ratio:${c.name}`, () => rich(times(c), (y) => y.sv1, (y) => y.ratio, 5), (y) => y.sv1, (y) => y.ratio, (y) => y.hr1)
    const claim = x.k === 2 ? 'has doubled, because the heart rate has doubled' : `is ${show(x.k)} times as great, because the heart rate is ${show(x.k)} times as great`
    return numeric(
      slot,
      {
        prompt:
          `At rest a person has a heart rate of ${x.hr1} beats per minute and a stroke volume of ${x.sv1} cm³. During ${c.name} the heart rate rises to ${x.hr2} beats per minute and the stroke volume to ${x.sv2} cm³. ` +
          `Cardiac output = stroke volume × heart rate. A student says the cardiac output ${claim}. Calculate how many times greater the cardiac output is during exercise than at rest.`,
        solution:
          `Rest: cardiac output $= ${x.sv1} \\times ${x.hr1} = ${tex(x.co1)}$ cm³/min. Exercise: $${x.sv2} \\times ${x.hr2} = ${tex(x.co2)}$ cm³/min. $\\dfrac{${tex(x.co2)}}{${tex(x.co1)}} = ${show(x.ratio)}$. ` +
          `The student forgot the **stroke volume**: cardiac output is stroke volume **times** heart rate, so a heart that beats ${x.k === 2 ? 'twice' : `${show(x.k)} times`} as fast *and* pumps ${show(x.s)} times as much with each beat ($${x.sv2} \\div ${x.sv1} = ${show(x.s)}$) ` +
          `delivers $${show(x.k)} \\times ${show(x.s)} = ${show(x.ratio)}$ times as much blood each minute.`,
        method: [`both cardiac outputs: ${prose(x.co1)} and ${prose(x.co2)} cm³/min`, 'divides the exercise output by the resting output'],
        answer: x.ratio,
        tolerance: 0,
        units: unitsOf(slot),
      },
      // Second route: the heart rate's factor times the stroke volume's.
      { agrees: near(x.k * x.s, x.ratio) && near(x.co2 / x.co1, x.ratio), detail: `${show(x.k)} × ${show(x.s)} = ${show(x.k * x.s)}` },
      { context: c.name, hr1: x.hr1, sv1: x.sv1, hr2: x.hr2, sv2: x.sv2, ratio: x.ratio },
    )
  },
}

// =============================================================================================
// Hormones: adrenalin
// =============================================================================================

interface Shock {
  name: string
  what: string
  /** The thing, for "the reading before the noise". */
  short: string
}
const SHOCKS: Shock[] = [
  { name: 'loud noise', what: 'hears a sudden loud noise', short: 'noise' },
  { name: 'fire alarm', what: 'is startled by a fire alarm going off', short: 'alarm' },
  { name: 'balloon', what: 'jumps when a balloon bursts behind them', short: 'balloon burst' },
]

// ---------------------------------------------------------------------------------------------
// q20: the percentage increase in heart rate from a table of readings
// ---------------------------------------------------------------------------------------------

interface Jump {
  h0: number
  h1: number
  d: number
  /** The percentage unrounded, and to 3 s.f. */
  exact: number
  p: number
}
/**
 * Any resting rate of 62 to 82 rising by 25 to 65% to at most 130, the percentage to 3 s.f. with a
 * clear rounding. Exact percentages left five resting rates, and 50, 37.5, 62.5 and 25 were half the answers.
 */
const JUMPS = memo('adrenalin-heart-rate-table:jumps', () => {
  const out: Jump[] = []
  for (let h0 = 62; h0 <= 82; h0++) {
    for (let h1 = h0 + 1; h1 <= 130; h1++) {
      const d = h1 - h0
      const exact = (d / h0) * 100
      const p = sigFigs(exact, 3)
      if (exact < 25 || exact > 65 || !clearAtSigFigs(exact, 3, 0.1) || !shiftFree(p, h0, h1, d)) continue
      out.push({ h0, h1, d, exact, p })
    }
  }
  return out
})

interface Table {
  /** The reading at which the event's effect first shows. */
  at: number
  minute: number
  hr: number[]
  glucose: number[]
}
/**
 * Six readings five minutes apart. Before the event the heart rate wobbles by at most 2 beats
 * about the last resting reading and glucose by 1; at the first reading after it the heart rate
 * peaks, and then falls back without reaching rest; glucose rises 18 to 30 at the first reading
 * after, peaks 4 to 9 higher at the next, then falls. The percentage is none of the figures.
 */
function table(r: Rng, x: Jump): Table {
  return draw(
    r,
    () => {
      const last = int(r, 1, 3)
      const minute = 5 * last + int(r, 1, 4)
      const hr: number[] = []
      const glucose: number[] = []
      const g0 = int(r, 84, 96)
      for (let i = 0; i <= last; i++) {
        hr.push(i === last ? x.h0 : x.h0 + int(r, -2, 2))
        glucose.push(i === last ? g0 : g0 + int(r, -1, 1))
      }
      hr.push(x.h1)
      const g1 = g0 + int(r, 18, 30)
      glucose.push(g1)
      let h = x.h1
      let g = g1 + int(r, 4, 9)
      for (let i = last + 2; i <= 5; i++) {
        h = h - int(r, Math.max(3, Math.round(x.d / 6)), Math.max(4, Math.round(x.d / 3)))
        hr.push(h)
        glucose.push(g)
        g -= int(r, 6, 12)
      }
      return { at: last + 1, minute, hr, glucose }
    },
    (t) =>
      t.hr.slice(t.at + 1).every((h) => h > x.h0 + 3) &&
      new Set(t.hr.slice(0, t.at)).size > 1 &&
      t.glucose.slice(t.at + 1).every((g) => g > t.glucose[t.at - 1]! + 5) &&
      ![...t.hr, ...t.glucose].some((v) => tenfold(v, x.p)),
  )
}

/** (after − before) ÷ before × 100 from a table: written as q20 (70 to 105 beats/min, 50%). */
export const adrenalinTable: Generator = {
  id: 'adrenalin-heart-rate-table',
  subjectId: 'biology',
  topicId: HORMONES,
  replaces: ['q20'],
  build(r, slot, turn) {
    const s = SHOCKS[turn % SHOCKS.length]!
    // The resting rate first, then the peak.
    const x = layered(r, 'adrenalin-heart-rate-table', JUMPS, (y) => y.h0, (y) => y.h1)
    const t = table(r, x)
    const rows = t.hr.map((h, i) => `| ${5 * i} | ${h} | ${t.glucose[i]} |`).join('\n')
    const before = 5 * (t.at - 1)
    return numeric(
      slot,
      {
        prompt:
          `A person sitting quietly ${s.what} at ${t.minute} minutes, and adrenalin is released into their blood. Their heart rate and blood glucose concentration were measured every 5 minutes. The figures are illustrative.\n\n` +
          `| Time (min) | Heart rate (beats/min) | Blood glucose (mg per 100 cm³) |\n|---|---|---|\n${rows}\n\n` +
          `Calculate the percentage increase in heart rate between the readings at ${before} minutes and ${before + 5} minutes.`,
        solution: `Increase $= ${x.h1} - ${x.h0} = ${x.d}$ beats/min. $\\dfrac{${x.d}}{${x.h0}} \\times 100 = ${near(x.exact, x.p) ? show(x.p) : `${trail(x.exact, 3)} = ${sigText(x.p, 3)}`}\\%$${near(x.exact, x.p) ? '' : ' to 3 significant figures'}. Divide by the **starting** value, the reading before the ${s.short}.`,
        method: [`${x.d} ÷ ${x.h0} × 100`],
        answer: x.p,
        // The 3 s.f. answer, wide enough for the unrounded one.
        tolerance: sfTolerance(x.p, 3),
        units: unitsOf(slot),
      },
      // Second route: the resting rate grown by the percentage is the peak, within the rounding.
      { agrees: Math.abs((x.h0 * (100 + x.p)) / 100 - x.h1) <= (x.h0 * sfTolerance(x.p, 3)) / 100 + 1e-9, detail: `${x.h0} × ${show(1 + x.p / 100)} = ${show((x.h0 * (100 + x.p)) / 100)}` },
      { context: s.name, h0: x.h0, h1: x.h1, p: x.p, minute: t.minute },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q28: heart rate from a pulse count
// ---------------------------------------------------------------------------------------------

interface Count {
  secs: number
  times: number
}
const COUNTS: Count[] = [
  { secs: 15, times: 4 },
  { secs: 10, times: 6 },
  { secs: 20, times: 3 },
]
const STARTLES = [
  'startled by a loud bang',
  'given a fright when a friend jumps out from behind a door',
  'startled by a fire alarm going off',
  'startled when a door slams behind them',
  'given a fright by a dog barking suddenly at the gate',
]

/** count × (60 ÷ seconds): written as q28 (27 beats in 15 seconds, 108). */
export const pulseCount: Generator = {
  id: 'heart-rate-from-pulse-count',
  subjectId: 'biology',
  topicId: HORMONES,
  replaces: ['q28'],
  build(r, slot, turn) {
    const c = COUNTS[turn % COUNTS.length]!
    // A startled heart rate of 90 to 150, a whole number of beats in the count.
    const hr = draw(r, () => c.times * int(r, Math.ceil(90 / c.times), Math.floor(150 / c.times)), (h) => h / c.times !== c.secs)
    const n = hr / c.times
    return numeric(
      slot,
      {
        prompt: `A student is ${pick(r, STARTLES)}. A friend immediately counts the student's pulse for ${c.secs} seconds and counts ${n} beats. Calculate the student's heart rate in beats per minute.`,
        solution:
          `There are ${word(c.times)} lots of ${c.secs} seconds in a minute, so $${n} \\times ${c.times} = ${hr}$ beats per minute. (Or $\\dfrac{${n}}{${c.secs}} \\times 60 = ${hr}$.) ` +
          'An increased heart rate is one of the effects of adrenalin, released by the adrenal glands to prepare the body for fight or flight.',
        method: [`scales ${c.secs} seconds up to a minute: multiplies by ${c.times}`],
        answer: hr,
        tolerance: 0,
        units: unitsOf(slot),
        line: `${hr} beats per minute`,
      },
      // Second route: beats per second, times sixty.
      { agrees: near((n / c.secs) * 60, hr), detail: `${n} ÷ ${c.secs} × 60 = ${show((n / c.secs) * 60)}` },
      { context: `${c.secs} s`, n, hr },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q29: the extra blood pumped each minute after a fright
// ---------------------------------------------------------------------------------------------

interface Fright {
  name: string
  after: string
  short: string
}
const FRIGHTS: Fright[] = [
  { name: 'fright', after: 'a fright', short: 'the fright' },
  { name: 'near miss', after: 'a near miss with a car while crossing the road', short: 'the near miss' },
  { name: 'bang', after: 'a sudden loud bang', short: 'the bang' },
]

/** (after − before) × volume per beat: written as q29 (60 to 90 beats of 70 cm³, 2100 cm³). */
export const extraBlood: Generator = {
  id: 'adrenalin-extra-blood',
  subjectId: 'biology',
  topicId: HORMONES,
  replaces: ['q29'],
  build(r, slot, turn) {
    const f = FRIGHTS[turn % FRIGHTS.length]!
    const [hr1, hr2, sv] = draw(
      r,
      () => {
        const a = int(r, 55, 85)
        return [a, a + int(r, 15, Math.min(55, 140 - a)), int(r, 60, 100)] as const
      },
      // A resting output of 4 to 7 litres a minute, and an extra volume with at most three figures, so it is exact.
      ([a, b, s]) =>
        distinct(a, b, s, b - a) && !powerOfTen(s) && !powerOfTen(b) && between(a * s, REST_OUTPUT) && figures((b - a) * s) <= 3 && shiftFree((b - a) * s, a, b, s, a * s, b * s),
    )
    const v1 = hr1 * sv
    const v2 = hr2 * sv
    const extra = v2 - v1
    return numeric(
      slot,
      {
        prompt:
          `At rest a person's heart beats ${hr1} times a minute and each beat pumps ${sv} cm³ of blood. After ${f.after}, adrenalin raises the heart rate to ${hr2} beats per minute, while each beat still pumps ${sv} cm³. ` +
          `Calculate the extra volume of blood pumped each minute after ${f.short}, in cm³.`,
        solution:
          `Volume per minute is beats per minute × volume per beat. At rest: $${hr1} \\times ${sv} = ${tex(v1)}$ cm³. After ${f.short}: $${hr2} \\times ${sv} = ${tex(v2)}$ cm³. ` +
          `Extra $= ${tex(v2)} - ${tex(v1)} = ${tex(extra)}$ cm³ each minute, which is ${show(extra / 1000)} litres. (The shortcut: ${hr2 - hr1} extra beats $\\times ${sv} = ${tex(extra)}$.) ` +
          'This is what the increased heart rate is for: more blood each minute means more oxygen and glucose delivered to the muscles, ready for fight or flight.',
        method: [`multiplies heart rate by volume per beat for both: ${prose(v1)} and ${prose(v2)} cm³`, `subtracts the two volumes (or multiplies the ${hr2 - hr1} extra beats by ${sv})`],
        answer: extra,
        tolerance: 0,
        units: unitsOf(slot),
      },
      // Second route: the extra beats times the volume of each.
      { agrees: (hr2 - hr1) * sv === extra, detail: `${hr2 - hr1} × ${sv} = ${(hr2 - hr1) * sv}` },
      { context: f.name, hr1, hr2, sv, extra },
    )
  },
}

// =============================================================================================
// The nervous system
// =============================================================================================

// ---------------------------------------------------------------------------------------------
// q28: the speed of an impulse along one neurone
// ---------------------------------------------------------------------------------------------

interface Path {
  name: string
  neurone: string
  route: string
  /** Length in m and speed in m/s it really has; speeds in steps of `step`. */
  d: readonly [number, number]
  v: readonly [number, number]
  step: number
  note: string
}
const PATHS: Path[] = [
  {
    name: 'motor neurone to the foot',
    neurone: 'a motor neurone',
    route: 'from the spinal cord to a muscle in the foot',
    d: [0.85, 1.1],
    v: [50, 110],
    step: 1,
    note: 'A single motor neurone can run the whole way from the spinal cord to the foot, and its myelin sheath insulates the axon and speeds the impulse along it.',
  },
  {
    name: 'sensory neurone from the fingertip',
    neurone: 'a sensory neurone',
    route: 'from a receptor in the fingertip to the spinal cord',
    d: [0.75, 1.0],
    v: [40, 80],
    step: 1,
    note: 'A single sensory neurone can run the whole length of the arm, and its myelin sheath insulates the axon and speeds the impulse along it.',
  },
  {
    name: 'motor neurone to the hand',
    neurone: 'a motor neurone',
    route: 'from the spinal cord to a muscle in the hand',
    d: [0.65, 0.9],
    v: [50, 100],
    step: 1,
    note: 'Its myelin sheath insulates the axon and speeds the impulse along it.',
  },
  {
    name: 'neurone without myelin',
    neurone: 'a sensory neurone without a myelin sheath,',
    route: 'carrying a dull ache from the foot to the spinal cord',
    d: [0.85, 1.1],
    v: [1.1, 2],
    step: 0.05,
    note: 'With no myelin sheath the impulse travels far more slowly, which is why the dull ache of an injury arrives a moment after the sharp pain carried by neurones that have one.',
  },
]
interface Impulse {
  d: number
  t: number
  v: number
}
/** Lengths to 0.01 m and times exact with at most three figures; the speed none of them with the point moved, doubled or halved. */
function impulses(p: Path): Impulse[] {
  const out: Impulse[] = []
  for (const d of range(p.d[0], p.d[1], 0.01)) {
    for (const v of range(p.v[0], p.v[1], p.step)) {
      const t = clean(d / v)
      if (!atMost(t, 4) || figures(t) > 3 || !noOnes(v, t) || !shiftFree(v, d, t)) continue
      out.push({ d, t, v })
    }
  }
  return out
}

/** distance ÷ time: written as q28 (0.9 m in 0.015 s, 60 m/s). */
export const impulseSpeed: Generator = {
  id: 'nerve-impulse-speed',
  subjectId: 'biology',
  topicId: NERVES,
  replaces: ['q28'],
  build(r, slot, turn) {
    const p = PATHS[turn % PATHS.length]!
    // The speed, then the time, then the length: the speed alone let 0.6 s fill 38% of the neurones without myelin.
    const x = layered(r, `nerve-impulse-speed:${p.name}`, () => rich(impulses(p), (y) => y.t, (y) => y.v, 2), (y) => y.t, (y) => y.v, (y) => y.d)
    return numeric(
      slot,
      {
        prompt: `An electrical impulse travels along ${p.neurone} ${show(x.d)} m long, ${p.route}, in ${show(x.t)} s. Calculate the speed of the impulse in metres per second.`,
        solution: `Speed $= \\dfrac{\\text{distance}}{\\text{time}} = \\dfrac{${show(x.d)}}{${show(x.t)}} = ${show(x.v)}$ m/s. ${p.note}`,
        method: ['divides the distance by the time'],
        answer: x.v,
        tolerance: 0,
        units: unitsOf(slot),
      },
      // Second route: the speed for the time covers the distance.
      { agrees: near(x.v * x.t, x.d), detail: `${show(x.v)} × ${show(x.t)} = ${show(x.v * x.t)}` },
      { context: p.name, d: x.d, t: x.t, v: x.v },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q29: the time an impulse takes round a reflex arc
// ---------------------------------------------------------------------------------------------

interface Arc {
  name: string
  stimulus: string
  limb: string
  /** Sensory neurone to the spinal cord, and motor neurone from it, in m. */
  sensory: readonly [number, number]
  motor: readonly [number, number]
}
const ARCS: Arc[] = [
  { name: 'hand', stimulus: 'touches a hot pan', limb: 'arm', sensory: [0.75, 0.95], motor: [0.35, 0.6] },
  { name: 'foot', stimulus: 'steps on a drawing pin', limb: 'leg', sensory: [0.9, 1.1], motor: [0.5, 0.8] },
]
interface Leg {
  d: number
  v: number
  /** The time along it in ms, exact to 0.1. */
  ms: number
}
/** Lengths to 0.01 m at whole speeds, the time in ms exact to 0.1 ms. */
function legs(d: readonly [number, number], v: readonly [number, number]): Leg[] {
  const out: Leg[] = []
  for (const dd of range(d[0], d[1], 0.01)) {
    for (let vv = v[0]; vv <= v[1]; vv++) {
      const ms = clean((dd / vv) * 1000)
      if (atMost(ms, 1) && !powerOfTen(vv)) out.push({ d: dd, v: vv, ms })
    }
  }
  return out
}
const SYNAPSE_DELAYS = range(0.5, 0.9, 0.1)

/** d ÷ v for each neurone, plus two synapses: written as q29 (0.75 m at 50 and at 100 m/s, 0.5 ms each, 23.5 ms). */
export const reflexTime: Generator = {
  id: 'reflex-arc-time',
  subjectId: 'biology',
  topicId: NERVES,
  replaces: ['q29'],
  build(r, slot, turn) {
    const a = ARCS[turn % ARCS.length]!
    const sensory = memo(`reflex-arc-time:sensory:${a.name}`, () => legs(a.sensory, [40, 80]))()
    const motor = memo(`reflex-arc-time:motor:${a.name}`, () => legs(a.motor, [50, 100]))()
    const [s, m, delay] = draw(
      r,
      () => [pick(r, sensory), pick(r, motor), pick(r, SYNAPSE_DELAYS)] as const,
      ([x, y, z]) => {
        const total = clean(x.ms + y.ms + 2 * z)
        return distinct(x.d, y.d) && x.v !== y.v && x.ms !== y.ms && figures(total) <= 3 && shiftFree(total, x.d, y.d, x.v, y.v, z)
      },
    )
    const both = clean(2 * delay)
    const total = clean(s.ms + m.ms + both)
    return numeric(
      slot,
      {
        prompt:
          `In a reflex arc, when a person ${a.stimulus}, an impulse travels ${show(s.d)} m along a sensory neurone to the spinal cord at ${s.v} m/s, crosses two synapses that each take ${show(delay)} ms ` +
          `(the relay neurone between them is so short that the time along it can be ignored), and then travels ${show(m.d)} m along a motor neurone to a muscle in the ${a.limb} at ${m.v} m/s. ` +
          'Calculate the total time taken from receptor to muscle, in milliseconds.',
        solution:
          `Time along each neurone is distance ÷ speed. Sensory neurone: $\\dfrac{${show(s.d)}}{${s.v}} = ${show(s.ms / 1000)}$ s $= ${show(s.ms)}$ ms. ` +
          `Motor neurone: $\\dfrac{${show(m.d)}}{${m.v}} = ${show(m.ms / 1000)}$ s $= ${show(m.ms)}$ ms. The two synapses add $2 \\times ${show(delay)} = ${show(both)}$ ms. ` +
          `Total $= ${show(s.ms)} + ${show(m.ms)} + ${show(both)} = ${show(total)}$ ms. ` +
          'The synapses are a small part of the total here, which is why a reflex with only two of them is fast: a path through the conscious brain would be longer and would cross many more.',
        method: [`converts each neurone's distance and speed to a time: ${show(s.ms)} ms and ${show(m.ms)} ms`, `adds the two synapse delays, ${show(both)} ms`],
        answer: total,
        tolerance: toPlaces(total, 1),
        units: unitsOf(slot),
      },
      // Second route: everything in seconds, then to milliseconds.
      { agrees: near((s.d / s.v + m.d / m.v + (2 * delay) / 1000) * 1000, total), detail: `(${show(s.d / s.v)} + ${show(m.d / m.v)} + ${show((2 * delay) / 1000)}) × 1000` },
      { context: a.name, d1: s.d, v1: s.v, d2: m.d, v2: m.v, delay, total },
    )
  },
}

// =============================================================================================
// Senses and reaction time: the ruler drop
// =============================================================================================

// ---------------------------------------------------------------------------------------------
// q24: the mean of five ruler-drop readings
// ---------------------------------------------------------------------------------------------

interface Catcher {
  name: string
  who: string
  /** The mean distance in cm, 10 to 30 cm for reaction times of 0.14 to 0.25 s. */
  mean: readonly [number, number]
}
const CATCHERS: Catcher[] = [
  { name: 'dominant hand', who: 'catching with their dominant hand', mean: [12, 20] },
  { name: 'non-dominant hand', who: 'catching with their non-dominant hand', mean: [16, 26] },
  { name: 'music', who: 'listening to music through headphones', mean: [17, 28] },
]
/** The reaction time a fall of d cm takes, as the topic's table works it (g = 9.8 m/s²). */
const fallTime = (cm: number) => Math.sqrt((2 * cm) / 100 / 9.8)

/**
 * Every set of five whole readings about the mean: within 15% of it, at least 2 cm apart at the
 * ends, none of them the mean, and a median that is not the mean (a student who picks the middle
 * reading is not marked right). Sets in rising order; a build shuffles one.
 */
function catchSets(m: number): number[][] {
  const lo = Math.ceil(m * 0.85)
  const hi = Math.floor(m * 1.15)
  const total = Math.round(m * 5)
  const out: number[][] = []
  const grow = (set: number[]) => {
    if (set.length === 5) {
      if (set.reduce((s, x) => s + x, 0) === total && set[4]! - set[0]! >= 2 && !set.some((x) => near(x, m)) && !near(set[2]!, m)) out.push(set)
      return
    }
    for (let x = set.at(-1) ?? lo; x <= hi; x++) grow([...set, x])
  }
  grow([])
  return out
}
/** The means a context allows, to 0.2 cm, with at least three sets of readings and a reaction time that rounds clearly to 0.01 s. */
const catchMeans = (c: Catcher) =>
  range(c.mean[0], c.mean[1], 0.2)
    .filter((m) => clearOfHalf(fallTime(m), 2, 0.05))
    .map((m) => ({ m, sets: catchSets(m) }))
    .filter((x) => x.sets.length >= 3)

/** The sum of five readings ÷ 5: written as q24 (14, 19, 16, 17 and 19 cm, 17 cm). */
export const rulerMean: Generator = {
  id: 'ruler-drop-mean',
  subjectId: 'biology',
  topicId: SENSES,
  replaces: ['q24'],
  build(r, slot, turn) {
    const c = CATCHERS[turn % CATCHERS.length]!
    // A mean to 0.2 cm (five whole readings), then a set of readings that gives it, in any order.
    const { m, sets } = pick(r, memo(`ruler-drop-mean:${c.name}`, () => catchMeans(c))())
    const rs = shuffle(r, pick(r, sets))
    const total = rs.reduce((s, x) => s + x, 0)
    return numeric(
      slot,
      {
        prompt: `In the ruler-drop test, a student ${c.who} catches the ruler after it has fallen ${list(rs.map((x) => `${x} cm`))}. Calculate the mean distance fallen, in cm.`,
        solution:
          `Add the five readings: $${rs.join(' + ')} = ${total}$ cm. Divide by the number of readings: $\\dfrac{${total}}{5} = ${show(m)}$ cm. ` +
          `Reaction time varies from catch to catch, which is why the test is repeated and the mean is used rather than any single catch. A mean of ${show(m)} cm corresponds to a reaction time of about ${fixed(fallTime(m), 2)} s.`,
        method: [`adds the five readings to ${total} and divides by 5`],
        answer: m,
        tolerance: 0,
        units: unitsOf(slot),
      },
      // Second route: the readings' differences from the mean add to nothing.
      { agrees: near(rs.reduce((s, x) => s + (x - m), 0), 0), detail: `${rs.map((x) => show(x - m)).join(' + ')} = 0` },
      { context: c.name, r1: rs[0]!, r2: rs[1]!, r3: rs[2]!, r4: rs[3]!, r5: rs[4]!, mean: m },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q25: the change in reaction time from t = √(2d ÷ g)
// ---------------------------------------------------------------------------------------------

interface Change {
  name: string
  /** Increase or decrease, as the prompt asks it. */
  rise: boolean
  /** The reaction times before, and the change, in s. */
  before: readonly [number, number]
  change: readonly [number, number]
  /** Who catches: first mention and the same person again. */
  people: readonly (readonly [string, string])[]
  /** What happens between the two catches. */
  causes: readonly string[]
  prompt: (d1: string, d2: string, rule: string, who: readonly [string, string], cause: string) => string
  why: (dt: number) => string
}
const CHANGES: Change[] = [
  {
    name: 'alcohol',
    rise: true,
    before: [0.15, 0.24],
    change: [0.03, 0.14],
    people: [['volunteer', 'volunteer'], ['participant in a road-safety study', 'participant'], ['adult volunteer', 'volunteer']],
    causes: ['two alcoholic drinks', 'two pints of beer', 'two glasses of wine'],
    prompt: (d1, d2, rule, [who, same], cause) =>
      `${WithArticle(who)} catches a dropped ${rule} after it has fallen ${d1} cm. After ${cause}, the same ${same} catches it after it has fallen ${d2} cm. Calculate the increase in the ${same}'s reaction time, in seconds.`,
    why: (dt) =>
      `Alcohol is a **depressant**, which slows the nervous system and lengthens reaction time; those extra ${show(dt)} s are why a car travelling at 13 m/s goes a further ${show(clean(13 * dt))} m before the driver even begins to brake.`,
  },
  {
    name: 'rested',
    rise: false,
    before: [0.22, 0.33],
    change: [0.03, 0.12],
    people: [['volunteer', 'volunteer'], ['student', 'student'], ['participant in a sleep study', 'participant']],
    causes: ['a good night’s sleep', 'nine hours of sleep', 'a full night’s rest'],
    prompt: (d1, d2, rule, [who, same], cause) =>
      `After a night without sleep, ${withArticle(who)} catches a dropped ${rule} after it has fallen ${d1} cm. The next day, after ${cause}, the same ${same} catches it after it has fallen ${d2} cm. Calculate the decrease in the ${same}'s reaction time, in seconds.`,
    why: (dt) => `Tiredness slows the response of the nervous system, so a rested nervous system reacts more quickly; sleep cut ${show(dt)} s from the reaction time.`,
  },
  {
    name: 'no sleep',
    rise: true,
    before: [0.15, 0.24],
    change: [0.03, 0.12],
    people: [['volunteer', 'volunteer'], ['student', 'student'], ['participant in a sleep study', 'participant']],
    causes: ['a night without sleep', 'a night with only two hours of sleep', 'staying awake all night'],
    prompt: (d1, d2, rule, [who, same], cause) =>
      `${WithArticle(who)} catches a dropped ${rule} after it has fallen ${d1} cm. After ${cause}, the same ${same} catches it after it has fallen ${d2} cm. Calculate the increase in the ${same}'s reaction time, in seconds.`,
    why: (dt) =>
      `Tiredness slows the response of the nervous system, so reaction time lengthens; those extra ${show(dt)} s are why a car travelling at 13 m/s goes a further ${show(clean(13 * dt))} m before a tired driver even begins to brake.`,
  },
]
interface Catch {
  /** The fall in cm, to the millimetre, its time unrounded and to 0.01 s. */
  d: number
  exact: number
  t: number
}
/**
 * Falls of 10.0 to 61.3 cm, read to the millimetre, whose time at g = 10 m/s² is 0.15 to 0.35 s and
 * rounds clearly to 0.01 s; never a time that is the fall in metres with the point moved (20 cm
 * takes 0.2 s).
 */
const CATCHES = memo('reaction-time-from-fall:catches', () =>
  range(10, 61.3, 0.1)
    .map((d) => ({ d, exact: Math.sqrt(d / 500), t: roundTo(Math.sqrt(d / 500), 2) }))
    .filter((x) => between(x.t, [0.15, 0.35]) && clearOfHalf(x.exact, 2, 0.1) && !tenfold(x.t, x.d)),
)
interface Pair {
  a: Catch
  b: Catch
  dt: number
  tol: number
}
/**
 * Two catches whose change, from the times rounded to 0.01 s, is in the context's range; the
 * unrounded change lies inside the tolerance of it, so a student who keeps every figure and one
 * who rounds each time are both right. Never one time twice the other, and the change none of the
 * falls with the point moved, doubled or halved.
 */
function catchPairs(c: Change): Pair[] {
  const out: Pair[] = []
  const all = CATCHES()
  for (const a of all) {
    if (!between(a.t, c.before)) continue
    for (const b of all) {
      if (c.rise ? b.t <= a.t : b.t >= a.t) continue
      const dt = clean(Math.abs(b.t - a.t))
      const tol = toPlaces(dt, 2)
      if (!between(dt, c.change) || near(b.t, 2 * a.t) || near(a.t, 2 * b.t) || !shiftFree(dt, a.d, b.d)) continue
      if (Math.abs(Math.abs(b.exact - a.exact) - dt) > tol) continue
      out.push({ a, b, dt, tol })
    }
  }
  return out
}
/** √(2d ÷ g) in the working: exact when it is, else its first figures and the rounding. */
const rootLine = (x: Catch) => {
  const m = clean(x.d / 100)
  const head = `t = \\sqrt{2 \\times ${show(m)} \\div 10} = \\sqrt{${show(clean(m / 5))}} = `
  return near(x.exact, x.t) ? `$${head}${fixed(x.t, 2)}$ s` : `$${head}${trail(x.exact, 4)}$, which is ${fixed(x.t, 2)} s to 2 decimal places`
}

/** √(2d ÷ g) before and after, each to 0.01 s, then the change: written as q25 (20 cm and 45 cm, 0.1 s). */
export const reactionChange: Generator = {
  id: 'reaction-time-from-fall',
  subjectId: 'biology',
  topicId: SENSES,
  replaces: ['q25'],
  build(r, slot, turn) {
    const c = CHANGES[turn % CHANGES.length]!
    // The change first, then the first fall: every change is as likely as another, and no fall fills a context.
    const x = layered(r, `reaction-time-from-fall:${c.name}`, () => catchPairs(c), (y) => y.dt, (y) => y.a.d)
    const { a, b } = x
    // A school ruler is 30 cm long; a longer fall needs a metre rule.
    const rule = Math.max(a.d, b.d) > 30 ? 'metre rule' : 'ruler'
    const [hi, lo] = c.rise ? [b, a] : [a, b]
    return numeric(
      slot,
      {
        prompt:
          'Reaction time can be worked out from how far a dropped ruler falls before it is caught. The time $t$, in seconds, for the ruler to fall a distance $d$, in metres, is $t = \\sqrt{2d \\div g}$, where $g = 10\\ \\text{m/s}^2$. ' +
          c.prompt(show(a.d), show(b.d), rule, pick(r, c.people), pick(r, c.causes)),
        solution:
          `The distances are in centimetres and the formula needs metres, so convert first: ${show(a.d)} cm is ${show(clean(a.d / 100))} m and ${show(b.d)} cm is ${show(clean(b.d / 100))} m. ` +
          `Before: ${rootLine(a)}. After: ${rootLine(b)}. ` +
          `The ${c.rise ? 'increase' : 'decrease'} is $${fixed(hi.t, 2)} - ${fixed(lo.t, 2)} = ${show(x.dt)}$ s. ${c.why(x.dt)} ` +
          `Putting ${show(a.d)} and ${show(b.d)} into the formula without converting gives about ${fixed(10 * a.exact, 1)} s and ${fixed(10 * b.exact, 1)} s, far longer than any human reaction time, which is the sign that the units were missed.`,
        method: ['converts both distances to metres and substitutes into the formula', `reaction times of ${fixed(a.t, 2)} s and ${fixed(b.t, 2)} s`],
        answer: x.dt,
        tolerance: x.tol,
        units: unitsOf(slot),
      },
      // Second route: the unrounded times, whose change lies within the tolerance.
      { agrees: Math.abs(Math.abs(Math.sqrt((2 * b.d) / 1000) - Math.sqrt((2 * a.d) / 1000)) - x.dt) <= x.tol, detail: `√(${show((2 * b.d) / 1000)}) − √(${show((2 * a.d) / 1000)})` },
      { context: c.name, d1: a.d, d2: b.d, t1: a.t, t2: b.t, dt: x.dt, rule },
    )
  },
}

// =============================================================================================
// The eye
// =============================================================================================

// ---------------------------------------------------------------------------------------------
// q25: the percentage of boys (or girls) who are colour blind
// ---------------------------------------------------------------------------------------------

interface Group {
  n: number
  k: number
  p: number
}
/** Surveys of 1200 to 6000 (never a power of ten) whose count gives a percentage exact in the step, none of the figures with the point moved. */
function groups(p: readonly [number, number], step: number): Group[] {
  const out: Group[] = []
  for (let n = 1200; n <= 6000; n += 50) {
    for (const q of range(p[0], p[1], step)) {
      const k = clean((q * n) / 100)
      if (!whole(k) || k < 3 || !shiftFree(q, n, k)) continue
      out.push({ n, k, p: q })
    }
  }
  return out
}
/** About 8% of boys and 0.5% of girls in the UK have red-green colour blindness. */
const BOYS = memo('colour-blindness-percentage:boys', () => groups([6, 10], 0.1))
const GIRLS = memo('colour-blindness-percentage:girls', () => groups([0.2, 0.8], 0.01))
const SURVEYS = ['In a fictional survey', 'In a fictional screening programme at a group of secondary schools']

/** count ÷ number tested × 100: written as q25 (200 of 2500 boys, 8%). */
export const colourBlind: Generator = {
  id: 'colour-blindness-percentage',
  subjectId: 'biology',
  topicId: EYE,
  replaces: ['q25'],
  build(r, slot, turn) {
    // Boys and girls asked in turn: a student cannot assume the larger figure.
    const asked = turn % 2 === 0 ? 'boys' : 'girls'
    const draws = () => [balanced(r, 'colour-blindness-percentage:boys', BOYS, (y) => y.n, (y) => y.p), balanced(r, 'colour-blindness-percentage:girls', GIRLS, (y) => y.n, (y) => y.p)] as const
    // About 16 times as common in boys in the UK: a survey that gave 40 times would mislead.
    const [b, g] = draw(r, draws, ([x, y]) => x.n !== y.n && x.k !== y.k && between(x.p / y.p, [10, 30]))
    const ratio = b.p / g.p
    const often = atMost(ratio, 1) ? `${show(clean(ratio))} times` : `about ${Math.round(ratio)} times`
    const x = asked === 'boys' ? b : g
    const line = (y: Group, who = '') => `$\\dfrac{${y.k}}{${tex(y.n)}} \\times 100 = ${show(y.p)}\\%$${who}`
    return numeric(
      slot,
      {
        prompt:
          `${pick(r, SURVEYS)}, ${prose(b.n)} boys and ${prose(g.n)} girls were tested for red-green colour blindness. ${b.k} of the boys and ${g.k} of the girls were found to be colour blind. ` +
          `Calculate the percentage of the ${asked} who were colour blind.`,
        solution:
          `${line(x, ` of the ${asked}`)}. For the ${asked === 'boys' ? 'girls' : 'boys'} it would be ${line(asked === 'boys' ? g : b)}, ` +
          `so in this survey the defect was ${often} as common in boys. The allele is recessive and carried on the X chromosome, so a boy needs only one copy to be affected, which is why it is far more common in boys. ` +
          'Colour blindness is a fault in the cone cells of the retina, usually one type not working properly, so it is a problem of detecting light, not of focusing it, and no lens corrects it.',
        method: [`divides ${x.k} by ${prose(x.n)} and multiplies by 100`],
        answer: x.p,
        tolerance: 0,
        units: unitsOf(slot),
      },
      // Second route: the percentage of the number tested is the count.
      { agrees: near((x.p * x.n) / 100, x.k), detail: `${show(x.p)}% of ${x.n} = ${show((x.p * x.n) / 100)}` },
      { context: asked, nb: b.n, kb: b.k, ng: g.n, kg: g.k, p: x.p },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q26: how many times more light a wide pupil lets in
// ---------------------------------------------------------------------------------------------

interface Light {
  name: string
  dim: string
  bright: string
}
const LIGHTS: Light[] = [
  { name: 'dim and bright', dim: 'In dim light', bright: 'In bright light' },
  { name: 'cinema', dim: 'In a dark cinema', bright: 'Outside in bright sunshine' },
  { name: 'torch', dim: 'In a darkened room', bright: 'When a doctor shines a torch into the eye' },
]
interface Pupil {
  D: number
  d: number
  /** The ratio of the areas unrounded, and to 3 s.f. */
  exact: number
  ratio: number
  tol: number
}
/**
 * The ratio a student gets by dividing the areas as the solution prints them, to 3 s.f., with π or
 * with 3.14: 27.3 ÷ 6.16 = 4.43 when the answer is 4.44.
 */
const pupilRoutes = (D: number, d: number) =>
  [Math.PI, 3.14].map((pi) => {
    const [a, b] = [sigFigs(pi * (D / 2) ** 2, 3), sigFigs(pi * (d / 2) ** 2, 3)]
    return a / b
  })
/** About 1% of the answer, in two figures: room for figures rounded to 3 s.f. before dividing. */
const onePercent = (x: number) => Number((x * 0.01).toPrecision(2))
/**
 * Diameters to 0.1 mm: 4.5 to 8 mm in the dark, 2 to 4 mm in the light, at least 1.5 mm apart. The
 * ratio of the areas to 3 s.f., its rounding clear, and none of the diameters or radii with the
 * point moved, doubled or halved (8 and 4 mm would give 4). Only exact ratios left 2 and 2.5 mm as
 * the bright-light pupil in nearly every build. The tolerance is about 1% of the answer, and only
 * draws where dividing the printed areas (with π or 3.14), and that to 3 s.f., falls inside it are kept.
 */
const PUPILS = memo('pupil-area-ratio:pupils', () => {
  const out: Pupil[] = []
  for (const D of range(4.5, 8, 0.1)) {
    for (const d of range(2, 4, 0.1)) {
      const exact = (D / d) ** 2
      const ratio = sigFigs(exact, 3)
      const tol = onePercent(ratio)
      if (D - d < 1.5 || !clearAtSigFigs(exact, 3, 0.1) || !shiftFree(ratio, D, d, D / 2, d / 2)) continue
      if (pupilRoutes(D, d).some((q) => Math.abs(q - ratio) > tol || Math.abs(sigFigs(q, 3) - ratio) > tol)) continue
      out.push({ D, d, exact, ratio, tol })
    }
  }
  return out
})
const piTerm = (r2: number) => (near(r2, 1) ? '\\pi' : `${show(r2)}\\pi`)

/** (D ÷ d)², the ratio of the areas: written as q26 (8 mm and 2 mm, 16). */
export const pupilArea: Generator = {
  id: 'pupil-area-ratio',
  subjectId: 'biology',
  topicId: EYE,
  replaces: ['q26'],
  build(r, slot, turn) {
    const l = LIGHTS[turn % LIGHTS.length]!
    const x = layered(r, 'pupil-area-ratio', PUPILS, (y) => y.d, (y) => y.D)
    const [R, rr] = [clean(x.D / 2), clean(x.d / 2)]
    const [R2, r2] = [clean(R * R), clean(rr * rr)]
    const k = clean(x.D / x.d)
    const exactly = atMost(x.exact, 4) && near(x.exact, x.ratio)
    const about = exactly ? '' : 'about '
    // To 3 s.f. with its trailing zero: 5.30, not 5.3.
    const rText = exactly ? show(x.ratio) : sigText(x.ratio, 3)
    const kText = atMost(k, 3) ? show(k) : `about ${sigText(k, 3)}`
    return numeric(
      slot,
      {
        prompt:
          `${l.dim} a person's pupil is ${show(x.D)} mm in diameter. ${l.bright} the muscles of the iris constrict it to ${show(x.d)} mm in diameter. ` +
          'The amount of light entering the eye is proportional to the area of the pupil, where area $= \\pi r^2$. ' +
          `Calculate how many times more light enters the eye through the ${show(x.D)} mm pupil than through the ${show(x.d)} mm pupil.`,
        solution:
          `Radius first, not diameter: ${show(R)} mm and ${show(rr)} mm. Areas: $\\pi \\times ${show(R)}^2 = ${piTerm(R2)}$, about ${sigText(Math.PI * R2, 3)} mm², and $\\pi \\times ${show(rr)}^2 = ${piTerm(r2)}$, about ${sigText(Math.PI * r2, 3)} mm². ` +
          `Ratio $= \\dfrac{${piTerm(R2)}}{${piTerm(r2)}} = ${atMost(x.exact, 4) ? show(x.exact) : trail(x.exact, 4)}$${exactly ? '' : `, which is ${rText} to 3 significant figures`}. So ${about}${rText} times as much light enters through the wide pupil, not ${kText} times: the diameter is ${kText} times larger, and the area grows with the square of that. ` +
          `This is why the pupil reflex protects the retina so effectively; constricting the pupil in bright light cuts the light reaching the rods and cones by a factor of ${about}${rText}.`,
        method: [`uses the radii ${show(R)} mm and ${show(rr)} mm to find the areas, ${show(R2)}π and ${show(r2)}π`, 'divides the larger area by the smaller'],
        answer: x.ratio,
        tolerance: x.tol,
        units: unitsOf(slot),
        line: `${rText} times`,
      },
      // Second route: the ratio of the areas themselves, π and all.
      { agrees: Math.abs((Math.PI * R * R) / (Math.PI * rr * rr) - x.ratio) <= x.tol, detail: `${show(Math.PI * R * R)} ÷ ${show(Math.PI * rr * rr)}` },
      { context: l.name, D: x.D, d: x.d, ratio: x.ratio },
    )
  },
}

// =============================================================================================
// Thermoregulation
// =============================================================================================

// ---------------------------------------------------------------------------------------------
// q24: the percentage increase in blood flow to the skin
// ---------------------------------------------------------------------------------------------

interface Warmth {
  name: string
  where: string
  p: readonly [number, number]
}
const WARMTHS: Warmth[] = [
  { name: 'hot room', where: 'In a hot room', p: [150, 400] },
  { name: 'hot bath', where: 'Sitting in a hot bath', p: [200, 500] },
  { name: 'run on a hot day', where: 'During a run on a hot day', p: [300, 700] },
]

/** (hot − rest) ÷ rest × 100: written as q24 (250 to 1000 cm³ per minute, 300%). */
export const skinFlow: Generator = {
  id: 'skin-blood-flow-increase',
  subjectId: 'biology',
  topicId: THERMO,
  replaces: ['q24'],
  build(r, slot, turn) {
    const w = WARMTHS[turn % WARMTHS.length]!
    // A resting flow of 200 to 500 cm³ per minute and a raised one, both to the nearest 10, at most 3500. The resting flow
    // first: drawing the percentage alone let 500, which allows the most, fill half a context.
    const x = layered(r, `skin-blood-flow-increase:${w.name}`, () => rich(increases(200, 500, 10, 10, w.p, 3500), (y) => y.a, (y) => y.p, 8), (y) => y.a, (y) => y.p)
    const k = clean(x.b / x.a)
    return numeric(
      slot,
      {
        prompt: `At rest, the blood flow to a person's skin is ${prose(x.a)} cm³ per minute. ${w.where}, vasodilation increases the flow to ${prose(x.b)} cm³ per minute. Calculate the percentage increase in blood flow to the skin.`,
        solution:
          `Increase $= ${tex(x.b)} - ${tex(x.a)} = ${tex(x.d)}$ cm³ per minute. Percentage increase $= \\dfrac{${tex(x.d)}}{${tex(x.a)}} \\times 100 = ${x.p}\\%$. ` +
          `The flow is ${show(k)} times what it was, which is a ${x.p}% increase, not ${x.p + 100}%: the percentage is the **change** divided by the **original** value. ` +
          'The arterioles supplying the skin capillaries have widened, so far more warm blood flows near the surface and more heat is lost from the blood to the surroundings.',
        method: [`finds the increase, ${prose(x.d)}, and divides it by the original ${prose(x.a)} (× 100)`],
        answer: x.p,
        tolerance: 0,
        units: unitsOf(slot),
      },
      // Second route: the resting flow grown by the percentage is the raised one.
      { agrees: near((x.a * (100 + x.p)) / 100, x.b), detail: `${x.a} × ${show(1 + x.p / 100)} = ${show((x.a * (100 + x.p)) / 100)}` },
      { context: w.name, rest: x.a, hot: x.b, p: x.p },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q25: the rate at which evaporating sweat removes energy
// ---------------------------------------------------------------------------------------------

interface Sweat {
  name: string
  lead: string
  /** The time in minutes, and how the prompt states it. */
  minutes: number
  hours?: string
  kg: readonly [number, number]
  /** "in the hour", "in the match". */
  span: string
  who: string
}
const SWEATS: Sweat[] = [
  { name: 'run', lead: 'During one hour of running, an athlete lost', minutes: 60, kg: [0.5, 1.5], span: 'in the hour', who: 'athlete' },
  { name: 'football', lead: 'During a football match lasting 90 minutes, a player lost', minutes: 90, kg: [0.8, 2], span: 'in the match', who: 'player' },
  { name: 'bike ride', lead: 'During a two-and-a-half-hour bike ride, a cyclist lost', minutes: 150, hours: 'two and a half hours', kg: [1.2, 3], span: 'in the ride', who: 'cyclist' },
  { name: 'squash', lead: 'During a game of squash lasting 45 minutes, a player lost', minutes: 45, kg: [0.4, 1.1], span: 'in the game', who: 'player' },
]
const LATENT = 2.4
interface Loss2 {
  kg: number
  g: number
  e: number
  rate: number
}
/** Masses to 0.01 kg, a rate exact to 0.1 kJ/min with at most three figures, none of the figures with the point moved. */
function sweats(s: Sweat): Loss2[] {
  const out: Loss2[] = []
  for (const kg of range(s.kg[0], s.kg[1], 0.01)) {
    const g = clean(kg * 1000)
    const e = clean(g * LATENT)
    const rate = clean(e / s.minutes)
    if (!atMost(rate, 1) || figures(rate) > 3 || !noOnes(kg) || !shiftFree(rate, kg, s.minutes, LATENT, e, g)) continue
    out.push({ kg, g, e, rate })
  }
  return out
}

/** mass in g × 2.4 ÷ minutes: written as q25 (0.75 kg in an hour, 30 kJ/min). */
export const sweatEnergy: Generator = {
  id: 'sweat-evaporation-rate',
  subjectId: 'biology',
  topicId: THERMO,
  replaces: ['q25'],
  build(r, slot, turn) {
    const s = SWEATS[turn % SWEATS.length]!
    const x = evenly(r, `sweat-evaporation-rate:${s.name}`, () => sweats(s), (y) => y.rate)
    const per = s.hours ? `${cap(s.hours)} is ${s.minutes} minutes, so per minute` : 'Per minute'
    return numeric(
      slot,
      {
        prompt:
          `When sweat evaporates from the skin, each gram of sweat takes about ${LATENT} kJ of energy from the skin. ${s.lead} ${show(x.kg)} kg of sweat, all of which evaporated. ` +
          `Calculate the mean rate at which evaporation removed energy from the ${s.who}'s skin, in kJ per minute.`,
        solution:
          `Convert the mass to grams: $${show(x.kg)} \\text{ kg} = ${tex(x.g)}$ g. Energy removed ${s.span} $= ${tex(x.g)} \\times ${LATENT} = ${tex(x.e)}$ kJ. ${per}: $\\dfrac{${tex(x.e)}}{${s.minutes}} = ${show(x.rate)}$ kJ/min. ` +
          'It is the **evaporation** that removes the energy, not the sweat sitting on the skin: the liquid takes energy from the skin as it turns to vapour. That is also why sweating cools you less well in humid air, where the sweat cannot evaporate.',
        method: [`converts ${show(x.kg)} kg to ${prose(x.g)} g and multiplies by ${LATENT}: ${prose(x.e)} kJ`, `divides by ${s.minutes} minutes`],
        answer: x.rate,
        tolerance: 0,
        units: unitsOf(slot),
      },
      // Second route: the mass lost each minute, in grams, times the energy per gram.
      { agrees: near((x.g / s.minutes) * LATENT, x.rate), detail: `${show(x.g / s.minutes)} g/min × ${LATENT} = ${show((x.g / s.minutes) * LATENT)}` },
      { context: s.name, kg: x.kg, rate: x.rate },
    )
  },
}

// =============================================================================================
// Osmoregulation and the kidneys
// =============================================================================================

// ---------------------------------------------------------------------------------------------
// q26: the percentage of the filtrate reabsorbed
// ---------------------------------------------------------------------------------------------

interface Day {
  name: string
  /** The opening, up to "kidneys filter", and how the urine sentence names the person. */
  lead: string
  then: string
  /** Urine in litres that day. */
  urine: readonly [number, number]
}
const DAYS: Day[] = [
  { name: 'ordinary day', lead: "In one day, a person's kidneys filter", then: 'In the same day the person produces', urine: [1.2, 2] },
  { name: 'drinking a lot', lead: 'On a day when a person drinks a lot of water, their kidneys filter', then: 'In the same day they produce', urine: [2, 3] },
  { name: 'hot day', lead: 'On a hot day when a person sweats a lot and drinks little, their kidneys filter', then: 'In the same day they produce', urine: [0.6, 1.1] },
]
interface Filtrate {
  f: number
  u: number
  back: number
  /** The percentage unrounded, and to 3 s.f. */
  exact: number
  p: number
}
/**
 * Any whole filtrate of 150 to 190 litres, urine to 0.01 litre, and the percentage to 3 s.f. with a
 * clear rounding. Exact percentages left a few filtrates and about 150 prompts. The biology keeps
 * the answers close together: about 99% is reabsorbed, so a context has five to ten of them.
 */
function filtrates(d: Day): Filtrate[] {
  const out: Filtrate[] = []
  for (let f = 150; f <= 190; f++) {
    for (const u of range(d.urine[0], d.urine[1], 0.01)) {
      const back = clean(f - u)
      const exact = (back / f) * 100
      const p = sigFigs(exact, 3)
      if (!clearAtSigFigs(exact, 3, 0.1) || !shiftFree(p, f, u, back)) continue
      out.push({ f, u, back, exact, p })
    }
  }
  return out
}

/** (filtered − urine) ÷ filtered × 100: written as q26 (150 litres and 1.5 litres, 99%). */
export const reabsorbed: Generator = {
  id: 'kidney-percentage-reabsorbed',
  subjectId: 'biology',
  topicId: KIDNEY,
  replaces: ['q26'],
  build(r, slot, turn) {
    const d = DAYS[turn % DAYS.length]!
    const x = layered(r, `kidney-percentage-reabsorbed:${d.name}`, () => filtrates(d), (y) => y.p, (y) => y.f)
    const exactly = near(x.exact, x.p)
    return numeric(
      slot,
      {
        prompt:
          `${d.lead} ${x.f} litres of fluid out of the blood into the nephrons. ${d.then} ${show(x.u)} litres of urine. ` +
          'Calculate the percentage of the filtered fluid that is reabsorbed back into the blood.',
        solution:
          `Reabsorbed $= ${x.f} - ${show(x.u)} = ${show(x.back)}$ litres. Percentage $= \\dfrac{${show(x.back)}}{${x.f}} \\times 100 = ${exactly ? show(x.p) : `${trail(x.exact, 4)} = ${sigText(x.p, 3)}`}\\%$${exactly ? '' : ' to 3 significant figures'}. Only about ${sigText(100 - x.exact, 2)}% of what is filtered leaves as urine. ` +
          'The kidney filters indiscriminately by size and then selectively reabsorbs almost all of the water, along with all of the glucose, so that the urea is removed without the useful substances being lost.',
        method: [`subtracts the urine from the filtered volume, ${show(x.back)} litres, and divides by ${x.f} (× 100)`],
        answer: x.p,
        // The 3 s.f. answer, wide enough for the unrounded one.
        tolerance: sfTolerance(x.p, 3),
        units: unitsOf(slot),
      },
      // Second route: 100% less the share that leaves as urine.
      { agrees: Math.abs(100 - (x.u / x.f) * 100 - x.p) <= sfTolerance(x.p, 3), detail: `100 − ${show(x.u)} ÷ ${x.f} × 100 = ${show(100 - (x.u / x.f) * 100)}` },
      { context: d.name, f: x.f, u: x.u, p: x.p },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q27: how many times faster urine is made after a drink
// ---------------------------------------------------------------------------------------------

interface Drink {
  name: string
  what: string
  cm3: number
}
const DRINKS: Drink[] = [
  { name: 'a litre', what: 'a litre of water', cm3: 1000 },
  { name: '750 cm³', what: '750 cm³ of water', cm3: 750 },
  { name: 'one and a half litres', what: 'one and a half litres of water', cm3: 1500 },
]
const PERIODS = [30, 45, 75, 90, 105, 120, 135, 150]
interface Flow {
  rest: number
  v: number
  t: number
  /** The per-minute rates unrounded, and whether both are exact to 2 places. */
  restMin: number
  afterMin: number
  clean: boolean
  hours: number
  afterHour: number
  ratio: number
  tol: number
}
/** Two places, as a student rounds a per-minute rate: 0.83. */
const twoPlaces = (x: number) => roundTo(x, 2)
/**
 * A resting rate of 30 to 90 cm³ per hour (never 60, which is 1 cm³ per minute and makes the
 * answer the rate after), a volume to 5 cm³ of at most 90% of the drink and at most 12 cm³ per
 * minute. The rate after the drink in cm³ per hour is exact to 0.1 and the ratio exact to 0.1,
 * 2.5 to 15, none of the figures with the point moved, doubled or halved. The tolerance is half a
 * unit in the first place, and the ratio of the per-minute rates each rounded to 2 places lies
 * inside it. Requiring both per-minute rates to be exact let 30, 75 and 150 minutes, and the
 * round ratios 4, 5, 8, 10 and 2.5, fill most of the builds.
 */
function flows(d: Drink): Flow[] {
  const out: Flow[] = []
  for (let rest = 30; rest <= 90; rest++) {
    if (rest === 60) continue
    const restMin = rest / 60
    for (const t of PERIODS) {
      const hours = clean(t / 60)
      for (let v = 100; v <= 0.9 * d.cm3; v += 5) {
        const afterMin = v / t
        const afterHour = clean(v / hours)
        const ratio = clean(afterHour / rest)
        if (afterMin > 12 || !atMost(afterHour, 1) || !atMost(ratio, 1) || ratio < 2.5 || ratio > 15) continue
        const tol = toPlaces(ratio, 1)
        if (Math.abs(twoPlaces(afterMin) / twoPlaces(restMin) - ratio) > tol) continue
        if (!shiftFree(ratio, rest, v, t, d.cm3, restMin, afterMin, afterHour)) continue
        out.push({ rest, v, t, restMin, afterMin, clean: atMost(restMin, 2) && atMost(afterMin, 2), hours, afterHour, ratio, tol })
      }
    }
  }
  return out
}

/** (volume ÷ time) ÷ resting rate, in the same units: written as q27 (60 cm³ per hour; 540 cm³ in 90 minutes, 6). */
export const urineRate: Generator = {
  id: 'urine-rate-ratio',
  subjectId: 'biology',
  topicId: KIDNEY,
  replaces: ['q27'],
  build(r, slot, turn) {
    const d = DRINKS[turn % DRINKS.length]!
    // The ratio, resting rate and period all spread: drawing them in turn let round ratios (2.5, 4, 5, 8, 10), a round
    // resting rate or one period fill a quarter to a half of a context.
    const x = balanced(r, `urine-rate-ratio:${d.name}`, () => flows(d), (y) => y.ratio, (y) => y.rest, (y) => y.t)
    const hourWord = x.hours === 1 ? 'hour' : 'hours'
    const perHour =
      `${x.t} minutes is ${show(x.hours)} ${hourWord}, so after the drink $${x.v} \\div ${show(x.hours)} = ${show(x.afterHour)}$ cm³ per hour, ` +
      `and $${show(x.afterHour)} \\div ${x.rest} = ${show(x.ratio)}$`
    const [rm, am] = [twoPlaces(x.restMin), twoPlaces(x.afterMin)]
    /** A per-minute rate: exact when it is, else "about" and two places. */
    const perMin = (exact: number, two: number) => (atMost(exact, 2) ? show(exact) : `about ${fixed(two, 2)}`)
    const perMinute = x.clean
      ? `At rest: ${x.rest} cm³ per hour $= \\dfrac{${x.rest}}{60} = ${show(x.restMin)}$ cm³ per minute. After the drink: $\\dfrac{${x.v}}{${x.t}} = ${show(x.afterMin)}$ cm³ per minute. So the rate is $\\dfrac{${show(x.afterMin)}}{${show(x.restMin)}} = ${show(x.ratio)}$ times greater.`
      : `In cm³ per minute, $${x.rest} \\div 60 ${atMost(x.restMin, 2) ? '=' : '\\approx'} ${atMost(x.restMin, 2) ? show(x.restMin) : fixed(rm, 2)}$ and $${x.v} \\div ${x.t} ${atMost(x.afterMin, 2) ? '=' : '\\approx'} ${atMost(x.afterMin, 2) ? show(x.afterMin) : fixed(am, 2)}$, and the one over the other is also ${fixed(x.ratio, 1)} to 1 decimal place.`
    return numeric(
      slot,
      {
        prompt:
          `At rest, a person produces urine at a rate of ${x.rest} cm³ per hour. After drinking ${d.what}, the person produces ${x.v} cm³ of urine over the next ${x.t} minutes. ` +
          'Calculate how many times greater the rate of urine production is after the drink than at rest.',
        solution:
          (x.clean ? `Put both rates in the same units. ${perMinute} (In cm³ per hour: ${perHour}.) ` : `Put both rates in the same units, cm³ per hour. ${cap(perHour)} times greater. (${perMinute}) `) +
          'The drink made the blood more dilute, so the pituitary gland released **less ADH**, the collecting duct became **less permeable** to water, **less water was reabsorbed**, and a large volume of dilute urine was produced.',
        method: [
          x.clean
            ? `converts both rates to the same units: ${show(x.restMin)} and ${show(x.afterMin)} cm³ per minute, or ${x.rest} and ${show(x.afterHour)} cm³ per hour`
            : `converts both rates to the same units: ${x.rest} and ${show(x.afterHour)} cm³ per hour, or ${perMin(x.restMin, rm)} and ${perMin(x.afterMin, am)} cm³ per minute`,
          'divides one rate by the other',
        ],
        answer: x.ratio,
        tolerance: x.tol,
        units: unitsOf(slot),
      },
      // Second route: the per-minute rates, unrounded.
      { agrees: near(x.afterMin / x.restMin, x.ratio), detail: `${show(x.afterMin)} ÷ ${show(x.restMin)} = ${show(x.afterMin / x.restMin)}` },
      { context: d.name, rest: x.rest, v: x.v, t: x.t, ratio: x.ratio },
    )
  },
}

// =============================================================================================
// The menstrual cycle and fertility
// =============================================================================================

// ---------------------------------------------------------------------------------------------
// q28: the percentage of women who did not become pregnant
// ---------------------------------------------------------------------------------------------

interface Method {
  name: string
  study: (n: number) => string
  /** The percentage who become pregnant in a year of typical use. */
  p: readonly [number, number]
  /** "includes everyday mistakes such as …". */
  slip: string
  perfect: string
  last: string
}
const METHODS: Method[] = [
  {
    name: 'pill',
    study: (n) => `In a study, ${n} women used the contraceptive pill for one year.`,
    p: [7, 11],
    slip: 'a missed pill',
    perfect: 'used perfectly, the pill prevents pregnancy in over 99% of women in a year',
    last: 'The gap between the two is the strongest argument for the implant and the injection, which do not depend on remembering a pill every day.',
  },
  {
    name: 'condom',
    study: (n) => `In a study, ${n} women whose partners used condoms as their only contraception were followed for one year.`,
    p: [15, 21],
    slip: 'putting the condom on late, or its splitting or slipping off',
    perfect: 'used perfectly every time, condoms prevent pregnancy in 98% of women in a year',
    last: 'Condoms are the only method here that also protects against sexually transmitted infections.',
  },
  {
    name: 'diaphragm',
    study: (n) => `In a study, ${n} women used a diaphragm with spermicide for one year.`,
    p: [12, 29],
    slip: 'putting it in wrongly or taking it out too soon after sex',
    perfect: 'used perfectly, a diaphragm with spermicide prevents pregnancy in 92 to 96% of women in a year',
    last: 'It is a barrier method: it stops sperm reaching the egg, and the spermicide kills or disables the sperm.',
  },
  {
    name: 'injection',
    study: (n) => `In a study, ${n} women used the contraceptive injection for one year.`,
    p: [4, 8],
    slip: 'having the next injection late',
    perfect: 'used perfectly, the injection prevents pregnancy in over 99% of women in a year',
    last: 'Each injection slowly releases a hormone like progesterone that stops eggs maturing and being released for weeks, so the only thing to remember is the date of the next one.',
  },
]
interface Study {
  n: number
  k: number
  /** The percentage not pregnant unrounded, and to 3 s.f. */
  exact: number
  ans: number
}
/**
 * Any group of 120 to 1000 women (never a power of ten), at least three pregnancies at a rate in the
 * method's range, and the answer to 3 s.f. with a clear rounding, none of the counts with the point
 * moved. Exact percentages tied the groups to 250 and 500 women and a few round answers.
 */
function study(r: Rng, m: Method): Study {
  return draw(
    r,
    () => {
      const n = int(r, 120, 1000)
      const k = int(r, Math.ceil((m.p[0] * n) / 100), Math.floor((m.p[1] * n) / 100))
      const exact = ((n - k) / n) * 100
      return { n, k, exact, ans: sigFigs(exact, 3) }
    },
    (x) => !powerOfTen(x.n) && x.k >= 3 && clearAtSigFigs(x.exact, 3, 0.1) && shiftFree(x.ans, x.n, x.k, x.n - x.k),
  )
}

/** (women − pregnancies) ÷ women × 100: written as q28 (18 of 200, 91%). */
export const notPregnant: Generator = {
  id: 'contraception-effectiveness',
  subjectId: 'biology',
  topicId: FERTILITY,
  replaces: ['q28'],
  build(r, slot, turn) {
    const m = METHODS[turn % METHODS.length]!
    const x = study(r, m)
    const not = x.n - x.k
    return numeric(
      slot,
      {
        prompt: `${m.study(x.n)} During the year, ${x.k} of them became pregnant. Calculate the percentage of the women who did not become pregnant.`,
        solution:
          `Did not become pregnant: $${x.n} - ${x.k} = ${not}$. Percentage $= \\dfrac{${not}}{${x.n}} \\times 100 = ${threeWorking(x.exact, x.ans)}\\%$. ` +
          `Figures like this describe **typical use**, which includes everyday mistakes such as ${m.slip}; ${m.perfect}. ${m.last}`,
        method: [`subtracts ${x.k} from ${x.n} (${not}) and divides by ${x.n} (× 100)`],
        answer: x.ans,
        // The 3 s.f. answer, wide enough for the unrounded one.
        tolerance: sfTolerance(x.ans, 3),
        units: unitsOf(slot),
        line: `${near(x.exact, x.ans) ? show(x.ans) : sigText(x.ans, 3)}%`,
      },
      // Second route: 100% less the share who became pregnant.
      { agrees: Math.abs(100 - (x.k / x.n) * 100 - x.ans) <= sfTolerance(x.ans, 3), detail: `100 − ${x.k} ÷ ${x.n} × 100 = ${show(100 - (x.k / x.n) * 100)}` },
      { context: m.name, n: x.n, k: x.k, ans: x.ans },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q29: how many times greater one clinic's IVF success rate is
// ---------------------------------------------------------------------------------------------

interface Age {
  name: string
  who: string
  /** Births per cycle, in %, for the age group. */
  rate: readonly [number, number]
}
const AGES: Age[] = [
  { name: 'under 35', who: 'women under 35', rate: [20, 40] },
  { name: '35 to 37', who: 'women aged 35 to 37', rate: [15, 30] },
  { name: '38 to 39', who: 'women aged 38 to 39', rate: [10, 22] },
  { name: '40 to 42', who: 'women aged 40 to 42', rate: [5, 15] },
]
interface Clinic {
  n: number
  b: number
  /** The success rate unrounded, and to 3 s.f. as the working prints it. */
  rate: number
  shown: number
}
interface Clinics {
  hi: Clinic
  lo: Clinic
  /** The ratio of the rates unrounded, of the printed rates, and to 3 s.f. */
  exact: number
  printed: number
  ratio: number
  tol: number
}
const clinic = (n: number, b: number): Clinic => ({ n, b, rate: (b / n) * 100, shown: sigFigs((b / n) * 100, 3) })
/**
 * Two clinics of 80 to 400 cycles at success rates in the age group's range, each rate rounding
 * clearly to 3 s.f. The better one has fewer cycles and fewer births. The ratio of the rates is
 * 1.15 to 3, its 3 s.f. rounding clear and the same whether the rates are rounded first or not;
 * the tolerance, about 1%, takes either route. Neither the births' ratio nor the cycles' is within
 * marking distance, and the answer is none of the figures with the point moved. Rates exact to
 * 0.1% left clinics of 200, 250 and 400 cycles in a third of the builds.
 */
function clinicPair(r: Rng, a: Age): Clinics {
  const births = (n: number) => int(r, Math.ceil((a.rate[0] * n) / 100), Math.floor((a.rate[1] * n) / 100))
  return draw(
    r,
    () => {
      const nHi = int(r, 80, 360)
      const nLo = int(r, nHi + 20, 400)
      const hi = clinic(nHi, births(nHi))
      const lo = clinic(nLo, births(nLo))
      const exact = hi.rate / lo.rate
      const ratio = sigFigs(exact, 3)
      const printed = hi.shown / lo.shown
      return { hi, lo, exact, printed, ratio, tol: onePercent(ratio) }
    },
    ({ hi, lo, exact, printed, ratio, tol }) =>
      lo.b > hi.b &&
      between(exact, [1.15, 3]) &&
      [exact, hi.rate, lo.rate].every((x) => clearAtSigFigs(x, 3, 0.1)) &&
      sigFigs(printed, 3) === ratio &&
      Math.abs(printed - ratio) <= tol &&
      Math.abs(lo.b / hi.b - ratio) > 2 * tol &&
      Math.abs(lo.n / hi.n - ratio) > 2 * tol &&
      distinct(hi.n, lo.n, hi.b, lo.b) &&
      !powerOfTen(hi.n) &&
      !powerOfTen(lo.n) &&
      shiftFree(ratio, hi.n, lo.n, hi.b, lo.b, hi.shown, lo.shown),
  )
}

/** rate ÷ rate: written as q29 (36 of 160 and 45 of 300, 1.5). */
export const ivfRates: Generator = {
  id: 'ivf-success-rate-ratio',
  subjectId: 'biology',
  topicId: FERTILITY,
  replaces: ['q29'],
  build(r, slot, turn) {
    const a = AGES[turn % AGES.length]!
    const x = clinicPair(r, a)
    // Which clinic is the better one is drawn: a student cannot assume A.
    const better = pick(r, ['A', 'B'] as const)
    const worse = better === 'A' ? 'B' : 'A'
    const [A, B] = better === 'A' ? [x.hi, x.lo] : [x.lo, x.hi]
    const rateLine = (c: Clinic) => `$\\dfrac{${c.b}}{${c.n}} \\times 100 = ${threeWorking(c.rate, c.shown)}\\%$`
    return numeric(
      slot,
      {
        prompt:
          `Clinic A carried out ${A.n} cycles of IVF for ${a.who} in a year, and ${A.b} of them led to the birth of a baby. Clinic B carried out ${B.n} cycles for women of the same age, and ${B.b} of them led to a birth. ` +
          `A patient says Clinic ${worse} must be better because it had more births. Calculate how many times greater the success rate of Clinic ${better} was than that of Clinic ${worse}.`,
        solution:
          `Success rates: Clinic A ${rateLine(A)}; Clinic B ${rateLine(B)}. So $\\dfrac{${sigText(x.hi.shown, 3)}}{${sigText(x.lo.shown, 3)}} = ${threeWorking(x.printed, x.ratio)}$ times. ` +
          `Comparing the raw numbers of births, ${x.lo.b} against ${x.hi.b}, misleads because Clinic ${worse} carried out ${x.lo.n - x.hi.n} more cycles. ` +
          'A success rate per cycle is what the patient needs, compared for women of the same age because success falls with age, and both figures also show that **the success rate of IVF is not high**, one of the points an evaluation of IVF has to make.',
        method: [`converts both to a success rate: ${sigText(A.shown, 3)}% and ${sigText(B.shown, 3)}%`, 'divides one rate by the other'],
        answer: x.ratio,
        tolerance: x.tol,
        units: unitsOf(slot),
        line: near(x.exact, x.ratio) ? show(x.ratio) : sigText(x.ratio, 3),
      },
      // Second route: births per cycle compared directly, as fractions.
      { agrees: Math.abs((x.hi.b * x.lo.n) / (x.hi.n * x.lo.b) - x.ratio) <= x.tol, detail: `(${x.hi.b} × ${x.lo.n}) ÷ (${x.hi.n} × ${x.lo.b})` },
      { context: a.name, better, nHi: x.hi.n, bHi: x.hi.b, nLo: x.lo.n, bLo: x.lo.b, ratio: x.ratio },
    )
  },
}

export const bodyGenerators: Generator[] = [
  bmi,
  waistToHip,
  glucoseFall,
  bmiLoss,
  cardiacOutput,
  strokeVolumeRise,
  heartRateFromOutput,
  outputIncrease,
  outputRatio,
  adrenalinTable,
  pulseCount,
  extraBlood,
  impulseSpeed,
  reflexTime,
  rulerMean,
  reactionChange,
  colourBlind,
  pupilArea,
  skinFlow,
  sweatEnergy,
  reabsorbed,
  urineRate,
  notPregnant,
  ivfRates,
]

/** The context lists, for the tests. */
export const BODY = { BANDS, ADULTS, SHAPES, FALLS, TARGETS, OUTPUTS, EFFORTS, RATINGS, RISES, SESSIONS, SHOCKS, COUNTS, FRIGHTS, PATHS, ARCS, CATCHERS, CHANGES, LIGHTS, WARMTHS, SWEATS, DAYS, DRINKS, PERIODS, METHODS, AGES }
