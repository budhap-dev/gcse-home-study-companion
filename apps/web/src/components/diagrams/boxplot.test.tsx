import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BoxPlot } from './BoxPlot.tsx'

/**
 * The box spans the quartiles and the line inside it is the median, on a scale the
 * component chooses from the data. The expected positions below are worked out by hand
 * from that scale, so a plot that draws the right shape in the wrong place fails.
 */
describe('box plot', () => {
  const A = { label: 'Class A', min: 12, q1: 15, median: 22, q3: 27, max: 34 }
  const B = { label: 'Class B', min: 3, q1: 6, median: 8.5, q3: 12, max: 15 }

  it('draws the box from the lower to the upper quartile, with the median inside', () => {
    const html = renderToStaticMarkup(<BoxPlot alt="" props={{ plots: [A] }} />)
    // Data 12 to 34: span 22, so a tick step of 5 and an axis from 10 to 35.
    // Plot area is 460 - 78 - 18 = 364px wide, so 1 unit is 14.56px.
    const sx = (x: number) => 78 + ((x - 10) / 25) * 364
    expect(html).toContain(`x="${sx(15)}"`)                 // box starts at q1
    expect(html).toContain(`width="${sx(27) - sx(15)}"`)    // and is q3 - q1 wide
    expect(html).toContain(`x1="${sx(22)}"`)                // median line
    for (const t of ['10', '15', '20', '25', '30', '35']) expect(html, t).toContain(`>${t}<`)
  })

  it('stacks several plots on one shared scale', () => {
    const html = renderToStaticMarkup(<BoxPlot alt="" props={{ plots: [A, B], xLabel: 'marks' }} />)
    expect(html).toContain('Class A')
    expect(html).toContain('Class B')
    expect(html).toContain('marks')
    // One axis for both. Data 3 to 34 spans 31, so the step is 10 and the axis runs
    // 0 to 40: each tick appears once, not once per plot.
    for (const t of ['0', '10', '20', '30', '40']) expect(html.match(new RegExp(`>${t}<`, 'g'))?.length ?? 0, t).toBe(1)
    expect(html).not.toContain('>35<')
  })

  it('keeps a summary outside a fixed axis inside the picture', () => {
    const html = renderToStaticMarkup(<BoxPlot alt="" props={{ plots: [A], xMin: 0, xMax: 20 }} />)
    // Nothing may draw past the right edge of the plot area at 442.
    for (const m of html.matchAll(/x[12]?="([\d.]+)"/g)) expect(Number(m[1])).toBeLessThanOrEqual(442)
  })

  it('falls back to the alt text rather than crashing when given no plots', () => {
    expect(renderToStaticMarkup(<BoxPlot alt="a box plot" props={{}} />)).toContain('a box plot')
  })
})
