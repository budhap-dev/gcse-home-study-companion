import type { Question } from '../../content/questions.ts'
import { fixed, show } from '../format.ts'
import { draw, int, pick, shuffle, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'

/* ------------------------------------------------------------------------------------------
 * Shared helpers for the statistics and distributions generators.
 * ---------------------------------------------------------------------------------------- */

export type Builder = (r: Rng, slot: Question, turn: number) => Draft

/** One generator for several written questions, each slot keeping its own task (as formulae.ts). */
export function bySlot(id: string, topicId: string, builders: Record<string, Builder>): Generator {
  return {
    id,
    subjectId: 'maths',
    topicId,
    replaces: Object.keys(builders),
    build(r, slot, turn) {
      const b = builders[slot.id]
      if (!b) throw new Error(`${id} has no builder for ${slot.id}`)
      return b(r, slot, turn)
    },
  }
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
/** A count as the pack writes it in a sentence: words up to twenty, digits after. */
export const words = (n: number) => NUMBER_WORDS[n] ?? String(n)
export const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)
const ORDINAL_WORDS = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth']
/** 1st, 2nd, 3rd, 11th, 21st. */
export function ordinal(n: number): string {
  const t = n % 100
  if (t >= 11 && t <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}
export const ordinalWord = (n: number) => ORDINAL_WORDS[n] ?? ordinal(n)

/** Whether `x` has at most `dp` decimal places, allowing for binary residue. */
export const places = (x: number, dp: number) => Math.abs(x * 10 ** dp - Math.round(x * 10 ** dp)) < 1e-6
export const total = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0)
export const ascending = (xs: readonly number[]) => [...xs].sort((a, b) => a - b)
export const commas = (xs: readonly number[]) => xs.map(show).join(', ')
export const andList = (items: readonly string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)
export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))

/** The median of a sorted list: the middle value, or halfway between the two middle values. */
export function medianOf(sorted: readonly number[]): number {
  const n = sorted.length
  const h = Math.floor(n / 2)
  return n % 2 ? sorted[h]! : (sorted[h - 1]! + sorted[h]!) / 2
}

/**
 * Quartiles as the pack teaches them (box-plots q6, q8, q15): the medians of the lower and
 * upper halves, leaving the median itself out of both halves when the count is odd.
 */
export function quartilesOf(sorted: readonly number[]): { q1: number; q3: number } {
  const n = sorted.length
  const h = Math.floor(n / 2)
  return { q1: medianOf(sorted.slice(0, h)), q3: medianOf(sorted.slice(n - h)) }
}

/** Second route to a median: strike off the smallest and the largest together until one or two values are left. */
export function medianByStriking(xs: readonly number[]): number {
  let s = ascending(xs)
  while (s.length > 2) s = s.slice(1, -1)
  return s.length === 1 ? s[0]! : (s[0]! + s[1]!) / 2
}

/**
 * Second route to a quartile, by position: each half holds ⌊n/2⌋ values, so the lower
 * quartile sits at position (⌊n/2⌋ + 1)/2 from the bottom, and the upper quartile the same
 * distance from the top. A half-position is the mean of its two neighbours.
 */
export function quartileByPosition(sorted: readonly number[], which: 'lower' | 'upper'): number {
  const n = sorted.length
  const p = (Math.floor(n / 2) + 1) / 2
  const at = (pos: number) => (which === 'lower' ? sorted[pos - 1]! : sorted[n - pos]!)
  return Number.isInteger(p) ? at(p) : (at(Math.floor(p)) + at(Math.ceil(p))) / 2
}

/** Spreads `n` items over `k` rows, each at least 1, heaped round a peak row like real survey data. */
export function spread(r: Rng, n: number, k: number, peak: number): number[] {
  const f = Array.from({ length: k }, () => 1)
  const weights = f.map((_, i) => 1 + 6 * Math.exp(-((i - peak) ** 2) / 1.6) + r())
  const sumW = total(weights)
  for (let left = n - k; left > 0; left--) {
    let u = r() * sumW
    let i = 0
    while (i < k - 1 && u > weights[i]!) u -= weights[i++]!
    f[i] = f[i]! + 1
  }
  return f
}

/** Raw data from a frequency table: each value written out as many times as its frequency. */
export const expand = (values: readonly number[], freqs: readonly number[]) => values.flatMap((v, i) => Array.from({ length: freqs[i]! }, () => v))

/* ------------------------------------------------------------------------------------------
 * Averages and range
 * ---------------------------------------------------------------------------------------- */

const AVERAGES = 'averages-and-range'

interface ListContext {
  /** A noun phrase for the data, with the count in words. */
  phrase: (n: string) => string
  range: [number, number]
  unit: string
}

/** Realistic lists, each with its own range. */
export const LISTS: ListContext[] = [
  { phrase: (n) => `the heights of ${n} sunflower seedlings, in cm,`, range: [8, 46], unit: 'cm' },
  { phrase: (n) => `the times, in minutes, that ${n} students took to get to school`, range: [4, 48], unit: 'minutes' },
  { phrase: (n) => `the scores of ${n} players in a quiz`, range: [6, 40], unit: 'points' },
  { phrase: (n) => `the ages of ${n} people at a climbing wall`, range: [11, 58], unit: 'years' },
  { phrase: (n) => `the masses of ${n} parcels, in kg,`, range: [1, 28], unit: 'kg' },
  { phrase: (n) => `the noon temperatures on ${n} days in April, in °C,`, range: [6, 21], unit: '°C' },
  { phrase: (n) => `the numbers of pages in ${n} library books`, range: [96, 420], unit: 'pages' },
  { phrase: (n) => `the marks of ${n} students in a spelling test out of 50`, range: [12, 50], unit: 'marks' },
  { phrase: (n) => `the numbers of minutes that ${n} buses were late`, range: [1, 25], unit: 'minutes' },
]

const withUnit = (x: number | string, unit: string) => (unit === '°C' ? `${x} °C` : `${x} ${unit}`)

/** `n` whole numbers from the context's range, with at least some spread. */
function drawList(r: Rng, c: ListContext, n: number): number[] {
  return draw(
    r,
    (r) => Array.from({ length: n }, () => int(r, ...c.range)),
    (xs) => Math.max(...xs) - Math.min(...xs) >= Math.max(3, Math.floor((c.range[1] - c.range[0]) / 4)),
  )
}

const isSorted = (xs: readonly number[]) => xs.every((x, i) => i === 0 || xs[i - 1]! <= x)

/** The range of a short list: written as q1 (14, 9, 22, 17, 11; 1 mark). */
const rangeOfList: Builder = (r, slot) => {
  const c = pick(r, LISTS)
  const n = int(r, 5, 8)
  const xs = drawList(r, c, n)
  const hi = Math.max(...xs)
  const lo = Math.min(...xs)
  const answer = hi - lo
  // Second route: the widest gap between any two of the values.
  let widest = 0
  for (const a of xs) for (const b of xs) widest = Math.max(widest, a - b)
  return {
    question: {
      type: 'numeric',
      prompt: `${cap(c.phrase(words(n)))} are ${commas(xs)}. Find the range.`,
      solution: `Largest minus smallest: $${hi} - ${lo} = ${answer}$ ${c.unit}.`,
      markScheme: scheme(slot, [], String(answer)),
      answer,
      tolerance: 0,
      units: c.unit === 'points' || c.unit === 'marks' || c.unit === 'pages' ? undefined : c.unit,
    },
    check: { agrees: widest === answer, detail: `widest gap between any two values: ${widest}` },
    values: { task: 'range', data: xs.join(','), n },
  }
}

/** Halfway between two middle values, as the solution prints it. */
const middleTwo = (a: number, b: number, answer: number) => `$\\dfrac{${show(a)} + ${show(b)}}{2} = ${show(answer)}$`

/**
 * The median of an unsorted list: written as q2 (eight values, 2 marks). The count is odd or
 * even, so the median is sometimes a value and sometimes halfway between two.
 */
