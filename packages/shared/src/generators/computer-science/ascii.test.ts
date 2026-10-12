import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate, sheetQuestions } from '../index.ts'
import type { Generated } from '../types.ts'
import { ASCII, asciiGenerators } from './ascii.ts'

/**
 * Structural tests for the 3.3.5 generators. Each reads the prompt back (the given character and
 * its code, the target, the quoted text) and works the answer from its own alphabet and its own
 * binary encoding, sharing no code with the generator; checks the printed steps, the routing, each
 * slot's own group, the named wrong routes, and the spread.
 */
const TOPIC = 'ascii-and-unicode'
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/computer-science')
const file = JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8'))
const bank = Question.array().parse(file.questions)
const slotOf = (id: string) => bank.find((q) => q.id === id)!

function build(generatorId: string, slotId: string, n = 300, prefix = 'structure'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  return Array.from({ length: n }, (_, i) => generate(g, slotOf(slotId), `${prefix}-${i}`))
}
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const accepts = (b: Generated, typed: string) => mark(b.question, typed).correct
const methods = (b: Generated) => b.question.markScheme.slice(0, -1).map((l) => l.description)
function share<T>(built: T[], key: (b: T) => unknown) {
  const counts = new Map<unknown, number>()
  for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / built.length, distinct: counts.size }
}
/** The first build, over many seeds, that passes `ok`. */
function find(generatorId: string, slotId: string, ok: (b: Generated) => boolean) {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  for (let i = 0; i < 50000; i++) {
    const b = generate(g, slotOf(slotId), `find-${i}`)
    if (ok(b)) return b
  }
  throw new Error('none found')
}

const SLOTS: [string, string][] = [
  ['ascii-code-from-known', 'q3'],
  ['ascii-code-from-known', 'q5'],
  ['ascii-code-from-known', 'q6'],
  ['ascii-text-bits', 'q14'],
]

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const DIGITS = '0123456789'
const SUFFIX = (n: number) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')

/** The given character, its code and the target, read from the prompt; the codes from the written tables: A 65, a 97, 0 48. */
function counting(b: Generated, alphabet: string, start: number) {
  const p = b.question.prompt
  const codes = [...p.matchAll(/\b\d{2,3}\b/g)].map((m) => Number(m[0]))
  expect(codes, p).toHaveLength(1)
  const code = codes[0]!
  const given = alphabet[code - start]!
  const named = alphabet === DIGITS
    ? [...p.matchAll(/(?:character|digit) (\d)\b/g)].map((m) => m[1]!)
    : // The letter prompts have no article "a" or "A", so every one-letter word is a letter named.
      [...p.matchAll(/(?<![\w-])([A-Za-z])(?![\w-])/g)].map((m) => m[1]!).filter((c) => alphabet.includes(c))
  const others = [...new Set(named)].filter((c) => c !== given)
  expect(named, p).toContain(given)
  expect(others, p).toHaveLength(1)
  const target = others[0]!
  return { code, given, target, gi: alphabet.indexOf(given), ti: alphabet.indexOf(target), want: code + alphabet.indexOf(target) - alphabet.indexOf(given) }
}

