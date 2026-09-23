import { DEFAULT_GOAL_MINUTES, emptyState, type ProgressState } from './store.ts'

/**
 * Combines progress from two places so nothing is lost: attempts are united by id,
 * lessons keep the furthest step and the earliest completion, activities are united by id
 * keeping the fuller deck run, minutes take the larger figure per day and time the larger
 * figure per place (both copies may already contain the same session), days off and badges are united, and a goal the device
 * never changed defers to the other.
 */
export function mergeProgress(a: Partial<ProgressState>, b: Partial<ProgressState>): ProgressState {
  const A = { ...emptyState(), ...a }, B = { ...emptyState(), ...b }
  const attempts = new Map<string, ProgressState['attempts'][number]>()
  for (const x of [...A.attempts, ...B.attempts]) {
    const prev = attempts.get(x.id)
    if (!prev || x.completedAt > prev.completedAt) attempts.set(x.id, x)
  }
  const lessons: ProgressState['lessons'] = { ...A.lessons }
  for (const [id, l] of Object.entries(B.lessons)) {
    const prev = lessons[id]
    if (!prev) { lessons[id] = l; continue }
    lessons[id] = {
      topicId: id,
      stepIndex: Math.max(prev.stepIndex, l.stepIndex),
      completedAt: [prev.completedAt, l.completedAt].filter(Boolean).sort()[0],
      updatedAt: prev.updatedAt > l.updatedAt ? prev.updatedAt : l.updatedAt,
    }
  }
  // An activity id is topic:kind:day, so the same revision done on two devices in one day
  // is one entry. Keep the larger card and turn counts rather than the later write: the
  // same deck finished on a phone and glanced at on a laptop should read as the full run.
  const activities = new Map<string, ProgressState['activities'][number]>()
  for (const x of [...A.activities, ...B.activities]) {
    const prev = activities.get(x.id)
    activities.set(x.id, prev
      ? { ...x, at: x.at > prev.at ? x.at : prev.at,
          cards: Math.max(x.cards ?? 0, prev.cards ?? 0) || undefined,
          turns: Math.max(x.turns ?? 0, prev.turns ?? 0) || undefined }
      : x)
  }
  const minutes: ProgressState['minutes'] = { ...A.minutes }
  for (const [day, m] of Object.entries(B.minutes)) minutes[day] = Math.max(minutes[day] ?? 0, m)
  // The same rule per place: both copies may hold the same quarter hour of flashcards.
  const time: ProgressState['time'] = { ...A.time }
  for (const [key, m] of Object.entries(B.time)) time[key] = Math.max(time[key] ?? 0, m)
  const badges: ProgressState['badges'] = { ...A.badges }
  for (const [id, at] of Object.entries(B.badges)) badges[id] = badges[id] && badges[id]! < at ? badges[id]! : at
  return {
    attempts: [...attempts.values()].sort((x, y) => x.completedAt.localeCompare(y.completedAt)),
    lessons,
    activities: [...activities.values()].sort((x, y) => x.at.localeCompare(y.at)),
    minutes,
    time,
    goalMinutes: A.goalMinutes !== DEFAULT_GOAL_MINUTES ? A.goalMinutes : B.goalMinutes,
    daysOff: [...new Set([...A.daysOff, ...B.daysOff])].sort(),
    badges,
  }
}
