/**
 * Where a label goes so that no drawn line runs through it.
 *
 * A fixed offset off a point ("6 right, 6 up of C") is right for the drawing it was tuned
 * on and wrong for the next one: a construction's arcs cross at C in an X whose arms point
 * wherever the triangle's sides do, and a circle's centre has radii leaving it in any
 * direction. The browser walk found lines through C, C′, O and angle labels across the
 * geometry lessons, each placed by an offset that took no account of what else was drawn.
 *
 * So the caller lists what it draws near the label as straight segments (an arc as a few
 * short ones), and the label is tried at increasing distances in the preferred directions
 * until its box touches none of them.
 */

export type Pt = { x: number; y: number }
export type Seg = [Pt, Pt]

/** An arc about `c` of radius `r` from angle `a1` to `a2` (radians, screen axes), as short segments. */
export function arcSegs(c: Pt, r: number, a1: number, a2: number, n = 12): Seg[] {
  const out: Seg[] = []
  for (let i = 0; i < n; i++) {
    const t1 = a1 + ((a2 - a1) * i) / n, t2 = a1 + ((a2 - a1) * (i + 1)) / n
    out.push([{ x: c.x + r * Math.cos(t1), y: c.y + r * Math.sin(t1) }, { x: c.x + r * Math.cos(t2), y: c.y + r * Math.sin(t2) }])
  }
  return out
}

/** Does the segment p–q pass through the box centred on `c`? Liang–Barsky clipping. */
export function segHitsBox(p: Pt, q: Pt, c: Pt, halfW: number, halfH: number) {
  const dx = q.x - p.x, dy = q.y - p.y
  let t0 = 0, t1 = 1
  const edges: [number, number][] = [
    [-dx, p.x - (c.x - halfW)], [dx, c.x + halfW - p.x],
    [-dy, p.y - (c.y - halfH)], [dy, c.y + halfH - p.y],
  ]
  for (const [pp, qq] of edges) {
    if (pp === 0) { if (qq < 0) return false; continue }
    const t = qq / pp
    if (pp < 0) { if (t > t1) return false; if (t > t0) t0 = t }
    else { if (t < t0) return false; if (t < t1) t1 = t }
  }
  return true
}

export function hits(c: Pt, halfW: number, halfH: number, segs: Seg[], pad = 2) {
  return segs.filter(([p, q]) => segHitsBox(p, q, c, halfW + pad, halfH + pad)).length
}

/**
 * The centre of a `halfW` by `halfH` label placed off `at`: the first of `directions`
 * (radians, tried in order) and distances from `near` to `far` where the box clears every
 * segment. The distance is to the box's edge, not its centre, so a wide label is pushed
 * out further along a horizontal direction than a narrow one. If nothing is clear, the
 * nearest position with the fewest crossings. `accept` can rule a position out altogether.
 */
export function placeLabel(at: Pt, halfW: number, halfH: number, segs: Seg[], directions: number[], near = 4, far = 40, accept: (c: Pt) => boolean = () => true): Pt {
  let best: { c: Pt; n: number } | undefined
  for (let d = near; d <= far; d += 2) {
    for (const a of directions) {
      const cos = Math.cos(a), sin = Math.sin(a)
      const reach = d + Math.min(halfW / Math.max(Math.abs(cos), 1e-6), halfH / Math.max(Math.abs(sin), 1e-6))
      const c = { x: at.x + cos * reach, y: at.y + sin * reach }
      // A position the caller rules out (off the canvas, over another label) counts as crossing everything.
      const n = accept(c) ? hits(c, halfW, halfH, segs) : Infinity
      if (n === 0) return c
      if (!best || n < best.n) best = { c, n }
    }
  }
  return best!.c
}

/** Directions every `step` degrees, starting at `prefer` and alternating either side of it. */
export function around(prefer: number, step = 15, spread = 180): number[] {
  const out = [prefer]
  for (let k = step; k <= spread; k += step) {
    out.push(prefer + (k * Math.PI) / 180)
    if (k < 180) out.push(prefer - (k * Math.PI) / 180)
  }
  return out
}

/** Rough box half-sizes for a label of `text` at `size` px. */
export function labelHalf(text: string, size: number, bold = false) {
  return { halfW: (text.length * size * (bold ? 0.62 : 0.56)) / 2, halfH: size * 0.45 }
}

/** The baseline to give a centred label whose box centre is `cy`. */
export const baseline = (cy: number, size: number) => cy + size * 0.35
