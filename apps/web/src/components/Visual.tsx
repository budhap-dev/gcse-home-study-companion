import type { Visual as VisualBlock } from '@study/shared'
import { RichText } from './RichText.tsx'
import { DIAGRAMS } from './diagrams/index.tsx'
import { SliderGraph } from './interactives/SliderGraph.tsx'
import { KindChip } from './KindChip.tsx'

/**
 * Diagrams are drawn with dark ink on a light ground, whatever the theme. Dark
 * themes would otherwise hide them, so the canvas pins its own colours and gives
 * the subject tint a light version for fills.
 */
export const LIGHT_CANVAS = {
  background: '#ffffff',
  '--color-surface': '#ffffff',
  '--color-panel': '#f0ede4',
  '--subject-soft': 'color-mix(in srgb, var(--subject) 14%, #ffffff)',
} as React.CSSProperties

/**
 * Renders one visual block. Diagrams and interactives fall back to their text
 * description until the SVG component library and interactive kinds are built,
 * which keeps every step readable on any device.
 */
export function Visual({ visual }: { visual: VisualBlock }) {
  switch (visual.type) {
    case 'worked-example':
      return (
        <figure className="flex flex-col gap-2 rounded-xl border border-rule border-l-4 border-l-[#1f3a93] bg-surface p-4">
          <KindChip kind="worked-example" />
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
    case 'diagram': {
      const Diagram = DIAGRAMS[visual.component]
      if (Diagram) {
        return (
          <figure className="flex justify-center rounded-xl border border-rule p-3" style={LIGHT_CANVAS} data-diagram={visual.component}>
            <Diagram props={visual.props} alt={visual.alt} />
          </figure>
        )
      }
      return (
        <figure className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-rule bg-surface p-4 text-center text-sm text-ink-2">
          {visual.alt}
        </figure>
      )
    }
    case 'interactive':
      if (visual.kind === 'slider-graph') return <SliderGraph config={visual.config} alt={visual.fallback} />
      return (
        <figure className="flex flex-col gap-2 rounded-xl border border-dashed border-rule bg-surface p-4">
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Interactive · {visual.kind}</span>
          <RichText source={visual.fallback} className="text-sm" />
        </figure>
      )
  }
}
