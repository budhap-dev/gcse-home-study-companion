/**
 * Hand-drawn marks in lesson text (backlog section 15, Part C): {{circle|word}},
 * {{underline|a sentence}}, {{highlight|a formula}}. RichText draws them; anything that reads
 * lesson text as words (search, the step a missed question links to, flashcards) takes the
 * words out of the tag with `stripHands`.
 */
export const HAND_TAG = /\{\{(circle|underline|highlight)\|([^{}]+?)\}\}/g
export const HAND_ANY = /\{\{([a-z]+)\|([^{}]*?)\}\}/g

/**
 * Lesson text with its maths parked as tokens, as RichText does before it reads marks, so a
 * highlight round $\frac{a}{b}$ is one tag and its braces are not read as one. `restore`
 * puts the maths back.
 */
export function parkMaths(text: string): { text: string; restore: (s: string) => string } {
  const kept: string[] = []
  const parked = text.replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g, (m) => `\u0000${kept.push(m) - 1}\u0000`)
  return { text: parked, restore: (s) => s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => kept[Number(i)] ?? '') }
}

/** The text with each mark's tag removed and its words kept. */
export function stripHands(text: string): string {
  const p = parkMaths(text)
  return p.restore(p.text.replace(HAND_TAG, '$2'))
}
