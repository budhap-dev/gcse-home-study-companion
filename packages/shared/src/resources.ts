import { z } from 'zod'
import { Provenance, RichText, Slug } from './content/common.ts'
import { Visual } from './content/visuals.ts'

/**
 * Reference material a student keeps coming back to: formula sheets, the periodic table,
 * circuit symbols, the electromagnetic spectrum, verb tables. Unlike a topic it teaches
 * nothing new; it gathers in one place what the lessons use, and says plainly whether the
 * exam hands it over or the student must carry it in their head.
 *
 * Nothing here is copied from a board or from Bitesize. AQA's copyright policy says its
 * materials "must not be reproduced on third party websites – in any format", Pearson's
 * allows copies only on a school's own intranet, and the BBC's terms need permission for
 * its diagrams. So every sheet and chart is redrawn here, checked against the board's own
 * PDF, and the card links to that PDF and to Bitesize for further reading.
 */

/**
 * What the exam does with it.
 *
 * - `given`: printed in the paper (the Maths formulae sheet, the Physics equation sheet,
 *   the Chemistry periodic table). The skill is choosing and using it, not recalling it.
 * - `learn`: not printed anywhere in the paper, so it has to be known by heart.
 * - `reference`: neither: a map of the course, such as the set texts or the practicals list.
 */
export const ResourceStatus = z.enum(['given', 'learn', 'reference'])
export type ResourceStatus = z.infer<typeof ResourceStatus>

/** Hosts a link may point at: the boards, the regulator, and BBC Bitesize. */
export const RESOURCE_HOSTS = ['www.aqa.org.uk', 'filestore.aqa.org.uk', 'qualifications.pearson.com', 'www.gov.uk', 'www.bbc.co.uk'] as const

const Link = z.object({
  name: z.string().min(1),
  url: z.url({ protocol: /^https$/ }),
  /** Where in the document: "Appendix 3, page 32", "section 9". */
  where: z.string().min(1).optional(),
})
export type ResourceLink = z.infer<typeof Link>

/** One formula. `formula` is RichText, so it carries its maths between $...$. */
const Formula = z.object({
  name: z.string().min(1),
  formula: RichText,
  /** What each letter stands for, with its unit where it has one. */
  symbols: RichText.optional(),
  /** Higher tier only, the way the Physics sheet marks it HT. */
  higher: z.boolean().default(false),
  /**
   * Set only where it differs from the resource's own status: the Further Maths sheet is
   * given, but the cylinder formulae beside it are not.
   */
  status: ResourceStatus.optional(),
})
export type Formula = z.infer<typeof Formula>

const FormulaeBlock = z.object({
  kind: z.literal('formulae'),
  groups: z.array(z.object({
    title: z.string().min(1),
    /** A group's own colour, for the band down its side. Must hold AA against white. */
    colour: z.string().regex(/^#[0-9a-f]{6}$/i),
    items: z.array(Formula).min(1),
  })).min(1),
})

const TableBlock = z.object({
  kind: z.literal('table'),
  title: z.string().min(1).optional(),
  columns: z.array(z.string().min(1)).min(2),
  /** Cells are RichText, so a formula or a unit in a cell renders as maths. */
  rows: z.array(z.array(z.string())).min(1),
  note: RichText.optional(),
})

const TextBlock = z.object({ kind: z.literal('text'), body: RichText })

/** A drawing from the diagram library, the same kind a lesson step carries. */
const VisualBlock = z.object({ kind: z.literal('visual'), visual: Visual, caption: RichText.optional() })

export const ResourceBlock = z.discriminatedUnion('kind', [FormulaeBlock, TableBlock, TextBlock, VisualBlock])
export type ResourceBlock = z.infer<typeof ResourceBlock>

const ResourceInput = z.object({
  id: Slug,
  title: z.string().min(1),
  /** What it is and when you reach for it, so the card makes sense without a lesson. */
  summary: RichText,
  status: ResourceStatus,
  /** Which year's sheet it follows, or what is and is not on it. Required when given. */
  statusNote: RichText.optional(),
  /** The board's own documents, with the section. */
  sources: z.array(Link).min(1),
  /** Bitesize pages and the like: somewhere else to read about it. */
  furtherReading: z.array(Link).default([]),
  /** Topic ids that use it, most relevant first. */
  topics: z.array(Slug).default([]),
  /** "Where you meet it": a real use, outside the exam, with enough detail to picture. */
  applications: z.array(z.object({ title: z.string().min(1), body: RichText })).default([]),
  /** The resource itself. Empty means it is planned and shown as Coming soon. */
  blocks: z.array(ResourceBlock).default([]),
})

export const Resource = ResourceInput.extend({ subjectId: Slug })
export type Resource = z.infer<typeof Resource>

/**
 * One subject's resources, the unit of authoring and review. As with the glossary, the
 * subject is named once and stamped onto each resource, so the two cannot disagree.
 */
export const ResourceFile = z
  .object({
    subjectId: Slug,
    resources: z.array(ResourceInput).min(1),
    provenance: Provenance,
  })
  .transform((file) => ({
    ...file,
    resources: file.resources.map((r): Resource => ({ ...r, subjectId: file.subjectId })),
  }))
export type ResourceFile = z.infer<typeof ResourceFile>

/** Planned but not yet written: listed, so the whole plan is visible, and marked Coming soon. */
export function isComingSoon(resource: Pick<Resource, 'blocks'>): boolean {
  return resource.blocks.length === 0
}

export const RESOURCE_STATUS_LABEL: Record<ResourceStatus, string> = {
  given: 'Given in the exam',
  learn: 'Learn by heart',
  reference: 'Reference',
}
