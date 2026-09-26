import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { everyVisual } from '@study/shared'
import { CircuitDiagram } from './CircuitDiagram.tsx'

const HERE = import.meta.dirname
const CONTENT = join(HERE, '../../../../../supabase/seed/content')

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? jsonFiles(full) : name.endsWith('.json') ? [full] : []
  })
}

/** Every set of props content actually gives circuit-diagram, wherever it appears. */
function propsInUse(): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const file of jsonFiles(CONTENT)) {
    const topic = JSON.parse(readFileSync(file, 'utf8'))
    for (const { visual } of everyVisual(topic)) {
      if (visual.type === 'diagram' && visual.component === 'circuit-diagram') out.push(visual.props ?? {})
    }
  }
  return out
}

/** A text's estimated width, and how far it reaches left/right of its anchor x. */
function extentOf(x: number, anchor: string, fontSize: number, text: string) {
  const width = 0.6 * fontSize * text.length
  const left = anchor === 'end' ? x - width : anchor === 'middle' ? x - width / 2 : x
  return { left, right: left + width }
}

/** Every text (or wrapped tspan line) CircuitDiagram draws, with its anchor and size. */
function texts(markup: string) {
  const out: { x: number; anchor: string; size: number; text: string }[] = []
  for (const m of markup.matchAll(
    /<text x="([-\d.]+)" y="[-\d.]+" text-anchor="(\w+)"[^>]*font-size:(\d+(?:\.\d+)?)px[^"]*"[^>]*>([^<]*)<\/text>/g,
  )) {
    out.push({ x: Number(m[1]), anchor: m[2]!, size: Number(m[3]), text: m[4]! })
  }
  return out
}

describe('circuit diagram fits a phone', () => {
  const pack = propsInUse()

  it('found circuit diagrams in the content', () => {
    expect(pack.length).toBeGreaterThan(0)
  })

  /*
   * Every prop set the content actually uses, rendered at the component's own width
   * (it draws the same way regardless of the box it is given), checked against the 296
   * units a phone's card allows and against every text's own estimated extent.
   */
  it('keeps the viewBox at or under 296 units, with every label inside it', () => {
    for (const props of pack) {
      const markup = renderToStaticMarkup(<CircuitDiagram alt="a circuit" props={props} />)
      const [width] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(markup)!.slice(1).map(Number)
      expect(width, JSON.stringify(props)).toBeLessThanOrEqual(296)
      for (const t of texts(markup)) {
        if (!t.text.trim()) continue
        const { left, right } = extentOf(t.x, t.anchor, t.size, t.text)
        expect(left, `${JSON.stringify(props)} "${t.text}"`).toBeGreaterThanOrEqual(0)
        expect(right, `${JSON.stringify(props)} "${t.text}"`).toBeLessThanOrEqual(width!)
      }
    }
  })
})
