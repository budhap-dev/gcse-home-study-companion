import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { InequalityLine } from './InequalityLine.tsx'

/** Every prop object the content actually passes to this component, however deep it sits. */
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

/** viewBox width, and every text's estimated extent checked against it. */
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

describe('inequality-line', () => {
  it('keeps the ticks and bounds exactly where their numbers say', () => {
    // -5 to 5 with x > 2: 11 whole-number ticks, so the tick step is 1.
    const html = renderToStaticMarkup(<InequalityLine alt="" props={{ from: -5, to: 5, lower: { value: 2, inclusive: false } }} />)
    const x = (v: number) => 22 + ((v + 5) / 10) * (280 - 44)
    expect(html).toContain(`cx="${x(2)}"`)
    for (const t of ['-5', '-4', '0', '5']) expect(html, t).toContain(`>${t}<`)
  })

  it('fits a phone for every inequality line the content draws', () => {
    const pack = contentProps('inequality-line')
    expect(pack.length).toBeGreaterThan(0)
    for (const props of pack) fitsPhone(renderToStaticMarkup(<InequalityLine alt="" props={props} />))
  })
})
