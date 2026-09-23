import { useLayoutEffect, useRef } from 'react'
import { REFIT, useAvailableWidth } from '../fitSvgText.ts'
import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

interface Node {
  /** A leaf carries the character it stands for; a branch carries none. */
  char?: string
  weight?: number
  left?: Node
  right?: Node
}

interface Placed {
  node: Node
  x: number
  y: number
  code: string
}

/**
 * A Huffman tree, drawn the way AQA prints it: every left branch labelled 0, every
 * right branch labelled 1, and a character's code read off by walking down to its
 * leaf. Leaves sit on their own depth so the picture shows why a common character
 * ends up with a shorter code than a rare one.
 * Props: { tree: Node, caption?: string, hideCodes?: boolean } with Node = { char?, weight?,
 * left?, right? }. hideCodes leaves the code off each leaf, for a question that asks the
 * student to read one off the branches.
 */
export function HuffmanTree({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const tree = props.tree as Node | undefined
  const caption = props.caption as string | undefined
  const hideCodes = props.hideCodes === true
  const svg = useRef<SVGSVGElement>(null)
  const available = useAvailableWidth(svg)
  useLayoutEffect(() => {
    svg.current?.dispatchEvent(new Event(REFIT, { bubbles: true }))
  }, [available])
  if (!tree) return <p>{alt}</p>

  // Leaves are spread evenly left to right in the order they appear; every other
  // node sits midway between its two children, which is the usual tree layout.
  const placed: Placed[] = []
  const edges: { from: Placed; to: Placed; bit: '0' | '1' }[] = []
  let nextLeaf = 0
  let maxDepth = 0
  const walk = (node: Node, depth: number, code: string): Placed => {
    maxDepth = Math.max(maxDepth, depth)
    if (!node.left && !node.right) {
      const self = { node, x: nextLeaf++, y: depth, code }
      placed.push(self)
      return self
    }
    const kids: Placed[] = []
    if (node.left) kids.push(walk(node.left, depth + 1, `${code}0`))
    if (node.right) kids.push(walk(node.right, depth + 1, `${code}1`))
    const self = { node, x: kids.reduce((s, k) => s + k.x, 0) / kids.length, y: depth, code }
    placed.push(self)
    if (node.left) edges.push({ from: self, to: kids[0]!, bit: '0' })
    if (node.right) edges.push({ from: self, to: kids[kids.length - 1]!, bit: '1' })
    return self
  }
  walk(tree, 0, '')

  const leafCount = nextLeaf
  // Leaves are 96 apart where there is room. On a phone they close up, to no less than
  // 62 (a 20-unit gap between two leaf boxes), so a four-leaf tree fits a 330-unit card
  // instead of scrolling with its last code out of sight.
  const padX = available !== undefined && available < 380 ? 30 : 46
  const colW = Math.max(62, Math.min(96, Math.floor(((available ?? Infinity) - 2 * padX) / Math.max(leafCount - 1, 1))))
  const rowH = 74
  const padY = 30
  const W = Math.max(2 * padX + Math.max(leafCount - 1, 1) * colW, Math.min(320, available ?? 320))
  const H = 2 * padY + maxDepth * rowH + 46
  const sx = (x: number) => padX + x * colW
  const sy = (y: number) => padY + y * rowH

  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: Math.max(W, 340) }} role="img" aria-label={alt}>
      {edges.map((e, i) => {
        const x1 = sx(e.from.x), y1 = sy(e.from.y), x2 = sx(e.to.x), y2 = sy(e.to.y)
        return (
          <g key={`e${i}`}>
            <line x1={x1} y1={y1 + 13} x2={x2} y2={y2 - 13} stroke={RULE} strokeWidth="2" />
            <text
              x={(x1 + x2) / 2 + (e.bit === '0' ? -11 : 11)}
              y={(y1 + y2) / 2 + 4}
              textAnchor="middle"
              fontFamily={DISPLAY}
              fontSize="13"
              fontWeight="700"
              fill={INK_2}
            >
              {e.bit}
            </text>
          </g>
        )
      })}
      {placed.map((p, i) => {
        const leaf = !p.node.left && !p.node.right
        const x = sx(p.x), y = sy(p.y)
        if (leaf) {
          return (
            <g key={`n${i}`}>
              <rect x={x - 21} y={y - 15} width="42" height="30" rx="7" fill={ACCENT} />
              <text x={x} y={y + 5} textAnchor="middle" fontFamily={DISPLAY} fontSize="15" fontWeight="700" fill="#fff">
                {p.node.char}
              </text>
              {p.node.weight !== undefined && (
                <text x={x} y={y + 30} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>
                  {p.node.weight}
                </text>
              )}
              {!hideCodes && (
                <text x={x} y={y + 45} textAnchor="middle" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={INK}>
                  {p.code}
                </text>
              )}
            </g>
          )
        }
        return (
          <g key={`n${i}`}>
            <circle cx={x} cy={y} r="13" fill="#fff" stroke={INK_2} strokeWidth="2" />
            {p.node.weight !== undefined && (
              <text x={x} y={y + 4} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK}>
                {p.node.weight}
              </text>
            )}
          </g>
        )
      })}
      {caption && (
        <text x={W / 2} y={H - 6} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>
          {caption}
        </text>
      )}
    </svg>
  )
}
