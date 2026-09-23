import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

type Cube = [number, number, number]
type View = 'plan' | 'front' | 'side'

const W = 296
const PANEL_W = 88
const PANEL_GAP = 10
const PANEL_H = 72
const MAX_CELL = 20
const COS30 = Math.cos(Math.PI / 6)

/** One cell of a view: its column and row, and how near the viewer the nearest cube is. */
interface Cell { col: number; row: number; depth: number }

/**
 * The plan and two elevations of a solid made of unit cubes, read off the cubes themselves.
 *
 * Coordinates: x runs left to right along the front, y runs from the back towards the
 * front, z runs up. A cube at [x, y, z] fills the unit box from that corner. In the 3D
 * drawing the front faces point down-left and the side faces down-right.
 *
 * - **Plan**: seen from above, front at the bottom. Each column's depth is its height.
 * - **Front elevation**: seen from the front, x left to right.
 * - **Side elevation**: seen from the right, so the front of the solid is on the left.
 *
 * The rule a student is marked on is drawn exactly: a view shows the outline of what is
 * seen and a **line inside it only where the depth changes**. Two cubes side by side at
 * the same depth have no line between them, because from that direction they are one
 * flat face. The views are computed, never passed in, so a question's diagram cannot
 * show a view the solid does not have.
 *
 * Props: { cubes: [x, y, z][], show?: 'both' | 'shape' | 'views',
 *          views?: ('plan' | 'front' | 'side')[], title?: string }
 */
export function PlanElevation({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const cubes = ((props.cubes as number[][] | undefined) ?? [])
    .filter((c) => Array.isArray(c) && c.length === 3 && c.every((v) => Number.isInteger(v) && v >= 0))
    .map((c) => [c[0], c[1], c[2]] as Cube)
  if (cubes.length === 0) return <p>{alt}</p>
  const show = props.show === 'shape' || props.show === 'views' ? props.show : 'both'
  const wanted = ((props.views as string[] | undefined) ?? ['plan', 'front', 'side']).filter((v): v is View => v === 'plan' || v === 'front' || v === 'side')
  const title = props.title ? String(props.title) : ''

  const nx = Math.max(...cubes.map((c) => c[0])) + 1
  const ny = Math.max(...cubes.map((c) => c[1])) + 1
  const nz = Math.max(...cubes.map((c) => c[2])) + 1

  const views: Record<View, { cols: number; rows: number; cells: Cell[] }> = {
    plan: project(cubes, (c) => [c[0], c[1], c[2] + 1], nx, ny),
    front: project(cubes, (c) => [c[0], nz - 1 - c[2], c[1] + 1], nx, nz),
    side: project(cubes, (c) => [ny - 1 - c[1], nz - 1 - c[2], c[0] + 1], ny, nz),
  }

  // The 3D drawing, isometric: x goes down-right, y goes down-left, z goes up.
  const drawShape = show !== 'views'
  const drawViews = show !== 'shape' && wanted.length > 0
  const isoW = (nx + ny) * COS30
  const isoH = (nx + ny) / 2 + nz
  const u = Math.min(200 / isoW, 150 / isoH, 34)
  const titleH = title ? 22 : 0
  const shapeH = drawShape ? isoH * u + 30 : 0
  const ox = W / 2 - ((nx - ny) * COS30 * u) / 2
  const oy = titleH + 8 + nz * u
  const P = (x: number, y: number, z: number) => `${ox + (x - y) * COS30 * u},${oy + ((x + y) / 2) * u - z * u}`
  // Farther cubes first, so nearer faces paint over them.
  const order = [...cubes].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]))

  const panelTop = titleH + shapeH + (drawShape ? 10 : 8)
  // As tall as the tallest view actually drawn, not the room a view could take.
  const tallest = Math.max(0, ...wanted.map((v) => views[v].rows * cellSize(views[v])))
  const H = panelTop + (drawViews ? 18 + tallest + 6 : 0) + 4
  const panelsW = wanted.length * PANEL_W + (wanted.length - 1) * PANEL_GAP
  const NAMES: Record<View, string> = { plan: 'Plan', front: 'Front elevation', side: 'Side elevation' }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 380 }} role="img" aria-label={alt}>
      {title && <text x={W / 2} y={15} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>{title}</text>}
      {drawShape && (
        <g>
          {order.map(([x, y, z], i) => (
            <g key={i} stroke={INK} strokeWidth={1} strokeLinejoin="round">
              <polygon points={`${P(x, y, z + 1)} ${P(x + 1, y, z + 1)} ${P(x + 1, y + 1, z + 1)} ${P(x, y + 1, z + 1)}`} fill="var(--subject-soft)" />
              <polygon points={`${P(x + 1, y, z)} ${P(x + 1, y + 1, z)} ${P(x + 1, y + 1, z + 1)} ${P(x + 1, y, z + 1)}`} fill={ACCENT} fillOpacity={0.75} />
              <polygon points={`${P(x, y + 1, z)} ${P(x + 1, y + 1, z)} ${P(x + 1, y + 1, z + 1)} ${P(x, y + 1, z + 1)}`} fill={ACCENT} fillOpacity={0.4} />
            </g>
          ))}
          <text x={ox - ny * COS30 * u / 2 - 6} y={titleH + shapeH - 2} textAnchor="end" fontFamily={FONT} fontSize="11" fill={INK_2}>front ↗</text>
          <text x={ox + nx * COS30 * u / 2 + 6} y={titleH + shapeH - 2} fontFamily={FONT} fontSize="11" fill={INK_2}>↖ side</text>
        </g>
      )}
      {drawViews && wanted.map((v, i) => {
        const left = (W - panelsW) / 2 + i * (PANEL_W + PANEL_GAP)
        return <ViewPanel key={v} name={NAMES[v]} view={views[v]} left={left} top={panelTop} />
      })}
    </svg>
  )
}

