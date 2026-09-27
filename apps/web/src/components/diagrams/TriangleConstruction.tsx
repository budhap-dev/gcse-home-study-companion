import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'
import { around, baseline, labelHalf, placeLabel, type Seg } from './labelPlace.ts'

/**
 * A triangle construction with its compass arcs and protractor marks left in,
 * the way an examiner wants to see it. Props:
 *   kind: 'sss' | 'sas' | 'asa' | 'ssa'
 *   sides: [AB, AC, BC] in cm as needed by the kind; angles: { A, B } in degrees as needed
 *   stage: 1 draws the base, 2 adds the arcs or rays, 3 (default) completes the triangle
 *   labels: { A, B, C } vertex names
 */
export function TriangleConstruction({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const kind = String(props.kind ?? 'sss') as 'sss' | 'sas' | 'asa' | 'ssa'
  const stage = Number(props.stage ?? 3)
  const sides = (props.sides as number[] | undefined) ?? [7, 5, 6]
  const angles = (props.angles as { A?: number; B?: number } | undefined) ?? {}
  const names = (props.labels as { A?: string; B?: string; C?: string } | undefined) ?? {}
  const [AB, AC, BC] = [sides[0] ?? 7, sides[1] ?? 5, sides[2] ?? 6]
  const rad = (d: number) => (d * Math.PI) / 180

  // vertices in cm, A at the origin, B on the x axis
  const A = { x: 0, y: 0 }
  const B = { x: AB, y: 0 }
  let C = { x: 0, y: 0 }
  let C2: { x: number; y: number } | null = null
  if (kind === 'sss') {
    const x = (AC * AC - BC * BC + AB * AB) / (2 * AB)
    C = { x, y: Math.sqrt(Math.max(0, AC * AC - x * x)) }
  } else if (kind === 'sas') {
    const a = rad(angles.A ?? 50)
    C = { x: AC * Math.cos(a), y: AC * Math.sin(a) }
  } else if (kind === 'asa') {
    const a = rad(angles.A ?? 50)
    const b = rad(angles.B ?? 60)
    // intersection of rays from A and B
    const t = (AB * Math.sin(b)) / Math.sin(Math.PI - a - b)
    C = { x: t * Math.cos(a), y: t * Math.sin(a) }
  } else {
    // ssa: angle at A, side AB, side BC. Two possible C on the ray from A.
    const a = rad(angles.A ?? 40)
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    // solve |A + t d - B| = BC
    const bq = -2 * (dx * AB)
    const cq = AB * AB - BC * BC
    const disc = bq * bq - 4 * cq
    const t1 = (-bq + Math.sqrt(Math.max(0, disc))) / 2
    const t2 = (-bq - Math.sqrt(Math.max(0, disc))) / 2
    C = { x: t1 * dx, y: t1 * dy }
    if (t2 > 0.2 && Math.abs(t2 - t1) > 0.2) C2 = { x: t2 * dx, y: t2 * dy }
  }

  // 23px per cm (down from 34): the widest construction in the pack (10, 13, 13) drew at
  // 421 units and scrolled on a phone. The vertex and arc labels are placed in fixed
  // pixels off each point rather than scaled cm, so they keep the same clearance at any S.
  const S = 23 // px per cm
  const minX = Math.min(A.x, B.x, C.x, C2?.x ?? 0) - 1.2
  const maxX = Math.max(A.x, B.x, C.x, C2?.x ?? 0) + 1.2
  const maxY = Math.max(C.y, C2?.y ?? 0) + 1.2
  const W = (maxX - minX) * S
  const H = (maxY + 1.0) * S
  const px = (p: { x: number; y: number }) => ({ x: (p.x - minX) * S, y: (maxY - p.y) * S })
  const a = px(A), b = px(B), c = px(C)
  const arcPath = (centre: { x: number; y: number }, r: number, fromDeg: number, toDeg: number) => {
    const p1 = px({ x: centre.x + r * Math.cos(rad(fromDeg)), y: centre.y + r * Math.sin(rad(fromDeg)) })
    const p2 = px({ x: centre.x + r * Math.cos(rad(toDeg)), y: centre.y + r * Math.sin(rad(toDeg)) })
    const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0
    return `M${p1.x.toFixed(1)} ${p1.y.toFixed(1)} A${r * S} ${r * S} 0 ${large} 0 ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  const showArcs = stage >= 2
  const showTri = stage >= 3
  const deg = (p: { x: number; y: number }) => (Math.atan2(p.y, p.x) * 180) / Math.PI
  const cRay = px({ x: 1.25 * C.x, y: 1.25 * C.y })
  const bRay = px({ x: AB + 1.25 * (C.x - AB), y: 1.25 * C.y })
  const angleAt = (v: { x: number; y: number }, other1: { x: number; y: number }, other2: { x: number; y: number }) => {
    const d1 = Math.atan2(other1.y - v.y, other1.x - v.x)
    const d2 = Math.atan2(other2.y - v.y, other2.x - v.x)
    return [(d1 * 180) / Math.PI, (d2 * 180) / Math.PI]
  }

  // The construction arcs, as [centre, radius, from, to] in cm and degrees: drawn below, and
  // listed here too so that the labels can keep off them.
  const arcs: [{ x: number; y: number }, number, number, number][] = []
  if (showArcs && kind === 'sss') {
    arcs.push([A, AC, Math.max(5, deg(C) - 22), deg(C) + 22])
    arcs.push([B, BC, deg({ x: C.x - AB, y: C.y }) - 22, Math.min(175, deg({ x: C.x - AB, y: C.y }) + 22)])
  }
  if (showArcs && kind === 'sas') arcs.push([A, AC, deg(C) - 15, deg(C) + 15])
  if (showArcs && kind === 'ssa') arcs.push([B, BC, 20, 160])
  const angleMarks: { v: { x: number; y: number }; o1: { x: number; y: number }; o2: { x: number; y: number }; text: string }[] = []
  if (showArcs && (kind === 'sas' || kind === 'asa' || kind === 'ssa')) angleMarks.push({ v: A, o1: B, o2: C, text: `${angles.A ?? (kind === 'ssa' ? 40 : 50)}°` })
  if (showArcs && kind === 'asa') angleMarks.push({ v: B, o1: C, o2: A, text: `${angles.B ?? 60}°` })
  for (const m of angleMarks) {
    const [d1, d2] = angleAt(m.v, m.o1, m.o2)
    arcs.push([m.v, 0.7, Math.min(d1!, d2!), Math.max(d1!, d2!)])
  }

  /*
   * Everything drawn, as segments in px, for the labels to keep clear of. Each label was a
   * fixed offset off its point, and the walk found lines through C and C′ (the arcs cross
   * at C in an X, and the rays run on past it), through "5 cm" beside a steep side, and
   * through angle text whose arc ran across its first digit.
   */
  const segs: Seg[] = [[a, b]]
  for (const [centre, r, from, to] of arcs) {
    for (let i = 0; i < 12; i++) {
      const t1 = rad(from + ((to - from) * i) / 12), t2 = rad(from + ((to - from) * (i + 1)) / 12)
      segs.push([px({ x: centre.x + r * Math.cos(t1), y: centre.y + r * Math.sin(t1) }), px({ x: centre.x + r * Math.cos(t2), y: centre.y + r * Math.sin(t2) })])
    }
  }
  if (showArcs && (kind === 'sas' || kind === 'asa' || kind === 'ssa')) segs.push([a, cRay])
  if (showArcs && kind === 'asa') segs.push([b, bRay])
  if (showTri) segs.push([a, c], [b, c])
  if (showTri && C2) segs.push([b, px(C2)])
  // Each label placed joins the list, so the next one keeps off it too.
  const claim = (centre: { x: number; y: number }, halfW: number, halfH: number) => {
    const l = centre.x - halfW, r = centre.x + halfW, t = centre.y - halfH, btm = centre.y + halfH
    segs.push([{ x: l, y: t }, { x: r, y: t }], [{ x: r, y: t }, { x: r, y: btm }], [{ x: r, y: btm }, { x: l, y: btm }], [{ x: l, y: btm }, { x: l, y: t }])
  }
  const centroid = px({ x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 })
  const place = (at: { x: number; y: number }, text: string, size: number, bold: boolean, directions: number[], near = 4, far = 40) => {
    const { halfW, halfH } = labelHalf(text, size, bold)
    const centre = placeLabel(at, halfW, halfH, segs, directions, near, far)
    claim(centre, halfW, halfH)
    return { x: centre.x, y: baseline(centre.y, size) }
  }
  // A and B keep their corners below the base; they are placed first so nothing lands on them.
  const aAt = { x: a.x - 14, y: a.y + 16 }, bAt = { x: b.x + 6, y: b.y + 16 }
  claim({ x: aAt.x + 5, y: aAt.y - 5 }, 6, 7)
  claim({ x: bAt.x + 5, y: bAt.y - 5 }, 6, 7)
  const away = (p: { x: number; y: number }) => Math.atan2(p.y - centroid.y, p.x - centroid.x)
  const cName = names.C ?? 'C'
  const cAt = showTri ? place(c, cName, 14, true, around(away(c)), 3) : undefined
  const c2At = showTri && C2 ? place(px(C2), 'C′', 14, true, around(away(px(C2))), 3) : undefined
  const angleAts = angleMarks.map((m) => {
    const [d1, d2] = angleAt(m.v, m.o1, m.o2)
    // Screen y points down, so the bisector's angle changes sign on the way to px.
    const bisector = -rad((d1! + d2!) / 2)
    const inside = place(px(m.v), m.text, 12, false, [bisector], 17, 80)
    return { ...inside, text: m.text }
  })
  // `opp` is the vertex across from the side: outward is away from it. (Away from C put the
  // labels of AC and BC anywhere, since C is on both of them.) The base's goes on C's side.
  const sideAt = (p: { x: number; y: number }, q: { x: number; y: number }, opp: { x: number; y: number }, text: string, outward: boolean) => {
    const pp = px(p), qq = px(q), o = px(opp)
    const m = { x: (pp.x + qq.x) / 2, y: (pp.y + qq.y) / 2 }
    let n = Math.atan2(qq.x - pp.x, -(qq.y - pp.y))
    const facesOpp = Math.cos(n) * (o.x - m.x) + Math.sin(n) * (o.y - m.y) > 0
    if (facesOpp === outward) n += Math.PI
    return { ...place(m, text, 12, false, around(n, 10, 40), 3), text }
  }
  const baseLabel = sideAt(A, B, C, `${AB} cm`, false)
  const acLabel = showTri && (kind === 'sss' || kind === 'sas') ? sideAt(A, C, B, `${AC} cm`, true) : undefined
  const bcLabel = showTri && (kind === 'sss' || kind === 'ssa') ? sideAt(B, C, A, `${BC} cm`, true) : undefined
  const sideText = (l: { x: number; y: number; text: string } | undefined) => l && <text x={l.x} y={l.y} textAnchor="middle" fontFamily={FONT} fontSize="12" fill={INK_2}>{l.text}</text>
  const dot = (p: { x: number; y: number }) => { const q = px(p); return <circle cx={q.x} cy={q.y} r="3" fill={INK} /> }
  const name = (at: { x: number; y: number }, text: string, anchor: 'start' | 'middle' = 'middle', fill = INK) => <text x={at.x} y={at.y} textAnchor={anchor} fontFamily={DISPLAY} fontSize="14" fontWeight="700" fill={fill}>{text}</text>


  const constructionArcs = arcs.slice(0, arcs.length - angleMarks.length)
  const angleArcs = arcs.slice(arcs.length - angleMarks.length)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: Math.min(520, W * 1.2) }} role="img" aria-label={alt}>
      {/* base */}
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={INK} strokeWidth="2" />
      {/* construction marks */}
      {constructionArcs.map(([centre, r, from, to], i) => (
        <path key={`c${i}`} d={arcPath(centre, r, from, to)} fill="none" stroke={ACCENT} strokeWidth="1.5" strokeDasharray="4 3" />
      ))}
      {showArcs && (kind === 'sas' || kind === 'asa' || kind === 'ssa') && (
        <line x1={a.x} y1={a.y} x2={cRay.x} y2={cRay.y} stroke={ACCENT} strokeWidth="1.2" strokeDasharray="4 3" />
      )}
      {showArcs && kind === 'asa' && (
        <line x1={b.x} y1={b.y} x2={bRay.x} y2={bRay.y} stroke={ACCENT} strokeWidth="1.2" strokeDasharray="4 3" />
      )}
      {angleArcs.map(([centre, r, from, to], i) => (
        <path key={`a${i}`} d={arcPath(centre, r, from, to)} fill="none" stroke="#d25b3b" strokeWidth="1.5" />
      ))}
      {/* triangle */}
      {showTri && (
        <g>
          <line x1={a.x} y1={a.y} x2={c.x} y2={c.y} stroke={INK} strokeWidth="2" />
          <line x1={b.x} y1={b.y} x2={c.x} y2={c.y} stroke={INK} strokeWidth="2" />
          {dot(C)}
        </g>
      )}
      {showTri && C2 && (
        <g opacity="0.6">
          <line x1={b.x} y1={b.y} x2={px(C2).x} y2={px(C2).y} stroke="#d25b3b" strokeWidth="2" strokeDasharray="5 4" />
          <circle cx={px(C2).x} cy={px(C2).y} r="3" fill="#d25b3b" />
        </g>
      )}
      {dot(A)}
      {dot(B)}
      {/* Labels last, each in a place that keeps off everything above. */}
      {sideText(baseLabel)}
      {sideText(acLabel)}
      {sideText(bcLabel)}
      {angleAts.map((l, i) => <text key={`t${i}`} x={l.x} y={l.y} textAnchor="middle" fontFamily={FONT} fontSize="12" fill="#d25b3b">{l.text}</text>)}
      {cAt && name(cAt, cName)}
      {c2At && <g opacity="0.6">{name(c2At, 'C′', 'middle', '#d25b3b')}</g>}
      {name(aAt, names.A ?? 'A', 'start')}
      {name(bAt, names.B ?? 'B', 'start')}
      <line x1="0" y1={H - 0.5} x2={W} y2={H - 0.5} stroke={RULE} />
    </svg>
  )
}
