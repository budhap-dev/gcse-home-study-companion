import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

interface Plot {
  /** Named on the left, so two plots on one scale can be compared: "Class A". */
  label: string
  min: number
  q1: number
  median: number
  q3: number
  max: number
}

/**
 * One or more box plots on a shared number line, drawn from their five-number
 * summaries. Several plots stack vertically on the same scale, which is how an exam
 * asks a student to compare two distributions: the medians line up for reading, and
 * the box widths (the interquartile ranges) can be judged against each other by eye.
 *
 * Props: { plots: Plot[], xLabel?, xMin?, xMax?, title? }
 */
export function BoxPlot({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const plots = (props.plots as Plot[] | undefined) ?? []
  if (plots.length === 0) return <p>{alt}</p>
  const xLabel = String(props.xLabel ?? '')
  const title = props.title as string | undefined

  // A scale with round-number ticks, padded a little past the data at each end.
  const lo = Math.min(...plots.map((p) => p.min))
  const hi = Math.max(...plots.map((p) => p.max))
  const span = Math.max(hi - lo, 1)
  const raw = span / 6
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((k) => k * mag).find((s) => s >= raw) ?? 10 * mag
  const xMin = typeof props.xMin === 'number' ? props.xMin : Math.floor(lo / step) * step
  const xMax = typeof props.xMax === 'number' ? props.xMax : Math.ceil(hi / step) * step
  const ticks: number[] = []
  for (let v = xMin; v <= xMax + step / 1000; v = Number((v + step).toFixed(6))) ticks.push(v)

  // 284 wide: the drawing stops shrinking at its natural width, and a 460-wide plot
  // scrolled on a phone. The row labels are the widest thing on the left, so the left
  // margin is sized to the longest one rather than a fixed guess: "Through town" needed
  // more than the old fixed 78 gave it, which would have clipped it at the axis edge.
  const W = 284
  const rowH = 58
  const maxLabelLen = Math.max(...plots.map((p) => p.label.length))
  const left = Math.max(60, 22 + maxLabelLen * 7.2), right = 14, top = title ? 34 : 16, bottom = 46
  const H = top + plots.length * rowH + bottom
  // Clamped, so a summary outside the axis range draws at the edge rather than
  // pushing the picture out of its box.
  const sx = (x: number) => left + ((Math.min(Math.max(x, xMin), xMax) - xMin) / (xMax - xMin)) * (W - left - right)
  const fmt = (v: number) => String(Number(v.toFixed(2)))
  // Every tick is drawn, but only every so many labelled, so the numbers stay a label's
  // width apart: at 284 wide, 0 to 3500 in 500s printed eight four-digit numbers into
  // one another.
  const widest = Math.max(...ticks.map((v) => fmt(v).length)) * 6.6
  const labelEvery = Math.max(1, Math.ceil((widest + 8) / ((W - left - right) / Math.max(1, ticks.length - 1))))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 500 }} role="img" aria-label={alt}>
      {title && (
        <text x={W / 2} y={20} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>
          {title}
        </text>
      )}
      {ticks.map((v, i) => (
        <line key={`g${i}`} x1={sx(v)} y1={top} x2={sx(v)} y2={H - bottom} stroke={RULE} />
      ))}
      {plots.map((p, i) => {
        const cy = top + i * rowH + rowH / 2
        const boxH = 26
        return (
          <g key={`p${i}`}>
            <text x={left - 10} y={cy + 4} textAnchor="end" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={INK}>
              {p.label}
            </text>
            {/* Whiskers: minimum to lower quartile, upper quartile to maximum. */}
            <line x1={sx(p.min)} y1={cy} x2={sx(p.q1)} y2={cy} stroke={INK} strokeWidth="2" />
            <line x1={sx(p.q3)} y1={cy} x2={sx(p.max)} y2={cy} stroke={INK} strokeWidth="2" />
            <line x1={sx(p.min)} y1={cy - 9} x2={sx(p.min)} y2={cy + 9} stroke={INK} strokeWidth="2" />
            <line x1={sx(p.max)} y1={cy - 9} x2={sx(p.max)} y2={cy + 9} stroke={INK} strokeWidth="2" />
            {/* The box is the interquartile range; the line inside it is the median. */}
            <rect
              x={sx(p.q1)} y={cy - boxH / 2} width={Math.max(sx(p.q3) - sx(p.q1), 1)} height={boxH}
              fill={ACCENT} fillOpacity="0.25" stroke={ACCENT} strokeWidth="2"
            />
            <line x1={sx(p.median)} y1={cy - boxH / 2} x2={sx(p.median)} y2={cy + boxH / 2} stroke={ACCENT} strokeWidth="3" />
          </g>
        )
      })}
      <line x1={left} y1={H - bottom} x2={W - right} y2={H - bottom} stroke={INK} strokeWidth="2" />
      {ticks.map((v, i) => (
        <g key={`t${i}`}>
          <line x1={sx(v)} y1={H - bottom} x2={sx(v)} y2={H - bottom + 5} stroke={INK} />
          {i % labelEvery === 0 && (
            <text x={sx(v)} y={H - bottom + 18} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>
              {fmt(v)}
            </text>
          )}
        </g>
      ))}
      {xLabel && (
        <text x={(left + W - right) / 2} y={H - 8} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>
          {xLabel}
        </text>
      )}
    </svg>
  )
}
