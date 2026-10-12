import type { Question } from '../../content/questions.ts'
import { pick, type Rng, weighted } from '../random.ts'
import type { Draft, Generator } from '../types.ts'
import { bin, csBySlot, numericDraft } from './build.ts'
import { show } from '../format.ts'

/**
 * Computer Science (AQA 8525) generators: binary-arithmetic, 3.3.4 binary shifts. The
 * specification asks for a logical shift only, on at most 8 bits, and for shifts "to perform
 * simple multiplication/division by powers of 2"; fractions are not used, so a right shift
 * drops the bits that fall off the end.
 *
 * - q4: the power of two a stated shift multiplies or divides by (the written question names no
 *   number; to reach a hundred distinct prompts the generated one states the 8-bit number being
 *   shifted, left or right, and no 1 is lost, so the division is exact).
 * - q7: the value after a right shift that loses a 1 (41 shifted one place is 20, not 20.5).
 * - q14: the value after a left shift that loses nothing.
 *
 * Shifts of one or two places are not drawn where a rule is asked: two places multiplies by
 * 2 × 2 = 2 + 2 = 4, and one place by 2 × 1 = 2, so "multiply by twice the number of places"
 * would pay. q7 drops a 1 in the highest lost column, so exact division rounded to the nearest
 * whole number (20.5 to 21) never gives the answer either.
 *
 * The sheets print shifts these must not repeat: the core sheet adds 00111010 and 00010110
 * (q2, making 01010000); the higher sheet adds 00001111, 00000011 and 00000101 (q5), shifts
 * 00010110 two places left (q6, 01011000) and 01101000 three right (q19, 00001101); the advanced
 * sheet divides 11001000 (200) by 4 to 00110010 (50) in q20. None of those numbers or results is
 * drawn here.
 */
const TOPIC = 'binary-arithmetic'

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six']
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)
const places = (p: number) => `${WORDS[p]} place${p === 1 ? '' : 's'}`
/**
 * Numbers each slot's sheet prints, as values, which its shifts neither start from nor reach:
 * core (q4) 58 + 22 = 80 in q2; higher (q7) 15 + 3 + 5 = 23 in q5, 22 to 88 in q6 and 104 to 13 in
 * q19; advanced (q14) 200 to 50 in q20, whose wrong options print 12 and 100.
 */
export const SHEET_VALUES = {
  core: new Set([58, 22, 80]),
  higher: new Set([15, 3, 5, 23, 22, 88, 104, 13]),
  advanced: new Set([200, 50, 12, 100]),
}

const ones = (n: number) => bin(n).split('').filter((c) => c === '1').length
const PLACES = [128, 64, 32, 16, 8, 4, 2, 1]

/** Read eight bits by their place values, written here rather than parsed by the language. */
function value(bits: string): number {
  return PLACES.reduce((s, p, i) => s + (bits[i] === '1' ? p : 0), 0)
}
/** The place values under the 1s, as a sum: "8 + 4 + 1". */
const sumOf = (bits: string) => PLACES.filter((_, i) => bits[i] === '1').join(' + ')
/** A logical shift on the bit pattern itself: zeros come in, bits that leave are gone. */
function shift(bits: string, p: number, dir: 'left' | 'right'): string {
  return dir === 'left' ? bits.slice(p) + '0'.repeat(p) : '0'.repeat(p) + bits.slice(0, bits.length - p)
}
/** 2^p by doubling, a second way to the multiplier. */
const doubled = (p: number) => Array.from({ length: p }).reduce<number>((x) => x * 2, 1)


// ---------------------------------------------------------------------------------------------
// q4: the multiplier or divisor
// ---------------------------------------------------------------------------------------------

/**
 * The numbers a shift of p places in a direction can be given, losing no 1: left, anything up to
 * 255 >> p; right, those with p zeros at the end. At least two 1s, and none the sheets print.
 */
