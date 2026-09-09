import { DISPLAY, FONT, INK, INK_2 } from './index.tsx'

const GREEN = '#2e8b57', LEAF = '#dff0e3', WATER = '#1f3a93', SUGAR = '#d25b3b'

/**
 * Plant structure sketches. Props: { kind: 'leaf-section' | 'root-hair' | 'xylem-phloem' | 'stoma' | 'potometer' }.
 */
export function Plant({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const kind = String(props.kind ?? 'leaf-section')
  const W = kind === 'leaf-section' || kind === 'root-hair' || kind === 'potometer' ? 440 : 340, H = 230
  const items: React.ReactNode[] = []
  const label = (x: number, y: number, text: string, key: string, anchor: 'start' | 'end' = 'start') => items.push(<text key={key} x={x} y={y} textAnchor={anchor} fontFamily={FONT} fontSize="10" fill={INK}>{text}</text>)
  const tick = (x1: number, y1: number, x2: number, y2: number, key: string) => items.push(<line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK_2} strokeWidth="1" />)
  if (kind === 'leaf-section') {
    const x0 = 20, x1 = 200
    items.push(<rect key="cut" x={x0} y={22} width={x1 - x0} height={4} fill="#b8b8b8" />)
    for (let i = 0; i < 6; i++) items.push(<rect key={`ue${i}`} x={x0 + i * 30} y={26} width={30} height={16} fill="#f2f2f2" stroke={INK} strokeWidth="1" />)
    for (let i = 0; i < 6; i++) {
      items.push(<rect key={`pa${i}`} x={x0 + 2 + i * 30} y={44} width={26} height={62} rx="4" fill={LEAF} stroke={INK} strokeWidth="1" />)
      for (let k = 0; k < 8; k++) items.push(<circle key={`ch${i}${k}`} cx={x0 + 8 + i * 30 + (k % 2) * 13} cy={52 + Math.floor(k / 2) * 14} r="3" fill={GREEN} />)
    }
    const sp: [number, number][] = [[35, 122], [70, 135], [105, 120], [140, 138], [175, 124], [50, 158], [95, 160], [150, 162], [185, 155]]
    sp.forEach(([x, y], i) => { items.push(<ellipse key={`sp${i}`} cx={x} cy={y} rx="16" ry="12" fill={LEAF} stroke={INK} strokeWidth="1" />); items.push(<circle key={`spc${i}`} cx={x - 5} cy={y} r="2.5" fill={GREEN} />); items.push(<circle key={`spd${i}`} cx={x + 5} cy={y - 3} r="2.5" fill={GREEN} />) })
    items.push(<circle key="vein" cx={120} cy={140} r="13" fill="#fff" stroke={INK} strokeWidth="1.2" />)
    items.push(<circle key="xy" cx={116} cy={137} r="5" fill={WATER} opacity="0.7" />)
    items.push(<circle key="ph" cx={125} cy={143} r="4" fill={SUGAR} opacity="0.7" />)
    for (let i = 0; i < 6; i++) if (i !== 2) items.push(<rect key={`le${i}`} x={x0 + i * 30} y={176} width={30} height={16} fill="#f2f2f2" stroke={INK} strokeWidth="1" />)
    items.push(<path key="g1" d="M80 176 Q86 184 80 192" fill="#f2f2f2" stroke={INK} strokeWidth="1" />)
    items.push(<path key="g2" d="M110 176 Q104 184 110 192" fill="#f2f2f2" stroke={INK} strokeWidth="1" />)
    items.push(<path key="g1b" d="M80 176 Q92 184 80 192 Z" fill={LEAF} stroke={INK} strokeWidth="1" />)
    items.push(<path key="g2b" d="M110 176 Q98 184 110 192 Z" fill={LEAF} stroke={INK} strokeWidth="1" />)
    items.push(<path key="co2" d="M95 214 L95 196" stroke={INK_2} strokeWidth="1.2" markerEnd="url(#arrow-plant)" />)
    const L: [number, string, number][] = [[24, 'waxy cuticle', 24], [34, 'upper epidermis', 34], [75, 'palisade mesophyll: most chloroplasts', 75], [140, 'spongy mesophyll: air spaces', 140], [184, 'lower epidermis with stomata', 184]]
    L.forEach(([y, t, ly], i) => { tick(x1, y, 212, ly, `t${i}`); label(216, ly + 3, t, `l${i}`) })
    tick(133, 140, 212, 158, 'tv'); label(216, 161, 'vein: xylem and phloem', 'lv')
    label(216, 215, 'CO₂ in, O₂ out through a stoma', 'lc')
  } else if (kind === 'root-hair') {
    items.push(<rect key="soil" x={0} y={0} width={W} height={H} fill="#f3ebdd" />)
    for (let i = 0; i < 40; i++) items.push(<circle key={`s${i}`} cx={(i * 53) % W} cy={(i * 71) % H} r={2 + (i % 3)} fill="#d9c7a6" />)
    items.push(<path key="cell" d="M20 70 H120 Q140 70 160 90 L320 120 L320 132 L160 118 Q140 140 120 140 H20 Z" fill="#f6fbf7" stroke={INK} strokeWidth="1.5" />)
    items.push(<circle key="nuc" cx={60} cy={105} r="14" fill="#c9dccf" stroke={INK} strokeWidth="1" />)
    items.push(<ellipse key="vac" cx={110} cy={105} rx="20" ry="16" fill="#e6f1ff" stroke={INK_2} strokeWidth="1" />)
    for (let i = 0; i < 5; i++) items.push(<ellipse key={`m${i}`} cx={40 + i * 24} cy={i % 2 ? 82 : 128} rx="5" ry="3" fill={SUGAR} />)
    for (let i = 0; i < 5; i++) items.push(<path key={`w${i}`} d={`M${190 + i * 26} ${150} l -4 -10`} stroke={WATER} strokeWidth="2" markerEnd="url(#arrow-plant)" />)
    label(150, 168, 'water in by osmosis, mineral ions by active transport', 'lw')
    tick(60, 91, 40, 40, 'tn'); label(20, 36, 'nucleus', 'ln')
    tick(110, 89, 110, 50, 'tv'); label(96, 46, 'large vacuole', 'lv')
    tick(88, 128, 88, 200, 'tm'); label(20, 214, 'mitochondria: energy for active transport', 'lm')
    tick(240, 118, 240, 60, 'th'); label(180, 56, 'long hair: large surface area, thin wall', 'lh')
  } else if (kind === 'xylem-phloem') {
    items.push(<rect key="x" x={40} y={20} width={60} height={190} rx="6" fill="#eef3ff" stroke={INK} strokeWidth="2.5" />)
    for (let i = 0; i < 7; i++) items.push(<path key={`lig${i}`} d={`M42 ${34 + i * 26} q 29 12 56 0`} fill="none" stroke={INK} strokeWidth="2" />)
    for (let i = 0; i < 2; i++) items.push(<path key={`up${i}`} d={`M${58 + i * 24} 190 V 40`} stroke={WATER} strokeWidth="2" markerEnd="url(#arrow-plant)" />)
    items.push(<rect key="p" x={200} y={20} width={60} height={190} rx="6" fill="#fff3ee" stroke={INK} strokeWidth="1.5" />)
    for (let i = 1; i < 5; i++) items.push(<line key={`sv${i}`} x1={202} y1={20 + i * 38} x2={258} y2={20 + i * 38} stroke={INK} strokeWidth="1.5" strokeDasharray="4 3" />)
    items.push(<rect key="cc" x={264} y={60} width={22} height={110} rx="4" fill="#fbe1d5" stroke={INK} strokeWidth="1" />)
    items.push(<circle key="ccn" cx={275} cy={115} r="5" fill={SUGAR} opacity="0.7" />)
    items.push(<path key="d1" d="M218 40 V 190" stroke={SUGAR} strokeWidth="2" markerEnd="url(#arrow-plant)" />)
    items.push(<path key="d2" d="M242 190 V 40" stroke={SUGAR} strokeWidth="2" markerEnd="url(#arrow-plant)" />)
    items.push(<text key="tx" x={70} y={226} textAnchor="middle" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={INK}>xylem</text>)
    items.push(<text key="tp" x={230} y={226} textAnchor="middle" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={INK}>phloem</text>)
    label(108, 40, 'dead, hollow tube', 'l1'); label(108, 54, 'thick lignin walls', 'l2'); label(108, 68, 'no end walls', 'l3'); label(108, 82, 'water and ions, up only', 'l4')
    label(108, 130, 'living cells', 'l5'); label(108, 144, 'sieve plates', 'l6'); label(108, 158, 'companion cells', 'l7'); label(108, 172, 'sucrose, both ways', 'l8')
  } else if (kind === 'stoma') {
    const draw = (x0: number, open: boolean, key: string) => {
      const gap = open ? 14 : 2
      items.push(<path key={`${key}a`} d={`M${x0 - gap} 60 C ${x0 - 40} 80 ${x0 - 40} 130 ${x0 - gap} 150 C ${x0 - gap - 22} 130 ${x0 - gap - 22} 80 ${x0 - gap} 60 Z`} fill={LEAF} stroke={INK} strokeWidth="1.5" />)
      items.push(<path key={`${key}b`} d={`M${x0 + gap} 60 C ${x0 + 40} 80 ${x0 + 40} 130 ${x0 + gap} 150 C ${x0 + gap + 22} 130 ${x0 + gap + 22} 80 ${x0 + gap} 60 Z`} fill={LEAF} stroke={INK} strokeWidth="1.5" />)
      for (const dx of [-1, 1]) for (let k = 0; k < 3; k++) items.push(<circle key={`${key}c${dx}${k}`} cx={x0 + dx * (gap + 14)} cy={85 + k * 20} r="3" fill={GREEN} />)
      items.push(<text key={`${key}t`} x={x0} y={180} textAnchor="middle" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={INK}>{open ? 'open' : 'closed'}</text>)
      items.push(<text key={`${key}s`} x={x0} y={196} textAnchor="middle" fontFamily={FONT} fontSize="10" fill={INK_2}>{open ? 'guard cells turgid: water in' : 'guard cells flaccid: water out'}</text>)
    }
    draw(90, true, 'o'); draw(250, false, 'c')
    items.push(<path key="in" d="M90 40 V 20" stroke={INK_2} strokeWidth="1.2" markerEnd="url(#arrow-plant)" />)
    label(100, 30, 'water vapour out, CO₂ in', 'lo')
    items.push(<text key="cap" x={W / 2} y={218} textAnchor="middle" fontFamily={FONT} fontSize="10" fill={INK_2}>the stoma is the gap between the two guard cells</text>)
  } else if (kind === 'potometer') {
    items.push(<rect key="res" x={30} y={40} width={26} height={70} rx="3" fill="#eef3ff" stroke={INK} strokeWidth="1.2" />)
    items.push(<rect key="tap" x={34} y={110} width={18} height={10} fill="#ccc" stroke={INK} strokeWidth="1" />)
    items.push(<path key="tube" d="M43 120 V 150 H 300" fill="none" stroke={INK} strokeWidth="6" />)
    items.push(<path key="tube2" d="M43 120 V 150 H 300" fill="none" stroke="#eef3ff" strokeWidth="3" />)
    items.push(<rect key="bub" x={200} y={147} width={12} height={6} rx="3" fill="#fff" stroke={INK} strokeWidth="1" />)
    for (let i = 0; i < 9; i++) { items.push(<line key={`sc${i}`} x1={130 + i * 20} y1={158} x2={130 + i * 20} y2={i % 2 ? 164 : 168} stroke={INK} strokeWidth="1" />) }
    items.push(<path key="stem" d="M170 150 V 60" stroke={GREEN} strokeWidth="5" />)
    for (let i = 0; i < 4; i++) items.push(<ellipse key={`lf${i}`} cx={170 + (i % 2 ? 22 : -22)} cy={70 + i * 18} rx="20" ry="9" fill={LEAF} stroke={GREEN} strokeWidth="1.5" transform={`rotate(${i % 2 ? -25 : 25} ${170 + (i % 2 ? 22 : -22)} ${70 + i * 18})`} />)
    items.push(<path key="bm" d="M212 153 H 236" stroke={SUGAR} strokeWidth="2" markerEnd="url(#arrow-plant)" />)
    label(30, 30, 'reservoir: tap opened to reset the bubble', 'l1')
    label(100, 195, 'capillary tube with scale: distance the bubble moves per minute', 'l2', 'start')
    tick(206, 146, 206, 128, 't1'); label(212, 126, 'air bubble', 'l3')
    label(200, 60, 'leafy shoot, cut under water', 'l4')
    items.push(<text key="cap" x={W / 2} y={218} textAnchor="middle" fontFamily={FONT} fontSize="10" fill={INK_2}>a potometer measures water uptake, which follows the rate of transpiration</text>)
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 460 }} role="img" aria-label={alt}>
      <defs><marker id="arrow-plant" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="context-stroke" /></marker></defs>
      {items}
    </svg>
  )
}
