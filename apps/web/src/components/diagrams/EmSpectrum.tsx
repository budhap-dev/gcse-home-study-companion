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
 * A laptop has room for the picture every textbook draws, the seven groups side by side
 * under one wave that tightens from left to right, and the resource page asks for it with
 * `layout: 'across'`. Down a phone that wave would be seven rows of squiggle, which is why
 * the two layouts differ and the narrow one stays the default.
 *
 * Props: { layout?: 'down' | 'across' }. The content is the specification's, so it lives
 * here, not in the topic.
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

/**
 * A number and its unit, held together by a space no line breaks at. Wrapped to a column,
 * "about 1 m to 1 km" ended its first line on the 1 and began the next with "km".
 */
export const keepUnits = (text: string) => text.replace(/(\d) (?=(?:km|cm|mm|nm|μm|m)\b)/g, '$1\u00a0')

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

/** Seven columns a laptop card holds at the size the text was drawn. */
const COL_W = 140
export const ACROSS_W = COL_W * BANDS.length
const STRIP_TOP = 34
const STRIP_H = 84
/** The longest and shortest wave drawn, in units: a ratio chosen to show, not to scale. */
const LONGEST = 118
const SHORTEST = 9

/**
 * One wave across every band, its wavelength shrinking steadily from the left edge to the
 * right. The phase is the integral of 2π/λ, so the wave stays unbroken where the
 * wavelength changes; joining separate sine curves would leave a kink at every band edge.
 */
export function chirp(from: number, to: number, cy: number, amp: number): string {
  const k = Math.log(LONGEST / SHORTEST) / ACROSS_W
  const phase = (x: number) => (2 * Math.PI * (Math.exp(k * x) - 1)) / (k * LONGEST)
  // Whole steps from one edge to the other, so a piece ends exactly where the next begins.
  // Stepping by a fixed 0.75 stopped half a unit short, a break in the wave at every join.
  const steps = Math.max(1, Math.ceil((to - from) / 0.75))
  let d = ''
  for (let i = 0; i <= steps; i++) {
    const at = from + ((to - from) * i) / steps
    d += `${d ? 'L' : 'M'}${at.toFixed(2)} ${(cy - amp * Math.sin(phase(at))).toFixed(2)}`
  }
  return d
}

function Across({ alt }: { alt: string }) {
  const budget = Math.floor((COL_W - 18) / (12 * 0.6))
  const cols = BANDS.map((b) => ({
    ...b,
    about: wrapCell(keepUnits(b.about), budget),
    uses: wrapCell(`Uses: ${b.uses}`, budget),
    harm: b.harm ? wrapCell(`Harm: ${b.harm}`, budget) : [],
  }))
  const textTop = STRIP_TOP + STRIP_H + 26
  const heightOf = (c: (typeof cols)[number]) => 18 + c.about.length * 15 + 4 + c.uses.length * 15 + (c.harm.length ? 4 + c.harm.length * 15 : 0)
  const H = textTop + Math.max(...cols.map(heightOf)) + 12
  const mid = STRIP_TOP + STRIP_H / 2

  return (
    <svg viewBox={`0 0 ${ACROSS_W} ${H}`} width="100%" style={{ maxWidth: Math.round(ACROSS_W * 1.25) }} role="img" aria-label={alt} data-layout="across">
      <defs>
        <linearGradient id="em-visible-across" x1="0" x2="1" y1="0" y2="0">
          {['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb', '#4f46e5', '#7c3aed'].map((c, i) => <stop key={c} offset={i / 6} stopColor={c} />)}
        </linearGradient>
      </defs>
      <text x={8} y={18} fontFamily={FONT} fontSize="12" fontWeight="700" fill={INK_2}>Longer wavelength, lower frequency</text>
      <text x={ACROSS_W - 8} y={18} textAnchor="end" fontFamily={FONT} fontSize="12" fontWeight="700" fill={INK_2}>Shorter wavelength, higher frequency</text>
      <path d={`M${ACROSS_W / 2 - 150} 14 L${ACROSS_W / 2 + 150} 14 M${ACROSS_W / 2 + 143} 9 L${ACROSS_W / 2 + 150} 14 L${ACROSS_W / 2 + 143} 19`} stroke={INK_2} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {cols.map((c, i) => {
        const x = i * COL_W
        const stroke = c.colour === 'rainbow' ? 'url(#em-visible-across)' : c.colour
        const band = c.colour === 'rainbow' ? '#7c3aed' : c.colour
        const aboutY = c.about.map((_, j) => textTop + 18 + j * 15)
        const usesY = c.uses.map((_, j) => aboutY.at(-1)! + 4 + 15 * (j + 1))
        const harmY = c.harm.map((_, j) => usesY.at(-1)! + 4 + 15 * (j + 1))
        return (
          <g key={c.name} data-band={c.name}>
            <rect x={x + 2} y={STRIP_TOP} width={COL_W - 4} height={STRIP_H} rx="8" fill={band} fillOpacity={0.08} />
            <path d={chirp(x, x + COL_W, mid, 26)} stroke={stroke} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" data-wave="" />
            {i > 0 && <line x1={x} y1={STRIP_TOP + STRIP_H + 10} x2={x} y2={H - 6} stroke={RULE} />}
            <text x={x + 10} y={textTop} fontFamily={DISPLAY} fontSize="15" fontWeight="700" fill={band}>{c.name}</text>
            {c.about.map((a, j) => <text key={`a${j}`} x={x + 10} y={aboutY[j]} fontFamily={FONT} fontSize="12" fill={INK_2}>{a}</text>)}
            {c.uses.map((u, j) => <text key={`u${j}`} x={x + 10} y={usesY[j]} fontFamily={FONT} fontSize="12" fill={INK}>{u}</text>)}
            {c.harm.map((h, j) => <text key={`h${j}`} x={x + 10} y={harmY[j]} fontFamily={FONT} fontSize="12" fontWeight="700" fill="#b3261e">{h}</text>)}
          </g>
        )
      })}
    </svg>
  )
}

export function EmSpectrum({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  if (props.layout === 'across') return <Across alt={alt} />
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
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 460 }} role="img" aria-label={alt} data-layout="down">
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
            <path d={wavePath(WAVE_X, top + r.height / 2, r.cycles, Math.min(16, (r.height - 30) / 2))} stroke={stroke} strokeWidth="2.4" fill="none" strokeLinecap="round" data-wave="" />
            <text x={TEXT_X} y={nameY} fontFamily={DISPLAY} fontSize="15" fontWeight="700" fill={band}>{r.name}</text>
            <text x={TEXT_X} y={aboutY} fontFamily={FONT} fontSize="12" fill={INK_2}>{keepUnits(r.about)}</text>
            {r.uses.map((u, j) => <text key={`u${j}`} x={TEXT_X} y={usesY[j]} fontFamily={FONT} fontSize="12" fill={INK}>{u}</text>)}
            {r.harm.map((h, j) => <text key={`h${j}`} x={TEXT_X} y={harmY[j]} fontFamily={FONT} fontSize="12" fontWeight="700" fill="#b3261e">{h}</text>)}
          </g>
        )
      })}
      <text x={WAVE_X} y={H - 12} fontFamily={FONT} fontSize="12" fontWeight="700" fill={INK_2}>Shorter wavelength, higher frequency</text>
    </svg>
  )
}
