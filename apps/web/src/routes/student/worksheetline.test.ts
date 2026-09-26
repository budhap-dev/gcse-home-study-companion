import { describe, expect, it } from 'vitest'
import { markedLine } from './Worksheet.tsx'

/**
 * The marked-answer line used to read "Final answer correct: 1 of 1". Both halves come
 * from the same number, because a correct final answer takes the whole question, so the
 * fraction could never say anything but n of n — and most worksheet questions are worth
 * one mark, which made it look like a counter that was stuck.
 */
describe('the line under a marked answer', () => {
  it('never prints a fraction of a number against itself', () => {
    for (const marks of [1, 2, 3, 4, 5]) {
      expect(markedLine(marks, true)).not.toMatch(new RegExp(`${marks}\\D+of\\D+${marks}`))
    }
  })

  it('says what a correct answer earned, in the singular for one mark', () => {
    expect(markedLine(1, true)).toBe('Correct · 1 mark')
    expect(markedLine(3, true)).toBe('Correct · all 3 marks')
  })

  it('leaves a wrong answer to the method marks, without a score', () => {
    expect(markedLine(3, false)).toContain('award your method marks')
    expect(markedLine(3, false)).not.toMatch(/\d/)
  })

  it('gives a recognised part-answer its marks', () => {
    expect(markedLine(2, false, 1)).toBe('Part of the answer matched · 1 of 2 marks. Reveal the solution to see what is missing.')
  })
})
