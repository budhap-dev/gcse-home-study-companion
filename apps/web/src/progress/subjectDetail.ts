import { SUBJECTS, type TopicStatus, type WorksheetLevel } from '@study/shared'
import { topicsForSubject } from '../content/index.ts'
import { evidenceFor, parseTimeKey, type AttemptRecord, type ProgressState, type StudyKind } from './store.ts'

/**
 * One subject, read the way a parent asks about it: what was done, on which topic, and how
 * long went on each kind of work.
 *
 * Built from the same three stores as the dashboard (attempts, lessons, unmarked
 * activities) plus `time`, which is the only one that knows where a minute went. Pure and
 * read only, like the rest of the parent's summary, so it can be tested without a browser.
 */

export const STUDY_KINDS: StudyKind[] = ['lesson', 'quiz', 'worksheet', 'flashcards', 'cheat-sheet', 'why', 'exam-technique']

export const STUDY_LABEL: Record<StudyKind, string> = {
  lesson: 'Lesson',
  quiz: 'Quiz',
  worksheet: 'Worksheets',
  flashcards: 'Flashcards',
  'cheat-sheet': 'Cheat sheet',
  why: 'Where you meet it',
  'exam-technique': 'Exam technique',
}

export type Minutes = Partial<Record<StudyKind, number>>

export interface WorksheetSummary {
  level: WorksheetLevel
  count: number
  latestPct: number
  bestPct: number
}

export interface TopicActivity {
  topicId: string
  title: string
  status: TopicStatus
  lastActive?: string
  /** Minutes recorded against this topic, all kinds together. */
  minutes: number
  byKind: Minutes
  lesson?: { done: boolean; step: number; steps: number }
  quizzes: { count: number; latestPct?: number; bestPct?: number }
  worksheets: WorksheetSummary[]
  /** Days a deck was finished, and the most cards in one of them. */
  flashcards: { days: number; cards?: number }
  /** Days the page was opened. */
  cheatSheet: number
  why: number
}

export interface SubjectDetail {
  id: string
  name: string
  colour: string
  total: number
  /** Minutes recorded against this subject, every topic and the exam technique page. */
  minutes: number
  /** Always in STUDY_KINDS order, zeros included, so the list does not reorder between visits. */
  byKind: { kind: StudyKind; minutes: number }[]
  quizCount: number
  averageQuizPct?: number
  lastActive?: string
  examTechnique: { days: number; minutes: number; last?: string }
  /** Topics with anything recorded, most recent first. */
  topics: TopicActivity[]
  /** The rest, in the order the course teaches them. */
  notStarted: { topicId: string; title: string }[]
  /**
   * Study minutes across the whole account that were never filed by place: everything
   * before places were recorded. Not attributable to this subject, but a parent comparing
   * this page with the weekly total needs to know the difference exists.
   */
  unsplitMinutes: number
}

const pct = (a: AttemptRecord) => (a.marksAvailable > 0 ? Math.round((100 * a.marksScored) / a.marksAvailable) : 0)
const byTime = (a: AttemptRecord, b: AttemptRecord) => a.completedAt.localeCompare(b.completedAt)
const latestOf = (xs: (string | undefined)[]) => xs.filter((x): x is string => Boolean(x)).sort().at(-1)

/** Minutes on the account that no place accounts for, day by day, never below zero. */
export function unsplitMinutes(state: ProgressState): number {
  const filed: Record<string, number> = {}
  for (const [key, m] of Object.entries(state.time)) {
    const { day } = parseTimeKey(key)
    filed[day] = (filed[day] ?? 0) + m
  }
  return Object.entries(state.minutes).reduce((n, [day, m]) => n + Math.max(0, m - (filed[day] ?? 0)), 0)
}

/** Minutes per subject, for the dashboard's subject rows. */
export function minutesBySubject(state: ProgressState): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, m] of Object.entries(state.time)) {
    const { subjectId } = parseTimeKey(key)
    out[subjectId] = (out[subjectId] ?? 0) + m
  }
  return out
}

