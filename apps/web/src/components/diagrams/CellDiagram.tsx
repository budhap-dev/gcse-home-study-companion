import { DISPLAY, FONT, INK, INK_2 } from './index.tsx'

/**
 * An animal, plant or bacterial cell, drawn and labelled with the sub-cellular structures
 * Edexcel 1BI0 names in 1.1: nucleus, cell membrane, mitochondria and ribosomes for an
 * animal cell; those and the cell wall, chloroplasts and vacuole for a plant cell;
 * chromosomal DNA, plasmid DNA, cell membrane, ribosomes and flagella for a bacterium.
 * Cytoplasm and the bacterial cell wall are labelled too, since they are drawn anyway.
 *
 * Drawn to be read, not to scale. The cell sits on the left and every label in a column on
 * the right, each with a swatch of its part's colour and a leader line to it, so no line
 * ever runs through another label, and the labels are ordered so that no two leader lines
 * cross (the test checks every pair).
 *
 * 294 units wide, for the 298 a phone's card leaves.
 *
 * Props: { cell: 'animal' | 'plant' | 'bacterium' }. Defaults to animal.
 */
export type Kind = 'animal' | 'plant' | 'bacterium'
interface Label { name: string; colour: string; at: [number, number] }

export const W = 294
const LABEL_X = 162
const H = 200

const MEMBRANE = '#b3261e'
const NUCLEUS = '#6d28d9'
const MITO = '#c2410c'
const RIBOSOME = '#1e3a8a'
const CHLORO = '#15803d'
const VACUOLE = '#1d4ed8'
const DNA = '#7e22ce'
const PLASMID = '#be185d'
const WALL = '#0f766e'

/** Where each cell's labels point, top to bottom. */
export const LABELS: Record<Kind, Label[]> = {
  animal: [
    { name: 'Mitochondria', colour: MITO, at: [124, 58] },
    { name: 'Nucleus', colour: NUCLEUS, at: [88, 80] },
    { name: 'Ribosomes', colour: RIBOSOME, at: [128, 101] },
    { name: 'Cytoplasm', colour: '#9a3412', at: [104, 122] },
    // On the outline itself. At [143, 136] the point sat 5 units outside it, touching nothing.
    { name: 'Cell membrane', colour: MEMBRANE, at: [138, 134] },
  ],
  plant: [
    { name: 'Cell wall', colour: CHLORO, at: [147, 22] },
    { name: 'Chloroplasts', colour: '#166534', at: [122, 33] },
    { name: 'Nucleus', colour: NUCLEUS, at: [44, 42] },
    { name: 'Ribosomes', colour: RIBOSOME, at: [136, 64] },
    { name: 'Vacuole', colour: VACUOLE, at: [118, 104] },
    { name: 'Cell membrane', colour: MEMBRANE, at: [140, 150] },
    { name: 'Mitochondria', colour: MITO, at: [34, 166] },
  ],
  bacterium: [
    { name: 'Chromosomal DNA', colour: DNA, at: [99, 94] },
    { name: 'Plasmid DNA', colour: PLASMID, at: [128, 78] },
    { name: 'Cell wall', colour: WALL, at: [147, 100] },
    { name: 'Ribosomes', colour: RIBOSOME, at: [60, 116] },
    // On the inner line, 33 from the centre of the end. At [136, 124] the point was 37 from
    // it, in the gap between the membrane and the wall, and read as pointing at the wall.
    { name: 'Cell membrane', colour: MEMBRANE, at: [133, 121] },
    { name: 'Flagellum', colour: '#475569', at: [16, 170] },
  ],
}

const TITLE: Record<Kind, string> = { animal: 'Animal cell', plant: 'Plant cell', bacterium: 'Bacterial cell' }

function Mito({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <ellipse rx="15" ry="7.5" fill="#fed7aa" stroke={MITO} strokeWidth="1.8" />
      <path d="M-10 0 l3 -4 l3 7 l3 -7 l3 7 l3 -7 l3 4" fill="none" stroke={MITO} strokeWidth="1.2" />
    </g>
  )
}
const dots = (pts: [number, number][]) => pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.3" fill={RIBOSOME} />)

function Animal() {
  return (
    <g>
      <path d="M78 14 C118 12 146 42 145 84 C146 126 132 176 84 184 C42 190 10 160 12 108 C10 60 36 16 78 14 Z" fill="#fde2e1" stroke={MEMBRANE} strokeWidth="2.6" />
      <circle cx="70" cy="92" r="22" fill="#ddd6fe" stroke={NUCLEUS} strokeWidth="2" />
      <circle cx="64" cy="88" r="6" fill="#a78bfa" />
      <Mito x={112} y={56} r={20} />
      <Mito x={40} y={142} r={-30} />
      <Mito x={106} y={152} r={8} />
      {dots([[50, 46], [128, 101], [94, 128], [30, 100], [76, 162], [120, 122], [40, 70], [98, 36]])}
    </g>
  )
}

