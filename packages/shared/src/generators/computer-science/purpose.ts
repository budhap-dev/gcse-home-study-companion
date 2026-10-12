import type { Question } from '../../content/questions.ts'
import { draw, int, pick, shuffle, weighted, type Rng } from '../random.ts'
import type { Draft, Generator } from '../types.ts'
import { andList, csBySlot, numericDraft } from './build.ts'

/**
 * Computer Science (AQA 8525) generators for 3.1.1, determining the purpose of simple algorithms
 * ("use trace tables and visual inspection to determine how simple algorithms work") and
 * explaining them in terms of inputs, processing and outputs ("identify where inputs, processing
 * and outputs are taking place within an algorithm").
 *
 * Each slot traces one of the patterns the lesson teaches, as the lesson writes it:
 *
 * - q2: the largest-value finder, max ← a[0] then replaced by any later item that is bigger (the
 *   lesson's s2), or its smallest-value twin (s3 names both). The answer is never the first or the
 *   last item, so "it outputs a[0]" and "it outputs the last item it looked at" never pay, and in
 *   four builds in five an earlier item beats a[0] first (written: 6, 9, 2, 11, 8), so "it outputs
 *   the first item bigger than a[0]" fails too.
 * - q5: a running total from 0 (s3, s4), four two-digit items as written, or three or five.
 * - q7 and q11: whole-number division by repeated subtraction (s5): q7 asks the x left over (the
 *   remainder), q11 the count (the quotient). The loop runs 2 to 8 times, the remainder is never
 *   equal to the quotient, so neither slot is paid by the other's answer, and q11 sometimes divides
 *   exactly so that "x is at least y" decides the last subtraction.
 * - q8: how many times FOR i ← s TO LEN(a) − k runs (iteration, 3.2.2). AQA pseudo-code's TO
 *   includes both ends, so the count is
 *   LEN(a) − k − s + 1; the bounds are never the pair that makes the count the list's length.
 * - q14: counting the characters that are a, e, i, o or u, in everyday words with a repeated vowel,
 *   about half with a y. Counting a repeated vowel once, counting y, or both together never give
 *   the answer where the slip can happen.
 * - q16: the first value of i at which a[i + 1] (or a[i + 2]) reads past the last position.
 * - q20: which numbered line takes the input, over a dozen short programs whose input line sits at
 *   line 1 to 4, half of them with a message line just above it that is output, not input.
 *
 * Code prints in AQA pseudo-code (the specification's standard version for any code a student is
 * given): ← for assignment, FOR … TO … inclusive, STRING_TO_INT(USERINPUT), single-quoted strings,
 * and ASCII - and * inside code as the pack's code blocks print them.
 */

const WORDS = ['two', 'three', 'four', 'five', 'six', 'seven', 'eight'] as const
/** 2 is "two", up to 8. */
const word = (n: number) => WORDS[n - 2]!

/** "6, 2, 11, 8", as the written prompts list items. */
const commaList = (xs: readonly (number | string)[]) => xs.join(', ')

/** Distinct whole numbers from lo to hi, `n` of them, in random order. */
function distinct(r: Rng, n: number, lo: number, hi: number): number[] {
  const pool = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
  return shuffle(r, pool).slice(0, n)
}

// ---------------------------------------------------------------------------------------------
// q2: the largest (or smallest) value
// ---------------------------------------------------------------------------------------------

export type Finder = 'largest' | 'smallest'

/** Runs the finder as the lesson's trace table does, a row per later item. */
export function traceFinder(list: readonly number[], kind: Finder) {
  let best = list[0]!
  const rows: { at: number; item: number; beats: boolean; best: number }[] = []
  for (let i = 1; i < list.length; i++) {
    const item = list[i]!
    const beats = kind === 'largest' ? item > best : item < best
    if (beats) best = item
    rows.push({ at: i, item, beats, best })
  }
  return { start: list[0]!, rows, best }
}

/** The first later item that beats a[0]: what "it stops at the first bigger item" outputs. */
export function firstBeat(list: readonly number[], kind: Finder): number | undefined {
  return list.slice(1).find((x) => (kind === 'largest' ? x > list[0]! : x < list[0]!))
}

const FINDER_PROMPTS = [
  (v: string, cmp: string, list: string) => `Trace the algorithm ${v} ← a[0], then for each later item replace ${v} if the item is ${cmp}. What does it output for the list ${list}?`,
  (v: string, cmp: string, list: string) => `An algorithm sets ${v} ← a[0], then goes through the rest of the list and replaces ${v} whenever an item is ${cmp}. It then outputs ${v}. What does it output for the list ${list}?`,
  (v: string, cmp: string, list: string) => `Trace this algorithm on the list ${list}: ${v} ← a[0], then each later item replaces ${v} if it is ${cmp}, and finally ${v} is output. What is output?`,
]

/**
 * q2: 1 mark. Written: 6, 2, 11, 8 gives 11. The largest-finder seven times in ten, the smallest
 * otherwise; four to six items from 1 to 30. The answer is drawn first (9 to 30 for the largest,
 * 1 to 22 for the smallest) and placed anywhere but the first or last position.
 */
