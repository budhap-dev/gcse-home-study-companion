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
  const baseH = 200
  const x = (m: number) => pad + m * scale
  const maxF = Math.max(...forces.map((f) => Math.abs(f.force)), 1)
  /**
   * Force labels are centred on their arrows, so two arrows closer together than their
   * labels are wide print on top of each other. A door with the same push drawn near the
   * hinge and at the handle did exactly that — "20 N here: 2 N m" and "20 N here: 16 N m"
   * overlapped into one unreadable line, and every automated check passed, because the
   * page had no horizontal scroll and no text below the readable floor. It was only
   * visible in a screenshot.
   *
   * So each label is measured, and one that would collide with an earlier one is lifted
   * onto its own line. Distance labels below the beam are staggered the same way.
   */
  const labelText = (f: ForceMark) => f.label ?? `${Math.abs(f.force)} N`
  const halfWidth = (text: string) => (text.length * 7) / 2
  const stagger = (items: { centre: number; text: string }[]) => {
    const rows: number[][] = []
    return items.map(({ centre, text }) => {
      const left = centre - halfWidth(text)
      const right = centre + halfWidth(text)
      let row = 0
      while (rows[row]?.some((_, i) => i % 2 === 0 && right > rows[row]![i]! && left < rows[row]![i + 1]!)) row++
      rows[row] = [...(rows[row] ?? []), left, right]
      return row
    })
  }
  const forceRow = stagger(forces.map((f) => ({ centre: x(f.at), text: labelText(f) })))
  const distRow = stagger(
    forces.filter((f) => f.at !== pivot).map((f) => ({ centre: x((f.at + pivot) / 2), text: `${Math.abs(f.at - pivot)} m` })),
  )
  const distRowOf = new Map(forces.filter((f) => f.at !== pivot).map((f, i) => [f, distRow[i]!]))
  const LINE = 15
  // The canvas grows downwards when distance labels need a second line, so nothing is clipped.
  const extra = Math.max(0, ...distRow) * LINE
  return (
    <svg viewBox={`0 0 ${W} ${baseH + extra}`} width="100%" style={{ maxWidth: Math.min(600, W * 1.2) }} role="img" aria-label={alt}>
      <rect x={x(0)} y={beamY - 6} width={length * scale} height="12" rx="2" fill="var(--subject-soft)" stroke={INK} strokeWidth="2" />
      <polygon points={`${x(pivot)},${beamY + 6} ${x(pivot) - 16},${beamY + 40} ${x(pivot) + 16},${beamY + 40}`} fill={INK} />
      {/* Below the distance labels rather than twelve pixels under them: a force close to
          the pivot puts its distance label directly over this one. */}
      <text x={x(pivot)} y={beamY + 74} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>pivot</text>
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
            <text
              x={x(f.at)}
              y={(down ? y1 - 6 : y1 + 14) + (down ? -1 : 1) * forceRow[i]! * LINE}
              textAnchor="middle"
              fontFamily={DISPLAY}
              fontSize="12"
              fontWeight="700"
              fill={colour}
            >
              {labelText(f)}
            </text>
            {showDistances && f.at !== pivot && (
              <g>
                <line x1={x(Math.min(f.at, pivot))} y1={beamY + 30} x2={x(Math.max(f.at, pivot))} y2={beamY + 30} stroke={INK_2} strokeDasharray="3 3" />
                <text x={x((f.at + pivot) / 2)} y={beamY + 52 + (distRowOf.get(f) ?? 0) * LINE} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>{Math.abs(f.at - pivot)} m</text>
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}
