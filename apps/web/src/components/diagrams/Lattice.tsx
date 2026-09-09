import { DISPLAY, FONT, INK, INK_2 } from './index.tsx'

/**
 * Structure sketches. Props: { kind: 'ionic' | 'metallic' | 'giant-covalent' | 'simple-molecules' | 'polymer' | 'graphite' | 'graphene' | 'fullerene' | 'nanotube' | 'alloy' }.
 */
export function Lattice({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const kind = String(props.kind ?? 'ionic')
  const W = 320, H = 200
  const items: React.ReactNode[] = []
  if (kind === 'ionic') {
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
      const pos = (r + c) % 2 === 0
      const x = 40 + c * 48, y = 34 + r * 44
      items.push(<circle key={`${r}${c}`} cx={x} cy={y} r={pos ? 12 : 17} fill={pos ? '#fff' : 'var(--subject-soft)'} stroke={INK} strokeWidth="1.5" />)
      items.push(<text key={`t${r}${c}`} x={x} y={y + 4} textAnchor="middle" fontFamily={DISPLAY} fontSize="11" fontWeight="700" fill={INK}>{pos ? '+' : '−'}</text>)
    }
  } else if (kind === 'metallic') {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      const x = 40 + c * 48 + (r % 2) * 24, y = 45 + r * 50
      items.push(<circle key={`${r}${c}`} cx={x} cy={y} r="16" fill="var(--subject-soft)" stroke={INK} strokeWidth="1.5" />)
      items.push(<text key={`t${r}${c}`} x={x} y={y + 4} textAnchor="middle" fontFamily={DISPLAY} fontSize="11" fontWeight="700" fill={INK}>+</text>)
    }
    for (let i = 0; i < 26; i++) {
      const x = 30 + ((i * 37) % 280), y = 30 + ((i * 53) % 150)
      items.push(<text key={`e${i}`} x={x} y={y} textAnchor="middle" fontFamily={FONT} fontSize="10" fill="#d25b3b">e⁻</text>)
    }
  } else if (kind === 'giant-covalent') {
    const pts: [number, number][] = []
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) pts.push([50 + c * 56, 40 + r * 56])
    pts.forEach(([x, y], i) => {
      pts.forEach(([x2, y2], j) => { if (j > i && Math.hypot(x - x2, y - y2) < 70) items.push(<line key={`l${i}${j}`} x1={x} y1={y} x2={x2} y2={y2} stroke={INK} strokeWidth="2" />) })
    })
    pts.forEach(([x, y], i) => items.push(<circle key={`c${i}`} cx={x} cy={y} r="9" fill="var(--subject-soft)" stroke={INK} strokeWidth="1.5" />))
  } else if (kind === 'simple-molecules') {
    const mols: [number, number, number][] = [[60, 50, 0], [150, 40, 30], [240, 60, -20], [90, 130, 60], [190, 140, 10], [270, 150, -40]]
    mols.forEach(([x, y, a], i) => {
      const dx = 14 * Math.cos((a * Math.PI) / 180), dy = 14 * Math.sin((a * Math.PI) / 180)
      items.push(<g key={i}><line x1={x - dx} y1={y - dy} x2={x + dx} y2={y + dy} stroke={INK} strokeWidth="2" /><circle cx={x - dx} cy={y - dy} r="9" fill="var(--subject-soft)" stroke={INK} strokeWidth="1.5" /><circle cx={x + dx} cy={y + dy} r="9" fill="var(--subject-soft)" stroke={INK} strokeWidth="1.5" /></g>)
    })
    items.push(<text key="w" x={W / 2} y={H - 8} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>strong bonds inside molecules, weak forces between them</text>)
  } else if (kind === 'polymer') {
    for (let i = 0; i < 9; i++) {
      const x = 30 + i * 32
      items.push(<line key={`b${i}`} x1={x} y1={90} x2={x + 32} y2={90} stroke={INK} strokeWidth="2" />)
      items.push(<circle key={`c${i}`} cx={x} cy={90} r="9" fill="var(--subject-soft)" stroke={INK} strokeWidth="1.5" />)
      items.push(<line key={`u${i}`} x1={x} y1={81} x2={x} y2={64} stroke={INK} strokeWidth="1.5" />)
      items.push(<line key={`d${i}`} x1={x} y1={99} x2={x} y2={116} stroke={INK} strokeWidth="1.5" />)
    }
    items.push(<text key="w" x={W / 2} y={H - 8} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>a very long chain of carbon atoms, covalently bonded</text>)
  } else if (kind === 'graphite') {
    for (let layer = 0; layer < 2; layer++) {
      const y0 = 40 + layer * 90
      for (let c = 0; c < 4; c++) {
        const x = 50 + c * 70
        const hex = Array.from({ length: 6 }, (_, k) => { const a = (Math.PI / 3) * k; return `${(x + 20 * Math.cos(a)).toFixed(1)},${(y0 + 20 * Math.sin(a)).toFixed(1)}` }).join(' ')
        items.push(<polygon key={`h${layer}${c}`} points={hex} fill="var(--subject-soft)" stroke={INK} strokeWidth="1.5" />)
      }
      if (layer === 0) items.push(<text key="gap" x={W - 8} y={y0 + 50} textAnchor="end" fontFamily={FONT} fontSize="10" fill="#d25b3b">weak forces between layers</text>)
    }
  } else if (kind === 'graphene') {
    const R = 20, hx = R * Math.sqrt(3)
    for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
      const x = 30 + c * hx + (r % 2) * (hx / 2), y = 30 + r * R * 1.5
      const hex = Array.from({ length: 6 }, (_, k) => { const a = (Math.PI / 3) * k + Math.PI / 6; return `${(x + R * Math.cos(a)).toFixed(1)},${(y + R * Math.sin(a)).toFixed(1)}` }).join(' ')
      items.push(<polygon key={`g${r}${c}`} points={hex} fill="none" stroke={INK} strokeWidth="1.5" />)
    }
    items.push(<text key="w" x={W / 2} y={H - 8} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>a single layer of graphite, one atom thick</text>)
  } else if (kind === 'fullerene') {
    // Schlegel-style sketch: a central pentagon ringed by five hexagons, inside the outline of the ball
    const cx = W / 2, cy = H / 2 - 6
    const pt = (deg: number, rad: number): [number, number] => [cx + rad * Math.cos((deg * Math.PI) / 180), cy + rad * Math.sin((deg * Math.PI) / 180)]
    const fmt = (pts: [number, number][]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    const inner = Array.from({ length: 5 }, (_, k) => pt(-90 + 72 * k, 18))
    const spoke = Array.from({ length: 5 }, (_, k) => pt(-90 + 72 * k, 38))
    items.push(<circle key="sph" cx={cx} cy={cy} r="82" fill="var(--subject-soft)" stroke={INK} strokeWidth="1.5" />)
    items.push(<polygon key="in" points={fmt(inner)} fill="none" stroke={INK} strokeWidth="1.5" />)
    for (let k = 0; k < 5; k++) {
      const n = (k + 1) % 5
      const m1 = pt(-90 + 72 * k + 24, 58), m2 = pt(-90 + 72 * k + 48, 58)
      items.push(<polyline key={`h${k}`} points={fmt([inner[k]!, spoke[k]!, m1, m2, spoke[n]!, inner[n]!])} fill="none" stroke={INK} strokeWidth="1.5" />)
      items.push(<line key={`o1${k}`} x1={m1[0]} y1={m1[1]} x2={pt(-90 + 72 * k + 24, 82)[0]} y2={pt(-90 + 72 * k + 24, 82)[1]} stroke={INK} strokeWidth="1.5" />)
      items.push(<line key={`o2${k}`} x1={m2[0]} y1={m2[1]} x2={pt(-90 + 72 * k + 48, 82)[0]} y2={pt(-90 + 72 * k + 48, 82)[1]} stroke={INK} strokeWidth="1.5" />)
    }
    items.push(<text key="w" x={W / 2} y={H - 4} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>C₆₀: a hollow ball of hexagons and pentagons</text>)
  } else if (kind === 'alloy') {
    // Left: a pure metal, identical ions in straight layers. Right: an alloy, larger atoms bending the layers.
    const panel = (x0: number, big: Record<string, number>, shift: Record<string, number>, label: string) => {
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
        const k = `${r}${c}`, rad = big[k] ?? 11
        const x = x0 + 24 + c * 36, y = 38 + r * 40 + (shift[k] ?? 0)
        items.push(<circle key={`${label}${k}`} cx={x} cy={y} r={rad} fill={big[k] ? '#d25b3b' : 'var(--subject-soft)'} stroke={INK} strokeWidth="1.5" />)
        items.push(<text key={`t${label}${k}`} x={x} y={y + 4} textAnchor="middle" fontFamily={DISPLAY} fontSize="10" fontWeight="700" fill={big[k] ? '#fff' : INK}>+</text>)
      }
      items.push(<text key={`l${label}`} x={x0 + 78} y={H - 8} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>{label}</text>)
    }
    panel(10, {}, {}, 'pure metal: layers slide')
    items.push(<line key="arr" x1={20} y1={16} x2={120} y2={16} stroke="#d25b3b" strokeWidth="2" />)
    items.push(<polygon key="arrh" points="120,11 130,16 120,21" fill="#d25b3b" />)
    panel(168, { '11': 16, '22': 16 }, { '01': -7, '02': -5, '12': 4, '21': 6, '23': -4 }, 'alloy: layers are jammed')
    items.push(<line key="div" x1={W / 2} y1={10} x2={W / 2} y2={H - 24} stroke={INK_2} strokeWidth="1" strokeDasharray="4 4" />)
  } else if (kind === 'nanotube') {
    const R = 16, hx = R * Math.sqrt(3)
    items.push(<rect key="tube" x={40} y={50} width={240} height={100} fill="var(--subject-soft)" stroke="none" />)
    for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) {
      const x = 52 + c * hx + (r % 2) * (hx / 2), y = 62 + r * R * 1.5
      if (x - R < 40 || x + R > 280) continue
      const hex = Array.from({ length: 6 }, (_, k) => { const a = (Math.PI / 3) * k + Math.PI / 6; return `${(x + R * Math.cos(a)).toFixed(1)},${(y + R * Math.sin(a)).toFixed(1)}` }).join(' ')
      items.push(<polygon key={`n${r}${c}`} points={hex} fill="none" stroke={INK} strokeWidth="1.3" />)
    }
    items.push(<line key="top" x1={40} y1={50} x2={280} y2={50} stroke={INK} strokeWidth="2" />)
    items.push(<line key="bot" x1={40} y1={150} x2={280} y2={150} stroke={INK} strokeWidth="2" />)
    items.push(<ellipse key="l" cx={40} cy={100} rx={14} ry={50} fill="var(--color-surface)" stroke={INK} strokeWidth="2" />)
    items.push(<ellipse key="r" cx={280} cy={100} rx={14} ry={50} fill="var(--subject-soft)" stroke={INK} strokeWidth="2" />)
    items.push(<text key="w" x={W / 2} y={H - 8} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>a carbon nanotube: a graphene sheet rolled into a cylinder</text>)
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 420 }} role="img" aria-label={alt}>
      {items}
    </svg>
  )
}
