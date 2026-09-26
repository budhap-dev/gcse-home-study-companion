import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ProbabilityTree } from './ProbabilityTree.tsx'

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

describe('probability tree', () => {
  it('multiplies branch probabilities into an exact fraction at the leaf', () => {
    const tree = { children: [
      { label: 'Red', prob: '3/8', children: [{ label: 'Red', prob: '2/7' }, { label: 'Blue', prob: '5/7' }] },
    ] }
    const html = renderToStaticMarkup(<ProbabilityTree alt="" props={{ tree }} />)
    // 3/8 x 2/7 = 6/56 = 3/28. The path and result print as two lines.
    expect(html).toContain('Red, Red')
    expect(html).toContain('= 3/28')
  })

  it('wraps a leaf product onto two lines rather than one long one', () => {
    // A 1/1000 x 99/100 branch multiplies out to a long fraction and a longer path.
    const tree = { children: [
      { label: 'well', prob: '999/1000', children: [{ label: 'tests negative', prob: '99/100' }] },
    ] }
    const html = renderToStaticMarkup(<ProbabilityTree alt="" props={{ tree }} />)
    expect(html).toContain('well, tests negative')
    expect(html).toContain('98901/100000')
    // Two separate text elements, not one that concatenates path and result.
    expect(html).not.toContain('well, tests negative = 98901/100000')
  })

  it('fits a phone for every probability tree the content draws', () => {
    const pack = contentProps('probability-tree')
    expect(pack.length).toBeGreaterThan(0)
    for (const props of pack) fitsPhone(renderToStaticMarkup(<ProbabilityTree alt="" props={props} />))
  })

  it('falls back to the alt text rather than crashing when given no tree', () => {
    expect(renderToStaticMarkup(<ProbabilityTree alt="a probability tree" props={{}} />)).toContain('a probability tree')
  })
})
