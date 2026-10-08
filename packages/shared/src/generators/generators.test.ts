import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../content/questions.ts'
import { mark } from '../marking.ts'
import { GENERATORS, generate, generatorFor } from './index.ts'
import type { Generated } from './types.ts'

/**
 * The release check (GEN-2). A generator writes questions nobody reads before a student
 * does, so every one is built 1,000 times for each written question it stands in for, and
 * each build must pass what a written question passes and more: the schema, a mark scheme
 * that adds up, the marker accepting its own answer, and its answer worked a second way.
 */
const SEEDS = 1000
const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')
const topic = (subjectId: string, topicId: string) =>
  Question.array().parse(JSON.parse(readFileSync(join(ROOT, subjectId, `${topicId}.json`), 'utf8')).questions)

/** Binary residue printed from a computed figure (float-residue.test.ts). */
const RESIDUE = /\d+\.\d*?(?:0{8,}[1-9]|9{8,})\d*/

const strings = (q: Question) => JSON.stringify(q)

describe('question generators', () => {
  it('have unique ids, and no written question is claimed twice', () => {
    expect(new Set(GENERATORS.map((g) => g.id)).size).toBe(GENERATORS.length)
    const slots = GENERATORS.flatMap((g) => g.replaces.map((id) => `${g.topicId}/${id}`))
    expect(new Set(slots).size).toBe(slots.length)
  })

  for (const g of GENERATORS) {
    const bank = topic(g.subjectId, g.topicId)

    for (const id of g.replaces) {
      const slot = bank.find((q) => q.id === id)
      const built: Generated[] = slot ? Array.from({ length: SEEDS }, (_, i) => generate(g, slot, `release-${i}`)) : []

      describe(`${g.id} for ${g.topicId} ${id}`, () => {
        it('stands in for a written question of the same kind', () => {
          expect(slot, `${g.topicId} has no ${id}`).toBeDefined()
          expect(generatorFor(g.subjectId, g.topicId, id)).toBe(g)
          expect(new Set(built.map((b) => b.question.type))).toEqual(new Set([slot!.type]))
        })

        it(`agrees with its second method on ${SEEDS} seeds`, () => {
          const failed = built.filter((b) => !b.check.agrees)
          expect(failed.map((b) => `${b.seed}: ${JSON.stringify(b.values)} ${b.check.detail}`)).toEqual([])
        })

        it('builds valid questions worth what the written one is worth', () => {
          for (const b of built) {
            expect(() => Question.parse(b.question), b.seed).not.toThrow()
            const q = b.question
            expect(q.id).toBe(id)
            expect(q.marks).toBe(slot!.marks)
            expect(q.gradeBand).toBe(slot!.gradeBand)
            expect(q.discriminators).toEqual(slot!.discriminators)
            expect(q.markScheme.reduce((s, l) => s + l.marks, 0), b.seed).toBe(q.marks)
          }
        })

        it('prints no binary residue, NaN or undefined', () => {
          for (const b of built) expect(strings(b.question), b.seed).not.toMatch(new RegExp(`${RESIDUE.source}|NaN|undefined|Infinity`))
        })

        it('is marked right with its own answer and wrong with another', () => {
          for (const { question: q, seed } of built) {
            if (q.type === 'numeric') {
              expect(Number.isFinite(q.answer), seed).toBe(true)
              expect(mark(q, String(q.answer)).correct, seed).toBe(true)
              expect(mark(q, String(q.answer + q.tolerance * 3 + 1)).correct, seed).toBe(false)
              // The solution reaches the number it marks against.
              expect(q.solution, seed).toContain(String(q.answer))
            } else if (q.type === 'multiple-choice') {
              expect(q.correct, seed).toHaveLength(1)
              expect(mark(q, q.correct).correct, seed).toBe(true)
              for (const i of q.options.keys()) if (i !== q.correct[0]) expect(mark(q, [i]).correct, seed).toBe(false)
            }
          }
        })

        it('rebuilds the same question from the same seed', () => {
          expect(generate(g, slot!, 'release-7')).toEqual(built[7])
          expect(generate(g, slot!, 'another-seed').question).not.toEqual(built[7]!.question)
        })

        it('varies the question, not only a number or two', () => {
          expect(new Set(built.map((b) => b.question.prompt)).size).toBeGreaterThan(100)
        })
      })
    }
  }
})

