import type { Question } from '../content/questions.ts'
import { compoundInterest, reversePercentage, reversePercentageChoice } from './maths/growth.ts'
import { asAPercentage, fractionOfAnAmount, percentageOfAnAmount } from './maths/percentages.ts'
import { sharingInARatio } from './maths/ratio.ts'
import { trigFindingAnAngle, trigFindingASide } from './maths/trigonometry.ts'
import { boundsGenerators } from './maths/bounds.ts'
import { compoundMeasuresGenerators } from './maths/compoundMeasures.ts'
import { factorsGenerators } from './maths/factors.ts'
import { fractionsGenerators } from './maths/fractions.ts'
import { indicesGenerators } from './maths/indices.ts'
import { proportionGenerators } from './maths/proportion.ts'
import { standardFormGenerators } from './maths/standardForm.ts'
import { unitsGenerators } from './maths/units.ts'
import { equationsGenerators } from './maths/equations.ts'
import { formulaeGenerators } from './maths/formulae.ts'
import { linesGenerators } from './maths/lines.ts'
import { quadraticsGenerators } from './maths/quadratics.ts'
import { sequencesGenerators } from './maths/sequences.ts'
import { surdsGenerators } from './maths/surds.ts'
import { anglesGenerators } from './maths/angles.ts'
import { mensurationGenerators } from './maths/mensuration.ts'
import { similarityGenerators } from './maths/similarity.ts'
import { trianglesGenerators } from './maths/triangles.ts'
import { vectorsGenerators } from './maths/vectors.ts'
import { distributionsGenerators } from './maths/distributions.ts'
import { energyGenerators } from './physics/energy.ts'
import { particleGenerators } from './physics/particles.ts'
import { motionGenerators } from './physics/motion.ts'
import { forceGenerators } from './physics/forces.ts'
import { hookeGenerators } from './physics/hooke.ts'
import { momentGenerators } from './physics/moments.ts'
import { momentumGenerators } from './physics/momentum.ts'
import { pressureGenerators } from './physics/pressure.ts'
import { circuitGenerators } from './physics/circuits.ts'
import { mainsGenerators } from './physics/mains.ts'
import { waveGenerators } from './physics/waves.ts'
import { atomGenerators } from './physics/atoms.ts'
import { formulaGenerators } from './chemistry/formulae.ts'
import { moleGenerators } from './chemistry/moles.ts'
import { reactingGenerators } from './chemistry/reacting.ts'
import { yieldGenerators } from './chemistry/yield.ts'
import { concentrationGenerators } from './chemistry/concentration.ts'
import { gasGenerators } from './chemistry/gases.ts'
import { waterGenerators } from './chemistry/water.ts'
import { acidGenerators } from './chemistry/acids.ts'
import { energyGenerators as chemEnergyGenerators } from './chemistry/energy.ts'
import { rateGenerators } from './chemistry/rates.ts'
import { structureGenerators } from './chemistry/structure.ts'
import { materialGenerators } from './chemistry/materials.ts'
import { microscopyGenerators } from './biology/microscopy.ts'
import { transportGenerators } from './biology/transport.ts'
import { bioenergeticsGenerators } from './biology/bioenergetics.ts'
import { ecologyGenerators } from './biology/ecology.ts'
import { probabilityGenerators } from './maths/probability.ts'
import { setsGenerators } from './maths/sets.ts'
import { statisticsGenerators } from './maths/statistics.ts'
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
  ...fractionsGenerators,
  ...indicesGenerators,
  ...standardFormGenerators,
  ...boundsGenerators,
  ...unitsGenerators,
  ...proportionGenerators,
  ...factorsGenerators,
  ...compoundMeasuresGenerators,
  ...quadraticsGenerators,
  ...surdsGenerators,
  ...formulaeGenerators,
  ...linesGenerators,
  ...sequencesGenerators,
  ...equationsGenerators,
  ...anglesGenerators,
  ...trianglesGenerators,
  ...mensurationGenerators,
  ...similarityGenerators,
  ...vectorsGenerators,
  ...probabilityGenerators,
  ...setsGenerators,
  ...statisticsGenerators,
  ...distributionsGenerators,
  ...energyGenerators,
  ...particleGenerators,
  ...motionGenerators,
  ...forceGenerators,
  ...hookeGenerators,
  ...momentGenerators,
  ...momentumGenerators,
  ...pressureGenerators,
  ...circuitGenerators,
  ...mainsGenerators,
  ...waveGenerators,
  ...atomGenerators,
  ...formulaGenerators,
  ...moleGenerators,
  ...reactingGenerators,
  ...yieldGenerators,
  ...concentrationGenerators,
  ...gasGenerators,
  ...waterGenerators,
  ...acidGenerators,
  ...chemEnergyGenerators,
  ...rateGenerators,
  ...structureGenerators,
  ...materialGenerators,
  ...microscopyGenerators,
  ...transportGenerators,
  ...bioenergeticsGenerators,
  ...ecologyGenerators,
]

const BY_SLOT = new Map(GENERATORS.flatMap((g) => g.replaces.map((id) => [`${g.subjectId}/${g.topicId}/${id}`, g] as const)))

/** The generator that writes fresh versions of a written question, if there is one. */
export function generatorFor(subjectId: string, topicId: string, questionId: string): Generator | undefined {
  return BY_SLOT.get(`${subjectId}/${topicId}/${questionId}`)
}

export interface SheetQuestion {
  question: Question
  /** Present when a generator wrote this question for the attempt. */
  generated?: Generated
}

/**
 * A worksheet's questions for one attempt, in the written order (WKP-2).
 *
 * Without a seed they are the written questions. With one, each written question that has a
 * generator is replaced by a fresh version drawn from the seed, and the rest stay as written:
 * explain questions, proofs and longer problems have no generator and never will.
 */
export function sheetQuestions(subjectId: string, topicId: string, written: Question[], seed?: string): SheetQuestion[] {
  return written.map((question) => {
    const g = seed ? generatorFor(subjectId, topicId, question.id) : undefined
    if (!g) return { question }
    // A draw that finds no acceptable numbers throws. The release check runs fixed seeds, so a
    // rare seed outside them could still hit one (multi-step fractions did, 2 in 3000): the
    // sheet then keeps the written question rather than failing to open.
    try {
      const generated = generate(g, question, seed!)
      return { question: generated.question, generated }
    } catch {
      return { question }
    }
  })
}

/**
 * A fresh version of the written question `slot`, built from `seed`.
 *
 * The seed is the attempt's: each slot draws its own numbers from it, so one seed rebuilds
 * a whole worksheet, and the same seed always rebuilds the same one. The question keeps the
 * written one's id, marks, grade band, skill, calculator rule, tags and discriminators.
 */
export function generate(generator: Generator, slot: Question, seed: string): Generated {
  const start = Math.floor(rng(`${seed}:${generator.id}`)() * 1000)
  const draft = generator.build(rng(`${seed}:${generator.topicId}:${slot.id}`), slot, start + Math.max(0, generator.replaces.indexOf(slot.id)))
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
    : b.type === 'short-text'
      ? { ...common, type: 'short-text', accepted: b.accepted }
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
