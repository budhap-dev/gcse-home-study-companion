import type { Question } from '../../content/questions.ts'
import { pick, type Rng } from '../random.ts'
import type { Draft, Generator } from '../types.ts'
import { an, bin, count, csBySlot, hex, numericDraft, texCount } from './build.ts'

/**
 * Computer Science (AQA 8525) generators: storage-units-and-binary.
 *
 * - 3.3.2 converting between number bases, binary to decimal (q3) and hexadecimal to decimal
 *   (q7), for values in the specification's range 0 to 255 (FF, 1111 1111).
 * - 3.3.3 units of information, "compare quantities of bytes using the prefixes": how many files
 *   fit on a memory card or USB stick given in GB (q8), on a drive given in GB (q14) and on a
 *   drive given in TB, two prefix steps from MB (q21). The prefixes are the decimal ones the
 *   specification lists (1 kB = 1000 bytes up to 1 TB = 1000 GB), never 1024.
 *
 * q1 (bits in a byte) and q4 (bytes in a kilobyte) are facts to recall and stay written.
 *
 * Every answer is drawn from a list of the values that work, so none is filtered out of a skewed
 * draw. The sheets print other questions these must not answer: the higher sheet converts 156 to
 * binary (q5), 11011010 (DA, 218) to hex (q6), 200 to hex (q19), 3F (63) to binary (q20) and asks
 * the largest 8-bit number (q9, 255); the advanced sheet converts 1011010 (5A, 90) and asks how a
 * 64 GB phone holds 5 MB photos and 4 MB songs (q18). No conversion here is any of those values,
 * and no drive holds 5 MB photos or 4 MB songs.
 */
const TOPIC = 'storage-units-and-binary'

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)
const PLACES = [128, 64, 32, 16, 8, 4, 2, 1]
/** Values the higher and advanced sheets print or ask: 156, 218 (DA), 200, 63 (3F), 255, 90 (5A). */
const SHEET_VALUES = new Set([156, 218, 200, 63, 255, 90])
/** "32, 8, 4 and 1". */
const list = (xs: (string | number)[]) => (xs.length === 1 ? String(xs[0]) : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)

// ---------------------------------------------------------------------------------------------
// q3: binary to decimal
// ---------------------------------------------------------------------------------------------

const reverse8 = (n: number) => parseInt(bin(n).split('').reverse().join(''), 2)
const ones = (n: number) => bin(n).split('').filter((c) => c === '1').length

/**
 * The 8-bit numbers q3 converts: three to six 1s, as the written 00101101 has four; never one
 * that reads the same backwards (reading the bits right to left would pay), never one whose
 * decimal digits are all 0s and 1s (101 would look like binary), and none the other sheets use.
 */
export const BINARY_VALUES = Array.from({ length: 256 }, (_, n) => n).filter(
  (n) => ones(n) >= 3 && ones(n) <= 6 && reverse8(n) !== n && !/^[01]+$/.test(String(n)) && !SHEET_VALUES.has(n),
)

const BINARY_PROMPTS = [
  (b: string) => `Convert the binary number ${b} to decimal.`,
  (b: string) => `What is the binary number ${b} in decimal?`,
  (b: string) => `Write the 8-bit binary number ${b} as a decimal number.`,
]

/** q3: 2 marks. Written: 00101101 = 32 + 8 + 4 + 1 = 45. */
function binaryToDecimal(r: Rng, slot: Question): Draft {
  const n = pick(r, BINARY_VALUES)
  const b = bin(n)
  const under = PLACES.filter((_, i) => b[i] === '1')
  const sum = under.join(' + ')
  // Second route: read the bits left to right, doubling the running total and adding each bit.
  let horner = 0
  for (const c of b) horner = horner * 2 + (c === '1' ? 1 : 0)
  return numericDraft(
    slot,
    {
      prompt: pick(r, BINARY_PROMPTS)(b),
      solution: `The 1s are under ${list(under)}, so $${sum} = $ **${n}**.`,
      method: [`uses the place values: ${sum}`],
      answer: n,
    },
    { agrees: horner === n && under.reduce((s, x) => s + x, 0) === n, detail: `doubling along ${b} gives ${horner}` },
    { binary: b, answer: n },
  )
}

