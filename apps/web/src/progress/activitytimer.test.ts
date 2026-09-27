import { describe, expect, it } from 'vitest'
import { IDLE_AFTER_MS, countsAsStudy } from './useActivityTimer.ts'

describe('what counts as a minute of study', () => {
  const now = 1_000_000_000
  it('counts a visible screen touched in the last three minutes', () => {
    expect(countsAsStudy(now, now - 30_000, true)).toBe(true)
    expect(countsAsStudy(now, now - IDLE_AFTER_MS, true)).toBe(true)
  })
  it('stops counting a screen left untouched, or out of sight', () => {
    expect(countsAsStudy(now, now - IDLE_AFTER_MS - 1, true)).toBe(false)
    expect(countsAsStudy(now, now, false)).toBe(false)
  })
})
