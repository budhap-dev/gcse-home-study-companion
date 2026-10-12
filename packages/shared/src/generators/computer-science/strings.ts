import type { Question } from '../../content/questions.ts'
import { draw, int, pick, shuffle, weighted, type Rng } from '../random.ts'
import type { Draft, Generator } from '../types.ts'
import { csBySlot, fence, lastOutput, numericDraft } from './build.ts'
import { run } from './pseudo.ts'

/**
 * Computer Science (AQA 8525) generators for 3.2.8, string handling operations ("understand and
 * be able to use: length, position, substring, concatenation … string conversion operations",
 * string to integer among them), with 3.2.2's definite iteration for the traversal. The topic
 * also teaches file handling as project practice; that is not in the 8525 specification, and no
 * slot here touches it.
 *
 * The conventions are the lesson's: characters indexed from 0, LEN counts every character (a
 * space too), SUBSTRING(start, end, s) includes both ends, POSITION(s, c) is the index of the
 * first c (never asked for a character that is absent, which AQA leaves undefined), + joins
 * strings without a space, and a character is SUBSTRING(i, i, s), never s[i]. Every printed
 * program is run through the interpreter (pseudo.ts), and its last output is the answer.
 *
 * - q1 (core): LEN of an everyday word, or of a two-word phrase whose space counts. LEN − 1 (the
 *   last index) never pays, nor, for a phrase, the letters without the space.
 * - q17 (core): POSITION of a letter in a word, the answer drawn first from 1 to 10. Counting from
 *   1 never pays; in about two builds in five the letter comes again later, where the last match
 *   does not pay. q1 and q17 share the core sheet and draw from separate word lists.
 * - q6 (higher): the written join-and-measure program: first + ' ' + last, the surname first with
 *   ', ' (two characters), or three names with two spaces. The length without the joiners, or
 *   with one character for ', ', never pays.
 * - q9 (advanced): counting a letter with FOR i ← 0 TO LEN(text) - 1 and SUBSTRING(i, i, text), as
 *   written; counting either of two letters; or a loop that starts at 1 and so never checks the
 *   letter at index 0. The count (2 to 5) is drawn first; the trace prints a row per character.
 *   In about three builds in four the last character is a match, so stopping one early (an
 *   end-exclusive loop) pays in under three in ten.
 * - q19 (advanced): the lesson's read, find, cut, convert, use: a line 'Name,score' (or
 *   'score,Name'), POSITION of the comma, SUBSTRING to the end (or from the start), STRING_TO_INT,
 *   then × k (products within 200), + k or − k; the answer is never the score, k or a single
 *   digit. SUBSTRING with an exclusive end, or POSITION from 1, never pays.
 */

const TOPIC = 'strings-and-file-handling'

/** "k-e-y-b-o-a-r-d", a word spelt out as the written solutions do. */
const spell = (w: string) => [...w].join('-')

// ---------------------------------------------------------------------------------------------
// q1: LEN
// ---------------------------------------------------------------------------------------------

/**
 * Words for q1, from 4 to 12 letters, and two-word phrases for the space. None is on the core
 * sheet already ('sun', 'set' and 'sunset' are q2's), and none is in q17's list.
 */
export const LEN_WORDS = [
  'lamp', 'door', 'fish', 'milk', 'road', 'tree', 'rain', 'book', 'cake', 'frog', 'moon', 'sock', 'bell', 'kite',
  'apple', 'chair', 'table', 'bread', 'cloud', 'plant', 'river', 'house', 'lemon', 'tiger', 'pizza', 'train', 'mouse', 'bench',
  'garden', 'pencil', 'rocket', 'window', 'basket', 'carrot', 'dragon', 'jacket', 'orange', 'planet', 'silver', 'candle', 'turtle', 'button',
  'blanket', 'chicken', 'dolphin', 'printer', 'rainbow', 'monitor', 'teacher', 'kitchen', 'pumpkin', 'giraffe', 'lantern', 'balloon', 'cabbage', 'library',
  'keyboard', 'elephant', 'sandwich', 'notebook', 'umbrella', 'mushroom', 'calendar', 'dinosaur', 'software', 'football', 'treasure', 'tortoise', 'hedgehog', 'scissors',
  'butterfly', 'chocolate', 'telephone', 'spaghetti', 'crocodile', 'adventure', 'scientist', 'raspberry', 'microwave', 'astronaut', 'lightning', 'saxophone',
  'basketball', 'strawberry', 'paintbrush', 'motorcycle', 'calculator', 'helicopter', 'watermelon', 'skateboard', 'toothbrush', 'television', 'binoculars', 'trampoline',
  'grasshopper', 'screwdriver', 'caterpillar', 'hummingbird', 'marshmallow', 'thunderstorm', 'photographer', 'refrigerator', 'construction', 'headquarters',
] as const

