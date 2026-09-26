import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mark } from '../marking.ts'
import type { Question } from './questions.ts'

/**
 * A typed answer worth two or more marks pays every mark for any entry in `accepted`, so a
 * part-answer listed there is paid in full: "a metal hydroxide and hydrogen" took both
 * marks for the products of sodium and water, though the first mark is for naming sodium
 * hydroxide. Part-answers belong in `partial`, with the marks the mark scheme gives them.
 * An audit of all 301 multi-mark typed answers on 26 September 2026 found that one.
 */
const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')

type ShortText = Extract<Question, { type: 'short-text' }>

const questions: { where: string; q: ShortText }[] = readdirSync(ROOT)
  .filter((d) => statSync(join(ROOT, d)).isDirectory())
  .flatMap((sub) =>
    readdirSync(join(ROOT, sub))
      .filter((f) => f.endsWith('.json'))
      .flatMap((f) => {
        const doc = JSON.parse(readFileSync(join(ROOT, sub, f), 'utf8')) as { questions: Question[]; lesson: { steps: { check?: Question }[] } }
        const all = [...doc.questions, ...doc.lesson.steps.flatMap((s) => (s.check ? [s.check] : []))]
        return all.filter((q): q is ShortText => q.type === 'short-text').map((q) => ({ where: `${sub}/${f} ${q.id}`, q }))
      }),
  )

const withPartial = questions.filter(({ q }) => q.partial)

describe('part-answers to typed questions', () => {
  it('found the questions that have them', () => {
    expect(questions.length).toBeGreaterThan(1400)
    expect(withPartial.length).toBeGreaterThanOrEqual(4)
  })

  it('are worth fewer marks than the question', () => {
    const bad = withPartial.flatMap(({ where, q }) => q.partial!.filter((p) => p.marks >= q.marks).map((p) => `${where}: "${p.answer}" ${p.marks} of ${q.marks}`))
    expect(bad).toEqual([])
  })

  it('score exactly their marks, and are not also full answers', () => {
    const bad = withPartial.flatMap(({ where, q }) =>
      q.partial!.flatMap((p) => {
        const r = mark(q, p.answer)
        return r.correct || r.marksScored !== p.marks ? [`${where}: "${p.answer}" scored ${r.marksScored}${r.correct ? ' (full)' : ''}, meant ${p.marks}`] : []
      }),
    )
    expect(bad).toEqual([])
  })
})