function finder(r: Rng, slot: Question): Draft {
  const kind: Finder = r() < 0.7 ? 'largest' : 'smallest'
  const len = pick(r, [4, 4, 5, 5, 6])
  const answer = kind === 'largest' ? int(r, 9, 30) : int(r, 1, 22)
  // Four builds in five, an earlier item beats a[0] but not the answer, so the extreme is replaced
  // at least twice and "the first item that beats a[0]" is wrong.
  const twice = r() < 0.8
  const list = draw(
    r,
    (r) => {
      const others = kind === 'largest' ? distinct(r, len - 1, 1, answer - 1) : distinct(r, len - 1, answer + 1, 30)
      const at = int(r, twice ? 2 : 1, len - 2)
      return [...others.slice(0, at), answer, ...others.slice(at)]
    },
    (l) => !twice || firstBeat(l, kind) !== answer,
  )
  const v = kind === 'largest' ? 'max' : 'min'
  const cmp = kind === 'largest' ? 'bigger' : 'smaller'
  const t = traceFinder(list, kind)
  const steps = t.rows.map((row) => (row.beats ? `${row.item} is ${cmp}, so ${v} becomes ${row.item}` : `${row.item} is not ${cmp}, so ${v} stays ${row.best}`))
  return numericDraft(
    slot,
    {
      prompt: pick(r, FINDER_PROMPTS)(v, cmp, commaList(list)),
      solution: `${v} starts at ${t.start}. Then ${steps.join('; ')}. The output is **${t.best}**, the ${kind} value in the list.`,
      method: [],
      answer: t.best,
    },
    // Second route: the extreme of the list by sorting, not by tracing.
    { agrees: [...list].sort((a, b) => a - b)[kind === 'largest' ? list.length - 1 : 0] === t.best && t.best === answer, detail: `${kind} of ${list.join(', ')} by sorting` },
    { kind, list: list.join(','), answer },
  )
}

// ---------------------------------------------------------------------------------------------
// q5: a running total
// ---------------------------------------------------------------------------------------------

const TOTAL_PROMPTS = [
  (list: string) => `An algorithm sets total to 0, then adds each item of the list ${list} to it. What does total hold when the loop ends?`,
  (list: string) => `An algorithm sets total to 0 and then, for each item of the list ${list}, runs total ← total + item. What does total hold when the loop ends?`,
  (list: string) => `Trace an algorithm that sets total to 0 and adds every item of the list ${list} to it in turn. What does total hold after the loop?`,
]

/** q5: 1 mark. Written: 12, 15, 9, 20 gives 56. Three to five distinct items from 5 to 30, four most often. */
function runningTotal(r: Rng, slot: Question): Draft {
  const len = weighted(r, [[3, 1], [4, 2], [5, 1]] as const)
  const list = distinct(r, len, 5, 30)
  let total = 0
  const sums: number[] = []
  for (const x of list) {
    total += x
    sums.push(total)
  }
  // "12 + 15 = 27, + 9 = 36, + 20 = 56", as the written solution prints it.
  const working = [`${list[0]} + ${list[1]} = ${sums[1]}`, ...list.slice(2).map((x, i) => `+ ${x} = ${i === list.length - 3 ? `**${sums[i + 2]}**` : sums[i + 2]}`)]
  const solution = `${working.join(', ')}.`
  // Second route: the bold figure the printed working ends on, against the items added from the
  // last to the first.
  const printed = Number(/\*\*(\d+)\*\*/.exec(solution)![1])
  const backwards = [...list].reverse().reduce((s, x) => s + x, 0)
  return numericDraft(
    slot,
    { prompt: pick(r, TOTAL_PROMPTS)(commaList(list)), solution, method: [], answer: total },
    { agrees: printed === total && backwards === total, detail: `printed ${printed}; added backwards ${backwards}` },
    { list: list.join(','), answer: total },
  )
}

// ---------------------------------------------------------------------------------------------
// q7 and q11: whole-number division by repeated subtraction
// ---------------------------------------------------------------------------------------------

export interface Division {
  x: number
  y: number
  quotient: number
  remainder: number
}

/** Runs WHILE x ≥ y: x ← x − y, count ← count + 1, and records each subtraction. */
export function subtract(x0: number, y: number) {
  let x = x0
  let count = 0
  const steps: string[] = []
  while (x >= y) {
    steps.push(`${x} − ${y} = ${x - y}`)
    x -= y
    count++
  }
  return { x, count, steps }
}

/** Every division the slots draw from: y from 3 to 12, the loop running 2 to 8 times, x at most 60, the remainder never the quotient. */
export const DIVISIONS: Division[] = []
for (let y = 3; y <= 12; y++) {
  for (let quotient = 2; quotient <= 8; quotient++) {
    for (let remainder = 0; remainder < y; remainder++) {
      const x = quotient * y + remainder
      if (x > 60 || remainder === quotient) continue
      DIVISIONS.push({ x, y, quotient, remainder })
    }
  }
}

const REMAINDER_PROMPTS = [
  (x: number, y: number) => `An algorithm runs WHILE x ≥ y with x ← x − y inside the loop, starting at x = ${x} and y = ${y}. What value does x hold when the loop stops?`,
  (x: number, y: number) => `Starting with x = ${x} and y = ${y}, an algorithm repeats x ← x − y WHILE x ≥ y. What value does x hold when the loop stops?`,
  (x: number, y: number) => `An algorithm takes y away from x for as long as x ≥ y. With x = ${x} and y = ${y} at the start, what value does x hold when the loop stops?`,
]

const COUNT_PROMPTS = [
  (x: number, y: number) => `An algorithm sets count to 0, then repeatedly takes y away from x while x is at least y, adding 1 to count each time. With x = ${x} and y = ${y}, what does count hold at the end?`,
  (x: number, y: number) => `An algorithm sets count to 0, then runs WHILE x ≥ y with x ← x − y and count ← count + 1 inside the loop. It starts with x = ${x} and y = ${y}. What does count hold when the loop stops?`,
  (x: number, y: number) => `Starting with x = ${x}, y = ${y} and count = 0, an algorithm takes y away from x and adds 1 to count each time round, for as long as x is at least y. What does count hold at the end?`,
]

