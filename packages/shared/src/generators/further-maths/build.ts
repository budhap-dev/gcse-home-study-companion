import type { Question } from '../../content/questions.ts'
import type { Rng } from '../random.ts'
import type { Draft, Generator } from '../types.ts'

type Builder = (r: Rng, slot: Question, turn: number) => Draft

/**
 * One Further Maths generator for several written questions, each routed to its own builder
 * by slot id. maths/formulae.ts has `bySlot`, but it writes subjectId 'maths'.
 */
export function fmBySlot(id: string, topicId: string, builders: Record<string, Builder>): Generator {
  return {
    id,
    subjectId: 'further-maths',
    topicId,
    replaces: Object.keys(builders),
    build(r, slot, turn) {
      const b = builders[slot.id]
      if (!b) throw new Error(`${id} has no builder for ${slot.id}`)
      return b(r, slot, turn)
    },
  }
}

/** Mark-scheme text: negatives with the Unicode minus. */
export const minus = (s: string | number) => String(s).replace(/-/g, '−')
