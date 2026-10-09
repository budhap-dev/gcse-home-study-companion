import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import type { Question } from '../content/questions.ts'
import { generate, generatorFor, sheetQuestions } from './index.ts'

const bank = (subject: string, topic: string): Question[] =>
  JSON.parse(readFileSync(new URL(`../../../../supabase/seed/content/${subject}/${topic}.json`, import.meta.url), 'utf8')).questions

describe('a generator that throws', () => {
  const topic = 'calculating-with-fractions-and-negatives'
  const written = bank('maths', topic).filter((q) => q.id === 'q22')

  it('leaves the written question on the sheet rather than failing to open it', () => {
    const g = generatorFor('maths', topic, 'q22')!
    const spy = vi.spyOn(g, 'build').mockImplementation(() => { throw new Error('no acceptable draw in 500 tries') })
    try {
      const [item] = sheetQuestions('maths', topic, written, 'k7m2qp')
      expect(item!.generated).toBeUndefined()
      expect(item!.question).toBe(written[0])
    } finally {
      spy.mockRestore()
    }
  })

  // Seeds sf-76 and one other in the first 3000 threw before the draw had 5000 tries.
  it('multi-step fractions draws on every seed, including the two that threw', () => {
    const g = generatorFor('maths', topic, 'q22')!
    for (let i = 0; i < 5000; i++) expect(() => generate(g, written[0]!, `sf-${i}`), `sf-${i}`).not.toThrow()
  })

  // zz-4554 threw at 3000 tries; the table drawn first leaves few acceptable readings.
  it('cumulative frequency q8 draws on the seed that threw', () => {
    const t = 'grouped-and-cumulative-frequency'
    const g = generatorFor('maths', t, 'q8')!
    const q8 = bank('maths', t).find((q) => q.id === 'q8')!
    expect(() => generate(g, q8, 'zz-4554')).not.toThrow()
  })
})