/**
 * q7: 2 marks. Written: x = 20, y = 6 leaves 2. The remainder is drawn first, evenly from 1 to 9,
 * then a division with that remainder. Never a remainder of 0: an answer of 0 is what "it counts x
 * down to nothing" gives.
 */
function remainderLeft(r: Rng, slot: Question): Draft {
  const remainder = int(r, 1, 9)
  const d = pick(r, DIVISIONS.filter((x) => x.remainder === remainder))
  const run = subtract(d.x, d.y)
  return numericDraft(
    slot,
    {
      prompt: pick(r, REMAINDER_PROMPTS)(d.x, d.y),
      solution: `${run.steps.join(', ')}. Now ${run.x} is less than ${d.y}, so the loop stops with x holding **${run.x}**, the remainder of ${d.x} ÷ ${d.y}.`,
      method: [`subtracts ${d.y} repeatedly while x is at least ${d.y}`],
      answer: run.x,
    },
    { agrees: run.x === d.x % d.y && run.x === d.remainder, detail: `${d.x} MOD ${d.y} = ${d.x % d.y}` },
    { x: d.x, y: d.y, answer: run.x },
  )
}

/**
 * q11: 2 marks. Written: x = 17, y = 5 counts 3. The count is drawn first, evenly from 2 to 8, then
 * a division with that quotient: one in five divides exactly (the last subtraction leaves 0, and
 * stopping at "x greater than y" would count one too few). The count is never y, a figure printed
 * in the prompt.
 */
function countSubtractions(r: Rng, slot: Question): Draft {
  const quotient = int(r, 2, 8)
  const exact = r() < 0.2
  const d = pick(r, DIVISIONS.filter((x) => x.quotient === quotient && x.y !== quotient && (exact ? x.remainder === 0 : x.remainder > 0)))
  const run = subtract(d.x, d.y)
  const last = exact ? ` (${d.y} is still at least ${d.y}, so the last subtraction runs)` : ''
  return numericDraft(
    slot,
    {
      prompt: pick(r, COUNT_PROMPTS)(d.x, d.y),
      solution: `${run.steps.join(', ')}${last}, and ${run.x} is less than ${d.y}. count holds **${run.count}**, because ${d.y} fits into ${d.x} ${word(run.count)} times.`,
      method: [`subtracts ${d.y} while x is at least ${d.y}`],
      answer: run.count,
    },
    { agrees: run.count === Math.floor(d.x / d.y) && run.count === d.quotient, detail: `${d.x} DIV ${d.y} = ${Math.floor(d.x / d.y)}` },
    { x: d.x, y: d.y, exact: exact ? 'yes' : 'no', answer: run.count },
  )
}

// ---------------------------------------------------------------------------------------------
// q8: how many times a FOR loop runs
// ---------------------------------------------------------------------------------------------

/**
 * The bounds FOR i ← start TO LEN(a) − less, and how often each is drawn. The count is
 * LEN(a) − (start + less − 1), and the weights spread start + less − 1 evenly over 1 to 4, so no
 * one "length minus c" rule pays in more than a quarter of builds; the loop starts at 1 (where the
 * end value alone is the count) in under a fifth. Never 0 to LEN(a) − 1 or 1 to LEN(a), where the
 * count is the list's length; never TO LEN(a), whose last i is past the end.
 */
export const BOUNDS = [
  { start: 0, less: 2, weight: 20 },
  { start: 1, less: 1, weight: 5 },
  { start: 0, less: 3, weight: 8 },
  { start: 1, less: 2, weight: 7 },
  { start: 2, less: 1, weight: 10 },
  { start: 1, less: 3, weight: 5 },
  { start: 2, less: 2, weight: 10 },
  { start: 3, less: 1, weight: 10 },
  { start: 2, less: 3, weight: 12 },
  { start: 3, less: 2, weight: 13 },
] as const

/** Array names a list of items might have. */
export const LISTS = ['a', 'marks', 'scores', 'names', 'prices', 'times'] as const

const LOOP_PROMPTS = [
  (head: string, n: number) => `A FOR loop is written as ${head}, and the list holds ${n} items. How many times does the loop body run?`,
  (head: string, n: number) => `The list holds ${n} items, and an algorithm loops over it with ${head}. How many times does the loop body run?`,
  (head: string, n: number) => `An algorithm runs ${head} over a list of ${n} items. How many times does the body of the loop run?`,
]

/**
 * q8: 1 mark. Written: FOR i ← 1 TO LEN(a) − 1 over 6 items runs 5 times. Four to twelve items, and
 * the count is never the printed start or the number taken off LEN.
 */
function loopCount(r: Rng, slot: Question): Draft {
  const b = weighted(r, BOUNDS.map((x) => [x, x.weight] as const))
  const c = b.start + b.less - 1
  // At least two runs, and a count that is not the start or the number taken off.
  const lengths: number[] = []
  for (let n = Math.max(4, c + 2); n <= 12; n++) if (n - c !== b.start && n - c !== b.less) lengths.push(n)
  const n = pick(r, lengths)
  const list = pick(r, LISTS)
  const end = n - b.less
  const head = `FOR i ← ${b.start} TO LEN(${list}) − ${b.less}`
  // Run the loop, counting the body.
  const values: number[] = []
  for (let i = b.start; i <= end; i++) values.push(i)
  const answer = values.length
  return numericDraft(
    slot,
    {
      prompt: pick(r, LOOP_PROMPTS)(head, n),
      solution: `LEN(${list}) − ${b.less} is ${end}, so i takes the values ${commaList(values)}. That is **${answer}** times.`,
      method: [],
      answer,
    },
    { agrees: answer === end - b.start + 1, detail: `${end} − ${b.start} + 1 = ${end - b.start + 1}` },
    { list, n, start: b.start, less: b.less, answer },
  )
}

