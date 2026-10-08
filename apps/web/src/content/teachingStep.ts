import type { Topic as TopicRecord } from '@study/shared'

type Step = TopicRecord['lesson']['steps'][number]
type Question = TopicRecord['questions'][number]

// Words that say nothing about which idea a question is on.
const STOP = new Set(('the and for are but not you your with this that from have has had was were will would what which when where why how who ' +
  'its into than then them they there these those each every some any all can could should may might must use used using find work out ' +
  'give show write state explain describe answer question marks mark one two three four five first second number value correct ' +
  'following below above shown figure diagram table graph student students there here also only more most much many').split(' '))

const words = (s: string | undefined) => (s ?? '')
  .toLowerCase()
  .replace(/\$[^$]*\$/g, ' ')
  .replace(/[^a-zÀ-ɏ]+/g, ' ')
  .split(' ')
  .filter((w) => w.length > 2 && !STOP.has(w))

const isSummary = (s: Step, i: number, steps: Step[]) => s.kind === 'summary' || (i === steps.length - 1 && /summary|recap/i.test(s.title))

/**
 * The lesson step that teaches what a question tests, as a 0-based index, or undefined
 * when no step stands out, in which case a link goes to the start of the lesson as before.
 *
 * First a step whose own check practises the same skill, by name. Otherwise the step
 * whose words the question's skill and prompt share most, counting the skill twice;
 * the summary step is left out, since it mentions everything. Failing that, the step whose
 * words the skill alone shares most, by a wider lead, since a long prompt that sets a scene
 * dilutes the words that name the idea. `bySkill: false` skips the first rule, which is how
 * the word rules' accuracy is measured against the questions the first rule can answer.
 */
export function teachingStep(topic: TopicRecord, q: Pick<Question, 'skill' | 'prompt'>, { bySkill = true, minScore = MIN_SCORE, minMargin = MIN_MARGIN } = {}): number | undefined {
  const steps = topic.lesson.steps
  if (bySkill) {
    const skill = q.skill.trim().toLowerCase()
    const i = steps.findIndex((s) => s.check?.skill?.trim().toLowerCase() === skill)
    if (i >= 0) return i
  }
  const haves = steps.map((s, i) => isSummary(s, i, steps) ? undefined
    : new Set([...words(s.title), ...words(s.title), ...words(s.body), ...words(s.check?.skill), ...words(s.check?.prompt)]))
  const winner = (want: string[], minScore: number, minMargin: number) => {
    if (want.length === 0) return undefined
    let best = -1, bestScore = 0, second = 0
    haves.forEach((have, i) => {
      if (!have) return
      const score = want.filter((w) => have.has(w)).length / want.length
      if (score > bestScore) { second = bestScore; bestScore = score; best = i } else if (score > second) second = score
    })
    // A clear winner only: enough in common, and ahead of the next step.
    return best >= 0 && bestScore >= minScore && bestScore - second >= minMargin ? best : undefined
  }
  return winner([...words(q.skill), ...words(q.skill), ...words(q.prompt)], minScore, minMargin)
    ?? winner(words(q.skill), SKILL_MIN_SCORE, SKILL_MIN_MARGIN)
}

/*
 * Tuned on the pack (27 September 2026) by hiding the skill rule from the 3,776 questions it
 * can place and asking the word rule instead. With a 0.3 lead over the next step it agrees
 * with the skill rule 85% of the time and places 476 of the 2,947 questions the skill rule
 * cannot; a 0.05 lead placed three times as many but agreed only 68% of the time, and a
 * link to the wrong step is worse than a link to the start. teachingstep.test.ts holds it.
 */
export const MIN_SCORE = 0.3
export const MIN_MARGIN = 0.3

/*
 * The skill-only rule (8 October 2026), added when the deeper exam-style questions, whose
 * prompts set a scene before they ask, were placed only one time in four. Measured with
 * every step's check hidden, so that no question can match its own twin by name: at a lead
 * of two thirds the questions it adds agree with the skill rule 83% of the time (135 of 163),
 * better than the main word rule's 77% on the same measure; at a lead of 0.3 they agreed
 * only 70% of the time.
 */
export const SKILL_MIN_SCORE = 0.67
export const SKILL_MIN_MARGIN = 0.67
