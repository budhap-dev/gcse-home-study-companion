import { describe, expect, it } from 'vitest'
import { NAV, navFor } from './nav.ts'

describe('navFor', () => {
  it('gives a parent the Family screen, just before Settings', () => {
    const items = navFor('parent').map((n) => n.to)
    expect(items).toContain('/family')
    expect(items.indexOf('/family')).toBe(items.indexOf('/settings') - 1)
    expect(items).toHaveLength(NAV.length + 1)
  })

  it('shows nobody else a screen about another person', () => {
    expect(navFor('student').map((n) => n.to)).not.toContain('/family')
    expect(navFor(undefined).map((n) => n.to)).not.toContain('/family')
  })

  it('leaves the shared menu untouched', () => {
    navFor('parent')
    expect(NAV.map((n) => n.to)).not.toContain('/family')
  })
})
