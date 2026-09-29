import { DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'
import { wrapCell } from './tableLayout.ts'

/**
 * The fourteen standard circuit symbols AQA 8463 lists in 4.2.1.1, each on a tile with its
 * name and what it does, coloured by family so the families read at a glance: what drives
 * the current, what switches or protects it, what measures it, what resists it, and what
 * lets it through one way.
 *
 * Drawn here, not copied: the symbols follow the conventions in AQA's table (the diode and
 * LED inside a circle, the LDR's arrows pointing in, the thermistor's line with a flat
 * foot, the open switch's arm hanging below the gap), redrawn at this app's own line
 * weights.
 *
 * Two tiles a row, 294 units wide, so it fits the 298 a phone's card leaves. A laptop has
 * room for five, which the resource page asks for with `columns`: two a row there left the
 * drawing phone-sized in the middle of a wide card, seven rows deep.
 *
 * Each tile is tagged with what the part is for, in its family's colour. The tag is the
 * part's own, not the family's name: a fuse sits with the switches but does not switch,
 * and "Switch and protect" was wider than the tile it was printed on.
 *
 * Props: { symbols?: SymbolId[] } to show a subset, in the order given (defaults to all);
 * { columns?: number } tiles a row, 2 to 6 (defaults to 2).
 */
export type SymbolId =
  | 'cell' | 'battery' | 'switch-open' | 'switch-closed' | 'fuse' | 'ammeter' | 'voltmeter'
  | 'resistor' | 'variable-resistor' | 'thermistor' | 'ldr' | 'lamp' | 'diode' | 'led'

interface Family { name: string; colour: string }
const POWER: Family = { name: 'Power', colour: '#c2410c' }
const CONTROL: Family = { name: 'Switch and protect', colour: '#1d4ed8' }
const METER: Family = { name: 'Measure', colour: '#047857' }
const RESIST: Family = { name: 'Resist', colour: '#6d28d9' }
const OUTPUT: Family = { name: 'Light and one-way', colour: '#be185d' }

export const SYMBOLS: Record<SymbolId, { name: string; does: string; family: Family; tag: string }> = {
  'cell': { name: 'Cell', does: 'Pushes charge round the circuit. The long line is the positive side.', family: POWER, tag: 'Power' },
  'battery': { name: 'Battery', does: 'Two or more cells joined in series.', family: POWER, tag: 'Power' },
  'switch-open': { name: 'Switch (open)', does: 'A gap in the circuit, so no current flows.', family: CONTROL, tag: 'Switch' },
  'switch-closed': { name: 'Switch (closed)', does: 'Completes the circuit, so current can flow.', family: CONTROL, tag: 'Switch' },
  'fuse': { name: 'Fuse', does: 'Melts and breaks the circuit if the current is too big.', family: CONTROL, tag: 'Protect' },
  'ammeter': { name: 'Ammeter', does: 'Measures current. Connect it in series.', family: METER, tag: 'Measure' },
  'voltmeter': { name: 'Voltmeter', does: 'Measures potential difference (voltage). Connect it in parallel.', family: METER, tag: 'Measure' },
  'resistor': { name: 'Resistor', does: 'A fixed resistance, to limit the current.', family: RESIST, tag: 'Resist' },
  'variable-resistor': { name: 'Variable resistor', does: 'A resistance you can change, like a dimmer.', family: RESIST, tag: 'Resist' },
  'thermistor': { name: 'Thermistor', does: 'Its resistance falls as it gets hotter.', family: RESIST, tag: 'Resist' },
  'ldr': { name: 'LDR', does: 'Light dependent resistor: resistance falls in brighter light.', family: RESIST, tag: 'Resist' },
  'lamp': { name: 'Lamp', does: 'Gives out light. Its resistance rises as it heats up.', family: OUTPUT, tag: 'Light' },
  'diode': { name: 'Diode', does: 'Lets current through one way only: the way the triangle points.', family: OUTPUT, tag: 'One way' },
  'led': { name: 'LED', does: 'Light-emitting diode: gives out light when current flows through it.', family: OUTPUT, tag: 'Light, one way' },
}

const ORDER = Object.keys(SYMBOLS) as SymbolId[]

export const TILE_W = 141
const GAP = 12
/** The drawing's width with `columns` tiles a row. */
export const widthFor = (columns: number) => TILE_W * columns + GAP * (columns - 1)
export const W = widthFor(2)
const SYMBOL_H = 62
/** Characters a description line holds at 12px in a tile's width, at the 0.6 the phone-fit check assumes. */
const DOES_BUDGET = Math.floor((TILE_W - 20) / (12 * 0.6))

/** The symbol itself, centred on (cx, cy), with its leads, stroked in its family's colour. */
function Glyph({ id, cx, cy, c }: { id: SymbolId; cx: number; cy: number; c: string }) {
  const s = { stroke: c, strokeWidth: 2, fill: 'none', strokeLinecap: 'round' as const }
  const leads = (inner: number) => (
    <>
      <line x1={cx - 54} y1={cy} x2={cx - inner} y2={cy} {...s} />
      <line x1={cx + inner} y1={cy} x2={cx + 54} y2={cy} {...s} />
    </>
  )
  const rect = (w: number, h: number) => <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} {...s} fill="#fff" />
  const arrow = (x1: number, y1: number, x2: number, y2: number, key?: string) => {
    const a = Math.atan2(y2 - y1, x2 - x1), h = 6
    return (
      <g key={key}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} {...s} strokeWidth={1.6} />
        <path d={`M${x2} ${y2} L${x2 - h * Math.cos(a - 0.45)} ${y2 - h * Math.sin(a - 0.45)} L${x2 - h * Math.cos(a + 0.45)} ${y2 - h * Math.sin(a + 0.45)} Z`} fill={c} />
      </g>
    )
  }
  const plate = (x: number, long: boolean) => (
    <line x1={x} y1={cy - (long ? 15 : 8)} x2={x} y2={cy + (long ? 15 : 8)} stroke={c} strokeWidth={long ? 2 : 4} />
  )
  const plus = (x: number) => <text x={x} y={cy - 18} textAnchor="middle" fontFamily={FONT} fontSize="12" fontWeight="700" fill={c}>+</text>
  const diode = (
    <>
      <circle cx={cx} cy={cy} r={17} {...s} fill="#fff" />
      <line x1={cx - 17} y1={cy} x2={cx + 17} y2={cy} {...s} />
      <path d={`M${cx - 7} ${cy - 8} L${cx + 6} ${cy} L${cx - 7} ${cy + 8} Z`} {...s} fill="#fff" />
      <line x1={cx + 6} y1={cy - 8} x2={cx + 6} y2={cy + 8} {...s} />
    </>
  )
  switch (id) {
    case 'cell':
      return <g>{leads(4)}{plate(cx - 4, true)}{plate(cx + 4, false)}{plus(cx - 11)}</g>
    case 'battery':
      return (
        <g>
          {leads(22)}{plate(cx - 22, true)}{plate(cx - 14, false)}
          <line x1={cx - 10} y1={cy} x2={cx + 10} y2={cy} stroke={c} strokeWidth={2} strokeDasharray="3 3" />
          {plate(cx + 14, true)}{plate(cx + 22, false)}{plus(cx - 29)}
        </g>
      )
    case 'switch-open':
    case 'switch-closed': {
      const open = id === 'switch-open'
      return (
        <g>
          {leads(21)}
          <circle cx={cx - 18} cy={cy} r={3} {...s} fill="#fff" />
          <circle cx={cx + 18} cy={cy} r={3} {...s} fill="#fff" />
          {/* Open, the arm falls away below the second contact, as AQA's table draws it. */}
          <line x1={cx - 16} y1={open ? cy + 1 : cy - 1} x2={open ? cx + 14 : cx + 16} y2={open ? cy + 16 : cy - 3} {...s} />
        </g>
      )
    }
    case 'fuse':
      return <g>{leads(15)}{rect(30, 12)}<line x1={cx - 15} y1={cy} x2={cx + 15} y2={cy} {...s} /></g>
    case 'ammeter':
    case 'voltmeter':
      return (
        <g>
          {leads(15)}
          <circle cx={cx} cy={cy} r={15} {...s} fill="#fff" />
          <text x={cx} y={cy + 5} textAnchor="middle" fontFamily={FONT} fontSize="15" fontWeight="700" fill={c}>{id === 'ammeter' ? 'A' : 'V'}</text>
        </g>
      )
    case 'resistor':
      return <g>{leads(18)}{rect(36, 14)}</g>
    case 'variable-resistor':
      return <g>{leads(18)}{rect(36, 14)}{arrow(cx - 20, cy + 15, cx + 21, cy - 16)}</g>
    case 'thermistor':
      return (
        <g>
          {leads(18)}{rect(36, 14)}
          <line x1={cx - 18} y1={cy + 16} x2={cx + 18} y2={cy - 16} {...s} />
          <line x1={cx - 27} y1={cy + 16} x2={cx - 18} y2={cy + 16} {...s} />
        </g>
      )
    case 'ldr':
      return (
        <g>
          {leads(17)}
          <circle cx={cx} cy={cy} r={17} {...s} fill="#fff" />
          <rect x={cx - 11} y={cy - 4} width={22} height={8} {...s} fill="#fff" />
          {arrow(cx - 30, cy - 28, cx - 15, cy - 14, 'a')}
          {arrow(cx - 21, cy - 33, cx - 7, cy - 19, 'b')}
        </g>
      )
    case 'lamp':
      return (
        <g>
          {leads(15)}
          <circle cx={cx} cy={cy} r={15} {...s} fill="#fff" />
          <line x1={cx - 10.6} y1={cy - 10.6} x2={cx + 10.6} y2={cy + 10.6} {...s} />
          <line x1={cx - 10.6} y1={cy + 10.6} x2={cx + 10.6} y2={cy - 10.6} {...s} />
        </g>
      )
    case 'diode':
      return <g>{leads(17)}{diode}</g>
    case 'led':
      return <g>{leads(17)}{diode}{arrow(cx + 8, cy - 19, cx + 21, cy - 32, 'a')}{arrow(cx + 16, cy - 15, cx + 29, cy - 28, 'b')}</g>
  }
}