describe('every ASCII build', () => {
  it('cites 3.3.5 and leaves q2 and q7 written', () => {
    const header = readFileSync(join(import.meta.dirname, 'ascii.ts'), 'utf8').split('const TOPIC')[0]!
    expect(header).toContain('3.3.5')
    expect(header).toContain('q2 (128 characters) and q7 (the gap of 32 between the cases) are facts to recall')
  })

  it('has a generator for each numeric slot but q2 and q7, routed by slot', () => {
    expect(asciiGenerators.flatMap((g) => g.replaces).sort()).toEqual(['q14', 'q3', 'q5', 'q6'])
    expect(bank.filter((q) => q.type === 'numeric').map((q) => q.id).sort()).toEqual(['q14', 'q2', 'q3', 'q5', 'q6', 'q7'])
    for (const g of asciiGenerators) expect(() => g.build(() => 0.5, slotOf('q2'), 0)).toThrow(/no builder/)
  })

  it("keeps the slot's units, tolerance and mark-scheme codes, and agrees with its second route", () => {
    for (const [id, slotId] of SLOTS) {
      const slot = slotOf(slotId)
      for (const b of build(id, slotId, 150)) {
        const q = b.question
        if (q.type !== 'numeric' || slot.type !== 'numeric') throw new Error('not numeric')
        expect(q.units).toBe(slot.units)
        expect(q.tolerance).toBe(0)
        expect(Number.isInteger(q.answer)).toBe(true)
        expect(q.markScheme.map((l) => l.code)).toEqual(slot.markScheme.map((l) => l.code))
        expect(b.check.agrees, b.seed).toBe(true)
      }
    }
  })

  it('is marked right typed plain and with its unit, wrong one off', () => {
    for (const [id, slotId] of SLOTS) {
      for (const b of build(id, slotId, 100)) {
        const a = answer(b)
        expect(accepts(b, String(a))).toBe(true)
        if (slotId === 'q14') expect(accepts(b, `${a} bits`)).toBe(true)
        expect(accepts(b, String(a + 1))).toBe(false)
        expect(accepts(b, String(a - 1))).toBe(false)
      }
    }
  })

  it('never fails to draw, over 3000 seeds per slot', () => {
    for (const [id, slotId] of SLOTS) {
      const g = GENERATORS.find((x) => x.id === id)!
      expect(() => {
        for (let i = 0; i < 3000; i++) generate(g, slotOf(slotId), `throw-${i}`)
      }, `${id} ${slotId}`).not.toThrow()
    }
  })

  it('gives the written prompt in under 5% of builds, no prompt in over 5%, and spreads answers and calculations', () => {
    for (const [id, slotId] of SLOTS) {
      const many = build(id, slotId, 1000, 'spread')
      expect(share(many, (b) => b.question.prompt).worst, `${slotId} prompt`).toBeLessThan(0.05)
      expect(many.filter((b) => b.question.prompt === slotOf(slotId).prompt).length, slotId).toBeLessThan(50)
      const answers = share(many, answer)
      expect(answers.worst, `${slotId} answer`).toBeLessThanOrEqual(0.4)
      expect(answers.distinct, `${slotId} answers`).toBeGreaterThanOrEqual(10)
      // One calculation: the codes counted for q3–q6, the character count alone for q14 (the text does not change n × 7).
      const calc = (b: Generated) => (slotId === 'q14' ? b.values.characters : `${b.values.given}|${b.values.target}`)
      expect(share(many, calc).worst, `${slotId} calculation`).toBeLessThan(1 / 6)
    }
  })
})

