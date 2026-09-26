import { ACCENT, DISPLAY, FONT, INK, INK_2 } from './index.tsx'

interface Charge {
  /** +1 or -1; the sign decides which way every arrow in the picture points. */
  sign: 1 | -1
  label?: string
}

/**
 * The electric field around a charged sphere, which AQA 4.2.5.2 asks students to draw,
 * and the force between two charges.
 *
 * Nothing about direction is given by the content: field lines point away from a
 * positive charge and towards a negative one, and the force arrows on a pair point
 * together or apart according to whether the signs match. So the picture cannot show
 * like charges attracting, which is the thing the lesson beside it is claiming.
 *
 * Props: charges [{sign, label}] (one for a field pattern, two for a force pair),
 * lines (how many field lines, default 12), note.
 */
export function ElectricField({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const charges = (props.charges as Charge[] | undefined) ?? [{ sign: 1 }]
  const count = typeof props.lines === 'number' ? props.lines : 12
  const note = typeof props.note === 'string' ? props.note : undefined
  /*
   * 290 units wide, inside the 296 a phone's card allows. At 400, with the caption drawn
   * on one line, this scrolled up to 260px on a phone: the default caption alone ("The
   * lines are closest together near the sphere, where the field is strongest", 78
   * characters) needed about 560 units by itself. Every caption and label now wraps, and
   * the height grows to fit however many lines that takes — only the width is limited.
   */
  const W = 290
  const R = 24
  /** Every caption and label uses this so the same word-wrap runs everywhere. */
  const wrap = (text: string, perLine: number): string[] => {
    const lines: string[] = []
    let line = ''
    for (const word of text.split(' ')) {
      if (line && (line + ' ' + word).length > perLine) {
        lines.push(line)
        line = word
      } else line = line ? line + ' ' + word : word
    }
    if (line) lines.push(line)
    return lines
  }
  /** A caption's lines, centred, growing downward from y0. */
  const downFrom = (text: string, y0: number, budget: number) =>
    wrap(text, budget).map((line, i) => (
      <text key={i} x={W / 2} y={y0 + i * 14} textAnchor="middle" fill={INK_2} style={{ font: FONT, fontSize: 12 }}>
        {line}
      </text>
    ))
  /** A caption's lines, centred, with its last line fixed at yLast. */
  const upTo = (text: string, yLast: number, budget: number) => {
    const lines = wrap(text, budget)
    return lines.map((line, i) => (
      <text key={i} x={W / 2} y={yLast - (lines.length - 1 - i) * 14} textAnchor="middle" fill={INK_2} style={{ font: FONT, fontSize: 12 }}>
        {line}
      </text>
    ))
  }
  /** How many extra 14px rows a caption needs beyond its first line. */
  const extra = (text: string, budget: number) => Math.max(0, wrap(text, budget).length - 1)
  const CAPTION_BUDGET = 34

  const head = (x: number, y: number, angle: number, colour: string, key: string) => {
    const back = 9, wing = 5
    const bx = x - back * Math.cos(angle), by = y - back * Math.sin(angle)
    return (
      <polygon
        key={key}
        points={`${x},${y} ${bx - wing * Math.sin(angle)},${by + wing * Math.cos(angle)} ${bx + wing * Math.sin(angle)},${by - wing * Math.cos(angle)}`}
        fill={colour}
      />
    )
  }

  /**
   * Two spheres sit side by side, so a long label under one runs into the label under the
   * other. `budget` narrows further than a full-width caption so two labels never meet in
   * the middle, whatever the content says — "the cloth, having lost electrons" beside
   * "the rod, having gained them" overlapped before this.
   */
  const sphere = (cx: number, cy: number, sign: 1 | -1, label: string | undefined, key: string, budget: number) => (
    <g key={key}>
      <circle cx={cx} cy={cy} r={R} fill={sign > 0 ? '#f6e2dc' : '#dce6f3'} stroke={INK} strokeWidth={1.6} />
      <text x={cx} y={cy + 7} textAnchor="middle" fill={INK} style={{ font: DISPLAY, fontSize: 22, fontWeight: 700 }}>
        {sign > 0 ? '+' : '−'}
      </text>
      {label && (
        <text x={cx} y={cy + R + 22} textAnchor="middle" fill={INK_2} style={{ font: FONT, fontSize: 12 }}>
          {wrap(label, budget).map((line, i) => (
            <tspan key={i} x={cx} dy={i === 0 ? 0 : 14}>
              {line}
            </tspan>
          ))}
        </text>
      )}
    </g>
  )

  if (charges.length === 1) {
    const c = charges[0]!
    const cx = W / 2
    const reach = 110
    const topText = c.sign > 0 ? 'Field lines point away from a positive charge' : 'Field lines point towards a negative charge'
    const bottomText = note ?? 'The lines are closest together near the sphere, where the field is strongest'
    const topRows = extra(topText, CAPTION_BUDGET)
    const bottomRows = extra(bottomText, CAPTION_BUDGET)
    const topLast = 16 + topRows * 14
    const midY = topLast + 34 + reach
    const bottomFirst = midY + reach + 34
    const H = bottomFirst + bottomRows * 14 + 10
    const lines = Array.from({ length: count }, (_, i) => {
      const a = (i / count) * 2 * Math.PI
      const x1 = cx + R * Math.cos(a), y1 = midY + R * Math.sin(a)
      const x2 = cx + reach * Math.cos(a), y2 = midY + reach * Math.sin(a)
      // Outward from a positive charge, inward to a negative one: the arrow is at the
      // far end pointing out, or at the near end pointing in.
      const [hx, hy, angle] =
        c.sign > 0
          ? [cx + reach * 0.72 * Math.cos(a), midY + reach * 0.72 * Math.sin(a), a]
          : [cx + R * 1.35 * Math.cos(a), midY + R * 1.35 * Math.sin(a), a + Math.PI]
      return (
        <g key={i}>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={ACCENT} strokeWidth={1.4} />
          {head(hx, hy, angle, ACCENT, `h${i}`)}
        </g>
      )
    })
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: `${W}px` }} role="img" aria-label={alt}>
        {lines}
        {sphere(cx, midY, c.sign, c.label, 'c', CAPTION_BUDGET)}
        {downFrom(topText, 16, CAPTION_BUDGET)}
        {upTo(bottomText, H - 10, CAPTION_BUDGET)}
      </svg>
    )
  }

  // Two charges: the force arrows follow from whether the signs match.
  const [a, b] = charges as [Charge, Charge]
  const repel = a.sign === b.sign
  /*
   * Half the gap between the two sphere centres, and how far each arrow reaches from its
   * sphere (R + 8 to start, ARROW_LEN more to the tip). At the original 90 and 46 an
   * attracting pair's arrows barely fell short of the middle; shrunk to this width that
   * would overshoot the other sphere. Both are cut back together, so attracting arrows
   * still point together without crossing, and repelling ones still land inside the view.
   */
  const ARROW_LEN = 26
  const d = 60
  const LABEL_BUDGET = 12
  const leftX = W / 2 - d, rightX = W / 2 + d
  const topText = repel ? 'The same charge: they repel' : 'Different charges: they attract'
  const bottomText = note ?? 'A non-contact force: the closer they are, the stronger it is'
  const topRows = extra(topText, CAPTION_BUDGET)
  const maxLabelRows = Math.max(a.label ? wrap(a.label, LABEL_BUDGET).length : 1, b.label ? wrap(b.label, LABEL_BUDGET).length : 1) - 1
  const bottomRows = extra(bottomText, CAPTION_BUDGET)
  const topLast = 16 + topRows * 14
  const midY = topLast + 40
  const bottomFirst = midY + R + 22 + maxLabelRows * 14 + 30
  const H = bottomFirst + bottomRows * 14 + 10
  const arrow = (from: number, towards: number, key: string) => {
    const dir = Math.sign(towards - from)
    const start = from + dir * (R + 8)
    const end = start + dir * ARROW_LEN
    return (
      <g key={key}>
        <line x1={start} y1={midY} x2={end} y2={midY} stroke="#d25b3b" strokeWidth={2.4} />
        {head(end, midY, dir > 0 ? 0 : Math.PI, '#d25b3b', `${key}h`)}
      </g>
    )
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: `${W}px` }} role="img" aria-label={alt}>
      {downFrom(topText, 16, CAPTION_BUDGET)}
      {sphere(leftX, midY, a.sign, a.label, 'a', LABEL_BUDGET)}
      {sphere(rightX, midY, b.sign, b.label, 'b', LABEL_BUDGET)}
      {arrow(leftX, repel ? leftX - 100 : rightX, 'la')}
      {arrow(rightX, repel ? rightX + 100 : leftX, 'ra')}
      {upTo(bottomText, H - 10, CAPTION_BUDGET)}
    </svg>
  )
}