const medianOfList: Builder = (r, slot) => {
  const c = pick(r, LISTS)
  const n = int(r, 7, 10)
  const xs = draw(r, (r) => drawList(r, c, n), (xs) => !isSorted(xs))
  const s = ascending(xs)
  const answer = medianOf(s)
  const half = n / 2
  const where = n % 2
    ? `${cap(words(n))} values, so the median is the ${ordinal((n + 1) / 2)}: **${show(answer)}**.`
    : `${cap(words(n))} values, so the median is halfway between the ${ordinal(half)} and ${ordinal(half + 1)}: ${middleTwo(s[half - 1]!, s[half]!, answer)}.`
  const other = medianByStriking(xs)
  return {
    question: {
      type: 'numeric',
      prompt: `${cap(c.phrase(words(n)))} are ${commas(xs)}. Find the median.`,
      solution: `Sort: ${commas(s)}. ${where}`,
      markScheme: scheme(slot, ['orders the values'], show(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: other === answer, detail: `striking off the ends leaves ${show(other)}` },
    values: { task: 'median', data: xs.join(','), n },
  }
}

/**
 * The mode of a list: written as q3 (16 appears twice; 1 mark). One value appears two or
 * three times and every other value once, and the mode is never the median, so the
 * solution's point that the mode is not the middle value holds.
 */
const modeOfList: Builder = (r, slot) => {
  const c = pick(r, LISTS)
  const n = int(r, 6, 9)
  const times = n >= 8 && r() < 0.35 ? 3 : 2
  const pool = Array.from({ length: c.range[1] - c.range[0] + 1 }, (_, i) => c.range[0] + i)
  const { xs, mode } = draw(
    r,
    (r) => {
      const distinct = shuffle(r, pool).slice(0, n - times + 1)
      const mode = distinct[0]!
      return { xs: shuffle(r, [...distinct, ...Array.from({ length: times - 1 }, () => mode)]), mode }
    },
    ({ xs, mode }) => medianOf(ascending(xs)) !== mode,
  )
  // Second route: run lengths in the sorted list, the longest run's value.
  const s = ascending(xs)
  let best = s[0]!
  let bestRun = 0
  for (let i = 0; i < s.length; ) {
    let j = i
    while (j < s.length && s[j] === s[i]) j++
    if (j - i > bestRun) [best, bestRun] = [s[i]!, j - i]
    i = j
  }
  const runs = new Map<number, number>()
  for (const x of xs) runs.set(x, (runs.get(x) ?? 0) + 1)
  const tied = [...runs.values()].filter((k) => k === bestRun).length
  return {
    question: {
      type: 'numeric',
      prompt: `${cap(c.phrase(words(n)))} are ${commas(xs)}. Write down the mode.`,
      solution: `${mode} appears ${times === 2 ? 'twice' : 'three times'} and every other value once, so the mode is **${mode}**. It is the most common value, and it is not the middle of the list.`,
      markScheme: scheme(slot, [], String(mode)),
      answer: mode,
      tolerance: 0,
    },
    check: { agrees: best === mode && bestRun === times && tied === 1, detail: `longest run in the sorted list: ${best} × ${bestRun}` },
    values: { task: 'mode', data: xs.join(','), n },
  }
}

type Transform = 'multiply-add' | 'multiply-subtract' | 'add-multiply'

/**
 * The range after every value is scaled and shifted: written as q17 (× 3 then + 2, 2 marks).
 * The shift never changes the range; the solution says so and the check transforms every value.
 */
const transformedRange: Builder = (r, slot, turn) => {
  const c = pick(r, LISTS)
  const n = int(r, 6, 9)
  const kind = (['multiply-add', 'multiply-subtract', 'add-multiply'] as const)[turn % 3]! as Transform
  const a = pick(r, [2, 3, 4, 5, 10])
  const xs = drawList(r, c, n)
  const lo = Math.min(...xs)
  const hi = Math.max(...xs)
  const R = hi - lo
  const b = kind === 'multiply-subtract' ? int(r, 1, Math.min(9, a * lo)) : int(r, 1, 9)
  const f = (x: number) => (kind === 'multiply-add' ? a * x + b : kind === 'multiply-subtract' ? a * x - b : (x + b) * a)
  const answer = a * R
  const moved = xs.map(f)
  const newRange = Math.max(...moved) - Math.min(...moved)
  const said =
    kind === 'multiply-add' ? `Each value is multiplied by ${a} and then ${b} is added.`
      : kind === 'multiply-subtract' ? `Each value is multiplied by ${a} and then ${b} is subtracted.`
        : `${b} is added to each value and then each is multiplied by ${a}.`
  const shiftWord = kind === 'multiply-subtract' ? `Subtracting ${b} from` : `Adding ${b} to`
  const solution = kind === 'add-multiply'
    ? `${shiftWord} every value moves them all together, so the range is still ${R}. Multiplying by ${a} then multiplies the range: $${a} \\times ${R} = ${answer}$. (Check: the largest becomes $(${hi} + ${b}) \\times ${a} = ${f(hi)}$ and the smallest $(${lo} + ${b}) \\times ${a} = ${f(lo)}$, and $${f(hi)} - ${f(lo)} = ${answer}$.)`
    : `Multiplying by ${a} multiplies the range by ${a}: $${a} \\times ${R} = ${answer}$. ${shiftWord} every value moves them all together, so the range stays ${answer}. (Check: the largest becomes $${a} \\times ${hi} ${kind === 'multiply-add' ? '+' : '-'} ${b} = ${f(hi)}$ and the smallest $${a} \\times ${lo} ${kind === 'multiply-add' ? '+' : '-'} ${b} = ${f(lo)}$, and $${f(hi)} - ${f(lo)} = ${answer}$.)`
  return {
    question: {
      type: 'numeric',
      prompt: `${cap(c.phrase(words(n)))} are ${commas(xs)}. The range is ${withUnit(R, c.unit)}. ${said} What is the range of the new values?`,
      solution,
      markScheme: scheme(slot, [`multiplies the range by ${a}`], `${answer}, with the ${kind === 'multiply-subtract' ? '−' : '+'} ${b} having no effect`),
      answer,
      tolerance: 0,
    },
    check: { agrees: newRange === answer && answer !== a * R + b, detail: `every value transformed: range ${newRange}; the slip a × R + b would be ${a * R + b}` },
    values: { task: 'transformed-range', kind, data: xs.join(','), a, b, range: R },
  }
}

export const averagesOfAList = bySlot('averages-of-a-list', AVERAGES, { q1: rangeOfList, q2: medianOfList, q3: modeOfList, q17: transformedRange })

interface CategoryItem {
  name: string
  accepted: string[]
  /** The clause for a frequency: "12 students have brown eyes". */
  clause: (f: number) => string
}
interface CategorySurvey {
  intro: string
  question: string
  /** What the answer is, for "the answer is the colour, not the 12". */
  noun: string
  people: string
  items: CategoryItem[]
}

const SURVEYS: CategorySurvey[] = [
  {
    intro: 'In a class survey of eye colour,',
    question: 'What is the modal eye colour?',
    noun: 'colour',
    people: 'students',
    items: ['brown', 'blue', 'green', 'hazel', 'grey'].map((c) => ({ name: c, accepted: c === 'grey' ? [c, 'grey eyes', 'gray', 'gray eyes'] : [c, `${c} eyes`], clause: (f: number) => `${f} students have ${c} eyes` })),
  },
  {
    intro: 'Students were asked how they travel to school:',
    question: 'What is the modal way of travelling?',
    noun: 'way of travelling',
    people: 'students',
    items: [
      { name: 'walk', accepted: ['walk', 'walking', 'on foot'], clause: (f) => `${f} walk` },
      { name: 'bus', accepted: ['bus', 'by bus', 'the bus'], clause: (f) => `${f} come by bus` },
      { name: 'car', accepted: ['car', 'by car'], clause: (f) => `${f} come by car` },
      { name: 'cycle', accepted: ['cycle', 'cycling', 'bike', 'by bike', 'bicycle'], clause: (f) => `${f} cycle` },
      { name: 'train', accepted: ['train', 'by train', 'the train'], clause: (f) => `${f} come by train` },
    ],
  },
  {
    intro: 'In a survey of favourite fruit,',
    question: 'What is the modal fruit?',
    noun: 'fruit',
    people: 'people',
    items: [
      ['apple', 'apples'],
      ['banana', 'bananas'],
      ['orange', 'oranges'],
      ['grape', 'grapes'],
      ['strawberry', 'strawberries'],
    ].map(([one, many]) => ({ name: one!, accepted: [one!, many!], clause: (f: number) => `${f} people chose ${many}` })),
  },
  {
    intro: 'A survey recorded the colour of each car in a car park:',
    question: 'What is the modal colour?',
    noun: 'colour',
    people: 'cars',
    items: ['silver', 'black', 'white', 'red', 'blue'].map((c) => ({ name: c, accepted: [c], clause: (f: number) => `${f} cars were ${c}` })),
  },
  {
    intro: 'Students named their favourite sport to watch:',
    question: 'What is the modal sport?',
    noun: 'sport',
    people: 'students',
    items: ['football', 'tennis', 'netball', 'cricket', 'rugby'].map((c) => ({ name: c, accepted: [c], clause: (f: number) => `${f} chose ${c}` })),
  },
  {
    intro: 'A vet recorded the animals she saw one week:',
    question: 'Which animal is the mode?',
    noun: 'animal',
    people: 'animals',
    items: [
      ['dog', 'dogs'],
      ['cat', 'cats'],
      ['rabbit', 'rabbits'],
      ['guinea pig', 'guinea pigs'],
      ['horse', 'horses'],
    ].map(([one, many]) => ({ name: one!, accepted: [one!, many!], clause: (f: number) => `${f} were ${many}` })),
  },
]

/**
 * The modal category: written as q4 (eye colours, 1 mark). The answer is the category,
 * never its frequency; frequencies are drawn until one is clearly the highest.
 */
export const modalCategory: Generator = {
  id: 'modal-category',
  subjectId: 'maths',
  topicId: AVERAGES,
  replaces: ['q4'],
  build(r, slot): Draft {
    const s = pick(r, SURVEYS)
    const k = int(r, 4, 5)
    const items = shuffle(r, s.items).slice(0, k)
    const freqs = draw(
      r,
      (r) => items.map(() => int(r, 2, 19)),
      (f) => f.filter((x) => x === Math.max(...f)).length === 1,
    )
    const top = freqs.indexOf(Math.max(...freqs))
    const answer = items[top]!
    // Second route: write the survey out one response at a time, then count.
    const raw = items.flatMap((it, i) => Array.from({ length: freqs[i]! }, () => it.name))
    const counts = new Map<string, number>()
    for (const x of raw) counts.set(x, (counts.get(x) ?? 0) + 1)
    const most = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!
    const clauses = items.map((it, i) => it.clause(freqs[i]!))
    return {
      question: {
        type: 'short-text',
        prompt: `${s.intro} ${andList(clauses)}. ${s.question}`,
        solution: `The mode is the category with the highest frequency: **${answer.name}**, with ${freqs[top]} ${s.people}. The answer is the ${s.noun}, not the ${freqs[top]}.`,
        markScheme: scheme(slot, [], answer.name),
        accepted: answer.accepted,
      },
      check: { agrees: most[0] === answer.name && !answer.accepted.includes(String(freqs[top])), detail: `counted one response at a time: ${most[0]} × ${most[1]}` },
      values: { categories: items.map((i) => i.name).join(','), freqs: freqs.join(','), answer: answer.name },
    }
  },
}

interface FreqTable {
  intro: (n: number) => string
  values: number[]
  label: (v: number) => string
  /** "the mean number of people per household" without the article. */
  ask: string
  unit: string
  /** Who the total belongs to: "households". */
  who: string
  peak: number
}

const TABLES: FreqTable[] = [
  { intro: (n) => `A survey of ${n} households recorded how many people live in each.`, values: [1, 2, 3, 4, 5], label: (v) => (v === 1 ? '1 person' : `${v} people`), ask: 'number of people per household', unit: 'people', who: 'households', peak: 1 },
  { intro: (n) => `${n} students were asked how many pets they have.`, values: [0, 1, 2, 3, 4], label: (v) => (v === 1 ? '1 pet' : `${v} pets`), ask: 'number of pets per student', unit: 'pets', who: 'students', peak: 1 },
  { intro: (n) => `A football team recorded how many goals it scored in each of ${n} matches.`, values: [0, 1, 2, 3, 4], label: (v) => (v === 1 ? '1 goal' : `${v} goals`), ask: 'number of goals per match', unit: 'goals', who: 'matches', peak: 1.3 },
  { intro: (n) => `${n} students were asked how many brothers and sisters they have.`, values: [0, 1, 2, 3, 4], label: (v) => (v === 1 ? '1 brother or sister' : `${v} brothers and sisters`), ask: 'number of brothers and sisters', unit: '', who: 'students', peak: 1 },
  { intro: (n) => `A café recorded how many drinks each of ${n} customers bought.`, values: [1, 2, 3, 4, 5], label: (v) => (v === 1 ? '1 drink' : `${v} drinks`), ask: 'number of drinks per customer', unit: 'drinks', who: 'customers', peak: 0.8 },
  { intro: (n) => `${n} people were asked how many times they went to the cinema last month.`, values: [0, 1, 2, 3, 4], label: (v) => (v === 1 ? '1 time' : `${v} times`), ask: 'number of cinema trips', unit: '', who: 'people', peak: 1.2 },
]

const tableText = (t: FreqTable, freqs: readonly number[]) => t.values.map((v, i) => `${t.label(v)}: frequency ${freqs[i]}`).join('; ')

/**
 * The mean from a frequency table: written as q6 (households, 20 values, 3 marks). The total
 * is 20, 25, 40 or 50 so the mean is exact; the check writes the table out as raw data.
 */
const tableMean: Builder = (r, slot) => {
  const t = pick(r, TABLES)
  const { n, freqs } = draw(
    r,
    (r) => {
      const n = pick(r, [20, 25, 40, 50])
      return { n, freqs: spread(r, n, t.values.length, t.peak) }
    },
    ({ n, freqs }) => places(total(t.values.map((v, i) => v * freqs[i]!)) / n, 2),
  )
  const products = t.values.map((v, i) => v * freqs[i]!)
  const S = total(products)
  const mean = Number(show(S / n))
  const rows = t.values.length
  const trap = Number(show(S / rows))
  const raw = expand(t.values, freqs)
  const rawMean = total(raw) / raw.length
  return {
    question: {
      type: 'numeric',
      prompt: `${t.intro(n)} ${tableText(t, freqs)}. Find the mean ${t.ask}.`,
      solution: `Value × frequency: ${products.join(', ')}, total ${S}. Mean $= ${S} \\div ${n} = ${show(mean)}$${t.unit ? ` ${t.unit}` : ''}. Dividing by ${rows}, the number of rows, would give ${show(trap)}: the total belongs to all ${n} ${t.who}, not to ${rows} rows.`,
      markScheme: scheme(slot, [`finds the total ${S}`, `divides by ${n}`], show(mean)),
      answer: mean,
      tolerance: 0,
    },
    check: { agrees: Math.abs(rawMean - mean) < 1e-9 && trap !== mean, detail: `${raw.length} raw values averaged: ${rawMean}` },
    values: { task: 'mean', values: t.values.join(','), freqs: freqs.join(','), n, trap },
  }
}

/**
 * The median from a frequency table: written as q7 (households, 20 values, 2 marks). The
 * count is odd or even, and the two middle values may fall in different rows; the middle
 * row of the table is never the answer, so the solution's warning about it holds.
 */
const tableMedian: Builder = (r, slot) => {
  const t = pick(r, TABLES)
  const { n, freqs } = draw(
    r,
    (r) => {
      const n = int(r, 15, 41)
      return { n, freqs: spread(r, n, t.values.length, t.peak) }
    },
    ({ freqs }) => medianOf(expand(t.values, freqs)) !== t.values[Math.floor(t.values.length / 2)],
  )
  const running: number[] = []
  freqs.reduce((acc, f) => (running.push(acc + f), acc + f), 0)
  const rowOf = (pos: number) => running.findIndex((c) => c >= pos)
  const odd = n % 2 === 1
  const p1 = odd ? (n + 1) / 2 : n / 2
  const p2 = odd ? p1 : p1 + 1
  const r1 = rowOf(p1)
  const r2 = rowOf(p2)
  const answer = (t.values[r1]! + t.values[r2]!) / 2
  const shown = running.slice(0, r2 + 1)
  const runText = shown.length === 1 ? `${shown[0]}` : `${shown.slice(0, -1).join(', ')}, then ${shown[shown.length - 1]}`
  const rowName = (i: number) => `the row for ${t.label(t.values[i]!)}`
  const middle = t.values[Math.floor(t.values.length / 2)]!
  const where = odd
    ? `There are ${n} values, so the median is the ${ordinal(p1)}. Running totals: ${runText}. The ${ordinal(p1)} value lies in ${rowName(r1)}, so the median is **${show(answer)}**.`
    : r1 === r2
      ? `There are ${n} values, so the median is halfway between the ${ordinal(p1)} and the ${ordinal(p2)}. Running totals: ${runText}. The ${ordinal(p1)} and ${ordinal(p2)} values both lie in ${rowName(r1)}, so the median is **${show(answer)}**.`
      : `There are ${n} values, so the median is halfway between the ${ordinal(p1)} and the ${ordinal(p2)}. Running totals: ${runText}. The ${ordinal(p1)} value is the last in ${rowName(r1)} and the ${ordinal(p2)} is the first in ${rowName(r2)}, so the median is ${middleTwo(t.values[r1]!, t.values[r2]!, answer)}.`
  const sorted = ascending(expand(t.values, freqs))
  const other = medianByStriking(sorted)
  return {
    question: {
      type: 'numeric',
      prompt: `${t.intro(n)} ${tableText(t, freqs)}. Find the median ${t.ask}.`,
      solution: `${where} The middle row of the table, ${middle}, is not the median.`,
      markScheme: scheme(slot, [`uses running totals to locate the ${odd ? `${ordinal(p1)} value` : `${ordinal(p1)} and ${ordinal(p2)} values`}`], show(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: other === answer && answer !== middle, detail: `the ${n} values written out and struck off from both ends: ${show(other)}` },
    values: { task: 'median', values: t.values.join(','), freqs: freqs.join(','), n },
  }
}

const VALUE_SETS = [[0, 1, 2, 3], [1, 2, 3, 4], [0, 1, 2, 3, 4], [1, 2, 3, 4, 5]]

/** `v` times x as the pack writes it: x, 2x. */
const timesX = (v: number) => (v === 1 ? 'x' : `${v}x`)

/**
 * A missing frequency from a given mean: written as q13 (values 0–3, frequencies 4, 7, x, 2,
 * mean 1.5; 3 marks). The mean has one decimal place, worked in tenths so 1.5 × 13 has no
 * residue; the check puts x back into the table and averages the raw data.
 */
const missingFrequency: Builder = (r, slot) => {
  const values = pick(r, VALUE_SETS)
  const { j, freqs, x, tenths } = draw(
    r,
    (r) => {
      const j = int(r, values[0] === 0 ? 1 : 0, values.length - 1)
      const freqs = values.map(() => int(r, 1, 12))
      const x = int(r, 2, 24)
      const all = freqs.map((f, i) => (i === j ? x : f))
      const sum10 = 10 * total(values.map((v, i) => v * all[i]!))
      const count = total(all)
      return { j, freqs, x, tenths: sum10 % count === 0 ? sum10 / count : NaN }
    },
    ({ j, tenths }) => Number.isInteger(tenths) && tenths % 10 !== 0 && tenths !== 10 * values[j]!,
  )
  const v = values[j]!
  const M = tenths / 10
  const known = values.map((val, i) => (i === j ? null : [val, freqs[i]!] as const))
  const S = total(known.map((k) => (k ? k[0] * k[1] : 0)))
  const F = total(known.map((k) => (k ? k[1] : 0)))
  const terms = values.map((val, i) => (i === j ? timesX(v) : `${val} \\times ${freqs[i]}`))
  const MF = Number(show(M * F))
  const coef = Number(show(Math.abs(v - M)))
  const rhs = Number(show(Math.abs(MF - S)))
  const freqText = values.map((_, i) => (i === j ? '$x$' : String(freqs[i])))
  const sumSide = `${S} + ${timesX(v)}`
  // Second route: put x back in, write the table out as raw data and average it, in tenths.
  const raw = expand(values, freqs.map((f, i) => (i === j ? x : f)))
  const back = (10 * total(raw)) / raw.length
  return {
    question: {
      type: 'numeric',
      prompt: `A frequency table has values ${andList(values.map(String))} with frequencies ${andList(freqText)}. The mean of the data is ${show(M)}. Find $x$.`,
      solution: `Total $= ${terms.join(' + ')} = ${sumSide}$. Total frequency $= ${F} + x$. So $${sumSide} = ${show(M)}(${F} + x) = ${show(MF)} + ${show(M)}x$, giving $${coef === 1 ? '' : show(coef)}x = ${show(rhs)}$ and $x = ${x}$.`,
      markScheme: scheme(slot, [`total of values ${sumSide}`, `forms ${sumSide} = ${show(M)}(${F} + x)`], String(x)),
      answer: x,
      tolerance: 0,
    },
    check: { agrees: back === tenths && Math.abs(rhs / coef - x) < 1e-9, detail: `x = ${x} back in the table: ${raw.length} values, mean ${back / 10}` },
    values: { task: 'missing-frequency', values: values.join(','), freqs: freqs.map((f, i) => (i === j ? x : f)).join(','), at: j, mean: show(M) },
  }
}

export const frequencyTableAverages = bySlot('frequency-table-averages', AVERAGES, { q6: tableMean, q7: tableMedian, q13: missingFrequency })

/**
 * `n` whole numbers in [lo, hi] with a given whole-number mean, for a second route by
 * substitution: start with every value at the mean, then move random amounts from one value
 * to another, which keeps the total. Never fails while the mean lies in the range.
 */
export function listWithMean(r: Rng, n: number, mean: number, lo: number, hi: number): number[] {
  const xs = Array.from({ length: n }, () => mean)
  const step = Math.max(1, Math.floor((hi - lo) / 4))
  for (let s = 0; s < n * 4; s++) {
    const i = int(r, 0, n - 1)
    const j = int(r, 0, n - 1)
    const d = int(r, 1, step)
    if (i !== j && xs[i]! + d <= hi && xs[j]! - d >= lo) {
      xs[i] = xs[i]! + d
      xs[j] = xs[j]! - d
    }
  }
  return xs
}

interface MeanGroup {
  range: [number, number]
  added: (n: number, m1: number, m2: number) => string
  removed: (n: number, m1: number, m2: number) => string
  unit: string
  /** "The sixth number is" / "The new player's age is". */
  addedIs: (n: number) => string
  removedIs: string
}

const MEAN_GROUPS: MeanGroup[] = [
  {
    range: [1, 60],
    added: (n, m1, m2) => `The mean of ${n} numbers is ${m1}. A ${ordinalWord(n + 1)} number is added and the mean of all ${words(n + 1)} numbers becomes ${m2}. Find the ${ordinalWord(n + 1)} number.`,
    removed: (n, m1, m2) => `The mean of ${words(n)} numbers is ${m1}. One of the numbers is removed, and the mean of the remaining ${words(n - 1)} is ${m2}. What number was removed?`,
    unit: '',
    addedIs: (n) => `The ${ordinalWord(n + 1)} number is`,
    removedIs: 'The removed number is',
  },
  {
    range: [16, 40],
    added: (n, m1, m2) => `The ${words(n)} players in a squad have a mean age of ${m1} years. Another player joins, and the mean age of all ${words(n + 1)} becomes ${m2} years. How old is the new player?`,
    removed: (n, m1, m2) => `The ${words(n)} players in a squad have a mean age of ${m1} years. One player leaves, and the mean age of the other ${words(n - 1)} is ${m2} years. How old is the player who left?`,
    unit: 'years',
    addedIs: () => `The new player is`,
    removedIs: 'The player who left is',
  },
  {
    range: [2, 30],
    added: (n, m1, m2) => `${cap(words(n))} parcels have a mean mass of ${m1} kg. Another parcel is added, and the mean mass of all ${words(n + 1)} becomes ${m2} kg. What is the mass of the new parcel?`,
    removed: (n, m1, m2) => `${cap(words(n))} parcels have a mean mass of ${m1} kg. One parcel is taken away, and the mean mass of the other ${words(n - 1)} is ${m2} kg. What is the mass of the parcel taken away?`,
    unit: 'kg',
    addedIs: () => `The new parcel's mass is`,
    removedIs: `The parcel taken away has mass`,
  },
  {
    range: [30, 100],
    added: (n, m1, m2) => `Sam's mean mark in ${words(n)} tests is ${m1}. After a ${ordinalWord(n + 1)} test, the mean of all ${words(n + 1)} marks is ${m2}. What did Sam score in the ${ordinalWord(n + 1)} test?`,
    removed: (n, m1, m2) => `Sam's mean mark in ${words(n)} tests is ${m1}. The teacher removes one test, and the mean of the other ${words(n - 1)} marks is ${m2}. What did Sam score in the test that was removed?`,
    unit: 'marks',
    addedIs: (n) => `Sam's ${ordinalWord(n + 1)} mark is`,
    removedIs: 'The removed mark is',
  },
  {
    range: [18, 60],
    added: (n, m1, m2) => `A runner's mean time for ${words(n)} park runs is ${m1} minutes. After a ${ordinalWord(n + 1)} run, the mean of all ${words(n + 1)} times is ${m2} minutes. How long did the ${ordinalWord(n + 1)} run take?`,
    removed: (n, m1, m2) => `A runner's mean time for ${words(n)} park runs is ${m1} minutes. One run is left out, and the mean of the other ${words(n - 1)} is ${m2} minutes. How long did the run that was left out take?`,
    unit: 'minutes',
    addedIs: (n) => `The ${ordinalWord(n + 1)} run took`,
    removedIs: 'The run left out took',
  },
]

/**
 * A value added to a set with a known mean: written as q8 (mean of 5 is 8, of 6 is 9; 2
 * marks). The check builds a real list with the first mean, adds the answer and averages.
 */
const meanAfterAdding: Builder = (r, slot) => {
  const g = pick(r, MEAN_GROUPS)
  const [lo, hi] = g.range
  const { n, m1, m2, x } = draw(
    r,
    (r) => {
      const n = int(r, 3, 9)
      const m1 = int(r, lo + 2, hi - 2)
      const m2 = m1 + pick(r, [-3, -2, -1, 1, 2, 3])
      return { n, m1, m2, x: (n + 1) * m2 - n * m1 }
    },
    ({ m2, x }) => x >= lo && x <= hi && x !== m2,
  )
  const T1 = n * m1
  const T2 = (n + 1) * m2
  const list = [...listWithMean(r, n, m1, lo, hi), x]
  const mean = total(list) / list.length
  const unit = g.unit ? ` ${g.unit}` : ''
  return {
    question: {
      type: 'numeric',
      prompt: g.added(n, m1, m2),
      solution: `Totals: $${n} \\times ${m1} = ${T1}$ and $${n + 1} \\times ${m2} = ${T2}$. ${g.addedIs(n)} $${T2} - ${T1} = ${x}$${unit}.`,
      markScheme: scheme(slot, [`finds ${T1} or ${T2}`], String(x)),
      answer: x,
      tolerance: 0,
    },
    check: { agrees: mean === m2, detail: `${list.join(', ')} has mean ${mean}` },
    values: { task: 'added', n, m1, m2, list: list.join(',') },
  }
}

/** A value removed from a set with a known mean: written as q15 (mean of 4 is 15, of 3 is 13; 2 marks). */
const meanAfterRemoving: Builder = (r, slot) => {
  const g = pick(r, MEAN_GROUPS)
  const [lo, hi] = g.range
  const { n, m1, m2, x } = draw(
    r,
    (r) => {
      const n = int(r, 4, 9)
      const m2 = int(r, lo + 2, hi - 2)
      const m1 = m2 + pick(r, [-3, -2, -1, 1, 2, 3])
      return { n, m1, m2, x: n * m1 - (n - 1) * m2 }
    },
    ({ m1, x }) => x >= lo && x <= hi && x !== m1,
  )
  const T1 = n * m1
  const T2 = (n - 1) * m2
  const rest = listWithMean(r, n - 1, m2, lo, hi)
  const list = [...rest, x]
  const mean = total(list) / list.length
  const unit = g.unit ? ` ${g.unit}` : ''
  return {
    question: {
      type: 'numeric',
      prompt: g.removed(n, m1, m2),
      solution: `Totals: $${n} \\times ${m1} = ${T1}$ and $${n - 1} \\times ${m2} = ${T2}$. ${g.removedIs} $${T1} - ${T2} = ${x}$${unit}.`,
      markScheme: scheme(slot, [`finds ${T1} and ${T2}`], String(x)),
      answer: x,
      tolerance: 0,
    },
    check: { agrees: mean === m1, detail: `${list.join(', ')} has mean ${mean}; without ${x}, ${rest.join(', ')}` },
    values: { task: 'removed', n, m1, m2, list: list.join(',') },
  }
}

interface TwoGroups {
  prompt: (n1: number, m1: number, n2: number, m2: number) => string
  sizes: [number, number]
  means: [number, number]
  unit: string
}

const TWO_GROUPS: TwoGroups[] = [
  { prompt: (n1, m1, n2, m2) => `A class of ${n1} students has a mean test mark of ${m1}. A class of ${n2} students has a mean of ${m2}. Find the mean mark of all ${n1 + n2} students.`, sizes: [14, 32], means: [40, 85], unit: '' },
  { prompt: (n1, m1, n2, m2) => `A box of ${n1} apples has a mean mass of ${m1} g. A box of ${n2} apples has a mean mass of ${m2} g. Find the mean mass of all ${n1 + n2} apples.`, sizes: [10, 40], means: [120, 180], unit: 'g' },
  { prompt: (n1, m1, n2, m2) => `On Monday ${n1} visitors to a museum stayed for a mean of ${m1} minutes. On Tuesday ${n2} visitors stayed for a mean of ${m2} minutes. Find the mean time for all ${n1 + n2} visitors.`, sizes: [20, 80], means: [35, 120], unit: 'minutes' },
  { prompt: (n1, m1, n2, m2) => `A netball squad of ${n1} players has a mean height of ${m1} cm. A basketball squad of ${n2} players has a mean height of ${m2} cm. Find the mean height of all ${n1 + n2} players.`, sizes: [8, 16], means: [160, 196], unit: 'cm' },
  { prompt: (n1, m1, n2, m2) => `${n1} people in a running club ran a mean of ${m1} km last week. Another ${n2} people ran a mean of ${m2} km. Find the mean distance for all ${n1 + n2} people.`, sizes: [6, 30], means: [8, 45], unit: 'km' },
]

/**
 * The mean of two groups together: written as q10 (20 at 64 and 30 at 74; 3 marks). The
 * groups differ in size, so averaging the two means is always wrong; the check builds both
 * groups as real lists and averages the lot.
 */
const combinedMean: Builder = (r, slot) => {
  const g = pick(r, TWO_GROUPS)
  const { n1, m1, n2, m2 } = draw(
    r,
    (r) => ({ n1: int(r, ...g.sizes), m1: int(r, ...g.means), n2: int(r, ...g.sizes), m2: int(r, ...g.means) }),
    ({ n1, m1, n2, m2 }) => n1 !== n2 && Math.abs(m1 - m2) >= 3 && places((n1 * m1 + n2 * m2) / (n1 + n2), 2),
  )
  const T1 = n1 * m1
  const T2 = n2 * m2
  const N = n1 + n2
  const answer = Number(show((T1 + T2) / N))
  const trap = (m1 + m2) / 2
  const spreadOf = Math.max(3, Math.round((g.means[1] - g.means[0]) / 3))
  const a = listWithMean(r, n1, m1, m1 - spreadOf, m1 + spreadOf)
  const b = listWithMean(r, n2, m2, m2 - spreadOf, m2 + spreadOf)
  const all = [...a, ...b]
  const mean = total(all) / all.length
  const unit = g.unit ? ` ${g.unit}` : ''
  return {
    question: {
      type: 'numeric',
      prompt: g.prompt(n1, m1, n2, m2),
      solution: `Totals: $${n1} \\times ${m1} = ${T1}$ and $${n2} \\times ${m2} = ${T2}$. Mean $= \\dfrac{${T1} + ${T2}}{${N}} = \\dfrac{${T1 + T2}}{${N}} = ${show(answer)}$${unit}. Averaging the two means gives ${show(trap)}, which ignores the groups being different sizes.`,
      markScheme: scheme(slot, ['finds both totals', `adds the totals and divides by ${N}`], show(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: Math.abs(mean - answer) < 1e-9 && Math.abs(trap - answer) > 1e-9, detail: `${all.length} values built from both groups average ${mean}` },
    values: { task: 'combined', n1, m1, n2, m2, trap },
  }
}

export const meansFromTotals = bySlot('means-from-totals', AVERAGES, { q8: meanAfterAdding, q10: combinedMean, q15: meanAfterRemoving })

/** Every sorted list of five positive whole numbers with these statistics, by search. */
export function fiveNumberSearch(stats: { mode: number; median: number; mean: number; range: number }): number[][] {
  const { mode, median, mean, range } = stats
  const found: number[][] = []
  for (let a = 1; a <= median; a++) {
    const e = a + range
    if (e < median) continue
    for (let b = a; b <= median; b++) {
      for (let d = median; d <= e; d++) {
        const xs = [a, b, median, d, e]
        if (total(xs) !== 5 * mean) continue
        const counts = new Map<number, number>()
        for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1)
        const top = Math.max(...counts.values())
        const modes = [...counts.entries()].filter(([, c]) => c === top).map(([v]) => v)
        if (top >= 2 && modes.length === 1 && modes[0] === mode) found.push(xs)
      }
    }
  }
  return found
}

const PUZZLE_LEADS = ['Five positive whole numbers have', 'Five cards each show a positive whole number. The numbers have', 'The ages, in whole years, of five people at a party have']

/**
 * Five numbers from their mode, median, mean and range: written as q12 (mode 3, median 4,
 * mean 5, range 7; 3 marks). The mode is the repeated pair at the bottom (ask for the
 * largest) or at the top (ask for the smallest), by turn. The check searches every list
 * of five positive whole numbers with the four statistics and finds exactly one.
 */
export const averagesPuzzle: Generator = {
  id: 'averages-puzzle',
  subjectId: 'maths',
  topicId: AVERAGES,
  replaces: ['q12'],
  build(r, slot, turn): Draft {
    const low = turn % 2 === 0
    const xs = draw(
      r,
      (r) => {
        if (low) {
          const a = int(r, 1, 9)
          const m = a + int(r, 1, 5)
          const d = m + int(r, 1, 6)
          const e = d + int(r, 1, 8)
          return [a, a, m, d, e]
        }
        const s = int(r, 1, 8)
        const b = s + int(r, 1, 5)
        const m = b + int(r, 1, 5)
        const d = m + int(r, 1, 7)
        return [s, b, m, d, d]
      },
      (xs) => total(xs) % 5 === 0,
    )
    const [x1, x2, m, x4, x5] = xs as [number, number, number, number, number]
    const mean = total(xs) / 5
    const R = x5 - x1
    const mode = low ? x1 : x5
    const T = 5 * mean
    const found = fiveNumberSearch({ mode, median: m, mean, range: R })
    const answer = low ? x5 : x1
    const lead = pick(r, PUZZLE_LEADS)
    const solution = low
      ? `In order: ?, ?, ${m}, ?, ?. The mode ${mode} must appear at least twice, and it is smaller than the median, so the first two are ${mode} and ${mode}. Range ${R} makes the largest $${mode} + ${R} = ${answer}$. (The total must be $5 \\times ${mean} = ${T}$, so the fourth is $${T} - ${mode} - ${mode} - ${m} - ${answer} = ${x4}$, giving ${xs.join(', ')}.)`
      : `In order: ?, ?, ${m}, ?, ?. The mode ${mode} must appear at least twice, and it is bigger than the median, so the last two are ${mode} and ${mode}. Range ${R} makes the smallest $${mode} - ${R} = ${answer}$. (The total must be $5 \\times ${mean} = ${T}$, so the second is $${T} - ${answer} - ${m} - ${mode} - ${mode} = ${x2}$, giving ${xs.join(', ')}.)`
    return {
      question: {
        type: 'numeric',
        prompt: `${lead} a mode of ${mode}, a median of ${m}, a mean of ${mean} and a range of ${R}. Find the ${low ? 'largest' : 'smallest'} of the five numbers.`,
        solution,
        markScheme: scheme(
          slot,
          low ? [`places the median in the middle and the mode ${mode}, ${mode} at the start`, 'uses the range from the smallest value'] : [`places the median in the middle and the mode ${mode}, ${mode} at the end`, 'uses the range from the largest value'],
          String(answer),
        ),
        answer,
        tolerance: 0,
      },
      check: { agrees: found.length === 1 && (low ? found[0]![4] : found[0]![0]) === answer, detail: `search found ${found.map((f) => f.join(',')).join(' | ') || 'nothing'}` },
      values: { modeAt: low ? 'bottom' : 'top', data: xs.join(','), mode, median: m, mean, range: R },
    }
  },
}

/* ------------------------------------------------------------------------------------------
 * Charts and diagrams for data
 * ---------------------------------------------------------------------------------------- */

const CHARTS = 'charts-and-diagrams-for-data'

/** Totals that share 360° into whole degrees per person. */
const PIE_TOTALS = [18, 20, 24, 30, 36, 40, 45, 60, 72, 90, 120, 180]

interface PieSurvey {
  ask: (N: number) => string
  /** The categories; the first is the one asked about in the angle questions. */
  sectors: string[]
  person: string
  /** The sentence giving the asked category's count. */
  count: (f: number, sector: string) => string
}

const PIE_SURVEYS: PieSurvey[] = [
  { ask: (N) => `${N} students were asked how they travel to school.`, sectors: ['Walk', 'Bus', 'Car', 'Cycle'], person: 'student', count: (f) => `${f} of them walk.` },
  { ask: (N) => `In a survey of ${N} people,`, sectors: ['rugby', 'football', 'tennis', 'cricket'], person: 'person', count: (f, s) => `${f} chose ${s} as their favourite sport.` },
  { ask: (N) => `${N} people were asked their favourite flavour of crisps.`, sectors: ['salt and vinegar', 'cheese and onion', 'ready salted', 'prawn cocktail'], person: 'person', count: (f, s) => `${f} chose ${s}.` },
  { ask: (N) => `A garden centre sold ${N} plants on Saturday.`, sectors: ['rose', 'fern', 'herb', 'cactus'], person: 'plant', count: (f, s) => `${f} of them were ${s}s.` },
  { ask: (N) => `${N} pet owners were asked what pet they have.`, sectors: ['cat', 'dog', 'rabbit', 'fish'], person: 'owner', count: (f, s) => `${f} of them have a ${s}.` },
]

/** Splits `left` into `k` parts, each at least 1. */
function splitInto(r: Rng, left: number, k: number): number[] {
  const cuts = shuffle(r, Array.from({ length: left - 1 }, (_, i) => i + 1)).slice(0, k - 1).sort((a, b) => a - b)
  return [...cuts, left].map((c, i, all) => c - (i === 0 ? 0 : all[i - 1]!))
}

/** An angle as an exact fraction of 360, by cancelling the fraction first: the second route. */
const angleByFraction = (f: number, N: number) => {
  const g = gcd(f, N)
  return ((f / g) * 360) / (N / g)
}

/**
 * The angle of one sector: written as q2 (21 of 60 walk; 2 marks) and q6 (11 of 40 chose
 * rugby; 2 marks). The whole pie is built, every sector's angle found, and they add to 360°.
 */
const sectorAngle: Builder = (r, slot) => {
  const s = pick(r, PIE_SURVEYS)
  const N = pick(r, slot.id === 'q2' ? PIE_TOTALS.filter((n) => n >= 20) : PIE_TOTALS)
  const k = int(r, 3, 4)
  const counts = draw(r, (r) => splitInto(r, N, k), (c) => c.every((x) => x >= 2))
  const f = counts[0]!
  const per = 360 / N
  const answer = f * per
  const angles = counts.map((c) => angleByFraction(c, N))
  const sector = s.sectors[0]!
  const each = `Each ${s.person} gets $360 \\div ${N} = ${per}°$, so ${sector} is $${f} \\times ${per} = ${answer}°$.`
  return {
    question: {
      type: 'numeric',
      prompt: `${s.ask(N)} ${s.count(f, sector)} What angle is the ${sector} sector of a pie chart?`,
      solution: slot.id === 'q2' ? `${each} Using the frequency, ${f}, as the angle is the usual slip.` : each,
      markScheme: scheme(slot, [slot.id === 'q2' ? `360 ÷ ${N} or ${f}/${N} × 360` : `${f}/${N} × 360`], `${answer}°`),
      answer,
      tolerance: 0,
      units: '°',
    },
    check: { agrees: angles[0] === answer && total(angles) === 360 && answer !== f, detail: `every sector: ${angles.join(' + ')} = ${total(angles)}` },
    values: { task: 'angle', N, freqs: counts.join(','), angles: angles.join(',') },
  }
}

const DIVISORS_OF_360 = [10, 12, 15, 18, 20, 24, 30, 36, 40, 45, 60, 72, 90, 120]

const TOTAL_SURVEYS: { what: string; sector: string; who: string }[] = [
  { what: 'favourite sports', sector: 'Tennis', who: 'people' },
  { what: 'favourite crisps', sector: 'Cheese and onion', who: 'people' },
  { what: 'how students travel to school', sector: 'Bus', who: 'students' },
  { what: 'pets owned', sector: 'Cat', who: 'owners' },
  { what: 'favourite school subjects', sector: 'Art', who: 'students' },
  { what: 'breakfast cereals bought', sector: 'Porridge', who: 'shoppers' },
]

/**
 * The size of a survey from one sector: written as q12 (Tennis 40° is 18 people; 2 marks).
 * The sector's angle divides 360, as in the written question. The check puts the total back.
 */
const surveyTotal: Builder = (r, slot) => {
  const s = pick(r, TOTAL_SURVEYS)
  const theta = pick(r, DIVISORS_OF_360)
  const f = int(r, 4, 40)
  const k = 360 / theta
  const answer = k * f
  return {
    question: {
      type: 'numeric',
      prompt: `In a pie chart of ${s.what}, the ${s.sector} sector has an angle of ${theta}° and represents ${f} ${s.who}. How many ${s.who} were surveyed altogether?`,
      solution: `${theta}° goes into 360° $\\dfrac{360}{${theta}} = ${k}$ times, so the whole survey is $${k} \\times ${f} = ${answer}$ ${s.who}. Equivalently, each of the ${f} ${s.who} is $\\dfrac{${theta}}{${f}}°$.`,
      markScheme: scheme(slot, [`360 ÷ ${theta} = ${k}, or ${theta}/${f} degrees per person`], String(answer)),
      answer,
      tolerance: 0,
    },
    // Second route: the sector's share of the found total is its share of 360°.
    check: { agrees: f * 360 === theta * answer, detail: `${f}/${answer} × 360 = ${(f * 360) / answer}°` },
    values: { task: 'total', theta, f },
  }
}

const RATIO_PIES: { lead: (k: number) => string; what: string }[] = [
  { lead: (k) => `${cap(words(k))} charities share a donation in the ratio`, what: 'The shares are shown on a pie chart.' },
  { lead: (k) => `A smoothie is made from ${words(k)} fruits in the ratio`, what: 'The amounts are shown on a pie chart.' },
  { lead: (k) => `A council splits its parks budget between ${words(k)} parks in the ratio`, what: 'The split is shown on a pie chart.' },
  { lead: (k) => `${cap(words(k))} friends share the cost of a holiday in the ratio`, what: 'The shares are shown on a pie chart.' },
]

/**
 * The angle of a sector from a ratio: written as q17 (2 : 3 : 4, the largest; 2 marks).
 * Three or four parts; the largest or the smallest sector, by turn. Every sector is worked
 * and the angles add to 360°.
 */
const ratioSector: Builder = (r, slot, turn) => {
  const which = turn % 2 === 0 ? 'largest' : 'smallest'
  const k = r() < 0.6 ? 3 : 4
  const parts = draw(
    r,
    (r) => Array.from({ length: k }, () => int(r, 1, 9)),
    (p) => new Set(p).size === k && 360 % total(p) === 0 && p.reduce(gcd) === 1 && total(p) >= 6,
  )
  const sum = total(parts)
  const each = 360 / sum
  const target = which === 'largest' ? Math.max(...parts) : Math.min(...parts)
  const answer = target * each
  const angles = parts.map((p) => angleByFraction(p, sum))
  const c = pick(r, RATIO_PIES)
  return {
    question: {
      type: 'numeric',
      prompt: `${c.lead(k)} ${parts.join(' : ')}. ${c.what} What is the angle of the ${which} sector?`,
      solution: `There are $${parts.join(' + ')} = ${sum}$ parts, so each part is $360 \\div ${sum} = ${each}°$. The ${which} share is $${target} \\times ${each} = ${answer}°$.`,
      markScheme: scheme(slot, [`360 ÷ ${sum} = ${each}`], String(answer)),
      answer,
      tolerance: 0,
      units: '°',
    },
    check: { agrees: total(angles) === 360 && (which === 'largest' ? Math.max(...angles) : Math.min(...angles)) === answer, detail: `every sector: ${angles.join(' + ')} = ${total(angles)}` },
    values: { task: 'ratio', which, parts: parts.join(','), angles: angles.join(',') },
  }
}

export const pieChartAngles = bySlot('pie-chart-angles', CHARTS, { q2: sectorAngle, q6: sectorAngle, q12: surveyTotal, q17: ratioSector })

interface TwoWay {
  /** The two groups (rows) and what one of them did (column). */
  intro: (T: number, a: number) => string
  groupA: string
  groupB: string
  did: (k: number) => string
  ask: string
  /** The solution's label for the cell asked for: "Not hockey". */
  not: string
}

const TWO_WAYS: TwoWay[] = [
  { intro: (T, a) => `A group of ${T} students from Years 10 and 11 each chose a sport. ${a} of them are in Year 10.`, groupA: 'Year 10', groupB: 'Year 11', did: (k) => `In a two-way table of the sport they chose, ${k} Year 11 students chose hockey.`, ask: 'How many Year 11 students did not choose hockey?', not: 'Not hockey' },
  { intro: (T, a) => `${T} people went to a concert. ${a} of them were adults and the rest were children.`, groupA: 'adults', groupB: 'children', did: (k) => `In a two-way table of who bought a programme, ${k} children bought one.`, ask: 'How many children did not buy a programme?', not: 'No programme' },
  { intro: (T, a) => `${T} students went on a school trip. ${a} of them were boys and the rest were girls.`, groupA: 'boys', groupB: 'girls', did: (k) => `In a two-way table of lunches, ${k} girls brought a packed lunch.`, ask: 'How many girls did not bring a packed lunch?', not: 'No packed lunch' },
  { intro: (T, a) => `A survey asked ${T} dog owners from two villages, Ashby and Brook. ${a} of them live in Ashby.`, groupA: 'Ashby', groupB: 'Brook', did: (k) => `In a two-way table of dog sizes, ${k} owners in Brook have a large dog.`, ask: 'How many owners in Brook do not have a large dog?', not: 'Not a large dog' },
  { intro: (T, a) => `${T} members of a sports club are juniors or seniors. ${a} of them are juniors.`, groupA: 'juniors', groupB: 'seniors', did: (k) => `In a two-way table of who swims, ${k} seniors swim.`, ask: 'How many seniors do not swim?', not: 'Do not swim' },
]

/**
 * A missing cell of a two-way table: written as q10 (80 students, 45 in Year 10, 14 Year 11
 * hockey; 2 marks). The whole table is built and every row and column adds up.
 */
const twoWayCell: Builder = (r, slot) => {
  const c = pick(r, TWO_WAYS)
  const { T, a, k } = draw(
    r,
    (r) => {
      const T = int(r, 30, 160)
      const a = int(r, Math.ceil(T * 0.3), Math.floor(T * 0.7))
      return { T, a, k: int(r, 3, T - a - 3) }
    },
    ({ T, a, k }) => T - a - k >= 3 && k !== T - a - k,
  )
  const B = T - a
  const answer = B - k
  // The full table: group A split as well, then every margin checked.
  const aYes = Math.floor(a / 3)
  const table = [[aYes, a - aYes], [k, answer]]
  const rowsOk = table[0]![0]! + table[0]![1]! === a && table[1]![0]! + table[1]![1]! === B
  const grand = total(table.flat())
  return {
    question: {
      type: 'numeric',
      prompt: `${c.intro(T, a)} ${c.did(k)} ${c.ask}`,
      solution: `${cap(c.groupB)}: $${T} - ${a} = ${B}$. ${c.not}: $${B} - ${k} = ${answer}$.`,
      markScheme: scheme(slot, [`${T} − ${a} = ${B}`], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: rowsOk && grand === T && table[1]![1] === answer, detail: `table ${JSON.stringify(table)} totals ${grand}` },
    values: { task: 'two-way', T, a, k },
  }
}

const FRACTION_WORDS: Record<string, string> = {
  '1/2': 'one half',
  '1/3': 'one third',
  '2/3': 'two thirds',
  '1/4': 'one quarter',
  '3/4': 'three quarters',
  '1/5': 'one fifth',
  '2/5': 'two fifths',
  '3/5': 'three fifths',
  '4/5': 'four fifths',
  '3/8': 'three eighths',
  '5/8': 'five eighths',
  '1/6': 'one sixth',
  '5/6': 'five sixths',
}
const FRACTIONS = Object.keys(FRACTION_WORDS).map((k) => k.split('/').map(Number) as [number, number])

interface TwoWayFractions {
  lead: (T: number, p: string) => string
  A: string
  B: string
  /** What some of B did, the total who did it, and the question. */
  did: (q: string) => string
  together: (Z: number) => string
  ask: string
  /** Names for the solution's lines. */
  yes: string
  range: [number, number]
}

const TWO_WAY_FRACTIONS: TwoWayFractions[] = [
  { lead: (T, p) => `${T} people went to a cinema. ${cap(p)} of them were adults and the rest were children.`, A: 'Adults', B: 'children', did: (q) => `${cap(q)} of the children bought popcorn.`, together: (Z) => `${Z} people bought popcorn altogether.`, ask: 'find how many adults did not buy popcorn.', yes: 'with popcorn', range: [40, 240] },
  { lead: (T, p) => `${T} students went on a school trip. ${cap(p)} of them were boys and the rest were girls.`, A: 'Boys', B: 'girls', did: (q) => `${cap(q)} of the girls took a packed lunch.`, together: (Z) => `${Z} students took a packed lunch altogether.`, ask: 'find how many boys did not take a packed lunch.', yes: 'with a packed lunch', range: [30, 180] },
  { lead: (T, p) => `${T} people visited a museum. ${cap(p)} of them were members and the rest were not.`, A: 'Members', B: 'non-members', did: (q) => `${cap(q)} of the non-members bought a guidebook.`, together: (Z) => `${Z} people bought a guidebook altogether.`, ask: 'find how many members did not buy a guidebook.', yes: 'with a guidebook', range: [60, 300] },
  { lead: (T, p) => `${T} runners entered a race. ${cap(p)} of them were women and the rest were men.`, A: 'Women', B: 'men', did: (q) => `${cap(q)} of the men finished in under an hour.`, together: (Z) => `${Z} runners finished in under an hour altogether.`, ask: 'find how many women did not finish in under an hour.', yes: 'under an hour', range: [60, 400] },
]

/**
 * A two-way table from fractions: written as q16 (90 at a cinema, two fifths adults, two
 * thirds of children bought popcorn, 40 in all; 4 marks). The full table is built and
 * every row and column checked against the fractions and totals in the prompt.
 */
const twoWayFractions: Builder = (r, slot) => {
  const c = pick(r, TWO_WAY_FRACTIONS)
  const { T, p, q, Ay } = draw(
    r,
    (r) => {
      const p = pick(r, FRACTIONS)
      const q = pick(r, FRACTIONS)
      const T = int(r, ...c.range)
      const A = (T * p[0]) / p[1]
      const B = T - A
      const By = (B * q[0]) / q[1]
      return { T, p, q, A, B, By, Ay: Number.isInteger(A) && A >= 6 ? int(r, 1, A - 2) : 0 }
    },
    ({ A, B, By, Ay }) => Number.isInteger(A) && Number.isInteger(By) && B >= 6 && By >= 2 && Ay >= 1 && A - Ay >= 2 && A - Ay !== By,
    3000,
  )
  const A = (T * p[0]) / p[1]
  const B = T - A
  const By = (B * q[0]) / q[1]
  const Z = By + Ay
  const answer = A - Ay
  const pWord = FRACTION_WORDS[p.join('/')]!
  const qWord = FRACTION_WORDS[q.join('/')]!
  // Second route: the finished table, every margin checked, and the fractions read back off it.
  const table = [[Ay, answer], [By, B - By]]
  const ok = table[0]![0]! + table[0]![1]! === A && table[1]![0]! + table[1]![1]! === B && table[0]![0]! + table[1]![0]! === Z && total(table.flat()) === T && A * p[1] === T * p[0] && By * q[1] === B * q[0]
  return {
    question: {
      type: 'numeric',
      prompt: `${c.lead(T, pWord)} ${c.did(qWord)} ${c.together(Z)} Using a two-way table, ${c.ask}`,
      solution: `${c.A}: $\\dfrac{${p[0]}}{${p[1]}} \\times ${T} = ${A}$; ${c.B}: $${T} - ${A} = ${B}$. ${cap(c.B)} ${c.yes}: $\\dfrac{${q[0]}}{${q[1]}} \\times ${B} = ${By}$. ${c.A} ${c.yes}: $${Z} - ${By} = ${Ay}$. ${c.A} without: $${A} - ${Ay} = ${answer}$.`,
      markScheme: scheme(slot, [`${c.A.toLowerCase()} ${A} and ${c.B} ${B}`, `${c.B} ${c.yes} ${By}`, `${c.A.toLowerCase()} ${c.yes} ${Ay}`], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: ok, detail: `table ${JSON.stringify(table)}` },
    values: { task: 'two-way-fractions', T, p: p.join('/'), q: q.join('/'), Z },
  }
}

export const twoWayTables = bySlot('two-way-tables', CHARTS, { q10: twoWayCell, q16: twoWayFractions })

/* ------------------------------------------------------------------------------------------
 * Sampling and populations
 * ---------------------------------------------------------------------------------------- */

const SAMPLING = 'sampling-and-populations'

const PROPORTION_SAYS = [
  'said they had been to the cinema in the last month',
  'said they own a bike',
  'said they walked to work or school that day',
  'said they had read a book in the last week',
  'said they play a musical instrument',
  'said they had been abroad in the last year',
]

/** A sample proportion as a decimal: written as q4 (12 of 40; 1 mark). The check divides by long division in whole numbers. */
const sampleProportion: Builder = (r, slot) => {
  const n = pick(r, [20, 25, 40, 50, 80, 100, 125, 200, 250])
  const k = draw(r, (r) => int(r, Math.ceil(n * 0.05), Math.floor(n * 0.9)), (k) => places(k / n, 3) && gcd(k, n) !== n)
  const answer = Number(show(k / n))
  const says = pick(r, PROPORTION_SAYS)
  // Long division: thousandths, in whole numbers.
  const thousandths = (k * 1000) / n
  return {
    question: {
      type: 'numeric',
      prompt: `In a random sample of ${n} people, ${k} ${says}. What proportion of the sample is that? Give your answer as a decimal.`,
      solution: `$\\dfrac{${k}}{${n}} = ${show(answer)}$.`,
      markScheme: scheme(slot, [], show(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: Number.isInteger(thousandths) && thousandths / 1000 === answer, detail: `${k} × 1000 ÷ ${n} = ${thousandths} thousandths` },
    values: { task: 'proportion', n, k },
  }
}

interface ScaleUp {
  text: (N: number, n: number, k: number) => string
  noun: string
  N: [number, number]
  step: number
  n: number[]
  share: [number, number]
}

/** People surveyed (q5) and things tested (q9): two different kinds on one sheet. */
const PEOPLE_SCALE: ScaleUp[] = [
  { text: (N, n, k) => `A school has ${N} students. A random sample of ${n} of them is asked how they travel to school, and ${k} say they walk. Estimate the number of students at the school who walk.`, noun: 'students', N: [600, 2000], step: 50, n: [40, 50, 60, 80, 100], share: [0.15, 0.6] },
  { text: (N, n, k) => `A town has ${N} adults. A random sample of ${n} of them is asked about the library, and ${k} say they used it last month. Estimate the number of adults in the town who used the library last month.`, noun: 'adults', N: [5000, 40000], step: 500, n: [50, 80, 100, 120, 200], share: [0.1, 0.5] },
  { text: (N, n, k) => `A gym has ${N} members. A random sample of ${n} members is asked about classes, and ${k} say they go to a yoga class. Estimate the number of members who go to a yoga class.`, noun: 'members', N: [800, 3000], step: 100, n: [40, 50, 60, 80], share: [0.1, 0.45] },
  { text: (N, n, k) => `A festival sold ${N} tickets. A random sample of ${n} ticket holders is asked how they travelled, and ${k} say they came by train. Estimate the number of ticket holders who came by train.`, noun: 'ticket holders', N: [4000, 20000], step: 500, n: [50, 80, 100, 200], share: [0.15, 0.55] },
]
const THINGS_SCALE: ScaleUp[] = [
  { text: (N, n, k) => `A factory makes a batch of ${N} light bulbs. A random sample of ${n} bulbs is tested and ${k} are faulty. Estimate the number of faulty bulbs in the batch.`, noun: 'bulbs', N: [1000, 9000], step: 500, n: [40, 50, 60, 80, 100], share: [0.02, 0.12] },
  { text: (N, n, k) => `A farm packs ${N} eggs in a day. A random sample of ${n} eggs is checked and ${k} are cracked. Estimate the number of cracked eggs that day.`, noun: 'eggs', N: [2000, 12000], step: 500, n: [50, 60, 80, 100, 120], share: [0.02, 0.1] },
  { text: (N, n, k) => `A gardener plants ${N} seeds. A random sample of ${n} seeds is tested first and ${k} of them grow. Estimate the number of the ${N} seeds that will grow.`, noun: 'seeds', N: [400, 3000], step: 100, n: [20, 25, 40, 50], share: [0.6, 0.95] },
  { text: (N, n, k) => `A warehouse holds ${N} phones. A random sample of ${n} phones is checked and ${k} have a scratched screen. Estimate the number of phones with a scratched screen.`, noun: 'phones', N: [1500, 8000], step: 500, n: [40, 50, 60, 80, 100], share: [0.02, 0.15] },
]

function scaleUp(contexts: ScaleUp[], alternative: boolean): Builder {
  return (r, slot) => {
    const c = pick(r, contexts)
    const { N, n, k } = draw(
      r,
      (r) => {
        const n = pick(r, c.n)
        const N = int(r, c.N[0] / c.step, c.N[1] / c.step) * c.step
        const k = int(r, Math.max(1, Math.ceil(n * c.share[0])), Math.floor(n * c.share[1]))
        return { N, n, k }
      },
      // At least 2, so "are faulty" is never said of 1.
      ({ N, n, k }) => (N * k) % n === 0 && k >= 2,
    )
    const answer = (N * k) / n
    // Second route: cancel the fraction first, then scale.
    const g = gcd(k, n)
    const viaCancelled = (N / (n / g)) * (k / g)
    const direct = `$\\dfrac{${k}}{${n}} \\times ${N} = ${answer}$ ${c.noun}.`
    const solution = alternative && N % n === 0 ? `${direct} Or $${N} \\div ${n} = ${N / n}$ and $${k} \\times ${N / n} = ${answer}$.` : direct
    return {
      question: {
        type: 'numeric',
        prompt: c.text(N, n, k),
        solution,
        markScheme: scheme(slot, [`${k}/${n} × ${N}`], String(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: Math.abs(viaCancelled - answer) < 1e-9, detail: `${k}/${n} = ${k / g}/${n / g}, and ${N} ÷ ${n / g} × ${k / g} = ${viaCancelled}` },
      values: { task: 'scale-up', N, n, k },
    }
  }
}

const COMBINED_SAMPLES: { text: (N: number, k1: number, n1: number, k2: number, n2: number) => string; noun: string }[] = [
  { text: (N, k1, n1, k2, n2) => `Two random samples are taken from the ${N} people in a town. In the first, ${k1} of ${n1} people say they would use a new swimming pool. In the second, ${k2} of ${n2} people say they would. Use both samples together to estimate the number of people in the town who would use the pool.`, noun: 'people' },
  { text: (N, k1, n1, k2, n2) => `Two random samples are taken from the ${N} students at a college. In the first, ${k1} of ${n1} students say they would join a chess club. In the second, ${k2} of ${n2} say they would. Use both samples together to estimate the number of students at the college who would join.`, noun: 'students' },
  { text: (N, k1, n1, k2, n2) => `Two random samples are taken from the ${N} households in a village. In the first, ${k1} of ${n1} households have solar panels. In the second, ${k2} of ${n2} have them. Use both samples together to estimate the number of households in the village with solar panels.`, noun: 'households' },
  { text: (N, k1, n1, k2, n2) => `Two random samples are taken from the ${N} workers at a company. In the first, ${k1} of ${n1} workers cycle to work. In the second, ${k2} of ${n2} do. Use both samples together to estimate the number of workers at the company who cycle to work.`, noun: 'workers' },
]

/**
 * Two samples pooled: written as q12 (12 of 40 and 21 of 60 from 4500; 3 marks). The samples
 * differ in size, so averaging the two proportions is wrong; the check weights the two
 * separate estimates by sample size.
 */
const combinedSamples: Builder = (r, slot) => {
  const c = pick(r, COMBINED_SAMPLES)
  const { N, n1, k1, n2, k2 } = draw(
    r,
    (r) => {
      const n = pick(r, [50, 80, 100, 120, 150, 200])
      const n1 = int(r, 2, n / 10 - 2) * 5
      const n2 = n - n1
      return { N: int(r, 12, 160) * 50, n1, k1: int(r, 2, n1 - 2), n2, k2: int(r, 2, n2 - 2) }
    },
    // Two random samples of one population agree roughly: 56 of 65 against 27 of 135 do not.
    ({ N, n1, k1, n2, k2 }) => n1 !== n2 && k1 * n2 !== k2 * n1 && Math.abs(k1 / n1 - k2 / n2) <= 0.2 && (N * (k1 + k2)) % (n1 + n2) === 0 && Math.abs((k1 + k2) / (n1 + n2) - (k1 / n1 + k2 / n2) / 2) * N >= 1,
  )
  const K = k1 + k2
  const n = n1 + n2
  const answer = (N * K) / n
  const p = K / n
  const pText = places(p, 3) ? ` = ${show(p)}` : ''
  const trap = ((k1 / n1 + k2 / n2) / 2) * N
  const trapText = places(trap, 2) ? show(trap) : `about ${fixed(trap, 1)}`
  const then = places(p, 3) ? `Then $${show(p)} \\times ${N} = ${answer}$ ${c.noun}.` : `Then $\\dfrac{${K}}{${n}} \\times ${N} = ${answer}$ ${c.noun}.`
  // Second route: each sample's own estimate, weighted by its size.
  const e1 = (k1 / n1) * N
  const e2 = (k2 / n2) * N
  const weighted = (n1 * e1 + n2 * e2) / n
  return {
    question: {
      type: 'numeric',
      prompt: c.text(N, k1, n1, k2, n2),
      solution: `Combine the counts: $\\dfrac{${k1} + ${k2}}{${n1} + ${n2}} = \\dfrac{${K}}{${n}}${pText}$. ${then} Averaging the two proportions would give ${trapText}, which wrongly treats both samples as the same size.`,
      markScheme: scheme(slot, [`combines the samples: ${K}/${n}`, `multiplies by ${N}`], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: Math.abs(weighted - answer) < 1e-6 && Math.abs(trap - answer) >= 1, detail: `estimates ${e1.toFixed(2)} and ${e2.toFixed(2)} weighted ${n1}:${n2} give ${weighted.toFixed(4)}` },
    values: { task: 'pooled', N, k1, n1, k2, n2 },
  }
}

const POPULATION_FROM: { text: (n: number, k: number, E: number) => string; noun: string }[] = [
  { text: (n, k, E) => `In a random sample of ${n} people from a town, ${k} own a dog. From this sample, the number of dog owners in the town is estimated to be ${E}. Estimate the number of people living in the town.`, noun: 'people' },
  { text: (n, k, E) => `In a random sample of ${n} people from a city, ${k} cycle to work. From this sample, the number of people in the city who cycle to work is estimated to be ${E}. Estimate the number of people living in the city.`, noun: 'people' },
  { text: (n, k, E) => `In a random sample of ${n} trees in a forest, ${k} are oaks. From this sample, the number of oaks in the forest is estimated to be ${E}. Estimate the number of trees in the forest.`, noun: 'trees' },
  { text: (n, k, E) => `In a random sample of ${n} students at a university, ${k} play a sport for a club. From this sample, the number of students who play for a club is estimated to be ${E}. Estimate the number of students at the university.`, noun: 'students' },
]

/**
 * A population from an estimate: written as q15 (18 of 75, 2400 owners; 3 marks). The
 * check puts the population back: its sample share must be the stated estimate.
 */
const populationFromEstimate: Builder = (r, slot) => {
  const c = pick(r, POPULATION_FROM)
  const { n, k, N } = draw(
    r,
    (r) => {
      const n = pick(r, [40, 50, 60, 75, 80, 90, 120, 150])
      const k = int(r, Math.ceil(n * 0.08), Math.floor(n * 0.5))
      const unit = n / gcd(n, k)
      const N = Math.round(int(r, 2000, 60000) / unit) * unit
      return { n, k, N }
    },
    ({ n, k, N }) => N >= 1000 && N % 100 === 0 && (N * k) % n === 0,
  )
  const E = (N * k) / n
  return {
    question: {
      type: 'numeric',
      prompt: c.text(n, k, E),
      solution: `The sample proportion is $\\dfrac{${k}}{${n}}$, so $\\dfrac{${k}}{${n}} \\times N = ${E}$ and $N = ${E} \\times \\dfrac{${n}}{${k}} = ${N}$ ${c.noun}.`,
      markScheme: scheme(slot, [`sets up ${k}/${n} × N = ${E}`, `${E} × ${n} ÷ ${k}`], String(N)),
      answer: N,
      tolerance: 0,
    },
    check: { agrees: k * N === E * n, detail: `${k}/${n} × ${N} = ${(k * N) / n}` },
    values: { task: 'population', n, k, E },
  }
}

export const sampleProportions = bySlot('sample-proportions', SAMPLING, {
  q4: sampleProportion,
  q5: scaleUp(PEOPLE_SCALE, true),
  q9: scaleUp(THINGS_SCALE, false),
  q12: combinedSamples,
  q15: populationFromEstimate,
})

interface MassSample {
  lead: (N: number, n: number) => string
  thing: string
  range: [number, number]
  N: [number, number]
}

const MASS_SAMPLES: MassSample[] = [
  { lead: (N, n) => `A farmer has ${N} apples. He weighs a random sample of ${n} of them.`, thing: 'apples', range: [135, 175], N: [8, 40] },
  { lead: (N, n) => `A grower has ${N} potatoes. She weighs a random sample of ${n} of them.`, thing: 'potatoes', range: [150, 260], N: [8, 40] },
  { lead: (N, n) => `A farm collects ${N} eggs. A random sample of ${n} of them is weighed.`, thing: 'eggs', range: [52, 72], N: [10, 60] },
  { lead: (N, n) => `A greenhouse produces ${N} tomatoes. A random sample of ${n} of them is weighed.`, thing: 'tomatoes', range: [80, 125], N: [10, 60] },
  { lead: (N, n) => `An orchard has ${N} pears. A random sample of ${n} of them is weighed.`, thing: 'pears', range: [150, 210], N: [8, 40] },
]

/**
 * A total from a sample mean: written as q7 (12 apples, mean 152 g, 1500 apples, 228 kg;
 * 3 marks). The masses are drawn with a whole-number mean; the check finds the mean again
 * from deviations about the first value, then converts grams to kilograms in whole numbers.
 */
const totalFromSampleMean: Builder = (r, slot) => {
  const c = pick(r, MASS_SAMPLES)
  const n = int(r, 8, 12)
  const mean = int(r, c.range[0] + 6, c.range[1] - 6)
  const xs = listWithMean(r, n, mean, ...c.range)
  const N = int(r, ...c.N) * 100
  const grams = N * mean
  const kg = Number(show(grams / 1000))
  const S = total(xs)
  // Second route: an assumed mean (the first value) and the deviations from it.
  const base = xs[0]!
  const devMean = base + total(xs.map((x) => x - base)) / n
  return {
    question: {
      type: 'numeric',
      prompt: `${c.lead(N, n)} Their masses, in grams, are ${commas(xs)}. Use the sample to estimate the total mass of the ${N} ${c.thing}, in kilograms.`,
      solution: `Sample mean $= \\dfrac{${S}}{${n}} = ${mean}$ g. Total $= ${N} \\times ${mean} = ${grams}$ g $= ${show(kg)}$ kg.`,
      markScheme: scheme(slot, [`finds the sample mean, ${mean} g`, `multiplies by ${N}`], `${show(kg)} kg`),
      answer: kg,
      tolerance: 0,
      units: 'kg',
    },
    check: { agrees: devMean === mean && Math.round(kg * 1000) === grams, detail: `assumed mean ${base}, deviations total ${total(xs.map((x) => x - base))}, mean ${devMean}` },
    values: { task: 'total-mass', data: xs.join(','), N, mean },
  }
}

const QUADRAT_PLANTS = ['daisies', 'dandelions', 'buttercups', 'clover plants', 'thistles', 'orchids']

/**
 * A count from quadrats: written as q17 (8 quadrats, mean 5.5, field 30 m by 40 m, 6600; 3
 * marks). The check scales the total count by the field's area over the area sampled.
 */
const quadratEstimate: Builder = (r, slot) => {
  const plant = pick(r, QUADRAT_PLANTS)
  const { q, counts, a, b } = draw(
    r,
    (r) => {
      const q = pick(r, [5, 6, 8, 10])
      return { q, counts: Array.from({ length: q }, () => int(r, 0, 14)), a: int(r, 4, 16) * 5, b: int(r, 4, 20) * 5 }
    },
    ({ q, counts, a, b }) => a < b && (total(counts) * a * b) % q === 0 && places(total(counts) / q, 2) && total(counts) >= q,
  )
  const S = total(counts)
  const mean = Number(show(S / q))
  const area = a * b
  const answer = (S * area) / q
  // Second route: the quadrats cover q m² between them, so the field is area/q times the sampled ground.
  const scale = area / q
  const viaScale = S * scale
  return {
    question: {
      type: 'numeric',
      prompt: `An ecologist places a 1 m by 1 m quadrat at ${words(q)} random points in a field ${a} m by ${b} m. The numbers of ${plant} in the quadrats are ${commas(counts)}. Estimate the number of ${plant} in the whole field.`,
      solution: `Mean per square metre $= \\dfrac{${S}}{${q}} = ${show(mean)}$. Area $= ${a} \\times ${b} = ${area}$ m². Estimate $= ${show(mean)} \\times ${area} = ${answer}$ ${plant}.`,
      markScheme: scheme(slot, [`mean of the counts, ${show(mean)}`, `area of the field, ${area}`], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: Math.abs(viaScale - answer) < 1e-9 && Number.isInteger(answer), detail: `${S} counted on ${q} m², field is ${area} m²: ${S} × ${show(scale)} = ${show(viaScale)}` },
    values: { task: 'quadrat', data: counts.join(','), a, b },
  }
}

export const sampleMeans = bySlot('sample-means', SAMPLING, { q7: totalFromSampleMean, q17: quadratEstimate })

const CAPTURE: { what: string; place: string; later: string }[] = [
  { what: 'fish', place: 'lake', later: 'A week later' },
  { what: 'rabbits', place: 'wood', later: 'A fortnight later' },
  { what: 'newts', place: 'pond', later: 'Three days later' },
  { what: 'butterflies', place: 'meadow', later: 'The next day' },
  { what: 'squirrels', place: 'park', later: 'A week later' },
]

/**
 * Capture–recapture: written as q21 (60 marked, 45 caught, 9 marked, 300; 3 marks). The check
 * puts the estimate back: the marked share of the lake equals the marked share of the catch.
 */
export const captureRecapture: Generator = {
  id: 'capture-recapture',
  subjectId: 'maths',
  topicId: SAMPLING,
  replaces: ['q21'],
  build(r, slot): Draft {
    const c = pick(r, CAPTURE)
    const { M, n, k } = draw(
      r,
      (r) => ({ M: int(r, 20, 120), n: int(r, 20, 100), k: int(r, 2, 20) }),
      ({ M, n, k }) => k < n / 2 && (M * n) % k === 0 && (M * n) / k >= M + n,
    )
    const N = (M * n) / k
    return {
      question: {
        type: 'numeric',
        prompt: `Extension, beyond the 1MA1 specification. To estimate the number of ${c.what} in a ${c.place}, ${M} ${c.what} are caught, marked and released. ${c.later} ${n} ${c.what} are caught, and ${k} of them are marked. Estimate the number of ${c.what} in the ${c.place}.`,
        solution: `Assume the marked fraction of the second catch matches the ${c.place}: $\\dfrac{${k}}{${n}} = \\dfrac{${M}}{N}$, so $N = \\dfrac{${M} \\times ${n}}{${k}} = ${N}$ ${c.what}.`,
        markScheme: scheme(slot, [`${k}/${n} = ${M}/N, or equivalent`, `${M} × ${n} ÷ ${k}`], String(N)),
        answer: N,
        tolerance: 0,
      },
      check: { agrees: k * N === M * n, detail: `${k}/${n} against ${M}/${N}` },
      values: { M, n, k },
    }
  },
}

/* ------------------------------------------------------------------------------------------
 * Scatter graphs and correlation
 * ---------------------------------------------------------------------------------------- */

const SCATTER = 'scatter-graphs-and-correlation'

interface BestFit {
  intro: (count: string, eq: string, lo: number, hi: number) => string
  ask: (x: number) => string
  /** What the line gives, for q11: "What mark does the line give?" */
  askBeyond: (x: number) => string
  m: number[]
  c: [number, number]
  data: [number, number]
  /** Lowest and highest values that make sense, and why one beyond them is impossible. */
  sensible: [number, number]
  /** The furthest x a person might sensibly ask about. */
  far: number
  impossible: string
  unit: string
  count: string
}

const BEST_FITS: BestFit[] = [
  {
    intro: (count, eq, lo, hi) => `A line of best fit for ${count} students has equation ${eq}, where x is hours of revision and y is the test mark out of 100. The data collected covered ${lo} to ${hi} hours.`,
    ask: (x) => `Use the line to estimate the mark of a student who revised for ${x} hours.`,
    askBeyond: (x) => `A student uses it to estimate the mark for ${x} hours of revision. What mark does the line give?`,
    m: [3, 4, 5, 6, 7],
    c: [12, 40],
    data: [2, 12],
    sensible: [0, 100],
    far: 30,
    impossible: 'which is impossible on a paper marked out of 100',
    unit: 'marks',
    count: 'twelve',
  },
  {
    intro: (count, eq, lo, hi) => `A line of best fit for ${count} basketball players has equation ${eq}, where x is hours of practice a week and y is the percentage of free throws they score. The data collected covered ${lo} to ${hi} hours.`,
    ask: (x) => `Use the line to estimate the percentage scored by a player who practises for ${x} hours a week.`,
    askBeyond: (x) => `A coach uses it to estimate the percentage for a player who practises ${x} hours a week. What percentage does the line give?`,
    m: [4, 5, 6, 8],
    c: [10, 35],
    data: [1, 8],
    sensible: [0, 100],
    far: 25,
    impossible: 'which is impossible, since nobody can score more than 100% of their free throws',
    unit: '%',
    count: 'fifteen',
  },
  {
    intro: (count, eq, lo, hi) => `A line of best fit for ${count} days has equation ${eq}, where x is the temperature in °C and y is the number of hot drinks a café sells. The data collected covered ${lo} °C to ${hi} °C.`,
    ask: (x) => `Use the line to estimate the number of hot drinks sold on a day when the temperature is ${x} °C.`,
    askBeyond: (x) => `The owner uses it to estimate sales on a day when the temperature is ${x} °C. What number of drinks does the line give?`,
    m: [-6, -5, -4, -3],
    c: [120, 180],
    data: [4, 22],
    sensible: [0, 1000],
    far: 40,
    impossible: 'which is impossible, since a café cannot sell a negative number of drinks',
    unit: 'drinks',
    count: 'twenty',
  },
  {
    intro: (count, eq, lo, hi) => `A line of best fit for ${count} used cars of one model has equation ${eq}, where x is the age in years and y is the price in pounds. The data collected covered cars ${lo} to ${hi} years old.`,
    ask: (x) => `Use the line to estimate the price of a car that is ${x} years old.`,
    askBeyond: (x) => `A buyer uses it to estimate the price of a car that is ${x} years old. What price, in pounds, does the line give?`,
    m: [-1500, -1200, -1000, -800],
    c: [12000, 18000],
    data: [1, 8],
    sensible: [0, 100000],
    far: 25,
    impossible: 'which is impossible, since a car cannot have a negative price',
    unit: 'pounds',
    count: 'fourteen',
  },
]

/** y = mx + c in plain text, as the written questions print it, with a true minus sign. */
const equation = (m: number, c: number) => `y = ${m < 0 ? '−' : ''}${Math.abs(m)}x + ${c}`

type Where = 'low' | 'high' | 'beyond'

function lineEstimate(where: Where): Builder {
  return (r, slot) => {
    const f = pick(r, BEST_FITS)
    const { m, c, lo, hi, x } = draw(
      r,
      (r) => {
        const m = pick(r, f.m)
        const step = Math.abs(m) >= 100 ? 500 : 1
        const c = int(r, f.c[0] / step, f.c[1] / step) * step
        const lo = int(r, f.data[0], f.data[0] + 2)
        const hi = int(r, f.data[1] - 2, f.data[1])
        const mid = (lo + hi) / 2
        const x = where === 'low' ? int(r, lo + 1, Math.floor(mid)) : where === 'high' ? int(r, Math.ceil(mid), hi - 1) : int(r, hi + 4, Math.max(hi + 4, f.far))
        return { m, c, lo, hi, x }
      },
      ({ m, c, lo, hi, x }) => {
        const y = m * x + c
        const ends = [m * lo + c, m * hi + c]
        const inside = ends.every((e) => e >= f.sensible[0] && e <= f.sensible[1])
        return inside && (where === 'beyond' ? y < f.sensible[0] || y > f.sensible[1] : y >= f.sensible[0] && y <= f.sensible[1])
      },
    )
    const answer = m * x + c
    // Second route: the line through its two ends over the data, read at x by proportion.
    const yLo = m * lo + c
    const yHi = m * hi + c
    const viaEnds = yLo + ((x - lo) * (yHi - yLo)) / (hi - lo)
    const work = `$${m < 0 ? '-' : ''}${Math.abs(m)} \\times ${x} + ${c} = ${answer}$`
    const unit = f.unit === '%' ? '%' : ` ${f.unit}`
    const solution = where === 'beyond'
      ? `${work} — ${f.impossible}, and is exactly why extrapolating this far beyond the data (${lo} to ${hi}) is unreliable.`
      : `${work}${unit}.`
    return {
      question: {
        type: 'numeric',
        prompt: `${f.intro(f.count, equation(m, c), lo, hi)} ${where === 'beyond' ? f.askBeyond(x) : f.ask(x)}`,
        solution,
        markScheme: scheme(slot, [`substitutes x = ${x}`], String(answer)),
        answer,
        tolerance: 0,
        ...(f.unit === 'pounds' ? {} : { units: f.unit }),
      },
      check: { agrees: Math.abs(viaEnds - answer) < 1e-9 && (where === 'beyond' ? x > hi : x > lo && x < hi), detail: `through (${lo}, ${yLo}) and (${hi}, ${yHi}) at x = ${x}: ${viaEnds}` },
      values: { where, m, c, lo, hi, x },
    }
  }
}

export const lineOfBestFit = bySlot('line-of-best-fit-estimate', SCATTER, { q7: lineEstimate('low'), q8: lineEstimate('high'), q11: lineEstimate('beyond') })

export const statisticsGenerators: Generator[] = [
  averagesOfAList,
  modalCategory,
  frequencyTableAverages,
  meansFromTotals,
  averagesPuzzle,
  pieChartAngles,
  twoWayTables,
  sampleProportions,
  sampleMeans,
  captureRecapture,
  lineOfBestFit,
]
