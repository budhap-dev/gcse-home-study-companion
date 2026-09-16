import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EquationCard } from './EquationCard.tsx'

const svg = (props: Record<string, unknown>) => renderToStaticMarkup(<EquationCard props={props} alt="a card of equations" />)
const short = { name: 'Kinetic energy', equation: 'Ek = ½ m v²', units: 'J, kg, m/s' }
const long = {
  name: '% change = (change ÷ original) × 100',
  equation: 'change = final mass − starting mass',
  units: 'a percentage; negative means mass was lost',
}

/**
 * The card used to right-anchor the equation beside the name, which silently printed one
 * string over the other whenever both were long. Several Biology cards did exactly that,
 * because their "equation" is a sentence rather than a formula.
 */
describe('equation card', () => {
  it('keeps the compact layout when the text is short', () => {
    const markup = svg({ equations: [short] })
    expect(markup).toContain('text-anchor="end"')
  })

  it('stacks the equation under the name when the two would collide', () => {
    const markup = svg({ equations: [long] })
    // Stacked rows set the equation from the left margin rather than anchoring it right.
    expect(markup).not.toContain('text-anchor="end"')
  })

  it('grows the card so a stacked row still fits inside it', () => {
    const height = (m: string) => Number(m.match(/viewBox="0 0 520 (\d+)"/)![1])
    expect(height(svg({ equations: [long] }))).toBeGreaterThan(height(svg({ equations: [short] })))
  })

  it('never lets any text fall outside the card', () => {
    for (const equations of [[short], [long], [short, long], [long, long, short]]) {
      const markup = svg({ equations })
      const H = Number(markup.match(/viewBox="0 0 520 (\d+)"/)![1])
      const ys = [...markup.matchAll(/<text[^>]*\by="(\d+(?:\.\d+)?)"/g)].map((m) => Number(m[1]))
      expect(ys.length).toBeGreaterThan(0)
      expect(Math.max(...ys)).toBeLessThan(H)
    }
  })

  it('sets a long equation smaller, as a sentence rather than a formula', () => {
    expect(svg({ equations: [short] })).toContain('font-size="20"')
    expect(svg({ equations: [long] })).toContain('font-size="14"')
  })
})
