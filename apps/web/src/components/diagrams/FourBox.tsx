import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

interface Box {
  title: string
  /** Up to three short points shown under the title. */
  points?: string[]
}

/**
 * Four labelled boxes around a centre label: the marketing mix's four Ps, the four
 * parts of a business plan, a SWOT grid. The point is that the four belong together
 * and pull on one thing in the middle. Props: { centre: string, boxes: Box[] (four) }.
 */
export function FourBox({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const centre = String(props.centre ?? '')
  const boxes = ((props.boxes as Box[] | undefined) ?? []).slice(0, 4)
  const W = 480
  const H = 300
  const bw = 186
  const bh = 118
  const gap = 96
  const positions = [
    [W / 2 - bw - gap / 2, 14],
    [W / 2 + gap / 2, 14],
    [W / 2 - bw - gap / 2, H - bh - 14],
    [W / 2 + gap / 2, H - bh - 14],
  ]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 520 }} role="img" aria-label={alt}>
      {boxes.map((b, i) => {
        const [x, y] = positions[i]!
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={bh} rx="10" fill="var(--subject-soft)" stroke={RULE} />
            <text x={x + 14} y={y + 24} fontFamily={DISPLAY} fontSize="15" fontWeight="700" fill={ACCENT}>{b.title}</text>
            {(b.points ?? []).slice(0, 3).map((p, j) => (
              <text key={j} x={x + 14} y={y + 48 + j * 20} fontFamily={FONT} fontSize="12" fill={INK_2}>• {p}</text>
            ))}
          </g>
        )
      })}
      {centre && (() => {
        // A two-word label goes on two lines so it stays inside the circle.
        const words = centre.split(' ')
        const lines = words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [centre]
        return (
          <g>
            <circle cx={W / 2} cy={H / 2} r="44" fill="#fff" stroke={ACCENT} strokeWidth="2.5" />
            {lines.map((l, i) => (
              <text key={i} x={W / 2} y={H / 2 + (lines.length === 1 ? 5 : i === 0 ? -3 : 15)} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>{l}</text>
            ))}
          </g>
        )
      })()}
    </svg>
  )
}
