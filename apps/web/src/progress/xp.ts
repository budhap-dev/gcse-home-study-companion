import { BADGES, XP, levelFor, type LevelInfo, type SubjectId } from '@study/shared'
import { TOPICS } from '../content/index.ts'
import { evidenceFor, streakDays, weekMinutes, type ProgressState } from './store.ts'

const subjectOf = new Map(TOPICS.map((t) => [t.id, t.subjectId as SubjectId]))
const stepsOf = new Map(TOPICS.map((t) => [t.id, t.lesson.steps.length]))

/** XP per subject: every recorded attempt's XP plus lesson steps and completions. */
export function xpBySubject(state: ProgressState): Record<string, number> {
  const out: Record<string, number> = {}
  const add = (topicId: string, n: number) => {
    const s = subjectOf.get(topicId)
    if (!s) return
    out[s] = (out[s] ?? 0) + n
  }
  for (const a of state.attempts) add(a.topicId, a.xp ?? 0)
  for (const l of Object.values(state.lessons)) {
    const steps = l.completedAt ? (stepsOf.get(l.topicId) ?? l.stepIndex + 1) : l.stepIndex
    add(l.topicId, steps * XP.lessonStep + (l.completedAt ? XP.lessonComplete : 0))
  }
  return out
}

export function levelBySubject(state: ProgressState): Record<string, LevelInfo> {
  const xp = xpBySubject(state)
  const out: Record<string, LevelInfo> = {}
  for (const [s, n] of Object.entries(xp)) out[s] = levelFor(s as SubjectId, n)
  return out
}

export function totalXp(state: ProgressState): number {
  return Object.values(xpBySubject(state)).reduce((a, b) => a + b, 0)
}

/** Badges the state currently satisfies, whether or not they have been awarded yet. */
export function earnedBadgeIds(state: ProgressState): string[] {
  const ids: string[] = []
  const lessonsDone = Object.values(state.lessons).filter((l) => l.completedAt)
  const quizzes = state.attempts.filter((a) => a.kind === 'quiz')
  const pct = (a: { marksScored: number; marksAvailable: number }) => (a.marksAvailable ? (100 * a.marksScored) / a.marksAvailable : 0)
  if (lessonsDone.length > 0) ids.push('first-lesson')
  if (quizzes.length > 0) ids.push('first-quiz')
  if (quizzes.some((q) => pct(q) === 100)) ids.push('clean-sweep')
  if (state.attempts.some((a) => a.kind === 'worksheet' && a.level === 'advanced')) ids.push('advanced-first')
  const statuses = TOPICS.map((t) => evidenceFor(t.id, state).status)
  if (statuses.some((s) => s === 'secure' || s === 'grade-9-ready')) ids.push('secure-first')
  const ready = statuses.filter((s) => s === 'grade-9-ready').length
  if (ready >= 1) ids.push('grade-9-first')
  if (ready >= 5) ids.push('grade-9-five')
  const streak = streakDays(state)
  if (streak >= 3) ids.push('streak-3')
  if (streak >= 7) ids.push('streak-7')
  if (streak >= 30) ids.push('streak-30')
  // comeback: any topic where a later quiz beats an earlier one by 20 points
  const byTopic = new Map<string, number[]>()
  for (const q of [...quizzes].sort((a, b) => a.completedAt.localeCompare(b.completedAt))) {
    byTopic.set(q.topicId, [...(byTopic.get(q.topicId) ?? []), pct(q)])
  }
  for (const scores of byTopic.values()) {
    for (let i = 1; i < scores.length; i++) if (scores[i]! - Math.min(...scores.slice(0, i)) >= 20) ids.push('comeback')
  }
  if (weekMinutes(state) >= state.goalMinutes) ids.push('goal-week')
  if (new Set(lessonsDone.map((l) => subjectOf.get(l.topicId))).size >= 2) ids.push('subject-explorer')
  return [...new Set(ids)].filter((id) => BADGES.some((b) => b.id === id))
}

/** Skills with enough evidence, sorted by success rate. */
export interface SkillStat {
  skill: string
  subjectId: string
  attempts: number
  pct: number
}

export function skillStats(state: ProgressState): { strengths: SkillStat[]; weaknesses: SkillStat[] } {
  const acc = new Map<string, { subjectId: string; scored: number; available: number; n: number }>()
  for (const a of state.attempts) {
    const subjectId = subjectOf.get(a.topicId) ?? ''
    for (const q of a.questions ?? []) {
      const key = `${subjectId}|${q.skill}`
      const cur = acc.get(key) ?? { subjectId, scored: 0, available: 0, n: 0 }
      cur.scored += q.marksScored
      cur.available += q.marksAvailable
      cur.n += 1
      acc.set(key, cur)
    }
  }
  const stats: SkillStat[] = [...acc.entries()]
    .filter(([, v]) => v.n >= 2 && v.available > 0)
    .map(([key, v]) => ({ skill: key.split('|')[1]!, subjectId: v.subjectId, attempts: v.n, pct: Math.round((100 * v.scored) / v.available) }))
  return {
    strengths: stats.filter((s) => s.pct >= 80).sort((a, b) => b.pct - a.pct || b.attempts - a.attempts).slice(0, 5),
    weaknesses: stats.filter((s) => s.pct < 60).sort((a, b) => a.pct - b.pct || b.attempts - a.attempts).slice(0, 5),
  }
}

/** XP for a set of question results, using the shared weights. */
export function xpForQuestions(results: { gradeBand: '4-5' | '6-7' | '8-9'; correct: boolean; marksScored: number; marksAvailable: number }[]): number {
  let xp = 0
  for (const r of results) {
    if (r.marksScored > 0 || r.correct) xp += XP.question[r.gradeBand]
    if (r.correct) xp += XP.correctBonus[r.gradeBand]
  }
  if (results.length > 0 && results.every((r) => r.correct)) xp += XP.cleanSweep
  return xp
}
