import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A generator template's placeholder left in the text. The English generators build prose
 * from named slots, and one, {SE_FELLOWS}, shipped verbatim in a lesson on Mary Seacole,
 * found in the English review pass on 25 September 2026. Every other test passed, because
 * the braces are valid text.
 *
 * Maths and chemistry put braces in LaTeX ($\mathrm{H_2O}$, \text{BMI}), so maths spans are
 * removed first and a brace group straight after a command or a letter is not a slot.
 */
const ROOT = join(import.meta.dirname, '../../../../supabase/seed')

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

describe('content text', () => {
  const all = files(ROOT)

  it('found the content pack', () => {
    expect(all.length).toBeGreaterThan(200)
  })

  it('has no template placeholder left in it', () => {
    const bad: string[] = []
    for (const f of all) {
      for (const [path, text] of strings(JSON.parse(readFileSync(f, 'utf8')), '')) {
        const prose = text.replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g, '')
        for (const m of prose.matchAll(/(?<![\\A-Za-z_^])\{[A-Z][A-Z0-9_]{2,}\}/g)) bad.push(`${f.split('/seed/')[1]} ${path}: ${m[0]}`)
      }
    }
    expect(bad, bad.join('\n')).toEqual([])
  })
})
