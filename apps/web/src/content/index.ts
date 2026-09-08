import { Topic } from '@study/shared'
import type { Topic as TopicRecord } from '@study/shared'

/**
 * Content is bundled at build time from the content pack in the repository,
 * so the app works with no database. When sign-in and sync arrive, this module
 * is the one place to swap for a fetch from the published content bundles.
 */
const files = import.meta.glob('../../../../supabase/seed/content/**/*.json', { eager: true, import: 'default' })

export const TOPICS: TopicRecord[] = Object.values(files)
  .map((raw) => Topic.parse(raw))
  .sort((a, b) => a.title.localeCompare(b.title))

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