// ---------------------------------------------------------------------------------------------
// q14: counting vowels
// ---------------------------------------------------------------------------------------------

/**
 * Everyday words with a repeated vowel, grouped by how many of a, e, i, o, u they hold, about half
 * of them with a y. Counting a repeated vowel once never gives the answer; nor does counting y as a
 * vowel where there is one, nor both slips together (each y-word repeats a vowel at least twice
 * over); nor counting the other letters. The words without a y keep "it has a y in it" from being
 * a signal that always comes with the question.
 */
export const VOWEL_WORDS: Record<number, { y: readonly string[]; plain: readonly string[] }> = {
  2: { y: [], plain: ['bottom', 'cotton', 'dessert', 'kettle', 'letter', 'mammal', 'pepper', 'screen', 'street'] },
  3: {
    y: ['cemetery', 'emergency', 'infinity', 'jewellery', 'simplicity'],
    plain: [
      'alphabet', 'balloon', 'basketball', 'bedroom', 'calendar', 'caravan', 'cartoon', 'classroom', 'coconut', 'elephant',
      'football', 'homework', 'integer', 'internet', 'newspaper', 'paragraph', 'processor', 'science', 'sentence', 'shampoo',
    ],
  },
  4: {
    y: [
      'definitely', 'desperately', 'efficiency', 'electricity', 'elementary', 'flexibility', 'independently', 'possibility',
      'repeatedly', 'separately', 'similarity', 'unusually', 'visibility',
    ],
    plain: [
      'afternoon', 'avocado', 'calculator', 'centimetre', 'chocolate', 'detective', 'headphones', 'kilometre', 'mathematics',
      'microphone', 'perimeter', 'referee', 'restaurant', 'telephone', 'telescope', 'volunteer',
    ],
  },
  5: {
    y: [
      'accessibility', 'additionally', 'compatibility', 'deliberately', 'familiarity', 'immediately', 'impossibility',
      'invisibility', 'nationality', 'occasionally', 'originality', 'reliability', 'responsibility', 'traditionally',
    ],
    plain: ['information'],
  },
}

const VOWEL_PROMPTS = [
  (s: string) => `An algorithm counts the characters of a string that are a, e, i, o or u. What does it output for the string '${s}'?`,
  (s: string) => `An algorithm goes through a string one character at a time and adds 1 to count whenever the character is a, e, i, o or u. It then outputs count. What does it output for the string '${s}'?`,
  (s: string) => `An algorithm outputs how many characters of a string are one of a, e, i, o and u. What does it output when the string is '${s}'?`,
]

/** A character as a string holds it: 'a'. */
const quote = (ch: string) => `'${ch}'`

/** Runs the counting loop with SUBSTRING(i, i, s), a character at a time. */
export function countVowels(s: string) {
  let count = 0
  const found: string[] = []
  for (let i = 0; i <= s.length - 1; i++) {
    const ch = s.substring(i, i + 1)
    if (['a', 'e', 'i', 'o', 'u'].includes(ch)) {
      count++
      found.push(ch)
    }
  }
  return { count, found }
}

/** q14: 2 marks. Written: 'computer' holds o, u and e, so 3. The count is drawn first (2 to 5), then a word. */
function vowels(r: Rng, slot: Question): Draft {
  const want = weighted(r, [[2, 3], [3, 6], [4, 7], [5, 4]] as const)
  const words = VOWEL_WORDS[want]!
  // A word without a y at most two times in five where the count has y-words, and no more often
  // than its share of the count's words (a count of 2 has none: a y-word with one repeat would let
  // "y counted, the repeat counted once" pay).
  const plain = words.y.length ? Math.min(0.4, words.plain.length / (words.y.length + words.plain.length)) : 1
  const s = pick(r, r() < plain ? words.plain : words.y)
  const { count, found } = countVowels(s)
  const repeated = [...new Set(found)].filter((ch) => found.indexOf(ch) !== found.lastIndexOf(ch))
  const ys = s.split('y').length - 1
  return numericDraft(
    slot,
    {
      prompt: pick(r, VOWEL_PROMPTS)(s),
      // Letters are quoted, as characters of a string: an unquoted list reads "a and i" as an article.
      solution: `The characters of **${s}** that are a, e, i, o or u are ${andList(found.map(quote))}, so the output is **${count}**. ${ys ? "The 'y' is not one of the five letters, and the" : 'The'} repeated ${andList(repeated.map(quote))} ${repeated.length > 1 ? 'count' : 'counts'} each time ${repeated.length > 1 ? 'they appear' : 'it appears'}.`,
      method: ['counts only a, e, i, o and u, each time one appears'],
      answer: count,
    },
    // Second route: delete every other character and measure what is left.
    { agrees: s.replace(/[^aeiou]/g, '').length === count && count === want, detail: `'${s}' without its other letters is '${s.replace(/[^aeiou]/g, '')}'` },
    { word: s, answer: count },
  )
}

// ---------------------------------------------------------------------------------------------
// q16: where a loop reads past the end
// ---------------------------------------------------------------------------------------------

/**
 * The loops q16 asks about: comparing with the next item (as written), or with the item two or three
 * places on, looping to LEN(a) − 1 (as written) or LEN(a) − 2. Each reads past the last position
 * first at i = LEN(a) − ahead. Three forms in five go wrong before the loop's last i, so neither "the
 * last value i takes" nor "LEN(a) − 1" is the answer more than half the time.
 */
export const OVERRUNS = [
  { ahead: 1, less: 1, weight: 8 },
  { ahead: 2, less: 1, weight: 4 },
  { ahead: 2, less: 2, weight: 2 },
  { ahead: 3, less: 1, weight: 3 },
  { ahead: 3, less: 2, weight: 3 },
] as const

