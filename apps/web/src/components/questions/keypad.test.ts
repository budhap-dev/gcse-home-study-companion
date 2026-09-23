import { describe, expect, it } from 'vitest'
import { keypadFor } from './QuestionInput.tsx'

const shortText = (prompt: string, accepted: string[]) =>
  ({ id: 'q1', type: 'short-text', prompt, accepted, marks: 1, gradeBand: '4-5', skill: 's', calculator: 'either', tags: [], solution: 's', markScheme: [], discriminators: [] }) as unknown as Parameters<typeof keypadFor>[0]

describe('keypadFor', () => {
  it('gives an exact-form answer the maths keypad', () => {
    expect(keypadFor(shortText('Write √48 in simplest form.', ['4√3']), 'maths')).toBe('algebra')
  })

  it('leaves a ratio on the text keyboard, because the maths keypad has no colon', () => {
    expect(keypadFor(shortText('Write 6 : 20 in its simplest form.', ['3:10', '3 : 10']), 'maths')).toBeUndefined()
  })
})
