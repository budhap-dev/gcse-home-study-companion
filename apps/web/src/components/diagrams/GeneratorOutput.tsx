import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

/**
 * What comes out of a generator, for AQA 4.7.3.2: the potential difference induced in a
 * spinning coil against time, and the contacts that decide whether it reaches the circuit
 * as ac or dc.
 *
 * The curve is computed, not drawn: the pd is largest when the coil's sides are cutting
 * straight across the field lines, zero a quarter turn later when they move along them,
 * and reversed on the second half of every turn. Slip rings pass that straight out, so an alternator's graph is the full
 * wave. A split-ring commutator swaps the coil's ends over at exactly the moment the pd
 * reverses, so a dynamo's graph is the same wave folded to one side of the axis. The
 * content chooses the device; the shape of the graph follows from it.
 *
 * Props:
 *   kind: 'alternator' | 'dynamo'
 *   view: 'graph' (default) or 'contacts', the coil and its rings seen from the side
 *   compareSpeed: draw a second, dashed graph for the coil turned this many times faster,
 *     which raises the peak and the frequency by the same factor
 *   note: a caption under the drawing
 */
const W = 296

function arrowHead(x: number, y: number, angle: number, colour: string, key: string, size = 7) {
  const back = size, wing = size * 0.55
  const bx = x - back * Math.cos(angle), by = y - back * Math.sin(angle)
  return (
    <polygon
      key={key}
      points={`${x},${y} ${bx - wing * Math.sin(angle)},${by + wing * Math.cos(angle)} ${bx + wing * Math.sin(angle)},${by - wing * Math.cos(angle)}`}
      fill={colour}
    />
  )
}

/** The pd as a fraction of the peak after `turns` revolutions, for each kind of generator. */
export function inducedPd(kind: 'alternator' | 'dynamo', turns: number): number {
  const v = Math.sin(2 * Math.PI * turns)
  return kind === 'dynamo' ? Math.abs(v) : v
}

