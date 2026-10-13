import type { Question } from '../../content/questions.ts'
import { draw, int, pick, shuffle, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'
import { fmBySlot } from './build.ts'

/**
 * Further Maths (AQA 8365), the-product-rule-for-counting: specification 1.2, the product rule
 * for counting (the specification's example: five-digit odd numbers from 1, 3, 4, 6 and 8 with
 * no digit repeated, written as q5). Choices from a menu (q1), codes with repeats (q2) and
 * without a digit (q10), arrangements of a word with all letters different (q3), one repeated
 * letter (q7) and two (q15), restrictions on the last digit (q5), the first digit (q6, q12)
 * and both at once (q11), and committees where order does not count (q8).
 *
 * Every answer is counted a second way by listing: each code, number, arrangement or committee
 * is written out and counted, never the product formula twice.
 */

const TOPIC = 'the-product-rule-for-counting'

/* ---------------------------------------------------------------------------------------- */
/* Listing, for the second route                                                             */
/* ---------------------------------------------------------------------------------------- */

/** Every ordered list of k of the items, each used at most once, written out one by one. */
export function listArrangements<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) return [[]]
  return items.flatMap((x, i) => listArrangements([...items.slice(0, i), ...items.slice(i + 1)], k - 1).map((rest) => [x, ...rest]))
}

/** Every ordered list of k of the items with repeats allowed, written out one by one. */
export function listSequences<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) return [[]]
  return listSequences(items, k - 1).flatMap((rest) => items.map((x) => [...rest, x]))
}

/** Every different spelling made by rearranging a word's letters: listed, then duplicates dropped. */
export const listSpellings = (word: string) => new Set(listArrangements([...word], word.length).map((a) => a.join(''))).size

/** Every group of k from n people, by the n-bit numbers with k ones. */
export function listGroups(n: number, k: number): number[][] {
  const out: number[][] = []
  for (let mask = 0; mask < 1 << n; mask++) {
    const members = Array.from({ length: n }, (_, i) => i).filter((i) => mask & (1 << i))
    if (members.length === k) out.push(members)
  }
  return out
}

/* ---------------------------------------------------------------------------------------- */
/* Printing                                                                                  */
/* ---------------------------------------------------------------------------------------- */

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1))
/** n × (n − 1) × … for k factors. */
const falling = (n: number, k: number) => Array.from({ length: k }, (_, i) => n - i)
const product = (xs: number[]) => xs.reduce((a, b) => a * b, 1)
const times = (xs: number[]) => xs.join(' \\times ')

/** 1, 3, 4, 6 and 8: a list as the prose prints it. */
export function listText(xs: readonly (string | number)[], last = 'and'): string {
  if (xs.length === 1) return String(xs[0])
  return `${xs.slice(0, -1).join(', ')} ${last} ${xs[xs.length - 1]}`
}

/** n different digits from lo to 9, sorted, drawn so that `ok` holds. */
function digitSet(r: Rng, n: number, lo: number, ok: (ds: number[]) => boolean): number[] {
  const pool = Array.from({ length: 10 - lo }, (_, i) => i + lo)
  return draw(r, (r) => shuffle(r, pool).slice(0, n).sort((a, b) => a - b), ok)
}

/* ---------------------------------------------------------------------------------------- */
/* q1: one choice from each of three lists                                                   */
/* ---------------------------------------------------------------------------------------- */

const MENUS: { say: (a: number, b: number, c: number) => string; why: string }[] = [
  {
    say: (a, b, c) => `A café offers ${a} starters, ${b} main courses and ${c} desserts. How many different three-course meals are there?`,
    why: 'One choice from each course, and the courses are chosen together, so multiply',
  },
  {
    say: (a, b, c) => `A sandwich bar offers ${a} types of bread, ${b} fillings and ${c} sauces. A sandwich is made with one bread, one filling and one sauce. How many different sandwiches can be made?`,
    why: 'One bread, one filling and one sauce are chosen together, so multiply',
  },
  {
    say: (a, b, c) => `A meal deal is one main, one snack and one drink. A shop stocks ${a} mains, ${b} snacks and ${c} drinks for the deal. How many different meal deals are there?`,
    why: 'One choice from each list, and the three are chosen together, so multiply',
  },
  {
    say: (a, b, c) => `A pizza takeaway offers ${a} bases, ${b} sauces and ${c} toppings. A pizza is one base, one sauce and one topping. How many different pizzas can be ordered?`,
    why: 'One base, one sauce and one topping are chosen together, so multiply',
  },
  {
    say: (a, b, c) => `An ice-cream van sells ${a} flavours of ice cream, ${b} types of cone and ${c} toppings. A customer picks one flavour, one cone and one topping. How many different choices are there?`,
    why: 'One flavour, one cone and one topping are chosen together, so multiply',
  },
  {
    say: (a, b, c) => `A school canteen offers ${a} hot meals, ${b} desserts and ${c} drinks. A lunch is one hot meal, one dessert and one drink. How many different lunches are possible?`,
    why: 'One choice from each list, and the three are chosen together, so multiply',
  },
]

