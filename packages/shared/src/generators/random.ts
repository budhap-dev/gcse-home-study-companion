/**
 * Seeded randomness for the question generators. The same seed always draws the same
 * numbers, so a question can be rebuilt exactly from the seed stored with its attempt.
 * Math.random cannot be used anywhere in a generator for that reason.
 */
export type Rng = () => number

/** FNV-1a, as in sampling.ts, then mulberry32: small, fast and well spread for short seeds. */
export function rng(seed: string): Rng {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A whole number from lo to hi, both included. */
export const int = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))

export const pick = <T>(r: Rng, items: readonly T[]): T => items[Math.floor(r() * items.length)]!

export function shuffle<T>(r: Rng, items: readonly T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/**
 * Draws until `ok` accepts, for numbers that must come out clean: a share that is a whole
 * number of pounds, an answer that does not sit on a rounding boundary. A generator whose
 * conditions can never be met throws rather than looping, and the release check fails.
 */
export function draw<T>(r: Rng, make: (r: Rng) => T, ok: (value: T) => boolean, tries = 500): T {
  for (let i = 0; i < tries; i++) {
    const value = make(r)
    if (ok(value)) return value
  }
  throw new Error(`no acceptable draw in ${tries} tries`)
}
