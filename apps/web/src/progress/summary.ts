import { DEFAULT_THRESHOLDS, SUBJECTS, TOPIC_STATUSES, type SubjectId, type TopicStatus } from '@study/shared'
import { TOPICS, topicsForSubject } from '../content/index.ts'
import { evidenceFor, isoDate, streakDays, weekDays, weekMinutes, type AttemptRecord, type ProgressState } from './store.ts'
import { skillStats, type SkillStat } from './xp.ts'

/**
 * The parent-facing reading of a progress state. Everything here is derived, pure and
 * read only: a parent watches, and the numbers come from the same helpers the student's
 * own Progress screen uses, so the two can never disagree about what has been done.
 *
 * The questions it is built to answer, in order: is the work happening, is it going in,
 * and where is it going wrong.
 */
export interface SubjectSummary {
  id: SubjectId
  name: string
  colour: string
  total: number
  /**
   * Statuses of the topics actually started. A topic nobody has opened scores
   * `not-secure` from the threshold rules, which is true but useless on a parent's
   * screen: it paints a whole untouched subject in the failing colour. Untouched topics
   * are counted separately as `notStarted` so the picture says "not begun" rather than
   * "going badly".
   */
  counts: Record<TopicStatus, number>
  /** Topics with any activity at all — a lesson opened or an attempt made. */
  started: number
  notStarted: number
  lastActive?: string
}

export interface StuckTopic {
  topicId: string
  title: string
  subjectId: string
  subjectName: string
  /** Latest quiz percentage, when there is one. */
  pct?: number
  attempts: number
  reason: 'low-score' | 'no-quiz'
}

export interface ParentSummary {
  /** ISO date of the most recent finished lesson or attempt. */
  lastActive?: string
  daysSinceActive?: number
  weekMinutes: number
  goalMinutes: number
  /** Days this week with any recorded study time. */
  activeDays: number
  streak: number
  quizCount: number
  /** Mean percentage across the last ten quizzes. */
  averageQuizPct?: number
  /** Last five quizzes against the five before them, in percentage points. */
  trend?: number
  subjects: SubjectSummary[]
  strengths: SkillStat[]
  needsWork: SkillStat[]
  stuck: StuckTopic[]
  recent: AttemptRecord[]
  topicsMastered: number
  topicsStarted: number
}

const pct = (a: AttemptRecord) => (a.marksAvailable > 0 ? (100 * a.marksScored) / a.marksAvailable : 0)
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined)

/** Every day on which something was finished, as ISO dates. */
export function activeDates(state: ProgressState): string[] {
  const days = new Set<string>()
  for (const a of state.attempts) days.add(a.completedAt.slice(0, 10))
  for (const l of Object.values(state.lessons)) if (l.completedAt) days.add(l.completedAt.slice(0, 10))
  for (const [day, minutes] of Object.entries(state.minutes)) if (minutes > 0) days.add(day)
  return [...days].sort()
}

export function parentSummary(state: ProgressState, today = isoDate()): ParentSummary {
  const days = activeDates(state)
  const lastActive = days.at(-1)
  const daysSinceActive = lastActive
    ? Math.round((new Date(today + 'T12:00:00').getTime() - new Date(lastActive + 'T12:00:00').getTime()) / 86400000)
    : undefined

  const quizzes = state.attempts.filter((a) => a.kind === 'quiz').sort((a, b) => a.completedAt.localeCompare(b.completedAt))
  const scores = quizzes.map(pct)
  const last5 = scores.slice(-5)
  const prev5 = scores.slice(-10, -5)
  const before = mean(prev5)
  const after = mean(last5)
  // A trend needs something to compare against, so it only appears from the sixth quiz.
  const trend = before !== undefined && after !== undefined ? Math.round(after - before) : undefined

  const touched = new Set<string>([...state.attempts.map((a) => a.topicId), ...Object.keys(state.lessons)])
  const subjects: SubjectSummary[] = SUBJECTS.filter((s) => topicsForSubject(s.id).length > 0).map((s) => {
    const topics = topicsForSubject(s.id)
    const counts = Object.fromEntries(TOPIC_STATUSES.map((st) => [st, 0])) as Record<TopicStatus, number>
    for (const t of topics) if (touched.has(t.id)) counts[evidenceFor(t.id, state).status] += 1
    const started = topics.filter((t) => touched.has(t.id)).length
    const ids = new Set(topics.map((t) => t.id))
    const stamps = [
      ...state.attempts.filter((a) => ids.has(a.topicId)).map((a) => a.completedAt.slice(0, 10)),
      ...Object.values(state.lessons).filter((l) => ids.has(l.topicId)).map((l) => l.updatedAt.slice(0, 10)),
    ].sort()
    return {
      id: s.id as SubjectId,
      name: s.name,
      colour: s.colour,
      total: topics.length,
      counts,
      started,
      notStarted: topics.length - started,
      lastActive: stamps.at(-1),
    }
  })

  /**
   * Where a parent can actually help. A topic counts as stuck when the student has put
   * work into it and it has not come good: either the latest quiz is below the passing
   * threshold, or the lesson is finished and no quiz has been attempted at all. Topics
   * never opened are not stuck, they are simply not started yet, and listing those would
   * bury the handful that need a conversation under a hundred that do not.
   */
  const titleOf = new Map(TOPICS.map((t) => [t.id, t]))
  const subjectName = new Map<string, string>(SUBJECTS.map((s) => [s.id, s.name]))
  const stuck: StuckTopic[] = []
  for (const topicId of touched) {
    const topic = titleOf.get(topicId)
    if (!topic) continue
    const theirs = state.attempts.filter((a) => a.topicId === topicId)
    const lastQuiz = theirs.filter((a) => a.kind === 'quiz').sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0]
    const lessonDone = Boolean(state.lessons[topicId]?.completedAt)
    const row = {
      topicId,
      title: topic.title,
      subjectId: topic.subjectId,
      subjectName: subjectName.get(topic.subjectId) ?? topic.subjectId,
      attempts: theirs.length,
    }
    if (lastQuiz && pct(lastQuiz) < DEFAULT_THRESHOLDS.developingQuizMin) stuck.push({ ...row, pct: Math.round(pct(lastQuiz)), reason: 'low-score' })
    else if (!lastQuiz && lessonDone) stuck.push({ ...row, reason: 'no-quiz' })
  }
  stuck.sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101) || a.title.localeCompare(b.title))

  const { strengths, weaknesses } = skillStats(state)
  const week = weekDays(today)
  return {
    lastActive,
    daysSinceActive,
    weekMinutes: weekMinutes(state, today),
    goalMinutes: state.goalMinutes,
    activeDays: week.filter((d) => (state.minutes[d] ?? 0) > 0).length,
    streak: streakDays(state, today),
    quizCount: quizzes.length,
    averageQuizPct: scores.length ? Math.round(mean(scores.slice(-10))!) : undefined,
    trend,
    subjects,
    strengths,
    needsWork: weaknesses,
    stuck: stuck.slice(0, 8),
    recent: [...state.attempts].sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, 10),
    topicsMastered: subjects.reduce((n, s) => n + s.counts['grade-9-ready'] + s.counts.secure, 0),
    topicsStarted: [...touched].filter((id) => titleOf.has(id)).length,
  }
}
