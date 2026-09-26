import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

/**
 * Powers of a base from `from` down to `to`, each rung divided by the base. Drawn at 260
 * units, narrower than its old fixed 360, so it fits the 298 CSS px a diagram figure leaves
 * on a 390px phone (`Visual.tsx`): below its natural width a diagram stops shrinking and
 * scrolls instead.
 */
export function IndexLadder({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const base = Number(props.base ?? 2)
  const from = Number(props.from_ ?? props.from ?? 2)
  const to = Number(props.to ?? -2)
  const rows = Array.from({ length: from - to + 1 }, (_, i) => from - i)
  const rowH = 40
  const height = rows.length * rowH + 30
  const fmt = (n: number) => (n >= 0 ? String(Math.pow(base, n)) : `1/${Math.pow(base, -n)}`)
  const W = 260
  const labelX = 48
  const eqX = 96
  const valueX = 142
  const arrowX = 196
  const divLabelX = 208
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{ maxWidth: 320 }} role="img" aria-label={alt}>
      {rows.map((n, i) => {
        const y = 20 + i * rowH
        return (
          <g key={n}>
            <line x1="16" y1={y + 28} x2={W - 16} y2={y + 28} stroke={RULE} />
            <text x={labelX} y={y + 20} textAnchor="middle" fontFamily={DISPLAY} fontSize="18" fontWeight="700" fill={INK}>
              {base}<tspan baselineShift="super" fontSize="12">{n}</tspan>
            </text>
            <text x={eqX} y={y + 20} textAnchor="middle" fontFamily={FONT} fontSize="16" fill={INK_2}>=</text>
            <text x={valueX} y={y + 20} textAnchor="middle" fontFamily={DISPLAY} fontSize="18" fontWeight="700" fill={n < 0 ? ACCENT : INK}>{fmt(n)}</text>
            {i < rows.length - 1 && (
              <g>
                <path d={`M${arrowX} ${y + 8} v${rowH - 8}`} stroke={ACCENT} strokeWidth="2" fill="none" markerEnd="url(#arrow)" />
                {/* Above the row's rule at y + 28: level with the arrow's middle, the rule ran through it. */}
                <text x={divLabelX} y={y + 22} fontFamily={FONT} fontSize="14" fill={ACCENT}>÷ {base}</text>
              </g>
            )}
          </g>
        )
      })}
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={ACCENT} />
        </marker>
      </defs>
    </svg>
  )
}
