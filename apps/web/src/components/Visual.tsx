import type { Visual as VisualBlock } from '@study/shared'
import { RichText } from './RichText.tsx'

/**
 * Renders one visual block. Diagrams and interactives fall back to their text
 * description until the SVG component library and interactive kinds are built,
 * which keeps every step readable on any device.
 */
export function Visual({ visual }: { visual: VisualBlock }) {
  switch (visual.type) {
    case 'worked-example':
      return (
        <figure className="flex flex-col gap-2 rounded-xl border border-rule bg-surface p-4">
          <RichText source={visual.problem} className="font-bold" />
          <ol className="flex flex-col gap-1.5 border-l-2 border-[color:var(--subject)] pl-3">
            {visual.steps.map((s, i) => (
              <li key={i} className="flex flex-col gap-0.5">
                <RichText source={s.text} />
                {s.note && <RichText source={s.note} className="text-sm text-ink-2" />}
              </li>
            ))}
          </ol>
        </figure>
      )
    case 'image':
      return (
        <figure className="flex flex-col gap-2">
          <img src={visual.src} alt={visual.alt} className="rounded-xl" />
          {visual.caption && <RichText source={visual.caption} className="text-sm text-ink-2" />}
        </figure>
      )
    case 'animation':
      return <img src={visual.poster} alt={visual.alt} className="rounded-xl" />
    case 'diagram':
      return (
        <figure className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-rule bg-surface p-4 text-center text-sm text-ink-2">
          {visual.alt}
        </figure>
      )
    case 'interactive':
      return (
        <figure className="flex flex-col gap-2 rounded-xl border border-dashed border-rule bg-surface p-4">
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Interactive · {visual.kind}</span>
          <RichText source={visual.fallback} className="text-sm" />
        </figure>
      )
  }
}
