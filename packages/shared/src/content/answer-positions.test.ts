import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Where the correct option sits, across a topic and across the pack.
 *
 * Every one of these questions is correct on its own, so no per-question check can see
 * this: eight Physics topics had the answer at position 0 for all 82 of their
 * multiple-choice questions, and 98% of the Business pack sat there before that. Both
 * passed every test in the repo. A worksheet prints the options lettered and a flashcard
 * shows them in order, so a pack that always answers A is teaching that, and a student who
 * notices it can score without reading the physics.
 *
 * The defect only exists in the collection, which is why the assertion has to be over the
 * collection.
 */
const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')

interface Question { id: string; type: string; options?: string[]; correct?: number[] }
interface Check { options?: string[]; correct?: number[] }
interface Topic { id: string; subjectId: string; questions: Question[]; lesson: { steps: { check?: Check }[] } }

const topics: Topic[] = readdirSync(ROOT)
  .filter((d) => statSync(join(ROOT, d)).isDirectory())
  .flatMap((d) =>
    readdirSync(join(ROOT, d))
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(join(ROOT, d, f), 'utf8')) as Topic),
  )

const singleAnswer = (t: Topic) =>
  t.questions.filter((q) => q.type === 'multiple-choice' && q.options && q.correct?.length === 1)

/**
 * The checks inside the lesson, which a student meets before any worksheet. The first pass
 * of this fix reached the questions and not these, and 27 topics still answered A to every
 * check in their lesson -- so the habit was taught before the worksheet could contradict it.
 */
const lessonChecks = (t: Topic) =>
  t.lesson.steps.flatMap((s) => (s.check?.options && s.check.correct?.length === 1 ? [s.check] : []))

/**
 * Numeric options are conventionally listed in order, so where the answer lands is decided
 * by the physics rather than by an author. Those are counted but never required to move.
 */
const numeric = (q: { options?: string[] }) => (q.options ?? []).every((o) => /^\s*[-+]?\d[\d.,]*\s*[^\d]{0,12}$/.test(o.trim()))

describe('the position of the correct option', () => {
  it('found the content pack', () => {
    expect(topics.length).toBeGreaterThan(50)
    expect(topics.flatMap(singleAnswer).length).toBeGreaterThan(500)
  })

  /** Per topic: a student meets a topic's questions together, on one worksheet. */
  it.each(topics.map((t) => [`${t.subjectId}/${t.id}`, t] as const))(
    'is not stuck in one or two places within %s',
    (_name, topic) => {
      const free = singleAnswer(topic).filter((q) => !numeric(q))
      if (free.length < 5) return // too few to read anything into
      const width = Math.min(...free.map((q) => q.options!.length))
      const used = new Set(free.map((q) => q.correct![0]!))
      expect(used.size, `only positions ${[...used].join(', ')} used across ${free.length} questions`)
        .toBeGreaterThanOrEqual(Math.min(3, width))
    },
  )

  /**
   * Per topic, for the lesson checks. Three is a small sample -- three independent picks
   * from four positions land on three different ones only about a third of the time -- so
   * this asserts only that they are not ALL in one place, which chance alone produces once
   * in sixteen. Twenty-seven topics failed it.
   */
  it.each(topics.map((t) => [`${t.subjectId}/${t.id}`, t] as const))(
    'is not identical for every lesson check in %s',
    (_name, topic) => {
      const free = lessonChecks(topic).filter((c) => !numeric(c))
      if (free.length < 3) return
      const used = new Set(free.map((c) => c.correct![0]!))
      expect(used.size, `all ${free.length} checks answer position ${[...used][0]}`).toBeGreaterThan(1)
    },
  )

  /** Across the whole pack, no position should be far from its fair share. */
  it('is spread evenly across the pack as a whole', () => {
    const counts = [0, 0, 0, 0]
    let total = 0
    for (const t of topics) {
      for (const q of [...singleAnswer(t), ...lessonChecks(t)]) {
        const at = q.correct![0]!
        if (at < 4 && q.options!.length === 4) { counts[at] += 1; total += 1 }
      }
    }
    const share = counts.map((c) => c / total)
    // A fair share is 0.25. Real content is never exactly even, so this allows a wide
    // band and still catches the 98%-at-zero and 100%-at-zero cases that prompted it.
    for (const [i, s] of share.entries()) {
      expect(s, `position ${i} holds ${(100 * s).toFixed(1)}% of ${total} answers`).toBeGreaterThan(0.12)
      expect(s, `position ${i} holds ${(100 * s).toFixed(1)}% of ${total} answers`).toBeLessThan(0.4)
    }
  })
})
