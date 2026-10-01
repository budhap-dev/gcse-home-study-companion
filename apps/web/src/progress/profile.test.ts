import { describe, expect, it } from 'vitest'
import { mergeProgress } from './merge.ts'
import { withoutSubjects } from './store.ts'

describe('the student profile', () => {
  it('merges to the profile set up more recently', () => {
    const older = { year: 10 as const, setupAt: '2026-09-01' }
    const newer = { year: 11 as const, setupAt: '2026-09-20' }
    expect(mergeProgress({ profile: older }, { profile: newer }).profile).toEqual(newer)
    expect(mergeProgress({ profile: newer }, { profile: older }).profile).toEqual(newer)
  })

  // The subjects-taken list was retired on 1 October 2026. A profile saved before then still
  // carries it, and it must not survive a read: nothing should narrow the plan by subject.
  it('drops a subjects list saved before the choice was retired', () => {
    const saved = { year: 10 as const, subjects: ['maths', 'french'], setupAt: '2026-09-20' }
    expect(withoutSubjects(saved)).toEqual({ year: 10, setupAt: '2026-09-20' })
    expect(withoutSubjects({ year: 9 })).toEqual({ year: 9 })
    expect(withoutSubjects(undefined)).toEqual({})
  })
})
