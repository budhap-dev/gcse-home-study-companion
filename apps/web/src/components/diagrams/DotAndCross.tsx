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
 *   atoms: AtomSpec[] (two atoms; for covalent the shared pairs are drawn between them.
 *          Three or more atoms: atoms[0] is the central atom and shares one pair with each of the others)
 *   shared: number of shared pairs (covalent, two atoms only)
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
  /**
   * An ionic diagram needs a band of its own above and below the two atoms. Both of its
   * annotations are wider than the space they were drawn in: "1 electron transferred"
   * sat between the atoms, where only 62px separates the two boxes, so it printed across
   * both of them; and "outer electrons given away" sat under the symbol, which is inside
   * the circle it was describing. Neither is visible to a test that only compares labels
   * with each other, because what they collided with was a box and a circle.
   */
  const topBand = kind === 'ionic' ? 22 : 0
  const bottomBand = kind === 'ionic' ? 22 : 0
  const H = kind === 'ionic' ? 160 + topBand + bottomBand : 160
  const cx = [60 + r, 60 + r + gap]
  const cy = 70 + topBand
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
  if (kind === 'covalent' && atoms.length > 2) {
    // A central atom sharing one pair with each of the atoms round it: water, ammonia, methane.
    const centre = atoms[0]!, ends = atoms.slice(1), n = ends.length
    const CW = 300, CH = 236, cx0 = CW / 2, cy0 = CH / 2 - 8
    const R = 40, rEnd = 26, dist = R + rEnd - 12
    const angles = n === 2 ? [180, 0] : n === 3 ? [90, 210, 330] : Array.from({ length: n }, (_, i) => 45 + (360 / n) * i)
    const gaps = n === 2 ? [90, 270] : n === 3 ? [270, 30, 150] : Array.from({ length: n }, (_, i) => (360 / n) * i)
    const lonePairs = Math.max(0, Math.floor((centre.outer - n) / 2))
    const pt = (x: number, y: number, deg: number, d: number): [number, number] => [x + d * Math.cos((deg * Math.PI) / 180), y - d * Math.sin((deg * Math.PI) / 180)]
    const pair = (x: number, y: number, deg: number, m1: 'dot' | 'cross', m2: 'dot' | 'cross', key: string) => {
      const px = Math.sin((deg * Math.PI) / 180) * 5, py = Math.cos((deg * Math.PI) / 180) * 5
      return <g key={key}>{mark(x + px, y + py, m1)}{mark(x - px, y - py, m2)}</g>
    }
    const items: React.ReactNode[] = []
    items.push(<circle key="c" cx={cx0} cy={cy0} r={R} fill="none" stroke={INK} strokeWidth="1.5" />)
    items.push(<text key="cs" x={cx0} y={cy0 + 6} textAnchor="middle" fontFamily={DISPLAY} fontSize="18" fontWeight="700" fill={INK}>{centre.symbol}</text>)
    ends.forEach((end, i) => {
      const a = angles[i]!
      const [ex, ey] = pt(cx0, cy0, a, dist)
      items.push(<circle key={`e${i}`} cx={ex} cy={ey} r={rEnd} fill="none" stroke={INK} strokeWidth="1.5" />)
      const [lx, ly] = pt(cx0, cy0, a, dist + 6)
      items.push(<text key={`es${i}`} x={lx} y={ly + 5} textAnchor="middle" fontFamily={DISPLAY} fontSize="15" fontWeight="700" fill={INK}>{end.symbol}</text>)
      const [mx, my] = pt(cx0, cy0, a, (R + dist - rEnd) / 2)
      items.push(pair(mx, my, a, centre.mark, end.mark, `sp${i}`))
      const rest = end.outer - 1
      if (rest > 0) {
        const pairs = Math.ceil(rest / 2)
        for (let k = 0; k < pairs; k++) {
          const ang = a + 180 + (k - (pairs - 1) / 2) * 70
          const [qx, qy] = pt(ex, ey, ang, rEnd - 8)
          items.push(pair(qx, qy, ang, end.mark, end.mark, `er${i}${k}`))
        }
      }
    })
    for (let k = 0; k < lonePairs; k++) {
      const ang = gaps[k % gaps.length]!
      const [qx, qy] = pt(cx0, cy0, ang, R - 8)
      items.push(pair(qx, qy, ang, centre.mark, centre.mark, `lp${k}`))
    }
    const caption = `${n} shared pairs: ${n} single covalent bonds` + (lonePairs > 0 ? `, and ${lonePairs} lone pair${lonePairs > 1 ? 's' : ''} on ${centre.symbol}` : '')
    return (
      <svg viewBox={`0 0 ${CW} ${CH}`} width="100%" style={{ maxWidth: CW * 1.1 }} role="img" aria-label={alt}>
        {items}
        <text x={CW / 2} y={CH - 6} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>{caption}</text>
      </svg>
    )
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
              {n === 0 && <text x={cx[i]} y={cy + r + 26} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>outer electrons given away</text>}
            </g>
          )
        })}
        <path d={`M${cx[0]! + r + 20} ${cy} C ${cx[0]! + r + 50} ${cy - 30}, ${cx[1]! - r - 50} ${cy - 30}, ${cx[1]! - r - 20} ${cy}`} fill="none" stroke="#d25b3b" strokeWidth="1.5" markerEnd="url(#dc-arrow)" />
        <text x={(cx[0]! + cx[1]!) / 2} y={14} textAnchor="middle" fontFamily={FONT} fontSize="11" fill="#d25b3b">{transfer} electron{transfer > 1 ? 's' : ''} transferred</text>
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
