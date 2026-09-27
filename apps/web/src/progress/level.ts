import type { TopicStatus, WorksheetLevel } from '@study/shared'

/**
 * The worksheet level to start at for a topic's status, the same choice Home's
 * recommendation makes: Core until the idea is there, Higher once the quiz shows it is
 * (Developing), Advanced once the topic is Secure. The other levels stay one tap away;
 * the app suggests and never blocks (WKS-1).
 */
export function suggestedLevel(status: TopicStatus): WorksheetLevel {
  return status === 'not-secure' ? 'core' : status === 'developing' ? 'higher' : 'advanced'
}
