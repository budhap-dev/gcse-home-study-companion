import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { rng } from '../random.ts'
import { GENERATORS, generate, sheetQuestions } from '../index.ts'
import type { Generated } from '../types.ts'
import { compressionGenerators, huffman, LONG_WORDS, PHRASES, Q11_WORDS, Q7_WORDS, SAVING_WORDS, SHORT_WORDS, WORDS } from './compression.ts'

/**
 * Structural tests for the data-compression generators (AQA 8525 3.3.8). Each reads the prompt
 * back with its own parsing (the row, the word, the codes), works the answer again without the
 * generator's code (runs counted by a regular expression, letters counted afresh, the least
 * Huffman total found by trying every set of code lengths), checks printed lines literally, that
 * the named wrong routes are marked wrong, and the spread over builds.
 */
const TOPIC = 'data-compression'
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/computer-science')
const topic = JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8'))
const bank = Question.array().parse(topic.questions)
const written = (id: string) => bank.find((q) => q.id === id)!
const sheet = (level: string) => (topic.worksheets[level].questionIds as string[]).map(written)

function build(generatorId: string, slotId: string, count = 300, prefix = 'structure'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  return Array.from({ length: count }, (_, i) => generate(g, written(slotId), `${prefix}-${i}`))
}

const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)

function share(built: Generated[], key: (b: Generated) => unknown) {
  const counts = new Map<unknown, number>()
  for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / built.length, distinct: counts.size }
}

/** Letter counts, written here rather than imported. */
function counts(word: string): Map<string, number> {
  const m = new Map<string, number>()
  for (const c of word) m.set(c, (m.get(c) ?? 0) + 1)
  return m
}

/**
 * The least number of bits any prefix code can store `word` in, by trying every set of code
 * lengths 1 to 5 that fits a binary tree (Kraft: the sum of 2^-length is at most 1). Huffman's
 * total must equal it.
 */
function leastBits(word: string): number {
  const f = [...counts(word).values()]
  let best = Infinity
  const rec = (i: number, kraft: number, bits: number) => {
    if (kraft > 1 + 1e-12 || bits >= best) return
    if (i === f.length) {
      best = bits
      return
    }
    for (let len = 1; len <= 5; len++) rec(i + 1, kraft + 2 ** -len, bits + f[i]! * len)
  }
  rec(0, 0, 0)
  return best
}

/** The codes as printed: **a** = 0, **n** = 11 and **b** = 10. */
function readCodes(prompt: string): Map<string, string> {
  return new Map([...prompt.matchAll(/\*\*([a-z])\*\* = ([01]+)/g)].map((m) => [m[1]!, m[2]!]))
}
const bold = (s: string) => [...s.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1]!)
const WORD_FOR = { once: 1, twice: 2, three: 3, four: 4, five: 5, six: 6 } as Record<string, number>

/** A prefix code with no gaps: no code starts another, and the lengths fill the tree (Kraft sum 1). */
function isFullPrefixCode(codes: string[]): boolean {
  const prefixFree = codes.every((a) => codes.every((b) => a === b || !b.startsWith(a)))
  return prefixFree && Math.abs(codes.reduce((s, c) => s + 2 ** -c.length, 0) - 1) < 1e-12
}

function marksTyped(b: Generated) {
  const a = answer(b)
  for (const t of [String(a), ` ${a} `, `${a} bits`]) expect(mark(b.question, t).correct, `${b.seed}: ${t}`).toBe(true)
}