export const LEN_PHRASES = [
  'ice cream', 'bus stop', 'tea bag', 'hot dog', 'fire drill', 'game over', 'post box', 'car park', 'night sky', 'high score',
  'lunch box', 'test tube', 'apple pie', 'snow day', 'bike shed', 'red card', 'pen pal', 'top hat', 'sea shell', 'gold medal',
  'bird song', 'fruit bowl', 'paper plane', 'rock pool', 'face mask', 'sun hat', 'pet shop', 'oak tree', 'school trip', 'beach towel', 'garden path',
] as const

const LEN_PROMPTS = [
  (s: string) => `What does \`LEN('${s}')\` return?`,
  (s: string) => `What is the value of \`LEN('${s}')\`?`,
  (s: string) => `What is output by \`OUTPUT LEN('${s}')\`?`,
]

function length(r: Rng, slot: Question): Draft {
  const phrase = r() < 0.3
  // The answer's spread comes from the length, drawn first: 4 to 12 for a word, 6 to 11 for a phrase.
  const pool = phrase ? LEN_PHRASES : LEN_WORDS
  const lengths = [...new Set(pool.map((w) => w.length))]
  const n = pick(r, lengths)
  const s = pick(r, pool.filter((w) => w.length === n))
  const solution = phrase
    ? (() => {
        const [a, b] = s.split(' ') as [string, string]
        return `Count every character, the space too: ${spell(a)}, the space, then ${spell(b)}, so ${a.length} + 1 + ${b.length} = **${n}**. LEN counts characters, so it is one more than the last index, ${n - 1}.`
      })()
    : `Count the characters, ${spell(s)}: there are **${n}**. LEN counts characters, so it is one more than the last index, ${n - 1}.`
  const out = lastOutput(`OUTPUT LEN('${s}')`)
  return numericDraft(
    slot,
    { prompt: pick(r, LEN_PROMPTS)(s), solution, method: [], answer: n },
    { agrees: out === n && [...s].length === n, detail: `interpreter: LEN('${s}') is ${String(out)}` },
    { text: s, phrase: phrase ? 'yes' : 'no', length: n },
  )
}

// ---------------------------------------------------------------------------------------------
// q17: POSITION
// ---------------------------------------------------------------------------------------------

/** Words for q17, 5 to 12 letters, none in q1's list or on the core sheet. */
export const POSITION_WORDS = [
  'garage', 'pocket', 'bottle', 'muffin', 'parrot', 'castle', 'pirate', 'wizard', 'violin', 'magnet', 'tunnel', 'yogurt', 'banana', 'cheese', 'spider',
  'hamster', 'compass', 'trumpet', 'lettuce', 'popcorn', 'octopus', 'blossom', 'diamond', 'penguin', 'volcano', 'cupcake', 'feather', 'bicycle', 'gorilla', 'sausage',
  'squirrel', 'flamingo', 'pineapple', 'backpack', 'magazine', 'meatball', 'reindeer', 'snowball', 'triangle', 'ladybird', 'necklace', 'kangaroo', 'cardigan', 'doorbell',
  'blueberry', 'detective', 'pyjamas', 'porcupine', 'sunflower', 'goalkeeper', 'cheesecake', 'lighthouse', 'playground', 'wheelbarrow', 'xylophone',
  'thermometer', 'microphone', 'grandmother', 'rattlesnake', 'pomegranate', 'spreadsheet', 'snowboarder', 'kaleidoscope', 'gingerbread', 'peppermint',
] as const

export interface PositionPick {
  word: string
  letter: string
  /** The index of the first match. */
  at: number
  /** The index of the last match: equal to `at` when the letter is there once. */
  last: number
}

