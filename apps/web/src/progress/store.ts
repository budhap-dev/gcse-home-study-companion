import { DEFAULT_THRESHOLDS, type TopicStatus, type WorksheetLevel } from '@study/shared'

/**
 * Progress lives in the browser until Gmail sign-in arrives. The shape mirrors the
 * database tables so a later sync is a straight upload. The status rules here are a
 * TypeScript mirror of compute_topic_status() in the database and must stay in step.
 */
export interface AttemptRecord {
  id: string
  topicId: string
  kind: 'quiz' | 'worksheet'
  level?: WorksheetLevel
  marksScored: number
  marksAvailable: number
  /** Marks on grade 8 to 9 questions only, for the Grade 9 ready rule. */
  grade89Scored?: number
  grade89Available?: number
  markedHow: 'auto' | 'self' | 'mixed'
  completedAt: string
}

export interface LessonRecord {
  topicId: string
  stepIndex: number
  completedAt?: string
  updatedAt: string
}

interface ProgressState {
  attempts: AttemptRecord[]
  lessons: Record<string, LessonRecord>
}

const KEY = 'study-companion.progress.v1'

function read(): ProgressState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as ProgressState
  } catch {
    // storage unavailable or corrupt: start clean
  }
  return { attempts: [], lessons: {} }
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

export function clearProgress() {
  write({ attempts: [], lessons: {} })
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
