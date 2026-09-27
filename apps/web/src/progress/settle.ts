import { BADGES, type Badge, type LevelInfo, type SubjectId } from '@study/shared'
import { awardBadges, getState, recordMilestones, type ProgressState } from './store.ts'
import { milestonesIn, type Milestone } from './milestones.ts'
import { earnedBadgeIds, levelBySubject } from './xp.ts'

export interface Settlement {
  newBadges: Badge[]
  levelUp?: { subjectId: SubjectId; level: LevelInfo }
  /** Topics mastered and units finished by this attempt, first time only (MTV-3). */
  milestones: Milestone[]
}

/**
 * Call with the state captured before an attempt or lesson was recorded. Awards
 * any badges now earned and reports a level change, so the screen can celebrate.
 */
export function settle(before: ProgressState): Settlement {
  const after = getState()
  const fresh = awardBadges(earnedBadgeIds(after))
  const newBadges = fresh.map((id) => BADGES.find((b) => b.id === id)!).filter(Boolean)
  const lb = levelBySubject(before)
  const la = levelBySubject(after)
  let levelUp: Settlement['levelUp']
  for (const [s, info] of Object.entries(la)) {
    if (info.level > (lb[s]?.level ?? 1)) levelUp = { subjectId: s as SubjectId, level: info }
  }
  // Celebrated only when this attempt crossed the line. Milestones already true before it,
  // such as topics mastered before milestones were recorded, are recorded quietly: the
  // first quiz after this shipped must not set off a celebration for every one of them.
  const already = new Set(milestonesIn(before).map((m) => m.id))
  const reached = milestonesIn(after)
  const fresh2 = new Set(recordMilestones(reached.map((m) => m.id)))
  return { newBadges, levelUp, milestones: reached.filter((m) => fresh2.has(m.id) && !already.has(m.id)) }
}
