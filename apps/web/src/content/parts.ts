import type { SessionItem } from '../progress/reviewSession.ts'
import type { TopicSummary } from './index.ts'

/**
 * Multi-part questions in a drawn set (a unit test, a grade 9 set, a mixed sheet). A set picks
 * questions one at a time, so it can draw (c) of a stem before (a), or two parts with another
 * question between them. Here the parts a set drew are moved together, in letter order, to
 * where the first of them was drawn, so the stem is read once and the parts build as written.
 * With `whole`, a drawn part brings every part of its stem: a grade 9 set asks the whole
 * problem, since its last part is the grade 9 one and the earlier parts lead up to it.
 */
export function groupParts(items: SessionItem[], topics: Pick<TopicSummary, 'id' | 'questions'>[], { whole = false } = {}): SessionItem[] {
  const byId = new Map(topics.map((t) => [t.id, t]))
  const stemOf = (m: SessionItem) => byId.get(m.topicId)?.questions.find((q) => q.id === m.questionId)?.stemId
  const drawn = new Set(items.map((m) => `${m.topicId}/${m.questionId}`))
  const done = new Set<string>()
  const out: SessionItem[] = []
  for (const m of items) {
    const stem = stemOf(m)
    if (!stem) { out.push(m); continue }
    const key = `${m.topicId}/${stem}`
    if (done.has(key)) continue
    done.add(key)
    const parts = byId.get(m.topicId)!.questions.filter((q) => q.stemId === stem)
    for (const q of parts) if (whole || drawn.has(`${m.topicId}/${q.id}`)) out.push({ topicId: m.topicId, questionId: q.id })
  }
  return out
}
