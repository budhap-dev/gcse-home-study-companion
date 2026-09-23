import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import katex from 'katex'
import { describe, expect, it } from 'vitest'

/**
 * Every maths span in the content pack must parse. RichText renders with
 * `throwOnError: false`, which is right for a student (one bad command should not blank a
 * page), but it means a command KaTeX does not know is drawn as its own source in red and
 * nothing else notices. Three microscope solutions wrote the micro sign as
 * `\unicode{181}`, a MathJax command KaTeX has never had, so "2 µm = 0.002 mm" printed an
 * error where the unit should be.
 *
 * The spans are found exactly as RichText finds them: an escaped dollar is currency, then
 * display maths, then inline.
 */
const ROOT = join(import.meta.dirname, '../../../../supabase/seed')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? files(full) : name.endsWith('.json') ? [full] : []
  })
}

function strings(node: unknown, path: string, out: [string, string][]): [string, string][] {
  if (typeof node === 'string') out.push([path, node])
  else if (Array.isArray(node)) node.forEach((v, i) => strings(v, `${path}[${i}]`, out))
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) strings(v, `${path}.${k}`, out)
  return out
}

function spans(source: string): [string, boolean][] {
  const found: [string, boolean][] = []
  source
    .replace(/\\\$/g, '')
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) => (found.push([tex, true]), ''))
    .replace(/\$([^$\n]+?)\$/g, (_, tex: string) => (found.push([tex, false]), ''))
  return found
}

describe('maths in the content pack', () => {
  const all = files(ROOT).flatMap((f) => strings(JSON.parse(readFileSync(f, 'utf8')), f.split('/seed/')[1]!, []))
  const maths = all.flatMap(([path, s]) => spans(s).map(([tex, display]) => ({ path, tex, display })))

  it('found the maths', () => {
    // A scanner that finds nothing passes by default; the pack has over 20 000 spans.
    expect(maths.length).toBeGreaterThan(15000)
  })

  it('parses in KaTeX without an error', () => {
    const bad: string[] = []
    for (const { path, tex, display } of maths) {
      try {
        katex.renderToString(tex, { displayMode: display, throwOnError: true, strict: 'ignore' })
      } catch (e) {
        bad.push(`${path}: ${(e as Error).message.slice(0, 100)}`)
      }
    }
    expect(bad, bad.join('\n')).toEqual([])
  })
})
