import { useLayoutEffect, useRef, type RefObject } from 'react'
import { REFIT, useAvailableWidth } from '../fitSvgText.ts'
import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'
import { CHAR_WIDTH, LINE_HEIGHT, wrapCell } from './tableLayout.ts'

/** Line spacing for the centre label, which is set at 13px. */
const CENTRE_LINE = 16
/** Line spacing for a box title, which is set at 15px bold. */
const TITLE_LINE = 18
/**
 * Characters per line for a 15px bold display title inside a box. Measured in a browser
 * rather than guessed: the pack's widest title drew at 7.8px a character.
 */
const TITLE_CHAR = 7.8

interface Box {
  title: string
  /** Up to three short points shown under the title. */
  points?: string[]
  /** A sentence or two under the title, wrapped to the width of the box. */
  body?: string
}

/**
 * Four labelled boxes around a centre label: the marketing mix's four Ps, the four
 * parts of a business plan, a SWOT grid. The point is that the four belong together
 * and pull on one thing in the middle. Props: { centre: string, boxes: Box[] (four) }.
 *
 * A box carries either `points`, a few short phrases bulleted under the title, or
 * `body`, a sentence or two wrapped to the box. Fourteen diagrams across Chemistry and
 * Music were written with `body` while the component read only `points`, so they drew
 * four titles over empty space and every test passed: the prop had the wrong name and
 * nothing was looking for that. The box grows to fit whichever it is given.
 *
 * The two-by-two grid is about 480 units wide, and a diagram stops shrinking at its
 * natural width, so on a phone every four-box scrolled sideways by 180 to 230 pixels and
 * the right-hand pair of boxes sat out of sight. Where the box it is drawn in is
 * narrower than the grid, the four stack in one column under the centre label instead,
 * drawn at exactly the width available.
 */
export function FourBox({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const centre = String(props.centre ?? '')
  const boxes = ((props.boxes as Box[] | undefined) ?? []).slice(0, 4)
  const svg = useRef<SVGSVGElement>(null)
  const available = useAvailableWidth(svg)
  const stacked = available !== undefined && available < gridWidth(centre)
  // The figure fitted the drawing at its first size; a new layout needs a new fit.
  useLayoutEffect(() => {
    svg.current?.dispatchEvent(new Event(REFIT, { bubbles: true }))
  }, [stacked, available])
  return stacked
    ? <FourBoxStack centre={centre} boxes={boxes} width={available!} alt={alt} svgRef={svg} />
    : <FourBoxGrid centre={centre} boxes={boxes} alt={alt} svgRef={svg} />
}

/** The centre label wrapped, and the circle that holds it. */
function centreCircle(centre: string) {
  const lines = centre ? wrapCell(centre, 16) : []
  const textW = Math.max(0, ...lines.map((l) => l.length * CHAR_WIDTH))
  const textH = lines.length * CENTRE_LINE
  // A circle contains a block of text when its radius clears the block's half-diagonal.
  const r = Math.max(44, Math.ceil(Math.hypot(textW / 2, textH / 2)) + 6)
  return { lines, textH, r }
}

const GRID_BOX = 186

/** Two columns of boxes, the gap the circle needs between them, and 6 of margin each side. */
function gridWidth(centre: string): number {
  return 2 * GRID_BOX + Math.max(96, 2 * centreCircle(centre).r + 8) + 12
}

interface LayoutProps {
  centre: string
  boxes: Box[]
  alt: string
  svgRef: RefObject<SVGSVGElement | null>
}

function FourBoxGrid({ centre, boxes, alt, svgRef }: LayoutProps) {
  const bw = GRID_BOX
  const padX = 14
  const budget = Math.max(8, Math.floor((bw - 2 * padX) / CHAR_WIDTH))
  const bodies = boxes.map((b) => (b.body ? wrapCell(b.body, budget) : []))
  /**
   * Titles wrap too. Seventy-four of the pack's 675 four-box titles were wider than the
   * box they sat in and simply ran off the side, which the browser draws without
   * complaint and no test could see.
   */
  const titleBudget = Math.max(6, Math.floor((bw - 2 * padX) / TITLE_CHAR))
  const titles = boxes.map((b) => wrapCell(b.title ?? '', titleBudget))
  /** The baseline of the last title line, relative to the top of the box. */
  const titleBottom = (i: number) => 24 + (titles[i]!.length - 1) * TITLE_LINE
  const needed = boxes.map((b, i) =>
    titleBottom(i) + (bodies[i]!.length ? 20 + bodies[i]!.length * LINE_HEIGHT : 24 + Math.min(3, b.points?.length ?? 0) * 20) + 12,
  )
  const bh = Math.max(118, ...needed)
  // Two rows of boxes, 14 of margin above and below, and 36 of gap between them.
  const H = 2 * bh + 64
  /**
   * The centre label used to be split into exactly two lines by halving its words, and
   * the circle was a fixed 44 radius whatever it had to hold. Anything past about two
   * dozen characters ran straight out of the circle and across the boxes behind it, in
   * most of the 169 four-box diagrams in the pack. Wrap it properly and grow the circle
   * to fit; a label short enough for the old circle still gets exactly the old geometry.
   */
  const { lines: centreLines, textH, r } = centreCircle(centre)
  const gap = Math.max(96, 2 * r + 8)
  // Two columns of boxes, the gap between them, and 6 of margin at each side.
  const W = gridWidth(centre)
  const positions = [
    [W / 2 - bw - gap / 2, 14],
    [W / 2 + gap / 2, 14],
    [W / 2 - bw - gap / 2, H - bh - 14],
    [W / 2 + gap / 2, H - bh - 14],
  ]
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 520 }} role="img" aria-label={alt}>
      {boxes.map((b, i) => {
        const [x, y] = positions[i]!
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={bh} rx="10" fill="var(--subject-soft)" stroke={RULE} />
            {titles[i]!.map((line, j) => (
              <text key={`t${j}`} x={x + padX} y={y + 24 + j * TITLE_LINE} fontFamily={DISPLAY} fontSize="15" fontWeight="700" fill={ACCENT}>{line}</text>
            ))}
            {(b.points ?? []).slice(0, 3).map((p, j) => (
              <text key={j} x={x + padX} y={y + titleBottom(i) + 24 + j * 20} fontFamily={FONT} fontSize="12" fill={INK_2}>• {p}</text>
            ))}
            {bodies[i]!.map((line, j) => (
              <text key={`b${j}`} x={x + padX} y={y + titleBottom(i) + 20 + j * LINE_HEIGHT} fontFamily={FONT} fontSize="12" fill={INK_2}>{line}</text>
            ))}
          </g>
        )
      })}
      {centre && (
        <g>
          <circle cx={W / 2} cy={H / 2} r={r} fill="#fff" stroke={ACCENT} strokeWidth="2.5" />
          {centreLines.map((l, i) => (
            <text
              key={i}
              x={W / 2}
              y={H / 2 - textH / 2 + 5 + (i + 0.5) * CENTRE_LINE}
              textAnchor="middle"
              fontFamily={DISPLAY}
              fontSize="13"
              fontWeight="700"
              fill={INK}
            >
              {l}
            </text>
          ))}
        </g>
      )}
    </svg>
  )
}

