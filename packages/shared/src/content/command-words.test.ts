import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')
function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? jsonFiles(full) : name.endsWith('.json') ? [full] : []
  })
}

/**
 * A command word used as a label for a kind of question is being quoted, not used as a
 * verb, so it needs marking: "Every *explain* question" rather than "Every explain
 * question", which reads as a sentence that has lost a word. The boards mark them the
 * same way in their own guidance.
 *
 * Which mark depends on where the text goes. Bodies, prompts and solutions render as
 * markdown, so they take italics. Step titles and skill labels render as plain text,
 * where an asterisk would show as an asterisk, so they take quotes.
 */
const COMMAND = 'explain|describe|evaluate|compare|discuss|justify|assess'
const BARE = new RegExp(`(^|[^*'"\\w])(${COMMAND})\\s+(question|answer)s?\\b`, 'i')

/** Every string in the file, with the path that leads to it. */
function* strings(node: unknown, path = ''): Generator<[string, string]> {
  if (typeof node === 'string') yield [path, node]
  else if (Array.isArray(node)) for (const [i, v] of node.entries()) yield* strings(v, `${path}[${i}]`)
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) yield* strings(v, `${path}.${k}`)
}

describe('command words', () => {
  it('are marked when they name a kind of question', () => {
    const bad: string[] = []
    for (const file of jsonFiles(ROOT)) {
      const name = file.split('/').pop()!
      for (const [path, text] of strings(JSON.parse(readFileSync(file, 'utf8')))) {
        // `skill` is a taxonomy label rather than a sentence, so it is left plain.
        if (path.endsWith('.skill')) continue
        const hit = BARE.exec(text)
        if (hit) bad.push(`${name}${path}: "${hit[0].trim()}"`)
      }
    }
    expect(bad).toEqual([])
  })

  /** The detector has to fire, or the test above passes for the wrong reason. */
  it('spots an unmarked one', () => {
    expect(BARE.test('Every explain question wants a chain')).toBe(true)
    expect(BARE.test('In a 12-mark evaluate question, which of these')).toBe(true)
    expect(BARE.test('Every *explain* question wants a chain')).toBe(false)
    expect(BARE.test("How to write an 'evaluate' answer")).toBe(false)
    // Still a verb, not a label.
    expect(BARE.test('Explain why the pressure rises')).toBe(false)
  })
})
