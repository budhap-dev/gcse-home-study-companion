import { DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

/**
 * Magnetic field patterns, and the force between two magnets, for AQA 4.7.1.2.
 *
 * Direction is computed from the poles the content gives, never taken from it. Outside a
 * magnet the field runs from north to south, so which way every arrow points follows from
 * where north is; and two magnets attract exactly when the poles they present to each other
 * differ. That way the picture cannot show like poles attracting, which is the one thing
 * the lesson beside it is claiming.
 *
 * Props:
 *   kind: 'bar' (a single magnet and its field) or 'pair' (two magnets and the force)
 *   northAt: 'left' | 'right'        -- bar only, which end is north
 *   magnets: [{ facing: 'N' | 'S' }] -- pair only, the pole each one turns to the other
 *   note: a caption under the drawing
 */
const N_COLOUR = '#c8501f'
const S_COLOUR = '#1f3a93'

interface Magnet { facing?: 'N' | 'S'; label?: string }

/**
 * 296, not 320. The widest card that holds one of these is the "why" page's, which gives
 * 322px on a 390px phone, and the figure's own padding takes 24 of that: a drawing wider
 * than 298 scrolls inside its card and the far pole goes out of sight.
 */
const W = 296

function arrowHead(x: number, y: number, angle: number, colour: string, key: string, size = 8) {
  const back = size, wing = size * 0.55
  const bx = x - back * Math.cos(angle), by = y - back * Math.sin(angle)
  return (
    <polygon
      key={key}
      points={`${x},${y} ${bx - wing * Math.sin(angle)},${by + wing * Math.cos(angle)} ${bx + wing * Math.sin(angle)},${by - wing * Math.cos(angle)}`}
      fill={colour}
    />
  )
}

/** A bar magnet drawn as two halves, north always the coloured one. */
function Bar({ x, y, w, h, northAt }: { x: number; y: number; w: number; h: number; northAt: 'left' | 'right' }) {
  const half = w / 2
  const nx = northAt === 'left' ? x : x + half
  const sx = northAt === 'left' ? x + half : x
  return (
    <g>
      <rect x={nx} y={y} width={half} height={h} fill={N_COLOUR} stroke={INK} strokeWidth="1.2" />
      <rect x={sx} y={y} width={half} height={h} fill={S_COLOUR} stroke={INK} strokeWidth="1.2" />
      <text x={nx + half / 2} y={y + h / 2 + 5} textAnchor="middle" fontFamily={DISPLAY} fontSize="14" fontWeight="700" fill="#fff">N</text>
      <text x={sx + half / 2} y={y + h / 2 + 5} textAnchor="middle" fontFamily={DISPLAY} fontSize="14" fontWeight="700" fill="#fff">S</text>
    </g>
  )
}

export function MagnetField({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const kind = props.kind === 'pair' ? 'pair' : 'bar'
  const note = typeof props.note === 'string' ? props.note : undefined
  const noteH = note ? 22 : 0

  if (kind === 'pair') {
    const magnets = (props.magnets as Magnet[] | undefined) ?? [{ facing: 'N' }, { facing: 'S' }]
    const left = magnets[0]?.facing === 'S' ? 'S' : 'N'
    const right = magnets[1]?.facing === 'S' ? 'S' : 'N'
    // Unlike poles attract; like poles repel. The arrows follow from that, not from a prop.
    const attract = left !== right
    const H = 132 + noteH
    const bw = 96, bh = 34, y = 40
    const lx = 22, rx = W - 22 - bw
    // The facing pole of the left magnet is its right half, and vice versa.
    const leftNorthAt = left === 'N' ? 'right' : 'left'
    const rightNorthAt = right === 'N' ? 'left' : 'right'
    const gapMid = (lx + bw + rx) / 2
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 360 }} role="img" aria-label={alt}>
        <Bar x={lx} y={y} w={bw} h={bh} northAt={leftNorthAt} />
        <Bar x={rx} y={y} w={bw} h={bh} northAt={rightNorthAt} />
        {/* Each magnet is pushed or pulled towards the other one. */}
        {[0, 1].map((i) => {
          const from = i === 0 ? lx + bw + 6 : rx - 6
          const towards = attract ? (i === 0 ? 1 : -1) : (i === 0 ? -1 : 1)
          const tip = from + towards * 16
          return (
            <g key={i}>
              <line x1={from} y1={y + bh / 2} x2={tip} y2={y + bh / 2} stroke={INK} strokeWidth="2.5" />
              {arrowHead(tip, y + bh / 2, towards > 0 ? 0 : Math.PI, INK, `h${i}`)}
            </g>
          )
        })}
        <text x={gapMid} y={y + bh + 30} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>
          {attract ? 'Unlike poles: attract' : 'Like poles: repel'}
        </text>
        {note && <text x={W / 2} y={H - 7} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>{note}</text>}
      </svg>
    )
  }

  const northAt: 'left' | 'right' = props.northAt === 'left' ? 'left' : 'right'
  const H = 216 + noteH
  const bw = 120, bh = 32
  const x = (W - bw) / 2, y = (216 - bh) / 2
  const cy = y + bh / 2
  // Outside the magnet the field runs from north to south, so the loops start at the north
  // end. With north on the right they sweep leftwards over the top, and the reverse if not.
  const nx = northAt === 'left' ? x : x + bw
  const sx = northAt === 'left' ? x + bw : x
  const dir = northAt === 'left' ? -1 : 1   // the way a loop leaves the north end
  const loops = [26, 52, 80]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 360 }} role="img" aria-label={alt}>
      <rect x="1" y="1" width={W - 2} height={H - 2} rx="12" fill="none" stroke={RULE} />
      {[-1, 1].map((side) =>
        loops.map((bulge, i) => {
          const ctrl = 46 + i * 22
          const top = cy + side * bulge
          const d = `M ${nx} ${cy} C ${nx + dir * ctrl} ${top} ${sx - dir * ctrl} ${top} ${sx} ${cy}`
          // The arrow sits at the midpoint of the loop, pointing the way the field travels:
          // out of north, round, and into south.
          const mid = (nx + sx) / 2
          return (
            <g key={`${side}${i}`}>
              <path d={d} fill="none" stroke={INK_2} strokeWidth="1.6" />
              {arrowHead(mid, top * 0.78 + cy * 0.22, dir > 0 ? Math.PI : 0, INK_2, `a${side}${i}`, 7)}
            </g>
          )
        }),
      )}
      <Bar x={x} y={y} w={bw} h={bh} northAt={northAt} />
      <text x={W / 2} y={18} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>
        Field lines run from N to S outside the magnet
      </text>
      {note && <text x={W / 2} y={H - 7} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>{note}</text>}
    </svg>
  )
}
