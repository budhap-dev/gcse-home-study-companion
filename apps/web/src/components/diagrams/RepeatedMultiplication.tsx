import { ACCENT, DISPLAY, FONT, INK, INK_2 } from './index.tsx'

/** base^index as a row of boxes with the product underneath. */
export function RepeatedMultiplication({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const base = Number(props.base ?? 2)
  const index = Math.max(1, Math.min(8, Number(props.index ?? 5)))
  const value = Math.pow(base, index)
  const boxW = 44
  const gap = 26
  const width = index * boxW + (index - 1) * gap + 40
  return (
    <svg viewBox={`0 0 ${width} 150`} width="100%" style={{ maxWidth: width * 1.4 }} role="img" aria-label={alt}>
      <text x={width / 2} y="26" textAnchor="middle" fontFamily={DISPLAY} fontSize="20" fontWeight="700" fill={INK}>
        {base}<tspan baselineShift="super" fontSize="13">{index}</tspan>
      </text>
      {Array.from({ length: index }, (_, i) => {
        const x = 20 + i * (boxW + gap)
        return (
          <g key={i}>
            <rect x={x} y="48" width={boxW} height={boxW} rx="8" fill="var(--subject-soft)" stroke={ACCENT} strokeWidth="2" />
            <text x={x + boxW / 2} y="77" textAnchor="middle" fontFamily={DISPLAY} fontSize="20" fontWeight="700" fill={INK}>{base}</text>
            {i < index - 1 && <text x={x + boxW + gap / 2} y="76" textAnchor="middle" fontFamily={FONT} fontSize="18" fill={INK_2}>×</text>}
          </g>
        )
      })}
      <text x={width / 2} y="128" textAnchor="middle" fontFamily={FONT} fontSize="15" fill={INK_2}>{index} lots of {base} multiplied together = <tspan fontWeight="700" fill={INK}>{value.toLocaleString('en-GB')}</tspan></text>
    </svg>
  )
}
