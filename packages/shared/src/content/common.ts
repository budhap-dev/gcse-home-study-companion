import { z } from 'zod'

/** Stable, URL-safe identifier: lower-case letters, digits, hyphens. */
export const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lower-case words joined by hyphens')

/**
 * Markdown with inline maths between $...$ and display maths between $$...$$.
 * Rendered with KaTeX in the app and in print.
 */
export const RichText = z.string().min(1)

export const GradeBand = z.enum(['4-5', '6-7', '8-9'])
export type GradeBand = z.infer<typeof GradeBand>

export const Calculator = z.enum(['calculator', 'non-calculator', 'either'])

/** Patterns boards use to separate grade 9 from grade 7. Required on every grade 8 to 9 question. */
export const Discriminator = z.enum(['multi-topic', 'unfamiliar-context', 'show-that', 'proof', 'evaluate'])
export type Discriminator = z.infer<typeof Discriminator>

/** Who produced a content version. A model draft can never publish without a reviewer. */
export const Provenance = z.object({
  draftedBy: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('person'), name: z.string().min(1) }),
    z.object({ kind: z.literal('model'), model: z.string().min(1), promptVersion: z.string().min(1) }),
  ]),
  reviewedBy: z.string().min(1).optional(),
  reviewedAt: z.iso.datetime().optional(),
})
export type Provenance = z.infer<typeof Provenance>
