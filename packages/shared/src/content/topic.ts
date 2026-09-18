import { z } from 'zod'
import { Provenance, RichText, Slug } from './common.ts'
import { ExamTechniqueNote, Lesson, Quiz, Worksheet } from './lesson.ts'
import { Visual } from './visuals.ts'
import { Question } from './questions.ts'

/**
 * The unit of authoring and of progress. Everything a student sees for one topic
 * lives here: lesson, three worksheets, exam technique note, quiz, and the question
 * bank they draw from. Publishing freezes a version; attempts reference that version.
 */
export const Topic = z.object({
  id: Slug,
  subjectId: Slug,
  unitId: Slug,
  title: z.string().min(1),
  /** Specification references this topic covers, in the board's numbering. */
  specPoints: z.array(z.string().min(1)).min(1),
  /** Position within the unit in the school's teaching order. Topics without one sort last, by title. */
  order: z.number().int().positive().optional(),
  /**
   * The school year in which the class is taught this topic, from the curriculum
   * overviews in `docs/curriculum`. A topic from an earlier year stays in the app as
   * recap, because the synoptic tests and milestones keep re-testing it.
   */
  year: z.union([z.literal(9), z.literal(10), z.literal(11)]),
  /** Outside places to practise this topic, shown on the topic page as links that open in a new tab. */
  resources: z.array(z.object({ label: z.string().min(1), url: z.string().url(), note: z.string().optional() })).optional(),
  /** Shown or hidden by the student's chosen board when a topic is board-specific. */
  boards: z.array(z.string().min(1)).optional(),
  /**
   * Short, practical tips: how to remember something, how to recognise which method a
   * question wants, a faster route, or a way to check an answer. Kept separate from the
   * lesson so a student can reread them in a minute before a test, and separate from
   * examinerErrors, which say what goes wrong rather than what to do.
   */
  tips: z
    .array(
      z.object({
        kind: z.enum(['remember', 'spot', 'shortcut', 'check']),
        title: z.string().min(1),
        body: RichText,
      }),
    )
    .optional(),
  /**
   * Why the topic exists, and where the idea shows up outside a classroom.
   *
   * The pack is good at *how* and was nearly silent on *why*: a student could finish
   * differentiation able to turn 5x⁴ into 20x³ and not know what a derivative is for.
   * `matters` answers the question the lesson assumes; `examples` are the two or three
   * places the idea is met, each with a picture of the situation rather than of the
   * algebra. Designed in docs/real-world-examples.md.
   *
   * Optional, because it is being rolled out across topics written before it existed,
   * and because some topics — exam technique, dictation — honestly have no everyday
   * example, and a forced one is worse than none.
   */
  why: z
    .object({
      matters: RichText,
      examples: z
        .array(
          z.object({
            /** The concrete noun: "The door handle", never "Application 1". */
            title: z.string().min(1),
            body: RichText,
            /** A picture of the situation. The Visual union, so no new machinery. */
            visual: Visual.optional(),
          }),
        )
        .max(3)
        .default([]),
    })
    .optional(),
  lesson: Lesson,
  questions: z.array(Question).min(1),
  worksheets: z.object({ core: Worksheet, higher: Worksheet, advanced: Worksheet }),
  examTechnique: ExamTechniqueNote,
  quiz: Quiz,
  provenance: Provenance,
})
export type Topic = z.infer<typeof Topic>

/** Subject-level exam technique guide: papers, timing, command words, and what a grade 9 answer looks like. */
export const SubjectGuide = z.object({
  subjectId: Slug,
  papers: z
    .array(
      z.object({
        name: z.string().min(1),
        marks: z.number().int().positive(),
        /** Omitted for a non-examined component: coursework has no exam duration. */
        minutes: z.number().int().positive().optional(),
        calculator: z.boolean(),
        covers: z.string().min(1),
      }),
    )
    .min(1),
  commandWords: z.array(z.object({ word: z.string().min(1), meaning: z.string().min(1) })).min(1),
  assessmentObjectives: z.array(z.object({ code: z.string().min(1), weight: z.number().min(0).max(100), meaning: z.string().min(1) })).min(1),
  grade9ByQuestionType: z.array(z.object({ questionType: z.string().min(1), looksLike: z.string().min(1) })).min(1),
  provenance: Provenance,
})
export type SubjectGuide = z.infer<typeof SubjectGuide>
