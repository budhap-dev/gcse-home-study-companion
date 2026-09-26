import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CumulativeFrequency } from './CumulativeFrequency.tsx'

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

  /**
   * Two readings taken close together used to print their labels on the same line just
   * above the axis, one over the other. A median beside a quartile is the commonest pair
   * a question asks for, so this is the normal case rather than an odd one.
   */
  it('stacks two reading labels that would otherwise be printed on top of each other', () => {
    const close = [[125, 4], [130, 18], [135, 52], [140, 104], [145, 158], [150, 188], [155, 200]].map(([x, y]) => ({ x, y }))
    const html = renderToStaticMarkup(<CumulativeFrequency alt="" props={{
      points: close, readings: [{ y: 100, label: 'median' }, { y: 150, label: '75th centile' }],
    }} />)
    const ys = [...html.matchAll(/<text x="[\d.]+" y="([\d.]+)"[^>]*>([^<]*(?:median|centile)[^<]*)</g)].map((m) => Number(m[1]))
    expect(ys).toHaveLength(2)
    // Different rows, far enough apart that 11px text cannot touch.
    expect(Math.abs(ys[0]! - ys[1]!)).toBeGreaterThanOrEqual(12)
  })

  it('leaves two readings on one line when they are far enough apart to fit', () => {
    const html = renderToStaticMarkup(<CumulativeFrequency alt="" props={{ points: POINTS, readings: [{ y: 10, label: 'LQ' }, { y: 30, label: 'UQ' }] }} />)
    const ys = [...html.matchAll(/<text x="[\d.]+" y="([\d.]+)"[^>]*>([^<]*Q ≈[^<]*)</g)].map((m) => Number(m[1]))
    expect(ys).toHaveLength(2)
    expect(ys[0]).toBe(ys[1])
  })

  /**
   * A reading taken near the right of the data used to always grow its label rightwards,
   * which on the narrower phone width ran the label past the edge of the picture.
   */
  it('grows a reading label to the left when there is no room to its right', () => {
    const html = renderToStaticMarkup(<CumulativeFrequency alt="" props={{
      points: [{ x: 125, y: 4 }, { x: 130, y: 18 }, { x: 135, y: 52 }, { x: 140, y: 104 }, { x: 145, y: 158 }, { x: 150, y: 188 }, { x: 155, y: 200 }],
      readings: [{ y: 150, label: '75th centile' }],
    }} />)
    fitsPhone(html)
  })

  it('wraps a long title onto two lines rather than pushing the graph wider', () => {
    const html = renderToStaticMarkup(<CumulativeFrequency alt="" props={{ points: POINTS, title: 'Heights of 200 children of the same age' }} />)
    expect((html.match(/<text[^>]*font-family="Bricolage[^>]*>/g) ?? []).length).toBe(2)
    fitsPhone(html)
  })

  it('fits a phone for every cumulative frequency graph the content draws', () => {
    const pack = contentProps('cumulative-frequency')
    expect(pack.length).toBeGreaterThan(0)
    for (const props of pack) fitsPhone(renderToStaticMarkup(<CumulativeFrequency alt="" props={props} />))
  })
})
