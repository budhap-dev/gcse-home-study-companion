import { Topic } from '@study/shared'
import { primeTopicCache } from './load.ts'

/**
 * Every topic in full, parsed. For tests only: the app loads full topics one at a time
 * (load.ts), and content-split.test.ts fails if anything outside a test imports this.
 */
const files = import.meta.glob('../../../../supabase/seed/content/**/*.json', { eager: true, import: 'default' })
export const ALL_TOPICS = Object.values(files).map((raw) => Topic.parse(raw))

export function getFullTopic(subjectId: string, topicId: string) {
  return ALL_TOPICS.find((t) => t.subjectId === subjectId && t.id === topicId)
}

// Tests that render a page get its topic at once, as a topic opened earlier in a visit would.
primeTopicCache(ALL_TOPICS)
