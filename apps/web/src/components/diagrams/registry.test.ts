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

  it('gives every diagram alt text that could replace the picture', () => {
    // The alt text is what a screen reader hears, and it is also what renders when a
    // component is missing from the registry. Seven diagrams carried a label rather
    // than a description, such as "Graphite: layers of hexagons".
    const thin: string[] = []
    for (const f of jsonFiles(ROOT)) {
      const topic = JSON.parse(readFileSync(f, 'utf8')) as {
        id: string
        lesson: { steps: { id: string; visuals: { type: string; alt?: string }[] }[] }
      }
      for (const step of topic.lesson.steps) {
        for (const v of step.visuals) {
          if (v.type !== 'diagram') continue
          if ((v.alt ?? '').length < 40) thin.push(`${topic.id} ${step.id}: ${JSON.stringify(v.alt)}`)
        }
      }
    }
    expect(thin).toEqual([])
  })
})
