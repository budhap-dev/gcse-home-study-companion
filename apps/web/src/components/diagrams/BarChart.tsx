import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'
import { wrapCell } from './tableLayout.ts'

const W = 296
const LINE = 13
const SECOND = '#e0913a'

/** A tick step of 1, 2 or 5 times a power of ten, giving about five ticks. */
function niceStep(max: number): number {
  const raw = max / 5
  const mag = 10 ** Math.floor(Math.log10(raw))
  const unit = raw / mag
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * mag
}

/**
 * A bar chart for categorical data, or a vertical line chart for ungrouped discrete data,
 * the two charts the specification names beside pie charts and pictograms (1MA1 S2).
 *
 * `style: 'line'` draws each value as a thin vertical line rather than a bar. That is the
 * convention for discrete numbers (goals scored, children per family), where the gaps
 * between values are real, and a bar would suggest a width the data does not have.
 *
 * `style: 'grouped'` draws the bars touching, one per class interval, for grouped
 * continuous data (hand span in 1 cm ranges). Each range starts where the last one ends,
 * so a gap between the bars would say there were values nothing could take.
 *
 * A second series (`values2`, named in `names`) draws a dual bar chart, the two bars of
 * each category side by side, with a key.
 *
 * Drawn 296 units wide so it fits a phone without scrolling; category labels wrap under
 * their bar onto at most two lines.
 *
 * Props: { categories: string[], values: number[], values2?: number[], names?: string[],
 *          style?: 'bar' | 'line' | 'grouped', xLabel?, yLabel?, yStep?, title? }
 */
export function BarChart({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const categories = ((props.categories as string[] | undefined) ?? []).map(String)
  const values = ((props.values as number[] | undefined) ?? []).map(Number)
  const values2 = (props.values2 as number[] | undefined)?.map(Number)
  if (categories.length === 0 || values.length !== categories.length) return <p>{alt}</p>
  const names = ((props.names as string[] | undefined) ?? []).map(String)
  const line = props.style === 'line'
  const grouped = props.style === 'grouped' && !values2
  const xLabel = props.xLabel ? String(props.xLabel) : ''
  const yLabel = props.yLabel ? String(props.yLabel) : 'Frequency'
  const title = props.title ? wrapCell(String(props.title), 40) : []

  const maxV = Math.max(1, ...values, ...(values2 ?? []))
  const step = typeof props.yStep === 'number' && props.yStep > 0 ? props.yStep : niceStep(maxV)
  const yTop = Math.ceil(maxV / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= yTop + 1e-9; v += step) ticks.push(Number(v.toFixed(6)))
  const fmt = (v: number) => String(Number(v.toFixed(4)))

  const left = 24 + 6.2 * Math.max(...ticks.map((t) => fmt(t).length))
  const right = 8
  const top = (title.length ? title.length * 15 + 8 : 8) + (values2 && names.length ? 20 : 0)
  const plotH = 170
  const base = top + plotH
  const slot = (W - left - right) / categories.length
  const labelChars = Math.max(3, Math.floor((slot - 4) / 6.2))
  const labels = categories.map((c) => wrapCell(c, labelChars).slice(0, 2))
  const labelLines = Math.max(1, ...labels.map((l) => l.length))
  const H = base + 8 + labelLines * LINE + (xLabel ? 18 : 4)
  const sy = (v: number) => base - (v / yTop) * plotH

  const barW = grouped ? slot : values2 ? Math.min(22, slot * 0.36) : Math.min(40, slot * 0.6)
  const bar = (v: number, x: number, fill: string, key: string) =>
    line
      ? <line key={key} x1={x} y1={base} x2={x} y2={sy(v)} stroke={fill} strokeWidth={3} />
      : <rect key={key} x={x - barW / 2} y={sy(v)} width={barW} height={base - sy(v)} fill={fill} fillOpacity={0.8} stroke={fill} strokeWidth={1.5} />

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 400 }} role="img" aria-label={alt}>
      {title.map((l, i) => (
        <text key={`t${i}`} x={W / 2} y={15 + i * 15} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>{l}</text>
      ))}
      {values2 && names.length > 0 && (
        <g>
          <rect x={left} y={top - 18} width={11} height={11} fill={ACCENT} />
          <text x={left + 15} y={top - 8} fontFamily={FONT} fontSize="11" fill={INK}>{names[0]}</text>
          <rect x={left + 120} y={top - 18} width={11} height={11} fill={SECOND} />
          <text x={left + 135} y={top - 8} fontFamily={FONT} fontSize="11" fill={INK}>{names[1] ?? ''}</text>
        </g>
      )}
      {ticks.map((t, i) => (
        <g key={`y${i}`}>
          <line x1={left} y1={sy(t)} x2={W - right} y2={sy(t)} stroke={RULE} />
          <text x={left - 5} y={sy(t) + 4} textAnchor="end" fontFamily={FONT} fontSize="11" fill={INK_2}>{fmt(t)}</text>
        </g>
      ))}
      {categories.map((_, i) => {
        const cx = left + slot * (i + 0.5)
        return values2
          ? <g key={`b${i}`}>{bar(values[i]!, cx - barW / 2 - 1, ACCENT, 'a')}{bar(values2[i] ?? 0, cx + barW / 2 + 1, SECOND, 'b')}</g>
          : <g key={`b${i}`}>{bar(values[i]!, cx, ACCENT, 'a')}</g>
      })}
      <line x1={left} y1={base} x2={W - right} y2={base} stroke={INK} strokeWidth={2} />
      <line x1={left} y1={top} x2={left} y2={base} stroke={INK} strokeWidth={2} />
      {labels.map((lines, i) => (
        <text key={`c${i}`} x={left + slot * (i + 0.5)} y={base + 16} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK}>
          {lines.map((l, k) => <tspan key={k} x={left + slot * (i + 0.5)} dy={k === 0 ? 0 : LINE}>{l}</tspan>)}
        </text>
      ))}
      {xLabel && <text x={(left + W - right) / 2} y={H - 5} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>{xLabel}</text>}
      <text x={11} y={(top + base) / 2} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2} transform={`rotate(-90 11 ${(top + base) / 2})`}>{yLabel}</text>
    </svg>
  )
}
