import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDLE_AFTER_MS, countsAsStudy, enterPlace, leavePlace } from './useActivityTimer.ts'
import { emptyState, getState, isoDate, replaceState, timeKey } from './store.ts'

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

describe('the clock across a session that changes topic', () => {
  // The store keeps progress in local storage, which a Node test has to provide.
  const store = new Map<string, string>()
  globalThis.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } as unknown as Storage
  const football = { subjectId: 'maths', topicId: 'percentages', kind: 'worksheet' } as const
  const tennis = { subjectId: 'maths', topicId: 'ratio', kind: 'worksheet' } as const
  const flush = () => new Promise<void>((r) => queueMicrotask(r))
  const minutesToday = () => getState().minutes[isoDate()] ?? 0

  beforeEach(() => { vi.useFakeTimers(); replaceState(emptyState()) })
  afterEach(() => { vi.useRealTimers() })

  it('keeps running when the screen moves to its next question, so short questions still add up', async () => {
    enterPlace(football)
    vi.advanceTimersByTime(40_000)
    // The next question is another topic: the screen leaves one place and enters the next in the same breath.
    leavePlace()
    enterPlace(tennis)
    await flush()
    vi.advanceTimersByTime(20_000)
    expect(minutesToday()).toBe(1)
    // Filed against the place on screen when the minute completed.
    expect(getState().time[timeKey(isoDate(), tennis)]).toBe(1)
    expect(getState().time[timeKey(isoDate(), football)]).toBeUndefined()
    leavePlace()
    await flush()
  })

  it('stops once the last screen has closed', async () => {
    enterPlace(football)
    leavePlace()
    await flush()
    vi.advanceTimersByTime(180_000)
    expect(minutesToday()).toBe(0)
  })

  it('counts every minute of a long question', async () => {
    enterPlace(football)
    vi.advanceTimersByTime(150_000)
    expect(minutesToday()).toBe(2)
    leavePlace()
    await flush()
  })
})
