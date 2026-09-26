import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CircleTheorem } from './CircleTheorem.tsx'

const svg = (props: Record<string, unknown>) => renderToStaticMarkup(<CircleTheorem props={props} alt="a circle with named points" />)

function findProps(): Record<string, unknown>[] {
  const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content')
  const out: Record<string, unknown>[] = []
  for (const sub of readdirSync(ROOT).filter((d) => statSync(join(ROOT, d)).isDirectory())) {
    for (const f of readdirSync(join(ROOT, sub)).filter((x) => x.endsWith('.json'))) {
      const doc = JSON.parse(readFileSync(join(ROOT, sub, f), 'utf8'))
      for (const step of doc.lesson?.steps ?? []) {
        for (const v of step.visuals ?? []) if (v.component === 'circle-theorem') out.push(v.props ?? {})
      }
      for (const ex of doc.why?.examples ?? []) {
        if (ex.visual?.component === 'circle-theorem') out.push(ex.visual.props ?? {})
      }
    }
  }
  return out
}

/** Every text's estimated extent — x ± 0.6 × fontSize × characters, by its text-anchor. */
function assertFits(markup: string, label: string) {
  const [minx, , w] = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(markup)!.slice(1).map(Number)
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
    expect(left, `${label} "${text}"`).toBeGreaterThanOrEqual(minx! - 0.5)
    expect(right, `${label} "${text}"`).toBeLessThanOrEqual(minx! + w! + 0.5)
  }
}

/**
 * The box grows to fit whatever is drawn, so an external point far from the circle (or a
 * long tangent) used to push the box past 296: `external: { dist: 2.2 }` on the circle
 * theorems page drew a 388-unit box, and below its natural width a diagram stops shrinking
 * and scrolls instead. The whole geometry now shrinks around the fixed centre by
 * bisection until the box fits — every label keeps its drawn font-size, never below 11 —
 * so a circle with nothing unusual to draw (most of the pack) is completely unchanged.
 */
describe('circle theorem', () => {
  it('fits every use in the content pack on a phone', () => {
    const packs = findProps()
    expect(packs.length).toBeGreaterThan(0)
    for (const props of packs) assertFits(svg(props), JSON.stringify(props).slice(0, 60))
  })

  it('leaves an ordinary circle (no external point) at its full 105-unit radius', () => {
    const markup = svg({ points: { A: 30, B: 150, C: 270 }, segments: [['A', 'B'], ['B', 'C']] })
    expect(markup).toContain('r="105"')
  })

  it('shrinks the radius, rather than any label, when an external point pushes the box wide', () => {
    const markup = svg({
      points: {},
      centre: true,
      external: [{ name: 'P', angle: 0, dist: 2.2 }],
      segments: [['O', 'P1'], ['O', 'P2']],
    })
    expect(markup).not.toContain('r="105"')
    // Every label is still at least 11px: the box shrank, the text did not.
    for (const m of markup.matchAll(/font-size="([\d.]+)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(11)
  })
})
