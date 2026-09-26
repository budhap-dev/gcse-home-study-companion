import { useLayoutEffect, useRef, type RefObject } from 'react'
import { REFIT, useAvailableWidth } from '../fitSvgText.ts'
import { ACCENT, DISPLAY, FONT, INK, INK_2 } from './index.tsx'

interface Molecule {
  /** Carbons in the chain, drawn left to right. */
  carbons: number
  /** 1-based index of the carbon where a C=C starts, so 1 means between C1 and C2. */
  double?: number
  /** A functional group on the last carbon. */
  group?: 'oh' | 'cooh' | 'nh2'
  /** Draw square brackets and a subscript n: a polymer repeating unit. */
  repeat?: boolean
  /** Caption under the drawing, such as a name or a molecular formula. */
  label?: string
}

const BOND = 58, RISE = 34, FONT_PX = 15
const GAP = 46, BRACKET = 16, CHAR = 6.4, JOIN_CHAR = 7.6
/** The title and each molecule's caption are meant to match every other caption in the
 * pack: 11, the labelsize floor. Left unset, an SVG text falls back to the browser's
 * default size (about 16), well past what `CHAR` below budgets a column for. */
const CAPTION_SIZE = 11

/** Splits a caption at the space nearest its midpoint, for a title too wide to fit one
 * line at the fontSize-11 floor without shrinking it or running off the canvas. */
function splitCaption(text: string): [string, string] {
  const mid = text.length / 2
  let bestI = -1, bestD = Infinity
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ') {
      const d = Math.abs(i - mid)
      if (d < bestD) { bestD = d; bestI = i }
    }
  }
  return bestI === -1 ? [text, ''] : [text.slice(0, bestI), text.slice(bestI + 1)]
}

interface Atom { x: number; y: number; text: string }
interface Bond { x1: number; y1: number; x2: number; y2: number; double?: boolean }
interface Laid { atoms: Atom[]; bonds: Bond[]; minX: number; maxX: number; n: number }

/** Where each atom and bond of one molecule goes, with hydrogens filled in by valency. */
function layoutMolecule(m: Molecule): Laid {
  const n = Math.max(1, Math.round(m.carbons))
  const atoms: Atom[] = []
  const bonds: Bond[] = []
  const y = 0
  // A repeating unit continues at both ends, so its end carbons each spend a bond on
  // the chain rather than on a hydrogen.
  const openEnds = m.repeat === true
  for (let i = 0; i < n; i++) {
    const x = i * BOND
    atoms.push({ x, y, text: 'C' })
    let used = 0
    if (i > 0) used += m.double === i ? 2 : 1
    if (i < n - 1) used += m.double === i + 1 ? 2 : 1
    if (openEnds && (i === 0 || i === n - 1)) used += 1
    const last = i === n - 1
    const group = last ? m.group : undefined
    if (group === 'oh' || group === 'nh2') used += 1
    if (group === 'cooh') used += 3 // =O upwards and -O-H to the right
    const spare = 4 - used
    // A -COOH puts an oxygen above this carbon and another to its right, so those two
    // places are taken. Placing a hydrogen there anyway drew methanoic acid with its H
    // underneath the double-bonded O, which looked like a carbon with three bonds.
    const above: [number, number] = [x, y - RISE]
    const below: [number, number] = [x, y + RISE]
    const leftOut: [number, number] = [x - BOND * 0.72, y]
    const spots: [number, number][] = []
    if (group === 'cooh' && i === 0 && !openEnds) spots.push(leftOut)
    if (group !== 'cooh') spots.push(above)
    spots.push(below)
    if (i === 0 && !openEnds && !spots.includes(leftOut)) spots.push(leftOut)
    if (last && !openEnds && !group) spots.push([x + BOND * 0.72, y])
    for (let h = 0; h < spare && h < spots.length; h++) {
      const [hx, hy] = spots[h]!
      atoms.push({ x: hx, y: hy, text: 'H' })
      bonds.push({ x1: x, y1: y, x2: hx, y2: hy })
    }
    if (i < n - 1) bonds.push({ x1: x, y1: y, x2: x + BOND, y2: y, double: m.double === i + 1 })
  }
  const lastX = (n - 1) * BOND
  // A repeating unit continues in both directions, and the bond that shows it is a
  // marked point in the spec's own drawing instruction. The first version left the
  // end carbons a spare valency for it but never drew the line.
  if (openEnds) {
    bonds.push({ x1: 0, y1: y, x2: -BOND * 0.62, y2: y })
    bonds.push({ x1: lastX, y1: y, x2: lastX + BOND * 0.62, y2: y })
    atoms.push({ x: -BOND * 0.62, y, text: '' })
    atoms.push({ x: lastX + BOND * 0.62, y, text: '' })
  }
  if (m.group === 'oh' || m.group === 'nh2') {
    const label = m.group === 'oh' ? 'O' : 'N'
    atoms.push({ x: lastX + BOND * 0.72, y, text: label })
    bonds.push({ x1: lastX, y1: y, x2: lastX + BOND * 0.72, y2: y })
    const hs = m.group === 'oh' ? [[lastX + BOND * 1.44, y]] : [[lastX + BOND * 1.44, y], [lastX + BOND * 0.72, y + RISE]]
    for (const [hx, hy] of hs) {
      atoms.push({ x: hx!, y: hy!, text: 'H' })
      bonds.push({ x1: lastX + BOND * 0.72, y1: y, x2: hx!, y2: hy! })
    }
  }
  if (m.group === 'cooh') {
    atoms.push({ x: lastX, y: y - RISE, text: 'O' })
    bonds.push({ x1: lastX, y1: y, x2: lastX, y2: y - RISE, double: true })
    atoms.push({ x: lastX + BOND * 0.72, y, text: 'O' })
    bonds.push({ x1: lastX, y1: y, x2: lastX + BOND * 0.72, y2: y })
    atoms.push({ x: lastX + BOND * 1.44, y, text: 'H' })
    bonds.push({ x1: lastX + BOND * 0.72, y1: y, x2: lastX + BOND * 1.44, y2: y })
  }
  const xsAll = atoms.map((a) => a.x)
  return { atoms, bonds, minX: Math.min(...xsAll), maxX: Math.max(...xsAll), n }
}

