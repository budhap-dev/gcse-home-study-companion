import { ACCENT, DISPLAY, FONT, INK, INK_2 } from './index.tsx'

/**
 * Greedy word wrap to a room measured the same way the phone-fit test measures text: a
 * character is 0.6 × the font size wide. A word longer than the room is left on its own
 * line rather than split.
 */
function wrapWords(text: string, size: number, room: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (line && candidate.length * size * 0.6 > room) { lines.push(line); line = word }
    else line = candidate
  }
  if (line) lines.push(line)
  return lines
}

/**
 * Light meeting a boundary. The component works out where every ray goes, so the
 * picture cannot disagree with the angles the lesson quotes. Props:
 *   kind: 'reflection' | 'refraction' | 'specular' | 'diffuse' | 'block'
 *   incidence: angle of incidence in degrees, measured from the normal
 *   speedRatio: for refraction, the speed in the second medium divided by the speed in
 *     the first. Below 1 the light slows and bends towards the normal, which is what
 *     the specification asks students to explain. The refraction angle is computed
 *     from it rather than given, so a slower medium always bends the right way.
 *   media: [name of the upper medium, name of the lower one]
 *
 * 'block' is required practical 9's picture: a ray into a rectangular block, the faint
 * reflection off its top face, the refracted ray inside, and the ray emerging from the
 * bottom face. The emergent ray leaves at the angle the incident ray arrived, so it is
 * drawn parallel to it, shifted sideways; `media` names [the surroundings, the block].
 */
