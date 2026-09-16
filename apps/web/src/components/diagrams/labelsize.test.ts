import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * No text a diagram draws may be smaller than 11px. Diagram labels are read on a phone,
 * often by a student who is already struggling with the material, and a 9px caption is
 * not text so much as decoration.
 *
 * Eleven components carried 9px or 10px labels until 16 September 2026, and nothing
 * caught it: the labels render correctly, they are simply too small. The browser walk
 * did not catch it either until it started measuring computed font sizes rather than
 * looking for clipped text. This is the cheap source-level lock that stops it coming
 * back; the browser check is what proves the larger text still fits.
 */
const DIR = join(import.meta.dirname)
const FLOOR = 11

describe('diagram label sizes', () => {
  const components = readdirSync(DIR).filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx') && f !== 'index.tsx')

  it('found the components', () => {
    expect(components.length).toBeGreaterThan(20)
  })

  it('never draws text below the readable floor', () => {
    const tooSmall: string[] = []
    for (const file of components) {
      const source = readFileSync(join(DIR, file), 'utf8')
      for (const line of source.split('\n')) {
        for (const m of line.matchAll(/fontSize=(?:"(\d+(?:\.\d+)?)"|\{(\d+(?:\.\d+)?)\})/g)) {
          const size = Number(m[1] ?? m[2])
          if (size < FLOOR) tooSmall.push(`${file}: ${size}px in "${line.trim().slice(0, 60)}"`)
        }
      }
    }
    expect(tooSmall).toEqual([])
  })
})
