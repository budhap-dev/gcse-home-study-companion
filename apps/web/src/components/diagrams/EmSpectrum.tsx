import { DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'
import { wrapCell } from './tableLayout.ts'

/**
 * The electromagnetic spectrum as AQA 8463 4.6.2 describes it: seven groups from long
 * wavelength and low frequency to short wavelength and high frequency, each with the uses
 * the specification lists (4.6.2.4) and, for the three that harm body tissue, the harm
 * it names (4.6.2.3).
 *
 * One row per group, top to bottom, with a wave drawn in each row whose wavelength
 * shrinks as you go down. The squeeze is the point of the picture, so it is drawn to a
 * fixed ratio rather than to scale: the real range, a kilometre down to a trillionth of a
 * metre, would leave every row but one as a flat line or a solid block.
 *
 * 294 units wide, for the 298 a phone's card leaves. The typical wavelength in each row
 * is an order of magnitude, labelled "about", because the groups have no sharp edges.
 *
 * Props: none. The content is the specification's, so it lives here, not in the topic.
 */
interface Band { name: string; colour: string; about: string; uses: string; harm?: string; cycles: number }

export const BANDS: Band[] = [
  { name: 'Radio waves', colour: '#b3261e', about: 'about 1 m to 1 km', uses: 'Television and radio.', cycles: 1 },
  { name: 'Microwaves', colour: '#c2410c', about: 'about 1 cm', uses: 'Satellite communications, cooking food.', cycles: 1.6 },
  { name: 'Infrared', colour: '#a16207', about: 'about 10 μm', uses: 'Electrical heaters, cooking food, infrared cameras.', cycles: 2.4 },
  { name: 'Visible light', colour: 'rainbow', about: '400 to 700 nm, red to violet', uses: 'Fibre optic communications. The only group our eyes detect.', cycles: 3.4 },
  { name: 'Ultraviolet', colour: '#7e22ce', about: 'about 100 nm', uses: 'Energy efficient lamps, sun tanning.', harm: 'Ages skin early and raises the risk of skin cancer.', cycles: 4.6 },
  { name: 'X-rays', colour: '#4338ca', about: 'about 0.1 nm', uses: 'Medical imaging and treatments.', harm: 'Ionising: can cause gene mutation and cancer.', cycles: 6 },
  { name: 'Gamma rays', colour: '#1e3a8a', about: 'about 0.001 nm', uses: 'Medical imaging and treatments.', harm: 'Ionising: can cause gene mutation and cancer.', cycles: 8 },
]

export const W = 294
const WAVE_X = 10
const WAVE_W = 72
const TEXT_X = WAVE_X + WAVE_W + 14
/** Characters a line holds at 12px in the text column, at the 0.6 the phone-fit check assumes. */
const BUDGET = Math.floor((W - TEXT_X - 8) / (12 * 0.6))
const ARROW_H = 40

/** A sine wave across the band's box, `cycles` whole waves wide. */
function wavePath(x: number, cy: number, cycles: number, amp: number): string {
  const steps = 96
  let d = ''
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const px = x + t * WAVE_W
    const py = cy - amp * Math.sin(t * cycles * 2 * Math.PI)
    d += `${i === 0 ? 'M' : 'L'}${px.toFixed(2)} ${py.toFixed(2)}`
  }
  return d
}

export function EmSpectrum({ alt }: { props: Record<string, unknown>; alt: string }) {
  const rows = BANDS.map((b) => {
    const uses = wrapCell(`Uses: ${b.uses}`, BUDGET)
    const harm = b.harm ? wrapCell(`Harm: ${b.harm}`, BUDGET) : []
    const height = 12 + 18 + 15 + uses.length * 15 + (harm.length ? 3 + harm.length * 15 : 0) + 10
    return { ...b, uses, harm, height: Math.max(height, 80) }
  })
  const tops: number[] = []
  let y = ARROW_H
  for (const r of rows) { tops.push(y); y += r.height }
  const H = y + ARROW_H

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 460 }} role="img" aria-label={alt}>
      <defs>
        <linearGradient id="em-visible" x1="0" x2="1" y1="0" y2="0">
          {['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb', '#4f46e5', '#7c3aed'].map((c, i) => <stop key={c} offset={i / 6} stopColor={c} />)}
        </linearGradient>
      </defs>
      <text x={WAVE_X} y={16} fontFamily={FONT} fontSize="12" fontWeight="700" fill={INK_2}>Longer wavelength, lower frequency</text>
      <path d={`M${W - 14} 8 L${W - 14} 30 M${W - 19} 25 L${W - 14} 31 L${W - 9} 25`} stroke={INK_2} strokeWidth="1.6" fill="none" />
      {rows.map((r, i) => {
        const top = tops[i]!
        const stroke = r.colour === 'rainbow' ? 'url(#em-visible)' : r.colour
        const band = r.colour === 'rainbow' ? '#7c3aed' : r.colour
        const nameY = top + 28
        const aboutY = nameY + 15
        const usesY = r.uses.map((_, j) => aboutY + 15 * (j + 1))
        const harmY = r.harm.map((_, j) => aboutY + 15 * r.uses.length + 3 + 15 * (j + 1))
        return (
          <g key={r.name} data-band={r.name}>
            {i > 0 && <line x1={WAVE_X} y1={top} x2={W - 8} y2={top} stroke={RULE} />}
            <rect x={WAVE_X} y={top + 8} width={WAVE_W} height={r.height - 16} rx="8" fill={band} fillOpacity={0.08} />
            <path d={wavePath(WAVE_X, top + r.height / 2, r.cycles, Math.min(16, (r.height - 30) / 2))} stroke={stroke} strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <text x={TEXT_X} y={nameY} fontFamily={DISPLAY} fontSize="15" fontWeight="700" fill={band}>{r.name}</text>
            <text x={TEXT_X} y={aboutY} fontFamily={FONT} fontSize="12" fill={INK_2}>{r.about}</text>
            {r.uses.map((u, j) => <text key={`u${j}`} x={TEXT_X} y={usesY[j]} fontFamily={FONT} fontSize="12" fill={INK}>{u}</text>)}
            {r.harm.map((h, j) => <text key={`h${j}`} x={TEXT_X} y={harmY[j]} fontFamily={FONT} fontSize="12" fontWeight="700" fill="#b3261e">{h}</text>)}
          </g>
        )
      })}
      <text x={WAVE_X} y={H - 12} fontFamily={FONT} fontSize="12" fontWeight="700" fill={INK_2}>Shorter wavelength, higher frequency</text>
    </svg>
  )
}
