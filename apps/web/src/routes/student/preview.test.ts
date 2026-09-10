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

  it('closes an unfinished maths span rather than splitting it', () => {
    expect(previewOf('The formula $E = mc^2$ matters. And more.', 150)).toBe('The formula $E = mc^2$ matters.')
    expect(dollars(previewOf('$a$ ' + 'word '.repeat(60), 40)) % 2).toBe(0)
  })
})
