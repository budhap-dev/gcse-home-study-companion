/**
 * Hand-drawn marks in lesson text (backlog section 15, Part C): {{circle|word}},
 * {{underline|a sentence}}, {{highlight|a formula}}; and, drawn only in the Notebook theme
 * (section 16), {{strike|the mistake|the correction}} and {{caret|missed words}}. Outside
 * Notebook a strike shows only its correction and a caret's words sit in the line, so a
 * sentence must read correctly that way. RichText draws them; anything that reads lesson
 * text as words (search, the step a missed question links to, flashcards) takes the words
 * out of the tag with `stripHands`, which keeps a strike's correction only.
 */
export const HAND_TAG = /\{\{(circle|underline|highlight|strike|caret)\|([^{}]+?)\}\}/g
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

/** A strike's two halves, the mistake and its correction; null unless there are exactly two. */
export function strikeParts(inner: string): [string, string] | null {
  const parts = inner.split('|')
  return parts.length === 2 && parts[0]!.trim() && parts[1]!.trim() ? [parts[0]!, parts[1]!] : null
}

/** The text with each mark's tag removed and its words kept (a strike keeps its correction). */
export function stripHands(text: string): string {
  const p = parkMaths(text)
  return p.restore(p.text.replace(HAND_TAG, (_, kind: string, inner: string) => (kind === 'strike' ? strikeParts(inner)?.[1] ?? inner : inner)))
}
