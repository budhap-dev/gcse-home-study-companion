import { ACCENT, DISPLAY, FONT, INK, INK_2 } from './index.tsx'

interface Force {
  direction: 'left' | 'right' | 'up' | 'down'
  /** Size in newtons; arrow length follows it. Zero draws nothing. */
  size: number
  label?: string
}

/**
 * A free body diagram: one object as a box, with every force on it drawn as an arrow
 * from the box whose length follows the size of the force. The resultant is worked out
 * from the arrows and written underneath, so a balanced pair visibly cancels and an
 * unbalanced pair visibly does not.
 *
 * Arrow length uses a square-root scale, as the collision diagram does: a car's 500 N
 * of drag beside its 8000 N weight still gets a visible arrow, and the larger force
 * still gets the longer one. The canvas grows to fit the longest vertical arrow and the
 * labels, never wider than a phone.
 * Props: { object: string, forces: Force[], resultant: boolean (default true), unit }.
 */
export function FreeBody({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const object = String(props.object ?? 'object')
  const forces = ((props.forces as Force[] | undefined) ?? []).filter((f) => f.size !== 0)
  const showResultant = props.resultant !== false
  const unit = String(props.unit ?? 'N')
  // Laid out for a 296-unit phone card (it was up to 500 wide and scrolled). A horizontal
  // force's name and size sit above its arrow, stacked, rather than beyond its tip, which
  // is what needed the width; beside the tip on a phone, the arrow ran through its own label.
  const W = 296
  const bw = 88, bh = 56
  const cx = W / 2
  const maxF = Math.max(...forces.map((f) => Math.abs(f.size)), 1)
  const len = (f: Force) => 22 + Math.sqrt(Math.abs(f.size) / maxF) * 66
  // Five digits and up get a thin space, as the exam prints them: 8000 N but 12 000 N.
  const fmt = (v: number) => { const n = Number(v.toFixed(3)); return Math.abs(n) >= 10000 ? n.toLocaleString('en-GB').replace(/,/g, ' ') : String(n) }
  /** Words onto lines of at most `max` characters. */
  const wrap = (text: string, max: number) => {
    const lines: string[] = []
    for (const word of text.split(' ').filter(Boolean)) {
      const last = lines[lines.length - 1]
      if (last !== undefined && `${last} ${word}`.length <= max) lines[lines.length - 1] = `${last} ${word}`
      else lines.push(word)
    }
    return lines
  }
  /** A force's label as lines: its name, wrapped, then its size. */
  const labelLines = (f: Force) => [...(f.label ? wrap(f.label, 13) : []), `${fmt(Math.abs(f.size))} ${unit}`]
  const LINE = 14
  const CHAR = 7.2 // 0.6 × 12

  const byDir: Record<Force['direction'], Force[]> = { left: [], right: [], up: [], down: [] }
  for (const f of forces) byDir[f.direction].push(f)
  const longest = (d: Force['direction']) => Math.max(0, ...byDir[d].map(len))
  const tallest = (d: Force['direction']) => Math.max(0, ...byDir[d].map((f) => labelLines(f).length))
  // Room above and below the box for the longest arrow, its head and its label.
  const topNeed = byDir.up.length ? longest('up') + 16 + tallest('up') * LINE : 16
  const sideLabelsNeed = Math.max(tallest('left'), tallest('right')) * LINE + 12 - bh / 2
  const cy = Math.max(topNeed, 8 + sideLabelsNeed) + bh / 2
  const bottomNeed = byDir.down.length ? longest('down') + 14 + tallest('down') * LINE : 16
  const H = cy + bh / 2 + bottomNeed + (showResultant ? 46 : 0)
  // A number keeps its unit on its line: "car at" over "20 m/s", not "car at 20" over "m/s".
  const objectLines = wrap(object.replace(/(\d) (?=[^\d\s])/g, '$1\u00a0'), 10)

  // Several forces in one direction stack side by side so both stay readable.
  const arrow = (f: Force, i: number, n: number) => {
    const l = len(f)
    const offset = (i - (n - 1) / 2) * 22
    const horizontal = f.direction === 'left' || f.direction === 'right'
    const sign = f.direction === 'right' || f.direction === 'down' ? 1 : -1
    const x0 = horizontal ? cx + sign * (bw / 2) : cx + offset
    const y0 = horizontal ? cy + offset : cy + sign * (bh / 2)
    const x1 = horizontal ? x0 + sign * l : x0
    const y1 = horizontal ? y0 : y0 + sign * l
    const head = horizontal
      ? `${x1 + sign * 9},${y1} ${x1 - sign * 2},${y1 - 6} ${x1 - sign * 2},${y1 + 6}`
      : `${x1},${y1 + sign * 9} ${x1 - 6},${y1 - sign * 2} ${x1 + 6},${y1 - sign * 2}`
    const lines = labelLines(f)
    let text: React.ReactNode
    if (horizontal) {
      // Centred over the arrow, but kept inside its own side of the box and inside the card.
      const w = Math.max(...lines.map((t) => t.length)) * CHAR
      const lo = sign > 0 ? cx + bw / 2 + 4 + w / 2 : 3 + w / 2
      const hi = sign > 0 ? W - 3 - w / 2 : cx - bw / 2 - 4 - w / 2
      const tx = Math.min(hi, Math.max(lo, (x0 + x1) / 2))
      text = lines.map((t, k) => (
        <text key={k} x={tx} y={y0 - 10 - (lines.length - 1 - k) * LINE} textAnchor="middle" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={INK}>{t}</text>
      ))
    } else {
      const first = sign > 0 ? y1 + 24 : y1 - 14 - (lines.length - 1) * LINE
      text = lines.map((t, k) => (
        <text key={k} x={x1} y={first + k * LINE} textAnchor="middle" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={INK}>{t}</text>
      ))
    }
    return (
      <g key={`${f.direction}${i}`}>
        <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={ACCENT} strokeWidth="3" strokeLinecap="round" />
        <polygon points={head} fill={ACCENT} />
        {text}
      </g>
    )
  }

  const netX = byDir.right.reduce((s, f) => s + Math.abs(f.size), 0) - byDir.left.reduce((s, f) => s + Math.abs(f.size), 0)
  const netY = byDir.up.reduce((s, f) => s + Math.abs(f.size), 0) - byDir.down.reduce((s, f) => s + Math.abs(f.size), 0)
  const parts: string[] = []
  if (netX !== 0) parts.push(`${fmt(Math.abs(netX))} ${unit} to the ${netX > 0 ? 'right' : 'left'}`)
  if (netY !== 0) parts.push(`${fmt(Math.abs(netY))} ${unit} ${netY > 0 ? 'upwards' : 'downwards'}`)
  const resultant = parts.length === 0 ? `0 ${unit}: the forces are balanced` : parts.join(' and ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 540 }} role="img" aria-label={alt}>
      <rect x={cx - bw / 2} y={cy - bh / 2} width={bw} height={bh} rx="8" fill="var(--subject-soft)" stroke={INK} strokeWidth="2" />
      {objectLines.map((t, k) => (
        <text key={`o${k}`} x={cx} y={cy + 5 + (k - (objectLines.length - 1) / 2) * 16} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>{t}</text>
      ))}
      {(['left', 'right', 'up', 'down'] as const).flatMap((d) => byDir[d].map((f, i) => arrow(f, i, byDir[d].length)))}
      {showResultant && (
        <g>
          <text x={cx} y={H - 26} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>Resultant force</text>
          <text x={cx} y={H - 8} textAnchor="middle" fontFamily={DISPLAY} fontSize="14" fontWeight="700" fill={ACCENT}>{resultant}</text>
        </g>
      )}
    </svg>
  )
}
