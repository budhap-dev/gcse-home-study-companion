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

  it('draws y = sin x as one stroke with its peak at 90 degrees', () => {
    const props = { xRange: [0, 360], yRange: [-1.4, 1.4], waves: [{ fn: 'sin' }] }
    const d = paths(renderToStaticMarkup(<LineGraph alt="" props={props} />))[0]!
    expect(d.match(/M/g)?.length).toBe(1)
    const pts = [...d.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const)
    // The curve is checked against plotted points, which use the same scales: the wave
    // must pass through (90, 1), (180, 0) and (270, -1), not merely peak somewhere.
    const marks = [...renderToStaticMarkup(<LineGraph alt="" props={{ ...props, points: [{ x: 90, y: 1 }, { x: 180, y: 0 }, { x: 270, y: -1 }] }} />)
      .matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])] as const)
    expect(marks).toHaveLength(3)
    for (const [mx, my] of marks) {
      const near = pts.reduce((a, b) => (Math.abs(b[0] - mx) < Math.abs(a[0] - mx) ? b : a))
      expect(Math.abs(near[1] - my)).toBeLessThan(1)
    }
  })

  it('draws y = tan x as three branches, never joined across its asymptotes', () => {
    const html = renderToStaticMarkup(<LineGraph alt="" props={{ xRange: [-180, 180], yRange: [-5, 5], waves: [{ fn: 'tan' }] }} />)
    // Branches through -180, 0 and 180, with the pen lifted either side of -90 and 90.
    expect(paths(html)[0]!.match(/M/g)?.length).toBe(3)
  })

  it('draws y = 2^x through the points an exponential must pass through', () => {
    const props = { xRange: [-1, 4], yRange: [0, 17], curves: [{ a: 0, b: 0, c: 0, base: 2 }] }
    const d = paths(renderToStaticMarkup(<LineGraph alt="" props={props} />))[0]!
    const pts = [...d.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const)
    // Checked against plotted points, which use the same scales: 2^0 = 1, 2^2 = 4, 2^4 = 16.
    const marks = [...renderToStaticMarkup(<LineGraph alt="" props={{ ...props, points: [{ x: 0, y: 1 }, { x: 2, y: 4 }, { x: 4, y: 16 }] }} />)
      .matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])] as const)
    expect(marks).toHaveLength(3)
    for (const [mx, my] of marks) {
      const near = pts.reduce((a, b) => (Math.abs(b[0] - mx) < Math.abs(a[0] - mx) ? b : a))
      expect(Math.abs(near[1] - my)).toBeLessThan(2)
    }
  })

  it('scales an exponential without changing where it sits at x = 0', () => {
    const html = renderToStaticMarkup(<LineGraph alt="" props={{ xRange: [0, 4], yRange: [0, 50], curves: [{ a: 0, b: 0, c: 0, base: 2, scale: 5 }], points: [{ x: 0, y: 5 }, { x: 3, y: 40 }] }} />)
    const d = paths(html)[0]!
    const pts = [...d.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const)
    const marks = [...html.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])] as const)
    for (const [mx, my] of marks) {
      const near = pts.reduce((a, b) => (Math.abs(b[0] - mx) < Math.abs(a[0] - mx) ? b : a))
      expect(Math.abs(near[1] - my)).toBeLessThan(2)
    }
  })

  it('draws a polygon at the coordinates it is given, closed and in order', () => {
    const props = { xRange: [-1, 7], yRange: [-1, 7], square: true, polygons: [{ points: [[1, 1], [4, 1], [1, 3]], label: 'A' }] }
    const html = renderToStaticMarkup(<LineGraph alt="" props={props} />)
    const pts = /<polygon points="([^"]+)"/.exec(html)![1]!.split(' ').map((p) => p.split(',').map(Number) as [number, number])
    expect(pts).toHaveLength(3)
    // Checked against plotted points on the same scales, not against computed pixels.
    const marks = [...renderToStaticMarkup(<LineGraph alt="" props={{ ...props, polygons: [], points: [{ x: 1, y: 1 }, { x: 4, y: 1 }, { x: 1, y: 3 }] }} />)
      .matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])] as const)
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(pts[i]![0] - marks[i]![0])).toBeLessThan(0.6)
      expect(Math.abs(pts[i]![1] - marks[i]![1])).toBeLessThan(0.6)
    }
  })

  it('draws a circle round when square is set, and oval when it is not', () => {
    const props = { xRange: [-6, 6], yRange: [-6, 6], circles: [{ cx: 0, cy: 0, r: 5 }] }
    const radii = (html: string) => {
      const m = /<ellipse[^>]*rx="([\d.]+)"[^>]*ry="([\d.]+)"/.exec(html)!
      return [Number(m[1]), Number(m[2])] as const
    }
    const [rx, ry] = radii(renderToStaticMarkup(<LineGraph alt="" props={{ ...props, square: true }} />))
    expect(Math.abs(rx - ry)).toBeLessThan(0.5)
    const [ox, oy] = radii(renderToStaticMarkup(<LineGraph alt="" props={props} />))
    expect(ox).toBeGreaterThan(oy + 10)
  })

  /**
   * At a crossing, the lines are exactly where a label above the point would go, so the
   * text ends up with a line drawn through it. labelBelow puts it under the point.
   */
  it('puts a point label below the point when asked, and above by default', () => {
    const props = { xRange: [-60, 40], yRange: [-60, 110], lines: [{ m: 1, c: 0 }] }
    const at = (html: string) => {
      const circle = /<circle cx="([\d.-]+)" cy="([\d.-]+)"/.exec(html)!
      const text = /<text x="[\d.-]+" y="([\d.-]+)"[^>]*font-size="12"[^>]*>both<\/text>/.exec(html)!
      return { point: Number(circle[2]), label: Number(text[1]) }
    }
    const above = at(renderToStaticMarkup(<LineGraph alt="" props={{ ...props, points: [{ x: -40, y: -40, label: 'both' }] }} />))
    const below = at(renderToStaticMarkup(<LineGraph alt="" props={{ ...props, points: [{ x: -40, y: -40, label: 'both', labelBelow: true }] }} />))
    // SVG y grows downwards, so "below the point" is a larger y than the point itself.
    expect(above.label).toBeLessThan(above.point)
    expect(below.label).toBeGreaterThan(below.point)
  })
})

