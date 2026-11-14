/**
 * Hand-drawn marks in lesson text (backlog section 15, Part C): {{circle|word}},
 * {{underline|a sentence}}, {{highlight|a formula}}. RichText draws them; anything that reads
 * lesson text as words (search, the step a missed question links to, flashcards) takes the
 * words out of the tag with `stripHands`.
 */
export const HAND_TAG = /\{\{(circle|underline|highlight)\|([^{}]+?)\}\}/g
export const HAND_ANY = /\{\{([a-z]+)\|([^{}]*?)\}\}/g

/** The text with each mark's tag removed and its words kept. */
export function stripHands(text: string): string {
  return text.replace(HAND_TAG, '$2')
}
