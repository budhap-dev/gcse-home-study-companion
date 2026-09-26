import { DISPLAY, FONT, INK, INK_2 } from './index.tsx'

const GREEN = '#2e8b57', LEAF = '#dff0e3', WATER = '#1f3a93', SUGAR = '#d25b3b'
/** Line spacing for a wrapped 11px label. */
const LH = 13

/**
 * Plant structure sketches. Props: { kind: 'leaf-section' | 'root-hair' | 'xylem-phloem' | 'stoma' | 'potometer' }.
 *
 * Every kind is drawn 294 units wide so it fits a phone card without scrolling: at 440
 * (340 for the narrower stoma pair) each one scrolled sideways on every Biology lesson
 * that used it. The labels that used to sit beside the picture, one line each, now wrap
 * onto several short lines instead — words are never dropped, only broken across more
 * lines, keeping every original prefix, ✕ and figure the props always carried.
 */
export function Plant({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const kind = String(props.kind ?? 'leaf-section')
  const W = 294
  let H = 230
  const items: React.ReactNode[] = []
  const label = (x: number, y: number, text: string | string[], key: string, anchor: 'start' | 'end' | 'middle' = 'start') => {
    const lines = Array.isArray(text) ? text : [text]
    items.push(
      <text key={key} x={x} y={y} textAnchor={anchor} fontFamily={FONT} fontSize="11" fill={INK}>
        {lines.map((l, k) => (
          <tspan key={k} x={x} dy={k === 0 ? 0 : LH}>{l}</tspan>
        ))}
      </text>,
    )
  }
  const tick = (x1: number, y1: number, x2: number, y2: number, key: string) => items.push(<line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK_2} strokeWidth="1" />)

  if (kind === 'leaf-section') {
    const x0 = 20, x1 = 180
    const CW = (x1 - x0) / 6
    items.push(<rect key="cut" x={x0} y={22} width={x1 - x0} height={4} fill="#b8b8b8" />)
    for (let i = 0; i < 6; i++) items.push(<rect key={`ue${i}`} x={x0 + i * CW} y={26} width={CW} height={16} fill="#f2f2f2" stroke={INK} strokeWidth="1" />)
    for (let i = 0; i < 6; i++) {
      items.push(<rect key={`pa${i}`} x={x0 + 2 + i * CW} y={44} width={CW - 4} height={62} rx="4" fill={LEAF} stroke={INK} strokeWidth="1" />)
      for (let k = 0; k < 8; k++) items.push(<circle key={`ch${i}${k}`} cx={x0 + 8 + i * CW + (k % 2) * (CW / 2 - 2)} cy={52 + Math.floor(k / 2) * 14} r="3" fill={GREEN} />)
    }
    const scaleX = (v: number) => x0 + (v - 20) * ((x1 - 20) / 180)
    const sp: [number, number][] = [[35, 122], [70, 135], [105, 120], [140, 138], [175, 124], [50, 158], [95, 160], [150, 162], [185, 155]]
    sp.forEach(([x, y], i) => {
      items.push(<ellipse key={`sp${i}`} cx={scaleX(x)} cy={y} rx="14" ry="10.7" fill={LEAF} stroke={INK} strokeWidth="1" />)
      items.push(<circle key={`spc${i}`} cx={scaleX(x) - 4.4} cy={y} r="2.5" fill={GREEN} />)
      items.push(<circle key={`spd${i}`} cx={scaleX(x) + 4.4} cy={y - 3} r="2.5" fill={GREEN} />)
    })
    const veinCx = scaleX(120), veinR = 11.6
    items.push(<circle key="vein" cx={veinCx} cy={140} r={veinR} fill="#fff" stroke={INK} strokeWidth="1.2" />)
    items.push(<circle key="xy" cx={scaleX(116)} cy={137} r="4.4" fill={WATER} opacity="0.7" />)
    items.push(<circle key="ph" cx={scaleX(125)} cy={143} r="3.6" fill={SUGAR} opacity="0.7" />)
    for (let i = 0; i < 6; i++) if (i !== 2) items.push(<rect key={`le${i}`} x={x0 + i * CW} y={176} width={CW} height={16} fill="#f2f2f2" stroke={INK} strokeWidth="1" />)
    const g1x = x0 + 2 * CW, g2x = x0 + 3 * CW
    items.push(<path key="g1" d={`M${g1x} 176 Q${g1x + 5.3} 184 ${g1x} 192`} fill="#f2f2f2" stroke={INK} strokeWidth="1" />)
    items.push(<path key="g2" d={`M${g2x} 176 Q${g2x - 5.3} 184 ${g2x} 192`} fill="#f2f2f2" stroke={INK} strokeWidth="1" />)
    items.push(<path key="g1b" d={`M${g1x} 176 Q${g1x + 10.7} 184 ${g1x} 192 Z`} fill={LEAF} stroke={INK} strokeWidth="1" />)
    items.push(<path key="g2b" d={`M${g2x} 176 Q${g2x - 10.7} 184 ${g2x} 192 Z`} fill={LEAF} stroke={INK} strokeWidth="1" />)
    items.push(<path key="co2" d={`M${scaleX(95)} 214 L${scaleX(95)} 196`} stroke={INK_2} strokeWidth="1.2" markerEnd="url(#arrow-plant)" />)

    // The cuticle and the upper epidermis are genuinely only ten pixels apart in the leaf,
    // so their labels collided once the text reached a readable size; now that a phone
    // also wraps most of these onto several lines, every label (and the vein leader,
    // slotted in at its true depth) is stacked by the bottom of the one before it rather
    // than just its top line, so a long wrapped label still cannot run into the next.
    const LABEL_X = 196, TICK_X = 192
    const entries: { srcX: number; srcY: number; y: number; lines: string[] }[] = [
      { srcX: x1, srcY: 24, y: 24, lines: ['waxy cuticle'] },
      { srcX: x1, srcY: 34, y: 34, lines: ['upper', 'epidermis'] },
      { srcX: x1, srcY: 75, y: 75, lines: ['palisade', 'mesophyll:', 'most', 'chloroplasts'] },
      { srcX: x1, srcY: 140, y: 140, lines: ['spongy', 'mesophyll: air', 'spaces'] },
      { srcX: veinCx + veinR, srcY: 140, y: 161, lines: ['vein: xylem', 'and phloem'] },
      { srcX: x1, srcY: 184, y: 184, lines: ['lower', 'epidermis with', 'stomata'] },
    ]
    let bottom = -Infinity
    entries.forEach((e, i) => {
      const ly = Math.max(e.y, bottom + 16)
      bottom = ly + (e.lines.length - 1) * LH
      tick(e.srcX, e.srcY, TICK_X, ly, `t${i}`)
      label(LABEL_X, ly + 3, e.lines, `l${i}`)
    })
    const co2Y = Math.max(215, bottom + 16)
    label(LABEL_X, co2Y, ['CO₂ in, O₂ out', 'through a', 'stoma'], 'lc')
    H = Math.ceil(co2Y + 2 * LH + 12)
  } else if (kind === 'root-hair') {
    // The cell's own tip used to reach x=320 in a 440-wide picture; scaled so the same
    // shape's tip lands at 270, comfortably inside 294.
    const k = 270 / 320
    const sx = (v: number) => v * k
    items.push(<rect key="soil" x={0} y={0} width={W} height={H} fill="#f3ebdd" />)
    for (let i = 0; i < 40; i++) items.push(<circle key={`s${i}`} cx={(i * 53) % W} cy={(i * 71) % H} r={2 + (i % 3)} fill="#d9c7a6" />)
    items.push(
      <path
        key="cell"
        d={`M${sx(20)} 70 H${sx(120)} Q${sx(140)} 70 ${sx(160)} 90 L${sx(320)} 120 L${sx(320)} 132 L${sx(160)} 118 Q${sx(140)} 140 ${sx(120)} 140 H${sx(20)} Z`}
        fill="#f6fbf7"
        stroke={INK}
        strokeWidth="1.5"
      />,
    )
    items.push(<circle key="nuc" cx={sx(60)} cy={105} r={14 * k} fill="#c9dccf" stroke={INK} strokeWidth="1" />)
    items.push(<ellipse key="vac" cx={sx(110)} cy={105} rx={20 * k} ry={16 * k} fill="#e6f1ff" stroke={INK_2} strokeWidth="1" />)
    for (let i = 0; i < 5; i++) items.push(<ellipse key={`m${i}`} cx={sx(40 + i * 24)} cy={i % 2 ? 82 : 128} rx={5 * k} ry={3 * k} fill={SUGAR} />)
    for (let i = 0; i < 5; i++) items.push(<path key={`w${i}`} d={`M${sx(190 + i * 26)} 150 l -4 -10`} stroke={WATER} strokeWidth="2" markerEnd="url(#arrow-plant)" />)
    // Right of the mitochondria's leader, which runs straight down at x = sx(88): centred,
    // this label sat across that line.
    label(sx(120), 168, ['water in by osmosis,', 'mineral ions by', 'active transport'], 'lw')
    tick(sx(60), 91, sx(40), 40, 'tn'); label(20, 36, 'nucleus', 'ln')
    tick(sx(110), 89, sx(110), 50, 'tv'); label(sx(96), 46, 'large vacuole', 'lv')
    tick(sx(88), 128, sx(88), 200, 'tm'); label(20, 214, ['mitochondria: energy for active', 'transport'], 'lm')
    // The leader stops under the label's last line; run up to its first, it crossed the two below.
    tick(sx(240), 104, sx(240), 56 + 2 * LH + 5, 'th'); label(sx(180), 56, ['long hair: large', 'surface area, thin', 'wall'], 'lh')
    H = 240
  } else if (kind === 'xylem-phloem') {
    // Xylem and phloem were drawn side by side, each with its labels beside it, wanting
    // about 400 units together. Stacked one above the other instead, each tube keeps a
    // full-width row of its own to explain itself in, and none of its four or five
    // labels has to wrap at all.
    const xX = 20, xW = 50, xTop = 10, xH = 100
    items.push(<rect key="x" x={xX} y={xTop} width={xW} height={xH} rx="6" fill="#eef3ff" stroke={INK} strokeWidth="2.5" />)
    for (let i = 0; i < 4; i++) items.push(<path key={`lig${i}`} d={`M${xX + 2} ${xTop + 14 + i * 22} q ${xW / 2 - 4} 8 ${xW - 4} 0`} fill="none" stroke={INK} strokeWidth="2" />)
    for (let i = 0; i < 2; i++) items.push(<path key={`up${i}`} d={`M${xX + 14 + i * 22} ${xTop + xH - 6} V ${xTop + 6}`} stroke={WATER} strokeWidth="2" markerEnd="url(#arrow-plant)" />)
    items.push(
      <text key="tx" x={xX + xW / 2} y={xTop + xH + 20} textAnchor="middle" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={INK}>
        xylem
      </text>,
    )
    const xLabels: [number, string][] = [[24, 'dead, hollow tube'], [44, 'thick lignin walls'], [64, 'no end walls'], [84, 'water and ions, up only']]
    xLabels.forEach(([y, t], i) => {
      tick(xX + xW, xTop + y - 12, xX + xW + 8, xTop + y - 12, `xt${i}`)
      label(xX + xW + 12, xTop + y - 9, t, `xl${i}`)
    })

    const pX = 20, pW = 50, pTop = 145, pH = 100
    items.push(<rect key="p" x={pX} y={pTop} width={pW} height={pH} rx="6" fill="#fff3ee" stroke={INK} strokeWidth="1.5" />)
    for (let i = 1; i < 4; i++) items.push(<line key={`sv${i}`} x1={pX + 2} y1={pTop + i * 24} x2={pX + pW - 2} y2={pTop + i * 24} stroke={INK} strokeWidth="1.5" strokeDasharray="4 3" />)
    items.push(<rect key="cc" x={pX + pW + 4} y={pTop + 12} width={16} height={pH - 24} rx="4" fill="#fbe1d5" stroke={INK} strokeWidth="1" />)
    items.push(<circle key="ccn" cx={pX + pW + 12} cy={pTop + pH / 2} r="4" fill={SUGAR} opacity="0.7" />)
    items.push(<path key="d1" d={`M${pX + 14} ${pTop + 6} V ${pTop + pH - 6}`} stroke={SUGAR} strokeWidth="2" markerEnd="url(#arrow-plant)" />)
    items.push(<path key="d2" d={`M${pX + 36} ${pTop + pH - 6} V ${pTop + 6}`} stroke={SUGAR} strokeWidth="2" markerEnd="url(#arrow-plant)" />)
    items.push(
      <text key="tp" x={(pX + pX + pW + 20) / 2} y={pTop + pH + 30} textAnchor="middle" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={INK}>
        phloem
      </text>,
    )
    const pLabels: [number, string][] = [
      [pTop + 12, 'living cells'],
      [pTop + 32, 'sieve plates'],
      [pTop + 52, 'companion cell'],
      [pTop + 72, 'sucrose, both ways'],
      [pTop + 92, 'many mitochondria'],
    ]
    pLabels.forEach(([y, t], i) => {
      tick(pX + pW + 20, y, pX + pW + 28, y, `pt${i}`)
      label(pX + pW + 32, y + 3, t, `pl${i}`)
    })
    H = pTop + pH + 45
  } else if (kind === 'stoma') {
    const draw = (x0: number, open: boolean, key: string) => {
      const gap = open ? 14 : 2
      items.push(<path key={`${key}a`} d={`M${x0 - gap} 60 C ${x0 - 40} 80 ${x0 - 40} 130 ${x0 - gap} 150 C ${x0 - gap - 22} 130 ${x0 - gap - 22} 80 ${x0 - gap} 60 Z`} fill={LEAF} stroke={INK} strokeWidth="1.5" />)
      items.push(<path key={`${key}b`} d={`M${x0 + gap} 60 C ${x0 + 40} 80 ${x0 + 40} 130 ${x0 + gap} 150 C ${x0 + gap + 22} 130 ${x0 + gap + 22} 80 ${x0 + gap} 60 Z`} fill={LEAF} stroke={INK} strokeWidth="1.5" />)
      for (const dx of [-1, 1]) for (let k = 0; k < 3; k++) items.push(<circle key={`${key}c${dx}${k}`} cx={x0 + dx * (gap + 14)} cy={85 + k * 20} r="3" fill={GREEN} />)
      items.push(
        <text key={`${key}t`} x={x0} y={180} textAnchor="middle" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={INK}>
          {open ? 'open' : 'closed'}
        </text>,
      )
      label(x0, 194, open ? ['guard cells turgid:', 'water in'] : ['guard cells flaccid:', 'water out'], `${key}s`, 'middle')
    }
    const openX = 76, closedX = 218
    draw(openX, true, 'o'); draw(closedX, false, 'c')
    items.push(<path key="in" d={`M${openX} 40 V 20`} stroke={INK_2} strokeWidth="1.2" markerEnd="url(#arrow-plant)" />)
    label(8, 14, 'water vapour out, CO₂ in', 'lo')
    label(W / 2, 222, ['the stoma is the gap between the two guard', 'cells'], 'cap', 'middle')
    H = 242
  } else if (kind === 'potometer') {
    // The tube ran to x=300 in a 440-wide picture; scaled by 0.9 it, and everything
    // fixed to it, lands at 270, and every long caption now wraps to the full width
    // instead of running off the right-hand edge.
    const k = 0.9
    const sx = (v: number) => v * k
    items.push(<rect key="res" x={sx(30)} y={40} width={sx(26)} height={70} rx="3" fill="#eef3ff" stroke={INK} strokeWidth="1.2" />)
    items.push(<rect key="tap" x={sx(34)} y={110} width={sx(18)} height={10} fill="#ccc" stroke={INK} strokeWidth="1" />)
    items.push(<path key="tube" d={`M${sx(43)} 120 V 150 H ${sx(300)}`} fill="none" stroke={INK} strokeWidth="6" />)
    items.push(<path key="tube2" d={`M${sx(43)} 120 V 150 H ${sx(300)}`} fill="none" stroke="#eef3ff" strokeWidth="3" />)
    items.push(<rect key="bub" x={sx(200)} y={147} width={12} height={6} rx="3" fill="#fff" stroke={INK} strokeWidth="1" />)
    for (let i = 0; i < 9; i++) items.push(<line key={`sc${i}`} x1={sx(130 + i * 20)} y1={158} x2={sx(130 + i * 20)} y2={i % 2 ? 164 : 168} stroke={INK} strokeWidth="1" />)
    items.push(<path key="stem" d={`M${sx(170)} 150 V 60`} stroke={GREEN} strokeWidth="5" />)
    for (let i = 0; i < 4; i++)
      items.push(
        <ellipse
          key={`lf${i}`}
          cx={sx(170) + (i % 2 ? 22 : -22)}
          cy={70 + i * 18}
          rx="20"
          ry="9"
          fill={LEAF}
          stroke={GREEN}
          strokeWidth="1.5"
          transform={`rotate(${i % 2 ? -25 : 25} ${sx(170) + (i % 2 ? 22 : -22)} ${70 + i * 18})`}
        />,
      )
    items.push(<path key="bm" d={`M${sx(212)} 153 H ${sx(236)}`} stroke={SUGAR} strokeWidth="2" markerEnd="url(#arrow-plant)" />)
    label(8, 14, 'reservoir: tap opened to reset the bubble', 'l1')
    label(8, 200, ['capillary tube with scale: distance the', 'bubble moves per minute'], 'l2')
    // Clear of the lowest leaf, which reached across the label when it sat straight above the bubble.
    tick(sx(206) + 2, 146, sx(206) + 14, 139, 't1'); label(sx(206) + 16, 140, 'air bubble', 'l3')
    label(sx(180), 60, ['leafy shoot,', 'cut under water'], 'l4')
    label(W / 2, 230, ['a potometer measures water uptake, which', 'follows the rate of transpiration'], 'cap', 'middle')
    H = 272
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W }} role="img" aria-label={alt}>
      <defs>
        <marker id="arrow-plant" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="context-stroke" />
        </marker>
      </defs>
      {items}
    </svg>
  )
}
