import { DISPLAY, FONT, INK, INK_2 } from './index.tsx'

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

/**
 * Two triangles side by side with tick marks and angle arcs, for congruence and
 * similarity. Props: { left: Tri, right: Tri }.
 */
export function TrianglePair({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const left = props.left as Tri
  const right = props.right as Tri | undefined
  const W = right ? 520 : 280
  const H = 220
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W * 1.1 }} role="img" aria-label={alt}>
      <One tri={left} cx={140} cy={120} />
      {right && <One tri={right} cx={380} cy={120} />}
    </svg>
  )
}

function One({ tri, cx, cy }: { tri: Tri; cx: number; cy: number }) {
  const [ab, bc, ca] = tri.sides
  // place A at origin, B along x, C above
  const x = (ca * ca - bc * bc + ab * ab) / (2 * ab)
  const y = Math.sqrt(Math.max(0, ca * ca - x * x))
  let pts = [
    { x: 0, y: 0 },
    { x: ab, y: 0 },
    { x, y },
  ]
  // scale to fit ~150px wide, centre
  const scale = 150 / Math.max(ab, x, 1)
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
    return Array.from({ length: kind }, (_, i) => {
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
          {tri.lengths?.[i] && (() => { const o = out(p, q, 14); return <text x={o.x} y={o.y + 4} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>{tri.lengths![i]}</text> })()}
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
            {tri.angleText?.[i] && (() => { const ip = { x: v.x - (away.x / l) * 30, y: v.y - (away.y / l) * 30 }; return <text x={ip.x} y={ip.y + 4} textAnchor="middle" fontFamily={FONT} fontSize="11" fill="#d25b3b">{tri.angleText![i]}</text> })()}
          </g>
        )
      })}
    </g>
  )
}
