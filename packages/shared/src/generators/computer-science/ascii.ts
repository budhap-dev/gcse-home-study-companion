import type { Question } from '../../content/questions.ts'
import { ordinal } from '../format.ts'
import { int, pick, type Rng } from '../random.ts'
import type { Draft, Generator } from '../types.ts'
import { bin, csBySlot, numericDraft } from './build.ts'

/**
 * Computer Science (AQA 8525) generators: 3.3.5, character encoding (ascii-and-unicode).
 *
 * - "Character codes are commonly grouped and run in sequence within encoding tables": the
 *   specification's own example is A = 65, B = 66, "and so on", the same pattern applying to lower
 *   case letters and digits. q3 counts on or back within the capitals, q5 within the lower case
 *   letters and q6 within the digit characters, each from a code the prompt gives (not always A, a
 *   or 0), so a student needs the pattern and not a remembered table.
 * - 7-bit ASCII: q14 stores a short piece of text at 7 bits a character, every character counted,
 *   spaces, digits and punctuation included. The specification names 7-bit ASCII only, so no slot
 *   stores text at 8 bits.
 *
 * q2 (128 characters) and q7 (the gap of 32 between the cases) are facts to recall and stay written.
 */
const TOPIC = 'ascii-and-unicode'

// ---------------------------------------------------------------------------------------------
// Counting on within a group: q3 (capitals), q5 (lower case), q6 (digit characters)
// ---------------------------------------------------------------------------------------------

/** One group of the ASCII table: its first character, that character's code and how many run in sequence. */
interface Group {
  first: string
  code: number
  size: number
  /** Distances, in places, the slot counts on or back: the written q3 counts 3, q5 16, q6 5. */
  distance: [number, number]
  /** Characters never printed or reached: the higher sheet asks which letter is 104 (h, q19) and which word is 83, 116, 97, 114 (q21). */
  avoid: string
  /** The share of builds that count on rather than back. */
  forward: number
}
const CAPITALS: Group = { first: 'A', code: 65, size: 26, distance: [2, 10], avoid: '', forward: 0.7 }
const LOWER: Group = { first: 'a', code: 97, size: 26, distance: [4, 20], avoid: 'hrt', forward: 0.7 }
const DIGITS: Group = { first: '0', code: 48, size: 10, distance: [2, 9], avoid: '', forward: 0.5 }

const charAt = (g: Group, i: number) => String.fromCharCode(g.first.charCodeAt(0) + i)

interface Count {
  given: number
  target: number
  /** Places from the given character to the target: negative counts back. */
  step: number
}

/**
 * The given and target positions in the group, drawn evenly from every pair the slot's distances
 * allow: counting on (as the written questions all do) seven times in ten for the letters, half the
 * time for the ten digits, where counting on alone skews the answers to 8 and 9 and the given digit
 * to 0. Drawing the given character or the distance first made 0 the given digit a quarter of the
 * time, and drawing the target first made it a fifth.
 */
function drawCount(r: Rng, g: Group, ok: (c: Count) => boolean = () => true): Count {
  const [lo, hi] = g.distance
  const pairs = Array.from({ length: g.size * g.size }, (_, i) => ({ given: Math.floor(i / g.size), target: i % g.size, step: (i % g.size) - Math.floor(i / g.size) })).filter(
    (c) => Math.abs(c.step) >= lo && Math.abs(c.step) <= hi && !g.avoid.includes(charAt(g, c.given)) && !g.avoid.includes(charAt(g, c.target)) && ok(c),
  )
  const on = r() < g.forward
  return pick(r, pairs.filter((c) => (on ? c.step > 0 : c.step < 0)))
}

/** "16 places on from a", "3 places back from M": the written M1 line. */
const places = (c: Count, from: string) => `${Math.abs(c.step)} places ${c.step > 0 ? 'on' : 'back'} from ${from}`
const sum = (code: number, step: number) => `${code} ${step > 0 ? '+' : '-'} ${Math.abs(step)}`
/** The same sum as the mark scheme prints it, outside maths: 54 − 6. */
const sumLine = (code: number, step: number) => `${code} ${step > 0 ? '+' : '−'} ${Math.abs(step)}`

const LETTER_PROMPTS = [
  (G: string, g: number, T: string) => `In ASCII the code for ${G} is ${g}. What is the code for ${T}?`,
  (G: string, g: number, T: string, kind: string) => `The ASCII code for the ${kind} letter ${G} is ${g}, and the ${kind} letters run in sequence. What is the ASCII code for ${T}?`,
  (G: string, g: number, T: string) => `Given that ${G} has the ASCII code ${g}, what is the ASCII code for ${T}?`,
]

