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
