import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AngleFigure } from './AngleFigure.tsx'

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
    // Centre is at x = 210, y = 150. p is between east and north, so right of centre and above it.
    expect(p.x).toBeGreaterThan(210)
    expect(p.y).toBeLessThan(150)
    // q is between north and west, so left of centre and above it.
    expect(q.x).toBeLessThan(210)
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
})
