import { ACCENT, DISPLAY, FONT, INK, INK_2 } from './index.tsx'

/**
 * base^index as a row of boxes with the product underneath. The box narrows as `index`
 * grows so the row still fits the 298 CSS px a diagram figure leaves on a 390px phone
 * (`Visual.tsx`): five boxes at their old fixed 44-unit width and 26-unit gap drew a
 * 364-unit row, and below its natural width a diagram stops shrinking and scrolls instead.
 */
export function RepeatedMultiplication({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const base = Number(props.base ?? 2)
  const index = Math.max(1, Math.min(8, Number(props.index ?? 5)))
  const value = Math.pow(base, index)
  // Room for the × between boxes: at 10, an 18px sign touched the boxes on both sides.
  const gap = 18
  const boxW = Math.min(44, Math.floor((250 - (index - 1) * gap) / index))
  const width = index * boxW + (index - 1) * gap + 40

  // The summary sentence used to sit on one line: at a narrower drawing it no longer fits,
  // so it wraps the same way EquationCard and RootNumberLine do, rather than shrinking
  // below the 11px floor.
  const sentence = `${index} lots of ${base} multiplied together = ${value.toLocaleString('en-GB')}`
  const SENT_SIZE = 14
  const room = width - 24
  const words = sentence.split(' ')
  const lines: string[] = []
  let line = words[0]!
  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`
    if (candidate.length * SENT_SIZE * 0.6 <= room) line = candidate
    else { lines.push(line); line = word }
  }
  lines.push(line)
  const height = 130 + lines.length * 18

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width * 1.4 }} role="img" aria-label={alt}>
      <text x={width / 2} y="26" textAnchor="middle" fontFamily={DISPLAY} fontSize="20" fontWeight="700" fill={INK}>
        {base}<tspan baselineShift="super" fontSize="13">{index}</tspan>
      </text>
      {Array.from({ length: index }, (_, i) => {
        const x = 20 + i * (boxW + gap)
        return (
          <g key={i}>
            <rect x={x} y="48" width={boxW} height={boxW} rx="8" fill="var(--subject-soft)" stroke={ACCENT} strokeWidth="2" />
            <text x={x + boxW / 2} y="77" textAnchor="middle" fontFamily={DISPLAY} fontSize="20" fontWeight="700" fill={INK}>{base}</text>
            {i < index - 1 && <text x={x + boxW + gap / 2} y="75" textAnchor="middle" fontFamily={FONT} fontSize="14" fill={INK_2}>×</text>}
          </g>
        )
      })}
      {lines.map((text, i) => (
        <text key={i} x={width / 2} y={128 + i * 18} textAnchor="middle" fontFamily={FONT} fontSize="14" fill={INK_2}>{text}</text>
      ))}
    </svg>
  )
}
