import type { Question } from '../../content/questions.ts'
import { draw, int, pick, weighted, type Rng } from '../random.ts'
import type { Draft, Generator } from '../types.ts'
import { andList, csBySlot, fence, lastOutput, numericDraft, printedCode } from './build.ts'

/**
 * Computer Science (AQA 8525) generators for data-types-and-operators: 3.2.3 arithmetic
 * operations ("integer division, including remainders": 11 DIV 2 = 5 and 11 MOD 2 = 1), 3.2.4
 * relational operations (= ≠ < > ≤ ≥ "interpret them when used within algorithms"), 3.2.2
 * assignment and iteration where a trace needs them, and 3.2.9 random number generation
 * (RANDOM_INT(a, b), both ends included, as the lesson's s6 has it).
 *
 * - q2 and q3: one `a MOD b` or `a DIV b`, a up to 100 and b from 3 to 12 (the lesson's 100 MOD 7
 *   is the largest it works). MOD's remainder is never 0, never the quotient (DIV and MOD
 *   swapped), never b minus the remainder (counting up to the next multiple), never the digits
 *   of the decimal part of a / b, whole or rounded (MOD read as the decimal part), so MOD 9 and
 *   MOD 10 are never asked. DIV's quotient is never the remainder or b, b is never 10 (the tens
 *   digit read off), and in about six builds in seven the remainder is at least half of b, so
 *   rounding a / b to the nearest whole number seldom pays.
 * - q8: a two-digit number pulled apart with DIV 10 and MOD 10 (the lesson's s3): the tens digit
 *   minus the units digit as written (tens above units, so swapping DIV and MOD gives a negative),
 *   or the digits put back the other way round, where swapping them gives the number itself.
 * - q11: total ← n DIV d, then total combined with n MOD d in a way that does not commute: minus
 *   as written, total * k + (n MOD d), or (n MOD d) * 10 + total, so DIV and MOD swapped never
 *   pays; the remainder is at least half of d in about six builds in seven, so rounding n / d
 *   seldom gives the quotient.
 * - q14: precedence with DIV and MOD, as the lesson's s3 and s8 have it: brackets first, * before
 *   + and −, and DIV or MOD bracketed whenever a line mixes them with *. One form in three leaves
 *   + and * unbracketed, so reading left to right gives a different answer.
 * - q18: RANDOM_INT(lo, hi), multiplied by (or added to), then MOD, given the value it returned;
 *   in prose as written or as three lines of pseudo-code, run through the interpreter with that
 *   value.
 * - q20: count ← count + 1 inside FOR when (i MOD d) compared with k by one of = ≠ < > ≤ ≥ is
 *   True. d is 3, 4 or 5 (never 2: the higher sheet's q10 asks which test means "n is even"), the
 *   test is True at the loop's last i so a FOR read as one short never pays, and the count is
 *   never every pass, half of them (the test read the other way) or d.
 *
 * Every printed fragment is AQA pseudo-code in a fenced block, and the answer comes from running
 * that exact block (pseudo.ts) and from the generator's own working, which must agree.
 */

const TOPIC = 'data-types-and-operators'

/**
 * What a student who reads `a MOD b` as the decimal part of a / b might type: the digits after the
 * point as a whole number (17 / 5 = 3.4 gives 4; 100 / 7 = 14.2857… gives 2857), the first of them
 * (2), and the decimal part rounded to one or two places (37 / 11 = 3.36… gives 4 and 36). Empty
 * when b divides a.
 */
export function decimalSlips(a: number, b: number): number[] {
  const frac = (a % b) / b
  const digits = frac.toFixed(4).replace(/0+$/, '').slice(2)
  return digits ? [Number(digits), Number(digits[0]), Math.round(frac * 10) % 10, Math.round(frac * 100) % 100] : []
}

// ---------------------------------------------------------------------------------------------
// q2 and q3: one MOD or one DIV
// ---------------------------------------------------------------------------------------------

/**
 * q2: 1 mark. Written: 17 MOD 5 is 2. b is drawn first, evenly from 3 to 8, 11 and 12 (never 10,
 * whose remainder is the decimal digit of a / 10, nor 9, whose remainder r makes a / 9 recur
 * 0.rrr…), then the remainder from 1 to b − 1 and a quotient of at least 2 with a = qb + r at most
 * 100. Drawing the remainder first put b at 11 or 12 in two builds in three.
 */