/** Every (word, letter) whose first match is at 1 to 10, by that index. */
const BY_INDEX = (() => {
  const m = new Map<number, PositionPick[]>()
  for (const word of POSITION_WORDS) {
    for (const letter of new Set(word)) {
      const at = word.indexOf(letter)
      if (at < 1 || at > 10) continue
      m.set(at, [...(m.get(at) ?? []), { word, letter, at, last: word.lastIndexOf(letter) }])
    }
  }
  return m
})()

const POSITION_PROMPTS = [
  (w: string, c: string) => `What does \`POSITION('${w}', '${c}')\` return? Indexes count from 0.`,
  (w: string, c: string) => `What is the value of \`POSITION('${w}', '${c}')\`? Indexes count from 0.`,
  (w: string, c: string) => `\`POSITION(s, c)\` gives the index of the first \`c\` in \`s\`, counting from 0. What does \`POSITION('${w}', '${c}')\` return?`,
]

function position(r: Rng, slot: Question): Draft {
  const at = weighted(r, [[1, 10], [2, 10], [3, 10], [4, 10], [5, 10], [6, 10], [7, 9], [8, 8], [9, 6], [10, 5]] as const)
  const all = BY_INDEX.get(at)!
  const repeated = all.filter((p) => p.last > p.at)
  const once = all.filter((p) => p.last === p.at)
  const p = pick(r, repeated.length && (r() < 0.4 || !once.length) ? repeated : once)
  const chars = [...p.word]
  const walk = chars.slice(0, at).map((c, i) => (i === 0 ? `'${c}' is at index 0` : `'${c}' at ${i}`))
  const listed = `${walk.join(', ')} and '${p.letter}' at **${at}**`
  const later = p.last > at ? ` The '${p.letter}' at index ${p.last} comes later and does not count: POSITION gives the index of the first match.` : ' POSITION gives the index of the first match.'
  const solution = `${listed}.${later}`
  const out = lastOutput(`OUTPUT POSITION('${p.word}', '${p.letter}')`)
  return numericDraft(
    slot,
    { prompt: pick(r, POSITION_PROMPTS)(p.word, p.letter), solution, method: [], answer: at },
    { agrees: out === at && chars.findIndex((c) => c === p.letter) === at, detail: `interpreter: POSITION('${p.word}', '${p.letter}') is ${String(out)}` },
    { word: p.word, letter: p.letter, at, last: p.last },
  )
}

// ---------------------------------------------------------------------------------------------
// q6: joining and measuring
// ---------------------------------------------------------------------------------------------

export const FIRST_NAMES = ['Ada', 'Alan', 'Grace', 'Tim', 'Mary', 'Omar', 'Kofi', 'Sofia', 'Liam', 'Mei', 'Raj', 'Zara', 'Leo', 'Nadia', 'Ivan', 'Hana', 'Ben', 'Chloe', 'Sam', 'Ellie', 'Yusuf', 'Ruby', 'Tom', 'Aisha', 'Jack', 'Freya'] as const
export const MIDDLE_NAMES = ['Rose', 'Jay', 'Anne', 'Lee', 'Marie', 'James', 'Kai', 'May'] as const
export const SURNAMES = ['Patel', 'Okafor', 'Khan', 'Garcia', 'Nowak', 'Smith', 'Jones', 'Hughes', 'Murphy', 'Silva', 'Chen', 'Ahmed', 'Brown', 'Taylor', 'Ferreira', 'Kowalski', 'Andersen', 'Walker', 'Morgan', 'Evans', 'Davies', 'Osei', 'Nguyen', 'Campbell'] as const

export type JoinShape = 'space' | 'comma' | 'middle'

