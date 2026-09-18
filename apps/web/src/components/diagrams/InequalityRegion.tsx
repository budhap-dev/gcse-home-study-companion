import { DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

interface Constraint {
  /** y = m x + c for a sloping or horizontal boundary; omit for a vertical one. */
  m?: number
  c?: number
  /** x = k for a vertical boundary. */
  x?: number
  /** Which side satisfies it: 'above'/'below' for y, 'left'/'right' for x. */
  side: 'above' | 'below' | 'left' | 'right'
  /** True for ⩽ or ⩾, drawn solid; false for < or >, drawn dashed. */
  inclusive: boolean
  label?: string
}

/**
 * A region satisfying several linear inequalities at once. The shading is computed from
 * the constraints, column by column, rather than drawn by hand, so the shaded part is
 * always exactly the set of points that satisfy every one of them. Boundaries follow the
 * GCSE convention: solid for ⩽ and ⩾, dashed for < and >.
 */
export function InequalityRegion({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const [xMin, xMax] = (props.xRange as [number, number] | undefined) ?? [-1, 6]
  const [yMin, yMax] = (props.yRange as [number, number] | undefined) ?? [-1, 6]
  const constraints = (props.constraints as Constraint[] | undefined) ?? []
  const regionLabel = typeof props.label === 'string' ? props.label : 'R'

  const W = 360
  const H = 300
  const pad = 34
  const sx = (v: number) => pad + ((v - xMin) / (xMax - xMin)) * (W - 2 * pad)
  const sy = (v: number) => H - pad - ((v - yMin) / (yMax - yMin)) * (H - 2 * pad)

  /** For one x, the band of y values satisfying every constraint, or null if none do. */
  const bandAt = (x: number): [number, number] | null => {
    let lo = yMin
    let hi = yMax
    for (const k of constraints) {
      if (k.x !== undefined) {
        if (k.side === 'right' && x < k.x) return null
        if (k.side === 'left' && x > k.x) return null
        continue
      }
      const y = (k.m ?? 0) * x + (k.c ?? 0)
      if (k.side === 'above') lo = Math.max(lo, y)
      if (k.side === 'below') hi = Math.min(hi, y)
    }
    return lo <= hi ? [lo, hi] : null
  }

  // One polygon rather than a row of bars: sampling in columns and drawing each as its
  // own rect left faint vertical striping that reads as hatching.
  const samples = 200
  const top: [number, number][] = []
  const bottom: [number, number][] = []
  for (let i = 0; i <= samples; i++) {
    const x = xMin + (i / samples) * (xMax - xMin)
    const band = bandAt(x)
    if (!band) continue
    top.push([sx(x), sy(band[1])])
    bottom.push([sx(x), sy(band[0])])
  }
  const outline = top.concat(bottom.reverse())
  const hasRegion = outline.length > 2

  /** The centre of the shaded region, so the label sits inside it. */
  const centre = hasRegion
    ? { x: (top[0][0] + top[top.length - 1][0]) / 2, y: (top[Math.floor(top.length / 2)][1] + bottom[Math.floor(bottom.length / 2)][1]) / 2 }
    : null

  /**
   * A gridline and a label every whole number is right for the small ranges these
   * diagrams usually use, and unreadable past about twenty: the labels overlap into a
   * smear and the grid turns solid. Step in 1, 2, 5 or 10 (times a power of ten) so a
   * wide range gets roughly a dozen lines, the same way a graph axis would.
   */
  const step = (span: number) => {
    const rough = span / 12
    const power = 10 ** Math.floor(Math.log10(Math.max(rough, 1e-9)))
    return [1, 2, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? 10 * power
  }
  const ticks = (from: number, to: number) => {
    const s = step(to - from)
    const out: number[] = []
    for (let v = Math.ceil(from / s) * s; v <= to + 1e-9; v += s) out.push(Number(v.toFixed(6)))
    return out
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W * 1.4 }} role="img" aria-label={alt}>
      {ticks(xMin, xMax).map((v) => <line key={`gx${v}`} x1={sx(v)} y1={pad} x2={sx(v)} y2={H - pad} stroke={RULE} />)}
      {ticks(yMin, yMax).map((v) => <line key={`gy${v}`} x1={pad} y1={sy(v)} x2={W - pad} y2={sy(v)} stroke={RULE} />)}

      {hasRegion && <polygon points={outline.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} fill="var(--subject)" opacity="0.18" />}

      <line x1={pad} y1={sy(0)} x2={W - pad} y2={sy(0)} stroke={INK} strokeWidth="1.5" />
      <line x1={sx(0)} y1={pad} x2={sx(0)} y2={H - pad} stroke={INK} strokeWidth="1.5" />

      {constraints.map((k, i) => {
        const dash = k.inclusive ? undefined : '6 4'
        if (k.x !== undefined) {
          return <line key={i} x1={sx(k.x)} y1={pad} x2={sx(k.x)} y2={H - pad} stroke="var(--subject)" strokeWidth="2.5" strokeDasharray={dash} />
        }
        const m = k.m ?? 0
        const c = k.c ?? 0
        return <line key={i} x1={sx(xMin)} y1={sy(m * xMin + c)} x2={sx(xMax)} y2={sy(m * xMax + c)} stroke="var(--subject)" strokeWidth="2.5" strokeDasharray={dash} />
      })}

      {centre && <text x={centre.x} y={centre.y + 6} textAnchor="middle" fontFamily={DISPLAY} fontSize="18" fontWeight="700" fill={INK}>{regionLabel}</text>}
      {ticks(xMin, xMax).filter((v) => v !== 0).map((v) => <text key={`tx${v}`} x={sx(v)} y={sy(0) + 15} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>{v}</text>)}
      {ticks(yMin, yMax).filter((v) => v !== 0).map((v) => <text key={`ty${v}`} x={sx(0) - 8} y={sy(v) + 4} textAnchor="end" fontFamily={FONT} fontSize="11" fill={INK_2}>{v}</text>)}
    </svg>
  )
}
