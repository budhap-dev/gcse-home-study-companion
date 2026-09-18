import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { InequalityRegion } from './InequalityRegion.tsx'

/**
 * The component drew a gridline and an axis label at every whole number. That is right
 * for the small ranges these diagrams usually use and unreadable past about twenty: a
 * bakery plan on 0 to 80 loaves rendered its x labels as one continuous smear of digits.
 */
describe('inequality-region', () => {
  const CONSTRAINTS = [{ m: -0.5, c: 50, side: 'below' as const, inclusive: true }]
  const render = (xRange: [number, number], yRange: [number, number]) =>
    renderToStaticMarkup(<InequalityRegion alt="" props={{ xRange, yRange, constraints: CONSTRAINTS }} />)

  /** The x positions of the axis-number labels, which is what overlapped. */
  const labelXs = (html: string) =>
    [...html.matchAll(/<text x="([\d.]+)" y="[\d.]+" text-anchor="middle"[^>]*font-size="11"/g)].map((m) => Number(m[1]))

  it('keeps axis labels far enough apart to read at a wide range', () => {
    const xs = labelXs(render([0, 80], [0, 60])).sort((a, b) => a - b)
    expect(xs.length).toBeGreaterThan(2)
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThan(12)
  })

  it('still labels every whole number on a small range', () => {
    // -1 to 6 is the component's own default, and those diagrams must not change.
    const xs = labelXs(render([-1, 6], [-1, 6]))
    expect(xs.length).toBe(7) // -1 to 6, with 0 omitted
  })
})
