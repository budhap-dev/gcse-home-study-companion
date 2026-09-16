import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CumulativeFrequency } from './CumulativeFrequency.tsx'

/**
 * A reading is taken across from a cumulative frequency to the plotted line and down
 * to the axis. The value printed beside it is interpolated from the same segments the
 * line is drawn through, so the expected numbers here are worked out from those
 * segments by hand: a reading that lands on the wrong segment fails.
 */
describe('cumulative frequency graph', () => {
  // 40 students: running totals at each upper bound, starting from (0, 0).
  const POINTS = [
    { x: 0, y: 0 },
    { x: 10, y: 4 },
    { x: 20, y: 14 },
    { x: 30, y: 30 },
    { x: 40, y: 38 },
    { x: 50, y: 40 },
  ]

  it('reads the median across at n/2 and interpolates it on the right segment', () => {
    const html = renderToStaticMarkup(<CumulativeFrequency alt="" props={{ points: POINTS, readings: [{ y: 20, label: 'median' }] }} />)
    // 20 lies between (20, 14) and (30, 30): 20 + (6/16) x 10 = 23.75.
    expect(html).toContain('median ≈ 23.75')
  })

  it('reads the quartiles at n/4 and 3n/4', () => {
    const html = renderToStaticMarkup(<CumulativeFrequency alt="" props={{ points: POINTS, readings: [
      { y: 10, label: 'LQ' },
      { y: 30, label: 'UQ' },
    ] }} />)
    // 10 lies between (10, 4) and (20, 14): 10 + (6/10) x 10 = 16.
    expect(html).toContain('LQ ≈ 16')
    // 30 is exactly the plotted point (30, 30).
    expect(html).toContain('UQ ≈ 30')
  })

  it('labels both axes and every upper class bound', () => {
    const html = renderToStaticMarkup(<CumulativeFrequency alt="" props={{ points: POINTS, xLabel: 'time (minutes)' }} />)
    expect(html).toContain('time (minutes)')
    expect(html).toContain('cumulative frequency')
    for (const b of ['0', '10', '20', '30', '40', '50']) expect(html, b).toContain(`>${b}<`)
  })

  it('draws nothing for a reading beyond the data rather than a stray line', () => {
    const html = renderToStaticMarkup(<CumulativeFrequency alt="" props={{ points: POINTS, readings: [{ y: 99, label: 'x' }] }} />)
    expect(html).not.toContain('x ≈')
  })

  it('falls back to the alt text rather than crashing when given too few points', () => {
    expect(renderToStaticMarkup(<CumulativeFrequency alt="a cumulative frequency graph" props={{ points: [{ x: 0, y: 0 }] }} />)).toContain('a cumulative frequency graph')
  })
})
