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

/** The mark-scheme line as a student would type it: maths delimiters off, \frac{a}{b} as (a)/(b). */
const typed = (line: string) =>
  line.replace(/\$/g, '').replace(/\\d?frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)').replace(/\\,/g, '').replace(/\\%/g, '%').replace(/\\times/g, '×').trim()

/** Every plain figure in the line, thousands separators read through. */
const figures = (line: string) =>
  [...typed(line).replace(/(\d)[, ](?=\d{3}(?!\d))/g, '$1').replace(/[−–]/g, '-').matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]))

/**
 * A numeric question's last answer line (A1 or B1) must state the answer it marks against.
 * Four Business questions were reworded in October 2026 with new figures in the prompt and
 * solution, while their mark schemes kept the old ones: "A1 15%" under an answer of 20, of
 * 28, of 12.5 and of 10. The marker reads `answer`, so nothing failed; a parent reading the
 * mark scheme saw the wrong number. The line is marked as if typed, so 3/2, −\frac{1}{2} and
 * 1 × 10⁸ Hz count as the values they are.
 */
describe('numeric mark schemes state the answer', () => {
  it('ends every numeric question on an answer line that agrees with its answer', () => {
    const bad: string[] = []
    let checked = 0
    for (const file of jsonFiles(ROOT)) {
      const topic = JSON.parse(readFileSync(file, 'utf8'))
      const where = file.split('/content/')[1]
      const questions: Question[] = [...topic.questions, ...topic.lesson.steps.filter((s: { check?: Question }) => s.check).map((s: { check: Question }) => s.check)]
      for (const q of questions) {
        if (q.type !== 'numeric' || !q.markScheme?.length) continue
        const line = [...q.markScheme].reverse().find((l) => /^[AB]/.test(l.code))
        if (!line || !/\d/.test(line.description)) continue
        checked++
        if (mark(q, typed(line.description)).correct) continue
        if (figures(line.description).some((x) => Math.abs(Math.abs(x) - Math.abs(q.answer)) <= q.tolerance + 1e-9)) continue
        bad.push(`${where} ${q.id}: answer ${q.answer}, but its ${line.code} line says "${line.description}"`)
      }
    }
    // A scanner that reads nothing passes everything.
    expect(checked).toBeGreaterThan(1000)
    expect(bad).toEqual([])
  })
})
