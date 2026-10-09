import { fixed, show } from '../format.ts'
import { cap, numeric } from '../physics/build.ts'
import { pick, type Rng } from '../random.ts'
import type { Draft, Generator } from '../types.ts'
import type { Question } from '../../content/questions.ts'
import { clean, evenly, range } from './build.ts'

/**
 * pH and hydrogen ion concentration (AQA 8462, 4.4.2.6): as the pH falls by one unit, the
 * hydrogen ion concentration rises by a factor of 10, so a change of d units is a factor of
 * 10^d. Four written slots ask it, three in strong and weak acids and one in carboxylic acids
 * and esters; each keeps its own framing (a pH that falls, two solutions compared, a weak acid
 * replaced by a strong one of the same concentration).
 *
 * The change in pH is drawn first and evenly, then a pair of pH values with that change, so no
 * factor carries a slot. Changes run from 2 to 5 units (2 to 4 for a weak and a strong acid of
 * the same concentration, where a weak acid five units above a strong one is not one a teacher
 * would print), so the answer is never 10, a factor a student who multiplies by the change
 * would not be caught by. Every pH is from 0 to 7: the questions are about acids. pH meter
 * readings are to one decimal place, and both readings share the same tenths so the change is
 * a whole number of units; indicator and textbook values are whole numbers.
 */

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six']
/** "-fold" words for the solution: a thousand-fold. */
const FOLD: Record<number, string> = { 2: 'hundred', 3: 'thousand', 4: 'ten-thousand', 5: 'hundred-thousand' }

interface Pair {
  /** The higher pH (fewer hydrogen ions) and the lower. */
  high: number
  low: number
  d: number
}
/**
 * Every pair of pH values from lo to hi with a whole change in `changes`. At one decimal place
 * neither value is whole (a meter reading 4.0 is printed 4.0, which reads as an indicator value).
 */
function pairs(lo: number, hi: number, dp: 0 | 1, changes: number[]): Pair[] {
  const values = range(lo, hi, dp ? 0.1 : 1).filter((x) => (dp ? !Number.isInteger(clean(x)) : true))
  const out: Pair[] = []
  for (const low of values) for (const d of changes) if (values.includes(clean(low + d))) out.push({ high: clean(low + d), low, d })
  return out
}
const reading = (x: number, dp: 0 | 1) => (dp ? fixed(x, 1) : show(x))
/** The pairs a framing draws from; every change it names must have one. */
function framed(f: Framing): Pair[] {
  const out = pairs(f.lo, f.hi, f.dp, f.changes).filter((p) => f.keep?.(p) ?? true)
  if (new Set(out.map((p) => p.d)).size !== f.changes.length) throw new Error(`${f.name}: a change of pH has no pair`)
  return out
}

/** The factor by a second route: one factor of ten for each whole unit stepped down from the higher pH. */
function stepped(p: Pair): number {
  let f = 1
  for (let x = p.high; x > p.low + 1e-9; x = clean(x - 1)) f *= 10
  return f
}

interface Framing {
  name: string
  dp: 0 | 1
  lo: number
  hi: number
  changes: number[]
  /** Which pairs the framing allows, beyond the range: the textbook liquids' own values, a strong acid at pH 3 or below. */
  keep?: (p: Pair) => boolean
  /** The prompt, from the pair's printed values; `r` picks the wording or the order. */
  ask: (r: Rng, high: string, low: string, p: Pair) => string
}

/**
 * Builds one pH question: the change evenly, then a pair, then the framing's prompt. The
 * solution and method lines come from the slot's own written style.
 */
function phQuestion(
  r: Rng,
  slot: Question,
  key: string,
  f: Framing,
  solve: (p: Pair, high: string, low: string, answer: number) => { solution: string; method: string[] },
): Draft {
  const p = evenly(r, `${key}:${f.name}`, () => framed(f), (x) => x.d)
  const [high, low] = [reading(p.high, f.dp), reading(p.low, f.dp)]
  const answer = 10 ** p.d
  const { solution, method } = solve(p, high, low, answer)
  return numeric(
    slot,
    { prompt: f.ask(r, high, low, p), solution, method, answer, tolerance: 0 },
    // Second route: step down the scale a unit at a time, ten times the hydrogen ions each step;
    // and the concentrations themselves, 10^-pH, in the ratio.
    { agrees: stepped(p) === answer && Math.abs(10 ** -p.low / 10 ** -p.high / answer - 1) < 1e-9, detail: `${high} to ${low}: ${p.d} steps` },
    { context: f.name, high: p.high, low: p.low, d: p.d },
  )
}