export function CircuitSymbols({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const asked = Array.isArray(props.symbols) ? (props.symbols as string[]).filter((s): s is SymbolId => s in SYMBOLS) : []
  const ids = asked.length ? asked : ORDER
  const columns = Math.max(2, Math.min(6, Math.round(Number(props.columns)) || 2))
  const width = widthFor(Math.min(columns, Math.max(2, ids.length)))

  // Every tile in a row takes the height of the tallest in it, so the grid stays square.
  const tiles = ids.map((id) => ({ id, ...SYMBOLS[id], lines: wrapCell(SYMBOLS[id].does, DOES_BUDGET) }))
  const heightOf = (lines: number) => SYMBOL_H + 16 + 18 + lines * 15 + 10
  const rows: { top: number; height: number }[] = []
  let y = 0
  for (let r = 0; r < Math.ceil(tiles.length / columns); r++) {
    const inRow = tiles.slice(r * columns, (r + 1) * columns)
    const height = heightOf(Math.max(...inRow.map((t) => t.lines.length)))
    rows.push({ top: y, height })
    y += height + GAP
  }
  const H = y - GAP + 2

  return (
    // Two a row is capped where a phone-sized drawing stays a sensible size; wider
    // layouts grow with the card, to half as big again as drawn.
    <svg viewBox={`0 0 ${width} ${H}`} width="100%" style={{ maxWidth: columns === 2 ? 440 : Math.round(width * 1.5) }} role="img" aria-label={alt}>
      {tiles.map((t, i) => {
        const row = rows[Math.floor(i / columns)]!
        const x = (i % columns) * (TILE_W + GAP)
        const c = t.family.colour
        return (
          <g key={t.id} data-symbol={t.id}>
            <rect x={x + 1} y={row.top + 1} width={TILE_W - 2} height={row.height - 2} rx="12" fill="#fff" stroke={RULE} />
            <rect x={x + 1} y={row.top + 1} width={TILE_W - 2} height={SYMBOL_H} rx="12" fill={c} fillOpacity={0.07} />
            <Glyph id={t.id} cx={x + TILE_W / 2} cy={row.top + SYMBOL_H / 2 + 4} c={c} />
            <text x={x + 10} y={row.top + SYMBOL_H + 14} fontFamily={FONT} fontSize="11" fontWeight="700" letterSpacing="0.06em" fill={c}>{t.tag.toUpperCase()}</text>
            <text x={x + 10} y={row.top + SYMBOL_H + 32} fontFamily={DISPLAY} fontSize="14" fontWeight="700" fill={INK}>{t.name}</text>
            {t.lines.map((line, j) => (
              <text key={j} x={x + 10} y={row.top + SYMBOL_H + 50 + j * 15} fontFamily={FONT} fontSize="12" fill={INK_2}>{line}</text>
            ))}
          </g>
        )
      })}
    </svg>
  )
}
