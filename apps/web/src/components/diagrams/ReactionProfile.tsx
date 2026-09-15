import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

/**
 * An energy level diagram for a reaction. The component places the two levels and both
 * arrows from the numbers it is given, so the picture cannot show an exothermic hump
 * over an endothermic step. Props:
 *   kind: 'exothermic' | 'endothermic' — checked against the sign of `change`
 *   activation: the height of the hump above the reactants, in the same arbitrary units
 *   change: the overall energy change; negative for exothermic, positive for endothermic
 *   reactants, products: optional labels
 *
 * The activation arrow runs from the reactants level to the peak, and the overall change
 * arrow between the two levels, because that difference is what the lesson is teaching
 * and what students most often draw wrongly.
 */
export function ReactionProfile({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const change = Number(props.change ?? -80)
  const activation = Math.max(10, Number(props.activation ?? 120))
  // The declared kind must agree with the sign, so a mislabelled diagram cannot be drawn.
  const kind = change < 0 ? 'exothermic' : 'endothermic'
  const reactantLabel = String(props.reactants ?? 'reactants')
  const productLabel = String(props.products ?? 'products')

  const W = 470
  const H = 260
  const padL = 46
  const padR = 104
  const padT = 26
  const padB = 40

  // Energy runs up the page, so the scale covers everything the diagram draws.
  const top = Math.max(activation, change, 0)
  const bottom = Math.min(0, change)
  const span = Math.max(1, top - bottom)
  const y = (e: number) => padT + ((top - e) / span) * (H - padT - padB)
  const xStart = padL + 14
  const xPeak = (padL + (W - padR)) / 2
  const xEnd = W - padR - 14

  const yReact = y(0)
  const yProd = y(change)
  const yPeak = y(activation)

  /** A hump: flat along the reactants, up to the peak, down to the products, flat again. */
  const path = [
    `M${padL} ${yReact.toFixed(1)}`,
    `L${xStart.toFixed(1)} ${yReact.toFixed(1)}`,
    `C${(xStart + 34).toFixed(1)} ${yReact.toFixed(1)} ${(xPeak - 34).toFixed(1)} ${yPeak.toFixed(1)} ${xPeak.toFixed(1)} ${yPeak.toFixed(1)}`,
    `C${(xPeak + 34).toFixed(1)} ${yPeak.toFixed(1)} ${(xEnd - 34).toFixed(1)} ${yProd.toFixed(1)} ${xEnd.toFixed(1)} ${yProd.toFixed(1)}`,
    `L${(W - padR).toFixed(1)} ${yProd.toFixed(1)}`,
  ].join(' ')

  /** A double-headed arrow with its label, used for both measurements. */
  const measure = (x: number, y1: number, y2: number, label: string, anchor: 'start' | 'end') => (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={INK} strokeWidth="1.5" />
      <polygon points={`${x},${y1} ${x - 4},${y1 + (y2 > y1 ? 7 : -7)} ${x + 4},${y1 + (y2 > y1 ? 7 : -7)}`} fill={INK} />
      <polygon points={`${x},${y2} ${x - 4},${y2 + (y2 > y1 ? -7 : 7)} ${x + 4},${y2 + (y2 > y1 ? -7 : 7)}`} fill={INK} />
      {anchor === 'end' ? (
        <text x={x - 8} y={(y1 + y2) / 2} textAnchor="middle" transform={`rotate(-90 ${x - 8} ${(y1 + y2) / 2})`} fontFamily={FONT} fontSize="12" fill={INK} stroke="#ffffff" strokeWidth="3.5" paintOrder="stroke">{label}</text>
      ) : (
        <text x={x + 8} y={(y1 + y2) / 2 + 4} textAnchor="start" fontFamily={FONT} fontSize="12" fill={INK} stroke="#ffffff" strokeWidth="3.5" paintOrder="stroke">{label}</text>
      )}
    </g>
  )

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W * 1.4 }} role="img" aria-label={alt}>
      <line x1={padL} y1={padT - 8} x2={padL} y2={H - padB} stroke={INK} strokeWidth="1.5" />
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke={INK} strokeWidth="1.5" />
      <text x={padL - 8} y={padT - 12} textAnchor="start" fontFamily={FONT} fontSize="11" fill={INK_2}>energy</text>
      <text x={(padL + W - padR) / 2} y={H - 12} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>progress of reaction</text>

      {/* the two levels, dashed across so the difference between them can be seen */}
      <line x1={padL} y1={yReact} x2={W - padR} y2={yReact} stroke={RULE} strokeDasharray="4 4" />
      <line x1={padL} y1={yProd} x2={W - padR} y2={yProd} stroke={RULE} strokeDasharray="4 4" />

      <path d={path} fill="none" stroke="var(--subject)" strokeWidth="2.5" />

      <text x={xStart - 8} y={yReact - 12} fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={INK} stroke="#ffffff" strokeWidth="3.5" paintOrder="stroke">{reactantLabel}</text>
      <text x={xEnd - 6} y={yProd + (change < 0 ? 18 : -8)} textAnchor="end" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={INK} stroke="#ffffff" strokeWidth="3.5" paintOrder="stroke">{productLabel}</text>

      {measure(xPeak - 52, yReact, yPeak, 'activation energy', 'end')}
      {measure(xEnd + 2, yReact, yProd, 'overall change', 'start')}
      <circle cx={xPeak} cy={yPeak} r="3" fill={ACCENT} />
      <text x={(padL + W - padR) / 2} y={H - 26} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>{kind}</text>
    </svg>
  )
}
