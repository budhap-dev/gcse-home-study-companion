import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { problemGenerators } from './problems.ts'

/**
 * Structural tests for problem-solving-and-algorithms q4 and q7: the averaging algorithm (add the
 * marks, divide by 3). Each reads the marks back, works the mean by its own arithmetic, checks the
 * printed working, literal lines, each slot's own feature (three different marks; a repeated mark
 * and one far from it), the named wrong routes and the spread.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/computer-science')
const BANK = Question.array().parse(JSON.parse(readFileSync(join(ROOT, 'problem-solving-and-algorithms.json'), 'utf8')).questions)
const slotOf = (id: string) => BANK.find((q) => q.id === id)!
const gen = GENERATORS.find((x) => x.id === 'cs-problem-mean')!
const build = (slotId: string, n = 300, prefix = 'structure') => Array.from({ length: n }, (_, i) => generate(gen, slotOf(slotId), `${prefix}-${i}`))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const lines = (b: Generated) => b.question.markScheme.map((l) => `${l.code} ${l.description}`)
const read = (b: Generated) => /marks (?:are )?(\d+), (\d+) and (\d+)/.exec(b.question.prompt)!.slice(1).map(Number)

function share<T>(built: Generated[], key: (b: Generated) => T) {
  const counts = new Map<T, number>()
  for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / built.length, distinct: counts.size }
}
/** Each wrong route as computed and as a student would type it rounded. */
function refuses(b: Generated, wrong: number[]) {
  for (const w of wrong) {
    for (const t of new Set([w, Math.round(w)])) {
      expect(t, `${b.seed}: wrong route ${w}`).not.toBe(answer(b))
      expect(mark(b.question, String(t)).correct, `${b.seed}: ${t}`).toBe(false)
    }
  }
}

describe('problem-solving-and-algorithms builds', () => {
  it('stand in for both numeric slots, q4 and q7, by one generator routed by slot', () => {
    expect(problemGenerators.map((g) => `${g.topicId}/${g.replaces.join(',')}`)).toEqual(['problem-solving-and-algorithms/q4,q7'])
    expect(BANK.filter((q) => q.type === 'numeric').map((q) => q.id)).toEqual(['q4', 'q7'])
  })

  for (const slotId of ['q4', 'q7']) {
    const slot = slotOf(slotId)
    it(`${slotId}: keeps the written codes, no units and exact tolerance, is marked right typed plain or spaced, and never fails to draw over 3000 seeds`, () => {
      for (let i = 0; i < 3000; i++) {
        const b = generate(gen, slot, `throw-${i}`)
        if (i >= 300) continue
        const q = b.question
        if (q.type !== 'numeric') throw new Error('not numeric')
        expect(q.units).toBeUndefined()
        expect(q.tolerance).toBe(0)
        // A lone mark is a B1, as every generator prints it (the written q4 calls it A1).
        expect(q.markScheme.map((l) => l.code)).toEqual(slot.marks === 1 ? ['B1'] : slot.markScheme.map((l) => l.code))
        expect(b.check.agrees, b.seed).toBe(true)
        for (const t of [String(q.answer), ` ${q.answer} `]) expect(mark(q, t).correct, `${b.seed}: ${t}`).toBe(true)
        expect(mark(q, String(q.answer + 1)).correct).toBe(false)
      }
    })

    it(`${slotId}: repeats no prompt in a twentieth of 1000 builds, and the written one in at most a fiftieth`, () => {
      const counts = new Map<string, number>()
      for (const b of build(slotId, 1000, 'release')) counts.set(b.question.prompt, (counts.get(b.question.prompt) ?? 0) + 1)
      expect(counts.size).toBeGreaterThan(100)
      expect(Math.max(...counts.values())).toBeLessThanOrEqual(50)
      expect(counts.get(slot.prompt) ?? 0).toBeLessThanOrEqual(20)
    })

    it(`${slotId}: answers the total divided by 3, a whole number, and prints both steps`, () => {
      for (const b of build(slotId)) {
        const m = read(b)
        const sum = m[0]! + m[1]! + m[2]!
        expect(sum % 3, b.seed).toBe(0)
        expect(answer(b), b.seed).toBe(sum / 3)
        const tail = slotId === 'q7' ? ' Running the same algorithm on different inputs is how you check it works in general.' : ''
        expect(b.question.solution, b.seed).toBe(`$${m[0]} + ${m[1]} + ${m[2]} = ${sum}$, and $${sum} \\div 3 = $ **${sum / 3}**.${tail}`)
        expect(lines(b)).toEqual(slotId === 'q7' ? [`M1 totals ${sum}`, `A1 ${sum / 3}`] : [`B1 ${sum / 3}`])
        for (const x of m) expect(x >= 1 && x <= 50, b.seed).toBe(true)
      }
    })
  }

  it('prints the written working for the written marks, and literal working', () => {
    const at = (slotId: string, seed: string) => generate(gen, slotOf(slotId), seed).question
    expect(at('q4', 'lit-a').prompt).toBe('An algorithm adds the marks 2, 6 and 19, then divides by 3. What does it output?')
    expect(at('q4', 'lit-a').solution).toBe('$2 + 6 + 19 = 27$, and $27 \\div 3 = $ **9**.')
    expect(at('q4', 'lit-b').prompt).toBe("A student's three test marks are 22, 7 and 10. An algorithm adds them up and then divides by 3. What does it output?")
    expect(at('q7', 'lit-a').solution).toBe('$42 + 27 + 27 = 96$, and $96 \\div 3 = $ **32**. Running the same algorithm on different inputs is how you check it works in general.')
    for (let i = 0; i < 20000; i++) {
      const b = generate(gen, slotOf('q7'), `written-${i}`)
      if (b.values.marks !== '10,10,40') continue
      expect(b.question.solution).toBe(slotOf('q7').solution)
      expect(lines(b)).toEqual(['M1 totals 60', 'A1 20'])
      return
    }
    throw new Error('the written marks 10, 10 and 40 never drawn')
  })
})

