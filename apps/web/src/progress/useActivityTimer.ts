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
 * One clock for every learning screen, ticking once a minute while any is open; each tick
 * files a minute against the place on screen at that moment.
 *
 * It used to be one clock per place, started when a screen opened at a place and stopped
 * when the place changed. A mixed worksheet, the daily recap and Redo my mistakes change
 * topic with every question, so the clock restarted every question and a question
 * answered inside a minute added nothing: a whole mixed worksheet could record no time at
 * all (8 October 2026). Now the place moves and the clock runs on.
 */
let current: StudyPlace | undefined
let holders = 0
let ticker: ReturnType<typeof setInterval> | null = null

function tick() {
  const visible = typeof document === 'undefined' || document.visibilityState === 'visible'
  if (current && countsAsStudy(Date.now(), lastInput, visible)) addStudyMinutes(1, isoDate(), current)
}

/** A learning screen is open at `place`: starts the clock, or moves it there. Exported for tests. */
export function enterPlace(place: StudyPlace) {
  listen()
  // Opening the screen, or its next question, is itself activity.
  lastInput = Date.now()
  current = place
  holders++
  if (!ticker) ticker = setInterval(tick, 60_000)
}

/**
 * The screen has closed or moved on. The clock stops only once nobody holds it, and that
 * is checked a moment later rather than at once: a screen moving to its next question
 * leaves and re-enters in the same breath, and stopping between the two would throw away
 * the part of a minute already spent. Exported for tests.
 */
export function leavePlace() {
  holders--
  queueMicrotask(() => {
    if (holders > 0) return
    holders = 0
    current = undefined
    if (ticker) clearInterval(ticker)
    ticker = null
  })
}

/**
 * Adds a study minute for each minute a learning screen is open, visible and in use, filed
 * against the place it was spent so a parent can see flashcards apart from quizzes.
 *
 * The place is taken apart into its fields for the dependency list: an object literal
 * built in the caller is new on every render and would re-enter the place on each render.
 */
export function useActivityTimer(place: StudyPlace | undefined, active = true) {
  const subjectId = place?.subjectId
  const topicId = place?.topicId
  const kind = place?.kind
  useEffect(() => {
    if (!active || !subjectId || !kind) return
    enterPlace({ subjectId, ...(topicId ? { topicId } : {}), kind })
    return leavePlace
  }, [active, subjectId, topicId, kind])
}
