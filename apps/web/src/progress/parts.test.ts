import { describe, expect, it } from 'vitest'
import { partsDone, partsLabel } from './parts.ts'

const attempt = (topicId: string, kind: 'quiz' | 'worksheet', level?: string) =>
  ({ id: Math.random().toString(), topicId, kind, level, marksScored: 1, marksAvailable: 2, markedHow: 'auto', completedAt: '2026-09-27T10:00:00Z' }) as never

describe('the parts of a topic done', () => {
  it('reads the finished lesson, each worksheet level and the quiz, for this topic only', () => {
    const state = {
      lessons: { t1: { stepIndex: 7, completedAt: '2026-09-20' }, t2: { stepIndex: 2 } } as never,
      attempts: [attempt('t1', 'worksheet', 'core'), attempt('t1', 'quiz'), attempt('t2', 'worksheet', 'advanced')],
    }
    expect(partsDone('t1', state)).toEqual({ lesson: true, core: true, higher: false, advanced: false, quiz: true })
    expect(partsDone('t2', state)).toEqual({ lesson: false, core: false, higher: false, advanced: true, quiz: false })
  })

  it('says it in words for a screen reader', () => {
    expect(partsLabel({ lesson: true, core: true, higher: false, advanced: false, quiz: true })).toBe('Lesson, Core worksheet and Quiz done; Higher worksheet and Advanced worksheet not yet')
    expect(partsLabel({ lesson: false, core: false, higher: false, advanced: false, quiz: false })).toBe('Nothing done yet')
    expect(partsLabel({ lesson: true, core: true, higher: true, advanced: true, quiz: true })).toBe('All five parts done')
  })
})
