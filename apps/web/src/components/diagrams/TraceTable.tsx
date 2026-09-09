import { DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

/**
 * A trace table: one column per variable (plus an optional output column), one row per
 * step. Props: { columns: string[], rows: string[][], title?: string, highlight?: number }.
 * Empty strings leave a cell blank, which is how a trace table shows an unchanged value.
 */
export function TraceTable({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const columns = (props.columns as string[] | undefined) ?? []
  const rows = (props.rows as string[][] | undefined) ?? []
  const highlight = typeof props.highlight === 'number' ? props.highlight : -1
  const colW = Math.max(64, Math.min(120, Math.floor(420 / Math.max(columns.length, 1))))
  const W = colW * columns.length + 2, rowH = 26, H = rowH * (rows.length + 1) + 2 + (props.title ? 22 : 0)
  const top = props.title ? 22 : 0
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W * 1.1 }} role="img" aria-label={alt}>
      {props.title ? <text x={1} y={14} fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={INK}>{String(props.title)}</text> : null}
      <rect x={1} y={top + 1} width={W - 2} height={rowH} fill="var(--subject-soft)" stroke={RULE} />
      {columns.map((c, i) => <text key={`h${i}`} x={1 + i * colW + colW / 2} y={top + 18} textAnchor="middle" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={INK}>{c}</text>)}
      {rows.map((r, j) => (
        <g key={`r${j}`}>
          <rect x={1} y={top + 1 + (j + 1) * rowH} width={W - 2} height={rowH} fill={j === highlight ? '#fff3c4' : j % 2 ? '#fafafa' : '#fff'} stroke={RULE} />
          {columns.map((_, i) => <text key={`c${j}${i}`} x={1 + i * colW + colW / 2} y={top + 18 + (j + 1) * rowH} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={r[i] ? INK : INK_2}>{r[i] ?? ''}</text>)}
        </g>
      ))}
      {columns.map((_, i) => i > 0 && <line key={`v${i}`} x1={1 + i * colW} y1={top + 1} x2={1 + i * colW} y2={H - 1} stroke={RULE} />)}
    </svg>
  )
}
