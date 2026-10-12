import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { flowchartGenerators } from './flowcharts.ts'

/**
 * Structural tests for flow-charts-and-pseudo-code: q7 (a loop that doubles or triples until a
 * limit) and q10 (a running total). Each reads the prompt back, runs the loop with its own code,
 * checks the printed trace, literal lines, the named wrong routes and the spread.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/computer-science')
const TOPIC = 'flow-charts-and-pseudo-code'
const BANK = Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8')).questions)
const slotOf = (id: string) => BANK.find((q) => q.id === id)!
const SLOTS: Record<string, string> = { q7: 'cs-flowchart-growth', q10: 'cs-flowchart-total' }
const gen = (id: string) => GENERATORS.find((x) => x.id === id)!
const build = (slotId: string, n = 300, prefix = 'structure') => Array.from({ length: n }, (_, i) => generate(gen(SLOTS[slotId]!), slotOf(slotId), `${prefix}-${i}`))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const lines = (b: Generated) => b.question.markScheme.map((l) => `${l.code} ${l.description}`)

function share<T>(built: Generated[], key: (b: Generated) => T) {
  const counts = new Map<T, number>()
  for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / built.length, distinct: counts.size }
}
function refuses(b: Generated, wrong: number[]) {
  for (const w of wrong) {
    expect(w, `${b.seed}: wrong route ${w}`).not.toBe(answer(b))
    expect(mark(b.question, String(w)).correct, `${b.seed}: ${w}`).toBe(false)
  }
}

describe('flow-charts-and-pseudo-code builds', () => {
  it('stand in for q7 and q10, leaving q3 (a decision has two exits) written', () => {
    expect(flowchartGenerators.flatMap((g) => g.replaces).sort()).toEqual(['q10', 'q7'])
    expect(BANK.filter((q) => q.type === 'numeric').map((q) => q.id).sort()).toEqual(['q10', 'q3', 'q7'])
  })

  for (const slotId of Object.keys(SLOTS)) {
    const slot = slotOf(slotId)
    it(`${slotId}: keeps the written codes, no units and exact tolerance, is marked right typed plain or spaced, and never fails to draw over 3000 seeds`, () => {
      for (let i = 0; i < 3000; i++) {
        const b = generate(gen(SLOTS[slotId]!), slot, `throw-${i}`)
        if (i >= 300) continue
        const q = b.question
        if (q.type !== 'numeric') throw new Error('not numeric')
        expect(q.units).toBeUndefined()
        expect(q.tolerance).toBe(0)
        expect(q.markScheme.map((l) => l.code)).toEqual(slot.markScheme.map((l) => l.code))
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
  }
})

describe('q7: a loop that doubles or triples until a limit', () => {
  const built = build('q7')
  const read = (b: Generated) => {
    const p = b.question.prompt
    const by = /doubles/.test(p) ? 2 : /triples/.test(p) ? 3 : NaN
    const limit = Number(/[nxk] < (\d+)/.exec(p)![1])
    const start = Number(/(?:sets [nxk] to|starts with [nxk] =|[nxk] starts at) (\d+)/.exec(p)![1])
    const v = /([nxk]) < \d+/.exec(p)![1]!
    return { by, limit, start, v }
  }
  /** The loop by hand: test first, then multiply. */
  const run = (start: number, by: number, limit: number) => {
    const seen = [start]
    while (seen.at(-1)! < limit) seen.push(seen.at(-1)! * by)
    return seen
  }

  it('outputs the first value at or above the limit, after 2 to 8 passes, never the limit itself', () => {
    for (const b of built) {
      const { by, limit, start } = read(b)
      const seen = run(start, by, limit)
      expect(answer(b), b.seed).toBe(seen.at(-1))
      expect(seen.length - 1).toBeGreaterThanOrEqual(2)
      expect(seen.length - 1).toBeLessThanOrEqual(8)
      expect(seen).not.toContain(limit)
      expect(answer(b)).toBeGreaterThanOrEqual(16)
      expect(answer(b)).toBeLessThanOrEqual(1000)
      expect(start >= 1 && start <= 9).toBe(true)
    }
  })

  it('prints every value n takes and the last test that passes', () => {
    for (const b of built) {
      const { by, limit, start, v } = read(b)
      const seen = run(start, by, limit)
      const below = seen.at(-2)!
      expect(b.question.solution, b.seed).toBe(`${v} takes ${seen.join(', ')}. At ${below} the condition ${below} < ${limit} is still true, so it ${by === 2 ? 'doubles' : 'triples'} again; at **${answer(b)}** it fails. The output is ${answer(b)}.`)
      expect(lines(b)).toEqual([`M1 traces past ${below}`, `A1 ${answer(b)}`])
    }
  })

  it('prints literal working', () => {
    const at = (seed: string) => generate(gen('cs-flowchart-growth'), slotOf('q7'), seed)
    expect(at('lit-a').question.prompt).toBe('A WHILE loop doubles n for as long as n < 140. n starts at 9, and the algorithm outputs n once the loop ends. What is output?')
    expect(at('lit-a').question.solution).toBe('n takes 9, 18, 36, 72, 144. At 72 the condition 72 < 140 is still true, so it doubles again; at **144** it fails. The output is 144.')
    expect(at('lit-b').question.solution).toBe('n takes 1, 3, 9, 27. At 9 the condition 9 < 20 is still true, so it triples again; at **27** it fails. The output is 27.')
    expect(lines(at('lit-b'))).toEqual(['M1 traces past 9', 'A1 27'])
  })

  it('refuses stopping one pass early, one pass too many, the limit and the number of passes', () => {
    for (const b of built) {
      const { by, limit, start } = read(b)
      const seen = run(start, by, limit)
      refuses(b, [seen.at(-2)!, answer(b) * by, limit, seen.length - 1])
    }
  })

  it('spreads answers, limits, starts and both multipliers', () => {
    expect(share(built, answer).worst).toBeLessThan(0.1)
    expect(share(built, answer).distinct).toBeGreaterThan(30)
    expect(share(built, (b) => read(b).limit).distinct).toBeGreaterThan(50)
    expect(share(built, (b) => read(b).start).distinct).toBe(9)
    const triples = built.filter((b) => read(b).by === 3).length / built.length
    expect(triples).toBeGreaterThan(0.15)
    expect(triples).toBeLessThan(0.35)
  })
})

