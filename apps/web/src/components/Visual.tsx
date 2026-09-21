import type { Visual as VisualBlock } from '@study/shared'
import { useFitSvgText } from './fitSvgText.ts'
import { RichText } from './RichText.tsx'
import { DIAGRAMS } from './diagrams/index.tsx'
import { SliderGraph } from './interactives/SliderGraph.tsx'
import { EquationEntry } from './interactives/EquationEntry.tsx'
import { VocabList } from './interactives/VocabList.tsx'
import { KindChip } from './KindChip.tsx'

/**
 * Diagrams are drawn with dark ink on a light ground, whatever the theme. Dark
 * themes would otherwise hide them, so the canvas pins its own colours and gives
 * the subject tint a light version for fills.
 */
export const LIGHT_CANVAS = {
  // backgroundColor, not the `background` shorthand: the shorthand resets
  // background-image, and that is where styles.css draws the scroll shadow.
  backgroundColor: '#ffffff',
  '--color-surface': '#ffffff',
  '--color-panel': '#f0ede4',
  '--subject-soft': 'color-mix(in srgb, var(--subject) 14%, #ffffff)',
} as React.CSSProperties

/** The diagram canvas, fitted so a label wider than the drawing is not cut off. */
function DiagramFigure({ component, children }: { component: string; children: React.ReactNode }) {
  const ref = useFitSvgText<HTMLElement>()
  return (
    // overflow-x-auto, and no justify-center: below its natural width the drawing stops
    // shrinking (see stopShrinkingBelowNaturalWidth) and this is what it scrolls inside.
    // The centring moved onto the svg's own auto margins, because justify-content puts a
    // wider-than-container item's left edge somewhere scrolling cannot reach.
    //
    // items-center, not the default stretch: an svg with a viewBox and width:100% has
    // no intrinsic height, so a stretching flex parent pulls it to the height of the
    // tallest thing in the grid row and the drawing floats in a sea of whitespace.
    // That alone was not enough -- it centred the drawing but left the figure itself
    // stretched, so a short verb table still sat in a box sized to the vocabulary list
    // beside it. The grid in Lesson.tsx now uses items-start, so the figure takes its
    // own height and this keeps the drawing centred within it.
    <figure ref={ref} className="flex items-center overflow-x-auto rounded-xl border border-rule p-3" style={LIGHT_CANVAS} data-diagram={component}>
      {children}
    </figure>
  )
}

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
          <DiagramFigure component={visual.component}>
            <Diagram props={visual.props} alt={visual.alt} />
          </DiagramFigure>
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
      if (visual.kind === 'equation-entry') return <EquationEntry config={visual.config} alt={visual.fallback} />
      if (visual.kind === 'vocab-list') return <VocabList config={visual.config} alt={visual.fallback} />
      return (
        <figure className="flex flex-col gap-2 rounded-xl border border-dashed border-rule bg-surface p-4">
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Interactive · {visual.kind}</span>
          <RichText source={visual.fallback} className="text-sm" />
        </figure>
      )
  }
}
