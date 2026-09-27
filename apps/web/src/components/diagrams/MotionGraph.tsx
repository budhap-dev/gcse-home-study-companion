import { useLayoutEffect, useRef } from 'react'
import { REFIT, useAvailableWidth } from '../fitSvgText.ts'
import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'
import { besides, near, settler, type Seg, type Spot } from './labelPlace.ts'

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
 * xMax, yMax, xLabel, yLabel, and axisAtBottom.
 *
 * The time axis is drawn at y = 0, which is right for velocity below zero. A heating
 * curve that starts below 0 °C is different: its melting plateau lies at 0, and drawn
 * there it looks like the line running along the axis. `axisAtBottom` puts the time
 * axis along the foot of the plot instead, as a temperature–time graph is drawn.
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
  const axisAtBottom = props.axisAtBottom === true
  const svg = useRef<SVGSVGElement>(null)
  const available = useAvailableWidth(svg)
  useLayoutEffect(() => {
    svg.current?.dispatchEvent(new Event(REFIT, { bubbles: true }))
  }, [available])
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
  const H = 300, padT = 20, padR = 20, padB = 44
  const fmt = (v: number) => String(Number(v.toFixed(4)))

  /**
   * Labels sit at the thing they name — the middle of a segment, the end of a line, a
   * marker — and two can land on each other. Each new one is nudged clear of those
   * already placed. Widths are approximate because SVG cannot measure text here; the
   * browser check is what confirms the result.
   */
  const placed: { x: number; y: number; w: number }[] = []
  const clear = (x: number, y: number, text: string, size = 11, anchor: 'start' | 'middle' | 'end' = 'middle') => {
    const w = text.length * size * 0.55
    const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x
    const hits = (at: number) => placed.some((q) => Math.abs(q.y - at) < size + 2 && left < q.x + q.w && q.x < left + w)
    let out = y
    for (let step = 0; step < 8 && hits(out); step++) out = y - (step + 1) * (size + 4)
    if (hits(out)) { out = y; for (let step = 0; step < 8 && hits(out); step++) out = y + (step + 1) * (size + 4) }
    placed.push({ x: left, y: out, w })
    return out
  }
  const yTicks: number[] = []
  for (let v = yMin; v <= yMax + 1e-9; v += yStep) yTicks.push(Number(v.toFixed(6)))
  const xTicks: number[] = []
  for (let v = 0; v <= xMax + 1e-9; v += xStep) xTicks.push(Number(v.toFixed(6)))
  const padL = Math.max(44, 14 + 6.5 * Math.max(...yTicks.map((v) => fmt(v).length)))
  /*
   * Drawn 400 wide, the graph stopped shrinking at 400 and scrolled sideways inside a
   * phone's 334-pixel card, cutting off the right-hand end of every journey. It now takes
   * the width it is given, as LineGraph does, down to the least that keeps the time
   * ticks apart; unmeasured (on the server, in tests) it is the old 400.
   */
  const tickChars = Math.max(...xTicks.map((v) => fmt(v).length))
  const least = Math.max(280, Math.ceil(padL + padR + (xTicks.length - 1) * (7 * tickChars + 8)))
  const W = Math.max(least, Math.min(400, available ?? 400))
  const sx = (t: number) => padL + (t / xMax) * (W - padL - padR)
  const sy = (y: number) => H - padB - ((y - yMin) / (yMax - yMin)) * (H - padT - padB)
  const path = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.t).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ')
  const first = series[0]?.points ?? []
  const chosen = new Set(series.map((s) => s.colour).filter(Boolean))
  const free = PALETTE.filter((c) => !chosen.has(c))

  /*
   * Everything drawn, as segments on screen. Each label used to be drawn straight after its
   * own element, so a dashed marker, a later series or a gradient leg could run through it:
   * the walk found the t = 3 marker and the curve through "tangent at 3 min", markers through
   * "terminal velocity", "drag = weight" and "gradient = 8 m/s", and a tangent through "4 s".
   * Every label now takes its own spot if nothing drawn runs through it, else the nearest
   * clear one, and all are drawn last on a halo.
   */
  const drawn: Seg[] = []
  const axisY = sy(axisAtBottom ? yMin : 0)
  drawn.push([{ x: padL, y: axisY }, { x: W - padR, y: axisY }], [{ x: padL, y: padT }, { x: padL, y: H - padB }])
  for (const m of markers) drawn.push([{ x: sx(m.t), y: padT }, { x: sx(m.t), y: H - padB }])
  for (const sr of series) for (let i = 1; i < sr.points.length; i++) drawn.push([{ x: sx(sr.points[i - 1]!.t), y: sy(sr.points[i - 1]!.y) }, { x: sx(sr.points[i]!.t), y: sy(sr.points[i]!.y) }])
  const g = gradient && (() => {
    const y1 = valueAt(first, gradient.from), y2 = valueAt(first, gradient.to)
    const x1 = sx(gradient.from), x2 = sx(gradient.to), Y1 = sy(y1), Y2 = sy(y2)
    return { x1, x2, Y1, Y2, rise: y2 - y1, run: gradient.to - gradient.from }
  })()
  if (g) drawn.push([{ x: g.x1, y: g.Y1 }, { x: g.x2, y: g.Y1 }], [{ x: g.x2, y: g.Y1 }, { x: g.x2, y: g.Y2 }])
  // The tick numbers sit outside the plot; registered so nothing else lands on them.
  for (const v of yTicks) placed.push({ x: padL - 6 - fmt(v).length * 6, y: sy(v) + 4, w: fmt(v).length * 6 })
  for (const v of xTicks) placed.push({ x: sx(v) - fmt(v).length * 3, y: H - padB + 14, w: fmt(v).length * 6 })
  const settle = settler(drawn, placed, W, H, clear)

  const shadeLabels = shades.map((sh) => {
    if (!sh.label) return undefined
    const mid = (sh.from + sh.to) / 2
    const own: Spot = { x: sx(mid), y: (sy(valueAt(first, mid)) + sy(0)) / 2 + 4, anchor: 'middle' }
    return settle(near(own), sh.label, 11, own)
  })
  const markerLabels = markers.map((m) => {
    // Beside its line at the top, reading away from the right-hand edge; then on down the line, either side.
    const toLeft = sx(m.t) > W - padR - 70
    const own: Spot = { x: toLeft ? sx(m.t) - 4 : sx(m.t) + 4, y: padT + 12, anchor: toLeft ? 'end' : 'start' }
    const other: Spot = { x: toLeft ? sx(m.t) + 4 : sx(m.t) - 4, y: padT + 12, anchor: toLeft ? 'start' : 'end' }
    const down = [1, 2, 3, 4, 5, 6].flatMap((k) => [{ ...own, y: own.y + k * 13 }, { ...other, y: other.y + k * 13 }])
    return settle([own, other, ...down], m.label, 11, own, false)
  })
  const seriesLabels = series.map((sr) => {
    const end = sr.points[sr.points.length - 1]
    if (!sr.label || !end) return undefined
    const own: Spot = { x: Math.min(sx(end.t), W - padR - 2), y: sy(end.y) - 8, anchor: 'end' }
    const back = sr.points.slice(-4).reverse().map((p) => ({ x: sx(p.t), y: sy(p.y) }))
    return settle([...near(own), ...back.flatMap((p) => besides(p))], sr.label, 11, own)
  })
  const gradientLabels = g && (() => {
    // The run label goes under the horizontal leg unless that leg lies on the axis, where it would hit the tick numbers.
    const runOwn: Spot = { x: (g.x1 + g.x2) / 2, y: g.Y2 < g.Y1 && g.Y1 < H - padB - 2 ? g.Y1 + 14 : g.Y1 - 6, anchor: 'middle' }
    const run = settle([...near(runOwn), { ...runOwn, y: g.Y1 + 14 }, { ...runOwn, y: g.Y1 - 6 }], `${fmt(g.run)} s`, 11, runOwn, false)
    // The rise labels sit to the right of the vertical leg, or to its left when the leg is near the right edge.
    const left = g.x2 > W - padR - 60
    const riseOwn: Spot = { x: left ? g.x2 - 6 : g.x2 + 6, y: (g.Y1 + g.Y2) / 2 + 4, anchor: left ? 'end' : 'start' }
    const flip = (o: Spot): Spot => ({ x: left ? g.x2 + 6 : g.x2 - 6, y: o.y, anchor: left ? 'start' : 'end' })
    // Inside the triangle, in the corner between its legs, when both sides of the rise leg
    // are taken: a marker line beside the leg ran through "60 km/h" and "gradient = 8 m/s".
    const up = g.Y2 < g.Y1 ? -1 : 1
    const inside = [1, 2, 3].map((k): Spot => ({ x: g.x2 - 6, y: g.Y1 + up * (k * 14 - 4) + (up > 0 ? 8 : 0), anchor: 'end' }))
    const rise = settle([...near(riseOwn), flip(riseOwn), ...inside], fmt(g.rise), 11, riseOwn, false)
    const nameOwn: Spot = { ...riseOwn, y: riseOwn.y + 14 }
    const name = gradient!.label ? settle([...near(nameOwn), flip(nameOwn), { ...riseOwn, y: riseOwn.y - 14 }, { ...flip(riseOwn), y: riseOwn.y - 14 }, ...inside], gradient!.label, 11, nameOwn) : undefined
    return { run, rise, name }
  })()
  const freeLabels = labels.map((l) => { const own: Spot = { x: sx(l.t), y: sy(l.y), anchor: 'middle' }; return settle(near(own), l.text, 11, own, false) })
  const halo = { stroke: '#ffffff', strokeWidth: 3, paintOrder: 'stroke' } as const
  const colourOf = (i: number) => series[i]!.colour ?? free[i % free.length]!

  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 480 }} role="img" aria-label={alt}>
      {yTicks.map((v) => <line key={`gy${v}`} x1={padL} y1={sy(v)} x2={W - padR} y2={sy(v)} stroke={RULE} />)}
      {xTicks.map((v) => <line key={`gx${v}`} x1={sx(v)} y1={padT} x2={sx(v)} y2={H - padB} stroke={RULE} />)}
      {shades.map((sh, i) => {
        // Sample the polyline between the two times so a sloped section shades as a trapezium.
        const ts = [sh.from, ...first.map((p) => p.t).filter((t) => t > sh.from && t < sh.to), sh.to]
        const d = `M${sx(sh.from).toFixed(1)} ${sy(0).toFixed(1)} ` + ts.map((t) => `L${sx(t).toFixed(1)} ${sy(valueAt(first, t)).toFixed(1)}`).join(' ') + ` L${sx(sh.to).toFixed(1)} ${sy(0).toFixed(1)} Z`
        return <path key={`sh${i}`} d={d} fill={ACCENT} opacity="0.18" />
      })}
      <line x1={padL} y1={axisY} x2={W - padR} y2={axisY} stroke={INK} strokeWidth="1.5" />
      <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke={INK} strokeWidth="1.5" />
      {yTicks.map((v) => <text key={`ty${v}`} x={padL - 6} y={sy(v) + 4} textAnchor="end" fontFamily={FONT} fontSize="11" fill={INK_2}>{fmt(v)}</text>)}
      {xTicks.map((v) => <text key={`tx${v}`} x={sx(v)} y={H - padB + 14} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>{fmt(v)}</text>)}
      {markers.map((m, i) => <line key={`m${i}`} x1={sx(m.t)} y1={padT} x2={sx(m.t)} y2={H - padB} stroke={INK_2} strokeDasharray="4 4" />)}
      {series.map((sr, i) => <path key={`s${i}`} d={path(sr.points)} fill="none" stroke={colourOf(i)} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={sr.dashed ? '6 5' : undefined} />)}
      {g && (
        <g>
          <line x1={g.x1} y1={g.Y1} x2={g.x2} y2={g.Y1} stroke="#d25b3b" strokeWidth="1.5" strokeDasharray="5 4" />
          <line x1={g.x2} y1={g.Y1} x2={g.x2} y2={g.Y2} stroke="#d25b3b" strokeWidth="1.5" strokeDasharray="5 4" />
        </g>
      )}
      {/* Labels last, each where nothing drawn runs through it. */}
      {shades.map((sh, i) => shadeLabels[i] && <text key={`shl${i}`} x={shadeLabels[i]!.x} y={shadeLabels[i]!.y} textAnchor={shadeLabels[i]!.anchor} fontFamily={DISPLAY} fontSize="11" fontWeight="700" fill={INK} {...halo}>{sh.label}</text>)}
      {markers.map((m, i) => <text key={`ml${i}`} x={markerLabels[i]!.x} y={markerLabels[i]!.y} textAnchor={markerLabels[i]!.anchor} fontFamily={FONT} fontSize="11" fill={INK_2} {...halo}>{m.label}</text>)}
      {series.map((sr, i) => seriesLabels[i] && <text key={`sl${i}`} x={seriesLabels[i]!.x} y={seriesLabels[i]!.y} textAnchor={seriesLabels[i]!.anchor} fontFamily={DISPLAY} fontSize="11" fontWeight="700" fill={colourOf(i)} {...halo}>{sr.label}</text>)}
      {g && gradientLabels && (
        <g>
          <text x={gradientLabels.run.x} y={gradientLabels.run.y} textAnchor={gradientLabels.run.anchor} fontFamily={FONT} fontSize="11" fill="#d25b3b" {...halo}>{fmt(g.run)} s</text>
          <text x={gradientLabels.rise.x} y={gradientLabels.rise.y} textAnchor={gradientLabels.rise.anchor} fontFamily={FONT} fontSize="11" fill="#d25b3b" {...halo}>{fmt(g.rise)}</text>
          {gradientLabels.name && <text x={gradientLabels.name.x} y={gradientLabels.name.y} textAnchor={gradientLabels.name.anchor} fontFamily={DISPLAY} fontSize="11" fontWeight="700" fill="#d25b3b" {...halo}>{gradient!.label}</text>}
        </g>
      )}
      {labels.map((l, i) => <text key={`l${i}`} x={freeLabels[i]!.x} y={freeLabels[i]!.y} textAnchor={freeLabels[i]!.anchor} fontFamily={FONT} fontSize="11" fill={INK} {...halo}>{l.text}</text>)}
      <text x={(padL + W - padR) / 2} y={H - 6} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK}>{xLabel}</text>
      <text x={padL} y={padT - 6} fontFamily={FONT} fontSize="11" fill={INK}>{yLabel}</text>
    </svg>
  )
}