/**
 * The same four boxes in one column, for a box narrower than the grid. The centre label
 * becomes a band across the top, since the four still belong to it, and each box takes
 * the full width, so its text wraps to that width rather than the grid's.
 */
export function FourBoxStack({ centre, boxes, width, alt, svgRef }: LayoutProps & { width: number }) {
  const W = Math.max(200, Math.floor(width))
  const padX = 14
  const bw = W - 2
  const budget = Math.max(8, Math.floor((bw - 2 * padX) / CHAR_WIDTH))
  const titleBudget = Math.max(6, Math.floor((bw - 2 * padX) / TITLE_CHAR))
  const centreLines = centre ? wrapCell(centre, Math.max(8, Math.floor((W - 24) / (CHAR_WIDTH + 0.6)))) : []
  const bandH = centreLines.length ? centreLines.length * CENTRE_LINE + 16 : 0
  const layout = boxes.map((b) => {
    const titles = wrapCell(b.title ?? '', titleBudget)
    const bodies = b.body ? wrapCell(b.body, budget) : []
    const points = (b.points ?? []).slice(0, 3).map((p) => wrapCell(`• ${p}`, budget))
    const titleBottom = 24 + (titles.length - 1) * TITLE_LINE
    const pointLines = points.reduce((n, p) => n + p.length, 0)
    // The last line's baseline, then enough below it to balance the space above the title.
    const lines = bodies.length || pointLines
    const h = titleBottom + (lines ? 20 + (lines - 1) * LINE_HEIGHT : 0) + 16
    return { titles, bodies, points, titleBottom, h }
  })
  const GAP = 8
  const tops: number[] = []
  layout.reduce((y, l) => { tops.push(y); return y + l.h + GAP }, bandH ? bandH + GAP : 1)
  const H = (tops.length ? tops[tops.length - 1]! + layout[layout.length - 1]!.h : bandH) + 1
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W }} role="img" aria-label={alt}>
      {bandH > 0 && (
        <g>
          <rect x={1} y={1} width={W - 2} height={bandH - 2} rx="10" fill="#fff" stroke={ACCENT} strokeWidth="2.5" />
          {centreLines.map((l, i) => (
            <text key={i} x={W / 2} y={1 + 8 + (i + 1) * CENTRE_LINE - 3} textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>{l}</text>
          ))}
        </g>
      )}
      {layout.map((l, i) => {
        const y = tops[i]!
        let line = 0
        return (
          <g key={i}>
            <rect x={1} y={y} width={bw} height={l.h} rx="10" fill="var(--subject-soft)" stroke={RULE} />
            {l.titles.map((t, j) => (
              <text key={`t${j}`} x={1 + padX} y={y + 24 + j * TITLE_LINE} fontFamily={DISPLAY} fontSize="15" fontWeight="700" fill={ACCENT}>{t}</text>
            ))}
            {l.points.flat().map((p, j) => (
              <text key={`p${j}`} x={1 + padX} y={y + l.titleBottom + 20 + (line++) * LINE_HEIGHT} fontFamily={FONT} fontSize="12" fill={INK_2}>{p}</text>
            ))}
            {l.bodies.map((b, j) => (
              <text key={`b${j}`} x={1 + padX} y={y + l.titleBottom + 20 + j * LINE_HEIGHT} fontFamily={FONT} fontSize="12" fill={INK_2}>{b}</text>
            ))}
          </g>
        )
      })}
    </svg>
  )
}