describe('data-compression generators', () => {
  it('cover every numeric written slot but q21, which reads the drawn tree for cheese', () => {
    expect(compressionGenerators.flatMap((g) => g.replaces).sort()).toEqual(['q11', 'q12', 'q15', 'q2', 'q4', 'q7', 'q9'])
    expect(bank.filter((q) => q.type === 'numeric').map((q) => q.id).sort()).toEqual(['q11', 'q12', 'q15', 'q2', 'q21', 'q4', 'q7', 'q9'])
    for (const g of compressionGenerators) expect(g.subjectId).toBe('computer-science')
  })

  it('keeps each slot\'s marks, codes, units and exact tolerance, agrees by a second route, and never fails to draw over 3000 seeds', () => {
    for (const g of compressionGenerators) {
      for (const id of g.replaces) {
        const slot = written(id)
        for (let i = 0; i < 3000; i++) {
          const b = generate(g, slot, `throw-${i}`)
          expect(b.check.agrees, `${id} ${b.seed}: ${b.check.detail}`).toBe(true)
          if (i >= 300) continue
          const q = b.question
          if (q.type !== 'numeric' || slot.type !== 'numeric') throw new Error('not numeric')
          expect(q.units).toBe(slot.units)
          expect(q.tolerance).toBe(0)
          expect(Number.isInteger(q.answer) && q.answer > 0).toBe(true)
          expect(q.markScheme.map((l) => l.code)).toEqual(slot.markScheme.map((l) => l.code))
          marksTyped(b)
          expect(mark(q, String(q.answer + 1)).correct).toBe(false)
          expect(JSON.stringify(q)).not.toMatch(/cheese/)
        }
      }
    }
  })

  it('repeats no prompt in a twentieth of 1000 builds, and the written one in at most a hundredth', () => {
    for (const g of compressionGenerators) {
      for (const id of g.replaces) {
        const built = build(g.id, id, 1000, 'release')
        const s = share(built, (b) => b.question.prompt)
        expect(s.worst, id).toBeLessThanOrEqual(0.05)
        expect(s.distinct, id).toBeGreaterThan(100)
        expect(built.filter((b) => b.question.prompt === written(id).prompt).length, id).toBeLessThanOrEqual(10)
      }
    }
  })
})

describe('the word lists', () => {
  it('are real words of 6 to 11 letters with 3 to 5 distinct letters and at least two repeats', () => {
    for (const w of WORDS) {
      expect(w, w).toMatch(/^[a-z]{6,11}$/)
      const d = counts(w).size
      expect(d >= 3 && d <= 5 && w.length - d >= 2, w).toBe(true)
    }
    const all = [...SHORT_WORDS, ...WORDS, ...LONG_WORDS]
    expect(new Set(all).size).toBe(all.length)
    for (const w of SHORT_WORDS) {
      expect(w, w).toMatch(/^[a-z]{5}$/)
      expect(counts(w).size, w).toBeLessThan(5)
    }
    for (const w of LONG_WORDS) {
      expect(w, w).toMatch(/^[a-z]{9,13}$/)
      expect(counts(w).size, w).toBeLessThan(w.length)
    }
    for (const p of PHRASES) {
      // Exactly one space: the prompts and solutions say "the space".
      expect(p, p).toMatch(/^[a-z]+ [a-z]+$/)
      expect(p, p).not.toMatch(/chess|cheese/)
      const letters = p.replace(/ /g, '')
      expect(counts(letters).size, p).toBeLessThan(letters.length)
    }
  })

  it('keep the advanced sheet clear of banana (q14), mississippi (q18) and success (the written q12, 49 − 13)', () => {
    for (const w of [...Q11_WORDS, ...SAVING_WORDS]) expect(['banana', 'bananas', 'mississippi', 'cheese', 'success']).not.toContain(w)
    for (const w of SAVING_WORDS) expect(w.length === 7 && leastBits(w) === 13, w).toBe(false)
    expect(Q7_WORDS).not.toContain('cheese')
  })

  it('keep q7 and q11 clear of a flat 2-bit total and q7 clear of q21\'s 3, 1, 1, 1 over six letters', () => {
    for (const w of [...Q7_WORDS, ...Q11_WORDS]) expect(leastBits(w), w).not.toBe(2 * w.length)
    for (const w of Q7_WORDS) expect(w.length === 6 && [...counts(w).values()].sort().join() === '1,1,1,3', w).toBe(false)
  })
})

describe('Huffman trees', () => {
  it('give the written totals: banana 9, mississippi 21, cheese 11', () => {
    expect(huffman(rng('a'), 'banana').total).toBe(9)
    expect(huffman(rng('b'), 'mississippi').total).toBe(21)
    expect(huffman(rng('c'), 'cheese').total).toBe(11)
    const banana = huffman(rng('d'), 'banana').codes
    expect([banana.a!.length, banana.n!.length, banana.b!.length]).toEqual([1, 2, 2])
  })

  it('give a full prefix code of least total length for every word, whatever the tie-break', () => {
    for (const w of WORDS) {
      const least = leastBits(w)
      for (let i = 0; i < 20; i++) {
        const h = huffman(rng(`${w}-${i}`), w)
        const codes = Object.values(h.codes)
        expect(isFullPrefixCode(codes), `${w}: ${JSON.stringify(h.codes)}`).toBe(true)
        expect(h.total, w).toBe(least)
        // Shorter codes for commoner letters.
        const f = counts(w)
        for (const [a, ca] of Object.entries(h.codes)) for (const [b, cb] of Object.entries(h.codes)) if (f.get(a)! > f.get(b)!) expect(ca.length).toBeLessThanOrEqual(cb.length)
      }
    }
  })
})

