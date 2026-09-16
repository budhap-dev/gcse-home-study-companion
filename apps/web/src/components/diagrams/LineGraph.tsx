import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

interface Line {
  /** y = m x + c */
  m: number
  c: number
  label?: string
  colour?: string
  dashed?: boolean
}
interface Point {
  x: number
  y: number
  label?: string
}
interface Curve {
  /** y = a x² + b x + c, plus cube·x³ when a cubic is wanted */
  a: number
  b: number
  c: number
  /** Coefficient of x³. With a, b and c zero this draws y = cube·x³ on its own. */
  cube?: number
  /** When set, the curve is y = reciprocal / x instead, drawn in two arms either side of the asymptote. */
  reciprocal?: number
  label?: string
  /**
   * Where along x to put the label, just above the curve. By default it sits at the
   * curve's last visible point, which for a curve that ends near y = 0 — a reciprocal
   * arm — is on top of the axis letter.
   */
  labelX?: number
  colour?: string
  dashed?: boolean
}

/**
 * Axes with straight lines, quadratic curves and points. Props: xRange [min, max],
 * yRange [min, max], lines [{m, c, label}], curves [{a, b, c, label}], points
 * [{x, y, label}], grid true or false, xLabel and yLabel (axis captions; default to
 * italic x and y), xStep and yStep (tick spacing; chosen automatically when omitted,
 * so small ranges such as 0 to 0.2 still get a scale).
 */
