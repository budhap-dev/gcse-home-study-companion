import { ELEMENTS, FAMILY_LABEL, electronShells, factFor, groupName, massNote, neutronWorking, placeOf, type Element, type ElementFamily } from '@study/shared'
import { useRef, useState } from 'react'
import { LIGHT_CANVAS } from '../Visual.tsx'

/**
 * The periodic table, as AQA prints it for the exam, made to be pressed: every element is
 * a button, and the panel under the table says what the insert says about it (symbol,
 * atomic number, relative atomic mass) and what follows from that (protons, electrons,
 * neutrons, the electronic structure up to calcium, and what its family is known for).
 *
 * Coloured by family, with a legend that is also a filter: press a family and the rest of
 * the table fades. The name is always in the cell's accessible label, so the colour never
 * carries anything on its own.
 *
 * Under the panel, how to read the table, worked for the pressed element rather than told
 * once for sodium: the neutrons sum (or why there is none), and what its row and column
 * say, with buttons that pick that row or column out of the table as a family does.
 *
 * It is 18 columns wide. A phone gives each column about 19px, too small to press or to
 * read, so there the table splits in two: main groups, and the transition metals.
 *
 * A cell reads as the insert's does, top to bottom: relative atomic mass, symbol, atomic
 * number. Hydrogen stands where the insert prints it: on its own in the first row, above
 * the eighth column and under no group number.
 */
export const FAMILY_STYLE: Record<ElementFamily, { fill: string; edge: string }> = {
  'alkali-metal': { fill: '#fde2e1', edge: '#b3261e' },
  'alkaline-earth-metal': { fill: '#ffedd5', edge: '#c2410c' },
  'transition-metal': { fill: '#fef3c7', edge: '#a16207' },
  'other-metal': { fill: '#e0f2fe', edge: '#0369a1' },
  'metalloid': { fill: '#dcfce7', edge: '#15803d' },
  'non-metal': { fill: '#ccfbf1', edge: '#0f766e' },
  'halogen': { fill: '#ede9fe', edge: '#6d28d9' },
  'noble-gas': { fill: '#fce7f3', edge: '#be185d' },
}

const FAMILIES = Object.keys(FAMILY_STYLE) as ElementFamily[]

/** What the table is picking out: one family, or the pressed element's row or column. Only one at a time. */
type Focus = { family: ElementFamily } | 'period' | 'group' | null

function inFocus(focus: Focus, el: Element, picked: Element): boolean {
  if (focus === null) return true
  if (focus === 'period') return el.period === picked.period
  if (focus === 'group') return el.group === picked.group
  return el.family === focus.family
}
const INK = '#1e2330'
const INK_2 = '#5a6070'

