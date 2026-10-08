import { show } from '../format.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'
import {
  LISTS,
  andList,
  ascending,
  bySlot,
  cap,
  commas,
  medianByStriking,
  medianOf,
  ordinal,
  ordinalWord,
  places,
  quartileByPosition,
  quartilesOf,
  spread,
  total,
  words,
  type Builder,
} from './statistics.ts'

/* ------------------------------------------------------------------------------------------
 * Histograms
 * ---------------------------------------------------------------------------------------- */

const HISTOGRAMS = 'histograms'

/** What a histogram measures: its letter, the things counted and the unit. */
interface Measure {
  v: string
  things: string
  unit: string
  /** " for plant heights", or '' for a bare x. */
  of: string
  /** "Of 53 parcels, 16 weigh $30 < w \le 50$ kg." */
  some: (N: number, f: number, cls: string) => string
}

const MEASURES: Measure[] = [
  { v: 'x', things: 'values', unit: '', of: '', some: (N, f, cls) => `Of ${N} values, ${f} lie in ${cls}.` },
  { v: 't', things: 'journeys', unit: 'minutes', of: ' for journey times', some: (N, f, cls) => `Of ${N} journeys, ${f} take ${cls}.` },
  { v: 'h', things: 'plants', unit: 'cm', of: ' for plant heights', some: (N, f, cls) => `Of ${N} plants, ${f} have a height of ${cls}.` },
  { v: 'w', things: 'parcels', unit: 'kg', of: ' for parcel masses', some: (N, f, cls) => `Of ${N} parcels, ${f} weigh ${cls}.` },
  // Classes start from 0, so the thing measured must come in small sizes: javelin throws of 0 to 2 m did not.
  { v: 'd', things: 'deliveries', unit: 'km', of: ' for delivery distances', some: (N, f, cls) => `Of ${N} deliveries, ${f} cover a distance of ${cls}.` },
]

/** A class as the pack prints it: $20 < x \le 35$, then its unit. */
const cls = (m: Measure, a: number, b: number) => `$${show(a)} < ${m.v} \\le ${show(b)}$${m.unit ? ` ${m.unit}` : ''}`

/** Frequency density × width, in hundredths so 0.75 × 8 has no residue. */
const area = (fd: number, w: number) => Math.round(fd * 100) * w / 100

const FD_BAND: Record<string, 'zero' | 'offset' | 'distractor'> = { q2: 'zero', q5: 'offset', q11: 'distractor' }

/**
 * Frequency density from a class and its frequency: written as q2 ($0 < x \le 5$ holds 20; 1
 * mark), q5 ($20 < x \le 35$ holds 45; 2 marks, finds the width) and q11 (16 of 53 parcels in
 * $30 < w \le 50$; 2 marks, the 53 is a distractor and the density a decimal). The check
 * multiplies back: density × width is the frequency.
 */
const frequencyDensity: Builder = (r, slot) => {
  const band = FD_BAND[slot.id] ?? 'offset'
  const m = band === 'distractor' ? pick(r, MEASURES.slice(1)) : pick(r, MEASURES)
  const { a, w, f } = draw(
    r,
    (r) => {
      if (band === 'zero') {
        const w = pick(r, [2, 4, 5, 8, 10, 20, 25])
        return { a: 0, w, f: w * int(r, 1, 15) }
      }
      const w = pick(r, [5, 10, 15, 20, 25, 30, 40])
      return { a: int(r, 1, 12) * 5, w, f: int(r, 4, 90) }
    },
    ({ w, f }) => (band === 'zero' ? true : band === 'offset' ? places(f / w, 1) : places(f / w, 2) && !Number.isInteger(f / w)),
  )
  const b = a + w
  const fd = Number(show(f / w))
  const N = band === 'distractor' ? f + int(r, 12, 80) : 0
  const prompt = band === 'distractor'
    ? `${m.some(N, f, cls(m, a, b))} What is the frequency density of that class?`
    : m.v === 'x'
      ? `A class is ${cls(m, a, b)} and holds ${f} values. What is its frequency density?`
      : `A class${m.of} is ${cls(m, a, b)} and holds ${f} ${m.things}. What is its frequency density?`
  const solution = band === 'zero'
    ? `Width is ${w}, so $${f} \\div ${w} = ${show(fd)}$.`
    : band === 'offset'
      ? `Width is $${b} - ${a} = ${w}$, so $${f} \\div ${w} = ${show(fd)}$.`
      : `Width is ${w}, so $${f} \\div ${w} = ${show(fd)}$. The total of ${N} is not needed: density is the class's own frequency over its own width.`
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [`width of ${w}`], show(fd)),
      answer: fd,
      tolerance: 0,
    },
    check: { agrees: area(fd, w) === f && fd !== Number(show(N / w)), detail: `${show(fd)} × ${w} = ${area(fd, w)}` },
    values: { task: 'density', a, b, f, ...(N ? { N } : {}) },
  }
}

/**
 * A bar's frequency from its height: written as q4 ($10 < x \le 20$, height 3; 1 mark), q6
 * ($0 < x \le 8$, height 2.5; 2 marks) and q10 (classes all 4 wide, height 6; 1 mark).
 * The check divides back: frequency over width is the height.
 */
