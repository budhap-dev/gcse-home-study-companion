import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content')
const VISUAL = join(import.meta.dirname, '../Visual.tsx')

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? jsonFiles(full) : name.endsWith('.json') ? [full] : []
  })
}

/**
 * The sibling of the diagram registry test. An interactive kind with no component
 * silently degrades to its fallback paragraph, which looks fine in review and loses
 * the step's whole point: `equation-entry` sat unbuilt in two Maths topics this way.
 */
describe('interactive registry', () => {
  it('has a component for every interactive kind the content names', () => {
    const source = readFileSync(VISUAL, 'utf8')
    const handled = new Set([...source.matchAll(/visual\.kind === '([a-z-]+)'/g)].map((m) => m[1]!))
    const used = new Set<string>()
    for (const f of jsonFiles(ROOT)) {
      for (const m of readFileSync(f, 'utf8').matchAll(/"kind": "([a-z-]+)"/g)) used.add(m[1]!)
    }
    // Only kinds that appear on an interactive block count; step kinds share the key.
    const interactiveKinds = ['slider-graph', 'drag-order', 'drag-match', 'labelling', 'equation-entry']
    const missing = [...used].filter((k) => interactiveKinds.includes(k) && !handled.has(k))
    expect(missing, `content names interactives with no component: ${missing.join(', ')}`).toEqual([])
  })
})
