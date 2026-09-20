import { DISPLAY, FONT, INK, INK_2 } from './index.tsx'

/** Width of one character of the 12px length labels, and half their cap height. */
const LENGTH_CHAR = 6.6
const LENGTH_HALF_HEIGHT = 6

interface Tri {
  /** Side lengths AB, BC, CA in arbitrary units; the triangle is drawn to scale. */
  sides: [number, number, number]
  labels?: [string, string, string]
  /** Tick marks per side (0 to 3) to show equal sides. */
  ticks?: [number, number, number]
  /** Angle marks per vertex: 0 none, 1 single arc, 2 double, 3 triple, 'r' right angle. */
  angles?: [number | 'r', number | 'r', number | 'r']
  /** Side length text per side, shown outside. */
  lengths?: [string, string, string]
  /** Angle text per vertex. */
  angleText?: [string, string, string]
  /** Mirror horizontally and rotate in degrees, so the pair is not in the same orientation. */
  flip?: boolean
  rotate?: number
}

/** Width of one character of the 11px angle labels, and half their cap height. */
const ANGLE_CHAR = 6
const ANGLE_HALF_HEIGHT = 5.5

type Pt = { x: number; y: number }

/** Is a point inside the triangle, by the sign of the three cross products? */
function inside(p: Pt, tri: Pt[]) {
  let positive = false
  let negative = false
  for (let i = 0; i < 3; i++) {
    const a = tri[i]!
    const b = tri[(i + 1) % 3]!
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
    if (cross > 0) positive = true
    if (cross < 0) negative = true
  }
  return !(positive && negative)
}

/**
 * Where an angle's text goes: along the internal bisector, at the first distance from the
 * vertex where the whole text box fits inside the triangle.
 *
 * It used to sit at a flat 30px along the vertex-to-centroid line, which is fine for a
 * fat vertex and wrong for a sharp one: at 30° the triangle is only a few pixels tall
 * that far in, so "30°" was painted across both of its own sides. Nothing caught it —
 * the label was inside the picture, above the readable floor and clear of every other
 * label — until the drawn lines were tested against the label boxes in a browser.
 *
 * If no distance fits, the text goes outside the vertex instead, which is legible even
 * though it is not where an angle label belongs.
 */
function anglePlace(v: Pt, p: Pt, q: Pt, tri: Pt[], text: string): Pt {
  const unit = (t: Pt) => { const l = Math.hypot(t.x - v.x, t.y - v.y) || 1; return { x: (t.x - v.x) / l, y: (t.y - v.y) / l } }
  const u1 = unit(p)
  const u2 = unit(q)
  let bx = u1.x + u2.x
  let by = u1.y + u2.y
  const bl = Math.hypot(bx, by)
  // A straight vertex has no bisector; nothing sensible can be drawn inside it anyway.
  if (bl < 1e-6) return { x: v.x, y: v.y }
  bx /= bl
  by /= bl
  const halfW = (text.length * ANGLE_CHAR) / 2
  for (let d = 16; d <= 120; d += 2) {
    const c = { x: v.x + bx * d, y: v.y + by * d }
    const corners = [
      { x: c.x - halfW, y: c.y - ANGLE_HALF_HEIGHT },
      { x: c.x + halfW, y: c.y - ANGLE_HALF_HEIGHT },
      { x: c.x - halfW, y: c.y + ANGLE_HALF_HEIGHT },
      { x: c.x + halfW, y: c.y + ANGLE_HALF_HEIGHT },
    ]
    if (corners.every((corner) => inside(corner, tri))) return c
  }
  const back = halfW + ANGLE_HALF_HEIGHT + 8
  return { x: v.x - bx * back, y: v.y - by * back }
}

/** The apex of a triangle placed with AB along x, in the triangle's own units. */
function apex(tri: Tri) {
  const [ab, bc, ca] = tri.sides
  const x = (ca * ca - bc * bc + ab * ab) / (2 * ab)
  return { ab, x, y: Math.sqrt(Math.max(0, ca * ca - x * x)) }
}