describe('q10: a running total', () => {
  const built = build('q10')
  const read = (b: Generated) => {
    const p = b.question.prompt
    const m = /numbers ((?:\d+, )*\d+ and \d+)/.exec(p)!
    const xs = m[1]!.replace(' and ', ', ').split(', ').map(Number)
    const v = /What is (\w+) at the end/.exec(p)![1]!
    return { xs, v }
  }

  it('answers the sum of three or four different numbers from 2 to 15', () => {
    for (const b of built) {
      const { xs } = read(b)
      expect(answer(b), b.seed).toBe(xs.reduce((s, x) => s + x, 0))
      expect(new Set(xs).size).toBe(xs.length)
      expect(xs.length === 3 || xs.length === 4).toBe(true)
      for (const x of xs) expect(x >= 2 && x <= 15).toBe(true)
    }
  })

  it('prints the value after each addition', () => {
    for (const b of built) {
      const { xs, v } = read(b)
      const after: number[] = []
      let t = 0
      for (const x of xs) after.push((t += x))
      expect(b.question.solution, b.seed).toBe(`${v} goes 0, ${after.slice(0, -1).map((x) => `then ${x}`).join(', ')}, then **${t}**. A trace table with one row per addition makes this immediate.`)
      expect(lines(b)).toEqual(['M1 adds each number in turn', `A1 ${t}`])
    }
  })

  it('prints literal working', () => {
    const at = (seed: string) => generate(gen('cs-flowchart-total'), slotOf('q10'), seed).question
    expect(at('lit-a').prompt).toBe('Starting from total = 0, an algorithm adds each of the numbers 4, 10 and 12 to total in turn. What is total at the end?')
    expect(at('lit-a').solution).toBe('total goes 0, then 4, then 14, then **26**. A trace table with one row per addition makes this immediate.')
    expect(at('lit-b').solution).toBe('sum goes 0, then 12, then 15, then **30**. A trace table with one row per addition makes this immediate.')
  })

  it('refuses a missed first or last number, the last number alone and the count', () => {
    for (const b of built) {
      const { xs } = read(b)
      refuses(b, [answer(b) - xs[0]!, answer(b) - xs.at(-1)!, xs.at(-1)!, xs.length])
    }
  })

  it('spreads answers and lengths', () => {
    expect(share(built, answer).worst).toBeLessThan(0.1)
    expect(share(built, answer).distinct).toBeGreaterThan(25)
    const four = built.filter((b) => read(b).xs.length === 4).length / built.length
    expect(four).toBeGreaterThan(0.15)
    expect(four).toBeLessThan(0.35)
  })
})