function joinLength(r: Rng, slot: Question): Draft {
  const shape = weighted<JoinShape>(r, [['space', 55], ['comma', 25], ['middle', 20]])
  const [f, l, j] = pick(r, [['first', 'last', 'full'], ['forename', 'surname', 'name']] as const)
  const first = pick(r, FIRST_NAMES)
  const last = pick(r, SURNAMES)
  const middle = pick(r, MIDDLE_NAMES)
  let code: string
  let value: string
  let solution: string
  if (shape === 'space') {
    code = `${f} ← '${first}'\n${l} ← '${last}'\n${j} ← ${f} + ' ' + ${l}\nOUTPUT ${j}\nOUTPUT LEN(${j})`
    value = `${first} ${last}`
    solution = `\`${j}\` is \`${value}\`: ${first} plus a space plus ${last} is ${first.length} + 1 + ${last.length} = **${value.length}** characters. The space counts, because + adds only what it is given.`
  } else if (shape === 'comma') {
    code = `${f} ← '${first}'\n${l} ← '${last}'\n${j} ← ${l} + ', ' + ${f}\nOUTPUT ${j}\nOUTPUT LEN(${j})`
    value = `${last}, ${first}`
    solution = `\`${j}\` is \`${value}\`: ${last}, then a comma and a space (2 characters), then ${first}, so ${last.length} + 2 + ${first.length} = **${value.length}** characters.`
  } else {
    const m = 'middle'
    code = `${f} ← '${first}'\n${m} ← '${middle}'\n${l} ← '${last}'\n${j} ← ${f} + ' ' + ${m} + ' ' + ${l}\nOUTPUT ${j}\nOUTPUT LEN(${j})`
    value = `${first} ${middle} ${last}`
    solution = `\`${j}\` is \`${value}\`: three names and the two spaces between them, ${first.length} + 1 + ${middle.length} + 1 + ${last.length} = **${value.length}** characters. Each space counts.`
  }
  const ask = pick(r, ['What is output by the last line of this program?', 'What is the second value this program outputs?'])
  const out = run(code)
  const answer = value.length
  return numericDraft(
    slot,
    { prompt: `${ask}\n\n${fence(code)}`, solution, method: [], answer },
    { agrees: out.outputs[0] === value && out.outputs.at(-1) === answer, detail: `interpreter: ${out.outputs.map(String).join(' / ')}` },
    { shape, value, answer },
  )
}

// ---------------------------------------------------------------------------------------------
// q9: traversing a string
// ---------------------------------------------------------------------------------------------

/**
 * Words of 5 to 8 letters with a letter that comes two to four times. Not 'level' (q11 reverses
 * it on the advanced sheet), and no names, which q19 prints.
 */
export const COUNT_WORDS = [
  'banana', 'cassava', 'papaya', 'referee', 'teepee', 'assess', 'possess', 'needle', 'sleeve', 'settee', 'cheese', 'puppet', 'pepper',
  'bubble', 'giggle', 'tattoo', 'cocoon', 'coffee', 'success', 'eleven', 'freezer', 'kayak', 'llama', 'alpaca', 'bazaar', 'hubbub',
  'nineteen', 'toffee', 'excess', 'access', 'dessert', 'address', 'mammal', 'tomato', 'potato', 'mummy', 'daddy', 'puffin',
  'muffin', 'lollipop', 'cuckoo', 'igloo', 'bamboo', 'balloon', 'yellow', 'pillow', 'grammar', 'cinema', 'agenda', 'karate', 'sofa',
  'ladder', 'dinner', 'summer', 'zebra', 'cobweb', 'tennis', 'bobcat', 'kebab', 'gaggle', 'waffle', 'paddle', 'rabbit',
  'eyeteeth', 'senseless', 'tattooist',
] as const

export type CountShape = 'one' | 'either' | 'from-one'

export interface CountPick {
  text: string
  letters: string[]
  /** 0 for the written loop, 1 for the one that skips index 0. */
  from: number
}

/** The characters a loop from `from` to the end matches. */
export const matches = (p: CountPick) => [...p.text].map((c, i) => i >= p.from && p.letters.includes(c))

/** Every (word, letters, from) the loop can count, with what it counts and whether the last character matches. */
const COUNT_CANDIDATES = (() => {
  const out: { p: CountPick; shape: CountShape; count: number; lastMatches: boolean }[] = []
  for (const text of COUNT_WORDS) {
    if (text.length < 5 || text.length > 9) continue
    const chars = [...text]
    const letters = [...new Set(chars)]
    const times = (l: string, from = 0) => chars.slice(from).filter((c) => c === l).length
    // The loop from 1 never checks index 0, and the letter there comes one to three times more (9 letters: 8 passes).
    const later = times(chars[0]!, 1)
    if (later >= 1 && later <= 3) out.push({ p: { text, letters: [chars[0]!], from: 1 }, shape: 'from-one', count: later, lastMatches: chars.at(-1) === chars[0] })
    if (text.length > 8) continue
    for (const l of letters) out.push({ p: { text, letters: [l], from: 0 }, shape: 'one', count: times(l), lastMatches: chars.at(-1) === l })
    for (const [i, a] of letters.entries())
      for (const b of letters.slice(i + 1)) out.push({ p: { text, letters: [a, b], from: 0 }, shape: 'either', count: times(a) + times(b), lastMatches: [a, b].includes(chars.at(-1)!) })
  }
  return out
})()

