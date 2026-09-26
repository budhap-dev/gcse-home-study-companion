import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

interface Curve {
  /** saturating: y = max·x/(k + x). optimum: rises to a peak then falls steeply. linear: y = m·x. inverse-square: y = k/x². */
  kind: 'saturating' | 'optimum' | 'linear' | 'inverse-square'
  label?: string
  /** Where along x to put the label, just above the curve. Omit to label the right-hand end. */
  labelX?: number
  colour?: string
  max?: number
  k?: number
  m?: number
  peak?: number
  dashed?: boolean
}
interface Marker { x: number; label: string }

/**
 * Greedy word wrap to a room measured the same way the phone-fit test measures text: a
 * character is 0.6 × the font size wide. A word longer than the room is left on its own
 * line rather than split.
 */
function wrapWords(text: string, size: number, room: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (line && candidate.length * size * 0.6 > room) { lines.push(line); line = word }
    else line = candidate
  }
  if (line) lines.push(line)
  return lines
}

/**
 * Qualitative curves for rate graphs: limiting factors, temperature optima, inverse square.
 * Props: xLabel, yLabel, xMax (default 10), curves Curve[], markers [{x, label}] drawn as dashed verticals,
 * numbers true to show axis numbers (off by default, because these graphs are about shape).
 */
export function CurveGraph({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const xMax = Number(props.xMax ?? 10)
  const curves = (props.curves as Curve[] | undefined) ?? [{ kind: 'saturating' }]
  const markers = (props.markers as Marker[] | undefined) ?? []
  const numbers = props.numbers === true
  // 280 rather than 360: at 360 this scrolled 62px on a phone. The axes scale off pad and
  // W together, so narrowing both keeps the same proportions.
  const W = 280, H = 240, pad = 30
  const f = (c: Curve, x: number) => {
    switch (c.kind) {
      case 'saturating': return (c.max ?? 1) * x / ((c.k ?? xMax / 4) + x)
      case 'optimum': { const p = c.peak ?? xMax * 0.6; const m = c.max ?? 1; return x <= p ? m * Math.exp(-(((x - p) / (0.45 * p)) ** 2)) : m * Math.exp(-(((x - p) / (0.15 * xMax)) ** 2)) }
      case 'linear': return (c.m ?? 1) * x
      case 'inverse-square': return (c.k ?? 1) / Math.max(x, xMax / 20) ** 2
    }
  }
  const samples = curves.map((c) => Array.from({ length: 81 }, (_, i) => f(c, (i / 80) * xMax)))
  const yMax = Math.max(...samples.flat().filter(Number.isFinite), 1e-9) * 1.1
  const sx = (x: number) => pad + (x / xMax) * (W - 2 * pad)
  /**
   * Clamped at both ends, not just the top. These curves are all meant to be positive,
   * but a curve that is not — `linear` with a negative gradient, say — collapsed the
   * scale and produced coordinates in the tens of millions, which pushed the rest of the
   * page off screen and left the lesson's buttons unclickable. A diagram should degrade
   * to a wrong-looking line, never break the page around it.
   */
  const sy = (y: number) => H - pad - (Math.max(0, Math.min(y, yMax)) / yMax) * (H - 2 * pad)
  const palette = [ACCENT, '#d25b3b', '#1f3a93', '#2e8b57']
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 440 }} role="img" aria-label={alt}>
      {[0.25, 0.5, 0.75, 1].map((k) => <line key={k} x1={pad} y1={sy(k * yMax)} x2={W - pad} y2={sy(k * yMax)} stroke={RULE} />)}
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke={INK} strokeWidth="1.5" />
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke={INK} strokeWidth="1.5" />
      {numbers && [0, 0.25, 0.5, 0.75, 1].map((k) => <text key={`n${k}`} x={sx(k * xMax)} y={H - pad + 14} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>{Number((k * xMax).toFixed(2))}</text>)}
      {/*
        * Every line first, then every label, each on its own white halo. Drawn curve by
        * curve, a later curve was painted over an earlier curve's label ("first exposure"
        * with the second-exposure peak through it), and the marker labels came before any
        * curve, so a peak ran through "optimum, about 37 °C". On top, the halo keeps each
        * label readable wherever a line passes behind it.
        */}
      {markers.map((m, i) => <line key={`ml${i}`} x1={sx(m.x)} y1={pad} x2={sx(m.x)} y2={H - pad} stroke={INK_2} strokeDasharray="4 4" />)}
      {curves.map((c, i) => (
        <path
          key={`c${i}`}
          d={samples[i]!.map((y, j) => `${j ? 'L' : 'M'}${sx((j / 80) * xMax).toFixed(1)} ${sy(y).toFixed(1)}`).join(' ')}
          fill="none" stroke={c.colour ?? palette[i % palette.length]!} strokeWidth="2.5" strokeDasharray={c.dashed ? '6 5' : undefined} strokeLinecap="round"
        />
      ))}
      {markers.map((m, i) => {
        const x = sx(m.x)
        // A label naming what lies on each side of the line ("light limiting | something
        // else limiting") is split and set on its own side, so neither half has to fit in
        // the whole width; anything else wraps onto as many lines as it needs.
        const sides = m.label.split('|').map((s) => s.trim())
        const halo = { fontFamily: FONT, fontSize: '11', fill: INK_2, stroke: '#ffffff', strokeWidth: '3.5', paintOrder: 'stroke' } as const
        return (
          <g key={`m${i}`}>
            {sides.length === 2 ? (
              <>
                {wrapWords(sides[0]!, 11, x - pad - 4).map((line, j) => <text key={`ml${j}`} x={x - 4} y={pad + 12 + j * 13} textAnchor="end" {...halo}>{line}</text>)}
                {wrapWords(sides[1]!, 11, W - pad - x - 4).map((line, j) => <text key={`mr${j}`} x={x + 4} y={pad + 12 + j * 13} textAnchor="start" {...halo}>{line}</text>)}
              </>
            ) : (
              wrapWords(m.label, 11, W - pad - x - 4).map((line, j) => <text key={`m${j}`} x={x + 4} y={pad + 12 + j * 13} {...halo}>{line}</text>)
            )}
          </g>
        )
      })}
      {curves.map((c, i) => {
        if (!c.label) return null
        const colour = c.colour ?? palette[i % palette.length]!
        const yEnd = samples[i]![80]!
        // Curves that all end near zero would print their labels on top of each other, so a curve can name its own spot.
        const at = typeof c.labelX === 'number' ? { x: sx(c.labelX), y: sy(f(c, c.labelX)) - 8, anchor: 'middle' as const } : { x: W - pad - 4, y: sy(yEnd) - 6, anchor: 'end' as const }
        return (
          <text
            key={`cl${i}`} x={at.x} y={at.y} textAnchor={at.anchor}
            fontFamily={DISPLAY} fontSize="11" fontWeight="700" fill={colour}
            stroke="#ffffff" strokeWidth="3.5" paintOrder="stroke"
          >
            {c.label}
          </text>
        )
      })}
      <text x={W / 2} y={H - 4} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK}>{String(props.xLabel ?? 'x')}</text>
      <text x={pad} y={pad - 10} fontFamily={FONT} fontSize="11" fill={INK}>{String(props.yLabel ?? 'y')}</text>
    </svg>
  )
}
