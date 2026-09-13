import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

interface Pt { t: number; y: number }
interface Series {
  points: Pt[]
  label?: string
  colour?: string
  dashed?: boolean
}
interface Gradient { from: number; to: number; label?: string }
interface Shade { from: number; to: number; label?: string }
interface Marker { t: number; label: string }
interface Label { t: number; y: number; text: string }

/** Straight-line interpolation of a series at time t, so gradient triangles and shading sit on the line. */
function valueAt(points: Pt[], t: number): number {
  if (points.length === 0) return 0
  if (t <= points[0]!.t) return points[0]!.y
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!
    if (t <= b.t) return b.t === a.t ? b.y : a.y + ((t - a.t) / (b.t - a.t)) * (b.y - a.y)
  }
  return points[points.length - 1]!.y
}

/** A tick step of 1, 2 or 5 times a power of ten, giving roughly 5 to 8 ticks across the range. */
function niceStep(range: number): number {
  const raw = range / 6
  const mag = 10 ** Math.floor(Math.log10(raw))
  const unit = raw / mag
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * mag
}

/**
 * A distance–time or velocity–time graph drawn as a polyline through the points the
 * content gives, so a journey with stages reads as stages. A `gradient` triangle shows
 * rise over run between two times, which is the whole idea of reading speed or
 * acceleration from the graph; `shade` fills the area under the line between two times,
 * which is distance on a velocity–time graph. A curved section is given as many points.
 *
 * Props: kind ('distance-time' | 'velocity-time', sets axis captions), points [{t, y}]
 * or series [{label, points, colour, dashed}], gradient {from, to, label}, shade
 * [{from, to, label}], markers [{t, label}] as dashed verticals, labels [{t, y, text}],
 * xMax, yMax, xLabel, yLabel.
 */
