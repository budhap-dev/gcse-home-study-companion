import { describe, expect, it } from 'vitest'
import { DOCK_FULL_LABELS, NAV, isFocusRoute, navFor } from './nav.ts'

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

describe('the dock', () => {
  /** 11px bold is about 6.5px a character; a label wider than its slot runs into the next one. */
  it('fits every label a parent sees in a seven-item dock', () => {
    const items = navFor('parent')
    expect(items.length).toBeGreaterThan(DOCK_FULL_LABELS)
    for (const n of items) expect((n.short ?? n.label).length, n.label).toBeLessThanOrEqual(8)
  })

  it('gives a student the full labels', () => {
    expect(navFor('student').length).toBeLessThanOrEqual(DOCK_FULL_LABELS)
  })
})

describe('menu colours', () => {
  const channel = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!)
  }

  it('reads at AA on the white pill, in every theme', () => {
    for (const item of navFor('parent')) {
      expect(1.05 / (luminance(item.colour) + 0.05), item.label).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('gives every item a colour of its own', () => {
    const colours = navFor('parent').map((n) => n.colour.toLowerCase())
    expect(new Set(colours).size).toBe(colours.length)
  })
})

describe('focus screens', () => {
  it('are the screens worked through one item at a time', () => {
    for (const p of [
      '/subjects/maths/topics/laws-of-indices/lesson',
      '/subjects/maths/topics/laws-of-indices/quiz',
      '/subjects/maths/topics/laws-of-indices/flashcards',
      '/subjects/maths/topics/laws-of-indices/worksheet/core',
      '/mistakes',
      '/recap',
    ]) expect(isFocusRoute(p), p).toBe(true)
  })

  it('leave the menu alone everywhere else, including the print view', () => {
    for (const p of [
      '/', '/subjects', '/subjects/maths', '/subjects/maths/topics/laws-of-indices',
      '/subjects/maths/topics/laws-of-indices/cheatsheet',
      '/subjects/maths/topics/laws-of-indices/worksheet/core/print',
      '/glossary', '/progress',
    ]) expect(isFocusRoute(p), p).toBe(false)
  })
})