export function GeneratorOutput({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const kind: 'alternator' | 'dynamo' = props.kind === 'dynamo' ? 'dynamo' : 'alternator'
  const view = props.view === 'contacts' ? 'contacts' : 'graph'
  const note = typeof props.note === 'string' ? props.note : undefined
  const noteH = note ? 20 : 0

  if (view === 'contacts') {
    const H = 190 + noteH
    const cy = 92
    const coilX = 30, coilW = 78, coilH = 52
    const axleEnd = W - 30
    // Rings on the axle, to the right of the coil; the brushes press on them.
    const rings = kind === 'dynamo' ? [{ x: 178, w: 30 }] : [{ x: 166, w: 12 }, { x: 196, w: 12 }]
    const ringH = 38
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 360 }} role="img" aria-label={alt}>
        <rect x="1" y="1" width={W - 2} height={H - 2} rx="12" fill="none" stroke={RULE} />
        {/* The poles above and below, so the coil turns in a vertical field. */}
        <rect x={coilX - 8} y={cy - coilH / 2 - 30} width={coilW + 16} height="18" fill="#c8501f" stroke={INK} strokeWidth="1.2" />
        <rect x={coilX - 8} y={cy + coilH / 2 + 12} width={coilW + 16} height="18" fill="#1f3a93" stroke={INK} strokeWidth="1.2" />
        <text x={coilX + coilW / 2} y={cy - coilH / 2 - 17} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill="#fff">N</text>
        <text x={coilX + coilW / 2} y={cy + coilH / 2 + 25} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill="#fff">S</text>
        {/* The axle, then the coil across it. */}
        <line x1={coilX + 10} y1={cy} x2={axleEnd} y2={cy} stroke={INK_2} strokeWidth="3" />
        <rect x={coilX} y={cy - coilH / 2} width={coilW} height={coilH} fill="none" stroke={ACCENT} strokeWidth="2.5" />
        <text x={coilX + coilW / 2} y={cy - 9} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>coil</text>
        {/* Each end of the coil runs along the axle to its own ring, or to its own half of the split ring. */}
        {[cy - 8, cy + 8].map((wireY, i) => {
          const ring = rings[Math.min(i, rings.length - 1)]!
          return <line key={`w${i}`} x1={coilX + coilW} y1={wireY} x2={ring.x + ring.w / 2} y2={wireY} stroke={ACCENT} strokeWidth="1.4" />
        })}
        {rings.map((ring, i) => (
          <rect key={i} x={ring.x} y={cy - ringH / 2} width={ring.w} height={ringH} rx="3" fill="#e8c46a" stroke={INK} strokeWidth="1.2" />
        ))}
        {kind === 'dynamo' && (
          // The split, along the axle: the two halves are insulated from each other.
          <line x1={rings[0]!.x} y1={cy} x2={rings[0]!.x + rings[0]!.w} y2={cy} stroke={INK} strokeWidth="2.4" />
        )}
        {/* Brushes: one per ring for slip rings, one on each half of a commutator. */}
        {(kind === 'dynamo'
          ? [{ x: 178 + 15, y: cy - ringH / 2 - 10 }, { x: 178 + 15, y: cy + ringH / 2 + 2 }]
          : rings.map((ring) => ({ x: ring.x + ring.w / 2, y: cy + ringH / 2 + 2 }))
        ).map((b, i) => (
          <g key={`b${i}`}>
            <rect x={b.x - 5} y={b.y} width="10" height="8" fill={INK_2} />
            <line x1={b.x} y1={b.y < cy ? b.y : b.y + 8} x2={b.x} y2={b.y < cy ? b.y - 14 : b.y + 22} stroke={INK} strokeWidth="1.4" />
          </g>
        ))}
        <text x={W / 2} y={18} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>
          {kind === 'dynamo' ? 'Dynamo: a split-ring commutator' : 'Alternator: two slip rings'}
        </text>
        <text x={W / 2} y={H - 8 - noteH} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>
          {kind === 'dynamo' ? 'the ends swap brushes every half turn' : 'each coil end keeps its own ring and brush'}
        </text>
        {note && <text x={W / 2} y={H - 7} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>{note}</text>}
      </svg>
    )
  }

  const compare = typeof props.compareSpeed === 'number' && props.compareSpeed > 1 ? props.compareSpeed : undefined
  const H = 228 + noteH
  const padL = 34, padR = 12, top = 38, bottom = H - 58 - noteH
  const cy = (top + bottom) / 2
  const amp = (bottom - top) / 2 - 6
  const turns = 2
  const x = (t: number) => padL + ((W - padL - padR) * t) / turns
  // Amplitude scaled down when a faster coil is drawn over it, so both fit the plot.
  const scale = compare ? 1 / compare : 1
  const y = (v: number) => cy - v * amp * scale
  const path = (speed: number) => {
    const steps = 160 * speed
    return Array.from({ length: steps + 1 }, (_, i) => {
      const t = (turns * i) / steps
      return `${i === 0 ? 'M' : 'L'} ${x(t).toFixed(1)} ${y(speed * inducedPd(kind, t * speed)).toFixed(1)}`
    }).join(' ')
  }
  const ticks = [0.5, 1, 1.5, 2]
  const tickLabel = (t: number) => (t === 0.5 ? '½' : t === 1 ? '1' : t === 1.5 ? '1½' : '2')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 360 }} role="img" aria-label={alt}>
      <rect x="1" y="1" width={W - 2} height={H - 2} rx="12" fill="none" stroke={RULE} />
      {/* Axes: pd up, with zero in the middle so a reversal has somewhere to go; time across. */}
      <line x1={padL} y1={top} x2={padL} y2={bottom} stroke={INK} strokeWidth="1.5" />
      {arrowHead(padL, top - 2, -Math.PI / 2, INK, 'ya')}
      <line x1={padL} y1={cy} x2={W - padR} y2={cy} stroke={INK} strokeWidth="1.5" />
      {arrowHead(W - padR + 2, cy, 0, INK, 'xa')}
      <text x={padL - 6} y={cy + 4} textAnchor="end" fontFamily={FONT} fontSize="11" fill={INK_2}>0</text>
      <text x={padL - 5} y={top + 10} textAnchor="end" fontFamily={FONT} fontSize="12" fill={INK_2}>pd</text>
      <text x={(padL + W - padR) / 2} y={bottom + 30} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>time, in turns of the coil</text>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} y1={top} x2={x(t)} y2={bottom} stroke={RULE} strokeWidth="1" strokeDasharray="3 3" />
          <text x={x(t)} y={bottom + 14} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>{tickLabel(t)}</text>
        </g>
      ))}
      <path d={path(1)} fill="none" stroke={ACCENT} strokeWidth="2.5" />
      {compare && <path d={path(compare)} fill="none" stroke="#d25b3b" strokeWidth="2" strokeDasharray="5 4" />}
      <text x={W / 2} y={18} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>
        {kind === 'dynamo' ? 'Dynamo: dc, never reversing' : 'Alternator: ac, reversing every half turn'}
      </text>
      <text x={W / 2} y={H - 8 - noteH} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>
        {compare ? `dashed: the same coil at ${compare}× the speed` : kind === 'dynamo' ? 'commutator: the ends swap as the pd reverses' : "slip rings: the coil's pd passes straight out"}
      </text>
      {note && <text x={W / 2} y={H - 7} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>{note}</text>}
    </svg>
  )
}