/** q1: 3 starters × 4 mains × 2 desserts = 24. Three different counts from 2 to 8, never 1. */
function menuChoices(r: Rng, slot: Question): Draft {
  const menu = pick(r, MENUS)
  const [a, b, c] = draw(r, (r) => [int(r, 2, 8), int(r, 2, 8), int(r, 2, 8)], (xs) => new Set(xs).size === 3) as [number, number, number]
  const answer = a * b * c
  // Second route: every meal written out as one item from each list, then counted.
  const listed = new Set<string>()
  for (let i = 0; i < a; i++) for (let j = 0; j < b; j++) for (let k = 0; k < c; k++) listed.add(`${i}-${j}-${k}`)
  return {
    question: {
      type: 'numeric',
      prompt: menu.say(a, b, c),
      solution: `${menu.why}: $${a} \\times ${b} \\times ${c} = ${answer}$.`,
      markScheme: scheme(slot, [], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: listed.size === answer, detail: `${listed.size} meals listed` },
    values: { a, b, c },
  }
}

/* ---------------------------------------------------------------------------------------- */
/* q2, q10: codes with repeats                                                               */
/* ---------------------------------------------------------------------------------------- */

/** (digits, length) for q2: n^L within 1296, with n ≠ L and n^L ≠ L^n, so swapping them gives a different number. */
const CODE_SIZES: [number, number][] = [
  [5, 2], [6, 2], [7, 2], [8, 2], [9, 2],
  [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3],
  [3, 4], [5, 4], [6, 4],
]

const CODES_WITH_REPEATS: ((L: string, ds: number[]) => string)[] = [
  (L, ds) => `How many ${L}-digit codes can be made from the digits ${listText(ds)} if a digit may be repeated?`,
  (L, ds) => `A padlock code is ${L} digits long. Each digit is one of ${listText(ds, 'or')}, and a digit may be repeated. How many different codes are possible?`,
  (L, ds) => `A locker code has ${L} digits, each chosen from ${listText(ds)}. Digits may be repeated. How many different locker codes are there?`,
]

/** q2: three-digit codes from 1–5 with repeats, 5³ = 125. */
function codesWithRepeats(r: Rng, slot: Question): Draft {
  const [n, L] = pick(r, CODE_SIZES)
  const digits = r() < 0.4 ? Array.from({ length: n }, (_, i) => i + 1) : digitSet(r, n, 0, () => true)
  const say = pick(r, CODES_WITH_REPEATS)
  const answer = n ** L
  const listed = listSequences(digits, L).map((d) => d.join(''))
  return {
    question: {
      type: 'numeric',
      prompt: say(WORDS[L]!, digits),
      solution: `With repeats every position has all ${n} choices: $${times(Array(L).fill(n))} = ${answer}$.`,
      markScheme: scheme(slot, [], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: new Set(listed).size === answer, detail: `${new Set(listed).size} codes listed` },
    values: { n, L, digits: digits.join('') },
  }
}

/** q10: three-digit codes from 1 to 6 with no 6, 5³ = 125; sometimes two digits left out. */
function codesWithout(r: Rng, slot: Question): Draft {
  const dice = r() < 0.25
  const { n, L, gone } = draw(
    r,
    (r) => {
      const n = dice ? 6 : int(r, 4, 9)
      const L = dice ? pick(r, [2, 3]) : pick(r, [2, 3, 3, 4])
      const e = r() < 0.7 ? 1 : 2
      const gone = shuffle(r, Array.from({ length: n }, (_, i) => i + 1)).slice(0, e).sort((a, b) => a - b)
      return { n, L, gone }
    },
    ({ n, L, gone }) => {
      const left = n - gone.length
      const answer = left ** L
      return left >= 3 && answer <= 729 && answer >= 16 && (L < 4 || left <= 5)
    },
  )
  const left = n - gone.length
  const answer = left ** L
  const total = n ** L
  const not = gone.length === 1 ? `no ${gone[0]}` : `no ${gone[0]} and no ${gone[1]}`
  const atLeast = gone.length === 1 ? `at least one ${gone[0]}` : `at least one ${gone[0]} or ${gone[1]}`
  const prompt = dice
    ? `An ordinary dice is rolled ${L === 2 ? 'twice' : `${WORDS[L]} times`} and the scores are written down in order as a code, such as ${Array.from({ length: L }, (_, i) => [3, 1, 4, 2][i]).join('')}. How many of the possible codes contain ${not}?`
    : pick(r, [
        `A code has ${WORDS[L]} digits, each from 1 to ${n}, and repeats are allowed. How many codes contain ${not}?`,
        `A security code is ${WORDS[L]} digits long. Each digit is from 1 to ${n} and digits may be repeated. How many of these codes contain ${not}?`,
      ])
  const excluded = gone.length === 1 ? `With ${gone[0]} excluded` : `With ${gone[0]} and ${gone[1]} excluded`
  const digits = Array.from({ length: n }, (_, i) => i + 1)
  const listed = listSequences(digits, L).filter((code) => code.every((d) => !gone.includes(d))).length
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `${excluded}, ${left} digits are available at each position: $${times(Array(L).fill(left))} = ${answer}$. This is the count that *${atLeast}* is subtracted from: $${total} - ${answer} = ${total - answer}$.`,
      markScheme: scheme(slot, [], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: listed === answer, detail: `${listed} codes listed without ${gone}` },
    values: { n, L, gone: gone.join(''), dice: String(dice) },
  }
}

/* ---------------------------------------------------------------------------------------- */
/* q3, q7, q15: arranging the letters of a word                                              */
/* ---------------------------------------------------------------------------------------- */

/** Words with every letter different, by length. */
export const DISTINCT_WORDS: Record<number, string[]> = {
  4: ['BIRD', 'BLUE', 'CAMP', 'COLD', 'DARK', 'DUST', 'FARM', 'FISH', 'FORM', 'GOLD', 'HAND', 'JUMP', 'KING', 'LAMP', 'MILK', 'NEST', 'PARK', 'ROAD', 'SHIP', 'SNOW', 'WIND', 'YARD', 'BOAT', 'CORN', 'DESK', 'FROG', 'GIFT', 'HELP', 'LION', 'NOTE', 'PLAY', 'RAIN', 'SALT', 'TIME', 'WOLF', 'DUCK', 'CAKE', 'BEAR', 'SOUP', 'MIST'],
  5: ['MATHS', 'BREAD', 'CHAIR', 'CLOUD', 'DANCE', 'EARTH', 'FIELD', 'GHOST', 'HOUSE', 'LIGHT', 'MONEY', 'NIGHT', 'OCEAN', 'PLANE', 'QUIET', 'SPORT', 'TABLE', 'WATER', 'WORLD', 'YOUTH', 'BRAIN', 'CRISP', 'FRUIT', 'GRAPE', 'HORSE', 'JUICE', 'LEMON', 'MOUSE', 'PIANO', 'SMILE', 'STORM', 'TRAIN', 'UNCLE', 'VOICE', 'BEACH', 'CANDY', 'DRINK', 'GLOBE', 'PRINT', 'FLAME'],
  6: ['GARDEN', 'PLANET', 'CASTLE', 'FRIEND', 'ISLAND', 'MARKET', 'ORANGE', 'PENCIL', 'SILVER', 'WINTER', 'BRIDGE', 'FOREST', 'GUITAR', 'JACKET', 'MOTHER', 'NUMBER', 'ROCKET', 'SPRING', 'STREAM', 'WALNUT', 'BASKET', 'FLIGHT', 'POCKET', 'FATHER', 'MONKEY', 'DRAGON', 'TURNIP', 'BRANCH', 'KNIGHT', 'PIRATE', 'CLOVER', 'CHARGE'],
  7: ['BLANKET', 'DOLPHIN', 'KINGDOM', 'JOURNEY', 'PICTURE', 'PROBLEM', 'HISTORY', 'COUNTRY', 'KITCHEN', 'MACHINE', 'CUSTARD', 'DRAWING', 'MONSTER', 'CHAPTER', 'FACTORY', 'PLASTIC', 'TEACUPS', 'GRAVITY', 'LOBSTER', 'VAMPIRE'],
}

/** Words with one letter twice (or three times) and the rest different. */
export const ONE_REPEAT_WORDS: Record<string, string[]> = {
  '4:2': ['BOOK', 'MOON', 'TREE', 'FEED', 'DOOR', 'POOL', 'COOL', 'FOOD', 'HILL', 'BELL', 'WALL', 'BALL', 'KISS', 'BOSS', 'SEEN', 'KEEP', 'SEED', 'LOOK', 'ROOF', 'WOOD', 'GOOD', 'TOOL', 'FOOT'],
  '5:2': ['APPLE', 'HAPPY', 'SHEEP', 'GREEN', 'SLEEP', 'SPOON', 'FLOOR', 'BLOOD', 'SWEET', 'GOOSE', 'HELLO', 'SMALL', 'SKILL', 'SPELL', 'GRASS', 'CLASS', 'DRESS', 'PAPER', 'ARROW', 'BERRY', 'FERRY', 'PUPIL', 'FUNNY', 'SUNNY', 'PENNY'],
  '6:2': ['SCHOOL', 'BUTTER', 'BOTTLE', 'RABBIT', 'CARROT', 'SUMMER', 'WINNER', 'DINNER', 'PUZZLE', 'KITTEN', 'MUFFIN', 'BALLET', 'CIRCLE', 'PARROT'],
  '7:2': ['CHICKEN', 'FREEDOM', 'PERFECT', 'EXAMPLE', 'MORNING', 'TEACHER', 'WEATHER', 'LIBRARY'],
  '5:3': ['PUPPY', 'DADDY', 'NANNY', 'GEESE'],
  '6:3': ['CHEESE', 'STRESS', 'BUBBLE', 'ELEVEN', 'MIRROR'],
}

/** Words with two letters repeated: two pairs, or a letter three times and a pair. */
export const TWO_REPEAT_WORDS: Record<string, string[]> = {
  '5:2,2': ['LEVEL', 'RADAR', 'TEETH', 'KAYAK', 'CIVIC', 'REFER', 'TOOTH', 'ROTOR', 'SALSA', 'DEEDS', 'MOTTO', 'ONION', 'ARRAY'],
  '6:2,2': ['LETTER', 'BETTER', 'LITTLE', 'PEOPLE', 'COFFEE', 'FOLLOW', 'COTTON', 'SETTLE', 'KETTLE', 'BOTTOM', 'ACCESS', 'DIVIDE', 'TOFFEE', 'ATTACK', 'EFFECT', 'SEESAW', 'TOMATO', 'POTATO'],
  '6:3,2': ['PEPPER', 'BANANA', 'TATTOO', 'MAMMAL', 'COCOON', 'SETTEE', 'BAOBAB', 'PAPAYA', 'NEEDED', 'HUBBUB', 'DEEMED'],
  '7:2,2': ['BALLOON', 'ADDRESS', 'CABBAGE', 'SCIENCE', 'MESSAGE', 'LETTERS', 'LETTUCE', 'COLLEGE', 'SUCCEED', 'CHEETAH', 'SEASIDE'],
  '7:3,2': ['SUCCESS', 'BAGGAGE', 'PEPPERS', 'ADDENDA', 'PAPAYAS', 'PEPPERY', 'BANANAS', 'SEESAWS'],
}

/** How often each repeated letter appears, most first: SCHOOL is [2], LEVEL [2, 2], PEPPER [3, 2]. */
export function repeats(word: string): { letter: string; times: number }[] {
  const counts = new Map<string, number>()
  for (const ch of word) counts.set(ch, (counts.get(ch) ?? 0) + 1)
  return [...counts].filter(([, n]) => n > 1).map(([letter, times]) => ({ letter, times })).sort((a, b) => b.times - a.times || word.indexOf(a.letter) - word.indexOf(b.letter))
}

/** A weighted pick: [[weight, value], …]. */
function weighted<T>(r: Rng, options: [number, T][]): T {
  const total = options.reduce((s, [w]) => s + w, 0)
  let x = r() * total
  for (const [w, v] of options) if ((x -= w) < 0) return v
  return options[options.length - 1]![1]
}

const ARRANGE_WORDINGS: ((w: string, n: number) => string)[] = [
  (w) => `In how many ways can the letters of the word ${w} be arranged?`,
  (w) => `How many different arrangements are there of the letters of the word ${w}?`,
  (w) => `How many distinct arrangements are there of the letters of the word ${w}?`,
  (w, n) => `The letters of the word ${w} are written on ${n} cards, one letter on each card. In how many different orders can the ${n} cards be laid out in a row?`,
]

/** q3: MATHS, five different letters, 5! = 120. Only 4!, 5!, 6! and 7! are possible answers, each about a quarter. */
function distinctArrangements(r: Rng, slot: Question): Draft {
  const n = pick(r, [4, 5, 6, 7])
  const word = pick(r, DISTINCT_WORDS[n]!)
  const answer = fact(n)
  return {
    question: {
      type: 'numeric',
      prompt: pick(r, ARRANGE_WORDINGS)(word, n),
      solution: `${WORDS[n]![0]!.toUpperCase()}${WORDS[n]!.slice(1)} different letters: $${times(falling(n, n))} = ${n}! = ${answer}$.`,
      markScheme: scheme(slot, [], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: listSpellings(word) === answer && repeats(word).length === 0, detail: `${listSpellings(word)} spellings of ${word} listed` },
    values: { word },
  }
}

const apostrophe = (letter: string) => `${letter}'s`

/** q7: SCHOOL, 6!/2 = 360. A letter three times in about a third, so dividing by 3 rather than 3! shows. */
function oneRepeatArrangements(r: Rng, slot: Question): Draft {
  const key = weighted(r, [[18, '4:2'], [22, '5:2'], [22, '6:2'], [8, '7:2'], [15, '5:3'], [15, '6:3']] as [number, string][])
  const word = pick(r, ONE_REPEAT_WORDS[key]!)
  const n = word.length
  const [{ letter, times: k }] = repeats(word) as [{ letter: string; times: number }]
  const all = fact(n)
  const answer = all / fact(k)
  const say = pick(r, ARRANGE_WORDINGS)
  const why =
    k === 2
      ? `The two ${apostrophe(letter)} are identical, so each arrangement has been counted twice: $${all} \\div 2 = ${answer}$.`
      : `The three ${apostrophe(letter)} are identical, and they can be swapped among themselves in $3! = 6$ ways, so each arrangement has been counted 6 times: $${all} \\div 6 = ${answer}$.`
  return {
    question: {
      type: 'numeric',
      prompt: say(word, n),
      solution: `$${n}! = ${all}$ arrangements if the letters were all different. ${why}`,
      markScheme: scheme(slot, [k === 2 ? `${n}! = ${all}` : `${n}! ÷ 3!`], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: listSpellings(word) === answer && repeats(word).length === 1, detail: `${listSpellings(word)} spellings of ${word} listed` },
    values: { word },
  }
}

/** q15: LEVEL, 5!/(2! × 2!) = 30; sometimes a letter three times and one twice, 6!/(3! × 2!). */
function twoRepeatArrangements(r: Rng, slot: Question): Draft {
  // A letter three times and one twice in about 43%: for two pairs, 2! × 2! = 2! + 2!, so
  // only these words show the slip of adding the factorials.
  const key = weighted(r, [[22, '5:2,2'], [22, '6:2,2'], [25, '6:3,2'], [13, '7:2,2'], [18, '7:3,2']] as [number, string][])
  const word = pick(r, TWO_REPEAT_WORDS[key]!)
  const n = word.length
  const [first, second] = repeats(word) as [{ letter: string; times: number }, { letter: string; times: number }]
  const all = fact(n)
  const divisor = fact(first.times) * fact(second.times)
  const answer = all / divisor
  const say = pick(r, ARRANGE_WORDINGS)
  const often = (t: number) => (t === 2 ? 'twice' : 'three times')
  return {
    question: {
      type: 'numeric',
      prompt: say(word, n),
      solution: `${WORDS[n]![0]!.toUpperCase()}${WORDS[n]!.slice(1)} letters give $${n}! = ${all}$ if all were different. ${first.letter} appears ${often(first.times)} and ${second.letter} appears ${often(second.times)}, so divide by $${first.times}! \\times ${second.times}! = ${divisor}$: $${all} \\div ${divisor} = ${answer}$.`,
      markScheme: scheme(slot, [`${n}! divided by ${first.times}! × ${second.times}!`], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: listSpellings(word) === answer && repeats(word).length === 2, detail: `${listSpellings(word)} spellings of ${word} listed` },
    values: { word },
  }
}

/* ---------------------------------------------------------------------------------------- */
/* q5, q6, q11, q12: numbers from digits used at most once                                   */
/* ---------------------------------------------------------------------------------------- */

const NUMBER_WORDS = (k: number) => `${WORDS[k]}-digit`

/** All the k-digit numbers from the digits, each used at most once, listed: none may start with 0. */
const listNumbers = (digits: number[], k: number) => listArrangements(digits, k).filter((d) => d[0] !== 0)

/** "The other three positions take three of the remaining four digits: 4 × 3 × 2 = 24", or all of them. */
function fillTheRest(left: number, places: number): string {
  const xs = falling(left, places)
  const p = product(xs)
  return places === left
    ? `The other ${WORDS[places]} digits fill the other ${WORDS[places]} positions in $${places}! = ${p}$ ways`
    : `The other ${WORDS[places]} positions take ${WORDS[places]} of the remaining ${WORDS[left]} digits: $${times(xs)} = ${p}$`
}

/** q5: five-digit odd numbers from 1, 3, 4, 6, 8, no repeats: 2 × 4! = 48. Sometimes even, sometimes fewer digits than given. */
function lastDigit(r: Rng, slot: Question): Draft {
  const odd = r() < 0.6
  // n, k and the number of digits that can end are drawn first, outside the draw, so a
  // rerolled draw does not tilt them. k = n − 1 is left out: it fills the same (n − 1)! as
  // k = n, so it only repeated those answers; k = n − 2 gives new ones.
  const n = pick(r, [4, 5, 5, 6, 6])
  const k = n === 4 || r() < 0.5 ? n : n - 2
  // From 1 to 9 there are 5 odd digits and 4 even ones; half the digits fitting would make
  // "half of all the numbers" right by accident.
  const [fit, rest0] = odd ? [5, 4] : [4, 5]
  // At least two digits can end: with one, the restriction is a single choice and the question is 4 × 3.
  const os = Array.from({ length: n - 1 }, (_, i) => i + 1).filter((o) => o >= 2 && o <= fit && n - o <= rest0 && 2 * o !== n && o * product(falling(n - 1, k - 1)) <= 600)
  const o = pick(r, os)
  const digits = digitSet(r, n, 1, (ds) => ds.filter((d) => d % 2 === (odd ? 1 : 0)).length === o && !ds.includes(o * product(falling(n - 1, k - 1))))
  const ends = digits.filter((d) => d % 2 === (odd ? 1 : 0))
  const rest = product(falling(n - 1, k - 1))
  const answer = o * rest
  const kind = odd ? 'odd' : 'even'
  const prompt = `How many ${NUMBER_WORDS(k)} ${kind} numbers can be formed from the digits ${listText(digits)} if no digit is repeated?`
  const fix = o === 1 ? `${kind[0]!.toUpperCase()}${kind.slice(1)} means the last digit is ${ends[0]}: fix it first, 1 choice.` : `${kind[0]!.toUpperCase()}${kind.slice(1)} means the last digit is ${listText(ends, 'or')}: fix it first, ${o} choices.`
  const listed = listNumbers(digits, k).filter((d) => d[k - 1]! % 2 === (odd ? 1 : 0)).length
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `${fix} ${fillTheRest(n - 1, k - 1)}. $${o} \\times ${rest} = ${answer}$.`,
      markScheme: scheme(slot, [`last digit first: ${o} choice${o === 1 ? '' : 's'}`], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: listed === answer, detail: `${listed} ${kind} numbers listed` },
    values: { digits: digits.join(''), k, kind },
  }
}

/** q6: four-digit numbers from 1, 3, 5, 7, 9 starting with 9: 4 × 3 × 2 = 24; sometimes "with 7 or 9". */
function firstDigit(r: Rng, slot: Question): Draft {
  const SIZES: [number, number][] = [[4, 3], [4, 4], [5, 3], [5, 4], [5, 5], [6, 3], [6, 4], [6, 5], [7, 3], [7, 4], [7, 5]]
  const { digits, k, starts } = draw(
    r,
    (r) => {
      const [n, k] = pick(r, SIZES)
      const digits = digitSet(r, n, 1, () => true)
      const f = r() < 0.7 ? 1 : 2
      const starts = shuffle(r, digits).slice(0, f).sort((a, b) => a - b)
      return { digits, k, starts }
    },
    ({ digits, k, starts }) => {
      const answer = starts.length * product(falling(digits.length - 1, k - 1))
      return answer <= 720 && !digits.includes(answer)
    },
  )
  const n = digits.length
  const f = starts.length
  const rest = product(falling(n - 1, k - 1))
  const answer = f * rest
  const startText = listText(starts, 'or')
  const prompt = `How many ${NUMBER_WORDS(k)} numbers, using each of the digits ${listText(digits)} at most once, start with ${startText}?`
  const fix = f === 1 ? `The first digit is fixed as ${starts[0]}: 1 choice.` : `The first digit is ${startText}: 2 choices.`
  const listed = listNumbers(digits, k).filter((d) => starts.includes(d[0]!)).length
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `${fix} ${fillTheRest(n - 1, k - 1)}. So $${f} \\times ${rest} = ${answer}$.`,
      markScheme: scheme(slot, [], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: listed === answer, detail: `${listed} numbers listed starting ${starts}` },
    values: { digits: digits.join(''), k, starts: starts.join('') },
  }
}

/**
 * q11: three-digit even numbers from 0–9, no repeats, not starting with 0: 72 + 256 = 328.
 * The last digit's restriction and the first digit's interact through 0, so the count splits
 * on whether the last digit is 0. Sometimes a multiple of 5 (last digit 0 or 5), sometimes
 * four digits from a smaller set.
 */
function bothEnds(r: Rng, slot: Question): Draft {
  if (slot.marks !== 3) throw new Error(`${slot.id} is worth ${slot.marks} marks; this scheme is written for 3`)
  const five = r() < 0.35
  // n and k outside the draw. All ten digits make only four prompts (even or multiple of 5,
  // three or four digits), the written one among them, so n = 10 is drawn about 1 time in 11
  // and keeps each of those prompts near 3%; a subset of the digits makes many prompts.
  const n = weighted(r, [[22, 6], [22, 7], [22, 8], [22, 9], [8, 10]] as [number, number][])
  const k = r() < 0.45 ? 4 : 3
  const digits = [0, ...digitSet(r, n - 1, 1, (ds) => ds.some((d) => (five ? d === 5 : d % 2 === 0)) && ds.some((d) => d % 2 === 1 && d !== 5))]
  const others = digits.filter((d) => d !== 0 && (five ? d === 5 : d % 2 === 0))
  const e = others.length
  const zeroCase = falling(n - 1, k - 1)
  const A = product(zeroCase)
  const otherCase = [n - 2, ...falling(n - 2, k - 2)]
  const B = e * product(otherCase)
  const answer = A + B
  const from = n === 10 ? 'the digits 0 to 9' : `the digits ${listText(digits)}`
  const kind = five ? 'numbers that are multiples of 5' : 'even numbers'
  const prompt = `How many ${NUMBER_WORDS(k)} ${kind} can be made from ${from} if no digit is repeated? Remember that a number cannot start with 0.`
  const why = five ? '$0$ can end a multiple of 5 but cannot lead' : '$0$ is even but cannot lead'
  const middle = k === 3 ? `middle any of ${n - 2}` : `second any of ${n - 2}, third any of ${n - 3}`
  const middleOther = k === 3 ? `middle ${n - 2}` : `second ${n - 2}, third ${n - 3}`
  const otherProduct = e === 1 ? times(otherCase) : times([e, ...otherCase])
  const solution =
    `The two restrictions interact, because ${why}. Split on the last digit. ` +
    `Last digit $0$: first digit any of ${n - 1}, ${middle}, giving $${times(zeroCase)} = ${A}$. ` +
    `Last digit ${listText(others, 'or')}: first digit ${n - 2} choices (not 0, not the last digit), ${middleOther}, giving $${otherProduct} = ${B}$. ` +
    `Total $${A} + ${B} = ${answer}$.`
  const fits = (d: number) => (five ? d % 5 === 0 : d % 2 === 0)
  const listed = listNumbers(digits, k).filter((d) => fits(d[k - 1]!)).length
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      // As the written scheme: the split earns the method mark, the two cases an accuracy mark.
      markScheme: [
        { code: 'M1', marks: 1, description: 'splits on whether the last digit is 0' },
        { code: 'A1', marks: 1, description: `${A} and ${B}` },
        { code: 'A1', marks: 1, description: String(answer) },
      ],
      answer,
      tolerance: 0,
    },
    check: { agrees: listed === answer, detail: `${listed} numbers listed` },
    values: { digits: digits.join(''), k, five: String(five) },
  }
}

