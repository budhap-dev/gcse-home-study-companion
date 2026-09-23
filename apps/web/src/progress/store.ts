import { DEFAULT_THRESHOLDS, type TopicStatus, type WorksheetLevel } from '@study/shared'

/**
 * Progress lives in the browser until Gmail sign-in arrives. The shape mirrors the
 * database tables so a later sync is a straight upload. The status rules here are a
 * TypeScript mirror of compute_topic_status() in the database and must stay in step.
 */
export interface QuestionResult {
  id: string
  skill: string
  gradeBand: '4-5' | '6-7' | '8-9'
  marksScored: number
  marksAvailable: number
  correct: boolean
  /**
   * What the student actually answered, written out as text. Absent on attempts made
   * before this was recorded, and on extended questions, which are self-assessed rather
   * than typed in, so every reader has to cope with it being missing.
   */
  answer?: string
}

export interface AttemptRecord {
  id: string
  topicId: string
  kind: 'quiz' | 'worksheet'
  level?: WorksheetLevel
  marksScored: number
  marksAvailable: number
  /** Marks on grade 8 to 9 questions only, for the Mastered rule. */
  grade89Scored?: number
  grade89Available?: number
  markedHow: 'auto' | 'self' | 'mixed'
  completedAt: string
  /** XP earned by this attempt, computed when it was recorded. */
  xp?: number
  /** Per-question results, for strengths and weaknesses by skill. */
  questions?: QuestionResult[]
}

export interface LessonRecord {
  topicId: string
  stepIndex: number
  completedAt?: string
  updatedAt: string
}

/**
 * The parts of a topic that produce no attempt and no lesson position.
 *
 * A quiz and a worksheet leave an AttemptRecord because they are marked; a lesson leaves a
 * LessonRecord because it has a place in it. Flashcards, the cheat sheet, the why page and
 * the exam technique page left nothing at all, so a parent looking at Recent work saw an
 * empty list for an evening the student had spent revising. These are that evidence: no
 * score, because there is nothing to score, but a record that it happened.
 */
export interface ActivityRecord {
  id: string
  /**
   * Absent for exam technique, which is one page per subject rather than per topic. It is
   * reached from a topic tile, so a student meets it as part of a topic, but attributing it
   * to whichever topic they happened to come from would be inventing a fact.
   */
  topicId?: string
  subjectId: string
  kind: 'flashcards' | 'cheat-sheet' | 'why' | 'exam-technique'
  at: string
  /** Flashcards only: cards in the deck, and how many turns it took to know them all. */
  cards?: number
  turns?: number
}

/** Every kind of study screen, for time spent. The marked ones and the unmarked ones together. */
export type StudyKind = 'lesson' | 'quiz' | 'worksheet' | 'flashcards' | 'cheat-sheet' | 'why' | 'exam-technique'

/** Where a minute of study was spent. `topicId` is absent on the subject-wide exam technique page. */
export interface StudyPlace {
  subjectId: string
  topicId?: string
  kind: StudyKind
}

/**
 * The key a minute is filed under in `time`: day, subject, topic and kind, joined by `|`.
 *
 * A flat map of numbers rather than a list of sessions, for the same reason `minutes` is one:
 * two devices merge by taking the larger count per key, which cannot double a session that
 * both copies already hold. None of the four parts can contain a `|` — days are ISO dates,
 * ids are kebab case and kinds are fixed words.
 */
export function timeKey(day: string, place: StudyPlace): string {
  return `${day}|${place.subjectId}|${place.topicId ?? ''}|${place.kind}`
}

export function parseTimeKey(key: string): StudyPlace & { day: string } {
  const [day = '', subjectId = '', topicId = '', kind = ''] = key.split('|')
  return { day, subjectId, topicId: topicId || undefined, kind: kind as StudyKind }
}

export interface ProgressState {
  attempts: AttemptRecord[]
  lessons: Record<string, LessonRecord>
  /** Revision that produces no mark: flashcards, cheat sheet, why, exam technique. */
  activities: ActivityRecord[]
  /** Study minutes per calendar day, ISO date keys. */
  minutes: Record<string, number>
  /**
   * The same minutes, filed by where they were spent: see `timeKey`. Recorded since 23
   * September 2026, so a day before that has minutes and no `time`, and every reader has to
   * treat the difference as study that was not split rather than as study that did not
   * happen.
   */
  time: Record<string, number>
  /** Weekly goal in minutes. */
  goalMinutes: number
  /** ISO dates marked as days off; they do not break the streak. */
  daysOff: string[]
  /** Badge id to the ISO time it was earned. */
  badges: Record<string, string>
}

