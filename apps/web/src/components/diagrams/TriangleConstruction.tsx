import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

/**
 * A triangle construction with its compass arcs and protractor marks left in,
 * the way an examiner wants to see it. Props:
 *   kind: 'sss' | 'sas' | 'asa' | 'ssa'
 *   sides: [AB, AC, BC] in cm as needed by the kind; angles: { A, B } in degrees as needed
 *   stage: 1 draws the base, 2 adds the arcs or rays, 3 (default) completes the triangle
 *   labels: { A, B, C } vertex names
 */
export function TriangleConstruction({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const kind = String(props.kind ?? 'sss') as 'sss' | 'sas' | 'asa' | 'ssa'
  const stage = Number(props.stage ?? 3)
  const sides = (props.sides as number[] | undefined) ?? [7, 5, 6]
  const angles = (props.angles as { A?: number; B?: number } | undefined) ?? {}
  const names = (props.labels as { A?: string; B?: string; C?: string } | undefined) ?? {}
  const [AB, AC, BC] = [sides[0] ?? 7, sides[1] ?? 5, sides[2] ?? 6]
  const rad = (d: number) => (d * Math.PI) / 180

  // vertices in cm, A at the origin, B on the x axis
  const A = { x: 0, y: 0 }
  const B = { x: AB, y: 0 }
  let C = { x: 0, y: 0 }
  let C2: { x: number; y: number } | null = null
  if (kind === 'sss') {
    const x = (AC * AC - BC * BC + AB * AB) / (2 * AB)
    C = { x, y: Math.sqrt(Math.max(0, AC * AC - x * x)) }
  } else if (kind === 'sas') {
    const a = rad(angles.A ?? 50)
    C = { x: AC * Math.cos(a), y: AC * Math.sin(a) }
  } else if (kind === 'asa') {
    const a = rad(angles.A ?? 50)
    const b = rad(angles.B ?? 60)
    // intersection of rays from A and B
    const t = (AB * Math.sin(b)) / Math.sin(Math.PI - a - b)
    C = { x: t * Math.cos(a), y: t * Math.sin(a) }
  } else {
    // ssa: angle at A, side AB, side BC. Two possible C on the ray from A.
    const a = rad(angles.A ?? 40)
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    // solve |A + t d - B| = BC
    const bq = -2 * (dx * AB)
    const cq = AB * AB - BC * BC
    const disc = bq * bq - 4 * cq
    const t1 = (-bq + Math.sqrt(Math.max(0, disc))) / 2
    const t2 = (-bq - Math.sqrt(Math.max(0, disc))) / 2
    C = { x: t1 * dx, y: t1 * dy }
    if (t2 > 0.2 && Math.abs(t2 - t1) > 0.2) C2 = { x: t2 * dx, y: t2 * dy }
  }

  // 23px per cm (down from 34): the widest construction in the pack (10, 13, 13) drew at
  // 421 units and scrolled on a phone. The vertex and arc labels are placed in fixed
  // pixels off each point rather than scaled cm, so they keep the same clearance at any S.
  const S = 23 // px per cm
  const minX = Math.min(A.x, B.x, C.x, C2?.x ?? 0) - 1.2
  const maxX = Math.max(A.x, B.x, C.x, C2?.x ?? 0) + 1.2
  const maxY = Math.max(C.y, C2?.y ?? 0) + 1.2
  const W = (maxX - minX) * S
  const H = (maxY + 1.0) * S
  const px = (p: { x: number; y: number }) => ({ x: (p.x - minX) * S, y: (maxY - p.y) * S })
  const a = px(A), b = px(B), c = px(C)
  const arcPath = (centre: { x: number; y: number }, r: number, fromDeg: number, toDeg: number) => {
    const p1 = px({ x: centre.x + r * Math.cos(rad(fromDeg)), y: centre.y + r * Math.sin(rad(fromDeg)) })
    const p2 = px({ x: centre.x + r * Math.cos(rad(toDeg)), y: centre.y + r * Math.sin(rad(toDeg)) })
    const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0
    return `M${p1.x.toFixed(1)} ${p1.y.toFixed(1)} A${r * S} ${r * S} 0 ${large} 0 ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  const angleAt = (v: { x: number; y: number }, other1: { x: number; y: number }, other2: { x: number; y: number }) => {
    const d1 = Math.atan2(other1.y - v.y, other1.x - v.x)
    const d2 = Math.atan2(other2.y - v.y, other2.x - v.x)
    return [(d1 * 180) / Math.PI, (d2 * 180) / Math.PI]
  }
  const angleArc = (v: { x: number; y: number }, o1: { x: number; y: number }, o2: { x: number; y: number }, label?: string) => {
    const [d1, d2] = angleAt(v, o1, o2)
    const lo = Math.min(d1!, d2!), hi = Math.max(d1!, d2!)
    const mid = rad((lo + hi) / 2)
    const lp = px({ x: v.x + 1.1 * Math.cos(mid), y: v.y + 1.1 * Math.sin(mid) })
    return (
      <g>
        <path d={arcPath(v, 0.7, lo, hi)} fill="none" stroke="#d25b3b" strokeWidth="1.5" />
        {label && <text x={lp.x} y={lp.y + 4} textAnchor="middle" fontFamily={FONT} fontSize="12" fill="#d25b3b">{label}</text>}
      </g>
    )
  }
  const mid = (p: { x: number; y: number }, q: { x: number; y: number }) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 })
  const sideLabel = (p: { x: number; y: number }, q: { x: number; y: number }, text: string, offset = 0.45) => {
    const m = mid(p, q)
    const nx = -(q.y - p.y), ny = q.x - p.x
    const len = Math.hypot(nx, ny) || 1
    const sign = (q.x - p.x) * (C.y - p.y) - (q.y - p.y) * (C.x - p.x) > 0 ? -1 : 1
    const lp = px({ x: m.x + (sign * offset * nx) / len, y: m.y + (sign * offset * ny) / len })
    return <text x={lp.x} y={lp.y + 4} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>{text}</text>
  }
  const vertex = (p: { x: number; y: number }, name: string, dx: number, dy: number) => {
    const q = px(p)
    return (
      <g>
        <circle cx={q.x} cy={q.y} r="3" fill={INK} />
        <text x={q.x + dx} y={q.y + dy} fontFamily={DISPLAY} fontSize="14" fontWeight="700" fill={INK}>{name}</text>
      </g>
    )
  }
  const showArcs = stage >= 2
  const showTri = stage >= 3

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: Math.min(520, W * 1.2) }} role="img" aria-label={alt}>
      {/* base */}
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={INK} strokeWidth="2" />
      {sideLabel(A, B, `${AB} cm`, -0.45)}
      {/* construction marks */}
      {showArcs && kind === 'sss' && (
        <g>
          <path d={arcPath(A, AC, Math.max(5, (Math.atan2(C.y, C.x) * 180) / Math.PI - 22), (Math.atan2(C.y, C.x) * 180) / Math.PI + 22)} fill="none" stroke={ACCENT} strokeWidth="1.5" strokeDasharray="4 3" />
          <path d={arcPath(B, BC, (Math.atan2(C.y, C.x - AB) * 180) / Math.PI - 22, Math.min(175, (Math.atan2(C.y, C.x - AB) * 180) / Math.PI + 22))} fill="none" stroke={ACCENT} strokeWidth="1.5" strokeDasharray="4 3" />
        </g>
      )}
      {showArcs && (kind === 'sas' || kind === 'asa' || kind === 'ssa') && (
        <g>
          <line x1={a.x} y1={a.y} x2={px({ x: 1.25 * C.x, y: 1.25 * C.y }).x} y2={px({ x: 1.25 * C.x, y: 1.25 * C.y }).y} stroke={ACCENT} strokeWidth="1.2" strokeDasharray="4 3" />
          {angleArc(A, B, C, `${angles.A ?? (kind === 'ssa' ? 40 : 50)}°`)}
        </g>
      )}
      {showArcs && kind === 'asa' && (
        <g>
          <line x1={b.x} y1={b.y} x2={px({ x: AB + 1.25 * (C.x - AB), y: 1.25 * C.y }).x} y2={px({ x: AB + 1.25 * (C.x - AB), y: 1.25 * C.y }).y} stroke={ACCENT} strokeWidth="1.2" strokeDasharray="4 3" />
          {angleArc(B, C, A, `${angles.B ?? 60}°`)}
        </g>
      )}
      {showArcs && kind === 'sas' && (
        <path d={arcPath(A, AC, (Math.atan2(C.y, C.x) * 180) / Math.PI - 15, (Math.atan2(C.y, C.x) * 180) / Math.PI + 15)} fill="none" stroke={ACCENT} strokeWidth="1.5" strokeDasharray="4 3" />
      )}
      {showArcs && kind === 'ssa' && (
        <path d={arcPath(B, BC, 20, 160)} fill="none" stroke={ACCENT} strokeWidth="1.5" strokeDasharray="4 3" />
      )}
      {/* triangle */}
      {showTri && (
        <g>
          <line x1={a.x} y1={a.y} x2={c.x} y2={c.y} stroke={INK} strokeWidth="2" />
          <line x1={b.x} y1={b.y} x2={c.x} y2={c.y} stroke={INK} strokeWidth="2" />
          {(kind === 'sss' || kind === 'sas') && sideLabel(A, C, `${AC} cm`)}
          {(kind === 'sss' || kind === 'ssa') && sideLabel(B, C, `${BC} cm`)}
          {vertex(C, names.C ?? 'C', 6, -6)}
        </g>
      )}
      {showTri && C2 && (
        <g opacity="0.6">
          <line x1={b.x} y1={b.y} x2={px(C2).x} y2={px(C2).y} stroke="#d25b3b" strokeWidth="2" strokeDasharray="5 4" />
          <circle cx={px(C2).x} cy={px(C2).y} r="3" fill="#d25b3b" />
          <text x={px(C2).x + 6} y={px(C2).y - 6} fontFamily={DISPLAY} fontSize="14" fontWeight="700" fill="#d25b3b">C′</text>
        </g>
      )}
      {vertex(A, names.A ?? 'A', -14, 16)}
      {vertex(B, names.B ?? 'B', 6, 16)}
      <line x1="0" y1={H - 0.5} x2={W} y2={H - 0.5} stroke={RULE} />
    </svg>
  )
}
