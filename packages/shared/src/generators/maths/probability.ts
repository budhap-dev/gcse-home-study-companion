import type { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { draw, int, pick, shuffle, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'
import { bySlot, gcd, reduce, terminates } from './formulae.ts'

/** A result count with its noun: "lands on heads 1 times" read as a typo. */
const timesCount = (k: number) => (k === 1 ? '1 time' : `${k} times`)

/* ------------------------------------------------------------------------------------------
 * Shared helpers for the probability and set generators.
 *
 * Every answer here is a count or a fraction of a count, so the second method is always the
 * same idea: list the sample space (the codes, the pairs of dice, the ordered pairs of
 * counters, the people in each region) and count what the question asks for, against the
 * rule the solution uses (multiply, add the paths, 1 − P(none)).
 * ---------------------------------------------------------------------------------------- */

type Builder = (r: Rng, slot: Question, turn: number) => Draft

export const NAMES = ['Amir', 'Beth', 'Chloe', 'Dev', 'Ella', 'Femi', 'Grace', 'Hamza', 'Isla', 'Jack', 'Kai', 'Lena', 'Maya', 'Noah', 'Omar', 'Priya', 'Ravi', 'Sofia', 'Tom', 'Zara']

export const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)

/** 1, 2, 3 and 4. */
export const andList = (items: readonly (string | number)[]) =>
  items.length === 1 ? String(items[0]) : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`

export const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']

/**
 * Counts the sequences with one item from each pool by walking every one of them, so a
 * count is a listing, not the product the solution prints. `distinct` skips an item already
 * used (no repeats); `ok` keeps only the sequences the question asks about.
 */
export function countLists<T>(pools: readonly (readonly T[])[], ok: (seq: T[]) => boolean = () => true, distinct = false): number {
  const seq: T[] = []
  const walk = (i: number): number => {
    if (i === pools.length) return ok(seq) ? 1 : 0
    let n = 0
    for (const x of pools[i]!) {
      if (distinct && seq.includes(x)) continue
      seq.push(x)
      n += walk(i + 1)
      seq.pop()
    }
    return n
  }
  return walk(0)
}

/** Every sequence with one item from each pool, written out. */
export function listAll<T>(pools: readonly (readonly T[])[]): T[][] {
  let out: T[][] = [[]]
  for (const pool of pools) out = out.flatMap((seq) => pool.map((x) => [...seq, x]))
  return out
}

export const product = (xs: readonly number[]) => xs.reduce((a, b) => a * b, 1)
const texTimes = (xs: readonly number[]) => xs.join(' \\times ')
const typedTimes = (xs: readonly number[]) => xs.join(' × ')
/** n, n − 1, … for k factors. */
const falling = (n: number, k: number) => range(0, k - 1).map((i) => n - i)

export const dfrac = (n: number, d: number) => `\\dfrac{${n}}{${d}}`

/** n/d cancelled where it can be, then its decimal: \dfrac{6}{16} = \dfrac{3}{8} = 0.375. */
export function worked(n: number, d: number, decimal = true): string {
  const [p, q] = reduce(n, d)
  const parts = [dfrac(n, d)]
  if (q !== d) parts.push(dfrac(p, q))
  if (decimal) parts.push(show(p / q))
  return parts.join(' = ')
}

/** Decimal places in a printed number. */
export const places = (x: number) => (show(x).split('.')[1] ?? '').length

/**
 * The tolerance of a probability given as a fraction or a decimal: none when the decimal is
 * short enough to type in full, 0.001 for a long one such as 0.390625 (as the written q7),
 * and only where that is within 2% of the answer.
 */
export const tolFor = (x: number) => (places(x) > 3 && x >= 0.05 ? 0.001 : 0)

/** The answer line of a fraction-or-decimal probability: 3/8 or 0.375. */
export function eitherForm(n: number, d: number): string {
  const [p, q] = reduce(n, d)
  return `${p}/${q} or ${show(p / q)}`
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-12

/** A probability in hundredths, printed: 35 → 0.35. */
const hund = (k: number) => show(k / 100)

/* ------------------------------------------------------------------------------------------
 * Choices and outcomes
 * ---------------------------------------------------------------------------------------- */

const CHOICES = 'choices-and-outcomes'

type Pair = (a: number, b: number, name: string) => string

/** One choice then another: written as q1, q2 and q9, each slot with its own kind of choice. */
function twoChoices(contexts: readonly Pair[]): Builder {
  return (r, slot) => {
    const text = pick(r, contexts)
    const { a, b } = draw(r, (r) => ({ a: int(r, 2, 9), b: int(r, 2, 9) }), ({ a, b }) => a !== b)
    const name = pick(r, NAMES)
    const answer = a * b
    const listed = countLists([range(1, a), range(1, b)])
    return {
      question: {
        type: 'numeric',
        prompt: text(a, b, name),
        solution: `One choice then another, so multiply: $${a} \\times ${b} = ${answer}$.`,
        markScheme: scheme(slot, [`${a} × ${b}`], String(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: listed === answer, detail: `listed ${listed} pairs` },
      values: { a, b },
    }
  }
}

const MEALS: Pair[] = [
  (a, b) => `A menu has ${a} starters and ${b} mains. How many two-course meals are possible?`,
  (a, b) => `A café sells ${a} kinds of bread and ${b} sandwich fillings. A sandwich is one bread and one filling. How many different sandwiches can be made?`,
  (a, b) => `A takeaway offers ${a} pizza bases and ${b} toppings. A pizza has one base and one topping. How many different pizzas are possible?`,
  (a, b, n) => `${n} has ${a} shirts and ${b} pairs of trousers. An outfit is one shirt and one pair of trousers. How many different outfits can ${n} make?`,
  (a, b) => `An ice cream van sells ${a} flavours and ${b} kinds of cone. A single ice cream is one flavour in one cone. How many different single ice creams are possible?`,
]

const PRODUCTS: Pair[] = [
  (a, b) => `A shop sells T-shirts in ${a} colours and ${b} sizes. How many different T-shirts are there?`,
  (a, b) => `A phone comes in ${a} colours and ${b} storage sizes. How many different versions of the phone are there?`,
  (a, b) => `A trainer is made in ${a} colours and ${b} sizes. How many different trainers are there?`,
  (a, b) => `A bike comes in ${a} frame colours, each with a choice of ${b} saddles. How many different bikes are possible?`,
  (a, b, n) => `${n} is buying a hoodie. It comes in ${a} colours and ${b} sizes. How many different hoodies could ${n} buy?`,
]

const MENUS: Pair[] = [
  (a, b) => `A restaurant offers ${a} mains and ${b} puddings. A meal is one main and one pudding. How many meals are possible?`,
  (a, b) => `A school has ${a} subjects in option block A and ${b} in option block B. Each student takes one subject from each block. How many different pairs of subjects are possible?`,
  (a, b) => `A cinema shows ${a} films and sells ${b} kinds of snack. A deal is one film ticket and one snack. How many different deals are possible?`,
  (a, b, n) => `${n} is choosing a holiday: one of ${a} destinations and one of ${b} hotels. How many different holidays could ${n} choose?`,
  (a, b) => `A football kit has ${a} shirt designs and ${b} colours of shorts. A kit is one shirt and one pair of shorts. How many different kits are possible?`,
]

/** In how many orders can n things be arranged: written as q4 (3 books) and q7 (5 people). */
function arrangements(lo: number, hi: number, contexts: readonly ((n: number, name: string, word: string) => string)[], words?: Record<number, readonly string[]>): Builder {
  return (r, slot) => {
    const n = int(r, lo, hi)
    const text = pick(r, contexts)
    const name = pick(r, NAMES)
    const word = pick(r, words?.[n] ?? ['WORD'])
    const factors = falling(n, n)
    const answer = product(factors)
    // Second route: every ordering listed, no item used twice.
    const listed = countLists(Array.from({ length: n }, () => range(1, n)), () => true, true)
    const prompt = text(n, name, word)
    const lettersDistinct = !prompt.includes('letters of the word') || new Set(word).size === word.length
    return {
      question: {
        type: 'numeric',
        prompt,
        solution: `There are ${n} choices for the first place, ${n - 1} for the next, and so on: $${texTimes(factors)} = ${answer}$, which is $${n}!$.`,
        markScheme: scheme(slot, [`multiplies ${n} down to 1`], String(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: listed === answer && lettersDistinct, detail: `listed ${listed} orders` },
      values: { n },
    }
  }
}

const BOOKS = [
  (n: number) => `In how many different orders can ${n} books be put on a shelf?`,
  (n: number, name: string) => `${name} has ${n} different photos to pin in a row on a board. In how many different orders can the photos be pinned?`,
  (n: number, name: string) => `${name} has ${n} jobs to do on Saturday, one after another. In how many different orders can the jobs be done?`,
  (n: number, name: string) => `${name} and ${n - 1} friends sit in a row of ${n} seats at the cinema. In how many different orders can the ${n} of them sit?`,
  (n: number) => `${n} different trophies are put in a line on a shelf. In how many different orders can they be arranged?`,
]

const DISTINCT_WORDS: Record<number, readonly string[]> = {
  4: ['FISH', 'STOP', 'LAMP', 'BIRD', 'CAKE', 'WORD'],
  5: ['MATHS', 'CHAIR', 'BLOCK', 'TABLE', 'BRAVE', 'PLANT'],
  6: ['PLANET', 'FRIDGE', 'GARDEN', 'NUMBER', 'WINTER', 'FAMILY'],
  7: ['JUMPING', 'COUSIN', 'PROBLEM', 'KINGDOM', 'DOLPHIN', 'TRAMPED'].filter((w) => w.length === 7),
}

const QUEUES = [
  (n: number) => `In how many different orders can ${n} people stand in a queue?`,
  (n: number) => `${n} runners finish a race and there are no ties. In how many different orders can they finish?`,
  (n: number, name: string) => `${name} has made a playlist of ${n} different songs. In how many different orders can the songs be played?`,
  (n: number, name: string) => `${name}'s teacher lines up ${n} students in a row for a photo. In how many different orders can they stand?`,
  (n: number, name: string) => `${name} wants to visit ${n} different towns on a holiday, one after another. In how many different orders can the towns be visited?`,
  (_: number, __: string, word: string) => `The letters of the word ${word} are all different. How many different arrangements of all ${word.length} letters are there?`,
]

interface Pool {
  label: string
  unit: 'digit' | 'letter'
  size: number
}
const CODE_POOLS: Pool[] = [
  { label: 'the digits 0 to 9', unit: 'digit', size: 10 },
  { label: 'the digits 1 to 9', unit: 'digit', size: 9 },
  { label: 'the digits 1 to 6', unit: 'digit', size: 6 },
  { label: 'the letters A to E', unit: 'letter', size: 5 },
  { label: 'the letters A to F', unit: 'letter', size: 6 },
  { label: 'the letters A to H', unit: 'letter', size: 8 },
]