/** "the item after it", "the item two places after it". */
const AFTER = ['', 'the item after it', 'the item two places after it', 'the item three places after it'] as const

const OVERRUN_PROMPTS = [
  (head: string, n: number, list: string, after: string, first: string) =>
    `An algorithm loops ${head} over a list of ${n} items, and inside the loop it compares ${list}[i] with ${after}. At which value of i does this ${first}go wrong?`,
  (head: string, n: number, list: string, after: string, first: string) =>
    `A list of ${n} items is processed by ${head}. Inside the loop, ${list}[i] is compared with ${after}. At which value of i does this ${first}go wrong?`,
]

/** q16: 3 marks. Written: FOR i ← 0 TO LEN(a) − 1 over 8 items, comparing with the next, fails at 7. */
function overrun(r: Rng, slot: Question): Draft {
  const o = weighted(r, OVERRUNS.map((x) => [x, x.weight] as const))
  const n = int(r, o.ahead + 3, 12)
  const start = r() < 0.6 ? 0 : 1
  const list = pick(r, LISTS)
  const head = `FOR i ← ${start} TO LEN(${list}) − ${o.less}`
  const after = AFTER[o.ahead]
  // Run the loop, stopping at the first i whose comparison reads a position that does not exist.
  let wrong = -1
  for (let i = start; i <= n - o.less; i++) {
    if (i + o.ahead > n - 1) {
      wrong = i
      break
    }
  }
  // "first" where later values of i go wrong too.
  const several = o.less < o.ahead
  return numericDraft(
    slot,
    {
      prompt: pick(r, OVERRUN_PROMPTS)(head, n, list, after, several ? 'first ' : ''),
      solution: `The last position is ${n - 1}, so when i is **${wrong}** the algorithm looks for ${list}[${n}], which does not exist. The loop should have stopped at LEN(${list}) − ${o.ahead + 1}.`,
      method: [`the last valid position is ${n - 1}`, `${list}[i + ${o.ahead}] would then be ${list}[${n}]`],
      answer: wrong,
    },
    { agrees: wrong === n - o.ahead, detail: `LEN − ${o.ahead} = ${n - o.ahead}` },
    { list, n, start, ahead: o.ahead, less: o.less, answer: wrong },
  )
}

// ---------------------------------------------------------------------------------------------
// q20: the input line
// ---------------------------------------------------------------------------------------------

export type Role = 'set' | 'message' | 'input' | 'process' | 'output'
/** A line of a program: its indent (in steps of three spaces), its text and what it does. */
export type Line = [number, string, Role]

const input = (v: string, text = false): Line => [0, `${v} ← ${text ? 'USERINPUT' : 'STRING_TO_INT(USERINPUT)'}`, 'input']
const indent = (lines: Line[]): Line[] => lines.map(([d, t, k]) => [d + 1, t, k])
const yesNo = [false, true] as const

/**
 * Short programs with one input line each, every one in several forms: a message line before the
 * input (output, the trap), starting values before or after it, and the constants a real version
 * would have. The written program is the first form of the first.
 */
export const PROGRAMS: Line[][] = []
const add = (lines: Line[]) => PROGRAMS.push(lines)