function modulo(r: Rng, slot: Question): Draft {
  const b = pick(r, [3, 4, 5, 6, 7, 8, 11, 12])
  const { a, q, rem } = draw(
    r,
    (r) => {
      const rem = int(r, 1, b - 1)
      const q = int(r, 2, Math.floor((100 - rem) / b))
      return { a: q * b + rem, q, rem }
    },
    ({ a, q, rem }) => q !== rem && b !== 2 * rem && a <= 100 && !decimalSlips(a, b).includes(rem),
  )
  const ran = lastOutput(`OUTPUT ${a} MOD ${b}`)
  return numericDraft(
    slot,
    {
      prompt: `Work out \`${a} MOD ${b}\`.`,
      solution: `**MOD** gives the remainder: $${a} = ${q} \\times ${b} + ${rem}$, so \`${a} MOD ${b}\` is **${rem}**.`,
      method: [],
      answer: rem,
    },
    { agrees: ran === rem && q * b + rem === a && rem < b, detail: `interpreter ${ran}; ${q} × ${b} + ${rem} = ${q * b + rem}` },
    { a, b, answer: rem },
  )
}

/**
 * q3: 1 mark. Written: 17 DIV 5 is 3. The quotient is drawn first, evenly from 2 to 12, then b
 * (3 to 12, not 10, not the quotient) and a remainder from 1 to b − 1 that is not the quotient; in
 * about six builds in seven the remainder is at least half of b, where rounding a / b gives one more.
 */
function intDiv(r: Rng, slot: Question): Draft {
  const q = int(r, 2, 12)
  const up = r() < 0.86
  const { a, b, rem } = draw(
    r,
    (r) => {
      const b = int(r, 3, Math.min(12, Math.floor(99 / q)))
      const rem = up ? int(r, Math.ceil(b / 2), b - 1) : int(r, 1, Math.max(1, Math.ceil(b / 2) - 1))
      return { a: q * b + rem, b, rem }
    },
    ({ a, b, rem }) => b !== 10 && b !== q && rem !== q && rem >= 1 && rem < b && a <= 100,
  )
  const ran = lastOutput(`OUTPUT ${a} DIV ${b}`)
  return numericDraft(
    slot,
    {
      prompt: `Work out \`${a} DIV ${b}\`.`,
      solution: `**DIV** is integer division, the whole number of times ${b} goes into ${a}: $${q} \\times ${b} = ${q * b}$, so \`${a} DIV ${b}\` is **${q}**. The remainder, ${rem}, is thrown away.`,
      method: [],
      answer: q,
    },
    { agrees: ran === q && q * b + rem === a && rem < b, detail: `interpreter ${ran}; ${q} × ${b} + ${rem} = ${a}` },
    { a, b, answer: q },
  )
}

// ---------------------------------------------------------------------------------------------
// q8: DIV 10 and MOD 10 take a number apart
// ---------------------------------------------------------------------------------------------

export type DigitForm = 'difference' | 'reverse'

/**
 * q8: 2 marks. Written: x ← 73, OUTPUT (x DIV 10) - (x MOD 10) gives 4. Six builds in ten take the
 * units digit from the tens digit, as written, with tens above units and the tens never twice the
 * units (where the answer is the units digit); the rest put the digits back the other way round.
 * Neither form commutes, so DIV and MOD swapped never pays.
 */
function digits(r: Rng, slot: Question): Draft {
  const form = weighted<DigitForm>(r, [['difference', 60], ['reverse', 40]])
  const v = pick(r, ['x', 'x', 'n'])
  const { tens, units } = draw(
    r,
    (r) => ({ tens: int(r, 1, 9), units: int(r, 1, 9) }),
    ({ tens, units }) => (form === 'difference' ? tens > units && tens !== 2 * units : tens !== units && units >= 2),
  )
  const x = 10 * tens + units
  const out = {
    difference: `OUTPUT (${v} DIV 10) - (${v} MOD 10)`,
    reverse: `OUTPUT (${v} MOD 10) * 10 + (${v} DIV 10)`,
  }[form]
  const code = `${v} ← ${x}\n${out}`
  const prompt = `What is output?\n\n${fence(code)}`
  const answer = form === 'difference' ? tens - units : 10 * units + tens
  const parts = `\`${x} DIV 10\` is ${tens} (the tens digit) and \`${x} MOD 10\` is ${units} (the units digit).`
  const solution = {
    difference: `${parts} $${tens} - ${units} = $ **${answer}**. DIV and MOD together pull a number apart into its digits; swapping them would give $${units} - ${tens} = -${answer}$.`,
    reverse: `${parts} The units digit is multiplied by 10 first, then the tens digit added: $${units} \\times 10 + ${tens} = $ **${answer}**, the digits of ${x} the other way round. Swapping DIV and MOD would give ${x} back.`,
  }[form]
  const ran = lastOutput(printedCode(prompt))
  return numericDraft(
    slot,
    { prompt, solution, method: [`${tens} and ${units}`], answer },
    { agrees: ran === answer, detail: `interpreter ${ran}; working ${answer}` },
    { form, x, answer },
  )
}