/**
 * Per-molecule column widths (wide enough for the structure or its caption, whichever
 * is wider) and the gap after each one, sized to hold that gap's joiner. Shared by both
 * layouts, so the two cannot disagree about how much room a molecule needs.
 */
function formulaMetrics(molecules: Molecule[], joiners: string[]) {
  const laid = molecules.map(layoutMolecule)
  // A caption is centred under its own molecule, so a molecule narrower than its caption
  // has to be given the caption's width or the captions of neighbouring molecules run
  // into each other — which ethane and ethene did, side by side, in the first drawing.
  const widths = laid.map((l, i) => {
    const structure = l.maxX - l.minX + 30 + (molecules[i]!.repeat ? 2 * BRACKET + 20 : 0)
    return Math.max(structure, (molecules[i]!.label?.length ?? 0) * CHAR + 12)
  })
  // The gap after each molecule has to hold the joiner written in it. A fixed gap put
  // "+ H₂O →" straight through the molecules on either side of it.
  const gaps = widths.map((_, i) =>
    i >= laid.length - 1 ? 0 : i < joiners.length ? Math.max(GAP, (joiners[i]?.length ?? 0) * JOIN_CHAR + 22) : GAP,
  )
  const wideW = Math.max(widths.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0), 120)
  return { laid, widths, gaps, wideW }
}

/**
 * The row's true width: the molecules side by side, or the title centred over them,
 * whichever is wider. A title is drawn at one line and never wraps in the wide row, so a
 * long one ("Hydrogen adds across the double bond: nickel, 150 °C", on a pair of molecules
 * only 245 wide) has to be able to grow the row itself — the width the row is drawn at is
 * also what decides whether it fits the box it is in, so the two must agree.
 */
function layoutWidth(molecules: Molecule[], joiners: string[], title: string | undefined): number {
  const structural = molecules.length ? formulaMetrics(molecules, joiners).wideW : 0
  const titleW = title ? title.length * 6.6 + 20 : 0
  return Math.max(structural, titleW, 120)
}

interface Piece { l: Laid; m: Molecule; ox: number; left: number; width: number }

/** One molecule's bonds, atoms and caption, local to its own [left, left + width) column
 * (left is 0 for a layout that draws one molecule per row). */
function moleculePiece(l: Laid, m: Molecule, width: number, left = 0): Piece {
  const pad = m.repeat ? BRACKET + 10 : 0
  const structure = l.maxX - l.minX + 30 + (m.repeat ? 2 * BRACKET + 20 : 0)
  const centring = (width - structure) / 2
  const ox = left - l.minX + 15 + pad + centring
  return { l, m, ox, left, width }
}

