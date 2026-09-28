import { ResourceFile, SUBJECTS, type Resource } from '@study/shared'

/**
 * Formula sheets, the periodic table and the other reference pages, bundled at build time
 * from supabase/seed/resources the way the glossary is. They are small next to the topics,
 * and the list page shows every one of them at once, so there is nothing to fetch.
 */
const files = import.meta.glob('../../../../supabase/seed/resources/*.json', { eager: true, import: 'default' })

const subjectIndex = (id: string) => SUBJECTS.findIndex((s) => s.id === id)

/** Every resource, in subject order, then in the order its file lists them. */
export const RESOURCES: Resource[] = Object.values(files)
  .flatMap((raw) => ResourceFile.parse(raw).resources)
  .sort((a, b) => subjectIndex(a.subjectId) - subjectIndex(b.subjectId))

export function resourcesForSubject(subjectId: string): Resource[] {
  return RESOURCES.filter((r) => r.subjectId === subjectId)
}

export function getResource(subjectId: string, id: string): Resource | undefined {
  return RESOURCES.find((r) => r.subjectId === subjectId && r.id === id)
}

/** The resources that name this topic in their "Used in" list. */
export function resourcesForTopic(topicId: string): Resource[] {
  return RESOURCES.filter((r) => r.topics.includes(topicId))
}