// ---------------------------------------------------------------------------------------------
// q7: hexadecimal to decimal
// ---------------------------------------------------------------------------------------------

const DIGITS = '0123456789ABCDEF'

/**
 * The two-digit hex numbers q7 converts, as values: at least one letter digit (the skill is
 * reading B as 11), a first digit of 2 or more (1 × 16 is no multiplication), a second digit
 * that is not 0, the two digits different, and none the other sheets use.
 */
export const HEX_VALUES = Array.from({ length: 256 }, (_, v) => v).filter((v) => {
  const [a, b] = [Math.floor(v / 16), v % 16]
  return a >= 2 && b >= 1 && a !== b && (a >= 10 || b >= 10) && !SHEET_VALUES.has(v)
})

const HEX_PROMPTS = [
  (h: string) => `Convert the hexadecimal number ${h} to decimal.`,
  (h: string) => `What is the hexadecimal number ${h} in decimal?`,
  (h: string) => `Write the hexadecimal number ${h} as a decimal number.`,
]

/** q7: 2 marks. Written: B4 = 11 × 16 + 4 = 180. */
function hexToDecimal(r: Rng, slot: Question): Draft {
  const v = pick(r, HEX_VALUES)
  const h = hex(v)
  const [a, b] = [Math.floor(v / 16), v % 16]
  const [x, y] = [h[0]!, h[1]!]
  const sixteens = a * 16
  const work = `$${a} \\times 16 = ${sixteens}$, and $${sixteens} + ${b} = $ **${v}**`
  const opening =
    a >= 10
      ? `${x} is ${a}${b >= 10 ? ` and ${y} is ${b}` : ''}, so ${work}.`
      : `${y} is ${b}. The ${x} is in the sixteens column, so ${work}.`
  // Second route: each hex digit is four bits; read the eight bits by their place values.
  const nibbles = [x, y].map((c) => DIGITS.indexOf(c).toString(2).padStart(4, '0'))
  const bits = nibbles.join('')
  const under = PLACES.filter((_, i) => bits[i] === '1')
  const viaBinary = under.reduce((s, p) => s + p, 0)
  return numericDraft(
    slot,
    {
      prompt: pick(r, HEX_PROMPTS)(h),
      solution: `${opening} Or in binary: \`${nibbles.join(' ')}\` = $${under.join(' + ')} = ${viaBinary}$ ✓`,
      method: [a >= 10 ? `${x} = ${a}, so ${a} × 16` : `${a} × 16, with ${y} = ${b}`],
      answer: v,
    },
    { agrees: viaBinary === v, detail: `${h} as ${nibbles.join(' ')} is ${viaBinary}` },
    { hex: h, answer: v },
  )
}

// ---------------------------------------------------------------------------------------------
// q8, q14, q21: how many files fit
// ---------------------------------------------------------------------------------------------

export interface Item {
  key: string
  /** As the prompt names them: "video files", "songs". */
  noun: string
  /** As the question counts them: "files", "songs". */
  counted: string
  /** Sizes this kind of file has, in MB. */
  sizes: number[]
}

const range = (lo: number, hi: number, step = 1) => Array.from({ length: Math.floor((hi - lo) / step) + 1 }, (_, i) => lo + i * step)

/** On a memory card or USB stick (q8): songs 3–10 MB, photos 2–12 MB, e-books 1–5 MB (never 1, which makes the answer the converted capacity). */
export const CARD_ITEMS: Item[] = [
  { key: 'song', noun: 'songs', counted: 'songs', sizes: range(3, 10) },
  { key: 'photo', noun: 'photos', counted: 'photos', sizes: range(2, 12) },
  { key: 'e-book', noun: 'e-books', counted: 'e-books', sizes: range(2, 5) },
]
/**
 * On a drive (q14, q21): video files 100 MB to 4 GB (below 1000 MB only sizes that divide 1000, so
 * 960 000 ÷ 625 never needs working by hand; whole 100 MB above), photos and songs. A sheet's two
 * drive slots take different kinds by turn. No 5 MB photos or 4 MB songs: the advanced sheet's q18
 * prints those.
 */
