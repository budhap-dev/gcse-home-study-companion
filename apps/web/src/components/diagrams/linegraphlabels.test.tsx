import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LineGraph } from './LineGraph.tsx'

/**
 * Every line graph in the pack, checked as a collection.
 *
 * A label is nudged clear of the ones already placed, and until 20 September 2026 that
 * nudge could walk it clean off the top of the canvas — where it renders without error,
 * passes every per-diagram test, and is simply not there. Twelve labels across Maths and
 * Further Maths were invisible that way, including the name of the curve on three of the
 * Further Maths graphs. No test could see it, because no test looked at the collection
 * and none compared a label's position with the canvas it had to fit in.
 */
const CONTENT = join(import.meta.dirname, '../../../../../supabase/seed/content')

interface Label { text: string; x: number; y: number; size: number; anchor: string }

function labelsOf(props: Record<string, unknown>) {
  const html = renderToStaticMarkup(<LineGraph alt="" props={props} />)
  const box = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(html)!
  const labels: Label[] = [...html.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)"([^>]*)>([^<]*)</g)].map((m) => ({
    x: Number(m[1]), y: Number(m[2]), text: m[4]!,
    size: Number(/font-size="([\d.]+)"/.exec(m[3]!)?.[1] ?? 12),
    anchor: /text-anchor="(\w+)"/.exec(m[3]!)?.[1] ?? 'start',
  })).filter((l) => l.text.trim())
  return { w: Number(box[1]), h: Number(box[2]), labels }
}

/** The same width estimate the component places by, so the two cannot disagree. */
const span = (l: Label) => {
  const w = l.text.length * l.size * 0.55
  const left = l.anchor === 'end' ? l.x - w : l.anchor === 'middle' ? l.x - w / 2 : l.x
  return { left, right: left + w, top: l.y - l.size * 0.8, bottom: l.y + l.size * 0.25 }
}

function everyLineGraph() {
  const out: { where: string; props: Record<string, unknown> }[] = []
  const walk = (node: unknown, where: string) => {
    if (Array.isArray(node)) return node.forEach((v) => walk(v, where))
    if (node && typeof node === 'object') {
      const o = node as Record<string, unknown>
      if (o.component === 'line-graph' && o.props) out.push({ where, props: o.props as Record<string, unknown> })
      for (const v of Object.values(o)) walk(v, where)
    }
  }
  for (const subject of readdirSync(CONTENT)) {
    const dir = join(CONTENT, subject)
    if (!statSync(dir).isDirectory()) continue
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.json')) walk(JSON.parse(readFileSync(join(dir, f), 'utf8')), `${subject}/${f.replace('.json', '')}`)
    }
  }
  return out
}

describe('line graph labels across the whole pack', () => {
  const graphs = everyLineGraph()

  it('found them', () => {
    expect(graphs.length).toBeGreaterThan(50)
  })

  it('draws every label inside the canvas, so none is invisible', () => {
    const escaped: string[] = []
    for (const { where, props } of graphs) {
      const { w, h, labels } = labelsOf(props)
      for (const l of labels) {
        const s = span(l)
        if (s.top < -1 || s.bottom > h + 1) escaped.push(`${where}: "${l.text}" at y ${l.y}, canvas is ${h} tall`)
        // Sideways counts too: y = f(x − 3) had its last characters off the right edge.
        if (s.left < -1 || s.right > w + 1) escaped.push(`${where}: "${l.text}" runs to x ${s.right.toFixed(0)}, canvas is ${w} wide`)
      }
    }
    expect(escaped).toEqual([])
  })

  it('never prints one label over another', () => {
    const clashes: string[] = []
    for (const { where, props } of graphs) {
      const { labels } = labelsOf(props)
      for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
          const a = span(labels[i]!), b = span(labels[j]!)
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left)
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
          if (ox > 2 && oy > 2) clashes.push(`${where}: "${labels[i]!.text}" over "${labels[j]!.text}"`)
        }
      }
    }
    expect(clashes).toEqual([])
  })
})