function Plant() {
  return (
    <g>
      <rect x="8" y="12" width="140" height="176" rx="8" fill="#dcfce7" stroke={CHLORO} strokeWidth="6" />
      <rect x="15" y="19" width="126" height="162" rx="5" fill="#f0fdf4" stroke={MEMBRANE} strokeWidth="1.6" />
      <rect x="50" y="56" width="80" height="102" rx="16" fill="#bfdbfe" stroke={VACUOLE} strokeWidth="2" />
      <circle cx="32" cy="42" r="13" fill="#ddd6fe" stroke={NUCLEUS} strokeWidth="2" />
      <circle cx="29" cy="39" r="4" fill="#a78bfa" />
      {[[80, 33, 0], [114, 33, 0], [26, 88, 90], [26, 126, 90], [72, 170, 0], [112, 170, 0]].map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
          <ellipse rx="10" ry="5.5" fill="#4ade80" stroke="#166534" strokeWidth="1.6" />
          <line x1="-6" y1="0" x2="6" y2="0" stroke="#166534" strokeWidth="1" />
        </g>
      ))}
      <Mito x={34} y={164} r={-20} />
      {dots([[58, 42], [98, 44], [30, 66], [136, 64], [42, 178], [136, 140]])}
    </g>
  )
}

function Bacterium() {
  return (
    <g>
      <path d="M40 132 q-6 10 -14 8 q-8 -2 -6 12 q2 12 -8 18" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
      <rect x="28" y="60" width="120" height="80" rx="40" fill="#ccfbf1" stroke={WALL} strokeWidth="4.5" />
      <rect x="35" y="67" width="106" height="66" rx="33" fill="#f0fdfa" stroke={MEMBRANE} strokeWidth="1.6" />
      <path d="M62 96 C64 80 84 80 88 90 C92 100 104 84 106 96 C108 108 92 112 86 104 C80 96 70 114 64 106 C60 102 60 100 62 96 Z" fill="none" stroke={DNA} strokeWidth="2.2" />
      <circle cx="122" cy="80" r="6.5" fill="none" stroke={PLASMID} strokeWidth="2" />
      <circle cx="118" cy="116" r="5" fill="none" stroke={PLASMID} strokeWidth="2" />
      {dots([[60, 116], [50, 88], [98, 120], [132, 100], [80, 76]])}
    </g>
  )
}

/**
 * Each label's row and its leader line, from the label column to the part (in the drawing's
 * coordinates, which sit 20 units down under the title). Exported so the test can check
 * that no two lines cross: ordering by the height of the part is not enough, because a
 * part far to the left pulls its line under its neighbour's.
 */
export function leaderLines(kind: Kind) {
  const labels = LABELS[kind]
  const top = 34
  const step = (H - top - 6) / Math.max(1, labels.length - 1)
  return labels.map((l, i) => {
    const y = top + i * step
    return { ...l, y, from: [LABEL_X - 4, y - 4] as [number, number], to: [l.at[0], l.at[1] + 20] as [number, number] }
  })
}

export function CellDiagram({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const kind: Kind = props.cell === 'plant' || props.cell === 'bacterium' ? props.cell : 'animal'
  const rows = leaderLines(kind)
  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} width="100%" style={{ maxWidth: 440 }} role="img" aria-label={alt}>
      <g transform="translate(0 20)">
        {kind === 'animal' ? <Animal /> : kind === 'plant' ? <Plant /> : <Bacterium />}
      </g>
      <text x={LABEL_X} y={16} fontFamily={DISPLAY} fontSize="14" fontWeight="700" fill={INK}>{TITLE[kind]}</text>
      {rows.map((r) => (
        <g key={r.name} data-label={r.name}>
          <line x1={r.from[0]} y1={r.from[1]} x2={r.to[0]} y2={r.to[1]} stroke={INK_2} strokeWidth="1.1" />
          <circle cx={r.to[0]} cy={r.to[1]} r="2.2" fill={INK} />
          <rect x={LABEL_X} y={r.y - 13} width="10" height="10" rx="3" fill={r.colour} />
          <text x={LABEL_X + 14} y={r.y - 4} fontFamily={FONT} fontSize="12" fontWeight="700" fill={INK}>{r.name}</text>
        </g>
      ))}
    </svg>
  )
}
