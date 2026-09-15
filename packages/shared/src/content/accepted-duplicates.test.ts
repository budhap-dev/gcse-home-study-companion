import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normaliseText } from '../marking.ts'

/**
 * A short-text question lists the forms of an answer the marker should accept. Two
 * entries that normalise to the same string are not two forms: the marker cannot tell
 * them apart, so the second one accepts nothing the first did not. They accumulate
 * because "C2H6" and "c2h6" look different on the page, and a long list of them hides
 * the variant that is genuinely missing.
 *
 * This checks with the marker's own normaliseText rather than a copy of its rules, so
 * the test cannot drift from what the marker actually does.
 */
const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')

interface Question { id: string; type: string; accepted?: string[] }
interface Topic { id: string; questions: Question[]; lesson: { steps: { check?: Question }[] } }

const topics: Topic[] = readdirSync(ROOT)
  .filter((d) => statSync(join(ROOT, d)).isDirectory())
  .flatMap((d) =>
    readdirSync(join(ROOT, d))
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(join(ROOT, d, f), 'utf8')) as Topic),
  )

describe('accepted answers', () => {
  it('found the content pack', () => {
    expect(topics.length).toBeGreaterThan(50)
  })

  it('lists no two forms the marker cannot tell apart', () => {
    const bad: string[] = []
    for (const topic of topics) {
      const questions = [...topic.questions, ...topic.lesson.steps.flatMap((s) => (s.check ? [s.check] : []))]
      for (const q of questions) {
        if (q.type !== 'short-text' || !q.accepted) continue
        const seen = new Map<string, string>()
        for (const a of q.accepted) {
          const k = normaliseText(a)
          const first = seen.get(k)
          if (first !== undefined) bad.push(`${topic.id} ${q.id}: ${JSON.stringify(first)} and ${JSON.stringify(a)}`)
          else seen.set(k, a)
        }
      }
    }
    expect(bad, `accepted answers that normalise to the same string:\n${bad.join('\n')}`).toEqual([])
  })

  it('knows which differences the marker does keep', () => {
    // A self-test, so the check above cannot pass because normaliseText flattens
    // everything. Case and spacing are folded; a trailing stop and an accent are not,
    // so those really are distinct forms and were left in place.
    expect(normaliseText('C2H6')).toBe(normaliseText('c2h6'))
    expect(normaliseText('2x - 2')).toBe(normaliseText('2x-2'))
    expect(normaliseText('je recycle')).not.toBe(normaliseText('je recycle.'))
    expect(normaliseText('très')).not.toBe(normaliseText('tres'))
  })
})
