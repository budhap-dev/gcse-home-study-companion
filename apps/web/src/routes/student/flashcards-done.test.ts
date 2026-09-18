import { describe, expect, it } from 'vitest'
import { wellDone } from './Flashcards.tsx'

/**
 * The ending has to tell the truth. A student who needed three passes through the deck
 * knows they needed three passes, and being told "perfect" anyway is how an app stops
 * being believed about anything.
 */
describe('wellDone', () => {
  it('celebrates a clean run, where turns equal cards', () => {
    expect(wellDone(20, 20).line).toContain('first time')
  })

  it('is warm but honest when a couple came back', () => {
    expect(wellDone(20, 22).line).toContain('couple')
  })

  it('credits the effort on a deck that took real work', () => {
    expect(wellDone(20, 32).line).toContain('worked for that')
  })

  /** More repeats than cards is a hard deck, and saying so is more use than praise. */
  it('suggests coming back tomorrow after a hard deck', () => {
    expect(wellDone(20, 45).line).toContain('tomorrow')
  })

  it('always gives an emoji to go with the line', () => {
    for (const turns of [20, 21, 30, 60]) expect(wellDone(20, turns).emoji).toBeTruthy()
  })

  it('does not fall over on an empty deck', () => {
    expect(wellDone(0, 0).line).toBeTruthy()
  })
})
