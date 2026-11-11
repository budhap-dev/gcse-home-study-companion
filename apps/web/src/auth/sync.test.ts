import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Tests run without a browser: the two globals sync and the store touch, and no more.
const store = new Map<string, string>()
vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })
vi.stubGlobal('window', new EventTarget())

const select = vi.fn()
const upsert = vi.fn()
vi.mock('./client.ts', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: select }) }), upsert }) },
}))

const { startSync, stopSync, hasUnsavedWork } = await import('./sync.ts')
const { clearProgress, getState, recordAttempt } = await import('../progress/store.ts')

const attempt = (id: string) => ({ id, topicId: 't', kind: 'quiz' as const, marksScored: 1, marksAvailable: 2, markedHow: 'auto' as const, completedAt: `2026-11-1${id}T10:00:00.000Z` })

describe('progress sync without a signal (UXI-5)', () => {
  beforeEach(() => { vi.useFakeTimers(); clearProgress(); select.mockReset(); upsert.mockReset() })
  afterEach(() => { stopSync(); vi.useRealTimers() })

  it('writes nothing over the account when its copy could not be read', async () => {
    select.mockResolvedValue({ data: null, error: { message: 'TypeError: Failed to fetch' } })
    recordAttempt(attempt('1'))
    await startSync('u1', 'kid@example.com')
    recordAttempt(attempt('2'))
    await vi.advanceTimersByTimeAsync(2000)
    expect(upsert).not.toHaveBeenCalled()
  })

  it('merges the account copy in when the signal returns, then saves both', async () => {
    select.mockResolvedValueOnce({ data: null, error: { message: 'TypeError: Failed to fetch' } })
    recordAttempt(attempt('1'))
    await startSync('u1', 'kid@example.com')
    // On another device meanwhile: attempt 3.
    select.mockResolvedValueOnce({ data: { state: { attempts: [attempt('3')] } }, error: null })
    upsert.mockResolvedValue({ error: null })
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(10)
    expect(getState().attempts.map((a) => a.id)).toEqual(['1', '3'])
    const saved = upsert.mock.calls.at(-1)![0] as { state: { attempts: { id: string }[] } }
    expect(saved.state.attempts.map((a) => a.id)).toEqual(['1', '3'])
  })

  it('remembers a failed save and merges again before the next one', async () => {
    select.mockResolvedValue({ data: { state: { attempts: [] } }, error: null })
    upsert.mockResolvedValueOnce({ error: null })
    await startSync('u1', 'kid@example.com')
    upsert.mockResolvedValueOnce({ error: { message: 'TypeError: Failed to fetch' } })
    recordAttempt(attempt('1'))
    await vi.advanceTimersByTimeAsync(2000)
    expect(hasUnsavedWork()).toBe(true)
    select.mockResolvedValueOnce({ data: { state: { attempts: [attempt('4')] } }, error: null })
    upsert.mockResolvedValue({ error: null })
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(10)
    expect(hasUnsavedWork()).toBe(false)
    const saved = upsert.mock.calls.at(-1)![0] as { state: { attempts: { id: string }[] } }
    expect(saved.state.attempts.map((a) => a.id).sort()).toEqual(['1', '4'])
  })
})
