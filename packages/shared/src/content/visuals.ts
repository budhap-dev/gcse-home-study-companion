import { z } from 'zod'
import { RichText } from './common.ts'

/**
 * Every lesson step carries at least one visual. The visual is meant to carry
 * the idea, so text-only steps fail validation.
 */
const Image = z.object({
  type: z.literal('image'),
  /** Key in the media bucket, or a relative path in a sample pack. */
  src: z.string().min(1),
  alt: z.string().min(1),
  caption: RichText.optional(),
})

/** A diagram drawn by the shared SVG component library, so it scales and prints cleanly. */
const Diagram = z.object({
  type: z.literal('diagram'),
  component: z.string().min(1),
  props: z.record(z.string(), z.unknown()).default({}),
  alt: z.string().min(1),
})

const Animation = z.object({
  type: z.literal('animation'),
  src: z.string().min(1),
  alt: z.string().min(1),
  /** Shown instead of the animation when the viewer prefers reduced motion. */
  poster: z.string().min(1),
})

const WorkedExample = z.object({
  type: z.literal('worked-example'),
  problem: RichText,
  steps: z.array(z.object({ text: RichText, note: RichText.optional() })).min(1),
})

/** Interactive step types from LRN-7. Code trace arrives with Computer Science in Phase 3. */
const Interactive = z.object({
  type: z.literal('interactive'),
  kind: z.enum(['slider-graph', 'drag-order', 'drag-match', 'labelling', 'equation-entry', 'vocab-list']),
  config: z.record(z.string(), z.unknown()),
  /** Static description of the finished state for screen readers and older devices. */
  fallback: RichText,
})

export const Visual = z.discriminatedUnion('type', [Image, Diagram, Animation, WorkedExample, Interactive])
export type Visual = z.infer<typeof Visual>

/** A visual together with where in the topic it was found, for use in an assertion message. */
export interface PlacedVisual {
  visual: Visual
  /** Human-readable location within the topic, such as `step-3` or `why[1] The door handle`. */
  where: string
}

/**
 * Every visual in a topic, wherever it lives.
 *
 * The scanners that hold the diagram library to its rules — props the component actually
 * reads, alt text that could replace the picture, tables that fit their columns, no
 * Markdown in a prop — each walked `lesson.steps` and stopped there. That was the whole
 * of the content when they were written. `why.examples` then added 93 diagrams that no
 * scanner looked at, and one of them passed `outcomeHeader` to a component that has never
 * read it, so the prop was silently dropped exactly as those tests exist to prevent.
 *
 * So the list of places a visual can appear is written down once, here, beside the schema
 * that defines them. A scanner that walks this cannot miss a location, and the next field
 * to carry a Visual is added in one place rather than five.
 */
export function everyVisual(topic: unknown): PlacedVisual[] {
  const t = topic as {
    why?: { examples?: { title?: string; visual?: Visual }[] }
    lesson?: { steps?: { id?: string; visuals?: Visual[] }[] }
    questions?: { id?: string; visual?: Visual }[]
  }
  const out: PlacedVisual[] = []
  for (const [i, example] of (t.why?.examples ?? []).entries()) {
    if (example?.visual) out.push({ visual: example.visual, where: `why[${i}] ${example.title ?? ''}`.trim() })
  }
  for (const step of t.lesson?.steps ?? []) {
    for (const visual of step?.visuals ?? []) out.push({ visual, where: step.id ?? 'step' })
  }
  for (const question of t.questions ?? []) {
    if (question?.visual) out.push({ visual: question.visual, where: question.id ?? 'question' })
  }
  return out
}
