import { useId } from 'react'
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
  /**
   * Put the label under the point rather than over it. A label sits above by default,
   * which is where the lines usually are at a crossing, so the text ends up with a line
   * drawn through it. Set this when the clear space is below.
   */
  labelBelow?: boolean
}
/** y = amplitude x the named function of x, with x measured in degrees. */
interface Wave {
  fn: 'sin' | 'cos' | 'tan'
  /** Height of the peaks. Default 1, so y = sin x. */
  amplitude?: number
  label?: string
  /** Where along x to put the label. Defaults to the last visible point. */
  labelX?: number
  colour?: string
  dashed?: boolean
}
/** A closed shape in graph units, joined in order. Pair it with `square` for true shape. */
interface Polygon {
  points: [number, number][]
  label?: string
  colour?: string
  dashed?: boolean
  /** Wash the inside, for a region rather than an outline. */
  fill?: boolean
}
/** A circle in graph units. Pair it with `square` so it is drawn round, not oval. */
interface Circle {
  cx: number
  cy: number
  r: number
  label?: string
  colour?: string
  dashed?: boolean
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
  /** When set, the curve is y = scale x base^x, an exponential. Default scale 1. */
  base?: number
  scale?: number
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
 * so small ranges such as 0 to 0.2 still get a scale), waves [{fn, amplitude, label}]
 * for y = sin x, y = cos x and y = tan x with x in degrees, circles [{cx, cy, r}], and
 * square true to give both axes the same unit length so a circle comes out round, and
 * polygons [{points, label}] for shapes on the axes. A curve
 * may also carry `base` (with optional `scale`) for the exponential y = scale x base^x.
 */
