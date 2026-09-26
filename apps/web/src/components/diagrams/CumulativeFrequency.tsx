import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

interface Point {
  /** The upper bound of the class, which is where its cumulative frequency is plotted. */
  x: number
  y: number
}
interface Reading {
  /** The cumulative frequency to read across from: n/2 for the median, n/4 and 3n/4 for the quartiles. */
  y: number
  label: string
}

/**
 * A title too long for one line at phone width wraps onto two rather than pushing the
 * viewBox wider: "Heights of 200 children of the same age" is 39 characters, and even
 * the full 296-unit budget only holds about 34 at this font size.
 */
function wrapTitle(text: string, maxChars: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (next.length > maxChars && line) {
      lines.push(line)
      line = w
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

/**
 * A cumulative frequency graph: the running total plotted at each upper class bound,
 * joined point to point. Readings are drawn the way a student takes them with a
 * ruler: across from a cumulative frequency to the line, then down to the axis. The
 * value read off is worked out here by interpolating the same segments the picture
 * draws, so the number printed can never disagree with the line it was read from.
 *
 * Props: { points: Point[], readings?: Reading[], xLabel?, yLabel?, title? }
 */
export function CumulativeFrequency({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const points = ((props.points as Point[] | undefined) ?? []).slice().sort((a, b) => a.x - b.x)
  if (points.length < 2) return <p>{alt}</p>
  const readings = (props.readings as Reading[] | undefined) ?? []
  const xLabel = String(props.xLabel ?? '')
  const yLabel = String(props.yLabel ?? 'cumulative frequency')
  const title = props.title as string | undefined

  const xMin = points[0]!.x
  const xMax = points[points.length - 1]!.x
  const yTop = Math.max(...points.map((p) => p.y), 1)
  const rawStep = yTop / 5
  const mag = 10 ** Math.floor(Math.log10(rawStep))
  const yStep = [1, 2, 5, 10].map((k) => k * mag).find((s) => s >= rawStep) ?? 10 * mag
  const yMax = Math.ceil(yTop / yStep) * yStep
  const yTicks: number[] = []
  for (let v = 0; v <= yMax + yStep / 1000; v = Number((v + yStep).toFixed(6))) yTicks.push(v)

  // 284 wide: the drawing stops shrinking at its natural width, and a 460-wide graph
  // scrolled on a phone.
  const W = 284, H = 320
  const titleLines = title ? wrapTitle(title, 34) : []
  const left = 48, right = 14, top = title ? (titleLines.length > 1 ? 48 : 32) : 18, bottom = 48
  // Both scales clamp, so a reading beyond the data draws at the edge of the axes.
  const sx = (x: number) => left + ((Math.min(Math.max(x, xMin), xMax) - xMin) / (xMax - xMin)) * (W - left - right)
  const sy = (y: number) => H - bottom - (Math.min(Math.max(y, 0), yMax) / yMax) * (H - top - bottom)
  const fmt = (v: number) => String(Number(v.toFixed(2)))

  /** The x at which the plotted line reaches a cumulative frequency, by linear interpolation. */
  const readX = (y: number): number | undefined => {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!, b = points[i]!
      if (y >= Math.min(a.y, b.y) && y <= Math.max(a.y, b.y) && b.y !== a.y) {
        return a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x)
      }
    }
    return undefined
  }

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 420 }} role="img" aria-label={alt}>
      {titleLines.map((line, i) => (
        <text key={`ti${i}`} x={W / 2} y={20 + i * 15} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>
          {line}
        </text>
      ))}
      {yTicks.map((v, i) => (
        <g key={`y${i}`}>
          <line x1={left} y1={sy(v)} x2={W - right} y2={sy(v)} stroke={RULE} />
          <text x={left - 8} y={sy(v) + 4} textAnchor="end" fontFamily={FONT} fontSize="11" fill={INK_2}>
            {fmt(v)}
          </text>
        </g>
      ))}
      {/* The curve before the readings, so a reading's label sits over the curve on its halo
          rather than under it: on a phone the curve ran through "75th centile ≈ 144.26". */}
      <path d={path} fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={`p${i}`} cx={sx(p.x)} cy={sy(p.y)} r="3.5" fill={ACCENT} />
      ))}
      {(() => {
        /*
         * Two things about reading labels, both learned from a median and a quartile taken
         * close together — the commonest pair a question asks for.
         *
         * They used to share one line just above the axis, so two close readings printed
         * one label on top of the other. Each now takes the lowest free row.
         *
         * And every dashed line is drawn before any label, rather than each reading
         * drawing its own line and then its own label. Otherwise the second reading's drop
         * line is painted over the first reading's text, which is what happened here: the
         * line went through the digits. The halo is the same one the other diagrams use.
         */
        const placed: { left: number; right: number; row: number }[] = []
        const marks = readings.flatMap((r, i) => {
          const x = readX(r.y)
          if (x === undefined) return []
          const text = `${r.label} ≈ ${fmt(x)}`
          const estWidth = text.length * 11 * 0.55
          // A reading taken near the right of a narrower phone graph pushed its label
          // past the edge, so a label with no room to grow rightwards grows left instead.
          const goLeft = sx(x) + 5 + estWidth > W - 4
          const tx = goLeft ? sx(x) - 5 : sx(x) + 5
          const anchor = goLeft ? ('end' as const) : ('start' as const)
          const box = goLeft ? { left: tx - estWidth, right: tx } : { left: tx, right: tx + estWidth }
          let row = 0
          while (placed.some((q) => q.row === row && box.left < q.right + 4 && q.left < box.right + 4)) row++
          placed.push({ ...box, row })
          return [{ i, r, x, text, tx, anchor, row }]
        })
        return (
          <>
            {marks.map(({ i, r, x }) => (
              <g key={`rl${i}`}>
                <line x1={left} y1={sy(r.y)} x2={sx(x)} y2={sy(r.y)} stroke={INK_2} strokeWidth="1.5" strokeDasharray="5 4" />
                <line x1={sx(x)} y1={sy(r.y)} x2={sx(x)} y2={H - bottom} stroke={INK_2} strokeWidth="1.5" strokeDasharray="5 4" />
              </g>
            ))}
            {marks.map(({ i, text, tx, anchor, row }) => (
              <text key={`rt${i}`} x={tx} y={H - bottom - 6 - row * 15} textAnchor={anchor} fontFamily={DISPLAY} fontSize="11" fontWeight="700" fill={INK} stroke="#ffffff" strokeWidth="3.5" paintOrder="stroke">
                {text}
              </text>
            ))}
          </>
        )
      })()}
      <line x1={left} y1={H - bottom} x2={W - right} y2={H - bottom} stroke={INK} strokeWidth="2" />
      <line x1={left} y1={top} x2={left} y2={H - bottom} stroke={INK} strokeWidth="2" />
      {points.map((p, i) => (
        <g key={`x${i}`}>
          <line x1={sx(p.x)} y1={H - bottom} x2={sx(p.x)} y2={H - bottom + 5} stroke={INK} />
          <text x={sx(p.x)} y={H - bottom + 18} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>
            {fmt(p.x)}
          </text>
        </g>
      ))}
      {xLabel && (
        <text x={(left + W - right) / 2} y={H - 8} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>
          {xLabel}
        </text>
      )}
      <text
        x={14} y={(top + H - bottom) / 2} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}
        transform={`rotate(-90 14 ${(top + H - bottom) / 2})`}
      >
        {yLabel}
      </text>
    </svg>
  )
}