// Totals 1 to n (the written program), or the squares 1 to n.
for (const setFirst of yesNo) for (const message of ['', 'Enter a whole number', 'How many numbers?']) for (const body of ['total + i', 'total + i * i']) {
  const set: Line = [0, 'total ← 0', 'set']
  const take: Line[] = [...(message ? [[0, `OUTPUT '${message}'`, 'message'] as Line] : []), input('n')]
  add([...(setFirst ? [set, ...take] : [...take, set]), [0, 'FOR i ← 1 TO n', 'process'], [1, `total ← ${body}`, 'process'], [0, 'ENDFOR', 'process'], [0, 'OUTPUT total', 'output']])
}
// A times table.
for (const message of yesNo) for (const last of [5, 10, 12]) {
  add([...(message ? [[0, "OUTPUT 'Which times table?'", 'message'] as Line] : []), input('n'), [0, `FOR i ← 1 TO ${last}`, 'process'], [1, 'OUTPUT n * i', 'output'], [0, 'ENDFOR', 'process']])
}
// Doubling up to a limit, then the result or how many doublings it took.
for (const counted of ['no', 'after', 'before'] as const) for (const message of yesNo) for (const limit of [100, 500, 1000]) for (const show of counted === 'no' ? ['n'] : ['count']) {
  const set: Line[] = counted === 'no' ? [] : [[0, 'count ← 0', 'set']]
  const take: Line[] = [...(message ? [[0, "OUTPUT 'Enter a number'", 'message'] as Line] : []), input('n')]
  const body: Line[] = [[1, 'n ← n * 2', 'process'], ...(counted === 'no' ? [] : [[1, 'count ← count + 1', 'process'] as Line])]
  add([...(counted === 'before' ? [...set, ...take] : [...take, ...set]), [0, `WHILE n < ${limit}`, 'process'], ...body, [0, 'ENDWHILE', 'process'], [0, `OUTPUT ${show}`, 'output']])
}
// An age check.
for (const message of yesNo) for (const age of [13, 16, 18]) {
  add([
    ...(message ? [[0, "OUTPUT 'How old are you?'", 'message'] as Line] : []),
    input('age'),
    [0, `IF age ≥ ${age} THEN`, 'process'],
    [1, "OUTPUT 'Old enough'", 'output'],
    [0, 'ELSE', 'process'],
    [1, "OUTPUT 'Too young'", 'output'],
    [0, 'ENDIF', 'process'],
  ])
}
// A countdown.
for (const message of yesNo) for (const step of [1, 2]) {
  add([
    ...(message ? [[0, "OUTPUT 'Count down from?'", 'message'] as Line] : []),
    input('n'),
    [0, 'WHILE n > 0', 'process'],
    [1, 'OUTPUT n', 'output'],
    [1, `n ← n - ${step}`, 'process'],
    [0, 'ENDWHILE', 'process'],
    [0, "OUTPUT 'Lift off'", 'output'],
  ])
}
// Totals a number of marks typed in one at a time: the input is inside the loop.
for (const message of ['', 'before', 'inside'] as const) for (const k of [3, 4, 5]) {
  add([
    [0, 'total ← 0', 'set'],
    ...(message === 'before' ? [[0, `OUTPUT 'Enter ${k} marks'`, 'message'] as Line] : []),
    [0, `FOR i ← 1 TO ${k}`, 'process'],
    ...indent([...(message === 'inside' ? [[0, "OUTPUT 'Enter a mark'", 'message'] as Line] : []), input('mark'), [0, 'total ← total + mark', 'process']]),
    [0, 'ENDFOR', 'process'],
    [0, 'OUTPUT total', 'output'],
  ])
}
// Asks again until the score is in range.
for (const message of yesNo) for (const top of [10, 20, 100]) {
  add([
    [0, 'REPEAT', 'process'],
    ...indent([...(message ? [[0, `OUTPUT 'Enter a score from 0 to ${top}'`, 'message'] as Line] : []), input('score')]),
    [0, `UNTIL score ≥ 0 AND score ≤ ${top}`, 'process'],
    [0, 'OUTPUT score', 'output'],
  ])
}
// A name and its length.
for (const message of yesNo) {
  add([...(message ? [[0, "OUTPUT 'What is your name?'", 'message'] as Line] : []), input('name', true), [0, 'size ← LEN(name)', 'process'], [0, "OUTPUT 'Hello ' + name", 'output'], [0, 'OUTPUT size', 'output']])
}
// A password with a limited number of tries.
for (const message of yesNo) for (const password of ['open', 'letmein']) for (const tries of [3, 5]) {
  add([
    [0, 'attempts ← 0', 'set'],
    [0, 'REPEAT', 'process'],
    ...indent([...(message ? [[0, "OUTPUT 'Password?'", 'message'] as Line] : []), input('entry', true), [0, 'attempts ← attempts + 1', 'process']]),
    [0, `UNTIL entry = '${password}' OR attempts = ${tries}`, 'process'],
    [0, 'OUTPUT attempts', 'output'],
  ])
}
// Odd or even, or a multiple of 3 or not.
for (const message of yesNo) for (const [k, yes, no] of [[2, 'even', 'odd'], [3, 'multiple of 3', 'not a multiple of 3']] as const) {
  add([
    ...(message ? [[0, "OUTPUT 'Enter a whole number'", 'message'] as Line] : []),
    input('n'),
    [0, `IF n MOD ${k} = 0 THEN`, 'process'],
    [1, `OUTPUT '${yes}'`, 'output'],
    [0, 'ELSE', 'process'],
    [1, `OUTPUT '${no}'`, 'output'],
    [0, 'ENDIF', 'process'],
  ])
}
// Adds numbers typed in until the total passes a limit: the input is inside the loop.
for (const message of yesNo) for (const limit of [50, 100]) {
  add([
    [0, 'total ← 0', 'set'],
    [0, `WHILE total ≤ ${limit}`, 'process'],
    ...indent([...(message ? [[0, "OUTPUT 'Enter a number'", 'message'] as Line] : []), input('n'), [0, 'total ← total + n', 'process']]),
    [0, 'ENDWHILE', 'process'],
    [0, 'OUTPUT total', 'output'],
  ])
}
// A ticket price by age.
for (const message of yesNo) for (const [child, adult] of [[5, 8], [4, 7]]) {
  add([
    ...(message ? [[0, "OUTPUT 'How old are you?'", 'message'] as Line] : []),
    input('age'),
    [0, 'IF age < 16 THEN', 'process'],
    [1, `price ← ${child}`, 'process'],
    [0, 'ELSE', 'process'],
    [1, `price ← ${adult}`, 'process'],
    [0, 'ENDIF', 'process'],
    [0, 'OUTPUT price', 'output'],
  ])
}
// Celsius to Fahrenheit, and back.
for (const message of yesNo) {
  add([...(message ? [[0, "OUTPUT 'Temperature in Celsius?'", 'message'] as Line] : []), input('c'), [0, 'f ← c * 9 / 5 + 32', 'process'], [0, 'OUTPUT f', 'output']])
  add([...(message ? [[0, "OUTPUT 'Temperature in Fahrenheit?'", 'message'] as Line] : []), input('f'), [0, 'c ← (f - 32) * 5 / 9', 'process'], [0, 'OUTPUT c', 'output']])
}
// Counts one letter in a word.
for (const message of yesNo) for (const letter of ['a', 'e', 's']) {
  add([
    [0, 'count ← 0', 'set'],
    ...(message ? [[0, "OUTPUT 'Enter a word'", 'message'] as Line] : []),
    input('word', true),
    [0, 'FOR i ← 0 TO LEN(word) - 1', 'process'],
    [1, `IF SUBSTRING(i, i, word) = '${letter}' THEN`, 'process'],
    [2, 'count ← count + 1', 'process'],
    [1, 'ENDIF', 'process'],
    [0, 'ENDFOR', 'process'],
    [0, 'OUTPUT count', 'output'],
  ])
}