// ---------------------------------------------------------------------------------------------
// q11: a five-line trace with DIV and MOD
// ---------------------------------------------------------------------------------------------

export type CombineForm = 'minus' | 'scaled' | 'tens'

/** The output of each form, from n's quotient and remainder by d (and k for the scaled form). */
export function combine(form: CombineForm, q: number, rem: number, k: number): number {
  return form === 'minus' ? q - rem : form === 'scaled' ? q * k + rem : rem * 10 + q
}

/**
 * q11: 2 marks. Written: n ← 100, total ← n DIV 7, total ← total - (n MOD 7) gives 12. d from 3
 * to 8 (9 never: a remainder r makes n / 9 recur 0.rrr…), n = qd + r from 20 to 100 with the
 * remainder never the quotient and never a digit of the decimal part of n / d; the remainder is at
 * least half of d in about six builds in seven. Three forms, none of which commutes: total - (n MOD
 * d) as written (six in ten), total * k + (n MOD d), and (n MOD d) * 10 + total.
 */
function traceDivMod(r: Rng, slot: Question): Draft {
  const form = weighted<CombineForm>(r, [['minus', 60], ['scaled', 20], ['tens', 20]])
  const up = r() < 0.86
  const [t, v] = pick(r, [['total', 'n'], ['total', 'n'], ['total', 'x']] as const)
  const { n, d, q, rem, k } = draw(
    r,
    (r) => {
      const d = int(r, 3, 8)
      const rem = up ? int(r, Math.ceil(d / 2), d - 1) : int(r, 1, Math.max(1, Math.ceil(d / 2) - 1))
      const q = int(r, Math.max(2, Math.ceil((20 - rem) / d)), Math.floor((100 - rem) / d))
      return { n: q * d + rem, d, q, rem, k: int(r, 2, 5) }
    },
    ({ n, d, q, rem, k }) => {
      if (q === rem || decimalSlips(n, d).includes(rem)) return false
      if (form === 'minus' && q <= rem) return false
      if (form === 'scaled' && (k === q || k === rem || q * k + rem > 100)) return false
      const a = combine(form, q, rem, k)
      return ![n, d, q, rem, 0, combine(form, rem, q, k)].includes(a) && (form !== 'scaled' || a !== k)
    },
  )
  const line = { minus: `${t} ← ${t} - (${v} MOD ${d})`, scaled: `${t} ← ${t} * ${k} + (${v} MOD ${d})`, tens: `${t} ← (${v} MOD ${d}) * 10 + ${t}` }[form]
  const code = `${t} ← 0\n${v} ← ${n}\n${t} ← ${v} DIV ${d}\n${line}\nOUTPUT ${t}`
  const prompt = `What is output?\n\n${fence(code)}`
  const answer = combine(form, q, rem, k)
  const last = { minus: `${q} - ${rem}`, scaled: `${q} \\times ${k} + ${rem}`, tens: `${rem} \\times 10 + ${q}` }[form]
  const ran = lastOutput(printedCode(prompt))
  return numericDraft(
    slot,
    {
      prompt,
      solution: `\`${n} DIV ${d}\` is ${q} and \`${n} MOD ${d}\` is ${rem}. Line by line, ${t} is 0, then ${q}, then $${last} = $ **${answer}**. Write the value of each line in a trace table rather than working in your head.`,
      method: [`${q} and ${rem}`],
      answer,
    },
    { agrees: ran === answer && q * d + rem === n, detail: `interpreter ${ran}; ${n} = ${q} × ${d} + ${rem}` },
    { form, n, d, answer },
  )
}

// ---------------------------------------------------------------------------------------------
// q14: precedence with DIV and MOD
// ---------------------------------------------------------------------------------------------

