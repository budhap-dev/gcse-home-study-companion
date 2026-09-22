import { z } from 'zod'
import { RichText, Slug } from './common.ts'
import { Question } from './questions.ts'
import { Visual } from './visuals.ts'

export const StepKind = z.enum(['explain', 'worked-example', 'your-turn', 'summary', 'grade-9'])
export type StepKind = z.infer<typeof StepKind>

/**
 * One idea per step, short enough for a phone screen. The visual carries the idea.
 * A check question gates the first pass through; a wrong answer explains and still allows progress.
 */
export const LessonStep = z.object({
  id: Slug,
  kind: StepKind,
  title: z.string().min(1),
  body: RichText,
  visuals: z.array(Visual).min(1, 'every step needs at least one visual'),
  check: Question.optional(),
  /**
   * The specification point this step teaches, in the board's own numbering, such as
   * "1.4.2". A step that belongs to no single point — a recap, a practice task, the
   * summary — leaves it out, which is why it is optional.
   *
   * It has to be one of the topic's own `specPoints`; `spec-numbering.test.ts` holds that.
   */
  specPoint: z.string().min(1).optional(),
})
export type LessonStep = z.infer<typeof LessonStep>

export const Lesson = z.object({
  steps: z.array(LessonStep).min(3),
})
export type Lesson = z.infer<typeof Lesson>

export const WorksheetLevel = z.enum(['core', 'higher', 'advanced'])
export type WorksheetLevel = z.infer<typeof WorksheetLevel>
export const WORKSHEET_LEVELS = WorksheetLevel.options

export const Worksheet = z.object({
  level: WorksheetLevel,
  /** Question ids from the topic's bank, in order. */
  questionIds: z.array(Slug).min(1),
  suggestedMinutes: z.number().int().positive(),
})
export type Worksheet = z.infer<typeof Worksheet>

export const Quiz = z.object({
  /** Pool drawn from on each attempt. */
  questionIds: z.array(Slug).min(1),
  /** Questions per attempt. A different sample is drawn when the pool is larger. */
  sampleSize: z.number().int().min(10).max(20),
})
export type Quiz = z.infer<typeof Quiz>

/** Topic-level note: the mistakes examiners report and what separates a grade 9 answer. */
export const ExamTechniqueNote = z.object({
  body: RichText,
  examinerErrors: z.array(RichText).min(1),
  grade9Looks: RichText,
})
export type ExamTechniqueNote = z.infer<typeof ExamTechniqueNote>
