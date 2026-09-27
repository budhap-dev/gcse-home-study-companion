import { useEffect } from 'react'
import { addStudyMinutes, isoDate, type StudyPlace } from './store.ts'

/**
 * How long the screen may go untouched and still count as studying (TRK-7).
 *
 * Every minute a learning screen was visible used to count, so a quiz left open on the
 * table all evening read as hours of revision. A minute now counts only if someone
 * touched, typed, clicked or scrolled within the last three. Not one: an Advanced question
 * is often worked on paper for several minutes without touching the phone, and that is
 * studying too.
 */
export const IDLE_AFTER_MS = 3 * 60_000

let lastInput = Date.now()
let listening = false
function listen() {
  if (listening || typeof window === 'undefined') return
  listening = true
  const mark = () => { lastInput = Date.now() }
  for (const ev of ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll', 'input'] as const) {
    window.addEventListener(ev, mark, { passive: true, capture: true })
  }
}

/** Whether a minute ending now counts as study. Exported for tests. */
export function countsAsStudy(now: number, last: number, visible: boolean): boolean {
  return visible && now - last <= IDLE_AFTER_MS
}

/**
 * Adds a study minute for each minute a learning screen is open, visible and in use, filed
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
    listen()
    // Opening the screen is itself activity.
    lastInput = Date.now()
    const id = setInterval(() => {
      if (countsAsStudy(Date.now(), lastInput, document.visibilityState === 'visible')) addStudyMinutes(1, isoDate(), { subjectId, topicId, kind })
    }, 60_000)
    return () => clearInterval(id)
  }, [active, subjectId, topicId, kind])
}