export const DEFAULT_GOAL_MINUTES = 180

export function emptyState(): ProgressState {
  return { attempts: [], lessons: {}, activities: [], minutes: {}, time: {}, goalMinutes: DEFAULT_GOAL_MINUTES, daysOff: [], badges: {} }
}

const KEY = 'study-companion.progress.v1'

function read(): ProgressState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const stored = JSON.parse(raw) as Partial<ProgressState>
      // A state written before `activities` existed has none, and every reader iterates it.
      return { ...emptyState(), ...stored, activities: stored.activities ?? [], time: stored.time ?? {} }
    }
  } catch {
    // storage unavailable or corrupt: start clean
  }
  return emptyState()
}

function write(state: ProgressState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // storage unavailable: progress is lost on reload, the app still works
  }
  listeners.forEach((fn) => fn())
}

const listeners = new Set<() => void>()
export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getState(): ProgressState {
  return read()
}

export function recordAttempt(attempt: AttemptRecord) {
  const state = read()
  state.attempts = [...state.attempts.filter((a) => a.id !== attempt.id), attempt]
  write(state)
}

/**
 * Records a piece of unmarked revision, at most once per topic, kind and day.
 *
 * Without the collapse a student flicking back to a cheat sheet four times in an evening
 * would push everything else out of a ten-item feed. A parent wants to know the sheet was
 * used that day, not how many times the tab was reopened.
 */
export function recordActivity(
  where: { subjectId: string; topicId?: string },
  kind: ActivityRecord['kind'],
  extra: { cards?: number; turns?: number } = {},
) {
  const state = read()
  const id = `${where.topicId ?? where.subjectId}:${kind}:${isoDate()}`
  const existing = state.activities.find((a) => a.id === id)
  state.activities = [
    ...state.activities.filter((a) => a.id !== id),
    // Keep the largest deck run of the day rather than the last, so a full run is not
    // hidden by a two-card glance at it afterwards.
    {
      id, topicId: where.topicId, subjectId: where.subjectId, kind, at: new Date().toISOString(),
      cards: Math.max(extra.cards ?? 0, existing?.cards ?? 0) || undefined,
      turns: Math.max(extra.turns ?? 0, existing?.turns ?? 0) || undefined,
    },
  ]
  write(state)
}

export function saveLessonPosition(topicId: string, stepIndex: number, completed = false) {
  const state = read()
  const existing = state.lessons[topicId]
  state.lessons[topicId] = {
    topicId,
    stepIndex,
    completedAt: completed ? new Date().toISOString() : existing?.completedAt,
    updatedAt: new Date().toISOString(),
  }
  write(state)
}

export function awardBadges(ids: string[]): string[] {
  const state = read()
  const fresh = ids.filter((id) => !state.badges[id])
  if (fresh.length === 0) return []
  const now = new Date().toISOString()
  for (const id of fresh) state.badges[id] = now
  write(state)
  return fresh
}

/** Replaces the whole state, used when the account's synced copy is merged in. */
export function replaceState(state: ProgressState) {
  write({ ...emptyState(), ...state })
}

export function clearProgress() {
  write(emptyState())
}

/**
 * The state with the given topics forgotten: their attempts, their place in the lesson, and
 * the revision recorded against them.
 *
 * Study minutes, the weekly goal, days off and badges are deliberately untouched. None of
 * them belongs to a topic — the minutes were still studied and the streak was still kept —
 * so resetting one topic must not cost a student a streak they earned.
 *
 * Pure, like evidenceFor, so it can be tested without a browser's localStorage.
 */
export function withoutTopics(state: ProgressState, topicIds: string[]): ProgressState {
  const wanted = new Set(topicIds)
  if (!wanted.size) return state
  return {
    ...state,
    attempts: state.attempts.filter((a) => !wanted.has(a.topicId)),
    lessons: Object.fromEntries(Object.entries(state.lessons).filter(([id]) => !wanted.has(id))),
    // A subject-wide activity has no topic and survives: resetting one topic did not undo it.
    activities: state.activities.filter((a) => !a.topicId || !wanted.has(a.topicId)),
  }
}

/** Forgets the given topics, leaving minutes, goal, days off and badges alone. */
export function clearTopicProgress(topicIds: string[]): void {
  if (!topicIds.length) return
  write(withoutTopics(read(), topicIds))
}