describe('q2: run length encoding pairs', () => {
  const built = build('cs-rle-pairs', 'q2')

  /** The row as printed: a comma list, a bit string in code, or a bold text. */
  function row(prompt: string): string {
    const list = /the row ((?:[01], )+[01]) using/.exec(prompt)
    if (list) return list[1]!.replace(/, /g, '')
    const bits = /`([01]+)`/.exec(prompt)
    if (bits) return bits[1]!
    return bold(prompt)[0]!
  }

  it('counts the runs in the printed row, and the solution lists them as pairs', () => {
    for (const b of built) {
      const r = row(b.question.prompt)
      const runs = r.match(/(.)\1*/g)!
      expect(answer(b), b.seed).toBe(runs.length)
      expect(r.length).toBeGreaterThanOrEqual(6)
      expect(r.length).toBeLessThanOrEqual(16)
      // At least one run of a single value, as the written row ends with one 0.
      expect(runs.some((x) => x.length === 1)).toBe(true)
      const pairs = runs.map((x) => `${x.length} ${x[0]}`).join(' ')
      expect(b.question.solution, b.seed).toContain(`That is **${runs.length}** pairs: ${pairs}.`)
    }
  })

  it('names the wrong routes: runs of one value only, the row length, the distinct values, the changes', () => {
    for (const b of built) {
      const r = row(b.question.prompt)
      const runs = r.match(/(.)\1*/g)!
      const a = answer(b)
      const ofFirst = runs.filter((x) => x[0] === runs[0]![0]).length
      for (const wrong of [ofFirst, runs.length - ofFirst, r.length, new Set(r).size, runs.length - 1, 2 * runs.length, runs.filter((x) => x.length > 1).length]) {
        expect(wrong, b.seed).not.toBe(a)
      }
    }
  })

  it('prints the literal solution for a known row', () => {
    const b = generate(GENERATORS.find((g) => g.id === 'cs-rle-pairs')!, written('q2'), 'review-c')
    expect(b.question.prompt).toBe('How many frequency/data pairs are needed to encode the row 1, 0, 1, 0, 0, 0 using run length encoding?')
    expect(b.question.solution).toBe('Four runs: one 1, one 0, one 1, then three 0s. That is **4** pairs: 1 1 1 0 1 1 3 0.')
  })

  it('spreads the answers, the row lengths and the forms', () => {
    const s = share(built, answer)
    expect(s.distinct).toBe(8)
    expect(s.worst).toBeLessThan(0.2)
    expect(share(built, (b) => row(b.question.prompt).length).distinct).toBeGreaterThanOrEqual(10)
    // Rows at the written scale (6 to 8 values) are common, and long rows are not the rule.
    const short = built.filter((b) => row(b.question.prompt).length <= 8).length / built.length
    const long = built.filter((b) => row(b.question.prompt).length >= 12).length / built.length
    expect(short).toBeGreaterThan(0.18)
    expect(long).toBeLessThan(0.4)
    expect(share(built, (b) => b.values.form).distinct).toBe(3)
  })
})

describe('q4 and q9: ASCII bits', () => {
  for (const id of ['q4', 'q9']) {
    const built = build('cs-ascii-bits', id)

    it(`${id}: is 7 bits for every character of the printed text, the space included`, () => {
      for (const b of built) {
        const [text] = bold(b.question.prompt)
        const t = text!.toLowerCase()
        // Letters and spaces counted with this test's own expressions.
        const letters = (t.match(/[a-z]/g) ?? []).length
        const spaces = (t.match(/ /g) ?? []).length
        expect(letters + spaces).toBe(t.length)
        expect(spaces).toBeLessThanOrEqual(1)
        expect(answer(b), b.seed).toBe(7 * (letters + spaces))
        if (id === 'q4') expect(b.question.prompt, b.seed).toMatch(new RegExp(`\\b${t.length}\\b`))
        // Wrong routes: distinct characters, 8 bits a character, the space forgotten, the letters counted short.
        const wrong = [7 * new Set(t).size, 8 * t.length, 7 * t.replace(/ /g, '').length - (t.includes(' ') ? 0 : 7), 7 * (t.length + 1)]
        for (const w of wrong) expect(w, b.seed).not.toBe(answer(b))
        expect(b.question.solution).toContain(`${t.length} × 7 = **${7 * t.length}** bits.`)
      }
    })

    it(`${id}: spreads the answers and uses words most of the time`, () => {
      const s = share(built, answer)
      expect(s.distinct).toBe(10)
      expect(s.worst).toBeLessThan(0.15)
      expect(built.some((b) => answer(b) === 35) && built.some((b) => answer(b) === 98)).toBe(true)
      const phrases = built.filter((b) => bold(b.question.prompt)[0]!.includes(' ')).length / built.length
      expect(phrases).toBeGreaterThan(0.15)
      expect(phrases).toBeLessThan(0.5)
    })
  }

  it('q9 says a two-word text counts its space, and its solution counts it', () => {
    const g = GENERATORS.find((x) => x.id === 'cs-ascii-bits')!
    for (const b of build(g.id, 'q9')) {
      const [text] = bold(b.question.prompt)
      if (!text!.includes(' ')) continue
      const letters = (text!.match(/[a-z]/g) ?? []).length
      expect((text!.match(/ /g) ?? []).length).toBe(1)
      expect(b.question.prompt).toMatch(/space/)
      expect(b.question.solution).toContain(`The text **${text}** has ${letters} letters and one space, so ${letters + 1} characters.`)
    }
  })
})

