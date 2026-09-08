import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

/** Powers of a base from `from` down to `to`, each rung divided by the base. */
export function IndexLadder({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const base = Number(props.base ?? 2)
  const from = Number(props.from_ ?? props.from ?? 2)
  const to = Number(props.to ?? -2)
  const rows = Array.from({ length: from - to + 1 }, (_, i) => from - i)
  const rowH = 40
  const height = rows.length * rowH + 30
  const fmt = (n: number) => (n >= 0 ? String(Math.pow(base, n)) : `1/${Math.pow(base, -n)}`)
  return (
    <svg viewBox={`0 0 360 ${height}`} width="100%" style={{ maxWidth: 420 }} role="img" aria-label={alt}>
      {rows.map((n, i) => {
        const y = 20 + i * rowH
        return (
          <g key={n}>
            <line x1="20" y1={y + 28} x2="340" y2={y + 28} stroke={RULE} />
            <text x="60" y={y + 20} textAnchor="middle" fontFamily={DISPLAY} fontSize="18" fontWeight="700" fill={INK}>
              {base}<tspan baselineShift="super" fontSize="12">{n}</tspan>
            </text>
            <text x="120" y={y + 20} textAnchor="middle" fontFamily={FONT} fontSize="16" fill={INK_2}>=</text>
            <text x="180" y={y + 20} textAnchor="middle" fontFamily={DISPLAY} fontSize="18" fontWeight="700" fill={n < 0 ? ACCENT : INK}>{fmt(n)}</text>
            {i < rows.length - 1 && (
              <g>
                <path d={`M270 ${y + 8} v${rowH - 8}`} stroke={ACCENT} strokeWidth="2" fill="none" markerEnd="url(#arrow)" />
                <text x="282" y={y + rowH / 2 + 10} fontFamily={FONT} fontSize="14" fill={ACCENT}>÷ {base}</text>
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