export function subjectDetail(state: ProgressState, subjectId: string): SubjectDetail | undefined {
  const subject = SUBJECTS.find((s) => s.id === subjectId)
  if (!subject) return undefined
  const topics = topicsForSubject(subjectId)
  const ids = new Set(topics.map((t) => t.id))

  const minutesByTopic = new Map<string, Minutes>()
  const subjectKinds: Minutes = {}
  const examDays = new Set<string>()
  let examMinutes = 0
  let examLast: string | undefined
  for (const [key, m] of Object.entries(state.time)) {
    const p = parseTimeKey(key)
    if (p.subjectId !== subjectId) continue
    subjectKinds[p.kind] = (subjectKinds[p.kind] ?? 0) + m
    if (p.topicId) {
      const row = minutesByTopic.get(p.topicId) ?? {}
      row[p.kind] = (row[p.kind] ?? 0) + m
      minutesByTopic.set(p.topicId, row)
    } else if (p.kind === 'exam-technique') {
      examMinutes += m
      examDays.add(p.day)
      examLast = latestOf([examLast, p.day])
    }
  }

  const attempts = state.attempts.filter((a) => ids.has(a.topicId)).sort(byTime)
  const activities = state.activities.filter((a) => a.subjectId === subjectId)
  for (const a of activities) {
    if (a.kind !== 'exam-technique' || a.topicId) continue
    examDays.add(a.at.slice(0, 10))
    examLast = latestOf([examLast, a.at.slice(0, 10)])
  }

  const rows: TopicActivity[] = []
  const notStarted: SubjectDetail['notStarted'] = []
  for (const topic of topics) {
    const theirs = attempts.filter((a) => a.topicId === topic.id)
    const acts = activities.filter((a) => a.topicId === topic.id)
    const lesson = state.lessons[topic.id]
    const byKind = minutesByTopic.get(topic.id) ?? {}
    const minutes = Object.values(byKind).reduce((n, m) => n + (m ?? 0), 0)
    if (!theirs.length && !acts.length && !lesson && !minutes) {
      notStarted.push({ topicId: topic.id, title: topic.title })
      continue
    }
    const quizzes = theirs.filter((a) => a.kind === 'quiz')
    const worksheets = (['core', 'higher', 'advanced'] as const).flatMap((level) => {
      const sheets = theirs.filter((a) => a.kind === 'worksheet' && a.level === level)
      return sheets.length
        ? [{ level, count: sheets.length, latestPct: pct(sheets.at(-1)!), bestPct: Math.max(...sheets.map(pct)) }]
        : []
    })
    const decks = acts.filter((a) => a.kind === 'flashcards')
    const timeDays = Object.keys(state.time)
      .map(parseTimeKey)
      .filter((p) => p.topicId === topic.id)
      .map((p) => p.day)
    rows.push({
      topicId: topic.id,
      title: topic.title,
      status: evidenceFor(topic.id, state).status,
      lastActive: latestOf([
        ...theirs.map((a) => a.completedAt),
        ...acts.map((a) => a.at),
        lesson?.updatedAt,
        // A day alone sorts before any time on that day, so it only wins when nothing
        // with a clock time happened later: minutes on a page that records nothing else.
        ...timeDays,
      ]),
      minutes,
      byKind,
      lesson: lesson && { done: Boolean(lesson.completedAt), step: lesson.stepIndex + 1, steps: topic.lesson.steps.length },
      quizzes: {
        count: quizzes.length,
        latestPct: quizzes.length ? pct(quizzes.at(-1)!) : undefined,
        bestPct: quizzes.length ? Math.max(...quizzes.map(pct)) : undefined,
      },
      worksheets,
      flashcards: { days: decks.length, cards: decks.length ? Math.max(...decks.map((d) => d.cards ?? 0)) || undefined : undefined },
      cheatSheet: acts.filter((a) => a.kind === 'cheat-sheet').length,
      why: acts.filter((a) => a.kind === 'why').length,
    })
  }
  rows.sort((a, b) => (b.lastActive ?? '').localeCompare(a.lastActive ?? '') || a.title.localeCompare(b.title))

  const quizzes = attempts.filter((a) => a.kind === 'quiz')
  const minutes = Object.values(subjectKinds).reduce((n, m) => n + (m ?? 0), 0)
  return {
    id: subject.id,
    name: subject.name,
    colour: subject.colour,
    total: topics.length,
    minutes,
    byKind: STUDY_KINDS.map((kind) => ({ kind, minutes: subjectKinds[kind] ?? 0 })),
    quizCount: quizzes.length,
    averageQuizPct: quizzes.length ? Math.round(quizzes.map(pct).reduce((a, b) => a + b, 0) / quizzes.length) : undefined,
    lastActive: latestOf([...rows.map((r) => r.lastActive), examLast]),
    examTechnique: { days: examDays.size, minutes: examMinutes, last: examLast },
    topics: rows,
    notStarted,
    unsplitMinutes: unsplitMinutes(state),
  }
}

