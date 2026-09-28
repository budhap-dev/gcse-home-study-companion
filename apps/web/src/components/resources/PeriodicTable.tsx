import { ELEMENTS, FAMILY_FACT, FAMILY_LABEL, electronShells, groupName, neutrons, type Element, type ElementFamily } from '@study/shared'
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
 * It is 18 columns wide. A phone gives each column about 19px, too small to press or to
 * read, so below its natural width it scrolls sideways inside its own box, the way the
 * app's other diagrams do, rather than shrinking.
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
const INK = '#1e2330'
const INK_2 = '#5a6070'

export function PeriodicTable({ alt }: { alt: string }) {
  const [picked, setPicked] = useState<Element>(ELEMENTS.find((e) => e.symbol === 'Na')!)
  const [family, setFamily] = useState<ElementFamily | null>(null)
  const detail = useRef<HTMLElement>(null)
  // On a phone the panel is below both blocks, out of sight of the cell just pressed.
  const onPick = (el: Element) => {
    setPicked(el)
    if (window.innerWidth < 640) requestAnimationFrame(() => detail.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  }
  const cell = { picked, family, onPick }

  return (
    <figure className="flex flex-col gap-3 rounded-xl border border-rule p-3" style={LIGHT_CANVAS} aria-label={alt}>
      {/* The full table from tablet width. */}
      <div className="hidden sm:block">
        <Grid label="The periodic table" columns={18} column={(g) => g} header={(c) => (c <= 2 ? `${c}` : c >= 13 ? `${c === 18 ? 0 : c - 10}` : '')} elements={ELEMENTS} {...cell} />
      </div>
      {/* On a phone, 18 columns leave each about 17px: too small to press or read. So the
          table splits the way many textbooks print it, main groups and transition metals
          apart, and every cell stays a comfortable target. */}
      <div className="flex flex-col gap-3 sm:hidden">
        <Grid label="Main groups" columns={8} column={(g) => (g <= 2 ? g : g - 10)} header={(c) => `${c <= 2 ? c : c === 8 ? 0 : c}`} elements={ELEMENTS.filter((e) => e.group <= 2 || e.group >= 13)} {...cell} />
        <Grid label="Transition metals" columns={10} column={(g) => g - 2} firstPeriod={4} elements={ELEMENTS.filter((e) => e.group >= 3 && e.group <= 12)} {...cell} />
      </div>

      <Detail el={picked} ref={detail} />

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: INK_2 }}>Families: press one to pick it out</span>
        <div className="flex flex-wrap gap-1.5">
          {FAMILIES.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={family === f}
              onClick={() => setFamily(family === f ? null : f)}
              className="flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold"
              style={{ background: FAMILY_STYLE[f].fill, color: INK, border: `${family === f ? 2 : 1}px solid ${FAMILY_STYLE[f].edge}` }}
            >
              {FAMILY_LABEL[f]}
            </button>
          ))}
        </div>
      </div>
      <figcaption className="text-sm" style={{ color: INK_2 }}>
        As on AQA’s insert: the lanthanides (58 to 71) and actinides (90 to 103) are left out, and masses in brackets are for elements with no stable isotope.
      </figcaption>
    </figure>
  )
}

interface GridProps {
  label: string
  columns: number
  /** Where a group's column falls in this grid. */
  column: (group: number) => number
  header?: (column: number) => string
  /** The period in the grid's first row, so the transition block starts at period 4. */
  firstPeriod?: number
  elements: Element[]
  picked: Element
  family: ElementFamily | null
  onPick: (el: Element) => void
}

function Grid({ label, columns, column, header, firstPeriod = 1, elements, picked, family, onPick }: GridProps) {
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
          const faded = family !== null && el.family !== family
          return (
            <button
              key={el.z}
              type="button"
              onClick={() => onPick(el)}
              aria-pressed={on}
              aria-label={`${el.name}, ${el.symbol}, atomic number ${el.z}`}
              className="flex aspect-[4/5] min-h-7 flex-col items-center justify-center rounded-[5px] leading-none transition-colors"
              // Fading drops the family's colour, not the text's contrast: an opacity fade put
              // every other element's symbol under AA, and they can still be pressed.
              style={{
                gridColumn: column(el.group),
                gridRow: el.period - firstPeriod + top,
                background: faded ? '#f3f4f6' : s.fill,
                border: `${on ? 2.5 : 1}px solid ${faded ? '#d1d5db' : s.edge}`,
                color: faded ? INK_2 : INK,
                boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${s.edge}` : undefined,
              }}
            >
              <span className="hidden text-[11px] lg:block" style={{ color: INK_2 }}>{el.z}</span>
              <span className="text-[13px] font-bold lg:text-[15px]">{el.symbol}</span>
              <span className="hidden text-[11px] lg:block" style={{ color: INK_2 }}>{el.mass}</span>
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
  const n = neutrons(el)
  return (
    <section ref={ref} aria-live="polite" className="flex flex-col gap-2 rounded-xl p-3 sm:flex-row sm:gap-4" style={{ background: s.fill, border: `1px solid ${s.edge}` }}>
      <div className="flex h-24 w-20 shrink-0 flex-col items-center justify-center rounded-lg bg-white" style={{ border: `2px solid ${s.edge}`, color: INK }}>
        <span className="text-xs" style={{ color: INK_2 }}>{el.mass}</span>
        <span className="text-3xl font-bold leading-none">{el.symbol}</span>
        <span className="text-xs" style={{ color: INK_2 }}>{el.z}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-1" style={{ color: INK }}>
        <h3 className="text-lg font-bold capitalize leading-tight">{el.name}</h3>
        <p className="text-sm font-bold" style={{ color: INK_2 }}>{FAMILY_LABEL[el.family]}{FAMILY_LABEL[el.family].startsWith(groupName(el.group)) || el.family === 'transition-metal' ? '' : ` · ${groupName(el.group)}`} · period {el.period}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
          <dt className="font-bold">Atomic number</dt><dd>{el.z}: so {el.z} proton{el.z === 1 ? '' : 's'}, and {el.z} electron{el.z === 1 ? '' : 's'} in the atom</dd>
          <dt className="font-bold">Relative atomic mass</dt><dd>{el.mass}{n !== undefined ? `: the usual atom has ${n} neutron${n === 1 ? '' : 's'}` : el.mass.includes('.') ? ': an average over its isotopes, so not a whole number' : ': the most stable isotope, since none is stable'}</dd>
          {shells && <><dt className="font-bold">Electrons</dt><dd>{shells.join(', ')}, shell by shell from the nucleus</dd></>}
        </dl>
        <p className="text-sm">{FAMILY_FACT[el.family]}</p>
      </div>
    </section>
  )
}
