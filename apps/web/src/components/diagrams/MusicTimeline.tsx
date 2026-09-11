import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

interface Section {
  /** Where the section starts, in seconds from the beginning of the track. */
  start: number
  label: string
  /** What to listen for here. */
  note?: string
}

/**
 * The structure of a set work along a timeline, so a student can play the recording on
 * whatever service the family uses and follow the map while it runs. Section widths are
 * proportional to their real length, which is the point: seeing that a chorus is half
 * the length of a verse tells you something a list of section names does not.
 *
 * Props: `title`, `duration` in seconds, and `sections` in order.
 */
export function MusicTimeline({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const title = String(props.title ?? '')
  const duration = Number(props.duration ?? 180)
  const sections = ((props.sections as Section[] | undefined) ?? []).slice().sort((a, b) => a.start - b.start)

  const W = 460
  const rowH = 22
  const barY = 44
  const barH = 30
  const left = 12
  const right = W - 12
  const span = right - left
  const H = barY + barH + 16 + sections.length * rowH + 8

  const x = (t: number) => left + Math.max(0, Math.min(1, t / duration)) * span
  const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`
  // Alternate the tint so neighbouring sections are distinguishable without a legend.
  const fill = (i: number) => (i % 2 === 0 ? 'var(--subject-soft)' : '#ffffff')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 520 }} role="img" aria-label={alt}>
      {title && <text x={left} y={16} fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>{title}</text>}
      <text x={right} y={16} textAnchor="end" fontFamily={FONT} fontSize="11" fill={INK_2}>{mmss(duration)}</text>

      {sections.map((s, i) => {
        const x0 = x(s.start)
        const x1 = i + 1 < sections.length ? x(sections[i + 1]!.start) : right
        const w = Math.max(2, x1 - x0)
        return (
          <g key={i}>
            <rect x={x0} y={barY} width={w} height={barH} fill={fill(i)} stroke={RULE} />
            {/* Only label inside the bar when the section is wide enough to hold it. */}
            {w > 34 && (
              <text x={x0 + w / 2} y={barY + 19} textAnchor="middle" fontFamily={DISPLAY} fontSize="10" fontWeight="700" fill={INK}>
                {i + 1}
              </text>
            )}
          </g>
        )
      })}
      <rect x={left} y={barY} width={span} height={barH} fill="none" stroke={INK} strokeWidth="1.5" />

      {sections.map((s, i) => (
        <g key={`k${i}`}>
          <text x={left} y={barY + barH + 26 + i * rowH} fontFamily={FONT} fontSize="11" fill={INK_2} className="tabular-nums">
            {i + 1}. {mmss(s.start)}
          </text>
          <text x={left + 62} y={barY + barH + 26 + i * rowH} fontFamily={DISPLAY} fontSize="11.5" fontWeight="700" fill={ACCENT}>
            {s.label}
          </text>
          {s.note && (
            <text x={left + 62 + s.label.length * 6.6 + 8} y={barY + barH + 26 + i * rowH} fontFamily={FONT} fontSize="11" fill={INK_2}>
              {s.note}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}
