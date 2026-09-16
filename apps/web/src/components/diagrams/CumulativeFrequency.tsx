import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

interface Point {
  /** The upper bound of the class, which is where its cumulative frequency is plotted. */
  x: number
  y: number
}
interface Reading {
  /** The cumulative frequency to read across from: n/2 for the median, n/4 and 3n/4 for the quartiles. */
  y: number
  label: string
}

/**
 * A cumulative frequency graph: the running total plotted at each upper class bound,
 * joined point to point. Readings are drawn the way a student takes them with a
 * ruler: across from a cumulative frequency to the line, then down to the axis. The
 * value read off is worked out here by interpolating the same segments the picture
 * draws, so the number printed can never disagree with the line it was read from.
 *
 * Props: { points: Point[], readings?: Reading[], xLabel?, yLabel?, title? }
 */
export function CumulativeFrequency({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const points = ((props.points as Point[] | undefined) ?? []).slice().sort((a, b) => a.x - b.x)
  if (points.length < 2) return <p>{alt}</p>
  const readings = (props.readings as Reading[] | undefined) ?? []
  const xLabel = String(props.xLabel ?? '')
  const yLabel = String(props.yLabel ?? 'cumulative frequency')
  const title = props.title as string | undefined

  const xMin = points[0]!.x
  const xMax = points[points.length - 1]!.x
  const yTop = Math.max(...points.map((p) => p.y), 1)
  const rawStep = yTop / 5
  const mag = 10 ** Math.floor(Math.log10(rawStep))
  const yStep = [1, 2, 5, 10].map((k) => k * mag).find((s) => s >= rawStep) ?? 10 * mag
  const yMax = Math.ceil(yTop / yStep) * yStep
  const yTicks: number[] = []
  for (let v = 0; v <= yMax + yStep / 1000; v = Number((v + yStep).toFixed(6))) yTicks.push(v)

  const W = 460, H = 320
  const left = 58, right = 18, top = title ? 34 : 18, bottom = 48
  // Both scales clamp, so a reading beyond the data draws at the edge of the axes.
  const sx = (x: number) => left + ((Math.min(Math.max(x, xMin), xMax) - xMin) / (xMax - xMin)) * (W - left - right)
  const sy = (y: number) => H - bottom - (Math.min(Math.max(y, 0), yMax) / yMax) * (H - top - bottom)
  const fmt = (v: number) => String(Number(v.toFixed(2)))

  /** The x at which the plotted line reaches a cumulative frequency, by linear interpolation. */
  const readX = (y: number): number | undefined => {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!, b = points[i]!
      if (y >= Math.min(a.y, b.y) && y <= Math.max(a.y, b.y) && b.y !== a.y) {
        return a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x)
      }
    }
    return undefined
  }

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 500 }} role="img" aria-label={alt}>
      {title && (
        <text x={W / 2} y={20} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>
          {title}
        </text>
      )}
      {yTicks.map((v, i) => (
        <g key={`y${i}`}>
          <line x1={left} y1={sy(v)} x2={W - right} y2={sy(v)} stroke={RULE} />
          <text x={left - 8} y={sy(v) + 4} textAnchor="end" fontFamily={FONT} fontSize="11" fill={INK_2}>
            {fmt(v)}
          </text>
        </g>
      ))}
      {readings.map((r, i) => {
        const x = readX(r.y)
        if (x === undefined) return null
        return (
          <g key={`r${i}`}>
            <line x1={left} y1={sy(r.y)} x2={sx(x)} y2={sy(r.y)} stroke={INK_2} strokeWidth="1.5" strokeDasharray="5 4" />
            <line x1={sx(x)} y1={sy(r.y)} x2={sx(x)} y2={H - bottom} stroke={INK_2} strokeWidth="1.5" strokeDasharray="5 4" />
            <text x={sx(x) + 5} y={H - bottom - 6} fontFamily={DISPLAY} fontSize="11" fontWeight="700" fill={INK}>
              {r.label} ≈ {fmt(x)}
            </text>
          </g>
        )
      })}
      <path d={path} fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={`p${i}`} cx={sx(p.x)} cy={sy(p.y)} r="3.5" fill={ACCENT} />
      ))}
      <line x1={left} y1={H - bottom} x2={W - right} y2={H - bottom} stroke={INK} strokeWidth="2" />
      <line x1={left} y1={top} x2={left} y2={H - bottom} stroke={INK} strokeWidth="2" />
      {points.map((p, i) => (
        <g key={`x${i}`}>
          <line x1={sx(p.x)} y1={H - bottom} x2={sx(p.x)} y2={H - bottom + 5} stroke={INK} />
          <text x={sx(p.x)} y={H - bottom + 18} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>
            {fmt(p.x)}
          </text>
        </g>
      ))}
      {xLabel && (
        <text x={(left + W - right) / 2} y={H - 8} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>
          {xLabel}
        </text>
      )}
      <text
        x={14} y={(top + H - bottom) / 2} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}
        transform={`rotate(-90 14 ${(top + H - bottom) / 2})`}
      >
        {yLabel}
      </text>
    </svg>
  )
}