/** Codes of k symbols from a pool, with repeats (q5) or without (q6). */
function codes(repeats: boolean): Builder {
  return (r, slot) => {
    const pool = pick(r, CODE_POOLS)
    const k = int(r, 3, 4)
    const name = pick(r, NAMES)
    const form = int(r, 0, 2)
    const kw = `${WORDS[k]}-${pool.unit}`
    const u = pool.unit
    const U = u === 'digit' ? 'Digits' : 'Letters'
    let prompt: string
    if (repeats) {
      prompt = [
        `How many ${kw} codes can be made from ${pool.label} if ${u}s may be repeated?`,
        `${name} chooses a ${kw} code for a locker, using ${pool.label}. ${U} may be repeated. How many different codes are possible?`,
        `A padlock has ${WORDS[k]} wheels, and each wheel shows ${pool.label}. How many different settings does the padlock have?`,
      ][form]!
    } else {
      prompt = [
        `How many ${kw} codes can be made from ${pool.label} if no ${u} may be repeated?`,
        `${name} chooses a ${kw} code for a locker, using ${pool.label}, with no ${u} used twice. How many different codes are possible?`,
        `A club gives each member a ${kw} code made from ${pool.label}, with no ${u} repeated. How many different codes can it give out?`,
      ][form]!
    }
    const factors = repeats ? Array.from({ length: k }, () => pool.size) : falling(pool.size, k)
    const answer = product(factors)
    const listed = countLists(Array.from({ length: k }, () => range(1, pool.size)), () => true, !repeats)
    const solution = repeats
      ? `Every position still has all ${pool.size} ${u}s: $${texTimes(factors)} = ${answer}$.`
      : `The pool shrinks each time: $${texTimes(factors)} = ${answer}$.`
    return {
      question: {
        type: 'numeric',
        prompt,
        solution,
        markScheme: scheme(slot, [repeats ? `${pool.size} to the power ${k}` : typedTimes(factors)], String(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: listed === answer, detail: `listed ${listed} codes` },
      values: { size: pool.size, k, repeats: String(repeats) },
    }
  }
}

/** A set of n different non-zero digits, in order. */
const digitSet = (r: Rng, n: number) => shuffle(r, range(1, 9)).slice(0, n).sort((a, b) => a - b)
const asNumber = (digits: readonly number[]) => digits.reduce((v, d) => v * 10 + d, 0)

/** k-digit numbers from n digits with no repeats: written as q11. */
const numbersFromDigits: Builder = (r, slot) => {
  const n = int(r, 4, 7)
  const k = int(r, 3, Math.min(4, n - 1))
  const digits = digitSet(r, n)
  const name = pick(r, NAMES)
  const factors = falling(n, k)
  const answer = product(factors)
  const prompt = r() < 0.5
    ? `Using the digits ${andList(digits)} with no digit repeated, how many ${WORDS[k]}-digit numbers can be made?`
    : `${name} has ${n} cards numbered ${andList(digits)}. ${name} puts ${WORDS[k]} of them in a row to make a ${WORDS[k]}-digit number. How many different numbers can be made?`
  const listed = countLists(Array.from({ length: k }, () => digits), () => true, true)
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `${n} choices for the first digit, then one fewer each time: $${texTimes(factors)} = ${answer}$.`,
      markScheme: scheme(slot, [typedTimes(factors)], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: listed === answer, detail: `listed ${listed} numbers` },
    values: { n, k, digits: digits.join('') },
  }
}

/**
 * k-digit numbers with a restriction: even, odd, a multiple of 5, or greater than a hundreds
 * (or thousands) value. Written as q12. The second method lists every number and tests the
 * number itself, not the digit the solution restricts.
 */
const restrictedNumbers: Builder = (r, slot) => {
  const kinds = ['even', 'odd', 'multiple of 5', 'greater than'] as const
  const { digits, kind, k, qualifying, threshold } = draw(
    r,
    (r) => {
      const n = int(r, 5, 7)
      const digits = digitSet(r, n)
      const kind = pick(r, kinds)
      const k = kind === 'greater than' && r() < 0.4 ? 4 : 3
      let qualifying: number[]
      let threshold = 0
      if (kind === 'even') qualifying = digits.filter((d) => d % 2 === 0)
      else if (kind === 'odd') qualifying = digits.filter((d) => d % 2 === 1)
      else if (kind === 'multiple of 5') qualifying = digits.filter((d) => d === 5)
      else {
        const lead = pick(r, digits.slice(1))
        qualifying = digits.filter((d) => d >= lead)
        threshold = lead * 10 ** (k - 1)
      }
      return { digits, kind, k, qualifying, threshold }
    },
    ({ digits, qualifying }) => qualifying.length >= 1 && qualifying.length < digits.length,
  )
  const n = digits.length
  const q = qualifying.length
  const others = falling(n - 1, k - 1)
  const answer = q * product(others)
  const first = kind === 'greater than'
  const ask = kind === 'even' ? 'are even' : kind === 'odd' ? 'are odd' : kind === 'multiple of 5' ? 'are multiples of 5' : `are greater than ${threshold}`
  const position = first ? 'first' : 'last'
  const must = `The ${position} digit must be ${q === 1 ? qualifying[0] : `${qualifying.slice(0, -1).join(', ')} or ${qualifying[q - 1]}`}, so ${q} choice${q === 1 ? '' : 's'}`
  const rest = k === 3 ? `then ${others[0]} remain and then ${others[1]}` : `then ${others[0]}, ${others[1]} and ${others[2]} for the other places`
  const ok = (seq: number[]) => {
    const v = asNumber(seq)
    return kind === 'even' ? v % 2 === 0 : kind === 'odd' ? v % 2 === 1 : kind === 'multiple of 5' ? v % 5 === 0 : v > threshold
  }
  const listed = countLists(Array.from({ length: k }, () => digits), ok, true)
  return {
    question: {
      type: 'numeric',
      prompt: `Using the digits ${andList(digits)} with no digit repeated, how many ${WORDS[k]}-digit numbers ${ask}?`,
      solution: `Fill the restricted position first. ${must}, ${rest}: $${texTimes([q, ...others])} = ${answer}$.`,
      markScheme: scheme(slot, [`${q} choice${q === 1 ? '' : 's'} for the ${position} digit`, `${k === 3 ? `${others[0]} and ${others[1]}` : `${others[0]}, ${others[1]} and ${others[2]}`} for the others`], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: listed === answer, detail: `listed every number and kept ${listed}` },
    values: { kind, k, n, q, digits: digits.join(''), threshold },
  }
}

const LETTER_POOLS = [
  { label: 'from A to Z', size: 26 },
  { label: 'from A to J', size: 10 },
  { label: 'from the vowels A, E, I, O and U', size: 5 },
]
const DIGIT_POOLS = [
  { label: 'from 0 to 9', size: 10 },
  { label: 'from 1 to 9', size: 9 },
]
const CODE_NAMES = ['A code', 'A locker code', 'A car park ticket code', 'A guest Wi-Fi code', 'A gym membership code']

/** Letters then digits (or digits then letters), repeats allowed: written as q13. */
const lettersAndDigits: Builder = (r, slot) => {
  const lp = pick(r, LETTER_POOLS)
  const dpool = pick(r, DIGIT_POOLS)
  const { L, D } = draw(r, (r) => ({ L: int(r, 1, 2), D: int(r, 1, 3) }), ({ L, D }) => L + D >= 3 && L + D <= 4)
  const lettersFirst = r() < 0.7
  const what = pick(r, CODE_NAMES)
  const letters = `${WORDS[L]} letter${L > 1 ? 's' : ''} ${lp.label}`
  const digits = `${WORDS[D]} digit${D > 1 ? 's' : ''} ${dpool.label}`
  const factors = lettersFirst ? [...Array(L).fill(lp.size), ...Array(D).fill(dpool.size)] : [...Array(D).fill(dpool.size), ...Array(L).fill(lp.size)]
  const answer = product(factors)
  const listed = countLists(factors.map((s) => range(1, s)))
  return {
    question: {
      type: 'numeric',
      prompt: `${what} is ${lettersFirst ? letters : digits} followed by ${lettersFirst ? digits : letters}, with repeats allowed. How many such codes are there?`,
      solution: `One choice for each position, so multiply: $${texTimes(factors)} = ${answer}$.`,
      markScheme: scheme(slot, [typedTimes(factors)], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: listed === answer, detail: `listed ${listed} codes` },
    values: { L, D, letters: lp.size, digits: dpool.size },
  }
}

/** Choosing 2 (q14) or 3 (q15) from n when order does not matter. */
function choose(k: 2 | 3): Builder {
  const contexts2 = [
    (n: number) => `How many ways can 2 people be chosen from ${n} for a team, when the order they are chosen in does not matter?`,
    (n: number, name: string) => `${name} can take 2 of ${n} different books on holiday. How many different pairs of books could ${name} take? The order does not matter.`,
    (n: number) => `A café lets you choose 2 different toppings from ${n}. The order does not matter. How many different pairs of toppings are there?`,
    (n: number, name: string) => `${name}'s club has ${n} members, and 2 of them will go to a meeting. The order they are picked in does not matter. How many different pairs could go?`,
    (n: number) => `In a chess club of ${n} players, each player plays every other player once. How many games are played?`,
  ]
  const contexts3 = [
    (n: number) => `How many ways can 3 toppings be chosen from ${n}, when the order does not matter?`,
    (n: number, name: string) => `${name} picks 3 different flavours from ${n} for a tub of ice cream. The order does not matter. How many different tubs are possible?`,
    (n: number, name: string) => `${name} must read 3 of ${n} books on a reading list. The order does not matter. How many different sets of 3 books could ${name} choose?`,
    (n: number) => `A teacher chooses 3 of ${n} students to go on a trip. The order they are chosen in does not matter. How many different groups of 3 are possible?`,
    (n: number) => `A shop puts 3 of its ${n} best-selling games in a bundle. The order does not matter. How many different bundles are possible?`,
  ]
  return (r, slot) => {
    const n = k === 2 ? int(r, 4, 12) : int(r, 5, 10)
    const name = pick(r, NAMES)
    const text = pick(r, k === 2 ? contexts2 : contexts3)
    const factors = falling(n, k)
    const ordered = product(factors)
    const repeats = k === 2 ? 2 : 6
    const answer = ordered / repeats
    // Second route: every unordered selection, listed once as an increasing tuple.
    const listed = countLists(Array.from({ length: k }, () => range(1, n)), (s) => s.every((x, i) => i === 0 || x > s[i - 1]!))
    const solution = k === 2
      ? `Arranging two from ${n} gives $${texTimes(factors)} = ${ordered}$, but each pair is counted twice, once in each order. So $${ordered} \\div 2 = ${answer}$.`
      : `Arranging three from ${n} gives $${texTimes(factors)} = ${ordered}$. Each set of three is counted $3! = 6$ times, so $${ordered} \\div 6 = ${answer}$.`
    const method = k === 2 ? [`${typedTimes(factors)} = ${ordered} arrangements`, 'divides by 2 because order does not matter'] : [`${typedTimes(factors)} = ${ordered}`, 'divides by 3! = 6']
    return {
      question: { type: 'numeric', prompt: text(n, name), solution, markScheme: scheme(slot, method, String(answer)), answer, tolerance: 0 },
      check: { agrees: listed === answer && Number.isInteger(answer), detail: `listed ${listed} selections` },
      values: { n, k },
    }
  }
}

const choicesGenerators: Generator[] = [
  bySlot('choices-product-rule', CHOICES, { q1: twoChoices(MEALS), q2: twoChoices(PRODUCTS), q9: twoChoices(MENUS), q13: lettersAndDigits }),
  bySlot('choices-arrangements', CHOICES, { q4: arrangements(3, 6, BOOKS), q7: arrangements(4, 7, QUEUES, DISTINCT_WORDS) }),
  bySlot('choices-codes', CHOICES, { q5: codes(true), q6: codes(false), q11: numbersFromDigits, q12: restrictedNumbers }),
  bySlot('choices-order-does-not-matter', CHOICES, { q14: choose(2), q15: choose(3) }),
]

/* ------------------------------------------------------------------------------------------
 * Sample space diagrams
 * ---------------------------------------------------------------------------------------- */

const SPACE = 'sample-space-diagrams'
const FRACTION_OR_DECIMAL = 'Give your answer as a fraction or a decimal.'

/** A fair object and the results it gives. */
interface Thing {
  name: string
  verb: string
  results: (string | number)[]
}
const coin: Thing = { name: 'a fair coin', verb: 'flipped', results: ['H', 'T'] }
const die = (m: number): Thing => ({ name: `a fair ${WORDS[m]}-sided die`, verb: 'thrown', results: range(1, m) })
const spinner = (m: number): Thing => ({ name: `a fair spinner numbered 1 to ${m}`, verb: 'spun', results: range(1, m) })
const letterSpinner = (m: number): Thing => ({ name: `a fair spinner with ${m} equal sections lettered A to ${String.fromCharCode(64 + m)}`, verb: 'spun', results: range(1, m).map((i) => String.fromCharCode(64 + i)) })

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)

/** Outcomes of two objects used together: written as q1. */
const countTwoThings: Builder = (r, slot) => {
  const first = spinner(int(r, 3, 8))
  const second = pick(r, [coin, die(6), die(4), letterSpinner(int(r, 3, 5))])
  const name = pick(r, NAMES)
  const a = first.results.length
  const b = second.results.length
  const answer = a * b
  const prompt = r() < 0.5
    ? `${cap(first.name)} is ${first.verb} and ${second.name} is ${second.verb}. How many outcomes are there altogether?`
    : `${name} spins ${first.name} and ${{ thrown: 'throws', flipped: 'flips', spun: 'spins' }[second.verb] ?? 'uses'} ${second.name}. How many different outcomes are there altogether?`
  const listed = listAll([first.results, second.results]).length
  const label = (t: Thing) => (t === coin ? 'coin' : t.name.includes('die') ? 'die' : 'second spinner')
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `Each of the ${a} spinner results pairs with each of the ${b} ${label(second)} results: $${a} \\times ${b} = ${answer}$.`,
      markScheme: scheme(slot, [], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: listed === answer, detail: `listed ${listed} outcomes` },
    values: { a, b },
  }
}

/** Cells in a two-dice grid: written as q2. */
const gridCells: Builder = (r, slot) => {
  const sizes = [4, 5, 6, 8, 10, 12]
  const m = pick(r, sizes)
  const n = r() < 0.5 ? m : pick(r, sizes)
  const recorded = pick(r, ['totals', 'products', 'differences'])
  const name = pick(r, NAMES)
  const answer = m * n
  const dice = m === n ? `Two fair ${WORDS[m]}-sided dice are` : `A fair ${WORDS[m]}-sided die and a fair ${WORDS[n]}-sided die are`
  const prompt = r() < 0.5
    ? `${dice} thrown and the ${recorded} are recorded. How many cells does the sample space grid have?`
    : `${name} draws a sample space grid for the ${recorded} when ${m === n ? `two fair ${WORDS[m]}-sided dice are` : `a fair ${WORDS[m]}-sided die and a fair ${WORDS[n]}-sided die are`} thrown. How many cells does the grid have?`
  const listed = listAll([range(1, m), range(1, n)]).length
  return {
    question: { type: 'numeric', prompt, solution: `$${m} \\times ${n} = ${answer}$ cells, one for each pair.`, markScheme: scheme(slot, [], String(answer)), answer, tolerance: 0 },
    check: { agrees: listed === answer, detail: `listed ${listed} pairs` },
    values: { m, n },
  }
}

/** Colours (or sections) and a missing probability, in hundredths so the check is exact. */
const THREE_WAYS = [
  { setup: (c: string[]) => `A bag holds only ${c[0]}, ${c[1]} and ${c[2]} counters.`, items: ['red', 'blue', 'yellow', 'green', 'white', 'black'], why: 'colours' },
  { setup: (c: string[]) => `A box holds only ${c[0]}, ${c[1]} and ${c[2]} chocolates.`, items: ['milk', 'dark', 'white'], why: 'kinds' },
  { setup: (c: string[]) => { const [p, q, s] = [...c].sort(); return `A spinner can land only on ${p}, ${q} or ${s}.` }, items: ['A', 'B', 'C'], why: 'outcomes' },
  { setup: (c: string[]) => `A bag of sweets holds only ${c[0]}, ${c[1]} and ${c[2]} sweets.`, items: ['strawberry', 'lemon', 'orange', 'lime'], why: 'flavours' },
]

/** P(third) = 1 − the other two: written as q3. Each probability is at least 0.05. */
const missingOfThree: Builder = (r, slot) => {
  const ctx = pick(r, THREE_WAYS)
  const items = shuffle(r, ctx.items).slice(0, 3)
  const step = r() < 0.5 ? 10 : 5
  const { a, b } = draw(r, (r) => ({ a: step * int(r, 1, 100 / step - 2), b: step * int(r, 1, 100 / step - 2) }), ({ a, b }) => a + b <= 95 && a !== b)
  const c = 100 - a - b
  // Second route: every probability in hundredths, and the three adding to exactly 100.
  const asked = items[2]!
  const answer = c / 100
  return {
    question: {
      type: 'numeric',
      prompt: `${ctx.setup(items)} P(${items[0]}) = ${hund(a)} and P(${items[1]}) = ${hund(b)}. Work out P(${asked}).`,
      solution: `The three ${ctx.why} are exhaustive, so $P(\\text{${asked}}) = 1 - ${hund(a)} - ${hund(b)} = ${show(answer)}$.`,
      markScheme: scheme(slot, [], show(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: a + b + c === 100 && c > 0 && near(answer + a / 100 + b / 100, 1), detail: `${a} + ${b} + ${c} hundredths` },
    values: { a, b, c },
  }
}

/** A biased spinner with one probability missing: written as q15. */
const missingOfSpinner: Builder = (r, slot) => {
  const s = r() < 0.6 ? 4 : 5
  const ps = draw(
    r,
    (r) => Array.from({ length: s - 1 }, () => int(r, 1, 9) * 5),
    (ps) => ps.reduce((x, y) => x + y, 0) <= 95 && new Set(ps).size === ps.length,
  )
  const missing = int(r, 1, s)
  const rest = 100 - ps.reduce((x, y) => x + y, 0)
  const labelled = range(1, s).filter((k) => k !== missing)
  const given = labelled.map((k, i) => `P(${k}) = ${hund(ps[i]!)}`)
  const answer = rest / 100
  const name = pick(r, NAMES)
  const setup = r() < 0.5 ? `A ${WORDS[s]}-sided spinner is biased.` : `${name} has a biased spinner numbered 1 to ${s}.`
  const all = [...ps, rest]
  return {
    question: {
      type: 'numeric',
      prompt: `${setup} ${andList(given)}. Work out P(${missing}).`,
      solution: `The ${WORDS[s]} outcomes are exhaustive, so they sum to 1: $P(${missing}) = 1 - ${ps.map(hund).join(' - ')} = ${show(answer)}$.`,
      markScheme: scheme(slot, [`subtracts the ${WORDS[s - 1]} given probabilities from 1`], show(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: all.reduce((x, y) => x + y, 0) === 100 && all.every((p) => p > 0), detail: `hundredths ${all.join(' + ')}` },
    values: { s, missing, given: ps.join(','), rest },
  }
}

const EVENTS: { happens: string; not: string }[] = [
  { happens: 'it rains tomorrow', not: 'it does not rain tomorrow' },
  { happens: 'a bus is late', not: 'the bus is not late' },
  { happens: 'a team wins its next match', not: 'the team does not win its next match' },
  { happens: 'a seed germinates', not: 'the seed does not germinate' },
  { happens: 'a light bulb fails within a year', not: 'the bulb does not fail within a year' },
  { happens: 'a parcel arrives on time', not: 'the parcel does not arrive on time' },
]

/** P(not A) = 1 − P(A): written as q9. */
const complementOne: Builder = (r, slot) => {
  const e = pick(r, EVENTS)
  const k = r() < 0.5 ? 5 * int(r, 1, 19) : int(r, 2, 98)
  const answer = (100 - k) / 100
  return {
    question: {
      type: 'numeric',
      prompt: `P(${e.happens}) = ${hund(k)}. What is the probability that ${e.not}?`,
      solution: `$P(\\text{not } A) = 1 - P(A) = 1 - ${hund(k)} = ${show(answer)}$.`,
      markScheme: scheme(slot, [], show(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: k + Math.round(answer * 100) === 100 && near(answer, 1 - k / 100), detail: `${k} hundredths and ${100 - k}` },
    values: { k },
  }
}

/** A die and a coin: P(an event on the die and a given face of the coin). Written as q5. */
const dieAndCoin: Builder = (r, slot) => {
  const { m, kind, v, face } = draw(
    r,
    (r) => ({ m: pick(r, [4, 5, 6, 8, 10]), kind: pick(r, ['number', 'even', 'odd', 'greater'] as const), v: int(r, 1, 7), face: pick(r, ['H', 'T'] as const) }),
    ({ m, kind, v }) => {
      if ((kind === 'number' || kind === 'greater') && v >= m) return false
      const fav = kind === 'number' ? 1 : kind === 'even' ? Math.floor(m / 2) : kind === 'odd' ? Math.ceil(m / 2) : m - v
      return terminates(fav, 2 * m)
    },
  )
  const test = (x: number) => (kind === 'number' ? x === v : kind === 'even' ? x % 2 === 0 : kind === 'odd' ? x % 2 === 1 : x > v)
  const coinWord = face === 'H' ? 'a head' : 'a tail'
  const eventText = kind === 'number' ? `a ${v} and ${coinWord}` : kind === 'greater' ? `a number greater than ${v} and ${coinWord}` : `an ${kind} number and ${coinWord}`
  const matching = range(1, m).filter(test).map((x) => `${x}${face}`)
  const fav = matching.length
  const total = 2 * m
  const [p, q] = reduce(fav, total)
  const answer = p / q
  const name = pick(r, NAMES)
  const setup = r() < 0.5 ? `A fair ${WORDS[m]}-sided die and a fair coin are used.` : `${name} throws a fair ${WORDS[m]}-sided die and flips a fair coin.`
  const which = fav === 1 ? `one of them is ${matching[0]}` : `${fav} of them match: ${andList(matching)}`
  // Second route: the whole sample space written out and the matching outcomes counted.
  const counted = listAll<string | number>([range(1, m), ['H', 'T']]).filter(([x, c]) => test(x as number) && c === face).length
  return {
    question: {
      type: 'numeric',
      prompt: `${setup} What is the probability of ${eventText}? ${FRACTION_OR_DECIMAL}`,
      solution: `There are $${m} \\times 2 = ${total}$ equally likely outcomes and ${which}, so $P = ${worked(fav, total)}$.`,
      markScheme: scheme(slot, [`${total} outcomes altogether`], eitherForm(fav, total)),
      answer,
      tolerance: tolFor(answer),
    },
    check: { agrees: counted === fav && near(counted / total, answer), detail: `counted ${counted} of ${total}` },
    values: { m, kind, v, face, fav, total },
  }
}

/** Two dice of sizes m and n: the ways each total happens. */
export function totalWays(m: number, n: number): Map<number, number> {
  const ways = new Map<number, number>()
  for (let a = 1; a <= m; a++) for (let b = 1; b <= n; b++) ways.set(a + b, (ways.get(a + b) ?? 0) + 1)
  return ways
}

const twoDiceSetup = (r: Rng, m: number, n: number) => {
  const name = pick(r, NAMES)
  const pair = m === n ? `two fair ${WORDS[m]}-sided dice` : `a fair ${WORDS[m]}-sided die and a fair ${WORDS[n]}-sided die`
  return r() < 0.5 ? `${cap(pair)} are thrown.` : `${name} throws ${pair}.`
}

/** P(total or product even or odd) with two dice: written as q6. */
const parityOfTwoDice: Builder = (r, slot) => {
  const { m, n, op, parity } = draw(
    r,
    (r) => {
      const m = pick(r, [4, 5, 6, 8])
      return { m, n: r() < 0.6 ? m : pick(r, [4, 5, 6, 8]), op: pick(r, ['total', 'product'] as const), parity: pick(r, ['even', 'odd'] as const) }
    },
    ({ m, n, op, parity }) => {
      const fav = countLists([range(1, m), range(1, n)], ([a, b]) => ((op === 'total' ? a! + b! : a! * b!) % 2 === 0) === (parity === 'even'))
      return terminates(fav, m * n)
    },
  )
  const cells = m * n
  const want = (x: number) => (x % 2 === 0) === (parity === 'even')
  let fav: number
  let reason: string
  if (op === 'total') {
    const ways = [...totalWays(m, n)].filter(([t]) => want(t)).sort((x, y) => x[0] - y[0])
    fav = ways.reduce((s, [, w]) => s + w, 0)
    reason = `The ${parity} totals are ${andList(ways.map(([t]) => t))}, happening $${ways.map(([, w]) => w).join(' + ')} = ${fav}$ ways out of ${cells}`
  } else {
    const oddM = Math.ceil(m / 2)
    const oddN = Math.ceil(n / 2)
    const odd = oddM * oddN
    fav = parity === 'odd' ? odd : cells - odd
    reason = parity === 'odd'
      ? `A product is odd only when both scores are odd: $${oddM} \\times ${oddN} = ${odd}$ cells out of ${cells}`
      : `A product is odd only when both scores are odd, which is $${oddM} \\times ${oddN} = ${odd}$ cells, so $${cells} - ${odd} = ${fav}$ cells out of ${cells} are even`
  }
  const [p, q] = reduce(fav, cells)
  const answer = p / q
  const counted = listAll([range(1, m), range(1, n)]).filter(([a, b]) => want(op === 'total' ? a! + b! : a! * b!)).length
  return {
    question: {
      type: 'numeric',
      prompt: `${twoDiceSetup(r, m, n)} What is the probability that the ${op} is ${parity}? ${FRACTION_OR_DECIMAL}`,
      solution: `${reason}, so $P = ${worked(fav, cells)}$.`,
      markScheme: scheme(slot, [`${fav} of the ${cells} cells`], eitherForm(fav, cells)),
      answer,
      tolerance: tolFor(answer),
    },
    check: { agrees: counted === fav && near(counted / cells, answer), detail: `counted ${counted} cells of ${cells}` },
    values: { m, n, op, parity, fav, cells },
  }
}

/** Exactly k heads (or tails) in n flips: written as q7, with every outcome listed. */
const exactlyKHeads: Builder = (r, slot) => {
  const n = r() < 0.7 ? 3 : 4
  const k = int(r, 0, n)
  const face = pick(r, ['H', 'T'] as const)
  const word = face === 'H' ? 'head' : 'tail'
  const outcomes = listAll(Array.from({ length: n }, () => ['H', 'T'])).map((s) => s.join(''))
  const matching = outcomes.filter((o) => [...o].filter((c) => c === face).length === k)
  const fav = matching.length
  const total = outcomes.length
  // Second route: n choose k from Pascal's rule, over 2^n.
  const pascal = (n: number, k: number): number => (k === 0 || k === n ? 1 : pascal(n - 1, k - 1) + pascal(n - 1, k))
  const [p, q] = reduce(fav, total)
  const answer = p / q
  const name = pick(r, NAMES)
  const times = n === 3 ? 'three' : 'four'
  const setup = pick(r, [`A fair coin is flipped ${times} times.`, `${name} flips a fair coin ${times} times.`, `${cap(WORDS[n]!)} fair coins are flipped together.`])
  const ask = k === 0 ? `no ${word}s` : `exactly ${WORDS[k]} ${word}${k === 1 ? '' : 's'}`
  const howMany = fav === 1 ? 'One of them has' : `${cap(WORDS[fav] ?? String(fav))} of them have`
  return {
    question: {
      type: 'numeric',
      prompt: `${setup} What is the probability of ${ask}? ${FRACTION_OR_DECIMAL}`,
      solution: `The ${total} outcomes are ${outcomes.join(', ')}. ${howMany} ${ask}, so $P = ${worked(fav, total)}$.`,
      markScheme: scheme(slot, [`lists all ${total} outcomes`], eitherForm(fav, total)),
      answer,
      tolerance: tolFor(answer),
    },
    check: { agrees: pascal(n, k) === fav && 2 ** n === total, detail: `Pascal gives ${pascal(n, k)} of ${2 ** n}` },
    values: { n, k, face, fav, total },
  }
}

const twoDiceNoun = (r: Rng, m: number) => {
  const name = pick(r, NAMES)
  return pick(r, [
    `Two fair ${WORDS[m]}-sided dice are thrown.`,
    `${name} throws two fair ${WORDS[m]}-sided dice.`,
    `Two fair spinners, each numbered 1 to ${m}, are spun.`,
    `${name} spins two fair spinners, each numbered 1 to ${m}.`,
  ])
}

/** A double (or not a double) with two m-sided dice: written as q11. */
const doubles: Builder = (r, slot) => {
  const m = pick(r, [4, 5, 8, 10])
  const not = r() < 0.35
  const cells = m * m
  const fav = not ? cells - m : m
  const [p, q] = reduce(fav, cells)
  const answer = p / q
  const doublesList = range(1, m).map((x) => `(${x},${x})`)
  const solution = not
    ? `The doubles are ${andList(doublesList)}, so ${m} cells out of ${cells}. The rest are not doubles: $${cells} - ${m} = ${fav}$, so $P = ${worked(fav, cells)}$.`
    : `The doubles are ${andList(doublesList)}, so ${m} cells out of ${cells}: $P = ${worked(fav, cells)}$.`
  const counted = listAll([range(1, m), range(1, m)]).filter(([a, b]) => (a === b) !== not).length
  return {
    question: {
      type: 'numeric',
      prompt: `${twoDiceNoun(r, m)} What is the probability of ${not ? 'not getting a double' : 'a double'}? ${FRACTION_OR_DECIMAL}`,
      solution,
      markScheme: scheme(slot, [`identifies the ${m} doubles`, `out of ${cells} outcomes`], eitherForm(fav, cells)),
      answer,
      tolerance: tolFor(answer),
    },
    check: { agrees: counted === fav && near(counted / cells, answer), detail: `counted ${counted} cells of ${cells}` },
    values: { m, not: String(not), fav, cells },
  }
}

/** The total at least (or at most) t with two dice: written as q12. The boundary is included. */
const totalAtLeast: Builder = (r, slot) => {
  const { m, n, t, least } = draw(
    r,
    (r) => {
      const m = pick(r, [4, 5, 6, 8])
      const n = r() < 0.7 ? m : pick(r, [4, 5, 6])
      return { m, n, t: int(r, 3, m + n - 1), least: r() < 0.6 }
    },
    ({ m, n, t, least }) => {
      const fav = countLists([range(1, m), range(1, n)], ([a, b]) => (least ? a! + b! >= t : a! + b! <= t))
      const listed = [...totalWays(m, n).keys()].filter((s) => (least ? s >= t : s <= t)).length
      return fav >= 2 && fav < m * n && listed <= 5 && terminates(fav, m * n)
    },
  )
  const cells = m * n
  const ways = [...totalWays(m, n)].filter(([s]) => (least ? s >= t : s <= t)).sort((x, y) => x[0] - y[0])
  const fav = ways.reduce((s, [, w]) => s + w, 0)
  const [p, q] = reduce(fav, cells)
  const answer = p / q
  const phrase = least ? `at least ${t}` : `at most ${t}`
  const counted = listAll([range(1, m), range(1, n)]).filter(([a, b]) => (least ? a! + b! >= t : a! + b! <= t)).length
  return {
    question: {
      type: 'numeric',
      prompt: `${twoDiceSetup(r, m, n)} What is the probability that the total is ${phrase}? ${FRACTION_OR_DECIMAL}`,
      solution: `Totals of ${andList(ways.map(([s]) => s))} happen $${ways.map(([, w]) => w).join(' + ')} = ${fav}$ ways out of ${cells}, so $P = ${worked(fav, cells)}$. Note that '${phrase}' includes ${t}.`,
      markScheme: scheme(slot, [`includes ${t} itself`, `${fav} of the ${cells} cells`], eitherForm(fav, cells)),
      answer,
      tolerance: tolFor(answer),
    },
    check: { agrees: counted === fav && near(counted / cells, answer), detail: `counted ${counted} cells of ${cells}` },
    values: { m, n, t, least: String(least), fav, cells },
  }
}

/** At least one success in k fair trials, by the complement: written as q14. */
const atLeastOne: Builder = (r, slot) => {
  const setups = [
    { m: 2, ks: [3, 4, 5], passive: 'A fair coin is flipped', active: 'flips a fair coin', what: (h: boolean) => (h ? 'head' : 'tail'), none: (h: boolean) => (h ? 'no heads' : 'no tails') },
    { m: 4, ks: [2, 3], passive: 'A fair four-sided die is thrown', active: 'throws a fair four-sided die', what: () => '4', none: () => 'no 4s' },
    { m: 5, ks: [2, 3], passive: 'A fair spinner with 5 equal sections, one of them red, is spun', active: 'spins a fair spinner with 5 equal sections, one of them red,', what: () => 'red', none: () => 'no reds' },
    { m: 8, ks: [2], passive: 'A fair eight-sided die is thrown', active: 'throws a fair eight-sided die', what: () => '8', none: () => 'no 8s' },
    { m: 10, ks: [2], passive: 'A fair ten-sided die is thrown', active: 'throws a fair ten-sided die', what: () => '1', none: () => 'no 1s' },
  ]
  const s = r() < 0.5 ? setups[0]! : pick(r, setups)
  const k = pick(r, s.ks)
  const heads = r() < 0.5
  const name = pick(r, NAMES)
  const total = s.m ** k
  const none = (s.m - 1) ** k
  const fav = total - none
  const [p, q] = reduce(fav, total)
  const answer = p / q
  const [np, nq] = reduce(none, total)
  const what = s.what(heads)
  const times = k === 2 ? 'twice' : `${WORDS[k]} times`
  const setup = r() < 0.5 ? `${s.passive} ${times}.` : `${name} ${s.active} ${times}.`
  // Second route, twice over: 1 − P(none) from the probability of a miss, and every outcome listed and counted.
  const hit = s.m === 2 ? (heads ? 0 : 1) : s.m - 1
  const counted = countLists(Array.from({ length: k }, () => range(0, s.m - 1)), (seq) => seq.includes(hit))
  const complement = 1 - ((s.m - 1) / s.m) ** k
  return {
    question: {
      type: 'numeric',
      prompt: `${setup} What is the probability of at least one ${what}? ${FRACTION_OR_DECIMAL}`,
      solution: `'At least one ${what}' is everything except ${s.none(heads)} at all. $P(\\text{${s.none(heads)}}) = ${worked(none, total, false)}$, so $P(\\text{at least one}) = 1 - ${dfrac(np, nq)} = ${worked(fav, total)}$.`,
      markScheme: scheme(slot, [`uses the complement, or lists the ${fav} outcomes`, `P(${s.none(heads)}) = ${np}/${nq}`], eitherForm(fav, total)),
      answer,
      tolerance: tolFor(answer),
    },
    check: { agrees: counted === fav && near(complement, answer) && near(counted / total, answer), detail: `listed ${counted} of ${total}; 1 − P(none) = ${complement}` },
    values: { m: s.m, k, fav, total, none },
  }
}

/** Outcomes of repeated trials: written as q18. */
const repeatedOutcomes: Builder = (r, slot) => {
  const kind = pick(r, ['coin', 'coin', 'dice', 'spinner'] as const)
  const name = pick(r, NAMES)
  const { size, k } = kind === 'coin' ? { size: 2, k: int(r, 3, 7) } : kind === 'dice' ? { size: pick(r, [4, 6]), k: int(r, 2, 3) } : { size: int(r, 3, 5), k: int(r, 2, 3) }
  const answer = size ** k
  const what = kind === 'coin' ? 'flip' : kind === 'dice' ? 'throw' : 'spin'
  const thing = kind === 'coin' ? 'A fair coin is flipped' : kind === 'dice' ? `A fair ${WORDS[size]}-sided die is thrown` : `A fair spinner with ${size} equal sections is spun`
  const prompt = r() < 0.5
    ? `${thing} ${k === 2 ? 'twice' : `${WORDS[k]} times`}. How many outcomes are in the sample space?`
    : `${name} ${kind === 'coin' ? 'flips a fair coin' : kind === 'dice' ? `throws a fair ${WORDS[size]}-sided die` : `spins a fair spinner with ${size} equal sections`} ${k === 2 ? 'twice' : `${WORDS[k]} times`} and records each result in order. How many outcomes are in the sample space?`
  const listed = countLists(Array.from({ length: k }, () => range(1, size)))
  const word = WORDS[k]
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `Each ${what} has ${size} results and there are ${k} ${what}s: $${texTimes(Array(k).fill(size))} = ${size}^${k} = ${answer}$.`,
      markScheme: scheme(slot, [`multiplies ${size} ${word} times`], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: listed === answer, detail: `listed ${listed} outcomes` },
    values: { size, k },
  }
}

const spaceGenerators: Generator[] = [
  bySlot('sample-space-counting', SPACE, { q1: countTwoThings, q2: gridCells, q18: repeatedOutcomes }),
  bySlot('sample-space-sum-to-one', SPACE, { q3: missingOfThree, q9: complementOne, q15: missingOfSpinner }),
  bySlot('sample-space-reading', SPACE, { q5: dieAndCoin, q6: parityOfTwoDice, q7: exactlyKHeads, q11: doubles, q12: totalAtLeast, q14: atLeastOne }),
]

/* ------------------------------------------------------------------------------------------
 * Combined events and tree diagrams
 * ---------------------------------------------------------------------------------------- */

const TREE = 'combined-events-and-tree-diagrams'

/** The same fair object twice, one named outcome both times: written as q3. */
const sameTwice: Builder = (r, slot) => {
  const things = [
    { m: 2, text: 'A coin is flipped twice.', outcome: () => pick(r, ['two heads', 'two tails']), name: 'flips a coin twice' },
    { m: 4, text: 'A fair four-sided die is thrown twice.', outcome: () => `two ${int(r, 1, 4)}s`, name: 'throws a fair four-sided die twice' },
    { m: 5, text: 'A fair spinner with 5 equal sections, one of them blue, is spun twice.', outcome: () => 'blue both times', name: 'spins a fair spinner with 5 equal sections, one of them blue, twice' },
    { m: 10, text: 'A fair ten-sided die is thrown twice.', outcome: () => `two ${int(r, 1, 10)}s`, name: 'throws a fair ten-sided die twice' },
    { m: 8, text: 'A fair eight-sided die is thrown twice.', outcome: () => `two ${int(r, 1, 8)}s`, name: 'throws a fair eight-sided die twice' },
  ]
  const t = r() < 0.4 ? things[0]! : pick(r, things)
  const outcome = t.outcome()
  const name = pick(r, NAMES)
  const setup = r() < 0.5 ? t.text : `${name} ${t.name}.`
  const total = t.m * t.m
  const answer = 1 / total
  // Second route: every pair listed and the one matching pair counted.
  const counted = listAll([range(1, t.m), range(1, t.m)]).filter(([a, b]) => a === 1 && b === 1).length
  return {
    question: {
      type: 'numeric',
      prompt: `${setup} What is the probability of ${outcome}? ${FRACTION_OR_DECIMAL}`,
      solution: `$${dfrac(1, t.m)} \\times ${dfrac(1, t.m)} = ${dfrac(1, total)} = ${show(answer)}$.`,
      markScheme: scheme(slot, [], eitherForm(1, total)),
      answer,
      tolerance: tolFor(answer),
    },
    check: { agrees: counted === 1 && near(counted / total, answer), detail: `${counted} of ${total} pairs` },
    values: { m: t.m, outcome, total },
  }
}

interface Daily {
  setup: (p: string, name: string) => string
  both: string
  once: string
  neither: string
  yes: string
  no: string
}
const RARE: Daily[] = [
  { setup: (p) => `A bus is late with probability ${p} each day, independently.`, both: 'it is late on both of two days', once: 'it is late exactly once in two days', neither: '', yes: 'late', no: 'on time' },
  { setup: (p, n) => `The probability that ${n}'s train is cancelled on any one day is ${p}, independently of other days.`, both: 'the train is cancelled on both of two days', once: 'the train is cancelled on exactly one of two days', neither: '', yes: 'cancelled', no: 'runs' },
  { setup: (p, n) => `The probability that ${n} forgets a PE kit on a school day is ${p}, independently of other days.`, both: 'NAME forgets it on both of two days', once: 'NAME forgets it on exactly one of two days', neither: '', yes: 'forgets', no: 'remembers' },
  { setup: (p) => `A shop's card machine breaks down with probability ${p} each day, independently.`, both: 'it breaks down on both of two days', once: 'it breaks down on exactly one of two days', neither: '', yes: 'breaks down', no: 'works' },
  { setup: (p) => `In a mountain village it snows on any day in January with probability ${p}, independently of other days.`, both: 'it snows on both of two days', once: 'it snows on exactly one of two days', neither: '', yes: 'snow', no: 'no snow' },
]
const LIKELY: Daily[] = [
  { setup: (p) => `A machine works with probability ${p} each day, independently.`, both: 'it works on both of two days', once: '', neither: 'it fails on both of two days', yes: 'works', no: 'fails' },
  { setup: (p, n) => `${n}'s alarm goes off with probability ${p} each morning, independently.`, both: 'it goes off on both of two mornings', once: '', neither: 'it fails to go off on both of two mornings', yes: 'goes off', no: 'fails' },
  { setup: (p) => `A seed germinates with probability ${p}, independently of other seeds. Two seeds are planted.`, both: 'both seeds germinate', once: '', neither: 'neither seed germinates', yes: 'germinates', no: 'does not' },
  { setup: (p) => `A football team wins a home match with probability ${p}, independently of other matches.`, both: 'it wins both of its next two home matches', once: '', neither: 'it wins neither of its next two home matches', yes: 'wins', no: 'does not win' },
  { setup: (p, n) => `${n} scores a penalty with probability ${p}, independently each time. ${n} takes two penalties.`, both: 'NAME scores both', once: '', neither: 'NAME misses both', yes: 'scores', no: 'misses' },
]

const RARE_P = [5, 8, 10, 12, 15, 18, 20, 22, 25, 28, 30, 35, 40, 45]
const LIKELY_P = [55, 60, 65, 70, 72, 75, 80, 82, 85, 88, 90, 92, 95, 98]

/**
 * Two independent days on a tree: both (q5, q9), exactly once (q6), neither (q9 on alternate
 * turns). The second method counts cells in a 100 by 100 grid, one row and one column per
 * hundredth: the paths of the tree as equally likely pairs.
 */
function twoDays(ask: 'both' | 'once' | 'likely'): Builder {
  return (r, slot, turn) => {
    const ctx = pick(r, ask === 'likely' ? LIKELY : RARE)
    const k = pick(r, ask === 'likely' ? LIKELY_P : RARE_P)
    const name = pick(r, NAMES)
    const which = ask === 'likely' ? (turn % 2 === 0 ? 'both' : 'neither') : ask
    const p = hund(k)
    const q = hund(100 - k)
    let num: number
    let solution: string
    let method: string
    if (which === 'both') {
      num = k * k
      solution = `$${p} \\times ${p} = ${show(num / 10000)}$.`
      method = 'multiplies along the path'
    } else if (which === 'neither') {
      num = (100 - k) ** 2
      solution = `On each branch the probability it does not happen is $1 - ${p} = ${q}$, so $${q} \\times ${q} = ${show(num / 10000)}$.`
      method = `uses 1 − ${p} = ${q} on both branches`
    } else {
      num = 2 * k * (100 - k)
      const one = k * (100 - k)
      solution = `${cap(ctx.no)} then ${ctx.yes} is $${q} \\times ${p} = ${show(one / 10000)}$, and ${ctx.yes} then ${ctx.no} is also $${show(one / 10000)}$. Adding both orders gives $${show(num / 10000)}$.`
      method = 'uses both orders'
    }
    const answer = num / 10000
    const asked = ctx[which].replace(/NAME/g, name)
    let grid = 0
    for (let i = 0; i < 100; i++) for (let j = 0; j < 100; j++) {
      const a = i < k
      const b = j < k
      if (which === 'both' ? a && b : which === 'neither' ? !a && !b : a !== b) grid++
    }
    return {
      question: {
        type: 'numeric',
        prompt: `${ctx.setup(p, name)} What is the probability that ${asked}? Give your answer as a decimal.`,
        solution,
        markScheme: scheme(slot, [method], show(answer)),
        answer,
        tolerance: tolFor(answer),
      },
      check: { agrees: grid === num && answer > 0 && answer < 1, detail: `${grid} of 10000 grid cells` },
      values: { k, which },
    }
  }
}

interface Bag {
  setup: (a: number, x: string, b: number, y: string, name: string) => string
  colours: [string, string][]
  noun: string
}
const BAGS: Bag[] = [
  { setup: (a, x, b, y) => `A bag holds ${a} ${x} and ${b} ${y} counters.`, colours: [['red', 'blue'], ['green', 'yellow'], ['black', 'white']], noun: 'counter' },
  { setup: (a, x, b, y) => `A jar holds ${a} ${x} and ${b} ${y} sweets.`, colours: [['lemon', 'orange'], ['strawberry', 'lime'], ['cola', 'cherry']], noun: 'sweet' },
  { setup: (a, x, b, y, n) => `${n} has a bag of ${a} ${x} and ${b} ${y} marbles.`, colours: [['red', 'blue'], ['green', 'purple'], ['silver', 'gold']], noun: 'marble' },
  { setup: (a, x, b, y) => `A drawer holds ${a} ${x} and ${b} ${y} socks, all loose.`, colours: [['black', 'grey'], ['white', 'navy']], noun: 'sock' },
]

/** Two of a colour with replacement: written as q7. */
const withReplacement: Builder = (r, slot) => {
  const bag = pick(r, BAGS)
  const [x, y] = pick(r, bag.colours)
  const name = pick(r, NAMES)
  const { a, b, wantFirst } = draw(
    r,
    (r) => ({ a: int(r, 1, 12), b: int(r, 1, 12), wantFirst: r() < 0.5 }),
    ({ a, b, wantFirst }) => a + b >= 4 && a + b <= 20 && a !== b && terminates(wantFirst ? a : b, a + b) && (wantFirst ? a : b) >= 2,
  )
  const n = a + b
  const c = wantFirst ? a : b
  const colour = wantFirst ? x : y
  const [cp, cq] = reduce(c, n)
  const num = c * c
  const den = n * n
  const [p, q] = reduce(num, den)
  const answer = p / q
  // Second route: ordered pairs of labelled items, the first put back before the second.
  const items = [...Array(a).fill(x), ...Array(b).fill(y)] as string[]
  let hits = 0
  for (const i of items.keys()) for (const j of items.keys()) if (items[i] === colour && items[j] === colour) hits++
  return {
    question: {
      type: 'numeric',
      prompt: `${bag.setup(a, x, b, y, name)} One is taken at random and put back, then another is taken. What is the probability both are ${colour}? ${FRACTION_OR_DECIMAL}`,
      solution: `$${dfrac(c, n)} \\times ${dfrac(c, n)} = ${worked(num, den)}$. The ${bag.noun} goes back, so the second branch is unchanged.`,
      markScheme: scheme(slot, [`uses ${c}/${n}${cq !== n ? ` (or ${cp}/${cq})` : ''} twice`], eitherForm(num, den)),
      answer,
      tolerance: tolFor(answer),
    },
    check: { agrees: hits === num && items.length ** 2 === den && near(hits / den, answer), detail: `${hits} of ${den} ordered pairs` },
    values: { a, b, c, n },
  }
}

/**
 * Two taken without replacement: both one colour (q11), one of each (q12, and q15 on even
 * turns), at least one of a colour (q13), both the same colour (q15 on odd turns). The
 * second method labels every item and counts ordered pairs of two different items.
 */
function withoutReplacement(ask: 'both' | 'mixed' | 'at least one' | 'q15'): Builder {
  return (r, slot, turn) => {
    const which = ask === 'q15' ? (turn % 2 === 0 ? 'mixed' : 'same') : ask
    const bag = pick(r, BAGS)
    const [x, y] = pick(r, bag.colours)
    const name = pick(r, NAMES)
    const { a, b } = draw(r, (r) => ({ a: int(r, 2, 9), b: int(r, 2, 9) }), ({ a, b }) => a !== b && a + b >= 6 && a + b <= 15)
    const n = a + b
    const den = n * (n - 1)
    const first = r() < 0.5
    // The colour the question is about: the one both are (q11), or at least one of (q13).
    const c = first ? a : b
    const o = first ? b : a
    const colour = first ? x : y
    const other = first ? y : x
    const items = [...Array(a).fill(x), ...Array(b).fill(y)] as string[]
    const pairs = (ok: (s: string, t: string) => boolean) => {
      let k = 0
      for (const i of items.keys()) for (const j of items.keys()) if (i !== j && ok(items[i]!, items[j]!)) k++
      return k
    }
    let num: number
    let solution: string
    let method: string[]
    let ask2: string
    let listed: number
    let agrees = true
    if (which === 'both') {
      num = c * (c - 1)
      ask2 = `that both are ${colour}`
      solution = `$${dfrac(c, n)} \\times ${dfrac(c - 1, n - 1)} = ${worked(num, den, false)}$. The second branch is ${c - 1} out of ${n - 1} because a ${colour} has gone.`
      method = [`second branch is ${c - 1}/${n - 1}`, 'multiplies along the path']
      listed = pairs((s, t) => s === colour && t === colour)
    } else if (which === 'mixed') {
      num = 2 * a * b
      ask2 = 'of one of each colour'
      solution = `${cap(x)} then ${y} is $${dfrac(a, n)} \\times ${dfrac(b, n - 1)} = ${dfrac(a * b, den)}$ and ${y} then ${x} is $${dfrac(b, n)} \\times ${dfrac(a, n - 1)} = ${dfrac(a * b, den)}$. Adding both orders gives $${worked(num, den, false)}$.`
      method = [ask === 'q15' ? 'one order correct' : 'finds one of the two orders', 'adds both orders']
      listed = pairs((s, t) => s !== t)
    } else if (which === 'same') {
      num = a * (a - 1) + b * (b - 1)
      ask2 = 'that both are the same colour'
      solution = `Both ${x} is $${dfrac(a, n)} \\times ${dfrac(a - 1, n - 1)} = ${dfrac(a * (a - 1), den)}$ and both ${y} is $${dfrac(b, n)} \\times ${dfrac(b - 1, n - 1)} = ${dfrac(b * (b - 1), den)}$. Adding both gives $${worked(num, den, false)}$.`
      method = ['one colour correct', 'adds both colours']
      listed = pairs((s, t) => s === t)
    } else {
      const none = o * (o - 1)
      num = den - none
      const [np, nq] = reduce(none, den)
      ask2 = `that at least one is ${colour}`
      solution = `The opposite is both ${other}, which is $${dfrac(o, n)} \\times ${dfrac(o - 1, n - 1)} = ${worked(none, den, false)}$. So $P(\\text{at least one ${colour}}) = 1 - ${dfrac(np, nq)} = ${worked(num, den, false)}$.`
      method = [`uses 1 − P(both ${other})`, `P(both ${other}) = ${np}/${nq}`]
      listed = pairs((s, t) => s === colour || t === colour)
      // Third route: 1 − P(none), from its own pairs.
      agrees = den - pairs((s, t) => s === other && t === other) === num
    }
    const [p, q] = reduce(num, den)
    const take = r() < 0.5 ? 'Two are taken at random without replacement.' : `${name} takes two at random, one after the other, without replacement.`
    const setup = bag.setup(a, x, b, y, name)
    return {
      question: {
        type: 'short-text',
        prompt: `${setup} ${setup.startsWith(name) && take.startsWith(name) ? 'Two are taken at random without replacement.' : take} What is the probability ${ask2}? Give your answer as a fraction in its simplest form.`,
        solution,
        markScheme: scheme(slot, method, `${p}/${q}`),
        accepted: [`${p}/${q}`],
      },
      check: { agrees: agrees && listed === num && items.length * (items.length - 1) === den && q > 1 && gcd(p, q) === 1, detail: `${listed} of ${den} ordered pairs` },
      values: { a, b, x, y, which, colour, num, den },
    }
  }
}

const treeGenerators: Generator[] = [
  bySlot('tree-independent', TREE, { q3: sameTwice, q5: twoDays('both'), q6: twoDays('once'), q9: twoDays('likely'), q7: withReplacement }),
  bySlot('tree-without-replacement', TREE, { q11: withoutReplacement('both'), q12: withoutReplacement('mixed'), q13: withoutReplacement('at least one'), q15: withoutReplacement('q15') }),
]

/* ------------------------------------------------------------------------------------------
 * Relative frequency and expected outcomes
 * ---------------------------------------------------------------------------------------- */

const RELFREQ = 'relative-frequency-and-expected-outcomes'

const THROWN = [
  { thing: 'A bottle top', lands: 'lands upside down', landing: 'landing upside down' },
  { thing: 'A drawing pin', lands: 'lands point up', landing: 'landing point up' },
  { thing: 'A paper cup', lands: 'lands on its side', landing: 'landing on its side' },
  { thing: 'A biased coin', lands: 'lands on heads', landing: 'landing on heads' },
  { thing: 'A plastic cone', lands: 'lands on its base', landing: 'landing on its base' },
]
const lower = (s: string) => s[0]!.toLowerCase() + s.slice(1)

/** k/n as a decimal by the second route: scale to the power of ten n divides. */
function scaled(k: number, n: number): number {
  let ten = 1
  while (ten % n !== 0) ten *= 10
  return (k * (ten / n)) / ten
}

/** Relative frequency of one outcome: written as q3. */
const relativeFrequency: Builder = (r, slot) => {
  const t = pick(r, THROWN)
  const name = pick(r, NAMES)
  const n = pick(r, [20, 25, 40, 50, 80, 100, 125, 200, 250])
  const k = draw(r, (r) => int(r, 1, n - 1), (k) => k / n >= 0.05 && k / n <= 0.95)
  const answer = k / n
  const prompt = r() < 0.5
    ? `${t.thing} is thrown ${n} times. It ${t.lands} ${timesCount(k)}. Work out the relative frequency of ${t.landing}. Give your answer as a decimal.`
    : `${name} throws ${lower(t.thing)} ${n} times, and it ${t.lands} ${timesCount(k)}. Work out the relative frequency of ${t.landing}. Give your answer as a decimal.`
  return {
    question: { type: 'numeric', prompt, solution: `$${dfrac(k, n)} = ${show(answer)}$.`, markScheme: scheme(slot, [`${k}/${n}`], show(answer)), answer, tolerance: 0.001 },
    check: { agrees: near(scaled(k, n), answer), detail: `scaled to a power of ten: ${scaled(k, n)}` },
    values: { k, n },
  }
}

/** Expected frequency on a fair dice or spinner: written as q4. */
const expectedFair: Builder = (r, slot) => {
  const { m, kind, v, N } = draw(
    r,
    (r) => ({ m: pick(r, [4, 6, 6, 6, 8, 10]), kind: pick(r, ['number', 'number', 'even', 'greater', 'multiple of 3'] as const), v: int(r, 1, 9), N: 10 * int(r, 3, 60) }),
    ({ m, kind, v, N }) => {
      if ((kind === 'number' || kind === 'greater') && v >= m) return false
      const fav = kind === 'number' ? 1 : kind === 'even' ? m / 2 : kind === 'greater' ? m - v : Math.floor(m / 3)
      return (N * fav) % m === 0 && fav >= 1
    },
  )
  const faces = range(1, m)
  const test = (x: number) => (kind === 'number' ? x === v : kind === 'even' ? x % 2 === 0 : kind === 'greater' ? x > v : x % 3 === 0)
  const fav = faces.filter(test).length
  const answer = (N * fav) / m
  const name = pick(r, NAMES)
  const event = kind === 'number' ? `land on ${v}` : kind === 'even' ? 'land on an even number' : kind === 'greater' ? `land on a number greater than ${v}` : 'land on a multiple of 3'
  const setup = r() < 0.5 ? `A fair ${WORDS[m]}-sided dice is rolled ${N} times.` : `${name} rolls a fair ${WORDS[m]}-sided dice ${N} times.`
  // Second route in whole numbers: each block of m rolls is expected to show every face once.
  const blocks = N / m
  const byBlocks = Number.isInteger(blocks) ? blocks * fav : (N * fav) / m
  return {
    question: {
      type: 'numeric',
      prompt: `${setup} How many times would you expect it to ${event}?`,
      solution: `${fav === 1 ? '' : `${cap(WORDS[fav]!)} of the ${m} faces count, so the probability is $${worked(fav, m, false)}$. `}$${dfrac(fav, m)} \\times ${N} = ${answer}$.`,
      markScheme: scheme(slot, [`${fav}/${m} × ${N}`], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: Number.isInteger(answer) && byBlocks === answer && fav === faces.filter(test).length, detail: `${fav} faces; by blocks ${byBlocks}` },
    values: { m, kind, v, N, fav },
  }
}

const BIASED = [
  { lo: 10, hi: 60, setup: (p: string, N: number) => `The probability that a biased spinner lands on red is ${p}. The spinner is spun ${N} times. How many times would you expect it to land on red?` },
  { lo: 60, hi: 95, setup: (p: string, N: number) => `The probability that a seed germinates is ${p}. ${N} seeds are planted. How many would you expect to germinate?` },
  { lo: 40, hi: 90, setup: (p: string, N: number, n: string) => `The probability that ${n} scores from a free throw is ${p}. ${n} takes ${N} free throws. How many would you expect ${n} to score?` },
  { lo: 5, hi: 30, setup: (p: string, N: number) => `The probability that a train is late is ${p}. How many of the next ${N} trains would you expect to be late?` },
  { lo: 1, hi: 8, setup: (p: string, N: number) => `The probability that a battery from a factory is faulty is ${p}. A batch of ${N} batteries is made. How many would you expect to be faulty?` },
]

/** Expected frequency from a decimal probability: written as q5. Checked in hundredths. */
const expectedDecimal: Builder = (r, slot) => {
  const ctx = pick(r, BIASED)
  const name = pick(r, NAMES)
  const { k, N } = draw(r, (r) => ({ k: int(r, ctx.lo, ctx.hi), N: pick(r, [20, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500, 600, 800, 1000]) }), ({ k, N }) => (k * N) % 100 === 0 && k * N >= 300)
  const answer = (k * N) / 100
  return {
    question: {
      type: 'numeric',
      prompt: ctx.setup(hund(k), N, name),
      solution: `$${hund(k)} \\times ${N} = ${answer}$.`,
      markScheme: scheme(slot, [`${hund(k)} × ${N}`], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: Number.isInteger(answer) && answer * 100 === k * N, detail: `${k} hundredths of ${N}` },
    values: { k, N },
  }
}

const COLOUR_SETS = [['red', 'blue', 'green'], ['black', 'white', 'yellow'], ['orange', 'purple', 'pink']]

/** Estimating a probability from repeated draws with replacement: written as q6. */
const estimateFromCounts: Builder = (r, slot) => {
  const colours = pick(r, COLOUR_SETS)
  const N = pick(r, [20, 25, 40, 50, 80, 100, 200])
  const counts = draw(r, (r) => {
    const a = int(r, 1, N - 2)
    const b = int(r, 1, N - a - 1)
    return [a, b, N - a - b]
  }, (c) => c.every((x) => x >= 2 && x / N >= 0.05) && new Set(c).size === 3)
  const ask = int(r, 0, 2)
  const answer = counts[ask]! / N
  const name = pick(r, NAMES)
  const who = r() < 0.5 ? 'A counter is taken at random, its colour noted, and it is put back.' : `${name} takes a counter at random, notes its colour, and puts it back.`
  return {
    question: {
      type: 'numeric',
      prompt: `A bag holds ${colours[0]}, ${colours[1]} and ${colours[2]} counters. ${who} This is done ${N} times: ${colours[0]} ${timesCount(counts[0])}, ${colours[1]} ${timesCount(counts[1])} and ${colours[2]} ${timesCount(counts[2])}. Estimate the probability that the next counter taken is ${colours[ask]}. Give your answer as a decimal.`,
      solution: `$${dfrac(counts[ask]!, N)} = ${show(answer)}$.`,
      markScheme: scheme(slot, [`${counts[ask]}/${N}`], show(answer)),
      answer,
      tolerance: 0.001,
    },
    check: { agrees: counts.reduce((x, y) => x + y, 0) === N && near(scaled(counts[ask]!, N), answer), detail: `counts ${counts.join(', ')} of ${N}` },
    values: { N, ask, count: counts[ask]!, counts: counts.join(',') },
  }
}

/** The best estimate is the one from the most trials, then times the new number: written as q7. */
const bestEstimateExpected: Builder = (r, slot) => {
  const t = pick(r, THROWN)
  const { n1, n2, n3, k1, k2, k3, M } = draw(
    r,
    (r) => {
      const n3 = pick(r, [100, 200, 250, 400, 500])
      const n2 = pick(r, [40, 50, 60].filter((x) => x < n3))
      const n1 = pick(r, [10, 20])
      const rate = int(r, 15, 85) / 100
      const k1 = Math.min(n1 - 1, Math.max(1, Math.round(n1 * (rate + (r() - 0.5) * 0.3))))
      const k2 = Math.min(n2 - 1, Math.max(k1 + 1, Math.round(n2 * (rate + (r() - 0.5) * 0.15))))
      const k3 = Math.max(k2 + 1, Math.round(n3 * rate))
      return { n1, n2, n3, k1, k2, k3, M: pick(r, [300, 400, 500, 600, 800, 1000, 1200, 1500, 2000]) }
    },
    ({ n1, n2, n3, k1, k2, k3, M }) =>
      // Predicting for the number already thrown would make the answer the count already given.
      k1 >= 1 && k2 - k1 >= 1 && k2 - k1 <= n2 - n1 && k3 - k2 >= 1 && k3 - k2 <= n3 - n2 && k3 < n3 && (k3 * M) % n3 === 0 && terminates(k3, n3) && k1 * n3 !== k3 * n1 && M !== n3,
  )
  const best = k3 / n3
  const answer = (k3 * M) / n3
  const stage = t.lands.replace(/^lands /, 'landed ')
  return {
    question: {
      type: 'numeric',
      prompt: `${t.thing} is thrown ${n3} times. After ${n1} throws it has ${stage} ${timesCount(k1)}, after ${n2} throws ${timesCount(k2)}, and after ${n3} throws ${timesCount(k3)}. Use the best estimate of the probability to predict how many times it would ${t.lands.replace(/^lands/, 'land')} in ${M} throws.`,
      solution: `The best estimate comes from the most throws: $${dfrac(k3, n3)} = ${show(best)}$. Then $${show(best)} \\times ${M} = ${answer}$.`,
      markScheme: scheme(slot, [`uses ${k3}/${n3}`, `× ${M}`], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: Math.max(n1, n2, n3) === n3 && Number.isInteger(answer) && answer * n3 === k3 * M, detail: `${k3} × ${M} / ${n3}` },
    values: { n1, n2, n3, k1, k2, k3, M },
  }
}

/** Expected frequency of an event on two dice: written as q14. The sample space is counted. */
const expectedTwoDice: Builder = (r, slot) => {
  const events = [
    { name: 'a double six', ok: (a: number, b: number, m: number) => a === m && b === m },
    { name: 'a double', ok: (a: number, b: number) => a === b },
    { name: 'a total of T', ok: (a: number, b: number, _m: number, t: number) => a + b === t },
    { name: 'a total greater than T', ok: (a: number, b: number, _m: number, t: number) => a + b > t },
  ]
  const { m, e, t, N } = draw(
    r,
    (r) => {
      const m = r() < 0.75 ? 6 : 4
      return { m, e: pick(r, events), t: int(r, 3, 2 * m - 1), N: 10 * int(r, 6, 80) }
    },
    ({ m, e, t, N }) => {
      const fav = countLists([range(1, m), range(1, m)], ([a, b]) => e.ok(a!, b!, m, t))
      return fav > 0 && (N * fav) % (m * m) === 0
    },
  )
  const cells = m * m
  const fav = countLists([range(1, m), range(1, m)], ([a, b]) => e.ok(a!, b!, m, t))
  const [p, q] = reduce(fav, cells)
  const answer = (N * fav) / cells
  const event = e.name.replace('T', String(t)).replace('six', m === 6 ? 'six' : 'four')
  // Second route: the grid listed, not counted by the same filter.
  const grid = listAll([range(1, m), range(1, m)]).filter(([a, b]) => e.ok(a!, b!, m, t))
  const name = pick(r, NAMES)
  const setup = r() < 0.5 ? `Two fair ${WORDS[m]}-sided dice are rolled together ${N} times.` : `${name} rolls two fair ${WORDS[m]}-sided dice together ${N} times.`
  return {
    question: {
      type: 'numeric',
      prompt: `${setup} How many times would you expect to get ${event}?`,
      solution: `${cap(event)} is ${fav} of the ${cells} equally likely pairs, so $P = ${worked(fav, cells, false)}$. Then $${dfrac(p, q)} \\times ${N} = ${answer}$.`,
      markScheme: scheme(slot, [`P(${event}) = ${p}/${q}`], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: grid.length === fav && Number.isInteger(answer) && (N / q) * p === answer, detail: `${grid.length} cells; ${N} ÷ ${q} × ${p}` },
    values: { m, event, eventKind: e.name, t, N, fav },
  }
}

/** Expected profit of a fair game: written as q15. */
const expectedProfit: Builder = (r, slot) => {
  const { s, w, prize, fee, N } = draw(
    r,
    (r) => ({ s: pick(r, [4, 5, 6, 8, 10]), w: int(r, 1, 2), prize: pick(r, [2, 3, 4, 5, 10]), fee: pick(r, [1, 1, 2]), N: 10 * int(r, 5, 50) }),
    ({ s, w, prize, fee, N }) => w < s && (N * w) % s === 0 && fee * N - (N * w * prize) / s > 0,
  )
  const wins = (N * w) / s
  const prizes = wins * prize
  const takings = N * fee
  const answer = takings - prizes
  const name = pick(r, NAMES)
  const who = r() < 0.5 ? 'A school fair stall' : `${name}'s stall at a school fair`
  const sections = `${w === 1 ? 'One section wins' : 'Two sections win'} a £${prize} prize`
  // Second route: the expected profit of one game as a fraction, (fee × s − w × prize) / s, times N.
  const perGame = fee * s - w * prize
  return {
    question: {
      type: 'numeric',
      prompt: `${who} charges £${fee} a go to spin a fair spinner with ${s} equal sections. ${sections}. The game is played ${N} times. Work out the expected profit for the stall, in pounds.`,
      solution: `Expected wins $= ${dfrac(w, s)} \\times ${N} = ${wins}$. Prizes $= ${wins} \\times £${prize} = £${prizes}$. Takings $= ${N} \\times £${fee} = £${takings}$. Profit $= £${takings} - £${prizes} = £${answer}$.`,
      markScheme: scheme(slot, [`expected wins, ${wins}`, `takings ${takings} minus prizes ${prizes}`], `£${answer}`),
      answer,
      tolerance: 0,
    },
    check: { agrees: (perGame * N) / s === answer && answer > 0, detail: `per game ${perGame}/${s}, times ${N}` },
    values: { s, w, prize, fee, N },
  }
}

const FOUR_COLOURS = [['red', 'blue', 'green', 'yellow'], ['A', 'B', 'C', 'D'], ['white', 'black', 'orange', 'purple']]

/** Missing probability, then expected frequency: written as q16. */
const missingThenExpected: Builder = (r, slot) => {
  const colours = pick(r, FOUR_COLOURS)
  const { ps, N } = draw(
    r,
    (r) => ({ ps: [int(r, 5, 45), int(r, 5, 45), int(r, 5, 45)], N: pick(r, [100, 200, 300, 400, 500, 800, 1000]) }),
    ({ ps, N }) => {
      const rest = 100 - ps[0]! - ps[1]! - ps[2]!
      return rest >= 5 && new Set([...ps, rest]).size === 4 && (rest * N) % 100 === 0
    },
  )
  const rest = 100 - ps.reduce((x, y) => x + y, 0)
  const answer = (rest * N) / 100
  const ask = colours[3]!
  return {
    question: {
      type: 'numeric',
      prompt: `A biased spinner lands on ${colours[0]}, ${colours[1]}, ${colours[2]} or ${ask}. P(${colours[0]}) = ${hund(ps[0]!)}, P(${colours[1]}) = ${hund(ps[1]!)} and P(${colours[2]}) = ${hund(ps[2]!)}. The spinner is spun ${N} times. How many times would you expect it to land on ${ask}?`,
      solution: `$P(\\text{${ask}}) = 1 - ${ps.map(hund).join(' - ')} = ${hund(rest)}$. Then $${hund(rest)} \\times ${N} = ${answer}$.`,
      markScheme: scheme(slot, [`P(${ask}) = ${hund(rest)}`, `${hund(rest)} × ${N}`], String(answer)),
      answer,
      tolerance: 0,
    },
    // Second route: the other three expected counts, taken from N.
    check: { agrees: N - ps.reduce((s, p) => s + (p * N) / 100, 0) === answer, detail: `N minus the other three expected counts` },
    values: { a: ps[0]!, b: ps[1]!, c: ps[2]!, rest, N },
  }
}

/** Pooled results beat an average of rates: written as q18. */
const pooled: Builder = (r, slot) => {
  const t = pick(r, THROWN)
  const [p1, p2] = shuffle(r, NAMES).slice(0, 2) as [string, string]
  const { n1, n2, k1, k2 } = draw(
    r,
    (r) => {
      const total = pick(r, [50, 100, 200, 250])
      const n1 = pick(r, [10, 20, 25, 30, 40, 50].filter((x) => x < total / 2))
      const rate = int(r, 20, 80) / 100
      return { n1, n2: total - n1, k1: Math.round(n1 * (rate + (r() - 0.5) * 0.3)), k2: Math.round((total - n1) * rate) }
    },
    ({ n1, n2, k1, k2 }) => k1 > 0 && k1 < n1 && k2 > 0 && k2 < n2 && (k1 + k2) / (n1 + n2) >= 0.05 && k1 * n2 !== k2 * n1 && terminates(k1, n1) && terminates(k2, n2),
  )
  const total = n1 + n2
  const hits = k1 + k2
  const answer = hits / total
  const avg = (k1 / n1 + k2 / n2) / 2
  // Second route: each person's relative frequency, weighted by their number of throws.
  const weighted = (n1 * (k1 / n1) + n2 * (k2 / n2)) / total
  return {
    question: {
      type: 'numeric',
      prompt: `${p1} throws ${lower(t.thing)} ${n1} times and it ${t.lands} ${timesCount(k1)}. ${p2} throws the same ${lower(t.thing).replace(/^an? /, '')} ${n2} times and it ${t.lands} ${timesCount(k2)}. Using all their results, work out the best estimate of the probability that it ${t.lands}. Give your answer as a decimal.`,
      solution: `Pool the throws: $\\dfrac{${k1} + ${k2}}{${n1} + ${n2}} = ${worked(hits, total)}$. Averaging ${show(k1 / n1)} and ${show(k2 / n2)} would give ${show(avg)}, which wrongly treats ${n1} throws as worth as much as ${n2}.`,
      markScheme: scheme(slot, [`${hits}/${total}`], show(answer)),
      answer,
      tolerance: tolFor(answer) || 0.001,
    },
    check: { agrees: near(weighted, answer) && terminates(hits, total), detail: `weighted rates ${weighted}` },
    values: { n1, n2, k1, k2 },
  }
}

const relFreqGenerators: Generator[] = [
  bySlot('relative-frequency-estimates', RELFREQ, { q3: relativeFrequency, q6: estimateFromCounts, q18: pooled }),
  bySlot('relative-frequency-expected', RELFREQ, { q4: expectedFair, q5: expectedDecimal, q7: bestEstimateExpected, q14: expectedTwoDice, q15: expectedProfit, q16: missingThenExpected }),
]

/* ------------------------------------------------------------------------------------------
 * Frequency trees
 * ---------------------------------------------------------------------------------------- */

const FTREE = 'frequency-trees'

interface Split {
  whole: string
  one: string
  A: string
  B: string
  oneA: string
  oneB: string
  does: string
  doesNot: string
  does1: string
  doers: string
  base: string
  who: string
}
export const SPLITS: Split[] = [
  { whole: 'students', one: 'student', A: 'boys', B: 'girls', oneA: 'boy', oneB: 'girl', does: 'walk to school', doesNot: 'do not walk to school', does1: 'walks to school', doers: 'walkers', base: 'walk', who: 'who' },
  { whole: 'visitors to a museum', one: 'visitor', A: 'adults', B: 'children', oneA: 'adult', oneB: 'child', does: 'buy a guidebook', doesNot: 'do not buy a guidebook', does1: 'buys a guidebook', doers: 'guidebook buyers', base: 'buy a guidebook', who: 'who' },
  { whole: 'members of a gym', one: 'member', A: 'men', B: 'women', oneA: 'man', oneB: 'woman', does: 'go to a class', doesNot: 'do not go to a class', does1: 'goes to a class', doers: 'members who go to a class', base: 'go to a class', who: 'who' },
  { whole: 'cars at a test centre', one: 'car', A: 'petrol cars', B: 'electric cars', oneA: 'petrol car', oneB: 'electric car', does: 'pass the test', doesNot: 'fail the test', does1: 'passes the test', doers: 'cars that pass', base: 'pass the test', who: 'that' },
  { whole: 'people at a concert', one: 'person', A: 'adults', B: 'teenagers', oneA: 'adult', oneB: 'teenager', does: 'buy a programme', doesNot: 'do not buy a programme', does1: 'buys a programme', doers: 'programme buyers', base: 'buy a programme', who: 'who' },
]

const an = (w: string) => (/^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`)

/** A full frequency tree: T split into A and B, each split into does and does not. */
function population(r: Rng, ok: (p: { T: number; A: number; B: number; a1: number; b1: number }) => boolean = () => true) {
  const ctx = pick(r, SPLITS)
  const p = draw(r, (r) => {
    const T = 10 * int(r, 6, 20)
    const A = int(r, Math.round(T * 0.3), Math.round(T * 0.7))
    const B = T - A
    return { T, A, B, a1: int(r, 3, A - 3), b1: int(r, 3, B - 3) }
  }, (p) => p.A !== p.B && p.a1 !== p.b1 && ok(p))
  return { ctx, ...p, a0: p.A - p.a1, b0: p.B - p.b1, w: p.a1 + p.b1 }
}

/** The people themselves, one record each: the second route for every count on the tree. */
export function people(A: number, a1: number, B: number, b1: number) {
  return [
    ...Array.from({ length: A }, (_, i) => ({ group: 'A', does: i < a1 })),
    ...Array.from({ length: B }, (_, i) => ({ group: 'B', does: i < b1 })),
  ]
}

const DENOMS: Record<number, [string, string]> = {
  2: ['half', 'halves'], 3: ['third', 'thirds'], 4: ['quarter', 'quarters'], 5: ['fifth', 'fifths'], 6: ['sixth', 'sixths'], 7: ['seventh', 'sevenths'],
  8: ['eighth', 'eighths'], 9: ['ninth', 'ninths'], 10: ['tenth', 'tenths'], 11: ['eleventh', 'elevenths'], 12: ['twelfth', 'twelfths'],
}

/** "three fifths", when both parts have a word. */
export function fractionWords(p: number, q: number): string | undefined {
  const d = DENOMS[q]
  const n = WORDS[p]
  return d && n && p < q ? `${n} ${p === 1 ? d[0] : d[1]}` : undefined
}

/** The forms a fraction in lowest terms is typed in, as the written q7 and q10 list them. */
export function fractionForms(p: number, q: number, decimal: boolean): string[] {
  const words = fractionWords(p, q)
  return [`${p}/${q}`, `${p} over ${q}`, ...(words ? [words] : []), ...(decimal && terminates(p, q) ? [show(p / q)] : [])]
}

const treeQuestion = (slot: Question, prompt: string, solution: string, answer: number, check: { agrees: boolean; detail: string }, values: Record<string, number | string>): Draft => ({
  question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], String(answer)), answer, tolerance: 0 },
  check,
  values,
})

/** q1: the other branch from the root. */
const otherGroup: Builder = (r, slot) => {
  const { ctx, T, A, B, a1, b1 } = population(r)
  const crowd = people(A, a1, B, b1)
  return treeQuestion(slot, `Of ${T} ${ctx.whole}, ${A} are ${ctx.A} and the rest are ${ctx.B}. How many are ${ctx.B}?`,
    `$${T} - ${A} = ${B}$: the two branches from the root add to the total.`, B,
    { agrees: crowd.filter((p) => p.group === 'B').length === B && crowd.length === T, detail: `${crowd.length} people listed` }, { T, A })
}

/** q2: a percentage of one branch. */
const percentOfBranch: Builder = (r, slot) => {
  const { ctx, A } = population(r, (p) => p.A % 10 === 0)
  const pct = pick(r, [10, 15, 20, 25, 30, 35, 40, 45, 55, 60, 65, 70, 75, 80, 85, 90].filter((pct) => (pct * A) % 100 === 0 && pct * A >= 500))
  const answer = (pct * A) / 100
  return treeQuestion(slot, `${pct}% of the ${A} ${ctx.A} ${ctx.does}. How many of the ${ctx.A} ${ctx.base}?`,
    `$${show(pct / 100)} \\times ${A} = ${answer}$. The percentage is of the ${ctx.A} box, not the total.`, answer,
    { agrees: answer * 100 === pct * A && Number.isInteger(answer), detail: `${pct} hundredths of ${A}` }, { pct, A })
}

/** q4: the other branch of the second split. */
const doesNotInBranch: Builder = (r, slot) => {
  const { ctx, A, a1, B, b1, b0 } = population(r)
  const crowd = people(A, a1, B, b1)
  return treeQuestion(slot, `Of the ${B} ${ctx.B}, ${b1} ${ctx.does}. How many of the ${ctx.B} ${ctx.doesNot}?`,
    `$${B} - ${b1} = ${b0}$.`, b0,
    { agrees: crowd.filter((p) => p.group === 'B' && !p.does).length === b0, detail: 'counted from the people listed' }, { B, b1 })
}

/** q5: a total the tree does not show. */
const doersTotal: Builder = (r, slot) => {
  const { ctx, T, A, a1, B, b1, w } = population(r)
  const crowd = people(A, a1, B, b1)
  return treeQuestion(slot, `In a group of ${T} ${ctx.whole}, ${a1} of the ${ctx.A} and ${b1} of the ${ctx.B} ${ctx.does}. How many of the ${T} ${ctx.base} in total?`,
    `$${a1} + ${b1} = ${w}$. A frequency tree does not show this total, so it has to be added up.`, w,
    { agrees: crowd.filter((p) => p.does).length === w, detail: 'counted from the people listed' }, { T, a1, b1 })
}

/** q9: the four end boxes add back to the root. */
const endBoxes: Builder = (r, slot) => {
  const { ctx, T, A, a1, a0, B, b1, b0 } = population(r)
  const crowd = people(A, a1, B, b1)
  return treeQuestion(slot, `A frequency tree shows ${T} ${ctx.whole}: ${A} ${ctx.A}, of whom ${a1} ${ctx.does} and ${a0} do not; ${B} ${ctx.B}, of whom ${b1} ${ctx.does} and ${b0} do not. Add the four end boxes. What total should they give?`,
    `$${a1} + ${a0} + ${b1} + ${b0} = ${T}$, the root. The end boxes account for everyone exactly once.`, T,
    { agrees: crowd.length === a1 + a0 + b1 + b0, detail: `${crowd.length} people listed` }, { T, A, a1, B, b1 })
}

/** A probability read off the tree, as short text. */
function treeFraction(slot: Question, prompt: string, solution: string, k: number, of: number, accepted: string[], check: boolean, values: Record<string, number | string>): Draft {
  const [p, q] = reduce(k, of)
  return {
    question: { type: 'short-text', prompt, solution, markScheme: scheme(slot, [], `${p}/${q}`), accepted },
    check: { agrees: check && gcd(p, q) === 1, detail: `${k} of ${of} people` },
    values,
  }
}

/** q6: anyone chosen from the whole group; the fraction does not simplify, as written. */
const fromEveryone: Builder = (r, slot) => {
  const { ctx, T, A, a1, B, b1, w } = population(r, ({ T, a1, b1 }) => gcd(a1 + b1, T) === 1)
  const crowd = people(A, a1, B, b1)
  return treeFraction(slot, `${cap(an(ctx.one))} is chosen at random from the ${T} ${ctx.whole}. ${w} of them ${ctx.does}. What is the probability the ${ctx.one} ${ctx.does1}? Give a fraction.`,
    `Choosing from everyone, so the bottom is ${T}: $\\frac{${w}}{${T}}$. It does not simplify.`, w, T,
    [`${w}/${T}`, `${w} over ${T}`, `${w} out of ${T}`], crowd.filter((p) => p.does).length === w, { T, w })
}

/** q7 and q10: chosen from one branch; the fraction simplifies. */
function fromBranch(branch: 'A' | 'B', decimal: boolean): Builder {
  return (r, slot) => {
    const { ctx, A, a1, B, b1 } = population(r, (p) => (branch === 'A' ? gcd(p.a1, p.A) > 1 : gcd(p.b1, p.B) > 1))
    const size = branch === 'A' ? A : B
    const k = branch === 'A' ? a1 : b1
    const group = branch === 'A' ? ctx.A : ctx.B
    const one = branch === 'A' ? ctx.oneA : ctx.oneB
    const [p, q] = reduce(k, size)
    const crowd = people(A, a1, B, b1).filter((x) => x.group === branch)
    const counted = crowd.filter((x) => x.does).length
    const prompt = branch === 'A'
      ? `${cap(an(one))} is chosen at random from the ${size} ${group}. ${k} of them ${ctx.does}. What is the probability the ${one} chosen ${ctx.does1}? Give a fraction in its lowest terms.`
      : `Of the ${size} ${group}, ${k} ${ctx.does}. ${cap(an(one))} is chosen at random from the ${group}. What is the probability the ${one} ${ctx.does1}, in its lowest terms?`
    return treeFraction(slot, prompt, `Choosing from the ${group}, so the bottom is ${size}: $\\frac{${k}}{${size}} = \\frac{${p}}{${q}}$.`, k, size,
      fractionForms(p, q, decimal), counted === k && crowd.length === size, { size, k, p, q })
  }
}

/** q11: given they do it, which branch: the denominator is the doers, not the branch. */
const conditionalOnDoers: Builder = (r, slot) => {
  // The doers must not number the same as the branch, or the warning names the answer.
  const { ctx, A, a1, B, b1, w } = population(r, ({ a1, b1, B }) => gcd(b1, a1 + b1) > 1 && a1 + b1 !== B)
  const [p, q] = reduce(b1, w)
  const doers = people(A, a1, B, b1).filter((x) => x.does)
  const counted = doers.filter((x) => x.group === 'B').length
  const g = gcd(b1, w)
  return treeFraction(slot,
    `${cap(an(ctx.one))} ${ctx.who} ${ctx.does1} is chosen at random. ${b1} of the ${w} ${ctx.doers} are ${ctx.B}. What is the probability the ${ctx.one} is ${an(ctx.oneB)}, in its lowest terms?`,
    `Choosing from the **${ctx.doers}**, ${w}: $\\frac{${b1}}{${w}} = \\frac{${p}}{${q}}$, dividing top and bottom by ${g}. Not $\\frac{${b1}}{${B}}$, which answers whether a chosen **${ctx.oneB}** ${ctx.does1}.`,
    b1, w, fractionForms(p, q, false), counted === b1 && doers.length === w, { w, b1, B })
}

/** q15: expected frequency in a new group. */
const treeExpected: Builder = (r, slot) => {
  const { ctx, T, w } = population(r)
  const [p, q] = reduce(w, T)
  const factor = int(r, 2, Math.min(10, Math.floor(2000 / T)))
  const M = factor * T
  const answer = (w * M) / T
  const step = `${w} \\times ${factor}`
  return {
    question: {
      type: 'numeric',
      prompt: `The probability that ${an(ctx.one)} ${ctx.does1} is $\\frac{${w}}{${T}}$. In a different group of ${M} ${ctx.whole}, how many would you expect to ${ctx.base}?`,
      solution: `Expected frequency $= \\text{probability} \\times \\text{number}$: $\\frac{${w}}{${T}} \\times ${M} = ${step} = ${answer}$. An expectation, not a guarantee.`,
      markScheme: scheme(slot, [`multiplies ${w}/${T} by ${M}`], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: Number.isInteger(answer) && (M / q) * p === answer, detail: `${M} ÷ ${q} × ${p}` },
    values: { T, w, M },
  }
}

const frequencyTreeGenerators: Generator[] = [
  bySlot('frequency-tree-counts', FTREE, { q1: otherGroup, q2: percentOfBranch, q4: doesNotInBranch, q5: doersTotal, q9: endBoxes, q15: treeExpected }),
  bySlot('frequency-tree-probabilities', FTREE, { q6: fromEveryone, q7: fromBranch('A', false), q10: fromBranch('B', true), q11: conditionalOnDoers }),
]

/** Generators for choices and outcomes, sample spaces, combined events and tree diagrams, relative frequency, frequency trees. */
export const probabilityGenerators: Generator[] = [...choicesGenerators, ...spaceGenerators, ...treeGenerators, ...relFreqGenerators, ...frequencyTreeGenerators]
