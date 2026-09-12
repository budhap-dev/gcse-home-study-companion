import { ACCENT, DISPLAY, FONT, INK, INK_2 } from './index.tsx'

type Pt = { x: number; y: number }
/** A point on the circumference, given as degrees anticlockwise from the right, or the midpoint of two named points. */
type PointSpec = number | { mid: [string, string] }
interface AngleMark {
  at: string
  from: string
  to: string
  /** Angle text, such as "x" or "2x" or "90°". */
  text?: string
  /** 1 to 3 arcs, or 'r' for a right-angle square. Defaults to 1. */
  kind?: number | 'r'
}
interface External {
  /** Name of the point outside the circle; its two tangent points are registered as name1 and name2. */
  name: string
  angle: number
  /** Distance from the centre as a multiple of the radius, greater than 1. */
  dist: number
}

/**
 * A circle with named points, so every circle theorem can be drawn from content.
 * Props: points {A: 30, B: 150, M: {mid: ['A', 'B']}} (degrees anticlockwise from the
 * right; O is always the centre), centre true to draw O, segments [['A', 'B'], ['O', 'A', 'dashed']],
 * tangentAt ['A'] (registers A1 and A2 at the ends of the tangent), external [{name: 'P',
 * angle: 0, dist: 2}] (registers P1 and P2, the tangent points, and draws the tangents),
 * angles [{at, from, to, text, kind}], ticks [['O', 'A'], ['O', 'B']] for equal lengths,
 * arc ['A', 'B'] to highlight the minor arc, labels false to hide point names.
 */
