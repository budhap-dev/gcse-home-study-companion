import { describe, expect, it } from 'vitest'
import { mergeProgress } from './merge.ts'
import { studiedTopics } from './store.ts'

describe('the student profile', () => {
  const topics = [{ subjectId: 'maths', id: 'a' }, { subjectId: 'physics', id: 'b' }, { subjectId: 'french', id: 'c' }]

  it('narrows topics to the subjects taken, or keeps all when none are chosen', () => {
    expect(studiedTopics(topics, { subjects: ['maths', 'french'] }).map((t) => t.id)).toEqual(['a', 'c'])
    expect(studiedTopics(topics, {})).toHaveLength(3)
    expect(studiedTopics(topics, { subjects: [] })).toHaveLength(3)
    expect(studiedTopics(topics, undefined)).toHaveLength(3)
  })

  it('merges to the profile set up more recently', () => {
    const older = { year: 10 as const, setupAt: '2026-09-01' }
    const newer = { year: 11 as const, setupAt: '2026-09-20' }
    expect(mergeProgress({ profile: older }, { profile: newer }).profile).toEqual(newer)
    expect(mergeProgress({ profile: newer }, { profile: older }).profile).toEqual(newer)
  })
})
