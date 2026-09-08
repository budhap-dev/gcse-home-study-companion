import { DISPLAY, FONT, INK, INK_2 } from './index.tsx'

interface AtomSpec {
  symbol: string
  /** Electrons in the outer shell before bonding. */
  outer: number
  /** 'dot' or 'cross' for this atom's electrons. */
  mark: 'dot' | 'cross'
  /** Charge after transfer, for ionic diagrams. */
  charge?: string
}

/**
 * Outer-shell dot-and-cross diagrams. Props:
 *   kind: 'ionic' | 'covalent'
 *   atoms: AtomSpec[] (two atoms; for covalent the shared pairs are drawn between them)
 *   shared: number of shared pairs (covalent only)
 *   transfer: number of electrons moved from atoms[0] to atoms[1] (ionic only)
 */
export function DotAndCross({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const kind = String(props.kind ?? 'covalent')
  const atoms = (props.atoms as AtomSpec[] | undefined) ?? [{ symbol: 'H', outer: 1, mark: 'dot' }, { symbol: 'Cl', outer: 7, mark: 'cross' }]
  const shared = Number(props.shared ?? 1)
  const transfer = Number(props.transfer ?? 1)
  const r = 44
  const gap = kind === 'ionic' ? 170 : 2 * r - 22
  const W = 2 * r + gap + 120
  const H = 160
  const cx = [60 + r, 60 + r + gap]
  const cy = 70
  const mark = (x: number, y: number, m: 'dot' | 'cross') =>
    m === 'dot' ? <circle cx={x} cy={y} r="3.5" fill={INK} /> : <g stroke={INK} strokeWidth="2"><line x1={x - 3.5} y1={y - 3.5} x2={x + 3.5} y2={y + 3.5} /><line x1={x - 3.5} y1={y + 3.5} x2={x + 3.5} y2={y - 3.5} /></g>
  // place n electrons round a ring, avoiding the angle range facing the other atom when `avoid` is set
  const ring = (x: number, n: number, m: 'dot' | 'cross', facing: 'left' | 'right' | null) => {
    const out: React.ReactNode[] = []
    const positions: [number, number][] = []
    // pair positions: up, down, away side (two), plus near side reserved for sharing
    // four pair positions round the ring; a covalent atom keeps the side facing its partner for the shared pair
    const angles = facing === 'right' ? [90, 270, 180] : facing === 'left' ? [90, 270, 0] : [90, 270, 0, 180]
    const slots: [number, number][] = []
    for (const a of angles) {
      const rad = (a * Math.PI) / 180
      const px = x + (r - 8) * Math.cos(rad)
      const py = cy - (r - 8) * Math.sin(rad)
      const tx = -Math.sin(rad) * 6
      const ty = -Math.cos(rad) * 6
      slots.push([px + tx, py + ty], [px - tx, py - ty])
    }
    for (let i = 0; i < Math.min(n, slots.length); i++) positions.push(slots[i]!)
    positions.forEach(([px, py], i) => out.push(<g key={`${x}-${i}`}>{mark(px, py, m)}</g>))
    return out
  }
  if (kind === 'ionic') {
    const a = atoms[0]!, b = atoms[1]!
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W * 1.2 }} role="img" aria-label={alt}>
        {[0, 1].map((i) => {
          const at = atoms[i]!
          const n = i === 0 ? at.outer - transfer : at.outer + transfer
          const own = i === 0 ? n : at.outer
          const gained = i === 0 ? 0 : transfer
          return (
            <g key={i}>
              <rect x={cx[i]! - r - 10} y={cy - r - 10} width={2 * r + 20} height={2 * r + 20} fill="none" stroke={INK_2} />
              <circle cx={cx[i]} cy={cy} r={r} fill="none" stroke={INK} strokeWidth="1.5" />
              <text x={cx[i]} y={cy + 6} textAnchor="middle" fontFamily={DISPLAY} fontSize="18" fontWeight="700" fill={INK}>{at.symbol}</text>
              {ring(cx[i]!, own, at.mark, null)}
              {gained > 0 && ring(cx[i]!, own + gained, a.mark, null).slice(own)}
              <text x={cx[i]! + r + 14} y={cy - r + 2} textAnchor="middle" fontFamily={DISPLAY} fontSize="16" fontWeight="700" fill="#d25b3b">{at.charge ?? (i === 0 ? `${transfer > 1 ? transfer : ''}+` : `${transfer > 1 ? transfer : ''}−`)}</text>
              {n === 0 && <text x={cx[i]} y={cy + 24} textAnchor="middle" fontFamily={FONT} fontSize="9" fill={INK_2}>outer shell empty</text>}
            </g>
          )
        })}
        <path d={`M${cx[0]! + r + 20} ${cy} C ${cx[0]! + r + 50} ${cy - 30}, ${cx[1]! - r - 50} ${cy - 30}, ${cx[1]! - r - 20} ${cy}`} fill="none" stroke="#d25b3b" strokeWidth="1.5" markerEnd="url(#dc-arrow)" />
        <text x={(cx[0]! + cx[1]!) / 2} y={cy - 26} textAnchor="middle" fontFamily={FONT} fontSize="11" fill="#d25b3b">{transfer} electron{transfer > 1 ? 's' : ''} transferred</text>
        <defs><marker id="dc-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#d25b3b" /></marker></defs>
        <text x={W / 2} y={H - 6} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>{a.symbol} loses, {b.symbol} gains: both end with full outer shells</text>
      </svg>
    )
  }
  // covalent: overlapping circles with shared pairs in the overlap
  const a = atoms[0]!, b = atoms[1]!
  const overlapX = (cx[0]! + cx[1]!) / 2
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W * 1.2 }} role="img" aria-label={alt}>
      <circle cx={cx[0]} cy={cy} r={r} fill="none" stroke={INK} strokeWidth="1.5" />
      <circle cx={cx[1]} cy={cy} r={r} fill="none" stroke={INK} strokeWidth="1.5" />
      <text x={cx[0]! - 14} y={cy + 6} textAnchor="middle" fontFamily={DISPLAY} fontSize="18" fontWeight="700" fill={INK}>{a.symbol}</text>
      <text x={cx[1]! + 14} y={cy + 6} textAnchor="middle" fontFamily={DISPLAY} fontSize="18" fontWeight="700" fill={INK}>{b.symbol}</text>
      {ring(cx[0]!, a.outer - shared, a.mark, 'right')}
      {ring(cx[1]!, b.outer - shared, b.mark, 'left')}
      {Array.from({ length: shared }, (_, i) => {
        const y = cy + (i - (shared - 1) / 2) * 16
        return <g key={i}>{mark(overlapX - 5, y, a.mark)}{mark(overlapX + 5, y, b.mark)}</g>
      })}
      <text x={W / 2} y={H - 6} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>{shared} shared pair{shared > 1 ? 's' : ''}: a {shared === 1 ? 'single' : shared === 2 ? 'double' : 'triple'} covalent bond</text>
    </svg>
  )
}
