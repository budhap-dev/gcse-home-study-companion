import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Histogram } from './Histogram.tsx'

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

  it('wraps a long title onto two lines rather than pushing the chart wider', () => {
    const html = renderToStaticMarkup(<Histogram alt="" props={{ bars: BARS, title: 'Drawn properly: area is the number of people' }} />)
    expect((html.match(/<text[^>]*font-family="Bricolage[^>]*>/g) ?? []).length).toBe(2 + BARS.length) // title lines plus each bar's density label
    fitsPhone(html)
  })

  it('fits a phone for every histogram the content draws', () => {
    const pack = contentProps('histogram')
    expect(pack.length).toBeGreaterThan(0)
    for (const props of pack) fitsPhone(renderToStaticMarkup(<Histogram alt="" props={props} />))
  })
})