// ---------------------------------------------------------------------------------------------
// strong-and-weak-acids q6: the pH falls
// ---------------------------------------------------------------------------------------------

const FALLS: Framing[] = [
  {
    name: 'a solution',
    dp: 0,
    lo: 0,
    hi: 7,
    changes: [2, 3, 4, 5],
    ask: (r, high, low) =>
      pick(r, [
        `A solution's pH falls from ${high} to ${low}. By what factor does the hydrogen ion concentration increase?`,
        `Acid is added to a solution and its pH falls from ${high} to ${low}. By what factor does the hydrogen ion concentration increase?`,
        `Universal indicator shows that the pH of a solution falls from ${high} to ${low}. By what factor does the hydrogen ion concentration increase?`,
      ]),
  },
  {
    name: 'pH meter',
    dp: 1,
    lo: 0.5,
    hi: 6.9,
    changes: [2, 3, 4, 5],
    ask: (r, high, low) =>
      pick(r, [
        `A pH meter in a solution reads ${high}. A student adds more acid and the reading falls to ${low}. By what factor does the hydrogen ion concentration increase?`,
        `The pH of a solution, measured with a pH meter, falls from ${high} to ${low}. By what factor does the hydrogen ion concentration increase?`,
      ]),
  },
]

/** A fall of d units is a factor of 10^d: written as q6 (pH 5 to 1, 10000, 2 marks). */
export const phFallFactor: Generator = {
  id: 'ph-fall-factor',
  subjectId: 'chemistry',
  topicId: 'strong-and-weak-acids',
  replaces: ['q6'],
  build(r, slot, turn) {
    const f = FALLS[turn % FALLS.length]!
    return phQuestion(r, slot, 'ph-fall-factor', f, (p, high, low, answer) => ({
      solution: `${f.dp ? `From ${high} to ${low} is a` : 'A'} fall of ${p.d} pH units, so $10^${p.d} = ${answer}$ times.`,
      method: ['uses ten to the power of the pH change'],
    }))
  },
}

// ---------------------------------------------------------------------------------------------
// strong-and-weak-acids q9 and carboxylic-acids-and-esters q13: two solutions compared
// ---------------------------------------------------------------------------------------------

/** Liquids at the whole-number pH a textbook scale gives them; "about", since real samples vary. */
const LIQUIDS: { name: string; pH: number; the: string }[] = [
  { name: 'Lemon juice', pH: 2, the: 'the lemon juice' },
  { name: 'Vinegar', pH: 3, the: 'the vinegar' },
  { name: 'Tomato juice', pH: 4, the: 'the tomato juice' },
  { name: 'Black coffee', pH: 5, the: 'the black coffee' },
  { name: 'Pure water', pH: 7, the: 'the pure water' },
]
const liquid = (pH: number) => LIQUIDS.find((l) => l.pH === pH)!
const about = (pH: number) => (pH === 7 ? `a pH of 7` : `a pH of about ${pH}`)

