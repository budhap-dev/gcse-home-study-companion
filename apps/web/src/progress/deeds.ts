import { deedById, deedOfTheDay, type Deed } from '@study/shared'
import { isoDate, type DeedRecord, type ProgressState } from './store.ts'

/** From this hour the card stops showing the deed and asks whether it was done. */
export const ASK_FROM_HOUR = 17

export interface DeedPrompt {
  /** The day the deed belongs to: today, or yesterday when yesterday's was never answered. */
  day: string
  deed: Deed
  /**
   * `show`: the deed for the day, to be done; `ask`: the evening's question, or yesterday's
   * left over; `answered`: the day's answer is in, so the card reports it.
   */
  phase: 'show' | 'ask' | 'answered'
  yesterday: boolean
  record?: DeedRecord
}

const dayBefore = (day: string) => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() - 1); return isoDate(d) }

/**
 * What the deed card should be doing now. Yesterday's deed comes first when it was shown
 * and never answered: a student who shut the app at teatime is asked the next morning,
 * not left with a gap. A deed that was never shown is never asked about.
 */
export function deedPrompt(state: Pick<ProgressState, 'deeds'>, now = new Date()): DeedPrompt {
  const today = isoDate(now)
  const yesterday = dayBefore(today)
  const left = state.deeds[yesterday]
  if (left && left.done === undefined) {
    return { day: yesterday, deed: deedById(left.id) ?? deedOfTheDay(new Date(yesterday + 'T12:00:00')), phase: 'ask', yesterday: true, record: left }
  }
  const record = state.deeds[today]
  const deed = (record && deedById(record.id)) ?? deedOfTheDay(now)
  if (record && record.done !== undefined) return { day: today, deed, phase: 'answered', yesterday: false, record }
  return { day: today, deed, phase: now.getHours() >= ASK_FROM_HOUR ? 'ask' : 'show', yesterday: false, record }
}

/** How many deeds the student has said they did. */
export function deedsDone(state: Pick<ProgressState, 'deeds'>): number {
  return Object.values(state.deeds).filter((d) => d.done).length
}

export interface DeedDay {
  day: string
  /** The deed shown that day, or nothing when the app was not opened. */
  deed?: Deed
  done?: boolean
}

/** The last `n` days ending today, oldest first, with what happened on each. */
export function recentDeeds(state: Pick<ProgressState, 'deeds'>, today = isoDate(), n = 7): DeedDay[] {
  const out: DeedDay[] = []
  let day = today
  for (let i = 0; i < n; i++) {
    const r = state.deeds[day]
    out.unshift({ day, deed: r ? deedById(r.id) : undefined, done: r?.done })
    day = dayBefore(day)
  }
  return out
}
