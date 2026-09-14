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
  const W = 440
  const H = three ? 340 : 300
  const r = three ? 82 : 92

  // Circle centres, and the point at which each region's value is written.
  const circles = three
    ? [{ cx: 178, cy: 132 }, { cx: 262, cy: 132 }, { cx: 220, cy: 208 }]
    : [{ cx: 168, cy: 150 }, { cx: 262, cy: 150 }]
  const spots: Record<string, [number, number]> = three
    ? { A: [142, 108], B: [298, 108], C: [220, 250], AB: [220, 100], AC: [168, 182], BC: [272, 182], ABC: [220, 152], none: [396, 302] }
    : { A: [126, 156], B: [304, 156], AB: [215, 156], none: [396, 268] }

  // Regions are always keyed by position, A B C, whatever the sets are called, so two
  // sets whose names start with the same letter cannot collide.
  const regions = three ? ['A', 'B', 'C', 'AB', 'AC', 'BC', 'ABC'] : ['A', 'B', 'AB']

  // Labels sit outside their circle, on the side away from the others.
  const labelAt: [number, number, string][] = three
    ? [[96, 78, 'end'], [344, 78, 'start'], [220, 316, 'middle']]
    : [[92, 76, 'end'], [348, 76, 'start']]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 460 }} role="img" aria-label={alt}>
      {title && (
        <text x={W / 2} y={18} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>
          {title}
        </text>
      )}
      <rect x="14" y={title ? 28 : 18} width={W - 28} height={H - (title ? 42 : 32)} fill="none" stroke={RULE} strokeWidth="2" />
      <text x="24" y={(title ? 28 : 18) + 18} fontFamily={FONT} fontSize="12" fill={INK_2}>
        ξ
      </text>
      {circles.map((c, i) => (
        <circle key={`c${i}`} cx={c.cx} cy={c.cy} r={r} fill={ACCENT} fillOpacity="0.1" stroke={ACCENT} strokeWidth="2" />
      ))}
      {labelAt.slice(0, labels.length).map(([x, y, anchor], i) => (
        <text key={`l${i}`} x={x} y={y} textAnchor={anchor as 'start' | 'end' | 'middle'} fontFamily={DISPLAY} fontSize="15" fontWeight="700" fill={ACCENT}>
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
