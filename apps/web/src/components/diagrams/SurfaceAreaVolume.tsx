import { DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

/**
 * Cubes compared by surface area to volume ratio, for spec point 8.2. The surface area,
 * the volume and the ratio are all computed here from the side length, and the cube is
 * drawn at a size derived from the same number — so the figures printed beneath a cube
 * cannot disagree with the cube above them. That is the error this is for: a table of
 * SA:V ratios written out by hand is very easy to get subtly wrong, and a student has no
 * way to tell.
 *
 * Props:
 *   sides: number[] — the side lengths to compare, smallest first (default [1, 2, 3])
 *   unit: string — the unit for the labels, default cm
 *   title: string — a caption under the row
 */
export function SurfaceAreaVolume({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const sides = ((props.sides as number[] | undefined) ?? [1, 2, 3]).filter((s) => Number(s) > 0).slice(0, 4)
  const unit = String(props.unit ?? 'cm')
  const title = props.title ? String(props.title) : ''

  const largest = Math.max(...sides, 1)
  const cell = 150
  const W = Math.max(sides.length * cell, cell)
  const H = 210

  // Two decimal places at most, with trailing zeros trimmed, so 1.5 prints as 1.5 and 2 as 2.
  const round = (v: number) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(2).replace(/0+$/, ''))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 520 }} role="img" aria-label={alt}>
      {sides.map((side, i) => {
        const surfaceArea = 6 * side * side
        const volume = side ** 3
        const ratio = surfaceArea / volume
        // The drawn size comes from the same side length as the numbers do.
        const box = 34 + (side / largest) * 56
        const depth = box * 0.34
        const cx = i * cell + cell / 2
        const left = cx - box / 2
        const base = 118
        const top = base - box
        return (
          <g key={i}>
            {/* Oblique cube: front face, then the top and right faces. */}
            <rect x={left} y={top} width={box} height={box} fill="var(--subject)" fillOpacity="0.12" stroke={INK} strokeWidth="1.2" />
            <polygon points={`${left},${top} ${left + depth},${top - depth} ${left + box + depth},${top - depth} ${left + box},${top}`} fill="var(--subject)" fillOpacity="0.2" stroke={INK} strokeWidth="1.2" />
            <polygon points={`${left + box},${top} ${left + box + depth},${top - depth} ${left + box + depth},${base - depth} ${left + box},${base}`} fill="var(--subject)" fillOpacity="0.06" stroke={INK} strokeWidth="1.2" />
            <text x={cx} y={base + 20} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>
              side {round(side)} {unit}
            </text>
            <text x={cx} y={base + 38} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>
              area {round(surfaceArea)} {unit}²
            </text>
            <text x={cx} y={base + 54} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>
              volume {round(volume)} {unit}³
            </text>
            <text x={cx} y={base + 72} textAnchor="middle" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={INK}>
              {round(ratio)} : 1
            </text>
          </g>
        )
      })}
      {title ? (
        <>
          <line x1="8" y1={H - 20} x2={W - 8} y2={H - 20} stroke={RULE} />
          <text x={W / 2} y={H - 6} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>{title}</text>
        </>
      ) : null}
    </svg>
  )
}