function PieceGroup({ piece: { l, m, ox, left, width } }: { piece: Piece }) {
  return (
    <>
      {l.bonds.map((b, k) => {
        const off = b.double ? (b.y1 === b.y2 ? [0, -4, 0, 4] : [-4, 0, 4, 0]) : null
        return off ? (
          <g key={k}>
            <line x1={b.x1 + ox + off[0]!} y1={b.y1 + off[1]!} x2={b.x2 + ox + off[0]!} y2={b.y2 + off[1]!} stroke={INK} strokeWidth={1.6} />
            <line x1={b.x1 + ox + off[2]!} y1={b.y1 + off[3]!} x2={b.x2 + ox + off[2]!} y2={b.y2 + off[3]!} stroke={INK} strokeWidth={1.6} />
          </g>
        ) : (
          <line key={k} x1={b.x1 + ox} y1={b.y1} x2={b.x2 + ox} y2={b.y2} stroke={INK} strokeWidth={1.6} />
        )
      })}
      {/* Atoms are drawn over the bonds on a disc of the page colour, so a bond does
          not run through the middle of a letter. */}
      {l.atoms.filter((a) => a.text !== '').map((a, k) => (
        <g key={`a${k}`}>
          <circle cx={a.x + ox} cy={a.y} r={10} fill="var(--paper, #ffffff)" />
          <text x={a.x + ox} y={a.y + 5} textAnchor="middle" fill={a.text === 'C' ? INK : INK_2} style={{ font: DISPLAY, fontSize: FONT_PX, fontWeight: 600 }}>
            {a.text}
          </text>
        </g>
      ))}
      {m.repeat && (
        <g fill="none" stroke={ACCENT} strokeWidth={1.8}>
          <path d={`M ${left + 22} ${-RISE - 16} L ${left + 10} ${-RISE - 16} L ${left + 10} ${RISE + 16} L ${left + 22} ${RISE + 16}`} />
          <path d={`M ${left + width - 22} ${-RISE - 16} L ${left + width - 10} ${-RISE - 16} L ${left + width - 10} ${RISE + 16} L ${left + width - 22} ${RISE + 16}`} />
          <text x={left + width - 2} y={RISE + 22} fill={ACCENT} stroke="none" style={{ font: DISPLAY, fontSize: 13, fontWeight: 700 }}>
            n
          </text>
        </g>
      )}
      {m.label && (
        <text x={left + width / 2} y={RISE + 46} textAnchor="middle" fill={INK_2} fontFamily={FONT} fontSize={CAPTION_SIZE}>
          {m.label}
        </text>
      )}
    </>
  )
}

interface LayoutProps {
  molecules: Molecule[]
  joiners: string[]
  title: string | undefined
  alt: string
  svgRef: RefObject<SVGSVGElement | null>
}

/** The original side-by-side row: every molecule in one line, joiners written between
 * them. Used whenever it already fits, and always on desktop. */
function DisplayedFormulaRow({ molecules, joiners, title, alt, svgRef }: LayoutProps) {
  const { laid, widths, gaps } = formulaMetrics(molecules, joiners)
  const captions = molecules.some((m) => m.label)
  const H = 2 * RISE + 70 + (captions ? 22 : 0) + (title ? 20 : 0)
  const W = layoutWidth(molecules, joiners, title)
  const midY = RISE + 34 + (title ? 20 : 0)

  let cursor = 0
  const pieces = laid.map((l, i) => {
    const piece = moleculePiece(l, molecules[i]!, widths[i]!, cursor)
    cursor += widths[i]! + gaps[i]!
    return piece
  })

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: `${Math.min(W, 520)}px` }} role="img" aria-label={alt}>
      {title && (
        <text x={W / 2} y={14} textAnchor="middle" fill={INK_2} fontFamily={FONT} fontSize={CAPTION_SIZE}>
          {title}
        </text>
      )}
      {pieces.map((piece, i) => (
        <g key={i} transform={`translate(0 ${midY})`}>
          <PieceGroup piece={piece} />
        </g>
      ))}
      {joiners.map((j, i) => {
        const p = pieces[i]
        if (!p) return null
        return (
          <text key={`j${i}`} x={p.left + p.width + gaps[i]! / 2} y={midY + 5} textAnchor="middle" fill={INK} style={{ font: DISPLAY, fontSize: 17, fontWeight: 600 }}>
            {j}
          </text>
        )
      })}
    </svg>
  )
}

/**
 * The same molecules, one per row, for a box too narrow for the side-by-side row. Every
 * use in the content pack is at most three molecules and the widest single one of them
 * is under 270 units, so stacking — rather than shrinking bonds or labels — is what keeps
 * a three-molecule equation ("butane → ethane + ethene") readable on a phone.
 */