/** q12: three-digit numbers from 1, 2, 3, 4 at most once, not starting with 4: 3 × 3 × 2 = 18, or 24 − 6. */
function notStarting(r: Rng, slot: Question): Draft {
  const end = r() < 0.3
  const SIZES: [number, number][] = [[4, 3], [5, 3], [5, 4], [6, 3], [6, 4]]
  const { digits, k, banned } = draw(
    r,
    (r) => {
      const [n, k] = pick(r, SIZES)
      const digits = digitSet(r, n, 1, () => true)
      const banned = shuffle(r, digits).slice(0, r() < 0.75 ? 1 : 2).sort((a, b) => a - b)
      return { digits, k, banned }
    },
    ({ digits, k, banned }) => (digits.length - banned.length) * product(falling(digits.length - 1, k - 1)) <= 600,
  )
  const n = digits.length
  const f = banned.length
  const allowed = digits.filter((d) => !banned.includes(d))
  const rest = falling(n - 1, k - 1)
  const answer = (n - f) * product(rest)
  const all = product(falling(n, k))
  const out = f * product(rest)
  const place = end ? 'end' : 'start'
  const Place = end ? 'Last' : 'First'
  const bannedText = f === 1 ? String(banned[0]) : `${banned[0]} or ${banned[1]}`
  const question = f === 1 ? `do not ${place} with ${banned[0]}` : `${place} with neither ${banned[0]} nor ${banned[1]}`
  const prompt = `${WORDS[k]![0]!.toUpperCase()}${WORDS[k]!.slice(1)}-digit numbers are made using each of the digits ${listText(digits)} at most once. How many of them ${question}?`
  const others = end ? ['first', 'second', 'third'].slice(0, k - 1) : ['second', 'third', 'fourth'].slice(0, k - 1)
  const then = rest.map((x, i) => `${x}${i === 0 ? ' choices' : ''} for the ${others[i]}`)
  const solution =
    `${Place} digit: ${n - f} choices (${listText(allowed, 'or')}). Then ${listText(then)}: $${times([n - f, ...rest])} = ${answer}$. ` +
    `Alternatively, all $${all}$ minus the $${out}$ that ${place} with ${bannedText}.`
  const listed = listNumbers(digits, k).filter((d) => !banned.includes(d[end ? k - 1 : 0]!)).length
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [`${Place.toLowerCase()} digit ${n - f} choices, or ${all} minus those ${end ? 'ending' : 'starting'} with ${bannedText}`], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: listed === answer && all - out === answer, detail: `${listed} numbers listed` },
    values: { digits: digits.join(''), k, banned: banned.join(''), place },
  }
}

