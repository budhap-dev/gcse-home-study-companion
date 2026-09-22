import { useEffect, useRef } from 'react'
import { recordActivity, type ActivityRecord } from './store.ts'

/**
 * Records that a page of unmarked revision was opened, once per visit.
 *
 * A ref rather than an empty dependency list alone, because React's development mode
 * mounts an effect twice: without it a single visit wrote twice, and while
 * `recordActivity` collapses a day's visits into one entry anyway, a double write would
 * still have doubled the flashcard counts through its `Math.max` on a second run.
 *
 * Deliberately on mount rather than after a dwell timer. The question a parent is asking
 * is "did they look at this", and the study minutes already answer "for how long".
 */
export function useRecordActivity(
  where: { subjectId?: string; topicId?: string } | undefined,
  kind: ActivityRecord['kind'],
  enabled = true,
) {
  const done = useRef(false)
  const subjectId = where?.subjectId
  const topicId = where?.topicId
  useEffect(() => {
    if (!enabled || !subjectId || done.current) return
    done.current = true
    recordActivity({ subjectId, topicId }, kind)
  }, [enabled, subjectId, topicId, kind])
}