// Pass or fail against a pass mark.
for (const message of yesNo) for (const pass of [40, 50]) {
  add([
    ...(message ? [[0, "OUTPUT 'Enter your mark'", 'message'] as Line] : []),
    input('mark'),
    [0, `IF mark ≥ ${pass} THEN`, 'process'],
    [1, "OUTPUT 'Pass'", 'output'],
    [0, 'ELSE', 'process'],
    [1, "OUTPUT 'Fail'", 'output'],
    [0, 'ENDIF', 'process'],
  ])
}
// A square or a cube.
for (const message of yesNo) for (const [name, times] of [['square', 'n * n'], ['cube', 'n * n * n']] as const) {
  add([...(message ? [[0, "OUTPUT 'Enter a number'", 'message'] as Line] : []), input('n'), [0, `${name} ← ${times}`, 'process'], [0, `OUTPUT ${name}`, 'output']])
}
// Minutes into hours and minutes.
for (const message of yesNo) {
  add([
    ...(message ? [[0, "OUTPUT 'How many minutes?'", 'message'] as Line] : []),
    input('m'),
    [0, 'hours ← m DIV 60', 'process'],
    [0, 'left ← m MOD 60', 'process'],
    [0, 'OUTPUT hours', 'output'],
    [0, 'OUTPUT left', 'output'],
  ])
}
// Counts the positive numbers among several typed in: the input is inside the loop.
for (const message of yesNo) for (const k of [5, 10]) {
  add([
    [0, 'count ← 0', 'set'],
    [0, `FOR i ← 1 TO ${k}`, 'process'],
    ...indent([
      ...(message ? [[0, "OUTPUT 'Enter a number'", 'message'] as Line] : []),
      input('n'),
      [0, 'IF n > 0 THEN', 'process'],
      [1, 'count ← count + 1', 'process'],
      [0, 'ENDIF', 'process'],
    ]),
    [0, 'ENDFOR', 'process'],
    [0, 'OUTPUT count', 'output'],
  ])
}
// A guessing game against a number it sets itself.
for (const message of yesNo) for (const secret of [7, 23, 42]) {
  add([
    [0, `secret ← ${secret}`, 'set'],
    [0, 'REPEAT', 'process'],
    ...indent([...(message ? [[0, "OUTPUT 'Guess the number'", 'message'] as Line] : []), input('guess')]),
    [0, 'UNTIL guess = secret', 'process'],
    [0, "OUTPUT 'Correct'", 'output'],
  ])
}

// A discount on a price over a threshold.
for (const message of yesNo) {
  add([
    ...(message ? [[0, "OUTPUT 'Enter the price'", 'message'] as Line] : []),
    input('price'),
    [0, 'IF price > 50 THEN', 'process'],
    [1, 'price ← price - 10', 'process'],
    [0, 'ENDIF', 'process'],
    [0, 'OUTPUT price', 'output'],
  ])
}
// A grade from a mark.
for (const message of yesNo) {
  add([
    ...(message ? [[0, "OUTPUT 'Enter your mark'", 'message'] as Line] : []),
    input('mark'),
    [0, 'IF mark ≥ 70 THEN', 'process'],
    [1, "OUTPUT 'A'", 'output'],
    [0, 'ELSE IF mark ≥ 50 THEN', 'process'],
    [1, "OUTPUT 'B'", 'output'],
    [0, 'ELSE', 'process'],
    [1, "OUTPUT 'C'", 'output'],
    [0, 'ENDIF', 'process'],
  ])
}
// A linear search of a list it sets itself, for a number the user types.
for (const message of yesNo) {
  add([
    [0, 'a ← [3, 8, 5, 1]', 'set'],
    ...(message ? [[0, "OUTPUT 'Number to find?'", 'message'] as Line] : []),
    input('target'),
    [0, 'FOR i ← 0 TO 3', 'process'],
    [1, 'IF a[i] = target THEN', 'process'],
    [2, 'OUTPUT i', 'output'],
    [1, 'ENDIF', 'process'],
    [0, 'ENDFOR', 'process'],
  ])
}
// A word reversed, its empty string set before or after the input.
for (const message of yesNo) for (const setFirst of yesNo) {
  const set: Line = [0, "out ← ''", 'set']
  const take: Line[] = [...(message ? [[0, "OUTPUT 'Enter a word'", 'message'] as Line] : []), input('word', true)]
  add([
    ...(setFirst ? [set, ...take] : [...take, set]),
    [0, 'FOR i ← LEN(word) - 1 TO 0 STEP -1', 'process'],
    [1, 'out ← out + SUBSTRING(i, i, word)', 'process'],
    [0, 'ENDFOR', 'process'],
    [0, 'OUTPUT out', 'output'],
  ])
}
// How many digits a number has.
for (const message of yesNo) for (const setFirst of yesNo) {
  const set: Line = [0, 'digits ← 0', 'set']
  const take: Line[] = [...(message ? [[0, "OUTPUT 'Enter a whole number'", 'message'] as Line] : []), input('n')]
  add([
    ...(setFirst ? [set, ...take] : [...take, set]),
    [0, 'WHILE n > 0', 'process'],
    [1, 'n ← n DIV 10', 'process'],
    [1, 'digits ← digits + 1', 'process'],
    [0, 'ENDWHILE', 'process'],
    [0, 'OUTPUT digits', 'output'],
  ])
}
// A menu: two or three lines of output before the choice is typed.
for (const ask of yesNo) {
  add([
    [0, "OUTPUT '1 Play'", 'message'],
    [0, "OUTPUT '2 Quit'", 'message'],
    ...(ask ? [[0, "OUTPUT 'Choose 1 or 2'", 'message'] as Line] : []),
    input('choice'),
    [0, 'IF choice = 1 THEN', 'process'],
    [1, "OUTPUT 'Starting'", 'output'],
    [0, 'ELSE', 'process'],
    [1, "OUTPUT 'Goodbye'", 'output'],
    [0, 'ENDIF', 'process'],
  ])
}
// A speed check.
for (const message of yesNo) {
  add([
    ...(message ? [[0, "OUTPUT 'Speed in mph?'", 'message'] as Line] : []),
    input('speed'),
    [0, 'IF speed > 30 THEN', 'process'],
    [1, "OUTPUT 'Too fast'", 'output'],
    [0, 'ENDIF', 'process'],
  ])
}
// Weeks of saving to reach £100, the starting values set before or after the input.
for (const message of yesNo) for (const setFirst of yesNo) {
  const set: Line[] = [[0, 'saved ← 0', 'set'], [0, 'weeks ← 0', 'set']]
  const take: Line[] = [...(message ? [[0, "OUTPUT 'Pounds saved each week?'", 'message'] as Line] : []), input('weekly')]
  add([
    ...(setFirst ? [...set, ...take] : [...take, ...set]),
    [0, 'WHILE saved < 100', 'process'],
    [1, 'saved ← saved + weekly', 'process'],
    [1, 'weeks ← weeks + 1', 'process'],
    [0, 'ENDWHILE', 'process'],
    [0, 'OUTPUT weeks', 'output'],
  ])
}

