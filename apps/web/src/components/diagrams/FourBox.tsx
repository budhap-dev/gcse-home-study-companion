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
 */
export function FourBox({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const centre = String(props.centre ?? '')
  const boxes = ((props.boxes as Box[] | undefined) ?? []).slice(0, 4)
  const bw = 186
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
  const centreLines = centre ? wrapCell(centre, 16) : []
  const textW = Math.max(0, ...centreLines.map((l) => l.length * CHAR_WIDTH))
  const textH = centreLines.length * CENTRE_LINE
  // A circle contains a block of text when its radius clears the block's half-diagonal.
  const r = Math.max(44, Math.ceil(Math.hypot(textW / 2, textH / 2)) + 6)
  const gap = Math.max(96, 2 * r + 8)
  // Two columns of boxes, the gap between them, and 6 of margin at each side.
  const W = 2 * bw + gap + 12
  const positions = [
    [W / 2 - bw - gap / 2, 14],
    [W / 2 + gap / 2, 14],
    [W / 2 - bw - gap / 2, H - bh - 14],
    [W / 2 + gap / 2, H - bh - 14],
  ]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 520 }} role="img" aria-label={alt}>
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