export type PrecedenceForm = 'mod-times' | 'div-times' | 'unbracketed'

/**
 * q14: 3 marks. Written: a ← 8, b ← 3, c ← (a MOD b) * 2, OUTPUT c + (a DIV b) gives 6. a from 10
 * to 40, b from 3 to 9, the multiplier k from 2 to 5, the remainder never 0 and never the
 * quotient (so DIV and MOD swapped never pays), k never equal to either, and the answer never a
 * printed figure, c, q or r.
 * - mod-times (written): c ← (a MOD b) * k, OUTPUT c + (a DIV b).
 * - div-times: c ← (a DIV b) * k, OUTPUT c - (a MOD b).
 * - unbracketed: c ← a MOD b, OUTPUT c + (a DIV b) * k, where * comes before +.
 */
function precedence(r: Rng, slot: Question): Draft {
  const form = weighted<PrecedenceForm>(r, [['mod-times', 35], ['div-times', 30], ['unbracketed', 35]])
  const { a, b, k, q, rem } = draw(
    r,
    (r) => {
      const b = int(r, 3, 9)
      const a = int(r, Math.max(10, 2 * b + 1), 40)
      return { a, b, k: int(r, 2, 5), q: Math.floor(a / b), rem: a % b }
    },
    ({ a, b, k, q, rem }) => {
      if (rem === 0 || q === rem || k === q || k === rem || decimalSlips(a, b).includes(rem)) return false
      const { answer, c } = precedenceValues(form, q, rem, k)
      return answer > 0 && ![a, b, k, q, rem, c].includes(answer)
    },
  )
  const { answer, c } = precedenceValues(form, q, rem, k)
  const lines = {
    'mod-times': [`c ← (a MOD b) * ${k}`, 'OUTPUT c + (a DIV b)'],
    'div-times': [`c ← (a DIV b) * ${k}`, 'OUTPUT c - (a MOD b)'],
    unbracketed: ['c ← a MOD b', `OUTPUT c + (a DIV b) * ${k}`],
  }[form]
  const code = [`a ← ${a}`, `b ← ${b}`, ...lines].join('\n')
  const prompt = `What is output?\n\n${fence(code)}`
  const bracket = (op: string) => `Bracket a mixed \`${op}\`/\`*\` line rather than relying on precedence, because the exam languages do not agree on it.`
  const solution = {
    'mod-times': `The brackets say what to do first: \`${a} MOD ${b}\` is ${rem}, times ${k} is ${c}, so \`c\` is ${c}. Then \`a DIV b\` is \`${a} DIV ${b}\` = ${q}, and $${c} + ${q} = $ **${answer}**. ${bracket('MOD')}`,
    'div-times': `The brackets say what to do first: \`${a} DIV ${b}\` is ${q}, times ${k} is ${c}, so \`c\` is ${c}. Then \`a MOD b\` is \`${a} MOD ${b}\` = ${rem}, and $${c} - ${rem} = $ **${answer}**. ${bracket('DIV')}`,
    unbracketed: `\`${a} MOD ${b}\` is ${rem}, so \`c\` is ${rem}. In the output line the brackets come first, \`${a} DIV ${b}\` = ${q}, then the multiplication before the addition: $${q} \\times ${k} = ${q * k}$, and $${rem} + ${q * k} = $ **${answer}**. Working left to right would give $(${rem} + ${q}) \\times ${k} = ${(rem + q) * k}$, which is wrong.`,
  }[form]
  const method = {
    'mod-times': [`${a} MOD ${b} = ${rem}, so c = ${c}`, `${a} DIV ${b} = ${q}`],
    'div-times': [`${a} DIV ${b} = ${q}, so c = ${c}`, `${a} MOD ${b} = ${rem}`],
    unbracketed: [`${a} MOD ${b} = ${rem}, so c = ${rem}`, `${a} DIV ${b} = ${q}, times ${k} is ${q * k} before the addition`],
  }[form]
  const ran = lastOutput(printedCode(prompt))
  return numericDraft(
    slot,
    { prompt, solution, method, answer },
    { agrees: ran === answer, detail: `interpreter ${ran}; working ${answer}` },
    { form, a, b, k, answer },
  )
}

/** The value of c and the output for each form, from a's quotient and remainder by b. */
export function precedenceValues(form: PrecedenceForm, q: number, rem: number, k: number) {
  if (form === 'mod-times') return { c: rem * k, answer: rem * k + q }
  if (form === 'div-times') return { c: q * k, answer: q * k - rem }
  return { c: rem, answer: rem + q * k }
}

