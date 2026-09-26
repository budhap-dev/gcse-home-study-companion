import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { IndexLadder } from './IndexLadder.tsx'

const svg = (props: Record<string, unknown>) => renderToStaticMarkup(<IndexLadder props={props} alt="a ladder of powers" />)

function findProps(): Record<string, unknown>[] {
  const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content')
  const out: Record<string, unknown>[] = []
  for (const sub of readdirSync(ROOT).filter((d) => statSync(join(ROOT, d)).isDirectory())) {
    for (const f of readdirSync(join(ROOT, sub)).filter((x) => x.endsWith('.json'))) {
      const doc = JSON.parse(readFileSync(join(ROOT, sub, f), 'utf8'))
      for (const step of doc.lesson?.steps ?? []) {
        for (const v of step.visuals ?? []) if (v.component === 'index-ladder') out.push(v.props ?? {})
      }
    }
  }
  return out
}

/** Every text's estimated extent — x ± 0.6 × fontSize × characters, by its text-anchor. */
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
 * Drawn at a fixed 360 units regardless of props, the ladder always scrolled on a phone:
 * below its natural width a diagram stops shrinking and scrolls instead. It is now 260,
 * with its four columns re-spaced to fit.
 */
describe('index ladder', () => {
  it('fits every use in the content pack on a phone', () => {
    const packs = findProps()
    expect(packs.length).toBeGreaterThan(0)
    for (const props of packs) assertFits(svg(props), JSON.stringify(props))
  })

  it('draws one row per rung from `from` down to `to`', () => {
    const markup = svg({ base: 2, from: 3, to: -2 })
    expect([...markup.matchAll(/<tspan baseline-shift="super"/g)].length).toBe(6)
  })
})
