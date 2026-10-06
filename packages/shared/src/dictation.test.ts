import { describe, expect, it } from 'vitest'
import { dictationDiff, dictationWords, markDictation } from './dictation.ts'
import { mark } from './marking.ts'
import { Question } from './content/questions.ts'

const SAID = "J'habite à Lyon. Le week-end, on va au marché."

describe('dictation words', () => {
  it('keeps accents, apostrophes and hyphens, and drops case and punctuation', () => {
    expect(dictationWords(SAID)).toEqual(["j'habite", 'à', 'lyon', 'le', 'week-end', 'on', 'va', 'au', 'marché'])
    expect(dictationWords('J’habite **à** Lyon !')).toEqual(["j'habite", 'à', 'lyon'])
  })
})

describe('marking a dictation word by word', () => {
  it('gives full marks for every word, whatever the case and punctuation', () => {
    expect(markDictation(SAID, "j'habite a lyon le week-end on va au marché", 4).correct).toBe(false)
    expect(markDictation(SAID, "j’habite à lyon le week-end on va au marché", 4)).toEqual({ correct: true, marksScored: 4 })
  })

  it('counts a missing accent as a wrong word, and says which', () => {
    const diff = dictationDiff(SAID, "J'habite a Lyon. Le week-end, on va au marche.")
    expect(diff.filter((d) => !d.ok).map((d) => d.word)).toEqual(['à', 'marché'])
    // 7 of 9 words: floor(4 * 7 / 9) = 3.
    expect(markDictation(SAID, "J'habite a Lyon. Le week-end, on va au marche.", 4)).toEqual({ correct: false, marksScored: 3 })
  })

  it('does not shift every later word when one is missed', () => {
    const diff = dictationDiff(SAID, "J'habite à Lyon. Le week-end, va au marché.")
    expect(diff.filter((d) => !d.ok).map((d) => d.word)).toEqual(['on'])
  })

  it('does not pay for padding, and pays nothing for nothing', () => {
    const padded = `${SAID} et et et et et et et et et`
    expect(markDictation(SAID, padded, 4).correct).toBe(false)
    expect(markDictation(SAID, padded, 4).marksScored).toBe(2)
    expect(markDictation(SAID, '', 4)).toEqual({ correct: false, marksScored: 0 })
  })

  it('is what mark() uses for a short-text question that is a dictation', () => {
    const q = Question.parse({
      id: 'd1', type: 'short-text', prompt: 'Write down the sentence you hear, in French.', marks: 4, gradeBand: '6-7', skill: 'dictation',
      solution: 'x', markScheme: [{ code: 'B1', marks: 4, description: 'each word' }], accepted: [SAID], listen: { text: SAID, dictation: true },
    })
    expect(mark(q, "J'habite a Lyon. Le week-end, on va au marche.")).toEqual({ correct: false, marksScored: 3, marksAvailable: 4, missed: [1, 8] })
    expect(mark(q, SAID).correct).toBe(true)
  })

  it('takes another accepted spelling in full', () => {
    const said = "Je voudrais un jus de pomme, s'il vous plaît."
    const q = Question.parse({
      id: 'd2', type: 'short-text', prompt: 'Write down the sentence you hear, in French.', marks: 3, gradeBand: '6-7', skill: 'dictation',
      solution: 'x', markScheme: [{ code: 'B1', marks: 3, description: 'each word' }], accepted: [said, "Je voudrais un jus de pomme, s'il vous plait."], listen: { text: said, dictation: true },
    })
    expect(mark(q, "je voudrais un jus de pomme s'il vous plait")).toEqual({ correct: true, marksScored: 3, marksAvailable: 3 })
  })
})

