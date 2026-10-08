import type { Question } from '../content/questions.ts'
import { compoundInterest, reversePercentage, reversePercentageChoice } from './maths/growth.ts'
import { asAPercentage, fractionOfAnAmount, percentageOfAnAmount } from './maths/percentages.ts'
import { sharingInARatio } from './maths/ratio.ts'
import { trigFindingAnAngle, trigFindingASide } from './maths/trigonometry.ts'
import { rng } from './random.ts'
import type { Generated, Generator } from './types.ts'

export type { Check, Generated, Generator } from './types.ts'

/**
 * Every question generator (GEN-1). Each writes fresh versions of named written questions;
 * generators.test.ts builds 1,000 of each per question it replaces and checks every answer
 * a second way before any of them can reach a student (GEN-2).
 */
export const GENERATORS: Generator[] = [
  percentageOfAnAmount,
  asAPercentage,
  fractionOfAnAmount,
  sharingInARatio,
  trigFindingASide,
  trigFindingAnAngle,
  compoundInterest,
  reversePercentage,
  reversePercentageChoice,
]

const BY_SLOT = new Map(GENERATORS.flatMap((g) => g.replaces.map((id) => [`${g.subjectId}/${g.topicId}/${id}`, g] as const)))

/** The generator that writes fresh versions of a written question, if there is one. */
export function generatorFor(subjectId: string, topicId: string, questionId: string): Generator | undefined {
  return BY_SLOT.get(`${subjectId}/${topicId}/${questionId}`)
}

/**
 * A fresh version of the written question `slot`, built from `seed`.
 *
 * The seed is the attempt's: each slot draws its own numbers from it, so one seed rebuilds
 * a whole worksheet, and the same seed always rebuilds the same one. The question keeps the
 * written one's id, marks, grade band, skill, calculator rule, tags and discriminators.
 */
export function generate(generator: Generator, slot: Question, seed: string): Generated {
  const draft = generator.build(rng(`${seed}:${generator.topicId}:${slot.id}`), slot)
  const kept = {
    id: slot.id,
    marks: slot.marks,
    gradeBand: slot.gradeBand,
    skill: slot.skill,
    calculator: slot.calculator,
    tags: slot.tags,
    discriminators: slot.discriminators,
    ...(slot.boardNotes ? { boardNotes: slot.boardNotes } : {}),
  }
  const b = draft.question
  const common = { ...kept, prompt: b.prompt, solution: b.solution, markScheme: b.markScheme, ...(b.visual ? { visual: b.visual } : {}) }
  const question: Question = b.type === 'numeric'
    ? { ...common, type: 'numeric', answer: b.answer, tolerance: b.tolerance, unitsRequired: false, ...(b.units ? { units: b.units } : {}) }
    : { ...common, type: 'multiple-choice', options: b.options, correct: b.correct }
  return {
    question,
    generatorId: generator.id,
    seed,
    check: draft.check,
    values: draft.values,
    ...(b.type === 'multiple-choice' ? { mistakes: b.mistakes } : {}),
  }
}
