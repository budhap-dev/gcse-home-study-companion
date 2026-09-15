import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

/**
 * A ray diagram for a convex or concave lens, which AQA 4.6.2.5 asks students to
 * construct.
 *
 * The image is not placed by hand. Its position comes from the lens equation
 * 1/v = 1/f - 1/u, with f negative for a concave lens, and everything the picture says
 * follows from the sign of v: a positive v is a real, inverted image on the far side, a
 * negative v a virtual, upright one on the same side. So the diagram cannot show a real
 * image where the physics gives a virtual one, and the magnification written on it is
 * the one its own rays produce.
 *
 * Props: kind ('convex' | 'concave'), focalLength, objectDistance, objectHeight (all in
 * the same arbitrary units), note.
 */
export function LensDiagram({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const concave = props.kind === 'concave'
  const f = (typeof props.focalLength === 'number' ? props.focalLength : 4) * (concave ? -1 : 1)
  const u = typeof props.objectDistance === 'number' ? props.objectDistance : 12
  const h = typeof props.objectHeight === 'number' ? props.objectHeight : 3
  const note = typeof props.note === 'string' ? props.note : undefined

  // The Cartesian convention, measuring from the lens with distances to the left negative,
  // so that the sign of the magnification carries the orientation: 1/v - 1/u = 1/f with
  // the object at u = -objectDistance. A positive v is a real image beyond the lens, a
  // negative v a virtual one on the same side, and a negative m an inverted image.
  const uSigned = -u
  const v = 1 / (1 / f + 1 / uSigned)
  const real = v > 0
  const m = v / uSigned
  const imageHeight = m * h
  const magnification = Math.abs(m)

  const W = 460, H = 300
  const axisY = H / 2 - 10
  const lensX = W / 2
  // Scale so the object, both foci and the image all fit.
  const span = Math.max(u, Math.abs(v), Math.abs(f) * 2) * 1.25
  const sx = (d: number) => lensX + (d / span) * (W / 2 - 24)
  const maxH = Math.max(h, Math.abs(imageHeight))
  const sy = (y: number) => axisY - (y / maxH) * 70

  const arrow = (x: number, top: number, colour: string, label: string, key: string) => (
    <g key={key}>
      <line x1={x} y1={axisY} x2={x} y2={top} stroke={colour} strokeWidth={2.4} />
      <polygon
        points={`${x},${top} ${x - 5},${top + (top < axisY ? 9 : -9)} ${x + 5},${top + (top < axisY ? 9 : -9)}`}
        fill={colour}
      />
      <text x={x} y={top < axisY ? top - 8 : top + 18} textAnchor="middle" fill={colour} style={{ font: DISPLAY, fontSize: 12, fontWeight: 700 }}>
        {label}
      </text>
    </g>
  )

  const ray = (pts: [number, number][], dashed: boolean, key: string) => (
    <polyline
      key={key}
      points={pts.map(([x, y]) => `${x},${y}`).join(' ')}
      fill="none"
      stroke={dashed ? INK_2 : '#d25b3b'}
      strokeWidth={1.5}
      strokeDasharray={dashed ? '5 4' : undefined}
    />
  )

  const objX = sx(-u), objTop = sy(h)
  const imgX = sx(v), imgTop = sy(imageHeight)
  const lensTop = axisY - 86, lensBottom = axisY + 86

  // Ray 1: parallel to the axis, then through the principal focus on the far side (convex)
  // or away from the focus on the near side (concave). Ray 2: straight through the centre.
  const fFar = sx(Math.abs(f)), fNear = sx(-Math.abs(f))
  const rays: preactish[] = []
  type preactish = ReturnType<typeof ray>
  if (concave) {
    // Refracts as though it came from the near focus, so the emerging ray diverges.
    const slope = (axisY - sy(h)) / (fNear - lensX)
    const endX = W - 14
    rays.push(ray([[objX, objTop], [lensX, objTop], [endX, objTop + slope * (endX - lensX)]], false, 'r1'))
    rays.push(ray([[lensX, objTop], [fNear, axisY]], true, 'r1b'))
  } else {
    rays.push(ray([[objX, objTop], [lensX, objTop], [sx(Math.max(v, Math.abs(f) * 2.2)), sy(imageHeight)]], false, 'r1'))
  }
  const centreSlope = (axisY - objTop) / (lensX - objX)
  const farX = real ? imgX : W - 14
  rays.push(ray([[objX, objTop], [lensX, axisY], [farX, axisY + centreSlope * (farX - lensX)]], false, 'r2'))
  if (!real) {
    // A virtual image is where the emerging rays appear to come from, so those extensions
    // are drawn dashed back to it.
    rays.push(ray([[lensX, axisY], [imgX, imgTop]], true, 'r2b'))
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: `${W}px` }} role="img" aria-label={alt}>
      <line x1={10} y1={axisY} x2={W - 10} y2={axisY} stroke={RULE} strokeWidth={1.2} />
      {/* The lens: a double arrow, pointing outwards for convex and inwards for concave. */}
      <line x1={lensX} y1={lensTop} x2={lensX} y2={lensBottom} stroke={ACCENT} strokeWidth={2.4} />
      {[lensTop, lensBottom].map((y, i) => {
        // The tip points away from the centre of the lens for convex and towards it for
        // concave. The first version combined an offset with a rotate and cancelled
        // itself out, so both heads ended up pointing the same way and the symbol read as
        // a single arrow rather than a lens.
        const top = i === 0
        const pointsUp = concave ? !top : top
        const tipY = y + (pointsUp ? -9 : 9)
        const baseY = y + (pointsUp ? 4 : -4)
        return <polygon key={i} points={`${lensX},${tipY} ${lensX - 7},${baseY} ${lensX + 7},${baseY}`} fill={ACCENT} />
      })}
      {rays}
      {[fFar, fNear].map((x, i) => (
        <g key={`f${i}`}>
          <circle cx={x} cy={axisY} r={3} fill={INK} />
          <text x={x} y={axisY + 18} textAnchor="middle" fill={INK} style={{ font: DISPLAY, fontSize: 12, fontWeight: 700 }}>F</text>
        </g>
      ))}
      {arrow(objX, objTop, INK, 'object', 'obj')}
      {arrow(imgX, imgTop, '#2e8b57', 'image', 'img')}
      <text x={W / 2} y={16} textAnchor="middle" fill={INK_2} style={{ font: FONT }}>
        {concave ? 'Concave lens' : 'Convex lens'}: the image is {real ? 'real and inverted' : 'virtual and upright'}
      </text>
      <text x={W / 2} y={H - 8} textAnchor="middle" fill={INK_2} style={{ font: FONT }}>
        {note ?? `magnification = ${Number(magnification.toFixed(2))}, so the image is ${magnification > 1 ? 'larger' : 'smaller'} than the object`}
      </text>
    </svg>
  )
}
