import type { GradeBand } from '@study/shared'
import type { TopicSummary } from '../content/index.ts'
import type { ProgressState } from './store.ts'

/**
 * The working-at grade (MTV-2): an honest range for one subject, from the student's own answers.
 *
 * Every question in the pack carries the grade band it is written for (4–5, 6–7 or 8–9), so the
 * share of marks taken in each band says which grades the student is answering at. Only the
 * newest answer to each question counts, so a question done five times does not count five
 * times, and only answers from the last WINDOW_DAYS, since an old score says little about now.
 *
 * It is a range, never a single grade, and it describes the topics studied so far, not the
 * whole course: a student who has studied a third of the course and does it well is working at
 * a 7 on that third. The sentence beside it says both.
 */
export const WINDOW_DAYS = 84
/** Fewer answers than this and the estimate would swing on one evening's work. */
export const MIN_ANSWERS = 20
/** A band with fewer answers than this is judged from the band above it (see `bandRates`). */
export const MIN_IN_BAND = 5

export interface BandScore { got: number; of: number; answers: number }

export type WorkingAt =
  | { kind: 'too-few'; answers: number; need: number }
  | { kind: 'estimate'; low: number; high: number; answers: number; topics: number; bands: Record<GradeBand, BandScore> }

const BANDS: GradeBand[] = ['4-5', '6-7', '8-9']

/** The newest answer to each question on the subject's topics within the window, by band. */
export function bandScores(subjectTopics: TopicSummary[], state: ProgressState, now = new Date()): { bands: Record<GradeBand, BandScore>; answers: number; topics: number } {
  const ids = new Set(subjectTopics.map((t) => t.id))
  const since = new Date(now.getTime() - WINDOW_DAYS * 86400000).toISOString()
  const newest = new Map<string, { at: string; band: GradeBand; got: number; of: number; topicId: string }>()
  for (const a of state.attempts) {
    if (!ids.has(a.topicId) || a.completedAt < since) continue
    for (const q of a.questions ?? []) {
      if (q.marksAvailable <= 0) continue
      const key = `${a.topicId}/${q.id}`
      const prev = newest.get(key)
      if (!prev || a.completedAt > prev.at) newest.set(key, { at: a.completedAt, band: q.gradeBand, got: q.marksScored, of: q.marksAvailable, topicId: a.topicId })
    }
  }
  const bands = Object.fromEntries(BANDS.map((b) => [b, { got: 0, of: 0, answers: 0 }])) as Record<GradeBand, BandScore>
  for (const r of newest.values()) {
    const b = bands[r.band]
    b.got += r.got
    b.of += r.of
    b.answers++
  }
  return { bands, answers: newest.size, topics: new Set([...newest.values()].map((r) => r.topicId)).size }
}

/**
 * The share of marks taken in each band, filled in where a band has too few answers. A student
 * on advanced worksheets answers mostly 8–9 questions; one who takes 80% of those would take
 * more of the easier ones, so a thin band is read as a little above the band over it. A thin
 * band with nothing above it stays unknown.
 */
export function bandRates(bands: Record<GradeBand, BandScore>): Record<GradeBand, number | undefined> {
  const rate = (b: GradeBand) => (bands[b].answers >= MIN_IN_BAND && bands[b].of > 0 ? bands[b].got / bands[b].of : undefined)
  const r89 = rate('8-9')
  const r67 = rate('6-7') ?? (r89 !== undefined ? Math.min(1, r89 + 0.15) : undefined)
  const r45 = rate('4-5') ?? (r67 !== undefined ? Math.min(1, r67 + 0.15) : undefined)
  return { '4-5': r45, '6-7': r67, '8-9': r89 }
}

/** The grade range the band shares point to, from 8 to 9 down to 3 to 4. */
export function rangeFor(r: Record<GradeBand, number | undefined>): [number, number] {
  const r45 = r['4-5'] ?? 0, r67 = r['6-7'] ?? 0, r89 = r['8-9']
  if (r89 !== undefined && r89 >= 0.7 && r67 >= 0.8) return [8, 9]
  if (r89 !== undefined && r89 >= 0.5 && r67 >= 0.7) return [7, 8]
  if (r67 >= 0.6) return [6, 7]
  if (r67 >= 0.4 && r45 >= 0.7) return [5, 6]
  if (r45 >= 0.5) return [4, 5]
  return [3, 4]
}

export function workingAt(subjectTopics: TopicSummary[], state: ProgressState, now = new Date()): WorkingAt {
  const { bands, answers, topics } = bandScores(subjectTopics, state, now)
  if (answers < MIN_ANSWERS) return { kind: 'too-few', answers, need: MIN_ANSWERS - answers }
  const [low, high] = rangeFor(bandRates(bands))
  return { kind: 'estimate', low, high, answers, topics, bands }
}

const pct = (b: BandScore) => `${Math.round((100 * b.got) / Math.max(1, b.of))}%`

/** How the estimate was reached, in a sentence a student and a parent can both check. */
export function workingAtNote(w: WorkingAt): string {
  if (w.kind === 'too-few') {
    return w.answers === 0
      ? `Answer ${MIN_ANSWERS} questions in this subject (a quiz or two) and an estimate appears here.`
      : `${w.need} more answered ${w.need === 1 ? 'question' : 'questions'} and an estimate appears here: ${w.answers} so far is too few to judge from.`
  }
  const parts = BANDS.filter((b) => w.bands[b].answers > 0).map((b) => `${pct(w.bands[b])} of grade ${b.replace('-', '–')} marks`)
  return `From the newest answers to ${w.answers} questions in ${w.topics} ${w.topics === 1 ? 'topic' : 'topics'} over the last ${WINDOW_DAYS / 7} weeks: ${parts.join(', ')}. It covers the topics studied so far, not the whole course.`
}

/** "5 to 6", the range as it is shown. */
export function rangeLabel(w: Extract<WorkingAt, { kind: 'estimate' }>): string {
  return `${w.low} to ${w.high}`
}
