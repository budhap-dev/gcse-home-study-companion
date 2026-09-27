import { SUBJECTS } from '@study/shared'
import { describe, expect, it } from 'vitest'
import { TOPICS } from '../content/index.ts'
import { countLevels, daysThisWeek, fixFirst, levelsSentence, square, unitGroups } from './map.ts'
import { emptyState, type AttemptRecord, type ProgressState } from './store.ts'

const now = new Date('2026-09-26T12:00:00Z')
const maths = TOPICS.filter((t) => t.subjectId === 'maths')
const at = (days: number) => new Date(now.getTime() - days * 86400000).toISOString()
const attempt = (topicId: string, kind: AttemptRecord['kind'], pct: number, days = 1, level?: AttemptRecord['level']): AttemptRecord =>
  ({ id: `${topicId}-${kind}-${level ?? ''}-${pct}`, topicId, kind, level, marksScored: pct, marksAvailable: 100, markedHow: 'auto', completedAt: at(days) })
const withAttempts = (...attempts: AttemptRecord[]): ProgressState => ({ ...emptyState(), attempts })

describe('map levels', () => {
  it('keeps not started apart from not secure', () => {
    const [a, b] = maths
    const state = withAttempts(attempt(b!.id, 'quiz', 30))
    expect(square(a!, state, now).level).toBe(0)
    expect(square(b!, state, now).level).toBe(1)
  })

  it('climbs one level per status, and a lesson step alone counts as started', () => {
    const [a, b, c, d] = maths
    const state: ProgressState = {
      ...withAttempts(
        attempt(b!.id, 'quiz', 60),
        attempt(c!.id, 'quiz', 85), attempt(c!.id, 'worksheet', 75, 1, 'higher'),
        attempt(d!.id, 'quiz', 95), attempt(d!.id, 'worksheet', 80, 1, 'advanced'),
      ),
      lessons: { [a!.id]: { topicId: a!.id, stepIndex: 2, updatedAt: at(1) } },
    }
    expect([a, b, c, d].map((t) => square(t!, state, now).level)).toEqual([1, 2, 3, 4])
  })

  /** A Redo my mistakes session never moves a topic's status, so it must not start one either. */
  it('does not count a review as starting a topic', () => {
    expect(square(maths[0]!, withAttempts(attempt(maths[0]!.id, 'review', 100)), now).level).toBe(0)
  })

  it('names a map by its counts, highest level first, and leaves out empty levels', () => {
    expect(levelsSentence([49, 4, 0, 9, 3])).toBe('3 mastered, 9 secure, 4 not secure, 49 not started')
    expect(levelsSentence([0, 0, 0, 0, 0])).toBe('no topics')
  })
})

describe('unit groups', () => {
  /** The map's promise is every topic: none lost, none twice, in every subject. */
  it.each(SUBJECTS.map((s) => [s.id]))('holds every written topic exactly once: %s', (subjectId) => {
    const topics = TOPICS.filter((t) => t.subjectId === subjectId)
    const groups = unitGroups(subjectId, TOPICS, emptyState(), now)
    const ids = groups.flatMap((g) => g.squares.map((s) => s.topic.id))
    expect(ids).toEqual(topics.map((t) => t.id))
    expect(countLevels(groups.flatMap((g) => g.squares))).toEqual([topics.length, 0, 0, 0, 0])
  })

  it('follows the subject’s unit order', () => {
    const names = unitGroups('maths', TOPICS, emptyState(), now).map((g) => g.name)
    expect(names[0]).toBe('Number')
    expect(names).not.toContain('Other topics')
  })
})

describe('fix these first', () => {
  it('lists faded topics first, then the lowest quiz scores, and never an untouched topic', () => {
    const [a, b, c] = maths
    const state = withAttempts(
      attempt(a!.id, 'quiz', 45), attempt(b!.id, 'quiz', 20),
      attempt(c!.id, 'quiz', 90, 60), attempt(c!.id, 'worksheet', 80, 60, 'higher'),
    )
    const list = fixFirst(maths, state, now)
    expect(list.map((f) => f.topic.id)).toEqual([c!.id, b!.id, a!.id])
    expect(list[0]!.note).toBe('Fading: 8 weeks since')
    expect(list[1]!.note).toBe('Quiz 20%')
    expect(list.every((f) => f.to.endsWith('/quiz'))).toBe(true)
  })

  it('stops at the limit and is empty for a fresh student', () => {
    const state = withAttempts(...maths.slice(0, 6).map((t, i) => attempt(t.id, 'quiz', 10 + i)))
    expect(fixFirst(maths, state, now)).toHaveLength(3)
    expect(fixFirst(maths, emptyState(), now)).toEqual([])
  })
})

describe('this week', () => {
  it('runs Monday to Sunday with the minutes of each day, and marks today and the days to come', () => {
    const state = { ...emptyState(), minutes: { '2026-09-22': 10, '2026-09-24': 15 } }
    const week = daysThisWeek(state, '2026-09-24')
    expect(week.map((d) => d.label).join('')).toBe('MTWTFSS')
    expect(week.map((d) => d.minutes)).toEqual([0, 10, 0, 15, 0, 0, 0])
    expect(week.find((d) => d.today)!.day).toBe('2026-09-24')
    expect(week.filter((d) => d.future).map((d) => d.name)).toEqual(['Friday', 'Saturday', 'Sunday'])
  })
})
