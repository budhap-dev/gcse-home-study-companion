import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DIAGRAMS } from './index.tsx'

const HERE = import.meta.dirname
const CONTENT = join(HERE, '../../../../../supabase/seed/content')

/**
 * Every prop name a component actually reads, taken from its source. Components read
 * their props as `props.name`, so the source is the honest record of what they support.
 */
function propsRead(componentName: string): Set<string> {
  const file = readdirSync(HERE).find((f) => f === `${componentName}.tsx`)
  if (!file) return new Set()
  const src = readFileSync(join(HERE, file), 'utf8')
  return new Set([...src.matchAll(/\bprops\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]))
}

/** componentName as written in index.tsx, for each registered content key. */
function componentFileNames(): Map<string, string> {
  const src = readFileSync(join(HERE, 'index.tsx'), 'utf8')
  const out = new Map<string, string>()
  for (const m of src.matchAll(/'([a-z0-9-]+)':\s*([A-Za-z]\w*),/g)) out.set(m[1], m[2])
  return out
}

/**
 * The declared shape of each prop a component reads as a typed array, taken from its
 * source: `props.curves as Curve[]` plus `interface Curve { a: number; b: number }`
 * yields curves -> the required keys a and b. Keys written `x?:` are optional.
 */
function requiredKeysByProp(componentName: string): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const file = readdirSync(HERE).find((f) => f === `${componentName}.tsx`)
  if (!file) return out
  const src = readFileSync(join(HERE, file), 'utf8')
  const interfaces = new Map<string, string[]>()
  for (const m of src.matchAll(/interface\s+(\w+)\s*\{([^}]*)\}/g)) {
    const keys: string[] = []
    for (const line of m[2].split('\n')) {
      const k = /^\s*(\w+)(\??)\s*:/.exec(line)
      if (k && k[2] !== '?') keys.push(k[1])
    }
    interfaces.set(m[1], keys)
  }
  for (const m of src.matchAll(/props\.(\w+)\s+as\s+(\w+)\[\]/g)) {
    const keys = interfaces.get(m[2])
    if (keys?.length) out.set(m[1], keys)
  }
  return out
}

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? jsonFiles(full) : name.endsWith('.json') ? [full] : []
  })
}

interface Visual { type?: string; component?: string; props?: Record<string, unknown> }
const used: { file: string; step: string; component: string; keys: string[]; props?: Record<string, unknown> }[] = []
for (const file of jsonFiles(CONTENT)) {
  const topic = JSON.parse(readFileSync(file, 'utf8'))
  for (const step of topic.lesson?.steps ?? []) {
    for (const v of (step.visuals ?? []) as Visual[]) {
      if (v.type !== 'diagram' || !v.component) continue
      used.push({ file: file.split('/').pop()!, step: step.id, component: v.component, keys: Object.keys(v.props ?? {}), props: v.props })
    }
  }
}

/**
 * A diagram whose props the component never reads draws its default instead: usually an
 * empty pair of axes. Nothing else catches it — the page renders, the bundle builds and
 * the browser walk sees a valid SVG — so two reaction profiles shipped as blank graphs
 * because they passed `series`, which LineGraph does not read. The content is then
 * saying one thing and the picture showing another, which is the failure this whole
 * diagram library exists to prevent.
 */
describe('diagram props', () => {
  const files = componentFileNames()

  it('names a component that exists for every diagram in the content', () => {
    const bad = used.filter((u) => !(u.component in DIAGRAMS)).map((u) => `${u.file} ${u.step}: ${u.component}`)
    expect([...new Set(bad)]).toEqual([])
  })

  it('passes only props the component actually reads', () => {
    const bad: string[] = []
    for (const u of used) {
      const componentName = files.get(u.component)
      if (!componentName) continue
      const known = propsRead(componentName)
      // A component with no `props.x` access at all is a fixed reference card, which
      // legitimately takes none.
      if (known.size === 0) continue
      for (const key of u.keys) {
        if (!known.has(key)) bad.push(`${u.file} ${u.step}: <${u.component}> was given "${key}", which ${componentName} never reads`)
      }
    }
    expect(bad).toEqual([])
  })

/**
   * A prop can have the right name and the wrong shape, which the check above cannot
   * see. A quadratic passed to line-graph as a list of points rather than as its
   * coefficients was accepted silently: the axes and the labelled points drew, and the
   * curve did not. So each array prop's entries are checked against the interface the
   * component declares for it.
   */
  it('passes each array prop in the shape the component declares', () => {
    const bad: string[] = []
    for (const u of used) {
      const componentName = files.get(u.component)
      if (!componentName) continue
      const shapes = requiredKeysByProp(componentName)
      for (const [prop, keys] of shapes) {
        const value = u.props?.[prop]
        if (!Array.isArray(value)) continue
        for (const [i, entry] of value.entries()) {
          if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
            bad.push(`${u.file} ${u.step}: <${u.component}> ${prop}[${i}] is not an object`)
            continue
          }
          for (const k of keys) {
            if (!(k in (entry as Record<string, unknown>))) {
              bad.push(`${u.file} ${u.step}: <${u.component}> ${prop}[${i}] has no "${k}"`)
            }
          }
        }
      }
    }
    expect(bad).toEqual([])
  })

  /** The shape reader has to find something, or the test above passes for nothing. */
  it('reads a declared prop shape out of a component', () => {
    expect(requiredKeysByProp('LineGraph').get('curves')).toEqual(['a', 'b', 'c'])
    expect(requiredKeysByProp('LineGraph').get('points')).toEqual(['x', 'y'])
  })

  /** The detector has to fire, or the test above passes for the wrong reason. */
  it('reads real prop names out of a component', () => {
    expect(propsRead('LineGraph').has('xRange')).toBe(true)
    expect(propsRead('LineGraph').has('series')).toBe(false)
    expect(componentFileNames().get('line-graph')).toBe('LineGraph')
  })
})
