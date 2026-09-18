import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'
import { CHAR_WIDTH, wrapCell } from './tableLayout.ts'

interface Bar {
  label: string
  value: number
  /** Printed on the bar instead of the raw number: "801 °C", "2.4 MB", "40 cm". */
  display?: string
  /** A short line under the label, for what the number means. */
  note?: string
}

/**
 * Two or three quantities as bars drawn to true proportion, for the real-world examples
 * described in docs/real-world-examples.md.
 *
 * True proportion is the whole point and the reason this is a component rather than a
 * table. A text message beside a photograph is a bar you can barely see beside one that
 * fills the width, and that picture makes the argument before a word of it is read. A
 * table of the same two numbers does not.
 *
 * So the bar lengths are linear in the values, never rescaled to look tidy: a tiny bar
 * is information, not a layout problem. The only concession is a one-pixel floor, so a
 * value that rounds to nothing still shows it exists.
 *
 * Props: { bars: Bar[] (two or three), caption?: string }
 */
export function SizeCompare({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const bars = ((props.bars as Bar[] | undefined) ?? []).slice(0, 3)
  const caption = String(props.caption ?? '')
  const W = 460
  const labelW = 150
  const trackX = labelW + 10
  const trackW = W - trackX - 12
  const rowH = 46
  const barH = 22
  const top = 10
  const H = top + bars.length * rowH + (caption ? 26 : 6)

  const max = Math.max(1, ...bars.map((b) => Math.abs(b.value)))
  // Linear, so the comparison the reader makes by eye is the comparison in the numbers.
  const widthOf = (v: number) => (Math.abs(v) <= 0 ? 0 : Math.max(1, (Math.abs(v) / max) * trackW))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 520 }} role="img" aria-label={alt}>
      {bars.map((b, i) => {
        const y = top + i * rowH
        const w = widthOf(b.value)
        const text = b.display ?? String(b.value)
        // The value sits inside the bar when it fits and just outside when it does not,
        // which is what keeps a very small bar's number readable.
        const inside = w > text.length * CHAR_WIDTH + 16
        const label = wrapCell(b.label, Math.floor(labelW / CHAR_WIDTH))
        return (
          <g key={i}>
            {label.slice(0, 2).map((line, j) => (
              <text key={j} x={0} y={y + 16 + j * 13} fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>
                {line}
              </text>
            ))}
            {b.note && (
              <text x={0} y={y + 16 + Math.min(label.length, 2) * 13} fontFamily={FONT} fontSize="11" fill={INK_2}>
                {b.note}
              </text>
            )}
            <rect x={trackX} y={y + 2} width={trackW} height={barH} rx="4" fill="var(--subject-soft)" stroke={RULE} />
            <rect x={trackX} y={y + 2} width={w} height={barH} rx="4" fill="var(--subject, #1f3a93)" />
            <text
              x={inside ? trackX + w - 8 : trackX + w + 8}
              y={y + 18}
              textAnchor={inside ? 'end' : 'start'}
              fontFamily={DISPLAY}
              fontSize="12"
              fontWeight="700"
              fill={inside ? '#ffffff' : ACCENT}
            >
              {text}
            </text>
          </g>
        )
      })}
      {caption && (
        <text x={0} y={H - 8} fontFamily={FONT} fontSize="11" fill={INK_2}>
          {caption}
        </text>
      )}
    </svg>
  )
}
