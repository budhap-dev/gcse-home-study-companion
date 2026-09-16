import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LineGraph } from './LineGraph.tsx'

/**
 * A curve is sampled across the x range and drawn only inside the box, the pen lifting
 * where it leaves. A cubic and a reciprocal both rely on that: the cubic's arms leave
 * the top and bottom, and the reciprocal is infinite at x = 0, so its two arms must
 * come out as two separate strokes rather than a line joined across the asymptote.
 */
describe('line graph curves', () => {
  const paths = (html: string) => [...html.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]!)

  it('draws y = x³ as one stroke through the origin', () => {
    const html = renderToStaticMarkup(<LineGraph alt="" props={{ xRange: [-3, 3], yRange: [-10, 10], curves: [{ a: 0, b: 0, c: 0, cube: 1 }] }} />)
    const [d] = paths(html)
    expect(d).toBeDefined()
    // One pen-down for the whole visible curve: it never leaves the box between -2.15 and 2.15.
    expect(d!.match(/M/g)?.length).toBe(1)
  })

  it('draws y = 1/x as two separate arms, never joined across x = 0', () => {
    const html = renderToStaticMarkup(<LineGraph alt="" props={{ xRange: [-5, 5], yRange: [-5, 5], curves: [{ a: 0, b: 0, c: 0, reciprocal: 1 }] }} />)
    const [d] = paths(html)
    expect(d).toBeDefined()
    expect(d!.match(/M/g)?.length).toBe(2)
  })

  it('puts a curve label where labelX says, not at the curve\'s end', () => {
    const at = (html: string) => Number(/<text x="([\d.]+)"[^>]*>y = 1\/x</.exec(html)?.[1])
    const props = { xRange: [-4, 4], yRange: [-4, 4], curves: [{ a: 0, b: 0, c: 0, reciprocal: 1, label: 'y = 1/x' }] }
    // By default the label sits at the last visible sample: the right-hand edge, on the axis letter.
    expect(at(renderToStaticMarkup(<LineGraph alt="" props={props} />))).toBeGreaterThan(300)
    // With labelX it sits above the curve at that x, well inside the plot.
    const moved = { ...props, curves: [{ ...props.curves[0]!, labelX: 0.6 }] }
    expect(at(renderToStaticMarkup(<LineGraph alt="" props={moved} />))).toBeLessThan(250)
  })

  it('still draws a plain quadratic when neither extension is given', () => {
    const html = renderToStaticMarkup(<LineGraph alt="" props={{ curves: [{ a: 1, b: 0, c: -4 }] }} />)
    expect(paths(html)[0]!.match(/M/g)?.length).toBe(1)
  })
})
