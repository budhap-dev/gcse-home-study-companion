/**
 * Seeded shuffle and sample. The seed is the attempt id, so a retake draws a
 * different set while a refresh of the same attempt keeps the same one.
 */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0
    const j = h % (i + 1)
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

export function sampleQuestions(ids: string[], size: number, seed: string): string[] {
  return seededShuffle(ids, seed).slice(0, Math.min(size, ids.length))
}