describe('multiple-choice generators', () => {
  const choice = GENERATORS.filter((g) => g.id.endsWith('-choice'))

  it('exist', () => expect(choice.length).toBeGreaterThan(0))

  for (const g of choice) {
    const slot = topic(g.subjectId, g.topicId).find((q) => q.id === g.replaces[0])!
    const built = Array.from({ length: SEEDS }, (_, i) => generate(g, slot, `release-${i}`))

    it(`${g.id} names the mistake behind every wrong option (GEN-3)`, () => {
      for (const b of built) {
        if (b.question.type !== 'multiple-choice') throw new Error('not multiple choice')
        const { options, correct } = b.question
        expect(new Set(options).size, b.seed).toBe(options.length)
        expect(b.mistakes, b.seed).toHaveLength(options.length)
        b.mistakes!.forEach((m, i) => (i === correct[0] ? expect(m).toBeNull() : expect(m, b.seed).toMatch(/\w{3,}/)))
      }
    })

    // Aggregate-only defect: per-question tests pass when every answer sits at position 0.
    it(`${g.id} puts the answer in every position`, () => {
      const at = [0, 0, 0, 0]
      for (const b of built) if (b.question.type === 'multiple-choice') at[b.question.correct[0]!]!++
      for (const n of at) expect(n).toBeGreaterThan(SEEDS * 0.15)
    })
  }
})

describe('generators vary the structure of a question as well as its numbers', () => {
  const build = (id: string, slotId: string) => {
    const g = GENERATORS.find((x) => x.id === id)!
    const slot = topic(g.subjectId, g.topicId).find((q) => q.id === slotId)!
    return Array.from({ length: 300 }, (_, i) => generate(g, slot, `shape-${i}`))
  }

  it('a 2-mark side multiplies and a 3-mark side divides, as the written mark schemes do', () => {
    for (const b of build('trig-finding-a-side', 'q3')) expect(b.question.solution).toContain('so multiply')
    for (const b of build('trig-finding-a-side', 'q5')) {
      expect(b.question.solution).toContain('**divide**')
      expect(b.question.markScheme.map((l) => l.description)).toContain('divides rather than multiplies')
    }
  })

  it('every side and every ratio turns up', () => {
    const cases = new Set([...build('trig-finding-a-side', 'q3'), ...build('trig-finding-a-side', 'q5')].map((b) => b.values.case))
    expect(cases.size).toBe(6)
    expect(new Set(build('trig-finding-an-angle', 'q7').map((b) => b.values.ratio))).toEqual(new Set(['sin', 'cos', 'tan']))
  })

  it('growth, interest earned and depreciation all turn up, and both directions of reverse percentage', () => {
    expect(new Set(build('compound-interest', 'q5').map((b) => b.values.kind))).toEqual(new Set(['value', 'interest', 'depreciation']))
    expect(new Set(build('reverse-percentage', 'q13').map((b) => b.values.direction))).toEqual(new Set(['rise', 'fall']))
  })

  it('a depreciation falls and an investment grows', () => {
    for (const b of build('compound-interest', 'q5')) {
      const q = b.question
      if (q.type !== 'numeric') continue
      const P = Number(b.values.P)
      if (b.values.kind === 'depreciation') expect(q.answer).toBeLessThan(P)
      if (b.values.kind === 'value') expect(q.answer).toBeGreaterThan(P)
      if (b.values.kind === 'interest') expect(q.answer).toBeGreaterThan(0)
    }
  })
})
