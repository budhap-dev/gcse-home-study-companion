import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

const LAWS: [string, string, string][] = [
  ['Multiply', 'aᵐ × aⁿ = aᵐ⁺ⁿ', '2³ × 2⁴ = 2⁷'],
  ['Divide', 'aᵐ ÷ aⁿ = aᵐ⁻ⁿ', '5⁷ ÷ 5⁴ = 5³'],
  ['Power of a power', '(aᵐ)ⁿ = aᵐⁿ', '(x³)⁴ = x¹²'],
  ['Zero and negative', 'a⁰ = 1, a⁻ⁿ = 1/aⁿ', '2⁻³ = 1/8'],
  ['Fraction', 'aᵐ/ⁿ = (ⁿ√a)ᵐ', '27²/³ = 9'],
]

/** Summary card of the five index laws, one example each. */
export function IndexLawsCard({ alt }: { props: Record<string, unknown>; alt: string }) {
  const rowH = 44
  return (
    <svg viewBox={`0 0 520 ${LAWS.length * rowH + 24}`} width="100%" style={{ maxWidth: 560 }} role="img" aria-label={alt}>
      <rect x="1" y="1" width="518" height={LAWS.length * rowH + 22} rx="14" fill="#fff" stroke={RULE} />
      {LAWS.map(([name, rule, eg], i) => {
        const y = 12 + i * rowH
        return (
          <g key={name}>
            {i > 0 && <line x1="16" y1={y} x2="504" y2={y} stroke={RULE} />}
            <text x="20" y={y + 28} fontFamily={DISPLAY} fontSize="14" fontWeight="700" fill={ACCENT}>{name}</text>
            <text x="180" y={y + 28} fontFamily={FONT} fontSize="17" fill={INK}>{rule}</text>
            <text x="400" y={y + 28} fontFamily={FONT} fontSize="15" fill={INK_2}>{eg}</text>
          </g>
        )
      })}
    </svg>
  )
}
