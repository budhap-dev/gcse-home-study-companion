import { ACCENT, DISPLAY, FONT, INK, INK_2 } from './index.tsx'
import { wrapCell } from './tableLayout.ts'

interface Part {
  kind: 'resistor' | 'lamp' | 'switch' | 'diode' | 'thermistor' | 'ldr' | 'ammeter' | 'voltmeter' | 'motor'
  label?: string
  /** Ohms. Given for resistors and lamps, so the readings can be worked out. */
  resistance?: number
}

/**
 * A circuit diagram in standard symbols, which AQA 4.2.1.1 asks students to draw and
 * interpret, laid out either in series or in parallel.
 *
 * The readings are not given by the content: with a supply pd and the resistances, the
 * component works out the total resistance, the current and the pd across each part and
 * writes those on the diagram. So a diagram can never show a set of values that breaks
 * V = IR or the series and parallel rules — which is exactly what the lesson beside it
 * is teaching.
 *
 * Props: supply {pd, label}, arrangement ('series' | 'parallel'), parts Part[],
 * showValues (default true when every resistance is given), note.
 */
export function CircuitDiagram({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const parts = (props.parts as Part[] | undefined) ?? []
  const supply = (props.supply as { pd?: number; label?: string } | undefined) ?? {}
  const parallel = props.arrangement === 'parallel'
  const note = typeof props.note === 'string' ? props.note : undefined
  if (parts.length === 0) return <p style={{ color: INK_2, font: FONT }}>{alt}</p>

  // Only components that carry a resistance are part of the sums; a switch or an
  // ammeter sits in the circuit without affecting it.
  const loads = parts.filter((p) => typeof p.resistance === 'number' && p.resistance > 0)
  const pd = typeof supply.pd === 'number' ? supply.pd : undefined
  const canCompute = pd !== undefined && loads.length > 0 && loads.length === parts.filter((p) => p.kind === 'resistor' || p.kind === 'lamp').length
  const showValues = props.showValues === undefined ? canCompute : props.showValues === true && canCompute

  const totalR = parallel
    ? 1 / loads.reduce((t, p) => t + 1 / p.resistance!, 0)
    : loads.reduce((t, p) => t + p.resistance!, 0)
  const totalI = pd !== undefined ? pd / totalR : 0
  const round = (v: number) => Number(v.toFixed(2))
  /** Series: the same current everywhere, pd shared. Parallel: the same pd, current shared. */
  const reading = (p: Part) =>
    parallel
      ? { i: round(pd! / p.resistance!), v: round(pd!) }
      : { i: round(totalI), v: round(totalI * p.resistance!) }

  const W = 440
  const rows = parallel ? loads.length : 1
  // Label above (to -26) and resistance and readings below (to +49): a stack about 90px
  // tall, so branches closer than that run into each other.
  const BRANCH_GAP = 96
  const H = parallel ? 110 + rows * BRANCH_GAP : 240
  const left = 46, right = W - 46, top = 66, bottom = H - 48
  const midY = (top + bottom) / 2

  const symbol = (p: Part, cx: number, cy: number, key: string) => {
    const box = 46, half = box / 2
    const g = (children: React.ReactNode) => (
      <g key={key}>
        {children}
        {p.label && (
          <text x={cx} y={cy - 26} textAnchor="middle" fill={INK} style={{ font: DISPLAY, fontSize: 13, fontWeight: 600 }}>
            {p.label}
          </text>
        )}
        {typeof p.resistance === 'number' && (
          <text x={cx} y={cy + 34} textAnchor="middle" fill={INK_2} style={{ font: FONT, fontSize: 12 }}>
            {p.resistance} Ω
          </text>
        )}
        {showValues && typeof p.resistance === 'number' && (
          <text x={cx} y={cy + 49} textAnchor="middle" fill={ACCENT} style={{ font: DISPLAY, fontSize: 12, fontWeight: 600 }}>
            {reading(p).v} V, {reading(p).i} A
          </text>
        )}
      </g>
    )
    switch (p.kind) {
      case 'resistor':
      case 'thermistor':
      case 'ldr':
        return g(
          <>
            <rect x={cx - half} y={cy - 11} width={box} height={22} fill="none" stroke={INK} strokeWidth={1.8} />
            {p.kind === 'thermistor' && <line x1={cx - half - 6} y1={cy + 16} x2={cx + half - 4} y2={cy - 16} stroke={INK} strokeWidth={1.6} />}
            {p.kind === 'ldr' && (
              <>
                <circle cx={cx} cy={cy} r={24} fill="none" stroke={INK} strokeWidth={1.2} />
                <line x1={cx - 30} y1={cy - 32} x2={cx - 14} y2={cy - 20} stroke={INK} strokeWidth={1.4} />
                <line x1={cx - 20} y1={cy - 36} x2={cx - 4} y2={cy - 24} stroke={INK} strokeWidth={1.4} />
              </>
            )}
          </>,
        )
      case 'lamp':
        return g(
          <>
            <circle cx={cx} cy={cy} r={15} fill="none" stroke={INK} strokeWidth={1.8} />
            <line x1={cx - 10.6} y1={cy - 10.6} x2={cx + 10.6} y2={cy + 10.6} stroke={INK} strokeWidth={1.6} />
            <line x1={cx - 10.6} y1={cy + 10.6} x2={cx + 10.6} y2={cy - 10.6} stroke={INK} strokeWidth={1.6} />
          </>,
        )
      case 'switch':
        return g(
          <>
            <circle cx={cx - 15} cy={cy} r={3} fill={INK} />
            <circle cx={cx + 15} cy={cy} r={3} fill={INK} />
            <line x1={cx - 15} y1={cy} x2={cx + 12} y2={cy - 14} stroke={INK} strokeWidth={1.8} />
          </>,
        )
      case 'diode':
        return g(
          <>
            <polygon points={`${cx - 12},${cy - 12} ${cx - 12},${cy + 12} ${cx + 8},${cy}`} fill="none" stroke={INK} strokeWidth={1.8} />
            <line x1={cx + 8} y1={cy - 12} x2={cx + 8} y2={cy + 12} stroke={INK} strokeWidth={1.8} />
          </>,
        )
      case 'motor':
        return g(
          <>
            <circle cx={cx} cy={cy} r={15} fill="none" stroke={INK} strokeWidth={1.8} />
            <text x={cx} y={cy + 5} textAnchor="middle" fill={INK} style={{ font: DISPLAY, fontSize: 14, fontWeight: 700 }}>M</text>
          </>,
        )
      default:
        return g(
          <>
            <circle cx={cx} cy={cy} r={15} fill="none" stroke={INK} strokeWidth={1.8} />
            <text x={cx} y={cy + 5} textAnchor="middle" fill={INK} style={{ font: DISPLAY, fontSize: 14, fontWeight: 700 }}>
              {p.kind === 'ammeter' ? 'A' : 'V'}
            </text>
          </>,
        )
    }
  }

  /**
   * A cell: one long thin plate and one short thick one, the long side positive. It sits
   * on the left-hand vertical wire, so the plates run ACROSS that wire. Drawn along it,
   * as the first version had them, the long plate lies on top of the wire and the symbol
   * reads as a single thick bar.
   */
  const CELL_GAP = 13
  const cell = (cx: number, cy: number) => (
    <g>
      <line x1={cx - 16} y1={cy - 6} x2={cx + 16} y2={cy - 6} stroke={INK} strokeWidth={1.6} />
      <line x1={cx - 8} y1={cy + 6} x2={cx + 8} y2={cy + 6} stroke={INK} strokeWidth={4} />
      {pd !== undefined && (
        <text x={cx + 22} y={cy + 30} textAnchor="middle" fill={INK} style={{ font: DISPLAY, fontSize: 13, fontWeight: 600 }}>
          {pd} V
        </text>
      )}
      {/*
       * The label sits to the right of the cell, starting clear of the plates, and wraps
       * to short lines stacked upwards. Centred at cx + 24 it straddled the wire for any
       * label longer than "cell": "car battery" drew with the wire through its first
       * letter, which no test saw until a walk sampled the wire against the text box.
       */}
      {supply.label &&
        wrapCell(supply.label, 11).map((line, i, lines) => (
          <text key={i} x={cx + 22} y={cy - 18 - (lines.length - 1 - i) * 14} textAnchor="start" fill={INK_2} style={{ font: FONT, fontSize: 12 }}>
            {line}
          </text>
        ))}
    </g>
  )

  const wire = (x1: number, y1: number, x2: number, y2: number, key: string) => (
    <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={1.8} />
  )

  if (!parallel) {
    // One loop, with the parts spaced along the top wire.
    const span = right - left
    const at = parts.map((_, i) => left + (span * (i + 1)) / (parts.length + 1))
    const gap = 26
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: `${W}px` }} role="img" aria-label={alt}>
        {wire(left, midY - CELL_GAP, left, top, 'lu')}
        {wire(left, bottom, left, midY + CELL_GAP, 'ld')}
        {wire(left, top, at[0]! - gap, top, 'w0')}
        {parts.map((_, i) => (i === parts.length - 1 ? null : wire(at[i]! + gap, top, at[i + 1]! - gap, top, `w${i + 1}`)))}
        {wire(at[parts.length - 1]! + gap, top, right, top, 'wr')}
        {wire(right, top, right, bottom, 'rr')}
        {wire(right, bottom, left, bottom, 'bb')}
        {cell(left, midY)}
        {parts.map((p, i) => symbol(p, at[i]!, top, `p${i}`))}
        {showValues && (
          <text x={W / 2} y={H - 10} textAnchor="middle" fill={INK_2} style={{ font: FONT, fontSize: 12 }}>
            {note ?? `Total resistance ${round(totalR)} Ω, so the current is ${round(totalI)} A everywhere in the loop`}
          </text>
        )}
        {!showValues && note && (
          <text x={W / 2} y={H - 10} textAnchor="middle" fill={INK_2} style={{ font: FONT, fontSize: 12 }}>
            {note}
          </text>
        )}
      </svg>
    )
  }

  // Parallel: two vertical rails, one branch per part.
  const railL = 150, railR = right
  const branchY = parts.map((_, i) => top + 24 + i * BRANCH_GAP)
  const lastY = branchY[branchY.length - 1]!
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: `${W}px` }} role="img" aria-label={alt}>
      {wire(left, midY - CELL_GAP, left, branchY[0]!, 'lu')}
      {wire(left, branchY[0]!, railL, branchY[0]!, 'lt')}
      {wire(railL, branchY[0]!, railL, lastY, 'rail-l')}
      {wire(railR, branchY[0]!, railR, lastY, 'rail-r')}
      {parts.map((_, i) => (
        <g key={`b${i}`}>
          {wire(railL, branchY[i]!, (railL + railR) / 2 - 26, branchY[i]!, `bl${i}`)}
          {wire((railL + railR) / 2 + 26, branchY[i]!, railR, branchY[i]!, `br${i}`)}
        </g>
      ))}
      {wire(railR, lastY, railR, H - 26, 'rd')}
      {wire(railR, H - 26, left, H - 26, 'bb')}
      {wire(left, H - 26, left, midY + CELL_GAP, 'lb')}
      {cell(left, midY)}
      {parts.map((p, i) => symbol(p, (railL + railR) / 2, branchY[i]!, `p${i}`))}
      {showValues && (
        <text x={W / 2} y={H - 8} textAnchor="middle" fill={INK_2} style={{ font: FONT, fontSize: 12 }}>
          {note ?? `The same ${pd} V across each branch; the currents add to ${round(totalI)} A`}
        </text>
      )}
      {!showValues && note && (
        <text x={W / 2} y={H - 8} textAnchor="middle" fill={INK_2} style={{ font: FONT, fontSize: 12 }}>
          {note}
        </text>
      )}
    </svg>
  )
}