export const DRIVE_ITEMS: Item[] = [
  { key: 'video', noun: 'video files', counted: 'files', sizes: [100, 125, 200, 250, 400, 500, 800, ...range(1000, 4000, 100)] },
  { key: 'photo', noun: 'photos', counted: 'photos', sizes: range(2, 12).filter((s) => s !== 5) },
  { key: 'song', noun: 'songs', counted: 'songs', sizes: range(3, 10).filter((s) => s !== 4) },
]

export const CARD_DEVICES = ['memory card', 'USB stick']
/** Memory cards and USB sticks are sold at these sizes. */
export const CARD_GB = [8, 16, 32, 64, 128, 256, 512]
/** Drives given in GB (q14). */
export const DRIVE_GB = [250, 256, 320, 480, 500, 512, 640, 750, 960]
/** Drives given in TB (q21); never 1 TB, which makes the conversion a copy. */
export const DRIVE_TB = [2, 3, 4, 5, 6, 8]

export interface Fit {
  capacity: number
  size: number
  answer: number
}

/**
 * The printed given that `first` names (the capacity, or the file size) evenly over those with a
 * fit, then the answer evenly within it, then the fit that gives it. Drawing the answer alone left
 * the givens skewed: 750 GB drives (which 3, 6 and 12 MB divide) in a fifth of builds.
 */
export function drawFit(r: Rng, all: Fit[], first: 'capacity' | 'size'): Fit {
  const given = pick(r, [...new Set(all.map((f) => f[first]))])
  const some = all.filter((f) => f[first] === given)
  const answer = pick(r, [...new Set(some.map((f) => f.answer))])
  return pick(r, some.filter((f) => f.answer === answer))
}

/**
 * Every capacity and size of a kind that fills the drive with a whole number of files, the
 * capacity in `perMB` MB to the unit. Never an answer equal to a figure the question prints or
 * the solution works (the capacity, the size, the capacity in GB or MB: 1000 MB files on a 500 GB
 * drive would make the answer the capacity), and never the size equal to the capacity or to the
 * capacity one prefix down.
 */
export function fits(capacities: number[], item: Item, perMB: number): Fit[] {
  const out: Fit[] = []
  for (const capacity of capacities) {
    for (const size of item.sizes) {
      const mb = capacity * perMB
      // The size is never the capacity, nor the capacity a prefix down (3000 MB files on a 3 TB drive print 3000 twice).
      if (mb % size !== 0 || capacity === size || capacity * 1000 === size) continue
      const answer = mb / size
      if ([capacity, size, capacity * 1000, mb].includes(answer)) continue
      out.push({ capacity, size, answer })
    }
  }
  return out
}

const PROMPTS_8 = [
  (d: string, C: number, s: number, it: Item) => `A ${d} holds ${C} GB. How many ${s} MB ${it.noun} will fit on it?`,
  (d: string, C: number, s: number, it: Item) => `How many ${it.noun} of ${s} MB each can be stored on ${an(String(C))} ${C} GB ${d}?`,
  (d: string, C: number, s: number, it: Item) => `${cap(an(String(C)))} ${C} GB ${d} is empty. How many ${s} MB ${it.noun} can it hold?`,
]
const PROMPTS_14 = [
  (C: number, s: number, it: Item) => `${cap(an(String(C)))} ${C} GB drive is full of ${s} MB ${it.noun}. How many ${it.counted} does it hold?`,
  (C: number, s: number, it: Item) => `A drive holds ${C} GB. It is filled with ${it.noun} of ${s} MB each. How many ${it.counted} fit on it?`,
  (C: number, s: number, it: Item) => `How many ${s} MB ${it.noun} will fill ${an(String(C))} ${C} GB drive?`,
]
const PROMPTS_21 = [
  (C: number, s: number, it: Item) => `${cap(an(String(C)))} ${C} TB drive is filled with ${it.noun} of ${s} MB each. Using the decimal prefixes in the specification, how many ${it.counted} does it hold?`,
  (C: number, s: number, it: Item) => `A backup drive holds ${C} TB. Using the decimal prefixes in the specification, how many ${s} MB ${it.noun} can it store?`,
  (C: number, s: number, it: Item) => `How many ${it.noun} of ${s} MB each fit on ${an(String(C))} ${C} TB drive? Use the decimal prefixes in the specification.`,
]

