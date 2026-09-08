import { DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

interface Eq { name: string; equation: string; units: string }

/** A card of equations with units. Props: { equations: Eq[] }. Defaults to the energy pair. */
export function EquationCard({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const eqs = (props.equations as Eq[] | undefined) ?? [
    { name: 'Kinetic energy', equation: 'Ek = ½ m v²', units: 'J, kg, m/s' },
    { name: 'Gravitational potential energy', equation: 'Ep = m g h', units: 'J, kg, N/kg, m' },
    { name: 'Elastic potential energy', equation: 'Ee = ½ k e²', units: 'J, N/m, m' },
  ]
  const rowH = 46
  return (
    <svg viewBox={`0 0 520 ${eqs.length * rowH + 24}`} width="100%" style={{ maxWidth: 560 }} role="img" aria-label={alt}>
      <rect x="1" y="1" width="518" height={eqs.length * rowH + 22} rx="14" fill="#fff" stroke={RULE} />
      {eqs.map((e, i) => {
        const y = 12 + i * rowH
        return (
          <g key={e.name}>
            {i > 0 && <line x1="16" y1={y} x2="504" y2={y} stroke={RULE} />}
            <text x="20" y={y + 20} fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill="var(--subject)">{e.name}</text>
            <text x="20" y={y + 38} fontFamily={FONT} fontSize="12" fill={INK_2}>{e.units}</text>
            <text x="500" y={y + 30} textAnchor="end" fontFamily={DISPLAY} fontSize="20" fontWeight="700" fill={INK}>{e.equation}</text>
          </g>
        )
      })}
    </svg>
  )
}
