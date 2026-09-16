import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

interface Curve {
  /** saturating: y = max·x/(k + x). optimum: rises to a peak then falls steeply. linear: y = m·x. inverse-square: y = k/x². */
  kind: 'saturating' | 'optimum' | 'linear' | 'inverse-square'
  label?: string
  /** Where along x to put the label, just above the curve. Omit to label the right-hand end. */
  labelX?: number
  colour?: string
  max?: number
  k?: number
  m?: number
  peak?: number
  dashed?: boolean
}
interface Marker { x: number; label: string }

/**
 * Qualitative curves for rate graphs: limiting factors, temperature optima, inverse square.
 * Props: xLabel, yLabel, xMax (default 10), curves Curve[], markers [{x, label}] drawn as dashed verticals,
 * numbers true to show axis numbers (off by default, because these graphs are about shape).
 */
export function CurveGraph({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const xMax = Number(props.xMax ?? 10)
  const curves = (props.curves as Curve[] | undefined) ?? [{ kind: 'saturating' }]
  const markers = (props.markers as Marker[] | undefined) ?? []
  const numbers = props.numbers === true
  const W = 360, H = 240, pad = 36
  const f = (c: Curve, x: number) => {
    switch (c.kind) {
      case 'saturating': return (c.max ?? 1) * x / ((c.k ?? xMax / 4) + x)
      case 'optimum': { const p = c.peak ?? xMax * 0.6; const m = c.max ?? 1; return x <= p ? m * Math.exp(-(((x - p) / (0.45 * p)) ** 2)) : m * Math.exp(-(((x - p) / (0.15 * xMax)) ** 2)) }
      case 'linear': return (c.m ?? 1) * x
      case 'inverse-square': return (c.k ?? 1) / Math.max(x, xMax / 20) ** 2
    }
  }
  const samples = curves.map((c) => Array.from({ length: 81 }, (_, i) => f(c, (i / 80) * xMax)))
  const yMax = Math.max(...samples.flat().filter(Number.isFinite), 1e-9) * 1.1
  const sx = (x: number) => pad + (x / xMax) * (W - 2 * pad)
  /**
   * Clamped at both ends, not just the top. These curves are all meant to be positive,
   * but a curve that is not — `linear` with a negative gradient, say — collapsed the
   * scale and produced coordinates in the tens of millions, which pushed the rest of the
   * page off screen and left the lesson's buttons unclickable. A diagram should degrade
   * to a wrong-looking line, never break the page around it.
   */
  const sy = (y: number) => H - pad - (Math.max(0, Math.min(y, yMax)) / yMax) * (H - 2 * pad)
  const palette = [ACCENT, '#d25b3b', '#1f3a93', '#2e8b57']
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 440 }} role="img" aria-label={alt}>
      {[0.25, 0.5, 0.75, 1].map((k) => <line key={k} x1={pad} y1={sy(k * yMax)} x2={W - pad} y2={sy(k * yMax)} stroke={RULE} />)}
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke={INK} strokeWidth="1.5" />
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke={INK} strokeWidth="1.5" />
      {numbers && [0, 0.25, 0.5, 0.75, 1].map((k) => <text key={`n${k}`} x={sx(k * xMax)} y={H - pad + 14} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>{Number((k * xMax).toFixed(2))}</text>)}
      {markers.map((m, i) => (
        <g key={`m${i}`}>
          <line x1={sx(m.x)} y1={pad} x2={sx(m.x)} y2={H - pad} stroke={INK_2} strokeDasharray="4 4" />
          <text x={sx(m.x) + 4} y={pad + 12} fontFamily={FONT} fontSize="11" fill={INK_2}>{m.label}</text>
        </g>
      ))}
      {curves.map((c, i) => {
        const colour = c.colour ?? palette[i % palette.length]!
        const d = samples[i]!.map((y, j) => `${j ? 'L' : 'M'}${sx((j / 80) * xMax).toFixed(1)} ${sy(y).toFixed(1)}`).join(' ')
        const yEnd = samples[i]![80]!
        // Curves that all end near zero would print their labels on top of each other, so a curve can name its own spot.
        const at = typeof c.labelX === 'number' ? { x: sx(c.labelX), y: sy(f(c, c.labelX)) - 8, anchor: 'middle' as const } : { x: W - pad - 4, y: sy(yEnd) - 6, anchor: 'end' as const }
        return (
          <g key={i}>
            <path d={d} fill="none" stroke={colour} strokeWidth="2.5" strokeDasharray={c.dashed ? '6 5' : undefined} strokeLinecap="round" />
            {c.label && <text x={at.x} y={at.y} textAnchor={at.anchor} fontFamily={DISPLAY} fontSize="11" fontWeight="700" fill={colour}>{c.label}</text>}
          </g>
        )
      })}
      <text x={W / 2} y={H - 4} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK}>{String(props.xLabel ?? 'x')}</text>
      <text x={pad} y={pad - 10} fontFamily={FONT} fontSize="11" fill={INK}>{String(props.yLabel ?? 'y')}</text>
    </svg>
  )
}
