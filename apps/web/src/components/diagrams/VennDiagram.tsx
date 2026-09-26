import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

/**
 * A two or three set Venn diagram inside its universal set, with a number or a label
 * written in each region. Edexcel questions put frequencies in the regions and then
 * ask for a probability, so the rectangle and the "outside" region are drawn even when
 * empty: forgetting the outside is the classic lost mark.
 *
 * Props: { labels: string[] (2 or 3), values: Record<string, string|number>, title? }
 * Region keys name the circles by position rather than by label: "A" is in the first
 * circle only, "AB" in the first two but not the third, "ABC" in all three, and "none"
 * is inside the rectangle but outside every circle.
 */
export function VennDiagram({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const labels = (props.labels as string[] | undefined) ?? ['A', 'B']
  const values = (props.values as Record<string, string | number> | undefined) ?? {}
  const title = props.title as string | undefined
  const three = labels.length >= 3
  /*
   * 296 units wide, the width a 390px phone's card holds. The drawing stops shrinking
   * at its natural width, and at 440 the old layout scrolled 108px on a phone with the
   * second circle's label and the outside count out of sight.
   */
  const W = 296
  const top = title ? 28 : 8
  const r = three ? 60 : 68

  // Circle centres. Three sets sit on an equilateral triangle of side 62.
  const cy = top + 30 + r
  const circles = three
    ? [{ cx: 117, cy }, { cx: 179, cy }, { cx: 148, cy: cy + 54 }]
    : [{ cx: 112, cy }, { cx: 184, cy }]
  const H = three ? cy + 54 + r + 30 : cy + r + 28
  const mid = (i: number, j: number): [number, number] => [(circles[i]!.cx + circles[j]!.cx) / 2, (circles[i]!.cy + circles[j]!.cy) / 2]
  const [a, b] = circles as [{ cx: number; cy: number }, { cx: number; cy: number }]
  const c = circles[2] ?? { cx: W / 2, cy }
  const none: [number, number] = [W - 30, H - 14]
  // Where each region's value is written, as a baseline 5 below the region's centre.
  const spots: Record<string, [number, number]> = three
    ? {
        A: [a.cx - 26, a.cy - 13], B: [b.cx + 26, b.cy - 13], C: [c.cx, c.cy + 36],
        AB: [mid(0, 1)[0], mid(0, 1)[1] - 18], AC: [mid(0, 2)[0] - 23, mid(0, 2)[1] + 14],
        BC: [mid(1, 2)[0] + 23, mid(1, 2)[1] + 14], ABC: [148, (a.cy + b.cy + c.cy) / 3 + 1], none,
      }
    : { A: [(a.cx - r + b.cx - r) / 2, cy + 5], B: [(a.cx + r + b.cx + r) / 2, cy + 5], AB: [(a.cx + b.cx) / 2, cy + 5], none }

  // Regions are always keyed by position, A B C, whatever the sets are called, so two
  // sets whose names start with the same letter cannot collide.
  const regions = three ? ['A', 'B', 'C', 'AB', 'AC', 'BC', 'ABC'] : ['A', 'B', 'AB']

  // The first two labels share a row above the circles, one from each end, so a long
  // name has the whole half-width rather than the gap beside its circle; the third
  // goes under its circle.
  const labelAt: [number, number, string][] = [[30, top + 20, 'start'], [W - 14, top + 20, 'end'], [c.cx, c.cy + r + 18, 'middle']]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W * 1.3 }} role="img" aria-label={alt}>
      {title && (
        <text x={W / 2} y={18} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>
          {title}
        </text>
      )}
      <rect x="6" y={top} width={W - 12} height={H - top - 6} fill="none" stroke={RULE} strokeWidth="2" />
      <text x="14" y={top + 18} fontFamily={FONT} fontSize="12" fill={INK_2}>
        ξ
      </text>
      {circles.map((c, i) => (
        <circle key={`c${i}`} cx={c.cx} cy={c.cy} r={r} fill={ACCENT} fillOpacity="0.1" stroke={ACCENT} strokeWidth="2" />
      ))}
      {labelAt.slice(0, labels.length).map(([x, y, anchor], i) => (
        <text key={`l${i}`} x={x} y={y} textAnchor={anchor as 'start' | 'end' | 'middle'} fontFamily={DISPLAY} fontSize="14" fontWeight="700" fill={ACCENT}>
          {labels[i]}
        </text>
      ))}
      {[...regions, 'none'].map((k) => {
        const v = values[k]
        if (v === undefined || v === '') return null
        const spot = spots[k]
        if (!spot) return null
        return (
          <text key={`v${k}`} x={spot[0]} y={spot[1]} textAnchor="middle" fontFamily={DISPLAY} fontSize="14" fontWeight="700" fill={INK}>
            {v}
          </text>
        )
      })}
    </svg>
  )
}
