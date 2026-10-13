import type { Question } from '../../content/questions.ts'
import { draw, int, pick, rng, shuffle, type Rng } from '../random.ts'
import type { Draft, Generator } from '../types.ts'
import { an, csBySlot, numericDraft } from './build.ts'

/**
 * Data compression (AQA 8525 3.3.8). Seven numeric written slots, three generators:
 *
 * - q2, run length encoding: how many frequency/data pairs a row needs ("represent data in RLE
 *   frequency/data pairs", the specification's bitmap row 0000011100000011 → 5 0 3 1 6 0 2 1).
 * - q4 and q9, the bits a word or short text needs in ASCII at 7 bits a character ("calculate
 *   the number of bits required to store a piece of uncompressed data in ASCII"; 3.3.5 makes
 *   ASCII a 7-bit code).
 * - q7, q11, q12 and q15, Huffman coding: the bits a word needs with codes from a Huffman tree
 *   built from that word (q7 counts the letters, q11 is given the frequencies), and the bits
 *   saved against ASCII with both counts stated (q12, q15) ("calculate the number of bits
 *   required to store a piece of data compressed using Huffman coding"; "the number of bits
 *   saved by compressing a piece of data using Huffman coding").
 *
 * q21 stays written: it reads the drawn Huffman tree for cheese, so no word here is cheese and
 * no generated question prints its codes (c = 110 never prints on the higher sheet).
 *
 * Every Huffman code printed comes from a Huffman tree built here from the word's own letter
 * frequencies: the two lightest nodes join, ties broken at random and either child on the left,
 * so the code is a prefix code with optimal lengths whichever tree is drawn.
 */
const TOPIC = 'data-compression'

// ---------------------------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------------------------

/**
 * Real words a GCSE student knows, 6 to 11 letters with 3 to 5 distinct letters and at least two
 * repeats, sized like the written banana and mississippi. Never cheese (q21's word, on the higher
 * sheet); no rare, grim or misspelt-looking words.
 */
export const WORDS = [
  'banana', 'bananas', 'papaya', 'tattoo', 'tattoos', 'cocoon', 'murmur', 'pepper', 'peppers', 'settee',
  'needed', 'seeded', 'indeed', 'reread', 'assess', 'assessed', 'assesses', 'messes', 'senses', 'referee',
  'referees', 'referred', 'deferred', 'preferred', 'deterred', 'mammal', 'mammoth', 'cannon', 'coffee', 'toffee',
  'seesaw', 'deeper', 'deepen', 'deepest', 'access', 'success', 'successes', 'succeeds', 'succeeded', 'exceeded',
  'possess', 'possessed', 'possesses', 'address', 'addresses', 'cuckoo', 'couscous', 'bubble', 'bubbles', 'nineteen',
  'nineteenth', 'seventeen', 'eleven', 'sleepless', 'senseless', 'needless', 'tasteless', 'alpaca', 'bazaar', 'garage',
  'baggage', 'cabbage', 'passage', 'massage', 'tomato', 'potato', 'dresser', 'dressed', 'dresses', 'lesser',
  'little', 'kettle', 'settle', 'letter', 'letters', 'better', 'pellet', 'levelled', 'repelled', 'sneeze',
  'sneezes', 'freeze', 'freezer', 'breeze', 'between', 'steeple', 'beetle', 'needle', 'sleeve', 'cassette',
  'classes', 'glasses', 'grasses', 'presses', 'kisses', 'misses', 'bosses', 'raccoon', 'baboon', 'balloon',
  'bassoon', 'monsoon', 'bamboo', 'doodle', 'doodles', 'giggle', 'giggles', 'goggles', 'pebble', 'pebbles',
  'babble', 'lilies', 'redeem', 'redeemed', 'esteem', 'essence', 'nonsense', 'sentence', 'sentences', 'terrier',
  'reverse', 'severe', 'decided', 'coconut', 'cookbook', 'cockatoo', 'lookout', 'outlook', 'rooster', 'puppet',
  'puppies', 'parallel', 'lollipop', 'mississippi', 'rubber', 'minimum', 'maximum', 'pipette', 'beginning', 'winning',
  'spinning', 'grinning', 'running', 'cunning', 'padded', 'goddess', 'beekeeper', 'keepsake', 'greenery', 'greener',
  'steepest', 'sweetest', 'sweeter', 'tester', 'street', 'streets', 'setter', 'lessons', 'session', 'sessions',
  'teammate', 'teammates', 'estate', 'statistics', 'statistic', 'attract', 'attack', 'assets', 'classic', 'crisis',
  'illness', 'mission', 'caravan', 'grotto', 'common', 'engineer', 'levels', 'tissues', 'reassess', 'reassessed',
  'intestine', 'intestines', 'assistant', 'assistants', 'innocence', 'insistent', 'cassettes', 'lollipops', 'beetroot', 'cocoons',
  'puppets', 'nonstop',
]

