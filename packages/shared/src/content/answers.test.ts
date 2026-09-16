import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mark } from '../marking.ts'
import type { Question } from './questions.ts'

const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? jsonFiles(full) : name.endsWith('.json') ? [full] : []
  })
}

/**
 * The answer a topic states must be the answer the marker accepts. Schema validation
 * cannot see this: it checks shapes, not whether `normaliseText` and `parseNumber`
 * agree with what the author wrote. A student who types the model answer and is told
 * they are wrong loses trust in the app, so every stated answer is marked here.
 */
describe('stated answers survive marking', () => {
  const bad: string[] = []
  for (const file of jsonFiles(ROOT)) {
    const topic = JSON.parse(readFileSync(file, 'utf8'))
    const where = file.split('/content/')[1]
    const questions: Question[] = [...topic.questions, ...topic.lesson.steps.filter((s: { check?: Question }) => s.check).map((s: { check: Question }) => s.check)]
    for (const q of questions) {
      const at = `${where} ${q.id}`
      if (q.type === 'numeric') {
        if (!mark(q, String(q.answer)).correct) bad.push(`${at}: the bare number "${q.answer}" is not accepted`)
        if (q.units) {
          if (!mark(q, `${q.answer} ${q.units}`).correct) bad.push(`${at}: "${q.answer} ${q.units}" is not accepted`)
          if (!mark(q, `${q.answer}${q.units}`).correct) bad.push(`${at}: "${q.answer}${q.units}" is not accepted`)
        }
      }
      if (q.type === 'short-text') for (const a of q.accepted) if (!mark(q, a).correct) bad.push(`${at}: its own accepted answer "${a}" is not marked correct`)
      if (q.type === 'multiple-choice' && !mark(q, q.correct).correct) bad.push(`${at}: the correct options are not marked correct`)
      if (q.type === 'ordering' && !mark(q, q.items.map((_, i) => i)).correct) bad.push(`${at}: the stated order is not marked correct`)
    }
  }

  it('marks every stated answer as correct', () => {
    expect(bad).toEqual([])
  })
})

/**
 * A multiple-choice question whose correct option is far longer than its distractors
 * can be answered without knowing anything: pick the long one. Exam boards balance
 * option lengths on purpose. A second review found ten of these, eight of them in
 * Business, where the right answer tends to be the one with the reasoning in it.
 */
describe('multiple-choice options are balanced in length', () => {
  const biased: string[] = []
  for (const file of jsonFiles(ROOT)) {
    const topic = JSON.parse(readFileSync(file, 'utf8'))
    const questions: Question[] = [...topic.questions, ...topic.lesson.steps.filter((s: { check?: Question }) => s.check).map((s: { check: Question }) => s.check)]
    for (const q of questions) {
      if (q.type !== 'multiple-choice' || q.correct.length !== 1) continue
      const lengths = q.options.map((o) => o.length)
      const right = lengths[q.correct[0]!]!
      const others = lengths.filter((_, i) => i !== q.correct[0])
      const mean = others.reduce((a, b) => a + b, 0) / others.length
      if (right > 60 && right > 1.8 * mean) biased.push(`${file.split('/content/')[1]} ${q.id}: ${right} chars against a mean of ${Math.round(mean)}`)
    }
  }
  it('never makes the correct option the obviously long one', () => {
    expect(biased).toEqual([])
  })
})

/**
 * The correct option must not sit in the same place every time. On 16 September 2026 a
 * sweep of the whole pack found the correct answer at position 0 in **98%** of the 2335
 * multiple-choice questions, and at 100% in six of the eight subjects — a student who
 * noticed could have scored full marks on every quiz without reading a single question,
 * which would also have made "Mastered" meaningless.
 *
 * Nothing caught it because every other check looks at one question at a time: the
 * schema, the marker round-trip and the option-length rule are all satisfied by a
 * question whose answer happens to be first. It is only visible in aggregate.
 *
 * The threshold is deliberately loose. Real papers are not perfectly uniform and a
 * position may legitimately run ahead; what this rules out is the degenerate case.
 */
describe('correct options are spread across the positions', () => {
  const at = [0, 0, 0, 0, 0, 0]
  for (const file of jsonFiles(ROOT)) {
    const topic = JSON.parse(readFileSync(file, 'utf8'))
    const questions: Question[] = [...topic.questions, ...topic.lesson.steps.filter((s: { check?: Question }) => s.check).map((s: { check: Question }) => s.check)]
    for (const q of questions) {
      if (q.type !== 'multiple-choice' || q.correct.length !== 1) continue
      at[q.correct[0]!]! += 1
    }
  }
  const total = at.reduce((a, b) => a + b, 0)

  it('found the multiple-choice questions', () => {
    expect(total).toBeGreaterThan(500)
  })

  it('never puts more than 40% of correct answers in one position', () => {
    const worst = Math.max(...at)
    const share = worst / total
    expect(
      share,
      `position ${at.indexOf(worst)} holds ${Math.round(share * 100)}% of correct answers: ${at.slice(0, 4).join(' / ')}`,
    ).toBeLessThan(0.4)
  })

  it('uses every position of a four-option question', () => {
    for (let i = 0; i < 4; i++) expect(at[i], `no correct answer is ever at position ${i}`).toBeGreaterThan(0)
  })
})
