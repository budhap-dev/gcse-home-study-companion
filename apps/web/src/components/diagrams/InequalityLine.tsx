import { DISPLAY, FONT, INK, INK_2 } from './index.tsx'

interface Bound {
  /** The number the solution is bounded by. */
  value: number
  /** True for ≤ or ≥, which include the endpoint and so take a filled circle. */
  inclusive: boolean
}

/**
 * A solution set drawn on a number line. The circles are decided by the props, not drawn
 * by hand: an inclusive bound gets a filled circle and a strict one an open circle, and
 * the shading always runs between the bounds, so the picture cannot contradict the
 * inequality it illustrates. Props:
 *   from, to: the range of the line
 *   lower, upper: Bound objects; omit one for a single-ended solution
 *   label: the inequality in words or symbols, drawn above the line
 */
export function InequalityLine({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const from = Number(props.from ?? -5)
  const to = Number(props.to ?? 5)
  const lower = props.lower as Bound | undefined
  const upper = props.upper as Bound | undefined
  const label = typeof props.label === 'string' ? props.label : undefined

  const W = 420
  const H = 110
  const padX = 30
  const axisY = 68
  // Not Math.max(1, ...): that guards a zero span but silently ruins a fractional one.
  // A 49.9 to 50.1 tolerance band was squashed into the leftmost fifth of the line.
  const span = to > from ? to - from : 1
  const x = (v: number) => padX + ((v - from) / span) * (W - 2 * padX)

  // The shaded part runs from the lower bound to the upper one; a missing bound means
  // the solution continues to the edge of the drawn line.
  const shadeFrom = lower ? x(lower.value) : padX
  const shadeTo = upper ? x(upper.value) : W - padX

  /**
   * Whole-number ticks suit the usual -5 to 5 line and nothing else: over a fractional
   * range they produce one tick or none, and over a wide one they produce a smear. Step
   * in 1, 2, 5 or 10 (times a power of ten) for about six labels, whatever the range.
   */
  const wholeTicks = Math.floor(to) - Math.ceil(from) + 1
  const rough = span / 6
  const power = 10 ** Math.floor(Math.log10(rough))
  // Whole numbers where whole numbers work — a -5 to 5 line wants every integer marked,
  // and that is what nearly every one of these diagrams is. Adapt only when they do not.
  const tickStep = wholeTicks >= 3 && wholeTicks <= 13
    ? 1
    : [1, 2, 5, 10].map((m) => m * power).find((t) => t >= rough) ?? 10 * power
  const decimals = Math.max(0, -Math.floor(Math.log10(tickStep)))
  const ticks: number[] = []
  for (let v = Math.ceil(from / tickStep) * tickStep; v <= to + tickStep / 1e6; v += tickStep) {
    ticks.push(Number(v.toFixed(decimals + 1)))
  }

  const circle = (b: Bound) => (
    <circle cx={x(b.value)} cy={axisY} r="6" fill={b.inclusive ? 'var(--subject)' : '#ffffff'} stroke="var(--subject)" strokeWidth="2.5" />
  )
  /** An arrowhead where the solution runs off the end of the drawn line. */
  const arrow = (atX: number, dir: 1 | -1) => (
    <polygon points={`${atX + dir * 9},${axisY} ${atX},${axisY - 5} ${atX},${axisY + 5}`} fill="var(--subject)" />
  )

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W * 1.3 }} role="img" aria-label={alt}>
      {label && <text x={W / 2} y="22" textAnchor="middle" fontFamily={DISPLAY} fontSize="15" fontWeight="700" fill={INK}>{label}</text>}

      <line x1={padX - 12} y1={axisY} x2={W - padX + 12} y2={axisY} stroke={INK} strokeWidth="1.5" />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={x(v)} y1={axisY - 5} x2={x(v)} y2={axisY + 5} stroke={INK_2} strokeWidth="1.5" />
          <text x={x(v)} y={axisY + 22} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>{v.toFixed(decimals)}</text>
        </g>
      ))}

      <line x1={shadeFrom} y1={axisY} x2={shadeTo} y2={axisY} stroke="var(--subject)" strokeWidth="5" strokeLinecap="butt" opacity="0.85" />
      {!lower && arrow(padX - 12, -1)}
      {!upper && arrow(W - padX + 12, 1)}
      {lower && circle(lower)}
      {upper && circle(upper)}
    </svg>
  )
}
