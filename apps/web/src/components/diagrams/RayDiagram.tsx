import { ACCENT, DISPLAY, FONT, INK, INK_2 } from './index.tsx'

/**
 * Light meeting a boundary. The component works out where every ray goes, so the
 * picture cannot disagree with the angles the lesson quotes. Props:
 *   kind: 'reflection' | 'refraction' | 'specular' | 'diffuse'
 *   incidence: angle of incidence in degrees, measured from the normal
 *   speedRatio: for refraction, the speed in the second medium divided by the speed in
 *     the first. Below 1 the light slows and bends towards the normal, which is what
 *     the specification asks students to explain. The refraction angle is computed
 *     from it rather than given, so a slower medium always bends the right way.
 *   media: [name of the upper medium, name of the lower one]
 */
export function RayDiagram({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const kind = String(props.kind ?? 'reflection') as 'reflection' | 'refraction' | 'specular' | 'diffuse'
  const i = Math.max(5, Math.min(80, Number(props.incidence ?? 40)))
  const ratio = Math.max(0.2, Math.min(2, Number(props.speedRatio ?? 2 / 3)))
  const media = (props.media as string[] | undefined) ?? ['air', 'glass']
  const rad = (d: number) => (d * Math.PI) / 180
  const deg = (r: number) => (r * 180) / Math.PI

  const W = 360
  const H = 240
  const surfaceY = kind === 'reflection' || kind === 'specular' || kind === 'diffuse' ? 170 : 120
  const P = { x: W / 2, y: surfaceY }
  const len = 110

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

  if (kind === 'specular' || kind === 'diffuse') {
    const rays = [-70, 0, 70]
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W * 1.4 }} role="img" aria-label={alt}>
        <text x={W / 2} y="22" textAnchor="middle" fontFamily={DISPLAY} fontSize="14" fontWeight="700" fill={INK}>
          {kind === 'specular' ? 'Specular reflection: a smooth surface' : 'Diffuse reflection: a rough surface'}
        </text>
        {kind === 'specular' ? (
          <line x1="30" y1={surfaceY} x2={W - 30} y2={surfaceY} stroke={INK} strokeWidth="2.5" />
        ) : (
          <path d={`M30 ${surfaceY} l 40 -9 l 45 12 l 38 -13 l 42 10 l 40 -8 l 45 11 l 30 -6`} fill="none" stroke={INK} strokeWidth="2.5" />
        )}
        {rays.map((dx, n) => {
          // On a rough surface each ray meets the bumps at its own angle, so the
          // reflected rays scatter instead of staying parallel.
          const hit = { x: W / 2 + dx, y: surfaceY - (kind === 'diffuse' ? [-2, 6, -4][n] : 0) }
          const inFrom = { x: hit.x - 70, y: hit.y - 80 }
          const spread = kind === 'specular' ? 0 : [26, -18, 10][n]
          const out = { x: hit.x + 70 + spread, y: hit.y - 80 + (kind === 'specular' ? 0 : [10, -14, 18][n]) }
          return (
            <g key={n}>
              <line x1={inFrom.x} y1={inFrom.y} x2={hit.x} y2={hit.y} stroke="var(--subject)" strokeWidth="2" />
              {arrow(inFrom, hit)}
              <line x1={hit.x} y1={hit.y} x2={out.x} y2={out.y} stroke="var(--subject)" strokeWidth="2" />
              {arrow(hit, out)}
            </g>
          )
        })}
        <text x={W / 2} y={H - 10} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>
          {kind === 'specular' ? 'parallel rays in, parallel rays out' : 'parallel rays in, scattered rays out'}
        </text>
      </svg>
    )
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W * 1.4 }} role="img" aria-label={alt}>
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
          <text x={W / 2} y={H - 12} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>angle of incidence = angle of reflection</text>
        </g>
      )}

      {kind === 'refraction' && (
        <g>
          <line x1={P.x} y1={P.y} x2={refracted.x} y2={refracted.y} stroke="var(--subject)" strokeWidth="2.5" />
          {arrow(P, refracted)}
          {angleArc(180, 180 - r, `${Math.round(r)}°`, 42)}
          <text x="14" y={surfaceY - 12} fontFamily={FONT} fontSize="12" fill={INK_2}>{media[0]}</text>
          <text x="14" y={surfaceY + 20} fontFamily={FONT} fontSize="12" fill={INK_2}>{media[1]}</text>
          <text x={W / 2} y={H - 10} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>
            {ratio < 1 ? 'slower in the second medium, so it bends towards the normal' : 'faster in the second medium, so it bends away from the normal'}
          </text>
        </g>
      )}
      <circle cx={P.x} cy={P.y} r="3.5" fill={ACCENT} />
    </svg>
  )
}