describe('counting on within a group (3.3.5)', () => {
  it('q3: capitals, from a given letter that is not always A, on or back', () => {
    const built = build('ascii-code-from-known', 'q3')
    for (const b of built) {
      const c = counting(b, UPPER, 65)
      const k = Math.abs(c.ti - c.gi)
      expect(answer(b), b.question.prompt).toBe(c.want)
      expect(c.want).toBeGreaterThanOrEqual(65)
      expect(c.want).toBeLessThanOrEqual(90)
      expect(k).toBeGreaterThanOrEqual(2)
      expect(k).toBeLessThanOrEqual(10)
      expect(methods(b)).toEqual([`${k} places ${c.ti > c.gi ? 'on' : 'back'} from ‘${c.given}’`])
      expect(b.question.solution).toContain(`‘${c.target}’ is the ${c.ti + 1}${SUFFIX(c.ti + 1)} letter`)
      // Every letter in quotes, as the specification prints ‘A’: no capital stands alone to read as a word.
      expect(b.question.prompt).toContain(`‘${c.given}’`)
      expect(b.question.prompt).toContain(`‘${c.target}’`)
      expect(b.question.prompt.replace(/‘[A-Z]’/g, '')).not.toMatch(/(?<![\w-])[A-Z](?![\w-])/)
      expect(b.question.solution).toContain(`$${c.code} ${c.ti > c.gi ? '+' : '-'} ${k} = $ **${c.want}**.`)
      // Wrong routes: off by one (A as the 1st letter counted in), the letter's place in the alphabet, the other case, the given code.
      for (const wrong of [c.want + 1, c.want - 1, c.ti + 1, c.want + 32, c.code]) expect(accepts(b, String(wrong))).toBe(false)
    }
    expect(share(built, (b) => b.values.given).distinct).toBeGreaterThanOrEqual(20)
    expect(built.filter((b) => b.values.given === 'A').length / built.length).toBeLessThan(0.1)
    const back = built.filter((b) => Number(b.values.step) < 0).length / built.length
    expect(back).toBeGreaterThan(0.2)
    expect(back).toBeLessThan(0.4)
  })

  it('q3: the written count reads as the written solution', () => {
    const b = find('ascii-code-from-known', 'q3', (x) => x.values.given === 'A' && x.values.target === 'D')
    expect(b.question.solution).toBe('‘D’ is the 4th letter, so **3** places on from ‘A’. $65 + 3 = $ **68**. The capital letters run in sequence, so the code goes up by 1 for each letter along the alphabet.')
    expect(methods(b)).toEqual(['3 places on from ‘A’'])
  })

  it('q5: lower case, never h, r or t (q19 and q21 on the higher sheet read 104, 114 and 116)', () => {
    const built = build('ascii-code-from-known', 'q5')
    for (const b of built) {
      const c = counting(b, LOWER, 97)
      const k = Math.abs(c.ti - c.gi)
      expect(answer(b), b.question.prompt).toBe(c.want)
      expect(c.want).toBeGreaterThanOrEqual(97)
      expect(c.want).toBeLessThanOrEqual(122)
      expect(k).toBeGreaterThanOrEqual(4)
      expect(k).toBeLessThanOrEqual(20)
      expect('hrt').not.toContain(c.given)
      expect('hrt').not.toContain(c.target)
      expect(b.question.prompt).not.toMatch(/\b(?:104|114|116)\b/)
      expect(b.question.solution).not.toMatch(/\b(?:104|114|116)\b/)
      // Nothing about the gap between the cases: q7 asks it on the same sheet.
      expect(b.question.prompt + b.question.solution).not.toMatch(/\b32\b|capital/)
      expect(methods(b)).toEqual([`${k} places ${c.ti > c.gi ? 'on' : 'back'} from ‘${c.given}’`])
      // Every lower case letter in quotes, as the specification prints ‘A’.
      expect(b.question.prompt).toContain(`‘${c.given}’`)
      expect(b.question.prompt).toContain(`‘${c.target}’`)
      expect(b.question.prompt.replace(/‘[a-z]’/g, '')).not.toMatch(/(?<![\w-])[a-z](?![\w-])/)
      for (const wrong of [c.want + 1, c.want - 1, c.ti + 1, c.want - 32, c.code]) expect(accepts(b, String(wrong))).toBe(false)
    }
    expect(share(built, (b) => b.values.given).distinct).toBeGreaterThanOrEqual(18)
    expect(built.filter((b) => b.values.given === 'a').length / built.length).toBeLessThan(0.1)
    const b = find('ascii-code-from-known', 'q5', (x) => x.values.given === 'a' && x.values.target === 'q')
    expect(b.question.solution.startsWith('‘q’ is the 17th letter, so **16** places on from ‘a’. $97 + 16 = $ **113**.')).toBe(true)
    expect(b.question.prompt).toMatch(/^(?:In ASCII the code for ‘a’ is 97\. What is the code for ‘q’\?|The ASCII code for the lower case letter ‘a’ is 97, and the lower case letters run in sequence\. What is the ASCII code for ‘q’\?|Given that ‘a’ has the ASCII code 97, what is the ASCII code for ‘q’\?)$/)
  })

  it('q6: digit characters, from a given digit that is not always 0; the character, not the value', () => {
    const built = build('ascii-code-from-known', 'q6')
    for (const b of built) {
      const c = counting(b, DIGITS, 48)
      const t = Number(c.target)
      const k = Math.abs(c.ti - c.gi)
      expect(answer(b), b.question.prompt).toBe(c.want)
      expect(c.want).toBe(48 + t)
      expect(k).toBeGreaterThanOrEqual(2)
      expect(methods(b)).toEqual([`${c.code} ${c.ti > c.gi ? '+' : '−'} ${k}`])
      expect(b.question.solution).toContain(`That is the code for the **character** ${t}, not the value ${t}.`)
      if (c.gi !== 0) expect(b.question.solution).toContain(`so the character ${t} is ${k} places ${c.ti > c.gi ? 'on' : 'back'} from the character ${c.given}: $`)
      // Wrong routes: the value itself, off by one, and the target's value added to or taken off a code that is not 0's.
      const wrongs = [t, c.want + 1, c.want - 1, ...(c.gi === 0 ? [] : [c.code + t, c.code - t])]
      for (const wrong of wrongs) expect(accepts(b, String(wrong))).toBe(false)
    }
    const zero = built.filter((b) => b.values.given === 0).length / built.length
    expect(zero).toBeLessThan(0.15)
    expect(share(built, (b) => b.values.given).distinct).toBe(10)
    const b = find('ascii-code-from-known', 'q6', (x) => x.values.given === 0 && x.values.target === 5)
    expect(b.question.solution).toBe(slotOf('q6').solution)
  })

  it('q5 and q6 on one higher sheet count in their own groups', () => {
    const higher = file.worksheets.higher.questionIds as string[]
    const written = higher.map((id) => slotOf(id))
    for (let i = 0; i < 200; i++) {
      const sheet = sheetQuestions('computer-science', TOPIC, written, `sheet-${i}`)
      const q5 = sheet.find((s) => s.question.id === 'q5')!.question
      const q6 = sheet.find((s) => s.question.id === 'q6')!.question
      expect(q5.type === 'numeric' && q5.answer >= 97 && q5.answer <= 122).toBe(true)
      expect(q6.type === 'numeric' && q6.answer >= 48 && q6.answer <= 57).toBe(true)
    }
  })
})