export function PeriodicTable({ alt }: { alt: string }) {
  const [picked, setPicked] = useState<Element>(ELEMENTS.find((e) => e.symbol === 'Na')!)
  const [focus, setFocus] = useState<Focus>(null)
  const detail = useRef<HTMLElement>(null)
  const tables = useRef<HTMLDivElement>(null)
  // On a phone the panel is below both blocks, out of sight of the cell just pressed.
  const onPick = (el: Element) => {
    setPicked(el)
    // Hydrogen has no column to show, so a column picked out for another element lets go.
    if (focus === 'group' && el.group === null) setFocus(null)
    if (window.innerWidth < 640) requestAnimationFrame(() => detail.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  }
  // The row and column buttons sit below the panel; on a phone the table is out of sight, so bring it back.
  const onShow = (f: 'period' | 'group') => {
    const next = focus === f ? null : f
    setFocus(next)
    if (next && window.innerWidth < 640) requestAnimationFrame(() => tables.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  }
  const cell = { picked, lit: (el: Element) => inFocus(focus, el, picked), onPick }
  const familyOn = (f: ElementFamily) => focus !== null && typeof focus === 'object' && focus.family === f

  return (
    <figure className="flex flex-col gap-3 rounded-xl border border-rule p-3" style={LIGHT_CANVAS} aria-label={alt}>
      <div ref={tables} className="flex scroll-mt-20 flex-col gap-3">
      {/* The full table from tablet width. */}
      <div className="hidden sm:block">
        <Grid label="The periodic table" columns={18} column={(el) => el.group ?? HYDROGEN_COLUMN} header={(c) => (c <= 2 ? `${c}` : c >= 13 ? `${c === 18 ? 0 : c - 10}` : '')} elements={ELEMENTS} {...cell} />
      </div>
      {/* On a phone, 18 columns leave each about 17px: too small to press or read. So the
          table splits the way many textbooks print it, main groups and transition metals
          apart, and every cell stays a comfortable target. */}
      <div className="flex flex-col gap-3 sm:hidden">
        {/* Eight columns leave hydrogen no empty one to stand over, so it sits between two, under neither heading. */}
        <Grid label="Main groups" columns={8} column={(el) => (el.group === null ? 'between 4 and 5' : el.group <= 2 ? el.group : el.group - 10)} header={(c) => `${c <= 2 ? c : c === 8 ? 0 : c}`} elements={ELEMENTS.filter((e) => e.group === null || e.group <= 2 || e.group >= 13)} {...cell} />
        <Grid label="Transition metals" columns={10} column={(el) => el.group! - 2} firstPeriod={4} elements={ELEMENTS.filter((e) => e.group !== null && e.group >= 3 && e.group <= 12)} {...cell} />
      </div>
      </div>

      <Detail el={picked} ref={detail} />
      <HowToRead el={picked} focus={focus} onShow={onShow} />

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: INK_2 }}>Families: press one to pick it out</span>
        <div className="flex flex-wrap gap-1.5">
          {FAMILIES.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={familyOn(f)}
              onClick={() => setFocus(familyOn(f) ? null : { family: f })}
              className="flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold"
              style={{ background: FAMILY_STYLE[f].fill, color: INK, border: `${familyOn(f) ? 2 : 1}px solid ${FAMILY_STYLE[f].edge}` }}
            >
              {/* A tick as well as the thicker edge: the edge alone was easy to miss. */}
              {familyOn(f) && <span aria-hidden>✓</span>}
              {FAMILY_LABEL[f]}
            </button>
          ))}
          {/* Pressing the family again lets go too, but nothing said so. This shows while
              anything is picked out, a family or the pressed element's row or column. */}
          {focus !== null && (
            <button
              type="button"
              onClick={() => setFocus(null)}
              data-show-all
              className="flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold"
              style={{ background: INK, color: '#fff', border: `1px solid ${INK}` }}
            >
              <span aria-hidden>✕</span>Show all
            </button>
          )}
        </div>
      </div>
      <figcaption className="text-sm" style={{ color: INK_2 }}>
        As on AQA’s insert, the lanthanides (58 to 71) and actinides (90 to 103) are left out. Some masses are printed in brackets. Those elements are radioactive and have no stable atoms, so the figure is the mass of one kind of atom, not an average.
      </figcaption>
    </figure>
  )
}

/** Where the insert prints hydrogen in the full table: alone, above the eighth column. */
export const HYDROGEN_COLUMN = 8

interface GridProps {
  label: string
  columns: number
  /** The column an element falls in, in this grid; or between two, for one that belongs to neither. */
  column: (el: Element) => number | `between ${number} and ${number}`
  header?: (column: number) => string
  /** The period in the grid's first row, so the transition block starts at period 4. */
  firstPeriod?: number
  elements: Element[]
  picked: Element
  /** False for a cell the table is not picking out just now, which fades. */
  lit: (el: Element) => boolean
  onPick: (el: Element) => void
}