const barFrequency: Builder = (r, slot): Draft => {
  const m = pick(r, MEASURES)
  if (slot.id === 'q10') {
    const w = pick(r, [2, 4, 5, 10, 20])
    const h = int(r, 1, 24)
    const answer = h * w
    const wide = m.unit ? `${w} ${m.unit} wide` : `${w} wide`
    return {
      question: {
        type: 'numeric',
        prompt: m.v === 'x' ? `A histogram's classes are all ${w} wide. One bar has a height of ${h}. What frequency does it represent?` : `A histogram${m.of} has classes all ${wide}. One bar has a height of ${h}. What frequency does it represent?`,
        solution: `$${h} \\times ${w} = ${answer}$.`,
        markScheme: scheme(slot, [], String(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: answer / w === h, detail: `${answer} ÷ ${w} = ${answer / w}` },
      values: { task: 'equal-widths', w, h },
    }
  }
  const decimal = slot.id === 'q6'
  const { a, w, h } = draw(
    r,
    (r) => {
      const w = pick(r, decimal ? [2, 4, 5, 6, 8, 10, 12, 15, 20, 25] : [5, 10, 15, 20, 25])
      const h = decimal ? int(r, 2, 48) / pick(r, [10, 4]) : int(r, 1, 12)
      return { a: decimal && r() < 0.5 ? 0 : int(r, 1, 10) * 5, w, h }
    },
    ({ w, h }) => Number.isInteger(area(h, w)) && area(h, w) >= 4 && (!decimal || !Number.isInteger(h)),
  )
  const answer = area(h, w)
  return {
    question: {
      type: 'numeric',
      prompt: decimal ? `A histogram bar${m.of} covers ${cls(m, a, a + w)} with a height of ${show(h)}. What frequency does it represent?` : `A histogram bar${m.of} covers ${cls(m, a, a + w)} and has a height of ${h}. What frequency does it represent?`,
      solution: decimal ? `$${show(h)} \\times ${w} = ${answer}$.` : `Area is frequency: $${h} \\times ${w} = ${answer}$.`,
      markScheme: scheme(slot, ['multiplies height by width'], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: Number(show(answer / w)) === h && answer !== h, detail: `${answer} ÷ ${w} = ${show(answer / w)}` },
    values: { task: 'bar', a, w, h },
  }
}

/**
 * Part of a bar: written as q8 ($40 < x \le 60$ at 0.75, the part $40 < x \le 50$; 2 marks)
 * and q12 ($0 < x \le 25$ at 1.2, the part $5 < x \le 15$ inside it; 3 marks). q8 takes a
 * part at one end of the bar, q12 a part strictly inside. The check takes the part's share
 * of the whole bar's frequency.
 */
const partOfBar: Builder = (r, slot) => {
  const inside = slot.id === 'q12'
  const m = pick(r, MEASURES)
  const { a, w, fd, p, q } = draw(
    r,
    (r) => {
      const w = pick(r, [8, 10, 12, 15, 20, 24, 25, 30, 40])
      const a = int(r, 0, 8) * 5
      const fd = int(r, 2, 60) / pick(r, [10, 20, 4])
      let p: number
      let q: number
      if (inside) {
        p = a + int(r, 1, w - 2)
        q = int(r, p + 1, a + w - 1)
      } else if (r() < 0.5) {
        p = a
        q = a + int(r, 1, w - 1)
      } else {
        q = a + w
        p = a + int(r, 1, w - 1)
      }
      return { a, w, fd, p, q }
    },
    ({ w, fd, p, q }) => places(fd, 2) && Number.isInteger(area(fd, w)) && area(fd, w) >= 6 && area(fd, q - p) >= 2 && q - p !== w,
  )
  const pw = q - p
  const answer = area(fd, pw)
  const whole = area(fd, w)
  // Second route: the part's share of the whole bar's frequency.
  const share = (whole * pw) / w
  return {
    question: {
      type: 'numeric',
      prompt: `A histogram bar${m.of} over ${cls(m, a, a + w)} has frequency density ${show(fd)}. Estimate the frequency for ${cls(m, p, q)}.`,
      solution: inside ? `The part wanted is $${q} - ${p} = ${pw}$ wide, so the estimate is $${show(fd)} \\times ${pw} = ${show(answer)}$.` : `The part wanted is ${pw} wide, so $${show(fd)} \\times ${pw} = ${show(answer)}$.`,
      markScheme: scheme(slot, inside ? [`finds the width of ${pw}`, 'multiplies by the density'] : [`uses a width of ${pw}`], show(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: Math.abs(share - answer) < 1e-9 && answer !== whole, detail: `${pw}/${w} of the bar's ${show(whole)} = ${show(share)}` },
    values: { task: 'part', a, w, fd, p, q },
  }
}

interface Ratio {
  num: number
  den: number
  /** q13 wording: "is drawn at half the height of the first". */
  text: string
  /** The solution's "half that height is". */
  that: string
}

const Q13_RATIOS: Ratio[] = [
  { num: 1, den: 2, text: 'is drawn at half the height of the first', that: 'half that height is' },
  { num: 2, den: 1, text: 'is drawn at twice the height of the first', that: 'twice that height is' },
  { num: 3, den: 1, text: 'is drawn three times as tall as the first', that: 'three times that height is' },
  { num: 3, den: 2, text: 'is drawn one and a half times as tall as the first', that: 'one and a half times that height is' },
]
const Q18_RATIOS: Ratio[] = [
  { num: 1, den: 3, text: 'is drawn one third as tall', that: 'one third of that is' },
  { num: 1, den: 4, text: 'is drawn one quarter as tall', that: 'one quarter of that is' },
  { num: 1, den: 5, text: 'is drawn one fifth as tall', that: 'one fifth of that is' },
  { num: 1, den: 6, text: 'is drawn one sixth as tall', that: 'one sixth of that is' },
  { num: 2, den: 3, text: 'is drawn two thirds as tall', that: 'two thirds of that is' },
  { num: 3, den: 4, text: 'is drawn three quarters as tall', that: 'three quarters of that is' },
]

/**
 * A second bar from the first: written as q13 (first $0 < x \le 4$ holds 12, second
 * $4 < x \le 14$ at half the height; 3 marks) and q18 (first $0 < x \le 6$ holds 18, second
 * $6 < x \le 30$ one sixth as tall; 3 marks). Both sit on the advanced sheet, so q13 takes
 * a half or a multiple and q18 a fraction. The widths always differ, so scaling the first
 * frequency by the height ratio alone is wrong; the check compares the bars' areas.
 */
const secondBar: Builder = (r, slot) => {
  const m = pick(r, MEASURES)
  const ratios = slot.id === 'q18' ? Q18_RATIOS : Q13_RATIOS
  const { s, w1, f1, ratio, w2 } = draw(
    r,
    (r) => ({ s: r() < 0.6 ? 0 : int(r, 1, 6) * 5, w1: pick(r, [2, 4, 5, 6, 8, 10]), f1: int(r, 4, 40), ratio: pick(r, ratios), w2: pick(r, [4, 5, 6, 8, 10, 12, 15, 20, 24, 30]) }),
    ({ w1, f1, ratio, w2 }) => {
      const d1 = f1 / w1
      const d2 = (d1 * ratio.num) / ratio.den
      return w1 !== w2 && places(d1, 2) && places(d2, 2) && Number.isInteger(Number(show(d2 * w2))) && d2 * w2 >= 2 && Math.abs(d2 * w2 - (f1 * ratio.num) / ratio.den) > 1e-9
    },
  )
  const d1 = Number(show(f1 / w1))
  const d2 = Number(show((d1 * ratio.num) / ratio.den))
  const answer = Number(show(d2 * w2))
  const first = cls(m, s, s + w1)
  const second = cls(m, s + w1, s + w1 + w2)
  const holds = m.v === 'x' ? `${f1} values` : `${f1} ${m.things}`
  const prompt = slot.id === 'q18'
    ? `A histogram bar${m.of} covers ${first} and represents ${holds}. Another covers ${second} and ${ratio.text}. What frequency does the second bar represent?`
    : `A histogram's first bar${m.of} covers ${first} and is known to hold ${holds}. A second bar covers ${second} and ${ratio.text}. What frequency does the second bar represent?`
  const solution = slot.id === 'q18'
    ? `The first density is $${f1} \\div ${w1} = ${show(d1)}$, so ${ratio.that} ${show(d2)}. The second bar is ${w2} wide, giving $${show(d2)} \\times ${w2} = ${answer}$.`
    : `The first bar has density $${f1} \\div ${w1} = ${show(d1)}$, so ${ratio.that} ${show(d2)}. The second bar is ${w2} wide, giving $${show(d2)} \\times ${w2} = ${answer}$.`
  // Second route: areas in proportion, f2 / f1 = (height ratio) × (w2 / w1), in whole numbers.
  const areasAgree = answer * w1 * ratio.den === f1 * ratio.num * w2
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [`first density is ${show(d1)}`, `second density is ${show(d2)}`], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: areasAgree, detail: `${answer} × ${w1} × ${ratio.den} against ${f1} × ${ratio.num} × ${w2}` },
    values: { task: 'second-bar', w1, f1, w2, num: ratio.num, den: ratio.den, trap: show((f1 * ratio.num) / ratio.den) },
  }
}

interface Grouping {
  what: string
  v: string
  unit: string
  /** Possible class boundaries, unequal widths. */
  bounds: number[][]
}

const GROUPINGS: Grouping[] = [
  { what: 'Journey times', v: 't', unit: '', bounds: [[0, 10, 15, 25, 45], [0, 5, 10, 20, 40], [0, 10, 20, 30, 60], [0, 5, 15, 20, 30, 50]] },
  { what: 'Plant heights, in cm,', v: 'h', unit: '', bounds: [[0, 10, 20, 40, 60], [0, 20, 30, 40, 70], [10, 20, 25, 30, 50]] },
  { what: 'Parcel masses, in kg,', v: 'w', unit: '', bounds: [[0, 2, 5, 10, 20], [0, 1, 2, 4, 8, 12], [0, 5, 10, 15, 25]] },
  { what: 'Ages of people at a gym', v: 'a', unit: '', bounds: [[15, 20, 30, 40, 60], [10, 20, 25, 35, 55, 75], [18, 25, 35, 50, 70]] },
]

/**
 * The class holding the median: written as q14 (frequencies 15, 20, 18, 7 in unequal
 * classes; 3 marks). As in the written question the median is the (n/2)th value; the
 * frequencies are drawn so the (n/2)th and the next value share a class, so the answer
 * does not turn on n/2 against (n + 1)/2. The check writes the data out by class and
 * reads the middle of the sorted list.
 */
const medianClass: Builder = (r, slot) => {
  const g = pick(r, GROUPINGS)
  const bounds = pick(r, g.bounds)
  const k = bounds.length - 1
  const { freqs, n } = draw(
    r,
    (r) => {
      const freqs = Array.from({ length: k }, () => int(r, 3, 30))
      return { freqs, n: total(freqs) }
    },
    // Even, and the (n/2)th and next values in one class, so n/2 against (n + 1)/2 cannot matter.
    ({ freqs, n }) => n % 2 === 0 && classOf(freqs, n / 2) === classOf(freqs, n / 2 + 1),
  )
  const j = classOf(freqs, n / 2)
  const answer = bounds[j + 1]!
  const running: number[] = []
  freqs.reduce((acc, f) => (running.push(acc + f), acc + f), 0)
  const classes = freqs.map((_, i) => `$${bounds[i]} < ${g.v} \\le ${bounds[i + 1]}$`)
  // Second route: the data written out class by class (as class numbers), sorted, read in the middle.
  const raw = ascending(freqs.flatMap((f, i) => Array.from({ length: f }, () => i)))
  const mid = raw[n / 2 - 1]!
  const next = raw[n / 2]!
  return {
    question: {
      type: 'numeric',
      prompt: `${g.what} have frequencies ${freqs.join(', ')} in the classes ${andList(classes)}. In which class does the median lie? Give the upper bound of that class.`,
      solution: `There are ${n} values, so the median is the ${ordinal(n / 2)}. Running totals are ${running.join(', ')}, and the ${ordinal(n / 2)} is passed in ${classes[j]}. Its upper bound is **${answer}**.`,
      markScheme: scheme(slot, [`the median is the ${ordinal(n / 2)} value`, 'builds running totals'], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: mid === j && next === j, detail: `sorted class numbers at positions ${n / 2} and ${n / 2 + 1}: ${mid}, ${next}` },
    values: { task: 'median-class', bounds: bounds.join(','), freqs: freqs.join(','), n },
  }
}

/** The class (from 0) holding the value at 1-based position `pos`. */
function classOf(freqs: readonly number[], pos: number): number {
  let run = 0
  for (let i = 0; i < freqs.length; i++) {
    run += freqs[i]!
    if (run >= pos) return i
  }
  return -1
}

export const frequencyDensityGenerator = bySlot('frequency-density', HISTOGRAMS, { q2: frequencyDensity, q5: frequencyDensity, q11: frequencyDensity })
export const histogramBars = bySlot('histogram-bars', HISTOGRAMS, { q4: barFrequency, q6: barFrequency, q10: barFrequency, q8: partOfBar, q12: partOfBar })
export const histogramSecondBar = bySlot('histogram-second-bar', HISTOGRAMS, { q13: secondBar, q18: secondBar })
export const histogramMedianClass = bySlot('histogram-median-class', HISTOGRAMS, { q14: medianClass })

/* ------------------------------------------------------------------------------------------
 * Box plots
 * ---------------------------------------------------------------------------------------- */

const BOX = 'box-plots'

interface BoxContext {
  summary: (n: number) => string
  things: string
  unit: string
  more: string
  less: string
  between: string
  range: [number, number]
}

const BOX_CONTEXTS: BoxContext[] = [
  { summary: (n) => `the marks of ${n} students`, things: 'students', unit: '', more: 'scored more than', less: 'scored less than', between: 'scored between', range: [5, 60] },
  { summary: (n) => `${n} delivery times`, things: 'deliveries', unit: 'minutes', more: 'took longer than', less: 'took less than', between: 'took between', range: [8, 60] },
  { summary: (n) => `the heights of ${n} plants`, things: 'plants', unit: 'cm', more: 'were taller than', less: 'were shorter than', between: 'had heights between', range: [10, 90] },
  { summary: (n) => `the masses of ${n} parcels`, things: 'parcels', unit: 'kg', more: 'weighed more than', less: 'weighed less than', between: 'weighed between', range: [1, 40] },
  { summary: (n) => `the finishing times of ${n} runners`, things: 'runners', unit: 'minutes', more: 'took longer than', less: 'took less than', between: 'took between', range: [20, 75] },
]

const u = (c: BoxContext, x: number) => (c.unit ? `${x} ${c.unit}` : String(x))

/** Five increasing whole numbers in the context's range, with room between them. */
function fiveNumbers(r: Rng, c: BoxContext): [number, number, number, number, number] {
  return draw(
    r,
    (r) => [int(r, ...c.range), int(r, ...c.range), int(r, ...c.range), int(r, ...c.range), int(r, ...c.range)].sort((a, b) => a - b) as [number, number, number, number, number],
    (f) => f.every((x, i) => i === 0 || x - f[i - 1]! >= 3),
  )
}

/** Sorted whole numbers between `lo` and `hi` (both included), `m` of them. */
function fill(r: Rng, m: number, lo: number, hi: number): number[] {
  return ascending(Array.from({ length: m }, () => int(r, lo, hi)))
}

/**
 * A data set with a given five-number summary, n = 4k + 3 so every quartile is one value:
 * the second route builds the data, then reads its quartiles by position.
 */
function dataWithSummary(r: Rng, five: readonly number[]): number[] {
  const [min, q1, med, q3, max] = five as [number, number, number, number, number]
  const k = int(r, 2, 4)
  // Positions (1-based): min 1, Q1 k+1, median 2k+2, Q3 3k+3, max 4k+3.
  return [min, ...fill(r, k - 1, min, q1), q1, ...fill(r, k, q1, med), med, ...fill(r, k, med, q3), q3, ...fill(r, k - 1, q3, max), max]
}

/**
 * The IQR or range from a box plot: written as q3 (quartiles 9 and 20; 1 mark) and q4 (5 to
 * 26; 1 mark). Half the time the prompt gives the whole five-number summary and the student
 * picks the right two. The check builds a data set with that summary and reads it off.
 */
const boxMeasure: Builder = (r, slot) => {
  const c = pick(r, BOX_CONTEXTS)
  const five = fiveNumbers(r, c)
  const [min, q1, med, q3, max] = five
  const full = r() < 0.5
  const data = dataWithSummary(r, five)
  const iqr = slot.id === 'q3'
  const answer = iqr ? q3 - q1 : max - min
  const read = iqr ? quartileByPosition(data, 'upper') - quartileByPosition(data, 'lower') : data[data.length - 1]! - data[0]!
  const summary = `a minimum of ${u(c, min)}, a lower quartile of ${u(c, q1)}, a median of ${u(c, med)}, an upper quartile of ${u(c, q3)} and a maximum of ${u(c, max)}`
  const prompt = iqr
    ? full ? `A box plot of ${c.summary(data.length)} shows ${summary}. What is the interquartile range?` : `A box plot of ${c.summary(data.length)} has lower quartile ${u(c, q1)} and upper quartile ${u(c, q3)}. What is the interquartile range?`
    : full ? `A box plot of ${c.summary(data.length)} shows ${summary}. What is the range?` : `A box plot of ${c.summary(data.length)} runs from a minimum of ${u(c, min)} to a maximum of ${u(c, max)}. What is the range?`
  const solution = iqr
    ? `$\\text{IQR} = Q_3 - Q_1 = ${q3} - ${q1} = ${answer}$.${full ? ' The minimum, median and maximum are not needed.' : ''}`
    : `$${max} - ${min} = ${answer}$. The range is whisker tip to whisker tip.${full ? ' The quartiles and median are not needed.' : ''}`
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [], String(answer)),
      answer,
      tolerance: 0,
      ...(c.unit ? { units: c.unit } : {}),
    },
    check: { agrees: read === answer && medianOf(data) === med, detail: `data ${data.join(',')} reads ${read}` },
    values: { task: iqr ? 'iqr' : 'range', five: five.join(','), data: data.join(',') },
  }
}

export const boxPlotMeasures = bySlot('box-plot-measures', BOX, { q3: boxMeasure, q4: boxMeasure })

/** Lists for the median and quartile questions: the averages lists, written in order where asked. */
const counted = (c: (typeof LISTS)[number], n: number) => c.phrase(words(n))

/** "the five values above it" / "the first six". */
const halfName = (h: number) => words(h)

/**
 * Median and quartiles of a list: written as q5 (median of 11 unsorted; 2 marks), q6 (upper
 * quartile of 11 in order), q7 (median of 12 in order) and q8 (lower quartile of 12 in
 * order). The four share the higher sheet and each keeps its own task; the counts vary
 * within each slot's parity, so a half may have an odd or even number of values. The
 * check reads the same figure by position, never by halving the list.
 */
function listMeasure(task: 'median-unsorted' | 'upper-odd' | 'median-even' | 'lower-even'): Builder {
  return (r, slot) => {
    const c = pick(r, LISTS)
    const n = task === 'median-unsorted' ? pick(r, [9, 11, 13, 15]) : task === 'upper-odd' ? pick(r, [7, 9, 11, 13, 15]) : pick(r, [8, 10, 12, 14, 16])
    const raw = draw(
      r,
      (r) => Array.from({ length: n }, () => int(r, ...c.range)),
      (xs) => {
        const s = ascending(xs)
        if (task !== 'median-unsorted') return new Set(xs).size >= n - 4
        return xs[(n - 1) / 2] !== medianOf(s) && !xs.every((x, i) => i === 0 || xs[i - 1]! <= x)
      },
    )
    const s = ascending(raw)
    const shown = task === 'median-unsorted' ? raw : s
    const h = Math.floor(n / 2)
    let answer: number
    let solution: string
    let method: string
    let other: number
    if (task === 'median-unsorted' || task === 'median-even') {
      answer = medianOf(s)
      other = medianByStriking(raw)
      if (task === 'median-unsorted') {
        const mid = (n + 1) / 2
        solution = `Sorted: ${commas(s)}. ${cap(words(n))} values, so the median is the ${ordinal(mid)}: **${show(answer)}**. Taking the middle of the unsorted list gives ${raw[mid - 1]}, which is wrong.`
        method = 'sorts the data'
      } else {
        solution = `${cap(words(n))} values, so the median is the mean of the ${ordinal(h)} and ${ordinal(h + 1)}: $\\frac{${s[h - 1]} + ${s[h]}}{2} = ${show(answer)}$.`
        method = `averages the ${ordinal(h)} and ${ordinal(h + 1)} values`
      }
    } else {
      const upper = task === 'upper-odd'
      const half = upper ? s.slice(n - h) : s.slice(0, h)
      const { q1, q3 } = quartilesOf(s)
      answer = upper ? q3 : q1
      other = quartileByPosition(s, upper ? 'upper' : 'lower')
      const inHalf = h % 2
        ? `Its median is the ${ordinal((h + 1) / 2)} of those, **${show(answer)}**.`
        : `Its median is halfway between the ${ordinal(h / 2)} and ${ordinal(h / 2 + 1)} of those: $\\frac{${half[h / 2 - 1]} + ${half[h / 2]}}{2} = ${show(answer)}$.`
      if (upper) {
        solution = `${cap(words(n))} values with the median at the ${ordinal(h + 1)}. The upper half is the ${halfName(h)} above it: ${commas(half)}. ${inHalf}`
        method = `takes the ${halfName(h)} values above the median`
      } else {
        solution = `${cap(words(n))} values, so the lower half is the first ${halfName(h)}: ${commas(half)}. ${inHalf}`
        method = `takes the lower ${halfName(h)} values`
      }
    }
    const ask = task === 'upper-odd' ? 'What is the upper quartile?' : task === 'lower-even' ? 'What is the lower quartile?' : task === 'median-even' ? 'What is the median?' : 'Find the median.'
    const prompt = task === 'median-unsorted'
      ? `${cap(counted(c, n))} are ${commas(shown)}. ${ask}`
      : `In order, ${counted(c, n)} are ${commas(shown)}. ${ask}`
    return {
      question: {
        type: 'numeric',
        prompt,
        solution,
        markScheme: scheme(slot, [method], show(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: other === answer, detail: `by position: ${show(other)}` },
      values: { task, data: raw.join(','), n },
    }
  }
}

export const medianAndQuartiles = bySlot('median-and-quartiles', BOX, {
  q5: listMeasure('median-unsorted'),
  q6: listMeasure('upper-odd'),
  q7: listMeasure('median-even'),
  q8: listMeasure('lower-even'),
})

type Share = 'above-q3' | 'below-q1' | 'between' | 'above-q1' | 'below-q3'

const SHARE: Record<Share, { quarters: number; method: string }> = {
  'above-q3': { quarters: 1, method: 'uses 25% above the upper quartile' },
  'below-q1': { quarters: 1, method: 'uses 25% below the lower quartile' },
  between: { quarters: 2, method: 'uses 50% inside the box' },
  'above-q1': { quarters: 3, method: 'uses 75% above the lower quartile' },
  'below-q3': { quarters: 3, method: 'uses 75% below the upper quartile' },
}

/**
 * Evenly spread distinct values, in hundredths, strictly between `lo` and `hi`. Used to build
 * a data set with given quartiles for the second route.
 */
function between(m: number, lo: number, hi: number): number[] {
  return Array.from({ length: m }, (_, i) => lo + Math.round(((i + 1) * (hi - lo)) / (m + 1)))
}

/**
 * How many lie beyond a quartile: written as q10 (40 marks, more than the upper quartile;
 * 2 marks) and q16 (200 deliveries between the quartiles; 2 marks). q10 asks for a quarter
 * (above Q3 or below Q1) and q16 for a half or three quarters, by turn. The check builds a
 * data set of n distinct values with exactly those quartiles and counts.
 */
function boxShare(choices: Share[]): Builder {
  return (r, slot, turn) => {
    const c = pick(r, BOX_CONTEXTS)
    const share = choices[turn % choices.length]!
    const n = 4 * int(r, slot.id === 'q10' ? 5 : 10, slot.id === 'q10' ? 50 : 100)
    const [min, q1, , q3, max] = fiveNumbers(r, c)
    const answer = (n * SHARE[share].quarters) / 4
    // Second route: n distinct values (in hundredths) whose quartiles are q1 and q3, by the halves rule.
    const k = n / 4
    const H = 100
    const data = [
      min * H,
      ...between(k - 2, min * H, q1 * H - 50),
      q1 * H - 50,
      q1 * H + 50,
      ...between(2 * k - 2, q1 * H + 50, q3 * H - 50),
      q3 * H - 50,
      q3 * H + 50,
      ...between(k - 2, q3 * H + 50, max * H),
      max * H,
    ]
    const lq = quartileByPosition(data, 'lower') / H
    const uq = quartileByPosition(data, 'upper') / H
    const count = data.filter((x) =>
      share === 'above-q3' ? x > uq * H : share === 'below-q1' ? x < lq * H : share === 'between' ? x > lq * H && x < uq * H : share === 'above-q1' ? x > lq * H : x < uq * H,
    ).length
    const distinct = new Set(data).size === n && data.length === n
    const unit = c.unit ? ` ${c.unit}` : ''
    let prompt: string
    let solution: string
    if (share === 'above-q3' || share === 'below-q1') {
      const q = share === 'above-q3' ? q3 : q1
      prompt = `A box plot summarises ${c.summary(n)}. The ${share === 'above-q3' ? 'upper' : 'lower'} quartile is ${u(c, q)}. How many ${c.things} ${share === 'above-q3' ? c.more : c.less} ${u(c, q)}?`
      solution = `A quarter of the data lies ${share === 'above-q3' ? 'above the upper' : 'below the lower'} quartile, and $25\\%$ of ${n} is **${answer}** ${c.things}.`
    } else {
      const ask = share === 'between' ? `${c.between} ${q1} and ${q3}${unit}` : share === 'above-q1' ? `${c.more} ${u(c, q1)}` : `${c.less} ${u(c, q3)}`
      prompt = `A box plot summarises ${c.summary(n)}. The lower quartile is ${u(c, q1)} and the upper quartile is ${u(c, q3)}. How many ${c.things} ${ask}?`
      solution = share === 'between'
        ? `Between the quartiles is the **box**, which holds the middle **50%** of the data. Half of ${n} is **${answer}** ${c.things}. The plot cannot say which ones — only how many.`
        : share === 'above-q1'
          ? `Only the bottom quarter lies below the lower quartile, so **75%** of the data is above it. $\\frac{3}{4}$ of ${n} is **${answer}** ${c.things}. The upper quartile is not needed.`
          : `Only the top quarter lies above the upper quartile, so **75%** of the data is below it. $\\frac{3}{4}$ of ${n} is **${answer}** ${c.things}. The lower quartile is not needed.`
    }
    return {
      question: {
        type: 'numeric',
        prompt,
        solution,
        markScheme: scheme(slot, [SHARE[share].method], String(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: distinct && lq === q1 && uq === q3 && count === answer, detail: `${n} distinct values, quartiles ${lq} and ${uq}, ${count} counted` },
      values: { share, n, q1, q3 },
    }
  }
}

export const boxPlotShares = bySlot('box-plot-shares', BOX, { q10: boxShare(['above-q3', 'below-q1']), q16: boxShare(['between', 'above-q1', 'between', 'below-q3']) })

/* ------------------------------------------------------------------------------------------
 * Grouped and cumulative frequency
 * ---------------------------------------------------------------------------------------- */

const GROUPED = 'grouped-and-cumulative-frequency'

interface Table {
  v: string
  /** The data, with the count: "40 times", "the heights of 40 plants". */
  of: (n: number | string) => string
  /** The things counted, for "the number of plants of 30 cm or less". */
  items: string
  unit: string
  measure: string
  starts: number[]
  widths: number[]
  /** "How many of the times were longer than 35 minutes?" */
  ask: (b: number) => string
  /** The highest class bound the context allows: nobody is older than 100. */
  max?: number
}

const TABLES: Table[] = [
  { v: 't', of: (n) => `${n} times`, items: 'times', unit: 'minutes', measure: 'time', starts: [0], widths: [5, 10], ask: (b) => `How many of the times were longer than ${b} minutes?` },
  { v: 'h', of: (n) => `the heights of ${n} plants`, items: 'plants', unit: 'cm', measure: 'height', starts: [0, 10, 20], widths: [5, 10, 20], ask: (b) => `How many of the plants were taller than ${b} cm?` },
  { v: 'm', of: (n) => `the masses of ${n} apples`, items: 'apples', unit: 'g', measure: 'mass', starts: [100, 120, 140], widths: [10, 20], ask: (b) => `How many of the apples were heavier than ${b} g?` },
  { v: 'd', of: (n) => `${n} long jump distances`, items: 'jumps', unit: 'cm', measure: 'distance', starts: [200, 250, 300], widths: [10, 20, 25], ask: (b) => `How many of the jumps were longer than ${b} cm?` },
  { v: 'a', of: (n) => `the ages of ${n} people`, items: 'people', unit: 'years', measure: 'age', starts: [0, 10, 20], widths: [10, 20], ask: (b) => `How many of the people were older than ${b} years?`, max: 100 },
]

interface Drawn {
  t: Table
  start: number
  w: number
  freqs: number[]
  n: number
  bounds: number[]
  cf: number[]
}

function drawTable(r: Rng, k: [number, number], n: [number, number], ok: (d: Drawn) => boolean = () => true): Drawn {
  const t = pick(r, TABLES)
  return draw(
    r,
    (r) => {
      const start = pick(r, t.starts)
      const w = pick(r, t.widths)
      const kk = int(r, ...k)
      const total_ = int(r, ...n)
      const freqs = spread(r, total_, kk, int(r, 1, kk - 2))
      const bounds = Array.from({ length: kk + 1 }, (_, i) => start + i * w)
      const cf: number[] = []
      freqs.reduce((acc, f) => (cf.push(acc + f), acc + f), 0)
      return { t, start, w, freqs, n: total_, bounds, cf }
    },
    (d) => (t.max === undefined || d.bounds[d.bounds.length - 1]! <= t.max) && ok(d),
    3000,
  )
}

const dashClasses = (d: Drawn) => d.freqs.map((_, i) => `${d.bounds[i]}–${d.bounds[i + 1]}`)

/**
 * The modal class: written as q1 (forty times, frequencies 4, 10, 16, 8, 2; 1 mark). The
 * answer is the class, in any of the ways a student writes one, never its frequency. The
 * check writes the data out by class and counts.
 */
export const modalClass: Generator = {
  id: 'modal-class',
  subjectId: 'maths',
  topicId: GROUPED,
  replaces: ['q1'],
  build(r, slot): Draft {
    const d = drawTable(r, [4, 6], [20, 80], (d) => d.freqs.filter((f) => f === Math.max(...d.freqs)).length === 1)
    const j = d.freqs.indexOf(Math.max(...d.freqs))
    const [a, b] = [d.bounds[j]!, d.bounds[j + 1]!]
    const v = d.t.v
    const raw = d.freqs.flatMap((f, i) => Array.from({ length: f }, () => i))
    const counts = raw.reduce<number[]>((acc, i) => ((acc[i] = (acc[i] ?? 0) + 1), acc), [])
    const most = counts.indexOf(Math.max(...counts))
    return {
      question: {
        type: 'short-text',
        prompt: `In a table of ${d.t.of(words(d.n))} (frequencies ${d.freqs.join(', ')} in classes ${dashClasses(d).join(', ')} ${d.t.unit}), which is the modal class?`,
        solution: `The modal class is the one with the **highest frequency**, ${d.freqs[j]}: **${a} < ${v} ≤ ${b}**. Give the class, not the frequency.`,
        markScheme: scheme(slot, [], `${a} < ${v} ≤ ${b}`),
        accepted: [`${a} < ${v} ≤ ${b}`, `${a} to ${b}`, `${a}-${b}`, `${a} < ${v} <= ${b}`, `between ${a} and ${b}`],
      },
      check: { agrees: most === j, detail: `counted one value at a time: class ${most} has ${counts[most]}` },
      values: { bounds: d.bounds.join(','), freqs: d.freqs.join(','), modal: `${a}-${b}` },
    }
  },
}

/**
 * Cumulative frequency at the end of a class: written as q2 (4, 10, 16, 8, 2, the third
 * class; 1 mark). The class asked for varies; the check counts the raw data up to it.
 */
const cumulativeAt: Builder = (r, slot) => {
  const k = int(r, 4, 6)
  const freqs = Array.from({ length: k }, () => int(r, 1, 30))
  const j = int(r, 2, k - 1)
  const answer = total(freqs.slice(0, j))
  const raw = freqs.flatMap((f, i) => Array.from({ length: f }, () => i + 1))
  const counted = raw.filter((c) => c <= j).length
  return {
    question: {
      type: 'numeric',
      prompt: `The frequencies of ${words(k)} classes are ${andList(freqs.map(String))}. What is the cumulative frequency at the end of the ${ordinalWord(j)} class?`,
      solution: `$${freqs.slice(0, j).join(' + ')} = ${answer}$: the number of values up to the end of the ${ordinalWord(j)} class.`,
      markScheme: scheme(slot, [], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: counted === answer, detail: `${raw.length} values, ${counted} in the first ${j} classes` },
    values: { task: 'cf', freqs: freqs.join(','), j },
  }
}

/** Where to read across for the median: written as q6 (40 values, read from 20; 1 mark). */
const readAcross: Builder = (r, slot) => {
  const t = pick(r, TABLES)
  const n = 2 * int(r, 10, 160)
  const answer = n / 2
  return {
    question: {
      type: 'numeric',
      prompt: `A cumulative frequency graph shows ${t.of(n)}. From which value on the cumulative frequency axis do you read across to find the median?`,
      solution: `The median is read across from $\\frac{n}{2} = \\frac{${n}}{2} = ${answer}$.`,
      markScheme: scheme(slot, [], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: n - answer === answer && answer !== (n + 1) / 2, detail: `${n} − ${answer} = ${n - answer}` },
    values: { task: 'read-across', n },
  }
}

/** The value read from a straight line between two cumulative frequency points, at height `y`. */
const lineAt = (x1: number, y1: number, x2: number, y2: number, y: number) => x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)

/** Reads the graph by searching the table class by class: the second route for an estimate. */
function readTable(d: Drawn, y: number): number {
  let before = 0
  for (let i = 0; i < d.freqs.length; i++) {
    const f = d.freqs[i]!
    if (before + f >= y) return d.bounds[i]! + ((y - before) / f) * d.w
    before += f
  }
  return NaN
}

/** Index of the class whose cumulative frequency first passes `y`, strictly inside it. */
const crossing = (d: Drawn, y: number) => d.cf.findIndex((c, i) => c > y && (i === 0 ? 0 : d.cf[i - 1]!) < y)

/** A tolerance for a value read from a graph: half a unit, never more than 2% of it. */
const graphTolerance = (x: number) => Math.min(0.5, Math.floor(Math.abs(x) * 2) / 100)

/**
 * The median by reading between two plotted points: written as q7 (forty times, line through
 * (20, 14) and (30, 30); 2 marks). The points come from a real table, the reading is exact
 * to 2 decimal places, and the check finds the median by searching that table.
 */
const medianFromGraph: Builder = (r, slot) => {
  const d = drawTable(r, [4, 6], [20, 120], (d) => {
    if (d.n % 2) return false
    const i = crossing(d, d.n / 2)
    if (i < 1) return false
    return places(lineAt(d.bounds[i]!, d.cf[i - 1]!, d.bounds[i + 1]!, d.cf[i]!, d.n / 2), 2)
  })
  const half = d.n / 2
  const i = crossing(d, half)
  const [x1, y1, x2, y2] = [d.bounds[i]!, d.cf[i - 1]!, d.bounds[i + 1]!, d.cf[i]!]
  const answer = Number(show(lineAt(x1, y1, x2, y2, half)))
  const other = readTable(d, half)
  return {
    question: {
      type: 'numeric',
      prompt: `On the cumulative frequency graph of ${d.t.of(d.n)}, the line passes through (${x1}, ${y1}) and (${x2}, ${y2}). Estimate the median ${d.t.measure} in ${d.t.unit}.`,
      solution: `Read across from ${half}. Between (${x1}, ${y1}) and (${x2}, ${y2}) the line rises ${y2 - y1} over ${x2 - x1} ${d.t.unit}, and ${half} is ${half - y1} above ${y1}, so the median is about $${x1} + \\frac{${half - y1}}{${y2 - y1}} \\times ${x2 - x1} = ${show(answer)}$ ${d.t.unit}. Anything close is accepted from a graph.`,
      markScheme: scheme(slot, [`reads across from ${half}`], `about ${show(answer)}`),
      answer,
      tolerance: graphTolerance(answer),
      units: d.t.unit,
    },
    check: { agrees: Math.abs(other - answer) < 1e-9, detail: `table searched class by class: ${other}` },
    values: { task: 'median-graph', bounds: d.bounds.join(','), freqs: d.freqs.join(','), n: d.n },
  }
}

/**
 * The interquartile range from two readings: written as q8 (quartiles read as 16 and 30; 1
 * mark). The readings come from a real table, read at n/4 and 3n/4 and whole; the check
 * reads them again by searching the table and subtracts.
 */
const iqrFromGraph: Builder = (r, slot) => {
  const d = drawTable(r, [4, 6], [20, 120], (d) => {
    if (d.n % 4) return false
    const a = crossing(d, d.n / 4)
    const b = crossing(d, (3 * d.n) / 4)
    if (a < 1 || b < 1) return false
    const q1 = lineAt(d.bounds[a]!, d.cf[a - 1]!, d.bounds[a + 1]!, d.cf[a]!, d.n / 4)
    const q3 = lineAt(d.bounds[b]!, d.cf[b - 1]!, d.bounds[b + 1]!, d.cf[b]!, (3 * d.n) / 4)
    return places(q1, 0) && places(q3, 0)
  })
  const a = crossing(d, d.n / 4)
  const b = crossing(d, (3 * d.n) / 4)
  const q1 = Math.round(lineAt(d.bounds[a]!, d.cf[a - 1]!, d.bounds[a + 1]!, d.cf[a]!, d.n / 4))
  const q3 = Math.round(lineAt(d.bounds[b]!, d.cf[b - 1]!, d.bounds[b + 1]!, d.cf[b]!, (3 * d.n) / 4))
  const answer = q3 - q1
  const other = readTable(d, (3 * d.n) / 4) - readTable(d, d.n / 4)
  return {
    question: {
      type: 'numeric',
      prompt: `On a cumulative frequency graph of ${d.t.of(d.n)}, the lower quartile reads as ${q1} ${d.t.unit} and the upper quartile as ${q3} ${d.t.unit}. What is the interquartile range?`,
      solution: `$${q3} - ${q1} = ${answer}$ ${d.t.unit}: the spread of the middle half.`,
      markScheme: scheme(slot, [], String(answer)),
      answer,
      tolerance: 0,
      units: d.t.unit,
    },
    check: { agrees: Math.abs(other - answer) < 1e-9, detail: `quartiles found again from the table: ${readTable(d, d.n / 4)} and ${readTable(d, (3 * d.n) / 4)}` },
    values: { task: 'iqr-graph', bounds: d.bounds.join(','), freqs: d.freqs.join(','), n: d.n, q1, q3 },
  }
}

/**
 * How many lie above a reading: written as q10 (40 times, 34 at 35 minutes; 2 marks). The
 * reading is at a class boundary of a real table; the check adds the classes above it.
 */
const aboveReading: Builder = (r, slot) => {
  // The reading is never half the total, so subtracting it and reading it off are different answers.
  const d = drawTable(r, [4, 6], [20, 200], (d) => d.cf.slice(1, -1).some((c) => 2 * c !== d.n))
  const j = draw(r, (r) => int(r, 1, d.freqs.length - 2), (j) => 2 * d.cf[j]! !== d.n)
  const b = d.bounds[j + 1]!
  const c = d.cf[j]!
  const answer = d.n - c
  const above = total(d.freqs.slice(j + 1))
  return {
    question: {
      type: 'numeric',
      prompt: `A cumulative frequency graph of ${d.t.of(d.n)} gives a reading of ${c} at ${b} ${d.t.unit}. ${d.t.ask(b)}`,
      solution: `The reading is the number of ${d.t.items} of **${b} ${d.t.unit} or less**. The rest are above ${b}: $${d.n} - ${c} = ${answer}$.`,
      markScheme: scheme(slot, [`subtracts from ${d.n}`], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: above === answer && answer !== c, detail: `classes above ${b}: ${d.freqs.slice(j + 1).join(' + ')} = ${above}` },
    values: { task: 'above', bounds: d.bounds.join(','), freqs: d.freqs.join(','), at: b },
  }
}

export const cumulativeFrequency = bySlot('cumulative-frequency', GROUPED, { q2: cumulativeAt, q6: readAcross, q7: medianFromGraph, q8: iqrFromGraph, q10: aboveReading })

/** Boundaries for the q15 tables: equal or unequal classes, three or four of them. */
const Q15_BOUNDS = [
  [0, 20, 40, 60],
  [0, 10, 20, 30],
  [0, 10, 30, 60],
  [0, 5, 15, 30],
  [10, 20, 40, 50],
  [0, 20, 30, 50],
  [0, 10, 20, 40, 60],
  [20, 30, 40, 60, 100],
  [0, 4, 8, 12, 20],
]

/**
 * An estimated mean from grouped data: written as q5 (forty times, five classes of width
 * 10; 3 marks) and q15 (classes 0–20, 20–40, 40–60, frequencies 5, 12, 3; 3 marks). q5 has
 * equal classes in context; q15 a bare table, sometimes with unequal classes. Midpoints are
 * worked doubled (lower + upper) so 2.5 has no residue; the check expands the table into
 * a list of midpoints and averages it, and the class-bound trap must differ.
 */
function groupedMean(kind: 'context' | 'bare'): Builder {
  return (r, slot) => {
    let bounds: number[]
    let freqs: number[]
    let t: Table | undefined
    if (kind === 'context') {
      const d = drawTable(r, [4, 6], [20, 60], (d) => places(total(d.freqs.map((f, i) => f * (d.bounds[i]! + d.bounds[i + 1]!))) / (2 * d.n), 2))
      bounds = d.bounds
      freqs = d.freqs
      t = d.t
    } else {
      const drawn = draw(
        r,
        (r) => {
          const bounds = pick(r, Q15_BOUNDS)
          return { bounds, freqs: bounds.slice(1).map(() => int(r, 2, 20)) }
        },
        ({ bounds, freqs }) => places(total(freqs.map((f, i) => f * (bounds[i]! + bounds[i + 1]!))) / (2 * total(freqs)), 2),
      )
      bounds = drawn.bounds
      freqs = drawn.freqs
    }
    const n = total(freqs)
    const k = freqs.length
    const mids = freqs.map((_, i) => (bounds[i]! + bounds[i + 1]!) / 2)
    const products = freqs.map((f, i) => Number(show(f * mids[i]!)))
    const S = Number(show(total(products)))
    const answer = Number(show(S / n))
    const upperTrap = Number(show(total(freqs.map((f, i) => f * bounds[i + 1]!)) / n))
    // Second route: every value replaced by its class midpoint, summed from the top class down in halves.
    const doubled = freqs.map((f, i) => f * (bounds[i]! + bounds[i + 1]!)).reverse()
    const viaDoubled = total(doubled) / (2 * n)
    const expanded = freqs.flatMap((f, i) => Array.from({ length: f }, () => mids[i]!))
    const expandedMean = total(expanded) / expanded.length
    const classes = freqs.map((_, i) => `${bounds[i]}–${bounds[i + 1]}`)
    if (kind === 'context') {
      const w = bounds[1]! - bounds[0]!
      return {
        question: {
          type: 'numeric',
          prompt: `Using a table of ${t!.of(words(n))} (frequencies ${freqs.join(', ')} in classes of width ${w} from ${bounds[0]} to ${bounds[k]} ${t!.unit}), estimate the mean ${t!.measure} in ${t!.unit}.`,
          solution: `Midpoints ${commas(mids)}. $\\sum fx = ${products.map(show).join(' + ')} = ${show(S)}$; then $${show(S)} \\div ${n} = ${show(answer)}$ ${t!.unit}, as an estimate. Using the upper class bounds instead of the midpoints would give ${show(upperTrap)}, half a class too high.`,
          markScheme: scheme(slot, ['uses midpoints', `divides ${show(S)} by ${n}`], show(answer)),
          answer,
          tolerance: 0.01,
          units: t!.unit,
        },
        check: { agrees: Math.abs(viaDoubled - answer) < 1e-9 && Math.abs(expandedMean - answer) < 1e-9 && upperTrap !== answer, detail: `doubled midpoints summed from the top: ${viaDoubled}; ${expanded.length} midpoints averaged: ${expandedMean}` },
        values: { task: 'grouped-mean', bounds: bounds.join(','), freqs: freqs.join(','), trap: upperTrap },
      }
    }
    const rowsTrap = Number(show(S / k))
    return {
      question: {
        type: 'numeric',
        prompt: `A grouped table has classes ${andList(classes)} with frequencies ${andList(freqs.map(String))}. Estimate the mean.`,
        solution: `Midpoints ${commas(mids)}. $\\sum fx = ${products.map(show).join(' + ')} = ${show(S)}$ and $n = ${n}$, so the estimated mean is $${show(S)} \\div ${n} = ${show(answer)}$. Dividing by ${k}, the number of classes, would be the classic error.`,
        markScheme: scheme(slot, [`uses midpoints ${commas(mids)}`, `reaches ${show(S)} and divides by ${n}`], show(answer)),
        answer,
        tolerance: 0.01,
      },
      check: { agrees: Math.abs(viaDoubled - answer) < 1e-9 && Math.abs(expandedMean - answer) < 1e-9 && upperTrap !== answer && rowsTrap !== answer, detail: `doubled midpoints summed from the top: ${viaDoubled}; ${expanded.length} midpoints averaged: ${expandedMean}` },
      values: { task: 'grouped-mean', bounds: bounds.join(','), freqs: freqs.join(','), trap: upperTrap },
    }
  }
}

export const groupedMeanGenerator = bySlot('grouped-mean', GROUPED, { q5: groupedMean('context'), q15: groupedMean('bare') })

export const distributionsGenerators: Generator[] = [
  frequencyDensityGenerator,
  histogramBars,
  histogramSecondBar,
  histogramMedianClass,
  boxPlotMeasures,
  medianAndQuartiles,
  boxPlotShares,
  modalClass,
  cumulativeFrequency,
  groupedMeanGenerator,
]