export function DisplayedFormulaStack({ molecules, joiners, title, width, alt, svgRef }: LayoutProps & { width: number }) {
  const { laid, widths } = formulaMetrics(molecules, joiners)
  const contentW = Math.max(...widths, 120)
  const W = Math.max(contentW, Math.min(Math.floor(width), 296))
  // A title such as "Hydrogen adds across the double bond: nickel, 150 °C" is longer than
  // this narrower canvas can hold on one line at the fontSize-11 floor, so it wraps rather
  // than spilling past both edges.
  const titleLines = !title ? [] : title.length * 6.6 > W - 16 ? splitCaption(title) : [title]
  const titleH = titleLines.length === 0 ? 0 : titleLines.length === 1 ? 20 : 33
  const JOINER_ROW = 34
  const rowMidYs: number[] = []
  const joinerYs: number[] = []
  let y = titleH + 10
  laid.forEach((_l, i) => {
    const rowH = 2 * RISE + 70 + (molecules[i]!.label ? 22 : 0)
    rowMidYs.push(y + RISE + 34)
    y += rowH
    if (i < laid.length - 1) {
      joinerYs.push(y + JOINER_ROW / 2 + 4)
      y += JOINER_ROW
    }
  })
  const H = y + 6

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: `${W}px` }} role="img" aria-label={alt}>
      {titleLines.length === 1 && (
        <text x={W / 2} y={14} textAnchor="middle" fill={INK_2} fontFamily={FONT} fontSize={CAPTION_SIZE}>
          {titleLines[0]}
        </text>
      )}
      {titleLines.length === 2 && (
        <>
          <text x={W / 2} y={14} textAnchor="middle" fill={INK_2} fontFamily={FONT} fontSize={CAPTION_SIZE}>{titleLines[0]}</text>
          <text x={W / 2} y={27} textAnchor="middle" fill={INK_2} fontFamily={FONT} fontSize={CAPTION_SIZE}>{titleLines[1]}</text>
        </>
      )}
      {laid.map((l, i) => {
        const piece = moleculePiece(l, molecules[i]!, widths[i]!)
        const rowOffsetX = (W - widths[i]!) / 2
        return (
          <g key={i} transform={`translate(${rowOffsetX} ${rowMidYs[i]})`}>
            <PieceGroup piece={piece} />
          </g>
        )
      })}
      {joiners.map((j, i) => {
        if (i >= joinerYs.length) return null
        return (
          <text key={`j${i}`} x={W / 2} y={joinerYs[i]} textAnchor="middle" fill={INK} style={{ font: DISPLAY, fontSize: 17, fontWeight: 600 }}>
            {j}
          </text>
        )
      })}
    </svg>
  )
}

/**
 * Fully displayed structural formulae, which AQA 4.7.2 asks students to draw for the
 * first four alkenes, the products of their addition reactions, and the repeating unit
 * of an addition polymer.
 *
 * The hydrogens are not given by the content: each carbon is filled to four bonds and
 * each drawn where there is room. So the picture cannot show a carbon with five bonds,
 * and the atoms in the drawing always match the molecular formula — which is the error
 * a hand-drawn structure makes and the one students are marked on.
 *
 * Props: molecules [{carbons, double, group, repeat, label}], joiners (strings drawn
 * between the molecules, such as '+' or '→'), title.
 *
 * Side by side, several molecules can run past 500 units wide — "butane → ethane +
 * ethene" reached 474 — and a diagram stops shrinking at its natural width, so every
 * multi-molecule equation in the pack scrolled sideways on a phone, by as much as 347px.
 * Where the row would not fit the box it is drawn in, the molecules stack one per row
 * instead: each one keeps its full size, and the equation reads top to bottom.
 */
export function DisplayedFormula({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const molecules = (props.molecules as Molecule[] | undefined) ?? []
  const joiners = (props.joiners as string[] | undefined) ?? []
  const title = typeof props.title === 'string' ? props.title : undefined
  const svg = useRef<SVGSVGElement>(null)
  const available = useAvailableWidth(svg)
  // A long title can need more room than the molecules themselves do (one molecule with
  // "Count the hydrogens: every carbon has four bonds" over it, for instance), so the
  // decision to stack has to weigh the title's width too, not just the row of molecules.
  const wideW = layoutWidth(molecules, joiners, title)
  const stacked = available !== undefined && available < wideW
  // The figure fitted the drawing at its first size; a new layout needs a new fit.
  useLayoutEffect(() => {
    svg.current?.dispatchEvent(new Event(REFIT, { bubbles: true }))
  }, [stacked])

  if (molecules.length === 0) return <p style={{ color: INK_2, font: FONT }}>{alt}</p>
  return stacked
    ? <DisplayedFormulaStack molecules={molecules} joiners={joiners} title={title} width={available!} alt={alt} svgRef={svg} />
    : <DisplayedFormulaRow molecules={molecules} joiners={joiners} title={title} alt={alt} svgRef={svg} />
}