/**
 * Two triangles side by side with tick marks and angle arcs, for congruence and
 * similarity. Props: { left: Tri, right: Tri, sameScale?: boolean }.
 *
 * Each triangle is drawn 150px wide by default, whatever its sides say, which is right
 * for congruence and similarity — the question there is the shape, and a similar pair
 * drawn to true size would put one of them in the corner. It is wrong for a comparison
 * of sizes: an escalator needing 8.66 m of floor beside one needing 7.14 m came out with
 * both floors drawn the same length, which is the opposite of what the example said.
 * `sameScale` makes the pair share one scale, so the reader sees the difference before
 * reading it.
 */
export function TrianglePair({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const left = props.left as Tri
  const right = props.right as Tri | undefined
  const W = right ? 520 : 280
  const H = 220
  const extent = (tri: Tri) => { const a = apex(tri); return Math.max(a.ab, a.x, 1) }
  const shared = props.sameScale && right ? 150 / Math.max(extent(left), extent(right)) : undefined
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W * 1.1 }} role="img" aria-label={alt}>
      <One tri={left} cx={140} cy={120} scale={shared} />
      {right && <One tri={right} cx={380} cy={120} scale={shared} />}
    </svg>
  )
}

function One({ tri, cx, cy, scale: given }: { tri: Tri; cx: number; cy: number; scale?: number }) {
  const { ab, x, y } = apex(tri)
  // place A at origin, B along x, C above
  let pts = [
    { x: 0, y: 0 },
    { x: ab, y: 0 },
    { x, y },
  ]
  // scale to fit ~150px wide, centre
  const scale = given ?? 150 / Math.max(ab, x, 1)
  pts = pts.map((p) => ({ x: p.x * scale, y: -p.y * scale }))
  const mx = (pts[0]!.x + pts[1]!.x + pts[2]!.x) / 3
  const my = (pts[0]!.y + pts[1]!.y + pts[2]!.y) / 3
  const rot = ((tri.rotate ?? 0) * Math.PI) / 180
  pts = pts.map((p) => {
    let dx = p.x - mx
    const dy = p.y - my
    if (tri.flip) dx = -dx
    return { x: cx + dx * Math.cos(rot) - dy * Math.sin(rot), y: cy + dx * Math.sin(rot) + dy * Math.cos(rot) }
  })
  const [A, B, C] = pts as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }]
  const names = tri.labels ?? ['A', 'B', 'C']
  const sides: [typeof A, typeof B][] = [[A, B], [B, C], [C, A]]
  const centroid = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 }
  const out = (p: { x: number; y: number }, q: { x: number; y: number }, d: number) => {
    const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
    const nx = m.x - centroid.x, ny = m.y - centroid.y
    const l = Math.hypot(nx, ny) || 1
    return { x: m.x + (nx / l) * d, y: m.y + (ny / l) * d }
  }
  /**
   * A flat offset only clears a horizontal side, and pushing a label away from the
   * centroid clears a steep one by less than it looks: on a thin triangle that ray runs
   * oblique to the side, so most of the push is spent sliding along the line rather than
   * away from it. Push along the side's own outward normal instead, far enough that the
   * whole text box clears it and not merely the point it is anchored at.
   */
  const outText = (p: { x: number; y: number }, q: { x: number; y: number }, text: string, d: number) => {
    const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
    const len = Math.hypot(q.x - p.x, q.y - p.y) || 1
    let nx = -(q.y - p.y) / len, ny = (q.x - p.x) / len
    // Point it away from the centre of the triangle rather than into it.
    if (nx * (m.x - centroid.x) + ny * (m.y - centroid.y) < 0) { nx = -nx; ny = -ny }
    const halfW = (text.length * LENGTH_CHAR) / 2
    const clear = d + halfW * Math.abs(nx) + LENGTH_HALF_HEIGHT * Math.abs(ny)
    return { x: m.x + nx * clear, y: m.y + ny * clear }
  }
  const tickMarks = (p: typeof A, q: typeof B, n: number) => {
    const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
    const dx = q.x - p.x, dy = q.y - p.y
    const l = Math.hypot(dx, dy) || 1
    const ux = dx / l, uy = dy / l
    const nx = -uy, ny = ux
    return Array.from({ length: n }, (_, i) => {
      const off = (i - (n - 1) / 2) * 5
      const c = { x: m.x + ux * off, y: m.y + uy * off }
      return <line key={i} x1={c.x - nx * 5} y1={c.y - ny * 5} x2={c.x + nx * 5} y2={c.y + ny * 5} stroke={INK} strokeWidth="2" />
    })
  }
  const angleMark = (v: typeof A, p: typeof B, q: typeof C, kind: number | 'r') => {
    const a1 = Math.atan2(p.y - v.y, p.x - v.x)
    const a2 = Math.atan2(q.y - v.y, q.x - v.x)
    let d = a2 - a1
    while (d > Math.PI) d -= 2 * Math.PI
    while (d < -Math.PI) d += 2 * Math.PI
    const sweep = d > 0 ? 1 : 0
    if (kind === 'r') {
      const s = 12
      const u1 = { x: Math.cos(a1) * s, y: Math.sin(a1) * s }
      const u2 = { x: Math.cos(a2) * s, y: Math.sin(a2) * s }
      return <path d={`M${v.x + u1.x} ${v.y + u1.y} L${v.x + u1.x + u2.x} ${v.y + u1.y + u2.y} L${v.x + u2.x} ${v.y + u2.y}`} fill="none" stroke="#d25b3b" strokeWidth="1.5" />
    }
    // Clamp: `kind` is how many arcs to draw, not an angle. Given 45 — which is what a
    // caller thinking in degrees passes — this drew forty five concentric arcs across
    // the whole picture rather than failing.
    const arcs = Math.max(0, Math.min(3, Math.round(kind)))
    return Array.from({ length: arcs }, (_, i) => {
      const r = 14 + i * 5
      const s = { x: v.x + Math.cos(a1) * r, y: v.y + Math.sin(a1) * r }
      const e = { x: v.x + Math.cos(a2) * r, y: v.y + Math.sin(a2) * r }
      return <path key={i} d={`M${s.x} ${s.y} A${r} ${r} 0 0 ${sweep} ${e.x} ${e.y}`} fill="none" stroke="#d25b3b" strokeWidth="1.5" />
    })
  }
  const verts = [A, B, C]
  return (
    <g>
      <polygon points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="var(--subject-soft)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      {sides.map(([p, q], i) => (
        <g key={i}>
          {tri.ticks?.[i] ? tickMarks(p, q, tri.ticks[i]!) : null}
          {tri.lengths?.[i] && (() => { const o = outText(p, q, tri.lengths![i]!, 10); return <text x={o.x} y={o.y + 4} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>{tri.lengths![i]}</text> })()}
        </g>
      ))}
      {verts.map((v, i) => {
        const p = verts[(i + 1) % 3]!, q = verts[(i + 2) % 3]!
        const kind = tri.angles?.[i] ?? 0
        const o = out(v, v, 0)
        const away = { x: v.x - centroid.x, y: v.y - centroid.y }
        const l = Math.hypot(away.x, away.y) || 1
        const lp = { x: v.x + (away.x / l) * 14, y: v.y + (away.y / l) * 14 }
        void o
        return (
          <g key={i}>
            {kind ? angleMark(v, p, q, kind) : null}
            <text x={lp.x} y={lp.y + 4} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>{names[i]}</text>
            {tri.angleText?.[i] && (() => { const ip = anglePlace(v, p, q, pts, tri.angleText![i]!); return <text x={ip.x} y={ip.y + 4} textAnchor="middle" fontFamily={FONT} fontSize="11" fill="#d25b3b">{tri.angleText![i]}</text> })()}
          </g>
        )
      })}
    </g>
  )
}
