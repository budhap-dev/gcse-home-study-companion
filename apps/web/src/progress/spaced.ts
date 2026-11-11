import type { TopicSummary } from '../content/index.ts'
import type { ProgressState } from './store.ts'
import { isoDate } from './store.ts'

/**
 * Spaced review (TRK-3) and mastery per skill (TRK-2), worked out from the answers already
 * stored with every attempt, so nothing new is recorded and two devices agree once merged.
 *
 * Each question answered sits in a box. A right answer on a later day than the last moves it up
 * a box, and the next review waits longer; a wrong one sends it back to the first box, due
 * tomorrow; part marks drop it one box. Right twice on the same day is still one recall, so it
 * moves the question once: the gap is what makes a memory stay.
 */
export const INTERVALS = [1, 3, 7, 16, 35, 80] as const

export interface Scheduled {
  topicId: string
  questionId: string
  box: number
  /** When it was last answered. */
  last: string
  due: Date
}

const DAY = 86400000

/** Every question the student has answered, with its box and the day it is next due. */
export function schedule(state: ProgressState): Map<string, Scheduled> {
  const answers = state.attempts
    .flatMap((a) => (a.questions ?? []).map((q) => ({ topicId: a.topicId, q, at: a.completedAt })))
    .sort((x, y) => x.at.localeCompare(y.at))
  const out = new Map<string, Scheduled & { lastRightDay?: string }>()
  for (const { topicId, q, at } of answers) {
    if (q.marksAvailable <= 0) continue
    const key = `${topicId}/${q.id}`
    const prev = out.get(key)
    const right = q.correct || Boolean(q.claimed)
    const day = isoDate(new Date(at))
    let box = prev?.box ?? 0
    let lastRightDay = prev?.lastRightDay
    if (right) {
      // The first right answer puts it in box 1; a later day's moves it up again.
      if (!prev) box = 1
      else if (lastRightDay !== day) box = Math.min(INTERVALS.length - 1, box + 1)
      lastRightDay = day
    } else if (q.marksScored > 0) {
      box = Math.max(0, box - 1)
    } else {
      box = 0
    }
    out.set(key, { topicId, questionId: q.id, box, last: at, due: new Date(Date.parse(at) + INTERVALS[box]! * DAY), lastRightDay })
  }
  return out
}

/**
 * The questions due for review now, the most overdue for their box first, from topics still in
 * the pack and only of the kinds the app marks. `exclude` leaves out ones asked already today.
 */
export function dueQuestions(topics: TopicSummary[], state: ProgressState, now = new Date(), exclude: ReadonlySet<string> = new Set()): Scheduled[] {
  const markable = new Set(topics.flatMap((t) => t.questions.filter((q) => q.type !== 'extended').map((q) => `${t.id}/${q.id}`)))
  return [...schedule(state).values()]
    .filter((s) => s.due <= now && markable.has(`${s.topicId}/${s.questionId}`) && !exclude.has(`${s.topicId}/${s.questionId}`))
    .map((s) => ({ s, late: (now.getTime() - s.due.getTime()) / (INTERVALS[s.box]! * DAY) }))
    .sort((a, b) => b.late - a.late || a.s.last.localeCompare(b.s.last))
    .map(({ s }) => s)
}

export interface SkillScore {
  skill: string
  /** Share of marks, newer answers counting more: weight halves every HALF_LIFE_DAYS. */
  score: number
  answers: number
}

export const HALF_LIFE_DAYS = 14

/** Each skill of a topic scored from its answers, weakest first (TRK-2). */
export function skillScores(topicId: string, state: ProgressState, now = new Date()): SkillScore[] {
  const bySkill = new Map<string, { got: number; of: number; answers: number }>()
  for (const a of state.attempts) {
    if (a.topicId !== topicId) continue
    const w = Math.pow(0.5, Math.max(0, now.getTime() - Date.parse(a.completedAt)) / (HALF_LIFE_DAYS * DAY))
    for (const q of a.questions ?? []) {
      if (q.marksAvailable <= 0) continue
      const s = bySkill.get(q.skill) ?? { got: 0, of: 0, answers: 0 }
      const got = q.claimed ? q.marksAvailable : q.marksScored
      s.got += w * got
      s.of += w * q.marksAvailable
      s.answers++
      bySkill.set(q.skill, s)
    }
  }
  return [...bySkill.entries()]
    .map(([skill, s]) => ({ skill, score: s.of > 0 ? s.got / s.of : 0, answers: s.answers }))
    .sort((a, b) => a.score - b.score || b.answers - a.answers || a.skill.localeCompare(b.skill))
}

/** Below this share of marks a skill is listed as weak. */
export const WEAK_BELOW = 0.7

/** The skills to work on in a topic: up to three scoring under WEAK_BELOW. */
export function weakestSkills(topicId: string, state: ProgressState, now = new Date()): SkillScore[] {
  return skillScores(topicId, state, now).filter((s) => s.score < WEAK_BELOW).slice(0, 3)
}
