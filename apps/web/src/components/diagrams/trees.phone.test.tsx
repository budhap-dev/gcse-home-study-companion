import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FrequencyTree } from './FrequencyTree.tsx'
import { ProbabilityTree } from './ProbabilityTree.tsx'

const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content')
function contentProps(component: string): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = []
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (node && typeof node === 'object') {
      const o = node as Record<string, unknown>
      if (o.component === component) found.push(o.props as Record<string, unknown>)
      Object.values(o).forEach(walk)
    }
  }
  for (const d of readdirSync(ROOT).filter((x) => statSync(join(ROOT, x)).isDirectory()))
    for (const f of readdirSync(join(ROOT, d)).filter((x) => x.endsWith('.json'))) walk(JSON.parse(readFileSync(join(ROOT, d, f), 'utf8')))
  return found
}

interface Box { l: number; r: number; t: number; b: number; what: string }
const hit = (a: Box, b: Box) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b
function texts(m: string): Box[] {
  return [...m.matchAll(/<text x="([\d.-]+)" y="([\d.-]+)"([^>]*)>([^<]+)<\/text>/g)].map((t) => {
    const x = Number(t[1]), y = Number(t[2]), attrs = t[3]!, text = t[4]!
    const size = Number(/font-size="([\d.]+)"/.exec(attrs)?.[1] ?? '12')
    const w = text.length * 0.6 * size
    const anchor = /text-anchor="(\w+)"/.exec(attrs)?.[1] ?? 'start'
    const l = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x
    return { l, r: l + w, t: y - size * 0.72, b: y + size * 0.2, what: text }
  })
}
function lines(m: string): Box[] {
  return [...m.matchAll(/<line x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"/g)].map((a) => {
    const [x1, y1, x2, y2] = [a[1], a[2], a[3], a[4]].map(Number) as [number, number, number, number]
    return { l: Math.min(x1, x2), r: Math.max(x1, x2), t: Math.min(y1, y2), b: Math.max(y1, y2), what: 'branch', x1, y1, x2, y2 } as Box & { x1: number; y1: number; x2: number; y2: number }
  })
}
/** Whether a straight branch passes through a text's box: sampled along its length. */
function crosses(line: Box & { x1?: number; y1?: number; x2?: number; y2?: number }, box: Box): boolean {
  for (let i = 0; i <= 40; i++) {
    const x = line.x1! + ((line.x2! - line.x1!) * i) / 40, y = line.y1! + ((line.y2! - line.y1!) * i) / 40
    if (x > box.l && x < box.r && y > box.t && y < box.b) return true
  }
  return false
}

/**
 * On a phone the first narrow layouts put a frequency tree's branch labels across its
 * boxes, and a probability tree's second branches through the first node labels. Every
 * tree the content draws must fit 296 units with no text on another text or a branch.
 */
describe.each([['frequency-tree', FrequencyTree], ['probability-tree', ProbabilityTree]] as const)('%s on a phone', (name, Component) => {
  const all = contentProps(name)
  it('found the content trees', () => expect(all.length).toBeGreaterThanOrEqual(2))
  it('fits, with no text on another text or on a branch', () => {
    for (const p of all) {
      const m = renderToStaticMarkup(<Component props={p} alt="" />)
      const vw = Number(/viewBox="0 0 ([\d.]+)/.exec(m)![1])
      expect(vw).toBeLessThanOrEqual(296)
      const t = texts(m)
      for (const x of t) expect(x.l >= 0 && x.r <= vw, `${x.what} inside`).toBe(true)
      for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) expect(hit(t[i]!, t[j]!), `${t[i]!.what} / ${t[j]!.what}`).toBe(false)
      for (const l of lines(m)) for (const x of t) expect(crosses(l, x), `a branch through ${x.what}`).toBe(false)
    }
  })
})
