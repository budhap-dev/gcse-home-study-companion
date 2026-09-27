import type { ProgressState } from './store.ts'

export interface Mistake {
  topicId: string
  questionId: string
  /** When it was last got wrong, for newest-first order. */
  wrongAt: string
}

/**
 * The questions to redo: every question whose most recent wrong answer has not since been
 * followed by two right answers in a row, newest mistake first (WKP-1). Every kind of
 * attempt counts, redo sessions included, so a question leaves the list by being got right
 * twice, wherever that happens. A claimed answer counts as right, as the student decided.
 *
 * `keep` filters out what cannot be redone here, such as self-marked extended answers or a
 * question that is no longer in the content.
 */
export function mistakeQueue(state: Pick<ProgressState, 'attempts'>, keep: (topicId: string, questionId: string) => boolean = () => true, limit = 15): Mistake[] {
  const history = new Map<string, { topicId: string; questionId: string; events: { at: string; right: boolean }[] }>()
  for (const a of state.attempts) {
    for (const q of a.questions ?? []) {
      const k = `${a.topicId}\u0000${q.id}`
      const h = history.get(k) ?? { topicId: a.topicId, questionId: q.id, events: [] }
      h.events.push({ at: a.completedAt, right: q.correct || Boolean(q.claimed) })
      history.set(k, h)
    }
  }
  const out: Mistake[] = []
  for (const h of history.values()) {
    const events = h.events.sort((x, y) => x.at.localeCompare(y.at))
    const lastWrong = events.map((e) => e.right).lastIndexOf(false)
    if (lastWrong < 0) continue
    const rightSince = events.length - 1 - lastWrong
    if (rightSince >= 2) continue
    if (!keep(h.topicId, h.questionId)) continue
    out.push({ topicId: h.topicId, questionId: h.questionId, wrongAt: events[lastWrong]!.at })
  }
  return out.sort((x, y) => y.wrongAt.localeCompare(x.wrongAt)).slice(0, limit)
}
