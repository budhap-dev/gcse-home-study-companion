import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { IndexLawsCard } from './IndexLawsCard.tsx'

const svg = (props: Record<string, unknown> = {}) => renderToStaticMarkup(<IndexLawsCard props={props} alt="summary of the index laws" />)

/** Every text's estimated extent — x ± 0.6 × fontSize × characters, by its text-anchor. */
function assertFits(markup: string) {
  const [, , w] = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(markup)!.slice(1).map(Number)
  expect(w!).toBeLessThanOrEqual(296)
  for (const t of markup.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const attrs = t[1]!
    const x = Number(/\bx="(-?[\d.]+)"/.exec(attrs)![1])
    const size = Number(/font-size="([\d.]+)"/.exec(attrs)?.[1] ?? '12')
    const anchor = /text-anchor="(\w+)"/.exec(attrs)?.[1] ?? 'start'
    const text = t[2]!.replace(/<[^>]+>/g, '')
    const half = text.length * 0.6 * size
    const left = anchor === 'end' ? x - half : anchor === 'middle' ? x - half / 2 : x
    const right = anchor === 'end' ? x : anchor === 'middle' ? x + half / 2 : x + half
    expect(left, `"${text}"`).toBeGreaterThanOrEqual(-0.5)
    expect(right, `"${text}"`).toBeLessThanOrEqual(w! + 0.5)
  }
}

/**
 * Set the five laws in three columns across a 520-unit row, the card always scrolled on a
 * phone (the content never varies, so nothing hid this in the census until it was run):
 * below its natural width a diagram stops shrinking and scrolls instead. Each law is now
 * stacked — name, then rule, then example — at 280 units.
 */
describe('index laws card', () => {
  it('fits on a phone, with every line inside the card', () => {
    assertFits(svg())
  })

  it('still draws all five laws', () => {
    const markup = svg()
    expect([...markup.matchAll(/<line /g)].length).toBe(4)
    expect(markup).toContain('Power of a power')
    expect(markup).toContain('Fraction')
  })
})
