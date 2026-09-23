import { DISPLAY, FONT, INK } from './index.tsx'
import { wrapCell } from './tableLayout.ts'

interface Slice {
  label: string
  /** A frequency, not an angle: the component works out the angle itself. */
  value: number
}

/** Fills that stay distinct from each other and readable with white or ink beside them. */
const FILLS = ['#3b6fb6', '#e0913a', '#4f9d69', '#c4524f', '#8a6bb8', '#c9a227', '#4aa3a8', '#8c8c8c']
const W = 296
const R = 84
const LINE = 14

/**
 * A pie chart drawn from frequencies. Each sector's angle is frequency ÷ total × 360,
 * worked out here rather than passed in, so the picture cannot disagree with the table a
 * question gives beside it: the one calculation the exam asks for is the one the drawing
 * is built from.
 *
 * Labels go in a key under the circle, not round the edge. Round the edge, two thin
 * sectors put their labels on top of each other, and on a phone a label outside the
 * circle runs off the card.
 *
 * Props: { slices: Slice[], showAngles?: boolean (write each angle in the key),
 *          showValues?: boolean (write each frequency in the key), title?: string }
 */
export function PieChart({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const slices = ((props.slices as Slice[] | undefined) ?? []).filter((s) => s.value > 0)
  if (slices.length === 0) return <p>{alt}</p>
  const showAngles = props.showAngles === true
  const showValues = props.showValues === true
  const title = props.title ? wrapCell(String(props.title), 40) : []

  const total = slices.reduce((a, s) => a + s.value, 0)
  const angles = slices.map((s) => (s.value / total) * 360)
  const fmt = (v: number) => String(Number(v.toFixed(1)))

  const top = title.length ? title.length * LINE + 8 : 4
  const cx = W / 2
  const cy = top + R + 4
  // Sectors start at twelve o'clock and run clockwise, the way a pie is read and drawn.
  const at = (deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)] as const
  }
  let start = 0
  const sectors = angles.map((a, i) => {
    const [x1, y1] = at(start)
    const [x2, y2] = at(start + a)
    const d = a >= 359.999
      ? `M ${cx} ${cy - R} A ${R} ${R} 0 1 1 ${cx - 0.01} ${cy - R} Z`
      : `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${a > 180 ? 1 : 0} 1 ${x2} ${y2} Z`
    start += a
    return <path key={i} d={d} fill={FILLS[i % FILLS.length]} stroke="#fff" strokeWidth={1.5} />
  })

  const keyTop = cy + R + 18
  const keyText = (s: Slice, i: number) => {
    const parts = [s.label]
    if (showValues) parts.push(`${fmt(s.value)}`)
    if (showAngles) parts.push(`${fmt(angles[i]!)}°`)
    return parts.join(showValues || showAngles ? ' · ' : '')
  }
  const keyLines = slices.map((s, i) => wrapCell(keyText(s, i), 36).slice(0, 2))
  const keyRows: number[] = []
  keyLines.reduce((y, lines) => { keyRows.push(y); return y + lines.length * LINE + 4 }, keyTop)
  const H = (keyRows[keyRows.length - 1] ?? keyTop) + (keyLines[keyLines.length - 1]?.length ?? 1) * LINE + 4

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 380 }} role="img" aria-label={alt}>
      {title.map((l, i) => (
        <text key={`t${i}`} x={W / 2} y={14 + i * LINE} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>{l}</text>
      ))}
      {sectors}
      {slices.map((_, i) => (
        <g key={`k${i}`}>
          <rect x={40} y={keyRows[i]! - 10} width={12} height={12} rx={2} fill={FILLS[i % FILLS.length]} />
          <text x={60} y={keyRows[i]} fontFamily={FONT} fontSize="12" fill={INK}>
            {keyLines[i]!.map((l, k) => <tspan key={k} x={60} dy={k === 0 ? 0 : LINE}>{l}</tspan>)}
          </text>
        </g>
      ))}
    </svg>
  )
}
