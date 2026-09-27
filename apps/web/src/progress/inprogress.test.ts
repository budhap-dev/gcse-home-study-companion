import { beforeEach, describe, expect, it } from 'vitest'
import { loadInProgress, openSession, saveInProgress } from './inProgress.ts'

const store = new Map<string, string>()
globalThis.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } as unknown as Storage

describe('unfinished work kept on the device', () => {
  beforeEach(() => store.clear())
  const now = Date.parse('2026-09-27T12:00:00Z')

  it('brings back an unfinished session for a week, then forgets it', () => {
    saveInProgress('k', { index: 3, questionIds: ['a', 'b', 'c', 'd'] }, now)
    expect(loadInProgress('k', now + 6 * 86400_000)).toEqual({ index: 3, questionIds: ['a', 'b', 'c', 'd'] })
    expect(openSession('k', now + 86400_000)).toEqual({ index: 3, total: 4 })
    expect(loadInProgress('k', now + 8 * 86400_000)).toBeNull()
    expect(store.has('k')).toBe(false)
  })

  it('keeps a finished one only an hour, and never offers it to resume', () => {
    saveInProgress('k', { index: 9, finishedAt: '2026-09-27T12:00:00Z' }, now)
    expect(loadInProgress('k', now + 30 * 60_000)).not.toBeNull()
    expect(openSession('k', now + 60_000)).toBeNull()
    expect(loadInProgress('k', now + 2 * 3600_000)).toBeNull()
  })

  it('ignores something unreadable', () => {
    store.set('k', '{not json')
    expect(loadInProgress('k')).toBeNull()
  })
})
