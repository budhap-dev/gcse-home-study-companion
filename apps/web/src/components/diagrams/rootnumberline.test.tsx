import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RootNumberLine } from './RootNumberLine.tsx'

const svg = (props: Record<string, unknown>) => renderToStaticMarkup(<RootNumberLine props={props} alt="a root trapped between two whole numbers" />)

function findProps(): Record<string, unknown>[] {
  const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content')
  const out: Record<string, unknown>[] = []
  for (const sub of readdirSync(ROOT).filter((d) => statSync(join(ROOT, d)).isDirectory())) {
    for (const f of readdirSync(join(ROOT, sub)).filter((x) => x.endsWith('.json'))) {
      const doc = JSON.parse(readFileSync(join(ROOT, sub, f), 'utf8'))
      for (const step of doc.lesson?.steps ?? []) {
        for (const v of step.visuals ?? []) if (v.component === 'root-number-line') out.push(v.props ?? {})
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
 * Drawn at a fixed 460 units regardless of props, the line always scrolled on a phone:
 * below its natural width a diagram stops shrinking and scrolls instead. It is now 280.
 * The sentence along the bottom was the part that forced the old width — at full length
 * it only fits a line this narrow by wrapping onto two lines, the same word-wrap
 * `EquationCard` uses, rather than by shrinking below the 11px floor.
 */
describe('root number line', () => {
  it('fits every use in the content pack on a phone', () => {
    const packs = findProps()
    expect(packs.length).toBeGreaterThan(0)
    for (const props of packs) assertFits(svg(props), JSON.stringify(props))
  })

  it('wraps the summary sentence rather than overhanging the line', () => {
    const markup = svg({ value: 50, index: 2, from: 6, to: 9 })
    // The sentence is long enough that it must be more than one line to fit.
    const sentenceTexts = [...markup.matchAll(/<text[^>]*font-size="13"[^>]*>([^<]*)<\/text>/g)]
    expect(sentenceTexts.length).toBeGreaterThan(1)
    for (const m of sentenceTexts) expect(m[1]!.length).toBeLessThan(45)
  })

  it('still traps the root between the correct pair of whole numbers', () => {
    const markup = svg({ value: 50, index: 2, from: 6, to: 9 })
    expect(markup).toContain('49 and 64')
  })
})
