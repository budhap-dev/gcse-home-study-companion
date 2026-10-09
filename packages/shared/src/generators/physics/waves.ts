import { clearOfHalf, fixed, show } from '../format.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import type { Generator } from '../types.ts'
import { atMost, cap, closes, near, numeric, prose, tex } from './build.ts'
import { dpTolerance, sci, sfTolerance } from './format.ts'

/**
 * Waves (AQA 8463, topic 6): the wave equation and period, the electromagnetic spectrum,
 * sound and hearing, echoes in ultrasound and echo sounding, lenses, and required practicals
 * 8 and 9. Every numeric written question in the six topics has a generator here; each keeps
 * its written wording, its speed of light (3 × 10⁸ m/s) or of sound (340 m/s in air, 1500 m/s
 * in water and tissue), and draws its figures from lists that carry what each context really
 * has: a long-wave station broadcasts on 1000 to 2000 m, a Wi-Fi router at 2.4 or 6 GHz.
 */
const EM = 'electromagnetic-spectrum'
const LENSES = 'lenses'
const LIGHT = 'light-reflection-and-refraction'
const SOUND = 'sound-waves'
const PROPERTIES = 'wave-properties'
const DETECTION = 'waves-for-detection-and-exploration'

/** Twelve significant figures, which clears binary residue and, unlike show(), keeps 1.2 × 10⁻¹¹. */
const exact = (x: number) => Number(x.toPrecision(12))
/** "an X-ray": the X is said "ex". */
const an = (noun: string) => `${/^(?:[aeiou]|X-)/i.test(noun) ? 'an' : 'a'} ${noun}`

/** Every value from lo to hi in steps of `step`. */
const steps = (lo: number, hi: number, step: number) => Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => Number(show(lo + i * step)))

/** The front number of x with the point after its first figure: 4.8 for 0.048. */
export function mantissa(x: number): number {
  let m = Math.abs(x) / 10 ** Math.floor(Math.log10(Math.abs(x)))
  if (m >= 10 - 1e-9) m /= 10
  if (m < 1 - 1e-9) m *= 10
  return Number(m.toPrecision(10))
}
/** a is b with only the point moved: their ratio is a power of ten. */
const moved = (a: number, b: number) => mantissa(a / b) === 1
/** a is b with the point moved, doubled or halved: a coincidence a student would learn as a rule. */
const echoes = (a: number, b: number) => [1, 2, 5].includes(mantissa(a / b))
/** No answer that echoes a given figure, and no two given figures that are the same digits. */
function unrelated(answer: number, givens: number[]): boolean {
  if (givens.some((g) => echoes(answer, g))) return false
  return givens.every((g, i) => givens.every((h, j) => j <= i || !moved(g, h)))
}

/** Significant figures of any number, however small: 1.25 × 10⁻¹¹ has three. */
const figs = (x: number) => Math.abs(x).toExponential(11).split('e')[0]!.replace('.', '').replace(/0+$/, '').length
function standard(x: number): [string, number] {
  const [, m, e] = /^(.+) \\times 10\^\{(-?\d+)\}$/.exec(sci(x, Math.max(2, figs(x))))!
  return [m!, Number(e)]
}
/** Standard form inside $…$ with the figures the number has, at least two: 2.4 \times 10^{9}, 4.0 \times 10^{9}. */
export function sciTex(x: number): string {
  const [m, e] = standard(x)
  return `${m} \\times 10^{${e}}`
}
const SUP: Record<string, string> = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }
/** Standard form in prose, as the written prompts print it: 3.0 × 10⁹. */
export function sciProse(x: number): string {
  const [m, e] = standard(x)
  return `${m} × 10${String(e).split('').map((c) => SUP[c]).join('')}`
}

/**
 * One value from the first list, then one from the values that suit it, each drawn evenly. A
 * first value with nothing to suit it is drawn again, so the first list's spread survives.
 */
