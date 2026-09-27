import { getSubject, type TopicStatus } from '@study/shared'
import { TOPICS } from '../content/index.ts'
import { evidenceFor, isoDate, parseTimeKey, weekDays, type ProgressState } from './store.ts'

export interface WeekSide {
  minutes: number
  /** Mean percentage of the quizzes and worksheets finished that week. */
  avgPct?: number
  marked: number
}

export interface WeekRow {
  subjectId: string
  name: string
  colour: string
  last: WeekSide
  this: WeekSide
  /** Topics whose status rose this week, and fell (after six weeks untouched). */
  up: number
  down: number
}

const RANK: Record<TopicStatus, number> = { 'not-secure': 0, developing: 1, secure: 2, 'grade-9-ready': 3 }
const pct = (a: { marksScored: number; marksAvailable: number }) => (a.marksAvailable ? (100 * a.marksScored) / a.marksAvailable : 0)

/**
 * This week against last, per subject (TRK-5): minutes studied, the average mark on
 * quizzes and worksheets, and how many topics moved. A topic's status at the start of the
 * week is worked out from the progress as it stood then, by the same rules, so "moved up"
 * means it really crossed a threshold this week, not that it was touched.
 *
 * Weeks run Monday to Sunday, as the weekly goal does. Redo sessions count as study time
 * but not towards the average, since they are questions already got wrong once.
 */
export function weekOnWeek(state: ProgressState, today = isoDate()): { rows: WeekRow[]; total: Omit<WeekRow, 'subjectId' | 'name' | 'colour'> } {
  const thisWeek = weekDays(today)
  const monday = thisWeek[0]!
  const lastMonday = new Date(monday + 'T12:00:00')
  lastMonday.setDate(lastMonday.getDate() - 7)
  const lastWeek = weekDays(isoDate(lastMonday))
  const which = (day: string) => (thisWeek.includes(day) ? 'this' : lastWeek.includes(day) ? 'last' : undefined)

  const topicSubject = new Map(TOPICS.map((t) => [t.id, t.subjectId]))
  const rows = new Map<string, WeekRow>()
  const row = (subjectId: string) => {
    let r = rows.get(subjectId)
    if (!r) {
      const s = getSubject(subjectId)
      r = { subjectId, name: s?.name ?? subjectId, colour: s?.colour ?? '#1e2330', last: { minutes: 0, marked: 0 }, this: { minutes: 0, marked: 0 }, up: 0, down: 0 }
      rows.set(subjectId, r)
    }
    return r
  }

  for (const [key, m] of Object.entries(state.time)) {
    const p = parseTimeKey(key)
    const w = which(p.day)
    if (w && p.subjectId && m > 0) row(p.subjectId)[w].minutes += m
  }
  const sums = new Map<string, number>()
  for (const a of state.attempts) {
    const w = which(a.completedAt.slice(0, 10))
    const subjectId = topicSubject.get(a.topicId)
    if (!w || !subjectId || a.kind === 'review') continue
    const side = row(subjectId)[w]
    const k = `${subjectId}|${w}`
    sums.set(k, (sums.get(k) ?? 0) + pct(a))
    side.marked++
  }
  for (const r of rows.values()) {
    for (const w of ['last', 'this'] as const) if (r[w].marked) r[w].avgPct = Math.round((sums.get(`${r.subjectId}|${w}`) ?? 0) / r[w].marked)
  }

  // Status then and now, for every topic touched in either store.
  const startOfWeek = new Date(monday + 'T00:00:00')
  const before: ProgressState = {
    ...state,
    attempts: state.attempts.filter((a) => new Date(a.completedAt) < startOfWeek),
    lessons: Object.fromEntries(Object.entries(state.lessons).filter(([, l]) => l.completedAt && new Date(l.completedAt) < startOfWeek)),
  }
  const touched = new Set([...state.attempts.map((a) => a.topicId), ...Object.keys(state.lessons)])
  const now = new Date(today + 'T23:59:59')
  for (const topicId of touched) {
    const subjectId = topicSubject.get(topicId)
    if (!subjectId) continue
    const was = RANK[evidenceFor(topicId, before, startOfWeek).status]
    const is = RANK[evidenceFor(topicId, state, now).status]
    if (is > was) row(subjectId).up++
    else if (is < was) row(subjectId).down++
  }

  const list = [...rows.values()]
    .filter((r) => r.last.minutes || r.this.minutes || r.last.marked || r.this.marked || r.up || r.down)
    .sort((a, b) => b.this.minutes + b.last.minutes - (a.this.minutes + a.last.minutes))
  const side = (w: 'last' | 'this'): WeekSide => {
    const marked = list.reduce((s, r) => s + r[w].marked, 0)
    const sum = list.reduce((s, r) => s + (sums.get(`${r.subjectId}|${w}`) ?? 0), 0)
    return { minutes: list.reduce((s, r) => s + r[w].minutes, 0), marked, avgPct: marked ? Math.round(sum / marked) : undefined }
  }
  return { rows: list, total: { last: side('last'), this: side('this'), up: list.reduce((s, r) => s + r.up, 0), down: list.reduce((s, r) => s + r.down, 0) } }
}
