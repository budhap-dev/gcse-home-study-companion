import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { pairLayout, TrianglePair } from './TrianglePair.tsx'

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
   * A sharp vertex has almost no room in it. "30°" was drawn a flat 30px in from the
   * corner of a 30° vertex, where the triangle is a few pixels tall, so the label was
   * painted across both of the sides it sat between. Every existing check passed: the
   * text was inside the picture, above the readable floor and clear of every other
   * label. Only measuring the drawn lines against the label boxes in a browser found it.
   */
  it('never draws a side through an angle label, however sharp the vertex', () => {
    const ANGLE_CHAR = 6 // matches the component

    /** Does the segment pq cross the axis-aligned box, or lie inside it? */
    const crosses = (p: { x: number; y: number }, q: { x: number; y: number }, box: { x0: number; x1: number; y0: number; y1: number }) => {
      const steps = 400
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const x = p.x + (q.x - p.x) * t
        const y = p.y + (q.y - p.y) * t
        if (x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1) return true
      }
      return false
    }

    // A 30-60-90 triangle with room for its labels, and one far too thin to hold any.
    for (const sides of [[8.66, 5, 10], [12, 1.2, 12.05]] as [number, number, number][]) {
      const html = renderToStaticMarkup(
        <TrianglePair alt="" props={{ left: { sides, angles: [1, 'r', 1], angleText: ['30°', '90°', '60°'], labels: ['', '', ''] } }} />,
      )
      const tri = corners(html)
      const labels = texts(html).filter((t) => t.text.endsWith('°'))
      expect(labels).toHaveLength(3)
      for (const label of labels) {
        const halfW = (label.text.length * ANGLE_CHAR) / 2
        // y is the baseline, which the component draws 4px below the centre it chose.
        const cy = label.y - 4
        const box = { x0: label.x - halfW, x1: label.x + halfW, y0: cy - 5.5, y1: cy + 5.5 }
        for (let i = 0; i < 3; i++) {
          expect(crosses(tri[i]!, tri[(i + 1) % 3]!, box), `${sides}: side ${i} runs through "${label.text}"`).toBe(false)
        }
      }
    }
  })

  /**
   * Each triangle is drawn 150px wide by default, which is right for congruence and
   * similarity and wrong for a comparison of sizes: two escalators needing 8.66 m and
   * 7.14 m of floor came out with both floors the same length on the page, which is the
   * opposite of what the example said. `sameScale` makes the pair share one scale.
   */
  it('draws a pair to one scale when asked, and to its own otherwise', () => {
    const pair = { left: { sides: [8.66, 5, 10] }, right: { sides: [7.14, 5, 8.72] } }
    const baseOf = (html: string, which: 0 | 1) => {
      const polygons = [...html.matchAll(/points="([^"]+)"/g)].map((m) => m[1]!)
      const [A, B] = polygons[which]!.split(' ').slice(0, 2).map((p) => {
        const [x, y] = p.split(',').map(Number)
        return { x: x!, y: y! }
      })
      return Math.hypot(B!.x - A!.x, B!.y - A!.y)
    }

    const apart = renderToStaticMarkup(<TrianglePair alt="" props={pair} />)
    expect(baseOf(apart, 0) / baseOf(apart, 1)).toBeCloseTo(1, 2)

    const together = renderToStaticMarkup(<TrianglePair alt="" props={{ ...pair, sameScale: true }} />)
    // The shorter run has to come out shorter, and in the ratio the numbers give.
    expect(baseOf(together, 1) / baseOf(together, 0)).toBeCloseTo(7.14 / 8.66, 2)
    expect(baseOf(together, 0) / 150).toBeCloseTo(1, 2)
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

  /*
   * Side by side the pair is 520 units, and a drawing stops shrinking at its natural
   * width, so on a phone it scrolled 188px with the second triangle out of sight.
   */
  it('stacks the pair in a box narrower than it, and keeps it side by side otherwise', () => {
    const phone = pairLayout(true, 298)
    expect(phone.stacked).toBe(true)
    expect(phone.W).toBeLessThanOrEqual(298)
    // Under the first triangle, which is centred at (140, 120), a whole row down.
    expect(phone.second).toEqual({ cx: 140, cy: 340 })
    expect(phone.H).toBeGreaterThanOrEqual(phone.second.cy + 100)

    expect(pairLayout(true, 742)).toMatchObject({ stacked: false, W: 520, H: 220 })
    // Unmeasured (the server, tests) keeps the natural layout.
    expect(pairLayout(true, undefined).stacked).toBe(false)
    // A single triangle already fits.
    expect(pairLayout(false, 298)).toMatchObject({ stacked: false, W: 280 })
  })
})
