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

  /*
   * Laid out for a 296-unit phone card. A branch between two boxes is only about 44 units
   * long here, too short to carry "does not walk" along it: labelled at its middle, the
   * word ran onto both boxes. So every label sits outside the branches instead:
   *   - a leaf's to the right of its box, wrapped onto short lines;
   *   - a middle node's above its box if it is the upper branch, below if the lower, the
   *     side its incoming branch does not come from;
   *   - the root's above its box, on two lines if it needs them.
   */
  const rowH = 48
  const colW = 80
  const boxW = 36, boxH = 22
  const padL = 36
  const LINE = 13
  const wrap = (text: string, max: number) => {
    const lines: string[] = []
    for (const word of text.split(' ').filter(Boolean)) {
      const last = lines[lines.length - 1]
      if (last !== undefined && `${last} ${word}`.length <= max) lines[lines.length - 1] = `${last} ${word}`
      else lines.push(word)
    }
    return lines
  }
  const rootLines = wrap(root.label, 9)
  const padT = (title ? 34 : 8) + rootLines.length * LINE + boxH / 2 + 8
  const W = 290
  const H = padT + Math.max(row - 1, 1) * rowH + 40
  const sx = (d: number) => padL + d * colW
  const sy = (r: number) => padT + r * rowH

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 420 }} role="img" aria-label={alt}>
      {title && (
        <text x={W / 2} y={20} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>
          {title}
        </text>
      )}
      {edges.map((e, i) => (
        <line key={`e${i}`} x1={sx(e.from.depth) + boxW / 2} y1={sy(e.from.row)} x2={sx(e.to.depth) - boxW / 2} y2={sy(e.to.row)} stroke={RULE} strokeWidth="2" />
      ))}
      {all.map((p, i) => {
        const x = sx(p.depth), y = sy(p.row)
        const leaf = !p.node.children?.length
        const lines = p.depth === 0 ? rootLines : wrap(p.node.label, 10)
        const upper = p.parent !== undefined && p.row < p.parent.row
        const label = p.depth === 0 || (!leaf && upper)
          ? lines.map((t, k) => <text key={k} x={x} y={y - boxH / 2 - 6 - (lines.length - 1 - k) * LINE} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>{t}</text>)
          : !leaf
            ? lines.map((t, k) => <text key={k} x={x} y={y + boxH / 2 + 14 + k * LINE} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>{t}</text>)
            : lines.map((t, k) => <text key={k} x={x + boxW / 2 + 6} y={y + 4 + (k - (lines.length - 1) / 2) * LINE} textAnchor="start" fontFamily={FONT} fontSize="11" fill={INK_2}>{t}</text>)
        return (
          <g key={`n${i}`}>
            <rect x={x - boxW / 2} y={y - boxH / 2} width={boxW} height={boxH} rx="6" fill={ACCENT} fillOpacity="0.15" stroke={ACCENT} strokeWidth="2" />
            <text x={x} y={y + 4} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>
              {p.node.count}
            </text>
            {label}
          </g>
        )
      })}
    </svg>
  )
}