export function MotionGraph({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  // Built inside the component: index.tsx imports this file, so a module-level use of ACCENT runs before it exists.
  const PALETTE = [ACCENT, '#d25b3b', '#2e8b57', '#1f3a93']
  const kind = String(props.kind ?? 'distance-time')
  const series: Series[] = (props.series as Series[] | undefined) ?? [{ points: (props.points as Pt[] | undefined) ?? [] }]
  const gradient = props.gradient as Gradient | undefined
  const shades = (props.shade as Shade[] | undefined) ?? []
  const markers = (props.markers as Marker[] | undefined) ?? []
  const labels = (props.labels as Label[] | undefined) ?? []
  const xLabel = typeof props.xLabel === 'string' ? props.xLabel : 'time (s)'
  const yLabel = typeof props.yLabel === 'string' ? props.yLabel : kind === 'velocity-time' ? 'velocity (m/s)' : 'distance (m)'
  const all = series.flatMap((s) => s.points)
  const dataXMax = Math.max(...all.map((p) => p.t), 1)
  const dataYMax = Math.max(...all.map((p) => p.y), 1)
  const dataYMin = Math.min(...all.map((p) => p.y), 0)
  const xStep = niceStep(typeof props.xMax === 'number' ? props.xMax : dataXMax)
  const yStep = niceStep((typeof props.yMax === 'number' ? props.yMax : dataYMax) - dataYMin)
  const xMax = typeof props.xMax === 'number' ? props.xMax : Math.ceil(dataXMax / xStep) * xStep
  // A little headroom, so a line that reaches the data maximum does not run along the top edge.
  const yMax = typeof props.yMax === 'number' ? props.yMax : Math.ceil((dataYMax * 1.08) / yStep) * yStep
  const yMin = Math.floor(dataYMin / yStep) * yStep
  const W = 400, H = 300, padT = 20, padR = 20, padB = 44
  const fmt = (v: number) => String(Number(v.toFixed(4)))
  const yTicks: number[] = []
  for (let v = yMin; v <= yMax + 1e-9; v += yStep) yTicks.push(Number(v.toFixed(6)))
  const xTicks: number[] = []
  for (let v = 0; v <= xMax + 1e-9; v += xStep) xTicks.push(Number(v.toFixed(6)))
  const padL = Math.max(44, 14 + 6.5 * Math.max(...yTicks.map((v) => fmt(v).length)))
  const sx = (t: number) => padL + (t / xMax) * (W - padL - padR)
  const sy = (y: number) => H - padB - ((y - yMin) / (yMax - yMin)) * (H - padT - padB)
  const path = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.t).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ')
  const first = series[0]?.points ?? []
  const chosen = new Set(series.map((s) => s.colour).filter(Boolean))
  const free = PALETTE.filter((c) => !chosen.has(c))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 480 }} role="img" aria-label={alt}>
      {yTicks.map((v) => <line key={`gy${v}`} x1={padL} y1={sy(v)} x2={W - padR} y2={sy(v)} stroke={RULE} />)}
      {xTicks.map((v) => <line key={`gx${v}`} x1={sx(v)} y1={padT} x2={sx(v)} y2={H - padB} stroke={RULE} />)}
      {shades.map((s, i) => {
        // Sample the polyline between the two times so a sloped section shades as a trapezium.
        const ts = [s.from, ...first.map((p) => p.t).filter((t) => t > s.from && t < s.to), s.to]
        const d = `M${sx(s.from).toFixed(1)} ${sy(0).toFixed(1)} ` + ts.map((t) => `L${sx(t).toFixed(1)} ${sy(valueAt(first, t)).toFixed(1)}`).join(' ') + ` L${sx(s.to).toFixed(1)} ${sy(0).toFixed(1)} Z`
        const mid = (s.from + s.to) / 2
        return (
          <g key={`sh${i}`}>
            <path d={d} fill={ACCENT} opacity="0.18" />
            {s.label && <text x={sx(mid)} y={(sy(valueAt(first, mid)) + sy(0)) / 2 + 4} textAnchor="middle" fontFamily={DISPLAY} fontSize="11" fontWeight="700" fill={INK}>{s.label}</text>}
          </g>
        )
      })}
      <line x1={padL} y1={sy(0)} x2={W - padR} y2={sy(0)} stroke={INK} strokeWidth="1.5" />
      <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke={INK} strokeWidth="1.5" />
      {yTicks.map((v) => <text key={`ty${v}`} x={padL - 6} y={sy(v) + 4} textAnchor="end" fontFamily={FONT} fontSize="10" fill={INK_2}>{fmt(v)}</text>)}
      {xTicks.map((v) => <text key={`tx${v}`} x={sx(v)} y={H - padB + 14} textAnchor="middle" fontFamily={FONT} fontSize="10" fill={INK_2}>{fmt(v)}</text>)}
      {markers.map((m, i) => (
        <g key={`m${i}`}>
          <line x1={sx(m.t)} y1={padT} x2={sx(m.t)} y2={H - padB} stroke={INK_2} strokeDasharray="4 4" />
          <text x={sx(m.t) > W - padR - 70 ? sx(m.t) - 4 : sx(m.t) + 4} y={padT + 12} textAnchor={sx(m.t) > W - padR - 70 ? 'end' : 'start'} fontFamily={FONT} fontSize="10" fill={INK_2}>{m.label}</text>
        </g>
      ))}
      {series.map((s, i) => {
        const colour = s.colour ?? free[i % free.length]!
        const end = s.points[s.points.length - 1]
        return (
          <g key={`s${i}`}>
            <path d={path(s.points)} fill="none" stroke={colour} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '6 5' : undefined} />
            {s.label && end && <text x={Math.min(sx(end.t), W - padR - 2)} y={sy(end.y) - 8} textAnchor="end" fontFamily={DISPLAY} fontSize="11" fontWeight="700" fill={colour}>{s.label}</text>}
          </g>
        )
      })}
      {gradient && (() => {
        const y1 = valueAt(first, gradient.from), y2 = valueAt(first, gradient.to)
        const x1 = sx(gradient.from), x2 = sx(gradient.to), Y1 = sy(y1), Y2 = sy(y2)
        const rise = y2 - y1, run = gradient.to - gradient.from
        // The run label goes under the horizontal leg unless that leg lies on the axis, where it would hit the tick numbers.
        const runY = Y2 < Y1 && Y1 < H - padB - 2 ? Y1 + 14 : Y1 - 6
        // The rise labels sit to the right of the vertical leg, or to its left when the leg is near the right edge.
        const left = x2 > W - padR - 60
        const riseX = left ? x2 - 6 : x2 + 6
        const riseAnchor = left ? 'end' : 'start'
        return (
          <g>
            <line x1={x1} y1={Y1} x2={x2} y2={Y1} stroke="#d25b3b" strokeWidth="1.5" strokeDasharray="5 4" />
            <line x1={x2} y1={Y1} x2={x2} y2={Y2} stroke="#d25b3b" strokeWidth="1.5" strokeDasharray="5 4" />
            <text x={(x1 + x2) / 2} y={runY} textAnchor="middle" fontFamily={FONT} fontSize="11" fill="#d25b3b">{fmt(run)} s</text>
            <text x={riseX} y={(Y1 + Y2) / 2 + 4} textAnchor={riseAnchor} fontFamily={FONT} fontSize="11" fill="#d25b3b">{fmt(rise)}</text>
            {gradient.label && <text x={riseX} y={(Y1 + Y2) / 2 + 18} textAnchor={riseAnchor} fontFamily={DISPLAY} fontSize="11" fontWeight="700" fill="#d25b3b">{gradient.label}</text>}
          </g>
        )
      })()}
      {labels.map((l, i) => <text key={`l${i}`} x={sx(l.t)} y={sy(l.y)} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK}>{l.text}</text>)}
      <text x={(padL + W - padR) / 2} y={H - 6} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK}>{xLabel}</text>
      <text x={padL} y={padT - 6} fontFamily={FONT} fontSize="11" fill={INK}>{yLabel}</text>
    </svg>
  )
}
