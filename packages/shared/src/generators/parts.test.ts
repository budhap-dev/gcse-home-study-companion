import { describe, expect, it } from 'vitest'
import type { Question } from '../content/questions.ts'
import { generate } from './index.ts'
import { int } from './random.ts'
import type { Generator } from './types.ts'

/**
 * A generator for a multi-part question writes each part from the same draw, so (a) and (b)
 * ask about one trolley. It draws its figures first and only then looks at the part.
 */
const trolley: Generator = {
  id: 'test-trolley',
  subjectId: 'physics',
  topicId: 'test',
  replaces: ['q1', 'q2'],
  build(r, slot) {
    const m = int(r, 2, 9)
    const f = m * int(r, 2, 6)
    const stem = `A ${m} kg trolley is pushed with a resultant force of ${f} N.`
    const a = f / m
    const prompt = slot.id === 'q1' ? 'Calculate its acceleration.' : 'Calculate the force needed for twice that acceleration.'
    const answer = slot.id === 'q1' ? a : 2 * f
    return {
      question: { type: 'numeric', prompt, answer, tolerance: 0, solution: `${answer}`, markScheme: [{ code: 'B1', marks: 1, description: `${answer}` }], stem },
      check: { agrees: true, detail: '' },
      values: { m, f },
    }
  },
}

const part = (id: string, part: string): Question => ({
  id, type: 'numeric', prompt: 'written', marks: 1, gradeBand: '6-7', skill: 'F = ma', calculator: 'either', tags: [],
  solution: 'written', markScheme: [{ code: 'B1', marks: 1, description: 'written' }], discriminators: [],
  answer: 3, tolerance: 0, unitsRequired: false, context: 'trolley',
  stem: { id: 'trolley', part, parts: 2, body: 'A 2 kg trolley is pushed with a resultant force of 6 N.' },
})

describe('generated parts of a multi-part question', () => {
  it('share one draw, so every part prints the same stem and keeps its letter', () => {
    for (let i = 0; i < 200; i++) {
      const [a, b] = [part('q1', 'a'), part('q2', 'b')].map((q) => generate(trolley, q, `seed-${i}`).question)
      expect(a!.stem!.body).toBe(b!.stem!.body)
      expect([a!.stem!.part, b!.stem!.part]).toEqual(['a', 'b'])
      expect(a!.context).toBe('trolley')
    }
  })

  it('redraw every part together when the stem repeats the written figures', () => {
    const written = part('q1', 'a').stem!.body
    for (let i = 0; i < 200; i++) {
      const [a, b] = [part('q1', 'a'), part('q2', 'b')].map((q) => generate(trolley, q, `seed-${i}`, { avoid: [written] }).question)
      expect(a!.stem!.body).toBe(b!.stem!.body)
    }
  })
})