// ---------------------------------------------------------------------------------------------
// q18: a random number, then MOD
// ---------------------------------------------------------------------------------------------

/** The ranges RANDOM_INT is called with, and the variable each is stored in. */
const RANGES = [
  { lo: 1, hi: 6, v: 'dice', weight: 4 },
  { lo: 1, hi: 10, v: 'n', weight: 3 },
  { lo: 1, hi: 20, v: 'x', weight: 3 },
] as const

const RANDOM_PROSE = [
  (call: string, step: string, d: number, v: number) => `\`${call}\` is called and the result is ${step}, then \`MOD ${d}\` is applied and the result is output. If the random number was ${v}, what is output?`,
  (call: string, step: string, d: number, v: number) => `A program stores the result of \`${call}\`. The stored number is ${step}, then \`MOD ${d}\` is applied and the result is output. If \`${call}\` returned ${v}, what is output?`,
]

/**
 * q18: 2 marks. Written: RANDOM_INT(1, 6) returned 5, × 10 = 50, 50 MOD 7 = 1. The answer is drawn
 * first, evenly from 1 to 8, then d above it (3 to 12, not 10), the range, the value returned (2
 * or more) and the multiplier (2 to 12) or the number added (5 to 30), with the product or sum
 * more than d and at most 100. The answer is never the value returned, the multiplier, d, the
 * value MOD d without the multiplication, the MOD applied before the multiplication, or the
 * quotient, or the top of the range. Half the builds print the three lines of code instead of the prose.
 */
function randomMod(r: Rng, slot: Question): Draft {
  const answer = int(r, 1, 8)
  const asCode = r() < 0.5
  const { range, v, op, m, d, made } = draw(
    r,
    (r) => {
      const range = weighted(r, RANGES.map((x) => [x, x.weight] as const))
      const op = r() < 0.75 ? ('times' as const) : ('plus' as const)
      const d = pick(r, [3, 4, 5, 6, 7, 8, 9, 11, 12].filter((x) => x > answer))
      const v = int(r, Math.max(2, range.lo), range.hi)
      const m = op === 'times' ? int(r, 2, 12) : int(r, 5, 30)
      return { range, v, op, m, d, made: op === 'times' ? v * m : v + m }
    },
    ({ range, v, op, m, d, made }) => {
      if (made % d !== answer || made <= d || made > 100) return false
      const before = op === 'times' ? (v % d) * m : (v % d) + m
      return m !== range.hi && ![v, m, d, v % d, before, Math.floor(made / d), range.hi].includes(answer)
    },
  )
  const call = `RANDOM_INT(${range.lo}, ${range.hi})`
  const name = range.v
  const code = `${name} ← ${call}\n${name} ← ${name} ${op === 'times' ? '*' : '+'} ${m}\nOUTPUT ${name} MOD ${d}`
  const step = op === 'times' ? `multiplied by ${m}` : `increased by ${m}`
  const prompt = asCode
    ? `\`${call}\` returns ${v} when this program runs. What is output?\n\n${fence(code)}`
    : pick(r, RANDOM_PROSE)(call, step, d, v)
  const q = Math.floor(made / d)
  const first = op === 'times' ? `$${v} \\times ${m} = ${made}$` : `$${v} + ${m} = ${made}$`
  const ran = lastOutput(code, { random: [v] })
  return numericDraft(
    slot,
    {
      prompt,
      solution: `${first}, and \`${made} MOD ${d}\`: $${q} \\times ${d} = ${q * d}$, remainder **${answer}**.`,
      method: [String(made)],
      answer,
    },
    { agrees: ran === answer && (!asCode || printedCode(prompt) === code), detail: `interpreter with RANDOM_INT returning ${v}: ${ran}` },
    { lo: range.lo, hi: range.hi, v, op, m, d, form: asCode ? 'code' : 'prose', answer },
  )
}

// ---------------------------------------------------------------------------------------------
// q20: counting with a relational test on i MOD d
// ---------------------------------------------------------------------------------------------

export type Relation = '≠' | '=' | '<' | '>' | '≤' | '≥'

export const MEANS: Record<Relation, string> = {
  '≠': 'is not equal to',
  '=': 'is equal to',
  '<': 'is less than',
  '>': 'is greater than',
  '≤': 'is less than or equal to',
  '≥': 'is greater than or equal to',
}