/* ---------------------------------------------------------------------------------------- */
/* q8: groups where order does not count                                                     */
/* ---------------------------------------------------------------------------------------- */

const CLUBS = ['chess club', 'drama club', 'school choir', 'science club', 'football club', 'book club']

const GROUPS: { say: (r: Rng, n: number, k: number) => string; who: string; group: string }[] = [
  { say: (r, n, k) => `A committee of ${k} is chosen from the ${n} members of a ${pick(r, CLUBS)}. How many different committees are possible?`, who: 'people', group: 'A committee' },
  { say: (_, n, k) => `A committee of ${k} is chosen from ${n} people. How many different committees are possible?`, who: 'people', group: 'A committee' },
  { say: (r, n, k) => `A teacher picks ${k} students from a group of ${n} to represent the school at ${pick(r, ['a quiz', 'a debate', 'a maths challenge', 'a chess tournament'])}. How many different teams of ${k} could be picked?`, who: 'students', group: 'A team' },
  { say: (_, n, k) => `A shop manager chooses ${k} of the ${n} staff to work on a bank holiday. How many different groups of ${k} could be chosen?`, who: 'people', group: 'A group' },
  { say: (_, n, k) => `A student chooses ${k} books to take on holiday from a shelf of ${n} different books. How many different selections of ${k} books are possible?`, who: 'books', group: 'A selection' },
  { say: (_, n, k) => `A pizza comes with ${k} different toppings chosen from the ${n} on the menu. How many different choices of ${k} toppings are there?`, who: 'toppings', group: 'A choice of toppings' },
]

