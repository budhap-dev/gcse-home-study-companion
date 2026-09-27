import { beforeEach, describe, expect, it, vi } from 'vitest'

// Error reporting must never flood the table from a page that throws in a loop, and must
// send nothing before a family member has signed in.
const insert = vi.fn(async () => ({ error: null }))
vi.mock('./client.ts', () => ({ supabase: { from: () => ({ insert }) } }))

describe('device error reports', () => {
  beforeEach(() => { insert.mockClear(); vi.resetModules() })

  it('sends nothing before sign-in', async () => {
    const r = await import('./reports.ts')
    r.reportError(new Error('boom'))
    expect(insert).not.toHaveBeenCalled()
  })

  it('sends each message once, and at most ten in a session', async () => {
    const r = await import('./reports.ts')
    r.setErrorReportingSignedIn(true)
    r.reportError(new Error('same'))
    r.reportError(new Error('same'))
    expect(insert).toHaveBeenCalledTimes(1)
    for (let i = 0; i < 30; i++) r.reportError(new Error(`e${i}`))
    expect(insert).toHaveBeenCalledTimes(10)
  })

  it('sends no identity with an error', async () => {
    const r = await import('./reports.ts')
    r.setErrorReportingSignedIn(true)
    r.reportError(new Error('private'))
    const row = (insert.mock.calls[0] as unknown as [Record<string, unknown>])[0]
    expect(Object.keys(row).sort()).toEqual(['app_version', 'message', 'page', 'stack', 'user_agent'])
  })

  it('refuses an empty report note', async () => {
    const r = await import('./reports.ts')
    expect(await r.sendReport({ subjectId: 'maths', topicId: 't', itemKind: 'question', itemId: 'q1', seenIn: 'quiz', note: '   ' })).toBe(false)
    expect(insert).not.toHaveBeenCalled()
  })
})
