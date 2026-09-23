import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A number printed straight from floating-point arithmetic: 14.999999999999991% for 15%,
 * 2.4000000000000004 for 2.4. The generators compute their figures, which is right, and
 * one that formats the result without rounding it writes the binary residue into the
 * worked example, the solution and the mark scheme. Biology's osmosis topic carried it
 * twelve times, in text a student reads, and Chemistry had one before that. Every copy
 * read perfectly well to the eye that wrote it, because the number is almost right.
 *
 * One occurrence is the subject itself: the Maths topic explaining why 0.1 + 0.2 is not
 * 0.3 in a computer has to print the residue to make its point.
 */
const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')

const RESIDUE = /\d+\.\d*?(?:0{8,}[1-9]|9{8,})\d*/
const DELIBERATE = new Set(['0.30000000000000004'])

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? files(full) : name.endsWith('.json') ? [full] : []
  })
}

function* leaves(node: unknown, path: string): Generator<[string, string]> {
  if (typeof node === 'string' || typeof node === 'number') yield [path, String(node)]
  else if (Array.isArray(node)) for (const [i, v] of node.entries()) yield* leaves(v, `${path}[${i}]`)
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) yield* leaves(v, `${path}.${k}`)
}

describe('printed numbers', () => {
  const all = files(ROOT)

  it('found the content pack', () => {
    expect(all.length).toBeGreaterThan(200)
  })

  it('carry no floating-point residue', () => {
    const bad: string[] = []
    for (const f of all) {
      for (const [path, text] of leaves(JSON.parse(readFileSync(f, 'utf8')), '')) {
        const hit = text.match(RESIDUE)?.[0]
        if (hit && !DELIBERATE.has(hit)) bad.push(`${f.split('/content/')[1]} ${path}: ${hit}`)
      }
    }
    expect(bad, bad.join('\n')).toEqual([])
  })
})
