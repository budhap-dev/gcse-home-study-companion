import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BarChart } from './BarChart.tsx'

const rects = (html: string) => [...html.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map((m) => ({ x: +m[1]!, y: +m[2]!, w: +m[3]!, h: +m[4]! }))
const ticks = (html: string) => [...html.matchAll(/<text[^>]*text-anchor="end"[^>]*>([\d.]+)<\/text>/g)].map((m) => +m[1]!)

describe('composite bar chart', () => {
  const props = { categories: ['Walk', 'Bus', 'Car', 'Cycle'], values: [12, 8, 5, 5], values2: [9, 10, 7, 4], names: ['Boys', 'Girls'], style: 'stacked', yStep: 5 }
  const html = renderToStaticMarkup(<BarChart props={props} alt="" />)
  // The two key swatches come first, then two stacked rects per category.
  const bars = rects(html).slice(2)

  it('stacks the second series on the first, one bar per category', () => {
    expect(bars).toHaveLength(8)
    for (let i = 0; i < 4; i++) {
      const low = bars[2 * i]!, high = bars[2 * i + 1]!
      expect(high.x).toBe(low.x)
      expect(high.w).toBe(low.w)
      // The top part starts exactly where the bottom one stops.
      expect(high.y + high.h).toBeCloseTo(low.y, 6)
      // Heights in proportion to the data: boys against girls.
      expect(low.h / high.h).toBeCloseTo(props.values[i]! / props.values2[i]!, 6)
    }
  })

  it('scales the axis to the tallest total, not the tallest part', () => {
    expect(Math.max(...ticks(html))).toBe(25)
    const heights = bars.filter((_, k) => k % 2 === 0).map((low, i) => low.h + bars[2 * i + 1]!.h)
    expect(heights[0]! / heights[3]!).toBeCloseTo(21 / 9, 6)
  })

  it('still draws a dual chart side by side without the style', () => {
    const dual = rects(renderToStaticMarkup(<BarChart props={{ ...props, style: undefined }} alt="" />)).slice(2)
    expect(dual[1]!.x).toBeGreaterThan(dual[0]!.x)
  })
})
