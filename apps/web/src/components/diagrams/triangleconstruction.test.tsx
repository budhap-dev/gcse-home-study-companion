import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TriangleConstruction } from './TriangleConstruction.tsx'

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

describe('triangle construction', () => {
  it('places C by the law of cosines for an sss triangle', () => {
    // 8, 6, 5: x = (36 - 25 + 64) / 16 = 4.6875, y = sqrt(36 - 4.6875^2).
    const html = renderToStaticMarkup(<TriangleConstruction alt="" props={{ kind: 'sss', sides: [8, 6, 5] }} />)
    const S = 23
    const x = 4.6875, y = Math.sqrt(36 - x * x)
    const minX = Math.min(0, 8, x) - 1.2
    const maxY = y + 1.2
    const cx = (x - minX) * S
    const cy = (maxY - y) * S
    expect(html).toContain(`cx="${cx}" cy="${cy}"`)
  })

  it('fits a phone for every triangle the content constructs, including the widest one', () => {
    const pack = contentProps('triangle-construction')
    expect(pack.length).toBeGreaterThan(0)
    for (const props of pack) fitsPhone(renderToStaticMarkup(<TriangleConstruction alt="" props={props} />))
  })
})
