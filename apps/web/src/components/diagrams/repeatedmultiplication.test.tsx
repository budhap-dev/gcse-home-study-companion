import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RepeatedMultiplication } from './RepeatedMultiplication.tsx'

const svg = (props: Record<string, unknown>) => renderToStaticMarkup(<RepeatedMultiplication props={props} alt="repeated multiplication" />)

function findProps(): Record<string, unknown>[] {
  const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content')
  const out: Record<string, unknown>[] = []
  for (const sub of readdirSync(ROOT).filter((d) => statSync(join(ROOT, d)).isDirectory())) {
    for (const f of readdirSync(join(ROOT, sub)).filter((x) => x.endsWith('.json'))) {
      const doc = JSON.parse(readFileSync(join(ROOT, sub, f), 'utf8'))
      for (const step of doc.lesson?.steps ?? []) {
        for (const v of step.visuals ?? []) if (v.component === 'repeated-multiplication') out.push(v.props ?? {})
      }
    }
  }
  return out
}

/**
 * Every text's estimated extent — x ± 0.6 × fontSize × characters, by its text-anchor —
 * must lie inside the viewBox. HTML entities (the diagram's own "×" is a real character,
 * but a name or unit occasionally has one) are decoded first so a `>` counted as four
 * characters ("&gt;") does not fail a line that actually fits.
 */
function assertFits(markup: string, label: string) {
  const [, , w] = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(markup)!.slice(1).map(Number)
  expect(w!, label).toBeLessThanOrEqual(296)
  for (const t of markup.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const attrs = t[1]!
    const x = Number(/\bx="(-?[\d.]+)"/.exec(attrs)![1])
    const size = Number(/font-size="([\d.]+)"/.exec(attrs)?.[1] ?? '12')
    const anchor = /text-anchor="(\w+)"/.exec(attrs)?.[1] ?? 'start'
    const text = t[2]!.replace(/<[^>]+>/g, '').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')
    const half = text.length * 0.6 * size
    const left = anchor === 'end' ? x - half : anchor === 'middle' ? x - half / 2 : x
    const right = anchor === 'end' ? x : anchor === 'middle' ? x + half / 2 : x + half
    expect(left, `${label} "${text}"`).toBeGreaterThanOrEqual(-0.5)
    expect(right, `${label} "${text}"`).toBeLessThanOrEqual(w! + 0.5)
  }
}

/**
 * base^index used to draw every box at a fixed 44-unit width and 26-unit gap: five boxes
 * for `index: 5` drew a 364-unit row, and below its natural width a diagram stops
 * shrinking and scrolls instead. The box now narrows as `index` grows, and the summary
 * sentence along the bottom wraps rather than overhanging a narrower row.
 */
describe('repeated multiplication', () => {
  it('fits every use in the content pack on a phone', () => {
    const packs = findProps()
    expect(packs.length).toBeGreaterThan(0)
    for (const props of packs) assertFits(svg(props), JSON.stringify(props))
  })

  it('narrows the box as the index grows, and still fits at the maximum index', () => {
    assertFits(svg({ base: 3, index: 8 }), 'index 8')
  })

  it('keeps drawing the same number of boxes as before', () => {
    const markup = svg({ base: 2, index: 5 })
    expect([...markup.matchAll(/<rect/g)].length).toBe(5)
  })
})
