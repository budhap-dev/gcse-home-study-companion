import { z } from 'zod'
import { Calculator, Discriminator, GradeBand, RichText, Slug } from './common.ts'
import { Visual } from './visuals.ts'

/** One line of a mark scheme in the board's style: M for method, A for accuracy, B for independent, C for communication. */
export const MarkSchemeLine = z.object({
  code: z.string().regex(/^[MABC]\d+$/, 'M1, A1, B1, or C1 style code'),
  marks: z.number().int().positive(),
  description: RichText,
})

const base = {
  id: Slug,
  prompt: RichText,
  marks: z.number().int().positive(),
  gradeBand: GradeBand,
  skill: z.string().min(1),
  calculator: Calculator.default('either'),
  tags: z.array(z.string().min(1)).default([]),
  boardNotes: z.string().optional(),
  /** Full worked solution, shown after marking. */
  solution: RichText,
  markScheme: z.array(MarkSchemeLine).min(1),
  discriminators: z.array(Discriminator).default([]),
  /** Optional visual shown with the prompt: a graph, a diagram, a data table image. */
  visual: Visual.optional(),
}

const MultipleChoice = z.object({
  ...base,
  type: z.literal('multiple-choice'),
  options: z.array(RichText).min(2).max(6),
  correct: z.array(z.number().int().min(0)).min(1),
})

const Numeric = z.object({
  ...base,
  type: z.literal('numeric'),
  answer: z.number(),
  /** Absolute tolerance. Zero means exact. */
  tolerance: z.number().min(0).default(0),
  units: z.string().optional(),
  /** Whether the student must give the units for full marks. */
  unitsRequired: z.boolean().default(false),
})

const ShortText = z.object({
  ...base,
  type: z.literal('short-text'),
  /** Accepted answers, compared case- and whitespace-insensitively. */
  accepted: z.array(z.string().min(1)).min(1),
  /**
   * Letter case is part of the answer: a character code or a program's output, where
   * 'T' (84) and 't' (116) are different answers. The marker otherwise folds case, which
   * marked a student typing "t" right on a question about telling the two apart. The
   * breaks between words count as well, since "Hi Amy!" and "HiAmy!" are different output.
   */
  matchCase: z.boolean().optional(),
  /**
   * Answers that earn some of the marks but not all: half of a two-part answer. An entry in
   * `accepted` pays every mark, so a part-answer there paid 2 of 2 for naming only the
   * hydrogen; here it pays what the mark scheme gives it.
   */
  partial: z.array(z.object({ answer: z.string().min(1), marks: z.number().int().positive() })).min(1).optional(),
})

const Ordering = z.object({
  ...base,
  type: z.literal('ordering'),
  /** Items in the correct order. The app shuffles them. */
  items: z.array(RichText).min(3),
})

const Labelling = z.object({
  ...base,
  type: z.literal('labelling'),
  visual: Visual,
  labels: z
    .array(
      z.object({
        id: Slug,
        text: z.string().min(1),
        /** Position of the label target as a fraction of the visual's width and height. */
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
      }),
    )
    .min(2),
})

/** Six-mark style responses. Self-assessed against the criteria; stored as self-marked. */
const Extended = z.object({
  ...base,
  type: z.literal('extended'),
  suggestedMinutes: z.number().int().positive(),
  criteria: z.array(z.object({ text: RichText, marks: z.number().int().positive() })).min(1),
  modelAnswer: RichText,
})

export const Question = z.discriminatedUnion('type', [MultipleChoice, Numeric, ShortText, Ordering, Labelling, Extended])
export type Question = z.infer<typeof Question>
export type QuestionType = Question['type']

export const AUTO_MARKED_TYPES: QuestionType[] = ['multiple-choice', 'numeric', 'short-text', 'ordering', 'labelling']

export function isAutoMarked(question: Question): boolean {
  return AUTO_MARKED_TYPES.includes(question.type)
}
