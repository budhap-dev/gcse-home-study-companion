import { fixed, show } from '../format.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import type { Generator } from '../types.ts'
import { G, G_STATED, atMost, cap, closes, figures, near, numeric, prose, tex } from './build.ts'
import { dpTolerance } from './format.ts'

/**
 * Hooke's law and elasticity (AQA 8463, 5.3): F = ke, the elastic potential energy
 * ½ke², and the required practical's data. Every numeric question without a diagram has a
 * generator here; the graph question (q12) keeps its written figure. Springs come from lists
 * that carry the spring constants and extensions each one really has: a school-lab spring is
 * tens of N/m and stretches a few centimetres, a car's suspension spring is tens of thousands.
 */
const TOPIC = 'hookes-law'

const clean = (x: number) => Number(show(x))
/** Every value from lo to hi in steps of `step`. */
const steps = (lo: number, hi: number, step: number) => Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => clean(lo + i * step))
/** 0.1, 1, 10, 100: a figure that only moves the point. */
const powerOfTen = (x: number) => x > 0 && Math.abs(Math.log10(x) - Math.round(Math.log10(x))) < 1e-9
/** 9.8, its half and its double, with the point anywhere: 0.098 J or 4.9 cm reads as g. */
const echoesG = (x: number) => [9.8, 4.9, 19.6].some((g) => powerOfTen(x / g))

/**
 * One value from the first list, then one from the values that suit it, each drawn evenly. A
 * first value with nothing to suit it is drawn again, so the first list's spread survives:
 * drawing both at random and keeping clean pairs lets the easiest value carry the slot.
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

// ---------------------------------------------------------------------------------------------
// Springs that stretch
// ---------------------------------------------------------------------------------------------

interface Spring {
  /** With its article, as it reads mid-sentence: "a spring in a school lab". */
  noun: string
  k: [number, number]
  kStep: number
  /** Extension in cm. */
  e: [number, number]
  eStep: number
  /** Decimal places the force on it may print to. */
  fDp: number
}
/** Springs that stretch, with the stiffness and stretch each really has. */
const SPRINGS: Spring[] = [
  { noun: 'a spring in a school lab', k: [10, 50], kStep: 5, e: [2, 20], eStep: 1, fDp: 1 },
  { noun: 'a stiff steel spring', k: [100, 500], kStep: 10, e: [1, 8], eStep: 0.5, fDp: 1 },
  { noun: 'the spring inside a newton meter', k: [20, 200], kStep: 10, e: [2, 10], eStep: 0.5, fDp: 2 },
  { noun: 'one of the springs round a trampoline', k: [2000, 6000], kStep: 250, e: [2, 12], eStep: 1, fDp: 0 },
  { noun: 'one spring of a chest expander', k: [100, 400], kStep: 25, e: [10, 50], eStep: 5, fDp: 0 },
  { noun: 'the spring of a garden gate', k: [200, 800], kStep: 20, e: [2, 10], eStep: 1, fDp: 1 },
]

/**
 * A spring constant (never 10 or 100 N/m), then an extension in cm whose force prints to the
 * context's decimal places. Never an extension of 1 or 10 cm (0.01 or 0.1 m only moves the point), never a
 * force equal to the spring constant or the extension.
 */
function stretched(r: Rng, s: Spring, ok: (k: number, e: number, F: number) => boolean = () => true) {
  const [k, e] = follow(r, steps(s.k[0], s.k[1], s.kStep).filter((k) => !powerOfTen(k)), (k) =>
    steps(s.e[0], s.e[1], s.eStep).filter((e) => {
      const F = clean((k * e) / 100)
      return !powerOfTen(e) && atMost(F, s.fDp) && F >= 0.2 && F !== k && F !== e && F !== clean(e / 100) && ok(k, e, F)
    }),
  )
  return { k, e, em: clean(e / 100), F: clean((k * e) / 100) }
}

/**
 * F = ke: written as q2 (20 N/m extended by 0.5 m, 10 N, 2 marks, grade 4–5). The extension
 * is given in metres, as written.
 */
