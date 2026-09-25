import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A solution must name the option it means, not the position it sits in.
 *
 * Options get reordered. This pack reordered 297 of them in one pass, to stop the answer
 * always being A, and every solution that said "only the first does that" then pointed at
 * a different option. Nine were wrong by the time anyone looked: three broken by that
 * reorder, six already wrong before it, including one in Maths where the feedback told a
 * student their correct answer was "just reading numbers off".
 *
 * The defect is invisible in the file being edited, because the sentence still reads
 * perfectly; it is only wrong relative to an array somewhere else. So the rule is simply
 * that the sentence may not depend on the array at all.
 */
const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')

/**
 * Ordinals doing the job of a noun for an option: "only the first does", "the third answer".
 * Ordinals that describe something in the prompt are left alone -- "only the first of the
 * month", "only the first verb is conjugated", "the second melts over a range" are all
 * about the question's own subject matter and survive any reordering.
 *
 * "The last option" and "the third sentence" are the same defect with a different word; six
 * solutions in four subjects used them on 25 September 2026, and two of those already
 * pointed at the wrong option.
 */
const NAMES_A_SLOT =
  /\b(only the (?:first|second|third|fourth|last)\s+(?:does|is|has|gives|names|compares|starts|works|just|reads|describes|weighs)|the (?:first|second|third|fourth|last) (?:option|answer|sentence|comment|plan))\b/i

interface Item { id: string; options?: string[]; solution?: string }
interface Topic { id: string; subjectId: string; questions: Item[]; lesson: { steps: { check?: Item }[] } }

const topics: Topic[] = readdirSync(ROOT)
  .filter((d) => statSync(join(ROOT, d)).isDirectory())
  .flatMap((d) =>
    readdirSync(join(ROOT, d))
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(join(ROOT, d, f), 'utf8')) as Topic),
  )

describe('multiple-choice solutions', () => {
  it('found the content pack', () => {
    expect(topics.length).toBeGreaterThan(50)
  })

  it('never refer to an option by its position', () => {
    const offenders: string[] = []
    for (const t of topics) {
      const items = [...t.questions, ...t.lesson.steps.flatMap((s) => (s.check ? [s.check] : []))]
      for (const q of items) {
        if (!q.options || !q.solution) continue
        const found = NAMES_A_SLOT.exec(q.solution)
        if (found) offenders.push(`${t.subjectId}/${t.id} ${q.id}: "${found[0]}"`)
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