/**
 * Every label is nudged clear of the ones already placed, but only if it registers the
 * part of the line it actually covers. A centred label used to register the half-width
 * to the right of its anchor, so a circle labelled on the y-axis reserved empty space
 * and printed over the tick number beside it — and every existing check passed.
 */
describe('centred labels and the boxes they reserve', () => {
  const texts = (html: string) => [...html.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)"([^>]*)>([^<]*)</g)]
    .map((m) => ({ x: Number(m[1]), y: Number(m[2]), anchor: /text-anchor="(\w+)"/.exec(m[3]!)?.[1] ?? 'start', size: Number(/font-size="([\d.]+)"/.exec(m[3]!)?.[1] ?? 12), text: m[4]! }))
  const find = (html: string, t: string) => texts(html).find((e) => e.text === t)
  /** The stretch of x a label really covers, which depends on how it is anchored. */
  const span = (e: { x: number; anchor: string; size: number; text: string }) => {
    const w = e.text.length * e.size * 0.55
    return e.anchor === 'end' ? [e.x - w, e.x] : e.anchor === 'middle' ? [e.x - w / 2, e.x + w / 2] : [e.x, e.x + w]
  }
  const overlap = (a: ReturnType<typeof texts>[number], b: ReturnType<typeof texts>[number]) => {
    const [a1, a2] = span(a), [b1, b2] = span(b)
    return Math.abs(a.y - b.y) < Math.max(a.size, b.size) && a1! < b2! && b1! < a2!
  }

  const track = {
    xRange: [-50, 50], yRange: [-50, 50], square: true, grid: false,
    circles: [{ cx: 0, cy: 0, r: 36.8, label: 'lane 1' }, { cx: 0, cy: 0, r: 45.34, label: 'lane 8' }],
  }

  it('never prints two labels on top of each other, whatever their anchors', () => {
    const all = texts(renderToStaticMarkup(<LineGraph alt="" props={track} />))
    expect(all.length).toBeGreaterThan(8)
    for (const a of all) for (const b of all) {
      if (a === b) continue
      expect(overlap(a, b), `"${a.text}" and "${b.text}" overlap`).toBe(false)
    }
  })

  it('keeps every label inside the canvas rather than nudging one off the top', () => {
    const all = texts(renderToStaticMarkup(<LineGraph alt="" props={track} />))
    for (const e of all) expect(e.y, `"${e.text}" is drawn at y = ${e.y}`).toBeGreaterThanOrEqual(0)
  })

  it('leaves a centred polygon label alone when nothing is near it', () => {
    const props = { xRange: [-1, 7], yRange: [-1, 7], square: true, polygons: [{ points: [[1, 1], [4, 1], [1, 3]], label: 'A' }] }
    const label = find(renderToStaticMarkup(<LineGraph alt="" props={props} />), 'A')
    expect(label).toBeDefined()
    // Pinned at the value HEAD produced, so a later collision fix cannot quietly start
    // moving labels that were already sitting where they were asked to.
    expect(label!.y).toBeCloseTo(194.67, 1)
  })
})
