import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The quiz page tells the student how long it will take, from sampleSize * 0.8 minutes —
 * about 48 seconds a question. An extended question carries its own suggestedMinutes, and
 * in the pools this found they ran from 3 to 8 minutes each. Drawing two into a ten
 * question quiz doubled the stated time before the other eight were answered, so the
 * duration on the intro screen was simply wrong.
 *
 * Extended questions still belong in the topic and on the advanced worksheet, which is
 * where their time is budgeted properly. They do not belong in the quick quiz pool.
 */
const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')

interface Question { id: string; type: string; suggestedMinutes?: number }
interface Topic { id: string; questions: Question[]; quiz: { questionIds: string[]; sampleSize: number } }

const topics: Topic[] = readdirSync(ROOT)
  .filter((d) => statSync(join(ROOT, d)).isDirectory())
  .flatMap((d) =>
    readdirSync(join(ROOT, d))
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(join(ROOT, d, f), 'utf8')) as Topic),
  )

describe('quiz pools', () => {
  it('found the content pack', () => {
    expect(topics.length).toBeGreaterThan(50)
  })

  it('contain no extended questions', () => {
    const bad: string[] = []
    for (const topic of topics) {
      const byId = new Map(topic.questions.map((q) => [q.id, q]))
      for (const id of topic.quiz.questionIds) {
        if (byId.get(id)?.type === 'extended') bad.push(`${topic.id}: ${id}`)
      }
    }
    expect(bad, `extended questions in quiz pools:\n${bad.join('\n')}`).toEqual([])
  })

  it('hold at least as many questions as the quiz draws', () => {
    const bad = topics
      .filter((t) => t.quiz.questionIds.length < t.quiz.sampleSize)
      .map((t) => `${t.id}: pool ${t.quiz.questionIds.length}, sample ${t.quiz.sampleSize}`)
    expect(bad, `quiz draws more questions than its pool holds:\n${bad.join('\n')}`).toEqual([])
  })

  it('keep the stated duration honest', () => {
    // No pooled question may on its own take a large share of the time the intro promises.
    const bad: string[] = []
    for (const topic of topics) {
      const byId = new Map(topic.questions.map((q) => [q.id, q]))
      const promised = Math.max(5, Math.round(topic.quiz.sampleSize * 0.8))
      for (const id of topic.quiz.questionIds) {
        const mins = byId.get(id)?.suggestedMinutes
        if (mins !== undefined && mins > promised / 2) bad.push(`${topic.id} ${id}: ${mins} min of a promised ${promised}`)
      }
    }
    expect(bad, `a single question eats half the promised quiz time:\n${bad.join('\n')}`).toEqual([])
  })
})
