import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { VectorTriangle } from './VectorTriangle.tsx'

function contentProps(component: string): Record<string, unknown>[] {
  const root = join(import.meta.dirname, '../../../../../supabase/seed/content')
  const found: Record<string, unknown>[] = []
  const collect = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(collect); return }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>
      if (obj.component === component) found.push((obj.props as Record<string, unknown>) ?? {})
      Object.values(obj).forEach(collect)
    }
  }
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.json')) collect(JSON.parse(readFileSync(full, 'utf8')))
    }
  }
  walk(root)
  return found
}

function fitsPhone(html: string, maxWidth = 296): number {
  const width = Number(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+)/.exec(html)?.[1])
  expect(width).toBeLessThanOrEqual(maxWidth)
  for (const m of html.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)) {
    const attrs = m[1]!, text = m[2]!
    if (!text.trim() || /rotate\(-?90/.test(attrs)) continue
    const x = Number(/(?:^|\s)x="(-?[\d.]+)"/.exec(attrs)?.[1])
    if (!Number.isFinite(x)) continue
    const anchor = /text-anchor="(\w+)"/.exec(attrs)?.[1] ?? 'start'
    const fontSize = Number(/font-size="([\d.]+)"/.exec(attrs)?.[1] ?? '11')
    const w = text.length * 0.6 * fontSize
    const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x
    expect(left, `"${text}" left edge`).toBeGreaterThanOrEqual(-0.5)
    expect(left + w, `"${text}" right edge`).toBeLessThanOrEqual(width + 0.5)
  }
  return width
}

/**
 * The resultant's label was always pushed to one fixed side, which for a 200-north and
 * 50-east pair was the side the chain of vectors is on — so "resultant 206.16 km/h" was
 * drawn straight through "200 north". It now goes to the side the chain is not on.
 */
describe('vector-triangle', () => {
  /** Every label, with the box it occupies, estimated from its anchor and length. */
  const labels = (html: string) =>
    [...html.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)" text-anchor="(\w+)"[^>]*font-size="12"[^>]*>([^<]*)<\/text>/g)].map((m) => {
      const x = Number(m[1]), anchor = m[3], text = m[4]!
      const w = text.length * 6.9
      const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x
      return { left, right: left + w, y: Number(m[2]), text }
    })

  const overlaps = (props: Record<string, unknown>) => {
    const ls = labels(renderToStaticMarkup(<VectorTriangle alt="" props={props} />))
    const hits: string[] = []
    for (let i = 0; i < ls.length; i++) {
      for (let j = i + 1; j < ls.length; j++) {
        const a = ls[i]!, b = ls[j]!
        if (Math.abs(a.y - b.y) < 12 && a.right > b.left && a.left < b.right) hits.push(`${a.text} / ${b.text}`)
      }
    }
    return hits
  }

  it('keeps the resultant label off the other labels', () => {
    expect(overlaps({ vectors: [{ x: 0, y: 200, label: '200 north' }, { x: 50, y: 0, label: '50 east' }], unit: 'km/h' })).toEqual([])
  })

  it('does the same when the chain turns the other way', () => {
    expect(overlaps({ vectors: [{ x: 4, y: 0, label: '4 N' }, { x: 0, y: 3, label: '3 N' }], unit: 'N' })).toEqual([])
    expect(overlaps({ vectors: [{ x: 0, y: 3, label: '3 N' }, { x: 4, y: 0, label: '4 N' }], unit: 'N' })).toEqual([])
  })

  it('still works out the resultant from the components', () => {
    const html = renderToStaticMarkup(<VectorTriangle alt="" props={{ vectors: [{ x: 4, y: 0 }, { x: 0, y: 3 }], unit: 'N' }} />)
    expect(html).toContain('resultant 5 N')
  })

  it('fits a phone for every vector triangle the content draws', () => {
    const pack = contentProps('vector-triangle')
    expect(pack.length).toBeGreaterThan(0)
    for (const props of pack) fitsPhone(renderToStaticMarkup(<VectorTriangle alt="" props={props} />))
  })
})
