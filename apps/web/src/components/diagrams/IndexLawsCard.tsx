import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

const LAWS: [string, string, string][] = [
  ['Multiply', 'aᵐ × aⁿ = aᵐ⁺ⁿ', '2³ × 2⁴ = 2⁷'],
  ['Divide', 'aᵐ ÷ aⁿ = aᵐ⁻ⁿ', '5⁷ ÷ 5⁴ = 5³'],
  ['Power of a power', '(aᵐ)ⁿ = aᵐⁿ', '(x³)⁴ = x¹²'],
  ['Zero and negative', 'a⁰ = 1, a⁻ⁿ = 1/aⁿ', '2⁻³ = 1/8'],
  ['Fraction', 'aᵐ/ⁿ = (ⁿ√a)ᵐ', '27²/³ = 9'],
]

/**
 * Summary card of the five index laws, one example each. Each law is stacked (name, then
 * rule, then example) rather than set in three columns across a 520-unit row, so the card
 * fits the 298 CSS px a diagram figure leaves on a 390px phone (`Visual.tsx`): below its
 * natural width a diagram stops shrinking and scrolls instead.
 */
export function IndexLawsCard({ alt }: { props: Record<string, unknown>; alt: string }) {
  const W = 280
  const PAD = 16
  const ROW_H = 70
  const H = LAWS.length * ROW_H + 24
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 340 }} role="img" aria-label={alt}>
      <rect x="1" y="1" width={W - 2} height={H - 2} rx="14" fill="#fff" stroke={RULE} />
      {LAWS.map(([name, rule, eg], i) => {
        const y = 12 + i * ROW_H
        return (
          <g key={name}>
            {i > 0 && <line x1="16" y1={y} x2={W - 16} y2={y} stroke={RULE} />}
            <text x={PAD} y={y + 18} fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={ACCENT}>{name}</text>
            <text x={PAD} y={y + 40} fontFamily={FONT} fontSize="17" fill={INK}>{rule}</text>
            <text x={PAD} y={y + 58} fontFamily={FONT} fontSize="13" fill={INK_2}>{eg}</text>
          </g>
        )
      })}
    </svg>
  )
}
