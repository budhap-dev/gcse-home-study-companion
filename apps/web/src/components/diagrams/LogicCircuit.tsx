import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

type Node = string | { op: 'NOT' | 'AND' | 'OR' | 'XOR'; inputs: Node[] }

/**
 * A logic circuit drawn from an expression tree, for AQA 3.4.2. The specification limits
 * this to NOT, AND, OR and XOR with up to three inputs, and says so explicitly: students
 * do not need NAND or NOR.
 *
 * The truth table is not given by the content — it is evaluated from the same tree the
 * gates are drawn from, so a circuit and the table beside it cannot disagree. That is the
 * error worth designing out, because a hand-written table for a three-input circuit has
 * eight rows and one wrong cell looks exactly like seven right ones.
 *
 * Props: expression (a Node tree), show ('circuit' | 'table' | 'both'), label.
 */
export function LogicCircuit({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const expr = props.expression as Node | undefined
  const show = (props.show as string) ?? 'both'
  const label = typeof props.label === 'string' ? props.label : undefined
  if (!expr) return <p style={{ color: INK_2, font: FONT }}>{alt}</p>

  const variables = (() => {
    const out: string[] = []
    const walk = (n: Node) => (typeof n === 'string' ? out.includes(n) || out.push(n) : n.inputs.forEach(walk))
    walk(expr)
    return out.sort()
  })()

  const evaluate = (n: Node, values: Record<string, boolean>): boolean => {
    if (typeof n === 'string') return values[n] ?? false
    const [a, b] = n.inputs.map((i) => evaluate(i, values))
    switch (n.op) {
      case 'NOT': return !a
      case 'AND': return a && (b ?? false)
      case 'OR': return a || (b ?? false)
      case 'XOR': return a !== (b ?? false)
    }
  }

  /** Every combination of the inputs, counting up in binary as an exam table does. */
  const rows = Array.from({ length: 2 ** variables.length }, (_, i) => {
    const values: Record<string, boolean> = {}
    variables.forEach((v, j) => { values[v] = Boolean((i >> (variables.length - 1 - j)) & 1) })
    return { values, out: evaluate(expr, values) }
  })

  /**
   * The Boolean expression in the specification's own notation: . for AND, + for OR, a
   * circled plus for XOR, and an overbar for NOT. The overbar is drawn with a real
   * text-decoration rather than the combining character U+0305, which most fonts do not
   * render — it simply vanished, turning NOT C into C.
   */
  const written = (n: Node, key = 'e'): React.ReactNode => {
    if (typeof n === 'string') return n
    if (n.op === 'NOT') return <span key={key} style={{ textDecoration: 'overline' }}>{written(n.inputs[0]!, key + 'n')}</span>
    const sym = n.op === 'AND' ? ' . ' : n.op === 'OR' ? ' + ' : ' ⊕ '
    return n.inputs.flatMap((i, k) => {
      const inner = typeof i === 'string' || i.op === 'NOT' ? written(i, `${key}${k}`) : <span key={`${key}${k}`}>({written(i, `${key}${k}`)})</span>
      return k === 0 ? [inner] : [<span key={`${key}s${k}`}>{sym}</span>, inner]
    })
  }
  /** The same expression as plain text, for the alt description and for tests. */
  const asText = (n: Node): string => {
    if (typeof n === 'string') return n
    if (n.op === 'NOT') return `NOT ${asText(n.inputs[0]!)}`
    const sym = n.op === 'AND' ? ' . ' : n.op === 'OR' ? ' + ' : ' ⊕ '
    return n.inputs.map((i) => (typeof i === 'string' || i.op === 'NOT' ? asText(i) : `(${asText(i)})`)).join(sym)
  }

  // Lay the gates out by depth, so inputs are on the left and the output on the right.
  const depth = (n: Node): number => (typeof n === 'string' ? 0 : 1 + Math.max(...n.inputs.map(depth)))
  const levels = depth(expr)
  const GATE_W = 56, GATE_H = 34, COL = 96
  const W = 120 + levels * COL + 60
  const H = Math.max(120, 40 + variables.length * 46)
  const inputY = (i: number) => 44 + i * 46

  const placed: { x: number; y: number; node: Node }[] = []
  const place = (n: Node, level: number): { x: number; y: number } => {
    if (typeof n === 'string') return { x: 96, y: inputY(variables.indexOf(n)) }
    const kids = n.inputs.map((i) => place(i, level - 1))
    const y = kids.reduce((s, k) => s + k.y, 0) / kids.length
    const x = 120 + depth(n) * COL
    placed.push({ x, y, node: n })
    return { x, y }
  }
  const out = place(expr, levels)

  const gateShape = (op: string, x: number, y: number, key: string) => {
    const l = x - GATE_W / 2, r = x + GATE_W / 2, t = y - GATE_H / 2, b = y + GATE_H / 2
    const common = { fill: 'none', stroke: INK, strokeWidth: 1.8 }
    if (op === 'NOT') {
      return (
        <g key={key}>
          <polygon points={`${l},${t} ${l},${b} ${r - 8},${y}`} {...common} />
          <circle cx={r - 4} cy={y} r={4} {...common} />
        </g>
      )
    }
    if (op === 'AND') {
      return <path key={key} d={`M ${l} ${t} L ${x} ${t} A ${GATE_H / 2} ${GATE_H / 2} 0 0 1 ${x} ${b} L ${l} ${b} Z`} {...common} />
    }
    // OR and XOR share the shield shape; XOR adds a second arc at the back.
    const shield = `M ${l} ${t} Q ${x} ${t} ${r} ${y} Q ${x} ${b} ${l} ${b} Q ${l + 12} ${y} ${l} ${t} Z`
    return (
      <g key={key}>
        <path d={shield} {...common} />
        {op === 'XOR' && <path d={`M ${l - 8} ${t} Q ${l + 4} ${y} ${l - 8} ${b}`} {...common} />}
      </g>
    )
  }

  const wire = (x1: number, y1: number, x2: number, y2: number, key: string) =>
    y1 === y2
      ? <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={1.5} />
      : <polyline key={key} points={`${x1},${y1} ${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`} fill="none" stroke={INK} strokeWidth={1.5} />

  const circuit = (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: `${W}px` }} role="img" aria-label={alt}>
      {variables.map((v, i) => (
        <text key={v} x={20} y={inputY(i) + 5} fill={INK} style={{ font: DISPLAY, fontSize: 15, fontWeight: 700 }}>{v}</text>
      ))}
      {placed.flatMap((p) => {
        const gate = p.node as { op: string; inputs: Node[] }
        return gate.inputs.map((child, k) => {
          // Each input meets the gate's left edge, spread across its height so two wires
          // into the same gate stay apart.
          const spread = (k - (gate.inputs.length - 1) / 2) * 12
          const from = typeof child === 'string'
            ? { x: 36, y: inputY(variables.indexOf(child)) }
            : { x: placed.find((q) => q.node === child)!.x + GATE_W / 2, y: placed.find((q) => q.node === child)!.y }
          return wire(from.x, from.y, p.x - GATE_W / 2, p.y + spread, `w${p.x}-${p.y}-${k}`)
        })
      })}
      {placed.map((p, i) => gateShape((p.node as { op: string }).op, p.x, p.y, `g${i}`))}
      {placed.map((p, i) => (
        <text key={`n${i}`} x={p.x} y={p.y - GATE_H / 2 - 6} textAnchor="middle" fill={INK_2} style={{ font: FONT, fontSize: 11 }}>
          {(p.node as { op: string }).op}
        </text>
      ))}
      {wire(out.x + GATE_W / 2, out.y, W - 30, out.y, 'out')}
      <text x={W - 24} y={out.y + 5} fill={ACCENT} style={{ font: DISPLAY, fontSize: 14, fontWeight: 700 }}>Q</text>
      {label && (
        <text x={W / 2} y={H - 6} textAnchor="middle" fill={INK_2} style={{ font: FONT }}>{label}</text>
      )}
    </svg>
  )

  const table = (
    <table style={{ borderCollapse: 'collapse', font: FONT, fontSize: 13 }}>
      <thead>
        <tr>
          {variables.map((v) => (
            <th key={v} style={{ border: `1px solid ${RULE}`, padding: '4px 12px', fontWeight: 700 }}>{v}</th>
          ))}
          <th style={{ border: `1px solid ${RULE}`, padding: '4px 12px', fontWeight: 700, color: ACCENT }}>Q</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {variables.map((v) => (
              <td key={v} data-cell="input" style={{ border: `1px solid ${RULE}`, padding: '4px 12px', textAlign: 'center' }}>{r.values[v] ? 1 : 0}</td>
            ))}
            <td data-cell="output" style={{ border: `1px solid ${RULE}`, padding: '4px 12px', textAlign: 'center', fontWeight: 700, color: ACCENT }}>{r.out ? 1 : 0}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {show !== 'table' && circuit}
      {show !== 'circuit' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <p data-expression={asText(expr)} style={{ font: DISPLAY, fontSize: 14, fontWeight: 700, color: INK, margin: 0 }}>Q = {written(expr)}</p>
          {table}
        </div>
      )}
    </div>
  )
}
