import { DISPLAY, FONT, INK, INK_2 } from './index.tsx'
import { around, baseline, hits, labelHalf, placeLabel, type Seg } from './labelPlace.ts'

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

  /*
   * 284 wide: the drawing stops shrinking at its natural width, and at 380 it scrolled
   * 48px on a phone. The box itself only ever reached x = 266; the rest was margin.
   */
  const W = 284
  const H = 320
  // Oblique projection: the depth axis goes up and right at a fixed angle.
  const scale = Math.min(150 / Math.max(w, 1), 190 / Math.max(h, 1))
  const dx = 46
  const dy = -30
  const ox = 58
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
  const C2y = C.y - bh // the topmost point anything is drawn at
  const D2 = { x: D.x, y: D.y - bh }

  /**
   * The drawing is anchored to the bottom of a fixed-height box, so a flat cuboid left
   * most of the picture empty: a 1.2 by 0.6 by 0.4 box filled the lower third and put
   * 170px of white space above itself. Nothing is drawn above the back top corner, so
   * the view starts just above that instead of at zero, and the SVG's own aspect ratio
   * shrinks the rendered height with it.
   */
  const viewTop = Math.max(0, C2y - 26)

  /*
   * Every label is painted on a white halo. A cuboid's labels have nowhere clear to go:
   * the base diagonal's value sits among the hidden edges at the back of the base, and on
   * a narrow or a flat box the space diagonal's value lands on an edge whichever side it
   * is put. The walk found a line through "5", "13", "14.76" and θ on four boxes; the halo
   * breaks the line under the text instead, the way a printed diagram does.
   */
  const halo = { stroke: '#ffffff', strokeWidth: 3.5, paintOrder: 'stroke' } as const

  /*
   * The diagonals' values go beside their lines where the box leaves room: below the base
   * diagonal, towards the front edge, and above-left of the space diagonal. On a narrow or
   * flat box nothing near the line is clear, and the value sits on the line, on its halo.
   */
  const segs: Seg[] = [[A, B], [B, C], [C, D], [D, A], [A2, B2], [B2, C2], [C2, D2], [D2, A2], [A, A2], [B, B2], [C, C2], [D, D2], [A, C], [A, C2]]
  const claim = (c: { x: number; y: number }, halfW: number, halfH: number) => {
    const l = c.x - halfW, r = c.x + halfW, t = c.y - halfH, b = c.y + halfH
    segs.push([{ x: l, y: t }, { x: r, y: t }], [{ x: r, y: t }, { x: r, y: b }], [{ x: r, y: b }, { x: l, y: b }], [{ x: l, y: b }, { x: l, y: t }])
  }
  const beside = (p: { x: number; y: number }, q: { x: number; y: number }, t: number, text: string, size: number, down: boolean) => {
    const { halfW, halfH } = labelHalf(text, size, true)
    const at = { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }
    let n = Math.atan2(q.x - p.x, -(q.y - p.y))
    if ((Math.sin(n) > 0) !== down) n += Math.PI
    // Near its own line or not at all: a value pushed far off to find space (below the
    // front corner, beside "3 cm") no longer says which line it measures.
    const found = placeLabel(at, halfW, halfH, segs, around(n, 15, 60), 3, 12)
    const c = hits(found, halfW, halfH, segs) ? at : found
    claim(c, halfW, halfH)
    return { x: c.x, y: baseline(c.y, size) }
  }
  // The three dimensions keep their places; claimed first, so a diagonal's value is never
  // set beside one of them ("5" next to "3 cm" read as 5 3 cm on a narrow box).
  const wText = `${w} ${unit}`, dText = `${d} ${unit}`, hText = `${h} ${unit}`
  const wAt = { x: (A.x + B.x) / 2, y: A.y + 20 }
  const dAt = { x: (B.x + C.x) / 2 + 14, y: (B.y + C.y) / 2 + 16 }
  const hAt = { x: A.x - 12, y: (A.y + A2.y) / 2 }
  for (const [at, text, end] of [[wAt, wText, false], [dAt, dText, false], [hAt, hText, true]] as const) {
    const { halfW, halfH } = labelHalf(text, 13)
    claim({ x: end ? at.x - halfW : at.x, y: at.y - 13 * 0.35 }, halfW + 4, halfH + 2)
  }
  const spaceAt = show === 'space' || show === 'both' ? beside(A, C2, 0.5, round(spaceDiag), 13, false) : undefined
  const baseAt = show === 'base' || show === 'both' ? beside(A, C, 0.6, round(baseDiag), 12, true) : undefined

  const edge = (p: { x: number; y: number }, q: { x: number; y: number }, hidden = false) => (
    <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={INK} strokeWidth="2" strokeDasharray={hidden ? '5 4' : undefined} opacity={hidden ? 0.5 : 1} />
  )

  return (
    <svg viewBox={`0 ${viewTop} ${W} ${H - viewTop}`} width="100%" style={{ maxWidth: W * 1.3 }} role="img" aria-label={alt}>
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
            {/* Inside the arc, between the two diagonals: outside it, θ landed on the hidden
                vertical edge at the back-left corner. */}
            <text x={A.x + (r - 13) * Math.cos(mid)} y={A.y + (r - 13) * Math.sin(mid) + 5} textAnchor="middle" fontFamily={DISPLAY} fontSize="14" fill={INK} {...halo}>θ</text>
          </g>
        )
      })()}

      <text x={wAt.x} y={wAt.y} textAnchor="middle" fontFamily={FONT} fontSize="13" fill={INK} {...halo}>{wText}</text>
      <text x={dAt.x} y={dAt.y} textAnchor="middle" fontFamily={FONT} fontSize="13" fill={INK} {...halo}>{dText}</text>
      <text x={hAt.x} y={hAt.y} textAnchor="end" fontFamily={FONT} fontSize="13" fill={INK} {...halo}>{hText}</text>

      {baseAt && (
        <text x={baseAt.x} y={baseAt.y} textAnchor="middle" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill="var(--subject)" {...halo}>{round(baseDiag)}</text>
      )}
      {spaceAt && (
        <text x={spaceAt.x} y={spaceAt.y} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill="var(--subject)" {...halo}>{round(spaceDiag)}</text>
      )}
    </svg>
  )
}