/** q3 and q5: a letter counted on or back from a given one. Written: 65 + 3 = 68 (q3), 97 + 16 = 113 (q5). */
function letters(group: Group, kind: string) {
  return (r: Rng, slot: Question): Draft => {
    const c = drawCount(r, group)
    // Every letter in the specification's quotes (‘A’ is coded as 65): unquoted, "the code for a is
    // 97" reads as an article and "Given that I has" as a word.
    const name = (i: number) => `‘${charAt(group, i)}’`
    const G = name(c.given)
    const T = name(c.target)
    const g = group.code + c.given
    const answer = g + c.step
    const where =
      c.given === 0
        ? `${T} is the ${ordinal(c.target + 1)} letter, so **${Math.abs(c.step)}** places on from ${G}.`
        : `${T} is the ${ordinal(c.target + 1)} letter and ${G} the ${ordinal(c.given + 1)}, so ${T} is **${Math.abs(c.step)}** places ${c.step > 0 ? 'on' : 'back'} from ${G}.`
    return numericDraft(
      slot,
      {
        prompt: pick(r, LETTER_PROMPTS)(G, g, T, kind),
        solution: `${where} $${sum(g, c.step)} = $ **${answer}**. The ${kind} letters run in sequence, so the code goes up by 1 for each letter along the alphabet.`,
        method: [places(c, G)],
        answer,
      },
      // Second route: the character's own code, as the computer's table holds it.
      { agrees: charAt(group, c.target).charCodeAt(0) === answer && answer < 128, detail: `${T} is ${charAt(group, c.target).charCodeAt(0)}` },
      { given: charAt(group, c.given), target: charAt(group, c.target), step: c.step },
    )
  }
}

const DIGIT_PROMPTS = [
  (c: number, g: number, t: number) => `In ASCII the code for the character ${c} is ${g}. What is the code for the character ${t}?`,
  (c: number, g: number, t: number) => `The digit characters run in sequence in ASCII, and the character ${c} has the code ${g}. What is the ASCII code for the character ${t}?`,
  (c: number, g: number, t: number) => `A user types the digit ${t} on a keyboard, and the computer stores its ASCII code. The character ${c} has the code ${g}. What code is stored?`,
]

/** q6: the digit characters, counted on or back from a given one. Written: 48 + 5 = 53. */
function digits(r: Rng, slot: Question): Draft {
  // Never a count equal to the target digit: from 6 back to 3, 54 − 3 is the code, so taking the
  // digit's value off the given code would pay. (On from 0, adding the value is the method itself.)
  const c = drawCount(r, DIGITS, (x) => x.given === 0 || Math.abs(x.step) !== x.target)
  const g = DIGITS.code + c.given
  const answer = g + c.step
  const where = c.given === 0 ? 'The digits run in sequence from 48, so' : `The digits run in sequence, so the character ${c.target} is ${Math.abs(c.step)} places ${c.step > 0 ? 'on' : 'back'} from the character ${c.given}:`
  return numericDraft(
    slot,
    {
      prompt: pick(r, DIGIT_PROMPTS)(c.given, g, c.target),
      solution: `${where} $${sum(g, c.step)} = $ **${answer}**. That is the code for the **character** ${c.target}, not the value ${c.target}.`,
      method: [sumLine(g, c.step)],
      answer,
    },
    { agrees: String(c.target).charCodeAt(0) === answer, detail: `"${c.target}" is ${String(c.target).charCodeAt(0)}` },
    { given: c.given, target: c.target, step: c.step },
  )
}

const counting = csBySlot('ascii-code-from-known', TOPIC, {
  q3: letters(CAPITALS, 'capital'),
  q5: letters(LOWER, 'lower case'),
  q6: digits,
})

// ---------------------------------------------------------------------------------------------
// Text and storage: q14, every character at 7 bits
// ---------------------------------------------------------------------------------------------

type Kind = 'word' | 'text' | 'password' | 'name'
/**
 * Texts to store, by length from 3 to 12 characters: words in mixed case, messages with a space, a
 * digit or a mark that counts as a character too, passwords with digits, and names. No figure in a
 * text equals its own length, 7 or its answer ("Bus at 8" is 8 characters, "Bus 42" is 42 bits).
 */
