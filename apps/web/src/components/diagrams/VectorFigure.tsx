import { ACCENT, DISPLAY, FONT, INK, INK_2 } from './index.tsx'

interface Point {
  name: string
  /** Either a plotted position… */
  x?: number
  y?: number
  /** …or a position derived from two others, which is how midpoints are given. */
  between?: [string, string]
  /** How far along `between`; 0.5 is the midpoint, the default. */
  fraction?: number
}
interface Edge {
  from: string
  to: string
  label?: string
  colour?: string
  dashed?: boolean
  /** Arrowheads are on by default: these edges are vectors, and direction is the point. */
  arrow?: boolean
}

/**
 * A labelled figure for vector geometry proofs: a triangle or parallelogram with its
 * vertices named, each edge drawn as a vector with its label, and midpoints derived
 * rather than typed. A point given as { name: 'M', between: ['A', 'B'] } is placed at
 * the real midpoint, so the picture cannot disagree with the proof written beside it —
 * which is the one way a hand-placed figure quietly goes wrong.
 *
 * Props: points [{name, x, y} | {name, between: [a, b], fraction}], edges
 * [{from, to, label, colour, dashed, arrow}], note (a caption under the figure).
 */
export function VectorFigure({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const declared = (props.points as Point[] | undefined) ?? []
  const edges = (props.edges as Edge[] | undefined) ?? []
  const note = typeof props.note === 'string' ? props.note : undefined
  const W = 400, H = 300, pad = 42

  // Resolve derived points, repeating so a midpoint of a midpoint still lands.
  const at = new Map<string, [number, number]>()
  for (const p of declared) if (typeof p.x === 'number' && typeof p.y === 'number') at.set(p.name, [p.x, p.y])
  for (let pass = 0; pass < declared.length + 1; pass++) {
    for (const p of declared) {
      if (at.has(p.name) || !p.between) continue
      const a = at.get(p.between[0]), b = at.get(p.between[1])
      if (!a || !b) continue
      const t = typeof p.fraction === 'number' ? p.fraction : 0.5
      at.set(p.name, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
    }
  }
  const placed = declared.filter((p) => at.has(p.name))
  if (placed.length === 0) return <p style={{ color: INK_2, font: FONT }}>{alt}</p>

  const xs = placed.map((p) => at.get(p.name)![0]), ys = placed.map((p) => at.get(p.name)![1])
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const scale = Math.min((W - 2 * pad) / Math.max(maxX - minX, 1e-6), (H - 2 * pad) / Math.max(maxY - minY, 1e-6))
  const sx = (x: number) => pad + (x - minX) * scale + ((W - 2 * pad) - (maxX - minX) * scale) / 2
  const sy = (y: number) => H - pad - (y - minY) * scale - ((H - 2 * pad) - (maxY - minY) * scale) / 2

  // Everything below is laid out relative to the centre of the figure, so that labels
  // go outwards rather than into the middle where the lines are.
  const screen = placed.map((p) => [sx(at.get(p.name)![0]), sy(at.get(p.name)![1])] as const)
  const centreX = screen.reduce((t, p) => t + p[0], 0) / screen.length
  const centreY = screen.reduce((t, p) => t + p[1], 0) / screen.length
  const outward = (x: number, y: number): [number, number] => {
    const dx = x - centreX, dy = y - centreY
    const len = Math.hypot(dx, dy) || 1
    return [(dx / len) * 16, (dy / len) * 16]
  }
  // Where each vertex's letter will be drawn, so edge labels can be kept clear of them.
  const vertexLabels = screen.map(([x, y]) => {
    const [ox, oy] = outward(x, y)
    return [x + ox, y + oy] as const
  })

  /**
   * An edge label, slid along its edge to wherever it is furthest from the vertex
   * letters. A derived midpoint sits exactly at the middle of its edge, so a label
   * anchored at the middle would always land on top of it — which is what the first
   * drawing of the midpoint theorem did to both P and Q.
   */
  const labelSpot = (x1: number, y1: number, x2: number, y2: number, nx: number, ny: number, sign: number) =>
    [0.5, 0.35, 0.65, 0.25, 0.75]
      .map((t) => {
        const px = x1 + t * (x2 - x1) + sign * 15 * nx
        const py = y1 + t * (y2 - y1) + sign * 15 * ny
        const clearance = vertexLabels.length ? Math.min(...vertexLabels.map(([vx, vy]) => Math.hypot(px - vx, py - vy))) : Infinity
        return { px, py, clearance }
      })
      .reduce((best, c) => (c.clearance > best.clearance + 1e-9 ? c : best))

  return (
    <svg viewBox={`0 0 ${W} ${H + (note ? 20 : 0)}`} width="100%" style={{ maxWidth: `${W}px` }} role="img" aria-label={alt}>
      {edges.map((e, i) => {
        const a = at.get(e.from), b = at.get(e.to)
        if (!a || !b) return null
        const x1 = sx(a[0]), y1 = sy(a[1]), x2 = sx(b[0]), y2 = sy(b[1])
        const colour = e.colour ?? (e.dashed ? INK_2 : ACCENT)
        const ang = Math.atan2(y2 - y1, x2 - x1)
        // The head sits at 60% along rather than at the end, so it is not hidden under
        // the vertex dot and its letter.
        const hx = x1 + 0.6 * (x2 - x1), hy = y1 + 0.6 * (y2 - y1)
        const tx = hx - 11 * Math.cos(ang), ty = hy - 11 * Math.sin(ang)
        const nx = -Math.sin(ang), ny = Math.cos(ang)
        const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2
        const sign = (midX - centreX) * nx + (midY - centreY) * ny >= 0 ? 1 : -1
        const spot = labelSpot(x1, y1, x2, y2, nx, ny, sign)
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colour} strokeWidth={e.dashed ? 1.5 : 2} strokeDasharray={e.dashed ? '5 4' : undefined} />
            {e.arrow !== false && (
              <polygon
                points={`${hx},${hy} ${tx - 5 * Math.sin(ang)},${ty + 5 * Math.cos(ang)} ${tx + 5 * Math.sin(ang)},${ty - 5 * Math.cos(ang)}`}
                fill={colour}
              />
            )}
            {e.label && (
              <text x={spot.px} y={spot.py + 4} textAnchor="middle" fill={colour} style={{ font: DISPLAY, fontWeight: 600 }}>
                {e.label}
              </text>
            )}
          </g>
        )
      })}
      {placed.map((p, i) => {
        const [px, py] = screen[i]!
        const [lx, ly] = vertexLabels[i]!
        return (
          <g key={p.name}>
            <circle cx={px} cy={py} r={4} fill={INK} />
            <text x={lx} y={ly + 5} textAnchor="middle" fill={INK} style={{ font: DISPLAY, fontWeight: 700 }}>
              {p.name}
            </text>
          </g>
        )
      })}
      {note && (
        <text x={W / 2} y={H + 14} textAnchor="middle" fill={INK_2} style={{ font: FONT }}>
          {note}
        </text>
      )}
    </svg>
  )
}
