import type { Question } from '../content/questions.ts'
import type { MarkSchemeLine } from '../content/questions.ts'
import type { Visual } from '../content/visuals.ts'
import type { z } from 'zod'
import type { Rng } from './random.ts'

type Line = z.infer<typeof MarkSchemeLine>

/** The parts of a question a generator writes. The rest comes from the written question it stands in for. */
interface BuiltBase {
  prompt: string
  solution: string
  markScheme: Line[]
  visual?: Visual
}

export interface BuiltNumeric extends BuiltBase {
  type: 'numeric'
  answer: number
  tolerance: number
  units?: string
}

export interface BuiltChoice extends BuiltBase {
  type: 'multiple-choice'
  options: string[]
  correct: number[]
  /**
   * The mistake that leads to each option, by position: null for the right answer. GEN-3: a
   * wrong option is somebody's real slip, so picking it can say which one.
   */
  mistakes: (string | null)[]
}

export type Built = BuiltNumeric | BuiltChoice

/**
 * The generator's own working of the answer by a second route: substituting back, working
 * forwards from the original, another trig ratio. `agrees` is false when the two routes
 * differ, and the release check refuses the generator.
 */
export interface Check {
  agrees: boolean
  detail: string
}

export interface Draft {
  question: Built
  check: Check
  /** The numbers it drew, for a person reading a failure or rebuilding a sheet by hand. */
  values: Record<string, number | string>
}

/**
 * Writes fresh versions of named written questions.
 *
 * A generator stands in for questions already in a topic's bank and keeps each one's id,
 * marks, grade band, skill and discriminators, so a generated question is recorded,
 * reviewed in the mistakes list and counted towards mastery exactly as the written one was.
 * The written question is also the template: `build` receives it and writes a question of
 * the same kind and worth, so a 3-mark slot gets a 3-mark question.
 */
export interface Generator {
  /** Unique across generators: 'trig-finding-a-side'. */
  id: string
  subjectId: string
  topicId: string
  /** Ids, within the topic, of the written questions this generator writes fresh versions of. */
  replaces: string[]
  build(r: Rng, slot: Question): Draft
}

export interface Generated {
  question: Question
  generatorId: string
  seed: string
  check: Check
  values: Draft['values']
  /** Multiple choice only: the named mistake behind each option, null for the right one. */
  mistakes?: (string | null)[]
}
