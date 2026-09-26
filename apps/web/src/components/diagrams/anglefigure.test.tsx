import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AngleFigure } from './AngleFigure.tsx'

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
 * These two figures carry the whole of the angle-properties topic, so what matters is
 * that the labelled angle really sits inside the angle it names. A label drawn on the
 * wrong side of a ray teaches the wrong fact while looking perfectly tidy.
 */
describe('angle figure', () => {
  const texts = (html: string) => [...html.matchAll(/<text[^>]*x="([-\d.]+)"[^>]*y="([-\d.]+)"[^>]*>([^<]*)<\/text>/g)]
    .map((m) => ({ x: Number(m[1]), y: Number(m[2]), text: m[3]! }))

  it('puts each arc label inside its own gap', () => {
    // Rays east, north and west: the gap from east to north is the upper right quadrant.
    const html = renderToStaticMarkup(<AngleFigure alt="" props={{ kind: 'rays', rays: [{ at: 0 }, { at: 90 }, { at: 180 }], arcs: [{ from: 0, text: 'p' }, { from: 1, text: 'q' }] }} />)
    const p = texts(html).find((t) => t.text === 'p')!
    const q = texts(html).find((t) => t.text === 'q')!
    // Centre is at x = 140, y = 150. p is between east and north, so right of centre and above it.
    expect(p.x).toBeGreaterThan(140)
    expect(p.y).toBeLessThan(150)
    // q is between north and west, so left of centre and above it.
    expect(q.x).toBeLessThan(140)
    expect(q.y).toBeLessThan(150)
  })

  it('draws a straight line through the centre when line is set', () => {
    const plain = renderToStaticMarkup(<AngleFigure alt="" props={{ kind: 'rays', rays: [{ at: 0 }, { at: 55 }, { at: 180 }] }} />)
    const withLine = renderToStaticMarkup(<AngleFigure alt="" props={{ kind: 'rays', rays: [{ at: 0 }, { at: 55 }, { at: 180 }], line: true }} />)
    // The full line replaces the two opposite rays rather than being drawn on top of them.
    expect((withLine.match(/<line /g) ?? []).length).toBe((plain.match(/<line /g) ?? []).length - 1)
  })

  it('places the eight parallel-line angles around the two crossings', () => {
    const html = renderToStaticMarkup(<AngleFigure alt="" props={{ kind: 'parallel', labels: { a: 'a', b: 'b', c: 'c', d: 'd', e: 'e', f: 'f', g: 'g', h: 'h' } }} />)
    const at = (k: string) => texts(html).find((t) => t.text === k)!
    // a and b sit above their crossing; c and d below it. Same again at the lower line.
    expect(at('a').y).toBeLessThan(at('c').y)
    expect(at('e').y).toBeLessThan(at('g').y)
    // The lower crossing is below the upper one, so e is below a.
    expect(at('e').y).toBeGreaterThan(at('a').y)
    // a is left of b at the same crossing.
    expect(at('a').x).toBeLessThan(at('b').x)
  })

  it('marks the parallel lines with arrows', () => {
    const html = renderToStaticMarkup(<AngleFigure alt="" props={{ kind: 'parallel', labels: {} }} />)
    // Two arrowheads on each of the two lines, which is how a diagram says "parallel".
    expect((html.match(/<path /g) ?? []).length).toBe(4)
  })

  it('fits a phone for every angle figure the content draws', () => {
    const pack = contentProps('angle-figure')
    expect(pack.length).toBeGreaterThan(0)
    for (const props of pack) fitsPhone(renderToStaticMarkup(<AngleFigure alt="" props={props} />))
  })
})
