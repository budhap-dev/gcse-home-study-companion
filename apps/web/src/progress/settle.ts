import { BADGES, type Badge, type LevelInfo, type SubjectId } from '@study/shared'
import { awardBadges, getState, type ProgressState } from './store.ts'
import { earnedBadgeIds, levelBySubject } from './xp.ts'

export interface Settlement {
  newBadges: Badge[]
  levelUp?: { subjectId: SubjectId; level: LevelInfo }
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
  return { newBadges, levelUp }
}
