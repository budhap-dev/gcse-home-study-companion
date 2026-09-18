import { useEffect, useId, useRef, useState } from 'react'

export interface Option<T extends string | number> {
  value: T
  label: string
}

/**
 * A dropdown drawn by the app rather than by the operating system.
 *
 * A native `<select>` opens an OS-level popup whose appearance the page cannot influence
 * at all — no CSS reaches it, and on macOS it renders with the system's own translucency
 * over whatever is behind it. Where a form mixes a native select with a styled combobox
 * the two look like they belong to different applications, so these are drawn here.
 *
 * The trade is that native selects get the platform picker on a phone, which this does
 * not; a plain list of tall rows is the next best thing and is what this renders.
 */
export function Choice<T extends string | number>({
  label, value, options, onChange, className = '',
}: {
  label: string
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    function away(e: MouseEvent) { if (!boxRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [])
  useEffect(() => { if (open) setActive(Math.max(0, options.findIndex((o) => o.value === value))) }, [open, options, value])

  const choose = (v: T) => { onChange(v); setOpen(false) }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, options.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    if ((e.key === 'Enter' || e.key === ' ') && open && options[active]) { e.preventDefault(); choose(options[active].value) }
    if ((e.key === 'Enter' || e.key === ' ') && !open) { e.preventDefault(); setOpen(true) }
  }

  return (
    <div ref={boxRef} className={`relative flex flex-col gap-1 text-sm ${className}`}>
      <span className="font-bold">{label}</span>
      <button
        type="button" role="combobox" aria-label={label} aria-expanded={open} aria-controls={listId}
        onClick={() => setOpen((o) => !o)} onKeyDown={onKeyDown}
        className="flex h-11 items-center justify-between gap-2 rounded-lg border border-rule bg-surface px-3 text-left"
      >
        <span className="min-w-0 truncate">{current?.label ?? ''}</span>
        <span aria-hidden className="shrink-0 text-ink-3">▾</span>
      </button>
      {open && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-rule bg-surface shadow-lg">
          {options.map((o, i) => (
            <li key={String(o.value)} role="option" aria-selected={o.value === value}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); choose(o.value) }} onMouseEnter={() => setActive(i)}
                className={`flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left ${i === active ? 'bg-panel' : ''}`}>
                <span aria-hidden className={`w-4 shrink-0 font-bold ${o.value === value ? 'text-ink' : 'text-transparent'}`}>✓</span>
                <span className="min-w-0 flex-1">{o.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
