import { draw, int, pick, type Rng, weighted } from '../random.ts'
import type { Generator } from '../types.ts'
import { an, count, csBySlot, numericDraft, texCount } from './build.ts'

/**
 * Computer Science (AQA 8525) generators: 3.3.6 representing images and 3.3.7 representing sound
 * (representing-images-and-sound).
 *
 * - 3.3.6: "Size = (bits) = W x H x D" and "Size = (bytes) = (W x H x D)/8", W and H the image's
 *   width and height in pixels and D the colour depth, "the number of bits used to represent each
 *   pixel". q3 and q9 (a black and white bitmap, D = 1) ask for bits, q6 for bytes. q4 asks how
 *   many colours a depth gives, 2^D: the specification has no formula for it, but a depth of D bits
 *   is D bits per pixel, and D bits make 2^D patterns (3.3.1 counting in binary).
 * - 3.3.7: "File size (bits) = rate x res x secs", the sampling rate in hertz (samples a second)
 *   and the sample resolution in bits per sample. q5 asks for bits; q13 for kilobytes, through
 *   bytes and the decimal prefix of 3.3.3, 1 kB = 1000 bytes.
 *
 * Every numeric slot in the topic has a generator; none is left written.
 */
const TOPIC = 'representing-images-and-sound'

/**
 * The papers are sat without a calculator, so every slot caps its bits near 25 times the written
 * question's: q5 (written 160 000 bits) at 4 000 000, q13 (1 280 000) at 8 000 000, q6 (20 000) at
 * 400 000. Lengths and sizes are drawn from the values that fit the cap, not filtered after.
 */
export const CAPS = { q5: 4_000_000, q13: 8_000_000, q6: 400_000 }

// ---------------------------------------------------------------------------------------------
// Image file size in bits: q3
// ---------------------------------------------------------------------------------------------

interface Picture {
  name: string
  /** Width and height, from the picture's own sizes. */
  size: (r: Rng) => [number, number]
  depths: number[]
  prompts: ((w: number, h: number, d: number) => string)[]
}

/** Two different sizes from a list, the wider first, as most images are landscape, and no more than 3 times as wide as high. */
const landscape = (sizes: number[]) => (r: Rng) => {
  const [a, b] = draw(r, (rr) => [pick(rr, sizes), pick(rr, sizes)], ([x, y]) => x !== y && Math.max(x!, y!) <= 3 * Math.min(x!, y!))
  return [Math.max(a!, b!), Math.min(a!, b!)] as [number, number]
}
const square = (sizes: number[]) => (r: Rng) => {
  const s = pick(r, sizes)
  return [s, s] as [number, number]
}

/**
 * q3's pictures. Depths of 2 to 8 bits: never 1, where W × H alone (the depth forgotten) is the
 * answer, which q9 asks on its own. Sizes keep the product by hand, about the written 20 × 10 × 4.
 */
const BIT_PICTURES: Picture[] = [
  {
    name: 'image',
    size: landscape([8, 10, 12, 16, 20, 24, 25, 30, 32, 40, 50]),
    depths: [2, 3, 4, 8],
    prompts: [
      (w, h, d) => `An image is ${w} pixels wide and ${h} pixels high with a colour depth of ${d} bits. What is its file size in bits?`,
      (w, h, d) => `A bitmap image is ${w} pixels wide and ${h} pixels high. Its colour depth is ${d} bits. How many bits are needed to store it?`,
    ],
  },
  {
    name: 'icon',
    size: square([16, 24, 32, 48]),
    depths: [2, 4, 8],
    prompts: [(w, h, d) => `An icon is ${w} pixels wide and ${h} pixels high with a colour depth of ${d} bits. What is its file size in bits?`],
  },
  {
    name: 'sprite',
    size: (r) => (r() < 0.5 ? square([8, 12, 16, 24, 32])(r) : landscape([8, 12, 16, 24, 32])(r)),
    depths: [2, 3, 4],
    prompts: [(w, h, d) => `A sprite for a computer game is ${w} pixels wide and ${h} pixels high, with a colour depth of ${d} bits. What is its file size in bits?`],
  },
  {
    name: 'logo',
    size: landscape([10, 15, 20, 30, 40, 60]),
    depths: [3, 4, 8],
    prompts: [(w, h, d) => `A logo for a website is ${w} pixels wide and ${h} pixels high, with a colour depth of ${d} bits. How many bits does it take to store?`],
  },
]

