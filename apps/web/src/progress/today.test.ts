import { describe, expect, it } from 'vitest'
import { TOPICS } from '../content/index.ts'
import type { AssignedTask } from './assignments.ts'
import { buildTask } from './recommend.ts'
import { emptyState, type ProgressState } from './store.ts'
import { doneToday, todayPlan } from './today.ts'

const maths = TOPICS.filter((t) => t.subjectId === 'maths').slice(0, 8)
const now = new Date('2026-09-26T12:00:00Z')
const assigned = (status: AssignedTask['status'], i = 0): AssignedTask => {
  const topic = maths[i]!
  return { assignment: { id: `x${i}`, topicId: topic.id, kind: 'quiz' } as never, task: buildTask(topic, 'quiz', 'set'), topicTitle: topic.title, status }
}

describe("today's plan", () => {
  it('puts a parent task first, then the recap, then the next step, three at most', () => {
    const plan = todayPlan(maths, emptyState(), [assigned('open', 3)], 4, now)
    expect(plan.map((p) => p.label)).toEqual(['Set for you', 'Recap', 'Next up'])
    expect(plan[1]!.to).toBe('/mistakes')
  })

  it('takes the most pressing parent task, and skips one that is done or not started yet', () => {
    const plan = todayPlan(maths, emptyState(), [assigned('open', 1), assigned('overdue', 2), assigned('done', 3), assigned('upcoming', 4)], 0, now)
    expect(plan[0]!.reason).toMatch(/^Overdue/)
    expect(plan[0]!.topicTitle).toBe(maths[2]!.title)
    expect(plan.filter((p) => p.label === 'Set for you')).toHaveLength(1)
  })

  it('offers a faded topic as the recap before mistakes', () => {
    const t = maths[0]!
    const state: ProgressState = { ...emptyState(), attempts: [{ id: 'q', topicId: t.id, kind: 'quiz', marksScored: 9, marksAvailable: 10, markedHow: 'auto', completedAt: '2026-07-01T10:00:00Z' }, { id: 'h', topicId: t.id, kind: 'worksheet', level: 'higher', marksScored: 9, marksAvailable: 10, markedHow: 'auto', completedAt: '2026-07-01T10:00:00Z' }] }
    const plan = todayPlan(maths, state, [], 5, now)
    expect(plan[0]!.label).toBe('Recap')
    expect(plan[0]!.to).toContain(`${t.id}/quiz`)
  })

  it('offers a new student three subjects, not three Maths topics', () => {
    const plan = todayPlan(TOPICS, { ...emptyState(), profile: { year: 10 } }, [], 0, now)
    expect(plan.map((p) => p.label)).toEqual(['Next up', 'Next up', 'Next up'])
    expect(new Set(plan.map((p) => p.to.split('/')[2])).size).toBe(3)
    expect(plan[0]!.to).toMatch(/^\/subjects\/maths\//)
  })

  it('keeps a faded topic in the recap slot when other subjects outrank it as alternatives', () => {
    const t = maths[0]!
    const faded = [{ id: 'q', topicId: t.id, kind: 'quiz', marksScored: 9, marksAvailable: 10, markedHow: 'auto', completedAt: '2026-07-01T10:00:00Z' }, { id: 'h', topicId: t.id, kind: 'worksheet', level: 'higher', marksScored: 9, marksAvailable: 10, markedHow: 'auto', completedAt: '2026-07-01T10:00:00Z' }] as const
    const other = TOPICS.find((x) => x.subjectId === 'biology')!
    const state: ProgressState = { ...emptyState(), attempts: [...faded], lessons: { [other.id]: { topicId: other.id, stepIndex: 1, updatedAt: '2026-09-25T10:00:00Z' } } }
    const plan = todayPlan([...maths, ...TOPICS.filter((x) => x.subjectId !== 'maths')], state, [], 0, now)
    expect(plan.find((p) => p.label === 'Recap')?.to).toContain(`${t.id}/quiz`)
  })

  it('never lists the same thing twice', () => {
    const plan = todayPlan(maths, emptyState(), [], 0, now)
    expect(new Set(plan.map((p) => p.to)).size).toBe(plan.length)
    expect(plan.length).toBeLessThanOrEqual(3)
  })

  it('lists what was finished today', () => {
    const t = maths[0]!
    const state: ProgressState = { ...emptyState(), attempts: [{ id: 'q', topicId: t.id, kind: 'quiz', marksScored: 8, marksAvailable: 10, markedHow: 'auto', completedAt: '2026-09-26T09:00:00Z' }], lessons: { [t.id]: { topicId: t.id, stepIndex: 7, completedAt: '2026-09-26T08:00:00Z', updatedAt: '2026-09-26T08:00:00Z' } } }
    expect(doneToday(maths, state, '2026-09-26')).toEqual([{ what: 'Quiz', topicTitle: t.title, detail: '80%' }, { what: 'Lesson', topicTitle: t.title }])
  })
})
