import { TOPIC_STATUSES, type TopicStatus } from '@study/shared'
import { topicsForSubject } from '../content/index.ts'
import { SUBJECTS } from '@study/shared'
import { evidenceFor, isoDate, weekDays, type ProgressState } from './store.ts'
import type { SkillStat } from './xp.ts'

export interface Week {
  /** Monday of the week, as an ISO date. */
  start: string
  minutes: number
  /** Short label for the axis, such as "8 Sep". */
  label: string
}

/**
 * Study minutes per week, oldest first, for a bar chart of the habit.
 *
 * Weeks with nothing in them are kept rather than skipped. A gap is the most useful thing
 * on this chart — dropping empty weeks would draw a tidy run of bars over a fortnight
 * when nothing happened.
 */
export function weeklyMinutes(state: ProgressState, weeks = 8, today = isoDate()): Week[] {
  const out: Week[] = []
  const monday = new Date(weekDays(today)[0]! + 'T12:00:00')
  for (let back = weeks - 1; back >= 0; back--) {
    const start = new Date(monday)
    start.setDate(monday.getDate() - back * 7)
    const startIso = isoDate(start)
    const minutes = weekDays(startIso).reduce((sum, d) => sum + (state.minutes[d] ?? 0), 0)
    out.push({ start: startIso, minutes, label: start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) })
  }
  return out
}

export interface StatusTotals {
  counts: Record<TopicStatus, number>
  notStarted: number
  started: number
  total: number
}

/**
 * Topic statuses across every subject that has content, for the donut.
 *
 * Untouched topics are counted apart from the rest for the same reason the per-subject
 * bars do it: the threshold rules score an unopened topic `not-secure`, which is true and
 * useless, and would paint the whole ring in the failing colour on day one.
 */
export function statusTotals(state: ProgressState): StatusTotals {
  const counts = Object.fromEntries(TOPIC_STATUSES.map((s) => [s, 0])) as Record<TopicStatus, number>
  const touched = new Set<string>([...state.attempts.map((a) => a.topicId), ...Object.keys(state.lessons)])
  let total = 0
  let started = 0
  for (const subject of SUBJECTS) {
    for (const topic of topicsForSubject(subject.id)) {
      total += 1
      if (!touched.has(topic.id)) continue
      started += 1
      counts[evidenceFor(topic.id, state).status] += 1
    }
  }
  return { counts, notStarted: total - started, started, total }
}

export interface Slice {
  key: string
  label: string
  value: number
  colour: string
}

/**
 * Slices of a donut, as fractions of a whole, skipping any that are empty.
 *
 * Returns the running start and end of each arc as a fraction of the circle, so the
 * drawing code never has to do the arithmetic and can never disagree with the legend.
 */
export function donutSlices(slices: Slice[]): { slice: Slice; from: number; to: number; share: number }[] {
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  if (total <= 0) return []
  let at = 0
  return slices
    .filter((s) => s.value > 0)
    .map((slice) => {
      const share = slice.value / total
      const from = at
      at += share
      return { slice, from, to: at, share }
    })
}

/**
 * Every skill with enough evidence, weakest first, for a ranked bar chart.
 *
 * `skillStats` keeps only what is under 60%, so a student with nothing that weak is told
 * there is nothing to work on. This takes everything under 80% instead, which includes
 * the middling skills that neither of its lists mentions and is what "work on next"
 * actually means. Anything at or above the bar is a strength and belongs on that chart,
 * not this one.
 */
export function rankedSkills(stats: SkillStat[], limit = 8, below = 80): SkillStat[] {
  return [...stats]
    .filter((s) => s.pct < below)
    .sort((a, b) => a.pct - b.pct || b.attempts - a.attempts)
    .slice(0, limit)
}
