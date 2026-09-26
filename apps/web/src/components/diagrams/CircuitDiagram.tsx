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

  /*
   * 290 units wide, inside the 296 a phone's card allows. At 440 (and with the free-text
   * note drawn on a single line) this scrolled up to 142px on a phone — the caption alone
   * ("Standard symbols: rectangle, triangle and bar, circle with a cross", 68 characters)
   * needed about 490 units on one line. The note now wraps; everything else keeps its
   * on-screen size, laid out over the narrower width instead of shrunk to fit it.
   */
  const W = 290
  const rows = parallel ? parts.length : 1
  // Label above (to -26) and resistance and readings below (to +49): a stack about 90px
  // tall, so branches closer than that run into each other.
  const BRANCH_GAP = 96
  const NOTE_BUDGET = 36
  const fallback = parallel
    ? `The same ${pd} V across each branch; the currents add to ${round(totalI)} A`
    : `Total resistance ${round(totalR)} Ω, so the current is ${round(totalI)} A everywhere in the loop`
  const bottomText = showValues ? (note ?? fallback) : note
  const bottomLines = bottomText ? wrapCell(bottomText, NOTE_BUDGET) : []
  const noteExtra = Math.max(0, bottomLines.length - 1) * 14
  const H = (parallel ? 110 + rows * BRANCH_GAP : 240) + noteExtra
  const left = 46, right = W - 46, top = 66, bottom = H - noteExtra - 48
  const midY = (top + bottom) / 2
  /** The note/caption, wrapped to fit the width, stacked upward from the bottom edge. */
  const bottomNote = (
    <>
      {bottomLines.map((line, i) => (
        <text key={i} x={W / 2} y={H - 10 - (bottomLines.length - 1 - i) * 14} textAnchor="middle" fill={INK_2} style={{ font: FONT, fontSize: 12 }}>
          {line}
        </text>
      ))}
    </>
  )

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
    /*
     * One loop, with the parts spaced evenly between the corners, each inset just far
     * enough (half a symbol's width plus its own wire gap) to clear the corner wire. That
     * gives three parts the most room this width allows to spread their labels apart.
     */
    // Three or more parts need a tighter gap around each symbol to leave room to spread out.
    const gap = parts.length >= 3 ? 14 : 26
    const half = 23
    const inset = half + gap
    const spanL = left + inset, spanR = right - inset
    const at = parts.length === 1 ? [(left + right) / 2] : parts.map((_, i) => spanL + ((spanR - spanL) * i) / (parts.length - 1))
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
        {bottomNote}
      </svg>
    )
  }

  // Parallel: two vertical rails, one branch per part.
  const railL = 150, railR = right
  const branchY = parts.map((_, i) => top + 24 + i * BRANCH_GAP)
  const lastY = branchY[branchY.length - 1]!
  const loopBottom = H - noteExtra - 26
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
      {wire(railR, lastY, railR, loopBottom, 'rd')}
      {wire(railR, loopBottom, left, loopBottom, 'bb')}
      {wire(left, loopBottom, left, midY + CELL_GAP, 'lb')}
      {cell(left, midY)}
      {parts.map((p, i) => symbol(p, (railL + railR) / 2, branchY[i]!, `p${i}`))}
      {bottomNote}
    </svg>
  )
}