export function LineGraph({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const [xMin, xMax] = (props.xRange as [number, number] | undefined) ?? [-5, 5]
  const [yMin, yMax] = (props.yRange as [number, number] | undefined) ?? [-5, 5]
  const lines = (props.lines as Line[] | undefined) ?? []
  const curves = (props.curves as Curve[] | undefined) ?? []
  const points = (props.points as Point[] | undefined) ?? []
  const waves = (props.waves as Wave[] | undefined) ?? []
  const circles = (props.circles as Circle[] | undefined) ?? []
  const polygons = (props.polygons as Polygon[] | undefined) ?? []
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
  const palette = [ACCENT, '#d25b3b', '#2e8b57', '#1f3a93']

  /**
   * Labels are placed at the thing they name — the end of a line, a plotted point — and
   * two of those can land on each other: two roots a unit apart, or a line label where
   * the axis letter sits. This nudges each new label clear of the ones already placed,
   * upwards if there is room above and downwards otherwise, so a chart can never print
   * one label over another. Positions are approximate because SVG cannot measure text
   * here; the browser check is what confirms the result.
   *
   * `anchor` has to match the `textAnchor` the caller draws with, because it decides
   * which side of x the text occupies. A centred label registered as if it started at x
   * reserves the wrong half of the line: two concentric circles labelled on the y-axis
   * came out with "lane 1" printed over the 40 tick, and every check passed.
   */
  const placed: { x: number; y: number; w: number }[] = []
  const clear = (x: number, y: number, text: string, size = 12, anchor: 'start' | 'middle' | 'end' = 'start') => {
    const w = text.length * size * 0.55
    const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x
    const hits = (at: number) => placed.some((q) => Math.abs(q.y - at) < size + 2 && left < q.x + q.w && q.x < left + w)
    /*
     * The nudge has to stay on the canvas. A label starts no further out than the edge,
     * because one whose natural spot is already past it — a tan curve's label, clamped to
     * the top of the plot — would otherwise walk further out with every step; a position
     * outside counts as blocked, so the other direction gets its turn; and if both
     * directions fail it goes back to the edge. An overlap is a defect. Invisible is
     * worse, and invisible is what twelve labels were.
     */
    const top = size + 2
    const bottom = totalH - size * 0.3
    const from = Math.min(Math.max(y, top), bottom)
    const inside = (at: number) => at >= top && at <= bottom
    const blocked = (at: number) => hits(at) || !inside(at)
    let out = from
    for (let step = 0; step < 8 && blocked(out); step++) out = from - (step + 1) * (size + 4)
    if (blocked(out)) { out = from; for (let step = 0; step < 8 && blocked(out); step++) out = from + (step + 1) * (size + 4) }
    if (!inside(out)) out = from
    placed.push({ x: left, y: out, w })
    return out
  }
  /**
   * Which side of a chosen x a label reads from. It normally runs rightwards, but one
   * asked for near the right-hand edge would run off it — y = f(x − 3) had its last
   * characters outside the canvas — so there it reads back towards the left instead,
   * the way a plotted point's label already does.
   */
  const sideAt = (atX: number, text: string, size = 12) => (atX + 6 + text.length * size * 0.55 > W ? 'end' : 'start') as 'end' | 'start'
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
  /**
   * With `square` set, one graph unit is the same length on both axes, so a circle is
   * drawn round and a right angle looks like one. The plot takes the smaller of the two
   * scales and what is drawn is centred in the box left over. Without it the axes are
   * stretched independently to fill the box, which is what every other chart here wants.
   */
  const boxW = W - padL - pad, boxH = H - 2 * pad
  const same = props.square === true ? Math.min(boxW / (xMax - xMin), boxH / (yMax - yMin)) : 0
  const kx = same || boxW / (xMax - xMin), ky = same || boxH / (yMax - yMin)
  const sx = (x: number) => padL + (boxW - kx * (xMax - xMin)) / 2 + (x - xMin) * kx
  const sy = (y: number) => H - pad - (boxH - ky * (yMax - yMin)) / 2 - (y - yMin) * ky
  const left = sx(xMin), right = sx(xMax), top = sy(yMax), bottom = sy(yMin)
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
  const yOf = (k: Curve, x: number) =>
    k.reciprocal !== undefined ? k.reciprocal / x
    : k.base !== undefined ? (k.scale ?? 1) * k.base ** x
    : (k.cube ?? 0) * x * x * x + k.a * x * x + k.b * x + k.c
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
  /**
   * A wave is sampled every half degree. The pen lifts where the value leaves the box —
   * which is what draws tan as separate branches — and also where it jumps more than
   * half the visible height in one step, so the two branches either side of an asymptote
   * are never joined by a near-vertical line that is not part of the graph.
   */
  const wavePath = (w: Wave) => {
    const amp = w.amplitude ?? 1
    const f = w.fn === 'sin' ? Math.sin : w.fn === 'cos' ? Math.cos : Math.tan
    const steps = Math.max(240, Math.round((xMax - xMin) * 2))
    let d = '', pen = false, last: [number, number] | null = null, prev: number | null = null
    for (let i = 0; i <= steps; i++) {
      const x = xMin + ((xMax - xMin) * i) / steps
      const y = amp * f((x * Math.PI) / 180)
      const jump = prev !== null && Math.abs(y - prev) > (yMax - yMin) / 2
      if (Number.isFinite(y) && y >= yMin && y <= yMax && !jump) {
        d += `${pen ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(y).toFixed(1)} `
        pen = true
        last = [x, y]
      } else pen = false
      prev = y
    }
    return { d, last }
  }
  // Circles are clipped to the plot box, and two charts on one page must not share a
  // clip path, so the id comes from React rather than being a constant.
  const clip = useId().replace(/[^\w-]/g, '')
  return (
    <svg viewBox={`0 0 ${W} ${totalH}`} width="100%" style={{ maxWidth: 440 }} role="img" aria-label={alt}>
      <defs><clipPath id={`box-${clip}`}><rect x={left} y={top} width={right - left} height={bottom - top} /></clipPath></defs>
      {grid && xTicks.map((v) => <line key={`gx${v}`} x1={sx(v)} y1={top} x2={sx(v)} y2={bottom} stroke={RULE} />)}
      {grid && yTicks.map((v) => <line key={`gy${v}`} x1={left} y1={sy(v)} x2={right} y2={sy(v)} stroke={RULE} />)}
      {yMin <= 0 && yMax >= 0 && <line x1={left} y1={sy(0)} x2={right} y2={sy(0)} stroke={INK} strokeWidth="1.5" />}
      {xMin <= 0 && xMax >= 0 && <line x1={sx(0)} y1={top} x2={sx(0)} y2={bottom} stroke={INK} strokeWidth="1.5" />}
      {/*
        * The tick numbers sit against the axes, which is exactly where a curve crosses
        * them: every sine wave in the pack had its 180 and 360 struck through. They are
        * drawn on a white halo, as ReactionProfile and CurveGraph draw text that has to
        * sit over a picture, so a line passing over one leaves it readable.
        */}
      {xTicks.filter((v) => v !== 0).map((v) => <text key={`tx${v}`} x={sx(v)} y={reserve(sx(v) - String(fmt(v)).length * 3, sy(Math.max(yMin, Math.min(0, yMax))) + 14, fmt(v))} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2} stroke="#ffffff" strokeWidth="3" paintOrder="stroke">{fmt(v)}</text>)}
      {yTicks.filter((v) => v !== 0).map((v) => <text key={`ty${v}`} x={sx(Math.max(xMin, Math.min(0, xMax))) - 6} y={reserve(sx(Math.max(xMin, Math.min(0, xMax))) - 6, sy(v) + 4, fmt(v), 11, true)} textAnchor="end" fontFamily={FONT} fontSize="11" fill={INK_2} stroke="#ffffff" strokeWidth="3" paintOrder="stroke">{fmt(v)}</text>)}
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
            {l.label && <text x={sx(x2) - 4} y={clear(sx(x2) - 4, sy(y2) + (y2 > y1 ? -8 : 16), l.label, 12, 'end')} textAnchor="end" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={colour}>{l.label}</text>}
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
              ? (() => {
                  const side = sideAt(sx(k.labelX), k.label)
                  const lx = sx(k.labelX) + (side === 'end' ? -6 : 6)
                  return <text x={lx} y={clear(lx, sy(Math.max(yMin, Math.min(yOf(k, k.labelX), yMax))) - 8, k.label, 12, side)} textAnchor={side} fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={colour}>{k.label}</text>
                })()
              : <text x={sx(last[0]) - 4} y={clear(sx(last[0]) - 4, sy(last[1]) + (k.a > 0 ? -8 : 16), k.label, 12, 'end')} textAnchor="end" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={colour}>{k.label}</text>)}
          </g>
        )
      })}
      {waves.map((w, i) => {
        const { d, last } = wavePath(w)
        if (!last) return null
        const colour = w.colour ?? palette[(lines.length + curves.length + i) % palette.length]!
        const at = typeof w.labelX === 'number' ? w.labelX : last[0]
        const y = (w.amplitude ?? 1) * (w.fn === 'sin' ? Math.sin : w.fn === 'cos' ? Math.cos : Math.tan)((at * Math.PI) / 180)
        return (
          <g key={`w${i}`}>
            <path d={d} fill="none" stroke={colour} strokeWidth="2.5" strokeDasharray={w.dashed ? '6 5' : undefined} strokeLinecap="round" />
            {/*
              * A wave labelled at its last visible point reads back towards the curve, so
              * the text ends there. One labelled at a chosen x reads forwards from it, the
              * way a curve's labelX already does: ending at that x instead drags the text
              * left across the y-axis numbers, and y = tan x spent every nudge trying to
              * get out from under them.
              */}
            {w.label && (typeof w.labelX === 'number'
              ? (() => {
                  const side = sideAt(sx(at), w.label)
                  const lx = sx(at) + (side === 'end' ? -6 : 6)
                  return <text x={lx} y={clear(lx, sy(Math.max(yMin, Math.min(y, yMax))) - 8, w.label, 12, side)} textAnchor={side} fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={colour}>{w.label}</text>
                })()
              : <text x={sx(at) - 4} y={clear(sx(at) - 4, sy(Math.max(yMin, Math.min(y, yMax))) - 8, w.label, 12, 'end')} textAnchor="end" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={colour}>{w.label}</text>)}
          </g>
        )
      })}
      {polygons.map((g, i) => {
        const colour = g.colour ?? palette[(lines.length + curves.length + waves.length + i) % palette.length]!
        const pts = g.points.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(' ')
        const cx = g.points.reduce((t, [x]) => t + x, 0) / g.points.length
        const cy = g.points.reduce((t, [, y]) => t + y, 0) / g.points.length
        return (
          <g key={`g${i}`} clipPath={`url(#box-${clip})`}>
            <polygon points={pts} fill={g.fill ? colour : 'none'} fillOpacity={g.fill ? 0.14 : undefined} stroke={colour} strokeWidth="2.5" strokeDasharray={g.dashed ? '6 5' : undefined} strokeLinejoin="round" />
            {g.label && <text x={sx(cx)} y={clear(sx(cx), sy(cy) + 4, g.label, 13, 'middle')} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={colour}>{g.label}</text>}
          </g>
        )
      })}
      {circles.map((c, i) => {
        const colour = c.colour ?? palette[(lines.length + curves.length + waves.length + i) % palette.length]!
        return (
          <g key={`c${i}`}>
            <ellipse cx={sx(c.cx)} cy={sy(c.cy)} rx={Math.abs(c.r) * kx} ry={Math.abs(c.r) * ky} fill="none" stroke={colour} strokeWidth="2.5" strokeDasharray={c.dashed ? '6 5' : undefined} clipPath={`url(#box-${clip})`} />
            {c.label && <text x={sx(c.cx)} y={clear(sx(c.cx), sy(c.cy + Math.abs(c.r)) - 8, c.label, 12, 'middle')} textAnchor="middle" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={colour}>{c.label}</text>}
          </g>
        )
      })}
      {points.map((p, i) => (
        <g key={`p${i}`}>
          <circle cx={sx(p.x)} cy={sy(p.y)} r="4.5" fill="#fff" stroke={INK} strokeWidth="2" />
          {/* A point in the right half labels to its left, so the text stays inside the chart. */}
          {p.label && (() => {
            const left = sx(p.x) > W / 2
            const lx = sx(p.x) + (left ? -8 : 8)
            const ly = p.labelBelow ? sy(p.y) + 16 : sy(p.y) - 8
            return <text x={lx} y={clear(lx, ly, p.label, 12, left ? 'end' : 'start')} textAnchor={left ? 'end' : 'start'} fontFamily={FONT} fontSize="12" fill={INK}>{p.label}</text>
          })()}
        </g>
      ))}
    </svg>
  )
}
