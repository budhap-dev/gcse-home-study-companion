import { describe, expect, it } from 'vitest'
import { JITTER, SHOW_NEAR_TOP, nextChrome } from './useChromeHidden.ts'

describe('nextChrome', () => {
  const at = (y: number, hidden = false) => ({ y, hidden })

  it('hides on scrolling down past the top', () => {
    expect(nextChrome(at(100), 200).hidden).toBe(true)
  })

  it('shows again on scrolling up', () => {
    expect(nextChrome(at(600, true), 500).hidden).toBe(false)
  })

  it('always shows near the top, whichever way the page moved', () => {
    expect(nextChrome(at(SHOW_NEAR_TOP + 40, true), SHOW_NEAR_TOP).hidden).toBe(false)
    expect(nextChrome(at(0), SHOW_NEAR_TOP).hidden).toBe(false)
  })

  it('ignores a jitter but adds up a slow scroll', () => {
    const start = at(300)
    const small = nextChrome(start, 300 + JITTER - 1)
    expect(small).toBe(start)
    expect(nextChrome(small, 300 + JITTER).hidden).toBe(true)
  })
})
