import { ACCENT, DISPLAY, FONT, INK, INK_2 } from './index.tsx'

/** (base^inner)^outer as `outer` boxes each holding base^inner, giving base^(inner×outer). */
export function PowerOfPower({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const base = String(props.base ?? 'x')
  const inner = Number(props.inner ?? 3)
  const outer = Math.max(1, Math.min(6, Number(props.outer ?? 4)))
  const boxW = 60
  const gap = 24
  const width = outer * boxW + (outer - 1) * gap + 40
  return (
    <svg viewBox={`0 0 ${width} 150`} width="100%" style={{ maxWidth: width * 1.3 }} role="img" aria-label={alt}>
      <text x={width / 2} y="26" textAnchor="middle" fontFamily={DISPLAY} fontSize="20" fontWeight="700" fill={INK}>
        ({base}<tspan baselineShift="super" fontSize="13">{inner}</tspan>)<tspan baselineShift="super" fontSize="13">{outer}</tspan>
      </text>
      {Array.from({ length: outer }, (_, i) => {
        const x = 20 + i * (boxW + gap)
        return (
          <g key={i}>
            <rect x={x} y="48" width={boxW} height="44" rx="8" fill="var(--subject-soft)" stroke={ACCENT} strokeWidth="2" />
            <text x={x + boxW / 2} y="77" textAnchor="middle" fontFamily={DISPLAY} fontSize="19" fontWeight="700" fill={INK}>
              {base}<tspan baselineShift="super" fontSize="12">{inner}</tspan>
            </text>
            {i < outer - 1 && <text x={x + boxW + gap / 2} y="76" textAnchor="middle" fontFamily={FONT} fontSize="18" fill={INK_2}>×</text>}
          </g>
        )
      })}
      <text x={width / 2} y="128" textAnchor="middle" fontFamily={FONT} fontSize="15" fill={INK_2}>
        {outer} lots of {inner} = <tspan fontWeight="700" fill={INK}>{base}<tspan baselineShift="super" fontSize="11">{inner * outer}</tspan></tspan>
      </text>
    </svg>
  )
}
