import { DEFAULT_THRESHOLDS, STATUS_LABEL, getSubject, type TopicStatus } from '@study/shared'
import type { TopicSummary } from '../content/index.ts'
import { buildTask, type Task } from './recommend.ts'
import { evidenceFor, isoDate, lastActivity, weekDays, type ProgressState, type TopicEvidence } from './store.ts'

/**
 * Where a topic sits on the map (Option C): one ordinal scale from not started to Mastered.
 *
 * Not started is its own level rather than the bottom of the status scale. The status rules
 * call an untouched topic "Not secure", which is right for the status and wrong for a map:
 * a topic nobody has opened and a topic whose quiz came back at 30% are different facts, and
 * a map that shaded them alike would show a Year 9 student forty weak topics on day one.
 */
export type MapLevel = 0 | 1 | 2 | 3 | 4

export const MAP_LEVEL_LABEL = ['Not started', 'Not secure', 'Developing', 'Secure', 'Mastered'] as const

const LEVEL_OF: Record<TopicStatus, MapLevel> = { 'not-secure': 1, developing: 2, secure: 3, 'grade-9-ready': 4 }

/** Has the student done anything on this topic: a lesson step, or a marked attempt. */
export function started(topicId: string, state: ProgressState): boolean {
  return Boolean(state.lessons[topicId]) || state.attempts.some((a) => a.topicId === topicId && a.kind !== 'review')
}

export interface MapSquare {
  topic: TopicSummary
  level: MapLevel
  evidence: TopicEvidence
}

export function square(topic: TopicSummary, state: ProgressState, now = new Date()): MapSquare {
  const evidence = evidenceFor(topic.id, state, now)
  return { topic, evidence, level: started(topic.id, state) ? LEVEL_OF[evidence.status] : 0 }
}

/** How many squares sit at each level, not started first. */
export function countLevels(squares: MapSquare[]): [number, number, number, number, number] {
  const counts: [number, number, number, number, number] = [0, 0, 0, 0, 0]
  for (const s of squares) counts[s.level]++
  return counts
}

/** Secure or Mastered: the figure the map's headlines count. */
export const isSecure = (s: MapSquare) => s.level >= 3

/** "3 mastered, 9 secure, 6 developing, 4 not secure, 49 not started": a map's accessible name. */
export function levelsSentence(counts: number[]): string {
  return [4, 3, 2, 1, 0].filter((l) => counts[l]! > 0).map((l) => `${counts[l]} ${MAP_LEVEL_LABEL[l]!.toLowerCase()}`).join(', ') || 'no topics'
}

export interface UnitGroup {
  id: string
  name: string
  squares: MapSquare[]
}

/**
 * A subject's squares grouped by unit, in the subject's unit order and each unit's teaching
 * order. `topics` is already in that order (content/index.ts), so grouping keeps it. A topic
 * whose unit is missing from the subject's list is still shown, under "Other topics", rather
 * than dropped: the map's promise is every topic.
 */
export function unitGroups(subjectId: string, topics: TopicSummary[], state: ProgressState, now = new Date()): UnitGroup[] {
  const subject = getSubject(subjectId)
  const units = subject?.units ?? []
  const groups = units.map((u) => ({ id: u.id, name: u.name, squares: [] as MapSquare[] }))
  const other: UnitGroup = { id: 'other', name: 'Other topics', squares: [] }
  for (const t of topics.filter((t) => t.subjectId === subjectId)) {
    const group = groups.find((g) => g.id === t.unitId) ?? other
    group.squares.push(square(t, state, now))
  }
  return [...groups, other].filter((g) => g.squares.length > 0)
}

export interface FixItem extends Task {
  /** A short why, for the card's second line: "Quiz 35%", "Fading: 7 weeks since". */
  note: string
}

/**
 * "Fix these first": started topics that are weakest, for a short list beside the map.
 * A topic that has faded comes first, since it was once known and a quiz brings it back;
 * then Not secure topics by lowest quiz score. Each offers the quiz, which is what moves a
 * topic up the scale. Untouched topics never appear: they are not weak, only new.
 */
