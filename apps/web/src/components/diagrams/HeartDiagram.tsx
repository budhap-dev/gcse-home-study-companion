import { DISPLAY, FONT, INK, INK_2 } from './index.tsx'

/**
 * The heart and the double circulation, as Edexcel 1BI0 8.8 asks: the four chambers, the
 * four major blood vessels, the valves, and the left ventricle's thicker wall. Blue is
 * deoxygenated blood, red oxygenated, and the words say so too.
 *
 * Drawn as a circulation diagram rather than an anatomical one: the lungs above, the body
 * below, and each vessel running between a chamber and the organ it serves. That is the
 * picture the exam's "trace the path of the blood" questions ask for, and it fits a phone.
 * As on every heart diagram it is seen from the front, so the heart's right side is on
 * the reader's left.
 *
 * The pulmonary artery and the vena cava must cross on the left: one joins the lower
 * chamber to the lungs above, the other the upper chamber to the body below. The artery
 * is drawn over the vein with a white gap, the usual way to show two pipes that do not
 * meet. Every label sits in clear space, away from the lines.
 *
 * 294 units wide, for the 298 a phone's card leaves. No props.
 */
export const W = 294
const H = 446
const BLUE = '#2563eb'
const RED = '#dc2626'

/** A vessel: a thick line along the points, with an arrowhead at the last one. */
function Vessel({ pts, colour, gap = false }: { pts: [number, number][]; colour: string; gap?: boolean }) {
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')
  const [x1, y1] = pts.at(-2)!
  const [x2, y2] = pts.at(-1)!
  const a = Math.atan2(y2 - y1, x2 - x1)
  const h = 11
  const head = `M${x2 + 3 * Math.cos(a)} ${y2 + 3 * Math.sin(a)} L${x2 - h * Math.cos(a - 0.5)} ${y2 - h * Math.sin(a - 0.5)} L${x2 - h * Math.cos(a + 0.5)} ${y2 - h * Math.sin(a + 0.5)} Z`
  return (
    <g>
      {gap && <path d={d} fill="none" stroke="#fff" strokeWidth="13" strokeLinejoin="round" />}
      <path d={d} fill="none" stroke={colour} strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" />
      <path d={head} fill={colour} />
    </g>
  )
}

/** How thick each chamber's wall is drawn. */
export const WALLS = { atrium: 2, rightVentricle: 5, leftVentricle: 8 }
/**
 * How wide a chamber is, and where the two sides start: the heart's right side on the
 * reader's left. Wide enough that "ventricle" stays clear of the thickest wall; at 60 the
 * word all but touched it.
 */
export const CHAMBER_W = 74
const LEFT = 150, RIGHT = LEFT - 6 - CHAMBER_W

function Chamber({ x, y, w, h, colour, fill, wall, lines }: { x: number; y: number; w: number; h: number; colour: string; fill: string; wall: number; lines: string[] }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="12" fill={fill} stroke={colour} strokeWidth={wall} />
      {lines.map((l, i) => (
        <text key={l} x={x + w / 2} y={y + h / 2 + (i - (lines.length - 1) / 2) * 15 + 4} textAnchor="middle" fontFamily={FONT} fontSize="12" fontWeight="700" fill={INK}>{l}</text>
      ))}
    </g>
  )
}

/** A valve: two flaps pointing the way the blood goes, so it reads as a one-way door. */
function Valve({ x, y }: { x: number; y: number }) {
  return <path d={`M${x - 9} ${y - 5} L${x} ${y + 4} L${x + 9} ${y - 5}`} fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
}

function Organ({ y, name, note }: { y: number; name: string; note: string }) {
  return (
    <g>
      <rect x="70" y={y} width="154" height="40" rx="10" fill="#f3f4f6" stroke="#9ca3af" strokeWidth="1.5" />
      <text x="147" y={y + 17} textAnchor="middle" fontFamily={DISPLAY} fontSize="14" fontWeight="700" fill={INK}>{name}</text>
      <text x="147" y={y + 32} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>{note}</text>
    </g>
  )
}

export function HeartDiagram({ alt }: { props: Record<string, unknown>; alt: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 440 }} role="img" aria-label={alt}>
      <Organ y={8} name="Lungs" note="blood picks up oxygen" />
      <Organ y={298} name="Body" note="cells use the oxygen" />

      {/* Deoxygenated, on the heart's right side (the reader's left). */}
      <Vessel pts={[[70, 318], [20, 318], [20, 136], [RIGHT - 4, 136]]} colour={BLUE} />
      <Vessel pts={[[RIGHT, 206], [40, 206], [40, 27], [66, 27]]} colour={BLUE} gap />
      {/* Oxygenated, on the heart's left side. */}
      <Vessel pts={[[224, 27], [270, 27], [270, 136], [LEFT + CHAMBER_W + 4, 136]]} colour={RED} />
      <Vessel pts={[[LEFT + CHAMBER_W, 216], [248, 216], [248, 318], [228, 318]]} colour={RED} />

      {/* The walls in order of the work they do (8.8, "the relative thickness of chamber
          walls"): the atria thinnest, the right ventricle thicker, the left thickest. The
          right ventricle was drawn as thin as the atria. */}
      <Chamber x={RIGHT} y={112} w={CHAMBER_W} h={48} colour={BLUE} fill="#dbeafe" wall={WALLS.atrium} lines={['Right', 'atrium']} />
      <Chamber x={RIGHT} y={166} w={CHAMBER_W} h={80} colour={BLUE} fill="#dbeafe" wall={WALLS.rightVentricle} lines={['Right', 'ventricle']} />
      <Chamber x={LEFT} y={112} w={CHAMBER_W} h={48} colour={RED} fill="#fee2e2" wall={WALLS.atrium} lines={['Left', 'atrium']} />
      <Chamber x={LEFT} y={166} w={CHAMBER_W} h={86} colour={RED} fill="#fee2e2" wall={WALLS.leftVentricle} lines={['Left', 'ventricle']} />
      <Valve x={RIGHT + CHAMBER_W / 2} y={163} />
      <Valve x={LEFT + CHAMBER_W / 2} y={163} />

      <text x="48" y="74" fontFamily={FONT} fontSize="12" fontWeight="700" fill={BLUE}>Pulmonary</text>
      <text x="48" y="89" fontFamily={FONT} fontSize="12" fontWeight="700" fill={BLUE}>artery</text>
      <text x="28" y="276" fontFamily={FONT} fontSize="12" fontWeight="700" fill={BLUE}>Vena cava</text>
      <text x="260" y="74" textAnchor="end" fontFamily={FONT} fontSize="12" fontWeight="700" fill={RED}>Pulmonary</text>
      <text x="260" y="89" textAnchor="end" fontFamily={FONT} fontSize="12" fontWeight="700" fill={RED}>vein</text>
      <text x="240" y="276" textAnchor="end" fontFamily={FONT} fontSize="12" fontWeight="700" fill={RED}>Aorta</text>

      <g fontFamily={FONT} fontSize="12" fill={INK}>
        <rect x="14" y="354" width="12" height="12" rx="3" fill={BLUE} />
        <text x="34" y="364">Deoxygenated blood</text>
        <rect x="14" y="374" width="12" height="12" rx="3" fill={RED} />
        <text x="34" y="384">Oxygenated blood</text>
        <path d="M11 396 L20 405 L29 396" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <text x="34" y="405">Valve: blood flows one way only</text>
        <text x="14" y="424" fill={INK_2}>Seen from the front, so the heart’s</text>
        <text x="14" y="439" fill={INK_2}>right side is on your left.</text>
      </g>
    </svg>
  )
}