/** The answer is drawn first, then (three builds in four) a case whose last character matches, so a loop stopped one early rarely pays. */
function countDraw(r: Rng, shape: CountShape): CountPick {
  const want = shape === 'one' ? weighted(r, [[2, 3], [3, 4], [4, 3]] as const) : shape === 'either' ? weighted(r, [[3, 3], [4, 4], [5, 3]] as const) : weighted(r, [[1, 3], [2, 4], [3, 3]] as const)
  const fits = COUNT_CANDIDATES.filter((c) => c.shape === shape && c.count === want)
  const last = fits.filter((c) => c.lastMatches)
  const notLast = fits.filter((c) => !c.lastMatches)
  const pool = last.length && (r() < 0.75 || !notLast.length) ? last : notLast
  const c = pick(r, pool)
  return { ...c.p, letters: shuffle(r, c.p.letters) }
}

/** The program as printed. */
export function countCode(p: CountPick, v: string): string {
  const head = `${v} ← '${p.text}'\ncount ← 0\nFOR i ← ${p.from} TO LEN(${v}) - 1`
  if (p.letters.length === 1) return `${head}\n   IF SUBSTRING(i, i, ${v}) = '${p.letters[0]}' THEN\n      count ← count + 1\n   ENDIF\nENDFOR\nOUTPUT count`
  return `${head}\n   c ← SUBSTRING(i, i, ${v})\n   IF c = '${p.letters[0]}' OR c = '${p.letters[1]}' THEN\n      count ← count + 1\n   ENDIF\nENDFOR\nOUTPUT count`
}

function traverse(r: Rng, slot: Question, turn: number): Draft {
  const shape = weighted<CountShape>(r, [['one', 60], ['either', 25], ['from-one', 15]])
  void turn
  const p = countDraw(r, shape)
  const v = pick(r, ['text', 'word'])
  const code = countCode(p, v)
  const chars = [...p.text]
  const hit = matches(p)
  let c = 0
  const rows = chars.slice(p.from).map((ch, k) => {
    const i = k + p.from
    if (hit[i]) c++
    return `| ${i} | ${ch} | ${hit[i] ? 'yes' : 'no'} | ${c} |`
  })
  const answer = c
  const want = p.letters.length === 1 ? `'${p.letters[0]}'` : `'${p.letters[0]}' or '${p.letters[1]}'`
  const table = `| i | character | matches ${want}? | count |\n|---|---|---|---|\n${rows.join('\n')}`
  const n = chars.length
  const intro =
    p.from === 0
      ? `\`${v}\` has ${n} characters, so i runs from 0 to ${n - 1} and every character is compared with ${want}.`
      : `\`${v}\` has ${n} characters and the loop starts at i = 1, so it runs from 1 to ${n - 1}: the '${chars[0]}' at index 0 is never checked.`
  const solution = `${intro}\n\n${table}\n\nThe output is **${answer}**.`
  const out = lastOutput(code)
  return numericDraft(
    slot,
    {
      prompt: `What is output by this program?\n\n${fence(code)}`,
      solution,
      method: [`Each character from index ${p.from} to ${n - 1} compared with ${want}`],
      answer,
    },
    { agrees: out === answer, detail: `interpreter output ${String(out)}` },
    { shape, text: p.text, letters: p.letters.join(''), answer },
  )
}

// ---------------------------------------------------------------------------------------------
// q19: read, find, cut, convert, use
// ---------------------------------------------------------------------------------------------

