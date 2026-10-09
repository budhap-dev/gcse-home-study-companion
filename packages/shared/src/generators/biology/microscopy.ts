import { fixed, show } from '../format.ts'
import { atMost, cap, closes, figures, near, numeric, prose, sciExact, tex } from '../physics/build.ts'
import { an, byFirst, clean, clearOf, distinct, evenly, noOnes, powerOfTen, range, shiftFree, tenfold, word } from '../chemistry/build.ts'
import { pick, shuffle, type Rng } from '../random.ts'
import type { Generator } from '../types.ts'

/**
 * Microscopy, microbes and cells (AQA 8461, 4.1.1.2 to 4.1.1.5, 4.1.2 and 4.6.1.2). Every
 * numeric written slot in "Microscopes, magnification and scale" has a generator here; so do the
 * total magnification, bacterial doubling and colony-count slots of "Microbes and microscopy",
 * the haploid and polyspermy chromosome counts of "Cells, and how they are specialised", and
 * the growth and cell-cycle slots of "Cells, mitosis and growth".
 *
 * Magnification = image size ÷ real size, with the image measured in mm and the real size in µm,
 * so ×1000 (mm → µm) sits in the working as the written slots have it. Every size is the real
 * size of what is named: bacteria 1.2–5 µm, mitochondria 1.5–4 µm, chloroplasts 3–8 µm, yeast
 * 3–5 µm, nuclei 5–9 µm, red blood cells 6.5–8.5 µm, white blood cells 11–22 µm, cheek cells
 * 35–80 µm, palisade cells 40–90 µm, a human egg 105–140 µm, onion epidermis cells 150–400 µm,
 * Paramecium 170–300 µm, Amoeba 250–750 µm, ribosomes 20–30 nm, HIV 95–130 nm and measles virus
 * 105–300 nm. A light microscope magnifies up to ×1500 and its pictures say "light"; anything
 * more is an electron micrograph, up to ×2 000 000. Eyepieces are ×5, ×10 or ×15 and objectives
 * ×4, ×10, ×40 or ×100. Bacteria double every 15 to 40 minutes, human cells in culture every 18
 * to 48 hours (never 24, which would make the days the cycles), and every chromosome number is
 * the species' own.
 *
 * Where the size is found by dividing by a magnification, or a drawing by multiplying by one,
 * the answer is never a given doubled or halved even with the point moved (shiftFree): dividing
 * by ×500 and multiplying by 1000 doubles, and a student who doubled would be marked right.
 */
const SCALE = 'microscopes-magnification-and-scale'
const MICROBES = 'microbes-and-microscopy'
const CELLS = 'cells-and-how-they-are-specialised'
const MITOSIS = 'cells-mitosis-and-growth'

/** x lies on a grid of `step`: 12.5 is on the 0.5 grid, 12.3 is not. */
const onGrid = (x: number, step: number) => Math.abs(x / step - Math.round(x / step)) < 1e-9
const whole = (x: number) => Math.abs(x - Math.round(x)) < 1e-9
/** "A cheek cell", "An onion epidermis cell", "A *Paramecium*". */
const A = (noun: string) => cap(an(noun.replace(/^\*/, ''))) + ' ' + noun
const a = (noun: string) => an(noun.replace(/^\*/, '')) + ' ' + noun

// ---------------------------------------------------------------------------------------------
// What is seen: real cells and organelles, with their real sizes
// ---------------------------------------------------------------------------------------------

interface Specimen {
  name: string
  /** As a sentence names it: "onion epidermis cell", "*Paramecium*". */
  noun: string
  /** "long" or "across", as the length is measured. */
  dim: 'long' | 'across'
  /** Real sizes in µm. */
  sizes: number[]
  /** The magnifications it is drawn or photographed at, lowest and highest. */
  mags: [number, number]
}
const size = (s: Specimen) => (s.dim === 'long' ? 'length' : 'width')

/** Seen with a light microscope, so never past ×1500. */
const LIGHT: Specimen[] = [
  { name: 'palisade cell', noun: 'palisade cell', dim: 'long', sizes: range(40, 90), mags: [100, 800] },
  { name: 'onion epidermis cell', noun: 'onion epidermis cell', dim: 'long', sizes: range(150, 400, 5), mags: [40, 250] },
  { name: 'cheek cell', noun: 'cheek cell', dim: 'across', sizes: range(40, 75), mags: [150, 800] },
  { name: 'Paramecium', noun: '*Paramecium*', dim: 'long', sizes: range(170, 300, 5), mags: [40, 400] },
  { name: 'white blood cell', noun: 'white blood cell', dim: 'across', sizes: range(11, 22), mags: [400, 1500] },
]
/** Small enough that most pictures of them are electron micrographs. */
const SMALL: Specimen[] = [
  { name: 'bacterium', noun: 'bacterium', dim: 'long', sizes: range(1.2, 5, 0.1), mags: [2000, 100000] },
  { name: 'mitochondrion', noun: 'mitochondrion', dim: 'long', sizes: range(1.5, 4, 0.1), mags: [5000, 100000] },
  { name: 'chloroplast', noun: 'chloroplast', dim: 'long', sizes: range(3, 8, 0.1), mags: [2000, 50000] },
  { name: 'red blood cell', noun: 'red blood cell', dim: 'across', sizes: range(6.5, 8.5, 0.1), mags: [1500, 20000] },
  { name: 'yeast cell', noun: 'yeast cell', dim: 'across', sizes: range(3, 5, 0.1), mags: [2000, 50000] },
  { name: 'nucleus', noun: 'cheek cell nucleus', dim: 'across', sizes: range(5, 9, 0.1), mags: [2000, 30000] },
]
/** The kind of picture a magnification makes: a light microscope stops at ×1500. */
const picture = (mag: number) => (mag <= 1500 ? 'light micrograph' : 'electron micrograph')

/** Magnifications a light microscope drawing or photograph uses: ×100 and ×1000 are left out, since dividing by them only moves the point. */
const LIGHT_MAGS = [40, 50, 60, 80, 120, 150, 200, 250, 300, 400, 500, 600, 750, 800, 1200, 1250, 1500]
const magsFor = (s: Specimen) => LIGHT_MAGS.filter((m) => m >= s.mags[0] && m <= s.mags[1])

// ---------------------------------------------------------------------------------------------
// q2: mm → µm
// ---------------------------------------------------------------------------------------------

interface Converted {
  name: string
  sentence: (mm: string) => string
  what: 'length' | 'width'
  /** Real sizes in µm. */
  sizes: number[]
}
const MM_SIZES: Converted[] = [
  { name: 'palisade cell', sentence: (mm) => `A palisade cell from a leaf is ${mm} mm long.`, what: 'length', sizes: range(40, 90) },
  { name: 'onion epidermis cell', sentence: (mm) => `An onion epidermis cell is ${mm} mm long.`, what: 'length', sizes: range(150, 400, 5) },
  { name: 'cheek cell', sentence: (mm) => `A cheek cell is ${mm} mm across.`, what: 'width', sizes: range(40, 75) },
  { name: 'human egg cell', sentence: (mm) => `A human egg cell is ${mm} mm across.`, what: 'width', sizes: range(105, 140) },
  { name: 'Amoeba', sentence: (mm) => `An *Amoeba* is ${mm} mm long.`, what: 'length', sizes: range(250, 750, 10) },
  { name: 'Paramecium', sentence: (mm) => `A *Paramecium* is ${mm} mm long.`, what: 'length', sizes: range(170, 300, 5) },
]
const MM_PROMPTS = [
  (c: Converted, mm: string) => `${c.sentence(mm)} Convert ${mm} mm into micrometres (µm).`,
  (c: Converted, mm: string) => `${c.sentence(mm)} What is its ${c.what} in micrometres (µm)?`,
]

