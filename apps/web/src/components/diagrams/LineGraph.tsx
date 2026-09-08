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
 * lines [{m, c, label}], points [{x, y, label}], grid true or false.
 */
export function LineGraph({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const [xMin, xMax] = (props.xRange as [number, number] | undefined) ?? [-5, 5]
  const [yMin, yMax] = (props.yRange as [number, number] | undefined) ?? [-5, 5]
  const lines = (props.lines as Line[] | undefined) ?? []
  const points = (props.points as Point[] | undefined) ?? []
  const grid = props.grid !== false
  const W = 360
  const H = 300
  const pad = 28
  const sx = (x: number) => pad + ((x - xMin) / (xMax - xMin)) * (W - 2 * pad)
  const sy = (y: number) => H - pad - ((y - yMin) / (yMax - yMin)) * (H - 2 * pad)
  const palette = [ACCENT, '#d25b3b', '#2e8b57', '#1f3a93']
  const ticks = (min: number, max: number) => {
    const step = max - min > 20 ? 5 : max - min > 10 ? 2 : 1
    const out: number[] = []
    for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(v)
    return out
  }
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
      {grid && ticks(xMin, xMax).map((v) => <line key={`gx${v}`} x1={sx(v)} y1={pad} x2={sx(v)} y2={H - pad} stroke={RULE} />)}
      {grid && ticks(yMin, yMax).map((v) => <line key={`gy${v}`} x1={pad} y1={sy(v)} x2={W - pad} y2={sy(v)} stroke={RULE} />)}
      {yMin <= 0 && yMax >= 0 && <line x1={pad} y1={sy(0)} x2={W - pad} y2={sy(0)} stroke={INK} strokeWidth="1.5" />}
      {xMin <= 0 && xMax >= 0 && <line x1={sx(0)} y1={pad} x2={sx(0)} y2={H - pad} stroke={INK} strokeWidth="1.5" />}
      {ticks(xMin, xMax).filter((v) => v !== 0).map((v) => <text key={`tx${v}`} x={sx(v)} y={sy(Math.max(yMin, Math.min(0, yMax))) + 14} textAnchor="middle" fontFamily={FONT} fontSize="10" fill={INK_2}>{v}</text>)}
      {ticks(yMin, yMax).filter((v) => v !== 0).map((v) => <text key={`ty${v}`} x={sx(Math.max(xMin, Math.min(0, xMax))) - 6} y={sy(v) + 4} textAnchor="end" fontFamily={FONT} fontSize="10" fill={INK_2}>{v}</text>)}
      <text x={W - pad} y={sy(Math.max(yMin, Math.min(0, yMax))) - 6} textAnchor="end" fontFamily={DISPLAY} fontSize="12" fontStyle="italic" fill={INK}>x</text>
      <text x={sx(Math.max(xMin, Math.min(0, xMax))) + 8} y={pad + 4} fontFamily={DISPLAY} fontSize="12" fontStyle="italic" fill={INK}>y</text>
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
