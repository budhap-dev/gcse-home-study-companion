import type { z } from 'zod'
import type { MarkSchemeLine, Question } from '../content/questions.ts'

type Line = z.infer<typeof MarkSchemeLine>

/**
 * A mark scheme worth what the written question it stands in for is worth.
 *
 * One mark is a B1 for the answer. More is method marks then an A1, as the pack writes
 * them: a 3-mark slot takes the first two method lines. A generator offering fewer method
 * lines than the slot needs throws, so the release check catches a 3-mark slot given to a
 * generator that can only justify 2.
 */
export function scheme(slot: Question, method: string[], answer: string): Line[] {
  if (slot.marks === 1) return [{ code: 'B1', marks: 1, description: answer }]
  const wanted = slot.marks - 1
  if (wanted > method.length) {
    throw new Error(`${slot.id} is worth ${slot.marks} marks but the generator has ${method.length} method marks`)
  }
  return [...method.slice(0, wanted).map((description) => ({ code: 'M1', marks: 1, description })), { code: 'A1', marks: 1, description: answer }]
}
