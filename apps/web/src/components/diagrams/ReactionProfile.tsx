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

  /*
   * Laid out for a 290-unit phone card; at 470 it scrolled up to 172px. Every label has a
   * place of its own rather than a place beside the hump, where at this width the curve ran
   * through it:
   *   - the reactant and product names sit under their plateaus, wrapped, with room kept
   *     under the lowest level so a label never meets the axis;
   *   - the activation arrow stands on the reactant plateau, left of the hump, reaching a
   *     dashed guide at the height of the peak, with its label on two upright lines beside it;
   *   - the overall-change arrow stands in the right margin, its label outside it.
   */
  const W = 290
  const H = 280
  const padL = 40
  const padR = 48
  const padT = 30
  const padB = 40
  /** Room under the lowest plateau for a two-line name. */
  const under = 34

  // Energy runs up the page, so the scale covers everything the diagram draws.
  const top = Math.max(activation, change, 0)
  const bottom = Math.min(0, change)
  const span = Math.max(1, top - bottom)
  const y = (e: number) => padT + ((top - e) / span) * (H - padT - padB - under)
  const right = W - padR
  const xStart = padL + 70
  const xEnd = right - 40
  const xPeak = (xStart + xEnd) / 2

  const yReact = y(0)
  const yProd = y(change)
  const yPeak = y(activation)

  /** A hump: flat along the reactants, up to the peak, down to the products, flat again. */
  const path = [
    `M${padL} ${yReact.toFixed(1)}`,
    `L${xStart.toFixed(1)} ${yReact.toFixed(1)}`,
    `C${(xStart + 24).toFixed(1)} ${yReact.toFixed(1)} ${(xPeak - 24).toFixed(1)} ${yPeak.toFixed(1)} ${xPeak.toFixed(1)} ${yPeak.toFixed(1)}`,
    `C${(xPeak + 24).toFixed(1)} ${yPeak.toFixed(1)} ${(xEnd - 24).toFixed(1)} ${yProd.toFixed(1)} ${xEnd.toFixed(1)} ${yProd.toFixed(1)}`,
    `L${right.toFixed(1)} ${yProd.toFixed(1)}`,
  ].join(' ')

  /** Words onto lines of at most `max` characters: "stain + enzyme" is "stain +" over "enzyme". */
  const wrap = (text: string, max: number) => {
    const lines: string[] = []
    for (const word of text.split(' ')) {
      const last = lines[lines.length - 1]
      if (last !== undefined && `${last} ${word}`.length <= max) lines[lines.length - 1] = `${last} ${word}`
      else lines.push(word)
    }
    return lines
  }

  const name = (text: string, x: number, yTop: number, anchor: 'start' | 'end') =>
    wrap(text, 10).map((line, i) => (
      <text key={i} x={x} y={yTop + 13 + i * 13} textAnchor={anchor} fontFamily={DISPLAY} fontSize="11" fontWeight="700" fill={INK}>{line}</text>
    ))

  /** A double-headed arrow with its label on two upright lines, on the side given. */
  const measure = (x: number, y1: number, y2: number, words: [string, string], side: 1 | -1) => {
    const mid = (y1 + y2) / 2
    return (
      <g>
        <line x1={x} y1={y1} x2={x} y2={y2} stroke={INK} strokeWidth="1.5" />
        <polygon points={`${x},${y1} ${x - 4},${y1 + (y2 > y1 ? 7 : -7)} ${x + 4},${y1 + (y2 > y1 ? 7 : -7)}`} fill={INK} />
        <polygon points={`${x},${y2} ${x - 4},${y2 + (y2 > y1 ? -7 : 7)} ${x + 4},${y2 + (y2 > y1 ? -7 : 7)}`} fill={INK} />
        {words.map((w, i) => {
          const tx = x + side * (8 + i * 13) + (side > 0 ? 9 : 0)
          return (
            <text key={i} x={tx} y={mid} textAnchor="middle" transform={`rotate(-90 ${tx} ${mid})`} fontFamily={FONT} fontSize="12" fill={INK}>{w}</text>
          )
        })}
      </g>
    )
  }

  return (
    // 658 keeps the desktop size it had at 470 units wide (470 × 1.4).
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 658 }} role="img" aria-label={alt}>
      <line x1={padL} y1={padT - 8} x2={padL} y2={H - padB} stroke={INK} strokeWidth="1.5" />
      <line x1={padL} y1={H - padB} x2={right} y2={H - padB} stroke={INK} strokeWidth="1.5" />
      <text x={padL - 8} y={padT - 14} textAnchor="start" fontFamily={FONT} fontSize="11" fill={INK_2}>energy</text>
      <text x={(padL + right) / 2} y={H - 12} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>progress of reaction</text>

      {/* the two levels, dashed across so the difference between them can be seen */}
      <line x1={padL} y1={yReact} x2={right + 16} y2={yReact} stroke={RULE} strokeDasharray="4 4" />
      <line x1={padL} y1={yProd} x2={right + 16} y2={yProd} stroke={RULE} strokeDasharray="4 4" />
      {/* the height of the peak, carried back to the activation arrow */}
      <line x1={padL + 20} y1={yPeak} x2={xPeak} y2={yPeak} stroke={RULE} strokeDasharray="2 3" />

      <path d={path} fill="none" stroke="var(--subject)" strokeWidth="2.5" />

      {name(reactantLabel, padL + 4, yReact, 'start')}
      {name(productLabel, right - 2, yProd, 'end')}

      {measure(padL + 20, yReact, yPeak, ['activation', 'energy'], 1)}
      {measure(right + 12, yReact, yProd, ['overall', 'change'], 1)}
      <circle cx={xPeak} cy={yPeak} r="3" fill={ACCENT} />
      <text x={(padL + right) / 2} y={H - 26} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>{kind}</text>
    </svg>
  )
}
