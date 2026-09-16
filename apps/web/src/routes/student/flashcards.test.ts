import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCards } from './Flashcards.tsx'

const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content')
const topics = readdirSync(ROOT)
  .filter((d) => statSync(join(ROOT, d)).isDirectory())
  .flatMap((d) =>
    readdirSync(join(ROOT, d))
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({ ref: `${d}/${f}`, topic: JSON.parse(readFileSync(join(ROOT, d, f), 'utf8')) })),
  )

/**
 * A flashcard front has to be a prompt. Splitting summary bullets on punctuation alone
 * failed on most of them, because the "**" of a bold run sits between the full stop and
 * the space — so 1031 of the 1843 summary cards in the pack, 56%, fell back to a front
 * reading "Key point 7 of Reactions of acids with metals, bases and carbonates", which
 * asks the reader nothing at all.
 */
describe('flashcard decks', () => {
  it('found the topics', () => {
    expect(topics.length).toBeGreaterThan(100)
  })

  it('never shows a card whose front asks nothing', () => {
    const empty: string[] = []
    for (const { ref, topic } of topics) {
      for (const card of buildCards(topic)) {
        if (/^Key point \d+ of /.test(card.front)) empty.push(`${ref}: ${card.front}`)
      }
    }
    expect(empty).toEqual([])
  })

  it('gives every topic a deck worth opening', () => {
    const thin = topics.map(({ ref, topic }) => ({ ref, n: buildCards(topic).length })).filter((d) => d.n < 8)
    expect(thin, `decks with fewer than 8 cards: ${thin.map((d) => `${d.ref} (${d.n})`).join(', ')}`).toEqual([])
  })

  it('gives every card a front and a back that differ', () => {
    const bad: string[] = []
    for (const { ref, topic } of topics) {
      for (const card of buildCards(topic)) {
        if (!card.front.trim() || !card.back.trim()) bad.push(`${ref} ${card.id}: empty side`)
        else if (card.front.trim() === card.back.trim()) bad.push(`${ref} ${card.id}: front and back are the same`)
      }
    }
    expect(bad).toEqual([])
  })
})