export function LineGraph({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const [xMin, xMax] = (props.xRange as [number, number] | undefined) ?? [-5, 5]
  const [yMin, yMax] = (props.yRange as [number, number] | undefined) ?? [-5, 5]
  const lines = (props.lines as Line[] | undefined) ?? []
  const curves = (props.curves as Curve[] | undefined) ?? []
  const points = (props.points as Point[] | undefined) ?? []
  const grid = props.grid !== false
  const xLabel = typeof props.xLabel === 'string' ? props.xLabel : undefined
  const yLabel = typeof props.yLabel === 'string' ? props.yLabel : undefined
  const W = 360
  const H = 300
  const pad = 28
  /**
   * An x-axis caption needs a band of its own below the tick numbers. It used to sit at
   * H - 2, twelve pixels under tick labels whose own descenders reached further than
   * that, so the two touched. The plot box is unchanged; the canvas simply grows.
   */
  const captionBand = xLabel ? 16 : 0
  const totalH = H + captionBand
  const sy = (y: number) => H - pad - ((y - yMin) / (yMax - yMin)) * (H - 2 * pad)
  const palette = [ACCENT, '#d25b3b', '#2e8b57', '#1f3a93']

  /**
   * Labels are placed at the thing they name — the end of a line, a plotted point — and
   * two of those can land on each other: two roots a unit apart, or a line label where
   * the axis letter sits. This nudges each new label clear of the ones already placed,
   * upwards if there is room above and downwards otherwise, so a chart can never print
   * one label over another. Positions are approximate because SVG cannot measure text
   * here; the browser check is what confirms the result.
   */
  const placed: { x: number; y: number; w: number }[] = []
  const clear = (x: number, y: number, text: string, size = 12, anchorEnd = false) => {
    const w = text.length * size * 0.55
    const left = anchorEnd ? x - w : x
    const hits = (at: number) => placed.some((q) => Math.abs(q.y - at) < size + 2 && left < q.x + q.w && q.x < left + w)
    let out = y
    for (let step = 0; step < 8 && hits(out); step++) out = y - (step + 1) * (size + 4)
    if (hits(out)) { out = y; for (let step = 0; step < 8 && hits(out); step++) out = y + (step + 1) * (size + 4) }
    placed.push({ x: left, y: out, w })
    return out
  }
  /** Register a label that must not move, so movable ones are nudged clear of it. */
  const reserve = (x: number, y: number, text: string, size = 11, anchorEnd = false) => {
    const w = text.length * size * 0.55
    placed.push({ x: anchorEnd ? x - w : x, y, w })
    return y
  }
  // A tick step of 1, 2 or 5 times a power of ten, giving roughly 5 to 10 ticks across the range.
  const niceStep = (range: number) => {
    const raw = range / 8
    const mag = 10 ** Math.floor(Math.log10(raw))
    const unit = raw / mag
    return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * mag
  }
  const ticks = (min: number, max: number, forced?: unknown) => {
    const step = typeof forced === 'number' && forced > 0 ? forced : niceStep(max - min)
    const out: number[] = []
    for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(6)))
    return out
  }
  const xTicks = ticks(xMin, xMax, props.xStep), yTicks = ticks(yMin, yMax, props.yStep)
  const fmt = (v: number) => String(Number(v.toFixed(4)))
  // The left margin grows with the widest y label, so a 20 000 axis is not clipped.
  const padL = Math.max(pad, 12 + 6.2 * Math.max(...yTicks.map((v) => fmt(v).length)))
  const sx = (x: number) => padL + ((x - xMin) / (xMax - xMin)) * (W - padL - pad)
  // clip each line to the visible box by sampling its ends
  const segment = (l: Line) => {
    const pts: [number, number][] = []
    const add = (x: number, y: number) => { if (x >= xMin - 1e-9 && x <= xMax + 1e-9 && y >= yMin - 1e-9 && y <= yMax + 1e-9) pts.push([x, y]) }
    add(xMin, l.m * xMin + l.c)
    add(xMax, l.m * xMax + l.c)
    if (l.m !== 0) { add((yMin - l.c) / l.m, yMin); add((yMax - l.c) / l.m, yMax) }
    pts.sort((a, b) => a[0] - b[0])
    return pts.length >= 2 ? [pts[0]!, pts[pts.length - 1]!] : null
  }
  // A curve is sampled across the x range and drawn only where it lies inside the box,
  // so a parabola whose arms leave the top simply stops at the edge.
  // A reciprocal is infinite at x = 0, which fails the box test in curvePath, so the pen
  // lifts there of its own accord and the two arms draw separately.
  const yOf = (k: Curve, x: number) => (k.reciprocal !== undefined ? k.reciprocal / x : (k.cube ?? 0) * x * x * x + k.a * x * x + k.b * x + k.c)
  const curvePath = (k: Curve) => {
    let d = ''
    let pen = false
    let last: [number, number] | null = null
    for (let i = 0; i <= 120; i++) {
      const x = xMin + ((xMax - xMin) * i) / 120
      const y = yOf(k, x)
      if (Number.isFinite(y) && y >= yMin && y <= yMax) {
        d += `${pen ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(y).toFixed(1)} `
        pen = true
        last = [x, y]
      } else pen = false
    }
    return { d, last }
  }
  return (
    <svg viewBox={`0 0 ${W} ${totalH}`} width="100%" style={{ maxWidth: 440 }} role="img" aria-label={alt}>
      {grid && xTicks.map((v) => <line key={`gx${v}`} x1={sx(v)} y1={pad} x2={sx(v)} y2={H - pad} stroke={RULE} />)}
      {grid && yTicks.map((v) => <line key={`gy${v}`} x1={padL} y1={sy(v)} x2={W - pad} y2={sy(v)} stroke={RULE} />)}
      {yMin <= 0 && yMax >= 0 && <line x1={padL} y1={sy(0)} x2={W - pad} y2={sy(0)} stroke={INK} strokeWidth="1.5" />}
      {xMin <= 0 && xMax >= 0 && <line x1={sx(0)} y1={pad} x2={sx(0)} y2={H - pad} stroke={INK} strokeWidth="1.5" />}
      {xTicks.filter((v) => v !== 0).map((v) => <text key={`tx${v}`} x={sx(v)} y={reserve(sx(v) - String(fmt(v)).length * 3, sy(Math.max(yMin, Math.min(0, yMax))) + 14, fmt(v))} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>{fmt(v)}</text>)}
      {yTicks.filter((v) => v !== 0).map((v) => <text key={`ty${v}`} x={sx(Math.max(xMin, Math.min(0, xMax))) - 6} y={reserve(sx(Math.max(xMin, Math.min(0, xMax))) - 6, sy(v) + 4, fmt(v), 11, true)} textAnchor="end" fontFamily={FONT} fontSize="11" fill={INK_2}>{fmt(v)}</text>)}
      {xLabel
        ? <text x={W / 2} y={totalH - 4} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK}>{xLabel}</text>
        : <text x={W - pad} y={sy(Math.max(yMin, Math.min(0, yMax))) - 6} textAnchor="end" fontFamily={DISPLAY} fontSize="12" fontStyle="italic" fill={INK}>x</text>}
      {yLabel
        ? <text x={padL} y={pad - 10} fontFamily={FONT} fontSize="11" fill={INK}>{yLabel}</text>
        : // Above the plot rather than inside it: a steep line's own label is drawn at the
          // top of the axis and used to land on this letter.
          <text x={sx(Math.max(xMin, Math.min(0, xMax))) + 8} y={clear(sx(Math.max(xMin, Math.min(0, xMax))) + 8, pad - 8, 'y')} fontFamily={DISPLAY} fontSize="12" fontStyle="italic" fill={INK}>y</text>}
      {lines.map((l, i) => {
        const seg = segment(l)
        if (!seg) return null
        const colour = l.colour ?? palette[i % palette.length]!
        const [[x1, y1], [x2, y2]] = seg
        return (
          <g key={i}>
            <line x1={sx(x1)} y1={sy(y1)} x2={sx(x2)} y2={sy(y2)} stroke={colour} strokeWidth="2.5" strokeDasharray={l.dashed ? '6 5' : undefined} strokeLinecap="round" />
            {l.label && <text x={sx(x2) - 4} y={clear(sx(x2) - 4, sy(y2) + (y2 > y1 ? -8 : 16), l.label, 12, true)} textAnchor="end" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={colour}>{l.label}</text>}
          </g>
        )
      })}
      {curves.map((k, i) => {
        const { d, last } = curvePath(k)
        if (!last) return null
        const colour = k.colour ?? palette[(lines.length + i) % palette.length]!
        return (
          <g key={`k${i}`}>
            <path d={d} fill="none" stroke={colour} strokeWidth="2.5" strokeDasharray={k.dashed ? '6 5' : undefined} strokeLinecap="round" />
            {k.label && (typeof k.labelX === 'number'
              ? <text x={sx(k.labelX) + 6} y={clear(sx(k.labelX) + 6, sy(yOf(k, k.labelX)) - 8, k.label, 12)} textAnchor="start" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={colour}>{k.label}</text>
              : <text x={sx(last[0]) - 4} y={clear(sx(last[0]) - 4, sy(last[1]) + (k.a > 0 ? -8 : 16), k.label, 12, true)} textAnchor="end" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={colour}>{k.label}</text>)}
          </g>
        )
      })}
      {points.map((p, i) => (
        <g key={`p${i}`}>
          <circle cx={sx(p.x)} cy={sy(p.y)} r="4.5" fill="#fff" stroke={INK} strokeWidth="2" />
          {/* A point in the right half labels to its left, so the text stays inside the chart. */}
          {p.label && <text x={sx(p.x) + (sx(p.x) > W / 2 ? -8 : 8)} y={clear(sx(p.x) + (sx(p.x) > W / 2 ? -8 : 8), sy(p.y) - 8, p.label, 12, sx(p.x) > W / 2)} textAnchor={sx(p.x) > W / 2 ? 'end' : 'start'} fontFamily={FONT} fontSize="12" fill={INK}>{p.label}</text>}
        </g>
      ))}
    </svg>
  )
}
