import { DEFAULT_GOAL_MINUTES, emptyState, type ProgressState } from './store.ts'

/**
 * Combines progress from two places so nothing is lost: attempts are united by id,
 * lessons keep the furthest step and the earliest completion, minutes take the
 * larger figure per day (both copies may already contain the same session), days
 * off and badges are united, and a goal the device never changed defers to the other.
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
  const minutes: ProgressState['minutes'] = { ...A.minutes }
  for (const [day, m] of Object.entries(B.minutes)) minutes[day] = Math.max(minutes[day] ?? 0, m)
  const badges: ProgressState['badges'] = { ...A.badges }
  for (const [id, at] of Object.entries(B.badges)) badges[id] = badges[id] && badges[id]! < at ? badges[id]! : at
  return {
    attempts: [...attempts.values()].sort((x, y) => x.completedAt.localeCompare(y.completedAt)),
    lessons,
    minutes,
    goalMinutes: A.goalMinutes !== DEFAULT_GOAL_MINUTES ? A.goalMinutes : B.goalMinutes,
    daysOff: [...new Set([...A.daysOff, ...B.daysOff])].sort(),
    badges,
  }
}