export function lossless(p: number, dir: 'left' | 'right', avoid: Set<number>): number[] {
  const out: number[] = []
  for (let m = 1; m <= 255 >> p; m++) {
    const n = dir === 'left' ? m : m << p
    if (ones(n) >= 2 && !avoid.has(n) && !avoid.has(dir === 'left' ? n << p : m)) out.push(n)
  }
  return out
}

/**
 * Places for q4: 3 to 6 (one and two hide the 2 × places slip). Six places has one number each way
 * (00000011 left, 11000000 right), so it is drawn about one time in twelve.
 */
export const Q4_PLACES: [number, number][] = [[3, 34], [4, 32], [5, 26], [6, 8]]

const Q4_PROMPTS = {
  left: [
    (b: string, w: string) => `The binary number ${b} is shifted ${w} to the left. By what number is its value multiplied?`,
    (b: string, w: string) => `The 8-bit number ${b} is shifted ${w} left. By what number has its value been multiplied?`,
    (b: string, w: string) => `A logical shift moves the binary number ${b} ${w} to the left. By what number is its value multiplied?`,
  ],
  right: [
    (b: string, w: string) => `The binary number ${b} is shifted ${w} to the right. By what number is its value divided?`,
    (b: string, w: string) => `The 8-bit number ${b} is shifted ${w} right. By what number has its value been divided?`,
    (b: string, w: string) => `A logical shift moves the binary number ${b} ${w} to the right. By what number is its value divided?`,
  ],
}

/** q4: 1 mark. Written: three places left multiplies by 2^3 = 8. */
function shiftFactor(r: Rng, slot: Question): Draft {
  const dir = pick(r, ['left', 'right'] as const)
  const p = weighted(r, Q4_PLACES)
  const n = pick(r, lossless(p, dir, SHEET_VALUES.core))
  const factor = 2 ** p
  const b = bin(n)
  const after = shift(b, p, dir)
  const [v0, v1] = [value(b), value(after)]
  const solution =
    dir === 'left'
      ? `Each place left multiplies the value by 2, so ${places(p)} multiply it by $2^${p} = $ **${factor}**. Check: \`${b}\` is ${v0}, and shifted it is \`${after}\` = ${v1}, which is $${v0} \\times ${factor}$.`
      : `Each place right divides the value by 2, so ${places(p)} divide it by $2^${p} = $ **${factor}**. Check: \`${b}\` is ${v0}, and shifted it is \`${after}\` = ${v1}, which is $${v0} \\div ${factor}$. No 1 falls off the right-hand end, so the division is exact.`
  // Second route: shift the bit pattern itself and compare the values before and after.
  const ratio = dir === 'left' ? v1 / v0 : v0 / v1
  return numericDraft(
    slot,
    { prompt: pick(r, Q4_PROMPTS[dir])(b, places(p)), solution, method: [], answer: factor },
    { agrees: ratio === doubled(p) && ratio === factor, detail: `${b} → ${after}: ${v0} and ${v1}` },
    { direction: dir, places: p, binary: b, value: n, shifted: v1, answer: factor },
  )
}

// ---------------------------------------------------------------------------------------------
// q7: a right shift that loses a 1
// ---------------------------------------------------------------------------------------------

/**
 * The numbers a right shift of p places is given: a 1 in the highest column that falls off (so
 * exact division leaves .5 or more, and rounding it to the nearest whole number is wrong), a
 * result of 3 or more, and none the sheets print.
 */
export function lossy(p: number): number[] {
  const out: number[] = []
  for (let n = 0; n <= 255; n++) {
    if ((n >> (p - 1)) % 2 !== 1 || n >> p < 3) continue
    if (SHEET_VALUES.higher.has(n) || SHEET_VALUES.higher.has(n >> p)) continue
    out.push(n)
  }
  return out
}

/** Places for q7: one (as written) most often, then two and three. */
export const Q7_PLACES: [number, number][] = [[1, 40], [2, 35], [3, 25]]

