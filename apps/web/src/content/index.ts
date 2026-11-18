import { compareSpecPoints, getSubject, specPlace, SUBJECTS, SubjectGuide } from '@study/shared'
import type { GradeBand, Question, SubjectGuide as GuideRecord, WorksheetLevel } from '@study/shared'

import catalogue from 'virtual:topic-catalogue'

/**
 * What the app knows about every topic up front: enough to list, count, recommend and
 * plan across topics, and nothing more. It is built from the content pack at build time
 * (contentPlugin.ts). A topic's lessons, questions and solutions are fetched when the
 * topic is opened (load.ts): shipping and validating all 358 in full made the first
 * download 4.7 MB compressed.
 */
export interface TopicSummary {
  id: string
  subjectId: string
  unitId: string
  title: string
  year: 9 | 10 | 11
  specPoints: string[]
  specCode?: string
  order?: number
  /** How many "where you meet it" examples the topic has. */
  whyExamples: number
  lesson: { steps: { id: string; title: string; kind: string; checkSkill?: string }[] }
  worksheets: Record<WorksheetLevel, { questionIds: string[]; suggestedMinutes: number }>
  quiz: { questionIds: string[]; sampleSize: number }
  /**
   * `stemId`: the multi-part question a question is a part of, by its context id.
   * `challenge`: the other topics a Challenge problem draws on (section 13, box 12).
   */
  questions: { id: string; type: Question['type']; marks: number; skill: string; gradeBand: GradeBand; stemId?: string; challenge?: { draws: string[] } }[]
}

/** Subject order, then unit order within the subject, then the topic's own order in the unit, then title: the order topics are met. */
function order(t: TopicSummary): [number, number, number, string] {
  const subject = getSubject(t.subjectId)
  const unitIndex = subject?.units.findIndex((u) => u.id === t.unitId) ?? 99
  const subjectIndex = SUBJECTS.findIndex((s) => s.id === t.subjectId)
  return [subjectIndex < 0 ? 99 : subjectIndex, unitIndex < 0 ? 99 : unitIndex, t.order ?? 999, t.title]
}

export const TOPICS: TopicSummary[] = [...catalogue].sort((a, b) => {
  const [sa, ua, oa, ta] = order(a)
  const [sb, ub, ob, tb] = order(b)
  return sa - sb || ua - ub || oa - ob || ta.localeCompare(tb)
})

export function topicsForSubject(subjectId: string): TopicSummary[] {
  return TOPICS.filter((t) => t.subjectId === subjectId)
}

export function topicsForUnit(subjectId: string, unitId: string): TopicSummary[] {
  return TOPICS.filter((t) => t.subjectId === subjectId && t.unitId === unitId)
}

/**
 * Topics in the exam board's order rather than the school's: by subject and unit as ever
 * (the units are the board's own), then by where each topic sits in the specification
 * (specPlace). A topic with no numbered point, such as a bridging topic or any English,
 * French or Music topic, goes first in its unit in the school's order, since a bridging
 * topic leads into its unit. Two topics at the same point keep the order they are taught in.
 */
export function specOrdered<T extends TopicSummary>(topics: T[]): T[] {
  const key = (t: T) => {
    const [s, u] = order(t)
    return { s, u, home: specPlace(t)?.home }
  }
  const keyed = topics.map((t, i) => ({ t, i, k: key(t) }))
  keyed.sort((a, b) =>
    a.k.s - b.k.s || a.k.u - b.k.u
    || (a.k.home ? 1 : 0) - (b.k.home ? 1 : 0)
    || (a.k.home && b.k.home ? compareSpecPoints(a.k.home, b.k.home) : 0)
    || a.t.year - b.t.year || a.i - b.i)
  return keyed.map((x) => x.t)
}

/** School years this subject has topics for, in order. */
export function yearsForSubject(subjectId: string): number[] {
  return [...new Set(topicsForSubject(subjectId).map((t) => t.year))].sort((a, b) => a - b)
}

/** Topics of one subject taught in one school year, in the order they are met. */
export function topicsForYear(subjectId: string, year: number): TopicSummary[] {
  return topicsForSubject(subjectId).filter((t) => t.year === year)
}

const byId = new Map(TOPICS.map((t) => [t.id, t]))

/** A topic's summary. For its full content use useTopic or loadTopic (load.ts). */
export function getSummary(subjectId: string, topicId: string): TopicSummary | undefined {
  const t = byId.get(topicId)
  return t && t.subjectId === subjectId ? t : undefined
}

/** A topic's summary by id alone, for records that store only the topic. */
export function summaryById(topicId: string): TopicSummary | undefined {
  return byId.get(topicId)
}

export function totalMarks(topic: Pick<TopicSummary, 'questions'>, questionIds: string[]): number {
  return questionIds.reduce((sum, id) => sum + (topic.questions.find((q) => q.id === id)?.marks ?? 0), 0)
}

const guideFiles = import.meta.glob('../../../../supabase/seed/guides/*.json', { eager: true, import: 'default' })

export const GUIDES: GuideRecord[] = Object.values(guideFiles).map((raw) => SubjectGuide.parse(raw))

export function getGuide(subjectId: string): GuideRecord | undefined {
  return GUIDES.find((g) => g.subjectId === subjectId)
}
