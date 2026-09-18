import { ACCENT, DISPLAY, INK, INK_2 } from './index.tsx'

interface Ray {
  /** Direction in degrees, anticlockwise from east. */
  at: number
  label?: string
}
interface Arc {
  /** Text placed in the gap that starts at this ray index and runs anticlockwise. */
  from: number
  text: string
  /** A right-angle square instead of an arc. */
  right?: boolean
}

/**
 * Two figures that angle questions are built on, and that nothing else here draws.
 *
 * kind "rays": rays leaving one point, with the gaps between them labelled — angles at a
 * point, angles on a straight line, vertically opposite angles. Set `line` to draw the
 * horizontal as a full line through the centre rather than a single ray.
 *
 * kind "parallel": two parallel lines cut by a transversal, with the eight angles
 * available as positions a to h, reading left to right and top to bottom. Label only the
 * ones a question needs; the arrows on the parallel lines are drawn automatically.
 *
 * Props: kind, rays [{at, label}], arcs [{from, text, right}], line, labels (an object
 * keyed a to h for the parallel figure), slope (the transversal's angle, default 60).
 */
export function AngleFigure({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const kind = props.kind === 'parallel' ? 'parallel' : 'rays'
  return kind === 'parallel' ? <Parallel props={props} alt={alt} /> : <Rays props={props} alt={alt} />
}

const W = 420
const H = 260

function Rays({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const rays = (props.rays as Ray[] | undefined) ?? [{ at: 0 }, { at: 55 }, { at: 140 }]
  const arcs = (props.arcs as Arc[] | undefined) ?? []
  const line = props.line === true
  const cx = W / 2, cy = H / 2 + 20, R = 96
  const pt = (deg: number, r: number) => [cx + r * Math.cos((deg * Math.PI) / 180), cy - r * Math.sin((deg * Math.PI) / 180)] as const
  // Gaps run anticlockwise from each ray to the next, so the labels land inside the angle
  // they name rather than on the ray that bounds it.
  const sorted = [...rays].map((r, i) => ({ ...r, i })).sort((a, b) => a.at - b.at)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 460 }} role="img" aria-label={alt}>
      {line && <line x1={cx - R - 18} y1={cy} x2={cx + R + 18} y2={cy} stroke={INK} strokeWidth="2" />}
      {rays.map((r, i) => {
        const [x, y] = pt(r.at, R)
        // A label at 0 or 180 degrees lands on the line it names, so it is lifted clear.
        const flat = Math.abs(Math.sin((r.at * Math.PI) / 180)) < 0.2
        const [lx, ly0] = pt(r.at, R + 18)
        const ly = flat ? ly0 - 10 : ly0
        return (
          <g key={i}>
            {!(line && (r.at === 0 || r.at === 180)) && <line x1={cx} y1={cy} x2={x} y2={y} stroke={INK} strokeWidth="2" />}
            {r.label && <text x={lx} y={ly + 4} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fill={INK}>{r.label}</text>}
          </g>
        )
      })}
      {arcs.map((a, k) => {
        const here = sorted.findIndex((r) => r.i === a.from)
        if (here < 0) return null
        const start = sorted[here]!.at
        const next = sorted[(here + 1) % sorted.length]!.at
        const span = ((next - start) + 360) % 360 || 360
        const mid = start + span / 2
        const r = 34 + (k % 2) * 8
        const [sxp, syp] = pt(start, r)
        const [exp, eyp] = pt(start + span, r)
        const [tx, ty] = pt(mid, r + 22)
        return (
          <g key={`a${k}`}>
            {a.right
              ? <path d={`M${pt(start, 18)[0]} ${pt(start, 18)[1]} L${pt(mid, 25.5)[0]} ${pt(mid, 25.5)[1]} L${pt(start + span, 18)[0]} ${pt(start + span, 18)[1]}`} fill="none" stroke={ACCENT} strokeWidth="2" />
              : <path d={`M${sxp} ${syp} A${r} ${r} 0 ${span > 180 ? 1 : 0} 0 ${exp} ${eyp}`} fill="none" stroke={ACCENT} strokeWidth="2" />}
            <text x={tx} y={ty + 4} textAnchor="middle" fontFamily={DISPLAY} fontSize="14" fontWeight="700" fill={ACCENT}>{a.text}</text>
          </g>
        )
      })}
      <circle cx={cx} cy={cy} r="3" fill={INK} />
    </svg>
  )
}

/** Where each of the eight angles sits, as an offset from its crossing point. */
const SPOTS: Record<string, [number, number]> = {
  a: [-26, -20], b: [26, -20], c: [-26, 22], d: [26, 22],
  e: [-26, -20], f: [26, -20], g: [-26, 22], h: [26, 22],
}

function Parallel({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const labels = (props.labels as Record<string, string> | undefined) ?? {}
  const slope = typeof props.slope === 'number' ? props.slope : 62
  const yTop = 82, yBot = 190
  const m = Math.tan((slope * Math.PI) / 180)
  // The transversal crosses the two parallels at these x values, and is drawn well past both.
  const xTop = W / 2 + (yBot - yTop) / 2 / m, xBot = W / 2 - (yBot - yTop) / 2 / m
  const ext = 46
  const arrow = (y: number, x: number) => (
    <path d={`M${x - 7} ${y - 6} L${x + 3} ${y} L${x - 7} ${y + 6}`} fill="none" stroke={INK_2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  )
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 460 }} role="img" aria-label={alt}>
      <line x1={24} y1={yTop} x2={W - 24} y2={yTop} stroke={INK} strokeWidth="2" />
      <line x1={24} y1={yBot} x2={W - 24} y2={yBot} stroke={INK} strokeWidth="2" />
      {arrow(yTop, 76)}{arrow(yTop, 92)}
      {arrow(yBot, 76)}{arrow(yBot, 92)}
      <line x1={xTop + ext / m} y1={yTop - ext} x2={xBot - ext / m} y2={yBot + ext} stroke={INK} strokeWidth="2" />
      <circle cx={xTop} cy={yTop} r="3" fill={INK} />
      <circle cx={xBot} cy={yBot} r="3" fill={INK} />
      {Object.entries(labels).map(([key, text]) => {
        const spot = SPOTS[key]
        if (!spot) return null
        const top = 'abcd'.includes(key)
        return (
          <text key={key} x={(top ? xTop : xBot) + spot[0]} y={(top ? yTop : yBot) + spot[1]} textAnchor="middle" fontFamily={DISPLAY} fontSize="14" fontWeight="700" fill={ACCENT}>{text}</text>
        )
      })}
    </svg>
  )
}
