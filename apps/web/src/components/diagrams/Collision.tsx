import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

interface Body {
  /** Mass in kg, shown on the block and used for its width. */
  mass: number
  /** Velocity in m/s; positive is to the right, zero draws no arrow. */
  velocity: number
  label?: string
}

/**
 * Two moving bodies drawn before and after a collision or explosion, on a shared
 * track so the eye compares the two rows. Arrow length follows the velocity and
 * arrow direction its sign, which is what makes momentum's direction visible.
 * Props: { before: Body[], after: Body[], unit }. A single body in `after` means the
 * two stuck together.
 */
export function Collision({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const before = (props.before as Body[] | undefined) ?? [{ mass: 2, velocity: 3, label: 'A' }, { mass: 1, velocity: 0, label: 'B' }]
  const after = (props.after as Body[] | undefined) ?? [{ mass: 3, velocity: 2, label: 'A + B' }]
  const unit = String(props.unit ?? 'm/s')
  const W = 480
  const rowH = 130
  const H = rowH * 2 + 10
  const trackY = (row: number) => 30 + row * rowH + 74
  const maxV = Math.max(...[...before, ...after].map((b) => Math.abs(b.velocity)), 1)
  const maxM = Math.max(...[...before, ...after].map((b) => b.mass), 1)
  // Wide enough for its own label ("0.05 kg" needs more than "2 kg"), then wider with mass.
  const blockW = (m: number) => Math.max(30 + `${m} kg`.length * 9, 44 + (m / maxM) * 40)
  // Square-root scale: a 10 m/s recoil beside a 400 m/s bullet is still a visible arrow,
  // and a faster body still gets the longer one.
  const arrowLen = (v: number) => 18 + Math.sqrt(Math.abs(v) / maxV) * 72

  const row = (bodies: Body[], r: number, title: string) => {
    const y = trackY(r)
    // Lay the bodies out left to right with an even gap, centred on the track.
    const widths = bodies.map((b) => blockW(b.mass))
    const gap = 70
    const total = widths.reduce((a, b) => a + b, 0) + gap * (bodies.length - 1)
    let cursor = (W - total) / 2
    return (
      <g key={title}>
        <text x="16" y={30 + r * rowH + 4} fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={ACCENT}>{title}</text>
        <line x1="16" y1={y} x2={W - 16} y2={y} stroke={RULE} strokeWidth="2" />
        {bodies.map((b, i) => {
          const w = widths[i]!
          const x = cursor
          cursor += w + gap
          const h = 40
          const v = b.velocity
          const len = arrowLen(v)
          // The arrow sits above its own block, centred on it, so two bodies heading
          // for each other never write their labels into the same gap.
          const cx = x + w / 2
          const ay = y - h - 16
          const ax = cx - (v >= 0 ? len / 2 : -len / 2)
          const ex = cx + (v >= 0 ? len / 2 : -len / 2)
          return (
            <g key={i}>
              <rect x={x} y={y - h} width={w} height={h} rx="6" fill="var(--subject-soft)" stroke={INK} strokeWidth="2" />
              <text x={cx} y={y - h / 2 + 5} textAnchor="middle" fontFamily={DISPLAY} fontSize="14" fontWeight="700" fill={INK}>{b.mass} kg</text>
              {b.label && <text x={cx} y={y + 18} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>{b.label}</text>}
              {v !== 0 ? (
                <g>
                  <line x1={ax} y1={ay} x2={ex} y2={ay} stroke={ACCENT} strokeWidth="3" strokeLinecap="round" />
                  <polygon points={v >= 0 ? `${ex + 8},${ay} ${ex - 2},${ay - 6} ${ex - 2},${ay + 6}` : `${ex - 8},${ay} ${ex + 2},${ay - 6} ${ex + 2},${ay + 6}`} fill={ACCENT} />
                  <text x={cx} y={ay - 10} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={ACCENT}>{Math.abs(v)} {unit}</text>
                </g>
              ) : (
                <text x={cx} y={ay - 2} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>at rest</text>
              )}
            </g>
          )
        })}
      </g>
    )
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 540 }} role="img" aria-label={alt}>
      {row(before, 0, 'Before')}
      {row(after, 1, 'After')}
    </svg>
  )
}
