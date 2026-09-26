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
 *
 * Cubes wrap onto a second row after two, in a fixed 140-unit cell, so the row never grows
 * past the 298 CSS px a diagram figure leaves on a 390px phone (`Visual.tsx`). It used to
 * lay every cube in a single row at 150 units each: four cubes drew a 600-unit row, and
 * below its natural width a diagram stops shrinking and scrolls instead, so the biggest
 * comparison the component exists to show — four cubes side by side — was the one that
 * always scrolled. The caption wraps for the same reason: at the old width it ran the
 * full row; narrower, it wraps onto as many lines as it needs rather than overhanging.
 */
export function SurfaceAreaVolume({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const sides = ((props.sides as number[] | undefined) ?? [1, 2, 3]).filter((s) => Number(s) > 0).slice(0, 4)
  const unit = String(props.unit ?? 'cm')
  const title = props.title ? String(props.title) : ''

  const largest = Math.max(...sides, 1)
  const cell = 140
  const cols = Math.min(sides.length, 2)
  const rows = Math.ceil(sides.length / cols)
  // A cube's isometric top face reaches above its own box by `depth` (up to 0.34 × the
  // biggest box, 90 units), so a second row's tallest cube used to poke into the first
  // row's text: BASE_OFFSET clears that reach at row 0, and ROW_H clears it again above
  // the previous row's last line of text.
  const BASE_OFFSET = 135
  const ROW_H = 215
  const W = Math.max(cols * cell, cell)

  const TITLE_SIZE = 11
  const titleRoom = W - 16
  const titleLines: string[] = []
  if (title) {
    const words = title.split(/\s+/).filter(Boolean)
    let line = words[0] ?? ''
    for (const word of words.slice(1)) {
      const candidate = `${line} ${word}`
      if (candidate.length * TITLE_SIZE * 0.6 <= titleRoom) line = candidate
      else { titleLines.push(line); line = word }
    }
    if (line) titleLines.push(line)
  }
  const titleH = titleLines.length ? titleLines.length * 14 + 10 : 0
  const H = (rows - 1) * ROW_H + BASE_OFFSET + 82 + titleH

  // Two decimal places at most, with trailing zeros trimmed, so 1.5 prints as 1.5 and 2 as 2.
  const round = (v: number) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(2).replace(/0+$/, ''))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 420 }} role="img" aria-label={alt}>
      {sides.map((side, i) => {
        const surfaceArea = 6 * side * side
        const volume = side ** 3
        const ratio = surfaceArea / volume
        // The drawn size comes from the same side length as the numbers do.
        const box = 34 + (side / largest) * 56
        const depth = box * 0.34
        const col = i % cols
        const row = Math.floor(i / cols)
        const cx = col * cell + cell / 2
        // The whole cube centred in its cell, front face and the depth drawn to its right:
        // centred on the front face alone, the biggest cube's side ran off the right edge.
        const left = cx - (box + depth) / 2
        const base = row * ROW_H + BASE_OFFSET
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
      {titleLines.length ? (
        <>
          <line x1="8" y1={H - titleH} x2={W - 8} y2={H - titleH} stroke={RULE} />
          {titleLines.map((text, i) => (
            <text key={i} x={W / 2} y={H - titleH + 14 + i * 14} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>{text}</text>
          ))}
        </>
      ) : null}
    </svg>
  )
}
