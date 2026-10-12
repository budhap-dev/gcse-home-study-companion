import type { Question } from '../../content/questions.ts'
import { grouped } from '../format.ts'
import type { Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Check, Draft, Generator } from '../types.ts'
import { run, type Value } from './pseudo.ts'

/**
 * Computer Science (AQA 8525) generators: what every topic shares.
 *
 * The conventions are the specification's (3.3): decimal prefixes only (1 kB = 1000 B,
 * 1 MB = 1000 kB, 1 GB = 1000 MB, 1 TB = 1000 GB; kibi and mebi are not required), the 8-bit
 * range 0 to 255, logical shifts only, 7-bit ASCII, image size in bits = W × H × D and sound
 * size in bits = rate × resolution × seconds. Figures print as the written questions print
 * them: binary as code (`00101101`), a space between groups of three from five digits
 * (160 000), and \, inside maths.
 */

type Builder = (r: Rng, slot: Question, turn: number) => Draft

/** One Computer Science generator for several written questions, each routed to its own builder by slot id. */
export function csBySlot(id: string, topicId: string, builders: Record<string, Builder>): Generator {
  return {
    id,
    subjectId: 'computer-science',
    topicId,
    replaces: Object.keys(builders),
    build(r, slot, turn) {
      const b = builders[slot.id]
      if (!b) throw new Error(`${id} has no builder for ${slot.id}`)
      return b(r, slot, turn)
    },
  }
}

/** A whole number in binary, padded to `bits` places: bin(45) is 00101101. */
export function bin(n: number, bits = 8): string {
  if (!Number.isInteger(n) || n < 0 || n >= 2 ** bits) throw new Error(`${n} does not fit in ${bits} bits`)
  return n.toString(2).padStart(bits, '0')
}

/** A whole number in hexadecimal, capital letters, padded to `digits`: hex(180) is B4. */
export function hex(n: number, digits = 2): string {
  if (!Number.isInteger(n) || n < 0 || n >= 16 ** digits) throw new Error(`${n} does not fit in ${digits} hex digits`)
  return n.toString(16).toUpperCase().padStart(digits, '0')
}

/** A count as the pack prints it in prose: 2000, 160 000, 3 000 000 000. */
export const count = (x: number) => grouped(x)

/** The same count inside $…$: 160\,000. */
export const texCount = (x: number) => grouped(x).replace(/ /g, '\\,')

/** The article by sound, before a word or a figure (an 8-bit, a 7-bit): shared with every subject. */
export { an } from '../format.ts'

/**
 * A numeric draft in the written slot's units (none, for most of the pack) and tolerance.
 * `line` is the A1 answer as the written mark scheme prints it; left out, it is the answer
 * grouped as the pack prints counts (160 000).
 */
export function numericDraft(
  slot: Question,
  b: { prompt: string; solution: string; method: string[]; answer: number; line?: string },
  check: Check,
  values: Draft['values'],
): Draft {
  if (slot.type !== 'numeric') throw new Error(`${slot.id} is not numeric`)
  return {
    question: {
      type: 'numeric',
      prompt: b.prompt,
      solution: b.solution,
      markScheme: scheme(slot, b.method, b.line ?? count(b.answer)),
      answer: b.answer,
      tolerance: slot.tolerance ?? 0,
      ...(slot.units ? { units: slot.units } : {}),
    },
    check,
    values,
  }
}

/** The decimal prefixes of the specification, as powers of 1000 from bytes (or hertz). */
export const PREFIX = { k: 1, M: 2, G: 3, T: 4 } as const
export type Prefix = keyof typeof PREFIX
/** How many `to` units are in one `from` unit, both decimal prefixes ('' for plain bytes): perUnit('G', 'M') is 1000. */
export const perUnit = (from: Prefix | '', to: Prefix | '') => 1000 ** ((from ? PREFIX[from] : 0) - (to ? PREFIX[to] : 0))

/** A code block as the written questions print it: a string, or its lines. */
export const fence = (code: string | readonly string[]) => '```\n' + (typeof code === 'string' ? code : code.join('\n')) + '\n```'

/** The code inside the first fenced block of a prompt: what the student reads, and what is run. */
export function printedCode(prompt: string): string {
  const m = /```\n([\s\S]*?)\n```/.exec(prompt)
  if (!m) throw new Error('no code block in the prompt')
  return m[1]!
}

/** The last value the printed code outputs, as a number. */
export function lastOutput(code: string, opts: Parameters<typeof run>[1] = {}): number {
  const v: Value | undefined = run(code, opts).outputs.at(-1)
  if (typeof v !== 'number') throw new Error(`the code output ${JSON.stringify(v)}, not a number`)
  return v
}

/** "1, 2 and 4". */
export const andList = (xs: readonly (number | string)[]) => (xs.length < 2 ? String(xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)

/** Round limits strictly between `below` and `answer` (tens, then fives, then any), so a loop's limit is never a value it reaches. */
export function limits(below: number, answer: number): number[] {
  const inside = Array.from({ length: answer - below - 1 }, (_, i) => below + 1 + i)
  for (const step of [10, 5, 1]) {
    const round = inside.filter((x) => x % step === 0)
    if (round.length) return round
  }
  return []
}
