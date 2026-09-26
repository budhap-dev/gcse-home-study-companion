import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

/**
 * A number line that traps a root between the two whole numbers either side of it,
 * which is how an estimate is argued in an exam: name the squares below and above,
 * then say the root must lie between their roots.
 *
 * Props: `value` (the number under the root), `index` (2 for a square root, 3 for a
 * cube root), `from` and `to` (the whole numbers at each end of the line).
 *
 * Drawn at 280 units, narrower than its old fixed 460, so it fits the 298 CSS px a diagram
 * figure leaves on a 390px phone (`Visual.tsx`). The sentence along the bottom is the part
 * that used to force the width: at full length it only fits a line this narrow by wrapping
 * onto two lines, the same word-wrap `EquationCard` uses, rather than by shrinking below
 * the 11px floor.
 */
export function RootNumberLine({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const value = Number(props.value ?? 50)
  const index = Number(props.index ?? 2)
  const root = Math.pow(value, 1 / index)
  const from = Math.floor(Number(props.from ?? Math.floor(root) - 1))
  const to = Math.ceil(Number(props.to ?? Math.ceil(root) + 1))
  const below = Math.floor(root)
  const above = Math.ceil(root)

  const W = 280
  const pad = 24
  const x = (n: number) => pad + ((n - from) / (to - from)) * (W - 2 * pad)
  const y = 96
  const ticks = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  const sign = index === 3 ? '∛' : '√'
  const power = (n: number) => (index === 3 ? `${n}³` : `${n}²`)

  const sentence = `${value} is between ${Math.pow(below, index)} and ${Math.pow(above, index)}, so ${sign}${value} is between ${below} and ${above}`
  const SENTENCE_SIZE = 13
  const SENTENCE_RATIO = 0.52
  const sentenceRoom = W - 28
  // Greedy word wrap, as EquationCard uses: a word longer than the line overhangs its own
  // line rather than being broken mid-symbol.
  const words = sentence.split(' ')
  const sentenceLines: string[] = []
  let line = words[0]!
  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`
    if (candidate.length * SENTENCE_SIZE * SENTENCE_RATIO <= sentenceRoom) line = candidate
    else { sentenceLines.push(line); line = word }
  }
  sentenceLines.push(line)
  const H = 168 + (sentenceLines.length - 1) * 16

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 340 }} role="img" aria-label={alt}>
      {/* the band between the two bounding whole numbers */}
      <rect x={x(below)} y={y - 22} width={x(above) - x(below)} height="44" rx="8" fill="var(--subject-soft)" />

      <line x1={pad} y1={y} x2={W - pad} y2={y} stroke={INK} strokeWidth="1.5" />
      {ticks.map((n) => {
        const bound = n === below || n === above
        return (
          <g key={n}>
            <line x1={x(n)} y1={y - 8} x2={x(n)} y2={y + 8} stroke={bound ? ACCENT : RULE} strokeWidth={bound ? 2.5 : 1.5} />
            <text x={x(n)} y={y + 28} textAnchor="middle" fontFamily={DISPLAY} fontSize="15" fontWeight={bound ? 700 : 400} fill={bound ? INK : INK_2}>{n}</text>
            {bound && (
              <text x={x(n)} y={y + 48} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>
                {power(n)} = {Math.pow(n, index)}
              </text>
            )}
          </g>
        )
      })}

      {/* where the root actually sits */}
      <g>
        <line x1={x(root)} y1={y - 40} x2={x(root)} y2={y + 8} stroke={ACCENT} strokeWidth="2" strokeDasharray="4 3" />
        <circle cx={x(root)} cy={y} r="5.5" fill="#fff" stroke={ACCENT} strokeWidth="3" />
        <text x={x(root)} y={y - 48} textAnchor="middle" fontFamily={DISPLAY} fontSize="17" fontWeight="700" fill={INK}>
          {sign}{value}
        </text>
      </g>

      {sentenceLines.map((text, i) => (
        <text
          key={i}
          x={W / 2}
          y={H - 6 - (sentenceLines.length - 1 - i) * 16}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="13"
          fill={INK_2}
        >
          {text}
        </text>
      ))}
    </svg>
  )
}
