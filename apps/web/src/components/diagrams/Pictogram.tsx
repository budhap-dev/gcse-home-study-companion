import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'
import { wrapCell } from './tableLayout.ts'

interface Row {
  label: string
  /** The frequency. The component works out how many symbols, and how much of the last. */
  value: number
}

const W = 296
const LABEL_W = 84
const SIZE = 18
const GAP = 5
const ROW_H = 28

/**
 * A pictogram: each symbol stands for `key` items, and a part symbol for part of that.
 * The symbols are worked out from the frequencies, so the picture always matches the
 * numbers a question states. A part symbol is cut from the left, which is how a quarter
 * or a half of a square symbol is read and drawn by hand.
 *
 * Up to nine symbols fit a row on a phone, so choose a key that keeps the largest
 * frequency at or under nine keys' worth.
 *
 * Props: { rows: Row[], key: number, unit?: string (what is counted), title?: string }
 */
export function Pictogram({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const rows = (props.rows as Row[] | undefined) ?? []
  const key = Number(props.key)
  if (rows.length === 0 || !(key > 0)) return <p>{alt}</p>
  const unit = props.unit ? String(props.unit) : ''
  const title = props.title ? wrapCell(String(props.title), 40) : []
  const fmt = (v: number) => String(Number(v.toFixed(2)))

  const top = title.length ? title.length * 15 + 10 : 6
  const H = top + rows.length * ROW_H + 34
  const maxSymbols = Math.floor((W - LABEL_W - 4) / (SIZE + GAP))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 400 }} role="img" aria-label={alt}>
      {title.map((l, i) => (
        <text key={`t${i}`} x={W / 2} y={15 + i * 15} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>{l}</text>
      ))}
      {rows.map((r, j) => {
        const y = top + j * ROW_H
        const count = Math.min(maxSymbols, r.value / key)
        const whole = Math.floor(count + 1e-9)
        const part = count - whole
        const label = wrapCell(r.label, 12).slice(0, 2)
        return (
          <g key={`r${j}`}>
            <line x1={0} y1={y + ROW_H} x2={W} y2={y + ROW_H} stroke={RULE} />
            <text x={4} y={y + ROW_H / 2 + 4 - ((label.length - 1) * 12) / 2} fontFamily={FONT} fontSize="11" fill={INK}>
              {label.map((l, k) => <tspan key={k} x={4} dy={k === 0 ? 0 : 12}>{l}</tspan>)}
            </text>
            {Array.from({ length: whole }, (_, i) => (
              <rect key={i} x={LABEL_W + i * (SIZE + GAP)} y={y + (ROW_H - SIZE) / 2} width={SIZE} height={SIZE} rx={3} fill={ACCENT} />
            ))}
            {part > 1e-6 && (
              <rect x={LABEL_W + whole * (SIZE + GAP)} y={y + (ROW_H - SIZE) / 2} width={SIZE * part} height={SIZE} rx={1} fill={ACCENT} />
            )}
          </g>
        )
      })}
      <rect x={4} y={H - 24} width={SIZE} height={SIZE} rx={3} fill={ACCENT} />
      <text x={4 + SIZE + 8} y={H - 11} fontFamily={FONT} fontSize="12" fill={INK_2}>
        {`= ${fmt(key)}${unit ? ` ${unit}` : ''}`}
      </text>
    </svg>
  )
}
