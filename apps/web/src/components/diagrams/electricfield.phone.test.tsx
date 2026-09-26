import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { everyVisual } from '@study/shared'
import { ElectricField } from './ElectricField.tsx'

const HERE = import.meta.dirname
const CONTENT = join(HERE, '../../../../../supabase/seed/content')

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? jsonFiles(full) : name.endsWith('.json') ? [full] : []
  })
}

/** Every set of props content actually gives electric-field, wherever it appears. */
function propsInUse(): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const file of jsonFiles(CONTENT)) {
    const topic = JSON.parse(readFileSync(file, 'utf8'))
    for (const { visual } of everyVisual(topic)) {
      if (visual.type === 'diagram' && visual.component === 'electric-field') out.push(visual.props ?? {})
    }
  }
  return out
}

function extentOf(x: number, anchor: string, fontSize: number, text: string) {
  const width = 0.6 * fontSize * text.length
  const left = anchor === 'end' ? x - width : anchor === 'middle' ? x - width / 2 : x
  return { left, right: left + width }
}

/**
 * Every text ElectricField draws, with its anchor and size — including each line of a
 * wrapped caption or sphere label, which are drawn as tspans sharing their parent text's
 * anchor and font size but each with their own x.
 */
function texts(markup: string) {
  const out: { x: number; anchor: string; size: number; text: string }[] = []
  for (const m of markup.matchAll(
    /<text x="([-\d.]+)" y="[-\d.]+" text-anchor="(\w+)"[^>]*font-size:(\d+(?:\.\d+)?)px[^"]*"[^>]*>([\s\S]*?)<\/text>/g,
  )) {
    const [, x, anchor, size, inner] = m
    const tspans = [...inner!.matchAll(/<tspan x="([-\d.]+)"[^>]*>([^<]*)<\/tspan>/g)]
    if (tspans.length) {
      for (const t of tspans) out.push({ x: Number(t[1]), anchor: anchor!, size: Number(size), text: t[2]! })
    } else {
      out.push({ x: Number(x), anchor: anchor!, size: Number(size), text: inner! })
    }
  }
  return out
}

describe('electric field fits a phone', () => {
  const pack = propsInUse()

  it('found electric field diagrams in the content', () => {
    expect(pack.length).toBeGreaterThan(0)
  })

  it('keeps the viewBox at or under 296 units, with every caption and label inside it', () => {
    for (const props of pack) {
      const markup = renderToStaticMarkup(<ElectricField alt="an electric field" props={props} />)
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
