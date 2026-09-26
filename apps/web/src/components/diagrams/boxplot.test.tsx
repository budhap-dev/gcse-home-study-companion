import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BoxPlot } from './BoxPlot.tsx'

function contentProps(component: string): Record<string, unknown>[] {
  const root = join(import.meta.dirname, '../../../../../supabase/seed/content')
  const found: Record<string, unknown>[] = []
  const collect = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(collect); return }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>
      if (obj.component === component) found.push((obj.props as Record<string, unknown>) ?? {})
      Object.values(obj).forEach(collect)
    }
  }
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.json')) collect(JSON.parse(readFileSync(full, 'utf8')))
    }
  }
  walk(root)
  return found
}

function fitsPhone(html: string, maxWidth = 296): number {
  const width = Number(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+)/.exec(html)?.[1])
  expect(width).toBeLessThanOrEqual(maxWidth)
  for (const m of html.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)) {
    const attrs = m[1]!, text = m[2]!
    if (!text.trim() || /rotate\(-?90/.test(attrs)) continue
    const x = Number(/(?:^|\s)x="(-?[\d.]+)"/.exec(attrs)?.[1])
    if (!Number.isFinite(x)) continue
    const anchor = /text-anchor="(\w+)"/.exec(attrs)?.[1] ?? 'start'
    const fontSize = Number(/font-size="([\d.]+)"/.exec(attrs)?.[1] ?? '11')
    const w = text.length * 0.6 * fontSize
    const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x
    expect(left, `"${text}" left edge`).toBeGreaterThanOrEqual(-0.5)
    expect(left + w, `"${text}" right edge`).toBeLessThanOrEqual(width + 0.5)
  }
  return width
}

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
    // The left margin is sized to "Class A" (7 characters): max(60, 22 + 7 x 7.2) = 72.4.
    // Plot area is 284 - 72.4 - 14 = 197.6px wide.
    const sx = (x: number) => 72.4 + ((x - 10) / 25) * 197.6
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
    // Nothing may draw past the right edge of the plot area at 284 - 14 = 270.
    for (const m of html.matchAll(/x[12]?="([\d.]+)"/g)) expect(Number(m[1])).toBeLessThanOrEqual(270)
  })

  it('falls back to the alt text rather than crashing when given no plots', () => {
    expect(renderToStaticMarkup(<BoxPlot alt="a box plot" props={{}} />)).toContain('a box plot')
  })

  it('sizes the left margin to the longest row label, so a long one is not clipped', () => {
    // "Through town" (12 characters) needs more room than the old fixed 78px margin gave.
    const html = renderToStaticMarkup(<BoxPlot alt="" props={{ plots: [
      { label: 'Motorway', min: 22, q1: 26, median: 28, q3: 30, max: 34 },
      { label: 'Through town', min: 18, q1: 22, median: 27, q3: 36, max: 58 },
    ] }} />)
    fitsPhone(html)
  })

  it('fits a phone for every box plot the content draws', () => {
    const pack = contentProps('box-plot')
    expect(pack.length).toBeGreaterThan(0)
    for (const props of pack) fitsPhone(renderToStaticMarkup(<BoxPlot alt="" props={props} />))
  })
})
