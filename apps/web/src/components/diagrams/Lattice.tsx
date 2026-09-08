import { DISPLAY, FONT, INK, INK_2 } from './index.tsx'

/**
 * Structure sketches. Props: { kind: 'ionic' | 'metallic' | 'giant-covalent' | 'simple-molecules' | 'polymer' | 'graphite' }.
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
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) pts.push([50 + c * 56 + (r % 2) * 28, 40 + r * 56])
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
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 420 }} role="img" aria-label={alt}>
      {items}
    </svg>
  )
}
