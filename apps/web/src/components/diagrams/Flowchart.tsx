import { ACCENT, DISPLAY, FONT, INK, INK_2 } from './index.tsx'

interface Node {
  /** AQA names four symbols, and each has its own shape. */
  kind: 'terminal' | 'process' | 'decision' | 'io'
  text: string
  /** Label on the arrow leaving a decision downwards. */
  yes?: string
  /** Label on the arrow leaving a decision sideways, which is where a loop goes back from. */
  no?: string
}

interface Loop {
  /** Index of the last node of the loop body, whose arrow returns instead of falling through. */
  from: number
  /** Index of the decision the body returns to. */
  to: number
}

const W = 460
const NODE_W = 210
const GAP = 26

/** A decision is taller than the rest, because a diamond needs the room. */
const heightOf = (n: Node) => (n.kind === 'decision' ? 76 : 48)

/**
 * A flowchart, drawn with the four symbols AQA names: a rounded **terminal** for start and
 * stop, a rectangle for a **process**, a parallelogram for **input or output**, and a
 * diamond for a **decision**.
 *
 * The chart is a single vertical flow. A decision labels both of its exits — the one
 * continuing down and the one leaving to the side — and an optional `loop` draws the side
 * exit back up to an earlier node, which is how iteration is shown. That covers sequence,
 * selection and iteration, which is all the specification asks a student to read or draw.
 *
 * Props: { nodes: Node[], loop?: { from, to } }
 */
export function Flowchart({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const nodes = (props.nodes as Node[] | undefined) ?? []
  if (nodes.length === 0) return <p>{alt}</p>
  const loop = props.loop as Loop | undefined

  // Lay the nodes out down the page, keeping each one's top edge.
  const tops: number[] = []
  let y = 14
  for (const n of nodes) {
    tops.push(y)
    y += heightOf(n) + GAP
  }
  const H = y
  // Room down each side when there is a loop: the body returns up the right, and the
  // decision's other exit comes down the left, past the body, to the node after it.
  const cx = loop ? W / 2 : W / 2
  const centre = (i: number) => tops[i]! + heightOf(nodes[i]!) / 2

  const shape = (n: Node, i: number) => {
    const top = tops[i]!
    const h = heightOf(n)
    const half = NODE_W / 2
    if (n.kind === 'decision') {
      const mid = top + h / 2
      return <polygon points={`${cx},${top} ${cx + half},${mid} ${cx},${top + h} ${cx - half},${mid}`} fill="var(--subject-soft)" stroke={ACCENT} strokeWidth="2" />
    }
    if (n.kind === 'io') {
      const skew = 16
      return <polygon points={`${cx - half + skew},${top} ${cx + half},${top} ${cx + half - skew},${top + h} ${cx - half},${top + h}`} fill="#fff" stroke={ACCENT} strokeWidth="2" />
    }
    return <rect x={cx - half} y={top} width={NODE_W} height={h} rx={n.kind === 'terminal' ? h / 2 : 4} fill="#fff" stroke={ACCENT} strokeWidth="2" />
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 500 }} role="img" aria-label={alt}>
      <defs>
        <marker id="fc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={INK_2} />
        </marker>
      </defs>

      {nodes.slice(0, -1).map((n, i) => {
        // The last node of a loop body returns to the decision rather than falling through.
        if (loop && i === loop.from) return null
        const from = tops[i]! + heightOf(n)
        const to = tops[i + 1]!
        return (
          <g key={`e${i}`}>
            <line x1={cx} y1={from} x2={cx} y2={to} stroke={INK_2} strokeWidth="1.5" markerEnd="url(#fc-arrow)" />
            {n.kind === 'decision' && n.yes && (
              <text x={cx + 7} y={(from + to) / 2 + 4} fontFamily={FONT} fontSize="11" fill={INK_2}>{n.yes}</text>
            )}
          </g>
        )
      })}

      {/* A loop: the body returns up the right to the decision, and the decision's other
          exit comes down the left, past the body, to whatever follows it. */}
      {loop && (() => {
        const decision = nodes[loop.to]!
        const right = W - 18
        const left = 18
        const after = loop.from + 1
        const bodyBottom = tops[loop.from]! + heightOf(nodes[loop.from]!)
        return (
          <g>
            <path
              d={`M ${cx + NODE_W / 2} ${centre(loop.from)} H ${right} V ${centre(loop.to)} H ${cx + NODE_W / 2}`}
              fill="none" stroke={INK_2} strokeWidth="1.5" markerEnd="url(#fc-arrow)"
            />
            {after < nodes.length && (
              <>
                <path
                  d={`M ${cx - NODE_W / 2} ${centre(loop.to)} H ${left} V ${centre(after)} H ${cx - NODE_W / 2}`}
                  fill="none" stroke={INK_2} strokeWidth="1.5" markerEnd="url(#fc-arrow)"
                />
                {decision.no && <text x={left + 6} y={centre(loop.to) - 6} fontFamily={FONT} fontSize="11" fill={INK_2}>{decision.no}</text>}
              </>
            )}
            <text x={cx + NODE_W / 2 + 6} y={bodyBottom - 6} fontFamily={FONT} fontSize="11" fill={INK_2}>back</text>
          </g>
        )
      })()}

      {nodes.map((n, i) => (
        <g key={`n${i}`}>
          {shape(n, i)}
          <text
            x={cx} y={centre(i) + 4} textAnchor="middle"
            fontFamily={n.kind === 'terminal' ? DISPLAY : FONT}
            fontSize={n.text.length > 26 ? 11 : 12.5}
            fontWeight={n.kind === 'terminal' ? 700 : 400}
            fill={INK}
          >
            {n.text}
          </text>
        </g>
      ))}

      {/* A decision with no loop still labels the exit that leaves sideways. */}
      {!loop && nodes.map((n, i) => (
        n.kind === 'decision' && n.no
          ? <text key={`no${i}`} x={cx + NODE_W / 2 + 6} y={centre(i) + 4} fontFamily={FONT} fontSize="11" fill={INK_2}>{n.no}</text>
          : null
      ))}
    </svg>
  )
}
