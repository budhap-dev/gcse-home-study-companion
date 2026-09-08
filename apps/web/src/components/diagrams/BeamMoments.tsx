import { DISPLAY, FONT, INK, INK_2 } from './index.tsx'

interface ForceMark {
  /** Position along the beam from the left end, in metres. */
  at: number
  /** Force in newtons; positive pushes down, negative pulls up. */
  force: number
  label?: string
}

/**
 * A horizontal beam on a pivot with forces drawn as arrows and distances from the
 * pivot marked. Props: { length: m, pivot: m from left, forces: ForceMark[], showDistances }.
 */
export function BeamMoments({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const length = Number(props.length ?? 4)
  const pivot = Number(props.pivot ?? 2)
  const forces = (props.forces as ForceMark[] | undefined) ?? []
  const showDistances = props.showDistances !== false
  const scale = 100
  const pad = 50
  const W = length * scale + 2 * pad
  const beamY = 110
  const H = 200
  const x = (m: number) => pad + m * scale
  const maxF = Math.max(...forces.map((f) => Math.abs(f.force)), 1)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: Math.min(600, W * 1.2) }} role="img" aria-label={alt}>
      <rect x={x(0)} y={beamY - 6} width={length * scale} height="12" rx="2" fill="var(--subject-soft)" stroke={INK} strokeWidth="2" />
      <polygon points={`${x(pivot)},${beamY + 6} ${x(pivot) - 16},${beamY + 40} ${x(pivot) + 16},${beamY + 40}`} fill={INK} />
      <text x={x(pivot)} y={beamY + 56} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>pivot</text>
      {forces.map((f, i) => {
        const len = 22 + (Math.abs(f.force) / maxF) * 38
        const down = f.force > 0
        const y1 = down ? beamY - 6 - len : beamY + 6 + len
        const y2 = down ? beamY - 8 : beamY + 8
        const colour = down ? '#d25b3b' : '#2e8b57'
        return (
          <g key={i}>
            <line x1={x(f.at)} y1={y1} x2={x(f.at)} y2={y2} stroke={colour} strokeWidth="3" strokeLinecap="round" />
            <polygon points={down ? `${x(f.at)},${y2 + 2} ${x(f.at) - 6},${y2 - 8} ${x(f.at) + 6},${y2 - 8}` : `${x(f.at)},${y2 - 2} ${x(f.at) - 6},${y2 + 8} ${x(f.at) + 6},${y2 + 8}`} fill={colour} />
            <text x={x(f.at)} y={down ? y1 - 6 : y1 + 14} textAnchor="middle" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={colour}>{f.label ?? `${Math.abs(f.force)} N`}</text>
            {showDistances && f.at !== pivot && (
              <g>
                <line x1={x(Math.min(f.at, pivot))} y1={beamY + 30} x2={x(Math.max(f.at, pivot))} y2={beamY + 30} stroke={INK_2} strokeDasharray="3 3" />
                <text x={x((f.at + pivot) / 2)} y={beamY + 44} textAnchor="middle" fontFamily={FONT} fontSize="10" fill={INK_2}>{Math.abs(f.at - pivot)} m</text>
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}
