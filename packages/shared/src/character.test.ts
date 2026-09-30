import { describe, expect, it } from 'vitest'
import { DEEDS, DEEDS_FROM, QUOTES, QUOTE_STEP, THEMES, daysSince, deedById, deedOfTheDay, quoteOfTheDay } from './character.ts'

describe('the thoughts for the day', () => {
  it('has a good spread, with every theme used', () => {
    expect(QUOTES.length).toBeGreaterThanOrEqual(60)
    for (const theme of Object.keys(THEMES)) expect(QUOTES.filter((q) => q.theme === theme).length, theme).toBeGreaterThanOrEqual(3)
  })

  /** A saying with no source is a saying nobody can check, and most famous misquotes have none. */
  it('says who said each one and where', () => {
    for (const q of QUOTES) {
      expect(q.by, q.text).toMatch(/\S/)
      expect(q.source, q.text).toMatch(/\S/)
      expect(q.by, q.text).not.toMatch(/unknown|anonymous/i)
      if (q.by === 'Proverb') expect(q.source, q.text).toMatch(/^(English|Japanese|Chinese|Spanish|Greek|Often given as)/)
    }
  })

  it('reads as a sentence, short enough for a card, in the app’s own punctuation', () => {
    const seen = new Set<string>()
    for (const q of QUOTES) {
      expect(q.text, q.text).toMatch(/^[A-Z].*[.!?]$/)
      expect(q.text.length, q.text).toBeLessThanOrEqual(180)
      expect(q.text, q.text).not.toMatch(/[—–]/)
      expect(q.text, q.text).not.toMatch(/"/)
      expect(seen.has(q.text), `repeated: ${q.text}`).toBe(false)
      seen.add(q.text)
    }
  })

  /** The stride must be coprime with the count, or some thoughts never come round. */
  it('visits every thought once before repeating, and mixes the themes', () => {
    const days = Array.from({ length: QUOTES.length }, (_, i) => new Date(2026, 8, 1 + i))
    const texts = days.map((d) => quoteOfTheDay(d).text)
    expect(new Set(texts).size).toBe(QUOTES.length)
    expect(QUOTE_STEP).toBeGreaterThan(1)
    // No two consecutive days share a theme, save where the stride lands them so.
    const sameTheme = days.slice(1).filter((d, i) => quoteOfTheDay(d).theme === quoteOfTheDay(days[i]!).theme).length
    expect(sameTheme).toBeLessThan(QUOTES.length / 4)
  })

  it('offers another when asked', () => {
    const d = new Date(2026, 9, 3)
    expect(quoteOfTheDay(d, 1).text).not.toBe(quoteOfTheDay(d).text)
    expect(quoteOfTheDay(d, QUOTES.length).text).toBe(quoteOfTheDay(d).text)
  })
})

describe('the good deeds', () => {
  it('is the owner’s list of thirty, each with an id and an icon', () => {
    expect(DEEDS).toHaveLength(30)
    expect(new Set(DEEDS.map((d) => d.id)).size).toBe(30)
    for (const d of DEEDS) {
      expect(d.id).toMatch(/^[a-z][a-z-]+$/)
      expect(d.text).toMatch(/^[A-Z].*\.$/)
      expect(d.icon).toMatch(/^[a-z-]+$/)
    }
    expect(DEEDS.map((d) => d.text)).toContain('Help a family member with a household chore.')
  })

  it('comes round one a day, in order, the same for everyone', () => {
    const start = new Date(DEEDS_FROM + 'T12:00:00')
    expect(daysSince(start)).toBe(0)
    expect(deedOfTheDay(start).id).toBe(DEEDS[0]!.id)
    const later = new Date(start); later.setDate(start.getDate() + 31)
    expect(deedOfTheDay(later).id).toBe(DEEDS[1]!.id)
    const before = new Date(start); before.setDate(start.getDate() - 1)
    expect(deedOfTheDay(before).id).toBe(DEEDS[29]!.id)
    const month = Array.from({ length: 30 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return deedOfTheDay(d).id })
    expect(month).toEqual(DEEDS.map((d) => d.id))
  })

  /** Midnight and a clock change must not shift a day: the count is taken at noon. */
  it('counts days from noon, so an evening and the next morning are different days', () => {
    expect(daysSince(new Date(2026, 8, 1, 23, 59))).toBe(0)
    expect(daysSince(new Date(2026, 8, 2, 0, 1))).toBe(1)
    expect(daysSince(new Date(2026, 9, 26, 8))).toBe(55)
  })

  it('finds a deed by id', () => {
    expect(deedById('pick-up-litter')?.icon).toBe('bin')
    expect(deedById('nothing')).toBeUndefined()
  })
})
