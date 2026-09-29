import { DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'
import { wrapCell } from './tableLayout.ts'

/**
 * The pH scale from 0 to 14 in the colours universal indicator turns, with everyday
 * substances placed on it (AQA 8462 4.4.2.4). The substances sit in a list under the bar,
 * each with a swatch of its own colour and its pH, rather than as labels pointing into
 * the bar: fourteen cells 19 units wide leave no room for a label that does not collide.
 *
 * Indicator colours vary a little by brand; these are the usual chart's, and the words
 * (red, orange, yellow, green, blue, purple) are in the list, so the colour is never the
 * only way to read it.
 *
 * Props: { substances?: { name: string; ph: number; label?: string }[] }. Defaults to the
 * common examples.
 */
interface Substance { name: string; ph: number; label?: string }

// pH 2 was '#f06b32', an orange, beside the word "red": lemon juice's swatch matched vinegar's.
export const INDICATOR = ['#d7191c', '#dd2a20', '#e43d25', '#f7943c', '#fbb645', '#f5d547', '#c9dc4f', '#5fb34a', '#2f9d6f', '#1d8a99', '#2166ac', '#2f4b9c', '#4b3b8f', '#5a2d82', '#4a1f6b']
const COLOUR_WORD = (ph: number) => (ph <= 2 ? 'red' : ph <= 4 ? 'orange' : ph <= 6 ? 'yellow' : ph === 7 ? 'green' : ph === 8 ? 'blue-green' : ph <= 10 ? 'blue' : 'purple')

const DEFAULT: Substance[] = [
  { name: 'Stomach acid', ph: 1, label: 'about 1 to 2' },
  { name: 'Lemon juice', ph: 2 },
  { name: 'Vinegar', ph: 3 },
  { name: 'Pure water', ph: 7 },
  { name: 'Baking soda solution', ph: 8 },
  { name: 'Soap', ph: 10 },
  { name: 'Oven cleaner', ph: 13 },
]

export const W = 294
const CELL = 19
const BAR_X = (W - CELL * 15) / 2
const BUDGET = Math.floor((W - 64) / (12 * 0.6))

export function PhScale({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const substances = (props.substances as Substance[] | undefined) ?? DEFAULT
  const barTop = 30
  const listTop = barTop + CELL + 46
  const rows = substances.map((s) => ({ ...s, lines: wrapCell(`${s.name}: pH ${s.label ?? s.ph}, ${COLOUR_WORD(s.ph)}`, BUDGET) }))
  const tops: number[] = []
  let y = listTop
  for (const r of rows) { tops.push(y); y += 8 + r.lines.length * 15 }
  const H = y + 8

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 440 }} role="img" aria-label={alt}>
      <text x={BAR_X} y={18} fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill="#b3261e">← more acidic</text>
      <text x={W - BAR_X} y={18} textAnchor="end" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill="#4b3b8f">more alkaline →</text>
      {INDICATOR.map((c, ph) => (
        <g key={ph}>
          <rect x={BAR_X + ph * CELL} y={barTop} width={CELL} height={CELL + 6} fill={c} />
          <text x={BAR_X + ph * CELL + CELL / 2} y={barTop + CELL + 22} textAnchor="middle" fontFamily={FONT} fontSize="11" fontWeight="700" fill={INK}>{ph}</text>
        </g>
      ))}
      <rect x={BAR_X} y={barTop} width={CELL * 15} height={CELL + 6} fill="none" stroke={INK_2} rx="3" />
      <text x={BAR_X + 7 * CELL + CELL / 2} y={barTop - 4} textAnchor="middle" fontFamily={FONT} fontSize="11" fontWeight="700" fill="#2f7d32">neutral</text>
      <line x1={BAR_X} y1={listTop - 12} x2={W - BAR_X} y2={listTop - 12} stroke={RULE} />
      {rows.map((r, i) => (
        <g key={r.name} data-substance={r.name}>
          <rect x={BAR_X} y={tops[i]! + 2} width={14} height={14} rx="4" fill={INDICATOR[Math.round(r.ph)]} stroke="#0003" />
          <text x={BAR_X + 24} y={tops[i]! + 14} fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>{r.ph}</text>
          {r.lines.map((line, j) => (
            <text key={j} x={BAR_X + 46} y={tops[i]! + 14 + j * 15} fontFamily={FONT} fontSize="12" fill={INK}>{line}</text>
          ))}
        </g>
      ))}
    </svg>
  )
}