/** Five-letter words for the ASCII count only, each with a repeated letter, so 35 bits is an answer. */
export const SHORT_WORDS = ['apple', 'hello', 'sheep', 'puppy', 'happy', 'sleep', 'green', 'teeth', 'jelly', 'sunny', 'dress', 'grass', 'glass', 'three', 'berry']

/**
 * Longer words for the ASCII count only (any number of distinct letters, but a repeated one, so
 * counting distinct letters is never right), so every length from 6 to 13 has words to draw.
 */
export const LONG_WORDS = [
  'chocolate', 'spaghetti', 'pineapple', 'crocodile', 'butterfly', 'astronaut', 'telephone', 'breakfast', 'processor', 'dinosaurs',
  'volleyball', 'basketball', 'strawberry', 'television', 'skateboard', 'motorcycle', 'toothbrush', 'lighthouse', 'watermelon',
  'rhinoceros', 'chimpanzee', 'dictionary', 'programmer', 'friendship',
  'wheelbarrow', 'grasshopper', 'caterpillar', 'compression', 'information', 'programming', 'electricity', 'nightingale', 'marshmallow', 'mathematics',
  'hexadecimal', 'spreadsheet', 'celebration', 'independent',
  'hippopotamus', 'thunderstorm', 'kaleidoscope', 'refrigerator', 'encyclopedia', 'photographer',
  'communication', 'international', 'entertainment', 'understanding', 'extraordinary',
]

/**
 * Two-word texts for the ASCII count, each a real two-word phrase (never a compound word split to
 * make a space, never chess, q22's answer) with one space and a repeated letter.
 */
