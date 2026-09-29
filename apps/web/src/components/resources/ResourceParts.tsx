import { RESOURCE_STATUS_LABEL, isComingSoon, type Resource, type ResourceBlock, type ResourceStatus, type Visual as VisualData } from '@study/shared'
import { useLayoutEffect, useRef, useState } from 'react'
import { RichText } from '../RichText.tsx'
import { Smiley } from '../Smiley.tsx'
import { Visual } from '../Visual.tsx'
import { keepFormulaTogether, keepSumsTogether } from './formulaLine.ts'
import { PeriodicTable } from './PeriodicTable.tsx'

/**
 * The badge a student reads first: does the exam hand this over, or must it be in their
 * head? Green for given, amber for learn, blue for a map of the course. The words carry
 * the meaning too, so the colour is never the only signal.
 */
export const STATUS_STYLE: Record<ResourceStatus, { colour: string; emoji: string }> = {
  given: { colour: '#2e7d4f', emoji: '📄' },
  learn: { colour: '#b35c00', emoji: '🧠' },
  reference: { colour: '#1f5fbf', emoji: '🧭' },
}

export function StatusBadge({ status }: { status: ResourceStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <span className="chip" style={{ '--chip': s.colour } as React.CSSProperties}>
      <Smiley>{s.emoji}</Smiley>{RESOURCE_STATUS_LABEL[status]}
    </span>
  )
}

export function ComingSoonBadge() {
  return <span className="chip" style={{ '--chip': '#5f6b7a' } as React.CSSProperties}>Coming soon</span>
}

/** The badges on a tile or a page head: its status, and Coming soon while it is planned. */
export function ResourceBadges({ resource }: { resource: Resource }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      <StatusBadge status={resource.status} />
      {isComingSoon(resource) && <ComingSoonBadge />}
    </span>
  )
}

/** The smallest a formula is set to make it fit: 18px type at this is 14.4px, still body size. */
export const SMALLEST_FORMULA = 0.8

export interface FormulaSetting { loose: boolean; scale: number }
const FULL: FormulaSetting = { loose: false, scale: 1 }

/**
 * What to try next for a formula `wide` units across in a line of `room`, or the same
 * setting back where it fits or nothing is left to try. In order:
 *
 * 1. tidy: it breaks only between its sides, after an equals sign or a comma;
 * 2. tidy and a little smaller, where that is enough. The interest on a loan, a fraction
 *    "× 100", was 8px wider than a phone's card: broken the way KaTeX would, it left the
 *    100 alone on a second line, where at 0.9 of the size it fits on one;
 * 3. loose: broken the way KaTeX would, after any plus or minus, at full size. A formula
 *    cut off at the card's edge is worse than one broken at a minus sign;
 * 4. loose and smaller, for a fraction too wide for the card by itself;
 * 5. and what is too wide even then scrolls, because a formula too small to read is
 *    worse than one that scrolls.
 */
export function nextSetting(now: FormulaSetting, wide: number, room: number): FormulaSetting {
  if (wide <= room + 1 || room <= 0 || now.scale < 1) return now
  // Rounded down to a hundredth, so the rounding never leaves it a pixel too wide.
  const fit = Math.floor(((room - 1) / wide) * 100) / 100
  if (!now.loose) return fit >= SMALLEST_FORMULA ? { loose: false, scale: fit } : { loose: true, scale: 1 }
  return { loose: true, scale: Math.max(SMALLEST_FORMULA, fit) }
}

/** A formula on its own line, set to fit the card it is in: see `nextSetting`. */
function FormulaLine({ source }: { source: string }) {
  const line = useRef<HTMLSpanElement>(null)
  const [setting, setSetting] = useState(FULL)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = line.current
    if (!el || typeof ResizeObserver === 'undefined') return
    // A new width is a new question: start again from the tidy setting.
    const watch = new ResizeObserver(() => {
      const now = Math.round(el.clientWidth)
      setWidth((was) => { if (was !== now) setSetting(FULL); return now })
    })
    watch.observe(el)
    return () => watch.disconnect()
  }, [])
  useLayoutEffect(() => {
    const el = line.current
    if (!el) return
    const next = nextSetting(setting, el.scrollWidth, el.clientWidth)
    if (next !== setting) setSetting(next)
  }, [source, setting, width])
  const { loose, scale } = setting
  return (
    <span
      ref={line}
      className="formula-line block overflow-x-auto overflow-y-hidden text-lg"
      data-formula={`${loose ? 'loose' : 'tidy'}${scale < 1 ? ' small' : ''}`}
      style={scale < 1 ? { fontSize: `${(1.125 * scale).toFixed(3)}rem` } : undefined}
    >
      <RichText source={loose ? source : keepFormulaTogether(source)} inline />
    </span>
  )
}