describe('q7 and q11: Huffman bits', () => {
  for (const id of ['q7', 'q11']) {
    const built = build('cs-huffman-bits', id)

    it(`${id}: prints a Huffman code for the word's own letters and adds frequency × length`, () => {
      for (const b of built) {
        const q = b.question
        const word = bold(q.prompt).find((s) => s.length > 1)!
        const codes = readCodes(q.prompt)
        const f = counts(word)
        expect([...codes.keys()].sort(), b.seed).toEqual([...f.keys()].sort())
        expect(isFullPrefixCode([...codes.values()]), b.seed).toBe(true)
        // Every frequency printed (q11) is the word's own.
        if (id === 'q11') {
          const printed = [...q.prompt.matchAll(/\*\*([a-z])\*\* (once|twice|three|four|five|six)\b/g)]
          expect(printed.length).toBe(f.size)
          for (const m of printed) expect(WORD_FOR[m[2]!], `${b.seed} ${m[0]}`).toBe(f.get(m[1]!))
        }
        let total = 0
        for (const [c, n] of f) {
          const len = codes.get(c)!.length
          total += n * len
          expect(q.solution, b.seed).toContain(`**${c}**: ${n} × ${len} = ${n * len}`)
        }
        expect(answer(b), b.seed).toBe(total)
        expect(total, b.seed).toBe(leastBits(word))
        // Wrong routes: each distinct letter's code length counted once (not weighted by frequency),
        // every letter at 1 bit, ASCII, and the frequencies against the codes the wrong way round.
        const lens = [...codes.values()].map((c) => c.length)
        const freqsDown = [...f.values()].sort((a, b) => b - a)
        const lensDown = [...lens].sort((a, b) => b - a)
        const reversed = freqsDown.reduce((s, n, i) => s + n * lensDown[i]!, 0)
        // Also a flat 2-bit code (2n) and every letter priced at the longest code (distinct × longest).
        const wrong = [lens.reduce((s, x) => s + x, 0), word.length, 7 * word.length, 2 * word.length, f.size * Math.max(...lens)]
        if (new Set(lens).size > 1 && new Set(f.values()).size > 1) wrong.push(reversed)
        for (const w of wrong) expect(w, `${b.seed} ${word}`).not.toBe(total)
        // No code printed reads as the answer, and c = 110 (q23's answer, cheese) never prints.
        for (const c of codes.values()) expect(Number(c)).not.toBe(total)
        expect(codes.get('c')).not.toBe('110')
      }
    })

    it(`${id}: spreads the answers and the words`, () => {
      const s = share(built, answer)
      expect(s.distinct).toBeGreaterThanOrEqual(8)
      expect(s.worst).toBeLessThan(0.4)
      expect(share(built, (b) => b.values.word).worst).toBeLessThan(1 / 6)
      expect(share(built, (b) => b.values.word).distinct).toBeGreaterThan(40)
      // q21's cheese is 11 bits on the higher sheet: q7 gives 11 no more than a fair share.
      if (id === 'q7') expect(built.filter((b) => answer(b) === 11).length / built.length).toBeLessThan(0.15)
    })
  }

  it('q7 and q11 keep their written letter counts: 3 or 4 letters on q7, 4 or 5 on q11, and the scheme says how many totals', () => {
    for (const b of build('cs-huffman-bits', 'q7')) expect([3, 4]).toContain(counts(String(b.values.word)).size)
    for (const b of build('cs-huffman-bits', 'q11')) {
      const n = counts(String(b.values.word)).size
      expect([4, 5]).toContain(n)
      expect(b.question.markScheme[1]!.description).toBe(`adds the ${n === 4 ? 'four' : 'five'} totals`)
    }
  })

  it('prints the literal working for a known build', () => {
    const b = generate(GENERATORS.find((g) => g.id === 'cs-huffman-bits')!, written('q7'), 'review-a')
    expect(b.question.prompt).toBe('The word **mammal** is compressed with Huffman coding, using the codes **m** = 0, **a** = 11 and **l** = 10. How many bits does the compressed word need?')
    expect(b.question.solution).toBe(
      'Count each letter in **mammal**: **m** three times, **a** twice and **l** once. Then frequency × code length: **m**: 3 × 1 = 3, **a**: 2 × 2 = 4, **l**: 1 × 2 = 2. Altogether 3 + 4 + 2 = **9** bits.',
    )
    expect(b.question.markScheme.map((l) => l.description)).toEqual(['multiplies each frequency by its code length: 3 × 1, 2 × 2 and 1 × 2', '9'])
  })
})

