import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Histogram } from './Histogram.tsx'

/**
 * The bar heights are frequency density, worked out by the component from the
 * frequencies. A student reads the density off the picture and multiplies back to a
 * frequency, so the arithmetic here has to be the arithmetic the lesson teaches.
 */
describe('histogram', () => {
  const BARS = [
    { from: 0, to: 10, frequency: 15 },   // width 10, density 1.5
    { from: 10, to: 15, frequency: 20 },  // width 5,  density 4
    { from: 15, to: 35, frequency: 10 },  // width 20, density 0.5
  ]

  it('prints frequency divided by class width on every bar', () => {
    const html = renderToStaticMarkup(<Histogram alt="" props={{ bars: BARS }} />)
    for (const d of ['1.5', '4', '0.5']) expect(html, d).toContain(`>${d}<`)
  })

  it('gives a wider class a lower bar for the same frequency', () => {
    const html = renderToStaticMarkup(<Histogram alt="" props={{ bars: [
      { from: 0, to: 10, frequency: 20 },
      { from: 10, to: 30, frequency: 20 },
    ] }} />)
    // Same frequency, double the width, so half the height: 2 against 1.
    expect(html).toContain('>2<')
    expect(html).toContain('>1<')
  })

  it('labels both axes and every class boundary', () => {
    const html = renderToStaticMarkup(<Histogram alt="" props={{ bars: BARS, xLabel: 'time (minutes)' }} />)
    expect(html).toContain('time (minutes)')
    expect(html).toContain('frequency density')
    for (const b of ['0', '10', '15', '35']) expect(html, b).toContain(`>${b}<`)
  })

  it('falls back to the alt text rather than crashing when given no bars', () => {
    expect(renderToStaticMarkup(<Histogram alt="a histogram" props={{}} />)).toContain('a histogram')
  })
})
