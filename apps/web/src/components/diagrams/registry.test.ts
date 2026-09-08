import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content')
const REGISTRY = join(import.meta.dirname, 'index.tsx')

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? jsonFiles(full) : name.endsWith('.json') ? [full] : []
  })
}

describe('diagram registry', () => {
  it('has a component for every diagram the content names', () => {
    const registered = new Set([...readFileSync(REGISTRY, 'utf8').matchAll(/'([a-z-]+)': [A-Za-z]+,/g)].map((m) => m[1]))
    const used = new Set<string>()
    for (const f of jsonFiles(ROOT)) for (const m of readFileSync(f, 'utf8').matchAll(/"component": "([a-z-]+)"/g)) used.add(m[1]!)
    const missing = [...used].filter((c) => !registered.has(c))
    expect(missing, `content names diagrams with no component: ${missing.join(', ')}`).toEqual([])
  })
})
