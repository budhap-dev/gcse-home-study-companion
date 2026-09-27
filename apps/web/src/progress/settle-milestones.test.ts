import { describe, expect, it } from 'vitest'

const store = new Map<string, string>()
globalThis.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } as unknown as Storage

const { TOPICS } = await import('../content/index.ts')
const { emptyState, getState, recordAttempt, replaceState } = await import('./store.ts')
const { settle } = await import('./settle.ts')

const quiz = (topicId: string, pct: number, id: string) => ({ id, topicId, kind: 'quiz' as const, marksScored: pct, marksAvailable: 100, markedHow: 'auto' as const, completedAt: '2026-09-25T10:00:00Z' })
const advanced = (topicId: string, pct: number, id: string) => ({ ...quiz(topicId, pct, id), kind: 'worksheet' as const, level: 'advanced' as const })

describe('celebrating a milestone', () => {
  it('celebrates the topic this attempt mastered, and records earlier ones quietly', () => {
    const [a, b] = TOPICS.filter((t) => t.subjectId === 'physics')
    // Topic A was mastered before milestones existed; B has its Advanced sheet and needs the quiz.
    replaceState({ ...emptyState(), attempts: [quiz(a!.id, 95, 'q-a'), advanced(a!.id, 90, 'w-a'), advanced(b!.id, 90, 'w-b')] })
    const before = getState()
    recordAttempt(quiz(b!.id, 96, 'q-b'))
    const outcome = settle(before)
    expect(outcome.milestones.map((m) => m.id)).toEqual([`mastered:${b!.id}`])
    expect(Object.keys(getState().milestones).sort()).toEqual([`mastered:${a!.id}`, `mastered:${b!.id}`].sort())
    // And never twice.
    const again = getState()
    recordAttempt(quiz(b!.id, 97, 'q-b2'))
    expect(settle(again).milestones).toEqual([])
  })
})