/**
 * Collapse the cubes onto one view. `at` gives each cube's column, row and nearness to
 * the viewer; a cell keeps the nearest.
 */
function project(cubes: Cube[], at: (c: Cube) => [number, number, number], cols: number, rows: number) {
  const best = new Map<string, Cell>()
  for (const c of cubes) {
    const [col, row, depth] = at(c)
    const k = `${col},${row}`
    const old = best.get(k)
    if (!old || depth > old.depth) best.set(k, { col, row, depth })
  }
  return { cols, rows, cells: [...best.values()] }
}

/** The edges a view shows: the outline, and inner lines where the depth changes. */
export function viewEdges(cells: Cell[]): [number, number, number, number][] {
  const at = new Map(cells.map((c) => [`${c.col},${c.row}`, c]))
  const out: [number, number, number, number][] = []
  for (const c of cells) {
    const sides: [number, number, number, number, number, number][] = [
      [c.col, c.row - 1, c.col, c.row, c.col + 1, c.row],
      [c.col, c.row + 1, c.col, c.row + 1, c.col + 1, c.row + 1],
      [c.col - 1, c.row, c.col, c.row, c.col, c.row + 1],
      [c.col + 1, c.row, c.col + 1, c.row, c.col + 1, c.row + 1],
    ]
    for (const [nc, nr, x1, y1, x2, y2] of sides) {
      const n = at.get(`${nc},${nr}`)
      // Draw an outline edge from this side; an inner edge once, from the lower-indexed cell.
      if (!n) out.push([x1, y1, x2, y2])
      else if (n.depth !== c.depth && (nc > c.col || nr > c.row)) out.push([x1, y1, x2, y2])
    }
  }
  return out
}

/** The side of one grid square in a view, the largest that fits its panel. */
function cellSize(view: { cols: number; rows: number }): number {
  return Math.min(PANEL_W / view.cols, (PANEL_H - 4) / view.rows, MAX_CELL)
}

function ViewPanel({ name, view, left, top }: { name: string; view: { cols: number; rows: number; cells: Cell[] }; left: number; top: number }) {
  const cell = cellSize(view)
  const gx = left + (PANEL_W - view.cols * cell) / 2
  const gy = top + 18
  return (
    <g>
      <text x={left + PANEL_W / 2} y={top + 10} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK}>{name}</text>
      {Array.from({ length: view.cols + 1 }, (_, i) => (
        <line key={`v${i}`} x1={gx + i * cell} y1={gy} x2={gx + i * cell} y2={gy + view.rows * cell} stroke={RULE} />
      ))}
      {Array.from({ length: view.rows + 1 }, (_, i) => (
        <line key={`h${i}`} x1={gx} y1={gy + i * cell} x2={gx + view.cols * cell} y2={gy + i * cell} stroke={RULE} />
      ))}
      {view.cells.map((c, i) => (
        <rect key={`c${i}`} x={gx + c.col * cell} y={gy + c.row * cell} width={cell} height={cell} fill="var(--subject-soft)" />
      ))}
      {viewEdges(view.cells).map(([x1, y1, x2, y2], i) => (
        <line key={`e${i}`} x1={gx + x1 * cell} y1={gy + y1 * cell} x2={gx + x2 * cell} y2={gy + y2 * cell} stroke={INK} strokeWidth={2} strokeLinecap="round" />
      ))}
    </g>
  )
}
