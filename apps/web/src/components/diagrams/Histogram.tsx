import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

interface Bar {
  /** Class interval, lower bound to upper bound. */
  from: number
  to: number
  frequency: number
}

/**
 * A title too long for one line at phone width wraps onto two rather than pushing the
 * viewBox wider: "Drawn properly: area is the number of people" is 45 characters.
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
 * A histogram with unequal class widths, drawn from the frequencies alone. The height
 * of each bar is the **frequency density**, frequency divided by class width, and the
 * component works that out itself rather than taking it as a prop, so the picture can
 * never disagree with the table beside it. Area is frequency, which is the whole point
 * of the diagram and the thing an exam question turns on.
 *
 * Props: { bars: Bar[], xLabel?, yLabel?, highlight?: number (index), title? }
 */
export function Histogram({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const bars = (props.bars as Bar[] | undefined) ?? []
  if (bars.length === 0) return <p>{alt}</p>
  const xLabel = String(props.xLabel ?? '')
  const yLabel = String(props.yLabel ?? 'frequency density')
  const title = props.title as string | undefined
  const highlight = typeof props.highlight === 'number' ? props.highlight : -1

  const density = bars.map((b) => b.frequency / (b.to - b.from))
  const minX = Math.min(...bars.map((b) => b.from))
  const maxX = Math.max(...bars.map((b) => b.to))
  const maxD = Math.max(...density)

  // 284 wide: the drawing stops shrinking at its natural width, and a 460-wide chart
  // scrolled on a phone. "Drawn properly: area is the number of people" (45 characters)
  // is too long for one line even at the full 296-unit budget, so a title wraps.
  const W = 284, H = 300
  const titleLines = title ? wrapTitle(title, 34) : []
  const left = 48, right = 14, top = title ? (titleLines.length > 1 ? 46 : 30) : 18, bottom = 48
  const sx = (x: number) => left + ((x - minX) / (maxX - minX)) * (W - left - right)
  const sy = (d: number) => H - bottom - (d / (maxD * 1.12)) * (H - top - bottom)

  // A tick every whole unit of density while that stays readable, else four ticks.
  const step = maxD <= 4 ? (maxD <= 1 ? 0.2 : 0.5) : Math.ceil(maxD / 4)
  const ticks: number[] = []
  for (let d = 0; d <= maxD * 1.12; d = Number((d + step).toFixed(4))) ticks.push(d)

  const fmt = (v: number) => String(Number(v.toFixed(2)))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 420 }} role="img" aria-label={alt}>
      {titleLines.map((line, i) => (
        <text key={`ti${i}`} x={W / 2} y={18 + i * 15} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>
          {line}
        </text>
      ))}
      {ticks.map((d, i) => (
        <g key={`t${i}`}>
          <line x1={left} y1={sy(d)} x2={W - right} y2={sy(d)} stroke={RULE} />
          <text x={left - 8} y={sy(d) + 4} textAnchor="end" fontFamily={FONT} fontSize="11" fill={INK_2}>
            {fmt(d)}
          </text>
        </g>
      ))}
      {bars.map((b, i) => {
        const x = sx(b.from), w = sx(b.to) - sx(b.from), y = sy(density[i]!)
        const on = i === highlight
        return (
          <g key={`b${i}`}>
            <rect
              x={x} y={y} width={w} height={H - bottom - y}
              fill={ACCENT} fillOpacity={on ? 0.55 : 0.25} stroke={ACCENT} strokeWidth="2"
            />
            <text x={x + w / 2} y={y - 6} textAnchor="middle" fontFamily={DISPLAY} fontSize="11" fontWeight="700" fill={INK}>
              {fmt(density[i]!)}
            </text>
          </g>
        )
      })}
      <line x1={left} y1={H - bottom} x2={W - right} y2={H - bottom} stroke={INK} strokeWidth="2" />
      <line x1={left} y1={top} x2={left} y2={H - bottom} stroke={INK} strokeWidth="2" />
      {[...new Set(bars.flatMap((b) => [b.from, b.to]))].sort((a, b) => a - b).map((v, i) => (
        <g key={`x${i}`}>
          <line x1={sx(v)} y1={H - bottom} x2={sx(v)} y2={H - bottom + 5} stroke={INK} />
          <text x={sx(v)} y={H - bottom + 18} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>
            {fmt(v)}
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
