import type { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { int, pick, type Rng } from '../random.ts'
import type { Draft, Generator } from '../types.ts'
import { an, count, csBySlot, numericDraft, texCount } from './build.ts'

/**
 * Computer Science (AQA 8525) generators for 3.4.5 systems architecture.
 *
 * - the-cpu-and-memory q5: cycles per second from a clock speed. The specification lists clock
 *   speed among what affects CPU performance; the GHz and MHz figures and "giga means a thousand
 *   million" are the written question's. To reach a hundred distinct prompts the clock speed
 *   varies (1.1 to 5.0 GHz in tenths, or 400 to 900 MHz for an older or embedded processor) and so
 *   does the device, each within the speeds it really runs at.
 * - secondary-storage q6: the time to copy a file at a transfer rate, with 1 GB = 1000 MB (the
 *   decimal prefixes of 3.3.3). Real rates for each device: a USB stick 20–400 MB/s, a hard disk
 *   80–250 MB/s, an SSD 200–3500 MB/s.
 *
 * Neither sheet prints another figure these could answer: the CPU sheets' other questions and
 * the secondary storage sheets' are all multiple choice or short text without numbers.
 */

// ---------------------------------------------------------------------------------------------
// the-cpu-and-memory q5: clock speed
// ---------------------------------------------------------------------------------------------

export interface Clock {
  /** Starts a sentence: "A laptop's processor". */
  who: string
  unit: 'GHz' | 'MHz'
  /** In tenths of a GHz, or in MHz. */
  speed: [number, number]
  /** MHz in steps of this many. */
  step?: number
}

/**
 * Processors and the clock speeds they run at. Never 1.0 GHz, where the M1 line (1 GHz is
 * 1 000 000 000) is the answer.
 */
export const CLOCKS: Clock[] = [
  { who: 'A processor', unit: 'GHz', speed: [11, 50] },
  { who: "A laptop's processor", unit: 'GHz', speed: [12, 50] },
  { who: "A desktop computer's CPU", unit: 'GHz', speed: [25, 50] },
  { who: "A smartphone's processor", unit: 'GHz', speed: [15, 35] },
  { who: "A tablet's processor", unit: 'GHz', speed: [15, 35] },
  { who: "A games console's processor", unit: 'GHz', speed: [16, 38] },
  { who: 'The processor in a home router', unit: 'MHz', speed: [400, 900], step: 10 },
  { who: 'The processor in a digital camera', unit: 'MHz', speed: [400, 900], step: 10 },
  { who: "An older phone's processor", unit: 'MHz', speed: [400, 900], step: 10 },
  { who: 'The processor in a smart speaker', unit: 'MHz', speed: [400, 900], step: 10 },
]

const CLOCK_PROMPTS = [
  (who: string, s: string) => `${who} has a clock speed of ${s}. How many cycles does it complete per second? Give your answer in full.`,
  (who: string, s: string) => `${who} runs at a clock speed of ${s}. How many clock cycles is that each second? Give your answer in full.`,
  (who: string, s: string) => `${who} has a clock speed of ${s}. Write out in full the number of cycles it completes each second.`,
]

/** Move the decimal point `k` places right by writing digits: "2.4" and 9 give "2400000000". A second route that does no multiplying. */
function shiftPoint(s: string, k: number): number {
  const [whole, frac = ''] = s.split('.')
  return Number(whole + frac.padEnd(k, '0'))
}

/** q5: 2 marks. Written: 3 GHz is 3 × 1 000 000 000 = 3 000 000 000 cycles a second. GHz three times in four. */
function clockCycles(r: Rng, slot: Question): Draft {
  const giga = r() < 0.75
  const c = pick(r, CLOCKS.filter((x) => x.unit === (giga ? 'GHz' : 'MHz')))
  const step = c.step ?? 1
  const raw = step * int(r, c.speed[0] / step, c.speed[1] / step)
  // Tenths of a GHz are 100 000 000 cycles; a MHz is 1 000 000.
  const answer = giga ? raw * 100_000_000 : raw * 1_000_000
  const figure = giga ? show(raw / 10) : String(raw)
  const per = giga ? 1_000_000_000 : 1_000_000
  const name = giga ? 'Giga means a thousand million' : 'Mega means a million'
  return numericDraft(
    slot,
    {
      prompt: pick(r, CLOCK_PROMPTS)(c.who, `${figure} ${c.unit}`),
      solution: `${name}, so $${figure} \\times ${texCount(per)} = $ **${count(answer)}** cycles per second.`,
      method: [`uses 1 ${c.unit} = ${count(per)}`],
      answer,
    },
    { agrees: shiftPoint(figure, giga ? 9 : 6) === answer, detail: `${figure} with the point moved ${giga ? 9 : 6} places is ${shiftPoint(figure, giga ? 9 : 6)}` },
    { device: c.who, unit: c.unit, speed: figure, answer },
  )
}

// ---------------------------------------------------------------------------------------------
// secondary-storage q6: copy time
// ---------------------------------------------------------------------------------------------

export interface Device {
  /** As the prompt names it, after "to" or "from": "a USB stick". */
  name: string
  /** Copy rates it really has, MB/s. */
  rates: number[]
}

export const DEVICES: Device[] = [
  { name: 'a drive', rates: [40, 50, 80, 100, 120, 125, 150, 160, 200, 250, 300, 400] },
  { name: 'a USB stick', rates: [20, 25, 40, 50, 80, 100, 120, 125, 150, 200, 250, 300, 400] },
  { name: 'an external hard disk', rates: [80, 100, 120, 125, 150, 160, 200, 250] },
  { name: 'an SSD', rates: [200, 250, 400, 500, 800, 1200, 1250, 1500, 2000, 2500, 3000, 3500] },
]

export interface Kind {
  /** "file", "video", "film". */
  noun: string
  /** Sizes in tenths of a GB, in steps of 0.5 GB. */
  sizes: number[]
}

const halves = (lo: number, hi: number) => Array.from({ length: (hi - lo) * 2 + 1 }, (_, i) => (lo * 2 + i) * 5)

/**
 * Videos 1–4 GB, films 1–8 GB, a file or a backup 1–8 GB, in half-gigabytes; a game 20–150 GB in
 * whole 5 GB, so a fast SSD has something that takes more than a few seconds to copy (105 GB at
 * 3500 MB/s is 30 s).
 */
export const KINDS: Kind[] = [
  { noun: 'file', sizes: halves(1, 8) },
  { noun: 'video', sizes: halves(1, 4) },
  { noun: 'film', sizes: halves(1, 8) },
  { noun: 'backup file', sizes: halves(1, 8) },
  { noun: 'game', sizes: Array.from({ length: 27 }, (_, i) => 200 + 50 * i) },
]

export interface Copy {
  /** Tenths of a GB. */
  size: number
  rate: number
  seconds: number
}

/**
 * Every size and rate of a kind and device that copies in a whole number of seconds, 21 to 400
 * (below 21 s, 1024 MB to the GB rounds to the same whole number of seconds: 11.264 is 11),
 * the answer never equal to a printed figure (the size in GB or MB, or the rate: 2.5 GB at 50 MB/s
 * takes 50 s), never the size in GB times ten with nothing else (a rate of 100 MB/s) and never the
 * size itself (1000 MB/s, so an SSD is never given that rate).
 */
const COPIES = new Map<string, Copy[]>()
export function copies(d: Device, k: Kind): Copy[] {
  const key = `${d.name}/${k.noun}`
  const known = COPIES.get(key)
  if (known) return known
  const out: Copy[] = []
  for (const size of k.sizes) {
    for (const rate of d.rates) {
      const mb = size * 100
      if (mb % rate !== 0) continue
      const seconds = mb / rate
      if (seconds < 21 || seconds > 400) continue
      if ([size / 10, mb, rate, size].includes(seconds) || rate === 100) continue
      out.push({ size, rate, seconds })
    }
  }
  COPIES.set(key, out)
  return out
}

const COPY_PROMPTS = [
  (k: string, G: string, d: string, R: number) => `${an(G) === 'an' ? 'An' : 'A'} ${G} GB ${k} is copied to ${d} at ${R} MB/s. How many seconds does it take? (1 GB = 1000 MB)`,
  (k: string, G: string, d: string, R: number) => `${d.replace(/^a/, 'A')} writes data at ${R} MB/s. How many seconds does it take to copy ${an(G)} ${G} GB ${k} to it? (1 GB = 1000 MB)`,
  (k: string, G: string, d: string, R: number) => `How many seconds does it take to copy ${an(G)} ${G} GB ${k} to ${d} that writes at ${R} MB/s? (1 GB = 1000 MB)`,
]

/**
 * q6: 2 marks. Written: 8 GB at 100 MB/s is 8000 ÷ 100 = 80 s. The device, then the printed rate
 * evenly over the device's rates that copy some kind of file in 21 to 400 s, then the copy time
 * evenly over that rate's fits of every kind, then a kind and size that give it. Picking the kind before the rate left an SSD at 200 or 250 MB/s in three builds in five
 * (only those copy a 1–8 GB file in over 20 s).
 */
function copyTime(r: Rng, slot: Question): Draft {
  const d = pick(r, DEVICES)
  const byKind = KINDS.map((k) => ({ k, all: copies(d, k) }))
  const rate = pick(r, [...new Set(byKind.flatMap((x) => x.all.map((c) => c.rate)))].sort((a, b) => a - b))
  // The copy time evenly over every kind's fits at this rate. Picking the kind first made 25 s (a
  // 1–8 GB file has only two or three times at most rates) a sixth of builds; this way games, which
  // have many times, are about half of the copies.
  const atRate = byKind.flatMap((x) => x.all.filter((c) => c.rate === rate).map((c) => ({ k: x.k, c })))
  const seconds = pick(r, [...new Set(atRate.map((x) => x.c.seconds))].sort((a, b) => a - b))
  const { k, c } = pick(r, atRate.filter((x) => x.c.seconds === seconds))
  const G = show(c.size / 10)
  const mb = c.size * 100
  return numericDraft(
    slot,
    {
      prompt: pick(r, COPY_PROMPTS)(k.noun, G, d.name, c.rate),
      solution: `$${G} \\times 1000 = ${texCount(mb)}$ MB, and $${texCount(mb)} \\div ${c.rate} = $ **${seconds}** seconds.`,
      method: [`converts to ${count(mb)} MB`],
      answer: seconds,
    },
    // Second route: the rate for that many seconds copies the whole file, written out in MB.
    { agrees: seconds * c.rate === shiftPointMB(G), detail: `${seconds} s × ${c.rate} MB/s = ${seconds * c.rate} MB` },
    { device: d.name, kind: k.noun, sizeGB: G, rateMBs: c.rate, answer: seconds },
  )
}

/** "2.5" GB as MB by moving the point three places. */
const shiftPointMB = (G: string) => shiftPoint(G, 3)

export const systemsGenerators: Generator[] = [
  csBySlot('cs-clock-cycles', 'the-cpu-and-memory', { q5: clockCycles }),
  csBySlot('cs-copy-time', 'secondary-storage', { q6: copyTime }),
]
