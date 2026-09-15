import { DISPLAY, FONT, INK, INK_2 } from './index.tsx'

/**
 * A cuboid drawn in oblique projection, with the diagonals a 3D Pythagoras or
 * trigonometry question needs. The face diagonal and the space diagonal are computed
 * from the dimensions, so a diagram cannot label a diagonal with a length the sides do
 * not give. Props:
 *   w, d, h: width, depth and height, used for the labels and for the computed lengths
 *   show: 'none' | 'base' | 'space' | 'both' — which diagonals to draw
 *   angle: true to mark the angle between the space diagonal and the base
 *   unit: the unit for the labels, default cm
 */
export function Cuboid({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const w = Number(props.w ?? 4)
  const d = Number(props.d ?? 3)
  const h = Number(props.h ?? 12)
  const show = String(props.show ?? 'both') as 'none' | 'base' | 'space' | 'both'
  const markAngle = props.angle === true
  const unit = String(props.unit ?? 'cm')

  const baseDiag = Math.sqrt(w * w + d * d)
  const spaceDiag = Math.sqrt(w * w + d * d + h * h)
  const round = (v: number) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(2))

  const W = 380
  const H = 320
  // Oblique projection: the depth axis goes up and right at a fixed angle.
  const scale = Math.min(150 / Math.max(w, 1), 190 / Math.max(h, 1))
  const dx = 46
  const dy = -30
  const ox = 70
  const oy = 250
  const bw = w * scale
  const bh = h * scale

  const A = { x: ox, y: oy }                       // front bottom left
  const B = { x: ox + bw, y: oy }                  // front bottom right
  const C = { x: ox + bw + dx, y: oy + dy }        // back bottom right
  const D = { x: ox + dx, y: oy + dy }             // back bottom left
  const A2 = { x: A.x, y: A.y - bh }
  const B2 = { x: B.x, y: B.y - bh }
  const C2 = { x: C.x, y: C.y - bh }
  const D2 = { x: D.x, y: D.y - bh }

  const edge = (p: { x: number; y: number }, q: { x: number; y: number }, hidden = false) => (
    <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={INK} strokeWidth="2" strokeDasharray={hidden ? '5 4' : undefined} opacity={hidden ? 0.5 : 1} />
  )

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W * 1.3 }} role="img" aria-label={alt}>
      {/* hidden edges first, so the visible ones draw over them */}
      {edge(D, C, true)}
      {edge(D, A, true)}
      {edge(D, D2, true)}

      {edge(A, B)}{edge(B, C)}{edge(C, C2)}
      {edge(A2, B2)}{edge(B2, C2)}{edge(C2, D2)}{edge(D2, A2)}
      {edge(A, A2)}{edge(B, B2)}

      {(show === 'base' || show === 'both') && (
        <line x1={A.x} y1={A.y} x2={C.x} y2={C.y} stroke="var(--subject)" strokeWidth="2.5" strokeDasharray="6 4" />
      )}
      {(show === 'space' || show === 'both') && (
        <line x1={A.x} y1={A.y} x2={C2.x} y2={C2.y} stroke="var(--subject)" strokeWidth="3" />
      )}

      {markAngle && (() => {
        // The arc runs from the base diagonal round to the space diagonal, at whatever
        // angle those two actually leave the corner, so it marks the angle the lesson
        // is talking about rather than a fixed decorative tick.
        const r = 40
        const aBase = Math.atan2(C.y - A.y, C.x - A.x)
        const aSpace = Math.atan2(C2.y - A.y, C2.x - A.x)
        const p1 = { x: A.x + r * Math.cos(aBase), y: A.y + r * Math.sin(aBase) }
        const p2 = { x: A.x + r * Math.cos(aSpace), y: A.y + r * Math.sin(aSpace) }
        const mid = (aBase + aSpace) / 2
        return (
          <g>
            <path d={`M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} A ${r} ${r} 0 0 0 ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`} fill="none" stroke={INK_2} strokeWidth="1.8" />
            <text x={A.x + (r + 16) * Math.cos(mid)} y={A.y + (r + 16) * Math.sin(mid) + 4} textAnchor="middle" fontFamily={DISPLAY} fontSize="14" fill={INK}>θ</text>
          </g>
        )
      })()}

      <text x={(A.x + B.x) / 2} y={A.y + 20} textAnchor="middle" fontFamily={FONT} fontSize="13" fill={INK}>{w} {unit}</text>
      <text x={(B.x + C.x) / 2 + 14} y={(B.y + C.y) / 2 + 16} textAnchor="middle" fontFamily={FONT} fontSize="13" fill={INK}>{d} {unit}</text>
      <text x={A.x - 12} y={(A.y + A2.y) / 2} textAnchor="end" fontFamily={FONT} fontSize="13" fill={INK}>{h} {unit}</text>

      {(show === 'base' || show === 'both') && (
        <text x={(A.x + C.x) / 2 + 26} y={(A.y + C.y) / 2 + 6} textAnchor="middle" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill="var(--subject)">{round(baseDiag)}</text>
      )}
      {(show === 'space' || show === 'both') && (
        <text x={(A.x + C2.x) / 2 - 18} y={(A.y + C2.y) / 2} textAnchor="end" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill="var(--subject)">{round(spaceDiag)}</text>
      )}
    </svg>
  )
}
