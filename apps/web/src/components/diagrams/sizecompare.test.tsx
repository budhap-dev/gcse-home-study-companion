import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SizeCompare } from './SizeCompare.tsx'

/**
 * The argument this component makes is made by the bar lengths, so the lengths have to
 * be honest. A bar rescaled to look tidy would say the opposite of what the numbers say,
 * and the reader would have no way to tell.
 */
describe('size-compare', () => {
  const widths = (html: string) =>
    [...html.matchAll(/<rect x="\d+" y="[\d.]+" width="([\d.]+)"/g)].map((m) => Number(m[1]))

  it('draws bars in true proportion to the values', () => {
    const html = renderToStaticMarkup(
      <SizeCompare alt="" props={{ bars: [{ label: 'One', value: 100 }, { label: 'Two', value: 50 }, { label: 'Three', value: 25 }] }} />,
    )
    // Each row draws a track then a bar, so the bars are every second rect.
    const bars = widths(html).filter((_, i) => i % 2 === 1)
    expect(bars).toHaveLength(3)
    expect(bars[1]! / bars[0]!).toBeCloseTo(0.5, 2)
    expect(bars[2]! / bars[0]!).toBeCloseTo(0.25, 2)
  })

  /** A text message beside a photo is the case this exists for, and it must not be tidied away. */
  it('keeps a tiny bar tiny, but still visible', () => {
    const html = renderToStaticMarkup(
      <SizeCompare alt="" props={{ bars: [{ label: 'Photo', value: 2_400_000 }, { label: 'Message', value: 140 }] }} />,
    )
    const bars = widths(html).filter((_, i) => i % 2 === 1)
    expect(bars[1]!).toBeLessThan(2)
    expect(bars[1]!).toBeGreaterThan(0)
  })

  it('prints the display text rather than the raw number', () => {
    const html = renderToStaticMarkup(
      <SizeCompare alt="" props={{ bars: [{ label: 'Salt', value: 801, display: '801 °C' }, { label: 'Sugar', value: 160, display: 'about 160 °C' }] }} />,
    )
    expect(html).toContain('801 °C')
    expect(html).toContain('about 160 °C')
    expect(html).not.toContain('>801<')
  })

  /** A number inside a bar too short to hold it is unreadable, so it moves outside. */
  it('puts the value outside the bar when it will not fit inside', () => {
    const html = renderToStaticMarkup(
      <SizeCompare alt="" props={{ bars: [{ label: 'Big', value: 1000, display: '1000' }, { label: 'Small', value: 1, display: '1' }] }} />,
    )
    const anchors = [...html.matchAll(/text-anchor="(end|start)"/g)].map((m) => m[1])
    expect(anchors).toEqual(['end', 'start'])
  })

  it('caps at three bars and keeps every label and caption', () => {
    const html = renderToStaticMarkup(
      <SizeCompare alt="" props={{ caption: 'the same words, both times', bars: [
        { label: 'A', value: 3 }, { label: 'B', value: 2 }, { label: 'C', value: 1 }, { label: 'D', value: 9 },
      ] }} />,
    )
    for (const l of ['A', 'B', 'C']) expect(html).toContain(`>${l}<`)
    expect(html).not.toContain('>D<')
    expect(html).toContain('the same words, both times')
  })
})