export function RayDiagram({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const kind = String(props.kind ?? 'reflection') as 'reflection' | 'refraction' | 'specular' | 'diffuse' | 'block'
  const i = Math.max(5, Math.min(80, Number(props.incidence ?? 40)))
  const ratio = Math.max(0.2, Math.min(2, Number(props.speedRatio ?? 2 / 3)))
  const media = (props.media as string[] | undefined) ?? ['air', 'glass']
  const rad = (d: number) => (d * Math.PI) / 180
  const deg = (r: number) => (r * 180) / Math.PI

  // 280 rather than 360, and the ray length scaled down with it: at 360 this scrolled up
  // to 62px on a phone. H grows a little (250 rather than 240) to give the long sentences
  // below room to wrap onto two lines without crowding the rays.
  const W = 280
  const H = 250
  const surfaceY = kind === 'reflection' || kind === 'specular' || kind === 'diffuse' ? 170 : 120
  const P = { x: W / 2, y: surfaceY }
  const len = 86

  // The refracted angle comes from the speed ratio, so it bends towards the normal
  // whenever the light slows down. Total internal reflection is out of scope here, so
  // a ratio that would reflect the ray entirely is capped at grazing.
  const sinR = Math.min(0.999, Math.sin(rad(i)) * ratio)
  const r = deg(Math.asin(sinR))

  const from = { x: P.x - len * Math.sin(rad(i)), y: P.y - len * Math.cos(rad(i)) }
  const reflected = { x: P.x + len * Math.sin(rad(i)), y: P.y - len * Math.cos(rad(i)) }
  const refracted = { x: P.x + len * Math.sin(rad(r)), y: P.y + len * Math.cos(rad(r)) }

  /** An arrowhead partway along a ray, so the direction of travel is never in doubt. */
  const arrow = (a: { x: number; y: number }, b: { x: number; y: number }, at = 0.55) => {
    const x = a.x + (b.x - a.x) * at
    const y = a.y + (b.y - a.y) * at
    const ang = Math.atan2(b.y - a.y, b.x - a.x)
    const size = 7
    const pts = [
      [x, y],
      [x - size * Math.cos(ang - 0.4), y - size * Math.sin(ang - 0.4)],
      [x - size * Math.cos(ang + 0.4), y - size * Math.sin(ang + 0.4)],
    ]
    return <polygon points={pts.map((p) => p.join(',')).join(' ')} fill="var(--subject)" />
  }

  /** The arc between a ray and the normal, with the angle written beside it. */
  const angleArc = (fromDeg: number, toDeg: number, label: string, radius: number) => {
    const a0 = rad(fromDeg)
    const a1 = rad(toDeg)
    const p0 = { x: P.x + radius * Math.sin(a0), y: P.y - radius * Math.cos(a0) }
    const p1 = { x: P.x + radius * Math.sin(a1), y: P.y - radius * Math.cos(a1) }
    const mid = (a0 + a1) / 2
    return (
      <g>
        <path d={`M${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A ${radius} ${radius} 0 0 ${a1 > a0 ? 1 : 0} ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`} fill="none" stroke={INK_2} strokeWidth="1.5" />
        <text x={P.x + (radius + 14) * Math.sin(mid)} y={P.y - (radius + 14) * Math.cos(mid) + 4} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>{label}</text>
      </g>
    )
  }

  if (kind === 'block') {
    // Drawn 280 wide rather than the 300 this used before: 300 still scrolled 28px once
    // fitSvgText widened it for the caption in the corner, so both the box and that
    // caption are narrower now.
    const BW = 280
    const top = 92, bottom = 172, bw = 200
    const bx = (BW - bw) / 2
    const entry = { x: BW / 2 - 20, y: top }
    const depth = bottom - top
    // Inside the block the ray runs at the refracted angle, so the exit point follows.
    const exit = { x: entry.x + depth * Math.tan(rad(r)), y: bottom }
    const inLen = 74, outLen = 44
    const start = { x: entry.x - inLen * Math.sin(rad(i)), y: entry.y - inLen * Math.cos(rad(i)) }
    const bounce = { x: entry.x + inLen * 0.7 * Math.sin(rad(i)), y: entry.y - inLen * 0.7 * Math.cos(rad(i)) }
    // Same angle out as in: air to block undoes what block to air did.
    const end = { x: exit.x + outLen * Math.sin(rad(i)), y: exit.y + outLen * Math.cos(rad(i)) }
    /**
     * The arc sits between the ray and the normal; the label sits just outside the ray on
     * the side away from the normal, because for a small angle the wedge is narrower than
     * the text and a label inside it has a line through it whatever the radius.
     */
    const arc = (at: { x: number; y: number }, fromDeg: number, toDeg: number, label: string, radius: number, labelDeg: number, labelR: number) => {
      const a0 = rad(fromDeg), a1 = rad(toDeg), la = rad(labelDeg)
      const p0 = { x: at.x + radius * Math.sin(a0), y: at.y - radius * Math.cos(a0) }
      const p1 = { x: at.x + radius * Math.sin(a1), y: at.y - radius * Math.cos(a1) }
      return (
        <g>
          <path d={`M${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A ${radius} ${radius} 0 0 ${a1 > a0 ? 1 : 0} ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`} fill="none" stroke={INK_2} strokeWidth="1.5" />
          <text x={at.x + labelR * Math.sin(la)} y={at.y - labelR * Math.cos(la) + 4} textAnchor="middle" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={INK}>{label}</text>
        </g>
      )
    }
    const cornerLines = wrapWords('out parallel to in, shifted sideways', 12, BW - 24)
    return (
      // 360 keeps the desktop size this had at its old 300-unit width (300 × 1.2); only
      // the phone-facing viewBox got narrower.
      <svg viewBox={`0 0 ${BW} ${H}`} width="100%" style={{ maxWidth: 360 }} role="img" aria-label={alt}>
        <rect x={bx} y={top} width={bw} height={depth} fill="var(--subject-soft)" stroke={INK} strokeWidth="2" />
        <text x={bx + 8} y={bottom - 8} fontFamily={FONT} fontSize="12" fill={INK_2}>{media[1]}</text>
        <text x={bx + 8} y={top - 8} fontFamily={FONT} fontSize="12" fill={INK_2}>{media[0]}</text>
        {/* Normals, dashed, at the point of entry and the point of exit. */}
        <line x1={entry.x} y1={top - 68} x2={entry.x} y2={top + 30} stroke={INK_2} strokeWidth="1.5" strokeDasharray="5 4" />
        <line x1={exit.x} y1={bottom - 30} x2={exit.x} y2={bottom + 24} stroke={INK_2} strokeWidth="1.5" strokeDasharray="5 4" />
        <text x={entry.x + 5} y={top - 58} fontFamily={FONT} fontSize="11" fill={INK_2}>normal</text>
        {/* Incident, the faint reflection, refracted, emergent. */}
        <line x1={start.x} y1={start.y} x2={entry.x} y2={entry.y} stroke="var(--subject)" strokeWidth="2.5" />
        {arrow(start, entry)}
        <line x1={entry.x} y1={entry.y} x2={bounce.x} y2={bounce.y} stroke="var(--subject)" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.7" />
        <line x1={entry.x} y1={entry.y} x2={exit.x} y2={exit.y} stroke="var(--subject)" strokeWidth="2.5" />
        {arrow(entry, exit, 0.5)}
        <line x1={exit.x} y1={exit.y} x2={end.x} y2={end.y} stroke="var(--subject)" strokeWidth="2.5" />
        {arrow(exit, end, 0.6)}
        {arc(entry, -i, 0, `${Math.round(i)}°`, 34, -(i + 16), 46)}
        {arc(entry, 180, 180 - r, `${Math.round(r)}°`, 30, 180 - r - 16, 50)}
        {arc(exit, 180, 180 - i, `${Math.round(i)}°`, 30, 180 - i - 16, 46)}
        <circle cx={entry.x} cy={entry.y} r="3.5" fill={ACCENT} />
        <circle cx={exit.x} cy={exit.y} r="3.5" fill={ACCENT} />
        {cornerLines.map((line, j) => (
          <text key={`corner${j}`} x={BW - 12} y={16 + j * 14} textAnchor="end" fontFamily={FONT} fontSize="12" fill={INK_2}>{line}</text>
        ))}
      </svg>
    )
  }

  if (kind === 'specular' || kind === 'diffuse') {
    // Scaled down from the ±70/80 units this used at W = 360, so a ray drawn at the
    // widest spread still lands inside the narrower box instead of running past its edge.
    const spreadX = 54, runY = 62
    const rays = [-spreadX, 0, spreadX]
    const title = kind === 'specular' ? 'Specular reflection: a smooth surface' : 'Diffuse reflection: a rough surface'
    const titleLines = wrapWords(title, 14, W - 24)
    const caption = kind === 'specular' ? 'parallel rays in, parallel rays out' : 'parallel rays in, scattered rays out'
    const captionLines = wrapWords(caption, 12, W - 20)
    return (
      // 504 keeps the desktop size this had at its old 360-unit width (360 × 1.4); only
      // the phone-facing viewBox got narrower.
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 504 }} role="img" aria-label={alt}>
        {titleLines.map((line, j) => (
          <text key={`title${j}`} x={W / 2} y={16 + j * 16} textAnchor="middle" fontFamily={DISPLAY} fontSize="14" fontWeight="700" fill={INK}>{line}</text>
        ))}
        {kind === 'specular' ? (
          <line x1="30" y1={surfaceY} x2={W - 30} y2={surfaceY} stroke={INK} strokeWidth="2.5" />
        ) : (
          <path d={`M23 ${surfaceY} l 31 -9 l 35 12 l 30 -13 l 33 10 l 31 -8 l 35 11 l 23 -6`} fill="none" stroke={INK} strokeWidth="2.5" />
        )}
        {rays.map((dx, n) => {
          // On a rough surface each ray meets the bumps at its own angle, so the
          // reflected rays scatter instead of staying parallel.
          const hit = { x: W / 2 + dx, y: surfaceY - (kind === 'diffuse' ? [-2, 6, -4][n] : 0) }
          const inFrom = { x: hit.x - spreadX, y: hit.y - runY }
          const spread = kind === 'specular' ? 0 : [20, -14, 8][n]
          const out = { x: hit.x + spreadX + spread, y: hit.y - runY + (kind === 'specular' ? 0 : [10, -14, 18][n]) }
          return (
            <g key={n}>
              <line x1={inFrom.x} y1={inFrom.y} x2={hit.x} y2={hit.y} stroke="var(--subject)" strokeWidth="2" />
              {arrow(inFrom, hit)}
              <line x1={hit.x} y1={hit.y} x2={out.x} y2={out.y} stroke="var(--subject)" strokeWidth="2" />
              {arrow(hit, out)}
            </g>
          )
        })}
        {captionLines.map((line, j) => (
          <text key={`caption${j}`} x={W / 2} y={H - 10 - (captionLines.length - 1 - j) * 14} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>{line}</text>
        ))}
      </svg>
    )
  }

  const reflectionCaption = wrapWords('angle of incidence = angle of reflection', 12, W - 20)
  const refractionCaption = wrapWords(
    ratio < 1 ? 'slower in the second medium, so it bends towards the normal' : 'faster in the second medium, so it bends away from the normal',
    12,
    W - 20,
  )

  return (
    // 504 keeps the desktop size this had at its old 360-unit width (360 × 1.4); only the
    // phone-facing viewBox got narrower.
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 504 }} role="img" aria-label={alt}>
      {kind === 'refraction' && <rect x="0" y={surfaceY} width={W} height={H - surfaceY} fill="var(--subject-soft)" />}
      <line x1="20" y1={surfaceY} x2={W - 20} y2={surfaceY} stroke={INK} strokeWidth="2.5" />
      <line x1={P.x} y1={surfaceY - 100} x2={P.x} y2={surfaceY + (kind === 'refraction' ? 100 : 26)} stroke={INK_2} strokeWidth="1.5" strokeDasharray="5 4" />
      <text x={P.x + 6} y={surfaceY - 104} fontFamily={FONT} fontSize="11" fill={INK_2}>normal</text>

      <line x1={from.x} y1={from.y} x2={P.x} y2={P.y} stroke="var(--subject)" strokeWidth="2.5" />
      {arrow(from, P)}
      {angleArc(-i, 0, `${Math.round(i)}°`, 42)}

      {kind === 'reflection' && (
        <g>
          <line x1={P.x} y1={P.y} x2={reflected.x} y2={reflected.y} stroke="var(--subject)" strokeWidth="2.5" />
          {arrow(P, reflected)}
          {angleArc(0, i, `${Math.round(i)}°`, 42)}
          {reflectionCaption.map((line, j) => (
            <text key={`refl${j}`} x={W / 2} y={H - 10 - (reflectionCaption.length - 1 - j) * 14} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>{line}</text>
          ))}
        </g>
      )}

      {kind === 'refraction' && (
        <g>
          <line x1={P.x} y1={P.y} x2={refracted.x} y2={refracted.y} stroke="var(--subject)" strokeWidth="2.5" />
          {arrow(P, refracted)}
          {angleArc(180, 180 - r, `${Math.round(r)}°`, 42)}
          <text x="14" y={surfaceY - 12} fontFamily={FONT} fontSize="12" fill={INK_2}>{media[0]}</text>
          <text x="14" y={surfaceY + 20} fontFamily={FONT} fontSize="12" fill={INK_2}>{media[1]}</text>
          {refractionCaption.map((line, j) => (
            <text key={`refr${j}`} x={W / 2} y={H - 10 - (refractionCaption.length - 1 - j) * 14} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>{line}</text>
          ))}
        </g>
      )}
      <circle cx={P.x} cy={P.y} r="3.5" fill={ACCENT} />
    </svg>
  )
}