describe('q12 and q15: bits saved', () => {
  for (const id of ['q12', 'q15']) {
    const built = build('cs-huffman-bits', id)

    it(`${id}: states the word's true Huffman and ASCII counts and subtracts`, () => {
      for (const b of built) {
        const q = b.question
        const word = bold(q.prompt)[0]!
        const H = Number(/(\d+) bits with Huffman|it takes (\d+) bits\./.exec(q.prompt)!.slice(1).find(Boolean))
        const A = Number(/(\d+) bits in ASCII|takes (\d+) bits\. Compressed/.exec(q.prompt)!.slice(1).find(Boolean))
        expect(A, b.seed).toBe(7 * word.length)
        expect(H, b.seed).toBe(leastBits(word))
        expect(answer(b)).toBe(A - H)
        // Wrong routes: Huffman − ASCII, ASCII at 8 bits, the saving equal to a printed figure.
        for (const w of [H - A, 8 * word.length - H, H, A]) expect(w, b.seed).not.toBe(answer(b))
        expect(q.solution).toContain(`${A} − ${H} = **${A - H}** bits saved.`)
        if (id === 'q15') expect(q.markScheme[0]!.description).toBe(`subtracts ${H} from ${A}`)
        else expect(q.markScheme[0]!.description).toBe('subtracts the compressed size from the ASCII size')
      }
    })

    it(`${id}: spreads the answers and the words`, () => {
      const s = share(built, answer)
      expect(s.distinct).toBeGreaterThanOrEqual(15)
      expect(s.worst).toBeLessThan(0.4)
      expect(share(built, (b) => b.values.word).worst).toBeLessThan(1 / 6)
      // No one calculation (ASCII − Huffman) over a sixth, and the written 8-11-letter scale common.
      expect(share(built, (b) => `${b.values.ascii} − ${b.values.huffman}`).worst).toBeLessThan(1 / 6)
      expect(built.filter((b) => String(b.values.word).length >= 8).length / built.length).toBeGreaterThan(0.3)
    })
  }
})

describe('the sheets', () => {
  it('advanced: q11, q12 and q15 take three different words with three different Huffman counts', () => {
    const advanced = sheet('advanced')
    for (let i = 0; i < 300; i++) {
      const s = sheetQuestions('computer-science', TOPIC, advanced, `advanced-${i}`)
      const get = (id: string) => s.find((x) => x.question.id === id)!.generated!
      const [q11, q12, q15] = [get('q11'), get('q12'), get('q15')]
      expect(new Set([q11.values.word, q12.values.word, q15.values.word]).size).toBe(3)
      expect(new Set([q11.values.total, q12.values.huffman, q15.values.huffman]).size).toBe(3)
      for (const g of [q11, q12, q15]) expect(['banana', 'bananas', 'mississippi', 'cheese', 'success']).not.toContain(g.values.word)
      // The written q12 (success, 49 − 13 = 36) is never repeated by a generated one.
      for (const g of [q12, q15]) expect(`${g.values.ascii} − ${g.values.huffman}`).not.toBe('49 − 13')
    }
  })

  it('higher: q7 and q9 never use cheese, and q7 never prints c = 110', () => {
    const higher = sheet('higher')
    for (let i = 0; i < 300; i++) {
      const s = sheetQuestions('computer-science', TOPIC, higher, `higher-${i}`)
      for (const id of ['q7', 'q9']) {
        const q = s.find((x) => x.question.id === id)!
        expect(q.generated).toBeDefined()
        expect(q.question.prompt).not.toMatch(/cheese|\*\*c\*\* = 110/)
      }
    }
  })
})