/** Local calendar date as YYYY-MM-DD. */
export function isoDate(d = new Date()): string {
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 10)
}

/**
 * Adds study time to the day, and, when the screen knows where it is, to that place too.
 * The daily total is still kept on its own because the weekly goal and every chart read it,
 * and because minutes recorded before places existed are only in it.
 */
export function addStudyMinutes(minutes: number, day = isoDate(), place?: StudyPlace) {
  const state = read()
  state.minutes[day] = (state.minutes[day] ?? 0) + minutes
  if (place) {
    const key = timeKey(day, place)
    state.time[key] = (state.time[key] ?? 0) + minutes
  }
  write(state)
}

export function setGoalMinutes(minutes: number) {
  const state = read()
  state.goalMinutes = Math.max(30, Math.min(2000, Math.round(minutes)))
  write(state)
}

export function toggleDayOff(day: string) {
  const state = read()
  state.daysOff = state.daysOff.includes(day) ? state.daysOff.filter((d) => d !== day) : [...state.daysOff, day]
  write(state)
}

/** Monday to Sunday containing `day`, as ISO dates. */
export function weekDays(day = isoDate()): string[] {
  const d = new Date(day + 'T12:00:00')
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(monday)
    x.setDate(monday.getDate() + i)
    return isoDate(x)
  })
}

export function weekMinutes(state: ProgressState, day = isoDate()): number {
  return weekDays(day).reduce((sum, d) => sum + (state.minutes[d] ?? 0), 0)
}

/** Days with a completed activity, counting back from today; days off are skipped, not broken on. */
export function streakDays(state: ProgressState, today = isoDate()): number {
  const active = new Set<string>()
  for (const a of state.attempts) active.add(a.completedAt.slice(0, 10))
  for (const l of Object.values(state.lessons)) if (l.completedAt) active.add(l.completedAt.slice(0, 10))
  const off = new Set(state.daysOff)
  let streak = 0
  const d = new Date(today + 'T12:00:00')
  // today counts if active; if not, the streak is still alive until tomorrow
  if (!active.has(isoDate(d))) d.setDate(d.getDate() - 1)
  for (let i = 0; i < 366; i++) {
    const key = isoDate(d)
    if (active.has(key)) streak++
    else if (!off.has(key)) break
    d.setDate(d.getDate() - 1)
  }
  return streak
}

function latest(attempts: AttemptRecord[], topicId: string, kind: 'quiz' | 'worksheet', level?: WorksheetLevel) {
  return attempts
    .filter((a) => a.topicId === topicId && a.kind === kind && (level ? a.level === level : true))
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0]
}

const pct = (a?: AttemptRecord) => (a && a.marksAvailable > 0 ? (100 * a.marksScored) / a.marksAvailable : undefined)

export interface TopicEvidence {
  status: TopicStatus
  lessonDone: boolean
  quizPct?: number
  quiz89Pct?: number
  higherPct?: number
  advancedPct?: number
}

/** Mirrors compute_topic_status() in supabase/migrations/20260902000003_activity_progress.sql. */
export function evidenceFor(topicId: string, state: ProgressState = read()): TopicEvidence {
  const t = DEFAULT_THRESHOLDS
  const quiz = latest(state.attempts, topicId, 'quiz')
  const quizPct = pct(quiz)
  const quiz89Pct =
    quiz && quiz.grade89Available && quiz.grade89Available > 0 ? (100 * (quiz.grade89Scored ?? 0)) / quiz.grade89Available : undefined
  const higherPct = pct(latest(state.attempts, topicId, 'worksheet', 'higher'))
  const advancedPct = pct(latest(state.attempts, topicId, 'worksheet', 'advanced'))
  const lessonDone = Boolean(state.lessons[topicId]?.completedAt)

  let status: TopicStatus = 'not-secure'
  if (
    quizPct !== undefined &&
    quizPct >= t.grade9QuizMin &&
    (quiz89Pct ?? quizPct) >= t.grade9QuizMin &&
    advancedPct !== undefined &&
    advancedPct >= t.grade9AdvancedWorksheetMin
  ) {
    status = 'grade-9-ready'
  } else if (quizPct !== undefined && quizPct >= t.secureQuizMin && higherPct !== undefined && higherPct >= t.secureHigherWorksheetMin) {
    status = 'secure'
  } else if ((quizPct !== undefined && quizPct >= t.developingQuizMin) || (quizPct === undefined && lessonDone)) {
    status = 'developing'
  }
  return { status, lessonDone, quizPct, quiz89Pct, higherPct, advancedPct }
}