export const PHRASES = [
  'ice cream', 'hot dog', 'bus stop', 'jam tart', 'red rose', 'rock pool', 'beach ball', 'pop music',
  'high tide', 'top hat', 'bar chart', 'fire alarm', 'dog lead', 'gold coin', 'tennis ball', 'red pepper',
  'green tea', 'apple tree', 'school bus', 'sweet pea', 'full moon', 'lemon tree', 'big wheel', 'bubble bath',
  'sea level', 'bus pass', 'jelly bean', 'rubber duck', 'pepper mill', 'coffee mug', 'cotton wool', 'paper plane',
  'summer term', 'hello world', 'pocket money', 'silver spoon', 'garden party', 'banana split', 'ballet shoes', 'sunny morning',
  'school dinner', 'birthday cake', 'tennis racket', 'kitchen table', 'swimming pool', 'football match', 'car park', 'fish finger',
  'tea party', 'apple pie', 'post office', 'bus station', 'train station', 'netball court', 'cricket match', 'running track',
  'chocolate cake', 'birthday party', 'science lesson', 'summer holiday', 'school uniform', 'maths homework', 'football pitch', 'tennis lesson',
]

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen']
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)
/** "a, b and c". */
const list = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)
/** How often a letter appears, as the written q11 says it: once, twice, four times. */
const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${NUMBER_WORDS[n]} times`)
/** A letter in prose, bold so it never reads as a word ("**a** once", not "a once"). */
const L = (c: string) => `**${c}**`

/** The letters of a word with how often each appears, in order of first appearance. */
export function frequencies(word: string): [string, number][] {
  const f = new Map<string, number>()
  for (const c of word) f.set(c, (f.get(c) ?? 0) + 1)
  return [...f]
}

// ---------------------------------------------------------------------------------------------
// Huffman trees
// ---------------------------------------------------------------------------------------------

interface Node {
  weight: number
  char?: string
  left?: Node
  right?: Node
  key: number
}

export interface Huffman {
  word: string
  /** Letter and frequency, in order of first appearance. */
  freq: [string, number][]
  /** Letter → code, each left branch 0 and each right branch 1. */
  codes: Record<string, string>
  /** Bits for the whole word: each frequency × its code length, added. */
  total: number
}

/**
 * A Huffman tree for `word` built from its own letter frequencies: the two lightest nodes join
 * until one remains. Equal weights are taken in a random order and either node may go left, so
 * different trees can come out, but every one is a Huffman tree: a prefix code of least total length.
 */
export function huffman(r: Rng, word: string): Huffman {
  const freq = frequencies(word)
  let nodes: Node[] = freq.map(([char, weight]) => ({ weight, char, key: r() }))
  while (nodes.length > 1) {
    nodes.sort((a, b) => a.weight - b.weight || a.key - b.key)
    const [a, b] = [nodes[0]!, nodes[1]!]
    nodes = nodes.slice(2)
    const [left, right] = r() < 0.5 ? [a, b] : [b, a]
    nodes.push({ weight: a.weight + b.weight, left, right, key: r() })
  }
  const codes: Record<string, string> = {}
  const walk = (n: Node, path: string) => {
    if (n.char !== undefined) codes[n.char] = path
    else {
      walk(n.left!, `${path}0`)
      walk(n.right!, `${path}1`)
    }
  }
  walk(nodes[0]!, '')
  const total = freq.reduce((s, [c, f]) => s + f * codes[c]!.length, 0)
  return { word, freq, codes, total }
}

/** The total a Huffman tree gives `word`: the same for every tie-break, so pools can be sorted by it. */
const huffmanTotal = (word: string) => huffman(() => 0.5, word).total

/**
 * Second route: encode the word letter by letter, count the bits, then decode the bits back with
 * the codes (a prefix code reads back without separators). Agrees when the count is the total
 * and the decoding is the word.
 */
function encodeCheck(h: Huffman): { agrees: boolean; bits: string } {
  const bits = [...h.word].map((c) => h.codes[c]).join('')
  const byCode = new Map(Object.entries(h.codes).map(([c, code]) => [code, c]))
  let out = ''
  let buf = ''
  for (const b of bits) {
    buf += b
    const c = byCode.get(buf)
    if (c !== undefined) {
      out += c
      buf = ''
    }
  }
  return { agrees: bits.length === h.total && out === h.word && buf === '', bits }
}

/** ASCII bits by encoding each character as its own 7-bit code and counting. */
function asciiBits(text: string): string {
  return [...text]
    .map((c) => {
      const code = c.charCodeAt(0)
      if (code > 127) throw new Error(`${c} is not ASCII`)
      return code.toString(2).padStart(7, '0')
    })
    .join('')
}

const distinct = (w: string) => new Set(w).size

/**
 * Higher sheet: q21 is cheese, and q23 asks for its code for c (110). q7's own written word is
 * banana (9 bits), which came back with its codes relabelled in about 1 build in 75; success is
 * the advanced sheet's written q12.
 */
const HIGHER_BANNED = new Set(['cheese', 'banana', 'bananas', 'success'])
/**
 * Advanced sheet: q14 decodes 100110110 to banana with a = 0, b = 10, n = 11; q18 works
 * mississippi; the written q12 is success (13 bits against 49).
 */
const ADVANCED_BANNED = new Set(['banana', 'bananas', 'mississippi', 'cheese', 'success'])

/** The longest code a tree gives, times the number of distinct letters: the slip that prices every letter at the longest code. */
const flatLongest = (h: Huffman) => h.freq.length * Math.max(...Object.values(h.codes).map((c) => c.length))

/** A tree whose printed codes give nothing away (see `tree`). */
const fair = (h: Huffman) =>
  !Object.values(h.codes).some((code) => Number(code) === h.total) && flatLongest(h) !== h.total && h.codes.c !== '110'

/**
 * Whether a word has trees enough that give nothing away: of 40 tie-breaks, a quarter must be fair,
 * so `tree` finds one in its 500 tries for any seed.
 */
function hasFairTrees(word: string): boolean {
  const r = rng(`fair:${word}`)
  let ok = 0
  for (let i = 0; i < 40; i++) if (fair(huffman(r, word))) ok++
  return ok >= 10
}

/**
 * A Huffman total that a flat code also gives (2 bits a letter: 2n) lets a student who never
 * builds the tree score; the total does not depend on the tie-break, so such words are left out.
 */
const notFlat = (w: string) => huffmanTotal(w) !== 2 * w.length

/** q21's working: six letters counted 3, 1, 1, 1 (cheese, bazaar), 11 bits by the same sum. */
const cheeseShaped = (w: string) => w.length === 6 && frequencies(w).map(([, f]) => f).sort().join() === '1,1,1,3'

/** q7 (higher, 6-7): 3 or 4 distinct letters, 6 to 10 letters, as banana; never q21's sum. */
export const Q7_WORDS = WORDS.filter(
  (w) => !HIGHER_BANNED.has(w) && distinct(w) >= 3 && distinct(w) <= 4 && w.length <= 10 && notFlat(w) && !cheeseShaped(w) && hasFairTrees(w),
)
/** q11 (advanced, 8-9): 4 or 5 distinct letters, 7 to 11 letters, as mississippi. */
export const Q11_WORDS = WORDS.filter(
  (w) => !ADVANCED_BANNED.has(w) && distinct(w) >= 4 && distinct(w) <= 5 && w.length >= 7 && notFlat(w) && hasFairTrees(w),
)
/**
 * q12 and q15 (advanced): 3 to 5 distinct letters, and never a word whose saving equals its
 * Huffman count (7n = 2H), where the printed figure would be the answer, nor the written q12's
 * 49 − 13.
 */
export const SAVING_WORDS = WORDS.filter(
  (w) =>
    !ADVANCED_BANNED.has(w) && distinct(w) >= 3 && distinct(w) <= 5 && 7 * w.length !== 2 * huffmanTotal(w) && !(w.length === 7 && huffmanTotal(w) === 13),
)

/**
 * q11, q12 and q15 share the advanced sheet. Their turns are consecutive, so each takes the words
 * whose Huffman total leaves a different remainder on division by 3: the three words differ, no
 * slot prints another's Huffman count, and q12 and q15 never ask the same subtraction.
 */
const byClass = (words: string[], turn: number) => words.filter((w) => huffmanTotal(w) % 3 === ((turn % 3) + 3) % 3)

/**
 * A tree for the word (ties broken another way, or the branches swapped) whose printed codes never
 * give the answer away: no code read as a number equals it (a code 11 and an answer of 11), the
 * number of distinct letters times the longest code does not (street: 4 × 3 = 12), and never
 * c = 110, q23's answer for cheese on the higher sheet.
 */
function tree(r: Rng, word: string): Huffman {
  return draw(r, (r) => huffman(r, word), fair)
}

/** Codes as the written questions print them: a = 0, n = 11 and b = 10. */
function codeList(r: Rng, h: Huffman): string {
  const letters = h.freq.map(([c]) => c)
  const order = pick(r, [
    // Most frequent first, as the written q7 prints banana.
    [...h.freq].sort((a, b) => b[1] - a[1]).map(([c]) => c),
    // Shortest code first, as the written q11 prints mississippi.
    [...letters].sort((a, b) => h.codes[a]!.length - h.codes[b]!.length || h.codes[a]!.localeCompare(h.codes[b]!)),
    shuffle(r, letters),
  ])
  return list(order.map((c) => `${L(c)} = ${h.codes[c]}`))
}

/** Each frequency × code length, as the written solutions set it out: s: 4 × 1 = 4. */
const products = (h: Huffman) => h.freq.map(([c, f]) => ({ c, f, len: h.codes[c]!.length, bits: f * h.codes[c]!.length }))

// ---------------------------------------------------------------------------------------------
// q7: Huffman bits for a word, frequencies counted from the word
// ---------------------------------------------------------------------------------------------

const Q7_PROMPTS = [
  (w: string, codes: string) => `Huffman codes for **${w}** are ${codes}. How many bits are needed to store the whole word?`,
  (w: string, codes: string) => `A Huffman tree built from the word **${w}** gives the codes ${codes}. How many bits does **${w}** take when it is stored with these codes?`,
  (w: string, codes: string) => `The word **${w}** is compressed with Huffman coding, using the codes ${codes}. How many bits does the compressed word need?`,
]

/**
 * A word drawn by its Huffman total first, each total weighted by the square root of how many
 * words give it: thirteen-bit words are common (bananas, dresses, monsoon…) and drawn word by word
 * they took two builds in five.
 */
function byTotal(r: Rng, words: string[]): string {
  const groups = new Map<number, string[]>()
  for (const w of words) groups.set(huffmanTotal(w), [...(groups.get(huffmanTotal(w)) ?? []), w])
  const list = [...groups.values()]
  const weights = list.map((g) => Math.sqrt(g.length))
  let x = r() * weights.reduce((a, b) => a + b, 0)
  for (const [i, g] of list.entries()) {
    x -= weights[i]!
    if (x < 0) return pick(r, g)
  }
  return pick(r, list[list.length - 1]!)
}

function wordBits(r: Rng, slot: Question): Draft {
  const word = byTotal(r, Q7_WORDS)
  const h = tree(r, word)
  const p = products(h)
  const prompt = pick(r, Q7_PROMPTS)(word, codeList(r, h))
  const counted = list(p.map(({ c, f }) => `${L(c)} ${times(f)}`))
  const solution =
    `Count each letter in **${word}**: ${counted}. ` +
    `Then frequency × code length: ${p.map(({ c, f, len, bits }) => `${L(c)}: ${f} × ${len} = ${bits}`).join(', ')}. ` +
    `Altogether ${p.map(({ bits }) => bits).join(' + ')} = **${h.total}** bits.`
  const enc = encodeCheck(h)
  return numericDraft(
    slot,
    { prompt, solution, method: [`multiplies each frequency by its code length: ${list(p.map(({ f, len }) => `${f} × ${len}`))}`], answer: h.total },
    { agrees: enc.agrees, detail: `encoded ${word} letter by letter: ${enc.bits} (${enc.bits.length} bits), decoded back to ${word}` },
    { word, codes: JSON.stringify(h.codes), total: h.total },
  )
}

// ---------------------------------------------------------------------------------------------
// q11: Huffman bits with the frequencies given
// ---------------------------------------------------------------------------------------------

const Q11_PROMPTS = [
  (w: string, codes: string, freqs: string) =>
    `The word **${w}** has the Huffman codes ${codes}, and the letters appear ${freqs}. How many bits does the compressed word need?`,
  (w: string, codes: string, freqs: string) =>
    `A Huffman tree built from the word **${w}** gives the codes ${codes}. In the word the letters appear ${freqs}. How many bits are needed to store **${w}** with these codes?`,
]

function givenFrequencies(r: Rng, slot: Question, turn: number): Draft {
  const word = pick(r, byClass(Q11_WORDS, turn))
  const h = tree(r, word)
  const p = products(h)
  const freqs = list(shuffle(r, h.freq).map(([c, f]) => `${L(c)} ${times(f)}`))
  const prompt = pick(r, Q11_PROMPTS)(word, codeList(r, h), freqs)
  const solution =
    `${p.map(({ c, f, len, bits }) => `${L(c)}: ${f} × ${len} = ${bits}`).join('. ')}. ` +
    `Altogether ${p.map(({ bits }) => bits).join(' + ')} = **${h.total}** bits, ` +
    `against ${word.length} × 7 = ${word.length * 7} in ASCII.`
  const enc = encodeCheck(h)
  return numericDraft(
    slot,
    {
      prompt,
      solution,
      method: ['multiplies each frequency by its code length', `adds the ${NUMBER_WORDS[p.length]} totals`],
      answer: h.total,
    },
    { agrees: enc.agrees, detail: `encoded ${word} letter by letter: ${enc.bits} (${enc.bits.length} bits), decoded back to ${word}` },
    { word, codes: JSON.stringify(h.codes), total: h.total },
  )
}

// ---------------------------------------------------------------------------------------------
// q12 and q15: bits saved, both counts given
// ---------------------------------------------------------------------------------------------

const SAVING_PROMPTS = [
  (w: string, H: number, A: number) => `Storing **${w}** takes ${H} bits with Huffman coding and ${A} bits in ASCII. How many bits are saved?`,
  (w: string, H: number, A: number) => `The word **${w}** needs ${H} bits with Huffman coding and ${A} bits in ASCII. How many bits are saved?`,
  (w: string, H: number, A: number) =>
    `Stored in ASCII, the word **${w}** takes ${A} bits. Compressed with Huffman coding, it takes ${H} bits. How many bits does the compression save?`,
]

function saving(r: Rng, slot: Question, turn: number): Draft {
  // The length first (6 to 11 letters, as the written success, banana and mississippi), so one
  // short word's subtraction does not fill the slot; then a word of that length in this turn's class.
  const pool = byClass(SAVING_WORDS, turn)
  const n = pick(r, [...new Set(pool.map((w) => w.length))])
  const word = pick(r, pool.filter((w) => w.length === n))
  const h = huffman(r, word)
  const H = h.total
  const A = word.length * 7
  const S = A - H
  const prompt = pick(r, SAVING_PROMPTS)(word, H, A)
  const solution =
    `${A} − ${H} = **${S}** bits saved. ASCII spends 7 bits on each of the ${word.length} letters (${word.length} × 7 = ${A}); ` +
    'Huffman coding gives the commonest letters the shortest codes.'
  const method = slot.id === 'q15' ? [`subtracts ${H} from ${A}`] : ['subtracts the compressed size from the ASCII size']
  // Second route: encode the word both ways and subtract the lengths of the bit strings.
  const ascii = asciiBits(word)
  const enc = encodeCheck(h)
  return numericDraft(
    slot,
    { prompt, solution, method, answer: S },
    { agrees: enc.agrees && ascii.length - enc.bits.length === S, detail: `ASCII bit string ${ascii.length} bits, Huffman bit string ${enc.bits.length} bits` },
    { word, huffman: H, ascii: A, saved: S },
  )
}

// ---------------------------------------------------------------------------------------------
// q4 and q9: ASCII bits for a word or a short text
// ---------------------------------------------------------------------------------------------

/** Lengths the ASCII slots draw first, so the answer (7 × length) spreads evenly. */
const ASCII_WORDS = [...SHORT_WORDS, ...WORDS, ...LONG_WORDS].filter((w) => !HIGHER_BANNED.has(w))
const ASCII_LENGTHS = [...new Set([...ASCII_WORDS, ...PHRASES].map((t) => t.length))].filter((n) => n >= 5 && n <= 14).sort((a, b) => a - b)

const Q4_PROMPTS = [
  (t: string, n: number) => `How many bits are needed to store the ${n} characters of **${t}** in ASCII, at 7 bits per character?`,
  (t: string, n: number) =>
    t.includes(' ')
      ? `The text **${t}** is ${n} characters long, counting the space. How many bits does it need in ASCII, at 7 bits per character?`
      : `**${cap(t)}** is ${an(n)} ${n}-letter word. How many bits does it need in ASCII, at 7 bits per character?`,
  (t: string, n: number) => `A text file holds the ${n} characters of **${t}**, each stored in ASCII at 7 bits per character. How many bits do the characters take?`,
]

const Q9_PROMPTS = [
  (t: string) =>
    t.includes(' ')
      ? `How many bits does the text **${t}** need in ASCII, at 7 bits per character, counting the space?`
      : `How many bits does the word **${t}** need in ASCII, at 7 bits per character?`,
  (t: string) =>
    t.includes(' ')
      ? `The text **${t}**, with the space between its words, is stored in ASCII at 7 bits per character. How many bits does it need?`
      : `The word **${t}** is stored in ASCII at 7 bits per character. How many bits does it need?`,
]

function asciiCount(r: Rng, slot: Question): Draft {
  const n = pick(r, ASCII_LENGTHS)
  // A single word, as the written slots, most of the time; a two-word text where none is that long.
  const words = ASCII_WORDS.filter((t) => t.length === n)
  const phrases = PHRASES.filter((t) => t.length === n)
  const text = pick(r, !phrases.length || (words.length && r() < 0.7) ? words : phrases)
  const prompt = slot.id === 'q4' ? pick(r, Q4_PROMPTS)(text, n) : pick(r, Q9_PROMPTS)(text)
  const counting =
    slot.id === 'q4'
      ? ''
      : text.includes(' ')
        ? `The text **${text}** has ${n - 1} letters and one space, so ${n} characters. `
        : `The word **${text}** has ${n} letters. `
  const solution = `${counting}${n} × 7 = **${n * 7}** bits. Every character costs the same in ASCII, however common it is.`
  const bits = asciiBits(text)
  return numericDraft(
    slot,
    { prompt, solution, method: [], answer: n * 7 },
    { agrees: bits.length === n * 7, detail: `encoded ${text} character by character in 7-bit ASCII: ${bits.length} bits` },
    { text, characters: n },
  )
}

// ---------------------------------------------------------------------------------------------
// q2: run length encoding, how many pairs
// ---------------------------------------------------------------------------------------------

/** Runs as frequency/data pairs. */
export function runs(values: string[]): [number, string][] {
  const out: [number, string][] = []
  for (const v of values) {
    const last = out[out.length - 1]
    if (last && last[1] === v) last[0]++
    else out.push([1, v])
  }
  return out
}

/** Run lengths adding to `length`, `k` of them, at least one a single value and one longer. */
function composition(r: Rng, length: number, k: number): number[] {
  return draw(
    r,
    (r) => {
      const cuts = shuffle(r, Array.from({ length: length - 1 }, (_, i) => i + 1)).slice(0, k - 1).sort((a, b) => a - b)
      return [...cuts, length].map((c, i) => c - (i ? cuts[i - 1]! : 0))
    },
    (parts) => parts.includes(1) && parts.some((p) => p >= 2),
  )
}

/** Never the letter a, which would print "1 a 8 b" and read as an article. */
const RLE_LETTERS = [['b', 'c'], ['b', 'c', 'd'], ['x', 'y'], ['x', 'y', 'z'], ['w', 'b']]

function rlePairs(r: Rng, slot: Question): Draft {
  // The answer first: 3 to 10 runs, then a row 2 to 6 values longer, from the written 6 up to the
  // specification's 16, so rows at the written scale are common.
  const k = int(r, 3, 10)
  const length = Math.max(6, Math.min(16, k + int(r, 2, 6)))
  const parts = composition(r, length, k)
  const form = pick(r, ['list', 'list', 'bits', 'text'] as const)
  // Fewer symbols than runs, so counting the different symbols never gives the answer.
  const symbols = form === 'text' ? pick(r, RLE_LETTERS.filter((x) => x.length < k)) : ['0', '1']
  // Each run takes a different symbol from the one before it.
  const seq: string[] = []
  let prev = ''
  for (let i = 0; i < parts.length; i++) {
    const s = pick(r, symbols.filter((x) => x !== prev))
    seq.push(s)
    prev = s
  }
  const values = parts.flatMap((p, i) => Array(p).fill(seq[i]) as string[])
  const row = values.join('')
  const prompt =
    form === 'list'
      ? `How many frequency/data pairs are needed to encode the row ${values.join(', ')} using run length encoding?`
      : form === 'bits'
        ? `One row of a black and white bitmap is stored as the bits \`${row}\`. How many frequency/data pairs does run length encoding need for this row?`
        : `How many frequency/data pairs does run length encoding need for the text **${row}**?`
  const pairs = runs(values)
  const said = pairs.map(([f, v], i) => {
    const what = /\d/.test(v) ? `${NUMBER_WORDS[f]} ${v}${f > 1 ? 's' : ''}` : `${NUMBER_WORDS[f]} ${L(v)}`
    return i === pairs.length - 1 ? `then ${what}` : what
  })
  const encoded = pairs.map(([f, v]) => `${f} ${v}`).join(' ')
  const solution = `${cap(NUMBER_WORDS[k]!)} runs: ${said.join(', ')}. That is **${k}** pairs: ${encoded}.`
  // Second route: expand the pairs back into the row, and count the places the value changes.
  const expanded = pairs.flatMap(([f, v]) => Array(f).fill(v) as string[]).join('')
  const changes = values.filter((v, i) => i > 0 && v !== values[i - 1]).length
  return numericDraft(
    slot,
    { prompt, solution, method: [], answer: k },
    { agrees: expanded === row && changes + 1 === k && pairs.length === k, detail: `${changes} changes of value + 1 = ${changes + 1} runs; pairs expand back to ${expanded}` },
    { row, form, runs: k, length },
  )
}

export const rleGenerator = csBySlot('cs-rle-pairs', TOPIC, { q2: rlePairs })
export const asciiBitsGenerator = csBySlot('cs-ascii-bits', TOPIC, { q4: asciiCount, q9: asciiCount })
export const huffmanGenerator = csBySlot('cs-huffman-bits', TOPIC, { q7: wordBits, q11: givenFrequencies, q12: saving, q15: saving })

export const compressionGenerators: Generator[] = [rleGenerator, asciiBitsGenerator, huffmanGenerator]