describe('text and storage (3.3.5, 7-bit ASCII)', () => {
  /** The quoted text, re-encoded a character at a time in 7 bits. */
  function bits(b: Generated) {
    const text = /"([^"]+)"/.exec(b.question.prompt)![1]!
    let out = ''
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i)
      expect(code).toBeLessThan(128)
      expect(code).toBeGreaterThanOrEqual(32)
      out += code.toString(2).padStart(7, '0')
    }
    return { text, n: text.length, bits: out.length }
  }

  it('q14: every character, spaces, digits and marks included, at 7 bits each', () => {
    const built = build('ascii-text-bits', 'q14')
    for (const b of built) {
      const { text, n, bits: total } = bits(b)
      expect(answer(b)).toBe(total)
      expect(n).toBeGreaterThanOrEqual(3)
      expect(b.question.prompt).toContain('7-bit ASCII')
      expect(methods(b)).toEqual([`${n} characters × 7 bits`])
      expect(b.question.solution).toContain(`$${n} \\times 7 = $ **${total}** bits.`)
      expect(b.question.solution).toContain(`"${text}" has ${n} characters`)
      if (text.includes(' ')) expect(b.question.solution).toContain('the space')
      // A figure in the text never equals the answer.
      // A figure in the text never equals the answer, the character count or the 7 bits.
      for (const f of text.match(/\d+/g) ?? []) expect([total, n, 7]).not.toContain(Number(f))
      // Wrong routes: ASCII at 8 bits, the space left out, only the letters counted.
      const spaces = text.split(' ').length - 1
      const letters = (text.match(/[A-Za-z]/g) ?? []).length
      expect(accepts(b, String(8 * n))).toBe(false)
      if (spaces) expect(accepts(b, String(7 * (n - spaces)))).toBe(false)
      if (letters !== n) expect(accepts(b, String(7 * letters))).toBe(false)
      expect(b.question.prompt).not.toMatch(/cheese|Unicode/i)
    }
    const spaced = built.filter((b) => /"[^"]* [^"]*"/.test(b.question.prompt)).length / built.length
    expect(spaced).toBeGreaterThan(0.2)
    expect(new Set(built.map((b) => b.values.kind))).toEqual(new Set(['word', 'text', 'password', 'name']))
  })

  it('q14: the written word reads as written', () => {
    const b = find('ascii-text-bits', 'q14', (x) => x.values.text === 'Dog')
    expect(b.question.solution).toBe('"Dog" has 3 characters at 7 bits each: $3 \\times 7 = $ **21** bits. The capital and the lower case letters take the same space: the case changes the code, not the size.')
    const s = find('ascii-text-bits', 'q14', (x) => x.values.text === 'Hi Sam')
    expect(s.question.solution).toBe('"Hi Sam" has 6 characters (H, i, the space, S, a, m), each at 7 bits: $6 \\times 7 = $ **42** bits. The capital and the lower case letters take the same space: the case changes the code, not the size. The space is a character with its own code, so it is stored like any other.')
  })

  it('every text is printable ASCII, three characters or more, with no quotation mark', () => {
    for (const [n, list] of Object.entries(ASCII.TEXTS)) {
      expect(list.length, n).toBeGreaterThanOrEqual(6)
      for (const [t] of list) {
        expect(t.length).toBe(Number(n))
        expect(t).toMatch(/^[ -~]{3,}$/)
        expect(t).not.toMatch(/["']/)
        for (const f of t.match(/\d+/g) ?? []) expect([t.length, 7, 7 * t.length]).not.toContain(Number(f))
      }
    }
    expect(Object.keys(ASCII.TEXTS).map(Number)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })
})