/** The line number (from 1) of a program's input. */
export const inputLine = (p: Line[]) => p.findIndex(([, , k]) => k === 'input') + 1

/** "line 6", "lines 3 to 5", "lines 1 and 6", "lines 2, 4 and 5". */
export function lineNames(ns: number[]): string {
  if (ns.length === 1) return `line ${ns[0]}`
  const runs: number[][] = []
  for (const n of ns) {
    const run = runs.at(-1)
    if (run && n === run.at(-1)! + 1) run.push(n)
    else runs.push([n])
  }
  const parts = runs.flatMap((run) => (run.length >= 3 ? [`${run[0]} to ${run.at(-1)}`] : run.map(String)))
  return `lines ${andList(parts)}`
}

/** The program as the written q20 prints it: "1  total ← 0", with three spaces per indent. */
export const numbered = (p: Line[]) => p.map(([d, t], i) => `${i + 1}  ${'   '.repeat(d)}${t}`).join('\n')

/** Which input line is drawn how often: none over two builds in five. */
const LINE_WEIGHTS: [number, number][] = [[1, 3], [2, 3], [3, 3], [4, 2]]

/**
 * q20: 1 mark. Written: the total-to-n program, input on line 2. The input line is drawn first,
 * then a program with its input there.
 */
function inputLineOf(r: Rng, slot: Question): Draft {
  const at = weighted(r, LINE_WEIGHTS)
  const p = pick(r, PROGRAMS.filter((x) => inputLine(x) === at))
  const text = numbered(p)
  const of = (role: Role) => p.flatMap(([, , k], i) => (k === role ? [i + 1] : []))
  const inputText = p[at - 1]![1]
  const parts: string[] = []
  const set = of('set')
  if (set.length) parts.push(`${lineNames(set)} only ${set.length > 1 ? 'set starting values' : 'sets a starting value'}`)
  const message = of('message')
  const process = of('process')
  if (process.length) parts.push(`${lineNames(process)} ${process.length > 1 ? 'are' : 'is'} the processing`)
  const output = of('output')
  if (output.length) parts.push(`${lineNames(output)} ${output.length > 1 ? 'are' : 'is'} the output`)
  const rest = parts.length > 1 ? `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}` : parts[0]!
  const reads = inputText.includes('STRING_TO_INT') ? '`USERINPUT` reads what the user types, and `STRING_TO_INT` turns it into a whole number' : '`USERINPUT` reads what the user types'
  // Second route: read the printed code back and find the line that mentions USERINPUT.
  const found = text.split('\n').filter((l) => /\bUSERINPUT\b/.test(l)).map((l) => Number(/^(\d+) /.exec(l)![1]))
  return numericDraft(
    slot,
    {
      prompt: `Here is an algorithm with its lines numbered.\n\n\`\`\`\n${text}\n\`\`\`\n\nWhich line number takes the input?`,
      solution: `Line **${at}** is the input: ${reads}.${message.length === 1 ? ` Line ${message[0]} only shows a message asking for it, which is output, not input.` : message.length ? ` ${lineNames(message).replace(/^l/, 'L')} only show messages, which are output, not input.` : ''} ${rest.charAt(0).toUpperCase()}${rest.slice(1)}.`,
      method: [],
      answer: at,
    },
    { agrees: found.length === 1 && found[0] === at, detail: `USERINPUT printed on line ${found.join(', ')}` },
    { program: PROGRAMS.indexOf(p), lines: p.length, answer: at },
  )
}

export const purposeGenerators: Generator[] = [
  csBySlot('cs-purpose-largest', 'determining-the-purpose-of-an-algorithm', { q2: finder }),
  csBySlot('cs-purpose-total', 'determining-the-purpose-of-an-algorithm', { q5: runningTotal }),
  csBySlot('cs-purpose-division', 'determining-the-purpose-of-an-algorithm', { q7: remainderLeft, q11: countSubtractions }),
  csBySlot('cs-purpose-loop-count', 'determining-the-purpose-of-an-algorithm', { q8: loopCount }),
  csBySlot('cs-purpose-vowels', 'determining-the-purpose-of-an-algorithm', { q14: vowels }),
  csBySlot('cs-purpose-overrun', 'determining-the-purpose-of-an-algorithm', { q16: overrun }),
  csBySlot('cs-purpose-input-line', 'determining-the-purpose-of-an-algorithm', { q20: inputLineOf }),
]
