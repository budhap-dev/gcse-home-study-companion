import { describe, expect, it } from 'vitest'
import { AUTO_THEME, THEMES, resolveTheme } from './themes.ts'

describe('Match my device', () => {
  it('paints Paper on a light device and Midnight on a dark one', () => {
    expect(resolveTheme(AUTO_THEME.id, false).id).toBe('paper')
    expect(resolveTheme(AUTO_THEME.id, true).id).toBe('midnight')
  })

  it('is not itself a theme, so it cannot be measured as one or collide with one', () => {
    expect(THEMES.some((t) => t.id === AUTO_THEME.id)).toBe(false)
  })

  it('falls back to Paper for a theme that no longer exists', () => {
    expect(resolveTheme('retired-theme').id).toBe('paper')
    expect(resolveTheme('nebula').id).toBe('nebula')
  })
})
