import type { GradeBand, TopicStatus } from '@study/shared'
import type { TopicSummary as Topic } from '../content/index.ts'
import { evidenceFor, isoDate, lastActivity, type ProgressState } from './store.ts'

/** Questions in one day's recap. */
export const RECAP_SIZE = 5
/** Fewer studied topics than this and a recap would be one topic's quiz under another name. */
export const RECAP_MIN_TOPICS = 2

export interface RecapItem { topicId: string; questionId: string }

/**
 * A topic the student has actually studied: a lesson finished, or a quiz or worksheet done.
 * A lesson left halfway is not enough to be asked about, and a recap or redo session on its
 * own does not count, or the recap would feed itself.
 */
export function studied(topics: Topic[], state: ProgressState): Topic[] {
  const marked = new Set(state.attempts.filter((a) => a.kind !== 'review').map((a) => a.topicId))
  return topics.filter((t) => state.lessons[t.id]?.completedAt || marked.has(t.id))
}

/** Whether today's recap has been finished. */
export function recapDoneToday(state: ProgressState, today = isoDate()): boolean {
  return state.attempts.some((a) => a.from === 'recap' && isoDate(new Date(a.completedAt)) === today)
}

/**
 * How much a topic needs bringing back. Time since it was last touched is the main term,
 * because recalling something after a gap is what makes it stay; a weak topic counts double
 * and a strong one less, so the gap matters more where the hold is looser.
 */
const WEIGHT: Record<TopicStatus | 'unrated', number> = { 'not-secure': 2, developing: 1.5, unrated: 1.5, secure: 1, 'grade-9-ready': 0.7 }

/** Grade bands to ask from, nearest the topic's hold first. */
const BANDS: Record<TopicStatus | 'unrated', GradeBand[]> = {
  'not-secure': ['4-5', '6-7', '8-9'],
  developing: ['4-5', '6-7', '8-9'],
  unrated: ['4-5', '6-7', '8-9'],
  secure: ['6-7', '8-9', '4-5'],
  'grade-9-ready': ['8-9', '6-7', '4-5'],
}

/** A small stable hash, so the day's mix is the same on every reload and different tomorrow. */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/**
 * The day's recap (QZ-3, TRK-3): RECAP_SIZE questions spread across the topics the student
 * has studied, one per topic while there are topics to go round. Topics are taken by need
 * (see WEIGHT), skipping any touched today, which is fresh already. Within a topic: a
 * question last got wrong first, then one never answered, then the one answered longest
 * ago, from the grade band nearest the topic's status. Only questions the app marks.
 *
 * Empty when fewer than RECAP_MIN_TOPICS topics are studied. `exclude` holds questions
 * already asked today, so a second round is a new five.
 */
export function recapItems(topics: Topic[], state: ProgressState, now = new Date(), exclude: ReadonlySet<string> = new Set()): RecapItem[] {
  const pool = studied(topics, state)
  if (pool.length < RECAP_MIN_TOPICS) return []
  const today = isoDate(now)

  // The last time each question was answered, and whether that answer was right.
  const last = new Map<string, { at: string; right: boolean }>()
  for (const a of state.attempts) {
    for (const q of a.questions ?? []) {
      const k = `${a.topicId}/${q.id}`
      const prev = last.get(k)
      if (!prev || a.completedAt > prev.at) last.set(k, { at: a.completedAt, right: q.correct || Boolean(q.claimed) })
    }
  }

  const ranked = pool
    .map((t) => {
      const seen = lastActivity(t.id, state)
      const days = seen ? (now.getTime() - seen.getTime()) / 86400000 : 30
      const status = evidenceFor(t.id, state, now).status ?? 'unrated'
      return { t, status, today: seen ? isoDate(seen) === today : false, need: days * WEIGHT[status] + (hash(today + t.id) % 100) / 1000 }
    })
    .sort((a, b) => Number(a.today) - Number(b.today) || b.need - a.need)

  const queues = ranked.map(({ t, status }) => {
    const bandRank = (b: GradeBand) => BANDS[status].indexOf(b)
    const freshness = (id: string) => {
      const l = last.get(`${t.id}/${id}`)
      if (!l) return { tier: 1, at: '' }
      return { tier: l.right ? 2 : 0, at: l.at }
    }
    const candidates = t.questions
      .filter((q) => q.type !== 'extended' && !exclude.has(`${t.id}/${q.id}`))
      .map((q) => ({ q, f: freshness(q.id) }))
      .sort((a, b) => a.f.tier - b.f.tier || bandRank(a.q.gradeBand) - bandRank(b.q.gradeBand) || a.f.at.localeCompare(b.f.at) || hash(today + a.q.id) - hash(today + b.q.id))
    return { topicId: t.id, ids: candidates.map((c) => c.q.id) }
  })

  // Round robin: the neediest topic's best question, then the next topic's, and round again.
  const out: RecapItem[] = []
  for (let round = 0; out.length < RECAP_SIZE && queues.some((q) => q.ids.length > round); round++) {
    for (const q of queues) {
      if (out.length >= RECAP_SIZE) break
      const id = q.ids[round]
      if (id) out.push({ topicId: q.topicId, questionId: id })
    }
  }
  return out
}
