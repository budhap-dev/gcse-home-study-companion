import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

interface Vec {
  /** Components in newtons; x to the right, y upwards. */
  x: number
  y: number
  label?: string
}

/**
 * Forces added head to tail, with the resultant drawn from the first tail to the last
 * head, which is how the Higher-tier scale drawing works. The resultant's size is
 * worked out from the components and written on it, so a 3 N and 4 N pair shows 5 N.
 * Props: { vectors: Vec[], unit, resultant: boolean (default true) }.
 */
export function VectorTriangle({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const vectors = (props.vectors as Vec[] | undefined) ?? [{ x: 4, y: 0, label: '4 N' }, { x: 0, y: 3, label: '3 N' }]
  const unit = String(props.unit ?? 'N')
  const showResultant = props.resultant !== false
  const W = 420, H = 300, pad = 40
  // Walk the chain to find its extent, then scale it into the box.
  const pts: [number, number][] = [[0, 0]]
  for (const v of vectors) {
    const last = pts[pts.length - 1]!
    pts.push([last[0] + v.x, last[1] + v.y])
  }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const span = Math.max(maxX - minX, maxY - minY, 1)
  const scale = (Math.min(W, H) - 2 * pad) / span
  const sx = (x: number) => pad + (x - minX) * scale + ((W - 2 * pad) - (maxX - minX) * scale) / 2
  const sy = (y: number) => H - pad - (y - minY) * scale - ((H - 2 * pad) - (maxY - minY) * scale) / 2
  const fmt = (v: number) => String(Number(v.toFixed(2)))
  const end = pts[pts.length - 1]!
  const size = Math.hypot(end[0], end[1])
  /**
   * Which perpendicular side of the line from (x1,y1) to (x2,y2) the chain of vectors is
   * not on, as +1 or -1. The chain always bulges to one side of the resultant; its labels
   * are over there, so the resultant's label goes to the other.
   */
  const awayFromChain = (x1: number, y1: number, x2: number, y2: number) => {
    const ang = Math.atan2(y2 - y1, x2 - x1)
    const nx = -Math.sin(ang), ny = Math.cos(ang)
    // Any intermediate corner does: they are all on the same side of the resultant.
    const mid = pts[1]!
    const side = nx * (sx(mid[0]) - x1) + ny * (sy(mid[1]) - y1)
    return side > 0 ? -1 : 1
  }
  const arrow = (a: [number, number], b: [number, number], colour: string, dashed: boolean, label: string | undefined, key: string) => {
    const x1 = sx(a[0]), y1 = sy(a[1]), x2 = sx(b[0]), y2 = sy(b[1])
    const ang = Math.atan2(y2 - y1, x2 - x1)
    const hx = x2 - 10 * Math.cos(ang), hy = y2 - 10 * Math.sin(ang)
    const head = `${x2},${y2} ${hx - 6 * Math.sin(ang)},${hy + 6 * Math.cos(ang)} ${hx + 6 * Math.sin(ang)},${hy - 6 * Math.cos(ang)}`
    // The label sits just off the midpoint. The resultant's own label is the long one, so
    // it goes on the side away from the chain of vectors rather than across them: put it
    // on the chain's side and it lands on top of their labels, which is what a 200 north
    // and 50 east pair used to do.
    // Along the line: the vectors label their midpoints, so the resultant labels a point
    // further along instead. Sharing a height with them is the other half of the
    // collision, and the perpendicular side alone does not fix it.
    const t = dashed ? 0.72 : 0.5
    const mx = x1 + (x2 - x1) * t, my = y1 + (y2 - y1) * t
    const off = dashed ? 16 * awayFromChain(x1, y1, x2, y2) : 14
    const ox = -off * Math.sin(ang), oy = off * Math.cos(ang)
    // Anchor the text so it grows away from the arrow rather than back across it.
    const anchor = ox > 4 ? 'start' : ox < -4 ? 'end' : 'middle'
    return (
      <g key={key}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colour} strokeWidth="3" strokeLinecap="round" strokeDasharray={dashed ? '7 5' : undefined} />
        <polygon points={head} fill={colour} />
        {label && <text x={mx + ox} y={my + oy + 4} textAnchor={anchor} fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={colour}>{label}</text>}
      </g>
    )
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 480 }} role="img" aria-label={alt}>
      {Array.from({ length: 9 }, (_, i) => <line key={`g${i}`} x1={pad} y1={pad + (i * (H - 2 * pad)) / 8} x2={W - pad} y2={pad + (i * (H - 2 * pad)) / 8} stroke={RULE} />)}
      {Array.from({ length: 13 }, (_, i) => <line key={`v${i}`} x1={pad + (i * (W - 2 * pad)) / 12} y1={pad} x2={pad + (i * (W - 2 * pad)) / 12} y2={H - pad} stroke={RULE} />)}
      {vectors.map((v, i) => arrow(pts[i]!, pts[i + 1]!, ACCENT, false, v.label ?? `${fmt(Math.hypot(v.x, v.y))} ${unit}`, `v${i}`))}
      {showResultant && vectors.length > 1 && arrow(pts[0]!, end, '#d25b3b', true, `resultant ${fmt(size)} ${unit}`, 'r')}
      <circle cx={sx(0)} cy={sy(0)} r="4" fill={INK} />
      <text x={sx(0) - 8} y={sy(0) + 16} textAnchor="end" fontFamily={FONT} fontSize="11" fill={INK_2}>start</text>
      <text x={W - pad} y={H - 8} textAnchor="end" fontFamily={FONT} fontSize="11" fill={INK_2}>drawn head to tail, to scale</text>
    </svg>
  )
}
