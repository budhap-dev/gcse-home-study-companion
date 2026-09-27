import { getSubject, SUBJECTS, SubjectGuide } from '@study/shared'
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
  questions: { id: string; type: Question['type']; marks: number; skill: string; gradeBand: GradeBand }[]
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
