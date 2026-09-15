import { ACCENT, DISPLAY, FONT, INK, INK_2 } from './index.tsx'

interface Charge {
  /** +1 or -1; the sign decides which way every arrow in the picture points. */
  sign: 1 | -1
  label?: string
}

/**
 * The electric field around a charged sphere, which AQA 4.2.5.2 asks students to draw,
 * and the force between two charges.
 *
 * Nothing about direction is given by the content: field lines point away from a
 * positive charge and towards a negative one, and the force arrows on a pair point
 * together or apart according to whether the signs match. So the picture cannot show
 * like charges attracting, which is the thing the lesson beside it is claiming.
 *
 * Props: charges [{sign, label}] (one for a field pattern, two for a force pair),
 * lines (how many field lines, default 12), note.
 */
export function ElectricField({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const charges = (props.charges as Charge[] | undefined) ?? [{ sign: 1 }]
  const count = typeof props.lines === 'number' ? props.lines : 12
  const note = typeof props.note === 'string' ? props.note : undefined
  const W = 400, H = 300
  const midY = H / 2 - (note ? 6 : 0)
  const R = 24

  const head = (x: number, y: number, angle: number, colour: string, key: string) => {
    const back = 9, wing = 5
    const bx = x - back * Math.cos(angle), by = y - back * Math.sin(angle)
    return (
      <polygon
        key={key}
        points={`${x},${y} ${bx - wing * Math.sin(angle)},${by + wing * Math.cos(angle)} ${bx + wing * Math.sin(angle)},${by - wing * Math.cos(angle)}`}
        fill={colour}
      />
    )
  }

  const sphere = (cx: number, sign: 1 | -1, label: string | undefined, key: string) => (
    <g key={key}>
      <circle cx={cx} cy={midY} r={R} fill={sign > 0 ? '#f6e2dc' : '#dce6f3'} stroke={INK} strokeWidth={1.6} />
      <text x={cx} y={midY + 7} textAnchor="middle" fill={INK} style={{ font: DISPLAY, fontSize: 22, fontWeight: 700 }}>
        {sign > 0 ? '+' : '−'}
      </text>
      {label && (
        <text x={cx} y={midY + R + 22} textAnchor="middle" fill={INK_2} style={{ font: FONT }}>
          {label}
        </text>
      )}
    </g>
  )

  if (charges.length === 1) {
    const c = charges[0]!
    const cx = W / 2
    const reach = 110
    const lines = Array.from({ length: count }, (_, i) => {
      const a = (i / count) * 2 * Math.PI
      const x1 = cx + R * Math.cos(a), y1 = midY + R * Math.sin(a)
      const x2 = cx + reach * Math.cos(a), y2 = midY + reach * Math.sin(a)
      // Outward from a positive charge, inward to a negative one: the arrow is at the
      // far end pointing out, or at the near end pointing in.
      const [hx, hy, angle] =
        c.sign > 0
          ? [cx + reach * 0.72 * Math.cos(a), midY + reach * 0.72 * Math.sin(a), a]
          : [cx + R * 1.35 * Math.cos(a), midY + R * 1.35 * Math.sin(a), a + Math.PI]
      return (
        <g key={i}>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={ACCENT} strokeWidth={1.4} />
          {head(hx, hy, angle, ACCENT, `h${i}`)}
        </g>
      )
    })
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: `${W}px` }} role="img" aria-label={alt}>
        {lines}
        {sphere(cx, c.sign, c.label, 'c')}
        <text x={W / 2} y={16} textAnchor="middle" fill={INK_2} style={{ font: FONT }}>
          {c.sign > 0 ? 'Field lines point away from a positive charge' : 'Field lines point towards a negative charge'}
        </text>
        <text x={W / 2} y={H - 8} textAnchor="middle" fill={INK_2} style={{ font: FONT }}>
          {note ?? 'The lines are closest together near the sphere, where the field is strongest'}
        </text>
      </svg>
    )
  }

  // Two charges: the force arrows follow from whether the signs match.
  const [a, b] = charges as [Charge, Charge]
  const repel = a.sign === b.sign
  const leftX = W / 2 - 90, rightX = W / 2 + 90
  const arrow = (from: number, towards: number, key: string) => {
    const dir = Math.sign(towards - from)
    const start = from + dir * (R + 8)
    const end = start + dir * 46
    return (
      <g key={key}>
        <line x1={start} y1={midY} x2={end} y2={midY} stroke="#d25b3b" strokeWidth={2.4} />
        {head(end, midY, dir > 0 ? 0 : Math.PI, '#d25b3b', `${key}h`)}
      </g>
    )
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: `${W}px` }} role="img" aria-label={alt}>
      <text x={W / 2} y={16} textAnchor="middle" fill={INK_2} style={{ font: FONT }}>
        {repel ? 'The same charge: they repel' : 'Different charges: they attract'}
      </text>
      {sphere(leftX, a.sign, a.label, 'a')}
      {sphere(rightX, b.sign, b.label, 'b')}
      {arrow(leftX, repel ? leftX - 100 : rightX, 'la')}
      {arrow(rightX, repel ? rightX + 100 : leftX, 'ra')}
      <text x={W / 2} y={H - 8} textAnchor="middle" fill={INK_2} style={{ font: FONT }}>
        {note ?? 'A non-contact force: the closer they are, the stronger it is'}
      </text>
    </svg>
  )
}
