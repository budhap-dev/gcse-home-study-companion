import { describe, expect, it } from 'vitest'
import { isAppleMobile } from './offline.ts'
import { isNetworkFailure } from '../auth/useAuth.ts'

describe('install instructions', () => {
  it('reads an iPhone, and an iPad that calls itself a Mac, as Apple mobile', () => {
    expect(isAppleMobile('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(true)
    expect(isAppleMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true)
  })

  it('leaves a real Mac and an Android phone alone', () => {
    expect(isAppleMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false)
    expect(isAppleMobile('Mozilla/5.0 (Linux; Android 15; Pixel 9)', 5)).toBe(false)
  })
})

describe('opening without a signal', () => {
  it('treats a failed request as no signal, whatever the browser calls it', () => {
    for (const m of ['TypeError: Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed', 'fetch failed']) {
      expect(isNetworkFailure(m, true)).toBe(true)
    }
  })

  it('treats any failure as no signal when the browser says it is offline', () => {
    expect(isNetworkFailure('permission denied', false)).toBe(true)
  })

  it('does not open the app on the remembered answer for a real refusal', () => {
    expect(isNetworkFailure('permission denied for function is_allowed', true)).toBe(false)
    expect(isNetworkFailure(undefined, true)).toBe(false)
  })
})