export function fixFirst(topics: TopicSummary[], state: ProgressState, now = new Date(), limit = 3): FixItem[] {
  const out: FixItem[] = []
  const squares = topics.map((t) => square(t, state, now))
  for (const s of squares.filter((s) => s.evidence.decayedFrom)) {
    const last = lastActivity(s.topic.id, state)
    const weeks = last ? Math.floor((now.getTime() - last.getTime()) / (7 * 86400000)) : undefined
    out.push({ ...buildTask(s.topic, 'quiz', 'Faded after six weeks away. A quiz brings it back.'), note: weeks ? `Fading: ${weeks} weeks since` : 'Fading' })
  }
  const weak = squares.filter((s) => s.level === 1 && s.evidence.quizPct !== undefined && !s.evidence.decayedFrom)
  for (const s of weak.sort((a, b) => a.evidence.quizPct! - b.evidence.quizPct!)) {
    out.push({ ...buildTask(s.topic, 'quiz', 'The questions you missed are the ones to learn from.'), note: `Quiz ${Math.round(s.evidence.quizPct!)}%` })
  }
  return out.slice(0, limit)
}

export interface DayBar {
  day: string
  /** One letter, M to S. */
  label: string
  name: string
  minutes: number
  today: boolean
  future: boolean
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** This week, Monday to Sunday, with the minutes studied each day. */
export function daysThisWeek(state: ProgressState, today = isoDate()): DayBar[] {
  return weekDays(today).map((day, i) => ({
    day,
    label: DAY_NAMES[i]![0]!,
    name: DAY_NAMES[i]!,
    minutes: state.minutes[day] ?? 0,
    today: day === today,
    future: day > today,
  }))
}

/** The four rungs of the mastery ladder, lowest first: map levels 1 to 4. */
export const RUNGS = ['Not secure', 'Developing', 'Secure', 'Mastered'] as const

const pctText = (v: number | undefined, what: string) => (v === undefined ? `${what} not tried yet` : `${what} ${Math.round(v)}% so far`)

/**
 * What moves a topic up one rung, in the student's words, from the same thresholds the status
 * rules use (DEFAULT_THRESHOLDS), with where they stand against each. The app recommends and
 * never blocks, so this says what counts, not what is allowed.
 */
export function nextRung(s: MapSquare, lessonStarted: boolean): string {
  const t = DEFAULT_THRESHOLDS
  const e = s.evidence
  if (e.decayedFrom) return `It has faded after ${e.idleWeeks} weeks away. A quiz of ${t.secureQuizMin}% or more brings it back to ${STATUS_LABEL[e.decayedFrom]}.`
  switch (s.level) {
    case 0:
      return 'Start the lesson. It takes one idea at a time.'
    case 1:
      if (e.quizPct !== undefined) return `Developing needs ${t.developingQuizMin}% on the quiz. Last time ${Math.round(e.quizPct)}%.`
      return lessonStarted
        ? `Finish the lesson, then score ${t.developingQuizMin}% or more on the quiz to reach Developing.`
        : `Score ${t.developingQuizMin}% or more on the quiz to reach Developing.`
    case 2:
      return `Secure needs ${t.secureQuizMin}% on the quiz and ${t.secureHigherWorksheetMin}% on the Higher sheet. ${pctText(e.quizPct, 'Quiz')}; ${pctText(e.higherPct, 'Higher sheet')}.`
    case 3:
      return `Mastered needs ${t.grade9QuizMin}% on the quiz, its grade 8 to 9 questions included, and ${t.grade9AdvancedWorksheetMin}% on the Advanced sheet. ${pctText(e.quizPct, 'Quiz')}; ${pctText(e.advancedPct, 'Advanced sheet')}.`
    case 4:
      return `Top of the ladder. A quiz within ${t.decayAfterWeeks} weeks keeps it from fading.`
  }
}