function Grid({ label, columns, column, header, firstPeriod = 1, elements, picked, lit, onPick }: GridProps) {
  const top = header ? 2 : 1
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: INK_2 }}>{label}</span>
      <div role="group" aria-label={label} className="grid w-full gap-[3px]" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {header && Array.from({ length: columns }, (_, i) => (
          <span key={`h${i}`} aria-hidden className="text-center text-[11px] font-bold" style={{ gridColumn: i + 1, gridRow: 1, color: INK_2 }}>{header(i + 1)}</span>
        ))}
        {elements.map((el) => {
          const s = FAMILY_STYLE[el.family]
          const on = picked.z === el.z
          const faded = !lit(el)
          const at = column(el)
          const between = typeof at === 'string' ? Number(at.split(' ')[1]) : undefined
          // Across the table like a wave, top left first: a cell waits for its row and its column.
          const wait = { '--d': `${((el.period - firstPeriod) * 0.05 + (typeof at === 'number' ? at : between!) * 0.018).toFixed(2)}s` } as React.CSSProperties
          return (
            <button
              key={el.z}
              type="button"
              onClick={() => onPick(el)}
              aria-pressed={on}
              aria-label={`${el.name}, ${el.symbol}, atomic number ${el.z}`}
              className="anim-sq flex aspect-[4/5] min-h-7 flex-col items-center justify-center rounded-[5px] leading-none transition-colors"
              // Fading drops the family's colour, not the text's contrast: an opacity fade put
              // every other element's symbol under AA, and they can still be pressed.
              style={{
                // Between two columns: across both, one column wide, in the middle.
                ...(between !== undefined ? { gridColumn: `${between} / span 2`, width: 'calc((100% - 3px) / 2)', justifySelf: 'center' } : { gridColumn: at }),
                gridRow: el.period - firstPeriod + top,
                ...wait,
                background: faded ? '#f3f4f6' : s.fill,
                border: `${on ? 2.5 : 1}px solid ${faded ? '#d1d5db' : s.edge}`,
                color: faded ? INK_2 : INK,
                boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${s.edge}` : undefined,
              }}
            >
              {/* The insert's order: mass on top, atomic number at the bottom. */}
              <span className="hidden text-[11px] lg:block" data-cell="mass" style={{ color: INK_2 }}>{el.mass}</span>
              <span className="text-[13px] font-bold lg:text-[15px]">{el.symbol}</span>
              <span className="hidden text-[11px] lg:block" data-cell="number" style={{ color: INK_2 }}>{el.z}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Detail({ el, ref }: { el: Element; ref: React.Ref<HTMLElement> }) {
  const s = FAMILY_STYLE[el.family]
  const shells = electronShells(el.z)
  return (
    <section ref={ref} aria-live="polite" className="flex flex-col gap-2 rounded-xl p-3 transition-colors sm:flex-row sm:gap-4" style={{ background: s.fill, border: `1px solid ${s.edge}` }}>
      {/* Keyed by the element, so each press brings its card in afresh. The section itself stays, for the screen reader's sake. */}
      {/* The cell, labelled: what each of its three lines is. The words beside it say the same to a screen reader, so the labels are hidden from one. */}
      <div key={el.z} className="anim-pop flex shrink-0 gap-2">
        <div className="flex h-24 w-20 flex-col items-center justify-between rounded-lg bg-white py-1.5" style={{ border: `2px solid ${s.edge}`, color: INK }}>
          <span className="text-xs leading-4" style={{ color: INK_2 }}>{el.mass}</span>
          <span className="text-3xl font-bold leading-none">{el.symbol}</span>
          <span className="text-xs leading-4" style={{ color: INK_2 }}>{el.z}</span>
        </div>
        <div aria-hidden data-cell-labels className="flex h-24 flex-col justify-between py-1.5 text-[12px] font-bold leading-4" style={{ color: INK_2 }}>
          <span>← relative atomic mass</span>
          <span>← symbol</span>
          <span>← atomic number</span>
        </div>
      </div>
      <div key={`words-${el.z}`} className="anim-fade-up flex min-w-0 flex-col gap-1" style={{ color: INK }}>
        <h3 className="text-lg font-bold capitalize leading-tight">{el.name}</h3>
        <p className="text-sm font-bold" style={{ color: INK_2 }}>{FAMILY_LABEL[el.family]}{FAMILY_LABEL[el.family].startsWith(groupName(el.group)) || el.family === 'transition-metal' ? '' : ` · ${groupName(el.group)}`} · period {el.period}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
          <dt className="font-bold">Atomic number</dt><dd>{el.z}: so {el.z} proton{el.z === 1 ? '' : 's'}, and {el.z} electron{el.z === 1 ? '' : 's'} in the atom</dd>
          <dt className="font-bold">Relative atomic mass</dt><dd>{el.mass}: {massNote(el)}</dd>
          {shells && <><dt className="font-bold">Electrons</dt><dd>{shells.join(', ')}, shell by shell from the nucleus</dd></>}
        </dl>
        <p className="text-sm">{factFor(el)}</p>
      </div>
    </section>
  )
}

/**
 * How to read the table, for the element pressed: the neutrons sum and what its row and
 * column say. The rule is stated once under each, in grey; the line above it changes.
 */
function HowToRead({ el, focus, onShow }: { el: Element; focus: Focus; onShow: (f: 'period' | 'group') => void }) {
  const work = neutronWorking(el)
  const place = placeOf(el)
  const columnName = el.group === null ? null : el.group >= 3 && el.group <= 12 ? 'its column' : groupName(el.group)
  const card = 'flex flex-col gap-2 rounded-xl bg-white p-3'
  const heading = 'text-xs font-bold uppercase tracking-[0.08em]'
  const show = (f: 'period' | 'group', label: string) => (
    // The figure is white in every theme, so the button's colours are this figure's own, not the theme's.
    <button
      type="button"
      aria-pressed={focus === f}
      onClick={() => onShow(f)}
      className="btn min-h-9 shrink-0 self-start whitespace-nowrap px-3 text-[13px]"
      style={focus === f ? { background: INK, color: '#fff', borderColor: INK } : { background: '#fff', color: INK, borderColor: '#9ca3af' }}
    >
      {/* A toggle keeps its name, as the family buttons do; pressed shows in the fill. */}
      Show {label}
    </button>
  )
  return (
    <div className="grid gap-3 sm:grid-cols-2" style={{ color: INK }}>
      <section aria-label="Finding the neutrons" className={card} style={{ border: '1px solid #d1d5db' }}>
        <h3 className={heading} style={{ color: INK_2 }}>Finding the neutrons</h3>
        <div key={el.z} className="anim-fade-up flex flex-col gap-1">
          <p className="text-2xl font-bold tabular-nums" data-neutrons>{work.sum ?? 'Given in the question'}</p>
          <p className="text-sm">{work.words}</p>
        </div>
        <p className="mt-auto text-xs" style={{ color: INK_2 }}>Neutrons = relative atomic mass − atomic number. It works for the first 20 elements, except chlorine.</p>
      </section>
      <section aria-label="Its row and its column" className={card} style={{ border: '1px solid #d1d5db' }}>
        <h3 className={heading} style={{ color: INK_2 }}>Its row and its column</h3>
        <div key={el.z} className="anim-fade-up flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm"><strong>Row:</strong> {place.row}</p>
            {show('period', `period ${el.period}`)}
          </div>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm"><strong>Column:</strong> {place.column}</p>
            {columnName && show('group', columnName.startsWith('Group') ? `group ${columnName.slice(6)}` : columnName)}
          </div>
        </div>
        <p className="mt-auto text-xs" style={{ color: INK_2 }}>A row is a period: every element in it has the same number of electron shells. A column is a group: the same number of electrons in the outer shell, which is why its elements react alike.</p>
      </section>
    </div>
  )
}