export const holds = (x: number, op: Relation, k: number) =>
  op === '≠' ? x !== k : op === '=' ? x === k : op === '<' ? x < k : op === '>' ? x > k : op === '≤' ? x <= k : x >= k

/**
 * The tests drawn, by weight: the written ≠ 0, = 0 and = k (a fifth together: over 5 to 8 passes
 * an equality is True only once or twice, so more of them crowded the answers onto 2), and the
 * four orderings. k is drawn inside the draw, from what makes the test True for some remainders
 * and False for others.
 */
const RELATIONS: readonly (readonly [Relation | '=k', number])[] = [['≠', 22], ['=', 10], ['=k', 10], ['<', 16], ['>', 16], ['≤', 13], ['≥', 13]]

/**
 * q20: 2 marks. Written: FOR i ← 1 TO 6, IF (i MOD 3) ≠ 0 counts 4. Five to eight passes (nine to
 * twelve for an equality) from a start of 1 to 5 (1 a fifth of the time, where counting from 0 can pay), d from 3 to 5. The test
 * is True at the last i, and the count is never every pass, never half of them, never d, never k,
 * and never the printed start.
 */
function relational(r: Rng, slot: Question): Draft {
  const rel = weighted(r, RELATIONS)
  // The start is drawn with the rest: an equality from 2 can only count 2, its own start.
  const { s, d, op, k, n } = draw(
    r,
    (r) => {
      const s = r() < 0.22 ? 1 : int(r, 2, 5)
      const d = int(r, 3, 5)
      // An equality holds once in d passes, so it gets 9 to 12 passes to count 2 to 4.
      const n = rel === '=' || rel === '=k' ? int(r, 9, 12) : int(r, 5, 8)
      const op: Relation = rel === '=k' ? '=' : rel
      const k = rel === '≠' || rel === '=' ? 0 : rel === '=k' ? int(r, 1, d - 1) : rel === '<' || rel === '≥' ? int(r, 1, d - 1) : int(r, 0, d - 2)
      return { s, d, op, k, n }
    },
    ({ s, d, op, k, n }) => {
      const is = Array.from({ length: n }, (_, j) => s + j)
      const count = is.filter((i) => holds(i % d, op, k)).length
      return holds((s + n - 1) % d, op, k) && count !== n && 2 * count !== n && count !== d && count !== k && count !== s
    },
  )
  const e = s + n - 1
  const is = Array.from({ length: n }, (_, j) => s + j)
  const mods = is.map((i) => i % d)
  const yes = is.filter((i) => holds(i % d, op, k))
  const no = is.filter((i) => !holds(i % d, op, k))
  const answer = yes.length
  const code = `count ← 0\nFOR i ← ${s} TO ${e}\n   IF (i MOD ${d}) ${op} ${k} THEN\n      count ← count + 1\n   ENDIF\nENDFOR\nOUTPUT count`
  const prompt = `What is output?\n\n${fence(code)}`
  const which = no.length <= yes.length ? `fails only at ${andList(no)}` : `is True only at ${andList(yes)}`
  const ran = lastOutput(printedCode(prompt))
  return numericDraft(
    slot,
    {
      prompt,
      solution: `\`${op}\` means *${MEANS[op]}*. For i = ${s} to ${e}, \`i MOD ${d}\` is ${mods.join(', ')}, so the test is True for i = ${andList(yes)} and False for ${andList(no)}: count is **${answer}**.`,
      method: [`i MOD ${d} gives ${mods.join(', ')}, so the test ${which}`],
      answer,
    },
    { agrees: ran === answer, detail: `interpreter ${ran}; counted ${answer}` },
    { s, e, d, op, k, answer },
  )
}

export const operatorGenerators: Generator[] = [
  csBySlot('cs-operators-mod', TOPIC, { q2: modulo }),
  csBySlot('cs-operators-div', TOPIC, { q3: intDiv }),
  csBySlot('cs-operators-digits', TOPIC, { q8: digits }),
  csBySlot('cs-operators-trace', TOPIC, { q11: traceDivMod }),
  csBySlot('cs-operators-precedence', TOPIC, { q14: precedence }),
  csBySlot('cs-operators-random', TOPIC, { q18: randomMod }),
  csBySlot('cs-operators-relational', TOPIC, { q20: relational }),
]