const Q7_PROMPTS = [
  (b: string, w: string) => `The binary number ${b} is shifted ${w} right. What is the decimal value of the result?`,
  (b: string, w: string) => `A logical shift moves the binary number ${b} ${w} to the right. What is the decimal value of the result?`,
  (b: string, w: string) => `The 8-bit number ${b} is shifted ${w} to the right. Give the decimal value of the number stored.`,
]

/** q7: 2 marks. Written: 00101001 (41) one place right is 00010100 = 20, not 20.5. */
function shiftRightLoss(r: Rng, slot: Question): Draft {
  const p = weighted(r, Q7_PLACES)
  const n = pick(r, lossy(p))
  const b = bin(n)
  const after = shift(b, p, 'right')
  const answer = n >> p
  const lost = b.slice(8 - p)
  const exact = show(n / 2 ** p)
  const gone =
    p === 1
      ? 'The 1 in the units column falls off the end and is lost'
      : `The bits \`${lost}\` in the ${WORDS[p]} right-hand columns fall off the end and are lost`
  return numericDraft(
    slot,
    {
      prompt: pick(r, Q7_PROMPTS)(b, places(p)),
      solution: `\`${b}\` is $${sumOf(b)} = ${n}$. Shifting ${places(p)} right gives \`${after}\` = $${sumOf(after)} = $ **${answer}**. ${gone}, so the answer is ${answer} rather than $${n} \\div ${2 ** p} = ${exact}$.`,
      method: [`shifts to ${after}`],
      answer,
    },
    // Second route: the shifted bit pattern read by its place values.
    { agrees: value(after) === answer && value(b) === n, detail: `${b} → ${after} = ${value(after)}` },
    { places: p, binary: b, value: n, answer },
  )
}

// ---------------------------------------------------------------------------------------------
// q14: a left shift that loses nothing
// ---------------------------------------------------------------------------------------------

/** Places for q14: three to five (two places is 2 × 2 = 2 + 2, which hides the slip). */
export const Q14_PLACES: [number, number][] = [[3, 50], [4, 30], [5, 20]]

const Q14_PROMPTS = [
  (b: string, w: string) => `The binary number ${b} is shifted ${w} to the left. What is the decimal value of the result?`,
  (b: string, w: string) => `A logical shift moves the binary number ${b} ${w} to the left. What is the decimal value of the result?`,
  (b: string, w: string) => `The 8-bit number ${b} is shifted ${w} left. Give the decimal value of the number stored.`,
  (b: string, w: string) => `After the binary number ${b} is shifted ${w} to the left, what is its value in decimal?`,
]

/** q14: 2 marks. Written: 00010101 (21) three places left is 21 × 8 = 168. */
function shiftLeftValue(r: Rng, slot: Question): Draft {
  const p = weighted(r, Q14_PLACES)
  const n = pick(r, lossless(p, 'left', SHEET_VALUES.advanced))
  const b = bin(n)
  const after = shift(b, p, 'left')
  const factor = 2 ** p
  const answer = n * factor
  return numericDraft(
    slot,
    {
      prompt: pick(r, Q14_PROMPTS)(b, places(p)),
      solution: `\`${b}\` is $${sumOf(b)} = ${n}$. ${cap(places(p))} left multiplies by $2^${p} = ${factor}$, so $${n} \\times ${factor} = $ **${answer}**. As binary that is \`${after}\` = $${sumOf(after)} = ${value(after)}$ ✓`,
      method: [`multiplies by ${factor}`],
      answer,
    },
    { agrees: value(after) === answer, detail: `${b} → ${after} = ${value(after)}` },
    { places: p, binary: b, value: n, answer },
  )
}

export const arithmeticGenerators: Generator[] = [
  csBySlot('cs-shift-factor', TOPIC, { q4: shiftFactor }),
  csBySlot('cs-shift-right-loss', TOPIC, { q7: shiftRightLoss }),
  csBySlot('cs-shift-left-value', TOPIC, { q14: shiftLeftValue }),
]
