import { getSubject } from '@study/shared'
import { TOPICS } from '../content/index.ts'
import { isoDate, parseTimeKey, weekDays, type ProgressState } from './store.ts'

export interface TrendWeek {
  /** Monday of the week, as an ISO date. */
  start: string
  /** Short label for the axis, such as "8 Sep". */
  label: string
  minutes: number
  /** Mean percentage of the quizzes and worksheets finished that week, where there were any. */
  avgPct?: number
  marked: number
}

export interface SubjectTrend {
  subjectId: string
  name: string
  colour: string
  /** Oldest week first, every week kept, so a gap shows as a gap. */
  weeks: TrendWeek[]
  minutes: number
  marked: number
}

const pct = (a: { marksScored: number; marksAvailable: number }) => (a.marksAvailable ? (100 * a.marksScored) / a.marksAvailable : 0)

/** Mondays of the last `weeks` weeks, oldest first, with their axis labels. */
export function trendWeeks(weeks: number, today = isoDate()): { start: string; label: string }[] {
  const monday = new Date(weekDays(today)[0]! + 'T12:00:00')
  const out: { start: string; label: string }[] = []
  for (let back = weeks - 1; back >= 0; back--) {
    const start = new Date(monday)
    start.setDate(monday.getDate() - back * 7)
    out.push({ start: isoDate(start), label: start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) })
  }
  return out
}

/**
 * The last eight weeks per subject (PAR-5): minutes studied and the average mark on quizzes
 * and worksheets, week by week, so a parent can see whether a subject is getting more time
 * and whether the marks are moving. Only subjects with something in the window are listed,
 * most time first. Minutes come from `time`, which files them by subject (recorded since 23
 * September 2026); marks from the attempts, redo sessions left out as questions already got
 * wrong once.
 */
export function subjectTrend(state: ProgressState, weeks = 8, today = isoDate()): { weeks: { start: string; label: string }[]; subjects: SubjectTrend[] } {
  const axis = trendWeeks(weeks, today)
  const index = new Map<string, number>()
  axis.forEach((w, i) => { for (const d of weekDays(w.start)) index.set(d, i) })

  const topicSubject = new Map(TOPICS.map((t) => [t.id, t.subjectId]))
  const rows = new Map<string, SubjectTrend>()
  const sums = new Map<string, number>()
  const row = (subjectId: string) => {
    let r = rows.get(subjectId)
    if (!r) {
      const s = getSubject(subjectId)
      r = { subjectId, name: s?.name ?? subjectId, colour: s?.colour ?? '#1e2330', weeks: axis.map((w) => ({ ...w, minutes: 0, marked: 0 })), minutes: 0, marked: 0 }
      rows.set(subjectId, r)
    }
    return r
  }

  for (const [key, m] of Object.entries(state.time)) {
    const p = parseTimeKey(key)
    const i = index.get(p.day)
    if (i === undefined || !p.subjectId || m <= 0) continue
    const r = row(p.subjectId)
    r.weeks[i]!.minutes += m
    r.minutes += m
  }
  for (const a of state.attempts) {
    const i = index.get(a.completedAt.slice(0, 10))
    const subjectId = topicSubject.get(a.topicId)
    if (i === undefined || !subjectId || a.kind === 'review') continue
    const r = row(subjectId)
    r.weeks[i]!.marked++
    r.marked++
    const k = `${subjectId}|${i}`
    sums.set(k, (sums.get(k) ?? 0) + pct(a))
  }
  for (const r of rows.values()) {
    r.weeks.forEach((w, i) => { if (w.marked) w.avgPct = Math.round((sums.get(`${r.subjectId}|${i}`) ?? 0) / w.marked) })
  }

  const subjects = [...rows.values()].sort((a, b) => b.minutes - a.minutes || b.marked - a.marked)
  return { weeks: axis, subjects }
}
