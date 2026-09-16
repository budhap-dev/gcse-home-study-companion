import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

interface Node {
  /** The category this branch leads to, written along the branch: "boys", "walks". */
  label: string
  /** How many are in this category, printed in the box at the node. */
  count: number
  children?: Node[]
}

/**
 * A frequency tree: counts at the nodes, categories along the branches, read left to
 * right. Unlike a probability tree the branches carry no numbers; the numbers are the
 * counts, and the children of a node should add up to it. The component draws exactly
 * the counts it is given, so a tree whose branches do not add up shows that error rather
 * than hiding it — the content generator is where the sums are checked.
 *
 * Props: { root: Node, title? }
 */
export function FrequencyTree({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const root = props.root as Node | undefined
  if (!root?.children?.length) return <p>{alt}</p>
  const title = props.title as string | undefined

  interface Placed { node: Node; depth: number; row: number; parent?: Placed }
  const all: Placed[] = []
  const edges: { from: Placed; to: Placed }[] = []
  let row = 0
  let maxDepth = 0
  const walk = (node: Node, depth: number, parent?: Placed): Placed => {
    maxDepth = Math.max(maxDepth, depth)
    const self: Placed = { node, depth, row: 0, parent }
    all.push(self)
    if (parent) edges.push({ from: parent, to: self })
    if (!node.children?.length) {
      self.row = row++
    } else {
      const kids = node.children.map((c) => walk(c, depth + 1, self))
      self.row = kids.reduce((s, k) => s + k.row, 0) / kids.length
    }
    return self
  }
  walk(root, 0)

  const rowH = 48
  const colW = 150
  const boxW = 54, boxH = 26
  const padL = 40
  const padT = title ? 44 : 22
  const W = padL + maxDepth * colW + boxW + 40
  const H = padT + Math.max(row - 1, 1) * rowH + 30
  const sx = (d: number) => padL + d * colW
  const sy = (r: number) => padT + r * rowH

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: Math.max(W, 360) }} role="img" aria-label={alt}>
      {title && (
        <text x={W / 2} y={20} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>
          {title}
        </text>
      )}
      {edges.map((e, i) => {
        const x1 = sx(e.from.depth) + boxW / 2, y1 = sy(e.from.row)
        const x2 = sx(e.to.depth) - boxW / 2, y2 = sy(e.to.row)
        return (
          <g key={`e${i}`}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={RULE} strokeWidth="2" />
            <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>
              {e.to.node.label}
            </text>
          </g>
        )
      })}
      {all.map((p, i) => {
        const x = sx(p.depth), y = sy(p.row)
        return (
          <g key={`n${i}`}>
            <rect x={x - boxW / 2} y={y - boxH / 2} width={boxW} height={boxH} rx="6" fill={ACCENT} fillOpacity="0.15" stroke={ACCENT} strokeWidth="2" />
            <text x={x} y={y + 4} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>
              {p.node.count}
            </text>
            {p.depth === 0 && (
              <text x={x} y={y - boxH / 2 - 6} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>
                {p.node.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
