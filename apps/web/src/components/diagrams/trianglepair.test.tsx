import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TrianglePair } from './TrianglePair.tsx'

/**
 * Side labels used to be pushed a flat 14px out from the centroid. That clears a
 * horizontal side, but against a steep one a centred label still reaches back over the
 * line by half its own width, and "5 cm" was drawn sitting on the edge it labelled.
 * The clearance now has to account for the width of the text itself.
 */
describe('triangle-pair', () => {
  const CHAR = 6.6 // matches LENGTH_CHAR in the component

  /** Every <text> in the markup, with its position and content. */
  const texts = (html: string) =>
    [...html.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)"[^>]*>([^<]*)<\/text>/g)].map((m) => ({
      x: Number(m[1]), y: Number(m[2]), text: m[3]!,
    }))

  const corners = (html: string) =>
    html.match(/points="([^"]+)"/)![1]!.split(' ').map((p) => {
      const [x, y] = p.split(',').map(Number)
      return { x: x!, y: y! }
    })

  /** Shortest distance from a point to the segment pq. */
  const distToSide = (pt: { x: number; y: number }, p: { x: number; y: number }, q: { x: number; y: number }) => {
    const dx = q.x - p.x, dy = q.y - p.y
    const t = Math.max(0, Math.min(1, ((pt.x - p.x) * dx + (pt.y - p.y) * dy) / (dx * dx + dy * dy)))
    return Math.hypot(pt.x - (p.x + t * dx), pt.y - (p.y + t * dy))
  }

  it('keeps every length label clear of the side it labels, however steep', () => {
    // A tall thin triangle makes two of its three sides very steep.
    const html = renderToStaticMarkup(
      <TrianglePair alt="" props={{ left: { sides: [4, 12, 12], lengths: ['4 cm', '12 cm', '12 cm'] } }} />,
    )
    const [A, B, C] = corners(html) as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }]
    const sides: [typeof A, typeof B][] = [[A, B], [B, C], [C, A]]
    const labels = texts(html).filter((t) => t.text.endsWith('cm'))
    expect(labels).toHaveLength(3)

    for (const label of labels) {
      // The corners of the label's own box, not just its anchor point.
      const halfW = (label.text.length * CHAR) / 2
      const box = [
        { x: label.x - halfW, y: label.y - 10 }, { x: label.x + halfW, y: label.y - 10 },
        { x: label.x - halfW, y: label.y }, { x: label.x + halfW, y: label.y },
      ]
      for (const side of sides) {
        for (const corner of box) {
          expect(distToSide(corner, side[0], side[1])).toBeGreaterThan(2)
        }
      }
    }
  })

  it('draws both triangles of a pair, with their markings', () => {
    const html = renderToStaticMarkup(
      <TrianglePair
        alt=""
        props={{
          left: { sides: [7, 5, 6], ticks: [1, 0, 2], angles: [1, 0, 0] },
          right: { sides: [7, 5, 6], ticks: [1, 0, 2], angles: [1, 0, 0], flip: true, rotate: -14 },
        }}
      />,
    )
    expect(html.match(/<polygon/g)).toHaveLength(2)
    // One tick on AB and two on CA, per triangle: six tick lines in all.
    expect((html.match(/stroke-width="2"/g) ?? []).length).toBeGreaterThanOrEqual(6)
  })

  /**
   * `angles` is how many arcs to draw, not an angle in degrees. A caller thinking in
   * degrees passed 45, and the component drew forty five concentric arcs across the
   * whole picture rather than failing or clamping.
   */
  it('never draws more than three arcs at a vertex', () => {
    const arcs = (kind: number | string) =>
      (renderToStaticMarkup(
        <TrianglePair alt="" props={{ left: { sides: [3, 4, 5], angles: [kind, 0, 0] } }} />,
      ).match(/<path /g) ?? []).length

    expect(arcs(1)).toBe(1)
    expect(arcs(3)).toBe(3)
    expect(arcs(45)).toBe(3)
    expect(arcs(-2)).toBe(0)
    expect(arcs('r')).toBe(1) // a right angle is one path, whatever the number rules say
  })
})
