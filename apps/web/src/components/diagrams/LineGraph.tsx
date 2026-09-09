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

/**
 * Axes with straight lines and points. Props: xRange [min, max], yRange [min, max],
 * lines [{m, c, label}], points [{x, y, label}], grid true or false, xLabel and
 * yLabel (axis captions; default to italic x and y), xStep and yStep (tick spacing;
 * chosen automatically when omitted, so small ranges such as 0 to 0.2 still get a scale).
 */
export function LineGraph({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const [xMin, xMax] = (props.xRange as [number, number] | undefined) ?? [-5, 5]
  const [yMin, yMax] = (props.yRange as [number, number] | undefined) ?? [-5, 5]
  const lines = (props.lines as Line[] | undefined) ?? []
  const points = (props.points as Point[] | undefined) ?? []
  const grid = props.grid !== false
  const xLabel = typeof props.xLabel === 'string' ? props.xLabel : undefined
  const yLabel = typeof props.yLabel === 'string' ? props.yLabel : undefined
  const W = 360
  const H = 300
  const pad = 28
  const sx = (x: number) => pad + ((x - xMin) / (xMax - xMin)) * (W - 2 * pad)
  const sy = (y: number) => H - pad - ((y - yMin) / (yMax - yMin)) * (H - 2 * pad)
  const palette = [ACCENT, '#d25b3b', '#2e8b57', '#1f3a93']
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
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 440 }} role="img" aria-label={alt}>
      {grid && xTicks.map((v) => <line key={`gx${v}`} x1={sx(v)} y1={pad} x2={sx(v)} y2={H - pad} stroke={RULE} />)}
      {grid && yTicks.map((v) => <line key={`gy${v}`} x1={pad} y1={sy(v)} x2={W - pad} y2={sy(v)} stroke={RULE} />)}
      {yMin <= 0 && yMax >= 0 && <line x1={pad} y1={sy(0)} x2={W - pad} y2={sy(0)} stroke={INK} strokeWidth="1.5" />}
      {xMin <= 0 && xMax >= 0 && <line x1={sx(0)} y1={pad} x2={sx(0)} y2={H - pad} stroke={INK} strokeWidth="1.5" />}
      {xTicks.filter((v) => v !== 0).map((v) => <text key={`tx${v}`} x={sx(v)} y={sy(Math.max(yMin, Math.min(0, yMax))) + 14} textAnchor="middle" fontFamily={FONT} fontSize="10" fill={INK_2}>{fmt(v)}</text>)}
      {yTicks.filter((v) => v !== 0).map((v) => <text key={`ty${v}`} x={sx(Math.max(xMin, Math.min(0, xMax))) - 6} y={sy(v) + 4} textAnchor="end" fontFamily={FONT} fontSize="10" fill={INK_2}>{fmt(v)}</text>)}
      {xLabel
        ? <text x={W / 2} y={H - 2} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK}>{xLabel}</text>
        : <text x={W - pad} y={sy(Math.max(yMin, Math.min(0, yMax))) - 6} textAnchor="end" fontFamily={DISPLAY} fontSize="12" fontStyle="italic" fill={INK}>x</text>}
      {yLabel
        ? <text x={pad} y={pad - 10} fontFamily={FONT} fontSize="11" fill={INK}>{yLabel}</text>
        : <text x={sx(Math.max(xMin, Math.min(0, xMax))) + 8} y={pad + 4} fontFamily={DISPLAY} fontSize="12" fontStyle="italic" fill={INK}>y</text>}
      {lines.map((l, i) => {
        const seg = segment(l)
        if (!seg) return null
        const colour = l.colour ?? palette[i % palette.length]!
        const [[x1, y1], [x2, y2]] = seg
        return (
          <g key={i}>
            <line x1={sx(x1)} y1={sy(y1)} x2={sx(x2)} y2={sy(y2)} stroke={colour} strokeWidth="2.5" strokeDasharray={l.dashed ? '6 5' : undefined} strokeLinecap="round" />
            {l.label && <text x={sx(x2) - 4} y={sy(y2) + (y2 > y1 ? -8 : 16)} textAnchor="end" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={colour}>{l.label}</text>}
          </g>
        )
      })}
      {points.map((p, i) => (
        <g key={`p${i}`}>
          <circle cx={sx(p.x)} cy={sy(p.y)} r="4.5" fill="#fff" stroke={INK} strokeWidth="2" />
          {p.label && <text x={sx(p.x) + 8} y={sy(p.y) - 8} fontFamily={FONT} fontSize="12" fill={INK}>{p.label}</text>}
        </g>
      ))}
    </svg>
  )
}
