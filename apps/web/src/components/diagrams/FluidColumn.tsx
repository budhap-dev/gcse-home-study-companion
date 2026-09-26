import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

interface Submerged {
  /** Depth of the top face in metres. */
  top: number
  /** Height of the block in metres. */
  height: number
}

/**
 * A tank of liquid with pressure arrows that grow with depth, which is the whole of
 * p = hρg made visible. With `object`, a block hangs in the liquid and the arrow
 * under it is drawn longer than the one on top: the difference is upthrust.
 * Props: { depth: m, density: kg/m³, g, marks: m[] (depths to label), object?: Submerged }.
 *
 * The tank and its arrows used to leave 500 units of width for a drawing that only
 * needed about 270: the tank was 200 wide, arrows reached 96 further, and their kPa
 * labels ran on again after that. Narrowing the tank and the arrows' reach fixes most
 * of it; the caption underneath is the other half — it is a full sentence, and at any
 * width narrow enough for a phone that sentence is wider than the canvas, so it now
 * wraps onto as many lines as it needs rather than running past the edge.
 */
export function FluidColumn({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const depth = Number(props.depth ?? 3)
  const density = Number(props.density ?? 1000)
  const g = Number(props.g ?? 9.8)
  const marks = (props.marks as number[] | undefined) ?? [1, 2, 3]
  const object = props.object as Submerged | undefined
  const W = 284
  const tank = { x: 55, y: 30, w: 105, h: 200 }
  const y = (d: number) => tank.y + (d / depth) * tank.h
  const maxArrow = 50
  const arrow = (d: number) => 14 + (d / depth) * (maxArrow - 14)
  const pressure = (d: number) => Math.round(d * density * g)
  // Two decimals under 10 kPa so 1960 Pa reads 1.96 kPa, not 2 kPa.
  const fmt = (p: number) => (p >= 1000 ? `${(p / 1000).toLocaleString('en-GB', { maximumFractionDigits: p < 10000 ? 2 : 1 })} kPa` : `${p} Pa`)

  // Word-wrap the caption to whatever fits the canvas, rather than printing it as one
  // line and letting it run past the edge: the caption is a full sentence and, with
  // ρ and g spelled out, easily 70 to 85 characters long.
  const captionText = object
    ? 'The push from below beats the push from above: the difference is upthrust'
    : `p = hρg with ρ = ${density} kg/m³, g = ${g} N/kg: deeper, more liquid above, more pressure`
  const maxCharsPerLine = 36
  const words = captionText.split(' ')
  const captionLines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length > maxCharsPerLine && line) {
      captionLines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) captionLines.push(line)
  const H = 260 + (captionLines.length - 1) * 14

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 320 }} role="img" aria-label={alt}>
      {/* liquid and tank walls */}
      <rect x={tank.x} y={tank.y} width={tank.w} height={tank.h} fill="var(--subject-soft)" />
      <path d={`M${tank.x} ${tank.y} V${tank.y + tank.h} H${tank.x + tank.w} V${tank.y}`} fill="none" stroke={INK} strokeWidth="2.5" />
      <line x1={tank.x} y1={tank.y} x2={tank.x + tank.w} y2={tank.y} stroke={ACCENT} strokeWidth="2" strokeDasharray="6 4" />
      <text x={tank.x + tank.w / 2} y={tank.y - 8} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>surface</text>

      {/* pressure arrows pushing on the right-hand wall, longer the deeper they are */}
      {marks.map((d) => {
        const yy = y(d)
        const len = arrow(d)
        const x0 = tank.x + tank.w
        return (
          <g key={d}>
            <line x1={x0 + len} y1={yy} x2={x0 + 8} y2={yy} stroke={ACCENT} strokeWidth="3" strokeLinecap="round" />
            <polygon points={`${x0 + 2},${yy} ${x0 + 12},${yy - 6} ${x0 + 12},${yy + 6}`} fill={ACCENT} />
            <text x={x0 + len + 6} y={yy + 4} fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={INK}>{fmt(pressure(d))}</text>
            <line x1={tank.x - 6} y1={yy} x2={tank.x} y2={yy} stroke={INK_2} />
            <text x={tank.x - 10} y={yy + 4} textAnchor="end" fontFamily={FONT} fontSize="12" fill={INK_2}>{d} m</text>
          </g>
        )
      })}

      {/* an object hanging in the liquid, with the two vertical pressure forces on it */}
      {object && (() => {
        const top = y(object.top)
        const bottom = y(object.top + object.height)
        const bx = tank.x + 27
        const bw = 50
        const up = arrow(object.top + object.height) * 0.55
        const down = arrow(object.top) * 0.55
        return (
          <g>
            <rect x={bx} y={top} width={bw} height={bottom - top} rx="4" fill="#fff" stroke={INK} strokeWidth="2" />
            <line x1={bx + bw / 2} y1={top - down} x2={bx + bw / 2} y2={top - 8} stroke={INK_2} strokeWidth="3" strokeLinecap="round" />
            <polygon points={`${bx + bw / 2},${top - 2} ${bx + bw / 2 - 6},${top - 12} ${bx + bw / 2 + 6},${top - 12}`} fill={INK_2} />
            <line x1={bx + bw / 2} y1={bottom + up} x2={bx + bw / 2} y2={bottom + 8} stroke={ACCENT} strokeWidth="3" strokeLinecap="round" />
            <polygon points={`${bx + bw / 2},${bottom + 2} ${bx + bw / 2 - 6},${bottom + 12} ${bx + bw / 2 + 6},${bottom + 12}`} fill={ACCENT} />
            {/* Centred in the tank, and the longer one on two lines: on one line, 10 right of
                centre, "smaller push down" ran across the tank's wall. */}
            <text x={tank.x + tank.w / 2} y={bottom + up + 14} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={ACCENT}>bigger push up</text>
            <text x={tank.x + tank.w / 2} y={top - down - 19} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>smaller push</text>
            <text x={tank.x + tank.w / 2} y={top - down - 6} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>down</text>
          </g>
        )
      })()}

      {captionLines.map((l, i) => (
        <text key={i} x={W / 2} y={H - 8 - (captionLines.length - 1 - i) * 14} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>
          {l}
        </text>
      ))}
      <rect x={tank.x} y={tank.y} width={tank.w} height={tank.h} fill="none" stroke={RULE} />
    </svg>
  )
}
