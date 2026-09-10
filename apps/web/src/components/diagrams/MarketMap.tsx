import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

interface Plot {
  /** Position on each axis, 0 at the low end and 1 at the high end. */
  x: number
  y: number
  label: string
}

/**
 * A market map: two axes crossing in the middle, competitors plotted against them, and
 * optionally the gap in the market marked. The point a student has to make in an exam is
 * that an empty region is only an opportunity if customers actually want what would sit
 * there, so the gap is drawn as an open circle rather than a solid one.
 *
 * Props: xLow, xHigh, yLow, yHigh (the four axis-end labels), points: Plot[], gap: Plot.
 */
export function MarketMap({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const xLow = String(props.xLow ?? 'low price')
  const xHigh = String(props.xHigh ?? 'high price')
  const yLow = String(props.yLow ?? 'low quality')
  const yHigh = String(props.yHigh ?? 'high quality')
  const points = (props.points as Plot[] | undefined) ?? []
  const gap = props.gap as Plot | undefined

  const W = 460
  const H = 340
  const pad = 62
  const x = (v: number) => pad + v * (W - 2 * pad)
  const y = (v: number) => H - pad - v * (H - 2 * pad)
  const midX = x(0.5)
  const midY = y(0.5)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 520 }} role="img" aria-label={alt}>
      <rect x={pad} y={pad} width={W - 2 * pad} height={H - 2 * pad} fill="var(--subject-soft)" opacity="0.35" rx="8" />
      {[0.25, 0.5, 0.75].map((v) => (
        <g key={v}>
          <line x1={x(v)} y1={pad} x2={x(v)} y2={H - pad} stroke={RULE} />
          <line x1={pad} y1={y(v)} x2={W - pad} y2={y(v)} stroke={RULE} />
        </g>
      ))}

      <line x1={pad} y1={midY} x2={W - pad} y2={midY} stroke={INK} strokeWidth="2" />
      <line x1={midX} y1={pad} x2={midX} y2={H - pad} stroke={INK} strokeWidth="2" />

      <text x={pad - 6} y={midY - 8} textAnchor="start" fontFamily={FONT} fontSize="12" fill={INK_2}>{xLow}</text>
      <text x={W - pad + 6} y={midY - 8} textAnchor="end" fontFamily={FONT} fontSize="12" fill={INK_2}>{xHigh}</text>
      <text x={midX + 8} y={pad - 6} fontFamily={FONT} fontSize="12" fill={INK_2}>{yHigh}</text>
      <text x={midX + 8} y={H - pad + 16} fontFamily={FONT} fontSize="12" fill={INK_2}>{yLow}</text>

      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(p.x)} cy={y(p.y)} r="7" fill={ACCENT} />
          <text
            x={x(p.x)}
            y={y(p.y) - 12}
            textAnchor={x(p.x) > W - pad - 60 ? 'end' : x(p.x) < pad + 60 ? 'start' : 'middle'}
            fontFamily={DISPLAY}
            fontSize="12"
            fontWeight="700"
            fill={INK}
            stroke="#fff"
            strokeWidth="3.5"
            paintOrder="stroke"
          >
            {p.label}
          </text>
        </g>
      ))}

      {gap && (
        <g>
          <circle cx={x(gap.x)} cy={y(gap.y)} r="14" fill="none" stroke={ACCENT} strokeWidth="2.5" strokeDasharray="5 4" />
          {/* Clear of the circle by more than a descender, and haloed so it stays legible
              where the gap sits on an axis line. */}
          <text
            x={x(gap.x)}
            y={y(gap.y) - 26}
            textAnchor="middle"
            fontFamily={DISPLAY}
            fontSize="12"
            fontWeight="700"
            fill={ACCENT}
            stroke="#fff"
            strokeWidth="3.5"
            paintOrder="stroke"
          >
            {gap.label}
          </text>
        </g>
      )}
    </svg>
  )
}