const TEXTS: Record<number, [string, Kind][]> = {
  3: [['Dog', 'word'], ['Sun', 'word'], ['Map', 'word'], ['Tea', 'word'], ['Owl', 'word'], ['SOS', 'word'], ['Ava', 'name'], ['Hi!', 'text']],
  4: [['Fish', 'word'], ['Bird', 'word'], ['Byte', 'word'], ['Data', 'word'], ['HELP', 'word'], ['Noah', 'name'], ['Theo', 'name'], ['Ruby', 'name'], ['Kofi', 'name'], ['Why?', 'text']],
  5: [['Robot', 'word'], ['Pixel', 'word'], ['Music', 'word'], ['Mouse', 'word'], ['Logic', 'word'], ['Cloud', 'word'], ['Pizza', 'word'], ['Zebra', 'word'], ['Priya', 'name'], ['Help!', 'text'], ['Sky99', 'password']],
  6: [['Laptop', 'word'], ['Router', 'word'], ['Tablet', 'word'], ['Garden', 'word'], ['Planet', 'word'], ['Rocket', 'word'], ['Monday', 'word'], ['banana', 'word'], ['binary', 'word'], ['Oliver', 'name'], ['Zainab', 'name'], ['Hi Sam', 'text'], ['Hello!', 'text'], ['Moon88', 'password'], ['Mango5', 'password'], ['Star31', 'password']],
  7: [['monitor', 'word'], ['printer', 'word'], ['storage', 'word'], ['Science', 'word'], ['Room 12', 'text'], ['Year 10', 'text'], ['Go team', 'text'], ['Level 3', 'text'], ['Rex2010', 'password'], ['Frog123', 'password']],
  8: [['keyboard', 'word'], ['Computer', 'word'], ['Dinosaur', 'word'], ['Isabella', 'name'], ['Owl4ever', 'password'], ['Home now', 'text'], ['Hi there', 'text'], ['Go Team!', 'text']],
  9: [['Good luck', 'text'], ['On my way', 'text'], ['Game over', 'text'], ['Thank you', 'text'], ['Back at 5', 'text'], ['Panda2024', 'password'], ['Elephant4', 'password'], ['Alexander', 'name'], ['Anastasia', 'name']],
  10: [['Well done!', 'text'], ['Top score!', 'text'], ['Good night', 'text'], ['Happy days', 'text'], ['Lunch time', 'text'], ['Keep going', 'text'], ['Maximilian', 'name'], ['Rainbow123', 'password']],
  11: [['Hello world', 'text'], ['Meet at 4pm', 'text'], ['See you now', 'text'], ['Bye for now', 'text'], ['Great game!', 'text'], ['On the bus!', 'text'], ['Christopher', 'name'], ['Penguin2025', 'password']],
  12: [['See you soon', 'text'], ['Good morning', 'text'], ['See you at 6', 'text'], ['Running late', 'text'], ['Call me at 3', 'text'], ['Coffee at 11', 'text']],
}

const TEXT_PROMPTS: Record<Kind, ((t: string) => string)[]> = {
  word: [
    (t) => `How many bits are needed to store the word "${t}" in 7-bit ASCII?`,
    (t) => `A program stores the word "${t}" in 7-bit ASCII. How many bits does it use?`,
  ],
  text: [
    (t) => `A text message reads "${t}". How many bits are needed to store it in 7-bit ASCII?`,
    (t) => `How many bits are needed to store the text "${t}" in 7-bit ASCII?`,
  ],
  password: [
    (t) => `The password "${t}" is stored in 7-bit ASCII. How many bits does it take?`,
    (t) => `How many bits are needed to store the password "${t}" in 7-bit ASCII?`,
  ],
  name: [
    (t) => `A program stores the user name "${t}" in 7-bit ASCII. How many bits does it use?`,
    (t) => `How many bits are needed to store the name "${t}" in 7-bit ASCII?`,
  ],
}

/** The characters of a text as the solution lists them: H, i, the space, S, a, m. */
const listed = (t: string) => [...t].map((ch) => (ch === ' ' ? 'the space' : ch)).join(', ')

/** q14: characters × 7 bits. Written: "Cat", 3 × 7 = 21. */
const textBits = csBySlot('ascii-text-bits', TOPIC, {
  q14(r, slot) {
    // The length first, evenly, then a text of that length: picking a text first made 6 × 7 a fifth of the slot.
    const n = int(r, 3, 12)
    const [t, kind] = pick(r, TEXTS[n]!)
    const answer = n * 7
    const plain = /^[A-Za-z]+$/.test(t)
    const notes: string[] = []
    if (/[A-Z]/.test(t) && /[a-z]/.test(t)) notes.push('The capital and the lower case letters take the same space: the case changes the code, not the size.')
    if (t.includes(' ')) notes.push('The space is a character with its own code, so it is stored like any other.')
    if (/\d/.test(t)) notes.push('Each digit is stored as a character, at 7 bits like a letter.')
    if (/[!?]/.test(t)) notes.push(`The ${t.match(/[!?]/)![0]} is a character too.`)
    const count = plain ? `"${t}" has ${n} characters at 7 bits each` : `"${t}" has ${n} characters (${listed(t)}), each at 7 bits`
    // Second route: encode the text a character at a time and count the bits written.
    const codes = [...t].map((ch) => ch.charCodeAt(0))
    const encoded = codes.map((c) => bin(c, 7)).join('')
    return numericDraft(
      slot,
      {
        prompt: pick(r, TEXT_PROMPTS[kind])(t),
        solution: `${count}: $${n} \\times 7 = $ **${answer}** bits. ${notes.join(' ')}`.trim(),
        method: [`${n} characters × 7 bits`],
        answer,
      },
      { agrees: encoded.length === answer && codes.every((c) => c < 128), detail: `${codes.length} codes, ${encoded.length} bits` },
      { kind, text: t, characters: n },
    )
  },
})

export const asciiGenerators: Generator[] = [counting, textBits]

/** For the tests: the groups and the texts. */
export const ASCII = { CAPITALS, LOWER, DIGITS, TEXTS }
