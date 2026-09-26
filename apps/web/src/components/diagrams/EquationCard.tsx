import { DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

interface Eq { name: string; equation: string; units: string }

/**
 * The card is drawn to this width and no wider, so it fits inside the 298 CSS px a diagram
 * figure leaves on a 390px phone (`Visual.tsx`) without scrolling.
 *
 * It used to be 520, then 300 (still 2px over that 298). Below its natural width a diagram
 * stops shrinking and scrolls instead, which keeps its text readable — but this card set
 * the name on the left and anchored the equation to the right edge, so the part that
 * scrolled out of sight was the equation. A student on a phone saw "Potential difference /
 * V, A, ohms" and had to drag sideways to find "V = I R". The one thing the card exists to
 * show was the one thing hidden.
 */
const W = 294
const PAD = 16
/**
 * Roughly how wide a character is, as a fraction of the font size, for these two faces —
 * set to the conservative 0.6 the phone-fit check uses (`labelsize.test.ts` and the
 * component's own test), not a tighter measured average, so a line that just fits by this
 * component's own wrap can never be the line the check finds hanging over the edge.
 */
const DISPLAY_RATIO = 0.6
const BODY_RATIO = 0.6
const width = (text: string, size: number, ratio = DISPLAY_RATIO) => text.length * size * ratio

/**
 * Greedy word wrap to a pixel width. A word longer than the line is left to overhang its
 * own line rather than being broken mid-symbol: breaking "1 000 000" or "sin⁻¹" across
 * lines would be worse than a line that runs a little long, and `fitSvgText` widens the
 * drawing for a label that needs it.
 */
function wrap(text: string, size: number, ratio: number, room: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const lines: string[] = []
  let line = words[0]!
  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`
    if (width(candidate, size, ratio) <= room) line = candidate
    else { lines.push(line); line = word }
  }
  lines.push(line)
  return lines
}

/**
 * The size an equation is set at: a formula reads as a formula, but several of the
 * Chemistry and Biology cards hold a sentence in the equation slot, and a sentence set at
 * 20px wraps to four lines. Step down until it fits two lines, and no smaller than 12 —
 * below that it stops being readable, and wrapping further is the better trade.
 */
function sizeFor(equation: string, room: number): number {
  for (const size of [20, 17, 15, 13]) {
    if (wrap(equation, size, DISPLAY_RATIO, room).length <= 2) return size
  }
  return 12
}

/** A card of equations with units. Props: { equations: Eq[] }. Defaults to the energy pair. */
export function EquationCard({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const eqs = (props.equations as Eq[] | undefined) ?? [
    { name: 'Kinetic energy', equation: 'Ek = ½ m v²', units: 'J, kg, m/s' },
    { name: 'Gravitational potential energy', equation: 'Ep = m g h', units: 'J, kg, N/kg, m' },
    { name: 'Elastic potential energy', equation: 'Ee = ½ k e²', units: 'J, N/m, m' },
  ]
  const room = W - 2 * PAD

  // Every row is stacked: name, then equation, then units, each from the left margin.
  // Nothing is anchored to the right edge any more, so nothing can be the part that
  // scrolls away.
  const rows = eqs.map((e) => {
    const size = sizeFor(e.equation, room)
    const name = wrap(e.name, 12, DISPLAY_RATIO, room)
    const equation = wrap(e.equation, size, DISPLAY_RATIO, room)
    const units = wrap(e.units, 12, BODY_RATIO, room)
    const height = 6 + name.length * 15 + 4 + equation.length * (size + 3) + (units.length ? 2 + units.length * 15 : 0) + 10
    return { ...e, size, name, equation, units, height }
  })

  const tops: number[] = []
  let y = 6
  for (const r of rows) { tops.push(y); y += r.height }
  const H = y + 6

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 360 }} role="img" aria-label={alt}>
      <rect x="1" y="1" width={W - 2} height={H - 2} rx="14" fill="#fff" stroke={RULE} />
      {rows.map((e, i) => {
        const top = tops[i]!
        let line = top + 6
        const nameY = e.name.map(() => (line += 15))
        line += 4
        const eqY = e.equation.map(() => (line += e.size + 3))
        line += 2
        const unitY = e.units.map(() => (line += 15))
        return (
          <g key={`${e.name}|${e.equation}`}>
            {i > 0 && <line x1="14" y1={top} x2={W - 14} y2={top} stroke={RULE} />}
            {e.name.map((text, j) => (
              <text key={`n${j}`} x={PAD} y={nameY[j]} fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill="var(--subject)">{text}</text>
            ))}
            {e.equation.map((text, j) => (
              <text key={`e${j}`} x={PAD} y={eqY[j]} fontFamily={DISPLAY} fontSize={e.size} fontWeight="700" fill={INK}>{text}</text>
            ))}
            {e.units.map((text, j) => (
              <text key={`u${j}`} x={PAD} y={unitY[j]} fontFamily={FONT} fontSize="12" fill={INK_2}>{text}</text>
            ))}
          </g>
        )
      })}
    </svg>
  )
}
