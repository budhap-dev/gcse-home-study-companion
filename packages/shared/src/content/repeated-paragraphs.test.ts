import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The same paragraph twice in one piece of text. Content edits are made by scripts that
 * insert a new paragraph after an old one, and a script that looks for the old text
 * before checking whether the new text is already there inserts it again on every run.
 * One run too many put the Bunsen burner bullet six times into the antibiotics practical,
 * and the algal-balls method six times into the photosynthesis one. Every other test
 * passed, because each copy was individually correct.
 *
 * Short lines repeat legitimately (a heading, "Your turn"), so only lines long enough to
 * be a sentence of teaching count.
 */
const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')
const LONG = 60

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? files(full) : name.endsWith('.json') ? [full] : []
  })
}

function* strings(node: unknown, path: string): Generator<[string, string]> {
  if (typeof node === 'string') yield [path, node]
  else if (Array.isArray(node)) for (const [i, v] of node.entries()) yield* strings(v, `${path}[${i}]`)
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) yield* strings(v, `${path}.${k}`)
}

describe('a piece of text', () => {
  const all = files(ROOT)

  it('found the content pack', () => {
    expect(all.length).toBeGreaterThan(200)
  })

  it('never repeats one of its own paragraphs', () => {
    const bad: string[] = []
    for (const f of all) {
      for (const [path, text] of strings(JSON.parse(readFileSync(f, 'utf8')), '')) {
        const seen = new Set<string>()
        for (const line of text.split('\n').map((l) => l.trim()).filter((l) => l.length > LONG)) {
          if (seen.has(line)) bad.push(`${f.split('/content/')[1]} ${path}: ${line.slice(0, 70)}`)
          seen.add(line)
        }
      }
    }
    expect(bad, bad.join('\n')).toEqual([])
  })
})
