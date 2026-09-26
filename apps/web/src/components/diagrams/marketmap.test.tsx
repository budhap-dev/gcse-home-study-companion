import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MarketMap } from './MarketMap.tsx'

const svg = (props: Record<string, unknown>) => renderToStaticMarkup(<MarketMap props={props} alt="a market map" />)

function box(markup: string) {
  const m = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(markup)!
  return { minx: Number(m[1]), miny: Number(m[2]), w: Number(m[3]), h: Number(m[4]) }
}

/** Every text's estimated extent (x ± 0.6 × fontSize × characters, by its text-anchor). */
function extents(markup: string) {
  return [...markup.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map((m) => {
    const attrs = m[1]!
    const x = Number(/\bx="(-?[\d.]+)"/.exec(attrs)![1])
    const size = Number(/font-size="([\d.]+)"/.exec(attrs)?.[1] ?? '12')
    const anchor = /text-anchor="(\w+)"/.exec(attrs)?.[1] ?? 'start'
    const text = m[2]!.replace(/<[^>]+>/g, '')
    const w = text.length * 0.6 * size
    const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x
    return { left, right: left + w, text }
  })
}

function findProps(): Record<string, unknown>[] {
  const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content')
  const out: Record<string, unknown>[] = []
  for (const sub of readdirSync(ROOT).filter((d) => statSync(join(ROOT, d)).isDirectory())) {
    for (const f of readdirSync(join(ROOT, sub)).filter((x) => x.endsWith('.json'))) {
      const doc = JSON.parse(readFileSync(join(ROOT, sub, f), 'utf8'))
      for (const step of doc.lesson?.steps ?? []) {
        for (const v of step.visuals ?? []) if (v.component === 'market-map') out.push(v.props ?? {})
      }
      for (const ex of doc.why?.examples ?? []) {
        if (ex.visual?.component === 'market-map') out.push(ex.visual.props ?? {})
      }
    }
  }
  return out
}

/**
 * Drawn at 460 units, the map always scrolled on a phone: below its natural width a
 * diagram stops shrinking and scrolls instead. It is now 280, with a competitor's label
 * anchored so its estimated extent stays inside the box wherever its point sits.
 */
describe('market map', () => {
  it('fits every market map in the content pack on a phone', () => {
    const packs = findProps()
    expect(packs.length).toBeGreaterThan(0)
    for (const props of packs) {
      const markup = svg(props)
      const { minx, w } = box(markup)
      expect(w).toBeLessThanOrEqual(296)
      for (const e of extents(markup)) {
        expect(e.left, e.text).toBeGreaterThanOrEqual(minx - 0.5)
        expect(e.right, e.text).toBeLessThanOrEqual(minx + w + 0.5)
      }
    }
  })

  it('keeps a competitor label inside the box wherever its point sits', () => {
    const markup = svg({
      points: [
        { x: 0.02, y: 0.5, label: 'Right By The Edge' },
        { x: 0.98, y: 0.5, label: 'Also Right By The Edge' },
      ],
    })
    const { minx, w } = box(markup)
    for (const e of extents(markup)) {
      expect(e.left, e.text).toBeGreaterThanOrEqual(minx - 0.5)
      expect(e.right, e.text).toBeLessThanOrEqual(minx + w + 0.5)
    }
  })
})