/** q3: W × H × D bits. Written: 20 × 10 × 4 = 800. */
const imageBits = csBySlot('media-image-bits', TOPIC, {
  q3(r, slot) {
    const p = weighted(r, [[BIT_PICTURES[0]!, 4], [BIT_PICTURES[1]!, 2], [BIT_PICTURES[2]!, 2], [BIT_PICTURES[3]!, 1]] as const)
    // No depth equal to a side: an 8 × 8 icon at 8 bits prints one figure three times.
    const [w, h, d] = draw(
      r,
      (rr) => [...p.size(rr), pick(rr, p.depths)] as const,
      ([x, y, z]) => x !== z && y !== z,
    )
    const answer = w * h * d
    return numericDraft(
      slot,
      {
        prompt: pick(r, p.prompts)(w, h, d),
        solution: `Size in bits $= W \\times H \\times D = ${w} \\times ${h} \\times ${d} = $ **${count(answer)}** bits: ${count(w * h)} pixels at ${d} bits each.`,
        method: [`${w} × ${h} × ${d}`],
        answer,
      },
      // Second route: the pixels, then the bits for each.
      { agrees: Array.from({ length: h }, () => w * d).reduce((a, x) => a + x, 0) === answer, detail: `${h} rows of ${w * d} bits` },
      { picture: p.name, width: w, height: h, depth: d },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// Colours from a colour depth: q4
// ---------------------------------------------------------------------------------------------

/**
 * Depths for q4, never 1, 2 or 4: at 1 and 2 bits doubling the depth (2D) gives 2^D, at 2 and 4 bits
 * squaring it does (D² = 2^D). That leaves eight depths, from 3 bits (8 colours, as written) to 24 (a
 * photo), so the slot has eight answers.
 */
/**
 * q4's depths. Every power of two here can be doubled out by hand for one mark on a
 * non-calculator paper: 16 and 24 bits (65 536 and 16 777 216 colours) went, at 28% of builds,
 * with the 24-bit camera photo. 1, 2 and 4 bits are out because 2D or D² is 2^D there, and 9
 * bits is no depth anything uses.
 */
const COLOUR_DEPTHS = [3, 5, 6, 7, 8, 10, 12]

interface ColourAsk {
  name: string
  /** The depths this way of asking fits. */
  depths: number[]
  weight: number
  ask: (r: Rng, d: number) => { prompt: string; w?: number; h?: number }
}

/**
 * The ways q4 is asked. The depth is drawn first, evenly, and then a way that fits it, so no one
 * calculation fills the slot. The bare question, as written; an image with its size beside its
 * depth, where a student who multiplies the size in is wrong; a display at the depths displays
 * use (8 and 12 bits); and an old computer's palette, set by 3 or 6 bits, asked as a palette and
 * not as a depth.
 */
const COLOUR_ASKS: ColourAsk[] = [
  {
    name: 'bare',
    depths: COLOUR_DEPTHS,
    weight: 3,
    ask: (r, d) => ({
      prompt: pick(r, [
        `How many colours can be represented with a colour depth of ${d} bits?`,
        `An image has a colour depth of ${d} bits. How many different colours can it use?`,
      ]),
    }),
  },
  {
    name: 'sized',
    depths: COLOUR_DEPTHS,
    weight: 3,
    ask: (r, d) => {
      // No side equal to the number of colours: a 64-pixel side at 6 bits would read off.
      const [w, h] = draw(r, landscape([16, 20, 24, 30, 32, 40, 48, 50, 60, 64, 80, 100, 120, 200]), ([x, y]) => x !== 2 ** d && y !== 2 ** d)
      // An image of fewer pixels than colours cannot use them all, so it is asked per pixel.
      const asks = [`An image is ${w} pixels wide and ${h} pixels high, with a colour depth of ${d} bits. How many different colours can each pixel be?`]
      if (w * h >= 2 ** d) asks.push(`A bitmap is ${w} pixels wide and ${h} pixels high and uses ${d} bits for each pixel. How many different colours can the image use?`)
      return { w, h, prompt: pick(r, asks) }
    },
  },
  {
    name: 'display',
    depths: [8, 12],
    weight: 1,
    ask: (r, d) => ({
      prompt: pick(r, [
        `A display shows each pixel with a colour depth of ${d} bits. How many different colours can a pixel show?`,
        `A graphics card sends each pixel to the screen with a colour depth of ${d} bits. How many different colours are possible?`,
      ]),
    }),
  },
  {
    name: 'palette',
    depths: [3, 6],
    weight: 1,
    ask: (r, d) => ({
      prompt: pick(r, [
        `An old games console can choose each colour from a palette set by ${d} bits. How many colours are in the palette?`,
        `An old home computer gives each colour in its palette ${an(`${d}-bit`)} ${d}-bit code. How many colours are in the palette?`,
      ]),
    }),
  },
]

/** q4: 2^D colours, 1 mark. Written: 2^3 = 8. */
const colours = csBySlot('media-colours-from-depth', TOPIC, {
  q4(r, slot) {
    const d = pick(r, COLOUR_DEPTHS)
    const way = weighted(r, COLOUR_ASKS.filter((a) => a.depths.includes(d)).map((a) => [a, a.weight] as const))
    const c = { name: way.name, d, ...way.ask(r, d) }
    const answer = 2 ** c.d
    // Second route: count the patterns of d bits by doubling once for each bit added.
    let patterns = 1
    for (let i = 0; i < c.d; i++) patterns *= 2
    const size = c.w ? ` The image's size does not come into it: each of its ${count(c.w * c.h!)} pixels can be any one of the ${count(answer)} colours.` : ''
    return numericDraft(
      slot,
      {
        prompt: c.prompt,
        solution: `$2^{${c.d}} = ${texCount(answer)}$, so **${count(answer)}** colours. The depth is ${c.d} **bits**; the colours are what those bits can distinguish.${size}`,
        method: [],
        answer,
      },
      { agrees: patterns === answer, detail: `${c.d} doublings from 1 make ${patterns}` },
      { context: c.name, depth: c.d, ...(c.w ? { width: c.w, height: c.h! } : {}) },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// Image file size in bytes: q6
// ---------------------------------------------------------------------------------------------

/** Every landscape pair from a list of sides, the wider first, no more than 3 times as wide as high. */
const landscapePairs = (sides: number[]) => sides.flatMap((w) => sides.filter((h) => h < w && w <= 3 * h).map((h) => [w, h] as [number, number]))
const squarePairs = (sides: number[]) => sides.map((s) => [s, s] as [number, number])

interface BytePicture {
  name: string
  pairs: [number, number][]
  depths: number[]
  prompts: ((w: number, h: number, d: number) => string)[]
}

/**
 * q6's pictures. Depths never 8, where W × H (a byte a pixel, depth and ÷ 8 both forgotten) is the
 * answer, and never 1, where W × H ÷ 8 (the depth forgotten) is. Each picture's sizes are its own,
 * and only those whose bits fit the cap are drawn.
 */
const BYTE_PICTURES: BytePicture[] = [
  {
    name: 'image',
    pairs: landscapePairs([40, 50, 60, 64, 80, 100, 120, 128, 150, 160, 200, 240, 250, 300, 320, 400]),
    depths: [2, 3, 4, 6, 16, 24],
    prompts: [
      (w, h, d) => `An image is ${w} pixels wide and ${h} pixels high with a colour depth of ${d} bits. What is its file size in bytes?`,
      (w, h, d) => `A bitmap image is ${w} pixels wide and ${h} pixels high, and its colour depth is ${d} bits. Calculate its file size in bytes.`,
    ],
  },
  {
    name: 'icon',
    pairs: squarePairs([16, 24, 32, 48, 64]),
    depths: [4, 16, 24],
    prompts: [(w, h, d) => `An app icon is ${w} pixels wide and ${h} pixels high with a colour depth of ${d} bits. What is its file size in bytes?`],
  },
  {
    name: 'thumbnail',
    pairs: [[96, 96], [100, 75], [120, 90], [128, 96], [150, 100], [160, 120], [120, 80]],
    depths: [16, 24],
    prompts: [(w, h, d) => `A thumbnail of a photo is ${w} pixels wide and ${h} pixels high, with a colour depth of ${d} bits. What is its file size in bytes?`],
  },
  {
    name: 'sprite',
    pairs: [...squarePairs([16, 24, 32, 48, 64]), ...landscapePairs([16, 24, 32, 48, 64])],
    depths: [2, 3, 4, 6],
    prompts: [(w, h, d) => `A sprite for a computer game is ${w} pixels wide and ${h} pixels high, with a colour depth of ${d} bits. What is its file size in bytes?`],
  },
]

/** The sizes of a picture that fit at depth d: a whole number of bytes under the cap, no figure printed twice. */
const bytePairs = (p: BytePicture, d: number) =>
  p.pairs.filter(([w, h]) => (w * h * d) % 8 === 0 && w * h * d <= CAPS.q6 && w !== d && h !== d && (w * h * d) / 8 !== w && (w * h * d) / 8 !== h)

/** q6: W × H × D ÷ 8 bytes, 3 marks. Written: 100 × 50 × 4 = 20 000 bits, 2500 bytes. */
const imageBytes = csBySlot('media-image-bytes', TOPIC, {
  q6(r, slot) {
    const p = weighted(r, [[BYTE_PICTURES[0]!, 4], [BYTE_PICTURES[1]!, 2], [BYTE_PICTURES[2]!, 2], [BYTE_PICTURES[3]!, 2]] as const)
    const d = pick(r, p.depths.filter((x) => bytePairs(p, x).length > 0))
    const [w, h] = pick(r, bytePairs(p, d))
    const bits = w * h * d
    const answer = bits / 8
    return numericDraft(
      slot,
      {
        prompt: pick(r, p.prompts)(w, h, d),
        solution: `$${w} \\times ${h} \\times ${d} = ${texCount(bits)}$ bits, and $${texCount(bits)} \\div 8 = $ **${count(answer)}** bytes. The formula gives bits, so the divide by 8 is essential.`,
        method: [`${w} × ${h} × ${d}`, 'divides by 8'],
        answer,
      },
      // Second route: bytes for one row of pixels, times the rows.
      { agrees: ((w * d) / 8) * h === answer, detail: `${(w * d) / 8} bytes a row × ${h} rows` },
      { picture: p.name, width: w, height: h, depth: d },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// Bits in a black and white bitmap: q9
// ---------------------------------------------------------------------------------------------

/** q9's bitmaps, all 1 bit a pixel. Never 3 × 3: q19 and q20 on the same sheet draw 3 × 3 bitmaps. */
type Bitmap = { name: string; size: (r: Rng) => [number, number]; prompts: ((w: number, h: number) => string)[] }
const BITMAPS: [Bitmap, number][] = [
  [
    {
      name: 'bitmap',
      size: (r) => [int(r, 4, 16), int(r, 4, 16)],
      prompts: [
        (w, h) => `A black and white bitmap is ${w} pixels wide and ${h} pixels high with a colour depth of 1 bit. How many bits are needed to store it?`,
        (w, h) => `A black and white image is ${w} pixels wide and ${h} pixels high. Each pixel is stored as 1 bit: 1 for black and 0 for white. How many bits does the image need?`,
      ],
    },
    5,
  ],
  [
    {
      name: 'LED letter',
      size: (r) => pick(r, [[5, 7], [5, 8], [6, 8], [7, 9], [6, 10], [8, 12], [8, 16], [7, 10]] as [number, number][]),
      prompts: [(w, h) => `A letter on a scrolling LED sign is a black and white bitmap ${w} pixels wide and ${h} pixels high, with a colour depth of 1 bit. How many bits are needed to store the letter?`],
    },
    2,
  ],
  [
    {
      name: 'QR code',
      size: (r) => square([21, 25, 29, 33])(r),
      prompts: [(w, h) => `A QR code is a grid of ${w} by ${h} black and white squares. It is stored as a bitmap with one pixel for each square and a colour depth of 1 bit. How many bits are needed to store it?`],
    },
    1.5,
  ],
  [
    {
      name: 'fitness tracker',
      size: (r) => pick(r, [[128, 64], [128, 32], [72, 40], [64, 48], [64, 32]] as [number, number][]),
      prompts: [(w, h) => `A fitness tracker has a small black and white screen ${w} pixels wide and ${h} pixels high. Each image on it is a bitmap with a colour depth of 1 bit. How many bits does one full-screen image take?`],
    },
    1.5,
  ],
]

/** q9: W × H × 1 bits. Written: 8 × 8 × 1 = 64. */
const bitmapBits = csBySlot('media-bitmap-bits', TOPIC, {
  q9(r, slot) {
    const b = weighted(r, BITMAPS)
    const [w, h] = b.size(r)
    const answer = w * h
    return numericDraft(
      slot,
      {
        prompt: pick(r, b.prompts)(w, h),
        solution: `$${w} \\times ${h} \\times 1 = $ **${count(answer)}** bits: one bit for each of the ${count(answer)} pixels.`,
        method: [`${w} × ${h} × 1`],
        answer,
      },
      // Second route: count the bits row by row, a bit a pixel.
      { agrees: Array.from({ length: h }, () => w).reduce((s, x) => s + x, 0) === answer, detail: `${h} rows of ${w} bits` },
      { bitmap: b.name, width: w, height: h },
    )
  },
})

// ---------------------------------------------------------------------------------------------
// Sound file size: q5 (bits), q13 (kilobytes)
// ---------------------------------------------------------------------------------------------

interface Sound {
  name: string
  rates: number[]
  resolutions: number[]
  seconds: [number, number]
  prompts: ((rate: number, res: number, secs: number, unit: string) => string)[]
}

const hz = (rate: number) => `${count(rate)} Hz`
const resolution = (res: number) => `${an(`${res}-bit`)} ${res}-bit`

/**
 * Recordings, each with the rates, resolutions and lengths it really has: a voice note at telephone
 * and speech rates, a short game sound, a doorbell chime, a jingle at 32 000 or 48 000 Hz. The
 * high-rate recordings are short (2 to 8 seconds). Rates are whole thousands so rate × res × secs
 * goes by hand, as the written 4000 × 8 × 5 does.
 */
const SOUNDS: Sound[] = [
  {
    name: 'sound',
    rates: [4000, 5000, 8000, 10000, 16000, 20000, 24000],
    resolutions: [8, 16, 24],
    seconds: [2, 20],
    prompts: [
      (rate, res, secs, unit) => `A sound is sampled at ${hz(rate)} with a sample resolution of ${res} bits for ${secs} seconds. What is the file size in ${unit}?`,
      (rate, res, secs, unit) => `A sound lasting ${secs} seconds is sampled ${count(rate)} times a second, with a sample resolution of ${res} bits. What is the file size in ${unit}?`,
    ],
  },
  {
    name: 'voice note',
    rates: [8000, 16000],
    resolutions: [8, 16],
    seconds: [5, 60],
    prompts: [(rate, res, secs, unit) => `A voice note lasts ${secs} seconds. It is sampled at ${hz(rate)} with ${resolution(res)} sample resolution. What is its file size in ${unit}?`],
  },
  {
    name: 'game sound',
    rates: [16000, 24000, 32000, 48000],
    resolutions: [16, 24],
    seconds: [2, 6],
    prompts: [(rate, res, secs, unit) => `A sound effect for a computer game lasts ${secs} seconds. It is sampled at ${hz(rate)} with a sample resolution of ${res} bits. What is its file size in ${unit}?`],
  },
  {
    name: 'doorbell',
    rates: [8000, 10000, 16000],
    resolutions: [8, 16],
    seconds: [2, 10],
    prompts: [(rate, res, secs, unit) => `A doorbell stores ${an(String(secs))} ${secs}-second chime, sampled at ${hz(rate)} with ${resolution(res)} sample resolution. What is the file size of the chime in ${unit}?`],
  },
  {
    name: 'jingle',
    rates: [32000, 48000],
    resolutions: [16, 24],
    seconds: [2, 8],
    prompts: [(rate, res, secs, unit) => `A jingle for a phone app lasts ${secs} seconds. It is sampled at ${hz(rate)} with a sample resolution of ${res} bits. What is its file size in ${unit}?`],
  },
]
const SOUND_WEIGHT = [3, 2, 1.5, 1.5, 2]

/**
 * The lengths a recording can have at a rate and resolution: its own range, cut to those whose bits
 * lie from `least` to the slot's cap, and never equal to the resolution (8 seconds at 8 bits prints
 * one figure for two jobs).
 */
function lengths(s: Sound, rate: number, res: number, least: number, cap: number): number[] {
  const lo = Math.max(s.seconds[0], Math.ceil(least / (rate * res)))
  const hi = Math.min(s.seconds[1], Math.floor(cap / (rate * res)))
  return Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i).filter((n) => n !== res)
}

/**
 * A recording for a slot: the resolution first, evenly from those the slot allows (16 bits is in
 * every context, so drawing the context first made it half the slot), then a context that records
 * at it, a rate it uses, and a length from those that fit the cap, drawn from the fitting range.
 */
function drawSound(r: Rng, resolutions: number[], least: number, cap: number) {
  const res = pick(r, resolutions)
  const rates = (x: Sound) => x.rates.filter((rate) => lengths(x, rate, res, least, cap).length > 0)
  const s = weighted(
    r,
    SOUNDS.flatMap((x, i) => (x.resolutions.includes(res) && rates(x).length > 0 ? [[x, SOUND_WEIGHT[i]!] as const] : [])),
  )
  const rate = pick(r, rates(s))
  const secs = pick(r, lengths(s, rate, res, least, cap))
  return { s, rate, res, secs }
}

/** q5: rate × res × secs bits. Written: 4000 × 8 × 5 = 160 000. */
const soundBits = csBySlot('media-sound-bits', TOPIC, {
  q5(r, slot) {
    const { s, rate, res, secs } = drawSound(r, [8, 16, 24], 0, CAPS.q5)
    const answer = rate * res * secs
    return numericDraft(
      slot,
      {
        prompt: pick(r, s.prompts)(rate, res, secs, 'bits'),
        solution: `Rate × res × secs $= ${texCount(rate)} \\times ${res} \\times ${secs} = $ **${count(answer)}** bits: ${count(rate * secs)} samples of ${res} bits each.`,
        method: [`${count(rate)} × ${res} × ${secs}`],
        answer,
      },
      // Second route: the samples taken, then the bits for each.
      { agrees: rate * secs * res === answer && answer / res / secs === rate, detail: `${rate * secs} samples × ${res} bits` },
      { sound: s.name, rate, resolution: res, seconds: secs },
    )
  },
})

/**
 * q13: rate × res × secs ÷ 8 ÷ 1000 kilobytes, 3 marks. Written: 8000 × 16 × 10 = 1 280 000 bits,
 * 160 000 bytes, 160 kB. Resolutions of 16 and 24 bits only: at 8 bits the resolution and the ÷ 8
 * cancel, so a student who forgets both scores. Rates in whole thousands make the kilobytes whole.
 */
const soundKilobytes = csBySlot('media-sound-kilobytes', TOPIC, {
  q13(r, slot) {
    // At least 50 kB (400 000 bits), so 1024 for 1000 is wrong by more than a rounding.
    const { s, rate, res, secs } = drawSound(r, [16, 24], 400_000, CAPS.q13)
    const bits = rate * res * secs
    const bytes = bits / 8
    const answer = bytes / 1000
    return numericDraft(
      slot,
      {
        prompt: pick(r, s.prompts)(rate, res, secs, 'kilobytes'),
        solution: `$${texCount(rate)} \\times ${res} \\times ${secs} = ${texCount(bits)}$ bits. Divide by 8: $${texCount(bytes)}$ bytes. Divide by 1000: **${count(answer)}** kB. Both divisions are needed, and the second uses 1 kB = 1000 bytes.`,
        method: [`${count(rate)} × ${res} × ${secs} = ${count(bits)} bits`, 'divides by 8 and by 1000'],
        answer,
      },
      // Second route: bytes a sample, samples a second, then the seconds, in kilobytes.
      { agrees: (((res / 8) * rate) / 1000) * secs === answer && Number.isInteger(answer), detail: `${res / 8} bytes × ${rate} a second = ${(res / 8) * rate} bytes a second, × ${secs} s` },
      { sound: s.name, rate, resolution: res, seconds: secs },
    )
  },
})

export const mediaGenerators: Generator[] = [imageBits, colours, soundBits, imageBytes, bitmapBits, soundKilobytes]

/** For the tests: each slot's contexts and their ranges. */
export const MEDIA = { BIT_PICTURES, BYTE_PICTURES, COLOUR_DEPTHS, SOUNDS }
