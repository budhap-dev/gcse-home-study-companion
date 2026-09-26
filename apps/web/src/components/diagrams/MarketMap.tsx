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
/**
 * Drawn at 280 units so it fits the 298 CSS px a diagram figure leaves on a 390px phone
 * (`Visual.tsx`). It used to be 460: below its natural width a diagram stops shrinking and
 * scrolls instead, so every market map scrolled sideways on a phone. A competitor's label
 * near an edge is given the anchor (start/end/middle) that keeps its estimated extent
 * inside the box, rather than a fixed pixel band tuned for the old, wider drawing.
 */
export function MarketMap({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const xLow = String(props.xLow ?? 'low price')
  const xHigh = String(props.xHigh ?? 'high price')
  const yLow = String(props.yLow ?? 'low quality')
  const yHigh = String(props.yHigh ?? 'high quality')
  const points = (props.points as Plot[] | undefined) ?? []
  const gap = props.gap as Plot | undefined

  /*
   * The axis-end labels sit outside the plot, where no competitor can be: "full
   * facilities" above it, "basic facilities" below it, and the two price ends in a row
   * under that. Inside the plot at 280 wide they sat where the competitors were, and "The
   * Lodge" was printed on "full facilities". Each competitor's name then takes the first
   * of above, below, right and left of its dot that meets no other name, dot or line end.
   */
  const W = 280
  const padX = 14
  const top = 28
  const H = 250
  const plotBottom = H - 46
  const x = (v: number) => padX + v * (W - 2 * padX)
  const y = (v: number) => plotBottom - v * (plotBottom - top)
  const midX = x(0.5)
  const midY = y(0.5)
  const SIZE = 12
  const CHAR = SIZE * 0.6

  interface Box { l: number; r: number; t: number; b: number }
  const overlaps = (a: Box, b: Box) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b
  const dots: Box[] = points.map((p) => ({ l: x(p.x) - 8, r: x(p.x) + 8, t: y(p.y) - 8, b: y(p.y) + 8 }))
  if (gap) dots.push({ l: x(gap.x) - 15, r: x(gap.x) + 15, t: y(gap.y) - 15, b: y(gap.y) + 15 })
  const placed: Box[] = []
  const place = (px: number, py: number, label: string, clear: number, own: number) => {
    const w = label.length * CHAR
    const options = [
      { tx: px, ty: py - clear - 4, anchor: 'middle' as const },
      { tx: px, ty: py + clear + 12, anchor: 'middle' as const },
      { tx: px + clear + 3, ty: py + 4, anchor: 'start' as const },
      { tx: px - clear - 3, ty: py + 4, anchor: 'end' as const },
      // A long name near an edge: above or below, but growing away from the edge.
      { tx: px, ty: py - clear - 4, anchor: 'end' as const },
      { tx: px, ty: py - clear - 4, anchor: 'start' as const },
      { tx: px, ty: py + clear + 12, anchor: 'end' as const },
      { tx: px, ty: py + clear + 12, anchor: 'start' as const },
    ]
    const boxOf = (o: (typeof options)[number]): Box => {
      const l = o.anchor === 'start' ? o.tx : o.anchor === 'end' ? o.tx - w : o.tx - w / 2
      return { l, r: l + w, t: o.ty - SIZE * 0.8, b: o.ty + SIZE * 0.25 }
    }
    const inside = (b: Box) => b.l >= padX && b.r <= W - padX && b.t >= top && b.b <= plotBottom
    // The first spot inside the plot that meets nothing; failing that, the first inside it.
    const best = options.find((o) => {
      const b = boxOf(o)
      return inside(b) && !placed.some((q) => overlaps(b, q)) && !dots.some((d, k) => k !== own && overlaps(b, d))
    }) ?? options.find((o) => inside(boxOf(o))) ?? options[0]!
    placed.push(boxOf(best))
    return best
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 520 }} role="img" aria-label={alt}>
      <rect x={padX} y={top} width={W - 2 * padX} height={plotBottom - top} fill="var(--subject-soft)" opacity="0.35" rx="8" />
      {[0.25, 0.5, 0.75].map((v) => (
        <g key={v}>
          <line x1={x(v)} y1={top} x2={x(v)} y2={plotBottom} stroke={RULE} />
          <line x1={padX} y1={y(v)} x2={W - padX} y2={y(v)} stroke={RULE} />
        </g>
      ))}

      <line x1={padX} y1={midY} x2={W - padX} y2={midY} stroke={INK} strokeWidth="2" />
      <line x1={midX} y1={top} x2={midX} y2={plotBottom} stroke={INK} strokeWidth="2" />

      <text x={midX} y={top - 8} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>{yHigh}</text>
      <text x={midX} y={plotBottom + 16} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>{yLow}</text>
      <text x={padX} y={plotBottom + 34} textAnchor="start" fontFamily={FONT} fontSize="12" fill={INK_2}>← {xLow}</text>
      <text x={W - padX} y={plotBottom + 34} textAnchor="end" fontFamily={FONT} fontSize="12" fill={INK_2}>{xHigh} →</text>

      {points.map((p, i) => {
        const at = place(x(p.x), y(p.y), p.label, 8, i)
        return (
          <g key={i}>
            <circle cx={x(p.x)} cy={y(p.y)} r="7" fill={ACCENT} />
            <text x={at.tx} y={at.ty} textAnchor={at.anchor} fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={INK} stroke="#fff" strokeWidth="3.5" paintOrder="stroke">
              {p.label}
            </text>
          </g>
        )
      })}

      {gap && (() => {
        const at = place(x(gap.x), y(gap.y), gap.label, 15, points.length)
        return (
          <g>
            <circle cx={x(gap.x)} cy={y(gap.y)} r="14" fill="none" stroke={ACCENT} strokeWidth="2.5" strokeDasharray="5 4" />
            <text x={at.tx} y={at.ty} textAnchor={at.anchor} fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={ACCENT} stroke="#fff" strokeWidth="3.5" paintOrder="stroke">
              {gap.label}
            </text>
          </g>
        )
      })()}
    </svg>
  )
}
