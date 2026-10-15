import { getSubject } from '@study/shared'

/**
 * A pressable filter chip: "All subjects" and one per subject on the glossary, the
 * resources and the search results. Pressed, it takes the subject's colour; `quiet` greys
 * one that would find nothing, without taking it away.
 */
export function FilterChip({ on, colour, quiet, onClick, children }: { on: boolean; colour?: string; quiet?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`min-h-9 shrink-0 whitespace-nowrap rounded-full border px-3 text-sm font-bold ${on ? 'border-transparent' : `border-rule bg-surface ${quiet ? 'text-ink-3' : 'text-ink-2'}`}`}
      // A subject accent is a mid-dark colour and takes white. The fallback is the theme's
      // own ink, which is near-white on a dark theme, so that one takes the surface
      // instead -- pinning white on both put white on white.
      style={on ? { background: colour ?? 'var(--color-ink)', color: colour ? '#fff' : 'var(--color-surface)' } : undefined}
    >
      {children}
    </button>
  )
}

/** A `?subject=` value if it names a subject, else '' (all subjects): a mistyped link should not open on an empty page. */
export function knownSubject(id: string | null): string {
  return id && getSubject(id) ? id : ''
}
