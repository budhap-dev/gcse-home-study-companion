import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { everyVisual } from '@study/shared'
import { ElectrolysisCell } from './ElectrolysisCell.tsx'

const HERE = import.meta.dirname
const CONTENT = join(HERE, '../../../../../supabase/seed/content')

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? jsonFiles(full) : name.endsWith('.json') ? [full] : []
  })
}

/** Every set of props content actually gives electrolysis-cell, wherever it appears. */
function propsInUse(): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const file of jsonFiles(CONTENT)) {
    const topic = JSON.parse(readFileSync(file, 'utf8'))
    for (const { visual } of everyVisual(topic)) {
      if (visual.type === 'diagram' && visual.component === 'electrolysis-cell') out.push(visual.props ?? {})
    }
  }
  return out
}

function extentOf(x: number, anchor: string, fontSize: number, text: string) {
  const width = 0.6 * fontSize * text.length
  const left = anchor === 'end' ? x - width : anchor === 'middle' ? x - width / 2 : x
  return { left, right: left + width }
}

/** Every text ElectrolysisCell draws: font-family/font-size are plain attributes here, not a style object. */
function texts(markup: string) {
  const out: { x: number; anchor: string; size: number; text: string }[] = []
  for (const m of markup.matchAll(
    /<text x="([-\d.]+)" y="[^"]*"(?: text-anchor="(\w+)")?[^>]*font-size="(\d+(?:\.\d+)?)"[^>]*>([^<]*)<\/text>/g,
  )) {
    out.push({ x: Number(m[1]), anchor: m[2] ?? 'start', size: Number(m[3]), text: m[4]! })
  }
  return out
}

describe('electrolysis cell fits a phone', () => {
  const pack = propsInUse()

  it('found electrolysis cells in the content', () => {
    expect(pack.length).toBeGreaterThan(0)
  })

  it('keeps the viewBox at or under 296 units, with every label inside it', () => {
    for (const props of pack) {
      const markup = renderToStaticMarkup(<ElectrolysisCell alt="an electrolysis cell" props={props} />)
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
