import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

interface Node {
  /** The outcome this branch leads to, written along the branch. */
  label?: string
  /** The probability on the branch, as "3/5" or "0.6". */
  prob?: string
  children?: Node[]
}

interface Frac { n: number; d: number }

/** "3/5" or "0.6" as a fraction, so the products can be printed exactly. */
function parseProb(s: string | undefined): Frac | undefined {
  if (!s) return undefined
  const f = s.trim().match(/^(-?\d+)\s*\/\s*(\d+)$/)
  if (f) return { n: Number(f[1]), d: Number(f[2]) }
  const d = s.trim().match(/^(\d*)\.(\d+)$/)
  if (d) return { n: Number(`${d[1] || 0}${d[2]}`), d: 10 ** d[2]!.length }
  if (/^\d+$/.test(s.trim())) return { n: Number(s), d: 1 }
  return undefined
}

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b)
}

function times(a: Frac, b: Frac): Frac {
  const n = a.n * b.n, d = a.d * b.d, g = gcd(n, d) || 1
  return { n: n / g, d: d / g }
}

function show(f: Frac): string {
  return f.d === 1 ? String(f.n) : `${f.n}/${f.d}`
}

/**
 * A probability tree, drawn the way Edexcel prints it: probabilities along the
 * branches, outcomes at the leaves, and the probability of each full path written
 * at the end. The path probabilities are multiplied here from the branches rather
 * than passed in, so the picture cannot disagree with the working beside it, and
 * fractions stay exact instead of turning into recurring decimals.
 *
 * Props: { tree: Node, outcomeHeader?: string, showProducts?: boolean }
 */
export function ProbabilityTree({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const tree = props.tree as Node | undefined
  const showProducts = props.showProducts !== false
  if (!tree?.children?.length) return <p>{alt}</p>

  interface Placed { node: Node; depth: number; row: number; parent?: Placed; path: string[]; prob?: Frac }
  const leaves: Placed[] = []
  const edges: { from: Placed; to: Placed }[] = []
  const all: Placed[] = []
  let row = 0
  let maxDepth = 0
  const walk = (node: Node, depth: number, parent: Placed | undefined): Placed => {
    maxDepth = Math.max(maxDepth, depth)
    const own = parseProb(node.prob)
    const prob = parent?.prob && own ? times(parent.prob, own) : (own ?? parent?.prob)
    const self: Placed = { node, depth, row: 0, parent, path: [...(parent?.path ?? []), node.label ?? ''], prob }
    all.push(self)
    if (parent) edges.push({ from: parent, to: self })
    if (!node.children?.length) {
      self.row = row++
      leaves.push(self)
    } else {
      const kids = node.children.map((c) => walk(c, depth + 1, self))
      self.row = kids.reduce((s, k) => s + k.row, 0) / kids.length
    }
    return self
  }
  // The root carries no branch of its own, so its children start at depth 1.
  const root: Placed = { node: tree, depth: 0, row: 0, path: [], prob: undefined }
  all.push(root)
  const kids = tree.children.map((c) => walk(c, 1, root))
  root.row = kids.reduce((s, k) => s + k.row, 0) / kids.length

  // A two-level tree fits a 296-unit phone card: a 30-unit margin for the root's outer
  // probabilities, two 63-unit columns and 140 for the leaf
  // labels (a leaf's name, then its path and product on two lines of their own). A middle
  // node's label sits left of its dot, above it for the upper branch and below it for the
  // lower, the side its incoming branch does not come from, so its own branches can start
  // right at the dot; written to the right, as a leaf's is, the next branches and their
  // probabilities ran straight through it.
  const rowH = 54
  const colW = 63
  const padL = 30
  const padT = 26
  const labelW = 140
  const W = padL + maxDepth * colW + labelW
  const H = padT * 2 + Math.max(leaves.length - 1, 1) * rowH
  const sx = (d: number) => padL + d * colW
  const sy = (r: number) => padT + r * rowH

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: Math.max(W, 360) }} role="img" aria-label={alt}>
      {edges.map((e, i) => {
        const x1 = sx(e.from.depth) + 5
        const y1 = sy(e.from.row)
        const x2 = sx(e.to.depth) - 4
        const y2 = sy(e.to.row)
        return (
          <g key={`e${i}`}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={RULE} strokeWidth="2" />
            {e.to.node.prob && (
              // Beside the branch, on its outer side, never on it: above a branch that rises,
              // below one that falls, so the middle of every fork stays empty. Centred on
              // the branch, a steep one ran through its own probability; inside the fork, a
              // root's probability and the next level's met. From the root it sits by the
              // middle; further out, two thirds of the way along, next to its own branch.
              <text
                x={x1 + (x2 - x1) * (e.from.depth === 0 ? 0.5 : 0.72) - 4}
                y={y1 + (y2 - y1) * (e.from.depth === 0 ? 0.5 : 0.72) + (y2 < y1 ? -6 : 16)}
                textAnchor="end"
                fontFamily={DISPLAY}
                fontSize="12"
                fontWeight="700"
                fill={ACCENT}
              >
                {e.to.node.prob}
              </text>
            )}
          </g>
        )
      })}
      {all.filter((p) => p.depth > 0).map((p, i) => {
        const leaf = !p.node.children?.length
        const x = sx(p.depth), y = sy(p.row)
        return (
          <g key={`n${i}`}>
            <circle cx={x} cy={y} r="3.5" fill={INK} />
            <text x={leaf ? x + 8 : x - 6} y={leaf ? y + 4 : p.parent && p.row > p.parent.row ? y + 15 : y - 6} textAnchor={leaf ? 'start' : 'end'} fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>
              {p.node.label}
            </text>
            {leaf && showProducts && p.prob && (
              // Two lines rather than one: "well, tests negative = 98901/100000" ran to
              // 36 characters, which needed a labelW wide enough to scroll a phone. The
              // path and the result now wrap onto their own lines, each far shorter.
              <>
                <text x={x + 8} y={y + 20} fontFamily={FONT} fontSize="11" fill={INK_2}>
                  {p.path.filter(Boolean).join(', ')}
                </text>
                <text x={x + 8} y={y + 32} fontFamily={FONT} fontSize="11" fill={INK_2}>
                  = {show(p.prob)}
                </text>
              </>
            )}
          </g>
        )
      })}
      <circle cx={sx(0)} cy={sy(root.row)} r="3.5" fill={INK} />
    </svg>
  )
}
