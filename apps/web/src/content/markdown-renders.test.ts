import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderRichText } from '../components/RichText.tsx'

const ROOT = join(import.meta.dirname, '../../../../supabase/seed')

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const full = join(dir, n)
    return statSync(full).isDirectory() ? jsonFiles(full) : n.endsWith('.json') ? [full] : []
  })
}

function* strings(node: unknown, path = ''): Generator<[string, string]> {
  if (typeof node === 'string') yield [path, node]
  else if (Array.isArray(node)) for (const [i, v] of node.entries()) yield* strings(v, `${path}[${i}]`)
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) yield* strings(v, `${path}.${k}`)
}

/** Diagram props and alt text are drawn as plain text and never parsed as markdown. */
const isMarkdown = (path: string) => !path.includes('.props.') && !path.endsWith('.alt')

/**
 * Bold that never closes renders as a literal `**` on the page. CommonMark will not close
 * a `**` run that is preceded by punctuation and followed immediately by a letter, which
 * is exactly what French elision produces: `**d'**acheter`, `**qu'**il`, `**n'**y`. That
 * shipped in 21 places across every French topic, and no per-string test could see it —
 * the source looks right, and only rendering shows the fault. Write those as
 * `<strong>d'</strong>acheter`, which RichText passes through as trusted repo HTML.
 */
describe('content markdown renders', () => {
  const all = jsonFiles(ROOT).flatMap((f) => {
    const name = f.split('supabase/seed/')[1]!
    return [...strings(JSON.parse(readFileSync(f, 'utf8')))]
      .filter(([path]) => isMarkdown(path))
      .map(([path, src]) => ({ where: `${name}${path}`, src }))
  })

  it('found the content', () => {
    expect(all.length).toBeGreaterThan(10000)
  })

  it('leaves no unclosed bold anywhere', () => {
    const bad = all
      .filter(({ src }) => src.includes('**'))
      .filter(({ src }) => renderRichText(src).replace(/<code>[\s\S]*?<\/code>/g, '').includes('**'))
      .map(({ where, src }) => `${where}: ${src.slice(0, 80)}`)
    expect(bad).toEqual([])
  })

  it('leaves no unclosed maths span anywhere', () => {
    const bad = all
      .filter(({ src }) => (src.match(/(?<!\\)\$/g) ?? []).length % 2 === 1)
      .map(({ where, src }) => `${where}: ${src.slice(0, 80)}`)
    expect(bad).toEqual([])
  })
})