/** (n, k) for q8: 3 or 4 chosen, never 2, where dividing by 2 and by 2! are the same slip. */
const GROUP_SIZES: [number, number][] = [
  [5, 3], [6, 3], [6, 4], [7, 3], [7, 4], [8, 3], [8, 4], [9, 3], [9, 4], [10, 3], [10, 4], [11, 3], [12, 3],
]

/** q8: a committee of 3 from 6, 6 × 5 × 4 ÷ 3! = 20. */
function committees(r: Rng, slot: Question): Draft {
  const [n, k] = pick(r, GROUP_SIZES)
  const g = pick(r, GROUPS)
  const ordered = falling(n, k)
  const O = product(ordered)
  const answer = O / fact(k)
  const listed = listGroups(n, k).length
  return {
    question: {
      type: 'numeric',
      prompt: g.say(r, n, k),
      solution: `Ordered, $${times(ordered)} = ${O}$. ${g.group} has no order, and ${k} ${g.who} can be ordered in $${k}! = ${fact(k)}$ ways, so $${O} \\div ${fact(k)} = ${answer}$.`,
      markScheme: scheme(slot, [`${ordered.join(' × ')} divided by ${k}!`], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: listed === answer, detail: `${listed} groups listed` },
    values: { n, k },
  }
}

export const countingGenerators: Generator[] = [
  fmBySlot('fm-counting-menu', TOPIC, { q1: menuChoices }),
  fmBySlot('fm-counting-codes', TOPIC, { q2: codesWithRepeats, q10: codesWithout }),
  fmBySlot('fm-counting-arrangements', TOPIC, { q3: distinctArrangements, q7: oneRepeatArrangements, q15: twoRepeatArrangements }),
  fmBySlot('fm-counting-digits', TOPIC, { q5: lastDigit, q6: firstDigit, q11: bothEnds, q12: notStarting }),
  fmBySlot('fm-counting-committees', TOPIC, { q8: committees }),
]
