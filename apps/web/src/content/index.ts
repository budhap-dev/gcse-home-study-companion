import { getSubject, SUBJECTS, SubjectGuide, Topic } from '@study/shared'
import type { SubjectGuide as GuideRecord, Topic as TopicRecord } from '@study/shared'

/**
 * Content is bundled at build time from the content pack in the repository,
 * so the app works with no database. When sign-in and sync arrive, this module
 * is the one place to swap for a fetch from the published content bundles.
 */
const files = import.meta.glob('../../../../supabase/seed/content/**/*.json', { eager: true, import: 'default' })

/** Subject order, then unit order within the subject, then the topic's own order in the unit, then title: the order topics are met. */
function order(t: TopicRecord): [number, number, number, string] {
  const subject = getSubject(t.subjectId)
  const unitIndex = subject?.units.findIndex((u) => u.id === t.unitId) ?? 99
  const subjectIndex = SUBJECTS.findIndex((s) => s.id === t.subjectId)
  return [subjectIndex < 0 ? 99 : subjectIndex, unitIndex < 0 ? 99 : unitIndex, t.order ?? 999, t.title]
}

export const TOPICS: TopicRecord[] = Object.values(files)
  .map((raw) => Topic.parse(raw))
  .sort((a, b) => {
    const [sa, ua, oa, ta] = order(a)
    const [sb, ub, ob, tb] = order(b)
    return sa - sb || ua - ub || oa - ob || ta.localeCompare(tb)
  })

export function topicsForSubject(subjectId: string): TopicRecord[] {
  return TOPICS.filter((t) => t.subjectId === subjectId)
}

export function topicsForUnit(subjectId: string, unitId: string): TopicRecord[] {
  return TOPICS.filter((t) => t.subjectId === subjectId && t.unitId === unitId)
}

export function getTopic(subjectId: string, topicId: string): TopicRecord | undefined {
  return TOPICS.find((t) => t.subjectId === subjectId && t.id === topicId)
}

export function totalMarks(topic: TopicRecord, questionIds: string[]): number {
  return questionIds.reduce((sum, id) => sum + (topic.questions.find((q) => q.id === id)?.marks ?? 0), 0)
}

const guideFiles = import.meta.glob('../../../../supabase/seed/guides/*.json', { eager: true, import: 'default' })

export const GUIDES: GuideRecord[] = Object.values(guideFiles).map((raw) => SubjectGuide.parse(raw))

export function getGuide(subjectId: string): GuideRecord | undefined {
  return GUIDES.find((g) => g.subjectId === subjectId)
}
