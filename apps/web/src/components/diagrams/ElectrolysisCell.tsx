import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'
import { wrapCell } from './tableLayout.ts'

interface Ion {
  /** Shown as written, e.g. "Na⁺" or "Cl⁻". */
  label: string
  to: 'cathode' | 'anode'
}

/**
 * An electrolysis cell: a beaker of electrolyte, two electrodes wired to a d.c. supply,
 * ions drifting to the electrode that attracts them, and the product at each electrode.
 * Props: electrolyte (caption), ions [{label, to}], cathode and anode (product labels),
 * bubbles ['cathode', 'anode'] for gases, electrodes (material caption, e.g. 'graphite').
 */
export function ElectrolysisCell({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  /*
   * 290 units wide, inside the 296 a phone's card allows. At 460 this scrolled 128px on a
   * phone: the product at each electrode ("lead forms", "copper deposited") used to sit
   * beside the beaker, which needed the full width just for that margin. It now sits
   * below the electrode's own "cathode"/"anode" label instead, and the electrolyte caption
   * — up to 45 characters — wraps rather than running off the edge on one line.
   */
  const W = 290
  const ions = (props.ions as Ion[] | undefined) ?? []
  const cathode = typeof props.cathode === 'string' ? props.cathode : ''
  const anode = typeof props.anode === 'string' ? props.anode : ''
  const bubbles = new Set((props.bubbles as string[] | undefined) ?? [])
  const electrolyte = typeof props.electrolyte === 'string' ? props.electrolyte : ''
  const material = typeof props.electrodes === 'string' ? props.electrodes : ''
  const beaker = { x: 20, y: 92, w: 250, h: 160 }
  const liquidTop = beaker.y + 30
  const left = beaker.x + 70, right = beaker.x + 190, eW = 14, eTop = 46, eBottom = beaker.y + beaker.h - 26
  const mid = (left + right) / 2
  // Ions are spread down the liquid, closer together when there are more of them.
  const ionTop = liquidTop + 26, ionBottom = eBottom - 14
  const ionStep = ions.length > 1 ? Math.min(26, (ionBottom - ionTop) / (ions.length - 1)) : 0
  const bubble = (x: number, side: -1 | 1) => Array.from({ length: 5 }, (_, i) => (
    <circle key={i} cx={x + side * (12 + (i % 2) * 6)} cy={eBottom - 12 - i * 22} r={3 + (i % 3)} fill="none" stroke={INK_2} strokeWidth="1.2" />
  ))
  const ELECTROLYTE_BUDGET = 34
  const electrolyteLines = electrolyte ? wrapCell(electrolyte, ELECTROLYTE_BUDGET) : []
  // Under the beaker, clear of it: 30 below the electrodes put the words on its bottom line.
  const productY = beaker.y + beaker.h + 16
  const H = Math.max(beaker.y + beaker.h, productY) + 24 + Math.max(1, electrolyteLines.length) * 15
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 320 }} role="img" aria-label={alt}>
      {/* beaker and electrolyte */}
      <path d={`M${beaker.x} ${beaker.y} V${beaker.y + beaker.h - 10} q0 10 10 10 H${beaker.x + beaker.w - 10} q10 0 10 -10 V${beaker.y}`} fill="none" stroke={INK} strokeWidth="2" />
      <path d={`M${beaker.x + 2} ${liquidTop} H${beaker.x + beaker.w - 2} V${beaker.y + beaker.h - 10} q0 8 -8 8 H${beaker.x + 10} q-8 0 -8 -8 Z`} fill="var(--subject-soft)" />
      <line x1={beaker.x + 2} y1={liquidTop} x2={beaker.x + beaker.w - 2} y2={liquidTop} stroke={RULE} />
      {/* wires and cell */}
      <line x1={left} y1={eTop} x2={left} y2={24} stroke={INK} strokeWidth="1.5" />
      <line x1={right} y1={eTop} x2={right} y2={24} stroke={INK} strokeWidth="1.5" />
      <line x1={left} y1={24} x2={mid - 12} y2={24} stroke={INK} strokeWidth="1.5" />
      <line x1={mid + 12} y1={24} x2={right} y2={24} stroke={INK} strokeWidth="1.5" />
      <line x1={mid - 12} y1={13} x2={mid - 12} y2={35} stroke={INK} strokeWidth="1.5" />
      <line x1={mid + 12} y1={17} x2={mid + 12} y2={31} stroke={INK} strokeWidth="3" />
      <text x={mid - 24} y="20" textAnchor="end" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={INK}>−</text>
      <text x={mid + 24} y="20" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={INK}>+</text>
      <text x={mid} y="48" textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>d.c. supply</text>
      {material && (
        <text x={mid} y={beaker.y - 8} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>
          {material}
        </text>
      )}
      {/* electrodes */}
      <rect x={left - eW / 2} y={eTop} width={eW} height={eBottom - eTop} fill="#6b6b6b" stroke={INK} />
      <rect x={right - eW / 2} y={eTop} width={eW} height={eBottom - eTop} fill="#6b6b6b" stroke={INK} />
      <text x={left} y={eBottom + 16} textAnchor="middle" fontFamily={DISPLAY} fontSize="11" fontWeight="700" fill={INK}>cathode (−)</text>
      <text x={right} y={eBottom + 16} textAnchor="middle" fontFamily={DISPLAY} fontSize="11" fontWeight="700" fill={INK}>anode (+)</text>
      {bubbles.has('cathode') && bubble(left, -1)}
      {bubbles.has('anode') && bubble(right, 1)}
      {/* ions drifting */}
      {ions.map((ion, i) => {
        const y = ionTop + i * ionStep
        const toLeft = ion.to === 'cathode'
        const x = toLeft ? mid + 2 - (i % 2) * 6 : mid - 2 + (i % 2) * 6
        const tx = toLeft ? left + eW / 2 + 22 : right - eW / 2 - 22
        return (
          <g key={i}>
            <text x={x} y={y + 4} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={toLeft ? '#1f3a93' : '#d25b3b'}>{ion.label}</text>
            <line x1={toLeft ? x - 24 : x + 24} y1={y} x2={tx} y2={y} stroke={toLeft ? '#1f3a93' : '#d25b3b'} strokeWidth="1.5" markerEnd="url(#ec-arrow)" />
          </g>
        )
      })}
      <defs><marker id="ec-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill={INK_2} /></marker></defs>
      {/* products, below each electrode's own label rather than out beside the beaker */}
      {cathode && <text x={left} y={productY} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={ACCENT}>{cathode}</text>}
      {anode && <text x={right} y={productY} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={ACCENT}>{anode}</text>}
      {electrolyteLines.map((line, i) => (
        <text key={i} x={W / 2} y={H - 10 - (electrolyteLines.length - 1 - i) * 15} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK}>
          {line}
        </text>
      ))}
    </svg>
  )
}
