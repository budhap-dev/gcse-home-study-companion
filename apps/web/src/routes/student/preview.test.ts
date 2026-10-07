import { describe, expect, it } from 'vitest'
import { ALL_TOPICS as TOPICS } from '../../content/all.ts'
import { previewOf, WHY_PREVIEW } from './Topic.tsx'

/**
 * On a phone the banner shows the first sentence or two of "why it matters" and a Read
 * more. Whole sentences where they fit, and never a cut through maths or bold.
 */
describe('why it matters preview', () => {
  const withWhy = TOPICS.filter((t) => t.why)

  it('is whole sentences for most topics, and always short enough to leave the lesson on the first screen', () => {
    let sentences = 0
    for (const t of withWhy) {
      const preview = previewOf(t.why!.matters, WHY_PREVIEW)
      expect(preview.length, t.id).toBeGreaterThan(20)
      expect(preview.length, t.id).toBeLessThanOrEqual(WHY_PREVIEW + 4)
      expect((preview.match(/(?<!\\)\$/g) ?? []).length % 2, t.id).toBe(0)
      expect((preview.match(/\*\*/g) ?? []).length % 2, t.id).toBe(0)
      if (/[.!?]\**$/.test(preview)) sentences++
    }
    expect(sentences / withWhy.length).toBeGreaterThan(0.8)
  })

  it('ends at a sentence that closes its paragraph, not mid-way through the next', () => {
    // Laws of indices: the first sentence ends at a paragraph break, which the preview once
    // did not count as a sentence end, so the card read "That matters because…".
    const why = 'An index is shorthand for the laws.\n\nThat matters because **the quantities people measure span enormous ranges**, and more follows here.'
    expect(previewOf(why, 60)).toBe('An index is shorthand for the laws.')
    expect(previewOf('A sentence in **bold at the end.**\n\nThen another paragraph of text.', 50)).toBe('A sentence in **bold at the end.**')
  })

  it('is shorter than the whole text for every topic, so Read more always has more to show', () => {
    for (const t of withWhy) expect(previewOf(t.why!.matters, WHY_PREVIEW).length, t.id).toBeLessThan(t.why!.matters.length)
  })
})

/**
 * The topic page shows a short preview of the exam technique note. A blind slice
 * used to cut through a maths span, so four topics printed raw LaTeX such as
 * `$E_e = \tfrac{1}{2}ke^2$` on the card.
 */
describe('exam technique preview', () => {
  const dollars = (s: string) => (s.match(/(?<!\\)\$/g) ?? []).length

  it('never cuts through a maths span', () => {
    for (const t of TOPICS) {
      const preview = previewOf(t.examTechnique.body)
      expect(dollars(preview) % 2, `${t.id}: ${preview}`).toBe(0)
    }
  })

  it('keeps every preview short and non-empty', () => {
    for (const t of TOPICS) {
      const preview = previewOf(t.examTechnique.body)
      expect(preview.length, t.id).toBeGreaterThan(20)
      expect(preview.length, t.id).toBeLessThanOrEqual(160)
    }
  })

  const stars = (s: string) => (s.match(/\*\*/g) ?? []).length

  it('never cuts through a bold span', () => {
    for (const t of TOPICS) {
      const preview = previewOf(t.examTechnique.body)
      expect(stars(preview) % 2, `${t.id}: ${preview}`).toBe(0)
    }
  })

  it('ends a sentence that closes with bold after the bold, and never falls back into one', () => {
    // The frequency trees note: the first full stop sits inside the bold, so "period then
    // space" never matched, the fallback ran, and the card printed "take a percentage **of…".
    const note = '**Counts in the boxes adds to its parent.** Fill blanks by subtraction, take a percentage **of the parent box**, and check the end boxes add to the root.'
    expect(previewOf(note, 150)).toBe('**Counts in the boxes adds to its parent.**')
    expect(stars(previewOf('**' + 'word '.repeat(60) + '**', 40)) % 2).toBe(0)
  })

  it('closes an unfinished maths span rather than splitting it', () => {
    expect(previewOf('The formula $E = mc^2$ matters. And more.', 150)).toBe('The formula $E = mc^2$ matters.')
    expect(dollars(previewOf('$a$ ' + 'word '.repeat(60), 40)) % 2).toBe(0)
  })
})