export function CircleTheorem({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const O: Pt = { x: 160, y: 150 }
  const r = 105
  const specs = (props.points as Record<string, PointSpec> | undefined) ?? {}
  const showCentre = props.centre === true
  const segments = (props.segments as string[][] | undefined) ?? []
  const tangentAt = (props.tangentAt as string[] | undefined) ?? []
  const externals = (props.external as External[] | undefined) ?? []
  const angles = (props.angles as AngleMark[] | undefined) ?? []
  const ticks = (props.ticks as string[][] | undefined) ?? []
  const arc = props.arc as [string, string] | undefined
  const showLabels = props.labels !== false

  const onCircle = (deg: number): Pt => ({ x: O.x + r * Math.cos((deg * Math.PI) / 180), y: O.y - r * Math.sin((deg * Math.PI) / 180) })
  const pts: Record<string, Pt> = { O }
  const hidden = new Set<string>(['O'])
  for (const [name, spec] of Object.entries(specs)) if (typeof spec === 'number') pts[name] = onCircle(spec)
  for (const [name, spec] of Object.entries(specs)) {
    if (typeof spec === 'object') {
      const a = pts[spec.mid[0]], b = pts[spec.mid[1]]
      if (a && b) pts[name] = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    }
  }
  // A tangent at A runs perpendicular to OA; its ends are registered so angles can refer to them.
  const tangentLines: [Pt, Pt][] = []
  for (const name of tangentAt) {
    const a = pts[name]
    if (!a) continue
    const ux = (a.x - O.x) / r, uy = (a.y - O.y) / r
    const tx = -uy, ty = ux
    const L = 90
    const e1 = { x: a.x + tx * L, y: a.y + ty * L }, e2 = { x: a.x - tx * L, y: a.y - ty * L }
    pts[`${name}1`] = e1; pts[`${name}2`] = e2
    hidden.add(`${name}1`); hidden.add(`${name}2`)
    tangentLines.push([e1, e2])
  }
  // Tangents from an external point touch the circle at angle ± arccos(r / OP).
  const externalLines: [Pt, Pt][] = []
  for (const ex of externals) {
    const d = Math.max(ex.dist, 1.05)
    const p: Pt = { x: O.x + r * d * Math.cos((ex.angle * Math.PI) / 180), y: O.y - r * d * Math.sin((ex.angle * Math.PI) / 180) }
    const alpha = (Math.acos(1 / d) * 180) / Math.PI
    pts[ex.name] = p
    pts[`${ex.name}1`] = onCircle(ex.angle + alpha)
    pts[`${ex.name}2`] = onCircle(ex.angle - alpha)
    externalLines.push([p, pts[`${ex.name}1`]!], [p, pts[`${ex.name}2`]!])
  }

  const tickMarks = (p: Pt, q: Pt, n: number, key: string) => {
    const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
    const dx = q.x - p.x, dy = q.y - p.y
    const l = Math.hypot(dx, dy) || 1
    const ux = dx / l, uy = dy / l, nx = -uy, ny = ux
    return Array.from({ length: n }, (_, i) => {
      const off = (i - (n - 1) / 2) * 5
      const c = { x: m.x + ux * off, y: m.y + uy * off }
      return <line key={`${key}${i}`} x1={c.x - nx * 5} y1={c.y - ny * 5} x2={c.x + nx * 5} y2={c.y + ny * 5} stroke={INK} strokeWidth="2" />
    })
  }
  const angleMark = (m: AngleMark, key: string) => {
    const v = pts[m.at], p = pts[m.from], q = pts[m.to]
    if (!v || !p || !q) return null
    const a1 = Math.atan2(p.y - v.y, p.x - v.x)
    const a2 = Math.atan2(q.y - v.y, q.x - v.x)
    let d = a2 - a1
    while (d > Math.PI) d -= 2 * Math.PI
    while (d < -Math.PI) d += 2 * Math.PI
    const sweep = d > 0 ? 1 : 0
    const kind = m.kind ?? 1
    const mid = a1 + d / 2
    const label = m.text ? <text x={v.x + Math.cos(mid) * 30} y={v.y + Math.sin(mid) * 30 + 4} textAnchor="middle" fontFamily={FONT} fontSize="12" fill="#d25b3b">{m.text}</text> : null
    if (kind === 'r') {
      const s = 11
      const u1 = { x: Math.cos(a1) * s, y: Math.sin(a1) * s }, u2 = { x: Math.cos(a2) * s, y: Math.sin(a2) * s }
      return <g key={key}><path d={`M${v.x + u1.x} ${v.y + u1.y} L${v.x + u1.x + u2.x} ${v.y + u1.y + u2.y} L${v.x + u2.x} ${v.y + u2.y}`} fill="none" stroke="#d25b3b" strokeWidth="1.5" />{label}</g>
    }
    return (
      <g key={key}>
        {Array.from({ length: kind }, (_, i) => {
          const rr = 14 + i * 5
          const s = { x: v.x + Math.cos(a1) * rr, y: v.y + Math.sin(a1) * rr }, e = { x: v.x + Math.cos(a2) * rr, y: v.y + Math.sin(a2) * rr }
          return <path key={i} d={`M${s.x} ${s.y} A${rr} ${rr} 0 0 ${sweep} ${e.x} ${e.y}`} fill="none" stroke="#d25b3b" strokeWidth="1.5" />
        })}
        {label}
      </g>
    )
  }
  // The minor arc from a to b, drawn the short way round.
  const arcPath = () => {
    if (!arc) return null
    const a = specs[arc[0]], b = specs[arc[1]]
    if (typeof a !== 'number' || typeof b !== 'number') return null
    const d = ((b - a) % 360 + 360) % 360
    const p = onCircle(a), q = onCircle(b)
    // Always the minor arc. Anticlockwise on screen is SVG sweep 0, because y points down;
    // when the anticlockwise way round is the long way, go clockwise instead.
    return <path d={`M${p.x} ${p.y} A${r} ${r} 0 0 ${d > 180 ? 1 : 0} ${q.x} ${q.y}`} fill="none" stroke={ACCENT} strokeWidth="5" strokeLinecap="round" opacity="0.55" />
  }
  const labelPos = (name: string, p: Pt): Pt => {
    if (name === 'O') return { x: p.x + 9, y: p.y + 15 }
    const dx = p.x - O.x, dy = p.y - O.y
    const l = Math.hypot(dx, dy) || 1
    return { x: p.x + (dx / l) * 15, y: p.y + (dy / l) * 15 + 4 }
  }

  // The box grows to fit whatever is drawn, so an external point or a long tangent is never clipped.
  const shown = Object.entries(pts).filter(([name]) => !hidden.has(name) || name === 'O').map(([, p]) => p)
  const xs = [O.x - r, O.x + r, ...shown.map((p) => p.x)], ys = [O.y - r, O.y + r, ...shown.map((p) => p.y)]
  const pad = 26
  const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad
  const boxW = Math.max(...xs) + pad - minX, boxH = Math.max(...ys) + pad - minY
  return (
    <svg viewBox={`${minX} ${minY} ${boxW} ${boxH}`} width="100%" style={{ maxWidth: Math.max(300, boxW * 1.15) }} role="img" aria-label={alt}>
      <circle cx={O.x} cy={O.y} r={r} fill="var(--subject-soft)" stroke={INK} strokeWidth="2" />
      {arcPath()}
      {tangentLines.map(([a, b], i) => <line key={`t${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={INK} strokeWidth="2" />)}
      {externalLines.map(([a, b], i) => <line key={`e${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={INK} strokeWidth="2" />)}
      {segments.map((s, i) => {
        const a = pts[s[0]!], b = pts[s[1]!]
        if (!a || !b) return null
        return <line key={`s${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={INK} strokeWidth="2" strokeDasharray={s[2] === 'dashed' ? '6 5' : undefined} strokeLinecap="round" />
      })}
      {ticks.map((t, i) => { const a = pts[t[0]!], b = pts[t[1]!]; return a && b ? tickMarks(a, b, Number(t[2] ?? 1), `k${i}`) : null })}
      {angles.map((m, i) => angleMark(m, `a${i}`))}
      {showCentre && <circle cx={O.x} cy={O.y} r="3" fill={INK} />}
      {Object.entries(pts).map(([name, p]) => {
        if (hidden.has(name) && name !== 'O') return null
        const isPoint = name !== 'O'
        const lp = labelPos(name, p)
        return (
          <g key={`p${name}`}>
            {isPoint && <circle cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke={INK} strokeWidth="2" />}
            {showLabels && (name !== 'O' || showCentre) && <text x={lp.x} y={lp.y} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={name === 'O' ? INK_2 : INK}>{name}</text>}
          </g>
        )
      })}
    </svg>
  )
}