describe('q4: three different marks', () => {
  const built = build('q4')

  it('has three different marks, none of them the mean, so the middle mark never pays', () => {
    for (const b of built) {
      const m = read(b)
      expect(new Set(m).size, b.seed).toBe(3)
      expect(m, b.seed).not.toContain(answer(b))
      for (const x of m) expect(x >= 2 && x <= 40).toBe(true)
    }
  })

  it('refuses the total, the middle mark, the mean of the lowest and highest, the wrong count and the division done first', () => {
    for (const b of built) {
      const m = read(b)
      const sum = m[0]! + m[1]! + m[2]!
      const sorted = [...m].sort((x, y) => x - y)
      refuses(b, [sum, sorted[1]!, m[1]!, (sorted[0]! + sorted[2]!) / 2, sum / 2, sum / 4, m[0]! + m[1]! + m[2]! / 3])
    }
  })

  it('spreads answers and orders', () => {
    expect(share(built, answer).worst).toBeLessThan(0.1)
    expect(share(built, answer).distinct).toBeGreaterThan(18)
    const ascending = built.filter((b) => read(b).join() === [...read(b)].sort((x, y) => x - y).join()).length / built.length
    expect(ascending).toBeGreaterThan(0.45)
    expect(ascending).toBeLessThan(0.75)
  })
})

describe('q7: a repeated mark and one far from it', () => {
  const built = build('q7')
  const parts = (b: Generated) => {
    const m = read(b)
    const repeated = m.find((x, i) => m.indexOf(x) !== i)!
    const odd = m.find((x) => x !== repeated)!
    return { m, repeated, odd }
  }

  it('repeats one mark exactly twice, with the other at least 12 away, so the mean is neither', () => {
    for (const b of built) {
      const { m, repeated, odd } = parts(b)
      expect(m.filter((x) => x === repeated).length, b.seed).toBe(2)
      expect(Math.abs(odd - repeated), b.seed).toBeGreaterThanOrEqual(12)
      expect([repeated, odd]).not.toContain(answer(b))
    }
  })

  it('refuses the repeated mark, the repeat counted once, the total, the wrong count and the division done first', () => {
    for (const b of built) {
      const { m, repeated, odd } = parts(b)
      const sum = 2 * repeated + odd
      refuses(b, [repeated, (repeated + odd) / 2, sum, sum / 2, sum / 4, m[0]! + m[1]! + m[2]! / 3])
    }
  })

  it('spreads answers, puts the odd mark high about three times in four, and in every position', () => {
    expect(share(built, answer).worst).toBeLessThan(0.1)
    expect(share(built, answer).distinct).toBeGreaterThan(20)
    const high = built.filter((b) => parts(b).odd > parts(b).repeated).length / built.length
    expect(high).toBeGreaterThan(0.6)
    expect(high).toBeLessThan(0.9)
    expect(share(built, (b) => read(b).indexOf(parts(b).odd)).distinct).toBe(3)
  })
})
