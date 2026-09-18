import { DEFAULT_THRESHOLDS, getSubject, type Topic, type WorksheetLevel } from '@study/shared'
import { evidenceFor, type ProgressState } from './store.ts'

export interface Task {
  kind: 'lesson' | 'quiz' | 'worksheet'
  level?: WorksheetLevel
  topic: Topic
  subjectName: string
  subjectColour: string
  title: string
  reason: string
  to: string
  minutes: number
}

/**
 * Builds the card a screen renders: title, route and estimated time for one activity.
 * Exported because an assigned task is the same object with a different reason for
 * existing, and it should route and be timed identically to a recommended one.
 */
export function buildTask(topic: Topic, kind: Task['kind'], reason: string, level?: WorksheetLevel): Task {
  const subject = getSubject(topic.subjectId)
  const base = `/subjects/${topic.subjectId}/topics/${topic.id}`
  const title = kind === 'lesson' ? 'Lesson' : kind === 'quiz' ? 'Quiz' : `${level === 'core' ? 'Core' : level === 'higher' ? 'Higher' : 'Advanced'} worksheet`
  const minutes = kind === 'lesson' ? Math.round(topic.lesson.steps.length * 1.5) : kind === 'quiz' ? Math.max(5, Math.round(topic.quiz.sampleSize * 0.8)) : topic.worksheets[level!].suggestedMinutes
  return {
    kind, level, topic, title, reason, minutes,
    subjectName: subject?.name ?? topic.subjectId,
    subjectColour: subject?.colour ?? '#1e2330',
    to: kind === 'lesson' ? `${base}/lesson` : kind === 'quiz' ? `${base}/quiz` : `${base}/worksheet/${level}`,
  }
}

/**
 * LRN-3 order: an unfinished lesson, then a topic due for recap, then the weakest
 * attempted topic, then a Secure topic to push to Mastered through its Advanced
 * worksheet, then the next topic not started. Returns the recommendation and two
 * alternatives so the student always has a choice (MOT-5).
 */
export function recommend(topics: Topic[], state: ProgressState, now = new Date()): { next: Task | null; alternatives: Task[] } {
  const ranked: Task[] = []
  const ev = new Map(topics.map((t) => [t.id, evidenceFor(t.id, state)]))
  const lastActivity = (t: Topic) => {
    const times = [...state.attempts.filter((a) => a.topicId === t.id).map((a) => a.completedAt), state.lessons[t.id]?.updatedAt].filter(Boolean) as string[]
    return times.length ? new Date(times.sort().at(-1)!) : undefined
  }

  // 1. unfinished lessons, most recently touched first
  for (const t of topics.filter((t) => state.lessons[t.id] && !state.lessons[t.id]!.completedAt).sort((a, b) => (state.lessons[b.id]!.updatedAt).localeCompare(state.lessons[a.id]!.updatedAt))) {
    ranked.push(buildTask(t, 'lesson', `You stopped at step ${state.lessons[t.id]!.stepIndex + 1} of ${t.lesson.steps.length}. Pick it back up.`))
  }
  // 2. due for recap: Secure or better and untouched for the decay period
  const decayMs = DEFAULT_THRESHOLDS.decayAfterWeeks * 7 * 86400000
  for (const t of topics) {
    const e = ev.get(t.id)!
    const last = lastActivity(t)
    if ((e.status === 'secure' || e.status === 'grade-9-ready') && last && now.getTime() - last.getTime() > decayMs) {
      ranked.push(buildTask(t, 'quiz', `Last seen ${Math.round((now.getTime() - last.getTime()) / 86400000 / 7)} weeks ago. A quick quiz keeps it fresh.`))
    }
  }
  // 3. weakest attempted topic, lowest quiz score first
  for (const t of topics.filter((t) => ev.get(t.id)!.quizPct !== undefined && ev.get(t.id)!.status !== 'grade-9-ready').sort((a, b) => ev.get(a.id)!.quizPct! - ev.get(b.id)!.quizPct!)) {
    const e = ev.get(t.id)!
    if (e.status === 'secure') continue
    const pct = Math.round(e.quizPct!)
    if (e.quizPct! >= DEFAULT_THRESHOLDS.secureQuizMin && e.higherPct === undefined) {
      ranked.push(buildTask(t, 'worksheet', `You understood the quiz. The Higher worksheet is where you use it.`, 'higher'))
    } else if (e.quizPct! >= DEFAULT_THRESHOLDS.secureQuizMin && e.higherPct !== undefined) {
      ranked.push(buildTask(t, 'worksheet', `Last Higher sheet ${Math.round(e.higherPct)}%. Go back over the working and try again.`, 'higher'))
    } else {
      ranked.push(buildTask(t, 'quiz', `Last time ${pct}%. The questions you missed are the ones to learn from.`))
    }
  }
  // 4. Secure topics: push through the Advanced worksheet
  for (const t of topics.filter((t) => ev.get(t.id)!.status === 'secure')) {
    const e = ev.get(t.id)!
    if (e.advancedPct === undefined) ranked.push(buildTask(t, 'worksheet', 'You have the idea. The Advanced worksheet stretches it.', 'advanced'))
    else if (e.quizPct! < DEFAULT_THRESHOLDS.grade9QuizMin) ranked.push(buildTask(t, 'quiz', 'Advanced sheet done. A quiz will show how much has stuck.'))
    else ranked.push(buildTask(t, 'worksheet', `Advanced sheet ${Math.round(e.advancedPct)}%. Another go with the solutions beside you.`, 'advanced'))
  }
  // 5. not started, in content order
  for (const t of topics.filter((t) => !state.lessons[t.id] && ev.get(t.id)!.quizPct === undefined)) {
    ranked.push(buildTask(t, 'lesson', 'New idea. One step at a time.'))
  }
  // 6. lesson done but no quiz
  for (const t of topics.filter((t) => state.lessons[t.id]?.completedAt && ev.get(t.id)!.quizPct === undefined)) {
    ranked.push(buildTask(t, 'quiz', 'Lesson done. The quiz shows what has stuck.'))
  }

  const seen = new Set<string>()
  const unique = ranked.filter((r) => {
    const k = `${r.topic.id}:${r.kind}:${r.level ?? ''}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return { next: unique[0] ?? null, alternatives: unique.slice(1, 3) }
}
