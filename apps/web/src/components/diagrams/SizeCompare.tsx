import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'
import { wrapCell } from './tableLayout.ts'

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
 * The drawing is narrower than a phone card. It used to be 460 units wide with the label
 * beside the bar, and since a diagram stops shrinking at its natural width and scrolls
 * sideways instead (see stopShrinkingBelowNaturalWidth), a 390px phone showed the first
 * 298 of those units: the value printed at the end of the longest bar — the number the
 * picture exists to show — sat in the hidden strip on every phone, for all 97 of them.
 * The label now sits above its bar, so the bar takes the full width and the whole thing
 * fits in 296 units. Long captions wrap for the same reason.
 *
 * Props: { bars: Bar[] (two or three), caption?: string }
 */
const W = 296
const PAD = 4
const TRACK_W = W - 2 * PAD
const BAR_H = 22
/** Roughly how wide a character is, for the bold display face and the body face. */
const DISPLAY_RATIO = 0.58
const BODY_RATIO = 0.52
const LABEL_PX = 13
const NOTE_PX = 11
const VALUE_PX = 12
const CAPTION_PX = 11
const LINE = 15

export function SizeCompare({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const bars = ((props.bars as Bar[] | undefined) ?? []).slice(0, 3)
  const caption = String(props.caption ?? '')
  const max = Math.max(1, ...bars.map((b) => Math.abs(b.value)))
  // Linear, so the comparison the reader makes by eye is the comparison in the numbers.
  const widthOf = (v: number) => (Math.abs(v) <= 0 ? 0 : Math.max(1, (Math.abs(v) / max) * TRACK_W))

  const labelBudget = Math.floor(TRACK_W / (LABEL_PX * DISPLAY_RATIO))
  const noteBudget = Math.floor(TRACK_W / (NOTE_PX * BODY_RATIO))
  const rows = bars.map((b) => {
    const label = wrapCell(b.label, labelBudget).slice(0, 2)
    const note = b.note ? wrapCell(b.note, noteBudget).slice(0, 2) : []
    const barTop = label.length * LINE + note.length * (NOTE_PX + 3) + 4
    return { ...b, label, note, barTop, height: barTop + BAR_H + 10 }
  })
  const captionLines = caption ? wrapCell(caption, Math.floor(TRACK_W / (CAPTION_PX * BODY_RATIO))) : []

  const tops: number[] = []
  let y = 8
  for (const r of rows) { tops.push(y); y += r.height }
  const captionTop = y
  const H = captionTop + captionLines.length * (CAPTION_PX + 3) + (captionLines.length ? 6 : 0)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 380 }} role="img" aria-label={alt}>
      {rows.map((r, i) => {
        const top = tops[i]!
        const w = widthOf(r.value)
        const text = r.display ?? String(r.value)
        const textW = text.length * VALUE_PX * DISPLAY_RATIO
        // The value sits inside the bar when it fits, just outside when it does not, and
        // at the end of the track when even that would run off the drawing — so it can
        // never be cut off, which is the defect this layout replaced.
        const inside = w > textW + 16
        const outsideFits = PAD + w + 8 + textW <= W - PAD
        const barY = top + r.barTop
        return (
          <g key={i}>
            {r.label.map((line, j) => (
              <text key={`l${j}`} x={PAD} y={top + LABEL_PX + j * LINE} fontFamily={DISPLAY} fontSize={LABEL_PX} fontWeight="700" fill={INK}>
                {line}
              </text>
            ))}
            {r.note.map((line, j) => (
              <text key={`n${j}`} x={PAD} y={top + r.label.length * LINE + NOTE_PX + j * (NOTE_PX + 3)} fontFamily={FONT} fontSize={NOTE_PX} fill={INK_2}>
                {line}
              </text>
            ))}
            <rect x={PAD} y={barY} width={TRACK_W} height={BAR_H} rx="4" fill="var(--subject-soft)" stroke={RULE} />
            <rect x={PAD} y={barY} width={w} height={BAR_H} rx="4" fill="var(--subject, #1f3a93)" />
            <text
              x={inside ? PAD + w - 8 : outsideFits ? PAD + w + 8 : W - PAD}
              y={barY + 16}
              textAnchor={inside || !outsideFits ? 'end' : 'start'}
              fontFamily={DISPLAY}
              fontSize={VALUE_PX}
              fontWeight="700"
              fill={inside ? '#ffffff' : ACCENT}
            >
              {text}
            </text>
          </g>
        )
      })}
      {captionLines.map((line, j) => (
        <text key={`c${j}`} x={PAD} y={captionTop + CAPTION_PX + j * (CAPTION_PX + 3)} fontFamily={FONT} fontSize={CAPTION_PX} fill={INK_2}>
          {line}
        </text>
      ))}
    </svg>
  )
}
