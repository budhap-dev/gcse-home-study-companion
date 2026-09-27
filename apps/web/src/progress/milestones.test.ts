import { beforeEach, describe, expect, it } from 'vitest'
import { TOPICS } from '../content/index.ts'
import { describeMilestone, milestonesIn } from './milestones.ts'
import { mergeProgress } from './merge.ts'
import { emptyState, type AttemptRecord, type ProgressState } from './store.ts'

const now = new Date('2026-09-26T12:00:00Z')
const at = (topicId: string, kind: 'quiz' | 'worksheet', level: 'higher' | 'advanced' | undefined, pct: number): AttemptRecord =>
  ({ id: `${topicId}-${kind}-${level}`, topicId, kind, level, marksScored: pct, marksAvailable: 100, markedHow: 'auto', completedAt: '2026-09-25T10:00:00Z' }) as AttemptRecord
const mastered = (id: string) => [at(id, 'quiz', undefined, 95), at(id, 'worksheet', 'advanced', 90)]
const secure = (id: string) => [at(id, 'quiz', undefined, 85), at(id, 'worksheet', 'higher', 80)]

describe('milestones', () => {
  const unitTopics = TOPICS.filter((t) => t.subjectId === 'maths' && t.unitId === 'probability')
  beforeEach(() => expect(unitTopics.length).toBeGreaterThan(1))

  it('marks a topic mastered, and nothing for a topic only Secure', () => {
    const [a, b] = unitTopics
    const ids = milestonesIn({ ...emptyState(), attempts: [...mastered(a!.id), ...secure(b!.id)] }, now).map((m) => m.id)
    expect(ids).toContain(`mastered:${a!.id}`)
    expect(ids).not.toContain(`mastered:${b!.id}`)
    expect(ids.some((i) => i.startsWith('unit:'))).toBe(false)
  })

  it('marks a unit finished once every topic in it is Secure or better', () => {
    const state: ProgressState = { ...emptyState(), attempts: unitTopics.flatMap((t, i) => (i === 0 ? mastered(t.id) : secure(t.id))) }
    const unit = milestonesIn(state, now).find((m) => m.kind === 'unit')!
    expect(unit.id).toBe('maths/probability'.replace(/^/, 'unit:'))
    expect(unit.title).toBe('Probability')
    expect(unit.detail).toContain(`all ${unitTopics.length} topics`)
  })

  it('reads a recorded milestone back for the Progress page', () => {
    expect(describeMilestone(`mastered:${unitTopics[0]!.id}`)?.title).toBe(unitTopics[0]!.title)
    expect(describeMilestone('unit:maths/probability')?.title).toBe('Probability')
    expect(describeMilestone('unit:maths/nope')).toBeUndefined()
  })

  it('merges across devices, keeping the earlier time', () => {
    const merged = mergeProgress({ milestones: { 'mastered:x': '2026-09-02' } }, { milestones: { 'mastered:x': '2026-09-01', 'unit:y/z': '2026-09-03' } })
    expect(merged.milestones).toEqual({ 'mastered:x': '2026-09-01', 'unit:y/z': '2026-09-03' })
  })
})
