/**
 * A dictation (French Paper 2, Section B) written down word for word. It is marked one word
 * at a time: all or nothing would give a student who missed one accent in twelve words the
 * same nought as one who wrote nothing, and tell neither which word went wrong.
 */

/**
 * The words of a sentence as a dictation compares them: lower case, curly apostrophes made
 * straight, punctuation and Markdown emphasis dropped. Accents are kept, because spelling a
 * word is what a dictation tests. Apostrophes and hyphens inside a word stay with it, so
 * "j'habite" and "est-ce" are one word each.
 */
export function dictationWords(text: string): string[] {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[*_]/g, '')
    .replace(/[.,!?;:«»"()–—…]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[-']+|[-]+$/g, ''))
    .filter(Boolean)
}

/** Each word that was read out, and whether the student's answer has it, in order. */
export function dictationDiff(expected: string, given: string): { word: string; ok: boolean }[] {
  const a = dictationWords(expected)
  const b = dictationWords(given)
  // Longest common subsequence, so a missed or extra word does not shift every word after it.
  const n = a.length, m = b.length
  const table = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i]![j] = a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!)
    }
  }
  const out: { word: string; ok: boolean }[] = []
  let i = 0, j = 0
  while (i < n) {
    if (j < m && a[i] === b[j]) { out.push({ word: a[i]!, ok: true }); i++; j++ }
    else if (j < m && table[i]![j + 1]! >= table[i + 1]![j]!) j++
    else { out.push({ word: a[i]!, ok: false }); i++ }
  }
  return out
}

/**
 * Marks for a dictation: full marks only for every word and nothing extra; otherwise the
 * share of the words got right, rounded down, out of the longer of the two (so padding an
 * answer with guesses does not pay), and never all of them.
 */
export function markDictation(expected: string, given: string, marks: number): { correct: boolean; marksScored: number } {
  const diff = dictationDiff(expected, given)
  const right = diff.filter((d) => d.ok).length
  const typed = dictationWords(given).length
  const correct = right === diff.length && typed === diff.length
  if (correct) return { correct, marksScored: marks }
  const of = Math.max(diff.length, typed)
  return { correct, marksScored: of ? Math.min(marks - 1, Math.floor((marks * right) / of)) : 0 }
}