export const forceFromSpringConstant: Generator = {
  id: 'force-from-spring-constant',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q2'],
  build(r, slot, turn) {
    const s = SPRINGS[turn % SPRINGS.length]!
    const { k, em, F } = stretched(r, s)
    const prompt = pick(r, [
      `${cap(s.noun)} has a spring constant of ${prose(k)} N/m. Calculate the force needed to extend it by ${show(em)} m, in newtons.`,
      `${cap(s.noun)} has a spring constant of ${prose(k)} N/m. What force, in newtons, stretches it by ${show(em)} m?`,
    ])
    // Second route: the force over the spring constant gives the extension back.
    return numeric(
      slot,
      {
        prompt,
        solution: closes(`F = k e = ${tex(k)} \\times ${tex(em)}`, F, 'N'),
        method: [`$F = ke = ${tex(k)} \\times ${tex(em)}$`],
        answer: F,
        tolerance: dpTolerance(F),
        units: 'N',
      },
      { agrees: near(F / k, em), detail: `${show(F)} ÷ ${k} = ${show(F / k)} m` },
      { context: s.noun, k, e: em },
    )
  },
}

/**
 * e = F ÷ k: written as q5 (3 N on 15 N/m, 0.2 m, 2 marks). The force is given and the
 * extension, in metres, is the answer.
 */
export const extensionFromForce: Generator = {
  id: 'extension-from-force',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q5'],
  build(r, slot, turn) {
    const s = SPRINGS[turn % SPRINGS.length]!
    const { k, em, F } = stretched(r, s)
    const prompt = pick(r, [
      `${cap(s.noun)} has a spring constant of ${prose(k)} N/m. It is pulled with a force of ${prose(F)} N. Calculate its extension in metres.`,
      `A force of ${prose(F)} N stretches ${s.noun}, which has a spring constant of ${prose(k)} N/m. Calculate the extension, in metres.`,
    ])
    // Second route: forwards, the spring constant times the extension found.
    return numeric(
      slot,
      {
        prompt,
        solution: closes(`e = \\dfrac{F}{k} = \\dfrac{${tex(F)}}{${tex(k)}}`, em, 'm'),
        method: [`$e = F \\div k = ${tex(F)} \\div ${tex(k)}$`],
        answer: em,
        tolerance: dpTolerance(em),
        units: 'm',
      },
      { agrees: near(k * em, F), detail: `${k} × ${show(em)} = ${show(k * em)} N` },
      { context: s.noun, k, F },
    )
  },
}

/** Springs that are squashed, with the stiffness, squash and load each really has. */
interface Squashed {
  noun: string
  /** How the force arrives: "when a load of 1000 N is placed on it". */
  load: (F: string) => string
  k: [number, number]
  kStep: number
  e: [number, number]
  eStep: number
  fDp: number
  /** The force a person standing or pressing really gives, where it is one. */
  f?: [number, number]
}
const SQUASHED: Squashed[] = [
  { noun: 'a car suspension spring', load: (F) => `when a load of ${F} N is placed on it`, k: [20000, 60000], kStep: 1000, e: [2, 10], eStep: 1, fDp: 0 },
  { noun: "the spring in a motorbike's rear suspension", load: (F) => `when a load of ${F} N is placed on it`, k: [8000, 20000], kStep: 500, e: [2, 10], eStep: 1, fDp: 0 },
  { noun: 'one spring in a mattress', load: (F) => `when a force of ${F} N presses down on it`, k: [500, 3000], kStep: 100, e: [1, 5], eStep: 0.5, fDp: 0 },
  { noun: 'the spring of a pogo stick', load: (F) => `when a child of weight ${F} N stands on it`, k: [4000, 12000], kStep: 500, e: [2, 12], eStep: 1, fDp: 0, f: [200, 500] },
  { noun: 'a buffer spring at the end of a railway line', load: (F) => `when a train pushes on it with a force of ${F} N`, k: [200000, 900000], kStep: 50000, e: [2, 15], eStep: 1, fDp: 0 },
  { noun: 'the spring in a retractable pen', load: (F) => `when a thumb presses on it with a force of ${F} N`, k: [200, 600], kStep: 20, e: [0.5, 1.5], eStep: 0.1, fDp: 2, f: [1, 6] },
]