export const LINE_NAMES = ['Tom', 'Ana', 'Kai', 'Ella', 'Sam', 'Noah', 'Isla', 'Ravi', 'Lucy', 'Femi', 'Jade', 'Owen', 'Maya', 'Zain', 'Ruth', 'Theo', 'Nina', 'Ali', 'Beth', 'Dan', 'Erin', 'Hugo', 'Ivy', 'Josh', 'Lena', 'Max', 'Rosa', 'Seb', 'Tara', 'Will', 'Amira', 'Bruno', 'Clara', 'Diego', 'Elena', 'Harry', 'Imani', 'Jonah'] as const

export type Use = 'times' | 'plus' | 'minus'
export interface Line {
  name: string
  score: number
  /** True when the score comes first: '57,Tom'. */
  scoreFirst: boolean
  use: Use
  k: number
}

export const lineText = (l: Line) => (l.scoreFirst ? `${l.score},${l.name}` : `${l.name},${l.score}`)
export const useValue = (l: Line) => (l.use === 'times' ? l.score * l.k : l.use === 'plus' ? l.score + l.k : l.score - l.k)

export function lineCode(l: Line): string {
  const cut = l.scoreFirst ? 'SUBSTRING(0, p - 1, line)' : 'SUBSTRING(p + 1, LEN(line) - 1, line)'
  const op = l.use === 'times' ? `score * ${l.k}` : l.use === 'plus' ? `score + ${l.k}` : `score - ${l.k}`
  return `line ← '${lineText(l)}'\np ← POSITION(line, ',')\nscore ← STRING_TO_INT(${cut})\nOUTPUT ${op}`
}

function lineDraw(r: Rng): Line {
  const use = weighted<Use>(r, [['times', 55], ['plus', 25], ['minus', 20]])
  const name = pick(r, LINE_NAMES)
  const scoreFirst = r() < 0.35
  const three = use !== 'times' && r() < 0.3
  const score = three ? int(r, 100, 180) : int(r, 12, 98)
  // Products stay within 200, about the written 57 × 2 = 114.
  const k = use === 'times' ? pick(r, [2, 3, 4].filter((k) => score * k <= 200)) : int(r, 3, 25)
  return { name, score, scoreFirst, use, k }
}

function convert(r: Rng, slot: Question): Draft {
  // The answer is never a printed figure (the score or k) and never a single digit.
  const l = draw(r, lineDraw, (l) => useValue(l) >= 10 && ![l.k, l.score].includes(useValue(l)))
  const text = lineText(l)
  const code = lineCode(l)
  const p = text.indexOf(',')
  const len = text.length
  const [a, b] = l.scoreFirst ? [0, p - 1] : [p + 1, len - 1]
  const piece = text.slice(a, b + 1)
  const before = [...text.slice(0, p)].map((c, i) => `'${c}' is ${i}`)
  const where = `\`POSITION(line, ',')\` is ${p}: ${before.slice(0, -1).join(', ')}${before.length > 1 ? ' and ' : ''}${before.at(-1)}, and the comma is ${p}.`
  const cutLine = l.scoreFirst
    ? `The score is in front of the comma, so the cut is \`SUBSTRING(0, ${p - 1}, line)\`, both ends included, which is \`'${piece}'\`.`
    : `\`LEN(line)\` is ${len}, so the cut is \`SUBSTRING(${a}, ${b}, line)\`, both ends included, which is \`'${piece}'\`.`
  const sign = l.use === 'times' ? '×' : l.use === 'plus' ? '+' : '−'
  const answer = useValue(l)
  const solution = `${where} ${cutLine} \`STRING_TO_INT\` makes it the number ${l.score}, and ${l.score} ${sign} ${l.k} = **${answer}**.`
  const out = lastOutput(code)
  return numericDraft(
    slot,
    {
      prompt: `What is output by this program?\n\n${fence(code)}`,
      solution,
      method: [`SUBSTRING(${a}, ${b}, line) is '${piece}'`],
      answer,
    },
    { agrees: out === answer && Number(piece) === l.score, detail: `interpreter output ${String(out)}` },
    { line: text, use: l.use, k: l.k, answer },
  )
}

export const stringGenerator: Generator = csBySlot('cs-strings', TOPIC, { q1: length, q6: joinLength, q9: traverse, q17: position, q19: convert })

export const stringGenerators: Generator[] = [stringGenerator]