function follow<A, B>(r: Rng, firsts: readonly A[], seconds: (a: A) => B[]): [A, B] {
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
// The electromagnetic spectrum: c = fλ with c = 3 × 10⁸ m/s
// ---------------------------------------------------------------------------------------------

const C = 3e8
/**
 * Front numbers m whose 3 ÷ m ends within three figures: 3 ÷ 1.2 = 2.5, 3 ÷ 4.8 = 0.625.
 * Never 1, 3 (the answer would be the speed's 3 or a power of ten), 2 or 5 (the speed halved
 * or doubled), and never 1.6 or 3.2, whose quotients (1.875, 0.9375) run to four figures.
 */
const FRONT = [1.2, 1.25, 1.5, 2.4, 2.5, 3.75, 4, 4.8, 6, 6.25, 7.5, 8]
/** Every m × 10ⁿ from lo to hi. */
function grid(lo: number, hi: number): number[] {
  const out: number[] = []
  for (let k = -15; k <= 13; k++) for (const m of FRONT) {
    const x = exact(m * 10 ** k)
    if (x >= lo * (1 - 1e-9) && x <= hi * (1 + 1e-9)) out.push(x)
  }
  return out.sort((a, b) => a - b)
}
/** 2.5 MHz, 200 kHz: a frequency as a radio dial gives it. */
const dial = (f: number) => (f >= 1e6 ? `${show(f / 1e6)} MHz` : `${show(f / 1e3)} kHz`)

interface Band {
  name: string
  /** The wavelengths the band really has, in m. */
  lambda: [number, number]
  /** The sentence that gives the wavelength. */
  text: (l: string) => string
}
/** Radio bands with the wavelengths each really broadcasts on, for q5. */
const RADIO: Band[] = [
  // The LF band, 30 to 300 kHz: long-wave broadcasting, time signals and navigation beacons.
  { name: 'low frequency', lambda: [1000, 10000], text: (l) => `A low-frequency radio signal has a wavelength of ${l} m.` },
  { name: 'medium wave', lambda: [187, 565], text: (l) => `A medium-wave radio station broadcasts on a wavelength of ${l} m.` },
  { name: 'shortwave', lambda: [10, 100], text: (l) => `A shortwave radio signal has a wavelength of ${l} m.` },
  { name: 'VHF', lambda: [1, 10], text: (l) => `A VHF radio signal has a wavelength of ${l} m.` },
  // UK television, 470 to 694 MHz.
  { name: 'UHF television', lambda: [0.43, 0.64], text: (l) => `A television transmitter sends out radio waves with a wavelength of ${l} m.` },
]
/** For q14 the wave is not named: a student finds the frequency and the group. */
const UNNAMED: Band[] = [
  { name: '10 to 100 m', lambda: [10, 100], text: (l) => l },
  { name: '100 to 1000 m', lambda: [100, 1000], text: (l) => l },
  { name: '1000 to 3000 m', lambda: [1000, 3000], text: (l) => l },
]
const UNNAMED_PROMPTS = [
  (l: string) => `An electromagnetic wave in air has a wavelength of ${l} m. What is its frequency, in Hz?`,
  (l: string) => `An electromagnetic wave travelling through air has a wavelength of ${l} m. Calculate its frequency, in Hz.`,
  (l: string) => `The wavelength of an electromagnetic wave in air is ${l} m. What is the frequency of the wave, in Hz?`,
  (l: string) => `An aerial picks up an electromagnetic wave with a wavelength of ${l} m. Calculate the frequency of the wave, in Hz.`,
  (l: string) => `A transmitter sends out electromagnetic waves of wavelength ${l} m through the air. What is their frequency, in Hz?`,
]
const RADIO_SPEED = ['Take the wave speed as 3 × 10⁸ m/s.', 'Radio waves travel at 3 × 10⁸ m/s.']
const RADIO_ASK = ['What is the frequency of the radio waves, in Hz?', 'Calculate the frequency of these waves, in Hz.']

/** The wavelengths a band offers whose frequency is a whole number of hertz to at most three figures. */
const bandGrid = (b: Band) => grid(b.lambda[0], b.lambda[1]).filter((l) => unrelated(exact(C / l), [l, C]))

/**
 * f = c ÷ λ for a radio wave: written as q5 (3.0 m, 1 × 10⁸ Hz, speed given, 3 marks) and q14
 * (2500 m "in air", 120 000 Hz, speed not given, grade 8–9). q5 names the band and states the
 * speed; q14 names neither, so the student must know that every electromagnetic wave travels
 * at 3 × 10⁸ m/s, and the solution places the wave in the radio group. The frequency always
 * has three figures or fewer, so it is exact and marked exactly.
 */
export const frequencyFromWavelength: Generator = {
  id: 'radio-frequency-from-wavelength',
  subjectId: 'physics',
  topicId: EM,
  replaces: ['q5', 'q14'],
  build(r, slot, turn) {
    const named = slot.id === 'q5'
    const list = named ? RADIO : UNNAMED
    const b = list[turn % list.length]!
    const l = pick(r, bandGrid(b))
    const f = exact(C / l)
    const prompt = named
      ? pick(r, [`${b.text(prose(l))} ${pick(r, RADIO_ASK)} ${pick(r, RADIO_SPEED)}`, `${pick(r, RADIO_SPEED)} ${b.text(prose(l))} ${pick(r, RADIO_ASK)}`])
      : pick(r, UNNAMED_PROMPTS)(prose(l))
    const work = closes(`f = \\dfrac{v}{\\lambda} = \\dfrac{3 \\times 10^8}{${tex(l)}}`, f, 'Hz')
    const solution = named
      ? `${work} That is ${dial(f)}.`
      : `Every electromagnetic wave travels at $3 \\times 10^8$ m/s in air. ${work} That is ${dial(f)}, which puts it in the radio group.`
    // Second route: the frequency found times the wavelength is the speed of light.
    const back = f * l
    return numeric(
      slot,
      {
        prompt,
        solution,
        method: ['rearranges to $f = v \\div \\lambda$', `$3 \\times 10^8 \\div ${tex(l)}$`],
        answer: f,
        units: 'Hz',
        line: f >= 1e6 ? `$${sciTex(f)}$ Hz` : `${prose(f)} Hz`,
      },
      { agrees: near(back, C) && Number.isInteger(f) && figs(f) <= 3, detail: `${f} × ${l} = ${back}` },
      { context: b.name, lambda: l },
    )
  },
}

interface Microwave {
  name: string
  /** As the prompt opens: "A mobile phone signal". */
  noun: string
  /** The frequencies it really uses, in Hz. */
  values: number[]
}
/** Microwave sources with the frequencies each really uses, for q6 and q19. */
const MICROWAVES: Microwave[] = [
  // From 1 GHz, so no microwave shares a wavelength with the television radio waves of q5.
  { name: 'microwave', noun: 'microwave', values: grid(1e9, 3e11) },
  // The UK mobile bands: 700 and 800 MHz, 1.5 GHz, 2.6 GHz and 3.4 to 3.8 GHz.
  { name: 'mobile phone', noun: 'mobile phone signal', values: [7.5e8, 8e8, 1.5e9, 2.5e9, 3.75e9] },
  // 2.4 GHz, the 6 GHz band (5.925 to 7.125 GHz) and the 60 GHz band (57 to 71 GHz).
  { name: 'Wi-Fi', noun: 'Wi-Fi signal', values: [2.4e9, 6e9, 6.25e9, 6e10, 6.25e10] },
  { name: 'satellite', noun: 'microwave signal sent to a satellite', values: grid(4e9, 4e10) },
  { name: 'radar', noun: 'radar pulse', values: grid(1e9, 4e10) },
].map((m) => ({ ...m, values: m.values.filter((f) => unrelated(exact(C / f), [f, C])) }))

/**
 * λ = c ÷ f for a microwave: written as q6 (3.0 × 10⁹ Hz, 0.1 m, the speed not given, 3
 * marks) and q19 (1.2 × 10¹⁰ Hz, the speed given, the answer in standard form, 3 marks).
 * q19's solution divides the front numbers and subtracts the powers, as the written one does.
 */
export const wavelengthFromFrequency: Generator = {
  id: 'microwave-wavelength-from-frequency',
  subjectId: 'physics',
  topicId: EM,
  replaces: ['q6', 'q19'],
  build(r, slot, turn) {
    const standardForm = slot.id === 'q19'
    const c = MICROWAVES[turn % MICROWAVES.length]!
    const f = pick(r, c.values)
    const l = exact(C / f)
    const [m, e] = standard(f)
    const q = exact(3 / Number(m))
    const p = 8 - e
    let prompt: string
    let solution: string
    let method: string[]
    let line: string
    if (standardForm) {
      const speed = 'The speed of light is $3.0 \\times 10^8$ m/s.'
      prompt = pick(r, [
        `${cap(an(c.noun))} has a frequency of $${sciTex(f)}$ Hz. ${speed} Calculate its wavelength in metres. Give your answer in standard form.`,
        `${speed} Calculate the wavelength, in metres, of ${an(c.noun)} with a frequency of $${sciTex(f)}$ Hz. Give your answer in standard form.`,
      ])
      /** Below 1, the front number moves into place before the answer. */
      const reached = q >= 1 ? '' : `$${show(q)} \\times 10^{${p}} = ${sciTex(l)}$, so `
      solution = `Rearrange $v = f\\lambda$ to $\\lambda = \\frac{v}{f} = \\frac{3.0 \\times 10^8}{${sciTex(f)}}$. Divide the numbers, $3.0 \\div ${m} = ${show(q)}$, and subtract the powers, $10^{8-${e}} = 10^{${p}}$: ${reached}**$${sciTex(l)}$ m**, which is ${show(l)} m.${q >= 1 ? '' : ' The front number must sit between 1 and 10, so the point moves one place and the power drops by one.'}`
      method = ['rearranges to $\\lambda = v \\div f$', `divides numbers and subtracts powers: $3.0 \\div ${m} = ${show(q)}$, $10^{8-${e}} = 10^{${p}}$`]
      line = `$${sciTex(l)}$ m`
    } else {
      prompt = pick(r, [
        `${cap(an(c.noun))} has a frequency of ${sciProse(f)} Hz. What is its wavelength, in metres?`,
        `What is the wavelength, in metres, of ${an(c.noun)} with a frequency of ${sciProse(f)} Hz?`,
      ])
      solution = `Microwaves travel at the speed of light, $3 \\times 10^8$ m/s. ${closes(`\\lambda = \\dfrac{v}{f} = \\dfrac{3 \\times 10^8}{${sciTex(f)}}`, l, 'm')}`
      method = ['rearranges to $\\lambda = v \\div f$', `$3 \\times 10^8 \\div (${sciTex(f)})$`]
      line = `${show(l)} m`
    }
    // Second route: the wavelength found times the frequency is the speed of light.
    const back = l * f
    return numeric(
      slot,
      { prompt, solution, method, answer: l, tolerance: dpTolerance(l), units: 'm', line },
      { agrees: near(back, C) && near(q * 10 ** p, l), detail: `${l} × ${f} = ${back}` },
      { context: c.name, f },
    )
  },
}

interface Ionising {
  name: string
  noun: string
  lambda: [number, number]
}
/** Short-wavelength groups, with the wavelengths each really has, for q11. */
const SHORT = (
  [
  { name: 'X-ray', noun: 'X-ray', lambda: [1e-11, 1e-8] },
  { name: 'gamma', noun: 'gamma ray', lambda: [1e-12, 1e-11] },
  { name: 'ultraviolet', noun: 'ray of ultraviolet light', lambda: [1e-8, 4e-7] },
  ] as Ionising[]
).map((s) => ({ ...s, values: grid(s.lambda[0], s.lambda[1]).filter((l) => unrelated(exact(C / l), [l, C])) }))

/**
 * f = c ÷ λ with a negative power, in standard form: written as q11 (an X-ray of 1 × 10⁻¹⁰ m,
 * 3 × 10¹⁸ Hz, 3 marks, grade 8–9, the speed not given). The frequency has three figures or
 * fewer; it is marked to half a unit in the third, because above 2⁵³ a whole number cannot
 * be told from its neighbour and a student's 1.25 × 10¹⁸ must still land on it.
 */
export const shortWavelengthFrequency: Generator = {
  id: 'short-wavelength-frequency',
  subjectId: 'physics',
  topicId: EM,
  replaces: ['q11'],
  build(r, slot, turn) {
    const c = SHORT[turn % SHORT.length]!
    const l = pick(r, c.values)
    const f = exact(C / l)
    const [m, e] = standard(l)
    const q = exact(3 / Number(m))
    const p = 8 - e
    const prompt = pick(r, [
      `${cap(an(c.noun))} has a wavelength of ${sciProse(l)} m. What is its frequency, in Hz? Give your answer in standard form.`,
      `Calculate the frequency, in Hz, of ${an(c.noun)} with a wavelength of ${sciProse(l)} m. Give your answer in standard form.`,
    ])
    /** Below 1, the front number moves into place before the answer. */
      const reached = q >= 1 ? '' : `$${show(q)} \\times 10^{${p}} = ${sciTex(f)}$, so `
    const solution = `$f = \\dfrac{v}{\\lambda} = \\dfrac{3 \\times 10^8}{${sciTex(l)}}$. Divide the numbers, $3 \\div ${m} = ${show(q)}$, and subtract the powers, $10^{8-(${e})} = 10^{${p}}$: ${reached}**$${sciTex(f)}$ Hz**, which is ${String(f)} Hz. A tiny wavelength gives a huge frequency, because their product is fixed.`
    // Second route: the frequency found times the wavelength is the speed of light.
    const back = f * l
    return numeric(
      slot,
      {
        prompt,
        solution,
        method: ['rearranges to $f = v \\div \\lambda$', `handles the negative power: $10^{8-(${e})} = 10^{${p}}$`],
        answer: f,
        tolerance: sfTolerance(f, 3),
        units: 'Hz',
        line: `$${sciTex(f)}$ Hz`,
      },
      { agrees: near(back, C) && near(q * 10 ** p, f) && f < 1e21, detail: `${f} × ${l} = ${back}` },
      { context: c.name, lambda: l },
    )
  },
}

interface Dose {
  name: string
  /** Doses in mSv this source really gives. */
  dose: [number, number]
  step: number
  text: (d: string) => string[]
}
/** Doses with the sizes each really has. */
const DOSES: Dose[] = [
  {
    name: 'CT scan of the abdomen',
    dose: [6, 14],
    step: 0.5,
    text: (d) => [`A patient receives a dose of ${d} mSv from a CT scan of the abdomen. What is this in sieverts?`, `A CT scan of the abdomen gives a patient a dose of ${d} mSv. What is this dose in sieverts?`],
  },
  {
    name: 'CT scan of the head',
    dose: [1.2, 3],
    step: 0.1,
    text: (d) => [`A patient receives a dose of ${d} mSv from a CT scan of the head. What is this in sieverts?`, `A CT scan of the head gives a patient a dose of ${d} mSv. What is this dose in sieverts?`],
  },
  {
    name: 'X-ray of the lower spine',
    dose: [0.5, 1.5],
    step: 0.1,
    text: (d) => [`An X-ray of the lower spine gives a patient a dose of ${d} mSv. What is this in sieverts?`, `A patient receives a dose of ${d} mSv from an X-ray of the lower spine. What is this dose in sieverts?`],
  },
  {
    name: 'background',
    // The UK average is about 2.7 mSv; most people receive 1.5 to 4.
    dose: [1.5, 4],
    step: 0.1,
    text: (d) => [`A person in the UK receives a dose of ${d} mSv in a year from background radiation. What is this in sieverts?`, `Background radiation gives a person living in the UK a dose of ${d} mSv in a year. What is this dose in sieverts?`],
  },
  {
    name: 'airline pilot',
    dose: [1, 5],
    step: 0.1,
    text: (d) => [`An airline pilot receives a dose of ${d} mSv in a year from cosmic rays. What is this in sieverts?`, `Cosmic rays give an airline pilot a dose of ${d} mSv in a year. What is this dose in sieverts?`],
  },
  {
    name: 'nuclear power station worker',
    // Typical yearly doses are a few mSv, far below the 20 mSv legal limit.
    dose: [0.5, 6],
    step: 0.1,
    text: (d) => [`A worker at a nuclear power station receives a dose of ${d} mSv in a year. What is this in sieverts?`, `In one year a nuclear power station worker receives a dose of ${d} mSv. What is this dose in sieverts?`],
  },
]

/**
 * A dose in mSv as sieverts: written as q9 (8 mSv, 0.008 Sv, 2 marks). The answer is the
 * given figure with the point moved three places, which is the skill, so that coincidence is
 * the one allowed; a dose of 1 or 10 mSv, which only moves a 1, is never drawn.
 */
export const doseInSieverts: Generator = {
  id: 'radiation-dose-in-sieverts',
  subjectId: 'physics',
  topicId: EM,
  replaces: ['q9'],
  build(r, slot, turn) {
    const c = DOSES[turn % DOSES.length]!
    const d = pick(r, steps(c.dose[0], c.dose[1], c.step).filter((d) => mantissa(d) !== 1))
    const sv = Number(show(d / 1000))
    // Second route: the sieverts back to millisieverts.
    const back = sv * 1000
    return numeric(
      slot,
      {
        prompt: pick(r, c.text(show(d))),
        solution: `1000 mSv = 1 Sv, so $${tex(d)} \\div 1000 = ${show(sv)}$ Sv.`,
        method: [`divides by 1000: $${tex(d)} \\div 1000$`],
        answer: sv,
        tolerance: dpTolerance(sv),
        units: 'Sv',
      },
      { agrees: near(back, d), detail: `${sv} × 1000 = ${show(back)} mSv` },
      { context: c.name, dose: d },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Lenses: magnification = image height ÷ object height
// ---------------------------------------------------------------------------------------------

interface Lens {
  name: string
  /** Object heights in its own unit, and the magnifications this lens really gives. */
  object: [number, number]
  oStep: number
  mag: [number, number]
  mStep: number
  /** Decimal places the image height may print to in its unit. */
  iDp: number
  /** Units of the object and the image, and the factor that turns the image's into the object's. */
  oUnit: string
  iUnit: string
  factor: number
  text: (o: string, i: string) => string
}
const MAGNIFYING: Lens[] = [
  { name: 'magnifying glass', object: [0.3, 1.5], oStep: 0.1, mag: [1.5, 5], mStep: 0.5, iDp: 2, oUnit: 'cm', iUnit: 'cm', factor: 1, text: (o, i) => `A magnifying glass is held over a printed letter ${o} cm tall. The image of the letter is ${i} cm tall. What is the magnification?` },
  { name: 'convex lens and screen', object: [1, 5], oStep: 0.5, mag: [1.2, 4], mStep: 0.1, iDp: 2, oUnit: 'cm', iUnit: 'cm', factor: 1, text: (o, i) => `An illuminated object ${o} cm tall is placed in front of a convex lens. A sharp image ${i} cm tall forms on a screen. What is the magnification?` },
  { name: 'projector', object: [2, 4], oStep: 0.1, mag: [20, 80], mStep: 5, iDp: 1, oUnit: 'cm', iUnit: 'cm', factor: 1, text: (o, i) => `A projector lens forms an image ${i} cm tall on a screen from a slide ${o} cm tall. What is the magnification?` },
  { name: 'object and image', object: [1, 10], oStep: 0.5, mag: [1.5, 6], mStep: 0.5, iDp: 2, oUnit: 'cm', iUnit: 'cm', factor: 1, text: (o, i) => `An object ${o} cm tall forms an image ${i} cm tall. What is the magnification?` },
]
const DIMINISHING: Lens[] = [
  { name: 'object and image', object: [2, 12], oStep: 0.5, mag: [0.2, 0.8], mStep: 0.05, iDp: 2, oUnit: 'cm', iUnit: 'cm', factor: 1, text: (o, i) => `An object ${o} cm tall forms an image ${i} cm tall. What is the magnification?` },
  { name: 'convex lens and screen', object: [2, 10], oStep: 0.5, mag: [0.2, 0.9], mStep: 0.05, iDp: 2, oUnit: 'cm', iUnit: 'cm', factor: 1, text: (o, i) => `An illuminated object ${o} cm tall is placed far from a convex lens. A sharp image ${i} cm tall forms on a screen. What is the magnification?` },
  { name: 'concave lens', object: [2, 8], oStep: 0.5, mag: [0.2, 0.8], mStep: 0.05, iDp: 2, oUnit: 'cm', iUnit: 'cm', factor: 1, text: (o, i) => `A concave lens forms an image ${i} cm tall of an object ${o} cm tall. What is the magnification?` },
  { name: 'camera', object: [150, 190], oStep: 1, mag: [0.004, 0.014], mStep: 0.001, iDp: 2, oUnit: 'cm', iUnit: 'cm', factor: 1, text: (o, i) => `A camera lens forms an image of a person ${o} cm tall on its sensor. The image is ${i} cm tall. What is the magnification?` },
]
/** q14 mixes units: the image's unit converts to the object's by `factor`. */
const MIXED: Lens[] = [
  { name: 'mm and cm', object: [1.5, 5], oStep: 0.5, mag: [0.3, 4], mStep: 0.1, iDp: 0, oUnit: 'cm', iUnit: 'mm', factor: 0.1, text: (o, i) => `An image is ${i} mm tall and the object is ${o} cm tall. What is the magnification?` },
  { name: 'ant', object: [3, 9], oStep: 1, mag: [1.5, 5], mStep: 0.5, iDp: 2, oUnit: 'mm', iUnit: 'cm', factor: 10, text: (o, i) => `An ant ${o} mm long is viewed through a magnifying glass. Its image is ${i} cm long. What is the magnification?` },
  { name: 'projector', object: [24, 36], oStep: 1, mag: [25, 80], mStep: 5, iDp: 2, oUnit: 'mm', iUnit: 'm', factor: 1000, text: (o, i) => `A projector forms an image ${i} m tall on a screen from a slide ${o} mm tall. What is the magnification?` },
  { name: 'convex lens and screen', object: [15, 60], oStep: 1, mag: [1.5, 4], mStep: 0.1, iDp: 1, oUnit: 'mm', iUnit: 'cm', factor: 10, text: (o, i) => `An object ${o} mm tall is placed in front of a convex lens. A sharp image ${i} cm tall forms on a screen. What is the magnification?` },
]

/**
 * Magnification = image height ÷ object height: written as q5 (2 cm to 6 cm, 3, 2 marks), q6
 * (3 cm to 1.5 cm, 0.5, 2 marks) and q14 (an image in mm over an object in cm, 1.5, 3 marks
 * with a conversion mark). q5 enlarges, q6 diminishes and q14 converts first; each lens
 * keeps the magnifications it really gives: a magnifying glass a few times, a projector
 * tens of times, a camera a small fraction.
 */
export const magnification: Generator = {
  id: 'lens-magnification',
  subjectId: 'physics',
  topicId: LENSES,
  replaces: ['q5', 'q6', 'q14'],
  build(r, slot, turn) {
    const list = slot.id === 'q5' ? MAGNIFYING : slot.id === 'q6' ? DIMINISHING : MIXED
    const c = list[turn % list.length]!
    const [mag, o] = follow(r, steps(c.mag[0], c.mag[1], c.mStep).filter((m) => mantissa(m) !== 1), (mag) =>
      steps(c.object[0], c.object[1], c.oStep).filter((o) => {
        const i = exact((o * mag) / c.factor)
        return atMost(i, c.iDp) && i > 0 && unrelated(mag, [o, i]) && mag !== o && mag !== i && i !== o
      }),
    )
    const i = exact((o * mag) / c.factor)
    const same = exact(i * c.factor)
    const larger = mag > 1 ? 'Greater than 1, so the image is larger than the object.' : 'Less than 1, so the image is smaller than the object.'
    const unitWord = c.oUnit
    let solution: string
    let method: string[]
    if (c.factor === 1) {
      solution = `$\\text{magnification} = \\dfrac{\\text{image height}}{\\text{object height}} = \\dfrac{${tex(i)}}{${tex(o)}} = ${show(mag)}$. ${larger}`
      method = [`image height over object height: $${tex(i)} \\div ${tex(o)}$`]
    } else {
      const raw = exact(i / o)
      const off = c.factor < 1 ? `${show(1 / c.factor)} times too large` : `${show(c.factor)} times too small`
      solution = `Convert first: ${show(i)} ${c.iUnit} is ${show(same)} ${unitWord}. Then $\\dfrac{${tex(same)}}{${tex(o)}} = ${show(mag)}$. Using ${show(i)} and ${show(o)} directly would give ${show(raw)}, which is ${off}. ${larger}`
      method = [`converts to the same unit: ${show(i)} ${c.iUnit} $= ${tex(same)}$ ${unitWord}`, `image height over object height: $${tex(same)} \\div ${tex(o)}$`]
    }
    // Second route: the object height times the magnification is the image height.
    const back = o * mag
    return numeric(
      slot,
      { prompt: c.text(show(o), show(i)), solution, method, answer: mag, tolerance: dpTolerance(mag) },
      { agrees: near(back, same) && near(same / o, mag), detail: `${o} × ${mag} = ${show(back)} ${unitWord}` },
      { context: c.name, o, i, mag },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Light: required practical 9
// ---------------------------------------------------------------------------------------------

const BLOCKS = ['glass block', 'Perspex block']

const REFLECTION_PROMPTS = [
  (b: string, a: number) => `In required practical 9, a ray hits the face of a ${b} at ${a}° to the normal. What angle of reflection, in degrees, should be measured?`,
  (b: string, a: number) => `A student shines a ray of light at the face of a ${b}. The angle of incidence, measured from the normal, is ${a}°. What angle of reflection, in degrees, should the student measure?`,
  (b: string, a: number) => `In required practical 9, the angle of incidence at the surface of a ${b} is ${a}°. Part of the ray reflects from the surface. What is the angle of reflection, in degrees?`,
]

/**
 * The law of reflection in required practical 9: written as q19 (25° to the normal, 25°, 1
 * mark). The answer is the given angle by the law itself, which is the point.
 */
export const angleOfReflection: Generator = {
  id: 'angle-of-reflection',
  subjectId: 'physics',
  topicId: LIGHT,
  replaces: ['q19'],
  build(r, slot, turn) {
    const b = BLOCKS[turn % BLOCKS.length]!
    const a = int(r, 10, 75)
    // Second route: from the surface, the incident ray is at 90 − a and so is the reflected one.
    const fromSurface = 90 - a
    return numeric(
      slot,
      {
        prompt: pick(r, REFLECTION_PROMPTS)(b, a),
        solution: `The angle of **reflection equals** the angle of **incidence**, both measured from the normal: **${a}°**.`,
        method: [],
        answer: a,
      },
      { agrees: 90 - fromSurface === a, detail: `90 − ${fromSurface} = ${90 - fromSurface}°` },
      { context: b, a },
    )
  },
}

const TRACE_PROMPTS = [
  (b: string, T: string, s: string) => `A ray is traced through a rectangular ${b} ${T} cm thick. It leaves the far face ${s} cm further along than it entered, measured parallel to the faces. Calculate the angle of refraction, in degrees, to the nearest degree.`,
  (b: string, T: string, s: string) => `In required practical 9, a student traces a ray through a rectangular ${b} ${T} cm thick. Inside the block the ray moves ${s} cm along the faces between entering and leaving. Calculate the angle of refraction, in degrees, to the nearest degree.`,
]
const degrees = (tan: number) => (Math.atan(tan) * 180) / Math.PI
/** How thick a school glass or Perspex block is, in cm, across the faces the ray crosses. */
const THICKNESS = [5, 6, 6.5, 7, 7.5, 8, 9]

/**
 * tan r = shift ÷ thickness from a traced ray: written as q24 (6.0 cm thick, 1.8 cm along,
 * 17°, 2 marks). The angle is drawn first, between 8° and 40° (glass and Perspex refract no
 * further than about 42°), then the shift to the millimetre a ruler gives; the angle must
 * round the same way from the printed tangent as from the exact one, and sit clear of a half.
 */
export const refractionFromTrace: Generator = {
  id: 'angle-of-refraction-from-a-trace',
  subjectId: 'physics',
  topicId: LIGHT,
  replaces: ['q24'],
  build(r, slot, turn) {
    const b = BLOCKS[turn % BLOCKS.length]!
    const { T, s, ratio, shown, deg, rounded } = draw(
      r,
      (r) => {
        const T = pick(r, THICKNESS)
        const target = int(r, 8, 40)
        const s = Number(fixed(T * Math.tan((target * Math.PI) / 180), 1))
        const ratio = s / T
        const shown = atMost(ratio, 3) ? Number(show(ratio)) : Number(ratio.toFixed(3))
        const deg = (Math.atan(ratio) * 180) / Math.PI
        return { T, s, ratio, shown, deg, rounded: Math.round(deg) }
      },
      // The angle must come out the same from the printed tangent and from the tangent a student
      // rounds first, to 2 decimal places as the written solution does or to 2 significant figures.
      ({ T, s, ratio, shown, deg, rounded }) =>
        s >= 0.5 &&
        rounded >= 8 &&
        rounded <= 40 &&
        clearOfHalf(deg, 0, 0.06) &&
        [shown, Number(ratio.toFixed(2)), Number(ratio.toPrecision(2))].every((t) => Math.round(degrees(t)) === rounded) &&
        !moved(s, T) &&
        !near(rounded, s * 10) &&
        rounded !== T,
    )
    const tan = atMost(ratio, 3) ? `= ${show(ratio)}` : `\\approx ${shown.toFixed(3)}`
    // Second route: the thickness times the tangent of the unrounded angle is the shift.
    const back = T * Math.tan((deg * Math.PI) / 180)
    return numeric(
      slot,
      {
        prompt: pick(r, TRACE_PROMPTS)(b, fixed(T, 1), fixed(s, 1)),
        solution: `Inside the block the ray runs straight from entry to exit. Across ${fixed(T, 1)} cm it shifts ${fixed(s, 1)} cm sideways, so $\\tan r = \\dfrac{${fixed(s, 1)}}{${fixed(T, 1)}} ${tan}$ and $r = ${deg.toFixed(1)}°$, which is **${rounded}°** to the nearest degree.`,
        method: [`$\\tan r = ${fixed(s, 1)} \\div ${fixed(T, 1)}$`],
        answer: rounded,
      },
      { agrees: near(back, s) && Math.abs(deg - rounded) < 0.5, detail: `${T} × tan ${deg.toFixed(3)}° = ${back.toFixed(4)} cm` },
      { context: b, T, s },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Sound: λ = v ÷ f in air at 340 m/s, and the limits of hearing
// ---------------------------------------------------------------------------------------------

/** A wavelength a student can print: three figures at most and four decimal places. */
const printable = (x: number) => atMost(x, 4) && figs(x) <= 3

interface Source {
  name: string
  /** The frequencies it really makes, in Hz. */
  f: [number, number]
  text: (f: string) => string
}
const SOUNDS = (
  [
  { name: 'signal generator', f: [20, 20000], text: (f) => `A loudspeaker connected to a signal generator produces a sound of frequency ${f} Hz.` },
  { name: 'whistle', f: [2000, 4500], text: (f) => `A referee's whistle produces a sound of frequency ${f} Hz.` },
  { name: 'bass guitar', f: [41, 400], text: (f) => `A note played on a bass guitar has a frequency of ${f} Hz.` },
  { name: 'foghorn', f: [50, 300], text: (f) => `A ship's foghorn sounds at a frequency of ${f} Hz.` },
  { name: 'singer', f: [80, 1100], text: (f) => `A singer holds a note with a frequency of ${f} Hz.` },
  { name: 'bird', f: [1000, 8000], text: (f) => `A bird's song has a frequency of ${f} Hz.` },
  ] as Source[]
).map((s) => ({ ...s, values: steps(s.f[0], s.f[1], 1).filter((f) => printable(340 / f) && unrelated(exact(340 / f), [340, f])) }))

const AIR = [
  (s: string) => `${s} Calculate the wavelength of the sound in air. Take the speed of sound as 340 m/s.`,
  (s: string) => `${s} Sound travels through air at 340 m/s. What is the wavelength of the sound, in metres?`,
]

/**
 * λ = v ÷ f in air: written as q5 (1700 Hz at 340 m/s, 0.2 m, 2 marks). Each source keeps the
 * frequencies it really makes, and the wavelength prints in three figures at most.
 */
export const soundWavelength: Generator = {
  id: 'sound-wavelength-in-air',
  subjectId: 'physics',
  topicId: SOUND,
  replaces: ['q5'],
  build(r, slot, turn) {
    const c = SOUNDS[turn % SOUNDS.length]!
    const f = pick(r, c.values)
    const l = exact(340 / f)
    // Second route: the wavelength found times the frequency is the speed.
    const back = l * f
    return numeric(
      slot,
      {
        prompt: pick(r, AIR)(c.text(prose(f))),
        solution: closes(`\\lambda = \\dfrac{v}{f} = \\dfrac{340}{${tex(f)}}`, l, 'm'),
        method: [`uses $\\lambda = v \\div f$: $340 \\div ${tex(f)}$`],
        answer: l,
        tolerance: dpTolerance(l),
        units: 'm',
      },
      { agrees: near(back, 340), detail: `${l} × ${f} = ${show(back)} m/s` },
      { context: c.name, f },
    )
  },
}

/** The question without its speed: the limit itself is never printed, because recalling it is the mark. */
const LOWER = [
  'Calculate the wavelength in air of a sound at the lower limit of human hearing.',
  'What is the wavelength in air of the lowest-frequency sound that humans can hear, in metres?',
  'Calculate the wavelength of a sound at the bottom of the range of human hearing.',
  'A loudspeaker plays the lowest frequency that a person with normal hearing can hear. Calculate the wavelength of the sound in air.',
  'An organ pipe sounds a note at the lower limit of human hearing. Calculate the wavelength of the note in air.',
  'Calculate the wavelength in air of the lowest-pitched sound that a young person with normal hearing can detect.',
]
const UPPER = [
  'Calculate the wavelength in air of a sound at the upper limit of human hearing.',
  'What is the wavelength in air of the highest-frequency sound that humans can hear, in metres?',
  'Calculate the wavelength of a sound at the top of the range of human hearing.',
  'A loudspeaker plays the highest frequency that a person with normal hearing can hear. Calculate the wavelength of the sound in air.',
  'A dog whistle is tuned to the upper limit of human hearing. Calculate the wavelength of its sound in air.',
  'Calculate the wavelength in air of the highest-pitched sound that a young person with normal hearing can detect.',
]
const SOUND_SPEED = [
  (v: number) => `Take the speed of sound as ${v} m/s.`,
  (v: number) => `Sound travels through air at ${v} m/s.`,
  (v: number) => `The speed of sound in air is ${v} m/s.`,
]
/** Even speeds only: 335 ÷ 20 is 16.75, a fourth figure a student rounds away and is marked wrong for. */
const AIR_SPEEDS = steps(330, 350, 2)

/**
 * λ at a limit of hearing: written as q7 (the lower limit, 20 Hz, 17 m at 340 m/s, 3 marks)
 * and q12 (the upper limit, 20 kHz = 20 000 Hz, 0.017 m, 3 marks with the conversion). The
 * limit is the recall; the speed of sound in air is an even number from 330 to 350 m/s, its
 * range from 0 °C to 30 °C, so the answer has three figures. Six wordings of the question and
 * three of the speed rotate together. The answer is half the speed with the point moved, because the limit is 20:
 * that is the slot, not a coincidence.
 */
export const hearingLimitWavelength: Generator = {
  id: 'wavelength-at-a-limit-of-hearing',
  subjectId: 'physics',
  topicId: SOUND,
  replaces: ['q7', 'q12'],
  build(r, slot, turn) {
    const upper = slot.id === 'q12'
    const prompts = upper ? UPPER : LOWER
    const k = turn % (prompts.length * SOUND_SPEED.length)
    const v = pick(r, AIR_SPEEDS)
    const f = upper ? 20000 : 20
    const l = exact(v / f)
    const solution = upper
      ? `The upper limit is **20 kHz = 20 000 Hz**. $\\lambda = \\dfrac{${v}}{20\\,000} = ${show(l)}$ m. Substituting 20 instead of 20 000 gives ${show(v / 20)} m, a thousand times too big.`
      : `The lower limit is **20 Hz**. $\\lambda = \\dfrac{${v}}{20} = ${show(l)}$ m, longer than a house.`
    // Second route: the wavelength found times the frequency is the speed.
    const back = l * f
    return numeric(
      slot,
      {
        prompt: `${prompts[k % prompts.length]} ${SOUND_SPEED[Math.floor(k / prompts.length)]!(v)}`,
        solution,
        method: upper ? ['converts 20 kHz to 20 000 Hz', `uses $\\lambda = v \\div f$: $${v} \\div 20\\,000$`] : ['identifies the lower limit as 20 Hz', `uses $\\lambda = v \\div f$: $${v} \\div 20$`],
        answer: l,
        tolerance: dpTolerance(l),
        units: 'm',
      },
      { agrees: near(back, v), detail: `${l} × ${f} = ${show(back)} m/s` },
      { context: `question ${(k % prompts.length) + 1}`, speed: `wording ${Math.floor(k / prompts.length) + 1}`, v },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Wave properties: v = fλ, f = 1/T, echoes and the waves-on-a-string practical
// ---------------------------------------------------------------------------------------------

interface Moving {
  name: string
  text: (f: string, l: string) => string
  f: [number, number]
  fStep: number
  l: [number, number]
  lStep: number
  v: [number, number]
  /** Water waves keep to the speed their wavelength gives in deep water, √(gλ/2π), within reason. */
  water?: boolean
}
const MOVING: Moving[] = [
  { name: 'ripple tank', text: (f, l) => `Ripples in a ripple tank have a frequency of ${f} Hz and a wavelength of ${l} m.`, f: [4, 20], fStep: 1, l: [0.008, 0.05], lStep: 0.001, v: [0.1, 0.35] },
  { name: 'sea', text: (f, l) => `Waves on the sea have a frequency of ${f} Hz and a wavelength of ${l} m.`, f: [0.08, 0.5], fStep: 0.01, l: [5, 80], lStep: 1, v: [2, 12], water: true },
  { name: 'pond', text: (f, l) => `Water waves on a pond have a frequency of ${f} Hz and a wavelength of ${l} m.`, f: [0.8, 4], fStep: 0.1, l: [0.1, 2], lStep: 0.01, v: [0.3, 2], water: true },
  { name: 'slinky', text: (f, l) => `A wave sent along a slinky spring has a frequency of ${f} Hz and a wavelength of ${l} m.`, f: [0.5, 4], fStep: 0.5, l: [0.3, 2], lStep: 0.1, v: [0.5, 4] },
  { name: 'rope', text: (f, l) => `A wave travels along a rope with a frequency of ${f} Hz and a wavelength of ${l} m.`, f: [1, 6], fStep: 0.5, l: [0.4, 3], lStep: 0.1, v: [1, 10] },
  { name: 'seismic', text: (f, l) => `A seismic P-wave has a frequency of ${f} Hz and a wavelength of ${l} m.`, f: [0.5, 10], fStep: 0.5, l: [500, 10000], lStep: 100, v: [5000, 8000] },
  { name: 'wave', text: (f, l) => `A wave has a frequency of ${f} Hz and a wavelength of ${l} m.`, f: [0.5, 10], fStep: 0.5, l: [0.1, 5], lStep: 0.1, v: [0.3, 20] },
]
const deepWater = (l: number) => Math.sqrt((9.8 * l) / (2 * Math.PI))
const SPEED_ASK = ['Calculate the speed of the wave, in m/s.', 'What is the wave speed, in m/s?']

/**
 * v = fλ: written as q4 (2.5 Hz and 0.8 m, 2 m/s, 2 marks). Each wave keeps the frequencies,
 * wavelengths and speeds it really has; water waves are held within 30% of the deep-water
 * speed for their wavelength, so a 20 m sea wave never runs at 15 m/s. Neither figure is 1, 2
 * or 5 with the point anywhere, so the answer is never a given figure moved, doubled or halved.
 */
export const waveSpeed: Generator = {
  id: 'wave-speed-from-frequency-and-wavelength',
  subjectId: 'physics',
  topicId: PROPERTIES,
  replaces: ['q4'],
  build(r, slot, turn) {
    const c = MOVING[turn % MOVING.length]!
    const [f, l] = follow(r, steps(c.f[0], c.f[1], c.fStep), (f) =>
      steps(c.l[0], c.l[1], c.lStep).filter((l) => {
        const v = exact(f * l)
        return v >= c.v[0] && v <= c.v[1] && figs(v) <= 3 && atMost(v, 4) && unrelated(v, [f, l]) && (!c.water || Math.abs(v / deepWater(l) - 1) <= 0.3)
      }),
    )
    const v = exact(f * l)
    // Second route: the speed found over the frequency is the wavelength.
    const back = v / f
    return numeric(
      slot,
      {
        prompt: `${c.text(prose(f), prose(l))} ${pick(r, SPEED_ASK)}`,
        solution: closes(`v = f\\lambda = ${tex(f)} \\times ${tex(l)}`, v, 'm/s'),
        method: [`uses $v = f\\lambda$: $${tex(f)} \\times ${tex(l)}$`],
        answer: v,
        tolerance: dpTolerance(v),
        units: 'm/s',
      },
      { agrees: near(back, l), detail: `${v} ÷ ${f} = ${show(back)} m` },
      { context: c.name, f, l },
    )
  },
}

/** Front numbers whose reciprocals end within three figures: 1 ÷ 1.6 = 0.625, 1 ÷ 8 = 0.125. */
const RECIPROCAL = [1.25, 1.6, 2.5, 4, 6.25, 8]
function periods(lo: number, hi: number): number[] {
  const out: number[] = []
  for (let k = -5; k <= 2; k++) for (const m of RECIPROCAL) {
    const T = exact(m * 10 ** k)
    if (T >= lo && T <= hi) out.push(T)
  }
  return out
}
interface Vibrating {
  name: string
  T: [number, number]
  text: (T: string) => string
}
const VIBRATING: Vibrating[] = [
  { name: 'oscilloscope', T: [0.00025, 0.01], text: (T) => `An oscilloscope trace shows that a sound wave has a period of ${T} s.` },
  { name: 'sea', T: [2, 16], text: (T) => `Waves on the sea arrive at a harbour wall with a period of ${T} s.` },
  { name: 'ripple tank', T: [0.04, 0.25], text: (T) => `Ripples in a ripple tank have a period of ${T} s.` },
  { name: 'rope', T: [0.25, 2.5], text: (T) => `A wave on a rope has a period of ${T} s.` },
  { name: 'string', T: [0.008, 0.05], text: (T) => `In the waves-on-a-string practical, each point on the string completes one vibration every ${T} s.` },
  { name: 'seismic', T: [0.1, 2], text: (T) => `A seismic wave has a period of ${T} s.` },
  { name: 'wave', T: [0.0004, 10], text: (T) => `A wave has a period of ${T} s.` },
]
const FREQUENCY_ASK = ['Calculate the frequency of the wave.', 'What is the frequency, in Hz?']

/**
 * f = 1 ÷ T: written as q5 (0.02 s, 50 Hz, 2 marks). The period's front number is one whose
 * reciprocal ends cleanly (1.25, 1.6, 2.5, 4, 6.25, 8), never 1, 2 or 5, whose reciprocals
 * repeat the digit; each wave keeps the periods it really has.
 */
export const frequencyFromPeriod: Generator = {
  id: 'frequency-from-period',
  subjectId: 'physics',
  topicId: PROPERTIES,
  replaces: ['q5'],
  build(r, slot, turn) {
    const c = VIBRATING[turn % VIBRATING.length]!
    const T = pick(r, periods(c.T[0], c.T[1]))
    const f = exact(1 / T)
    // Second route: the frequency found times the period is 1.
    const back = f * T
    return numeric(
      slot,
      {
        prompt: `${c.text(show(T))} ${pick(r, FREQUENCY_ASK)}`,
        solution: `${closes(`f = \\dfrac{1}{T} = \\dfrac{1}{${tex(T)}}`, f, 'Hz')} Period and frequency are reciprocals.`,
        method: [`uses $f = 1 \\div T$: $1 \\div ${tex(T)}$`],
        answer: f,
        tolerance: dpTolerance(f),
        units: 'Hz',
      },
      { agrees: near(back, 1), detail: `${f} × ${T} = ${show(back)}` },
      { context: c.name, T },
    )
  },
}

interface Carried {
  name: string
  /** Each speed stated for it, in m/s, with the frequencies it really carries at that speed: whole hertz unless a step is given. */
  pairs: ([number, number, number] | [number, number, number, number])[]
  text: (v: string, f: string) => string
}
const CARRIED: Carried[] = [
  { name: 'sea water', pairs: [[1500, 100, 20000]], text: (v, f) => `A sound wave travels through sea water at ${v} m/s with a frequency of ${f} Hz.` },
  { name: 'air', pairs: [[340, 20, 20000]], text: (v, f) => `A sound wave travels through air at ${v} m/s with a frequency of ${f} Hz.` },
  // A hammer on a rail rings at a few hundred to a few thousand hertz.
  { name: 'steel', pairs: [[6000, 200, 4000]], text: (v, f) => `Sound travels along a steel rail at ${v} m/s. A hammer blow sends a sound of frequency ${f} Hz along it.` },
  { name: 'seismic', pairs: [[6000, 0.5, 20, 0.5], [7000, 0.5, 20, 0.5], [8000, 0.5, 20, 0.5]], text: (v, f) => `A seismic P-wave travels through rock at ${v} m/s with a frequency of ${f} Hz.` },
  { name: 'ripple tank', pairs: steps(0.12, 0.3, 0.01).map((v) => [v, 4, 20]), text: (v, f) => `Ripples in a ripple tank travel at ${v} m/s with a frequency of ${f} Hz.` },
  // Sound in water and in air, a wave on a stretched string, on a rope and on water.
  { name: 'wave', pairs: [[1500, 100, 5000], [340, 50, 5000], [45, 5, 120], [12, 1, 20], [2.4, 1, 10]], text: (v, f) => `A wave travels at ${v} m/s with a frequency of ${f} Hz.` },
]
/** Every speed and frequency of a medium whose wavelength prints cleanly and echoes neither. */
const CARRIED_PAIRS = CARRIED.map((c) =>
  c.pairs.flatMap(([v, lo, hi, step]) =>
    steps(lo, hi, step ?? 1)
      .filter((f) => {
        const l = exact(v / f)
        return printable(l) && unrelated(l, [v, f])
      })
      .map((f) => [v, f] as const),
  ),
)

/**
 * λ = v ÷ f: written as q6 (1500 m/s and 500 Hz, 3 m, 3 marks). Each medium keeps its own
 * speed and the frequencies it really carries; the wavelength prints in three figures at most
 * and is never a given figure moved, doubled or halved.
 */
export const wavelengthFromSpeed: Generator = {
  id: 'wavelength-from-speed-and-frequency',
  subjectId: 'physics',
  topicId: PROPERTIES,
  replaces: ['q6'],
  build(r, slot, turn) {
    const k = turn % CARRIED.length
    const c = CARRIED[k]!
    // Every pair evenly: a speed with few clean frequencies is drawn less often, so its few never carry the context.
    const [v, f] = pick(r, CARRIED_PAIRS[k]!)
    const l = exact(v / f)
    // Second route: the frequency times the wavelength found is the speed.
    const back = f * l
    return numeric(
      slot,
      {
        prompt: `${c.text(prose(v), prose(f))} Calculate the wavelength, in metres.`,
        solution: closes(`\\lambda = \\dfrac{v}{f} = \\dfrac{${tex(v)}}{${tex(f)}}`, l, 'm'),
        method: ['rearranges to $\\lambda = v \\div f$', `substitutes ${prose(v)} and ${prose(f)}: $${tex(v)} \\div ${tex(f)}$`],
        answer: l,
        tolerance: dpTolerance(l),
        units: 'm',
      },
      { agrees: near(back, v), detail: `${f} × ${l} = ${show(back)} m/s` },
      { context: c.name, v, f },
    )
  },
}

interface Reflector {
  name: string
  noun: string
  d: [number, number]
}
/** What a student claps at, with the distances each really stands from it. */
const REFLECTORS: Reflector[] = [
  { name: 'wall', noun: 'a wall', d: [40, 150] },
  { name: 'building', noun: 'a large building', d: [60, 250] },
  { name: 'cliff', noun: 'a cliff', d: [100, 500] },
]
/** Every speed from 330 to 345 m/s with the times, to 0.01 s, that put the reflector a whole number of metres away: 66 m at 330 m/s is 0.40 s. */
const ECHO_TIMES = REFLECTORS.map((c) =>
  steps(330, 345, 1).map((v) => ({
    v,
    times: steps(0.3, 3, 0.01).filter((t) => {
      const d = exact((v * t) / 2)
      return d >= c.d[0] && d <= c.d[1] && Number.isInteger(d) && unrelated(v, [d, t]) && t !== 1
    }),
  })),
)

/**
 * v = 2d ÷ t from an echo: written as q13 (a wall 80 m away, 0.48 s, 333 m/s, 3 marks). The
 * speed is drawn first, from 330 to 345 m/s, then a stopwatch time to 0.01 s that puts the reflector a
 * whole number of metres away; the distance is doubled, as the written mark scheme rewards.
 */
export const speedOfSoundFromEcho: Generator = {
  id: 'speed-of-sound-from-an-echo',
  subjectId: 'physics',
  topicId: PROPERTIES,
  replaces: ['q13'],
  build(r, slot, turn) {
    const k = turn % REFLECTORS.length
    const c = REFLECTORS[k]!
    const [row, t] = follow(r, ECHO_TIMES[k]!, (row) => row.times)
    const v = row.v
    const d = exact((v * t) / 2)
    const there = exact(2 * d)
    const prompt = pick(r, [
      `A student times an echo from ${c.noun} ${show(d)} m away as ${fixed(t, 2)} s. Calculate the correct speed of sound.`,
      `A student stands ${show(d)} m from ${c.noun} and claps. The echo is heard ${fixed(t, 2)} s after the clap. Calculate the speed of sound in air, in m/s.`,
      `A student bangs two blocks of wood together ${show(d)} m from ${c.noun}. A friend with a stopwatch hears the echo ${fixed(t, 2)} s after the bang. Calculate the speed of sound, in m/s.`,
      `The echo from ${c.noun} ${show(d)} m away returns ${fixed(t, 2)} s after a student claps. Calculate the speed of sound in air, in m/s.`,
    ])
    // Second route: the speed found times the time, halved, is the distance.
    const back = (v * t) / 2
    return numeric(
      slot,
      {
        prompt,
        solution: `The sound travels **there and back**, so the distance is $2 \\times ${show(d)} = ${show(there)}$ m. $v = \\dfrac{${show(there)}}{${fixed(t, 2)}} = ${v}$ m/s. Dividing by the one-way distance gives exactly **half** the right answer.`,
        method: [`doubles the distance to ${show(there)} m`, `divides by ${fixed(t, 2)}`],
        answer: v,
        units: 'm/s',
      },
      { agrees: near(back, d) && Number.isInteger(v), detail: `${v} × ${t} ÷ 2 = ${show(back)} m` },
      { context: c.name, d, t },
    )
  },
}

/** String lengths, vibrator to pulley, that n loops share in whole centimetres. */
const LOOPS = [3, 4, 5, 6]
const lengthsFor = (n: number) => steps(0.6, 1.5, 0.05).filter((L) => atMost(L / n, 2))

/**
 * v = fλ in required practical 8: written as q20 (3 loops over 0.90 m at 28 Hz, 16.8 m/s, 2
 * marks, no units field). One loop is half a wavelength. The loops rotate from 3 to 6 (2 loops
 * would make λ the length itself, a step with nothing in it), the signal generator is set to
 * a whole number of hertz, and the wave speed stays within 8 to 40 m/s, what a lab string
 * under a hung mass gives.
 */
export const stringWaveSpeed: Generator = {
  id: 'wave-speed-on-a-string',
  subjectId: 'physics',
  topicId: PROPERTIES,
  replaces: ['q20'],
  build(r, slot, turn) {
    const n = LOOPS[turn % LOOPS.length]!
    const [L, f] = follow(r, lengthsFor(n), (L) => {
      const l = exact((2 * L) / n)
      return steps(10, 120, 1).filter((f) => {
        const v = exact(f * l)
        return v >= 8 && v <= 40 && unrelated(v, [f, L, n])
      })
    })
    const loop = exact(L / n)
    const l = exact(2 * loop)
    const v = exact(f * l)
    const prompt = pick(r, [
      `In the waves-on-a-string practical, ${n} loops span ${fixed(L, 2)} m and the signal generator is set at ${f} Hz. Calculate the wave speed, in m/s.`,
      `In the waves-on-a-string practical, the signal generator is set at ${f} Hz and the string forms ${n} loops over a length of ${fixed(L, 2)} m. Calculate the speed of the waves on the string, in m/s.`,
    ])
    // Second route: the speed over the frequency is the wavelength, and n half-wavelengths make the length.
    const back = ((v / f) * n) / 2
    return numeric(
      slot,
      {
        prompt,
        solution: `One loop is $${fixed(L, 2)} \\div ${n} = ${fixed(loop, 2)}$ m, so $\\lambda = ${fixed(l, 2)}$ m. Then $v = f\\lambda = ${f} \\times ${fixed(l, 2)} = $ **${show(v)} m/s**.`,
        method: [`$\\lambda = ${fixed(l, 2)}$ m`],
        answer: v,
        tolerance: dpTolerance(v),
      },
      { agrees: near(back, L), detail: `${v} ÷ ${f} × ${n} ÷ 2 = ${show(back)} m` },
      { context: `${n} loops`, L, f },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Waves for detection: echo sounding and ultrasound at 1500 m/s
// ---------------------------------------------------------------------------------------------

interface Target {
  name: string
  /** As the question names it: "the seabed". */
  noun: string
  /** Depths in m it really lies at. */
  d: [number, number]
  /** At sea, depths in steps that give a time within three decimal places; tissue depths come from their times. */
  dStep?: number
}
const SEA: Target[] = [
  { name: 'seabed', noun: 'the seabed', d: [15, 300], dStep: 3 },
  { name: 'ocean floor', noun: 'the ocean floor', d: [1500, 4500], dStep: 30 },
  { name: 'shoal of fish', noun: 'a shoal of fish', d: [9, 150], dStep: 3 },
  { name: 'shipwreck', noun: 'a shipwreck', d: [15, 90], dStep: 3 },
]
/** A time that is the speed of sound with the point moved, doubled or halved makes the depth echo 1500. */
const echoTime = (t: number) => figs(t) <= 3 && unrelated(exact(750 * t), [1500, t])

/**
 * depth = vt ÷ 2 at sea: written as q5 (0.04 s at 1500 m/s, 30 m, 3 marks). The depth is drawn
 * first in steps of 3 m, so the time 2d ÷ 1500 ends within three decimal places.
 */
export const echoSoundingDepth: Generator = {
  id: 'echo-sounding-depth',
  subjectId: 'physics',
  topicId: DETECTION,
  replaces: ['q5'],
  build(r, slot, turn) {
    const c = SEA[turn % SEA.length]!
    const d = pick(r, steps(c.d[0], c.d[1], c.dStep!).filter((d) => echoTime(exact(d / 750))))
    const t = exact(d / 750)
    const whole = exact(1500 * t)
    const prompt = pick(r, [
      `An echo from ${c.noun} returns after ${show(t)} s. Sound travels at 1500 m/s in sea water. How deep is ${c.noun.replace(/^a /, 'the ')}, in metres?`,
      `A ship's echo sounder sends a pulse of sound down to ${c.noun}. The echo returns after ${show(t)} s. Sound travels at 1500 m/s in sea water. Calculate the depth of ${c.noun.replace(/^a /, 'the ')}, in metres.`,
    ])
    // Second route: the time for twice the depth at 1500 m/s.
    const back = (2 * d) / 1500
    return numeric(
      slot,
      {
        prompt,
        solution: `$1500 \\times ${show(t)} = ${tex(whole)}$ m for the whole journey, so the depth is $${tex(whole)} \\div 2 = ${tex(d)}$ m.`,
        method: [`speed times time: $1500 \\times ${show(t)} = ${tex(whole)}$ m`, 'divides by two for the return journey'],
        answer: d,
        units: 'm',
      },
      { agrees: near(back, t) && Number.isInteger(d), detail: `2 × ${d} ÷ 1500 = ${show(back)} s` },
      { context: c.name, t },
    )
  },
}

const TISSUE: Target[] = [
  { name: 'boundary', noun: 'the boundary', d: [0.02, 0.15] },
  { name: 'kidney', noun: 'the surface of the kidney', d: [0.04, 0.12] },
  { name: 'gallstone', noun: 'the gallstone', d: [0.04, 0.1] },
  { name: 'baby', noun: "the baby's head", d: [0.06, 0.15] },
]
/** Times of two figures whose depth 750t ends within four decimal places; neither the depth nor the time echoes 1500 or the other. */
const tissueTime = (t: number) => figs(t) <= 2 && atMost(750 * t, 4) && unrelated(exact(750 * t), [1500, t]) && unrelated(t, [1500, exact(750 * t)])
/** The depths in a target's range whose echo time, in millionths of a second, has two figures. */
const tissueDepths = (c: Target) =>
  steps(20, 300, 1)
    .map((j) => exact(j / 1e6))
    .filter(tissueTime)
    .map((t) => exact(750 * t))
    .filter((d) => d >= c.d[0] && d <= c.d[1])
const WHERE: Record<string, string> = {
  boundary: 'a boundary between two tissues',
  kidney: 'the surface of a kidney',
  gallstone: 'a gallstone',
  baby: "a baby's head in the womb",
}

/**
 * depth = vt ÷ 2 in tissue: written as q10 (0.0002 s at 1500 m/s, 0.15 m, 3 marks). The depth
 * is drawn first, from what each organ really lies at, and the time has two figures.
 */
export const ultrasoundDepth: Generator = {
  id: 'ultrasound-depth',
  subjectId: 'physics',
  topicId: DETECTION,
  replaces: ['q10'],
  build(r, slot, turn) {
    const c = TISSUE[turn % TISSUE.length]!
    const d = pick(r, tissueDepths(c))
    const t = exact(d / 750)
    const whole = exact(1500 * t)
    const prompt = pick(r, [
      `An ultrasound echo from ${WHERE[c.name]} returns after ${show(t)} s in tissue where the speed is 1500 m/s. How deep is ${c.noun}, in metres?`,
      `An ultrasound pulse sent into the body reflects from ${WHERE[c.name]}. The echo returns after ${show(t)} s. Ultrasound travels at 1500 m/s in tissue. Calculate the depth of ${c.noun}, in metres.`,
    ])
    // Second route: the time for twice the depth at 1500 m/s.
    const back = (2 * d) / 1500
    return numeric(
      slot,
      {
        prompt,
        solution: `$1500 \\times ${show(t)} = ${show(whole)}$ m for the round trip, so the depth is $${show(whole)} \\div 2 = ${show(d)}$ m.`,
        method: [`speed times time: $1500 \\times ${show(t)} = ${show(whole)}$ m`, 'halves it'],
        answer: d,
        tolerance: dpTolerance(d),
        units: 'm',
      },
      { agrees: near(back, t), detail: `2 × ${d} ÷ 1500 = ${show(back)} s` },
      { context: c.name, t },
    )
  },
}

/**
 * t = 2d ÷ v in tissue: written as q14 (0.09 m at 1500 m/s, 0.00012 s, 3 marks). The depth is
 * drawn as in q10 and the distance is doubled, not halved.
 */
export const ultrasoundEchoTime: Generator = {
  id: 'ultrasound-echo-time',
  subjectId: 'physics',
  topicId: DETECTION,
  replaces: ['q14'],
  build(r, slot, turn) {
    const c = TISSUE[turn % TISSUE.length]!
    const d = pick(r, tissueDepths(c))
    const t = exact(d / 750)
    const there = exact(2 * d)
    const prompt = pick(r, [
      `${cap(WHERE[c.name]!)} is ${show(d)} m deep and ultrasound travels at 1500 m/s. How long does the echo take to return, in seconds?`,
      `Ultrasound travels through tissue at 1500 m/s. How long does an echo from ${WHERE[c.name]}, ${show(d)} m below the skin, take to return, in seconds?`,
    ])
    // Second route: the speed times the time found, halved, is the depth.
    const back = (1500 * t) / 2
    return numeric(
      slot,
      {
        prompt,
        solution: `The pulse travels $2 \\times ${show(d)} = ${show(there)}$ m, so $t = \\dfrac{${show(there)}}{1500} = ${show(t)}$ s. Here the distance is **doubled**, not halved.`,
        method: [`doubles the distance for the return journey: $2 \\times ${show(d)} = ${show(there)}$ m`, `divides by the speed: $${show(there)} \\div 1500$`],
        answer: t,
        tolerance: dpTolerance(t),
        units: 's',
      },
      { agrees: near(back, d), detail: `1500 × ${t} ÷ 2 = ${show(back)} m` },
      { context: c.name, d },
    )
  },
}

export const waveGenerators: Generator[] = [
  frequencyFromWavelength,
  wavelengthFromFrequency,
  shortWavelengthFrequency,
  doseInSieverts,
  magnification,
  angleOfReflection,
  refractionFromTrace,
  soundWavelength,
  hearingLimitWavelength,
  waveSpeed,
  frequencyFromPeriod,
  wavelengthFromSpeed,
  speedOfSoundFromEcho,
  stringWaveSpeed,
  echoSoundingDepth,
  ultrasoundDepth,
  ultrasoundEchoTime,
]
