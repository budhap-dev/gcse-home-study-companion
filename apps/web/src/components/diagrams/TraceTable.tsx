import { DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'
import { LINE_HEIGHT, charBudget, columnWidths, rowHeight, wrapCell } from './tableLayout.ts'

/**
 * A table: one column per variable (plus an optional output column), one row per step.
 * Began as a trace table and now carries comparison tables across every subject too.
 * Props: { columns: string[], rows: string[][], title?: string, highlight?: number }.
 * Empty strings leave a cell blank, which is how a trace table shows an unchanged value.
 * Long cells wrap and their row grows, so text never overlaps a neighbour or is clipped.
 */
export function TraceTable({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const columns = (props.columns as string[] | undefined) ?? []
  const rows = (props.rows as string[][] | undefined) ?? []
  const highlight = typeof props.highlight === 'number' ? props.highlight : -1

  const widths = columnWidths(columns, rows)
  const budgets = widths.map(charBudget)
  const xs = widths.reduce<number[]>((acc, w) => [...acc, (acc[acc.length - 1] ?? 1) + w], [1]).slice(0, -1)
  const W = widths.reduce((a, b) => a + b, 0) + 2

  const header = columns.map((c, i) => wrapCell(c, budgets[i]!))
  const body = rows.map((r) => columns.map((_, i) => wrapCell(r[i] ?? '', budgets[i]!)))
  const headH = rowHeight(Math.max(1, ...header.map((l) => l.length)))
  const bodyH = body.map((cells) => rowHeight(Math.max(1, ...cells.map((l) => l.length))))

  const top = props.title ? 22 : 0
  const bodyTop = top + 1 + headH
  // Each row starts where the one above it ends.
  const rowTops: number[] = []
  bodyH.reduce((y, h) => { rowTops.push(y); return y + h }, bodyTop)
  const H = bodyTop + bodyH.reduce((a, b) => a + b, 0) + 1

  // Lines are centred as a block inside their row; 12 is the baseline offset for 12px text.
  const cell = (lines: string[], cx: number, rowTop: number, h: number, key: string, font: string, weight: number, fill: string) => (
    <text key={key} x={cx} y={rowTop + (h - lines.length * LINE_HEIGHT) / 2 + 12} textAnchor="middle" fontFamily={font} fontSize="12" fontWeight={weight} fill={fill}>
      {lines.map((l, k) => (
        <tspan key={k} x={cx} dy={k === 0 ? 0 : LINE_HEIGHT}>{l}</tspan>
      ))}
    </text>
  )

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W * 1.1 }} role="img" aria-label={alt}>
      {props.title ? <text x={1} y={14} fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={INK}>{String(props.title)}</text> : null}
      <rect x={1} y={top + 1} width={W - 2} height={headH} fill="var(--subject-soft)" stroke={RULE} />
      {header.map((lines, i) => cell(lines, xs[i]! + widths[i]! / 2, top + 1, headH, `h${i}`, DISPLAY, 700, INK))}
      {body.map((cells, j) => (
        <g key={`r${j}`}>
          <rect x={1} y={rowTops[j]} width={W - 2} height={bodyH[j]} fill={j === highlight ? '#fff3c4' : j % 2 ? '#fafafa' : '#fff'} stroke={RULE} />
          {cells.map((lines, i) => cell(lines, xs[i]! + widths[i]! / 2, rowTops[j]!, bodyH[j]!, `c${j}${i}`, FONT, 400, rows[j]![i] ? INK : INK_2))}
        </g>
      ))}
      {columns.map((_, i) => i > 0 && <line key={`v${i}`} x1={xs[i]} y1={top + 1} x2={xs[i]} y2={H - 1} stroke={RULE} />)}
    </svg>
  )
}
