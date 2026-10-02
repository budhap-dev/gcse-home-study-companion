import { summaryById } from './index.ts'

/**
 * A question can be redone on the Mistakes screen if it still exists and is marked by the
 * app: an extended answer is self-marked.
 *
 * Its own module because Home counts the mistakes waiting and needs only this, and taking
 * it from the Mistakes screen made Home's download carry every question type and diagram.
 */
export function redoable(topicId: string, questionId: string): boolean {
  const q = summaryById(topicId)?.questions.find((x) => x.id === questionId)
  return Boolean(q && q.type !== 'extended')
}
