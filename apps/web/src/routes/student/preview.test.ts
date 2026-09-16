import { describe, expect, it } from 'vitest'
import { TOPICS } from '../../content/index.ts'
import { previewOf } from './Topic.tsx'

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