/** Millimetres to micrometres: written as q2 (0.2 mm, 200). The answer is the given with the point moved: that is the skill. */
export const mmToMicrometres: Generator = {
  id: 'mm-to-micrometres',
  subjectId: 'biology',
  topicId: SCALE,
  replaces: ['q2'],
  build(r, slot, turn) {
    const c = MM_SIZES[turn % MM_SIZES.length]!
    const um = pick(r, c.sizes.filter((x) => !powerOfTen(x)))
    const mm = show(um / 1000)
    return numeric(
      slot,
      {
        prompt: pick(r, MM_PROMPTS)(c, mm),
        solution: `$${mm} \\times 1000 = ${um}$ µm. Milli is $10^{-3}$ and micro is $10^{-6}$, three powers of ten apart, so the step is **×1000**.`,
        method: [],
        answer: um,
      },
      // Second route: the millimetres in thousandths, as a whole number of micrometres.
      { agrees: Math.round(Number(mm) * 1e6) === um * 1000, detail: `${mm} mm` },
      { context: c.name, mm: Number(mm), um },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Total magnification: eyepiece × objective
// ---------------------------------------------------------------------------------------------

const EYEPIECES = [5, 10, 15]
const OBJECTIVES = [4, 10, 40, 100]
/** Every real pair but ×10 with ×10, two equal figures. */
const LENSES = EYEPIECES.flatMap((e) => OBJECTIVES.map((o) => [e, o] as const)).filter(([e, o]) => e !== o)
const CELL_SLIDES = ['onion epidermis cells', 'cheek cells', 'pondweed leaf cells', 'moss leaf cells', 'a thin slice of cork', 'a stained root tip squash']
const MICROBE_SLIDES = ['a drop of pond water', 'a yeast suspension', 'a stained smear of bacteria from yoghurt', 'mould from a slice of bread', 'a strand of *Spirogyra*, a pond alga', 'a culture of *Paramecium*']
const OBJECTIVE_NOTE: Record<number, string> = {
  4: 'the low power used to find the specimen',
  10: 'a medium power',
  40: 'high power',
  100: 'the ×100 objective is an oil-immersion lens',
}
const TOTAL_PROMPTS: Record<string, ((s: string, e: number, o: number) => string)[]> = {
  [SCALE]: [
    (s, e, o) => `A student looks at ${s} through a microscope with a ×${e} eyepiece lens and a ×${o} objective lens. Calculate the total magnification.`,
    (s, e, o) => `A microscope set up to view ${s} has a ×${e} eyepiece lens and a ×${o} objective lens. Calculate the total magnification.`,
  ],
  [MICROBES]: [
    (s, e, o) => `A student views ${s} through a microscope with a ×${e} eyepiece, and the ×${o} objective is in use. What is the total magnification?`,
    (s, e, o) => `A microscope has a ×${e} eyepiece and the ×${o} objective is in use to look at ${s}. What is the total magnification?`,
  ],
}

const totalMagnification = (id: string, topicId: string, replaces: string[], slides: string[]): Generator => ({
  id,
  subjectId: 'biology',
  topicId,
  replaces,
  build(r, slot, turn) {
    const s = slides[turn % slides.length]!
    // The eyepiece first, so each is a third of the builds, then an objective that is not the same figure.
    const e = pick(r, EYEPIECES)
    const o = pick(r, LENSES.filter(([x]) => x === e).map(([, y]) => y))
    const m = e * o
    return numeric(
      slot,
      {
        prompt: pick(r, TOTAL_PROMPTS[topicId]!)(s, e, o),
        solution: `Eyepiece × objective: $${e} \\times ${o} = ${m}$, so the total magnification is **×${m}** (${OBJECTIVE_NOTE[o]}). The lenses **multiply**: adding them would give ${e + o}.`,
        method: [],
        answer: m,
      },
      { agrees: m / o === e && m / e === o, detail: `${m} ÷ ${o} = ${e}` },
      { context: s, eyepiece: e, objective: o },
    )
  },
})

/** Written as q3 (×10 and ×4, 40). */
export const scaleTotalMagnification = totalMagnification('total-magnification', SCALE, ['q3'], CELL_SLIDES)
/** Written as microbes q4 (×10 and ×4, 40). */
export const microbeTotalMagnification = totalMagnification('microbe-total-magnification', MICROBES, ['q4'], MICROBE_SLIDES)

// ---------------------------------------------------------------------------------------------
// q5: real size from a drawing; q31: drawing size from the real size
// ---------------------------------------------------------------------------------------------

interface Drawn {
  um: number
  mag: number
  /** The drawing, in mm. */
  mm: number
}
/** Drawings 8 to 150 mm, measured to the half millimetre; never 10 or 100 mm. */
const drawings = (s: Specimen, lo: number): Drawn[] =>
  s.sizes.flatMap((um) =>
    magsFor(s).map((mag) => ({ um, mag, mm: clean((um * mag) / 1000) })).filter(({ mm }) => onGrid(mm, 0.5) && mm >= lo && mm <= 150 && !powerOfTen(mm)),
  )

const ACTUAL_PROMPTS = [
  (s: Specimen, d: Drawn) => `${A(s.noun)} measures ${show(d.mm)} mm ${s.dim} in a drawing made at a magnification of ×${d.mag}. Calculate the actual ${size(s)} of the ${s.noun} in micrometres (µm).`,
  (s: Specimen, d: Drawn) => `A student draws ${a(s.noun)} at a magnification of ×${d.mag}. In the drawing it is ${show(d.mm)} mm ${s.dim}. Calculate its actual ${size(s)} in micrometres (µm).`,
]

/** Actual size = image ÷ magnification, then mm → µm: written as q5 (40 mm at ×500, 80 µm). */
export const actualSize: Generator = {
  id: 'actual-size-from-a-drawing',
  subjectId: 'biology',
  topicId: SCALE,
  replaces: ['q5'],
  build(r, slot, turn) {
    const s = LIGHT[turn % LIGHT.length]!
    // The magnification first, so the one that divides most sizes cleanly does not fill the context; then the size.
    const d = byFirst(r, `actual-size-from-a-drawing:${s.name}`, () => drawings(s, 10).filter((x) => shiftFree(x.um, x.mm, x.mag) && distinct(x.um, x.mm, x.mag)), (x) => x.mag, (x) => x.um, 3)
    const real = show(d.um / 1000)
    return numeric(
      slot,
      {
        prompt: pick(r, ACTUAL_PROMPTS)(s, d),
        solution: `$\\dfrac{${show(d.mm)}}{${d.mag}} = ${real}$ mm, then $\\times 1000 = ${d.um}$ µm. ${cap(a(s.noun))} of that size is plausible; ${show(d.mm)} mm would not be.`,
        method: ['divides image size by magnification'],
        answer: d.um,
        line: `${d.um} µm`,
      },
      // Second route: forwards, the real size magnified back to the drawing.
      { agrees: near((d.um * d.mag) / 1000, d.mm), detail: `${d.um} × ${d.mag} ÷ 1000 = ${d.mm}` },
      { context: s.name, mm: d.mm, mag: d.mag, um: d.um },
    )
  },
}

const IMAGE_PROMPTS = [
  (s: Specimen, d: Drawn) =>
    `${A(s.noun)} is ${d.um} µm ${s.dim}. Calculate how ${s.dim === 'long' ? 'long' : 'wide'} it will appear, in millimetres (mm), in a drawing made at a magnification of ×${d.mag}.`,
  (s: Specimen, d: Drawn) =>
    `A student makes a drawing of ${a(s.noun)} at a magnification of ×${d.mag}. The real ${s.noun} is ${d.um} µm ${s.dim}. Calculate the ${size(s)} of the ${s.noun} in the drawing, in millimetres (mm).`,
]

/** Image size = magnification × actual size, then µm → mm: written as q31 (60 µm at ×250, 15 mm). */
export const imageSize: Generator = {
  id: 'image-size-from-a-real-size',
  subjectId: 'biology',
  topicId: SCALE,
  replaces: ['q31'],
  build(r, slot, turn) {
    const s = LIGHT[turn % LIGHT.length]!
    const d = byFirst(r, `image-size-from-a-real-size:${s.name}`, () => drawings(s, 8).filter((x) => figures(x.mm) <= 3 && shiftFree(x.mm, x.um, x.mag) && distinct(x.um, x.mag)), (x) => x.mag, (x) => x.mm, 3)
    const product = d.um * d.mag
    return numeric(
      slot,
      {
        prompt: pick(r, IMAGE_PROMPTS)(s, d),
        solution:
          `Rearrange the magnification equation: $\\text{image size} = \\text{magnification} \\times \\text{actual size} = ${d.mag} \\times ${d.um} = ${tex(product)}$ µm. ` +
          `Convert at the end as a separate step: $${tex(product)} \\div 1000 = ${show(d.mm)}$ mm. Leaving the answer as ${show(d.mm)} µm would skip that step: a ×${d.mag} drawing is ${prose(d.mag)} times the size of the real ${s.noun}, so it cannot be ${show(d.mm)} µm ${s.dim}.`,
        method: [`multiplies the magnification by the actual size, ${prose(product)} µm`],
        answer: d.mm,
        units: 'mm',
      },
      { agrees: near((d.mm * 1000) / d.mag, d.um), detail: `${d.mm} mm × 1000 ÷ ${d.mag} = ${d.um} µm` },
      { context: s.name, um: d.um, mag: d.mag, mm: d.mm },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q6: magnification from µm and mm; q13: from µm and cm
// ---------------------------------------------------------------------------------------------

interface Pictured {
  um: number
  /** The image, in mm (q6) or cm (q13). */
  image: number
  mag: number
}
/** Magnifications as a micrograph prints them: whole, at most three figures, never a power of ten. */
const goodMag = (s: Specimen, mag: number) => whole(mag) && figures(Math.round(mag)) <= 3 && mag >= s.mags[0] && mag <= s.mags[1] && !powerOfTen(mag)

const IMAGES_MM = range(10, 150, 0.5).filter((x) => !powerOfTen(x))
const photographed = (s: Specimen): Pictured[] =>
  s.sizes.flatMap((um) =>
    IMAGES_MM.map((image) => ({ um, image, mag: clean((image * 1000) / um) })).filter((x) => goodMag(s, x.mag) && clearOf(x.mag, x.image, x.um) && shiftFree(x.mag, x.image) && distinct(x.image, x.um)),
  )

const MAG_PROMPTS = [
  (s: Specimen, p: Pictured) => `${A(s.noun)} is ${show(p.um)} µm ${s.dim}. In ${a(picture(p.mag))} it measures ${show(p.image)} mm. Calculate the magnification.`,
  (s: Specimen, p: Pictured) => `In ${a(picture(p.mag))}, ${a(s.noun)} measures ${show(p.image)} mm ${s.dim}. Its real ${size(s)} is ${show(p.um)} µm. Calculate the magnification of the micrograph.`,
]

/** Magnification = image ÷ real, both in mm: written as q6 (a bacterium 2 µm long, 30 mm in a photograph, ×15000). */
export const magnification: Generator = {
  id: 'magnification-from-sizes',
  subjectId: 'biology',
  topicId: SCALE,
  replaces: ['q6'],
  build(r, slot, turn) {
    const s = SMALL[turn % SMALL.length]!
    // The real size first: a whole number of µm gives the most clean magnifications and would fill the context.
    const p = byFirst(r, `magnification-from-sizes:${s.name}`, () => photographed(s), (x) => x.um, (x) => x.mag, 3)
    const real = show(p.um / 1000)
    return numeric(
      slot,
      {
        prompt: pick(r, MAG_PROMPTS)(s, p),
        solution:
          `Convert first: $${show(p.um)}\\ \\mu\\text{m} = ${real}$ mm. Then $\\dfrac{${show(p.image)}}{${real}} = ${tex(p.mag)}$, so the magnification is **×${p.mag}**. ` +
          `Dividing ${show(p.image)} by ${show(p.um)} without converting gives ${show(p.image / p.um)}, a thousand times too small.`,
        method: ['converts both lengths to the same unit', 'divides image size by actual size'],
        answer: p.mag,
        line: `×${p.mag}`,
      },
      // Second route: the real size magnified back to the image.
      { agrees: near((p.um * p.mag) / 1000, p.image), detail: `${p.um} µm × ${p.mag} = ${p.image} mm` },
      { context: s.name, um: p.um, mm: p.image, mag: p.mag },
    )
  },
}

/** Drawn from electron micrographs: organelles and bacteria. */
const DRAWN_SMALL = SMALL.filter((s) => ['mitochondrion', 'chloroplast', 'bacterium', 'nucleus'].includes(s.name))
/** Drawings 4 to 20 cm, to the half centimetre, never 10 cm. */
const DRAWINGS_CM = range(4, 20, 0.5).filter((x) => !powerOfTen(x))
const drawnLarge = (s: Specimen): Pictured[] =>
  s.sizes.flatMap((um) =>
    DRAWINGS_CM.map((image) => ({ um, image, mag: clean((image * 10000) / um) })).filter(
      (x) => goodMag(s, x.mag) && clearOf(x.mag, x.image, x.image * 10, x.um) && shiftFree(x.mag, x.image) && distinct(x.image, x.um),
    ),
  )

const CM_PROMPTS = [
  (s: Specimen, p: Pictured) => `${A(s.noun)} is ${show(p.um)} µm ${s.dim}. A student draws it ${show(p.image)} cm ${s.dim}. Calculate the magnification of the drawing.`,
  (s: Specimen, p: Pictured) =>
    `A student draws ${a(s.noun)} from an electron micrograph. The drawing is ${show(p.image)} cm ${s.dim}; the real ${s.noun} is ${show(p.um)} µm ${s.dim}. Calculate the magnification of the drawing.`,
]

/** cm and µm both to mm, then image ÷ real: written as q13 (a mitochondrion 2 µm long drawn 8 cm long, ×40000). */
export const magnificationOfADrawing: Generator = {
  id: 'magnification-of-a-drawing',
  subjectId: 'biology',
  topicId: SCALE,
  replaces: ['q13'],
  build(r, slot, turn) {
    const s = DRAWN_SMALL[turn % DRAWN_SMALL.length]!
    const p = byFirst(r, `magnification-of-a-drawing:${s.name}`, () => drawnLarge(s), (x) => x.um, (x) => x.mag, 3)
    const mm = clean(p.image * 10)
    const real = show(p.um / 1000)
    return numeric(
      slot,
      {
        prompt: pick(r, CM_PROMPTS)(s, p),
        solution: `Two conversions are needed. $${show(p.image)}\\text{ cm} = ${show(mm)}$ mm, and $${show(p.um)}\\ \\mu\\text{m} = ${real}$ mm. Then $\\dfrac{${show(mm)}}{${real}} = ${tex(p.mag)}$, so the magnification is **×${p.mag}**.`,
        method: [`converts ${show(p.image)} cm to ${show(mm)} mm`, `converts ${show(p.um)} µm to ${real} mm`],
        answer: p.mag,
        line: `×${p.mag}`,
      },
      { agrees: near((p.um * p.mag) / 10000, p.image), detail: `${p.um} µm × ${p.mag} = ${p.image} cm` },
      { context: s.name, um: p.um, cm: p.image, mag: p.mag },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q19: nm → µm
// ---------------------------------------------------------------------------------------------

interface Tiny {
  name: string
  sentence: (nm: string) => string
  /** Real sizes in nm. */
  sizes: number[]
}
const NM_SIZES: Tiny[] = [
  { name: 'ribosome', sentence: (nm) => `A ribosome is about ${nm} nm across.`, sizes: range(20, 30) },
  { name: 'measles virus', sentence: (nm) => `A measles virus particle is ${nm} nm across.`, sizes: range(105, 300, 5) },
  { name: 'HIV', sentence: (nm) => `A particle of HIV, the virus that causes AIDS, is ${nm} nm across.`, sizes: range(95, 130).filter((x) => x !== 100) },
]
const NM_PROMPTS = [
  (t: Tiny, nm: string) => `${t.sentence(nm)} Convert ${nm} nm into micrometres (µm).`,
  (t: Tiny, nm: string) => `${t.sentence(nm)} What is this size in micrometres (µm)?`,
]

/** Nanometres to micrometres, ÷1000: written as q19 (20 nm, 0.02 µm). */
export const nmToMicrometres: Generator = {
  id: 'nm-to-micrometres',
  subjectId: 'biology',
  topicId: SCALE,
  replaces: ['q19'],
  build(r, slot, turn) {
    const t = NM_SIZES[turn % NM_SIZES.length]!
    const nm = pick(r, t.sizes)
    const um = clean(nm / 1000)
    return numeric(
      slot,
      {
        prompt: pick(r, NM_PROMPTS)(t, String(nm)),
        solution: `$${nm} \\div 1000 = ${show(um)}$ µm. Nano is $10^{-9}$ and micro is $10^{-6}$, so going **up** the ladder from nm to µm is **÷1000**.`,
        method: [],
        answer: um,
        units: 'µm',
        line: show(um),
      },
      { agrees: Math.round(um * 1e6) === nm * 1000, detail: `${um} µm` },
      { context: t.name, nm, um },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q21: standard form in metres → µm
// ---------------------------------------------------------------------------------------------

interface Formed {
  name: string
  noun: string
  dim: 'long' | 'across'
  /** The figure before × 10ⁿ, to two significant figures, and n. */
  mantissas: number[]
  exp: number
  kind: string
}
const SF_SIZES: Formed[] = [
  { name: 'liver cell', noun: 'liver cell', dim: 'across', mantissas: range(2, 3, 0.1), exp: -5, kind: 'an animal cell' },
  { name: 'cheek cell', noun: 'cheek cell', dim: 'across', mantissas: range(4, 7.5, 0.1), exp: -5, kind: 'an animal cell' },
  { name: 'palisade cell', noun: 'palisade cell', dim: 'long', mantissas: range(4, 9, 0.1), exp: -5, kind: 'a plant cell' },
  { name: 'onion epidermis cell', noun: 'onion epidermis cell', dim: 'long', mantissas: range(1.5, 4, 0.1), exp: -4, kind: 'a large plant cell' },
  { name: 'Paramecium', noun: '*Paramecium*', dim: 'long', mantissas: range(1.7, 3, 0.1), exp: -4, kind: 'a single-celled organism' },
]
const SF_PROMPTS = [
  (f: Formed, m: string) => `${A(f.noun)} is $${m} \\times 10^{${f.exp}}$ m ${f.dim}. Give its ${f.dim === 'long' ? 'length' : 'width'} in micrometres (µm).`,
  (f: Formed, m: string) => `The ${f.dim === 'long' ? 'length' : 'width'} of ${a(f.noun)} is $${m} \\times 10^{${f.exp}}$ m. What is this in micrometres (µm)?`,
]

/** Divide by 10⁻⁶: written as q21 (2 × 10⁻⁵ m, 20 µm). */
export const standardFormToMicrometres: Generator = {
  id: 'standard-form-to-micrometres',
  subjectId: 'biology',
  topicId: SCALE,
  replaces: ['q21'],
  build(r, slot, turn) {
    const f = SF_SIZES[turn % SF_SIZES.length]!
    const m = pick(r, f.mantissas)
    const um = clean(m * 10 ** (f.exp + 6))
    return numeric(
      slot,
      {
        prompt: pick(r, SF_PROMPTS)(f, show(m)),
        solution: `One micrometre is $10^{-6}$ m, so divide: $${show(m)} \\times 10^{${f.exp}} \\div 10^{-6} = ${show(m)} \\times 10^{${f.exp + 6}} = ${show(um)}$ µm. That is a sensible size for ${f.kind}.`,
        method: [],
        answer: um,
        units: 'µm',
      },
      // Second route: the length back in metres.
      { agrees: near(um * 1e-6, m * 10 ** f.exp), detail: `${um} × 10⁻⁶ m` },
      { context: f.name, mantissa: m, um },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q22: magnification from standard form
// ---------------------------------------------------------------------------------------------

/** q22's specimens: the small ones, and a virus at an electron microscope's highest powers. */
const SF_SMALL: Specimen[] = [
  ...SMALL.filter((s) => s.name !== 'mitochondrion'),
  { name: 'measles virus', noun: 'measles virus particle', dim: 'across', sizes: range(0.11, 0.3, 0.01), mags: [100000, 2000000] },
]
/** Real size in metres as standard form: 7.5 µm is 7.5 × 10⁻⁶ m, 0.15 µm is 1.5 × 10⁻⁷ m. */
const metres = (um: number): [number, number] => (um >= 1 ? [um, -6] : [clean(um * 10), -7])
const IMAGES_WHOLE = range(12, 150).filter((x) => !powerOfTen(x))
const sfPictured = (s: Specimen): Pictured[] =>
  s.sizes.flatMap((um) =>
    IMAGES_WHOLE.map((image) => ({ um, image, mag: clean((image * 1000) / um) })).filter((x) => goodMag(s, x.mag) && clearOf(x.mag, x.image, metres(x.um)[0]) && shiftFree(x.mag, x.image) && distinct(x.image, x.um)),
  )

const SFMAG_PROMPTS = [
  (s: Specimen, m: string, p: Pictured) => `${A(s.noun)} is $${m}$ m ${s.dim}. In ${a(picture(p.mag))} it measures ${p.image} mm ${s.dim}. Calculate the magnification of the micrograph.`,
  (s: Specimen, m: string, p: Pictured) => `In ${a(picture(p.mag))}, ${a(s.noun)} measures ${p.image} mm ${s.dim}. Its real ${size(s)} is $${m}$ m. Calculate the magnification of the micrograph.`,
]

/** Both lengths in metres, then image ÷ real: written as q22 (a red blood cell 8 × 10⁻⁶ m, 24 mm, ×3000). */
export const standardFormMagnification: Generator = {
  id: 'standard-form-magnification',
  subjectId: 'biology',
  topicId: SCALE,
  replaces: ['q22'],
  build(r, slot, turn) {
    const s = SF_SMALL[turn % SF_SMALL.length]!
    const p = byFirst(r, `standard-form-magnification:${s.name}`, () => sfPictured(s), (x) => x.um, (x) => x.mag, 3)
    const [mant, exp] = metres(p.um)
    const real = `${show(mant)} \\times 10^{${exp}}`
    const img = sciExact(p.image / 1000)
    const imgExp = Math.floor(Math.log10(p.image / 1000) + 1e-9)
    const d = imgExp - exp
    const ratio = clean(p.mag / 10 ** d)
    const umImage = p.image * 1000
    return numeric(
      slot,
      {
        prompt: pick(r, SFMAG_PROMPTS)(s, real, p),
        solution:
          `Put both lengths in metres: ${p.image} mm $= ${img}$ m. Then $\\dfrac{${img}}{${real}} = ${show(ratio)} \\times 10^{${d}} = ${tex(p.mag)}$, so the magnification is **×${p.mag}**. ` +
          `Working in µm gives the same: $${real}$ m is ${show(p.um)} µm, ${p.image} mm is ${prose(umImage)} µm, and $${tex(umImage)} \\div ${show(p.um)} = ${tex(p.mag)}$.`,
        method: ['both lengths in the same unit', 'divides image size by actual size'],
        answer: p.mag,
        line: `×${p.mag}`,
      },
      { agrees: near(mant * 10 ** exp * p.mag, p.image / 1000) && near(ratio * 10 ** d, p.mag), detail: `${mant}e${exp} m × ${p.mag} = ${p.image} mm` },
      { context: s.name, um: p.um, mm: p.image, mag: p.mag },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q23: real size from a scale bar
// ---------------------------------------------------------------------------------------------

interface Barred extends Specimen {
  /** Scale-bar labels in µm. */
  bars: number[]
  light: boolean
}
const BARRED: Barred[] = [
  { ...LIGHT[0]!, bars: [10, 20, 50], light: true },
  { ...LIGHT[1]!, bars: [50, 100, 200], light: true },
  { ...LIGHT[2]!, bars: [10, 20, 50], light: true },
  { ...SMALL[0]!, bars: [0.5, 2, 5], light: false },
  { ...SMALL[1]!, bars: [0.5, 2, 5], light: false },
  { ...SMALL[2]!, bars: [0.5, 2, 5], light: false },
]
interface Scaled {
  um: number
  bar: number
  /** The bar's length, mm. */
  length: number
  /** The specimen's image, mm. */
  mm: number
  mag: number
}
const scaled = (s: Barred): Scaled[] =>
  s.sizes.flatMap((um) =>
    s.bars.flatMap((bar) =>
      range(11, 40)
        .map((length) => {
          const mag = clean((length * 1000) / bar)
          return { um, bar, length, mag, mm: clean((um * mag) / 1000) }
        })
        .filter(
          (x) =>
            (s.light ? x.mag <= 1500 : x.mag >= 2000) &&
            onGrid(x.mm, 0.5) &&
            x.mm >= 10 &&
            x.mm <= 150 &&
            !powerOfTen(x.mm) &&
            shiftFree(x.um, x.bar, x.length, x.mm) &&
            distinct(x.bar, x.length, x.mm) &&
            noOnes(x.bar),
        ),
    ),
  )

const BAR_PROMPTS = [
  (s: Barred, x: Scaled) =>
    `On ${a(picture(x.mag))}, a scale bar labelled ${show(x.bar)} µm is ${x.length} mm long. ${A(s.noun)} in the same micrograph measures ${show(x.mm)} mm ${s.dim}. Calculate the actual ${size(s)} of the ${s.noun} in µm.`,
  (s: Barred, x: Scaled) =>
    `${A(s.noun)} measures ${show(x.mm)} mm ${s.dim} on ${a(picture(x.mag))}. The scale bar beside it is ${x.length} mm long and is labelled ${show(x.bar)} µm. Calculate the actual ${size(s)} of the ${s.noun} in µm.`,
]

/** Magnification from the bar, then the specimen: written as q23 (a 10 µm bar 20 mm long, a cell 50 mm, 25 µm). */
export const scaleBar: Generator = {
  id: 'size-from-a-scale-bar',
  subjectId: 'biology',
  topicId: SCALE,
  replaces: ['q23'],
  build(r, slot, turn) {
    const s = BARRED[turn % BARRED.length]!
    // The bar's label, then its length, each evenly, then the size: drawing the size alone let one bar fill 72% of a context.
    const bar = pick(r, s.bars)
    const x = byFirst(r, `size-from-a-scale-bar:${s.name}:${bar}`, () => scaled(s).filter((y) => y.bar === bar), (y) => y.length, (y) => y.um, 3)
    const [barUm, cellUm] = [x.length * 1000, x.mm * 1000]
    const bars = clean(x.mm / x.length)
    // The proportion route only where the number of bar lengths prints exactly.
    const proportion = atMost(bars, 3)
      ? ` Or by proportion: the ${s.noun} is $${show(x.mm)} \\div ${x.length} = ${show(bars)}$ bar lengths, and $${show(bars)} \\times ${show(x.bar)} = ${show(x.um)}$ µm.`
      : ''
    return numeric(
      slot,
      {
        prompt: pick(r, BAR_PROMPTS)(s, x),
        solution:
          `The bar: ${x.length} mm $= ${tex(barUm)}$ µm on the image, representing ${show(x.bar)} µm, so the magnification is $${tex(barUm)} \\div ${show(x.bar)} = \\times ${tex(x.mag)}$. ` +
          `The ${s.noun}: ${show(x.mm)} mm $= ${tex(cellUm)}$ µm, and $${tex(cellUm)} \\div ${tex(x.mag)} = ${show(x.um)}$ µm.${proportion}`,
        method: [`magnification from the scale bar, ×${x.mag}`, `converts ${show(x.mm)} mm to µm and divides by the magnification`],
        answer: x.um,
        units: 'µm',
      },
      // Second route: the specimen as a number of bar lengths.
      { agrees: near((x.mm / x.length) * x.bar, x.um), detail: `${x.mm} ÷ ${x.length} × ${x.bar}` },
      { context: s.name, bar: x.bar, length: x.length, mm: x.mm, mag: x.mag, um: x.um },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q24: estimating a cell's size from the field of view
// ---------------------------------------------------------------------------------------------

interface Field {
  name: string
  /** What the student does: "counts about 8 onion cells lying end to end across it". */
  seen: (n: number) => string
  /** "the length of one onion cell" */
  one: string
  mag: number
  /**
   * Field diameters in mm, as a ×10 eyepiece with a field number of 14 to 22 gives them: about
   * 4.5 mm at ×40, 1.8 mm at ×100, 0.45 mm at ×400. At ×100 and ×400 they are given to three
   * figures, as a field measured against a stage micrometer is: on a coarser grid too few field
   * and count pairs divide to a whole size.
   */
  fields: number[]
  /** Real sizes in µm, on the grid the answer is drawn from. */
  sizes: number[]
  step: number
  counts: number[]
}
const FIELDS: Field[] = [
  { name: 'onion at ×40', seen: (n) => `counts about ${n} onion cells lying end to end across it`, one: 'the length of one onion cell', mag: 40, fields: range(4, 5.5, 0.1), sizes: range(150, 400), step: 1, counts: range(11, 35) },
  { name: 'onion at ×100', seen: (n) => `counts about ${n} onion cells lying end to end across it`, one: 'the length of one onion cell', mag: 100, fields: range(1.4, 2.2, 0.02), sizes: range(150, 400), step: 1, counts: range(4, 18) },
  { name: 'cheek cells at ×100', seen: (n) => `estimates that about ${n} cheek cells would fit side by side across it`, one: 'the width of one cheek cell', mag: 100, fields: range(1.4, 2.2, 0.02), sizes: range(35, 80), step: 1, counts: range(18, 55) },
  { name: 'pondweed at ×400', seen: (n) => `counts about ${n} pondweed leaf cells lying end to end across it`, one: 'the length of one pondweed leaf cell', mag: 400, fields: range(0.38, 0.56, 0.002), sizes: range(50, 100), step: 1, counts: range(4, 12) },
  { name: 'red blood cells at ×400', seen: (n) => `estimates that about ${n} red blood cells would fit edge to edge across it`, one: 'the width of one red blood cell', mag: 400, fields: range(0.38, 0.56, 0.002), sizes: range(6.5, 8.5, 0.1), step: 0.1, counts: range(45, 85) },
]
interface Estimate {
  field: number
  n: number
  um: number
}
const estimates = (f: Field): Estimate[] =>
  f.fields.flatMap((field) =>
    f.counts
      .filter((n) => !powerOfTen(n))
      .map((n) => ({ field, n, um: clean((field * 1000) / n) }))
      .filter((x) => onGrid(x.um, f.step) && f.sizes.some((y) => near(y, x.um)) && clearOf(x.um, x.field, x.n, f.mag) && shiftFree(x.um, x.field) && distinct(x.field, x.n, f.mag)),
  )
const ESTIMATE_PROMPTS = [
  (f: Field, x: Estimate) =>
    `At a total magnification of ×${f.mag}, the field of view of a light microscope is ${show(x.field)} mm across. A student ${f.seen(x.n)}. Estimate ${f.one} in µm.`,
  (f: Field, x: Estimate) =>
    `A student uses a light microscope at a total magnification of ×${f.mag}, where the field of view is ${show(x.field)} mm across, and ${f.seen(x.n)}. Estimate ${f.one} in µm.`,
]

/** Field of view in µm ÷ the number of cells across it: written as q24 (1.6 mm at ×100, 8 onion cells, about 200 µm). */
export const fieldOfView: Generator = {
  id: 'size-from-the-field-of-view',
  subjectId: 'biology',
  topicId: SCALE,
  replaces: ['q24'],
  build(r, slot, turn) {
    const f = FIELDS[turn % FIELDS.length]!
    // The count first: every field divides by 4 or 8 most often, so drawing the size alone let one count fill a context.
    // A count of 5, 20 or 50 is never used (shiftFree in estimates): the size would be the field doubled or halved, point moved.
    const x = byFirst(r, `size-from-the-field-of-view:${f.name}`, () => estimates(f), (y) => y.n, (y) => y.um, 2)
    const fieldUm = clean(x.field * 1000)
    return numeric(
      slot,
      {
        prompt: pick(r, ESTIMATE_PROMPTS)(f, x),
        solution:
          `${show(x.field)} mm $= ${tex(fieldUm)}$ µm, and $\\dfrac{${tex(fieldUm)}}{${x.n}} = ${show(x.um)}$ µm. ` +
          `This is an **estimate**: the cells are not all the same size and the count is approximate, but it gives the right order of magnitude, which is what an estimate is for.`,
        method: [`converts ${show(x.field)} mm to ${prose(fieldUm)} µm and divides by ${x.n}`],
        answer: x.um,
        units: 'µm',
        line: `about ${show(x.um)} µm`,
      },
      { agrees: near((x.um * x.n) / 1000, x.field), detail: `${x.n} × ${x.um} µm = ${x.field} mm` },
      { context: f.name, field: x.field, n: x.n, um: x.um },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// q32: a photograph enlarged again
// ---------------------------------------------------------------------------------------------

const ENLARGEMENTS = [3, 4, 5, 6, 8]
interface Poster {
  um: number
  mag: number
  k: number
  /** On the poster, mm. */
  mm: number
}
const posters = (s: Specimen): Poster[] =>
  s.sizes.flatMap((um) =>
    magsFor(s).flatMap((mag) =>
      ENLARGEMENTS.map((k) => ({ um, mag, k, mm: clean((um * mag * k) / 1000) })).filter(
        (x) => onGrid(x.mm, 0.5) && figures(x.mm) <= 3 && x.mm >= 30 && x.mm <= 300 && !powerOfTen(x.mm) && shiftFree(x.um, x.mag, x.k, x.mm, x.mag * x.k) && distinct(x.mag, x.k, x.mm),
      ),
    ),
  )
const POSTER_PROMPTS = [
  (s: Specimen, x: Poster) =>
    `A photograph of ${a(s.noun)} was taken through a light microscope at a magnification of ×${x.mag} and then enlarged ${word(x.k)} times to make a poster. On the poster the ${s.noun} measures ${x.mm} mm ${s.dim}. Calculate the actual ${size(s)} of the ${s.noun} in micrometres (µm).`,
  (s: Specimen, x: Poster) =>
    `A student photographs ${a(s.noun)} through a light microscope at a magnification of ×${x.mag}, then prints the photograph enlarged ${word(x.k)} times for a classroom display. In the print the ${s.noun} is ${x.mm} mm ${s.dim}. Calculate the actual ${size(s)} of the ${s.noun} in micrometres (µm).`,
]

/** The two magnifications multiply: written as q32 (×600 enlarged five times, 90 mm, 30 µm). */
export const enlargedPhotograph: Generator = {
  id: 'size-from-an-enlarged-photograph',
  subjectId: 'biology',
  topicId: SCALE,
  replaces: ['q32'],
  build(r, slot, turn) {
    const s = LIGHT[turn % LIGHT.length]!
    // The enlargement, then the photograph's magnification, each evenly, then the size.
    const k = pick(r, ENLARGEMENTS)
    const x = byFirst(r, `size-from-an-enlarged-photograph:${s.name}:${k}`, () => posters(s).filter((y) => y.k === k), (y) => y.mag, (y) => y.um, 3)
    const total = x.mag * x.k
    const mm = show(x.um / 1000)
    const forgot = clean(x.mm / x.mag)
    return numeric(
      slot,
      {
        prompt: pick(r, POSTER_PROMPTS)(s, x),
        solution:
          `The picture is magnified twice over, and the two magnifications multiply: $${x.mag} \\times ${x.k} = ${tex(total)}$, so the ${s.noun} in it is ${prose(total)} times its real size. ` +
          `Actual size $= \\dfrac{\\text{image size}}{\\text{magnification}} = \\dfrac{${x.mm}}{${tex(total)}} = ${mm}$ mm, and $${mm} \\times 1000 = ${x.um}$ µm, a believable size for ${a(s.noun)}. ` +
          `Forgetting the enlargement gives $${x.mm} \\div ${x.mag} = ${show(forgot)}$ mm $= ${tex(forgot * 1000)}$ µm, ${word(x.k)} times too large.`,
        method: [`combines the magnifications: ${x.mag} × ${x.k} = ${prose(total)}`, `divides ${x.mm} mm by ${prose(total)} and converts to µm`],
        answer: x.um,
        units: 'µm',
      },
      { agrees: near((x.um * total) / 1000, x.mm), detail: `${x.um} µm × ${total} = ${x.mm} mm` },
      { context: s.name, mag: x.mag, k: x.k, mm: x.mm, um: x.um },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Doubling: bacteria (microbes q6, q12, q25) and cells by mitosis (mitosis q27)
// ---------------------------------------------------------------------------------------------

/** A time in minutes as a prompt says it: "100 minutes", "6 hours", "4 hours 20 minutes". */
export function duration(min: number): string {
  if (min < 120) return `${min} minutes`
  const [h, m] = [Math.floor(min / 60), min % 60]
  return m === 0 ? `${h} hours` : `${h} hours ${m} minutes`
}
/** "Six hours is 360 minutes: " or nothing when the prompt already gave minutes. */
const inMinutes = (min: number) => (min < 120 ? '' : `${cap(duration(min))} is ${min} minutes, and `)

interface Bacterium {
  name: string
  /** The opening, ending in a full stop, with the doubling time in it. */
  text: (d: number) => string
  /** Doubling times in minutes. */
  doublings: number[]
}
const DOUBLERS: Bacterium[] = [
  { name: 'E. coli', text: (d) => `An *Escherichia coli* bacterium divides every ${d} minutes in a warm nutrient broth.`, doublings: [20, 25, 30, 40] },
  { name: 'Salmonella', text: (d) => `A *Salmonella* bacterium divides every ${d} minutes in warm food.`, doublings: [20, 25, 30, 40] },
  { name: 'Staphylococcus', text: (d) => `A *Staphylococcus aureus* bacterium divides every ${d} minutes on a warm cream cake.`, doublings: [25, 30, 35, 40] },
  { name: 'bacterium', text: (d) => `A bacterium divides every ${d} minutes in ideal conditions.`, doublings: [15, 20, 25, 30, 40] },
]
/** The divisions each slot asks for: q6 a count a student can double by hand, q12 a large one. */
const DIVISIONS: Record<string, number[]> = { q6: range(4, 13), q12: range(14, 23) }

interface Doubling {
  d: number
  n: number
  /** Minutes. */
  t: number
}
/** Every doubling time and number of divisions whose total time is whole tens of minutes. */
const doublingsOf = (b: Bacterium, ns: number[]): Doubling[] =>
  b.doublings.flatMap((d) => ns.map((n) => ({ d, n, t: d * n })).filter((x) => x.t % 10 === 0 && clearOf(2 ** x.n, x.d, x.t, x.t / 60)))

const FROM_ONE_PROMPTS = [
  (b: Bacterium, x: Doubling) => `${b.text(x.d)} Starting from one bacterium, how many are there after ${duration(x.t)}?`,
  (b: Bacterium, x: Doubling) => `${b.text(x.d)} How many bacteria will there be after ${duration(x.t)}, starting from a single cell?`,
]

/** 2ⁿ from one: written as q6 (every 20 minutes for 2 hours, 64) and q12 (for 6 hours, 262144). */
export const bacterialDoubling: Generator = {
  id: 'bacterial-doubling',
  subjectId: 'biology',
  topicId: MICROBES,
  replaces: ['q6', 'q12'],
  build(r, slot, turn) {
    const b = DOUBLERS[turn % DOUBLERS.length]!
    const ns = DIVISIONS[slot.id] ?? DIVISIONS.q6!
    // The number of divisions evenly first, so every power is as likely; then a time that fits.
    const x = byFirst(r, `bacterial-doubling:${slot.id}:${b.name}`, () => doublingsOf(b, ns), (y) => y.d, (y) => y.n, 3)
    const count = 2 ** x.n
    const big = slot.id === 'q12'
    return numeric(
      slot,
      {
        prompt: pick(r, FROM_ONE_PROMPTS)(b, x) + (big ? ' Give a whole number.' : ''),
        solution: `${inMinutes(x.t)}$${x.t} \\div ${x.d} = ${x.n}$ divisions. Each doubles the count, so the number after $n$ divisions is $2^n$: ${closes(`2^{${x.n}}`, count, 'bacteria')}`,
        method: [`${x.n} divisions`],
        answer: count,
        line: show(count),
      },
      // Second route: double it n times over.
      { agrees: Array.from({ length: x.n }).reduce<number>((c) => c * 2, 1) === count && x.d * x.n === x.t, detail: `${x.n} doublings` },
      { context: b.name, d: x.d, n: x.n, minutes: x.t },
    )
  },
}

interface Food {
  name: string
  text: (d: number, n0: string) => string
  ask: (t: string) => string
  doublings: number[]
}
const FOODS: Food[] = [
  {
    name: 'Salmonella on chicken',
    text: (d, n0) => `In a warm kitchen, *Salmonella* bacteria on a piece of raw chicken divide every ${d} minutes. The chicken carries ${n0} bacteria when it is taken out of the fridge.`,
    ask: (t) => `Calculate how many bacteria it carries after ${t} left on the kitchen counter.`,
    doublings: [20, 25, 30, 40],
  },
  {
    name: 'Bacillus cereus in rice',
    text: (d, n0) => `*Bacillus cereus* bacteria in a bowl of cooked rice left out in a warm room divide every ${d} minutes. The rice holds ${n0} bacteria once it has cooled.`,
    ask: (t) => `Calculate how many bacteria the rice holds after ${t} more in the warm room.`,
    doublings: [20, 25, 30, 40],
  },
  {
    name: 'Staphylococcus in a sandwich',
    text: (d, n0) => `*Staphylococcus aureus* bacteria in a ham sandwich left in a hot car divide every ${d} minutes. The sandwich carries ${n0} bacteria when it is left in the car.`,
    ask: (t) => `Calculate how many bacteria the sandwich carries after ${t} in the car.`,
    doublings: [25, 30, 35, 40],
  },
  {
    name: 'E. coli in mince',
    text: (d, n0) => `*Escherichia coli* bacteria in raw minced beef left out of the fridge on a hot day divide every ${d} minutes. The mince carries ${n0} bacteria when it is taken out.`,
    ask: (t) => `Calculate how many bacteria the mince carries after ${t} out of the fridge.`,
    doublings: [20, 25, 30, 40],
  },
]
/** Starting counts: never a power of ten, which would make the answer 2ⁿ with the point moved. */
const STARTS = [40, 50, 60, 75, 80, 120, 150, 200, 250, 300, 400, 500, 600, 750, 800, 1200, 1500, 2500]

/** N₀ × 2ⁿ: written as microbes q25 (500 Salmonella, every 30 minutes for 4 hours, 128000). */
export const bacterialGrowth: Generator = {
  id: 'bacterial-growth-from-a-count',
  subjectId: 'biology',
  topicId: MICROBES,
  replaces: ['q25'],
  build(r, slot, turn) {
    const f = FOODS[turn % FOODS.length]!
    const d = pick(r, f.doublings)
    // Up to six hours on the side, in whole tens of minutes.
    const n = pick(r, range(4, 10).filter((k) => (k * d) % 10 === 0 && k * d <= 360))
    const t = n * d
    // Never the doubling time, nor it with the point moved.
    const n0 = pick(r, STARTS.filter((x) => !tenfold(d, x) && distinct(d, x)))
    const factor = 2 ** n
    const count = n0 * factor
    const when = duration(t)
    return numeric(
      slot,
      {
        prompt: `${f.text(d, prose(n0))} ${f.ask(when)}`,
        solution:
          `Count the divisions first: ${t < 120 ? `$${t} \\div ${d} = ${n}$ divisions` : `${when} is ${t} minutes, and $${t} \\div ${d} = ${n}$ divisions`}. ` +
          `Each division doubles the number, so the count is multiplied by $2^{${n}} = ${tex(factor)}$. Then ${closes(`${tex(n0)} \\times ${tex(factor)}`, count, 'bacteria')} ` +
          `Doubling is a power, not a multiple: multiplying ${prose(n0)} by $${n} \\times 2 = ${2 * n}$ would give ${prose(n0 * 2 * n)} and miss almost all of the growth.`,
        method: [`counts ${n} divisions in ${when}`, `multiplies the starting count by 2 to the power ${n}, which is ${prose(factor)}`],
        answer: count,
        line: prose(count),
      },
      // Second route: halve the answer back n times to the starting count.
      { agrees: Array.from({ length: n }).reduce<number>((c) => c / 2, count) === n0, detail: `${count} halved ${n} times` },
      { context: f.name, d, n, n0, minutes: t },
    )
  },
}

interface Culture {
  name: string
  text: (h: number) => string
  /** Hours per cell cycle. */
  cycles: number[]
  close: string
}
const CULTURES: Culture[] = [
  {
    name: 'cancer cells',
    text: (h) => `A type of cancer cell grown in a laboratory completes the cell cycle once every ${h} hours, each cell dividing by mitosis into two.`,
    cycles: [18, 20, 30, 36, 40, 48],
    close: 'This is what uncontrolled division means: healthy cells would have stopped dividing once enough were present, and a tumour is the result of cells that do not.',
  },
  {
    name: 'skin cells',
    text: (h) => `Human skin cells grown in a laboratory to make a graft for a burns patient complete the cell cycle once every ${h} hours, each cell dividing by mitosis into two.`,
    cycles: [30, 36, 40, 48],
    close: 'Every new cell is genetically identical to the cell it came from, so the graft is made of the patient’s own kind of skin cell.',
  },
  {
    name: 'stem cells',
    text: (h) => `Human embryonic stem cells grown in a laboratory complete the cell cycle once every ${h} hours, each cell dividing by mitosis into two.`,
    cycles: [30, 32, 36, 40],
    close: 'Mitosis copies the chromosomes exactly, so every one of these cells is still an undifferentiated stem cell, identical to the first.',
  },
]
const CULTURE_STARTS = [200, 250, 300, 400, 500, 600, 750, 800, 1200, 1500, 2000, 2500, 3000, 4000, 5000]

/** N₀ × 2ⁿ over days: written as mitosis q27 (every 30 hours for 5 days from 1000, 16000 cells). */
export const cellCycleDoubling: Generator = {
  id: 'cell-cycle-doubling',
  subjectId: 'biology',
  topicId: MITOSIS,
  replaces: ['q27'],
  build(r, slot, turn) {
    const c = CULTURES[turn % CULTURES.length]!
    const h = pick(r, c.cycles)
    // Whole days, two weeks at most, three to eight cycles: with two, 2² = 2 × 2 and "multiply by 2n" scores. No cycle is a day long, so the days are never the cycles.
    const n = pick(r, range(3, 8).filter((k) => (k * h) % 24 === 0 && (k * h) / 24 <= 14))
    const days = (n * h) / 24
    const hours = n * h
    const n0 = pick(r, CULTURE_STARTS)
    const factor = 2 ** n
    const cells = n0 * factor
    return numeric(
      slot,
      {
        prompt: `${c.text(h)} A culture starts with ${prose(n0)} of these cells. Calculate how many cells the culture will contain after ${days} days, assuming that no cells die.`,
        solution:
          `First the number of cell cycles: ${days} days $= ${days} \\times 24 = ${hours}$ hours, and $\\dfrac{${hours}}{${h}} = ${n}$ cycles. ` +
          `Each cycle doubles the number of cells, so ${word(n)} cycles multiply it by $${Array(n).fill('2').join(' \\times ')} = ${factor}$. Then ${closes(`${tex(n0)} \\times ${factor}`, cells, 'cells')} ` +
          `The common slip is to multiply by ${n}, as if each cycle added one new cell per cell rather than doubling the total. ${c.close}`,
        method: [`converts ${days} days to ${hours} hours and finds ${n} cell cycles`, `doubles ${word(n)} times: multiplies by ${factor}`],
        answer: cells,
        units: 'cells',
      },
      { agrees: Array.from({ length: n }).reduce<number>((x) => x / 2, cells) === n0 && hours / h === n, detail: `${cells} halved ${n} times` },
      { context: c.name, h, n, n0, days },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Microbes q24: the mean of three colony counts
// ---------------------------------------------------------------------------------------------

interface Plated {
  name: string
  source: string
  /** Means a plate of it gives, colonies. */
  means: number[]
}
const PLATED: Plated[] = [
  { name: 'pond water', source: 'pond water', means: range(18, 60) },
  { name: 'river water', source: 'river water', means: range(20, 80) },
  { name: 'soil', source: 'a diluted soil suspension', means: range(40, 150) },
  { name: 'water butt', source: 'rainwater from a water butt', means: range(15, 50) },
]
/**
 * Three different offsets from the mean that sum to nothing, none of them zero, so no count is the
 * mean; `ok` refuses a count (the incubation temperature, say).
 */
function offsets(r: Rng, m: number, spread: number, ok: (count: number) => boolean): number[] {
  const all: number[][] = []
  for (let x = -spread; x <= spread; x++)
    for (let y = x + 1; y <= spread; y++) {
      const z = -x - y
      if (z > y && z <= spread && x !== 0 && y !== 0 && z !== 0 && [x, y, z].every((o) => ok(m + o))) all.push([x, y, z])
    }
  return shuffle(r, pick(r, all))
}
const MEAN_PROMPTS = [
  (p: Plated, t: number, days: string, xs: string) =>
    `A student spreads the same volume of ${p.source} on three agar plates in the same way, keeps them at ${t} °C for ${days} days and counts the bacterial colonies on each: ${xs}. Calculate the mean number of colonies per plate.`,
  (p: Plated, t: number, days: string, xs: string) =>
    `Three agar plates are each spread with the same volume of ${p.source} and kept at ${t} °C for ${days} days. The numbers of bacterial colonies that grow are ${xs}. Calculate the mean number of colonies per plate.`,
]

/** Sum ÷ 3: written as microbes q24 (24, 31 and 29, mean 28). */
export const meanColonies: Generator = {
  id: 'mean-colony-count',
  subjectId: 'biology',
  topicId: MICROBES,
  replaces: ['q24'],
  build(r, slot, turn) {
    const p = PLATED[turn % PLATED.length]!
    // School cultures are kept at 25 °C at most; 20 °C slows them. The temperature first, so neither
    // the mean nor any count is the same figure.
    const t = pick(r, [20, 25])
    const m = pick(r, p.means.filter((x) => !powerOfTen(x) && x !== t))
    const counts = offsets(r, m, Math.max(4, Math.round(m * 0.2)), (x) => x !== t).map((o) => m + o)
    const sum = counts[0]! + counts[1]! + counts[2]!
    const xs = `${counts[0]}, ${counts[1]} and ${counts[2]}`
    const days = pick(r, ['two', 'three'])
    return numeric(
      slot,
      {
        prompt: pick(r, MEAN_PROMPTS)(p, t, days, xs),
        solution: `Add the three counts and divide by three: $\\dfrac{${counts.join(' + ')}}{3} = \\dfrac{${sum}}{3} = ${m}$ colonies per plate. Three plates are set up rather than one so that an odd plate stands out and the mean is more reliable than any single count.`,
        method: ['adds the three counts and divides by 3'],
        answer: m,
      },
      { agrees: sum === 3 * m && counts.every((c) => c !== m), detail: `${sum} = 3 × ${m}` },
      { context: p.name, mean: m, low: Math.min(...counts), high: Math.max(...counts), temperature: t },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Chromosome numbers: haploid gametes (cells q24) and two sperm in one egg (cells q25)
// ---------------------------------------------------------------------------------------------

/** Diploid numbers, each the species' own (2n). */
export const ANIMALS: [string, number][] = [
  ['human', 46], ['chimpanzee', 48], ['gorilla', 48], ['orangutan', 48], ['dog', 78], ['grey wolf', 78], ['cat', 38], ['lion', 38], ['tiger', 38],
  ['horse', 64], ['donkey', 62], ['cow', 60], ['sheep', 54], ['goat', 60], ['pig', 38], ['mouse', 40], ['rat', 42], ['rabbit', 44],
  ['guinea pig', 64], ['golden hamster', 44], ['chicken', 78], ['turkey', 80], ['African elephant', 56], ['giraffe', 30], ['camel', 74],
  ['alpaca', 74], ['red deer', 68], ['brown bear', 74], ['zebrafish', 50], ['fruit fly', 8],
]
export const PLANTS: [string, number][] = [
  ['potato', 48], ['bread wheat', 42], ['rice', 24], ['maize', 20], ['tomato', 24], ['garden pea', 14], ['onion', 16], ['cabbage', 18],
  ['sunflower', 34], ['apple', 34], ['barley', 14], ['rye', 14], ['oat', 42], ['cucumber', 14], ['soya bean', 40], ['tobacco', 48],
  ['carrot', 18], ['lettuce', 18], ['broad bean', 12], ['strawberry', 56], ['arabica coffee', 44],
]

interface Kingdom {
  name: string
  species: [string, number][]
  /** The two gametes, as "a dog sperm cell" names them. */
  gametes: [string, string]
  /** "body cell" or "leaf cell". */
  cell: string
}
/**
 * q25's species: mammals only. Birds are polyspermic (several sperm enter a hen's egg as a matter
 * of course) and triploid chickens and zebrafish live, so "three sets would not develop" is true of
 * mammals and not of them; fruit flies are left out with them.
 */
export const MAMMALS = ANIMALS.filter(([s]) => !['chicken', 'turkey', 'zebrafish', 'fruit fly'].includes(s))
const KINGDOMS: Kingdom[] = [
  { name: 'animal', species: ANIMALS, gametes: ['sperm cell', 'egg cell'], cell: 'body cell' },
  { name: 'plant', species: PLANTS, gametes: ['pollen grain', 'egg cell'], cell: 'leaf cell' },
]
const HAPLOID_PROMPTS = [
  (sp: string, two: number, cell: string, g: string) => `${A(`${sp} ${cell}`)} contains ${two} chromosomes. Calculate the number of chromosomes in the haploid nucleus of ${a(`${sp} ${g}`)}.`,
  (sp: string, two: number, cell: string, g: string) => `Each ${sp} ${cell} has ${two} chromosomes in its nucleus. How many chromosomes are in the nucleus of ${a(`${sp} ${g}`)}?`,
]

/** Half the body-cell number: written as cells q24 (a dog, 78, a sperm cell with 39). */
export const haploidNumber: Generator = {
  id: 'haploid-chromosome-number',
  subjectId: 'biology',
  topicId: CELLS,
  replaces: ['q24'],
  build(r, slot, turn) {
    const k = KINGDOMS[turn % KINGDOMS.length]!
    const [sp, two] = evenly(r, `haploid-chromosome-number:${k.name}`, () => k.species, (x) => x[1])
    const g = pick(r, [0, 1])
    const [gamete, other] = [k.gametes[g]!, k.gametes[1 - g]!]
    const n = two / 2
    return numeric(
      slot,
      {
        prompt: pick(r, HAPLOID_PROMPTS)(sp, two, k.cell, gamete),
        solution: `A gamete's haploid nucleus carries **half the chromosomes** of a body cell: $${two} \\div 2 = ${n}$. The ${sp} ${other} nucleus has ${n} too, so fertilisation restores the body-cell number of ${two} in the zygote.`,
        method: ['halves the body-cell number'],
        answer: n,
      },
      { agrees: Number.isInteger(n) && n + n === two, detail: `${n} + ${n} = ${two}` },
      { context: k.name, species: sp, diploid: two },
    )
  },
}

const POLYSPERMY_PROMPTS = [
  (sp: string, two: number) =>
    `${A(`${sp} body cell`)} contains ${two} chromosomes. The egg cell membrane normally changes after fertilisation so that no more sperm can enter. Calculate how many chromosomes a fertilised egg would contain if this change failed and two sperm cells entered the egg.`,
  (sp: string, two: number) =>
    `The body cells of ${a(sp)} each contain ${two} chromosomes. Straight after fertilisation the membrane of the egg cell changes to keep out any more sperm. If this failed and two sperm cells entered ${a(`${sp} egg`)}, how many chromosomes would the fertilised egg contain?`,
  (sp: string, two: number) =>
    `${A(sp)} has ${two} chromosomes in each body cell. Normally, once one sperm cell is inside ${a(`${sp} egg cell`)}, the egg's membrane changes so no other sperm can enter. Calculate the number of chromosomes in the fertilised egg if two sperm cells got in.`,
  (sp: string, two: number) =>
    `In ${a(sp)}, each body cell contains ${two} chromosomes. The membrane of an egg cell changes after fertilisation so that only one sperm cell can enter. Calculate how many chromosomes the fertilised egg would have if two sperm cells had entered before the membrane changed.`,
  (sp: string, two: number) =>
    `${A(`${sp} body cell`)} has ${two} chromosomes. After one sperm cell enters ${a(`${sp} egg cell`)}, the egg cell membrane changes to stop any more entering. Suppose the change came too late and a second sperm cell also entered. Calculate the number of chromosomes the fertilised egg would then contain.`,
]

/** Three haploid sets: written as cells q25 (a horse, 64, with 96). */
export const polyspermy: Generator = {
  id: 'two-sperm-chromosome-number',
  subjectId: 'biology',
  topicId: CELLS,
  replaces: ['q25'],
  build(r, slot, turn) {
    const [sp, two] = evenly(r, 'two-sperm-chromosome-number', () => MAMMALS, (x) => x[1])
    const n = two / 2
    const three = 3 * n
    return numeric(
      slot,
      {
        prompt: POLYSPERMY_PROMPTS[turn % POLYSPERMY_PROMPTS.length]!(sp, two),
        solution:
          `Each gamete is haploid, with half the body-cell number: $${two} \\div 2 = ${n}$ chromosomes in the egg nucleus and ${n} in each sperm nucleus. ` +
          `With two sperm entering, the cell holds three haploid sets: $3 \\times ${n} = ${three}$ chromosomes, instead of the normal $2 \\times ${n} = ${two}$. ` +
          `An embryo with three sets would not develop, which is the reason the egg's membrane changes the moment the first sperm is in.`,
        method: [`halves ${two} to find ${n} in each gamete nucleus`, 'adds three haploid sets: egg plus two sperm'],
        answer: three,
      },
      { agrees: two + n === three, detail: `${two} + ${n} = ${three}` },
      { context: 'animal', species: sp, diploid: two },
    )
  },
}

// ---------------------------------------------------------------------------------------------
// Mitosis q26: a baby's percentage gain in mass
// ---------------------------------------------------------------------------------------------

interface Check6 {
  name: string
  /** "6-month", "one-year" */
  check: string
  girl: boolean
  /** Masses at the check, kg, from the 2nd to the 98th centile. */
  masses: [number, number]
  /** The gains a baby keeping near one centile line shows, %. */
  gains: [number, number]
}
const CHECKS: Check6[] = [
  { name: 'girl at 3 months', check: '3-month', girl: true, masses: [4.6, 7.2], gains: [55, 110] },
  { name: 'boy at 3 months', check: '3-month', girl: false, masses: [5.0, 7.8], gains: [55, 110] },
  { name: 'girl at 6 months', check: '6-month', girl: true, masses: [5.8, 9.2], gains: [90, 170] },
  { name: 'boy at 6 months', check: '6-month', girl: false, masses: [6.4, 9.8], gains: [90, 170] },
  { name: 'girl at 1 year', check: 'one-year', girl: true, masses: [7.1, 10.9], gains: [140, 220] },
  { name: 'boy at 1 year', check: 'one-year', girl: false, masses: [7.8, 11.6], gains: [140, 220] },
]
/** Birth masses from the 2nd to the 98th centile, kg, weighed to 10 g as a baby scale reads. */
const BIRTH = range(2.6, 4.2, 0.01)
interface Gain {
  birth: number
  now: number
  pct: number
}
/**
 * A whole-number gain drawn first, then the birth mass and a mass at the check, both to 10 g, that
 * give it exactly: the answer has at most three figures. Never 100%, nor the gain in kg or either
 * mass with the point moved, doubled or halved.
 */
const gains = (c: Check6): Gain[] =>
  BIRTH.flatMap((birth) =>
    range(c.gains[0], c.gains[1])
      .map((pct) => ({ birth, pct, now: clean((birth * (100 + pct)) / 100) }))
      .filter((x) => atMost(x.now, 2) && x.now >= c.masses[0] && x.now <= c.masses[1] && clearOf(x.pct, x.birth, x.now, clean(x.now - x.birth)) && !powerOfTen(x.pct)),
  )

/** (new − old) ÷ old × 100: written as mitosis q26 (3.2 kg to 8.0 kg, 150%). */
export const babyMassGain: Generator = {
  id: 'baby-mass-percentage-gain',
  subjectId: 'biology',
  topicId: MITOSIS,
  replaces: ['q26'],
  build(r, slot, turn) {
    const c = CHECKS[turn % CHECKS.length]!
    // The birth mass first: drawing the gain alone let 4.0 kg, which divides into the most clean gains, fill 76% of a context.
    const x = byFirst(r, `baby-mass-percentage-gain:${c.name}`, () => gains(c), (y) => y.birth, (y) => y.pct, 3)
    const [her, she] = c.girl ? ['her', 'she'] : ['his', 'he']
    const change = clean(x.now - x.birth)
    const [b, nw, ch] = [fixed(x.birth, 2), fixed(x.now, 2), fixed(change, 2)]
    return numeric(
      slot,
      {
        prompt: `A baby ${c.girl ? 'girl' : 'boy'} had a mass of ${b} kg at birth. At ${her} ${c.check} check ${her} mass was ${nw} kg, and the health visitor plotted it on a percentile chart. Calculate the percentage increase in ${her} mass since birth.`,
        solution:
          `Increase $= ${nw} - ${b} = ${ch}$ kg. As a percentage of the starting mass, $\\dfrac{${ch}}{${b}} \\times 100 = ${show(x.pct)}\\%$. Divide by the mass at birth, not the mass now. ` +
          `The percentile chart then shows something the percentage gain cannot: whether ${she} has stayed on the same percentile line as other ${c.girl ? 'girls' : 'boys'} of ${her} age, which is what the health visitor is really checking.`,
        method: [`finds the increase, ${ch} kg, and divides it by the birth mass of ${b} kg`],
        answer: x.pct,
        units: '%',
      },
      // Second route: the new mass as a percentage of the old, less 100.
      { agrees: near((x.now / x.birth) * 100 - 100, x.pct), detail: `${x.now} ÷ ${x.birth} × 100 − 100` },
      { context: c.name, birth: x.birth, now: x.now, pct: x.pct },
    )
  },
}

export const microscopyGenerators: Generator[] = [
  mmToMicrometres,
  scaleTotalMagnification,
  actualSize,
  magnification,
  magnificationOfADrawing,
  nmToMicrometres,
  standardFormToMicrometres,
  standardFormMagnification,
  scaleBar,
  fieldOfView,
  imageSize,
  enlargedPhotograph,
  microbeTotalMagnification,
  bacterialDoubling,
  meanColonies,
  bacterialGrowth,
  haploidNumber,
  polyspermy,
  babyMassGain,
  cellCycleDoubling,
]

/** For the tests. */
export const MICROSCOPY = {
  LIGHT, SMALL, SF_SMALL, MM_SIZES, NM_SIZES, SF_SIZES, BARRED, FIELDS, LENSES, CELL_SLIDES, MICROBE_SLIDES, DOUBLERS, DIVISIONS, FOODS, STARTS,
  CULTURES, CULTURE_STARTS, PLATED, KINGDOMS, CHECKS, BIRTH, ENLARGEMENTS,
  drawings, photographed, drawnLarge, sfPictured, scaled, estimates, posters, gains, doublingsOf,
}