export interface DayEntry {
  kind: StudyKind
  /** Minutes on this kind that day, when any were recorded. */
  minutes?: number
  /** What came of it, where something did: a score, a lesson position, a deck. */
  results: string[]
}

/**
 * One topic's history, a day at a time, newest first: for each day, each kind of work done
 * with the minutes it took and what came of it. This is the "what exactly did they do"
 * reading, where the topic row above it is the totals.
 */
export function topicDays(state: ProgressState, topicId: string): { day: string; entries: DayEntry[] }[] {
  const days = new Map<string, Map<StudyKind, DayEntry>>()
  const entry = (day: string, kind: StudyKind) => {
    const byKind = days.get(day) ?? new Map<StudyKind, DayEntry>()
    days.set(day, byKind)
    const e = byKind.get(kind) ?? { kind, results: [] }
    byKind.set(kind, e)
    return e
  }

  for (const [key, m] of Object.entries(state.time)) {
    const p = parseTimeKey(key)
    if (p.topicId !== topicId || m <= 0) continue
    const e = entry(p.day, p.kind)
    e.minutes = (e.minutes ?? 0) + m
  }
  for (const a of state.attempts.filter((x) => x.topicId === topicId).sort(byTime)) {
    // The kind is already the row's label, so only the worksheet's level is added to it.
    const level = a.level ? `${a.level[0]!.toUpperCase()}${a.level.slice(1)}, ` : ''
    entry(a.completedAt.slice(0, 10), a.kind).results.push(`${level}${a.marksScored}/${a.marksAvailable} (${pct(a)}%)`)
  }
  const lesson = state.lessons[topicId]
  if (lesson?.completedAt) entry(lesson.completedAt.slice(0, 10), 'lesson').results.push('finished')
  if (lesson && lesson.updatedAt.slice(0, 10) !== lesson.completedAt?.slice(0, 10)) {
    entry(lesson.updatedAt.slice(0, 10), 'lesson').results.push(lesson.completedAt ? 'went back over it' : `reached step ${lesson.stepIndex + 1}`)
  }
  for (const a of state.activities.filter((x) => x.topicId === topicId)) {
    const e = entry(a.at.slice(0, 10), a.kind)
    if (a.kind === 'flashcards' && a.cards) {
      e.results.push(`${a.cards} cards${a.turns && a.turns > a.cards ? ` in ${a.turns} turns` : ', all known first time'}`)
    } else if (!e.results.length) e.results.push('opened')
  }

  return [...days.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, byKind]) => ({
      day,
      entries: STUDY_KINDS.flatMap((k) => (byKind.has(k) ? [byKind.get(k)!] : [])),
    }))
}
