import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Topic } from './topic.ts'

const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')
function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? jsonFiles(full) : name.endsWith('.json') ? [full] : []
  })
}
const topics = jsonFiles(ROOT).map((f) => ({ file: f.split('/').pop()!, topic: Topic.parse(JSON.parse(readFileSync(f, 'utf8'))) }))

/** The same wording, however it is spaced or emphasised, is the same question to a student. */
function key(prompt: string): string {
  return prompt.toLowerCase().replace(/[*_`$]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * A lesson step's check and a question in the bank can legitimately ask the same thing:
 * meeting a question again in the worksheet is how practice works. What they may not do
 * is disagree about it. The two new gas topics each had a check and a question with
 * identical wording but different marks and a different grade band, so the same item was
 * worth two marks in one place and three in the other, and appeared as both a 4-5 and a
 * 6-7 question. A student who scores full marks in the lesson and then loses one on the
 * worksheet for the same answer learns nothing from the difference.
 */
describe('a repeated question', () => {
  const repeats = topics.flatMap(({ file, topic }) => {
    const checks = topic.lesson.steps.flatMap((s) => (s.check ? [s.check] : []))
    return checks.flatMap((check) =>
      topic.questions
        .filter((q) => key(q.prompt) === key(check.prompt))
        .map((q) => ({ file, check, question: q })),
    )
  })

  it('carries the same marks wherever it appears', () => {
    const bad = repeats
      .filter((r) => r.check.marks !== r.question.marks)
      .map((r) => `${r.file}: ${r.check.id} is ${r.check.marks} marks, ${r.question.id} is ${r.question.marks}`)
    expect(bad).toEqual([])
  })

  it('carries the same grade band wherever it appears', () => {
    const bad = repeats
      .filter((r) => r.check.gradeBand !== r.question.gradeBand)
      .map((r) => `${r.file}: ${r.check.id} is ${r.check.gradeBand}, ${r.question.id} is ${r.question.gradeBand}`)
    expect(bad).toEqual([])
  })

  /** Two entries in the same bank are a duplicate, not practice: the quiz could draw both. */
  it('never appears twice in one topic\'s question bank', () => {
    const bad: string[] = []
    for (const { file, topic } of topics) {
      const seen = new Map<string, string>()
      for (const q of topic.questions) {
        const k = key(q.prompt)
        const first = seen.get(k)
        if (first) bad.push(`${file}: ${first} and ${q.id}`)
        else seen.set(k, q.id)
      }
    }
    expect(bad).toEqual([])
  })
})
