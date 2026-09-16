import { DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

interface Eq { name: string; equation: string; units: string }

const W = 520
const PAD = 20
/** Roughly how wide a character is, as a fraction of the font size, for these two faces. */
const DISPLAY_RATIO = 0.56
const BODY_RATIO = 0.52
const width = (text: string, size: number, ratio = DISPLAY_RATIO) => text.length * size * ratio

/**
 * A card of equations with units. Props: { equations: Eq[] }. Defaults to the energy pair.
 *
 * The name and units sit on the left and the equation is right-anchored beside them,
 * which works while both are short. Given a long name *and* a long equation the two
 * silently overlapped and became unreadable — several Biology cards did exactly that,
 * because there the "equation" is a sentence rather than a formula. Each row now
 * measures its own text and falls back to a stacked layout when the two would collide,
 * so a card can never print one string on top of another.
 */
export function EquationCard({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const eqs = (props.equations as Eq[] | undefined) ?? [
    { name: 'Kinetic energy', equation: 'Ek = ½ m v²', units: 'J, kg, m/s' },
    { name: 'Gravitational potential energy', equation: 'Ep = m g h', units: 'J, kg, N/kg, m' },
    { name: 'Elastic potential energy', equation: 'Ee = ½ k e²', units: 'J, N/m, m' },
  ]

  // An equation long enough to need the full width is set smaller, as a formula would be.
  const sizeFor = (e: Eq) => (e.equation.length > 34 ? 14 : 20)
  const rows = eqs.map((e) => {
    const size = sizeFor(e)
    const left = Math.max(width(e.name, 12), width(e.units, 12, BODY_RATIO))
    const stacked = left + width(e.equation, size) + 24 > W - 2 * PAD
    return { ...e, size, stacked, height: stacked ? 30 + size + 22 : 46 }
  })

  const tops: number[] = []
  let y = 12
  for (const r of rows) { tops.push(y); y += r.height }
  const H = y + 12

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 560 }} role="img" aria-label={alt}>
      <rect x="1" y="1" width={W - 2} height={H - 2} rx="14" fill="#fff" stroke={RULE} />
      {rows.map((e, i) => {
        const top = tops[i]!
        return (
          <g key={e.name}>
            {i > 0 && <line x1="16" y1={top} x2={W - 16} y2={top} stroke={RULE} />}
            <text x={PAD} y={top + 20} fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill="var(--subject)">{e.name}</text>
            {e.stacked ? (
              <>
                <text x={PAD} y={top + 24 + e.size} fontFamily={DISPLAY} fontSize={e.size} fontWeight="700" fill={INK}>{e.equation}</text>
                <text x={PAD} y={top + 44 + e.size} fontFamily={FONT} fontSize="12" fill={INK_2}>{e.units}</text>
              </>
            ) : (
              <>
                <text x={PAD} y={top + 38} fontFamily={FONT} fontSize="12" fill={INK_2}>{e.units}</text>
                <text x={W - PAD} y={top + 30} textAnchor="end" fontFamily={DISPLAY} fontSize={e.size} fontWeight="700" fill={INK}>{e.equation}</text>
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}