/**
 * k = F ÷ e with the extension in cm: written as q4 (8 N stretches a spring 16 cm, 50 N/m, 3
 * marks) and q13 (a car suspension spring squashed 4 cm by 1000 N, 25 000 N/m, 3 marks). q4
 * keeps to springs that stretch and q13 to springs that are squashed, with the note that
 * compression follows the same law. The spring constant is drawn first and is the answer.
 */
export const springConstantFromForce: Generator = {
  id: 'spring-constant-from-force-and-extension',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q4', 'q13'],
  build(r, slot, turn) {
    const squash = slot.id === 'q13'
    const list: (Spring | Squashed)[] = squash ? SQUASHED : SPRINGS
    const s = list[turn % list.length]!
    const f = 'f' in s ? s.f : undefined
    // Never 50 cm (0.5 m makes k the force doubled), nor a spring constant equal to the extension.
    const { k, e, em, F } = stretched(r, s, (k, e, F) => e !== 50 && k !== e && (!f || (F >= f[0] && F <= f[1])))
    let prompt: string
    if (squash) {
      const q = s as Squashed
      prompt = pick(r, [
        `${cap(q.noun)} is compressed by ${show(e)} cm ${q.load(prose(F))}. Calculate its spring constant in N/m.`,
        `${cap(q.noun)} is squashed by ${show(e)} cm ${q.load(prose(F))}. What is its spring constant, in N/m?`,
      ])
    } else {
      prompt = pick(r, [
        `A force of ${prose(F)} N extends ${s.noun} by ${show(e)} cm. Calculate the spring constant in N/m.`,
        `${cap(s.noun)} stretches by ${show(e)} cm when a force of ${prose(F)} N is applied. Calculate its spring constant, in N/m.`,
      ])
    }
    const expr = `k = \\dfrac{F}{e} = \\dfrac{${tex(F)}}{${tex(em)}}`
    const solution = `${squash ? 'Compression follows the same law as extension. ' : 'Convert first: '}$${show(e)}$ cm $= ${tex(em)}$ m. ${closes(expr, k, 'N/m')}`
    // Second route: forwards, the spring constant found times the extension in metres.
    return numeric(
      slot,
      {
        prompt,
        solution,
        method: [`${show(e)} cm converted to ${show(em)} m`, `$k = F \\div e = ${tex(F)} \\div ${tex(em)}$`],
        answer: k,
        units: 'N/m',
      },
      { agrees: near(k * em, F) && Number.isInteger(k), detail: `${k} × ${show(em)} = ${show(k * em)} N` },
      { context: s.noun, F, e },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Elastic potential energy
// ---------------------------------------------------------------------------------------------

/** E = ½ke² with e in cm, as a clean number of joules. */
const energy = (k: number, e: number) => clean(0.5 * k * (e / 100) ** 2)
/** An energy a student can key and read: at most four decimal places, three figures, never below 0.01 J. */
const cleanEnergy = (E: number) => atMost(E, 4) && figures(E) <= 3 && E >= 0.01 && !echoesG(E)

/** A spring constant (never 10 or 100 N/m), then an extension (never 1 or 10 cm) whose stored energy is clean. */
function stored(r: Rng, s: Spring, ok: (k: number, e: number, E: number) => boolean = () => true) {
  const [k, e] = follow(r, steps(s.k[0], s.k[1], s.kStep).filter((k) => !powerOfTen(k)), (k) =>
    steps(s.e[0], s.e[1], s.eStep).filter((e) => {
      const E = energy(k, e)
      return !powerOfTen(e) && cleanEnergy(E) && E !== e && E !== k && ok(k, e, E)
    }),
  )
  return { k, e, em: clean(e / 100), E: energy(k, e) }
}

/**
 * E = ½ke² with the extension in cm: written as q7 (200 N/m stretched 5 cm, 0.25 J, 2
 * marks). The conversion is in the one method line, as written.
 */
export const elasticEnergy: Generator = {
  id: 'elastic-potential-energy',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q7'],
  build(r, slot, turn) {
    const s = SPRINGS[turn % SPRINGS.length]!
    const { k, e, em, E } = stored(r, s)
    const prompt = pick(r, [
      `${cap(s.noun)} has a spring constant of ${prose(k)} N/m. It is extended by ${show(e)} cm. Calculate the elastic potential energy stored, in joules.`,
      `${cap(s.noun)}, of spring constant ${prose(k)} N/m, is stretched by ${show(e)} cm. Calculate the elastic potential energy it stores, in joules.`,
    ])
    // Second route: the average force, half of k e, times the extension.
    const viaForce = ((k * em) / 2) * em
    return numeric(
      slot,
      {
        prompt,
        solution: `Convert first: $${show(e)}$ cm $= ${tex(em)}$ m. ${closes(`E_e = \\tfrac{1}{2} k e^2 = \\tfrac{1}{2} \\times ${tex(k)} \\times ${tex(em)}^2`, E, 'J')}`,
        method: [`$\\frac{1}{2} \\times ${tex(k)} \\times ${tex(em)}^2$ with cm converted`],
        answer: E,
        tolerance: dpTolerance(E),
        units: 'J',
      },
      { agrees: near(viaForce, E), detail: `½ × ${k} × ${show(em)} × ${show(em)} = ${show(viaForce)} J` },
      { context: s.noun, k, e },
    )
  },
}

/**
 * k from a force and an extension, then the energy at another extension: written as q10 (3 N
 * stretches a spring 6 cm, then 0.25 J at 10 cm, 4 marks). The spring constant is a whole
 * number drawn first; both extensions are in cm, never 1 or 10 cm, and never the same.
 */
export const energyAtAnotherExtension: Generator = {
  id: 'elastic-energy-at-another-extension',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q10'],
  build(r, slot, turn) {
    const s = SPRINGS[turn % SPRINGS.length]!
    // The second extensions that suit a spring constant and a first extension: a clean energy,
    // never the first extension again, never an energy that is the force with its point moved
    // (26.4 N, then 0.264 J), nor one equal to either extension.
    const seconds = (k: number, e: number) =>
      steps(s.e[0], s.e[1], s.eStep).filter((e2) => {
        const E = energy(k, e2)
        const F = clean((k * e) / 100)
        return e2 !== e && !powerOfTen(e2) && cleanEnergy(E) && !powerOfTen(E / F) && E !== e2 && E !== e && e2 !== F && E !== k
      })
    const { k, e, F } = stretched(r, s, (k, e) => seconds(k, e).length > 0)
    const e2 = pick(r, seconds(k, e))
    const em2 = clean(e2 / 100)
    const E = energy(k, e2)
    const prompt = pick(r, [
      `${cap(s.noun)} extends by ${show(e)} cm when a force of ${prose(F)} N is applied. Calculate the elastic potential energy stored when the same spring is extended by ${show(e2)} cm, assuming it stays within its limit of proportionality.`,
      `A force of ${prose(F)} N stretches ${s.noun} by ${show(e)} cm. Assuming the spring stays within its limit of proportionality, calculate the elastic potential energy it stores when it is stretched by ${show(e2)} cm, in joules.`,
    ])
    const em = clean(e / 100)
    // Second route: the force grows in proportion to the extension, and the energy is half
    // the final force times the extension.
    const F2 = (F * e2) / e
    const viaForce = 0.5 * F2 * em2
    return numeric(
      slot,
      {
        prompt,
        solution: `$k = \\dfrac{F}{e} = \\dfrac{${tex(F)}}{${tex(em)}} = ${tex(k)}$ N/m. At ${show(e2)} cm, which is $${tex(em2)}$ m: ${closes(`E_e = \\tfrac{1}{2} \\times ${tex(k)} \\times ${tex(em2)}^2`, E, 'J')}`,
        method: [`$k = ${tex(k)}$ N/m`, `${show(e2)} cm converted to ${show(em2)} m`, `$\\frac{1}{2} \\times ${tex(k)} \\times ${tex(em2)}^2$`],
        answer: E,
        tolerance: dpTolerance(E),
        units: 'J',
      },
      { agrees: near(viaForce, E) && near(F / em, k), detail: `½ × ${show(F2)} N × ${show(em2)} m = ${show(viaForce)} J` },
      { context: s.noun, F, e, e2, k },
    )
  },
}

/**
 * k = 2E ÷ e² with the extension in cm: written as q15 (0.5 J at 10 cm, 100 N/m, 3 marks).
 * The spring constant is drawn first and is the answer; the extension is never 10 cm, whose
 * square only moves the point.
 */
export const springConstantFromEnergy: Generator = {
  id: 'spring-constant-from-stored-energy',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q15'],
  build(r, slot, turn) {
    const s = SPRINGS[turn % SPRINGS.length]!
    const { k, e, em, E } = stored(r, s)
    const em2 = clean(em * em)
    const twoE = clean(2 * E)
    const prompt = pick(r, [
      `${cap(s.noun)} stores ${show(E)} J of elastic potential energy when it is extended by ${show(e)} cm. Calculate its spring constant in N/m.`,
      `When ${s.noun} is stretched by ${show(e)} cm, it stores ${show(E)} J of elastic potential energy. Calculate the spring constant, in N/m.`,
    ])
    // Second route: forwards, the energy from the spring constant found.
    const forward = 0.5 * k * em * em
    return numeric(
      slot,
      {
        prompt,
        solution: `$E_e = \\tfrac{1}{2} k e^2$, so ${closes(`k = \\dfrac{2 E_e}{e^2} = \\dfrac{2 \\times ${tex(E)}}{${tex(em)}^2} = \\dfrac{${tex(twoE)}}{${tex(em2)}}`, k, 'N/m')}`,
        method: ['$k = 2E_e \\div e^2$', `${show(e)} cm converted to ${show(em)} m and squared`],
        answer: k,
        units: 'N/m',
      },
      { agrees: near(forward, E) && Number.isInteger(k), detail: `½ × ${k} × ${show(em)}² = ${show(forward)} J` },
      { context: s.noun, E, e },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Weights on springs
// ---------------------------------------------------------------------------------------------

interface Hung {
  name: string
  text: (m: string, k: string) => string
  k: [number, number]
  /** Mass in grams. */
  m: [number, number]
  mStep: number
  /** Extension in cm. */
  e: [number, number]
}
/** Masses hung on springs, in grams, with the spring constants and stretches each really has. */
const HUNG: Hung[] = [
  { name: 'slotted mass', text: (m, k) => `A mass of ${m} g is hung from a spring with spring constant ${k} N/m.`, k: [12, 90], m: [50, 500], mStep: 50, e: [2, 30] },
  { name: 'student', text: (m, k) => `A student hangs a mass of ${m} g from a spring of spring constant ${k} N/m.`, k: [12, 90], m: [50, 500], mStep: 50, e: [2, 30] },
  { name: 'apples', text: (m, k) => `A bag of apples of mass ${m} g hangs from a grocer's spring scale. The spring has a spring constant of ${k} N/m.`, k: [120, 500], m: [300, 2000], mStep: 100, e: [1, 10] },
  { name: 'fish', text: (m, k) => `An angler hangs a fish of mass ${m} g from a spring balance whose spring has a spring constant of ${k} N/m.`, k: [120, 600], m: [200, 3000], mStep: 50, e: [1, 15] },
  { name: 'toy', text: (m, k) => `A toy of mass ${m} g hangs from a newton meter. The spring inside has a spring constant of ${k} N/m.`, k: [20, 200], m: [50, 900], mStep: 10, e: [2, 10] },
  { name: 'bird feeder', text: (m, k) => `A bird feeder of mass ${m} g hangs from a spring with spring constant ${k} N/m.`, k: [30, 150], m: [200, 1000], mStep: 50, e: [2, 20] },
]

/**
 * Every (spring constant, mass, extension) a context offers: whole spring constants never 10,
 * 98 or 100 (the extension in cm would be the weight, or the mass, with its point moved), an
 * extension to the millimetre in the context's range that never echoes g (4.9, 9.8 or 19.6
 * cm) nor equals a given figure, and never a mass of 1 kg or 100 g.
 */
const HUNG_OPTIONS = new Map(
  HUNG.map((c) => {
    const out: { k: number; m: number; e: number }[] = []
    for (const k of steps(c.k[0], c.k[1], 1)) {
      if (powerOfTen(k)) continue
      for (const m of steps(c.m[0], c.m[1], c.mStep)) {
        const e = clean((0.98 * m) / k)
        if (atMost(e, 1) && e >= c.e[0] && e <= c.e[1] && !echoesG(e) && e !== k && e !== m && !powerOfTen(m / 1000) && !powerOfTen(e / m)) out.push({ k, m, e })
      }
    }
    return [c, out] as const
  }),
)
const distinct = (xs: number[]) => [...new Set(xs)]

/**
 * A spring constant and an extension, each spread: half the time the extension is drawn first
 * and then a spring constant that gives it, half the time the other way round. Extension
 * first alone let k = 49, which gives a clean extension for every mass, take 43% of a
 * context; spring constant first alone let 7 cm take a fifth. Alternating keeps both under a
 * quarter.
 */
function hung(r: Rng, c: Hung) {
  const all = HUNG_OPTIONS.get(c)!
  let k: number
  let e: number
  if (r() < 0.5) {
    e = pick(r, distinct(all.map((o) => o.e)))
    k = pick(r, distinct(all.filter((o) => o.e === e).map((o) => o.k)))
  } else {
    k = pick(r, distinct(all.map((o) => o.k)))
    e = pick(r, distinct(all.filter((o) => o.k === k).map((o) => o.e)))
  }
  return pick(r, all.filter((o) => o.k === k && o.e === e))
}

/**
 * Weight from a mass in grams, then e = W ÷ k, in cm: written as q9 (400 g on 49 N/m, 8 cm,
 * 3 marks, grade 8–9). The spring constant and extension come from hung(), which keeps
 * both spread, and the mass from those that give them.
 */
export const extensionFromHungMass: Generator = {
  id: 'extension-from-hung-mass',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q9'],
  build(r, slot, turn) {
    const c = HUNG[turn % HUNG.length]!
    const { k, m } = hung(r, c)
    const kg = clean(m / 1000)
    const W = clean(kg * G)
    const em = clean(W / k)
    const ecm = clean(em * 100)
    const prompt = pick(r, [
      `${c.text(prose(m), prose(k))} Taking $g = 9.8$ N/kg, calculate the extension in cm.`,
      `${c.text(prose(m), prose(k))} ${pick(r, G_STATED)} Calculate the extension of the spring, in cm.`,
    ])
    // Second route: forwards, the spring constant times the extension in metres is the weight,
    // and the weight over g is the mass.
    const back = (k * (ecm / 100)) / G
    return numeric(
      slot,
      {
        prompt,
        solution: `Convert the mass: ${prose(m)} g $= ${tex(kg)}$ kg. Weight $= ${tex(kg)} \\times 9.8 = ${tex(W)}$ N. $e = \\dfrac{W}{k} = \\dfrac{${tex(W)}}{${tex(k)}} = ${tex(em)}$ m $= ${show(ecm)}$ cm.`,
        method: [`$W = ${tex(kg)} \\times 9.8 = ${tex(W)}$ N`, `$e = ${tex(W)} \\div ${tex(k)}$`],
        answer: ecm,
        tolerance: dpTolerance(ecm),
        units: 'cm',
      },
      { agrees: near(back, kg), detail: `${k} × ${show(ecm / 100)} ÷ 9.8 = ${show(back)} kg` },
      { context: c.name, m, k },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// The required practical
// ---------------------------------------------------------------------------------------------

/**
 * Every (mass step, extension step) a student's table could show: masses in steps of 50, 100
 * or 200 g, extensions growing by a millimetre-readable step of at least 1 cm, and a spring
 * constant k = 0.98 × Δm ÷ Δe that is whole or has one decimal place. Never a k or a step that
 * echoes g (9.8, 4.9, 19.6, 98 …), nor a k of 10 or 100.
 */
const PRACTICAL = [50, 100, 200].flatMap((dm) =>
  steps(1, 5, 0.1)
    .map((de) => ({ dm, de, k: clean((0.98 * dm) / de) }))
    .filter(({ de, k }) => atMost(k, 1) && k >= 10 && k <= 300 && !echoesG(k) && !powerOfTen(k) && !echoesG(de)),
)
const PRACTICAL_K = [...new Set(PRACTICAL.map((p) => p.k))]

/**
 * A spring constant from a table of total lengths, leaving out the point past the limit of
 * proportionality: written as q16 (unstretched 4.0 cm, 100 to 400 g, 49 N/m, 4 marks). The
 * spring constant is drawn first from the ones a table can give, then the steps that give it.
 * Four or five readings; the last stretches 0.5 to 1.5 cm further than the straight line.
 */
export const springConstantFromPractical: Generator = {
  id: 'spring-constant-from-practical-data',
  subjectId: 'physics',
  topicId: TOPIC,
  replaces: ['q16'],
  build(r, slot) {
    const { dm, de, k, L0, n, extra } = draw(
      r,
      (r) => {
        const k = pick(r, PRACTICAL_K)
        const { dm, de } = pick(r, PRACTICAL.filter((p) => p.k === k))
        const n = int(r, 4, 5)
        const L0 = clean(2 + 0.5 * int(r, 0, 8))
        const extra = clean(0.5 + 0.1 * int(r, 0, 10))
        return { dm, de, k, L0, n, extra }
      },
      // A spring that ends no longer than 40 cm; an unstretched length that is not the step (the
      // total length would then be proportional to the load); an answer that is no length printed.
      ({ de, k, L0, n, extra }) =>
        L0 + n * de + extra <= 40 && L0 !== de && k !== L0 && !Array.from({ length: n }, (_, i) => clean(L0 + (i + 1) * de + (i === n - 1 ? extra : 0))).includes(k),
    )
    const masses = Array.from({ length: n }, (_, i) => (i + 1) * dm)
    const ext = masses.map((_, i) => clean((i + 1) * de + (i === n - 1 ? extra : 0)))
    const lengths = ext.map((e) => clean(L0 + e))
    const weights = masses.map((m) => clean((m / 1000) * G))
    const last = n - 2
    const eLast = clean(ext[last]! / 100)
    const list = masses.map((m, i) => `${m} g gives ${fixed(lengths[i]!, 1)} cm`).join(', ')
    const ask = 'use the straight part of the results to calculate the spring constant, in N/m.'
    const prompt = pick(r, [
      `A student hangs masses on a spring of unstretched length ${fixed(L0, 1)} cm and records the total length: ${list}. Taking $g = 9.8$ N/kg, ${ask}`,
      `A spring is ${fixed(L0, 1)} cm long with nothing hanging on it. A student adds masses and measures its total length each time: ${list}. Taking $g = 9.8$ N/kg, ${ask}`,
    ])
    const and = (xs: string[]) => `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`
    const straight = and(weights.slice(0, -1).map((w) => show(w)))
    const solution = `Extensions are ${and(ext.map((e) => fixed(e, 1)))} cm. The first ${n === 4 ? 'three' : 'four'} are proportional to the weights ${straight} N, so they are on the straight part; the ${masses.at(-1)} g point is past the limit of proportionality and is left out. ${closes(`k = \\dfrac{${tex(weights[last]!)}}{${tex(eLast)}}`, k, 'N/m')}`
    // Second route: the gradient between the first two readings, and the last reading off the line.
    const gradient = (weights[1]! - weights[0]!) / ((ext[1]! - ext[0]!) / 100)
    const lastRatio = weights[n - 1]! / (ext[n - 1]! / 100)
    return numeric(
      slot,
      {
        prompt,
        solution,
        method: [`Extension = total length − ${fixed(L0, 1)} cm, converted to metres`, 'Weight = mass in kg × 9.8', `${masses.at(-1)} g result excluded as beyond the limit of proportionality`],
        answer: k,
        tolerance: dpTolerance(k),
        units: 'N/m',
      },
      { agrees: near(gradient, k) && near(weights[last]! / eLast, k) && lastRatio < k * 0.99, detail: `gradient ${show(weights[1]! - weights[0]!)} ÷ ${show((ext[1]! - ext[0]!) / 100)} = ${show(gradient)} N/m; last point ${show(lastRatio)} N/m` },
      { context: `${dm} g steps`, dm, de, L0, n, extra, k },
    )
  },
}

export const hookeGenerators: Generator[] = [
  forceFromSpringConstant,
  extensionFromForce,
  springConstantFromForce,
  elasticEnergy,
  energyAtAnotherExtension,
  springConstantFromEnergy,
  extensionFromHungMass,
  springConstantFromPractical,
]
