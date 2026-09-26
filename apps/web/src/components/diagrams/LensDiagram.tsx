import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

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

  // 280 rather than 460: at 460 this scrolled up to 246px on a phone. `sx` below scales
  // every ray and marker off W, so narrowing it keeps the same construction; only the
  // title and the caption, which are long sentences rather than short labels, need to
  // wrap onto more than one line to still fit.
  const W = 280, H = 300
  const axisY = H / 2 - 10
  const lensX = W / 2
  // Scale so the object, both foci and the image all fit.
  const span = Math.max(u, Math.abs(v), Math.abs(f) * 2) * 1.25
  const sx = (d: number) => lensX + (d / span) * (W / 2 - 24)
  const maxH = Math.max(h, Math.abs(imageHeight))
  const sy = (y: number) => axisY - (y / maxH) * 70

  /**
   * A short arrow gets its label beside it rather than under it. A distant object, which
   * is what a camera and a burning glass both look at, gives a tiny image at the focus,
   * and a label under a tiny arrow printed straight across the F mark beneath the axis.
   */
  const arrow = (x: number, top: number, colour: string, label: string, key: string, under = false) => {
    const short = Math.abs(top - axisY) < 30
    // Never across the lens: at phone width a distant object's image sits a few units
    // from it, and the lens line ran through the middle of the word "image".
    const half = label.length * 12 * 0.3 + 4
    const lx = Math.abs(x - lensX) < half ? (x >= lensX ? lensX + half : lensX - half) : x
    // Under the arrow as usual, but never in the band the F labels occupy just below
    // the axis, and never in the band just above it where a short upright arrow sits.
    const ly = under ? axisY + 34 : short ? (top < axisY ? Math.min(top - 8, axisY - 24) : Math.max(top + 18, axisY + 34)) : top < axisY ? top - 8 : top + 18
    return (
      <g key={key}>
        <line x1={x} y1={axisY} x2={x} y2={top} stroke={colour} strokeWidth={2.4} />
        <polygon
          points={`${x},${top} ${x - 5},${top + (top < axisY ? 9 : -9)} ${x + 5},${top + (top < axisY ? 9 : -9)}`}
          fill={colour}
        />
        <text x={lx} y={ly} textAnchor="middle" fill={colour} style={{ font: DISPLAY, fontSize: 12, fontWeight: 700 }}>
          {label}
        </text>
      </g>
    )
  }

  /**
   * A ray is cut where it would leave the drawing: under the title, above the caption. A
   * concave lens's emerging ray climbs steeply, and at phone width it ran up through the
   * title's words.
   */
  const rayTop = 40, rayBottom = axisY + 96
  const clip = (pts: [number, number][]): [number, number][] => {
    const out: [number, number][] = [pts[0]!]
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1]!, [x1, y1] = pts[i]!
      const limit = y1 < rayTop ? rayTop : y1 > rayBottom ? rayBottom : undefined
      if (limit === undefined) { out.push([x1, y1]); continue }
      const t = (limit - y0) / (y1 - y0)
      out.push([x0 + t * (x1 - x0), limit])
      break
    }
    return out
  }
  const ray = (pts: [number, number][], dashed: boolean, key: string) => (
    <polyline
      key={key}
      points={clip(pts).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
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

  // These are sentences, not short labels, and at 460 units wide they simply ran off the
  // edge; unlike a label there is nowhere to move them, so they wrap instead. The title
  // splits after the colon, and the computed caption after "the image is", so "real and
  // inverted" and "larger/smaller than the object" — the phrases the physics tests read
  // off the markup — always land whole inside one line rather than being cut across two.
  // A fixed fontSize also replaces the old bare `font` shorthand, so how much room a line
  // needs is knowable rather than left to the browser's default size.
  const titleLines = [
    `${concave ? 'Concave lens' : 'Convex lens'}:`,
    `the image is ${real ? 'real and inverted' : 'virtual and upright'}`,
  ]
  const captionLines = note
    ? wrapWords(note, 11, W - 24)
    : [`magnification = ${Number(magnification.toFixed(2))}, so the image is`, `${magnification > 1 ? 'larger' : 'smaller'} than the object`]

  return (
    // 460 keeps the desktop size the diagram had at its old 460-unit width; only the
    // phone-facing viewBox got narrower.
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 460 }} role="img" aria-label={alt}>
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
      {[fFar, fNear].map((x, i) => {
        // An image that lands on a focus has its arrow and its label where the F label
        // goes, and the ray through the centre grazes that band too, so the F label steps
        // above the axis on the side away from the lens. Towards the lens it sat against
        // the lens line once the drawing narrowed to fit a phone; away from it is clear,
        // because the refracted ray crosses the axis at F and runs below it beyond.
        const covered = Math.abs(imgX - x) < 12
        const away = x >= lensX ? 1 : -1
        return (
          <g key={`f${i}`}>
            <circle cx={x} cy={axisY} r={3} fill={INK} />
            <text x={covered ? x + away * 6 : x} y={covered ? axisY - 8 : axisY + 18} textAnchor={covered ? (away > 0 ? 'start' : 'end') : 'middle'} fill={INK} style={{ font: DISPLAY, fontSize: 12, fontWeight: 700 }}>F</text>
          </g>
        )
      })}
      {/* A virtual image's dashed construction line runs from the lens centre through the
          object's tip to the image, so above the tip the word "object" sat on it. */}
      {arrow(objX, objTop, INK, 'object', 'obj', !real)}
      {/* A concave lens's image sits between F and the lens, where its dashed ray runs. */}
      {arrow(imgX, imgTop, '#2e8b57', 'image', 'img', concave)}
      {titleLines.map((line, i) => (
        <text key={`title${i}`} x={W / 2} y={16 + i * 14} textAnchor="middle" fill={INK_2} fontFamily={FONT} fontSize={12}>{line}</text>
      ))}
      {captionLines.map((line, i) => (
        <text
          key={`caption${i}`} x={W / 2}
          y={H - 8 - (captionLines.length - 1 - i) * 14}
          textAnchor="middle" fill={INK_2} fontFamily={FONT} fontSize={11}
        >
          {line}
        </text>
      ))}
    </svg>
  )
}