/**
 * Running text on a sheet: a note, a caption, a cell, what the letters of a formula mean.
 * It is rich text with its short sums held together, so a line never ends on a times sign.
 */
export function Prose({ source, className, inline }: { source: string; className?: string; inline?: boolean }) {
  return <RichText source={keepSumsTogether(source)} className={className} inline={inline} />
}

/** A cell short enough to share a line with its neighbours in a row's card on a phone. */
const plain = (cell: string) => cell.replace(/\$[^$]*\$/g, 'xx').replace(/[`*_]/g, '')
const SHORT_CELL = 14

/**
 * The wider drawing a laptop has room for, where a component has one. The narrow drawing
 * is what a phone's card holds; shown at that size in a card three times as wide, it sat
 * in the middle with its text still wrapped to a phone's line.
 */
export function wideVariant(visual: VisualData): VisualData | undefined {
  if (visual.type !== 'diagram') return undefined
  if (visual.component === 'circuit-symbols') return { ...visual, props: { ...visual.props, columns: 5 } }
  if (visual.component === 'em-spectrum') return { ...visual, props: { ...visual.props, layout: 'across' } }
  return undefined
}

/** A drawing with its caption. */
export function Figure({ block }: { block: Extract<ResourceBlock, { kind: 'visual' }> }) {
  const wide = wideVariant(block.visual)
  return (
    <figure className="break-inside-avoid flex min-w-0 flex-col gap-2">
      {/* Only one of the two is displayed at a width, so a screen reader meets one. Print
          takes the narrow one: a page is narrower than the width the wide one starts at. */}
      {wide ? (
        <>
          <div className="lg:hidden print:block"><Visual visual={block.visual} /></div>
          <div className="hidden lg:block print:hidden"><Visual visual={wide} /></div>
        </>
      ) : <Visual visual={block.visual} />}
      {block.caption && <figcaption><Prose source={block.caption} className="text-sm text-ink-2" /></figcaption>}
    </figure>
  )
}

/** One block of a resource: a formula group, a table, a paragraph or a drawing. */
export function Block({ block }: { block: ResourceBlock }) {
  switch (block.kind) {
    case 'formulae':
      return (
        // Columns, not a grid: a grid row is as tall as its taller card, so the six
        // electricity equations sat in a card stretched to the height of the eight energy
        // ones beside it, half of it blank. Columns pack each card under the last.
        <div className="gap-3 md:columns-2">
          {block.groups.map((group) => (
            <section
              key={group.title}
              className="mb-3 break-inside-avoid flex flex-col overflow-hidden rounded-xl border border-rule bg-surface"
              style={{ borderLeft: `6px solid ${group.colour}` }}
            >
              {/* A chip, not an inline colour: the chip clamps its ink so it still reads on a dark theme. */}
              <h3 className="chip mx-4 mt-3" style={{ '--chip': group.colour } as React.CSSProperties}>{group.title}</h3>
              <ul className="flex flex-col divide-y divide-rule">
                {group.items.map((f) => (
                  <li key={f.name} className="flex flex-col gap-2 px-4 py-2.5">
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                      {/* A name can hold maths ("Solving $ax^2 + bx + c = 0$"), so it is rich text too. */}
                      <Prose source={f.name} inline />
                      {f.higher && <span className="chip" style={{ '--chip': '#6B4E9B' } as React.CSSProperties} title="Higher tier only">HT</span>}
                      {f.status && <StatusBadge status={f.status} />}
                    </span>
                    <FormulaLine source={f.formula} />
                    {f.symbols && <Prose source={f.symbols} className="text-sm text-ink-2" />}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )
    case 'table': {
      // Cards only when a row has a long cell to hold: eight place values or three short
      // columns of numbers fit a phone as a table, and read far better as one.
      const stacked = block.columns.length >= 3 && block.rows.some((row) => row.some((cell) => cell.replace(/\$[^$]*\$|`/g, '').length > 16))
      return (
        <figure className="flex min-w-0 flex-col gap-2">
          {block.title && <figcaption className="font-bold">{block.title}</figcaption>}
          {/* Three or more columns squeeze to a word a line on a phone, so there each row
              becomes a card: its first cell the heading, the rest labelled by column. Only
              one of the two is displayed at a width, so a screen reader meets one. */}
          {stacked && (
            <ul className="flex flex-col gap-2 sm:hidden">
              {block.rows.map((row, i) => (
                <li key={i} className="break-inside-avoid flex flex-col gap-1.5 rounded-xl border border-rule bg-surface px-4 py-3" style={{ borderLeft: '4px solid var(--subject)' }}>
                  <span className="font-bold"><Prose source={row[0] || ' '} inline /></span>
                  {/* Short cells share a line and a long one takes its own: a symbol, a
                      unit and a tick each on a line of their own made a card four lines
                      tall for a dozen characters, and the page five screens long. */}
                  <span className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {row.slice(1).map((cell, j) => (
                      <span key={j} className={`text-[15px] ${plain(cell).length > SHORT_CELL ? 'basis-full' : ''}`}>
                        <span className="text-xs font-bold uppercase tracking-[0.06em] text-ink-3">{block.columns[j + 1]}</span>{' '}
                        <Prose source={cell || ' '} inline />
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className={`overflow-x-auto rounded-xl border border-rule bg-surface ${stacked ? 'hidden sm:block' : ''}`}>
            <table className="w-full border-collapse text-left text-[15px]">
              <thead>
                <tr className="bg-[color:var(--subject-soft)]">
                  {block.columns.map((c) => <th key={c} scope="col" className="px-3 py-2 align-bottom text-sm font-bold">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, i) => (
                  <tr key={i} className="break-inside-avoid border-t border-rule align-top">
                    {row.map((cell, j) => (
                      j === 0
                        ? <th key={j} scope="row" className="px-3 py-2 font-bold"><Prose source={cell || ' '} inline /></th>
                        : <td key={j} className="px-3 py-2"><Prose source={cell || ' '} inline /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.note && <Prose source={block.note} className="text-sm text-ink-2" />}
        </figure>
      )
    }
    case 'text':
      return <Prose source={block.body} className="max-w-3xl" />
    case 'widget':
      return <PeriodicTable alt={block.alt} />
    case 'visual':
      return <Figure block={block} />
  }
}

type VisualBlock = Extract<ResourceBlock, { kind: 'visual' }>

/**
 * How a resource's blocks sit on the page:
 *
 * - `figures`: drawings that follow one another share rows on a laptop, two across, or
 *   three where there are exactly three. Eight circle theorems one under another, each
 *   phone-sized in the middle of a wide card, made a page nine screens long.
 * - `beside`: a drawing on its own sits beside the block after it, the heart beside its
 *   table of vessels, rather than alone in a row with white either side. Words that
 *   follow a table go under it in the same column: the table of four vessels is a third
 *   of the heart's height, and the rest of that column was left blank.
 * - `single`: everything else, the full width.
 *
 * A phone shows them all one under another, in the order written.
 */
export type Row =
  | { kind: 'single'; block: ResourceBlock }
  | { kind: 'figures'; blocks: VisualBlock[] }
  | { kind: 'beside'; figure: VisualBlock; next: ResourceBlock[] }

export function rowsOf(blocks: ResourceBlock[]): Row[] {
  const rows: Row[] = []
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!
    if (block.kind !== 'visual') { rows.push({ kind: 'single', block }); continue }
    const run: VisualBlock[] = [block]
    while (blocks[i + 1]?.kind === 'visual') run.push(blocks[++i] as VisualBlock)
    const next = blocks[i + 1]
    if (run.length > 1) rows.push({ kind: 'figures', blocks: run })
    else if (!wideVariant(block.visual) && next && (next.kind === 'table' || next.kind === 'text')) {
      const after = blocks[i + 2]
      const column = next.kind === 'table' && after?.kind === 'text' ? [next, after] : [next]
      rows.push({ kind: 'beside', figure: block, next: column })
      i += column.length
    } else rows.push({ kind: 'single', block })
  }
  return rows
}

export function Blocks({ blocks }: { blocks: ResourceBlock[] }) {
  return (
    <div className="flex flex-col gap-5">
      {rowsOf(blocks).map((row, i) => {
        if (row.kind === 'single') return <Block key={i} block={row.block} />
        if (row.kind === 'beside') {
          return (
            <div key={i} className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]" data-row="beside">
              <Figure block={row.figure} />
              <div className="flex min-w-0 flex-col gap-5">
                {row.next.map((b, j) => <Block key={j} block={b} />)}
              </div>
            </div>
          )
        }
        return (
          <div key={i} className={`grid grid-cols-1 items-start gap-5 lg:grid-cols-2 ${row.blocks.length === 3 ? 'xl:grid-cols-3' : ''}`} data-row="figures">
            {row.blocks.map((b, j) => <Figure key={j} block={b} />)}
          </div>
        )
      })}
    </div>
  )
}