const COMPARED: Framing[] = [
  {
    name: 'two solutions',
    dp: 0,
    lo: 0,
    hi: 7,
    changes: [2, 3, 4, 5],
    ask: (r, high, low) =>
      r() < 0.5
        ? `One solution has pH ${high} and another has pH ${low}. How many times greater is the hydrogen ion concentration in the pH ${low} solution?`
        : `One solution has pH ${low} and another has pH ${high}. How many times greater is the hydrogen ion concentration in the pH ${low} solution?`,
  },
  {
    name: 'everyday liquids',
    dp: 0,
    lo: 2,
    hi: 7,
    changes: [2, 3, 4, 5],
    keep: (p) => LIQUIDS.some((l) => l.pH === p.high) && LIQUIDS.some((l) => l.pH === p.low),
    ask: (r, _high, _low, p) => {
      const [h, l] = [liquid(p.high), liquid(p.low)]
      return r() < 0.5
        ? `${h.name} has ${about(h.pH)} and ${l.name.toLowerCase()} has ${about(l.pH)}. Roughly how many times greater is the hydrogen ion concentration in ${l.the}?`
        : `${l.name} has ${about(l.pH)} and ${h.name.toLowerCase()} has ${about(h.pH)}. Roughly how many times greater is the hydrogen ion concentration in ${l.the}?`
    },
  },
  {
    name: 'pH meter',
    dp: 1,
    lo: 0.5,
    hi: 6.9,
    changes: [2, 3, 4, 5],
    ask: (r, high, low) =>
      r() < 0.5
        ? `A pH meter reads ${high} in solution A and ${low} in solution B. How many times greater is the hydrogen ion concentration in solution B?`
        : `A pH meter reads ${low} in solution A and ${high} in solution B. How many times greater is the hydrogen ion concentration in solution A?`,
  },
]
/** Two solutions d units apart differ by 10^d: written as q9 (pH 3 and pH 1, 100, 2 marks). */
export const phCompareFactor: Generator = {
  id: 'ph-compare-factor',
  subjectId: 'chemistry',
  topicId: 'strong-and-weak-acids',
  replaces: ['q9'],
  build(r, slot, turn) {
    const f = COMPARED[turn % COMPARED.length]!
    return phQuestion(r, slot, 'ph-compare-factor', f, (p, high, low, answer) => ({
      solution: `${f.dp ? `From ${high} to ${low} is ${WORDS[p.d]}` : cap(WORDS[p.d]!)} pH units, so $10^${p.d} = ${answer}$ times. Not ${WORDS[p.d]} times: the scale is a factor of ten per unit.`,
      method: [`identifies a change of ${WORDS[p.d]} pH units`],
    }))
  },
}

// ---------------------------------------------------------------------------------------------
// strong-and-weak-acids q14: a weak and a strong acid of the same concentration
// ---------------------------------------------------------------------------------------------

/**
 * The strong acid from pH 0 to 3 (1 to 0.001 mol/dm³), the weak one 2 to 4 units above it and
 * never above pH 5, as in the written slot: a weak acid much above that is barely acidic.
 */
const STRENGTHS: Framing[] = [
  {
    name: 'replaced',
    dp: 0,
    lo: 0,
    hi: 5,
    changes: [2, 3, 4],
    keep: (p) => p.low <= 3,
    ask: (r, high, low) =>
      pick(r, [
        `A weak acid at pH ${high} is replaced by a strong acid of the same concentration at pH ${low}. By what factor is the hydrogen ion concentration greater in the strong acid?`,
        `A student replaces a weak acid, pH ${high}, with a strong acid of the same concentration, pH ${low}. By what factor is the hydrogen ion concentration greater in the strong acid?`,
        `In an experiment, a weak acid at pH ${high} is swapped for a strong acid at pH ${low}, both at the same concentration. By what factor is the hydrogen ion concentration greater in the strong acid?`,
      ]),
  },
  {
    name: 'compared',
    dp: 0,
    lo: 0,
    hi: 5,
    changes: [2, 3, 4],
    keep: (p) => p.low <= 3,
    ask: (r, high, low) =>
      pick(r, [
        `Two acids have the same concentration. The weak acid has pH ${high} and the strong acid has pH ${low}. How many times greater is the hydrogen ion concentration in the strong acid?`,
        `A strong acid and a weak acid have the same concentration. The strong acid has pH ${low} and the weak acid has pH ${high}. How many times greater is the hydrogen ion concentration in the strong acid?`,
        `Solutions of a weak acid and a strong acid are made at the same concentration. The weak acid has pH ${high}; the strong acid has pH ${low}. How many times greater is the hydrogen ion concentration in the strong acid?`,
      ]),
  },
  {
    name: 'pH meter',
    dp: 1,
    lo: 0.1,
    hi: 4.9,
    changes: [2, 3, 4],
    keep: (p) => p.low < 3,
    ask: (r, high, low) =>
      pick(r, [
        `A pH meter reads ${high} in a weak acid and ${low} in a strong acid of the same concentration. By what factor is the hydrogen ion concentration greater in the strong acid?`,
        `A strong acid and a weak acid have the same concentration. A pH meter reads ${low} in the strong acid and ${high} in the weak acid. By what factor is the hydrogen ion concentration greater in the strong acid?`,
      ]),
  },
]