/** One step: GB to MB (q8, q14). */
function gbToMb(slot: Question, prompt: string, f: Fit, it: Item, values: Draft['values']): Draft {
  const mb = f.capacity * 1000
  return numericDraft(
    slot,
    {
      prompt,
      solution: `Put both in the same unit: ${f.capacity} GB is $${f.capacity} \\times 1000 = ${texCount(mb)}$ MB. Then $${texCount(mb)} \\div ${f.size} = $ **${count(f.answer)}** ${it.counted}.`,
      method: [`converts ${f.capacity} GB to ${count(mb)} MB`],
      answer: f.answer,
    },
    // Second route: that many files, each its size, fill the capacity written out with its three zeros.
    { agrees: f.answer * f.size === Number(`${f.capacity}000`), detail: `${f.answer} × ${f.size} MB = ${f.answer * f.size} MB` },
    values,
  )
}

/** q8: 2 marks, a memory card or USB stick in GB. Written: 8 GB of 4 MB songs, 2000. */
function cardFiles(r: Rng, slot: Question): Draft {
  const it = pick(r, CARD_ITEMS)
  const d = pick(r, CARD_DEVICES)
  const f = drawFit(r, fits(CARD_GB, it, 1000), 'size')
  return gbToMb(slot, pick(r, PROMPTS_8)(d, f.capacity, f.size, it), f, it, { device: d, item: it.key, capacityGB: f.capacity, sizeMB: f.size, answer: f.answer })
}

/** q14: 2 marks, a drive in GB. Written: 500 GB of 250 MB video files, 2000. The kind of file by turn, so q21 on the same sheet differs. */
function driveFilesGB(r: Rng, slot: Question, turn: number): Draft {
  const it = DRIVE_ITEMS[turn % DRIVE_ITEMS.length]!
  const f = drawFit(r, fits(DRIVE_GB, it, 1000), 'capacity')
  return gbToMb(slot, pick(r, PROMPTS_14)(f.capacity, f.size, it), f, it, { item: it.key, capacityGB: f.capacity, sizeMB: f.size, answer: f.answer })
}

/** q21: 2 marks, a drive in TB, two prefix steps from MB. Written: 2 TB of 500 MB video files, 4000. */
function driveFilesTB(r: Rng, slot: Question, turn: number): Draft {
  const it = DRIVE_ITEMS[turn % DRIVE_ITEMS.length]!
  const f = drawFit(r, fits(DRIVE_TB, it, 1_000_000), 'capacity')
  const gb = f.capacity * 1000
  const mb = gb * 1000
  return numericDraft(
    slot,
    {
      prompt: pick(r, PROMPTS_21)(f.capacity, f.size, it),
      solution:
        `TB and MB are two prefixes apart, so convert one step at a time: ${f.capacity} TB is $${f.capacity} \\times 1000 = ${texCount(gb)}$ GB, ` +
        `and ${count(gb)} GB is $${texCount(gb)} \\times 1000 = ${texCount(mb)}$ MB. Then $${texCount(mb)} \\div ${f.size} = $ **${count(f.answer)}** ${it.counted}. ` +
        `Converting only one step, to ${count(gb)} GB, and dividing that by ${f.size} would give an answer a thousand times too small.`,
      method: [`converts ${f.capacity} TB to ${count(mb)} MB`],
      answer: f.answer,
    },
    { agrees: f.answer * f.size === Number(`${f.capacity}000000`), detail: `${f.answer} × ${f.size} MB = ${f.answer * f.size} MB` },
    { item: it.key, capacityTB: f.capacity, sizeMB: f.size, answer: f.answer },
  )
}

export const storageGenerators: Generator[] = [
  csBySlot('cs-binary-to-decimal', TOPIC, { q3: binaryToDecimal }),
  csBySlot('cs-hex-to-decimal', TOPIC, { q7: hexToDecimal }),
  csBySlot('cs-files-that-fit', TOPIC, { q8: cardFiles, q14: driveFilesGB, q21: driveFilesTB }),
]
