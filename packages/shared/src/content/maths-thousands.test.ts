import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A thousands separator inside maths. KaTeX reads a comma in maths mode as punctuation and
 * puts a space after it, so $10,000$ printed as "10, 000" (choices-and-outcomes, physics,
 * business: 83 of them, 8 October 2026). The pack writes 10\,000, a thin space, as print
 * does. The reverse slip is as bad: outside maths a \, is printed as it stands.
 */
const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')
const SPANS = /(?<!\\)\$\$([\s\S]+?)(?<!\\)\$\$|(?<!\\)\$([^$]+?)(?<!\\)\$/g
const COMMA = /\d,\d{3}(?!\d)/

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

describe('large numbers in maths', () => {
  const all = files(ROOT).flatMap((f) => [...strings(JSON.parse(readFileSync(f, 'utf8')), f.slice(ROOT.length + 1))])

  it('found the pack, and the thin spaces it uses', () => {
    expect(all.length).toBeGreaterThan(10000)
    expect(all.some(([, s]) => /\$[^$]*\d\\,\d{3}[^$]*\$/.test(s))).toBe(true)
  })

  it('separate thousands with a thin space inside maths, never a comma', () => {
    const bad = all.flatMap(([where, s]) => [...s.matchAll(SPANS)].map((m) => m[1] ?? m[2]!).filter((body) => COMMA.test(body)).map((body) => `${where}: ${body.slice(0, 60)}`))
    expect(bad).toEqual([])
  })

  it('never print a thin space outside maths, where it would show as a backslash', () => {
    const bad = all.filter(([, s]) => /\d\\,\d/.test(s.replace(SPANS, ''))).map(([where, s]) => `${where}: ${s.slice(0, 60)}`)
    expect(bad).toEqual([])
  })
})