/** Strong against weak at one concentration: written as q14 (pH 5 and pH 2, 1000, 3 marks). */
export const phStrongWeakFactor: Generator = {
  id: 'ph-strong-weak-factor',
  subjectId: 'chemistry',
  topicId: 'strong-and-weak-acids',
  replaces: ['q14'],
  build(r, slot, turn) {
    const f = STRENGTHS[turn % STRENGTHS.length]!
    return phQuestion(r, slot, 'ph-strong-weak-factor', f, (p, _high, _low, answer) => ({
      solution: `A difference of ${p.d} pH units, so $10^${p.d} = ${answer}$ times. This is why *the stronger the acid, the lower the pH* is a much bigger statement than it looks: ${WORDS[p.d]} units on the scale is a ${FOLD[p.d]}-fold difference in ions.`,
      method: [`finds the pH difference of ${p.d}`, 'raises ten to that power'],
    }))
  },
}

// ---------------------------------------------------------------------------------------------
// carboxylic-acids-and-esters q13: a weak acid against another solution
// ---------------------------------------------------------------------------------------------

const WEAK: Framing[] = [
  {
    name: 'two solutions',
    dp: 0,
    lo: 0,
    hi: 7,
    changes: [2, 3, 4, 5],
    ask: (_r, high, low) => `One solution has pH ${low} and another has pH ${high}. How many times greater is the hydrogen ion concentration in the pH ${low} solution?`,
  },
  {
    name: 'ethanoic and hydrochloric acid',
    dp: 0,
    lo: 0,
    hi: 5,
    changes: [2, 3, 4, 5],
    // Ethanoic acid from pH 3 to 5, hydrochloric acid from 0 to 2.
    keep: (p) => p.high >= 3 && p.low <= 2,
    ask: (r, high, low) =>
      r() < 0.5
        ? `A solution of ethanoic acid has pH ${high} and a solution of hydrochloric acid has pH ${low}. How many times greater is the hydrogen ion concentration in the hydrochloric acid?`
        : `A solution of hydrochloric acid has pH ${low} and a solution of ethanoic acid has pH ${high}. How many times greater is the hydrogen ion concentration in the hydrochloric acid?`,
  },
  {
    name: 'pH meter',
    dp: 1,
    lo: 0.5,
    hi: 6.9,
    changes: [2, 3, 4, 5],
    ask: (_r, high, low) => `A pH meter reads ${low} in one solution and ${high} in another. How many times greater is the hydrogen ion concentration in the solution at pH ${low}?`,
  },
]

/** The same factor of ten per unit, in the carboxylic acids topic: written as q13 (pH 2 and pH 5, 1000, 2 marks). */
export const phWeakAcidFactor: Generator = {
  id: 'ph-weak-acid-factor',
  subjectId: 'chemistry',
  topicId: 'carboxylic-acids-and-esters',
  replaces: ['q13'],
  build(r, slot, turn) {
    const f = WEAK[turn % WEAK.length]!
    return phQuestion(r, slot, 'ph-weak-acid-factor', f, (p, high, low, answer) => ({
      solution: `${f.dp ? `From ${high} to ${low} is ${WORDS[p.d]}` : cap(WORDS[p.d]!)} pH units, each a factor of 10: **${answer}** times.`,
      method: ['a factor of 10 per pH unit'],
    }))
  },
}

export const acidGenerators: Generator[] = [phFallFactor, phCompareFactor, phStrongWeakFactor, phWeakAcidFactor]

/** For tests. */
export const ACID_POOLS = { FALLS, COMPARED, STRENGTHS, WEAK, LIQUIDS, framed }
