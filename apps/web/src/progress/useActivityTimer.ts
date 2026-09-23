import { useEffect } from 'react'
import { addStudyMinutes, isoDate, type StudyPlace } from './store.ts'

/**
 * Adds a study minute for each minute a learning screen stays open and visible, filed
 * against the place it was spent so a parent can see flashcards apart from quizzes.
 *
 * The place is taken apart into its fields for the dependency list: an object literal
 * built in the caller is new on every render and would restart the interval each time,
 * so no minute would ever complete.
 */
export function useActivityTimer(place: StudyPlace | undefined, active = true) {
  const subjectId = place?.subjectId
  const topicId = place?.topicId
  const kind = place?.kind
  useEffect(() => {
    if (!active || !subjectId || !kind) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') addStudyMinutes(1, isoDate(), { subjectId, topicId, kind })
    }, 60_000)
    return () => clearInterval(id)
  }, [active, subjectId, topicId, kind])
}
